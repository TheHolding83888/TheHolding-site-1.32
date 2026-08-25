#!/usr/bin/env node
import fs from 'node:fs';
import crypto from 'node:crypto';

const file=process.env.VLCVX_VOTIUM_SNAPSHOT_PROOF_FILE||'intelligence/economic-graph/vlcvx-votium-snapshot-proof.json';
const roundFlowFile=process.env.VLCVX_VOTIUM_ROUND_FLOW_FILE||'intelligence/economic-graph/vlcvx-votium-round-flow.json';
const x=JSON.parse(fs.readFileSync(file,'utf8'));
const roundFlowHash=crypto.createHash('sha256').update(fs.readFileSync(roundFlowFile)).digest('hex');
function fail(message){throw new Error(message);}

if(x.version!=='0.1-vlcvx-votium-snapshot-proof')fail('Votium Snapshot proof version mismatch');
if(x.engineVersion!=='0.1-official-votium-snapshot-methodology-proof')fail('Votium Snapshot proof engine mismatch');
if(x.status!=='shadow-source-and-live-mapping-proven')fail(`Votium Snapshot proof incomplete: ${x.status}`);
if(x.authority?.readOnly!==true||x.authority?.executionAuthority!=='none'||x.authority?.causalClaimAuthority!=='none'||x.authority?.promotionAuthority!=='none')fail('Votium Snapshot proof authority regression');
if(x.sourceBinding?.roundFlowSha256!==roundFlowHash)fail('Votium Snapshot proof not bound to exact round-flow bytes');
if(x.sourceBinding?.candidateId!=='defitea-convex-vlcvx-votium'||x.sourceBinding?.companyRegistry!=='004')fail('Votium Snapshot proof candidate binding mismatch');
if(x.officialMethodologyEvidence?.votiumContract?.commit!=='e01cf1401c67cb81cfbd5158654b878bd9db1102')fail('Votium contract source pin drift');
if(x.officialMethodologyEvidence?.votiumJs?.commit!=='f7f02dccbcff65acf6a35fe692481f1119452a8a')fail('Votium tooling source pin drift');
if(x.officialMethodologyEvidence?.roundProposalRule?.space!=='cvx.eth'||x.officialMethodologyEvidence?.roundProposalRule?.titlePrefix!=='Gauge Weight for Week')fail('Votium official Snapshot mapping rule drift');
if(x.voteUnitSemantics?.status!=='source-proven-human-scale-vlcvx-voting-power'||x.voteUnitSemantics?.decimalRescalingRequired!==false)fail('Votium vote-unit semantics not proven');
if(x.voteUnitSemantics?.liveSnapshotVoteRecomputation!=='not-yet-performed-by-v0.1')fail('Votium Snapshot proof overstates live vote recomputation');
if(!Array.isArray(x.roundMappings)||x.roundMappings.length<2)fail('Votium Snapshot proof round depth insufficient');
if(Number(x.coverage?.requestedRounds)!==x.roundMappings.length||Number(x.coverage?.exactMappedRounds)!==x.roundMappings.length||x.coverage?.complete!==true)fail('Votium Snapshot proposal coverage incomplete');

const ids=new Set();
for(const row of x.roundMappings){
  if(row.mappingStatus!=='exact-official-window-title-match')fail(`Round ${row.roundId} Snapshot proposal unresolved`);
  if(Number(row.candidateCount)!==1)fail(`Round ${row.roundId} Snapshot proposal ambiguous`);
  if(!row.proposal?.id||!String(row.proposal.title||'').startsWith('Gauge Weight for Week'))fail(`Round ${row.roundId} Snapshot proposal identity missing`);
  if(ids.has(row.proposal.id))fail(`Snapshot proposal reused across rounds: ${row.proposal.id}`);
  ids.add(row.proposal.id);
  if(Number(row.proposal.created)<=Number(row.roundStartUnix)||Number(row.proposal.created)>=Number(row.proposalWindowEndUnix))fail(`Round ${row.roundId} proposal outside official window`);
  if(!Number.isFinite(Number(row.proposal.snapshotBlock))||Number(row.proposal.snapshotBlock)<=0)fail(`Round ${row.roundId} Snapshot block missing`);
  if(!Array.isArray(row.proposal.choices)||Number(row.proposal.choiceCount)!==row.proposal.choices.length||row.proposal.choices.length<1)fail(`Round ${row.roundId} Snapshot choices missing`);
  if(!/^\d+$/.test(String(row.onchainRound?.totalVotesReceivedRaw||'')))fail(`Round ${row.roundId} onchain votes missing`);
  if(!Number.isFinite(Number(row.onchainRound?.totalVotesReceivedContractUnits))||Number(row.onchainRound.totalVotesReceivedContractUnits)<=0)fail(`Round ${row.roundId} human-scale vote total missing`);
}

if(x.epistemic?.proposalMapping!=='measured-live-snapshot-plus-official-rule')fail('Votium Snapshot proposal epistemics weakened');
if(x.epistemic?.voteUnitMeaning!=='attributed-by-official-votium-accounting-and-tooling-mechanics')fail('Votium vote-unit attribution missing');
if(x.epistemic?.liveVoteTotalEquality!=='not-recomputed-by-v0.1'||x.epistemic?.incentiveToVoteCausality!=='not-claimed'||x.epistemic?.downstreamCurveEconomicCausality!=='not-claimed'||x.epistemic?.companyIncomeConnection!=='not-attributed-by-this-layer'||x.epistemic?.primaryDriver!==null)fail('Votium Snapshot epistemic boundary weakened');
if(x.semantics?.unknownIsNotZero!==true||x.semantics?.proposalAssociationIsNotCausation!==true||x.semantics?.sourceMechanicsCanProveUnitMeaningWithoutProvingEconomicCause!==true||x.semantics?.snapshotVotePowerIsNotRealisedCompanyIncome!==true||x.semantics?.roundIncentivesDoNotByThemselvesProveVoteMigrationCause!==true)fail('Votium Snapshot semantic invariants missing');

console.log('VLCVX VOTIUM SNAPSHOT PROOF VERIFY PASS',{
  roundFlowHash,
  rounds:x.roundMappings.map(row=>row.roundId),
  proposalIds:x.roundMappings.map(row=>row.proposal.id),
  voteUnitSemantics:x.voteUnitSemantics.status,
  liveVoteTotalEquality:x.epistemic.liveVoteTotalEquality,
  promotionAuthority:x.authority.promotionAuthority,
  executionAuthority:x.authority.executionAuthority
});
