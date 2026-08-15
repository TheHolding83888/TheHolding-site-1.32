(() => {
  'use strict';

  const URLS = Object.freeze({
    stack: '/intelligence/cognitive-stack-state.json',
    bridge: '/intelligence/brain-chatgpt-bridge.json',
    learning: '/intelligence/learning-state/learning-context.json',
    decisions: '/intelligence/learning/decision-ledger.json',
    proposals: '/intelligence/proposals/proposal-queue.json',
    builder: '/intelligence/builder/candidate-queue.json',
    guardian: '/intelligence/guardian/guardian-state.json',
    productivity: '/companies/productivity-data.json',
    stable: '/companies/stable-capital-data.json',
    rewards: '/companies/rewards-data.json',
    embedded: '/companies/embedded-yield-ledger.json',
    entries: '/companies/company-008-strategy-entry-ledger.json',
    companies: '/companies/'
  });

  const PUBLIC_PAGES = Object.freeze([
    ['The Holding', '/'],
    ['Companies', '/companies/'],
    ['FAQ', '/faq/'],
    ['Defitea', '/defitea/'],
    ['Substantia', '/substantia/'],
    ['Monetra', '/monetra/'],
    ['Fructus', '/fructus/'],
    ['Singul', '/singul/'],
    ['YieldRing', '/yieldring/'],
    ['Intelligence', '/agents/'],
    ['Manifesto', '/manifesto']
  ]);

  const state = {
    stack: null,
    bridge: null,
    learning: null,
    decisions: null,
    proposals: null,
    builder: null,
    guardian: null,
    productivity: null,
    stable: null,
    registry: [],
    lazy: { rewards: null, embedded: null, entries: null },
    pageText: new Map(),
    lastEntity: null,
    lastTopic: null
  };

  const ANSWER_CONTRACT_VERSION = '0.1-source-bound-answer-contract';
  const ANSWER_QUALITY_VERSION = '0.2-local-answer-quality-30d';
  const ANSWER_QUALITY_KEY = 'holding-answer-quality-v2';
  const ANSWER_QUALITY_SALT_KEY = 'holding-answer-quality-salt-v1';
  const ANSWER_QUALITY_WINDOW_DAYS = 30;
  const ANSWER_QUALITY_WINDOW_MS = ANSWER_QUALITY_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const ANSWER_QUALITY_EVENT_LIMIT = 500;
  const CONFIDENCE_CLASSES = Object.freeze(['measured', 'partial', 'warming', 'unknown']);

  const $ = id => document.getElementById(id);
  const consoleEl = $('console');
  const messages = $('messages');
  const input = $('question');
  const button = $('askButton');
  const form = $('askForm');

  const safeArray = value => Array.isArray(value) ? value : [];
  const safeObject = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const finite = value => (value === null || value === undefined || value === '') ? null : (Number.isFinite(Number(value)) ? Number(value) : null);
  const pct = value => finite(value) === null ? null : `${Number(value).toFixed(2).replace(/\.00$/, '')}%`;
  const usd = value => finite(value) === null ? null : `$${Number(value).toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
  const dateShort = value => {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
  };
  const isRu = text => /[а-яё]/i.test(text);

  // Conservative human-language typo recovery. This is intentionally NOT global fuzzy search.
  // Only known entity/protocol/intent lexemes may be corrected, with edit distance <= 1.
  const FUZZY_QUERY_LEXEMES = Object.freeze([
    'holding', 'monetra', 'defitea', 'yieldring', 'yield', 'basis', 'aerodrome', 'velodrome',
    'rewards', 'reward', 'claimable', 'companies', 'company', 'using', 'compare', 'productivity',
    'performance', 'embedded', 'current', 'first', 'registry', 'passport', 'learning', 'proposal', 'builder',
    'guardian', 'transaction', 'authority', 'allocation'
  ]);

  function editDistanceAtMostOne(a, b) {
    if (a === b) return true;
    if (Math.abs(a.length - b.length) > 1) return false;
    if (a.length === b.length) {
      let mismatches = 0;
      for (let i = 0; i < a.length; i++) if (a[i] !== b[i] && ++mismatches > 1) return false;
      return true;
    }
    const shorter = a.length < b.length ? a : b;
    const longer = a.length < b.length ? b : a;
    let i = 0, j = 0, edits = 0;
    while (i < shorter.length && j < longer.length) {
      if (shorter[i] === longer[j]) { i++; j++; continue; }
      if (++edits > 1) return false;
      j++;
    }
    return true;
  }

  function fuzzyKnownLexemes(text) {
    return String(text || '').replace(/[A-Za-z][A-Za-z0-9-]{3,}/g, token => {
      const lower = token.toLowerCase();
      if (FUZZY_QUERY_LEXEMES.includes(lower)) return lower;
      const matches = FUZZY_QUERY_LEXEMES.filter(candidate =>
        candidate[0] === lower[0]
        && Math.abs(candidate.length - lower.length) <= 1
        && editDistanceAtMostOne(lower, candidate)
      );
      return matches.length === 1 ? matches[0] : token;
    });
  }

  const FUZZY_RU_QUERY_LEXEMES = Object.freeze([
    'монетра', 'монетру', 'монетре', 'дефити', 'дефитеа', 'йелд', 'елд', 'бейсис',
    'аэродром', 'велодром', 'ревардс', 'реварды', 'ревардсам', 'награды', 'компания',
    'компании', 'использует', 'используют', 'продуктивность', 'доходность', 'сравни',
    'транзакцию', 'транзу', 'приватник', 'приватника', 'клеймабл', 'клеймаблам', 'клаймабл', 'клаймаблам'
  ]);

  function fuzzyKnownRuLexemes(text) {
    return String(text || '').replace(/[А-Яа-яЁё]{3,}/g, token => {
      const lower = token.toLowerCase().replace(/ё/g, 'е');
      if (FUZZY_RU_QUERY_LEXEMES.includes(lower)) return lower;
      const matches = FUZZY_RU_QUERY_LEXEMES.filter(candidate =>
        candidate[0] === lower[0]
        && Math.abs(candidate.length - lower.length) <= 1
        && editDistanceAtMostOne(lower, candidate)
      );
      return matches.length === 1 ? matches[0] : token;
    });
  }

  function canonicalizeHumanAliases(text) {
    return fuzzyKnownLexemes(fuzzyKnownRuLexemes(String(text || '')))
      .replace(/монетра|монетру|монетре/gi, 'monetra')
      .replace(/дефити|дефитеа/gi, 'defitea')
      .replace(/(?:йелд|елд)\s+бейсис/gi, 'yield basis')
      .replace(/аэродром/gi, 'aerodrome')
      .replace(/велодром/gi, 'velodrome')
      .replace(/ревардс|реварды|ревардсам/gi, 'rewards')
      .replace(/приватник(?:а|у|ом|е|и)?/gi, 'private key')
      .replace(/к(?:лей|лай)мабл[а-я]*/gi, 'claimable');
  }

  const norm = text => canonicalizeHumanAliases(String(text || ''))
    .replace(/\bholdng\b/gi, 'holding')
    .replace(/\brewads\b/gi, 'rewards')
    .replace(/\bcmpare\b/gi, 'compare')
    .replace(/\b1milliondolar\b/gi, '1milliondollar')
    .replace(/\bраскажи\b/gi, 'расскажи')
    .replace(/апи/gi, 'apy')
    .replace(/щас/gi, 'сейчас')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[’']/g, '')
    .replace(/[^a-zа-я0-9.()$+-]+/gi, ' ')
    .trim();
  const words = text => norm(text)
    .split(/\s+/)
    .filter(w => w.length > 2 && ![
      'что', 'это', 'как', 'про', 'расскажи', 'какая', 'какой', 'какие', 'сейчас', 'пожалуйста',
      'the', 'and', 'about', 'tell', 'what', 'which', 'current', 'please'
    ].includes(w));
  const includesAny = (q, list) => list.some(x => q.includes(norm(x)));

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
    if (/Proposal Work Queue/i.test(s)) add(URLS.proposals);
    if (/Builder Candidate Queue/i.test(s)) add(URLS.builder);
    if (/Guardian State/i.test(s)) add(URLS.guardian);
    if (/OS Governance/i.test(s)) { add(URLS.proposals); add(URLS.builder); add(URLS.guardian); }
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
    if (artifact === URLS.proposals) return state.proposals?.generatedAt || null;
    if (artifact === URLS.builder) return state.builder?.generatedAt || null;
    if (artifact === URLS.guardian) return state.guardian?.generatedAt || null;
    if (artifact === URLS.productivity) return state.productivity?.generatedAt || null;
    if (artifact === URLS.stable) return state.stable?.generatedAt || null;
    if (artifact === URLS.rewards) return state.lazy.rewards?.generatedAt || null;
    if (artifact === URLS.embedded) return state.lazy.embedded?.generatedAt || null;
    if (artifact === URLS.entries) return state.lazy.entries?.generatedAt || null;
    return null;
  }

  function confidenceForAnswer(result) {
    if (CONFIDENCE_CLASSES.includes(result?.confidenceHint)) return result.confidenceHint;
    const text = norm(result?.text);
    const source = norm(result?.source);
    if (!result?.source || /unavailable|no sufficiently strong verified match|fail closed/.test(source)) return 'unknown';
    if (/не могу ответить|cannot answer|не удалось|could not safely|не найден|not found|no exact|нет подтвержден|no verified|не загрузил|did not load|unavailable/.test(text)) return 'unknown';
    const hasWarming = /warming|догрев|прогрев/.test(text);
    const hasMeasuredValue = /(?:\$|\d+(?:[.,]\d+)?%)/.test(String(result?.text || ''));
    if (hasWarming) return hasMeasuredValue ? 'partial' : 'warming';
    const coverageMatches = [...String(result?.text || '').matchAll(/(?:coverage|покрытие)[^0-9]{0,24}(\d+(?:[.,]\d+)?)%/gi)];
    if (coverageMatches.some(m => Number(String(m[1]).replace(',', '.')) < 99.999)) return 'partial';
    if (/partial|частичн/.test(text)) return 'partial';
    return 'measured';
  }

  function coarseTopic(raw) {
    if (state.lastTopic) return String(state.lastTopic).slice(0, 80);
    const protocol = protocolGroup(raw);
    if (protocol) return 'protocol:' + protocol;
    const q = norm(raw);
    if (includesAny(q, ['reward', 'награ', 'claimable', 'accrued'])) return 'rewards';
    if (includesAny(q, ['embedded', 'встроенн'])) return 'embedded-yield';
    if (includesAny(q, ['apr', 'apy', 'yield', 'доходност', 'продуктив'])) return 'productivity';
    return 'unresolved-general';
  }

  function emptyAnswerQuality() {
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

  function enforceOutputGuard(contracted, raw, language) {
    const result = contracted || {};
    const contract = result.answerContract || {};
    const text = String(result.text || '');
    const lower = text.toLowerCase();
    const rawText = String(raw || '');
    const artifacts = safeArray(contract.sourceArtifacts);

    // Final-stage high-recall risk context. Input routing remains the first line, but these checks run
    // after the answer is built so paraphrase failure cannot silently fall through to a generic answer.
    const authorityRequest = /(?:sign|confirm|approve|execute).{0,30}(?:tx|transaction)|(?:tx|transaction).{0,30}(?:sign|confirm|approve|execute)|move.{0,20}(?:my|the).{0,12}capital|on my behalf.{0,30}(?:tx|transaction)/i.test(rawText)
      || /(?:подпис|подтверд|заапрув|исполн).{0,30}(?:транз|tx)|(?:транз|tx).{0,30}(?:подпис|подтверд|заапрув|исполн)|двиг.{0,20}капитал/i.test(rawText);
    const secretRequest = /private\s+key|seed\s+phrase|recovery\s+phrase|mnemonic|secret\s+key/i.test(rawText)
      || /приватн.{0,12}ключ|приватник|закрыт.{0,12}ключ|сид.{0,8}фраз|мнемонич|фраз.{0,10}восстанов/i.test(rawText);
    const personalizedAdviceRequest = /(?:what|which).{0,24}(?:should|recommend).{0,20}(?:i|me).{0,16}(?:buy|sell|allocate)|exact\s+allocation.{0,20}(?:i|my|me)|what\s+should\s+i\s+buy/i.test(rawText)
      || /(?:что|куда).{0,16}(?:мне|я).{0,16}(?:купить|продать|вложить|аллоцир)|точн.{0,12}аллокац.{0,20}(?:мне|мой)/i.test(rawText);

    const positiveExecutionClaim = /\b(?:i|we|the holding|this console|guardian|builder)\s+(?:can|may|will|is able to)\s+(?:directly\s+)?(?:sign|execute|move|transfer|trade|approve)\b/i.test(text)
      || /(?:я|мы|the holding|guardian|builder).{0,24}(?:могу|можем|может|умеет).{0,30}(?:подпис|исполн|двиг|перевод|торгов|одобр)/i.test(text);
    const explicitNoAuthority = /execution authority\s*:\s*none|cannot\s+(?:mutate|sign|execute|move|transfer)|не\s+(?:может|могу|можем|умеет).{0,30}(?:подпис|исполн|двиг|перевод|торгов)/i.test(text);

    const privateKeyLeak = /private\s+key\s*[:=]\s*(?:0x)?[a-f0-9]{64}\b/i.test(text)
      || /(?:приватн|закрыт).{0,16}ключ\s*[:=]\s*(?:0x)?[a-f0-9]{64}\b/i.test(text);
    const seedLeak = /(?:seed|mnemonic|recovery)\s+phrase\s*[:=]\s*(?:[a-z]+\s+){11,23}[a-z]+/i.test(text)
      || /(?:сид|мнемонич|фраз.{0,8}восстанов).{0,16}[:=]\s*(?:[a-zа-я]+\s+){11,23}[a-zа-я]+/i.test(text);

    const personalizedTrade = /\b(?:you should|i recommend(?: that)? you|my recommendation is to)\s+(?:buy|sell|allocate|trade)\b/i.test(text)
      || /\b(?:allocate|put)\s+\d{1,3}(?:\.\d+)?%\s+(?:of\s+)?(?:your|the)\b/i.test(text)
      || /(?:тебе|вам).{0,20}(?:стоит|нужно|следует).{0,16}(?:купить|продать|вложить|аллоцир)/i.test(text)
      || /(?:рекомендую|советую).{0,20}(?:купить|продать|вложить|аллоцир)/i.test(text);

    const measuredWithoutSource = contract.confidenceClass === 'measured' && artifacts.length === 0;

    if (secretRequest || privateKeyLeak || seedLeak) {
      const safe = language === 'ru'
        ? 'Я не буду раскрывать private keys, seed/recovery phrases или другие секреты. The Holding OS не должен выводить такие данные через Ask.'
        : 'I will not reveal private keys, seed/recovery phrases or other secrets. The Holding OS must not expose such data through Ask.';
      const c = Object.freeze({ ...contract, confidenceClass: 'measured', sourceArtifacts: ['/intelligence/project-memory/CURRENT.md'], generatedAt: null, topic: 'security-boundary', grounded: true });
      return { text: safe, source: 'The Holding project canon · output safety guard', answerContract: c, outputGuard: 'secret-block' };
    }

    if ((authorityRequest || positiveExecutionClaim) && !explicitNoAuthority) {
      const safe = language === 'ru'
        ? `Execution authority: ${executionAuthority().toUpperCase()}. Ask The Holding не может подписывать транзакции, исполнять сделки или двигать капитал.`
        : `Execution authority: ${executionAuthority().toUpperCase()}. Ask The Holding cannot sign transactions, execute trades or move capital.`;
      const c = Object.freeze({ ...contract, confidenceClass: 'measured', sourceArtifacts: [URLS.stack], generatedAt: artifactGeneratedAt(URLS.stack), topic: 'authority', grounded: true });
      return { text: safe, source: 'Live Cognitive Stack operating contract · output safety guard', answerContract: c, outputGuard: 'authority-block' };
    }

    if (personalizedAdviceRequest || personalizedTrade) {
      const safe = language === 'ru'
        ? 'The Holding может показывать структуры, evidence и trade-offs, но не выпускает персональную команду купить, продать или распределить капитал. Решение остаётся за владельцем.'
        : 'The Holding can show structures, evidence and trade-offs, but it does not issue personalized commands to buy, sell or allocate capital. The decision remains with the owner.';
      const c = Object.freeze({ ...contract, confidenceClass: 'measured', sourceArtifacts: ['/intelligence/project-memory/CURRENT.md'], generatedAt: null, topic: 'advice-boundary', grounded: true });
      return { text: safe, source: 'The Holding project canon · output safety guard', answerContract: c, outputGuard: 'advice-block' };
    }

    if (measuredWithoutSource) {
      const safe = language === 'ru'
        ? 'Финальный safety guard не нашёл валидного source mapping для уверенного ответа, поэтому ответ понижен до UNKNOWN.'
        : 'The final safety guard found no valid source mapping for a confident answer, so the answer is downgraded to UNKNOWN.';
      const c = Object.freeze({ ...contract, confidenceClass: 'unknown', sourceArtifacts: [], generatedAt: null, grounded: false });
      return { text: safe, source: 'Output safety guard · source mapping unavailable', answerContract: c, outputGuard: 'source-block' };
    }

    return { ...result, outputGuard: 'pass' };
  }

  window.HoldingOutputGuard = Object.freeze({
    version: '0.1-final-answer-safety-guard',
    check: (contracted, raw, language) => structuredClone(enforceOutputGuard(contracted, raw, language))
  });

  window.HoldingAnswerQuality = Object.freeze({
    version: ANSWER_QUALITY_VERSION,
    snapshot: () => structuredClone(loadAnswerQuality())
  });

  const PROTOCOL_ALIASES = Object.freeze({
    aerodrome: ['aerodrome', 'аэродром', 'aero', 'veaero'],
    velodrome: ['velodrome', 'велодром', 'velo', 'vevelo'],
    convex: ['convex', 'конвекс', 'cvx', 'vlcvx', 'cvxcrv'],
    curve: ['curve', 'керв', 'кёрв', 'curve dao', 'crv', 'vecrv'],
    yieldbasis: ['yield basis', 'yieldbasis', 'yield-basis', 'yb', 'veyb', 'yb-lp', 'йелд бейсис', 'илд бейсис'],
    frax: ['frax', 'фракс', 'vefrax', 'frxusd', 'sfrxusd'],
    pendle: ['pendle', 'пендл', 'spendle', 'vependle'],
    fx: ['f(x)', 'fx protocol', 'fxn', 'vefxn', 'fxsave', 'fxusd'],
    liquity: ['liquity', 'ликвити', 'lqty', 'bold'],
    resupply: ['resupply', 'ресаплай', 'rsup'],
    beefy: ['beefy', 'бифи'],
    venice: ['venice', 'венис', 'vvv', 'svvv'],
    icp: ['internet computer', 'icp', 'интернет компьютер'],
    aave: ['aave', 'ааве'],
    spark: ['spark', 'спарк'],
    morpho: ['morpho', 'морфо'],
    maker: ['maker', 'sky', 'скай'],
    fluid: ['fluid', 'флюид']
  });

  const CONCEPTS = Object.freeze({
    layers: {
      keys: ['слои капитала', 'слои дохода', 'capital layers', 'economic layers', 'productivity vs rewards', 'продуктивность и награды'],
      ru: 'The Holding специально не смешивает разные виды экономического результата:\n\n1. Reference Productivity / APR – текущая измеримая способность позиции приносить доход.\n2. Embedded Yield – доход, который уже накапливается внутри самой позиции.\n3. Accrued Rewards – награды, которые уже заработаны в протоколе, но ещё не получены в казну.\n4. Realised Cash Flow – деньги, которые уже реально пришли.\n5. Treasury – то, что уже лежит в казне.\n6. Performance – итоговый результат капитала относительно точки входа.\n\nГлавное правило: эти слои не смешиваются. Каждый отвечает на свой вопрос.',
      en: 'The Holding deliberately keeps different economic results separate:\n\n1. Reference Productivity / APR – current measurable earning capacity.\n2. Embedded Yield – value already compounding inside a position.\n3. Accrued Rewards – protocol rewards earned but not yet received by treasury.\n4. Realised Cash Flow – money already received.\n5. Treasury – capital already held in treasury.\n6. Performance – the result of capital versus its entry point.\n\nThe rule is simple: do not mix these layers. Each answers a different question.'
    },
    holding: {
      keys: ['что такое the holding', 'что такое холдинг', 'what is the holding', 'расскажи про the holding', 'про holding'],
      ru: 'The Holding – это операционная система для капитала и onchain-компаний. Она помогает зарегистрировать компанию, видеть активы и доходность, помнить историю, объяснять изменения и постепенно превращать капитал из набора кошельков в систему, которая понимает своё состояние и умеет учиться.',
      en: 'The Holding is an operating system for capital and onchain companies. It registers companies, measures assets and productivity, remembers history, explains change, and gradually turns capital from a set of wallets into a system that understands its own state and can learn.'
    },
    company: {
      keys: ['что такое компания', 'personal onchain company', 'onchain company', 'личная компания', 'персональная компания'],
      ru: 'Personal Onchain Company – это постоянная цифровая оболочка вокруг капитала владельца: своя идентичность, кошелёк или несколько кошельков, Company Passport, история, позиции, доходность и правила. Капитал получает не только адрес, но структуру и память.',
      en: 'A Personal Onchain Company is a persistent digital structure around an owner’s capital: identity, one or more wallets, Company Passport, history, positions, productivity and rules. Capital gets not just an address, but structure and memory.'
    },
    registry: {
      keys: ['registry', 'реестр компаний', 'реестр', 'company registry'],
      ru: 'Registry – канонический реестр компаний The Holding. Он отвечает на простой вопрос: какие компании существуют в системе и какая у каждой постоянная идентичность.',
      en: 'The Registry is The Holding’s canonical company register. It answers which companies exist in the system and what persistent identity each one has.'
    },
    passport: {
      keys: ['company passport', 'паспорт компании', 'паспорт'],
      ru: 'Company Passport – понятная карточка живой компании: кто она, чем владеет, где работает капитал, какая измеримая доходность, какие rewards накоплены и как меняется состояние.',
      en: 'A Company Passport is the readable view of a live company: identity, holdings, where capital works, measured productivity, accrued rewards and changing state.'
    },
    funds: {
      keys: ['фонды', 'funds', 'какие фонды', 'структура фондов'],
      ru: 'В The Holding пять основных фондовых направлений:\n\n• Substantia – резерв и базовый капитал.\n• Defitea – продуктивный DeFi и cash flow.\n• Monetra – Stable Capital и доходность стейблкоинов.\n• Fructus – RWA.\n• Singul – venture и асимметричный рост.\n\nЭто разные задачи капитала, поэтому они разделены.',
      en: 'The Holding has five main fund directions:\n\n• Substantia – reserve and ballast capital.\n• Defitea – productive DeFi and cash flow.\n• Monetra – Stable Capital and stablecoin yield.\n• Fructus – RWA.\n• Singul – venture and asymmetric growth.\n\nThey solve different capital jobs, so they remain separate.'
    },
    productivity: {
      keys: ['что такое reference apr', 'что такое productivity', 'reference productivity', 'референс apr', 'продуктивность капитала'],
      ru: 'Reference Productivity / APR показывает текущую измеримую способность продуктивной позиции приносить доход по проверяемому источнику. Это ориентир мощности позиции сейчас – не обещание, не гарантированная ставка и не уже полученный cash flow.',
      en: 'Reference Productivity / APR measures the current earning capacity of a productive position from a reproducible source. It is current capacity – not a promise, guaranteed rate or already-realised cash flow.'
    },
    rewards: {
      keys: ['что такое rewards', 'что такое accrued rewards', 'accrued rewards', 'накопленные награды', 'награды протокола'],
      ru: 'Accrued Rewards – это уже заработанные, но ещё не полученные protocol-side награды. Пока они остаются claimable внутри протокола, это Rewards. Когда деньги реально пришли в кошелёк компании, это уже другой слой – Realised Cash Flow.',
      en: 'Accrued Rewards are protocol-side rewards already earned but not yet received. While they remain claimable inside the protocol they are Rewards; once received by the company wallet they become Realised Cash Flow.'
    },
    embedded: {
      keys: ['что такое embedded yield', 'embedded yield', 'встроенная доходность', 'доход внутри позиции'],
      ru: 'Embedded Yield – доход, который накапливается внутри самой позиции: например растёт PPS или redeemable value. Его не надо отдельно claim. Он считается отдельно от Accrued Rewards.',
      en: 'Embedded Yield is value that grows inside the position itself, such as PPS or redeemable value. It does not need a separate claim and stays separate from Accrued Rewards.'
    },
    cashflow: {
      keys: ['realised cash flow', 'realized cash flow', 'что такое cash flow', 'денежный поток', 'реализованный доход'],
      ru: 'Realised Cash Flow – это доход, который уже физически пришёл компании или фонду. Он больше не считается protocol-side accrued reward. Это слой фактически полученных денег.',
      en: 'Realised Cash Flow is income already physically received by the company or fund. It is no longer a protocol-side accrued reward; it is received cash.'
    },
    intelligent: {
      keys: ['умный капитал', 'мыслящий капитал', 'intelligent capital', 'smart capital'],
      ru: 'Умный капитал для The Holding – капитал с памятью и пониманием контекста. Он знает, чем владеет, что произошло, какая доходность измерена, какие решения принимались и чему система научилась. Автономные действия – более поздний этап и только в заранее ограниченных рамках.',
      en: 'Intelligent Capital means capital with memory and context. It knows what it owns, what changed, what productivity is measured, which decisions were made and what the system learned. Autonomous action is a later stage and only inside explicit limits.'
    },
    memory: {
      keys: ['память', 'memory vault', 'system memory', 'observer', 'наблюдатель'],
      ru: 'Observer замечает изменения. System Memory держит текущее рабочее состояние. Memory Vault хранит глубокую неизменяемую историю. Поэтому будущий AI может восстановить контекст The Holding, а не начинать жизнь с нуля.',
      en: 'Observer detects change. System Memory keeps current working state. Memory Vault preserves deep immutable history. This lets a future AI recover The Holding context instead of starting from zero.'
    },
    brain: {
      keys: ['мозг', 'brain', 'cognitive stack', 'когнитив'],
      ru: 'Brain получает проверенные данные от Observer, Memory и Security и превращает их в reasoning cases: что изменилось, почему это важно и что можно предложить дальше. Сам двигать капитал он не может.',
      en: 'The Brain receives verified data from Observer, Memory and Security and turns it into reasoning cases: what changed, why it matters and what may be proposed next. It cannot move capital by itself.'
    },
    learning: {
      keys: ['learning', 'обучение системы', 'как учится', 'чему учится'],
      ru: 'Learning строится на реальном цикле: возник случай → владелец принял решение → система увидела результат → сохранила урок. Старую историю можно использовать как знания, но нельзя подделывать из неё вымышленные outcomes.',
      en: 'Learning uses a real cycle: a case appears → the owner decides → the system observes the outcome → the lesson is preserved. Old history can be knowledge, but it is not fabricated into fake outcomes.'
    },
    governance: {
      keys: ['proposal', 'builder', 'guardian', 'как принимаются решения', 'governance'],
      ru: 'Proposal формирует предложение. Владелец решает, принимать его или нет. Builder может подготовить только разрешённый кандидат изменения. Guardian отдельно проверяет границы. Интеллект специально растёт быстрее, чем полномочия.',
      en: 'Proposal forms a recommendation. The owner decides whether to accept it. Builder may prepare only an allowed change candidate. Guardian independently checks boundaries. Intelligence deliberately grows faster than authority.'
    },
    selfcustody: {
      keys: ['self custody', 'self-custody', 'самостоятельное хранение', 'кастоди', 'custody'],
      ru: 'Базовый принцип – капитал остаётся под контролем владельца. The Holding строит интеллект, учёт и управление вокруг self-custody, а не требует передать капитал системе.',
      en: 'The base principle is owner control of capital. The Holding builds intelligence, accounting and management around self-custody rather than requiring the owner to hand capital to the system.'
    }
  });

  function addMessage(kind, text, source = '') {
    const box = document.createElement('div');
    box.className = `msg ${kind}`;
    const meta = document.createElement('span');
    meta.className = 'meta';
    meta.textContent = kind === 'user' ? 'You' : 'The Holding';
    const body = document.createElement('span');
    body.textContent = text;
    box.append(meta, body);
    if (source) {
      const src = document.createElement('span');
      src.className = 'source';
      src.textContent = source;
      box.appendChild(src);
    }
    messages.appendChild(box);
    messages.scrollTop = messages.scrollHeight;
    return box;
  }

  function pending(lang) {
    return addMessage('system pending', lang === 'ru' ? 'Смотрю живые данные…' : 'Reading live data…');
  }

  function resolvePending(box, text, source = '', contract = null) {
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
      const quality = contract ? ' · ' + contract.confidenceClass.toUpperCase() : '';
      src.textContent = (source || 'Answer Contract') + quality;
      box.appendChild(src);
    }
    messages.scrollTop = messages.scrollHeight;
  }

  async function getJson(url, optional = false) {
    try {
      const r = await fetch(`${url}?v=${Date.now()}`, { cache: 'no-store', credentials: 'same-origin' });
      if (!r.ok) throw new Error(`${r.status}`);
      return await r.json();
    } catch (error) {
      if (optional) return null;
      throw new Error(`${url}: ${error.message}`);
    }
  }

  async function getText(url, optional = false) {
    try {
      const r = await fetch(`${url}${url.includes('?') ? '&' : '?'}v=${Date.now()}`, { cache: 'no-store', credentials: 'same-origin' });
      if (!r.ok) throw new Error(`${r.status}`);
      return await r.text();
    } catch (error) {
      if (optional) return null;
      throw new Error(`${url}: ${error.message}`);
    }
  }

  function parseRegistry(html) {
    if (!html) return [];
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const queue = [];
    for (const node of doc.querySelectorAll('script[type="application/ld+json"]')) {
      try { queue.push(JSON.parse(node.textContent || '{}')); } catch (_) { }
    }
    while (queue.length) {
      const item = queue.shift();
      if (Array.isArray(item)) { queue.push(...item); continue; }
      if (!item || typeof item !== 'object') continue;
      if (item['@type'] === 'ItemList' && Array.isArray(item.itemListElement)) {
        return item.itemListElement
          .map(x => x?.item || x)
          .filter(Boolean)
          .map(x => ({ name: String(x.name || ''), url: String(x.url || ''), description: String(x.description || '') }))
          .filter(x => x.name);
      }
      if (Array.isArray(item['@graph'])) queue.push(...item['@graph']);
    }
    return [];
  }

  function security() { return state.stack?.chain?.security || state.bridge?.currentPosture?.security || {}; }
  function activeCases() { return safeArray(state.bridge?.cases); }
  function meaningfulCases() { return activeCases().filter(x => String(x?.severity || '').toLowerCase() !== 'info'); }
  function executionAuthority() { return String(state.stack?.operatingContract?.executionAuthority || 'none'); }

  function plainSummary(lang) {
    const sec = String(security()?.status || 'unknown').toLowerCase();
    const changes = finite(state.bridge?.currentPosture?.observer?.materialChangeCount) || 0;
    const ready = state.stack?.readyForManualInterpretation === true;
    const companies = state.registry.length;
    if (!ready) return lang === 'ru'
      ? 'Когнитивный пакет сейчас не готов. Я не буду придумывать замену отсутствующим данным.'
      : 'The cognitive packet is not ready. I will not invent replacement facts.';
    return lang === 'ru'
      ? `The Holding онлайн. В реестре ${companies || '—'} компаний, Security: ${sec.toUpperCase()}, последних материальных изменений: ${changes}. Можно спрашивать про компании, фонды, доходность и устройство системы.`
      : `The Holding is online. Registry companies: ${companies || '—'}, Security: ${sec.toUpperCase()}, recent material changes: ${changes}. Ask about companies, funds, productivity or how the system works.`;
  }

  function protocolGroup(query) {
    const q = norm(query);
    for (const [key, aliases] of Object.entries(PROTOCOL_ALIASES)) {
      if (includesAny(q, aliases)) return key;
    }
    return null;
  }

  function protocolAliasesFor(key) { return key ? PROTOCOL_ALIASES[key] || [key] : []; }

  function engineScore(engine, query, key) {
    const hay = norm([engine?.engineId, engine?.protocol, engine?.principalSymbol, engine?.sourceMetric].join(' '));
    let score = 0;
    for (const alias of protocolAliasesFor(key)) if (hay.includes(norm(alias))) score += 5;
    for (const token of words(query)) if (hay.includes(token)) score += 1;
    return score;
  }

  function findEngines(query) {
    const engines = Object.values(safeObject(state.productivity?.engines));
    const key = protocolGroup(query);
    return engines
      .map(e => [e, engineScore(e, query, key)])
      .filter(x => x[1] > 0)
      .sort((a, b) => b[1] - a[1])
      .map(x => x[0]);
  }

  function stableScore(pos, query, key) {
    const hay = norm([pos?.protocol, pos?.chain, pos?.positionType, pos?.wrapperSymbol, pos?.underlyingSymbol, pos?.incomeMode].join(' '));
    let score = 0;
    for (const alias of protocolAliasesFor(key)) if (hay.includes(norm(alias))) score += 5;
    for (const token of words(query)) if (hay.includes(token)) score += 1;
    return score;
  }

  function findStable(query) {
    const key = protocolGroup(query);
    return safeArray(state.stable?.positions)
      .map(p => [p, stableScore(p, query, key)])
      .filter(x => x[1] > 0)
      .sort((a, b) => b[1] - a[1])
      .map(x => x[0]);
  }

  function findCompany(query) {
    const q = norm(query);
    let best = null;
    let bestScore = 0;
    const aliases = {
      'defitea.eth': ['defitea', 'дефитеа'],
      'YieldRing.eth': ['yieldring', 'yield ring'],
      'dinaz.eth': ['dinaz'],
      'aerocvxyb.eth': ['aerocvxyb', 'aero cvx yb'],
      "Rook's portfolio": ['rooks', 'rook', 'рук'],
      'Monetra.eth': ['monetra', 'монетра', 'монетру', 'монетре', '008', 'company 008', 'компания 008'],
      '05081966.eth': ['05081966'],
      '0x5860...83CA8.eth': ['83ca8', '5860'],
      '1milliondollar.eth': ['1milliondollar', '1 million dollar', 'milliondollar', 'million dollar eth', 'миллион доллар этх', 'миллион доллар', '009', 'company 009', 'компания 009']
    };
    const names = new Set([
      ...state.registry.map(x => x.name),
      ...Object.keys(safeObject(state.productivity?.companies)),
      state.stable?.company?.name
    ].filter(Boolean));
    for (const name of names) {
      let score = 0;
      const nn = norm(name);
      if (q.includes(nn)) score += 20;
      for (const alias of aliases[name] || []) if (q.includes(norm(alias))) score += 15;
      for (const token of words(query)) if (nn.includes(token)) score += 2;
      if (score > bestScore) {
        best = { name, registry: state.registry.find(x => x.name === name) || null };
        bestScore = score;
      }
    }
    return bestScore > 0 ? best : null;
  }

  function companyAnswer(company, lang, query) {
    const p = safeObject(state.productivity?.companies)[company.name];
    const isHistorical = includesAny(norm(query), ['histor', 'истор', 'средн']);
    const lines = [];
    if (company.registry?.description) lines.push(company.registry.description);
    if (p && finite(isHistorical ? p.aprHistoricalAverage : p.aprLatest) !== null) {
      const value = isHistorical ? p.aprHistoricalAverage : p.aprLatest;
      lines.push(lang === 'ru'
        ? `${isHistorical ? 'Историческая средняя' : 'Текущая'} Reference APR: ${pct(value)}. Покрытие продуктивного капитала: ${finite(p.coverage) !== null ? Math.round(Number(p.coverage) * 100) + '%' : 'не указано'}.`
        : `${isHistorical ? 'Historical average' : 'Current'} Reference APR: ${pct(value)}. Productive-capital coverage: ${finite(p.coverage) !== null ? Math.round(Number(p.coverage) * 100) + '%' : 'not stated'}.`);
      if (Array.isArray(p.breakdown) && p.breakdown.length) {
        const top = p.breakdown
          .filter(x => finite(x.apr) !== null)
          .sort((a, b) => (b.value || 0) - (a.value || 0))
          .slice(0, 4)
          .map(x => `${x.engineId.replace(/_/g, ' ')} ${pct(x.apr)}`);
        if (top.length) lines.push((lang === 'ru' ? 'Основные измеряемые позиции: ' : 'Main measured positions: ') + top.join(' · '));
      }
    } else if (company.name === 'Monetra.eth' && state.stable?.summary) {
      return stableSummary(lang);
    } else {
      lines.push(lang === 'ru'
        ? 'Для этой компании сейчас нет отдельной подтверждённой цифры Reference APR в live Productivity.'
        : 'There is no separate verified company Reference APR in live Productivity right now.');
    }
    state.lastEntity = { kind: 'company', name: company.name };
    state.lastTopic = 'company';
    return {
      text: `${company.name}\n${lines.join('\n\n')}`,
      source: `Live Registry + Productivity · ${dateShort(state.productivity?.generatedAt)}`
    };
  }

  function engineAnswer(engines, lang) {
    const selected = engines.slice(0, 5);
    const lines = [];
    for (const e of selected) {
      const value = finite(e.aprLatest);
      const status = String(e.status || 'unknown');
      lines.push(value === null
        ? `• ${e.protocol} · ${e.principalSymbol || e.engineId}: ${lang === 'ru' ? `сейчас без подтверждённой цифры (${status})` : `no verified number right now (${status})`}`
        : `• ${e.protocol} · ${e.principalSymbol || e.engineId}: ${pct(value)} Reference APR (${status})`);
    }
    const tail = lang === 'ru'
      ? 'Это Reference APR – ориентир текущей продуктивности, а не обещанная или уже полученная прибыль.'
      : 'This is Reference APR – current earning capacity, not guaranteed or already-realised profit.';
    const first = selected[0];
    if (first) state.lastEntity = { kind: 'engine', id: first.engineId, protocol: first.protocol };
    state.lastTopic = 'productivity';
    return {
      text: `${lines.join('\n')}\n\n${tail}`,
      source: `Live Productivity · ${dateShort(state.productivity?.generatedAt)}`
    };
  }

  function stableSummary(lang) {
    const s = state.stable?.summary || {};
    const company = state.stable?.company?.name || 'Monetra.eth';
    const rate = pct(s.referenceApyPct ?? s.referenceAnnualYieldPct);
    const positions = finite(s.positionCount);
    const coverage = finite(s.coverage);
    state.lastEntity = { kind: 'stable-company', name: company };
    state.lastTopic = 'stable';
    return {
      text: lang === 'ru'
        ? `${company} – Stable Capital. Сейчас ${positions ?? '—'} продуктивных позиций. Средняя Reference APY: ${rate || 'нет подтверждённой цифры'}. Покрытие: ${coverage !== null ? Math.round(coverage * 100) + '%' : '—'}.\n\nЭто текущая доходная способность Stable Capital, а не уже заработанный cash flow.`
        : `${company} – Stable Capital. Current productive positions: ${positions ?? '—'}. Average Reference APY: ${rate || 'no verified number'}. Coverage: ${coverage !== null ? Math.round(coverage * 100) + '%' : '—'}.\n\nThis is current Stable Capital earning capacity, not realised cash flow.`,
      source: `Live Stable Capital · ${dateShort(state.stable?.generatedAt)}`
    };
  }

  function stableAnswer(matches, lang) {
    const rows = matches.slice(0, 6).map(p => {
      const r = p.reference || {};
      const y = finite(r.annualYieldPct);
      return `• ${p.protocol} · ${p.wrapperSymbol || p.underlyingSymbol || p.positionType} · ${p.chain}: ${y === null ? (lang === 'ru' ? 'нет подтверждённой APY' : 'no verified APY') : pct(y)}${r.status ? ` (${r.status})` : ''}`;
    });
    state.lastEntity = { kind: 'stable', protocol: matches[0]?.protocol || '' };
    state.lastTopic = 'stable';
    return {
      text: `${rows.join('\n')}\n\n${lang === 'ru' ? 'Это Reference APY по текущим Stable Capital позициям Monetra, не уже полученная прибыль.' : 'These are current Reference APYs for Monetra Stable Capital positions, not realised profit.'}`,
      source: `Live Stable Capital · ${dateShort(state.stable?.generatedAt)}`
    };
  }

  function protocolCompaniesAnswer(key, lang) {
    const aliases=protocolAliasesFor(key).map(norm);
    const names=[];
    for (const [name,c] of Object.entries(safeObject(state.productivity?.companies))) {
      const hit=safeArray(c?.breakdown).some(x=>aliases.some(a=>norm([x?.engineId,x?.protocol,x?.principalSymbol].join(' ')).includes(a)));
      if (hit) names.push(name);
    }
    if (state.stable?.company?.name && safeArray(state.stable?.positions).some(x=>aliases.some(a=>norm([x?.protocol,x?.wrapperSymbol,x?.underlyingSymbol].join(' ')).includes(a)))) names.push(state.stable.company.name);
    const uniq=[...new Set(names)];
    state.lastEntity={kind:'protocol',key}; state.lastTopic='protocol:'+key;
    if (!uniq.length) return {text:lang==='ru'?'В текущих machine-readable данных не нашёл подтверждённых компаний для этого протокола.':'No verified companies for this protocol were found in the current machine-readable data.',source:'Live Productivity',confidenceHint:'unknown'};
    return {text:(lang==='ru'?'Подтверждённые компании в текущих данных:\n':'Verified companies in current data:\n')+uniq.map(x=>'• '+x).join('\n'),source:'Live Productivity + Stable Capital'};
  }

  function registryAnswer(lang) {
    const names = state.registry.map(x => x.name);
    state.lastTopic = 'registry';
    state.lastEntity = { kind: 'registry' };
    if (!names.length) return {
      text: lang === 'ru' ? 'Живой Registry сейчас не загрузился. Я не буду угадывать число компаний.' : 'The live Registry did not load, so I will not guess the company count.',
      source: 'Registry unavailable'
    };
    return {
      text: lang === 'ru'
        ? `Сейчас в Registry ${names.length} компаний:\n\n${names.map((x, i) => `${i + 1}. ${x}`).join('\n')}`
        : `The Registry currently contains ${names.length} companies:\n\n${names.map((x, i) => `${i + 1}. ${x}`).join('\n')}`,
      source: 'Live Company Registry · /companies/'
    };
  }

  function currentStateAnswer(lang) {
    const attention = meaningfulCases();
    const changes = finite(state.bridge?.currentPosture?.observer?.materialChangeCount) || 0;
    const sec = String(security()?.status || 'unknown').toUpperCase();
    state.lastTopic = 'state';
    return {
      text: lang === 'ru'
        ? `Система работает. Security: ${sec}. Активных reasoning cases: ${activeCases().length}, из них non-info: ${attention.length}. Последних материальных изменений: ${changes}. Execution authority: ${executionAuthority().toUpperCase()}.`
        : `System is working. Security: ${sec}. Active reasoning cases: ${activeCases().length}; non-info: ${attention.length}. Recent material changes: ${changes}. Execution authority: ${executionAuthority().toUpperCase()}.`,
      source: 'Live Cognitive Stack + Brain Bridge'
    };
  }

  function attentionAnswer(lang) {
    const items = meaningfulCases().slice(0, 6);
    state.lastTopic = 'attention';
    if (!items.length) return {
      text: lang === 'ru' ? 'Сейчас нет активных non-info reasoning cases, которые требуют отдельного внимания.' : 'There are no active non-info reasoning cases requiring separate attention right now.',
      source: 'Live Brain Bridge'
    };
    return {
      text: (lang === 'ru' ? 'Сейчас основные края, которые система держит в поле зрения:\n' : 'Current items the system is watching:\n') + items.map((x, i) => `${i + 1}. ${String(x.signal || x.summary || 'Current case')}`).join('\n'),
      source: 'Live Brain Bridge'
    };
  }

  function activeProposals() {
    return safeArray(state.proposals?.proposals).filter(x => !['SUPERSEDED', 'REJECTED', 'RELEASED'].includes(String(x?.state || '').toUpperCase()));
  }

  function governanceCoherent() {
    const chain = state.stack?.integrity?.chainHash;
    const proposalHash = state.proposals?.integrity?.queueHash;
    const builderHash = state.builder?.integrity?.queueHash;
    return Boolean(
      chain &&
      state.proposals?.source?.cognitiveChainHash === chain &&
      proposalHash && state.builder?.source?.proposalQueueHash === proposalHash &&
      builderHash && state.guardian?.source?.candidateQueueHash === builderHash
    );
  }

  function proposalAnswer(lang) {
    const items = activeProposals().slice(0, 6);
    const s = state.proposals?.summary || {};
    state.lastTopic = 'proposal';
    state.lastEntity = { kind: 'governance', topic: 'proposal' };
    if (!state.proposals || !governanceCoherent()) return {
      text: lang === 'ru'
        ? 'Governance packet сейчас не подтверждён как coherent с текущим Cognitive Stack. Я не буду подменять Proposal сырыми Brain cases.'
        : 'The governance packet is not currently verified as coherent with the Cognitive Stack, so I will not substitute raw Brain cases for real Proposals.',
      source: 'Proposal Work Queue unavailable'
    };
    if (!items.length) return {
      text: lang === 'ru' ? 'В текущей Proposal Work Queue нет активных предложений.' : 'There are no active items in the current Proposal Work Queue.',
      source: 'Proposal Work Queue'
    };
    const intro = lang === 'ru'
      ? `Система наблюдает ${s.observedActiveCaseCount ?? '—'} активных case, но после фильтра опыта оставила ${s.activeCaseCount ?? items.length} decision-worthy и ${s.dataHygieneCaseCount ?? '—'} data-hygiene. Активных Proposal: ${s.activeProposalCount ?? items.length}.\n\n`
      : `The system observes ${s.observedActiveCaseCount ?? '—'} active cases, but the experience gate kept ${s.activeCaseCount ?? items.length} decision-worthy and ${s.dataHygieneCaseCount ?? '—'} data-hygiene. Active Proposals: ${s.activeProposalCount ?? items.length}.\n\n`;
    const rows = items.map((x, i) => `${i + 1}. [${x.rankClass || '—'} · ${x.state || '—'}] ${x.entity || x.category || x.proposalId}\n   ${x.proposedAction || ''}`);
    const tail = lang === 'ru'
      ? `\n\nОдобрено владельцем: ${s.ownerApprovedCount ?? 0}. Automatic approval/execution выключены.`
      : `\n\nOwner-approved: ${s.ownerApprovedCount ?? 0}. Automatic approval/execution remain disabled.`;
    return { text: intro + rows.join('\n') + tail, source: 'Proposal Work Queue' };
  }

  function governanceStatusAnswer(lang) {
    const p = state.proposals?.summary || {};
    const b = state.builder?.summary || {};
    const g = state.guardian?.summary || {};
    state.lastTopic = 'governance';
    state.lastEntity = { kind: 'governance', topic: 'status' };
    if (!governanceCoherent()) return {
      text: lang === 'ru' ? 'Governance chain сейчас не проходит exact coherence check. Действие не предполагается.' : 'The governance chain does not currently pass exact coherence checks. No action is implied.',
      source: 'OS Governance unavailable'
    };
    return {
      text: lang === 'ru'
        ? `Governance сейчас: Proposal ${p.activeProposalCount ?? 0} active / ${p.ownerApprovedCount ?? 0} owner-approved → Builder ${b.candidateCount ?? 0} candidates → Guardian ${g.researchOnlyCount ?? 0} research-only / ${g.sandboxBuildAuthorizedCount ?? 0} sandbox / ${g.productionMutationAuthorizedCount ?? 0} production-authorized.\n\nExecution authority: ${(state.guardian?.constraints?.executionAuthority || executionAuthority()).toUpperCase()}. Пока владелец ничего не одобрил, Builder остаётся пустым, а Guardian не выдаёт capability.`
        : `Governance now: Proposal ${p.activeProposalCount ?? 0} active / ${p.ownerApprovedCount ?? 0} owner-approved → Builder ${b.candidateCount ?? 0} candidates → Guardian ${g.researchOnlyCount ?? 0} research-only / ${g.sandboxBuildAuthorizedCount ?? 0} sandbox / ${g.productionMutationAuthorizedCount ?? 0} production-authorized.\n\nExecution authority: ${(state.guardian?.constraints?.executionAuthority || executionAuthority()).toUpperCase()}. Until the owner approves something, Builder stays empty and Guardian grants no capability.`,
      source: 'OS Governance · Proposal + Builder + Guardian'
    };
  }

  function whyFilteredAnswer(lang) {
    const s = state.proposals?.summary || {};
    state.lastTopic = 'proposal-filter';
    state.lastEntity = { kind: 'governance', topic: 'filter' };
    if (!state.proposals || !governanceCoherent()) return proposalAnswer(lang);
    return {
      text: lang === 'ru'
        ? `Потому что observation и decision experience теперь разделены. Learning наблюдает ${s.observedActiveCaseCount ?? '—'} активных case. ${s.dataHygieneCaseCount ?? '—'} классифицированы как data-hygiene – их полезно помнить, но они не должны отвлекать владельца и обучать систему как будто это решения. В Proposal прошли только ${s.activeCaseCount ?? '—'} decision-worthy case. Поэтому больше наблюдений не означает больше задач.`
        : `Because observation and decision experience are now separated. Learning observes ${s.observedActiveCaseCount ?? '—'} active cases. ${s.dataHygieneCaseCount ?? '—'} are data-hygiene – useful to remember, but they should not distract the owner or train the system as if they were decisions. Only ${s.activeCaseCount ?? '—'} decision-worthy cases reached Proposal. More observations no longer means more tasks.`,
      source: 'Proposal Work Queue + Decision & Outcome Learning'
    };
  }

  function findCompanies(query) {
    const q = norm(query);
    const names = new Set([
      ...state.registry.map(x => x.name),
      ...Object.keys(safeObject(state.productivity?.companies)),
      state.stable?.company?.name
    ].filter(Boolean));
    const special = {
      "Rook's portfolio": ['rook', 'rooks', 'рук'],
      '05081966.eth': ['05081966'],
      '0x5860...83CA8.eth': ['83ca8', '5860'],
      '1milliondollar.eth': ['1milliondollar', 'milliondollar', '1 million dollar']
    };
    return [...names]
      .map(name => {
        let score = 0;
        const full = norm(name);
        const short = norm(name.replace(/\.eth$/i, ''));
        if (full && q.includes(full)) score += 30;
        if (short.length >= 4 && q.includes(short)) score += 20;
        for (const alias of special[name] || []) if (q.includes(norm(alias))) score += 20;
        return { name, registry: state.registry.find(x => x.name === name) || null, score };
      })
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  }

  function companyYieldSnapshot(name) {
    const p = safeObject(state.productivity?.companies)[name];
    if (p && finite(p.aprLatest) !== null) return { value: Number(p.aprLatest), coverage: finite(p.coverage), label: 'Reference APR' };
    if (name === state.stable?.company?.name && finite(state.stable?.summary?.referenceApyPct ?? state.stable?.summary?.referenceAnnualYieldPct) !== null) {
      return { value: Number(state.stable.summary.referenceApyPct ?? state.stable.summary.referenceAnnualYieldPct), coverage: finite(state.stable?.summary?.coverage), label: 'Reference APY' };
    }
    return null;
  }

  function compareCompaniesAnswer(a, b, lang) {
    const pa = companyYieldSnapshot(a.name);
    const pb = companyYieldSnapshot(b.name);
    state.lastTopic = 'company-compare';
    state.lastEntity = { kind: 'company-compare', names: [a.name, b.name] };
    if (!pa || !pb) return {
      text: lang === 'ru' ? 'Для точного сравнения обе компании должны иметь подтверждённую текущую Reference yield metric. Сейчас этого нет.' : 'Both companies need a verified current reference-yield metric for an exact comparison, and that is not available right now.',
      source: 'Live Productivity', confidenceHint: 'unknown'
    };
    const diff = pa.value - pb.value;
    const leader = diff >= 0 ? a.name : b.name;
    return {
      text: lang === 'ru'
        ? `${a.name}: ${pct(pa.value)} ${pa.label}${pa.coverage !== null ? ` · coverage ${Math.round(pa.coverage * 100)}%` : ''}.\n${b.name}: ${pct(pb.value)} ${pb.label}${pb.coverage !== null ? ` · coverage ${Math.round(pb.coverage * 100)}%` : ''}.\n\nАбсолютная разница текущей reference yield: ${pct(Math.abs(diff))} в пользу ${leader}. Это сравнение current productive capacity, не realised performance.`
        : `${a.name}: ${pct(pa.value)} ${pa.label}${pa.coverage !== null ? ` · coverage ${Math.round(pa.coverage * 100)}%` : ''}.\n${b.name}: ${pct(pb.value)} ${pb.label}${pb.coverage !== null ? ` · coverage ${Math.round(pb.coverage * 100)}%` : ''}.\n\nAbsolute current reference-yield difference: ${pct(Math.abs(diff))} in favor of ${leader}. This compares current productive capacity, not realised performance.`,
      source: 'Live Productivity + Stable Capital'
    };
  }

  function compareFollowupAnswer(query, lang) {
    if (state.lastEntity?.kind !== 'company-compare') return null;
    const names = safeArray(state.lastEntity.names);
    if (names.length !== 2) return null;
    const a={name:names[0],registry:state.registry.find(x=>x.name===names[0])||null};
    const b={name:names[1],registry:state.registry.find(x=>x.name===names[1])||null};
    const q=norm(query);
    if (includesAny(q,['higher reference apr','higher apr','у кого выше','выше текущая продуктивность','productivity'])) return compareCompaniesAnswer(a,b,lang);
    if (includesAny(q,['coverage difference','разница coverage','разница покрытия','покрыти'])) {
      const pa=companyYieldSnapshot(a.name), pb=companyYieldSnapshot(b.name);
      if (!pa || !pb || pa.coverage===null || pb.coverage===null) return {text:lang==='ru'?'Для обеих компаний нет подтверждённого coverage.':'Verified coverage is not available for both companies.',source:'Live Productivity',confidenceHint:'unknown'};
      const da=Math.round(pa.coverage*100), db=Math.round(pb.coverage*100);
      return {text:lang==='ru'?`${a.name}: ${da}%. ${b.name}: ${db}%. Разница coverage: ${Math.abs(da-db)} п.п.`:`${a.name}: ${da}%. ${b.name}: ${db}%. Coverage difference: ${Math.abs(da-db)} percentage points.`,source:'Live Productivity + Stable Capital'};
    }
    if (includesAny(q,['performed better','performance','лучше'])) return {text:lang==='ru'?'Нет. Более высокая текущая reference yield не доказывает лучшую историческую Performance. Performance требует точки входа и фактического изменения капитала.':'No. Higher current reference yield does not prove better historical Performance. Performance requires entry data and actual capital change.',source:'The Holding project canon'};
    return null;
  }

function learningAnswer(lang) {
    const decisions = safeArray(state.decisions?.decisions).length;
    const remembered = finite(state.learning?.rememberedCaseCount ?? state.learning?.rememberedCases ?? state.learning?.counts?.rememberedCases);
    const outcomes = safeArray(state.learning?.outcomes || state.learning?.settledOutcomes || state.learning?.recentOutcomes).length;
    const lessons = safeArray(state.learning?.lessons || state.learning?.recentLessons).length;
    state.lastTopic = 'learning';
    return {
      text: lang === 'ru'
        ? `Formal Learning ещё молодой. Решений владельца записано: ${decisions}. Remembered cases: ${remembered ?? 'warming'}. Видимых settled outcomes: ${outcomes}. Уроков: ${lessons}.\n\nСистема специально не изображает обучение там, где реального результата ещё не было.`
        : `Formal Learning is still young. Recorded owner decisions: ${decisions}. Remembered cases: ${remembered ?? 'warming'}. Visible settled outcomes: ${outcomes}. Lessons: ${lessons}.\n\nThe system deliberately does not pretend to have learned where no real outcome exists yet.`,
      source: 'Live Decision & Outcome Learning'
    };
  }

  function authorityAnswer(lang) {
    state.lastTopic = 'authority';
    return {
      text: lang === 'ru'
        ? `Сейчас я могу читать и объяснять живые данные The Holding, находить компании, доходность и состояние системы. Execution authority: ${executionAuthority().toUpperCase()}. Из этого окна нельзя менять GitHub, подписывать транзакции или двигать капитал.`
        : `I can currently read and explain live Holding data, find companies, productivity and system state. Execution authority: ${executionAuthority().toUpperCase()}. This console cannot mutate GitHub, sign transactions or move capital.`,
      source: 'Live Cognitive Stack operating contract'
    };
  }

  function greetingAnswer(lang, q) {
    const how = includesAny(q, ['как дела', 'как ты', 'how are you']);
    return {
      text: lang === 'ru'
        ? `${how ? 'Привет 🙂 Всё работает. ' : 'Привет 🙂 '}Я уже могу нормально рассказывать про The Holding: компании, фонды, слои капитала, доходность протоколов, Monetra, состояние Brain, Learning и то, что требует внимания. Спроси что-нибудь.`
        : `${how ? 'Hi 🙂 Everything is running. ' : 'Hi 🙂 '}I can explain The Holding companies, funds, capital layers, protocol productivity, Monetra, Brain state, Learning and what needs attention. Ask me something.`,
      source: 'Console capability map'
    };
  }

  function helpAnswer(lang) {
    return {
      text: lang === 'ru'
        ? 'Например спроси:\n\n• Сколько сейчас компаний?\n• Какая доходность Aerodrome?\n• Что с Monetra?\n• Какая Reference APR у defitea.eth?\n• Что такое слои капитала?\n• Какие фонды есть в The Holding?\n• Что требует внимания?\n• Чему система учится?\n• Что такое умный капитал?'
        : 'Try questions like:\n\n• How many companies are there?\n• What is Aerodrome productivity?\n• How is Monetra doing?\n• What is defitea.eth Reference APR?\n• What are the capital layers?\n• Which funds exist?\n• What needs attention?\n• What is the system learning?\n• What is Intelligent Capital?',
      source: 'Console capability map'
    };
  }

  function conceptAnswer(query, lang) {
    const q = norm(query);
    let best = null;
    let score = 0;
    for (const [id, concept] of Object.entries(CONCEPTS)) {
      let s = 0;
      for (const key of concept.keys) {
        const nk = norm(key);
        if (q.includes(nk)) s += 10;
        else for (const token of words(query)) if (nk.includes(token)) s += 1;
      }
      if (s > score) { best = { id, ...concept }; score = s; }
    }
    if (best && score >= 3) {
      state.lastTopic = best.id;
      return { text: best[lang], source: 'The Holding project canon' };
    }
    return null;
  }

  function followupAnswer(query, lang) {
    const q = norm(query);
    const compareFollow = compareFollowupAnswer(query, lang);
    if (compareFollow) return compareFollow;
    if (state.lastEntity?.kind === 'registry' && includesAny(q, ['list them', 'перечисли', 'список', 'show them'])) return registryAnswer(lang);
    if (state.lastEntity?.kind === 'protocol') {
      const key=state.lastEntity.key;
      if (includesAny(q,['which companies','какие компании','кто использует','use it'])) return protocolCompaniesAnswer(key,lang);
      if (includesAny(q,['reference apr','apr','apy','yield','продуктивност'])) { const rows=findEngines(key); if (rows.length) return engineAnswer(rows,lang); }
    }
    if (!state.lastEntity || protocolGroup(query) || findCompany(query)) return null;
    if (['company', 'stable-company'].includes(state.lastEntity.kind)) {
      const company = { name: state.lastEntity.name, registry: state.registry.find(x => x.name === state.lastEntity.name) || null };
      if (includesAny(q, ['истор', 'средн', 'histor', 'average'])) return companyAnswer(company, lang, query);
      if (includesAny(q, ['reward', 'награ', 'claimable', 'accrued'])) return rewardsAnswer(query, lang, company);
      if (includesAny(q, ['embedded', 'встроенн', 'внутри позиции'])) return embeddedAnswer(query, lang, company);
      if (includesAny(q, ['entry', 'точка входа', 'цена входа', 'покупк'])) return entryAnswer(query, lang, company);
      if (includesAny(q, ['доходност', 'apr', 'apy', 'yield', 'productivity', 'продуктивност'])) {
        if (company.name === 'Monetra.eth' && state.stable?.summary) return stableSummary(lang);
        return companyAnswer(company, lang, query);
      }
    }
    if (state.lastEntity.kind === 'engine' && includesAny(q, ['а сейчас', 'current', 'текущ', 'доход', 'apr'])) {
      const e = safeObject(state.productivity?.engines)[state.lastEntity.id];
      if (e) return engineAnswer([e], lang);
    }
    if (state.lastEntity.kind === 'governance') {
      if (includesAny(q, ['почему', 'why', 'почему только', 'отфильтр'])) return whyFilteredAnswer(lang);
      if (includesAny(q, ['одобрен', 'approved', 'builder', 'guardian', 'может сделать', 'can execute', 'может сам'])) return governanceStatusAnswer(lang);
    }
    return null;
  }

async function loadLazy(kind) {
    if (state.lazy[kind]) return state.lazy[kind];
    const url = URLS[kind];
    if (!url) return null;
    state.lazy[kind] = await getJson(url, true);
    return state.lazy[kind];
  }

  function collectNamedObjects(root, needle, max = 8) {
    const out = [];
    const seen = new Set();
    const target = norm(needle);
    function walk(value, path = '', depth = 0) {
      if (out.length >= max || depth > 8 || value === null || typeof value !== 'object') return;
      if (seen.has(value)) return;
      seen.add(value);
      if (Array.isArray(value)) {
        for (let i = 0; i < value.length && out.length < max; i++) walk(value[i], `${path}[${i}]`, depth + 1);
        return;
      }
      const blob = norm([path, value.company, value.companyName, value.name, value.protocol, value.routeId, value.positionId, value.strategy, value.symbol, value.asset].join(' '));
      if (target && blob.includes(target)) out.push({ path, value });
      for (const [k, v] of Object.entries(value)) walk(v, path ? `${path}.${k}` : k, depth + 1);
    }
    walk(root);
    return out;
  }

  function numericFact(obj, names) {
    for (const name of names) {
      const value = finite(obj?.[name]);
      if (value !== null) return [name, value];
    }
    return null;
  }

  async function rewardsAnswer(query, lang, company) {
    const data = await loadLazy('rewards');
    if (!data) return {
      text: lang === 'ru' ? 'Rewards packet сейчас не загрузился. Я не буду угадывать накопленные награды.' : 'The Rewards packet is unavailable, so I will not guess accrued rewards.',
      source: 'Rewards unavailable'
    };
    const needle = company?.name || protocolGroup(query) || words(query).find(x => x.length > 3) || '';
    const hits = collectNamedObjects(data, needle, 12);
    const facts = [];
    for (const h of hits) {
      const f = numericFact(h.value, ['totalUsd', 'totalUSD', 'usdValue', 'valueUsd', 'claimableUsd', 'rewardsUsd', 'accruedUsd']);
      if (f) facts.push({ key: f[0], value: f[1] });
    }
    if (facts.length) {
      const uniq = [];
      const seen = new Set();
      for (const f of facts) {
        const key = `${f.key}:${f.value}`;
        if (!seen.has(key)) { seen.add(key); uniq.push(f); }
      }
      return {
        text: (lang === 'ru' ? `В live Rewards нашёл подтверждённые денежные значения${company ? ` для ${company.name}` : ''}:\n` : `Verified monetary values found in live Rewards${company ? ` for ${company.name}` : ''}:\n`) + uniq.slice(0, 5).map(x => `• ${x.key}: ${usd(x.value)}`).join('\n') + `\n\n${lang === 'ru' ? 'Rewards – это накопленные/неполученные protocol-side награды, а не realised cash flow.' : 'Rewards are accrued/unclaimed protocol-side value, not realised cash flow.'}`,
        source: 'Live Rewards data'
      };
    }
    return {
      text: lang === 'ru'
        ? `Rewards packet загружен, но я не нашёл достаточно точного денежного поля для этого вопроса${company ? ` по ${company.name}` : ''}. Лучше не придумывать цифру.`
        : `Rewards data loaded, but I could not map this question to a precise monetary field${company ? ` for ${company.name}` : ''}. Better not to invent a number.`,
      source: 'Live Rewards data',
      confidenceHint: 'unknown'
    };
  }

  async function embeddedAnswer(query, lang, company) {
    const data = await loadLazy('embedded');
    if (!data) return {
      text: lang === 'ru' ? 'Embedded Yield packet сейчас недоступен. Я не буду угадывать значение.' : 'Embedded Yield data is unavailable, so I will not guess a value.',
      source: 'Embedded Yield unavailable'
    };
    const needle = company?.name || protocolGroup(query) || words(query).find(x => x.length > 3) || '';
    const hits = collectNamedObjects(data, needle, 10);
    const facts = [];
    for (const h of hits) {
      const f = numericFact(h.value, ['embeddedYieldUsd', 'yieldUsd', 'valueUsd', 'deltaUsd', 'earnedUsd', 'apyPct', 'aprPct']);
      if (f) facts.push({ key: f[0], value: f[1] });
    }
    if (facts.length) return {
      text: (lang === 'ru' ? 'В live Embedded Yield нашёл:\n' : 'Live Embedded Yield values found:\n') + facts.slice(0, 5).map(x => `• ${x.key}: ${/pct/i.test(x.key) ? pct(x.value) : usd(x.value)}`).join('\n') + `\n\n${lang === 'ru' ? 'Embedded Yield – это доход внутри самой позиции, отдельно от claimable rewards.' : 'Embedded Yield is value growing inside the position, separate from claimable rewards.'}`,
      source: 'Live Embedded Yield data'
    };
    return {
      text: lang === 'ru' ? 'Embedded Yield packet загружен, но точное значение под этот вопрос не найдено.' : 'Embedded Yield data loaded, but no exact value matched this question.',
      source: 'Live Embedded Yield data'
    };
  }

  async function entryAnswer(query, lang, company) {
    if (company?.name && company.name !== 'Monetra.eth') return { text: lang === 'ru' ? `Для ${company.name} нет отдельного подтверждённого Strategy Entry Ledger в текущем Ask.` : `The current Ask has no separate verified Strategy Entry Ledger for ${company.name}.`, source: 'Strategy Entry Ledger unavailable', confidenceHint: 'unknown' };
    const data = await loadLazy('entries');
    if (!data) return { text: lang === 'ru' ? 'Entry ledger сейчас недоступен.' : 'Entry ledger is unavailable.', source: 'Entry ledger unavailable' };
    const needle = company?.name || protocolGroup(query) || words(query).find(x => x.length > 3) || '';
    const hits = collectNamedObjects(data, needle, 10);
    const facts = [];
    for (const h of hits) {
      const price = numericFact(h.value, ['entryPriceUsd', 'entryPrice', 'priceUsd', 'unitPriceUsd']);
      if (price) facts.push({ price: price[1], date: h.value.entryDate || h.value.date || h.value.acquiredAt || '' });
    }
    if (facts.length) return {
      text: (lang === 'ru' ? 'Нашёл подтверждённые точки входа:\n' : 'Verified entry points found:\n') + facts.slice(0, 5).map(x => `• ${usd(x.price)}${x.date ? ` · ${dateShort(x.date)}` : ''}`).join('\n'),
      source: 'Live Strategy Entry Ledger'
    };
    return {
      text: lang === 'ru' ? 'Ledger загружен, но для этого вопроса точная подтверждённая точка входа не найдена.' : 'Ledger loaded, but no exact verified entry point matched this question.',
      source: 'Live Strategy Entry Ledger'
    };
  }

  function extractPageBlocks(html) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    doc.querySelectorAll('script,style,nav,footer,form,noscript').forEach(x => x.remove());
    return [...doc.querySelectorAll('h1,h2,h3,p,li')]
      .map(x => String(x.textContent || '').replace(/\s+/g, ' ').trim())
      .filter(x => x.length >= 35 && x.length <= 500);
  }

  async function searchPublicKnowledge(query, lang) {
    const tokens = words(query);
    if (!tokens.length) return null;
    const results = [];
    await Promise.all(PUBLIC_PAGES.map(async ([name, url]) => {
      let html = state.pageText.get(url);
      if (html === undefined) {
        html = await getText(url, true);
        state.pageText.set(url, html || null);
      }
      if (!html) return;
      for (const block of extractPageBlocks(html)) {
        const b = norm(block);
        let score = 0;
        for (const token of tokens) if (b.includes(token)) score += token.length > 6 ? 3 : 2;
        const key = protocolGroup(query);
        if (key) for (const alias of protocolAliasesFor(key)) if (b.includes(norm(alias))) score += 4;
        if (score > 0) results.push({ name, url, block, score });
      }
    }));
    results.sort((a, b) => b.score - a.score);
    const best = results.filter(x => x.score >= 6 && tokens.filter(token => norm(x.block).includes(token)).length >= 2).slice(0, 2);
    if (!best.length) return null;
    return {
      text: (lang === 'ru' ? 'Нашёл в публичных знаниях The Holding:\n\n' : 'Found in The Holding public knowledge:\n\n') + best.map(x => `${x.name}: ${x.block}`).join('\n\n'),
      source: `Public site knowledge · ${best.map(x => x.url).join(' · ')}`,
      confidenceHint: 'partial'
    };
  }

  function trustIntentAnswer(q, lang) {
    if (includesAny(q, ['private key', 'seed phrase', 'recovery phrase', 'приватн ключ', 'приватник', 'сид фраз', 'секретн ключ'])) return {
      text: lang === 'ru' ? 'Я не раскрываю и не ищу private keys, seed/recovery phrases или другие секреты. The Holding OS не должен выдавать такие данные через Ask.' : 'I will not reveal or search for private keys, seed/recovery phrases or other secrets. The Holding OS must not expose such data through Ask.',
      source: 'The Holding project canon'
    };
    if (includesAny(q, ['move my capital', 'move capital', 'двигать капитал', 'sign transaction', 'sign a transaction', 'signing transaction', 'sign tx', 'подписать транзак', 'execute trade', 'who has authority', 'кто имеет полномочия', 'authority right now'])) return authorityAnswer(lang);
    if (includesAny(q, ['exact allocation', 'what should i buy', 'buy today', 'точн аллокац', 'что купить', 'купить сегодня'])) return {
      text: lang === 'ru' ? 'The Holding показывает структуры, evidence и trade-offs, но не выдаёт персональную точную аллокацию или команду «что купить сегодня». Решение остаётся за владельцем.' : 'The Holding can show structures, evidence and trade-offs, but it does not provide a personalized exact allocation or tell an owner what to buy today. The decision remains with the owner.',
      source: 'The Holding project canon'
    };
    if (includesAny(q, ['sharpe', 'коэффициент шарпа'])) return { text: lang === 'ru' ? 'В текущих подтверждённых данных нет Sharpe ratio под этот период. Я не буду подменять его текущим APY или APR.' : 'The current verified data has no Sharpe ratio for that period. I will not substitute current APY or APR for it.', source: 'No sufficiently strong verified match', confidenceHint: 'unknown' };
    if (includesAny(q, ['next friday', 'следующ пятниц', 'forecast', 'predict', 'прогноз'])) return { text: lang === 'ru' ? 'У The Holding нет подтверждённого будущего значения цены. Я не буду выдавать прогноз как факт.' : 'The Holding has no verified future price value. I will not present a forecast as a fact.', source: 'No sufficiently strong verified match', confidenceHint: 'unknown' };
    if (includesAny(q, ['before tracking', 'до начала наблюден', 'march 2026', 'март 2026'])) return { text: lang === 'ru' ? 'Если период предшествует tracking и не был backfilled, точного дохода в текущих данных нет. Я не буду подменять его сегодняшней доходностью.' : 'If the period predates tracking and was not backfilled, the current data has no exact income figure. I will not substitute today’s yield.', source: 'No sufficiently strong verified match', confidenceHint: 'unknown' };
    if ((includesAny(q, ['reference apr', 'apr', 'current yield', 'текущая доходность']) && (includesAny(q, ['performance', 'прибыл', 'profit', 'actual result', 'result', 'фактический результат', 'equal', 'равно']) || /реал[а-я]{0,5}\s+доходност/.test(q))) || includesAny(q, ['does that mean it performed better'])) return { text: lang === 'ru' ? 'Нет. Reference APR – текущая доходная способность. Performance – фактический результат относительно точки входа. Более высокий APR сейчас не доказывает лучшую историческую performance.' : 'No. Reference APR is current earning capacity. Performance is the actual result versus the entry point. A higher APR now does not prove better historical performance.', source: 'The Holding project canon' };
    if (includesAny(q, ['каждое наблюдение становится предложением', 'does every observation become a proposal', 'every observation become a proposal'])) return whyFilteredAnswer(lang);
    if (includesAny(q,['где тут доход вообще','что уже заработано но еще не пришло','what is already earned but not received'])) return conceptAnswer('слои капитала productivity rewards embedded yield cash flow',lang);
    if (includesAny(q,['что само внутри позиции растет','what grows inside the position'])) return conceptAnswer('embedded yield',lang);
    if (includesAny(q,['embedded yield be negative','embedded yield negative','встроенная доходность отрицательной'])) return {text:lang==='ru'?'Да, в механиках вроде Yield Basis Embedded Yield может быть отрицательным: если drag/rebalance loss превышает заработанные fees, PPS может снизиться.':'Yes. In mechanics such as Yield Basis, Embedded Yield can be negative when drag or rebalance loss exceeds earned fees and PPS falls.',source:'The Holding project canon'};
    if (includesAny(q,['what does invested mean','что такое invested','invested mean'])) return {text:lang==='ru'?'Invested – подтверждённый внешний капитал, внесённый в компанию. Внутренние перемещения между стратегиями не должны повторно считаться новым Invested.':'Invested is verified external capital contributed to a company. Internal moves between strategies should not be counted again as new Invested.',source:'The Holding project canon'};
    if (includesAny(q,['performance тогда что','what is performance then'])) return conceptAnswer('performance',lang);
    if (includesAny(q, ['как система понимает что решение было хорошим', 'how does the system know a decision was good', 'decision outcome'])) return { text: lang === 'ru' ? 'Learning связывает case с решением владельца, ждёт более позднее observation/outcome и только затем формирует lesson, если появилось реальное последующее доказательство.' : 'Learning binds a case to the owner decision, waits for a later observation/outcome, and only forms a lesson when real later evidence exists.', source: 'Live Decision & Outcome Learning' };
    return null;
  }


  async function ownerEvidenceSynthesis(raw, lang) {
    const q = norm(raw);
    const ru = lang === 'ru';
    const unknown = (text, source = 'Console capability map') => ({ text, source, confidenceHint: 'unknown' });
    const partial = (text, source) => ({ text, source, confidenceHint: 'partial' });

    if (includesAny(q, ['furthest from the purpose', 'purpose it was created for', 'от цели создания', 'дальше всего от цели', 'зачем ее создавали'])) return unknown(
      ru
        ? 'Я пока не могу честно ранжировать компании по отклонению от цели создания: в текущем Ask нет канонического machine-readable поля purpose / success criterion для каждой компании. Я не буду подменять цель текущим APR, TVL или Performance.'
        : 'I cannot honestly rank companies by drift from their founding purpose yet: the current Ask has no canonical machine-readable purpose / success criterion for every company. I will not substitute current APR, TVL or Performance for purpose.',
      'Live Registry + Console capability map'
    );

    if (includesAny(q, ['changed most materially', 'what changed most', 'surprise me most', 'not looked', 'не смотрел месяц', 'что изменилось сильнее', 'что удивит больше'])) return unknown(
      ru
        ? 'Я вижу текущий verified state, но в этом интерфейсе пока нет нормализованного month-over-month change packet по всем компаниям. Поэтому я не буду объявлять самое важное изменение по памяти или по одной свежей цифре.'
        : 'I can see current verified state, but this surface does not yet load a normalized month-over-month change packet across all companies. I will not name the most material change from memory or from one fresh metric.',
      'Console capability map'
    );

    if (includesAny(q, ['productive capacity and realised cash flow', 'productivity and realised cash flow', 'productive capacity vs cash flow', 'продуктивност и реализован', 'продуктивност и cash flow'])) return unknown(
      ru
        ? 'Такой рейтинг сейчас нельзя построить корректно: Ask загружает current Productivity, но не загружает единый company-level Realised Cash Flow ledger. Reference APR/APY – это productive capacity, а не полученный cash flow; подменять одно другим нельзя.'
        : 'That ranking cannot be built correctly yet: Ask loads current Productivity but does not load a unified company-level Realised Cash Flow ledger. Reference APR/APY is productive capacity, not received cash flow, so I will not substitute one for the other.',
      'Live Productivity + Console capability map'
    );

    if (includesAny(q, ['concentration risk', 'concentration most visible', 'риск концентрации', 'концентрация риска'])) return unknown(
      ru
        ? 'В текущем Ask нет нормализованного cross-company exposure matrix по активам, протоколам и сетям. Поэтому я не могу честно назвать компанию с максимальной concentration risk. APR или одна позиция не являются заменой exposure concentration.'
        : 'The current Ask has no normalized cross-company exposure matrix across assets, protocols and chains, so I cannot honestly name the highest concentration risk. APR or one visible position is not a substitute for exposure concentration.',
      'Console capability map'
    );

    if (includesAny(q, ['becoming more mature', 'more mature as an economic object', 'maturity', 'reputation synthesis', 'становится зрелее', 'зрелост', 'репутац'])) return unknown(
      ru
        ? 'The Holding уже определяет зрелость как историю, provenance, productive evidence, cash-flow quality и время, но текущий Ask ещё не имеет канонического company-level Maturity / Reputation score. Поэтому точный рейтинг зрелости был бы выдумкой.'
        : 'The Holding already defines maturity through history, provenance, productive evidence, cash-flow quality and time, but Ask does not yet have a canonical company-level Maturity / Reputation score. A precise maturity ranking would therefore be invented.',
      'Live Registry + Console capability map'
    );

    if (includesAny(q, ['architecture is working as intended', 'architecture working', 'архитектура работает как задумано', 'архитектура работает'])) {
      const rows = Object.entries(safeObject(state.productivity?.companies))
        .map(([name, x]) => ({ name, apr: finite(x?.aprLatest), coverage: finite(x?.coverage), engines: safeArray(x?.breakdown).length }))
        .filter(x => x.apr !== null && x.coverage !== null)
        .sort((a, b) => (b.coverage - a.coverage) || (b.engines - a.engines) || (b.apr - a.apr));
      if (!rows.length) return unknown(ru ? 'Productivity state недостаточен для bounded architecture check.' : 'Productivity state is insufficient for a bounded architecture check.', 'Productivity unavailable');
      const best = rows[0];
      return partial(
        ru
          ? best.name + ' сейчас имеет один из самых сильных измеримых сигналов операционной полноты: ' + best.coverage.toFixed(1) + '% Productivity coverage, ' + best.engines + ' productive engine(s), Reference APR ' + best.apr.toFixed(2) + '%. Но это только proxy того, что productive architecture измерима и работает; без канонического success criterion я не называю это доказательством выполнения исходной цели.'
          : best.name + ' currently has one of the strongest measurable signals of operational completeness: ' + best.coverage.toFixed(1) + '% Productivity coverage, ' + best.engines + ' productive engine(s), and ' + best.apr.toFixed(2) + '% Reference APR. This is only a proxy that the productive architecture is measurable and operating; without a canonical success criterion I will not call it proof that the original purpose has been fulfilled.',
        'Live Productivity'
      );
    }

    if (includesAny(q, ['deserves the owner attention first', 'owner attention first', 'investigate first', 'attention first', 'внимание владельца', 'исследовать первым'])) {
      const cases = safeArray(state.learning?.activeCases);
      const decisionWorthy = cases.filter(x => x?.experienceEligibility === 'decision-worthy');
      const high = decisionWorthy.filter(x => String(x?.riskTier || '').toLowerCase() === 'high');
      if (decisionWorthy.length) {
        const domains = [...new Set(decisionWorthy.map(x => x?.domain).filter(Boolean))].join(', ');
        return partial(
          ru
            ? 'Первым заслуживает review не инвестиционная аллокация, а ' + decisionWorthy.length + ' decision-worthy OS case(s)' + (high.length ? ', из них ' + high.length + ' high-risk' : '') + '. Домены: ' + (domains || 'не классифицированы') + '. Это приоритет внимания по verified Learning queue, а не рекомендация двигать капитал.'
            : 'The first review target is not an investment allocation: it is the ' + decisionWorthy.length + ' decision-worthy OS case(s)' + (high.length ? ', including ' + high.length + ' high-risk' : '') + '. Domains: ' + (domains || 'unclassified') + '. This is an attention priority from the verified Learning queue, not a recommendation to move capital.',
          'Live Decision & Outcome Learning'
        );
      }
      return unknown(ru ? 'Learning queue сейчас не даёт проверенного decision-worthy приоритета.' : 'The Learning queue currently provides no verified decision-worthy priority.', 'Live Decision & Outcome Learning');
    }

    if (includesAny(q, ['can the os still not learn', 'cannot learn yet', 'later evidence does not exist', 'еще не может научиться', 'не может выучить пока', 'позднего доказательства нет'])) {
      const summary = safeObject(state.learning?.summary);
      const settled = finite(summary.settledOutcomeCount) ?? 0;
      const lessons = finite(summary.lessonCount) ?? 0;
      const decisions = finite(summary.decisionCount) ?? 0;
      return {
        text: ru
          ? 'Главный предел сейчас – outcome learning. В памяти есть ' + decisions + ' owner decision(s), но settled outcomes = ' + settled + ', deterministic lessons = ' + lessons + '. Поэтому OS пока не может доказательно учиться тому, какие решения оказались хорошими или плохими в последующем результате – нужное позднее evidence ещё не накопилось.'
          : 'The main limit today is outcome learning. Memory contains ' + decisions + ' owner decision(s), but settled outcomes = ' + settled + ' and deterministic lessons = ' + lessons + '. The OS therefore cannot yet learn, from later evidence, which decisions proved good or bad in outcome terms because that downstream evidence has not accumulated yet.',
        source: 'Live Decision & Outcome Learning',
        confidenceHint: 'measured'
      };
    }

    if (includesAny(q, ['company companion existed today', 'companion readiness', 'understand best', 'understand worst', 'куратор понимал лучше', 'companion понимал'])) return unknown(
      ru
        ? 'Я пока не могу честно назвать best/worst для Company Companion: текущий Ask не имеет company-scoped completeness matrix, объединяющей Company Book, history, Productivity, Rewards, Embedded Yield, Realised Cash Flow, decisions и data gaps. Наличие одного APR не равно полноте понимания компании.'
        : 'I cannot honestly name the best/worst Company Companion target yet: Ask has no company-scoped completeness matrix combining Company Book, history, Productivity, Rewards, Embedded Yield, Realised Cash Flow, decisions and data gaps. Having one APR is not the same as understanding a company.',
      'Console capability map'
    );

    if (includesAny(q, ['unresolved data gap', 'data gap', 'limits owner understanding', 'пробел в данных', 'нехватк данных'])) {
      const rows = Object.entries(safeObject(state.productivity?.companies))
        .map(([name, x]) => ({ name, coverage: finite(x?.coverage) }))
        .filter(x => x.coverage !== null)
        .sort((a, b) => a.coverage - b.coverage);
      const worst = rows[0];
      if (worst && worst.coverage < 99.999) return partial(
        ru
          ? 'В Productivity самый явный измеримый data gap сейчас у ' + worst.name + ': coverage ' + worst.coverage.toFixed(1) + '%. Это конкретный verified пробел, но я не называю его крупнейшим во всей OS без единой cross-layer data-quality queue.'
          : 'Within Productivity, the clearest measurable data gap is ' + worst.name + ' at ' + worst.coverage.toFixed(1) + '% coverage. That is a verified gap, but I will not call it the largest gap across the whole OS without a unified cross-layer data-quality queue.',
        'Live Productivity'
      );
      return partial(
        ru
          ? 'Productivity не показывает явного coverage gap среди измеримых компаний. Следующий ограничитель owner understanding нельзя честно выбрать из одного слоя: Ask пока не имеет единой cross-layer data-quality queue для Productivity + Rewards + Embedded + Cash Flow + history.'
          : 'Productivity does not expose an obvious coverage gap among measured companies. The next owner-understanding bottleneck cannot be chosen honestly from one layer: Ask does not yet have a unified cross-layer data-quality queue spanning Productivity, Rewards, Embedded Yield, Cash Flow and history.',
        'Live Productivity + Console capability map'
      );
    }

    return null;
  }

  async function routeQuestion(raw) {
    const lang = isRu(raw) ? 'ru' : 'en';
    const q = norm(raw);
    if (!q) return helpAnswer(lang);

    const ownerSynthesis = await ownerEvidenceSynthesis(raw, lang);
    if (ownerSynthesis) return ownerSynthesis;

    if (/^(привет|здравств|хай|hello|hi|hey|gm)\b/.test(q) || includesAny(q, ['как дела', 'how are you'])) return greetingAnswer(lang, q);
    if (includesAny(q, ['помощ', 'help', 'что спросить', 'что умеешь', 'what can you do'])) return helpAnswer(lang);

    const trust = trustIntentAnswer(q, lang);
    if (trust) return trust;

    const follow = followupAnswer(raw, lang);
    if (follow) return follow;

    if (protocolGroup(raw) && includesAny(q,['which companies','who uses','who is using','which ones use','who runs','which companies run','companies use','companies using','какие компании','кто использует','компании используют','компании сидят','кто сидит'])) return protocolCompaniesAnswer(protocolGroup(raw),lang);
    if (includesAny(q, ['сколько компаний', 'какие компании', 'список компаний', 'how many companies', 'which companies', 'company list'])) return registryAnswer(lang);

    const definitionish = includesAny(q, ['что такое', 'объясни', 'что значит', 'what is', 'explain', 'difference', 'разница']);
    if (definitionish && protocolGroup(raw)==='yieldbasis') { state.lastEntity={kind:'protocol',key:'yieldbasis'}; state.lastTopic='protocol:yieldbasis'; return {text:lang==='ru'?'Yield Basis в The Holding разделяется на две экономические механики: unstaked yb-LP накапливает fee yield внутри PPS, а staked YB получает отдельные emissions/rewards. Эти слои не смешиваются.':'Yield Basis is split into two economic mechanics in The Holding: unstaked yb-LP compounds fee yield inside PPS, while staked YB receives separate emissions/rewards. These layers are not mixed.',source:'The Holding project canon'}; }
    if (definitionish) {
      const concept = conceptAnswer(raw, lang);
      if (concept) return concept;
    }

    const company = findCompany(raw);
    const compareIntent = includesAny(q, ['сравни', 'сравнить', 'compare', 'versus']);
    if (compareIntent) {
      const matches = findCompanies(raw);
      if (matches.length >= 2) return compareCompaniesAnswer(matches[0], matches[1], lang);
      if (matches.length === 1 && ['company','stable-company'].includes(state.lastEntity?.kind) && state.lastEntity.name !== matches[0].name) {
        const prior={name:state.lastEntity.name,registry:state.registry.find(x=>x.name===state.lastEntity.name)||null};
        return compareCompaniesAnswer(prior,matches[0],lang);
      }
    }
    const asksRewards = includesAny(q, ['reward', 'награ', 'claimable', 'accrued']);
    const asksEmbedded = includesAny(q, ['embedded', 'встроенн', 'внутри позиции']);
    const asksEntry = includesAny(q, ['точка входа', 'entry price', 'entry', 'цена входа', 'купил', 'покупк']);
    if (asksRewards) return rewardsAnswer(raw, lang, company);
    if (asksEmbedded) return embeddedAnswer(raw, lang, company);
    if (asksEntry) return entryAnswer(raw, lang, company);

    if (includesAny(q, ['что требует внимания', 'требует внимания', 'needs attention', 'attention items', 'проблемы сейчас'])) return attentionAnswer(lang);
    if (includesAny(q, ['почему только 3', 'почему три', 'почему так мало proposal', 'why only 3', 'data hygiene', 'decision worthy', 'decision-worthy'])) return whyFilteredAnswer(lang);
    if (includesAny(q, ['что уже одобрено', 'что одобрено', 'approved proposal', 'builder', 'guardian', 'может ли система выполнить', 'может ли это быть выполнено', 'can execute', 'governance status'])) return governanceStatusAnswer(lang);
    if (includesAny(q, ['что система предлагает', 'что система сейчас предлагает', 'что холдинг предлагает', 'предлагает система', 'что предлагаешь', 'proposal', 'propose', 'proposes', 'what does the holding propose', 'what does the system propose', 'recommendation', 'что делать дальше'])) return proposalAnswer(lang);
    if (includesAny(q, ['чему система учится', 'чему os научилась', 'чему os уже научилась', 'чему система научилась', 'как система учится', 'learning status', 'learning now', 'what has the os learned', 'what has the os learned recently', 'what has the system learned'])) return learningAnswer(lang);
    if (includesAny(q, ['что ты можешь сам', 'execution authority', 'полномочия', 'можешь сам', 'что можешь делать'])) return authorityAnswer(lang);
    if (includesAny(q, ['что сейчас происходит', 'состояние системы', 'system status', 'current state', 'как система'])) return currentStateAnswer(lang);

    if (company) {
      if (company.name === 'Monetra.eth' && includesAny(q, ['monetra', 'монетра']) && !includesAny(q, ['apr', 'продуктив', 'reference apr'])) return stableSummary(lang);
      return companyAnswer(company, lang, raw);
    }

    const wantsYield = includesAny(q, ['доходност', 'apr', 'apy', 'yield', 'productivity', 'продуктивност', 'ставка', 'rate']);
    const stableMatches = findStable(raw);
    const engineMatches = findEngines(raw);
    if (wantsYield && stableMatches.length && (!engineMatches.length || includesAny(q, ['apy', 'stable', 'стейбл', 'monetra', 'монетра', 'aave', 'spark', 'morpho']))) return stableAnswer(stableMatches, lang);
    if (wantsYield && engineMatches.length) return engineAnswer(engineMatches, lang);
    if (includesAny(q, ['monetra', 'монетра', 'stable capital', 'стейбл капитал']) && state.stable?.summary) return stableSummary(lang);

    const concept = conceptAnswer(raw, lang);
    if (concept) return concept;
    if (engineMatches.length && protocolGroup(raw)) return engineAnswer(engineMatches, lang);
    if (stableMatches.length && protocolGroup(raw)) return stableAnswer(stableMatches, lang);

    if (includesAny(q, ['company companion', 'companion agent', 'агент куратор', 'агент-куратор'])) return { text: lang === 'ru' ? 'Company Companion Agent – будущий AI-куратор одной onchain-компании. Он наследует общие способности The Holding OS и добавляет память, состояние, решения и риски конкретной компании. Сам по себе Companion не получает права подписывать транзакции или двигать капитал.' : 'A Company Companion Agent is a future AI curator for one onchain company. It inherits shared The Holding OS capabilities and adds that company’s memory, state, decisions and risks. A Companion does not automatically receive transaction-signing or capital authority.', source: 'The Holding project canon' };
    if (includesAny(q,['ai agents build companies','agents build companies','агенты собирать компании'])) return {text:lang==='ru'?'Да, это часть долгосрочного направления: authorised AI agents смогут читать machine-readable структуру The Holding и со временем собирать или сопровождать компании в пределах явных permissions. Это не означает неограниченную автономию капитала.':'Yes. The long-term direction includes authorised AI agents reading The Holding’s machine-readable structures and eventually building or accompanying companies within explicit permissions. That does not imply unrestricted capital autonomy.',source:'The Holding project canon'};
    if (includesAny(q, ['company marketplace', 'marketplace', 'биржа компаний'])) return { text: lang === 'ru' ? 'Company Marketplace – будущий слой discovery и передачи зрелых onchain-компаний или их структур, когда identity, history, transferability, security и юридическая форма будут достаточно зрелыми.' : 'The Company Marketplace is a future discovery and transfer layer for mature onchain companies or company structures once identity, history, transferability, security and legal design are sufficiently mature.', source: 'The Holding project canon' };
    if (includesAny(q, ['ratings', 'rating', 'рейтин'])) return { text: lang === 'ru' ? 'Рейтинги компаний задуманы как производная от проверяемой истории – прозрачности, возраста, устойчивости, productivity, концентрации риска, полноты reporting и maturity, а не популярности.' : 'Company ratings are intended to emerge from verifiable history – transparency, age, resilience, productivity, risk concentration, reporting completeness and maturity, not popularity.', source: 'The Holding project canon' };

    const publicHit = await searchPublicKnowledge(raw, lang);
    if (publicHit) return publicHit;

    const navigationIntent = includesAny(q, [
      'where should i start', 'where should a new person begin', 'where do i begin', 'where do i start',
      'i just found this site', 'new here', 'look first', 'bigger vision', 'read the vision',
      'с чего начать', 'с чего мне начать', 'я впервые тут', 'я первый раз тут', 'куда смотреть сначала',
      'где почитать видение', 'где почитать манифест'
    ]);
    if (navigationIntent) {
      state.lastTopic = 'product-navigation';
      return {
        text: lang === 'ru'
          ? 'Если ты здесь впервые, начни с Manifesto – там вся идея и дорожная карта. Затем открой Companies / Registry, чтобы увидеть реальные onchain-компании и их историю. После этого возвращайся в Ask The Holding и спрашивай про любую компанию, доходность, rewards, устройство OS или сравнение. Я помогу идти глубже по мере вопросов.'
          : 'If you are new here, start with the Manifesto for the full idea and roadmap. Then open Companies / Registry to see real onchain companies and their operating history. After that, come back to Ask The Holding and ask about any company, productivity, rewards, the OS, or comparisons. I can guide you deeper as questions emerge.',
        source: 'Public site knowledge: /manifesto /companies/ /agents/'
      };
    }

    return {
      text: lang === 'ru'
        ? 'Пока не могу ответить на это достаточно точно без свободной AI-модели. Я умею искать живые данные The Holding и публичные знания, но если подтверждённого ответа нет – лучше скажу «не знаю».\n\nПопробуй спросить про компанию, фонд, протокол, доходность, rewards, слои капитала, Brain, Learning или текущее состояние.'
        : 'I cannot answer that precisely enough yet without a free-form AI model. I can search live Holding data and public project knowledge, but if the evidence is not there, I would rather say “I don’t know”.\n\nTry a company, fund, protocol, productivity, rewards, capital layers, Brain, Learning or current state.',
      source: 'No sufficiently strong verified match'
    };
  }

  function buildQuick() {
    const quick = $('quick');
    const labels = ['Сколько сейчас компаний?', 'Сравни defitea.eth и YieldRing.eth', 'Что система предлагает?', 'Почему только 3 proposal?', 'Может ли система что-то выполнить?'];
    labels.forEach(text => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = text;
      b.addEventListener('click', () => ask(text));
      quick.appendChild(b);
    });
  }

  async function ask(text) {
    addMessage('user', text);
    const lang = isRu(text) ? 'ru' : 'en';
    const wait = pending(lang);
    input.disabled = true;
    button.disabled = true;
    try {
      state.lastTopic = null;
      const result = await routeQuestion(text);
      const contracted = await buildAnswerContract(result, text, lang);
      const guarded = enforceOutputGuard(contracted, text, lang);
      resolvePending(wait, guarded.text, guarded.source || '', guarded.answerContract);
      await recordAnswerQuality(guarded.answerContract, text);
    } catch (error) {
      const contract = Object.freeze({ version: ANSWER_CONTRACT_VERSION, language: lang, confidenceClass: 'unknown', sourceArtifacts: [], generatedAt: null, topic: coarseTopic(text), grounded: false });
      resolvePending(wait,
        lang === 'ru' ? 'Не удалось безопасно собрать ответ из live данных. Попробуй ещё раз чуть позже.' : 'I could not safely build an answer from live data. Please try again later.',
        'Fail-closed', contract);
      await recordAnswerQuality(contract, text, 'error');
      console.warn('[Holding Console route]', error);
    } finally {
      input.disabled = false;
      button.disabled = input.value.trim().length === 0;
      input.focus();
    }
  }

  function validateCore() {
    if (state.stack?.version !== '0.1-cognitive-stack-state') throw new Error('Unexpected cognitive stack');
    if (state.bridge?.version !== '0.1-chatgpt-bridge') throw new Error('Unexpected bridge');
    if (state.bridge?.sourceBrain?.sha256 !== state.stack?.chain?.groundedBrain?.sha256) throw new Error('Brain / Bridge mismatch');
    if (state.stack?.release?.exactByteMatch !== true) throw new Error('Release coherence mismatch');
  }

  function render() {
    validateCore();
    const ready = state.stack?.readyForManualInterpretation === true;
    const review = state.stack?.requiresImmediateHumanReview === true;
    consoleEl.dataset.health = ready && !review ? (meaningfulCases().length ? 'watch' : 'ready') : 'offline';
    $('statusText').textContent = ready && !review ? 'LIVE / VERIFIED' : review ? 'HUMAN REVIEW REQUIRED' : 'NOT READY';
    $('summaryText').textContent = plainSummary('en');
    $('companyFact').textContent = state.registry.length ? String(state.registry.length) : '—';
    $('engineFact').textContent = String(Object.keys(safeObject(state.productivity?.engines)).length || '—');
    const stableCount = state.stable?.summary?.positionCount ?? safeArray(state.stable?.positions).length;
    $('stableFact').textContent = stableCount ? String(stableCount) : '—';
    $('securityFact').textContent = String(security()?.status || 'unknown').toUpperCase();
    addMessage(
      'system',
      'Привет 🙂 Я уже читаю живые знания The Holding. Можно спрашивать обычным языком про компании, фонды, слои капитала, доходность протоколов, Stable Capital и состояние мозга системы.',
      'Live Registry + Productivity + Stable Capital + Cognitive Stack'
    );
  }

  async function boot() {
    buildQuick();
    try {
      const [stack, bridge, learning, decisions, proposals, builder, guardian, productivity, stable, companiesHtml] = await Promise.all([
        getJson(URLS.stack),
        getJson(URLS.bridge),
        getJson(URLS.learning, true),
        getJson(URLS.decisions, true),
        getJson(URLS.proposals, true),
        getJson(URLS.builder, true),
        getJson(URLS.guardian, true),
        getJson(URLS.productivity),
        getJson(URLS.stable),
        getText(URLS.companies)
      ]);
      Object.assign(state, {
        stack,
        bridge,
        learning,
        decisions,
        proposals,
        builder,
        guardian,
        productivity,
        stable,
        registry: parseRegistry(companiesHtml)
      });
      state.pageText.set('/companies/', companiesHtml);
      render();
    } catch (error) {
      consoleEl.dataset.health = 'offline';
      $('statusText').textContent = 'VERIFIED STATE UNAVAILABLE';
      $('summaryText').textContent = 'The live verified knowledge packet could not be loaded. No fallback facts are invented.';
      addMessage('system', 'Сейчас не удалось загрузить канонические live данные. Я не буду подменять их догадками. Попробуй обновить страницу чуть позже.', 'Fail-closed');
      console.warn('[The Holding Console boot]', error);
    }
  }

  input.addEventListener('input', () => { button.disabled = input.value.trim().length === 0; });
  form.addEventListener('submit', event => {
    event.preventDefault();
    const q = input.value.trim();
    if (!q || !state.bridge) return;
    input.value = '';
    button.disabled = true;
    ask(q);
  });

  boot();
})();
