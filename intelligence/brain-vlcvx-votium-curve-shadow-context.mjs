#!/usr/bin/env node
/**
 * The Holding Brain · protocol context compatibility bridge v0.2
 *
 * Deterministic post-build extension of the existing Grounded Brain packet.
 * It consumes only the exact Explanatory Context already bound as a Brain
 * upstream. Canonical APR cohorts remain exactly f(x) + Curve; the established
 * vlCVX/Votium → Curve shadow flow plus the eight-protocol lifecycle and Frax
 * ecosystem family are exposed as read-only context only.
 *
 * No new source, reasoning case, recommendation, promotion or authority is added.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';

export const VLCVX_BRAIN_EXTENSION_VERSION='0.1-vlcvx-votium-curve-shadow-context';
export const PROTOCOL_LIFECYCLE_BRAIN_EXTENSION_VERSION='0.1-protocol-lifecycle-frax-ecosystem-context';
const EXPLANATORY='intelligence/explanatory/explanatory-context.json';
const BRAIN='intelligence/brain-intelligence.json';
const HISTORY='intelligence/brain-history.json';
const BRIEF='intelligence/brain-brief.md';
const CONTEXT_ID='defitea-convex-vlcvx-votium';
const FRAX_PROTOCOL_ID='registry-frax-vefrax';
const FRAX_ECOSYSTEM_ID='registry-frax-ecosystem';
const BASE_FRAX_SURFACE_KEYS=['governanceVeFrax','fraxtalFloxFxtl','frxUsdSfrxUsd','fraxNet','fraxlend','fraxswapBamm','fxb','fxLiquidity','revenueRouting'];
const FRXETH_EXTENSION_VERSION='0.1-frxeth-sfrxeth-exact-block-scope-extension';
const MAX_BRAIN_OUTPUT_BYTES=90_000_000;

function fail(message){throw new Error(message);}
function sha256(value){return crypto.createHash('sha256').update(value).digest('hex');}
function stableValue(value){
  if(Array.isArray(value))return value.map(stableValue);
  if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,stableValue(value[key])]));
  return value;
}
function stableStringify(value){return JSON.stringify(stableValue(value));}
function evidenceLocator(item){
  return stableStringify({source:item?.source,pointer:item?.pointer,selector:item?.selector??null});
}
function dedupeEvidence(items){
  const seen=new Set(),out=[];
  for(const item of items){
    const key=stableStringify({
      source:item?.source,
      pointer:item?.pointer,
      selector:item?.selector??null,
      value:item?.value,
      valueSha256:item?.valueSha256??null,
      sourceSha256:item?.sourceSha256
    });
    if(seen.has(key))continue;
    seen.add(key);out.push(item);
  }
  return out;
}
function mergeEvidence(existing,additions){
  const replacementLocators=new Set(additions.map(evidenceLocator));
  return dedupeEvidence([
    ...(existing??[]).filter(item=>!replacementLocators.has(evidenceLocator(item))),
    ...additions
  ]);
}
function readJson(file){return JSON.parse(fs.readFileSync(file,'utf8'));}
function evidence({pointer,value,sha,observedAt,interpretation,note}){
  return {source:EXPLANATORY,pointer,value,sourceSha256:sha,observedAt,interpretation,note};
}
function referencedEvidence({pointer,value,sha,observedAt,interpretation,note}){
  const canonicalValue=stableStringify(value);
  return {
    source:EXPLANATORY,
    pointer,
    sourceSha256:sha,
    valueSha256:sha256(canonicalValue),
    valueBytes:Buffer.byteLength(canonicalValue,'utf8'),
    valueStorage:'source-pointer-integrity-bound',
    observedAt,
    interpretation,
    note
  };
}
function validateFraxScope(fraxEcosystem,fraxSurfaces){
  const extensions=fraxEcosystem?.scopeExtensions??{};
  const extensionKeys=Object.values(extensions).map(extension=>extension?.surfaceKey).filter(Boolean);
  if(extensionKeys.length!==new Set(extensionKeys).size)fail('Duplicate Frax scope-extension surface key');
  const expectedKeys=[...BASE_FRAX_SURFACE_KEYS,...extensionKeys],actualKeys=Object.keys(fraxSurfaces);
  if(expectedKeys.length!==new Set(expectedKeys).size)fail('Frax scope manifest collides with base surface');
  if(expectedKeys.length!==actualKeys.length||expectedKeys.some(key=>!actualKeys.includes(key))||actualKeys.some(key=>!expectedKeys.includes(key)))fail(`Frax scope manifest mismatch: expected ${expectedKeys.length}, got ${actualKeys.length}`);
  return extensions;
}

export function applyBrainVlCvxVotiumCurveShadowContext(){
  const explanatoryText=fs.readFileSync(EXPLANATORY,'utf8');
  const explanatory=JSON.parse(explanatoryText);
  const brain=readJson(BRAIN);
  const context=explanatory?.explanations?.protocolFlowContexts?.[CONTEXT_ID];
  const lifecycleContexts=explanatory?.explanations?.protocolLifecycleContexts;
  const fraxEcosystem=explanatory?.explanations?.protocolEcosystemContexts?.[FRAX_ECOSYSTEM_ID];

  if(explanatory?.extensions?.vlCvxVotiumCurve!=='0.1-vlcvx-votium-curve-shadow-context'||!context)fail('Explanatory vlCVX/Votium shadow context unavailable');
  if(explanatory?.extensions?.protocolLifecycle!=='0.1-protocol-lifecycle-frax-ecosystem-context')fail('Explanatory protocol lifecycle extension unavailable');
  if(Number(explanatory?.coverage?.protocolEconomicCohortCount)!==2||Object.keys(explanatory?.explanations?.protocolAprChangeContexts??{}).length!==2)fail('Explanatory canonical cohort boundary drift');
  if(Number(explanatory?.coverage?.shadowProtocolFlowContextCount)!==1)fail('Unexpected Explanatory shadow flow count');
  if(Number(explanatory?.coverage?.protocolLifecycleContextCount)!==8||Object.keys(lifecycleContexts??{}).length!==8)fail('Expected eight Explanatory lifecycle contexts');
  if(Number(explanatory?.coverage?.deepProtocolEcosystemContextCount)!==1||!fraxEcosystem)fail('Frax ecosystem Explanatory context unavailable');
  if(context?.coverage?.canonicalProtocolEconomicCohort!==false||context?.coverage?.shadowCandidate!==true)fail('vlCVX context escaped shadow boundary');
  if(Number(context?.coverage?.onchainVotiumGaugesExactMatched)!==79||Number(context?.coverage?.curveExecutedVotiumGaugeRows)!==79||Number(context?.coverage?.currentCurvePoolContextsComplete)!==31||Number(context?.coverage?.unresolvedEligiblePoolContexts)!==0)fail('vlCVX downstream proof coverage drift');
  if(context?.measuredRelations?.voteToExecutedCurveGaugeBps?.class!=='ATTRIBUTED'||context?.measuredRelations?.incentiveToVote?.class!=='CORRELATED'||context?.measuredRelations?.historicalVoteToCurrentPoolState?.class!=='CORRELATED')fail('vlCVX relation semantics drift');
  if(context?.downstreamCurrentContext?.exactFeeUsd!=='UNKNOWN'||context?.causalBoundary?.primaryDriver!==null)fail('vlCVX unknown/causal boundary drift');
  if(context?.authority?.executionAuthority!=='none'||context?.authority?.causalClaimAuthority!=='none'||context?.authority?.promotionAuthority!=='none')fail('vlCVX context authority drift');

  const fraxLifecycle=lifecycleContexts?.[FRAX_PROTOCOL_ID];
  if(!fraxLifecycle||fraxEcosystem?.protocolId!==FRAX_PROTOCOL_ID||fraxEcosystem?.lifecycleStage!==fraxLifecycle?.maturityStage)fail('Frax lifecycle/ecosystem identity drift');
  const fraxSurfaceCount=Number(fraxEcosystem?.coverage?.surfaceCount);
  const fraxMeasured=Number(fraxEcosystem?.coverage?.measuredSurfaceCount);
  const fraxUnknown=Number(fraxEcosystem?.coverage?.sourceBoundUnknownSurfaceCount);
  const fraxSurfaces=fraxEcosystem?.surfaces??{};
  const fraxScopeExtensions=validateFraxScope(fraxEcosystem,fraxSurfaces);
  const fraxSurfaceEntries=Object.entries(fraxSurfaces);
  if(fraxSurfaceCount!==fraxSurfaceEntries.length||fraxSurfaceCount<BASE_FRAX_SURFACE_KEYS.length||!Number.isInteger(fraxMeasured)||!Number.isInteger(fraxUnknown)||fraxMeasured<1||fraxUnknown<0||fraxMeasured+fraxUnknown!==fraxSurfaceCount)fail(`Frax ecosystem coverage drift: ${fraxSurfaceCount}/${fraxMeasured}/${fraxUnknown}`);
  const fraxMeasuredSurfaceIds=fraxSurfaceEntries.filter(([,surface])=>String(surface?.measurementState??'').startsWith('MEASURED')).map(([id])=>id);
  const fraxUnknownSurfaceIds=fraxSurfaceEntries.filter(([,surface])=>String(surface?.measurementState??'').startsWith('UNKNOWN')).map(([id])=>id);
  if(fraxMeasuredSurfaceIds.length!==fraxMeasured||fraxUnknownSurfaceIds.length!==fraxUnknown)fail('Frax ecosystem surface-state/count mismatch');
  const sfrx=fraxSurfaces.frxUsdSfrxUsd;
  if(String(sfrx?.measurementState??'').startsWith('MEASURED')){
    const m=sfrx?.measured;
    if(m?.version!=='0.1-sfrxusd-exact-block-erc4626'||m?.measurementClass!=='MEASURED'||m?.epistemic?.sourceType!=='onchain-public-rpc-exact-block'||m?.epistemic?.currentStateMeasured!==true||!(Number(m?.values?.sharePriceFrxUsd)>0)||!(Number(m?.blockNumber)>0))fail('Frax sfrxUSD measured proof drift');
    if(m?.epistemic?.historicalBackfill!==false||m?.epistemic?.unknownIsZero!==false||m?.epistemic?.causalClaimAuthority!=='none'||m?.epistemic?.executionAuthority!=='none')fail('Frax sfrxUSD epistemic boundary drift');
  }
  const frxEthExtension=fraxScopeExtensions.frxEth;
  if(frxEthExtension){
    if(frxEthExtension?.version!==FRXETH_EXTENSION_VERSION||frxEthExtension?.surfaceKey!=='frxEthSfrxEth'||frxEthExtension?.surfaceId!=='frxeth-sfrxeth')fail('Frax frxETH scope-extension identity drift');
    const frxEth=fraxSurfaces.frxEthSfrxEth;
    if(!frxEth)fail('Frax frxETH scope extension surface missing');
    if(String(frxEth?.measurementState??'').startsWith('MEASURED')){
      const m=frxEth?.measured;
      if(m?.version!==FRXETH_EXTENSION_VERSION||m?.measurementClass!=='MEASURED'||m?.epistemic?.sourceType!=='onchain-public-rpc-exact-block'||m?.epistemic?.currentStateMeasured!==true||!(Number(m?.vault?.sharePriceAsset)>0)||!(Number(m?.blockNumber)>0))fail('Frax frxETH measured proof drift');
      if(m?.sourceBinding?.officialSourceCommit!=='83dfe93b4a32b9ca0ab93d6e7c059fcd977320d4'||m?.epistemic?.fraxFactsMeasurementAuthority!==false||m?.epistemic?.unknownIsZero!==false||m?.epistemic?.causalClaimAuthority!=='none'||m?.epistemic?.executionAuthority!=='none')fail('Frax frxETH source/epistemic boundary drift');
    }
  }
  if(!String(fraxEcosystem?.epistemic?.revenueToVeFraxAprCausality||'').startsWith('UNKNOWN')||!String(fraxEcosystem?.epistemic?.treasuryYieldToSpecificFxPoolIncentive||'').startsWith('UNKNOWN'))fail('Frax ecosystem causal boundary weakened');
  if(fraxEcosystem?.authority?.executionAuthority!=='none'||fraxEcosystem?.authority?.causalClaimAuthority!=='none'||fraxEcosystem?.authority?.lifecyclePromotionAuthority!=='none')fail('Frax ecosystem authority drift');
  for(const item of Object.values(lifecycleContexts)){
    if(item?.authority?.executionAuthority!=='none'||item?.authority?.causalClaimAuthority!=='none'||item?.authority?.promotionAuthority!=='none')fail(`Lifecycle context authority drift: ${item?.protocolId}`);
  }

  if(brain?.version!=='0.1-grounded-reasoning-gateway'||brain?.reasonerVersion!=='0.1-deterministic-evidence-bound-reasoner')fail('Unexpected Grounded Brain packet');
  if(Number(brain?.currentPosture?.protocolEconomics?.cohortCount)!==2||Object.keys(brain?.questions?.protocolAprContexts??{}).length!==2)fail('Brain canonical two-cohort boundary drift');
  if(brain?.constraints?.actionMode!=='proposal-only'||brain?.constraints?.autonomousCapitalActionAllowed!==false||brain?.constraints?.autonomousRepositoryCodeMutationAllowed!==false)fail('Brain authority drift');
  const explanatorySha=sha256(explanatoryText);
  if(brain?.grounding?.sources?.explanatory?.sha256!==explanatorySha)fail('Brain exact Explanatory upstream hash is stale');
  const observedAt=brain?.grounding?.sources?.explanatory?.generatedAt??null;

  const flowEv=evidence({
    pointer:`/explanations/protocolFlowContexts/${CONTEXT_ID}`,
    value:context,sha:explanatorySha,observedAt,
    interpretation:'shadow-cross-protocol-mechanics-and-temporal-context-causality-unresolved',
    note:'Votium→Convex→Curve mechanical execution is proven; current Curve pool state is measured temporal context only. Do not infer incentive→vote or vote→pool causality.'
  });
  const lifecycleEvidence=Object.fromEntries(Object.entries(lifecycleContexts).map(([id,value])=>[id,evidence({
    pointer:`/explanations/protocolLifecycleContexts/${id}`,
    value,sha:explanatorySha,observedAt,
    interpretation:'read-only-protocol-lifecycle-context',
    note:'Lifecycle maturity is evidence-gated and does not grant recommendation, promotion or execution authority.'
  })]));
  const fraxEv=referencedEvidence({
    pointer:`/explanations/protocolEcosystemContexts/${FRAX_ECOSYSTEM_ID}`,
    value:fraxEcosystem,sha:explanatorySha,observedAt,
    interpretation:'frax-deep-ecosystem-measured-vs-source-bound-unknown',
    note:`Current Explanatory evidence marks ${fraxMeasured} Frax surface(s) MEASURED (${fraxMeasuredSurfaceIds.join(', ')}) and ${fraxUnknown} source-bound UNKNOWN (${fraxUnknownSurfaceIds.join(', ')}). Full Frax context remains materialized once under protocolEcosystemContexts; this evidence row is exact-source-pointer/hash bound to avoid duplicate payload amplification.`
  });

  const flowQuestion={
    answer:context.explanation,
    status:context.status,
    coverage:context.coverage,
    measuredRelations:context.measuredRelations,
    downstreamCurrentContext:context.downstreamCurrentContext,
    causalBoundary:context.causalBoundary,
    authority:context.authority,
    evidence:[flowEv]
  };
  const lifecycleQuestions=Object.fromEntries(Object.entries(lifecycleContexts).map(([id,value])=>[id,{
    answer:`${value.protocol||id} · ${value.mechanism||'protocol mechanism'} · lifecycle stage ${value.maturityStage||'UNKNOWN'}.`,
    ...value,
    evidence:[lifecycleEvidence[id]]
  }]));
  const fraxQuestion={
    answer:fraxEcosystem.explanation,
    status:fraxEcosystem.status,
    lifecycleStage:fraxEcosystem.lifecycleStage,
    scopeExtensions:fraxScopeExtensions,
    coverage:fraxEcosystem.coverage,
    surfaces:fraxEcosystem.surfaces,
    relationshipGraph:fraxEcosystem.relationshipGraph,
    epistemic:fraxEcosystem.epistemic,
    nextMeasurementUnlocks:fraxEcosystem.nextMeasurementUnlocks,
    authority:fraxEcosystem.authority,
    evidence:[fraxEv]
  };

  const stageCounts=Object.values(lifecycleContexts).reduce((acc,item)=>{const stage=item?.maturityStage||'unknown';acc[stage]=(acc[stage]||0)+1;return acc;},{});
  brain.extensions={
    ...(brain.extensions??{}),
    vlCvxVotiumCurve:VLCVX_BRAIN_EXTENSION_VERSION,
    protocolLifecycle:PROTOCOL_LIFECYCLE_BRAIN_EXTENSION_VERSION
  };
  brain.currentPosture={
    ...(brain.currentPosture??{}),
    protocolFlows:{
      status:'shadow-context-available-causality-unresolved',
      contextCount:1,
      activeContextIds:[CONTEXT_ID],
      contexts:{[CONTEXT_ID]:{
        status:context.status,
        companyRegistry:context.coverage.companyRegistry,
        company:context.coverage.company,
        protocolStack:context.coverage.protocolStack,
        mechanicalExecution:'proven',
        currentPoolContext:'complete-for-all-currently-eligible-mapped-gauges',
        exactFeeUsd:'UNKNOWN',
        primaryDriver:null,
        causalAttribution:'unresolved-beyond-proven-mechanical-execution'
      }}
    },
    protocolLifecycle:{
      status:'eight-protocol-lifecycle-context-available',
      protocolCount:8,
      stageCounts,
      protocolIds:Object.keys(lifecycleContexts),
      frax:{protocolId:FRAX_PROTOCOL_ID,maturityStage:fraxLifecycle.maturityStage,status:fraxLifecycle.status??null}
    },
    protocolEcosystems:{
      status:'deep-ecosystem-context-available-measurement-partial',
      contextCount:1,
      activeContextIds:[FRAX_ECOSYSTEM_ID],
      contexts:{[FRAX_ECOSYSTEM_ID]:{
        protocolId:FRAX_PROTOCOL_ID,
        lifecycleStage:fraxEcosystem.lifecycleStage,
        surfaceCount:fraxSurfaceCount,
        scopeExtensionIds:Object.keys(fraxScopeExtensions),
        measuredSurfaceCount:fraxMeasured,
        sourceBoundUnknownSurfaceCount:fraxUnknown,
        measuredSurfaceIds:fraxMeasuredSurfaceIds,
        sourceBoundUnknownSurfaceIds:fraxUnknownSurfaceIds,
        revenueToVeFraxAprCausality:'UNKNOWN',
        treasuryYieldToSpecificFxPoolIncentive:'UNKNOWN'
      }}
    }
  };
  brain.questions={
    ...(brain.questions??{}),
    protocolFlowContexts:{[CONTEXT_ID]:flowQuestion},
    protocolLifecycleContexts:lifecycleQuestions,
    protocolEcosystemContexts:{[FRAX_ECOSYSTEM_ID]:fraxQuestion}
  };
  const extensionEvidence=[flowEv,...Object.values(lifecycleEvidence),fraxEv];
  if(brain?.questions?.whatChanged){
    brain.questions.whatChanged.answer=`${brain.questions.whatChanged.answer} Shadow vlCVX/Votium evidence additionally proves 79/79 post-migration vote matching, 79/79 Curve gauge execution rows, and complete current pool context for 31/31 currently eligible mapped Curve gauges; causality beyond mechanical execution remains unresolved. Protocol Intelligence exposes eight lifecycle contexts and one deep Frax ecosystem family with ${fraxSurfaceCount} tracked surfaces; ${fraxMeasured} surface(s) are currently MEASURED (${fraxMeasuredSurfaceIds.join(', ')}), while ${fraxUnknown} remain source-bound UNKNOWN.`;
    brain.questions.whatChanged.evidence=mergeEvidence(brain.questions.whatChanged.evidence,extensionEvidence);
  }
  brain.evidenceLedger=mergeEvidence(brain.evidenceLedger,extensionEvidence);
  brain.grounding={
    ...(brain.grounding??{}),
    principles:[...new Set([
      ...(brain.grounding?.principles??[]),
      'Shadow cross-protocol context may prove mechanical execution and expose measured temporal state without proving incentive→vote or vote→pool causality.',
      'Protocol lifecycle and deep ecosystem context remain read-only intelligence surfaces and do not change canonical APR cohort authority.',
      'Official source readiness, documented topology and known addresses are not current measurements; missing current ingestion remains UNKNOWN.'
    ])]
  };

  brain.bridge.snapshotHash=null;
  brain.bridge.snapshotHash=sha256(stableStringify({
    ...brain,
    generatedAt:null,
    bridge:{...brain.bridge,snapshotHash:null}
  }));
  const serializedBrain=JSON.stringify(brain,null,2)+'\n';
  const brainOutputBytes=Buffer.byteLength(serializedBrain,'utf8');
  if(brainOutputBytes>MAX_BRAIN_OUTPUT_BYTES)fail(`Brain output size guard exceeded: ${brainOutputBytes} > ${MAX_BRAIN_OUTPUT_BYTES}`);
  fs.writeFileSync(BRAIN,serializedBrain);

  if(fs.existsSync(HISTORY)){
    const history=readJson(HISTORY);
    const last=history?.observations?.at(-1);
    if(last&&last.inputCompositeHash===brain.bridge.inputCompositeHash){
      last.snapshotHash=brain.bridge.snapshotHash;
      last.protocolFlowContextCount=1;
      last.protocolFlowContextStatuses={[CONTEXT_ID]:context.status};
      last.protocolLifecycleContextCount=8;
      last.protocolLifecycleStageCounts=stageCounts;
      last.protocolEcosystemContextCount=1;
      last.protocolEcosystemContextStatuses={[FRAX_ECOSYSTEM_ID]:fraxEcosystem.status};
    }
    fs.writeFileSync(HISTORY,JSON.stringify(history,null,2)+'\n');
  }
  if(fs.existsSync(BRIEF)){
    let brief=fs.readFileSync(BRIEF,'utf8').trimEnd();
    const flowMarker='### Shadow cross-protocol flow context · vlCVX / Votium → Curve';
    const fraxMarker='### Protocol lifecycle + Frax ecosystem context';
    const cutPoints=[brief.indexOf(`\n${flowMarker}`),brief.indexOf(`\n${fraxMarker}`)].filter(x=>x>=0);
    if(cutPoints.length)brief=brief.slice(0,Math.min(...cutPoints)).trimEnd();
    const measuredSurfaceSuffix=fraxMeasuredSurfaceIds.length?` — ${fraxMeasuredSurfaceIds.join(', ')}`:'';
    const unknownSurfaceSuffix=fraxUnknownSurfaceIds.length?` — ${fraxUnknownSurfaceIds.join(', ')}`:'';
    const section=[
      '',flowMarker,
      `- Context ID: ${CONTEXT_ID}`,
      '- Canonical cohort: no — shadow candidate only',
      '- Votium→Convex vote match: 79/79',
      '- Votium→Curve executed gauge rows: 79/79',
      '- Current eligible Curve pool contexts: 31/31',
      '- Exact pool fee USD: UNKNOWN under selected official endpoints',
      '- Proven relation: vote → executed Curve gauge BPS (mechanical)',
      '- Unproven relations: incentive → vote; historical vote → current pool outcome',
      '- Execution / causal / promotion authority: none',
      '',fraxMarker,
      '- Live lifecycle sensors: 8',
      `- Frax lifecycle stage: ${fraxLifecycle.maturityStage}`,
      `- Frax ecosystem tracked surfaces: ${fraxSurfaceCount}`,
      `- Current MEASURED Frax ecosystem surfaces: ${fraxMeasured}${measuredSurfaceSuffix}`,
      `- Source-bound UNKNOWN Frax ecosystem surfaces: ${fraxUnknown}${unknownSurfaceSuffix}`,
      '- Revenue → veFRAX APR: UNKNOWN',
      '- Treasury yield → specific FX-pool incentive: UNKNOWN',
      '- Lifecycle / recommendation / causal / execution authority: none',''
    ].join('\n');
    const renderedBrief=brief+section;
    if(/[ \t]+$/m.test(renderedBrief))fail('Brain brief renderer produced trailing whitespace');
    fs.writeFileSync(BRIEF,renderedBrief,'utf8');
  }

  console.log('BRAIN PROTOCOL LIFECYCLE + FRAX ECOSYSTEM CONTEXT PASS',{
    canonicalCohorts:brain.currentPosture.protocolEconomics.cohortCount,
    shadowFlowContexts:brain.currentPosture.protocolFlows.contextCount,
    lifecycleContexts:brain.currentPosture.protocolLifecycle.protocolCount,
    lifecycleStageCounts:brain.currentPosture.protocolLifecycle.stageCounts,
    fraxStage:brain.currentPosture.protocolLifecycle.frax.maturityStage,
    deepEcosystemContexts:brain.currentPosture.protocolEcosystems.contextCount,
    fraxSurfaces:fraxSurfaceCount,
    fraxScopeExtensions:Object.keys(fraxScopeExtensions),
    fraxMeasuredSurfaces:fraxMeasured,
    fraxUnknownSurfaces:fraxUnknown,
    fraxEvidenceStorage:fraxEv.valueStorage,
    fraxEvidenceBytes:fraxEv.valueBytes,
    brainOutputBytes,
    curveExecutedGaugeRows:context.coverage.curveExecutedVotiumGaugeRows,
    currentPoolContexts:context.coverage.currentCurvePoolContextsComplete,
    exactFeeUsd:context.downstreamCurrentContext.exactFeeUsd,
    reasoningCases:brain.reasoningCases?.length??null,
    snapshotHash:brain.bridge.snapshotHash,
    executionAuthority:'none'
  });
  return brain;
}

try{applyBrainVlCvxVotiumCurveShadowContext();}catch(error){console.error(error?.stack||error);process.exit(1);}
