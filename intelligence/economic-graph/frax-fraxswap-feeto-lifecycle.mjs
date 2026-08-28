#!/usr/bin/env node
/**
 * The Holding · Fraxtal Fraxswap feeTo LP lifecycle sensor v0.1
 *
 * Deepens the already-proven Fraxswap protocol-fee route without changing its
 * semantics. For every factory pair it measures feeTo LP balances at the exact
 * published interval boundaries, reconstructs the pair-local LP transfer ledger,
 * and recognizes only strictly attributable feeTo -> pair -> burn redemptions.
 *
 * LP units remain pair-local. A downstream address is a mechanically observed
 * recipient only; it is not labelled treasury, veFRAX distributor, owner cash
 * flow, or protocol revenue destination without separate evidence.
 *
 * No execution, price, recommendation, methodology or causal authority.
 */
import crypto from 'node:crypto';
import {
  FRAX_ECOSYSTEM_EVIDENCE_ID,
  FRAX_PROTOCOL_ID
} from './frax-ecosystem-sensor.mjs';
import {
  FRAXTAL_CHAIN_ID,
  FRAXTAL_RPC_ENDPOINTS
} from './frax-bamm-onchain.mjs';

export const FRAXSWAP_FEETO_LIFECYCLE_VERSION='0.1-fraxtal-fraxswap-feeto-lp-lifecycle';
const RPC_TIMEOUT_MS=12_000;
const MAX_BATCH_CALLS=120;
const MAX_LOG_BLOCK_SPAN=4000n;
const MAX_OBSERVATIONS=1000;
const ZERO='0x0000000000000000000000000000000000000000';
const E18=10n**18n;

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
function addrArg(v){return normalizeAddress(v).replace(/^0x/,'').padStart(64,'0');}
function topicAddress(topic){const x=String(topic||'').replace(/^0x/,'');if(x.length!==64)return null;return `0x${x.slice(24)}`;}
function format18(v){const n=BigInt(v),whole=n/E18,frac=(n%E18).toString().padStart(18,'0').replace(/0+$/,'');return frac?`${whole}.${frac}`:whole.toString();}

