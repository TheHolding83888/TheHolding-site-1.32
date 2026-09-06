#!/usr/bin/env node
import assert from 'node:assert/strict';
import {
  VERSION,HISTORICAL_TOKEN_ASSET_IDS,canonicalAssetIdForHistoricalToken,selectHistoricalCanonicalPrice
} from './historical-canonical-price.mjs';
import { annotateHistoricalValuationResolution } from './income-ledger.mjs';
import { recognitionDecision, resolvedUsdValue } from './canonical-earned-income-view.mjs';

assert.equal(VERSION,'0.1-historical-canonical-market-price');
assert.equal(Object.keys(HISTORICAL_TOKEN_ASSET_IDS).length,4);
assert.equal(canonicalAssetIdForHistoricalToken('0x940181a94A35A4569E4529A3CDfB74e38FD98631'),'aerodrome-finance');
assert.equal(canonicalAssetIdForHistoricalToken('0x9560e827aF36c94D2Ac33a39bCE1Fe78631088Db'),'velodrome-finance');
assert.equal(canonicalAssetIdForHistoricalToken('0x4200000000000000000000000000000000000006'),'ethereum');
assert.equal(canonicalAssetIdForHistoricalToken('0x68f180fcCe6836688e9084f035309E29Bf0A2095'),'bitcoin');
assert.equal(canonicalAssetIdForHistoricalToken('0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85'),null);
assert.equal(canonicalAssetIdForHistoricalToken('0x1111111111111111111111111111111111111111'),null);

const snapshot={
  version:'1.2-market-data-truthful-canonical-provenance',
  generatedAt:'2026-08-31T23:52:57.601Z',
  observedAt:'2026-08-31T23:52:53.619Z',
  status:'ok',
  prices:{
    bitcoin:{
      assetId:'bitcoin',symbol:'BTC',providerId:'bitcoin',usd:78537.9,
      status:'fresh',observedAt:'2026-08-31T23:52:53.619Z',source:'onchain-chainlink-v3'
    },
    ethereum:{
      assetId:'ethereum',symbol:'ETH',providerId:'ethereum',usd:2466.06838126,
      status:'fresh',observedAt:'2026-08-31T23:52:53.619Z',source:'onchain-chainlink-v3'
    },
    'aerodrome-finance':{
      assetId:'aerodrome-finance',symbol:'AERO',providerId:'aerodrome-finance',usd:0.47301682,
      status:'fresh',observedAt:'2026-08-31T23:52:53.619Z',source:'onchain-chainlink-v3'
    },
    'velodrome-finance':{
      assetId:'velodrome-finance',symbol:'VELO',providerId:'velodrome-finance',usd:0.021860940606858108,
      status:'fresh',observedAt:'2026-08-31T23:52:53.619Z',source:'onchain-velodrome-v2-twap-relative'
    }
  }
};

const aero=selectHistoricalCanonicalPrice({
  snapshot,token:'0x940181a94A35A4569E4529A3CDfB74e38FD98631',boundaryAt:'2026-09-01T00:00:00.000Z',maxAgeMinutes:25
});
assert.equal(aero.ok,true);
assert.equal(aero.assetId,'aerodrome-finance');
assert.equal(aero.priceUsd,0.47301682);
assert.equal(aero.observedAt,'2026-08-31T23:52:53.619Z');
assert.ok(aero.ageMinutes>7&&aero.ageMinutes<8);

const velo=selectHistoricalCanonicalPrice({
  snapshot,token:'0x9560e827aF36c94D2Ac33a39bCE1Fe78631088Db',boundaryAt:'2026-09-01T00:00:00.000Z',maxAgeMinutes:25
});
assert.equal(velo.ok,true);
assert.equal(velo.assetId,'velodrome-finance');
assert.equal(velo.priceUsd,0.021860940606858108);

const weth=selectHistoricalCanonicalPrice({
  snapshot,token:'0x4200000000000000000000000000000000000006',boundaryAt:'2026-09-01T00:00:00.000Z',maxAgeMinutes:25
});
assert.equal(weth.ok,true);
assert.equal(weth.assetId,'ethereum');
assert.equal(weth.priceUsd,2466.06838126);
assert.equal(weth.priceSource,'onchain-chainlink-v3');

const wbtc=selectHistoricalCanonicalPrice({
  snapshot,token:'0x68f180fcCe6836688e9084f035309E29Bf0A2095',boundaryAt:'2026-09-01T00:00:00.000Z',maxAgeMinutes:25
});
assert.equal(wbtc.ok,true);
assert.equal(wbtc.assetId,'bitcoin');
assert.equal(wbtc.priceUsd,78537.9);
assert.equal(wbtc.priceSource,'onchain-chainlink-v3');

const unsupportedStable=selectHistoricalCanonicalPrice({
  snapshot,token:'0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',boundaryAt:'2026-09-01T00:00:00.000Z',maxAgeMinutes:25
});
assert.equal(unsupportedStable.ok,false);
assert.equal(unsupportedStable.status,'token-not-canonical-market-data-mapped');

const unknown=selectHistoricalCanonicalPrice({
  snapshot,token:'0x1111111111111111111111111111111111111111',boundaryAt:'2026-09-01T00:00:00.000Z',maxAgeMinutes:25
});
assert.equal(unknown.ok,false);
assert.equal(unknown.status,'token-not-canonical-market-data-mapped');

