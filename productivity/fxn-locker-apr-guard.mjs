#!/usr/bin/env node
/**
 * The Holding · f(x) veFXN exact-source APR authority guard v0.3.4
 *
 * Exact official FXN Locker block is authoritative at the post-collection
 * publication boundary. The guard repairs only the current materialized
 * snapshot, then verifies every canonical APR surface before publication.
 *
 * APR authority and Economic Graph share the same exact Locker-block selection
 * path. The browser waits for a numeric percentage bound to the APR label
 * itself, so the nearby circulating-supply percentage can never masquerade as
 * APR or make the block look APR-ready prematurely.
 *
 * v0.3.4 closes canonical engine parity: source report, top-level Productivity
 * engine, current engine-history observation and company position all receive
 * the same exact APR. Prior historical snapshots remain immutable.
 *
 * Fail closed on ambiguity or missing source data.
 * No execution authority. No economic-methodology mutation.
 */

import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPORT_FILE = process.env.REPORT_FILE || path.join(ROOT, 'companies/productivity-source-report.json');
const DATA_FILE = process.env.DATA_FILE || path.join(ROOT, 'companies/productivity-data.json');
const FXN_LOCK_URL = 'https://fx.aladdin.club/v2/lock';
const MAX_REASONABLE_APR = 500;
const MATCH_TOLERANCE_PCT = 0.01;

