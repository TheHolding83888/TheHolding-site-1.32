#!/usr/bin/env node
/**
 * The Holding · Votium vlCVX → Convex → Curve Gauge Flow v0.1
 * Read-only bridge from Votium incentives/votes to executed Curve gauge weights.
 * Current finalized state and historical execution logs intentionally use separate RPC lanes.
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
const LOG_CHUNK_START=5000;
const LOG_CHUNK_MIN=250;

const PLATFORM_ABI=[
  'function proposals(uint256) view returns (uint48 startTime,uint48 endTime,uint48 epoch)',
  'function voteTotals(uint256) view returns (uint256)',
  'function getGaugeCount(uint256) view returns (uint256)',
  'function getGaugeEntry(uint256,uint256) view returns (address gauge,uint256 totalWeight)',
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
function unique(values){return [...new Set(values.filter(Boolean))];}
function stateRpcCandidates(){return unique([process.env.ETH_RPC_URL,'https://ethereum-rpc.publicnode.com','https://eth.llamarpc.com','https://1rpc.io/eth','https://eth.drpc.org']);}
function historicalRpcCandidates(){return unique([process.env.ETH_RPC_URL,'https://1rpc.io/eth','https://eth.drpc.org','https://eth.llamarpc.com','https://ethereum-rpc.publicnode.com']);}
function rpcLabel(url){if(url===process.env.ETH_RPC_URL)return'configured-secret';try{return new URL(url).hostname;}catch{return'configured';}}
function makeProvider(url){return new JsonRpcProvider(url,1,{staticNetwork:true,batchMaxCount:1});}

function eventScanStartBlock(provenance){
  const legacy=provenance.rounds
    .filter(r=>r.regime==='legacy-snapshot')
    .map(r=>Number(r.snapshot?.proposal?.snapshotBlock))
    .filter(Number.isInteger);
  if(!legacy.length)fail('Legacy Snapshot block unavailable for event-log lower bound');
  return Math.max(1,Math.min(...legacy));
}

function requireUpstreams(roundFlow,provenance){
  if(roundFlow.version!=='0.1-vlcvx-votium-round-flow'||roundFlow.status!=='shadow-measured-not-promoted')fail('Votium round-flow upstream unavailable');
  if(provenance.version!=='0.2-vlcvx-votium-voting-provenance'||provenance.status!=='shadow-voting-provenance-proven')fail('Votium voting provenance upstream unavailable');
  if(provenance.coverage?.complete!==true||provenance.transition?.boundaryStatus!=='live-cross-source-proven')fail('Votium voting provenance incomplete');
  if(provenance.voteUnitSemantics?.status!=='proven-human-scale-vlcvx-voting-power')fail('Votium vote-unit meaning not proven');
  if(String(provenance.sourceAuthority?.convexOnchain?.currentCurveGaugeVoting||'').toLowerCase()!==CURVE_GAUGE_VOTING.toLowerCase())fail('Convex current Curve GaugeVotePlatform drift');
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
      await platform.proposals(proposalId);
      await executor.isDone(proposalId);
      return{provider,block,endpointClass:rpcLabel(url)};
    }catch(e){last=e;try{provider.destroy();}catch{}}
  }
  throw last||new Error('No Ethereum RPC with current Convex/Curve state capability');
}

async function readProposalState(platform,executor,proposalId){
  const p=await platform.proposals(proposalId);
  const voteTotalRaw=await platform.voteTotals(proposalId);
  const gaugeCountRaw=await platform.getGaugeCount(proposalId);
  const finalized=await platform.isFinalized(proposalId);
  const submittedCountRaw=await executor.submittedGaugeCount(proposalId);
  const submittedWeightRaw=await executor.submittedWeight(proposalId);
  const done=await executor.isDone(proposalId);
  const gaugeCount=Number(gaugeCountRaw),gauges=[];
  for(let i=0;i<gaugeCount;i++){
    const entry=await platform.getGaugeEntry(proposalId,i);
    const raw=BigInt(entry.totalWeight);
    gauges.push({gauge:getAddress(entry.gauge),gaugeTotalRaw:raw.toString(),mechanicalWeightBps:Number(raw*WEIGHT_BPS/BigInt(voteTotalRaw))});
  }
  return{
    proposalId,startTime:Number(p.startTime),startAt:iso(p.startTime),endTime:Number(p.endTime),endAt:iso(p.endTime),epoch:Number(p.epoch),finalized:Boolean(finalized),voteTotalRaw:voteTotalRaw.toString(),gaugeCount,gauges,
    executor:{submittedGaugeCount:Number(submittedCountRaw),submittedWeightBps:Number(submittedWeightRaw),isDone:Boolean(done)}
  };
}

function executionCoverage(events,proposalStates){
  const result=new Map();
  for(const state of proposalStates){result.set(state.proposalId,{unique:new Set(),weightSum:0,eventCount:0,rowCount:0});}
  for(const event of events){
    const x=result.get(event.proposalId);if(!x)continue;
    x.eventCount++;
    for(const row of event.rows){x.unique.add(row.gauge.toLowerCase());x.weightSum+=row.weightBps;x.rowCount++;}
  }
  return result;
}

function targetsComplete(events,proposalStates){
  const coverage=executionCoverage(events,proposalStates);
  return proposalStates.every(state=>{
    const x=coverage.get(state.proposalId);
    return state.executor.isDone===true&&state.executor.submittedGaugeCount===state.gaugeCount&&state.executor.submittedWeightBps===10000&&x.unique.size===state.gaugeCount&&x.weightSum===10000;
  });
}

async function scanExecutionEvents(proposalStates,fromBlock,toBlock){
  const urls=historicalRpcCandidates();
  const lanes=urls.map(url=>({url,label:rpcLabel(url),provider:makeProvider(url),contract:null}));
  for(const lane of lanes)lane.contract=new Contract(CURVE_GAUGE_EXECUTOR,EXECUTOR_ABI,lane.provider);
  const events=[];const used=new Set();let endpointCursor=0;let start=fromBlock;let attempts=0;let lastScannedBlock=fromBlock-1;
  try{
    while(start<=toBlock&&!targetsComplete(events,proposalStates)){
      let chunk=Math.min(LOG_CHUNK_START,toBlock-start+1),completedChunk=false,lastError=null;
      while(!completedChunk){
        const end=Math.min(toBlock,start+chunk-1);
        for(let offset=0;offset<lanes.length;offset++){
          const idx=(endpointCursor+offset)%lanes.length,lane=lanes[idx];attempts++;
          try{
            const logs=await lane.contract.queryFilter(lane.contract.filters.GaugeVoteExecuted(),start,end);
            for(const log of logs){
              const proposalId=Number(log.args?.proposalId),gs=log.args?.gauges||[],weights=log.args?.weights||[],rows=[];
              if(!proposalStates.some(s=>s.proposalId===proposalId))continue;
              for(let i=0;i<gs.length;i++)rows.push({gauge:getAddress(gs[i]),weightBps:Number(weights[i])});
              events.push({proposalId,txHash:log.transactionHash,blockNumber:log.blockNumber,gaugeCount:rows.length,rows});
            }
            used.add(lane.label);endpointCursor=idx;lastScannedBlock=end;start=end+1;completedChunk=true;break;
          }catch(e){lastError=e;}
        }
        if(!completedChunk){
          if(chunk<=LOG_CHUNK_MIN)throw lastError||new Error(`Historical log query failed at block ${start}`);
          chunk=Math.max(LOG_CHUNK_MIN,Math.floor(chunk/2));
        }
      }
    }
    const complete=targetsComplete(events,proposalStates);
    const rawCoverage=executionCoverage(events,proposalStates);
    const diagnostic=proposalStates.map(state=>{const c=rawCoverage.get(state.proposalId);return{proposalId:state.proposalId,finalized:state.finalized,gaugeCount:state.gaugeCount,isDone:state.executor.isDone,submittedGaugeCount:state.executor.submittedGaugeCount,submittedWeightBps:state.executor.submittedWeightBps,eventCount:c.eventCount,eventGaugeRowCount:c.rowCount,uniqueEventGaugeCount:c.unique.size,eventWeightSumBps:c.weightSum};});
    return{events,provenance:{fromBlock,toBlock:lastScannedBlock,requestedToBlock:toBlock,completedEarly:lastScannedBlock<toBlock,complete,endpointClassesUsed:[...used],attempts,chunkStart:LOG_CHUNK_START,chunkMinimum:LOG_CHUNK_MIN,diagnostic,completionRule:'stop only after current isDone/submittedGaugeCount/submittedWeight plus unique event gauge count and event BPS sum prove both target proposals complete'}};
  }finally{for(const lane of lanes){try{lane.provider.destroy();}catch{}}}
}

function attachExecutionEvidence(state,allEvents,scanProvenance){
  const events=allEvents.filter(e=>e.proposalId===state.proposalId);
  const executed=new Map();
  for(const event of events){for(const row of event.rows)executed.set(row.gauge.toLowerCase(),{weightBps:row.weightBps,txHash:event.txHash,blockNumber:event.blockNumber});}
  const joined=state.gauges.map(g=>{
    const e=executed.get(g.gauge.toLowerCase())||null;
    return{...g,executedWeightBps:e?.weightBps??null,executionTxHash:e?.txHash??null,executionBlock:e?.blockNumber??null,mechanicalDeltaBps:e?e.weightBps-g.mechanicalWeightBps:null};
  });
  const executedCount=joined.filter(g=>g.executedWeightBps!==null).length;
  const executedWeightSum=joined.reduce((sum,g)=>sum+(g.executedWeightBps??0),0);
  const mechanicalWeightSum=joined.reduce((sum,g)=>sum+g.mechanicalWeightBps,0);
  const residualBps=10000-mechanicalWeightSum;
  const deltaSum=joined.reduce((sum,g)=>sum+(g.mechanicalDeltaBps??0),0);
  const negativeDeltaCount=joined.filter(g=>g.mechanicalDeltaBps!==null&&g.mechanicalDeltaBps<0).length;
  const positiveDeltaCount=joined.filter(g=>Number(g.mechanicalDeltaBps)>0).length;
  const roundingComplete=residualBps>=0&&deltaSum===residualBps&&negativeDeltaCount===0&&positiveDeltaCount<=1;
  const complete=state.finalized&&state.executor.isDone&&state.executor.submittedGaugeCount===state.gaugeCount&&state.executor.submittedWeightBps===10000&&executedCount===state.gaugeCount&&executed.size===state.gaugeCount&&executedWeightSum===10000&&roundingComplete;
  return{
    ...state,
    executor:{...state.executor,executionEventCount:events.length,eventGaugeRowCount:events.reduce((s,e)=>s+e.gaugeCount,0),uniqueExecutedGaugeCount:executed.size,executedWeightSumBps:executedWeightSum},
    roundingProof:{mechanicalWeightSumBps:mechanicalWeightSum,residualBps,executionMinusMechanicalDeltaSumBps:deltaSum,negativeDeltaCount,positiveDeltaCount,complete:roundingComplete},
    eventQuery:{fromBlock:scanProvenance.fromBlock,toBlock:scanProvenance.toBlock,windowRule:'single shared GaugeVoteExecuted scan from exact pre-migration Snapshot anchor until both current completed proposal states are fully reconstructed'},
    events,gauges:joined,coverage:{executedGaugeCount:executedCount,totalGaugeCount:state.gaugeCount,executedGaugeCoveragePct:pct(executedCount,state.gaugeCount),complete}
  };
}

function buildRoundContext(roundFlowRound,provenanceRound,proposal){
  const executedByGauge=new Map(proposal.gauges.map(g=>[g.gauge.toLowerCase(),g]));
  const gauges=roundFlowRound.gauges.map(g=>{
    const execution=executedByGauge.get(String(g.gauge).toLowerCase())||null;
    return{
      gauge:g.gauge,incentiveCount:Number(g.incentiveCount),
      incentiveTokens:g.incentives.map(i=>({token:i.token,contractAmountRaw:i.contractAmountRaw,contractAmount:i.contractAmount,distributedRaw:i.distributedRaw,distributed:i.distributed,recycledRaw:i.recycledRaw,recycled:i.recycled,depositor:i.depositor})),
      votiumVotesReceived:Number(g.votesReceivedContractUnits),votiumVoteSharePct:g.voteSharePct,
      convexGaugeTotalRaw:execution?.gaugeTotalRaw??null,curveMechanicalWeightBps:execution?.mechanicalWeightBps??null,curveExecutedWeightBps:execution?.executedWeightBps??null,curveMechanicalDeltaBps:execution?.mechanicalDeltaBps??null,curveExecutionTxHash:execution?.executionTxHash??null,curveExecutionBlock:execution?.executionBlock??null,
      semantics:{incentives:'MEASURED-votium-contract',votes:'MEASURED-votium-and-cross-contract-provenance',voteToCurveWeight:'ATTRIBUTED-mechanical-and-execution-event',incentiveToVote:'CORRELATED-same-round-only-not-causal'}
    };
  });
  const curveExecutedCount=gauges.filter(g=>g.curveExecutedWeightBps!==null).length;
  return{
    roundId:Number(roundFlowRound.roundId),roundStart:provenanceRound.roundStart,regime:provenanceRound.regime,proposalId:proposal.proposalId,
    incentiveCount:Number(roundFlowRound.incentiveCount),tokenFlows:roundFlowRound.tokenFlows,totalVotiumVotesReceived:Number(roundFlowRound.totalVotesReceivedContractUnits),
    curveExecutor:{isDone:proposal.executor.isDone,submittedGaugeCount:proposal.executor.submittedGaugeCount,submittedWeightBps:proposal.executor.submittedWeightBps,executionEventCount:proposal.executor.executionEventCount,roundingProof:proposal.roundingProof},
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
  const proposalIds=postMigration.map(r=>Number(r.currentOnchainProposal?.proposalId));
  if(proposalIds.some(id=>!Number.isInteger(id)))fail('Post-migration proposal id missing');
  const scanFromBlock=eventScanStartBlock(provenance);
  const {provider:stateProvider,endpointClass:stateEndpointClass,block}=await selectStateProvider(proposalIds[0]);
  try{
    const currentBlock=Number(block.number);
    const platform=new Contract(CURVE_GAUGE_VOTING,PLATFORM_ABI,stateProvider),executor=new Contract(CURVE_GAUGE_EXECUTOR,EXECUTOR_ABI,stateProvider);
    const proposalStates=[];
    for(let i=0;i<postMigration.length;i++){
      const proposalState=await readProposalState(platform,executor,proposalIds[i]);
      if(proposalState.startAt!==postMigration[i].roundStart)fail(`Round ${postMigration[i].roundId} proposal start drift`);
      proposalStates.push(proposalState);
    }
    const scanned=await scanExecutionEvents(proposalStates,scanFromBlock,currentBlock);
    const proposals=proposalStates.map(proposalState=>attachExecutionEvidence(proposalState,scanned.events,scanned.provenance));
    const rounds=[];
    for(let i=0;i<postMigration.length;i++){
      const sourceRound=roundById.get(Number(postMigration[i].roundId));if(!sourceRound)fail(`Round ${postMigration[i].roundId} missing from round-flow`);
      rounds.push(buildRoundContext(sourceRound,postMigration[i],proposals[i]));
    }
    const complete=rounds.every(r=>r.coverage.complete);
    const state={
      version:'0.1-vlcvx-votium-curve-gauge-flow',engineVersion:'0.1-votium-convex-curve-execution-bridge',generatedAt:new Date().toISOString(),status:complete?'shadow-cross-protocol-flow-proven':'shadow-partial-proof',
      purpose:'Connect Votium incentive accounting and proven vlCVX voting power to Convex GaugeVotePlatform and actually executed Curve gauge BPS weights, without claiming incentives caused votes or downstream pool economics.',
      authority:{readOnly:true,executionAuthority:'none',capitalExecution:false,walletAuthority:false,allocationAuthority:false,recommendationAuthority:false,predictionAuthority:false,causalClaimAuthority:'none',promotionAuthority:'none',methodologyMutationAuthority:false},
      sourceBinding:{roundFlowFile:'intelligence/economic-graph/vlcvx-votium-round-flow.json',roundFlowSha256:sha256File(ROUND_FLOW_FILE),votingProvenanceFile:'intelligence/economic-graph/vlcvx-votium-snapshot-proof.json',votingProvenanceSha256:sha256File(PROVENANCE_FILE),companyRegistry:'004',candidateId:'defitea-convex-vlcvx-votium'},
      protocolBridge:{chain:'Ethereum',votium:'0x63942E31E98f1833A234077f47880A66136a2D1e',convexCurveGaugeVoting:CURVE_GAUGE_VOTING,convexCurveGaugeExecutor:CURVE_GAUGE_EXECUTOR,convexSourceRepository:'convex-eth/voting',convexSourceCommit:CONVEX_SOURCE_SHA,mechanicalIdentity:'CurveGaugeExecutor weight = floor(gaugeTotal * 10000 / proposal voteTotal), with the final rounding residual added to the last non-zero gauge once all gauges are submitted.'},
      observation:{ethereumBlock:currentBlock,ethereumBlockHash:block.hash,observedAt:iso(block.timestamp),rpcArchitecture:'split-current-state-and-historical-log-lanes',stateRpcEndpointClass:stateEndpointClass,historicalLogRpcEndpointClassesUsed:scanned.provenance.endpointClassesUsed,historicalLogScan:scanned.provenance,rpcBatching:'disabled-for-public-endpoint-compatibility',stateReadMode:'latest-persistent-finalized-proposal-state',historicalStateReadsRequired:false,historicalExecutionEvidence:'GaugeVoteExecuted-event-logs'},
      coverage:{roundCount:rounds.length,completeRoundCount:rounds.filter(r=>r.coverage.complete).length,votiumGaugeCount:rounds.reduce((s,r)=>s+r.coverage.votiumIncentivizedGaugeCount,0),curveExecutedVotiumGaugeCount:rounds.reduce((s,r)=>s+r.coverage.curveExecutedForVotiumGaugeCount,0),complete},
      rounds,
      epistemic:{votiumIncentives:'MEASURED',votiumVotes:'MEASURED',convexToCurveWeightMechanics:'ATTRIBUTED',curveGaugeExecution:'MEASURED',incentiveToVoteRelationship:'CORRELATED-only-not-causal',voteToExecutedCurveWeightRelationship:'ATTRIBUTED-and-execution-confirmed',liquidityVolumeFeesDownstream:'UNKNOWN-not-yet-joined',companyIncomeConnection:'not-attributed-by-this-layer',primaryDriver:null},
      semantics:{unknownIsNotZero:true,incentiveAndVoteCoexistenceIsNotCausation:true,executedGaugeWeightIsNotPoolRevenue:true,protocolFlowIsNotRealisedCompanyIncome:true,correlationMustNotBePromotedToAttribution:true}
    };
    fs.writeFileSync(OUTPUT_FILE,JSON.stringify(state,null,2)+'\n');
    console.log('VLCVX VOTIUM CURVE GAUGE FLOW PASS',{generatedAt:state.generatedAt,status:state.status,block:currentBlock,stateRpc:stateEndpointClass,historicalLogRpcs:scanned.provenance.endpointClassesUsed,historicalLogScanComplete:scanned.provenance.complete,historicalDiagnostic:scanned.provenance.diagnostic,scanToBlock:scanned.provenance.toBlock,rounds:rounds.map(r=>({roundId:r.roundId,proposalId:r.proposalId,incentives:r.incentiveCount,votiumGauges:r.coverage.votiumIncentivizedGaugeCount,curveExecuted:r.coverage.curveExecutedForVotiumGaugeCount,executorDone:r.curveExecutor.isDone,submittedGaugeCount:r.curveExecutor.submittedGaugeCount,submittedWeightBps:r.curveExecutor.submittedWeightBps,rounding:r.curveExecutor.roundingProof})),coverage:state.coverage,executionAuthority:state.authority.executionAuthority});
  }finally{try{stateProvider.destroy();}catch{}}
}
main().catch(error=>{console.error(error);process.exit(1);});
