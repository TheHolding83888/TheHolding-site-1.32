#!/usr/bin/env node
/**
 * The Holding · Yield Basis registry-wide protocol lifecycle adapter v0.1
 *
 * Reuses canonical Productivity sensors already materialized for Yield Basis:
 *   - veYB governance / revenue APR
 *   - yb-WBTC Fundamental Trading APY (30D)
 *   - yb-WETH Fundamental Trading APY (30D)
 *
 * The adapter aggregates protocol exposure across companies and appends one
 * registry-wide protocol sensor to the existing Protocol Intelligence Lifecycle.
 * It creates no second collector, writer, market-data authority or execution lane.
 */

import crypto from 'node:crypto';

export const YIELDBASIS_PROTOCOL_ID='registry-yieldbasis-multimechanism';
export const YIELDBASIS_SENSOR_VERSION='0.1-yieldbasis-registry-multimechanism-sensor';
const MAX_OBSERVATIONS=1000;
const MAX_TRANSITIONS=2000;
const VEYB_ENGINE='yieldbasis_veyb';
const WBTC_ENGINE='yieldbasis_yblp_wbtc';
const WETH_ENGINE='yieldbasis_yblp_weth';
const VEYB_SOURCE='https://yieldbasis.com/analytics';
const LP_SOURCE='companies/company-007-resolve.json';
const APR_TOLERANCE_PCT_POINTS=0.01;

function fail(message){throw new Error(message);}
function finite(value){return value!==null&&value!==undefined&&value!==''&&Number.isFinite(Number(value));}
function numberOrNull(value){return finite(value)?Number(value):null;}
function round(value,digits=8){const n=Number(value);return Number.isFinite(n)?Number(n.toFixed(digits)):null;}
function sha256Text(text){return crypto.createHash('sha256').update(text).digest('hex');}
function stageRank(order,stage){return order.indexOf(stage);}
function check(id,pass,stage,detail,evidenceClass='measured'){return{id,pass:Boolean(pass),stage,evidenceClass,detail};}
function saneSignedApr(value){return finite(value)&&Number(value)>=-100&&Number(value)<=500;}
function evidenceSummary(checks){return{
  total:checks.length,
  passed:checks.filter(x=>x.pass).length,
  failed:checks.filter(x=>!x.pass).length,
  canonicalAtoms:checks.filter(x=>x.pass&&x.stage==='canonical').length,
  verifiedAtoms:checks.filter(x=>x.pass&&x.stage==='verified').length,
  shadowAtoms:checks.filter(x=>x.pass&&x.stage==='shadow').length
};}

function lpFormula(engine,label){
  const ppsNow=Number(engine?.details?.ppsNow);
  const pps30dAgo=Number(engine?.details?.pps30dAgo);
  const startMs=Date.parse(engine?.periodStart||'');
  const endMs=Date.parse(engine?.periodEnd||'');
  if(!(ppsNow>0)||!(pps30dAgo>0)||!Number.isFinite(startMs)||!Number.isFinite(endMs)||endMs<=startMs){
    return {status:'unavailable',label,ppsNow:numberOrNull(ppsNow),pps30dAgo:numberOrNull(pps30dAgo),elapsedDays:null,reproducedAprPct:null,canonicalAprPct:numberOrNull(engine?.aprLatest),parityDeltaPctPoints:null,parityOk:false};
  }
  const elapsedDays=(endMs-startMs)/864e5;
  const reproducedAprPct=((ppsNow/pps30dAgo)**(365/elapsedDays)-1)*100;
  const canonicalAprPct=Number(engine?.aprLatest);
  const parityDeltaPctPoints=Number.isFinite(canonicalAprPct)?reproducedAprPct-canonicalAprPct:NaN;
  return {
    status:Number.isFinite(reproducedAprPct)&&Number.isFinite(parityDeltaPctPoints)?'reproduced':'unavailable',
    label,
    ppsNow:round(ppsNow,12),
    pps30dAgo:round(pps30dAgo,12),
    elapsedDays:round(elapsedDays,8),
    reproducedAprPct:round(reproducedAprPct,6),
    canonicalAprPct:Number.isFinite(canonicalAprPct)?round(canonicalAprPct,6):null,
    parityDeltaPctPoints:Number.isFinite(parityDeltaPctPoints)?round(parityDeltaPctPoints,6):null,
    parityOk:Number.isFinite(parityDeltaPctPoints)&&Math.abs(parityDeltaPctPoints)<=APR_TOLERANCE_PCT_POINTS,
    formula:'(PPS_now / PPS_30d_ago)^(365 / elapsed_days) - 1',
    emissionsIncluded:false,
    redemptionPpsUsedForApr:false
  };
}

