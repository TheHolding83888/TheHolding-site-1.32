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
    'authority-boundary',
    'composite',
    'unsupported-decomposed'
  ]);

  const ALLOWED_METRICS = Object.freeze([
    'none', 'apr', 'apy', 'productivity', 'rewards', 'claimable', 'embedded-yield',
    'entry-price', 'capital', 'performance', 'concentration', 'change', 'security',
    'learning', 'governance'
  ]);

  const ALLOWED_COMPARISONS = Object.freeze([
    'none', 'largest', 'smallest', 'highest', 'lowest', 'most-concentrated',
    'least-concentrated', 'widest-evidence', 'thinnest-evidence'
  ]);

  const ALLOWED_TIMEFRAMES = Object.freeze([
    'current', 'latest', 'today', 'mtd', 'qtd', 'ytd', 'since-tracking', 'unspecified'
  ]);

  const ALLOWED_OPERATIONS = Object.freeze(['none', 'get', 'compare', 'summarize', 'explain', 'rank', 'assess']);
  const ALLOWED_SCOPES = Object.freeze(['unspecified', 'system', 'company', 'cross-company', 'protocol']);

  const ALLOWED_PRIMITIVES = Object.freeze([
    'company-identity', 'company-purpose', 'current-strategy-book', 'productivity', 'rewards',
    'embedded-yield', 'strategy-entry', 'change-intelligence', 'security-state', 'learning-state',
    'proposal-state', 'concentration', 'realised-cash-flow', 'maturity-reputation', 'protocol-state',
    'navigation', 'authority-boundary', 'unmodeled'
  ]);

  const ALLOWED_MISSING_PRIMITIVES = Object.freeze([
    'company-purpose', 'realised-cash-flow', 'maturity-reputation', 'unmodeled'
  ]);

  const ALLOWED_KEYS = new Set([
    'version', 'intent', 'entities', 'timeframe', 'comparison', 'requestedMetric',
    'operation', 'scope', 'decomposition', 'missingPrimitives'
  ]);
  const ALLOWED_DECOMPOSITION_KEYS = new Set(['object', 'entity', 'operation', 'concept']);
  const FORBIDDEN_KEYS = new Set([
    'answer', 'text', 'response', 'source', 'sources', 'sourceArtifacts', 'sourcePreference',
    'evidence', 'evidenceIds', 'citations', 'confidence', 'confidenceClass', 'grounded',
    'execution', 'execute', 'action', 'transaction', 'tx', 'signature', 'sign', 'wallet',
    'privateKey', 'seedPhrase', 'methodology', 'policy', 'authority', 'permissions', 'mandate', 'mutation'
  ]);

  const allowedIntents = new Set(ALLOWED_INTENTS);
  const allowedMetrics = new Set(ALLOWED_METRICS);
  const allowedComparisons = new Set(ALLOWED_COMPARISONS);
  const allowedTimeframes = new Set(ALLOWED_TIMEFRAMES);
  const allowedOperations = new Set(ALLOWED_OPERATIONS);
  const allowedScopes = new Set(ALLOWED_SCOPES);
  const allowedPrimitives = new Set(ALLOWED_PRIMITIVES);
  const allowedMissingPrimitives = new Set(ALLOWED_MISSING_PRIMITIVES);

  function reject(reason, detail) {
    return Object.freeze({ ok: false, version: VERSION, reason, detail: detail || null, envelope: null });
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

  function cleanMissingPrimitives(value) {
    if (value === undefined) return [];
    if (!Array.isArray(value) || value.length > 4) return null;
    const out = [];
    for (const item of value) {
      const s = cleanScalar(item, 64);
      if (!s || !allowedMissingPrimitives.has(s)) return null;
      if (!out.includes(s)) out.push(s);
    }
    return out;
  }

  function cleanDecomposition(value) {
    if (value === undefined) return [];
    if (!Array.isArray(value) || value.length > 6) return null;
    const out = [];
    for (const item of value) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
      const keys = Object.keys(item);
      for (const key of keys) {
        if (FORBIDDEN_KEYS.has(key)) return null;
        if (!ALLOWED_DECOMPOSITION_KEYS.has(key)) return null;
      }
      const object = cleanScalar(item.object, 64);
      if (!object || !allowedPrimitives.has(object)) return null;
      const entity = item.entity === undefined ? null : cleanScalar(item.entity, 120);
      if (item.entity !== undefined && !entity) return null;
      const operation = item.operation === undefined ? 'get' : cleanScalar(item.operation, 32);
      if (!operation || !allowedOperations.has(operation) || operation === 'none') return null;
      const concept = item.concept === undefined ? null : cleanScalar(item.concept, 96);
      if (object === 'unmodeled' && !concept) return null;
      if (object !== 'unmodeled' && item.concept !== undefined) return null;
      out.push(Object.freeze({ object, entity, operation, concept }));
    }
    return out;
  }

  function validate(candidate) {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return reject('candidate-not-object');

    const keys = Object.keys(candidate);
    for (const key of keys) {
      if (FORBIDDEN_KEYS.has(key)) return reject('forbidden-key', key);
      if (!ALLOWED_KEYS.has(key)) return reject('unknown-key', key);
    }

    if (candidate.version !== undefined && candidate.version !== VERSION) return reject('unsupported-version', String(candidate.version));

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

    const operation = candidate.operation === undefined ? 'none' : cleanScalar(candidate.operation, 32);
    if (!operation || !allowedOperations.has(operation)) return reject('invalid-operation', operation || null);

    const scope = candidate.scope === undefined ? 'unspecified' : cleanScalar(candidate.scope, 32);
    if (!scope || !allowedScopes.has(scope)) return reject('invalid-scope', scope || null);

    const decomposition = cleanDecomposition(candidate.decomposition);
    if (decomposition === null) return reject('invalid-decomposition');

    const missingPrimitives = cleanMissingPrimitives(candidate.missingPrimitives);
    if (missingPrimitives === null) return reject('invalid-missing-primitives');

    if (intent === 'authority-boundary' && requestedMetric !== 'none') return reject('authority-intent-cannot-request-metric');

    if (intent === 'composite') {
      if (decomposition.length < 2) return reject('composite-requires-decomposition');
      if (missingPrimitives.length) return reject('composite-cannot-declare-missing');
    } else if (intent === 'unsupported-decomposed') {
      if (!decomposition.length) return reject('unsupported-requires-decomposition');
      if (!missingPrimitives.length) return reject('unsupported-requires-missing-primitive');
    } else if (decomposition.length || missingPrimitives.length) {
      return reject('decomposition-requires-composite-intent');
    }

    if (missingPrimitives.length) {
      const decompositionObjects = new Set(decomposition.map(item => item.object));
      for (const primitive of missingPrimitives) {
        if (!decompositionObjects.has(primitive)) return reject('missing-primitive-not-decomposed', primitive);
      }
    }

    const envelope = Object.freeze({
      version: VERSION,
      intent,
      entities: Object.freeze(entities.slice()),
      timeframe,
      comparison,
      requestedMetric,
      operation,
      scope,
      decomposition: Object.freeze(decomposition.slice()),
      missingPrimitives: Object.freeze(missingPrimitives.slice())
    });

    return Object.freeze({ ok: true, version: VERSION, reason: null, detail: null, envelope });
  }

  function capability() {
    return Object.freeze({
      version: VERSION,
      role: 'compositional-question-understanding-firewall-only',
      canAnswer: false,
      canSetConfidence: false,
      canSelectSourcesAsTruth: false,
      canExecute: false,
      canDecomposeQuestion: true,
      canReportMissingPrimitive: true,
      executionAuthority: 'none',
      allowedIntents: ALLOWED_INTENTS,
      allowedMetrics: ALLOWED_METRICS,
      allowedComparisons: ALLOWED_COMPARISONS,
      allowedTimeframes: ALLOWED_TIMEFRAMES,
      allowedOperations: ALLOWED_OPERATIONS,
      allowedScopes: ALLOWED_SCOPES,
      allowedPrimitives: ALLOWED_PRIMITIVES,
      allowedMissingPrimitives: ALLOWED_MISSING_PRIMITIVES
    });
  }

  return Object.freeze({ VERSION, validate, capability });
});
