(() => {
  'use strict';

  const intentContract = window.HoldingIntentContract;

  function validateIntentContract() {
    if (!intentContract || intentContract.VERSION !== '0.2-compositional-understanding-firewall') throw new Error('Intent Contract unavailable');
    const capability = intentContract.capability();
    if (!capability || capability.executionAuthority !== 'none' || capability.canAnswer !== false || capability.canSetConfidence !== false || capability.canSelectSourcesAsTruth !== false || capability.canExecute !== false || capability.canDecomposeQuestion !== true || capability.canReportMissingPrimitive !== true) {
      throw new Error('Intent Contract authority boundary mismatch');
    }
    const valid = intentContract.validate({ intent: 'owner-brief' });
    const composite = intentContract.validate({
      intent: 'unsupported-decomposed',
      operation: 'assess',
      scope: 'company',
      decomposition: [
        { object: 'company-purpose', entity: 'Monetra.eth', operation: 'get' },
        { object: 'current-strategy-book', entity: 'Monetra.eth', operation: 'get' }
      ],
      missingPrimitives: ['company-purpose']
    });
    const poisoned = intentContract.validate({ intent: 'owner-brief', answer: 'forbidden' });
    if (!valid?.ok || !composite?.ok || poisoned?.ok) throw new Error('Intent Contract validation invariant failed');
    return capability;
  }

  const URLS = Object.freeze({
    stack: '/intelligence/cognitive-stack-state.json',
    bridge: '/intelligence/brain-chatgpt-bridge.json',
    learning: '/intelligence/learning-state/learning-context.json',
    decisions: '/intelligence/learning/decision-ledger.json',
    proposals: '/intelligence/proposals/proposal-queue.json',
    builder: '/intelligence/builder/candidate-queue.json',
    guardian: '/intelligence/guardian/guardian-state.json',
    changeIntelligence: '/intelligence/change-intelligence.json',
    securityIntelligence: '/security/security-intelligence.json',
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
    changeIntelligence: null,
    securityIntelligence: null,
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
    'rewards', 'reward', 'claimable', 'claimables', 'companies', 'company', 'using', 'compare', 'productivity',
    'performance', 'profit', 'embedded', 'current', 'first', 'where', 'registry', 'passport', 'learning', 'proposal', 'builder',
    'guardian', 'transaction', 'authority', 'allocation', 'concentration', 'exposure', 'begin'
  ]);

  function editDistanceAtMostOne(a, b) {
    if (a === b) return true;
    if (Math.abs(a.length - b.length) > 1) return false;
    if (a.length === b.length) {
      const mismatch = [];
      for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) mismatch.push(i);
      if (mismatch.length <= 1) return true;
      if (mismatch.length === 2) {
        const [i, j] = mismatch;
        return j === i + 1 && a[i] === b[j] && a[j] === b[i];
      }
      return false;
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
    'транзакцию', 'транзу', 'приватник', 'приватника', 'клеймабл', 'клеймаблам', 'клаймабл', 'клаймаблам', 'компани'
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
      .replace(/к(?:лей|лай)мабл[а-я]*/gi, 'claimable')
      .replace(/\bкомпани\b/gi, 'компании');
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
  const isConcentrationIntent = q => {
    const n = norm(q);
    return includesAny(n, [
      'concentration risk', 'concentration most visible', 'most concentrated', 'largest concentration',
      'protocol concentration', 'cross company concentration', 'cross-company concentration',
      'biggest protocol exposure', 'where are we most concentrated',
      'где система наиболее сконцентрирована', 'где мы наиболее сконцентрированы',
      'где у нас самая большая концентрация', 'концентрация по протоколам',
      'что у нас с концентрацией', 'риск концентрации', 'концентрация риска'
    ]) || ((n.includes('сконцентрир') || n.includes('концентрац')) && includesAny(n, ['где', 'самая', 'наиболее', 'больше', 'риск']));
  };

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