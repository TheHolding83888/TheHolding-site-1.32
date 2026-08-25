#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { applyProtocolLifecycle } from './protocol-lifecycle.mjs';

function base(){
  return {
    generatedAt:'2026-08-25T18:00:00.000Z',
    authority:{executionAuthority:'none',causalClaimAuthority:'none'},
    cohorts:{
      'defitea-fxn-vefxn':{latest:{observation:{source:{url:'https://fx.aladdin.club/v2/lock',sourceType:'official-frontend-exact-locker-block'},aprParityDeltaPctPoints:0,epistemic:{causalAttribution:'unresolved',primaryDriver:null}}}},
      'defitea-curve-vecrv':{latest:{observation:{source:{sourceType:'onchain',contract:'0x1'},formula:{status:'proven-canonical-collector-identity'},formulaParityDeltaPctPoints:0,epistemic:{causalAttribution:'unresolved-beyond-formula',primaryDriver:null}}}}
    },
    candidateCohorts:{
      'defitea-aerodrome-veaero':{observationCount:3,latest:{observation:{referenceProductivity:{formula:{status:'proven-canonical-collector-identity',parityDeltaPctPoints:0}},actualManagedVeNft:{stateClass:'measured-current-company-compounding-context',positionCount:1}}}},
      'defitea-convex-vlcvx-votium':{observationCount:2,latest:{observation:{referenceProductivity:{components:{status:'proven-canonical-reference-decomposition',parityDeltaPctPoints:0}},companyRoute:{routeId:'votium-union',routeStateClass:'measured-current-canonical-rewards-route'}}},attribution:{votingProvenanceProven:true,curveGaugeExecutionProven:true,currentCurvePoolContextComplete:true},deepEconomicEvidence:{coverage:{complete:true,unresolvedEligiblePoolContexts:0,onchainVotiumGaugesExactMatched:79,curveExecutedVotiumGaugeRows:79,currentCurvePoolContextsComplete:31,currentCurvePoolEligibleGauges:31},relations:{incentiveToVote:'CORRELATED-only-not-causal',voteToExecutedCurveGaugeBps:'ATTRIBUTED-mechanical-execution-proven',historicalVoteToCurrentPoolState:'CORRELATED-temporal-context-only-not-causal'},remainingUnknowns:['aligned longitudinal downstream response attribution across comparable rounds/epochs']}}
    }
  };
}
const policy={
  version:'0.1-protocol-intelligence-lifecycle-policy',
  stageOrder:['discovery','shadow','verified','canonical'],
  scope:{companyRegistry:'004',company:'defitea.eth',protocolIds:['defitea-fxn-vefxn','defitea-curve-vecrv','defitea-aerodrome-veaero','defitea-convex-vlcvx-votium']},
  authority:{automaticStageEvaluation:true,automaticEvidencePromotion:true,automaticProtocolWidePromotion:true,promotionRuleMutationAuthority:false,repositoryMutationAuthority:false,workflowDispatchAuthority:false,executionAuthority:'none',capitalExecution:false,walletAuthority:false,allocationAuthority:false,recommendationAuthority:false,predictionAuthority:false,causalClaimAuthority:'none',methodologyMutationAuthority:false},
  laws:{unknownIsNotZero:true,correlationIsNotCausation:true},
  protocols:{
    'defitea-fxn-vefxn':{label:'f(x) / veFXN'},
    'defitea-curve-vecrv':{label:'Curve / veCRV'},
    'defitea-aerodrome-veaero':{label:'Aerodrome / veAERO',verifiedMinimumObservationCount:3},
    'defitea-convex-vlcvx-votium':{label:'Convex / vlCVX / Votium → Curve',verifiedMinimumObservationCount:2}
  }
};

const root=fs.mkdtempSync(path.join(os.tmpdir(),'protocol-lifecycle-canary-'));
fs.mkdirSync(path.join(root,'intelligence/economic-graph'),{recursive:true});
fs.writeFileSync(path.join(root,'intelligence/economic-graph/aerodrome-managed-pulse.json'),JSON.stringify({
  version:'0.1-aerodrome-managed-strategy-pulse',status:'shadow-measured-not-promoted',
  epochFlowAccounting:{version:'0.1-aerodrome-reward-epoch-accounting',comparisonPolicy:{completedEpochsComparable:true}},
  marketBreath:{version:'0.1-aerodrome-completed-epoch-directional-breadth',interpretation:{prediction:false}},
  voteEpochHistory:{version:'0.1-aerodrome-managed-vote-event-reconstruction',currentStateParity:{status:'exact-current-state-parity'}}
}));
const initial=applyProtocolLifecycle({state:base(),previousState:null,root,policy});
if(initial.protocolLifecycle.protocols['defitea-aerodrome-veaero'].maturityStage!=='verified') throw new Error('Aerodrome must be VERIFIED until pool-volume context closes');
if(initial.protocolLifecycle.protocols['defitea-convex-vlcvx-votium'].maturityStage!=='verified') throw new Error('vlCVX must be VERIFIED until aligned longitudinal response closes');
if(initial.protocolLifecycle.protocols['defitea-fxn-vefxn'].maturityStage!=='canonical'||initial.protocolLifecycle.protocols['defitea-curve-vecrv'].maturityStage!=='canonical') throw new Error('Existing canonical cohorts regressed');

const promoted=base();
promoted.candidateCohorts['defitea-convex-vlcvx-votium'].deepEconomicEvidence.remainingUnknowns=[];
const promotedOut=applyProtocolLifecycle({state:promoted,previousState:initial,root,policy});
if(promotedOut.protocolLifecycle.protocols['defitea-convex-vlcvx-votium'].maturityStage!=='canonical') throw new Error('Deterministic vlCVX promotion did not occur after gate closed');
if(!promotedOut.protocolLifecycle.protocols['defitea-convex-vlcvx-votium'].automaticallyPromoted) throw new Error('Automatic promotion transition not recorded');

const bad=base();
bad.candidateCohorts['defitea-convex-vlcvx-votium'].deepEconomicEvidence.relations.incentiveToVote='ATTRIBUTED-causal';
bad.candidateCohorts['defitea-convex-vlcvx-votium'].deepEconomicEvidence.remainingUnknowns=[];
const badOut=applyProtocolLifecycle({state:bad,previousState:null,root,policy});
if(badOut.protocolLifecycle.protocols['defitea-convex-vlcvx-votium'].maturityStage==='canonical') throw new Error('False causal promotion was not blocked');

console.log('PROTOCOL INTELLIGENCE LIFECYCLE CANARY PASS');
