#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { applyFraxEcosystemSensor } from './frax-ecosystem-sensor.mjs';
import { collectFraxFxbOnchain, applyFraxFxbOnchainMeasurement } from './frax-fxb-onchain.mjs';

const ETH_SERIES='0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const FXTL_SERIES='0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const ETH_LFRAX='0x1111111111111111111111111111111111111111';
const FXTL_LFRAX='0x2222222222222222222222222222222222222222';
const E18=10n**18n;
const sigHashes=Array.from({length:7},(_,i)=>`0x${String(i+1).repeat(64)}`);
const selectors=sigHashes.map(x=>x.slice(0,10));
function uint(v){return `0x${BigInt(v).toString(16).padStart(64,'0')}`;}
function addressResult(v){return `0x${v.toLowerCase().replace(/^0x/,'').padStart(64,'0')}`;}
function config(){return {
  version:'0.2-frax-fxb-series-registry-current-subprotocol-source',
  officialSources:{docs:'synthetic'},
  semantics:{originOnlyBackingMeasurement:true,currentSeriesOnly:true,legacySeriesExcludedFromCurrentCoverage:true,redemptionAssetIdentityFunction:'token()',executionAuthority:'none'},
  networks:{ethereum:{chainId:1,lFrax:ETH_LFRAX},fraxtal:{chainId:252,lFrax:FXTL_LFRAX}},
  series:[
    {id:'E',label:'ETH FXB',originNetwork:'ethereum',originAddress:ETH_SERIES,bridgedMirrors:[],documentedMaturityDate:'2020-01-01'},
    {id:'F',label:'FXTL FXB',originNetwork:'fraxtal',originAddress:FXTL_SERIES,bridgedMirrors:[],documentedMaturityDate:'2030-01-01'}
  ],
  documentedLegacySeries:[{id:'L',originAddress:'0xcccccccccccccccccccccccccccccccccccccccc',reason:'synthetic legacy'}],
  documentedUnresolvedSeries:[{id:'U',originAddress:null,reason:'synthetic unresolved'}]
};}
function endpoints(){return {ethereum:[{id:'eth-ok',url:'https://eth.test'}],fraxtal:[{id:'fxtl-ok',url:'https://fxtl.test'}]};}
function makeFetch({failFraxtal=false}={}){return async (url,options)=>{
  if(failFraxtal&&url.includes('fxtl'))throw new Error('synthetic Fraxtal outage');
  const payload=JSON.parse(options.body),isEth=url.includes('eth.test'),series=isEth?ETH_SERIES:FXTL_SERIES,lFrax=isEth?ETH_LFRAX:FXTL_LFRAX,block=isEth?100n:200n,timestamp=isEth?1700000000n:1800000000n,maturity=isEth?1600000000n:1900000000n;
  const out=payload.map(req=>{
    if(req.method==='web3_sha3')return {jsonrpc:'2.0',id:req.id,result:sigHashes[req.id-1]};
    if(req.method==='eth_blockNumber')return {jsonrpc:'2.0',id:req.id,result:`0x${block.toString(16)}`};
    if(req.method==='eth_getBlockByNumber')return {jsonrpc:'2.0',id:req.id,result:{number:`0x${block.toString(16)}`,timestamp:`0x${timestamp.toString(16)}`,hash:`0x${(isEth?'ab':'cd').repeat(32)}`}};
    if(req.method!=='eth_call')throw new Error(`unexpected method ${req.method}`);
    const to=String(req.params[0].to).toLowerCase(),data=String(req.params[0].data).toLowerCase();
    assert.equal(req.params[1],`0x${block.toString(16)}`);
    if(to===series&&data===selectors[0])return {jsonrpc:'2.0',id:req.id,result:addressResult(lFrax)};
    if(to===series&&data===selectors[1])return {jsonrpc:'2.0',id:req.id,result:uint(maturity)};
    if(to===series&&data===selectors[2])return {jsonrpc:'2.0',id:req.id,result:uint(900n*E18)};
    if(to===series&&data===selectors[3])return {jsonrpc:'2.0',id:req.id,result:uint(1000n*E18)};
    if(to===series&&data===selectors[4])return {jsonrpc:'2.0',id:req.id,result:uint(100n*E18)};
    if(to===series&&data===selectors[5])return {jsonrpc:'2.0',id:req.id,result:uint(isEth?1n:0n)};
    if(to===lFrax&&data.startsWith(selectors[6]))return {jsonrpc:'2.0',id:req.id,result:uint(900n*E18)};
    throw new Error(`unexpected call ${to} ${data}`);
  });
  return {ok:true,async json(){return out;}};
};}
function baseState(){return {
  generatedAt:'2026-08-29T03:00:00.000Z',authority:{executionAuthority:'none',causalClaimAuthority:'none'},
  protocolLifecycle:{summary:{protocolCount:8},protocols:{'registry-frax-vefrax':{maturityStage:'shadow'}}},
  protocolSensors:{'registry-frax-vefrax':{latest:{observation:{epistemic:{executionAuthority:'none'},identityBoundary:{currentCanonicalPrincipal:'FRAX',currentCanonicalVoteEscrowLabel:'veFRAX'},referenceProductivity:{currentAprPct:5.25},registryExposure:{companyCount:3,positionCount:3},longitudinalEvidence:{canonicalSnapshotCount:4,validatedNativePeriodCount:0}}}}}
};}

