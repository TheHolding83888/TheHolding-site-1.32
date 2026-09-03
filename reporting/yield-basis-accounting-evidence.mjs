#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { Contract, JsonRpcProvider, getAddress, formatUnits } from 'ethers';

const __filename=fileURLToPath(import.meta.url);
const __dirname=path.dirname(__filename);
const ROOT=path.resolve(__dirname,'..');

export const VERSION='0.1-yield-basis-factual-accrual-evidence';
export const MECHANISM='yield-basis-fees';
export const DISTRIBUTOR='0xD11b416573EbC59b6B2387DA0D2c0D1b3b1F7A90';
export const FULL_ACCOUNTING_START='2026-09-01T00:00:00.000Z';
const DEFAULT_REWARDS=process.env.REWARDS_DATA_FILE||path.join(ROOT,'companies','rewards-data.json');
const DEFAULT_OUTPUT=process.env.YIELD_BASIS_EVIDENCE_FILE||path.join(ROOT,'reporting','yield-basis-accounting-evidence.json');
const RPC_URL=process.env.ETH_RPC_URL||'https://ethereum-rpc.publicnode.com';
const ARCHIVE_RPC_URL=process.env.ETH_ARCHIVE_RPC_URL||'https://eth.drpc.org';
const ARCHIVE_RPC_FALLBACK_URL=process.env.ETH_ARCHIVE_RPC_FALLBACK_URL||'https://ethereum.public.blockpi.network/v1/rpc/public';
const ABI=[
  'function preview_claim(address receiver,uint256 epoch_count,bool use_vest) returns (address[] tokens,uint256[] amounts)',
  'event Claim(address indexed user,address indexed token,uint256 amount)'
];
const ERC20_ABI=['function decimals() view returns (uint8)','function symbol() view returns (string)'];
const MAX_LOG_BLOCKS=9_500;
const MAX_CHECKPOINTS_PER_WALLET=460;
const BLOCK_LOOKUP_TIMEOUT_MS=8_000;
const BLOCK_LOOKUP_RETRIES=3;
const RECENT_BOUNDARY_INITIAL_STEP=4_096;

const lower=v=>String(v||'').toLowerCase();
const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
const round=(v,d=12)=>finite(v)?Number(Number(v).toFixed(d)):null;
const isAddress=v=>/^0x[0-9a-f]{40}$/i.test(String(v||''));
const walletStateKey=(company,wallet)=>`${company}|${lower(wallet)}|${MECHANISM}`;
const previousDay=v=>new Date(Date.parse(v)-1).toISOString().slice(0,10);
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const unique=values=>[...new Set((values||[]).filter(Boolean))];
const rpcLabel=url=>{try{return new URL(String(url)).hostname;}catch{return'custom-rpc';}};
const errorText=error=>error?.shortMessage||error?.info?.error?.message||error?.error?.message||error?.message||String(error);

async function readJson(file,fallback={}){try{return JSON.parse(await fs.readFile(file,'utf8'));}catch{return fallback;}}
async function writeJson(file,data){await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,JSON.stringify(data,null,2)+'\n');}
function bump(map,key){map[key]=Number(map[key]||0)+1;}

export function reconcileEntitlement(openingRaw,closingRaw,settlementRaw='0'){
  try{
    const opening=BigInt(openingRaw||'0'),closing=BigInt(closingRaw||'0'),settled=BigInt(settlementRaw||'0');
    const earned=closing+settled-opening;
    if(earned<0n)return{status:'negative-reconciliation-required',accepted:false,earnedRaw:earned.toString()};
    if(earned===0n)return{status:'zero-new-earned',accepted:true,earnedRaw:'0'};
    return{status:'positive-factual-accrual',accepted:true,earnedRaw:earned.toString()};
  }catch{return{status:'invalid-boundary',accepted:false,earnedRaw:null};}
}

