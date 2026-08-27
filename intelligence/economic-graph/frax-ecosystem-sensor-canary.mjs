#!/usr/bin/env node
/**
 * The Holding · Frax ecosystem sensor family deterministic canary v0.1
 *
 * Proves that deep Frax ecosystem context cannot manufacture a ninth lifecycle
 * protocol, promote Frax maturity, turn source readiness into measurement, or
 * gain causal/recommendation/execution authority.
 */
import { applyFraxEcosystemSensor, FRAX_ECOSYSTEM_EVIDENCE_ID } from './frax-ecosystem-sensor.mjs';

const FRAX_PROTOCOL_ID='registry-frax-vefrax';
const PROTOCOL_IDS=[
  'defitea-fxn-vefxn',
  'defitea-curve-vecrv',
  'defitea-aerodrome-veaero',
  'defitea-convex-vlcvx-votium',
  'defitea-pendle-spendle',
  'registry-yieldbasis-multimechanism',
  'registry-velodrome-vevelo',
  FRAX_PROTOCOL_ID
];

function fail(message){throw new Error(message);}
function clone(value){return JSON.parse(JSON.stringify(value));}
function protocol(id){return{
  protocolId:id,
  protocol:id===FRAX_PROTOCOL_ID?'Frax':id,
  mechanism:id===FRAX_PROTOCOL_ID?'FRAX / veFRAX governance productivity':'bounded-test-mechanism',
  maturityStage:id===FRAX_PROTOCOL_ID?'shadow':'verified',
  status:'test-fixture',
  authority:{executionAuthority:'none',causalClaimAuthority:'none',promotionAuthority:'none'}
};}

function fixture(){
  const protocols=Object.fromEntries(PROTOCOL_IDS.map(id=>[id,protocol(id)]));
  return {
    generatedAt:'2026-08-27T00:00:00.000Z',
    authority:{readOnly:true,executionAuthority:'none',causalClaimAuthority:'none'},
    protocolLifecycle:{
      version:'0.1-protocol-intelligence-lifecycle',
      summary:{protocolCount:8},
      protocols,
      authority:{executionAuthority:'none',causalClaimAuthority:'none'}
    },
    protocolSensors:{
      [FRAX_PROTOCOL_ID]:{
        version:'0.2-frax-native-period-gated-registry-sensor',
        latest:{observation:{
          observedAt:'2026-08-27T00:00:00.000Z',
          referenceProductivity:{currentAprPct:5.3704},
          registryExposure:{companyCount:3,positionCount:3},
          longitudinalEvidence:{canonicalSnapshotCount:2,validatedNativePeriodCount:0},
          identityBoundary:{currentCanonicalPrincipal:'FRAX',currentCanonicalVoteEscrowLabel:'veFRAX'},
          epistemic:{executionAuthority:'none'}
        }},
        authority:{executionAuthority:'none'}
      }
    }
  };
}

function assertState(state,label){
  const lifecycle=state.protocolLifecycle;
  const evidence=state.protocolEvidence?.[FRAX_ECOSYSTEM_EVIDENCE_ID];
  const observation=evidence?.latest?.observation;
  const frax=state.protocolSensors?.[FRAX_PROTOCOL_ID];
  if(Number(lifecycle?.summary?.protocolCount)!==8||Object.keys(lifecycle?.protocols??{}).length!==8)fail(`${label}: lifecycle count drift`);
  if(lifecycle?.protocols?.[FRAX_PROTOCOL_ID]?.maturityStage!=='shadow')fail(`${label}: Frax was promoted`);
  if(!evidence||!observation)fail(`${label}: Frax ecosystem evidence missing`);
  if(observation.version!=='0.1-frax-deep-ecosystem-sensor-family')fail(`${label}: version drift`);
  if(Number(observation.coverage?.surfaceCount)!==9)fail(`${label}: expected nine Frax surfaces`);
  if(Number(observation.coverage?.measuredSurfaceCount)!==1)fail(`${label}: source readiness became measurement`);
  if(Number(observation.coverage?.sourceBoundUnknownSurfaceCount)!==8)fail(`${label}: UNKNOWN surface count drift`);
  if(observation.epistemic?.currentMeasuredEconomicSurface!=='governance-vefrax')fail(`${label}: measured surface identity drift`);
  if(observation.surfaces?.governanceVeFrax?.measurementState!=='MEASURED-partial-current-governance-surface')fail(`${label}: governance surface lost measured state`);
  for(const [key,surface] of Object.entries(observation.surfaces??{})){
    if(key==='governanceVeFrax')continue;
    if(!String(surface?.measurementState||'').startsWith('UNKNOWN'))fail(`${label}: ${key} falsely measured`);
  }
  if(observation.epistemic?.revenueToVeFraxAprCausality!=='UNKNOWN')fail(`${label}: revenue→veFRAX causality leaked`);
  if(observation.epistemic?.treasuryYieldToSpecificFxPoolIncentive!=='UNKNOWN')fail(`${label}: Treasury→FX incentive causality leaked`);
  if(observation.epistemic?.legacyEthereumToFraxtalLockMigration!=='UNKNOWN')fail(`${label}: migration topology over-claimed`);
  if(observation.authority?.lifecyclePromotionAuthority!=='none'||observation.authority?.recommendationAuthority!==false||observation.authority?.causalClaimAuthority!=='none'||observation.authority?.executionAuthority!=='none')fail(`${label}: authority leaked`);
  if(frax?.ecosystemFamily?.surfaceCount!==9||frax?.ecosystemFamily?.measuredSurfaceCount!==1||frax?.ecosystemFamily?.sourceBoundUnknownSurfaceCount!==8)fail(`${label}: Frax sensor pointer drift`);
  return observation;
}

const first=fixture();
applyFraxEcosystemSensor({state:first,previousState:null});
const firstObservation=assertState(first,'first build');
if(first.protocolEvidence[FRAX_ECOSYSTEM_EVIDENCE_ID].observationCount!==1)fail('first build observation count must be one');

const second=clone(first);
applyFraxEcosystemSensor({state:second,previousState:first});
const secondObservation=assertState(second,'repeat build');
if(second.protocolEvidence[FRAX_ECOSYSTEM_EVIDENCE_ID].observationCount!==1)fail('repeat build manufactured duplicate longitudinal depth');
if(secondObservation.id!==firstObservation.id)fail('deterministic observation identity drift');

console.log('FRAX ECOSYSTEM SENSOR FAMILY CANARY PASS',{
  lifecycleProtocols:second.protocolLifecycle.summary.protocolCount,
  fraxStage:second.protocolLifecycle.protocols[FRAX_PROTOCOL_ID].maturityStage,
  ecosystemSurfaces:secondObservation.coverage.surfaceCount,
  measuredSurfaces:secondObservation.coverage.measuredSurfaceCount,
  sourceBoundUnknownSurfaces:secondObservation.coverage.sourceBoundUnknownSurfaceCount,
  observationCount:second.protocolEvidence[FRAX_ECOSYSTEM_EVIDENCE_ID].observationCount,
  revenueToVeFraxApr:secondObservation.epistemic.revenueToVeFraxAprCausality,
  treasuryToFxPoolIncentive:secondObservation.epistemic.treasuryYieldToSpecificFxPoolIncentive,
  executionAuthority:secondObservation.authority.executionAuthority
});
