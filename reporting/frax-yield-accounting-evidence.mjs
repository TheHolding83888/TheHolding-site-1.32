#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { Contract, JsonRpcProvider, getAddress, formatUnits } from 'ethers';

const __filename=fileURLToPath(import.meta.url);
const __dirname=path.dirname(__filename);
const ROOT=path.resolve(__dirname,'..');

export const VERSION='0.1-frax-yield-factual-accrual-evidence';
export const MECHANISM='frax-yield';
export const DISTRIBUTOR='0x21359d1697e610e25C8229B2C57907378eD09A2E';
export const FULL_ACCOUNTING_START='2026-09-01T00:00:00.000Z';
export const PARTIAL_BOOTSTRAP_START='2026-08-27T00:00:00.000Z';
const DEFAULT_REWARDS=process.env.REWARDS_DATA_FILE||path.join(ROOT,'companies','rewards-data.json');
const DEFAULT_LEDGER=process.env.INCOME_LEDGER_FILE||path.join(ROOT,'reporting','income-ledger.json');
const DEFAULT_OUTPUT=process.env.FRAX_YIELD_EVIDENCE_FILE||path.join(ROOT,'reporting','frax-yield-accounting-evidence.json');
const RPC_URL=process.env.FRAXTAL_RPC_URL||'https://rpc.frax.com';
const ABI=[
  'function earned(address _account) view returns (uint256)',
  'function emittedTokenAddress() view returns (address)',
  'event YieldCollected(address indexed staker,address indexed recipient,uint256 yield,address tokenAddress)'
];
const ERC20_ABI=['function decimals() view returns (uint8)','function symbol() view returns (string)'];
const MAX_LOG_BLOCKS=80_000;
const MAX_CHECKPOINTS_PER_STATE=460;

const lower=v=>String(v||'').toLowerCase();
const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
const iso=v=>{const t=Date.parse(v||'');return Number.isFinite(t)?new Date(t).toISOString():null;};
const round=(v,d=12)=>finite(v)?Number(Number(v).toFixed(d)):null;
const isAddress=v=>/^0x[0-9a-f]{40}$/i.test(String(v||''));
const stateKey=(company,wallet)=>`${company}|${lower(wallet)}|${MECHANISM}`;
const monthKey=v=>{const x=iso(v);return x?x.slice(0,7):null;};
const previousDay=v=>new Date(Date.parse(v)-1).toISOString().slice(0,10);

async function readJson(file,fallback={}){try{return JSON.parse(await fs.readFile(file,'utf8'));}catch{return fallback;}}
async function writeJson(file,data){await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,JSON.stringify(data,null,2)+'\n');}

export function decimalToRaw18(value){
  if(!finite(value))return null;
  const s=Number(value).toFixed(18),[a,b='']=s.split('.');
  try{return(BigInt(a)*10n**18n+BigInt((b+'0'.repeat(18)).slice(0,18))).toString();}catch{return null;}
}
export function rawToAmount(raw){try{return Number(BigInt(raw))/1e18;}catch{return null;}}

export function reconcileAccrual(openingRaw,closingRaw,settlementRaw='0'){
  try{
    const opening=BigInt(openingRaw),closing=BigInt(closingRaw),settled=BigInt(settlementRaw);
    const earned=closing+settled-opening;
    if(earned<0n)return{status:'negative-reconciliation-required',accepted:false,earnedRaw:earned.toString()};
    if(earned===0n)return{status:'zero-new-earned',accepted:true,earnedRaw:'0'};
    return{status:'positive-factual-accrual',accepted:true,earnedRaw:earned.toString()};
  }catch{return{status:'invalid-boundary',accepted:false,earnedRaw:null};}
}

function currentRoutePrice(rewards){
  const rows=[];
  for(const c of Object.values(rewards?.companies||{}))for(const r of c?.rewards||[]){
    if(r?.route!==MECHANISM||!(finite(r.priceUsd)&&Number(r.priceUsd)>0))continue;
    rows.push({priceUsd:Number(r.priceUsd),priceMethod:r.priceMethod||null,token:r.token||null,generatedAt:rewards.generatedAt||null});
  }
  if(!rows.length)return null;
  rows.sort((a,b)=>a.priceUsd-b.priceUsd);
  const pick=rows[Math.floor(rows.length/2)];
  return{...pick,sampleCount:rows.length,min:rows[0].priceUsd,max:rows.at(-1).priceUsd};
}

