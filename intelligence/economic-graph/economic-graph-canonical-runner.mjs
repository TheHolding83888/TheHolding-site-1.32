#!/usr/bin/env node
/**
 * The Holding · Economic Graph canonical runner v0.2
 *
 * Production Graph builds consume the f(x) economic snapshot materialized
 * inside canonical Productivity. They do not re-probe the browser between the
 * Productivity publication and downstream Graph publication.
 *
 * The canonical f(x) + Curve surface remains unchanged while bounded protocol
 * candidates/sensors may be attached before downstream promotion. Protocol
 * Intelligence Lifecycle evaluates those existing evidence surfaces
 * deterministically without adding a collector, writer or execution authority.
 * No execution, recommendation, allocation or methodology-mutation authority.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { buildEconomicGraph } from './economic-graph.mjs';
import { applyAerodromeCandidate } from './aerodrome-veaero-candidate.mjs';
import { applyVlCvxVotiumCandidate } from './vlcvx-votium-candidate.mjs';
import { applyVlCvxVotiumDeepEvidence } from './vlcvx-votium-deep-evidence.mjs';
import { applyProtocolLifecycle } from './protocol-lifecycle.mjs';
import { applyPendleSPendleLifecycle } from './pendle-spendle-lifecycle.mjs';
import { applyPendleAccountingEvidence } from './pendle-spendle-accounting-evidence.mjs';
import { applyYieldBasisLifecycle } from './yieldbasis-lifecycle.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const OUT=process.env.ECONOMIC_GRAPH_FILE || path.join(ROOT,'intelligence/economic-graph/economic-graph.json');
const PRODUCTIVITY=process.env.PRODUCTIVITY_DATA_FILE || path.join(ROOT,'companies/productivity-data.json');
const REWARDS=process.env.REWARDS_DATA_FILE || path.join(ROOT,'companies/rewards-data.json');
const PRODUCTIVITY_ENGINE=path.join(ROOT,'productivity/productivity-engine.mjs');
const PROTOCOL_LIFECYCLE_POLICY=path.join(ROOT,'intelligence/economic-graph/protocol-lifecycle-policy.json');
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

export function buildCanonicalEconomicGraph({productivity,rewards,previousState,sourceSha256,rewardsSha256,productivityEngineSha256}){
  const snapshot=canonicalFxnSnapshotFromProductivity(productivity);
  const base=buildEconomicGraph({
    productivity,
    previousState,
    snapshot,
    sourceSha256,
    productivityEngineSha256
  });
  const withAerodrome=applyAerodromeCandidate({
    state:base,
    previousState,
    productivity,
    rewards,
    productivitySha256:sourceSha256,
    rewardsSha256
  });
  const withVlCvx=applyVlCvxVotiumCandidate({
    state:withAerodrome,
    previousState,
    productivity,
    rewards,
    productivitySha256:sourceSha256,
    rewardsSha256
  });
  const withDeepEvidence=applyVlCvxVotiumDeepEvidence({state:withVlCvx,root:ROOT});
  const withLifecycle=applyProtocolLifecycle({state:withDeepEvidence,previousState,root:ROOT});
  const policy=readJson(PROTOCOL_LIFECYCLE_POLICY);
  const withPendle=applyPendleSPendleLifecycle({
    state:withLifecycle,
    previousState,
    productivity,
    productivitySha256:sourceSha256,
    policy
  });
  const withPendleAccounting=applyPendleAccountingEvidence({state:withPendle,productivity,productivitySha256:sourceSha256});
  return applyYieldBasisLifecycle({
    state:withPendleAccounting,
    previousState,
    productivity,
    productivitySha256:sourceSha256,
    policy
  });
}

async function main(){
  const productivity=readJson(PRODUCTIVITY);
  const rewards=readJson(REWARDS);
  const previousState=readJson(OUT,false);
  const state=buildCanonicalEconomicGraph({
    productivity,
    rewards,
    previousState,
    sourceSha256:sha256File(PRODUCTIVITY),
    rewardsSha256:sha256File(REWARDS),
    productivityEngineSha256:sha256File(PRODUCTIVITY_ENGINE)
  });
  fs.mkdirSync(path.dirname(OUT),{recursive:true});
  fs.writeFileSync(OUT,JSON.stringify(state,null,2)+'\n');
  const fxn=state.cohorts?.['defitea-fxn-vefxn']?.latest?.observation;
  const curve=state.cohorts?.['defitea-curve-vecrv']?.latest?.observation;
  const aero=state.candidateCohorts?.['defitea-aerodrome-veaero']?.latest?.observation;
  const vlcvx=state.candidateCohorts?.['defitea-convex-vlcvx-votium']?.latest?.observation;
  const vlcvxDeep=state.candidateCohorts?.['defitea-convex-vlcvx-votium']?.deepEconomicEvidence;
  const pendle=state.protocolSensors?.['defitea-pendle-spendle']?.latest?.observation;
  const pendleAccounting=state.protocolEvidence?.['defitea-pendle-spendle-accounting'];
  const yieldBasis=state.protocolSensors?.['registry-yieldbasis-multimechanism']?.latest?.observation;
  const yieldBasisLifecycle=state.protocolLifecycle?.protocols?.['registry-yieldbasis-multimechanism'];
  const lifecycle=state.protocolLifecycle;
  console.log('ECONOMIC GRAPH canonical + lifecycle candidates PASS',{
    engineVersion:state.engineVersion,
    canonicalCohortCount:state.coverage?.cohortCount,
    candidateCount:state.candidateLayer?.candidateCount,
    fxnObservedAt:fxn?.observedAt,
    fxnAprPct:fxn?.liveObservedAprPct,
    fxnAprParityDeltaPctPoints:fxn?.aprParityDeltaPctPoints,
    curveAprPct:curve?.canonicalProductivityAprPct,
    curveFormulaParityDeltaPctPoints:curve?.formulaParityDeltaPctPoints,
    aerodromeReferenceAprPct:aero?.referenceProductivity?.canonicalAprPct,
    aerodromeFormulaParityDeltaPctPoints:aero?.referenceProductivity?.formula?.parityDeltaPctPoints,
    aerodromeManagedAccruedAero:aero?.actualManagedVeNft?.currentAccruedAero,
    vlCvxReferenceAprPct:vlcvx?.referenceProductivity?.canonicalAprPct,
    vlCvxVotiumAprPct:vlcvx?.referenceProductivity?.components?.votiumLastCompletedRoundAprPct,
    vlCvxLiveBalance:vlcvx?.companyRoute?.liveVlCvxBalance,
    vlCvxRoute:vlcvx?.companyRoute?.routeId,
    vlCvxCurveExecutedGaugeRows:vlcvxDeep?.coverage?.curveExecutedVotiumGaugeRows,
    vlCvxCurrentPoolContexts:vlcvxDeep?.coverage?.currentCurvePoolContextsComplete,
    vlCvxCausalAuthority:vlcvxDeep?.authority?.causalClaimAuthority,
    pendleCurrentAprPct:pendle?.referenceProductivity?.currentAprPct,
    pendleCurrentStatus:pendle?.referenceProductivity?.status,
    pendleHistoricalCampaigns:pendle?.historicalMechanismEvidence?.campaignCount,
    pendleSurvivorReplicated:pendle?.historicalMechanismEvidence?.survivorReplication?.replicated,
    pendleAccountingStatus:pendleAccounting?.status,
    pendleAccountingMatches:pendleAccounting?.coverage?.amountMatches,
    pendleAccountingMappedCampaigns:pendleAccounting?.coverage?.mappedCampaigns,
    yieldBasisVeYbAprPct:yieldBasis?.mechanisms?.veYB?.currentAprPct,
    yieldBasisYbWbtcAprPct:yieldBasis?.mechanisms?.ybWbtc?.currentAprPct,
    yieldBasisYbWethAprPct:yieldBasis?.mechanisms?.ybWeth?.currentAprPct,
    yieldBasisCompanyCount:yieldBasis?.registryExposure?.companyCount,
    yieldBasisPositionCount:yieldBasis?.registryExposure?.positionCount,
    yieldBasisStage:yieldBasisLifecycle?.maturityStage,
    yieldBasisValidatedSnapshots:yieldBasisLifecycle?.longitudinalEvidence?.validatedSnapshotCount,
    lifecycleStages:Object.fromEntries(Object.entries(lifecycle?.protocols||{}).map(([id,p])=>[id,p.maturityStage])),
    lifecycleTransitions:lifecycle?.transitions?.length,
    promotionAuthority:state.candidateLayer?.promotionAuthority,
    executionAuthority:state.authority?.executionAuthority
  });
}

if(path.resolve(process.argv[1]||'')===fileURLToPath(import.meta.url)){
  main().catch(error=>{console.error(error?.stack||error);process.exit(1);});
}
