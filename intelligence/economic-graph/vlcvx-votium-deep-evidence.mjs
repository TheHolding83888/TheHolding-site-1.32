#!/usr/bin/env node
/**
 * The Holding · vlCVX / Votium → Curve deep evidence integration v0.1
 *
 * This helper does not collect or promote anything. It binds already materialized,
 * production-proven shadow artifacts into the existing vlCVX/Votium Economic Graph
 * candidate and removes only gaps that those exact artifacts have actually closed.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const VLCVX_DEEP_EVIDENCE_VERSION='0.1-vlcvx-votium-curve-cognitive-close';
const CANDIDATE_ID='defitea-convex-vlcvx-votium';
const COMPANY_REGISTRY='004';
const FILES={
  roundFlow:'intelligence/economic-graph/vlcvx-votium-round-flow.json',
  votingProof:'intelligence/economic-graph/vlcvx-votium-snapshot-proof.json',
  gaugeFlow:'intelligence/economic-graph/vlcvx-votium-curve-gauge-flow.json',
  poolContext:'intelligence/economic-graph/vlcvx-votium-curve-pool-context.json'
};

function fail(message){throw new Error(message);}
function sha256(bytes){return crypto.createHash('sha256').update(bytes).digest('hex');}
function load(root,rel){
  const abs=path.join(root,rel);
  const bytes=fs.readFileSync(abs);
  return {file:rel,sha256:sha256(bytes),json:JSON.parse(bytes.toString('utf8'))};
}
function requireAuthority(x,label){
  if(x?.authority?.readOnly!==true||x?.authority?.executionAuthority!=='none')fail(`${label} authority drift`);
  for(const key of ['capitalExecution','walletAuthority','allocationAuthority','recommendationAuthority','predictionAuthority']){
    if(x?.authority?.[key]!==false)fail(`${label} ${key} authority drift`);
  }
  if(x?.authority?.causalClaimAuthority!=='none'||x?.authority?.promotionAuthority!=='none')fail(`${label} causal/promotion authority drift`);
}
function requireIdentity(x,label){
  if(x?.sourceBinding?.candidateId!==CANDIDATE_ID)fail(`${label} candidate identity drift`);
  if(String(x?.sourceBinding?.companyRegistry)!==COMPANY_REGISTRY)fail(`${label} company identity drift`);
}

export function buildVlCvxVotiumDeepEvidence({root=process.cwd()}={}){
  const roundFlow=load(root,FILES.roundFlow);
  const votingProof=load(root,FILES.votingProof);
  const gaugeFlow=load(root,FILES.gaugeFlow);
  const poolContext=load(root,FILES.poolContext);
  for(const [label,source] of Object.entries({roundFlow,votingProof,gaugeFlow,poolContext})){
    requireAuthority(source.json,label);
    requireIdentity(source.json,label);
  }

  if(votingProof.json?.sourceBinding?.roundFlowSha256!==roundFlow.sha256)fail('Voting provenance lost exact round-flow SHA-256 binding');
  if(gaugeFlow.json?.sourceBinding?.roundFlowSha256!==roundFlow.sha256)fail('Curve gauge flow lost exact round-flow SHA-256 binding');
  if(gaugeFlow.json?.sourceBinding?.votingProvenanceSha256!==votingProof.sha256)fail('Curve gauge flow lost exact voting-provenance SHA-256 binding');
  if(poolContext.json?.sourceBinding?.gaugeFlowSha256!==gaugeFlow.sha256)fail('Curve pool context lost exact gauge-flow SHA-256 binding');

  const roundCoverage=roundFlow.json?.coverage??{};
  if(Number(roundCoverage.requestedCompletedRounds)!==3||Number(roundCoverage.measuredCompletedRounds)!==3||roundCoverage.latestProcessedRoundIncluded!==true){
    fail('Votium completed-round coverage incomplete');
  }
  const votingCoverage=votingProof.json?.coverage??{};
  if(votingCoverage.complete!==true||Number(votingCoverage.provenRoundCount)!==3||Number(votingCoverage.onchainVotiumGaugeCount)!==79||Number(votingCoverage.onchainExactGaugeMatchCount)!==79){
    fail('Votium voting provenance is not fully proven');
  }
  const gaugeCoverage=gaugeFlow.json?.coverage??{};
  if(gaugeCoverage.complete!==true||Number(gaugeCoverage.completeRoundCount)!==2||Number(gaugeCoverage.votiumGaugeCount)!==79||Number(gaugeCoverage.curveExecutedVotiumGaugeCount)!==79||Number(gaugeCoverage.eventOnlyPositiveGaugeCount)!==0){
    fail('Votium → Curve executed gauge bridge incomplete');
  }
  const poolCoverage=poolContext.json?.coverage??{};
  if(poolCoverage.allGaugeRowsClassified!==true||poolCoverage.currentPoolContextComplete!==true||Number(poolCoverage.uniqueGaugeCount)!==47||Number(poolCoverage.currentPoolEligibleGaugeCount)!==31||Number(poolCoverage.currentPoolContextCompleteCount)!==31||Number(poolCoverage.unresolvedEligiblePoolContextCount)!==0||Number(poolCoverage.exactFeeUsdResolvedCount)!==0){
    fail('Curve downstream pool context incomplete or exact-fee semantics drifted');
  }

  return {
    version:VLCVX_DEEP_EVIDENCE_VERSION,
    status:'shadow-cross-protocol-downstream-context-proven',
    candidateId:CANDIDATE_ID,
    companyRegistry:COMPANY_REGISTRY,
    sourceBinding:{
      roundFlow:{file:roundFlow.file,sha256:roundFlow.sha256,generatedAt:roundFlow.json.generatedAt??null},
      votingProvenance:{file:votingProof.file,sha256:votingProof.sha256,generatedAt:votingProof.json.generatedAt??null},
      curveGaugeFlow:{file:gaugeFlow.file,sha256:gaugeFlow.sha256,generatedAt:gaugeFlow.json.generatedAt??null},
      curvePoolContext:{file:poolContext.file,sha256:poolContext.sha256,generatedAt:poolContext.json.generatedAt??null}
    },
    coverage:{
      completedVotiumRoundsMeasured:3,
      votingProvenanceRoundsProven:3,
      onchainVotiumGaugesExactMatched:79,
      curveExecutedVotiumGaugeRows:79,
      currentCurveGaugeUniverseClassified:47,
      currentCurvePoolEligibleGauges:31,
      currentCurvePoolContextsComplete:31,
      unresolvedEligiblePoolContexts:0,
      exactFeeUsdResolved:0,
      complete:true
    },
    relations:{
      incentiveToVote:'CORRELATED-only-not-causal',
      voteToExecutedCurveGaugeBps:'ATTRIBUTED-mechanical-execution-proven',
      historicalVoteToCurrentPoolState:'CORRELATED-temporal-context-only-not-causal'
    },
    resolvedAtoms:[
      'three completed Votium rounds measured in source-native token/vote units',
      'legacy Snapshot → Convex onchain voting provenance transition proven',
      '79/79 post-migration Votium gauge rows exact-matched to Convex onchain vote totals',
      '79/79 Votium gauge rows mechanically bridged to executed Curve gauge BPS',
      '47 Curve gauges classified as current-pool eligible or historical/non-eligible',
      '31/31 currently eligible Curve gauges have current liquidity, 24h volume and base-yield context'
    ],
    remainingUnknowns:[
      'USD valuation for source-native incentive flows where source artifacts intentionally leave USD unknown',
      'exact pool fee USD because selected official Curve endpoints do not expose it directly',
      'whether Votium incentives caused vlCVX vote allocation',
      'whether historical vlCVX vote allocation caused current Curve liquidity, volume, fees or yield',
      'aligned longitudinal downstream response attribution across comparable rounds/epochs'
    ],
    nextUnlock:'Accumulate aligned longitudinal Votium vote/incentive and Curve pool observations; promote causal response claims only if a protocol-specific accounting identity or reproducible aligned evidence proves them.',
    authority:{
      readOnly:true,
      executionAuthority:'none',
      capitalExecution:false,
      walletAuthority:false,
      allocationAuthority:false,
      recommendationAuthority:false,
      predictionAuthority:false,
      causalClaimAuthority:'none',
      promotionAuthority:'none'
    }
  };
}

export function applyVlCvxVotiumDeepEvidence({state,root=process.cwd()}={}){
  if(!state||typeof state!=='object')fail('Economic Graph state missing');
  if(Number(state?.coverage?.cohortCount)!==2||state?.coverage?.status!=='partial-two-cohort')fail('Canonical two-cohort boundary drift');
  if(state?.authority?.executionAuthority!=='none'||state?.authority?.causalClaimAuthority!=='none')fail('Economic Graph authority drift');
  const candidate=state?.candidateCohorts?.[CANDIDATE_ID];
  if(!candidate||candidate.status!=='shadow-measured-not-promoted')fail('vlCVX/Votium shadow candidate unavailable or promoted');

  const deep=buildVlCvxVotiumDeepEvidence({root});
  candidate.deepEconomicEvidence=deep;
  candidate.attribution={
    ...(candidate.attribution??{}),
    status:'cross-protocol-execution-and-current-pool-context-proven-causality-unresolved',
    referenceDecompositionProven:true,
    currentRouteMeasured:true,
    rewardInventoryContextMeasured:true,
    votingProvenanceProven:true,
    curveGaugeExecutionProven:true,
    currentCurvePoolContextComplete:true,
    primaryDriver:null,
    blockedQuestion:'whether Votium incentives caused vlCVX vote allocation or historical votes caused current Curve pool outcomes',
    unlockCondition:deep.nextUnlock,
    promotionAuthority:'none'
  };
  const observation=candidate?.latest?.observation;
  if(observation){
    observation.marketBreathSeed={
      ...(observation.marketBreathSeed??{}),
      measuredAtoms:[...new Set([...(observation.marketBreathSeed?.measuredAtoms??[]),...deep.resolvedAtoms])],
      missingAtoms:deep.remainingUnknowns,
      nextUnlock:deep.nextUnlock
    };
    observation.epistemic={
      ...(observation.epistemic??{}),
      votingProvenance:'proven-transition-aware-snapshot-to-convex-onchain',
      curveGaugeExecution:'proven-mechanical-execution-bridge',
      downstreamPoolContext:'measured-current-temporal-context-not-causal-response',
      causalAttribution:'unresolved-incentive-to-vote-and-vote-to-pool-outcome',
      primaryDriver:null,
      recommendationAuthority:'none',
      predictionAuthority:'none',
      promotionAuthority:'none'
    };
  }
  state.sourceState={
    ...(state.sourceState??{}),
    vlCvxVotiumDeepEvidence:{
      status:deep.status,
      candidateId:CANDIDATE_ID,
      companyRegistry:COMPANY_REGISTRY,
      sourceBinding:deep.sourceBinding,
      executionAuthority:'none',
      causalClaimAuthority:'none',
      promotionAuthority:'none'
    }
  };
  return state;
}
