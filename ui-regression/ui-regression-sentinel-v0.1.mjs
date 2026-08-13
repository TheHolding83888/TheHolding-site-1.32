#!/usr/bin/env node
/**
 * The Holding UI Regression Sentinel v0.1
 * Deterministic, read-only browser regression observer for /companies/.
 *
 * v0.1 policy:
 * - observes exact checked-out commit through a local static server;
 * - never mutates production/source data;
 * - never commits/publishes;
 * - default is advisory: failures => WATCH but exit 0;
 * - set UI_SENTINEL_ENFORCE=true to turn WATCH into a failing exit code later.
 */

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import process from 'node:process';
import { chromium } from '@playwright/test';

const VERSION = '0.1.0-observer';
const ROOT = path.resolve(process.env.GITHUB_WORKSPACE || process.cwd());
const TARGET_URL = process.env.UI_SENTINEL_URL || 'http://127.0.0.1:4173/companies/';
const REPORT_PATH = path.resolve(process.env.UI_SENTINEL_REPORT_PATH || path.join(ROOT, 'ui-regression-report.json'));
const ENFORCE = /^(1|true|yes)$/i.test(String(process.env.UI_SENTINEL_ENFORCE || 'false'));
const INDEX_PATH = path.join(ROOT, 'companies', 'index.html');
const STARTED_AT = new Date().toISOString();

const EXPECTED_COMPANIES = [
  '05081966.eth',
  'YieldRing.eth',
  'dinaz.eth',
  'defitea.eth',
  '0x58...ca8.eth',
  'Aerocvxyb.eth',
  "Rook's portfolio",
  'Monetra.eth',
  '1milliondollar.eth'
];

const results = [];
const diagnostics = [];

function normalizeDetail(value) {
  if (value == null) return '';
  if (value instanceof Error) return value.stack || value.message;
  if (typeof value === 'string') return value;
  try { return JSON.stringify(value); } catch { return String(value); }
}

function record(scope, name, ok, detail = '') {
  const row = { scope, name, ok: Boolean(ok), detail: normalizeDetail(detail) };
  results.push(row);
  const icon = row.ok ? 'PASS' : 'FAIL';
  console.log(`[${icon}] [${scope}] ${name}${row.detail ? ` :: ${row.detail}` : ''}`);
  if (!row.ok && process.env.GITHUB_ACTIONS === 'true') {
    const safe = row.detail.replace(/\r?\n/g, ' ').slice(0, 1200);
    console.log(`::warning title=UI Regression Sentinel::${scope} / ${name}${safe ? ` — ${safe}` : ''}`);
  }
  return row.ok;
}

function check(scope, name, fn) {
  try {
    const value = fn();
    if (value && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, 'ok')) {
      return record(scope, name, value.ok, value.detail || '');
    }
    return record(scope, name, Boolean(value));
  } catch (error) {
    return record(scope, name, false, error);
  }
}

async function acheck(scope, name, fn) {
  try {
    const value = await fn();
    if (value && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, 'ok')) {
      return record(scope, name, value.ok, value.detail || '');
    }
    return record(scope, name, Boolean(value));
  } catch (error) {
    return record(scope, name, false, error);
  }
}

