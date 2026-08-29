#!/usr/bin/env node
import assert from 'node:assert/strict';
import { applyFraxEcosystemSensor } from './frax-ecosystem-sensor.mjs';
import { applyFraxFrxEthCurrentState } from './frax-frxeth-current-state.mjs';
import frxEthRegistry from './frax-frxeth-registry.json' with { type:'json' };
import { collectFraxFpiFpisCurrentState, applyFraxFpiFpisCurrentState, FRAX_FPI_FPIS_SURFACE_KEY } from './frax-fpi-fpis-current-state.mjs';
import registry from './frax-fpi-fpis-registry.json' with { type:'json' };

const E18=10n**18n;
function word(value){return BigInt(value).toString(16).padStart(64,'0');}
function uint256(value){return `0x${word(value)}`;}
function tuple(...values){return `0x${values.map(word).join('')}`;}
function rpcRegistry(){return {networks:{ethereum:{chainId:1,rpcFailover:[{id:'first-fails',url:'https://first.invalid'},{id:'second-ok',url:'https://second.invalid'}]}}};}
function makeFetch({allFail=false,pegFail=false}={}){
  return async (url,options)=>{
    if(allFail||url.includes('first.invalid'))throw new Error('synthetic rpc outage');
    const payload=JSON.parse(options.body);
    if(payload.length===1&&payload[0].method==='eth_blockNumber')return {ok:true,async json(){return [{jsonrpc:'2.0',id:1,result:'0x64'}];}};
    const rows=payload.map(req=>{
      if(req.method==='eth_getBlockByNumber')return {jsonrpc:'2.0',id:req.id,result:{number:'0x64',timestamp:'0x65920080',hash:`0x${'ab'.repeat(32)}`}};
      if(req.method==='eth_getCode')return {jsonrpc:'2.0',id:req.id,result:'0x6001600055'};
      if(req.method!=='eth_call')throw new Error(`Unexpected method ${req.method}`);
      assert.equal(req.params[1],'0x64','all FPI/FPIS reads must share one exact block');
      const to=String(req.params[0].to).toLowerCase(),data=req.params[0].data;
      if(pegFail&&['0x09761c7e','0xd9ebcc2f','0xbc3d5a8e'].includes(data))return {jsonrpc:'2.0',id:req.id,error:{code:-32000,message:'synthetic stale price feed'}};
      if(to===registry.assets.FPI.address.toLowerCase()&&data==='0x18160ddd')return {jsonrpc:'2.0',id:req.id,result:uint256(1000n*E18)};
      if(to===registry.assets.FPIS.address.toLowerCase()&&data==='0x18160ddd')return {jsonrpc:'2.0',id:req.id,result:uint256(500n*E18)};
      if(to===registry.contracts.legacyVeFPIS.toLowerCase()&&data==='0x18160ddd')return {jsonrpc:'2.0',id:req.id,result:uint256(600n*E18)};
      if(to===registry.contracts.legacyVeFPIS.toLowerCase()&&data==='0x47c7341e')return {jsonrpc:'2.0',id:req.id,result:uint256(400n*E18)};
      if(to===registry.contracts.legacyVeFPIS.toLowerCase()&&data==='0xf8946485')return {jsonrpc:'2.0',id:req.id,result:uint256(0)};
      if(to===registry.contracts.fpiControllerPool.toLowerCase()){
        const scalar={
          '0xda610fcf':3000n,'0x6e7813ff':3000n,'0xe24ab97b':0n,'0x30fd8a46':0n,'0xd578660a':110000000n*E18,
          '0x694033f2':50000n,'0x67694bae':100000n,'0x65525bf6':0n,'0x9238c0ac':168n,'0x8583f21c':604800n,
          '0x09761c7e':1n*E18,'0xd9ebcc2f':102n*E18/100n
        };
        if(data in scalar)return {jsonrpc:'2.0',id:req.id,result:uint256(scalar[data])};
        if(data==='0xbc3d5a8e')return {jsonrpc:'2.0',id:req.id,result:tuple(1018n*E18/1000n,1961n,1n)};
      }
      throw new Error(`Unexpected eth_call ${to} ${data}`);
    });
    return {ok:true,async json(){return rows;}};
  };
}
function baseState(generatedAt='2026-08-29T10:00:00.000Z'){
  return {generatedAt,authority:{executionAuthority:'none',causalClaimAuthority:'none'},protocolLifecycle:{summary:{protocolCount:8},protocols:{'registry-frax-vefrax':{maturityStage:'shadow'}}},protocolSensors:{'registry-frax-vefrax':{latest:{observation:{epistemic:{executionAuthority:'none'},identityBoundary:{currentCanonicalPrincipal:'FRAX',currentCanonicalVoteEscrowLabel:'veFRAX'},referenceProductivity:{currentAprPct:5.25},registryExposure:{companyCount:3,positionCount:3},longitudinalEvidence:{canonicalSnapshotCount:4,validatedNativePeriodCount:0}}}}}};
}
function withFrxEth(){
  const state=baseState();
  applyFraxEcosystemSensor({state,previousState:null});
  const measured={
    status:'ok',measurementClass:'MEASURED',observedAt:'2026-08-29T10:00:00.000Z',network:'ethereum',chainId:1,
    blockNumber:99,blockTag:'0x63',blockHash:`0x${'cd'.repeat(32)}`,
    asset:{totalSupply:1000},vault:{totalSupply:100,totalAssets:110,sharePriceAsset:1.1},
    epistemic:{validatorEconomics:'UNKNOWN',lendingIncome:'UNKNOWN',executionAuthority:'none'}
  };
  applyFraxFrxEthCurrentState({state,previousState:null,measurement:measured,registry:frxEthRegistry});
  return state;
}

