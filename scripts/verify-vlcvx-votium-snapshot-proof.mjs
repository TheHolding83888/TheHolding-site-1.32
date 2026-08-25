#!/usr/bin/env node
import fs from 'node:fs';
import crypto from 'node:crypto';

const file=process.env.VLCVX_VOTIUM_SNAPSHOT_PROOF_FILE||'intelligence/economic-graph/vlcvx-votium-snapshot-proof.json';
const roundFlowFile=process.env.VLCVX_VOTIUM_ROUND_FLOW_FILE||'intelligence/economic-graph/vlcvx-votium-round-flow.json';
const x=JSON.parse(fs.readFileSync(file,'utf8'));
const roundFlowHash=crypto.createHash('sha256').update(fs.readFileSync(roundFlowFile)).digest('hex');
function fail(message){throw new Error(message);}

if(x.version!=='0.2-vlcvx-votium-voting-provenance')fail('Votium voting provenance version mismatch');
if(x.engineVersion!=='0.2-transition-aware-snapshot-to-convex-onchain')fail('Votium voting provenance engine mismatch');
if(x.status!=='shadow-voting-provenance-proven')fail(`Votium voting provenance incomplete: ${x.status}`);
if(x.authority?.readOnly!==true||x.authority?.executionAuthority!=='none'||x.authority?.causalClaimAuthority!=='none'||x.authority?.promotionAuthority!=='none')fail('Votium voting provenance authority regression');
if(x.sourceBinding?.roundFlowSha256!==roundFlowHash)fail('Votium voting provenance not bound to exact round-flow bytes');
if(x.sourceBinding?.candidateId!=='defitea-convex-vlcvx-votium'||x.sourceBinding?.companyRegistry!=='004')fail('Votium voting provenance candidate binding mismatch');
if(x.sourceAuthority?.legacyVotium?.contractCommit!=='e01cf1401c67cb81cfbd5158654b878bd9db1102'||x.sourceAuthority?.legacyVotium?.toolingCommit!=='f7f02dccbcff65acf6a35fe692481f1119452a8a')fail('Legacy Votium source pin drift');
if(x.sourceAuthority?.convexOnchain?.commit!=='242b592718ff939e0a15e490a7df9730267f0999')fail('Convex onchain voting source pin drift');
if(String(x.sourceAuthority?.convexOnchain?.currentCurveGaugeVoting||'').toLowerCase()!=='0x64d9b5ac386b70af9edcd20a58ce9262d2eac278')fail('Current Curve GaugeVotePlatform address drift');
if(x.transition?.lastLegacyRound!==127||x.transition?.firstConvexOnchainRound!==128||x.transition?.boundaryStatus!=='live-cross-source-proven')fail('Votium voting transition boundary not proven');
if(!Array.isArray(x.rounds)||x.rounds.length!==3||x.rounds.map(r=>r.roundId).join(',')!=='127,128,129')fail('Votium voting provenance round set mismatch');
if(x.coverage?.complete!==true||Number(x.coverage.provenRoundCount)!==3||Number(x.coverage.legacySnapshotRoundCount)!==1||Number(x.coverage.convexOnchainRoundCount)!==2)fail('Votium voting provenance coverage incomplete');
if(Number(x.coverage.onchainVotiumGaugeCount)<=0||Number(x.coverage.onchainExactGaugeMatchCount)!==Number(x.coverage.onchainVotiumGaugeCount))fail('Post-migration Votium/onchain gauge equality incomplete');

const legacy=x.rounds[0];
if(legacy.regime!=='legacy-snapshot'||legacy.status!=='proven')fail('Round 127 legacy Snapshot regime missing');
if(legacy.snapshot?.status!=='exact-official-window-title-match'||Number(legacy.snapshot?.candidateCount)!==1||!legacy.snapshot?.proposal?.id)fail('Round 127 Snapshot proposal not uniquely bound');
if(!String(legacy.snapshot.proposal.title||'').startsWith('Gauge Weight for Week'))fail('Round 127 Snapshot proposal title mismatch');
if(Number(legacy.snapshot.proposal.snapshotBlock)<=0)fail('Round 127 Snapshot block missing');

