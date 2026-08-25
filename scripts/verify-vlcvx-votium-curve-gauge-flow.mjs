#!/usr/bin/env node
import fs from 'node:fs';
import crypto from 'node:crypto';

const file=process.env.VLCVX_VOTIUM_CURVE_GAUGE_FLOW_FILE||'intelligence/economic-graph/vlcvx-votium-curve-gauge-flow.json';
const roundFlowFile=process.env.VLCVX_VOTIUM_ROUND_FLOW_FILE||'intelligence/economic-graph/vlcvx-votium-round-flow.json';
const provenanceFile=process.env.VLCVX_VOTIUM_VOTING_PROVENANCE_FILE||'intelligence/economic-graph/vlcvx-votium-snapshot-proof.json';
const x=JSON.parse(fs.readFileSync(file,'utf8'));
const provenance=JSON.parse(fs.readFileSync(provenanceFile,'utf8'));
const hash=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const roundFlowHash=hash(roundFlowFile),provenanceHash=hash(provenanceFile);
function fail(message){throw new Error(message);}

if(x.version!=='0.1-vlcvx-votium-curve-gauge-flow')fail('Votium→Curve flow version mismatch');
if(x.engineVersion!=='0.1-votium-convex-curve-execution-bridge')fail('Votium→Curve flow engine mismatch');
if(x.status!=='shadow-cross-protocol-flow-proven')fail(`Votium→Curve flow incomplete: ${x.status}`);
if(x.authority?.readOnly!==true||x.authority?.executionAuthority!=='none'||x.authority?.causalClaimAuthority!=='none'||x.authority?.promotionAuthority!=='none')fail('Votium→Curve authority regression');
if(x.sourceBinding?.roundFlowSha256!==roundFlowHash||x.sourceBinding?.votingProvenanceSha256!==provenanceHash)fail('Votium→Curve exact upstream byte binding mismatch');
if(provenance.sourceBinding?.roundFlowSha256!==roundFlowHash)fail('Voting provenance and round-flow are not from the same canonical bytes');
if(x.sourceBinding?.candidateId!=='defitea-convex-vlcvx-votium'||x.sourceBinding?.companyRegistry!=='004')fail('Votium→Curve candidate binding mismatch');
if(String(x.protocolBridge?.convexCurveGaugeVoting||'').toLowerCase()!=='0x64d9b5ac386b70af9edcd20a58ce9262d2eac278')fail('Convex GaugeVotePlatform drift');
if(String(x.protocolBridge?.convexCurveGaugeExecutor||'').toLowerCase()!=='0x399382e82d9b6362ccabd1f3c763bee93e80c9e8')fail('CurveGaugeExecutor drift');
if(x.protocolBridge?.convexSourceCommit!=='242b592718ff939e0a15e490a7df9730267f0999')fail('Convex voting source pin drift');
if(x.observation?.sameBlockStateReads!==true||!Number.isInteger(Number(x.observation?.ethereumBlock))||!x.observation?.ethereumBlockHash)fail('Votium→Curve observation provenance missing');
if(x.coverage?.complete!==true||Number(x.coverage.roundCount)!==2||Number(x.coverage.completeRoundCount)!==2)fail('Votium→Curve round coverage incomplete');
if(Number(x.coverage.votiumGaugeCount)!==79||Number(x.coverage.curveExecutedVotiumGaugeCount)!==79)fail('Votium→Curve expected post-migration 79/79 gauge coverage missing');
if(!Array.isArray(x.rounds)||x.rounds.map(r=>r.roundId).join(',')!=='128,129')fail('Votium→Curve round set mismatch');

