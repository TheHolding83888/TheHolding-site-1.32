#!/usr/bin/env node
import './accounting-coverage-validation-v012-core.mjs';
import assert from 'node:assert/strict';
import { buildAccountingCoverage, SUPPLEMENTARY_ROUTE_ENGINE, VERSION } from './accounting-coverage.mjs';

assert.equal(VERSION,'0.13-supplementary-route-principal-isolation-accounting-mechanism-coverage-registry');
assert.deepEqual(SUPPLEMENTARY_ROUTE_ENGINE,{
  'votemarket-vecrv':'curve_vecrv',
  'votemarket-vefxn':'fx_vefxn'
});

const generatedAt='2026-08-31T12:00:00.000Z';
const productivity={
  generatedAt,
  engines:{
    curve_vecrv:{protocol:'Curve'},
    fx_vefxn:{protocol:'f(x)'}
  },
  companies:{
    'defitea.eth':{
      registry:'004',
      trackingStartedAt:'2026-08-01T00:00:00.000Z',
      breakdown:[
        {engineId:'curve_vecrv',engineStatus:'ok',value:100},
        {engineId:'fx_vefxn',engineStatus:'ok',value:100}
      ]
    }
  }
};
const ledger={
  generatedAt,
  semantics:{referenceAprCanBackfillEarnedIncome:false,unknownIsNotZero:true},
  authority:{executionAuthority:'none',capitalExecution:false},
  companies:{
    'defitea.eth':{
      registry:'004',
      currentClaimableState:{
        rows:[
          {route:'votemarket-vecrv',protocol:'VoteMarket',asset:'veCRV'},
          {route:'votemarket-vefxn',protocol:'VoteMarket',asset:'veFXN'}
        ]
      }
    }
  },
  events:[
    {
      eventKey:'fixture:votemarket-vecrv',
      company:'defitea.eth',
      family:'accrued-entitlement',
      route:'votemarket-vecrv',
      protocol:'VoteMarket',
      asset:'veCRV',
      economicDate:'2026-08-20T12:00:00.000Z',
      periodStart:'2026-08-20T00:00:00.000Z',
      periodEnd:'2026-08-20T23:59:59.000Z',
      usdValue:3
    },
    {
      eventKey:'fixture:votemarket-vefxn',
      company:'defitea.eth',
      family:'accrued-entitlement',
      route:'votemarket-vefxn',
      protocol:'VoteMarket',
      asset:'veFXN',
      economicDate:'2026-08-21T12:00:00.000Z',
      periodStart:'2026-08-21T00:00:00.000Z',
      periodEnd:'2026-08-21T23:59:59.000Z',
      usdValue:7
    }
  ]
};

const isolated=buildAccountingCoverage({productivity,ledger,embedded:{},factualEvidence:{},generatedAt});
const company=isolated.companies?.['defitea.eth'];
const curve=company?.mechanisms?.curve_vecrv?.months?.['2026-08'];
const fx=company?.mechanisms?.fx_vefxn?.months?.['2026-08'];

assert.equal(isolated.semantics?.supplementaryRoutePrincipalIsolation,true,'supplementary route principal-isolation semantic missing');
assert.equal(isolated.semantics?.genericSupplementaryRouteHintCannotCrossPrincipal,true,'generic supplementary platform label guard missing');
assert.equal(isolated.semantics?.supplementaryPlatformLabelDoesNotCreatePrincipalIdentity,true,'supplementary platform identity boundary missing');
assert.ok(curve&&fx,'VoteMarket principal fixtures missing from Coverage');
assert.equal(curve.status,'factual-period-evidence');
assert.equal(fx.status,'factual-period-evidence');
assert.equal(curve.factualEventCount,1,'veCRV VoteMarket entitlement count drift');
assert.equal(curve.factualValuedEventCount,1,'veCRV VoteMarket valued entitlement count drift');
assert.equal(curve.factualUsdSubtotal,3,'veCRV VoteMarket entitlement value drift');
assert.equal(curve.currentStateRouteCount,1,'veCRV VoteMarket current-state route isolation drift');
assert.equal(fx.factualEventCount,1,'veFXN must not capture veCRV VoteMarket entitlement');
assert.equal(fx.factualValuedEventCount,1,'veFXN VoteMarket valued entitlement count drift');
assert.equal(fx.factualUsdSubtotal,7,'veFXN must contain only its own VoteMarket entitlement');
assert.equal(fx.currentStateRouteCount,1,'veFXN must not capture veCRV VoteMarket state');
assert.equal(curve.factualEventCount+fx.factualEventCount,2,'one physical VoteMarket entitlement was attributed to multiple principals');
assert.equal(isolated.summary?.unmatchedCanonicalEventCount,0,'principal isolation orphaned a bound VoteMarket entitlement');

console.log('Accounting Coverage v0.13 VoteMarket principal-route isolation PASS',{
  version:VERSION,
  vecrv:{eventCount:curve.factualEventCount,usd:curve.factualUsdSubtotal,stateRoutes:curve.currentStateRouteCount},
  vefxn:{eventCount:fx.factualEventCount,usd:fx.factualUsdSubtotal,stateRoutes:fx.currentStateRouteCount},
  canonicalLedgerMutation:false,
  executionAuthority:'none'
});
