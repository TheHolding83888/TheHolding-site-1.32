#!/usr/bin/env node
/**
 * The Holding · Canonical Earned Income View v0.1
 *
 * Pure read-only interpretation of admitted Canonical Income Ledger events.
 * It never derives income from current balances, claimable snapshots, APRs,
 * wallet deltas, or generic receipts. A raw event is allowed into owner-facing
 * earned-income totals only when its recognition semantics are non-overlapping.
 */

const VERSION = '0.1-canonical-earned-income-view';
const HISTORICAL_VALUATION_RESOLUTION_VERSION = '0.1-canonical-historical-valuation-resolution';
const HISTORICAL_VALUATION_SOURCE_FAMILIES = new Set([
  'canonical-market-data-git-history',
  'historical-onchain-chainlink-at-boundary'
]);
const finite = v => v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v));
const round = (v, d = 8) => finite(v) ? Math.round(Number(v) * 10 ** d) / 10 ** d : null;

function monthKey(v) {
  const t = Date.parse(v || '');
  return Number.isFinite(t) ? new Date(t).toISOString().slice(0, 7) : null;
}

function eventMonth(event) {
  if (event?.family === 'embedded-income') {
    const start = monthKey(event.periodStart);
    const end = monthKey(event.periodEnd);
    return start && start === end ? end : null;
  }
  return monthKey(event?.economicDate || event?.periodEnd);
}

function historicalValuationSourceValid(resolution, boundaryMs, observedMs) {
  const family = resolution?.sourceFamily;
  if (!HISTORICAL_VALUATION_SOURCE_FAMILIES.has(family)) return false;
  if (family === 'canonical-market-data-git-history') return true;

  if (
    resolution?.sourceStatus !== 'historical-onchain-chainlink-price' ||
    Number(resolution?.sourceChainId) !== 10 ||
    !Number.isSafeInteger(Number(resolution?.sourceBlockNumber)) || Number(resolution.sourceBlockNumber) <= 0 ||
    resolution?.exactHistoricalBlock !== true ||
    !/^0x[0-9a-f]{40}$/i.test(String(resolution?.sourceContract || '')) ||
    !/^\d+$/.test(String(resolution?.sourceRoundId || '')) ||
    !/^\d+$/.test(String(resolution?.sourceAnsweredInRound || ''))
  ) return false;
  const blockMs = Date.parse(resolution?.sourceBlockTimestamp || '');
  if (!Number.isFinite(blockMs) || blockMs > boundaryMs || observedMs > blockMs) return false;
  try {
    if (BigInt(resolution.sourceRoundId) <= 0n || BigInt(resolution.sourceAnsweredInRound) < BigInt(resolution.sourceRoundId)) return false;
  } catch { return false; }
  return true;
}

function resolvedUsdValue(event) {
  if (finite(event?.usdValue)) return round(event.usdValue, 8);
  const r = event?.valuationResolution || null;
  if (
    r?.version !== HISTORICAL_VALUATION_RESOLUTION_VERSION ||
    r?.resolvesUsdValue !== true ||
    r?.economicFieldsMutated !== false ||
    r?.referenceAprUsed !== false ||
    r?.currentPriceUsed !== false ||
    r?.unknownIsNotZero !== true ||
    r?.executionAuthority !== 'none' ||
    r?.originalUsdValue !== null ||
    String(r?.boundaryAt || '') !== String(event?.periodEnd || '') ||
    !finite(event?.amount) || Number(event.amount) <= 0 ||
    !finite(r?.valuationUnitUsd) || Number(r.valuationUnitUsd) <= 0 ||
    !finite(r?.resolvedUsdValue) || Number(r.resolvedUsdValue) <= 0
  ) return null;
  const observedMs = Date.parse(r.observedAt || '');
  const boundaryMs = Date.parse(r.boundaryAt || '');
  if (!Number.isFinite(observedMs) || !Number.isFinite(boundaryMs) || observedMs > boundaryMs) return null;
  if (!historicalValuationSourceValid(r, boundaryMs, observedMs)) return null;
  const expected = round(Number(event.amount) * Number(r.valuationUnitUsd), 8);
  const actual = round(r.resolvedUsdValue, 8);
  if (!finite(expected) || !finite(actual) || Math.abs(Number(expected) - Number(actual)) > 0.00000002) return null;
  return actual;
}

function recognitionDecision(event) {
  if (!event?.eventKey || !event?.company || !event?.family) {
    return { status: 'unresolved', reason: 'canonical-event-identity-incomplete' };
  }
  if (!finite(resolvedUsdValue(event))) {
    return { status: 'unresolved', reason: 'canonical-event-usd-valuation-incomplete' };
  }
  const month = eventMonth(event);
  if (!month) {
    return { status: 'unresolved', reason: 'period-boundary-not-single-month' };
  }

  if (event.family === 'accrued-entitlement') {
    return {
      status: 'recognized',
      month,
      recognitionBasis: 'canonical-earned-accrual',
      settlementStatus: 'earned-not-dependent-on-claim'
    };
  }

  if (event.family === 'embedded-income') {
    return {
      status: 'recognized',
      month,
      recognitionBasis: 'canonical-embedded-income-interval',
      settlementStatus: 'earned-inside-position'
    };
  }

  if (event.family === 'realised-cash-flow') {
    const explicit = event?.incomeRecognition || null;
    if (explicit?.recognizesEarnedIncome === true && explicit?.recognitionId) {
      return {
        status: 'recognized',
        month,
        recognitionBasis: explicit.recognitionBasis || 'mechanism-specific-first-recognition-at-settlement',
        recognitionId: String(explicit.recognitionId),
        settlementStatus: explicit.settlementStatus || 'settled'
      };
    }
    if (explicit?.recognizesEarnedIncome === false && explicit?.settlementOf) {
      return {
        status: 'settlement-only',
        month,
        reason: 'settlement-of-prior-earned-income',
        settlementOf: String(explicit.settlementOf)
      };
    }
    return {
      status: 'unresolved',
      month,
      reason: 'realised-receipt-lacks-non-overlap-recognition-proof'
    };
  }

  return { status: 'unresolved', month, reason: 'unsupported-economic-family' };
}

