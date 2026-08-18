#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { Contract, JsonRpcProvider, formatUnits, getAddress } from 'ethers';

const REWARDS=process.env.REWARDS_OUTPUT||path.resolve('companies/rewards-data.json');
const HISTORY=process.env.BEEFY_CVXCRV_HISTORY_OUTPUT||path.resolve('companies/company-009-beefy-cvxcrv-income.json');
const OBSERVATION_ID=String(process.env.BEEFY_CVXCRV_OBSERVATION_ID||'').trim()||null;
const RPCS=[...new Set([process.env.ETH_RPC_URL,process.env.ETH_RPC_URL_2,'https://ethereum-rpc.publicnode.com','https://eth.llamarpc.com'].filter(Boolean))];
const COMPANY=getAddress('0xe4b9C9CeD406baFfe406e63F83d39daaef150596');
const VAULT=getAddress('0x4115150523599D1F6C6Fa27F5A4C27D578Fd8ce5');
const CVXCRV=getAddress('0x62B9c7356A2Dc64a1969e19C23e4f579F9810Aa7');
const ABI=['function balanceOf(address) view returns (uint256)','function decimals() view returns (uint8)','function getPricePerFullShare() view returns (uint256)','function want() view returns (address)'];
const ERC20=['function decimals() view returns (uint8)'];
const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
const round=(v,d=12)=>finite(v)?Number(Number(v).toFixed(d)):null;

async function provider(){let last;for(const url of RPCS){try{const p=new JsonRpcProvider(url,1,{staticNetwork:true});await p.getBlockNumber();return p}catch(e){last=e}}throw last||new Error('Ethereum RPC unavailable')}
async function cvxCrvPrice(){const k=`ethereum:${CVXCRV.toLowerCase()}`;const r=await fetch(`https://coins.llama.fi/prices/current/${k}`,{headers:{accept:'application/json'}});if(!r.ok)throw new Error(`cvxCRV price HTTP ${r.status}`);const j=await r.json(),v=Number(j?.coins?.[k]?.price);if(!(v>0))throw new Error('cvxCRV price unavailable');return v}
function readHistory(){if(!fs.existsSync(HISTORY))return null;try{return JSON.parse(fs.readFileSync(HISTORY,'utf8'))}catch{return null}}
function applyRewards(history){
 if(!fs.existsSync(REWARDS))return;
 const d=JSON.parse(fs.readFileSync(REWARDS,'utf8')),c=d.companies?.['1milliondollar.eth'];if(!c)throw new Error('Company #009 Rewards state missing');
 const interval=history.latestInterval;c.embeddedIncome=(c.embeddedIncome||[]).filter(x=>x.route!=='beefy-cvxcrv');
 if(interval?.status==='ok'&&finite(interval.incomeCvxCrv)&&Number(interval.incomeCvxCrv)>0){c.embeddedIncome.push({protocol:'Beefy · cvxCRV',route:'beefy-cvxcrv',chain:'Ethereum',state:'Compounded',claimableApplicable:false,symbol:'cvxCRV',amount:interval.incomeCvxCrv,usdValue:interval.incomeUsd,priceUsd:interval.priceUsd,classification:'compounded-embedded',periodStart:interval.startAt,periodEnd:interval.endAt,metric:'Beefy vault share × PPFS growth',source:'live Beefy vault adjacent checkpoint history',note:'Yield remains inside the vault and increases cvxCRV backing; it is not separately claimable.'})}
 const claimable=(c.rewards||[]).reduce((s,x)=>s+(finite(x.usdValue)?Number(x.usdValue):0),0),embedded=(c.embeddedIncome||[]).reduce((s,x)=>s+(finite(x.usdValue)?Number(x.usdValue):0),0);
 c.measuredEmbeddedUsd=round(embedded,6);c.measuredEarnedUsd=round(claimable+embedded,6);c.measuredEarnedUsdIsComplete=false;c.embeddedIncomeStatus=interval?.status||'warming-baseline';c.updatedAt=history.generatedAt;
 d.diagnostics=d.diagnostics||{};d.diagnostics.company009BeefyCvxCrv={version:history.version,generatedAt:history.generatedAt,status:c.embeddedIncomeStatus,checkpointCount:history.checkpoints?.length||0,executionAuthority:'none'};
 fs.writeFileSync(REWARDS,JSON.stringify(d,null,2)+'\n');
}

