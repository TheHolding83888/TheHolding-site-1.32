import fs from 'node:fs';
import path from 'node:path';
import { applyVlCvxLockerPlatformProof, collectVlCvxLockerPlatformProof } from './vlcvx-locker-platform-proof.mjs';
import { applyVlCvxExtraRewardDistributionProof, collectVlCvxExtraRewardDistributionProof } from './vlcvx-extra-reward-distribution-proof.mjs';

const OUTPUT=process.env.REWARDS_OUTPUT||path.resolve('companies/rewards-data.json');
const TARGETS=['YieldRing.eth','defitea.eth',"Rook's portfolio",'Cypher'];
const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
const round=(v,d=6)=>finite(v)?Number(Number(v).toFixed(d)):null;
function summaries(rewards){const m=new Map();for(const r of rewards||[]){const key=`${r.symbol||'?'}|${r.token||''}`;if(!m.has(key))m.set(key,{symbol:r.symbol||'?',token:r.token||null,amount:0,usd:0,complete:true});const x=m.get(key);x.amount+=Number(r.amount||0);if(finite(r.usdValue))x.usd+=Number(r.usdValue);else x.complete=false}return[...m.values()].map(x=>({symbol:x.symbol,token:x.token,amount:round(x.amount,10),usdValue:x.complete?round(x.usd):null}))}
function finalize(c){if(!c)return;const rewards=c.rewards||[],claimable=round(rewards.reduce((s,r)=>s+(finite(r.usdValue)?Number(r.usdValue):0),0));c.totalUsd=claimable;if('knownAccruedUsd'in c)c.knownAccruedUsd=claimable;if('claimableUsd'in c)c.claimableUsd=claimable;c.rewardTokens=summaries(rewards);const unpriced=rewards.filter(r=>!finite(r.usdValue)).length;c.unpricedRewards=unpriced;if('measuredEmbeddedUsd'in c||Array.isArray(c.embeddedIncome)){const embedded=(c.embeddedIncome||[]).reduce((s,x)=>s+(finite(x.usdValue)?Number(x.usdValue):0),0);c.measuredEmbeddedUsd=round(embedded);c.measuredEarnedUsd=round(claimable+embedded);const symbols=new Set(rewards.map(r=>r.symbol).filter(Boolean));for(const e of c.embeddedIncome||[])if(e.symbol)symbols.add(e.symbol);c.measuredEarnedTokens=[...symbols];if(c.measuredEarnedUsdIsComplete!==true)c.measuredEarnedUsdIsComplete=false}if(c.settlement&&typeof c.settlement==='object'){if('claimableUsd'in c.settlement)c.settlement.claimableUsd=claimable;if('knownAccruedUsd'in c.settlement)c.settlement.knownAccruedUsd=claimable}}

async function main(){
  const d=JSON.parse(fs.readFileSync(OUTPUT,'utf8'));
  const platformProof=await collectVlCvxLockerPlatformProof();
  applyVlCvxLockerPlatformProof(d,platformProof);
  const extraRewardProof=await collectVlCvxExtraRewardDistributionProof();
  applyVlCvxExtraRewardDistributionProof(d,extraRewardProof);
  for(const k of TARGETS)finalize(d.companies?.[k]);
  d.diagnostics=d.diagnostics||{};
  d.diagnostics.vlCvxRouteAggregateFinalize={
    version:'0.3-vlcvx-route-aggregate-finalize-with-platform-and-extra-components',
    generatedAt:new Date().toISOString(),
    executionAuthority:'none',
    targets:TARGETS,
    lockerPlatformComponentMaterialized:true,
    extraRewardDistributionComponentMaterialized:true,
    extraRewardDistributionInventoryStatus:extraRewardProof.summary.rewardInventoryStatus,
    semanticBoundary:'CvxLockerV2 platform and vlCvxExtraRewardDistribution current state are component evidence only; neither creates period income nor resolves the separate delegate-incentive settlement lane.'
  };
  fs.writeFileSync(OUTPUT,JSON.stringify(d,null,2)+'\n');
  console.log('vlCVX aggregate finalize PASS',TARGETS.map(k=>({
    company:k,
    claimable:d.companies?.[k]?.claimableUsd??d.companies?.[k]?.totalUsd,
    measuredEarned:d.companies?.[k]?.measuredEarnedUsd??null,
    platformSource:(d.companies?.[k]?.sources||[]).find(x=>x.route==='vlcvx-locker-platform-rewards')?.status||null,
    extraRewardSource:(d.companies?.[k]?.sources||[]).find(x=>x.route==='vlcvx-extra-reward-distribution')?.status||null,
    extraRewardInventory:(d.companies?.[k]?.sources||[]).find(x=>x.route==='vlcvx-extra-reward-distribution')?.details?.rewardInventoryStatus||null
  })));
}

main().catch(e=>{console.error(e);process.exitCode=1});
