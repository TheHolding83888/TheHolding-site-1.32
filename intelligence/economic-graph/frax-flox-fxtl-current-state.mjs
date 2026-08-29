#!/usr/bin/env node
/**
 * The Holding · Fraxtal Flox / FXTL current-state sensor v0.1
 *
 * Bounded read-only atom for the existing Frax ecosystem family. It measures
 * the canonical FxtlPoints ledger at one exact Fraxtal block and keeps the
 * wider Flox algorithm / Farms mechanics source-attributed rather than
 * pretending documented mechanics are current per-address economics.
 *
 * Specifically NOT measured here: current Flox rank, farm effective balances,
 * multipliers, estimated earning rates, current epoch boundaries, company FXTL
 * balances, future token conversion/value, or USD value.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FRAXTAL_CHAIN_ID, FRAXTAL_RPC_ENDPOINTS } from './frax-bamm-onchain.mjs';
import { FRAX_ECOSYSTEM_EVIDENCE_ID, FRAX_PROTOCOL_ID } from './frax-ecosystem-sensor.mjs';

export const FRAX_FLOX_FXTL_CURRENT_VERSION='0.1-flox-fxtl-current-ledger-exact-block';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const REGISTRY_FILE=path.join(ROOT,'intelligence/economic-graph/frax-flox-fxtl-registry.json');
const RPC_TIMEOUT_MS=12_000;
const MAX_OBSERVATIONS=1000;

const SELECTORS={
  name:'0x06fdde03',
  symbol:'0x95d89b41',
  decimals:'0x313ce567',
  totalSupply:'0x18160ddd'
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
function decodeAbiString(value){
  const raw=String(value||'');
  if(!/^0x[0-9a-f]*$/i.test(raw)||raw.length<130)throw new Error('Invalid ABI string');
  const data=raw.slice(2);
  const offset=Number(BigInt(`0x${data.slice(0,64)}`));
  const lengthWord=offset*2;
  if(!Number.isSafeInteger(offset)||lengthWord+64>data.length)throw new Error('ABI string offset invalid');
  const length=Number(BigInt(`0x${data.slice(lengthWord,lengthWord+64)}`));
  const start=lengthWord+64;
  const end=start+length*2;
  if(!Number.isSafeInteger(length)||end>data.length)throw new Error('ABI string length invalid');
  return Buffer.from(data.slice(start,end),'hex').toString('utf8');
}

function loadConfig(config){
  const x=config||readJson(REGISTRY_FILE);
  if(x?.version!=='0.1-frax-flox-fxtl-current-registry')throw new Error('Flox FXTL registry version drift');
  if(Number(x?.network?.chainId)!==FRAXTAL_CHAIN_ID||x?.network?.name!=='fraxtal')throw new Error('Flox FXTL network identity drift');
  const points=x?.pointsContract;
  if(!isAddress(points?.address)||points?.expectedName!=='FXTL Points'||points?.expectedSymbol!=='FXTL'||Number(points?.expectedDecimals)!==0)throw new Error('Flox FXTL points contract identity invalid');
  const sources=x?.officialSources||{};
  for(const key of ['pointSystem','blockspaceOverview','floxFarms','fxtlPointsContract']){
    const source=sources[key];
    if(!source?.repository||!source?.path||!isSha(source?.blobSha))throw new Error(`Flox FXTL source pin missing: ${key}`);
  }
  const mechanics=x?.documentedMechanics||{};
  if(mechanics.farmUsesEffectiveBalance!==true||mechanics.baseEarningRateDynamic!==true||mechanics.pointsOneToOneWithFrxUsd!==false||mechanics.ledgerTransferable!==false||Number(mechanics.ledgerDecimals)!==0)throw new Error('Flox FXTL documented-mechanics boundary drift');
  const semantics=x?.semantics||{};
  if(semantics.configIsSourceBoundTopology!==true||semantics.configIsLiveMeasurement!==false||semantics.totalSupplyIsPointLedgerStateNotTokenMarketCap!==true||semantics.pointsAreNotUsd!==true||semantics.pointsAreNotTokenValue!==true||semantics.documentedEpochCadenceIsNotCurrentEpochProof!==true||semantics.documentedFarmFormulaIsNotCurrentFarmMeasurement!==true||semantics.missingCompanyBalanceIsNotZero!==true||semantics.offchainFloxRankNotRecomputedByThisAtom!==true||semantics.unknownIsZero!==false||semantics.causalClaimAuthority!=='none'||semantics.recommendationAuthority!=='none'||semantics.executionAuthority!=='none')throw new Error('Flox FXTL epistemic/authority boundary drift');
  return x;
}

async function postBatch(url,payload,fetchImpl){
  const response=await fetchImpl(url,{
    method:'POST',headers:{'content-type':'application/json',accept:'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(RPC_TIMEOUT_MS)
  });
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
  registryVersion:config?.version||null,
  pointsContract:config?.pointsContract||null,
  officialSources:config?.officialSources||null,
  documentedMechanics:config?.documentedMechanics||null
};}

function unknown({reason='UNKNOWN-flox-fxtl-current-state-unavailable',config=null,attempts=[]}={}){return {
  version:FRAX_FLOX_FXTL_CURRENT_VERSION,status:reason,measurementClass:'UNKNOWN',observedAt:null,
  network:{name:'fraxtal',chainId:FRAXTAL_CHAIN_ID},
  ledger:null,
  provenance:config?provenance(config):null,
  attempts,
  coverage:{exactBlockLedgerIdentity:false,currentTotalPointSupply:false,currentEpoch:false,currentFarmEconomics:false,companyPointExposure:false},
  edges:[
    {from:'official FxtlPoints source + docs',to:'non-transferable FXTL points ledger semantics',class:'ATTRIBUTED-source-pinned-not-bytecode-equivalence-proof'},
    {from:'documented Flox/Farms mechanics',to:'current per-address earned points',class:'UNKNOWN-not-recomputed'},
    {from:'FXTL points',to:'USD or future token value',class:'UNKNOWN'}
  ],
  epistemic:{
    ledgerIdentity:'UNKNOWN',
    totalPointSupply:'UNKNOWN',
    currentEpoch:'UNKNOWN-not-measured-by-this-atom',
    currentFloxRank:'UNKNOWN-offchain-algorithm-not-recomputed',
    currentFarmEffectiveBalances:'UNKNOWN-not-measured-by-this-atom',
    currentFarmMultipliers:'UNKNOWN-not-measured-by-this-atom',
    companyPointExposure:'UNKNOWN-not-measured-by-this-atom',
    pointUsdValue:'UNKNOWN-not-defined-by-ledger',
    futureTokenConversionValue:'UNKNOWN',
    sourceCodeBytecodeEquivalence:'UNKNOWN-not-proven-by-this-atom',
    unknownIsZero:false,
    causalClaimAuthority:'none',recommendationAuthority:'none',executionAuthority:'none'
  }
};}

export async function collectFloxFxtlCurrentState({config=null,fetchImpl=fetch,endpointsOverride=null}={}){
  let cfg;
  try{cfg=loadConfig(config);}catch(error){return unknown({reason:'UNKNOWN-flox-fxtl-registry-invalid',config,attempts:[{scope:'config',error:error.message}]});}
  const endpoints=endpointsOverride||FRAXTAL_RPC_ENDPOINTS;
  if(!Array.isArray(endpoints)||!endpoints.length)return unknown({reason:'UNKNOWN-flox-fxtl-rpc-unavailable',config:cfg,attempts:[{scope:'rpc-registry',error:'Fraxtal RPC endpoints unavailable'}]});
  const attempts=[];
  for(const endpoint of endpoints){
    try{
      const first=await postBatch(endpoint.url,[{jsonrpc:'2.0',id:1,method:'eth_blockNumber',params:[]}],fetchImpl);
      const blockNumber=rpcQuantity(first.get(1).result);
      const blockTag=`0x${blockNumber.toString(16)}`;
      const address=cfg.pointsContract.address;
      const requests=[
        {jsonrpc:'2.0',id:2,method:'eth_getBlockByNumber',params:[blockTag,false]},
        {jsonrpc:'2.0',id:3,method:'eth_getCode',params:[address,blockTag]},
        {jsonrpc:'2.0',id:10,method:'eth_call',params:[{to:address,data:SELECTORS.name},blockTag]},
        {jsonrpc:'2.0',id:11,method:'eth_call',params:[{to:address,data:SELECTORS.symbol},blockTag]},
        {jsonrpc:'2.0',id:12,method:'eth_call',params:[{to:address,data:SELECTORS.decimals},blockTag]},
        {jsonrpc:'2.0',id:13,method:'eth_call',params:[{to:address,data:SELECTORS.totalSupply},blockTag]}
      ];
      const rows=await postBatch(endpoint.url,requests,fetchImpl);
      const block=rows.get(2).result;
      if(!block||String(block.number||'').toLowerCase()!==blockTag.toLowerCase()||!/^0x[0-9a-f]{64}$/i.test(String(block.hash||'')))throw new Error('Flox FXTL exact block identity unavailable');
      const code=String(rows.get(3).result||'');
      if(!nonemptyCode(code))throw new Error('Flox FXTL deployed code missing');
      const name=decodeAbiString(rows.get(10).result);
      const symbol=decodeAbiString(rows.get(11).result);
      const decimals=Number(decodeUint(rows.get(12).result));
      const totalSupplyPoints=decodeUint(rows.get(13).result).toString(10);
      if(name!==cfg.pointsContract.expectedName||symbol!==cfg.pointsContract.expectedSymbol||decimals!==Number(cfg.pointsContract.expectedDecimals))throw new Error(`Flox FXTL interface identity mismatch ${name}/${symbol}/${decimals}`);
      const blockTimestamp=Number(rpcQuantity(block.timestamp));
      return {
        version:FRAX_FLOX_FXTL_CURRENT_VERSION,status:'ok',measurementClass:'MEASURED',
        observedAt:new Date(blockTimestamp*1000).toISOString(),
        network:{name:'fraxtal',chainId:FRAXTAL_CHAIN_ID,blockNumber:Number(blockNumber),blockHash:String(block.hash).toLowerCase(),blockTimestamp},
        ledger:{
          address,
          codePresent:true,
          codeSizeBytes:(code.length-2)/2,
          name,symbol,decimals,totalSupplyPoints,
          transferability:'ATTRIBUTED-source-pinned-non-transferable'
        },
        provenance:provenance(cfg),
        attempts,
        coverage:{exactBlockLedgerIdentity:true,currentTotalPointSupply:true,currentEpoch:false,currentFarmEconomics:false,companyPointExposure:false},
        edges:[
          {from:'official docs + source-pinned FxtlPoints identity',to:'FXTL point ledger contract',class:'ATTRIBUTED-source-pinned'},
          {from:'exact-block FxtlPoints eth_call',to:'current total FXTL point supply',class:'MEASURED-exact-block'},
          {from:'FxtlPoints source',to:'non-transferable ledger semantics',class:'ATTRIBUTED-source-pinned-not-bytecode-equivalence-proof'},
          {from:'documented Flox activity/rank mechanics',to:'FXTL allocation',class:'MECHANICAL-source-documented-not-currently-reproduced'},
          {from:'documented farm effective balance + multiplier + dynamic base rate',to:'FXTL farm earning',class:'MECHANICAL-source-documented-not-currently-reproduced'},
          {from:'current total point supply',to:'USD market cap / future token value',class:'UNKNOWN'},
          {from:'documented initial epoch cadence',to:'current epoch boundary',class:'UNKNOWN-not-proven-by-this-atom'}
        ],
        epistemic:{
          ledgerIdentity:'MEASURED-exact-block-interface+ATTRIBUTED-source-pinned-address',
          totalPointSupply:'MEASURED-exact-block-ledger-state',
          transferability:'ATTRIBUTED-source-pinned-non-transferable',
          currentEpoch:'UNKNOWN-not-measured-by-this-atom',
          currentFloxRank:'UNKNOWN-offchain-algorithm-not-recomputed',
          currentFarmEffectiveBalances:'UNKNOWN-not-measured-by-this-atom',
          currentFarmMultipliers:'UNKNOWN-not-measured-by-this-atom',
          companyPointExposure:'UNKNOWN-not-measured-by-this-atom',
          pointUsdValue:'UNKNOWN-not-defined-by-ledger',
          futureTokenConversionValue:'UNKNOWN',
          sourceCodeBytecodeEquivalence:'UNKNOWN-not-proven-by-this-atom',
          totalSupplyIsMarketCap:false,
          pointsAreUsd:false,
          pointsAreTransferable:false,
          unknownIsZero:false,
          causalClaimAuthority:'none',recommendationAuthority:'none',executionAuthority:'none'
        },
        rpc:{endpointId:endpoint.id,failoverAttempts:attempts}
      };
    }catch(error){attempts.push({endpointId:endpoint.id,error:error instanceof Error?error.message:String(error)});}
  }
  return unknown({reason:'UNKNOWN-flox-fxtl-current-state-read-failed',config:cfg,attempts});
}

export function applyFloxFxtlCurrentState({state,previousState,measurement}){
  if(!state||typeof state!=='object')throw new Error('Flox FXTL adapter requires Economic Graph state');
  if(state?.authority?.executionAuthority!=='none'||state?.authority?.causalClaimAuthority!=='none')throw new Error('Flox FXTL adapter refuses Graph authority drift');
  const evidence=state?.protocolEvidence?.[FRAX_ECOSYSTEM_EVIDENCE_ID];
  const base=evidence?.latest?.observation;
  const fraxSensor=state?.protocolSensors?.[FRAX_PROTOCOL_ID];
  if(!evidence||!base||!fraxSensor)throw new Error('Frax ecosystem evidence missing before Flox FXTL enrichment');
  const current=structuredClone(base);
  const surface=current?.surfaces?.fraxtalFloxFxtl;
  if(!surface)throw new Error('Flox FXTL surface missing');

  const valid=measurement?.status==='ok'&&measurement?.measurementClass==='MEASURED'&&measurement?.coverage?.exactBlockLedgerIdentity===true&&measurement?.coverage?.currentTotalPointSupply===true&&measurement?.epistemic?.pointsAreUsd===false&&measurement?.epistemic?.pointsAreTransferable===false&&measurement?.epistemic?.executionAuthority==='none';
  surface.measured=measurement;
  surface.measurementState=valid?'MEASURED-current-onchain-points-ledger-partial':'UNKNOWN-current-value-not-ingested';
  surface.mechanicalRelations=[
    {from:'official docs + source-pinned FxtlPoints address',to:'FXTL ledger identity',class:valid?'MEASURED+ATTRIBUTED-exact-block-source-pinned':'UNKNOWN'},
    {from:'exact-block FxtlPoints totalSupply()',to:'current total FXTL points ledger supply',class:valid?'MEASURED-exact-block':'UNKNOWN'},
    {from:'FxtlPoints source',to:'non-transferable points semantics',class:'ATTRIBUTED-source-pinned-not-bytecode-equivalence-proof'},
    {from:'eligible activity / rank',to:'FXTL blockspace allocation',class:'MECHANICAL-source-documented-not-currently-reproduced'},
    {from:'farm effective balance + multiplier + dynamic base rate',to:'FXTL farm earning',class:'MECHANICAL-source-documented-not-currently-reproduced'},
    {from:'current ledger supply',to:'current company FXTL exposure',class:'UNKNOWN-not-measured-by-this-atom'},
    {from:'FXTL points',to:'USD or future token value',class:'UNKNOWN'}
  ];
  current.measurementExtensions={...(current.measurementExtensions||{}),floxFxtlCurrent:FRAX_FLOX_FXTL_CURRENT_VERSION};
  current.epistemic={
    ...(current.epistemic||{}),
    floxFxtlLedger:valid?'MEASURED-current-exact-block-partial':'UNKNOWN',
    floxFxtlCurrentEpoch:'UNKNOWN-not-measured-by-this-atom',
    floxFxtlCurrentRank:'UNKNOWN-offchain-algorithm-not-recomputed',
    floxFxtlCurrentFarmEconomics:'UNKNOWN-not-measured-by-this-atom',
    floxFxtlCompanyExposure:'UNKNOWN-not-measured-by-this-atom',
    floxFxtlPointUsdValue:'UNKNOWN-not-defined-by-ledger',
    floxFxtlFutureTokenValue:'UNKNOWN'
  };
  const surfaces=Object.values(current.surfaces||{});
  const measured=surfaces.filter(s=>String(s.measurementState||'').startsWith('MEASURED'));
  current.coverage.measuredSurfaceCount=measured.length;
  current.coverage.sourceBoundUnknownSurfaceCount=surfaces.length-measured.length;
  current.relationshipGraph=surfaces.flatMap(s=>(s.mechanicalRelations||[]).map((r,index)=>({surfaceId:s.id,index,...r})));
  current.coverage.relationshipCount=current.relationshipGraph.length;
  current.coverage.relationshipClassCounts=current.relationshipGraph.reduce((acc,row)=>{const key=String(row.class||'UNKNOWN').split('-')[0];acc[key]=(acc[key]||0)+1;return acc;},{});
  current.id=`frax-ecosystem:${sha256(stableStringify({priorId:base.id,floxFxtl:valid?{blockNumber:measurement.network.blockNumber,blockHash:measurement.network.blockHash,address:measurement.ledger.address,totalSupplyPoints:measurement.ledger.totalSupplyPoints}:{status:measurement?.status||'UNKNOWN'},surfaceIds:current.coverage.surfaceIds})).slice(0,24)}`;

  const previousRows=Array.isArray(previousState?.protocolEvidence?.[FRAX_ECOSYSTEM_EVIDENCE_ID]?.observations)?previousState.protocolEvidence[FRAX_ECOSYSTEM_EVIDENCE_ID].observations:[];
  const rows=[...previousRows];
  if(!rows.some(row=>row?.id===current.id))rows.push(current);
  evidence.latest={observation:current};
  evidence.status=current.status;
  evidence.observations=rows.slice(-MAX_OBSERVATIONS);
  evidence.observationCount=evidence.observations.length;
  evidence.measurementExtensions={...(evidence.measurementExtensions||{}),floxFxtlCurrent:FRAX_FLOX_FXTL_CURRENT_VERSION};
  fraxSensor.ecosystemFamily={...(fraxSensor.ecosystemFamily||{}),status:current.status,measuredSurfaceCount:current.coverage.measuredSurfaceCount,sourceBoundUnknownSurfaceCount:current.coverage.sourceBoundUnknownSurfaceCount,latestObservationId:current.id,measurementExtensions:{...(fraxSensor.ecosystemFamily?.measurementExtensions||{}),floxFxtlCurrent:FRAX_FLOX_FXTL_CURRENT_VERSION}};
  if(fraxSensor?.latest?.observation)fraxSensor.latest.observation.ecosystemFamily=fraxSensor.ecosystemFamily;

  if(current.coverage.measuredSurfaceCount+current.coverage.sourceBoundUnknownSurfaceCount!==current.coverage.surfaceCount)throw new Error('Flox FXTL depth accounting drift');
  if(valid&&(!/^\d+$/.test(String(measurement.ledger?.totalSupplyPoints||''))||measurement.ledger?.name!=='FXTL Points'||measurement.ledger?.symbol!=='FXTL'||Number(measurement.ledger?.decimals)!==0))throw new Error('Flox FXTL ledger invariant drift');
  if(valid&&(measurement.epistemic?.totalSupplyIsMarketCap!==false||measurement.epistemic?.pointsAreUsd!==false||measurement.epistemic?.pointsAreTransferable!==false))throw new Error('Flox FXTL economic semantics drift');
  if(current?.authority?.executionAuthority!=='none'||current?.epistemic?.executionAuthority!=='none'||measurement?.epistemic?.executionAuthority!=='none')throw new Error('Flox FXTL execution authority leaked');
  return state;
}
