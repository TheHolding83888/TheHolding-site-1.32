#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { Contract, Interface, JsonRpcProvider, ZeroAddress, getAddress, formatUnits } from 'ethers';
import { DIRECT_ACCOUNTING_START, PROTOCOLS, blockAtOrBefore, reconcileEntitlement } from './ve33-accounting-evidence.mjs';
import { historicalCanonicalPriceAtBoundary } from './historical-canonical-price.mjs';

const __filename=fileURLToPath(import.meta.url);
const __dirname=path.dirname(__filename);
const ROOT=path.resolve(__dirname,'..');

export const LOCKED_MANAGED_VERSION='0.2-ve33-locked-managed-historical-factual-accrual';
export const LOCKED_MANAGED_ACCOUNTING_START=DIRECT_ACCOUNTING_START;
const DEFAULT_REWARDS=process.env.REWARDS_DATA_FILE||path.join(ROOT,'companies','rewards-data.json');
const DEFAULT_OUTPUT=process.env.VE33_LOCKED_MANAGED_EVIDENCE_FILE||path.join(ROOT,'reporting','ve33-locked-managed-accounting-evidence.json');
const MAX_LOG_BLOCKS=9_500;
const MAX_CHECKPOINTS_PER_LANE=460;
const FAILURE_SAMPLE_LIMIT=20;

const VE_MANAGED_ABI=[
  'function idToManaged(uint256 tokenId) view returns (uint256)',
  'function managedToLocked(uint256 managedTokenId) view returns (address)'
];
const LOCKED_REWARD_ABI=[
  'function earned(address token,uint256 tokenId) view returns (uint256)',
  'function lastEarn(address token,uint256 tokenId) view returns (uint256)',
  'event ClaimRewards(address indexed from,address indexed reward,uint256 amount)'
];
const WITHDRAW_IFACE=new Interface(['function withdrawManaged(uint256 tokenId)']);

const lower=v=>String(v||'').toLowerCase();
const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
const round=(v,d=12)=>finite(v)?Number(Number(v).toFixed(d)):null;
const isAddress=v=>/^0x[0-9a-f]{40}$/i.test(String(v||''));
const previousDay=v=>new Date(Date.parse(v)-1).toISOString().slice(0,10);

async function readJson(file,fallback={}){try{return JSON.parse(await fs.readFile(file,'utf8'));}catch{return fallback;}}
async function writeJson(file,data){await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,JSON.stringify(data,null,2)+'\n');}
function unique(values){return[...new Set((values||[]).filter(Boolean))];}

function priceMap(rewards){
  const map=new Map();
  for(const c of Object.values(rewards?.companies||{}))for(const r of c?.rewards||[]){
    if(!isAddress(r?.token)||!(finite(r?.priceUsd)&&Number(r.priceUsd)>0))continue;
    const key=lower(r.token),rows=map.get(key)||[];
    rows.push({priceUsd:Number(r.priceUsd),priceMethod:r.priceMethod||null,observedAt:rewards.generatedAt||null});
    map.set(key,rows);
  }
  const out=new Map();
  for(const[key,rows]of map){rows.sort((a,b)=>a.priceUsd-b.priceUsd);out.set(key,rows[Math.floor(rows.length/2)]);}
  return out;
}

function protocolKeyFor({route,protocol}){
  const p=lower(protocol);
  if(p.includes('aerodrome')||String(route||'').startsWith('aerodrome-'))return'aerodrome';
  if(p.includes('velodrome')||String(route||'').startsWith('velodrome-'))return'velodrome';
  return null;
}

function laneKey(x){return[x.protocolKey,x.company,lower(x.holder),String(x.tokenId),String(x.managedTokenId),lower(x.lockedManagedReward),lower(x.rewardToken)].join('|');}
function checkpointKey(lane,blockNumber){return`${lane.laneKey}|${blockNumber}`;}
function eventKey(lane,open,close){return`ve33-locked:${lane.laneKey}:${open.blockNumber}:${close.blockNumber}`;}

