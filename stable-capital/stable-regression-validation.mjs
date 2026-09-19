#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHistoricalRpcCoordinator } from './historical-rpc-coordinator.mjs';

const root = path.resolve(process.cwd());
const fixedNow = Date.UTC(2026, 8, 19, 12, 0, 0);
const coordinator = createHistoricalRpcCoordinator({ observedAtMs: fixedNow });

assert.equal(
  coordinator.targetTimestamp(7),
  Math.floor(fixedNow / 1000) - 7 * 86400,
  'shared seven-day target timestamp drifted'
);

let active = 0;
let maxActive = 0;
const order = [];
await Promise.all([1, 2, 3, 4].map(id => coordinator.run(async () => {
  active += 1;
  maxActive = Math.max(maxActive, active);
  order.push(`start-${id}`);
  await new Promise(resolve => setTimeout(resolve, 4));
  order.push(`end-${id}`);
  active -= 1;
})));
assert.equal(maxActive, 1, 'archive workloads were not serialized');
assert.deepEqual(order, [
  'start-1', 'end-1', 'start-2', 'end-2',
  'start-3', 'end-3', 'start-4', 'end-4'
], 'archive workload order drifted');

let resolveCount = 0;
const resolver = async (_provider, targetTs) => {
  resolveCount += 1;
  await new Promise(resolve => setTimeout(resolve, 4));
  return { number: 123, timestamp: targetTs };
};
const [firstBlock, secondBlock] = await Promise.all([
  coordinator.blockAtOrBefore({ provider: {}, providerKey: 'archive.example', days: 7, resolve: resolver }),
  coordinator.blockAtOrBefore({ provider: {}, providerKey: 'archive.example', days: 7, resolve: resolver })
]);
assert.equal(resolveCount, 1, 'shared historical block was resolved more than once');
assert.equal(firstBlock, secondBlock, 'shared historical block promise was not reused');

let retryCount = 0;
const retryCoordinator = createHistoricalRpcCoordinator({ observedAtMs: fixedNow });
await assert.rejects(() => retryCoordinator.blockAtOrBefore({
  provider: {}, providerKey: 'retry.example', days: 7,
  resolve: async () => {
    retryCount += 1;
    throw new Error('temporary RPC failure');
  }
}), /temporary RPC failure/);
const recovered = await retryCoordinator.blockAtOrBefore({
  provider: {}, providerKey: 'retry.example', days: 7,
  resolve: async (_provider, targetTs) => {
    retryCount += 1;
    return { number: 456, timestamp: targetTs };
  }
});
assert.equal(retryCount, 2, 'failed historical block lookup was not evicted');
assert.equal(recovered.number, 456, 'historical block retry did not recover');

const engine = fs.readFileSync(path.join(root, 'stable-capital', 'stable-capital-engine.mjs'), 'utf8');
assert.match(engine, /archiveRpc\.run\(/, 'Stable engine bypasses the shared archive queue');
assert.match(engine, /archiveRpc\.blockAtOrBefore\(/, 'Stable engine bypasses the shared historical block');
assert.match(engine, /ETH_ARCHIVE_BLOCK_NUMBER/, 'Stable engine does not consume the proven historical block number');
assert.match(engine, /ETH_ARCHIVE_BLOCK_TIMESTAMP/, 'Stable engine does not consume the proven historical block timestamp');
assert.match(engine, /return PROVEN_HISTORY_BLOCK;/, 'Stable engine repeats timestamp search instead of reusing selector evidence');
assert.match(engine, /\[stable-archive\] reuse proven block/, 'Stable production logs cannot prove block-handoff reuse');

const selector = fs.readFileSync(path.join(root, 'stable-capital', 'rpc-capability-selector.mjs'), 'utf8');
assert.match(selector, /ETH_ARCHIVE_BLOCK_NUMBER/, 'RPC selector does not hand off the proven historical block number');
assert.match(selector, /ETH_ARCHIVE_BLOCK_TIMESTAMP/, 'RPC selector does not hand off the proven historical block timestamp');
assert.match(selector, /DEFAULT_HISTORY_BLOCK_DISTANCE = 50_500/, 'RPC selector no longer proves a block at or before seven days');

const html = fs.readFileSync(path.join(root, 'companies', 'index.html'), 'utf8');
assert.ok(!html.includes('Number(p.referenceApyPct)'), 'Stable strategy UNKNOWN can still become numeric zero');
assert.ok(html.includes('const aprText = stablePct(p.referenceApyPct, 2);'), 'Stable strategy truth formatter missing');
assert.ok(html.includes('const bookAprText = stablePct(company && company.displayReferenceApyPct, 2);'), 'Stable book truth formatter missing');

console.log('Stable archive coordination + UNKNOWN UI truth regression validation PASS');
