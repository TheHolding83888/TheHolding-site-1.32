#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {VERSION,MECHANISM,DISTRIBUTOR,SCRVUSD,bootstrapBoundaries,extractCurrentUnionStates,buildVotiumUnionAccrual} from './votium-union-accounting-adapter.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>JSON.parse(fs.readFileSync(path.join(ROOT,p),'utf8'));
const realBootstrap=read('reporting/votium-union-accounting-bootstrap.json');
const realRewards=read('companies/rewards-data.json');

assert.equal(VERSION,'0.1-votium-union-factual-accrual-adapter');
assert.equal(MECHANISM,'votium-union-scrvusd');
const boot=bootstrapBoundaries(realBootstrap);
assert.equal(boot.length,2);
assert.deepEqual(boot.map(x=>x.company).sort(),['YieldRing.eth','defitea.eth']);
assert.equal(boot.every(x=>x.week===45&&x.proofValid===true&&x.claimed===false&&x.periodIncomeAuthority===false),true);
assert.equal(new Set(boot.map(x=>x.stateKey)).size,2);

// The checked-in Rewards artifact is a durable state input, not the live-freshness
// authority for this verifier. Exact current Union state is promoted into /tmp by
// the preceding live route simulation and is required by the dedicated live canary.
for(const company of ['YieldRing.eth','defitea.eth']){
  const route=realRewards.companies?.[company]?.vlCvxRoute?.currentRoute;
  assert.equal(route?.routeId,'votium-union',`${company}: canonical vlCVX route identity missing`);
}
const current=extractCurrentUnionStates(realRewards);
for(const c of current){
  const b=boot.find(x=>x.company===c.company);
  assert.ok(b,`${c.company}: extracted Union state has no bootstrap identity`);
  assert.equal(c.stateKey,b.stateKey,`${c.company}: bootstrap/current mechanism identity mismatch`);
  assert.equal(c.proofValid,true);
  assert.equal(c.claimed,false);
  assert.equal(c.forwardingEffective,true);
  assert.equal(c.allocationSharePct,100);
}

const ROOT45=`0x${'a'.repeat(64)}`,ROOT46=`0x${'b'.repeat(64)}`;
const tx45=`0x${'1'.repeat(64)}`,tx46=`0x${'2'.repeat(64)}`,claimTx=`0x${'3'.repeat(64)}`;
const w2='0x90815314fB9e7F015AB5845572FE5BcC0Ba14669',w4='0x78bf5AF472d5f6014b641eD70DE01862C05dA8c3';
const syntheticBootstrap={version:'0.1-votium-union-accounting-bootstrap',mechanism:MECHANISM,distributor:DISTRIBUTOR,observedAt:'2026-08-31T12:00:00.000Z',distribution:{week:45,merkleRoot:ROOT45},source:{path:'synthetic',commit:'synthetic',blobSha:'synthetic'},members:[
  {registry:'002',company:'YieldRing.eth',wallet:w2,index:'1',amountRaw:'1000000000000000000',proofValid:true,claimed:false},
  {registry:'004',company:'defitea.eth',wallet:w4,index:'2',amountRaw:'2000000000000000000',proofValid:true,claimed:false}
],accounting:{bootstrapCreatesIncomeEvent:false,referenceAprUsed:false,unknownIsNotZero:true,executionAuthority:'none'}};
const row=(wallet,index,amountRaw,usd)=>({protocol:'Votium + Union · vlCVX',route:MECHANISM,chain:'Ethereum',token:SCRVUSD,symbol:'scrvUSD',amountRaw,decimals:18,amount:Number(BigInt(amountRaw))/1e18,classification:'unclaimed',usdValue:usd,details:{wallet,distributor:DISTRIBUTOR,distributorWeek:46,merkleIndex:index,merkleRoot:ROOT46,proofValid:true,claimed:false,forwardingEffective:true,allocationSharePct:100}});
const syntheticRewards={version:'synthetic',generatedAt:'2026-09-01T13:20:00.000Z',companies:{'YieldRing.eth':{rewards:[row(w2,'3','1500000000000000000',1.65)]},'defitea.eth':{rewards:[row(w4,'4','3000000000000000000',3.3)]}}};
const decoded=(name,params,block,tx)=>({block_number:block,transaction_hash:tx,index:0,decoded:{method_call:`${name}(...)`,parameters:Object.entries(params).map(([name,value])=>({name,value}))}});
const root46=decoded('MerkleRootUpdated',{merkleRoot:ROOT46,week:'46'},200,tx46),root45=decoded('MerkleRootUpdated',{merkleRoot:ROOT45,week:'45'},100,tx45);
function fakeFetch({withClaim=false}={}){return async url=>{
  const u=String(url);let data;
  if(u.includes('/addresses/')&&u.endsWith('/logs')){
    const items=[root46];
    if(withClaim)items.push(decoded('Claimed',{index:'1',amount:'1000000000000000000',account:w2,week:'45'},150,claimTx));
    items.push(root45);data={items,next_page_params:null};
  }else if(u.includes(tx46))data={timestamp:'2026-09-01T13:11:59.000Z'};
  else if(u.includes(tx45))data={timestamp:'2026-08-25T13:11:59.000Z'};
  else if(u.includes(claimTx))data={timestamp:'2026-08-30T13:11:59.000Z'};
  else throw new Error(`unexpected synthetic URL ${u}`);
  return{ok:true,status:200,json:async()=>data};
};}

