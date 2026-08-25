#!/usr/bin/env node
import fs from 'node:fs';
import crypto from 'node:crypto';

const file=process.env.VLCVX_VOTIUM_ROUND_FLOW_FILE||'intelligence/economic-graph/vlcvx-votium-round-flow.json';
const graphFile=process.env.ECONOMIC_GRAPH_FILE||'intelligence/economic-graph/economic-graph.json';
const x=JSON.parse(fs.readFileSync(file,'utf8'));
const graphHash=crypto.createHash('sha256').update(fs.readFileSync(graphFile)).digest('hex');
function fail(message){throw new Error(message);}

if(x.version!=='0.1-vlcvx-votium-round-flow')fail('Votium round-flow version mismatch');
if(x.engineVersion!=='0.1.1-votium-v2-contract-unit-safe-round-accounting')fail('Votium round-flow engine mismatch');
if(x.status!=='shadow-measured-not-promoted')fail('Votium round-flow shadow status missing');
if(x.authority?.readOnly!==true||x.authority?.executionAuthority!=='none'||x.authority?.causalClaimAuthority!=='none'||x.authority?.promotionAuthority!=='none')fail('Votium round-flow authority regression');
if(x.sourceBinding?.candidateId!=='defitea-convex-vlcvx-votium'||x.sourceBinding?.currentRouteId!=='votium-union')fail('Votium candidate binding mismatch');
if(x.sourceBinding?.economicGraphSha256!==graphHash)fail('Votium round-flow not bound to exact Economic Graph bytes');
if(x.protocol?.chain!=='Ethereum'||String(x.protocol?.contract||'').toLowerCase()!=='0x63942e31e98f1833a234077f47880a66136a2d1e')fail('Votium v2 contract authority drift');
if(x.protocol?.sameBlockRead!==true||!Number.isFinite(Number(x.protocol?.observationBlock))||!x.protocol?.observationBlockHash)fail('Votium same-block provenance missing');
if(!Number.isInteger(Number(x.roundState?.lastRoundProcessed))||Number(x.roundState.lastRoundProcessed)<1)fail('Votium last processed round missing');
if(!Array.isArray(x.completedRounds)||x.completedRounds.length<2)fail('Votium completed round depth insufficient');
if(Number(x.coverage?.measuredCompletedRounds)!==x.completedRounds.length||x.coverage?.latestProcessedRoundIncluded!==true)fail('Votium completed round coverage mismatch');
if(Number(x.latestCompletedRound?.roundId)!==Number(x.roundState.lastRoundProcessed))fail('Latest processed Votium round not materialized');

for(const round of x.completedRounds){
  if(round.status!=='completed-processed')fail(`Round ${round.roundId} status mismatch`);
  if(!/^\d+$/.test(String(round.totalVotesReceivedRaw||'')))fail(`Round ${round.roundId} raw vote total missing`);
  if(Object.hasOwn(round,'totalVotesReceivedVlCvx'))fail(`Round ${round.roundId} must not infer vlCVX units from Votium contract vote total`);
  if(round.voteUnitClass!=='contract-native-scale-unresolved')fail(`Round ${round.roundId} vote unit boundary missing`);
  if(!Array.isArray(round.gauges)||Number(round.gaugeCount)!==round.gauges.length)fail(`Round ${round.roundId} gauge coverage mismatch`);
  if(!Array.isArray(round.tokenFlows))fail(`Round ${round.roundId} token flows missing`);
  if(round.usdTotals?.knownUsd!==null||round.usdTotals?.complete!==false)fail(`Round ${round.roundId} must not fabricate USD valuation`);
  for(const gauge of round.gauges){
    if(!/^0x[0-9a-f]{40}$/i.test(String(gauge.gauge||'')))fail(`Round ${round.roundId} invalid gauge`);
    if(!/^\d+$/.test(String(gauge.votesReceivedRaw||'')))fail(`Round ${round.roundId} invalid votesReceived`);
    if(Object.hasOwn(gauge,'votesReceivedVlCvx'))fail(`Round ${round.roundId} gauge must not infer vlCVX units`);
    if(gauge.voteUnitClass!=='contract-native-scale-unresolved')fail(`Round ${round.roundId} gauge vote unit boundary missing`);
    if(!Array.isArray(gauge.incentives)||Number(gauge.incentiveCount)!==gauge.incentives.length)fail(`Round ${round.roundId} incentive coverage mismatch`);
    for(const incentive of gauge.incentives){
      if(!/^0x[0-9a-f]{40}$/i.test(String(incentive.token?.address||'')))fail(`Round ${round.roundId} incentive token missing`);
      for(const key of ['contractAmountRaw','distributedRaw','recycledRaw'])if(!/^\d+$/.test(String(incentive[key]||'')))fail(`Round ${round.roundId} ${key} missing`);
      if(incentive.semanticClass!=='measured-votium-v2-incentive-accounting-state')fail(`Round ${round.roundId} incentive semantics weakened`);
    }
  }
  if(round.epistemic?.voteUnitSemantics!=='contract-native-unit-scale-unresolved'||round.epistemic?.causalAttribution!=='unresolved'||round.epistemic?.primaryDriver!==null)fail(`Round ${round.roundId} epistemic boundary weakened`);
}
if(x.epistemic?.voteUnitSemantics!=='contract-native-unit-scale-unresolved'||x.epistemic?.usdValuation!=='unknown-in-v0.1'||x.epistemic?.companyIncomeConnection!=='not-attributed-by-this-layer'||x.epistemic?.primaryDriver!==null)fail('Votium epistemic boundary weakened');
if(x.semantics?.unknownIsNotZero!==true||x.semantics?.contractAccountingIsNotUsdValuation!==true||x.semantics?.voteUnitScaleUnresolved!==true||x.semantics?.incentiveAndVoteCoexistenceIsNotCausation!==true||x.semantics?.protocolRoundFlowIsNotRealisedCompanyIncome!==true)fail('Votium semantic invariants missing');

console.log('VLCVX VOTIUM ROUND FLOW VERIFY PASS',{
  graphHash,
  block:x.protocol.observationBlock,
  activeRound:x.roundState.activeRound,
  lastRoundProcessed:x.roundState.lastRoundProcessed,
  measuredRounds:x.completedRounds.length,
  latestGaugeCount:x.latestCompletedRound.gaugeCount,
  latestIncentiveCount:x.latestCompletedRound.incentiveCount,
  latestVotesContractUnits:x.latestCompletedRound.totalVotesReceivedContractUnits,
  voteUnitSemantics:x.epistemic.voteUnitSemantics,
  usdValuation:x.epistemic.usdValuation,
  primaryDriver:x.epistemic.primaryDriver,
  promotionAuthority:x.authority.promotionAuthority,
  executionAuthority:x.authority.executionAuthority
});
