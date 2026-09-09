#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const NOTICE_FILE = process.env.ACCOUNTING_NOTICE_QUEUE_FILE || './reporting/accounting-notice-queue.json';
const RECONCILIATION_FILE = process.env.ACCOUNTING_REFERENCE_RECONCILIATION_FILE || './reporting/accounting-reference-reconciliation.json';
const COMPLETENESS_FILE = process.env.HISTORICAL_ACCOUNTING_COMPLETENESS_FILE || './reporting/historical-accounting-completeness-map.json';
const OUTPUT_FILE = process.env.ACCOUNTING_RECONCILIATION_WATCH_FILE || './reporting/accounting-reconciliation-watch.json';
const PREVIOUS_FILE = process.env.ACCOUNTING_RECONCILIATION_WATCH_PREVIOUS_FILE || OUTPUT_FILE;

function readJson(file, required = true) {
  const absolute = path.resolve(ROOT, file);
  if (!fs.existsSync(absolute)) {
    if (required) throw new Error(`Required reconciliation-watch input missing: ${file}`);
    return null;
  }
  return JSON.parse(fs.readFileSync(absolute, 'utf8'));
}

function round(value) {
  return Number.isFinite(Number(value)) ? Number(Number(value).toFixed(8)) : null;
}

function sortedUnique(values = []) {
  return [...new Set(values.filter(v => v !== null && v !== undefined).map(String))].sort();
}

