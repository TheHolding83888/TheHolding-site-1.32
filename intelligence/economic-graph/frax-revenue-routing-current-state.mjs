#!/usr/bin/env node
/**
 * The Holding · Frax revenue-routing current distribution sensor v0.1
 *
 * Bounded read-only atom for the final top-level Frax ecosystem surface. It
 * measures the current Fraxtal YieldDistributor state at one exact block and
 * proves the source-documented reward-period identity mechanically.
 *
 * This atom deliberately does NOT claim that Fraxswap feeTo LP, any specific
 * protocol fee stream, or any treasury balance funded this distributor. It also
 * does not relabel distributor inventory as realized company cash flow.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FRAXTAL_CHAIN_ID, FRAXTAL_RPC_ENDPOINTS } from './frax-bamm-onchain.mjs';
import { FRAX_ECOSYSTEM_EVIDENCE_ID, FRAX_PROTOCOL_ID } from './frax-ecosystem-sensor.mjs';

export const FRAX_REVENUE_ROUTING_CURRENT_VERSION='0.1-frax-yield-distributor-current-state';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const REGISTRY_FILE=path.join(ROOT,'intelligence/economic-graph/frax-revenue-routing-registry.json');
const RPC_TIMEOUT_MS=12_000;
const MAX_OBSERVATIONS=1000;
const EIP1967_IMPLEMENTATION_SLOT='0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc';
const SELECTORS={
  emittedToken:'0xe9218ff6',
  yieldDuration:'0xe172cf21',
  yieldRate:'0x6999ac93',
  periodFinish:'0xebe2b12b',
  lastUpdateTime:'0xc8f33c91',
  getYieldForDuration:'0x19aec6d2',
  yieldCollectionPaused:'0xad1148cb',
  owner:'0x8da5cb5b',
  balanceOf:'0x70a08231'
};

function sha256(value){return crypto.createHash('sha256').update(value).digest('hex');}
function stableValue(value){if(Array.isArray(value))return value.map(stableValue);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(k=>[k,stableValue(value[k])]));return value;}
function stableStringify(value){return JSON.stringify(stableValue(value));}
function readJson(file){return JSON.parse(fs.readFileSync(file,'utf8'));}
function isAddress(value){return /^0x[0-9a-f]{40}$/i.test(String(value||''));}
function isSha(value){return /^[0-9a-f]{40}$/i.test(String(value||''));}
function nonemptyCode(value){const s=String(value||'').toLowerCase();return /^0x[0-9a-f]+$/.test(s)&&!/^0x0*$/.test(s);}
function rpcQuantity(value){if(!/^0x[0-9a-f]+$/i.test(String(value||'')))throw new Error('Invalid RPC quantity');return BigInt(value);}
function decodeUint(value){if(!/^0x[0-9a-f]+$/i.test(String(value||'')))throw new Error('Invalid ABI uint');return BigInt(value);}
function decodeBool(value){const n=decodeUint(value);if(n!==0n&&n!==1n)throw new Error('Invalid ABI bool');return n===1n;}
function decodeAddress(value){const raw=String(value||'');if(!/^0x[0-9a-f]{64}$/i.test(raw))throw new Error('Invalid ABI address');return `0x${raw.slice(-40)}`.toLowerCase();}
function storageAddress(value){return decodeAddress(value);}
function encodeAddressArg(address){if(!isAddress(address))throw new Error('Invalid ABI address argument');return String(address).toLowerCase().slice(2).padStart(64,'0');}

function loadConfig(config){
  const x=config||readJson(REGISTRY_FILE);
  if(x?.version!=='0.1-frax-current-yield-distribution-registry')throw new Error('Frax revenue-routing registry version drift');
  if(Number(x?.network?.chainId)!==FRAXTAL_CHAIN_ID||x?.network?.name!=='fraxtal')throw new Error('Frax revenue-routing network identity drift');
  const yd=x?.yieldDistributor;
  for(const key of ['proxy','implementation','expectedEmittedToken','expectedVeFxsAggregator'])if(!isAddress(yd?.[key]))throw new Error(`Frax revenue-routing address invalid: ${key}`);
  if(Number(yd?.defaultYieldDurationSeconds)!==604800)throw new Error('Frax revenue-routing default duration source drift');
  for(const key of ['constants','yieldDistributor','deployYieldDistributor']){
    const source=x?.officialSources?.[key];
    if(!source?.repository||!source?.path||!isSha(source?.blobSha))throw new Error(`Frax revenue-routing source pin missing: ${key}`);
  }
  const mechanics=x?.documentedMechanics||{};
  if(mechanics.distributesFraxProtocolYieldByVeFxsBalance!==true||mechanics.productionEmittedTokenIsFxsProxy!==true||mechanics.productionVeFxsAggregatorIsCanonicalProxy!==true||mechanics.notifyRewardAmountRequiresAuthorizedNotifier!==true||mechanics.rewardPeriodUsesYieldRateTimesYieldDuration!==true||mechanics.claimTransfersEmittedToken!==true||mechanics.emittedTokenRecoveryForbidden!==true)throw new Error('Frax revenue-routing documented mechanics drift');
  const semantics=x?.semantics||{};
  if(semantics.configIsLiveMeasurement!==false||semantics.distributorFundingSourceIsNotProvenByContractState!==true||semantics.fraxswapFeeToIsNotAutomaticallyDistributorFunding!==true||semantics.fundedDistributorBalanceIsNotRealizedCompanyCashFlow!==true||semantics.protocolYieldLabelIsSourceAttributedNotSourceOfFundsProof!==true||semantics.unknownIsZero!==false||semantics.causalClaimAuthority!=='none'||semantics.recommendationAuthority!=='none'||semantics.executionAuthority!=='none')throw new Error('Frax revenue-routing epistemic boundary drift');
  return x;
}

async function postBatch(url,payload,fetchImpl){
  const response=await fetchImpl(url,{method:'POST',headers:{'content-type':'application/json',accept:'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(RPC_TIMEOUT_MS)});
  if(!response.ok)throw new Error(`RPC HTTP ${response.status}`);
  const body=await response.json();
  if(!Array.isArray(body))throw new Error('RPC response is not an array');
  const byId=new Map(body.map(row=>[Number(row?.id),row]));
  for(const request of payload){
    const row=byId.get(request.id);
    if(!row)throw new Error(`RPC result ${request.id} missing`);
    if(row.error)throw new Error(`RPC ${request.method} error: ${row.error?.message||'unknown'}`);
    if(row.result===undefined||row.result===null)throw new Error(`RPC ${request.method} result missing`);
  }
  return byId;
}

function provenance(config){return {
  registryVersion:config.version,
  officialSources:config.officialSources,
  sourceBoundExpectedAddresses:config.yieldDistributor,
  documentedMechanics:config.documentedMechanics
};}

function unknown({reason='UNKNOWN-frax-revenue-routing-current-state-unavailable',config=null,attempts=[]}={}){return {
  version:FRAX_REVENUE_ROUTING_CURRENT_VERSION,status:reason,measurementClass:'UNKNOWN',observedAt:null,
  network:{name:'fraxtal',chainId:FRAXTAL_CHAIN_ID},
  distributor:null,
  provenance:config?provenance(config):null,
  attempts,
  coverage:{exactBlockProxyIdentity:false,emittedTokenIdentity:false,currentRewardPeriod:false,rewardPeriodArithmetic:false,currentDistributorInventory:false,upstreamFundingSource:false,companyCashFlow:false},
  edges:[
    {from:'official YieldDistributor source',to:'veFXS-weighted Frax protocol yield distribution mechanism',class:'ATTRIBUTED-source-pinned'},
    {from:'specific upstream protocol fee stream',to:'YieldDistributor funding',class:'UNKNOWN-source-of-funds-not-proven'},
    {from:'YieldDistributor claim',to:'specific The Holding company realized cash flow',class:'UNKNOWN-company-route-not-measured'}
  ],
  epistemic:{
    currentDistributionState:'UNKNOWN',
    distributorFundingSource:'UNKNOWN-not-proven-by-contract-state',
    fraxswapFeeToToDistributor:'UNKNOWN-no-mechanical-path-proven',
    protocolRevenueUsd:'UNKNOWN-not-valued-by-this-atom',
    companyCashFlow:'UNKNOWN-not-measured-by-this-atom',
    unknownIsZero:false,
    causalClaimAuthority:'none',recommendationAuthority:'none',executionAuthority:'none'
  }
};}

export async function collectFraxRevenueRoutingCurrentState({config=null,fetchImpl=fetch,endpointsOverride=null}={}){
  let cfg;
  try{cfg=loadConfig(config);}catch(error){return unknown({reason:'UNKNOWN-frax-revenue-routing-registry-invalid',config,attempts:[{scope:'config',error:error.message}]});}
  const endpoints=endpointsOverride||FRAXTAL_RPC_ENDPOINTS;
  if(!Array.isArray(endpoints)||!endpoints.length)return unknown({reason:'UNKNOWN-frax-revenue-routing-rpc-unavailable',config:cfg,attempts:[{scope:'rpc-registry',error:'Fraxtal RPC endpoints unavailable'}]});
  const attempts=[];
  for(const endpoint of endpoints){
    try{
      const first=await postBatch(endpoint.url,[{jsonrpc:'2.0',id:1,method:'eth_blockNumber',params:[]}],fetchImpl);
      const blockNumber=rpcQuantity(first.get(1).result);
      const blockTag=`0x${blockNumber.toString(16)}`;
      const proxy=cfg.yieldDistributor.proxy;
      const expectedImpl=cfg.yieldDistributor.implementation.toLowerCase();
      const expectedToken=cfg.yieldDistributor.expectedEmittedToken.toLowerCase();
      const balanceData=`${SELECTORS.balanceOf}${encodeAddressArg(proxy)}`;
      const requests=[
        {jsonrpc:'2.0',id:2,method:'eth_getBlockByNumber',params:[blockTag,false]},
        {jsonrpc:'2.0',id:3,method:'eth_getCode',params:[proxy,blockTag]},
        {jsonrpc:'2.0',id:4,method:'eth_getStorageAt',params:[proxy,EIP1967_IMPLEMENTATION_SLOT,blockTag]},
        {jsonrpc:'2.0',id:5,method:'eth_getCode',params:[cfg.yieldDistributor.implementation,blockTag]},
        {jsonrpc:'2.0',id:10,method:'eth_call',params:[{to:proxy,data:SELECTORS.emittedToken},blockTag]},
        {jsonrpc:'2.0',id:11,method:'eth_call',params:[{to:proxy,data:SELECTORS.yieldDuration},blockTag]},
        {jsonrpc:'2.0',id:12,method:'eth_call',params:[{to:proxy,data:SELECTORS.yieldRate},blockTag]},
        {jsonrpc:'2.0',id:13,method:'eth_call',params:[{to:proxy,data:SELECTORS.periodFinish},blockTag]},
        {jsonrpc:'2.0',id:14,method:'eth_call',params:[{to:proxy,data:SELECTORS.lastUpdateTime},blockTag]},
        {jsonrpc:'2.0',id:15,method:'eth_call',params:[{to:proxy,data:SELECTORS.getYieldForDuration},blockTag]},
        {jsonrpc:'2.0',id:16,method:'eth_call',params:[{to:proxy,data:SELECTORS.yieldCollectionPaused},blockTag]},
        {jsonrpc:'2.0',id:17,method:'eth_call',params:[{to:proxy,data:SELECTORS.owner},blockTag]},
        {jsonrpc:'2.0',id:18,method:'eth_call',params:[{to:expectedToken,data:balanceData},blockTag]}
      ];
      const rows=await postBatch(endpoint.url,requests,fetchImpl);
      const block=rows.get(2).result;
      if(!block||String(block.number||'').toLowerCase()!==blockTag.toLowerCase()||!/^0x[0-9a-f]{64}$/i.test(String(block.hash||'')))throw new Error('Frax revenue-routing exact block identity unavailable');
      const proxyCode=String(rows.get(3).result||'');
      const implCode=String(rows.get(5).result||'');
      if(!nonemptyCode(proxyCode)||!nonemptyCode(implCode))throw new Error('Frax YieldDistributor deployed code missing');
      const implementation=storageAddress(rows.get(4).result);
      if(implementation!==expectedImpl)throw new Error(`Frax YieldDistributor implementation mismatch ${implementation}`);
      const emittedToken=decodeAddress(rows.get(10).result);
      if(emittedToken!==expectedToken)throw new Error(`Frax YieldDistributor emitted token mismatch ${emittedToken}`);
      const yieldDuration=decodeUint(rows.get(11).result);
      const yieldRate=decodeUint(rows.get(12).result);
      const periodFinish=decodeUint(rows.get(13).result);
      const lastUpdateTime=decodeUint(rows.get(14).result);
      const getYieldForDuration=decodeUint(rows.get(15).result);
      const yieldCollectionPaused=decodeBool(rows.get(16).result);
      const owner=decodeAddress(rows.get(17).result);
      const emittedTokenBalance=decodeUint(rows.get(18).result);
      const expectedDurationReward=yieldRate*yieldDuration;
      if(getYieldForDuration!==expectedDurationReward)throw new Error('Frax YieldDistributor duration-reward arithmetic mismatch');
      const blockTimestamp=rpcQuantity(block.timestamp);
      return {
        version:FRAX_REVENUE_ROUTING_CURRENT_VERSION,status:'ok',measurementClass:'MEASURED',
        observedAt:new Date(Number(blockTimestamp)*1000).toISOString(),
        network:{name:'fraxtal',chainId:FRAXTAL_CHAIN_ID,blockNumber:Number(blockNumber),blockHash:String(block.hash).toLowerCase(),blockTimestamp:Number(blockTimestamp)},
        distributor:{
          proxy:proxy.toLowerCase(),implementation,proxyCodePresent:true,implementationCodePresent:true,
          emittedToken,yieldDurationRaw:yieldDuration.toString(10),yieldRateRaw:yieldRate.toString(10),
          periodFinish:Number(periodFinish),lastUpdateTime:Number(lastUpdateTime),
          getYieldForDurationRaw:getYieldForDuration.toString(10),
          expectedDurationRewardRaw:expectedDurationReward.toString(10),
          rewardArithmeticParity:true,yieldCollectionPaused,owner,
          emittedTokenBalanceRaw:emittedTokenBalance.toString(10),
          rewardPeriodActive:blockTimestamp<periodFinish
        },
        provenance:provenance(cfg),attempts,
        coverage:{exactBlockProxyIdentity:true,emittedTokenIdentity:true,currentRewardPeriod:true,rewardPeriodArithmetic:true,currentDistributorInventory:true,upstreamFundingSource:false,companyCashFlow:false},
        edges:[
          {from:'official Constants + exact EIP-1967 proxy state',to:'current Fraxtal YieldDistributor implementation',class:'MEASURED+ATTRIBUTED-exact-block-source-pinned'},
          {from:'production deployment source + exact emittedToken()',to:'current emitted token identity',class:'MEASURED+ATTRIBUTED-exact-block-source-pinned'},
          {from:'yieldRate × yieldDuration',to:'getYieldForDuration()',class:'MECHANICAL-exact-block-parity'},
          {from:'emitted-token balanceOf(YieldDistributor)',to:'current distributor token inventory',class:'MEASURED-exact-block-token-units'},
          {from:'current distributor inventory',to:'protocol revenue USD',class:'UNKNOWN-not-priced-or-source-attributed'},
          {from:'Fraxswap feeTo LP / other protocol fee stream',to:'YieldDistributor funding',class:'UNKNOWN-no-source-of-funds-path-proven'},
          {from:'YieldDistributor claims',to:'specific The Holding company realized cash flow',class:'UNKNOWN-company-route-not-measured'}
        ],
        epistemic:{
          currentDistributionState:'MEASURED-exact-block-partial',
          protocolYieldDistributionMechanism:'ATTRIBUTED-source-pinned',
          emittedTokenIdentity:'MEASURED+ATTRIBUTED-exact-block-source-pinned',
          rewardPeriodArithmetic:'MECHANICAL-exact-block-parity',
          distributorInventory:'MEASURED-exact-block-token-units',
          distributorFundingSource:'UNKNOWN-not-proven-by-contract-state',
          fraxswapFeeToToDistributor:'UNKNOWN-no-mechanical-path-proven',
          protocolRevenueUsd:'UNKNOWN-not-valued-by-this-atom',
          veFxsAggregatorIdentity:'ATTRIBUTED-source-pinned-deployment-config-not-read-by-this-atom',
          companyCashFlow:'UNKNOWN-not-measured-by-this-atom',
          fundedBalanceIsRealizedCashFlow:false,
          unknownIsZero:false,
          causalClaimAuthority:'none',recommendationAuthority:'none',executionAuthority:'none'
        },
        rpc:{endpointId:endpoint.id,failoverAttempts:attempts}
      };
    }catch(error){attempts.push({endpointId:endpoint.id,error:error instanceof Error?error.message:String(error)});}
  }
  return unknown({reason:'UNKNOWN-frax-revenue-routing-current-state-read-failed',config:cfg,attempts});
}

export function applyFraxRevenueRoutingCurrentState({state,previousState,measurement}){
  if(!state||typeof state!=='object')throw new Error('Frax revenue-routing adapter requires Economic Graph state');
  if(state?.authority?.executionAuthority!=='none'||state?.authority?.causalClaimAuthority!=='none')throw new Error('Frax revenue-routing adapter refuses Graph authority drift');
  const evidence=state?.protocolEvidence?.[FRAX_ECOSYSTEM_EVIDENCE_ID];
  const base=evidence?.latest?.observation;
  const fraxSensor=state?.protocolSensors?.[FRAX_PROTOCOL_ID];
  if(!evidence||!base||!fraxSensor)throw new Error('Frax ecosystem evidence missing before revenue-routing enrichment');
  const current=structuredClone(base);
  const surface=current?.surfaces?.revenueRouting;
  if(!surface)throw new Error('Frax revenue-routing surface missing');

  const valid=measurement?.status==='ok'&&measurement?.measurementClass==='MEASURED'&&measurement?.coverage?.exactBlockProxyIdentity===true&&measurement?.coverage?.emittedTokenIdentity===true&&measurement?.coverage?.currentRewardPeriod===true&&measurement?.coverage?.rewardPeriodArithmetic===true&&measurement?.coverage?.currentDistributorInventory===true&&measurement?.coverage?.upstreamFundingSource===false&&measurement?.coverage?.companyCashFlow===false&&measurement?.distributor?.rewardArithmeticParity===true&&measurement?.epistemic?.fundedBalanceIsRealizedCashFlow===false&&measurement?.epistemic?.unknownIsZero===false&&measurement?.epistemic?.executionAuthority==='none';
  surface.measured={...(surface.measured||{}),yieldDistributionCurrent:measurement};
  surface.measurementState=valid?'MEASURED-current-yield-distribution-partial':'UNKNOWN-current-value-not-ingested';
  surface.mechanicalRelations=[
    ...(surface.mechanicalRelations||[]).filter(row=>!String(row?.to||'').includes('current Fraxtal YieldDistributor')&&!String(row?.to||'').includes('current emitted token')&&!String(row?.to||'').includes('getYieldForDuration')),
    {from:'official Constants + exact EIP-1967 proxy state',to:'current Fraxtal YieldDistributor',class:valid?'MEASURED+ATTRIBUTED-exact-block-source-pinned':'UNKNOWN'},
    {from:'production deployment source + exact emittedToken()',to:'current emitted token',class:valid?'MEASURED+ATTRIBUTED-exact-block-source-pinned':'UNKNOWN'},
    {from:'yieldRate × yieldDuration',to:'getYieldForDuration()',class:valid?'MECHANICAL-exact-block-parity':'UNKNOWN'},
    {from:'current YieldDistributor emitted-token inventory',to:'specific upstream protocol-fee source',class:'UNKNOWN-source-of-funds-not-proven'},
    {from:'Fraxswap feeTo LP lifecycle',to:'YieldDistributor funding',class:'UNKNOWN-no-mechanical-path-proven'},
    {from:'YieldDistributor distribution',to:'specific The Holding company realized cash flow',class:'UNKNOWN-company-route-not-measured'}
  ];
  current.measurementExtensions={...(current.measurementExtensions||{}),revenueRoutingCurrent:FRAX_REVENUE_ROUTING_CURRENT_VERSION};
  current.epistemic={
    ...(current.epistemic||{}),
    revenueRoutingCurrentDistribution:valid?'MEASURED-current-exact-block-partial':'UNKNOWN',
    revenueRoutingUpstreamFundingSource:'UNKNOWN-not-proven-by-contract-state',
    fraxswapFeeToToYieldDistributor:'UNKNOWN-no-mechanical-path-proven',
    protocolRevenueUsd:'UNKNOWN-not-valued-by-this-atom',
    veFraxCompanyCashFlow:'UNKNOWN-not-measured-by-this-atom',
    revenueToVeFraxAprCausality:'UNKNOWN'
  };
  const surfaces=Object.values(current.surfaces||{});
  const measured=surfaces.filter(s=>String(s.measurementState||'').startsWith('MEASURED'));
  current.coverage.measuredSurfaceCount=measured.length;
  current.coverage.sourceBoundUnknownSurfaceCount=surfaces.length-measured.length;
  current.relationshipGraph=surfaces.flatMap(s=>(s.mechanicalRelations||[]).map((r,index)=>({surfaceId:s.id,index,...r})));
  current.coverage.relationshipCount=current.relationshipGraph.length;
  current.coverage.relationshipClassCounts=current.relationshipGraph.reduce((acc,row)=>{const key=String(row.class||'UNKNOWN').split('-')[0];acc[key]=(acc[key]||0)+1;return acc;},{});
  current.id=`frax-ecosystem:${sha256(stableStringify({priorId:base.id,revenueRouting:valid?{blockNumber:measurement.network.blockNumber,blockHash:measurement.network.blockHash,proxy:measurement.distributor.proxy,implementation:measurement.distributor.implementation,emittedToken:measurement.distributor.emittedToken,yieldRateRaw:measurement.distributor.yieldRateRaw,yieldDurationRaw:measurement.distributor.yieldDurationRaw,periodFinish:measurement.distributor.periodFinish,inventoryRaw:measurement.distributor.emittedTokenBalanceRaw}:{status:measurement?.status||'UNKNOWN'},surfaceIds:current.coverage.surfaceIds})).slice(0,24)}`;

  const previousRows=Array.isArray(previousState?.protocolEvidence?.[FRAX_ECOSYSTEM_EVIDENCE_ID]?.observations)?previousState.protocolEvidence[FRAX_ECOSYSTEM_EVIDENCE_ID].observations:[];
  const rows=[...previousRows];
  if(!rows.some(row=>row?.id===current.id))rows.push(current);
  evidence.latest={observation:current};
  evidence.status=current.status;
  evidence.observations=rows.slice(-MAX_OBSERVATIONS);
  evidence.observationCount=evidence.observations.length;
  evidence.measurementExtensions={...(evidence.measurementExtensions||{}),revenueRoutingCurrent:FRAX_REVENUE_ROUTING_CURRENT_VERSION};
  fraxSensor.ecosystemFamily={...(fraxSensor.ecosystemFamily||{}),status:current.status,measuredSurfaceCount:current.coverage.measuredSurfaceCount,sourceBoundUnknownSurfaceCount:current.coverage.sourceBoundUnknownSurfaceCount,latestObservationId:current.id,measurementExtensions:{...(fraxSensor.ecosystemFamily?.measurementExtensions||{}),revenueRoutingCurrent:FRAX_REVENUE_ROUTING_CURRENT_VERSION}};
  if(fraxSensor?.latest?.observation)fraxSensor.latest.observation.ecosystemFamily=fraxSensor.ecosystemFamily;

  if(current.coverage.measuredSurfaceCount+current.coverage.sourceBoundUnknownSurfaceCount!==current.coverage.surfaceCount)throw new Error('Frax revenue-routing depth accounting drift');
  if(valid&&current.coverage.measuredSurfaceCount!==9)throw new Error(`Frax revenue-routing valid atom must close top-level coverage at 9/9, got ${current.coverage.measuredSurfaceCount}/9`);
  if(valid&&(measurement.epistemic?.distributorFundingSource!=='UNKNOWN-not-proven-by-contract-state'||measurement.epistemic?.fraxswapFeeToToDistributor!=='UNKNOWN-no-mechanical-path-proven'||measurement.epistemic?.companyCashFlow!=='UNKNOWN-not-measured-by-this-atom'))throw new Error('Frax revenue-routing unresolved semantic boundary drift');
  if(current?.authority?.executionAuthority!=='none'||current?.epistemic?.executionAuthority!=='none'||measurement?.epistemic?.executionAuthority!=='none')throw new Error('Frax revenue-routing execution authority leaked');
  return state;
}
