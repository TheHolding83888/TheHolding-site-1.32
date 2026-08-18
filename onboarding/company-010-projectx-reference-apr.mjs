#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT=process.cwd();
const STATE=process.env.COMPANY_010_STATE||path.join(ROOT,'companies/company-010-production-state.json');
const HISTORY=process.env.COMPANY_010_PROJECTX_RATE_HISTORY||path.join(ROOT,'companies/company-010-projectx-rate-history.json');
const VERSION='0.1-projectx-observed-fee-reference-apr';
const HISTORY_VERSION='0.1-projectx-rate-history';
const MIN_WINDOW_HOURS=24;
const MAX_WINDOW_HOURS=24*7;
const MAX_OBSERVATIONS=96;
const CLAIM_TOLERANCE=1e-10;

const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const finite=x=>x!==null&&x!==undefined&&x!==''&&Number.isFinite(Number(x));
const n=x=>finite(x)?Number(x):null;
const round=(x,d=8)=>finite(x)?Number(Number(x).toFixed(d)):null;
const sha=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');

function compatibleState(s){
  return s?.version==='0.3-company-010-production-state-stakedao-complete'&&s?.company?.registry==='010'&&s?.company?.name==='Cypher'&&s?.authority?.executionAuthority==='none';
}
function strategyFingerprint(px){
  const rows=(px?.positions||[]).map(x=>({tokenId:String(x.tokenId),liquidity:String(x.liquidity),tickLower:Number(x.tickLower),tickUpper:Number(x.tickUpper)})).sort((a,b)=>a.tokenId.localeCompare(b.tokenId));
  if(rows.length!==2||rows.some(x=>!x.tokenId||!x.liquidity||!Number.isFinite(x.tickLower)||!Number.isFinite(x.tickUpper)))throw new Error('Project X exact-two strategy fingerprint unavailable');
  return {manager:px.manager,pair:px.pair,rows,hash:sha({manager:px.manager,pair:px.pair,rows})};
}
function observation(state){
  const px=state.strategies?.projectX;
  if(px?.version!=='0.1-company-010-projectx-full-parity'||px?.nftCount!==2||px?.positions?.length!==2)throw new Error('Project X full-parity state required');
  const bySymbol=new Map((px.rewards?.tokens||[]).map(x=>[x.symbol,x]));
  const whype=bySymbol.get('WHYPE'),usdc=bySymbol.get('USDC');
  if(!whype||!usdc||![whype,usdc].every(x=>finite(x.amount)&&Number(x.amount)>=0&&finite(x.priceUsd)&&Number(x.priceUsd)>0))throw new Error('Project X measured WHYPE/USDC fees required');
  if(!(Number(px.principal?.navUsd)>0))throw new Error('Project X NAV required');
  const at=state.generatedAt||new Date().toISOString();
  if(!Number.isFinite(Date.parse(at)))throw new Error('Project X observation timestamp invalid');
  const fp=strategyFingerprint(px);
  return {observedAt:at,stateGeneratedAt:at,fingerprint:fp.hash,strategy:{manager:px.manager,pair:px.pair,positions:fp.rows},navUsd:round(px.principal.navUsd,8),fees:{WHYPE:round(whype.amount,12),USDC:round(usdc.amount,12)},prices:{WHYPE:round(whype.priceUsd,8),USDC:round(usdc.priceUsd,8)},source:'Company #010 Project X full-parity state · collect.staticCall max uint128'};
}
function freshHistory(){return {version:HISTORY_VERSION,engineVersion:VERSION,company:{registry:'010',name:'Cypher'},methodology:{metric:'Project X observed collectible fee APR · trailing stable-window',minimumWindowHours:MIN_WINDOW_HOURS,maximumWindowHours:MAX_WINDOW_HOURS,annualizationDays:365.25,feeTierIsNotYield:true,priceMethod:'average endpoint token prices',navMethod:'average endpoint strategy NAV',resetRules:['strategy fingerprint changed','claimable token amount decreased materially (claim/reward reset)','insufficient stable window'],interpretation:'Annualized observed collectible fee growth only. Excludes token-price PnL, impermanent loss and unproven incentives.'},observations:[],current:{status:'warming',referenceAprPct:null,windowHours:0,reason:'Need at least 24 hours of stable Project X observations.'},authority:{readOnly:true,walletSigning:false,transactions:false,executionAuthority:'none'}}}
function chooseBaseline(obs,current){
  const now=Date.parse(current.observedAt);
  const compatible=obs.filter(x=>x.fingerprint===current.fingerprint&&Date.parse(x.observedAt)<now).sort((a,b)=>Date.parse(a.observedAt)-Date.parse(b.observedAt));
  const within=compatible.filter(x=>{const h=(now-Date.parse(x.observedAt))/36e5;return h>=MIN_WINDOW_HOURS&&h<=MAX_WINDOW_HOURS});
  return within.length?within[0]:null;
}
function claimResetSince(obs,current){
  const prior=obs.filter(x=>x.fingerprint===current.fingerprint&&Date.parse(x.observedAt)<Date.parse(current.observedAt)).sort((a,b)=>Date.parse(a.observedAt)-Date.parse(b.observedAt));
  if(!prior.length)return false;
  const last=prior.at(-1);
  return ['WHYPE','USDC'].some(s=>Number(current.fees[s])+CLAIM_TOLERANCE<Number(last.fees[s]));
}
function feeApr(base,current){
  const elapsedMs=Date.parse(current.observedAt)-Date.parse(base.observedAt),hours=elapsedMs/36e5;
  if(!(hours>=MIN_WINDOW_HOURS&&hours<=MAX_WINDOW_HOURS))return null;
  let feeDeltaUsd=0;
  for(const symbol of ['WHYPE','USDC']){
    const delta=Number(current.fees[symbol])-Number(base.fees[symbol]);
    if(delta<-CLAIM_TOLERANCE)return null;
    const avgPx=(Number(base.prices[symbol])+Number(current.prices[symbol]))/2;
    feeDeltaUsd+=Math.max(0,delta)*avgPx;
  }
  const avgNav=(Number(base.navUsd)+Number(current.navUsd))/2;
  if(!(avgNav>0))return null;
  const apr=feeDeltaUsd/avgNav*(365.25*24/hours)*100;
  return {referenceAprPct:round(apr,6),feeDeltaUsd:round(feeDeltaUsd,8),averageNavUsd:round(avgNav,8),windowHours:round(hours,4),periodStart:base.observedAt,periodEnd:current.observedAt};
}
function recalcProductivity(state){
  const rows=state.productivity?.positions||[];
  const valued=rows.filter(x=>finite(x.valueUsd));
  const covered=valued.filter(x=>x.status==='measured'||x.status==='supported-existing-adapter');
  state.productivity.knownProductiveValueUsd=round(valued.reduce((s,x)=>s+Number(x.valueUsd),0),2);
  state.productivity.currentlyAprCoveredValueUsd=round(covered.reduce((s,x)=>s+Number(x.valueUsd),0),2);
  state.productivity.coverage=state.productivity.knownProductiveValueUsd>0?round(state.productivity.currentlyAprCoveredValueUsd/state.productivity.knownProductiveValueUsd,6):null;
  state.productivity.status=state.productivity.coverage===1?'complete':'partial';
}