export function trackedWalletsFromRewards(rewards){
  const out=[];
  for(const [company,c] of Object.entries(rewards?.companies||{})){
    const source=(c?.sources||[]).find(x=>x?.route===MECHANISM);
    for(const wr of source?.details?.walletResults||[]){
      const wallet=String(wr?.wallet||'');
      if(!isAddress(wallet)||wr?.status==='error')continue;
      out.push({stateKey:stateKey(company,wallet),company,wallet:getAddress(wallet),walletAlias:wr?.walletAlias||null,route:MECHANISM,sourceStatus:wr?.status||source?.status||'unknown'});
    }
  }
  const seen=new Set();
  return out.filter(x=>{if(seen.has(x.stateKey))return false;seen.add(x.stateKey);return true;}).sort((a,b)=>a.stateKey.localeCompare(b.stateKey));
}

export function bootstrapCheckpointsFromLedger(ledger){
  const out=[];
  for(const snap of ledger?.claimableSnapshots||[]){
    const capturedAt=iso(snap?.capturedAt);
    if(!capturedAt||capturedAt<PARTIAL_BOOTSTRAP_START)continue;
    for(const r of snap?.rows||[]){
      if(r?.route!==MECHANISM||!isAddress(r?.wallet)||!finite(r?.amount))continue;
      const amount=Number(r.amount),raw=decimalToRaw18(amount),usd=finite(r?.usdValue)?Number(r.usdValue):null;
      if(raw===null)continue;
      out.push({
        checkpointKey:`bootstrap:${snap.snapshotKey}:${r.routeKey}`,
        stateKey:stateKey(snap.company,r.wallet),company:snap.company,wallet:getAddress(r.wallet),walletAlias:null,
        route:MECHANISM,observedAt:capturedAt,blockNumber:null,earnedRaw:raw,earnedAmount:round(amount,12),
        unitUsd:amount>0&&finite(usd)?round(usd/amount,12):null,valuationSource:'canonical-claimable-snapshot',
        boundaryProof:'timestamp-anchored-historical-canonical-snapshot',exactBlockTaggedState:false,bootstrap:true,
        sourceSnapshotKey:snap.snapshotKey,periodIncomeAuthority:false,unknownIsNotZero:true
      });
    }
  }
  return out;
}

async function blockAtOrBefore(provider,timestamp,latestNumber,cache){
  const key=String(timestamp);
  if(cache.has(key))return cache.get(key);
  const target=Math.floor(Date.parse(timestamp)/1000);
  if(!Number.isFinite(target))throw new Error(`Invalid checkpoint timestamp ${timestamp}`);
  let lo=0,hi=latestNumber;
  while(lo<hi){
    const mid=Math.ceil((lo+hi)/2),b=await provider.getBlock(mid);
    if(!b)throw new Error(`Fraxtal block ${mid} unavailable`);
    if(Number(b.timestamp)<=target)lo=mid;else hi=mid-1;
  }
  const b=await provider.getBlock(lo);
  if(!b)throw new Error(`Fraxtal boundary block ${lo} unavailable`);
  const result={blockNumber:Number(b.number),blockTimestamp:new Date(Number(b.timestamp)*1000).toISOString()};
  cache.set(key,result);return result;
}

async function queryClaims(contract,wallet,fromBlock,toBlock){
  if(!(toBlock>=fromBlock))return{complete:true,claims:[],requestCount:0};
  const filter=contract.filters.YieldCollected(wallet),claims=[];let requestCount=0;
  for(let from=fromBlock;from<=toBlock;from+=MAX_LOG_BLOCKS){
    const to=Math.min(toBlock,from+MAX_LOG_BLOCKS-1);
    const logs=await contract.queryFilter(filter,from,to);requestCount++;
    for(const log of logs){
      const amount=log?.args?.[2];
      if(amount===undefined)throw new Error(`Frax YieldCollected decode missing amount at block ${log.blockNumber}`);
      claims.push({blockNumber:Number(log.blockNumber),transactionHash:String(log.transactionHash||''),logIndex:Number(log.index??0),staker:String(log.args?.[0]||wallet),recipient:String(log.args?.[1]||''),amountRaw:BigInt(amount).toString(),token:String(log.args?.[3]||'')});
    }
  }
  return{complete:true,claims:claims.sort((a,b)=>a.blockNumber-b.blockNumber||a.logIndex-b.logIndex),requestCount};
}

