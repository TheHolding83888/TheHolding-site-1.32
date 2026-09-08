#!/usr/bin/env node
import assert from 'node:assert/strict';
import { buildAccountingCoverage } from './accounting-coverage.mjs';

const generatedAt='2026-09-03T00:00:00.000Z';
const productivity={
  generatedAt,
  engines:{aerodrome_veaero:{protocol:'Aerodrome'},velodrome_vevelo:{protocol:'Velodrome'}},
  companies:{
    'FutureCo.eth':{
      trackingStartedAt:'2026-09-01T00:00:00.000Z',
      breakdown:[
        {engineId:'aerodrome_veaero',value:100,engineStatus:'ok'},
        {engineId:'velodrome_vevelo',value:100,engineStatus:'ok'}
      ]
    }
  }
};

const baseLedger={
  version:'0.1-canonical-income-ledger',
  generatedAt,
  semantics:{referenceAprCanBackfillEarnedIncome:false,unknownIsNotZero:true},
  authority:{executionAuthority:'none',capitalExecution:false},
  companies:{'FutureCo.eth':{currentClaimableState:{rows:[]}}}
};

function lockedManagedEvent({eventKey,protocol,route,asset,usdValue,sourceFile='reporting/ve33-locked-managed-accounting-evidence.json',sourceEvidenceFamily='embedded-compounded-income',mechanismKind='locked-managed-reward'}){
  return{
    eventKey,
    company:'FutureCo.eth',
    family:'embedded-income',
    sourceEvidenceFamily,
    sourceFile,
    sourceFamily:'ve(3,3) LockedManagedReward factual accrual',
    mechanismKind,
    economicDate:'2026-09-03',
    periodStart:'2026-09-01T00:00:00.000Z',
    periodEnd:'2026-09-03T00:00:00.000Z',
    protocol,
    route,
    asset,
    usdValue
  };
}

const canonicalEvents=[
  lockedManagedEvent({eventKey:'synthetic:aerodrome-locked-managed',protocol:'Aerodrome',route:'aerodrome-relay',asset:'AERO',usdValue:10}),
  lockedManagedEvent({eventKey:'synthetic:velodrome-locked-managed',protocol:'Velodrome',route:'velodrome-relay',asset:'VELO',usdValue:5})
];
const canonical=buildAccountingCoverage({productivity,ledger:{...baseLedger,events:canonicalEvents},embedded:{},generatedAt});
const aero=canonical.companies['FutureCo.eth'].mechanisms.aerodrome_veaero.months['2026-09'];
const velo=canonical.companies['FutureCo.eth'].mechanisms.velodrome_vevelo.months['2026-09'];
assert.equal(aero.status,'factual-period-evidence');
assert.equal(aero.factualEventCount,1);
assert.equal(aero.factualUsdSubtotal,10);
assert.equal(velo.status,'factual-period-evidence');
assert.equal(velo.factualEventCount,1);
assert.equal(velo.factualUsdSubtotal,5);
assert.equal(canonical.summary.unmatchedCanonicalEventCount,0,'canonical locked-managed events remained unmatched');
assert.equal(canonical.semantics.positionMayHaveMultipleFactualIncomeFamilies,true);
assert.equal(canonical.semantics.supplementalIncomeChannelAttributionDoesNotMutateCanonicalFamily,true);

for(const mutation of [
  {sourceFile:'reporting/not-locked-managed.json'},
  {sourceEvidenceFamily:'not-embedded-compounded-income'},
  {mechanismKind:'not-locked-managed-reward'}
]){
  const event=lockedManagedEvent({eventKey:`synthetic:malformed:${Object.keys(mutation)[0]}`,protocol:'Aerodrome',route:'aerodrome-relay',asset:'AERO',usdValue:10,...mutation});
  const malformed=buildAccountingCoverage({productivity,ledger:{...baseLedger,events:[event]},embedded:{},generatedAt});
  const row=malformed.companies['FutureCo.eth'].mechanisms.aerodrome_veaero.months['2026-09'];
  assert.equal(row.factualEventCount,0,`malformed locked-managed evidence gained attribution: ${JSON.stringify(mutation)}`);
  assert.equal(row.factualUsdSubtotal,null,`malformed locked-managed evidence gained factual subtotal: ${JSON.stringify(mutation)}`);
  assert.equal(malformed.summary.unmatchedCanonicalEventCount,1,`malformed locked-managed evidence failed closed: ${JSON.stringify(mutation)}`);
}

console.log('Locked-managed supplemental mechanism attribution PASS',{
  aerodromeUsd:aero.factualUsdSubtotal,
  velodromeUsd:velo.factualUsdSubtotal,
  unmatched:canonical.summary.unmatchedCanonicalEventCount,
  canonicalFamilyPreserved:'embedded-income',
  executionAuthority:'none'
});
