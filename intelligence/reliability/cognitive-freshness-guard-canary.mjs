#!/usr/bin/env node
import { evaluateCognitiveFreshness } from './cognitive-freshness-guard.mjs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
function expectFail(label, fn, pattern) {
  let failed = false;
  try { fn(); }
  catch (error) {
    failed = true;
    if (pattern && !pattern.test(String(error?.message || error))) {
      throw new Error(`${label}: unexpected failure: ${error?.message || error}`);
    }
  }
  if (!failed) throw new Error(`${label}: expected failure`);
}

const nowMs = Date.parse('2026-08-27T06:00:00.000Z');
const sourceNames = ['productivity','rewards','stableCapital','stableIndex','embeddedLedger','reporting'];
function fixture({ stale = [], generatedAt = '2026-08-27T05:44:53.606Z' } = {}) {
  const sources = Object.fromEntries(sourceNames.map((key) => [key, {
    file: `fixture/${key}.json`,
    freshness: stale.includes(key) ? 'stale' : 'fresh',
  }]));
  const freshCount = sourceNames.filter((key) => !stale.includes(key)).length;
  const change = {
    version: '0.2.1-autonomous-change-intelligence-memory-vault',
    generatedAt,
    bridge: { snapshotHash: 'snapshot-1' },
    sourceHealth: {
      allFresh: freshCount === sourceNames.length,
      freshCount,
      sourceCount: sourceNames.length,
      sources,
    },
  };
  const memory = {
    version: '0.2.1-system-memory',
    generatedAt,
    snapshotHash: 'snapshot-1',
  };
  return { change, memory };
}

{
  const { change, memory } = fixture();
  const global = evaluateCognitiveFreshness({ change, memory, scope: 'global', nowMs });
  const graph = evaluateCognitiveFreshness({ change, memory, scope: 'economic-graph-recovery', nowMs });
  assert(global.allEconomicSourcesFresh === true, 'global fresh fixture should be fully fresh');
  assert(graph.requiredSources.join(',') === 'productivity,rewards', 'graph recovery dependency set drift');
}

{
  const { change, memory } = fixture({ stale: ['reporting'] });
  expectFail('global stale reporting', () => evaluateCognitiveFreshness({ change, memory, scope: 'global', nowMs }), /reporting/);
  const graph = evaluateCognitiveFreshness({ change, memory, scope: 'economic-graph-recovery', nowMs });
  assert(graph.allEconomicSourcesFresh === false, 'global stale state must remain visible');
  assert(graph.unrelatedStaleSources.length === 1 && graph.unrelatedStaleSources[0] === 'reporting', 'stale Reporting must remain explicit but non-blocking for graph recovery');
}

for (const key of ['productivity', 'rewards']) {
  const { change, memory } = fixture({ stale: [key] });
  expectFail(`graph dependency stale ${key}`, () => evaluateCognitiveFreshness({ change, memory, scope: 'economic-graph-recovery', nowMs }), new RegExp(key));
}

{
  const { change, memory } = fixture();
  memory.snapshotHash = 'different';
  expectFail('snapshot mismatch', () => evaluateCognitiveFreshness({ change, memory, scope: 'economic-graph-recovery', nowMs }), /snapshot mismatch/);
}

{
  const { change, memory } = fixture();
  expectFail('unknown scope', () => evaluateCognitiveFreshness({ change, memory, scope: 'invented', nowMs }), /Unknown cognitive freshness scope/);
}

{
  const { change, memory } = fixture({ generatedAt: '2026-08-27T03:00:00.000Z' });
  expectFail('observer age', () => evaluateCognitiveFreshness({ change, memory, scope: 'economic-graph-recovery', nowMs, maxObserverAgeHours: 1 }), /exceeds 1h/);
}

{
  const { change, memory } = fixture({ stale: ['reporting'] });
  change.sourceHealth.allFresh = true;
  expectFail('health summary drift', () => evaluateCognitiveFreshness({ change, memory, scope: 'economic-graph-recovery', nowMs }), /allFresh drift/);
}

console.log('COGNITIVE FRESHNESS GUARD CANARY PASS', {
  globalScopeStillFailClosed: true,
  graphRecoveryDependencies: ['productivity','rewards'],
  unrelatedReportingStalenessVisibleButNonBlocking: true,
  snapshotBindingRequired: true,
  observerAgeGuarded: true,
  unknownScopeFailClosed: true,
});
