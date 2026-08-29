#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { applyFraxEcosystemSensor } from './frax-ecosystem-sensor.mjs';
import { collectFraxNetCurrentState, applyFraxNetCurrentState, FRAX_FRAXNET_CURRENT_VERSION } from './frax-fraxnet-current-state.mjs';

const ETH_FACTORY='0x1111111111111111111111111111111111111111';
const ETH_FRXUSD='0x2222222222222222222222222222222222222222';
const FXTL_REMOTE='0x3333333333333333333333333333333333333333';
const FXTL_MINT='0x4444444444444444444444444444444444444444';

function config(){return {
  version:'0.1-fraxnet-route-registry-current-official-docs',
  purpose:'synthetic',
  officialSources:{
    routesBlobSha:'1111111111111111111111111111111111111111',
    contractsBlobSha:'2222222222222222222222222222222222222222',
    cctpBlobSha:'3333333333333333333333333333333333333333'
  },
  api:{
    baseUrl:'https://api-net.frax.com',
    readOnlyEndpoints:['/health','/activeJobs'],
    excludedProcessingEndpoints:['/fetchAddress','/processDeposit','/processRedemption','/branded/fetchAddress','/branded/processDeposit','/branded/processRedemption','/scheduleCCTPRelay','/jobStatus']
  },
  networks:{
    ethereum:{chainId:1,anchors:[
      {id:'factory',label:'factory',address:ETH_FACTORY},
      {id:'frxusd',label:'frxusd',address:ETH_FRXUSD}
    ]},
    fraxtal:{chainId:252,anchors:[
      {id:'remote-hop',label:'RemoteHop',address:FXTL_REMOTE},
      {id:'mint-redeem-hop',label:'MintRedeemHop',address:FXTL_MINT}
    ]}
  },
  ethereumMintRedeemAssets:[{asset:'USDC',assetAddress:'0x5555555555555555555555555555555555555555',custodian:'0x6666666666666666666666666666666666666666',issuer:'synthetic'}],
  mintDestinations:[{chain:'Fraxtal',layerZeroEid:30255},{chain:'Base',layerZeroEid:30184}],
  redemptionDestinations:[{chain:'Base',cctpDomain:6}],
  ethereumDirectRedemption:true,
  semantics:{
    configIsSourceBoundTopology:true,configIsLiveMeasurement:false,apiReadOnlyEndpointsOnly:true,processingEndpointsExcluded:true,
    supportedRoutesAreNotFlowVolume:true,activeJobsAreNotEconomicDemand:true,unknownIsZero:false,causalClaimAuthority:'none',executionAuthority:'none'
  }
};}
function endpoints(){return {
  ethereum:[{id:'eth-ok',url:'https://eth.test'}],
  fraxtal:[{id:'fxtl-ok',url:'https://fxtl.test'}]
};}
function response({text=null,json=null}){return {
  ok:true,status:200,
  async text(){return text??JSON.stringify(json);},
  async json(){return json??JSON.parse(text);}
};}
function makeFetch({failApi=false,called=[]}={}){return async (url,options={})=>{
  called.push({url:String(url),method:options.method||'GET'});
  if(options.method==='GET'){
    if(failApi)throw new Error('synthetic api outage');
    if(String(url).endsWith('/health'))return response({text:'ok'});
    if(String(url).endsWith('/activeJobs'))return response({json:{
      ok:true,total_jobs:42,total_active:5,
      counts:{pending_attestation:3,relaying:2,complete:30,already_relayed:5,failed:2},
      active_jobs:[
        {job_id:'0x01',status:'pending_attestation',dest_domain:6,created_at:1709729600},
        {job_id:'0x02',status:'pending_attestation',dest_domain:13,created_at:1709729601},
        {job_id:'0x03',status:'pending_attestation',dest_domain:3,created_at:1709729602},
        {job_id:'0x04',status:'relaying',dest_domain:10,created_at:1709729603},
        {job_id:'0x05',status:'relaying',dest_domain:11,created_at:1709729604}
      ]
    }});
    throw new Error(`unexpected GET ${url}`);
  }
  const payload=JSON.parse(options.body);
  const isEth=String(url).includes('eth.test');
  const block=isEth?100n:200n;
  const hash=`0x${(isEth?'ab':'cd').repeat(32)}`;
  const timestamp=isEth?1800000000n:1800000010n;
  const rows=payload.map(req=>{
    if(req.method==='eth_blockNumber')return {jsonrpc:'2.0',id:req.id,result:`0x${block.toString(16)}`};
    if(req.method==='eth_getBlockByNumber')return {jsonrpc:'2.0',id:req.id,result:{number:`0x${block.toString(16)}`,timestamp:`0x${timestamp.toString(16)}`,hash}};
    if(req.method==='eth_getCode'){
      assert.equal(req.params[1],`0x${block.toString(16)}`,'anchor code reads must be exact-block bound');
      return {jsonrpc:'2.0',id:req.id,result:'0x60016000556001600055'};
    }
    throw new Error(`unexpected RPC ${req.method}`);
  });
  return response({json:rows});
};}
function baseState(){return {
  generatedAt:'2026-08-29T05:00:00.000Z',
  authority:{executionAuthority:'none',causalClaimAuthority:'none'},
  protocolLifecycle:{summary:{protocolCount:8},protocols:{'registry-frax-vefrax':{maturityStage:'shadow'}}},
  protocolSensors:{'registry-frax-vefrax':{latest:{observation:{
    epistemic:{executionAuthority:'none'},
    identityBoundary:{currentCanonicalPrincipal:'FRAX',currentCanonicalVoteEscrowLabel:'veFRAX'},
    referenceProductivity:{currentAprPct:5.25},registryExposure:{companyCount:3,positionCount:3},
    longitudinalEvidence:{canonicalSnapshotCount:4,validatedNativePeriodCount:0}
  }}}}
};}

