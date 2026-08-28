#!/usr/bin/env node
/**
 * The Holding · Frax frxUSD/sfrxUSD onchain measurement v0.1
 *
 * Read-only exact-block ERC20/ERC4626 observation for the existing Frax
 * ecosystem evidence family. This module does not create a workflow, protocol,
 * price authority, causal claim, recommendation, allocation or execution path.
 *
 * Measurement semantics:
 * - current share price is reproduced mechanically from totalAssets/totalSupply;
 * - interval embedded yield is derived only from two persisted adjacent Graph
 *   observations with the same chain/contract identity;
 * - first checkpoint is WARMING; no historical/APY backfill is invented;
 * - RPC failure remains UNKNOWN and never becomes zero.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const FRAX_SFRXUSD_ONCHAIN_VERSION='0.1-sfrxusd-exact-block-erc4626';
export const FRAX_ECOSYSTEM_EVIDENCE_ID='registry-frax-ecosystem';
export const FRAX_PROTOCOL_ID='registry-frax-vefrax';
export const FRXUSD_ETHEREUM='0xCAcd6fd266aF91b8AeD52aCCc382b4e165586E29';
export const SFRXUSD_ETHEREUM='0xcf62F905562626CfcDD2261162a51fd02Fc9c5b6';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const RPC_REGISTRY_FILE=path.join(ROOT,'intelligence/market-data/onchain-price-source-registry.json');
const RPC_TIMEOUT_MS=10_000;
const MAX_OBSERVATIONS=1000;
const SELECTOR_TOTAL_SUPPLY='0x18160ddd';
const SELECTOR_TOTAL_ASSETS='0x01e1d114';
const SELECTOR_DECIMALS='0x313ce567';

function sha256(value){return crypto.createHash('sha256').update(value).digest('hex');}
function stableValue(value){
  if(Array.isArray(value))return value.map(stableValue);
  if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(k=>[k,stableValue(value[k])]));
  return value;
}
function stableStringify(value){return JSON.stringify(stableValue(value));}
function finite(value){return value!==null&&value!==undefined&&value!==''&&Number.isFinite(Number(value));}
function round(value,digits=12){const n=Number(value);return Number.isFinite(n)?Number(n.toFixed(digits)):null;}
function decodeUint256(hex){
  const clean=String(hex||'').replace(/^0x/,'');
  if(clean.length<64||!/^[0-9a-f]+$/i.test(clean))throw new Error('Invalid uint256 ABI result');
  return BigInt(`0x${clean.slice(0,64)}`);
}
function decodeRpcQuantity(hex){
  if(!/^0x[0-9a-f]+$/i.test(String(hex||'')))throw new Error('Invalid RPC quantity');
  return BigInt(hex);
}
function unitsToString(raw,decimals){
  const d=Number(decimals);
  if(!Number.isInteger(d)||d<0||d>36)throw new Error(`Invalid decimals ${decimals}`);
  const negative=raw<0n;
  const value=negative?-raw:raw;
  const base=10n**BigInt(d);
  const whole=value/base;
  const fraction=(value%base).toString().padStart(d,'0').replace(/0+$/,'');
  return `${negative?'-':''}${whole.toString()}${fraction?'.'+fraction:''}`;
}
function readRegistry(){return JSON.parse(fs.readFileSync(RPC_REGISTRY_FILE,'utf8'));}

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
  const byId=new Map(body.map(row=>[Number(row?.id),row]));
  for(const req of payload){
    const row=byId.get(req.id);
    if(!row)throw new Error(`RPC result ${req.id} missing`);
    if(row.error)throw new Error(`RPC ${req.method} error: ${row.error?.message||'unknown error'}`);
    if(row.result===undefined||row.result===null)throw new Error(`RPC ${req.method} result missing`);
  }
  return byId;
}

function unknownMeasurement(attempts,reason='UNKNOWN-rpc-read-failed'){
  return {
    version:FRAX_SFRXUSD_ONCHAIN_VERSION,
    status:reason,
    measurementClass:'UNKNOWN',
    observedAt:null,
    chain:'ethereum',
    chainId:1,
    contracts:{frxUSD:FRXUSD_ETHEREUM,sfrxUSD:SFRXUSD_ETHEREUM},
    values:{
      frxUsdSupply:null,
      sfrxUsdSupply:null,
      sfrxUsdTotalAssets:null,
      sharePriceFrxUsd:null
    },
    rpc:{endpointId:null,failoverAttempts:attempts},
    epistemic:{
      sourceType:'onchain-public-rpc-exact-block',
      currentStateMeasured:false,
      historicalBackfill:false,
      unknownIsZero:false,
      productionPriceAuthority:false,
      causalClaimAuthority:'none',
      executionAuthority:'none'
    }
  };
}

export async function collectFraxSfrxUsdOnchain({registry=null,fetchImpl=fetch}={}){
  const sourceRegistry=registry||readRegistry();
  const network=sourceRegistry?.networks?.ethereum;
  const endpoints=Array.isArray(network?.rpcFailover)?network.rpcFailover:[];
  const attempts=[];
  if(Number(network?.chainId)!==1||!endpoints.length)return unknownMeasurement(attempts,'UNKNOWN-ethereum-rpc-registry-unavailable');

  for(const endpoint of endpoints){
    try{
      const phase1=await postBatch(endpoint.url,[{jsonrpc:'2.0',id:1,method:'eth_blockNumber',params:[]}],fetchImpl);
      const blockTag=phase1.get(1).result;
      const blockNumber=decodeRpcQuantity(blockTag);
      const calls=[
        {jsonrpc:'2.0',id:2,method:'eth_getBlockByNumber',params:[blockTag,false]},
        {jsonrpc:'2.0',id:10,method:'eth_call',params:[{to:FRXUSD_ETHEREUM,data:SELECTOR_TOTAL_SUPPLY},blockTag]},
        {jsonrpc:'2.0',id:11,method:'eth_call',params:[{to:FRXUSD_ETHEREUM,data:SELECTOR_DECIMALS},blockTag]},
        {jsonrpc:'2.0',id:20,method:'eth_call',params:[{to:SFRXUSD_ETHEREUM,data:SELECTOR_TOTAL_SUPPLY},blockTag]},
        {jsonrpc:'2.0',id:21,method:'eth_call',params:[{to:SFRXUSD_ETHEREUM,data:SELECTOR_TOTAL_ASSETS},blockTag]},
        {jsonrpc:'2.0',id:22,method:'eth_call',params:[{to:SFRXUSD_ETHEREUM,data:SELECTOR_DECIMALS},blockTag]}
      ];
      const phase2=await postBatch(endpoint.url,calls,fetchImpl);
      const block=phase2.get(2).result;
      const timestampSeconds=Number(decodeRpcQuantity(block?.timestamp));
      if(!(timestampSeconds>0)||!/^0x[0-9a-f]{64}$/i.test(String(block?.hash||'')))throw new Error('Exact block timestamp/hash unavailable');

      const frxRaw=decodeUint256(phase2.get(10).result);
      const frxDecimals=Number(decodeUint256(phase2.get(11).result));
      const sharesRaw=decodeUint256(phase2.get(20).result);
      const assetsRaw=decodeUint256(phase2.get(21).result);
      const shareDecimals=Number(decodeUint256(phase2.get(22).result));
      if(sharesRaw<=0n||assetsRaw<=0n)throw new Error('sfrxUSD totalSupply/totalAssets unavailable or zero');
      if(!Number.isInteger(frxDecimals)||!Number.isInteger(shareDecimals)||frxDecimals<0||shareDecimals<0||frxDecimals>36||shareDecimals>36)throw new Error('Token decimals invalid');

      const frxUsdSupply=Number(unitsToString(frxRaw,frxDecimals));
      const sfrxUsdSupply=Number(unitsToString(sharesRaw,shareDecimals));
      const sfrxUsdTotalAssets=Number(unitsToString(assetsRaw,frxDecimals));
      const sharePriceFrxUsd=sfrxUsdTotalAssets/sfrxUsdSupply;
      if(!Number.isFinite(frxUsdSupply)||!Number.isFinite(sfrxUsdSupply)||!Number.isFinite(sfrxUsdTotalAssets)||!(sharePriceFrxUsd>0))throw new Error('Decoded sfrxUSD measurement invalid');

      return {
        version:FRAX_SFRXUSD_ONCHAIN_VERSION,
        status:'ok',
        measurementClass:'MEASURED',
        observedAt:new Date(timestampSeconds*1000).toISOString(),
        chain:'ethereum',
        chainId:1,
        blockNumber:Number(blockNumber),
        blockTag,
        blockHash:block.hash,
        contracts:{frxUSD:FRXUSD_ETHEREUM,sfrxUSD:SFRXUSD_ETHEREUM},
        decimals:{frxUSD:frxDecimals,sfrxUSD:shareDecimals},
        raw:{
          frxUsdTotalSupply:frxRaw.toString(),
          sfrxUsdTotalSupply:sharesRaw.toString(),
          sfrxUsdTotalAssets:assetsRaw.toString()
        },
        values:{
          frxUsdSupply:round(frxUsdSupply,8),
          sfrxUsdSupply:round(sfrxUsdSupply,8),
          sfrxUsdTotalAssets:round(sfrxUsdTotalAssets,8),
          sharePriceFrxUsd:round(sharePriceFrxUsd,12)
        },
        rpc:{endpointId:endpoint.id,failoverAttempts:attempts},
        identity:{
          sharePriceFormula:'sfrxUSD totalAssets / totalSupply after token-decimal normalization',
          intervalYieldFormula:'ending share price / beginning share price - 1',
          historyRule:'persisted adjacent Economic Graph onchain checkpoints only; no pre-tracking or APY backfill'
        },
        epistemic:{
          sourceType:'onchain-public-rpc-exact-block',
          currentStateMeasured:true,
          sharePriceMechanicalIdentity:'PROVEN-current-exact-block',
          historicalBackfill:false,
          unknownIsZero:false,
          productionPriceAuthority:false,
          causalClaimAuthority:'none',
          executionAuthority:'none'
        }
      };
    }catch(error){
      attempts.push({endpointId:endpoint.id,error:error instanceof Error?error.message:String(error)});
    }
  }
  return unknownMeasurement(attempts);
}

function previousMeasuredSurface(previousState){
  const previous=previousState?.protocolEvidence?.[FRAX_ECOSYSTEM_EVIDENCE_ID]?.latest?.observation?.surfaces?.frxUsdSfrxUsd?.measured;
  return previous?.status==='ok'&&finite(previous?.values?.sharePriceFrxUsd)?previous:null;
}

export function buildSfrxUsdInterval({previousState,current}){
  if(current?.status!=='ok'||!finite(current?.values?.sharePriceFrxUsd))return {
    status:'UNKNOWN-current-measurement-unavailable',accepted:false,startAt:null,endAt:current?.observedAt||null,embeddedYieldPct:null
  };
  const previous=previousMeasuredSurface(previousState);
  if(!previous)return {
    status:'warming-first-onchain-checkpoint',accepted:false,startAt:null,endAt:current.observedAt,embeddedYieldPct:null,
    source:'persisted-adjacent-economic-graph-onchain-checkpoints'
  };
  if(previous.chain!==current.chain||previous.contracts?.sfrxUSD?.toLowerCase()!==current.contracts?.sfrxUSD?.toLowerCase())return {
    status:'UNKNOWN-identity-mismatch',accepted:false,startAt:previous.observedAt,endAt:current.observedAt,embeddedYieldPct:null
  };
  const startMs=Date.parse(previous.observedAt);
  const endMs=Date.parse(current.observedAt);
  const startBlock=Number(previous.blockNumber);
  const endBlock=Number(current.blockNumber);
  if(!Number.isFinite(startMs)||!Number.isFinite(endMs)||!(endMs>startMs)||!Number.isFinite(startBlock)||!Number.isFinite(endBlock)||!(endBlock>startBlock))return {
    status:'warming-no-new-independent-block',accepted:false,startAt:previous.observedAt,endAt:current.observedAt,embeddedYieldPct:null
  };
  const startPrice=Number(previous.values.sharePriceFrxUsd);
  const endPrice=Number(current.values.sharePriceFrxUsd);
  if(!(startPrice>0)||!(endPrice>0))return {
    status:'UNKNOWN-invalid-share-price',accepted:false,startAt:previous.observedAt,endAt:current.observedAt,embeddedYieldPct:null
  };
  return {
    status:'ok',
    accepted:true,
    source:'persisted-adjacent-economic-graph-onchain-checkpoints',
    startAt:previous.observedAt,
    endAt:current.observedAt,
    elapsedSeconds:Math.round((endMs-startMs)/1000),
    startBlock,
    endBlock,
    startSharePriceFrxUsd:round(startPrice,12),
    endSharePriceFrxUsd:round(endPrice,12),
    embeddedYieldPct:round((endPrice/startPrice-1)*100,12),
    annualizedApyPct:null,
    annualizationState:'NOT-CALCULATED-no-annualization-methodology-added',
    accountingIdentity:'ending sfrxUSD share price / beginning share price - 1',
    note:'Direct interval share-price return only. No APY backfill, reserve-yield causality or veFRAX revenue attribution.'
  };
}

export function applyFraxSfrxUsdOnchainMeasurement({state,previousState,measurement}){
  if(!state||typeof state!=='object')throw new Error('Frax sfrxUSD adapter requires Economic Graph state');
  if(state?.authority?.executionAuthority!=='none'||state?.authority?.causalClaimAuthority!=='none')throw new Error('Frax sfrxUSD adapter refuses Graph authority drift');
  const evidence=state?.protocolEvidence?.[FRAX_ECOSYSTEM_EVIDENCE_ID];
  const baseCurrent=evidence?.latest?.observation;
  const fraxSensor=state?.protocolSensors?.[FRAX_PROTOCOL_ID];
  if(!evidence||!baseCurrent||!fraxSensor)throw new Error('Frax ecosystem evidence missing before sfrxUSD enrichment');
  const current=structuredClone(baseCurrent);
  const surface=current?.surfaces?.frxUsdSfrxUsd;
  if(!surface)throw new Error('frxUSD/sfrxUSD surface missing');

  const valid=measurement?.status==='ok'&&measurement?.measurementClass==='MEASURED'&&finite(measurement?.values?.sharePriceFrxUsd);
  if(valid){
    const interval=buildSfrxUsdInterval({previousState,current:measurement});
    surface.measurementState='MEASURED-current-onchain-partial';
    surface.measured={...measurement,intervalEmbeddedYield:interval};
    surface.mechanicalRelations=surface.mechanicalRelations.map(relation=>{
      if(relation.to==='share price')return {...relation,class:'MECHANICAL-proven-current-exact-block'};
      if(relation.to==='embedded yield')return {...relation,class:interval.accepted?'MECHANICAL-proven-adjacent-checkpoints':'MECHANICAL-warming-adjacent-checkpoints'};
      return relation;
    });
  }else{
    surface.measurementState='UNKNOWN-current-onchain-read-unavailable';
    surface.measured={...unknownMeasurement(measurement?.rpc?.failoverAttempts||[],measurement?.status||'UNKNOWN-current-onchain-read-unavailable')};
  }

  const surfaces=Object.values(current.surfaces||{});
  current.coverage.measuredSurfaceCount=surfaces.filter(x=>String(x.measurementState||'').startsWith('MEASURED')).length;
  current.coverage.sourceBoundUnknownSurfaceCount=surfaces.length-current.coverage.measuredSurfaceCount;
  current.status=current.coverage.sourceBoundUnknownSurfaceCount===0?'deep-sensor-family-fully-measured':'deep-sensor-family-active-partial-measurement';
  current.epistemic.measuredEconomicSurfaces=surfaces.filter(x=>String(x.measurementState||'').startsWith('MEASURED')).map(x=>x.id);
  current.epistemic.sfrxUsdCurrentState=valid?'MEASURED':'UNKNOWN';
  current.epistemic.sfrxUsdEmbeddedYield=valid?(surface.measured.intervalEmbeddedYield.accepted?'DERIVED-MECHANICAL':'WARMING'):'UNKNOWN';
  current.measurementExtensions={...(current.measurementExtensions||{}),sfrxUsdOnchain:FRAX_SFRXUSD_ONCHAIN_VERSION};
  current.nextMeasurementUnlocks=(current.nextMeasurementUnlocks||[]).map(item=>String(item).startsWith('Ingest frxUSD/sfrxUSD current ERC20/ERC4626 state')
    ? 'frxUSD/sfrxUSD ERC20/ERC4626 current state is now measured; continue adjacent checkpoints and separately prove backing/allocation evidence.'
    : item);

  current.id=`frax-ecosystem:${sha256(stableStringify({
    baseVersion:current.version,
    governance:current.surfaces?.governanceVeFrax?.measured||null,
    sfrxUsd:valid?{
      blockNumber:measurement.blockNumber,
      blockHash:measurement.blockHash,
      sharePriceFrxUsd:measurement.values.sharePriceFrxUsd,
      sfrxUsdSupply:measurement.values.sfrxUsdSupply,
      sfrxUsdTotalAssets:measurement.values.sfrxUsdTotalAssets
    }:{status:measurement?.status||'UNKNOWN'},
    surfaceIds:current.coverage.surfaceIds
  })).slice(0,24)}`;

  const previousRows=Array.isArray(previousState?.protocolEvidence?.[FRAX_ECOSYSTEM_EVIDENCE_ID]?.observations)
    ? previousState.protocolEvidence[FRAX_ECOSYSTEM_EVIDENCE_ID].observations
    : [];
  const rows=[...previousRows];
  if(!rows.some(row=>row?.id===current.id))rows.push(current);
  const bounded=rows.slice(-MAX_OBSERVATIONS);
  evidence.latest={observation:current};
  evidence.status=current.status;
  evidence.observations=bounded;
  evidence.observationCount=bounded.length;
  evidence.measurementExtensions={sfrxUsdOnchain:FRAX_SFRXUSD_ONCHAIN_VERSION};

  fraxSensor.ecosystemFamily={
    ...(fraxSensor.ecosystemFamily||{}),
    status:current.status,
    measuredSurfaceCount:current.coverage.measuredSurfaceCount,
    sourceBoundUnknownSurfaceCount:current.coverage.sourceBoundUnknownSurfaceCount,
    latestObservationId:current.id,
    measurementExtensions:{sfrxUsdOnchain:FRAX_SFRXUSD_ONCHAIN_VERSION}
  };
  if(fraxSensor?.latest?.observation)fraxSensor.latest.observation.ecosystemFamily=fraxSensor.ecosystemFamily;

  if(current.coverage.surfaceCount!==9)throw new Error('Frax ecosystem surface count drift');
  if(valid&&current.coverage.measuredSurfaceCount!==2)throw new Error('sfrxUSD measurement did not produce exactly two measured Frax surfaces');
  if(!valid&&current.coverage.measuredSurfaceCount!==1)throw new Error('Unavailable sfrxUSD measurement must preserve one measured Frax surface');
  if(current?.authority?.executionAuthority!=='none'||current?.epistemic?.executionAuthority!=='none')throw new Error('Frax sfrxUSD execution authority leaked');
  return state;
}
