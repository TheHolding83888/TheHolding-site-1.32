#!/usr/bin/env node
import assert from 'node:assert/strict';
import { applyFraxEcosystemSensor } from './frax-ecosystem-sensor.mjs';
import { collectFraxRevenueRoutingCurrentState, applyFraxRevenueRoutingCurrentState } from './frax-revenue-routing-current-state.mjs';

const PROXY='0x21359d1697e610e25c8229b2c57907378ed09a2e';
const IMPL='0x08de0c3bcba9529fe59fa4e4593805bd55a54b0b';
const TOKEN='0xfc00000000000000000000000000000000000002';
const OWNER='0xc4eb45d80dc1f079045e75d5d55de8ed1c1090e6';
const RATE=123456789012345n;
const DURATION=604800n;
const PERIOD_FINISH=1900000000n;
const LAST_UPDATE=1899395200n;
const INVENTORY=987654321000000000000n;

function uint256(value){return `0x${BigInt(value).toString(16).padStart(64,'0')}`;}
function addressWord(address){return `0x${String(address).toLowerCase().slice(2).padStart(64,'0')}`;}
function config(){return {
  version:'0.1-frax-current-yield-distribution-registry',network:{name:'fraxtal',chainId:252},
  yieldDistributor:{proxy:PROXY,implementation:IMPL,expectedEmittedToken:TOKEN,expectedVeFxsAggregator:'0x176a4e081653ebb8a2246bafbfcf663782426531',defaultYieldDurationSeconds:604800},
  officialSources:{
    constants:{repository:'FraxFinance/fraxtal-contracts',path:'src/Constants.sol',blobSha:'f710ea5d2b315c0e4ef9d552fec7a4b5c3162917'},
    yieldDistributor:{repository:'FraxFinance/fraxtal-contracts',path:'src/contracts/VestedFXS-and-Flox/VestedFXS/YieldDistributor.sol',blobSha:'8922b543ae15e732b638f2bf94883506b31adc23'},
    deployYieldDistributor:{repository:'FraxFinance/fraxtal-contracts',path:'src/script/VestedFXS-and-Flox/DeployYieldDistributor.s.sol',blobSha:'72120baf993c79a0f07bbcdf71d1eca1b9b9ebea'}
  },
  documentedMechanics:{distributesFraxProtocolYieldByVeFxsBalance:true,productionEmittedTokenIsFxsProxy:true,productionVeFxsAggregatorIsCanonicalProxy:true,notifyRewardAmountRequiresAuthorizedNotifier:true,rewardPeriodUsesYieldRateTimesYieldDuration:true,claimTransfersEmittedToken:true,emittedTokenRecoveryForbidden:true},
  semantics:{configIsSourceBoundTopology:true,configIsLiveMeasurement:false,currentDistributorStateCanBeMeasured:true,distributorFundingSourceIsNotProvenByContractState:true,fraxswapFeeToIsNotAutomaticallyDistributorFunding:true,fundedDistributorBalanceIsNotRealizedCompanyCashFlow:true,protocolYieldLabelIsSourceAttributedNotSourceOfFundsProof:true,missingObservationIsNotZero:true,unknownIsZero:false,causalClaimAuthority:'none',recommendationAuthority:'none',executionAuthority:'none'}
};}
function endpoints(){return [{id:'first-fails',url:'https://first.invalid'},{id:'second-ok',url:'https://second.invalid'}];}
function makeFetch({allFail=false,badToken=false,badArithmetic=false}={}){return async (url,options)=>{
  if(allFail||url.includes('first.invalid'))throw new Error('synthetic rpc outage');
  const payload=JSON.parse(options.body);
  if(payload.length===1&&payload[0].method==='eth_blockNumber')return {ok:true,async json(){return [{jsonrpc:'2.0',id:1,result:'0x1234'}];}};
  return {ok:true,async json(){return payload.map(req=>{
    if(req.method==='eth_getBlockByNumber')return {jsonrpc:'2.0',id:req.id,result:{number:'0x1234',timestamp:'0x70000000',hash:`0x${'ab'.repeat(32)}`}};
    if(req.method==='eth_getCode')return {jsonrpc:'2.0',id:req.id,result:'0x6001600055'};
    if(req.method==='eth_getStorageAt')return {jsonrpc:'2.0',id:req.id,result:addressWord(IMPL)};
    if(req.method!=='eth_call')throw new Error(`unexpected ${req.method}`);
    const to=String(req.params[0].to).toLowerCase();const data=String(req.params[0].data).toLowerCase();
    assert.equal(req.params[1],'0x1234','all contract reads must be exact-block bound');
    if(to===PROXY&&data==='0xe9218ff6')return {jsonrpc:'2.0',id:req.id,result:addressWord(badToken?'0x000000000000000000000000000000000000dead':TOKEN)};
    if(to===PROXY&&data==='0xe172cf21')return {jsonrpc:'2.0',id:req.id,result:uint256(DURATION)};
    if(to===PROXY&&data==='0x6999ac93')return {jsonrpc:'2.0',id:req.id,result:uint256(RATE)};
    if(to===PROXY&&data==='0xebe2b12b')return {jsonrpc:'2.0',id:req.id,result:uint256(PERIOD_FINISH)};
    if(to===PROXY&&data==='0xc8f33c91')return {jsonrpc:'2.0',id:req.id,result:uint256(LAST_UPDATE)};
    if(to===PROXY&&data==='0x19aec6d2')return {jsonrpc:'2.0',id:req.id,result:uint256(badArithmetic?RATE*DURATION+1n:RATE*DURATION)};
    if(to===PROXY&&data==='0xad1148cb')return {jsonrpc:'2.0',id:req.id,result:uint256(0n)};
    if(to===PROXY&&data==='0x8da5cb5b')return {jsonrpc:'2.0',id:req.id,result:addressWord(OWNER)};
    if(to===TOKEN&&data.startsWith('0x70a08231'))return {jsonrpc:'2.0',id:req.id,result:uint256(INVENTORY)};
    throw new Error(`unexpected eth_call ${to} ${data}`);
  });}};
};}
function baseState(){return {generatedAt:'2026-08-29T08:30:00.000Z',authority:{executionAuthority:'none',causalClaimAuthority:'none'},protocolLifecycle:{summary:{protocolCount:8},protocols:{'registry-frax-vefrax':{maturityStage:'shadow'}}},protocolSensors:{'registry-frax-vefrax':{latest:{observation:{epistemic:{executionAuthority:'none'},identityBoundary:{currentCanonicalPrincipal:'FRAX',currentCanonicalVoteEscrowLabel:'veFRAX'},referenceProductivity:{currentAprPct:5.25},registryExposure:{companyCount:3,positionCount:3},longitudinalEvidence:{canonicalSnapshotCount:4,validatedNativePeriodCount:0}}}}}};}
function eightOfNineState(){
  const state=baseState();applyFraxEcosystemSensor({state,previousState:null});
  const evidence=state.protocolEvidence['registry-frax-ecosystem'];const obs=evidence.latest.observation;
  for(const [key,surface] of Object.entries(obs.surfaces))if(key!=='revenueRouting')surface.measurementState='MEASURED-synthetic-existing-proof';
  obs.surfaces.revenueRouting.measured={fraxswapFeeToHistoricalBackfill:{status:'partial-evidence',summary:{protocolFeeMintEventCountBackfilled:3339,strictRedemptionCountBackfilled:0},epistemic:{continuousFeeToStateHistory:'UNKNOWN-no-setFeeTo-event-and-no-complete-call-trace'}}};
  obs.coverage.measuredSurfaceCount=8;obs.coverage.sourceBoundUnknownSurfaceCount=1;
  state.protocolSensors['registry-frax-vefrax'].ecosystemFamily={status:obs.status,measuredSurfaceCount:8,sourceBoundUnknownSurfaceCount:1,latestObservationId:obs.id,measurementExtensions:{}};
  return state;
}

