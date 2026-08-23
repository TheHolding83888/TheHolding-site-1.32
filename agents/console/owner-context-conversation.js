(() => {
  'use strict';

  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const VERSION = '0.1-owner-context-conversational-cortex';
  const CONTRACT_VERSION = '0.1-source-bound-answer-contract';
  const URLS = Object.freeze({
    context: '/intelligence/owner-context/owner-decision-context.json',
    overlay: '/intelligence/owner-context/brain-owner-context-overlay.json',
    graph: '/intelligence/owner-context/intelligence-graph-growth-directive.json',
    ecosystem: '/intelligence/owner-context/ecosystem-investment-thesis.json',
    thi: '/intelligence/intelligence-progress.json',
    decisions: '/intelligence/learning/decision-ledger.json',
    events: '/intelligence/event-intelligence.json'
  });

  const state = {
    loaded: false,
    loading: null,
    data: null
  };

  const norm = value => String(value || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[’']/g, '')
    .replace(/[^a-zа-я0-9.$%+→-]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const includesAny = (q, list) => list.some(item => q.includes(norm(item)));
  const safeArray = value => Array.isArray(value) ? value : [];
  const safeObject = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const finiteInt = value => Number.isInteger(Number(value)) && Number(value) >= 0 ? Number(value) : null;

  function unique(values, limit = 50) {
    const out = [];
    const seen = new Set();
    for (const raw of values) {
      const value = String(raw || '').trim();
      if (!value || seen.has(value)) continue;
      seen.add(value);
      out.push(value);
      if (out.length >= limit) break;
    }
    return out;
  }

  function collectNamedArrays(root, keyName, max = 300) {
    const found = [];
    const seen = new WeakSet();
    function walk(value) {
      if (!value || typeof value !== 'object' || found.length >= max) return;
      if (seen.has(value)) return;
      seen.add(value);
      if (Array.isArray(value)) {
        value.forEach(walk);
        return;
      }
      for (const [key, child] of Object.entries(value)) {
        if (key === keyName && Array.isArray(child)) found.push(...child);
        walk(child);
      }
    }
    walk(root);
    return found.slice(0, max);
  }

  function findModule(context, key) {
    for (const source of safeArray(context?.sources)) {
      if (source?.modules && Object.prototype.hasOwnProperty.call(source.modules, key)) {
        return source.modules[key];
      }
    }
    return null;
  }

  function flattenStrings(value, max = 80) {
    const out = [];
    const seen = new WeakSet();
    function walk(node) {
      if (out.length >= max || node === null || node === undefined) return;
      if (typeof node === 'string') {
        if (node.trim()) out.push(node.trim());
        return;
      }
      if (typeof node !== 'object') return;
      if (seen.has(node)) return;
      seen.add(node);
      if (Array.isArray(node)) node.forEach(walk);
      else Object.values(node).forEach(walk);
    }
    walk(value);
    return unique(out, max);
  }

  async function readJson(url) {
    const response = await fetch(`${url}?v=${Date.now()}`, {
      cache: 'no-store',
      credentials: 'same-origin'
    });
    if (!response.ok) throw new Error(`${url} HTTP ${response.status}`);
    return response.json();
  }

  function validate(data) {
    const { context, overlay, graph, ecosystem } = data;
    if (context?.version !== '0.1-owner-decision-context-runtime') throw new Error('Unexpected Owner Decision Context version');
    if (context?.authority?.executionAuthority !== 'none' || context?.authority?.executable !== false) throw new Error('Owner context authority boundary failed');
    if (context?.authority?.marketFactAuthority !== false || context?.authority?.evidenceOverrideAuthority !== false) throw new Error('Owner context fact authority boundary failed');
    if (overlay?.version !== '0.1-brain-owner-context-overlay') throw new Error('Unexpected Brain owner-context overlay version');
    if (overlay?.constraints?.executionAllowed !== false || overlay?.constraints?.proposalOnly !== true) throw new Error('Overlay execution boundary failed');
    if (overlay?.ownerDecisionContext?.contextHash !== context?.contextHash) throw new Error('Owner context / Brain overlay binding mismatch');
    if (graph?.version !== '0.2-intelligence-graph-growth-directive-autonomous-experience') throw new Error('Unexpected Intelligence Graph directive version');
    if (graph?.authority?.executionAuthority !== 'none' || graph?.authority?.marketFactAuthority !== false) throw new Error('Graph authority boundary failed');
    if (ecosystem?.version !== '0.1-owner-ecosystem-investment-thesis') throw new Error('Unexpected ecosystem thesis version');
    if (ecosystem?.authority?.executionAuthority !== 'none') throw new Error('Ecosystem thesis authority boundary failed');
    return true;
  }

  async function load() {
    if (state.loaded && state.data) return state.data;
    if (state.loading) return state.loading;
    state.loading = (async () => {
      const [context, overlay, graph, ecosystem, thi, decisions, events] = await Promise.all([
        readJson(URLS.context),
        readJson(URLS.overlay),
        readJson(URLS.graph),
        readJson(URLS.ecosystem),
        readJson(URLS.thi).catch(() => null),
        readJson(URLS.decisions).catch(() => null),
        readJson(URLS.events).catch(() => null)
      ]);
      const data = { context, overlay, graph, ecosystem, thi, decisions, events };
      validate(data);
      state.data = data;
      state.loaded = true;
      return data;
    })().finally(() => { state.loading = null; });
    return state.loading;
  }

  function classify(raw) {
    const q = norm(raw);
    if (!q) return null;

    const authority = includesAny(q, [
      'rebalance capital from owner context', 'execute the sale automatically', 'change thi policy',
      'promote a candidate relationship', 'ребалансировку по owner context',
      'выполни продажу автоматически', 'измени thi policy', 'запиши candidate relationship как proven',
      'без моего подтверждения'
    ]);
    if (authority) return 'authority';

    const coverage = includesAny(q, [
      'exact protocol trading volume time series', 'complete daily concentration drift history',
      'exact mechanism specific fee to company cash flow', 'canonical index movement event feed',
      'every rwa asset owned', 'точный protocol trading volume time series', 'полный daily concentration drift',
      'точную mechanism specific', 'canonical index movement', 'все rwa assets владельцев'
    ]);
    if (coverage) return 'coverage-gap';

    const causal = includesAny(q, [
      'prove that higher tvl automatically', 'higher token price always', 'exact causal strength',
      'percentage of fee growth is guaranteed', 'universal defi formula', 'докажи что рост tvl автоматически',
      'рост token price всегда', 'точную причинную силу', 'процент роста fees гарантированно',
      'универсальную формулу volume'
    ]);
    if (causal) return 'causal-proof';

    if (includesAny(q, ['health factor', ' hf ', 'hf 1.8', 'collateral risk', 'stable buffer', 'ликвидац'])) return 'health-factor';
    if (includesAny(q, ['locked', 'liquid productive', 'lock state', 'voting power', 'unlock', 'залоч', 'лок', 'ликвидн asset', 'voting'])) return 'lock-aware';
    if (includesAny(q, ['rwa', 'fructus', 'tokenized real estate', 'tokenized real']) || q.split(' ').includes('ondo')) return 'rwa';
    if (includesAny(q, ['ideal company', '5 10 years', '5–10', 'foundation should', 'dependence on one protocol', 'diversification dimensions', 'offchain', 'идеальн company', 'идеальная company', 'через 5', 'foundation должен', 'одного protocol', 'диверсификац'])) return 'ideal-company';
    if (includesAny(q, ['knowledge graph growth', '35 teaching', 'teaching units not', 'increase thi', 'experience factor', 'more questions', 'maturity', 'не должны автоматически повышать thi', 'knowledge graph', 'больше вопросов'])) return 'thi-vs-knowledge';
    if (includesAny(q, ['decision quality', 'outcome quality', 'hindsight bias', 'settled outcomes', 'learning case', 'future outcomes', 'качество решения', 'качество результата', 'ретроспектив', 'будущими outcomes'])) return 'decision-outcome';
    if (includesAny(q, ['the holding news', 'news', 'metric capability', 'raw metrics', 'graph derived events', 'causal overclaim', 'новост', 'сырые metrics'])) return 'news-salience';
    if (includesAny(q, ['protocol economics', 'protocol fees', 'protocol revenue', 'holder revenue', 'real yield', 'emissions', 'fees to emissions', 'business quality', 'protocol business', 'экономик протокол'])) return 'protocol-economics';
    if (includesAny(q, ['tvl grew', 'tvl rises', 'tvl change', 'tvl компании вырос', 'рост tvl', 'company tvl', 'capital inflow', 'concentration drift', 'price driven tvl'])) return 'tvl-cashflow';
    if (includesAny(q, ['candidate relationship', 'graph edge', 'relationship between metrics', 'reward units', 'price effect', 'quantity effect', 'volume fees company cash flow', 'связ', 'нейронн'])) return 'graph-relationships';
    if (includesAny(q, ['candidate metrics', 'metric candidates', 'tracking hooks', 'measurable onchain', 'production collector', 'новые измеримые метрики', 'какие метрики', 'что можно реально измерять'])) return 'metric-discovery';
    if (includesAny(q, ['owner teaching units', 'owner context', 'owner-context', 'owner heuristic', 'decision context', 'audio questions', 'text teaching', 'привязаны к brain', 'owner teaching'])) return 'owner-context';
    return null;
  }

  function artifacts(...keys) {
    return unique(keys.flatMap(key => URLS[key] ? [URLS[key]] : []), 12);
  }

  function result({ text, confidence = 'partial', topic, sourceArtifacts, provenanceClass }) {
    return {
      text,
      confidence,
      topic,
      sourceArtifacts: unique(sourceArtifacts || [], 12),
      provenanceClass: provenanceClass || 'owner-context',
      grounded: confidence !== 'unknown' && safeArray(sourceArtifacts).length > 0
    };
  }

  function ownerContextAnswer(data, lang) {
    const p = safeObject(data.context?.provenance);
    const total = finiteInt(p.totalTeachingUnits);
    const audio = finiteInt(p.audioQuestionCount);
    const text = finiteInt(p.textTeachingItemCount);
    const sources = finiteInt(p.sourceCount);
    const ru = lang === 'ru';
    return result({
      text: ru
        ? `Сейчас Owner Decision Context содержит ${total ?? '—'} structured teaching units: ${text ?? '—'} ранних text teaching + ${audio ?? '—'} audio Q. Канонических context source(s): ${sources ?? '—'}. Они exact-bound рядом с Grounded Brain через read-only overlay.\n\nКритическая граница: это decision context, а не market truth. Owner heuristic не может переписать onchain/security evidence, не создаёт Brain case и не даёт execution authority.`
        : `Owner Decision Context currently contains ${total ?? '—'} structured teaching units: ${text ?? '—'} earlier text teaching + ${audio ?? '—'} audio Q. Canonical context sources: ${sources ?? '—'}. They are exact-bound beside the Grounded Brain through a read-only overlay.\n\nCritical boundary: this is decision context, not market truth. An owner heuristic cannot override onchain/security evidence, create a Brain case, or grant execution authority.`,
      confidence: 'measured',
      topic: 'owner-context-ingestion',
      sourceArtifacts: artifacts('context', 'overlay'),
      provenanceClass: 'owner-context-bound'
    });
  }

  function metricDiscoveryAnswer(data, lang) {
    const hooks = unique([
      ...collectNamedArrays(data.context?.sources, 'trackingHooks').map(x => typeof x === 'string' ? x : x?.id),
      ...safeArray(data.ecosystem?.trackingHooks)
    ], 40);
    const sample = hooks.slice(0, 12);
    const ru = lang === 'ru';
    return result({
      text: ru
        ? `Из owner teaching уже выделено ${hooks.length} deduplicated tracking-hook candidate(s) в доступном контексте. Примеры: ${sample.join(', ') || 'нет доступных hooks'}.\n\nЭто именно candidates. Перед production tracking каждому нужны воспроизводимый source, точная metric semantics, freshness/identity rules и проверка на дубли. Onchain-измеримость определяется для конкретного hook — наличие идеи в owner context не делает метрику live.`
        : `The available owner context exposes ${hooks.length} deduplicated tracking-hook candidate(s). Examples: ${sample.join(', ') || 'no hooks available'}.\n\nThese are candidates. Before production tracking, each needs a reproducible source, precise metric semantics, freshness/identity rules, and duplicate checks. Onchain measurability is evaluated per hook; appearing in owner context does not make a metric live.`,
      topic: 'metric-discovery',
      sourceArtifacts: artifacts('context', 'ecosystem', 'graph'),
      provenanceClass: 'candidate-metric'
    });
  }

  function graphRelationshipAnswer(data, lang) {
    const explicit = collectNamedArrays(data.context?.sources, 'relationshipCandidates');
    const edges = explicit.map(edge => {
      if (typeof edge === 'string') return edge;
      if (!edge || typeof edge !== 'object') return '';
      return [edge.from || edge.source, edge.relation || edge.type || '→', edge.to || edge.target, edge.status ? `(${edge.status})` : ''].filter(Boolean).join(' ');
    }).filter(Boolean);
    const classes = safeArray(data.graph?.epistemicEdgeClasses);
    const ru = lang === 'ru';
    return result({
      text: ru
        ? `Intelligence Graph различает edge classes: ${classes.join(', ')}. Текущие explicit relationship candidates включают: ${edges.slice(0, 8).join('; ') || 'отношения пока описаны через tracking hooks и graph directive'}.\n\nReward USD value можно derived-связать с units × price, если единицы, цена, timestamp и asset identity согласованы. Quantity effect и price effect должны храниться раздельно. Цепочка volume → fees → company cash flow НЕ считается доказанной автоматически: каждый переход требует protocol-specific mechanism evidence и company economic right.`
        : `The Intelligence Graph distinguishes edge classes: ${classes.join(', ')}. Current explicit relationship candidates include: ${edges.slice(0, 8).join('; ') || 'relationships currently expressed through tracking hooks and the graph directive'}.\n\nReward USD value can be derived from units × price only when units, price, timestamp, and asset identity align. Quantity effect and price effect must remain separate. The volume → fees → company cash-flow chain is NOT automatically proven: every transition requires protocol-specific mechanism evidence and a company economic right.`,
      topic: 'graph-relationships',
      sourceArtifacts: artifacts('context', 'graph', 'ecosystem'),
      provenanceClass: 'candidate-and-derived-edge'
    });
  }

  function causalProofAnswer(data, lang) {
    const ru = lang === 'ru';
    return result({
      text: ru
        ? 'Нет — такую универсальную причинность The Holding сейчас не утверждает. TVL, token price, volume, fees, APR и company cash flow могут двигаться вместе или расходиться. Чтобы повысить связь до causal edge, нужен protocol-specific механизм: activity → fees/revenue → holder value capture → exact company economic right → measured company cash flow, с временным выравниванием и исключением альтернативных драйверов. Без этого статус остаётся hypothesis/unknown.'
        : 'No — The Holding does not assert that universal causality. TVL, token price, volume, fees, APR and company cash flow can move together or diverge. Promoting a relation to a causal edge requires a protocol-specific mechanism: activity → fees/revenue → holder value capture → exact company economic right → measured company cash flow, with temporal alignment and alternative-driver checks. Without that, the edge remains hypothesis/unknown.',
      confidence: 'unknown',
      topic: 'causal-proof-boundary',
      sourceArtifacts: artifacts('graph', 'ecosystem', 'context'),
      provenanceClass: 'causal-guard'
    });
  }

  function tvlCashflowAnswer(data, lang) {
    const ru = lang === 'ru';
    return result({
      text: ru
        ? 'Рост company TVL сам по себе не говорит, почему компания стала “лучше”. Перед выводом нужно разложить изменение минимум на: price effect существующих активов, external contributions/distributions, internal strategy moves, reward/income generation и concentration drift. TVL может расти из-за token price, пока generated cash flow падает. Для сравнения TVL ↔ cash flow нужны синхронизированные time series и одинаковые company/asset boundaries; correlation без механизма не становится causation.'
        : 'A rise in company TVL does not by itself explain why the company became “better.” Decompose the move at minimum into existing-asset price effect, external contributions/distributions, internal strategy moves, reward/income generation, and concentration drift. TVL can rise because token prices rise while generated cash flow falls. Comparing TVL ↔ cash flow requires aligned time series and consistent company/asset boundaries; correlation without a mechanism does not become causation.',
      topic: 'company-tvl-cashflow',
      sourceArtifacts: artifacts('context', 'graph', 'ecosystem'),
      provenanceClass: 'reasoning-context'
    });
  }

  function protocolEconomicsAnswer(data, lang) {
    const model = safeObject(data.ecosystem?.futureProtocolBusinessModel);
    const hooks = safeArray(data.ecosystem?.trackingHooks);
    const ru = lang === 'ru';
    return result({
      text: ru
        ? `Owner thesis требует смотреть на DeFi как на business economics, но не смешивать gross activity и owner income. Candidate metrics: ${hooks.slice(0, 14).join(', ')}.\n\nProtocol fees = валовая экономическая активность/сборы по конкретной механике; protocol revenue = часть economics, которая остаётся протоколу/стейкхолдерам по правилам механизма; holder revenue/value capture = часть, реально доступная конкретным economic-right holders. Emissions — субсидия токеном и не равны real yield автоматически. Без доказанной цепочки ${safeArray(model.causalChain).join(' → ')} fee не становится company cash-flow signal.`
        : `The owner thesis asks The Holding to analyze DeFi as business economics without conflating gross activity with owner income. Candidate metrics: ${hooks.slice(0, 14).join(', ')}.\n\nProtocol fees are gross economic activity/fees under a specific mechanism; protocol revenue is the portion retained/accrued under that mechanism; holder revenue/value capture is the portion actually available to defined economic-right holders. Emissions are token subsidies and do not automatically equal real yield. Without the proven chain ${safeArray(model.causalChain).join(' → ')}, a fee metric does not become a company cash-flow signal.`,
      topic: 'protocol-economics',
      sourceArtifacts: artifacts('ecosystem', 'context', 'graph'),
      provenanceClass: 'owner-thesis-plus-evidence-boundary'
    });
  }

  function healthFactorAnswer(data, lang) {
    const hf = safeObject(findModule(data.context, 'healthFactorRegime'));
    const inputs = safeArray(hf.reasoningInputsDesired);
    const ru = lang === 'ru';
    return result({
      text: ru
        ? `Owner context рассматривает Health Factor как regime-aware safety margin, а не один глобальный порог. Общая ориентация владельца примерно ${safeArray(hf.generalPreferredOrientation?.approxMinRange).join('–') || '1.8–2'}+, в prolonged weak market при active monitoring обсуждался более узкий диапазон, а в strong/overheated market — более широкий buffer. Это heuristics, не автоматическая policy.\n\nДля reasoning нужны: ${inputs.join(', ')}. Monitoring frequency, collateral volatility, debt asset, liquidation mechanics, stable/foundation buffer и unlock latency могут менять интерпретацию одного и того же HF.`
        : `Owner context treats Health Factor as a regime-aware safety margin, not one global threshold. The owner’s general orientation is roughly ${safeArray(hf.generalPreferredOrientation?.approxMinRange).join('–') || '1.8–2'}+, with a narrower range discussed in prolonged weak markets under active monitoring and wider buffers in strong/overheated markets. These are heuristics, not automatic policy.\n\nReasoning inputs include: ${inputs.join(', ')}. Monitoring frequency, collateral volatility, debt asset, liquidation mechanics, stable/foundation buffer, and unlock latency can change how the same HF should be interpreted.`,
      topic: 'health-factor-regime',
      sourceArtifacts: artifacts('context', 'overlay'),
      provenanceClass: 'owner-heuristic'
    });
  }

  function lockAwareAnswer(data, lang) {
    const winner = safeObject(findModule(data.context, 'winnerGrowthAndLiquidity'));
    const hookObjects = collectNamedArrays(data.context?.sources, 'trackingHooks').filter(x => x && typeof x === 'object');
    const lockHook = hookObjects.find(x => x.id === 'lock-aware-concentration');
    const fields = safeArray(lockHook?.desiredFields);
    const ru = lang === 'ru';
    return result({
      text: ru
        ? `Owner context требует сначала различать locked и liquid capital. Для strategic locked winner bias — дать позиции работать, пока thesis/economics intact; 2–3x сам по себе не является sell trigger. Для очень сильного liquid winner допускается staged/laddered reduction, но упомянутые 5–10x/tens-of-X — examples, не hard threshold.\n\nНужные lock-state fields: ${fields.join(', ') || 'locked/liquid quantity, unlock horizon, voting-power decay, tranches, concentration'}. Declining voting power может стать причиной review/extension lock, но не автоматического действия.`
        : `Owner context requires separating locked from liquid capital first. For a strategic locked winner, the bias is to let the position operate while thesis/economics remain intact; 2–3x alone is not a sell trigger. For a very strong liquid winner, staged/laddered reduction is allowed, but the mentioned 5–10x/tens-of-X are examples, not hard thresholds.\n\nUseful lock-state fields: ${fields.join(', ') || 'locked/liquid quantity, unlock horizon, voting-power decay, tranches, concentration'}. Declining voting power can trigger review/lock extension consideration, never an automatic action.`,
      topic: 'lock-aware-capital',
      sourceArtifacts: artifacts('context', 'overlay'),
      provenanceClass: 'owner-heuristic'
    });
  }

  function rwaAnswer(data, lang) {
    const rwa = safeObject(findModule(data.context, 'rwaRole'));
    const boundary = safeObject(data.ecosystem?.rwaAnalysisBoundary);
    const ru = lang === 'ru';
    return result({
      text: ru
        ? `В owner capital architecture RWA — важный, но более поздний supporting layer; связанный fund — ${rwa.associatedFund || 'Fructus'}, stage: ${rwa.stage || 'developing'}. ONDO сохранён как owner example/candidate, а не автоматическая инвестиция.\n\nЧтобы RWA exposure считалось verified, одного narrative/token label недостаточно. Нужны: ${safeArray(boundary.requiredDimensions).join(', ')}. Потенциальный cash flow зависит от конкретного инструмента и его legal/economic rights; owner thesis и реально измеренная exposure должны храниться раздельно.`
        : `In the owner capital architecture, RWA is important but a later supporting layer; the associated fund is ${rwa.associatedFund || 'Fructus'}, stage: ${rwa.stage || 'developing'}. ONDO is preserved as an owner example/candidate, not an automatic investment.\n\nA narrative or token label is not enough to call an RWA exposure verified. Required dimensions include: ${safeArray(boundary.requiredDimensions).join(', ')}. Potential cash flow depends on the specific instrument and its legal/economic rights; owner thesis and measured exposure must remain separate.`,
      topic: 'rwa-fructus-ondo',
      sourceArtifacts: artifacts('context', 'ecosystem'),
      provenanceClass: 'owner-thesis-plus-rwa-boundary'
    });
  }

  function idealCompanyAnswer(data, lang) {
    const ideal = safeObject(findModule(data.context, 'idealCompanyLongHorizon'));
    const dims = safeArray(ideal.diversificationDimensions);
    const ru = lang === 'ru';
    return result({
      text: ru
        ? `Идеальная company на 5–10 лет в owner context — layered, structured, flexible, diversified и self-strengthening. Foundation должен быть самым широким base; productive/dividend layer берёт больший risk и генерирует cash flow, который может усиливать foundation, stables, RWA, productive layer, venture или уходить владельцу.\n\nДиверсификация рассматривается по: ${dims.join(', ')}. Single-protocol dependency нежелательна. Multi-wallet/multi-chain и offchain assets допустимы, но увеличивают operational complexity. Offchain foundation нельзя выдумывать из wallet collector: он остаётся owner-declared/unverified до отдельного provenance path.`
        : `The ideal 5–10 year company in owner context is layered, structured, flexible, diversified, and self-strengthening. The foundation should be the broadest base; the productive/dividend layer takes more risk and generates cash flow that can reinforce foundation, stables, RWA, productive assets, venture, or be distributed to the owner.\n\nDiversification dimensions include: ${dims.join(', ')}. Single-protocol dependency is undesirable. Multi-wallet/multi-chain and offchain assets are allowed but add operational complexity. Offchain foundation cannot be invented from a wallet collector; it remains owner-declared/unverified until a separate provenance path exists.`,
      topic: 'ideal-company-architecture',
      sourceArtifacts: artifacts('context', 'graph'),
      provenanceClass: 'owner-architecture-context'
    });
  }

  function newsSalienceAnswer(data, lang) {
    const intent = safeObject(data.graph?.surfaceIntent);
    const eventTypes = safeArray(data.events?.trackedEventTypes || data.events?.policy?.trackedEventTypes || data.events?.coverage?.trackedEventTypes);
    const ru = lang === 'ru';
    return result({
      text: ru
        ? `The Holding News должна получать новую capability только после того, как metric/edge имеет воспроизводимый source и понятную semantics. Цель News: ${intent.theHoldingNews || 'source-backed company-centric events and relationships, not raw metric dumps'}.\n\nСам raw metric change полезен, но более сильный сигнал — доказуемая связь нескольких изменений с сохранённым provenance. При этом News обязана писать correlation/driver attribution осторожно: causal wording разрешён только после mechanism-specific proof. Сейчас наличие candidate edge само по себе не создаёт news event.${eventTypes.length ? ` Доступных tracked event descriptors в текущем packet: ${eventTypes.length}.` : ''}`
        : `The Holding News should receive a new capability only after a metric/edge has a reproducible source and clear semantics. Its target is: ${intent.theHoldingNews || 'source-backed company-centric events and relationships, not raw metric dumps'}.\n\nA raw metric change can matter, but a stronger signal is a provable relationship among changes with preserved provenance. News must remain cautious with causal language: causal wording requires mechanism-specific proof. A candidate edge alone does not create a news event.${eventTypes.length ? ` Current packet exposes ${eventTypes.length} tracked event descriptor(s).` : ''}`,
      topic: 'news-salience',
      sourceArtifacts: artifacts('graph', 'events', 'context'),
      provenanceClass: 'surface-policy-context'
    });
  }

  function thiKnowledgeAnswer(data, lang) {
    const thi = safeObject(data.thi);
    const p = safeObject(data.context?.provenance);
    const score = thi?.index?.value ?? null;
    const stage = thi?.index?.stage ?? null;
    const experience = safeArray(thi?.factors).find(x => x?.id === 'experience');
    const ru = lang === 'ru';
    return result({
      text: ru
        ? `Knowledge Graph Growth и THI — разные вещи. Сейчас context содержит ${p.totalTeachingUnits ?? '—'} teaching units, но их количество не должно автоматически повышать maturity. THI — deterministic capability/evidence index${score !== null ? `; текущий packet: ${score}/100${stage ? ` · ${stage}` : ''}` : ''}.\n\nExperience должен расти прежде всего через реальные owner decisions → settled outcomes → lessons, а не через количество вопросов. Новая graph/cortex capability может повлиять на maturity только после доказанного улучшения evaluation/coverage/learning по правилам THI, а не потому что код или ответы просто добавились.${experience ? ` Current Experience: ${experience.score}/${experience.max}.` : ''}`
        : `Knowledge Graph Growth and THI are different. The context currently contains ${p.totalTeachingUnits ?? '—'} teaching units, but raw count must not automatically increase maturity. THI is a deterministic capability/evidence index${score !== null ? `; current packet: ${score}/100${stage ? ` · ${stage}` : ''}` : ''}.\n\nExperience should grow primarily through real owner decisions → settled outcomes → lessons, not question volume. A new graph/cortex capability may affect maturity only after measured improvement in evaluation/coverage/learning under THI policy, not merely because code or answers were added.${experience ? ` Current Experience: ${experience.score}/${experience.max}.` : ''}`,
      topic: 'thi-vs-knowledge-growth',
      sourceArtifacts: artifacts('context', 'graph', 'thi'),
      provenanceClass: 'measured-plus-governance-context'
    });
  }

  function decisionOutcomeAnswer(data, lang) {
    const decisions = safeArray(data.decisions?.decisions);
    const settled = decisions.filter(x => String(x?.outcomeStatus || x?.status || '').toLowerCase().includes('settled')).length;
    const ru = lang === 'ru';
    return result({
      text: ru
        ? `Owner heuristics — DCA, harvest timing, lock extension, HF regime, reward routing, concentration handling — должны проверяться будущими outcomes, а не становиться “уроками” заранее. До outcome нужно сохранить rationale, expected result, criterion, horizon, counterevidence и invalidation conditions.\n\nDecision quality и outcome quality различаются: хорошее решение может дать плохой результат и наоборот. В текущем Decision Ledger видимо ${decisions.length} decision record(s); по прямому status-scan settled: ${settled}. Поэтому настоящий Experience сейчас ценнее наращивать через закрытые Decision→Outcome→Lesson cycles, а не декоративный score.`
        : `Owner heuristics — DCA, harvest timing, lock extension, HF regime, reward routing, concentration handling — should be tested by future outcomes, not promoted into “lessons” in advance. Before an outcome, preserve rationale, expected result, criterion, horizon, counterevidence and invalidation conditions.\n\nDecision quality and outcome quality are distinct: a good decision can have a bad outcome and vice versa. The current Decision Ledger exposes ${decisions.length} decision record(s); a direct status scan finds ${settled} settled. Real Experience is therefore more valuable through closed Decision→Outcome→Lesson cycles than through another decorative score.`,
      topic: 'decision-outcome-learning',
      sourceArtifacts: artifacts('context', 'decisions', 'thi'),
      provenanceClass: 'learning-contract'
    });
  }

  function coverageGapAnswer(data, lang) {
    const gaps = unique([
      ...safeArray(data.events?.coverageGaps).map(x => typeof x === 'string' ? x : x?.id || x?.name || x?.summary),
      ...safeArray(data.events?.coverage?.gaps).map(x => typeof x === 'string' ? x : x?.id || x?.name || x?.summary),
      ...collectNamedArrays(data.context?.sources, 'openQuestions').map(x => typeof x === 'string' ? x : x?.topic)
    ], 30);
    const ru = lang === 'ru';
    return result({
      text: ru
        ? `Запрошенное полное покрытие сейчас не доказано, поэтому я не буду изображать его существующим. В доступных canonical packets explicit gaps/open items включают: ${gaps.slice(0, 12).join(', ') || 'полный requested time series / attribution отсутствует как подтверждённая capability'}.\n\nОсобенно нельзя выдумывать полную protocol-volume history, daily concentration history, universal fee→company-cash-flow attribution, полный historical index feed или offchain holdings владельцев. Для каждого нужен отдельный canonical source/collector/provenance path.`
        : `The requested complete coverage is not proven, so I will not pretend it exists. Explicit gaps/open items in the available canonical packets include: ${gaps.slice(0, 12).join(', ') || 'the requested full time series / attribution is not a verified capability'}.\n\nIn particular, the system must not invent complete protocol-volume history, daily concentration history, universal fee→company-cash-flow attribution, a full historical index feed, or owners’ offchain holdings. Each requires its own canonical source/collector/provenance path.`,
      confidence: 'unknown',
      topic: 'coverage-gap',
      sourceArtifacts: artifacts('events', 'context', 'graph'),
      provenanceClass: 'known-unknown'
    });
  }

  function authorityAnswer(data, lang) {
    const ru = lang === 'ru';
    return result({
      text: ru
        ? 'Нет. Owner context и Intelligence Graph — read-only reasoning context. Они не могут ребалансировать капитал, продавать активы, менять THI policy, повышать candidate edge до causal без evidence или подписывать транзакции. Execution authority = NONE. Любая production policy/methodology/code mutation и любое capital action остаются за отдельной human authorization/governance boundary.'
        : 'No. Owner context and the Intelligence Graph are read-only reasoning context. They cannot rebalance capital, sell assets, change THI policy, promote a candidate edge to causal without evidence, or sign transactions. Execution authority = NONE. Any production policy/methodology/code mutation and any capital action remain behind separate human authorization/governance boundaries.',
      confidence: 'measured',
      topic: 'authority-safety',
      sourceArtifacts: artifacts('context', 'overlay', 'graph'),
      provenanceClass: 'governance-boundary'
    });
  }

  function answer(kind, data, lang) {
    if (kind === 'owner-context') return ownerContextAnswer(data, lang);
    if (kind === 'metric-discovery') return metricDiscoveryAnswer(data, lang);
    if (kind === 'graph-relationships') return graphRelationshipAnswer(data, lang);
    if (kind === 'causal-proof') return causalProofAnswer(data, lang);
    if (kind === 'tvl-cashflow') return tvlCashflowAnswer(data, lang);
    if (kind === 'protocol-economics') return protocolEconomicsAnswer(data, lang);
    if (kind === 'health-factor') return healthFactorAnswer(data, lang);
    if (kind === 'lock-aware') return lockAwareAnswer(data, lang);
    if (kind === 'rwa') return rwaAnswer(data, lang);
    if (kind === 'ideal-company') return idealCompanyAnswer(data, lang);
    if (kind === 'news-salience') return newsSalienceAnswer(data, lang);
    if (kind === 'thi-vs-knowledge') return thiKnowledgeAnswer(data, lang);
    if (kind === 'decision-outcome') return decisionOutcomeAnswer(data, lang);
    if (kind === 'coverage-gap') return coverageGapAnswer(data, lang);
    if (kind === 'authority') return authorityAnswer(data, lang);
    return null;
  }

  function makeMessage(kind, text, source = '') {
    const messages = document.getElementById('messages');
    if (!messages) return null;
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

  function applyContract(box, response, lang) {
    if (!box) return;
    box.dataset.answerContractVersion = CONTRACT_VERSION;
    box.dataset.answerConfidenceClass = response.confidence;
    box.dataset.answerTopic = response.topic;
    box.dataset.answerGrounded = response.grounded ? 'true' : 'false';
    box.dataset.answerSourceArtifacts = safeArray(response.sourceArtifacts).join('|');
    box.dataset.answerProvenanceClass = response.provenanceClass;
    box.dataset.answerCortexVersion = VERSION;
    box.dataset.answerLanguage = lang;
  }

  async function handle(raw, kind) {
    const lang = /[а-яё]/i.test(raw) ? 'ru' : 'en';
    const input = document.getElementById('question');
    const button = document.getElementById('askButton');
    if (input) input.value = '';
    if (button) button.disabled = true;
    makeMessage('user', raw);
    const pending = makeMessage('system', lang === 'ru' ? 'Проверяю Owner Intelligence Graph…' : 'Checking the Owner Intelligence Graph…', 'Owner Context · loading');
    pending?.classList.add('pending');

    try {
      const data = await load();
      const response = answer(kind, data, lang);
      if (!response) throw new Error(`Unhandled cortex topic: ${kind}`);
      pending?.classList.remove('pending');
      const spans = pending?.querySelectorAll('span');
      if (spans?.[1]) spans[1].textContent = response.text;
      const source = pending?.querySelector('.source');
      if (source) source.textContent = `Owner Intelligence Cortex · ${response.provenanceClass}`;
      applyContract(pending, response, lang);
    } catch (error) {
      pending?.classList.remove('pending');
      const spans = pending?.querySelectorAll('span');
      if (spans?.[1]) spans[1].textContent = lang === 'ru'
        ? 'Owner Intelligence Context сейчас не прошёл structural/binding validation. Я не буду подменять его догадкой.'
        : 'Owner Intelligence Context did not pass structural/binding validation. I will not replace it with a guess.';
      const source = pending?.querySelector('.source');
      if (source) source.textContent = 'Owner Intelligence Cortex · fail-closed';
      applyContract(pending, {
        confidence: 'unknown',
        topic: kind || 'owner-context-unavailable',
        grounded: false,
        sourceArtifacts: [],
        provenanceClass: 'fail-closed'
      }, lang);
      console.warn('[The Holding Owner Intelligence Cortex]', error);
    } finally {
      if (input) input.focus();
    }
  }

  function boot() {
    const form = document.getElementById('askForm');
    const input = document.getElementById('question');
    if (!form || !input) return;

    // Capture phase is intentional. safety.js is loaded first and registers its
    // own capture guard before this module. If Safety blocks the prompt, this
    // handler never receives it. If Cortex handles a bounded owner/graph topic,
    // it stops the normal app router so two answers cannot be emitted.
    form.addEventListener('submit', event => {
      const raw = input.value.trim();
      if (!raw) return;
      const kind = classify(raw);
      if (!kind) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      void handle(raw, kind);
    }, true);

    // Warm read-only context after page load, but fail silently. A question will
    // re-attempt and fail closed with a visible answer if canonical state is bad.
    void load().catch(() => null);
    window.HoldingOwnerIntelligenceCortex = Object.freeze({
      version: VERSION,
      classify,
      authority: Object.freeze({ executable: false, executionAuthority: 'none' })
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();