const state=read(STATE);
if(!compatibleState(state))throw new Error('compatible Company #010 production state required');
const currentObs=observation(state);
let history=fs.existsSync(HISTORY)?read(HISTORY):freshHistory();
if(history.version!==HISTORY_VERSION||history.authority?.executionAuthority!=='none')throw new Error('Project X rate history compatibility mismatch');
history.observations=Array.isArray(history.observations)?history.observations:[];
history.observations=history.observations.filter(x=>x&&x.observedAt&&x.fingerprint);

const duplicateIndex=history.observations.findIndex(x=>x.observedAt===currentObs.observedAt&&x.fingerprint===currentObs.fingerprint);
if(duplicateIndex>=0)history.observations[duplicateIndex]=currentObs;else history.observations.push(currentObs);
history.observations.sort((a,b)=>Date.parse(a.observedAt)-Date.parse(b.observedAt));

let resetReason=null;
const allBefore=history.observations.filter(x=>Date.parse(x.observedAt)<Date.parse(currentObs.observedAt));
if(allBefore.length&&allBefore.at(-1).fingerprint!==currentObs.fingerprint)resetReason='strategy fingerprint changed';
if(claimResetSince(history.observations,currentObs))resetReason='claimable fee amount decreased; observation window reset';
if(resetReason){
  history.observations=history.observations.filter(x=>x.fingerprint!==currentObs.fingerprint||Date.parse(x.observedAt)>=Date.parse(currentObs.observedAt));
}

