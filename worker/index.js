import { DurableObject } from 'cloudflare:workers';

const MAX_BODY_BYTES = 12_000;
const MAX_QUESTION = 700;
const MAX_ANSWER = 2_400;
const RETENTION_DAYS = 30;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), {
  status,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    ...headers
  }
});

const SECRET_PATTERNS = [
  /\b0x[a-f0-9]{64}\b/i,
  /\b(?:api[_ -]?key|secret|password|passphrase|private[_ -]?key|seed[_ -]?phrase|mnemonic)\s*[:=]\s*\S{8,}/i,
  /\b(?:bearer\s+)[a-z0-9._~+\/=-]{16,}\b/i,
  /\beyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\b/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i,
  /\b(?:seed phrase|mnemonic|сид[- ]?фраза)\s*[:=]\s*(?:[a-zа-яё]{2,}\s+){5,}[a-zа-яё]{2,}/i
];
const INJECTION_PATTERNS = [
  /ignore\s+(?:all\s+)?(?:previous|prior|system|developer)\s+instructions/i,
  /reveal\s+(?:the\s+)?(?:system|developer)\s+prompt/i,
  /show\s+(?:me\s+)?(?:your\s+)?(?:system|developer)\s+(?:prompt|message)/i,
  /jailbreak/i,
  /bypass\s+(?:the\s+)?(?:guard|policy|safety|instructions)/i,
  /act\s+as\s+root/i,
  /execute\s+(?:this\s+)?(?:shell|command|code)/i,
  /run\s+(?:this\s+)?(?:shell|terminal|bash|powershell)/i,
  /exfiltrat/i
];
const FINANCIAL_ADVICE_PATTERNS = [
  /что\s+(?:мне\s+)?(?:купить|продать|покупать|продавать|инвестировать)/i,
  /куда\s+(?:мне\s+)?(?:вложить|инвестировать)/i,
  /стоит\s+ли\s+(?:мне\s+)?(?:купить|покупать|продать|продавать|вложить|инвестировать)/i,
  /сколько\s+(?:мне\s+)?(?:вложить|инвестировать|купить)/i,
  /составь\s+(?:мне\s+)?(?:портфель|аллокац)/i,
  /(?:what|which)\s+should\s+i\s+(?:buy|sell|invest)/i,
  /where\s+should\s+i\s+invest/i,
  /how\s+much\s+should\s+i\s+invest/i,
  /(?:build|make)\s+me\s+(?:a\s+)?portfolio/i,
  /recommend\s+(?:me\s+)?(?:a\s+)?(?:coin|token|protocol|investment)/i,
  /best\s+(?:coin|token|protocol|investment)\s+for\s+me/i
];
const LEGAL_TAX_PATTERNS = [
  /что\s+(?:мне\s+)?делать\s+с\s+налог/i,
  /как\s+(?:мне\s+)?(?:не\s+платить|избежать)\s+налог/i,
  /дай\s+(?:мне\s+)?юридическ/i,
  /legal\s+advice\s+for\s+me/i,
  /how\s+can\s+i\s+avoid\s+tax/i,
  /what\s+should\s+i\s+do\s+about\s+(?:my\s+)?tax/i
];
const PHISHING_PATTERNS = [
  /(?:connect|подключи)\s+(?:your|мой|кошелек|wallet).*(?:sign|подпиш)/i,
  /(?:claim|получи).*(?:airdrop|эйрдроп).*(?:sign|подпиш|connect|wallet)/i,
  /(?:send|отправ).*(?:seed|private key|сид фраз|приватн)/i
];

function any(text, patterns) { return patterns.some(rx => rx.test(text)); }

function serverClassify(question) {
  const q = String(question || '').trim();
  if (!q) return { category: 'empty', learnable: false, blocked: true };
  if (q.length > MAX_QUESTION) return { category: 'oversize', learnable: false, blocked: true };
  if (any(q, SECRET_PATTERNS)) return { category: 'secret-risk', learnable: false, blocked: true };
  if (any(q, PHISHING_PATTERNS)) return { category: 'phishing-risk', learnable: false, blocked: true };
  if (any(q, INJECTION_PATTERNS)) return { category: 'prompt-injection', learnable: false, blocked: true };
  if (any(q, FINANCIAL_ADVICE_PATTERNS)) return { category: 'financial-advice', learnable: false, blocked: true };
  if (any(q, LEGAL_TAX_PATTERNS)) return { category: 'legal-tax-advice', learnable: false, blocked: true };
  return { category: /https?:\/\/|www\./i.test(q) ? 'external-link-present' : 'allowed', learnable: true, blocked: false };
}

