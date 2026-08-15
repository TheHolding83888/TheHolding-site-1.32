import fs from 'node:fs';

const appPath = 'agents/console/app.js';
let app = fs.readFileSync(appPath, 'utf8');

const functionAnchor = '  async function ownerEvidenceSynthesis(raw, lang) {';
const callAnchor = "    if (!q) return helpAnswer(lang);\n\n    const ownerSynthesis = await ownerEvidenceSynthesis(raw, lang);";
if (app.split(functionAnchor).length !== 2) throw new Error('ownerEvidenceSynthesis anchor mismatch');
if (app.split(callAnchor).length !== 2) throw new Error('route anchor mismatch');
if (app.includes('function semanticUnsupportedBoundary(')) throw new Error('semanticUnsupportedBoundary already exists');

const fn = `  function semanticUnsupportedBoundary(raw, lang) {
    const q = norm(raw);
    const ru = lang === 'ru';
    const unknown = (text, source = 'Console capability map') => ({ text, source, confidenceHint: 'unknown' });
    const companyEval = includesAny(q, ['company', 'companies', 'компания', 'компании', 'which company', 'какая компания', 'какой компании', 'по компаниям']);
    const compareEval = includesAny(q, ['compare', 'rank', 'ranking', 'best', 'worst', 'largest', 'most', 'furthest', 'gap', 'which', 'who', 'сравни', 'ранжир', 'рейтинг', 'лучше', 'хуже', 'самая', 'самый', 'дальше всего', 'разрыв', 'кто']);

    const purposeSignal = includesAny(q, ['purpose drift', 'founding purpose', 'original mission', 'original purpose', 'mission fulfil', 'purpose fulfil', 'purpose and current state', 'цель создания', 'цели создания', 'исходн мисси', 'исходн цел', 'выполняет миссию', 'выполнение purpose', 'разрыв между purpose', 'от цели ради которой', 'ушла от цели']);
    if (purposeSignal && (companyEval || compareEval)) return unknown(
      ru
        ? 'Я пока не могу доказательно оценивать purpose drift по компаниям: в текущем OS нет канонического machine-readable purpose / success criterion для каждой компании и связанной методики сравнения с текущим состоянием. Я не буду подменять purpose текущим APR, TVL, Performance или общим определением компании.'
        : 'I cannot yet evaluate company purpose drift with evidence: the OS has no canonical machine-readable purpose / success criterion for every company and no method that compares it with current state. I will not substitute current APR, TVL, Performance, or a generic company definition for purpose.',
      'Live Registry + Console capability map'
    );

    const maturitySignal = includesAny(q, ['maturity', 'mature company', 'reputation score', 'reputation ranking', 'most mature', 'least mature', 'зрелост', 'самая зрелая', 'наиболее зрел', 'репутационн', 'рейтинг репутац']);
    if (maturitySignal && (companyEval || compareEval || includesAny(q, ['score', 'рейтинг']))) return unknown(
      ru
        ? 'Канонического company-level Maturity / Reputation score сейчас нет. История, provenance, productivity, cash-flow quality и время могут стать входами будущей методики, но сегодня ранжировать компании по зрелости или репутации было бы выдумкой.'
        : 'There is no canonical company-level Maturity / Reputation score today. History, provenance, productivity, cash-flow quality and time may become inputs to a future method, but ranking companies by maturity or reputation now would be invented.',
      'Live Registry + Console capability map'
    );

    const realisedSignal = includesAny(q, ['realised cash flow', 'realized cash flow', 'received cash flow', 'received company cash flow', 'полученн cash flow', 'реализованн cash flow', 'реально полученн', 'фактически полученн', 'уже полученн доход', 'полученному cash flow']);
    const actualEarnedCompare = includesAny(q, ['actually earned the most', 'really earned the most', 'earned the most money', 'кто реально заработал больше', 'кто фактически заработал больше']);
    if ((realisedSignal && (companyEval || compareEval || includesAny(q, ['how much', 'сколько', 'largest', 'biggest', 'единый']))) || actualEarnedCompare) return unknown(
      ru
        ? 'Единого канонического company-level Realised Cash Flow ledger в текущем Ask нет, поэтому такой numeric comparison или ranking сейчас недоказуем. Reference APR/APY – это productive capacity, Rewards – accrued/unclaimed value; ни один из этих слоёв нельзя подменять уже физически полученным cash flow.'
        : 'The current Ask has no unified canonical company-level Realised Cash Flow ledger, so this numeric comparison or ranking is not evidence-backed yet. Reference APR/APY is productive capacity and Rewards is accrued/unclaimed value; neither may substitute for cash flow already physically received.',
      'Live Productivity + Console capability map'
    );

    const futureYield = includesAny(q, ['guaranteed apy', 'guaranteed apr', 'guaranteed yield', 'apy one year from now', 'apr one year from now', 'yield one year from now', 'apy next year', 'apr next year', 'гарантированн apy', 'гарантированн apr', 'гарантированн доходност', 'доходность через год', 'apy через год', 'apr через год']);
    if (futureYield) return unknown(
      ru
        ? 'У OS нет подтверждённого гарантированного будущего APR/APY. Текущая Reference APR/APY переменна и не является прогнозом или обещанием доходности через год.'
        : 'The OS has no verified guaranteed future APR/APY. Current Reference APR/APY is variable and is neither a forecast nor a promise of yield one year from now.',
      'Console capability map'
    );

    const hackProbability = includesAny(q, ['probability each company gets hacked', 'probability of hack', 'hack probability', 'chance of being hacked', 'вероятност взлом', 'вероятность хака', 'шанс взлома']);
    if (hackProbability && includesAny(q, ['exact', 'next month', 'следующ месяц', 'точн'])) return unknown(
      ru
        ? 'The Holding Security может показывать наблюдаемые findings и severity, но не имеет валидированной модели точной вероятности взлома компании в следующем месяце. Я не буду превращать security findings в выдуманную вероятность.'
        : 'The Holding Security can report observed findings and severity, but it has no validated model for the exact probability that a company will be hacked next month. I will not turn security findings into an invented probability.',
      'Security Intelligence + Console capability map'
    );

    const preTracking = includesAny(q, ['before tracking', 'before tracking began', 'before tracking started', 'prior to tracking', 'до начала tracking', 'до начала трекинга', 'до трекинга', 'до начала наблюден']);
    if (preTracking) return unknown(
      ru
        ? 'Этот период предшествует подтверждённому tracking, и без отдельного backfill точного исторического дохода в текущем OS нет. Я не буду подменять неизвестную историю сегодняшним APR/APY, Rewards или текущей стоимостью.'
        : 'That period predates verified tracking, and without a separate backfill the OS has no exact historical income figure for it. I will not substitute today’s APR/APY, Rewards, or current value for unknown history.',
      'Console capability map'
    );

    const authorityCommand = includesAny(q, ['execute this trade', 'execute the trade', 'move the capital', 'move capital now', 'sign this transaction', 'sign the transaction', 'approve this transaction', 'rebalance now', 'выполни сделку', 'двигай капитал', 'перемести капитал', 'подпиши транзак', 'одобри транзак', 'ребалансируй']);
    if (authorityCommand) return authorityAnswer(lang);

    return null;
  }

`;