function retainCheckpoints(checkpoints){
  const groups=new Map();
  for(const c of checkpoints){if(!groups.has(c.stateKey))groups.set(c.stateKey,[]);groups.get(c.stateKey).push(c);}
  return[...groups.values()].flatMap(xs=>xs.sort((a,b)=>Number(a.blockNumber||0)-Number(b.blockNumber||0)||String(a.observedAt).localeCompare(String(b.observedAt))).slice(-MAX_CHECKPOINTS_PER_STATE)).sort((a,b)=>a.stateKey.localeCompare(b.stateKey)||Number(a.blockNumber||0)-Number(b.blockNumber||0));
}

function monthBoundaries(startIso,endIso){
  const out=[],start=new Date(startIso),end=new Date(endIso);
  let y=start.getUTCFullYear(),m=start.getUTCMonth();
  while(true){
    const d=new Date(Date.UTC(y,m,1));
    if(d>end)break;
    if(d>=start)out.push(d.toISOString());
    m++;if(m>11){m=0;y++;}
  }
  return out;
}

async function buildMonthBoundaryCheckpoint({provider,contract,walletRow,boundaryAt,latestNumber,blockCache}){
  const b=await blockAtOrBefore(provider,boundaryAt,latestNumber,blockCache);
  try{
    const raw=await contract.earned(walletRow.wallet,{blockTag:b.blockNumber});
    return{checkpointKey:`month-boundary:${walletRow.stateKey}:${boundaryAt}`,stateKey:walletRow.stateKey,company:walletRow.company,wallet:walletRow.wallet,walletAlias:walletRow.walletAlias,route:MECHANISM,observedAt:boundaryAt,blockNumber:b.blockNumber,blockTimestamp:b.blockTimestamp,earnedRaw:BigInt(raw).toString(),earnedAmount:round(rawToAmount(raw),12),unitUsd:null,valuationSource:null,boundaryProof:'archive-block-tagged-YieldDistributor.earned',exactBlockTaggedState:true,bootstrap:false,monthBoundary:true,periodIncomeAuthority:false,unknownIsNotZero:true};
  }catch(error){return{stateKey:walletRow.stateKey,boundaryAt,status:'archive-read-unavailable',error:error?.shortMessage||error?.message||String(error)};}
}

function eventEconomicDate(close){return close?.monthBoundary?previousDay(close.observedAt):String(close.observedAt).slice(0,10);}
function intervalMonth(open,close){
  const economicDate=eventEconomicDate(close),month=economicDate.slice(0,7);
  const startMonth=monthKey(open.observedAt),endMonth=close?.monthBoundary?month:monthKey(close.observedAt);
  return startMonth&&endMonth&&startMonth!==endMonth&&!close?.monthBoundary?null:month;
}

