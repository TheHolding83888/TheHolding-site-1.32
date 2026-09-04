import assert from 'node:assert/strict';
import { admitVlCvxPlatformIntoLedgerState } from './vlcvx-platform-ledger-admission.mjs';

const LOCKER='0x72a19342e8F1838460eBFCCEf09F6585e32db86E',WALLET='0x7eC6331188468269DC7C1Cf6a84C972632178B1E',FXS='0x3432B6A60D23Ca0dFCa7761B7ab56459D9C964D';
const rewards=(block,raw,at)=>({generatedAt:at,diagnostics:{vlCvxLockerPlatformProof:{generatedAt:at,observedBlock:block}},companies:{"Rook's portfolio":{sources:[{route:'vlcvx-locker-platform-rewards',status:'ok',details:{component:'locked-cvx-platform-rewards',wallet:WALLET,locker:LOCKER,observedBlock:block,rewards:[{token:FXS,symbol:'FXS',decimals:18,amountRaw:raw,amount:Number(raw)/1e18}],currentRoute:'convex-finance-vlcvx',periodIncomeAuthority:false,currentRewardStateIsNotPeriodIncome:true,unknownIsNotZero:true}}]}}});
const market={prices:{'frax-share':{assetId:'frax-share',symbol:'FXS',usd:0.25,status:'fresh',observedAt:'2026-09-04T12:30:00.000Z',source:'test-canonical'}}};
const provider={getLogs:async()=>[]};
let ledger={version:'0.1-canonical-income-ledger',events:[],accountingExtensions:{},authority:{executionAuthority:'none'}};

const first=await admitVlCvxPlatformIntoLedgerState({ledger,rewards:rewards(100,'1000000000000000000','2026-09-04T12:00:00.000Z'),marketData:market,generatedAt:'2026-09-04T12:01:00.000Z',provider});
assert.equal(first.candidateEventCount,0);assert.equal(first.newEventsAdmitted,0);assert.equal(first.extension.boundaries.length,1);assert.equal(first.extension.semantics.openingBalanceCreatesIncome,false);
ledger=first.ledger;

const second=await admitVlCvxPlatformIntoLedgerState({ledger,rewards:rewards(200,'3000000000000000000','2026-09-04T13:00:00.000Z'),marketData:market,generatedAt:'2026-09-04T13:01:00.000Z',provider});
assert.equal(second.candidateEventCount,1);assert.equal(second.newEventsAdmitted,1);assert.equal(second.ledger.events.length,1);
const e=second.ledger.events[0];assert.equal(e.amount,2);assert.equal(e.usdValue,0.5);assert.ok(e.immutableEconomicFieldsHash);assert.equal(e.retention,'indefinite');assert.equal(e.executionAuthority,'none');
ledger=second.ledger;

const repeat=await admitVlCvxPlatformIntoLedgerState({ledger,rewards:rewards(200,'3000000000000000000','2026-09-04T13:00:00.000Z'),marketData:market,generatedAt:'2026-09-04T13:02:00.000Z',provider});
assert.equal(repeat.candidateEventCount,0);assert.equal(repeat.newEventsAdmitted,0);assert.equal(repeat.ledger.events.length,1);assert.equal(repeat.ledger.events[0].immutableEconomicFieldsHash,e.immutableEconomicFieldsHash);
assert.equal(repeat.extension.authority.executionAuthority,'none');assert.equal(repeat.extension.semantics.delegateIncentiveSettlementIsSeparate,true);

console.log('vlCVX PLATFORM LEDGER ADMISSION VALIDATION PASS',{baselineEvents:first.candidateEventCount,newEvents:second.newEventsAdmitted,repeatNewEvents:repeat.newEventsAdmitted,eventHashStable:true,executionAuthority:repeat.extension.authority.executionAuthority});