function addLane(out,seen,raw){
  const protocolKey=raw.protocolKey||protocolKeyFor(raw),cfg=PROTOCOLS[protocolKey];
  if(!cfg||!raw.company||!raw.route||!raw.tokenId||!raw.managedTokenId||!isAddress(raw.lockedManagedReward)||!isAddress(raw.rewardToken))return;
  const holder=isAddress(raw.holder)?getAddress(raw.holder):null;
  if(!holder)return;
  const lane={
    company:raw.company,protocolKey,protocol:cfg.protocol,route:raw.route,chain:cfg.chain,chainId:cfg.chainId,
    holder,walletAlias:raw.walletAlias||null,custodyContext:raw.custodyContext||'managed-relay',
    tokenId:String(raw.tokenId),managedTokenId:String(raw.managedTokenId),lockedManagedReward:getAddress(raw.lockedManagedReward),
    rewardToken:getAddress(raw.rewardToken),rewardSymbol:raw.rewardSymbol||cfg.baseSymbol,decimals:Number.isFinite(Number(raw.decimals))?Number(raw.decimals):18
  };
  lane.laneKey=laneKey(lane);
  if(seen.has(lane.laneKey))return;
  seen.add(lane.laneKey);out.push(lane);
}

export function trackedLockedManagedDescriptors(rewards){
  const out=[],seen=new Set();
  for(const[company,c]of Object.entries(rewards?.companies||{})){
    for(const r of c?.rewards||[]){
      if(r?.classification!=='compounded-locked'||!isAddress(r?.token))continue;
      const protocolKey=protocolKeyFor(r);if(!protocolKey)continue;
      const cfg=PROTOCOLS[protocolKey];
      for(const p of r?.details?.veNfts||[]){
        addLane(out,seen,{company,protocolKey,protocol:r.protocol,route:r.route,holder:r?.details?.wallet,walletAlias:r?.details?.walletAlias,custodyContext:r?.details?.custodyContext||'managed-relay',tokenId:p?.tokenId,managedTokenId:p?.managedTokenId,lockedManagedReward:p?.lockedManagedReward,rewardToken:r.token,rewardSymbol:r?.details?.symbol||cfg?.baseSymbol,decimals:r.decimals});
      }
    }
    for(const source of c?.sources||[]){
      const protocolKey=protocolKeyFor(source);if(!protocolKey)continue;
      const cfg=PROTOCOLS[protocolKey];
      const candidates=[];
      for(const p of source?.details?.positions||[])candidates.push({p,holder:p?.holderAddress,walletAlias:p?.walletAlias});
      for(const wr of source?.details?.walletResults||[])for(const p of wr?.details?.positions||[])candidates.push({p,holder:p?.holderAddress||wr?.wallet,walletAlias:wr?.walletAlias});
      for(const{p,holder,walletAlias}of candidates){
        if(p?.mode!=='managed'||!isAddress(p?.lockedManagedReward))continue;
        addLane(out,seen,{company,protocolKey,protocol:cfg.protocol,route:source.route,holder,walletAlias,custodyContext:p?.custodyContext||'managed',tokenId:p?.tokenId,managedTokenId:p?.managedTokenId,lockedManagedReward:p?.lockedManagedReward,rewardToken:cfg.baseToken,rewardSymbol:cfg.baseSymbol,decimals:18});
      }
    }
  }
  return out.sort((a,b)=>a.laneKey.localeCompare(b.laneKey));
}

async function providerFor(cfg){
  const urls=unique([process.env[cfg.rpcEnv],...(cfg.rpcFallbacks||[])]);let last=null;
  for(const url of urls){try{const p=new JsonRpcProvider(url,cfg.chainId);await Promise.race([p.getBlockNumber(),new Promise((_,rej)=>setTimeout(()=>rej(new Error('RPC timeout')),8_000))]);return p;}catch(error){last=error;}}
  throw last||new Error(`No ${cfg.protocol} RPC available`);
}

function monthBoundaries(startIso,endIso){
  const out=[],start=new Date(startIso),end=new Date(endIso);let y=start.getUTCFullYear(),m=start.getUTCMonth();
  while(true){const d=new Date(Date.UTC(y,m,1));if(d>end)break;if(d>=start)out.push(d.toISOString());m++;if(m>11){m=0;y++;}}
  return out;
}
function eventEconomicDate(close){return close?.monthBoundary?previousDay(close.observedAt):String(close.observedAt).slice(0,10);}
function intervalMonth(open,close){const economicDate=eventEconomicDate(close),month=economicDate.slice(0,7),a=String(open.observedAt).slice(0,7),b=close.monthBoundary?month:String(close.observedAt).slice(0,7);return a===b?month:(close.monthBoundary?month:null);}

