#!/usr/bin/env node
/**
 * The Holding · Pendle / sPENDLE protocol lifecycle adapter v0.1
 *
 * Reuses the canonical Productivity pendle_spendle sensor. No second market
 * collector, writer or authority lane is created. This adapter summarizes the
 * already-collected API + official Merkle + onchain evidence into the Economic
 * Graph and appends Pendle to the existing Protocol Intelligence Lifecycle.
 *
 * Historical reward mapping is evidence of mechanism/accounting consistency,
 * not proof of why revenue, staking supply, buybacks or APR changed.
 */

import crypto from 'node:crypto';

export const PENDLE_PROTOCOL_ID='defitea-pendle-spendle';
export const PENDLE_SENSOR_VERSION='0.1-pendle-spendle-protocol-sensor';
const MAX_OBSERVATIONS=1000;
const MAX_TRANSITIONS=2000;
const OFFICIAL_API='https://api-v2.pendle.finance/core/v1/spendle/data';

function fail(message){throw new Error(message);}
function finite(value){return value!==null&&value!==undefined&&value!==''&&Number.isFinite(Number(value));}
function numberOrNull(value){return finite(value)?Number(value):null;}
function round(value,digits=8){const n=Number(value);return Number.isFinite(n)?Number(n.toFixed(digits)):null;}
function sha256Text(text){return crypto.createHash('sha256').update(text).digest('hex');}
function stageRank(order,stage){return order.indexOf(stage);}
function check(id,pass,stage,detail,evidenceClass='measured'){return{id,pass:Boolean(pass),stage,evidenceClass,detail};}
function findDefitea(productivity){
  const companies=productivity?.companies;
  if(!companies||typeof companies!=='object')fail('Pendle lifecycle requires Productivity companies map');
  if(companies['defitea.eth'])return companies['defitea.eth'];
  const rows=Object.entries(companies).filter(([key,value])=>String(key).toLowerCase().includes('defitea')||String(value?.name||'').toLowerCase().includes('defitea'));
  if(rows.length!==1)fail(`Pendle lifecycle expected one Defitea row, found ${rows.length}`);
  return rows[0][1];
}
function activeAttempt(engine){
  const details=engine?.details||{};
  return details?.currentAttempt&&typeof details.currentAttempt==='object'?details.currentAttempt:details;
}
function evidenceSummary(checks){return{
  total:checks.length,
  passed:checks.filter(x=>x.pass).length,
  failed:checks.filter(x=>!x.pass).length,
  canonicalAtoms:checks.filter(x=>x.pass&&x.stage==='canonical').length,
  verifiedAtoms:checks.filter(x=>x.pass&&x.stage==='verified').length,
  shadowAtoms:checks.filter(x=>x.pass&&x.stage==='shadow').length
};}
function stableObservationCore(observation){return{
  observedAt:observation.observedAt,
  periodStart:observation.referenceProductivity.periodStart,
  periodEnd:observation.referenceProductivity.periodEnd,
  status:observation.referenceProductivity.status,
  aprPct:observation.referenceProductivity.currentAprPct,
  selectionRule:observation.referenceProductivity.selectionRule,
  historyCount:observation.historicalMechanismEvidence.historyCount,
  campaignCount:observation.historicalMechanismEvidence.campaignCount,
  exactAmountMatches:observation.historicalMechanismEvidence.epochMap.exactAmountMatches,
  offsetSeconds:observation.historicalMechanismEvidence.epochMap.offsetSeconds,
  survivorReplicated:observation.historicalMechanismEvidence.survivorReplication.replicated,
  validCampaigns:observation.historicalMechanismEvidence.survivorReplication.validCampaigns,
  currentEffectiveSupply:observation.currentSupply.currentEffectiveSupply,
  productivitySha256:observation.provenance.productivitySha256
};}
function validatedPeriodKey(observation){
  const r=observation?.referenceProductivity;
  if(r?.currentPeriodValidated!==true||!finite(r?.currentAprPct))return null;
  if(!r?.periodStart||!r?.periodEnd)return null;
  return `${r.periodStart}::${r.periodEnd}`;
}