function normalizeText(value) {
  return String(value || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}
function saneApr(value) {
  return Number.isFinite(value) && value >= -100 && value <= MAX_REASONABLE_APR;
}
function percentValue(value) {
  const n = Number(String(value).replace(',', '.'));
  return saneApr(n) ? n : NaN;
}
function boundedPercent(value) {
  const n = Number(String(value).replace(',', '.'));
  return Number.isFinite(n) && n >= 0 && n <= 100 ? n : NaN;
}
function round(n, d = 4) {
  const p = 10 ** d;
  return Math.round(Number(n) * p) / p;
}
function compactNumber(raw) {
  const text = String(raw || '').replace(/\s+/g, '').trim();
  const match = text.match(/^([0-9][0-9,]*(?:\.[0-9]+)?)([kKmMbB])?$/);
  if (!match) return NaN;
  const base = Number(match[1].replace(/,/g, ''));
  if (!Number.isFinite(base)) return NaN;
  const mult = match[2] ? ({ k: 1e3, m: 1e6, b: 1e9 })[match[2].toLowerCase()] : 1;
  return base * mult;
}
function metricNumber(text, label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const metric = text.match(new RegExp(`${escaped}\\s+([0-9][0-9,]*(?:\\.[0-9]+)?\\s*[kKmMbB]?)`, 'i'));
  return metric ? compactNumber(metric[1]) : NaN;
}
function rewardNumber(text, label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const metric = text.match(new RegExp(`${escaped}\\s+([0-9][0-9,]*(?:\\.[0-9]+)?\\s*[kKmMbB]?)\\s*wstETH\\b`, 'i'));
  return metric ? compactNumber(metric[1]) : NaN;
}
function fxnLockedStats(text) {
  const match = text.match(/\bFXN Locked\s+([0-9][0-9,]*(?:\.[0-9]+)?\s*[kKmMbB]?)\s+([0-9]+(?:[.,][0-9]+)?)\s*%\s+of FXN Circulating Supply\b/i);
  if (!match) return { fxnLocked: NaN, fxnCirculatingSupplyLockedPct: NaN };
  return {
    fxnLocked: compactNumber(match[1]),
    fxnCirculatingSupplyLockedPct: boundedPercent(match[2])
  };
}

export function extractFxnLockerApr(blocks) {
  const values = [];
  for (const raw of Array.isArray(blocks) ? blocks : []) {
    const text = normalizeText(raw);
    const start = text.toLowerCase().indexOf('fxn locker');
    if (start < 0) continue;
    const scoped = text.slice(start, start + 420);

    const labelFirst = scoped.match(/\bFXN Locker\b.{0,220}?\bAPR\b\s*[:\-]?\s*([0-9]+(?:[.,][0-9]+)?)\s*%/i);
    if (labelFirst) {
      const apr = percentValue(labelFirst[1]);
      if (saneApr(apr)) values.push(apr);
      continue;
    }

    const valueFirst = scoped.match(/\bFXN Locker\b.{0,220}?([0-9]+(?:[.,][0-9]+)?)\s*%.{0,60}?\bAPR\b/i);
    if (valueFirst) {
      const apr = percentValue(valueFirst[1]);
      if (saneApr(apr)) values.push(apr);
    }
  }
  const unique = [...new Set(values.map(v => Number(v.toFixed(4))))];
  if (unique.length !== 1) {
    throw new Error(`f(x) exact-source guard: expected one unambiguous FXN Locker APR, found ${unique.length}`);
  }
  return unique[0];
}

export function extractFxnLockerEconomicSnapshot(blocks, { observedAt = new Date().toISOString() } = {}) {
  const candidates = [];
  for (const raw of Array.isArray(blocks) ? blocks : []) {
    const text = normalizeText(raw);
    const start = text.toLowerCase().indexOf('fxn locker');
    if (start < 0) continue;
    const scoped = text.slice(start, start + 1800);
    let apr;
    try { apr = extractFxnLockerApr([scoped]); } catch { continue; }
    const locked = fxnLockedStats(scoped);
    const totalVeFxn = metricNumber(scoped, 'Total veFXN');
    const cumulativeThisWeekWsteth = rewardNumber(scoped, 'Cumulative This Week');
    const previousWeekWsteth = rewardNumber(scoped, 'Previous Week');
    if (![locked.fxnLocked, locked.fxnCirculatingSupplyLockedPct, totalVeFxn, cumulativeThisWeekWsteth, previousWeekWsteth].every(Number.isFinite)) continue;
    const averageLockMatch = scoped.match(/([0-9]+(?:\.[0-9]+)?\s*(?:years?|months?|days?))\s+average lock\b/i);
    const accumulateTillMatch = scoped.match(/Accumulate Till\s+(.{1,80}?)(?=\s+Lock FXN\b|\s+MAX APR CALC\b|$)/i);
    candidates.push({
      aprPct: round(apr),
      fxnLocked: round(locked.fxnLocked, 8),
      fxnCirculatingSupplyLockedPct: round(locked.fxnCirculatingSupplyLockedPct, 6),
      totalVeFxn: round(totalVeFxn, 8),
      cumulativeThisWeekWsteth: round(cumulativeThisWeekWsteth, 12),
      previousWeekWsteth: round(previousWeekWsteth, 12),
      averageLockRaw: averageLockMatch ? normalizeText(averageLockMatch[1]) : null,
      accumulateTillRaw: accumulateTillMatch ? normalizeText(accumulateTillMatch[1]) : null,
      rawBlockHash: crypto.createHash('sha256').update(scoped).digest('hex')
    });
  }
  const normalized = candidates.map(x => JSON.stringify({
    aprPct: x.aprPct,
    fxnLocked: x.fxnLocked,
    fxnCirculatingSupplyLockedPct: x.fxnCirculatingSupplyLockedPct,
    totalVeFxn: x.totalVeFxn,
    cumulativeThisWeekWsteth: x.cumulativeThisWeekWsteth,
    previousWeekWsteth: x.previousWeekWsteth,
    averageLockRaw: x.averageLockRaw,
    accumulateTillRaw: x.accumulateTillRaw
  }));
  const unique = [...new Set(normalized)];
  if (unique.length !== 1) throw new Error(`f(x) economic-vitals probe: expected one unambiguous FXN Locker economic snapshot, found ${unique.length}`);
  const selected = candidates[normalized.indexOf(unique[0])];
  return {
    ...selected,
    observedAt,
    source: FXN_LOCK_URL,
    sourceType: 'official-frontend-exact-locker-block',
    sourceMetric: 'FXN Locker economic vitals',
    nativeCadence: 'weekly',
    executionAuthority: 'none'
  };
}

function synchronizeCanonicalEngine(data, exactApr) {
  const canonicalEngine = data?.engines?.fx_vefxn;
  if (!canonicalEngine) throw new Error('f(x) exact-source authority: canonical Productivity fx_vefxn engine missing');
  const previousCanonicalEngineApr = Number(canonicalEngine.aprLatest);
  canonicalEngine.aprLatest = round(exactApr);
  canonicalEngine.status = 'ok';
  canonicalEngine.sourceUrl = FXN_LOCK_URL;
  canonicalEngine.source = FXN_LOCK_URL;
  canonicalEngine.sourceType = 'official-frontend-exact-block';
  canonicalEngine.sourceMetric = 'veFXN Locker APR';
  canonicalEngine.lastUpdatedAt = data.generatedAt || canonicalEngine.lastUpdatedAt || null;
  canonicalEngine.details = {
    ...(canonicalEngine.details || {}),
    exactSourceAuthority: 'FXN Locker block',
    collectorAprBeforeExactSourceAuthority: Number.isFinite(previousCanonicalEngineApr) ? previousCanonicalEngineApr : null
  };

  const engineHistory = data?.history?.engines?.fx_vefxn;
  if (!Array.isArray(engineHistory) || !engineHistory.length) throw new Error('f(x) exact-source authority: fx_vefxn engine history missing');
  const currentMatches = engineHistory.filter(x => x?.snapshotKey === data.snapshotKey);
  if (currentMatches.length !== 1) throw new Error(`f(x) exact-source authority: expected one current fx_vefxn engine-history snapshot, found ${currentMatches.length}`);
  const current = currentMatches[0];
  const previousCurrentEngineHistoryApr = Number(current.apr);
  current.apr = round(exactApr);
  current.sourceType = 'official-frontend-exact-block';

  return {
    previousCanonicalEngineApr: Number.isFinite(previousCanonicalEngineApr) ? previousCanonicalEngineApr : null,
    previousCurrentEngineHistoryApr: Number.isFinite(previousCurrentEngineHistoryApr) ? previousCurrentEngineHistoryApr : null
  };
}

export function applyExactFxnLockerApr(report, data, exactApr) {
  if (!saneApr(Number(exactApr))) throw new Error('f(x) exact-source authority: invalid APR');
  const engine = report?.engines?.fx_vefxn;
  if (!engine) throw new Error('f(x) exact-source authority: fx_vefxn source-report engine missing');
  const previousApr = Number(engine.apr);
  engine.apr = round(exactApr);
  engine.status = 'ok';
  engine.source = FXN_LOCK_URL;
  engine.sourceType = 'official-frontend-exact-block';
  engine.sourceMetric = 'veFXN Locker APR';
  engine.error = null;
  engine.details = {
    ...(engine.details || {}),
    exactSourceAuthority: 'FXN Locker block',
    collectorAprBeforeExactSourceAuthority: Number.isFinite(previousApr) ? previousApr : null
  };

  const canonical = synchronizeCanonicalEngine(data, exactApr);

  let adjustedCompanies = 0;
  for (const [companyName, company] of Object.entries(data?.companies || {})) {
    if (!Array.isArray(company?.breakdown)) continue;
    const rows = company.breakdown.filter(row => row?.engineId === 'fx_vefxn' || row?.principalId === 'fxn-token');
    if (!rows.length) continue;
    for (const row of rows) {
      row.apr = round(exactApr);
      row.engineStatus = 'ok';
    }
    let productive = 0, covered = 0, weighted = 0;
    for (const row of company.breakdown) {
      const value = Number(row.value);
      if (Number.isFinite(value) && value >= 0) productive += value;
      const apr = Number(row.apr);
      const usable = Number.isFinite(value) && value >= 0 && Number.isFinite(apr) && row.engineStatus !== 'warming' && row.engineStatus !== 'unavailable';
      if (usable) { covered += value; weighted += value * apr; }
    }
    if (!(productive > 0) || !(covered > 0)) throw new Error(`f(x) exact-source authority: ${companyName} aggregate unavailable`);
    company.productiveValue = round(productive, 2);
    company.coveredProductiveValue = round(covered, 2);
    company.coverage = round(covered / productive, 6);
    company.aprLatest = round(weighted / covered, 4);
    company.aprScope = company.coverage >= 0.999999 ? 'full-productive-capital' : 'covered-productive-capital';

    const history = data?.history?.companies?.[companyName];
    if (Array.isArray(history) && history.length) {
      const latest = history.at(-1);
      if (latest && latest.snapshotKey === data.snapshotKey) latest.apr = company.aprLatest;
      const valid = history.map(x => Number(x.apr)).filter(Number.isFinite);
      if (valid.length) {
        company.aprHistoricalAverage = round(valid.reduce((s, x) => s + x, 0) / valid.length, 4);
        company.observationCount = valid.length;
      }
    }
    adjustedCompanies++;
  }
  if (!adjustedCompanies) throw new Error('f(x) exact-source authority: no fx_vefxn company rows found');

  data.diagnostics = data.diagnostics || {};
  data.diagnostics.fxnLockerAprAuthority = {
    version: '0.3.4-canonical-engine-parity-authority',
    source: FXN_LOCK_URL,
    sourceMetric: 'veFXN Locker APR',
    previousCollectorApr: Number.isFinite(previousApr) ? previousApr : null,
    exactApr: round(exactApr),
    previousCanonicalEngineApr: canonical.previousCanonicalEngineApr,
    previousCurrentEngineHistoryApr: canonical.previousCurrentEngineHistoryApr,
    adjustedCompanies,
    canonicalEngineSynchronized: true,
    currentEngineHistorySynchronized: true,
    nearbyCirculatingSupplyPctCannotBecomeApr: true,
    aprAndEconomicVitalsShareExactBlockSelection: true,
    aprReadinessRequiresAprBoundPercentage: true,
    historicalSnapshotsRewritten: false,
    executionAuthority: 'none'
  };
  return { previousApr: Number.isFinite(previousApr) ? previousApr : null, exactApr: round(exactApr), adjustedCompanies };
}

async function collectLockerBlocks({ requireEconomicVitals = false } = {}) {
  const { chromium } = await import('playwright');
  let lastError;
  for (let attempt = 1; attempt <= 2; attempt++) {
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0 Safari/537.36'
      });
      await page.goto(FXN_LOCK_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForFunction(({ requireEconomicVitals }) => {
        const norm = value => String(value || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
        const nodes = Array.from(document.querySelectorAll('body *')).filter(el => norm(el.textContent) === 'FXN Locker');
        for (const label of nodes) {
          let node = label;
          for (let depth = 0; node && depth < 12; depth++, node = node.parentElement) {
            const text = norm(node.innerText || node.textContent);
            const start = text.toLowerCase().indexOf('fxn locker');
            if (start < 0) continue;
            const scoped = text.slice(start, start + 420);
            const labelFirst = /\bFXN Locker\b.{0,220}?\bAPR\b\s*[:\-]?\s*[0-9]+(?:[.,][0-9]+)?\s*%/i.test(scoped);
            const valueFirst = /\bFXN Locker\b.{0,220}?[0-9]+(?:[.,][0-9]+)?\s*%.{0,60}?\bAPR\b/i.test(scoped);
            const hasVitals = /\bFXN Locked\b/i.test(text) && /\bof FXN Circulating Supply\b/i.test(text) && /\bTotal veFXN\b/i.test(text) && /\bCumulative This Week\b/i.test(text) && /\bPrevious Week\b/i.test(text);
            if ((labelFirst || valueFirst) && (!requireEconomicVitals || hasVitals)) return true;
          }
        }
        return false;
      }, { requireEconomicVitals }, { timeout: 20000, polling: 500 });

      const blocks = await page.evaluate(({ requireEconomicVitals }) => {
        const norm = value => String(value || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
        const nodes = Array.from(document.querySelectorAll('body *')).filter(el => norm(el.textContent) === 'FXN Locker');
        const out = [];
        for (const label of nodes) {
          let node = label;
          for (let depth = 0; node && depth < 12; depth++, node = node.parentElement) {
            const text = norm(node.innerText || node.textContent);
            const start = text.toLowerCase().indexOf('fxn locker');
            if (start < 0) continue;
            const scoped = text.slice(start, start + 420);
            const labelFirst = /\bFXN Locker\b.{0,220}?\bAPR\b\s*[:\-]?\s*[0-9]+(?:[.,][0-9]+)?\s*%/i.test(scoped);
            const valueFirst = /\bFXN Locker\b.{0,220}?[0-9]+(?:[.,][0-9]+)?\s*%.{0,60}?\bAPR\b/i.test(scoped);
            const hasVitals = /\bFXN Locked\b/i.test(text) && /\bof FXN Circulating Supply\b/i.test(text) && /\bTotal veFXN\b/i.test(text) && /\bCumulative This Week\b/i.test(text) && /\bPrevious Week\b/i.test(text);
            if ((labelFirst || valueFirst) && (!requireEconomicVitals || hasVitals)) {
              out.push(text);
              break;
            }
          }
        }
        return out;
      }, { requireEconomicVitals });
      if (!Array.isArray(blocks) || !blocks.length) throw new Error(requireEconomicVitals ? 'f(x) economic-vitals probe: APR-ready Locker block unavailable' : 'f(x) exact-source guard: APR-ready Locker block unavailable');
      return blocks;
    } catch (error) {
      lastError = error;
      if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 1200));
    } finally {
      await browser.close();
    }
  }
  throw lastError || new Error('f(x) exact-source guard: source probe failed');
}