export function compactLockedManagedCheckpoints(previous={}){
  const rows=(previous?.checkpoints||[]).filter(x=>x?.checkpointKey&&x?.laneKey&&Number.isFinite(Number(x.blockNumber)));
  const byKey=new Map(rows.map(x=>[x.checkpointKey,x]));
  const latestByLane=new Map();
  for(const row of rows){const prior=latestByLane.get(row.laneKey);if(!prior||Number(row.blockNumber)>Number(prior.blockNumber))latestByLane.set(row.laneKey,row);}
  const eventProofKeys=new Set();
  for(const event of previous?.events||[]){
    const source=String(event?.sourceIdentity||''),arrow=source.indexOf('->');
    if(arrow<=0)continue;
    const openingKey=source.slice(0,arrow),closingKey=source.slice(arrow+2);
    if(byKey.has(openingKey))eventProofKeys.add(openingKey);
    if(byKey.has(closingKey))eventProofKeys.add(closingKey);
  }
  const keep=new Set(eventProofKeys);
  for(const row of rows)if(row.monthBoundary===true)keep.add(row.checkpointKey);
  for(const row of latestByLane.values())keep.add(row.checkpointKey);
  const checkpoints=rows.filter(x=>keep.has(x.checkpointKey)).sort((a,b)=>a.laneKey.localeCompare(b.laneKey)||Number(a.blockNumber)-Number(b.blockNumber));
  return{checkpoints,stats:{inputCheckpointCount:rows.length,retainedCheckpointCount:checkpoints.length,droppedRedundantCheckpointCount:rows.length-checkpoints.length,retainedMonthBoundaryCount:checkpoints.filter(x=>x.monthBoundary===true).length,retainedEventProofCheckpointCount:eventProofKeys.size,retainedLatestLaneCheckpointCount:latestByLane.size,policy:'retain-month-boundaries-latest-per-lane-and-factual-event-proof-checkpoints'}};
}

async function readLaneState({provider,cfg,lane,blockNumber,observedAt,monthBoundary=false}){
  try{
    const ve=new Contract(cfg.votingEscrow,VE_MANAGED_ABI,provider);
    const managedId=BigInt(await ve.idToManaged(BigInt(lane.tokenId),{blockTag:blockNumber}));
    if(managedId===0n)return{ok:false,status:'not-managed-at-boundary'};
    if(String(managedId)!==String(lane.managedTokenId))return{ok:false,status:'managed-token-mismatch',observedManagedTokenId:managedId.toString()};
    const locked=getAddress(await ve.managedToLocked(managedId,{blockTag:blockNumber}));
    if(locked===ZeroAddress||lower(locked)!==lower(lane.lockedManagedReward))return{ok:false,status:'locked-managed-reward-mismatch',observedLockedManagedReward:locked};
    const reward=new Contract(lane.lockedManagedReward,LOCKED_REWARD_ABI,provider);
    const[raw,lastEarn]=await Promise.all([
      reward.earned(lane.rewardToken,BigInt(lane.tokenId),{blockTag:blockNumber}),
      reward.lastEarn(lane.rewardToken,BigInt(lane.tokenId),{blockTag:blockNumber})
    ]);
    return{ok:true,checkpointKey:checkpointKey(lane,blockNumber),laneKey:lane.laneKey,company:lane.company,protocolKey:lane.protocolKey,protocol:lane.protocol,chain:lane.chain,chainId:lane.chainId,route:lane.route,holder:lane.holder,walletAlias:lane.walletAlias,custodyContext:lane.custodyContext,tokenId:lane.tokenId,managedTokenId:lane.managedTokenId,lockedManagedReward:lane.lockedManagedReward,rewardToken:lane.rewardToken,rewardSymbol:lane.rewardSymbol,decimals:lane.decimals,observedAt,blockNumber,entitlementRaw:BigInt(raw).toString(),entitlementAmount:round(Number(formatUnits(raw,lane.decimals)),12),lastEarnRaw:BigInt(lastEarn).toString(),lastEarnTimestamp:Number(lastEarn),monthBoundary,exactBlockTaggedState:true,accountingStart:LOCKED_MANAGED_ACCOUNTING_START,periodIncomeAuthority:false,unknownIsNotZero:true};
  }catch(error){return{ok:false,status:'archive-state-unavailable',error:error?.shortMessage||error?.message||String(error)};}
}