export function trackedWalletsFromRewards(rewards){
  const out=[];
  for(const [company,c] of Object.entries(rewards?.companies||{})){
    const source=(c?.sources||[]).find(x=>x?.route===MECHANISM);
    for(const wr of source?.details?.walletResults||[]){
      const wallet=String(wr?.wallet||'');
      if(!isAddress(wallet)||wr?.status==='error')continue;
      out.push({stateKey:walletStateKey(company,wallet),company,wallet:getAddress(wallet),walletAlias:wr?.walletAlias||null,sourceStatus:wr?.status||source?.status||'unknown'});
    }
    for(const r of c?.rewards||[]){
      if(r?.route!==MECHANISM)continue;
      const wallet=String(r?.wallet||r?.details?.wallet||'');
      if(!isAddress(wallet))continue;
      out.push({stateKey:walletStateKey(company,wallet),company,wallet:getAddress(wallet),walletAlias:r?.walletAlias||r?.details?.walletAlias||null,sourceStatus:source?.status||'reward-row'});
    }
  }
  const seen=new Set();
  return out.filter(x=>{if(seen.has(x.stateKey))return false;seen.add(x.stateKey);return true;}).sort((a,b)=>a.stateKey.localeCompare(b.stateKey));
}

export function priceIndexFromRewards(rewards){
  const exact=new Map(),byToken=new Map();
  for(const [company,c] of Object.entries(rewards?.companies||{}))for(const r of c?.rewards||[]){
    if(r?.route!==MECHANISM||!isAddress(r?.token)||!(finite(r?.priceUsd)&&Number(r.priceUsd)>0))continue;
    const token=lower(r.token),wallet=lower(r?.wallet||r?.details?.wallet||'');
    const row={unitUsd:Number(r.priceUsd),priceMethod:r.priceMethod||null,valuationObservedAt:rewards?.generatedAt||null};
    if(wallet)exact.set(`${company}|${wallet}|${token}`,row);
    const list=byToken.get(token)||[];list.push(row);byToken.set(token,list);
  }
  return{get(company,wallet,token){
    const hit=exact.get(`${company}|${lower(wallet)}|${lower(token)}`);if(hit)return hit;
    const rows=byToken.get(lower(token))||[];if(!rows.length)return null;
    rows.sort((a,b)=>a.unitUsd-b.unitUsd);return rows[Math.floor(rows.length/2)];
  }};
}

async function getBlockReliable(provider,blockNumber,{attempts=BLOCK_LOOKUP_RETRIES,timeoutMs=BLOCK_LOOKUP_TIMEOUT_MS}={}){
  let last=null;
  for(let attempt=1;attempt<=attempts;attempt++){
    try{
      const block=await Promise.race([
        provider.getBlock(blockNumber),
        new Promise((_,reject)=>setTimeout(()=>reject(new Error(`Ethereum block ${blockNumber} lookup timeout`)),timeoutMs))
      ]);
      if(block)return block;
      last=new Error(`Ethereum block ${blockNumber} unavailable`);
    }catch(error){last=error;}
    if(attempt<attempts)await wait(250*attempt);
  }
  throw last||new Error(`Ethereum block ${blockNumber} unavailable`);
}

export async function blockAtOrBefore(provider,timestamp,latestNumber,cache=new Map()){
  const key=String(timestamp);if(cache.has(key))return cache.get(key);
  const target=Math.floor(Date.parse(timestamp)/1000);if(!Number.isFinite(target))throw new Error(`Invalid checkpoint timestamp ${timestamp}`);
  const latest=await getBlockReliable(provider,latestNumber);
  if(Number(latest.timestamp)<=target){
    const result={blockNumber:Number(latest.number),blockTimestamp:new Date(Number(latest.timestamp)*1000).toISOString()};
    cache.set(key,result);return result;
  }

  let hiNumber=Number(latestNumber),loNumber=null,loBlock=null,step=RECENT_BOUNDARY_INITIAL_STEP;
  while(loNumber===null){
    const candidate=Math.max(0,Number(latestNumber)-step),block=await getBlockReliable(provider,candidate);
    if(Number(block.timestamp)<=target){loNumber=candidate;loBlock=block;break;}
    hiNumber=candidate;
    if(candidate===0)throw new Error(`Yield Basis boundary ${timestamp} predates available chain history`);
    step*=2;
  }

  while(loNumber+1<hiNumber){
    const mid=Math.floor((loNumber+hiNumber)/2),block=await getBlockReliable(provider,mid);
    if(Number(block.timestamp)<=target){loNumber=mid;loBlock=block;}else hiNumber=mid;
  }
  if(!loBlock)loBlock=await getBlockReliable(provider,loNumber);
  const result={blockNumber:Number(loBlock.number),blockTimestamp:new Date(Number(loBlock.timestamp)*1000).toISOString()};
  cache.set(key,result);return result;
}

