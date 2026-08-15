import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const POLICY_PATH = path.join(ROOT, 'intelligence/realised-cash-flow/policy.json');
const policy = JSON.parse(fs.readFileSync(POLICY_PATH, 'utf8'));

export const VERSION = '0.1.1-fail-closed-realised-cash-flow-classifier';
export const POLICY_VERSION = policy.version;

const CLASSES = new Set(policy.classifications || []);
const VALUATIONS = new Set(policy.valuationStatuses || []);
const STRONG_INCOME_KINDS = new Set([
  'protocol-reward-payout',
  'protocol-fee-payout',
  'protocol-interest-payout'
]);

const clean = (value, max = 180) => {
  if (value === null || value === undefined) return null;
  const out = String(value).trim();
  return out && out.length <= max ? out : null;
};

const finiteNonNegative = value => {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

function reject(reason, detail = null) {
  return Object.freeze({ ok: false, reason, detail, row: null });
}

function identityParts(candidate) {
  const chainId = Number(candidate.chainId);
  const tx = clean(candidate.transactionHash, 80);
  const logIndex = Number(candidate.logIndex);
  const adapterId = clean(candidate.adapterId, 96);
  if (!Number.isInteger(chainId) || chainId <= 0) return null;
  if (!tx || !/^0x[a-fA-F0-9]{64}$/.test(tx)) return null;
  if (!Number.isInteger(logIndex) || logIndex < 0) return null;
  if (!adapterId) return null;
  const physicalEventId = `${chainId}:${tx.toLowerCase()}:${logIndex}`;
  return {
    chainId,
    transactionHash: tx.toLowerCase(),
    logIndex,
    adapterId,
    physicalEventId,
    eventId: `${physicalEventId}:${adapterId}`
  };
}

function explicitNonIncomeKind(kind) {
  return new Map([
    ['owner-contribution', 'contribution'],
    ['external-contribution', 'contribution'],
    ['owner-distribution', 'distribution'],
    ['external-distribution', 'distribution'],
    ['internal-transfer', 'internal-move'],
    ['bridge-settlement', 'internal-move'],
    ['swap-output', 'internal-move'],
    ['protocol-deposit-return', 'principal-return'],
    ['protocol-withdrawal', 'principal-return'],
    ['vault-redemption', 'principal-return'],
    ['lp-removal', 'principal-return'],
    ['loan-proceeds', 'borrowed-capital']
  ]).get(kind) || null;
}

export function classifyCandidate(candidate = {}) {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return reject('candidate-not-object');

  const id = identityParts(candidate);
  if (!id) return reject('invalid-event-identity');

  const evidenceTier = clean(candidate.evidenceTier, 8);
  if (!['A', 'B', 'C'].includes(evidenceTier)) return reject('invalid-evidence-tier');

  const economicKind = clean(candidate.economicKind, 64);
  if (!economicKind) return reject('missing-economic-kind');

  const direction = clean(candidate.direction, 8);
  if (!['in', 'out'].includes(direction)) return reject('invalid-direction');

  const beneficiary = clean(candidate.beneficiary, 120);
  const company = clean(candidate.company, 120);
  const protocol = clean(candidate.protocol, 120);
  const asset = clean(candidate.asset, 80);
  const token = clean(candidate.token, 80);
  const amount = finiteNonNegative(candidate.amount);
  if (!company || !asset || amount === null) return reject('missing-core-economic-fields');

  let classification = 'unknown';
  let countedAsRealisedCashFlow = false;
  const reasons = [];

  const explicitNonIncome = explicitNonIncomeKind(economicKind);
  if (explicitNonIncome) {
    classification = explicitNonIncome;
    reasons.push(`economic-kind:${economicKind}`);
  } else if (STRONG_INCOME_KINDS.has(economicKind)) {
    const semantics = candidate.protocolSemanticsVerified === true;
    const boundary = candidate.companyBoundaryVerified === true;
    const transfer = candidate.valueReceivedVerified === true;
    const principalContradiction = candidate.principalOrInternalContradiction === true;

    if (direction !== 'in') {
      reasons.push('income-payout-must-enter-company-boundary');
    } else if (evidenceTier !== 'A' && evidenceTier !== 'B') {
      reasons.push('generic-wallet-flow-cannot-prove-income');
    } else if (!semantics) {
      reasons.push('protocol-semantics-unverified');
    } else if (!boundary) {
      reasons.push('company-boundary-unverified');
    } else if (!transfer) {
      reasons.push('value-receipt-unverified');
    } else if (principalContradiction) {
      reasons.push('principal-or-internal-contradiction');
    } else {
      classification = 'realised-income';
      countedAsRealisedCashFlow = true;
      reasons.push('verified-protocol-attributed-income-receipt');
    }
  } else {
    reasons.push('economic-kind-not-proven');
  }

  if (!CLASSES.has(classification)) return reject('policy-classification-mismatch', classification);

  const valuationStatus = clean(candidate.valuationStatus, 40) || 'not-valued';
  if (!VALUATIONS.has(valuationStatus)) return reject('invalid-valuation-status', valuationStatus);
  let usdValue = finiteNonNegative(candidate.usdValue);
  if (valuationStatus === 'not-valued') usdValue = null;
  if (valuationStatus !== 'not-valued' && usdValue === null) return reject('valued-row-missing-usd-value');

  const row = Object.freeze({
    version: VERSION,
    eventId: id.eventId,
    physicalEventId: id.physicalEventId,
    adapterId: id.adapterId,
    company,
    beneficiary,
    protocol,
    chainId: id.chainId,
    transactionHash: id.transactionHash,
    logIndex: id.logIndex,
    timestamp: clean(candidate.timestamp, 64),
    direction,
    asset,
    token,
    amount,
    economicKind,
    evidenceTier,
    classification,
    countedAsRealisedCashFlow,
    valuationStatus,
    usdValue,
    evidence: Object.freeze({
      protocolSemanticsVerified: candidate.protocolSemanticsVerified === true,
      companyBoundaryVerified: candidate.companyBoundaryVerified === true,
      valueReceivedVerified: candidate.valueReceivedVerified === true,
      principalOrInternalContradiction: candidate.principalOrInternalContradiction === true,
      source: clean(candidate.source, 220)
    }),
    reasons: Object.freeze(reasons)
  });

  return Object.freeze({ ok: true, reason: null, detail: null, row });
}

export function buildLedger(candidates = [], metadata = {}) {
  if (!Array.isArray(candidates)) throw new TypeError('candidates must be an array');
  const rows = [];
  const rejected = [];
  const seenEventIds = new Set();
  const physicalEventAdapters = new Map();
  let blockingCollision = false;

  candidates.forEach((candidate, index) => {
    const result = classifyCandidate(candidate);
    if (!result.ok) {
      rejected.push({ index, reason: result.reason, detail: result.detail });
      return;
    }
    if (seenEventIds.has(result.row.eventId)) {
      rejected.push({ index, reason: 'duplicate-event-identity', detail: result.row.eventId });
      blockingCollision = true;
      return;
    }

    const previousAdapter = physicalEventAdapters.get(result.row.physicalEventId);
    if (previousAdapter && previousAdapter !== result.row.adapterId) {
      rejected.push({
        index,
        reason: 'cross-adapter-physical-event-collision',
        detail: `${result.row.physicalEventId}:${previousAdapter}|${result.row.adapterId}`
      });
      blockingCollision = true;
      return;
    }

    seenEventIds.add(result.row.eventId);
    physicalEventAdapters.set(result.row.physicalEventId, result.row.adapterId);
    rows.push(result.row);
  });

  const incomeRows = rows.filter(row => row.countedAsRealisedCashFlow);
  const valuedIncomeRows = incomeRows.filter(row => row.usdValue !== null);
  const totalsByAsset = {};
  for (const row of incomeRows) totalsByAsset[row.asset] = Number(((totalsByAsset[row.asset] || 0) + row.amount).toFixed(12));

  const coverageComplete = metadata.coverageComplete === true;
  const hasIncomeEvidence = incomeRows.length > 0;
  const status = blockingCollision ? 'blocked' : coverageComplete ? 'measured' : hasIncomeEvidence ? 'partial' : 'unknown';

  return Object.freeze({
    version: '0.1.1-realised-cash-flow-ledger',
    classifierVersion: VERSION,
    policyVersion: POLICY_VERSION,
    generatedAt: metadata.generatedAt || new Date().toISOString(),
    scope: metadata.scope || 'verification',
    coverage: Object.freeze({
      complete: coverageComplete,
      declaration: metadata.coverageDeclaration || 'Only explicitly supported evidence adapters are in scope.'
    }),
    status,
    summary: Object.freeze({
      candidateCount: candidates.length,
      acceptedRowCount: rows.length,
      rejectedRowCount: rejected.length,
      realisedIncomeEventCount: incomeRows.length,
      valuedRealisedIncomeEventCount: valuedIncomeRows.length,
      unvaluedRealisedIncomeEventCount: incomeRows.length - valuedIncomeRows.length,
      realisedCashFlowUsd: valuedIncomeRows.length === incomeRows.length
        ? Number(valuedIncomeRows.reduce((sum, row) => sum + row.usdValue, 0).toFixed(8))
        : null,
      totalsByAsset
    }),
    rows: Object.freeze(rows),
    rejected: Object.freeze(rejected),
    authority: Object.freeze({ executionAuthority: 'none', walletSigning: false, transactions: false })
  });
}