function redact(text, maxLen) {
  let value = String(text || '').slice(0, maxLen);
  value = value
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[redacted-email]')
    .replace(/https?:\/\/\S+|www\.\S+/gi, '[redacted-url]')
    .replace(/\b0x[a-f0-9]{40}\b/gi, '[redacted-address]')
    .replace(/\b0x[a-f0-9]{64}\b/gi, '[redacted-secret]')
    .replace(/\b(?:\+?\d[\d\s().-]{7,}\d)\b/g, '[redacted-phone]')
    .replace(/\b(?:\d[ -]*?){13,19}\b/g, '[redacted-number]')
    .replace(/\beyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\b/g, '[redacted-token]');
  for (const rx of SECRET_PATTERNS) value = value.replace(rx, '[redacted-secret]');
  return value.trim();
}

async function sha256Hex(text) {
  const bytes = new TextEncoder().encode(String(text));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(x => x.toString(16).padStart(2, '0')).join('');
}

async function rateBucket(request) {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const day = new Date().toISOString().slice(0, 10);
  return sha256Hex(`the-holding-learning-v1|${day}|${ip}`);
}

function isSameOriginPost(request) {
  const origin = request.headers.get('Origin');
  if (!origin) return false;
  try { return new URL(origin).origin === new URL(request.url).origin; }
  catch { return false; }
}

function intakeConfigured(env) {
  const controller = String(env.LEARNING_CONTROLLER_NAME || '').trim();
  const contact = String(env.LEARNING_CONTROLLER_CONTACT || '').trim();
  const basis = String(env.LEARNING_LEGAL_BASIS_NOTICE || '').trim();
  const unset = value => !value || /^(unset|tbd|todo|placeholder)$/i.test(value);
  return env.LEARNING_INTAKE_ENABLED === 'true' && !unset(controller) && !unset(contact) && !unset(basis);
}

