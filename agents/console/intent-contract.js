(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HoldingIntentContract = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const VERSION = '0.1-intent-contract-firewall';

  const ALLOWED_INTENTS = Object.freeze([
    'unknown',
    'owner-brief',
    'change-salience',
    'concentration',
    'company-understanding',
    'company-query',
    'protocol-query',
    'productivity-query',
    'rewards-query',
    'embedded-yield-query',
    'entry-query',
    'learning-query',
    'proposal-query',
    'governance-query',
    'navigation',
    'authority-boundary'
  ]);

  const ALLOWED_METRICS = Object.freeze([
    'none',
    'apr',
    'apy',
    'productivity',
    'rewards',
    'claimable',
    'embedded-yield',
    'entry-price',
    'capital',
    'performance',
    'concentration',
    'change',
    'security',
    'learning',
    'governance'
  ]);

  const ALLOWED_COMPARISONS = Object.freeze([
    'none',
    'largest',
    'smallest',
    'highest',
    'lowest',
    'most-concentrated',
    'least-concentrated',
    'widest-evidence',
    'thinnest-evidence'
  ]);

  const ALLOWED_TIMEFRAMES = Object.freeze([
    'current',
    'latest',
    'today',
    'mtd',
    'qtd',
    'ytd',
    'since-tracking',
    'unspecified'
  ]);

  const ALLOWED_KEYS = new Set(['version', 'intent', 'entities', 'timeframe', 'comparison', 'requestedMetric']);
  const FORBIDDEN_KEYS = new Set([
    'answer', 'text', 'source', 'sources', 'sourceArtifacts', 'confidence', 'confidenceClass',
    'grounded', 'execution', 'execute', 'action', 'transaction', 'tx', 'signature', 'sign',
    'wallet', 'privateKey', 'seedPhrase', 'methodology', 'policy', 'authority', 'permissions'
  ]);

  const allowedIntents = new Set(ALLOWED_INTENTS);
  const allowedMetrics = new Set(ALLOWED_METRICS);
  const allowedComparisons = new Set(ALLOWED_COMPARISONS);
  const allowedTimeframes = new Set(ALLOWED_TIMEFRAMES);

  function reject(reason, detail) {
    return Object.freeze({
      ok: false,
      version: VERSION,
      reason,
      detail: detail || null,
      envelope: null
    });
  }

  function cleanScalar(value, maxLength) {
    if (typeof value !== 'string') return null;
    const s = value.trim().replace(/\s+/g, ' ');
    if (!s || s.length > maxLength) return null;
    return s;
  }

  function cleanEntities(value) {
    if (value === undefined) return [];
    if (!Array.isArray(value) || value.length > 4) return null;
    const out = [];
    for (const item of value) {
      const s = cleanScalar(item, 120);
      if (!s) return null;
      if (!out.includes(s)) out.push(s);
    }
    return out;
  }

  function validate(candidate) {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
      return reject('candidate-not-object');
    }

    const keys = Object.keys(candidate);
    for (const key of keys) {
      if (FORBIDDEN_KEYS.has(key)) return reject('forbidden-key', key);
      if (!ALLOWED_KEYS.has(key)) return reject('unknown-key', key);
    }

    if (candidate.version !== undefined && candidate.version !== VERSION) {
      return reject('unsupported-version', String(candidate.version));
    }

    const intent = cleanScalar(candidate.intent, 64);
    if (!intent || !allowedIntents.has(intent)) return reject('invalid-intent', intent || null);

    const entities = cleanEntities(candidate.entities);
    if (entities === null) return reject('invalid-entities');

    const timeframe = candidate.timeframe === undefined ? 'unspecified' : cleanScalar(candidate.timeframe, 40);
    if (!timeframe || !allowedTimeframes.has(timeframe)) return reject('invalid-timeframe', timeframe || null);

    const comparison = candidate.comparison === undefined ? 'none' : cleanScalar(candidate.comparison, 64);
    if (!comparison || !allowedComparisons.has(comparison)) return reject('invalid-comparison', comparison || null);

    const requestedMetric = candidate.requestedMetric === undefined ? 'none' : cleanScalar(candidate.requestedMetric, 64);
    if (!requestedMetric || !allowedMetrics.has(requestedMetric)) return reject('invalid-metric', requestedMetric || null);

    if (intent === 'authority-boundary' && requestedMetric !== 'none') {
      return reject('authority-intent-cannot-request-metric');
    }

    const envelope = Object.freeze({
      version: VERSION,
      intent,
      entities: Object.freeze(entities.slice()),
      timeframe,
      comparison,
      requestedMetric
    });

    return Object.freeze({ ok: true, version: VERSION, reason: null, detail: null, envelope });
  }

  function capability() {
    return Object.freeze({
      version: VERSION,
      role: 'structured-understanding-firewall-only',
      canAnswer: false,
      canSetConfidence: false,
      canSelectSourcesAsTruth: false,
      canExecute: false,
      executionAuthority: 'none',
      allowedIntents: ALLOWED_INTENTS,
      allowedMetrics: ALLOWED_METRICS,
      allowedComparisons: ALLOWED_COMPARISONS,
      allowedTimeframes: ALLOWED_TIMEFRAMES
    });
  }

  return Object.freeze({ VERSION, validate, capability });
});
