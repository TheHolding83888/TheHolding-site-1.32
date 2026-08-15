import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const corpusPath = process.argv[2];
const outputPath = process.argv[3] || 'artifacts/ask-experience-run.json';
if (!corpusPath) throw new Error('usage: node runner-v0.1.mjs <corpus.json> [output.json]');

const BASE = process.env.ASK_BASE_URL || 'http://127.0.0.1:8080/agents/';
const CHROME = process.env.CHROME_BIN;
if (!CHROME) throw new Error('CHROME_BIN is required');

const corpus = JSON.parse(fs.readFileSync(corpusPath, 'utf8'));
const origin = corpus.origin || process.env.ASK_EXPERIENCE_ORIGIN || 'synthetic-regression';
const runId = process.env.ASK_EXPERIENCE_RUN_ID || `local-${Date.now()}`;
const seed = process.env.ASK_EXPERIENCE_SEED || null;
const grammarVersion = process.env.ASK_EXPERIENCE_GRAMMAR_VERSION || null;

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
});

function promptsFor(test) {
  if (Array.isArray(test.session) && test.session.length) return test.session;
  if (typeof test.prompt === 'string' && test.prompt.trim()) return [test.prompt];
  return [];
}

async function ask(page, question) {
  await page.waitForSelector('#question', { timeout: 15000 });
  const before = await page.$$eval('#messages [data-answer-contract-version]', els => els.length);
  await page.$eval('#question', (el, value) => {
    el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, question);
  await page.$eval('#askForm', el => el.requestSubmit());
  await page.waitForFunction(count => document.querySelectorAll('#messages [data-answer-contract-version]').length > count, { timeout: 20000 }, before);
  await new Promise(resolve => setTimeout(resolve, 120));
  return page.$eval('#messages [data-answer-contract-version]:last-of-type', el => {
    const spans = el.querySelectorAll('span');
    const answer = spans[1]?.textContent?.trim() || el.textContent?.trim() || '';
    const artifacts = String(el.dataset.answerSourceArtifacts || '').split('|').filter(Boolean);
    return {
      answer,
      answerContract: {
        version: el.dataset.answerContractVersion || null,
        confidenceClass: el.dataset.answerConfidenceClass || null,
        topic: el.dataset.answerTopic || null,
        grounded: el.dataset.answerGrounded === 'true',
        generatedAt: el.dataset.answerGeneratedAt || null,
        sourceArtifacts: artifacts
      }
    };
  });
}

const report = {
  version: '0.1-unified-browser-experience-runner',
  runId,
  origin,
  corpusVersion: corpus.version || null,
  grammarVersion,
  seed,
  baseUrl: BASE,
  startedAt: new Date().toISOString(),
  cases: [],
  summary: null
};

let harnessErrors = 0;
for (const test of corpus.cases || []) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1365, height: 900 });
  const consoleErrors = [];
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', err => consoleErrors.push(String(err)));

  const result = {
    id: test.id,
    origin: test.origin || origin,
    prompts: [],
    expectedIntent: test.expectedIntent ?? null,
    expectedConfidence: test.expectedConfidence ?? null,
    discoveryTarget: test.discoveryTarget ?? null,
    consoleErrors
  };

  try {
    const url = new URL(BASE);
    url.searchParams.set('experience_run', runId);
    url.searchParams.set('case', test.id || 'unknown');
    url.searchParams.set('origin', result.origin);
    await page.goto(url.toString(), { waitUntil: 'networkidle2', timeout: 30000 });
    await page.waitForSelector('#askForm', { timeout: 15000 });

    for (const question of promptsFor(test)) {
      const started = Date.now();
      try {
        const response = await ask(page, question);
        result.prompts.push({ question, ...response, latencyMs: Date.now() - started });
      } catch (error) {
        harnessErrors++;
        result.prompts.push({ question, answer: '', answerContract: null, latencyMs: Date.now() - started, harnessError: String(error) });
      }
    }
  } catch (error) {
    harnessErrors++;
    result.fatal = String(error);
  }

  report.cases.push(result);
  await page.close();
}

await browser.close();
report.completedAt = new Date().toISOString();
const finalPrompts = report.cases.map(c => c.prompts.at(-1)).filter(Boolean);
const confidenceCounts = {};
for (const p of finalPrompts) {
  const key = p.answerContract?.confidenceClass || 'missing';
  confidenceCounts[key] = (confidenceCounts[key] || 0) + 1;
}
report.summary = {
  caseCount: report.cases.length,
  finalAnswerCount: finalPrompts.length,
  harnessErrors,
  confidenceCounts,
  origins: [...new Set(report.cases.map(c => c.origin))]
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report.summary, null, 2));
if (harnessErrors > 0) process.exitCode = 2;
