#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const ROOT=process.cwd();
const DATA=process.env.REWARDS_DATA||path.join(ROOT,'companies/rewards-data.json');
const STATE=process.env.COMPANY_010_STATE||path.join(ROOT,'companies/company-010-production-state.json');
const VERSION='0.3.10';
const COLLECTOR='0.3.10-company-010-stakedao-state-admission';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const finite=x=>x!==null&&x!==undefined&&x!==''&&Number.isFinite(Number(x));
const round=(x,d=8)=>finite(x)?Number(Number(x).toFixed(d)):null;

const data=read(DATA),state=read(STATE);
if(!['0.3.9','0.3.10'].includes(String(data.version)))throw new Error(`Rewards v0.3.9/v0.3.10 required, got ${data.version}`);
if(data.methodologyVersion!=='0.2.2-earned-inside-protocols-multiwallet')throw new Error('Rewards methodology mismatch');
if(state?.version!=='0.3-company-010-production-state-stakedao-complete'||state?.company?.registry!=='010'||state?.company?.name!=='Cypher')throw new Error('complete Cypher canonical state required');
if(state?.authority?.executionAuthority!=='none'||state?.epistemicBoundary?.unknownIsNotZero!==true)throw new Error('Cypher authority/epistemic boundary mismatch');

const obs=(state.rewards?.observations||[]).find(x=>x.id==='stakedao-base-curve-4pool-crv');
if(!obs||obs.status!=='measured'||obs.token!=='CRV'||!finite(obs.claimable)||Number(obs.claimable)<0)throw new Error('measured Stake DAO CRV observation required');
const crvRow=(state.capital?.positions||[]).find(x=>x.assetId==='curve-dao-token'||x.symbol==='CRV');
if(!crvRow||!finite(crvRow.priceUsd)||Number(crvRow.priceUsd)<=0)throw new Error('current CRV price required from canonical Cypher state');
const wallets=(state.company?.wallets||[]).map((w,i)=>({alias:w.alias||`Wallet ${i+1}`,ens:w.ens||null,address:w.address,resolution:'canonical-company-state',fallbackMatched:null}));
if(!wallets.length)throw new Error('Cypher wallets unavailable');
const amount=Number(obs.claimable),price=Number(crvRow.priceUsd),usd=round(amount*price,6);
const reward={protocol:'Stake DAO',route:'stakedao-base-curve-4pool',chain:'Base',token:'0x8ee73c484a26e0a5df2ee2a4960b789967dd0415',symbol:'CRV',amountRaw:null,decimals:18,amount:round(amount,10),classification:'unclaimed',source:obs.source||'Stake DAO verified Accountant integral state on Base',usdValue:usd,priceUsd:round(price,8),priceMethod:'canonical-company-010-current-crv-price',details:{strategy:'Curve 4pool · USDC/USDbC/axlUSDC/crvUSD',vault:state.provenance?.stakeDaoBase?.vault||null,stateVersion:state.version,stateGeneratedAt:state.generatedAt,claimableMethod:obs.method||'Stake DAO Accountant integral',walletScope:'canonical Company #010 wallets'}};

