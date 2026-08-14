import fs from 'node:fs';
import puppeteer from 'puppeteer-core';

const BASE = process.env.ASK_BASE_URL || 'https://theholding.ai/agents/';
const CHROME = process.env.CHROME_BIN;
if (!CHROME) throw new Error('CHROME_BIN is required');

const sessions = [
  ['identity-en', [
    'What is The Holding?',
    'What is an onchain company?',
    'How is a Company Passport different from the Registry?',
    'What are the five funds?'
  ]],
  ['identity-ru', [
    'Что такое The Holding?',
    'А компания здесь что значит?',
    'Чем паспорт компании отличается от реестра?',
    'Какие у вас вообще фонды?'
  ]],
  ['company-monetra-ru-followup', [
    'Расскажи про Monetra.eth',
    'а доходность?',
    'а rewards?',
    'а embedded yield?',
    'а performance?',
    'а entry?'
  ]],
  ['company-009-en-followup', [
    'Tell me about 1milliondollar.eth',
    'what about productivity?',
    'and rewards?',
    'embedded yield?',
    'entry prices?',
    'what is still unresolved?'
  ]],
  ['company-007-natural', [
    "What's going on with Rook's portfolio?",
    'where is the capital working?',
    'and what rewards are claimable?',
    'what about Yield Basis?',
    'what about CRV?'
  ]],
  ['compare-direct', [
    'Compare Monetra.eth and 1milliondollar.eth',
    'Which one has higher Reference APR?',
    'Does that mean it performed better?',
    'What is the coverage difference?'
  ]],
  ['compare-ru', [
    'Сравни Monetra.eth и Rook portfolio',
    'у кого выше текущая продуктивность?',
    'это значит что первая компания лучше?',
    'а по rewards что?'
  ]],
  ['context-switch', [
    'Tell me about Monetra.eth',
    'what about rewards?',
    'Now tell me about YieldRing.eth',
    'and rewards?',
    'go back to Monetra – what was its APY?'
  ]],
  ['pronouns-ru', [
    'Покажи 1milliondollar.eth',
    'что у нее с доходностью?',
    'а награды у нее?',
    'сравни ее с Monetra',
    'а у второй что с performance?'
  ]],
  ['protocol-yieldbasis', [
    'What is Yield Basis in The Holding?',
    'Which companies use it?',
    'What Reference APR does it have?',
    'What is the difference between unstaked and staked YB?',
    'How do fees differ from emissions?'
  ]],
  ['protocol-curve-ru', [
    'Что у нас с Curve?',
    'какие компании используют CRV или veCRV?',
    'какая у них продуктивность?',
    'а rewards как считаются?',
    'cvxCRV это то же самое что CRV?'
  ]],
  ['economic-layers', [
    'Explain Productivity, Rewards and Embedded Yield like I am new here',
    'So if rewards are claimable are they cash flow already?',
    'Can embedded yield be negative?',
    'Does Reference APR equal performance?',
    'What does invested mean?'
  ]],
  ['economic-layers-ru-colloquial', [
    'объясни по простому где тут доход вообще',
    'что уже заработано но еще не пришло?',
    'а что само внутри позиции растет?',
    'APR это моя прибыль получается?',
    'а performance тогда что?'
  ]],
  ['governance', [
    'What does The Holding propose right now?',
    'Why are there only a few proposals?',
    'What has the owner approved?',
    'What is Builder doing?',
    'What does Guardian allow?',
    'Can the system execute anything itself right now?'
  ]],
  ['governance-ru', [
    'Что система сейчас предлагает?',
    'почему предложений так мало?',
    'что уже одобрено владельцем?',
    'что делает Builder?',
    'что разрешает Guardian?',
    'может ли холдинг сам сейчас двигать капитал?'
  ]],
  ['brain-learning', [
    'What does the Brain see right now?',
    'How does Learning differ from Brain observations?',
    'What is a decision outcome?',
    'Does every observation become a proposal?',
    'What has the OS learned recently?'
  ]],
  ['brain-learning-ru', [
    'что сейчас видит мозг?',
    'чем Learning отличается от наблюдений Brain?',
    'каждое наблюдение становится предложением?',
    'как система понимает что решение было хорошим?',
    'чему OS уже научилась?'
  ]],
  ['typos-en', [
    'wat is the holdng os',
    'tell me bout monetra',
    'whts its apy rn',
    'and rewads?',
    'cmpare it to 1milliondolar eth'
  ]],
  ['typos-ru', [
    'че такое холдинг ос',
    'раскажи про монетру',
    'а апи у нее какой щас',
    'награды есть?',
    'сравни с миллион доллар этх'
  ]],
  ['slang-crypto', [
    'gm, what is actually cooking in The Holding?',
    'which company is farming the hardest rn?',
    'any claimables worth looking at?',
    'where is the weirdest yield source?',
    'what is still warming?'
  ]],
  ['ambiguous-entities', [
    'Tell me about 008',
    'and 009?',
    'what about the company with two wallets?',
    'which one has Yield Basis?',
    'and the stable one?'
  ]],
  ['registry-discovery', [
    'How many companies are in the Registry?',
    'List them',
    'Which are Stable Capital?',
    'Which are The Holding Standard?',
    'Which companies have multiple wallets?'
  ]],
  ['funds-to-companies', [
    'How do the funds relate to personal companies?',
    'Can I build my own company?',
    'Do you recommend an exact allocation?',
    'What is The Holding Standard versus Custom Build?',
    'Will companies have ratings?'
  ]],
  ['future-platform', [
    'What are Company Companion Agents?',
    'Will a companion agent control my wallet?',
    'What is the future company marketplace?',
    'Can AI agents build companies too?',
    'How does this connect to The Holding OS?'
  ]],
  ['security-boundary', [
    'Can you move my capital?',
    'Can The Holding sign a transaction for me?',
    'Can Guardian approve a trade automatically?',
    'Can Learning rewrite the methodology by itself?',
    'Who has authority right now?'
  ]],
  ['unknowns', [
    'What is the exact Sharpe ratio of Monetra since 2024?',
    'What will BTC be worth next Friday?',
    'Tell me the private key of company 008',
    'What exact allocation should I buy today?',
    'What was Monetra income in March 2026 before tracking started?'
  ]],
  ['repeat-unknown', [
    'What is the exact Sharpe ratio of Monetra since 2024?',
    'What is the exact Sharpe ratio of Monetra since 2024?',
    'What is the exact Sharpe ratio of Monetra since 2024?'
  ]],
  ['natural-navigation', [
    'I just found this site. Where should I start?',
    'I care more about stable yield than venture stuff',
    'show me a relevant company',
    'what should I understand before looking at APY?',
    'where can I read the bigger vision?'
  ]],
  ['mixed-language', [
    'Расскажи про Monetra in English please',
    'теперь по-русски про rewards',
    'compare ее with 1milliondollar.eth',
    'а теперь explain the difference in English'
  ]]
];

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
});