const clean=await buildVotiumUnionAccrual({rewards:syntheticRewards,bootstrap:syntheticBootstrap,previousExtension:null,generatedAt:'2026-09-01T13:20:01.000Z',fetchImpl:fakeFetch()});
assert.equal(clean.extension.diagnostics.upstreamFreshness,'current');
assert.equal(clean.events.length,2,'two companies on one Union mechanism must receive two factual company events from one adapter');
assert.equal(clean.events.every(e=>e.family==='accrued-entitlement'&&e.route===MECHANISM&&e.referenceAprUsed===false&&e.claimContinuityStatus==='no-intervening-claim-proven'),true);
assert.equal(clean.events.find(e=>e.company==='YieldRing.eth').amount,0.5);
assert.equal(clean.events.find(e=>e.company==='defitea.eth').amount,1);
assert.equal(clean.events.find(e=>e.company==='YieldRing.eth').usdValue,0.55);
assert.equal(clean.events.find(e=>e.company==='defitea.eth').usdValue,1.1);
assert.equal(clean.extension.authority.executionAuthority,'none');

const claimed=await buildVotiumUnionAccrual({rewards:syntheticRewards,bootstrap:syntheticBootstrap,previousExtension:null,generatedAt:'2026-09-01T13:20:01.000Z',fetchImpl:fakeFetch({withClaim:true})});
assert.equal(claimed.events.length,1,'intervening claim must block only affected company interval, not the shared mechanism globally');
assert.equal(claimed.events[0].company,'defitea.eth');
assert.equal(claimed.extension.diagnostics.reconciliationCount,1);

const staleRewards=structuredClone(syntheticRewards);for(const c of Object.values(staleRewards.companies))for(const r of c.rewards){r.details.distributorWeek=45;r.details.merkleRoot=ROOT45;}
const stale=await buildVotiumUnionAccrual({rewards:staleRewards,bootstrap:syntheticBootstrap,previousExtension:null,fetchImpl:fakeFetch()});
assert.equal(stale.extension.diagnostics.upstreamFreshness,'stale-or-mixed');
assert.equal(stale.events.length,0,'stale upstream state must never fabricate period income');

const source=fs.readFileSync(path.join(ROOT,'reporting/votium-union-accounting-adapter.mjs'),'utf8');
for(const forbidden of ['sendTransaction(','new Wallet(','claim(','executionAuthority:\'write\''])assert.equal(source.includes(forbidden),false,`Union accounting adapter execution surface regression: ${forbidden}`);
assert.equal(source.includes("referenceAprUsed:false"),true);
assert.equal(source.includes("currentLeafIsPeriodIncome:false"),true);
assert.equal(source.includes("noInterveningClaimRequired:true"),true);

console.log('VOTIUM UNION ACCOUNTING ADAPTER VALIDATION PASS',{bootstrapMembers:boot.length,staticCanonicalRoutes:2,extractableCheckedInStates:current.length,liveFreshnessAuthority:'workflow-canary',syntheticFactualEvents:clean.events.length,interveningClaimBlocksOnlyAffectedCompany:true,staleUpstreamIncomeEvents:stale.events.length,executionAuthority:'none'});