const baseline=resetReason?null:chooseBaseline(history.observations,currentObs);
const measured=baseline?feeApr(baseline,currentObs):null;
const px=state.strategies.projectX;
const prod=(state.productivity?.positions||[]).find(x=>x.id==='projectx-whype-usdc');
if(!prod)throw new Error('Project X productivity row missing');

if(measured){
  const metric='Project X observed collectible fee APR · trailing stable-window';
  px.yield={status:'measured',referenceAprPct:measured.referenceAprPct,publicStatus:`APR ${measured.referenceAprPct.toFixed(2)}%`,referenceMetric:metric,source:'Project X canonical onchain collect.staticCall observation history',periodStart:measured.periodStart,periodEnd:measured.periodEnd,windowHours:measured.windowHours,feeDeltaUsd:measured.feeDeltaUsd,averageNavUsd:measured.averageNavUsd,methodology:'Annualized growth of collectible WHYPE+USDC fees over an unchanged two-NFT strategy fingerprint; endpoint-average token prices and strategy NAV; fee tier is never used as yield.',claimableApplicable:true,incomeMode:'separate-claimable-fees'};
  Object.assign(prod,{referenceAprPct:measured.referenceAprPct,status:'measured',source:'Project X canonical onchain collect.staticCall observation history',referenceMetric:metric,incomeMode:'separate-claimable-fees',claimableApplicable:true,methodology:px.yield.methodology});
  state.gaps=(state.gaps||[]).filter(x=>x.id!=='project-x-reference-apr');
  history.current={status:'measured',...measured,metric};
}else{
  const priorCompatible=history.observations.filter(x=>x.fingerprint===currentObs.fingerprint&&Date.parse(x.observedAt)<Date.parse(currentObs.observedAt));
  const oldest=priorCompatible[0];
  const hours=oldest?Math.max(0,(Date.parse(currentObs.observedAt)-Date.parse(oldest.observedAt))/36e5):0;
  const reason=resetReason||`Need at least ${MIN_WINDOW_HOURS} hours of stable Project X observations; current stable window ${round(hours,2)}h.`;
  px.yield={status:'warming',referenceAprPct:null,publicStatus:'APR Pending',referenceMetric:'Project X observed collectible fee APR · trailing stable-window',source:'Project X canonical onchain collect.staticCall observation history',windowHours:round(hours,4),reason,methodology:'Fee tier is not yield. APR promotes automatically after a stable >=24h two-NFT observation window with non-decreasing collectible fees.',claimableApplicable:true,incomeMode:'separate-claimable-fees'};
  Object.assign(prod,{referenceAprPct:null,status:'warming',source:'Project X canonical onchain collect.staticCall observation history',referenceMetric:px.yield.referenceMetric,incomeMode:'separate-claimable-fees',claimableApplicable:true,methodology:px.yield.methodology});
  state.gaps=(state.gaps||[]).filter(x=>x.id!=='project-x-reference-apr');
  state.gaps.push({id:'project-x-reference-apr',severity:'productivity',status:'warming',meaning:reason});
  history.current={status:'warming',referenceAprPct:null,windowHours:round(hours,4),reason};
}

recalcProductivity(state);
state.epistemicBoundary=state.epistemicBoundary||{};
Object.assign(state.epistemicBoundary,{projectXFeeTierIsNotApr:true,projectXReferenceAprUsesObservedFeeGrowth:true,projectXAprResetsOnStrategyChangeOrClaim:true,projectXAprMinimumStableWindowHours:MIN_WINDOW_HOURS});
state.provenance=state.provenance||{};
state.provenance.projectXReferenceApr={version:VERSION,historyFile:'companies/company-010-projectx-rate-history.json',metric:'Project X observed collectible fee APR · trailing stable-window',minimumWindowHours:MIN_WINDOW_HOURS,maximumWindowHours:MAX_WINDOW_HOURS,generatedAt:new Date().toISOString()};
history.generatedAt=new Date().toISOString();
history.engineVersion=VERSION;
history.observations=history.observations.slice(-MAX_OBSERVATIONS);
fs.writeFileSync(STATE,JSON.stringify(state,null,2)+'\n');
fs.mkdirSync(path.dirname(HISTORY),{recursive:true});
fs.writeFileSync(HISTORY,JSON.stringify(history,null,2)+'\n');
console.log(JSON.stringify({status:'PASS',version:VERSION,projectXReferenceAprPct:px.yield.referenceAprPct,projectXRateStatus:px.yield.status,windowHours:px.yield.windowHours||0,historyObservations:history.observations.length,resetReason,productivityCoverage:state.productivity.coverage,executionAuthority:'none'},null,2));
