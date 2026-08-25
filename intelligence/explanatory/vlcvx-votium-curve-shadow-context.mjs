#!/usr/bin/env node
/**
 * The Holding · Explanatory shadow context · vlCVX/Votium → Curve v0.1
 *
 * Deterministic post-build extension over the canonical Explanatory Context.
 * It exposes the already-proven Economic Graph shadow candidate without turning
 * it into a third canonical protocol-economic cohort or adding causal authority.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const VLCVX_EXPLANATORY_EXTENSION_VERSION='0.1-vlcvx-votium-curve-shadow-context';
const GRAPH='intelligence/economic-graph/economic-graph.json';
const OUT=process.env.EXPLANATORY_CONTEXT_FILE||'intelligence/explanatory/explanatory-context.json';
const CANDIDATE_ID='defitea-convex-vlcvx-votium';

function fail(message){throw new Error(message);}
function sha256(bytes){return crypto.createHash('sha256').update(bytes).digest('hex');}
function read(rel){const bytes=fs.readFileSync(rel);return{bytes,json:JSON.parse(bytes.toString('utf8')),sha256:sha256(bytes)};}

export function buildVlCvxVotiumCurveShadowContext({graph,graphSha256}){
  if(Number(graph?.coverage?.cohortCount)!==2||graph?.coverage?.status!=='partial-two-cohort')fail('Explanatory extension refuses canonical cohort boundary drift');
  if(graph?.authority?.executionAuthority!=='none'||graph?.authority?.causalClaimAuthority!=='none')fail('Economic Graph authority drift');
  const candidate=graph?.candidateCohorts?.[CANDIDATE_ID];
  const deep=candidate?.deepEconomicEvidence;
  if(!candidate||candidate.status!=='shadow-measured-not-promoted'||deep?.status!=='shadow-cross-protocol-downstream-context-proven')fail('Production-proven vlCVX/Votium deep shadow evidence unavailable');
  if(deep?.coverage?.complete!==true||Number(deep?.coverage?.onchainVotiumGaugesExactMatched)!==79||Number(deep?.coverage?.curveExecutedVotiumGaugeRows)!==79||Number(deep?.coverage?.currentCurvePoolContextsComplete)!==31||Number(deep?.coverage?.unresolvedEligiblePoolContexts)!==0)fail('vlCVX/Votium deep coverage incomplete');
  if(Number(deep?.coverage?.exactFeeUsdResolved)!==0)fail('Exact Curve fee USD must remain unresolved under current source contract');
  if(deep?.relations?.voteToExecutedCurveGaugeBps!=='ATTRIBUTED-mechanical-execution-proven')fail('Mechanical Curve execution relation missing');
  if(deep?.relations?.incentiveToVote!=='CORRELATED-only-not-causal'||deep?.relations?.historicalVoteToCurrentPoolState!=='CORRELATED-temporal-context-only-not-causal')fail('Causal boundary drift');
  if(deep?.authority?.executionAuthority!=='none'||deep?.authority?.causalClaimAuthority!=='none'||deep?.authority?.promotionAuthority!=='none')fail('Deep evidence authority drift');

  return {
    contextId:CANDIDATE_ID,
    status:'shadow-cross-protocol-context-answerable-causality-unresolved',
    coverage:{
      companyRegistry:'004',
      company:'defitea.eth',
      protocolStack:['Convex','Votium','Curve'],
      mechanism:'vlCVX delegation → Votium incentives/votes → executed Curve gauge weights → current Curve pool context',
      canonicalProtocolEconomicCohort:false,
      shadowCandidate:true,
      completedVotiumRoundsMeasured:deep.coverage.completedVotiumRoundsMeasured,
      votingProvenanceRoundsProven:deep.coverage.votingProvenanceRoundsProven,
      onchainVotiumGaugesExactMatched:deep.coverage.onchainVotiumGaugesExactMatched,
      curveExecutedVotiumGaugeRows:deep.coverage.curveExecutedVotiumGaugeRows,
      currentCurveGaugeUniverseClassified:deep.coverage.currentCurveGaugeUniverseClassified,
      currentCurvePoolEligibleGauges:deep.coverage.currentCurvePoolEligibleGauges,
      currentCurvePoolContextsComplete:deep.coverage.currentCurvePoolContextsComplete,
      unresolvedEligiblePoolContexts:deep.coverage.unresolvedEligiblePoolContexts
    },
    explanation:'The current shadow evidence proves the Votium voting-source transition, exact post-migration Votium→Convex vote matching, mechanical execution of those votes into Curve gauge BPS, and complete current liquidity/24h-volume/base-yield context for every currently eligible mapped Curve pool. It does not prove that incentives caused vote choices or that historical vote allocation caused current pool outcomes.',
    measuredRelations:{
      incentiveToVote:{class:'CORRELATED',status:'context-only-not-causal'},
      voteToExecutedCurveGaugeBps:{class:'ATTRIBUTED',status:'mechanical-execution-proven'},
      historicalVoteToCurrentPoolState:{class:'CORRELATED',status:'temporal-context-only-not-causal'}
    },
    downstreamCurrentContext:{
      eligiblePoolCount:deep.coverage.currentCurvePoolEligibleGauges,
      completePoolContextCount:deep.coverage.currentCurvePoolContextsComplete,
      liquidity:'MEASURED-current-official-curve-api-context',
      volume24h:'MEASURED-current-official-curve-api-context',
      baseYield:'MEASURED-current-official-curve-api-context',
      exactFeeUsd:'UNKNOWN',
      exactFeeUsdReason:'Selected official Curve endpoints do not directly expose exact pool fee USD.'
    },
    causalBoundary:{
      primaryDriver:null,
      incentiveToVoteCause:'unresolved',
      voteToCurrentPoolOutcomeCause:'unresolved',
      nextUnlock:deep.nextUnlock
    },
    provenance:{
      economicGraphFile:GRAPH,
      graphSha256,
      deepEvidenceVersion:deep.version,
      sourceBinding:deep.sourceBinding
    },
    authority:{
      readOnly:true,
      executionAuthority:'none',
      allocationAuthority:false,
      recommendationAuthority:false,
      predictionAuthority:false,
      causalClaimAuthority:'none',
      promotionAuthority:'none'
    }
  };
}

export function applyVlCvxVotiumCurveShadowContext({root=process.cwd()}={}){
  process.chdir(root);
  const graphState=read(GRAPH);
  const explanatory=read(OUT).json;
  if(explanatory?.version!=='0.2-explanatory-context'||explanatory?.engineVersion!=='0.3-multi-cohort-protocol-economic-context')fail('Unexpected canonical Explanatory Context');
  if(Number(explanatory?.coverage?.protocolEconomicCohortCount)!==2||Object.keys(explanatory?.explanations?.protocolAprChangeContexts??{}).length!==2)fail('Canonical Explanatory two-cohort contract drift');
  if(explanatory?.authority?.readOnly!==true||explanatory?.authority?.executionAuthority!=='none'||explanatory?.authority?.causalClaimAuthority!=='none')fail('Explanatory authority drift');
  if(explanatory?.sourceState?.economicGraph?.sha256!==graphState.sha256)fail('Canonical Explanatory exact Economic Graph binding is stale');

  const context=buildVlCvxVotiumCurveShadowContext({graph:graphState.json,graphSha256:graphState.sha256});
  explanatory.extensions={...(explanatory.extensions??{}),vlCvxVotiumCurve:VLCVX_EXPLANATORY_EXTENSION_VERSION};
  explanatory.coverage={...(explanatory.coverage??{}),shadowProtocolFlowContextCount:1,shadowProtocolFlowContextIds:[CANDIDATE_ID]};
  explanatory.semantics={
    ...(explanatory.semantics??{}),
    shadowFlowRule:'Shadow cross-protocol flow contexts may expose proven mechanics and measured temporal context without becoming canonical APR cohorts or authorizing causal, recommendation, allocation or execution claims.'
  };
  explanatory.explanations={
    ...(explanatory.explanations??{}),
    protocolFlowContexts:{[CANDIDATE_ID]:context}
  };
  explanatory.answerability={
    ...(explanatory.answerability??{}),
    'how-votium-votes-reached-curve-gauges':'answerable-by-proven-mechanical-execution-bridge',
    'what-current-curve-pool-context-exists-for-votium-gauges':'answerable-by-complete-current-temporal-context',
    'exact-curve-pool-fee-usd-for-votium-gauges':'unknown-selected-official-endpoints-do-not-expose-exact-fee-usd',
    'did-votium-incentives-cause-vlcvx-votes':'blocked-causal-link-unproven',
    'did-vlcvx-votes-cause-current-curve-pool-outcomes':'blocked-causal-link-unproven'
  };
  fs.writeFileSync(OUT,JSON.stringify(explanatory,null,2)+'\n');
  console.log('EXPLANATORY VLCVX VOTIUM CURVE SHADOW CONTEXT PASS',{
    canonicalCohorts:explanatory.coverage.protocolEconomicCohortCount,
    shadowFlowContexts:explanatory.coverage.shadowProtocolFlowContextCount,
    gaugeMatches:context.coverage.onchainVotiumGaugesExactMatched,
    curveExecuted:context.coverage.curveExecutedVotiumGaugeRows,
    currentPools:context.coverage.currentCurvePoolContextsComplete,
    exactFeeUsd:context.downstreamCurrentContext.exactFeeUsd,
    executionAuthority:context.authority.executionAuthority
  });
  return explanatory;
}

if(path.resolve(process.argv[1]||'')===path.resolve(process.cwd(),'intelligence/explanatory/vlcvx-votium-curve-shadow-context.mjs')){
  try{applyVlCvxVotiumCurveShadowContext();}catch(error){console.error(error?.stack||error);process.exit(1);}
}
