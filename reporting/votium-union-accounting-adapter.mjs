#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __filename=fileURLToPath(import.meta.url);
const __dirname=path.dirname(__filename);
const ROOT=path.resolve(__dirname,'..');

export const VERSION='0.1-votium-union-factual-accrual-adapter';
export const MECHANISM='votium-union-scrvusd';
export const DISTRIBUTOR='0x17ac69dd3fb8f22b4f52dbdb8a3a0eb059367efc';
const BLOCKSCOUT='https://eth.blockscout.com/api/v2';
const DEFAULT_REWARDS=process.env.REWARDS_DATA_FILE||path.join(ROOT,'companies','rewards-data.json');
const DEFAULT_BOOTSTRAP=process.env.VOTIUM_UNION_BOOTSTRAP_FILE||path.join(ROOT,'reporting','votium-union-accounting-bootstrap.json');
const DEFAULT_OUTPUT=process.env.VOTIUM_UNION_ADAPTER_OUTPUT||'/tmp/votium-union-accounting-adapter.json';
const MAX_LOG_PAGES=40;

const lower=v=>String(v||'').toLowerCase();
const integer=v=>{try{return BigInt(v).toString();}catch{return null;}};
const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
const round=(v,d=12)=>finite(v)?Number(Number(v).toFixed(d)):null;
const iso=v=>{const t=Date.parse(v||'');return Number.isFinite(t)?new Date(t).toISOString():null;};
const sameAddress=(a,b)=>/^0x[0-9a-f]{40}$/i.test(String(a||''))&&lower(a)===lower(b);
const raw18=v=>{try{return Number(BigInt(v))/1e18;}catch{return null;}};

async function readJson(file,fallback={}){try{return JSON.parse(await fs.readFile(file,'utf8'));}catch{return fallback;}}
async function fetchJson(url,label,fetchImpl=fetch){
  const ctl=new AbortController();
  const timer=setTimeout(()=>ctl.abort(),12000);
  try{
    const response=await fetchImpl(url,{headers:{accept:'application/json'},signal:ctl.signal});
    if(!response.ok)throw new Error(`${label} HTTP ${response.status}`);
    return await response.json();
  }finally{clearTimeout(timer);}
}
function decodedName(log){return String(log?.decoded?.method_call||'').split('(')[0].trim();}
function decodedParams(log){
  const out={};
  for(const p of log?.decoded?.parameters||[])out[String(p?.name||'')]=p?.value;
  return out;
}
function nextUrl(params){
  const url=new URL(`${BLOCKSCOUT}/addresses/${DISTRIBUTOR}/logs`);
  for(const [k,v] of Object.entries(params||{}))if(v!==null&&v!==undefined)url.searchParams.set(k,String(v));
  return url.toString();
}
async function txTimestamp(txHash,fetchImpl=fetch){
  const tx=await fetchJson(`${BLOCKSCOUT}/transactions/${txHash}`,'Blockscout transaction',fetchImpl);
  const at=iso(tx?.timestamp);
  if(!at)throw new Error(`Blockscout transaction timestamp missing ${txHash}`);
  return at;
}

export function extractCurrentUnionStates(rewards){
  const out=[];
  for(const [company,c] of Object.entries(rewards?.companies||{})){
    for(const row of c?.rewards||[]){
      if(row?.route!==MECHANISM)continue;
      const d=row?.details||{};
      if(!sameAddress(d.distributor,DISTRIBUTOR))continue;
      const wallet=String(d.wallet||row.wallet||'');
      const week=Number(d.distributorWeek);
      const root=lower(d.merkleRoot);
      const index=integer(d.merkleIndex);
      const amountRaw=integer(row.amountRaw);
      if(!sameAddress(wallet,wallet)||!Number.isSafeInteger(week)||week<1||!/^0x[0-9a-f]{64}$/.test(root)||index===null||amountRaw===null)continue;
      const amount=finite(row.amount)?Number(row.amount):raw18(amountRaw);
      const usdValue=finite(row.usdValue)?Number(row.usdValue):null;
      const unitUsd=amount>0&&finite(usdValue)?usdValue/amount:null;
      out.push({
        stateKey:`${company}|${lower(wallet)}|${MECHANISM}|${lower(row.token||row.symbol)}`,
        company,wallet,route:MECHANISM,protocol:row.protocol||'Votium + Union · vlCVX',asset:row.symbol||'scrvUSD',token:row.token||null,
        distributor:DISTRIBUTOR,week,merkleRoot:root,index,amountRaw,amount:round(amount,12),usdValue:round(usdValue,8),unitUsd:round(unitUsd,12),
        proofValid:d.proofValid===true,claimed:d.claimed===true,forwardingEffective:d.forwardingEffective===true,allocationSharePct:finite(d.allocationSharePct)?Number(d.allocationSharePct):null,
        observedAt:iso(rewards?.generatedAt),sourceGeneratedAt:iso(rewards?.generatedAt),sourceVersion:rewards?.version||null,
        source:'companies/rewards-data.json',unknownIsNotZero:true
      });
    }
  }
  return out.sort((a,b)=>a.stateKey.localeCompare(b.stateKey));
}

