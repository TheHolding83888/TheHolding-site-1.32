#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const LEDGER_FILE = process.env.EMBEDDED_YIELD_LEDGER_FILE || path.join(ROOT, 'companies', 'embedded-yield-ledger.json');
const REQUIRED_LEDGER_VERSION = '0.4-flow-aware-recurring-checkpoints';
const HISTORY_SCHEMA = '0.1-canonical-embedded-yield-interval-history';

function finite(x) { return Number.isFinite(Number(x)); }
function round(x, d = 8) {
  const n = Number(x);
  return Number.isFinite(n) ? Number(n.toFixed(d)) : null;
}

function compareInterval(prev, curr) {
  const base = {
    startAt: prev?.timestamp || null,
    endAt: curr?.timestamp || null,
    startDate: prev?.date || null,
    endDate: curr?.date || null,
    startFlowFingerprint: prev?.flowFingerprint || null,
    endFlowFingerprint: curr?.flowFingerprint || null,
    flowFingerprintMatched: Boolean(prev?.flowFingerprint && curr?.flowFingerprint && prev.flowFingerprint === curr.flowFingerprint),
    previousLedgerComparable: prev?.ledgerComparable === true,
    currentLedgerComparable: curr?.ledgerComparable === true,
    previousValuationCanonical: prev?.valuationCanonical === true,
    currentValuationCanonical: curr?.valuationCanonical === true
  };

  if (!prev || !curr) return { ...base, status: 'warming-first-checkpoint', accepted: false, incomeUnderlying: null, incomeUsd: null, stablePriceEffectUsd: null };
  if (!prev.ledgerComparable || !curr.ledgerComparable) {
    return { ...base, status: 'warming-noncanonical-checkpoint', accepted: false, incomeUnderlying: null, incomeUsd: null, stablePriceEffectUsd: null };
  }
  if (!prev.flowFingerprint || !curr.flowFingerprint || prev.flowFingerprint !== curr.flowFingerprint) {
    return { ...base, status: 'needs-flow-reconciliation', accepted: false, incomeUnderlying: null, incomeUsd: null, stablePriceEffectUsd: null };
  }
  if (!finite(prev.underlyingAmount) || !finite(curr.underlyingAmount)) {
    return { ...base, status: 'warming-underlying-unavailable', accepted: false, incomeUnderlying: null, incomeUsd: null, stablePriceEffectUsd: null };
  }

  const prevPrice = finite(prev.terminalPriceUsd) ? Number(prev.terminalPriceUsd) : 1;
  const currPrice = finite(curr.terminalPriceUsd) ? Number(curr.terminalPriceUsd) : 1;
  const incomeUnderlying = Number(curr.underlyingAmount) - Number(prev.underlyingAmount);
  const incomeUsd = incomeUnderlying * currPrice;
  const stablePriceEffectUsd = Number(prev.underlyingAmount) * (currPrice - prevPrice);

  return {
    ...base,
    status: 'ok',
    accepted: true,
    terminalSymbol: curr.terminalSymbol || prev.terminalSymbol || null,
    incomeUnderlying: round(incomeUnderlying, 12),
    incomeUsd: round(incomeUsd, 8),
    stablePriceEffectUsd: round(stablePriceEffectUsd, 8),
    accountingIdentity: 'ending underlying − beginning underlying; valued at interval-end terminal price; stable-price effect reported separately',
    note: 'Canonical historical row reconstructed only from two persisted adjacent checkpoints under the same flow-safety rules as latestInterval.'
  };
}

if (!fs.existsSync(LEDGER_FILE)) throw new Error(`Missing Embedded Yield Ledger: ${LEDGER_FILE}`);
const ledger = JSON.parse(fs.readFileSync(LEDGER_FILE, 'utf8'));
if (ledger.version !== REQUIRED_LEDGER_VERSION) throw new Error(`Expected ${REQUIRED_LEDGER_VERSION}, got ${ledger.version}`);
if (ledger.company?.registry !== '008' || ledger.company?.name !== 'Monetra.eth') throw new Error('Monetra ledger identity mismatch');

