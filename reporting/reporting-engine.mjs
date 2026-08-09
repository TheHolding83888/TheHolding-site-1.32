#!/usr/bin/env node
/**
 * The Holding · Reporting Layer v1.0
 * ---------------------------------
 * Lightweight daily collector for Defitea reporting.
 *
 * One daily snapshot:
 *   canonical COMPANY_BOOK quantities
 *   + one batched CoinGecko price request
 *   + latest validated Defitea Reference APR
 *       -> daily productive TVL
 *       -> time-weighted monthly TVL history
 *       -> provisional monthly reference cash-flow model
 *       -> automatic month close on the first run of the next month
 *
 * IMPORTANT:
 * - Jan–Jul 2026 are preserved as legacy reported/realised history.
 * - Automated periods are a REFERENCE MODEL based on productive TVL × Reference APR.
 *   They are not claim-accounting and must not be represented as realised onchain cash flow.
 * - A future Cash Flow Ledger can replace reference-model months with onchain-realised data
 *   without changing the public page architecture.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const COMPANY_PAGE_FILE = process.env.COMPANY_PAGE_FILE || path.join(ROOT, 'companies', 'index.html');
const PRODUCTIVITY_DATA_FILE = process.env.PRODUCTIVITY_DATA_FILE || path.join(ROOT, 'companies', 'productivity-data.json');
const REPORTING_DATA_FILE = process.env.REPORTING_DATA_FILE || path.join(ROOT, 'reporting', 'reporting-data.json');
const FUND_NAME = 'defitea.eth';
const REPORTING_VERSION = '1.0';
const METHODOLOGY_VERSION = '1.0-daily-tvl-reference-model';
const API_TIMEOUT_MS = 12000;
const MAX_DAILY_SNAPSHOTS = 550;

const LEGACY_MONTHS = {
  '2026-01': { month:'2026-01', status:'final-reported', mode:'reported-realised', cashFlowUsd:29.66, monthlyYieldPct:1.34, annualizedAprPct:16.00, averageTvlUsd:2213.43, source:'legacy-verified-report' },
  '2026-02': { month:'2026-02', status:'final-reported', mode:'reported-realised', cashFlowUsd:45.97, monthlyYieldPct:1.84, annualizedAprPct:22.00, averageTvlUsd:2498.37, source:'legacy-verified-report' },
  '2026-03': { month:'2026-03', status:'final-reported', mode:'reported-realised', cashFlowUsd:27.51, monthlyYieldPct:1.02, annualizedAprPct:12.22, averageTvlUsd:2697.06, source:'legacy-verified-report' },
  '2026-04': { month:'2026-04', status:'final-reported', mode:'reported-realised', cashFlowUsd:20.20, monthlyYieldPct:0.78, annualizedAprPct:9.36, averageTvlUsd:2589.74, source:'legacy-verified-report' },
  '2026-05': { month:'2026-05', status:'final-reported', mode:'reported-realised', cashFlowUsd:30.40, monthlyYieldPct:1.01, annualizedAprPct:12.20, averageTvlUsd:3009.90, source:'legacy-verified-report' },
  '2026-06': { month:'2026-06', status:'final-reported', mode:'reported-realised', cashFlowUsd:74.76, monthlyYieldPct:1.31, annualizedAprPct:15.72, averageTvlUsd:5706.87, source:'legacy-verified-report' },
  '2026-07': { month:'2026-07', status:'final-reported', mode:'reported-realised', cashFlowUsd:56.05, monthlyYieldPct:0.82, annualizedAprPct:9.89, averageTvlUsd:6835.37, source:'legacy-verified-report' }
};

function round(n, d=4) {
  const f = 10 ** d;
  return Math.round(n * f) / f;
}
function avg(arr) {
  const clean = arr.filter(Number.isFinite);
  return clean.length ? clean.reduce((s, x) => s + x, 0) / clean.length : NaN;
}
function nowIso() { return new Date().toISOString(); }
function dayKey(date = new Date()) { return date.toISOString().slice(0, 10); }
function monthKeyFromDate(date = new Date()) { return date.toISOString().slice(0, 7); }
function daysInMonthUTC(year, month1) { return new Date(Date.UTC(year, month1, 0)).getUTCDate(); }
function monthLabel(key) {
  const [y, m] = key.split('-').map(Number);
  return new Intl.DateTimeFormat('en-US', { month:'long', year:'numeric', timeZone:'UTC' }).format(new Date(Date.UTC(y, m - 1, 1)));
}
async function readJson(file, fallback={}) {
  try { return JSON.parse(await fs.readFile(file, 'utf8')); } catch { return fallback; }
}
async function writeJson(file, data) {
  await fs.mkdir(path.dirname(file), { recursive:true });
  await fs.writeFile(file, JSON.stringify(data, null, 2) + '\n');
}

async function parseCompanyBook() {
  const html = await fs.readFile(COMPANY_PAGE_FILE, 'utf8');
  const m = html.match(/const COMPANY_BOOK\s*=\s*(\{[\s\S]*?\n\};)/);
  if (!m) throw new Error(`COMPANY_BOOK not found in ${COMPANY_PAGE_FILE}`);
  const expr = m[1].replace(/;\s*$/, '');
  return vm.runInNewContext('(' + expr + ')', Object.create(null), { timeout:1000 });
}

async function fetchJson(url, attempts=2) {
  let last;
  for (let i = 0; i < attempts; i++) {
    const c = new AbortController();
    const timer = setTimeout(() => c.abort(), API_TIMEOUT_MS);
    try {
      const r = await fetch(url, { signal:c.signal, headers:{ 'accept':'application/json', 'user-agent':'TheHolding-ReportingLayer/1.0' } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.json();
    } catch (e) {
      last = e;
      await new Promise(r => setTimeout(r, 650 * (i + 1)));
    } finally {
      clearTimeout(timer);
    }
  }
  throw last;
}

async function getCoinGeckoPrices(ids) {
  const unique = [...new Set(ids)].filter(Boolean);
  if (!unique.length) return {};
  const key = process.env.COINGECKO_API_KEY || '';
  const qs = new URLSearchParams({ ids:unique.join(','), vs_currencies:'usd' });
  if (key) qs.set('x_cg_demo_api_key', key);
  const json = await fetchJson('https://api.coingecko.com/api/v3/simple/price?' + qs.toString());
  const out = {};
  for (const id of unique) {
    const v = Number(json?.[id]?.usd);
    if (Number.isFinite(v) && v > 0) out[id] = v;
  }
  return out;
}

function productivityBreakdownMap(productivity) {
  const rows = productivity?.companies?.[FUND_NAME]?.breakdown || [];
  return new Map(rows.map(r => [r.principalId, r]));
}

function buildDailySnapshot({ generatedAt, positions, prices, productivity, previous }) {
  const breakdownMap = productivityBreakdownMap(productivity);
  const previousLatest = previous?.funds?.[FUND_NAME]?.latestSnapshot || null;
  const priceFallbackMap = new Map((productivity?.companies?.[FUND_NAME]?.breakdown || []).map(r => [r.principalId, Number(r.price)]));
  const priorPositionMap = new Map((previousLatest?.positions || []).map(r => [r.principalId, Number(r.price)]));

  const company = productivity?.companies?.[FUND_NAME] || {};
  const referenceApr = Number(company.aprLatest);
  const rows = [];
  let totalValue = 0;
  let pricedValue = 0;
  let coveredValue = 0;
  let weightedApr = 0;
  const fallbackPrices = [];
  const missingPrices = [];

  for (const p of positions) {
    const productiveRow = breakdownMap.get(p.id) || null;
    let price;
    let priceSource;

    if (p.fixed !== undefined) {
      price = Number(p.fixed);
      priceSource = 'company-book-fixed';
    } else if (Number.isFinite(Number(prices[p.id])) && Number(prices[p.id]) > 0) {
      price = Number(prices[p.id]);
      priceSource = 'coingecko';
    } else if (Number.isFinite(priceFallbackMap.get(p.id)) && priceFallbackMap.get(p.id) > 0) {
      price = priceFallbackMap.get(p.id);
      priceSource = 'weekly-productivity-fallback';
      fallbackPrices.push(p.id);
    } else if (Number.isFinite(priorPositionMap.get(p.id)) && priorPositionMap.get(p.id) > 0) {
      price = priorPositionMap.get(p.id);
      priceSource = 'previous-daily-fallback';
      fallbackPrices.push(p.id);
    } else {
      price = NaN;
      priceSource = 'missing';
      missingPrices.push(p.id);
    }

    const value = Number.isFinite(price) ? Number(p.qty) * price : NaN;
    const apr = Number(productiveRow?.apr);
    const aprOk = Number.isFinite(apr) && apr >= 0;

    if (Number.isFinite(value) && value >= 0) {
      totalValue += value;
      pricedValue += value;
      if (aprOk) {
        coveredValue += value;
        weightedApr += value * apr;
      }
    }

    rows.push({
      principalId:p.id,
      units:Number(p.qty),
      price:Number.isFinite(price) ? round(price, 8) : null,
      valueUsd:Number.isFinite(value) ? round(value, 2) : null,
      priceSource,
      engineId:productiveRow?.engineId || null,
      referenceApr:aprOk ? round(apr, 4) : null,
      engineStatus:productiveRow?.engineStatus || null
    });
  }

  const internalCoveredApr = coveredValue > 0 ? weightedApr / coveredValue : NaN;
  const publicReferenceApr = Number.isFinite(referenceApr) && referenceApr >= 0 ? referenceApr : internalCoveredApr;
  const modeledDailyCashFlow = totalValue > 0 && Number.isFinite(publicReferenceApr)
    ? totalValue * (publicReferenceApr / 100) / 365
    : NaN;

  return {
    date:dayKey(new Date(generatedAt)),
    capturedAt:generatedAt,
    totalValueUsd:totalValue > 0 ? round(totalValue, 2) : null,
    coveredValueUsd:coveredValue > 0 ? round(coveredValue, 2) : 0,
    coverage:totalValue > 0 ? round(coveredValue / totalValue, 6) : 0,
    referenceApr:Number.isFinite(publicReferenceApr) ? round(publicReferenceApr, 4) : null,
    modeledDailyCashFlowUsd:Number.isFinite(modeledDailyCashFlow) ? round(modeledDailyCashFlow, 6) : null,
    productivitySnapshotAt:productivity?.generatedAt || null,
    priceStatus:missingPrices.length ? 'partial' : (fallbackPrices.length ? 'fallback' : 'fresh'),
    fallbackPrices,
    missingPrices,
    positions:rows
  };
}

function aggregateAutoMonths(daily, now = new Date()) {
  const groups = new Map();
  for (const row of daily) {
    if (!row?.date) continue;
    const key = row.date.slice(0, 7);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }

  const currentMonthKey = monthKeyFromDate(now);
  const out = {};

  for (const [key, rowsRaw] of groups.entries()) {
    const rows = rowsRaw.slice().sort((a, b) => String(a.date).localeCompare(String(b.date)));
    const good = rows.filter(r => Number.isFinite(Number(r.totalValueUsd)) && Number(r.totalValueUsd) > 0 && Number.isFinite(Number(r.referenceApr)) && Number(r.referenceApr) >= 0);
    if (!good.length) continue;

    const [year, month] = key.split('-').map(Number);
    const totalTvl = good.reduce((s, r) => s + Number(r.totalValueUsd), 0);
    const averageTvl = totalTvl / good.length;
    const weightedReferenceApr = totalTvl > 0
      ? good.reduce((s, r) => s + Number(r.totalValueUsd) * Number(r.referenceApr), 0) / totalTvl
      : NaN;
    const observedReferenceCashFlow = good.reduce((s, r) => {
      const explicit = Number(r.modeledDailyCashFlowUsd);
      if (Number.isFinite(explicit)) return s + explicit;
      return s + Number(r.totalValueUsd) * (Number(r.referenceApr) / 100) / 365;
    }, 0);
    const isCurrent = key === currentMonthKey;
    const fullMonthDays = daysInMonthUTC(year, month);
    const expectedDays = isCurrent ? now.getUTCDate() : fullMonthDays;
    const uniqueDays = new Set(good.map(r => r.date)).size;
    const coverageDaysPct = expectedDays > 0 ? uniqueDays / expectedDays * 100 : 0;
    const firstDay = Number(good[0].date.slice(8, 10));
    const partialPeriod = firstDay > 1 || coverageDaysPct < 80;

    // Current month shows genuine model-to-date. Once a month closes, any missed
    // daily samples (including the first automated month starting mid-month) are
    // normalized to a full calendar month using the observed average daily model.
    // This keeps the closed monthly row comparable to the legacy full-month rows
    // without pretending the normalized period was directly observed.
    const normalizationFactor = !isCurrent && uniqueDays > 0 && uniqueDays < fullMonthDays
      ? fullMonthDays / uniqueDays
      : 1;
    const referenceCashFlow = observedReferenceCashFlow * normalizationFactor;
    const monthlyYieldPct = averageTvl > 0 ? referenceCashFlow / averageTvl * 100 : NaN;
    const annualizedAprPct = isCurrent ? weightedReferenceApr : monthlyYieldPct * 12;

    out[key] = {
      month:key,
      label:monthLabel(key),
      status:isCurrent ? 'provisional' : (partialPeriod ? 'final-reference-partial' : 'final-reference'),
      mode:'reference-model',
      cashFlowUsd:round(referenceCashFlow, 2),
      referenceCashFlowUsd:round(referenceCashFlow, 2),
      observedReferenceCashFlowUsd:round(observedReferenceCashFlow, 2),
      normalizationFactor:round(normalizationFactor, 6),
      monthlyYieldPct:Number.isFinite(monthlyYieldPct) ? round(monthlyYieldPct, 4) : null,
      annualizedAprPct:Number.isFinite(annualizedAprPct) ? round(annualizedAprPct, 4) : null,
      averageReferenceAprPct:Number.isFinite(weightedReferenceApr) ? round(weightedReferenceApr, 4) : null,
      averageTvlUsd:round(averageTvl, 2),
      sampleDays:uniqueDays,
      expectedDays,
      sampleCoveragePct:round(coverageDaysPct, 2),
      partialPeriod,
      periodStart:good[0].date,
      periodEnd:good[good.length - 1].date,
      source:'the-holding-reporting-layer',
      note:isCurrent
        ? 'Live reference model. Current month remains provisional until the first daily run of the next month.'
        : (partialPeriod
          ? 'Final full-month reference estimate normalized from the observed daily sample because tracking did not cover every calendar day.'
          : 'Final reference model from daily productive TVL snapshots and validated Reference APR.')
    };
  }
  return out;
}

function buildYearSummary(months, year) {
  const prefix = String(year) + '-';
  const rows = Object.values(months)
    .filter(m => m?.month?.startsWith(prefix))
    .sort((a, b) => a.month.localeCompare(b.month));
  const closed = rows.filter(m => m.status !== 'provisional');
  const provisional = rows.find(m => m.status === 'provisional') || null;

  const cash = closed.reduce((s, m) => s + (Number(m.cashFlowUsd) || 0), 0);
  const yields = closed.map(m => Number(m.monthlyYieldPct)).filter(Number.isFinite);
  const ytdYield = yields.reduce((s, x) => s + x, 0);
  const annualized = yields.length ? avg(yields) * 12 : NaN;
  const best = closed
    .filter(m => Number.isFinite(Number(m.monthlyYieldPct)))
    .sort((a, b) => Number(b.monthlyYieldPct) - Number(a.monthlyYieldPct))[0] || null;
  const hasReference = closed.some(m => m.mode === 'reference-model');

  return {
    year,
    closedMonths:closed.length,
    ytdCashFlowUsd:round(cash, 2),
    ytdCashFlowEstimated:hasReference,
    ytdCashFlowYieldPct:round(ytdYield, 4),
    annualizedCashFlowAprPct:Number.isFinite(annualized) ? round(annualized, 4) : null,
    bestMonth:best ? best.month : null,
    bestMonthLabel:best ? best.label : null,
    bestMonthYieldPct:best ? round(Number(best.monthlyYieldPct), 4) : null,
    periodStart:closed[0]?.month || null,
    periodEnd:closed[closed.length - 1]?.month || null,
    currentMonth:provisional ? provisional.month : null,
    currentMonthReferenceCashFlowUsd:provisional ? provisional.cashFlowUsd : null,
    currentMonthYieldPct:provisional ? provisional.monthlyYieldPct : null,
    currentMonthAverageTvlUsd:provisional ? provisional.averageTvlUsd : null,
    modes:[...new Set(closed.map(m => m.mode))]
  };
}

async function main() {
  const generatedAt = nowIso();
  const [companyBook, productivity, previous] = await Promise.all([
    parseCompanyBook(),
    readJson(PRODUCTIVITY_DATA_FILE, {}),
    readJson(REPORTING_DATA_FILE, {})
  ]);

  const positions = companyBook?.[FUND_NAME];
  if (!Array.isArray(positions) || !positions.length) throw new Error(`${FUND_NAME} not found in COMPANY_BOOK`);
  if (!productivity?.companies?.[FUND_NAME]) throw new Error(`${FUND_NAME} not found in productivity-data.json`);

  const ids = positions.filter(p => p.fixed === undefined).map(p => p.id);
  let prices = {};
  try {
    prices = await getCoinGeckoPrices(ids);
  } catch (e) {
    console.warn('[CoinGecko] daily price request failed; falling back to latest central/previous prices:', e?.message || e);
  }

  const snapshot = buildDailySnapshot({ generatedAt, positions, prices, productivity, previous });
  const previousDaily = Array.isArray(previous?.funds?.[FUND_NAME]?.daily) ? previous.funds[FUND_NAME].daily : [];
  const byDate = new Map(previousDaily.map(r => [r.date, r]));
  byDate.set(snapshot.date, snapshot);
  const daily = [...byDate.values()]
    .filter(r => r?.date)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-MAX_DAILY_SNAPSHOTS);

  const autoMonths = aggregateAutoMonths(daily, new Date(generatedAt));
  const previousMonths = previous?.funds?.[FUND_NAME]?.months || {};

  // Legacy reported months are immutable. Any future reference-model month can be
  // replaced by a realised/onchain month later simply by changing its mode/source.
  const months = { ...previousMonths, ...LEGACY_MONTHS, ...autoMonths };
  for (const [key, legacy] of Object.entries(LEGACY_MONTHS)) months[key] = legacy;

  const years = [...new Set(Object.keys(months).map(k => Number(k.slice(0, 4))).filter(Number.isFinite))];
  const summaries = Object.fromEntries(years.map(y => [String(y), buildYearSummary(months, y)]));

  const output = {
    version:REPORTING_VERSION,
    methodologyVersion:METHODOLOGY_VERSION,
    generatedAt,
    note:'Daily Reporting Layer. Jan–Jul 2026 are preserved reported/realised Defitea history. Automated periods are reference-model estimates derived from daily productive TVL and the latest validated Defitea Reference APR; they are not claim accounting. Current month is provisional and closes automatically on the first daily run of the next month.',
    schedule:{ dailySnapshot:'04:37 UTC', productivityReference:'latest available weekly Productivity Intelligence snapshot' },
    funds:{
      [FUND_NAME]:{
        trackingStartedAt:daily[0]?.date || null,
        latestSnapshot:snapshot,
        daily,
        months,
        summaries
      }
    }
  };

  await writeJson(REPORTING_DATA_FILE, output);
  console.log(`✓ ${FUND_NAME} daily TVL: $${snapshot.totalValueUsd ?? '—'}`);
  console.log(`✓ ${FUND_NAME} Reference APR: ${snapshot.referenceApr ?? '—'}%`);
  console.log(`✓ ${snapshot.date} modeled daily cash flow: $${snapshot.modeledDailyCashFlowUsd ?? '—'}`);
  const current = autoMonths[monthKeyFromDate(new Date(generatedAt))];
  if (current) {
    console.log(`✓ ${current.month} provisional: avg TVL $${current.averageTvlUsd}, reference cash flow $${current.cashFlowUsd}, monthly yield ${current.monthlyYieldPct}%`);
  }
  console.log(`Wrote ${REPORTING_DATA_FILE}`);
}

main().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