export function bootstrapBoundaries(bootstrap){
  if(bootstrap?.version!=='0.1-votium-union-accounting-bootstrap'||bootstrap?.mechanism!==MECHANISM||!sameAddress(bootstrap?.distributor,DISTRIBUTOR))throw new Error('Votium Union bootstrap identity invalid');
  if(bootstrap?.accounting?.bootstrapCreatesIncomeEvent!==false||bootstrap?.accounting?.referenceAprUsed!==false||bootstrap?.accounting?.unknownIsNotZero!==true||bootstrap?.accounting?.executionAuthority!=='none')throw new Error('Votium Union bootstrap accounting boundary invalid');
  const week=Number(bootstrap?.distribution?.week),root=lower(bootstrap?.distribution?.merkleRoot),observedAt=iso(bootstrap?.observedAt);
  if(!Number.isSafeInteger(week)||week<1||!/^0x[0-9a-f]{64}$/.test(root)||!observedAt)throw new Error('Votium Union bootstrap distribution identity invalid');
  return (bootstrap?.members||[]).map(m=>{
    const wallet=String(m.wallet||''),index=integer(m.index),amountRaw=integer(m.amountRaw);
    if(!m.company||!sameAddress(wallet,wallet)||index===null||amountRaw===null||m.proofValid!==true||m.claimed!==false)throw new Error(`Votium Union bootstrap member invalid ${m.registry||m.company||'unknown'}`);
    return{
      boundaryKey:`${m.company}|${lower(wallet)}|${MECHANISM}|scrvusd|${week}|${root}`,
      stateKey:`${m.company}|${lower(wallet)}|${MECHANISM}|scrvusd`,
      registry:m.registry||null,company:m.company,wallet,route:MECHANISM,protocol:'Votium + Union · vlCVX',asset:'scrvUSD',token:'0x0655977FEb2f289A4aB78af67BAB0d17aAb84367',
      distributor:DISTRIBUTOR,week,merkleRoot:root,index,amountRaw,amount:round(raw18(amountRaw),12),usdValue:null,unitUsd:null,
      proofValid:true,claimed:false,observedAt,rootEvent:null,
      source:{type:'historical-canonical-rewards-bootstrap',repository:bootstrap?.source?.repository||null,path:bootstrap?.source?.path||null,commit:bootstrap?.source?.commit||null,blobSha:bootstrap?.source?.blobSha||null,generatedAt:observedAt},
      periodIncomeAuthority:false,bootstrap:true,unknownIsNotZero:true
    };
  }).sort((a,b)=>a.stateKey.localeCompare(b.stateKey));
}

export async function findRootEvent(root,week,{fetchImpl=fetch}={}){
  const expectedRoot=lower(root),expectedWeek=String(Number(week));
  let next=null;
  for(let page=0;page<MAX_LOG_PAGES;page++){
    const payload=await fetchJson(nextUrl(next),'Blockscout Union logs',fetchImpl);
    for(const log of payload?.items||[]){
      if(decodedName(log)!=='MerkleRootUpdated')continue;
      const p=decodedParams(log);
      if(lower(p.merkleRoot)!==expectedRoot||String(Number(p.week))!==expectedWeek)continue;
      const txHash=String(log.transaction_hash||'');
      if(!/^0x[0-9a-f]{64}$/i.test(txHash)||!(Number(log.block_number)>0))throw new Error('Union root event identity incomplete');
      return{blockNumber:Number(log.block_number),transactionHash:txHash,logIndex:Number(log.index??0),publishedAt:await txTimestamp(txHash,fetchImpl),proofClass:'blockscout-decoded-onchain-MerkleRootUpdated-root-week-exact-match'};
    }
    next=payload?.next_page_params;
    if(!next)break;
  }
  return null;
}

