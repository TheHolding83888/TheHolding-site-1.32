#!/usr/bin/env node
/**
 * The Holding Brain · vlCVX/Votium → Curve shadow context v0.1
 *
 * Deterministic post-build extension of the existing Grounded Brain packet.
 * It consumes only the exact Explanatory Context already bound as a Brain
 * upstream. No new source, reasoning case, recommendation or authority is added.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';

export const VLCVX_BRAIN_EXTENSION_VERSION='0.1-vlcvx-votium-curve-shadow-context';
const EXPLANATORY='intelligence/explanatory/explanatory-context.json';
const BRAIN='intelligence/brain-intelligence.json';
const HISTORY='intelligence/brain-history.json';
const BRIEF='intelligence/brain-brief.md';
const CONTEXT_ID='defitea-convex-vlcvx-votium';

function fail(message){throw new Error(message);}
function sha256(value){return crypto.createHash('sha256').update(value).digest('hex');}
function stableValue(value){
  if(Array.isArray(value))return value.map(stableValue);
  if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,stableValue(value[key])]));
  return value;
}
function stableStringify(value){return JSON.stringify(stableValue(value));}
function dedupeEvidence(items){
  const seen=new Set(),out=[];
  for(const item of items){
    const key=stableStringify({source:item?.source,pointer:item?.pointer,selector:item?.selector??null,value:item?.value,sourceSha256:item?.sourceSha256});
    if(seen.has(key))continue;
    seen.add(key);out.push(item);
  }
  return out;
}
function readJson(file){return JSON.parse(fs.readFileSync(file,'utf8'));}

export function applyBrainVlCvxVotiumCurveShadowContext(){
  const explanatoryText=fs.readFileSync(EXPLANATORY,'utf8');
  const explanatory=JSON.parse(explanatoryText);
  const brain=readJson(BRAIN);
  const context=explanatory?.explanations?.protocolFlowContexts?.[CONTEXT_ID];

  if(explanatory?.extensions?.vlCvxVotiumCurve!=='0.1-vlcvx-votium-curve-shadow-context'||!context)fail('Explanatory vlCVX/Votium shadow context unavailable');
  if(Number(explanatory?.coverage?.protocolEconomicCohortCount)!==2||Object.keys(explanatory?.explanations?.protocolAprChangeContexts??{}).length!==2)fail('Explanatory canonical cohort boundary drift');
  if(Number(explanatory?.coverage?.shadowProtocolFlowContextCount)!==1)fail('Unexpected Explanatory shadow flow count');
  if(context?.coverage?.canonicalProtocolEconomicCohort!==false||context?.coverage?.shadowCandidate!==true)fail('vlCVX context escaped shadow boundary');
  if(Number(context?.coverage?.onchainVotiumGaugesExactMatched)!==79||Number(context?.coverage?.curveExecutedVotiumGaugeRows)!==79||Number(context?.coverage?.currentCurvePoolContextsComplete)!==31||Number(context?.coverage?.unresolvedEligiblePoolContexts)!==0)fail('vlCVX downstream proof coverage drift');
  if(context?.measuredRelations?.voteToExecutedCurveGaugeBps?.class!=='ATTRIBUTED'||context?.measuredRelations?.incentiveToVote?.class!=='CORRELATED'||context?.measuredRelations?.historicalVoteToCurrentPoolState?.class!=='CORRELATED')fail('vlCVX relation semantics drift');
  if(context?.downstreamCurrentContext?.exactFeeUsd!=='UNKNOWN'||context?.causalBoundary?.primaryDriver!==null)fail('vlCVX unknown/causal boundary drift');
  if(context?.authority?.executionAuthority!=='none'||context?.authority?.causalClaimAuthority!=='none'||context?.authority?.promotionAuthority!=='none')fail('vlCVX context authority drift');

  if(brain?.version!=='0.1-grounded-reasoning-gateway'||brain?.reasonerVersion!=='0.1-deterministic-evidence-bound-reasoner')fail('Unexpected Grounded Brain packet');
  if(Number(brain?.currentPosture?.protocolEconomics?.cohortCount)!==2||Object.keys(brain?.questions?.protocolAprContexts??{}).length!==2)fail('Brain canonical two-cohort boundary drift');
  if(brain?.constraints?.actionMode!=='proposal-only'||brain?.constraints?.autonomousCapitalActionAllowed!==false||brain?.constraints?.autonomousRepositoryCodeMutationAllowed!==false)fail('Brain authority drift');
  const explanatorySha=sha256(explanatoryText);
  if(brain?.grounding?.sources?.explanatory?.sha256!==explanatorySha)fail('Brain exact Explanatory upstream hash is stale');

  const ev={
    source:EXPLANATORY,
    pointer:`/explanations/protocolFlowContexts/${CONTEXT_ID}`,
    value:context,
    sourceSha256:explanatorySha,
    observedAt:brain?.grounding?.sources?.explanatory?.generatedAt??null,
    interpretation:'shadow-cross-protocol-mechanics-and-temporal-context-causality-unresolved',
    note:'Votium→Convex→Curve mechanical execution is proven; current Curve pool state is measured temporal context only. Do not infer incentive→vote or vote→pool causality.'
  };
  const question={
    answer:context.explanation,
    status:context.status,
    coverage:context.coverage,
    measuredRelations:context.measuredRelations,
    downstreamCurrentContext:context.downstreamCurrentContext,
    causalBoundary:context.causalBoundary,
    authority:context.authority,
    evidence:[ev]
  };

  brain.extensions={...(brain.extensions??{}),vlCvxVotiumCurve:VLCVX_BRAIN_EXTENSION_VERSION};
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
    }
  };
  brain.questions={
    ...(brain.questions??{}),
    protocolFlowContexts:{[CONTEXT_ID]:question}
  };
  if(brain?.questions?.whatChanged){
    brain.questions.whatChanged.answer=`${brain.questions.whatChanged.answer} Shadow vlCVX/Votium evidence additionally proves 79/79 post-migration vote matching, 79/79 Curve gauge execution rows, and complete current pool context for 31/31 currently eligible mapped Curve gauges; causality beyond mechanical execution remains unresolved.`;
    brain.questions.whatChanged.evidence=dedupeEvidence([...(brain.questions.whatChanged.evidence??[]),ev]);
  }
  brain.evidenceLedger=dedupeEvidence([...(brain.evidenceLedger??[]),ev]);
  brain.grounding={
    ...(brain.grounding??{}),
    principles:[...new Set([...(brain.grounding?.principles??[]),'Shadow cross-protocol context may prove mechanical execution and expose measured temporal state without proving incentive→vote or vote→pool causality.'])]
  };

  brain.bridge.snapshotHash=null;
  brain.bridge.snapshotHash=sha256(stableStringify({
    ...brain,
    generatedAt:null,
    bridge:{...brain.bridge,snapshotHash:null}
  }));
  fs.writeFileSync(BRAIN,JSON.stringify(brain,null,2)+'\n');

  if(fs.existsSync(HISTORY)){
    const history=readJson(HISTORY);
    const last=history?.observations?.at(-1);
    if(last&&last.inputCompositeHash===brain.bridge.inputCompositeHash){
      last.snapshotHash=brain.bridge.snapshotHash;
      last.protocolFlowContextCount=1;
      last.protocolFlowContextStatuses={[CONTEXT_ID]:context.status};
    }
    fs.writeFileSync(HISTORY,JSON.stringify(history,null,2)+'\n');
  }
  if(fs.existsSync(BRIEF)){
    let brief=fs.readFileSync(BRIEF,'utf8').trimEnd();
    const marker='### Shadow cross-protocol flow context · vlCVX / Votium → Curve';
    const section=[
      '',marker,
      `- Context ID: ${CONTEXT_ID}`,
      '- Canonical cohort: no — shadow candidate only',
      '- Votium→Convex vote match: 79/79',
      '- Votium→Curve executed gauge rows: 79/79',
      '- Current eligible Curve pool contexts: 31/31',
      '- Exact pool fee USD: UNKNOWN under selected official endpoints',
      '- Proven relation: vote → executed Curve gauge BPS (mechanical)',
      '- Unproven relations: incentive → vote; historical vote → current pool outcome',
      '- Execution / causal / promotion authority: none',''
    ].join('\n');
    const index=brief.indexOf(`\n${marker}`);
    if(index>=0)brief=brief.slice(0,index).trimEnd();
    fs.writeFileSync(BRIEF,brief+section,'utf8');
  }

  console.log('BRAIN VLCVX VOTIUM CURVE SHADOW CONTEXT PASS',{
    canonicalCohorts:brain.currentPosture.protocolEconomics.cohortCount,
    shadowFlowContexts:brain.currentPosture.protocolFlows.contextCount,
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
