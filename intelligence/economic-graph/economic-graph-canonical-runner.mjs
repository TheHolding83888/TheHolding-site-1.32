#!/usr/bin/env node
/**
 * The Holding · Economic Graph canonical runner v0.1
 *
 * Production Graph builds consume the f(x) economic snapshot materialized
 * inside canonical Productivity. They do not re-probe the browser between the
 * Productivity publication and downstream Graph publication.
 *
 * This preserves the strict 0.01 pp APR parity boundary while making it a true
 * same-observation check instead of a comparison between two different times.
 * No execution, recommendation, allocation or methodology-mutation authority.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { buildEconomicGraph } from './economic-graph.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const OUT=process.env.ECONOMIC_GRAPH_FILE || path.join(ROOT,'intelligence/economic-graph/economic-graph.json');
const PRODUCTIVITY=process.env.PRODUCTIVITY_DATA_FILE || path.join(ROOT,'companies/productivity-data.json');
const PRODUCTIVITY_ENGINE=path.join(ROOT,'productivity/productivity-engine.mjs');
const APR_PARITY_TOLERANCE_PCT_POINTS=0.01;

function readJson(file,required=true){
  try{
    const text=fs.readFileSync(file,'utf8');
    if(!required&&!text.trim())return null;
    return JSON.parse(text);
  }catch(error){
    if(!required&&error?.code==='ENOENT')return null;
    throw error;
  }
}
function sha256File(file){return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');}
function finite(value,label){const n=Number(value);if(!Number.isFinite(n))throw new Error(`${label} must be finite`);return n;}

export function canonicalFxnSnapshotFromProductivity(productivity){
  if(productivity?.version!=='1.16')throw new Error(`Canonical f(x) snapshot requires Productivity v1.16, got ${productivity?.version}`);
  const engine=productivity?.engines?.fx_vefxn;
  if(!engine||engine.status!=='ok')throw new Error('Canonical f(x) Productivity engine unavailable');
  const snapshot=engine?.details?.economicSnapshot;
  if(!snapshot||typeof snapshot!=='object')throw new Error('Canonical f(x) same-block economic snapshot missing');
  if(snapshot.snapshotKey!==productivity.snapshotKey)throw new Error('Canonical f(x) economic snapshot key drift');
  if(snapshot.productivityGeneratedAt!==productivity.generatedAt)throw new Error('Canonical f(x) economic snapshot Productivity identity drift');
  if(snapshot.source!=='https://fx.aladdin.club/v2/lock'||snapshot.sourceType!=='official-frontend-exact-locker-block')throw new Error('Canonical f(x) economic snapshot source authority drift');
  if(snapshot.sourceMetric!=='FXN Locker economic vitals'||snapshot.executionAuthority!=='none')throw new Error('Canonical f(x) economic snapshot semantic/authority drift');
  if(!/^[a-f0-9]{64}$/.test(String(snapshot.rawBlockHash||'')))throw new Error('Canonical f(x) economic snapshot raw block hash missing');
  if(!Number.isFinite(Date.parse(snapshot.observedAt)))throw new Error('Canonical f(x) economic snapshot timestamp invalid');
  const required=[
    ['APR',snapshot.aprPct],
    ['FXN Locked',snapshot.fxnLocked],
    ['FXN circulating locked percent',snapshot.fxnCirculatingSupplyLockedPct],
    ['Total veFXN',snapshot.totalVeFxn],
    ['Current-week wstETH',snapshot.cumulativeThisWeekWsteth],
    ['Previous-week wstETH',snapshot.previousWeekWsteth]
  ];
  for(const [label,value] of required)finite(value,`Canonical f(x) ${label}`);
  const canonicalApr=finite(engine.aprLatest,'Canonical f(x) engine APR');
  const snapshotApr=finite(snapshot.aprPct,'Canonical f(x) snapshot APR');
  const parity=Math.abs(snapshotApr-canonicalApr);
  if(parity>APR_PARITY_TOLERANCE_PCT_POINTS)throw new Error(`Canonical f(x) same-snapshot APR parity failed: snapshot ${snapshotApr}% != engine ${canonicalApr}%`);
  return snapshot;
}

export function buildCanonicalEconomicGraph({productivity,previousState,sourceSha256,productivityEngineSha256}){
  const snapshot=canonicalFxnSnapshotFromProductivity(productivity);
  return buildEconomicGraph({
    productivity,
    previousState,
    snapshot,
    sourceSha256,
    productivityEngineSha256
  });
}

async function main(){
  const productivity=readJson(PRODUCTIVITY);
  const previousState=readJson(OUT,false);
  const state=buildCanonicalEconomicGraph({
    productivity,
    previousState,
    sourceSha256:sha256File(PRODUCTIVITY),
    productivityEngineSha256:sha256File(PRODUCTIVITY_ENGINE)
  });
  fs.mkdirSync(path.dirname(OUT),{recursive:true});
  fs.writeFileSync(OUT,JSON.stringify(state,null,2)+'\n');
  const fxn=state.cohorts?.['defitea-fxn-vefxn']?.latest?.observation;
  const curve=state.cohorts?.['defitea-curve-vecrv']?.latest?.observation;
  console.log('ECONOMIC GRAPH canonical same-snapshot PASS',{
    engineVersion:state.engineVersion,
    cohortCount:state.coverage?.cohortCount,
    fxnObservedAt:fxn?.observedAt,
    fxnAprPct:fxn?.liveObservedAprPct,
    fxnAprParityDeltaPctPoints:fxn?.aprParityDeltaPctPoints,
    curveAprPct:curve?.canonicalProductivityAprPct,
    curveFormulaParityDeltaPctPoints:curve?.formulaParityDeltaPctPoints,
    executionAuthority:state.authority?.executionAuthority
  });
}

if(path.resolve(process.argv[1]||'')===fileURLToPath(import.meta.url)){
  main().catch(error=>{console.error(error?.stack||error);process.exit(1);});
}
