#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const OBSERVER_VERSION = '0.2.1-autonomous-change-intelligence-memory-vault';
export const SYSTEM_MEMORY_VERSION = '0.2.1-system-memory';
export const CANONICAL_ECONOMIC_SOURCES = Object.freeze([
  'productivity',
  'rewards',
  'stableCapital',
  'stableIndex',
  'embeddedLedger',
  'reporting',
]);
export const FRESHNESS_SCOPES = Object.freeze({
  global: Object.freeze({
    description: 'All Observer economic sources must be fresh.',
    requiredSources: 'all',
  }),
  'economic-graph-recovery': Object.freeze({
    description: 'Only direct canonical Economic Graph data dependencies must be fresh; unrelated stale sources remain visible but do not block this recovery lane.',
    requiredSources: Object.freeze(['productivity', 'rewards']),
  }),
});

function fail(message) {
  throw new Error(message);
}

function finiteNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizedFreshness(value) {
  return String(value ?? '').trim().toLowerCase();
}

export function evaluateCognitiveFreshness({
  change,
  memory,
  scope = 'global',
  nowMs = Date.now(),
  maxObserverAgeHours = null,
} = {}) {
  if (!change || typeof change !== 'object') fail('Observer payload missing');
  if (!memory || typeof memory !== 'object') fail('System Memory payload missing');
  if (change.version !== OBSERVER_VERSION) fail(`Unexpected Observer version: ${change.version}`);
  if (memory.version !== SYSTEM_MEMORY_VERSION) fail(`Unexpected System Memory version: ${memory.version}`);
  if (!change.bridge?.snapshotHash || change.bridge.snapshotHash !== memory.snapshotHash) {
    fail('Observer / System Memory snapshot mismatch');
  }
  if (change.generatedAt !== memory.generatedAt) fail('Observer / System Memory generatedAt mismatch');

  const generatedMs = Date.parse(change.generatedAt);
  const ageHours = (nowMs - generatedMs) / 3_600_000;
  if (!Number.isFinite(generatedMs) || !Number.isFinite(ageHours) || ageHours < -0.25) {
    fail('Observer generatedAt is invalid or materially in the future');
  }
  if (maxObserverAgeHours !== null && maxObserverAgeHours !== undefined) {
    const maxAge = finiteNumber(maxObserverAgeHours);
    if (maxAge === null || maxAge < 0) fail(`Invalid max Observer age: ${maxObserverAgeHours}`);
    if (ageHours > maxAge) {
      fail(`Observer age ${ageHours.toFixed(2)}h exceeds ${maxAge}h for scope ${scope}`);
    }
  }

  const health = change.sourceHealth;
  const sources = health?.sources;
  if (!health || !sources || typeof sources !== 'object' || Array.isArray(sources)) {
    fail('Observer sourceHealth.sources missing');
  }
  for (const key of CANONICAL_ECONOMIC_SOURCES) {
    if (!sources[key]) fail(`Canonical Observer source missing: ${key}`);
  }

  const sourceKeys = Object.keys(sources);
  const computedFresh = sourceKeys.filter((key) => normalizedFreshness(sources[key]?.freshness) === 'fresh');
  const computedAllFresh = computedFresh.length === sourceKeys.length;
  if (Number(health.sourceCount) !== sourceKeys.length) {
    fail(`Observer sourceCount drift: declared=${health.sourceCount} actual=${sourceKeys.length}`);
  }
  if (Number(health.freshCount) !== computedFresh.length) {
    fail(`Observer freshCount drift: declared=${health.freshCount} actual=${computedFresh.length}`);
  }
  if (Boolean(health.allFresh) !== computedAllFresh) {
    fail(`Observer allFresh drift: declared=${health.allFresh} actual=${computedAllFresh}`);
  }

  const policy = FRESHNESS_SCOPES[scope];
  if (!policy) fail(`Unknown cognitive freshness scope: ${scope}`);
  const requiredSources = policy.requiredSources === 'all' ? sourceKeys : [...policy.requiredSources];
  const blockingSources = requiredSources.filter(
    (key) => !sources[key] || normalizedFreshness(sources[key]?.freshness) !== 'fresh'
  );
  if (blockingSources.length) {
    fail(`Required source freshness failed for scope ${scope}: ${blockingSources.join(', ')}`);
  }

  const unrelatedStaleSources = sourceKeys.filter(
    (key) => !requiredSources.includes(key) && normalizedFreshness(sources[key]?.freshness) !== 'fresh'
  );

  return {
    status: 'pass',
    scope,
    observerGeneratedAt: change.generatedAt,
    observerAgeHours: Number(ageHours.toFixed(3)),
    snapshotHash: change.bridge.snapshotHash,
    allEconomicSourcesFresh: computedAllFresh,
    requiredSources,
    unrelatedStaleSources,
  };
}

function parseCli(argv) {
  const out = { scope: 'global', maxObserverAgeHours: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--scope') out.scope = argv[++i];
    else if (arg.startsWith('--scope=')) out.scope = arg.slice('--scope='.length);
    else if (arg === '--max-observer-age-hours') out.maxObserverAgeHours = argv[++i];
    else if (arg.startsWith('--max-observer-age-hours=')) out.maxObserverAgeHours = arg.slice('--max-observer-age-hours='.length);
    else fail(`Unknown argument: ${arg}`);
  }
  if (!out.scope) fail('Freshness scope is required');
  return out;
}

async function main() {
  const args = parseCli(process.argv.slice(2));
  const root = process.cwd();
  const changePath = process.env.CHANGE_INTELLIGENCE_FILE || path.join(root, 'intelligence', 'change-intelligence.json');
  const memoryPath = process.env.SYSTEM_MEMORY_FILE || path.join(root, 'intelligence', 'system-memory.json');
  const change = JSON.parse(fs.readFileSync(changePath, 'utf8'));
  const memory = JSON.parse(fs.readFileSync(memoryPath, 'utf8'));
  const receipt = evaluateCognitiveFreshness({
    change,
    memory,
    scope: args.scope,
    maxObserverAgeHours: args.maxObserverAgeHours,
  });
  console.log('COGNITIVE FRESHNESS SCOPE PASS', receipt);
}

if (path.resolve(process.argv[1] || '') === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error?.stack || error);
    process.exit(1);
  });
}
