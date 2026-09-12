#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename=fileURLToPath(import.meta.url);
const __dirname=path.dirname(__filename);
const ROOT=path.resolve(__dirname,'..');

export const VERSION='0.1-committed-rewards-token-price-recovery';
export const CANONICAL_REWARDS_REPO_PATH='companies/rewards-data.json';
export const HISTORICAL_REWARDS_PRICE_POLICY=Object.freeze({
  version:'0.1-month-bounded-committed-rewards-fallback',
  maxAgeMinutes:35*24*60,
  maxHistoryCommits:128,
  exactTokenAddressRequired:true,
  symbolMatchingForbidden:true,
  latestValidObservationBeforeBoundary:true,
  currentPriceUsed:false,
  referenceAprUsed:false,
  executionAuthority:'none'
});

const lower=v=>String(v||'').toLowerCase();
const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
const ADDRESS=/^0x[0-9a-f]{40}$/i;

function defaultGitRun(args,{root=ROOT}={}){
  return execFileSync('git',args,{cwd:root,encoding:'utf8',maxBuffer:32*1024*1024,stdio:['ignore','pipe','pipe']});
}

function rewardRowToken(row){return lower(row?.token||row?.rewardToken||row?.details?.rewardToken||'');}
function rewardRowObservedAt(row,snapshot){return row?.priceObservedAt||row?.observedAt||row?.details?.priceObservedAt||snapshot?.generatedAt||null;}
function rewardRowPriceMethod(row){return row?.priceMethod||row?.details?.priceMethod||null;}

export function selectHistoricalRewardsTokenPrice({
  snapshot,
  token,
  boundaryAt,
  maxAgeMinutes=HISTORICAL_REWARDS_PRICE_POLICY.maxAgeMinutes
}={}){
  const tokenAddress=lower(token),boundaryMs=Date.parse(boundaryAt||'');
  if(!ADDRESS.test(tokenAddress))return{ok:false,status:'historical-rewards-token-address-invalid',assetId:null};
  if(!Number.isFinite(boundaryMs))return{ok:false,status:'invalid-accounting-boundary',assetId:tokenAddress};
  if(!(finite(maxAgeMinutes)&&Number(maxAgeMinutes)>=0))return{ok:false,status:'invalid-historical-rewards-price-freshness-contract',assetId:tokenAddress};

  const exactRows=[];
  for(const[company,companyState]of Object.entries(snapshot?.companies||{})){
    for(const row of companyState?.rewards||[]){
      if(rewardRowToken(row)!==tokenAddress)continue;
      exactRows.push({company,row});
    }
  }
  if(!exactRows.length)return{ok:false,status:'historical-rewards-token-not-observed-in-snapshot',assetId:tokenAddress};

  const usable=[];let lastFailure=null;
  for(const{company,row}of exactRows){
    const priceUsd=Number(row?.priceUsd),priceMethod=rewardRowPriceMethod(row),observedAt=rewardRowObservedAt(row,snapshot),observedMs=Date.parse(observedAt||'');
    if(!(Number.isFinite(priceUsd)&&priceUsd>0)){lastFailure={ok:false,status:'historical-rewards-token-price-not-finite-positive',assetId:tokenAddress,company};continue;}
    if(!priceMethod){lastFailure={ok:false,status:'historical-rewards-token-price-method-missing',assetId:tokenAddress,company};continue;}
    if(!Number.isFinite(observedMs)){lastFailure={ok:false,status:'historical-rewards-token-price-observation-time-missing',assetId:tokenAddress,company};continue;}
    if(observedMs>boundaryMs){lastFailure={ok:false,status:'historical-rewards-token-price-observed-after-accounting-boundary',assetId:tokenAddress,company,observedAt};continue;}
    const ageMinutes=(boundaryMs-observedMs)/60_000;
    if(ageMinutes>Number(maxAgeMinutes)){lastFailure={ok:false,status:'historical-rewards-token-price-too-old-for-accounting-boundary',assetId:tokenAddress,company,observedAt,ageMinutes:Number(ageMinutes.toFixed(6)),maxAgeMinutes:Number(maxAgeMinutes)};continue;}
    usable.push({
      company,
      route:row?.route||null,
      symbol:row?.symbol||null,
      priceUsd,
      priceMethod:String(priceMethod),
      observedAt,
      observedMs,
      ageMinutes:Number(ageMinutes.toFixed(6))
    });
  }
  if(!usable.length)return lastFailure||{ok:false,status:'historical-rewards-token-price-unavailable',assetId:tokenAddress};

  usable.sort((a,b)=>b.observedMs-a.observedMs);
  const latestMs=usable[0].observedMs,latest=usable.filter(x=>x.observedMs===latestMs);
  const reference=latest[0].priceUsd;
  if(latest.some(x=>Math.abs(x.priceUsd-reference)>Math.max(1e-12,Math.abs(reference)*1e-9))){
    return{ok:false,status:'historical-rewards-token-price-conflict',assetId:tokenAddress,observedAt:latest[0].observedAt,observations:latest.map(x=>({company:x.company,route:x.route,priceUsd:x.priceUsd,priceMethod:x.priceMethod}))};
  }
  const selected=latest[0];
  return{
    ok:true,
    status:'historical-canonical-rewards-token-price',
    sourceFamily:'canonical-rewards-git-history',
    assetId:tokenAddress,
    tokenAddress,
    symbol:selected.symbol,
    priceUsd:selected.priceUsd,
    observedAt:selected.observedAt,
    ageMinutes:selected.ageMinutes,
    maxAgeMinutes:Number(maxAgeMinutes),
    priceMethod:selected.priceMethod,
    snapshotGeneratedAt:snapshot?.generatedAt||null,
    snapshotVersion:snapshot?.version||null,
    sourceCompanies:[...new Set(latest.map(x=>x.company))].sort(),
    sourceRoutes:[...new Set(latest.map(x=>x.route).filter(Boolean))].sort(),
    exactTokenAddressMatch:true,
    symbolMatchingUsed:false,
    currentPriceUsed:false,
    referenceAprUsed:false,
    executionAuthority:'none'
  };
}

