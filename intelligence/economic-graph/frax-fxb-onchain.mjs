#!/usr/bin/env node
/**
 * The Holding · Frax FXB current origin-series exact-block sensor v0.2
 *
 * Measures every current source-bound FXB origin contract from the config
 * registry across Ethereum and Fraxtal. Legacy series and bridged mirrors are
 * excluded from current completeness and are never double-counted as backing.
 *
 * Proven current state per origin series:
 * - redemption-token identity via token(), common to current FXB v1.2/v2 source;
 * - maturity timestamp and current redeemability;
 * - total minted, total redeemed, and total supply accounting identity;
 * - Legacy Frax Dollar held by the origin FXB contract against outstanding FXB.
 *
 * Spot / auction price and implied term yield remain a separate atom.
 * UNKNOWN is never zero.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FRAXTAL_CHAIN_ID, FRAXTAL_RPC_ENDPOINTS } from './frax-bamm-onchain.mjs';
import { FRAX_ECOSYSTEM_EVIDENCE_ID, FRAX_PROTOCOL_ID } from './frax-ecosystem-sensor.mjs';

export const FRAX_FXB_ONCHAIN_VERSION='0.2-frax-fxb-current-origin-series-token-identity';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const SERIES_REGISTRY_FILE=path.join(ROOT,'intelligence/economic-graph/frax-fxb-series-registry.json');
const RPC_REGISTRY_FILE=path.join(ROOT,'intelligence/market-data/onchain-price-source-registry.json');
const RPC_TIMEOUT_MS=12_000;
const MAX_OBSERVATIONS=1000;
const E18=10n**18n;

function sha256(value){return crypto.createHash('sha256').update(value).digest('hex');}
function stableValue(value){if(Array.isArray(value))return value.map(stableValue);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(k=>[k,stableValue(value[k])]));return value;}
function stableStringify(value){return JSON.stringify(stableValue(value));}
function normalizeAddress(v){return String(v||'').toLowerCase();}
function sameAddress(a,b){return normalizeAddress(a)===normalizeAddress(b);}
function asciiHex(value){return `0x${Buffer.from(value,'utf8').toString('hex')}`;}
function addrArg(v){return normalizeAddress(v).replace(/^0x/,'').padStart(64,'0');}
function rpcQuantity(v){if(!/^0x[0-9a-f]+$/i.test(String(v||'')))throw new Error('Invalid RPC quantity');return BigInt(v);}
function cleanAbi(hex){const x=String(hex||'').replace(/^0x/,'');if(!x.length||x.length%64!==0||!/^[0-9a-f]+$/i.test(x))throw new Error('Invalid ABI result');return x;}
function words(hex){const x=cleanAbi(hex),out=[];for(let i=0;i<x.length;i+=64)out.push(BigInt(`0x${x.slice(i,i+64)}`));return out;}
function word(hex){const out=words(hex);if(!out.length)throw new Error('Missing ABI word');return out[0];}
function addressWord(hex){const x=cleanAbi(hex);return `0x${x.slice(24,64)}`;}
function units18(v){const n=BigInt(v),whole=n/E18,frac=(n%E18).toString().padStart(18,'0').replace(/0+$/,'');return `${whole}${frac?'.'+frac:''}`;}
function ratio18(n,d){if(BigInt(d)===0n)return null;return units18(BigInt(n)*E18/BigInt(d));}
function readJson(file){return JSON.parse(fs.readFileSync(file,'utf8'));}

async function postBatch(url,payload,fetchImpl){
  const response=await fetchImpl(url,{method:'POST',headers:{'content-type':'application/json',accept:'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(RPC_TIMEOUT_MS)});
  if(!response.ok)throw new Error(`RPC HTTP ${response.status}`);
  const body=await response.json();
  if(!Array.isArray(body))throw new Error('RPC response is not an array');
  const byId=new Map(body.map(r=>[Number(r?.id),r]));
  for(const req of payload){
    const r=byId.get(req.id);
    if(!r)throw new Error(`RPC result ${req.id} missing`);
    if(r.error)throw new Error(`RPC ${req.method} error: ${r.error?.message||'unknown'}`);
    if(r.result===undefined||r.result===null)throw new Error(`RPC ${req.method} result missing`);
  }
  return byId;
}

function loadConfig(config){
  const x=config||readJson(SERIES_REGISTRY_FILE);
  if(x?.version!=='0.2-frax-fxb-series-registry-current-subprotocol-source'||x?.semantics?.executionAuthority!=='none'||x?.semantics?.originOnlyBackingMeasurement!==true||x?.semantics?.currentSeriesOnly!==true||x?.semantics?.legacySeriesExcludedFromCurrentCoverage!==true||x?.semantics?.redemptionAssetIdentityFunction!=='token()')throw new Error('FXB series registry identity drift');
  if(!Array.isArray(x.series)||!x.series.length)throw new Error('FXB series registry empty');
  if(new Set(x.series.map(s=>s.id)).size!==x.series.length)throw new Error('FXB current series duplicate identity');
  if(x.series.some(s=>!s?.originNetwork||!/^0x[0-9a-f]{40}$/i.test(String(s?.originAddress||''))))throw new Error('FXB current series source identity incomplete');
  return x;
}
function loadEndpoints(config,rpcRegistry){
  const registry=rpcRegistry||readJson(RPC_REGISTRY_FILE);
  const eth=registry?.networks?.ethereum;
  const ethereum=Number(eth?.chainId)===1&&Array.isArray(eth?.rpcFailover)?eth.rpcFailover:[];
  const fraxtal=FRAXTAL_RPC_ENDPOINTS;
  if(!ethereum.length||!Array.isArray(fraxtal)||!fraxtal.length)throw new Error('FXB required RPC endpoints unavailable');
  if(Number(config?.networks?.ethereum?.chainId)!==1||Number(config?.networks?.fraxtal?.chainId)!==FRAXTAL_CHAIN_ID)throw new Error('FXB registry chain identity drift');
  return {ethereum,fraxtal};
}
function unknown({attempts,reason='UNKNOWN-fxb-origin-series-read-failed',config=null,networkResults={}}={}){
  return {
    version:FRAX_FXB_ONCHAIN_VERSION,status:reason,measurementClass:'UNKNOWN',observedAt:null,
    series:[],coverage:{configuredOriginSeriesCount:Array.isArray(config?.series)?config.series.length:null,measuredOriginSeriesCount:0,unresolvedDocumentedSeriesCount:Array.isArray(config?.documentedUnresolvedSeries)?config.documentedUnresolvedSeries.length:null,fullConfiguredOriginSeriesCoverage:false},
    rpc:{networks:networkResults,failoverAttempts:attempts||[]},
    provenance:{seriesRegistryVersion:config?.version||null,officialSources:config?.officialSources||null},
    epistemic:{originSeriesState:'UNKNOWN',originBacking:'UNKNOWN',mintRedeemSupplyIdentity:'UNKNOWN',spotPrice:'UNKNOWN-not-measured-by-this-atom',impliedYield:'UNKNOWN-no-measured-price',bridgedMirrorBacking:'UNKNOWN-not-independent-origin-backing',legacySeriesState:'HISTORICAL-not-current-completeness',unknownIsZero:false,causalClaimAuthority:'none',executionAuthority:'none'}
  };
}

async function collectNetwork({network,networkConfig,endpoints,series,fetchImpl}){
  const attempts=[];
  for(const endpoint of endpoints){
    try{
      const signatures=['token()','MATURITY_TIMESTAMP()','totalSupply()','totalFxbMinted()','totalFxbRedeemed()','isRedeemable()','balanceOf(address)'];
      const sigReq=signatures.map((s,i)=>({jsonrpc:'2.0',id:i+1,method:'web3_sha3',params:[asciiHex(s)]}));
      sigReq.push({jsonrpc:'2.0',id:100,method:'eth_blockNumber',params:[]});
      const first=await postBatch(endpoint.url,sigReq,fetchImpl);
      const hashes=new Map(signatures.map((s,i)=>[s,String(first.get(i+1).result).toLowerCase()]));
      for(const [s,h] of hashes)if(!/^0x[0-9a-f]{64}$/.test(h))throw new Error(`FXB selector hash failed ${s}`);
      const blockNumber=rpcQuantity(first.get(100).result),blockTag=`0x${blockNumber.toString(16)}`;
      const blockReq=await postBatch(endpoint.url,[{jsonrpc:'2.0',id:101,method:'eth_getBlockByNumber',params:[blockTag,false]}],fetchImpl);
      const block=blockReq.get(101).result;
      if(!block||String(block.number||'').toLowerCase()!==blockTag.toLowerCase()||!/^0x[0-9a-f]{64}$/i.test(String(block.hash||'')))throw new Error('FXB exact block identity unavailable');
      const blockTimestamp=Number(rpcQuantity(block.timestamp));
      const selector=s=>hashes.get(s).slice(0,10),call=(id,to,data)=>({jsonrpc:'2.0',id,method:'eth_call',params:[{to,data},blockTag]});
      const out=[];
      for(const s of series){
        try{
          let id=1000;
          const names=['token()','MATURITY_TIMESTAMP()','totalSupply()','totalFxbMinted()','totalFxbRedeemed()','isRedeemable()'];
          const ids=Object.fromEntries(names.map(name=>[name,id++]));
          ids.backing=id++;
          const requests=names.map(name=>call(ids[name],s.originAddress,selector(name)));
          requests.push(call(ids.backing,networkConfig.lFrax,selector('balanceOf(address)')+addrArg(s.originAddress)));
          const rows=await postBatch(endpoint.url,requests,fetchImpl);
          const redemptionToken=addressWord(rows.get(ids['token()']).result),maturity=word(rows.get(ids['MATURITY_TIMESTAMP()']).result),supply=word(rows.get(ids['totalSupply()']).result),minted=word(rows.get(ids['totalFxbMinted()']).result),redeemed=word(rows.get(ids['totalFxbRedeemed()']).result),redeemable=word(rows.get(ids['isRedeemable()']).result)!==0n,backing=word(rows.get(ids.backing).result);
          const identityOk=sameAddress(redemptionToken,networkConfig.lFrax),supplyIdentityOk=minted>=redeemed&&minted-redeemed===supply,redeemabilityIdentityOk=redeemable===(BigInt(blockTimestamp)>=maturity),backingDeficit=backing>=supply?0n:supply-backing;
          if(!identityOk)throw new Error(`LFRAX identity mismatch ${redemptionToken}`);
          if(!supplyIdentityOk)throw new Error('minted-redeemed-supply identity mismatch');
          if(!redeemabilityIdentityOk)throw new Error('redeemability timestamp identity mismatch');
          out.push({
            id:s.id,label:s.label,originNetwork:network,originAddress:s.originAddress,bridgedMirrors:s.bridgedMirrors||[],documentedMaturityDate:s.documentedMaturityDate,
            observed:{redemptionTokenAddress:redemptionToken,maturityTimestamp:Number(maturity),maturityIso:new Date(Number(maturity)*1000).toISOString(),isRedeemable:redeemable,totalSupplyRaw:supply.toString(),totalSupplyLfraxFace:units18(supply),totalFxbMintedRaw:minted.toString(),totalFxbRedeemedRaw:redeemed.toString(),backingLfraxRaw:backing.toString(),backingLfrax:units18(backing),backingCoverageRatio:ratio18(backing,supply),backingDeficitRaw:backingDeficit.toString(),secondsToMaturity:Number(maturity)-blockTimestamp},
            proof:{lFraxIdentityProven:identityOk,mintedMinusRedeemedEqualsSupply:supplyIdentityOk,redeemabilityMatchesBlockTimestamp:redeemabilityIdentityOk,backingAtLeastOutstandingSupply:backingDeficit===0n},
            epistemic:{originContractState:'MEASURED-exact-block',redemptionAssetIdentity:'MEASURED-token()-exact-contract-call',mintRedeemSupplyIdentity:'DERIVED-MECHANICAL-exact-contract-accounting',originBackingBalance:'MEASURED-exact-block',spotPrice:'UNKNOWN-not-measured-by-this-atom',impliedYield:'UNKNOWN-no-measured-price',bridgedMirrorBacking:'UNKNOWN-topology-only'}
          });
        }catch(error){throw new Error(`FXB ${s.id} current-origin read failed: ${error instanceof Error?error.message:String(error)}`);}
      }
      return {status:'ok',network,chainId:Number(networkConfig.chainId),observedAt:new Date(blockTimestamp*1000).toISOString(),blockNumber:Number(blockNumber),blockHash:String(block.hash).toLowerCase(),blockTimestamp,series:out,rpc:{endpointId:endpoint.id,failoverAttempts:attempts}};
    }catch(error){attempts.push({network,endpointId:endpoint.id,error:error instanceof Error?error.message:String(error)});}
  }
  return {status:'UNKNOWN-network-read-failed',network,chainId:Number(networkConfig.chainId),observedAt:null,blockNumber:null,blockHash:null,blockTimestamp:null,series:[],rpc:{endpointId:null,failoverAttempts:attempts}};
}

export async function collectFraxFxbOnchain({config=null,rpcRegistry=null,fetchImpl=fetch,endpointsOverride=null}={}){
  let cfg;try{cfg=loadConfig(config);}catch(error){return unknown({attempts:[{network:null,endpointId:null,error:error.message}],reason:'UNKNOWN-fxb-series-registry-invalid',config});}
  let endpoints;try{endpoints=endpointsOverride||loadEndpoints(cfg,rpcRegistry);}catch(error){return unknown({attempts:[{network:null,endpointId:null,error:error.message}],reason:'UNKNOWN-fxb-rpc-registry-unavailable',config:cfg});}
  const groups={};for(const s of cfg.series)(groups[s.originNetwork] ||= []).push(s);
  const results=[];
  for(const [network,series] of Object.entries(groups)){
    const networkConfig=cfg.networks?.[network];
    if(!networkConfig)return unknown({attempts:[{network,endpointId:null,error:'network config missing'}],reason:'UNKNOWN-fxb-series-network-config-missing',config:cfg});
    results.push(await collectNetwork({network,networkConfig,endpoints:endpoints[network]||[],series,fetchImpl}));
  }
  const attempts=results.flatMap(x=>x.rpc?.failoverAttempts||[]),measuredSeries=results.flatMap(x=>x.series||[]),full=results.every(x=>x.status==='ok')&&measuredSeries.length===cfg.series.length;
  const networkResults=Object.fromEntries(results.map(x=>[x.network,{chainId:x.chainId,status:x.status,blockNumber:x.blockNumber,blockHash:x.blockHash,blockTimestamp:x.blockTimestamp,observedAt:x.observedAt,rpcEndpointId:x.rpc?.endpointId||null}]));
  if(!full)return unknown({attempts,reason:'UNKNOWN-fxb-incomplete-origin-series-coverage',config:cfg,networkResults});
  return {
    version:FRAX_FXB_ONCHAIN_VERSION,status:'ok',measurementClass:'MEASURED',observedAt:new Date(Math.max(...results.map(x=>x.blockTimestamp))*1000).toISOString(),
    networks:networkResults,series:measuredSeries,
    coverage:{configuredOriginSeriesCount:cfg.series.length,measuredOriginSeriesCount:measuredSeries.length,unresolvedDocumentedSeriesCount:(cfg.documentedUnresolvedSeries||[]).length,unresolvedDocumentedSeries:cfg.documentedUnresolvedSeries||[],legacySeriesExcludedCount:(cfg.documentedLegacySeries||[]).length,fullConfiguredOriginSeriesCoverage:true,originNetworkCount:results.length,activeSeriesCount:measuredSeries.filter(x=>!x.observed.isRedeemable).length,maturedSeriesCount:measuredSeries.filter(x=>x.observed.isRedeemable).length,seriesWithBackingDeficit:measuredSeries.filter(x=>x.observed.backingDeficitRaw!=='0').map(x=>x.id)},
    rpc:{networks:Object.fromEntries(results.map(x=>[x.network,x.rpc])),failoverAttempts:attempts},
    provenance:{seriesRegistryVersion:cfg.version,officialSources:cfg.officialSources,contractFunctions:['token()','MATURITY_TIMESTAMP()','totalSupply()','totalFxbMinted()','totalFxbRedeemed()','isRedeemable()','LFRAX.balanceOf(FXB)']},
    epistemic:{originSeriesState:'MEASURED-exact-block-current-series-multi-chain',originBacking:'MEASURED-exact-block-origin-only',mintRedeemSupplyIdentity:'DERIVED-MECHANICAL-totalFxbMinted-minus-totalFxbRedeemed-equals-totalSupply',redeemabilityIdentity:'DERIVED-MECHANICAL-block-timestamp-vs-maturity',redemptionAssetIdentity:'MEASURED-token()-common-v1.2-v2-interface',spotPrice:'UNKNOWN-not-measured-by-this-atom',impliedYield:'UNKNOWN-no-measured-price',auctionState:'UNKNOWN-separate-atom',bridgedMirrorBacking:'UNKNOWN-topology-only-not-double-counted',legacySeriesState:'HISTORICAL-excluded-from-current-completeness',documentedUnresolvedSeries:(cfg.documentedUnresolvedSeries||[]).length?'UNKNOWN-source-incomplete':'MEASURED-none-in-current-source',unknownIsZero:false,causalClaimAuthority:'none',executionAuthority:'none'}
  };
}

export function applyFraxFxbOnchainMeasurement({state,previousState,measurement}){
  if(!state||typeof state!=='object')throw new Error('FXB adapter requires Economic Graph state');
  if(state?.authority?.executionAuthority!=='none'||state?.authority?.causalClaimAuthority!=='none')throw new Error('FXB adapter refuses Graph authority drift');
  const evidence=state?.protocolEvidence?.[FRAX_ECOSYSTEM_EVIDENCE_ID],base=evidence?.latest?.observation,fraxSensor=state?.protocolSensors?.[FRAX_PROTOCOL_ID];if(!evidence||!base||!fraxSensor)throw new Error('Frax ecosystem evidence missing before FXB enrichment');
  const current=structuredClone(base),fxb=current?.surfaces?.fxb;if(!fxb)throw new Error('Frax FXB surface missing');
  const valid=measurement?.status==='ok'&&measurement?.measurementClass==='MEASURED'&&measurement?.coverage?.fullConfiguredOriginSeriesCoverage===true&&measurement?.epistemic?.originSeriesState?.startsWith('MEASURED');
  fxb.measured=measurement;
  fxb.measurementState=valid?'MEASURED-current-origin-series-state-partial-term-curve':'UNKNOWN-current-value-not-ingested';
  fxb.mechanicalRelations=[
    {from:'FXB token() + configured origin chain',to:'Legacy Frax Dollar redemption-asset identity',class:valid?'MEASURED-exact-block':'UNKNOWN'},
    {from:'totalFxbMinted - totalFxbRedeemed',to:'FXB totalSupply',class:valid?'MECHANICAL-exact-accounting-identity':'UNKNOWN'},
    {from:'origin FXB-held LFRAX',to:'outstanding 1:1 redemption backing state',class:valid?'MEASURED-exact-block-origin-only':'UNKNOWN'},
    {from:'block timestamp + MATURITY_TIMESTAMP',to:'isRedeemable',class:valid?'MECHANICAL-exact-time-identity':'UNKNOWN'},
    {from:'spot price + face value + time to maturity',to:'implied yield',class:'UNKNOWN-no-current-price-source'},
    {from:'FXB demand',to:'frxUSD/LFRAX peg effect',class:'CORRELATED-until-transactional-causality-proven'},
    {from:'LFRAX identity',to:'frxUSD identity',class:'UNKNOWN-do-not-assume-equivalence'}
  ];
  current.measurementExtensions={...(current.measurementExtensions||{}),fxbOnchain:FRAX_FXB_ONCHAIN_VERSION};
  current.epistemic={...(current.epistemic||{}),fxbOriginSeriesState:valid?measurement.epistemic.originSeriesState:'UNKNOWN',fxbOriginBacking:valid?measurement.epistemic.originBacking:'UNKNOWN',fxbMintRedeemSupplyIdentity:valid?measurement.epistemic.mintRedeemSupplyIdentity:'UNKNOWN',fxbSpotPrice:'UNKNOWN',fxbImpliedYield:'UNKNOWN',fxbBridgedMirrorBacking:'UNKNOWN-topology-only-not-double-counted'};
  const surfaces=Object.values(current.surfaces||{}),measured=surfaces.filter(s=>String(s.measurementState||'').startsWith('MEASURED'));current.coverage.measuredSurfaceCount=measured.length;current.coverage.sourceBoundUnknownSurfaceCount=surfaces.length-measured.length;current.relationshipGraph=surfaces.flatMap(s=>s.mechanicalRelations.map((r,index)=>({surfaceId:s.id,index,...r})));current.coverage.relationshipCount=current.relationshipGraph.length;current.coverage.relationshipClassCounts=current.relationshipGraph.reduce((a,r)=>{const k=String(r.class||'UNKNOWN').split('-')[0];a[k]=(a[k]||0)+1;return a;},{});
  current.id=`frax-ecosystem:${sha256(stableStringify({priorId:base.id,fxb:valid?{networks:measurement.networks,series:measurement.series.map(x=>[x.id,x.originNetwork,x.originAddress,x.observed.maturityTimestamp,x.observed.totalSupplyRaw,x.observed.totalFxbMintedRaw,x.observed.totalFxbRedeemedRaw,x.observed.backingLfraxRaw,x.observed.isRedeemable])}:{status:measurement?.status||'UNKNOWN'},surfaceIds:current.coverage.surfaceIds})).slice(0,24)}`;
  const prevRows=Array.isArray(previousState?.protocolEvidence?.[FRAX_ECOSYSTEM_EVIDENCE_ID]?.observations)?previousState.protocolEvidence[FRAX_ECOSYSTEM_EVIDENCE_ID].observations:[];const rows=[...prevRows];if(!rows.some(r=>r?.id===current.id))rows.push(current);evidence.latest={observation:current};evidence.status=current.status;evidence.observations=rows.slice(-MAX_OBSERVATIONS);evidence.observationCount=evidence.observations.length;evidence.measurementExtensions={...(evidence.measurementExtensions||{}),fxbOnchain:FRAX_FXB_ONCHAIN_VERSION};
  fraxSensor.ecosystemFamily={...(fraxSensor.ecosystemFamily||{}),status:current.status,measuredSurfaceCount:current.coverage.measuredSurfaceCount,sourceBoundUnknownSurfaceCount:current.coverage.sourceBoundUnknownSurfaceCount,latestObservationId:current.id,measurementExtensions:{...(fraxSensor.ecosystemFamily?.measurementExtensions||{}),fxbOnchain:FRAX_FXB_ONCHAIN_VERSION}};if(fraxSensor?.latest?.observation)fraxSensor.latest.observation.ecosystemFamily=fraxSensor.ecosystemFamily;
  if(current.coverage.measuredSurfaceCount+current.coverage.sourceBoundUnknownSurfaceCount!==current.coverage.surfaceCount)throw new Error('Frax FXB depth accounting drift');
  if(valid&&measurement.coverage.measuredOriginSeriesCount!==measurement.series.length)throw new Error('FXB series materialization mismatch');
  if(valid&&measurement.series.some(x=>x.proof?.lFraxIdentityProven!==true||x.proof?.mintedMinusRedeemedEqualsSupply!==true||x.proof?.redeemabilityMatchesBlockTimestamp!==true))throw new Error('FXB proof invariant drift');
  if(current?.authority?.executionAuthority!=='none'||current?.epistemic?.executionAuthority!=='none'||measurement?.epistemic?.executionAuthority!=='none')throw new Error('FXB execution authority leaked');
  return state;
}
