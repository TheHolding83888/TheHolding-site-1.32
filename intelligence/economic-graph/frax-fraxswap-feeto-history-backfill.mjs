#!/usr/bin/env node
/**
 * The Holding · Fraxtal Fraxswap feeTo historical backfill v0.1
 *
 * Bounded, resumable historical recovery for protocol-fee LP flow. It walks
 * backwards from the last published Graph checkpoint and reconstructs two
 * independent evidence tracks:
 *   1) exact _mintFee recipient events inferred from source-ordered LP mint
 *      Transfer + Mint/Burn terminals; and
 *   2) exact inbound/outbound LP transfer ledgers for every feeTo recipient
 *      discovered so far, including strict feeTo -> pair -> burn redemptions.
 *
 * Important boundary: FraxswapFactory.setFeeTo emits no setter event in the
 * pinned source. Therefore this module proves feeTo identity only at actual
 * protocol-fee mint execution moments. It never claims continuous feeTo state
 * between those moments and never assigns economic semantics to downstream
 * recipient addresses without separate evidence.
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
  FRAXTAL_RPC_ENDPOINTS,
  FRAXSWAP_FACTORY_FRAXTAL
} from './frax-bamm-onchain.mjs';
import {
  FRAXSWAP_SOURCE_REF,
  FRAX_FRAXSWAP_PROTOCOL_FEE_VERSION
} from './frax-fraxswap-protocol-fee-routing.mjs';

export const FRAXSWAP_FEETO_HISTORY_BACKFILL_VERSION='0.1-fraxtal-fraxswap-feeto-history-backfill';
const RPC_TIMEOUT_MS=12_000;
const MAX_BATCH_CALLS=100;
const ADDRESS_BATCH_SIZE=80;
const DISCOVERY_WINDOW_BLOCKS=250_000n;
const RECIPIENT_LEDGER_WINDOW_BLOCKS=500_000n;
const MIN_ADAPTIVE_LOG_SPAN=2_000n;
const MAX_ADAPTIVE_SPLIT_DEPTH=12;
const MAX_RECIPIENT_LEDGER_SCANS_PER_RUN=2;
const MAX_PERSISTED_PROTOCOL_FEE_EVENTS=5_000;
const MAX_PERSISTED_LEDGER_EVENTS=10_000;
const MAX_PERSISTED_REDEMPTIONS=5_000;
const MAX_PERSISTED_WINDOWS=256;
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
function topicAddress(topic){const x=String(topic||'').replace(/^0x/,'');if(x.length!==64)return null;return `0x${x.slice(24)}`;}
function topicForAddress(v){return `0x${normalizeAddress(v).replace(/^0x/,'').padStart(64,'0')}`;}
function format18(v){const n=BigInt(v),whole=n/E18,frac=(n%E18).toString().padStart(18,'0').replace(/0+$/,'');return frac?`${whole}.${frac}`:whole.toString();}
function dedupeBy(rows,keyFn){const m=new Map();for(const row of rows)m.set(keyFn(row),row);return [...m.values()];}
function eventKey(x){return `${normalizeAddress(x.pair)}:${String(x.tx||'').toLowerCase()}:${x.logIndex}`;}
function isProgressMeasurement(m){return m?.version===FRAXSWAP_FEETO_HISTORY_BACKFILL_VERSION&&['MEASURED','PARTIAL'].includes(m?.measurementClass)&&m?.coverage?.anchorBlockInclusive!==undefined;}

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
  if(protocolFeeMeasurement?.version!==FRAX_FRAXSWAP_PROTOCOL_FEE_VERSION)throw new Error('Fraxswap protocol-fee measurement version drift');
  if(Number(protocolFeeMeasurement?.blockNumber)!==Number(currentBammMeasurement.blockNumber)||String(protocolFeeMeasurement?.blockHash||'').toLowerCase()!==String(currentBammMeasurement.blockHash).toLowerCase())throw new Error('Protocol-fee measurement current checkpoint mismatch');
  if(Number(protocolFeeMeasurement?.interval?.fromBlockExclusive)!==Number(previousBammMeasurement.blockNumber)||String(protocolFeeMeasurement?.interval?.fromBlockHash||'').toLowerCase()!==String(previousBammMeasurement.blockHash).toLowerCase())throw new Error('Protocol-fee measurement previous checkpoint mismatch');
  const pairs=Array.isArray(protocolFeeMeasurement?.pairs)?protocolFeeMeasurement.pairs:[];
  if(pairs.length!==Number(protocolFeeMeasurement?.factory?.endPairCount))throw new Error('Protocol-fee current pair registry incomplete');
}

function blankSummary(){return {
  protocolFeeMintEventCountBackfilled:0,
  protocolFeeMintPairCountBackfilled:0,
  trackedFeeToRecipientCount:0,
  historicalProtocolFeeRecipientCount:0,
  inboundLpTransferEventCountBackfilled:0,
  outboundLpTransferEventCountBackfilled:0,
  strictRedemptionCountBackfilled:0,
  unresolvedPairOutflowCountBackfilled:0
};}
function blankHistory(){return {protocolFeeMintEvents:[],lpTransferEvents:[],strictRedemptions:[],unresolvedPairOutflows:[],recipientStats:{},pairIdsWithProtocolFeeMints:[]};}
function blankCoverage(anchorBlockInclusive){return {
  anchorBlockInclusive,
  factoryDeploymentBlock:null,
  factoryDeploymentBlockHash:null,
  deploymentResolution:'UNKNOWN-not-attempted',
  discovery:{coveredFromBlockInclusive:null,coveredToBlockInclusive:null,nextToBlockInclusive:anchorBlockInclusive,completeToFactoryDeployment:false,windows:[]},
  recipientLedgers:{},
  allKnownRecipientLedgersCompleteToFactoryDeployment:false,
  currentRun:{discoveryWindow:null,recipientLedgerWindows:[]},
  progressPreserved:false
};}

function preserveProgressUnknown({current,previousProgress,attempts,reason}){
  if(!isProgressMeasurement(previousProgress))return {
    version:FRAXSWAP_FEETO_HISTORY_BACKFILL_VERSION,status:reason,measurementClass:'UNKNOWN',observedAt:current?.observedAt||null,chain:'fraxtal',chainId:FRAXTAL_CHAIN_ID,
    coverage:null,summary:blankSummary(),history:blankHistory(),rpc:{endpointId:null,failoverAttempts:attempts||[]},
    provenance:{officialSourceRepository:'FraxFinance/frax-solidity',officialSourceRef:FRAXSWAP_SOURCE_REF},
    epistemic:{historicalProtocolFeeMintRecipients:'UNKNOWN',historicalFeeToLpTransferFlow:'UNKNOWN',historicalFeeToLpRedemptionFlow:'UNKNOWN',continuousFeeToStateHistory:'UNKNOWN-no-setFeeTo-event-and-no-complete-call-trace',historicalFeeToSetterTransitions:'UNKNOWN',downstreamRecipientSemantics:'UNKNOWN',heterogeneousLpUnitsAggregated:false,lpUnitValuationPerformed:false,protocolRevenueUsdClaim:false,veFraxDistributionClaim:false,companyCashFlowClaim:false,unknownIsZero:false,causalClaimAuthority:'none',executionAuthority:'none'}
  };
  const out=structuredClone(previousProgress);
  out.status=reason;
  out.measurementClass='PARTIAL';
  out.observedAt=current?.observedAt||previousProgress.observedAt||null;
  out.coverage={...out.coverage,progressPreserved:true,currentRun:{discoveryWindow:null,recipientLedgerWindows:[]}};
  out.rpc={endpointId:null,failoverAttempts:attempts||[]};
  out.latestAttempt={status:'UNKNOWN',reason,attempts:attempts||[],observedAt:out.observedAt};
  out.epistemic={...(out.epistemic||{}),currentBackfillWindow:'UNKNOWN-read-failed-progress-preserved',continuousFeeToStateHistory:'UNKNOWN-no-setFeeTo-event-and-no-complete-call-trace',historicalFeeToSetterTransitions:'UNKNOWN-no-setFeeTo-event-and-no-complete-call-trace'};
  return out;
}

async function getBlock(url,block,fetchImpl,id=1){const tag=hexQuantity(block);const x=await postBatch(url,[{jsonrpc:'2.0',id,method:'eth_getBlockByNumber',params:[tag,false]}],fetchImpl);const b=x.get(id).result;if(!b||String(b.number||'').toLowerCase()!==tag.toLowerCase()||!/^0x[0-9a-f]{64}$/i.test(String(b.hash||'')))throw new Error(`Historical block unavailable ${block}`);return {number:Number(block),hash:String(b.hash).toLowerCase()};}
async function codeAt(url,block,fetchImpl,id=1){const x=await postBatch(url,[{jsonrpc:'2.0',id,method:'eth_getCode',params:[FRAXSWAP_FACTORY_FRAXTAL,hexQuantity(block)]}],fetchImpl);return String(x.get(id).result||'').toLowerCase();}
async function resolveFactoryDeploymentBlock({url,currentBlock,fetchImpl}){
  try{
    const currentCode=await codeAt(url,currentBlock,fetchImpl,1);if(currentCode==='0x'||currentCode==='0x0')return {block:null,hash:null,state:'UNKNOWN-current-factory-code-empty'};
    let lo=0n,hi=BigInt(currentBlock);
    const zeroCode=await codeAt(url,0n,fetchImpl,2);if(zeroCode!=='0x'&&zeroCode!=='0x0')return {block:0,hash:(await getBlock(url,0n,fetchImpl,3)).hash,state:'DERIVED-MECHANICAL-archive-code-binary-search'};
    while(lo<hi){const mid=(lo+hi)>>1n;const code=await codeAt(url,mid,fetchImpl,4);if(code!=='0x'&&code!=='0x0')hi=mid;else lo=mid+1n;}
    const boundary=await getBlock(url,lo,fetchImpl,5);
    return {block:Number(lo),hash:boundary.hash,state:'DERIVED-MECHANICAL-archive-code-binary-search-no-selfdestruct-in-pinned-factory-source'};
  }catch(error){return {block:null,hash:null,state:`UNKNOWN-historical-eth_getCode-unavailable:${error instanceof Error?error.message:String(error)}`};}
}

async function adaptiveGetLogs({url,address,from,to,topics,fetchImpl,depth=0}){
  const req={jsonrpc:'2.0',id:1,method:'eth_getLogs',params:[{address,fromBlock:hexQuantity(from),toBlock:hexQuantity(to),topics}]};
  try{const x=await postBatch(url,[req],fetchImpl);const rows=x.get(1).result;if(!Array.isArray(rows))throw new Error('eth_getLogs response is not an array');return rows;}
  catch(error){
    if(from>=to||to-from+1n<=MIN_ADAPTIVE_LOG_SPAN||depth>=MAX_ADAPTIVE_SPLIT_DEPTH)throw error;
    const mid=(from+to)>>1n;
    const [a,b]=await Promise.all([
      adaptiveGetLogs({url,address,from,to:mid,topics,fetchImpl,depth:depth+1}),
      adaptiveGetLogs({url,address,from:mid+1n,to,topics,fetchImpl,depth:depth+1})
    ]);
    return [...a,...b];
  }
}
async function logsAcrossPairs({url,pairs,from,to,topics,fetchImpl}){
  const addresses=pairs.map(p=>p.pair);
  const chunks=[];for(let i=0;i<addresses.length;i+=ADDRESS_BATCH_SIZE)chunks.push(addresses.slice(i,i+ADDRESS_BATCH_SIZE));
  const rows=(await Promise.all(chunks.map(address=>adaptiveGetLogs({url,address,from,to,topics,fetchImpl})))).flat();
  const allowed=new Set(addresses.map(normalizeAddress));
  for(const log of rows){if(!allowed.has(normalizeAddress(log.address)))throw new Error('Historical Fraxswap log escaped pair registry');const b=rpcQuantity(log.blockNumber);if(b<from||b>to)throw new Error('Historical Fraxswap log escaped block window');}
  return rows;
}

function decodeZeroMint(log,transferTopic){
  if(String(log?.topics?.[0]||'').toLowerCase()!==transferTopic||(log.topics||[]).length!==3)throw new Error('Historical zero-mint Transfer ABI mismatch');
  const from=topicAddress(log.topics[1]),to=topicAddress(log.topics[2]),value=word(log.data);
  if(!sameAddress(from,ZERO)||!to)throw new Error('Historical zero-mint Transfer identity mismatch');
  return {pair:normalizeAddress(log.address),to,value,blockNumber:Number(rpcQuantity(log.blockNumber)),logIndex:Number(rpcQuantity(log.logIndex)),tx:String(log.transactionHash||'').toLowerCase()};
}
function decodeTransfer(log,transferTopic){
  if(String(log?.topics?.[0]||'').toLowerCase()!==transferTopic||(log.topics||[]).length!==3)throw new Error('Historical Transfer ABI mismatch');
  const from=topicAddress(log.topics[1]),to=topicAddress(log.topics[2]),value=word(log.data);
  if(!from||!to)throw new Error('Historical Transfer address decode failed');
  return {pair:normalizeAddress(log.address),from,to,value,blockNumber:Number(rpcQuantity(log.blockNumber)),logIndex:Number(rpcQuantity(log.logIndex)),tx:String(log.transactionHash||'').toLowerCase()};
}
function decodeBurn(log,burnTopic){
  if(String(log?.topics?.[0]||'').toLowerCase()!==burnTopic||(log.topics||[]).length!==3)throw new Error('Historical Burn ABI mismatch');
  const [amount0,amount1]=words(log.data);if(amount0===undefined||amount1===undefined)throw new Error('Historical Burn amounts missing');
  const sender=topicAddress(log.topics[1]),to=topicAddress(log.topics[2]);if(!sender||!to)throw new Error('Historical Burn address decode failed');
  return {sender,to,amount0,amount1,blockNumber:Number(rpcQuantity(log.blockNumber)),logIndex:Number(rpcQuantity(log.logIndex)),tx:String(log.transactionHash||'').toLowerCase()};
}

function classifyProtocolFeeMintRecipients({zeroMints,terminals,topics,pairMeta}){
  const rowsByKey=new Map();
  for(const z0 of zeroMints){const z=decodeZeroMint(z0,topics.transfer),key=`${z.pair}:${z.tx}`;if(!rowsByKey.has(key))rowsByKey.set(key,[]);rowsByKey.get(key).push({type:'zeroMint',...z});}
  const activeKeys=new Set(rowsByKey.keys());
  for(const log of terminals){const pair=normalizeAddress(log.address),tx=String(log.transactionHash||'').toLowerCase(),key=`${pair}:${tx}`;if(!activeKeys.has(key))continue;const topic0=String(log?.topics?.[0]||'').toLowerCase();if(topic0===topics.mint)rowsByKey.get(key).push({type:'Mint',pair,tx,blockNumber:Number(rpcQuantity(log.blockNumber)),logIndex:Number(rpcQuantity(log.logIndex))});else if(topic0===topics.burn)rowsByKey.get(key).push({type:'Burn',pair,tx,blockNumber:Number(rpcQuantity(log.blockNumber)),logIndex:Number(rpcQuantity(log.logIndex))});else throw new Error('Unexpected historical Fraxswap terminal topic');}

  const events=[];let minimumLiquidityMintCount=0;
  for(const [key,rows0] of rowsByKey){
    const rows=[...rows0].sort((a,b)=>a.logIndex-b.logIndex);let pending=[];
    for(const row of rows){
      if(row.type==='zeroMint'){pending.push(row);continue;}
      if(row.type==='Mint'){
        if(!pending.length)throw new Error(`Historical Mint without zero-origin LP mint ${key}`);
        const prior=pending.slice(0,-1);
        for(const p of prior){if(sameAddress(p.to,ZERO)){minimumLiquidityMintCount++;continue;}events.push({pair:p.pair,recipient:p.to,valueRaw:p.value.toString(),valueLp:format18(p.value),blockNumber:p.blockNumber,logIndex:p.logIndex,tx:p.tx,terminal:'Mint',recipientIdentity:'DERIVED-MECHANICAL-_mintFee-recipient-equals-factory-feeTo-at-execution'});}
        pending=[];continue;
      }
      if(row.type==='Burn'){
        for(const p of pending){if(sameAddress(p.to,ZERO))throw new Error(`Unexpected zero-address protocol fee mint before Burn ${key}`);events.push({pair:p.pair,recipient:p.to,valueRaw:p.value.toString(),valueLp:format18(p.value),blockNumber:p.blockNumber,logIndex:p.logIndex,tx:p.tx,terminal:'Burn',recipientIdentity:'DERIVED-MECHANICAL-_mintFee-recipient-equals-factory-feeTo-at-execution'});}
        pending=[];continue;
      }
    }
    if(pending.length)throw new Error(`Historical unconsumed zero-origin LP mint sequence ${key}`);
  }
  for(const e of events)if(!pairMeta.has(e.pair))throw new Error('Historical protocol-fee event pair metadata missing');
  return {events,minimumLiquidityMintCount};
}

async function scanProtocolFeeDiscoveryWindow({url,pairs,from,to,topics,fetchImpl}){
  const zeroMints=await logsAcrossPairs({url,pairs,from,to,topics:[topics.transfer,topicForAddress(ZERO)],fetchImpl});
  const txKeys=new Set(zeroMints.map(x=>`${normalizeAddress(x.address)}:${String(x.transactionHash||'').toLowerCase()}`));
  let terminals=[];
  if(txKeys.size){
    const all=await logsAcrossPairs({url,pairs,from,to,topics:[[topics.mint,topics.burn]],fetchImpl});
    terminals=all.filter(x=>txKeys.has(`${normalizeAddress(x.address)}:${String(x.transactionHash||'').toLowerCase()}`));
  }
  const pairMeta=new Map(pairs.map(p=>[normalizeAddress(p.pair),p]));
  return classifyProtocolFeeMintRecipients({zeroMints,terminals,topics,pairMeta});
}

async function fetchReceipts({url,txs,fetchImpl}){
  const uniq=[...new Set(txs.filter(Boolean).map(x=>String(x).toLowerCase()))];if(!uniq.length)return new Map();
  const payload=uniq.map((tx,i)=>({jsonrpc:'2.0',id:i+1,method:'eth_getTransactionReceipt',params:[tx]}));const x=await batched(url,payload,fetchImpl);const out=new Map();for(let i=0;i<uniq.length;i++){const r=x.get(i+1).result;if(!r||!Array.isArray(r.logs))throw new Error(`Historical receipt unavailable ${uniq[i]}`);out.set(uniq[i],r);}return out;
}
function classifyStrictRedemptions({outbound,pairMeta,receipts,topics}){
  const redemptions=[],unresolved=[];
  for(const out of outbound){
    if(!sameAddress(out.to,out.pair))continue;
    const receipt=receipts.get(out.tx);if(!receipt){unresolved.push({pair:out.pair,feeToRecipient:out.from,to:out.to,valueRaw:out.value.toString(),blockNumber:out.blockNumber,logIndex:out.logIndex,tx:out.tx,reason:'UNKNOWN-receipt-unavailable'});continue;}
    const pairLogs=receipt.logs.filter(l=>sameAddress(l.address,out.pair)&&Number(rpcQuantity(l.logIndex))>out.logIndex);
    const burnTransfers=[];const burns=[];
    for(const log of pairLogs){const t0=String(log?.topics?.[0]||'').toLowerCase();if(t0===topics.transfer){const t=decodeTransfer(log,topics.transfer);if(sameAddress(t.from,out.pair)&&sameAddress(t.to,ZERO))burnTransfers.push(t);}else if(t0===topics.burn)burns.push(decodeBurn(log,topics.burn));}
    if(burnTransfers.length===1&&burns.length===1&&burnTransfers[0].value===out.value){const meta=pairMeta.get(normalizeAddress(out.pair));redemptions.push({pair:out.pair,feeToRecipient:out.from,lpValueRaw:out.value.toString(),lpValueLp:format18(out.value),blockNumber:out.blockNumber,tx:out.tx,transferLogIndex:out.logIndex,burnTransferLogIndex:burnTransfers[0].logIndex,burnLogIndex:burns[0].logIndex,redemptionRecipient:burns[0].to,token0:meta?.token0||null,amount0Raw:burns[0].amount0.toString(),token1:meta?.token1||null,amount1Raw:burns[0].amount1.toString(),attribution:'DERIVED-MECHANICAL-exact-feeTo-to-pair-transfer-equals-pair-burn'});}else unresolved.push({pair:out.pair,feeToRecipient:out.from,to:out.to,valueRaw:out.value.toString(),blockNumber:out.blockNumber,logIndex:out.logIndex,tx:out.tx,reason:'UNKNOWN-pair-received-feeTo-LP-but-exact-burn-attribution-not-unique-or-amount-mismatched'});
  }
  return {redemptions,unresolved};
}

async function scanRecipientLedgerWindow({url,pairs,recipient,from,to,topics,fetchImpl}){
  const recipientTopic=topicForAddress(recipient);
  const [inboundLogs,outboundLogs]=await Promise.all([
    logsAcrossPairs({url,pairs,from,to,topics:[topics.transfer,null,recipientTopic],fetchImpl}),
    logsAcrossPairs({url,pairs,from,to,topics:[topics.transfer,recipientTopic],fetchImpl})
  ]);
  const all=dedupeBy([...inboundLogs,...outboundLogs],x=>`${normalizeAddress(x.address)}:${String(x.transactionHash||'').toLowerCase()}:${String(x.logIndex||'')}`);
  const decoded=all.map(x=>decodeTransfer(x,topics.transfer)).sort((a,b)=>a.blockNumber-b.blockNumber||a.logIndex-b.logIndex);
  const ledger=[];const outbound=[];
  for(const t of decoded){const fromIs=sameAddress(t.from,recipient),toIs=sameAddress(t.to,recipient);if(!fromIs&&!toIs)throw new Error('Recipient ledger Transfer filter mismatch');let direction='self';if(toIs&&!fromIs)direction='inbound';else if(fromIs&&!toIs)direction='outbound';const row={pair:t.pair,feeToRecipient:recipient,from:t.from,to:t.to,valueRaw:t.value.toString(),valueLp:format18(t.value),blockNumber:t.blockNumber,logIndex:t.logIndex,tx:t.tx,direction,origin:sameAddress(t.from,ZERO)?'mint':'transfer',route:direction==='outbound'?(sameAddress(t.to,t.pair)?'feeTo-to-pair':'feeTo-to-downstream-address'):null};ledger.push(row);if(direction==='outbound')outbound.push(t);}
  const pairOutflows=outbound.filter(x=>sameAddress(x.to,x.pair));
  const receipts=await fetchReceipts({url,txs:pairOutflows.map(x=>x.tx),fetchImpl});
  const pairMeta=new Map(pairs.map(p=>[normalizeAddress(p.pair),p]));
  const {redemptions,unresolved}=classifyStrictRedemptions({outbound:pairOutflows,pairMeta,receipts,topics});
  return {ledger,redemptions,unresolved};
}

function updateRecipientStats(stats0,events,currentFeeTo){
  const stats=structuredClone(stats0||{});
  for(const e of events){const key=normalizeAddress(e.recipient),row=stats[key]||{address:e.recipient,protocolFeeMintEventCount:0,pairIds:[],firstProtocolFeeMintBlock:null,lastProtocolFeeMintBlock:null};row.protocolFeeMintEventCount++;if(!row.pairIds.map(normalizeAddress).includes(normalizeAddress(e.pair)))row.pairIds.push(e.pair);row.firstProtocolFeeMintBlock=row.firstProtocolFeeMintBlock===null?e.blockNumber:Math.min(row.firstProtocolFeeMintBlock,e.blockNumber);row.lastProtocolFeeMintBlock=row.lastProtocolFeeMintBlock===null?e.blockNumber:Math.max(row.lastProtocolFeeMintBlock,e.blockNumber);row.matchesCurrentFeeTo=sameAddress(e.recipient,currentFeeTo);stats[key]=row;}
  return stats;
}
function initRecipientLedgerState(coverage,address,anchorBlock,source){const key=normalizeAddress(address);if(!coverage.recipientLedgers[key])coverage.recipientLedgers[key]={address,source,nextToBlockInclusive:anchorBlock,coveredFromBlockInclusive:null,coveredToBlockInclusive:null,completeToFactoryDeployment:false,windows:[]};return coverage.recipientLedgers[key];}
function appendWindow(list,window){const rows=[...(Array.isArray(list)?list:[]),window];return rows.slice(-MAX_PERSISTED_WINDOWS);}

export async function collectFraxswapFeeToHistoryBackfill({currentBammMeasurement,previousBammMeasurement,protocolFeeMeasurement,previousBackfillMeasurement,endpoints=FRAXTAL_RPC_ENDPOINTS,fetchImpl=fetch,discoveryWindowBlocks=DISCOVERY_WINDOW_BLOCKS,recipientLedgerWindowBlocks=RECIPIENT_LEDGER_WINDOW_BLOCKS,maxRecipientLedgerScansPerRun=MAX_RECIPIENT_LEDGER_SCANS_PER_RUN}={}){
  const attempts=[];try{validateInputs({currentBammMeasurement,previousBammMeasurement,protocolFeeMeasurement});}
  catch(error){return preserveProgressUnknown({current:currentBammMeasurement,previousProgress:previousBackfillMeasurement,attempts:[{endpointId:null,error:error.message}],reason:'UNKNOWN-fraxswap-feeto-history-prerequisite-unavailable'});}

  const pairs=protocolFeeMeasurement.pairs,currentFeeTo=protocolFeeMeasurement.factory.endFeeTo;
  const preferred=protocolFeeMeasurement?.rpc?.endpointId||currentBammMeasurement?.rpc?.endpointId;
  const ordered=[...endpoints].sort((a,b)=>(a.id===preferred?-1:0)-(b.id===preferred?-1:0));
  for(const endpoint of ordered){
    try{
      const signatures=['Transfer(address,address,uint256)','Mint(address,uint256,uint256)','Burn(address,uint256,uint256,address)'];
      const sigReq=signatures.map((s,i)=>({jsonrpc:'2.0',id:i+1,method:'web3_sha3',params:[asciiHex(s)]}));
      const sig=await postBatch(endpoint.url,sigReq,fetchImpl),hashes=new Map(signatures.map((s,i)=>[s,String(sig.get(i+1).result).toLowerCase()]));
      for(const [s,h] of hashes)if(!/^0x[0-9a-f]{64}$/.test(h))throw new Error(`Signature hash failed ${s}`);
      const topics={transfer:hashes.get('Transfer(address,address,uint256)'),mint:hashes.get('Mint(address,uint256,uint256)'),burn:hashes.get('Burn(address,uint256,uint256,address)')};

      const previous=isProgressMeasurement(previousBackfillMeasurement)?structuredClone(previousBackfillMeasurement):null;
      const anchorBlock=previous?Number(previous.coverage.anchorBlockInclusive):Number(previousBammMeasurement.blockNumber);
      if(anchorBlock>Number(previousBammMeasurement.blockNumber))throw new Error('Historical backfill anchor escaped current published history');
      let coverage=previous?structuredClone(previous.coverage):blankCoverage(anchorBlock);
      let history=previous?structuredClone(previous.history):blankHistory();
      let summary=previous?structuredClone(previous.summary):blankSummary();
      coverage.progressPreserved=false;coverage.currentRun={discoveryWindow:null,recipientLedgerWindows:[]};

      if(coverage.factoryDeploymentBlock===null||coverage.factoryDeploymentBlock===undefined||!Number.isSafeInteger(Number(coverage.factoryDeploymentBlock))||Number(coverage.factoryDeploymentBlock)<0){const deploy=await resolveFactoryDeploymentBlock({url:endpoint.url,currentBlock:currentBammMeasurement.blockNumber,fetchImpl});coverage.factoryDeploymentBlock=deploy.block;coverage.factoryDeploymentBlockHash=deploy.hash;coverage.deploymentResolution=deploy.state;}
      const lowerBound=coverage.factoryDeploymentBlock===null?0n:BigInt(coverage.factoryDeploymentBlock);

      const discoveryNext=coverage.discovery?.nextToBlockInclusive;
      let newProtocolFeeEvents=[];
      if(discoveryNext!==null&&discoveryNext!==undefined&&BigInt(discoveryNext)>=lowerBound){
        const to=BigInt(discoveryNext),window=BigInt(discoveryWindowBlocks);let from=to-window+1n;if(from<lowerBound)from=lowerBound;
        const [fromBlock,toBlock,discovery]=await Promise.all([getBlock(endpoint.url,from,fetchImpl,100),getBlock(endpoint.url,to,fetchImpl,101),scanProtocolFeeDiscoveryWindow({url:endpoint.url,pairs,from,to,topics,fetchImpl})]);
        newProtocolFeeEvents=discovery.events;
        coverage.discovery.coveredToBlockInclusive=coverage.discovery.coveredToBlockInclusive??Number(to);
        coverage.discovery.coveredFromBlockInclusive=Number(from);
        coverage.discovery.nextToBlockInclusive=from===lowerBound?null:Number(from-1n);
        coverage.discovery.completeToFactoryDeployment=from===lowerBound&&coverage.factoryDeploymentBlock!==null;
        const w={fromBlockInclusive:Number(from),toBlockInclusive:Number(to),fromBlockHash:fromBlock.hash,toBlockHash:toBlock.hash,protocolFeeMintEventCount:newProtocolFeeEvents.length,minimumLiquidityMintCount:discovery.minimumLiquidityMintCount};
        coverage.discovery.windows=appendWindow(coverage.discovery.windows,w);coverage.currentRun.discoveryWindow=w;
      }

      const combinedProtocolEvents=dedupeBy([...(history.protocolFeeMintEvents||[]),...newProtocolFeeEvents],eventKey).sort((a,b)=>b.blockNumber-a.blockNumber||b.logIndex-a.logIndex);
      history.protocolFeeMintEvents=combinedProtocolEvents.slice(0,MAX_PERSISTED_PROTOCOL_FEE_EVENTS);
      history.protocolFeeMintEventLedgerTruncated=combinedProtocolEvents.length>MAX_PERSISTED_PROTOCOL_FEE_EVENTS;
      history.recipientStats=updateRecipientStats(history.recipientStats,newProtocolFeeEvents,currentFeeTo);
      const pairIds=new Set([...(history.pairIdsWithProtocolFeeMints||[]).map(normalizeAddress),...newProtocolFeeEvents.map(x=>normalizeAddress(x.pair))]);history.pairIdsWithProtocolFeeMints=[...pairIds];

      if(!sameAddress(currentFeeTo,ZERO))initRecipientLedgerState(coverage,currentFeeTo,anchorBlock,'current-feeTo-at-latest-checkpoint');
      for(const e of newProtocolFeeEvents)initRecipientLedgerState(coverage,e.recipient,anchorBlock,'protocol-fee-mint-recipient');
      for(const row of Object.values(history.recipientStats||{}))initRecipientLedgerState(coverage,row.address,anchorBlock,'protocol-fee-mint-recipient');

      const pending=Object.values(coverage.recipientLedgers||{}).filter(x=>x.nextToBlockInclusive!==null&&x.nextToBlockInclusive!==undefined&&BigInt(x.nextToBlockInclusive)>=lowerBound).sort((a,b)=>Number(b.nextToBlockInclusive)-Number(a.nextToBlockInclusive)||normalizeAddress(a.address).localeCompare(normalizeAddress(b.address))).slice(0,Math.max(0,Number(maxRecipientLedgerScansPerRun)||0));
      let newLedgerEvents=[],newRedemptions=[],newUnresolved=[];
      for(const ledgerState of pending){const to=BigInt(ledgerState.nextToBlockInclusive),window=BigInt(recipientLedgerWindowBlocks);let from=to-window+1n;if(from<lowerBound)from=lowerBound;const [fromBlock,toBlock,scan]=await Promise.all([getBlock(endpoint.url,from,fetchImpl,200),getBlock(endpoint.url,to,fetchImpl,201),scanRecipientLedgerWindow({url:endpoint.url,pairs,recipient:ledgerState.address,from,to,topics,fetchImpl})]);newLedgerEvents.push(...scan.ledger);newRedemptions.push(...scan.redemptions);newUnresolved.push(...scan.unresolved);ledgerState.coveredToBlockInclusive=ledgerState.coveredToBlockInclusive??Number(to);ledgerState.coveredFromBlockInclusive=Number(from);ledgerState.nextToBlockInclusive=from===lowerBound?null:Number(from-1n);ledgerState.completeToFactoryDeployment=from===lowerBound&&coverage.factoryDeploymentBlock!==null;const w={recipient:ledgerState.address,fromBlockInclusive:Number(from),toBlockInclusive:Number(to),fromBlockHash:fromBlock.hash,toBlockHash:toBlock.hash,transferEventCount:scan.ledger.length,strictRedemptionCount:scan.redemptions.length,unresolvedPairOutflowCount:scan.unresolved.length};ledgerState.windows=appendWindow(ledgerState.windows,w);coverage.currentRun.recipientLedgerWindows.push(w);}

      const combinedLedger=dedupeBy([...(history.lpTransferEvents||[]),...newLedgerEvents],eventKey).sort((a,b)=>b.blockNumber-a.blockNumber||b.logIndex-a.logIndex);history.lpTransferEvents=combinedLedger.slice(0,MAX_PERSISTED_LEDGER_EVENTS);history.lpTransferEventLedgerTruncated=combinedLedger.length>MAX_PERSISTED_LEDGER_EVENTS;
      const combinedRedemptions=dedupeBy([...(history.strictRedemptions||[]),...newRedemptions],x=>`${normalizeAddress(x.pair)}:${String(x.tx).toLowerCase()}:${x.transferLogIndex}`).sort((a,b)=>b.blockNumber-a.blockNumber||b.transferLogIndex-a.transferLogIndex);history.strictRedemptions=combinedRedemptions.slice(0,MAX_PERSISTED_REDEMPTIONS);history.strictRedemptionLedgerTruncated=combinedRedemptions.length>MAX_PERSISTED_REDEMPTIONS;
      const combinedUnresolved=dedupeBy([...(history.unresolvedPairOutflows||[]),...newUnresolved],x=>`${normalizeAddress(x.pair)}:${String(x.tx).toLowerCase()}:${x.logIndex}`).sort((a,b)=>b.blockNumber-a.blockNumber||b.logIndex-a.logIndex);history.unresolvedPairOutflows=combinedUnresolved.slice(0,MAX_PERSISTED_REDEMPTIONS);history.unresolvedPairOutflowLedgerTruncated=combinedUnresolved.length>MAX_PERSISTED_REDEMPTIONS;

      summary.protocolFeeMintEventCountBackfilled=Number(summary.protocolFeeMintEventCountBackfilled||0)+newProtocolFeeEvents.length;
      summary.protocolFeeMintPairCountBackfilled=history.pairIdsWithProtocolFeeMints.length;
      summary.trackedFeeToRecipientCount=Object.keys(coverage.recipientLedgers||{}).length;
      summary.historicalProtocolFeeRecipientCount=Object.keys(history.recipientStats||{}).length;
      summary.inboundLpTransferEventCountBackfilled=Number(summary.inboundLpTransferEventCountBackfilled||0)+newLedgerEvents.filter(x=>x.direction==='inbound').length;
      summary.outboundLpTransferEventCountBackfilled=Number(summary.outboundLpTransferEventCountBackfilled||0)+newLedgerEvents.filter(x=>x.direction==='outbound').length;
      summary.strictRedemptionCountBackfilled=Number(summary.strictRedemptionCountBackfilled||0)+newRedemptions.length;
      summary.unresolvedPairOutflowCountBackfilled=Number(summary.unresolvedPairOutflowCountBackfilled||0)+newUnresolved.length;

      coverage.allKnownRecipientLedgersCompleteToFactoryDeployment=coverage.factoryDeploymentBlock!==null&&Object.values(coverage.recipientLedgers||{}).length>0&&Object.values(coverage.recipientLedgers||{}).every(x=>x.completeToFactoryDeployment===true);
      const historicalFlowComplete=coverage.discovery.completeToFactoryDeployment===true&&coverage.allKnownRecipientLedgersCompleteToFactoryDeployment===true;
      return {
        version:FRAXSWAP_FEETO_HISTORY_BACKFILL_VERSION,status:'ok',measurementClass:'MEASURED',observedAt:currentBammMeasurement.observedAt,chain:'fraxtal',chainId:FRAXTAL_CHAIN_ID,
        currentCheckpoint:{blockNumber:currentBammMeasurement.blockNumber,blockHash:currentBammMeasurement.blockHash},currentFeeTo,
        coverage,summary,history,
        rpc:{endpointId:endpoint.id,failoverAttempts:attempts},
        provenance:{officialSourceRepository:'FraxFinance/frax-solidity',officialSourceRef:FRAXSWAP_SOURCE_REF,sourceContracts:['FraxswapFactory.sol','FraxswapPair.sol','FraxswapERC20.sol'],protocolFeeMeasurementVersion:protocolFeeMeasurement.version,protocolFeeMeasurementBlockHash:protocolFeeMeasurement.blockHash,protocolFeeMintIdentity:'source-ordered zero-origin LP Transfer(s) immediately preceding FraxswapPair Mint/Burn terminal; on Mint the final zero-origin LP mint is the user mint and earlier nonzero-destination zero-origin LP mints are _mintFee output',feeToIdentityBoundary:'_mintFee mints to factory.feeTo at execution; setFeeTo has no event in pinned factory source, so continuous feeTo state between protocol-fee mint executions is not claimed',strictRedemptionIdentity:'feeTo-recipient -> pair LP Transfer followed in same transaction by exactly one equal pair -> zero LP burn and exactly one Burn terminal event'},
        epistemic:{historicalProtocolFeeMintRecipients:'MEASURED-bounded-source-ordered-event-backfill',historicalFeeToLpTransferFlow:'MEASURED-bounded-recipient-ledger-backfill',historicalFeeToLpRedemptionFlow:summary.unresolvedPairOutflowCountBackfilled===0?'MEASURED-strict-redemptions-or-measured-zero-within-covered-ledgers':'PARTIAL-strict-redemptions-measured-unresolved-pair-outflows-preserved',historicalFlowCompleteness:historicalFlowComplete?'MEASURED-complete-to-factory-deployment':'PARTIAL-contiguous-bounded-backfill-in-progress',continuousFeeToStateHistory:'UNKNOWN-no-setFeeTo-event-and-no-complete-call-trace',historicalFeeToSetterTransitions:'UNKNOWN-no-setFeeTo-event-and-no-complete-call-trace',feeToAtProtocolFeeMintExecution:'DERIVED-MECHANICAL-_mintFee-recipient-equals-factory-feeTo',downstreamRecipientSemantics:'UNKNOWN-address-only-no-economic-role-claim',heterogeneousLpUnitsAggregated:false,lpUnitValuationPerformed:false,protocolRevenueUsdClaim:false,veFraxDistributionClaim:false,companyCashFlowClaim:false,unknownIsZero:false,currentBackfillWindow:'MEASURED',causalClaimAuthority:'none',executionAuthority:'none'}
      };
    }catch(error){attempts.push({endpointId:endpoint.id,error:error instanceof Error?error.message:String(error)});}
  }
  return preserveProgressUnknown({current:currentBammMeasurement,previousProgress:previousBackfillMeasurement,attempts,reason:'UNKNOWN-fraxswap-feeto-history-read-failed'});
}

export function applyFraxswapFeeToHistoryBackfill({state,previousState,measurement}){
  if(!state||typeof state!=='object')throw new Error('Fraxswap feeTo history adapter requires Economic Graph state');
  if(state?.authority?.executionAuthority!=='none'||state?.authority?.causalClaimAuthority!=='none')throw new Error('Fraxswap feeTo history adapter refuses Graph authority drift');
  const evidence=state?.protocolEvidence?.[FRAX_ECOSYSTEM_EVIDENCE_ID],base=evidence?.latest?.observation,fraxSensor=state?.protocolSensors?.[FRAX_PROTOCOL_ID];if(!evidence||!base||!fraxSensor)throw new Error('Frax ecosystem evidence missing before feeTo history enrichment');
  const current=structuredClone(base),fraxswap=current?.surfaces?.fraxswapBamm,revenue=current?.surfaces?.revenueRouting;if(!fraxswap||!revenue)throw new Error('Fraxswap or revenue-routing surface missing');
  const progress=isProgressMeasurement(measurement),attached=measurement;
  fraxswap.measured={...(fraxswap.measured||{}),feeToHistoricalBackfill:attached};
  revenue.measured={...(revenue.measured||{}),fraxswapFeeToHistoricalBackfill:attached};
  current.measurementExtensions={...(current.measurementExtensions||{}),fraxswapFeeToHistoricalBackfill:FRAXSWAP_FEETO_HISTORY_BACKFILL_VERSION};
  current.epistemic={...(current.epistemic||{}),fraxswapHistoricalProtocolFeeMintRecipients:progress?measurement.epistemic?.historicalProtocolFeeMintRecipients||'UNKNOWN':'UNKNOWN',fraxswapHistoricalFeeToLpTransferFlow:progress?measurement.epistemic?.historicalFeeToLpTransferFlow||'UNKNOWN':'UNKNOWN',fraxswapHistoricalFeeToLpRedemptionFlow:progress?measurement.epistemic?.historicalFeeToLpRedemptionFlow||'UNKNOWN':'UNKNOWN',fraxswapHistoricalFlowCompleteness:progress?measurement.epistemic?.historicalFlowCompleteness||'UNKNOWN':'UNKNOWN',fraxswapContinuousFeeToStateHistory:'UNKNOWN',fraxswapHistoricalFeeToSetterTransitions:'UNKNOWN',fraxswapDownstreamRecipientSemantics:'UNKNOWN'};
  if(!revenue.mechanicalRelations.some(r=>r?.from==='historical Fraxswap _mintFee execution'))revenue.mechanicalRelations.push(
    {from:'historical Fraxswap _mintFee execution',to:'exact LP recipient = feeTo at protocol-fee mint execution',class:progress?'MECHANICAL-source-ordered-event-identity':'UNKNOWN'},
    {from:'historical feeTo-recipient LP transfer ledger',to:'pair-local historical holdings/outflow evidence',class:progress?'MEASURED-bounded-backfill':'UNKNOWN'},
    {from:'historical feeTo-recipient -> pair LP transfer + equal pair LP burn',to:'Burn underlying recipient + token amounts',class:progress?'MECHANICAL-strict-redemption-identity':'UNKNOWN'}
  );
  const surfaces=Object.values(current.surfaces||{}),measured=surfaces.filter(s=>String(s.measurementState||'').startsWith('MEASURED'));current.coverage.measuredSurfaceCount=measured.length;current.coverage.sourceBoundUnknownSurfaceCount=surfaces.length-measured.length;current.relationshipGraph=surfaces.flatMap(s=>s.mechanicalRelations.map((r,index)=>({surfaceId:s.id,index,...r})));current.coverage.relationshipCount=current.relationshipGraph.length;current.coverage.relationshipClassCounts=current.relationshipGraph.reduce((a,r)=>{const k=String(r.class||'UNKNOWN').split('-')[0];a[k]=(a[k]||0)+1;return a;},{});
  current.id=`frax-ecosystem:${sha256(stableStringify({priorId:base.id,feeToHistory:progress?{anchorBlockInclusive:measurement.coverage.anchorBlockInclusive,factoryDeploymentBlock:measurement.coverage.factoryDeploymentBlock,discovery:measurement.coverage.discovery,recipientLedgers:Object.values(measurement.coverage.recipientLedgers||{}).map(x=>[x.address,x.coveredFromBlockInclusive,x.coveredToBlockInclusive,x.nextToBlockInclusive,x.completeToFactoryDeployment]),summary:measurement.summary}:{status:measurement?.status||'UNKNOWN'},surfaceIds:current.coverage.surfaceIds})).slice(0,24)}`;
  const prevRows=Array.isArray(previousState?.protocolEvidence?.[FRAX_ECOSYSTEM_EVIDENCE_ID]?.observations)?previousState.protocolEvidence[FRAX_ECOSYSTEM_EVIDENCE_ID].observations:[];const rows=[...prevRows];if(!rows.some(r=>r?.id===current.id))rows.push(current);evidence.latest={observation:current};evidence.status=current.status;evidence.observations=rows.slice(-MAX_OBSERVATIONS);evidence.observationCount=evidence.observations.length;evidence.measurementExtensions={...(evidence.measurementExtensions||{}),fraxswapFeeToHistoricalBackfill:FRAXSWAP_FEETO_HISTORY_BACKFILL_VERSION};
  fraxSensor.ecosystemFamily={...(fraxSensor.ecosystemFamily||{}),status:current.status,measuredSurfaceCount:current.coverage.measuredSurfaceCount,sourceBoundUnknownSurfaceCount:current.coverage.sourceBoundUnknownSurfaceCount,latestObservationId:current.id,measurementExtensions:{...(fraxSensor.ecosystemFamily?.measurementExtensions||{}),fraxswapFeeToHistoricalBackfill:FRAXSWAP_FEETO_HISTORY_BACKFILL_VERSION}};if(fraxSensor?.latest?.observation)fraxSensor.latest.observation.ecosystemFamily=fraxSensor.ecosystemFamily;
  if(current.coverage.measuredSurfaceCount+current.coverage.sourceBoundUnknownSurfaceCount!==current.coverage.surfaceCount)throw new Error('Frax feeTo history depth accounting drift');
  if(revenue.measurementState.startsWith('MEASURED'))throw new Error('Revenue-routing surface over-promoted by historical feeTo evidence');
  if(progress&&measurement.epistemic?.continuousFeeToStateHistory!=='UNKNOWN-no-setFeeTo-event-and-no-complete-call-trace')throw new Error('Historical feeTo continuity over-claimed');
  if(current?.authority?.executionAuthority!=='none'||current?.epistemic?.executionAuthority!=='none'||measurement?.epistemic?.executionAuthority!=='none')throw new Error('Fraxswap feeTo history execution authority leaked');
  return state;
}
