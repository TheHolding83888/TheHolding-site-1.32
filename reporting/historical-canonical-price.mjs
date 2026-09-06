#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename=fileURLToPath(import.meta.url);
const __dirname=path.dirname(__filename);
const ROOT=path.resolve(__dirname,'..');

export const VERSION='0.1-historical-canonical-market-price';
export const CANONICAL_MARKET_DATA_REPO_PATH='intelligence/market-data/market-data.json';
export const MARKET_DATA_SCHEDULER_REPO_PATH='intelligence/market-data/market-data-scheduler-contract.json';
export const HISTORICAL_TOKEN_ASSET_IDS=Object.freeze({
  '0x940181a94a35a4569e4529a3cdfb74e38fd98631':'aerodrome-finance',
  '0x9560e827af36c94d2ac33a39bce1fe78631088db':'velodrome-finance',
  // Canonical chain wrappers reuse the historical USD authority of their
  // underlying canonical asset. This is an identity alias only: it does not
  // create a price, use a current quote, or grant reward/accounting authority.
  '0x4200000000000000000000000000000000000006':'ethereum',
  '0x68f180fcce6836688e9084f035309e29bf0a2095':'bitcoin'
});

const lower=v=>String(v||'').toLowerCase();
const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));

export function canonicalAssetIdForHistoricalToken(token){
  return HISTORICAL_TOKEN_ASSET_IDS[lower(token)]||null;
}

export function selectHistoricalCanonicalPrice({snapshot,token,boundaryAt,maxAgeMinutes}){
  const assetId=canonicalAssetIdForHistoricalToken(token);
  if(!assetId)return{ok:false,status:'token-not-canonical-market-data-mapped',assetId:null};

  const boundaryMs=Date.parse(boundaryAt||'');
  if(!Number.isFinite(boundaryMs))return{ok:false,status:'invalid-accounting-boundary',assetId};
  if(!(finite(maxAgeMinutes)&&Number(maxAgeMinutes)>=0))return{ok:false,status:'invalid-market-data-freshness-contract',assetId};

  const row=snapshot?.prices?.[assetId];
  if(!row)return{ok:false,status:'canonical-asset-missing-from-snapshot',assetId};
  if(!['fresh','stale-fallback'].includes(String(row.status||'')))return{ok:false,status:'canonical-price-status-not-usable',assetId,priceStatus:row.status||null};
  if(!(finite(row.usd)&&Number(row.usd)>0))return{ok:false,status:'canonical-price-not-finite-positive',assetId};

  const observedAt=row.observedAt||snapshot?.observedAt||snapshot?.generatedAt||null;
  const observedMs=Date.parse(observedAt||'');
  if(!Number.isFinite(observedMs))return{ok:false,status:'canonical-price-observation-time-missing',assetId};
  if(observedMs>boundaryMs)return{ok:false,status:'canonical-price-observed-after-accounting-boundary',assetId,observedAt};

  const ageMinutes=(boundaryMs-observedMs)/60_000;
  if(ageMinutes>Number(maxAgeMinutes))return{
    ok:false,status:'canonical-price-too-old-for-accounting-boundary',assetId,observedAt,
    ageMinutes:Number(ageMinutes.toFixed(6)),maxAgeMinutes:Number(maxAgeMinutes)
  };

  return{
    ok:true,status:'historical-canonical-market-price',assetId,priceUsd:Number(row.usd),
    observedAt,ageMinutes:Number(ageMinutes.toFixed(6)),maxAgeMinutes:Number(maxAgeMinutes),
    priceStatus:row.status,providerId:row.providerId||null,priceSource:row.source||null,
    snapshotGeneratedAt:snapshot?.generatedAt||null,snapshotObservedAt:snapshot?.observedAt||null,
    snapshotVersion:snapshot?.version||null
  };
}

function defaultGitRun(args,{root=ROOT}={}){
  return execFileSync('git',args,{cwd:root,encoding:'utf8',maxBuffer:2*1024*1024,stdio:['ignore','pipe','pipe']});
}

async function readSchedulerContract(root=ROOT){
  const file=path.join(root,MARKET_DATA_SCHEDULER_REPO_PATH);
  return JSON.parse(await fs.readFile(file,'utf8'));
}

export async function historicalCanonicalPriceAtBoundary({
  token,boundaryAt,root=ROOT,gitRun=defaultGitRun,schedulerContract=null,maxHistoryCommits=96
}={}){
  const assetId=canonicalAssetIdForHistoricalToken(token);
  if(!assetId)return{ok:false,status:'token-not-canonical-market-data-mapped',assetId:null};

  let scheduler=schedulerContract;
  try{if(!scheduler)scheduler=await readSchedulerContract(root);}catch(error){
    return{ok:false,status:'market-data-scheduler-contract-unavailable',assetId,error:error?.message||String(error)};
  }
  const maxAgeMinutes=Number(scheduler?.scheduledRefreshAdmissionAgeMinutes);
  if(!(Number.isFinite(maxAgeMinutes)&&maxAgeMinutes>=0))return{ok:false,status:'invalid-market-data-freshness-contract',assetId};

  let commits=[];
  try{
    const raw=gitRun(['log','--format=%H',`--before=${boundaryAt}`,'HEAD','--',CANONICAL_MARKET_DATA_REPO_PATH],{root});
    commits=String(raw||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean).slice(0,Math.max(1,Number(maxHistoryCommits)||96));
  }catch(error){
    return{ok:false,status:'canonical-market-data-git-history-unavailable',assetId,error:error?.message||String(error)};
  }
  if(!commits.length)return{ok:false,status:'canonical-market-data-git-history-empty',assetId};

  let best=null,lastFailure=null;
  for(const commitSha of commits){
    try{
      const raw=gitRun(['show',`${commitSha}:${CANONICAL_MARKET_DATA_REPO_PATH}`],{root});
      const snapshot=JSON.parse(String(raw));
      const selected=selectHistoricalCanonicalPrice({snapshot,token,boundaryAt,maxAgeMinutes});
      if(selected.ok){
        if(!best||Date.parse(selected.observedAt)>Date.parse(best.observedAt))best={...selected,commitSha,sourceFile:CANONICAL_MARKET_DATA_REPO_PATH,sourceFamily:'canonical-market-data-git-history'};
      }else lastFailure={...selected,commitSha};
    }catch(error){lastFailure={ok:false,status:'canonical-market-data-history-snapshot-unreadable',assetId,commitSha,error:error?.message||String(error)};}
  }
  return best||lastFailure||{ok:false,status:'historical-canonical-price-unavailable',assetId};
}

async function main(){
  const token=process.argv[2],boundaryAt=process.argv[3];
  if(!token||!boundaryAt)throw new Error('usage: historical-canonical-price.mjs <token> <boundaryAt>');
  const result=await historicalCanonicalPriceAtBoundary({token,boundaryAt});
  console.log(JSON.stringify(result,null,2));
  if(!result.ok)process.exitCode=2;
}

if(process.argv[1]&&path.resolve(process.argv[1])===__filename)main().catch(error=>{console.error(error);process.exitCode=1;});