const sources=[
  {protocol:'Stake DAO',route:'stakedao-base-curve-4pool',status:'ok',chain:'Base',metric:'Stake DAO Accountant claimable CRV',note:'Current CRV accrued inside the Stake DAO strategy is measured from the canonical Company #010 state backed by verified Accountant integral accounting.',details:{stateVersion:state.version,rewardCount:1}},
  {protocol:'Aerodrome',route:'aerodrome-ve',status:'warming',chain:'Base',metric:'existing global direct veAERO reward collector',note:'Cypher route is proven present, but this overlay does not fabricate a reward amount before the mature global route collector is bound to Company #010.',details:{walletAlias:'Wallet 2',unknownIsNotZero:true}},
  {protocol:'Velodrome',route:'velodrome-ve-direct',status:'warming',chain:'Optimism',metric:'existing global direct veVELO reward collector',note:'Cypher route is proven present, but this overlay does not fabricate a reward amount before the mature global route collector is bound to Company #010.',details:{walletAlias:'Wallet 2',unknownIsNotZero:true}},
  {protocol:'Votium · The Union',route:'votium-union',status:'warming',chain:'Ethereum',metric:'member-level Votium/Union accrued rewards',note:'Cypher vlCVX route is known; current claimable amount remains unresolved in this global snapshot and is not treated as zero.',details:{walletAlias:'Wallet 2',unknownIsNotZero:true}}
];
const measuredSources=sources.filter(x=>x.status==='ok'||x.status==='partial').length;
const completeSources=sources.filter(x=>x.status==='ok').length;
const routeCount=sources.length;
const cypher={status:'partial',ens:'Cypher',address:wallets[0].address,resolution:'canonical-company-state',fallbackMatched:null,wallets,totalUsd:usd,totalUsdIsComplete:false,knownAccruedUsd:usd,routeCoverage:round(measuredSources/routeCount,6),completeRouteCoverage:round(completeSources/routeCount,6),measuredRoutes:measuredSources,completeRoutes:completeSources,routeCount,pendingRoutes:routeCount-completeSources,unpricedRewards:0,rewards:[reward],rewardTokens:[{symbol:'CRV',token:reward.token,amount:round(amount,10),usdValue:usd,usdComplete:true}],sources,updatedAt:state.generatedAt||new Date().toISOString(),settlementStatus:'partial-known-accrual',settlement:{readinessStatus:'partial',deferred:true,method:'known-measured-rewards-plus-unbound-proven-routes',knownAccruedUsd:usd,totalUsd:usd,unpricedTokenCount:0,unpricedTokens:[],priceCoverage:1,totalUsdIsComplete:false,unknownPriceIsNotZero:true,unknownRouteIsNotZero:true,unresolvedRoutes:sources.filter(x=>x.status!=='ok').map(x=>x.route)}};

data.companies=data.companies&&typeof data.companies==='object'&&!Array.isArray(data.companies)?data.companies:{};
data.companies.Cypher=cypher;
data.version=VERSION;data.collectorVersion=COLLECTOR;data.generatedAt=new Date().toISOString();data.date=data.generatedAt.slice(0,10);
data.scope='protocol-side accrued rewards for The Holding companies and Defitea Fund, including state-backed Company #010 Stake DAO admission';
data.methodology=data.methodology||{};
data.methodology.company010='Cypher Stake DAO CRV is measured from the verified Stake DAO Accountant via canonical Company #010 state. Proven Aerodrome veAERO, Velodrome veVELO and Votium/Union routes remain explicit unresolved routes until their mature global collectors are bound; unknown route amounts are never treated as zero.';
data.methodology.tvlTreatment='Accrued Rewards remain separate from Company TVL and Treasury cash.';
data.engineErrors=data.engineErrors||{};
data.engineErrors.Cypher=cypher.settlement.unresolvedRoutes.length?{status:'partial-route-binding',unresolvedRoutes:cypher.settlement.unresolvedRoutes,note:'These are known reward mechanisms awaiting global collector binding, not zero rewards.'}:null;
if(data.engineErrors.Cypher===null)delete data.engineErrors.Cypher;

const history=Array.isArray(data.history)?data.history:[];
let snap=history.find(x=>x?.date===data.date);
if(!snap){snap={date:data.date,generatedAt:data.generatedAt,companies:{}};history.push(snap)}
snap.generatedAt=data.generatedAt;snap.companies=snap.companies||{};snap.companies.Cypher={status:cypher.status,totalUsd:cypher.totalUsd,totalUsdIsComplete:false,rewardTokens:cypher.rewardTokens};
data.history=history.slice(-400);

data.summary={companyCount:Object.keys(data.companies).length,totalAccruedUsd:round(Object.values(data.companies).reduce((sum,c)=>sum+(finite(c?.totalUsd)?Number(c.totalUsd):0),0),6),completeCompanyCount:Object.values(data.companies).filter(c=>c?.totalUsdIsComplete===true).length,partialCompanyCount:Object.values(data.companies).filter(c=>c?.totalUsdIsComplete!==true).length,company010KnownAccruedUsd:usd,company010TotalUsdIsComplete:false,unknownRouteIsNotZero:true};
fs.writeFileSync(DATA,JSON.stringify(data,null,2)+'\n');
console.log(JSON.stringify({status:'PASS',version:VERSION,company:'Cypher',knownAccruedUsd:usd,claimableCrv:amount,crvPriceUsd:price,totalUsdIsComplete:false,completeRoutes:completeSources,routeCount,unresolvedRoutes:cypher.settlement.unresolvedRoutes,executionAuthority:'none'},null,2));