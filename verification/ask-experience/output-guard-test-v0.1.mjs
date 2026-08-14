import puppeteer from 'puppeteer-core';

const BASE = process.env.ASK_BASE_URL || 'http://127.0.0.1:8080/agents/';
const CHROME = process.env.CHROME_BIN;
if (!CHROME) throw new Error('CHROME_BIN is required');

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const page = await browser.newPage();
await page.goto(BASE + '?output_guard_test=1', { waitUntil: 'networkidle2', timeout: 30000 });
await page.waitForFunction(() => Boolean(window.HoldingOutputGuard?.check), { timeout: 15000 });

const results = await page.evaluate(() => {
  const base = (confidenceClass = 'measured', sourceArtifacts = ['/intelligence/project-memory/CURRENT.md']) => ({
    text: '',
    source: 'test source',
    answerContract: {
      version: '0.1-source-bound-answer-contract',
      language: 'en',
      confidenceClass,
      sourceArtifacts,
      generatedAt: null,
      topic: 'guard-test',
      grounded: confidenceClass !== 'unknown' && sourceArtifacts.length > 0
    }
  });
  const check = (text, contract = base(), raw = 'unrelated paraphrase') => window.HoldingOutputGuard.check({ ...contract, text }, raw, 'en');
  return {
    authority: check('The Holding can sign and execute this transaction for you.'),
    secret: check('private key: 0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'),
    advice: check('You should buy ETH and allocate 60% of your capital to it.'),
    noSource: check('This is definitely a verified fact.', base('measured', [])),
    safeBoundary: check('Execution authority: NONE. Ask The Holding cannot sign transactions, execute trades or move capital.')
  };
});

const assert = (ok, label, value) => { if (!ok) throw new Error(`${label} failed: ${JSON.stringify(value)}`); };
assert(results.authority.outputGuard === 'authority-block', 'authority block', results.authority);
assert(results.secret.outputGuard === 'secret-block', 'secret block', results.secret);
assert(results.advice.outputGuard === 'advice-block', 'advice block', results.advice);
assert(results.noSource.outputGuard === 'source-block' && results.noSource.answerContract.confidenceClass === 'unknown', 'measured-without-source downgrade', results.noSource);
assert(results.safeBoundary.outputGuard === 'pass', 'safe explicit boundary must pass', results.safeBoundary);

console.log(JSON.stringify({ version: '0.1-output-guard-direct-test', status: 'PASS', guards: Object.fromEntries(Object.entries(results).map(([k,v]) => [k, v.outputGuard])) }, null, 2));
await browser.close();