const measurement=await collectFraxRevenueRoutingCurrentState({config:config(),fetchImpl:makeFetch(),endpointsOverride:endpoints()});
assert.equal(measurement.status,'ok');assert.equal(measurement.measurementClass,'MEASURED');assert.equal(measurement.network.blockNumber,0x1234);assert.equal(measurement.rpc.endpointId,'second-ok');assert.equal(measurement.distributor.proxy,PROXY);assert.equal(measurement.distributor.implementation,IMPL);assert.equal(measurement.distributor.emittedToken,TOKEN);assert.equal(measurement.distributor.yieldDurationRaw,DURATION.toString());assert.equal(measurement.distributor.yieldRateRaw,RATE.toString());assert.equal(measurement.distributor.getYieldForDurationRaw,(RATE*DURATION).toString());assert.equal(measurement.distributor.rewardArithmeticParity,true);assert.equal(measurement.distributor.emittedTokenBalanceRaw,INVENTORY.toString());assert.equal(measurement.distributor.yieldCollectionPaused,false);assert.equal(measurement.epistemic.distributorFundingSource,'UNKNOWN-not-proven-by-contract-state');assert.equal(measurement.epistemic.fraxswapFeeToToDistributor,'UNKNOWN-no-mechanical-path-proven');assert.equal(measurement.epistemic.companyCashFlow,'UNKNOWN-not-measured-by-this-atom');assert.equal(measurement.epistemic.executionAuthority,'none');

