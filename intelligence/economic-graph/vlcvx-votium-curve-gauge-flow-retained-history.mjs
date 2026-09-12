#!/usr/bin/env node
/**
 * The Holding · Votium → Curve Gauge Flow retained-history fallback
 *
 * Used only when fresh historical GaugeVoteExecuted reconstruction is unavailable.
 * Reuses immutable execution evidence from the last fully proven canonical artifact,
 * then revalidates current finalized proposal/executor state, gauge mechanics and every
 * event-only zero gauge live before emitting a newly SHA-bound artifact.
 */
import fs from 'node:fs';
import crypto from 'node:crypto';
import { Contract, JsonRpcProvider, getAddress } from 'ethers';

const ROUND_FLOW_FILE=process.env.VLCVX_VOTIUM_ROUND_FLOW_FILE||'intelligence/economic-graph/vlcvx-votium-round-flow.json';
const PROVENANCE_FILE=process.env.VLCVX_VOTIUM_VOTING_PROVENANCE_FILE||'intelligence/economic-graph/vlcvx-votium-snapshot-proof.json';
const OUTPUT_FILE=process.env.VLCVX_VOTIUM_CURVE_GAUGE_FLOW_FILE||'intelligence/economic-graph/vlcvx-votium-curve-gauge-flow.json';
const PRIOR_FILE=process.env.VLCVX_VOTIUM_CURVE_GAUGE_FLOW_PRIOR_FILE||'intelligence/economic-graph/vlcvx-votium-curve-gauge-flow.json';
const CURVE_GAUGE_VOTING='0x64D9B5AC386B70af9EDCD20A58cE9262D2EAC278';
const CURVE_GAUGE_EXECUTOR='0x399382E82D9b6362ccAbd1f3C763bEE93E80c9e8';
const CONVEX_SOURCE_SHA='242b592718ff939e0a15e490a7df9730267f0999';
const WEIGHT_BPS=10000n;

const PLATFORM_ABI=[
  'function proposals(uint256) view returns (uint48 startTime,uint48 endTime,uint48 epoch)',
  'function voteTotals(uint256) view returns (uint256)',
  'function getGaugeCount(uint256) view returns (uint256)',
  'function getGaugeEntry(uint256,uint256) view returns (address gauge,uint256 totalWeight)',
  'function gaugeTotal(uint256,address) view returns (uint256)',
  'function isFinalized(uint256) view returns (bool)'
];
const EXECUTOR_ABI=[
  'function submittedGaugeCount(uint256) view returns (uint256)',
  'function submittedWeight(uint256) view returns (uint256)',
  'function isDone(uint256) view returns (bool)'
];