function collectExposure(productivity){
  const rows=[];
  const engines=new Set([VEYB_ENGINE,WBTC_ENGINE,WETH_ENGINE]);
  for(const [companyKey,company] of Object.entries(productivity?.companies||{})){
    for(const position of Array.isArray(company?.breakdown)?company.breakdown:[]){
      if(!engines.has(position?.engineId)||!(Number(position?.units)>0))continue;
      rows.push({
        companyKey,
        companyName:company?.name||companyKey,
        registry:company?.registry||null,
        engineId:position.engineId,
        principalId:position?.principalId||null,
        units:round(position.units,12),
        productiveValueUsd:finite(position?.value)?round(position.value,8):null,
        aprPct:finite(position?.apr)?round(position.apr,6):null,
        engineStatus:position?.engineStatus||productivity?.engines?.[position.engineId]?.status||null
      });
    }
  }
  const companyKeys=[...new Set(rows.map(x=>x.companyKey))].sort();
  return {rows,companyKeys,companyCount:companyKeys.length,positionCount:rows.length};
}

function stableObservationCore(observation){return{
  observedAt:observation.observedAt,
  snapshotKey:observation.snapshotKey,
  veYbAprPct:observation.mechanisms.veYB.currentAprPct,
  wbtcAprPct:observation.mechanisms.ybWbtc.currentAprPct,
  wethAprPct:observation.mechanisms.ybWeth.currentAprPct,
  wbtcParity:observation.mechanisms.ybWbtc.formula.parityDeltaPctPoints,
  wethParity:observation.mechanisms.ybWeth.formula.parityDeltaPctPoints,
  companyKeys:observation.registryExposure.companyKeys,
  productivitySha256:observation.provenance.productivitySha256
};}

function validatedSnapshotKey(observation){
  if(observation?.epistemic?.currentCompositeObservation!=='validated-current-composite')return null;
  return observation?.snapshotKey||null;
}

