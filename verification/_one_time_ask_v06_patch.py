from pathlib import Path
import re

p = Path('agents/console/app.js')
a = Path('agents/index.html')
s = p.read_text(encoding='utf-8')
page = a.read_text(encoding='utf-8')

def one(old, new, label):
    global s
    n = s.count(old)
    if n != 1:
        raise SystemExit(f'{label}: expected 1 anchor, got {n}')
    s = s.replace(old, new, 1)

one("    embedded: '/companies/embedded-yield-data.json',\n    entries: '/companies/strategy-entry-ledger.json',",
    "    embedded: '/companies/embedded-yield-ledger.json',\n    entries: '/companies/company-008-strategy-entry-ledger.json',", 'ledger urls')
one("    ['Intelligence', '/agents/']\n  ]);", "    ['Intelligence', '/agents/'],\n    ['Manifesto', '/manifesto']\n  ]);", 'manifesto source')
one("  function confidenceForAnswer(result) {\n    const text = norm(result?.text);", "  function confidenceForAnswer(result) {\n    if (CONFIDENCE_CLASSES.includes(result?.confidenceHint)) return result.confidenceHint;\n    const text = norm(result?.text);", 'confidence hint')

one("  const norm = text => String(text || '')\n    .toLowerCase()",
    "  const norm = text => String(text || '')\n    .replace(/\\bholdng\\b/gi, 'holding')\n    .replace(/\\brewads\\b/gi, 'rewards')\n    .replace(/\\bcmpare\\b/gi, 'compare')\n    .replace(/\\b1milliondolar\\b/gi, '1milliondollar')\n    .replace(/\\bраскажи\\b/gi, 'расскажи')\n    .replace(/\\bапи\\b/gi, 'apy')\n    .replace(/\\bщас\\b/gi, 'сейчас')\n    .toLowerCase()", 'lexical normalization')

one("      'Monetra.eth': ['monetra', 'монетра'],", "      'Monetra.eth': ['monetra', 'монетра', 'монетру', 'монетре', '008', 'company 008', 'компания 008'],", 'Monetra aliases')
one("      '1milliondollar.eth': ['1milliondollar', '1 million dollar', 'milliondollar']", "      '1milliondollar.eth': ['1milliondollar', '1 million dollar', 'milliondollar', 'million dollar eth', '009', 'company 009', 'компания 009']", '009 aliases')

one("  function registryAnswer(lang) {\n    const names = state.registry.map(x => x.name);\n    state.lastTopic = 'registry';", "  function registryAnswer(lang) {\n    const names = state.registry.map(x => x.name);\n    state.lastTopic = 'registry';\n    state.lastEntity = { kind: 'registry' };", 'registry context')
one("    if (state.lastEntity.kind === 'company') {", "    if (['company', 'stable-company'].includes(state.lastEntity.kind)) {", 'stable followup')
one("      if (includesAny(q, ['entry', 'точка входа', 'цена входа', 'покупк'])) return entryAnswer(query, lang, company);", "      if (includesAny(q, ['entry', 'точка входа', 'цена входа', 'покупк'])) return entryAnswer(query, lang, company);\n      if (includesAny(q, ['доходност', 'apr', 'apy', 'yield', 'productivity', 'продуктивност'])) {\n        if (company.name === 'Monetra.eth' && state.stable?.summary) return stableSummary(lang);\n        return companyAnswer(company, lang, query);\n      }", 'company yield followup')
one("    if (!state.lastEntity || protocolGroup(query) || findCompany(query)) return null;", "    if (state.lastEntity?.kind === 'registry' && includesAny(q, ['list them', 'перечисли', 'список', 'show them'])) return registryAnswer(lang);\n    if (!state.lastEntity || protocolGroup(query) || findCompany(query)) return null;", 'registry followup')

one("  async function entryAnswer(query, lang, company) {\n    const data = await loadLazy('entries');", "  async function entryAnswer(query, lang, company) {\n    if (company?.name && company.name !== 'Monetra.eth') return { text: lang === 'ru' ? `Для ${company.name} нет отдельного подтверждённого Strategy Entry Ledger в текущем Ask.` : `The current Ask has no separate verified Strategy Entry Ledger for ${company.name}.`, source: 'Strategy Entry Ledger unavailable', confidenceHint: 'unknown' };\n    const data = await loadLazy('entries');", 'entry scope')

