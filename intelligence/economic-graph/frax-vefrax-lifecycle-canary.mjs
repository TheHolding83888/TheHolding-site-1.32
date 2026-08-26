#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import { applyFraxLifecycle, FRAX_PROTOCOL_ID } from './frax-vefrax-lifecycle.mjs';

function assert(condition,message){if(!condition)throw new Error(message);}
function clone(value){return JSON.parse(JSON.stringify(value));}
function sha256(value){return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');}

const policy=JSON.parse(fs.readFileSync(new URL('./protocol-lifecycle-policy.json',import.meta.url),'utf8'));

function baseState(){
  const protocols={
    'defitea-fxn-vefxn':{maturityStage:'canonical'},
    'defitea-curve-vecrv':{maturityStage:'canonical'},
    'defitea-aerodrome-veaero':{maturityStage:'verified'},
    'defitea-convex-vlcvx-votium':{maturityStage:'verified'},
    'defitea-pendle-spendle':{maturityStage:'verified'},
    'registry-yieldbasis-multimechanism':{maturityStage:'verified'},
    'registry-velodrome-vevelo':{maturityStage:'verified'}
  };
  return {
    generatedAt:'2026-08-26T06:08:02.250Z',
    authority:{executionAuthority:'none',causalClaimAuthority:'none'},
    protocolLifecycle:{
      version:'0.1-protocol-intelligence-lifecycle',
      policyVersion:'0.1-protocol-intelligence-lifecycle-policy',
      policyRevision:'0.5-registry-wide-velodrome-ve-gauge-admission',
      authority:{executionAuthority:'none',repositoryMutationAuthority:false,workflowDispatchAuthority:false,causalClaimAuthority:'none'},
      protocols,
      transitions:[],
      summary:{protocolCount:7,stageCounts:{canonical:2,verified:5},automaticTransitionsRecorded:0}
    },
    protocolSensors:{}
  };
}

function productivity({snapshotKey='2026-W35',historyKeys=['2026-W34','2026-W35'],apr=5.3704,nativePeriodsBySnapshot={}}={}){
  const generatedAt='2026-08-26T06:07:04.958Z';
  const historyApr={
    '2026-W32':5.3265,
    '2026-W33':5.3384,
    '2026-W34':5.3618,
    '2026-W35':apr,
    '2026-W36':5.4021
  };
  return {
    version:'1.16',
    snapshotKey,
    generatedAt,
    engines:{
      frax_vefrax:{
        engineId:'frax_vefrax',protocol:'Frax',principalSymbol:'FRAX',
        sourceUrl:'https://app.frax.finance/fxtl-vefxs',nativeCadence:'epoch',
        aprLatest:apr,sourceType:'official-api',sourceMetric:'Fraxtal veFRAX/veFXS APR',
        source:'https://api.frax.finance/combineddata/',periodStart:null,periodEnd:generatedAt,lastUpdatedAt:generatedAt,status:'ok',
        details:{path:'core.vefxs.apr'}
      }
    },
    companies:{
      'company-a':{name:'Company A',breakdown:[{engineId:'frax_vefrax',principalId:'frax-share',units:4224,value:1259.36,apr,engineStatus:'ok'}]},
      'company-b':{name:'Company B',breakdown:[{engineId:'frax_vefrax',principalId:'frax-share',units:800,value:238.51,apr,engineStatus:'ok'}]},
      'company-c':{name:'Company C',breakdown:[{engineId:'frax_vefrax',principalId:'frax-share',units:393,value:117.17,apr,engineStatus:'ok'}]}
    },
    history:{engines:{frax_vefrax:historyKeys.map(key=>{
      const native=nativePeriodsBySnapshot[key]||{};
      return {
        snapshotKey:key,
        apr:historyApr[key]??apr,
        sourceType:'official-api',
        nativePeriodId:native.nativePeriodId||null,
        periodStart:native.periodStart||null,
        periodEnd:native.periodEnd||null
      };
    })}}
  };
}

assert(policy.scope.registryWideProtocolIds.includes(FRAX_PROTOCOL_ID),'Policy does not admit Frax as registry-wide protocol');
assert(policy.scope.protocolIds.includes(FRAX_PROTOCOL_ID),'Policy protocolIds missing Frax');
assert(policy.authority.executionAuthority==='none','Policy execution authority regressed');
assert(policy.laws.longitudinalDepthRequiresDistinctNativePeriods===true,'Global native-period lifecycle law missing');
assert(policy.laws.nativePeriodLabelsAloneDoNotCreateDepth===true,'Native-period label safety law missing');
assert(policy.laws.brandingChangeDoesNotProveMigrationCompletion===true,'Frax branding/migration law missing');
assert(policy.laws.legacyApiSchemaDoesNotDefineCurrentTokenIdentity===true,'Frax legacy API identity law missing');
assert(Number(policy.protocols?.[FRAX_PROTOCOL_ID]?.verifiedMinimumDistinctNativePeriodCount)===2,'Frax native-period verification minimum drift');

const baseline=baseState();
const weeklySnapshots=productivity({historyKeys:['2026-W32','2026-W33','2026-W34','2026-W35']});
const weeklyOnly=applyFraxLifecycle({
  state:clone(baseline),
  previousState:clone(baseline),
  productivity:weeklySnapshots,
  productivitySha256:sha256(weeklySnapshots),
  policy
});
const weeklyProtocol=weeklyOnly.protocolLifecycle.protocols[FRAX_PROTOCOL_ID];
const weeklySensor=weeklyOnly.protocolSensors[FRAX_PROTOCOL_ID];
assert(weeklyProtocol.maturityStage==='shadow',`Weekly Productivity snapshots without native Frax periods must remain SHADOW, got ${weeklyProtocol.maturityStage}`);
assert(weeklyProtocol.blockers.includes('distinct-native-frax-period-depth'),'Native Frax period blocker missing');
assert(weeklySensor.canonicalSnapshotCount===4,'Canonical Frax snapshot support depth mismatch');
assert(weeklySensor.validatedNativePeriodCount===0,'Weekly snapshots falsely manufactured native Frax periods');
assert(weeklyOnly.protocolLifecycle.summary.protocolCount===8,'Frax SHADOW materialization must make protocolCount 8');

const labelsOnlyProductivity=productivity({
  historyKeys:['2026-W34','2026-W35'],
  nativePeriodsBySnapshot:{
    '2026-W34':{nativePeriodId:'frax-epoch-a'},
    '2026-W35':{nativePeriodId:'frax-epoch-b'}
  }
});
const labelsOnly=applyFraxLifecycle({
  state:clone(baseline),
  previousState:clone(weeklyOnly),
  productivity:labelsOnlyProductivity,
  productivitySha256:sha256(labelsOnlyProductivity),
  policy
});
assert(labelsOnly.protocolSensors[FRAX_PROTOCOL_ID].validatedNativePeriodCount===0,'Native period labels without reproducible boundaries manufactured depth');
assert(labelsOnly.protocolLifecycle.protocols[FRAX_PROTOCOL_ID].maturityStage==='shadow','Native period labels without boundaries falsely promoted Frax');

const sameNativePeriod=productivity({
  historyKeys:['2026-W34','2026-W35'],
  nativePeriodsBySnapshot:{
    '2026-W34':{periodStart:'2026-08-01T00:00:00.000Z',periodEnd:'2026-08-15T00:00:00.000Z'},
    '2026-W35':{periodStart:'2026-08-01T00:00:00.000Z',periodEnd:'2026-08-15T00:00:00.000Z'}
  }
});
const repeatedNative=applyFraxLifecycle({
  state:clone(baseline),
  previousState:clone(labelsOnly),
  productivity:sameNativePeriod,
  productivitySha256:sha256(sameNativePeriod),
  policy
});
const repeatedProtocol=repeatedNative.protocolLifecycle.protocols[FRAX_PROTOCOL_ID];
const repeatedSensor=repeatedNative.protocolSensors[FRAX_PROTOCOL_ID];
assert(repeatedSensor.validatedNativePeriodCount===1,'Repeated snapshots of one Frax native period must count once');
assert(repeatedProtocol.maturityStage==='shadow','One distinct Frax native period must remain SHADOW');
assert(repeatedProtocol.blockers.includes('distinct-native-frax-period-depth'),'One-period SHADOW blocker missing');

const twoNativePeriods=productivity({
  historyKeys:['2026-W34','2026-W35'],
  nativePeriodsBySnapshot:{
    '2026-W34':{nativePeriodId:'frax-epoch-a',periodStart:'2026-08-01T00:00:00.000Z',periodEnd:'2026-08-15T00:00:00.000Z'},
    '2026-W35':{nativePeriodId:'frax-epoch-b',periodStart:'2026-08-15T00:00:00.000Z',periodEnd:'2026-08-29T00:00:00.000Z'}
  }
});
const verified=applyFraxLifecycle({
  state:clone(baseline),
  previousState:clone(repeatedNative),
  productivity:twoNativePeriods,
  productivitySha256:sha256(twoNativePeriods),
  policy
});
const frax=verified.protocolLifecycle.protocols[FRAX_PROTOCOL_ID];
const sensor=verified.protocolSensors[FRAX_PROTOCOL_ID];
assert(frax.maturityStage==='verified',`Two distinct explicit Frax native periods must produce VERIFIED, got ${frax.maturityStage}`);
assert(frax.operatingMode==='shadow-monitoring','Verified Frax must stay shadow-monitoring');
assert(verified.protocolLifecycle.summary.protocolCount===8,'Frax must be protocol lifecycle sensor #8');
assert(sensor.latest.observation.referenceProductivity.currentAprPct===5.3704,'Frax current APR mismatch');
assert(sensor.latest.observation.registryExposure.companyCount===3,'Frax registry exposure breadth mismatch');
assert(sensor.latest.observation.registryExposure.positionCount===3,'Frax registry position count mismatch');
assert(sensor.canonicalSnapshotCount===2,'Frax canonical snapshot count mismatch');
assert(sensor.validatedNativePeriodCount===2,'Frax distinct native period count mismatch');
assert(sensor.latest.observation.longitudinalEvidence.currentAprParityOk===true,'Frax current/history APR parity missing');
assert(sensor.latest.observation.identityBoundary.currentCanonicalPrincipal==='FRAX','Current Frax principal identity drift');
assert(sensor.latest.observation.identityBoundary.currentCanonicalVoteEscrowLabel==='veFRAX','Current veFRAX identity drift');
assert(sensor.latest.observation.identityBoundary.legacyOfficialApiField==='core.vefxs.apr','Legacy official API field evidence missing');
assert(sensor.latest.observation.identityBoundary.ethereumToFraxtalLockMigrationState.startsWith('UNKNOWN'),'Migration state was over-claimed');
assert(sensor.latest.observation.identityBoundary.legacyGaugeSunsetState.startsWith('UNKNOWN'),'Legacy gauge sunset was over-claimed');
assert(sensor.latest.observation.identityBoundary.revenueShareDistributionState.startsWith('UNKNOWN'),'Revenue-share state was over-claimed');
assert(sensor.latest.observation.epistemic.revenueToVeFraxAprCausality.startsWith('UNKNOWN'),'Revenue/APR causality was over-claimed');
assert(frax.blockers.includes('ethereum-fraxtal-lock-topology-reconciled'),'Canonical migration-topology blocker missing');
assert(frax.blockers.includes('frax-revenue-to-vefrax-apr-accounting-identity'),'Canonical revenue accounting blocker missing');
assert(sensor.authority.executionAuthority==='none','Frax sensor execution authority regressed');
assert(verified.protocolLifecycle.authority.executionAuthority==='none','Lifecycle execution authority regressed');
for(const [id,row] of Object.entries(baseline.protocolLifecycle.protocols)){
  assert(verified.protocolLifecycle.protocols[id]?.maturityStage===row.maturityStage,`Existing lifecycle stage changed for ${id}`);
}

const wrongApiPath=productivity();
wrongApiPath.engines.frax_vefrax.details.path='core.vefrax.apr';
let failClosed=false;
try{
  applyFraxLifecycle({state:clone(baseline),previousState:clone(baseline),productivity:wrongApiPath,productivitySha256:sha256(wrongApiPath),policy});
}catch(error){failClosed=String(error?.message||error).includes('official API field drift');}
assert(failClosed,'Frax lifecycle must fail closed on unreviewed official API field drift');

const wrongCadence=productivity();
wrongCadence.engines.frax_vefrax.nativeCadence='weekly';
let cadenceFailClosed=false;
try{
  applyFraxLifecycle({state:clone(baseline),previousState:clone(baseline),productivity:wrongCadence,productivitySha256:sha256(wrongCadence),policy});
}catch(error){cadenceFailClosed=String(error?.message||error).includes('native cadence drift');}
assert(cadenceFailClosed,'Frax lifecycle must fail closed on native cadence drift');

console.log('FRAX veFRAX LIFECYCLE CANARY PASS',{
  protocolId:FRAX_PROTOCOL_ID,
  productionLikeStage:weeklyProtocol.maturityStage,
  syntheticNativeProofStage:frax.maturityStage,
  protocolCount:weeklyOnly.protocolLifecycle.summary.protocolCount,
  currentAprPct:weeklySensor.latest.observation.referenceProductivity.currentAprPct,
  companyCount:weeklySensor.latest.observation.registryExposure.companyCount,
  canonicalSnapshotCount:weeklySensor.canonicalSnapshotCount,
  validatedNativePeriodCount:weeklySensor.validatedNativePeriodCount,
  legacyApiField:weeklySensor.latest.observation.identityBoundary.legacyOfficialApiField,
  migrationState:weeklySensor.latest.observation.identityBoundary.ethereumToFraxtalLockMigrationState,
  executionAuthority:weeklySensor.authority.executionAuthority
});