export function buildYieldBasisObservation({productivity,productivitySha256}){
  if(!productivity||typeof productivity!=='object')fail('Yield Basis lifecycle requires Productivity state');
  if(!/^[0-9a-f]{64}$/i.test(String(productivitySha256||'')))fail('Yield Basis lifecycle Productivity SHA-256 missing');
  const ve=productivity?.engines?.[VEYB_ENGINE];
  const wbtc=productivity?.engines?.[WBTC_ENGINE];
  const weth=productivity?.engines?.[WETH_ENGINE];
  if(!ve||!wbtc||!weth)fail('Yield Basis lifecycle requires veYB + yb-WBTC + yb-WETH canonical Productivity engines');
  if(ve?.protocol!=='Yield Basis'||ve?.sourceUrl!==VEYB_SOURCE||ve?.sourceType!=='official-analytics')fail('Yield Basis veYB source identity drift');
  for(const [label,engine] of [['yb-WBTC',wbtc],['yb-WETH',weth]]){
    if(engine?.protocol!=='Yield Basis'||engine?.sourceUrl!==LP_SOURCE||engine?.sourceType!=='local-verified-resolver')fail(`Yield Basis ${label} source identity drift`);
  }
  const veCurrent=ve.status==='ok'&&saneSignedApr(ve.aprLatest);
  const wbtcFormula=lpFormula(wbtc,'yb-WBTC');
  const wethFormula=lpFormula(weth,'yb-WETH');
  const wbtcCurrent=wbtc.status==='ok'&&saneSignedApr(wbtc.aprLatest)&&wbtcFormula.parityOk;
  const wethCurrent=weth.status==='ok'&&saneSignedApr(weth.aprLatest)&&wethFormula.parityOk;
  const exposure=collectExposure(productivity);
  const observedAt=productivity.generatedAt||ve.lastUpdatedAt||wbtc.lastUpdatedAt||weth.lastUpdatedAt;
  if(!Number.isFinite(Date.parse(observedAt)))fail('Yield Basis observation timestamp invalid');
  const compositeValidated=veCurrent&&wbtcCurrent&&wethCurrent&&exposure.companyCount>=2;

  const observation={
    observedAt,
    snapshotKey:productivity.snapshotKey||String(observedAt).slice(0,10),
    protocol:'Yield Basis',
    scope:'registry-wide-multi-company',
    mechanism:'veYB governance revenue + yb-LP fundamental PPS productivity',
    mechanisms:{
      veYB:{
        engineId:VEYB_ENGINE,
        status:ve.status||null,
        currentAprPct:numberOrNull(ve.aprLatest),
        nativeCadence:ve.nativeCadence||null,
        sourceUrl:ve.sourceUrl||null,
        sourceType:ve.sourceType||null,
        sourceMetric:ve.sourceMetric||null,
        periodStart:ve.periodStart||null,
        periodEnd:ve.periodEnd||null,
        stateClass:veCurrent?'measured-current-official-analytics':'warming-source-not-current'
      },
      ybWbtc:{
        engineId:WBTC_ENGINE,
        status:wbtc.status||null,
        currentAprPct:numberOrNull(wbtc.aprLatest),
        nativeCadence:wbtc.nativeCadence||null,
        sourceUrl:wbtc.sourceUrl||null,
        sourceType:wbtc.sourceType||null,
        sourceMetric:wbtc.sourceMetric||null,
        periodStart:wbtc.periodStart||null,
        periodEnd:wbtc.periodEnd||null,
        formula:wbtcFormula,
        stateClass:wbtcCurrent?'measured-current-formula-reproduced':'warming-formula-not-proven'
      },
      ybWeth:{
        engineId:WETH_ENGINE,
        status:weth.status||null,
        currentAprPct:numberOrNull(weth.aprLatest),
        nativeCadence:weth.nativeCadence||null,
        sourceUrl:weth.sourceUrl||null,
        sourceType:weth.sourceType||null,
        sourceMetric:weth.sourceMetric||null,
        periodStart:weth.periodStart||null,
        periodEnd:weth.periodEnd||null,
        formula:wethFormula,
        stateClass:wethCurrent?'measured-current-formula-reproduced':'warming-formula-not-proven'
      }
    },
    registryExposure:{
      companyCount:exposure.companyCount,
      positionCount:exposure.positionCount,
      companyKeys:exposure.companyKeys,
      rows:exposure.rows,
      stateClass:exposure.companyCount>=2?'measured-registry-wide-exposure':'partial-registry-exposure'
    },
    provenance:{
      productivityFile:'companies/productivity-data.json',
      productivityGeneratedAt:productivity.generatedAt||null,
      productivitySnapshotKey:productivity.snapshotKey||null,
      productivitySha256
    },
    epistemic:{
      observationClass:'registry-wide-protocol-economic-sensor',
      currentCompositeObservation:compositeValidated?'validated-current-composite':'warming-current-composite',
      lpPpsToFundamentalTradingApy:'ATTRIBUTED-mechanical-formula-within-canonical-tolerance',
      veYbCurrentApr:'MEASURED-official-analytics',
      veYbRevenueToAprCausality:'UNKNOWN-not-yet-proven-accounting-identity',
      protocolWidePrimaryDriver:null,
      causalAttribution:'unresolved-beyond-proven-lp-pps-formula',
      predictionAuthority:'none',
      recommendationAuthority:'none',
      executionAuthority:'none'
    }
  };
  observation.id=`yieldbasis:${observation.snapshotKey}:${sha256Text(JSON.stringify(stableObservationCore(observation))).slice(0,20)}`;
  return observation;
}

function buildMovement(current,prior){return{
  priorObservationId:prior?.id||null,
  comparable:Boolean(prior),
  veYbAprDeltaPctPoints:prior&&finite(current.mechanisms.veYB.currentAprPct)&&finite(prior.mechanisms?.veYB?.currentAprPct)?round(Number(current.mechanisms.veYB.currentAprPct)-Number(prior.mechanisms.veYB.currentAprPct),6):null,
  ybWbtcAprDeltaPctPoints:prior&&finite(current.mechanisms.ybWbtc.currentAprPct)&&finite(prior.mechanisms?.ybWbtc?.currentAprPct)?round(Number(current.mechanisms.ybWbtc.currentAprPct)-Number(prior.mechanisms.ybWbtc.currentAprPct),6):null,
  ybWethAprDeltaPctPoints:prior&&finite(current.mechanisms.ybWeth.currentAprPct)&&finite(prior.mechanisms?.ybWeth?.currentAprPct)?round(Number(current.mechanisms.ybWeth.currentAprPct)-Number(prior.mechanisms.ybWeth.currentAprPct),6):null,
  companyCountDelta:prior?Number(current.registryExposure.companyCount)-Number(prior.registryExposure?.companyCount||0):null,
  note:'Like-for-like Yield Basis observations only. Cross-mechanism co-movement is descriptive and never promoted to causality by this delta.'
};}

