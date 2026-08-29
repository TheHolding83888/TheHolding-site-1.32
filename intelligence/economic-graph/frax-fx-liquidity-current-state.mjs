#!/usr/bin/env node
/**
 * The Holding · Frax FX-liquidity current-state adapter v0.1
 *
 * Frax-specific config/mapping around the reusable constant-product asset
 * liquidity collector. The measured scope is intentionally partial: current
 * Fraxtal Fraxswap pairs containing canonical frxUSD and their exact-block raw
 * reserves. It does not pretend all counterpart assets are tokenized currencies
 * and does not infer USD TVL, volume, fees, incentives or capital migration.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectConstantProductAssetLiquidity, CONSTANT_PRODUCT_ASSET_LIQUIDITY_VERSION } from './constant-product-asset-liquidity.mjs';
import { FRAXTAL_CHAIN_ID, FRAXTAL_RPC_ENDPOINTS, FRAXSWAP_FACTORY_FRAXTAL } from './frax-bamm-onchain.mjs';
import { FRAX_ECOSYSTEM_EVIDENCE_ID, FRAX_PROTOCOL_ID } from './frax-ecosystem-sensor.mjs';

export const FRAX_FX_LIQUIDITY_VERSION='0.1-fraxtal-frxusd-fraxswap-liquidity-partial';
export const FRXUSD_FRAXTAL='0xfc00000000000000000000000000000000000001';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const REGISTRY_FILE=path.join(ROOT,'intelligence/economic-graph/frax-fx-liquidity-registry.json');
const MAX_OBSERVATIONS=1000;

function readJson(file){return JSON.parse(fs.readFileSync(file,'utf8'));}
function normalizeAddress(v){return String(v||'').toLowerCase();}
function sameAddress(a,b){return normalizeAddress(a)===normalizeAddress(b);}
function sha256(v){return crypto.createHash('sha256').update(String(v)).digest('hex');}
function stableValue(v){if(Array.isArray(v))return v.map(stableValue);if(v&&typeof v==='object')return Object.fromEntries(Object.keys(v).sort().map(k=>[k,stableValue(v[k])]));return v;}
function stableStringify(v){return JSON.stringify(stableValue(v));}

function loadConfig(config){
  const x=config||readJson(REGISTRY_FILE);
  if(x?.version!=='0.1-frax-fx-liquidity-registry'||x?.adapter!=='constant-product-v2-factory')throw new Error('Frax FX liquidity registry version/adapter drift');
  if(x?.network?.name!=='fraxtal'||Number(x?.network?.chainId)!==FRAXTAL_CHAIN_ID)throw new Error('Frax FX liquidity network drift');
  if(!sameAddress(x?.factory?.address,FRAXSWAP_FACTORY_FRAXTAL)||!sameAddress(x?.baseAsset?.address,FRXUSD_FRAXTAL)||Number(x?.baseAsset?.decimals)!==18)throw new Error('Frax FX liquidity factory/base identity drift');
  if(x?.scope?.surface!=='fxLiquidity'||x?.scope?.partial!==true||x?.scope?.doesNotAssertAllCounterAssetsAreTokenizedCurrencies!==true)throw new Error('Frax FX liquidity scope boundary drift');
  const s=x?.semantics||{};
  if(s.configIsSourceBoundTopology!==true||s.configIsLiveMeasurement!==false||s.fullFactoryRegistryRequired!==true||s.sameBaseAssetReserveMayBeAggregated!==true||s.counterpartUnitsAggregated!==false||s.usdValuationPerformed!==false||s.volumeMeasured!==false||s.feesMeasured!==false||s.incentivesMeasured!==false||s.capitalMigrationMeasured!==false||s.pairPresenceIsNotCapitalFlow!==true||s.reserveChangeIsNotCapitalMigrationWithoutTransactionIdentity!==true||s.unknownIsZero!==false||s.causalClaimAuthority!=='none'||s.recommendationAuthority!=='none'||s.executionAuthority!=='none')throw new Error('Frax FX liquidity epistemic/authority boundary drift');
  return x;
}
function unavailable(config,error){return {
  version:FRAX_FX_LIQUIDITY_VERSION,collectorVersion:CONSTANT_PRODUCT_ASSET_LIQUIDITY_VERSION,status:'UNKNOWN-frax-fx-liquidity-unavailable',measurementClass:'UNKNOWN',observedAt:null,
  network:{name:'fraxtal',chainId:FRAXTAL_CHAIN_ID},factory:config?.factory||null,baseAsset:config?.baseAsset||null,pairs:[],summary:{factoryPairCount:null,matchingPairCount:null,totalBaseReserveRaw:null},
  provenance:{registryVersion:config?.version||null,source:config?.source||null},rpc:{endpointId:null,failoverAttempts:[{scope:'adapter',error:error?.message||String(error)}]},
  edges:[{from:'Fraxswap pair registry',to:'frxUSD exchange-liquidity state',class:'UNKNOWN'}],
  epistemic:{scope:'PARTIAL-fraxtal-fraxswap-frxusd-only',allCounterAssetsAreTokenizedCurrencies:false,usdTvl:'UNKNOWN-not-valued',volume:'UNKNOWN-not-measured',fees:'UNKNOWN-not-measured',incentives:'UNKNOWN-not-measured',priceDeviation:'UNKNOWN-not-measured',capitalMigration:'UNKNOWN-not-measured',pairPresenceIsCapitalFlow:false,counterpartUnitsAggregated:false,unknownIsZero:false,causalClaimAuthority:'none',recommendationAuthority:'none',executionAuthority:'none'}
};}

export async function collectFraxFxLiquidityCurrentState({config=null,fetchImpl=fetch,endpointsOverride=null,checkpoint=null}={}){
  let cfg;try{cfg=loadConfig(config);}catch(error){return unavailable(config,error);}
  const base=await collectConstantProductAssetLiquidity({config:cfg,fetchImpl,endpoints:endpointsOverride||FRAXTAL_RPC_ENDPOINTS,checkpoint});
  if(base?.status!=='ok'||base?.measurementClass!=='MEASURED')return {...unavailable(cfg,new Error(base?.status||'generic collector unavailable')),rpc:base?.rpc||null,collectorMeasurement:base};
  const valid=base.network?.chainId===FRAXTAL_CHAIN_ID&&sameAddress(base.factory?.address,FRAXSWAP_FACTORY_FRAXTAL)&&sameAddress(base.baseAsset?.address,FRXUSD_FRAXTAL)&&Number(base.summary?.matchingPairCount)>0&&base.epistemic?.usdValuationPerformed===false&&base.epistemic?.counterpartUnitsAggregated===false&&base.epistemic?.executionAuthority==='none';
  if(!valid)return unavailable(cfg,new Error('Generic liquidity measurement identity/semantic proof failed'));
  return {
    ...base,
    version:FRAX_FX_LIQUIDITY_VERSION,
    collectorVersion:CONSTANT_PRODUCT_ASSET_LIQUIDITY_VERSION,
    provenance:{registryVersion:cfg.version,source:cfg.source,genericCollectorVersion:CONSTANT_PRODUCT_ASSET_LIQUIDITY_VERSION},
    scope:{...cfg.scope,measuredPairSelection:'all-current-Fraxtal-Fraxswap-pairs-containing-frxUSD'},
    edges:[
      {from:'source-bound Fraxswap Factory + exact-block allPairs registry',to:'all current Fraxtal Fraxswap pair identities',class:'MEASURED-exact-block'},
      {from:'pair token0/token1 identity',to:'frxUSD-containing pair selection',class:'MECHANICAL-exact-address-membership'},
      {from:'pair getReserves()',to:'pair-local frxUSD and counterpart reserve units',class:'MEASURED-exact-block'},
      {from:'same-asset frxUSD reserves',to:'aggregate frxUSD reserve units across selected pairs',class:'DERIVED-MECHANICAL-safe-same-asset-sum'},
      {from:'frxUSD-containing pair presence',to:'tokenized-currency / FX classification',class:'UNKNOWN-counterpart-address-not-economic-classification'},
      {from:'pair reserves',to:'USD TVL',class:'UNKNOWN-counterpart-not-valued'},
      {from:'pair liquidity/reserve change',to:'capital migration',class:'UNKNOWN-no-transaction/address-flow-proof'}
    ],
    epistemic:{
      ...base.epistemic,
      scope:'MEASURED-partial-fraxtal-fraxswap-frxusd-registry',
      allCounterAssetsAreTokenizedCurrencies:false,
      pairPresenceIsCapitalFlow:false,
      reserveChangeIsCapitalMigration:false,
      usdTvl:'UNKNOWN-not-valued-by-this-atom',volume:'UNKNOWN-not-measured-by-this-atom',fees:'UNKNOWN-not-measured-by-this-atom',incentives:'UNKNOWN-not-measured-by-this-atom',priceDeviation:'UNKNOWN-not-measured-by-this-atom',capitalMigration:'UNKNOWN-not-measured-by-this-atom',
      causalClaimAuthority:'none',recommendationAuthority:'none',executionAuthority:'none'
    }
  };
}

export function applyFraxFxLiquidityCurrentState({state,previousState,measurement}){
  if(!state||typeof state!=='object')throw new Error('Frax FX liquidity adapter requires Economic Graph state');
  if(state?.authority?.executionAuthority!=='none'||state?.authority?.causalClaimAuthority!=='none')throw new Error('Frax FX liquidity adapter refuses Graph authority drift');
  const evidence=state?.protocolEvidence?.[FRAX_ECOSYSTEM_EVIDENCE_ID],base=evidence?.latest?.observation,fraxSensor=state?.protocolSensors?.[FRAX_PROTOCOL_ID];
  if(!evidence||!base||!fraxSensor)throw new Error('Frax ecosystem evidence missing before FX liquidity enrichment');
  const current=structuredClone(base),surface=current?.surfaces?.fxLiquidity;if(!surface)throw new Error('Frax FX liquidity surface missing');
  const valid=measurement?.status==='ok'&&measurement?.measurementClass==='MEASURED'&&Number(measurement?.summary?.matchingPairCount)>0&&measurement?.epistemic?.usdValuationPerformed===false&&measurement?.epistemic?.counterpartUnitsAggregated===false&&measurement?.epistemic?.pairPresenceIsCapitalFlow===false&&measurement?.epistemic?.executionAuthority==='none';
  surface.measured=measurement;
  surface.measurementState=valid?'MEASURED-current-fraxtal-frxusd-fraxswap-registry-partial':'UNKNOWN-current-value-not-ingested';
  surface.mechanicalRelations=[
    {from:'exact-block Fraxswap Factory registry',to:'current Fraxtal pair topology',class:valid?'MEASURED-exact-block':'UNKNOWN'},
    {from:'pair token identity',to:'frxUSD-containing pair selection',class:valid?'MECHANICAL-exact-address-membership':'UNKNOWN'},
    {from:'pair getReserves()',to:'pair-local frxUSD/counter reserve units',class:valid?'MEASURED-exact-block':'UNKNOWN'},
    {from:'same-asset frxUSD reserves',to:'aggregate frxUSD reserve units',class:valid?'DERIVED-MECHANICAL-safe-same-asset-sum':'UNKNOWN'},
    {from:'frxUSD pair presence',to:'tokenized-currency / FX classification',class:'UNKNOWN-counterpart-not-classified'},
    {from:'pair reserves',to:'USD TVL',class:'UNKNOWN-counterpart-not-valued'},
    {from:'liquidity change',to:'capital migration',class:'UNKNOWN-no-transaction/address-flow-proof'}
  ];
  current.measurementExtensions={...(current.measurementExtensions||{}),fxLiquidityCurrent:FRAX_FX_LIQUIDITY_VERSION,constantProductAssetLiquidity:CONSTANT_PRODUCT_ASSET_LIQUIDITY_VERSION};
  current.epistemic={...(current.epistemic||{}),fxLiquidityCurrentState:valid?'MEASURED-partial-fraxtal-frxusd-fraxswap-registry':'UNKNOWN',fxLiquidityUsdTvl:'UNKNOWN-not-valued-by-this-atom',fxLiquidityVolume:'UNKNOWN-not-measured-by-this-atom',fxLiquidityFees:'UNKNOWN-not-measured-by-this-atom',fxLiquidityIncentives:'UNKNOWN-not-measured-by-this-atom',fxLiquidityCapitalMigration:'UNKNOWN-no-flow-proof'};
  const surfaces=Object.values(current.surfaces||{}),measured=surfaces.filter(s=>String(s.measurementState||'').startsWith('MEASURED'));
  current.coverage.measuredSurfaceCount=measured.length;current.coverage.sourceBoundUnknownSurfaceCount=surfaces.length-measured.length;
  current.relationshipGraph=surfaces.flatMap(s=>(s.mechanicalRelations||[]).map((r,index)=>({surfaceId:s.id,index,...r})));current.coverage.relationshipCount=current.relationshipGraph.length;
  current.coverage.relationshipClassCounts=current.relationshipGraph.reduce((acc,row)=>{const key=String(row.class||'UNKNOWN').split('-')[0];acc[key]=(acc[key]||0)+1;return acc;},{});
  current.id=`frax-ecosystem:${sha256(stableStringify({priorId:base.id,fxLiquidity:valid?{blockNumber:measurement.network.blockNumber,blockHash:measurement.network.blockHash,matchingPairCount:measurement.summary.matchingPairCount,totalBaseReserveRaw:measurement.summary.totalBaseReserveRaw}:{status:measurement?.status||'UNKNOWN'},surfaceIds:current.coverage.surfaceIds})).slice(0,24)}`;
  const previousRows=Array.isArray(previousState?.protocolEvidence?.[FRAX_ECOSYSTEM_EVIDENCE_ID]?.observations)?previousState.protocolEvidence[FRAX_ECOSYSTEM_EVIDENCE_ID].observations:[],rows=[...previousRows];if(!rows.some(row=>row?.id===current.id))rows.push(current);
  evidence.latest={observation:current};evidence.status=current.status;evidence.observations=rows.slice(-MAX_OBSERVATIONS);evidence.observationCount=evidence.observations.length;evidence.measurementExtensions={...(evidence.measurementExtensions||{}),fxLiquidityCurrent:FRAX_FX_LIQUIDITY_VERSION,constantProductAssetLiquidity:CONSTANT_PRODUCT_ASSET_LIQUIDITY_VERSION};
  fraxSensor.ecosystemFamily={...(fraxSensor.ecosystemFamily||{}),status:current.status,measuredSurfaceCount:current.coverage.measuredSurfaceCount,sourceBoundUnknownSurfaceCount:current.coverage.sourceBoundUnknownSurfaceCount,latestObservationId:current.id,measurementExtensions:{...(fraxSensor.ecosystemFamily?.measurementExtensions||{}),fxLiquidityCurrent:FRAX_FX_LIQUIDITY_VERSION,constantProductAssetLiquidity:CONSTANT_PRODUCT_ASSET_LIQUIDITY_VERSION}};if(fraxSensor?.latest?.observation)fraxSensor.latest.observation.ecosystemFamily=fraxSensor.ecosystemFamily;
  if(current.coverage.measuredSurfaceCount+current.coverage.sourceBoundUnknownSurfaceCount!==current.coverage.surfaceCount)throw new Error('Frax FX liquidity depth accounting drift');
  if(valid&&(!/^\d+$/.test(String(measurement?.summary?.totalBaseReserveRaw||''))||Number(measurement?.summary?.matchingPairCount)<1))throw new Error('Frax FX liquidity reserve invariant drift');
  if(valid&&(measurement.epistemic?.usdValuationPerformed!==false||measurement.epistemic?.counterpartUnitsAggregated!==false||measurement.epistemic?.pairPresenceIsCapitalFlow!==false))throw new Error('Frax FX liquidity epistemic boundary drift');
  if(current?.authority?.executionAuthority!=='none'||current?.epistemic?.executionAuthority!=='none'||measurement?.epistemic?.executionAuthority!=='none')throw new Error('Frax FX liquidity execution authority leaked');
  return state;
}
