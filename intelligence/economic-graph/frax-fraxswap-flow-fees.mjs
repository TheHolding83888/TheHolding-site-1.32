#!/usr/bin/env node
/**
 * The Holding · Fraxtal Fraxswap regular-swap flow + gross fee sensor v0.1
 *
 * Measures a bounded non-overlapping published-checkpoint interval for every
 * Fraxswap pair already proven by the registry-wide BAMM sensor. Ordinary Swap
 * logs are kept separate from TWAMM virtual-order flow. Gross AMM input-fee
 * units are reproduced from the exact FraxswapPair fee accounting identity.
 *
 * This does NOT claim that gross swap fees equal LP realised income or protocol
 * revenue. Fraxswap _mintFee / feeTo routing is a separate accounting path.
 * No execution, price, recommendation, methodology or causal authority.
 */
import crypto from 'node:crypto';
import {
  FRAX_ECOSYSTEM_EVIDENCE_ID,
  FRAX_PROTOCOL_ID,
  FRAXTAL_CHAIN_ID,
  FRAXTAL_RPC_ENDPOINTS
} from './frax-bamm-onchain.mjs';

export const FRAX_FRAXSWAP_FLOW_FEES_VERSION='0.1-fraxtal-fraxswap-regular-swap-flow-fees';
export const FRAXSWAP_SOURCE_REF='30532c8cefcbf5c7efafcff4369261bd435a4859';
const RPC_TIMEOUT_MS=12_000;
const MAX_PAIRS=250;
const MAX_BATCH_CALLS=120;
const MAX_LOG_BLOCK_SPAN=4000n;
const MAX_OBSERVATIONS=1000;
const FEE_DENOMINATOR=10000n;
const DECIMALS_SELECTOR='0x313ce567';

function sha256(value){return crypto.createHash('sha256').update(value).digest('hex');}
function stableValue(value){if(Array.isArray(value))return value.map(stableValue);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(k=>[k,stableValue(value[k])]));return value;}
function stableStringify(value){return JSON.stringify(stableValue(value));}
function normalizeAddress(v){return String(v||'').toLowerCase();}
function sameAddress(a,b){return normalizeAddress(a)===normalizeAddress(b);}
function hexQuantity(v){return `0x${BigInt(v).toString(16)}`;}
function rpcQuantity(v){if(!/^0x[0-9a-f]+$/i.test(String(v||'')))throw new Error('Invalid RPC quantity');return BigInt(v);}
function cleanAbi(hex){const x=String(hex||'').replace(/^0x/,'');if(!x.length||x.length%64!==0||!/^[0-9a-f]+$/i.test(x))throw new Error('Invalid ABI result');return x;}
function words(hex){const x=cleanAbi(hex),out=[];for(let i=0;i<x.length;i+=64)out.push(BigInt(`0x${x.slice(i,i+64)}`));return out;}
function word(hex){const out=words(hex);if(!out.length)throw new Error('Missing ABI word');return out[0];}
function asciiHex(value){return `0x${Buffer.from(value,'utf8').toString('hex')}`;}
function formatUnits(raw,decimals){
  const n=BigInt(raw),d=BigInt(decimals);if(d<0n||d>255n)throw new Error('Invalid token decimals');
  const base=10n**d,whole=n/base,frac=(n%base).toString().padStart(Number(d),'0').replace(/0+$/,'');return frac?`${whole}.${frac}`:whole.toString();
}
function safeNumber(v,label){const n=Number(v);if(!Number.isSafeInteger(n))throw new Error(`${label} outside safe integer range`);return n;}
function topicAddress(topic){const x=String(topic||'').replace(/^0x/,'');if(x.length!==64)return null;return `0x${x.slice(24)}`;}

