#!/usr/bin/env node
import assert from 'node:assert/strict';
import { applyExactFxnLockerApr, extractFxnLockerApr, extractFxnLockerEconomicSnapshot } from './fxn-locker-apr-guard.mjs';

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

// Regression fixture from the live f(x) Locker: APR must bind to the APR label,
// while the nearby circulating-supply percentage remains a distinct metric.
const liveStyleBlock='FXN Locker APR 21.06% FXN Locked 533,612.38 77.07% of FXN Circulating Supply Total veFXN 467,272.21 3.50 Years Average Lock Total veFXN Revenue Cumulative This Week 0.33 wstETH Previous Week 7.98 wstETH Accumulate Till Aug 26, 2026 11:59 PM Lock FXN MAX APR CALC';
assert.equal(extractFxnLockerApr([liveStyleBlock]),21.06);
assert.notEqual(extractFxnLockerApr([liveStyleBlock]),77.07);

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

// Economic vitals are extracted only from the same exact Locker scope.
const economicBlock='FXN Locker APR 77.12% FXN Locked 512.40K 64.25% of FXN Circulating Supply Total veFXN 291.75K 2.4 years average lock Total veFXN Revenue Cumulative This Week 42.1256 wstETH Previous Week 11.2504 wstETH Accumulate Till Aug 27, 2026 Lock FXN MAX APR CALC';
const economic=extractFxnLockerEconomicSnapshot([economicBlock],{observedAt:'2026-08-24T10:00:00.000Z'});
assert.equal(economic.aprPct,77.12);
assert.equal(economic.fxnLocked,512400);
assert.equal(economic.fxnCirculatingSupplyLockedPct,64.25);
assert.equal(economic.totalVeFxn,291750);
assert.equal(economic.cumulativeThisWeekWsteth,42.1256);
assert.equal(economic.previousWeekWsteth,11.2504);
assert.equal(economic.averageLockRaw,'2.4 years');
assert.equal(economic.accumulateTillRaw,'Aug 27, 2026');
assert.equal(economic.nativeCadence,'weekly');
assert.equal(economic.executionAuthority,'none');
assert.match(economic.rawBlockHash,/^[a-f0-9]{64}$/);

const liveStyleEconomic=extractFxnLockerEconomicSnapshot([liveStyleBlock],{observedAt:'2026-08-24T10:57:24.694Z'});
assert.equal(liveStyleEconomic.aprPct,21.06);
assert.equal(liveStyleEconomic.fxnLocked,533612.38);
assert.equal(liveStyleEconomic.fxnCirculatingSupplyLockedPct,77.07);
assert.equal(liveStyleEconomic.totalVeFxn,467272.21);
assert.equal(liveStyleEconomic.cumulativeThisWeekWsteth,0.33);
assert.equal(liveStyleEconomic.previousWeekWsteth,7.98);
assert.equal(liveStyleEconomic.averageLockRaw,'3.50 Years');
assert.equal(liveStyleEconomic.accumulateTillRaw,'Aug 26, 2026 11:59 PM');

// Equivalent desktop/mobile copies remain admissible.
const economicDup=extractFxnLockerEconomicSnapshot([economicBlock,`Mobile ${economicBlock}`],{observedAt:'2026-08-24T10:00:00.000Z'});
assert.equal(economicDup.aprPct,77.12);
assert.equal(economicDup.totalVeFxn,291750);

// Missing driver context fails closed rather than fabricating an explanation.
assert.throws(
  () => extractFxnLockerEconomicSnapshot(['FXN Locker APR 77.12% FXN Locked 512.40K Total veFXN 291.75K']),
  /expected one unambiguous FXN Locker economic snapshot/
);

// Divergent vitals across duplicate Locker blocks are ambiguous and fail closed.
assert.throws(
  () => extractFxnLockerEconomicSnapshot([
    economicBlock,
    economicBlock.replace('42.1256 wstETH','41.0000 wstETH')
  ]),
  /expected one unambiguous FXN Locker economic snapshot/
);