for(const r of x.rounds){
  if(r.regime!=='convex-onchain')fail(`Round ${r.roundId} is not proven onchain regime`);
  if(r.coverage?.complete!==true||Number(r.coverage.curveExecutedForVotiumGaugePct)!==100)fail(`Round ${r.roundId} Votium gauge execution coverage incomplete`);
  if(r.curveExecutor?.isDone!==true||Number(r.curveExecutor.submittedWeightBps)!==10000)fail(`Round ${r.roundId} Curve executor not complete`);
  if(!Array.isArray(r.gauges)||r.gauges.length!==Number(r.coverage.votiumIncentivizedGaugeCount))fail(`Round ${r.roundId} gauge rows missing`);
  let executedSumForSubset=0;
  for(const g of r.gauges){
    if(!/^0x[0-9a-f]{40}$/i.test(String(g.gauge||'')))fail(`Round ${r.roundId} invalid gauge`);
    if(!Number.isFinite(Number(g.votiumVotesReceived))||Number(g.votiumVotesReceived)<=0)fail(`Round ${r.roundId} Votium votes missing`);
    if(!/^\d+$/.test(String(g.convexGaugeTotalRaw||'')))fail(`Round ${r.roundId} Convex gauge total missing`);
    if(!Number.isInteger(Number(g.curveMechanicalWeightBps))||Number(g.curveMechanicalWeightBps)<0)fail(`Round ${r.roundId} Curve mechanical BPS missing`);
    if(!Number.isInteger(Number(g.curveExecutedWeightBps))||Number(g.curveExecutedWeightBps)<0)fail(`Round ${r.roundId} Curve executed BPS missing`);
    if(!/^0x[0-9a-f]{64}$/i.test(String(g.curveExecutionTxHash||''))||!Number.isInteger(Number(g.curveExecutionBlock)))fail(`Round ${r.roundId} execution event provenance missing`);
    if(g.semantics?.incentives!=='MEASURED-votium-contract'||g.semantics?.votes!=='MEASURED-votium-and-cross-contract-provenance'||g.semantics?.voteToCurveWeight!=='ATTRIBUTED-mechanical-and-execution-event'||g.semantics?.incentiveToVote!=='CORRELATED-same-round-only-not-causal')fail(`Round ${r.roundId} gauge epistemic semantics weakened`);
    executedSumForSubset+=Number(g.curveExecutedWeightBps);
  }
  if(executedSumForSubset<=0||executedSumForSubset>10000)fail(`Round ${r.roundId} invalid executed BPS subset`);
  if(r.epistemic?.incentiveToVoteCausality!=='unresolved'||r.epistemic?.downstreamLiquidityVolumeFeeEffect!=='not-yet-measured-by-v0.1'||r.epistemic?.primaryDriver!==null)fail(`Round ${r.roundId} causal boundary weakened`);
}

if(x.epistemic?.votiumIncentives!=='MEASURED'||x.epistemic?.votiumVotes!=='MEASURED'||x.epistemic?.convexToCurveWeightMechanics!=='ATTRIBUTED'||x.epistemic?.curveGaugeExecution!=='MEASURED')fail('Votium→Curve epistemic classes incomplete');
if(x.epistemic?.incentiveToVoteRelationship!=='CORRELATED-only-not-causal'||x.epistemic?.voteToExecutedCurveWeightRelationship!=='ATTRIBUTED-and-execution-confirmed'||x.epistemic?.liquidityVolumeFeesDownstream!=='UNKNOWN-not-yet-joined'||x.epistemic?.companyIncomeConnection!=='not-attributed-by-this-layer'||x.epistemic?.primaryDriver!==null)fail('Votium→Curve causal boundary weakened');
if(x.semantics?.unknownIsNotZero!==true||x.semantics?.incentiveAndVoteCoexistenceIsNotCausation!==true||x.semantics?.executedGaugeWeightIsNotPoolRevenue!==true||x.semantics?.protocolFlowIsNotRealisedCompanyIncome!==true||x.semantics?.correlationMustNotBePromotedToAttribution!==true)fail('Votium→Curve semantic invariants missing');

console.log('VLCVX VOTIUM CURVE GAUGE FLOW VERIFY PASS',{
  roundFlowHash,provenanceHash,
  rounds:x.rounds.map(r=>r.roundId),
  gauges:`${x.coverage.curveExecutedVotiumGaugeCount}/${x.coverage.votiumGaugeCount}`,
  curveExecution:x.epistemic.curveGaugeExecution,
  voteToCurve:x.epistemic.voteToExecutedCurveWeightRelationship,
  incentiveToVote:x.epistemic.incentiveToVoteRelationship,
  executionAuthority:x.authority.executionAuthority
});