const registry=JSON.parse(fs.readFileSync(new URL('./frax-fraxnet-route-registry.json',import.meta.url),'utf8'));
assert.equal(registry.version,'0.1-fraxnet-route-registry-current-official-docs');
assert.equal(registry.semantics.configIsLiveMeasurement,false);
assert.equal(registry.semantics.supportedRoutesAreNotFlowVolume,true);
assert.equal(registry.semantics.activeJobsAreNotEconomicDemand,true);
assert.equal(registry.semantics.executionAuthority,'none');
assert.deepEqual(registry.api.readOnlyEndpoints,['/health','/activeJobs']);
assert.equal(registry.api.readOnlyEndpoints.some(x=>registry.api.excludedProcessingEndpoints.includes(x)),false);
assert.ok(registry.mintDestinations.length>0);
assert.ok(registry.redemptionDestinations.length>0);
assert.ok(registry.ethereumMintRedeemAssets.length>0);

const called=[];
const measurement=await collectFraxNetCurrentState({config:config(),endpointsOverride:endpoints(),fetchImpl:makeFetch({called})});
assert.equal(measurement.version,FRAX_FRAXNET_CURRENT_VERSION);
assert.equal(measurement.status,'ok');
assert.equal(measurement.measurementClass,'MEASURED');
assert.equal(measurement.coverage.fullRequiredAnchorCoverage,true);
assert.equal(measurement.coverage.readOnlyApiCoverage,true);
assert.equal(measurement.coverage.sourceBoundMintDestinationCount,2);
assert.equal(measurement.coverage.sourceBoundRedemptionDestinationCount,1);
assert.equal(measurement.coverage.exactBlockNetworkAnchorCount,4);
assert.equal(measurement.api.health.body,'ok');
assert.equal(measurement.api.activeJobs.totalJobs,42);
assert.equal(measurement.api.activeJobs.totalActive,5);
assert.equal(measurement.api.activeJobs.countConservationProven,true);
assert.equal(measurement.api.processingEndpointsCalled.length,0);
assert.equal(measurement.epistemic.crossChainFlowVolume,'UNKNOWN-not-measured-by-this-atom');
assert.equal(measurement.epistemic.activeJobsAreEconomicDemand,false);
assert.equal(measurement.epistemic.executionAuthority,'none');
assert.equal(called.filter(x=>x.method==='GET').every(x=>x.url.endsWith('/health')||x.url.endsWith('/activeJobs')),true);
assert.doesNotThrow(()=>JSON.stringify(measurement));

const state=baseState();
applyFraxEcosystemSensor({state,previousState:null});
applyFraxNetCurrentState({state,previousState:null,measurement});
const obs=state.protocolEvidence['registry-frax-ecosystem'].latest.observation;
assert.equal(obs.surfaces.fraxNet.measurementState,'MEASURED-current-topology-api-partial');
assert.equal(obs.coverage.measuredSurfaceCount,2);
assert.equal(obs.coverage.sourceBoundUnknownSurfaceCount,7);
assert.equal(obs.measurementExtensions.fraxNetCurrent,FRAX_FRAXNET_CURRENT_VERSION);
assert.equal(obs.epistemic.fraxNetCrossChainFlowVolume,'UNKNOWN-not-measured-by-this-atom');
assert.equal(obs.surfaces.fraxNet.mechanicalRelations.at(-1).class,'UNKNOWN');
assert.equal(obs.authority.executionAuthority,'none');