function staticChecks() {
  const scope = 'static';
  if (!fs.existsSync(INDEX_PATH)) {
    record(scope, 'companies/index.html exists', false, INDEX_PATH);
    return;
  }
  record(scope, 'companies/index.html exists', true, INDEX_PATH);
  const html = fs.readFileSync(INDEX_PATH, 'utf8');

  check(scope, 'registry declares 9 companies', () => ({
    ok: /"numberOfItems"\s*:\s*9\b/.test(html),
    detail: 'JSON-LD numberOfItems must remain 9 until registry intentionally changes.'
  }));

  for (const company of EXPECTED_COMPANIES) {
    check(scope, `registry company preserved: ${company}`, () => ({
      ok: html.includes(company),
      detail: company
    }));
  }

  check(scope, 'Company #005 remains non-clickable/static card', () => ({
    ok: /<div\s+class="company-card company-card-005[^>]*>/i.test(html)
      && !/<a\s+class="company-card company-card-005[^>]*>/i.test(html),
    detail: 'Expected Registry 005 to remain a DIV, never an outbound card link.'
  }));

  check(scope, 'Company #005 keeps static DeBank treatment', () => ({
    ok: /company-card-005[\s\S]{0,5000}cc-extlink-static[\s\S]{0,500}aria-disabled="true"/i.test(html),
    detail: 'Historical regression guard.'
  }));

  check(scope, 'Defitea f(x) Protocol canonical naming preserved', () => ({
    ok: html.includes('f(x) Protocol'),
    detail: 'Historical regression guard.'
  }));

  check(scope, 'Observatory has Collection / General / Stable modes', () => ({
    ok: ['collection', 'index', 'stable'].every(mode => html.includes(`data-capital-mode-btn="${mode}"`)),
    detail: 'Three-mode Registry Observatory contract.'
  }));

  check(scope, 'General Index keeps Composite + TVL lenses', () => ({
    ok: html.includes('data-mode="composite"') && html.includes('data-mode="tvl"'),
    detail: 'Composite and TVL must both remain available.'
  }));

  check(scope, 'Graph surface preserved', () => ({
    ok: html.includes('id="graphCanvas"') && html.includes('id="graph"'),
    detail: 'The Holding Graph anchors.'
  }));

  check(scope, 'EN/RU controls preserved', () => ({
    ok: html.includes('data-lang="en"') && html.includes('data-lang="ru"'),
    detail: 'Language switch controls.'
  }));

  // Compile every inline executable script without executing it. JSON-LD and external src are excluded.
  const scriptRe = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let match;
  let inlineCount = 0;
  const syntaxErrors = [];
  while ((match = scriptRe.exec(html)) !== null) {
    const attrs = match[1] || '';
    const code = match[2] || '';
    if (/\bsrc\s*=/.test(attrs)) continue;
    if (/type\s*=\s*["']application\/ld\+json["']/i.test(attrs)) continue;
    if (!code.trim()) continue;
    inlineCount += 1;
    try {
      new vm.Script(code, { filename: `companies/index.html:inline-script-${inlineCount}.js` });
    } catch (error) {
      syntaxErrors.push(`script ${inlineCount}: ${error.message}`);
    }
  }
  record(scope, 'all executable inline JavaScript parses', syntaxErrors.length === 0,
    syntaxErrors.length ? syntaxErrors.join(' | ') : `${inlineCount} inline scripts compiled`);
}

async function waitForCore(page) {
  await page.waitForFunction(() => document.querySelectorAll('#companiesGrid .company-card').length >= 9, null, { timeout: 12_000 });
  await page.waitForFunction(() => document.querySelectorAll('#idxBoard .ib-item').length >= 8, null, { timeout: 12_000 });
  await page.waitForFunction(() => !!document.querySelector('#graphCanvas svg'), null, { timeout: 12_000 });
}

async function fetchJsonContract(page, rel) {
  return page.evaluate(async (relative) => {
    try {
      const response = await fetch(relative, { cache: 'no-store' });
      if (!response.ok) return { ok: false, detail: `HTTP ${response.status}` };
      const data = await response.json();
      return { ok: !!data && typeof data === 'object', detail: `HTTP ${response.status}` };
    } catch (error) {
      return { ok: false, detail: String(error && error.message || error) };
    }
  }, rel);
}

async function visible(page, selector) {
  const loc = page.locator(selector).first();
  if (await loc.count() < 1) return false;
  return loc.isVisible();
}

async function surfaceIs(page, mode) {
  return page.evaluate(expected => {
    const rootMode = document.documentElement.getAttribute('data-capital-mode');
    const panel = document.querySelector(`[data-capital-panel="${expected}"]`);
    return rootMode === expected && !!panel && !panel.hidden && getComputedStyle(panel).display !== 'none';
  }, mode);
}

async function selectSurface(page, mode) {
  await page.locator(`[data-capital-mode-btn="${mode}"]`).click();
  await page.waitForFunction(expected => document.documentElement.getAttribute('data-capital-mode') === expected, mode, { timeout: 3_000 });
  await page.waitForTimeout(180);
}

async function testViewport(browser, spec) {
  const scope = spec.name;
  const context = await browser.newContext({
    viewport: spec.viewport,
    reducedMotion: 'reduce',
    locale: 'en-US'
  });
  const page = await context.newPage();
  const pageErrors = [];
  const consoleErrors = [];

  page.on('pageerror', error => pageErrors.push(error.message || String(error)));
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  try {
    const response = await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    record(scope, 'Companies page returns success', !!response && response.ok(), response ? `HTTP ${response.status()}` : 'no response');

    try {
      await waitForCore(page);
      record(scope, 'dynamic core reaches ready state', true, '9 cards · >=8 General Index rows · Graph SVG');
    } catch (error) {
      record(scope, 'dynamic core reaches ready state', false, error);
    }

    await acheck(scope, '9 registry cards render', async () => ({
      ok: await page.locator('#companiesGrid .company-card').count() === 9,
      detail: `count=${await page.locator('#companiesGrid .company-card').count()}`
    }));

    await acheck(scope, 'expected company names render', async () => {
      const names = await page.locator('#companiesGrid .cc-name').allTextContents();
      const missing = EXPECTED_COMPANIES.filter(name => !names.some(x => x.trim().toLowerCase() === name.toLowerCase()));
      return { ok: missing.length === 0, detail: missing.length ? `missing: ${missing.join(', ')}` : names.join(' · ') };
    });

    await acheck(scope, 'primary nav + four-section subnav visible', async () => ({
      ok: await visible(page, 'nav .nav-brand')
        && await visible(page, '#subnav')
        && await page.locator('#subnav a[data-section]').count() === 4,
      detail: `subnav links=${await page.locator('#subnav a[data-section]').count()}`
    }));

    await acheck(scope, 'three Observatory mode controls visible', async () => {
      const buttons = page.locator('[data-capital-mode-btn]');
      const count = await buttons.count();
      let allVisible = count === 3;
      for (let i = 0; i < count; i++) allVisible = allVisible && await buttons.nth(i).isVisible();
      return { ok: allVisible, detail: `count=${count}` };
    });

    if (spec.name === 'mobile') {
      await acheck(scope, 'mobile defaults to list view without post-load snap', async () => ({
        ok: await page.locator('#companiesGrid').evaluate(el => el.classList.contains('view-list')),
        detail: 'Fresh mobile context should parse directly into list view.'
      }));
      await acheck(scope, 'mobile page has no horizontal document overflow', async () => page.evaluate(() => ({
        ok: document.documentElement.scrollWidth <= window.innerWidth + 2,
        detail: `scrollWidth=${document.documentElement.scrollWidth}, viewport=${window.innerWidth}`
      })));
      await acheck(scope, 'mobile Observatory rail stays inside viewport', async () => page.evaluate(() => {
        const el = document.querySelector('.capital-mode-tabs');
        if (!el) return { ok: false, detail: 'capital-mode-tabs missing' };
        const r = el.getBoundingClientRect();
        return { ok: r.left >= -2 && r.right <= window.innerWidth + 2, detail: `left=${r.left.toFixed(1)}, right=${r.right.toFixed(1)}, viewport=${window.innerWidth}` };
      }));
    } else {
      await acheck(scope, 'desktop defaults to grid view', async () => ({
        ok: !(await page.locator('#companiesGrid').evaluate(el => el.classList.contains('view-list'))),
        detail: 'Fresh desktop context should stay in grid view.'
      }));
    }

    // Local canonical data files used by the page must remain readable JSON.
    await acheck(scope, 'productivity-data.json available', () => fetchJsonContract(page, './productivity-data.json'));
    await acheck(scope, 'rewards-data.json available', () => fetchJsonContract(page, './rewards-data.json'));
    await acheck(scope, 'stable-index-data.json available', () => fetchJsonContract(page, './stable-index-data.json'));

    // EN -> RU -> EN must change the document language and active control.
    await page.locator('.lang-switch button[data-lang="ru"]').click();
    await page.waitForFunction(() => document.documentElement.lang === 'ru', null, { timeout: 2_000 });
    await acheck(scope, 'EN → RU language switch works', async () => ({
      ok: await page.locator('.lang-switch button[data-lang="ru"]').evaluate(el => el.classList.contains('active'))
        && (await page.locator('#subnav a[data-section="collection"]').textContent() || '').trim().toLowerCase().startsWith('компан'),
      detail: `html.lang=${await page.locator('html').getAttribute('lang')}`
    }));

    await page.locator('.lang-switch button[data-lang="en"]').click();
    await page.waitForFunction(() => document.documentElement.lang === 'en', null, { timeout: 2_000 });
    await acheck(scope, 'RU → EN language switch works', async () => ({
      ok: await page.locator('.lang-switch button[data-lang="en"]').evaluate(el => el.classList.contains('active'))
        && (await page.locator('#subnav a[data-section="collection"]').textContent() || '').trim() === 'Companies',
      detail: `html.lang=${await page.locator('html').getAttribute('lang')}`
    }));

    // General Index surface + dual analytical lenses.
    await selectSurface(page, 'index');
    await acheck(scope, 'Collection → General Index surface transition works', () => surfaceIs(page, 'index'));
    await acheck(scope, 'General Index has >=8 constituents', async () => ({
      ok: await page.locator('#idxBoard .ib-item').count() >= 8,
      detail: `rows=${await page.locator('#idxBoard .ib-item').count()}`
    }));

    const tvlButton = page.locator('#index .idx-lens-btn[data-mode="tvl"]').first();
    await tvlButton.click();
    await page.waitForTimeout(100);
    await acheck(scope, 'Composite → TVL lens works', async () => ({
      ok: await tvlButton.evaluate(el => el.classList.contains('active'))
        && /TVL/i.test((await page.locator('#idxWeightHead').textContent()) || ''),
      detail: (await page.locator('#idxWeightHead').textContent()) || ''
    }));

    const compositeButton = page.locator('#index .idx-lens-btn[data-mode="composite"]').first();
    await compositeButton.click();
    await page.waitForTimeout(100);
    await acheck(scope, 'TVL → Composite lens works', async () => ({
      ok: await compositeButton.evaluate(el => el.classList.contains('active'))
        && /Index Weight/i.test((await page.locator('#idxWeightHead').textContent()) || ''),
      detail: (await page.locator('#idxWeightHead').textContent()) || ''
    }));

    // Company Passport open/close on a dense real company.
    const item = page.locator('.ib-item[data-nm="defitea.eth"]').first();
    await acheck(scope, 'Defitea Index row exists', async () => ({ ok: await item.count() === 1, detail: 'data-nm=defitea.eth' }));
    if (await item.count()) {
      await item.locator('.ib-row').click();
      await page.waitForFunction(() => document.querySelector('.ib-item[data-nm="defitea.eth"]')?.classList.contains('open'), null, { timeout: 2_000 });
      await acheck(scope, 'Company Passport opens', async () => ({
        ok: await item.evaluate(el => el.classList.contains('open'))
          && await item.locator('.ib-row').getAttribute('aria-expanded') === 'true'
          && await item.locator('.ib-passport').isVisible(),
        detail: 'Defitea passport'
      }));
      await acheck(scope, 'Passport headline metrics preserved', async () => ({
        ok: await item.locator('.ipx-economic > *').count() >= 3,
        detail: `headline metrics=${await item.locator('.ipx-economic > *').count()}`
      }));
      await item.locator('.ipx-passport-close').click();
      await page.waitForFunction(() => !document.querySelector('.ib-item[data-nm="defitea.eth"]')?.classList.contains('open'), null, { timeout: 2_000 });
      await acheck(scope, 'Company Passport closes cleanly', async () => ({
        ok: !(await item.evaluate(el => el.classList.contains('open'))),
        detail: 'Defitea passport'
      }));
    }

    await acheck(scope, 'The Holding Graph renders nodes', async () => ({
      ok: await page.locator('#graphCanvas svg').count() === 1 && await page.locator('#graphCanvas .g-node').count() > 0,
      detail: `nodes=${await page.locator('#graphCanvas .g-node').count()}`
    }));

    // Stable universe stays separate and has its own Passport.
    await selectSurface(page, 'stable');
    await acheck(scope, 'General Index → Stable Index surface transition works', () => surfaceIs(page, 'stable'));
    await acheck(scope, 'Stable Index renders company board', async () => ({
      ok: await page.locator('#stableCompanyBoard .sc-board-row').count() >= 1,
      detail: `rows=${await page.locator('#stableCompanyBoard .sc-board-row').count()}`
    }));
    await acheck(scope, 'Stable headline data leaves loading state', async () => {
      await page.waitForFunction(() => {
        const el = document.getElementById('scTotalCapital');
        return !!el && el.textContent.trim() !== '—';
      }, null, { timeout: 4_000 });
      return { ok: true, detail: (await page.locator('#scTotalCapital').textContent()) || '' };
    });

    const stableOpen = page.locator('[data-stable-passport-open]').first();
    if (await stableOpen.count()) {
      await stableOpen.click();
      await page.waitForFunction(() => document.getElementById('stablePassportMonetra')?.classList.contains('is-open'), null, { timeout: 2_000 });
      await acheck(scope, 'Monetra Stable Passport opens', async () => ({
        ok: await page.locator('#stablePassportMonetra').isVisible()
          && await page.locator('#stablePassportMonetra .scp-headline-final > .scp-final-metric').count() >= 4,
        detail: `headline metrics=${await page.locator('#stablePassportMonetra .scp-headline-final > .scp-final-metric').count()}`
      }));
      const close = page.locator('#stablePassportMonetra [data-stable-passport-close]').first();
      if (await close.count()) {
        await close.click();
        await page.waitForFunction(() => !document.getElementById('stablePassportMonetra')?.classList.contains('is-open'), null, { timeout: 2_000 });
        record(scope, 'Monetra Stable Passport closes', true);
      } else {
        record(scope, 'Monetra Stable Passport closes', false, 'close control missing');
      }
    } else {
      record(scope, 'Monetra Stable Passport opens', false, 'open control missing');
      record(scope, 'Monetra Stable Passport closes', false, 'open control missing');
    }

    await selectSurface(page, 'collection');
    await acheck(scope, 'Stable Index → Collection transition works', () => surfaceIs(page, 'collection'));

    // Reload/scroll restoration is a mobile-specific historical regression guard.
    if (spec.name === 'mobile') {
      await page.evaluate(() => {
        history.replaceState(history.state, '', location.pathname);
        sessionStorage.setItem('th_companies_reload_scroll_y', '900');
        window.scrollTo(0, 900);
      });
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 30_000 });
      try { await waitForCore(page); } catch (_) {}
      await page.waitForFunction(() => !document.documentElement.classList.contains('th-reload-stabilizing'), null, { timeout: 4_000 }).catch(() => {});
      await page.waitForTimeout(120);
      await acheck(scope, 'mobile reload restores scroll without leaving stabilization mask', async () => page.evaluate(() => ({
        ok: window.scrollY >= 720 && window.scrollY <= 1080 && !document.documentElement.classList.contains('th-reload-stabilizing'),
        detail: `scrollY=${Math.round(window.scrollY)}, stabilizing=${document.documentElement.classList.contains('th-reload-stabilizing')}`
      })));
    }

    // Browser exceptions are hard regression signals. Console errors remain diagnostic in v0.1
    // because third-party/network resources can be noisy even when application JS is healthy.
    record(scope, 'no uncaught browser page errors', pageErrors.length === 0, pageErrors.join(' | '));
    if (consoleErrors.length) diagnostics.push({ scope, type: 'console-error', messages: consoleErrors.slice(0, 20) });
  } catch (error) {
    record(scope, 'scenario completed', false, error);
  } finally {
    await context.close();
  }
}

