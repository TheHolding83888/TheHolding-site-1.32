#!/usr/bin/env node
/**
 * The Holding · Frax registry-wide veFRAX lifecycle adapter v0.2
 *
 * Reuses the canonical Productivity Frax engine and its bounded snapshot history.
 * It intentionally separates current FRAX / veFRAX product identity from the
 * legacy-compatible official API field `core.vefxs.apr`.
 *
 * Weekly/canonical Productivity snapshots are useful observation history, but
 * they are not Frax-native epoch proof. VERIFIED requires distinct native Frax
 * periods with explicit reproducible period boundaries. A label or snapshot key
 * alone can never manufacture native-period depth.
 *
 * This adapter does not infer Ethereum -> Fraxtal lock migration, legacy-gauge
 * sunset, revenue-share activation, or revenue -> veFRAX APR causality from a
 * branding change or a legacy API field name. Those remain UNKNOWN until a
 * reproducible canonical evidence path proves them.
 *
 * No collector, workflow writer, repository mutation authority, recommendation
 * authority, or execution authority is introduced here.
 */

import crypto from 'node:crypto';

export const FRAX_PROTOCOL_ID='registry-frax-vefrax';
export const FRAX_SENSOR_VERSION='0.2-frax-native-period-gated-registry-sensor';
const ENGINE_ID='frax_vefrax';
const EXPECTED_PROTOCOL='Frax';
const EXPECTED_PRINCIPAL='FRAX';
const EXPECTED_SOURCE_TYPE='official-api';
const EXPECTED_API='https://api.frax.finance/combineddata/';
const LEGACY_API_PATH='core.vefxs.apr';
const EXPECTED_NATIVE_CADENCE='epoch';
const APR_TOLERANCE_PCT_POINTS=0.01;
const MAX_OBSERVATIONS=1000;
const MAX_TRANSITIONS=2000;

function fail(message){throw new Error(message);}
function finite(value){return value!==null&&value!==undefined&&value!==''&&Number.isFinite(Number(value));}
function round(value,digits=8){const n=Number(value);return Number.isFinite(n)?Number(n.toFixed(digits)):null;}
function saneApr(value){return finite(value)&&Number(value)>=0&&Number(value)<=500;}
function sha256Text(text){return crypto.createHash('sha256').update(text).digest('hex');}
function stageRank(order,stage){return order.indexOf(stage);}
function validIso(value){return Number.isFinite(Date.parse(String(value||'')));}
function check(id,pass,stage,detail,evidenceClass='measured'){return{id,pass:Boolean(pass),stage,evidenceClass,detail};}
function evidenceSummary(checks){return{
  total:checks.length,
  passed:checks.filter(x=>x.pass).length,
  failed:checks.filter(x=>!x.pass).length,
  canonicalAtoms:checks.filter(x=>x.pass&&x.stage==='canonical').length,
  verifiedAtoms:checks.filter(x=>x.pass&&x.stage==='verified').length,
  shadowAtoms:checks.filter(x=>x.pass&&x.stage==='shadow').length
};}

function collectExposure(productivity){
  const rows=[];
  for(const [companyKey,company] of Object.entries(productivity?.companies||{})){
    for(const position of Array.isArray(company?.breakdown)?company.breakdown:[]){
      if(position?.engineId!==ENGINE_ID||!(Number(position?.units)>0))continue;
      rows.push({
        companyKey,
        companyName:company?.name||companyKey,
        registry:company?.registry||null,
        engineId:ENGINE_ID,
        principalId:position?.principalId||null,
        units:round(position.units,12),
        productiveValueUsd:finite(position?.value)?round(position.value,8):null,
        aprPct:finite(position?.apr)?round(position.apr,6):null,
        engineStatus:position?.engineStatus||productivity?.engines?.[ENGINE_ID]?.status||null
      });
    }
  }
  const companyKeys=[...new Set(rows.map(x=>x.companyKey))].sort();
  return {rows,companyKeys,companyCount:companyKeys.length,positionCount:rows.length};
}

