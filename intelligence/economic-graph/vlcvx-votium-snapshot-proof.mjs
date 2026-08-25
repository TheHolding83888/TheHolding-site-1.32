#!/usr/bin/env node
import fs from 'node:fs';
import crypto from 'node:crypto';
import { Contract, JsonRpcProvider, formatUnits, getAddress } from 'ethers';

const SNAPSHOT_ENDPOINT='https://hub.snapshot.org/graphql';
const ROUND_FLOW_FILE=process.env.VLCVX_VOTIUM_ROUND_FLOW_FILE||'intelligence/economic-graph/vlcvx-votium-round-flow.json';
const OUTPUT_FILE=process.env.VLCVX_VOTIUM_SNAPSHOT_PROOF_FILE||'intelligence/economic-graph/vlcvx-votium-snapshot-proof.json';
const GENESIS_ROUND_OFFSET=1348;
const EPOCH_SECONDS=14*86400;
const PROPOSAL_WINDOW_SECONDS=3*86400;
const DIAGNOSTIC_WINDOW_SECONDS=8*86400;
const TITLE_PREFIX='Gauge Weight for Week';
const CURRENT_CURVE_GAUGE_VOTING='0x64D9B5AC386B70af9EDCD20A58cE9262D2EAC278';
const OLD_CURVE_GAUGE_VOTING='0x21F304a9DF75E087A035B4c5792bD4e6BB7AF8aF';
const PLATFORM_ABI=[
  'function proposalCount() view returns (uint256)',
  'function proposals(uint256) view returns (uint48 startTime,uint48 endTime,uint48 epoch)',
  'function voteTotals(uint256) view returns (uint256)',
  'function getGaugeCount(uint256) view returns (uint256)',
  'function getGaugeEntry(uint256,uint256) view returns (address gauge,uint256 totalWeight)'
];

