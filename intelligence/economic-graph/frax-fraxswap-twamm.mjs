#!/usr/bin/env node
/**
 * The Holding · Fraxtal Fraxswap TWAMM sensor v0.1
 *
 * Measures long-term order lifecycle and executed virtual-order flow across the
 * same registry-wide Fraxswap pair set already proven by the BAMM sensor. The
 * measurement interval is bounded by two published exact-block Fraxtal BAMM
 * checkpoints. VirtualOrderExecution is kept separate from ordinary Swap flow.
 *
 * Gross TWAMM input-fee units are mechanically reproduced from the protocol
 * source identity used by LongTermOrdersLib.computeVirtualBalances:
 * soldAmount * LP fee bps / 10000. LpFeeUpdated events are replayed in exact
 * log order and reconciled with fee() at both checkpoint blocks.
 *
 * This does not claim gross fees are realised LP income or protocol revenue.
 * feeTo/_mintFee routing remains a separate accounting atom. No execution,
 * price, recommendation, methodology or causal authority.
 */
import crypto from 'node:crypto';
import {
  FRAX_ECOSYSTEM_EVIDENCE_ID,
  FRAX_PROTOCOL_ID,
  FRAXTAL_CHAIN_ID,
  FRAXTAL_RPC_ENDPOINTS
} from './frax-bamm-onchain.mjs';

export const FRAX_FRAXSWAP_TWAMM_VERSION='0.1-fraxtal-fraxswap-twamm-flow';
export const FRAXSWAP_SOURCE_REF='30532c8cefcbf5c7efafcff4369261bd435a4859';
const RPC_TIMEOUT_MS=12_000;
const MAX_PAIRS=250;
const MAX_BATCH_CALLS=120;
const MAX_LOG_BLOCK_SPAN=4000n;
const MAX_OBSERVATIONS=1000;
const FEE_DENOMINATOR=10000n;
const SELL_RATE_ADDITIONAL_PRECISION=1000000n;
const DECIMALS_SELECTOR='0x313ce567';

const SIG={
  fee:'fee()',
  twammState:'getTwammState()',
  nextOrderId:'getNextOrderID()',
  virtual:'VirtualOrderExecution(uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256)',
  long0:'LongTermSwap0To1(address,uint256,uint256,uint256)',
  long1:'LongTermSwap1To0(address,uint256,uint256,uint256)',
  cancel:'CancelLongTermOrder(address,uint256,address,uint256,address,uint256)',
  withdraw:'WithdrawProceedsFromLongTermOrder(address,uint256,address,uint256,bool)',
  feeUpdate:'LpFeeUpdated(uint256)'
};

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
function safeNumber(v,label){const n=Number(v);if(!Number.isSafeInteger(n))throw new Error(`${label} outside safe integer range`);return n;}
function formatUnits(raw,decimals){const n=BigInt(raw),d=BigInt(decimals);if(d<0n||d>255n)throw new Error('Invalid token decimals');const base=10n**d,whole=n/base,frac=(n%base).toString().padStart(Number(d),'0').replace(/0+$/,'');return frac?`${whole}.${frac}`:whole.toString();}
function topicAddress(topic){const x=String(topic||'').replace(/^0x/,'');if(x.length!==64)return null;return `0x${x.slice(24)}`;}
function wordAddress(v){return `0x${BigInt(v).toString(16).padStart(64,'0').slice(24)}`;}