async function postBatch(url,payload,fetchImpl){
  const response=await fetchImpl(url,{method:'POST',headers:{'content-type':'application/json',accept:'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(RPC_TIMEOUT_MS)});
  if(!response.ok)throw new Error(`RPC HTTP ${response.status}`);
  const body=await response.json();if(!Array.isArray(body))throw new Error('RPC response is not an array');
  const byId=new Map(body.map(r=>[Number(r?.id),r]));
  for(const req of payload){const r=byId.get(req.id);if(!r)throw new Error(`RPC result ${req.id} missing`);if(r.error)throw new Error(`RPC ${req.method} error: ${r.error?.message||'unknown'}`);if(r.result===undefined||r.result===null)throw new Error(`RPC ${req.method} result missing`);}
  return byId;
}
async function batched(url,payload,fetchImpl){const out=new Map();for(let i=0;i<payload.length;i+=MAX_BATCH_CALLS){const x=await postBatch(url,payload.slice(i,i+MAX_BATCH_CALLS),fetchImpl);for(const [k,v] of x)out.set(k,v);}return out;}

function validateInputs({currentBammMeasurement,previousBammMeasurement,protocolFeeMeasurement}){
  for(const [label,m] of [['Current',currentBammMeasurement],['Previous',previousBammMeasurement]]){
    if(m?.status!=='ok'||m?.measurementClass!=='MEASURED'||m?.chainId!==FRAXTAL_CHAIN_ID||!Number.isSafeInteger(Number(m?.blockNumber))||!m?.blockTag||!/^0x[0-9a-f]{64}$/i.test(String(m?.blockHash||'')))throw new Error(`${label} Fraxtal checkpoint unavailable`);
  }
  if(protocolFeeMeasurement?.status!=='ok'||protocolFeeMeasurement?.measurementClass!=='MEASURED'||protocolFeeMeasurement?.chainId!==FRAXTAL_CHAIN_ID||protocolFeeMeasurement?.coverage?.fullFactoryRegistryCurrent!==true)throw new Error('Fraxswap protocol-fee measurement unavailable');
  if(Number(protocolFeeMeasurement?.blockNumber)!==Number(currentBammMeasurement.blockNumber)||String(protocolFeeMeasurement?.blockHash||'').toLowerCase()!==String(currentBammMeasurement.blockHash).toLowerCase())throw new Error('Protocol-fee measurement current checkpoint mismatch');
  if(Number(protocolFeeMeasurement?.interval?.fromBlockExclusive)!==Number(previousBammMeasurement.blockNumber)||String(protocolFeeMeasurement?.interval?.fromBlockHash||'').toLowerCase()!==String(previousBammMeasurement.blockHash).toLowerCase())throw new Error('Protocol-fee measurement previous checkpoint mismatch');
  if(protocolFeeMeasurement?.factory?.checkpointFeeToParity!==true||sameAddress(protocolFeeMeasurement?.factory?.endFeeTo,ZERO))throw new Error('feeTo route not nonzero and checkpoint-stable');
}

function unknown({current,previous,protocolFeeMeasurement,attempts,reason='UNKNOWN-fraxswap-feeto-lifecycle-read-failed'}={}){
  return {
    version:FRAXSWAP_FEETO_LIFECYCLE_VERSION,status:reason,measurementClass:'UNKNOWN',
    observedAt:current?.observedAt||null,chain:'fraxtal',chainId:FRAXTAL_CHAIN_ID,
    interval:{fromBlockExclusive:previous?.blockNumber??null,toBlockInclusive:current?.blockNumber??null,fromBlockHash:previous?.blockHash||null,toBlockHash:current?.blockHash||null,nonOverlappingPublishedCheckpointInterval:false},
    feeTo:protocolFeeMeasurement?.factory?.endFeeTo||null,pairs:[],
    summary:{pairCount:null,pairCountWithPositiveEndBalance:null,pairCountWithOutflows:null,outboundTransferEventCount:null,pairCountWithStrictRedemptions:null,strictRedemptionCount:null,unresolvedPairTransferOutflowCount:null},
    rpc:{endpointId:null,failoverAttempts:attempts||[]},
    epistemic:{feeToLpHoldings:'UNKNOWN',feeToLpTransferFlow:'UNKNOWN',feeToLpBalanceConservation:'UNKNOWN',feeToLpRedemptionFlow:'UNKNOWN',downstreamRecipientSemantics:'UNKNOWN',heterogeneousLpUnitsAggregated:false,protocolRevenueUsdClaim:false,veFraxDistributionClaim:false,companyCashFlowClaim:false,unknownIsZero:false,causalClaimAuthority:'none',executionAuthority:'none'}
  };
}

function decodeTransfer(log,transferTopic){
  if(String(log?.topics?.[0]||'').toLowerCase()!==transferTopic)return null;
  if((log.topics||[]).length!==3)throw new Error('Transfer ABI mismatch');
  const from=topicAddress(log.topics[1]),to=topicAddress(log.topics[2]),value=word(log.data);
  if(!from||!to)throw new Error('Transfer address decode failed');
  return {from,to,value,blockNumber:Number(rpcQuantity(log.blockNumber)),logIndex:Number(rpcQuantity(log.logIndex)),tx:String(log.transactionHash||'')};
}
function decodeBurn(log,burnTopic){
  if(String(log?.topics?.[0]||'').toLowerCase()!==burnTopic)return null;
  if((log.topics||[]).length!==3)throw new Error('Burn ABI mismatch');
  const [amount0,amount1]=words(log.data);if(amount0===undefined||amount1===undefined)throw new Error('Burn amounts missing');
  const sender=topicAddress(log.topics[1]),to=topicAddress(log.topics[2]);
  if(!sender||!to)throw new Error('Burn address decode failed');
  return {sender,to,amount0,amount1,blockNumber:Number(rpcQuantity(log.blockNumber)),logIndex:Number(rpcQuantity(log.logIndex)),tx:String(log.transactionHash||'')};
}

function classifyPairLifecycle({pair,token0,token1,feeTo,startBalance,endBalance,logs,topics}){
  const transfers=[],burns=[];
  for(const log of logs){
    const t=decodeTransfer(log,topics.transfer);if(t){transfers.push(t);continue;}
    const b=decodeBurn(log,topics.burn);if(b){burns.push(b);continue;}
    throw new Error(`Unexpected feeTo lifecycle topic ${String(log?.topics?.[0]||'')} ${pair}`);
  }
  transfers.sort((a,b)=>a.blockNumber-b.blockNumber||a.logIndex-b.logIndex);
  burns.sort((a,b)=>a.blockNumber-b.blockNumber||a.logIndex-b.logIndex);

  const inbound=transfers.filter(t=>sameAddress(t.to,feeTo));
  const outbound=transfers.filter(t=>sameAddress(t.from,feeTo));
  const inboundUnits=inbound.reduce((a,x)=>a+x.value,0n);
  const outboundUnits=outbound.reduce((a,x)=>a+x.value,0n);
  const expectedEnd=startBalance+inboundUnits-outboundUnits;
  if(expectedEnd!==endBalance)throw new Error(`feeTo LP balance conservation failed ${pair}: ${startBalance}+${inboundUnits}-${outboundUnits} != ${endBalance}`);

  const redemptions=[],unresolved=[];
  for(const out of outbound){
    if(!sameAddress(out.to,pair))continue;
    const txTransfers=transfers.filter(t=>t.tx===out.tx);
    const pairBurnTransfers=txTransfers.filter(t=>sameAddress(t.from,pair)&&sameAddress(t.to,ZERO)&&t.logIndex>out.logIndex);
    const txBurns=burns.filter(b=>b.tx===out.tx&&b.logIndex>out.logIndex);
    if(pairBurnTransfers.length===1&&txBurns.length===1&&pairBurnTransfers[0].value===out.value){
      const burnTransfer=pairBurnTransfers[0],burn=txBurns[0];
      redemptions.push({
        lpValueRaw:out.value.toString(),lpValueLp:format18(out.value),
        blockNumber:out.blockNumber,tx:out.tx,transferLogIndex:out.logIndex,burnTransferLogIndex:burnTransfer.logIndex,burnLogIndex:burn.logIndex,
        redemptionRecipient:burn.to,
        token0,amount0Raw:burn.amount0.toString(),
        token1,amount1Raw:burn.amount1.toString(),
        attribution:'DERIVED-MECHANICAL-exact-feeTo-to-pair-transfer-equals-pair-burn'
      });
    }else{
      unresolved.push({to:out.to,valueRaw:out.value.toString(),blockNumber:out.blockNumber,logIndex:out.logIndex,tx:out.tx,reason:'UNKNOWN-pair-received-feeTo-LP-but-exact-burn-attribution-not-unique-or-amount-mismatched'});
    }
  }

  return {
    startFeeToBalanceRaw:startBalance.toString(),startFeeToBalanceLp:format18(startBalance),
    endFeeToBalanceRaw:endBalance.toString(),endFeeToBalanceLp:format18(endBalance),
    balanceDeltaRaw:(endBalance-startBalance).toString(),
    inboundTransferCount:inbound.length,inboundUnitsRaw:inboundUnits.toString(),
    outboundTransferCount:outbound.length,outboundUnitsRaw:outboundUnits.toString(),
    inboundEvents:inbound.map(x=>({from:x.from,valueRaw:x.value.toString(),blockNumber:x.blockNumber,logIndex:x.logIndex,tx:x.tx,origin:sameAddress(x.from,ZERO)?'mint':'transfer'})),
    outboundEvents:outbound.map(x=>({to:x.to,valueRaw:x.value.toString(),blockNumber:x.blockNumber,logIndex:x.logIndex,tx:x.tx,route:sameAddress(x.to,pair)?'feeTo-to-pair':'feeTo-to-downstream-address'})),
    strictRedemptionCount:redemptions.length,redemptions,
    unresolvedPairTransferOutflowCount:unresolved.length,unresolvedPairTransferOutflows:unresolved,
    balanceConservationProven:true
  };
}

export async function collectFraxswapFeeToLifecycle({currentBammMeasurement,previousBammMeasurement,protocolFeeMeasurement,endpoints=FRAXTAL_RPC_ENDPOINTS,fetchImpl=fetch}={}){
  const attempts=[];
  try{validateInputs({currentBammMeasurement,previousBammMeasurement,protocolFeeMeasurement});}
  catch(error){return unknown({current:currentBammMeasurement,previous:previousBammMeasurement,protocolFeeMeasurement,attempts:[{endpointId:null,error:error.message}],reason:'UNKNOWN-fraxswap-feeto-lifecycle-prerequisite-unavailable'});}

  const startBlock=BigInt(previousBammMeasurement.blockNumber),endBlock=BigInt(currentBammMeasurement.blockNumber);
  if(endBlock<=startBlock)return unknown({current:currentBammMeasurement,previous:previousBammMeasurement,protocolFeeMeasurement,attempts,reason:'UNKNOWN-no-forward-published-block-interval'});
  const feeTo=protocolFeeMeasurement.factory.endFeeTo;
  const pairs=Array.isArray(protocolFeeMeasurement.pairs)?protocolFeeMeasurement.pairs:[];
  if(pairs.length!==Number(protocolFeeMeasurement.factory.endPairCount))return unknown({current:currentBammMeasurement,previous:previousBammMeasurement,protocolFeeMeasurement,attempts,reason:'UNKNOWN-incomplete-protocol-fee-pair-registry'});
  if(Number(protocolFeeMeasurement.factory.startPairCount)!==Number(protocolFeeMeasurement.factory.endPairCount))return unknown({current:currentBammMeasurement,previous:previousBammMeasurement,protocolFeeMeasurement,attempts,reason:'UNKNOWN-pair-registry-changed-across-interval'});

  const preferred=protocolFeeMeasurement?.rpc?.endpointId||currentBammMeasurement?.rpc?.endpointId;
  const ordered=[...endpoints].sort((a,b)=>(a.id===preferred?-1:0)-(b.id===preferred?-1:0));
  for(const endpoint of ordered){
    try{
      const signatures=['balanceOf(address)','Transfer(address,address,uint256)','Burn(address,uint256,uint256,address)'];
      const sigReq=signatures.map((s,i)=>({jsonrpc:'2.0',id:i+1,method:'web3_sha3',params:[asciiHex(s)]}));
      sigReq.push({jsonrpc:'2.0',id:100,method:'eth_getBlockByNumber',params:[previousBammMeasurement.blockTag,false]},{jsonrpc:'2.0',id:101,method:'eth_getBlockByNumber',params:[currentBammMeasurement.blockTag,false]});
      const sig=await postBatch(endpoint.url,sigReq,fetchImpl),hashes=new Map(signatures.map((s,i)=>[s,String(sig.get(i+1).result).toLowerCase()]));
      for(const [s,h] of hashes)if(!/^0x[0-9a-f]{64}$/.test(h))throw new Error(`Signature hash failed ${s}`);
      if(String(sig.get(100).result?.hash||'').toLowerCase()!==String(previousBammMeasurement.blockHash).toLowerCase()||String(sig.get(101).result?.hash||'').toLowerCase()!==String(currentBammMeasurement.blockHash).toLowerCase())throw new Error('Published Fraxtal checkpoint block hash mismatch');
      const selector=s=>hashes.get(s).slice(0,10),call=(id,to,data,tag)=>({jsonrpc:'2.0',id,method:'eth_call',params:[{to,data},tag]});
      let id=1000;const balanceCalls=[],balanceMeta=[];
      for(const p of pairs){
        const startId=id++,endId=id++;
        balanceCalls.push(call(startId,p.pair,selector('balanceOf(address)')+addrArg(feeTo),previousBammMeasurement.blockTag),call(endId,p.pair,selector('balanceOf(address)')+addrArg(feeTo),currentBammMeasurement.blockTag));
        balanceMeta.push({p,startId,endId});
      }
      const balances=balanceCalls.length?await batched(endpoint.url,balanceCalls,fetchImpl):new Map();

      const topics={transfer:hashes.get('Transfer(address,address,uint256)'),burn:hashes.get('Burn(address,uint256,uint256,address)')};
      const logCalls=[],logMeta=[];id=50000;
      for(const p of pairs){for(let from=startBlock+1n;from<=endBlock;from+=MAX_LOG_BLOCK_SPAN){const to=from+MAX_LOG_BLOCK_SPAN-1n>endBlock?endBlock:from+MAX_LOG_BLOCK_SPAN-1n,reqId=id++;logCalls.push({jsonrpc:'2.0',id:reqId,method:'eth_getLogs',params:[{address:p.pair,fromBlock:hexQuantity(from),toBlock:hexQuantity(to),topics:[[topics.transfer,topics.burn]]}]});logMeta.push({reqId,pair:normalizeAddress(p.pair),from,to});}}
      const logsByPair=new Map(pairs.map(p=>[normalizeAddress(p.pair),[]]));
      const logResults=logCalls.length?await batched(endpoint.url,logCalls,fetchImpl):new Map();
      for(const m of logMeta){const rows=logResults.get(m.reqId).result;if(!Array.isArray(rows))throw new Error('Fraxswap feeTo lifecycle logs response invalid');for(const log of rows){if(!sameAddress(log.address,m.pair))throw new Error('Fraxswap feeTo lifecycle log address mismatch');const b=rpcQuantity(log.blockNumber);if(b<m.from||b>m.to)throw new Error('Fraxswap feeTo lifecycle log escaped range');logsByPair.get(m.pair).push(log);}}

      const out=[];
      for(const m of balanceMeta){
        const startBalance=word(balances.get(m.startId).result),endBalance=word(balances.get(m.endId).result);
        const lifecycle=classifyPairLifecycle({pair:m.p.pair,token0:m.p.token0,token1:m.p.token1,feeTo,startBalance,endBalance,logs:logsByPair.get(normalizeAddress(m.p.pair))||[],topics});
        out.push({pair:m.p.pair,token0:m.p.token0,token1:m.p.token1,lifecycle});
      }
      const pairCountWithOutflows=out.filter(x=>x.lifecycle.outboundTransferCount>0).length;
      const outboundTransferEventCount=out.reduce((a,x)=>a+x.lifecycle.outboundTransferCount,0);
      const pairCountWithStrictRedemptions=out.filter(x=>x.lifecycle.strictRedemptionCount>0).length;
      const strictRedemptionCount=out.reduce((a,x)=>a+x.lifecycle.strictRedemptionCount,0);
      const unresolvedPairTransferOutflowCount=out.reduce((a,x)=>a+x.lifecycle.unresolvedPairTransferOutflowCount,0);
      return {
        version:FRAXSWAP_FEETO_LIFECYCLE_VERSION,status:'ok',measurementClass:'MEASURED',observedAt:currentBammMeasurement.observedAt,chain:'fraxtal',chainId:FRAXTAL_CHAIN_ID,
        blockNumber:currentBammMeasurement.blockNumber,blockTag:currentBammMeasurement.blockTag,blockHash:currentBammMeasurement.blockHash,
        interval:{fromBlockExclusive:Number(startBlock),toBlockInclusive:Number(endBlock),fromBlockHash:previousBammMeasurement.blockHash,toBlockHash:currentBammMeasurement.blockHash,fromObservedAt:previousBammMeasurement.observedAt,toObservedAt:currentBammMeasurement.observedAt,nonOverlappingPublishedCheckpointInterval:true},
        feeTo,pairs:out,
        summary:{pairCount:out.length,pairCountWithPositiveEndBalance:out.filter(x=>BigInt(x.lifecycle.endFeeToBalanceRaw)>0n).length,pairCountWithOutflows,outboundTransferEventCount,pairCountWithStrictRedemptions,strictRedemptionCount,unresolvedPairTransferOutflowCount},
        rpc:{endpointId:endpoint.id,failoverAttempts:attempts},
        provenance:{protocolFeeMeasurementVersion:protocolFeeMeasurement.version,protocolFeeMeasurementBlockHash:protocolFeeMeasurement.blockHash,sourceContracts:['FraxswapPair.sol','FraxswapERC20.sol'],balanceIdentity:'end feeTo LP balance = start balance + all pair-token Transfer inflows to feeTo - all pair-token Transfer outflows from feeTo',strictRedemptionIdentity:'feeTo -> pair LP Transfer followed in same tx by exactly one equal-sized pair -> zero LP burn and exactly one Burn terminal event'},
        epistemic:{feeToLpHoldings:'MEASURED-exact-block-pair-local',feeToLpTransferFlow:'MEASURED-exact-log-interval',feeToLpBalanceConservation:'DERIVED-MECHANICAL-exact-transfer-ledger-identity',feeToLpRedemptionFlow:unresolvedPairTransferOutflowCount===0?'MEASURED-strict-source-ordered-redemption-or-measured-zero':'PARTIAL-strict-redemptions-measured-unresolved-pair-outflows-preserved',downstreamRecipientSemantics:'UNKNOWN-address-only-no-economic-role-claim',heterogeneousLpUnitsAggregated:false,lpUnitValuationPerformed:false,protocolRevenueUsdClaim:false,veFraxDistributionClaim:false,companyCashFlowClaim:false,unknownIsZero:false,causalClaimAuthority:'none',executionAuthority:'none'}
      };
    }catch(error){attempts.push({endpointId:endpoint.id,error:error instanceof Error?error.message:String(error)});}
  }
  return unknown({current:currentBammMeasurement,previous:previousBammMeasurement,protocolFeeMeasurement,attempts});
}

export function applyFraxswapFeeToLifecycle({state,previousState,measurement}){
  if(!state||typeof state!=='object')throw new Error('Fraxswap feeTo lifecycle adapter requires Economic Graph state');
  if(state?.authority?.executionAuthority!=='none'||state?.authority?.causalClaimAuthority!=='none')throw new Error('Fraxswap feeTo lifecycle adapter refuses Graph authority drift');
  const evidence=state?.protocolEvidence?.[FRAX_ECOSYSTEM_EVIDENCE_ID],base=evidence?.latest?.observation,fraxSensor=state?.protocolSensors?.[FRAX_PROTOCOL_ID];
  if(!evidence||!base||!fraxSensor)throw new Error('Frax ecosystem evidence missing before feeTo lifecycle enrichment');
  const current=structuredClone(base),fraxswap=current?.surfaces?.fraxswapBamm,revenue=current?.surfaces?.revenueRouting;
  if(!fraxswap||!revenue)throw new Error('Fraxswap or revenue-routing surface missing');
  const valid=measurement?.status==='ok'&&measurement?.measurementClass==='MEASURED'&&measurement?.epistemic?.feeToLpHoldings?.startsWith('MEASURED');
  fraxswap.measured={...(fraxswap.measured||{}),feeToLpLifecycle:measurement};
  revenue.measured={...(revenue.measured||{}),fraxswapFeeToLpLifecycle:measurement};
  // This atom is intentionally partial evidence inside revenue-routing. It does
  // not promote the whole end-to-end revenue surface to MEASURED.
  current.measurementExtensions={...(current.measurementExtensions||{}),fraxswapFeeToLpLifecycle:FRAXSWAP_FEETO_LIFECYCLE_VERSION};
  current.epistemic={...(current.epistemic||{}),fraxswapFeeToLpHoldings:valid?measurement.epistemic.feeToLpHoldings:'UNKNOWN',fraxswapFeeToLpTransferFlow:valid?measurement.epistemic.feeToLpTransferFlow:'UNKNOWN',fraxswapFeeToLpRedemptionFlow:valid?measurement.epistemic.feeToLpRedemptionFlow:'UNKNOWN',fraxswapDownstreamRecipientSemantics:'UNKNOWN'};
  const already=revenue.mechanicalRelations.some(r=>r?.from==='Fraxswap _mintFee LP at feeTo');
  if(!already)revenue.mechanicalRelations.push(
    {from:'Fraxswap _mintFee LP at feeTo',to:'pair-local feeTo LP holdings/outflows',class:valid?'MEASURED-exact-block-and-log-ledger':'UNKNOWN'},
    {from:'feeTo LP transfer to pair + equal pair LP burn',to:'Burn underlying recipient + token amounts',class:valid?'MECHANICAL-strict-redemption-identity':'UNKNOWN'}
  );
  const surfaces=Object.values(current.surfaces||{}),measured=surfaces.filter(s=>String(s.measurementState||'').startsWith('MEASURED'));
  current.coverage.measuredSurfaceCount=measured.length;current.coverage.sourceBoundUnknownSurfaceCount=surfaces.length-measured.length;
  current.relationshipGraph=surfaces.flatMap(s=>s.mechanicalRelations.map((r,index)=>({surfaceId:s.id,index,...r})));
  current.coverage.relationshipCount=current.relationshipGraph.length;
  current.coverage.relationshipClassCounts=current.relationshipGraph.reduce((a,r)=>{const k=String(r.class||'UNKNOWN').split('-')[0];a[k]=(a[k]||0)+1;return a;},{});
  current.id=`frax-ecosystem:${sha256(stableStringify({priorId:base.id,feeToLifecycle:valid?{blockNumber:measurement.blockNumber,blockHash:measurement.blockHash,feeTo:measurement.feeTo,summary:measurement.summary,pairs:measurement.pairs.map(p=>[p.pair,p.lifecycle.startFeeToBalanceRaw,p.lifecycle.endFeeToBalanceRaw,p.lifecycle.outboundTransferCount,p.lifecycle.strictRedemptionCount,p.lifecycle.unresolvedPairTransferOutflowCount])}:{status:measurement?.status||'UNKNOWN'},surfaceIds:current.coverage.surfaceIds})).slice(0,24)}`;
  const prevRows=Array.isArray(previousState?.protocolEvidence?.[FRAX_ECOSYSTEM_EVIDENCE_ID]?.observations)?previousState.protocolEvidence[FRAX_ECOSYSTEM_EVIDENCE_ID].observations:[];
  const rows=[...prevRows];if(!rows.some(r=>r?.id===current.id))rows.push(current);
  evidence.latest={observation:current};evidence.status=current.status;evidence.observations=rows.slice(-MAX_OBSERVATIONS);evidence.observationCount=evidence.observations.length;
  evidence.measurementExtensions={...(evidence.measurementExtensions||{}),fraxswapFeeToLpLifecycle:FRAXSWAP_FEETO_LIFECYCLE_VERSION};
  fraxSensor.ecosystemFamily={...(fraxSensor.ecosystemFamily||{}),status:current.status,measuredSurfaceCount:current.coverage.measuredSurfaceCount,sourceBoundUnknownSurfaceCount:current.coverage.sourceBoundUnknownSurfaceCount,latestObservationId:current.id,measurementExtensions:{...(fraxSensor.ecosystemFamily?.measurementExtensions||{}),fraxswapFeeToLpLifecycle:FRAXSWAP_FEETO_LIFECYCLE_VERSION}};
  if(fraxSensor?.latest?.observation)fraxSensor.latest.observation.ecosystemFamily=fraxSensor.ecosystemFamily;
  if(current.coverage.measuredSurfaceCount+current.coverage.sourceBoundUnknownSurfaceCount!==current.coverage.surfaceCount)throw new Error('Frax feeTo lifecycle depth accounting drift');
  if(valid&&measurement.summary.pairCount!==measurement.pairs.length)throw new Error('Fraxswap feeTo lifecycle pair materialization mismatch');
  if(revenue.measurementState.startsWith('MEASURED'))throw new Error('Revenue-routing surface over-promoted by partial feeTo evidence');
  if(current?.authority?.executionAuthority!=='none'||current?.epistemic?.executionAuthority!=='none'||measurement?.epistemic?.executionAuthority!=='none')throw new Error('Fraxswap feeTo lifecycle execution authority leaked');
  return state;
}