export function buildPendleProtocolObservation({productivity,productivitySha256}){
  if(!productivity||typeof productivity!=='object')fail('Pendle lifecycle requires Productivity state');
  if(!/^[0-9a-f]{64}$/i.test(String(productivitySha256||'')))fail('Pendle lifecycle Productivity SHA-256 missing');
  const engine=productivity?.engines?.pendle_spendle;
  if(!engine)fail('Canonical pendle_spendle Productivity engine missing');
  if(engine.protocol!=='Pendle'||engine.sourceUrl!==OFFICIAL_API||engine.nativeCadence!=='14d')fail('Pendle source identity/cadence drift');
  const company=findDefitea(productivity);
  const position=(company?.breakdown||[]).find(row=>row?.engineId==='pendle_spendle');
  if(!position||!(Number(position.units)>0))fail('Defitea PENDLE position missing or non-positive');

  const attempt=activeAttempt(engine);
  const research=attempt?.research||{};
  const epochMap=research?.epochMap||{};
  const replication=research?.survivorReplication||{};
  const currentSupply=attempt?.currentSupply||{};
  const currentApr=numberOrNull(engine.aprLatest);
  const publishedApiApr=numberOrNull(attempt?.publishedApr);
  const revenue=numberOrNull(attempt?.revenue);
  const mappedReward=numberOrNull(attempt?.mappedMerkleCampaign?.merkleReward);
  const positiveEconomicEvidence=Boolean((revenue!==null&&revenue>0)||(mappedReward!==null&&mappedReward>0));
  const zeroConflict=publishedApiApr===0&&positiveEconomicEvidence;
  const falseZeroBlocked=!zeroConflict||!(engine.status==='ok'&&currentApr===0);
  const selectionRule=attempt?.selectionRule||null;
  const currentPeriodValidated=Boolean(
    engine.status==='ok'&&currentApr!==null&&
    ['replicated-current-balance-survivor-cluster','genuine-zero-multi-source'].includes(selectionRule)
  );
  const observedAt=engine.lastUpdatedAt||engine.periodEnd||productivity.generatedAt;
  if(!Number.isFinite(Date.parse(observedAt)))fail('Pendle observation timestamp invalid');

  const observation={
    observedAt,
    company:{registry:'004',name:'defitea.eth'},
    protocol:'Pendle',
    mechanism:'sPENDLE staking / buyback distribution',
    asset:'PENDLE',
    companyPosition:{
      productiveUnitsPendle:round(position.units,10),
      productiveValueUsd:finite(position.value)?round(position.value,8):null,
      positionAprPct:finite(position.apr)?round(position.apr,6):null,
      engineStatus:position.engineStatus||engine.status||null,
      stateClass:'measured-current-company-position'
    },
    referenceProductivity:{
      status:engine.status||null,
      currentAprPct:currentApr===null?null:round(currentApr,6),
      sourceUrl:engine.sourceUrl,
      sourceType:engine.sourceType||null,
      sourceMetric:engine.sourceMetric||null,
      nativeCadence:engine.nativeCadence,
      periodStart:engine.periodStart||null,
      periodEnd:engine.periodEnd||null,
      publishedApiApr,
      revenue:revenue===null?null:round(revenue,8),
      buybackAmount:finite(attempt?.buybackAmount)?round(attempt.buybackAmount,8):null,
      selectionRule,
      mappedMerkleCampaign:attempt?.mappedMerkleCampaign||null,
      currentPeriodValidated,
      falseZeroBlocked,
      rule:'Published zero is never accepted as 0% when independent positive economic evidence conflicts with it. The canonical Productivity gate must prove the current period first.'
    },
    historicalMechanismEvidence:{
      historyCount:Number(attempt?.historyCount||0),
      campaignCount:Number(research?.campaignCount||0),
      epochMap:{
        pairCount:Number(epochMap?.pairCount||0),
        exactAmountMatches:Number(epochMap?.exactAmountMatches||0),
        offsetConsensus:epochMap?.offsetConsensus===true,
        offsetSeconds:numberOrNull(epochMap?.offsetSeconds),
        offsetDays:numberOrNull(epochMap?.offsetDays),
        maxOffsetDeviationSeconds:numberOrNull(epochMap?.maxOffsetDeviationSeconds)
      },
      survivorReplication:{
        replicated:replication?.replicated===true,
        validCampaigns:Number(replication?.validCampaigns||0),
        minRequiredCampaigns:Number(replication?.minRequiredCampaigns||0),
        minClusterSize:Number(replication?.minClusterSize||0),
        minClusterDensity:numberOrNull(replication?.minClusterDensity),
        maxSpreadBps:numberOrNull(replication?.maxSpreadBps),
        maxSupplyDeviationPct:numberOrNull(replication?.maxSupplyDeviationPct),
        observedSupplyMedian:numberOrNull(replication?.observedSupplyMedian),
        observedMaxSupplyDeviationPct:numberOrNull(replication?.observedMaxSupplyDeviationPct),
        supplyConsistencyOk:replication?.supplyConsistencyOk===true
      },
      rewardScope:research?.rewardScope||null,
      denominatorPolicy:research?.denominatorPolicy||null
    },
    currentSupply:{
      observedAt:numberOrNull(currentSupply?.observedAt),
      periodEnd:currentSupply?.periodEnd||null,
      totalPendleStaked:numberOrNull(currentSupply?.totalPendleStaked),
      totalStakedInSpendle:numberOrNull(currentSupply?.totalStakedInSpendle),
      virtualSpendleFromVependle:numberOrNull(currentSupply?.virtualSpendleFromVependle),
      currentEffectiveSupply:numberOrNull(currentSupply?.currentEffectiveSupply)
    },
    provenance:{
      productivityFile:'companies/productivity-data.json',
      productivityGeneratedAt:productivity.generatedAt||null,
      productivitySha256
    },
    epistemic:{
      observationClass:'shadow-protocol-economic-sensor',
      historicalRewardAccounting:'multi-source-consistency-evidence',
      currentReferenceApr:currentPeriodValidated?'validated-current-period':'warming-not-yet-promoted',
      causalAttribution:'unresolved-beyond-proven-accounting-links',
      primaryDriver:null,
      predictionAuthority:'none',
      recommendationAuthority:'none',
      promotionAuthority:'deterministic-evidence-gates-only',
      executionAuthority:'none'
    }
  };
  observation.id=`pendle-spendle:${String(observedAt).slice(0,10)}:${sha256Text(JSON.stringify(stableObservationCore(observation))).slice(0,20)}`;
  return observation;
}

