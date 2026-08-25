#!/usr/bin/env node
/**
 * The Holding · Votium vlCVX Round Flow v0.1
 * Read-only protocol-native accounting for completed Votium v2 rounds.
 * Contract vote units remain contract-native until their scale is independently proven.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import process from 'node:process';
import { Contract, JsonRpcProvider, formatUnits, getAddress } from 'ethers';

const ROOT=process.cwd();
const GRAPH_FILE=process.env.ECONOMIC_GRAPH_FILE||path.join(ROOT,'intelligence/economic-graph/economic-graph.json');
const OUT=process.env.VLCVX_VOTIUM_ROUND_FLOW_FILE||path.join(ROOT,'intelligence/economic-graph/vlcvx-votium-round-flow.json');
const CANDIDATE_ID='defitea-convex-vlcvx-votium';
const VOTIUM_V2='0x63942E31E98f1833A234077f47880A66136a2D1e';
const ROUND_DEPTH=Math.max(2,Math.min(6,Number(process.env.VOTIUM_ROUND_DEPTH||3)));
const MAX_SAFE=BigInt(Number.MAX_SAFE_INTEGER);

const VOTIUM_ABI=[
  'function activeRound() view returns (uint256)',
  'function currentEpoch() view returns (uint256)',
  'function lastRoundProcessed() view returns (uint256)',
  'function platformFee() view returns (uint256)',
  'function DENOMINATOR() view returns (uint256)',
  'function gaugesLength(uint256 round) view returns (uint256)',
  'function roundGauges(uint256 round,uint256 index) view returns (address)',
  'function votesReceived(uint256 round,address gauge) view returns (uint256)',
  'function incentivesLength(uint256 round,address gauge) view returns (uint256)',
  'function incentives(uint256 round,address gauge,uint256 index) view returns (address token,uint256 amount,uint256 maxPerVote,uint256 distributed,uint256 recycled,address depositor)'
];
const ERC20_ABI=['function symbol() view returns (string)','function decimals() view returns (uint8)'];

const readJson=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const sha256File=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const round=(v,d=8)=>Number.isFinite(Number(v))?Number(Number(v).toFixed(d)):null;
const safeInteger=v=>BigInt(v)<=MAX_SAFE?Number(v):null;
function pct(part,whole,d=8){const p=Number(part),w=Number(whole);return Number.isFinite(p)&&Number.isFinite(w)&&w!==0?round(p/w*100,d):null;}
function isoFromSeconds(v){const n=Number(v);return Number.isFinite(n)&&n>=1_000_000_000?new Date(n*1000).toISOString():null;}

function rpcCandidates(){return [...new Set([process.env.ETH_RPC_URL,'https://ethereum-rpc.publicnode.com','https://eth.llamarpc.com'].filter(Boolean))];}
function rpcLabel(url){if(url===process.env.ETH_RPC_URL)return'configured-secret';try{return new URL(url).hostname;}catch{return'configured';}}
async function providerWithFallback(){let last=null;for(const url of rpcCandidates()){const provider=new JsonRpcProvider(url,1,{staticNetwork:true});try{await provider.getBlockNumber();return{provider,endpointClass:rpcLabel(url)};}catch(e){last=e;try{provider.destroy();}catch{}}}throw last||new Error('No working Ethereum RPC');}
async function mapLimit(values,limit,fn){const out=new Array(values.length);let cursor=0;async function worker(){while(cursor<values.length){const i=cursor++;out[i]=await fn(values[i],i);}}await Promise.all(Array.from({length:Math.min(limit,values.length)},worker));return out;}

function requireCandidate(graph){
  const layer=graph?.candidateLayer,candidate=graph?.candidateCohorts?.[CANDIDATE_ID],obs=candidate?.latest?.observation;
  if(layer?.status!=='shadow-admission-active'||layer?.promotionAuthority!=='none')throw new Error('Votium round flow requires active shadow candidate layer with no promotion authority');
  if(!Array.isArray(layer?.candidateIds)||!layer.candidateIds.includes(CANDIDATE_ID))throw new Error('Defitea vlCVX/Votium candidate is not admitted');
  if(candidate?.status!=='shadow-measured-not-promoted'||!obs)throw new Error('Defitea vlCVX/Votium shadow observation missing');
  if(obs?.companyRoute?.routeId!=='votium-union'||obs?.companyRoute?.delegate?.identity!=='votium')throw new Error('Defitea current vlCVX route is not proven Votium');
  if(obs?.epistemic?.promotionAuthority!=='none'||obs?.epistemic?.primaryDriver!==null)throw new Error('vlCVX candidate authority boundary drift');
  return obs;
}

const tokenMetaCache=new Map();
async function tokenMeta(provider,address,blockTag){
  const token=getAddress(address),key=token.toLowerCase();if(tokenMetaCache.has(key))return tokenMetaCache.get(key);
  const c=new Contract(token,ERC20_ABI,provider);
  const [symbol,decimalsRaw]=await Promise.all([c.symbol({blockTag}).catch(()=>null),c.decimals({blockTag}).catch(()=>18)]);
  const meta={address:token,symbol:symbol?String(symbol):null,decimals:Number(decimalsRaw),metadataClass:symbol?'onchain-erc20':'address-only-decimals-fallback'};
  tokenMetaCache.set(key,meta);return meta;
}

function aggregateTokenFlows(gauges){
  const map=new Map();
  for(const gauge of gauges)for(const row of gauge.incentives){const key=row.token.address.toLowerCase(),x=map.get(key)||{token:row.token,count:0,amount:0n,distributed:0n,recycled:0n};x.count++;x.amount+=BigInt(row.contractAmountRaw);x.distributed+=BigInt(row.distributedRaw);x.recycled+=BigInt(row.recycledRaw);map.set(key,x);}
  return [...map.values()].map(x=>({
    token:x.token,incentiveCount:x.count,
    contractAmountRaw:x.amount.toString(),contractAmount:round(Number(formatUnits(x.amount,x.token.decimals)),12),
    distributedRaw:x.distributed.toString(),distributed:round(Number(formatUnits(x.distributed,x.token.decimals)),12),
    recycledRaw:x.recycled.toString(),recycled:round(Number(formatUnits(x.recycled,x.token.decimals)),12),
    usdValue:null,usdValuationClass:'unknown-not-priced-by-v0.1'
  })).sort((a,b)=>(a.token.symbol||a.token.address).localeCompare(b.token.symbol||b.token.address));
}

async function readGauge(votium,provider,roundId,gauge,blockTag){
  const address=getAddress(gauge);
  const [votesRaw,lenRaw]=await Promise.all([votium.votesReceived(roundId,address,{blockTag}),votium.incentivesLength(roundId,address,{blockTag})]);
  const indices=Array.from({length:Math.min(Number(lenRaw),256)},(_,i)=>i);
  const incentives=await mapLimit(indices,8,async index=>{
    const row=await votium.incentives(roundId,address,index,{blockTag}),token=await tokenMeta(provider,row.token,blockTag);
    return{index,token,contractAmountRaw:row.amount.toString(),contractAmount:round(Number(formatUnits(row.amount,token.decimals)),12),maxPerVoteRaw:row.maxPerVote.toString(),distributedRaw:row.distributed.toString(),distributed:round(Number(formatUnits(row.distributed,token.decimals)),12),recycledRaw:row.recycled.toString(),recycled:round(Number(formatUnits(row.recycled,token.decimals)),12),depositor:getAddress(row.depositor),semanticClass:'measured-votium-v2-incentive-accounting-state'};
  });
  return{gauge:address,votesReceivedRaw:votesRaw.toString(),votesReceivedContractUnits:safeInteger(votesRaw),voteUnitClass:'contract-native-scale-unresolved',incentiveCount:incentives.length,incentives};
}

async function readRound(votium,provider,roundId,blockTag){
  const gaugeCount=Math.min(Number(await votium.gaugesLength(roundId,{blockTag})),1024);
  const addresses=await mapLimit(Array.from({length:gaugeCount},(_,i)=>i),12,async i=>getAddress(await votium.roundGauges(roundId,i,{blockTag})));
  const gauges=await mapLimit(addresses,6,gauge=>readGauge(votium,provider,roundId,gauge,blockTag));
  const totalRaw=gauges.reduce((sum,row)=>sum+BigInt(row.votesReceivedRaw),0n);
  for(const row of gauges)row.voteSharePct=pct(BigInt(row.votesReceivedRaw),totalRaw,8);
  const tokenFlows=aggregateTokenFlows(gauges);
  return{
    roundId,status:'completed-processed',gaugeCount:gauges.length,incentiveCount:gauges.reduce((s,x)=>s+x.incentiveCount,0),
    totalVotesReceivedRaw:totalRaw.toString(),totalVotesReceivedContractUnits:safeInteger(totalRaw),voteUnitClass:'contract-native-scale-unresolved',
    gauges,tokenFlows,
    usdTotals:{knownUsd:null,pricedTokenCount:0,totalTokenCount:tokenFlows.length,complete:false,semanticClass:'unknown-not-priced-by-v0.1'},
    epistemic:{incentives:'measured-votium-v2-contract-accounting',votesReceived:'measured-votium-v2-contract-accounting-unit-scale-unresolved',voteUnitSemantics:'contract-native-unit-scale-unresolved',incentiveToVoteRelationship:'descriptive-same-round-coexistence-only',causalAttribution:'unresolved',primaryDriver:null}
  };
}

function compareRounds(current,prior){
  if(!prior)return{priorRoundId:null,comparable:false};
  const previous=new Map(prior.gauges.map(x=>[x.gauge.toLowerCase(),x])),currentSet=new Set(current.gauges.map(x=>x.gauge.toLowerCase()));
  const gaugeVoteShareChanges=current.gauges.map(x=>{const p=previous.get(x.gauge.toLowerCase());return{gauge:x.gauge,priorVoteSharePct:p?.voteSharePct??null,currentVoteSharePct:x.voteSharePct,deltaPctPoints:p?round(x.voteSharePct-p.voteSharePct,8):null,state:p?'continued':'new-in-round'};});
  for(const x of prior.gauges)if(!currentSet.has(x.gauge.toLowerCase()))gaugeVoteShareChanges.push({gauge:x.gauge,priorVoteSharePct:x.voteSharePct,currentVoteSharePct:0,deltaPctPoints:round(-Number(x.voteSharePct||0),8),state:'absent-in-current-round'});
  const c=current.totalVotesReceivedContractUnits,p=prior.totalVotesReceivedContractUnits;
  return{priorRoundId:prior.roundId,comparable:true,gaugeCountDelta:current.gaugeCount-prior.gaugeCount,incentiveCountDelta:current.incentiveCount-prior.incentiveCount,totalVotesReceivedContractUnitsDelta:Number.isSafeInteger(c)&&Number.isSafeInteger(p)?c-p:null,gaugeVoteShareChanges,rule:'Round-to-round movement is descriptive. Contract vote-unit scale is unresolved; no vlCVX amount or incentive→vote→Curve causality is inferred.'};
}

async function buildState(){
  const graph=readJson(GRAPH_FILE),candidateObs=requireCandidate(graph),{provider,endpointClass}=await providerWithFallback();
  try{
    const blockNumber=await provider.getBlockNumber(),block=await provider.getBlock(blockNumber);if(!block)throw new Error(`Ethereum block ${blockNumber} unavailable`);
    const blockTag=blockNumber,votium=new Contract(VOTIUM_V2,VOTIUM_ABI,provider);
    const [activeRoundRaw,currentEpochRaw,lastProcessedRaw,platformFeeRaw,denominatorRaw]=await Promise.all([votium.activeRound({blockTag}),votium.currentEpoch({blockTag}),votium.lastRoundProcessed({blockTag}),votium.platformFee({blockTag}),votium.DENOMINATOR({blockTag})]);
    const activeRound=Number(activeRoundRaw),lastRoundProcessed=Number(lastProcessedRaw),denominator=Number(denominatorRaw);if(!Number.isSafeInteger(lastRoundProcessed)||lastRoundProcessed<1)throw new Error('Votium lastRoundProcessed unavailable');
    const start=Math.max(1,lastRoundProcessed-ROUND_DEPTH+1),completedRounds=[];
    for(let id=start;id<=lastRoundProcessed;id++)completedRounds.push(await readRound(votium,provider,id,blockTag));
    const latest=completedRounds.at(-1),comparisons=completedRounds.map((x,i)=>compareRounds(x,completedRounds[i-1]||null));
    return{
      version:'0.1-vlcvx-votium-round-flow',engineVersion:'0.1.1-votium-v2-contract-unit-safe-round-accounting',generatedAt:new Date().toISOString(),status:'shadow-measured-not-promoted',
      purpose:'Measure completed Votium vlCVX round incentive accounting and contract-native vote totals directly from Votium v2, without assuming vote-unit scale or causal/execution authority.',
      authority:{readOnly:true,executionAuthority:'none',capitalExecution:false,walletAuthority:false,allocationAuthority:false,recommendationAuthority:false,predictionAuthority:false,causalClaimAuthority:'none',promotionAuthority:'none',methodologyMutationAuthority:false},
      sourceBinding:{economicGraphFile:'intelligence/economic-graph/economic-graph.json',economicGraphSha256:sha256File(GRAPH_FILE),candidateId:CANDIDATE_ID,candidateObservationId:candidateObs.id,companyRegistry:'004',currentRouteId:candidateObs.companyRoute.routeId},
      protocol:{name:'Votium',version:'v2',chain:'Ethereum',contract:VOTIUM_V2,contractAuthority:'official-votium-documented-v2-address-and-verified-contract-interface',observationBlock:blockNumber,observationBlockHash:block.hash,observedAt:new Date(Number(block.timestamp)*1000).toISOString(),rpcEndpointClass:endpointClass,sameBlockRead:true},
      roundState:{activeRound,currentEpochRaw:currentEpochRaw.toString(),currentEpoch:isoFromSeconds(currentEpochRaw),lastRoundProcessed,platformFeeRaw:platformFeeRaw.toString(),denominatorRaw:denominatorRaw.toString(),platformFeePct:denominator>0?round(Number(platformFeeRaw)/denominator*100,8):null},
      coverage:{requestedCompletedRounds:ROUND_DEPTH,measuredCompletedRounds:completedRounds.length,firstRound:completedRounds[0]?.roundId??null,lastRound:latest?.roundId??null,latestProcessedRoundIncluded:latest?.roundId===lastRoundProcessed},
      completedRounds,comparisons,latestCompletedRound:latest,
      marketBreath:{measuredAtoms:['Votium processed round identity','round gauges','contract-native votesReceived by gauge','incentive token/accounting rows','distributed/recycled accounting','round-to-round gauge vote-share migration'],missingAtoms:['proven Votium vote-unit scale / Snapshot score mapping','historical USD valuation at round settlement','Convex Snapshot proposal choice identity mapping','Curve gauge emission response','downstream pool liquidity/volume/fee response','proven incentive→vote causal attribution'],nextUnlock:'Prove vote-unit semantics and historical valuation/proposal identity, then join round movement to Curve gauge and pool economics without causal overclaim.'},
      epistemic:{roundAccounting:'measured-protocol-native-contract-state',voteUnitSemantics:'contract-native-unit-scale-unresolved',usdValuation:'unknown-in-v0.1',companyIncomeConnection:'not-attributed-by-this-layer',referenceAprConnection:'context-only-not-reconstructed-by-this-layer',causalAttribution:'unresolved-between-incentives-votes-gauge-emissions-pool-economics-and-company-outcome',primaryDriver:null,recommendationAuthority:'none',predictionAuthority:'none',promotionAuthority:'none'},
      semantics:{unknownIsNotZero:true,contractAccountingIsNotUsdValuation:true,voteUnitScaleUnresolved:true,incentiveAndVoteCoexistenceIsNotCausation:true,protocolRoundFlowIsNotRealisedCompanyIncome:true,candidateNotCanonical:true}
    };
  }finally{try{provider.destroy();}catch{}}
}

async function main(){const state=await buildState();fs.mkdirSync(path.dirname(OUT),{recursive:true});fs.writeFileSync(OUT,JSON.stringify(state,null,2)+'\n');console.log('VLCVX VOTIUM ROUND FLOW PASS',{generatedAt:state.generatedAt,block:state.protocol.observationBlock,activeRound:state.roundState.activeRound,lastRoundProcessed:state.roundState.lastRoundProcessed,measuredRounds:state.coverage.measuredCompletedRounds,latestGaugeCount:state.latestCompletedRound.gaugeCount,latestIncentiveCount:state.latestCompletedRound.incentiveCount,latestVotesContractUnits:state.latestCompletedRound.totalVotesReceivedContractUnits,voteUnitSemantics:state.epistemic.voteUnitSemantics,primaryDriver:state.epistemic.primaryDriver,promotionAuthority:state.authority.promotionAuthority,executionAuthority:state.authority.executionAuthority});}
if(path.resolve(process.argv[1]||'')===path.resolve(new URL(import.meta.url).pathname))main().catch(error=>{console.error(error?.stack||error);process.exit(1);});
export{buildState};
