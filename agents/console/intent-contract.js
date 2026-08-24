(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HoldingIntentContract = api;
  if (root?.document && typeof api.installBrowserAdapter === 'function') api.installBrowserAdapter(root);
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

  // These primitives are syntactically understood by the OS but do not yet have a
  // canonical source object. They may appear only as explicit unsupported/missing
  // requirements. This is a semantic-availability invariant, not a model hint.
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

    const decompositionObjects = new Set(decomposition.map(item => item.object));

    // Semantic availability is fail-closed: knowing the name of a primitive is not
    // equivalent to having evidence for it. Until a canonical object exists, every
    // currently unavailable primitive must travel through unsupported-decomposed and
    // be declared in missingPrimitives. This prevents semantic substitution or false
    // support from any caller, including future model-assisted parsers.
    for (const primitive of ALLOWED_MISSING_PRIMITIVES) {
      if (!decompositionObjects.has(primitive)) continue;
      if (intent !== 'unsupported-decomposed' || !missingPrimitives.includes(primitive)) {
        return reject('unavailable-primitive-requires-missing', primitive);
      }
    }

    if (missingPrimitives.length) {
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

  function boundedEditDistance(a, b) {
    const left = String(a || '');
    const right = String(b || '');
    const rows = Array.from({ length: left.length + 1 }, () => Array(right.length + 1).fill(0));
    for (let i = 0; i <= left.length; i++) rows[i][0] = i;
    for (let j = 0; j <= right.length; j++) rows[0][j] = j;
    for (let i = 1; i <= left.length; i++) {
      for (let j = 1; j <= right.length; j++) {
        const cost = left[i - 1] === right[j - 1] ? 0 : 1;
        rows[i][j] = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + cost);
        if (i > 1 && j > 1 && left[i - 1] === right[j - 2] && left[i - 2] === right[j - 1]) {
          rows[i][j] = Math.min(rows[i][j], rows[i - 2][j - 2] + 1);
        }
      }
    }
    return rows[left.length][right.length];
  }

  function repairQuestionShapeTypos(value) {
    let text = String(value || '');
    const normalized = text.toLowerCase().replace(/ё/g, 'е');

    // Economic layer comparisons are a high-value semantic boundary. Repair the
    // relation word only inside a yield/performance-shaped question. Repair the
    // adjective `реальная` only when it directly qualifies `доходность`; this keeps
    // phrases such as `кто реально заработал больше` untouched so Realised Cash Flow
    // continues to fail closed rather than being substituted with current APR.
    if (/(?:apr|apy|yield|доходност|performance|прибыл|результат)/i.test(normalized)) {
      text = text.replace(/[А-Яа-яЁё]{7,12}/g, token => {
        const lower = token.toLowerCase().replace(/ё/g, 'е');
        if (!lower.startsWith('п') || Math.abs(lower.length - 'получается'.length) > 2) return token;
        return boundedEditDistance(lower, 'получается') <= 2 ? 'получается' : token;
      });
      text = text.replace(/([А-Яа-яЁё]{6,10})(?=\s+[А-Яа-яЁё]*доходност)/gi, token => {
        const lower = token.toLowerCase().replace(/ё/g, 'е');
        if (!lower.startsWith('р') || Math.abs(lower.length - 'реальная'.length) > 2) return token;
        return boundedEditDistance(lower, 'реальная') <= 2 ? 'реальная' : token;
      });
    }

    // `brief` is a high-value owner-intent shape. For four-letter forms allow
    // two edits (one omission + one transposition); for five-letter forms allow
    // one. Longer English words are never touched, preventing broad fuzzy search.
    if (/(^|\s)owner(?=\s|[?!.,]|$)/i.test(normalized)) {
      text = text.replace(/\b[A-Za-z]{4,5}\b/g, token => {
        const lower = token.toLowerCase();
        if (!lower.startsWith('b')) return token;
        const maxEdits = lower.length === 4 ? 2 : 1;
        return boundedEditDistance(lower, 'brief') <= maxEdits ? 'brief' : token;
      });
    }

    const afterOwner = text.toLowerCase().replace(/ё/g, 'е');
    if (/(^|\s)(?:the\s+)?holding(?=\s|[?!.,]|$)/i.test(afterOwner)) {
      text = text.replace(/[А-Яа-яЁё]{4,5}/g, token => {
        const lower = token.toLowerCase().replace(/ё/g, 'е');
        if (!lower.startsWith('ф')) return token;
        if (boundedEditDistance(lower, 'фонды') <= 1) return 'фонды';
        if (boundedEditDistance(lower, 'фонд') <= 1) return 'фонд';
        return token;
      });
    }
    return text;
  }

  // Question-shape normalization only. This is deliberately narrower than intent
  // selection: it may repair a bounded syntactic form, but it cannot choose an
  // answer, source, confidence class, evidence, methodology or action.
  function normalizeQuestion(value) {
    const original = String(value || '');
    const repaired = repairQuestionShapeTypos(original);
    const q = repaired
      .toLowerCase()
      .replace(/ё/g, 'е')
      .replace(/[’']/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!q) return original;

    // Named-fund questions are not inventory requests. Preserve their semantic
    // shape so questions such as “what is Monetra fund?” stay on the entity route.
    if (/(^|\s)(?:substantia|defitea|monetra|fructus|singul|субстанци[яи]|дефитеа|дефити|монетр[ауе]?|фруктус|сингул)(?=\s|[?!.,]|$)/i.test(q)) return repaired;
    if (!/(^|\s)(?:the\s+)?holding(?=\s|[?!.,]|$)/i.test(q)) return repaired;

    const enFund = /(^|\s)fund(?=\s|[?!.,]|$)/i.test(q);
    const enInventory = /\b(?:have|has|list)\b/i.test(q) || /\bexist(?:s|ed|ing)?\b/i.test(q);
    if (enFund && enInventory) return repaired.replace(/\bfund\b/i, 'funds');

    const ruFund = /(^|\s)фонд(?=\s|[?!.,]|$)/i.test(q);
    const ruInventory = /(^|\s)(?:есть|список|перечисли)(?=\s|[?!.,]|$)/i.test(q);
    if (ruFund && ruInventory) return repaired.replace(/\bфонд\b/i, 'фонды');

    return repaired;
  }

  function installBrowserAdapter(browserRoot) {
    const install = () => {
      const doc = browserRoot?.document;
      const form = doc?.getElementById('askForm');
      const input = doc?.getElementById('question');
      if (!form || !input || form.dataset.intentContractNormalizer === VERSION) return;
      form.dataset.intentContractNormalizer = VERSION;

      // safety.js runs in capture phase before this adapter. The app router is
      // registered later on the same form, so it receives the canonical semantic
      // shape. No second answer path is created.
      form.addEventListener('submit', event => {
        const original = input.value.trim();
        if (!original) return;
        const canonical = normalizeQuestion(original);
        if (canonical === original) return;
        event.__holdingIntentNormalization = Object.freeze({ original, canonical });
        input.value = canonical;
      });

      // Preserve what the person actually typed in the visible transcript. The
      // canonicalized form exists only inside the question-understanding path.
      doc.addEventListener('submit', event => {
        const meta = event.__holdingIntentNormalization;
        if (!meta || event.target !== form) return;
        const userMessages = doc.querySelectorAll('#messages .msg.user');
        const last = userMessages[userMessages.length - 1];
        const spans = last?.querySelectorAll('span');
        if (spans?.[1]?.textContent === meta.canonical) spans[1].textContent = meta.original;
      });
    };

    if (browserRoot?.document?.readyState === 'loading') browserRoot.document.addEventListener('DOMContentLoaded', install, { once: true });
    else install();
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
      allowedMissingPrimitives: ALLOWED_MISSING_PRIMITIVES,
      unavailablePrimitives: ALLOWED_MISSING_PRIMITIVES
    });
  }

  return Object.freeze({ VERSION, validate, capability, normalizeQuestion, installBrowserAdapter });
});
