#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { applyProtocolLifecycle } from './protocol-lifecycle.mjs';
import { applyPendleSPendleLifecycle } from './pendle-spendle-lifecycle.mjs';
import { applyPendleAccountingEvidence } from './pendle-spendle-accounting-evidence.mjs';
import { applyYieldBasisLifecycle } from './yieldbasis-lifecycle.mjs';
import { applyVelodromeLifecycle } from './ve-gauge-registry-lifecycle.mjs';

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
function yieldBasisProductivity({snapshotKey='2026-W35',generatedAt='2026-08-26T06:08:02.250Z',veApr=4.88,wbtcApr=-0.407039,wethApr=-1.806478}={}){
  const start='2026-07-12T00:00:00.000Z';
  const end='2026-08-11T00:00:00.000Z';
  const days=(Date.parse(end)-Date.parse(start))/864e5;
  const ppsAgoBtc=1.007419079525;
  const ppsAgoEth=1.01240802867;
  const ppsNowBtc=ppsAgoBtc*((1+wbtcApr/100)**(days/365));
  const ppsNowEth=ppsAgoEth*((1+wethApr/100)**(days/365));
  return {
    version:'1.16',snapshotKey,generatedAt,
    engines:{
      yieldbasis_veyb:{engineId:'yieldbasis_veyb',protocol:'Yield Basis',principalSymbol:'YB',sourceUrl:'https://yieldbasis.com/analytics',nativeCadence:'epoch',aprLatest:veApr,sourceType:'official-analytics',sourceMetric:'veYB APR · current/latest epoch',periodStart:null,periodEnd:generatedAt,lastUpdatedAt:generatedAt,status:'ok',details:{}},
      yieldbasis_yblp_wbtc:{engineId:'yieldbasis_yblp_wbtc',protocol:'Yield Basis',principalSymbol:'BTC',sourceUrl:'companies/company-007-resolve.json',nativeCadence:'30d',aprLatest:wbtcApr,sourceType:'local-verified-resolver',sourceMetric:'Yield Basis FT APY (30D) · fundamental PPS growth · emissions excluded',periodStart:start,periodEnd:end,lastUpdatedAt:generatedAt,status:'ok',details:{market:'yb-WBTC',ppsNow:ppsNowBtc,pps30dAgo:ppsAgoBtc,historicalProvider:'ethereum-history:test',resolverVersion:'1.8-canonical-quantity-source-mesh'}},
      yieldbasis_yblp_weth:{engineId:'yieldbasis_yblp_weth',protocol:'Yield Basis',principalSymbol:'ETH',sourceUrl:'companies/company-007-resolve.json',nativeCadence:'30d',aprLatest:wethApr,sourceType:'local-verified-resolver',sourceMetric:'Yield Basis FT APY (30D) · fundamental PPS growth · emissions excluded',periodStart:start,periodEnd:end,lastUpdatedAt:generatedAt,status:'ok',details:{market:'yb-WETH',ppsNow:ppsNowEth,pps30dAgo:ppsAgoEth,historicalProvider:'ethereum-history:test',resolverVersion:'1.8-canonical-quantity-source-mesh'}}
    },
    companies:{
      'company-a':{name:'Company A',breakdown:[{engineId:'yieldbasis_veyb',principalId:'yield-basis',units:10846,value:1033.52,apr:veApr,engineStatus:'ok'}]},
      'company-b':{name:'Company B',breakdown:[{engineId:'yieldbasis_veyb',principalId:'yield-basis',units:12029,value:1146.25,apr:veApr,engineStatus:'ok'}]},
      'company-c':{name:'Company C',breakdown:[{engineId:'yieldbasis_yblp_wbtc',principalId:'bitcoin',units:0.00335757,value:265.45,apr:wbtcApr,engineStatus:'ok'},{engineId:'yieldbasis_yblp_weth',principalId:'ethereum',units:0.2930932794,value:722.36,apr:wethApr,engineStatus:'ok'}]}
    }
  };
}
function velodromeProductivity({snapshotKey='2026-W35',generatedAt='2026-08-26T06:08:02.250Z',weekly=48,apr=24.96}={}){
  return {
    version:'1.16',snapshotKey,generatedAt,
    engines:{
      velodrome_vevelo:{engineId:'velodrome_vevelo',protocol:'Velodrome',principalSymbol:'VELO',sourceUrl:'https://www.40acres.finance/',nativeCadence:'weekly',aprLatest:apr,sourceType:'official-frontend',sourceMetric:'40 Acres simulator gross expected weekly voting rewards annualized',periodStart:null,periodEnd:generatedAt,lastUpdatedAt:generatedAt,status:'ok',details:{maxBorrow:3000,ltv:30,weekly,impliedVeNftValue:10000}}
    },
    companies:{
      'company-a':{name:'Company A',breakdown:[{engineId:'velodrome_vevelo',principalId:'velodrome-finance',units:12180,value:269.39,apr,engineStatus:'ok'}]},
      'company-b':{name:'Company B',breakdown:[{engineId:'velodrome_vevelo',principalId:'velodrome-finance',units:28326,value:626.51,apr,engineStatus:'ok'}]},
      'company-c':{name:'Company C',breakdown:[{engineId:'velodrome_vevelo',principalId:'velodrome-finance',units:6971.925992,value:154.2,apr,engineStatus:'ok'}]}
    }
  };
}
function velodromeRewards({generatedAt='2026-08-26T05:52:34.772Z',amountRaw='2500000'}={}){
  return {
    generatedAt,
    methodology:{aerodromeVelodrome:'Direct veAERO/veVELO Accrued Rewards use bounded operational accounting. The collector discovers only the fresh 180-day Voted tail. Already distributed wallet payouts are not counted as accrued rewards.'},
    internalState:{historicalVoteCache:{
      'optimism:32671':{providerKey:'optimism',complete:true,throughBlock:155414329,pools:['0xpool1','0xpool2','0xpool3'],firstVoteBlock:150950754,lastVoteBlock:155182618,mintDiscovery:{blockNumber:144748388}},
      'optimism:11335':{providerKey:'optimism',complete:true,throughBlock:155414756,pools:['0xpool2','0xpool4'],firstVoteBlock:120000000,lastVoteBlock:155100000,mintDiscovery:{blockNumber:107506553}}
    }},
    companies:{
      'company-a':{rewards:[{protocol:'Velodrome · veVELO',route:'velodrome-ve',chain:'Optimism',token:'0x0000000000000000000000000000000000000001',symbol:'USDC',amountRaw,decimals:6,usdValue:2.5,wallet:'0xaaa',walletAlias:'company-a',tokenId:'32671'}]},
      'company-b':{rewards:[{protocol:'Velodrome · veVELO',route:'velodrome-ve',chain:'Optimism',token:'0x0000000000000000000000000000000000000002',symbol:'WETH',amountRaw:'1000000000000000',decimals:18,usdValue:2.4,wallet:'0xbbb',walletAlias:'company-b',tokenId:'11335'}]}
    }
  };
}
const policy={
  version:'0.1-protocol-intelligence-lifecycle-policy',
  revision:'0.5-registry-wide-velodrome-ve-gauge-admission',
  stageOrder:['discovery','shadow','verified','canonical'],
  scope:{mode:'mixed-company-and-registry-wide-protocols',companyRegistry:'004',company:'defitea.eth',registryWideProtocolIds:['registry-yieldbasis-multimechanism','registry-velodrome-vevelo'],protocolIds:['defitea-fxn-vefxn','defitea-curve-vecrv','defitea-aerodrome-veaero','defitea-convex-vlcvx-votium','defitea-pendle-spendle','registry-yieldbasis-multimechanism','registry-velodrome-vevelo']},
  authority:{automaticStageEvaluation:true,automaticEvidencePromotion:true,automaticProtocolWidePromotion:true,promotionRuleMutationAuthority:false,repositoryMutationAuthority:false,workflowDispatchAuthority:false,executionAuthority:'none',capitalExecution:false,walletAuthority:false,allocationAuthority:false,recommendationAuthority:false,predictionAuthority:false,causalClaimAuthority:'none',methodologyMutationAuthority:false},
  laws:{unknownIsNotZero:true,correlationIsNotCausation:true,longitudinalDepthRequiresDistinctNativePeriods:true,protocolSensorsMaySpanMultipleCompaniesWithoutCollapsingMechanismSemantics:true,veGaugeFamilyReuseMustPreserveProtocolSpecificEvidenceBoundaries:true},
  protocols:{
    'defitea-fxn-vefxn':{label:'f(x) / veFXN'},
    'defitea-curve-vecrv':{label:'Curve / veCRV'},
    'defitea-aerodrome-veaero':{label:'Aerodrome / veAERO',verifiedMinimumObservationCount:3},
    'defitea-convex-vlcvx-votium':{label:'Convex / vlCVX / Votium → Curve',verifiedMinimumObservationCount:2},
    'defitea-pendle-spendle':{label:'Pendle / sPENDLE',verifiedMinimumValidatedPeriodCount:2,verifiedMinimumValidatedObservationCount:2},
    'registry-yieldbasis-multimechanism':{label:'Yield Basis / veYB + yb-LP',scope:'registry-wide-multi-company',verifiedMinimumDistinctSnapshotCount:2},
    'registry-velodrome-vevelo':{label:'Velodrome / veVELO',scope:'registry-wide-multi-company-ve-gauge',family:'ve-gauge',verifiedMinimumDistinctSnapshotCount:2}
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

const yieldBasisBase=structuredClone(withPendleAccounting);
const ybA1=yieldBasisProductivity({snapshotKey:'2026-W35',generatedAt:'2026-08-26T06:08:02.250Z'});
const firstYieldBasis=applyYieldBasisLifecycle({state:structuredClone(yieldBasisBase),previousState:null,productivity:ybA1,productivitySha256:'e'.repeat(64),policy});
const firstYbProtocol=firstYieldBasis.protocolLifecycle.protocols['registry-yieldbasis-multimechanism'];
const firstYbSensor=firstYieldBasis.protocolSensors['registry-yieldbasis-multimechanism'];
if(firstYieldBasis.protocolLifecycle.summary?.protocolCount!==6) throw new Error('Yield Basis did not become the sixth lifecycle sensor');
if(firstYbProtocol?.maturityStage!=='shadow'||firstYbSensor?.validatedSnapshotCount!==1) throw new Error('First validated Yield Basis composite snapshot must remain SHADOW');
if(!(firstYbSensor.latest.observation.mechanisms.ybWbtc.currentAprPct<0)&&!(firstYbSensor.latest.observation.mechanisms.ybWeth.currentAprPct<0)) throw new Error('Yield Basis signed negative FT APY semantics not exercised');
if(!firstYbProtocol.checks.find(x=>x.id==='signed-return-semantics')?.pass) throw new Error('Yield Basis negative FT APY was not accepted as a valid signed economic return');
if(!firstYbProtocol.checks.find(x=>x.id==='yb-wbtc-pps-formula-parity')?.pass||!firstYbProtocol.checks.find(x=>x.id==='yb-weth-pps-formula-parity')?.pass) throw new Error('Yield Basis LP PPS formula parity missing');
if(firstYbProtocol.checks.find(x=>x.id==='veyb-revenue-apr-accounting-identity')?.pass) throw new Error('Yield Basis veYB revenue/APR accounting identity was falsely promoted');
if(firstYieldBasis.protocolLifecycle.authority?.executionAuthority!=='none') throw new Error('Yield Basis expanded lifecycle execution authority');

const ybA2=yieldBasisProductivity({snapshotKey:'2026-W35',generatedAt:'2026-08-27T06:08:02.250Z'});
const repeatedYieldBasis=applyYieldBasisLifecycle({state:structuredClone(yieldBasisBase),previousState:firstYieldBasis,productivity:ybA2,productivitySha256:'f'.repeat(64),policy});
const repeatedYbProtocol=repeatedYieldBasis.protocolLifecycle.protocols['registry-yieldbasis-multimechanism'];
const repeatedYbSensor=repeatedYieldBasis.protocolSensors['registry-yieldbasis-multimechanism'];
if(repeatedYbSensor.validatedObservationCount!==2||repeatedYbSensor.validatedSnapshotCount!==1) throw new Error('Repeated Yield Basis observations of one canonical snapshot manufactured longitudinal depth');
if(repeatedYbProtocol.maturityStage!=='shadow'||repeatedYbProtocol.checks.find(x=>x.id==='distinct-snapshot-depth')?.pass) throw new Error('Repeated Yield Basis snapshot falsely promoted SHADOW → VERIFIED');

const ybB=yieldBasisProductivity({snapshotKey:'2026-W36',generatedAt:'2026-09-02T06:08:02.250Z',veApr:5.12,wbtcApr:-0.2,wethApr:0.75});
const secondYieldBasis=applyYieldBasisLifecycle({state:structuredClone(yieldBasisBase),previousState:repeatedYieldBasis,productivity:ybB,productivitySha256:'1'.repeat(64),policy});
const secondYbProtocol=secondYieldBasis.protocolLifecycle.protocols['registry-yieldbasis-multimechanism'];
const secondYbSensor=secondYieldBasis.protocolSensors['registry-yieldbasis-multimechanism'];
if(secondYbSensor.validatedSnapshotCount!==2||secondYbSensor.validatedObservationCount!==3) throw new Error('Yield Basis distinct snapshot depth accounting mismatch');
if(secondYbProtocol.maturityStage!=='verified'||!secondYbProtocol.automaticallyPromoted) throw new Error('Two distinct validated Yield Basis snapshots did not deterministically promote SHADOW → VERIFIED');
if(!secondYbProtocol.checks.find(x=>x.id==='distinct-snapshot-depth')?.pass) throw new Error('Yield Basis distinct snapshot gate did not close');
if(secondYbProtocol.maturityStage==='canonical') throw new Error('Yield Basis was over-promoted to CANONICAL without veYB accounting identity');

const priorSixStages=Object.fromEntries(Object.entries(firstYieldBasis.protocolLifecycle.protocols).map(([id,row])=>[id,row.maturityStage]));
const veloA1=velodromeProductivity({snapshotKey:'2026-W35',generatedAt:'2026-08-26T06:08:02.250Z',weekly:48,apr:24.96});
const veloR1=velodromeRewards({generatedAt:'2026-08-26T05:52:34.772Z'});
const firstVelodrome=applyVelodromeLifecycle({state:structuredClone(firstYieldBasis),previousState:null,productivity:veloA1,rewards:veloR1,productivitySha256:'2'.repeat(64),rewardsSha256:'3'.repeat(64),policy});
const firstVeloProtocol=firstVelodrome.protocolLifecycle.protocols['registry-velodrome-vevelo'];
const firstVeloSensor=firstVelodrome.protocolSensors['registry-velodrome-vevelo'];
if(firstVelodrome.protocolLifecycle.summary?.protocolCount!==7) throw new Error('Velodrome did not become the seventh lifecycle sensor');
for(const [id,stage] of Object.entries(priorSixStages))if(firstVelodrome.protocolLifecycle.protocols[id]?.maturityStage!==stage) throw new Error(`Velodrome admission regressed existing lifecycle stage ${id}`);
if(firstVeloProtocol?.maturityStage!=='shadow'||firstVeloSensor?.validatedSnapshotCount!==1) throw new Error('First validated Velodrome weekly snapshot must remain SHADOW');
if(!firstVeloProtocol.checks.find(x=>x.id==='reference-formula-parity')?.pass) throw new Error('Velodrome Reference APR mechanical parity missing');
if(!firstVeloProtocol.checks.find(x=>x.id==='current-accrued-reward-route')?.pass) throw new Error('Velodrome bounded reward-route evidence missing');
if(!firstVeloProtocol.checks.find(x=>x.id==='bounded-vote-pool-history')?.pass) throw new Error('Velodrome bounded vote/pool history missing');
if(firstVeloProtocol.checks.find(x=>x.id==='end-to-end-vote-gauge-pool-fee-accounting')?.pass) throw new Error('Velodrome end-to-end economic causality was falsely promoted');
if(firstVeloSensor.latest.observation.epistemic.voteToRewardOutcome!=='CORRELATED-context-only-not-causal') throw new Error('Velodrome vote/reward correlation boundary regressed');
if(firstVelodrome.protocolLifecycle.authority?.executionAuthority!=='none'||firstVeloSensor.authority?.executionAuthority!=='none') throw new Error('Velodrome expanded execution authority');

const veloA2=velodromeProductivity({snapshotKey:'2026-W35',generatedAt:'2026-08-27T06:08:02.250Z',weekly:48,apr:24.96});
const veloR2=velodromeRewards({generatedAt:'2026-08-27T05:52:34.772Z',amountRaw:'2600000'});
const repeatedVelodrome=applyVelodromeLifecycle({state:structuredClone(firstYieldBasis),previousState:firstVelodrome,productivity:veloA2,rewards:veloR2,productivitySha256:'4'.repeat(64),rewardsSha256:'5'.repeat(64),policy});
const repeatedVeloProtocol=repeatedVelodrome.protocolLifecycle.protocols['registry-velodrome-vevelo'];
const repeatedVeloSensor=repeatedVelodrome.protocolSensors['registry-velodrome-vevelo'];
if(repeatedVeloSensor.validatedObservationCount!==2||repeatedVeloSensor.validatedSnapshotCount!==1) throw new Error('Repeated Velodrome observations of one canonical week manufactured longitudinal depth');
if(repeatedVeloProtocol.maturityStage!=='shadow'||repeatedVeloProtocol.checks.find(x=>x.id==='distinct-snapshot-depth')?.pass) throw new Error('Repeated Velodrome weekly snapshot falsely promoted SHADOW → VERIFIED');

const veloB=velodromeProductivity({snapshotKey:'2026-W36',generatedAt:'2026-09-02T06:08:02.250Z',weekly:50,apr:26});
const veloRB=velodromeRewards({generatedAt:'2026-09-02T05:52:34.772Z',amountRaw:'3000000'});
const secondVelodrome=applyVelodromeLifecycle({state:structuredClone(firstYieldBasis),previousState:repeatedVelodrome,productivity:veloB,rewards:veloRB,productivitySha256:'6'.repeat(64),rewardsSha256:'7'.repeat(64),policy});
const secondVeloProtocol=secondVelodrome.protocolLifecycle.protocols['registry-velodrome-vevelo'];
const secondVeloSensor=secondVelodrome.protocolSensors['registry-velodrome-vevelo'];
if(secondVeloSensor.validatedSnapshotCount!==2||secondVeloSensor.validatedObservationCount!==3) throw new Error('Velodrome distinct weekly snapshot depth accounting mismatch');
if(secondVeloProtocol.maturityStage!=='verified'||!secondVeloProtocol.automaticallyPromoted) throw new Error('Two distinct validated Velodrome weeks did not deterministically promote SHADOW → VERIFIED');
if(!secondVeloProtocol.checks.find(x=>x.id==='distinct-snapshot-depth')?.pass) throw new Error('Velodrome distinct-week gate did not close');
if(secondVeloProtocol.maturityStage==='canonical') throw new Error('Velodrome was over-promoted to CANONICAL without end-to-end vote/gauge/pool/fee accounting');
if(secondVeloProtocol.checks.find(x=>x.id==='end-to-end-vote-gauge-pool-fee-accounting')?.pass) throw new Error('Velodrome canonical mechanical gate unexpectedly passed');

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