for(const row of x.rounds.slice(1)){
  if(row.regime!=='convex-onchain'||row.status!=='proven')fail(`Round ${row.roundId} onchain regime missing`);
  if(row.snapshot?.status!=='no-official-window-match'||Number(row.snapshot?.candidateCount)!==0)fail(`Round ${row.roundId} unexpected legacy Snapshot match`);
  const p=row.currentOnchainProposal;
  if(!p||String(p.platformAddress||'').toLowerCase()!=='0x64d9b5ac386b70af9edcd20a58ce9262d2eac278')fail(`Round ${row.roundId} current onchain proposal missing`);
  if(p.startAt!==row.roundStart)fail(`Round ${row.roundId} onchain proposal not anchored to exact round start`);
  if(!p.comparison?.complete||Number(p.comparison.coveragePct)!==100||Number(p.comparison.exactCeilMatchPct)!==100)fail(`Round ${row.roundId} Votium/onchain gauge proof incomplete`);
  if(Number(p.comparison.onchainMatchedGaugeCount)!==Number(p.comparison.votiumGaugeCount)||Number(p.comparison.exactCeilMatchCount)!==Number(p.comparison.votiumGaugeCount))fail(`Round ${row.roundId} Votium/onchain gauge counts mismatch`);
  if(!Array.isArray(p.comparison.gauges)||p.comparison.gauges.length!==Number(p.comparison.votiumGaugeCount))fail(`Round ${row.roundId} gauge proof rows missing`);
  for(const gauge of p.comparison.gauges){
    if(!/^0x[0-9a-f]{40}$/i.test(String(gauge.gauge||'')))fail(`Round ${row.roundId} invalid gauge`);
    if(!/^\d+$/.test(String(gauge.votiumVotesReceived||''))||!/^\d+$/.test(String(gauge.onchainGaugeTotalRaw||''))||!/^\d+$/.test(String(gauge.onchainGaugeTotalCeilVlCvx||'')))fail(`Round ${row.roundId} gauge vote evidence missing`);
    if(gauge.exactCeilEquality!==true||String(gauge.votiumVotesReceived)!==String(gauge.onchainGaugeTotalCeilVlCvx))fail(`Round ${row.roundId} exact ceiling equality failed for ${gauge.gauge}`);
  }
}

if(x.voteUnitSemantics?.status!=='proven-human-scale-vlcvx-voting-power'||x.voteUnitSemantics?.postMigrationClass!=='ceil-of-convex-onchain-18dp-vlcvx-gauge-total')fail('Votium vote-unit semantics not proven');
if(x.epistemic?.votingSourceTransition!=='attributed-by-live-cross-source-mechanics'||x.epistemic?.postMigrationGaugeEquality!=='measured-exact-integer-ceiling-equality')fail('Votium voting provenance epistemics incomplete');
if(x.epistemic?.incentiveToVoteCausality!=='not-claimed'||x.epistemic?.downstreamCurveEconomicCausality!=='not-claimed'||x.epistemic?.companyIncomeConnection!=='not-attributed-by-this-layer'||x.epistemic?.primaryDriver!==null)fail('Votium voting provenance causal boundary weakened');
if(x.semantics?.unknownIsNotZero!==true||x.semantics?.missingSnapshotAfterMigrationIsExpected!==true||x.semantics?.proposalAssociationIsNotEconomicCausation!==true||x.semantics?.votingSourceProofIsNotIncentiveCausality!==true||x.semantics?.protocolVotingPowerIsNotRealisedCompanyIncome!==true)fail('Votium voting provenance semantic invariants missing');

console.log('VLCVX VOTIUM VOTING PROVENANCE VERIFY PASS',{
  roundFlowHash,
  transition:`${x.transition.lastLegacyRound}->${x.transition.firstConvexOnchainRound}`,
  provenRounds:x.coverage.provenRoundCount,
  exactPostMigrationGauges:`${x.coverage.onchainExactGaugeMatchCount}/${x.coverage.onchainVotiumGaugeCount}`,
  voteUnitSemantics:x.voteUnitSemantics.status,
  promotionAuthority:x.authority.promotionAuthority,
  executionAuthority:x.authority.executionAuthority
});