const measured=await collectFraxFpiFpisCurrentState({registry,rpcRegistry:rpcRegistry(),fetchImpl:makeFetch()});
assert.equal(measured.status,'ok');
assert.equal(measured.measurementClass,'MEASURED');
assert.equal(measured.blockNumber,100);
assert.equal(measured.rpc.endpointId,'second-ok');
assert.equal(measured.tokens.FPI.totalSupply,1000);
assert.equal(measured.tokens.FPIS.totalSupply,500);
assert.equal(measured.controller.effectiveMintFeePct,0.3);
assert.equal(measured.controller.pegBandMintRedeemPct,5);
assert.equal(measured.controller.pegBandTwammPct,10);
assert.equal(measured.legacyVeFPIS.totalVotingPower,600);
assert.equal(measured.legacyVeFPIS.trackedFpisPrincipal,400);
assert.equal(measured.legacyVeFPIS.trackedPrincipalPctOfFpisSupply,80);
assert.equal(measured.pegState.measurementClass,'MEASURED');
assert.equal(measured.pegState.withinMintRedeemBand,true);
assert.equal(measured.epistemic.treasuryYield,'UNKNOWN');
assert.equal(measured.epistemic.executionAuthority,'none');

const state=withFrxEth();
applyFraxFpiFpisCurrentState({state,previousState:null,measurement:measured,registry});
const obs=state.protocolEvidence['registry-frax-ecosystem'].latest.observation;
const surface=obs.surfaces[FRAX_FPI_FPIS_SURFACE_KEY];
assert.equal(obs.coverage.surfaceCount,11);
assert.equal(obs.coverage.measuredSurfaceCount,3);
assert.equal(obs.coverage.sourceBoundUnknownSurfaceCount,8);
assert.equal(surface.measurementState,'MEASURED-current-onchain-partial');
assert.equal(obs.epistemic.fpiCpiPegState,'MEASURED-current-controller-feeds');
assert.equal(obs.epistemic.fpiTreasuryYield,'UNKNOWN');
assert.equal(obs.epistemic.currentFraxtalFpisLocker,'UNKNOWN-not-measured-by-this-atom');
assert.equal(obs.authority.executionAuthority,'none');

const partial=await collectFraxFpiFpisCurrentState({registry,rpcRegistry:rpcRegistry(),fetchImpl:makeFetch({pegFail:true})});
assert.equal(partial.status,'ok');
assert.equal(partial.measurementClass,'MEASURED');
assert.equal(partial.pegState.measurementClass,'UNKNOWN');

const unavailable=await collectFraxFpiFpisCurrentState({registry,rpcRegistry:rpcRegistry(),fetchImpl:makeFetch({allFail:true})});
assert.match(unavailable.status,/^UNKNOWN/);
assert.equal(unavailable.measurementClass,'UNKNOWN');
const state2=withFrxEth();
applyFraxFpiFpisCurrentState({state:state2,previousState:null,measurement:unavailable,registry});
const obs2=state2.protocolEvidence['registry-frax-ecosystem'].latest.observation;
assert.equal(obs2.coverage.surfaceCount,11);
assert.equal(obs2.coverage.measuredSurfaceCount,2);
assert.equal(obs2.coverage.sourceBoundUnknownSurfaceCount,9);
assert.match(obs2.surfaces[FRAX_FPI_FPIS_SURFACE_KEY].measurementState,/^UNKNOWN/);

console.log('FRAX FPI FPIS CURRENT STATE CANARY PASS',{blockNumber:measured.blockNumber,fpiSupply:measured.tokens.FPI.totalSupply,fpisSupply:measured.tokens.FPIS.totalSupply,trackedFpis:measured.legacyVeFPIS.trackedFpisPrincipal,trackedPct:measured.legacyVeFPIS.trackedPrincipalPctOfFpisSupply,pegState:measured.pegState.status,partialPegFallback:partial.pegState.status,surfaces:obs.coverage.surfaceCount,measuredSurfaces:obs.coverage.measuredSurfaceCount,executionAuthority:obs.authority.executionAuthority});
