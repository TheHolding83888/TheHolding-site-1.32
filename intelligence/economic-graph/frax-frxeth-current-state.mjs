#!/usr/bin/env node
/**
 * The Holding · Frax frxETH/sfrxETH current-state scope extension v0.1
 *
 * Adds the first Frax fat-audit surface beyond the original nine-surface family.
 * Current ERC20/ERC4626 state is measured at one exact Ethereum block through a
 * reusable collector. frxETH V2 operational contracts are proven only as
 * deployed-code topology; borrowing income, validator economics, protocol
 * revenue and downstream company cash flow remain UNKNOWN until separately
 * measured.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectErc20Erc4626AssetState } from './erc20-erc4626-asset-state.mjs';

export const FRAX_FRXETH_CURRENT_STATE_VERSION='0.1-frxeth-sfrxeth-exact-block-scope-extension';
export const FRAX_ECOSYSTEM_EVIDENCE_ID='registry-frax-ecosystem';
export const FRAX_PROTOCOL_ID='registry-frax-vefrax';
export const FRAX_FRXETH_SURFACE_KEY='frxEthSfrxEth';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const REGISTRY_FILE=path.join(ROOT,'intelligence/economic-graph/frax-frxeth-registry.json');
const MAX_OBSERVATIONS=1000;
const BASE_SURFACE_KEYS=['governanceVeFrax','fraxtalFloxFxtl','frxUsdSfrxUsd','fraxNet','fraxlend','fraxswapBamm','fxb','fxLiquidity','revenueRouting'];
const EXPECTED_SOURCE_COMMIT='83dfe93b4a32b9ca0ab93d6e7c059fcd977320d4';
const EXPECTED_FRXETH='0x5e8422345238f34275888049021821e8e08caa1f';
const EXPECTED_SFRXETH='0xac3e018457b222d93114458476f3e3416abbe38f';

function sha256(value){return crypto.createHash('sha256').update(value).digest('hex');}
function stableValue(value){if(Array.isArray(value))return value.map(stableValue);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,stableValue(value[key])]));return value;}
function stableStringify(value){return JSON.stringify(stableValue(value));}
function finite(value){return value!==null&&value!==undefined&&value!==''&&Number.isFinite(Number(value));}
function round(value,digits=12){const n=Number(value);return Number.isFinite(n)?Number(n.toFixed(digits)):null;}
function readRegistry(){return JSON.parse(fs.readFileSync(REGISTRY_FILE,'utf8'));}
function normalize(value){return String(value||'').toLowerCase();}

export function validateFraxFrxEthRegistry(registry){
  if(registry?.version!=='0.1-frxeth-current-state-registry'||registry?.network!=='ethereum'||Number(registry?.chainId)!==1)throw new Error('frxETH registry identity drift');
  if(normalize(registry?.assets?.frxETH?.address)!==EXPECTED_FRXETH||normalize(registry?.assets?.sfrxETH?.address)!==EXPECTED_SFRXETH)throw new Error('frxETH/sfrxETH source-bound address drift');
  if(registry?.sources?.officialSourceRepo!=='FraxFinance/frxETH-v2-public'||registry?.sources?.officialSourceCommit!==EXPECTED_SOURCE_COMMIT)throw new Error('frxETH official source pin drift');
  if(registry?.epistemic?.unknownIsZero!==false||registry?.epistemic?.factsAggregateIsMeasurementAuthority!==false||registry?.epistemic?.executionAuthority!=='none')throw new Error('frxETH registry epistemic boundary drift');
  const operations=registry?.operations||{};
  if(Object.keys(operations).length<7||Object.values(operations).some(value=>!/^0x[0-9a-fA-F]{40}$/.test(String(value))))throw new Error('frxETH operational contract registry incomplete');
  return registry;
}

function unknownMeasurement(registry,reason,attempts=[]){
  return {
    version:FRAX_FRXETH_CURRENT_STATE_VERSION,status:reason,measurementClass:'UNKNOWN',observedAt:null,network:'ethereum',chainId:1,
    sourceRegistryVersion:registry?.version||null,
    asset:{label:'frxETH',address:registry?.assets?.frxETH?.address||null,totalSupply:null},
    vault:{label:'sfrxETH',address:registry?.assets?.sfrxETH?.address||null,totalSupply:null,totalAssets:null,sharePriceAsset:null},
    operationalCode:null,rpc:{endpointId:null,failoverAttempts:attempts},
    epistemic:{sourceType:'onchain-public-rpc-exact-block',currentStateMeasured:false,operationalCodePresenceOnly:true,fraxFactsMeasurementAuthority:false,validatorEconomics:'UNKNOWN',lendingIncome:'UNKNOWN',protocolRevenueUsd:'UNKNOWN',companyCashFlow:'UNKNOWN',unknownIsZero:false,causalClaimAuthority:'none',executionAuthority:'none'}
  };
}

export async function collectFraxFrxEthCurrentState({registry=null,rpcRegistry=null,fetchImpl=fetch,checkpoint=null}={}){
  const source=validateFraxFrxEthRegistry(registry||readRegistry());
  try{
    const generic=await collectErc20Erc4626AssetState({
      config:{network:source.network,chainId:source.chainId,asset:{label:'frxETH',address:source.assets.frxETH.address},vault:{label:'sfrxETH',address:source.assets.sfrxETH.address},operationalContracts:source.operations},
      rpcRegistry,fetchImpl,checkpoint
    });
    if(generic?.status!=='ok'||generic?.measurementClass!=='MEASURED')return unknownMeasurement(source,generic?.status||'UNKNOWN-current-onchain-read-unavailable',generic?.rpc?.failoverAttempts||[]);
    return {
      ...generic,
      version:FRAX_FRXETH_CURRENT_STATE_VERSION,
      sourceRegistryVersion:source.version,
      sourceBinding:{officialSourceRepo:source.sources.officialSourceRepo,officialSourceCommit:source.sources.officialSourceCommit,officialSourceConstants:source.sources.officialSourceConstants,addresses:source.sources.addresses,frxEthV2Technical:source.sources.frxEthV2Technical,fraxFactsReconciliation:source.sources.fraxFactsReconciliation},
      scope:{assetSupply:'Ethereum frxETH totalSupply only; not asserted as global cross-chain supply',vaultState:'Ethereum sfrxETH ERC4626 exact-block state',operations:'deployed bytecode presence only for current V2 operation contracts'},
      epistemic:{...generic.epistemic,fraxFactsMeasurementAuthority:false,documentedV2MechanicsAreCurrentFlow:false,validatorEconomics:'UNKNOWN-not-measured-by-this-atom',lendingIncome:'UNKNOWN-not-measured-by-this-atom',protocolRevenueUsd:'UNKNOWN',companyCashFlow:'UNKNOWN'}
    };
  }catch(error){
    return unknownMeasurement(source,`UNKNOWN-${String(error instanceof Error?error.message:error).replace(/\s+/g,'-').slice(0,120)}`);
  }
}

function previousMeasured(previousState){
  const previous=previousState?.protocolEvidence?.[FRAX_ECOSYSTEM_EVIDENCE_ID]?.latest?.observation?.surfaces?.[FRAX_FRXETH_SURFACE_KEY]?.measured;
  return previous?.status==='ok'&&finite(previous?.vault?.sharePriceAsset)?previous:null;
}
function interval({previousState,current}){
  if(current?.status!=='ok'||!finite(current?.vault?.sharePriceAsset))return {status:'UNKNOWN-current-measurement-unavailable',accepted:false,startAt:null,endAt:current?.observedAt||null,embeddedYieldPct:null};
  const prior=previousMeasured(previousState);
  if(!prior)return {status:'warming-first-onchain-checkpoint',accepted:false,startAt:null,endAt:current.observedAt,embeddedYieldPct:null,source:'persisted-adjacent-economic-graph-onchain-checkpoints'};
  const startMs=Date.parse(prior.observedAt),endMs=Date.parse(current.observedAt),startBlock=Number(prior.blockNumber),endBlock=Number(current.blockNumber),startPrice=Number(prior.vault.sharePriceAsset),endPrice=Number(current.vault.sharePriceAsset);
  if(!Number.isFinite(startMs)||!Number.isFinite(endMs)||!(endMs>startMs)||!Number.isFinite(startBlock)||!Number.isFinite(endBlock)||!(endBlock>startBlock))return {status:'warming-no-new-independent-block',accepted:false,startAt:prior.observedAt,endAt:current.observedAt,embeddedYieldPct:null};
  if(!(startPrice>0)||!(endPrice>0))return {status:'UNKNOWN-invalid-share-price',accepted:false,startAt:prior.observedAt,endAt:current.observedAt,embeddedYieldPct:null};
  return {status:'ok',accepted:true,source:'persisted-adjacent-economic-graph-onchain-checkpoints',startAt:prior.observedAt,endAt:current.observedAt,elapsedSeconds:Math.round((endMs-startMs)/1000),startBlock,endBlock,startSharePriceFrxEth:round(startPrice),endSharePriceFrxEth:round(endPrice),embeddedYieldPct:round((endPrice/startPrice-1)*100),annualizedApyPct:null,annualizationState:'NOT-CALCULATED-no-annualization-methodology-added',accountingIdentity:'ending sfrxETH share price / beginning share price - 1',note:'Direct ERC4626 share-price return only. No validator-reward, lending-income, protocol-revenue or company-cash-flow causality is inferred.'};
}

function surfaceFromRegistry(registry){
  return {
    id:'frxeth-sfrxeth',label:'frxETH / sfrxETH / frxETH V2',
    mechanism:'ETH-pegged liquid staking asset + ERC4626 yield vault + V2 validator/lending/redemption operations',
    atoms:['frxETH supply','sfrxETH supply','sfrxETH total assets','sfrxETH share price','embedded share-price yield','V2 operation contract topology','validator-pool credit','ETH borrowed','utilization','borrow rate','interest paid','redemption queue','EtherRouter consolidated balance','Curve AMO deployment','protocol income'],
    sourceContract:registry,
    measurementState:'UNKNOWN-current-value-not-ingested',measured:null,
    mechanicalRelations:[
      {from:'sfrxETH totalAssets / totalSupply',to:'sfrxETH share price',class:'MECHANICAL-ready-for-onchain-reproduction'},
      {from:'adjacent sfrxETH share-price checkpoints',to:'embedded yield',class:'MECHANICAL-ready-for-longitudinal-reproduction'},
      {from:'frxETH minting',to:'EtherRouter',class:'MECHANICAL-source-documented-not-currently-reproduced'},
      {from:'LendingPool borrowing interest',to:'EtherRouter protocol income',class:'MECHANICAL-source-documented-current-amount-UNKNOWN'},
      {from:'validator / AMO / lending economics',to:'sfrxETH holder yield',class:'ATTRIBUTED-source-documented-causal-contribution-not-currently-decomposed'}
    ]
  };
}

export function applyFraxFrxEthCurrentState({state,previousState,measurement,registry=null}){
  if(!state||typeof state!=='object')throw new Error('Frax frxETH adapter requires Economic Graph state');
  if(state?.authority?.executionAuthority!=='none'||state?.authority?.causalClaimAuthority!=='none')throw new Error('Frax frxETH adapter refuses Graph authority drift');
  const source=validateFraxFrxEthRegistry(registry||readRegistry());
  const evidence=state?.protocolEvidence?.[FRAX_ECOSYSTEM_EVIDENCE_ID],baseCurrent=evidence?.latest?.observation,fraxSensor=state?.protocolSensors?.[FRAX_PROTOCOL_ID];
  if(!evidence||!baseCurrent||!fraxSensor)throw new Error('Frax ecosystem evidence missing before frxETH extension');
  const current=structuredClone(baseCurrent);
  for(const key of BASE_SURFACE_KEYS)if(!current?.surfaces?.[key])throw new Error(`Frax base surface missing before frxETH extension: ${key}`);
  if(Object.keys(current.surfaces||{}).some(key=>!BASE_SURFACE_KEYS.includes(key)&&key!==FRAX_FRXETH_SURFACE_KEY))throw new Error('Undeclared Frax scope extension present before frxETH atom');
  current.surfaces[FRAX_FRXETH_SURFACE_KEY]=surfaceFromRegistry(source);
  const surface=current.surfaces[FRAX_FRXETH_SURFACE_KEY];
  const valid=measurement?.status==='ok'&&measurement?.measurementClass==='MEASURED'&&finite(measurement?.asset?.totalSupply)&&finite(measurement?.vault?.totalSupply)&&finite(measurement?.vault?.totalAssets)&&finite(measurement?.vault?.sharePriceAsset);
  if(valid){
    const embedded=interval({previousState,current:measurement});
    surface.measurementState='MEASURED-current-onchain-partial';
    surface.measured={...measurement,intervalEmbeddedYield:embedded};
    surface.mechanicalRelations=surface.mechanicalRelations.map(relation=>{
      if(relation.to==='sfrxETH share price')return {...relation,class:'MECHANICAL-proven-current-exact-block'};
      if(relation.to==='embedded yield')return {...relation,class:embedded.accepted?'MECHANICAL-proven-adjacent-checkpoints':'MECHANICAL-warming-adjacent-checkpoints'};
      return relation;
    });
  }else{
    surface.measurementState='UNKNOWN-current-onchain-read-unavailable';
    surface.measured=measurement||unknownMeasurement(source,'UNKNOWN-current-onchain-read-unavailable');
  }

  const entries=Object.entries(current.surfaces||{}),surfaces=entries.map(([,value])=>value);
  current.coverage.surfaceCount=entries.length;
  current.coverage.surfaceIds=surfaces.map(item=>item.id);
  current.coverage.measuredSurfaceCount=surfaces.filter(item=>String(item.measurementState||'').startsWith('MEASURED')).length;
  current.coverage.sourceBoundUnknownSurfaceCount=current.coverage.surfaceCount-current.coverage.measuredSurfaceCount;
  current.relationshipGraph=surfaces.flatMap(item=>item.mechanicalRelations.map((relation,index)=>({surfaceId:item.id,index,...relation})));
  current.coverage.relationshipCount=current.relationshipGraph.length;
  current.coverage.relationshipClassCounts=current.relationshipGraph.reduce((acc,relation)=>{const key=String(relation.class||'UNKNOWN').split('-')[0];acc[key]=(acc[key]||0)+1;return acc;},{});
  current.status=current.coverage.sourceBoundUnknownSurfaceCount===0?'deep-sensor-family-fully-measured':'deep-sensor-family-active-partial-measurement';
  current.scopeExtensions={...(current.scopeExtensions||{}),frxEth:{version:FRAX_FRXETH_CURRENT_STATE_VERSION,surfaceKey:FRAX_FRXETH_SURFACE_KEY,surfaceId:surface.id,sourceRegistryVersion:source.version}};
  current.measurementExtensions={...(current.measurementExtensions||{}),frxEthCurrentState:FRAX_FRXETH_CURRENT_STATE_VERSION};
  current.epistemic.measuredEconomicSurfaces=surfaces.filter(item=>String(item.measurementState||'').startsWith('MEASURED')).map(item=>item.id);
  current.epistemic.frxEthCurrentState=valid?'MEASURED-current-Ethereum-asset-vault-state':'UNKNOWN';
  current.epistemic.frxEthOperationalTopology=valid?'MEASURED-deployed-code-presence-only':'UNKNOWN';
  current.epistemic.frxEthValidatorEconomics='UNKNOWN-not-measured-by-this-atom';
  current.epistemic.frxEthLendingIncome='UNKNOWN-not-measured-by-this-atom';
  current.epistemic.frxEthProtocolRevenueUsd='UNKNOWN';
  current.epistemic.frxEthCompanyCashFlow='UNKNOWN';
  current.nextMeasurementUnlocks=[...(current.nextMeasurementUnlocks||[]).filter(item=>!String(item).startsWith('Measure frxETH V2')),'Measure frxETH V2 EtherRouter consolidated balance, LendingPool borrowing/utilization/rate/interest, redemption-queue state and validator-pool credit as separate bounded sub-atoms.'];
  current.id=`frax-ecosystem:${sha256(stableStringify({baseObservationId:baseCurrent.id,scopeExtensions:current.scopeExtensions,frxEth:valid?{blockNumber:measurement.blockNumber,blockHash:measurement.blockHash,assetSupply:measurement.asset.totalSupply,vaultSupply:measurement.vault.totalSupply,vaultTotalAssets:measurement.vault.totalAssets,sharePriceAsset:measurement.vault.sharePriceAsset}:{status:measurement?.status||'UNKNOWN'}})).slice(0,24)}`;

  const previousRows=Array.isArray(previousState?.protocolEvidence?.[FRAX_ECOSYSTEM_EVIDENCE_ID]?.observations)?previousState.protocolEvidence[FRAX_ECOSYSTEM_EVIDENCE_ID].observations:[];
  const rows=[...previousRows];if(!rows.some(row=>row?.id===current.id))rows.push(current);const bounded=rows.slice(-MAX_OBSERVATIONS);
  evidence.latest={observation:current};evidence.status=current.status;evidence.observations=bounded;evidence.observationCount=bounded.length;evidence.measurementExtensions={...(evidence.measurementExtensions||{}),frxEthCurrentState:FRAX_FRXETH_CURRENT_STATE_VERSION};
  fraxSensor.ecosystemFamily={...(fraxSensor.ecosystemFamily||{}),status:current.status,surfaceCount:current.coverage.surfaceCount,measuredSurfaceCount:current.coverage.measuredSurfaceCount,sourceBoundUnknownSurfaceCount:current.coverage.sourceBoundUnknownSurfaceCount,latestObservationId:current.id,scopeExtensions:current.scopeExtensions,measurementExtensions:{...(fraxSensor.ecosystemFamily?.measurementExtensions||{}),frxEthCurrentState:FRAX_FRXETH_CURRENT_STATE_VERSION}};
  if(fraxSensor?.latest?.observation)fraxSensor.latest.observation.ecosystemFamily=fraxSensor.ecosystemFamily;

  if(current.coverage.surfaceCount!==10)throw new Error(`frxETH scope extension expected 10 Frax surfaces, got ${current.coverage.surfaceCount}`);
  if(current.coverage.relationshipCount!==current.relationshipGraph.length)throw new Error('Frax frxETH relationship graph count drift');
  if(valid&&!String(surface.measurementState).startsWith('MEASURED'))throw new Error('Valid frxETH state was not measured');
  if(current?.authority?.executionAuthority!=='none'||current?.epistemic?.executionAuthority!=='none'||surface?.measured?.epistemic?.executionAuthority!=='none')throw new Error('Frax frxETH execution authority leaked');
  return state;
}