function writeSummary(report) {
  const lines = [];
  lines.push(`# The Holding UI Regression Sentinel v0.1`);
  lines.push('');
  lines.push(`**Status:** ${report.status}`);
  lines.push(`**Mode:** ${report.enforce ? 'ENFORCED' : 'OBSERVER / NON-BLOCKING'}`);
  lines.push(`**Target:** \`${report.targetUrl}\``);
  lines.push(`**Checks:** ${report.passed}/${report.total} passed · ${report.failed} failed`);
  lines.push('');
  lines.push('| Scope | Check | Result |');
  lines.push('|---|---|---|');
  for (const row of report.results) {
    lines.push(`| ${row.scope} | ${row.name.replace(/\|/g, '\\|')} | ${row.ok ? 'PASS' : 'FAIL'} |`);
  }
  if (report.diagnostics.length) {
    lines.push('');
    lines.push('## Advisory diagnostics');
    for (const d of report.diagnostics) {
      lines.push(`- **${d.scope} / ${d.type}:** ${d.messages.join(' · ').replace(/\n/g, ' ').slice(0, 3000)}`);
    }
  }
  lines.push('');
  lines.push('v0.1 is read-only. WATCH does not block production unless `enforce=true` is explicitly selected on a manual run.');
  const text = lines.join('\n') + '\n';
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, text);
  console.log('\n' + text);
}

