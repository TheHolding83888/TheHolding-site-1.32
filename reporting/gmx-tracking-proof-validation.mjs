#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { gmxV2MarketObservationProofs } from './accounting-coverage.mjs';

const state=JSON.parse(fs.readFileSync(process.env.COMPANY_010_STATE_FILE||'./companies/company-010-production-state.json','utf8'));
const EXPECTED=['gmx-gm-btc-usdc','gmx-gm-eth-usdc'];
const ids=proofs=>proofs.map(x=>x.engineId).sort();
const expectBoth=(candidate,message)=>assert.deepEqual(ids(gmxV2MarketObservationProofs(candidate)),EXPECTED,message);
const expectNone=(candidate,message)=>assert.deepEqual(gmxV2MarketObservationProofs(candidate),[],message);

expectBoth(state,'canonical Company #010 GMX state did not prove both active GM markets');
const baseline=gmxV2MarketObservationProofs(state);
assert.equal(baseline.length,2);
assert.ok(baseline.every(x=>x.company==='Cypher'),'GMX proof company identity drift');
assert.ok(baseline.every(x=>x.sourceFile==='companies/company-010-production-state.json#strategies.gmx'),'GMX proof provenance drift');
assert.ok(baseline.every(x=>/^2026-09$/.test(x.month)),'GMX proof current-month boundary drift');

// Reference APY is analytics only. Removing it must not remove factual current-state tracking.
const noReference=structuredClone(state);
for(const row of noReference.strategies.gmx.strategies||[])row.yield.referenceAprPct=null;
for(const row of noReference.productivity.positions||[])if(EXPECTED.includes(row.id))row.referenceAprPct=null;
expectBoth(noReference,'Reference APY leaked into GMX factual tracking authority');

const additive=structuredClone(state);
additive.strategies.gmx.accountingBoundary.underlyingPoolTokensAddedToReserveBalances=true;
expectNone(additive,'additive GMX underlying exposure failed open');

const claimable=structuredClone(state);
claimable.strategies.gmx.rewardsBoundary.separateClaimableLpFees=true;
expectNone(claimable,'GMX embedded income became a separate claimable route');

const authority=structuredClone(state);
authority.authority.executionAuthority='write';
expectNone(authority,'execution-capable Company state gained GMX accounting tracking authority');

const epistemic=structuredClone(state);
epistemic.epistemicBoundary.gmxEmbeddedIncomeIsNotClaimableReward=false;
expectNone(epistemic,'GMX embedded-income epistemic boundary failed open');

const provenance=structuredClone(state);
provenance.provenance.gmxStrategy.version='broken';
expectNone(provenance,'GMX provenance mismatch gained tracking authority');

// A malformed market must not poison the independently valid sibling market, but the malformed market must fail closed.
const btcMismatch=structuredClone(state);
const btcCapital=btcMismatch.capital.positions.find(x=>x.assetId==='gmx-gm-btc-usdc');
btcCapital.valueUsd=Number(btcCapital.valueUsd)+1;
assert.deepEqual(ids(gmxV2MarketObservationProofs(btcMismatch)),['gmx-gm-eth-usdc'],'GMX BTC NAV mismatch did not fail closed per market');

const ethUnknown=structuredClone(state);
const ethStrategy=ethUnknown.strategies.gmx.strategies.find(x=>x.id==='gmx-gm-eth-usdc');
ethStrategy.companyPosition.gmBalance=null;
assert.deepEqual(ids(gmxV2MarketObservationProofs(ethUnknown)),['gmx-gm-btc-usdc'],'unknown GMX ETH balance was treated as measured zero/current state');

const ethExposureUnknown=structuredClone(state);
const ethExposure=ethExposureUnknown.strategies.gmx.strategies.find(x=>x.id==='gmx-gm-eth-usdc');
ethExposure.poolExposureDiagnostic.long.amount=null;
assert.deepEqual(ids(gmxV2MarketObservationProofs(ethExposureUnknown)),['gmx-gm-btc-usdc'],'unknown GMX pool exposure failed open');

console.log('GMX factual tracking proof validation PASS',{
  proofs:EXPECTED,
  referenceAprAuthority:false,
  periodIncomeAuthority:false,
  underlyingPoolTokensAdditive:false,
  separateClaimableLpFees:false,
  unknownIsNotZero:true,
  executionAuthority:'none'
});
