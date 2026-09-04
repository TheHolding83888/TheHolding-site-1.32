#!/usr/bin/env node
import assert from 'node:assert/strict';
import { buildAccountingCoverage } from './accounting-coverage.mjs';
import { VERSION as CURVE_VERSION, FEE_DISTRIBUTOR, CRVUSD } from './curve-fee-accounting-adapter.mjs';

const at='2026-09-04T12:00:00.000Z';
const company='FutureCurveCo.eth';
const wallet='0x7CdF49f589038242e77847573604441E383f5429';
const productivity={generatedAt:at,engines:{curve_vecrv:{protocol:'Curve'}},companies:{[company]:{trackingStartedAt:'2026-09-01T00:00:00.000Z',breakdown:[{engineId:'curve_vecrv',value:100,engineStatus:'ok'}]}}};
const baseLedger={
  version:'0.1-canonical-income-ledger',generatedAt:at,events:[],companies:{[company]:{currentClaimableState:{rows:[{route:'curve-fees',protocol:'Curve',asset:'crvUSD'}]}}},
  semantics:{referenceAprCanBackfillEarnedIncome:false,unknownIsNotZero:true},authority:{executionAuthority:'none',capitalExecution:false}
};
const boundary={
  stateKey:`${company}|${wallet.toLowerCase()}|${CRVUSD.toLowerCase()}`,company,wallet,feeDistributor:FEE_DISTRIBUTOR,token:CRVUSD,
  symbol:'crvUSD',decimals:18,amountRaw:'0',amount:0,observedAt:at,blockNumber:12345678,sourceRoute:'curve-fees',
  periodIncomeAuthority:false,currentClaimableBalanceIsPeriodIncome:false,unknownIsNotZero:true
};
const trackedLedger={...baseLedger,accountingExtensions:{curveFeeAccrual:{
  version:CURVE_VERSION,status:'factual-boundary-tracking',generatedAt:at,boundaries:[boundary],
  semantics:{openingBalanceCreatesIncome:false,currentClaimableBalanceIsPeriodIncome:false,referenceAprUsed:false,unknownIsNotZero:true},
  authority:{executionAuthority:'none',capitalExecution:false}
}}};
const tracked=buildAccountingCoverage({productivity,ledger:trackedLedger,embedded:{},generatedAt:at});
const row=tracked.companies[company].mechanisms.curve_vecrv.months['2026-09'];
assert.equal(row.status,'factual-tracking-no-period-event');
assert.equal(row.factualTrackingActive,true);
assert.equal(row.factualEventCount,0);
assert.equal(row.factualTrackingProofCount,1);
assert.deepEqual(row.factualTrackingProofSources,['reporting/income-ledger.json#accountingExtensions.curveFeeAccrual']);
assert.equal(tracked.mechanisms.curve_vecrv.factualTrackingCompanyCount,1);
assert.equal(tracked.mechanisms.curve_vecrv.reusableCoverageGap,false,'exact factual zero baseline stayed a false coverage gap');

const untracked=buildAccountingCoverage({productivity,ledger:baseLedger,embedded:{},generatedAt:at});
assert.equal(untracked.companies[company].mechanisms.curve_vecrv.months['2026-09'].status,'state-observed-not-factual-tracking');
assert.equal(untracked.mechanisms.curve_vecrv.reusableCoverageGap,true);

console.log('Curve FeeDistributor Accounting Coverage integration PASS',{
  trackedStatus:row.status,proofs:row.factualTrackingProofCount,periodEvents:row.factualEventCount,executionAuthority:tracked.authority.executionAuthority
});