const currentRegistry=JSON.parse(fs.readFileSync(new URL('./frax-fxb-series-registry.json',import.meta.url),'utf8'));
assert.equal(currentRegistry.version,'0.2-frax-fxb-series-registry-current-subprotocol-source');
assert.equal(currentRegistry.officialSources.currentAddressesPath,'pages/protocol/subprotocols/fxb/addresses.mdx');
assert.equal(currentRegistry.officialSources.currentAddressesSha,'ee2b2723086fc7a58c0161f329e0b30eedd77191');
assert.equal(currentRegistry.semantics.redemptionAssetIdentityFunction,'token()');
assert.deepEqual(currentRegistry.series.map(x=>x.id),['FXB2025','FXB2026','FXB2027','FXB2029','FXB2055']);
assert.equal(currentRegistry.series.some(x=>x.id==='FXB2024'),false);
assert.equal(currentRegistry.series.find(x=>x.id==='FXB2027')?.originAddress,'0x6c9f4E6089c8890AfEE2bcBA364C2712f88fA818');
assert.equal(currentRegistry.documentedUnresolvedSeries.length,0);
assert.equal(currentRegistry.documentedLegacySeries.some(x=>x.id==='FXB2024'),true);

const measurement=await collectFraxFxbOnchain({config:config(),endpointsOverride:endpoints(),fetchImpl:makeFetch()});
assert.equal(measurement.status,'ok');
assert.equal(measurement.measurementClass,'MEASURED');
assert.equal(measurement.coverage.fullConfiguredOriginSeriesCoverage,true);
assert.equal(measurement.coverage.measuredOriginSeriesCount,2);
assert.equal(measurement.coverage.activeSeriesCount,1);
assert.equal(measurement.coverage.maturedSeriesCount,1);
assert.equal(measurement.coverage.legacySeriesExcludedCount,1);
assert.deepEqual(measurement.coverage.seriesWithBackingDeficit,[]);
assert.equal(measurement.series[0].proof.lFraxIdentityProven,true);
assert.equal(measurement.series[0].proof.mintedMinusRedeemedEqualsSupply,true);
assert.equal(measurement.series[0].observed.redemptionTokenAddress.toLowerCase(),ETH_LFRAX.toLowerCase());
assert.equal(measurement.series[0].observed.totalSupplyLfraxFace,'900');
assert.equal(measurement.series[0].observed.backingCoverageRatio,'1');
assert.equal(measurement.epistemic.redemptionAssetIdentity,'MEASURED-token()-common-v1.2-v2-interface');
assert.equal(measurement.epistemic.spotPrice,'UNKNOWN-not-measured-by-this-atom');
assert.equal(measurement.epistemic.executionAuthority,'none');
assert.doesNotThrow(()=>JSON.stringify(measurement));