async function main() {
  console.log(`The Holding UI Regression Sentinel ${VERSION}`);
  console.log(`Target: ${TARGET_URL}`);
  console.log(`Root: ${ROOT}`);
  console.log(`Mode: ${ENFORCE ? 'ENFORCED' : 'OBSERVER / NON-BLOCKING'}`);

  staticChecks();

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    await testViewport(browser, { name: 'desktop', viewport: { width: 1440, height: 1000 } });
    await testViewport(browser, { name: 'mobile', viewport: { width: 390, height: 844 } });
  } catch (error) {
    record('runtime', 'Chromium test runtime launches and completes', false, error);
  } finally {
    if (browser) await browser.close();
  }

  const failed = results.filter(x => !x.ok).length;
  const passed = results.length - failed;
  const report = {
    schemaVersion: 1,
    sentinelVersion: VERSION,
    generatedAt: new Date().toISOString(),
    startedAt: STARTED_AT,
    targetUrl: TARGET_URL,
    enforce: ENFORCE,
    status: failed === 0 ? 'PASS' : 'WATCH',
    total: results.length,
    passed,
    failed,
    results,
    diagnostics
  };

  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2) + '\n');
  writeSummary(report);

  if (failed > 0 && ENFORCE) process.exitCode = 1;
  else process.exitCode = 0;
}

main().catch(error => {
  console.error(error);
  process.exitCode = ENFORCE ? 1 : 0;
});