const tooOld=selectHistoricalCanonicalPrice({
  snapshot,token:'0x940181a94A35A4569E4529A3CDfB74e38FD98631',boundaryAt:'2026-09-01T01:00:00.000Z',maxAgeMinutes:25
});
assert.equal(tooOld.ok,false);
assert.equal(tooOld.status,'canonical-price-too-old-for-accounting-boundary');

const futureSnapshot=structuredClone(snapshot);
futureSnapshot.prices['aerodrome-finance'].observedAt='2026-09-01T00:00:01.000Z';
const future=selectHistoricalCanonicalPrice({
  snapshot:futureSnapshot,token:'0x940181a94A35A4569E4529A3CDfB74e38FD98631',boundaryAt:'2026-09-01T00:00:00.000Z',maxAgeMinutes:25
});
assert.equal(future.ok,false);
assert.equal(future.status,'canonical-price-observed-after-accounting-boundary');

const unknownStatus=structuredClone(snapshot);
unknownStatus.prices['aerodrome-finance'].status='unknown';
const unusable=selectHistoricalCanonicalPrice({
  snapshot:unknownStatus,token:'0x940181a94A35A4569E4529A3CDfB74e38FD98631',boundaryAt:'2026-09-01T00:00:00.000Z',maxAgeMinutes:25
});
assert.equal(unusable.ok,false);
assert.equal(unusable.status,'canonical-price-status-not-usable');

const immutableWethEvent={
  eventKey:'ve33:test:weth:august',company:'defitea.eth',family:'accrued-entitlement',route:'velodrome-ve',protocol:'Velodrome',
  economicDate:'2026-08-31',periodStart:'2026-08-01T00:00:00.000Z',periodEnd:'2026-09-01T00:00:00.000Z',
  asset:'WETH',token:'0x4200000000000000000000000000000000000006',amount:0.000177916716,amountRaw:'177916716000000',usdValue:null,
  valuationStatus:'unvalued-fail-closed',sourceFile:'reporting/ve33-accounting-evidence.json',sourceFamily:'ve(3,3) factual accrual evidence',
  sourceIdentity:'synthetic-open->synthetic-close',unknownIsNotZero:true,executionAuthority:'none',immutableEconomicFieldsHash:'immutable-sentinel'
};
const resolvedLedger=await annotateHistoricalValuationResolution({
  version:'0.1-canonical-income-ledger',events:[immutableWethEvent]
},{
  resolver:async({token,boundaryAt})=>{
    assert.equal(token,immutableWethEvent.token);
    assert.equal(boundaryAt,immutableWethEvent.periodEnd);
    return{
      ok:true,status:'historical-canonical-market-price',assetId:'ethereum',priceUsd:2466.06838126,
      observedAt:'2026-08-31T23:52:53.619Z',ageMinutes:7.10635,commitSha:'historical-commit',
      sourceFile:'intelligence/market-data/market-data.json'
    };
  }
});
assert.equal(resolvedLedger.resolvedEventCount,1);
assert.equal(resolvedLedger.unresolvedEventCount,0);
const resolvedEvent=resolvedLedger.ledger.events[0];
assert.equal(resolvedEvent.usdValue,null,'immutable canonical event USD must remain unchanged');
assert.equal(resolvedEvent.immutableEconomicFieldsHash,'immutable-sentinel','valuation metadata must not mutate immutable event hash');
assert.equal(resolvedEvent.valuationResolution?.economicFieldsMutated,false);
assert.equal(resolvedEvent.valuationResolution?.sourceFamily,'canonical-market-data-git-history');
assert.equal(resolvedEvent.valuationResolution?.sourceAssetId,'ethereum');
assert.ok(Number(resolvedEvent.valuationResolution?.resolvedUsdValue)>0);
assert.equal(resolvedUsdValue(resolvedEvent),resolvedEvent.valuationResolution.resolvedUsdValue);
assert.equal(recognitionDecision(resolvedEvent).status,'recognized','proven historical valuation resolution must make factual accrual recognizable');

const unsupportedLedger=await annotateHistoricalValuationResolution({
  version:'0.1-canonical-income-ledger',events:[{...immutableWethEvent,eventKey:'ve33:test:usdc:august',asset:'USDC',token:'0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',amount:0.3}]
},{resolver:async()=>({ok:false,status:'token-not-canonical-market-data-mapped',assetId:null})});
assert.equal(unsupportedLedger.resolvedEventCount,0);
assert.equal(unsupportedLedger.unresolvedEventCount,1);
assert.equal(unsupportedLedger.ledger.events[0].valuationResolution,undefined,'unsupported historical token must remain UNKNOWN');
assert.equal(recognitionDecision(unsupportedLedger.ledger.events[0]).status,'unresolved');

const alreadyValued={...immutableWethEvent,eventKey:'ve33:test:already-valued',usdValue:1,valuationStatus:'historical-canonical-market-price-frozen-at-closing-accounting-boundary'};
const noRewrite=await annotateHistoricalValuationResolution({version:'0.1-canonical-income-ledger',events:[alreadyValued]},{resolver:async()=>{throw new Error('resolver must not run for already-valued event');}});
assert.equal(noRewrite.eligibleEventCount,0);
assert.equal(noRewrite.ledger.events[0].usdValue,1,'closed numeric valuation must never be rewritten');

console.log('Historical canonical market price validation OK');
