#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { Contract, JsonRpcProvider, formatUnits, getAddress } from 'ethers';

const ROOT=process.cwd();
const FILE=process.env.COMPANY_010_RECONCILIATION_OUTPUT||path.join(ROOT,'companies/company-010-reconciliation.json');
const addr=x=>getAddress(String(x).toLowerCase());
const WALLETS=[{alias:'Wallet 1',address:addr('0xd90d1e395de36e1e59c42f5df537801c26bbc03f')},{alias:'Wallet 2',address:addr('0x64688f4adc3f72cdB44d07e4879c724cd7025696')}];
const VAULT=addr('0x6f6533b7e0730d150e617001e331ff2faa41fde4');
const POOL=addr('0xf6c5f01c7f3148891ad0e19df78743d31e390d1f');
const EXPECTED_CRV=addr('0x8ee73c484a26e0a5df2ee2a4960b789967dd0415');
const RPC=[...new Set([process.env.BASE_RPC_URL,process.env.BASE_RPC_URL_2,'https://base-rpc.publicnode.com','https://mainnet.base.org'].filter(Boolean))];
const VAULT_ABI=['function ACCOUNTANT() view returns(address)','function gauge() view returns(address)','function asset() view returns(address)'];
const ACCOUNTANT_ABI=[
  'function REWARD_TOKEN() view returns(address)',
  'function PROTOCOL_CONTROLLER() view returns(address)',
  'function SCALING_FACTOR() view returns(uint128)',
  'function vaults(address vault) view returns(uint256 integral,uint128 supply,uint128 feeSubjectAmount,uint128 totalAmount,uint128 netCredited,uint128 reservedHarvestFee,uint128 reservedProtocolFee)',
  'function accounts(address vault,address account) view returns(uint128 balance,uint256 integral,uint256 pendingRewards)'
];
const CONTROLLER_ABI=['function vault(address gauge) view returns(address)'];
const num=x=>x!==null&&x!==undefined&&x!==''&&Number.isFinite(Number(x))?Number(x):null;
const round=(x,d=12)=>num(x)===null?null:Number(Number(x).toFixed(d));
const err=e=>String(e?.shortMessage||e?.message||e||'unknown').replace(/https?:\/\/[^\s)]+/g,'[url-redacted]');
const lower=x=>String(x||'').toLowerCase();
async function fetchJson(url,timeoutMs=25000){const c=new AbortController(),t=setTimeout(()=>c.abort(),timeoutMs);try{const r=await fetch(url,{headers:{accept:'application/json','user-agent':'The-Holding-Cypher-StakeDAO-Intelligence/0.2'},signal:c.signal,cache:'no-store'});if(!r.ok)throw new Error(`HTTP ${r.status}`);return await r.json()}finally{clearTimeout(t)}}
async function providerMesh(fn){const failures=[];for(const url of RPC){try{const p=new JsonRpcProvider(url,8453,{staticNetwork:true});if(Number((await p.getNetwork()).chainId)!==8453)throw new Error('wrong chain');return{result:await fn(p),failures}}catch(e){failures.push(err(e))}}throw new Error(`Base provider mesh failed: ${failures.join(' | ')}`)}
function findAddressNode(root,address){const target=lower(address),seen=new Set();function walk(x,d=0){if(d>10||x==null)return null;if(Array.isArray(x)){for(const v of x){const r=walk(v,d+1);if(r)return r}return null}if(typeof x!=='object'||seen.has(x))return null;seen.add(x);for(const[k,v]of Object.entries(x)){if(lower(k)===target||(typeof v==='string'&&lower(v)===target))return x}for(const v of Object.values(x)){const r=walk(v,d+1);if(r)return r}return null}return walk(root)}
function flattenNumbers(node){const out=[];function walk(x,p='',d=0){if(d>8||x==null)return;if(Array.isArray(x)){x.forEach((v,i)=>walk(v,`${p}.${i}`,d+1));return}if(typeof x==='object'){Object.entries(x).forEach(([k,v])=>walk(v,p?`${p}.${k}`:k,d+1));return}const n=num(x);if(n!==null)out.push({path:p,value:n})}walk(node);return out}
function normalizePercent(value,path=''){const v=num(value);if(v===null)return null;if(/pcent|percent|pct/i.test(path))return round(v,8);if(Math.abs(v)<=1)return round(v*100,8);return round(v,8)}
function findBaseApy(root){const candidates=flattenNumbers(root).filter(x=>/(latest.*daily.*apy|daily.*apy|base.*apy|apy)/i.test(x.path)&&!/(reward|crv|gauge|future|weekly|monthly)/i.test(x.path));if(!candidates.length)return null;const preferred=candidates.find(x=>/latest.*daily.*apy/i.test(x.path))||candidates.find(x=>/daily.*apy/i.test(x.path))||candidates[0];return{valuePct:normalizePercent(preferred.value,preferred.path),path:preferred.path,raw:preferred.value}}
function findCrvApr(root){const candidates=flattenNumbers(root).filter(x=>/(crv.*apr|apr.*crv|gauge.*apr|apr)/i.test(x.path));if(!candidates.length)return null;const preferred=candidates.find(x=>/crv.*apr|apr.*crv/i.test(x.path))||candidates[0];return{valuePct:normalizePercent(preferred.value,preferred.path),path:preferred.path,raw:preferred.value}}

