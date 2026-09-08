#!/usr/bin/env node
import './accounting-coverage-validation-v012-core.mjs';
import assert from 'node:assert/strict';
import { buildAccountingCoverage, SUPPLEMENTARY_ROUTE_PRINCIPAL_HINT, VERSION } from './accounting-coverage.mjs';

assert.equal(VERSION,'0.13-supplementary-route-principal-isolation-accounting-mechanism-coverage-registry');
assert.deepEqual(SUPPLEMENTARY_ROUTE_PRINCIPAL_HINT,{
  'votemarket-vecrv':'vecrv',
  'votemarket-vefxn':'vefxn'
});

const generatedAt='2026-08-31T12:00:00.000Z';
const productivity={
  generatedAt,
  engines:{curve_vecrv:{protocol:'Curve'},fx_vefxn:{protocol:'f(x)'}},
  companies:{'defitea.eth':{registry:'004',trackingStartedAt:'2026-08-01T00:00:00.000Z',breakdown:[
    {engineId:'curve_vecrv',engineStatus:'ok',value:100},
    {engineId:'fx_vefxn',engineStatus:'ok',value:100}
  ]}}
};
const ledger={
  generatedAt,
  semantics:{referenceAprCanBackfillEarnedIncome:false,unknownIsNotZero:true},
  authority:{executionAuthority:'none',capitalExecution:false},
  companies:{'defitea.eth':{registry:'004',currentClaimableState:{rows:[
    {route:'votemarket-vecrv',protocol:'VoteMarket',asset:'veCRV',token:'pFXN'},
    {route:'votemarket-vefxn',protocol:'VoteMarket',asset:'veFXN',token:'pFXN'}
  ]}}},
  events:[
    {eventKey:'fixture:votemarket-vecrv',company:'defitea.eth',family:'accrued-entitlement',route:'votemarket-vecrv',protocol:'VoteMarket',asset:'veCRV',token:'pFXN',economicDate:'2026-08-20T12:00:00.000Z',periodStart:'2026-08-20T00:00:00.000Z',periodEnd:'2026-08-20T23:59:59.000Z',usdValue:3},
    {eventKey:'fixture:votemarket-vefxn',company:'defitea.eth',family:'accrued-entitlement',route:'votemarket-vefxn',protocol:'VoteMarket',asset:'veFXN',token:'pFXN',economicDate:'2026-08-21T12:00:00.000Z',periodStart:'2026-08-21T00:00:00.000Z',periodEnd:'2026-08-21T23:59:59.000Z',usdValue:7}
  ]
};
const before=JSON.stringify(ledger);
const isolated=buildAccountingCoverage({productivity,ledger,embedded:{},factualEvidence:{},generatedAt});
const company=isolated.companies?.['defitea.eth'];
const curve=company?.mechanisms?.curve_vecrv?.months?.['2026-08'];
const fx=company?.mechanisms?.fx_vefxn?.months?.['2026-08'];
assert.equal(isolated.semantics?.supplementaryRoutePrincipalIsolation,true);
assert.equal(isolated.semantics?.genericSupplementaryRouteHintCannotCrossPrincipal,true);
assert.equal(isolated.semantics?.supplementaryPlatformLabelDoesNotCreatePrincipalIdentity,true);
assert.ok(curve&&fx);
assert.equal(curve.factualEventCount,1,'veCRV VoteMarket entitlement count drift');
assert.equal(curve.factualUsdSubtotal,3,'veCRV VoteMarket subtotal drift');
assert.equal(curve.currentStateRouteCount,1,'veCRV VoteMarket state isolation drift');
assert.equal(fx.factualEventCount,1,'veFXN captured a veCRV VoteMarket entitlement');
assert.equal(fx.factualUsdSubtotal,7,'veFXN VoteMarket subtotal must contain only its own principal route');
assert.equal(fx.currentStateRouteCount,1,'veFXN captured veCRV VoteMarket state');
assert.equal(curve.factualEventCount+fx.factualEventCount,2,'one VoteMarket entitlement was attributed to multiple principals');
assert.equal(isolated.summary?.unmatchedCanonicalEventCount,0,'principal isolation orphaned a bound VoteMarket entitlement');
assert.equal(JSON.stringify(ledger),before,'Coverage principal isolation mutated canonical ledger input');
console.log('Accounting Coverage v0.13 VoteMarket principal-route isolation PASS',{
  vecrv:{eventCount:curve.factualEventCount,usd:curve.factualUsdSubtotal},
  vefxn:{eventCount:fx.factualEventCount,usd:fx.factualUsdSubtotal},
  misleadingRewardToken:'pFXN on veCRV fixture',
  canonicalLedgerMutation:false,
  executionAuthority:'none'
});
