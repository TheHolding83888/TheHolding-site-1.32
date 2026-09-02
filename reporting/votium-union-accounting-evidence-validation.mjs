#!/usr/bin/env node
import fs from 'node:fs';

const FILE=process.env.VOTIUM_UNION_ACCOUNTING_EVIDENCE_OUTPUT||'/tmp/votium-union-accounting-evidence.json';
const BASELINE=process.env.VOTIUM_UNION_ACCOUNTING_BASELINE||'reporting/votium-union-accounting-baseline.json';
const x=JSON.parse(fs.readFileSync(FILE,'utf8'));
const b=JSON.parse(fs.readFileSync(BASELINE,'utf8'));
const fail=m=>{throw new Error(m)};

if(b.version!=='0.1-votium-union-accounting-baseline'||b.status!=='historical-factual-entitlement-baseline')fail('Union factual baseline invalid');
if(b.semantics?.baselineIsPeriodIncome!==false||b.semantics?.referenceAprUsed!==false||b.semantics?.unknownIsNotZero!==true)fail('Union baseline accounting semantics drift');
if(b.authority?.executionAuthority!=='none'||b.authority?.periodIncomeAuthority!==false)fail('Union baseline authority expansion');
if(!Array.isArray(b.members)||b.members.length!==2||b.members.map(m=>m.registry).sort().join(',')!=='002,004')fail('Union factual baseline member coverage invalid');
for(const m of b.members){if(m.leaf?.proofValid!==true||m.leaf?.claimed!==false||!/^\d+$/.test(String(m.leaf?.index||''))||!/^\d+$/.test(String(m.leaf?.amountRaw||'')))fail(`Union baseline leaf invalid ${m.registry}`);}