export function settlementContinuityFromLastEarn(open,close){
  if(open?.lastEarnRaw===null||open?.lastEarnRaw===undefined||close?.lastEarnRaw===null||close?.lastEarnRaw===undefined)return{proven:false,status:'lastEarn-boundary-proof-missing'};
  if(String(open.lastEarnRaw)===String(close.lastEarnRaw))return{proven:true,status:'exact-boundary-lastEarn-unchanged-no-settlement',amountRaw:'0',events:[],unresolvedEventCount:0};
  return{proven:false,status:'lastEarn-changed-settlement-reconciliation-required',openingLastEarnRaw:String(open.lastEarnRaw),closingLastEarnRaw:String(close.lastEarnRaw)};
}

export function decodeWithdrawManagedTokenId({to,data,votingEscrow}){
  try{if(lower(to)!==lower(votingEscrow))return null;const parsed=WITHDRAW_IFACE.parseTransaction({data});return parsed?.name==='withdrawManaged'?String(parsed.args[0]):null;}catch{return null;}
}

async function lockedSettlements({provider,cfg,lane,fromBlock,toBlock}){
  if(toBlock<fromBlock)return{amountRaw:'0',events:[],unresolvedEventCount:0,continuityStatus:'empty-range-no-settlement'};
  const reward=new Contract(lane.lockedManagedReward,LOCKED_REWARD_ABI,provider),events=[];let total=0n,unresolvedEventCount=0;
  const filter=reward.filters.ClaimRewards(null,lane.rewardToken);
  for(let from=fromBlock;from<=toBlock;from+=MAX_LOG_BLOCKS){
    const to=Math.min(toBlock,from+MAX_LOG_BLOCKS-1),logs=await reward.queryFilter(filter,from,to);
    for(const log of logs){
      const amount=BigInt(log?.args?.[2]||0);if(amount===0n)continue;
      const tx=await provider.getTransaction(log.transactionHash),decoded=tx?decodeWithdrawManagedTokenId({to:tx.to,data:tx.data,votingEscrow:cfg.votingEscrow}):null;
      if(decoded===String(lane.tokenId)){
        total+=amount;
        events.push({blockNumber:Number(log.blockNumber),transactionHash:String(log.transactionHash||''),logIndex:Number(log.index??0),recipient:String(log?.args?.[0]||''),rewardToken:lane.rewardToken,amountRaw:amount.toString(),decodedTokenId:decoded,decodePath:'VotingEscrow.withdrawManaged'});
      }else if(decoded===null){unresolvedEventCount++;}
    }
  }
  return{amountRaw:total.toString(),events,unresolvedEventCount,continuityStatus:'claim-rewards-withdraw-managed-log-reconciliation'};
}

function retainCheckpoints(rows){
  const groups=new Map();for(const x of rows){if(!groups.has(x.laneKey))groups.set(x.laneKey,[]);groups.get(x.laneKey).push(x);}
  return[...groups.values()].flatMap(xs=>xs.sort((a,b)=>Number(a.blockNumber)-Number(b.blockNumber)).slice(-MAX_CHECKPOINTS_PER_LANE)).sort((a,b)=>a.laneKey.localeCompare(b.laneKey)||Number(a.blockNumber)-Number(b.blockNumber));
}

