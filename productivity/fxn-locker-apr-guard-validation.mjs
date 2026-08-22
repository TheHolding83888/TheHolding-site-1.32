#!/usr/bin/env node
import assert from 'node:assert/strict';
import { applyExactFxnLockerApr, extractFxnLockerApr } from './fxn-locker-apr-guard.mjs';

// Canonical layout: exact Locker block.
assert.equal(
  extractFxnLockerApr(['FXN Locker Lock FXN and earn rewards APR 76.61% Total locked $1,234,567']),
  76.61
);

// A foreign APR before the Locker block must never win.
assert.equal(
  extractFxnLockerApr(['Market overview APR 4.20% Some card FXN Locker Voting power APR 76.61% Rewards']),
  76.61
);

// Support layouts that render the value before the APR label inside the same Locker scope.
assert.equal(
  extractFxnLockerApr(['FXN Locker Weekly rewards 33.90% APR Claim fees']),
  33.9
);

// Duplicate DOM copies with the same exact value remain unambiguous.
assert.equal(
  extractFxnLockerApr([
    'FXN Locker APR 26.10%',
    'Mobile drawer FXN Locker APR 26.10%'
  ]),
  26.1
);

// Divergent Locker values are ambiguous and must fail closed.
assert.throws(
  () => extractFxnLockerApr(['FXN Locker APR 26.10%', 'FXN Locker APR 76.61%']),
  /expected one unambiguous FXN Locker APR/
);

// Generic page APR without the Locker label is not admissible.
assert.throws(
  () => extractFxnLockerApr(['APR 76.61% Total protocol rewards']),
  /expected one unambiguous FXN Locker APR/
);

// The exact-source authority repairs only the materialized current snapshot.
const report={engines:{fx_vefxn:{apr:21.1,status:'ok',source:'https://fx.aladdin.club/v2/lock',sourceMetric:'veFXN Locker APR'}}};
const data={
  snapshotKey:'2026-W34',
  companies:{
    'defitea.eth':{
      breakdown:[
        {engineId:'fx_vefxn',principalId:'fxn-token',value:100,apr:21.1,engineStatus:'ok'},
        {engineId:'other',principalId:'other',value:100,apr:10,engineStatus:'ok'}
      ],
      productiveValue:200,coveredProductiveValue:200,coverage:1,aprLatest:15.55,aprHistoricalAverage:12,observationCount:2
    }
  },
  history:{companies:{'defitea.eth':[
    {snapshotKey:'2026-W33',apr:12},
    {snapshotKey:'2026-W34',apr:15.55}
  ]}}
};
const corrected=applyExactFxnLockerApr(report,data,77.08);
assert.deepEqual(corrected,{previousApr:21.1,exactApr:77.08,adjustedCompanies:1});
assert.equal(report.engines.fx_vefxn.apr,77.08);
assert.equal(report.engines.fx_vefxn.sourceType,'official-frontend-exact-block');
assert.equal(data.companies['defitea.eth'].breakdown[0].apr,77.08);
assert.equal(data.companies['defitea.eth'].aprLatest,43.54);
assert.equal(data.history.companies['defitea.eth'][0].apr,12); // immutable prior snapshot
assert.equal(data.history.companies['defitea.eth'][1].apr,43.54); // current snapshot only
assert.equal(data.companies['defitea.eth'].aprHistoricalAverage,27.77);
assert.equal(data.diagnostics.fxnLockerAprAuthority.historicalSnapshotsRewritten,false);

console.log('f(x) exact-source APR parser + current-snapshot authority validation PASS');
