#!/usr/bin/env node
import fs from 'node:fs';

const APP = 'agents/console/app.js';
const INDEX = 'agents/console/index.html';
const app = fs.readFileSync(APP, 'utf8');
const index = fs.readFileSync(INDEX, 'utf8');
const fail = m => { throw new Error(m); };

function replaceOnce(text, before, after, label) {
  const count = text.split(before).length - 1;
  if (count !== 1) fail(`${label}: expected 1 exact anchor, found ${count}`);
  return text.replace(before, after);
}

let next = app;

next = replaceOnce(next,
`    pageText: new Map(),
    lastEntity: null,
    lastTopic: null
  };`,
`    pageText: new Map(),
    lastEntity: null,
    lastTopic: null
  };

  const ANSWER_CONTRACT_VERSION = '0.1-source-bound-answer-contract';
  const ANSWER_QUALITY_VERSION = '0.1-local-answer-quality';
  const ANSWER_QUALITY_KEY = 'holding-answer-quality-v1';
  const ANSWER_QUALITY_SALT_KEY = 'holding-answer-quality-salt-v1';
  const CONFIDENCE_CLASSES = Object.freeze(['measured', 'partial', 'warming', 'unknown']);`,
'answer constants');

next = replaceOnce(next,
`  const includesAny = (q, list) => list.some(x => q.includes(norm(x)));

  const PROTOCOL_ALIASES`,
`  const includesAny = (q, list) => list.some(x => q.includes(norm(x)));

  function answerArtifacts(source) {
    const s = String(source || '');
    const artifacts = [];
    const add = value => { if (value && !artifacts.includes(value)) artifacts.push(value); };
    if (/Registry/i.test(s)) add(URLS.companies);
    if (/Productivity/i.test(s)) add(URLS.productivity);
    if (/Stable Capital/i.test(s)) add(URLS.stable);
    if (/Rewards/i.test(s)) add(URLS.rewards);
    if (/Embedded Yield/i.test(s)) add(URLS.embedded);
    if (/Strategy Entry/i.test(s)) add(URLS.entries);
    if (/Cognitive Stack/i.test(s)) add(URLS.stack);
    if (/Brain Bridge/i.test(s)) add(URLS.bridge);
    if (/Decision & Outcome Learning/i.test(s)) { add(URLS.learning); add(URLS.decisions); }
    if (/project canon/i.test(s)) add('/intelligence/project-memory/CURRENT.md');
    if (/Console capability map/i.test(s)) add('/agents/console/app.js');
    if (/Public site knowledge/i.test(s)) {
      for (const [, url] of PUBLIC_PAGES) if (s.includes(url)) add(url);
    }
    return artifacts;
  }

  function artifactGeneratedAt(artifact) {
    if (artifact === URLS.stack) return state.stack?.generatedAt || null;
    if (artifact === URLS.bridge) return state.bridge?.generatedAt || null;
    if (artifact === URLS.learning) return state.learning?.generatedAt || null;
    if (artifact === URLS.decisions) return state.decisions?.generatedAt || null;
    if (artifact === URLS.productivity) return state.productivity?.generatedAt || null;
    if (artifact === URLS.stable) return state.stable?.generatedAt || null;
    if (artifact === URLS.rewards) return state.lazy.rewards?.generatedAt || null;
    if (artifact === URLS.embedded) return state.lazy.embedded?.generatedAt || null;
    if (artifact === URLS.entries) return state.lazy.entries?.generatedAt || null;
    return null;
  }

  function confidenceForAnswer(result) {
    const text = norm(result?.text);
    const source = norm(result?.source);
    if (!result?.source || /unavailable|no sufficiently strong verified match|fail closed/.test(source)) return 'unknown';
    if (/не могу ответить|cannot answer|не удалось|could not safely|не найден|not found|no exact|нет подтвержден|no verified|не загрузил|did not load|unavailable/.test(text)) return 'unknown';
    const hasWarming = /warming|догрев|прогрев/.test(text);
    const hasMeasuredValue = /(?:\$|\d+(?:[.,]\d+)?%)/.test(String(result?.text || ''));
    if (hasWarming) return hasMeasuredValue ? 'partial' : 'warming';
    const coverageMatches = [...String(result?.text || '').matchAll(/(?:coverage|покрытие)[^0-9]{0,24}(\d+(?:[.,]\d+)?)%/gi)];
    if (coverageMatches.some(m => Number(String(m[1]).replace(',', '.')) < 99.999)) return 'partial';
    if (/\bpartial\b|частичн/.test(text)) return 'partial';
    return 'measured';
  }

  function coarseTopic(raw) {
    if (state.lastTopic) return String(state.lastTopic).slice(0, 80);
    const protocol = protocolGroup(raw);
    if (protocol) return `protocol:${protocol}`;
    const q = norm(raw);
    if (includesAny(q, ['reward', 'награ', 'claimable', 'accrued'])) return 'rewards';
    if (includesAny(q, ['embedded', 'встроенн'])) return 'embedded-yield';
    if (includesAny(q, ['apr', 'apy', 'yield', 'доходност', 'продуктив'])) return 'productivity';
    return 'unresolved-general';
  }

  function emptyAnswerQuality() {
    return {
      version: ANSWER_QUALITY_VERSION,
      total: 0,
      counts: { measured: 0, partial: 0, warming: 0, unknown: 0, error: 0 },
      topics: {},
      unresolved: [],
      updatedAt: null
    };
  }

  function loadAnswerQuality() {
    try {
      const parsed = JSON.parse(localStorage.getItem(ANSWER_QUALITY_KEY) || 'null');
      if (parsed?.version === ANSWER_QUALITY_VERSION && parsed?.counts && parsed?.topics && Array.isArray(parsed?.unresolved)) return parsed;
    } catch (_) {}
    return emptyAnswerQuality();
  }

  function answerQualitySalt() {
    try {
      let salt = localStorage.getItem(ANSWER_QUALITY_SALT_KEY);
      if (/^[a-f0-9]{32}$/i.test(String(salt || ''))) return salt;
      const bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      salt = [...bytes].map(x => x.toString(16).padStart(2, '0')).join('');
      localStorage.setItem(ANSWER_QUALITY_SALT_KEY, salt);
      return salt;
    } catch (_) { return 'session-only'; }
  }

  async function questionFingerprint(raw) {
    try {
      const payload = new TextEncoder().encode(`${answerQualitySalt()}|${norm(raw)}`);
      const digest = await crypto.subtle.digest('SHA-256', payload);
      return [...new Uint8Array(digest)].map(x => x.toString(16).padStart(2, '0')).join('').slice(0, 24);
    } catch (_) { return null; }
  }

  async function recordAnswerQuality(contract, raw, outcome = null) {
    const quality = loadAnswerQuality();
    const bucket = outcome === 'error' ? 'error' : contract.confidenceClass;
    if (!Object.hasOwn(quality.counts, bucket)) return;
    quality.total += 1;
    quality.counts[bucket] += 1;
    quality.updatedAt = new Date().toISOString();
    const topic = contract.topic || 'unresolved-general';
    quality.topics[topic] = Number(quality.topics[topic] || 0) + 1;
    if (contract.confidenceClass === 'unknown' && outcome !== 'error') {
      const fingerprint = await questionFingerprint(raw);
      if (fingerprint) {
        const found = quality.unresolved.find(x => x.fingerprint === fingerprint);
        if (found) {
          found.count += 1;
          found.lastSeen = quality.updatedAt;
        } else {
          quality.unresolved.push({ fingerprint, topic, language: contract.language, count: 1, firstSeen: quality.updatedAt, lastSeen: quality.updatedAt });
          quality.unresolved = quality.unresolved.sort((a, b) => b.count - a.count || String(b.lastSeen).localeCompare(String(a.lastSeen))).slice(0, 30);
        }
      }
    }
    try { localStorage.setItem(ANSWER_QUALITY_KEY, JSON.stringify(quality)); } catch (_) {}
  }

  async function buildAnswerContract(result, raw, language) {
    const artifacts = answerArtifacts(result?.source);
    let confidenceClass = confidenceForAnswer(result);
    const knownUnknown = confidenceClass === 'unknown';
    if (!artifacts.length && !knownUnknown) {
      confidenceClass = 'unknown';
      result = {
        text: language === 'ru'
          ? 'У ответа нет подтверждённого source artifact в текущем Answer Contract, поэтому я не буду выпускать его как факт.'
          : 'This answer has no verified source artifact in the current Answer Contract, so I will not release it as a factual answer.',
        source: 'Answer Contract · source mapping unavailable'
      };
    }
    const sourceArtifacts = answerArtifacts(result?.source);
    const timestamps = sourceArtifacts.map(artifactGeneratedAt).filter(Boolean).sort();
    const contract = Object.freeze({
      version: ANSWER_CONTRACT_VERSION,
      language,
      confidenceClass,
      sourceArtifacts,
      generatedAt: timestamps.at(-1) || null,
      topic: coarseTopic(raw),
      grounded: confidenceClass !== 'unknown' && sourceArtifacts.length > 0
    });
    if (!CONFIDENCE_CLASSES.includes(contract.confidenceClass)) throw new Error('Invalid Answer Contract confidence class');
    return { ...result, answerContract: contract };
  }

  window.HoldingAnswerQuality = Object.freeze({
    version: ANSWER_QUALITY_VERSION,
    snapshot: () => structuredClone(loadAnswerQuality())
  });

  const PROTOCOL_ALIASES`,
'answer contract helpers');