function monthBoundaries(startIso,endIso){
  const out=[],start=new Date(startIso),end=new Date(endIso);let y=start.getUTCFullYear(),m=start.getUTCMonth();
  while(true){const d=new Date(Date.UTC(y,m,1));if(d>end)break;if(d>=start)out.push(d.toISOString());m++;if(m>11){m=0;y++;}}
  return out;
}

async function tokenMeta(provider,token,cache,blockTag){
  const key=lower(token);if(cache.has(key))return cache.get(key);
  const erc20=new Contract(token,ERC20_ABI,provider);
  const [decimalsRaw,symbolRaw]=await Promise.all([erc20.decimals({blockTag}),erc20.symbol({blockTag})]);
  const meta={token:getAddress(token),decimals:Number(decimalsRaw),symbol:String(symbolRaw)};cache.set(key,meta);return meta;
}

async function previewRows({contract,provider,walletRow,blockNumber,priceIndex,metaCache}){
  const [tokens,amounts]=await contract.preview_claim.staticCall(walletRow.wallet,50,false,{blockTag:blockNumber});
  if(tokens.length!==amounts.length)throw new Error(`Yield Basis preview_claim tuple length mismatch for ${walletRow.wallet}`);
  const rows=[];
  for(let i=0;i<tokens.length;i++){
    if(!isAddress(tokens[i]))throw new Error(`Yield Basis preview_claim invalid token for ${walletRow.wallet}`);
    const meta=await tokenMeta(provider,tokens[i],metaCache,blockNumber),raw=BigInt(amounts[i]).toString(),price=priceIndex.get(walletRow.company,walletRow.wallet,meta.token);
    rows.push({token:meta.token,symbol:meta.symbol,decimals:meta.decimals,amountRaw:raw,amount:Number(formatUnits(raw,meta.decimals)),unitUsd:price?.unitUsd??null,valuationSource:price?.priceMethod||null,valuationObservedAt:price?.valuationObservedAt||null});
  }
  return rows.sort((a,b)=>lower(a.token).localeCompare(lower(b.token)));
}

async function queryClaims(contract,wallet,fromBlock,toBlock){
  if(!(toBlock>=fromBlock))return{claims:[],requestCount:0};
  const claims=[];let requestCount=0;
  for(let from=fromBlock;from<=toBlock;from+=MAX_LOG_BLOCKS){
    const to=Math.min(toBlock,from+MAX_LOG_BLOCKS-1),logs=await contract.queryFilter(contract.filters.Claim(wallet),from,to);requestCount++;
    for(const log of logs){
      const token=String(log?.args?.[1]||''),amount=log?.args?.[2];
      if(!isAddress(token)||amount===undefined)throw new Error(`Yield Basis Claim decode failed at block ${log.blockNumber}`);
      claims.push({blockNumber:Number(log.blockNumber),transactionHash:String(log.transactionHash||''),logIndex:Number(log.index??0),user:String(log.args?.[0]||wallet),token:getAddress(token),amountRaw:BigInt(amount).toString()});
    }
  }
  return{claims:claims.sort((a,b)=>a.blockNumber-b.blockNumber||a.logIndex-b.logIndex),requestCount};
}

function retainCheckpoints(checkpoints){
  const groups=new Map();for(const c of checkpoints){if(!groups.has(c.stateKey))groups.set(c.stateKey,[]);groups.get(c.stateKey).push(c);}
  return[...groups.values()].flatMap(xs=>xs.sort((a,b)=>Number(a.blockNumber)-Number(b.blockNumber)||String(a.observedAt).localeCompare(String(b.observedAt))).slice(-MAX_CHECKPOINTS_PER_WALLET)).sort((a,b)=>a.stateKey.localeCompare(b.stateKey)||Number(a.blockNumber)-Number(b.blockNumber));
}