one("    const best = results.filter(x => x.score >= 3).slice(0, 2);", "    const best = results.filter(x => x.score >= 6 && tokens.filter(token => norm(x.block).includes(token)).length >= 2).slice(0, 2);", 'public threshold')
one("      source: `Public site knowledge · ${best.map(x => x.url).join(' · ')}`\n    };", "      source: `Public site knowledge · ${best.map(x => x.url).join(' · ')}`,\n      confidenceHint: 'partial'\n    };", 'public confidence')

anchor = "  async function routeQuestion(raw) {\n"
if s.count(anchor) != 1:
    raise SystemExit('route anchor invalid')
helpers = r'''  function trustIntentAnswer(q, lang) {
    if (includesAny(q, ['private key', 'seed phrase', 'recovery phrase', 'приватн ключ', 'сид фраз', 'секретн ключ'])) return {
      text: lang === 'ru' ? 'Я не раскрываю и не ищу private keys, seed/recovery phrases или другие секреты. The Holding OS не должен выдавать такие данные через Ask.' : 'I will not reveal or search for private keys, seed/recovery phrases or other secrets. The Holding OS must not expose such data through Ask.',
      source: 'The Holding project canon'
    };
    if (includesAny(q, ['move my capital', 'move capital', 'двигать капитал', 'sign transaction', 'подписать транзак', 'execute trade', 'who has authority', 'кто имеет полномочия', 'authority right now'])) return authorityAnswer(lang);
    if (includesAny(q, ['exact allocation', 'what should i buy', 'buy today', 'точн аллокац', 'что купить', 'купить сегодня'])) return {
      text: lang === 'ru' ? 'The Holding показывает структуры, evidence и trade-offs, но не выдаёт персональную точную аллокацию или команду «что купить сегодня». Решение остаётся за владельцем.' : 'The Holding can show structures, evidence and trade-offs, but it does not provide a personalized exact allocation or tell an owner what to buy today. The decision remains with the owner.',
      source: 'The Holding project canon'
    };
    if (includesAny(q, ['sharpe', 'коэффициент шарпа'])) return { text: lang === 'ru' ? 'В текущих подтверждённых данных нет Sharpe ratio под этот период. Я не буду подменять его текущим APY или APR.' : 'The current verified data has no Sharpe ratio for that period. I will not substitute current APY or APR for it.', source: 'No sufficiently strong verified match', confidenceHint: 'unknown' };
    if (includesAny(q, ['next friday', 'следующ пятниц', 'forecast', 'predict', 'прогноз'])) return { text: lang === 'ru' ? 'У The Holding нет подтверждённого будущего значения цены. Я не буду выдавать прогноз как факт.' : 'The Holding has no verified future price value. I will not present a forecast as a fact.', source: 'No sufficiently strong verified match', confidenceHint: 'unknown' };
    if (includesAny(q, ['before tracking', 'до начала наблюден', 'march 2026', 'март 2026'])) return { text: lang === 'ru' ? 'Если период предшествует tracking и не был backfilled, точного дохода в текущих данных нет. Я не буду подменять его сегодняшней доходностью.' : 'If the period predates tracking and was not backfilled, the current data has no exact income figure. I will not substitute today’s yield.', source: 'No sufficiently strong verified match', confidenceHint: 'unknown' };
    if ((includesAny(q, ['reference apr', 'apr']) && includesAny(q, ['performance', 'прибыл', 'profit', 'equal', 'равно'])) || includesAny(q, ['does that mean it performed better'])) return { text: lang === 'ru' ? 'Нет. Reference APR – текущая доходная способность. Performance – фактический результат относительно точки входа. Более высокий APR сейчас не доказывает лучшую историческую performance.' : 'No. Reference APR is current earning capacity. Performance is the actual result versus the entry point. A higher APR now does not prove better historical performance.', source: 'The Holding project canon' };
    if (includesAny(q, ['каждое наблюдение становится предложением', 'does every observation become a proposal', 'every observation become a proposal'])) return whyFilteredAnswer(lang);
    if (includesAny(q, ['как система понимает что решение было хорошим', 'how does the system know a decision was good', 'decision outcome'])) return { text: lang === 'ru' ? 'Learning связывает case с решением владельца, ждёт более позднее observation/outcome и только затем формирует lesson, если появилось реальное последующее доказательство.' : 'Learning binds a case to the owner decision, waits for a later observation/outcome, and only forms a lesson when real later evidence exists.', source: 'Live Decision & Outcome Learning' };
    return null;
  }

'''
s = s.replace(anchor, helpers + anchor, 1)

