#!/usr/bin/env node
import fs from 'node:fs';

const file = process.argv[2] || 'intelligence/realised-cash-flow/realised-cash-flow.json';
const x = JSON.parse(fs.readFileSync(file, 'utf8'));
const fail = message => { throw new Error(message); };

if (x?.version !== '0.2-yield-basis-live-realised-cash-flow') fail(`unexpected version ${x?.version}`);
if (!['partial', 'unknown'].includes(x?.status)) fail(`unexpected system status ${x?.status}`);
if (x?.methodology?.overallCoverageComplete !== false) fail('overall coverage must remain incomplete');
if (x?.methodology?.askPromotionEligible !== false) fail('Ask promotion must remain disabled');
if (x?.scan?.fromBlock !== 0 || x?.scan?.complete !== true) fail('historical scan is not declared complete from block 0');
if (!Number.isInteger(Number(x?.scan?.toBlock)) || Number(x.scan.toBlock) <= 0) fail('invalid scan toBlock');
if (x?.source?.contract?.toLowerCase() !== '0xd11b416573ebc59b6b2387da0d2c0d1b3b1f7a90') fail('unexpected Yield Basis FeeDistributor');
if (x?.source?.upstreamBlobSha !== '8456fa2298f30692694f1e0f810b7cd404990fc7') fail('upstream source binding drift');
if (x?.authority?.executionAuthority !== 'none' || x?.authority?.walletSigning !== false || x?.authority?.transactions !== false || x?.authority?.capitalMovement !== false) fail('authority drift');
if (x?.summary?.realisedCashFlowUsd !== null) fail('v0.2 must not fabricate aggregate historical USD');

const companies = Object.values(x?.companies || {});
if (companies.length !== Number(x?.summary?.companyCount)) fail('company summary mismatch');

let eventCount = 0;
let companyWithClaims = 0;
const eventIds = new Set();
const physicalIds = new Set();
const proofKeys = new Set();
for (const company of companies) {
  if (company?.adapterCoverage?.status !== 'measured' || company?.adapterCoverage?.completeForDeclaredLane !== true) {
    fail('declared Yield Basis lane is not measured');
  }
  if (company?.ledger?.coverage?.complete !== false) fail('company-wide economic coverage was promoted prematurely');
  if (company?.ledger?.authority?.executionAuthority !== 'none') fail('ledger authority drift');
  if (company?.ledger?.summary?.realisedCashFlowUsd !== null && company?.ledger?.summary?.realisedIncomeEventCount > 0) {
    fail('company ledger fabricated historical USD');
  }
  const rows = company?.ledger?.rows || [];
  const proofs = company?.proofs || [];
  if (Number(company?.directClaimEventCount) !== rows.length || proofs.length !== rows.length) fail('row/proof count mismatch');
  if (rows.length) companyWithClaims += 1;

  for (const proof of proofs) {
    if (proof?.contract?.toLowerCase() !== x.source.contract.toLowerCase()) fail('proof contract drift');
    if (proof?.claimUser?.toLowerCase() !== proof?.beneficiary?.toLowerCase()) fail('v0.2 proof escaped direct Claim.user lane');
    if (proof?.matchingTransfer?.from?.toLowerCase() !== x.source.contract.toLowerCase()) fail('matching transfer does not originate at FeeDistributor');
    if (proof?.matchingTransfer?.to?.toLowerCase() !== proof?.beneficiary?.toLowerCase()) fail('matching transfer beneficiary mismatch');
    if (String(proof?.matchingTransfer?.valueRaw) !== String(proof?.amountRaw)) fail('matching transfer amount mismatch');
    const key = `${String(proof.transactionHash).toLowerCase()}:${proof.claimLogIndex}`;
    if (proofKeys.has(key)) fail(`duplicate proof ${key}`);
    proofKeys.add(key);
  }

  for (const row of rows) {
    eventCount += 1;
    if (row?.adapterId !== 'yield-basis-fee-distributor-claim') fail('unexpected adapter row');
    if (row?.protocol !== 'Yield Basis') fail('unexpected protocol row');
    if (row?.chainId !== 1) fail('unexpected chain row');
    if (row?.evidenceTier !== 'A' || row?.economicKind !== 'protocol-fee-payout') fail('unexpected economic classification inputs');
    if (row?.classification !== 'realised-income' || row?.countedAsRealisedCashFlow !== true) fail('verified payout did not classify as realised income');
    if (row?.valuationStatus !== 'not-valued' || row?.usdValue !== null) fail('historical valuation boundary drift');
    if (row?.beneficiary?.toLowerCase() === undefined) fail('missing beneficiary');
    if (eventIds.has(row.eventId)) fail(`duplicate eventId ${row.eventId}`);
    if (physicalIds.has(row.physicalEventId)) fail(`duplicate physicalEventId ${row.physicalEventId}`);
    eventIds.add(row.eventId);
    physicalIds.add(row.physicalEventId);
    const proofKey = `${String(row.transactionHash).toLowerCase()}:${row.logIndex}`;
    if (!proofKeys.has(proofKey)) fail(`ledger row has no exact matching proof ${proofKey}`);
  }
}

if (eventCount !== Number(x?.summary?.realisedIncomeEventCount)) fail('system realisedIncomeEventCount mismatch');
if (companyWithClaims !== Number(x?.summary?.companiesWithDirectClaims)) fail('companiesWithDirectClaims mismatch');
if (eventCount !== Number(x?.scan?.matchedDirectCompanyClaimLogCount)) fail('matched scan count does not reconcile to ledger');

const statusExpected = eventCount > 0 ? 'partial' : 'unknown';
if (x.status !== statusExpected) fail(`system status ${x.status} != ${statusExpected}`);

console.log(JSON.stringify({
  status: 'PASS',
  version: '0.2-independent-live-realised-cash-flow-review',
  sourceScanComplete: true,
  companyCount: companies.length,
  companiesWithDirectClaims: companyWithClaims,
  realisedIncomeEventCount: eventCount,
  historicalUsdTotal: null,
  askPromotionEligible: false,
  executionAuthority: 'none'
}, null, 2));
