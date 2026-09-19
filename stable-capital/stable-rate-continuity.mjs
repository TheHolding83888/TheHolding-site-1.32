#!/usr/bin/env node
/**
 * THE HOLDING · STABLE RATE CONTINUITY GUARD v0.1
 *
 * Purpose:
 * - keep every productive Stable Index strategy numerically readable when a
 *   transient live adapter/RPC failure leaves the current rate unavailable;
 * - never invent a rate and never turn an unavailable rate into 0%;
 * - carry forward only the latest previously published finite rate for the
 *   exact same strategy id, with explicit provenance;
 * - leave Stable Capital aggregate coverage semantics untouched: a carried
 *   rate is display continuity, not fresh/full live coverage.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(process.cwd());
const DATA_FILE = process.env.STABLE_CAPITAL_DATA_FILE
  || path.join(ROOT, 'companies', 'stable-capital-data.json');
const REL_DATA_FILE = path.relative(ROOT, DATA_FILE).split(path.sep).join('/');
const VERSION = '0.1-stable-rate-last-known-good-continuity';

function finite(value) {
  return value !== null
    && value !== undefined
    && value !== ''
    && typeof value !== 'boolean'
    && Number.isFinite(Number(value));
}

function readJson(text, label) {
  try { return JSON.parse(text); }
  catch (error) { throw new Error(`Invalid JSON in ${label}: ${error.message}`); }
}

function historyCommits() {
  const out = execFileSync('git', [
    'log', '--format=%H', '--', REL_DATA_FILE
  ], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  return out.split(/\r?\n/).map(x => x.trim()).filter(Boolean);
}

function dataAtCommit(sha) {
  try {
    const text = execFileSync('git', ['show', `${sha}:${REL_DATA_FILE}`], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 8 * 1024 * 1024
    });
    return readJson(text, `${sha}:${REL_DATA_FILE}`);
  } catch {
    return null;
  }
}

function latestKnownRate(id, commits, cache) {
  for (const sha of commits) {
    let data = cache.get(sha);
    if (data === undefined) {
      data = dataAtCommit(sha);
      cache.set(sha, data);
    }
    if (!data) continue;
    const position = (data.positions || []).find(p => p?.id === id);
    if (!finite(position?.reference?.annualYieldPct)) continue;
    return {
      sha,
      generatedAt: data.generatedAt || null,
      reference: position.reference,
      annualYieldPct: Number(position.reference.annualYieldPct)
    };
  }
  return null;
}

function applyContinuity(current, lookup) {
  if (!Array.isArray(current?.positions) || current.positions.length !== 10) {
    throw new Error(`Stable rate continuity expects exactly 10 positions, got ${current?.positions?.length}`);
  }

  const carried = [];
  const missing = [];
  const carriedAt = new Date().toISOString();

  for (const position of current.positions) {
    if (position?.productive !== true) continue;
    const liveReference = position.reference || {};

    // A genuine finite live rate, including a legitimate 0%, is preserved exactly.
    if (finite(liveReference.annualYieldPct)) continue;

    const previous = lookup(position.id);
    if (!previous || !finite(previous.annualYieldPct)) {
      missing.push(position.id);
      continue;
    }

    position.reference = {
      ...previous.reference,
      status: 'last-known-good',
      annualYieldPct: Number(previous.annualYieldPct),
      continuity: {
        version: VERSION,
        mode: 'last-known-good',
        sourceCommit: previous.sha,
        sourceGeneratedAt: previous.generatedAt,
        carriedAt,
        liveStatus: liveReference.status || 'missing',
        liveError: liveReference.error || null,
        liveAttempts: Array.isArray(liveReference.attempts)
          ? liveReference.attempts.map(x => ({ url: x?.url || null, error: x?.error || null }))
          : null
      }
    };

    carried.push({
      id: position.id,
      annualYieldPct: Number(previous.annualYieldPct),
      sourceCommit: previous.sha,
      sourceGeneratedAt: previous.generatedAt,
      liveStatus: liveReference.status || 'missing'
    });
  }

  if (missing.length) {
    throw new Error(`No historical finite rate available for productive strategies: ${missing.join(', ')}`);
  }

  const unresolved = current.positions
    .filter(p => p?.productive === true && !finite(p?.reference?.annualYieldPct))
    .map(p => p.id);
  if (unresolved.length) {
    throw new Error(`Productive Stable rates still unresolved after continuity guard: ${unresolved.join(', ')}`);
  }

  current.rateContinuity = {
    version: VERSION,
    policy: 'live-first; latest previously published finite rate for exact strategy id on transient live unavailability; never synthesize zero',
    carriedCount: carried.length,
    carried,
    appliedAt: carriedAt
  };

  return { current, carried };
}

function selfTest() {
  const base = {
    positions: Array.from({ length: 10 }, (_, i) => ({
      id: `p${i}`,
      productive: true,
      reference: { status: 'ok', annualYieldPct: i === 0 ? 0 : i + 0.25 }
    }))
  };
  base.positions[1].reference = { status: 'warming-provider', annualYieldPct: null, error: 'temporary RPC failure' };

  const result = applyContinuity(structuredClone(base), id => {
    if (id !== 'p1') return null;
    return {
      sha: 'abc123',
      generatedAt: '2026-09-01T00:00:00.000Z',
      annualYieldPct: 3.17,
      reference: { status: 'ok', annualYieldPct: 3.17, sourceType: 'test-history' }
    };
  });

  const p0 = result.current.positions[0];
  const p1 = result.current.positions[1];
  if (p0.reference.annualYieldPct !== 0 || p0.reference.status !== 'ok') {
    throw new Error('Self-test failed: legitimate live 0% must remain live 0%');
  }
  if (p1.reference.annualYieldPct !== 3.17 || p1.reference.status !== 'last-known-good') {
    throw new Error('Self-test failed: missing live rate must receive exact historical LKG');
  }
  if (result.carried.length !== 1) throw new Error('Self-test failed: expected exactly one carried rate');
  console.log('Stable rate continuity self-test OK.');
}

function main() {
  if (process.argv.includes('--self-test')) {
    selfTest();
    return;
  }

  const current = readJson(fs.readFileSync(DATA_FILE, 'utf8'), DATA_FILE);
  const commits = historyCommits();
  if (!commits.length) throw new Error(`No git history found for ${REL_DATA_FILE}`);
  const cache = new Map();

  const { current: patched, carried } = applyContinuity(
    current,
    id => latestKnownRate(id, commits, cache)
  );

  fs.writeFileSync(DATA_FILE, JSON.stringify(patched, null, 2) + '\n');
  console.log(JSON.stringify({
    version: VERSION,
    carriedCount: carried.length,
    carried: carried.map(x => ({ id: x.id, annualYieldPct: x.annualYieldPct, liveStatus: x.liveStatus }))
  }, null, 2));
}

main();