export async function buildFraxEvidence({rewards,ledger,previous={},generatedAt=new Date().toISOString(),provider=null}={}){
  const authority={executionAuthority:'none',walletAuthority:'none',claimingAuthority:'none',capitalExecution:false,methodologyMutationAuthority:'none'};
  const wallets=trackedWalletsFromRewards(rewards),price=currentRoutePrice(rewards);
  if(!wallets.length)return{version:VERSION,mechanism:MECHANISM,generatedAt,status:'no-tracked-wallets',fullAccountingStart:FULL_ACCOUNTING_START,authority,checkpoints:previous?.checkpoints||[],events:previous?.events||[],diagnostics:{trackedWalletCount:0,unknownIsNotZero:true}};
  const rpc=provider||new JsonRpcProvider(RPC_URL,252);
  const contract=new Contract(DISTRIBUTOR,ABI,rpc),latestNumber=await rpc.getBlockNumber(),latestBlock=await rpc.getBlock(latestNumber);
  if(!latestBlock)throw new Error('Fraxtal latest block unavailable');
  const observedAt=new Date(Number(latestBlock.timestamp)*1000).toISOString(),emitted=getAddress(await contract.emittedTokenAddress({blockTag:latestNumber}));
  const erc20=new Contract(emitted,ERC20_ABI,rpc),[decimals,symbol]=await Promise.all([erc20.decimals({blockTag:latestNumber}),erc20.symbol({blockTag:latestNumber})]);
  if(Number(decimals)!==18)throw new Error(`Frax emitted token decimals changed: ${decimals}`);

  const byCheckpoint=new Map((previous?.checkpoints||[]).filter(x=>x?.checkpointKey).map(x=>[x.checkpointKey,x]));
  if(!byCheckpoint.size)for(const c of bootstrapCheckpointsFromLedger(ledger))byCheckpoint.set(c.checkpointKey,c);
  const blockCache=new Map(),boundaryFailures=[];

  for(const c of [...byCheckpoint.values()])if(!(Number(c.blockNumber)>0)){
    try{const b=await blockAtOrBefore(rpc,c.observedAt,latestNumber,blockCache);c.blockNumber=b.blockNumber;c.blockTimestamp=b.blockTimestamp;}catch(error){c.blockResolutionError=error?.message||String(error);}
  }

  for(const w of wallets){
    for(const boundaryAt of monthBoundaries(FULL_ACCOUNTING_START,observedAt)){
      const key=`month-boundary:${w.stateKey}:${boundaryAt}`;
      if(byCheckpoint.has(key))continue;
      const c=await buildMonthBoundaryCheckpoint({provider:rpc,contract,walletRow:w,boundaryAt,latestNumber,blockCache});
      if(c.checkpointKey)byCheckpoint.set(c.checkpointKey,c);else boundaryFailures.push(c);
    }
    const raw=await contract.earned(w.wallet,{blockTag:latestNumber});
    const current={checkpointKey:`live:${w.stateKey}:${latestNumber}`,stateKey:w.stateKey,company:w.company,wallet:w.wallet,walletAlias:w.walletAlias,route:MECHANISM,observedAt,blockNumber:latestNumber,blockTimestamp:observedAt,earnedRaw:BigInt(raw).toString(),earnedAmount:round(rawToAmount(raw),12),unitUsd:price?.priceUsd?round(price.priceUsd,12):null,valuationSource:price?.priceMethod||null,valuationObservedAt:price?.generatedAt||rewards?.generatedAt||generatedAt,boundaryProof:'block-tagged-YieldDistributor.earned',exactBlockTaggedState:true,bootstrap:false,sourceRewardsGeneratedAt:rewards?.generatedAt||null,periodIncomeAuthority:false,unknownIsNotZero:true};
    byCheckpoint.set(current.checkpointKey,current);
  }

  const checkpoints=retainCheckpoints([...byCheckpoint.values()].filter(x=>x?.checkpointKey&&Number(x.blockNumber)>=0));
  const priorEvents=new Map((previous?.events||[]).filter(x=>x?.eventKey).map(x=>[x.eventKey,x])),diagnostics={trackedWalletCount:wallets.length,currentBlockNumber:latestNumber,currentObservedAt:observedAt,emittedToken:emitted,emittedSymbol:symbol,routePriceUsd:price?.priceUsd??null,routePriceMethod:price?.priceMethod||null,bootstrapCheckpointCount:checkpoints.filter(x=>x.bootstrap).length,monthBoundaryCount:checkpoints.filter(x=>x.monthBoundary).length,monthBoundaryFailures:boundaryFailures,intervalCount:0,acceptedPositiveIntervalCount:0,zeroIntervalCount:0,reconciliationCount:0,unvaluedIntervalCount:0,claimEventCount:0,claimLogRequestCount:0,referenceAprUsed:false,unknownIsNotZero:true};

  for(const w of wallets){
    const rows=checkpoints.filter(x=>x.stateKey===w.stateKey).sort((a,b)=>Number(a.blockNumber)-Number(b.blockNumber)||String(a.observedAt).localeCompare(String(b.observedAt)));
    for(let i=1;i<rows.length;i++){
      const open=rows[i-1],close=rows[i];if(Number(close.blockNumber)<=Number(open.blockNumber))continue;
      const eventKey=`frax-yield-accrual:${lower(w.wallet)}:${open.blockNumber}:${close.blockNumber}`;
      if(priorEvents.has(eventKey))continue;
      diagnostics.intervalCount++;
      let claims;
      try{claims=await queryClaims(contract,w.wallet,Number(open.blockNumber)+1,Number(close.blockNumber));}
      catch(error){diagnostics.reconciliationCount++;continue;}
      diagnostics.claimEventCount+=claims.claims.length;diagnostics.claimLogRequestCount+=claims.requestCount;
      if(claims.claims.length&&(!open.exactBlockTaggedState||!close.exactBlockTaggedState)){diagnostics.reconciliationCount++;continue;}
      const settledRaw=claims.claims.reduce((s,x)=>s+BigInt(x.amountRaw),0n).toString(),r=reconcileAccrual(open.earnedRaw,close.earnedRaw,settledRaw);
      if(!r.accepted){diagnostics.reconciliationCount++;continue;}
      if(r.earnedRaw==='0'){diagnostics.zeroIntervalCount++;continue;}
      const month=intervalMonth(open,close);if(!month){diagnostics.reconciliationCount++;continue;}
      const amount=rawToAmount(r.earnedRaw),unitUsd=finite(close.unitUsd)&&Number(close.unitUsd)>0?Number(close.unitUsd):(price?.priceUsd||null),usdValue=finite(unitUsd)?Number(amount)*Number(unitUsd):null;
      if(!finite(usdValue))diagnostics.unvaluedIntervalCount++;
      const event={eventKey,company:w.company,family:'accrued-entitlement',economicDate:eventEconomicDate(close),periodStart:open.observedAt,periodEnd:close.observedAt,route:MECHANISM,protocol:'Frax · veFRAX',asset:symbol,token:emitted,amount:round(amount,12),amountRaw:r.earnedRaw,usdValue:finite(usdValue)?round(usdValue,8):null,valuationUnitUsd:finite(unitUsd)?round(unitUsd,12):null,valuationAt:close.valuationObservedAt||close.observedAt,valuationStatus:finite(usdValue)?'frozen-at-closing-accounting-boundary':'unvalued-fail-closed',sourceFile:'reporting/frax-yield-accounting-evidence.json',sourceFamily:'YieldDistributor cumulative entitlement with YieldCollected settlement reconciliation',sourceIdentity:`${open.checkpointKey}->${close.checkpointKey}`,evidenceStatus:'factual-opening-plus-settlement-to-closing-reconciliation',openingEarnedRaw:open.earnedRaw,closingEarnedRaw:close.earnedRaw,settlementRaw:settledRaw,settlementEventCount:claims.claims.length,settlementProofs:claims.claims,openingBoundaryProof:open.boundaryProof,closingBoundaryProof:close.boundaryProof,periodAttributionMonth:month,referenceAprUsed:false,currentClaimableBalanceIsPeriodIncome:false,claimIsSecondIncomeEvent:false,laterClaimOrPriceMoveDoesNotRewriteIncome:true,unknownIsNotZero:true,executionAuthority:'none'};
      priorEvents.set(eventKey,event);diagnostics.acceptedPositiveIntervalCount++;
    }
  }

  const events=[...priorEvents.values()].sort((a,b)=>String(a.periodEnd||'').localeCompare(String(b.periodEnd||''))||a.eventKey.localeCompare(b.eventKey));
  return{version:VERSION,mechanism:MECHANISM,generatedAt,status:diagnostics.reconciliationCount||diagnostics.unvaluedIntervalCount||boundaryFailures.length?'partial':'factual-boundary-tracking',fullAccountingStart:FULL_ACCOUNTING_START,partialBootstrapStart:PARTIAL_BOOTSTRAP_START,semantics:{openingBalanceCreatesIncome:false,earnedIndependentOfClaim:true,claimIsSettlementNotSecondIncome:true,formula:'closing earned + YieldCollected settlements - opening earned',positiveDeltaRequired:true,referenceAprUsed:false,laterPriceMovementRewritesClosedIncome:false,unknownIsNotZero:true},source:{chain:'Fraxtal',chainId:252,yieldDistributor:DISTRIBUTOR,earnedMetric:'YieldDistributor.earned(account)',settlementEvent:'YieldCollected(staker,recipient,yield,tokenAddress)',rewardsSource:'companies/rewards-data.json',historicalBootstrap:'reporting/income-ledger.json claimableSnapshots'},authority,checkpoints,events,diagnostics};
}

async function main(){
  const [rewards,ledger,previous]=await Promise.all([readJson(DEFAULT_REWARDS),readJson(DEFAULT_LEDGER),readJson(DEFAULT_OUTPUT,{})]);
  const output=await buildFraxEvidence({rewards,ledger,previous});await writeJson(DEFAULT_OUTPUT,output);
  console.log('Frax factual accrual evidence built',{status:output.status,checkpoints:output.checkpoints.length,events:output.events.length,acceptedPositiveIntervals:output.diagnostics.acceptedPositiveIntervalCount,reconciliations:output.diagnostics.reconciliationCount,unvalued:output.diagnostics.unvaluedIntervalCount,executionAuthority:output.authority.executionAuthority});
}

if(process.argv[1]&&path.resolve(process.argv[1])===__filename)main().catch(error=>{console.error(error);process.exitCode=1;});