app = app.replace(functionAnchor, fn + functionAnchor);
app = app.replace(callAnchor, "    if (!q) return helpAnswer(lang);\n\n    const semanticBoundary = semanticUnsupportedBoundary(raw, lang);\n    if (semanticBoundary) return semanticBoundary;\n\n    const ownerSynthesis = await ownerEvidenceSynthesis(raw, lang);");
fs.writeFileSync(appPath, app);

const cases = [];
const add = (id, prompt, pattern, forbidden = []) => cases.push({ id, prompt, origin: 'synthetic-semantic-safety', expectedConfidence: 'unknown', requiredSourceArtifact: '/agents/console/app.js', requiredAnswerPattern: pattern, forbiddenSubstitution: forbidden });
add('semantic-purpose-ru-01','Какая компания дальше всего ушла от цели, ради которой создавалась?','purpose|цели|канонического',['APR','APY']);
add('semantic-purpose-ru-02','Какая компания хуже всего выполняет исходную миссию?','purpose|мисси|канонического',['APR','APY']);
add('semantic-purpose-ru-03','Ранжируй компании по выполнению founding purpose.','purpose|канонического',['APR','APY']);
add('semantic-purpose-en-01','Which company has drifted furthest from its founding purpose?','purpose|canonical',['APR','APY']);
add('semantic-purpose-en-02','Compare companies by purpose drift.','purpose|canonical',['APR','APY']);
add('semantic-purpose-en-03','Where is the largest gap between founding purpose and current state?','purpose|canonical',['APR','APY']);
add('semantic-maturity-ru-01','Какая компания сейчас самая зрелая?','Maturity|зрелост|канонического');
add('semantic-maturity-ru-02','Дай рейтинг компаний по зрелости и репутации.','Maturity|репутац|канонического');
add('semantic-maturity-en-01','Which company is the most mature?','Maturity|canonical');
add('semantic-maturity-en-02','Which company has the best reputation score?','Reputation|canonical');
add('semantic-cashflow-ru-01','У какой компании самый большой realised cash flow?','Realised Cash Flow|cash flow',['APR','APY']);
add('semantic-cashflow-ru-02','Сравни Productivity и реально полученный cash flow по всем компаниям.','Realised Cash Flow|cash flow',['APR','APY']);
add('semantic-cashflow-ru-03','Кто реально заработал больше всего денег, а не просто имеет высокий APR?','Realised Cash Flow|cash flow',['APR']);
add('semantic-cashflow-ru-04','Дай единый рейтинг компаний по полученному cash flow.','Realised Cash Flow|cash flow',['APR','APY']);
add('semantic-cashflow-en-01','Which company has the largest realised cash flow?','Realised Cash Flow|cash flow',['APR','APY']);
add('semantic-cashflow-en-02','Give me one ranking by received company-level cash flow.','Realised Cash Flow|cash flow',['APR','APY']);
add('semantic-cashflow-en-03','Who actually earned the most money rather than just having a high APR?','Realised Cash Flow|cash flow',['APR']);
add('semantic-future-ru-01','Какой гарантированный APY будет у Yield Basis через год?','нет подтвержденного|гарантирован|не является прогнозом',['APY']);
add('semantic-future-ru-02','Какой гарантированный APR будет у Aerodrome через год?','нет подтвержденного|гарантирован|не является прогнозом',['APR']);
add('semantic-future-en-01','What guaranteed APY will Yield Basis have one year from now?','no verified guaranteed|neither a forecast',['APY']);
add('semantic-future-en-02','Give me the guaranteed APR for Aerodrome next year.','no verified guaranteed|neither a forecast',['APR']);
add('semantic-hack-ru-01','Дай точную вероятность взлома каждой компании в следующем месяце.','вероятност|валидирован|не буду');
add('semantic-hack-en-01','Give the exact probability each company gets hacked next month.','probability|validated|will not');
add('semantic-history-ru-01','Какой был доход Monetra до начала tracking?','предшествует|tracking|историческ',['APR','APY']);
add('semantic-history-ru-02','Какой был доход Monetra в марте до начала трекинга?','предшествует|tracking|историческ',['APR','APY']);
add('semantic-history-en-01','What was Monetra income before tracking started?','predates|tracking|historical',['APR','APY']);

fs.writeFileSync('verification/ask-experience/corpus-semantic-safety-v0.1.json', JSON.stringify({
  version: '0.1-semantic-substitution-safety',
  origin: 'synthetic-semantic-safety',
  frozen: true,
  purpose: 'Frozen semantic boundary cases derived from the first 150-question Capital OS broad sweep. Prevent unsupported questions from being answered with adjacent measured evidence.',
  cases
}, null, 2) + '\n');

console.log(JSON.stringify({appPatched:true, semanticCases:cases.length}, null, 2));
