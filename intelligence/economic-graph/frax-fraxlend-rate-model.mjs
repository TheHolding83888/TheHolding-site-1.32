#!/usr/bin/env node
/**
 * The Holding · Frax Fraxlend rate-model proof v0.1
 *
 * Bounded exact-block reproduction of the protocol-native Fraxlend rate path:
 * stored pair accounting -> utilization -> rateContract.getNewRate() ->
 * previewAddInterest() new CurrentRateInfo.
 *
 * This module does not annualize rates, infer realized lender income, or create
 * protocol-wide Fraxlend APR. A failed rate-model proof remains UNKNOWN while
 * the already-proven pair-state measurement can stay MEASURED.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  FRAX_ECOSYSTEM_EVIDENCE_ID,
  FRAX_PROTOCOL_ID,
  FRAXLEND_PAIR_SFRXETH_USDC
} from './frax-fraxlend-onchain.mjs';

export const FRAX_FRAXLEND_RATE_MODEL_VERSION='0.1-fraxlend-rate-model-exact-block';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const RPC_REGISTRY_FILE=path.join(ROOT,'intelligence/market-data/onchain-price-source-registry.json');
const RPC_TIMEOUT_MS=10_000;
const UTIL_PREC=100000n;

const SELECTOR_RATE_CONTRACT='0xeee24219';
const SELECTOR_TOTAL_ASSET='0xf9557ccb';
const SELECTOR_TOTAL_BORROW='0x8285ef40';
const SELECTOR_CURRENT_RATE_INFO='0x95d14ca8';
const SELECTOR_IS_INTEREST_PAUSED='0xf211c390';
const SELECTOR_PREVIEW_ADD_INTEREST='0xcacf3b58';
const SELECTOR_GET_NEW_RATE='0xcd3181d5';
const SELECTOR_VERSION='0x54fd4d50';

function sha256(value){return crypto.createHash('sha256').update(value).digest('hex');}
function stableValue(value){
  if(Array.isArray(value))return value.map(stableValue);
  if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(k=>[k,stableValue(value[k])]));
  return value;
}
function stableStringify(value){return JSON.stringify(stableValue(value));}
function cleanAbi(hex){
  const clean=String(hex||'').replace(/^0x/,'');
  if(!clean.length||clean.length%64!==0||!/^[0-9a-f]+$/i.test(clean))throw new Error('Invalid ABI result');
  return clean;
}
function decodeWords(hex,minWords=1){
  const clean=cleanAbi(hex),out=[];
  for(let i=0;i<clean.length;i+=64)out.push(BigInt(`0x${clean.slice(i,i+64)}`));
  if(out.length<minWords)throw new Error(`ABI result expected at least ${minWords} words`);
  return out;
}
function decodeAddress(hex){const clean=cleanAbi(hex);return `0x${clean.slice(24,64)}`;}
function sameAddress(a,b){return String(a||'').toLowerCase()===String(b||'').toLowerCase();}
function encodeUint(value){return BigInt(value).toString(16).padStart(64,'0');}
function encodeGetNewRate(deltaTime,utilization,fullUtilizationRate){
  return `${SELECTOR_GET_NEW_RATE}${encodeUint(deltaTime)}${encodeUint(utilization)}${encodeUint(fullUtilizationRate)}`;
}
function ratioPct(raw,precision=UTIL_PREC){return Number(raw)*100/Number(precision);}
function readRegistry(){return JSON.parse(fs.readFileSync(RPC_REGISTRY_FILE,'utf8'));}

async function postBatch(url,payload,fetchImpl){
  const response=await fetchImpl(url,{method:'POST',headers:{'content-type':'application/json',accept:'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(RPC_TIMEOUT_MS)});
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

function unknown(baseMeasurement,attempts,reason='UNKNOWN-rate-model-proof-failed'){
  return {
    version:FRAX_FRAXLEND_RATE_MODEL_VERSION,
    status:reason,
    measurementClass:'UNKNOWN',
    observedAt:baseMeasurement?.observedAt||null,
    chain:'ethereum',chainId:1,
    blockNumber:baseMeasurement?.blockNumber??null,
    blockTag:baseMeasurement?.blockTag||null,
    blockHash:baseMeasurement?.blockHash||null,
    pair:baseMeasurement?.contracts?.pair||FRAXLEND_PAIR_SFRXETH_USDC,
    rateContract:null,
    values:{storedUtilizationPct:null,deltaTimeSeconds:null,storedRatePerSecond:null,previewRatePerSecond:null,directRatePerSecond:null,storedFullUtilizationRatePerSecond:null,previewFullUtilizationRatePerSecond:null,directFullUtilizationRatePerSecond:null},
    parity:{previewVsDirectRateRaw:null,previewVsDirectFullUtilizationRateRaw:null,accepted:false},
    rpc:{endpointId:null,failoverAttempts:attempts},
    epistemic:{rateModelReproduction:'UNKNOWN',annualizationPerformed:false,realizedLenderIncomeClaim:false,protocolWideAprClaim:false,causalClaimAuthority:'none',executionAuthority:'none'}
  };
}

export async function collectFraxFraxlendRateModel({baseMeasurement,registry=null,fetchImpl=fetch}={}){
  if(baseMeasurement?.status!=='ok'||baseMeasurement?.measurementClass!=='MEASURED'||!baseMeasurement?.blockTag||!baseMeasurement?.blockHash||!sameAddress(baseMeasurement?.contracts?.pair,FRAXLEND_PAIR_SFRXETH_USDC)){
    return unknown(baseMeasurement,[],'UNKNOWN-base-fraxlend-measurement-unavailable');
  }
  const sourceRegistry=registry||readRegistry();
  const network=sourceRegistry?.networks?.ethereum;
  const endpoints=Array.isArray(network?.rpcFailover)?network.rpcFailover:[];
  const preferred=baseMeasurement?.rpc?.endpointId;
  const ordered=[...endpoints].sort((a,b)=>(a.id===preferred?-1:0)-(b.id===preferred?-1:0));
  const attempts=[];
  const blockTag=baseMeasurement.blockTag;

  for(const endpoint of ordered){
    try{
      const call=(id,to,data)=>({jsonrpc:'2.0',id,method:'eth_call',params:[{to,data},blockTag]});
      const phase1=await postBatch(endpoint.url,[
        {jsonrpc:'2.0',id:1,method:'eth_getBlockByNumber',params:[blockTag,false]},
        call(10,FRAXLEND_PAIR_SFRXETH_USDC,SELECTOR_RATE_CONTRACT),
        call(11,FRAXLEND_PAIR_SFRXETH_USDC,SELECTOR_TOTAL_ASSET),
        call(12,FRAXLEND_PAIR_SFRXETH_USDC,SELECTOR_TOTAL_BORROW),
        call(13,FRAXLEND_PAIR_SFRXETH_USDC,SELECTOR_CURRENT_RATE_INFO),
        call(14,FRAXLEND_PAIR_SFRXETH_USDC,SELECTOR_IS_INTEREST_PAUSED),
        call(15,FRAXLEND_PAIR_SFRXETH_USDC,SELECTOR_PREVIEW_ADD_INTEREST)
      ],fetchImpl);
      const block=phase1.get(1).result;
      if(!block||String(block.hash||'').toLowerCase()!==String(baseMeasurement.blockHash).toLowerCase())throw new Error('Fraxlend rate-model block hash mismatch');
      const blockTimestamp=BigInt(block.timestamp);
      const rateContract=decodeAddress(phase1.get(10).result);
      const storedAsset=decodeWords(phase1.get(11).result,2);
      const storedBorrow=decodeWords(phase1.get(12).result,2);
      const currentRate=decodeWords(phase1.get(13).result,5);
      const interestPaused=decodeWords(phase1.get(14).result,1)[0]!==0n;
      const preview=decodeWords(phase1.get(15).result,12);
      if(storedAsset[0]===0n)throw new Error('Stored Fraxlend totalAsset is zero');
      const storedUtilization=(UTIL_PREC*storedBorrow[0])/storedAsset[0];
      const lastTimestamp=currentRate[2];
      if(blockTimestamp<lastTimestamp)throw new Error('Fraxlend rate timestamp is in the future');
      const deltaTime=blockTimestamp-lastTimestamp;
      const previewRate=preview[6];
      const previewFull=preview[7];
      const previewAssetAmount=preview[8];
      const previewAssetShares=preview[9];
      const previewBorrowAmount=preview[10];
      const previewBorrowShares=preview[11];
      if(String(previewAssetAmount)!==String(baseMeasurement.raw?.totalAssetAmount)||String(previewAssetShares)!==String(baseMeasurement.raw?.totalAssetShares)||String(previewBorrowAmount)!==String(baseMeasurement.raw?.totalBorrowAmount)||String(previewBorrowShares)!==String(baseMeasurement.raw?.totalBorrowShares)){
        throw new Error('previewAddInterest accounting does not match base exact-block getPairAccounting');
      }

      if(interestPaused||deltaTime===0n){
        if(previewRate!==currentRate[3]||previewFull!==currentRate[4])throw new Error('Paused/same-timestamp Fraxlend preview unexpectedly changed rate');
        return {
          version:FRAX_FRAXLEND_RATE_MODEL_VERSION,status:'ok',measurementClass:'DERIVED-MECHANICAL',observedAt:baseMeasurement.observedAt,
          chain:'ethereum',chainId:1,blockNumber:baseMeasurement.blockNumber,blockTag,blockHash:baseMeasurement.blockHash,pair:FRAXLEND_PAIR_SFRXETH_USDC,rateContract,
          mechanismState:interestPaused?'PAUSED-interest-short-circuit':'SAME-TIMESTAMP-short-circuit',
          values:{storedUtilizationPct:Number(ratioPct(storedUtilization).toFixed(8)),deltaTimeSeconds:Number(deltaTime),storedRatePerSecond:Number(currentRate[3])/1e18,previewRatePerSecond:Number(previewRate)/1e18,directRatePerSecond:null,storedFullUtilizationRatePerSecond:Number(currentRate[4])/1e18,previewFullUtilizationRatePerSecond:Number(previewFull)/1e18,directFullUtilizationRatePerSecond:null},
          raw:{storedAssetAmount:storedAsset[0].toString(),storedBorrowAmount:storedBorrow[0].toString(),storedUtilization:storedUtilization.toString(),storedRatePerSec:currentRate[3].toString(),storedFullUtilizationRate:currentRate[4].toString(),previewRatePerSec:previewRate.toString(),previewFullUtilizationRate:previewFull.toString()},
          parity:{previewVsDirectRateRaw:null,previewVsDirectFullUtilizationRateRaw:null,accepted:true,shortCircuit:true},
          rpc:{endpointId:endpoint.id,failoverAttempts:attempts},
          epistemic:{rateModelReproduction:'PROVEN-protocol-short-circuit',annualizationPerformed:false,realizedLenderIncomeClaim:false,protocolWideAprClaim:false,causalClaimAuthority:'none',executionAuthority:'none'}
        };
      }

      const directData=encodeGetNewRate(deltaTime,storedUtilization,currentRate[4]);
      const phase2=await postBatch(endpoint.url,[call(20,rateContract,directData),call(21,rateContract,SELECTOR_VERSION)],fetchImpl);
      const direct=decodeWords(phase2.get(20).result,2);
      const version=decodeWords(phase2.get(21).result,3);
      const rateDelta=previewRate>=direct[0]?previewRate-direct[0]:direct[0]-previewRate;
      const fullDelta=previewFull>=direct[1]?previewFull-direct[1]:direct[1]-previewFull;
      if(rateDelta!==0n||fullDelta!==0n)throw new Error(`Fraxlend rate-model parity mismatch: rate=${rateDelta} full=${fullDelta}`);

      return {
        version:FRAX_FRAXLEND_RATE_MODEL_VERSION,status:'ok',measurementClass:'DERIVED-MECHANICAL',observedAt:baseMeasurement.observedAt,
        chain:'ethereum',chainId:1,blockNumber:baseMeasurement.blockNumber,blockTag,blockHash:baseMeasurement.blockHash,pair:FRAXLEND_PAIR_SFRXETH_USDC,rateContract,
        rateContractVersion:{major:Number(version[0]),minor:Number(version[1]),patch:Number(version[2])},mechanismState:'ACTIVE-protocol-native-getNewRate-parity',
        values:{storedUtilizationPct:Number(ratioPct(storedUtilization).toFixed(8)),deltaTimeSeconds:Number(deltaTime),storedRatePerSecond:Number(currentRate[3])/1e18,previewRatePerSecond:Number(previewRate)/1e18,directRatePerSecond:Number(direct[0])/1e18,storedFullUtilizationRatePerSecond:Number(currentRate[4])/1e18,previewFullUtilizationRatePerSecond:Number(previewFull)/1e18,directFullUtilizationRatePerSecond:Number(direct[1])/1e18},
        raw:{storedAssetAmount:storedAsset[0].toString(),storedAssetShares:storedAsset[1].toString(),storedBorrowAmount:storedBorrow[0].toString(),storedBorrowShares:storedBorrow[1].toString(),storedUtilization:storedUtilization.toString(),deltaTimeSeconds:deltaTime.toString(),storedRatePerSec:currentRate[3].toString(),storedFullUtilizationRate:currentRate[4].toString(),previewRatePerSec:previewRate.toString(),previewFullUtilizationRate:previewFull.toString(),directRatePerSec:direct[0].toString(),directFullUtilizationRate:direct[1].toString()},
        parity:{previewVsDirectRateRaw:rateDelta.toString(),previewVsDirectFullUtilizationRateRaw:fullDelta.toString(),accepted:true,shortCircuit:false},
        identity:{mechanicalPath:'stored pair accounting -> UTIL_PREC * totalBorrow.amount / totalAsset.amount -> IRateCalculatorV2.getNewRate(deltaTime, utilization, oldFullUtilizationRate) -> previewAddInterest new CurrentRateInfo',previewAccountingBoundToBaseGetPairAccounting:true},
        provenance:{pairCore:'FraxFinance/fraxlend FraxlendPairCore._calculateInterest',rateInterface:'FraxFinance/fraxlend IRateCalculatorV2.getNewRate',selectors:{rateContract:SELECTOR_RATE_CONTRACT,totalAsset:SELECTOR_TOTAL_ASSET,totalBorrow:SELECTOR_TOTAL_BORROW,currentRateInfo:SELECTOR_CURRENT_RATE_INFO,isInterestPaused:SELECTOR_IS_INTEREST_PAUSED,previewAddInterest:SELECTOR_PREVIEW_ADD_INTEREST,getNewRate:SELECTOR_GET_NEW_RATE}},
        rpc:{endpointId:endpoint.id,failoverAttempts:attempts},
        epistemic:{rateModelReproduction:'PROVEN-current-exact-block-protocol-native-call-parity',rateModelFormulaClass:'MECHANICAL-within-protocol-rate-path',upstreamWhyUtilizationChanged:'UNKNOWN',annualizationPerformed:false,realizedLenderIncomeClaim:false,protocolWideAprClaim:false,causalClaimAuthority:'none',executionAuthority:'none'}
      };
    }catch(error){attempts.push({endpointId:endpoint.id,error:error instanceof Error?error.message:String(error)});}
  }
  return unknown(baseMeasurement,attempts);
}

export function applyFraxFraxlendRateModel({state,proof}){
  if(!state||typeof state!=='object')throw new Error('Fraxlend rate-model adapter requires Economic Graph state');
  if(state?.authority?.executionAuthority!=='none'||state?.authority?.causalClaimAuthority!=='none')throw new Error('Fraxlend rate-model adapter refuses Graph authority drift');
  const evidence=state?.protocolEvidence?.[FRAX_ECOSYSTEM_EVIDENCE_ID];
  const current=evidence?.latest?.observation;
  const sensor=state?.protocolSensors?.[FRAX_PROTOCOL_ID];
  const surface=current?.surfaces?.fraxlend;
  if(!evidence||!current||!sensor||!surface?.measured)throw new Error('Measured Fraxlend surface missing before rate-model enrichment');
  if(!String(surface.measurementState||'').startsWith('MEASURED'))throw new Error('Fraxlend rate-model cannot promote an unmeasured pair surface');
  const valid=proof?.status==='ok'&&proof?.measurementClass==='DERIVED-MECHANICAL'&&proof?.parity?.accepted===true&&proof?.blockNumber===surface.measured.blockNumber&&String(proof?.blockHash||'').toLowerCase()===String(surface.measured.blockHash||'').toLowerCase()&&sameAddress(proof?.pair,surface.measured.contracts?.pair);
  surface.measured.rateModel=valid?proof:unknown(surface.measured,proof?.rpc?.failoverAttempts||[],proof?.status||'UNKNOWN-rate-model-proof-failed');
  surface.measured.epistemic={...(surface.measured.epistemic||{}),borrowRateModelReproduction:valid?proof.epistemic.rateModelReproduction:'UNKNOWN'};
  surface.mechanicalRelations=surface.mechanicalRelations.map(relation=>relation.to==='borrow rate'?{...relation,class:valid?'MECHANICAL-proven-current-rate-model':'MEASURED-current-rate-state-model-UNKNOWN'}:relation);
  current.relationshipGraph=Object.values(current.surfaces||{}).flatMap(s=>s.mechanicalRelations.map((relation,index)=>({surfaceId:s.id,index,...relation})));
  current.coverage.relationshipCount=current.relationshipGraph.length;
  current.coverage.relationshipClassCounts=current.relationshipGraph.reduce((acc,relation)=>{const key=String(relation.class||'UNKNOWN').split('-')[0];acc[key]=(acc[key]||0)+1;return acc;},{});
  current.epistemic.fraxlendRateModel=valid?'DERIVED-MECHANICAL':'UNKNOWN';
  current.epistemic.fraxlendRateModelCausality=valid?'MECHANICAL-protocol-native-utilization-rate-path':'UNKNOWN-not-reproduced';
  current.epistemic.fraxlendRateModelUpstreamCausality='UNKNOWN-why-utilization-changed';
  current.measurementExtensions={...(current.measurementExtensions||{}),fraxlendRateModel:FRAX_FRAXLEND_RATE_MODEL_VERSION};
  evidence.measurementExtensions={...(evidence.measurementExtensions||{}),fraxlendRateModel:FRAX_FRAXLEND_RATE_MODEL_VERSION};
  sensor.ecosystemFamily={...(sensor.ecosystemFamily||{}),measurementExtensions:{...(sensor.ecosystemFamily?.measurementExtensions||{}),fraxlendRateModel:FRAX_FRAXLEND_RATE_MODEL_VERSION}};
  if(sensor?.latest?.observation)sensor.latest.observation.ecosystemFamily=sensor.ecosystemFamily;
  const priorId=current.id;
  current.id=`frax-ecosystem:${sha256(stableStringify({priorObservationId:priorId,fraxlendRateModel:valid?{blockNumber:proof.blockNumber,blockHash:proof.blockHash,rateContract:proof.rateContract,storedUtilizationPct:proof.values.storedUtilizationPct,previewRatePerSecond:proof.values.previewRatePerSecond,directRatePerSecond:proof.values.directRatePerSecond,parity:proof.parity}:{status:surface.measured.rateModel.status}})).slice(0,24)}`;
  sensor.ecosystemFamily.latestObservationId=current.id;
  if(current?.authority?.executionAuthority!=='none'||current?.epistemic?.executionAuthority!=='none')throw new Error('Fraxlend rate-model execution authority leaked');
  return state;
}
