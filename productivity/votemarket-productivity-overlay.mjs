#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const ROOT=process.cwd();
const DATA=process.env.PRODUCTIVITY_DATA||path.join(ROOT,'companies/productivity-data.json');
const REWARDS=process.env.REWARDS_DATA||path.join(ROOT,'companies/rewards-data.json');
const REPORT=process.env.PRODUCTIVITY_REPORT||path.join(ROOT,'companies/productivity-source-report.json');
const STATE=process.env.VOTEMARKET_REFERENCE_STATE||path.join(ROOT,'companies/votemarket-reference-state.json');
const MAX_PERIOD_AGE_DAYS=Number(process.env.VOTEMARKET_MAX_PERIOD_AGE_DAYS||21);
const STATE_RETENTION_WEEKS=Number(process.env.VOTEMARKET_STATE_RETENTION_WEEKS||64);
const VERSION='0.3-votemarket-claimed-aware-reference-persistence';
const STATE_VERSION='0.1-votemarket-derived-reference-continuity-cache';
const DAYS_PER_PERIOD=7;
const DAYS_PER_YEAR=365;
const MAX_REASONABLE_APR=500;
const OVERLAY_NOTE='VoteMarket veCRV/veFXN rewards are modeled as supplementary income channels on the existing principal: capital is counted once, verified company-specific finalized periods may persist as derived Reference observations across a later claim, and the overlay never grants factual earned-income authority.';

const ROUTES=Object.freeze({
  'votemarket-vecrv':{
    principalEngineId:'curve_vecrv',
    principalFallbackId:'curve-dao-token',
    principalLabel:'veCRV',
    nativeLabel:'Curve fees',
    channelLabel:'VoteMarket'
  },
  'votemarket-vefxn':{
    principalEngineId:'fx_vefxn',
    principalFallbackId:'fxn-token',
    principalLabel:'veFXN',
    nativeLabel:'veFXN Locker',
    channelLabel:'VoteMarket'
  }
});

const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
const round=(v,d=6)=>finite(v)?Number(Number(v).toFixed(d)):null;
const fail=m=>{throw new Error(m);};
const shortAddress=v=>{const s=String(v||'');return /^0x[a-fA-F0-9]{40}$/.test(s)?`${s.slice(0,6)}…${s.slice(-4)}`:s||null;};
const lower=v=>String(v||'').toLowerCase();

function emptyState(){
  return {
    version:STATE_VERSION,
    generatedAt:null,
    sourceRewardsGeneratedAt:null,
    semantics:{
      role:'derived-reference-observation-continuity-cache',
      sourceOfTruth:false,
      source:'companies/rewards-data.json',
      retentionWeeks:STATE_RETENTION_WEEKS,
      capitalDoubleCount:false,
      unknownIsNotZero:true,
      earnedIncomeAuthority:false,
      factualIncomeAuthority:false,
      canCloseAccountingCoverage:false,
      canReplaceUnknown:false,
      executionAuthority:'none'
    },
    companies:{},
    diagnostics:{unresolvedClaimedDiagnosticCount:0,claimedTransitionCount:0}
  };
}

function loadState(){
  if(!fs.existsSync(STATE))return emptyState();
  const state=read(STATE);
  if(state?.version!==STATE_VERSION)fail(`VoteMarket reference state version mismatch: ${state?.version||'missing'}`);
  if(state?.semantics?.sourceOfTruth!==false||state?.semantics?.factualIncomeAuthority!==false||state?.semantics?.executionAuthority!=='none'){
    fail('VoteMarket reference state authority boundary drift');
  }
  state.companies=state.companies&&typeof state.companies==='object'?state.companies:{};
  state.diagnostics=state.diagnostics&&typeof state.diagnostics==='object'?state.diagnostics:{};
  return state;
}

function marketKey(route,epoch,chainId,campaignId,token,wallet){
  return [route,epoch,chainId,campaignId,lower(token),lower(wallet)].map(x=>String(x??'')).join('|');
}

