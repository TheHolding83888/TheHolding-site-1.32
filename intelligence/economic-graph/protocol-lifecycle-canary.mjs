#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { applyProtocolLifecycle } from './protocol-lifecycle.mjs';
import { applyPendleSPendleLifecycle } from './pendle-spendle-lifecycle.mjs';
import { applyPendleAccountingEvidence } from './pendle-spendle-accounting-evidence.mjs';

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
      protocol:'Pendle',sourceUrl:'https://api-v2.pendle.finance/core/v1/spendle/data',sourceType:'official-api+official-merkle+onchain-survivor-diagnostic',nativeCadence:'14d',
      status:'warming',aprLatest:null,lastUpdatedAt:'2026-08-25T18:00:00.000Z',periodStart:'2026-08-11T00:00:00.000Z',periodEnd:'2026-08-25T00:00:00.000Z',
      details:{
        historyCount:12,publishedApr:0,revenue:282160,buybackAmount:0,selectionRule:'zero-apr-positive-reward-survivor-cluster-not-yet-replicated',mappedMerkleCampaign:null,
        research:{
          campaignCount:3,
          epochMap:{
            pairCount:3,exactAmountMatches:3,offsetConsensus:true,offsetSeconds:259200,offsetDays:3,maxOffsetDeviationSeconds:0,
            pairs:[
              {campaign:'2026-08-14-spendle',apiIndex:2,apiPeriodStart:'2026-07-28T00:00:00.000Z',apiPeriodEnd:'2026-08-11T00:00:00.000Z',merklePeriodStart:'2026-07-31T00:00:00.000Z',merklePeriodEnd:'2026-08-14T00:00:00.000Z',apiRevenue:359625.56,apiBuybackAmount:199338,merkleReward:199338,amountDifference:0,amountMatch:true,startOffsetSeconds:259200,endOffsetSeconds:259200,offsetDays:3,offsetDriftSeconds:0},
              {campaign:'2026-08-01-spendle',apiIndex:3,apiPeriodStart:'2026-07-14T00:00:00.000Z',apiPeriodEnd:'2026-07-28T00:00:00.000Z',merklePeriodStart:'2026-07-17T00:00:00.000Z',merklePeriodEnd:'2026-07-31T00:00:00.000Z',apiRevenue:312875.16,apiBuybackAmount:144388,merkleReward:144388,amountDifference:0,amountMatch:true,startOffsetSeconds:259200,endOffsetSeconds:259200,offsetDays:3,offsetDriftSeconds:0},
              {campaign:'2026-07-18-spendle',apiIndex:4,apiPeriodStart:'2026-06-30T00:00:00.000Z',apiPeriodEnd:'2026-07-14T00:00:00.000Z',merklePeriodStart:'2026-07-03T00:00:00.000Z',merklePeriodEnd:'2026-07-17T00:00:00.000Z',apiRevenue:270669.23,apiBuybackAmount:149086,merkleReward:149086,amountDifference:0,amountMatch:true,startOffsetSeconds:259200,endOffsetSeconds:259200,offsetDays:3,offsetDriftSeconds:0}
            ]
          },
          survivorReplication:{replicated:true,validCampaigns:3,minRequiredCampaigns:2,minClusterSize:30,minClusterDensity:0.25,maxSpreadBps:75,maxSupplyDeviationPct:5,observedSupplyMedian:225738672,observedMaxSupplyDeviationPct:2.35,supplyConsistencyOk:true},
          rewardScope:'sPENDLE buyback distribution only',denominatorPolicy:'replicated survivor reconstruction'
        },
        currentSupply:{observedAt:1787724445,periodEnd:'2026-08-25T18:00:00.000Z',totalPendleStaked:97877709,totalStakedInSpendle:34101709,virtualSpendleFromVependle:181929666,currentEffectiveSupply:216031375}
      }
    }
  },
  companies:{'defitea.eth':{breakdown:[{engineId:'pendle_spendle',units:500,value:872.53,apr:null,engineStatus:'warming'}]}}
};}
function validatedPendleProductivity({periodStart,periodEnd,observedAt,apr}){
  const p=pendleProductivity();
  p.generatedAt=observedAt;
  const e=p.engines.pendle_spendle;
  e.status='ok';
  e.aprLatest=apr;
  e.lastUpdatedAt=observedAt;
  e.periodStart=periodStart;
  e.periodEnd=periodEnd;
  e.details.selectionRule='replicated-current-balance-survivor-cluster';
  e.details.mappedMerkleCampaign={campaign:`${periodEnd.slice(0,10)}-spendle`,merkleReward:175000,startOffsetSeconds:259200};
  p.companies['defitea.eth'].breakdown[0].apr=apr;
  p.companies['defitea.eth'].breakdown[0].engineStatus='ok';
  return p;
}
const policy={
  version:'0.1-protocol-intelligence-lifecycle-policy',
  revision:'0.3-pendle-distinct-period-verification',
  stageOrder:['discovery','shadow','verified','canonical'],
  scope:{companyRegistry:'004',company:'defitea.eth',protocolIds:['defitea-fxn-vefxn','defitea-curve-vecrv','defitea-aerodrome-veaero','defitea-convex-vlcvx-votium','defitea-pendle-spendle']},
  authority:{automaticStageEvaluation:true,automaticEvidencePromotion:true,automaticProtocolWidePromotion:true,promotionRuleMutationAuthority:false,repositoryMutationAuthority:false,workflowDispatchAuthority:false,executionAuthority:'none',capitalExecution:false,walletAuthority:false,allocationAuthority:false,recommendationAuthority:false,predictionAuthority:false,causalClaimAuthority:'none',methodologyMutationAuthority:false},
  laws:{unknownIsNotZero:true,correlationIsNotCausation:true,longitudinalDepthRequiresDistinctNativePeriods:true},
  protocols:{
    'defitea-fxn-vefxn':{label:'f(x) / veFXN'},
    'defitea-curve-vecrv':{label:'Curve / veCRV'},
    'defitea-aerodrome-veaero':{label:'Aerodrome / veAERO',verifiedMinimumObservationCount:3},
    'defitea-convex-vlcvx-votium':{label:'Convex / vlCVX / Votium → Curve',verifiedMinimumObservationCount:2},
    'defitea-pendle-spendle':{label:'Pendle / sPENDLE',verifiedMinimumValidatedPeriodCount:2,verifiedMinimumValidatedObservationCount:2}
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
function lifecycleSeed(previousState=null){return applyProtocolLifecycle({state:base(),previousState,root,policy});}
function applyValidatedPendle(previousState,productivity,shaChar){
  return applyPendleSPendleLifecycle({state:lifecycleSeed(previousState),previousState,productivity,productivitySha256:shaChar.repeat(64),policy});
}

const initial=lifecycleSeed();
if(initial.protocolLifecycle.protocols['defitea-aerodrome-veaero'].maturityStage!=='verified') throw new Error('Aerodrome must be VERIFIED until pool-volume context closes');
if(initial.protocolLifecycle.protocols['defitea-convex-vlcvx-votium'].maturityStage!=='verified') throw new Error('vlCVX must be VERIFIED until aligned longitudinal response closes');
if(initial.protocolLifecycle.protocols['defitea-fxn-vefxn'].maturityStage!=='canonical'||initial.protocolLifecycle.protocols['defitea-curve-vecrv'].maturityStage!=='canonical') throw new Error('Existing canonical cohorts regressed');

const productivity=pendleProductivity();
const withPendle=applyPendleSPendleLifecycle({state:initial,previousState:null,productivity,productivitySha256:'a'.repeat(64),policy});
const withPendleAccounting=applyPendleAccountingEvidence({state:withPendle,productivity,productivitySha256:'a'.repeat(64)});
const pendle=withPendleAccounting.protocolLifecycle.protocols['defitea-pendle-spendle'];
const pendleObservation=withPendleAccounting.protocolSensors?.['defitea-pendle-spendle']?.latest?.observation;
const pendleAccounting=withPendleAccounting.protocolEvidence?.['defitea-pendle-spendle-accounting'];
if(pendle?.maturityStage!=='shadow') throw new Error(`Pendle warming sensor must enter SHADOW, got ${pendle?.maturityStage}`);
if(!pendleObservation||withPendleAccounting.protocolLifecycle.summary?.protocolCount!==5) throw new Error('Pendle sensor/lifecycle registry not materialized');
if(pendleObservation.referenceProductivity?.currentAprPct!==null) throw new Error('Pendle UNKNOWN Reference APR was coerced to a number');
if(pendleObservation.companyPosition?.positionAprPct!==null) throw new Error('Pendle UNKNOWN company position APR was coerced to a number');
if(!pendle.checks.find(x=>x.id==='false-zero-fail-closed')?.pass) throw new Error('Pendle false-zero fail-closed gate regressed');
if(pendle.checks.find(x=>x.id==='current-reference-apr-validated')?.pass) throw new Error('Pendle warming current APR was over-promoted');
if(withPendleAccounting.protocolLifecycle.authority?.executionAuthority!=='none') throw new Error('Pendle expanded lifecycle execution authority');
if(pendleAccounting?.status!=='historical-distribution-publication-identity-proven') throw new Error('Pendle historical API/Merkle accounting identity was not proven');
if(pendleAccounting?.coverage?.mappedCampaigns!==3||pendleAccounting?.coverage?.amountMatches!==3) throw new Error('Pendle accounting evidence coverage mismatch');
if(pendleAccounting?.relations?.apiBuybackAmountToMerkleDistribution!=='ATTRIBUTED-mechanical-publication-parity-within-canonical-tolerance') throw new Error('Pendle mechanical distribution parity missing');
if(!String(pendleAccounting?.relations?.protocolRevenueToBuyback||'').startsWith('UNKNOWN-')) throw new Error('Pendle revenue causality was over-promoted');
if(pendleAccounting?.authority?.executionAuthority!=='none'||pendleAccounting?.authority?.causalClaimAuthority!=='none') throw new Error('Pendle accounting evidence expanded authority');

const periodA1=validatedPendleProductivity({periodStart:'2026-08-11T00:00:00.000Z',periodEnd:'2026-08-25T00:00:00.000Z',observedAt:'2026-08-29T04:17:00.000Z',apr:18.5});
const firstValidated=applyValidatedPendle(null,periodA1,'b');
if(firstValidated.protocolLifecycle.protocols['defitea-pendle-spendle'].maturityStage!=='shadow') throw new Error('One validated Pendle period must remain SHADOW');
if(firstValidated.protocolSensors['defitea-pendle-spendle'].validatedPeriodCount!==1) throw new Error('First Pendle validated period was not counted exactly once');

const periodA2=validatedPendleProductivity({periodStart:'2026-08-11T00:00:00.000Z',periodEnd:'2026-08-25T00:00:00.000Z',observedAt:'2026-09-05T04:17:00.000Z',apr:18.5});
const repeatedSamePeriod=applyValidatedPendle(firstValidated,periodA2,'c');
const repeatedProtocol=repeatedSamePeriod.protocolLifecycle.protocols['defitea-pendle-spendle'];
const repeatedSensor=repeatedSamePeriod.protocolSensors['defitea-pendle-spendle'];
if(repeatedSensor.validatedObservationCount!==2||repeatedSensor.validatedPeriodCount!==1) throw new Error('Repeated Pendle snapshots must not manufacture longitudinal period depth');
if(repeatedProtocol.maturityStage!=='shadow'||repeatedProtocol.checks.find(x=>x.id==='validated-longitudinal-depth')?.pass) throw new Error('Two snapshots of one Pendle period falsely promoted lifecycle depth');

const periodB=validatedPendleProductivity({periodStart:'2026-08-25T00:00:00.000Z',periodEnd:'2026-09-08T00:00:00.000Z',observedAt:'2026-09-12T04:17:00.000Z',apr:16.25});
const secondDistinctPeriod=applyValidatedPendle(repeatedSamePeriod,periodB,'d');
const distinctProtocol=secondDistinctPeriod.protocolLifecycle.protocols['defitea-pendle-spendle'];
const distinctSensor=secondDistinctPeriod.protocolSensors['defitea-pendle-spendle'];
if(distinctSensor.validatedPeriodCount!==2||distinctSensor.validatedObservationCount!==3) throw new Error('Pendle distinct-period depth accounting mismatch');
if(distinctProtocol.maturityStage!=='verified'||!distinctProtocol.automaticallyPromoted) throw new Error('Two distinct validated Pendle periods did not deterministically promote SHADOW → VERIFIED');
if(!distinctProtocol.checks.find(x=>x.id==='validated-longitudinal-depth')?.pass) throw new Error('Pendle distinct-period gate did not close after second native period');
if(distinctProtocol.longitudinalEvidence?.requiredValidatedPeriodCount!==2) throw new Error('Pendle required distinct-period depth missing');

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