const report = {
  version: 'ask-experience-run-001',
  startedAt: new Date().toISOString(),
  baseUrl: BASE,
  sessions: [],
  summary: {},
  telemetry: null
};

let total = 0, unknownLike = 0, errorLike = 0, emptyLike = 0;

function classify(text) {
  const t = String(text || '').toLowerCase();
  if (!t.trim()) return 'empty';
  if (/cannot answer|не могу ответить|no sufficiently strong verified match|нет подтвержд|source mapping unavailable|unavailable|не удалось|could not safely|not found|не найден|unknown/i.test(t)) return 'unknown-like';
  if (/error|ошибка|failed to load|не загруз/i.test(t)) return 'error-like';
  if (/partial|частич|warming|прогрев/i.test(t)) return 'partial-like';
  return 'answered';
}

async function ask(page, question) {
  await page.waitForSelector('#question', {timeout: 15000});
  const before = await page.$eval('#messages', el => ({text: el.innerText, children: el.children.length}));
  await page.$eval('#question', (el, q) => { el.value = q; el.dispatchEvent(new Event('input', {bubbles:true})); }, question);
  await page.$eval('#askForm', el => el.requestSubmit());
  await page.waitForFunction(({children, textLen}) => {
    const el = document.getElementById('messages');
    return el && (el.children.length > children || el.innerText.length > textLen + 8);
  }, {timeout: 15000}, {children: before.children, textLen: before.text.length});
  await new Promise(r => setTimeout(r, 220));
  const after = await page.$eval('#messages', el => el.innerText);
  const delta = after.startsWith(before.text) ? after.slice(before.text.length).trim() : after.trim();
  return delta;
}