function currentRouteRows(companyRewards,route){
  const seen=new Set();
  const out=[];
  for(const r of companyRewards?.rewards||[]){
    if(r?.route!==route||r?.classification!=='unclaimed')continue;
    const d=r?.details||{};
    if(d.periodUpdated!==true||!finite(d.epoch))continue;
    const key=marketKey(route,d.epoch,d.chainId,d.campaignId,r?.token,r?.wallet);
    if(seen.has(key))continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}

function routeClaimDiagnostics(companyRewards,route){
  const out=[];
  for(const source of companyRewards?.sources||[]){
    if(source?.route!==route)continue;
    const walletResults=Array.isArray(source?.details?.walletResults)?source.details.walletResults:[];
    for(const wr of walletResults){
      for(const d of wr?.details?.diagnostics||[]){
        if(d?.status!=='already-claimed'||!finite(d?.epoch)||!finite(d?.chainId)||d?.campaignId===null||d?.campaignId===undefined||!d?.rewardToken)continue;
        out.push({
          route,
          wallet:wr?.wallet||null,
          walletAlias:wr?.walletAlias||null,
          epoch:Number(d.epoch),
          chainId:Number(d.chainId),
          campaignId:String(d.campaignId),
          rewardToken:d.rewardToken,
          claimedRaw:d.claimedRaw??null,
          proofUrl:d.proofUrl||null
        });
      }
    }
  }
  return out;
}

function routeState(state,companyName,route){
  state.companies[companyName]=state.companies[companyName]||{routes:{}};
  state.companies[companyName].routes=state.companies[companyName].routes||{};
  state.companies[companyName].routes[route]=state.companies[companyName].routes[route]||{epochs:{}};
  state.companies[companyName].routes[route].epochs=state.companies[companyName].routes[route].epochs||{};
  return state.companies[companyName].routes[route];
}

function upsertCurrentRows(state,companyName,route,rows,principalValueUsd,observedAt){
  const rs=routeState(state,companyName,route);
  const currentKeys=new Set();
  for(const r of rows){
    const d=r?.details||{};
    const epoch=Number(d.epoch);
    const ek=String(epoch);
    const key=marketKey(route,epoch,d.chainId,d.campaignId,r?.token,r?.wallet);
    currentKeys.add(key);
    const existingEpoch=rs.epochs[ek]||{};
    const existingMarket=existingEpoch?.markets?.[key]||null;
    const amountRaw=String(r?.amountRaw??r?.amount??'');
    const sameAmount=existingMarket&&String(existingMarket.amountRaw??existingMarket.rewardAmount??'')===amountRaw;
    const rewardUsd=finite(r?.usdValue)
      ? round(r.usdValue,8)
      : sameAmount&&finite(existingMarket?.rewardUsd)
        ? Number(existingMarket.rewardUsd)
        : null;
    const priceContinuity=finite(r?.usdValue)?'current-priced':sameAmount&&finite(existingMarket?.rewardUsd)?'persisted-last-measured-same-amount':'unpriced';
    const principalBasis=finite(existingEpoch?.principalValueUsdAtObservation)
      ? Number(existingEpoch.principalValueUsdAtObservation)
      : finite(principalValueUsd)?round(principalValueUsd,2):null;
    rs.epochs[ek]={
      epoch,
      epochDate:d.epochDate||existingEpoch.epochDate||new Date(epoch*1000).toISOString(),
      firstObservedAt:existingEpoch.firstObservedAt||observedAt||null,
      lastObservedAt:observedAt||existingEpoch.lastObservedAt||null,
      principalValueUsdAtObservation:principalBasis,
      markets:{...(existingEpoch.markets||{}),[key]:{
        key,
        chainId:d.chainId??null,
        campaignId:d.campaignId??null,
        token:r?.token||null,
        wallet:r?.wallet||null,
        walletAlias:r?.walletAlias||null,
        gauge:d.gauge||null,
        gaugeChainId:d.gaugeChainId??null,
        rewardToken:r?.symbol||d.symbol||null,
        amountRaw,
        rewardAmount:finite(r?.amount)?round(r.amount,10):null,
        rewardUsd,
        priceContinuity,
        accountVoteRaw:d.accountVoteRaw??null,
        rewardPerVoteRaw:d.rewardPerVoteRaw??null,
        feeRateRaw:d.feeRateRaw??null,
        proofUrl:d.proofUrl||null,
        calculation:d.calculation||null,
        claimState:'unclaimed',
        claimedRaw:null,
        claimedObservedAt:null,
        firstObservedAt:existingMarket?.firstObservedAt||observedAt||null,
        lastObservedAt:observedAt||existingMarket?.lastObservedAt||null
      }}
    };
  }
  return currentKeys;
}

function applyClaimDiagnostics(state,companyName,route,diagnostics,observedAt){
  const rs=routeState(state,companyName,route);
  let claimedTransitionCount=0;
  let unresolvedClaimedDiagnosticCount=0;
  for(const d of diagnostics){
    const ek=String(d.epoch);
    const epoch=rs.epochs[ek];
    const key=marketKey(route,d.epoch,d.chainId,d.campaignId,d.rewardToken,d.wallet);
    const market=epoch?.markets?.[key];
    if(!market){
      unresolvedClaimedDiagnosticCount++;
      continue;
    }
    if(market.claimState!=='claimed-observed')claimedTransitionCount++;
    market.claimState='claimed-observed';
    market.claimedRaw=d.claimedRaw??market.claimedRaw??null;
    market.claimedObservedAt=observedAt||market.claimedObservedAt||null;
    market.lastObservedAt=observedAt||market.lastObservedAt||null;
    if(d.proofUrl&&!market.proofUrl)market.proofUrl=d.proofUrl;
  }
  return {claimedTransitionCount,unresolvedClaimedDiagnosticCount};
}

function pruneState(state,referenceAt){
  const refMs=Date.parse(referenceAt||'');
  if(!Number.isFinite(refMs))return;
  const cutoffMs=refMs-STATE_RETENTION_WEEKS*DAYS_PER_PERIOD*86400000;
  for(const company of Object.values(state.companies||{})){
    for(const rs of Object.values(company?.routes||{})){
      for(const [ek,epoch] of Object.entries(rs?.epochs||{})){
        const epochMs=Number(epoch?.epoch)*1000;
        if(Number.isFinite(epochMs)&&epochMs<cutoffMs)delete rs.epochs[ek];
      }
    }
  }
}

function buildVoteMarketChannel(state,companyName,route,currentKeys,currentPrincipalValueUsd,rewardsGeneratedAt){
  const rs=state?.companies?.[companyName]?.routes?.[route];
  const epochs=Object.values(rs?.epochs||{}).filter(x=>finite(x?.epoch)&&Object.keys(x?.markets||{}).length);
  const latest=epochs.sort((a,b)=>Number(b.epoch)-Number(a.epoch))[0]||null;
  if(!latest)return {
    status:'unavailable',reason:'no-measured-votemarket-reference-observation',aprPct:null,rewardUsd:null,markets:[],
    observationPersistence:'claimed-aware-derived-cache',persistenceUsed:false,claimedPeriodPersistencePending:false,
    earnedIncomeAuthority:false,factualIncomeAuthority:false,canCloseAccountingCoverage:false,canReplaceUnknown:false,executionAuthority:'none'
  };
  const periodRows=Object.values(latest.markets||{});
  const epoch=Number(latest.epoch);
  const epochDate=latest.epochDate||new Date(epoch*1000).toISOString();
  const generatedMs=Date.parse(rewardsGeneratedAt||'');
  const epochMs=Date.parse(epochDate||'');
  const ageDays=Number.isFinite(generatedMs)&&Number.isFinite(epochMs)?Math.max(0,(generatedMs-epochMs)/86400000):null;
  const usdComplete=periodRows.length>0&&periodRows.every(r=>finite(r?.rewardUsd));
  const principalValueUsd=finite(latest.principalValueUsdAtObservation)
    ? Number(latest.principalValueUsdAtObservation)
    : finite(currentPrincipalValueUsd)?Number(currentPrincipalValueUsd):null;
  const principalOk=finite(principalValueUsd)&&Number(principalValueUsd)>0;
  const fresh=ageDays===null||ageDays<=MAX_PERIOD_AGE_DAYS;
  const rewardUsd=usdComplete?periodRows.reduce((s,r)=>s+Number(r.rewardUsd),0):null;
  const aprPct=usdComplete&&principalOk&&fresh
    ? rewardUsd/Number(principalValueUsd)*(DAYS_PER_YEAR/DAYS_PER_PERIOD)*100
    : null;
  const sane=finite(aprPct)&&Number(aprPct)>=0&&Number(aprPct)<=MAX_REASONABLE_APR;
  const status=!usdComplete?'partial-unpriced'
    :!principalOk?'unavailable-principal-value'
    :!fresh?'stale-period'
    :!sane?'unavailable-apr-sanity'
    :'measured-reference';
  const persistedMarketCount=periodRows.filter(r=>!currentKeys.has(r.key)).length;
  const claimedMarketCount=periodRows.filter(r=>r.claimState==='claimed-observed').length;
  const markets=periodRows.map(r=>({
    campaignId:r.campaignId??null,
    market:r.gauge||null,
    marketLabel:shortAddress(r.gauge),
    chainId:r.chainId??null,
    gaugeChainId:r.gaugeChainId??null,
    rewardToken:r.rewardToken||null,
    rewardAmount:finite(r.rewardAmount)?round(r.rewardAmount,10):null,
    rewardUsd:finite(r.rewardUsd)?round(r.rewardUsd,8):null,
    accountVoteRaw:r.accountVoteRaw??null,
    rewardPerVoteRaw:r.rewardPerVoteRaw??null,
    feeRateRaw:r.feeRateRaw??null,
    proofUrl:r.proofUrl||null,
    walletAlias:r.walletAlias||null,
    calculation:r.calculation||null,
    claimState:r.claimState||'unknown',
    observationSource:currentKeys.has(r.key)?'current-rewards':'derived-persistence-cache',
    priceContinuity:r.priceContinuity||null
  }));

  return {
    status,
    aprPct:status==='measured-reference'?round(aprPct,6):null,
    rewardUsd:usdComplete?round(rewardUsd,8):null,
    epoch,
    epochDate,
    periodDays:DAYS_PER_PERIOD,
    ageDays:finite(ageDays)?round(ageDays,3):null,
    marketCount:markets.length,
    currentMarketCount:periodRows.length-persistedMarketCount,
    persistedMarketCount,
    claimedMarketCount,
    persistenceUsed:persistedMarketCount>0||claimedMarketCount>0,
    markets,
    usdComplete,
    principalValueUsd:principalOk?round(principalValueUsd,2):null,
    principalValueBasis:'first-measured-finalized-epoch-principal',
    source:'companies/rewards-data.json + companies/votemarket-reference-state.json',
    sourceGeneratedAt:rewardsGeneratedAt||null,
    sourceSemantics:'verified-company-specific-votemarket-period-net-reward persisted as non-factual reference continuity across claim',
    observationPersistence:'claimed-aware-derived-cache',
    claimedPeriodPersistencePending:false,
    earnedIncomeAuthority:false,
    factualIncomeAuthority:false,
    canCloseAccountingCoverage:false,
    canReplaceUnknown:false,
    executionAuthority:'none'
  };
}

function principalRow(company,meta){
  return (company?.breakdown||[]).find(x=>x?.engineId===meta.principalEngineId||x?.principalId===meta.principalFallbackId)||null;
}

function nativeAprForRow(data,row,meta){
  const canonical=Number(data?.engines?.[meta.principalEngineId]?.aprLatest);
  if(Number.isFinite(canonical))return canonical;
  const prior=row?.incomeChannels;
  if(prior?.principalEngineId===meta.principalEngineId&&finite(prior?.native?.aprPct))return Number(prior.native.aprPct);
  const current=Number(row?.apr);
  return Number.isFinite(current)?current:null;
}

function recomputeCompany(company){
  let productive=0,covered=0,weighted=0;
  for(const row of company?.breakdown||[]){
    const value=Number(row?.value);
    if(Number.isFinite(value)&&value>=0)productive+=value;
    const apr=Number(row?.apr);
    const usable=Number.isFinite(value)&&value>=0&&Number.isFinite(apr)&&row?.engineStatus!=='warming'&&row?.engineStatus!=='unavailable';
    if(usable){covered+=value;weighted+=value*apr;}
  }
  company.productiveValue=productive>0?round(productive,2):company.productiveValue??null;
  company.coveredProductiveValue=round(covered,2);
  company.uncoveredProductiveValue=productive>0?round(Math.max(0,productive-covered),2):company.uncoveredProductiveValue??null;
  company.coverage=productive>0?round(covered/productive,6):0;
  company.aprLatest=covered>0?round(weighted/covered,4):null;
  company.aprScope=company.coverage>=0.999999?'full-productive-capital':'covered-productive-capital';
  company.status=covered>0?(company.coverage>=0.999999?'ok':'partial'):'partial';
}

if(!fs.existsSync(DATA))fail(`Productivity data missing: ${DATA}`);
if(!fs.existsSync(REWARDS))fail(`Rewards data missing: ${REWARDS}`);
const data=read(DATA);
const rewards=read(REWARDS);
const state=loadState();
if(String(data?.version)!=='1.16')fail(`Productivity v1.16 required, got ${data?.version}`);
if(rewards?.authority?.executionAuthority&&rewards.authority.executionAuthority!=='none')fail('Rewards authority expansion detected');

const diagnostics={
  version:VERSION,
  source:'companies/rewards-data.json',
  sourceGeneratedAt:rewards.generatedAt||null,
  persistenceState:'companies/votemarket-reference-state.json',
  persistenceStateVersion:STATE_VERSION,
  persistenceStateSourceOfTruth:false,
  companies:{},
  capitalDoubleCount:false,
  unknownIsNotZero:true,
  idempotent:true,
  observationPersistence:'claimed-aware-derived-cache',
  claimedPeriodPersistencePending:false,
  earnedIncomeAuthority:false,
  factualIncomeAuthority:false,
  canCloseAccountingCoverage:false,
  executionAuthority:'none'
};
let measuredReferenceCompanyCount=0;
let claimedTransitionCount=0;
let unresolvedClaimedDiagnosticCount=0;

for(const [companyName,companyRewards] of Object.entries(rewards?.companies||{})){
  const company=data?.companies?.[companyName];
  if(!company||!Array.isArray(company.breakdown))continue;
  const companyDiag={routes:{}};
  let hasMeasuredReference=false;
  for(const [route,meta] of Object.entries(ROUTES)){
    const row=principalRow(company,meta);
    if(!row)continue;
    const nativeApr=nativeAprForRow(data,row,meta);
    const principalValue=finite(row.value)?Number(row.value):null;
    const rows=currentRouteRows(companyRewards,route);
    const currentKeys=upsertCurrentRows(state,companyName,route,rows,principalValue,rewards.generatedAt||data.generatedAt||null);
    const claimResult=applyClaimDiagnostics(state,companyName,route,routeClaimDiagnostics(companyRewards,route),rewards.generatedAt||data.generatedAt||null);
    claimedTransitionCount+=claimResult.claimedTransitionCount;
    unresolvedClaimedDiagnosticCount+=claimResult.unresolvedClaimedDiagnosticCount;
    const channel=buildVoteMarketChannel(state,companyName,route,currentKeys,principalValue,rewards.generatedAt);
    const effectiveApr=nativeApr!==null&&channel.status==='measured-reference'&&finite(channel.aprPct)
      ? nativeApr+Number(channel.aprPct)
      : nativeApr;
    row.incomeChannels={
      version:VERSION,
      principal:meta.principalLabel,
      principalEngineId:meta.principalEngineId,
      capitalAccounting:'principal-counted-once',
      capitalDoubleCount:false,
      native:{label:meta.nativeLabel,aprPct:nativeApr===null?null:round(nativeApr,6),sourceEngineId:meta.principalEngineId},
      votemarket:{label:meta.channelLabel,...channel},
      effectiveAprPct:effectiveApr===null?null:round(effectiveApr,6),
      effectiveAprIncludesVoteMarket:channel.status==='measured-reference'&&nativeApr!==null,
      displayHierarchy:[meta.principalLabel,meta.nativeLabel,meta.channelLabel],
      estimatedIncomeEligible:channel.status==='measured-reference',
      earnedIncomeAuthority:false,
      factualIncomeAuthority:false,
      unknownIsNotZero:true,
      idempotent:true,
      executionAuthority:'none'
    };
    if(effectiveApr!==null)row.apr=round(effectiveApr,6);
    if(channel.status==='measured-reference')hasMeasuredReference=true;
    companyDiag.routes[route]={
      principalEngineId:meta.principalEngineId,
      nativeAprPct:nativeApr===null?null:round(nativeApr,6),
      voteMarketAprPct:channel.aprPct,
      effectiveAprPct:row.incomeChannels.effectiveAprPct,
      status:channel.status,
      marketCount:channel.marketCount||0,
      currentMarketCount:channel.currentMarketCount||0,
      persistedMarketCount:channel.persistedMarketCount||0,
      claimedMarketCount:channel.claimedMarketCount||0,
      persistenceUsed:channel.persistenceUsed===true,
      capitalValueUsd:principalValue===null?null:round(principalValue,2),
      capitalCountedOnce:true,
      observationPersistence:channel.observationPersistence,
      claimedPeriodPersistencePending:false
    };
  }
  if(Object.keys(companyDiag.routes).length){
    recomputeCompany(company);
    company.voteMarketIncomeChannels={
      version:VERSION,
      routes:companyDiag.routes,
      capitalDoubleCount:false,
      estimatedIncomeAuthority:'reference-only',
      observationPersistence:'claimed-aware-derived-cache',
      claimedPeriodPersistencePending:false,
      idempotent:true,
      executionAuthority:'none'
    };
    diagnostics.companies[companyName]=companyDiag;
    if(hasMeasuredReference)measuredReferenceCompanyCount+=1;
  }
}

pruneState(state,rewards.generatedAt||data.generatedAt||null);
state.generatedAt=rewards.generatedAt||data.generatedAt||null;
state.sourceRewardsGeneratedAt=rewards.generatedAt||null;
state.semantics={...emptyState().semantics,retentionWeeks:STATE_RETENTION_WEEKS};
state.diagnostics={claimedTransitionCount,unresolvedClaimedDiagnosticCount};
fs.mkdirSync(path.dirname(STATE),{recursive:true});
fs.writeFileSync(STATE,JSON.stringify(state,null,2)+'\n');

data.diagnostics=data.diagnostics||{};
data.diagnostics.voteMarketIncomeChannels={
  ...diagnostics,
  measuredReferenceCompanyCount,
  affectedCompanyCount:measuredReferenceCompanyCount,
  claimedTransitionCount,
  unresolvedClaimedDiagnosticCount
};
const existingNote=String(data.note||'').replace(/\s+$/,'');
const legacyNote='VoteMarket veCRV/veFXN rewards are modeled as supplementary income channels on the existing principal: capital is counted once, verified latest finalized company-specific markets may add Reference APR, and the overlay never grants factual earned-income authority.';
const noteBase=existingNote.includes(legacyNote)?existingNote.replace(legacyNote,'').replace(/\s+/g,' ').trim():existingNote;
data.note=noteBase.includes(OVERLAY_NOTE)?noteBase:[noteBase,OVERLAY_NOTE].filter(Boolean).join(' ');
fs.writeFileSync(DATA,JSON.stringify(data,null,2)+'\n');

if(fs.existsSync(REPORT)){
  const report=read(REPORT);
  report.voteMarketIncomeChannels=data.diagnostics.voteMarketIncomeChannels;
  fs.writeFileSync(REPORT,JSON.stringify(report,null,2)+'\n');
}

console.log(JSON.stringify({
  status:'PASS',
  version:VERSION,
  stateVersion:STATE_VERSION,
  measuredReferenceCompanyCount,
  claimedTransitionCount,
  unresolvedClaimedDiagnosticCount,
  companies:Object.keys(diagnostics.companies),
  capitalDoubleCount:false,
  idempotent:true,
  observationPersistence:'claimed-aware-derived-cache',
  claimedPeriodPersistencePending:false,
  persistenceStateSourceOfTruth:false,
  earnedIncomeAuthority:false,
  factualIncomeAuthority:false,
  executionAuthority:'none'
},null,2));
