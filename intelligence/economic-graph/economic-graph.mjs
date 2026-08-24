#!/usr/bin/env node
/**
 * The Holding · Economic Graph v0.1
 *
 * First production cohort: Defitea -> f(x) veFXN.
 *
 * Purpose: preserve protocol-economic observations that can later explain
 * changes in APR, liquidity, incentives, fees and capital flows without
 * inventing causation. This layer is read-only and has no execution,
 * recommendation, allocation or methodology-mutation authority.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { collectFxnLockerEconomicSnapshot } from '../../productivity/fxn-locker-apr-guard.mjs';

const ROOT=path.resolve(path.dirname(new URL(import.meta.url).pathname),'../..');
const OUT=process.env.ECONOMIC_GRAPH_FILE || path.join(ROOT,'intelligence/economic-graph/economic-graph.json');
const PRODUCTIVITY=process.env.PRODUCTIVITY_DATA_FILE || path.join(ROOT,'companies/productivity-data.json');
const MAX_OBSERVATIONS=4000;

function readJson(file,required=true){
  try{return JSON.parse(fs.readFileSync(file,'utf8'));}
  catch(error){if(!required&&error?.code==='ENOENT')return null;throw error;}
}
function sha256File(file){return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');}
function sha256Text(text){return crypto.createHash('sha256').update(text).digest('hex');}
function round(n,d=8){const x=Number(n);return Number.isFinite(x)?Number(x.toFixed(d)):null;}
function delta(a,b,d=8){const x=Number(a),y=Number(b);return Number.isFinite(x)&&Number.isFinite(y)?round(x-y,d):null;}
function utcDate(iso){return new Date(iso).toISOString().slice(0,10);}
function stableObservationCore(snapshot){
  return {
    observationDateUTC:utcDate(snapshot.observedAt),
    aprPct:snapshot.aprPct,
    fxnLocked:snapshot.fxnLocked,
    totalVeFxn:snapshot.totalVeFxn,
    cumulativeThisWeekWsteth:snapshot.cumulativeThisWeekWsteth,
    previousWeekWsteth:snapshot.previousWeekWsteth,
    averageLockRaw:snapshot.averageLockRaw,
    accumulateTillRaw:snapshot.accumulateTillRaw,
    rawBlockHash:snapshot.rawBlockHash
  };
}

function deterministicSnapshot(productivity){
  const apr=Number(productivity?.engines?.fx_vefxn?.aprLatest);
  if(!Number.isFinite(apr)) throw new Error('deterministic validation requires current fx_vefxn APR');
  return {
    aprPct:apr,
    fxnLocked:512400,
    totalVeFxn:291750,
    cumulativeThisWeekWsteth:42.1256,
    previousWeekWsteth:11.2504,
    averageLockRaw:'2.4 years',
    accumulateTillRaw:'Aug 27, 2026',
    rawBlockHash:sha256Text('deterministic-fxn-economic-graph-validation'),
    observedAt:'2026-08-24T10:00:00.000Z',
    source:'https://fx.aladdin.club/v2/lock',
    sourceType:'deterministic-validation-fixture',
    sourceMetric:'FXN Locker economic vitals',
    nativeCadence:'weekly',
    executionAuthority:'none'
  };
}

export function buildEconomicGraph({productivity,previousState,snapshot,sourceSha256}){
  if(productivity?.version!=='1.16') throw new Error(`Economic Graph requires Productivity v1.16, got ${productivity?.version}`);
  if(snapshot?.executionAuthority!=='none') throw new Error('Economic Graph refuses source authority drift');
  const engine=productivity?.engines?.fx_vefxn;
  if(!engine) throw new Error('fx_vefxn Productivity engine missing');
  const company=productivity?.companies?.['defitea.eth'];
  const position=(company?.breakdown||[]).find(row=>row?.engineId==='fx_vefxn'||row?.principalId==='fxn-token');
  if(!position) throw new Error('Defitea veFXN Productivity position missing');

  const core=stableObservationCore(snapshot);
  const id=`fxn-locker:${core.observationDateUTC}:${sha256Text(JSON.stringify(core)).slice(0,20)}`;
  const oldObservations=Array.isArray(previousState?.observations)?previousState.observations:[];
  let observations=oldObservations.slice();
  if(!observations.some(x=>x.id===id)){
    observations.push({
      id,
      observedAt:snapshot.observedAt,
      observationDateUTC:core.observationDateUTC,
      company:{registry:'004',name:'defitea.eth'},
      protocol:'f(x)',
      mechanism:'veFXN Locker',
      asset:'FXN',
      positionUnits:round(position.units,8),
      positionPriceUsd:round(position.price,8),
      positionValueUsd:round(position.value,8),
      liveObservedAprPct:round(snapshot.aprPct,6),
      canonicalProductivityAprPct:round(engine.aprLatest,6),
      canonicalProductivityStatus:engine.status||null,
      aprParityDeltaPctPoints:delta(snapshot.aprPct,engine.aprLatest,6),
      drivers:{
        fxnLocked:round(snapshot.fxnLocked,8),
        totalVeFxn:round(snapshot.totalVeFxn,8),
        cumulativeThisWeekWsteth:round(snapshot.cumulativeThisWeekWsteth,12),
        previousWeekWsteth:round(snapshot.previousWeekWsteth,12),
        averageLockRaw:snapshot.averageLockRaw,
        accumulateTillRaw:snapshot.accumulateTillRaw
      },
      source:{
        url:snapshot.source,
        sourceType:snapshot.sourceType,
        sourceMetric:snapshot.sourceMetric,
        rawBlockHash:snapshot.rawBlockHash,
        productivityFile:'companies/productivity-data.json',
        productivitySha256:sourceSha256
      },
      epistemic:{
        observationClass:'exact-official-protocol-observation',
        aprClass:'exact-official-locker-observation',
        driverClass:'exact-official-locker-context',
        causalAttribution:'unresolved',
        primaryDriver:null,
        rule:'Do not infer that revenue, lock supply, incentives or any other observed driver caused the APR until a mechanism-specific formula or onchain accounting identity proves the relationship.'
      }
    });
  }
  observations=observations.slice(-MAX_OBSERVATIONS);
  const current=observations.at(-1);
  const prior=[...observations].reverse().find(x=>x.id!==current.id)||null;
  const sameNativeWindow=Boolean(prior&&prior.drivers?.accumulateTillRaw&&prior.drivers.accumulateTillRaw===current.drivers?.accumulateTillRaw);

  const movement={
    priorObservationId:prior?.id||null,
    elapsedHours:prior?round((Date.parse(current.observedAt)-Date.parse(prior.observedAt))/36e5,4):null,
    aprDeltaPctPoints:prior?delta(current.liveObservedAprPct,prior.liveObservedAprPct,6):null,
    fxnLockedDelta:prior?delta(current.drivers.fxnLocked,prior.drivers.fxnLocked,8):null,
    totalVeFxnDelta:prior?delta(current.drivers.totalVeFxn,prior.drivers.totalVeFxn,8):null,
    currentWeekRevenueDeltaWsteth:prior&&sameNativeWindow?delta(current.drivers.cumulativeThisWeekWsteth,prior.drivers.cumulativeThisWeekWsteth,12):null,
    revenueDeltaComparable:sameNativeWindow,
    revenueDeltaNonComparableReason:prior&&!sameNativeWindow?'native-week-window-changed':null
  };

  return {
    version:'0.1-economic-graph',
    engineVersion:'0.1-defitea-fxn-driver-substrate',
    generatedAt:new Date().toISOString(),
    status:'partial-first-cohort',
    purpose:'Build a longitudinal evidence graph connecting company positions to protocol-economic drivers so existing Explanatory, Brain and Learning layers can reason from measured context instead of narrative guesses.',
    authority:{
      readOnly:true,
      executionAuthority:'none',
      capitalExecution:false,
      walletAuthority:false,
      allocationAuthority:false,
      recommendationAuthority:false,
      causalClaimAuthority:'none',
      methodologyMutationAuthority:false
    },
    semantics:{
      observedNotPredicted:true,
      contextIsNotCause:true,
      correlationIsNotCausation:true,
      unknownIsNotZero:true,
      nativeCadence:'weekly-economic-cycle-with-daily-observation-capability',
      currentCohort:'Defitea -> f(x) veFXN',
      driverPromotionRule:'A driver may become ATTRIBUTED only after a protocol-specific formula or onchain accounting identity proves the causal path.',
      futurePatternRule:'Repeated patterns may become prospective signal candidates only through the existing frozen-baseline support/counterevidence methodology; never automatically become predictions.'
    },
    sourceState:{
      productivity:{file:'companies/productivity-data.json',version:productivity.version,generatedAt:productivity.generatedAt,sha256:sourceSha256},
      fxnLocker:{url:snapshot.source,sourceType:snapshot.sourceType,nativeCadence:snapshot.nativeCadence,latestObservedAt:snapshot.observedAt}
    },
    graph:{
      nodes:[
        {id:'company:004',type:'company',label:'defitea.eth'},
        {id:'protocol:fx',type:'protocol',label:'f(x)'},
        {id:'mechanism:fxn-locker',type:'mechanism',label:'veFXN Locker'},
        {id:'asset:fxn',type:'asset',label:'FXN'},
        {id:'driver:fxn-locked',type:'driver',label:'FXN Locked'},
        {id:'driver:total-vefxn',type:'driver',label:'Total veFXN'},
        {id:'driver:weekly-wsteth-revenue',type:'driver',label:'veFXN Revenue · wstETH'}
      ],
      edges:[
        {from:'company:004',to:'mechanism:fxn-locker',relation:'holds-position-through',epistemicClass:'canonical-position-state'},
        {from:'mechanism:fxn-locker',to:'protocol:fx',relation:'belongs-to',epistemicClass:'protocol-mechanism'},
        {from:'mechanism:fxn-locker',to:'asset:fxn',relation:'locks',epistemicClass:'protocol-mechanism'},
        {from:'driver:fxn-locked',to:'mechanism:fxn-locker',relation:'describes',epistemicClass:'observed-context'},
        {from:'driver:total-vefxn',to:'mechanism:fxn-locker',relation:'describes',epistemicClass:'observed-context'},
        {from:'driver:weekly-wsteth-revenue',to:'mechanism:fxn-locker',relation:'economic-context-for',epistemicClass:'observed-context-not-yet-causal'}
      ]
    },
    latest:{observation:current,movement},
    observations,
    attribution:{
      status:'warming-unresolved-causality',
      primaryDriver:null,
      supportedDrivers:['FXN Locked','Total veFXN','Cumulative This Week wstETH revenue','Previous Week wstETH revenue'],
      blockedQuestion:'why-protocol-apr-changed',
      unlockCondition:'reproducible f(x) Locker APR formula or onchain accounting identity binding APR to measured drivers'
    },
    expansionQueue:[
      'Curve / Convex gauge votes + incentives + fees',
      'Votium / VoteMarket incentive markets',
      'Aerodrome veAERO votes + voting incentives + fees + emissions',
      'Aero sAERO Predictive Allocation outcomes when live',
      'Pendle incentives / fees / liquidity',
      'Yield Basis fees / emissions / liquidity',
      'cross-protocol capital-flow edges and prospective pattern evaluation'
    ]
  };
}

async function main(){
  const productivity=readJson(PRODUCTIVITY);
  const previousState=readJson(OUT,false);
  const deterministic=process.argv.includes('--deterministic-validation');
  const snapshot=deterministic?deterministicSnapshot(productivity):await collectFxnLockerEconomicSnapshot();
  const state=buildEconomicGraph({productivity,previousState,snapshot,sourceSha256:sha256File(PRODUCTIVITY)});
  fs.mkdirSync(path.dirname(OUT),{recursive:true});
  fs.writeFileSync(OUT,JSON.stringify(state,null,2)+'\n');
  console.log('ECONOMIC GRAPH v0.1 PASS',{
    status:state.status,
    observations:state.observations.length,
    liveObservedAprPct:state.latest.observation.liveObservedAprPct,
    canonicalProductivityAprPct:state.latest.observation.canonicalProductivityAprPct,
    primaryDriver:state.attribution.primaryDriver,
    executionAuthority:state.authority.executionAuthority,
    deterministic
  });
}

if(path.resolve(process.argv[1]||'')===new URL(import.meta.url).pathname){
  main().catch(error=>{console.error(error?.stack||error);process.exit(1);});
}
