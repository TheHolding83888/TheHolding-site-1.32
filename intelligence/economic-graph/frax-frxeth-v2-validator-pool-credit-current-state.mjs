#!/usr/bin/env node
/**
 * The Holding · Frax frxETH V2 ValidatorPool credit exact-block state v0.1.6
 *
 * ValidatorPool identity comes from the source-bound LendingPool VPoolDeployed
 * event. Current pool truth remains exact-block RPC. Deep event discovery is a
 * separate bounded transport lane: the current-state RPC is attempted first,
 * then discovery-only public archive endpoints, then remaining canonical RPC
 * failovers. Every discovered pool is re-proven at the canonical current block
 * through the current-state endpoint before it can become MEASURED.
 *
 * Timeout recovery uses adaptive bisection rather than fixed 20k fan-out. Once
 * a history provider times out, subsequent subrange requests are paced so a
 * successful sparse-history bootstrap does not immediately turn into a public
 * provider rate-limit burst. Current-state RPC behavior is unchanged.
 *
 * When history transport is unavailable, compact per-endpoint classifications
 * are preserved in UNKNOWN telemetry and status so production can distinguish
 * provider denial, timeout, range limits and malformed RPC responses without
 * weakening current-state authority.
 *
 * Validator performance, staking rewards and protocol revenue are deliberately
 * not inferred from pool balances or credit accounting.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const FRAX_FRXETH_V2_VALIDATOR_POOL_CREDIT_VERSION='0.1.6-frxeth-v2-validator-pool-credit-rate-aware-history-bootstrap-exact-block';
export const FRAX_ECOSYSTEM_EVIDENCE_ID='registry-frax-ecosystem';
export const FRAX_PROTOCOL_ID='registry-frax-vefrax';
export const FRAX_FRXETH_SURFACE_KEY='frxEthSfrxEth';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const REGISTRY_FILE=path.join(ROOT,'intelligence/economic-graph/frax-frxeth-registry.json');
const RPC_REGISTRY_FILE=path.join(ROOT,'intelligence/market-data/onchain-price-source-registry.json');
const HISTORY_RPC_REGISTRY_FILE=path.join(ROOT,'intelligence/economic-graph/frax-frxeth-validator-pool-history-rpc.json');
const RPC_TIMEOUT_MS=12_000;
const MAX_BATCH_CALLS=32;
const MAX_LOG_REQUESTS=2_000;
const HISTORY_TIMEOUT_CHUNK_BLOCKS=20_000n;
const HISTORY_PACED_INTERVAL_MS=275;
const MAX_POOLS=200;
const MAX_OBSERVATIONS=1000;
const EXPECTED_SOURCE_COMMIT='83dfe93b4a32b9ca0ab93d6e7c059fcd977320d4';
const EXPECTED_HISTORY_REGISTRY_VERSION='0.1-frxeth-validator-pool-history-rpc';
const LENDING_POOL_DEPLOYMENT_BLOCK=21_404_234n;
const EXPECTED_VPOOL_DEPLOYED_TOPIC='0x2d81fbec11dcf80f26bdc0b2eb671b417a7bf920ac5545fe3ae32639f2395af8';

function sha256(value){return crypto.createHash('sha256').update(value).digest('hex');}
function stableValue(value){if(Array.isArray(value))return value.map(stableValue);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,stableValue(value[key])]));return value;}
function stableStringify(value){return JSON.stringify(stableValue(value));}
function readJson(file){return JSON.parse(fs.readFileSync(file,'utf8'));}
function normalize(value){return String(value||'').toLowerCase();}
function sameAddress(a,b){return normalize(a)===normalize(b);}
function validAddress(value){return /^0x[0-9a-fA-F]{40}$/.test(String(value||''));}
function asciiHex(value){return `0x${Buffer.from(value,'utf8').toString('hex')}`;}
function hexQuantity(value){return `0x${BigInt(value).toString(16)}`;}
function cleanHex(hex){const clean=String(hex||'').replace(/^0x/,'');if(!/^[0-9a-f]*$/i.test(clean)||clean.length%64!==0)throw new Error('Invalid ABI payload');return clean;}
function decodeWord(hex,index=0){const clean=cleanHex(hex),start=index*64;if(clean.length<start+64)throw new Error(`Invalid ABI word ${index}`);return BigInt(`0x${clean.slice(start,start+64)}`);}
function decodeAddress(hex,index=0){const word=decodeWord(hex,index).toString(16).padStart(64,'0');return `0x${word.slice(24)}`;}
function decodeQuantity(hex){if(!/^0x[0-9a-f]+$/i.test(String(hex||'')))throw new Error('Invalid RPC quantity');return BigInt(hex);}
function addressWord(address){if(!validAddress(address))throw new Error('Invalid ABI address');return normalize(address).replace(/^0x/,'').padStart(64,'0');}
function boolWord(value){return value?'1'.padStart(64,'0'):'0'.repeat(64);}
function uintWord(value){return BigInt(value).toString(16).padStart(64,'0');}
function callData(selector,...words){return `${selector}${words.join('')}`;}
function units(raw,decimals=18){const sign=raw<0n?'-':'';const abs=raw<0n?-raw:raw,base=10n**BigInt(decimals),whole=abs/base,fraction=(abs%base).toString().padStart(decimals,'0').replace(/0+$/,'');return Number(`${sign}${whole}${fraction?'.'+fraction:''}`);}
function round(value,digits=12){const n=Number(value);return Number.isFinite(n)?Number(n.toFixed(digits)):null;}
function safeInt(value,label){const n=Number(value);if(!Number.isSafeInteger(n))throw new Error(`${label} outside safe integer range`);return n;}
function sleep(ms){return new Promise(resolve=>setTimeout(resolve,ms));}

export function validateFraxFrxEthValidatorPoolRegistry(registry){
  if(registry?.version!=='0.1-frxeth-current-state-registry'||registry?.network!=='ethereum'||Number(registry?.chainId)!==1)throw new Error('frxETH ValidatorPool registry identity drift');
  if(!validAddress(registry?.operations?.lendingPool))throw new Error('frxETH ValidatorPool LendingPool address invalid');
  if(registry?.sources?.officialSourceRepo!=='FraxFinance/frxETH-v2-public'||registry?.sources?.officialSourceCommit!==EXPECTED_SOURCE_COMMIT)throw new Error('frxETH ValidatorPool official source pin drift');
  if(registry?.epistemic?.unknownIsZero!==false||registry?.epistemic?.executionAuthority!=='none'||registry?.epistemic?.causalClaimAuthority!=='none')throw new Error('frxETH ValidatorPool epistemic boundary drift');
  return registry;
}

export function validateFraxFrxEthValidatorPoolHistoryRpcRegistry(registry){
  if(registry?.version!==EXPECTED_HISTORY_REGISTRY_VERSION||registry?.network!=='ethereum'||Number(registry?.chainId)!==1)throw new Error('ValidatorPool history RPC registry identity drift');
  if(!Array.isArray(registry?.endpoints)||registry.endpoints.length<1)throw new Error('ValidatorPool history RPC endpoints unavailable');
  for(const endpoint of registry.endpoints){if(!endpoint?.id||!/^https:\/\//.test(String(endpoint?.url||''))||endpoint?.authority!=='discovery-only')throw new Error('ValidatorPool history RPC endpoint boundary drift');}
  const s=registry?.semantics||{};
  if(s.eventHistoryDiscoveryOnly!==true||s.currentStateAuthority!==false||s.priceAuthority!==false||s.candidateIdentityRequiresExactBlockReproof!==true||s.completeHistoryRequiredForMeasuredRegistry!==true||s.unknownIsNotZero!==true||s.executionAuthority!=='none')throw new Error('ValidatorPool history RPC semantics drift');
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
async function postSingle(url,req,fetchImpl){
  const response=await fetchImpl(url,{method:'POST',headers:{'content-type':'application/json',accept:'application/json'},body:JSON.stringify(req),signal:AbortSignal.timeout(RPC_TIMEOUT_MS)});
  if(!response.ok)throw new Error(`RPC HTTP ${response.status}`);
  let row=await response.json();if(Array.isArray(row))row=row[0];
  if(!row||Number(row?.id)!==Number(req.id))throw new Error(`RPC result ${req.id} missing`);
  if(row.error)throw new Error(`RPC ${req.method} error: ${row.error?.message||'unknown error'}`);
  if(row.result===undefined||row.result===null)throw new Error(`RPC ${req.method} result missing`);
  return row;
}
async function batched(url,payload,fetchImpl){const out=new Map();for(let i=0;i<payload.length;i+=MAX_BATCH_CALLS){const rows=await postBatch(url,payload.slice(i,i+MAX_BATCH_CALLS),fetchImpl);for(const [key,row] of rows)out.set(key,row);}return out;}
function call(id,to,data,blockTag){return {jsonrpc:'2.0',id,method:'eth_call',params:[{to,data},blockTag]};}
function isAdaptiveLogRangeError(error){const text=String(error instanceof Error?error.message:error).toLowerCase();return /block.?range|range too|range limit|query returned more|too many results|response size|result size|max(imum)?.?range|limit exceeded/.test(text);}
function isHistoryTimeout(error){const text=String(error instanceof Error?error.message:error).toLowerCase();return /abort|timeout|timed out|signal/.test(text);}
function classifyHistoryError(error){
  const text=String(error instanceof Error?error.message:error).toLowerCase();
  const http=text.match(/rpc http (\d{3})/);if(http)return `HTTP${http[1]}`;
  if(isHistoryTimeout(error))return 'TIMEOUT';
  if(/enotfound|eai_again|dns|resolve/.test(text))return 'DNS';
  if(isAdaptiveLogRangeError(error))return 'RANGE_LIMIT';
  if(/json|unexpected token|response is not/.test(text))return 'MALFORMED_RESPONSE';
  if(/rpc eth_getlogs error/.test(text))return 'RPC_ERROR';
  return 'OTHER';
}

async function collectLogsProviderResilient(url,{address,topic,fromBlock,toBlock,fetchImpl}){
  const logs=[];const telemetry={providerTransport:'single-request-full-range-first',initialSpanBlocks:Number(toBlock-fromBlock+1n),requestCount:0,adaptiveSplitCount:0,timeoutObservedCount:0,timeoutChunkFallbackCount:0,timeoutChunkBlocks:Number(HISTORY_TIMEOUT_CHUNK_BLOCKS),timeoutBisectionCount:0,pacingActivated:false,pacedRequestCount:0,minRequestIntervalMs:HISTORY_PACED_INTERVAL_MS,smallestSuccessfulSpanBlocks:null};
  let requestId=700_000,pacingActive=false,lastRequestStartedAt=0;
  async function paceIfNeeded(){
    if(!pacingActive)return;
    const wait=Math.max(0,HISTORY_PACED_INTERVAL_MS-(Date.now()-lastRequestStartedAt));
    if(wait>0)await sleep(wait);
    telemetry.pacedRequestCount++;
  }
  async function scan(from,to){
    if(telemetry.requestCount>=MAX_LOG_REQUESTS)throw new Error(`eth_getLogs request cap ${MAX_LOG_REQUESTS} exceeded`);
    await paceIfNeeded();
    telemetry.requestCount++;lastRequestStartedAt=Date.now();
    const req={jsonrpc:'2.0',id:requestId++,method:'eth_getLogs',params:[{address,fromBlock:hexQuantity(from),toBlock:hexQuantity(to),topics:[topic]}]};
    try{
      const row=await postSingle(url,req,fetchImpl),rows=row.result;
      if(!Array.isArray(rows))throw new Error('VPoolDeployed logs result is not array');
      const span=Number(to-from+1n);telemetry.smallestSuccessfulSpanBlocks=telemetry.smallestSuccessfulSpanBlocks===null?span:Math.min(telemetry.smallestSuccessfulSpanBlocks,span);logs.push(...rows);return;
    }catch(error){
      if(from>=to)throw error;
      if(isHistoryTimeout(error)){
        telemetry.timeoutObservedCount++;
        pacingActive=true;telemetry.pacingActivated=true;
        telemetry.adaptiveSplitCount++;telemetry.timeoutChunkFallbackCount++;telemetry.timeoutBisectionCount++;
        const mid=(from+to)>>1n;await scan(from,mid);await scan(mid+1n,to);return;
      }
      if(!isAdaptiveLogRangeError(error))throw error;
      telemetry.adaptiveSplitCount++;
      const mid=(from+to)>>1n;await scan(from,mid);await scan(mid+1n,to);
    }
  }
  await scan(fromBlock,toBlock);return {logs,telemetry};
}

function historyCandidates({primaryEndpoint,currentEndpoints,historyRegistry}){
  const rows=[
    {...primaryEndpoint,historyRole:'current-state-primary-history-attempt'},
    ...historyRegistry.endpoints.map(endpoint=>({...endpoint,historyRole:'dedicated-history-rpc'})),
    ...currentEndpoints.filter(endpoint=>endpoint?.url!==primaryEndpoint?.url).map(endpoint=>({...endpoint,historyRole:'current-rpc-history-last-resort'}))
  ];
  const seen=new Set();return rows.filter(endpoint=>{const url=String(endpoint?.url||'');if(!url||seen.has(url))return false;seen.add(url);return true;});
}

async function collectLogsHistoryFailover(candidates,args){
  const attempts=[];
  for(const endpoint of candidates){
    try{
      const result=await collectLogsProviderResilient(endpoint.url,args);
      return {logs:result.logs,telemetry:{transport:'public-history-rpc-failover',endpointId:endpoint.id||null,endpointRole:endpoint.historyRole||null,failoverAttempts:attempts,...result.telemetry}};
    }catch(error){attempts.push({endpointId:endpoint?.id||null,endpointRole:endpoint?.historyRole||null,classification:classifyHistoryError(error),error:String(error instanceof Error?error.message:error).slice(0,220)});}
  }
  const compact=attempts.map(row=>`${row.endpointId||'unknown'}:${row.classification}`).join(',');
  const failure=new Error(`HISTORY_FAILOVER[${compact}]`);failure.code='VPOOL_HISTORY_UNAVAILABLE';failure.historyFailoverAttempts=attempts;throw failure;
}

function normalizedPrevious(previous,lendingPool,currentBlock){
  if(previous?.status!=='ok'||previous?.measurementClass!=='MEASURED'||!sameAddress(previous?.lendingPool?.address,lendingPool)||!Array.isArray(previous?.validatorPools)||!previous?.coverage?.completeVPoolDeployedHistory)return null;
  const block=BigInt(previous.blockNumber||0);if(block<LENDING_POOL_DEPLOYMENT_BLOCK||block>currentBlock)return null;
  const rows=[];const seen=new Set();
  for(const item of previous.validatorPools){if(!validAddress(item?.address)||!validAddress(item?.deploymentOwner)||seen.has(normalize(item.address)))return null;seen.add(normalize(item.address));rows.push({address:item.address,deploymentOwner:item.deploymentOwner,deploymentBlock:Number(item.deploymentBlock),deploymentTxHash:item.deploymentTxHash||null});}
  return {block,rows};
}

function unknownMeasurement(source,reason,attempts=[],historyFailoverAttempts=[]){
  return {
    version:FRAX_FRXETH_V2_VALIDATOR_POOL_CREDIT_VERSION,status:reason,measurementClass:'UNKNOWN',observedAt:null,network:'ethereum',chainId:1,blockNumber:null,blockTag:null,blockHash:null,
    lendingPool:{address:source?.operations?.lendingPool||null,deployedCodePresent:null,constants:null},coverage:{completeVPoolDeployedHistory:false,discoveryStartBlock:Number(LENDING_POOL_DEPLOYMENT_BLOCK),deployedPoolCount:null,initializedPoolCount:null},validatorPools:[],summary:null,
    rpc:{endpointId:null,failoverAttempts:attempts,historyFailoverAttempts,reusedCheckpoint:false,incrementalDiscovery:false,logDiscovery:null},
    epistemic:{sourceType:'onchain-public-rpc-exact-block-plus-bounded-public-history-rpc',validatorPoolRegistry:'UNKNOWN',creditAccounting:'UNKNOWN',borrowAccounting:'UNKNOWN',borrowAllowance:'UNKNOWN',solvency:'UNKNOWN',validatorPerformance:'UNKNOWN',stakingRewards:'UNKNOWN',protocolRevenue:'UNKNOWN',companyCashFlow:'UNKNOWN',unknownIsZero:false,causalClaimAuthority:'none',executionAuthority:'none'}
  };
}

export async function collectFraxFrxEthV2ValidatorPoolCreditCurrentState({registry=null,rpcRegistry=null,historyRpcRegistry=null,fetchImpl=fetch,checkpoint=null,previousMeasurement=null}={}){
  const source=validateFraxFrxEthValidatorPoolRegistry(registry||readJson(REGISTRY_FILE));
  const rpc=rpcRegistry||readJson(RPC_REGISTRY_FILE),network=rpc?.networks?.ethereum,endpoints=Array.isArray(network?.rpcFailover)?network.rpcFailover:[],attempts=[],historyFailoverAttempts=[];
  const history=validateFraxFrxEthValidatorPoolHistoryRpcRegistry(historyRpcRegistry||readJson(HISTORY_RPC_REGISTRY_FILE));
  if(Number(network?.chainId)!==1||!endpoints.length)throw new Error('Ethereum RPC registry unavailable');
  const lendingPool=source.operations.lendingPool;

  for(const endpoint of endpoints){
    try{
      let blockTag=checkpoint?.blockTag||null;
      if(!blockTag){const head=await postBatch(endpoint.url,[{jsonrpc:'2.0',id:1,method:'eth_blockNumber',params:[]}],fetchImpl);blockTag=head.get(1).result;}
      if(!/^0x[0-9a-f]+$/i.test(String(blockTag)))throw new Error('Invalid exact block tag');
      const currentBlock=decodeQuantity(blockTag);if(currentBlock<LENDING_POOL_DEPLOYMENT_BLOCK)throw new Error('Checkpoint predates source-bound LendingPool deployment');

      const signatures=await postBatch(endpoint.url,[
        {jsonrpc:'2.0',id:2,method:'eth_getBlockByNumber',params:[blockTag,false]},
        {jsonrpc:'2.0',id:3,method:'eth_getCode',params:[lendingPool,blockTag]},
        {jsonrpc:'2.0',id:10,method:'web3_sha3',params:[asciiHex('VPoolDeployed(address,address)')]},
        {jsonrpc:'2.0',id:11,method:'web3_sha3',params:[asciiHex('validatorPoolAccounts(address)')]},
        {jsonrpc:'2.0',id:12,method:'web3_sha3',params:[asciiHex('wouldBeSolvent(address,bool,uint256,uint256)')]},
        {jsonrpc:'2.0',id:13,method:'web3_sha3',params:[asciiHex('owner()')]},
        {jsonrpc:'2.0',id:14,method:'web3_sha3',params:[asciiHex('lendingPool()')]},
        {jsonrpc:'2.0',id:15,method:'web3_sha3',params:[asciiHex('getAmountBorrowed()')]},
        {jsonrpc:'2.0',id:16,method:'web3_sha3',params:[asciiHex('getAmountAndSharesBorrowedStored()')]},
        {jsonrpc:'2.0',id:17,method:'web3_sha3',params:[asciiHex('DEFAULT_CREDIT_PER_VALIDATOR_I48_E12()')]},
        {jsonrpc:'2.0',id:18,method:'web3_sha3',params:[asciiHex('MAXIMUM_CREDIT_PER_VALIDATOR_I48_E12()')]},
        {jsonrpc:'2.0',id:19,method:'web3_sha3',params:[asciiHex('MISSING_CREDPERVAL_MULT()')]}
      ],fetchImpl);
      const block=signatures.get(2).result,blockNumber=Number(decodeQuantity(block?.number||blockTag)),timestampSeconds=Number(decodeQuantity(block?.timestamp));
      if(!(blockNumber>0)||!(timestampSeconds>0)||!/^0x[0-9a-f]{64}$/i.test(String(block?.hash||'')))throw new Error('Exact block identity unavailable');
      const lendingPoolCode=String(signatures.get(3).result||'');if(!/^0x[0-9a-f]+$/i.test(lendingPoolCode)||lendingPoolCode==='0x'||lendingPoolCode==='0x0')throw new Error('LendingPool deployed code missing');
      const hash=(id)=>String(signatures.get(id).result||''),selector=(id)=>hash(id).slice(0,10),vPoolTopic=hash(10).toLowerCase();
      if(vPoolTopic!==EXPECTED_VPOOL_DEPLOYED_TOPIC)throw new Error('VPoolDeployed topic drift');for(let id=11;id<=19;id++)if(!/^0x[0-9a-f]{64}$/i.test(hash(id)))throw new Error(`Signature hash ${id} invalid`);

      const previous=normalizedPrevious(previousMeasurement,lendingPool,currentBlock),discovered=new Map();if(previous)for(const item of previous.rows)discovered.set(normalize(item.address),item);
      const scanStart=previous?previous.block+1n:LENDING_POOL_DEPLOYMENT_BLOCK;
      let logDiscovery={transport:'public-history-rpc-failover',endpointId:null,endpointRole:null,failoverAttempts:[],providerTransport:'not-needed-no-new-blocks',initialSpanBlocks:0,requestCount:0,adaptiveSplitCount:0,timeoutObservedCount:0,timeoutChunkFallbackCount:0,timeoutChunkBlocks:Number(HISTORY_TIMEOUT_CHUNK_BLOCKS),timeoutBisectionCount:0,pacingActivated:false,pacedRequestCount:0,minRequestIntervalMs:HISTORY_PACED_INTERVAL_MS,smallestSuccessfulSpanBlocks:null};
      if(scanStart<=currentBlock){
        const discovery=await collectLogsHistoryFailover(historyCandidates({primaryEndpoint:endpoint,currentEndpoints:endpoints,historyRegistry:history}),{address:lendingPool,topic:vPoolTopic,fromBlock:scanStart,toBlock:currentBlock,fetchImpl});logDiscovery=discovery.telemetry;
        for(const log of discovery.logs){
          if(!sameAddress(log?.address,lendingPool)||String(log?.topics?.[0]||'').toLowerCase()!==vPoolTopic)throw new Error('VPoolDeployed log identity mismatch');
          if(cleanHex(log.data).length!==128)throw new Error('VPoolDeployed event ABI shape drift');
          const deploymentOwner=decodeAddress(log.data,0),address=decodeAddress(log.data,1),deploymentBlock=safeInt(decodeQuantity(log.blockNumber),'deployment block');
          if(!validAddress(deploymentOwner)||!validAddress(address)||deploymentBlock<Number(LENDING_POOL_DEPLOYMENT_BLOCK)||deploymentBlock>blockNumber)throw new Error('VPoolDeployed decoded identity invalid');
          const key=normalize(address);if(discovered.has(key))throw new Error(`Duplicate VPoolDeployed identity ${address}`);discovered.set(key,{address,deploymentOwner,deploymentBlock,deploymentTxHash:String(log.transactionHash||'')||null});
        }
      }
      const deploymentRows=[...discovered.values()].sort((a,b)=>a.deploymentBlock-b.deploymentBlock||normalize(a.address).localeCompare(normalize(b.address)));if(deploymentRows.length>MAX_POOLS)throw new Error(`ValidatorPool count exceeds bounded cap ${MAX_POOLS}`);

      let nextId=1000;const accountSelector=selector(11),solvencySelector=selector(12),ownerSelector=selector(13),poolLpSelector=selector(14),liveBorrowSelector=selector(15),storedBorrowSelector=selector(16);
      const globalCalls=[call(nextId++,lendingPool,selector(17),blockTag),call(nextId++,lendingPool,selector(18),blockTag),call(nextId++,lendingPool,selector(19),blockTag)],globalIds=globalCalls.map(row=>row.id),poolCalls=[],poolIds=[];
      for(const row of deploymentRows){const ids={row,code:nextId++,balance:nextId++,account:nextId++,solvency:nextId++,owner:nextId++,lendingPool:nextId++,liveBorrow:nextId++,storedBorrow:nextId++};poolCalls.push({jsonrpc:'2.0',id:ids.code,method:'eth_getCode',params:[row.address,blockTag]},{jsonrpc:'2.0',id:ids.balance,method:'eth_getBalance',params:[row.address,blockTag]},call(ids.account,lendingPool,callData(accountSelector,addressWord(row.address)),blockTag),call(ids.solvency,lendingPool,callData(solvencySelector,addressWord(row.address),boolWord(true),uintWord(0),uintWord(0)),blockTag),call(ids.owner,row.address,ownerSelector,blockTag),call(ids.lendingPool,row.address,poolLpSelector,blockTag),call(ids.liveBorrow,row.address,liveBorrowSelector,blockTag),call(ids.storedBorrow,row.address,storedBorrowSelector,blockTag));poolIds.push(ids);}
      const callResults=await batched(endpoint.url,[...globalCalls,...poolCalls],fetchImpl),defaultCredit=decodeWord(callResults.get(globalIds[0]).result),maximumCredit=decodeWord(callResults.get(globalIds[1]).result),creditMultiplier=decodeWord(callResults.get(globalIds[2]).result);
      if(defaultCredit!==24_000_000_000_000n||maximumCredit!==31_000_000_000_000n||creditMultiplier!==1_000_000n)throw new Error('ValidatorPool source/live credit constants drift');

      const validatorPools=[];let initializedPoolCount=0,totalValidatorCount=0,totalCredit=0n,totalBorrowed=0n,totalBorrowAllowance=0n,totalNativeBalance=0n,activeBorrowingPoolCount=0,insolventPoolCount=0,liquidatedPoolCount=0;const ownerSet=new Set();
      for(const ids of poolIds){
        const code=String(callResults.get(ids.code).result||'');if(!/^0x[0-9a-f]+$/i.test(code)||code==='0x'||code==='0x0')throw new Error(`ValidatorPool deployed code missing ${ids.row.address}`);
        const nativeBalance=decodeQuantity(callResults.get(ids.balance).result),account=callResults.get(ids.account).result;if(cleanHex(account).length<7*64)throw new Error('validatorPoolAccounts ABI shape drift');
        const isInitialized=decodeWord(account,0)!==0n,wasLiquidated=decodeWord(account,1)!==0n,lastWithdrawal=decodeWord(account,2),validatorCount=decodeWord(account,3),creditPerValidator=decodeWord(account,4),borrowAllowance=decodeWord(account,5),borrowShares=decodeWord(account,6);
        const solvency=callResults.get(ids.solvency).result;if(cleanHex(solvency).length<3*64)throw new Error('wouldBeSolvent ABI shape drift');const isSolvent=decodeWord(solvency,0)!==0n,borrowAmount=decodeWord(solvency,1),creditAmount=decodeWord(solvency,2);
        const currentOwner=decodeAddress(callResults.get(ids.owner).result),currentLendingPool=decodeAddress(callResults.get(ids.lendingPool).result),liveBorrow=decodeWord(callResults.get(ids.liveBorrow).result),storedBorrow=callResults.get(ids.storedBorrow).result;if(cleanHex(storedBorrow).length<2*64)throw new Error('stored borrow ABI shape drift');const storedBorrowAmount=decodeWord(storedBorrow,0),storedBorrowShares=decodeWord(storedBorrow,1);
        if(!isInitialized)throw new Error(`VPoolDeployed pool not initialized ${ids.row.address}`);if(!sameAddress(currentLendingPool,lendingPool))throw new Error(`ValidatorPool LendingPool pointer drift ${ids.row.address}`);
        const expectedCredit=creditPerValidator*creditMultiplier*validatorCount;if(expectedCredit!==creditAmount)throw new Error(`ValidatorPool credit arithmetic drift ${ids.row.address}`);const expectedSolvent=(creditAmount>=borrowAmount)&&!wasLiquidated;if(expectedSolvent!==isSolvent)throw new Error(`ValidatorPool solvency arithmetic drift ${ids.row.address}`);
        if(liveBorrow!==borrowAmount)throw new Error(`ValidatorPool live borrow parity drift ${ids.row.address}`);if(storedBorrowShares!==borrowShares)throw new Error(`ValidatorPool stored borrow-share parity drift ${ids.row.address}`);if(creditPerValidator>maximumCredit)throw new Error(`ValidatorPool credit-per-validator exceeds source maximum ${ids.row.address}`);
        const headroom=creditAmount>=borrowAmount?creditAmount-borrowAmount:0n,creditUtilizationPct=creditAmount>0n?round(Number(borrowAmount)*100/Number(creditAmount),8):null;
        validatorPools.push({...ids.row,currentOwner,lendingPool:currentLendingPool,deployedCodePresent:true,nativeEthBalance:{raw:nativeBalance.toString(),eth:round(units(nativeBalance))},account:{isInitialized,wasLiquidated,lastWithdrawalTimestamp:safeInt(lastWithdrawal,'last withdrawal'),validatorCount:safeInt(validatorCount,'validator count'),creditPerValidatorRawI48E12:creditPerValidator.toString(),creditPerValidatorEth:round(Number(creditPerValidator)/1e12),borrowAllowanceRaw:borrowAllowance.toString(),borrowAllowanceEth:round(units(borrowAllowance)),borrowSharesRaw:borrowShares.toString()},solvency:{isSolvent,borrowAmountRaw:borrowAmount.toString(),borrowAmountEth:round(units(borrowAmount)),creditAmountRaw:creditAmount.toString(),creditAmountEth:round(units(creditAmount)),creditHeadroomRaw:headroom.toString(),creditHeadroomEth:round(units(headroom)),creditUtilizationPct,mechanicalParity:true},borrowParity:{liveBorrowRaw:liveBorrow.toString(),liveBorrowEth:round(units(liveBorrow)),storedBorrowAmountRaw:storedBorrowAmount.toString(),storedBorrowAmountEth:round(units(storedBorrowAmount)),storedBorrowSharesRaw:storedBorrowShares.toString(),liveWouldBeSolventBorrowParity:true,storedBorrowShareParity:true}});
        initializedPoolCount++;totalValidatorCount+=safeInt(validatorCount,'validator count');totalCredit+=creditAmount;totalBorrowed+=borrowAmount;totalBorrowAllowance+=borrowAllowance;totalNativeBalance+=nativeBalance;if(borrowAmount>0n)activeBorrowingPoolCount++;if(!isSolvent)insolventPoolCount++;if(wasLiquidated)liquidatedPoolCount++;ownerSet.add(normalize(currentOwner));
      }

      return {
        version:FRAX_FRXETH_V2_VALIDATOR_POOL_CREDIT_VERSION,status:'ok',measurementClass:'MEASURED',observedAt:new Date(timestampSeconds*1000).toISOString(),network:'ethereum',chainId:1,blockNumber,blockTag,blockHash:block.hash,sourceRegistryVersion:source.version,historyRpcRegistryVersion:history.version,
        sourceBinding:{officialSourceRepo:source.sources.officialSourceRepo,officialSourceCommit:source.sources.officialSourceCommit,lendingPoolSource:'src/contracts/lending-pool/LendingPool.sol',lendingPoolCoreSource:'src/contracts/lending-pool/LendingPoolCore.sol',validatorPoolSource:'src/contracts/ValidatorPool.sol',deploymentEvent:'VPoolDeployed(address,address)',discoveryStartBlock:Number(LENDING_POOL_DEPLOYMENT_BLOCK),discoveryStartRole:'conservative LendingPool deployment bound',discoveryTransportAuthority:'event-history-discovery-only; every candidate is re-proven by current exact-block RPC'},
        lendingPool:{address:lendingPool,deployedCodePresent:true,constants:{defaultCreditPerValidatorRawI48E12:defaultCredit.toString(),defaultCreditPerValidatorEth:round(Number(defaultCredit)/1e12),maximumCreditPerValidatorRawI48E12:maximumCredit.toString(),maximumCreditPerValidatorEth:round(Number(maximumCredit)/1e12),missingCreditPerValidatorMultiplierRaw:creditMultiplier.toString()}},
        coverage:{completeVPoolDeployedHistory:true,discoveryStartBlock:Number(LENDING_POOL_DEPLOYMENT_BLOCK),discoveryEndBlock:blockNumber,deployedPoolCount:validatorPools.length,initializedPoolCount,newPoolsDiscoveredThisRun:validatorPools.length-(previous?.rows?.length||0)},validatorPools,
        summary:{deployedPoolCount:validatorPools.length,initializedPoolCount,distinctCurrentOwnerCount:ownerSet.size,totalValidatorCount,totalCreditRaw:totalCredit.toString(),totalCreditEth:round(units(totalCredit)),totalLiveBorrowRaw:totalBorrowed.toString(),totalLiveBorrowEth:round(units(totalBorrowed)),totalBorrowAllowanceRaw:totalBorrowAllowance.toString(),totalBorrowAllowanceEth:round(units(totalBorrowAllowance)),totalNativePoolBalanceRaw:totalNativeBalance.toString(),totalNativePoolBalanceEth:round(units(totalNativeBalance)),activeBorrowingPoolCount,insolventPoolCount,liquidatedPoolCount},
        rpc:{endpointId:endpoint.id,failoverAttempts:attempts,historyFailoverAttempts:[],reusedCheckpoint:Boolean(checkpoint?.blockTag),incrementalDiscovery:Boolean(previous),previousDiscoveryBlock:previous?Number(previous.block):null,logDiscovery},
        epistemic:{sourceType:'onchain-public-rpc-exact-block-plus-bounded-public-history-rpc',currentStateAuthorityEndpoint:endpoint.id,historyTransportAuthority:'discovery-only',candidateIdentityReproof:'MEASURED-current-code-pointer-account-arithmetic',validatorPoolRegistry:'MEASURED-VPoolDeployed-history',creditAccounting:'MEASURED-plus-DERIVED-source-formula-parity',borrowAccounting:'MEASURED-live-and-stored-cross-contract-parity',borrowAllowance:'MEASURED-current-LendingPool-account',solvency:'MEASURED-return-plus-DERIVED-source-formula-parity',validatorPoolNativeEthBalance:'MEASURED-not-attributed-to-staking-rewards',validatorPerformance:'UNKNOWN-not-measured-by-this-atom',stakingRewards:'UNKNOWN-native-balance-is-not-reward-attribution',protocolRevenue:'UNKNOWN-not-measured-by-this-atom',companyCashFlow:'UNKNOWN-not-measured-by-this-atom',unknownIsZero:false,causalClaimAuthority:'none',executionAuthority:'none'}
      };
    }catch(error){
      const historyUnavailable=error?.code==='VPOOL_HISTORY_UNAVAILABLE';
      const historyRows=Array.isArray(error?.historyFailoverAttempts)?error.historyFailoverAttempts:[];
      if(historyRows.length)historyFailoverAttempts.push(...historyRows.map(row=>({...row,currentStateEndpointId:endpoint?.id||null})));
      attempts.push({endpointId:endpoint?.id||null,classification:historyUnavailable?'HISTORY_UNAVAILABLE':null,error:String(error instanceof Error?error.message:error).slice(0,320)});
      if(historyUnavailable){
        const compact=historyRows.map(row=>`${row.endpointId||'unknown'}:${row.classification||'OTHER'}`).join(',');
        const reason=`UNKNOWN-HISTORY-DISCOVERY-${compact||'HISTORY_UNAVAILABLE'}`.replace(/\s+/g,'-').slice(0,280);
        return unknownMeasurement(source,reason,attempts,historyFailoverAttempts);
      }
    }
  }
  const last=attempts.at(-1)?.error||'no-rpc-attempts';
  return unknownMeasurement(source,attempts.length?`UNKNOWN-${last.replace(/\s+/g,'-').slice(0,280)}`:'UNKNOWN-no-rpc-attempts',attempts,historyFailoverAttempts);
}

function rebuildRelationships(current){const surfaces=Object.values(current?.surfaces||{});current.relationshipGraph=surfaces.flatMap(item=>(Array.isArray(item?.mechanicalRelations)?item.mechanicalRelations:[]).map((relation,index)=>({surfaceId:item.id,index,...relation})));current.coverage.relationshipCount=current.relationshipGraph.length;current.coverage.relationshipClassCounts=current.relationshipGraph.reduce((acc,relation)=>{const key=String(relation.class||'UNKNOWN').split('-')[0];acc[key]=(acc[key]||0)+1;return acc;},{});}

export function applyFraxFrxEthV2ValidatorPoolCreditCurrentState({state,measurement}){
  if(!state||typeof state!=='object')throw new Error('Frax frxETH V2 ValidatorPool adapter requires Economic Graph state');if(state?.authority?.executionAuthority!=='none'||state?.authority?.causalClaimAuthority!=='none')throw new Error('Frax frxETH V2 ValidatorPool adapter refuses Graph authority drift');
  const evidence=state?.protocolEvidence?.[FRAX_ECOSYSTEM_EVIDENCE_ID],current=evidence?.latest?.observation;if(!current||current.protocolId!==FRAX_PROTOCOL_ID)throw new Error('Frax frxETH V2 ValidatorPool adapter requires Frax ecosystem observation');const surface=current?.surfaces?.[FRAX_FRXETH_SURFACE_KEY];if(!surface||!String(surface.measurementState||'').startsWith('MEASURED'))throw new Error('Frax frxETH V2 ValidatorPool adapter requires measured frxETH surface');if(!surface?.measured?.v2Internals?.lendingPool||!surface?.measured?.v2Internals?.redemptionQueue)throw new Error('Frax frxETH V2 ValidatorPool adapter requires prior LendingPool and RedemptionQueue sub-atoms');
  const coverageBefore={surfaceCount:current.coverage.surfaceCount,measuredSurfaceCount:current.coverage.measuredSurfaceCount,sourceBoundUnknownSurfaceCount:current.coverage.sourceBoundUnknownSurfaceCount};surface.measured.v2Internals=surface.measured.v2Internals||{};surface.measured.v2Internals.validatorPoolCredit=measurement;surface.measured.epistemic=surface.measured.epistemic||{};const measured=measurement?.status==='ok'&&measurement?.measurementClass==='MEASURED';
  surface.measured.epistemic.validatorPoolRegistry=measured?'MEASURED-VPoolDeployed-history':'UNKNOWN';surface.measured.epistemic.validatorPoolCredit=measured?'MEASURED-plus-DERIVED-source-formula-parity':'UNKNOWN';surface.measured.epistemic.validatorPoolBorrow=measured?'MEASURED-live-and-stored-cross-contract-parity':'UNKNOWN';surface.measured.epistemic.validatorPoolSolvency=measured?'MEASURED-plus-DERIVED-source-formula-parity':'UNKNOWN';surface.measured.epistemic.validatorPerformance='UNKNOWN-not-measured-by-this-atom';surface.measured.epistemic.stakingRewards='UNKNOWN-native-balance-is-not-reward-attribution';surface.measured.epistemic.executionAuthority='none';
  current.epistemic.frxEthV2ValidatorPoolRegistry=measured?'MEASURED-VPoolDeployed-history':'UNKNOWN';current.epistemic.frxEthV2ValidatorPoolCredit=measured?'MEASURED-plus-DERIVED-source-formula-parity':'UNKNOWN';current.epistemic.frxEthV2ValidatorPoolBorrow=measured?'MEASURED-live-and-stored-cross-contract-parity':'UNKNOWN';current.epistemic.frxEthV2ValidatorPoolSolvency=measured?'MEASURED-plus-DERIVED-source-formula-parity':'UNKNOWN';current.epistemic.frxEthV2ValidatorPerformance='UNKNOWN';current.epistemic.frxEthV2StakingRewards='UNKNOWN';
  surface.mechanicalRelations=(surface.mechanicalRelations||[]).filter(item=>item?.extension!=='frxeth-v2-validator-pool-credit');surface.mechanicalRelations.push(
    {from:'LendingPool.VPoolDeployed history',to:'current ValidatorPool registry',class:measured?'MEASURED-source-bound-event-history':'UNKNOWN',extension:'frxeth-v2-validator-pool-credit',note:'History transport is discovery-only. Pool identities are re-proven with current exact-block code / LendingPool pointer / account checks.'},
    {from:'validatorCount × creditPerValidator',to:'wouldBeSolvent creditAmount',class:measured?'DERIVED-mechanical-arithmetic-parity':'UNKNOWN',extension:'frxeth-v2-validator-pool-credit',note:'Credit is collateral/borrowing capacity, not staking yield or protocol revenue.'},
    {from:'ValidatorPool getAmountBorrowed + LendingPool wouldBeSolvent',to:'current live borrow',class:measured?'MEASURED-cross-contract-parity':'UNKNOWN',extension:'frxeth-v2-validator-pool-credit',note:'Live debt includes read-only interest preview; no addInterest state mutation is called.'},
    {from:'creditAmount >= liveBorrow and not liquidated',to:'validator-pool solvency',class:measured?'DERIVED-mechanical-arithmetic-parity':'UNKNOWN',extension:'frxeth-v2-validator-pool-credit',note:'Mechanical source contract condition only; no forecast or validator-performance claim.'}
  );
  current.measurementExtensions={...(current.measurementExtensions||{}),frxEthV2ValidatorPoolCreditCurrentState:FRAX_FRXETH_V2_VALIDATOR_POOL_CREDIT_VERSION};current.nextMeasurementUnlocks=(current.nextMeasurementUnlocks||[]).filter(item=>!String(item).startsWith('Measure frxETH V2 '));current.nextMeasurementUnlocks.push(measured?'Audit frxETH V2 BeaconOracle / validator outcome economics as a separate bounded atom; do not infer staking rewards from ValidatorPool native balances.':'Measure frxETH V2 ValidatorPool deployment registry, credit, borrow allowance, live debt and solvency from exact-block source-pinned state.');
  if(current.coverage.surfaceCount!==coverageBefore.surfaceCount||current.coverage.measuredSurfaceCount!==coverageBefore.measuredSurfaceCount||current.coverage.sourceBoundUnknownSurfaceCount!==coverageBefore.sourceBoundUnknownSurfaceCount)throw new Error('frxETH V2 ValidatorPool sub-atom must not change top-level Frax coverage');rebuildRelationships(current);current.authority={...(current.authority||{}),causalClaimAuthority:'none',executionAuthority:'none'};current.observedAt=state.generatedAt||current.observedAt;
  current.id=`frax-ecosystem:${sha256(stableStringify({baseObservationId:current.id||null,extension:FRAX_FRXETH_V2_VALIDATOR_POOL_CREDIT_VERSION,blockHash:measurement?.blockHash||null,pools:measurement?.summary?.deployedPoolCount??null,validators:measurement?.summary?.totalValidatorCount??null,credit:measurement?.summary?.totalCreditRaw||null,borrow:measurement?.summary?.totalLiveBorrowRaw||null,insolvent:measurement?.summary?.insolventPoolCount??null,executionAuthority:'none'})).slice(0,16)}`;
  evidence.latest={observedAt:current.observedAt,observation:current};const observations=Array.isArray(evidence.observations)?evidence.observations:[];evidence.observations=[...observations,current].slice(-MAX_OBSERVATIONS);evidence.observationCount=evidence.observations.length;evidence.status=current.status;const sensor=state?.protocolSensors?.[FRAX_PROTOCOL_ID];if(sensor){sensor.ecosystemFamily=sensor.ecosystemFamily||{};sensor.ecosystemFamily.measurementExtensions=current.measurementExtensions;sensor.ecosystemFamily.coverage=current.coverage;sensor.ecosystemFamily.latestEvidenceId=current.id;sensor.epistemic={...(sensor.epistemic||{}),frxEthV2ValidatorPoolCreditCurrentState:measured?'MEASURED':'UNKNOWN',executionAuthority:'none'};}if(current.authority.executionAuthority!=='none')throw new Error('Frax frxETH V2 ValidatorPool execution authority drift');return current;
}