async function postBatch(url,payload,fetchImpl){
  const response=await fetchImpl(url,{method:'POST',headers:{'content-type':'application/json',accept:'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(RPC_TIMEOUT_MS)});
  if(!response.ok)throw new Error(`RPC HTTP ${response.status}`);
  const body=await response.json();if(!Array.isArray(body))throw new Error('RPC response is not an array');
  const byId=new Map(body.map(r=>[Number(r?.id),r]));
  for(const req of payload){const r=byId.get(req.id);if(!r)throw new Error(`RPC result ${req.id} missing`);if(r.error)throw new Error(`RPC ${req.method} error: ${r.error?.message||'unknown'}`);if(r.result===undefined||r.result===null)throw new Error(`RPC ${req.method} result missing`);}
  return byId;
}
async function batched(url,payload,fetchImpl){const out=new Map();for(let i=0;i<payload.length;i+=MAX_BATCH_CALLS){const x=await postBatch(url,payload.slice(i,i+MAX_BATCH_CALLS),fetchImpl);for(const [k,v] of x)out.set(k,v);}return out;}

function unknown({current,previous,attempts,reason='UNKNOWN-fraxswap-flow-fee-read-failed',coverage=null}={}){
  return {
    version:FRAX_FRAXSWAP_FLOW_FEES_VERSION,status:reason,measurementClass:'UNKNOWN',observedAt:current?.observedAt||null,chain:'fraxtal',chainId:FRAXTAL_CHAIN_ID,
    interval:{fromBlockExclusive:previous?.blockNumber??null,toBlockInclusive:current?.blockNumber??null,fromBlockHash:previous?.blockHash||null,toBlockHash:current?.blockHash||null,fromObservedAt:previous?.observedAt||null,toObservedAt:current?.observedAt||null,nonOverlappingPublishedCheckpointInterval:false},
    coverage:coverage||{currentRegistryPairCount:Array.isArray(current?.bamms)?current.bamms.length:null,previousRegistryPairCount:Array.isArray(previous?.bamms)?previous.bamms.length:null,commonPairCount:null,newPairCount:null,removedPairCount:null,fullRegistryInterval:false},
    pairs:[],rpc:{endpointId:null,failoverAttempts:attempts||[]},
    provenance:{officialSourceRepository:'FraxFinance/frax-solidity',officialSourceRef:FRAXSWAP_SOURCE_REF,sourceContract:'FraxswapPair.sol',event:'Swap(address,uint256,uint256,uint256,uint256,address)',feeEvent:'LpFeeUpdated(uint256)'},
    epistemic:{regularSwapFlow:'UNKNOWN',grossInputFeeUnits:'UNKNOWN',twammFlow:'EXCLUDED-separate-mechanism',feeRecipientSplit:'UNKNOWN',unknownIsZero:false,protocolWideUsdVolumeClaim:false,realizedLpIncomeClaim:false,protocolRevenueClaim:false,causalClaimAuthority:'none',executionAuthority:'none'}
  };
}

function validateMeasurement(m,label){
  if(m?.status!=='ok'||m?.measurementClass!=='MEASURED'||m?.chainId!==FRAXTAL_CHAIN_ID||!m?.blockTag||!m?.blockHash||!Array.isArray(m?.bamms)||!m?.registry?.allRegistryIdentitiesProven)throw new Error(`${label} BAMM measurement unavailable`);
  if(m.bamms.length<1||m.bamms.length>MAX_PAIRS||m.bamms.length!==Number(m.registry.bammCount))throw new Error(`${label} BAMM registry count invalid`);
}

export async function collectFraxswapFlowFees({currentBammMeasurement,previousBammMeasurement,endpoints=FRAXTAL_RPC_ENDPOINTS,fetchImpl=fetch}={}){
  const attempts=[];
  try{validateMeasurement(currentBammMeasurement,'Current');validateMeasurement(previousBammMeasurement,'Previous');}catch(error){return unknown({current:currentBammMeasurement,previous:previousBammMeasurement,attempts:[{endpointId:null,error:error.message}],reason:'UNKNOWN-published-bamm-checkpoint-pair-unavailable'});}
  const startBlock=BigInt(previousBammMeasurement.blockNumber),endBlock=BigInt(currentBammMeasurement.blockNumber);
  if(endBlock<=startBlock)return unknown({current:currentBammMeasurement,previous:previousBammMeasurement,attempts,reason:'UNKNOWN-no-forward-published-block-interval'});

  const previousByPair=new Map(previousBammMeasurement.bamms.map(r=>[normalizeAddress(r.pair),r]));
  const currentByPair=new Map(currentBammMeasurement.bamms.map(r=>[normalizeAddress(r.pair),r]));
  if(previousByPair.size!==previousBammMeasurement.bamms.length||currentByPair.size!==currentBammMeasurement.bamms.length)return unknown({current:currentBammMeasurement,previous:previousBammMeasurement,attempts,reason:'UNKNOWN-duplicate-fraxswap-pair-identity'});
  const common=[];const newPairs=[];const removedPairs=[];
  for(const row of currentBammMeasurement.bamms){const prev=previousByPair.get(normalizeAddress(row.pair));if(!prev){newPairs.push(row.pair);continue;}if(!sameAddress(prev.bamm,row.bamm)||!sameAddress(prev.token0,row.token0)||!sameAddress(prev.token1,row.token1))return unknown({current:currentBammMeasurement,previous:previousBammMeasurement,attempts,reason:'UNKNOWN-fraxswap-pair-identity-drift'});common.push(row);}
  for(const row of previousBammMeasurement.bamms)if(!currentByPair.has(normalizeAddress(row.pair)))removedPairs.push(row.pair);
  const coverage={currentRegistryPairCount:currentByPair.size,previousRegistryPairCount:previousByPair.size,commonPairCount:common.length,newPairCount:newPairs.length,removedPairCount:removedPairs.length,newPairs,removedPairs,fullRegistryInterval:newPairs.length===0&&removedPairs.length===0&&common.length===currentByPair.size};
  if(common.length<1)return unknown({current:currentBammMeasurement,previous:previousBammMeasurement,attempts,reason:'UNKNOWN-no-common-published-fraxswap-pairs',coverage});

  const preferred=currentBammMeasurement?.rpc?.endpointId;const ordered=[...endpoints].sort((a,b)=>(a.id===preferred?-1:0)-(b.id===preferred?-1:0));
  for(const endpoint of ordered){
    try{
      const sig=await postBatch(endpoint.url,[
        {jsonrpc:'2.0',id:1,method:'web3_sha3',params:[asciiHex('fee()')]},
        {jsonrpc:'2.0',id:2,method:'web3_sha3',params:[asciiHex('Swap(address,uint256,uint256,uint256,uint256,address)')]},
        {jsonrpc:'2.0',id:3,method:'web3_sha3',params:[asciiHex('LpFeeUpdated(uint256)')]},
        {jsonrpc:'2.0',id:4,method:'eth_getBlockByNumber',params:[previousBammMeasurement.blockTag,false]},
        {jsonrpc:'2.0',id:5,method:'eth_getBlockByNumber',params:[currentBammMeasurement.blockTag,false]}
      ],fetchImpl);
      const feeHash=String(sig.get(1).result),swapTopic=String(sig.get(2).result).toLowerCase(),feeTopic=String(sig.get(3).result).toLowerCase(),feeSelector=feeHash.slice(0,10);
      if(!/^0x[0-9a-f]{64}$/i.test(feeHash)||!/^0x[0-9a-f]{64}$/i.test(swapTopic)||!/^0x[0-9a-f]{64}$/i.test(feeTopic)||!/^0x[0-9a-f]{8}$/i.test(feeSelector))throw new Error('Fraxswap signature hash derivation failed');
      const startMeta=sig.get(4).result,endMeta=sig.get(5).result;
      if(String(startMeta?.hash||'').toLowerCase()!==String(previousBammMeasurement.blockHash).toLowerCase()||String(endMeta?.hash||'').toLowerCase()!==String(currentBammMeasurement.blockHash).toLowerCase())throw new Error('Published BAMM checkpoint block hash mismatch');

      let id=1000;const stateCalls=[];const ids=[];const uniqueTokens=new Map();
      for(const row of common){const x={row,startFeeId:id++};stateCalls.push({jsonrpc:'2.0',id:x.startFeeId,method:'eth_call',params:[{to:row.pair,data:feeSelector},previousBammMeasurement.blockTag]});x.endFeeId=id++;stateCalls.push({jsonrpc:'2.0',id:x.endFeeId,method:'eth_call',params:[{to:row.pair,data:feeSelector},currentBammMeasurement.blockTag]});ids.push(x);uniqueTokens.set(normalizeAddress(row.token0),row.token0);uniqueTokens.set(normalizeAddress(row.token1),row.token1);}
      const tokenIds=[];for(const token of uniqueTokens.values()){const x={token,id:id++};stateCalls.push({jsonrpc:'2.0',id:x.id,method:'eth_call',params:[{to:token,data:DECIMALS_SELECTOR},currentBammMeasurement.blockTag]});tokenIds.push(x);}
      const state=await batched(endpoint.url,stateCalls,fetchImpl);const decimals=new Map();for(const x of tokenIds){const d=word(state.get(x.id).result);if(d>255n)throw new Error(`Token decimals invalid ${x.token}`);decimals.set(normalizeAddress(x.token),Number(d));}

      const logCalls=[];const logMeta=[];for(const x of ids){for(let from=startBlock+1n;from<=endBlock;from+=MAX_LOG_BLOCK_SPAN){const to=from+MAX_LOG_BLOCK_SPAN-1n>endBlock?endBlock:from+MAX_LOG_BLOCK_SPAN-1n;const reqId=id++;logCalls.push({jsonrpc:'2.0',id:reqId,method:'eth_getLogs',params:[{address:x.row.pair,fromBlock:hexQuantity(from),toBlock:hexQuantity(to),topics:[[swapTopic,feeTopic]]}]});logMeta.push({reqId,pair:normalizeAddress(x.row.pair),from,to});}}
      const logsByPair=new Map(common.map(r=>[normalizeAddress(r.pair),[]]));
      if(logCalls.length){const logResults=await batched(endpoint.url,logCalls,fetchImpl);for(const meta of logMeta){const rows=logResults.get(meta.reqId).result;if(!Array.isArray(rows))throw new Error('Fraxswap logs response is not an array');for(const log of rows){if(!sameAddress(log?.address,meta.pair))throw new Error('Fraxswap log address mismatch');const b=rpcQuantity(log.blockNumber);if(b<meta.from||b>meta.to)throw new Error('Fraxswap log escaped requested block range');logsByPair.get(meta.pair).push(log);}}}

      const pairRows=[];
      for(const x of ids){
        const row=x.row,startStored=word(state.get(x.startFeeId).result),endStored=word(state.get(x.endFeeId).result);let feeBps=FEE_DENOMINATOR-startStored;const expectedEndBps=FEE_DENOMINATOR-endStored;
        if(feeBps<1n||feeBps>100n||expectedEndBps<1n||expectedEndBps>100n)throw new Error(`Fraxswap fee state outside source contract bounds ${row.pair}`);
        const logs=[...(logsByPair.get(normalizeAddress(row.pair))||[])].sort((a,b)=>{const ba=rpcQuantity(a.blockNumber),bb=rpcQuantity(b.blockNumber);if(ba!==bb)return ba<bb?-1:1;const ia=rpcQuantity(a.logIndex),ib=rpcQuantity(b.logIndex);return ia<ib?-1:ia>ib?1:0;});
        let amount0In=0n,amount1In=0n,amount0Out=0n,amount1Out=0n,fee0Numerator=0n,fee1Numerator=0n,swapCount=0,feeUpdateCount=0;const txs=new Set(),usage=new Map(),eventDigestRows=[];
        for(const log of logs){const t0=String(log?.topics?.[0]||'').toLowerCase();const blockNumber=rpcQuantity(log.blockNumber),logIndex=rpcQuantity(log.logIndex);if(t0===feeTopic){const newFee=word(log.data);if(newFee<1n||newFee>100n)throw new Error(`Fraxswap fee event outside source contract bounds ${row.pair}`);feeBps=newFee;feeUpdateCount++;eventDigestRows.push(['fee',blockNumber.toString(),logIndex.toString(),newFee.toString(),String(log.transactionHash||'')]);continue;}if(t0!==swapTopic)throw new Error('Unexpected Fraxswap event topic');const w=words(log.data);if(w.length!==4)throw new Error('Fraxswap Swap event ABI mismatch');const [a0i,a1i,a0o,a1o]=w;if(a0i===0n&&a1i===0n)throw new Error('Fraxswap Swap event has no input');amount0In+=a0i;amount1In+=a1i;amount0Out+=a0o;amount1Out+=a1o;fee0Numerator+=a0i*feeBps;fee1Numerator+=a1i*feeBps;swapCount++;txs.add(String(log.transactionHash||''));usage.set(feeBps.toString(),(usage.get(feeBps.toString())||0)+1);eventDigestRows.push(['swap',blockNumber.toString(),logIndex.toString(),a0i.toString(),a1i.toString(),a0o.toString(),a1o.toString(),feeBps.toString(),topicAddress(log?.topics?.[1]),topicAddress(log?.topics?.[2]),String(log.transactionHash||'')]);}
        if(feeBps!==expectedEndBps)throw new Error(`Fraxswap fee event/state parity mismatch ${row.pair}`);
        const d0=decimals.get(normalizeAddress(row.token0)),d1=decimals.get(normalizeAddress(row.token1));
        pairRows.push({pair:row.pair,bamm:row.bamm,token0:{address:row.token0,decimals:d0},token1:{address:row.token1,decimals:d1},
          interval:{fromBlockExclusive:safeNumber(startBlock,'start block'),toBlockInclusive:safeNumber(endBlock,'end block'),eventCount:logs.length,swapCount,feeUpdateCount,transactionCount:txs.size},
          feeSchedule:{startLpFeeBps:Number(FEE_DENOMINATOR-startStored),endLpFeeBps:Number(expectedEndBps),swapUsage:[...usage.entries()].map(([bps,count])=>({lpFeeBps:Number(bps),swapCount:count})).sort((a,b)=>a.lpFeeBps-b.lpFeeBps)},
          raw:{amount0In:amount0In.toString(),amount1In:amount1In.toString(),amount0Out:amount0Out.toString(),amount1Out:amount1Out.toString(),grossFee0Numerator:fee0Numerator.toString(),grossFee1Numerator:fee1Numerator.toString(),grossFeeDenominator:FEE_DENOMINATOR.toString()},
          values:{amount0InToken:formatUnits(amount0In,d0),amount1InToken:formatUnits(amount1In,d1),amount0OutToken:formatUnits(amount0Out,d0),amount1OutToken:formatUnits(amount1Out,d1),grossFee0Token:formatUnits(fee0Numerator,d0+4),grossFee1Token:formatUnits(fee1Numerator,d1+4)},
          eventDigest:sha256(stableStringify(eventDigestRows)),
          epistemic:{regularSwapFlow:'MEASURED-event-logs-exact-block-interval',grossInputFeeUnits:'DERIVED-MECHANICAL-FraxswapPair-invariant-fee-identity',twammFlow:'EXCLUDED-separate-mechanism',feeRecipientSplit:'UNKNOWN-until-mintFee-accounting',zeroSwapCountMeansMeasuredZero:true,realizedLpIncomeClaim:false,protocolRevenueClaim:false}});
      }

      const aggregateDigest=sha256(stableStringify(pairRows.map(r=>[r.pair,r.interval,r.raw,r.feeSchedule,r.eventDigest])));
      return {version:FRAX_FRAXSWAP_FLOW_FEES_VERSION,status:coverage.fullRegistryInterval?'ok':'partial-registry-identity-change',measurementClass:'MEASURED',observedAt:currentBammMeasurement.observedAt,chain:'fraxtal',chainId:FRAXTAL_CHAIN_ID,
        interval:{fromBlockExclusive:safeNumber(startBlock,'start block'),toBlockInclusive:safeNumber(endBlock,'end block'),fromBlockHash:previousBammMeasurement.blockHash,toBlockHash:currentBammMeasurement.blockHash,fromObservedAt:previousBammMeasurement.observedAt,toObservedAt:currentBammMeasurement.observedAt,nonOverlappingPublishedCheckpointInterval:true},
        coverage,pairs:pairRows,aggregateDigest,
        summary:{pairCountWithRegularSwaps:pairRows.filter(r=>r.interval.swapCount>0).length,regularSwapEventCount:pairRows.reduce((n,r)=>n+r.interval.swapCount,0),feeUpdateEventCount:pairRows.reduce((n,r)=>n+r.interval.feeUpdateCount,0),heterogeneousTokenUnitsNotAggregated:true},
        rpc:{endpointId:endpoint.id,failoverAttempts:attempts},
        provenance:{officialSourceRepository:'FraxFinance/frax-solidity',officialSourceRef:FRAXSWAP_SOURCE_REF,sourceContract:'src/hardhat/contracts/Fraxswap/core/FraxswapPair.sol',sourceMechanics:['Swap emits amount0In/amount1In/amount0Out/amount1Out','stored fee = 10000 - LP fee bps','swap invariant subtracts amountIn * LP fee bps from balance*10000'],derivedViaRpcSha3:true,event:'Swap(address,uint256,uint256,uint256,uint256,address)',feeEvent:'LpFeeUpdated(uint256)'},
        epistemic:{regularSwapFlow:coverage.fullRegistryInterval?'MEASURED-registry-wide-published-interval':'MEASURED-common-pairs-partial-registry-interval',grossInputFeeUnits:'DERIVED-MECHANICAL-source-proven-fee-formula',twammFlow:'EXCLUDED-separate-mechanism',feeRecipientSplit:'UNKNOWN-until-Fraxswap-_mintFee-feeTo-accounting',unknownIsZero:false,measuredZeroAllowedWithinProvenInterval:true,protocolWideUsdVolumeClaim:false,realizedLpIncomeClaim:false,protocolRevenueClaim:false,causalClaimAuthority:'none',executionAuthority:'none'}};
    }catch(error){attempts.push({endpointId:endpoint.id,error:error instanceof Error?error.message:String(error)});}
  }
  return unknown({current:currentBammMeasurement,previous:previousBammMeasurement,attempts,coverage});
}

export function applyFraxswapFlowFees({state,previousState,measurement}){
  if(!state||typeof state!=='object')throw new Error('Fraxswap flow adapter requires Economic Graph state');
  if(state?.authority?.executionAuthority!=='none'||state?.authority?.causalClaimAuthority!=='none')throw new Error('Fraxswap flow adapter refuses Graph authority drift');
  const evidence=state?.protocolEvidence?.[FRAX_ECOSYSTEM_EVIDENCE_ID],base=evidence?.latest?.observation,sensor=state?.protocolSensors?.[FRAX_PROTOCOL_ID],surface=base?.surfaces?.fraxswapBamm;
  if(!evidence||!base||!sensor||!surface?.measured||!String(surface.measurementState||'').startsWith('MEASURED'))throw new Error('Measured Fraxswap/BAMM surface missing before flow enrichment');
  const current=structuredClone(base),target=current.surfaces.fraxswapBamm;target.measured={...target.measured,swapFlowFees:measurement};
  const valid=measurement?.measurementClass==='MEASURED'&&measurement?.interval?.nonOverlappingPublishedCheckpointInterval===true&&Array.isArray(measurement?.pairs)&&measurement.pairs.length>0;
  if(valid){target.mechanicalRelations=target.mechanicalRelations.map(r=>r.from==='swap volume'&&r.to==='swap fees'?{...r,class:'MECHANICAL-proven-Fraxtal-regular-Swap-event-fee-path'}:r);}
  current.relationshipGraph=Object.values(current.surfaces||{}).flatMap(s=>s.mechanicalRelations.map((r,index)=>({surfaceId:s.id,index,...r})));current.coverage.relationshipCount=current.relationshipGraph.length;current.coverage.relationshipClassCounts=current.relationshipGraph.reduce((a,r)=>{const k=String(r.class||'UNKNOWN').split('-')[0];a[k]=(a[k]||0)+1;return a;},{});
  current.epistemic.fraxswapVolumeFees=valid?(measurement.coverage?.fullRegistryInterval?'MEASURED-regular-swap-flow+DERIVED-gross-fees-registry-interval':'MEASURED-regular-swap-flow+DERIVED-gross-fees-common-pairs-partial'):'UNKNOWN';current.epistemic.fraxswapTwammFlow='UNKNOWN-separate-mechanism-not-in-regular-Swap-events';current.epistemic.fraxswapFeeRecipientSplit='UNKNOWN-until-_mintFee-feeTo-accounting';
  current.measurementExtensions={...(current.measurementExtensions||{}),fraxswapFlowFees:FRAX_FRAXSWAP_FLOW_FEES_VERSION};
  current.nextMeasurementUnlocks=(current.nextMeasurementUnlocks||[]).map(x=>String(x).includes('next add Fraxswap pair volume/fee flow')?'Regular Fraxswap Swap flow and gross input-fee mechanics are now measured over published Fraxtal intervals; next isolate TWAMM flow, then prove _mintFee/feeTo revenue routing and BAMM lender longitudinal yield.':x);
  current.id=`frax-ecosystem:${sha256(stableStringify({priorId:base.id,fraxswapFlow:valid?{from:measurement.interval.fromBlockExclusive,to:measurement.interval.toBlockInclusive,digest:measurement.aggregateDigest,fullRegistryInterval:measurement.coverage?.fullRegistryInterval}:{status:measurement?.status||'UNKNOWN'},surfaceIds:current.coverage.surfaceIds})).slice(0,24)}`;
  const prevRows=Array.isArray(previousState?.protocolEvidence?.[FRAX_ECOSYSTEM_EVIDENCE_ID]?.observations)?previousState.protocolEvidence[FRAX_ECOSYSTEM_EVIDENCE_ID].observations:[];const rows=[...prevRows];if(!rows.some(r=>r?.id===current.id))rows.push(current);const bounded=rows.slice(-MAX_OBSERVATIONS);
  evidence.latest={observation:current};evidence.status=current.status;evidence.observations=bounded;evidence.observationCount=bounded.length;evidence.measurementExtensions={...(evidence.measurementExtensions||{}),fraxswapFlowFees:FRAX_FRAXSWAP_FLOW_FEES_VERSION};sensor.ecosystemFamily={...(sensor.ecosystemFamily||{}),latestObservationId:current.id,measurementExtensions:{...(sensor.ecosystemFamily?.measurementExtensions||{}),fraxswapFlowFees:FRAX_FRAXSWAP_FLOW_FEES_VERSION}};if(sensor?.latest?.observation)sensor.latest.observation.ecosystemFamily=sensor.ecosystemFamily;
  if(current.coverage.measuredSurfaceCount+current.coverage.sourceBoundUnknownSurfaceCount!==current.coverage.surfaceCount)throw new Error('Fraxswap flow depth accounting drift');
  if(valid&&!String(current.epistemic.fraxswapVolumeFees).startsWith('MEASURED'))throw new Error('Fraxswap flow epistemic promotion missing');
  if(current?.authority?.executionAuthority!=='none'||current?.epistemic?.executionAuthority!=='none'||measurement?.epistemic?.executionAuthority!=='none')throw new Error('Fraxswap flow execution authority leaked');
  return state;
}
