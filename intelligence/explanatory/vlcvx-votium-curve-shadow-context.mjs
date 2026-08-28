#!/usr/bin/env node
/**
 * The Holding · Explanatory protocol context compatibility bridge v0.2
 *
 * Retains the established vlCVX/Votium → Curve shadow context contract and now
 * also exposes the full Protocol Intelligence Lifecycle plus the Frax ecosystem
 * sensor family already materialized in the exact Economic Graph bytes.
 *
 * Canonical APR cohorts remain exactly f(x) + Curve. Lifecycle/deep contexts are
 * read-only extensions: they do not become canonical APR cohorts and do not gain
 * causal, recommendation, allocation, promotion or execution authority.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const VLCVX_EXPLANATORY_EXTENSION_VERSION='0.1-vlcvx-votium-curve-shadow-context';
export const PROTOCOL_LIFECYCLE_EXPLANATORY_EXTENSION_VERSION='0.1-protocol-lifecycle-frax-ecosystem-context';
const GRAPH='intelligence/economic-graph/economic-graph.json';
const OUT=process.env.EXPLANATORY_CONTEXT_FILE||'intelligence/explanatory/explanatory-context.json';
const CANDIDATE_ID='defitea-convex-vlcvx-votium';
const FRAX_PROTOCOL_ID='registry-frax-vefrax';
const FRAX_ECOSYSTEM_ID='registry-frax-ecosystem';

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

function lifecycleSummary(graph){
  const lifecycle=graph?.protocolLifecycle;
  if(lifecycle?.version!=='0.1-protocol-intelligence-lifecycle')fail('Protocol lifecycle unavailable for Explanatory context');
  if(lifecycle?.authority?.executionAuthority!=='none'||lifecycle?.authority?.causalClaimAuthority!=='none')fail('Protocol lifecycle authority drift');
  const protocols=lifecycle?.protocols||{};
  if(Number(lifecycle?.summary?.protocolCount||Object.keys(protocols).length)!==8||Object.keys(protocols).length!==8)fail('Expected eight protocol lifecycle sensors');
  return Object.fromEntries(Object.entries(protocols).map(([id,p])=>[id,{
    protocolId:id,
    protocol:p?.protocol??null,
    mechanism:p?.mechanism??null,
    maturityStage:p?.maturityStage??null,
    status:p?.status??null,
    longitudinalEvidence:p?.longitudinalEvidence??null,
    blockers:p?.blockers??[],
    nextUnlock:p?.nextUnlock??null,
    authority:{
      executionAuthority:p?.authority?.executionAuthority??'none',
      causalClaimAuthority:p?.authority?.causalClaimAuthority??'none',
      promotionAuthority:p?.authority?.promotionAuthority??'none'
    }
  }]));
}

function buildFraxEcosystemContext({graph,graphSha256}){
  const evidence=graph?.protocolEvidence?.[FRAX_ECOSYSTEM_ID];
  const observation=evidence?.latest?.observation;
  const fraxLifecycle=graph?.protocolLifecycle?.protocols?.[FRAX_PROTOCOL_ID];
  if(!evidence||!observation||!fraxLifecycle)fail('Frax ecosystem evidence unavailable');
  if(observation?.version!=='0.1-frax-deep-ecosystem-sensor-family')fail('Unexpected Frax ecosystem version');
  if(observation?.protocolId!==FRAX_PROTOCOL_ID||fraxLifecycle?.maturityStage!==observation?.lifecycleStage)fail('Frax ecosystem/lifecycle identity drift');

  const surfaceCount=Number(observation?.coverage?.surfaceCount);
  const measured=Number(observation?.coverage?.measuredSurfaceCount);
  const unknown=Number(observation?.coverage?.sourceBoundUnknownSurfaceCount);
  const surfaces=observation?.surfaces??{};
  const surfaceEntries=Object.entries(surfaces);
  if(surfaceCount!==9||surfaceEntries.length!==surfaceCount||!Number.isInteger(measured)||!Number.isInteger(unknown)||measured<1||unknown<0||measured+unknown!==surfaceCount)fail(`Frax ecosystem coverage drift: ${surfaceCount}/${measured}/${unknown}`);
  const measuredSurfaceIds=surfaceEntries.filter(([,surface])=>String(surface?.measurementState??'').startsWith('MEASURED')).map(([id])=>id);
  const unknownSurfaceIds=surfaceEntries.filter(([,surface])=>String(surface?.measurementState??'').startsWith('UNKNOWN')).map(([id])=>id);
  if(measuredSurfaceIds.length!==measured||unknownSurfaceIds.length!==unknown)fail('Frax ecosystem surface-state/count mismatch');

  const sfrx=surfaces.frxUsdSfrxUsd;
  if(String(sfrx?.measurementState??'').startsWith('MEASURED')){
    const m=sfrx?.measured;
    if(m?.version!=='0.1-sfrxusd-exact-block-erc4626'||m?.measurementClass!=='MEASURED'||m?.epistemic?.sourceType!=='onchain-public-rpc-exact-block'||m?.epistemic?.currentStateMeasured!==true||!(Number(m?.values?.sharePriceFrxUsd)>0)||!(Number(m?.blockNumber)>0))fail('Frax sfrxUSD measured proof drift');
    if(m?.epistemic?.historicalBackfill!==false||m?.epistemic?.unknownIsZero!==false||m?.epistemic?.causalClaimAuthority!=='none'||m?.epistemic?.executionAuthority!=='none')fail('Frax sfrxUSD epistemic boundary drift');
  }

  if(observation?.epistemic?.executionAuthority!=='none'||observation?.authority?.executionAuthority!=='none'||observation?.authority?.causalClaimAuthority!=='none')fail('Frax ecosystem authority drift');
  if(!String(observation?.epistemic?.revenueToVeFraxAprCausality||'').startsWith('UNKNOWN')||!String(observation?.epistemic?.treasuryYieldToSpecificFxPoolIncentive||'').startsWith('UNKNOWN'))fail('Frax ecosystem causal boundary weakened');
  return {
    contextId:FRAX_ECOSYSTEM_ID,
    protocolId:FRAX_PROTOCOL_ID,
    status:observation.status,
    lifecycleStage:observation.lifecycleStage,
    scope:observation.scope,
    coverage:observation.coverage,
    surfaces:observation.surfaces,
    relationshipGraph:observation.relationshipGraph,
    epistemic:observation.epistemic,
    nextMeasurementUnlocks:observation.nextMeasurementUnlocks,
    explanation:`Frax is represented as one lifecycle sensor with a nine-surface ecosystem family. Current Economic Graph evidence marks ${measured} surface(s) as MEASURED (${measuredSurfaceIds.join(', ')}) and ${unknown} surface(s) as source-bound UNKNOWN (${unknownSurfaceIds.join(', ')}). Measured state is inherited from exact Graph evidence only; source topology and measured association do not authorize causal attribution, recommendation, allocation or execution claims.`,
    provenance:{economicGraphFile:GRAPH,graphSha256,observationId:observation.id,evidenceVersion:evidence.version},
    authority:observation.authority
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
  const lifecycleContexts=lifecycleSummary(graphState.json);
  const fraxEcosystem=buildFraxEcosystemContext({graph:graphState.json,graphSha256:graphState.sha256});
  explanatory.extensions={
    ...(explanatory.extensions??{}),
    vlCvxVotiumCurve:VLCVX_EXPLANATORY_EXTENSION_VERSION,
    protocolLifecycle:PROTOCOL_LIFECYCLE_EXPLANATORY_EXTENSION_VERSION
  };
  explanatory.coverage={
    ...(explanatory.coverage??{}),
    shadowProtocolFlowContextCount:1,
    shadowProtocolFlowContextIds:[CANDIDATE_ID],
    protocolLifecycleContextCount:Object.keys(lifecycleContexts).length,
    deepProtocolEcosystemContextCount:1,
    deepProtocolEcosystemContextIds:[FRAX_ECOSYSTEM_ID]
  };
  explanatory.semantics={
    ...(explanatory.semantics??{}),
    shadowFlowRule:'Shadow cross-protocol flow contexts may expose proven mechanics and measured temporal context without becoming canonical APR cohorts or authorizing causal, recommendation, allocation or execution claims.',
    lifecycleContextRule:'Protocol lifecycle and deep ecosystem contexts remain read-only intelligence surfaces. They do not change canonical APR cohort count or gain promotion/execution authority.',
    sourceReadinessRule:'An official source contract, documented mechanism or known address is not a current measurement. Missing current ingestion remains UNKNOWN.'
  };
  explanatory.explanations={
    ...(explanatory.explanations??{}),
    protocolFlowContexts:{[CANDIDATE_ID]:context},
    protocolLifecycleContexts:lifecycleContexts,
    protocolEcosystemContexts:{[FRAX_ECOSYSTEM_ID]:fraxEcosystem}
  };
  explanatory.answerability={
    ...(explanatory.answerability??{}),
    'how-votium-votes-reached-curve-gauges':'answerable-by-proven-mechanical-execution-bridge',
    'what-current-curve-pool-context-exists-for-votium-gauges':'answerable-by-complete-current-temporal-context',
    'exact-curve-pool-fee-usd-for-votium-gauges':'unknown-selected-official-endpoints-do-not-expose-exact-fee-usd',
    'did-votium-incentives-cause-vlcvx-votes':'blocked-causal-link-unproven',
    'did-vlcvx-votes-cause-current-curve-pool-outcomes':'blocked-causal-link-unproven',
    'what-protocol-sensors-are-live':'answerable-by-eight-protocol-lifecycle-context',
    'what-frax-ecosystem-surfaces-are-tracked':'answerable-by-deep-frax-ecosystem-context',
    'which-frax-ecosystem-values-are-currently-measured':'answerable-with-measured-vs-source-bound-unknown-separation',
    'did-frax-protocol-revenue-cause-current-vefrax-apr':'blocked-causal-link-unproven',
    'does-treasury-yield-fund-specific-fx-pool-incentives':'blocked-accounting-link-unproven'
  };
  fs.writeFileSync(OUT,JSON.stringify(explanatory,null,2)+'\n');
  console.log('EXPLANATORY PROTOCOL LIFECYCLE + FRAX ECOSYSTEM CONTEXT PASS',{
    canonicalCohorts:explanatory.coverage.protocolEconomicCohortCount,
    shadowFlowContexts:explanatory.coverage.shadowProtocolFlowContextCount,
    lifecycleContexts:explanatory.coverage.protocolLifecycleContextCount,
    deepEcosystemContexts:explanatory.coverage.deepProtocolEcosystemContextCount,
    fraxStage:fraxEcosystem.lifecycleStage,
    fraxSurfaces:fraxEcosystem.coverage.surfaceCount,
    fraxMeasuredSurfaces:fraxEcosystem.coverage.measuredSurfaceCount,
    fraxUnknownSurfaces:fraxEcosystem.coverage.sourceBoundUnknownSurfaceCount,
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
