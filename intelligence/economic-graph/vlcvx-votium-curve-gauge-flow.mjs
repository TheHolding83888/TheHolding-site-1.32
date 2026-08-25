#!/usr/bin/env node
/**
 * The Holding · Votium vlCVX → Convex → Curve Gauge Flow v0.1
 * Read-only bridge from Votium incentives/votes to actually executed Curve gauge weights.
 */
import fs from 'node:fs';
import crypto from 'node:crypto';
import { Contract, JsonRpcProvider, getAddress } from 'ethers';

const ROUND_FLOW_FILE=process.env.VLCVX_VOTIUM_ROUND_FLOW_FILE||'intelligence/economic-graph/vlcvx-votium-round-flow.json';
const PROVENANCE_FILE=process.env.VLCVX_VOTIUM_VOTING_PROVENANCE_FILE||'intelligence/economic-graph/vlcvx-votium-snapshot-proof.json';
const OUTPUT_FILE=process.env.VLCVX_VOTIUM_CURVE_GAUGE_FLOW_FILE||'intelligence/economic-graph/vlcvx-votium-curve-gauge-flow.json';
const CURVE_GAUGE_VOTING='0x64D9B5AC386B70af9EDCD20A58cE9262D2EAC278';
const CURVE_GAUGE_EXECUTOR='0x399382E82D9b6362ccAbd1f3C763bEE93E80c9e8';
const CONVEX_SOURCE_SHA='242b592718ff939e0a15e490a7df9730267f0999';
const WEIGHT_BPS=10000n;
const EVENT_WINDOW_AFTER_END_SECONDS=9*86400;
const LOG_CHUNK=15000;

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
  'function isDone(uint256) view returns (bool)',
  'event GaugeVoteExecuted(uint256 indexed proposalId,address[] gauges,uint256[] weights)'
];