function sha256File(file){return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');}
function iso(sec){return Number(sec)>0?new Date(Number(sec)*1000).toISOString():null;}
function fail(message){throw new Error(message);}
function readJson(file){return JSON.parse(fs.readFileSync(file,'utf8'));}
function roundStart(roundId){return (Number(roundId)+GENESIS_ROUND_OFFSET)*EPOCH_SECONDS;}
function rpcCandidates(){return [...new Set([process.env.ETH_RPC_URL,'https://ethereum-rpc.publicnode.com','https://eth.llamarpc.com'].filter(Boolean))];}
function rpcLabel(url){if(url===process.env.ETH_RPC_URL)return'configured-secret';try{return new URL(url).hostname;}catch{return'configured';}}
async function providerWithFallback(){let last=null;for(const url of rpcCandidates()){const provider=new JsonRpcProvider(url,1,{staticNetwork:true});try{await provider.getBlockNumber();return{provider,endpointClass:rpcLabel(url)};}catch(e){last=e;try{provider.destroy();}catch{}}}throw last||new Error('No working Ethereum RPC');}

async function snapshotGraphql(query,attempt=1){
  try{
    const response=await fetch(SNAPSHOT_ENDPOINT,{method:'POST',headers:{'content-type':'application/json','accept':'application/json'},body:JSON.stringify({query})});
    if(!response.ok)throw new Error(`Snapshot HTTP ${response.status}`);
    const json=await response.json();
    if(json.errors?.length)throw new Error(`Snapshot GraphQL ${JSON.stringify(json.errors)}`);
    return json.data;
  }catch(error){if(attempt>=4)throw error;await new Promise(resolve=>setTimeout(resolve,attempt*1500));return snapshotGraphql(query,attempt+1);}
}
async function loadRecentCvxProposals(){
  const query=`query Proposals { proposals(first: 60, skip: 0, where: { space_in: [\"cvx.eth\"] }, orderBy: \"created\", orderDirection: desc) { id title choices created start end snapshot state space { id } } }`;
  const data=await snapshotGraphql(query);if(!Array.isArray(data?.proposals))fail('Snapshot cvx.eth proposals unavailable');return data.proposals;
}
function proposalSummary(p){return{id:p.id,title:p.title,created:Number(p.created),createdAt:iso(p.created),start:Number(p.start),startAt:iso(p.start),end:Number(p.end),endAt:iso(p.end),snapshotBlock:Number(p.snapshot),state:p.state,choiceCount:Array.isArray(p.choices)?p.choices.length:0};}
function mapSnapshot(round,proposals){
  const start=roundStart(round.roundId),end=start+PROPOSAL_WINDOW_SECONDS;
  const gaugeWeight=proposals.filter(p=>String(p?.space?.id||'')==='cvx.eth'&&String(p?.title||'').startsWith(TITLE_PREFIX));
  const candidates=gaugeWeight.filter(p=>Number(p.created)>start&&Number(p.created)<end).sort((a,b)=>Number(a.created)-Number(b.created));
  const nearby=gaugeWeight.filter(p=>Math.abs(Number(p.created)-start)<=DIAGNOSTIC_WINDOW_SECONDS).sort((a,b)=>Number(a.created)-Number(b.created));
  const selected=candidates.length===1?candidates[0]:null;
  return{roundId:Number(round.roundId),roundStartUnix:start,roundStart:iso(start),candidateCount:candidates.length,mappingStatus:selected?'exact-official-window-title-match':candidates.length===0?'unresolved-no-match':'unresolved-ambiguous-match',proposal:selected?{...proposalSummary(selected),choices:selected.choices||[]}:null,nearbyGaugeWeightProposals:nearby.map(proposalSummary)};
}

async function readPlatform(provider,address,label,blockTag){
  const contract=new Contract(address,PLATFORM_ABI,provider);
  const count=Number(await contract.proposalCount({blockTag}));
  const proposals=[];
  for(let id=0;id<count;id++){
    const p=await contract.proposals(id,{blockTag});
    const [voteTotalRaw,gaugeCountRaw]=await Promise.all([contract.voteTotals(id,{blockTag}),contract.getGaugeCount(id,{blockTag})]);
    const gaugeCount=Number(gaugeCountRaw),gauges=[];
    for(let i=0;i<gaugeCount;i++){
      const row=await contract.getGaugeEntry(id,i,{blockTag});
      gauges.push({gauge:getAddress(row.gauge),totalWeightRaw:row.totalWeight.toString(),totalWeightVlCvx:Number(formatUnits(row.totalWeight,18))});
    }
    proposals.push({platformLabel:label,platformAddress:getAddress(address),proposalId:id,startTime:Number(p.startTime),startAt:iso(p.startTime),endTime:Number(p.endTime),endAt:iso(p.endTime),epoch:Number(p.epoch),voteTotalRaw:voteTotalRaw.toString(),voteTotalVlCvx:Number(formatUnits(voteTotalRaw,18)),gaugeCount,gauges});
  }
  return{label,address:getAddress(address),proposalCount:count,proposals};
}

function matchOnchain(round,platforms){
  const start=roundStart(round.roundId);
  const candidates=[];
  for(const platform of platforms)for(const p of platform.proposals){
    const delta=p.startTime-start;
    if(Math.abs(delta)<=DIAGNOSTIC_WINDOW_SECONDS)candidates.push({...p,startDeltaSeconds:delta,startDeltaDays:delta/86400});
  }
  candidates.sort((a,b)=>Math.abs(a.startDeltaSeconds)-Math.abs(b.startDeltaSeconds));
  const best=candidates[0]||null;
  let gaugeComparisons=[];
  if(best){
    const byGauge=new Map(best.gauges.map(g=>[g.gauge.toLowerCase(),g]));
    gaugeComparisons=round.gauges.map(v=>{
      const c=byGauge.get(String(v.gauge).toLowerCase());
      const onchainVl=c?.totalWeightVlCvx??null,votium=Number(v.votesReceivedContractUnits);
      return{gauge:v.gauge,votiumVotes:votium,onchainVotesVlCvx:onchainVl,deltaVlCvx:onchainVl===null?null:onchainVl-votium,ratio:onchainVl&&votium?onchainVl/votium:null};
    });
  }
  return{roundId:Number(round.roundId),roundStartUnix:start,roundStart:iso(start),candidateCount:candidates.length,bestCandidate:best?{platformLabel:best.platformLabel,platformAddress:best.platformAddress,proposalId:best.proposalId,startAt:best.startAt,endAt:best.endAt,epoch:best.epoch,voteTotalRaw:best.voteTotalRaw,voteTotalVlCvx:best.voteTotalVlCvx,gaugeCount:best.gaugeCount,startDeltaSeconds:best.startDeltaSeconds,startDeltaDays:best.startDeltaDays}:null,gaugeComparisons,nearbyCandidates:candidates.map(p=>({platformLabel:p.platformLabel,platformAddress:p.platformAddress,proposalId:p.proposalId,startAt:p.startAt,endAt:p.endAt,epoch:p.epoch,voteTotalVlCvx:p.voteTotalVlCvx,gaugeCount:p.gaugeCount,startDeltaDays:p.startDeltaDays}))};
}

async function main(){
  const roundFlow=readJson(ROUND_FLOW_FILE);if(roundFlow.version!=='0.1-vlcvx-votium-round-flow'||!Array.isArray(roundFlow.completedRounds))fail('Unexpected Votium round-flow source');
  const proposals=await loadRecentCvxProposals();
  const {provider,endpointClass}=await providerWithFallback();
  try{
    const blockTag=await provider.getBlockNumber();
    const [oldPlatform,currentPlatform]=await Promise.all([readPlatform(provider,OLD_CURVE_GAUGE_VOTING,'old-replaced-curve-gauge-voting',blockTag),readPlatform(provider,CURRENT_CURVE_GAUGE_VOTING,'current-curve-gauge-voting',blockTag)]);
    const snapshotMappings=roundFlow.completedRounds.map(r=>mapSnapshot(r,proposals));
    const onchainMappings=roundFlow.completedRounds.map(r=>matchOnchain(r,[oldPlatform,currentPlatform]));
    const state={
      version:'0.1-vlcvx-votium-snapshot-proof',engineVersion:'0.1.1-transition-aware-voting-provenance-diagnostic',generatedAt:new Date().toISOString(),status:'shadow-transition-diagnostic',
      purpose:'Diagnose the Votium/Convex gauge-voting provenance transition from legacy Snapshot to Convex onchain voting before asserting a final regime-aware mapping.',
      authority:{readOnly:true,executionAuthority:'none',capitalExecution:false,walletAuthority:false,allocationAuthority:false,recommendationAuthority:false,predictionAuthority:false,causalClaimAuthority:'none',promotionAuthority:'none',methodologyMutationAuthority:false},
      sourceBinding:{roundFlowFile:'intelligence/economic-graph/vlcvx-votium-round-flow.json',roundFlowSha256:sha256File(ROUND_FLOW_FILE),companyRegistry:'004',candidateId:'defitea-convex-vlcvx-votium'},
      officialMethodologyEvidence:{
        legacyVotium:{repository:'oo-00/Votium + oo-00/votium.js',snapshotRule:'cvx.eth Gauge Weight for Week proposal created within 72h after Votium round start'},
        convexOnchain:{repository:'convex-eth/voting',curveGaugeVoting:CURRENT_CURVE_GAUGE_VOTING,oldCurveGaugeVoting:OLD_CURVE_GAUGE_VOTING,mechanics:'GaugeVotePlatform stores raw vlCVX voteTotals/gaugeTotals; GaugeProposer creates biweekly proposals anchored to vlCVX epochs; CurveGaugeExecutor converts gauge totals to Curve basis-point weights.'}
      },
      observation:{ethereumBlock:blockTag,rpcEndpointClass:endpointClass},snapshot:{endpoint:SNAPSHOT_ENDPOINT,recentProposalCountObserved:proposals.length},snapshotMappings,onchainPlatforms:[oldPlatform,currentPlatform],onchainMappings,
      voteUnitSemantics:{legacyVotiumStatus:'source-proven-human-scale-vlcvx-voting-power',convexOnchainStatus:'source-proven-18-decimal-vlcvx-raw-weight',bridgeScaleHypothesis:'divide Convex onchain raw gaugeTotal by 1e18 then compare with Votium votesReceived; diagnostic only until exact live equality is evaluated'},
      epistemic:{regimeBoundary:'under-live-diagnostic',liveGaugeTotalEquality:'under-live-diagnostic',incentiveToVoteCausality:'not-claimed',downstreamCurveEconomicCausality:'not-claimed',companyIncomeConnection:'not-attributed-by-this-layer',primaryDriver:null},
      semantics:{unknownIsNotZero:true,missingSnapshotAfterMigrationIsNotFailureByItself:true,proposalAssociationIsNotCausation:true,protocolVotingProvenanceIsNotRealisedCompanyIncome:true}
    };
    fs.writeFileSync(OUTPUT_FILE,JSON.stringify(state,null,2)+'\n');
    console.log('VLCVX VOTIUM VOTING TRANSITION DIAGNOSTIC',JSON.stringify({block:blockTag,platforms:[oldPlatform.proposals.map(p=>({id:p.proposalId,startAt:p.startAt,endAt:p.endAt,epoch:p.epoch,votes:p.voteTotalVlCvx,gauges:p.gaugeCount})),currentPlatform.proposals.map(p=>({id:p.proposalId,startAt:p.startAt,endAt:p.endAt,epoch:p.epoch,votes:p.voteTotalVlCvx,gauges:p.gaugeCount}))],rounds:onchainMappings.map(r=>({roundId:r.roundId,roundStart:r.roundStart,best:r.bestCandidate,comparisons:r.gaugeComparisons.slice(0,8)}))},null,2));
  }finally{try{provider.destroy();}catch{}}
}
main().catch(error=>{console.error(error);process.exit(1);});