function eventEconomicDate(close){return close?.monthBoundary?previousDay(close.observedAt):String(close.observedAt).slice(0,10);}
function intervalMonth(open,close){
  const month=eventEconomicDate(close).slice(0,7),openMonth=String(open.observedAt).slice(0,7),closeMonth=close?.monthBoundary?month:String(close.observedAt).slice(0,7);
  return openMonth&&closeMonth&&openMonth!==closeMonth&&!close?.monthBoundary?null:month;
}

async function buildCheckpoint({provider,contract,walletRow,observedAt,blockNumber,blockTimestamp,priceIndex,metaCache,kind,providerLabel=null}){
  const rows=await previewRows({contract,provider,walletRow,blockNumber,priceIndex,metaCache});
  return{checkpointKey:`${kind}:${walletRow.stateKey}:${blockNumber}`,stateKey:walletRow.stateKey,company:walletRow.company,wallet:walletRow.wallet,walletAlias:walletRow.walletAlias,route:MECHANISM,observedAt,blockNumber,blockTimestamp,rows,boundaryProof:'block-tagged-FeeDistributor.preview_claim(receiver,50,false)',exactBlockTaggedState:true,monthBoundary:kind==='month-boundary',historicalStateProvider:kind==='month-boundary'?providerLabel:null,periodIncomeAuthority:false,currentClaimableBalanceIsPeriodIncome:false,unknownIsNotZero:true};
}

async function buildHistoricalCheckpoint({candidates,walletRow,observedAt,blockNumber,blockTimestamp,priceIndex,metaCache,stats}){
  const errors=[];
  for(const candidate of candidates){
    try{
      const checkpoint=await buildCheckpoint({provider:candidate.provider,contract:new Contract(DISTRIBUTOR,ABI,candidate.provider),walletRow,observedAt,blockNumber,blockTimestamp,priceIndex,metaCache,kind:'month-boundary',providerLabel:candidate.label});
      bump(stats.successCounts,candidate.label);return checkpoint;
    }catch(error){
      bump(stats.failureCounts,candidate.label);errors.push({provider:candidate.label,error:errorText(error)});
      if(stats.failureSamples.length<12)stats.failureSamples.push({stateKey:walletRow.stateKey,blockNumber,provider:candidate.label,error:errorText(error)});
    }
  }
  const failure=new Error(`Yield Basis historical preview_claim unavailable across providers: ${errors.map(x=>`${x.provider}: ${x.error}`).join(' | ')}`);
  failure.providerErrors=errors;throw failure;
}

async function queryClaimsWithFallback({candidates,wallet,fromBlock,toBlock,stats}){
  const errors=[];
  for(const candidate of candidates){
    try{
      const result=await queryClaims(new Contract(DISTRIBUTOR,ABI,candidate.provider),wallet,fromBlock,toBlock);
      bump(stats.successCounts,candidate.label);return{...result,provider:candidate.label};
    }catch(error){
      bump(stats.failureCounts,candidate.label);errors.push({provider:candidate.label,error:errorText(error)});
      if(stats.failureSamples.length<12)stats.failureSamples.push({wallet,fromBlock,toBlock,provider:candidate.label,error:errorText(error)});
    }
  }
  const failure=new Error(`Yield Basis Claim log query unavailable across providers: ${errors.map(x=>`${x.provider}: ${x.error}`).join(' | ')}`);
  failure.providerErrors=errors;throw failure;
}

