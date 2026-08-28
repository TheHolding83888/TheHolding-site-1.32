#!/usr/bin/env node
/**
 * The Holding · Frax Fraxlend pair onchain measurement v0.1
 *
 * Read-only exact-block pair-level observation for the existing Frax ecosystem
 * Fraxlend surface. The first bounded pilot uses the official Frax mainnet
 * sfrxETH/USDC Pair constant and proves both registry membership and the Pair's
 * official V4 deployer identity before accepting measurement.
 *
 * Semantics:
 * - utilization reproduces FraxlendPairCore exactly: UTIL_PREC * borrows / assets;
 * - borrow-rate state is measured as raw ratePerSec + RATE_PRECISION, not annualized;
 * - fToken share price is reproduced from previewed pair accounting and checked
 *   against pricePerShare();
 * - interval fToken embedded yield requires two persisted adjacent published
 *   Graph checkpoints; the first checkpoint is WARMING and no backfill is made;
 * - RPC/source failure is UNKNOWN, never zero.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const FRAX_FRAXLEND_ONCHAIN_VERSION='0.1-fraxlend-pair-exact-block';
export const FRAX_ECOSYSTEM_EVIDENCE_ID='registry-frax-ecosystem';
export const FRAX_PROTOCOL_ID='registry-frax-vefrax';
export const FRAXLEND_PAIR_REGISTRY_ETHEREUM='0xD6E9D27C75Afd88ad24Cd5EdccdC76fd2fc3A751';
export const FRAXLEND_DEPLOYER_V4_ETHEREUM='0x7AB788d0483551428f2291232477F1818952998C';
export const FRAXLEND_PAIR_SFRXETH_USDC='0xeE847a804b67f4887c9E8fe559A2dA4278deFB52';
export const USDC_ETHEREUM='0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
export const SFRXETH_ETHEREUM='0xac3E018457B222d93114458476f3E3416Abbe38F';
export const OFFICIAL_FRAX_CONSTANTS_REF='e7aaf6db156c4ea6e4fe43826e523f8fb9275cb0';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const RPC_REGISTRY_FILE=path.join(ROOT,'intelligence/market-data/onchain-price-source-registry.json');
const RPC_TIMEOUT_MS=10_000;
const MAX_OBSERVATIONS=1000;

const SELECTOR_REGISTRY_GET_ALL_PAIRS='0x607b6d16';
const SELECTOR_DEPLOYER_ADDRESS='0xd2a156e0';
const SELECTOR_ASSET='0x38d52e0f';
const SELECTOR_COLLATERAL='0xc6e1c7c9';
const SELECTOR_PAIR_ACCOUNTING='0xcdd72d52';
const SELECTOR_CURRENT_RATE_INFO='0x95d14ca8';
const SELECTOR_PRICE_PER_SHARE='0x99530b06';
const SELECTOR_GET_CONSTANTS='0x9a295e73';
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
function normalizeAddress(value){return String(value||'').toLowerCase();}
function sameAddress(a,b){return normalizeAddress(a)===normalizeAddress(b);}
function decodeRpcQuantity(hex){
  if(!/^0x[0-9a-f]+$/i.test(String(hex||'')))throw new Error('Invalid RPC quantity');
  return BigInt(hex);
}
function cleanAbi(hex){
  const clean=String(hex||'').replace(/^0x/,'');
  if(!clean.length||clean.length%64!==0||!/^[0-9a-f]+$/i.test(clean))throw new Error('Invalid ABI result');
  return clean;
}
function decodeWords(hex,minWords=1){
  const clean=cleanAbi(hex);
  const words=[];
  for(let i=0;i<clean.length;i+=64)words.push(BigInt(`0x${clean.slice(i,i+64)}`));
  if(words.length<minWords)throw new Error(`ABI result expected at least ${minWords} words`);
  return words;
}
function decodeAddress(hex){
  const clean=cleanAbi(hex);
  return `0x${clean.slice(24,64)}`;
}
function decodeAddressArray(hex){
  const clean=cleanAbi(hex);
  const wordCount=clean.length/64;
  const offset=Number(BigInt(`0x${clean.slice(0,64)}`));
  if(!Number.isSafeInteger(offset)||offset<0||offset%32!==0)throw new Error('Invalid dynamic-array ABI offset');
  const start=offset/32;
  if(start>=wordCount)throw new Error('Dynamic-array ABI offset outside result');
  const length=Number(BigInt(`0x${clean.slice(start*64,(start+1)*64)}`));
  if(!Number.isSafeInteger(length)||length<0||length>5000||start+1+length>wordCount)throw new Error('Invalid dynamic address-array length');
  const out=[];
  for(let i=0;i<length;i++){
    const word=clean.slice((start+1+i)*64,(start+2+i)*64);
    out.push(`0x${word.slice(24)}`);
  }
  return out;
}
function unitsToString(raw,decimals){
  const d=Number(decimals);
  if(!Number.isInteger(d)||d<0||d>36)throw new Error(`Invalid decimals ${decimals}`);
  const value=BigInt(raw);
  const base=10n**BigInt(d);
  const whole=value/base;
  const fraction=(value%base).toString().padStart(d,'0').replace(/0+$/,'');
  return `${whole.toString()}${fraction?'.'+fraction:''}`;
}
function ratioToNumber(numerator,denominator,digits=12){
  const n=BigInt(numerator),d=BigInt(denominator);
  if(d<=0n)throw new Error('Ratio denominator must be positive');
  const scale=10n**BigInt(digits);
  return Number((n*scale)/d)/Number(scale);
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
    version:FRAX_FRAXLEND_ONCHAIN_VERSION,
    status:reason,
    measurementClass:'UNKNOWN',
    observedAt:null,
    chain:'ethereum',
    chainId:1,
    pairScope:'single-canonical-pair-pilot',
    contracts:{
      pairRegistry:FRAXLEND_PAIR_REGISTRY_ETHEREUM,
      pair:FRAXLEND_PAIR_SFRXETH_USDC,
      expectedDeployer:FRAXLEND_DEPLOYER_V4_ETHEREUM,
      expectedAsset:USDC_ETHEREUM,
      expectedCollateral:SFRXETH_ETHEREUM
    },
    values:{
      totalAsset:null,totalBorrow:null,totalCollateral:null,utilizationPct:null,
      borrowRatePerSecond:null,borrowRatePerSecondPct:null,fullUtilizationRatePerSecond:null,
      protocolFeePct:null,fTokenSharePriceAsset:null
    },
    intervalEmbeddedYield:{status:'UNKNOWN-current-measurement-unavailable',accepted:false,embeddedYieldPct:null},
    rpc:{endpointId:null,failoverAttempts:attempts},
    provenance:{
      officialConstantsRepository:'FraxFinance/frax-template',
      officialConstantsRef:OFFICIAL_FRAX_CONSTANTS_REF,
      registryIdentity:'FRAXLEND_PAIR_REGISTRY_ADDRESS',
      pairIdentity:'FRAXLEND_PAIR_SFRXETH_USDC',
      deployerIdentity:'FRAXLEND_PAIR_DEPLOYER_V4_ADDRESS'
    },
    epistemic:{
      sourceType:'onchain-public-rpc-exact-block',
      currentStateMeasured:false,
      historicalBackfill:false,
      unknownIsZero:false,
      annualizationPerformed:false,
      protocolWideAprClaim:false,
      lenderRealizedIncomeClaim:false,
      causalClaimAuthority:'none',
      executionAuthority:'none'
    }
  };
}

export async function collectFraxFraxlendOnchain({registry=null,fetchImpl=fetch}={}){
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
      const call=(id,to,data)=>({jsonrpc:'2.0',id,method:'eth_call',params:[{to,data},blockTag]});
      const calls=[
        {jsonrpc:'2.0',id:2,method:'eth_getBlockByNumber',params:[blockTag,false]},
        call(10,FRAXLEND_PAIR_REGISTRY_ETHEREUM,SELECTOR_REGISTRY_GET_ALL_PAIRS),
        call(20,FRAXLEND_PAIR_SFRXETH_USDC,SELECTOR_DEPLOYER_ADDRESS),
        call(21,FRAXLEND_PAIR_SFRXETH_USDC,SELECTOR_ASSET),
        call(22,FRAXLEND_PAIR_SFRXETH_USDC,SELECTOR_COLLATERAL),
        call(23,FRAXLEND_PAIR_SFRXETH_USDC,SELECTOR_PAIR_ACCOUNTING),
        call(24,FRAXLEND_PAIR_SFRXETH_USDC,SELECTOR_CURRENT_RATE_INFO),
        call(25,FRAXLEND_PAIR_SFRXETH_USDC,SELECTOR_PRICE_PER_SHARE),
        call(26,FRAXLEND_PAIR_SFRXETH_USDC,SELECTOR_GET_CONSTANTS),
        call(27,FRAXLEND_PAIR_SFRXETH_USDC,SELECTOR_DECIMALS),
        call(30,USDC_ETHEREUM,SELECTOR_DECIMALS),
        call(31,SFRXETH_ETHEREUM,SELECTOR_DECIMALS)
      ];
      const phase2=await postBatch(endpoint.url,calls,fetchImpl);
      const block=phase2.get(2).result;
      const timestampSeconds=Number(decodeRpcQuantity(block?.timestamp));
      if(!(timestampSeconds>0)||!/^0x[0-9a-f]{64}$/i.test(String(block?.hash||'')))throw new Error('Exact block timestamp/hash unavailable');

      const registryPairs=decodeAddressArray(phase2.get(10).result);
      if(!registryPairs.some(address=>sameAddress(address,FRAXLEND_PAIR_SFRXETH_USDC)))throw new Error('Canonical Fraxlend pair missing from official Pair Registry');
      const deployer=decodeAddress(phase2.get(20).result);
      const asset=decodeAddress(phase2.get(21).result);
      const collateral=decodeAddress(phase2.get(22).result);
      if(!sameAddress(deployer,FRAXLEND_DEPLOYER_V4_ETHEREUM))throw new Error(`Fraxlend deployer identity mismatch: ${deployer}`);
      if(!sameAddress(asset,USDC_ETHEREUM))throw new Error(`Fraxlend asset identity mismatch: ${asset}`);
      if(!sameAddress(collateral,SFRXETH_ETHEREUM))throw new Error(`Fraxlend collateral identity mismatch: ${collateral}`);

      const accounting=decodeWords(phase2.get(23).result,5);
      const rates=decodeWords(phase2.get(24).result,5);
      const pricePerShareRaw=decodeWords(phase2.get(25).result,1)[0];
      const constants=decodeWords(phase2.get(26).result,8);
      const pairDecimals=Number(decodeWords(phase2.get(27).result,1)[0]);
      const assetDecimals=Number(decodeWords(phase2.get(30).result,1)[0]);
      const collateralDecimals=Number(decodeWords(phase2.get(31).result,1)[0]);
      if(![pairDecimals,assetDecimals,collateralDecimals].every(d=>Number.isInteger(d)&&d>=0&&d<=36))throw new Error('Fraxlend/token decimals invalid');
      if(pairDecimals!==assetDecimals)throw new Error(`Fraxlend fToken/asset decimals mismatch: ${pairDecimals}/${assetDecimals}`);

      const [totalAssetAmount,totalAssetShares,totalBorrowAmount,totalBorrowShares,totalCollateralRaw]=accounting;
      if(totalAssetAmount<=0n||totalAssetShares<=0n)throw new Error('Fraxlend pair has no measurable lender accounting state');
      if(totalBorrowAmount>totalAssetAmount)throw new Error('Fraxlend borrow amount exceeds total asset claims');
      const [ltvPrecision,liqPrecision,utilPrecision,feePrecision,exchangePrecision,deviationPrecision,ratePrecision,maxProtocolFee]=constants;
      if(utilPrecision<=0n||feePrecision<=0n||ratePrecision<=0n)throw new Error('Fraxlend precision constants invalid');
      if(utilPrecision!==100000n||feePrecision!==100000n||ratePrecision!==1000000000000000000n)throw new Error('Fraxlend precision constants drift from official v3/v4 contract semantics');

      const utilizationRaw=(utilPrecision*totalBorrowAmount)/totalAssetAmount;
      const [,feeToProtocolRate,lastTimestamp,ratePerSec,fullUtilizationRate]=rates;
      const accountingSharePrice=ratioToNumber(totalAssetAmount,totalAssetShares,15);
      const pricePerShareAsset=ratioToNumber(pricePerShareRaw,10n**18n,15);
      const sharePriceDelta=Math.abs(accountingSharePrice-pricePerShareAsset);
      const sharePriceTolerance=Math.max(1e-12,Math.abs(pricePerShareAsset)*1e-9);
      if(!(pricePerShareAsset>0)||sharePriceDelta>sharePriceTolerance)throw new Error(`Fraxlend share-price identity mismatch: accounting=${accountingSharePrice} pps=${pricePerShareAsset}`);

      const totalAsset=Number(unitsToString(totalAssetAmount,assetDecimals));
      const totalBorrow=Number(unitsToString(totalBorrowAmount,assetDecimals));
      const totalCollateral=Number(unitsToString(totalCollateralRaw,collateralDecimals));
      const utilizationPct=Number(utilizationRaw)*100/Number(utilPrecision);
      const borrowRatePerSecond=ratioToNumber(ratePerSec,ratePrecision,18);
      const fullUtilizationRatePerSecond=ratioToNumber(fullUtilizationRate,ratePrecision,18);
      const protocolFeePct=Number(feeToProtocolRate)*100/Number(feePrecision);
      if(![totalAsset,totalBorrow,totalCollateral,utilizationPct,borrowRatePerSecond,fullUtilizationRatePerSecond,protocolFeePct,pricePerShareAsset].every(Number.isFinite))throw new Error('Decoded Fraxlend measurement invalid');

      return {
        version:FRAX_FRAXLEND_ONCHAIN_VERSION,
        status:'ok',
        measurementClass:'MEASURED',
        observedAt:new Date(timestampSeconds*1000).toISOString(),
        chain:'ethereum',
        chainId:1,
        blockNumber:Number(blockNumber),
        blockTag,
        blockHash:block.hash,
        pairScope:'single-canonical-pair-pilot',
        contracts:{
          pairRegistry:FRAXLEND_PAIR_REGISTRY_ETHEREUM,
          pair:FRAXLEND_PAIR_SFRXETH_USDC,
          deployer,
          asset,
          collateral
        },
        registry:{pairCount:registryPairs.length,pairMembershipProven:true},
        decimals:{fToken:pairDecimals,asset:assetDecimals,collateral:collateralDecimals},
        raw:{
          totalAssetAmount:totalAssetAmount.toString(),
          totalAssetShares:totalAssetShares.toString(),
          totalBorrowAmount:totalBorrowAmount.toString(),
          totalBorrowShares:totalBorrowShares.toString(),
          totalCollateral:totalCollateralRaw.toString(),
          utilization:utilizationRaw.toString(),
          feeToProtocolRate:feeToProtocolRate.toString(),
          ratePerSec:ratePerSec.toString(),
          fullUtilizationRate:fullUtilizationRate.toString(),
          pricePerShare:pricePerShareRaw.toString(),
          rateLastTimestamp:lastTimestamp.toString()
        },
        precisions:{
          ltv:ltvPrecision.toString(),liq:liqPrecision.toString(),utilization:utilPrecision.toString(),
          fee:feePrecision.toString(),exchange:exchangePrecision.toString(),deviation:deviationPrecision.toString(),
          rate:ratePrecision.toString(),maxProtocolFee:maxProtocolFee.toString()
        },
        values:{
          totalAsset:round(totalAsset,8),
          totalBorrow:round(totalBorrow,8),
          totalCollateral:round(totalCollateral,8),
          utilizationPct:round(utilizationPct,8),
          borrowRatePerSecond:round(borrowRatePerSecond,18),
          borrowRatePerSecondPct:round(borrowRatePerSecond*100,18),
          fullUtilizationRatePerSecond:round(fullUtilizationRatePerSecond,18),
          protocolFeePct:round(protocolFeePct,8),
          fTokenSharePriceAsset:round(pricePerShareAsset,12),
          accountingSharePriceAsset:round(accountingSharePrice,12),
          sharePriceParityDelta:round(sharePriceDelta,15)
        },
        identity:{
          pair:'official Frax mainnet FRAXLEND_PAIR_SFRXETH_USDC',
          asset:'USDC',
          collateral:'sfrxETH',
          utilizationFormula:'floor(UTIL_PREC * totalBorrowAmount / totalAssetAmount), matching FraxlendPairCore',
          borrowRateState:'currentRateInfo.ratePerSec / RATE_PRECISION; no annualization performed',
          fTokenSharePriceFormula:'previewed totalAssetAmount / totalAssetShares, parity checked against pricePerShare()/1e18',
          historyRule:'persisted adjacent Economic Graph pair checkpoints only; no pre-tracking or APY backfill'
        },
        provenance:{
          officialConstantsRepository:'FraxFinance/frax-template',
          officialConstantsRef:OFFICIAL_FRAX_CONSTANTS_REF,
          registryIdentity:'FRAXLEND_PAIR_REGISTRY_ADDRESS',
          pairIdentity:'FRAXLEND_PAIR_SFRXETH_USDC',
          deployerIdentity:'FRAXLEND_PAIR_DEPLOYER_V4_ADDRESS',
          contractSemanticsRepository:'FraxFinance/fraxlend'
        },
        rpc:{endpointId:endpoint.id,failoverAttempts:attempts},
        epistemic:{
          sourceType:'onchain-public-rpc-exact-block',
          currentStateMeasured:true,
          currentStateScope:'single-canonical-Fraxlend-pair-pilot',
          registryMembership:'PROVEN-current-exact-block',
          pairIdentity:'PROVEN-official-constants-plus-onchain-deployer-and-assets',
          utilizationMechanicalIdentity:'PROVEN-current-exact-block',
          borrowRateState:'MEASURED-current-stored-rate-state',
          borrowRateModelReproduction:'NOT-YET-REPRODUCED',
          fTokenSharePriceMechanicalIdentity:'PROVEN-current-exact-block',
          historicalBackfill:false,
          unknownIsZero:false,
          annualizationPerformed:false,
          protocolWideAprClaim:false,
          lenderRealizedIncomeClaim:false,
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
  const previous=previousState?.protocolEvidence?.[FRAX_ECOSYSTEM_EVIDENCE_ID]?.latest?.observation?.surfaces?.fraxlend?.measured;
  return previous?.status==='ok'&&finite(previous?.values?.fTokenSharePriceAsset)?previous:null;
}

export function buildFraxlendSharePriceInterval({previousState,current}){
  if(current?.status!=='ok'||!finite(current?.values?.fTokenSharePriceAsset))return {
    status:'UNKNOWN-current-measurement-unavailable',accepted:false,startAt:null,endAt:current?.observedAt||null,embeddedYieldPct:null
  };
  const previous=previousMeasuredSurface(previousState);
  if(!previous)return {
    status:'warming-first-onchain-checkpoint',accepted:false,startAt:null,endAt:current.observedAt,embeddedYieldPct:null,
    source:'persisted-adjacent-economic-graph-fraxlend-pair-checkpoints'
  };
  if(previous.chain!==current.chain||!sameAddress(previous.contracts?.pair,current.contracts?.pair))return {
    status:'UNKNOWN-identity-mismatch',accepted:false,startAt:previous.observedAt,endAt:current.observedAt,embeddedYieldPct:null
  };
  const startMs=Date.parse(previous.observedAt),endMs=Date.parse(current.observedAt);
  const startBlock=Number(previous.blockNumber),endBlock=Number(current.blockNumber);
  if(!Number.isFinite(startMs)||!Number.isFinite(endMs)||!(endMs>startMs)||!Number.isFinite(startBlock)||!Number.isFinite(endBlock)||!(endBlock>startBlock))return {
    status:'warming-no-new-independent-block',accepted:false,startAt:previous.observedAt,endAt:current.observedAt,embeddedYieldPct:null
  };
  const start=Number(previous.values.fTokenSharePriceAsset),end=Number(current.values.fTokenSharePriceAsset);
  if(!(start>0)||!(end>0))return {status:'UNKNOWN-invalid-share-price',accepted:false,startAt:previous.observedAt,endAt:current.observedAt,embeddedYieldPct:null};
  return {
    status:'ok',accepted:true,source:'persisted-adjacent-economic-graph-fraxlend-pair-checkpoints',
    startAt:previous.observedAt,endAt:current.observedAt,elapsedSeconds:Math.round((endMs-startMs)/1000),
    startBlock,endBlock,startSharePriceAsset:round(start,12),endSharePriceAsset:round(end,12),
    embeddedYieldPct:round((end/start-1)*100,12),annualizedApyPct:null,
    annualizationState:'NOT-CALCULATED-no-annualization-methodology-added',
    accountingIdentity:'ending fToken share price / beginning fToken share price - 1',
    note:'Direct interval pair share-price return only. It is not protocol-wide Fraxlend APR or realized lender income.'
  };
}

export function applyFraxFraxlendOnchainMeasurement({state,previousState,measurement}){
  if(!state||typeof state!=='object')throw new Error('Frax Fraxlend adapter requires Economic Graph state');
  if(state?.authority?.executionAuthority!=='none'||state?.authority?.causalClaimAuthority!=='none')throw new Error('Frax Fraxlend adapter refuses Graph authority drift');
  const evidence=state?.protocolEvidence?.[FRAX_ECOSYSTEM_EVIDENCE_ID];
  const baseCurrent=evidence?.latest?.observation;
  const fraxSensor=state?.protocolSensors?.[FRAX_PROTOCOL_ID];
  if(!evidence||!baseCurrent||!fraxSensor)throw new Error('Frax ecosystem evidence missing before Fraxlend enrichment');
  const current=structuredClone(baseCurrent);
  const surface=current?.surfaces?.fraxlend;
  if(!surface)throw new Error('Fraxlend surface missing');

  const valid=measurement?.status==='ok'&&measurement?.measurementClass==='MEASURED'&&measurement?.registry?.pairMembershipProven===true&&finite(measurement?.values?.utilizationPct)&&finite(measurement?.values?.fTokenSharePriceAsset);
  if(valid){
    const interval=buildFraxlendSharePriceInterval({previousState,current:measurement});
    surface.measurementState='MEASURED-current-onchain-pair-pilot';
    surface.measured={...measurement,intervalEmbeddedYield:interval};
    surface.mechanicalRelations=surface.mechanicalRelations.map(relation=>{
      if(relation.to==='utilization')return {...relation,class:'MECHANICAL-proven-current-exact-block'};
      if(relation.to==='borrow rate')return {...relation,class:'MEASURED-current-rate-state-model-not-reproduced'};
      if(relation.to==='fToken share price')return {...relation,class:'MECHANICAL-proven-current-exact-block'};
      return relation;
    });
  }else{
    surface.measurementState='UNKNOWN-current-onchain-read-unavailable';
    surface.measured={...unknownMeasurement(measurement?.rpc?.failoverAttempts||[],measurement?.status||'UNKNOWN-current-onchain-read-unavailable')};
  }

  const surfaces=Object.values(current.surfaces||{});
  current.coverage.measuredSurfaceCount=surfaces.filter(x=>String(x.measurementState||'').startsWith('MEASURED')).length;
  current.coverage.sourceBoundUnknownSurfaceCount=surfaces.length-current.coverage.measuredSurfaceCount;
  current.relationshipGraph=surfaces.flatMap(s=>s.mechanicalRelations.map((relation,index)=>({surfaceId:s.id,index,...relation})));
  current.coverage.relationshipCount=current.relationshipGraph.length;
  current.coverage.relationshipClassCounts=current.relationshipGraph.reduce((acc,relation)=>{
    const key=String(relation.class||'UNKNOWN').split('-')[0];
    acc[key]=(acc[key]||0)+1;
    return acc;
  },{});
  current.status=current.coverage.sourceBoundUnknownSurfaceCount===0?'deep-sensor-family-fully-measured':'deep-sensor-family-active-partial-measurement';
  current.epistemic.measuredEconomicSurfaces=surfaces.filter(x=>String(x.measurementState||'').startsWith('MEASURED')).map(x=>x.id);
  current.epistemic.fraxlendCurrentState=valid?'MEASURED-pair-pilot':'UNKNOWN';
  current.epistemic.fraxlendUtilization=valid?'DERIVED-MECHANICAL':'UNKNOWN';
  current.epistemic.fraxlendBorrowRate=valid?'MEASURED-current-rate-state':'UNKNOWN';
  current.epistemic.fraxlendRateModelCausality='UNKNOWN-not-reproduced';
  current.epistemic.fraxlendFTokenEmbeddedYield=valid?(surface.measured.intervalEmbeddedYield.accepted?'DERIVED-MECHANICAL':'WARMING'):'UNKNOWN';
  current.measurementExtensions={...(current.measurementExtensions||{}),fraxlendOnchain:FRAX_FRAXLEND_ONCHAIN_VERSION};
  current.nextMeasurementUnlocks=(current.nextMeasurementUnlocks||[]).map(item=>String(item).startsWith('Enumerate Fraxlend Pair Registry')
    ? 'Fraxlend official Pair Registry identity and one canonical pair are now measured; expand registry coverage only after the pair schema remains stable.'
    : item);

  current.id=`frax-ecosystem:${sha256(stableStringify({
    baseVersion:current.version,
    governance:current.surfaces?.governanceVeFrax?.measured||null,
    sfrxUsd:current.surfaces?.frxUsdSfrxUsd?.measured?.status==='ok'?{
      blockNumber:current.surfaces.frxUsdSfrxUsd.measured.blockNumber,
      blockHash:current.surfaces.frxUsdSfrxUsd.measured.blockHash,
      sharePriceFrxUsd:current.surfaces.frxUsdSfrxUsd.measured.values?.sharePriceFrxUsd
    }:{status:current.surfaces?.frxUsdSfrxUsd?.measurementState||'UNKNOWN'},
    fraxlend:valid?{
      pair:measurement.contracts.pair,
      blockNumber:measurement.blockNumber,
      blockHash:measurement.blockHash,
      utilizationPct:measurement.values.utilizationPct,
      fTokenSharePriceAsset:measurement.values.fTokenSharePriceAsset,
      ratePerSec:measurement.raw.ratePerSec
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
  evidence.measurementExtensions={...(evidence.measurementExtensions||{}),fraxlendOnchain:FRAX_FRAXLEND_ONCHAIN_VERSION};

  fraxSensor.ecosystemFamily={
    ...(fraxSensor.ecosystemFamily||{}),
    status:current.status,
    measuredSurfaceCount:current.coverage.measuredSurfaceCount,
    sourceBoundUnknownSurfaceCount:current.coverage.sourceBoundUnknownSurfaceCount,
    latestObservationId:current.id,
    measurementExtensions:{...(fraxSensor.ecosystemFamily?.measurementExtensions||{}),fraxlendOnchain:FRAX_FRAXLEND_ONCHAIN_VERSION}
  };
  if(fraxSensor?.latest?.observation)fraxSensor.latest.observation.ecosystemFamily=fraxSensor.ecosystemFamily;

  if(current.coverage.surfaceCount!==9)throw new Error('Frax ecosystem surface count drift');
  if(current.coverage.relationshipCount!==current.relationshipGraph.length)throw new Error('Frax relationship graph count drift');
  const sfrxMeasured=String(current.surfaces?.frxUsdSfrxUsd?.measurementState||'').startsWith('MEASURED');
  const expectedMeasured=(sfrxMeasured?2:1)+(valid?1:0);
  if(current.coverage.measuredSurfaceCount!==expectedMeasured)throw new Error(`Fraxlend measurement coverage drift: expected ${expectedMeasured}, got ${current.coverage.measuredSurfaceCount}`);
  if(valid&&current.coverage.sourceBoundUnknownSurfaceCount!==9-expectedMeasured)throw new Error('Fraxlend UNKNOWN coverage drift');
  if(current?.authority?.executionAuthority!=='none'||current?.epistemic?.executionAuthority!=='none')throw new Error('Frax Fraxlend execution authority leaked');
  return state;
}