function hash(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function sourceState(file, doc) {
  return {
    file: file.replace(/^\.\//, ''),
    version: doc?.version || null,
    generatedAt: doc?.generatedAt || null,
    status: doc?.status || null
  };
}

function authorityBoundary() {
  return {
    sourceOfTruth: false,
    factualIncomeAuthority: false,
    incomeCreationAuthority: false,
    accountingCompletionAuthority: false,
    monthClosingAuthority: false,
    canReplaceUnknown: false,
    executionAuthority: 'none',
    capitalExecution: false,
    walletAuthority: false
  };
}

function compactNotice(row) {
  return {
    category: row.category || null,
    blocker: row.blocker || null,
    action: row.action || null,
    trackingState: row.trackingState || null,
    engineeringActionable: row.engineeringActionable === true,
    parked: row.parked === true,
    confirmedUsd: round(row.confirmedUsd),
    estimatedUsd: round(row.estimatedUsd),
    deltaUsd: round(row.deltaUsd),
    unresolvedEventCount: Number(row.unresolvedEventCount || 0),
    unresolvedReasons: sortedUnique(row.unresolvedReasons || []),
    boundaryEvidencePending: row.boundaryEvidencePending === true,
    prorationAllowed: row.prorationAllowed === true
  };
}

function compactCompleteness(row) {
  return {
    sourceState: row.state || null,
    evidenceComplete: row.evidenceComplete === true,
    reasonCodes: sortedUnique(row.reasonCodes || []),
    factualTrackingActive: row.factualTrackingActive === true,
    factualEventCount: Number(row.factualEventCount || 0),
    factualValuedEventCount: Number(row.factualValuedEventCount || 0),
    factualUsdSubtotal: round(row.factualUsdSubtotal),
    crossMonthUnresolvedCount: Number(row.crossMonthUnresolvedCount || 0),
    sourceCoverageStatus: row.sourceCoverageStatus || null,
    sourceCompletionBlockers: sortedUnique(row.sourceCompletionBlockers || [])
  };
}

function compactReconciliation(row) {
  return {
    scope: row.scope || null,
    signalBand: row.signalBand || null,
    attention: row.attention || null,
    reconciliationStatus: row.reconciliationStatus || null,
    referenceUsd: round(row.referenceUsd),
    confirmedUsd: round(row.confirmedUsd),
    deltaUsd: round(row.deltaUsd),
    captureRatio: round(row.captureRatio),
    modelVariancePossible: row.modelVariancePossible === true,
    modelVarianceIsProven: row.modelVarianceIsProven === true,
    factualPeriodComplete: row.factualPeriodComplete === true,
    partialPeriod: row.partialPeriod === true,
    parked: row.parked === true,
    engineeringActionable: row.engineeringActionable === true,
    reasonCodes: sortedUnique(row.reasonCodes || [])
  };
}

function createItem({ id, company, month, mechanism = null, scope = null, watchClass, actionability, source, detail, reasonCodes = [] }) {
  const core = {
    id,
    company: company || null,
    month: month || null,
    mechanism,
    scope,
    watchClass,
    actionability,
    source,
    reasonCodes: sortedUnique(reasonCodes),
    detail,
    ...authorityBoundary()
  };
  return { ...core, fingerprint: hash(core) };
}

const notice = readJson(NOTICE_FILE);
const reconciliation = readJson(RECONCILIATION_FILE);
const completeness = readJson(COMPLETENESS_FILE);
const previous = readJson(PREVIOUS_FILE, false);

if (notice?.semantics?.unknownIsNotZero !== true) throw new Error('Accounting Notice Queue UNKNOWN boundary missing');
if (reconciliation?.semantics?.unknownIsNotZero !== true) throw new Error('Reference reconciliation UNKNOWN boundary missing');
if (completeness?.semantics?.unknownIsNotZero !== true) throw new Error('Historical completeness UNKNOWN boundary missing');
if (completeness?.status !== 'diagnostic-no-completion-authority') throw new Error('Historical completeness authority boundary drift');

const currentMonth = completeness.currentMonth || notice.currentMonth;
if (!/^\d{4}-\d{2}$/.test(String(currentMonth || ''))) throw new Error('Current month unavailable for reconciliation watch');

const items = [];

// Operational notices are already classified by the canonical diagnostic queue.
for (const row of notice.rows || []) {
  if (row.engineeringActionable === true) {
    items.push(createItem({
      id: `notice:${row.id}`,
      company: row.company,
      month: row.month,
      mechanism: row.mechanism || null,
      scope: row.scope || null,
      watchClass: 'engineering-action-required',
      actionability: 'engineering',
      source: 'accounting-notice-queue',
      detail: compactNotice(row),
      reasonCodes: [row.category, row.blocker, 'canonical-notice-engineering-actionable']
    }));
    continue;
  }
  if (row.parked === true) {
    items.push(createItem({
      id: `notice:${row.id}`,
      company: row.company,
      month: row.month,
      mechanism: row.mechanism || null,
      scope: row.scope || null,
      watchClass: 'evidence-pending',
      actionability: 'external-evidence',
      source: 'accounting-notice-queue',
      detail: compactNotice(row),
      reasonCodes: [row.category, row.blocker, 'parked-not-engineering-failure']
    }));
  }
}

// Closed-period Unknown/Partial states are forensic backlog. Open-month incompleteness is not treated as historical failure.
for (const row of completeness.rows || []) {
  if (!row.month || row.month >= currentMonth) continue;
  if (row.state !== 'unknown' && row.state !== 'partial') continue;
  items.push(createItem({
    id: `historical:${row.id}`,
    company: row.company,
    month: row.month,
    mechanism: row.mechanism || null,
    scope: 'mechanism',
    watchClass: 'historical-forensic-review',
    actionability: 'forensic-evidence',
    source: 'historical-accounting-completeness-map',
    detail: compactCompleteness(row),
    reasonCodes: [`closed-period-${row.state}`, ...(row.reasonCodes || [])]
  }));
}

// High-attention reference divergence remains diagnostic only. It can request review, never create or infer income.
for (const row of reconciliation.rows || []) {
  if (row.attention !== 'high' || row.parked === true || row.engineeringActionable === true) continue;
  items.push(createItem({
    id: `reconciliation:${row.id}`,
    company: row.company,
    month: row.month,
    mechanism: row.mechanism || null,
    scope: row.scope || null,
    watchClass: 'reference-diagnostic-review',
    actionability: 'diagnostic-only',
    source: 'accounting-reference-reconciliation',
    detail: compactReconciliation(row),
    reasonCodes: [row.signalBand, row.reconciliationStatus, 'reference-comparator-is-non-factual']
  }));
}

items.sort((a, b) => a.id.localeCompare(b.id));
if (new Set(items.map(x => x.id)).size !== items.length) throw new Error('Duplicate reconciliation watch item id');

const semanticFingerprint = hash(items.map(({ id, fingerprint }) => ({ id, fingerprint })));
const previousCompatible = previous?.version === '0.1-accounting-reconciliation-watch' && Array.isArray(previous.items);

// If the watched semantic state did not change, preserve the prior snapshot byte-for-byte to avoid commit noise.
if (previousCompatible && previous.semanticFingerprint === semanticFingerprint && path.resolve(ROOT, PREVIOUS_FILE) === path.resolve(ROOT, OUTPUT_FILE)) {
  console.log('Accounting Reconciliation Watch semantic no-op', {
    semanticFingerprint,
    watchItemCount: items.length,
    previousGeneratedAt: previous.generatedAt || null
  });
  process.exit(0);
}

const previousById = new Map((previousCompatible ? previous.items : []).map(item => [item.id, item]));
const firstBaseline = !previousCompatible;
const currentIds = new Set(items.map(x => x.id));

const materializedItems = items.map(item => {
  const prior = previousById.get(item.id);
  let transition = 'baseline';
  if (!firstBaseline) transition = !prior ? 'new' : prior.fingerprint === item.fingerprint ? 'unchanged' : 'changed';
  return { ...item, transition };
});

const resolved = firstBaseline ? [] : (previous.items || [])
  .filter(item => !currentIds.has(item.id))
  .map(item => ({
    id: item.id,
    priorWatchClass: item.watchClass || null,
    priorActionability: item.actionability || null,
    priorFingerprint: item.fingerprint || null,
    resolutionSemantic: 'watch-item-no-longer-present-in-derived-current-state; not accounting-close proof'
  }))
  .sort((a, b) => a.id.localeCompare(b.id));

const changedItems = materializedItems.filter(x => x.transition === 'new' || x.transition === 'changed');
const alertItems = firstBaseline ? [] : changedItems.filter(x => x.watchClass === 'engineering-action-required' || x.watchClass === 'historical-forensic-review');
const evidenceUpdates = firstBaseline ? [] : changedItems.filter(x => x.watchClass === 'evidence-pending');
const diagnosticUpdates = firstBaseline ? [] : changedItems.filter(x => x.watchClass === 'reference-diagnostic-review');

const closedRows = (completeness.rows || []).filter(row => row.month && row.month < currentMonth);
const highAttentionRows = (reconciliation.rows || []).filter(row => row.attention === 'high' && row.parked !== true && row.engineeringActionable !== true);

const output = {
  version: '0.1-accounting-reconciliation-watch',
  generatedAt: new Date().toISOString(),
  status: 'diagnostic-watch-no-accounting-authority',
  currentMonth,
  purpose: 'Derived change watch across canonical accounting notices, historical evidence completeness, and non-factual reference reconciliation. It surfaces changes for review without creating income, closing periods, converting UNKNOWN to zero, or treating ordinary tracking-no-event as failure.',
  semantics: {
    sourceOfTruth: false,
    canonicalIncomeLedgerRemainsSoleFactualIncomeAuthority: true,
    accountingCoverageRemainsFactualTrackingAuthority: true,
    companyMonthlyReportsRemainPresentationAuthority: true,
    historicalCompletenessMapRemainsDiagnosticOnly: true,
    referenceDeltaIsMissingIncome: false,
    trackingNoEventIsFailure: false,
    openMonthPartialIsHistoricalFailure: false,
    evidencePendingIsEngineeringFailure: false,
    resolvedWatchItemClosesAccounting: false,
    baselineCreatesAlerts: false,
    crossMonthProrationAllowed: false,
    unknownIsNotZero: true
  },
  authority: authorityBoundary(),
  sourceState: {
    accountingNoticeQueue: sourceState(NOTICE_FILE, notice),
    accountingReferenceReconciliation: sourceState(RECONCILIATION_FILE, reconciliation),
    historicalAccountingCompleteness: sourceState(COMPLETENESS_FILE, completeness)
  },
  baseline: firstBaseline,
  previousSnapshot: previousCompatible ? {
    generatedAt: previous.generatedAt || null,
    semanticFingerprint: previous.semanticFingerprint || null
  } : null,
  semanticFingerprint,
  summary: {
    watchItemCount: materializedItems.length,
    engineeringActionRequiredCount: materializedItems.filter(x => x.watchClass === 'engineering-action-required').length,
    evidencePendingCount: materializedItems.filter(x => x.watchClass === 'evidence-pending').length,
    historicalForensicReviewCount: materializedItems.filter(x => x.watchClass === 'historical-forensic-review').length,
    referenceDiagnosticReviewCount: materializedItems.filter(x => x.watchClass === 'reference-diagnostic-review').length,
    closedPeriodUnknownCount: closedRows.filter(x => x.state === 'unknown').length,
    closedPeriodPartialCount: closedRows.filter(x => x.state === 'partial').length,
    closedPeriodTrackingNoEventCount: closedRows.filter(x => x.state === 'tracking-no-event').length,
    highAttentionReferenceRowCount: highAttentionRows.length,
    newCount: materializedItems.filter(x => x.transition === 'new').length,
    changedCount: materializedItems.filter(x => x.transition === 'changed').length,
    unchangedCount: materializedItems.filter(x => x.transition === 'unchanged').length,
    baselineCount: materializedItems.filter(x => x.transition === 'baseline').length,
    resolvedCount: resolved.length,
    alertCount: alertItems.length,
    evidenceUpdateCount: evidenceUpdates.length,
    diagnosticUpdateCount: diagnosticUpdates.length
  },
  alerts: alertItems.map(x => x.id),
  evidenceUpdates: evidenceUpdates.map(x => x.id),
  diagnosticUpdates: diagnosticUpdates.map(x => x.id),
  resolved,
  items: materializedItems
};

fs.writeFileSync(path.resolve(ROOT, OUTPUT_FILE), `${JSON.stringify(output, null, 2)}\n`);
console.log('Accounting Reconciliation Watch v0.1 built', {
  baseline: output.baseline,
  semanticFingerprint: output.semanticFingerprint,
  ...output.summary
});
