#!/usr/bin/env node
/**
 * The Holding · Frax frxETH V2 EtherRouter exact-block state v0.1
 *
 * Measures the current EtherRouter consolidated ETH/frxETH balance through the
 * official view-only force-live path at one exact Ethereum block. The atom also
 * measures current routing pointers and native router ETH. It does not mutate
 * the router cache, infer AMO-level composition, attribute lending/validator
 * income, or create protocol/company revenue claims.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const FRAX_FRXETH_V2_ETHER_ROUTER_VERSION='0.1-frxeth-v2-ether-router-exact-block';
export const FRAX_ECOSYSTEM_EVIDENCE_ID='registry-frax-ecosystem';
export const FRAX_PROTOCOL_ID='registry-frax-vefrax';
export const FRAX_FRXETH_SURFACE_KEY='frxEthSfrxEth';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const REGISTRY_FILE=path.join(ROOT,'intelligence/economic-graph/frax-frxeth-registry.json');
const RPC_REGISTRY_FILE=path.join(ROOT,'intelligence/market-data/onchain-price-source-registry.json');
const RPC_TIMEOUT_MS=10_000;
const MAX_OBSERVATIONS=1000;
const EXPECTED_SOURCE_COMMIT='83dfe93b4a32b9ca0ab93d6e7c059fcd977320d4';
const SELECTORS={
  consolidatedForceLive:'0x8ee5556e'+`${1n.toString(16).padStart(64,'0')}`,
  lendingPool:'0xa59a9973',
  redemptionQueue:'0x97ec19be',
  depositToAmoAddr:'0xf5da169c',
  frxETH:'0x565d3e6e'
};

function sha256(value){return crypto.createHash('sha256').update(value).digest('hex');}
function stableValue(value){if(Array.isArray(value))return value.map(stableValue);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,stableValue(value[key])]));return value;}
function stableStringify(value){return JSON.stringify(stableValue(value));}
function readJson(file){return JSON.parse(fs.readFileSync(file,'utf8'));}
function normalize(value){return String(value||'').toLowerCase();}
function validAddress(value){return /^0x[0-9a-fA-F]{40}$/.test(String(value||''));}
function decodeWord(hex,index=0){const clean=String(hex||'').replace(/^0x/,'');const start=index*64;if(clean.length<start+64||!/^[0-9a-f]+$/i.test(clean))throw new Error(`Invalid ABI word ${index}`);return BigInt(`0x${clean.slice(start,start+64)}`);}
function decodeQuantity(hex){if(!/^0x[0-9a-f]+$/i.test(String(hex||'')))throw new Error('Invalid RPC quantity');return BigInt(hex);}
function decodeAddress(hex,index=0){const word=decodeWord(hex,index).toString(16).padStart(64,'0');return `0x${word.slice(24)}`;}
function units(raw,decimals=18){const base=10n**BigInt(decimals),whole=raw/base,fraction=(raw%base).toString().padStart(decimals,'0').replace(/0+$/,'');return Number(`${whole}${fraction?'.'+fraction:''}`);}
function round(value,digits=12){const n=Number(value);return Number.isFinite(n)?Number(n.toFixed(digits)):null;}

export function validateFraxFrxEthEtherRouterRegistry(registry){
  if(registry?.version!=='0.1-frxeth-current-state-registry'||registry?.network!=='ethereum'||Number(registry?.chainId)!==1)throw new Error('frxETH EtherRouter registry identity drift');
  if(!validAddress(registry?.operations?.etherRouter)||!validAddress(registry?.operations?.lendingPool)||!validAddress(registry?.operations?.redemptionQueueV2)||!validAddress(registry?.assets?.frxETH?.address))throw new Error('frxETH EtherRouter registry addresses invalid');
  if(registry?.sources?.officialSourceRepo!=='FraxFinance/frxETH-v2-public'||registry?.sources?.officialSourceCommit!==EXPECTED_SOURCE_COMMIT)throw new Error('frxETH EtherRouter official source pin drift');
  if(registry?.epistemic?.unknownIsZero!==false||registry?.epistemic?.executionAuthority!=='none'||registry?.epistemic?.causalClaimAuthority!=='none')throw new Error('frxETH EtherRouter epistemic boundary drift');
  return registry;
}

async function postBatch(url,payload,fetchImpl){
  const response=await fetchImpl(url,{method:'POST',headers:{'content-type':'application/json',accept:'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(RPC_TIMEOUT_MS)});
  if(!response.ok)throw new Error(`RPC HTTP ${response.status}`);
  const body=await response.json();if(!Array.isArray(body))throw new Error('RPC response is not an array');
  const byId=new Map(body.map(row=>[Number(row?.id),row]));
  for(const req of payload){const row=byId.get(req.id);if(!row)throw new Error(`RPC result ${req.id} missing`);if(row.error)throw new Error(`RPC ${req.method} error: ${row.error?.message||'unknown error'}`);if(row.result===undefined||row.result===null)throw new Error(`RPC ${req.method} result missing`);}
  return byId;
}
function call(id,to,data,blockTag){return {jsonrpc:'2.0',id,method:'eth_call',params:[{to,data},blockTag]};}
function unknownMeasurement(source,reason,attempts=[]){
  return {
    version:FRAX_FRXETH_V2_ETHER_ROUTER_VERSION,status:reason,measurementClass:'UNKNOWN',observedAt:null,network:'ethereum',chainId:1,blockNumber:null,blockTag:null,blockHash:null,
    router:{address:source?.operations?.etherRouter||null,nativeEthBalanceRaw:null,nativeEthBalance:null,lendingPool:null,redemptionQueue:null,depositToAmoAddr:null,frxETH:null,registryPointerParity:null},
    consolidated:{forceLiveView:true,cacheMutation:false,isStale:null,amoAddress:null,ethFreeRaw:null,ethFree:null,ethInLpBalancedRaw:null,ethInLpBalanced:null,ethTotalBalancedRaw:null,ethTotalBalanced:null,frxEthFreeRaw:null,frxEthFree:null,frxEthInLpBalancedRaw:null,frxEthInLpBalanced:null,frxEthTotalBalancedRaw:null,frxEthTotalBalanced:null,ethAccountingParity:null},
    rpc:{endpointId:null,failoverAttempts:attempts},
    epistemic:{sourceType:'onchain-public-rpc-exact-block',currentStateMeasured:false,forceLiveView:true,cacheMutation:false,amoComposition:'UNKNOWN-not-enumerated-by-this-atom',lendingIncome:'UNKNOWN-not-measured-by-this-atom',validatorEconomics:'UNKNOWN-not-measured-by-this-atom',protocolRevenue:'UNKNOWN',companyCashFlow:'UNKNOWN',unknownIsZero:false,causalClaimAuthority:'none',executionAuthority:'none'}
  };
}

export async function collectFraxFrxEthV2EtherRouterCurrentState({registry=null,rpcRegistry=null,fetchImpl=fetch,checkpoint=null}={}){
  const source=validateFraxFrxEthEtherRouterRegistry(registry||readJson(REGISTRY_FILE));
  const rpc=rpcRegistry||readJson(RPC_REGISTRY_FILE),network=rpc?.networks?.ethereum,endpoints=Array.isArray(network?.rpcFailover)?network.rpcFailover:[],attempts=[];
  if(Number(network?.chainId)!==1||!endpoints.length)throw new Error('Ethereum RPC registry unavailable');
  const router=source.operations.etherRouter;
  for(const endpoint of endpoints){
    try{
      let blockTag=checkpoint?.blockTag||null;
      if(!blockTag){const head=await postBatch(endpoint.url,[{jsonrpc:'2.0',id:1,method:'eth_blockNumber',params:[]}],fetchImpl);blockTag=head.get(1).result;}
      if(!/^0x[0-9a-f]+$/i.test(String(blockTag)))throw new Error('Invalid exact block tag');
      const rows=await postBatch(endpoint.url,[
        {jsonrpc:'2.0',id:2,method:'eth_getBlockByNumber',params:[blockTag,false]},
        {jsonrpc:'2.0',id:3,method:'eth_getCode',params:[router,blockTag]},
        {jsonrpc:'2.0',id:4,method:'eth_getBalance',params:[router,blockTag]},
        call(10,router,SELECTORS.consolidatedForceLive,blockTag),
        call(11,router,SELECTORS.lendingPool,blockTag),
        call(12,router,SELECTORS.redemptionQueue,blockTag),
        call(13,router,SELECTORS.depositToAmoAddr,blockTag),
        call(14,router,SELECTORS.frxETH,blockTag)
      ],fetchImpl);
      const block=rows.get(2).result,blockNumber=Number(decodeQuantity(block?.number||blockTag)),timestampSeconds=Number(decodeQuantity(block?.timestamp));
      if(!(blockNumber>0)||!(timestampSeconds>0)||!/^0x[0-9a-f]{64}$/i.test(String(block?.hash||'')))throw new Error('Exact block identity unavailable');
      const deployed=String(rows.get(3).result||'');if(!/^0x[0-9a-f]+$/i.test(deployed)||deployed==='0x'||deployed==='0x0')throw new Error('EtherRouter deployed code missing');
      const packed=rows.get(10).result;
      const isStale=decodeWord(packed,0)!==0n,amoAddress=decodeAddress(packed,1);
      const ethFreeRaw=decodeWord(packed,2),ethInLpRaw=decodeWord(packed,3),ethTotalRaw=decodeWord(packed,4),frxEthFreeRaw=decodeWord(packed,5),frxEthInLpRaw=decodeWord(packed,6);
      const ethParity=ethFreeRaw+ethInLpRaw===ethTotalRaw;if(!ethParity)throw new Error('EtherRouter consolidated ETH accounting parity failed');
      const lendingPool=decodeAddress(rows.get(11).result),redemptionQueue=decodeAddress(rows.get(12).result),depositToAmoAddr=decodeAddress(rows.get(13).result),frxETH=decodeAddress(rows.get(14).result);
      const pointerParity={
        lendingPool:normalize(lendingPool)===normalize(source.operations.lendingPool),
        redemptionQueue:normalize(redemptionQueue)===normalize(source.operations.redemptionQueueV2),
        frxETH:normalize(frxETH)===normalize(source.assets.frxETH.address)
      };
      const registryPointerParity=Object.values(pointerParity).every(Boolean);
      const routerNativeRaw=decodeQuantity(rows.get(4).result),frxEthTotalRaw=frxEthFreeRaw+frxEthInLpRaw;
      return {
        version:FRAX_FRXETH_V2_ETHER_ROUTER_VERSION,status:'ok',measurementClass:'MEASURED',observedAt:new Date(timestampSeconds*1000).toISOString(),network:'ethereum',chainId:1,blockNumber,blockTag,blockHash:block.hash,
        sourceRegistryVersion:source.version,
        sourceBinding:{officialSourceRepo:source.sources.officialSourceRepo,officialSourceCommit:source.sources.officialSourceCommit,etherRouterSource:'src/contracts/ether-router/EtherRouter.sol',etherRouterInterface:'src/contracts/ether-router/interfaces/IEtherRouter.sol',viewFunction:'getConsolidatedEthFrxEthBalanceView(bool)',forceLive:true},
        router:{address:router,nativeEthBalanceRaw:routerNativeRaw.toString(),nativeEthBalance:round(units(routerNativeRaw)),lendingPool,redemptionQueue,depositToAmoAddr,frxETH,registryPointerParity,pointerParity},
        consolidated:{forceLiveView:true,cacheMutation:false,isStale,amoAddress,ethFreeRaw:ethFreeRaw.toString(),ethFree:round(units(ethFreeRaw)),ethInLpBalancedRaw:ethInLpRaw.toString(),ethInLpBalanced:round(units(ethInLpRaw)),ethTotalBalancedRaw:ethTotalRaw.toString(),ethTotalBalanced:round(units(ethTotalRaw)),frxEthFreeRaw:frxEthFreeRaw.toString(),frxEthFree:round(units(frxEthFreeRaw)),frxEthInLpBalancedRaw:frxEthInLpRaw.toString(),frxEthInLpBalanced:round(units(frxEthInLpRaw)),frxEthTotalBalancedRaw:frxEthTotalRaw.toString(),frxEthTotalBalanced:round(units(frxEthTotalRaw)),ethAccountingParity:true},
        rpc:{endpointId:endpoint.id,failoverAttempts:attempts,reusedCheckpoint:Boolean(checkpoint?.blockTag)},
        epistemic:{sourceType:'onchain-public-rpc-exact-block',currentStateMeasured:true,forceLiveView:true,cacheMutation:false,aggregateSemantics:'official EtherRouter ETH/LSD/WETH and frxETH/sfrxETH balanced-accounting units; not AMO-level decomposition',registryPointerParity,topologyDriftDetected:!registryPointerParity,amoComposition:'UNKNOWN-not-enumerated-by-this-atom',lendingIncome:'UNKNOWN-not-measured-by-this-atom',validatorEconomics:'UNKNOWN-not-measured-by-this-atom',protocolRevenue:'UNKNOWN',companyCashFlow:'UNKNOWN',unknownIsZero:false,causalClaimAuthority:'none',executionAuthority:'none'}
      };
    }catch(error){attempts.push({endpointId:endpoint?.id||null,error:String(error instanceof Error?error.message:error).slice(0,180)});}
  }
  return unknownMeasurement(source,attempts.length?`UNKNOWN-${attempts.at(-1).error.replace(/\s+/g,'-').slice(0,120)}`:'UNKNOWN-no-rpc-attempts',attempts);
}

function rebuildRelationships(current){
  const surfaces=Object.values(current?.surfaces||{});
  current.relationshipGraph=surfaces.flatMap(item=>(Array.isArray(item?.mechanicalRelations)?item.mechanicalRelations:[]).map((relation,index)=>({surfaceId:item.id,index,...relation})));
  current.coverage.relationshipCount=current.relationshipGraph.length;
  current.coverage.relationshipClassCounts=current.relationshipGraph.reduce((acc,relation)=>{const key=String(relation.class||'UNKNOWN').split('-')[0];acc[key]=(acc[key]||0)+1;return acc;},{});
}

export function applyFraxFrxEthV2EtherRouterCurrentState({state,measurement}){
  if(!state||typeof state!=='object')throw new Error('Frax frxETH V2 EtherRouter adapter requires Economic Graph state');
  if(state?.authority?.executionAuthority!=='none'||state?.authority?.causalClaimAuthority!=='none')throw new Error('Frax frxETH V2 EtherRouter adapter refuses Graph authority drift');
  const evidence=state?.protocolEvidence?.[FRAX_ECOSYSTEM_EVIDENCE_ID],baseCurrent=evidence?.latest?.observation,fraxSensor=state?.protocolSensors?.[FRAX_PROTOCOL_ID],surface=baseCurrent?.surfaces?.[FRAX_FRXETH_SURFACE_KEY];
  if(!evidence||!baseCurrent||!fraxSensor||!surface)throw new Error('Frax frxETH surface missing before EtherRouter atom');
  if(!String(surface.measurementState||'').startsWith('MEASURED')||!surface.measured)throw new Error('Frax frxETH base measurement missing before EtherRouter atom');
  const current=structuredClone(baseCurrent),nextSurface=current.surfaces[FRAX_FRXETH_SURFACE_KEY];
  const valid=measurement?.status==='ok'&&measurement?.measurementClass==='MEASURED'&&Number.isFinite(Number(measurement?.consolidated?.ethTotalBalanced))&&measurement?.consolidated?.ethAccountingParity===true;
  nextSurface.measured.v2Internals={...(nextSurface.measured.v2Internals||{}),etherRouter:measurement};
  nextSurface.measured.epistemic={...(nextSurface.measured.epistemic||{}),etherRouterConsolidatedBalance:valid?'MEASURED-force-live-view-exact-block':'UNKNOWN',etherRouterCacheMutation:false,lendingIncome:'UNKNOWN-not-measured-by-this-atom',validatorEconomics:'UNKNOWN-not-measured-by-this-atom'};
  nextSurface.mechanicalRelations=(nextSurface.mechanicalRelations||[]).filter(relation=>relation?.extension!=='frxEthV2EtherRouter');
  nextSurface.mechanicalRelations.push(
    {from:'EtherRouter ethFree + ethInLpBalanced',to:'EtherRouter ethTotalBalanced',class:valid?'MECHANICAL-proven-current-exact-block':'MECHANICAL-source-documented-current-state-UNKNOWN',extension:'frxEthV2EtherRouter'},
    {from:'EtherRouter lendingPool / redemptionQueue / frxETH pointers',to:'frxETH V2 routing topology',class:valid?'MEASURED-proven-current-exact-block':'MEASURED-current-state-UNKNOWN',extension:'frxEthV2EtherRouter'}
  );
  current.measurementExtensions={...(current.measurementExtensions||{}),frxEthV2EtherRouterCurrentState:FRAX_FRXETH_V2_ETHER_ROUTER_VERSION};
  current.epistemic.frxEthV2EtherRouterConsolidatedBalance=valid?'MEASURED-current-Ethereum-force-live-view':'UNKNOWN';
  current.epistemic.frxEthV2EtherRouterTopology=valid?'MEASURED-current-Ethereum-exact-block':'UNKNOWN';
  current.epistemic.frxEthV2EtherRouterRegistryPointerParity=valid?measurement.router.registryPointerParity:null;
  current.epistemic.frxEthLendingIncome='UNKNOWN-not-measured-by-this-atom';
  current.epistemic.frxEthValidatorEconomics='UNKNOWN-not-measured-by-this-atom';
  current.epistemic.frxEthProtocolRevenueUsd='UNKNOWN';
  current.epistemic.frxEthCompanyCashFlow='UNKNOWN';
  const remaining=(current.nextMeasurementUnlocks||[]).filter(item=>!String(item).startsWith('Measure frxETH V2'));
  current.nextMeasurementUnlocks=[...remaining,valid?'Measure frxETH V2 LendingPool borrowing/utilization/rate/interest, redemption-queue state and validator-pool credit as separate bounded sub-atoms.':'Measure frxETH V2 EtherRouter consolidated balance, LendingPool borrowing/utilization/rate/interest, redemption-queue state and validator-pool credit as separate bounded sub-atoms.'];
  rebuildRelationships(current);
  if(current.coverage.surfaceCount!==baseCurrent.coverage.surfaceCount||current.coverage.measuredSurfaceCount!==baseCurrent.coverage.measuredSurfaceCount||current.coverage.sourceBoundUnknownSurfaceCount!==baseCurrent.coverage.sourceBoundUnknownSurfaceCount)throw new Error('Frax frxETH V2 EtherRouter atom changed top-level surface coverage');
  current.id=`frax-ecosystem:${sha256(stableStringify({baseObservationId:baseCurrent.id,extension:FRAX_FRXETH_V2_ETHER_ROUTER_VERSION,etherRouter:valid?{blockNumber:measurement.blockNumber,blockHash:measurement.blockHash,ethTotalBalancedRaw:measurement.consolidated.ethTotalBalancedRaw,frxEthTotalBalancedRaw:measurement.consolidated.frxEthTotalBalancedRaw,registryPointerParity:measurement.router.registryPointerParity}:{status:measurement?.status||'UNKNOWN'}})).slice(0,24)}`;
  const rows=Array.isArray(evidence.observations)?evidence.observations.filter(row=>row?.id!==baseCurrent.id):[];
  rows.push(current);const bounded=rows.slice(-MAX_OBSERVATIONS);
  evidence.latest={observation:current};evidence.status=current.status;evidence.observations=bounded;evidence.observationCount=bounded.length;evidence.measurementExtensions={...(evidence.measurementExtensions||{}),frxEthV2EtherRouterCurrentState:FRAX_FRXETH_V2_ETHER_ROUTER_VERSION};
  fraxSensor.ecosystemFamily={...(fraxSensor.ecosystemFamily||{}),status:current.status,surfaceCount:current.coverage.surfaceCount,measuredSurfaceCount:current.coverage.measuredSurfaceCount,sourceBoundUnknownSurfaceCount:current.coverage.sourceBoundUnknownSurfaceCount,latestObservationId:current.id,scopeExtensions:current.scopeExtensions,measurementExtensions:{...(fraxSensor.ecosystemFamily?.measurementExtensions||{}),frxEthV2EtherRouterCurrentState:FRAX_FRXETH_V2_ETHER_ROUTER_VERSION}};
  if(fraxSensor?.latest?.observation)fraxSensor.latest.observation.ecosystemFamily=fraxSensor.ecosystemFamily;
  if(current?.authority?.executionAuthority!=='none'||current?.epistemic?.executionAuthority!=='none'||nextSurface?.measured?.v2Internals?.etherRouter?.epistemic?.executionAuthority!=='none')throw new Error('Frax frxETH V2 EtherRouter execution authority leaked');
  return state;
}