function canonicalSnapshotHistory(productivity,currentEngine){
  const rows=Array.isArray(productivity?.history?.engines?.[ENGINE_ID])?productivity.history.engines[ENGINE_ID]:[];
  const normalized=[];
  const seen=new Set();
  for(const row of rows){
    const snapshotKey=String(row?.snapshotKey||'').trim();
    if(!snapshotKey||seen.has(snapshotKey))continue;
    if(!saneApr(row?.apr)||row?.sourceType!==EXPECTED_SOURCE_TYPE)continue;
    seen.add(snapshotKey);
    normalized.push({
      snapshotKey,
      aprPct:round(row.apr,6),
      nativePeriodId:row?.nativePeriodId?String(row.nativePeriodId):null,
      periodStart:row?.periodStart||null,
      periodEnd:row?.periodEnd||null,
      sourceType:row.sourceType
    });
  }
  const currentKey=String(productivity?.snapshotKey||'').trim();
  const currentRow=normalized.find(x=>x.snapshotKey===currentKey)||null;
  const currentApr=Number(currentEngine?.aprLatest);
  const parityDelta=currentRow&&Number.isFinite(currentApr)?Number(currentRow.aprPct)-currentApr:NaN;
  return {
    rows:normalized,
    snapshotKeys:normalized.map(x=>x.snapshotKey),
    distinctSnapshotCount:normalized.length,
    currentSnapshotKey:currentKey||null,
    currentSnapshotPresent:Boolean(currentRow),
    currentSnapshotAprPct:currentRow?.aprPct??null,
    currentAprParityDeltaPctPoints:Number.isFinite(parityDelta)?round(parityDelta,6):null,
    currentAprParityOk:Number.isFinite(parityDelta)&&Math.abs(parityDelta)<=APR_TOLERANCE_PCT_POINTS
  };
}

function nativePeriodEvidence(snapshotHistory){
  const periods=[];
  const seen=new Set();
  for(const row of snapshotHistory?.rows||[]){
    const explicitId=String(row?.nativePeriodId||'').trim();
    const hasBounds=validIso(row?.periodStart)&&validIso(row?.periodEnd)&&Date.parse(row.periodEnd)>Date.parse(row.periodStart);
    if(!hasBounds)continue;
    const periodKey=`${row.periodStart}::${row.periodEnd}`;
    if(seen.has(periodKey))continue;
    seen.add(periodKey);
    periods.push({
      periodKey,
      nativePeriodId:explicitId||null,
      periodStart:row.periodStart,
      periodEnd:row.periodEnd,
      supportingSnapshotKey:row.snapshotKey,
      aprPct:row.aprPct,
      sourceType:row.sourceType
    });
  }
  return {
    periods,
    periodKeys:periods.map(x=>x.periodKey),
    distinctNativePeriodCount:periods.length
  };
}

function stableObservationCore(observation){return{
  snapshotKey:observation.snapshotKey,
  currentAprPct:observation.referenceProductivity.currentAprPct,
  companyKeys:observation.registryExposure.companyKeys,
  legacyApiPath:observation.identityBoundary.legacyOfficialApiField,
  snapshotKeys:observation.longitudinalEvidence.canonicalSnapshotKeys,
  nativePeriodKeys:observation.longitudinalEvidence.validatedNativePeriodKeys,
  productivitySha256:observation.provenance.productivitySha256
};}