async function main(){
 const prior=readHistory();
 if(OBSERVATION_ID&&prior?.checkpoints?.some(x=>x.observationId===OBSERVATION_ID)){
   applyRewards(prior);
   console.log('COMPANY #009 BEEFY cvxCRV INCOME IDEMPOTENT PASS',{observationId:OBSERVATION_ID,status:prior.latestInterval?.status,checkpointCount:prior.checkpoints.length,executionAuthority:'none'});return;
 }
 const p=await provider(),vault=new Contract(VAULT,ABI,p),want=new Contract(CVXCRV,ERC20,p);
 const [sharesRaw,shareDecimals,ppfsRaw,wantAddr,wantDecimals,blockNumber,priceUsd]=await Promise.all([vault.balanceOf(COMPANY),vault.decimals(),vault.getPricePerFullShare(),vault.want(),want.decimals(),p.getBlockNumber(),cvxCrvPrice()]);
 if(getAddress(wantAddr)!==CVXCRV)throw new Error(`Beefy want drift ${wantAddr}`);
 if(Number(wantDecimals)!==18)throw new Error(`Unexpected cvxCRV decimals ${wantDecimals}`);
 const shares=Number(formatUnits(sharesRaw,Number(shareDecimals))),ppfs=Number(formatUnits(ppfsRaw,18)),underlying=shares*ppfs,now=new Date().toISOString();
 if(!(shares>=0&&ppfs>0&&underlying>=0))throw new Error('Invalid Beefy checkpoint');
 const prev=[...(prior?.checkpoints||[])].reverse().find(x=>x&&x.sharesRaw&&x.ppfsRaw)||null;
 let interval={status:'warming-baseline',startAt:null,endAt:now,incomeCvxCrv:null,incomeUsd:null,reason:'First canonical live checkpoint; no historical income is invented.'};
 if(prev){
   const sameShares=String(prev.sharesRaw)===sharesRaw.toString();
   if(sameShares){
     const delta=underlying-Number(prev.underlyingCvxCrv);
     interval={status:'ok',startAt:prev.generatedAt,endAt:now,startBlock:prev.blockNumber,endBlock:blockNumber,shareBalanceStable:true,incomeCvxCrv:round(delta,12),incomeUsd:round(delta*priceUsd,6),priceUsd:round(priceUsd,8),method:'adjacent Beefy vault checkpoints with identical share balance: shares × ΔPPFS',negativeEmbeddedMovement:delta<0};
   }else{
     interval={status:'needs-flow-reconciliation',startAt:prev.generatedAt,endAt:now,startBlock:prev.blockNumber,endBlock:blockNumber,shareBalanceStable:false,incomeCvxCrv:null,incomeUsd:null,reason:'Vault share balance changed between checkpoints; deposits/withdrawals cannot be mislabeled as yield.'};
   }
 }
 const checkpoint={observationId:OBSERVATION_ID,generatedAt:now,blockNumber,sharesRaw:sharesRaw.toString(),shares:round(shares,12),ppfsRaw:ppfsRaw.toString(),ppfs:round(ppfs,18),underlyingCvxCrv:round(underlying,12),cvxCrvPriceUsd:round(priceUsd,8),valueUsd:round(underlying*priceUsd,6)};
 const checkpoints=[...(prior?.checkpoints||[]),checkpoint].slice(-730);
 const history={version:'0.1-company-009-beefy-cvxcrv-embedded-income',generatedAt:now,company:{registry:'009',name:'1milliondollar.eth',address:COMPANY},strategy:{id:'beefy-cvxcrv',vaultId:'convex-staked-cvxCRV',vault:VAULT,want:CVXCRV,incomeMode:'compounded-embedded',claimableApplicable:false},latestCheckpoint:checkpoint,latestInterval:interval,checkpoints,methodology:{rule:'Beefy harvested Convex rewards are embedded in vault PPFS. A measured interval is admitted only when adjacent checkpoints have the exact same vault share balance; otherwise flow reconciliation is required.',noBackfill:'No historical income is inferred from current APY or from a single checkpoint.',claimableBoundary:'Embedded Beefy income is never added to Accrued Rewards / Claimable.',idempotency:'A workflow observationId may create at most one canonical checkpoint; safe-writer replays reuse the same checkpoint.'},authority:{executionAuthority:'none',transactions:false,claimingAuthority:false}};
 fs.mkdirSync(path.dirname(HISTORY),{recursive:true});fs.writeFileSync(HISTORY,JSON.stringify(history,null,2)+'\n');applyRewards(history);
 console.log('COMPANY #009 BEEFY cvxCRV INCOME PASS',JSON.stringify({observationId:OBSERVATION_ID,status:interval.status,shares:checkpoint.shares,ppfs:checkpoint.ppfs,underlying:checkpoint.underlyingCvxCrv,incomeCvxCrv:interval.incomeCvxCrv,incomeUsd:interval.incomeUsd,checkpointCount:checkpoints.length,executionAuthority:'none'},null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1});
