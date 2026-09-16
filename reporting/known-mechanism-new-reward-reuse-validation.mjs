#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';

const rewards=JSON.parse(fs.readFileSync('companies/rewards-data.json','utf8'));
const ledger=JSON.parse(fs.readFileSync('reporting/income-ledger.json','utf8'));
const coverage=JSON.parse(fs.readFileSync('reporting/accounting-coverage.json','utf8'));
const engine=fs.readFileSync('rewards/company-rewards-engine.mjs','utf8');

const addr=v=>String(v||'').toLowerCase();
const positiveRaw=v=>{try{return BigInt(String(v||'0'))>0n;}catch{return false;}};
const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
const routes=new Set(['aerodrome-ve','velodrome-ve']);
const baseSymbol={ 'aerodrome-ve':'AERO', 'velodrome-ve':'VELO' };

function walk(value,fn,path=[]){
  if(Array.isArray(value)){
    value.forEach((v,i)=>walk(v,fn,[...path,i]));
    return;
  }
  if(!value||typeof value!=='object')return;
  fn(value,path);
  for(const [k,v] of Object.entries(value))walk(v,fn,[...path,k]);
}

// P6 must reuse the generic ve reward enumerator, not a token-specific accounting path.
for(const needle of ['enumerateRewardContract','rewardsListLength','FeesVotingReward','IncentiveVotingReward','collectVeProtocol']){
  assert.ok(engine.includes(needle),`generic ve reward enumeration capability missing: ${needle}`);
}

const current=[];
walk(rewards,(row,path)=>{
  if(!routes.has(row.route))return;
  if(row.classification!=='unclaimed')return;
  if(!/^onchain: (FeesVotingReward|IncentiveVotingReward)\.earned$/.test(String(row.source||'')))return;
  if(!positiveRaw(row.amountRaw))return;
  if(!/^0x[0-9a-fA-F]{40}$/.test(String(row.token||'')))return;
  if(!row.details?.tokenId||!/^0x[0-9a-fA-F]{40}$/.test(String(row.details?.rewardContract||'')))return;
  if(String(row.symbol||'').toUpperCase()===baseSymbol[row.route])return;
  current.push({...row,_path:path.join('.')});
});
assert.ok(current.length>0,'no live non-base ve33 reward token found in current Rewards artifact');

const events=Array.isArray(ledger.events)?ledger.events:[];
assert.ok(events.length>0,'Canonical Income Ledger events missing');
const eventKeys=events.map(e=>e?.eventKey).filter(Boolean);
assert.equal(eventKeys.length,new Set(eventKeys).size,'Canonical Income Ledger contains duplicate eventKey values');

const historical=events.filter(e=>
  routes.has(e?.route)&&
  positiveRaw(e?.amountRaw)&&
  /^0x[0-9a-fA-F]{40}$/.test(String(e?.token||''))&&
  e?.tokenId!==null&&e?.tokenId!==undefined&&
  /^0x[0-9a-fA-F]{40}$/.test(String(e?.rewardContract||''))&&
  /^\d{4}-\d{2}$/.test(String(e?.periodAttributionMonth||''))
);

const key=row=>[
  row.route,
  addr(row.token),
  String(row.tokenId??row.details?.tokenId??''),
  addr(row.rewardContract??row.details?.rewardContract)
].join('|');
const byIdentity=new Map();
for(const event of historical){
  const k=key(event);
  if(!byIdentity.has(k))byIdentity.set(k,[]);
  byIdentity.get(k).push(event);
}

const proofs=[];
for(const reward of current){
  const matches=byIdentity.get(key(reward))||[];
  if(!matches.length)continue;
  for(const event of matches){
    assert.ok(event.eventKey,`matched historical event lacks eventKey for ${key(reward)}`);
    assert.ok(positiveRaw(event.amountRaw),`historical exact amountRaw lost for ${event.eventKey}`);
    assert.notEqual(event.referenceAprUsed,true,`reference APR leaked into factual event ${event.eventKey}`);
    assert.notEqual(event.currentPriceUsed,true,`current price leaked into historical event ${event.eventKey}`);
    if(finite(event.usdValue)){
      assert.ok(Number(event.usdValue)>=0,`invalid historical USD value for ${event.eventKey}`);
      assert.ok(event.valuationAt,`valued historical event lacks valuationAt for ${event.eventKey}`);
    }else{
      assert.equal(event.usdValue,null,`unproved USD must remain null for ${event.eventKey}`);
      assert.equal(event.valuationStatus,'unvalued-fail-closed',`unproved historical event did not fail closed: ${event.eventKey}`);
    }
    proofs.push({
      symbol:reward.symbol,
      route:reward.route,
      token:reward.token,
      tokenId:String(reward.details.tokenId),
      rewardContract:reward.details.rewardContract,
      currentClaimableRaw:String(reward.amountRaw),
      historicalEventKey:event.eventKey,
      historicalAmountRaw:String(event.amountRaw),
      historicalMonth:event.periodAttributionMonth,
      historicalUsd:finite(event.usdValue)?Number(event.usdValue):null,
      valuationStatus:event.valuationStatus||null
    });
  }
}

assert.ok(proofs.length>0,'no end-to-end live new-reward-token reuse precedent matched current Rewards to canonical historical accounting');
assert.match(String(ledger?.semantics?.claimableStateRule||''),/not period-income/i,'current claimable state is not explicitly separated from period income');
assert.equal(coverage?.summary?.reusableCoverageGapCount,0,'P6 reuse proof cannot pass while reusable accounting coverage gaps remain');
assert.equal(coverage?.authority?.executionAuthority,'none','coverage execution authority drift');
assert.equal(ledger?.historicalValuationResolution?.currentPriceUsed??ledger?.summary?.historicalValuationResolution?.currentPriceUsed??false,false,'historical valuation used current price');

const uniqueProofEvents=new Set(proofs.map(p=>p.historicalEventKey));
assert.equal(uniqueProofEvents.size,proofs.length,'same canonical historical event matched more than once in P6 proof');

const valued=proofs.filter(p=>p.historicalUsd!==null).length;
const failClosed=proofs.filter(p=>p.historicalUsd===null).length;
console.log('P6 supported-mechanism/new-reward-token reuse proof PASS',{
  liveNonBaseRewards:current.length,
  matchedCanonicalHistoricalEvents:proofs.length,
  valuedHistoricalEvents:valued,
  failClosedUnknownHistoricalEvents:failClosed,
  examples:proofs.slice(0,5)
});