async function collectExactFxnLockerApr() {
  return extractFxnLockerApr(await collectLockerBlocks({ requireEconomicVitals: true }));
}

export async function collectFxnLockerEconomicSnapshot() {
  const observedAt = new Date().toISOString();
  const blocks = await collectLockerBlocks({ requireEconomicVitals: true });
  return extractFxnLockerEconomicSnapshot(blocks, { observedAt });
}

async function readMaterializedApr() {
  const [reportRaw, dataRaw] = await Promise.all([fs.readFile(REPORT_FILE, 'utf8'), fs.readFile(DATA_FILE, 'utf8')]);
  const report = JSON.parse(reportRaw);
  const data = JSON.parse(dataRaw);
  const reportEngine = report?.engines?.fx_vefxn;
  const canonicalEngine = data?.engines?.fx_vefxn;
  const reportApr = Number(reportEngine?.apr);
  const canonicalEngineApr = Number(canonicalEngine?.aprLatest);
  const currentHistory = (data?.history?.engines?.fx_vefxn || []).filter(x => x?.snapshotKey === data.snapshotKey);
  if (reportEngine?.status !== 'ok' || !saneApr(reportApr)) throw new Error('f(x) exact-source guard: materialized source-report fx_vefxn result unavailable');
  if (canonicalEngine?.status !== 'ok' || !saneApr(canonicalEngineApr)) throw new Error('f(x) exact-source guard: materialized canonical fx_vefxn engine unavailable');
  if (reportEngine?.source !== FXN_LOCK_URL || reportEngine?.sourceMetric !== 'veFXN Locker APR') throw new Error('f(x) exact-source guard: source-report contract drift');
  if (canonicalEngine?.source !== FXN_LOCK_URL || canonicalEngine?.sourceMetric !== 'veFXN Locker APR') throw new Error('f(x) exact-source guard: canonical engine source contract drift');
  if (currentHistory.length !== 1 || !saneApr(Number(currentHistory[0]?.apr))) throw new Error('f(x) exact-source guard: current engine-history observation unavailable');
  const currentEngineHistoryApr = Number(currentHistory[0].apr);
  if (Math.abs(reportApr - canonicalEngineApr) > MATCH_TOLERANCE_PCT || Math.abs(reportApr - currentEngineHistoryApr) > MATCH_TOLERANCE_PCT) {
    throw new Error(`f(x) exact-source guard: internal canonical APR drift report=${reportApr}% engine=${canonicalEngineApr}% history=${currentEngineHistoryApr}%`);
  }
  return { reportApr, canonicalEngineApr, currentEngineHistoryApr };
}