// The exact-source authority repairs all canonical surfaces for only the
// materialized current snapshot. Prior engine/company history stays immutable.
const report={engines:{fx_vefxn:{apr:21.1,status:'ok',source:'https://fx.aladdin.club/v2/lock',sourceMetric:'veFXN Locker APR'}}};
const data={
  generatedAt:'2026-08-24T10:00:00.000Z',
  snapshotKey:'2026-W34',
  engines:{
    fx_vefxn:{
      engineId:'fx_vefxn',protocol:'f(x)',principalSymbol:'FXN',aprLatest:21.1,status:'ok',
      sourceUrl:'https://fx.aladdin.club/v2/lock',source:'https://fx.aladdin.club/v2/lock',
      sourceType:'official-frontend',sourceMetric:'veFXN Locker APR',details:{}
    }
  },
  companies:{
    'defitea.eth':{
      breakdown:[
        {engineId:'fx_vefxn',principalId:'fxn-token',value:100,apr:21.1,engineStatus:'ok'},
        {engineId:'other',principalId:'other',value:100,apr:10,engineStatus:'ok'}
      ],
      productiveValue:200,coveredProductiveValue:200,coverage:1,aprLatest:15.55,aprHistoricalAverage:12,observationCount:2
    }
  },
  history:{
    engines:{
      fx_vefxn:[
        {snapshotKey:'2026-W33',apr:12,sourceType:'official-frontend'},
        {snapshotKey:'2026-W34',apr:21.1,sourceType:'official-frontend'}
      ]
    },
    companies:{'defitea.eth':[
      {snapshotKey:'2026-W33',apr:12},
      {snapshotKey:'2026-W34',apr:15.55}
    ]}
  }
};
const corrected=applyExactFxnLockerApr(report,data,77.08);
assert.deepEqual(corrected,{previousApr:21.1,exactApr:77.08,adjustedCompanies:1});
assert.equal(report.engines.fx_vefxn.apr,77.08);
assert.equal(report.engines.fx_vefxn.sourceType,'official-frontend-exact-block');
assert.equal(data.engines.fx_vefxn.aprLatest,77.08);
assert.equal(data.engines.fx_vefxn.sourceType,'official-frontend-exact-block');
assert.equal(data.history.engines.fx_vefxn[0].apr,12); // immutable prior engine snapshot
assert.equal(data.history.engines.fx_vefxn[0].sourceType,'official-frontend');
assert.equal(data.history.engines.fx_vefxn[1].apr,77.08); // current engine snapshot only
assert.equal(data.history.engines.fx_vefxn[1].sourceType,'official-frontend-exact-block');
assert.equal(data.companies['defitea.eth'].breakdown[0].apr,77.08);
assert.equal(data.companies['defitea.eth'].aprLatest,43.54);
assert.equal(data.history.companies['defitea.eth'][0].apr,12); // immutable prior company snapshot
assert.equal(data.history.companies['defitea.eth'][1].apr,43.54); // current company snapshot only
assert.equal(data.companies['defitea.eth'].aprHistoricalAverage,27.77);
assert.equal(data.diagnostics.fxnLockerAprAuthority.version,'0.3.4-canonical-engine-parity-authority');
assert.equal(data.diagnostics.fxnLockerAprAuthority.previousCanonicalEngineApr,21.1);
assert.equal(data.diagnostics.fxnLockerAprAuthority.previousCurrentEngineHistoryApr,21.1);
assert.equal(data.diagnostics.fxnLockerAprAuthority.canonicalEngineSynchronized,true);
assert.equal(data.diagnostics.fxnLockerAprAuthority.currentEngineHistorySynchronized,true);
assert.equal(data.diagnostics.fxnLockerAprAuthority.historicalSnapshotsRewritten,false);
assert.equal(data.diagnostics.fxnLockerAprAuthority.nearbyCirculatingSupplyPctCannotBecomeApr,true);

// Missing current engine-history identity is an authority error, not something
// the guard is allowed to guess around.
const brokenData=structuredClone(data);
brokenData.snapshotKey='2026-W35';
assert.throws(
  () => applyExactFxnLockerApr(structuredClone(report),brokenData,21.06),
  /expected one current fx_vefxn engine-history snapshot/
);

console.log('f(x) exact-source APR + canonical-engine parity + economic-vitals validation PASS');