function buildMovement(current,prior){return{
  priorObservationId:prior?.id||null,
  elapsedHours:prior?round((Date.parse(current.observedAt)-Date.parse(prior.observedAt))/36e5,6):null,
  currentAprDeltaPctPoints:prior&&finite(current.referenceProductivity.currentAprPct)&&finite(prior.referenceProductivity?.currentAprPct)?round(Number(current.referenceProductivity.currentAprPct)-Number(prior.referenceProductivity.currentAprPct),6):null,
  effectiveSupplyDelta:prior&&finite(current.currentSupply.currentEffectiveSupply)&&finite(prior.currentSupply?.currentEffectiveSupply)?round(Number(current.currentSupply.currentEffectiveSupply)-Number(prior.currentSupply.currentEffectiveSupply),8):null,
  comparable:Boolean(prior),
  note:'Like-for-like protocol observations only. No revenue→buyback→APR causal delta is inferred.'
};}

export function applyPendleSPendleLifecycle({state,previousState,productivity,productivitySha256,policy}){
  if(!state||typeof state!=='object')fail('Pendle lifecycle requires Economic Graph state');
  if(state?.authority?.executionAuthority!=='none'||state?.authority?.causalClaimAuthority!=='none')fail('Pendle lifecycle refuses Economic Graph authority drift');
  if(!state?.protocolLifecycle||state.protocolLifecycle.authority?.executionAuthority!=='none')fail('Base Protocol Lifecycle must run before Pendle adapter');
  const p=policy?.protocols?.[PENDLE_PROTOCOL_ID];
  if(!p)fail('Pendle lifecycle policy missing');
  const current=buildPendleProtocolObservation({productivity,productivitySha256});
  const previousRows=Array.isArray(previousState?.protocolSensors?.[PENDLE_PROTOCOL_ID]?.observations)?previousState.protocolSensors[PENDLE_PROTOCOL_ID].observations:[];
  const rows=[...previousRows];
  if(!rows.some(x=>x?.id===current.id))rows.push(current);
  const observations=rows.slice(-MAX_OBSERVATIONS);
  const latest=observations.at(-1);
  const prior=[...observations].reverse().find(x=>x?.id!==latest?.id)||null;

  const h=latest.historicalMechanismEvidence;
  const r=latest.referenceProductivity;
  const s=latest.currentSupply;
  const historicalMapping=Boolean(h.campaignCount>=3&&h.epochMap.offsetConsensus&&h.epochMap.exactAmountMatches>=3);
  const replicatedDenominator=Boolean(h.survivorReplication.replicated&&h.survivorReplication.validCampaigns>=Math.max(2,h.survivorReplication.minRequiredCampaigns||2)&&h.survivorReplication.supplyConsistencyOk);
  const supplyMeasured=Boolean(finite(s.currentEffectiveSupply)&&Number(s.currentEffectiveSupply)>0&&finite(s.totalStakedInSpendle)&&Number(s.totalStakedInSpendle)>0);
  const validatedObservations=observations.filter(x=>validatedPeriodKey(x)!==null);
  const validatedObservationCount=validatedObservations.length;
  const validatedPeriodKeys=[...new Set(validatedObservations.map(validatedPeriodKey))];
  const validatedPeriodCount=validatedPeriodKeys.length;
  const requiredValidatedPeriodCount=Number(p.verifiedMinimumValidatedPeriodCount||p.verifiedMinimumValidatedObservationCount||2);

  const checks=[
    check('sensor-materialized',true,'shadow','Pendle protocol sensor is materialized from canonical Productivity.','sensor-state'),
    check('company-position-measured',latest.companyPosition.stateClass==='measured-current-company-position'&&Number(latest.companyPosition.productiveUnitsPendle)>0,'shadow','Defitea PENDLE productive position is measured.','company-state'),
    check('official-api-bound',r.sourceUrl===OFFICIAL_API&&r.nativeCadence==='14d','shadow','Canonical sPENDLE official API and native 14-day cadence remain bound.','source-provenance'),
    check('historical-reward-calendar-mapped',historicalMapping,'verified','Official API buyback amounts map to official Merkle campaigns across multiple epochs with stable calendar offset.','cross-source-accounting'),
    check('onchain-survivor-denominator-replicated',replicatedDenominator,'verified','Onchain current-balance survivor reconstruction replicates across independent historical campaigns.','onchain-replication'),
    check('false-zero-fail-closed',r.falseZeroBlocked===true,'verified','Conflicting positive economic evidence cannot silently become a 0% Reference APR.','epistemic-safety'),
    check('current-supply-measured',supplyMeasured,'verified','Current direct + virtual sPENDLE effective supply context is measured.','onchain-state'),
    check('current-reference-apr-validated',r.currentPeriodValidated===true&&finite(r.currentAprPct),'verified','Latest completed sPENDLE period has passed the canonical current-period Reference APR gate.','current-period-validation'),
    check('validated-longitudinal-depth',validatedPeriodCount>=requiredValidatedPeriodCount,'verified',`At least ${requiredValidatedPeriodCount} distinct validated 14-day sPENDLE periods are retained; repeated snapshots of one period count once.`,'longitudinal-period'),
    check('revenue-buyback-distribution-identity',false,'canonical','Protocol revenue → buyback → sPENDLE distribution identity is not yet promoted as a complete canonical accounting chain.','mechanism-proof')
  ];
  const verifiedIds=['sensor-materialized','company-position-measured','official-api-bound','historical-reward-calendar-mapped','onchain-survivor-denominator-replicated','false-zero-fail-closed','current-supply-measured','current-reference-apr-validated','validated-longitudinal-depth'];
  const verifiedGate=verifiedIds.every(id=>checks.find(x=>x.id===id)?.pass);
  const canonicalGate=verifiedGate&&checks.find(x=>x.id==='revenue-buyback-distribution-identity')?.pass;
  const stage=canonicalGate?'canonical':(verifiedGate?'verified':'shadow');
  const priorLifecycle=previousState?.protocolLifecycle?.protocols?.[PENDLE_PROTOCOL_ID]||null;
  const priorStage=priorLifecycle?.maturityStage||null;
  const order=policy.stageOrder||['discovery','shadow','verified','canonical'];
  const basis=checks.map(x=>[x.id,x.pass,x.stage]);
  const changed=priorStage!==null&&priorStage!==stage;
  const fingerprint=changed?sha256Text(JSON.stringify({protocolId:PENDLE_PROTOCOL_ID,from:priorStage,to:stage,basis})):null;

  const protocol={
    protocolId:PENDLE_PROTOCOL_ID,
    label:p.label,
    maturityStage:stage,
    operatingMode:stage==='canonical'?'continuous-monitoring':'shadow-monitoring',
    automaticallyEvaluated:true,
    automaticallyPromoted:priorStage!==null&&stageRank(order,stage)>stageRank(order,priorStage),
    automaticallyRegressed:priorStage!==null&&stageRank(order,stage)<stageRank(order,priorStage),
    evidence:evidenceSummary(checks),
    longitudinalEvidence:{
      validatedObservationCount,
      validatedPeriodCount,
      requiredValidatedPeriodCount,
      validatedPeriodKeys
    },
    checks,
    blockers:stage==='canonical'?[]:checks.filter(x=>!x.pass).map(x=>x.id),
    unknowns:[
      'latest sPENDLE Reference APR remains UNKNOWN until the current period passes the canonical validation gate when upstream evidence conflicts',
      'why protocol revenue, staking participation and buyback/distribution amounts change remains UNKNOWN beyond proven accounting links',
      'in-kind point airdrops remain outside Reference APR until independently normalizable'
    ],
    epistemicBoundary:'Historical reward mapping and replicated denominator evidence do not by themselves prove current APR or upstream causality. Repeated observations of one validated period do not constitute longitudinal depth.',
    priorMaturityStage:priorStage,
    transitionFingerprint:fingerprint
  };

  state.protocolSensors={
    ...(state.protocolSensors||{}),
    [PENDLE_PROTOCOL_ID]:{
      version:PENDLE_SENSOR_VERSION,
      status:'shadow-observation-active',
      identity:{companyRegistry:'004',company:'defitea.eth',protocol:'Pendle',mechanism:'sPENDLE staking / buyback distribution',asset:'PENDLE'},
      latest:{observation:latest,movement:buildMovement(latest,prior)},
      observationCount:observations.length,
      validatedObservationCount,
      validatedPeriodCount,
      validatedPeriodKeys,
      observations,
      authority:{executionAuthority:'none',causalClaimAuthority:'none',recommendationAuthority:'none',predictionAuthority:'none'}
    }
  };

  const lifecycle=state.protocolLifecycle;
  lifecycle.protocols={...(lifecycle.protocols||{}),[PENDLE_PROTOCOL_ID]:protocol};
  if(fingerprint&&!lifecycle.transitions?.some(x=>x?.fingerprint===fingerprint)){
    lifecycle.transitions=[...(lifecycle.transitions||[]),{
      fingerprint,protocolId:PENDLE_PROTOCOL_ID,from:priorStage,to:stage,
      observedAt:state.generatedAt||new Date().toISOString(),automatic:true,
      reason:'deterministic-pre-approved-evidence-gate'
    }].slice(-MAX_TRANSITIONS);
  }
  const counts=Object.values(lifecycle.protocols).reduce((acc,row)=>{acc[row.maturityStage]=(acc[row.maturityStage]||0)+1;return acc;},{});
  lifecycle.summary={protocolCount:Object.keys(lifecycle.protocols).length,stageCounts:counts,automaticTransitionsRecorded:(lifecycle.transitions||[]).length};
  lifecycle.nextProtocolTemplate='New protocols reuse canonical sensors first, then enter the same evidence lifecycle; add only true mechanism deltas.';
  lifecycle.policyRevision=policy.revision||null;
  return state;
}
