#!/usr/bin/env node
/**
 * The Holding · Frax frxETH V2 LendingPool exact-block state v0.1
 *
 * Measures bounded read-only LendingPool state at the same Ethereum checkpoint
 * already selected by the base frxETH atom. It reads protocol-native borrow,
 * utilization, rate and interest state plus a view-only addInterest preview.
 * The preview is not execution and is never promoted to realized protocol
 * revenue or company cash flow.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const FRAX_FRXETH_V2_LENDING_POOL_VERSION='0.1-frxeth-v2-lending-pool-exact-block';
export const FRAX_ECOSYSTEM_EVIDENCE_ID='registry-frax-ecosystem';
export const FRAX_PROTOCOL_ID='registry-frax-vefrax';
export const FRAX_FRXETH_SURFACE_KEY='frxEthSfrxEth';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const REGISTRY_FILE=path.join(ROOT,'intelligence/economic-graph/frax-frxeth-registry.json');
const RPC_REGISTRY_FILE=path.join(ROOT,'intelligence/market-data/onchain-price-source-registry.json');
const RPC_TIMEOUT_MS=10_000;
const MAX_OBSERVATIONS=1000;
const EXPECTED_SOURCE_COMMIT='83dfe93b4a32b9ca0ab93d6e7c059fcd977320d4';
const SECONDS_PER_YEAR=31_556_736;
const SELECTORS={
  totalBorrow:'0x8285ef40',
  currentRateInfo:'0x95d14ca8',
  utilizationView:'0x6b3ecd4a',
  maxBorrow:'0xaf833d42',
  interestAccrued:'0x20dcc342',
  previewAddInterest:'0xcacf3b58',
  rateCalculator:'0x0df8dfac',
  redemptionQueue:'0x97ec19be',
  etherRouter:'0xc9cb9497',
  frxETH:'0x565d3e6e',
  utilizationStored:'0x41810cf4',
  interestRatePrecision:'0x37525805',
  utilizationPrecision:'0xc11b96f0'
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
function utilizationPct(raw,precision){return precision>0n?round(Number(raw)*100/Number(precision),8):null;}
function annualizedRatePct(raw,precision){return precision>0n?round(Number(raw)*SECONDS_PER_YEAR*100/Number(precision),8):null;}

export function validateFraxFrxEthLendingPoolRegistry(registry){
  if(registry?.version!=='0.1-frxeth-current-state-registry'||registry?.network!=='ethereum'||Number(registry?.chainId)!==1)throw new Error('frxETH LendingPool registry identity drift');
  if(!validAddress(registry?.operations?.lendingPool)||!validAddress(registry?.operations?.etherRouter)||!validAddress(registry?.operations?.redemptionQueueV2)||!validAddress(registry?.operations?.variableInterestRate)||!validAddress(registry?.assets?.frxETH?.address))throw new Error('frxETH LendingPool registry addresses invalid');
  if(registry?.sources?.officialSourceRepo!=='FraxFinance/frxETH-v2-public'||registry?.sources?.officialSourceCommit!==EXPECTED_SOURCE_COMMIT)throw new Error('frxETH LendingPool official source pin drift');
  if(registry?.epistemic?.unknownIsZero!==false||registry?.epistemic?.executionAuthority!=='none'||registry?.epistemic?.causalClaimAuthority!=='none')throw new Error('frxETH LendingPool epistemic boundary drift');
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
    version:FRAX_FRXETH_V2_LENDING_POOL_VERSION,status:reason,measurementClass:'UNKNOWN',observedAt:null,network:'ethereum',chainId:1,blockNumber:null,blockTag:null,blockHash:null,
    lendingPool:{address:source?.operations?.lendingPool||null,deployedCodePresent:null,totalBorrow:null,interestAccrued:null,utilization:null,maxBorrow:null,currentRateInfo:null,rateCalculator:null,topology:null,registryPointerParity:null},
    preview:{status:'UNKNOWN',readOnly:true,interestEarned:null,feesAmount:null,feesShares:null,newCurrentRateInfo:null,totalBorrow:null},
    rpc:{endpointId:null,failoverAttempts:attempts,reusedCheckpoint:false},
    epistemic:{sourceType:'onchain-public-rpc-exact-block',currentStateMeasured:false,protocolNativeUtilization:false,storedInterestAccrued:'UNKNOWN',pendingInterestPreview:'UNKNOWN',protocolRevenue:'UNKNOWN',companyCashFlow:'UNKNOWN',validatorEconomics:'UNKNOWN',redemptionQueueDetailedState:'UNKNOWN',unknownIsZero:false,causalClaimAuthority:'none',executionAuthority:'none'}
  };
}

export async function collectFraxFrxEthV2LendingPoolCurrentState({registry=null,rpcRegistry=null,fetchImpl=fetch,checkpoint=null}={}){
  const source=validateFraxFrxEthLendingPoolRegistry(registry||readJson(REGISTRY_FILE));
  const rpc=rpcRegistry||readJson(RPC_REGISTRY_FILE),network=rpc?.networks?.ethereum,endpoints=Array.isArray(network?.rpcFailover)?network.rpcFailover:[],attempts=[];
  if(Number(network?.chainId)!==1||!endpoints.length)throw new Error('Ethereum RPC registry unavailable');
  const lendingPool=source.operations.lendingPool;
  for(const endpoint of endpoints){
    try{
      let blockTag=checkpoint?.blockTag||null;
      if(!blockTag){const head=await postBatch(endpoint.url,[{jsonrpc:'2.0',id:1,method:'eth_blockNumber',params:[]}],fetchImpl);blockTag=head.get(1).result;}
      if(!/^0x[0-9a-f]+$/i.test(String(blockTag)))throw new Error('Invalid exact block tag');
      const rows=await postBatch(endpoint.url,[
        {jsonrpc:'2.0',id:2,method:'eth_getBlockByNumber',params:[blockTag,false]},
        {jsonrpc:'2.0',id:3,method:'eth_getCode',params:[lendingPool,blockTag]},
        call(10,lendingPool,SELECTORS.totalBorrow,blockTag),
        call(11,lendingPool,SELECTORS.interestAccrued,blockTag),
        call(12,lendingPool,SELECTORS.utilizationStored,blockTag),
        call(13,lendingPool,SELECTORS.utilizationView,blockTag),
        call(14,lendingPool,SELECTORS.maxBorrow,blockTag),
        call(15,lendingPool,SELECTORS.currentRateInfo,blockTag),
        call(16,lendingPool,SELECTORS.rateCalculator,blockTag),
        call(17,lendingPool,SELECTORS.etherRouter,blockTag),
        call(18,lendingPool,SELECTORS.redemptionQueue,blockTag),
        call(19,lendingPool,SELECTORS.frxETH,blockTag),
        call(20,lendingPool,SELECTORS.interestRatePrecision,blockTag),
        call(21,lendingPool,SELECTORS.utilizationPrecision,blockTag)
      ],fetchImpl);
      const block=rows.get(2).result,blockNumber=Number(decodeQuantity(block?.number||blockTag)),timestampSeconds=Number(decodeQuantity(block?.timestamp));
      if(!(blockNumber>0)||!(timestampSeconds>0)||!/^0x[0-9a-f]{64}$/i.test(String(block?.hash||'')))throw new Error('Exact block identity unavailable');
      const deployed=String(rows.get(3).result||'');if(!/^0x[0-9a-f]+$/i.test(deployed)||deployed==='0x'||deployed==='0x0')throw new Error('LendingPool deployed code missing');

      const totalBorrowAmount=decodeWord(rows.get(10).result,0),totalBorrowShares=decodeWord(rows.get(10).result,1);
      const interestAccrued=decodeWord(rows.get(11).result),utilizationStored=decodeWord(rows.get(12).result),utilizationLive=decodeWord(rows.get(13).result),maxBorrow=decodeWord(rows.get(14).result);
      const lastTimestamp=decodeWord(rows.get(15).result,0),ratePerSec=decodeWord(rows.get(15).result,1),fullUtilizationRate=decodeWord(rows.get(15).result,2);
      const rateCalculator=decodeAddress(rows.get(16).result),etherRouter=decodeAddress(rows.get(17).result),redemptionQueue=decodeAddress(rows.get(18).result),frxETH=decodeAddress(rows.get(19).result);
      const interestPrecision=decodeWord(rows.get(20).result),utilizationPrecision=decodeWord(rows.get(21).result);
      if(interestPrecision!==10n**18n||utilizationPrecision!==100_000n)throw new Error('LendingPool precision contract drift');

      const pointerParity={
        rateCalculator:normalize(rateCalculator)===normalize(source.operations.variableInterestRate),
        etherRouter:normalize(etherRouter)===normalize(source.operations.etherRouter),
        redemptionQueue:normalize(redemptionQueue)===normalize(source.operations.redemptionQueueV2),
        frxETH:normalize(frxETH)===normalize(source.assets.frxETH.address)
      };
      const registryPointerParity=Object.values(pointerParity).every(Boolean);

      let preview={status:'UNKNOWN-preview-call-unavailable',readOnly:true,interestEarned:null,feesAmount:null,feesShares:null,newCurrentRateInfo:null,totalBorrow:null};
      try{
        const previewRows=await postBatch(endpoint.url,[call(30,lendingPool,SELECTORS.previewAddInterest,blockTag)],fetchImpl);
        const packed=previewRows.get(30).result;
        const previewInterest=decodeWord(packed,0),previewFees=decodeWord(packed,1),previewFeeShares=decodeWord(packed,2);
        const previewLastTimestamp=decodeWord(packed,3),previewRatePerSec=decodeWord(packed,4),previewFullUtilizationRate=decodeWord(packed,5),previewBorrowAmount=decodeWord(packed,6),previewBorrowShares=decodeWord(packed,7);
        preview={
          status:'MEASURED-read-only-preview-not-realized',readOnly:true,
          interestEarned:{raw:previewInterest.toString(),eth:round(units(previewInterest))},
          feesAmount:{raw:previewFees.toString(),eth:round(units(previewFees))},
          feesShares:{raw:previewFeeShares.toString(),shares:round(units(previewFeeShares))},
          newCurrentRateInfo:{lastTimestamp:Number(previewLastTimestamp),ratePerSecRaw:previewRatePerSec.toString(),annualizedNominalRatePct:annualizedRatePct(previewRatePerSec,interestPrecision),fullUtilizationRateRaw:previewFullUtilizationRate.toString(),fullUtilizationAnnualizedNominalRatePct:annualizedRatePct(previewFullUtilizationRate,interestPrecision)},
          totalBorrow:{amountRaw:previewBorrowAmount.toString(),amountEth:round(units(previewBorrowAmount)),sharesRaw:previewBorrowShares.toString(),shares:round(units(previewBorrowShares))}
        };
      }catch(error){preview={...preview,status:`UNKNOWN-${String(error instanceof Error?error.message:error).replace(/\s+/g,'-').slice(0,120)}`};}

      return {
        version:FRAX_FRXETH_V2_LENDING_POOL_VERSION,status:'ok',measurementClass:'MEASURED',observedAt:new Date(timestampSeconds*1000).toISOString(),network:'ethereum',chainId:1,blockNumber,blockTag,blockHash:block.hash,
        sourceRegistryVersion:source.version,
        sourceBinding:{officialSourceRepo:source.sources.officialSourceRepo,officialSourceCommit:source.sources.officialSourceCommit,lendingPoolCoreSource:'src/contracts/lending-pool/LendingPoolCore.sol',lendingPoolSource:'src/contracts/lending-pool/LendingPool.sol',lendingPoolInterface:'src/contracts/lending-pool/interfaces/ILendingPool.sol',rateModelSource:'src/contracts/lending-pool/VariableInterestRate.sol',utilizationFunction:'getUtilizationView()',interestPreviewFunction:'previewAddInterest()'},
        lendingPool:{
          address:lendingPool,deployedCodePresent:true,
          totalBorrow:{amountRaw:totalBorrowAmount.toString(),amountEth:round(units(totalBorrowAmount)),sharesRaw:totalBorrowShares.toString(),shares:round(units(totalBorrowShares))},
          interestAccrued:{raw:interestAccrued.toString(),eth:round(units(interestAccrued)),semantics:'stored cumulative ETH interest accrued by lending'},
          utilization:{precisionRaw:utilizationPrecision.toString(),storedRaw:utilizationStored.toString(),storedPct:utilizationPct(utilizationStored,utilizationPrecision),liveRaw:utilizationLive.toString(),livePct:utilizationPct(utilizationLive,utilizationPrecision),liveSource:'protocol-native getUtilizationView()'},
          maxBorrow:{raw:maxBorrow.toString(),eth:round(units(maxBorrow)),source:'protocol-native getMaxBorrow()'},
          currentRateInfo:{lastTimestamp:Number(lastTimestamp),ratePerSecRaw:ratePerSec.toString(),annualizedNominalRatePct:annualizedRatePct(ratePerSec,interestPrecision),fullUtilizationRateRaw:fullUtilizationRate.toString(),fullUtilizationAnnualizedNominalRatePct:annualizedRatePct(fullUtilizationRate,interestPrecision),annualizationSecondsPerYear:SECONDS_PER_YEAR,interestRatePrecisionRaw:interestPrecision.toString()},
          rateCalculator,
          topology:{etherRouter,redemptionQueue,frxETH},
          registryPointerParity,pointerParity
        },
        preview,
        rpc:{endpointId:endpoint.id,failoverAttempts:attempts,reusedCheckpoint:Boolean(checkpoint?.blockTag)},
        epistemic:{sourceType:'onchain-public-rpc-exact-block',currentStateMeasured:true,protocolNativeUtilization:true,storedInterestAccrued:'MEASURED-onchain-counter',pendingInterestPreview:preview.status.startsWith('MEASURED')?'MEASURED-read-only-preview-not-realized':'UNKNOWN',pendingFeePreview:preview.status.startsWith('MEASURED')?'MEASURED-read-only-preview-not-realized':'UNKNOWN',rateAnnualization:'DERIVED-MECHANICAL-source-defined-365.24-day-year',registryPointerParity,topologyDriftDetected:!registryPointerParity,protocolRevenue:'UNKNOWN-not-proven-as-realized-or-routed-by-this-atom',companyCashFlow:'UNKNOWN-not-measured-by-this-atom',validatorEconomics:'UNKNOWN-not-measured-by-this-atom',redemptionQueueDetailedState:'UNKNOWN-not-measured-by-this-atom',unknownIsZero:false,causalClaimAuthority:'none',executionAuthority:'none'}
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

export function applyFraxFrxEthV2LendingPoolCurrentState({state,measurement}){
  if(!state||typeof state!=='object')throw new Error('Frax frxETH V2 LendingPool adapter requires Economic Graph state');
  if(state?.authority?.executionAuthority!=='none'||state?.authority?.causalClaimAuthority!=='none')throw new Error('Frax frxETH V2 LendingPool adapter refuses Graph authority drift');
  const evidence=state?.protocolEvidence?.[FRAX_ECOSYSTEM_EVIDENCE_ID],current=evidence?.latest?.observation;
  if(!current||current.protocolId!==FRAX_PROTOCOL_ID)throw new Error('Frax frxETH V2 LendingPool adapter requires Frax ecosystem observation');
  const surface=current?.surfaces?.[FRAX_FRXETH_SURFACE_KEY];
  if(!surface||!String(surface.measurementState||'').startsWith('MEASURED'))throw new Error('Frax frxETH V2 LendingPool adapter requires measured frxETH surface');
  if(!surface?.measured?.v2Internals?.etherRouter)throw new Error('Frax frxETH V2 LendingPool adapter requires prior EtherRouter sub-atom');
  const coverageBefore={surfaceCount:current.coverage.surfaceCount,measuredSurfaceCount:current.coverage.measuredSurfaceCount,sourceBoundUnknownSurfaceCount:current.coverage.sourceBoundUnknownSurfaceCount};

  surface.measured.v2Internals=surface.measured.v2Internals||{};
  surface.measured.v2Internals.lendingPool=measurement;
  surface.measured.epistemic=surface.measured.epistemic||{};

  const measured=measurement?.status==='ok'&&measurement?.measurementClass==='MEASURED';
  surface.measured.epistemic.lendingPoolBorrowState=measured?'MEASURED-current-Ethereum-exact-block':'UNKNOWN';
  surface.measured.epistemic.lendingPoolUtilization=measured?'MEASURED-protocol-native-view-exact-block':'UNKNOWN';
  surface.measured.epistemic.lendingPoolRate=measured?'MEASURED-plus-DERIVED-mechanical-annualization':'UNKNOWN';
  surface.measured.epistemic.lendingPoolInterestAccrued=measured?'MEASURED-onchain-counter':'UNKNOWN';
  surface.measured.epistemic.lendingPoolPendingInterestPreview=measured?measurement.epistemic.pendingInterestPreview:'UNKNOWN';
  surface.measured.epistemic.lendingPoolProtocolRevenue='UNKNOWN-not-proven-as-realized-or-routed-by-this-atom';
  surface.measured.epistemic.validatorEconomics='UNKNOWN-not-measured-by-this-atom';
  surface.measured.epistemic.executionAuthority='none';

  current.epistemic.frxEthV2LendingPoolBorrowState=measured?'MEASURED-current-Ethereum-exact-block':'UNKNOWN';
  current.epistemic.frxEthV2LendingPoolUtilization=measured?'MEASURED-protocol-native-view-exact-block':'UNKNOWN';
  current.epistemic.frxEthV2LendingPoolRate=measured?'MEASURED-plus-DERIVED-mechanical-annualization':'UNKNOWN';
  current.epistemic.frxEthV2LendingPoolInterestAccrued=measured?'MEASURED-onchain-counter':'UNKNOWN';
  current.epistemic.frxEthV2LendingPoolPendingInterestPreview=measured?measurement.epistemic.pendingInterestPreview:'UNKNOWN';
  current.epistemic.frxEthV2LendingPoolProtocolRevenue='UNKNOWN';
  current.epistemic.frxEthV2ValidatorEconomics='UNKNOWN';

  surface.mechanicalRelations=(surface.mechanicalRelations||[]).filter(item=>item?.extension!=='frxeth-v2-lending-pool');
  surface.mechanicalRelations.push(
    {from:'LendingPool.totalBorrow/currentRateInfo/interestAccrued',to:'frxETH V2 lending state',class:measured?'MEASURED-exact-block-state':'UNKNOWN',extension:'frxeth-v2-lending-pool',note:'Same exact-block LendingPool state; no revenue attribution.'},
    {from:'LendingPool.getUtilizationView()',to:'live borrowing utilization',class:measured?'MEASURED-protocol-native-view':'UNKNOWN',extension:'frxeth-v2-lending-pool',note:'Uses Frax protocol-native utilization calculation; The Holding does not re-derive the denominator.'},
    {from:'LendingPool.previewAddInterest()',to:'pending interest and fee preview',class:measured&&String(measurement?.preview?.status||'').startsWith('MEASURED')?'MEASURED-read-only-preview':'UNKNOWN',extension:'frxeth-v2-lending-pool',note:'View-only preview, not execution and not realized protocol revenue.'},
    {from:'LendingPool topology pointers',to:'source-pinned EtherRouter/RedemptionQueue/frxETH/rate model identities',class:measured&&measurement?.lendingPool?.registryPointerParity?'MEASURED-identity-parity':'UNKNOWN',extension:'frxeth-v2-lending-pool',note:'Mechanical pointer parity only; no causal routing claim.'}
  );

  current.measurementExtensions={...(current.measurementExtensions||{}),frxEthV2LendingPoolCurrentState:FRAX_FRXETH_V2_LENDING_POOL_VERSION};
  current.nextMeasurementUnlocks=(current.nextMeasurementUnlocks||[]).filter(item=>!String(item).startsWith('Measure frxETH V2 '));
  current.nextMeasurementUnlocks.push(measured?'Measure frxETH V2 RedemptionQueue state and validator-pool credit as separate bounded sub-atoms.':'Measure frxETH V2 LendingPool borrowing/utilization/rate/interest from exact-block source-pinned state.');

  if(current.coverage.surfaceCount!==coverageBefore.surfaceCount||current.coverage.measuredSurfaceCount!==coverageBefore.measuredSurfaceCount||current.coverage.sourceBoundUnknownSurfaceCount!==coverageBefore.sourceBoundUnknownSurfaceCount)throw new Error('frxETH V2 LendingPool sub-atom must not change top-level Frax coverage');
  rebuildRelationships(current);
  current.authority={...(current.authority||{}),causalClaimAuthority:'none',executionAuthority:'none'};
  current.observedAt=state.generatedAt||current.observedAt;
  current.id=`frax-ecosystem:${sha256(stableStringify({baseObservationId:current.id||null,extension:FRAX_FRXETH_V2_LENDING_POOL_VERSION,blockHash:measurement?.blockHash||null,totalBorrow:measurement?.lendingPool?.totalBorrow?.amountRaw||null,utilization:measurement?.lendingPool?.utilization?.liveRaw||null,rate:measurement?.lendingPool?.currentRateInfo?.ratePerSecRaw||null,interestAccrued:measurement?.lendingPool?.interestAccrued?.raw||null,preview:measurement?.preview?.status||null,pointerParity:measurement?.lendingPool?.registryPointerParity??null,executionAuthority:'none'})).slice(0,16)}`;

  evidence.latest={observedAt:current.observedAt,observation:current};
  const observations=Array.isArray(evidence.observations)?evidence.observations:[];
  evidence.observations=[...observations,current].slice(-MAX_OBSERVATIONS);
  evidence.observationCount=evidence.observations.length;
  evidence.status=current.status;
  const sensor=state?.protocolSensors?.[FRAX_PROTOCOL_ID];
  if(sensor){sensor.ecosystemFamily=sensor.ecosystemFamily||{};sensor.ecosystemFamily.measurementExtensions=current.measurementExtensions;sensor.ecosystemFamily.coverage=current.coverage;sensor.ecosystemFamily.latestEvidenceId=current.id;sensor.epistemic={...(sensor.epistemic||{}),frxEthV2LendingPoolCurrentState:measured?'MEASURED':'UNKNOWN',executionAuthority:'none'};}
  if(current.authority.executionAuthority!=='none')throw new Error('Frax frxETH V2 LendingPool execution authority drift');
  return current;
}
