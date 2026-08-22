#!/usr/bin/env node
/**
 * The Holding · f(x) veFXN exact-source APR authority guard v0.2
 *
 * The legacy collector can observe the dynamic f(x) page but historically
 * selected the first generic APR before falling back to the FXN Locker scope.
 * This layer makes the exact official FXN Locker block authoritative at the
 * post-collection publication boundary, repairs only the current snapshot,
 * then verifies the materialized output before either canonical writer can
 * publish it.
 *
 * Fail closed on ambiguity or missing source data.
 * No execution authority. No economic-methodology mutation.
 */

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
function round(n, d=4) {
  const p=10**d;
  return Math.round(Number(n)*p)/p;
}

export function extractFxnLockerApr(blocks) {
  const values = [];
  for (const raw of Array.isArray(blocks) ? blocks : []) {
    const text = normalizeText(raw);
    const start = text.toLowerCase().indexOf('fxn locker');
    if (start < 0) continue;
    const scoped = text.slice(start, start + 420);
    const patterns = [
      /FXN Locker.{0,220}?\bAPR\b.{0,90}?([0-9]+(?:[.,][0-9]+)?)\s*%/i,
      /FXN Locker.{0,220}?([0-9]+(?:[.,][0-9]+)?)\s*%.{0,90}?\bAPR\b/i
    ];
    for (const pattern of patterns) {
      const match = scoped.match(pattern);
      if (!match) continue;
      const apr = percentValue(match[1]);
      if (saneApr(apr)) values.push(apr);
      break;
    }
  }
  const unique = [...new Set(values.map(v => Number(v.toFixed(4))))];
  if (unique.length !== 1) {
    throw new Error(`f(x) exact-source guard: expected one unambiguous FXN Locker APR, found ${unique.length}`);
  }
  return unique[0];
}

export function applyExactFxnLockerApr(report, data, exactApr) {
  if (!saneApr(Number(exactApr))) throw new Error('f(x) exact-source authority: invalid APR');
  const engine=report?.engines?.fx_vefxn;
  if (!engine) throw new Error('f(x) exact-source authority: fx_vefxn source-report engine missing');
  const previousApr=Number(engine.apr);
  engine.apr=round(exactApr);
  engine.status='ok';
  engine.source=FXN_LOCK_URL;
  engine.sourceType='official-frontend-exact-block';
  engine.sourceMetric='veFXN Locker APR';
  engine.error=null;
  engine.details={...(engine.details||{}),exactSourceAuthority:'FXN Locker block',collectorAprBeforeExactSourceAuthority:Number.isFinite(previousApr)?previousApr:null};

  let adjustedCompanies=0;
  for (const [companyName,company] of Object.entries(data?.companies||{})) {
    if (!Array.isArray(company?.breakdown)) continue;
    const rows=company.breakdown.filter(row=>row?.engineId==='fx_vefxn'||row?.principalId==='fxn-token');
    if (!rows.length) continue;
    for (const row of rows) {
      row.apr=round(exactApr);
      row.engineStatus='ok';
    }
    let productive=0,covered=0,weighted=0;
    for (const row of company.breakdown) {
      const value=Number(row.value);
      if (Number.isFinite(value)&&value>=0) productive+=value;
      const apr=Number(row.apr);
      const usable=Number.isFinite(value)&&value>=0&&Number.isFinite(apr)&&row.engineStatus!=='warming'&&row.engineStatus!=='unavailable';
      if (usable) { covered+=value; weighted+=value*apr; }
    }
    if (!(productive>0)||!(covered>0)) throw new Error(`f(x) exact-source authority: ${companyName} aggregate unavailable`);
    company.productiveValue=round(productive,2);
    company.coveredProductiveValue=round(covered,2);
    company.coverage=round(covered/productive,6);
    company.aprLatest=round(weighted/covered,4);
    company.aprScope=company.coverage>=0.999999?'full-productive-capital':'covered-productive-capital';

    const history=data?.history?.companies?.[companyName];
    if (Array.isArray(history)&&history.length) {
      const latest=history.at(-1);
      if (latest&&latest.snapshotKey===data.snapshotKey) latest.apr=company.aprLatest;
      const valid=history.map(x=>Number(x.apr)).filter(Number.isFinite);
      if (valid.length) {
        company.aprHistoricalAverage=round(valid.reduce((s,x)=>s+x,0)/valid.length,4);
        company.observationCount=valid.length;
      }
    }
    adjustedCompanies++;
  }
  if (!adjustedCompanies) throw new Error('f(x) exact-source authority: no fx_vefxn company rows found');

  data.diagnostics=data.diagnostics||{};
  data.diagnostics.fxnLockerAprAuthority={
    version:'0.2-exact-official-block-authority',
    source:FXN_LOCK_URL,
    sourceMetric:'veFXN Locker APR',
    previousCollectorApr:Number.isFinite(previousApr)?previousApr:null,
    exactApr:round(exactApr),
    adjustedCompanies,
    historicalSnapshotsRewritten:false,
    executionAuthority:'none'
  };
  return { previousApr:Number.isFinite(previousApr)?previousApr:null, exactApr:round(exactApr), adjustedCompanies };
}