function readJson(file){return JSON.parse(fs.readFileSync(file,'utf8'));}
function sha256File(file){return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');}
function iso(sec){return new Date(Number(sec)*1000).toISOString();}
function round(v,d=8){return Number.isFinite(Number(v))?Number(Number(v).toFixed(d)):null;}
function pct(a,b,d=6){return b?round(Number(a)/Number(b)*100,d):null;}
function fail(message){throw new Error(message);}
function unique(values){return [...new Set(values.filter(Boolean))];}
function stateRpcCandidates(){return unique([process.env.ETH_RPC_URL,'https://ethereum-rpc.publicnode.com','https://eth.llamarpc.com','https://1rpc.io/eth','https://eth.drpc.org']);}
function rpcLabel(url){if(url===process.env.ETH_RPC_URL)return'configured-secret';try{return new URL(url).hostname;}catch{return'configured';}}
function makeProvider(url){return new JsonRpcProvider(url,1,{staticNetwork:true,batchMaxCount:1});}
function validTx(v){return /^0x[0-9a-f]{64}$/i.test(String(v||''));}
function validAddress(v){return /^0x[0-9a-f]{40}$/i.test(String(v||''));}

function requireUpstreams(roundFlow,provenance){
  if(roundFlow.version!=='0.1-vlcvx-votium-round-flow'||roundFlow.status!=='shadow-measured-not-promoted')fail('Votium round-flow upstream unavailable');
  if(provenance.version!=='0.2-vlcvx-votium-voting-provenance'||provenance.status!=='shadow-voting-provenance-proven')fail('Votium voting provenance upstream unavailable');
  if(provenance.coverage?.complete!==true||provenance.transition?.boundaryStatus!=='live-cross-source-proven')fail('Votium voting provenance incomplete');
  if(provenance.voteUnitSemantics?.status!=='proven-human-scale-vlcvx-voting-power')fail('Votium vote-unit meaning not proven');
  if(String(provenance.sourceAuthority?.convexOnchain?.currentCurveGaugeVoting||'').toLowerCase()!==CURVE_GAUGE_VOTING.toLowerCase())fail('Convex current Curve GaugeVotePlatform drift');
}

function requirePrior(prior,proposalIds,roundIds){
  if(prior.version!=='0.1-vlcvx-votium-curve-gauge-flow'||prior.engineVersion!=='0.1-votium-convex-curve-execution-bridge')fail('Prior Gauge Flow identity mismatch');
  if(prior.status!=='shadow-cross-protocol-flow-proven'||prior.coverage?.complete!==true)fail('Prior Gauge Flow is not fully proven');
  if(prior.authority?.readOnly!==true||prior.authority?.executionAuthority!=='none'||prior.authority?.causalClaimAuthority!=='none')fail('Prior Gauge Flow authority boundary invalid');
  if(String(prior.protocolBridge?.convexCurveGaugeVoting||'').toLowerCase()!==CURVE_GAUGE_VOTING.toLowerCase())fail('Prior GaugeVotePlatform contract drift');
  if(String(prior.protocolBridge?.convexCurveGaugeExecutor||'').toLowerCase()!==CURVE_GAUGE_EXECUTOR.toLowerCase())fail('Prior GaugeExecutor contract drift');
  if(prior.protocolBridge?.convexSourceCommit!==CONVEX_SOURCE_SHA)fail('Prior Convex source pin drift');
  const priorRounds=prior.rounds||[];
  if(priorRounds.map(r=>Number(r.roundId)).join(',')!==roundIds.join(','))fail('Prior Gauge Flow round identity mismatch');
  if(priorRounds.map(r=>Number(r.proposalId)).join(',')!==proposalIds.join(','))fail('Prior Gauge Flow proposal identity mismatch');
  for(const r of priorRounds){
    if(r.coverage?.complete!==true||r.coverage?.platformGaugeExecutionComplete!==true||r.coverage?.eventOnlyAllZero!==true)fail(`Prior round ${r.roundId} incomplete`);
    if(r.curveExecutor?.isDone!==true||Number(r.curveExecutor?.submittedWeightBps)!==10000||Number(r.curveExecutor?.eventOnlyPositiveGaugeCount)!==0||Number(r.curveExecutor?.duplicateEventGaugeRows)!==0)fail(`Prior round ${r.roundId} executor proof incomplete`);
    if(r.curveExecutor?.roundingProof?.complete!==true)fail(`Prior round ${r.roundId} rounding proof incomplete`);
    for(const g of r.gauges||[]){
      if(!validAddress(g.gauge)||!validTx(g.curveExecutionTxHash)||!Number.isInteger(Number(g.curveExecutionBlock))||!Number.isInteger(Number(g.curveExecutedWeightBps)))fail(`Prior round ${r.roundId} retained execution provenance invalid`);
    }
    for(const g of r.curveExecutor?.eventOnlyGaugeProof||[]){
      if(!validAddress(g.gauge)||Number(g.executedWeightBps)!==0||String(g.gaugeTotalRaw)!=='0'||g.gaugeTotalIsZero!==true)fail(`Prior round ${r.roundId} event-only proof invalid`);
    }
  }
}

async function selectStateProvider(proposalId){
  let last=null;
  for(const url of stateRpcCandidates()){
    const provider=makeProvider(url);
    try{
      const block=await provider.getBlock('latest');
      if(!block)throw new Error('Latest Ethereum block unavailable');
      const platform=new Contract(CURVE_GAUGE_VOTING,PLATFORM_ABI,provider);
      const executor=new Contract(CURVE_GAUGE_EXECUTOR,EXECUTOR_ABI,provider);
      await platform.proposals(proposalId);await executor.isDone(proposalId);
      return{provider,block,endpointClass:rpcLabel(url)};
    }catch(e){last=e;try{provider.destroy();}catch{}}
  }
  throw last||new Error('No Ethereum RPC with current Convex/Curve state capability');
}

async function readProposalState(platform,executor,proposalId){
  const p=await platform.proposals(proposalId),voteTotalRaw=await platform.voteTotals(proposalId),gaugeCountRaw=await platform.getGaugeCount(proposalId),finalized=await platform.isFinalized(proposalId);
  const submittedCountRaw=await executor.submittedGaugeCount(proposalId),submittedWeightRaw=await executor.submittedWeight(proposalId),done=await executor.isDone(proposalId);
  const gaugeCount=Number(gaugeCountRaw),gauges=[];
  for(let i=0;i<gaugeCount;i++){
    const entry=await platform.getGaugeEntry(proposalId,i),raw=BigInt(entry.totalWeight);
    gauges.push({gauge:getAddress(entry.gauge),gaugeTotalRaw:raw.toString(),mechanicalWeightBps:Number(raw*WEIGHT_BPS/BigInt(voteTotalRaw))});
  }
  if(new Set(gauges.map(g=>g.gauge.toLowerCase())).size!==gaugeCount)fail(`Proposal ${proposalId} contains duplicate current gauge entries`);
  return{proposalId,startTime:Number(p.startTime),startAt:iso(p.startTime),endTime:Number(p.endTime),endAt:iso(p.endTime),epoch:Number(p.epoch),finalized:Boolean(finalized),voteTotalRaw:voteTotalRaw.toString(),gaugeCount,gauges,executor:{submittedGaugeCount:Number(submittedCountRaw),submittedWeightBps:Number(submittedWeightRaw),isDone:Boolean(done)}};
}

async function rebuildRound({platform,current,priorRound,sourceRound,provenanceRound}){
  if(current.startAt!==provenanceRound.roundStart)fail(`Round ${provenanceRound.roundId} proposal start drift`);
  if(current.finalized!==true||current.executor.isDone!==true||current.executor.submittedWeightBps!==10000)fail(`Round ${provenanceRound.roundId} current proposal/executor not finalized`);
  if(current.gaugeCount!==Number(priorRound.curveExecutor.submittedGaugeCount)||current.executor.submittedGaugeCount!==current.gaugeCount)fail(`Round ${provenanceRound.roundId} submitted gauge count drift`);
  if(Number(priorRound.curveExecutor.submittedWeightBps)!==current.executor.submittedWeightBps)fail(`Round ${provenanceRound.roundId} submitted BPS drift`);

  const currentByGauge=new Map(current.gauges.map(g=>[g.gauge.toLowerCase(),g]));
  const priorByGauge=new Map((priorRound.gauges||[]).map(g=>[String(g.gauge).toLowerCase(),g]));
  const gauges=(sourceRound.gauges||[]).map(g=>{
    const key=String(g.gauge).toLowerCase(),now=currentByGauge.get(key),old=priorByGauge.get(key);
    if(!now||!old)fail(`Round ${provenanceRound.roundId} retained Votium gauge ${g.gauge} missing from current/prior proof`);
    if(String(old.convexGaugeTotalRaw)!==String(now.gaugeTotalRaw)||Number(old.curveMechanicalWeightBps)!==Number(now.mechanicalWeightBps))fail(`Round ${provenanceRound.roundId} retained gauge mechanics drift for ${g.gauge}`);
    if(!validTx(old.curveExecutionTxHash)||!Number.isInteger(Number(old.curveExecutionBlock))||!Number.isInteger(Number(old.curveExecutedWeightBps))||Number(old.curveExecutedWeightBps)<0)fail(`Round ${provenanceRound.roundId} retained execution evidence invalid for ${g.gauge}`);
    return{
      gauge:g.gauge,incentiveCount:Number(g.incentiveCount),
      incentiveTokens:g.incentives.map(i=>({token:i.token,contractAmountRaw:i.contractAmountRaw,contractAmount:i.contractAmount,distributedRaw:i.distributedRaw,distributed:i.distributed,recycledRaw:i.recycledRaw,recycled:i.recycled,depositor:i.depositor})),
      votiumVotesReceived:Number(g.votesReceivedContractUnits),votiumVoteSharePct:g.voteSharePct,
      convexGaugeTotalRaw:now.gaugeTotalRaw,curveMechanicalWeightBps:now.mechanicalWeightBps,curveExecutedWeightBps:Number(old.curveExecutedWeightBps),curveMechanicalDeltaBps:Number(old.curveExecutedWeightBps)-Number(now.mechanicalWeightBps),curveExecutionTxHash:old.curveExecutionTxHash,curveExecutionBlock:Number(old.curveExecutionBlock),
      semantics:{incentives:'MEASURED-votium-contract',votes:'MEASURED-votium-and-cross-contract-provenance',voteToCurveWeight:'ATTRIBUTED-mechanical-and-retained-canonical-execution-event',incentiveToVote:'CORRELATED-same-round-only-not-causal'}
    };
  });

  const freshEventOnly=[];
  for(const old of priorRound.curveExecutor?.eventOnlyGaugeProof||[]){
    const raw=BigInt(await platform.gaugeTotal(current.proposalId,old.gauge));
    freshEventOnly.push({gauge:getAddress(old.gauge),executedWeightBps:0,gaugeTotalRaw:raw.toString(),gaugeTotalIsZero:raw===0n,retainedPriorZeroProof:true});
  }
  if(!freshEventOnly.every(x=>x.gaugeTotalIsZero===true))fail(`Round ${provenanceRound.roundId} event-only zero proof drift`);

  const mechanicalWeightSum=current.gauges.reduce((s,g)=>s+Number(g.mechanicalWeightBps),0),residualBps=10000-mechanicalWeightSum;
  const oldRounding=priorRound.curveExecutor?.roundingProof||{};
  if(Number(oldRounding.mechanicalWeightSumBps)!==mechanicalWeightSum||Number(oldRounding.residualBps)!==residualBps||oldRounding.complete!==true)fail(`Round ${provenanceRound.roundId} retained rounding mechanics drift`);
  const curveExecutedCount=gauges.filter(g=>Number.isInteger(g.curveExecutedWeightBps)).length;
  const complete=curveExecutedCount===gauges.length&&freshEventOnly.every(x=>x.gaugeTotalIsZero)&&Number(priorRound.curveExecutor.eventOnlyPositiveGaugeCount)===0&&Number(priorRound.curveExecutor.duplicateEventGaugeRows)===0;
  return{
    roundId:Number(sourceRound.roundId),roundStart:provenanceRound.roundStart,regime:provenanceRound.regime,proposalId:current.proposalId,
    incentiveCount:Number(sourceRound.incentiveCount),tokenFlows:sourceRound.tokenFlows,totalVotiumVotesReceived:Number(sourceRound.totalVotesReceivedContractUnits),
    curveExecutor:{...priorRound.curveExecutor,isDone:current.executor.isDone,submittedGaugeCount:current.executor.submittedGaugeCount,submittedWeightBps:current.executor.submittedWeightBps,eventOnlyGaugeProof:freshEventOnly,roundingProof:{...oldRounding,mechanicalWeightSumBps:mechanicalWeightSum,residualBps},historicalExecutionEvidenceMode:'retained-last-verified-canonical-events',currentStateRevalidated:true},
    coverage:{votiumIncentivizedGaugeCount:gauges.length,curveExecutedForVotiumGaugeCount:curveExecutedCount,curveExecutedForVotiumGaugePct:pct(curveExecutedCount,gauges.length),platformGaugeExecutionComplete:complete,eventOnlyAllZero:freshEventOnly.every(x=>x.gaugeTotalIsZero),complete},
    gauges,
    epistemic:{incentiveState:'measured',votingPower:'measured-and-cross-contract-proven',curveWeightMechanics:'attributed-by-source-formula',curveExecution:'measured-by-retained-last-verified-GaugeVoteExecuted-evidence-with-live-state-revalidation',eventOnlyGaugeMeaning:'source-and-live-proven-zero-vote-zero-bps-rows',incentiveToVoteCausality:'unresolved',downstreamLiquidityVolumeFeeEffect:'not-yet-measured-by-v0.1',primaryDriver:null}
  };
}

async function main(){
  const roundFlow=readJson(ROUND_FLOW_FILE),provenance=readJson(PROVENANCE_FILE),prior=readJson(PRIOR_FILE);requireUpstreams(roundFlow,provenance);
  const postMigration=provenance.rounds.filter(r=>r.regime==='convex-onchain'&&r.status==='proven');
  if(postMigration.length!==2)fail(`Retained fallback requires exact two proven post-migration rounds, got ${postMigration.length}`);
  const roundIds=postMigration.map(r=>Number(r.roundId)),proposalIds=postMigration.map(r=>Number(r.currentOnchainProposal?.proposalId));
  if(proposalIds.some(id=>!Number.isInteger(id)))fail('Post-migration proposal id missing');
  requirePrior(prior,proposalIds,roundIds);
  const roundById=new Map((roundFlow.completedRounds||[]).map(r=>[Number(r.roundId),r]));
  const priorByRound=new Map((prior.rounds||[]).map(r=>[Number(r.roundId),r]));
  const retainedArtifactSha256=sha256File(PRIOR_FILE);
  const {provider,block,endpointClass}=await selectStateProvider(proposalIds[0]);
  try{
    const platform=new Contract(CURVE_GAUGE_VOTING,PLATFORM_ABI,provider),executor=new Contract(CURVE_GAUGE_EXECUTOR,EXECUTOR_ABI,provider),rounds=[];
    for(let i=0;i<postMigration.length;i++){
      const current=await readProposalState(platform,executor,proposalIds[i]);
      const sourceRound=roundById.get(roundIds[i]),priorRound=priorByRound.get(roundIds[i]);
      if(!sourceRound||!priorRound)fail(`Round ${roundIds[i]} missing from source/prior evidence`);
      rounds.push(await rebuildRound({platform,current,priorRound,sourceRound,provenanceRound:postMigration[i]}));
    }
    const complete=rounds.every(r=>r.coverage.complete);
    if(!complete)fail('Retained historical fallback did not revalidate complete execution coverage');
    const state={
      version:'0.1-vlcvx-votium-curve-gauge-flow',engineVersion:'0.1-votium-convex-curve-execution-bridge',generatedAt:new Date().toISOString(),status:'shadow-cross-protocol-flow-proven',
      purpose:'Connect Votium incentive accounting and proven vlCVX voting power to Convex GaugeVotePlatform and actually executed Curve gauge BPS weights, without claiming incentives caused votes or downstream pool economics.',
      authority:{readOnly:true,executionAuthority:'none',capitalExecution:false,walletAuthority:false,allocationAuthority:false,recommendationAuthority:false,predictionAuthority:false,causalClaimAuthority:'none',promotionAuthority:'none',methodologyMutationAuthority:false},
      sourceBinding:{roundFlowFile:'intelligence/economic-graph/vlcvx-votium-round-flow.json',roundFlowSha256:sha256File(ROUND_FLOW_FILE),votingProvenanceFile:'intelligence/economic-graph/vlcvx-votium-snapshot-proof.json',votingProvenanceSha256:sha256File(PROVENANCE_FILE),companyRegistry:'004',candidateId:'defitea-convex-vlcvx-votium',retainedHistoricalArtifactFile:'intelligence/economic-graph/vlcvx-votium-curve-gauge-flow.json',retainedHistoricalArtifactSha256:retainedArtifactSha256,retainedHistoricalGeneratedAt:prior.generatedAt},
      protocolBridge:{...prior.protocolBridge,convexCurveGaugeVoting:CURVE_GAUGE_VOTING,convexCurveGaugeExecutor:CURVE_GAUGE_EXECUTOR,convexSourceCommit:CONVEX_SOURCE_SHA},
      observation:{ethereumBlock:Number(block.number),ethereumBlockHash:block.hash,observedAt:iso(block.timestamp),rpcArchitecture:'split-current-state-and-historical-log-lanes',stateRpcEndpointClass:endpointClass,historicalLogRpcEndpointClassesUsed:[],retainedHistoricalLogRpcEndpointClasses:prior.observation?.historicalLogRpcEndpointClassesUsed||[],historicalLogScan:{...prior.observation?.historicalLogScan,evidenceMode:'retained-last-verified-canonical-events',retainedArtifactSha256,retainedGeneratedAt:prior.generatedAt,freshRefreshAttempted:true,freshRefreshStatus:'unavailable-fell-back-to-retained-canonical',freshRefreshFailureRecorded:true,currentProposalStateRevalidated:true,eventOnlyZeroStateRevalidated:true,complete:true},rpcBatching:'disabled-for-public-endpoint-compatibility',stateReadMode:'latest-persistent-finalized-proposal-state',historicalStateReadsRequired:false,historicalExecutionEvidence:'retained-last-verified-canonical-GaugeVoteExecuted-evidence'},
      coverage:{roundCount:rounds.length,completeRoundCount:rounds.filter(r=>r.coverage.complete).length,votiumGaugeCount:rounds.reduce((s,r)=>s+r.coverage.votiumIncentivizedGaugeCount,0),curveExecutedVotiumGaugeCount:rounds.reduce((s,r)=>s+r.coverage.curveExecutedForVotiumGaugeCount,0),eventOnlyGaugeCount:rounds.reduce((s,r)=>s+Number(r.curveExecutor.eventOnlyGaugeCount||0),0),eventOnlyPositiveGaugeCount:rounds.reduce((s,r)=>s+Number(r.curveExecutor.eventOnlyPositiveGaugeCount||0),0),complete:true},
      rounds,
      epistemic:{votiumIncentives:'MEASURED',votiumVotes:'MEASURED',convexToCurveWeightMechanics:'ATTRIBUTED',curveGaugeExecution:'MEASURED-retained-canonical-event-evidence-live-revalidated',executorEventExtraRows:'ATTRIBUTED-by-pinned-source-and-live-zero-total-proof',incentiveToVoteRelationship:'CORRELATED-only-not-causal',voteToExecutedCurveWeightRelationship:'ATTRIBUTED-and-execution-confirmed',liquidityVolumeFeesDownstream:'UNKNOWN-not-yet-joined',companyIncomeConnection:'not-attributed-by-this-layer',primaryDriver:null},
      semantics:{unknownIsNotZero:true,incentiveAndVoteCoexistenceIsNotCausation:true,zeroVoteExecutorEventRowsAreNotVotedGauges:true,executedGaugeWeightIsNotPoolRevenue:true,protocolFlowIsNotRealisedCompanyIncome:true,correlationMustNotBePromotedToAttribution:true,retainedHistoricalEvidenceMayOnlyBeUsedWithFreshCurrentStateRevalidation:true}
    };
    fs.writeFileSync(OUTPUT_FILE,JSON.stringify(state,null,2)+'\n');
    console.log('VLCVX VOTIUM CURVE GAUGE FLOW RETAINED HISTORY PASS',{generatedAt:state.generatedAt,status:state.status,block:state.observation.ethereumBlock,stateRpc:endpointClass,evidenceMode:state.observation.historicalLogScan.evidenceMode,retainedArtifactSha256,rounds:roundIds,gauges:`${state.coverage.curveExecutedVotiumGaugeCount}/${state.coverage.votiumGaugeCount}`,executionAuthority:state.authority.executionAuthority});
  }finally{try{provider.destroy();}catch{}}
}
main().catch(error=>{console.error(error);process.exit(1);});
