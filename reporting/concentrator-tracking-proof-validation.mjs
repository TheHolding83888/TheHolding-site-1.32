#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { concentratorAsdCrvObservationProofs } from './accounting-coverage.mjs';

const STATE_FILE=process.env.COMPANY_010_STATE_FILE||'./companies/company-010-production-state.json';
const live=JSON.parse(fs.readFileSync(STATE_FILE,'utf8'));
const clone=()=>structuredClone(live);
const proof=state=>concentratorAsdCrvObservationProofs(state);
const embeddedRow=state=>state.rewards.embeddedIncomeMechanisms.find(x=>x.id==='concentrator-asdcrv');

let proofs=proof(live);
assert.equal(proofs.length,1,'live Concentrator current-state observation must prove factual tracking');
assert.equal(proofs[0].engineId,'concentrator_asdcrv');
assert.equal(proofs[0].company,'Cypher');
assert.equal(proofs[0].sourceFile,'companies/company-010-production-state.json#strategies.crv.concentrator-asdcrv');

// Both explicit mechanism-measured statuses are valid tracking states. A
// temporarily unavailable Reference APR must not revoke factual tracking.
const pendingRate=clone();
embeddedRow(pendingRate).status='measured-mechanism-rate-pending';
embeddedRow(pendingRate).referenceAprPct=null;
assert.equal(proof(pendingRate).length,1,'measured Concentrator mechanism lost tracking only because Reference APR is pending');

// Reference analytics must never participate in factual tracking qualification.
const referenceDrift=clone();
const refStrategy=referenceDrift.strategies.crv.strategies.find(x=>x.id==='concentrator-asdcrv');
const refProductivity=referenceDrift.productivity.positions.find(x=>x.id==='concentrator_asdcrv');
const refEmbedded=embeddedRow(referenceDrift);
refStrategy.yield.referenceAprPct=999999;
refProductivity.referenceAprPct=999999;
refEmbedded.referenceAprPct=999999;
assert.equal(proof(referenceDrift).length,1,'Reference APR leaked into Concentrator factual tracking authority');

const nullReference=clone();
nullReference.strategies.crv.strategies.find(x=>x.id==='concentrator-asdcrv').yield.referenceAprPct=null;
nullReference.productivity.positions.find(x=>x.id==='concentrator_asdcrv').referenceAprPct=null;
embeddedRow(nullReference).referenceAprPct=null;
assert.equal(proof(nullReference).length,1,'null Reference APR incorrectly revoked measured Concentrator tracking');

const unmeasuredStatus=clone();
embeddedRow(unmeasuredStatus).status='unknown';
assert.equal(proof(unmeasuredStatus).length,0,'unmeasured Concentrator state gained factual tracking authority');

const missingConvertToAssets=clone();
embeddedRow(missingConvertToAssets).source='unknown';
assert.equal(proof(missingConvertToAssets).length,0,'Concentrator tracking admitted without convertToAssets source proof');

const capitalMismatch=clone();
capitalMismatch.capital.positions.find(x=>x.assetId==='concentrator-asdcrv').quantity+=1;
assert.equal(proof(capitalMismatch).length,0,'Concentrator capital/share mismatch failed open');

const underlyingMismatch=clone();
underlyingMismatch.capital.positions.find(x=>x.assetId==='concentrator-asdcrv').underlyingQuantity+=1;
assert.equal(proof(underlyingMismatch).length,0,'Concentrator underlying parity mismatch failed open');

const claimableDrift=clone();
claimableDrift.strategies.crv.strategies.find(x=>x.id==='concentrator-asdcrv').yield.claimableApplicable=true;
assert.equal(proof(claimableDrift).length,0,'Concentrator compounded/claimable boundary failed open');

const embeddedDrift=clone();
embeddedRow(embeddedDrift).incomeMode='separate-claimable-rewards';
assert.equal(proof(embeddedDrift).length,0,'Concentrator embedded-income projection mismatch failed open');

const authorityDrift=clone();
authorityDrift.authority.executionAuthority='write';
assert.equal(proof(authorityDrift).length,0,'execution-capable Company state gained accounting tracking authority');

const provenanceDrift=clone();
provenanceDrift.provenance.crvStrategies.concentratorResolverVersion='unknown';
assert.equal(proof(provenanceDrift).length,0,'unbound Concentrator resolver provenance gained tracking authority');

const unknownPrincipal=clone();
unknownPrincipal.strategies.crv.strategies.find(x=>x.id==='concentrator-asdcrv').principal.sdCRVUnderlying=null;
assert.equal(proof(unknownPrincipal).length,0,'unknown Concentrator underlying was treated as measured zero');

console.log('Concentrator asdCRV factual tracking validation PASS',{
  currentStateTracking:true,
  measuredRatePendingTracking:true,
  referenceAprAuthority:false,
  periodIncomeAuthority:false,
  claimAuthority:false,
  unknownIsNotZero:true,
  executionAuthority:'none'
});
