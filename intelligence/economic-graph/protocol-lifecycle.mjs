#!/usr/bin/env node
/**
 * The Holding · Protocol Intelligence Lifecycle v0.1
 *
 * Normalizes protocol/evidence maturity across the existing Economic Graph.
 * It does not collect new market data and it does not mutate methodology.
 * Promotion means "this evidence may be consumed at the declared epistemic
 * class"; it never upgrades UNKNOWN/correlation into causality.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const POLICY_FILE = path.join(HERE, 'protocol-lifecycle-policy.json');
const MAX_TRANSITIONS = 2000;

function fail(message){ throw new Error(message); }
function readJson(file, required=true){
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (error) { if (!required && error?.code === 'ENOENT') return null; throw error; }
}
function sha256Text(text){ return crypto.createHash('sha256').update(text).digest('hex'); }
function finite(value){ return Number.isFinite(Number(value)); }
function check(id, pass, stage, detail, evidenceClass='measured'){
  return { id, pass:Boolean(pass), stage, evidenceClass, detail };
}
function transitionFingerprint(protocolId, from, to, basis){
  return sha256Text(JSON.stringify({protocolId,from,to,basis}));
}
function stageRank(policy, stage){ return policy.stageOrder.indexOf(stage); }
function assertPolicy(policy){
  if (policy?.version !== '0.1-protocol-intelligence-lifecycle-policy') fail('Protocol lifecycle policy version drift');
  const a=policy.authority||{};
  if (a.executionAuthority !== 'none' || a.repositoryMutationAuthority !== false || a.workflowDispatchAuthority !== false) fail('Protocol lifecycle authority drift');
  if (a.capitalExecution !== false || a.walletAuthority !== false || a.allocationAuthority !== false || a.recommendationAuthority !== false || a.predictionAuthority !== false || a.causalClaimAuthority !== 'none') fail('Protocol lifecycle economic authority drift');
  if (a.promotionRuleMutationAuthority !== false || a.methodologyMutationAuthority !== false) fail('Protocol lifecycle methodology authority drift');
  if (!Array.isArray(policy.stageOrder) || policy.stageOrder.join('>') !== 'discovery>shadow>verified>canonical') fail('Protocol lifecycle stage order drift');
}
function evidenceSummary(checks){
  return {
    total: checks.length,
    passed: checks.filter(x=>x.pass).length,
    failed: checks.filter(x=>!x.pass).length,
    canonicalAtoms: checks.filter(x=>x.pass&&x.stage==='canonical').length,
    verifiedAtoms: checks.filter(x=>x.pass&&x.stage==='verified').length,
    shadowAtoms: checks.filter(x=>x.pass&&x.stage==='shadow').length
  };
}
function protocolResult({id,label,stage,checks,blockers=[],unknowns=[],policy,previous}){
  if (!policy.stageOrder.includes(stage)) fail(`Invalid lifecycle stage for ${id}: ${stage}`);
  const prior=previous?.protocols?.[id]?.maturityStage || null;
  const basis=checks.map(x=>[x.id,x.pass,x.stage]);
  const changed=prior!==null && prior!==stage;
  return {
    protocolId:id,
    label,
    maturityStage:stage,
    operatingMode:stage==='canonical'?'continuous-monitoring':(stage==='discovery'?'warming':'shadow-monitoring'),
    automaticallyEvaluated:true,
    automaticallyPromoted: prior!==null && stageRank(policy,stage)>stageRank(policy,prior),
    automaticallyRegressed: prior!==null && stageRank(policy,stage)<stageRank(policy,prior),
    evidence:evidenceSummary(checks),
    checks,
    blockers,
    unknowns,
    epistemicBoundary:'Canonical evidence may remain causally UNKNOWN outside proven formula/accounting identities.',
    priorMaturityStage:prior,
    transitionFingerprint:changed?transitionFingerprint(id,prior,stage,basis):null
  };
}

function evaluateFxn(state, policy, previous){
  const id='defitea-fxn-vefxn', c=state?.cohorts?.[id], o=c?.latest?.observation;
  const checks=[
    check('canonical-cohort-present', Boolean(c&&o), 'canonical', 'Existing canonical Economic Graph cohort exists.', 'canonical-state'),
    check('exact-official-locker-source', o?.source?.url==='https://fx.aladdin.club/v2/lock'&&o?.source?.sourceType==='official-frontend-exact-locker-block', 'canonical', 'Exact f(x) Locker source binding.', 'source-provenance'),
    check('apr-parity', finite(o?.aprParityDeltaPctPoints)&&Math.abs(Number(o.aprParityDeltaPctPoints))<=0.01, 'canonical', 'Live Locker APR remains within canonical Productivity parity tolerance.', 'mechanical-parity'),
    check('causal-boundary-preserved', o?.epistemic?.causalAttribution==='unresolved'&&o?.epistemic?.primaryDriver===null, 'canonical', 'Unknown upstream cause remains explicit.', 'epistemic-boundary')
  ];
  if(checks.some(x=>!x.pass)) fail('Existing canonical f(x) lifecycle gate regressed');
  return protocolResult({id,label:policy.protocols[id].label,stage:'canonical',checks,unknowns:['why observed Locker revenue/lock-state inputs changed or caused APR movement remains UNKNOWN outside a proven identity'],policy,previous});
}
function evaluateCurve(state, policy, previous){
  const id='defitea-curve-vecrv', c=state?.cohorts?.[id], o=c?.latest?.observation;
  const checks=[
    check('canonical-cohort-present', Boolean(c&&o), 'canonical', 'Existing canonical Economic Graph cohort exists.', 'canonical-state'),
    check('onchain-source', o?.source?.sourceType==='onchain'&&Boolean(o?.source?.contract), 'canonical', 'Curve Fee Distributor remains onchain-bound.', 'source-provenance'),
    check('formula-proven', o?.formula?.status==='proven-canonical-collector-identity', 'canonical', 'veCRV APR mechanical identity is reproduced.', 'mechanical-identity'),
    check('formula-parity', finite(o?.formulaParityDeltaPctPoints)&&Math.abs(Number(o.formulaParityDeltaPctPoints))<=0.01, 'canonical', 'Formula parity remains inside tolerance.', 'mechanical-parity'),
    check('causal-boundary-preserved', o?.epistemic?.causalAttribution==='unresolved-beyond-formula'&&o?.epistemic?.primaryDriver===null, 'canonical', 'Upstream cause of fee changes remains explicit UNKNOWN.', 'epistemic-boundary')
  ];
  if(checks.some(x=>!x.pass)) fail('Existing canonical Curve lifecycle gate regressed');
  return protocolResult({id,label:policy.protocols[id].label,stage:'canonical',checks,unknowns:['why upstream Curve fee distributions changed remains UNKNOWN'],policy,previous});
}
function loadAerodromePulse(root){
  if(!root) return null;
  return readJson(path.join(root,'intelligence/economic-graph/aerodrome-managed-pulse.json'),false);
}
function evaluateAerodrome(state, policy, previous, root){
  const id='defitea-aerodrome-veaero', c=state?.candidateCohorts?.[id], o=c?.latest?.observation, pulse=loadAerodromePulse(root);
  if(!c||!o) return protocolResult({id,label:policy.protocols[id].label,stage:'discovery',checks:[check('candidate-present',false,'shadow','Aerodrome candidate absent.')],blockers:['candidate-not-materialized'],unknowns:[],policy,previous});
  const min=Number(policy.protocols[id].verifiedMinimumObservationCount||3);
  const checks=[
    check('candidate-present', true, 'shadow', 'Aerodrome candidate is materialized.', 'candidate-state'),
    check('reference-formula-proven', o?.referenceProductivity?.formula?.status==='proven-canonical-collector-identity'&&finite(o?.referenceProductivity?.formula?.parityDeltaPctPoints)&&Math.abs(Number(o.referenceProductivity.formula.parityDeltaPctPoints))<=0.01, 'canonical', '40 Acres Reference APR identity is reproducible.', 'mechanical-identity'),
    check('managed-company-state-measured', o?.actualManagedVeNft?.stateClass==='measured-current-company-compounding-context'&&Number(o?.actualManagedVeNft?.positionCount)>0, 'verified', 'Defitea managed veNFT identity/reward state is measured.', 'company-state'),
    check('observation-depth', Number(c?.observationCount)>=min, 'verified', `At least ${min} distinct candidate observations are retained.`, 'longitudinal-observation'),
    check('pulse-materialized', pulse?.version==='0.1-aerodrome-managed-strategy-pulse'&&pulse?.status==='shadow-measured-not-promoted', 'verified', 'Same-block Aerodrome managed strategy Pulse exists.', 'same-block-protocol-state'),
    check('completed-epoch-accounting', pulse?.epochFlowAccounting?.version==='0.1-aerodrome-reward-epoch-accounting'&&pulse?.epochFlowAccounting?.comparisonPolicy?.completedEpochsComparable===true, 'canonical', 'Two completed epochs are comparable under reward-contract accounting.', 'protocol-accounting'),
    check('market-breath-descriptor', pulse?.marketBreath?.version==='0.1-aerodrome-completed-epoch-directional-breadth'&&pulse?.marketBreath?.interpretation?.prediction===false, 'verified', 'Completed-epoch Market Breath remains descriptive/non-predictive.', 'descriptive-market-breath'),
    check('vote-history-current-parity', pulse?.voteEpochHistory?.version==='0.1-aerodrome-managed-vote-event-reconstruction'&&pulse?.voteEpochHistory?.currentStateParity?.status==='exact-current-state-parity', 'canonical', 'Event-reconstructed managed vote state exactly matches current same-block state.', 'onchain-state-transition'),
    check('pool-volume-context', pulse?.poolMarketContext?.complete===true, 'canonical', 'Canonical pool trading-volume context is tied to the managed voting paths.', 'market-context')
  ];
  const verifiedGate=['reference-formula-proven','managed-company-state-measured','observation-depth','pulse-materialized','completed-epoch-accounting','market-breath-descriptor','vote-history-current-parity'].every(id=>checks.find(x=>x.id===id)?.pass);
  const canonicalGate=verifiedGate&&checks.find(x=>x.id==='pool-volume-context')?.pass;
  const stage=canonicalGate?'canonical':(verifiedGate?'verified':'shadow');
  const unknowns=[
    'why Aerodrome fee/incentive/emission/volume conditions changed remains UNKNOWN unless separately attributed',
    'descriptive vote/reward co-movement is not automatically causal'
  ];
  const blockers=stage==='canonical'?[]:checks.filter(x=>!x.pass).map(x=>x.id);
  return protocolResult({id,label:policy.protocols[id].label,stage,checks,blockers,unknowns,policy,previous});
}
function evaluateVlCvx(state, policy, previous){
  const id='defitea-convex-vlcvx-votium', c=state?.candidateCohorts?.[id], o=c?.latest?.observation, d=c?.deepEconomicEvidence;
  if(!c||!o) return protocolResult({id,label:policy.protocols[id].label,stage:'discovery',checks:[check('candidate-present',false,'shadow','vlCVX/Votium candidate absent.')],blockers:['candidate-not-materialized'],unknowns:[],policy,previous});
  const min=Number(policy.protocols[id].verifiedMinimumObservationCount||2);
  const checks=[
    check('candidate-present', true, 'shadow', 'vlCVX/Votium candidate is materialized.', 'candidate-state'),
    check('reference-decomposition-proven', o?.referenceProductivity?.components?.status==='proven-canonical-reference-decomposition'&&finite(o?.referenceProductivity?.components?.parityDeltaPctPoints)&&Math.abs(Number(o.referenceProductivity.components.parityDeltaPctPoints))<=0.0001, 'canonical', 'Locked CVX + completed Votium round APR decomposition is reproducible.', 'mechanical-identity'),
    check('current-route-measured', o?.companyRoute?.routeId==='votium-union'&&o?.companyRoute?.routeStateClass==='measured-current-canonical-rewards-route', 'verified', 'Current Votium → Union route is measured.', 'company-route'),
    check('observation-depth', Number(c?.observationCount)>=min, 'verified', `At least ${min} candidate observations are retained.`, 'longitudinal-observation'),
    check('deep-evidence-complete', d?.coverage?.complete===true&&Number(d?.coverage?.unresolvedEligiblePoolContexts)===0, 'verified', 'Deep Votium→Curve evidence coverage is complete for current eligible pool context.', 'cross-protocol-coverage'),
    check('voting-provenance', c?.attribution?.votingProvenanceProven===true&&Number(d?.coverage?.onchainVotiumGaugesExactMatched)>0, 'canonical', 'Votium voting provenance is exact-matched to onchain Convex evidence.', 'onchain-provenance'),
    check('vote-to-curve-execution', c?.attribution?.curveGaugeExecutionProven===true&&d?.relations?.voteToExecutedCurveGaugeBps==='ATTRIBUTED-mechanical-execution-proven'&&Number(d?.coverage?.curveExecutedVotiumGaugeRows)>0, 'canonical', 'Vote → Curve gauge execution is mechanically proven.', 'mechanical-execution'),
    check('pool-context-complete', c?.attribution?.currentCurvePoolContextComplete===true&&Number(d?.coverage?.currentCurvePoolContextsComplete)===Number(d?.coverage?.currentCurvePoolEligibleGauges)&&Number(d?.coverage?.currentCurvePoolEligibleGauges)>0, 'verified', 'Every currently eligible Curve gauge has current pool context.', 'downstream-context'),
    check('causal-unknown-preserved', d?.relations?.incentiveToVote==='CORRELATED-only-not-causal'&&d?.relations?.historicalVoteToCurrentPoolState==='CORRELATED-temporal-context-only-not-causal', 'canonical', 'Unproven incentive→vote and vote→pool-outcome causality remains explicitly non-causal.', 'epistemic-boundary'),
    check('aligned-longitudinal-response', !((d?.remainingUnknowns||[]).some(x=>String(x).includes('aligned longitudinal downstream response attribution'))), 'canonical', 'Aligned longitudinal downstream response evidence is no longer an explicit unresolved atom.', 'longitudinal-cross-protocol')
  ];
  const verifiedGate=['reference-decomposition-proven','current-route-measured','observation-depth','deep-evidence-complete','voting-provenance','vote-to-curve-execution','pool-context-complete','causal-unknown-preserved'].every(id=>checks.find(x=>x.id===id)?.pass);
  const canonicalGate=verifiedGate&&checks.find(x=>x.id==='aligned-longitudinal-response')?.pass;
  const stage=canonicalGate?'canonical':(verifiedGate?'verified':'shadow');
  const unknowns=Array.isArray(d?.remainingUnknowns)?d.remainingUnknowns:[];
  const blockers=stage==='canonical'?[]:checks.filter(x=>!x.pass).map(x=>x.id);
  return protocolResult({id,label:policy.protocols[id].label,stage,checks,blockers,unknowns,policy,previous});
}

export function applyProtocolLifecycle({state,previousState,root,policy=readJson(POLICY_FILE)}){
  if(!state||typeof state!=='object') fail('Protocol lifecycle requires Economic Graph state');
  if(state?.authority?.executionAuthority!=='none'||state?.authority?.causalClaimAuthority!=='none') fail('Protocol lifecycle refuses Economic Graph authority drift');
  assertPolicy(policy);
  const previous=previousState?.protocolLifecycle||null;
  const protocols={};
  for(const result of [
    evaluateFxn(state,policy,previous),
    evaluateCurve(state,policy,previous),
    evaluateAerodrome(state,policy,previous,root),
    evaluateVlCvx(state,policy,previous)
  ]) protocols[result.protocolId]=result;

  const priorTransitions=Array.isArray(previous?.transitions)?previous.transitions:[];
  const transitions=[...priorTransitions];
  for(const p of Object.values(protocols)){
    if(!p.transitionFingerprint) continue;
    if(transitions.some(x=>x.fingerprint===p.transitionFingerprint)) continue;
    transitions.push({
      fingerprint:p.transitionFingerprint,
      protocolId:p.protocolId,
      from:p.priorMaturityStage,
      to:p.maturityStage,
      observedAt:state.generatedAt||new Date().toISOString(),
      automatic:true,
      reason:'deterministic-pre-approved-evidence-gate'
    });
  }
  const bounded=transitions.slice(-MAX_TRANSITIONS);
  const counts=Object.values(protocols).reduce((acc,p)=>{acc[p.maturityStage]=(acc[p.maturityStage]||0)+1;return acc;},{});
  state.protocolLifecycle={
    version:'0.1-protocol-intelligence-lifecycle',
    policyVersion:policy.version,
    generatedAt:state.generatedAt||new Date().toISOString(),
    status:'active',
    stageOrder:policy.stageOrder,
    scope:policy.scope,
    authority:{...policy.authority,promotionMeaning:'evidence/consumer maturity only; never capital, prediction or causal authority'},
    semantics:{...policy.laws,protocolWideCanonicalDoesNotEraseUnknownEdges:true},
    summary:{protocolCount:Object.keys(protocols).length,stageCounts:counts,automaticTransitionsRecorded:bounded.length},
    protocols,
    transitions:bounded,
    nextProtocolTemplate:'New Defitea protocols enter the same lifecycle registry; reuse existing collectors and add only true mechanism deltas.'
  };
  return state;
}
