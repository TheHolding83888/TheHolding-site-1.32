#!/usr/bin/env node
import fs from 'node:fs';
import process from 'node:process';

const COMPANY=String(process.env.ACCOUNTING_DIAGNOSTIC_COMPANY||'Cypher').trim();
const read=file=>{try{return JSON.parse(fs.readFileSync(file,'utf8'));}catch{return{};}};
const canonical=name=>name==='aerocrvyb.eth'?'aerocvxyb.eth':String(name||'').trim();
const same=(a,b)=>canonical(a)===canonical(b);
const conciseWallet=w=>({
  wallet:w?.wallet||w?.address||null,
  walletAlias:w?.walletAlias||w?.alias||null,
  status:w?.status||null,
  positionCount:Array.isArray(w?.details?.positions)?w.details.positions.length:null,
  positions:(w?.details?.positions||[]).map(p=>({tokenId:p?.tokenId||null,mode:p?.mode||null,managedTokenId:p?.managedTokenId||null,currentVotedPools:p?.currentVotedPools||[],recentVotedPools:p?.recentVotedPools||[],matchedRewardPools:p?.matchedRewardPools||[],freeManagedReward:p?.freeManagedReward||null}))
});
const pickDetails=d=>{
  if(!d||typeof d!=='object')return{};
  const keys=['wallet','walletAlias','mode','veNftCount','directCount','managedCount','issues','statusPublic','unknownIsNotZero','rewardState','stateVersion','delegate','forwarding','route','routeRole','settlement','publicState','nftCount','multiLegComplete','claimableApplicable','embeddedMeasurementStatus','externalIncentivesStatus','externalRewardAssetCount','market','hToken','incomeMode','referenceAprPct','referenceAprStatus'];
  return Object.fromEntries(keys.filter(k=>d[k]!==undefined).map(k=>[k,d[k]]));
};
const conciseSource=s=>({
  route:s?.route||null,
  status:s?.status||null,
  protocol:s?.protocol||null,
  chain:s?.chain||null,
  routeDetails:pickDetails(s?.details),
  walletResults:(s?.details?.walletResults||s?.walletResults||[]).map(conciseWallet),
  detailKeys:s?.details&&typeof s.details==='object'?Object.keys(s.details).sort():[]
});

const productivity=read(process.env.PRODUCTIVITY_DATA_FILE||'./companies/productivity-data.json');
const rewards=read(process.env.REWARDS_DATA_FILE||'./companies/rewards-data.json');
const ledger=read(process.env.INCOME_LEDGER_FILE||'./reporting/income-ledger.json');
const embedded=read(process.env.EMBEDDED_YIELD_LEDGER_FILE||'./companies/embedded-yield-ledger.json');
const ve33=read(process.env.VE33_EVIDENCE_FILE||'./reporting/ve33-accounting-evidence.json');
const locked=read(process.env.VE33_LOCKED_MANAGED_EVIDENCE_FILE||'./reporting/ve33-locked-managed-accounting-evidence.json');
const yb=read(process.env.YIELD_BASIS_EVIDENCE_FILE||'./reporting/yield-basis-accounting-evidence.json');
const frax=read(process.env.FRAX_EVIDENCE_FILE||'./reporting/frax-yield-accounting-evidence.json');
const coverage=read(process.env.ACCOUNTING_COVERAGE_FILE||'/tmp/accounting-coverage.json');

const pKeys=Object.keys(productivity?.companies||{}).filter(k=>same(k,COMPANY));
const rKeys=Object.keys(rewards?.companies||{}).filter(k=>same(k,COMPANY));
const lKeys=Object.keys(ledger?.companies||{}).filter(k=>same(k,COMPANY));
const p=pKeys.length?productivity.companies[pKeys[0]]:null;
const r=rKeys.length?rewards.companies[rKeys[0]]:null;
const l=lKeys.length?ledger.companies[lKeys[0]]:null;
const c=coverage?.companies?.[canonical(COMPANY)]||null;
const evidenceRows=(obj,source)=>(obj?.checkpoints||[]).filter(x=>same(x?.company,COMPANY)).map(x=>({source,protocolKey:x?.protocolKey||null,route:x?.route||null,wallet:x?.wallet||x?.holder||null,tokenId:x?.tokenId||null,managedTokenId:x?.managedTokenId||null,kind:x?.kind||null,observedAt:x?.observedAt||null,ok:x?.ok??null}));

const output={
  company:COMPANY,
  canonicalCompany:canonical(COMPANY),
  productivity:{
    keys:pKeys,
    registry:p?.registry||null,
    trackingStartedAt:p?.trackingStartedAt||null,
    breakdown:(p?.breakdown||[]).map(x=>({engineId:x?.engineId||null,principalId:x?.principalId||null,engineStatus:x?.engineStatus||null,value:x?.value??x?.valueUsd??null,referenceAprPct:x?.referenceAprPct??x?.aprPct??null}))
  },
  rewards:{
    keys:rKeys,
    sourceCount:Array.isArray(r?.sources)?r.sources.length:0,
    sources:(r?.sources||[]).map(conciseSource),
    rewardRows:(r?.rewards||[]).map(x=>({route:x?.route||null,protocol:x?.protocol||null,token:x?.token||x?.symbol||null,claimable:x?.claimable??x?.amount??null,status:x?.status||null}))
  },
  ledger:{
    keys:lKeys,
    registry:l?.registry||null,
    currentClaimableStateRows:(l?.currentClaimableState?.rows||[]).map(x=>({route:x?.route||null,protocol:x?.protocol||null,asset:x?.asset||x?.token||null,amount:x?.amount??x?.claimable??null,status:x?.status||null})),
    eventCount:(ledger?.events||[]).filter(x=>same(x?.company,COMPANY)).length,
    events:(ledger?.events||[]).filter(x=>same(x?.company,COMPANY)).map(x=>({eventKey:x?.eventKey||null,family:x?.family||null,protocol:x?.protocol||null,route:x?.route||null,asset:x?.asset||null,economicDate:x?.economicDate||null,usdValue:x?.usdValue??null,sourceFile:x?.sourceFile||null})).slice(-50)
  },
  embedded:same(embedded?.company?.name,COMPANY)?{company:embedded.company,positionIds:Object.keys(embedded?.positions||{}),positions:Object.entries(embedded?.positions||{}).map(([id,x])=>({id,protocol:x?.protocol||null,chain:x?.chain||null,incomeMode:x?.incomeMode||null,eligible:x?.accounting?.embeddedYieldEligible??null,checkpointCount:Array.isArray(x?.checkpoints)?x.checkpoints.length:0}))}:null,
  factualEvidence:[...evidenceRows(ve33,'ve33'),...evidenceRows(locked,'ve33-locked-managed'),...evidenceRows(yb,'yield-basis'),...evidenceRows(frax,'frax')],
  coverage:c?{
    sourceAliases:c.sourceAliases,
    mechanismCount:c.mechanismCount,
    mechanisms:Object.fromEntries(Object.entries(c.mechanisms||{}).map(([id,m])=>[id,{protocol:m?.protocol||null,family:m?.accountingFamily||null,status:m?.months?.[coverage.currentMonth]?.status||null,factualTrackingActive:m?.months?.[coverage.currentMonth]?.factualTrackingActive??null,factualEventCount:m?.months?.[coverage.currentMonth]?.factualEventCount||0,stateRoutes:m?.months?.[coverage.currentMonth]?.currentStateRouteCount||0,productiveValueUsd:m?.productiveValueUsd??null}]))
  }:null
};

console.log('Accounting company diagnostic',JSON.stringify(output,null,2));