const state=eightOfNineState();const previous=structuredClone(state);const previousBackfill=JSON.stringify(state.protocolEvidence['registry-frax-ecosystem'].latest.observation.surfaces.revenueRouting.measured.fraxswapFeeToHistoricalBackfill);applyFraxRevenueRoutingCurrentState({state,previousState:previous,measurement});const obs=state.protocolEvidence['registry-frax-ecosystem'].latest.observation;assert.equal(obs.coverage.measuredSurfaceCount,9);assert.equal(obs.coverage.sourceBoundUnknownSurfaceCount,0);assert.equal(obs.surfaces.revenueRouting.measurementState,'MEASURED-current-yield-distribution-partial');assert.equal(JSON.stringify(obs.surfaces.revenueRouting.measured.fraxswapFeeToHistoricalBackfill),previousBackfill,'existing feeTo evidence must remain intact');assert.equal(obs.surfaces.revenueRouting.measured.yieldDistributionCurrent.distributor.emittedToken,TOKEN);assert.equal(obs.epistemic.revenueRoutingUpstreamFundingSource,'UNKNOWN-not-proven-by-contract-state');assert.equal(obs.epistemic.fraxswapFeeToToYieldDistributor,'UNKNOWN-no-mechanical-path-proven');assert.equal(obs.epistemic.veFraxCompanyCashFlow,'UNKNOWN-not-measured-by-this-atom');assert.equal(obs.authority.executionAuthority,'none');

const unavailable=await collectFraxRevenueRoutingCurrentState({config:config(),fetchImpl:makeFetch({allFail:true}),endpointsOverride:endpoints()});assert.match(unavailable.status,/^UNKNOWN/);const stateUnknown=eightOfNineState();const previousUnknown=structuredClone(stateUnknown);applyFraxRevenueRoutingCurrentState({state:stateUnknown,previousState:previousUnknown,measurement:unavailable});const obsUnknown=stateUnknown.protocolEvidence['registry-frax-ecosystem'].latest.observation;assert.equal(obsUnknown.coverage.measuredSurfaceCount,8);assert.equal(obsUnknown.coverage.sourceBoundUnknownSurfaceCount,1);assert.match(obsUnknown.surfaces.revenueRouting.measurementState,/^UNKNOWN/);
const badToken=await collectFraxRevenueRoutingCurrentState({config:config(),fetchImpl:makeFetch({badToken:true}),endpointsOverride:endpoints()});assert.match(badToken.status,/^UNKNOWN/,'emitted-token identity mismatch must fail closed');
const badArithmetic=await collectFraxRevenueRoutingCurrentState({config:config(),fetchImpl:makeFetch({badArithmetic:true}),endpointsOverride:endpoints()});assert.match(badArithmetic.status,/^UNKNOWN/,'reward arithmetic mismatch must fail closed');

console.log('FRAX REVENUE ROUTING CURRENT STATE CANARY PASS',{blockNumber:measurement.network.blockNumber,proxy:measurement.distributor.proxy,implementation:measurement.distributor.implementation,emittedToken:measurement.distributor.emittedToken,rewardArithmeticParity:measurement.distributor.rewardArithmeticParity,measuredSurfaces:obs.coverage.measuredSurfaceCount,unknownSurfaces:obs.coverage.sourceBoundUnknownSurfaceCount,upstreamFundingSource:obs.epistemic.revenueRoutingUpstreamFundingSource,companyCashFlow:obs.epistemic.veFraxCompanyCashFlow,executionAuthority:obs.authority.executionAuthority});
