#!/usr/bin/env node
/**
 * The Holding · f(x) veFXN exact-source APR guard v0.1
 *
 * Purpose: prevent the Productivity collector from publishing a percentage
 * taken from the wrong part of the dynamic f(x) page. The canonical collector
 * may still produce any economically valid APR, including a high one; this
 * guard only requires that the value exactly matches the APR scoped to the
 * official "FXN Locker" block.
 *
 * Fail closed on ambiguity, missing source data, or mismatch.
 * No execution authority. No economic-methodology mutation.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPORT_FILE = process.env.REPORT_FILE || path.join(ROOT, 'companies/productivity-source-report.json');
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

async function readCollectorApr() {
  const report = JSON.parse(await fs.readFile(REPORT_FILE, 'utf8'));
  const engine = report?.engines?.fx_vefxn;
  const apr = Number(engine?.apr);
  if (engine?.status !== 'ok' || !saneApr(apr)) {
    throw new Error('f(x) exact-source guard: canonical fx_vefxn collector result unavailable');
  }
  if (engine?.source !== FXN_LOCK_URL || engine?.sourceMetric !== 'veFXN Locker APR') {
    throw new Error('f(x) exact-source guard: collector source contract drift');
  }
  return apr;
}

export async function verifyFxnLockerApr() {
  const [collectorApr, exactApr] = await Promise.all([readCollectorApr(), collectExactFxnLockerApr()]);
  if (Math.abs(collectorApr - exactApr) > MATCH_TOLERANCE_PCT) {
    throw new Error(`f(x) exact-source guard: collector ${collectorApr}% != exact FXN Locker ${exactApr}%`);
  }
  return { collectorApr, exactApr, source: FXN_LOCK_URL, sourceMetric: 'veFXN Locker APR' };
}

async function main() {
  if (process.argv.includes('--probe-only')) {
    const exactApr = await collectExactFxnLockerApr();
    console.log('f(x) exact-source probe PASS', { exactApr, source: FXN_LOCK_URL, sourceMetric: 'veFXN Locker APR' });
    return;
  }
  const result = await verifyFxnLockerApr();
  console.log('f(x) exact-source guard PASS', result);
}

if (path.resolve(process.argv[1] || '') === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    console.error(error?.stack || error);
    process.exit(1);
  });
}