export function buildFraxObservation({productivity,productivitySha256}){
  if(!productivity||typeof productivity!=='object')fail('Frax lifecycle requires Productivity state');
  if(!/^[0-9a-f]{64}$/i.test(String(productivitySha256||'')))fail('Frax lifecycle Productivity SHA-256 missing');
  const engine=productivity?.engines?.[ENGINE_ID];
  if(!engine)fail('Frax lifecycle requires canonical frax_vefrax Productivity engine');
  if(engine?.protocol!==EXPECTED_PROTOCOL)fail(`Frax protocol identity drift: ${engine?.protocol}`);
  if(engine?.principalSymbol!==EXPECTED_PRINCIPAL)fail(`Frax principal identity drift: ${engine?.principalSymbol}`);
  if(engine?.sourceType!==EXPECTED_SOURCE_TYPE)fail(`Frax source type drift: ${engine?.sourceType}`);
  if(engine?.nativeCadence!==EXPECTED_NATIVE_CADENCE)fail(`Frax native cadence drift: ${engine?.nativeCadence}`);
  if(engine?.details?.path!==LEGACY_API_PATH)fail(`Frax official API field drift: ${engine?.details?.path}`);
  const sourceText=String(engine?.source||engine?.sourceApi||'');
  if(sourceText!==EXPECTED_API)fail(`Frax canonical official API source drift: ${sourceText||'missing'}`);
  const currentOk=engine?.status==='ok'&&saneApr(engine?.aprLatest);
  const exposure=collectExposure(productivity);
  const snapshots=canonicalSnapshotHistory(productivity,engine);
  const nativePeriods=nativePeriodEvidence(snapshots);
  const observedAt=productivity?.generatedAt||engine?.lastUpdatedAt||engine?.periodEnd;
  if(!validIso(observedAt))fail('Frax observation timestamp invalid');

  const observation={
    observedAt,
    snapshotKey:productivity?.snapshotKey||String(observedAt).slice(0,10),
    protocol:'Frax',
    scope:'registry-wide-multi-company-ve-lock',
    mechanism:'FRAX / veFRAX governance productivity',
    referenceProductivity:{
      engineId:ENGINE_ID,
      status:engine?.status||null,
      currentAprPct:finite(engine?.aprLatest)?round(engine.aprLatest,6):null,
      nativeCadence:engine?.nativeCadence||null,
      sourceUrl:engine?.sourceUrl||null,
      sourceType:engine?.sourceType||null,
      sourceMetric:engine?.sourceMetric||null,
      canonicalApiSource:sourceText||null,
      periodStart:engine?.periodStart||null,
      periodEnd:engine?.periodEnd||null,
      stateClass:currentOk?'measured-current-official-api':'warming-source-not-current'
    },
    registryExposure:{
      companyCount:exposure.companyCount,
      positionCount:exposure.positionCount,
      companyKeys:exposure.companyKeys,
      rows:exposure.rows,
      stateClass:exposure.companyCount>=1?'measured-registry-wide-exposure':'no-measured-registry-exposure'
    },
    longitudinalEvidence:{
      canonicalSnapshotCount:snapshots.distinctSnapshotCount,
      canonicalSnapshotKeys:snapshots.snapshotKeys,
      currentSnapshotKey:snapshots.currentSnapshotKey,
      currentSnapshotPresent:snapshots.currentSnapshotPresent,
      currentSnapshotAprPct:snapshots.currentSnapshotAprPct,
      currentAprParityDeltaPctPoints:snapshots.currentAprParityDeltaPctPoints,
      currentAprParityOk:snapshots.currentAprParityOk,
      canonicalSnapshots:snapshots.rows,
      validatedNativePeriodCount:nativePeriods.distinctNativePeriodCount,
      validatedNativePeriodKeys:nativePeriods.periodKeys,
      validatedNativePeriods:nativePeriods.periods,
      depthClass:nativePeriods.distinctNativePeriodCount>0?'explicit-native-frax-period-boundaries':'canonical-productivity-snapshots-only-not-native-epoch-proof'
    },
    identityBoundary:{
      currentCanonicalPrincipal:'FRAX',
      currentCanonicalVoteEscrowLabel:'veFRAX',
      legacyOfficialApiField:LEGACY_API_PATH,
      legacyApiFieldClass:'legacy-compatible-official-schema-field-not-token-identity-authority',
      brandingDoesNotProveMigration:true,
      ethereumToFraxtalLockMigrationState:'UNKNOWN-not-proven-by-canonical-productivity',
      legacyGaugeSunsetState:'UNKNOWN-not-proven-by-canonical-productivity',
      revenueShareDistributionState:'UNKNOWN-not-proven-by-canonical-productivity'
    },
    provenance:{
      productivityFile:'companies/productivity-data.json',
      productivityGeneratedAt:productivity?.generatedAt||null,
      productivitySnapshotKey:productivity?.snapshotKey||null,
      productivitySha256
    },
    epistemic:{
      observationClass:'registry-wide-protocol-economic-sensor',
      currentReferenceApr:currentOk?'MEASURED-official-api':'UNKNOWN-source-not-current',
      canonicalSnapshotHistory:'MEASURED-canonical-productivity-snapshots',
      nativeEpochHistory:nativePeriods.distinctNativePeriodCount>0?'MEASURED-explicit-native-period-boundaries':'UNKNOWN-no-explicit-native-period-boundaries',
      revenueToVeFraxAprCausality:'UNKNOWN-not-yet-proven-accounting-identity',
      ethereumFraxtalMigrationTopology:'UNKNOWN-not-yet-proven-by-canonical-evidence',
      legacyGaugeSunset:'UNKNOWN-not-yet-proven-by-canonical-evidence',
      protocolWidePrimaryDriver:null,
      causalAttribution:'unresolved',
      predictionAuthority:'none',
      recommendationAuthority:'none',
      executionAuthority:'none'
    }
  };
  observation.id=`frax:${observation.snapshotKey}:${sha256Text(JSON.stringify(stableObservationCore(observation))).slice(0,20)}`;
  return observation;
}