export function historicalRewardsTokenPriceFromGit({
  token,
  boundaryAt,
  root=ROOT,
  gitRun=defaultGitRun,
  maxHistoryCommits=HISTORICAL_REWARDS_PRICE_POLICY.maxHistoryCommits,
  maxAgeMinutes=HISTORICAL_REWARDS_PRICE_POLICY.maxAgeMinutes
}={}){
  const tokenAddress=lower(token),boundaryMs=Date.parse(boundaryAt||'');
  if(!ADDRESS.test(tokenAddress))return{ok:false,status:'historical-rewards-token-address-invalid',assetId:null};
  if(!Number.isFinite(boundaryMs))return{ok:false,status:'invalid-accounting-boundary',assetId:tokenAddress};
  const limit=Math.max(1,Math.min(512,Number(maxHistoryCommits)||HISTORICAL_REWARDS_PRICE_POLICY.maxHistoryCommits));
  let history=[];
  try{
    const raw=gitRun(['log',`--max-count=${limit}`,'--format=%H|%cI',`--before=${boundaryAt}`,'HEAD','--',CANONICAL_REWARDS_REPO_PATH],{root});
    history=String(raw||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean).map(line=>{const i=line.indexOf('|');return i>0?{commitSha:line.slice(0,i),commitAt:line.slice(i+1)}:null;}).filter(Boolean);
  }catch(error){return{ok:false,status:'canonical-rewards-git-history-unavailable',assetId:tokenAddress,error:error?.message||String(error)};}
  if(!history.length)return{ok:false,status:'canonical-rewards-git-history-empty',assetId:tokenAddress};

  let lastFailure=null;
  for(const entry of history){
    const commitMs=Date.parse(entry.commitAt||'');
    if(Number.isFinite(commitMs)&&commitMs>boundaryMs)continue;
    try{
      const raw=gitRun(['show',`${entry.commitSha}:${CANONICAL_REWARDS_REPO_PATH}`],{root});
      const snapshot=JSON.parse(String(raw));
      const selected=selectHistoricalRewardsTokenPrice({snapshot,token:tokenAddress,boundaryAt,maxAgeMinutes});
      if(selected.ok){
        return{
          ...selected,
          commitSha:entry.commitSha,
          commitAt:entry.commitAt||null,
          sourceFile:CANONICAL_REWARDS_REPO_PATH,
          policyVersion:HISTORICAL_REWARDS_PRICE_POLICY.version
        };
      }
      lastFailure={...selected,commitSha:entry.commitSha,commitAt:entry.commitAt||null};
    }catch(error){
      lastFailure={ok:false,status:'canonical-rewards-history-snapshot-unreadable',assetId:tokenAddress,commitSha:entry.commitSha,commitAt:entry.commitAt||null,error:error?.message||String(error)};
    }
  }
  return lastFailure||{ok:false,status:'historical-rewards-token-price-unavailable',assetId:tokenAddress};
}
