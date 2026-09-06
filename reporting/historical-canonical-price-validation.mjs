#!/usr/bin/env node
import assert from 'node:assert/strict';
import {
  VERSION,HISTORICAL_TOKEN_ASSET_IDS,canonicalAssetIdForHistoricalToken,selectHistoricalCanonicalPrice
} from './historical-canonical-price.mjs';

assert.equal(VERSION,'0.1-historical-canonical-market-price');
assert.equal(Object.keys(HISTORICAL_TOKEN_ASSET_IDS).length,2);
assert.equal(canonicalAssetIdForHistoricalToken('0x940181a94A35A4569E4529A3CDfB74e38FD98631'),'aerodrome-finance');
assert.equal(canonicalAssetIdForHistoricalToken('0x9560e827aF36c94D2Ac33a39bCE1Fe78631088Db'),'velodrome-finance');
assert.equal(canonicalAssetIdForHistoricalToken('0x1111111111111111111111111111111111111111'),null);

const snapshot={
  version:'1.2-market-data-truthful-canonical-provenance',
  generatedAt:'2026-08-31T23:52:57.601Z',
  observedAt:'2026-08-31T23:52:53.619Z',
  status:'ok',
  prices:{
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

console.log('Historical canonical market price validation OK');