if(x.version!=='0.2-votium-union-accounting-evidence')fail('Votium Union accounting evidence version drift');
if(x.status!=='factual-current-state-with-bounded-accrual-candidates')fail('Union evidence status drift');
if(x.authority?.readOnly!==true||x.authority?.executionAuthority!=='none'||x.authority?.walletAuthority!==false||x.authority?.capitalExecution!==false)fail('Execution authority boundary regression');
if(x.authority?.periodIncomeAuthority!==false||x.authority?.canonicalLedgerAdmissionAuthority!==false||x.authority?.monthClosingAuthority!==false)fail('Evidence probe gained ledger/month authority');
if(x.authority?.claimTransactionAuthority!=='none')fail('Claim authority regression');
if(x.protocol?.delegationProtocol!=='Votium'||x.protocol?.settlementProtocol!=='The Union'||x.accountingBoundary?.mechanism!=='votium-union-scrvusd')fail('Mechanism identity drift');
if(!/^0x[0-9a-f]{40}$/i.test(x.protocol?.distributor||''))fail('Distributor missing');
if(!/^0x[0-9a-f]{64}$/i.test(x.distribution?.merkleRoot||'')||!/^0x[0-9a-f]{64}$/i.test(x.baseline?.distribution?.merkleRoot||''))fail('Merkle boundary missing');
if(!(Number(x.distribution?.week)>Number(x.baseline?.distribution?.week)))fail('Current Union week must be newer than factual baseline');
for(const boundary of [x.baseline?.distribution?.rootEvent,x.distribution?.rootEvent]){
  if(!boundary||boundary.proofClass!=='blockscout-indexed-onchain-MerkleRootUpdated-root-week-exact-match'||!/^0x[0-9a-f]{64}$/i.test(boundary.transactionHash||'')||!(Number(boundary.blockNumber)>0)||!Number.isFinite(Date.parse(boundary.publishedAt)))fail('Exact root event boundary proof missing');
}
if(Number(x.distribution.rootEvent.blockNumber)<=Number(x.baseline.distribution.rootEvent.blockNumber))fail('Current root event must follow baseline root event');
if(!Array.isArray(x.members)||x.members.length!==2||x.members.map(m=>m.registry).sort().join(',')!=='002,004')fail('Reusable Union member coverage must include registries 002 and 004');
for(const m of x.members){
  if(m.currentRoute?.routeId!=='votium-union'||m.settlementAsset!=='scrvUSD')fail(`Current route identity drift ${m.registry}`);
  if(m.periodIncomeAuthority!==false||m.unknownIsNotZero!==true)fail(`Member accounting boundary drift ${m.registry}`);
  if(m.leaf){
    if(m.leaf.proofValid!==true||m.leaf.merkleRoot!==x.distribution.merkleRoot||Number(m.leaf.week)!==Number(x.distribution.week))fail(`Member factual leaf proof drift ${m.registry}`);
    if(!/^\d+$/.test(String(m.leaf.index))||!/^\d+$/.test(String(m.leaf.amountRaw)))fail(`Member leaf numeric identity invalid ${m.registry}`);
  }
}
if(!Array.isArray(x.intervals)||x.intervals.length!==2||x.intervals.map(i=>i.registry).sort().join(',')!=='002,004')fail('Union interval coverage invalid');
for(const i of x.intervals){
  if(i.mechanism!=='votium-union-scrvusd'||i.family!=='accrued-entitlement'||i.asset!=='scrvUSD'||i.referenceAprUsed!==false||i.executionAuthority!=='none'||i.unknownIsNotZero!==true)fail(`Union interval semantic drift ${i.registry}`);
  if(i.canonicalAdmissionEligible===true){
    if(i.status!=='factual-positive-accrual-candidate'||i.periodIncomeAuthorityCandidate!==true||i.noClaimBetweenBoundaries!==true||i.claimEventsBetweenBoundaries?.length!==0)fail(`Union candidate continuity invalid ${i.registry}`);
    if(!(BigInt(i.deltaRaw)>0n)||!(Number(i.amount)>0)||!(Number(i.usdValue)>0)||!(Number(i.valuationUnitUsd)>0)||!Number.isFinite(Date.parse(i.valuationAt)))fail(`Union candidate economics invalid ${i.registry}`);
    if(i.valuationStatus!=='frozen-at-current-proven-distribution-boundary'||i.evidenceStatus!=='prior-and-current-merkle-leaves-plus-no-claim-continuity')fail(`Union candidate evidence class invalid ${i.registry}`);
  }else if(i.status==='reconciliation-required-claim-between-boundaries'&&!(i.claimEventsBetweenBoundaries?.length>0))fail(`Union claim reconciliation lacks claim proof ${i.registry}`);
}
if(x.accountingBoundary?.family!=='accrued-entitlement'||x.accountingBoundary?.currentLeafIsPeriodIncome!==false||x.accountingBoundary?.claimStateRewritesEarnedIncome!==false||x.accountingBoundary?.referenceAprAllowedAsIncome!==false)fail('Canonical accounting semantics drift');
if(!String(x.accountingBoundary?.recognitionRule||'').includes('no member Claimed event'))fail('No-claim recognition guard missing');
if(!String(x.accountingBoundary?.claimContinuityRule||'').includes('requires reconciliation'))fail('Claim reconciliation guard missing');
if(!String(x.accountingBoundary?.decreaseRule||'').includes('never negative income'))fail('Decrease reconciliation guard missing');
if(x.accountingBoundary?.unknownIsNotZero!==true||x.diagnostics?.referenceAprUsed!==false)fail('Unknown/reference semantics drift');
if(!(Number(x.diagnostics?.admissionCandidateCount)>0)||!(Number(x.diagnostics?.admissionCandidateUsd)>0))fail('Expected at least one proven factual Union accrual candidate');
if(Number(x.diagnostics.admissionCandidateCount)!==x.intervals.filter(i=>i.canonicalAdmissionEligible===true).length)fail('Union candidate count parity drift');

console.log('VOTIUM UNION ACCOUNTING EVIDENCE VALIDATION PASS',{baselineWeek:x.baseline.distribution.week,currentWeek:x.distribution.week,members:x.members.map(m=>({registry:m.registry,status:m.entitlementStatus,claimed:m.leaf?.claimed??null})),candidates:x.intervals.filter(i=>i.canonicalAdmissionEligible).map(i=>({registry:i.registry,amount:i.amount,usdValue:i.usdValue})),candidateUsd:x.diagnostics.admissionCandidateUsd,periodIncomeAuthority:x.authority.periodIncomeAuthority,executionAuthority:x.authority.executionAuthority});