function buildCanonicalEarnedIncomeView(ledger) {
  if (ledger?.version !== '0.1-canonical-income-ledger') {
    throw new Error('Canonical Earned Income View requires Canonical Income Ledger v0.1');
  }
  if (ledger?.semantics?.unknownIsNotZero !== true || ledger?.semantics?.referenceAprCanBackfillEarnedIncome !== false) {
    throw new Error('Canonical Income Ledger epistemic contract invalid');
  }

  const recognized = [];
  const settlements = [];
  const unresolved = [];
  const recognitionIds = new Map();

  for (const event of ledger.events || []) {
    const decision = recognitionDecision(event);
    const effectiveUsdValue = resolvedUsdValue(event);
    const base = {
      eventKey: event.eventKey,
      company: event.company,
      family: event.family,
      route: event.route || null,
      protocol: event.protocol || null,
      asset: event.asset || null,
      amount: event.amount ?? null,
      usdValue: finite(effectiveUsdValue) ? round(effectiveUsdValue, 8) : null,
      economicDate: event.economicDate || null,
      periodStart: event.periodStart || null,
      periodEnd: event.periodEnd || null,
      sourceIdentity: event.sourceIdentity || null,
      immutableEconomicFieldsHash: event.immutableEconomicFieldsHash || null,
      valuationResolutionVersion: event?.valuationResolution?.version || null,
      executionAuthority: 'none'
    };

    if (decision.status === 'recognized') {
      const recognitionId = decision.recognitionId || `earned:${event.eventKey}`;
      if (recognitionIds.has(recognitionId) && recognitionIds.get(recognitionId) !== event.eventKey) {
        throw new Error(`Earned-income recognition collision: ${recognitionId}`);
      }
      recognitionIds.set(recognitionId, event.eventKey);
      recognized.push({
        ...base,
        month: decision.month,
        recognitionId,
        recognitionBasis: decision.recognitionBasis,
        settlementStatus: decision.settlementStatus,
        recognizesEarnedIncome: true
      });
    } else if (decision.status === 'settlement-only') {
      settlements.push({
        ...base,
        month: decision.month,
        recognizesEarnedIncome: false,
        settlementOf: decision.settlementOf,
        reason: decision.reason
      });
    } else {
      unresolved.push({
        ...base,
        month: decision.month || null,
        recognizesEarnedIncome: false,
        reason: decision.reason
      });
    }
  }

  const byCompanyMonth = {};
  for (const row of recognized) {
    if (!byCompanyMonth[row.company]) byCompanyMonth[row.company] = {};
    if (!byCompanyMonth[row.company][row.month]) {
      byCompanyMonth[row.company][row.month] = {
        month: row.month,
        recognizedEventCount: 0,
        recognizedIncomeUsd: 0,
        families: { accruedEntitlement: 0, embeddedIncome: 0, realisedCashFlow: 0 }
      };
    }
    const m = byCompanyMonth[row.company][row.month];
    m.recognizedEventCount += 1;
    m.recognizedIncomeUsd = round(Number(m.recognizedIncomeUsd) + Number(row.usdValue), 8);
    if (row.family === 'accrued-entitlement') m.families.accruedEntitlement += 1;
    if (row.family === 'embedded-income') m.families.embeddedIncome += 1;
    if (row.family === 'realised-cash-flow') m.families.realisedCashFlow += 1;
  }

  return {
    version: VERSION,
    source: 'reporting/income-ledger.json',
    sourceVersion: ledger.version,
    sourceGeneratedAt: ledger.generatedAt || null,
    semantics: {
      canonicalLedgerEventsOnly: true,
      claimableSnapshotsCreateIncome: false,
      referenceAprCreatesIncome: false,
      genericReceiptCreatesIncome: false,
      accruedIncomeRecognizedBeforeClaim: true,
      embeddedCompoundingRecognizedAsEarnedIncome: true,
      settlementDoesNotReRecognizeIncome: true,
      historicalValuationResolutionMayCompleteUnknownUsdWithoutMutatingEconomicEvent: true,
      exactHistoricalOnchainChainlinkResolutionAllowed:true,
      unknownIsNotZero: true
    },
    recognized,
    settlements,
    unresolved,
    byCompanyMonth,
    summary: {
      rawEventCount: (ledger.events || []).length,
      recognizedEventCount: recognized.length,
      settlementOnlyEventCount: settlements.length,
      unresolvedEventCount: unresolved.length
    },
    authority: { executionAuthority: 'none', incomeRecognitionAuthority: 'canonical-mechanism-evidence-only' }
  };
}

export { VERSION, monthKey, eventMonth, historicalValuationSourceValid, resolvedUsdValue, recognitionDecision, buildCanonicalEarnedIncomeView };