function readJson(file){return JSON.parse(fs.readFileSync(file,'utf8'));}
function sha256File(file){return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');}
function iso(sec){return new Date(Number(sec)*1000).toISOString();}
function round(v,d=8){return Number.isFinite(Number(v))?Number(Number(v).toFixed(d)):null;}
function pct(a,b,d=6){return b?round(Number(a)/Number(b)*100,d):null;}
function fail(message){throw new Error(message);}
function rpcCandidates(){return [...new Set([process.env.ETH_RPC_URL,'https://ethereum-rpc.publicnode.com','https://eth.llamarpc.com'].filter(Boolean))];}
function rpcLabel(url){if(url===process.env.ETH_RPC_URL)return'configured-secret';try{return new URL(url).hostname;}catch{return'configured';}}
async function providerWithFallback(){let last=null;for(const url of rpcCandidates()){const provider=new JsonRpcProvider(url,1,{staticNetwork:true});try{await provider.getBlockNumber();return{provider,endpointClass:rpcLabel(url)};}catch(e){last=e;try{provider.destroy();}catch{}}}throw last||new Error('No working Ethereum RPC');}

async function blockAtOrAfter(provider,target,currentBlock){
  let lo=1,hi=currentBlock;
  while(lo<hi){const mid=Math.floor((lo+hi)/2),b=await provider.getBlock(mid);if(!b)throw new Error(`Block ${mid} unavailable`);if(Number(b.timestamp)<target)lo=mid+1;else hi=mid;}
  return lo;
}
async function queryExecutionEvents(executor,proposalId,fromBlock,toBlock){
  const out=[];
  for(let start=fromBlock;start<=toBlock;start+=LOG_CHUNK){
    const end=Math.min(toBlock,start+LOG_CHUNK-1);
    const logs=await executor.queryFilter(executor.filters.GaugeVoteExecuted(proposalId),start,end);
    out.push(...logs);
  }
  return out;
}

function requireUpstreams(roundFlow,provenance){
  if(roundFlow.version!=='0.1-vlcvx-votium-round-flow'||roundFlow.status!=='shadow-measured-not-promoted')fail('Votium round-flow upstream unavailable');
  if(provenance.version!=='0.2-vlcvx-votium-voting-provenance'||provenance.status!=='shadow-voting-provenance-proven')fail('Votium voting provenance upstream unavailable');
  if(provenance.coverage?.complete!==true||provenance.transition?.boundaryStatus!=='live-cross-source-proven')fail('Votium voting provenance is incomplete');
  if(provenance.voteUnitSemantics?.status!=='proven-human-scale-vlcvx-voting-power')fail('Votium vote-unit meaning not proven');
  if(String(provenance.sourceAuthority?.convexOnchain?.currentCurveGaugeVoting||'').toLowerCase()!==CURVE_GAUGE_VOTING.toLowerCase())fail('Convex current Curve GaugeVotePlatform drift');
}

async function readProposal(platform,executor,provider,proposalId,currentBlock){
  const [p,voteTotalRaw,gaugeCountRaw,finalized,submittedCountRaw,submittedWeightRaw,done]=await Promise.all([
    platform.proposals(proposalId,{blockTag:currentBlock}),platform.voteTotals(proposalId,{blockTag:currentBlock}),platform.getGaugeCount(proposalId,{blockTag:currentBlock}),platform.isFinalized(proposalId,{blockTag:currentBlock}),
    executor.submittedGaugeCount(proposalId,{blockTag:currentBlock}),executor.submittedWeight(proposalId,{blockTag:currentBlock}),executor.isDone(proposalId,{blockTag:currentBlock})
  ]);
  const gaugeCount=Number(gaugeCountRaw),gauges=[];
  for(let i=0;i<gaugeCount;i++){
    const entry=await platform.getGaugeEntry(proposalId,i,{blockTag:currentBlock});
    const raw=BigInt(entry.totalWeight);
    gauges.push({gauge:getAddress(entry.gauge),gaugeTotalRaw:raw.toString(),mechanicalWeightBps:Number(raw*WEIGHT_BPS/BigInt(voteTotalRaw))});
  }
  const startTime=Number(p.startTime),endTime=Number(p.endTime);
  const fromBlock=await blockAtOrAfter(provider,startTime,currentBlock);
  const eventEndTime=Math.min(Math.floor(Date.now()/1000),endTime+EVENT_WINDOW_AFTER_END_SECONDS);
  const toBlock=eventEndTime>=startTime?await blockAtOrAfter(provider,eventEndTime,currentBlock):currentBlock;
  const logs=await queryExecutionEvents(executor,proposalId,fromBlock,Math.min(toBlock,currentBlock));
  const executed=new Map(),events=[];
  for(const log of logs){
    const gs=log.args?.gauges||[],weights=log.args?.weights||[];
    const rows=[];
    for(let i=0;i<gs.length;i++){
      const gauge=getAddress(gs[i]),weight=Number(weights[i]);
      rows.push({gauge,weightBps:weight});
      executed.set(gauge.toLowerCase(),{weightBps:weight,txHash:log.transactionHash,blockNumber:log.blockNumber});
    }
    events.push({txHash:log.transactionHash,blockNumber:log.blockNumber,gaugeCount:rows.length,rows});
  }
  const joined=gauges.map(g=>{
    const e=executed.get(g.gauge.toLowerCase())||null;
    return{...g,executedWeightBps:e?.weightBps??null,executionTxHash:e?.txHash??null,executionBlock:e?.blockNumber??null,mechanicalDeltaBps:e?e.weightBps-g.mechanicalWeightBps:null};
  });
  const executedCount=joined.filter(g=>g.executedWeightBps!==null).length;
  const executedWeightSum=joined.reduce((sum,g)=>sum+(g.executedWeightBps??0),0);
  return{
    proposalId,startTime,startAt:iso(startTime),endTime,endAt:iso(endTime),epoch:Number(p.epoch),finalized:Boolean(finalized),voteTotalRaw:voteTotalRaw.toString(),gaugeCount,
    executor:{submittedGaugeCount:Number(submittedCountRaw),submittedWeightBps:Number(submittedWeightRaw),isDone:Boolean(done),executionEventCount:events.length,eventGaugeRowCount:events.reduce((s,e)=>s+e.gaugeCount,0),uniqueExecutedGaugeCount:executed.size,executedWeightSumBps:executedWeightSum},
    eventQuery:{fromBlock,toBlock:Math.min(toBlock,currentBlock),windowRule:'proposal start through min(current time, proposal end + 9 days), chunked'},events,gauges:joined,
    coverage:{executedGaugeCount:executedCount,totalGaugeCount:gaugeCount,executedGaugeCoveragePct:pct(executedCount,gaugeCount),complete:done&&finalized&&executedCount===gaugeCount&&executedWeightSum===10000}
  };
}

function buildRoundContext(roundFlowRound,provenanceRound,proposal){
  const executedByGauge=new Map(proposal.gauges.map(g=>[g.gauge.toLowerCase(),g]));
  const gauges=roundFlowRound.gauges.map(g=>{
    const execution=executedByGauge.get(String(g.gauge).toLowerCase())||null;
    return{
      gauge:g.gauge,
      incentiveCount:Number(g.incentiveCount),
      incentiveTokens:g.incentives.map(i=>({token:i.token,contractAmountRaw:i.contractAmountRaw,contractAmount:i.contractAmount,distributedRaw:i.distributedRaw,distributed:i.distributed,recycledRaw:i.recycledRaw,recycled:i.recycled,depositor:i.depositor})),
      votiumVotesReceived:Number(g.votesReceivedContractUnits),votiumVoteSharePct:g.voteSharePct,
      convexGaugeTotalRaw:execution?.gaugeTotalRaw??null,
      curveMechanicalWeightBps:execution?.mechanicalWeightBps??null,
      curveExecutedWeightBps:execution?.executedWeightBps??null,
      curveExecutionTxHash:execution?.executionTxHash??null,
      curveExecutionBlock:execution?.executionBlock??null,
      semantics:{incentives:'MEASURED-votium-contract',votes:'MEASURED-votium-and-cross-contract-provenance',voteToCurveWeight:'ATTRIBUTED-mechanical-and-execution-event',incentiveToVote:'CORRELATED-same-round-only-not-causal'}
    };
  });
  const curveExecutedCount=gauges.filter(g=>g.curveExecutedWeightBps!==null).length;
  return{
    roundId:Number(roundFlowRound.roundId),roundStart:provenanceRound.roundStart,regime:provenanceRound.regime,proposalId:proposal.proposalId,
    incentiveCount:Number(roundFlowRound.incentiveCount),tokenFlows:roundFlowRound.tokenFlows,totalVotiumVotesReceived:Number(roundFlowRound.totalVotesReceivedContractUnits),
    curveExecutor:{isDone:proposal.executor.isDone,submittedGaugeCount:proposal.executor.submittedGaugeCount,submittedWeightBps:proposal.executor.submittedWeightBps,executionEventCount:proposal.executor.executionEventCount},
    coverage:{votiumIncentivizedGaugeCount:gauges.length,curveExecutedForVotiumGaugeCount:curveExecutedCount,curveExecutedForVotiumGaugePct:pct(curveExecutedCount,gauges.length),complete:curveExecutedCount===gauges.length&&proposal.coverage.complete},
    gauges,
    epistemic:{incentiveState:'measured',votingPower:'measured-and-cross-contract-proven',curveWeightMechanics:'attributed-by-source-formula',curveExecution:'measured-by-GaugeVoteExecuted-events',incentiveToVoteCausality:'unresolved',downstreamLiquidityVolumeFeeEffect:'not-yet-measured-by-v0.1',primaryDriver:null}
  };
}

async function main(){
  const roundFlow=readJson(ROUND_FLOW_FILE),provenance=readJson(PROVENANCE_FILE);requireUpstreams(roundFlow,provenance);
  const roundById=new Map(roundFlow.completedRounds.map(r=>[Number(r.roundId),r]));
  const postMigration=provenance.rounds.filter(r=>r.regime==='convex-onchain'&&r.status==='proven');
  if(postMigration.length<2)fail('Need at least two proven post-migration Votium rounds');
  const {provider,endpointClass}=await providerWithFallback();
  try{
    const currentBlock=await provider.getBlockNumber(),block=await provider.getBlock(currentBlock);if(!block)fail('Current Ethereum block unavailable');
    const platform=new Contract(CURVE_GAUGE_VOTING,PLATFORM_ABI,provider),executor=new Contract(CURVE_GAUGE_EXECUTOR,EXECUTOR_ABI,provider);
    const rounds=[];
    for(const pRound of postMigration){
      const sourceRound=roundById.get(Number(pRound.roundId));if(!sourceRound)fail(`Round ${pRound.roundId} missing from round-flow`);
      const proposalId=Number(pRound.currentOnchainProposal?.proposalId);if(!Number.isInteger(proposalId))fail(`Round ${pRound.roundId} proposal id missing`);
      const proposal=await readProposal(platform,executor,provider,proposalId,currentBlock);
      if(proposal.startAt!==pRound.roundStart)fail(`Round ${pRound.roundId} proposal start drift`);
      rounds.push(buildRoundContext(sourceRound,pRound,proposal));
    }
    const complete=rounds.every(r=>r.coverage.complete);
    const state={
      version:'0.1-vlcvx-votium-curve-gauge-flow',engineVersion:'0.1-votium-convex-curve-execution-bridge',generatedAt:new Date().toISOString(),status:complete?'shadow-cross-protocol-flow-proven':'shadow-partial-proof',
      purpose:'Connect Votium incentive accounting and proven vlCVX voting power to Convex GaugeVotePlatform and the actually executed Curve gauge BPS weights, without claiming incentives caused votes or downstream pool economics.',
      authority:{readOnly:true,executionAuthority:'none',capitalExecution:false,walletAuthority:false,allocationAuthority:false,recommendationAuthority:false,predictionAuthority:false,causalClaimAuthority:'none',promotionAuthority:'none',methodologyMutationAuthority:false},
      sourceBinding:{roundFlowFile:'intelligence/economic-graph/vlcvx-votium-round-flow.json',roundFlowSha256:sha256File(ROUND_FLOW_FILE),votingProvenanceFile:'intelligence/economic-graph/vlcvx-votium-snapshot-proof.json',votingProvenanceSha256:sha256File(PROVENANCE_FILE),companyRegistry:'004',candidateId:'defitea-convex-vlcvx-votium'},
      protocolBridge:{chain:'Ethereum',votium:'0x63942E31E98f1833A234077f47880A66136a2D1e',convexCurveGaugeVoting:CURVE_GAUGE_VOTING,convexCurveGaugeExecutor:CURVE_GAUGE_EXECUTOR,convexSourceRepository:'convex-eth/voting',convexSourceCommit:CONVEX_SOURCE_SHA,mechanicalIdentity:'CurveGaugeExecutor weight = floor(gaugeTotal * 10000 / proposal voteTotal), with any final rounding residual added to the last non-zero gauge when all gauges are submitted.'},
      observation:{ethereumBlock:currentBlock,ethereumBlockHash:block.hash,observedAt:iso(block.timestamp),rpcEndpointClass:endpointClass,sameBlockStateReads:true},
      coverage:{roundCount:rounds.length,completeRoundCount:rounds.filter(r=>r.coverage.complete).length,votiumGaugeCount:rounds.reduce((s,r)=>s+r.coverage.votiumIncentivizedGaugeCount,0),curveExecutedVotiumGaugeCount:rounds.reduce((s,r)=>s+r.coverage.curveExecutedForVotiumGaugeCount,0),complete},
      rounds,
      epistemic:{votiumIncentives:'MEASURED',votiumVotes:'MEASURED',convexToCurveWeightMechanics:'ATTRIBUTED',curveGaugeExecution:'MEASURED',incentiveToVoteRelationship:'CORRELATED-only-not-causal',voteToExecutedCurveWeightRelationship:'ATTRIBUTED-and-execution-confirmed',liquidityVolumeFeesDownstream:'UNKNOWN-not-yet-joined',companyIncomeConnection:'not-attributed-by-this-layer',primaryDriver:null},
      semantics:{unknownIsNotZero:true,incentiveAndVoteCoexistenceIsNotCausation:true,executedGaugeWeightIsNotPoolRevenue:true,protocolFlowIsNotRealisedCompanyIncome:true,correlationMustNotBePromotedToAttribution:true}
    };
    fs.writeFileSync(OUTPUT_FILE,JSON.stringify(state,null,2)+'\n');
    console.log('VLCVX VOTIUM CURVE GAUGE FLOW PASS',{generatedAt:state.generatedAt,status:state.status,block:currentBlock,rounds:rounds.map(r=>({roundId:r.roundId,proposalId:r.proposalId,incentives:r.incentiveCount,votiumGauges:r.coverage.votiumIncentivizedGaugeCount,curveExecuted:r.coverage.curveExecutedForVotiumGaugeCount,executorDone:r.curveExecutor.isDone,submittedWeightBps:r.curveExecutor.submittedWeightBps})),coverage:state.coverage,executionAuthority:state.authority.executionAuthority});
  }finally{try{provider.destroy();}catch{}}
}
main().catch(error=>{console.error(error);process.exit(1);});
