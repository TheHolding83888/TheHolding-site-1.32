#!/usr/bin/env node
import fs from 'node:fs';

const APP = 'agents/console/app.js';
let app = fs.readFileSync(APP, 'utf8');
const fail = message => { throw new Error(message); };

function replaceOnce(text, before, after, label) {
  const count = text.split(before).length - 1;
  if (count !== 1) fail(`${label}: expected exactly one anchor, found ${count}`);
  return text.replace(before, after);
}

function replaceSection(text, start, end, replacement, label) {
  const first = text.indexOf(start);
  const second = first < 0 ? -1 : text.indexOf(start, first + start.length);
  const finish = first < 0 ? -1 : text.indexOf(end, first + start.length);
  if (first < 0 || second >= 0 || finish < 0) fail(`${label}: unique section anchors not found`);
  return text.slice(0, first) + replacement + text.slice(finish);
}

app = replaceOnce(
  app,
  "  const ANSWER_QUALITY_VERSION = '0.1-local-answer-quality';\n  const ANSWER_QUALITY_KEY = 'holding-answer-quality-v1';\n  const ANSWER_QUALITY_SALT_KEY = 'holding-answer-quality-salt-v1';",
  "  const ANSWER_QUALITY_VERSION = '0.2-local-answer-quality-30d';\n  const ANSWER_QUALITY_KEY = 'holding-answer-quality-v2';\n  const ANSWER_QUALITY_SALT_KEY = 'holding-answer-quality-salt-v1';\n  const ANSWER_QUALITY_WINDOW_DAYS = 30;\n  const ANSWER_QUALITY_WINDOW_MS = ANSWER_QUALITY_WINDOW_DAYS * 24 * 60 * 60 * 1000;\n  const ANSWER_QUALITY_EVENT_LIMIT = 500;",
  'quality constants'
);

const qualityReplacement = `  function emptyAnswerQuality() {
    return {
      version: ANSWER_QUALITY_VERSION,
      windowDays: ANSWER_QUALITY_WINDOW_DAYS,
      eventLimit: ANSWER_QUALITY_EVENT_LIMIT,
      total: 0,
      counts: { measured: 0, partial: 0, warming: 0, unknown: 0, error: 0 },
      rates: { measured: 0, partial: 0, warming: 0, unknown: 0, error: 0 },
      topics: {},
      unresolved: [],
      events: [],
      updatedAt: null
    };
  }

  function rebuildAnswerQuality(events) {
    const cutoff = Date.now() - ANSWER_QUALITY_WINDOW_MS;
    const validBuckets = new Set([...CONFIDENCE_CLASSES, 'error']);
    const bounded = safeArray(events)
      .filter(event => event && Number.isFinite(Number(event.at)) && Number(event.at) >= cutoff && validBuckets.has(event.bucket))
      .sort((a, b) => Number(a.at) - Number(b.at))
      .slice(-ANSWER_QUALITY_EVENT_LIMIT);
    const quality = emptyAnswerQuality();
    quality.events = bounded;
    quality.total = bounded.length;
    const unresolved = new Map();
    for (const event of bounded) {
      quality.counts[event.bucket] += 1;
      const topic = String(event.topic || 'unresolved-general').slice(0, 80);
      quality.topics[topic] = Number(quality.topics[topic] || 0) + 1;
      if (event.bucket === 'unknown' && /^[a-f0-9]{24}$/i.test(String(event.fingerprint || ''))) {
        const key = String(event.fingerprint);
        const existing = unresolved.get(key);
        if (existing) {
          existing.count += 1;
          existing.lastSeen = new Date(Number(event.at)).toISOString();
        } else {
          unresolved.set(key, {
            fingerprint: key,
            topic,
            language: event.language === 'ru' ? 'ru' : 'en',
            count: 1,
            firstSeen: new Date(Number(event.at)).toISOString(),
            lastSeen: new Date(Number(event.at)).toISOString()
          });
        }
      }
    }
    for (const key of Object.keys(quality.counts)) {
      quality.rates[key] = quality.total ? quality.counts[key] / quality.total : 0;
    }
    quality.unresolved = [...unresolved.values()]
      .sort((a, b) => b.count - a.count || String(b.lastSeen).localeCompare(String(a.lastSeen)))
      .slice(0, 30);
    quality.updatedAt = bounded.length ? new Date(Number(bounded.at(-1).at)).toISOString() : null;
    return quality;
  }

  function loadAnswerQuality() {
    try {
      const parsed = JSON.parse(localStorage.getItem(ANSWER_QUALITY_KEY) || 'null');
      if (parsed?.version === ANSWER_QUALITY_VERSION && Array.isArray(parsed?.events)) return rebuildAnswerQuality(parsed.events);
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
      const payload = new TextEncoder().encode(answerQualitySalt() + '|' + norm(raw));
      const digest = await crypto.subtle.digest('SHA-256', payload);
      return [...new Uint8Array(digest)].map(x => x.toString(16).padStart(2, '0')).join('').slice(0, 24);
    } catch (_) { return null; }
  }

  async function recordAnswerQuality(contract, raw, outcome = null) {
    const current = loadAnswerQuality();
    const bucket = outcome === 'error' ? 'error' : contract.confidenceClass;
    if (![...CONFIDENCE_CLASSES, 'error'].includes(bucket)) return;
    const topic = String(contract.topic || 'unresolved-general').slice(0, 80);
    const fingerprint = bucket === 'unknown' && outcome !== 'error' ? await questionFingerprint(raw) : null;
    const event = {
      at: Date.now(),
      bucket,
      topic,
      language: contract.language === 'ru' ? 'ru' : 'en',
      fingerprint: fingerprint || null
    };
    const quality = rebuildAnswerQuality([...current.events, event]);
    try { localStorage.setItem(ANSWER_QUALITY_KEY, JSON.stringify(quality)); } catch (_) {}
  }

`;

app = replaceSection(
  app,
  '  function emptyAnswerQuality() {',
  '  async function buildAnswerContract',
  qualityReplacement,
  'quality implementation'
);

fs.writeFileSync(APP, app, 'utf8');
console.log(JSON.stringify({
  status: 'patched',
  qualityVersion: '0.2-local-answer-quality-30d',
  windowDays: 30,
  eventLimit: 500,
  rawQuestionPersistence: false,
  transmissionAdded: false
}, null, 2));