export async function findLatestRootEvent({fetchImpl=fetch}={}){
  let next=null;
  for(let page=0;page<4;page++){
    const payload=await fetchJson(nextUrl(next),'Blockscout Union logs',fetchImpl);
    for(const log of payload?.items||[]){
      if(decodedName(log)!=='MerkleRootUpdated')continue;
      const p=decodedParams(log),root=lower(p.merkleRoot),week=Number(p.week),txHash=String(log.transaction_hash||'');
      if(!/^0x[0-9a-f]{64}$/.test(root)||!Number.isSafeInteger(week)||week<1||!/^0x[0-9a-f]{64}$/i.test(txHash)||!(Number(log.block_number)>0))continue;
      return{week,merkleRoot:root,blockNumber:Number(log.block_number),transactionHash:txHash,logIndex:Number(log.index??0),publishedAt:await txTimestamp(txHash,fetchImpl),proofClass:'blockscout-decoded-latest-MerkleRootUpdated'};
    }
    next=payload?.next_page_params;
    if(!next)break;
  }
  return null;
}

export async function proveNoInterveningClaim(previous,current,{fetchImpl=fetch}={}){
  const from=Number(previous?.rootEvent?.blockNumber),to=Number(current?.rootEvent?.blockNumber);
  if(!(from>0)||!(to>from))return{status:'unresolved-boundary-blocks',proven:false,matchedClaims:[],scannedThroughBlock:null};
  let next=null,scannedThroughBlock=null,reachedFrom=false;
  const matched=[];
  for(let page=0;page<MAX_LOG_PAGES;page++){
    const payload=await fetchJson(nextUrl(next),'Blockscout Union logs',fetchImpl);
    const items=payload?.items||[];
    for(const log of items){
      const block=Number(log.block_number);
      if(Number.isFinite(block))scannedThroughBlock=scannedThroughBlock===null?block:Math.min(scannedThroughBlock,block);
      if(block<=from){reachedFrom=true;continue;}
      if(block>=to||decodedName(log)!=='Claimed')continue;
      const p=decodedParams(log);
      if(lower(p.account)!==lower(previous.wallet)||String(Number(p.week))!==String(Number(previous.week)))continue;
      if(integer(p.index)!==String(previous.index)||integer(p.amount)!==String(previous.amountRaw))continue;
      matched.push({blockNumber:block,transactionHash:String(log.transaction_hash||''),index:integer(p.index),amountRaw:integer(p.amount),account:String(p.account||''),week:Number(p.week)});
    }
    if(reachedFrom)break;
    next=payload?.next_page_params;
    if(!next){reachedFrom=true;break;}
  }
  if(!reachedFrom)return{status:'scan-window-incomplete',proven:false,matchedClaims:matched,scannedThroughBlock};
  if(matched.length)return{status:'intervening-claim-detected',proven:false,matchedClaims:matched,scannedThroughBlock};
  return{status:'no-intervening-claim-proven',proven:true,matchedClaims:[],scannedThroughBlock};
}

function boundaryFromCurrent(state,rootEvent){
  return{
    boundaryKey:`${state.stateKey}|${state.week}|${state.merkleRoot}`,
    ...state,rootEvent,source:{type:'canonical-rewards-current-state',path:'companies/rewards-data.json',generatedAt:state.sourceGeneratedAt,version:state.sourceVersion},
    periodIncomeAuthority:false,bootstrap:false
  };
}
function latestPrior(boundaries,state){
  return boundaries.filter(x=>x.stateKey===state.stateKey&&Number(x.week)<Number(state.week)&&x.rootEvent?.blockNumber).sort((a,b)=>Number(a.week)-Number(b.week)||Number(a.rootEvent.blockNumber)-Number(b.rootEvent.blockNumber)).at(-1)||null;
}
function retainBoundaries(rows,maxPerState=260){
  const groups=new Map();for(const row of rows){if(!groups.has(row.stateKey))groups.set(row.stateKey,[]);groups.get(row.stateKey).push(row);}
  return[...groups.values()].flatMap(xs=>xs.sort((a,b)=>Number(a.week)-Number(b.week)||String(a.merkleRoot).localeCompare(String(b.merkleRoot))).slice(-maxPerState)).sort((a,b)=>a.stateKey.localeCompare(b.stateKey)||Number(a.week)-Number(b.week));
}