const state=baseState();applyFraxEcosystemSensor({state,previousState:null});applyFraxFxbOnchainMeasurement({state,previousState:null,measurement});
const obs=state.protocolEvidence['registry-frax-ecosystem'].latest.observation;
assert.equal(obs.surfaces.fxb.measurementState,'MEASURED-current-origin-series-state-partial-term-curve');
assert.equal(obs.coverage.measuredSurfaceCount,2);
assert.equal(obs.coverage.sourceBoundUnknownSurfaceCount,7);
assert.equal(obs.surfaces.fxb.mechanicalRelations[0].from,'FXB token() + configured origin chain');
assert.equal(obs.epistemic.fxbSpotPrice,'UNKNOWN');
assert.equal(obs.epistemic.fxbImpliedYield,'UNKNOWN');
assert.equal(obs.authority.executionAuthority,'none');
assert.equal(obs.surfaces.revenueRouting.measurementState,'UNKNOWN-current-value-not-ingested');

const unavailable=await collectFraxFxbOnchain({config:config(),endpointsOverride:endpoints(),fetchImpl:makeFetch({failFraxtal:true})});
assert.match(unavailable.status,/^UNKNOWN/);assert.equal(unavailable.measurementClass,'UNKNOWN');assert.equal(unavailable.coverage.measuredOriginSeriesCount,0);
const state2=baseState();applyFraxEcosystemSensor({state:state2,previousState:null});applyFraxFxbOnchainMeasurement({state:state2,previousState:null,measurement:unavailable});
const obs2=state2.protocolEvidence['registry-frax-ecosystem'].latest.observation;
assert.equal(obs2.surfaces.fxb.measurementState,'UNKNOWN-current-value-not-ingested');
assert.equal(obs2.coverage.measuredSurfaceCount,1);assert.equal(obs2.coverage.sourceBoundUnknownSurfaceCount,8);

console.log('FRAX FXB CURRENT ORIGIN SERIES SENSOR CANARY PASS',{
  measuredSeries:measurement.coverage.measuredOriginSeriesCount,
  activeSeries:measurement.coverage.activeSeriesCount,
  maturedSeries:measurement.coverage.maturedSeriesCount,
  unresolvedDocumentedSeries:measurement.coverage.unresolvedDocumentedSeriesCount,
  measuredSurfaces:obs.coverage.measuredSurfaceCount,
  redemptionIdentity:measurement.epistemic.redemptionAssetIdentity,
  spotPrice:measurement.epistemic.spotPrice,
  executionAuthority:measurement.epistemic.executionAuthority
});

if(process.env.GITHUB_ACTIONS==='true'){
  const live=await collectFraxFxbOnchain();
  if(live.status!=='ok'||live.measurementClass!=='MEASURED'||live.coverage?.fullConfiguredOriginSeriesCoverage!==true)throw new Error(`FRAX FXB LIVE CURRENT-SERIES PROOF FAILED ${JSON.stringify(live.rpc)}`);
  if(live.coverage.configuredOriginSeriesCount!==5||live.coverage.measuredOriginSeriesCount!==5||live.coverage.unresolvedDocumentedSeriesCount!==0)throw new Error(`FRAX FXB live current-series coverage mismatch ${JSON.stringify(live.coverage)}`);
  const ids=live.series.map(x=>x.id);
  for(const id of ['FXB2025','FXB2026','FXB2027','FXB2029','FXB2055'])if(!ids.includes(id))throw new Error(`FRAX FXB live current series missing ${id}`);
  if(ids.includes('FXB2024'))throw new Error('FRAX FXB legacy 2024 leaked into current completeness');
  if(live.series.some(x=>x.proof?.lFraxIdentityProven!==true||x.proof?.mintedMinusRedeemedEqualsSupply!==true||x.proof?.redeemabilityMatchesBlockTimestamp!==true))throw new Error('FRAX FXB live current-series proof invariant failed');
  if(live.epistemic?.executionAuthority!=='none')throw new Error('FRAX FXB live execution authority drift');
  console.log('FRAX FXB LIVE CURRENT-SERIES EXACT-BLOCK PROOF PASS',{
    observedAt:live.observedAt,
    networks:live.networks,
    series:live.series.map(x=>({id:x.id,network:x.originNetwork,address:x.originAddress,maturity:x.observed.maturityIso,isRedeemable:x.observed.isRedeemable,supply:x.observed.totalSupplyLfraxFace,backing:x.observed.backingLfrax,backingDeficitRaw:x.observed.backingDeficitRaw})),
    executionAuthority:live.epistemic.executionAuthority
  });
}