const unavailable=await collectFraxNetCurrentState({config:config(),endpointsOverride:endpoints(),fetchImpl:makeFetch({failApi:true})});
assert.match(unavailable.status,/^UNKNOWN/);
assert.equal(unavailable.measurementClass,'UNKNOWN');
assert.equal(unavailable.epistemic.crossChainFlowVolume,'UNKNOWN-not-measured-by-this-atom');
const state2=baseState();
applyFraxEcosystemSensor({state:state2,previousState:null});
applyFraxNetCurrentState({state:state2,previousState:null,measurement:unavailable});
const obs2=state2.protocolEvidence['registry-frax-ecosystem'].latest.observation;
assert.equal(obs2.surfaces.fraxNet.measurementState,'UNKNOWN-current-value-not-ingested');
assert.equal(obs2.coverage.measuredSurfaceCount,1);
assert.equal(obs2.coverage.sourceBoundUnknownSurfaceCount,8);

const invalid=config();
invalid.api.readOnlyEndpoints=['/health','/processDeposit'];
const invalidMeasurement=await collectFraxNetCurrentState({config:invalid,endpointsOverride:endpoints(),fetchImpl:makeFetch()});
assert.equal(invalidMeasurement.status,'UNKNOWN-fraxnet-route-registry-invalid');
assert.equal(invalidMeasurement.measurementClass,'UNKNOWN');

console.log('FRAXNET CURRENT TOPOLOGY + READ-ONLY API CANARY PASS',{
  sourceMintRoutes:measurement.coverage.sourceBoundMintDestinationCount,
  sourceRedemptionRoutes:measurement.coverage.sourceBoundRedemptionDestinationCount,
  anchorCount:measurement.coverage.exactBlockNetworkAnchorCount,
  totalRelayJobs:measurement.api.activeJobs.totalJobs,
  activeRelayJobs:measurement.api.activeJobs.totalActive,
  measuredSurfaces:obs.coverage.measuredSurfaceCount,
  flowVolume:measurement.epistemic.crossChainFlowVolume,
  executionAuthority:measurement.epistemic.executionAuthority
});

if(process.env.GITHUB_ACTIONS==='true'){
  const live=await collectFraxNetCurrentState();
  if(live.status!=='ok'||live.measurementClass!=='MEASURED'||live.coverage?.fullRequiredAnchorCoverage!==true||live.coverage?.readOnlyApiCoverage!==true)throw new Error(`FRAXNET LIVE CURRENT PROOF FAILED ${JSON.stringify({status:live.status,attempts:live.attempts,api:live.api})}`);
  if(live.api?.processingEndpointsCalled?.length||live.epistemic?.processingEndpointsCalled!==false)throw new Error('FRAXNET live processing-endpoint boundary drift');
  if(live.epistemic?.crossChainFlowVolume!=='UNKNOWN-not-measured-by-this-atom'||live.epistemic?.activeJobsAreEconomicDemand!==false||live.epistemic?.executionAuthority!=='none')throw new Error('FRAXNET live epistemic/authority boundary drift');
  if(Object.values(live.anchors||{}).some(row=>row?.status!=='ok'||(row.anchors||[]).some(a=>a.codePresent!==true)))throw new Error('FRAXNET live anchor code proof failed');
  console.log('FRAXNET LIVE CURRENT TOPOLOGY + RELAY STATE PASS',{
    observedAt:live.observedAt,
    mintDestinations:live.coverage.sourceBoundMintDestinationCount,
    redemptionDestinations:live.coverage.sourceBoundRedemptionDestinationCount,
    ethereumAssetRoutes:live.coverage.sourceBoundEthereumAssetRouteCount,
    anchors:Object.fromEntries(Object.entries(live.anchors).map(([k,v])=>[k,{blockNumber:v.blockNumber,anchorCount:v.anchors.length,rpcEndpointId:v.rpc.endpointId}])),
    relayJobs:{total:live.api.activeJobs.totalJobs,active:live.api.activeJobs.totalActive,counts:live.api.activeJobs.counts},
    executionAuthority:live.epistemic.executionAuthority
  });
}
