#!/usr/bin/env node
/**
 * The Holding · Economic Graph v0.2
 *
 * Production cohorts:
 *   1) Defitea -> f(x) veFXN
 *   2) Defitea -> Curve veCRV fee distribution
 *
 * Purpose: preserve protocol-economic observations that can later explain
 * changes in APR, liquidity, incentives, fees and capital flows without
 * inventing causation. This layer is read-only and has no execution,
 * recommendation, allocation or methodology-mutation authority.
 *
 * Compatibility note:
 * `latest`, `attribution`, `semantics.currentCohort`, and top-level `status`
 * remain bound to the original veFXN cohort until Explanatory Context is
 * migrated to the multi-cohort surface. The canonical multi-cohort state is
 * exposed under `coverage` and `cohorts`.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { collectFxnLockerEconomicSnapshot } from '../../productivity/fxn-locker-apr-guard.mjs';

const ROOT=path.resolve(path.dirname(new URL(import.meta.url).pathname),'../..');
const OUT=process.env.ECONOMIC_GRAPH_FILE || path.join(ROOT,'intelligence/economic-graph/economic-graph.json');
const PRODUCTIVITY=process.env.PRODUCTIVITY_DATA_FILE || path.join(ROOT,'companies/productivity-data.json');
const PRODUCTIVITY_ENGINE=path.join(ROOT,'productivity/productivity-engine.mjs');
const MAX_OBSERVATIONS=4000;
const APR_PARITY_TOLERANCE_PCT_POINTS=0.01;
const FXN_COHORT_ID='defitea-fxn-vefxn';
const CURVE_COHORT_ID='defitea-curve-vecrv';

function readJson(file,required=true){
  try{
    const text=fs.readFileSync(file,'utf8');
    if(!required&&!text.trim())return null;
    return JSON.parse(text);
  }
  catch(error){if(!required&&error?.code==='ENOENT')return null;throw error;}
}
function sha256File(file){return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');}
function sha256Text(text){return crypto.createHash('sha256').update(text).digest('hex');}
function round(n,d=8){const x=Number(n);return Number.isFinite(x)?Number(x.toFixed(d)):null;}
function delta(a,b,d=8){const x=Number(a),y=Number(b);return Number.isFinite(x)&&Number.isFinite(y)?round(x-y,d):null;}
function utcDate(iso){return new Date(iso).toISOString().slice(0,10);}
function finite(value,label){const n=Number(value);if(!Number.isFinite(n))throw new Error(`${label} must be finite`);return n;}
function average(values,d=8){
  const nums=values.map(Number).filter(Number.isFinite);
  return nums.length?round(nums.reduce((a,b)=>a+b,0)/nums.length,d):null;
}
function sum(values,d=8){
  const nums=values.map(Number).filter(Number.isFinite);
  return nums.length?round(nums.reduce((a,b)=>a+b,0),d):null;
}
function cohortObservations(observations,cohortId){
  return observations.filter(x=>x?.cohortId===cohortId || (cohortId===FXN_COHORT_ID && !x?.cohortId && x?.protocol==='f(x)' && x?.mechanism==='veFXN Locker'));
}
function latestDistinct(observations,currentId){
  return [...observations].reverse().find(x=>x?.id!==currentId)||null;
}
function appendUnique(observations,observation){
  if(!observations.some(x=>x?.id===observation.id)) observations.push(observation);
}
function stableFxnObservationCore(snapshot){
  return {
    observationDateUTC:utcDate(snapshot.observedAt),
    aprPct:snapshot.aprPct,
    fxnLocked:snapshot.fxnLocked,
    fxnCirculatingSupplyLockedPct:snapshot.fxnCirculatingSupplyLockedPct,
    totalVeFxn:snapshot.totalVeFxn,
    cumulativeThisWeekWsteth:snapshot.cumulativeThisWeekWsteth,
    previousWeekWsteth:snapshot.previousWeekWsteth,
    averageLockRaw:snapshot.averageLockRaw,
    accumulateTillRaw:snapshot.accumulateTillRaw,
    rawBlockHash:snapshot.rawBlockHash
  };
}
function stableCurveObservationCore(engine){
  const weekly=Array.isArray(engine?.details?.weekly)?engine.details.weekly:[];
  return {
    observationDateUTC:utcDate(engine.lastUpdatedAt),
    aprPct:engine.aprLatest,
    periodStart:engine.periodStart,
    periodEnd:engine.periodEnd,
    contract:engine?.details?.contract,
    crvPrice:engine?.details?.crvPrice,
    crvUSDPriceAssumption:engine?.details?.crvUSDPriceAssumption,
    weeksUsed:engine?.details?.weeksUsed,
    lastTokenTime:engine?.details?.lastTokenTime,
    weekly:weekly.map(row=>({
      week:row.week,
      tokensCrvUSD:row.tokensCrvUSD,
      veSupply:row.veSupply,
      apr:row.apr
    }))
  };
}

function deterministicSnapshot(productivity){
  const apr=Number(productivity?.engines?.fx_vefxn?.aprLatest);
  if(!Number.isFinite(apr)) throw new Error('deterministic validation requires current fx_vefxn APR');
  return {
    aprPct:apr,
    fxnLocked:512400,
    fxnCirculatingSupplyLockedPct:64.25,
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

function buildFxnObservation({productivity,snapshot,sourceSha256}){
  if(snapshot?.executionAuthority!=='none') throw new Error('Economic Graph refuses source authority drift');
  const engine=productivity?.engines?.fx_vefxn;
  if(!engine) throw new Error('fx_vefxn Productivity engine missing');
  const canonicalApr=finite(engine.aprLatest,'canonical veFXN APR');
  const liveApr=finite(snapshot.aprPct,'live veFXN APR');
  if(Math.abs(liveApr-canonicalApr)>APR_PARITY_TOLERANCE_PCT_POINTS){
    throw new Error(`Economic Graph refuses veFXN APR semantic drift: live ${liveApr}% != canonical Productivity ${canonicalApr}%`);
  }
  const company=productivity?.companies?.['defitea.eth'];
  const position=(company?.breakdown||[]).find(row=>row?.engineId==='fx_vefxn'||row?.principalId==='fxn-token');
  if(!position) throw new Error('Defitea veFXN Productivity position missing');

  const core=stableFxnObservationCore(snapshot);
  const id=`fxn-locker:${core.observationDateUTC}:${sha256Text(JSON.stringify(core)).slice(0,20)}`;
  return {
    id,
    cohortId:FXN_COHORT_ID,
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
      fxnCirculatingSupplyLockedPct:round(snapshot.fxnCirculatingSupplyLockedPct,6),
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
  };
}

function buildFxnMovement(current,prior){
  const sameNativeWindow=Boolean(prior&&prior.drivers?.accumulateTillRaw&&prior.drivers.accumulateTillRaw===current.drivers?.accumulateTillRaw);
  return {
    priorObservationId:prior?.id||null,
    elapsedHours:prior?round((Date.parse(current.observedAt)-Date.parse(prior.observedAt))/36e5,4):null,
    aprDeltaPctPoints:prior?delta(current.liveObservedAprPct,prior.liveObservedAprPct,6):null,
    fxnLockedDelta:prior?delta(current.drivers.fxnLocked,prior.drivers.fxnLocked,8):null,
    fxnCirculatingSupplyLockedPctDeltaPoints:prior?delta(current.drivers.fxnCirculatingSupplyLockedPct,prior.drivers.fxnCirculatingSupplyLockedPct,6):null,
    totalVeFxnDelta:prior?delta(current.drivers.totalVeFxn,prior.drivers.totalVeFxn,8):null,
    currentWeekRevenueDeltaWsteth:prior&&sameNativeWindow?delta(current.drivers.cumulativeThisWeekWsteth,prior.drivers.cumulativeThisWeekWsteth,12):null,
    revenueDeltaComparable:sameNativeWindow,
    revenueDeltaNonComparableReason:prior&&!sameNativeWindow?'native-week-window-changed':null
  };
}

function buildCurveObservation({productivity,sourceSha256,productivityEngineSha256}){
  const engine=productivity?.engines?.curve_vecrv;
  if(!engine) throw new Error('curve_vecrv Productivity engine missing');
  if(engine.status!=='ok') throw new Error(`curve_vecrv must be ok, got ${engine.status}`);
  if(engine.sourceType!=='onchain') throw new Error(`curve_vecrv sourceType must remain onchain, got ${engine.sourceType}`);
  const canonicalApr=finite(engine.aprLatest,'canonical veCRV APR');
  const details=engine.details||{};
  const weekly=Array.isArray(details.weekly)?details.weekly:[];
  if(weekly.length<1) throw new Error('curve_vecrv completed-week observations missing');
  if(Number(details.weeksUsed)!==weekly.length) throw new Error('curve_vecrv weeksUsed does not match weekly observations');
  const crvPrice=finite(details.crvPrice,'Curve CRV price');
  if(!(crvPrice>0)) throw new Error('Curve CRV price must be positive');
  const company=productivity?.companies?.['defitea.eth'];
  const position=(company?.breakdown||[]).find(row=>row?.engineId==='curve_vecrv'||row?.principalId==='curve-dao-token');
  if(!position) throw new Error('Defitea veCRV Productivity position missing');

  const normalizedWeeks=weekly.map((row,index)=>{
    const week=finite(row.week,`Curve week[${index}] timestamp`);
    const tokensCrvUSD=finite(row.tokensCrvUSD,`Curve week[${index}] tokensCrvUSD`);
    const veSupply=finite(row.veSupply,`Curve week[${index}] veSupply`);
    const apr=finite(row.apr,`Curve week[${index}] APR`);
    if(!(tokensCrvUSD>0)||!(veSupply>0)) throw new Error('Curve completed-week fees and veSupply must be positive');
    const reproducedApr=(tokensCrvUSD/veSupply)/crvPrice*52*100;
    const formulaDelta=round(apr-reproducedApr,6);
    if(Math.abs(formulaDelta)>0.01){
      throw new Error(`Curve weekly APR formula parity failed for week ${week}: published=${apr}, reproduced=${reproducedApr}`);
    }
    return {
      week,
      periodStart:new Date(week*1000).toISOString(),
      periodEnd:new Date((week+7*24*60*60)*1000).toISOString(),
      tokensCrvUSD:round(tokensCrvUSD,12),
      veSupply:round(veSupply,8),
      aprPct:round(apr,6),
      reproducedAprPct:round(reproducedApr,6),
      formulaDeltaPctPoints:formulaDelta
    };
  });
  const reproducedAverageApr=average(normalizedWeeks.map(x=>x.reproducedAprPct),6);
  const averageParityDelta=round(canonicalApr-reproducedAverageApr,6);
  if(Math.abs(averageParityDelta)>0.01){
    throw new Error(`Curve canonical APR parity failed: canonical=${canonicalApr}, reproduced=${reproducedAverageApr}`);
  }

  const core=stableCurveObservationCore(engine);
  const id=`curve-vecrv:${core.observationDateUTC}:${sha256Text(JSON.stringify(core)).slice(0,20)}`;
  const latestWeek=normalizedWeeks[0];
  return {
    id,
    cohortId:CURVE_COHORT_ID,
    observedAt:engine.lastUpdatedAt||productivity.generatedAt,
    observationDateUTC:core.observationDateUTC,
    company:{registry:'004',name:'defitea.eth'},
    protocol:'Curve',
    mechanism:'veCRV Fee Distributor',
    asset:'CRV',
    positionUnits:round(position.units,8),
    positionPriceUsd:round(position.price,8),
    positionValueUsd:round(position.value,8),
    canonicalProductivityAprPct:round(canonicalApr,6),
    canonicalProductivityStatus:engine.status||null,
    formulaReproducedAprPct:reproducedAverageApr,
    formulaParityDeltaPctPoints:averageParityDelta,
    drivers:{
      crvPriceUsd:round(crvPrice,8),
      crvUSDPriceAssumption:round(details.crvUSDPriceAssumption,8),
      weeksUsed:normalizedWeeks.length,
      lastTokenTime:Number.isFinite(Number(details.lastTokenTime))?Number(details.lastTokenTime):null,
      rollingWindowStart:normalizedWeeks.at(-1)?.periodStart||null,
      rollingWindowEnd:normalizedWeeks[0]?.periodEnd||null,
      rollingFourWeekFeesCrvUSD:sum(normalizedWeeks.map(x=>x.tokensCrvUSD),12),
      rollingAverageVeSupply:average(normalizedWeeks.map(x=>x.veSupply),8),
      rollingAverageAprPct:average(normalizedWeeks.map(x=>x.aprPct),6),
      latestCompletedWeek:{
        week:latestWeek.week,
        periodStart:latestWeek.periodStart,
        periodEnd:latestWeek.periodEnd,
        tokensCrvUSD:latestWeek.tokensCrvUSD,
        veSupply:latestWeek.veSupply,
        aprPct:latestWeek.aprPct
      },
      completedWeeks:normalizedWeeks
    },
    formula:{
      status:'proven-canonical-collector-identity',
      weeklyIdentity:'weeklyAprPct = (tokensCrvUSD / veSupply) / crvPriceUsd * 52 * 100',
      rollingIdentity:'canonicalProductivityAprPct = arithmetic mean(completed-week aprPct values used by Productivity)',
      reproducedCanonicalAprPct:reproducedAverageApr,
      parityDeltaPctPoints:averageParityDelta,
      collectorFile:'productivity/productivity-engine.mjs',
      collectorSha256:productivityEngineSha256
    },
    source:{
      url:engine.source,
      sourceType:engine.sourceType,
      sourceMetric:engine.sourceMetric,
      contract:details.contract||null,
      rpc:details.rpc||null,
      productivityFile:'companies/productivity-data.json',
      productivitySha256:sourceSha256,
      productivityGeneratedAt:productivity.generatedAt
    },
    epistemic:{
      observationClass:'canonical-onchain-derived-protocol-observation',
      aprClass:'formula-derived-from-onchain-fee-distributor',
      driverClass:'onchain-fee-distributor-context',
      mechanicalAttribution:'proven-within-apr-formula',
      causalAttribution:'unresolved-beyond-formula',
      primaryDriver:null,
      provenRelation:'For the canonical veCRV fee APR, distributed crvUSD fees are the numerator, veCRV supply and CRV price are denominator inputs, and the rolling Reference APR is the arithmetic mean of completed-week formula outputs.',
      unresolvedQuestion:'What protocol activity caused distributed crvUSD fees themselves to change remains unresolved by this cohort.',
      rule:'The formula may explain how measured fee distribution, veSupply and CRV price mechanically determine Reference APR. It must not invent why upstream Curve fee distributions changed.'
    }
  };
}

function buildCurveMovement(current,prior){
  const currentWeek=current?.drivers?.latestCompletedWeek;
  const priorWeek=prior?.drivers?.latestCompletedWeek;
  const sameLatestWeek=Boolean(priorWeek&&currentWeek&&Number(priorWeek.week)===Number(currentWeek.week));
  const sameRollingWindow=Boolean(
    prior &&
    prior?.drivers?.rollingWindowStart===current?.drivers?.rollingWindowStart &&
    prior?.drivers?.rollingWindowEnd===current?.drivers?.rollingWindowEnd
  );
  return {
    priorObservationId:prior?.id||null,
    elapsedHours:prior?round((Date.parse(current.observedAt)-Date.parse(prior.observedAt))/36e5,4):null,
    aprDeltaPctPoints:prior?delta(current.canonicalProductivityAprPct,prior.canonicalProductivityAprPct,6):null,
    crvPriceDeltaUsd:prior?delta(current.drivers.crvPriceUsd,prior.drivers.crvPriceUsd,8):null,
    rollingAverageVeSupplyDelta:prior&&sameRollingWindow?delta(current.drivers.rollingAverageVeSupply,prior.drivers.rollingAverageVeSupply,8):null,
    rollingFourWeekFeesDeltaCrvUSD:prior&&sameRollingWindow?delta(current.drivers.rollingFourWeekFeesCrvUSD,prior.drivers.rollingFourWeekFeesCrvUSD,12):null,
    rollingWindowComparable:sameRollingWindow,
    rollingWindowNonComparableReason:prior&&!sameRollingWindow?'rolling-completed-week-window-changed':null,
    latestWeekFeesDeltaCrvUSD:prior&&sameLatestWeek?delta(currentWeek.tokensCrvUSD,priorWeek.tokensCrvUSD,12):null,
    latestWeekVeSupplyDelta:prior&&sameLatestWeek?delta(currentWeek.veSupply,priorWeek.veSupply,8):null,
    latestWeekAprDeltaPctPoints:prior&&sameLatestWeek?delta(currentWeek.aprPct,priorWeek.aprPct,6):null,
    latestWeekComparable:sameLatestWeek,
    latestWeekNonComparableReason:prior&&!sameLatestWeek?'latest-completed-week-changed':null
  };
}

export function buildEconomicGraph({productivity,previousState,snapshot,sourceSha256,productivityEngineSha256=sha256File(PRODUCTIVITY_ENGINE)}){
  if(productivity?.version!=='1.16') throw new Error(`Economic Graph requires Productivity v1.16, got ${productivity?.version}`);

  const oldObservations=Array.isArray(previousState?.observations)?previousState.observations:[];
  let observations=oldObservations.map(row=>{
    if(row?.cohortId) return row;
    if(row?.protocol==='f(x)'&&row?.mechanism==='veFXN Locker') return {...row,cohortId:FXN_COHORT_ID};
    return row;
  });

  const fxnObservation=buildFxnObservation({productivity,snapshot,sourceSha256});
  appendUnique(observations,fxnObservation);

  const curveObservation=buildCurveObservation({productivity,sourceSha256,productivityEngineSha256});
  appendUnique(observations,curveObservation);

  observations=observations
    .sort((a,b)=>Date.parse(a?.observedAt||0)-Date.parse(b?.observedAt||0))
    .slice(-MAX_OBSERVATIONS);

  const fxnObservations=cohortObservations(observations,FXN_COHORT_ID);
  const curveObservations=cohortObservations(observations,CURVE_COHORT_ID);
  const currentFxn=fxnObservations.at(-1);
  const priorFxn=latestDistinct(fxnObservations,currentFxn?.id);
  const currentCurve=curveObservations.at(-1);
  const priorCurve=latestDistinct(curveObservations,currentCurve?.id);
  if(!currentFxn||!currentCurve) throw new Error('Economic Graph multi-cohort state incomplete');

  const fxnMovement=buildFxnMovement(currentFxn,priorFxn);
  const curveMovement=buildCurveMovement(currentCurve,priorCurve);

  const fxnAttribution={
    status:'warming-unresolved-causality',
    primaryDriver:null,
    supportedDrivers:['FXN Locked','FXN Circulating Supply Locked %','Total veFXN','Cumulative This Week wstETH revenue','Previous Week wstETH revenue'],
    blockedQuestion:'why-protocol-apr-changed',
    unlockCondition:'reproducible f(x) Locker APR formula or onchain accounting identity binding APR to measured drivers'
  };
  const curveAttribution={
    status:'formula-mechanics-proven-upstream-cause-unresolved',
    primaryDriver:null,
    mechanicalInputs:['Distributed crvUSD fees','veCRV supply','CRV price'],
    formulaProven:true,
    formulaParityDeltaPctPoints:currentCurve.formulaParityDeltaPctPoints,
    answerableQuestion:'how-current-vecrv-reference-apr-is-mechanically-formed',
    blockedQuestion:'why-curve-fee-distributions-changed',
    unlockCondition:'canonical protocol revenue / fee-origin evidence tied to the Fee Distributor inflow path'
  };

  return {
    version:'0.1-economic-graph',
    engineVersion:'0.2-defitea-fxn-curve-multi-cohort',
    generatedAt:new Date().toISOString(),
    status:'partial-first-cohort',
    statusCompatibility:{
      deprecated:true,
      meaning:'Legacy Explanatory Context v0.2 compatibility alias. Do not use this field to infer cohort count.',
      canonicalCoverageField:'coverage.status'
    },
    coverage:{
      status:'partial-two-cohort',
      cohortCount:2,
      activeCohortIds:[FXN_COHORT_ID,CURVE_COHORT_ID],
      companyRegistries:['004'],
      protocols:['f(x)','Curve'],
      nextPlannedCohort:'Defitea -> Aerodrome veAERO'
    },
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
      aprParityRequired:true,
      aprParityTolerancePctPoints:APR_PARITY_TOLERANCE_PCT_POINTS,
      nativeCadence:'protocol-native-cadence-with-daily-observation-capability',
      currentCohort:'Defitea -> f(x) veFXN',
      currentCohorts:['Defitea -> f(x) veFXN','Defitea -> Curve veCRV Fee Distributor'],
      legacyLatestAlias:'latest remains the veFXN cohort until Explanatory Context migrates to cohorts.*',
      driverPromotionRule:'A driver may become ATTRIBUTED only after a protocol-specific formula or onchain accounting identity proves the causal path.',
      mechanicalIdentityRule:'A canonical formula may explain how measured inputs determine a metric without claiming why those upstream inputs changed.',
      futurePatternRule:'Repeated patterns may become prospective signal candidates only through the existing frozen-baseline support/counterevidence methodology; never automatically become predictions.'
    },
    sourceState:{
      productivity:{file:'companies/productivity-data.json',version:productivity.version,generatedAt:productivity.generatedAt,sha256:sourceSha256},
      productivityEngine:{file:'productivity/productivity-engine.mjs',sha256:productivityEngineSha256},
      fxnLocker:{url:snapshot.source,sourceType:snapshot.sourceType,nativeCadence:snapshot.nativeCadence,latestObservedAt:snapshot.observedAt},
      curveVeCrv:{
        url:currentCurve.source.url,
        sourceType:currentCurve.source.sourceType,
        sourceMetric:currentCurve.source.sourceMetric,
        contract:currentCurve.source.contract,
        rpc:currentCurve.source.rpc,
        latestObservedAt:currentCurve.observedAt
      }
    },
    graph:{
      nodes:[
        {id:'company:004',type:'company',label:'defitea.eth'},
        {id:'protocol:fx',type:'protocol',label:'f(x)'},
        {id:'mechanism:fxn-locker',type:'mechanism',label:'veFXN Locker'},
        {id:'asset:fxn',type:'asset',label:'FXN'},
        {id:'driver:fxn-locked',type:'driver',label:'FXN Locked'},
        {id:'driver:fxn-circulating-locked-share',type:'driver',label:'FXN Circulating Supply Locked %'},
        {id:'driver:total-vefxn',type:'driver',label:'Total veFXN'},
        {id:'driver:weekly-wsteth-revenue',type:'driver',label:'veFXN Revenue · wstETH'},
        {id:'protocol:curve',type:'protocol',label:'Curve'},
        {id:'mechanism:curve-vecrv-fee-distributor',type:'mechanism',label:'veCRV Fee Distributor'},
        {id:'asset:crv',type:'asset',label:'CRV'},
        {id:'driver:curve-crvusd-fees',type:'driver',label:'Distributed crvUSD Fees'},
        {id:'driver:curve-vesupply',type:'driver',label:'veCRV Supply'},
        {id:'driver:curve-crv-price',type:'driver',label:'CRV Price'},
        {id:'metric:curve-vecrv-reference-apr',type:'metric',label:'veCRV Reference APR'}
      ],
      edges:[
        {from:'company:004',to:'mechanism:fxn-locker',relation:'holds-position-through',epistemicClass:'canonical-position-state'},
        {from:'mechanism:fxn-locker',to:'protocol:fx',relation:'belongs-to',epistemicClass:'protocol-mechanism'},
        {from:'mechanism:fxn-locker',to:'asset:fxn',relation:'locks',epistemicClass:'protocol-mechanism'},
        {from:'driver:fxn-locked',to:'mechanism:fxn-locker',relation:'describes',epistemicClass:'observed-context'},
        {from:'driver:fxn-circulating-locked-share',to:'mechanism:fxn-locker',relation:'describes',epistemicClass:'observed-context'},
        {from:'driver:total-vefxn',to:'mechanism:fxn-locker',relation:'describes',epistemicClass:'observed-context'},
        {from:'driver:weekly-wsteth-revenue',to:'mechanism:fxn-locker',relation:'economic-context-for',epistemicClass:'observed-context-not-yet-causal'},
        {from:'company:004',to:'mechanism:curve-vecrv-fee-distributor',relation:'holds-position-through',epistemicClass:'canonical-position-state'},
        {from:'mechanism:curve-vecrv-fee-distributor',to:'protocol:curve',relation:'belongs-to',epistemicClass:'protocol-mechanism'},
        {from:'mechanism:curve-vecrv-fee-distributor',to:'asset:crv',relation:'rewards-lockers-of',epistemicClass:'protocol-mechanism'},
        {from:'driver:curve-crvusd-fees',to:'metric:curve-vecrv-reference-apr',relation:'formula-numerator-input',epistemicClass:'proven-mechanical-identity'},
        {from:'driver:curve-vesupply',to:'metric:curve-vecrv-reference-apr',relation:'formula-denominator-input',epistemicClass:'proven-mechanical-identity'},
        {from:'driver:curve-crv-price',to:'metric:curve-vecrv-reference-apr',relation:'formula-denominator-input',epistemicClass:'proven-mechanical-identity'},
        {from:'metric:curve-vecrv-reference-apr',to:'mechanism:curve-vecrv-fee-distributor',relation:'describes-productive-capacity-of',epistemicClass:'canonical-productivity-metric'}
      ]
    },
    cohorts:{
      [FXN_COHORT_ID]:{
        cohortId:FXN_COHORT_ID,
        status:'active-unresolved-causality',
        identity:{companyRegistry:'004',company:'defitea.eth',protocol:'f(x)',mechanism:'veFXN Locker',asset:'FXN'},
        latest:{observation:currentFxn,movement:fxnMovement},
        observationCount:fxnObservations.length,
        attribution:fxnAttribution
      },
      [CURVE_COHORT_ID]:{
        cohortId:CURVE_COHORT_ID,
        status:'active-formula-mechanics-proven',
        identity:{companyRegistry:'004',company:'defitea.eth',protocol:'Curve',mechanism:'veCRV Fee Distributor',asset:'CRV'},
        latest:{observation:currentCurve,movement:curveMovement},
        observationCount:curveObservations.length,
        attribution:curveAttribution
      }
    },
    latest:{observation:currentFxn,movement:fxnMovement},
    observations,
    attribution:fxnAttribution,
    expansionQueue:[
      'Aerodrome veAERO votes + voting incentives + fees + emissions',
      'Convex vlCVX + Votium incentive markets',
      'Votium / VoteMarket incentive markets',
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
  const state=buildEconomicGraph({
    productivity,
    previousState,
    snapshot,
    sourceSha256:sha256File(PRODUCTIVITY),
    productivityEngineSha256:sha256File(PRODUCTIVITY_ENGINE)
  });
  fs.mkdirSync(path.dirname(OUT),{recursive:true});
  fs.writeFileSync(OUT,JSON.stringify(state,null,2)+'\n');
  const curve=state.cohorts?.[CURVE_COHORT_ID]?.latest?.observation;
  console.log('ECONOMIC GRAPH v0.2 PASS',{
    status:state.coverage.status,
    cohortCount:state.coverage.cohortCount,
    observations:state.observations.length,
    fxnAprPct:state.latest.observation.liveObservedAprPct,
    curveAprPct:curve?.canonicalProductivityAprPct,
    curveFormulaParityDeltaPctPoints:curve?.formulaParityDeltaPctPoints,
    fxnPrimaryDriver:state.attribution.primaryDriver,
    executionAuthority:state.authority.executionAuthority,
    deterministic
  });
}

if(path.resolve(process.argv[1]||'')===new URL(import.meta.url).pathname){
  main().catch(error=>{console.error(error?.stack||error);process.exit(1);});
}