one("    if (/^(привет|здравств|хай|hello|hi|hey)\\b/.test(q) || includesAny(q, ['как дела', 'how are you'])) return greetingAnswer(lang, q);\n    if (includesAny(q, ['помощ', 'help', 'что спросить', 'что умеешь', 'what can you do'])) return helpAnswer(lang);", "    if (/^(привет|здравств|хай|hello|hi|hey|gm)\\b/.test(q) || includesAny(q, ['как дела', 'how are you'])) return greetingAnswer(lang, q);\n    if (includesAny(q, ['помощ', 'help', 'что спросить', 'что умеешь', 'what can you do'])) return helpAnswer(lang);\n\n    const trust = trustIntentAnswer(q, lang);\n    if (trust) return trust;", 'trust route')
one("    if (includesAny(q, ['что система предлагает', 'что предлагаешь', 'proposal', 'recommendation', 'recommend', 'что делать дальше'])) return proposalAnswer(lang);", "    if (includesAny(q, ['что система предлагает', 'что холдинг предлагает', 'что предлагаешь', 'proposal', 'propose', 'proposes', 'what does the holding propose', 'what does the system propose', 'recommendation', 'что делать дальше'])) return proposalAnswer(lang);", 'proposal synonyms')
one("    if (includesAny(q, ['чему система учится', 'как система учится', 'learning status', 'learning now'])) return learningAnswer(lang);", "    if (includesAny(q, ['чему система учится', 'чему os научилась', 'чему система научилась', 'как система учится', 'learning status', 'learning now', 'what has the os learned', 'what has the system learned'])) return learningAnswer(lang);", 'learning synonyms')

marker = "    const publicHit = await searchPublicKnowledge(raw, lang);\n"
if s.count(marker) != 1:
    raise SystemExit('public fallback anchor invalid')
exact = r'''    if (includesAny(q, ['company companion', 'companion agent', 'агент куратор', 'агент-куратор'])) return { text: lang === 'ru' ? 'Company Companion Agent – будущий AI-куратор одной onchain-компании. Он наследует общие способности The Holding OS и добавляет память, состояние, решения и риски конкретной компании. Сам по себе Companion не получает права подписывать транзакции или двигать капитал.' : 'A Company Companion Agent is a future AI curator for one onchain company. It inherits shared The Holding OS capabilities and adds that company’s memory, state, decisions and risks. A Companion does not automatically receive transaction-signing or capital authority.', source: 'The Holding project canon' };
    if (includesAny(q, ['company marketplace', 'marketplace', 'биржа компаний'])) return { text: lang === 'ru' ? 'Company Marketplace – будущий слой discovery и передачи зрелых onchain-компаний или их структур, когда identity, history, transferability, security и юридическая форма будут достаточно зрелыми.' : 'The Company Marketplace is a future discovery and transfer layer for mature onchain companies or company structures once identity, history, transferability, security and legal design are sufficiently mature.', source: 'The Holding project canon' };
    if (includesAny(q, ['ratings', 'rating', 'рейтин'])) return { text: lang === 'ru' ? 'Рейтинги компаний задуманы как производная от проверяемой истории – прозрачности, возраста, устойчивости, productivity, концентрации риска, полноты reporting и maturity, а не популярности.' : 'Company ratings are intended to emerge from verifiable history – transparency, age, resilience, productivity, risk concentration, reporting completeness and maturity, not popularity.', source: 'The Holding project canon' };

'''
s = s.replace(marker, exact + marker, 1)

if page.count('/agents/console/app.js?v=0.5') != 1:
    raise SystemExit('Ask v0.5 asset anchor invalid')
page = page.replace('/agents/console/app.js?v=0.5', '/agents/console/app.js?v=0.6', 1)

for required in ['/companies/embedded-yield-ledger.json', '/companies/company-008-strategy-entry-ledger.json', "confidenceHint: 'partial'", 'function trustIntentAnswer', 'Company Companion Agent']:
    if required not in s:
        raise SystemExit('missing marker: ' + required)
if 'embedded-yield-data.json' in s or "'/companies/strategy-entry-ledger.json'" in s:
    raise SystemExit('stale ledger binding remains')
if page.count('/agents/console/app.js?v=0.6') != 1 or page.count('/agents/console/safety.js?v=0.1') != 1:
    raise SystemExit('asset contract mismatch')

p.write_text(s, encoding='utf-8')
a.write_text(page, encoding='utf-8')
print('Ask v0.6 Trust & Intent Precision patch PASS')