const flattened = [];
let acceptedCount = 0;
let rejectedCount = 0;

for (const [positionId, position] of Object.entries(ledger.positions || {})) {
  const checkpoints = Array.isArray(position.checkpoints) ? [...position.checkpoints] : [];
  checkpoints.sort((a, b) => String(a.timestamp || '').localeCompare(String(b.timestamp || '')));

  const history = [];
  for (let i = 1; i < checkpoints.length; i += 1) {
    const row = {
      schemaVersion: HISTORY_SCHEMA,
      positionId,
      protocol: position.protocol || null,
      chain: position.chain || null,
      ...compareInterval(checkpoints[i - 1], checkpoints[i])
    };
    history.push(row);
    flattened.push(row);
    if (row.accepted) acceptedCount += 1; else rejectedCount += 1;
  }

  position.intervalHistory = history.slice(-399);

  const last = history.at(-1);
  const latest = position.latestInterval || {};
  if (last) {
    if ((latest.status || 'unknown') !== last.status) {
      throw new Error(`latest interval status drift for ${positionId}: stored=${latest.status} reconstructed=${last.status}`);
    }
    if (last.status === 'ok') {
      if (Math.abs(Number(latest.incomeUsd) - Number(last.incomeUsd)) > 0.00002) throw new Error(`latest income drift for ${positionId}`);
      if (Math.abs(Number(latest.stablePriceEffectUsd || 0) - Number(last.stablePriceEffectUsd || 0)) > 0.00002) throw new Error(`latest stable-price effect drift for ${positionId}`);
    }
  }
}

flattened.sort((a, b) => String(a.endAt || '').localeCompare(String(b.endAt || '')) || String(a.positionId).localeCompare(String(b.positionId)));
const accepted = flattened.filter(x => x.accepted === true && x.status === 'ok' && finite(x.incomeUsd));

ledger.methodology = {
  ...(ledger.methodology || {}),
  canonicalIntervalHistoryRule: 'Historical Embedded Yield attribution is derived only from persisted adjacent checkpoints and the same flow-safety comparability rules used by latestInterval. No APY backfill and no pre-tracking history are invented.',
  canonicalIntervalAcceptanceRule: 'Only intervalHistory rows with status=ok and accepted=true may enter future period attribution. needs-flow-reconciliation and warming rows remain explicit exclusions.'
};
ledger.intervalHistory = {
  schemaVersion: HISTORY_SCHEMA,
  generatedAt: ledger.generatedAt,
  source: 'persisted-adjacent-checkpoints',
  mutationPolicy: 'deterministic-rebuild-from-ledger-checkpoints',
  acceptedCount,
  rejectedCount,
  totalCount: flattened.length,
  coverageStartAt: flattened[0]?.startAt || null,
  coverageEndAt: flattened.at(-1)?.endAt || null,
  acceptedIncomeUsd: accepted.length ? round(accepted.reduce((s, x) => s + Number(x.incomeUsd), 0), 8) : null,
  acceptedStablePriceEffectUsd: accepted.length ? round(accepted.reduce((s, x) => s + Number(x.stablePriceEffectUsd || 0), 0), 8) : null,
  rows: flattened
};

fs.writeFileSync(LEDGER_FILE, JSON.stringify(ledger, null, 2) + '\n');

console.log('CANONICAL EMBEDDED YIELD INTERVAL HISTORY PASS', {
  schemaVersion: HISTORY_SCHEMA,
  positions: Object.keys(ledger.positions || {}).length,
  totalIntervals: flattened.length,
  acceptedIntervals: acceptedCount,
  rejectedIntervals: rejectedCount,
  acceptedIncomeUsd: ledger.intervalHistory.acceptedIncomeUsd,
  ledgerVersion: ledger.version
});