export function applyYieldBasisLifecycle({state,previousState,productivity,productivitySha256,policy}){
  if(!state||typeof state!=='object')fail('Yield Basis lifecycle requires Economic Graph state');
  if(state?.authority?.executionAuthority!=='none'||state?.authority?.causalClaimAuthority!=='none')fail('Yield Basis lifecycle refuses Economic Graph authority drift');
  if(!state?.protocolLifecycle||state.protocolLifecycle.authority?.executionAuthority!=='none')fail('Base Protocol Lifecycle must run before Yield Basis adapter');
  const p=policy?.protocols?.[YIELDBASIS_PROTOCOL_ID];
  if(!p)fail('Yield Basis lifecycle policy missing');
  const current=buildYieldBasisObservation({productivity,productivitySha256});
  const previousRows=Array.isArray(previousState?.protocolSensors?.[YIELDBASIS_PROTOCOL_ID]?.observations)?previousState.protocolSensors[YIELDBASIS_PROTOCOL_ID].observations:[];
  const rows=[...previousRows];
  if(!rows.some(x=>x?.id===current.id))rows.push(current);
  const observations=rows.slice(-MAX_OBSERVATIONS);
  const latest=observations.at(-1);
  const prior=[...observations].reverse().find(x=>x?.id!==latest?.id)||null;
  const validatedObservations=observations.filter(x=>validatedSnapshotKey(x)!==null);
  const validatedSnapshotKeys=[...new Set(validatedObservations.map(validatedSnapshotKey))];
  const validatedSnapshotCount=validatedSnapshotKeys.length;
  const requiredValidatedSnapshotCount=Number(p.verifiedMinimumDistinctSnapshotCount||2);
  const ve=latest.mechanisms.veYB;
  const wbtc=latest.mechanisms.ybWbtc;
  const weth=latest.mechanisms.ybWeth;

  const checks=[
    check('sensor-materialized',true,'shadow','Yield Basis registry-wide sensor is materialized from canonical Productivity.','sensor-state'),
    check('veyb-official-current',ve.stateClass==='measured-current-official-analytics'&&saneSignedApr(ve.currentAprPct),'verified','veYB current/latest-epoch APR is measured from official Yield Basis analytics.','source-provenance'),
    check('yb-wbtc-pps-formula-parity',wbtc.stateClass==='measured-current-formula-reproduced'&&wbtc.formula?.parityOk===true,'verified','yb-WBTC 30D Fundamental Trading APY is reproduced from PPS history within tolerance.','mechanical-identity'),
    check('yb-weth-pps-formula-parity',weth.stateClass==='measured-current-formula-reproduced'&&weth.formula?.parityOk===true,'verified','yb-WETH 30D Fundamental Trading APY is reproduced from PPS history within tolerance.','mechanical-identity'),
    check('signed-return-semantics',saneSignedApr(wbtc.currentAprPct)&&saneSignedApr(weth.currentAprPct),'verified','Signed yb-LP economic returns remain valid observations; negative FT APY is not coerced to UNKNOWN or zero.','epistemic-safety'),
    check('registry-exposure-breadth',Number(latest.registryExposure.companyCount)>=2,'verified','Yield Basis exposure is measured across at least two registered company surfaces.','registry-topology'),
    check('distinct-snapshot-depth',validatedSnapshotCount>=requiredValidatedSnapshotCount,'verified',`At least ${requiredValidatedSnapshotCount} distinct validated canonical Productivity snapshots are retained; duplicate observations of one snapshot count once.`,'longitudinal-snapshot'),
    check('causal-boundary-preserved',latest.epistemic.veYbRevenueToAprCausality==='UNKNOWN-not-yet-proven-accounting-identity'&&latest.epistemic.protocolWidePrimaryDriver===null,'canonical','Unproven veYB revenue/APR and cross-mechanism causality remains UNKNOWN.','epistemic-boundary'),
    check('veyb-revenue-apr-accounting-identity',false,'canonical','A complete reproducible veYB revenue → distribution/APR accounting identity is not yet proven.','mechanism-proof')
  ];
  const verifiedIds=['sensor-materialized','veyb-official-current','yb-wbtc-pps-formula-parity','yb-weth-pps-formula-parity','signed-return-semantics','registry-exposure-breadth','distinct-snapshot-depth'];
  const verifiedGate=verifiedIds.every(id=>checks.find(x=>x.id===id)?.pass);
  const canonicalGate=verifiedGate&&checks.find(x=>x.id==='causal-boundary-preserved')?.pass&&checks.find(x=>x.id==='veyb-revenue-apr-accounting-identity')?.pass;
  const stage=canonicalGate?'canonical':(verifiedGate?'verified':'shadow');
  const priorLifecycle=previousState?.protocolLifecycle?.protocols?.[YIELDBASIS_PROTOCOL_ID]||null;
  const priorStage=priorLifecycle?.maturityStage||null;
  const order=policy.stageOrder||['discovery','shadow','verified','canonical'];
  const basis=checks.map(x=>[x.id,x.pass,x.stage]);
  const changed=priorStage!==null&&priorStage!==stage;
  const fingerprint=changed?sha256Text(JSON.stringify({protocolId:YIELDBASIS_PROTOCOL_ID,from:priorStage,to:stage,basis})):null;

  const protocol={
    protocolId:YIELDBASIS_PROTOCOL_ID,
    label:p.label,
    maturityStage:stage,
    operatingMode:stage==='canonical'?'continuous-monitoring':'shadow-monitoring',
    automaticallyEvaluated:true,
    automaticallyPromoted:priorStage!==null&&stageRank(order,stage)>stageRank(order,priorStage),
    automaticallyRegressed:priorStage!==null&&stageRank(order,stage)<stageRank(order,priorStage),
    scope:'registry-wide-multi-company',
    evidence:evidenceSummary(checks),
    longitudinalEvidence:{
      validatedObservationCount:validatedObservations.length,
      validatedSnapshotCount,
      requiredValidatedSnapshotCount,
      validatedSnapshotKeys
    },
    checks,
    blockers:stage==='canonical'?[]:checks.filter(x=>!x.pass).map(x=>x.id),
    unknowns:[
      'complete veYB revenue → distribution/APR accounting identity remains UNKNOWN',
      'why Yield Basis governance APR or yb-LP PPS returns changed remains UNKNOWN beyond directly measured/formula-proven atoms',
      'cross-company and cross-mechanism co-movement is not causality'
    ],
    epistemicBoundary:'The registry-wide sensor may aggregate measured mechanisms without collapsing their economic semantics. veYB governance revenue APR and yb-LP Fundamental Trading APY remain separate mechanisms; correlation across them is not attribution.',
    priorMaturityStage:priorStage,
    transitionFingerprint:fingerprint
  };

  state.protocolSensors={
    ...(state.protocolSensors||{}),
    [YIELDBASIS_PROTOCOL_ID]:{
      version:YIELDBASIS_SENSOR_VERSION,
      status:stage==='canonical'?'continuous-monitoring':(stage==='verified'?'verified-shadow-monitoring':'shadow-observation-active'),
      identity:{protocol:'Yield Basis',scope:'registry-wide-multi-company',mechanisms:['veYB','yb-WBTC','yb-WETH']},
      latest:{observation:latest,movement:buildMovement(latest,prior)},
      observationCount:observations.length,
      validatedObservationCount:validatedObservations.length,
      validatedSnapshotCount,
      validatedSnapshotKeys,
      observations,
      authority:{executionAuthority:'none',causalClaimAuthority:'none',recommendationAuthority:'none',predictionAuthority:'none'}
    }
  };

  const lifecycle=state.protocolLifecycle;
  lifecycle.protocols={...(lifecycle.protocols||{}),[YIELDBASIS_PROTOCOL_ID]:protocol};
  if(fingerprint&&!lifecycle.transitions?.some(x=>x?.fingerprint===fingerprint)){
    lifecycle.transitions=[...(lifecycle.transitions||[]),{
      fingerprint,protocolId:YIELDBASIS_PROTOCOL_ID,from:priorStage,to:stage,
      observedAt:state.generatedAt||new Date().toISOString(),automatic:true,
      reason:'deterministic-pre-approved-evidence-gate'
    }].slice(-MAX_TRANSITIONS);
  }
  const counts=Object.values(lifecycle.protocols).reduce((acc,row)=>{acc[row.maturityStage]=(acc[row.maturityStage]||0)+1;return acc;},{});
  lifecycle.summary={protocolCount:Object.keys(lifecycle.protocols).length,stageCounts:counts,automaticTransitionsRecorded:(lifecycle.transitions||[]).length};
  lifecycle.policyRevision=policy.revision||null;
  lifecycle.nextProtocolTemplate='Protocol sensors may be company-scoped or registry-wide. Reuse canonical sensors first; preserve mechanism semantics; add only true mechanism deltas.';
  return state;
}
