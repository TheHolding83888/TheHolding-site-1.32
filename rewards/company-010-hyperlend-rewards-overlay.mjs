#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const ROOT=process.cwd();
const DATA=process.env.REWARDS_DATA||path.join(ROOT,'companies/rewards-data.json');
const STATE=process.env.COMPANY_010_STATE||path.join(ROOT,'companies/company-010-production-state.json');
const VERSION='0.1-company-010-hyperlend-rewards-projection';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const finite=x=>x!==null&&x!==undefined&&x!==''&&Number.isFinite(Number(x));
const round=(x,d=12)=>finite(x)?Number(Number(x).toFixed(d)):null;

const data=read(DATA);
const state=read(STATE);
const c=data.companies?.Cypher;
const hyper=state.strategies?.hyperlend;

if(!c)throw new Error('Cypher canonical Rewards aggregate required');
if(state?.company?.registry!=='010'||state?.company?.name!=='Cypher')throw new Error('canonical Company #010 state required');
if(state?.authority?.executionAuthority!=='none')throw new Error('Company #010 execution authority drift');
if(hyper?.version!=='0.1-company-010-hyperlend-income-parity'||hyper?.status!=='measured')throw new Error('canonical HyperLend income state required');
if(hyper?.authority?.executionAuthority!=='none'||hyper?.authority?.walletSigning!==false||hyper?.authority?.transactions!==false)throw new Error('HyperLend authority drift');
if(hyper.accountingBoundary?.embeddedInterestAlreadyInPrincipalBalance!==true||hyper.accountingBoundary?.embeddedInterestNotAdditiveCapital!==true||hyper.accountingBoundary?.embeddedInterestNotClaimable!==true||hyper.accountingBoundary?.externalIncentivesSeparateFromSupplyApr!==true||hyper.accountingBoundary?.noDoubleCount!==true)throw new Error('HyperLend accounting boundary missing');
if(state.epistemicBoundary?.hyperlendSupplyInterestIsEmbedded!==true||state.epistemicBoundary?.hyperlendEmbeddedInterestIsNotClaimable!==true||state.epistemicBoundary?.hyperlendExternalIncentivesAreSeparate!==true||state.epistemicBoundary?.hyperlendAprIsNotRealisedIncome!==true)throw new Error('HyperLend epistemic boundary missing');

c.rewards=(c.rewards||[]).filter(x=>x.route!=='hyperlend-khype-incentives');
c.sources=(c.sources||[]).filter(x=>!String(x.route||'').startsWith('hyperlend-khype'));
c.embeddedIncome=(c.embeddedIncome||[]).filter(x=>x.route!=='hyperlend-khype');

const primary=hyper.income?.primary;
const ext=hyper.income?.externalIncentives;
if(!primary||!ext)throw new Error('HyperLend income decomposition missing');
if(primary.state!=='Compounded'||primary.claimableApplicable!==false)throw new Error('HyperLend embedded income semantics drift');

c.sources.push({
  protocol:'HyperLend',
  route:'hyperlend-khype',
  status:primary.measurementStatus==='measured'?'ok':'partial',
  chain:'HyperEVM',
  metric:'kHYPE supply interest via scaled balance + liquidity index',
  note:'HyperLend lending interest accrues inside the hToken balance and is represented as Compounded / Embedded, never as freely claimable income.',
  details:{
    market:'kHYPE',
    hToken:hyper.hToken,
    referenceAprPct:hyper.referenceAprPct,
    rewardState:'Compounded',
    incomeMode:'embedded-lending-interest',
    claimableApplicable:false,
    embeddedMeasurementStatus:primary.measurementStatus,
    externalIncentivesStatus:ext.status,
    externalRewardAssetCount:ext.rewardAssetCount,
    unknownIsNotZero:primary.measurementStatus!=='measured'
  }
});

const cap=(state.capital?.positions||[]).find(x=>String(x.assetId||'').startsWith('hyperlend-'));
c.embeddedIncome.push({
  protocol:'HyperLend',
  route:'hyperlend-khype',
  chain:'HyperEVM',
  state:'Compounded',
  claimableApplicable:false,
  symbol:'kHYPE',
  amount:primary.amount,
  classification:'compounded-embedded',
  usdValue:primary.usdValue,
  priceUsd:cap?.priceUsd??null,
  priceMethod:'canonical-company-010-current-hyperlend-oracle-price',
  usdValueIncludedInClaimableTotal:false,
  usdValueIncludedInMeasuredEarnedTotal:finite(primary.usdValue),
  metric:primary.metric,
  note:'Supply interest is already embedded in current HyperLend hToken balance / NAV; this row is presentation-only measured earned and is never additive capital.'
});