async function postBatch(url,payload,fetchImpl){
  const response=await fetchImpl(url,{method:'POST',headers:{'content-type':'application/json',accept:'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(RPC_TIMEOUT_MS)});
  if(!response.ok)throw new Error(`RPC HTTP ${response.status}`);
  const body=await response.json();if(!Array.isArray(body))throw new Error('RPC response is not an array');
  const byId=new Map(body.map(r=>[Number(r?.id),r]));
  for(const req of payload){const r=byId.get(req.id);if(!r)throw new Error(`RPC result ${req.id} missing`);if(r.error)throw new Error(`RPC ${req.method} error: ${r.error?.message||'unknown'}`);if(r.result===undefined||r.result===null)throw new Error(`RPC ${req.method} result missing`);}
  return byId;
}
async function batched(url,payload,fetchImpl){const out=new Map();for(let i=0;i<payload.length;i+=MAX_BATCH_CALLS){const x=await postBatch(url,payload.slice(i,i+MAX_BATCH_CALLS),fetchImpl);for(const [k,v] of x)out.set(k,v);}return out;}

function validateBamm(m,label){
  if(m?.status!=='ok'||m?.measurementClass!=='MEASURED'||m?.chainId!==FRAXTAL_CHAIN_ID||!m?.blockTag||!m?.blockHash||!Array.isArray(m?.bamms)||m?.registry?.allRegistryIdentitiesProven!==true)throw new Error(`${label} BAMM measurement unavailable`);
  if(m.bamms.length<1||m.bamms.length>MAX_PAIRS||m.bamms.length!==Number(m.registry.bammCount))throw new Error(`${label} BAMM registry count invalid`);
}
function unknown({current,previous,attempts,reason='UNKNOWN-fraxswap-twamm-read-failed',coverage=null}={}){
  return {
    version:FRAX_FRAXSWAP_TWAMM_VERSION,status:reason,measurementClass:'UNKNOWN',observedAt:current?.observedAt||null,chain:'fraxtal',chainId:FRAXTAL_CHAIN_ID,
    interval:{fromBlockExclusive:previous?.blockNumber??null,toBlockInclusive:current?.blockNumber??null,fromBlockHash:previous?.blockHash||null,toBlockHash:current?.blockHash||null,fromObservedAt:previous?.observedAt||null,toObservedAt:current?.observedAt||null,nonOverlappingPublishedCheckpointInterval:false},
    coverage:coverage||{currentRegistryPairCount:Array.isArray(current?.bamms)?current.bamms.length:null,previousRegistryPairCount:Array.isArray(previous?.bamms)?previous.bamms.length:null,commonPairCount:null,newPairCount:null,removedPairCount:null,fullRegistryInterval:false},
    pairs:[],rpc:{endpointId:null,failoverAttempts:attempts||[]},
    provenance:{officialSourceRepository:'FraxFinance/frax-solidity',officialSourceRef:FRAXSWAP_SOURCE_REF,pairSource:'src/hardhat/contracts/Fraxswap/core/FraxswapPair.sol',twammSource:'src/hardhat/contracts/Fraxswap/twamm/LongTermOrders.sol'},
    epistemic:{twammOrderLifecycle:'UNKNOWN',virtualOrderExecutionFlow:'UNKNOWN',grossTwammInputFeeUnits:'UNKNOWN',ordinarySwapFlow:'EXCLUDED-separate-atom',feeRecipientSplit:'UNKNOWN',unknownIsZero:false,realizedLpIncomeClaim:false,protocolRevenueClaim:false,causalClaimAuthority:'none',executionAuthority:'none'}
  };
}

export async function collectFraxswapTwamm({currentBammMeasurement,previousBammMeasurement,endpoints=FRAXTAL_RPC_ENDPOINTS,fetchImpl=fetch}={}){
  const attempts=[];
  try{validateBamm(currentBammMeasurement,'Current');validateBamm(previousBammMeasurement,'Previous');}catch(error){return unknown({current:currentBammMeasurement,previous:previousBammMeasurement,attempts:[{endpointId:null,error:error.message}],reason:'UNKNOWN-published-bamm-checkpoint-pair-unavailable'});}
  const startBlock=BigInt(previousBammMeasurement.blockNumber),endBlock=BigInt(currentBammMeasurement.blockNumber);
  if(endBlock<=startBlock)return unknown({current:currentBammMeasurement,previous:previousBammMeasurement,attempts,reason:'UNKNOWN-no-forward-published-block-interval'});

  const previousByPair=new Map(previousBammMeasurement.bamms.map(r=>[normalizeAddress(r.pair),r]));
  const currentByPair=new Map(currentBammMeasurement.bamms.map(r=>[normalizeAddress(r.pair),r]));
  if(previousByPair.size!==previousBammMeasurement.bamms.length||currentByPair.size!==currentBammMeasurement.bamms.length)return unknown({current:currentBammMeasurement,previous:previousBammMeasurement,attempts,reason:'UNKNOWN-duplicate-fraxswap-pair-identity'});
  const common=[],newPairs=[],removedPairs=[];
  for(const row of currentBammMeasurement.bamms){const prev=previousByPair.get(normalizeAddress(row.pair));if(!prev){newPairs.push(row.pair);continue;}if(!sameAddress(prev.bamm,row.bamm)||!sameAddress(prev.token0,row.token0)||!sameAddress(prev.token1,row.token1))return unknown({current:currentBammMeasurement,previous:previousBammMeasurement,attempts,reason:'UNKNOWN-fraxswap-pair-identity-drift'});common.push(row);}
  for(const row of previousBammMeasurement.bamms)if(!currentByPair.has(normalizeAddress(row.pair)))removedPairs.push(row.pair);
  const coverage={currentRegistryPairCount:currentByPair.size,previousRegistryPairCount:previousByPair.size,commonPairCount:common.length,newPairCount:newPairs.length,removedPairCount:removedPairs.length,newPairs,removedPairs,fullRegistryInterval:newPairs.length===0&&removedPairs.length===0&&common.length===currentByPair.size};
  if(common.length<1)return unknown({current:currentBammMeasurement,previous:previousBammMeasurement,attempts,reason:'UNKNOWN-no-common-published-fraxswap-pairs',coverage});

  const preferred=currentBammMeasurement?.rpc?.endpointId;const ordered=[...endpoints].sort((a,b)=>(a.id===preferred?-1:0)-(b.id===preferred?-1:0));
  for(const endpoint of ordered){
    try{
      let id=1;const sigReq=[];const sigIds={};for(const [k,v] of Object.entries(SIG)){sigIds[k]=id;sigReq.push({jsonrpc:'2.0',id:id++,method:'web3_sha3',params:[asciiHex(v)]});}
      const startBlockId=id++,endBlockId=id++;
      sigReq.push({jsonrpc:'2.0',id:startBlockId,method:'eth_getBlockByNumber',params:[previousBammMeasurement.blockTag,false]},{jsonrpc:'2.0',id:endBlockId,method:'eth_getBlockByNumber',params:[currentBammMeasurement.blockTag,false]});
      const sig=await postBatch(endpoint.url,sigReq,fetchImpl);const hashes={};for(const [k,sid] of Object.entries(sigIds)){const h=String(sig.get(sid).result).toLowerCase();if(!/^0x[0-9a-f]{64}$/.test(h))throw new Error(`TWAMM signature hash invalid ${k}`);hashes[k]=h;}
      const feeSelector=hashes.fee.slice(0,10),twammStateSelector=hashes.twammState.slice(0,10),nextOrderIdSelector=hashes.nextOrderId.slice(0,10);
      const startMeta=sig.get(startBlockId).result,endMeta=sig.get(endBlockId).result;if(String(startMeta?.hash||'').toLowerCase()!==String(previousBammMeasurement.blockHash).toLowerCase()||String(endMeta?.hash||'').toLowerCase()!==String(currentBammMeasurement.blockHash).toLowerCase())throw new Error('Published BAMM checkpoint block hash mismatch');

      const stateCalls=[],pairIds=[],tokenIds=[],uniqueTokens=new Map();id=1000;
      for(const row of common){const p={row,startFee:id++,endFee:id++,startState:id++,endState:id++,startOrder:id++,endOrder:id++};pairIds.push(p);stateCalls.push(
        {jsonrpc:'2.0',id:p.startFee,method:'eth_call',params:[{to:row.pair,data:feeSelector},previousBammMeasurement.blockTag]},
        {jsonrpc:'2.0',id:p.endFee,method:'eth_call',params:[{to:row.pair,data:feeSelector},currentBammMeasurement.blockTag]},
        {jsonrpc:'2.0',id:p.startState,method:'eth_call',params:[{to:row.pair,data:twammStateSelector},previousBammMeasurement.blockTag]},
        {jsonrpc:'2.0',id:p.endState,method:'eth_call',params:[{to:row.pair,data:twammStateSelector},currentBammMeasurement.blockTag]},
        {jsonrpc:'2.0',id:p.startOrder,method:'eth_call',params:[{to:row.pair,data:nextOrderIdSelector},previousBammMeasurement.blockTag]},
        {jsonrpc:'2.0',id:p.endOrder,method:'eth_call',params:[{to:row.pair,data:nextOrderIdSelector},currentBammMeasurement.blockTag]}
      );uniqueTokens.set(normalizeAddress(row.token0),row.token0);uniqueTokens.set(normalizeAddress(row.token1),row.token1);}
      for(const token of uniqueTokens.values()){const t={token,id:id++};tokenIds.push(t);stateCalls.push({jsonrpc:'2.0',id:t.id,method:'eth_call',params:[{to:token,data:DECIMALS_SELECTOR},currentBammMeasurement.blockTag]});}
      const state=await batched(endpoint.url,stateCalls,fetchImpl);const decimals=new Map();for(const t of tokenIds){const d=word(state.get(t.id).result);if(d>255n)throw new Error(`Token decimals invalid ${t.token}`);decimals.set(normalizeAddress(t.token),Number(d));}

      const eventTopics=[hashes.virtual,hashes.long0,hashes.long1,hashes.cancel,hashes.withdraw,hashes.feeUpdate];const logCalls=[],logMeta=[];
      for(const p of pairIds){for(let from=startBlock+1n;from<=endBlock;from+=MAX_LOG_BLOCK_SPAN){const to=from+MAX_LOG_BLOCK_SPAN-1n>endBlock?endBlock:from+MAX_LOG_BLOCK_SPAN-1n;const reqId=id++;logCalls.push({jsonrpc:'2.0',id:reqId,method:'eth_getLogs',params:[{address:p.row.pair,fromBlock:hexQuantity(from),toBlock:hexQuantity(to),topics:[eventTopics]}]});logMeta.push({reqId,pair:normalizeAddress(p.row.pair),from,to});}}
      const logsByPair=new Map(common.map(r=>[normalizeAddress(r.pair),[]]));if(logCalls.length){const logResults=await batched(endpoint.url,logCalls,fetchImpl);for(const meta of logMeta){const rows=logResults.get(meta.reqId).result;if(!Array.isArray(rows))throw new Error('TWAMM logs response is not an array');for(const log of rows){if(!sameAddress(log?.address,meta.pair))throw new Error('TWAMM log address mismatch');const b=rpcQuantity(log.blockNumber);if(b<meta.from||b>meta.to)throw new Error('TWAMM log escaped requested range');logsByPair.get(meta.pair).push(log);}}}

      const pairs=[];
      for(const p of pairIds){
        const row=p.row,startStoredFee=word(state.get(p.startFee).result),endStoredFee=word(state.get(p.endFee).result);let feeBps=FEE_DENOMINATOR-startStoredFee;const expectedEndFeeBps=FEE_DENOMINATOR-endStoredFee;if(feeBps<1n||feeBps>100n||expectedEndFeeBps<1n||expectedEndFeeBps>100n)throw new Error(`Fraxswap fee state outside source bounds ${row.pair}`);
        const startState=words(state.get(p.startState).result),endState=words(state.get(p.endState).result);if(startState.length!==6||endState.length!==6)throw new Error(`getTwammState ABI mismatch ${row.pair}`);if(startState[3]!==3600n||endState[3]!==3600n)throw new Error(`TWAMM order interval drift ${row.pair}`);
        const startOrderId=word(state.get(p.startOrder).result),endOrderId=word(state.get(p.endOrder).result);if(endOrderId<startOrderId)throw new Error(`TWAMM order id regressed ${row.pair}`);
        const logs=[...(logsByPair.get(normalizeAddress(row.pair))||[])].sort((a,b)=>{const ba=rpcQuantity(a.blockNumber),bb=rpcQuantity(b.blockNumber);if(ba!==bb)return ba<bb?-1:1;const ia=rpcQuantity(a.logIndex),ib=rpcQuantity(b.logIndex);return ia<ib?-1:ia>ib?1:0;});
        let virtualExecutionCount=0,longTermOrder0To1Count=0,longTermOrder1To0Count=0,cancelCount=0,withdrawCount=0,feeUpdateCount=0,token0Sold=0n,token1Sold=0n,token0Bought=0n,token1Bought=0n,order0Input=0n,order1Input=0n,cancelUnsold0=0n,cancelUnsold1=0n,withdrawToken0=0n,withdrawToken1=0n,grossFee0Numerator=0n,grossFee1Numerator=0n;const eventDigestRows=[],txs=new Set(),feeUsage=new Map();
        for(const log of logs){const t=String(log?.topics?.[0]||'').toLowerCase(),w=words(log.data),blockNumber=rpcQuantity(log.blockNumber),logIndex=rpcQuantity(log.logIndex),txHash=String(log.transactionHash||'');txs.add(txHash);
          if(t===hashes.feeUpdate){if(w.length!==1)throw new Error('LpFeeUpdated ABI mismatch');const newFee=w[0];if(newFee<1n||newFee>100n)throw new Error(`TWAMM fee event outside source bounds ${row.pair}`);feeBps=newFee;feeUpdateCount++;eventDigestRows.push(['fee',blockNumber.toString(),logIndex.toString(),newFee.toString(),txHash]);continue;}
          if(t===hashes.virtual){if(w.length!==10)throw new Error('VirtualOrderExecution ABI mismatch');const [blockTimestamp,elapsed,_newReserve0,_newReserve1,_newTwammReserve0,_newTwammReserve1,t0Bought,t1Bought,t0Sold,t1Sold]=w;if(elapsed===0n)throw new Error('VirtualOrderExecution zero elapsed');token0Bought+=t0Bought;token1Bought+=t1Bought;token0Sold+=t0Sold;token1Sold+=t1Sold;grossFee0Numerator+=t0Sold*feeBps;grossFee1Numerator+=t1Sold*feeBps;virtualExecutionCount++;feeUsage.set(feeBps.toString(),(feeUsage.get(feeBps.toString())||0)+1);eventDigestRows.push(['virtual',blockNumber.toString(),logIndex.toString(),blockTimestamp.toString(),elapsed.toString(),t0Bought.toString(),t1Bought.toString(),t0Sold.toString(),t1Sold.toString(),feeBps.toString(),txHash]);continue;}
          if(t===hashes.long0){if(w.length!==3)throw new Error('LongTermSwap0To1 ABI mismatch');const [orderId,amount,intervals]=w;order0Input+=amount;longTermOrder0To1Count++;eventDigestRows.push(['long0',blockNumber.toString(),logIndex.toString(),topicAddress(log?.topics?.[1]),orderId.toString(),amount.toString(),intervals.toString(),txHash]);continue;}
          if(t===hashes.long1){if(w.length!==3)throw new Error('LongTermSwap1To0 ABI mismatch');const [orderId,amount,intervals]=w;order1Input+=amount;longTermOrder1To0Count++;eventDigestRows.push(['long1',blockNumber.toString(),logIndex.toString(),topicAddress(log?.topics?.[1]),orderId.toString(),amount.toString(),intervals.toString(),txHash]);continue;}
          if(t===hashes.cancel){if(w.length!==5)throw new Error('CancelLongTermOrder ABI mismatch');const [orderId,sellTokenWord,unsoldAmount,buyTokenWord,purchasedAmount]=w;const sellToken=wordAddress(sellTokenWord),buyToken=wordAddress(buyTokenWord);if(sameAddress(sellToken,row.token0))cancelUnsold0+=unsoldAmount;else if(sameAddress(sellToken,row.token1))cancelUnsold1+=unsoldAmount;else throw new Error('TWAMM cancel sell token identity mismatch');cancelCount++;eventDigestRows.push(['cancel',blockNumber.toString(),logIndex.toString(),topicAddress(log?.topics?.[1]),orderId.toString(),sellToken,unsoldAmount.toString(),buyToken,purchasedAmount.toString(),txHash]);continue;}
          if(t===hashes.withdraw){if(w.length!==3)throw new Error('WithdrawProceeds ABI mismatch');const [orderId,proceeds,expired]=w,proceedToken=topicAddress(log?.topics?.[2]);if(sameAddress(proceedToken,row.token0))withdrawToken0+=proceeds;else if(sameAddress(proceedToken,row.token1))withdrawToken1+=proceeds;else throw new Error('TWAMM withdraw token identity mismatch');withdrawCount++;eventDigestRows.push(['withdraw',blockNumber.toString(),logIndex.toString(),topicAddress(log?.topics?.[1]),orderId.toString(),proceedToken,proceeds.toString(),expired.toString(),txHash]);continue;}
          throw new Error('Unexpected TWAMM event topic');
        }
        if(feeBps!==expectedEndFeeBps)throw new Error(`TWAMM fee event/state parity mismatch ${row.pair}`);
        if(BigInt(longTermOrder0To1Count+longTermOrder1To0Count)!==endOrderId-startOrderId)throw new Error(`TWAMM order creation count/orderId parity mismatch ${row.pair}`);
        const d0=decimals.get(normalizeAddress(row.token0)),d1=decimals.get(normalizeAddress(row.token1));
        pairs.push({pair:row.pair,bamm:row.bamm,token0:{address:row.token0,decimals:d0},token1:{address:row.token1,decimals:d1},
          interval:{fromBlockExclusive:safeNumber(startBlock,'start block'),toBlockInclusive:safeNumber(endBlock,'end block'),eventCount:logs.length,transactionCount:txs.size,virtualExecutionCount,longTermOrder0To1Count,longTermOrder1To0Count,cancelCount,withdrawCount,feeUpdateCount},
          state:{start:{token0SalesRateRaw:startState[0].toString(),token1SalesRateRaw:startState[1].toString(),lastVirtualOrderTimestamp:safeNumber(startState[2],'TWAMM timestamp'),orderTimeIntervalSeconds:Number(startState[3]),rewardFactorPool0:startState[4].toString(),rewardFactorPool1:startState[5].toString(),nextOrderId:startOrderId.toString()},end:{token0SalesRateRaw:endState[0].toString(),token1SalesRateRaw:endState[1].toString(),lastVirtualOrderTimestamp:safeNumber(endState[2],'TWAMM timestamp'),orderTimeIntervalSeconds:Number(endState[3]),rewardFactorPool0:endState[4].toString(),rewardFactorPool1:endState[5].toString(),nextOrderId:endOrderId.toString()},salesRatePrecision:SELL_RATE_ADDITIONAL_PRECISION.toString()},
          feeSchedule:{startLpFeeBps:Number(FEE_DENOMINATOR-startStoredFee),endLpFeeBps:Number(expectedEndFeeBps),virtualExecutionUsage:[...feeUsage.entries()].map(([bps,count])=>({lpFeeBps:Number(bps),executionCount:count})).sort((a,b)=>a.lpFeeBps-b.lpFeeBps)},
          raw:{token0Sold:token0Sold.toString(),token1Sold:token1Sold.toString(),token0Bought:token0Bought.toString(),token1Bought:token1Bought.toString(),newOrder0Input:order0Input.toString(),newOrder1Input:order1Input.toString(),cancelUnsold0:cancelUnsold0.toString(),cancelUnsold1:cancelUnsold1.toString(),withdrawToken0:withdrawToken0.toString(),withdrawToken1:withdrawToken1.toString(),grossTwammFee0Numerator:grossFee0Numerator.toString(),grossTwammFee1Numerator:grossFee1Numerator.toString(),grossFeeDenominator:FEE_DENOMINATOR.toString()},
          values:{token0SoldToken:formatUnits(token0Sold,d0),token1SoldToken:formatUnits(token1Sold,d1),token0BoughtToken:formatUnits(token0Bought,d0),token1BoughtToken:formatUnits(token1Bought,d1),newOrder0InputToken:formatUnits(order0Input,d0),newOrder1InputToken:formatUnits(order1Input,d1),grossTwammFee0Token:formatUnits(grossFee0Numerator,d0+4),grossTwammFee1Token:formatUnits(grossFee1Numerator,d1+4)},
          eventDigest:sha256(stableStringify(eventDigestRows)),
          epistemic:{orderLifecycle:'MEASURED-event-ledger-exact-block-interval',virtualExecutionFlow:'MEASURED-VirtualOrderExecution-exact-block-interval',grossInputFeeUnits:'DERIVED-MECHANICAL-LongTermOrdersLib-fee-identity',ordinarySwapFlow:'EXCLUDED-separate-atom',feeRecipientSplit:'UNKNOWN-until-_mintFee-feeTo-accounting',measuredZeroAllowedWithinProvenInterval:true,realizedLpIncomeClaim:false,protocolRevenueClaim:false}});
      }
      const aggregateDigest=sha256(stableStringify(pairs.map(r=>[r.pair,r.interval,r.state,r.raw,r.feeSchedule,r.eventDigest])));
      return {version:FRAX_FRAXSWAP_TWAMM_VERSION,status:coverage.fullRegistryInterval?'ok':'partial-registry-identity-change',measurementClass:'MEASURED',observedAt:currentBammMeasurement.observedAt,chain:'fraxtal',chainId:FRAXTAL_CHAIN_ID,
        interval:{fromBlockExclusive:safeNumber(startBlock,'start block'),toBlockInclusive:safeNumber(endBlock,'end block'),fromBlockHash:previousBammMeasurement.blockHash,toBlockHash:currentBammMeasurement.blockHash,fromObservedAt:previousBammMeasurement.observedAt,toObservedAt:currentBammMeasurement.observedAt,nonOverlappingPublishedCheckpointInterval:true},coverage,pairs,aggregateDigest,
        summary:{pairCountWithVirtualExecution:pairs.filter(r=>r.interval.virtualExecutionCount>0).length,pairCountWithNewLongTermOrders:pairs.filter(r=>r.interval.longTermOrder0To1Count+r.interval.longTermOrder1To0Count>0).length,virtualExecutionEventCount:pairs.reduce((n,r)=>n+r.interval.virtualExecutionCount,0),newLongTermOrderCount:pairs.reduce((n,r)=>n+r.interval.longTermOrder0To1Count+r.interval.longTermOrder1To0Count,0),cancelEventCount:pairs.reduce((n,r)=>n+r.interval.cancelCount,0),withdrawEventCount:pairs.reduce((n,r)=>n+r.interval.withdrawCount,0),feeUpdateEventCount:pairs.reduce((n,r)=>n+r.interval.feeUpdateCount,0),heterogeneousTokenUnitsNotAggregated:true},
        rpc:{endpointId:endpoint.id,failoverAttempts:attempts},provenance:{officialSourceRepository:'FraxFinance/frax-solidity',officialSourceRef:FRAXSWAP_SOURCE_REF,pairSource:'src/hardhat/contracts/Fraxswap/core/FraxswapPair.sol',twammSource:'src/hardhat/contracts/Fraxswap/twamm/LongTermOrders.sol',mechanicalIdentity:['long-term order amount becomes TWAMM reserve','current sales rate * elapsed / 1e6 = virtual sold amount','VirtualOrderExecution emits sold/bought amounts','computeVirtualBalances applies stored fee complement to each sold input'],derivedSignaturesViaRpcSha3:true},
        epistemic:{twammOrderLifecycle:coverage.fullRegistryInterval?'MEASURED-registry-wide-published-interval':'MEASURED-common-pairs-partial-registry-interval',virtualOrderExecutionFlow:coverage.fullRegistryInterval?'MEASURED-registry-wide-published-interval':'MEASURED-common-pairs-partial-registry-interval',grossTwammInputFeeUnits:'DERIVED-MECHANICAL-source-proven-fee-formula',ordinarySwapFlow:'EXCLUDED-separate-atom',feeRecipientSplit:'UNKNOWN-until-Fraxswap-_mintFee-feeTo-accounting',unknownIsZero:false,measuredZeroAllowedWithinProvenInterval:true,realizedLpIncomeClaim:false,protocolRevenueClaim:false,causalClaimAuthority:'none',executionAuthority:'none'}};
    }catch(error){attempts.push({endpointId:endpoint.id,error:error instanceof Error?error.message:String(error)});}
  }
  return unknown({current:currentBammMeasurement,previous:previousBammMeasurement,attempts,coverage});
}

export function applyFraxswapTwamm({state,previousState,measurement}){
  if(!state||typeof state!=='object')throw new Error('Fraxswap TWAMM adapter requires Economic Graph state');
  if(state?.authority?.executionAuthority!=='none'||state?.authority?.causalClaimAuthority!=='none')throw new Error('Fraxswap TWAMM adapter refuses Graph authority drift');
  const evidence=state?.protocolEvidence?.[FRAX_ECOSYSTEM_EVIDENCE_ID],base=evidence?.latest?.observation,sensor=state?.protocolSensors?.[FRAX_PROTOCOL_ID],surface=base?.surfaces?.fraxswapBamm;if(!evidence||!base||!sensor||!surface?.measured||!String(surface.measurementState||'').startsWith('MEASURED'))throw new Error('Measured Fraxswap/BAMM surface missing before TWAMM enrichment');
  const current=structuredClone(base),target=current.surfaces.fraxswapBamm;target.measured={...target.measured,twammFlow:measurement};const valid=measurement?.measurementClass==='MEASURED'&&measurement?.interval?.nonOverlappingPublishedCheckpointInterval===true&&Array.isArray(measurement?.pairs)&&measurement.pairs.length>0;
  if(valid&&!target.mechanicalRelations.some(r=>r.from==='TWAMM virtual order flow'&&r.to==='TWAMM gross input fees'))target.mechanicalRelations.push({from:'TWAMM virtual order flow',to:'TWAMM gross input fees',class:'MECHANICAL-proven-Fraxtal-VirtualOrderExecution-fee-path'});
  current.relationshipGraph=Object.values(current.surfaces||{}).flatMap(s=>s.mechanicalRelations.map((r,index)=>({surfaceId:s.id,index,...r})));current.coverage.relationshipCount=current.relationshipGraph.length;current.coverage.relationshipClassCounts=current.relationshipGraph.reduce((a,r)=>{const k=String(r.class||'UNKNOWN').split('-')[0];a[k]=(a[k]||0)+1;return a;},{});
  current.epistemic.fraxswapTwammFlow=valid?(measurement.coverage?.fullRegistryInterval?'MEASURED-order-lifecycle+virtual-flow+DERIVED-gross-fees-registry-interval':'MEASURED-order-lifecycle+virtual-flow+DERIVED-gross-fees-common-pairs-partial'):'UNKNOWN';current.epistemic.fraxswapFeeRecipientSplit='UNKNOWN-until-_mintFee-feeTo-accounting';
  current.measurementExtensions={...(current.measurementExtensions||{}),fraxswapTwamm:FRAX_FRAXSWAP_TWAMM_VERSION};current.nextMeasurementUnlocks=(current.nextMeasurementUnlocks||[]).map(x=>String(x).includes('next isolate TWAMM flow')?'Regular Swap flow and TWAMM virtual-order flow are now separately measured on Fraxtal; next prove Fraxswap _mintFee/feeTo revenue routing, then BAMM lender longitudinal yield.':x);
  current.id=`frax-ecosystem:${sha256(stableStringify({priorId:base.id,twamm:valid?{from:measurement.interval.fromBlockExclusive,to:measurement.interval.toBlockInclusive,digest:measurement.aggregateDigest,fullRegistryInterval:measurement.coverage?.fullRegistryInterval}:{status:measurement?.status||'UNKNOWN'},surfaceIds:current.coverage.surfaceIds})).slice(0,24)}`;
  const prevRows=Array.isArray(previousState?.protocolEvidence?.[FRAX_ECOSYSTEM_EVIDENCE_ID]?.observations)?previousState.protocolEvidence[FRAX_ECOSYSTEM_EVIDENCE_ID].observations:[];const rows=[...prevRows];if(!rows.some(r=>r?.id===current.id))rows.push(current);const bounded=rows.slice(-MAX_OBSERVATIONS);evidence.latest={observation:current};evidence.status=current.status;evidence.observations=bounded;evidence.observationCount=bounded.length;evidence.measurementExtensions={...(evidence.measurementExtensions||{}),fraxswapTwamm:FRAX_FRAXSWAP_TWAMM_VERSION};sensor.ecosystemFamily={...(sensor.ecosystemFamily||{}),latestObservationId:current.id,measurementExtensions:{...(sensor.ecosystemFamily?.measurementExtensions||{}),fraxswapTwamm:FRAX_FRAXSWAP_TWAMM_VERSION}};if(sensor?.latest?.observation)sensor.latest.observation.ecosystemFamily=sensor.ecosystemFamily;
  if(current.coverage.measuredSurfaceCount+current.coverage.sourceBoundUnknownSurfaceCount!==current.coverage.surfaceCount)throw new Error('Fraxswap TWAMM depth accounting drift');if(valid&&!String(current.epistemic.fraxswapTwammFlow).startsWith('MEASURED'))throw new Error('Fraxswap TWAMM epistemic promotion missing');if(current?.authority?.executionAuthority!=='none'||current?.epistemic?.executionAuthority!=='none'||measurement?.epistemic?.executionAuthority!=='none')throw new Error('Fraxswap TWAMM execution authority leaked');return state;
}
