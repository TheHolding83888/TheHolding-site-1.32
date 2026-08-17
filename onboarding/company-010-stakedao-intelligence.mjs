#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { Contract, JsonRpcProvider, formatUnits, getAddress } from 'ethers';

const ROOT=process.cwd();
const FILE=process.env.COMPANY_010_RECONCILIATION_OUTPUT||path.join(ROOT,'companies/company-010-reconciliation.json');
const addr=x=>getAddress(String(x).toLowerCase());
const WALLETS=[{alias:'Wallet 1',address:addr('0xd90d1e395de36e1e59c42f5df537801c26bbc03f')},{alias:'Wallet 2',address:addr('0x64688f4adc3f72cdb44d07e4879c724cd7025696')}];
const VAULT=addr('0x6f6533b7e0730d150e617001e331ff2faa41fde4');
const EXPECTED_CRV=addr('0x8ee73c484a26e0a5df2ee2a4960b789967dd0415');
const RPC=[...new Set([process.env.BASE_RPC_URL,process.env.BASE_RPC_URL_2,'https://base-rpc.publicnode.com','https://mainnet.base.org'].filter(Boolean))];
const VAULT_ABI=['function ACCOUNTANT() view returns(address)','function gauge() view returns(address)'];
const ACCOUNTANT_ABI=[
  'function REWARD_TOKEN() view returns(address)',
  'function PROTOCOL_CONTROLLER() view returns(address)',
  'function SCALING_FACTOR() view returns(uint128)',
  'function vaults(address vault) view returns(uint256 integral,uint128 supply,uint128 feeSubjectAmount,uint128 totalAmount,uint128 netCredited,uint128 reservedHarvestFee,uint128 reservedProtocolFee)',
  'function accounts(address vault,address account) view returns(uint128 balance,uint256 integral,uint256 pendingRewards)'
];
const CONTROLLER_ABI=['function vault(address gauge) view returns(address)'];
const round=(x,d=12)=>Number.isFinite(Number(x))?Number(Number(x).toFixed(d)):null;
const err=e=>String(e?.shortMessage||e?.message||e||'unknown').replace(/https?:\/\/[^\s)]+/g,'[url-redacted]');
const lower=x=>String(x||'').toLowerCase();
async function fetchJson(url,timeoutMs=25000){const c=new AbortController(),t=setTimeout(()=>c.abort(),timeoutMs);try{const r=await fetch(url,{headers:{accept:'application/json','user-agent':'The-Holding-Cypher-StakeDAO-Intelligence/0.1'},signal:c.signal,cache:'no-store'});if(!r.ok)throw new Error(`HTTP ${r.status}`);return await r.json()}finally{clearTimeout(t)}}
function strategyList(x){if(Array.isArray(x))return x;if(Array.isArray(x?.deployed))return x.deployed;if(Array.isArray(x?.parsed?.deployed))return x.parsed.deployed;if(Array.isArray(x?.data?.deployed))return x.data.deployed;return[]}
function num(x){return Number.isFinite(Number(x))?Number(x):null}

async function providerMesh(fn){const failures=[];for(const url of RPC){try{const p=new JsonRpcProvider(url,8453,{staticNetwork:true});if(Number((await p.getNetwork()).chainId)!==8453)throw new Error('wrong chain');return{result:await fn(p),failures}}catch(e){failures.push(err(e))}}throw new Error(`Base provider mesh failed: ${failures.join(' | ')}`)}