next = replaceOnce(next,
`  function resolvePending(box, text, source = '') {
    box.classList.remove('pending');
    const spans = box.querySelectorAll('span');
    if (spans[1]) spans[1].textContent = text;
    if (source) {
      const src = document.createElement('span');
      src.className = 'source';
      src.textContent = source;
      box.appendChild(src);
    }
    messages.scrollTop = messages.scrollHeight;
  }`,
`  function resolvePending(box, text, source = '', contract = null) {
    box.classList.remove('pending');
    const spans = box.querySelectorAll('span');
    if (spans[1]) spans[1].textContent = text;
    if (contract) {
      box.dataset.answerContractVersion = contract.version;
      box.dataset.answerConfidenceClass = contract.confidenceClass;
      box.dataset.answerTopic = contract.topic;
      box.dataset.answerGrounded = contract.grounded ? 'true' : 'false';
      if (contract.generatedAt) box.dataset.answerGeneratedAt = contract.generatedAt;
      if (contract.sourceArtifacts?.length) box.dataset.answerSourceArtifacts = contract.sourceArtifacts.join('|');
    }
    if (source || contract) {
      const src = document.createElement('span');
      src.className = 'source';
      const quality = contract ? ` · ${contract.confidenceClass.toUpperCase()}` : '';
      src.textContent = `${source || 'Answer Contract'}${quality}`;
      box.appendChild(src);
    }
    messages.scrollTop = messages.scrollHeight;
  }`,
'resolve pending contract');