export async function synchronizeFxnLockerApr() {
  const exactApr = await collectExactFxnLockerApr();
  const [reportRaw, dataRaw] = await Promise.all([fs.readFile(REPORT_FILE, 'utf8'), fs.readFile(DATA_FILE, 'utf8')]);
  const report = JSON.parse(reportRaw);
  const data = JSON.parse(dataRaw);
  const result = applyExactFxnLockerApr(report, data, exactApr);
  await Promise.all([
    fs.writeFile(REPORT_FILE, JSON.stringify(report, null, 2) + '\n'),
    fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2) + '\n')
  ]);
  return result;
}

export async function verifyFxnLockerApr({ exactApr = null } = {}) {
  const expected = saneApr(Number(exactApr)) ? Number(exactApr) : await collectExactFxnLockerApr();
  const materialized = await readMaterializedApr();
  if (Math.abs(materialized.reportApr - expected) > MATCH_TOLERANCE_PCT) throw new Error(`f(x) exact-source guard: materialized ${materialized.reportApr}% != exact FXN Locker ${expected}%`);
  return {
    materializedApr: materialized.reportApr,
    canonicalEngineApr: materialized.canonicalEngineApr,
    currentEngineHistoryApr: materialized.currentEngineHistoryApr,
    exactApr: round(expected),
    source: FXN_LOCK_URL,
    sourceMetric: 'veFXN Locker APR'
  };
}

async function main() {
  if (process.argv.includes('--probe-economic-vitals')) {
    const snapshot = await collectFxnLockerEconomicSnapshot();
    console.log('f(x) economic-vitals probe PASS', snapshot);
    return;
  }
  if (process.argv.includes('--probe-only')) {
    const exactApr = await collectExactFxnLockerApr();
    console.log('f(x) exact-source probe PASS', { exactApr, source: FXN_LOCK_URL, sourceMetric: 'veFXN Locker APR' });
    return;
  }
  const sync = await synchronizeFxnLockerApr();
  const verified = await verifyFxnLockerApr({ exactApr: sync.exactApr });
  console.log('f(x) exact-source authority PASS', { ...sync, ...verified });
}

if (path.resolve(process.argv[1] || '') === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error?.stack || error); process.exit(1); });
}