export async function buildVotiumUnionAccrual({rewards,bootstrap,previousExtension=null,generatedAt=new Date().toISOString(),fetchImpl=fetch}={}){
  const authority={executionAuthority:'none',walletAuthority:'none',claimingAuthority:'none',capitalExecution:false,monthClosingAuthority:false,methodologyMutationAuthority:'none'};
  const previousRows=Array.isArray(previousExtension?.boundaries)?structuredClone(previousExtension.boundaries):[];
  const byKey=new Map(previousRows.filter(x=>x?.boundaryKey).map(x=>[x.boundaryKey,x]));
  const boot=bootstrapBoundaries(bootstrap);
  const diagnostics={bootstrapBoundaryCount:boot.length,currentStateCount:0,verifiedCurrentBoundaryCount:0,latestDistributorWeek:null,upstreamFreshness:'unknown',candidateEventCount:0,zeroDeltaCount:0,reconciliationCount:0,externalEvidenceStatus:'ok',referenceAprUsed:false,unknownIsNotZero:true};
  try{
    for(const b of boot){
      if(!b.rootEvent){const e=await findRootEvent(b.merkleRoot,b.week,{fetchImpl});if(e)b.rootEvent=e;}
      if(b.rootEvent)byKey.set(b.boundaryKey,b);else diagnostics.externalEvidenceStatus='bootstrap-root-event-unresolved';
    }
    const currentStates=extractCurrentUnionStates(rewards);
    diagnostics.currentStateCount=currentStates.length;
    const latest=await findLatestRootEvent({fetchImpl});
    diagnostics.latestDistributorWeek=latest?.week??null;
    if(!latest){diagnostics.externalEvidenceStatus='latest-root-event-unresolved';diagnostics.upstreamFreshness='unknown';}
    else{
      const currentWeeks=[...new Set(currentStates.map(x=>x.week))];
      diagnostics.upstreamFreshness=currentWeeks.length&&currentWeeks.every(w=>w===latest.week)&&currentStates.every(x=>x.merkleRoot===latest.merkleRoot)?'current':'stale-or-mixed';
    }
    const candidatePayloads=[];
    if(diagnostics.upstreamFreshness==='current'){
      for(const state of currentStates){
        if(state.proofValid!==true||state.claimed===true||state.forwardingEffective!==true||state.allocationSharePct!==100){diagnostics.reconciliationCount++;continue;}
        const rootEvent=state.week===latest.week&&state.merkleRoot===latest.merkleRoot?latest:await findRootEvent(state.merkleRoot,state.week,{fetchImpl});
        if(!rootEvent){diagnostics.reconciliationCount++;continue;}
        const current=boundaryFromCurrent(state,rootEvent);
        const existing=byKey.get(current.boundaryKey);
        if(existing){diagnostics.verifiedCurrentBoundaryCount++;continue;}
        const prior=latestPrior([...byKey.values()],state);
        if(!prior){byKey.set(current.boundaryKey,current);diagnostics.verifiedCurrentBoundaryCount++;continue;}
        const continuity=await proveNoInterveningClaim(prior,current,{fetchImpl});
        current.continuityFromPrevious={previousBoundaryKey:prior.boundaryKey,status:continuity.status,proven:continuity.proven,matchedClaims:continuity.matchedClaims};
        byKey.set(current.boundaryKey,current);diagnostics.verifiedCurrentBoundaryCount++;
        if(!continuity.proven){diagnostics.reconciliationCount++;continue;}
        const deltaRaw=BigInt(current.amountRaw)-BigInt(prior.amountRaw);
        if(deltaRaw<0n){diagnostics.reconciliationCount++;continue;}
        if(deltaRaw===0n){diagnostics.zeroDeltaCount++;continue;}
        if(!(finite(current.unitUsd)&&Number(current.unitUsd)>=0)){diagnostics.reconciliationCount++;continue;}
        const amount=Number(deltaRaw)/1e18,usdValue=amount*Number(current.unitUsd);
        const sourceIdentity=`${prior.boundaryKey}->${current.boundaryKey}`;
        candidatePayloads.push({
          eventKey:`votium-union-entitlement:${lower(current.wallet)}:${current.week}:${current.merkleRoot}`,
          company:current.company,family:'accrued-entitlement',economicDate:String(current.rootEvent.publishedAt).slice(0,10),periodStart:current.rootEvent.publishedAt,periodEnd:current.rootEvent.publishedAt,
          route:MECHANISM,protocol:'Votium + Union · vlCVX',asset:current.asset||'scrvUSD',amount:round(amount,12),usdValue:round(usdValue,8),valuationUnitUsd:round(current.unitUsd,12),valuationAt:current.sourceGeneratedAt||generatedAt,
          valuationStatus:'frozen-at-first-proven-distribution-boundary',sourceFile:'companies/rewards-data.json',sourceFamily:'votium-union-rollover-positive-delta',sourceIdentity,
          evidenceStatus:'canonical-rollover-positive-delta-no-intervening-claim',distributionWeek:current.week,distributionRoot:current.merkleRoot,distributionPublishedAt:current.rootEvent.publishedAt,
          previousDistributionWeek:prior.week,previousDistributionRoot:prior.merkleRoot,previousAmountRaw:prior.amountRaw,currentAmountRaw:current.amountRaw,claimContinuityStatus:continuity.status,
          referenceAprUsed:false,currentClaimableBalanceIsPeriodIncome:false,laterClaimOrPriceMoveDoesNotRewriteIncome:true,unknownIsNotZero:true,executionAuthority:'none'
        });
      }
    }
    diagnostics.candidateEventCount=candidatePayloads.length;
    return{
      events:candidatePayloads,
      extension:{version:VERSION,status:diagnostics.reconciliationCount?'partial-reconciliation-needed':'factual-boundary-tracking',mechanism:MECHANISM,generatedAt,authority,boundaries:retainBoundaries([...byKey.values()]),diagnostics,
        semantics:{rolloverAware:true,currentLeafIsPeriodIncome:false,positiveDeltaRequiresDistinctProvenBoundaries:true,noInterveningClaimRequired:true,decreaseIsNotNegativeIncome:true,referenceAprUsed:false,laterClaimOrPriceMoveRewritesIncome:false,unknownIsNotZero:true}}
    };
  }catch(error){
    diagnostics.externalEvidenceStatus=`unavailable:${error?.message||String(error)}`;
    diagnostics.reconciliationCount++;
    return{events:[],extension:{version:VERSION,status:'partial-external-evidence-unavailable',mechanism:MECHANISM,generatedAt,authority,boundaries:retainBoundaries([...byKey.values()]),diagnostics,semantics:{rolloverAware:true,currentLeafIsPeriodIncome:false,positiveDeltaRequiresDistinctProvenBoundaries:true,noInterveningClaimRequired:true,decreaseIsNotNegativeIncome:true,referenceAprUsed:false,laterClaimOrPriceMoveRewritesIncome:false,unknownIsNotZero:true}}};
  }
}

async function main(){
  const rewards=await readJson(DEFAULT_REWARDS),bootstrap=await readJson(DEFAULT_BOOTSTRAP);
  const output=await buildVotiumUnionAccrual({rewards,bootstrap,previousExtension:null});
  await fs.writeFile(DEFAULT_OUTPUT,JSON.stringify(output,null,2)+'\n');
  console.log('VOTIUM UNION FACTUAL ACCRUAL ADAPTER',{
    status:output.extension.status,latestWeek:output.extension.diagnostics.latestDistributorWeek,upstreamFreshness:output.extension.diagnostics.upstreamFreshness,
    boundaries:output.extension.boundaries.length,candidates:output.events.length,reconciliation:output.extension.diagnostics.reconciliationCount,executionAuthority:output.extension.authority.executionAuthority
  });
}
if(process.argv[1]&&path.resolve(process.argv[1])===__filename)main().catch(error=>{console.error(error);process.exitCode=1;});
