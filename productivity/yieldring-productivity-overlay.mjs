#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { synchronizeFxnLockerApr, verifyFxnLockerApr } from './fxn-locker-apr-guard.mjs';

const ROOT=process.cwd();
const DATA=path.join(ROOT,'companies/productivity-data.json');
const STATE=path.join(ROOT,'companies/yieldring-canonical-state.json');
const round=(n,d=6)=>{const p=10**d;return Math.round(Number(n)*p)/p;};
const fail=m=>{throw new Error(m);};

// Canonical post-collection publication authority. Both Unified Capital and the
// manual/recovery Productivity writer execute this overlay after the base
// collector. The exact official FXN Locker APR repairs only the current
// materialized snapshot, then an independent byte-level verification runs
// before either path can publish. Historical snapshots remain immutable.
// The explicit bypass is reserved for deterministic non-publishing validators;
// CI proves that no production writer sets this marker.
const deterministicValidation=process.env.FXN_LOCKER_APR_GUARD_MODE==='deterministic-validation';
let fxnAuthority=null;
if(!deterministicValidation){
  fxnAuthority=await synchronizeFxnLockerApr();
  await verifyFxnLockerApr({exactApr:fxnAuthority.exactApr});
}

const data=JSON.parse(fs.readFileSync(DATA,'utf8'));
const state=JSON.parse(fs.readFileSync(STATE,'utf8'));
if(state.version!=='0.1-yieldring-canonical-state'||state.company!=='YieldRing.eth')fail('unexpected YieldRing canonical state');
if(data.version!=='1.16')fail(`unexpected Productivity version ${data.version}`);
const company=data.companies?.['YieldRing.eth'];
if(!company||!Array.isArray(company.breakdown))fail('YieldRing Productivity company/breakdown missing');
const aero=company.breakdown.find(x=>x.engineId==='aerodrome_veaero'||x.principalId==='aerodrome-finance');
if(!aero)fail('YieldRing Aerodrome Productivity row missing');
const target=Number(state.capital?.aerodrome?.quantity);
if(!(target>0))fail('canonical YieldRing AERO quantity missing');
const price=Number(aero.price);
const apr=Number(aero.apr);
if(!(price>0)||!Number.isFinite(apr))fail('YieldRing Aerodrome price/APR unavailable');

aero.units=target;
aero.value=round(target*price,6);
aero.sourceState={...(aero.sourceState||{}),canonicalCompanyState:'companies/yieldring-canonical-state.json',principalQuantity:target,relayMode:state.aerodromeRelay?.mode||null,expectedUnderlyingLockCount:state.aerodromeRelay?.expectedUnderlyingLockCount??null,evidenceStatus:state.aerodromeRelay?.evidenceStatus||null};

let productive=0,covered=0,weighted=0;
for(const row of company.breakdown){
  const v=Number(row.value);
  if(Number.isFinite(v)&&v>=0)productive+=v;
  const a=Number(row.apr);
  const usable=Number.isFinite(v)&&v>=0&&Number.isFinite(a)&&row.engineStatus!=='warming'&&row.engineStatus!=='unavailable';
  if(usable){covered+=v;weighted+=v*a;}
}
if(!(productive>0)||!(covered>0))fail('YieldRing Productivity aggregate unavailable after overlay');
company.productiveValue=round(productive,2);
company.coveredProductiveValue=round(covered,2);
company.coverage=round(covered/productive,6);
company.aprLatest=round(weighted/covered,4);
company.updatedAt=data.generatedAt||company.updatedAt||new Date().toISOString();
company.aprScope=company.coverage>=0.999999?'full-productive-capital':'covered-productive-capital';

const history=data.history?.companies?.['YieldRing.eth'];
if(Array.isArray(history)&&history.length){
  const latest=history.at(-1);
  if(latest&&latest.snapshotKey===data.snapshotKey){latest.apr=company.aprLatest;if('totalProductiveValue' in latest)latest.totalProductiveValue=company.productiveValue;if('coveredProductiveValue' in latest)latest.coveredProductiveValue=company.coveredProductiveValue;if('coverage' in latest)latest.coverage=company.coverage;}
  const valid=history.map(x=>Number(x.apr)).filter(Number.isFinite);
  if(valid.length){company.aprHistoricalAverage=round(valid.reduce((s,x)=>s+x,0)/valid.length,4);company.observationCount=valid.length;}
}

data.diagnostics=data.diagnostics||{};
data.diagnostics.yieldRing={version:'0.1-canonical-capital-and-relay-overlay',source:'companies/yieldring-canonical-state.json',bitcoinQuantity:Number(state.capital.bitcoin.quantity),bitcoinCostBasisUsd:Number(state.capital.bitcoin.costBasisUsd),aeroQuantity:target,aeroCostBasisUsd:Number(state.capital.aerodrome.costBasisUsd),relayMode:state.aerodromeRelay.mode,managerId:state.aerodromeRelay.managerId,managerAddress:state.aerodromeRelay.managerAddress,expectedUnderlyingLockCount:state.aerodromeRelay.expectedUnderlyingLockCount,rewardsPresentation:state.aerodromeRelay.rewardsPresentation,evidenceStatus:state.aerodromeRelay.evidenceStatus,executionAuthority:'none'};
fs.writeFileSync(DATA,JSON.stringify(data,null,2)+'\n');
console.log('YieldRing Productivity overlay PASS',{aprLatest:company.aprLatest,productiveValue:company.productiveValue,coverage:company.coverage,aeroUnits:aero.units,relayMode:state.aerodromeRelay.mode,executionAuthority:'none',fxnAuthority:deterministicValidation?'deterministic-validation-bypass':fxnAuthority});