export async function buildYieldBasisEvidence({rewards,previous={},generatedAt=new Date().toISOString(),provider=null}={}){
  const authority={executionAuthority:'none',walletAuthority:'none',claimingAuthority:'none',capitalExecution:false,methodologyMutationAuthority:'none'};
  const wallets=trackedWalletsFromRewards(rewards),priceIndex=priceIndexFromRewards(rewards);
  if(!wallets.length)return{version:VERSION,mechanism:MECHANISM,generatedAt,status:'no-tracked-wallets',fullAccountingStart:FULL_ACCOUNTING_START,semantics:{openingBalanceCreatesIncome:false,earnedIndependentOfClaim:true,claimIsSettlementNotSecondIncome:true,formula:'closing preview_claim + Claim settlements - opening preview_claim, token by token',positiveDeltaRequired:true,referenceAprUsed:false,laterPriceMovementRewritesClosedIncome:false,unknownIsNotZero:true},source:{chain:'Ethereum',chainId:1,feeDistributor:DISTRIBUTOR,claimableMetric:'FeeDistributor.preview_claim(receiver,50,false)',settlementEvent:'Claim(user,token,amount)',rewardsSource:'companies/rewards-data.json'},authority,checkpoints:previous?.checkpoints||[],events:previous?.events||[],diagnostics:{trackedWalletCount:0,referenceAprUsed:false,unknownIsNotZero:true}};

  const injected=provider!==null,rpc=provider||new JsonRpcProvider(RPC_URL,1),contract=new Contract(DISTRIBUTOR,ABI,rpc),latestNumber=await rpc.getBlockNumber(),latestBlock=await getBlockReliable(rpc,latestNumber);
  const historicalCandidates=injected?[{provider:rpc,label:'injected-provider'}]:unique([ARCHIVE_RPC_URL,ARCHIVE_RPC_FALLBACK_URL,RPC_URL]).map(url=>({provider:new JsonRpcProvider(url,1),label:rpcLabel(url)}));
  const historicalStateRpc={candidateProviders:historicalCandidates.map(x=>x.label),successCounts:{},failureCounts:{},failureSamples:[]};
  const claimLogRpc={candidateProviders:historicalCandidates.map(x=>x.label),successCounts:{},failureCounts:{},failureSamples:[]};
  const currentObservedAt=new Date(Number(latestBlock.timestamp)*1000).toISOString(),blockCache=new Map(),metaCache=new Map();
  const byCheckpoint=new Map((previous?.checkpoints||[]).filter(x=>x?.checkpointKey).map(x=>[x.checkpointKey,x])),boundaryFailures=[];

  for(const w of wallets){
    for(const boundaryAt of monthBoundaries(FULL_ACCOUNTING_START,currentObservedAt)){
      let b;try{b=await blockAtOrBefore(rpc,boundaryAt,latestNumber,blockCache);}catch(error){boundaryFailures.push({stateKey:w.stateKey,boundaryAt,error:errorText(error)});continue;}
      const key=`month-boundary:${w.stateKey}:${b.blockNumber}`;if(byCheckpoint.has(key))continue;
      try{byCheckpoint.set(key,await buildHistoricalCheckpoint({candidates:historicalCandidates,walletRow:w,observedAt:boundaryAt,blockNumber:b.blockNumber,blockTimestamp:b.blockTimestamp,priceIndex,metaCache,stats:historicalStateRpc}));}
      catch(error){boundaryFailures.push({stateKey:w.stateKey,boundaryAt,blockNumber:b.blockNumber,error:errorText(error),providerErrors:error.providerErrors||[]});}
    }
    const key=`live:${w.stateKey}:${latestNumber}`;
    if(!byCheckpoint.has(key))byCheckpoint.set(key,await buildCheckpoint({provider:rpc,contract,walletRow:w,observedAt:currentObservedAt,blockNumber:latestNumber,blockTimestamp:currentObservedAt,priceIndex,metaCache,kind:'live',providerLabel:rpcLabel(RPC_URL)}));
  }

  const checkpoints=retainCheckpoints([...byCheckpoint.values()].filter(x=>x?.checkpointKey&&Number(x.blockNumber)>=0));
  const priorEvents=new Map((previous?.events||[]).filter(x=>x?.eventKey).map(x=>[x.eventKey,x]));
  const diagnostics={trackedWalletCount:wallets.length,currentBlockNumber:latestNumber,currentObservedAt,checkpointCount:checkpoints.length,monthBoundaryCount:checkpoints.filter(x=>x.monthBoundary).length,monthBoundaryFailures:boundaryFailures,historicalStateRpc,claimLogRpc,intervalCount:0,acceptedPositiveTokenIntervalCount:0,zeroTokenIntervalCount:0,reconciliationCount:0,unvaluedEventCount:0,claimEventCount:0,claimLogRequestCount:0,claimQueryFailures:[],referenceAprUsed:false,unknownIsNotZero:true};

  for(const w of wallets){
    const points=checkpoints.filter(x=>x.stateKey===w.stateKey).sort((a,b)=>Number(a.blockNumber)-Number(b.blockNumber)||String(a.observedAt).localeCompare(String(b.observedAt)));
    for(let i=1;i<points.length;i++){
      const open=points[i-1],close=points[i];if(Number(close.blockNumber)<=Number(open.blockNumber))continue;diagnostics.intervalCount++;
      let settlement;
      try{settlement=await queryClaimsWithFallback({candidates:historicalCandidates,wallet:w.wallet,fromBlock:Number(open.blockNumber)+1,toBlock:Number(close.blockNumber),stats:claimLogRpc});}
      catch(error){diagnostics.reconciliationCount++;diagnostics.claimQueryFailures.push({stateKey:w.stateKey,fromBlock:Number(open.blockNumber)+1,toBlock:Number(close.blockNumber),error:errorText(error),providerErrors:error.providerErrors||[]});continue;}
      diagnostics.claimEventCount+=settlement.claims.length;diagnostics.claimLogRequestCount+=settlement.requestCount;
      const openRows=new Map((open.rows||[]).map(x=>[lower(x.token),x])),closeRows=new Map((close.rows||[]).map(x=>[lower(x.token),x])),claimByToken=new Map();
      for(const c of settlement.claims){const k=lower(c.token);claimByToken.set(k,(claimByToken.get(k)||0n)+BigInt(c.amountRaw));}
      const tokens=[...new Set([...openRows.keys(),...closeRows.keys(),...claimByToken.keys()])].sort();
      for(const tokenKey of tokens){
        const a=openRows.get(tokenKey)||null,b=closeRows.get(tokenKey)||null,settled=(claimByToken.get(tokenKey)||0n).toString(),r=reconcileEntitlement(a?.amountRaw||'0',b?.amountRaw||'0',settled);
        if(!r.accepted){diagnostics.reconciliationCount++;continue;}if(r.earnedRaw==='0'){diagnostics.zeroTokenIntervalCount++;continue;}
        const month=intervalMonth(open,close);if(!month){diagnostics.reconciliationCount++;continue;}
        const meta=b||a||await tokenMeta(rpc,getAddress(`0x${tokenKey.slice(2)}`),metaCache,close.blockNumber),decimals=Number(meta.decimals),amount=Number(formatUnits(r.earnedRaw,decimals));
        const unitUsd=finite(b?.unitUsd)&&Number(b.unitUsd)>0?Number(b.unitUsd):null,usdValue=unitUsd?amount*unitUsd:null;
        if(!finite(usdValue))diagnostics.unvaluedEventCount++;
        const proofs=settlement.claims.filter(x=>lower(x.token)===tokenKey),eventKey=`yield-basis-accrual:${lower(w.wallet)}:${tokenKey}:${open.blockNumber}:${close.blockNumber}`;
        if(priorEvents.has(eventKey))continue;
        priorEvents.set(eventKey,{eventKey,company:w.company,family:'accrued-entitlement',economicDate:eventEconomicDate(close),periodStart:open.observedAt,periodEnd:close.observedAt,route:MECHANISM,protocol:'Yield Basis · veYB',asset:meta.symbol||meta.token,token:meta.token,decimals,amount:round(amount,12),amountRaw:r.earnedRaw,usdValue:finite(usdValue)?round(usdValue,8):null,valuationUnitUsd:unitUsd?round(unitUsd,12):null,valuationAt:b?.valuationObservedAt||close.observedAt,valuationStatus:finite(usdValue)?'frozen-at-closing-accounting-boundary':'unvalued-fail-closed',sourceFile:'reporting/yield-basis-accounting-evidence.json',sourceFamily:'FeeDistributor cumulative token entitlement with Claim settlement reconciliation',sourceIdentity:`${open.checkpointKey}->${close.checkpointKey}:${tokenKey}`,evidenceStatus:'factual-opening-plus-settlement-to-closing-token-reconciliation',openingClaimableRaw:a?.amountRaw||'0',closingClaimableRaw:b?.amountRaw||'0',settlementRaw:settled,settlementEventCount:proofs.length,settlementProofs:proofs,settlementLogProvider:settlement.provider,openingBoundaryProof:open.boundaryProof,closingBoundaryProof:close.boundaryProof,periodAttributionMonth:month,referenceAprUsed:false,currentClaimableBalanceIsPeriodIncome:false,claimIsSecondIncomeEvent:false,laterClaimOrPriceMoveDoesNotRewriteIncome:true,unknownIsNotZero:true,executionAuthority:'none'});
        diagnostics.acceptedPositiveTokenIntervalCount++;
      }
    }
  }

  const events=[...priorEvents.values()].sort((a,b)=>String(a.periodEnd||'').localeCompare(String(b.periodEnd||''))||a.eventKey.localeCompare(b.eventKey));
  return{version:VERSION,mechanism:MECHANISM,generatedAt,status:diagnostics.reconciliationCount||diagnostics.unvaluedEventCount||boundaryFailures.length?'partial':'factual-boundary-tracking',fullAccountingStart:FULL_ACCOUNTING_START,semantics:{openingBalanceCreatesIncome:false,earnedIndependentOfClaim:true,claimIsSettlementNotSecondIncome:true,formula:'closing preview_claim + Claim settlements - opening preview_claim, token by token',positiveDeltaRequired:true,referenceAprUsed:false,laterPriceMovementRewritesClosedIncome:false,unknownIsNotZero:true},source:{chain:'Ethereum',chainId:1,feeDistributor:DISTRIBUTOR,claimableMetric:'FeeDistributor.preview_claim(receiver,50,false)',settlementEvent:'Claim(user,token,amount)',rewardsSource:'companies/rewards-data.json',collectorReuse:'same FeeDistributor + wallet scope already used by rewards/company-rewards-engine.mjs',historicalRpcPolicy:'capability-aware archive fallback; current state remains on primary RPC'},authority,checkpoints,events,diagnostics};
}

