#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { applyProtocolLifecycle } from './protocol-lifecycle.mjs';
import { applyPendleSPendleLifecycle } from './pendle-spendle-lifecycle.mjs';

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
function pendleProductivity(){return{
  generatedAt:'2026-08-25T18:00:00.000Z',
  engines:{
    pendle_spendle:{
      protocol:'Pendle',sourceUrl:'https://api-v2.pendle.finance/core/v1/spendle/data',nativeCadence:'14d',
      status:'warming',aprLatest:null,lastUpdatedAt:'2026-08-25T18:00:00.000Z',periodStart:'2026-08-11T00:00:00.000Z',periodEnd:'2026-08-25T00:00:00.000Z',
      details:{
        historyCount:12,publishedApr:0,revenue:282160,buybackAmount:0,selectionRule:'zero-apr-positive-reward-survivor-cluster-not-yet-replicated',mappedMerkleCampaign:null,
        research:{
          campaignCount:8,
          epochMap:{pairCount:8,exactAmountMatches:8,offsetConsensus:true,offsetSeconds:259200,offsetDays:3,maxOffsetDeviationSeconds:0},
          survivorReplication:{replicated:true,validCampaigns:3,minRequiredCampaigns:2,minClusterSize:30,minClusterDensity:0.25,maxSpreadBps:75,maxSupplyDeviationPct:5,observedSupplyMedian:225738672,observedMaxSupplyDeviationPct:2.35,supplyConsistencyOk:true},
          rewardScope:'sPENDLE buyback distribution only',denominatorPolicy:'replicated survivor reconstruction'
        },
        currentSupply:{observedAt:1787724445,periodEnd:'2026-08-25T18:00:00.000Z',totalPendleStaked:97877709,totalStakedInSpendle:34101709,virtualSpendleFromVependle:181929666,currentEffectiveSupply:216031375}
      }
    }
  },
  companies:{'defitea.eth':{breakdown:[{engineId:'pendle_spendle',units:500,value:872.53,apr:null,engineStatus:'warming'}]}}
};}
const policy={
  version:'0.1-protocol-intelligence-lifecycle-policy',
  revision:'0.2-pendle-spendle-admission',
  stageOrder:['discovery','shadow','verified','canonical'],
  scope:{companyRegistry:'004',company:'defitea.eth',protocolIds:['defitea-fxn-vefxn','defitea-curve-vecrv','defitea-aerodrome-veaero','defitea-convex-vlcvx-votium','defitea-pendle-spendle']},
  authority:{automaticStageEvaluation:true,automaticEvidencePromotion:true,automaticProtocolWidePromotion:true,promotionRuleMutationAuthority:false,repositoryMutationAuthority:false,workflowDispatchAuthority:false,executionAuthority:'none',capitalExecution:false,walletAuthority:false,allocationAuthority:false,recommendationAuthority:false,predictionAuthority:false,causalClaimAuthority:'none',methodologyMutationAuthority:false},
  laws:{unknownIsNotZero:true,correlationIsNotCausation:true},
  protocols:{
    'defitea-fxn-vefxn':{label:'f(x) / veFXN'},
    'defitea-curve-vecrv':{label:'Curve / veCRV'},
    'defitea-aerodrome-veaero':{label:'Aerodrome / veAERO',verifiedMinimumObservationCount:3},
    'defitea-convex-vlcvx-votium':{label:'Convex / vlCVX / Votium → Curve',verifiedMinimumObservationCount:2},
    'defitea-pendle-spendle':{label:'Pendle / sPENDLE',verifiedMinimumValidatedObservationCount:2}
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

const withPendle=applyPendleSPendleLifecycle({state:initial,previousState:null,productivity:pendleProductivity(),productivitySha256:'a'.repeat(64),policy});
const pendle=withPendle.protocolLifecycle.protocols['defitea-pendle-spendle'];
const pendleObservation=withPendle.protocolSensors?.['defitea-pendle-spendle']?.latest?.observation;
if(pendle?.maturityStage!=='shadow') throw new Error(`Pendle warming sensor must enter SHADOW, got ${pendle?.maturityStage}`);
if(!pendleObservation||withPendle.protocolLifecycle.summary?.protocolCount!==5) throw new Error('Pendle sensor/lifecycle registry not materialized');
if(pendleObservation.referenceProductivity?.currentAprPct!==null) throw new Error('Pendle UNKNOWN Reference APR was coerced to a number');
if(pendleObservation.companyPosition?.positionAprPct!==null) throw new Error('Pendle UNKNOWN company position APR was coerced to a number');
if(!pendle.checks.find(x=>x.id==='false-zero-fail-closed')?.pass) throw new Error('Pendle false-zero fail-closed gate regressed');
if(pendle.checks.find(x=>x.id==='current-reference-apr-validated')?.pass) throw new Error('Pendle warming current APR was over-promoted');
if(withPendle.protocolLifecycle.authority?.executionAuthority!=='none') throw new Error('Pendle expanded lifecycle execution authority');

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