function buildMovement(current,prior){return{
  priorObservationId:prior?.id||null,
  comparable:Boolean(prior),
  aprDeltaPctPoints:prior&&finite(current.referenceProductivity.currentAprPct)&&finite(prior.referenceProductivity?.currentAprPct)?round(Number(current.referenceProductivity.currentAprPct)-Number(prior.referenceProductivity.currentAprPct),6):null,
  companyCountDelta:prior?Number(current.registryExposure.companyCount)-Number(prior.registryExposure?.companyCount||0):null,
  note:'Like-for-like Frax observations only. APR movement does not prove revenue, migration, gauge, governance, or native-epoch causality.'
};}

export function applyFraxLifecycle({state,previousState,productivity,productivitySha256,policy}){
  if(!state||typeof state!=='object')fail('Frax lifecycle requires Economic Graph state');
  if(state?.authority?.executionAuthority!=='none'||state?.authority?.causalClaimAuthority!=='none')fail('Frax lifecycle refuses Economic Graph authority drift');
  if(!state?.protocolLifecycle||state.protocolLifecycle.authority?.executionAuthority!=='none')fail('Base Protocol Lifecycle must run before Frax adapter');
  if(policy?.laws?.longitudinalDepthRequiresDistinctNativePeriods!==true)fail('Frax lifecycle requires global distinct-native-period law');
  const p=policy?.protocols?.[FRAX_PROTOCOL_ID];
  if(!p)fail('Frax lifecycle policy missing');

  const current=buildFraxObservation({productivity,productivitySha256});
  const previousRows=Array.isArray(previousState?.protocolSensors?.[FRAX_PROTOCOL_ID]?.observations)?previousState.protocolSensors[FRAX_PROTOCOL_ID].observations:[];
  const rows=[...previousRows];
  if(!rows.some(x=>x?.id===current.id))rows.push(current);
  const observations=rows.slice(-MAX_OBSERVATIONS);
  const latest=observations.at(-1);
  const prior=[...observations].reverse().find(x=>x?.id!==latest?.id)||null;
  const requiredNativePeriodCount=Number(p.verifiedMinimumDistinctNativePeriodCount||2);
  const canonicalSnapshotCount=Number(latest.longitudinalEvidence.canonicalSnapshotCount||0);
  const nativePeriodCount=Number(latest.longitudinalEvidence.validatedNativePeriodCount||0);

  const checks=[
    check('sensor-materialized',true,'shadow','Frax registry-wide sensor is materialized from canonical Productivity.','sensor-state'),
    check('official-api-current-apr',latest.referenceProductivity.stateClass==='measured-current-official-api'&&saneApr(latest.referenceProductivity.currentAprPct),'verified','Current Frax governance productivity APR is measured from the canonical official API path.','source-provenance'),
    check('native-cadence-contract',latest.referenceProductivity.nativeCadence===EXPECTED_NATIVE_CADENCE,'verified','Canonical Frax Productivity declares native cadence as epoch.','source-semantics'),
    check('registry-exposure-breadth',Number(latest.registryExposure.companyCount)>=1&&Number(latest.registryExposure.positionCount)>=1,'verified','At least one registered company has a measured Frax ve-lock exposure; all current registry exposures are retained separately.','registry-topology'),
    check('current-history-apr-parity',latest.longitudinalEvidence.currentSnapshotPresent===true&&latest.longitudinalEvidence.currentAprParityOk===true,'verified','Current Frax APR is represented in canonical Productivity snapshot history within 0.01 percentage points.','canonical-parity'),
    check('canonical-snapshot-history-support',canonicalSnapshotCount>=1,'shadow','Canonical Productivity snapshots provide bounded observation history but do not create native Frax epoch depth.','longitudinal-snapshot'),
    check('distinct-native-frax-period-depth',nativePeriodCount>=requiredNativePeriodCount,'verified',`At least ${requiredNativePeriodCount} distinct Frax-native periods with explicit reproducible period boundaries are required. Weekly Productivity snapshot keys or labels never satisfy this gate by themselves.`,'longitudinal-native-period'),
    check('legacy-api-schema-boundary-preserved',latest.identityBoundary.currentCanonicalPrincipal==='FRAX'&&latest.identityBoundary.currentCanonicalVoteEscrowLabel==='veFRAX'&&latest.identityBoundary.legacyOfficialApiField===LEGACY_API_PATH,'verified','The legacy-compatible core.vefxs.apr API field is preserved as source schema evidence and is not promoted into current token identity authority.','epistemic-safety'),
    check('branding-migration-boundary-preserved',latest.identityBoundary.brandingDoesNotProveMigration===true&&latest.identityBoundary.ethereumToFraxtalLockMigrationState==='UNKNOWN-not-proven-by-canonical-productivity'&&latest.identityBoundary.legacyGaugeSunsetState==='UNKNOWN-not-proven-by-canonical-productivity','verified','FRAX/veFRAX naming does not prove Ethereum→Fraxtal migration completion or legacy gauge sunset.','epistemic-boundary'),
    check('causal-boundary-preserved',latest.epistemic.revenueToVeFraxAprCausality==='UNKNOWN-not-yet-proven-accounting-identity'&&latest.epistemic.protocolWidePrimaryDriver===null,'canonical','Unproven revenue → veFRAX APR causality remains UNKNOWN.','epistemic-boundary'),
    check('ethereum-fraxtal-lock-topology-reconciled',false,'canonical','A canonical reproducible Ethereum/Fraxtal ve-lock topology and migration reconciliation is not yet materialized.','mechanism-proof'),
    check('frax-revenue-to-vefrax-apr-accounting-identity',false,'canonical','A complete reproducible Frax revenue → veFRAX distribution/APR accounting identity is not yet proven.','mechanism-proof')
  ];

  const verifiedIds=['sensor-materialized','official-api-current-apr','native-cadence-contract','registry-exposure-breadth','current-history-apr-parity','distinct-native-frax-period-depth','legacy-api-schema-boundary-preserved','branding-migration-boundary-preserved'];
  const verifiedGate=verifiedIds.every(id=>checks.find(x=>x.id===id)?.pass);
  const canonicalGate=verifiedGate&&['causal-boundary-preserved','ethereum-fraxtal-lock-topology-reconciled','frax-revenue-to-vefrax-apr-accounting-identity'].every(id=>checks.find(x=>x.id===id)?.pass);
  const stage=canonicalGate?'canonical':(verifiedGate?'verified':'shadow');
  const priorLifecycle=previousState?.protocolLifecycle?.protocols?.[FRAX_PROTOCOL_ID]||null;
  const priorStage=priorLifecycle?.maturityStage||null;
  const order=policy.stageOrder||['discovery','shadow','verified','canonical'];
  const basis=checks.map(x=>[x.id,x.pass,x.stage]);
  const changed=priorStage!==null&&priorStage!==stage;
  const fingerprint=changed?sha256Text(JSON.stringify({protocolId:FRAX_PROTOCOL_ID,from:priorStage,to:stage,basis})):null;

  const protocol={
    protocolId:FRAX_PROTOCOL_ID,
    label:p.label,
    maturityStage:stage,
    operatingMode:stage==='canonical'?'continuous-monitoring':'shadow-monitoring',
    automaticallyEvaluated:true,
    automaticallyPromoted:priorStage!==null&&stageRank(order,stage)>stageRank(order,priorStage),
    automaticallyRegressed:priorStage!==null&&stageRank(order,stage)<stageRank(order,priorStage),
    scope:'registry-wide-multi-company-ve-lock',
    evidence:evidenceSummary(checks),
    longitudinalEvidence:{
      canonicalSnapshotCount,
      canonicalSnapshotKeys:latest.longitudinalEvidence.canonicalSnapshotKeys,
      validatedNativePeriodCount:nativePeriodCount,
      requiredValidatedNativePeriodCount:requiredNativePeriodCount,
      validatedNativePeriodKeys:latest.longitudinalEvidence.validatedNativePeriodKeys,
      depthClass:latest.longitudinalEvidence.depthClass
    },
    checks,
    blockers:stage==='canonical'?[]:checks.filter(x=>!x.pass).map(x=>x.id),
    unknowns:[
      nativePeriodCount>=requiredNativePeriodCount?null:'distinct Frax-native epoch depth is not yet proven by canonical evidence',
      'Ethereum → Fraxtal ve-lock migration topology remains UNKNOWN to this canonical sensor',
      'legacy gauge sunset remains UNKNOWN to this canonical sensor',
      'revenue-share distribution activation remains UNKNOWN to this canonical sensor',
      'complete Frax revenue → veFRAX distribution/APR accounting identity remains UNKNOWN',
      'why Frax reference APR changed remains UNKNOWN'
    ].filter(Boolean),
    epistemicBoundary:'Current FRAX / veFRAX identity is kept separate from the legacy-compatible official API field core.vefxs.apr. Weekly Productivity snapshots do not create native epoch depth. Branding, API schema names, migration completion, gauge sunset and revenue distribution are distinct facts and cannot prove one another.',
    priorMaturityStage:priorStage,
    transitionFingerprint:fingerprint
  };

  state.protocolSensors={
    ...(state.protocolSensors||{}),
    [FRAX_PROTOCOL_ID]:{
      version:FRAX_SENSOR_VERSION,
      status:stage==='canonical'?'continuous-monitoring':(stage==='verified'?'verified-shadow-monitoring':'shadow-observation-active'),
      identity:{protocol:'Frax',scope:'registry-wide-multi-company-ve-lock',principal:'FRAX',voteEscrow:'veFRAX',engineId:ENGINE_ID},
      latest:{observation:latest,movement:buildMovement(latest,prior)},
      observationCount:observations.length,
      canonicalSnapshotCount,
      canonicalSnapshotKeys:latest.longitudinalEvidence.canonicalSnapshotKeys,
      validatedNativePeriodCount:nativePeriodCount,
      validatedNativePeriodKeys:latest.longitudinalEvidence.validatedNativePeriodKeys,
      observations,
      authority:{executionAuthority:'none',causalClaimAuthority:'none',recommendationAuthority:'none',predictionAuthority:'none'}
    }
  };

  const lifecycle=state.protocolLifecycle;
  lifecycle.protocols={...(lifecycle.protocols||{}),[FRAX_PROTOCOL_ID]:protocol};
  if(fingerprint&&!lifecycle.transitions?.some(x=>x?.fingerprint===fingerprint)){
    lifecycle.transitions=[...(lifecycle.transitions||[]),{
      fingerprint,protocolId:FRAX_PROTOCOL_ID,from:priorStage,to:stage,
      observedAt:state.generatedAt||new Date().toISOString(),automatic:true,
      reason:'deterministic-pre-approved-evidence-gate'
    }].slice(-MAX_TRANSITIONS);
  }
  const counts=Object.values(lifecycle.protocols).reduce((acc,row)=>{acc[row.maturityStage]=(acc[row.maturityStage]||0)+1;return acc;},{});
  lifecycle.summary={protocolCount:Object.keys(lifecycle.protocols).length,stageCounts:counts,automaticTransitionsRecorded:(lifecycle.transitions||[]).length};
  lifecycle.policyRevision=policy.revision||null;
  lifecycle.nextProtocolTemplate='Protocol sensors may be company-scoped or registry-wide. Reuse canonical sensors first; preserve identity, native-period, migration, accounting and causal boundaries independently.';
  return state;
}