async function accountantState(){return providerMesh(async provider=>{
  const vault=new Contract(VAULT,VAULT_ABI,provider),asset=addr(await vault.asset());if(lower(asset)!==lower(POOL))throw new Error(`Stake DAO vault asset mismatch ${asset}`);
  const accountantAddress=addr(await vault.ACCOUNTANT()),gauge=addr(await vault.gauge()),accountant=new Contract(accountantAddress,ACCOUNTANT_ABI,provider);
  const rewardToken=addr(await accountant.REWARD_TOKEN());if(lower(rewardToken)!==lower(EXPECTED_CRV))throw new Error(`Stake DAO Accountant reward token mismatch ${rewardToken}`);
  const controllerAddress=addr(await accountant.PROTOCOL_CONTROLLER()),controller=new Contract(controllerAddress,CONTROLLER_ABI,provider),registeredVault=addr(await controller.vault(gauge));
  if(lower(registeredVault)!==lower(VAULT))throw new Error(`Stake DAO gauge/vault registry mismatch ${registeredVault}`);
  const scaling=BigInt(await accountant.SCALING_FACTOR()),v=await accountant.vaults(VAULT),vaultIntegral=BigInt(v.integral),byWallet=[];let total=0n;
  for(const w of WALLETS){const a=await accountant.accounts(VAULT,w.address),balance=BigInt(a.balance),accountIntegral=BigInt(a.integral),pending=BigInt(a.pendingRewards);const delta=vaultIntegral>accountIntegral?vaultIntegral-accountIntegral:0n;const accrued=pending+(delta*balance/scaling);total+=accrued;byWallet.push({wallet:w.address,walletAlias:w.alias,balance:formatUnits(balance,18),storedPendingCrv:formatUnits(pending,18),integralDeltaCrv:formatUnits(accrued-pending,18),claimableCrv:formatUnits(accrued,18)})}
  return{accountant:accountantAddress,controller:controllerAddress,gauge,rewardToken,scalingFactor:scaling.toString(),vaultIntegral:vaultIntegral.toString(),claimableCrv:round(Number(formatUnits(total,18)),12),byWallet,source:'Stake DAO verified Accountant integral state on Base',formula:'pendingRewards + max(vaultIntegral-accountIntegral,0) * balance / 1e27'};
})}

async function curveYield(gauge){const[base,rewards]=await Promise.all([fetchJson('https://api.curve.finance/v1/getBaseApys/base'),fetchJson('https://api.curve.finance/v1/getFactoGaugesCrvRewards/base').catch(()=>null)]);let poolNode=findAddressNode(base,POOL);if(!poolNode&&base?.data)poolNode=findAddressNode(base.data,POOL);if(!poolNode&&base?.apys){const direct=base.apys[lower(POOL)]??base.apys[POOL]??null;if(direct!==null)poolNode={apy:direct,poolAddress:POOL}};const baseApy=findBaseApy(poolNode);if(!baseApy||baseApy.valuePct===null)throw new Error(`Curve Base APY unavailable for ${POOL}`);let rewardNode=rewards?findAddressNode(rewards,gauge):null;const crvApr=rewardNode?findCrvApr(rewardNode):null;return{pool:POOL,gauge,baseApyPct:baseApy.valuePct,baseApyPath:baseApy.path,unboostedCrvAprPct:crvApr?.valuePct??null,unboostedCrvAprPath:crvApr?.path??null,referenceAprPct:baseApy.valuePct,referenceAprScope:'Curve trading/base APY only; Stake DAO boosted CRV reward APR is intentionally separate until exact annualisation is proven',source:'Curve official /v1/getBaseApys/base',crvAprSource:crvApr?'Curve official /v1/getFactoGaugesCrvRewards/base · unboosted diagnostic only':null};}

const recon=JSON.parse(fs.readFileSync(FILE,'utf8'));
if(recon?.version!=='0.2-company-010-capital-reconciliation-stakedao-base'||!recon?.stakeDaoBase?.result)throw new Error('Stake DAO reconciliation v0.2 required');
if(recon?.authority?.executionAuthority!=='none')throw new Error('authority drift');
const accounting=await accountantState(),yieldData=await curveYield(accounting.result.gauge);
const r=recon.stakeDaoBase.result;
r.crvClaimable=accounting.result.claimableCrv;
r.rewardAccounting=accounting.result;
r.referenceAprPct=yieldData.referenceAprPct;
r.referenceAprStatus='measured-base-yield';
r.referenceAprSource=yieldData.source;
r.referenceAprScope=yieldData.referenceAprScope;
r.baseApyPct=yieldData.baseApyPct;
r.baseApyStatus='measured';
r.curveYield=yieldData;
r.source='Stake DAO RewardVault + Stake DAO verified Accountant + Curve official Base APY + Curve pool onchain balances';
recon.generatedAt=new Date().toISOString();
recon.stakeDaoIntelligence={version:'0.2-stakedao-accountant-curve-base-yield',claimableMethod:'verified-accountant-integral',yieldMethod:'curve-official-base-apy',boostedRewardAprStatus:'warming'};
fs.writeFileSync(FILE,JSON.stringify(recon,null,2)+'\n');
console.log(JSON.stringify({status:'PASS',stakeDaoValueUsd:r.totalPositionUsd,crvClaimable:r.crvClaimable,referenceAprPct:r.referenceAprPct,referenceAprScope:r.referenceAprScope,unboostedCrvAprPct:yieldData.unboostedCrvAprPct,accountant:accounting.result.accountant,gauge:accounting.result.gauge,executionAuthority:'none'},null,2));