export class LearningIntake extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.ctx = ctx;
    this.env = env;
    this.sql = ctx.storage.sql;
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY,
        created_at INTEGER NOT NULL,
        question_hash TEXT NOT NULL,
        question_sample TEXT,
        language TEXT NOT NULL,
        category TEXT NOT NULL,
        client_category TEXT,
        outcome TEXT NOT NULL,
        answer_hash TEXT,
        source TEXT,
        helpful INTEGER,
        blocked INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS events_created_at_idx ON events(created_at);
      CREATE INDEX IF NOT EXISTS events_category_idx ON events(category);
      CREATE INDEX IF NOT EXISTS events_outcome_idx ON events(outcome);
      CREATE TABLE IF NOT EXISTS rate_limits (
        bucket TEXT PRIMARY KEY,
        window_start INTEGER NOT NULL,
        count INTEGER NOT NULL
      );
    `);
  }

  prune(now) {
    this.sql.exec('DELETE FROM events WHERE created_at < ?', now - RETENTION_DAYS * DAY_MS);
    this.sql.exec('DELETE FROM rate_limits WHERE window_start < ?', now - 2 * DAY_MS);
  }

  checkRate(bucket, now) {
    const row = this.sql.exec('SELECT window_start, count FROM rate_limits WHERE bucket = ?', bucket).toArray()[0];
    if (!row || now - Number(row.window_start) >= RATE_WINDOW_MS) {
      this.sql.exec(
        'INSERT INTO rate_limits(bucket, window_start, count) VALUES(?, ?, 1) ON CONFLICT(bucket) DO UPDATE SET window_start = excluded.window_start, count = 1',
        bucket, now
      );
      return true;
    }
    if (Number(row.count) >= RATE_LIMIT) return false;
    this.sql.exec('UPDATE rate_limits SET count = count + 1 WHERE bucket = ?', bucket);
    return true;
  }

  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === '/internal/intake' && request.method === 'POST') return this.handleIntake(request);
    if (url.pathname === '/internal/feedback' && request.method === 'POST') return this.handleFeedback(request);
    if (url.pathname === '/internal/summary' && request.method === 'GET') return this.handleSummary();
    if (url.pathname === '/internal/detail' && request.method === 'GET') return this.handleDetail(url);
    return json({ error: 'not-found' }, 404);
  }

  async handleIntake(request) {
    const now = Date.now();
    this.prune(now);
    const payload = await request.json();
    const bucket = String(payload._rateBucket || '');
    if (!/^[a-f0-9]{64}$/.test(bucket) || !this.checkRate(bucket, now)) return json({ accepted: false, error: 'rate-limited' }, 429);

    const question = String(payload.question || '').trim();
    const classification = serverClassify(question);
    const id = crypto.randomUUID();
    const questionHash = classification.learnable ? await sha256Hex(question) : await sha256Hex(`${classification.category}|${id}`);
    const answer = String(payload.answer || '').slice(0, MAX_ANSWER);
    const answerHash = answer ? await sha256Hex(answer) : null;
    const questionSample = classification.learnable ? redact(question, MAX_QUESTION) : null;
    const source = redact(String(payload.source || ''), 400);
    const outcome = String(payload.outcome || 'answered').slice(0, 80);
    const language = payload.language === 'ru' ? 'ru' : 'en';
    const clientCategory = String(payload.clientCategory || '').slice(0, 80);

    this.sql.exec(
      `INSERT INTO events(id, created_at, question_hash, question_sample, language, category, client_category, outcome, answer_hash, source, helpful, blocked)
       VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)`,
      id, now, questionHash, questionSample, language, classification.category, clientCategory, outcome, answerHash, source, classification.blocked ? 1 : 0
    );
    return json({ accepted: true, eventId: id, category: classification.category });
  }

  async handleFeedback(request) {
    const payload = await request.json();
    const eventId = String(payload.eventId || '');
    const signal = payload.signal === 'helpful' ? 1 : payload.signal === 'not-helpful' ? -1 : 0;
    if (!/^[0-9a-f-]{36}$/i.test(eventId) || !signal) return json({ accepted: false }, 400);
    const existing = this.sql.exec('SELECT id FROM events WHERE id = ?', eventId).toArray()[0];
    if (!existing) return json({ accepted: false }, 404);
    this.sql.exec('UPDATE events SET helpful = ? WHERE id = ?', signal, eventId);
    return json({ accepted: true });
  }

  handleSummary() {
    const since = Date.now() - RETENTION_DAYS * DAY_MS;
    const count = (sql, ...args) => Number(this.sql.exec(sql, ...args).one().n || 0);
    const categories = [...this.sql.exec(
      'SELECT category, COUNT(*) AS count FROM events WHERE created_at >= ? GROUP BY category ORDER BY count DESC LIMIT 20', since
    )];
    return json({
      version: '0.1-safe-conversation-learning',
      windowDays: RETENTION_DAYS,
      total: count('SELECT COUNT(*) AS n FROM events WHERE created_at >= ?', since),
      answered: count("SELECT COUNT(*) AS n FROM events WHERE created_at >= ? AND outcome = 'answered'", since),
      unknown: count("SELECT COUNT(*) AS n FROM events WHERE created_at >= ? AND outcome = 'unknown'", since),
      helpful: count('SELECT COUNT(*) AS n FROM events WHERE created_at >= ? AND helpful = 1', since),
      notHelpful: count('SELECT COUNT(*) AS n FROM events WHERE created_at >= ? AND helpful = -1', since),
      blocked: count('SELECT COUNT(*) AS n FROM events WHERE created_at >= ? AND blocked = 1', since),
      categories: categories.map(row => ({ category: row.category, count: Number(row.count) }))
    });
  }

  handleDetail(url) {
    const since = Date.now() - RETENTION_DAYS * DAY_MS;
    const limit = Math.max(1, Math.min(50, Number(url.searchParams.get('limit') || 20)));
    const rows = [...this.sql.exec(
      `SELECT id, created_at, question_sample, language, category, outcome, source, helpful, blocked
       FROM events WHERE created_at >= ? AND question_sample IS NOT NULL
       ORDER BY CASE WHEN helpful = -1 THEN 0 WHEN outcome = 'unknown' THEN 1 ELSE 2 END, created_at DESC LIMIT ?`,
      since, limit
    )];
    return json({
      version: '0.1-safe-conversation-learning',
      retentionDays: RETENTION_DAYS,
      samples: rows.map(row => ({
        eventId: row.id,
        createdAt: new Date(Number(row.created_at)).toISOString(),
        question: row.question_sample,
        language: row.language,
        category: row.category,
        outcome: row.outcome,
        source: row.source,
        helpful: row.helpful === null ? null : Number(row.helpful),
        blocked: Number(row.blocked) === 1
      }))
    });
  }
}

async function readBodyJson(request) {
  const length = Number(request.headers.get('content-length') || 0);
  if (length > MAX_BODY_BYTES) throw new Error('body-too-large');
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) throw new Error('body-too-large');
  return JSON.parse(text);
}

function adminAuthorized(request, env) {
  const expected = String(env.LEARNING_READ_TOKEN || '');
  const provided = String(request.headers.get('X-Holding-Learning-Token') || '');
  if (!expected || expected.length < 24 || provided.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ provided.charCodeAt(i);
  return diff === 0;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/learning-status' && request.method === 'GET') {
      const enabled = intakeConfigured(env);
      return json({
        version: '0.1-safe-conversation-learning',
        intakeEnabled: enabled,
        optInOnly: true,
        publicInputTrust: 'untrusted',
        rawMessagesStored: false,
        sanitizedSampleRetentionDays: RETENTION_DAYS,
        financialAdvice: false,
        walletAuthority: false,
        capitalAuthority: false,
        directSelfModification: false,
        controller: enabled ? String(env.LEARNING_CONTROLLER_NAME) : null,
        contact: enabled ? String(env.LEARNING_CONTROLLER_CONTACT) : null,
        legalBasisNotice: enabled ? String(env.LEARNING_LEGAL_BASIS_NOTICE) : null
      });
    }

    if (url.pathname === '/api/learning-intake' && request.method === 'POST') {
      if (!intakeConfigured(env)) return json({ accepted: false, error: 'learning-intake-disabled' }, 503);
      if (!isSameOriginPost(request)) return json({ accepted: false, error: 'same-origin-required' }, 403);
      let payload;
      try { payload = await readBodyJson(request); }
      catch (error) { return json({ accepted: false, error: error.message === 'body-too-large' ? 'body-too-large' : 'invalid-json' }, 400); }
      if (payload?.schema !== '0.1-safe-conversation-learning') return json({ accepted: false, error: 'schema-mismatch' }, 400);
      if (payload?.consent !== true) return json({ accepted: false, error: 'explicit-opt-in-required' }, 400);

      const bucket = await rateBucket(request);
      const id = env.LEARNING_INTAKE.idFromName('public-intake-v1');
      return env.LEARNING_INTAKE.get(id).fetch(new Request('https://learning.internal/internal/intake', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...payload, _rateBucket: bucket })
      }));
    }

    if (url.pathname === '/api/learning-feedback' && request.method === 'POST') {
      if (!intakeConfigured(env)) return json({ accepted: false, error: 'learning-intake-disabled' }, 503);
      if (!isSameOriginPost(request)) return json({ accepted: false, error: 'same-origin-required' }, 403);
      let payload;
      try { payload = await readBodyJson(request); }
      catch { return json({ accepted: false, error: 'invalid-json' }, 400); }
      const id = env.LEARNING_INTAKE.idFromName('public-intake-v1');
      return env.LEARNING_INTAKE.get(id).fetch(new Request('https://learning.internal/internal/feedback', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload)
      }));
    }

    if (url.pathname === '/api/learning-insights' && request.method === 'GET') {
      const id = env.LEARNING_INTAKE.idFromName('public-intake-v1');
      const stub = env.LEARNING_INTAKE.get(id);
      if (url.searchParams.get('detail') === '1') {
        if (!adminAuthorized(request, env)) return json({ error: 'not-authorized' }, 401);
        const target = new URL('https://learning.internal/internal/detail');
        target.searchParams.set('limit', url.searchParams.get('limit') || '20');
        return stub.fetch(new Request(target));
      }
      return stub.fetch(new Request('https://learning.internal/internal/summary'));
    }

    return env.ASSETS.fetch(request);
  }
};