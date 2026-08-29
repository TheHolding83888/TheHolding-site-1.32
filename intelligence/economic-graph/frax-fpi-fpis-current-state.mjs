#!/usr/bin/env node
/**
 * The Holding · Frax FPI / FPIS / legacy veFPIS current-state extension v0.1
 *
 * Measures one exact Ethereum block for source-pinned legacy FPI surfaces.
 * Token supply, controller configuration and veFPIS voting / tracked-principal
 * state are direct onchain reads. CPI-peg pricing is best-effort because the
 * legacy controller's external feeds may be unavailable. Treasury yield,
 * seigniorage, revenue distribution, current Fraxtal FPIS Locker state and all
 * causal/downstream claims remain UNKNOWN.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const FRAX_FPI_FPIS_CURRENT_STATE_VERSION='0.1-fpi-fpis-vefpis-exact-block-scope-extension';
export const FRAX_FPI_FPIS_SURFACE_KEY='fpiFpisVeFpis';
export const FRAX_ECOSYSTEM_EVIDENCE_ID='registry-frax-ecosystem';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const REGISTRY_FILE=path.join(ROOT,'intelligence/economic-graph/frax-fpi-fpis-registry.json');
const RPC_REGISTRY_FILE=path.join(ROOT,'intelligence/market-data/onchain-price-source-registry.json');
const RPC_TIMEOUT_MS=10_000;
const MAX_OBSERVATIONS=1000;
const BASE_SURFACE_KEYS=['governanceVeFrax','fraxtalFloxFxtl','frxUsdSfrxUsd','fraxNet','fraxlend','fraxswapBamm','fxb','fxLiquidity','revenueRouting','frxEthSfrxEth'];
const EXPECTED_SOLIDITY_COMMIT='30532c8cefcbf5c7efafcff4369261bd435a4859';
const EXPECTED_VEFPIS_COMMIT='a36de907af20f7a7b62e977354f3bf6d0d454795';
const SELECTORS={
  totalSupply:'0x18160ddd',
  getFraxPrice:'0x09761c7e',getFpiPrice:'0xd9ebcc2f',mintFee:'0xda610fcf',redeemFee:'0x6e7813ff',pegStatus:'0xbc3d5a8e',
  mintsPaused:'0xe24ab97b',redeemsPaused:'0x30fd8a46',fpiMintCap:'0xd578660a',pegBandMintRedeem:'0x694033f2',pegBandTwamm:'0x67694bae',
  pendingTwamm:'0x65525bf6',numTwammIntervals:'0x9238c0ac',swapPeriod:'0x8583f21c',totalFpisSupply:'0x47c7341e',emergencyUnlock:'0xf8946485'
};

function sha256(value){return crypto.createHash('sha256').update(value).digest('hex');}
function stableValue(value){if(Array.isArray(value))return value.map(stableValue);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,stableValue(value[key])]));return value;}
function stableStringify(value){return JSON.stringify(stableValue(value));}
function readJson(file){return JSON.parse(fs.readFileSync(file,'utf8'));}
function normalize(value){return String(value||'').toLowerCase();}
function validAddress(value){return /^0x[0-9a-fA-F]{40}$/.test(String(value||''));}
function decodeWord(hex,index=0){const clean=String(hex||'').replace(/^0x/,'');const start=index*64;if(clean.length<start+64||!/^[0-9a-f]+$/i.test(clean))throw new Error(`Invalid ABI word ${index}`);return BigInt(`0x${clean.slice(start,start+64)}`);}
function decodeQuantity(hex){if(!/^0x[0-9a-f]+$/i.test(String(hex||'')))throw new Error('Invalid RPC quantity');return BigInt(hex);}
function units(raw,decimals=18){const base=10n**BigInt(decimals),whole=raw/base,fraction=(raw%base).toString().padStart(decimals,'0').replace(/0+$/,'');return Number(`${whole}${fraction?'.'+fraction:''}`);}
function round(value,digits=12){const n=Number(value);return Number.isFinite(n)?Number(n.toFixed(digits)):null;}
function boolWord(hex){return decodeWord(hex)!==0n;}

export function validateFraxFpiFpisRegistry(registry){
  if(registry?.version!=='0.1-fpi-fpis-current-state-registry'||registry?.network!=='ethereum'||Number(registry?.chainId)!==1)throw new Error('FPI/FPIS registry identity drift');
  for(const value of [registry?.assets?.FPI?.address,registry?.assets?.FPIS?.address,registry?.contracts?.fpiControllerPool,registry?.contracts?.cpiTrackerOracleV2,registry?.contracts?.legacyVeFPIS])if(!validAddress(value))throw new Error('FPI/FPIS registry address invalid');
  if(normalize(registry.assets.FPI.address)!=='0x5ca135cb8527d76e932f34b5145575f9d8cbe08e'||normalize(registry.assets.FPIS.address)!=='0xc2544a32872a91f4a553b404c6950e89de901fdb')throw new Error('FPI/FPIS token identity drift');
  if(normalize(registry.contracts.fpiControllerPool)!=='0x2397321b301b80a1c0911d6f9ed4b6033d43cf51'||normalize(registry.contracts.legacyVeFPIS)!=='0x574c154c83432b0a45ba3ad2429c3fa242ed7359')throw new Error('FPI controller / veFPIS identity drift');
  if(registry?.sources?.officialSolidityRepo!=='FraxFinance/frax-solidity'||registry?.sources?.officialSolidityCommit!==EXPECTED_SOLIDITY_COMMIT)throw new Error('FPI official Solidity source pin drift');
  if(registry?.sources?.officialVeFpisRepo!=='FraxFinance/frax-vefpis'||registry?.sources?.officialVeFpisCommit!==EXPECTED_VEFPIS_COMMIT)throw new Error('veFPIS official source pin drift');
  if(registry?.epistemic?.unknownIsZero!==false||registry?.epistemic?.executionAuthority!=='none'||registry?.epistemic?.causalClaimAuthority!=='none')throw new Error('FPI/FPIS epistemic boundary drift');
  return registry;
}

async function postBatch(url,payload,fetchImpl,{allowErrors=false}={}){
  const response=await fetchImpl(url,{method:'POST',headers:{'content-type':'application/json',accept:'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(RPC_TIMEOUT_MS)});
  if(!response.ok)throw new Error(`RPC HTTP ${response.status}`);
  const body=await response.json();if(!Array.isArray(body))throw new Error('RPC response is not an array');
  const byId=new Map(body.map(row=>[Number(row?.id),row]));
  for(const req of payload){const row=byId.get(req.id);if(!row)throw new Error(`RPC result ${req.id} missing`);if(!allowErrors&&row.error)throw new Error(`RPC ${req.method} error: ${row.error?.message||'unknown error'}`);if(!allowErrors&&(row.result===undefined||row.result===null))throw new Error(`RPC ${req.method} result missing`);}
  return byId;
}
function call(id,to,data,blockTag){return {jsonrpc:'2.0',id,method:'eth_call',params:[{to,data},blockTag]};}
function code(id,to,blockTag){return {jsonrpc:'2.0',id,method:'eth_getCode',params:[to,blockTag]};}
function unknownMeasurement(source,reason,attempts=[]){return {version:FRAX_FPI_FPIS_CURRENT_STATE_VERSION,status:reason,measurementClass:'UNKNOWN',observedAt:null,network:'ethereum',chainId:1,blockNumber:null,tokens:{FPI:{address:source?.assets?.FPI?.address||null,totalSupply:null},FPIS:{address:source?.assets?.FPIS?.address||null,totalSupply:null}},controller:null,legacyVeFPIS:null,pegState:{status:'UNKNOWN'},rpc:{endpointId:null,failoverAttempts:attempts},epistemic:{sourceType:'onchain-public-rpc-exact-block',currentStateMeasured:false,treasuryYield:'UNKNOWN',seigniorageDistribution:'UNKNOWN',revenueRouting:'UNKNOWN',currentFraxtalFpisLocker:'UNKNOWN-not-measured-by-this-atom',companyCashFlow:'UNKNOWN',unknownIsZero:false,causalClaimAuthority:'none',executionAuthority:'none'}};}

export async function collectFraxFpiFpisCurrentState({registry=null,rpcRegistry=null,fetchImpl=fetch,checkpoint=null}={}){
  const source=validateFraxFpiFpisRegistry(registry||readJson(REGISTRY_FILE));
  const rpc=rpcRegistry||readJson(RPC_REGISTRY_FILE),network=rpc?.networks?.ethereum,endpoints=Array.isArray(network?.rpcFailover)?network.rpcFailover:[],attempts=[];
  if(Number(network?.chainId)!==1||!endpoints.length)throw new Error('Ethereum RPC registry unavailable');
  const fpi=source.assets.FPI.address,fpis=source.assets.FPIS.address,controller=source.contracts.fpiControllerPool,cpi=source.contracts.cpiTrackerOracleV2,ve=source.contracts.legacyVeFPIS;
  for(const endpoint of endpoints){
    try{
      let blockTag=checkpoint?.blockTag||null;
      if(!blockTag){const head=await postBatch(endpoint.url,[{jsonrpc:'2.0',id:1,method:'eth_blockNumber',params:[]}],fetchImpl);blockTag=head.get(1).result;}
      if(!/^0x[0-9a-f]+$/i.test(String(blockTag)))throw new Error('Invalid exact block tag');
      const mandatory=[
        {jsonrpc:'2.0',id:2,method:'eth_getBlockByNumber',params:[blockTag,false]},
        call(10,fpi,SELECTORS.totalSupply,blockTag),call(11,fpis,SELECTORS.totalSupply,blockTag),
        call(20,controller,SELECTORS.mintFee,blockTag),call(21,controller,SELECTORS.redeemFee,blockTag),call(22,controller,SELECTORS.mintsPaused,blockTag),call(23,controller,SELECTORS.redeemsPaused,blockTag),
        call(24,controller,SELECTORS.fpiMintCap,blockTag),call(25,controller,SELECTORS.pegBandMintRedeem,blockTag),call(26,controller,SELECTORS.pegBandTwamm,blockTag),call(27,controller,SELECTORS.pendingTwamm,blockTag),call(28,controller,SELECTORS.numTwammIntervals,blockTag),call(29,controller,SELECTORS.swapPeriod,blockTag),
        call(30,ve,SELECTORS.totalSupply,blockTag),call(31,ve,SELECTORS.totalFpisSupply,blockTag),call(32,ve,SELECTORS.emergencyUnlock,blockTag),
        code(100,fpi,blockTag),code(101,fpis,blockTag),code(102,controller,blockTag),code(103,cpi,blockTag),code(104,ve,blockTag)
      ];
      const rows=await postBatch(endpoint.url,mandatory,fetchImpl),block=rows.get(2).result;
      const blockNumber=Number(decodeQuantity(block?.number||blockTag)),timestampSeconds=Number(decodeQuantity(block?.timestamp));
      if(!(blockNumber>0)||!(timestampSeconds>0)||!/^0x[0-9a-f]{64}$/i.test(String(block?.hash||'')))throw new Error('Exact block identity unavailable');
      for(const id of [100,101,102,103,104]){const deployed=String(rows.get(id).result||'');if(!/^0x[0-9a-f]+$/i.test(deployed)||deployed==='0x'||deployed==='0x0')throw new Error(`Source-bound contract code missing id=${id}`);}
      const fpiRaw=decodeWord(rows.get(10).result),fpisRaw=decodeWord(rows.get(11).result),veVotingRaw=decodeWord(rows.get(30).result),veTrackedRaw=decodeWord(rows.get(31).result);
      const controllerState={
        address:controller,effectiveMintFeeE6:Number(decodeWord(rows.get(20).result)),effectiveMintFeePct:round(Number(decodeWord(rows.get(20).result))/1e4,6),effectiveRedeemFeeE6:Number(decodeWord(rows.get(21).result)),effectiveRedeemFeePct:round(Number(decodeWord(rows.get(21).result))/1e4,6),
        mintsPaused:boolWord(rows.get(22).result),redeemsPaused:boolWord(rows.get(23).result),fpiMintCapRaw:decodeWord(rows.get(24).result).toString(),fpiMintCap:round(units(decodeWord(rows.get(24).result))),
        pegBandMintRedeemE6:Number(decodeWord(rows.get(25).result)),pegBandMintRedeemPct:round(Number(decodeWord(rows.get(25).result))/1e4,6),pegBandTwammE6:Number(decodeWord(rows.get(26).result)),pegBandTwammPct:round(Number(decodeWord(rows.get(26).result))/1e4,6),
        pendingTwammOrder:boolWord(rows.get(27).result),numTwammIntervals:Number(decodeWord(rows.get(28).result)),swapPeriodSeconds:Number(decodeWord(rows.get(29).result))
      };
      let pegState={status:'UNKNOWN-legacy-controller-price-read-unavailable',measurementClass:'UNKNOWN',fraxPriceUsd:null,fpiPriceUsd:null,cpiPegPriceUsd:null,diffFractionE6:null,diffPct:null,withinMintRedeemBand:null};
      try{
        const optional=await postBatch(endpoint.url,[call(200,controller,SELECTORS.getFraxPrice,blockTag),call(201,controller,SELECTORS.getFpiPrice,blockTag),call(202,controller,SELECTORS.pegStatus,blockTag)],fetchImpl);
        const fraxPrice=decodeWord(optional.get(200).result),fpiPrice=decodeWord(optional.get(201).result),cpiPeg=decodeWord(optional.get(202).result,0),diff=decodeWord(optional.get(202).result,1),within=decodeWord(optional.get(202).result,2)!==0n;
        pegState={status:'ok',measurementClass:'MEASURED',fraxPriceUsd:round(units(fraxPrice),12),fpiPriceUsd:round(units(fpiPrice),12),cpiPegPriceUsd:round(units(cpiPeg),12),diffFractionE6:Number(diff),diffPct:round(Number(diff)/1e4,6),withinMintRedeemBand:within};
      }catch(error){pegState={...pegState,error:String(error instanceof Error?error.message:error).slice(0,160)};}
      const fpisSupply=units(fpisRaw),tracked=units(veTrackedRaw);
      return {
        version:FRAX_FPI_FPIS_CURRENT_STATE_VERSION,status:'ok',measurementClass:'MEASURED',observedAt:new Date(timestampSeconds*1000).toISOString(),network:'ethereum',chainId:1,blockNumber,blockTag,blockHash:block.hash,
        sourceRegistryVersion:source.version,
        tokens:{FPI:{address:fpi,totalSupplyRaw:fpiRaw.toString(),totalSupply:round(units(fpiRaw),8)},FPIS:{address:fpis,totalSupplyRaw:fpisRaw.toString(),totalSupply:round(fpisSupply,8)}},
        controller:controllerState,
        legacyVeFPIS:{address:ve,totalVotingPowerRaw:veVotingRaw.toString(),totalVotingPower:round(units(veVotingRaw),8),trackedFpisPrincipalRaw:veTrackedRaw.toString(),trackedFpisPrincipal:round(tracked,8),trackedPrincipalPctOfFpisSupply:fpisSupply>0?round(tracked/fpisSupply*100,8):null,emergencyUnlockActive:boolWord(rows.get(32).result)},
        pegState,
        deployedCode:{FPI:true,FPIS:true,fpiControllerPool:true,cpiTrackerOracleV2:true,legacyVeFPIS:true},
        sourceBinding:{officialSolidityRepo:source.sources.officialSolidityRepo,officialSolidityCommit:source.sources.officialSolidityCommit,officialVeFpisRepo:source.sources.officialVeFpisRepo,officialVeFpisCommit:source.sources.officialVeFpisCommit},
        rpc:{endpointId:endpoint.id,failoverAttempts:attempts},
        epistemic:{sourceType:'onchain-public-rpc-exact-block',currentStateMeasured:true,legacyEthereumSurface:true,veFpisVotingPowerVsTrackedPrincipal:'DISTINCT-source-proven',pegState:pegState.measurementClass==='MEASURED'?'MEASURED-current-controller-feeds':'UNKNOWN',treasuryYield:'UNKNOWN',seigniorageDistribution:'UNKNOWN',revenueRouting:'UNKNOWN',currentFraxtalFpisLocker:'UNKNOWN-not-measured-by-this-atom',companyCashFlow:'UNKNOWN',unknownIsZero:false,causalClaimAuthority:'none',executionAuthority:'none'}
      };
    }catch(error){attempts.push({endpointId:endpoint.id,error:String(error instanceof Error?error.message:error).slice(0,180)});}
  }
  return unknownMeasurement(source,'UNKNOWN-rpc-read-failed',attempts);
}

function surfaceFromRegistry(registry){return {id:'fpi-fpis-vefpis',label:'FPI / FPIS / legacy veFPIS',mechanism:'CPI-targeting FPI token + legacy FPIS governance / vote escrow surface',atoms:['FPI supply','FPIS supply','legacy Ethereum FPI Controller fees and pause state','CPI peg band state','legacy veFPIS total voting power','legacy veFPIS tracked FPIS principal'],sourceContract:registry,measurementState:'UNKNOWN-current-value-not-ingested',measured:null,mechanicalRelations:[{from:'legacy veFPIS tracked FPIS principal',to:'tracked principal share of FPIS supply',class:'MECHANICAL-ready-for-exact-block-reproduction'},{from:'FPI price vs CPI peg',to:'mint/redeem peg-band state',class:'MECHANICAL-ready-if-legacy-controller-feeds-live'}]};}

export function applyFraxFpiFpisCurrentState({state,previousState,measurement,registry=null}){
  if(!state||typeof state!=='object')throw new Error('FPI/FPIS adapter requires Economic Graph state');
  if(state?.authority?.executionAuthority!=='none'||state?.authority?.causalClaimAuthority!=='none')throw new Error('FPI/FPIS adapter refuses Graph authority drift');
  const source=validateFraxFpiFpisRegistry(registry||readJson(REGISTRY_FILE));
  const evidence=state?.protocolEvidence?.[FRAX_ECOSYSTEM_EVIDENCE_ID],baseCurrent=evidence?.latest?.observation;
  if(!evidence||!baseCurrent)throw new Error('Frax ecosystem evidence missing before FPI/FPIS extension');
  for(const key of BASE_SURFACE_KEYS)if(!baseCurrent?.surfaces?.[key])throw new Error(`Frax prior surface missing before FPI/FPIS extension: ${key}`);
  if(Object.keys(baseCurrent.surfaces||{}).some(key=>!BASE_SURFACE_KEYS.includes(key)&&key!==FRAX_FPI_FPIS_SURFACE_KEY))throw new Error('Undeclared Frax scope extension present before FPI/FPIS atom');
  const current=structuredClone(baseCurrent),surface=surfaceFromRegistry(source);current.surfaces[FRAX_FPI_FPIS_SURFACE_KEY]=surface;
  const valid=measurement?.status==='ok'&&measurement?.measurementClass==='MEASURED'&&Number.isFinite(Number(measurement?.tokens?.FPI?.totalSupply))&&Number.isFinite(Number(measurement?.tokens?.FPIS?.totalSupply))&&Number.isFinite(Number(measurement?.legacyVeFPIS?.trackedFpisPrincipal));
  if(valid){
    surface.measurementState='MEASURED-current-onchain-partial';surface.measured=measurement;
    surface.mechanicalRelations=surface.mechanicalRelations.map((relation,index)=>({...relation,class:index===0?'MECHANICAL-proven-current-exact-block':measurement?.pegState?.measurementClass==='MEASURED'?'MECHANICAL-proven-current-controller-state':'MECHANICAL-UNKNOWN-controller-feed-unavailable'}));
  }else{surface.measurementState='UNKNOWN-current-onchain-read-unavailable';surface.measured=measurement||unknownMeasurement(source,'UNKNOWN-current-onchain-read-unavailable');}
  const entries=Object.entries(current.surfaces||{}),surfaces=entries.map(([,value])=>value);
  current.coverage.surfaceCount=entries.length;current.coverage.surfaceIds=surfaces.map(item=>item.id);current.coverage.measuredSurfaceCount=surfaces.filter(item=>String(item.measurementState||'').startsWith('MEASURED')).length;current.coverage.sourceBoundUnknownSurfaceCount=current.coverage.surfaceCount-current.coverage.measuredSurfaceCount;
  current.relationshipGraph=surfaces.flatMap(item=>(item.mechanicalRelations||[]).map((relation,index)=>({surfaceId:item.id,index,...relation})));current.coverage.relationshipCount=current.relationshipGraph.length;current.coverage.relationshipClassCounts=current.relationshipGraph.reduce((acc,relation)=>{const key=String(relation.class||'UNKNOWN').split('-')[0];acc[key]=(acc[key]||0)+1;return acc;},{});
  current.status=current.coverage.sourceBoundUnknownSurfaceCount===0?'deep-sensor-family-fully-measured':'deep-sensor-family-active-partial-measurement';
  current.scopeExtensions={...(current.scopeExtensions||{}),fpiFpisVeFpis:{version:FRAX_FPI_FPIS_CURRENT_STATE_VERSION,surfaceKey:FRAX_FPI_FPIS_SURFACE_KEY,surfaceId:surface.id,sourceRegistryVersion:source.version}};
  current.measurementExtensions={...(current.measurementExtensions||{}),fpiFpisCurrentState:FRAX_FPI_FPIS_CURRENT_STATE_VERSION};
  current.epistemic.measuredEconomicSurfaces=surfaces.filter(item=>String(item.measurementState||'').startsWith('MEASURED')).map(item=>item.id);
  current.epistemic.fpiFpisCurrentState=valid?'MEASURED-current-legacy-Ethereum-surface':'UNKNOWN';current.epistemic.fpiCpiPegState=valid&&measurement?.pegState?.measurementClass==='MEASURED'?'MEASURED-current-controller-feeds':'UNKNOWN';current.epistemic.fpiTreasuryYield='UNKNOWN';current.epistemic.fpiSeigniorageDistribution='UNKNOWN';current.epistemic.fpiRevenueRouting='UNKNOWN';current.epistemic.currentFraxtalFpisLocker='UNKNOWN-not-measured-by-this-atom';current.epistemic.fpiCompanyCashFlow='UNKNOWN';
  current.nextMeasurementUnlocks=[...(current.nextMeasurementUnlocks||[]).filter(item=>!String(item).startsWith('Measure FPI/FPIS')),'Measure current Fraxtal FPIS Locker / MintRedeemer and any treasury or seigniorage routing only from separately source-pinned current deployments; do not infer them from this legacy Ethereum atom.'];
  current.id=`frax-ecosystem:${sha256(stableStringify({baseObservationId:baseCurrent.id,scopeExtensions:current.scopeExtensions,fpiFpis:valid?{blockNumber:measurement.blockNumber,blockHash:measurement.blockHash,fpiSupply:measurement.tokens.FPI.totalSupplyRaw,fpisSupply:measurement.tokens.FPIS.totalSupplyRaw,veTracked:measurement.legacyVeFPIS.trackedFpisPrincipalRaw,peg:measurement.pegState?.status}:{status:measurement?.status||'UNKNOWN'}})).slice(0,24)}`;
  const existing=Array.isArray(evidence.observations)?evidence.observations:[];const rows=existing.filter(row=>row?.id!==baseCurrent.id);if(!rows.some(row=>row?.id===current.id))rows.push(current);evidence.latest={observation:current};evidence.observations=rows.slice(-MAX_OBSERVATIONS);evidence.observationCount=evidence.observations.length;
  return state;
}