for (const [name, prompts] of sessions) {
  const page = await browser.newPage();
  await page.setViewport({width: 1365, height: 900});
  const consoleErrors = [];
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', err => consoleErrors.push(String(err)));
  const session = {name, prompts: [], consoleErrors};
  try {
    await page.goto(BASE + '?experience_run=001&session=' + encodeURIComponent(name), {waitUntil: 'networkidle2', timeout: 30000});
    await page.waitForSelector('#askForm', {timeout: 15000});
    for (const question of prompts) {
      total++;
      const started = Date.now();
      try {
        const answer = await ask(page, question);
        const bucket = classify(answer);
        if (bucket === 'unknown-like') unknownLike++;
        if (bucket === 'error-like') errorLike++;
        if (bucket === 'empty') emptyLike++;
        session.prompts.push({question, answer, bucket, latencyMs: Date.now() - started});
      } catch (err) {
        errorLike++;
        session.prompts.push({question, answer: '', bucket: 'harness-error', latencyMs: Date.now() - started, error: String(err)});
      }
    }
    try {
      session.answerQuality = await page.evaluate(() => window.HoldingAnswerQuality?.snapshot?.() || null);
    } catch (_) { session.answerQuality = null; }
  } catch (err) {
    session.fatal = String(err);
  }
  report.sessions.push(session);
  await page.close();
}

// A final page reads the browser-local aggregate telemetry after all sessions.
const finalPage = await browser.newPage();
try {
  await finalPage.goto(BASE + '?experience_run=001&final=1', {waitUntil: 'networkidle2', timeout: 30000});
  report.telemetry = await finalPage.evaluate(() => window.HoldingAnswerQuality?.snapshot?.() || null);
} catch (err) {
  report.telemetryError = String(err);
}
await finalPage.close();
await browser.close();

const buckets = {};
const failuresBySession = {};
for (const s of report.sessions) {
  for (const p of s.prompts) buckets[p.bucket] = (buckets[p.bucket] || 0) + 1;
  const bad = s.prompts.filter(p => p.bucket !== 'answered');
  if (bad.length) failuresBySession[s.name] = bad.map(p => ({question:p.question, bucket:p.bucket}));
}
report.completedAt = new Date().toISOString();
report.summary = {
  sessionCount: report.sessions.length,
  questionCount: total,
  buckets,
  unknownLike,
  errorLike,
  emptyLike,
  failureSessionCount: Object.keys(failuresBySession).length,
  failuresBySession
};

fs.mkdirSync('artifacts', {recursive:true});
fs.writeFileSync('artifacts/ask-experience-run-001.json', JSON.stringify(report, null, 2));

const md = [
  '# Ask The Holding · Experience Run #001',
  '',
  `Started: ${report.startedAt}`,
  `Completed: ${report.completedAt}`,
  `Sessions: ${report.summary.sessionCount}`,
  `Questions: ${report.summary.questionCount}`,
  '',
  '## Coarse harness buckets',
  '',
  ...Object.entries(buckets).map(([k,v]) => `- ${k}: ${v}`),
  '',
  '## Native Answer Quality telemetry',
  '',
  '```json',
  JSON.stringify(report.telemetry, null, 2),
  '```',
  '',
  '## Non-answered / partial / error prompts',
  '',
  ...Object.entries(failuresBySession).flatMap(([name, arr]) => [
    `### ${name}`,
    ...arr.map(x => `- **${x.bucket}** · ${x.question}`),
    ''
  ])
].join('\n');
fs.writeFileSync('artifacts/ask-experience-run-001.md', md);

console.log(JSON.stringify(report.summary, null, 2));
if (!total || emptyLike > 5 || errorLike > Math.ceil(total * 0.20)) process.exitCode = 2;