export async function buildLockedManagedEvidence({rewards,previous={},generatedAt=new Date().toISOString(),providers={},historicalPriceResolver=historicalCanonicalPriceAtBoundary}={}){
  const authority={executionAuthority:'none',walletAuthority:'none',claimingAuthority:'none',capitalExecution:false,methodologyMutationAuthority:'none'};
  const compactedHistory=compactLockedManagedCheckpoints(previous);
  const prices=priceMap(rewards),existing=new Map(compactedHistory.checkpoints.map(x=>[x.checkpointKey,x])),priorEvents=new Map((previous?.events||[]).filter(x=>x?.eventKey).map(x=>[x.eventKey,x]));
  const historicalPriceCache=new Map();
  const resolveHistoricalPrice=async({token,boundaryAt})=>{
    const key=`${lower(token)}|${boundaryAt}`;
    if(!historicalPriceCache.has(key))historicalPriceCache.set(key,Promise.resolve().then(()=>historicalPriceResolver({token,boundaryAt})).catch(error=>({ok:false,status:'historical-canonical-price-resolver-error',error:error?.message||String(error)})));
    return historicalPriceCache.get(key);
  };
  const diagnostics={protocols:{},laneCount:0,acceptedPositiveIntervalCount:0,zeroIntervalCount:0,reconciliationCount:0,settlementQueryFailureCount:0,settlementQueryFailureSamples:[],lastEarnNoSettlementProofCount:0,unvaluedIntervalCount:0,unresolvedSettlementEventCount:0,historicalPriceResolvedIntervalCount:0,historicalPriceUnresolvedIntervalCount:0,historicalPriceCacheEntries:0,historyCompaction:compactedHistory.stats,referenceAprUsed:false,unknownIsNotZero:true};
  const descriptors=trackedLockedManagedDescriptors(rewards);

  for(const[protocolKey,cfg]of Object.entries(PROTOCOLS)){
    const lanes=descriptors.filter(x=>x.protocolKey===protocolKey);diagnostics.laneCount+=lanes.length;
    if(!lanes.length){diagnostics.protocols[protocolKey]={laneCount:0,latestBlockNumber:null,observedAt:null,boundaryFailures:[],inactiveBoundaries:[],intervalCount:0,settlementEventCount:0};continue;}
    const provider=providers[protocolKey]||await providerFor(cfg),latestNumber=await provider.getBlockNumber(),latestBlock=await provider.getBlock(latestNumber);if(!latestBlock)throw new Error(`${cfg.protocol} latest block unavailable`);
    const observedAt=new Date(Number(latestBlock.timestamp)*1000).toISOString(),pd={laneCount:lanes.length,latestBlockNumber:latestNumber,observedAt,boundaryFailures:[],inactiveBoundaries:[],intervalCount:0,settlementEventCount:0};diagnostics.protocols[protocolKey]=pd;
    const boundaryBlocks=new Map(),cache=new Map();
    for(const boundaryAt of monthBoundaries(LOCKED_MANAGED_ACCOUNTING_START,observedAt)){
      try{boundaryBlocks.set(boundaryAt,await blockAtOrBefore(provider,boundaryAt,latestNumber,cache));}
      catch(error){pd.boundaryFailures.push({laneKey:null,boundaryAt,status:'boundary-block-unavailable',error:error?.shortMessage||error?.message||String(error)});}
    }
    for(const lane of lanes){
      lane.price=prices.get(lower(lane.rewardToken))||null;
      for(const[boundaryAt,b]of boundaryBlocks){
        const key=checkpointKey(lane,b.blockNumber),prior=existing.get(key);
        if(prior?.lastEarnRaw!==undefined&&prior?.lastEarnRaw!==null)continue;
        const state=await readLaneState({provider,cfg,lane,blockNumber:b.blockNumber,observedAt:boundaryAt,monthBoundary:true});
        if(state.ok)existing.set(key,state);
        else if(['not-managed-at-boundary','managed-token-mismatch','locked-managed-reward-mismatch'].includes(state.status))pd.inactiveBoundaries.push({laneKey:lane.laneKey,boundaryAt,...state});
        else pd.boundaryFailures.push({laneKey:lane.laneKey,boundaryAt,...state});
      }
      const current=await readLaneState({provider,cfg,lane,blockNumber:latestNumber,observedAt,monthBoundary:false});if(current.ok)existing.set(current.checkpointKey,current);else pd.boundaryFailures.push({laneKey:lane.laneKey,boundaryAt:observedAt,...current});
    }
    const protocolCheckpoints=[...existing.values()].filter(x=>x.protocolKey===protocolKey&&x.lastEarnRaw!==undefined&&x.lastEarnRaw!==null).sort((a,b)=>a.laneKey.localeCompare(b.laneKey)||Number(a.blockNumber)-Number(b.blockNumber));
    for(const lane of lanes){
      const rows=protocolCheckpoints.filter(x=>x.laneKey===lane.laneKey);
      for(let i=1;i<rows.length;i++){
        const open=rows[i-1],close=rows[i];if(Number(close.blockNumber)<=Number(open.blockNumber))continue;pd.intervalCount++;
        const key=eventKey(lane,open,close);if(priorEvents.has(key))continue;
        let settlements=settlementContinuityFromLastEarn(open,close);
        if(settlements.proven===true){diagnostics.lastEarnNoSettlementProofCount++;}
        else{
          try{settlements=await lockedSettlements({provider,cfg,lane,fromBlock:Number(open.blockNumber)+1,toBlock:Number(close.blockNumber)});}
          catch(error){
            diagnostics.reconciliationCount++;diagnostics.settlementQueryFailureCount++;
            if(diagnostics.settlementQueryFailureSamples.length<FAILURE_SAMPLE_LIMIT)diagnostics.settlementQueryFailureSamples.push({laneKey:lane.laneKey,fromBlock:Number(open.blockNumber)+1,toBlock:Number(close.blockNumber),openingLastEarnRaw:open.lastEarnRaw,closingLastEarnRaw:close.lastEarnRaw,error:error?.shortMessage||error?.message||String(error)});
            continue;
          }
        }
        pd.settlementEventCount+=(settlements.events||[]).length;diagnostics.unresolvedSettlementEventCount+=Number(settlements.unresolvedEventCount||0);
        const r=reconcileEntitlement(open.entitlementRaw,close.entitlementRaw,settlements.amountRaw);if(!r.accepted){diagnostics.reconciliationCount++;continue;}if(r.earnedRaw==='0'){diagnostics.zeroIntervalCount++;continue;}
        const month=intervalMonth(open,close);if(!month){diagnostics.reconciliationCount++;continue;}
        let valuation=null;
        if(close.monthBoundary===true){
          valuation=await resolveHistoricalPrice({token:lane.rewardToken,boundaryAt:close.observedAt});
          if(valuation?.ok===true)diagnostics.historicalPriceResolvedIntervalCount++;
          else diagnostics.historicalPriceUnresolvedIntervalCount++;
        }
        const amount=Number(formatUnits(BigInt(r.earnedRaw),lane.decimals));
        const unitUsd=close.monthBoundary===true?(valuation?.ok===true?valuation.priceUsd:null):(lane.price?.priceUsd||null);
        const usdValue=finite(unitUsd)?amount*Number(unitUsd):null;if(!finite(usdValue))diagnostics.unvaluedIntervalCount++;
        priorEvents.set(key,{eventKey:key,company:lane.company,family:'embedded-compounded-income',economicDate:eventEconomicDate(close),periodStart:open.observedAt,periodEnd:close.observedAt,route:lane.route,protocol:lane.protocol,chain:lane.chain,chainId:lane.chainId,asset:lane.rewardSymbol,token:lane.rewardToken,amount:round(amount,12),amountRaw:r.earnedRaw,usdValue:finite(usdValue)?round(usdValue,8):null,valuationUnitUsd:finite(unitUsd)?round(unitUsd,12):null,valuationAt:close.monthBoundary===true?(valuation?.ok===true?valuation.observedAt:close.observedAt):(lane.price?.observedAt||close.observedAt),valuationStatus:finite(usdValue)?(close.monthBoundary===true?'historical-canonical-market-price-frozen-at-closing-accounting-boundary':'frozen-at-closing-accounting-boundary'):'unvalued-fail-closed',valuationSourceFile:close.monthBoundary===true?(valuation?.sourceFile||null):null,valuationSourceCommit:close.monthBoundary===true?(valuation?.commitSha||null):null,valuationSourceAssetId:close.monthBoundary===true?(valuation?.assetId||null):null,valuationSourceStatus:close.monthBoundary===true?(valuation?.status||null):(lane.price?.priceMethod||null),valuationSnapshotAgeMinutes:close.monthBoundary===true&&finite(valuation?.ageMinutes)?round(valuation.ageMinutes,6):null,sourceFile:'reporting/ve33-locked-managed-accounting-evidence.json',sourceFamily:'ve(3,3) LockedManagedReward factual accrual',sourceIdentity:`${open.checkpointKey}->${close.checkpointKey}`,evidenceStatus:'factual-locked-managed-opening-plus-settlement-to-closing-reconciliation',mechanismKind:'locked-managed-reward',holder:lane.holder,custodyContext:lane.custodyContext,tokenId:lane.tokenId,managedTokenId:lane.managedTokenId,rewardContract:lane.lockedManagedReward,openingEntitlementRaw:open.entitlementRaw,closingEntitlementRaw:close.entitlementRaw,openingLastEarnRaw:open.lastEarnRaw,closingLastEarnRaw:close.lastEarnRaw,settlementContinuityStatus:settlements.continuityStatus||settlements.status||null,settlementRaw:settlements.amountRaw,settlementEventCount:(settlements.events||[]).length,settlementProofs:settlements.events||[],periodAttributionMonth:month,recognitionState:'compounded-locked',openingBalanceCreatesIncome:false,earnedIndependentOfWithdrawal:true,withdrawalIsSettlementNotSecondIncome:true,grossVeNftPrincipalDeltaIsIncomeAuthority:false,referenceAprUsed:false,currentClaimableBalanceIsPeriodIncome:false,claimIsSecondIncomeEvent:false,laterClaimOrPriceMoveDoesNotRewriteIncome:true,unknownIsNotZero:true,executionAuthority:'none'});diagnostics.acceptedPositiveIntervalCount++;
      }
    }
  }
  diagnostics.historicalPriceCacheEntries=historicalPriceCache.size;
  const checkpoints=retainCheckpoints([...existing.values()].filter(x=>x?.checkpointKey)),events=[...priorEvents.values()].sort((a,b)=>String(a.periodEnd||'').localeCompare(String(b.periodEnd||''))||a.eventKey.localeCompare(b.eventKey));
  const partial=diagnostics.reconciliationCount||diagnostics.unvaluedIntervalCount||Object.values(diagnostics.protocols).some(x=>(x.boundaryFailures||[]).length);
  return{version:LOCKED_MANAGED_VERSION,generatedAt,status:partial?'partial':'factual-boundary-tracking',fullAccountingStart:LOCKED_MANAGED_ACCOUNTING_START,semantics:{openingBalanceCreatesIncome:false,earnedIndependentOfWithdrawal:true,withdrawalIsSettlementNotSecondIncome:true,grossVeNftPrincipalDeltaIsIncomeAuthority:false,referenceAprUsed:false,laterPriceMovementRewritesClosedIncome:false,unknownIsNotZero:true,historicalBoundaryIdentityMustMatch:true,unchangedLastEarnAcrossExactBoundariesProvesNoSettlement:true,historicalClosedIntervalPriceSource:'canonical market-data Git history only; unmapped or stale price remains UNKNOWN',recognitionFormula:'closing LockedManagedReward.earned + proven withdrawManaged settlement - opening LockedManagedReward.earned'},scope:{included:['Aerodrome/Velodrome LockedManagedReward compounded entitlement from 2026-08-01 where exact historical managed identity is proven'],excluded:['gross veNFT principal deltas','unproven withdrawal settlement attribution','Reference APR/APY inferred income','historical periods where managed identity cannot be proven exactly']},authority,checkpoints,events,diagnostics};
}

async function main(){const[rewards,previous]=await Promise.all([readJson(DEFAULT_REWARDS),readJson(DEFAULT_OUTPUT,{})]);const output=await buildLockedManagedEvidence({rewards,previous});await writeJson(DEFAULT_OUTPUT,output);console.log('ve(3,3) LockedManagedReward accounting evidence built',{status:output.status,lanes:output.diagnostics.laneCount,checkpoints:output.checkpoints.length,events:output.events.length,accepted:output.diagnostics.acceptedPositiveIntervalCount,reconciliations:output.diagnostics.reconciliationCount,lastEarnNoSettlementProofs:output.diagnostics.lastEarnNoSettlementProofCount,settlementQueryFailures:output.diagnostics.settlementQueryFailureCount,historicalPriceResolved:output.diagnostics.historicalPriceResolvedIntervalCount,historicalPriceUnresolved:output.diagnostics.historicalPriceUnresolvedIntervalCount,executionAuthority:output.authority.executionAuthority});}
if(process.argv[1]&&path.resolve(process.argv[1])===__filename)main().catch(error=>{console.error(error);process.exitCode=1;});
