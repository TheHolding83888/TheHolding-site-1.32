#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { applyFraxEcosystemSensor } from './frax-ecosystem-sensor.mjs';
import { collectFloxFxtlCurrentState, applyFloxFxtlCurrentState, FRAX_FLOX_FXTL_CURRENT_VERSION } from './frax-flox-fxtl-current-state.mjs';

const POINTS='0x1111111111111111111111111111111111111111';
function padWord(value){return BigInt(value).toString(16).padStart(64,'0');}
function encodeString(value){
  const bytes=Buffer.from(value,'utf8').toString('hex');
  const padded=bytes.padEnd(Math.ceil(bytes.length/64)*64,'0');
  return `0x${padWord(32)}${padWord(bytes.length/2)}${padded}`;
}
function config(){return {
  version:'0.1-frax-flox-fxtl-current-registry',
  purpose:'synthetic',
  network:{name:'fraxtal',chainId:252},
  pointsContract:{label:'FxtlPoints',address:POINTS,expectedName:'FXTL Points',expectedSymbol:'FXTL',expectedDecimals:0},
  officialSources:{
    pointSystem:{repository:'FraxFinance/docs',path:'point.mdx',blobSha:'1111111111111111111111111111111111111111'},
    blockspaceOverview:{repository:'FraxFinance/docs',path:'overview.mdx',blobSha:'2222222222222222222222222222222222222222'},
    floxFarms:{repository:'FraxFinance/docs',path:'farms.mdx',blobSha:'3333333333333333333333333333333333333333'},
    fxtlPointsContract:{repository:'FraxFinance/fraxtal-contracts',path:'FxtlPoints.sol',blobSha:'4444444444444444444444444444444444444444'}
  },
  documentedMechanics:{
    blockspaceEpochInitialCadence:'7-days-initially',blockspaceInputs:['gas'],farmBalanceSnapshotCadence:'hourly',farmUsesEffectiveBalance:true,
    farmPointBasis:'effective balance value in frxUSD multiplied by multiplier and dynamic rate',baseEarningRateDynamic:true,pointsOneToOneWithFrxUsd:false,ledgerTransferable:false,ledgerDecimals:0
  },
  semantics:{
    configIsSourceBoundTopology:true,configIsLiveMeasurement:false,totalSupplyIsPointLedgerStateNotTokenMarketCap:true,pointsAreNotUsd:true,pointsAreNotTokenValue:true,
    documentedEpochCadenceIsNotCurrentEpochProof:true,documentedFarmFormulaIsNotCurrentFarmMeasurement:true,missingCompanyBalanceIsNotZero:true,offchainFloxRankNotRecomputedByThisAtom:true,
    unknownIsZero:false,causalClaimAuthority:'none',recommendationAuthority:'none',executionAuthority:'none'
  }
};}
function response(json){return {ok:true,status:200,async json(){return json;}};}
function makeFetch({fail=false,identityMismatch=false}={}){return async (url,options={})=>{
  if(fail)throw new Error('synthetic rpc outage');
  assert.equal(url,'https://fraxtal.test');
  const payload=JSON.parse(options.body);
  const rows=payload.map(req=>{
    if(req.method==='eth_blockNumber')return {jsonrpc:'2.0',id:req.id,result:'0x64'};
    if(req.method==='eth_getBlockByNumber')return {jsonrpc:'2.0',id:req.id,result:{number:'0x64',timestamp:'0x6b49d200',hash:`0x${'ab'.repeat(32)}`}};
    if(req.method==='eth_getCode'){
      assert.equal(req.params[1],'0x64');
      return {jsonrpc:'2.0',id:req.id,result:'0x60016000556001600055'};
    }
    if(req.method==='eth_call'){
      assert.equal(req.params[1],'0x64','all ledger reads must use the exact checkpoint block');
      const selector=req.params[0].data;
      if(selector==='0x06fdde03')return {jsonrpc:'2.0',id:req.id,result:encodeString(identityMismatch?'Wrong Points':'FXTL Points')};
      if(selector==='0x95d89b41')return {jsonrpc:'2.0',id:req.id,result:encodeString('FXTL')};
      if(selector==='0x313ce567')return {jsonrpc:'2.0',id:req.id,result:`0x${padWord(0)}`};
      if(selector==='0x18160ddd')return {jsonrpc:'2.0',id:req.id,result:`0x${padWord(123456789)}`};
    }
    throw new Error(`unexpected RPC ${req.method}`);
  });
  return response(rows);
};}
function baseState(){return {
  generatedAt:'2026-08-29T06:00:00.000Z',
  authority:{executionAuthority:'none',causalClaimAuthority:'none'},
  protocolLifecycle:{summary:{protocolCount:8},protocols:{'registry-frax-vefrax':{maturityStage:'shadow'}}},
  protocolSensors:{'registry-frax-vefrax':{latest:{observation:{
    epistemic:{executionAuthority:'none'},identityBoundary:{currentCanonicalPrincipal:'FRAX',currentCanonicalVoteEscrowLabel:'veFRAX'},
    referenceProductivity:{currentAprPct:5.25},registryExposure:{companyCount:3,positionCount:3},longitudinalEvidence:{canonicalSnapshotCount:4,validatedNativePeriodCount:0}
  }}}}
};}

