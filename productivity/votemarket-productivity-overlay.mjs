#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const ROOT=process.cwd();
const DATA=process.env.PRODUCTIVITY_DATA||path.join(ROOT,'companies/productivity-data.json');
const REWARDS=process.env.REWARDS_DATA||path.join(ROOT,'companies/rewards-data.json');
const REPORT=process.env.PRODUCTIVITY_REPORT||path.join(ROOT,'companies/productivity-source-report.json');
const MAX_PERIOD_AGE_DAYS=Number(process.env.VOTEMARKET_MAX_PERIOD_AGE_DAYS||21);
const VERSION='0.2-votemarket-income-channel-overlay-idempotent';
const DAYS_PER_PERIOD=7;
const DAYS_PER_YEAR=365;
const MAX_REASONABLE_APR=500;
const OVERLAY_NOTE='VoteMarket veCRV/veFXN rewards are modeled as supplementary income channels on the existing principal: capital is counted once, verified latest finalized company-specific markets may add Reference APR, and the overlay never grants factual earned-income authority.';

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

function rowKey(r){
  const d=r?.details||{};
  return [r?.route,d.epoch,d.chainId,d.campaignId,r?.token,r?.wallet].map(x=>String(x??'')).join('|');
}

function routeRows(companyRewards,route){
  const seen=new Set();
  const out=[];
  for(const r of companyRewards?.rewards||[]){
    if(r?.route!==route||r?.classification!=='unclaimed')continue;
    const d=r?.details||{};
    if(d.periodUpdated!==true||!finite(d.epoch))continue;
    const key=rowKey(r);
    if(seen.has(key))continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}

function latestFinalizedEpoch(rows){
  const epochs=rows.map(r=>Number(r?.details?.epoch)).filter(Number.isFinite);
  return epochs.length?Math.max(...epochs):null;
}

function buildVoteMarketChannel(companyRewards,route,principalValueUsd,rewardsGeneratedAt){
  const rows=routeRows(companyRewards,route);
  const epoch=latestFinalizedEpoch(rows);
  if(epoch===null)return {
    status:'unavailable',reason:'no-finalized-unclaimed-votemarket-period',aprPct:null,rewardUsd:null,markets:[],
    observationPersistence:'current-unclaimed-period-only',claimedPeriodPersistencePending:true,
    earnedIncomeAuthority:false,factualIncomeAuthority:false,canCloseAccountingCoverage:false,canReplaceUnknown:false,executionAuthority:'none'
  };
  const periodRows=rows.filter(r=>Number(r?.details?.epoch)===epoch);
  const epochDate=periodRows.map(r=>r?.details?.epochDate).find(Boolean)||new Date(epoch*1000).toISOString();
  const generatedMs=Date.parse(rewardsGeneratedAt||'');
  const epochMs=Date.parse(epochDate||'');
  const ageDays=Number.isFinite(generatedMs)&&Number.isFinite(epochMs)?Math.max(0,(generatedMs-epochMs)/86400000):null;
  const usdComplete=periodRows.length>0&&periodRows.every(r=>finite(r?.usdValue));
  const principalOk=finite(principalValueUsd)&&Number(principalValueUsd)>0;
  const fresh=ageDays===null||ageDays<=MAX_PERIOD_AGE_DAYS;
  const rewardUsd=usdComplete?periodRows.reduce((s,r)=>s+Number(r.usdValue),0):null;
  const aprPct=usdComplete&&principalOk&&fresh
    ? rewardUsd/Number(principalValueUsd)*(DAYS_PER_YEAR/DAYS_PER_PERIOD)*100
    : null;
  const sane=finite(aprPct)&&Number(aprPct)>=0&&Number(aprPct)<=MAX_REASONABLE_APR;
  const status=!usdComplete?'partial-unpriced'
    :!principalOk?'unavailable-principal-value'
    :!fresh?'stale-period'
    :!sane?'unavailable-apr-sanity'
    :'measured-reference';

  const markets=periodRows.map(r=>{
    const d=r?.details||{};
    return {
      campaignId:d.campaignId??null,
      market:d.gauge||null,
      marketLabel:shortAddress(d.gauge),
      chainId:d.chainId??null,
      gaugeChainId:d.gaugeChainId??null,
      rewardToken:r.symbol||d.symbol||null,
      rewardAmount:finite(r.amount)?round(r.amount,10):null,
      rewardUsd:finite(r.usdValue)?round(r.usdValue,8):null,
      accountVoteRaw:d.accountVoteRaw??null,
      rewardPerVoteRaw:d.rewardPerVoteRaw??null,
      feeRateRaw:d.feeRateRaw??null,
      proofUrl:d.proofUrl||null,
      walletAlias:r.walletAlias||null,
      calculation:d.calculation||null
    };
  });

  return {
    status,
    aprPct:status==='measured-reference'?round(aprPct,6):null,
    rewardUsd:usdComplete?round(rewardUsd,8):null,
    epoch,
    epochDate,
    periodDays:DAYS_PER_PERIOD,
    ageDays:finite(ageDays)?round(ageDays,3):null,
    marketCount:markets.length,
    markets,
    usdComplete,
    principalValueUsd:principalOk?round(principalValueUsd,2):null,
    source:'companies/rewards-data.json',
    sourceGeneratedAt:rewardsGeneratedAt||null,
    sourceSemantics:'verified-company-specific-votemarket-period-net-reward-over-existing-principal-value',
    observationPersistence:'current-unclaimed-period-only',
    claimedPeriodPersistencePending:true,
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
if(String(data?.version)!=='1.16')fail(`Productivity v1.16 required, got ${data?.version}`);
if(rewards?.authority?.executionAuthority&&rewards.authority.executionAuthority!=='none')fail('Rewards authority expansion detected');

const diagnostics={
  version:VERSION,
  source:'companies/rewards-data.json',
  sourceGeneratedAt:rewards.generatedAt||null,
  companies:{},
  capitalDoubleCount:false,
  unknownIsNotZero:true,
  idempotent:true,
  observationPersistence:'current-unclaimed-period-only',
  claimedPeriodPersistencePending:true,
  earnedIncomeAuthority:false,
  factualIncomeAuthority:false,
  executionAuthority:'none'
};
let measuredReferenceCompanyCount=0;

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
    const channel=buildVoteMarketChannel(companyRewards,route,principalValue,rewards.generatedAt);
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
      capitalValueUsd:principalValue===null?null:round(principalValue,2),
      capitalCountedOnce:true,
      observationPersistence:channel.observationPersistence,
      claimedPeriodPersistencePending:channel.claimedPeriodPersistencePending===true
    };
  }
  if(Object.keys(companyDiag.routes).length){
    recomputeCompany(company);
    company.voteMarketIncomeChannels={
      version:VERSION,
      routes:companyDiag.routes,
      capitalDoubleCount:false,
      estimatedIncomeAuthority:'reference-only',
      observationPersistence:'current-unclaimed-period-only',
      claimedPeriodPersistencePending:true,
      idempotent:true,
      executionAuthority:'none'
    };
    diagnostics.companies[companyName]=companyDiag;
    if(hasMeasuredReference)measuredReferenceCompanyCount+=1;
  }
}

data.diagnostics=data.diagnostics||{};
data.diagnostics.voteMarketIncomeChannels={...diagnostics,measuredReferenceCompanyCount,affectedCompanyCount:measuredReferenceCompanyCount};
const existingNote=String(data.note||'').replace(/\s+$/,'');
data.note=existingNote.includes(OVERLAY_NOTE)?existingNote:[existingNote,OVERLAY_NOTE].filter(Boolean).join(' ');
fs.writeFileSync(DATA,JSON.stringify(data,null,2)+'\n');

if(fs.existsSync(REPORT)){
  const report=read(REPORT);
  report.voteMarketIncomeChannels=data.diagnostics.voteMarketIncomeChannels;
  fs.writeFileSync(REPORT,JSON.stringify(report,null,2)+'\n');
}

console.log(JSON.stringify({
  status:'PASS',
  version:VERSION,
  measuredReferenceCompanyCount,
  companies:Object.keys(diagnostics.companies),
  capitalDoubleCount:false,
  idempotent:true,
  observationPersistence:'current-unclaimed-period-only',
  claimedPeriodPersistencePending:true,
  earnedIncomeAuthority:false,
  factualIncomeAuthority:false,
  executionAuthority:'none'
},null,2));