async function collectExactFxnLockerApr() {
  const { chromium } = await import('playwright');
  let lastError;
  for (let attempt = 1; attempt <= 2; attempt++) {
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0 Safari/537.36'
      });
      await page.goto(FXN_LOCK_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(6000);
      const blocks = await page.evaluate(() => {
        const norm = value => String(value || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
        const nodes = Array.from(document.querySelectorAll('body *')).filter(el => norm(el.textContent) === 'FXN Locker');
        const out = [];
        for (const label of nodes) {
          let node = label;
          for (let depth = 0; node && depth < 8; depth++, node = node.parentElement) {
            const text = norm(node.innerText || node.textContent);
            if (/\bAPR\b/i.test(text) && /[0-9]+(?:[.,][0-9]+)?\s*%/.test(text)) {
              out.push(text);
              break;
            }
          }
        }
        return out;
      });
      return extractFxnLockerApr(blocks);
    } catch (error) {
      lastError = error;
      if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 1200));
    } finally {
      await browser.close();
    }
  }
  throw lastError || new Error('f(x) exact-source guard: source probe failed');
}

async function readMaterializedApr() {
  const report = JSON.parse(await fs.readFile(REPORT_FILE, 'utf8'));
  const engine = report?.engines?.fx_vefxn;
  const apr = Number(engine?.apr);
  if (engine?.status !== 'ok' || !saneApr(apr)) throw new Error('f(x) exact-source guard: materialized fx_vefxn result unavailable');
  if (engine?.source !== FXN_LOCK_URL || engine?.sourceMetric !== 'veFXN Locker APR') throw new Error('f(x) exact-source guard: materialized source contract drift');
  return apr;
}

export async function synchronizeFxnLockerApr() {
  const exactApr=await collectExactFxnLockerApr();
  const [reportRaw,dataRaw]=await Promise.all([fs.readFile(REPORT_FILE,'utf8'),fs.readFile(DATA_FILE,'utf8')]);
  const report=JSON.parse(reportRaw);
  const data=JSON.parse(dataRaw);
  const result=applyExactFxnLockerApr(report,data,exactApr);
  await Promise.all([
    fs.writeFile(REPORT_FILE,JSON.stringify(report,null,2)+'\n'),
    fs.writeFile(DATA_FILE,JSON.stringify(data,null,2)+'\n')
  ]);
  return result;
}

export async function verifyFxnLockerApr({ exactApr=null }={}) {
  const expected=saneApr(Number(exactApr))?Number(exactApr):await collectExactFxnLockerApr();
  const materializedApr=await readMaterializedApr();
  if (Math.abs(materializedApr-expected)>MATCH_TOLERANCE_PCT) throw new Error(`f(x) exact-source guard: materialized ${materializedApr}% != exact FXN Locker ${expected}%`);
  return { materializedApr, exactApr:round(expected), source:FXN_LOCK_URL, sourceMetric:'veFXN Locker APR' };
}

async function main() {
  if (process.argv.includes('--probe-only')) {
    const exactApr=await collectExactFxnLockerApr();
    console.log('f(x) exact-source probe PASS',{exactApr,source:FXN_LOCK_URL,sourceMetric:'veFXN Locker APR'});
    return;
  }
  const sync=await synchronizeFxnLockerApr();
  const verified=await verifyFxnLockerApr({exactApr:sync.exactApr});
  console.log('f(x) exact-source authority PASS',{...sync,...verified});
}

if (path.resolve(process.argv[1]||'')===fileURLToPath(import.meta.url)) {
  main().catch(error=>{console.error(error?.stack||error);process.exit(1);});
}