const registry=JSON.parse(fs.readFileSync(new URL('./frax-flox-fxtl-registry.json',import.meta.url),'utf8'));
assert.equal(registry.version,'0.1-frax-flox-fxtl-current-registry');
assert.equal(registry.network.chainId,252);
assert.equal(registry.pointsContract.address,'0xaB4b7c5C9A7C8EbB97877085A6C3550ad4Ed3f97');
assert.equal(registry.pointsContract.expectedDecimals,0);
assert.equal(registry.documentedMechanics.ledgerTransferable,false);
assert.equal(registry.documentedMechanics.pointsOneToOneWithFrxUsd,false);
assert.equal(registry.semantics.pointsAreNotUsd,true);
assert.equal(registry.semantics.pointsAreNotTokenValue,true);
assert.equal(registry.semantics.executionAuthority,'none');

const measurement=await collectFloxFxtlCurrentState({config:config(),endpointsOverride:[{id:'synthetic',url:'https://fraxtal.test'}],fetchImpl:makeFetch()});
assert.equal(measurement.version,FRAX_FLOX_FXTL_CURRENT_VERSION);
assert.equal(measurement.status,'ok');
assert.equal(measurement.measurementClass,'MEASURED');
assert.equal(measurement.network.blockNumber,100);
assert.equal(measurement.ledger.name,'FXTL Points');
assert.equal(measurement.ledger.symbol,'FXTL');
assert.equal(measurement.ledger.decimals,0);
assert.equal(measurement.ledger.totalSupplyPoints,'123456789');
assert.equal(measurement.coverage.currentTotalPointSupply,true);
assert.equal(measurement.coverage.currentEpoch,false);
assert.equal(measurement.coverage.companyPointExposure,false);
assert.equal(measurement.epistemic.pointsAreUsd,false);
assert.equal(measurement.epistemic.pointsAreTransferable,false);
assert.equal(measurement.epistemic.currentFloxRank,'UNKNOWN-offchain-algorithm-not-recomputed');
assert.equal(measurement.epistemic.currentEpoch,'UNKNOWN-not-measured-by-this-atom');
assert.equal(measurement.epistemic.executionAuthority,'none');
assert.doesNotThrow(()=>JSON.stringify(measurement));

const state=baseState();
applyFraxEcosystemSensor({state,previousState:null});
applyFloxFxtlCurrentState({state,previousState:null,measurement});
const obs=state.protocolEvidence['registry-frax-ecosystem'].latest.observation;
assert.equal(obs.surfaces.fraxtalFloxFxtl.measurementState,'MEASURED-current-onchain-points-ledger-partial');
assert.equal(obs.coverage.measuredSurfaceCount,2);
assert.equal(obs.coverage.sourceBoundUnknownSurfaceCount,7);
assert.equal(obs.measurementExtensions.floxFxtlCurrent,FRAX_FLOX_FXTL_CURRENT_VERSION);
assert.equal(obs.epistemic.floxFxtlPointUsdValue,'UNKNOWN-not-defined-by-ledger');
assert.equal(obs.epistemic.floxFxtlCompanyExposure,'UNKNOWN-not-measured-by-this-atom');
assert.equal(obs.authority.executionAuthority,'none');