next = replaceOnce(next,
`    try {
      const result = await routeQuestion(text);
      resolvePending(wait, result.text, result.source || '');
    } catch (error) {
      resolvePending(wait,
        lang === 'ru' ? 'Не удалось безопасно собрать ответ из live данных. Попробуй ещё раз чуть позже.' : 'I could not safely build an answer from live data. Please try again later.',
        'Fail-closed');
      console.warn('[Holding Console route]', error);`,
`    try {
      state.lastTopic = null;
      const result = await routeQuestion(text);
      const contracted = await buildAnswerContract(result, text, lang);
      resolvePending(wait, contracted.text, contracted.source || '', contracted.answerContract);
      await recordAnswerQuality(contracted.answerContract, text);
    } catch (error) {
      const contract = Object.freeze({ version: ANSWER_CONTRACT_VERSION, language: lang, confidenceClass: 'unknown', sourceArtifacts: [], generatedAt: null, topic: coarseTopic(text), grounded: false });
      resolvePending(wait,
        lang === 'ru' ? 'Не удалось безопасно собрать ответ из live данных. Попробуй ещё раз чуть позже.' : 'I could not safely build an answer from live data. Please try again later.',
        'Fail-closed', contract);
      await recordAnswerQuality(contract, text, 'error');
      console.warn('[Holding Console route]', error);`,
'ask contract integration');

fs.writeFileSync(APP, next, 'utf8');

let nextIndex = index;
nextIndex = replaceOnce(nextIndex,
  '<div class="brand">The Holding AI<small>Live knowledge console · v0.3 safe learning</small></div>',
  '<div class="brand">The Holding AI<small>Live knowledge console · v0.4 source-bound answers</small></div>',
  'console version');
nextIndex = replaceOnce(nextIndex,
  '<span class="pill live">Live Holding data</span><span class="pill">RU / EN</span><span class="pill">Read-only</span>',
  '<span class="pill live">Live Holding data</span><span class="pill">Source-bound answers</span><span class="pill">RU / EN</span><span class="pill">Read-only</span>',
  'source-bound pill');
nextIndex = replaceOnce(nextIndex,
  '<script src="./app.js?v=0.2.1" defer></script>',
  '<script src="./app.js?v=0.4" defer></script>',
  'app cache version');
fs.writeFileSync(INDEX, nextIndex, 'utf8');

console.log(JSON.stringify({
  status: 'patched',
  version: 'Ask The Holding v0.4',
  answerContract: ANSWER_CONTRACT_VERSION,
  persistentLearningActivated: false,
  rawQuestionLedgerAdded: false
}, null, 2));
