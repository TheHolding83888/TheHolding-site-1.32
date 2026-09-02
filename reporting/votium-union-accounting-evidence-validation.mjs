#!/usr/bin/env node
import fs from 'node:fs';

const FILE=process.env.VOTIUM_UNION_ACCOUNTING_EVIDENCE_OUTPUT||'/tmp/votium-union-accounting-evidence.json';
const x=JSON.parse(fs.readFileSync(FILE,'utf8'));
const fail=m=>{throw new Error(m)};

if(x.version!=='0.1-votium-union-accounting-evidence')fail('Votium Union accounting evidence version drift');
if(x.status!=='factual-current-state-baseline-not-period-income')fail('Current entitlement must remain baseline-only');
if(x.authority?.readOnly!==true||x.authority?.executionAuthority!=='none'||x.authority?.walletAuthority!==false||x.authority?.capitalExecution!==false)fail('Execution authority boundary regression');
if(x.authority?.periodIncomeAuthority!==false||x.authority?.monthClosingAuthority!==false)fail('Baseline evidence gained accounting authority');
if(x.authority?.claimTransactionAuthority!=='none')fail('Claim authority regression');
if(x.protocol?.delegationProtocol!=='Votium'||x.protocol?.settlementProtocol!=='The Union'||x.accountingBoundary?.mechanism!=='votium-union-scrvusd')fail('Mechanism identity drift');
if(!/^0x[0-9a-f]{40}$/i.test(x.protocol?.distributor||''))fail('Distributor missing');
if(!/^0x[0-9a-f]{64}$/i.test(x.distribution?.merkleRoot||''))fail('Merkle root missing');
if(!(Number(x.distribution?.week)>0)||!Number.isFinite(Date.parse(x.distribution?.rootEvent?.publishedAt)))fail('Exact distribution week/timestamp proof missing');
if(x.distribution?.rootEvent?.proofClass!=='blockscout-indexed-onchain-MerkleRootUpdated-root-week-exact-match')fail('Root event proof class drift');
if(!/^0x[0-9a-f]{64}$/i.test(x.distribution?.rootEvent?.transactionHash||'')||!(Number(x.distribution?.rootEvent?.blockNumber)>0))fail('Root event transaction/block identity missing');
if(!Array.isArray(x.members)||x.members.length!==2||x.members.map(m=>m.registry).sort().join(',')!=='002,004')fail('Reusable Union member coverage must include registries 002 and 004');
for(const m of x.members){
  if(m.currentRoute?.routeId!=='votium-union'||m.settlementAsset!=='scrvUSD')fail(`Current route identity drift ${m.registry}`);
  if(m.periodIncomeAuthority!==false||m.unknownIsNotZero!==true)fail(`Member accounting boundary drift ${m.registry}`);
  if(m.leaf){
    if(m.leaf.proofValid!==true||m.leaf.merkleRoot!==x.distribution.merkleRoot||Number(m.leaf.week)!==Number(x.distribution.week))fail(`Member factual leaf proof drift ${m.registry}`);
    if(!/^\d+$/.test(String(m.leaf.index))||!/^\d+$/.test(String(m.leaf.amountRaw)))fail(`Member leaf numeric identity invalid ${m.registry}`);
  }
}
if(x.accountingBoundary?.family!=='accrued-entitlement'||x.accountingBoundary?.currentLeafIsPeriodIncome!==false||x.accountingBoundary?.claimStateRewritesEarnedIncome!==false||x.accountingBoundary?.referenceAprAllowedAsIncome!==false)fail('Canonical accounting semantics drift');
if(!String(x.accountingBoundary?.recognitionRule||'').includes('No income event is admitted from one current Merkle leaf'))fail('Single-snapshot no-income guard missing');
if(!String(x.accountingBoundary?.decreaseRule||'').includes('never negative income'))fail('Decrease reconciliation guard missing');
if(x.accountingBoundary?.unknownIsNotZero!==true||x.diagnostics?.referenceAprUsed!==false||Number(x.diagnostics?.admissionCandidateCount)!==0)fail('Fail-closed baseline semantics drift');

console.log('VOTIUM UNION ACCOUNTING EVIDENCE VALIDATION PASS',{week:x.distribution.week,members:x.members.map(m=>({registry:m.registry,status:m.entitlementStatus,leaf:Boolean(m.leaf),claimed:m.leaf?.claimed??null})),admissionCandidates:x.diagnostics.admissionCandidateCount,periodIncomeAuthority:x.authority.periodIncomeAuthority,executionAuthority:x.authority.executionAuthority});