async function accountantState(){return providerMesh(async provider=>{
  const vault=new Contract(VAULT,VAULT_ABI,provider),accountantAddress=addr(await vault.ACCOUNTANT()),gauge=addr(await vault.gauge()),accountant=new Contract(accountantAddress,ACCOUNTANT_ABI,provider);
  const rewardToken=addr(await accountant.REWARD_TOKEN());if(lower(rewardToken)!==lower(EXPECTED_CRV))throw new Error(`Stake DAO Accountant reward token mismatch ${rewardToken}`);
  const controllerAddress=addr(await accountant.PROTOCOL_CONTROLLER()),controller=new Contract(controllerAddress,CONTROLLER_ABI,provider),registeredVault=addr(await controller.vault(gauge));
  if(lower(registeredVault)!==lower(VAULT))throw new Error(`Stake DAO gauge/vault registry mismatch ${registeredVault}`);
  const scaling=BigInt(await accountant.SCALING_FACTOR()),v=await accountant.vaults(VAULT),vaultIntegral=BigInt(v.integral),byWallet=[];let total=0n;
  for(const w of WALLETS){const a=await accountant.accounts(VAULT,w.address),balance=BigInt(a.balance),accountIntegral=BigInt(a.integral),pending=BigInt(a.pendingRewards);const delta=vaultIntegral>accountIntegral?vaultIntegral-accountIntegral:0n;const accrued=pending+(delta*balance/scaling);total+=accrued;byWallet.push({wallet:w.address,walletAlias:w.alias,balance:formatUnits(balance,18),storedPendingCrv:formatUnits(pending,18),integralDeltaCrv:formatUnits(accrued-pending,18),claimableCrv:formatUnits(accrued,18)})}
  return{accountant:accountantAddress,controller:controllerAddress,gauge,rewardToken,scalingFactor:scaling.toString(),vaultIntegral:vaultIntegral.toString(),claimableCrv:round(Number(formatUnits(total,18)),12),byWallet,source:'Stake DAO verified Accountant integral state on Base',formula:'pendingRewards + max(vaultIntegral-accountIntegral,0) * balance / 1e27'};
})}

async function strategyApr(){const api=await fetchJson('https://api.stakedao.org/api/strategies/curve/8453.json');const list=strategyList(api),s=list.find(x=>lower(x?.vault)===lower(VAULT));if(!s)throw new Error(`Stake DAO official API did not contain Base vault ${VAULT}; deployed=${list.length}`);const coins=(s.coins||[]).map(x=>({symbol:x.symbol||null,address:x.address||null,decimals:num(x.decimals)}));const rewards=(s.rewards||[]).map(x=>({symbol:x?.token?.symbol||null,address:x?.token?.address||null,apr:num(x.apr),price:num(x.price),streaming:Boolean(x.streaming),periodFinish:num(x.periodFinish)}));const currentTotal=num(s?.apr?.current?.total),tradingApy=num(s.tradingApy),minApr=num(s.minApr),maxApr=num(s.maxApr);if(currentTotal===null)throw new Error('Stake DAO current total APR unavailable');return{key:s.key||null,name:s.name||null,vault:s.vault,gaugeAddress:s.gaugeAddress||null,lpToken:s.lpToken||null,coins,rewards,tradingApy,minApr,maxApr,currentAprPct:currentTotal,currentAprDetails:s?.apr?.current?.details||[],lpPriceInUsd:num(s.lpPriceInUsd),tvl:num(s.tvl),source:'Stake DAO official /api/strategies/curve/8453.json'};}

const recon=JSON.parse(fs.readFileSync(FILE,'utf8'));
if(recon?.version!=='0.2-company-010-capital-reconciliation-stakedao-base'||!recon?.stakeDaoBase?.result)throw new Error('Stake DAO reconciliation v0.2 required');
if(recon?.authority?.executionAuthority!=='none')throw new Error('authority drift');
const[accounting,apr]=await Promise.all([accountantState(),strategyApr()]);
const r=recon.stakeDaoBase.result;
r.crvClaimable=accounting.result.claimableCrv;
r.rewardAccounting=accounting.result;
r.referenceAprPct=apr.currentAprPct;
r.referenceAprStatus='measured';
r.referenceAprSource=apr.source;
r.stakeDaoStrategy=apr;
r.baseApyPct=apr.tradingApy;
r.baseApyStatus=apr.tradingApy!==null?'measured':'warming';
r.source='Stake DAO RewardVault + Stake DAO verified Accountant + Stake DAO official strategy API + Curve pool onchain balances';
recon.generatedAt=new Date().toISOString();
recon.stakeDaoIntelligence={version:'0.1-stakedao-accountant-strategy-api',claimableMethod:'verified-accountant-integral',aprMethod:'official-stakedao-current-total-apr'};
fs.writeFileSync(FILE,JSON.stringify(recon,null,2)+'\n');
console.log(JSON.stringify({status:'PASS',stakeDaoValueUsd:r.totalPositionUsd,crvClaimable:r.crvClaimable,currentAprPct:r.referenceAprPct,tradingApyPct:r.baseApyPct,apiStrategy:apr.name,accountant:accounting.result.accountant,gauge:accounting.result.gauge,executionAuthority:'none'},null,2));
