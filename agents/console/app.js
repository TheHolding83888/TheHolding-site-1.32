(() => {
  'use strict';

  const URLS = Object.freeze({
    stack: '/intelligence/cognitive-stack-state.json',
    bridge: '/intelligence/brain-chatgpt-bridge.json',
    learning: '/intelligence/learning-state/learning-context.json',
    decisions: '/intelligence/learning/decision-ledger.json',
    productivity: '/companies/productivity-data.json',
    stable: '/companies/stable-capital-data.json',
    rewards: '/companies/rewards-data.json',
    embedded: '/companies/embedded-yield-data.json',
    entries: '/companies/strategy-entry-ledger.json',
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
    ['Intelligence', '/agents/']
  ]);

  const state = {
    stack: null,
    bridge: null,
    learning: null,
    decisions: null,
    productivity: null,
    stable: null,
    registry: [],
    lazy: { rewards: null, embedded: null, entries: null },
    pageText: new Map(),
    lastEntity: null,
    lastTopic: null
  };

  const ANSWER_CONTRACT_VERSION = '0.1-source-bound-answer-contract';
  const ANSWER_QUALITY_VERSION = '0.1-local-answer-quality';
  const ANSWER_QUALITY_KEY = 'holding-answer-quality-v1';
  const ANSWER_QUALITY_SALT_KEY = 'holding-answer-quality-salt-v1';
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
  const norm = text => String(text || '')
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
    const hasMeasuredValue = /(?:$|d+(?:[.,]d+)?%)/.test(String(result?.text || ''));
    if (hasWarming) return hasMeasuredValue ? 'partial' : 'warming';
    const coverageMatches = [...String(result?.text || '').matchAll(/(?:coverage|покрытие)[^0-9]{0,24}(d+(?:[.,]d+)?)%/gi)];
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
      const payload = new TextEncoder().encode(answerQualitySalt() + '|' + norm(raw));
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

  const PROTOCOL_ALIASES = Object.freeze({
    aerodrome: ['aerodrome', 'аэродром', 'aero', 'veaero'],
    velodrome: ['velodrome', 'велодром', 'velo', 'vevelo'],
    convex: ['convex', 'конвекс', 'cvx', 'vlcvx', 'cvxcrv'],
    curve: ['curve', 'керв', 'кёрв', 'curve dao', 'crv', 'vecrv'],
    yieldbasis: ['yield basis', 'yieldbasis', 'yield-basis', 'veyb', 'yb-lp', 'йелд бейсис', 'илд бейсис'],
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
      'Monetra.eth': ['monetra', 'монетра'],
      '05081966.eth': ['05081966'],
      '0x5860...83CA8.eth': ['83ca8', '5860'],
      '1milliondollar.eth': ['1milliondollar', '1 million dollar', 'milliondollar']
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

  function registryAnswer(lang) {
    const names = state.registry.map(x => x.name);
    state.lastTopic = 'registry';
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

  function proposalAnswer(lang) {
    const items = meaningfulCases().filter(x => x?.deterministicAction).slice(0, 5);
    state.lastTopic = 'proposal';
    if (!items.length) return {
      text: lang === 'ru' ? 'В текущем Brain packet нет конкретного non-info предложения к действию.' : 'There is no concrete non-info action proposal in the current Brain packet.',
      source: 'Live Brain Bridge'
    };
    return {
      text: (lang === 'ru' ? 'Текущие предложения – только для рассмотрения, не автоматические действия:\n' : 'Current proposals – for review only, not automatic actions:\n') + items.map((x, i) => `${i + 1}. ${x.deterministicAction}`).join('\n'),
      source: 'Live Brain Bridge'
    };
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
    if (!state.lastEntity || protocolGroup(query) || findCompany(query)) return null;
    if (state.lastEntity.kind === 'company' && includesAny(q, ['истор', 'средн', 'histor', 'average'])) {
      return companyAnswer({ name: state.lastEntity.name, registry: state.registry.find(x => x.name === state.lastEntity.name) || null }, lang, query);
    }
    if (state.lastEntity.kind === 'engine' && includesAny(q, ['а сейчас', 'current', 'текущ', 'доход', 'apr'])) {
      const e = safeObject(state.productivity?.engines)[state.lastEntity.id];
      if (e) return engineAnswer([e], lang);
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
      source: 'Live Rewards data'
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
    const best = results.filter(x => x.score >= 3).slice(0, 2);
    if (!best.length) return null;
    return {
      text: (lang === 'ru' ? 'Нашёл в публичных знаниях The Holding:\n\n' : 'Found in The Holding public knowledge:\n\n') + best.map(x => `${x.name}: ${x.block}`).join('\n\n'),
      source: `Public site knowledge · ${best.map(x => x.url).join(' · ')}`
    };
  }

  async function routeQuestion(raw) {
    const lang = isRu(raw) ? 'ru' : 'en';
    const q = norm(raw);
    if (!q) return helpAnswer(lang);

    if (/^(привет|здравств|хай|hello|hi|hey)\b/.test(q) || includesAny(q, ['как дела', 'how are you'])) return greetingAnswer(lang, q);
    if (includesAny(q, ['помощ', 'help', 'что спросить', 'что умеешь', 'what can you do'])) return helpAnswer(lang);

    const follow = followupAnswer(raw, lang);
    if (follow) return follow;

    if (includesAny(q, ['сколько компаний', 'какие компании', 'список компаний', 'how many companies', 'which companies', 'company list'])) return registryAnswer(lang);

    const definitionish = includesAny(q, ['что такое', 'объясни', 'что значит', 'what is', 'explain', 'difference', 'разница']);
    if (definitionish) {
      const concept = conceptAnswer(raw, lang);
      if (concept) return concept;
    }

    const company = findCompany(raw);
    const asksRewards = includesAny(q, ['reward', 'награ', 'claimable', 'accrued']);
    const asksEmbedded = includesAny(q, ['embedded', 'встроенн', 'внутри позиции']);
    const asksEntry = includesAny(q, ['точка входа', 'entry price', 'entry', 'цена входа', 'купил', 'покупк']);
    if (asksRewards) return rewardsAnswer(raw, lang, company);
    if (asksEmbedded) return embeddedAnswer(raw, lang, company);
    if (asksEntry) return entryAnswer(raw, lang, company);

    if (includesAny(q, ['что требует внимания', 'требует внимания', 'needs attention', 'attention items', 'проблемы сейчас'])) return attentionAnswer(lang);
    if (includesAny(q, ['что система предлагает', 'что предлагаешь', 'proposal', 'recommendation', 'recommend', 'что делать дальше'])) return proposalAnswer(lang);
    if (includesAny(q, ['чему система учится', 'как система учится', 'learning status', 'learning now'])) return learningAnswer(lang);
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

    const publicHit = await searchPublicKnowledge(raw, lang);
    if (publicHit) return publicHit;

    return {
      text: lang === 'ru'
        ? 'Пока не могу ответить на это достаточно точно без свободной AI-модели. Я умею искать живые данные The Holding и публичные знания, но если подтверждённого ответа нет – лучше скажу «не знаю».\n\nПопробуй спросить про компанию, фонд, протокол, доходность, rewards, слои капитала, Brain, Learning или текущее состояние.'
        : 'I cannot answer that precisely enough yet without a free-form AI model. I can search live Holding data and public project knowledge, but if the evidence is not there, I would rather say “I don’t know”.\n\nTry a company, fund, protocol, productivity, rewards, capital layers, Brain, Learning or current state.',
      source: 'No sufficiently strong verified match'
    };
  }

  function buildQuick() {
    const quick = $('quick');
    const labels = ['Сколько сейчас компаний?', 'Какая доходность Aerodrome?', 'Что с Monetra?', 'Как устроены слои капитала?', 'Что требует внимания?'];
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
      resolvePending(wait, contracted.text, contracted.source || '', contracted.answerContract);
      await recordAnswerQuality(contracted.answerContract, text);
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
      const [stack, bridge, learning, decisions, productivity, stable, companiesHtml] = await Promise.all([
        getJson(URLS.stack),
        getJson(URLS.bridge),
        getJson(URLS.learning, true),
        getJson(URLS.decisions, true),
        getJson(URLS.productivity),
        getJson(URLS.stable),
        getText(URLS.companies)
      ]);
      Object.assign(state, {
        stack,
        bridge,
        learning,
        decisions,
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