const unavailable=await collectFloxFxtlCurrentState({config:config(),endpointsOverride:[{id:'bad',url:'https://fraxtal.test'}],fetchImpl:makeFetch({fail:true})});
assert.match(unavailable.status,/^UNKNOWN/);
assert.equal(unavailable.measurementClass,'UNKNOWN');
const state2=baseState();
applyFraxEcosystemSensor({state:state2,previousState:null});
applyFloxFxtlCurrentState({state:state2,previousState:null,measurement:unavailable});
const obs2=state2.protocolEvidence['registry-frax-ecosystem'].latest.observation;
assert.equal(obs2.surfaces.fraxtalFloxFxtl.measurementState,'UNKNOWN-current-value-not-ingested');
assert.equal(obs2.coverage.measuredSurfaceCount,1);
assert.equal(obs2.coverage.sourceBoundUnknownSurfaceCount,8);

const mismatch=await collectFloxFxtlCurrentState({config:config(),endpointsOverride:[{id:'bad-id',url:'https://fraxtal.test'}],fetchImpl:makeFetch({identityMismatch:true})});
assert.match(mismatch.status,/^UNKNOWN/);
assert.equal(mismatch.measurementClass,'UNKNOWN');

console.log('FRAX FLOX FXTL CURRENT LEDGER CANARY PASS',{
  blockNumber:measurement.network.blockNumber,
  totalSupplyPoints:measurement.ledger.totalSupplyPoints,
  measuredSurfaces:obs.coverage.measuredSurfaceCount,
  currentEpoch:measurement.epistemic.currentEpoch,
  pointUsdValue:measurement.epistemic.pointUsdValue,
  executionAuthority:measurement.epistemic.executionAuthority
});

if(process.env.GITHUB_ACTIONS==='true'){
  const live=await collectFloxFxtlCurrentState();
  if(live.status!=='ok'||live.measurementClass!=='MEASURED'||live.coverage?.exactBlockLedgerIdentity!==true||live.coverage?.currentTotalPointSupply!==true)throw new Error(`FRAX FLOX FXTL LIVE CURRENT PROOF FAILED ${JSON.stringify({status:live.status,attempts:live.attempts})}`);
  if(live.ledger?.address?.toLowerCase()!=='0xab4b7c5c9a7c8ebb97877085a6c3550ad4ed3f97'||live.ledger?.name!=='FXTL Points'||live.ledger?.symbol!=='FXTL'||Number(live.ledger?.decimals)!==0)throw new Error('FRAX FLOX FXTL live ledger identity drift');
  if(!/^\d+$/.test(String(live.ledger?.totalSupplyPoints||'')))throw new Error('FRAX FLOX FXTL live total supply missing');
  if(live.epistemic?.pointsAreUsd!==false||live.epistemic?.pointsAreTransferable!==false||live.epistemic?.currentFloxRank!=='UNKNOWN-offchain-algorithm-not-recomputed'||live.epistemic?.executionAuthority!=='none')throw new Error('FRAX FLOX FXTL live epistemic/authority boundary drift');
  console.log('FRAX FLOX FXTL LIVE EXACT-BLOCK PROOF PASS',{
    observedAt:live.observedAt,
    blockNumber:live.network.blockNumber,
    blockHash:live.network.blockHash,
    contract:live.ledger.address,
    totalSupplyPoints:live.ledger.totalSupplyPoints,
    codeSizeBytes:live.ledger.codeSizeBytes,
    rpcEndpointId:live.rpc.endpointId,
    currentEpoch:live.epistemic.currentEpoch,
    pointUsdValue:live.epistemic.pointUsdValue,
    executionAuthority:live.epistemic.executionAuthority
  });
}
