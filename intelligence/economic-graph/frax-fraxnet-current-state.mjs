#!/usr/bin/env node
/**
 * The Holding · FraxNet current topology + relay-state sensor v0.1
 *
 * One bounded read-only atom for the existing Frax ecosystem family:
 * - source-pinned route/custodian topology from official Frax docs;
 * - exact-block deployed-code proofs for Ethereum FraxNet anchors and Fraxtal hops;
 * - read-only FraxNet API health + /activeJobs snapshot.
 *
 * Processing endpoints are explicitly forbidden. Supported routes are topology,
 * not measured capital flow; active relay jobs are not economic-demand evidence.
 * No execution, price, recommendation, methodology or causal authority.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FRAXTAL_CHAIN_ID, FRAXTAL_RPC_ENDPOINTS } from './frax-bamm-onchain.mjs';
import { FRAX_ECOSYSTEM_EVIDENCE_ID, FRAX_PROTOCOL_ID } from './frax-ecosystem-sensor.mjs';

export const FRAX_FRAXNET_CURRENT_VERSION='0.1-fraxnet-current-topology-api-exact-block';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const ROUTE_REGISTRY_FILE=path.join(ROOT,'intelligence/economic-graph/frax-fraxnet-route-registry.json');
const RPC_REGISTRY_FILE=path.join(ROOT,'intelligence/market-data/onchain-price-source-registry.json');
const RPC_TIMEOUT_MS=12_000;
const API_TIMEOUT_MS=10_000;
const MAX_ACTIVE_JOB_ROWS=100;
const MAX_OBSERVATIONS=1000;

function sha256(value){return crypto.createHash('sha256').update(value).digest('hex');}
function stableValue(value){if(Array.isArray(value))return value.map(stableValue);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(k=>[k,stableValue(value[k])]));return value;}
function stableStringify(value){return JSON.stringify(stableValue(value));}
function readJson(file){return JSON.parse(fs.readFileSync(file,'utf8'));}
function isAddress(v){return /^0x[0-9a-f]{40}$/i.test(String(v||''));}
function isSha(v){return /^[0-9a-f]{40}$/i.test(String(v||''));}
function isInt(v){return Number.isSafeInteger(Number(v))&&Number(v)>=0;}
function rpcQuantity(v){if(!/^0x[0-9a-f]+$/i.test(String(v||'')))throw new Error('Invalid RPC quantity');return BigInt(v);}
function nonemptyCode(v){const s=String(v||'').toLowerCase();return /^0x[0-9a-f]+$/.test(s)&&!/^0x0*$/.test(s);}
function sourceTopology(config){
  return {
    registryVersion:config?.version||null,
    officialSources:config?.officialSources||null,
    ethereumMintRedeemAssets:Array.isArray(config?.ethereumMintRedeemAssets)?config.ethereumMintRedeemAssets:[],
    mintDestinations:Array.isArray(config?.mintDestinations)?config.mintDestinations:[],
    redemptionDestinations:Array.isArray(config?.redemptionDestinations)?config.redemptionDestinations:[],
    ethereumDirectRedemption:config?.ethereumDirectRedemption===true
  };
}

function loadConfig(config){
  const x=config||readJson(ROUTE_REGISTRY_FILE);
  const semantics=x?.semantics||{};
  if(x?.version!=='0.1-fraxnet-route-registry-current-official-docs')throw new Error('FraxNet route registry version drift');
  if(semantics.configIsSourceBoundTopology!==true||semantics.configIsLiveMeasurement!==false||semantics.apiReadOnlyEndpointsOnly!==true||semantics.processingEndpointsExcluded!==true||semantics.supportedRoutesAreNotFlowVolume!==true||semantics.activeJobsAreNotEconomicDemand!==true||semantics.unknownIsZero!==false||semantics.causalClaimAuthority!=='none'||semantics.executionAuthority!=='none')throw new Error('FraxNet registry epistemic/authority drift');
  const src=x.officialSources||{};
  for(const key of ['routesBlobSha','contractsBlobSha','cctpBlobSha'])if(!isSha(src[key]))throw new Error(`FraxNet source pin missing: ${key}`);
  if(x?.api?.baseUrl!=='https://api-net.frax.com')throw new Error('FraxNet API identity drift');
  const readOnly=x?.api?.readOnlyEndpoints||[],excluded=x?.api?.excludedProcessingEndpoints||[];
  if(!Array.isArray(readOnly)||readOnly.join('|')!=='/health|/activeJobs')throw new Error('FraxNet read-only API surface drift');
  if(!Array.isArray(excluded)||!excluded.includes('/processDeposit')||!excluded.includes('/processRedemption')||!excluded.includes('/scheduleCCTPRelay'))throw new Error('FraxNet processing-endpoint exclusion drift');
  if(readOnly.some(v=>excluded.includes(v)))throw new Error('FraxNet read-only and processing endpoint overlap');

  const mint=x.mintDestinations||[],redeem=x.redemptionDestinations||[],assets=x.ethereumMintRedeemAssets||[];
  if(!mint.length||!redeem.length||!assets.length)throw new Error('FraxNet route registry empty');
  if(new Set(mint.map(r=>Number(r.layerZeroEid))).size!==mint.length||mint.some(r=>!r?.chain||!isInt(r.layerZeroEid)))throw new Error('FraxNet mint route identity invalid');
  if(new Set(redeem.map(r=>Number(r.cctpDomain))).size!==redeem.length||redeem.some(r=>!r?.chain||!isInt(r.cctpDomain)))throw new Error('FraxNet redemption route identity invalid');
  if(assets.some(r=>!r?.asset||!isAddress(r.assetAddress)||!isAddress(r.custodian)))throw new Error('FraxNet Ethereum custodian route identity invalid');
  for(const [name,chainId] of [['ethereum',1],['fraxtal',FRAXTAL_CHAIN_ID]]){
    const network=x?.networks?.[name];
    if(Number(network?.chainId)!==chainId||!Array.isArray(network?.anchors)||!network.anchors.length)throw new Error(`FraxNet ${name} anchor registry invalid`);
    if(network.anchors.some(a=>!a?.id||!isAddress(a.address)))throw new Error(`FraxNet ${name} anchor identity invalid`);
    if(new Set(network.anchors.map(a=>a.id)).size!==network.anchors.length)throw new Error(`FraxNet ${name} anchor duplicate`);
  }
  return x;
}

function loadEndpoints(config,rpcRegistry){
  const registry=rpcRegistry||readJson(RPC_REGISTRY_FILE);
  const eth=registry?.networks?.ethereum;
  const ethereum=Number(eth?.chainId)===1&&Array.isArray(eth?.rpcFailover)?eth.rpcFailover:[];
  const fraxtal=FRAXTAL_RPC_ENDPOINTS;
  if(!ethereum.length||!Array.isArray(fraxtal)||!fraxtal.length)throw new Error('FraxNet required RPC endpoints unavailable');
  if(Number(config.networks.ethereum.chainId)!==1||Number(config.networks.fraxtal.chainId)!==FRAXTAL_CHAIN_ID)throw new Error('FraxNet chain identity drift');
  return {ethereum,fraxtal};
}

async function postBatch(url,payload,fetchImpl){
  const response=await fetchImpl(url,{
    method:'POST',
    headers:{'content-type':'application/json',accept:'application/json'},
    body:JSON.stringify(payload),
    signal:AbortSignal.timeout(RPC_TIMEOUT_MS)
  });
  if(!response.ok)throw new Error(`RPC HTTP ${response.status}`);
  const body=await response.json();
  if(!Array.isArray(body))throw new Error('RPC response is not an array');
  const byId=new Map(body.map(r=>[Number(r?.id),r]));
  for(const req of payload){
    const row=byId.get(req.id);
    if(!row)throw new Error(`RPC result ${req.id} missing`);
    if(row.error)throw new Error(`RPC ${req.method} error: ${row.error?.message||'unknown'}`);
    if(row.result===undefined||row.result===null)throw new Error(`RPC ${req.method} result missing`);
  }
  return byId;
}

async function collectAnchorNetwork({network,networkConfig,endpoints,fetchImpl}){
  const attempts=[];
  for(const endpoint of endpoints){
    try{
      const first=await postBatch(endpoint.url,[{jsonrpc:'2.0',id:1,method:'eth_blockNumber',params:[]}],fetchImpl);
      const blockNumber=rpcQuantity(first.get(1).result);
      const blockTag=`0x${blockNumber.toString(16)}`;
      const requests=[{jsonrpc:'2.0',id:2,method:'eth_getBlockByNumber',params:[blockTag,false]}];
      for(let i=0;i<networkConfig.anchors.length;i++)requests.push({jsonrpc:'2.0',id:100+i,method:'eth_getCode',params:[networkConfig.anchors[i].address,blockTag]});
      const rows=await postBatch(endpoint.url,requests,fetchImpl);
      const block=rows.get(2).result;
      if(!block||String(block.number||'').toLowerCase()!==blockTag.toLowerCase()||!/^0x[0-9a-f]{64}$/i.test(String(block.hash||'')))throw new Error('FraxNet exact block identity unavailable');
      const blockTimestamp=Number(rpcQuantity(block.timestamp));
      const anchors=networkConfig.anchors.map((a,i)=>{
        const code=String(rows.get(100+i).result||'');
        if(!nonemptyCode(code))throw new Error(`FraxNet deployed code missing ${network}:${a.id}`);
        return {...a,codePresent:true,codeSizeBytes:(code.length-2)/2};
      });
      return {
        status:'ok',measurementClass:'MEASURED',network,chainId:Number(networkConfig.chainId),
        observedAt:new Date(blockTimestamp*1000).toISOString(),blockNumber:Number(blockNumber),blockHash:String(block.hash).toLowerCase(),blockTimestamp,
        anchors,rpc:{endpointId:endpoint.id,failoverAttempts:attempts},
        epistemic:{anchorCodePresence:'MEASURED-exact-block',contractSemantics:'ATTRIBUTED-official-source-not-inferred-from-bytecode',executionAuthority:'none'}
      };
    }catch(error){
      attempts.push({network,endpointId:endpoint.id,error:error instanceof Error?error.message:String(error)});
    }
  }
  return {status:'UNKNOWN-anchor-read-failed',measurementClass:'UNKNOWN',network,chainId:Number(networkConfig.chainId),observedAt:null,blockNumber:null,blockHash:null,blockTimestamp:null,anchors:[],rpc:{endpointId:null,failoverAttempts:attempts},epistemic:{anchorCodePresence:'UNKNOWN',executionAuthority:'none'}};
}

async function readText(url,fetchImpl){
  const response=await fetchImpl(url,{method:'GET',headers:{accept:'text/plain, application/json'},signal:AbortSignal.timeout(API_TIMEOUT_MS)});
  if(!response.ok)throw new Error(`FraxNet API HTTP ${response.status}`);
  return response.text();
}
async function readJsonUrl(url,fetchImpl){
  const response=await fetchImpl(url,{method:'GET',headers:{accept:'application/json'},signal:AbortSignal.timeout(API_TIMEOUT_MS)});
  if(!response.ok)throw new Error(`FraxNet API HTTP ${response.status}`);
  return response.json();
}

function normalizeActiveJobs(body){
  if(body?.ok!==true)throw new Error(`FraxNet /activeJobs ok=false: ${body?.error||'unknown'}`);
  if(!isInt(body.total_jobs)||!isInt(body.total_active))throw new Error('FraxNet /activeJobs totals invalid');
  if(!body.counts||typeof body.counts!=='object'||Array.isArray(body.counts))throw new Error('FraxNet /activeJobs counts invalid');
  const counts={};
  for(const [key,value] of Object.entries(body.counts)){
    if(!key||!isInt(value))throw new Error('FraxNet /activeJobs status count invalid');
    counts[key]=Number(value);
  }
  const countSum=Object.values(counts).reduce((a,b)=>a+b,0);
  if(countSum!==Number(body.total_jobs))throw new Error(`FraxNet /activeJobs count conservation failed ${countSum} != ${body.total_jobs}`);
  if(!Array.isArray(body.active_jobs))throw new Error('FraxNet /activeJobs active_jobs invalid');
  if(body.active_jobs.length>Number(body.total_active))throw new Error('FraxNet /activeJobs active rows exceed total_active');
  const activeJobs=body.active_jobs.slice(0,MAX_ACTIVE_JOB_ROWS).map(row=>{
    if(!row||typeof row!=='object'||typeof row.status!=='string'||!isInt(row.dest_domain)||!isInt(row.created_at))throw new Error('FraxNet /activeJobs row invalid');
    return {
      jobId:typeof row.job_id==='string'?row.job_id:null,
      status:row.status,
      destDomain:Number(row.dest_domain),
      createdAt:Number(row.created_at)
    };
  });
  return {
    totalJobs:Number(body.total_jobs),
    totalActive:Number(body.total_active),
    counts,
    countConservationProven:true,
    activeJobs,
    activeJobsReturned:body.active_jobs.length,
    activeJobsStored:activeJobs.length,
    activeJobsTruncated:body.active_jobs.length>MAX_ACTIVE_JOB_ROWS
  };
}

async function collectApi({config,fetchImpl}){
  const attempts=[];
  const base=config.api.baseUrl.replace(/\/$/,'');
  let health=null,activeJobs=null;
  try{
    const text=(await readText(`${base}/health`,fetchImpl)).trim();
    if(text!=='ok')throw new Error(`unexpected health body ${JSON.stringify(text)}`);
    health={status:'ok',body:text,observedAt:new Date().toISOString()};
  }catch(error){
    attempts.push({endpoint:'/health',error:error instanceof Error?error.message:String(error)});
  }
  try{
    const body=await readJsonUrl(`${base}/activeJobs`,fetchImpl);
    activeJobs={status:'ok',...normalizeActiveJobs(body),observedAt:new Date().toISOString()};
  }catch(error){
    attempts.push({endpoint:'/activeJobs',error:error instanceof Error?error.message:String(error)});
  }
  const ok=health?.status==='ok'&&activeJobs?.status==='ok';
  return {
    status:ok?'ok':'UNKNOWN-readonly-api-incomplete',
    measurementClass:ok?'MEASURED':'UNKNOWN',
    baseUrl:base,health,activeJobs,attempts,
    endpointsCalled:['/health','/activeJobs'],
    processingEndpointsCalled:[],
    epistemic:{
      apiHealth:health?.status==='ok'?'MEASURED-current-public-api':'UNKNOWN',
      relayJobSummary:activeJobs?.status==='ok'?'MEASURED-current-public-api':'UNKNOWN',
      relayJobCountsAreCapitalFlow:false,
      activeJobsAreEconomicDemand:false,
      executionAuthority:'none'
    }
  };
}

function unknown({reason='UNKNOWN-fraxnet-current-state-unavailable',config=null,rpc={},api=null,attempts=[]}={}){
  return {
    version:FRAX_FRAXNET_CURRENT_VERSION,status:reason,measurementClass:'UNKNOWN',observedAt:null,
    topology:sourceTopology(config),
    anchors:rpc,
    api:api||{status:'UNKNOWN-not-read',measurementClass:'UNKNOWN'},
    coverage:{
      sourceBoundMintDestinationCount:Array.isArray(config?.mintDestinations)?config.mintDestinations.length:null,
      sourceBoundRedemptionDestinationCount:Array.isArray(config?.redemptionDestinations)?config.redemptionDestinations.length:null,
      sourceBoundEthereumAssetRouteCount:Array.isArray(config?.ethereumMintRedeemAssets)?config.ethereumMintRedeemAssets.length:null,
      exactBlockNetworkAnchorCount:0,
      fullRequiredAnchorCoverage:false,
      readOnlyApiCoverage:false
    },
    attempts,
    edges:[
      {from:'official route registry',to:'supported route topology',class:'ATTRIBUTED-source-pinned-not-live-flow'},
      {from:'supported route topology',to:'actual capital flow',class:'UNKNOWN'},
      {from:'active relay jobs',to:'economic demand',class:'UNKNOWN'}
    ],
    epistemic:{
      sourceTopology:'ATTRIBUTED-source-pinned-config-not-live-measurement',
      anchorCodePresence:'UNKNOWN',
      apiHealth:'UNKNOWN',
      relayJobSummary:'UNKNOWN',
      mintRedeemMechanism:'MECHANICAL-source-documented-not-transaction-replayed',
      crossChainFlowVolume:'UNKNOWN-not-measured-by-this-atom',
      activeJobsAreEconomicDemand:false,
      unknownIsZero:false,
      causalClaimAuthority:'none',
      executionAuthority:'none'
    }
  };
}

export async function collectFraxNetCurrentState({config=null,rpcRegistry=null,fetchImpl=fetch,endpointsOverride=null}={}){
  let cfg;
  try{cfg=loadConfig(config);}catch(error){return unknown({reason:'UNKNOWN-fraxnet-route-registry-invalid',config,attempts:[{scope:'config',error:error.message}]});}
  let endpoints;
  try{endpoints=endpointsOverride||loadEndpoints(cfg,rpcRegistry);}catch(error){return unknown({reason:'UNKNOWN-fraxnet-rpc-registry-unavailable',config:cfg,attempts:[{scope:'rpc-registry',error:error.message}]});}

  const ethereum=await collectAnchorNetwork({network:'ethereum',networkConfig:cfg.networks.ethereum,endpoints:endpoints.ethereum||[],fetchImpl});
  const fraxtal=await collectAnchorNetwork({network:'fraxtal',networkConfig:cfg.networks.fraxtal,endpoints:endpoints.fraxtal||[],fetchImpl});
  const api=await collectApi({config:cfg,fetchImpl});
  const rpc={ethereum,fraxtal};
  const fullAnchors=ethereum.status==='ok'&&fraxtal.status==='ok';
  const valid=fullAnchors&&api.status==='ok';
  const attempts=[
    ...(ethereum.rpc?.failoverAttempts||[]),
    ...(fraxtal.rpc?.failoverAttempts||[]),
    ...(api.attempts||[]).map(x=>({scope:'api',...x}))
  ];
  if(!valid)return unknown({reason:'UNKNOWN-fraxnet-current-state-incomplete',config:cfg,rpc,api,attempts});

  const exactBlockNetworkAnchorCount=ethereum.anchors.length+fraxtal.anchors.length;
  return {
    version:FRAX_FRAXNET_CURRENT_VERSION,status:'ok',measurementClass:'MEASURED',observedAt:new Date().toISOString(),
    topology:sourceTopology(cfg),
    anchors:rpc,
    api,
    coverage:{
      sourceBoundMintDestinationCount:cfg.mintDestinations.length,
      sourceBoundRedemptionDestinationCount:cfg.redemptionDestinations.length,
      sourceBoundEthereumAssetRouteCount:cfg.ethereumMintRedeemAssets.length,
      exactBlockNetworkAnchorCount,
      exactBlockEthereumAnchorCount:ethereum.anchors.length,
      exactBlockFraxtalAnchorCount:fraxtal.anchors.length,
      fullRequiredAnchorCoverage:true,
      readOnlyApiCoverage:true
    },
    attempts,
    edges:[
      {from:'official source-pinned route table',to:'supported mint/redemption topology',class:'ATTRIBUTED-source-pinned-not-live-flow'},
      {from:'Ethereum exact-block eth_getCode',to:'FraxNet factory/redemption/frxUSD anchors deployed',class:'MEASURED-exact-block'},
      {from:'Fraxtal exact-block eth_getCode',to:'RemoteHop/MintRedeemHop anchors deployed',class:'MEASURED-exact-block'},
      {from:'FraxNet /activeJobs public snapshot',to:'current CCTP relay job counts',class:'MEASURED-current-public-api'},
      {from:'approved collateral deposit + FraxNetDeposit processing',to:'frxUSD mint/send path',class:'MECHANICAL-source-documented-not-transaction-replayed'},
      {from:'frxUSD redemption + CCTP relay',to:'destination USDC delivery path',class:'MECHANICAL-source-documented-not-transaction-replayed'},
      {from:'supported route or active relay job',to:'economic demand / capital migration conclusion',class:'UNKNOWN'}
    ],
    provenance:{
      routeRegistryVersion:cfg.version,
      officialSources:cfg.officialSources,
      apiReadOnlyEndpoints:cfg.api.readOnlyEndpoints,
      processingEndpointsExcluded:cfg.api.excludedProcessingEndpoints
    },
    epistemic:{
      sourceTopology:'ATTRIBUTED-source-pinned-config-not-live-flow',
      anchorCodePresence:'MEASURED-exact-block',
      apiHealth:'MEASURED-current-public-api',
      relayJobSummary:'MEASURED-current-public-api',
      mintRedeemMechanism:'MECHANICAL-source-documented-not-transaction-replayed',
      crossChainFlowVolume:'UNKNOWN-not-measured-by-this-atom',
      mintedFrxUsdVolume:'UNKNOWN-not-measured-by-this-atom',
      redeemedFrxUsdVolume:'UNKNOWN-not-measured-by-this-atom',
      activeJobsAreEconomicDemand:false,
      supportedRoutesAreCapitalFlow:false,
      processingEndpointsCalled:false,
      unknownIsZero:false,
      causalClaimAuthority:'none',
      executionAuthority:'none'
    }
  };
}

export function applyFraxNetCurrentState({state,previousState,measurement}){
  if(!state||typeof state!=='object')throw new Error('FraxNet adapter requires Economic Graph state');
  if(state?.authority?.executionAuthority!=='none'||state?.authority?.causalClaimAuthority!=='none')throw new Error('FraxNet adapter refuses Graph authority drift');
  const evidence=state?.protocolEvidence?.[FRAX_ECOSYSTEM_EVIDENCE_ID];
  const base=evidence?.latest?.observation;
  const fraxSensor=state?.protocolSensors?.[FRAX_PROTOCOL_ID];
  if(!evidence||!base||!fraxSensor)throw new Error('Frax ecosystem evidence missing before FraxNet enrichment');
  const current=structuredClone(base);
  const surface=current?.surfaces?.fraxNet;
  if(!surface)throw new Error('FraxNet surface missing');

  const valid=measurement?.status==='ok'&&measurement?.measurementClass==='MEASURED'&&measurement?.coverage?.fullRequiredAnchorCoverage===true&&measurement?.coverage?.readOnlyApiCoverage===true&&measurement?.epistemic?.executionAuthority==='none';
  surface.measured=measurement;
  surface.measurementState=valid?'MEASURED-current-topology-api-partial':'UNKNOWN-current-value-not-ingested';
  surface.mechanicalRelations=[
    {from:'source-pinned Frax route registry',to:'supported mint/redemption topology',class:'ATTRIBUTED-official-source-not-live-flow'},
    {from:'Ethereum exact-block deployed code',to:'FraxNet factory + redemption + frxUSD anchors',class:valid?'MEASURED-exact-block':'UNKNOWN'},
    {from:'Fraxtal exact-block deployed code',to:'RemoteHop + MintRedeemHop anchors',class:valid?'MEASURED-exact-block':'UNKNOWN'},
    {from:'FraxNet /activeJobs',to:'current relay job counts',class:valid?'MEASURED-current-public-api':'UNKNOWN'},
    {from:'approved collateral deposit',to:'frxUSD mint/send path',class:'MECHANICAL-source-documented-not-transaction-replayed'},
    {from:'frxUSD redemption',to:'USDC/CCTP destination path',class:'MECHANICAL-source-documented-not-transaction-replayed'},
    {from:'supported route / active job',to:'economic demand or capital migration',class:'UNKNOWN'}
  ];

  current.measurementExtensions={...(current.measurementExtensions||{}),fraxNetCurrent:FRAX_FRAXNET_CURRENT_VERSION};
  current.epistemic={
    ...(current.epistemic||{}),
    fraxNetCurrentTopology:valid?'MEASURED+ATTRIBUTED-current-anchors-source-routes':'UNKNOWN',
    fraxNetRelayJobSummary:valid?'MEASURED-current-public-api':'UNKNOWN',
    fraxNetCrossChainFlowVolume:'UNKNOWN-not-measured-by-this-atom',
    fraxNetDemandCausality:'UNKNOWN',
    fraxNetProcessingEndpointsCalled:false
  };
  const surfaces=Object.values(current.surfaces||{});
  const measured=surfaces.filter(s=>String(s.measurementState||'').startsWith('MEASURED'));
  current.coverage.measuredSurfaceCount=measured.length;
  current.coverage.sourceBoundUnknownSurfaceCount=surfaces.length-measured.length;
  current.relationshipGraph=surfaces.flatMap(s=>(s.mechanicalRelations||[]).map((r,index)=>({surfaceId:s.id,index,...r})));
  current.coverage.relationshipCount=current.relationshipGraph.length;
  current.coverage.relationshipClassCounts=current.relationshipGraph.reduce((a,r)=>{const k=String(r.class||'UNKNOWN').split('-')[0];a[k]=(a[k]||0)+1;return a;},{});
  current.id=`frax-ecosystem:${sha256(stableStringify({
    priorId:base.id,
    fraxNet:valid?{
      anchors:Object.fromEntries(Object.entries(measurement.anchors||{}).map(([network,row])=>[network,{blockNumber:row.blockNumber,blockHash:row.blockHash,anchors:(row.anchors||[]).map(a=>[a.id,a.address,a.codeSizeBytes])}])),
      api:measurement.api?.activeJobs?{totalJobs:measurement.api.activeJobs.totalJobs,totalActive:measurement.api.activeJobs.totalActive,counts:measurement.api.activeJobs.counts}:null,
      routeRegistryVersion:measurement.topology?.registryVersion
    }:{status:measurement?.status||'UNKNOWN'},
    surfaceIds:current.coverage.surfaceIds
  })).slice(0,24)}`;

  const previousRows=Array.isArray(previousState?.protocolEvidence?.[FRAX_ECOSYSTEM_EVIDENCE_ID]?.observations)?previousState.protocolEvidence[FRAX_ECOSYSTEM_EVIDENCE_ID].observations:[];
  const rows=[...previousRows];
  if(!rows.some(r=>r?.id===current.id))rows.push(current);
  evidence.latest={observation:current};
  evidence.status=current.status;
  evidence.observations=rows.slice(-MAX_OBSERVATIONS);
  evidence.observationCount=evidence.observations.length;
  evidence.measurementExtensions={...(evidence.measurementExtensions||{}),fraxNetCurrent:FRAX_FRAXNET_CURRENT_VERSION};

  fraxSensor.ecosystemFamily={
    ...(fraxSensor.ecosystemFamily||{}),
    status:current.status,
    measuredSurfaceCount:current.coverage.measuredSurfaceCount,
    sourceBoundUnknownSurfaceCount:current.coverage.sourceBoundUnknownSurfaceCount,
    latestObservationId:current.id,
    measurementExtensions:{...(fraxSensor.ecosystemFamily?.measurementExtensions||{}),fraxNetCurrent:FRAX_FRAXNET_CURRENT_VERSION}
  };
  if(fraxSensor?.latest?.observation)fraxSensor.latest.observation.ecosystemFamily=fraxSensor.ecosystemFamily;

  if(current.coverage.measuredSurfaceCount+current.coverage.sourceBoundUnknownSurfaceCount!==current.coverage.surfaceCount)throw new Error('FraxNet depth accounting drift');
  if(valid&&measurement.api?.processingEndpointsCalled?.length)throw new Error('FraxNet processing endpoint was called');
  if(valid&&measurement.epistemic?.processingEndpointsCalled!==false)throw new Error('FraxNet processing endpoint boundary drift');
  if(valid&&Object.values(measurement.anchors||{}).some(row=>row?.status!=='ok'||row?.measurementClass!=='MEASURED'||(row.anchors||[]).some(a=>a.codePresent!==true)))throw new Error('FraxNet anchor proof invariant drift');
  if(valid&&measurement.api?.activeJobs?.countConservationProven!==true)throw new Error('FraxNet active job accounting invariant drift');
  if(current?.authority?.executionAuthority!=='none'||current?.epistemic?.executionAuthority!=='none'||measurement?.epistemic?.executionAuthority!=='none')throw new Error('FraxNet execution authority leaked');
  return state;
}
