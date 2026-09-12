#!/usr/bin/env node
import assert from 'node:assert/strict';
import {
  VERSION,CANONICAL_REWARDS_REPO_PATH,HISTORICAL_REWARDS_PRICE_POLICY,
  selectHistoricalRewardsTokenPrice,historicalRewardsTokenPriceFromGit
} from './historical-rewards-token-price.mjs';

assert.equal(VERSION,'0.1-committed-rewards-token-price-recovery');
assert.equal(CANONICAL_REWARDS_REPO_PATH,'companies/rewards-data.json');
assert.equal(HISTORICAL_REWARDS_PRICE_POLICY.exactTokenAddressRequired,true);
assert.equal(HISTORICAL_REWARDS_PRICE_POLICY.symbolMatchingForbidden,true);
assert.equal(HISTORICAL_REWARDS_PRICE_POLICY.currentPriceUsed,false);
assert.equal(HISTORICAL_REWARDS_PRICE_POLICY.referenceAprUsed,false);
assert.equal(HISTORICAL_REWARDS_PRICE_POLICY.executionAuthority,'none');

const token='0xB095274743941e953c746F9C228DA9c18Bb6ec29';
const other='0x1111111111111111111111111111111111111111';
const boundaryAt='2026-09-10T00:26:40.000Z';
const observedAt='2026-09-09T09:00:00.000Z';
const snapshot={
  version:'test-rewards',generatedAt:observedAt,
  companies:{
    A:{rewards:[{route:'aerodrome-ve',token,symbol:'LAPTOP',priceUsd:1.03125,priceMethod:'canonical-rewards-observation',priceObservedAt:observedAt}]},
    B:{rewards:[{route:'aerodrome-ve',token:other,symbol:'LAPTOP',priceUsd:999,priceMethod:'wrong-token-symbol-collision',priceObservedAt:observedAt}]}
  }
};

const exact=selectHistoricalRewardsTokenPrice({snapshot,token,boundaryAt});
assert.equal(exact.ok,true);
assert.equal(exact.status,'historical-canonical-rewards-token-price');
assert.equal(exact.sourceFamily,'canonical-rewards-git-history');
assert.equal(exact.tokenAddress,token.toLowerCase());
assert.equal(exact.priceUsd,1.03125);
assert.equal(exact.observedAt,observedAt);
assert.deepEqual(exact.sourceCompanies,['A']);
assert.equal(exact.exactTokenAddressMatch,true);
assert.equal(exact.symbolMatchingUsed,false);
assert.equal(exact.currentPriceUsed,false);
assert.equal(exact.referenceAprUsed,false);
assert.equal(exact.executionAuthority,'none');

const wrongToken=selectHistoricalRewardsTokenPrice({snapshot,token:'0x2222222222222222222222222222222222222222',boundaryAt});
assert.equal(wrongToken.ok,false);
assert.equal(wrongToken.status,'historical-rewards-token-not-observed-in-snapshot');

const future=selectHistoricalRewardsTokenPrice({snapshot:{...snapshot,generatedAt:'2026-09-11T00:00:00.000Z',companies:{A:{rewards:[{route:'aerodrome-ve',token,symbol:'LAPTOP',priceUsd:1.5,priceMethod:'future',priceObservedAt:'2026-09-11T00:00:00.000Z'}]}}},token,boundaryAt});
assert.equal(future.ok,false);
assert.equal(future.status,'historical-rewards-token-price-observed-after-accounting-boundary');

const stale=selectHistoricalRewardsTokenPrice({snapshot:{...snapshot,generatedAt:'2026-07-01T00:00:00.000Z',companies:{A:{rewards:[{route:'aerodrome-ve',token,symbol:'LAPTOP',priceUsd:1.5,priceMethod:'old',priceObservedAt:'2026-07-01T00:00:00.000Z'}]}}},token,boundaryAt,maxAgeMinutes:60});
assert.equal(stale.ok,false);
assert.equal(stale.status,'historical-rewards-token-price-too-old-for-accounting-boundary');

const conflict=selectHistoricalRewardsTokenPrice({snapshot:{...snapshot,companies:{A:{rewards:[{route:'aerodrome-ve',token,symbol:'LAPTOP',priceUsd:1,priceMethod:'m1',priceObservedAt:observedAt}]},B:{rewards:[{route:'aerodrome-ve',token,symbol:'LAPTOP',priceUsd:2,priceMethod:'m2',priceObservedAt:observedAt}]}}},token,boundaryAt});
assert.equal(conflict.ok,false);
assert.equal(conflict.status,'historical-rewards-token-price-conflict');

const history={
  'goodsha:companies/rewards-data.json':JSON.stringify(snapshot),
  'badsha:companies/rewards-data.json':JSON.stringify({version:'bad',generatedAt:'2026-09-08T00:00:00.000Z',companies:{A:{rewards:[{route:'aerodrome-ve',token:other,symbol:'LAPTOP',priceUsd:555,priceMethod:'symbol-only',priceObservedAt:'2026-09-08T00:00:00.000Z'}]}}})
};
const gitCalls=[];
const gitRun=args=>{
  gitCalls.push(args);
  if(args[0]==='log')return 'badsha|2026-09-09T10:00:00.000Z\ngoodsha|2026-09-09T09:30:00.000Z\n';
  if(args[0]==='show')return history[args[1]];
  throw new Error(`unexpected git call ${args.join(' ')}`);
};
const fromGit=historicalRewardsTokenPriceFromGit({token,boundaryAt,gitRun});
assert.equal(fromGit.ok,true);
assert.equal(fromGit.priceUsd,1.03125);
assert.equal(fromGit.commitSha,'goodsha');
assert.equal(fromGit.sourceFile,CANONICAL_REWARDS_REPO_PATH);
assert.equal(fromGit.policyVersion,HISTORICAL_REWARDS_PRICE_POLICY.version);
assert.equal(fromGit.exactTokenAddressMatch,true);
assert.equal(fromGit.symbolMatchingUsed,false);
assert.ok(gitCalls.some(args=>args[0]==='log'&&args.some(x=>String(x).startsWith('--before='))));

console.log('historical committed Rewards token price fallback validation OK',{
  exactTokenAddress:true,symbolMatching:false,conflictFailClosed:true,futureFailClosed:true,staleFailClosed:true,
  currentPriceUsed:false,referenceAprUsed:false,executionAuthority:'none'
});