async function main(){
  const [rewards,previous]=await Promise.all([readJson(DEFAULT_REWARDS),readJson(DEFAULT_OUTPUT,{})]);
  const output=await buildYieldBasisEvidence({rewards,previous});await writeJson(DEFAULT_OUTPUT,output);
  console.log('Yield Basis factual accrual evidence built',{status:output.status,checkpoints:output.checkpoints?.length||0,events:output.events?.length||0,acceptedPositiveTokenIntervals:output.diagnostics?.acceptedPositiveTokenIntervalCount||0,reconciliations:output.diagnostics?.reconciliationCount||0,unvalued:output.diagnostics?.unvaluedEventCount||0,boundaryFailures:output.diagnostics?.monthBoundaryFailures?.length||0,claimQueryFailures:output.diagnostics?.claimQueryFailures?.length||0,historicalStateProviders:output.diagnostics?.historicalStateRpc?.successCounts||{},claimLogProviders:output.diagnostics?.claimLogRpc?.successCounts||{},executionAuthority:output.authority?.executionAuthority});
  if(output.diagnostics?.monthBoundaryFailures?.length)console.log('Yield Basis boundary failures JSON',JSON.stringify(output.diagnostics.monthBoundaryFailures,null,2));
  if(output.diagnostics?.claimQueryFailures?.length)console.log('Yield Basis claim query failures JSON',JSON.stringify(output.diagnostics.claimQueryFailures,null,2));
}

if(process.argv[1]&&path.resolve(process.argv[1])===__filename)main().catch(error=>{console.error(error);process.exitCode=1;});