if(Number(ext.rewardAssetCount)>0){
  c.sources.push({
    protocol:'HyperLend',
    route:'hyperlend-khype-incentives',
    status:'ok',
    chain:'HyperEVM',
    metric:'hToken RewardsController getUserRewards',
    note:'External incentives, when configured, are separate from supply APR and represented as Unclaimed.',
    details:{controller:ext.controller,rewardState:'Claimable',rewardAssetCount:ext.rewardAssetCount}
  });
  for(const x of ext.rewards||[]){
    c.rewards.push({
      protocol:'HyperLend',
      route:'hyperlend-khype-incentives',
      chain:'HyperEVM',
      token:x.rewardToken,
      symbol:x.symbol,
      amountRaw:null,
      decimals:x.decimals,
      amount:x.claimable,
      classification:'unclaimed',
      source:x.source,
      usdValue:null,
      priceUsd:null,
      priceMethod:null,
      details:{market:'kHYPE',hToken:hyper.hToken,rewardsController:ext.controller,rewardState:'Claimable',emissionPerSecondRaw:x.emissionPerSecondRaw,distributionEnd:x.distributionEnd}
    });
  }
}

const claimableRows=c.rewards||[];
const embeddedRows=c.embeddedIncome||[];
c.knownAccruedUsd=round(claimableRows.reduce((s,x)=>s+(finite(x.usdValue)?Number(x.usdValue):0),0),6);
c.claimableUsd=c.knownAccruedUsd;
c.totalUsd=c.knownAccruedUsd;
c.unpricedRewards=claimableRows.filter(x=>!finite(x.usdValue)&&Number(x.amount||0)>0).length;
c.measuredEmbeddedUsd=round(embeddedRows.reduce((s,x)=>s+(finite(x.usdValue)?Number(x.usdValue):0),0),6);
c.measuredEarnedUsd=round(c.claimableUsd+c.measuredEmbeddedUsd,6);
c.measuredEarnedUsdIsComplete=false;
c.totalUsdIsComplete=false;
c.measuredEarnedTokens=[...new Set([...claimableRows.filter(x=>finite(x.usdValue)).map(x=>x.symbol),...embeddedRows.filter(x=>finite(x.usdValue)).map(x=>x.symbol)].filter(Boolean))];
const sourceCount=(c.sources||[]).length;
const complete=(c.sources||[]).filter(x=>x.status==='ok').length;
const measured=(c.sources||[]).filter(x=>['ok','partial'].includes(x.status)).length;
c.routeCount=sourceCount;
c.completeRoutes=complete;
c.measuredRoutes=measured;
c.pendingRoutes=sourceCount-complete;
c.routeCoverage=sourceCount?round(measured/sourceCount,6):0;
c.completeRouteCoverage=sourceCount?round(complete/sourceCount,6):0;
c.updatedAt=state.generatedAt||new Date().toISOString();

data.diagnostics=data.diagnostics||{};
data.diagnostics.company010=data.diagnostics.company010||{};
data.diagnostics.company010.hyperlendIncome={
  version:VERSION,
  sourceStateVersion:hyper.version,
  state:'Compounded',
  claimableApplicable:false,
  embeddedMeasurementStatus:primary.measurementStatus,
  externalIncentivesStatus:ext.status,
  rewardAssetCount:ext.rewardAssetCount,
  noDoubleCount:true,
  sourceOfTruth:'companies/company-010-production-state.json',
  repositoryMutationAuthority:'Update Company Rewards',
  executionAuthority:'none'
};

fs.writeFileSync(DATA,JSON.stringify(data,null,2)+'\n');
console.log(JSON.stringify({
  status:'PASS',
  version:VERSION,
  claimableUsd:c.claimableUsd,
  measuredEmbeddedUsd:c.measuredEmbeddedUsd,
  measuredEarnedUsd:c.measuredEarnedUsd,
  hyperlendIncentiveRows:c.rewards.filter(x=>x.route==='hyperlend-khype-incentives').length,
  executionAuthority:'none'
},null,2));
