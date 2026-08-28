#!/usr/bin/env node
/**
 * The Holding · Fraxtal Fraxswap factory + protocol-fee LP mint sensor v0.1
 *
 * Measures the full Fraxswap Factory pair registry at the exact published
 * Fraxtal checkpoints already used by the canonical BAMM/Fraxswap sensors.
 * It separately observes factory feeTo state and source-ordered LP Transfer /
 * Mint / Burn events to identify feeTo-directed LP mints created by _mintFee.
 *
 * Important boundary: Fraxswap _mintFee does not transfer a fixed percentage of
 * every swap to feeTo. On mint/burn it may mint LP units equal to 1/6 of growth
 * in sqrt(k), according to the pinned FraxswapPair source. LP units from distinct
 * pairs are heterogeneous and are never summed into a protocol-wide token or USD
 * revenue number here. feeTo has no setter event in the pinned factory source;
 * checkpoint parity is recorded but continuous intra-interval stability is not
 * over-claimed.
 *
 * No execution, price, recommendation, methodology or causal authority.
 */
import crypto from 'node:crypto';
import {
  FRAX_ECOSYSTEM_EVIDENCE_ID,
  FRAX_PROTOCOL_ID,
  FRAXTAL_CHAIN_ID,
  FRAXTAL_RPC_ENDPOINTS,
  FRAXSWAP_FACTORY_FRAXTAL
} from './frax-bamm-onchain.mjs';

export const FRAX_FRAXSWAP_PROTOCOL_FEE_VERSION='0.1-fraxtal-fraxswap-factory-feeto-lp-mints';
export const FRAXSWAP_SOURCE_REF='30532c8cefcbf5c7efafcff4369261bd435a4859';
const RPC_TIMEOUT_MS=12_000;
const MAX_FACTORY_PAIRS=600;
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
function address(hex){const x=cleanAbi(hex);return `0x${x.slice(24,64)}`;}
function asciiHex(value){return `0x${Buffer.from(value,'utf8').toString('hex')}`;}
function uintArg(v){return BigInt(v).toString(16).padStart(64,'0');}
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

function validateCheckpoint(m,label){
  if(m?.status!=='ok'||m?.measurementClass!=='MEASURED'||m?.chainId!==FRAXTAL_CHAIN_ID||!m?.blockTag||!/^0x[0-9a-f]{64}$/i.test(String(m?.blockHash||'')))throw new Error(`${label} Fraxtal checkpoint unavailable`);
}
function unknown({current,previous,attempts,reason='UNKNOWN-fraxswap-protocol-fee-read-failed'}={}){
  return {version:FRAX_FRAXSWAP_PROTOCOL_FEE_VERSION,status:reason,measurementClass:'UNKNOWN',observedAt:current?.observedAt||null,chain:'fraxtal',chainId:FRAXTAL_CHAIN_ID,
    interval:{fromBlockExclusive:previous?.blockNumber??null,toBlockInclusive:current?.blockNumber??null,fromBlockHash:previous?.blockHash||null,toBlockHash:current?.blockHash||null,nonOverlappingPublishedCheckpointInterval:false},
    factory:{address:FRAXSWAP_FACTORY_FRAXTAL,startPairCount:null,endPairCount:null,startFeeTo:null,endFeeTo:null,checkpointFeeToParity:false},coverage:{fullFactoryRegistryCurrent:false,startPairCount:null,endPairCount:null,commonPairCount:null,newPairCount:null,removedPairCount:null,bammSubsetPairCount:null,nonBammPairCount:null},pairs:[],summary:{pairCountWithProtocolFeeMints:null,protocolFeeMintEventCount:null},rpc:{endpointId:null,failoverAttempts:attempts||[]},
    provenance:{officialSourceRepository:'FraxFinance/frax-solidity',officialSourceRef:FRAXSWAP_SOURCE_REF,sourceContracts:['FraxswapFactory.sol','FraxswapPair.sol','FraxswapERC20.sol']},
    epistemic:{factoryTopology:'UNKNOWN',feeToCurrentState:'UNKNOWN',feeToIntervalStability:'UNKNOWN-no-FeeToUpdated-event-in-pinned-source',protocolFeeLpMintFlow:'UNKNOWN',heterogeneousLpUnitsAggregated:false,protocolRevenueUsdClaim:false,grossSwapFeesEqualProtocolRevenue:false,unknownIsZero:false,causalClaimAuthority:'none',executionAuthority:'none'}};
}

function classifyPairLogs({logs,feeTo,topics,pair}){
  const byTx=new Map();for(const log of logs){const tx=String(log.transactionHash||'');if(!tx)throw new Error(`Missing tx hash ${pair}`);if(!byTx.has(tx))byTx.set(tx,[]);byTx.get(tx).push(log);}
  let protocolMintEvents=0n;let protocolMintUnits=0n;let mintCalls=0;let burnCalls=0;let minimumLiquidityMints=0;const protocolEvents=[];
  for(const [tx,rows0] of byTx){
    const rows=[...rows0].sort((a,b)=>{const ia=rpcQuantity(a.logIndex),ib=rpcQuantity(b.logIndex);return ia<ib?-1:ia>ib?1:0;});let pending=[];
    for(const log of rows){const topic0=String(log?.topics?.[0]||'').toLowerCase();
      if(topic0===topics.transfer){
        if((log.topics||[]).length!==3)throw new Error(`Transfer ABI mismatch ${pair}`);const from=topicAddress(log.topics[1]),to=topicAddress(log.topics[2]),value=word(log.data);
        if(sameAddress(from,ZERO))pending.push({to,value,blockNumber:Number(rpcQuantity(log.blockNumber)),logIndex:Number(rpcQuantity(log.logIndex)),tx});
        continue;
      }
      if(topic0===topics.mint){
        mintCalls++;if(!pending.length)throw new Error(`Mint without zero-origin LP mint ${pair}`);
        const userMint=pending[pending.length-1];const prior=pending.slice(0,-1);
        for(const p of prior){if(sameAddress(p.to,ZERO)){minimumLiquidityMints++;continue;}if(!sameAddress(p.to,feeTo))throw new Error(`Unexpected pre-user LP mint destination ${p.to} ${pair}`);protocolMintEvents++;protocolMintUnits+=p.value;protocolEvents.push({...p,terminal:'Mint'});}
        // The final zero-origin Transfer is the user LP mint by source order, even
        // if the user deliberately chose feeTo as the mint recipient.
        void userMint;pending=[];continue;
      }
      if(topic0===topics.burn){
        burnCalls++;for(const p of pending){if(!sameAddress(p.to,feeTo))throw new Error(`Unexpected pre-burn LP mint destination ${p.to} ${pair}`);protocolMintEvents++;protocolMintUnits+=p.value;protocolEvents.push({...p,terminal:'Burn'});}pending=[];continue;
      }
      throw new Error(`Unexpected Fraxswap protocol-fee topic ${topic0}`);
    }
    if(pending.length)throw new Error(`Unconsumed zero-origin LP mint sequence ${pair} ${tx}`);
  }
  return {protocolMintEventCount:Number(protocolMintEvents),protocolMintUnitsRaw:protocolMintUnits.toString(),protocolMintUnitsLp:format18(protocolMintUnits),mintCallCount:mintCalls,burnCallCount:burnCalls,minimumLiquidityMintCount:minimumLiquidityMints,protocolEvents};
}

export async function collectFraxswapProtocolFeeRouting({currentBammMeasurement,previousBammMeasurement,endpoints=FRAXTAL_RPC_ENDPOINTS,fetchImpl=fetch}={}){
  const attempts=[];try{validateCheckpoint(currentBammMeasurement,'Current');validateCheckpoint(previousBammMeasurement,'Previous');}catch(error){return unknown({current:currentBammMeasurement,previous:previousBammMeasurement,attempts:[{endpointId:null,error:error.message}],reason:'UNKNOWN-published-fraxtal-checkpoint-unavailable'});}
  const startBlock=BigInt(previousBammMeasurement.blockNumber),endBlock=BigInt(currentBammMeasurement.blockNumber);if(endBlock<=startBlock)return unknown({current:currentBammMeasurement,previous:previousBammMeasurement,attempts,reason:'UNKNOWN-no-forward-published-block-interval'});
  const preferred=currentBammMeasurement?.rpc?.endpointId;const ordered=[...endpoints].sort((a,b)=>(a.id===preferred?-1:0)-(b.id===preferred?-1:0));
  for(const endpoint of ordered){
    try{
      const signatures=['feeTo()','allPairsLength()','allPairs(uint256)','factory()','token0()','token1()','kLast()','totalSupply()','balanceOf(address)','Transfer(address,address,uint256)','Mint(address,uint256,uint256)','Burn(address,uint256,uint256,address)'];
      const sigReq=signatures.map((s,i)=>({jsonrpc:'2.0',id:i+1,method:'web3_sha3',params:[asciiHex(s)]}));sigReq.push({jsonrpc:'2.0',id:100,method:'eth_getBlockByNumber',params:[previousBammMeasurement.blockTag,false]},{jsonrpc:'2.0',id:101,method:'eth_getBlockByNumber',params:[currentBammMeasurement.blockTag,false]});
      const sig=await postBatch(endpoint.url,sigReq,fetchImpl),hashes=new Map(signatures.map((s,i)=>[s,String(sig.get(i+1).result).toLowerCase()]));
      for(const [s,h] of hashes)if(!/^0x[0-9a-f]{64}$/.test(h))throw new Error(`Signature hash failed ${s}`);
      if(String(sig.get(100).result?.hash||'').toLowerCase()!==String(previousBammMeasurement.blockHash).toLowerCase()||String(sig.get(101).result?.hash||'').toLowerCase()!==String(currentBammMeasurement.blockHash).toLowerCase())throw new Error('Published Fraxtal checkpoint block hash mismatch');
      const selector=s=>hashes.get(s).slice(0,10),call=(id,to,data,tag)=>({jsonrpc:'2.0',id,method:'eth_call',params:[{to,data},tag]});
      let id=1000;const root=await postBatch(endpoint.url,[call(id++,FRAXSWAP_FACTORY_FRAXTAL,selector('feeTo()'),previousBammMeasurement.blockTag),call(id++,FRAXSWAP_FACTORY_FRAXTAL,selector('feeTo()'),currentBammMeasurement.blockTag),call(id++,FRAXSWAP_FACTORY_FRAXTAL,selector('allPairsLength()'),previousBammMeasurement.blockTag),call(id++,FRAXSWAP_FACTORY_FRAXTAL,selector('allPairsLength()'),currentBammMeasurement.blockTag)],fetchImpl);
      const startFeeTo=address(root.get(1000).result),endFeeTo=address(root.get(1001).result),startCount=Number(word(root.get(1002).result)),endCount=Number(word(root.get(1003).result));
      if(!Number.isSafeInteger(startCount)||!Number.isSafeInteger(endCount)||startCount<0||endCount<startCount||endCount>MAX_FACTORY_PAIRS)throw new Error(`Fraxswap factory pair count invalid ${startCount}/${endCount}`);
      const pairCalls=[];const startIds=[],endIds=[];id=2000;for(let i=0;i<startCount;i++){const x={index:i,id:id++};startIds.push(x);pairCalls.push(call(x.id,FRAXSWAP_FACTORY_FRAXTAL,selector('allPairs(uint256)')+uintArg(i),previousBammMeasurement.blockTag));}for(let i=0;i<endCount;i++){const x={index:i,id:id++};endIds.push(x);pairCalls.push(call(x.id,FRAXSWAP_FACTORY_FRAXTAL,selector('allPairs(uint256)')+uintArg(i),currentBammMeasurement.blockTag));}
      const pairState=pairCalls.length?await batched(endpoint.url,pairCalls,fetchImpl):new Map();const startPairs=startIds.map(x=>address(pairState.get(x.id).result)),endPairs=endIds.map(x=>address(pairState.get(x.id).result));
      if(new Set(startPairs.map(normalizeAddress)).size!==startPairs.length||new Set(endPairs.map(normalizeAddress)).size!==endPairs.length)throw new Error('Duplicate Fraxswap factory pair identity');
      for(let i=0;i<startPairs.length;i++)if(!sameAddress(startPairs[i],endPairs[i]))throw new Error(`Fraxswap allPairs append-only identity drift at ${i}`);
      const commonPairCount=startPairs.length,newPairs=endPairs.slice(startPairs.length),bammSet=new Set((currentBammMeasurement?.bamms||[]).map(x=>normalizeAddress(x.pair))),bammSubsetPairCount=endPairs.filter(x=>bammSet.has(normalizeAddress(x))).length;

      const currentCalls=[];const meta=[];id=10000;for(const pair of endPairs){const x={pair,factory:id++,token0:id++,token1:id++,kLast:id++,supply:id++,feeBal:null};currentCalls.push(call(x.factory,pair,selector('factory()'),currentBammMeasurement.blockTag),call(x.token0,pair,selector('token0()'),currentBammMeasurement.blockTag),call(x.token1,pair,selector('token1()'),currentBammMeasurement.blockTag),call(x.kLast,pair,selector('kLast()'),currentBammMeasurement.blockTag),call(x.supply,pair,selector('totalSupply()'),currentBammMeasurement.blockTag));if(!sameAddress(endFeeTo,ZERO)){x.feeBal=id++;currentCalls.push(call(x.feeBal,pair,selector('balanceOf(address)')+addrArg(endFeeTo),currentBammMeasurement.blockTag));}meta.push(x);}
      const currentState=currentCalls.length?await batched(endpoint.url,currentCalls,fetchImpl):new Map();const pairs=meta.map(x=>{const f=address(currentState.get(x.factory).result),token0=address(currentState.get(x.token0).result),token1=address(currentState.get(x.token1).result),kLast=word(currentState.get(x.kLast).result),supply=word(currentState.get(x.supply).result),feeBal=x.feeBal?word(currentState.get(x.feeBal).result):0n;if(!sameAddress(f,FRAXSWAP_FACTORY_FRAXTAL))throw new Error(`Fraxswap pair factory drift ${x.pair}`);return {pair:x.pair,token0,token1,current:{kLast:kLast.toString(),totalSupplyRaw:supply.toString(),feeToBalanceRaw:x.feeBal?feeBal.toString():null,feeToBalanceLp:x.feeBal?format18(feeBal):null},protocolFeeFlow:null};});

      const checkpointFeeToParity=sameAddress(startFeeTo,endFeeTo),flowEligible=checkpointFeeToParity&&!sameAddress(endFeeTo,ZERO);const topics={transfer:hashes.get('Transfer(address,address,uint256)'),mint:hashes.get('Mint(address,uint256,uint256)'),burn:hashes.get('Burn(address,uint256,uint256,address)')};
      let pairCountWithProtocolFeeMints=null,protocolFeeMintEventCount=null;
      if(flowEligible&&endPairs.length){
        const logCalls=[],logMeta=[];id=50000;for(const pair of endPairs){for(let from=startBlock+1n;from<=endBlock;from+=MAX_LOG_BLOCK_SPAN){const to=from+MAX_LOG_BLOCK_SPAN-1n>endBlock?endBlock:from+MAX_LOG_BLOCK_SPAN-1n,reqId=id++;logCalls.push({jsonrpc:'2.0',id:reqId,method:'eth_getLogs',params:[{address:pair,fromBlock:hexQuantity(from),toBlock:hexQuantity(to),topics:[[topics.transfer,topics.mint,topics.burn]]}]});logMeta.push({reqId,pair:normalizeAddress(pair),from,to});}}
        const logsByPair=new Map(endPairs.map(p=>[normalizeAddress(p),[]]));const result=logCalls.length?await batched(endpoint.url,logCalls,fetchImpl):new Map();for(const m of logMeta){const rows=result.get(m.reqId).result;if(!Array.isArray(rows))throw new Error('Fraxswap protocol-fee logs response invalid');for(const log of rows){if(!sameAddress(log.address,m.pair))throw new Error('Fraxswap protocol-fee log address mismatch');const b=rpcQuantity(log.blockNumber);if(b<m.from||b>m.to)throw new Error('Fraxswap protocol-fee log escaped range');logsByPair.get(m.pair).push(log);}}
        pairCountWithProtocolFeeMints=0;protocolFeeMintEventCount=0;for(const p of pairs){const classified=classifyPairLogs({logs:logsByPair.get(normalizeAddress(p.pair))||[],feeTo:endFeeTo,topics,pair:p.pair});p.protocolFeeFlow=classified;if(classified.protocolMintEventCount>0){pairCountWithProtocolFeeMints++;protocolFeeMintEventCount+=classified.protocolMintEventCount;}}
      }

      return {version:FRAX_FRAXSWAP_PROTOCOL_FEE_VERSION,status:'ok',measurementClass:'MEASURED',observedAt:currentBammMeasurement.observedAt,chain:'fraxtal',chainId:FRAXTAL_CHAIN_ID,blockNumber:currentBammMeasurement.blockNumber,blockTag:currentBammMeasurement.blockTag,blockHash:currentBammMeasurement.blockHash,
        interval:{fromBlockExclusive:Number(startBlock),toBlockInclusive:Number(endBlock),fromBlockHash:previousBammMeasurement.blockHash,toBlockHash:currentBammMeasurement.blockHash,fromObservedAt:previousBammMeasurement.observedAt,toObservedAt:currentBammMeasurement.observedAt,nonOverlappingPublishedCheckpointInterval:true},
        factory:{address:FRAXSWAP_FACTORY_FRAXTAL,startPairCount:startCount,endPairCount:endCount,startFeeTo,endFeeTo,checkpointFeeToParity,feeOnAtEnd:!sameAddress(endFeeTo,ZERO)},
        coverage:{fullFactoryRegistryCurrent:true,startPairCount:startCount,endPairCount:endCount,commonPairCount,newPairs.length?commonPairCount:commonPairCount,newPairCount:newPairs.length,removedPairCount:0,newPairs,bammSubsetPairCount,nonBammPairCount:endCount-bammSubsetPairCount,flowPairCount:flowEligible?endCount:0},pairs,
        summary:{pairCountWithNonzeroKLast:pairs.filter(p=>BigInt(p.current.kLast)>0n).length,pairCountWithProtocolFeeMints,protocolFeeMintEventCount},rpc:{endpointId:endpoint.id,failoverAttempts:attempts},
        provenance:{officialSourceRepository:'FraxFinance/frax-solidity',officialSourceRef:FRAXSWAP_SOURCE_REF,sourceContracts:['FraxswapFactory.sol','FraxswapPair.sol','FraxswapERC20.sol'],factoryFormula:'_mintFee: liquidity = totalSupply * (sqrt(k)-sqrt(kLast)) / (sqrt(k)*5 + sqrt(kLast)); mint to factory.feeTo when feeOn and positive',eventIdentity:'FraxswapERC20 _mint emits Transfer(address(0),to,value); FraxswapPair calls _mintFee before user mint or burn terminal event'},
        epistemic:{factoryTopology:'MEASURED-full-factory-current-exact-block',feeToCurrentState:'MEASURED-exact-block',feeToCheckpointParity:checkpointFeeToParity?'DERIVED-MECHANICAL-same-address-at-published-checkpoints':'MEASURED-checkpoint-route-change',feeToIntervalStability:'NOT-PROVEN-continuously-no-FeeToUpdated-event-in-pinned-source',protocolFeeLpMintFlow:flowEligible?'MEASURED-source-ordered-feeTo-directed-LP-mints-under-checkpoint-stable-route':'UNKNOWN-route-not-nonzero-and-checkpoint-stable',heterogeneousLpUnitsAggregated:false,lpUnitValuationPerformed:false,protocolRevenueUsdClaim:false,grossSwapFeesEqualProtocolRevenue:false,unknownIsZero:false,causalClaimAuthority:'none',executionAuthority:'none'}};
    }catch(error){attempts.push({endpointId:endpoint.id,error:error instanceof Error?error.message:String(error)});}
  }
  return unknown({current:currentBammMeasurement,previous:previousBammMeasurement,attempts});
}

export function applyFraxswapProtocolFeeRouting({state,previousState,measurement}){
  if(!state||typeof state!=='object')throw new Error('Fraxswap protocol-fee adapter requires Economic Graph state');if(state?.authority?.executionAuthority!=='none'||state?.authority?.causalClaimAuthority!=='none')throw new Error('Fraxswap protocol-fee adapter refuses Graph authority drift');
  const evidence=state?.protocolEvidence?.[FRAX_ECOSYSTEM_EVIDENCE_ID],base=evidence?.latest?.observation,fraxSensor=state?.protocolSensors?.[FRAX_PROTOCOL_ID];if(!evidence||!base||!fraxSensor)throw new Error('Frax ecosystem evidence missing before protocol-fee enrichment');
  const current=structuredClone(base),surface=current?.surfaces?.fraxswapBamm;if(!surface)throw new Error('Fraxswap/BAMM surface missing');const valid=measurement?.status==='ok'&&measurement?.measurementClass==='MEASURED'&&measurement?.coverage?.fullFactoryRegistryCurrent===true;
  surface.measured={...(surface.measured||{}),protocolFeeRouting:measurement};current.measurementExtensions={...(current.measurementExtensions||{}),fraxswapProtocolFeeRouting:FRAX_FRAXSWAP_PROTOCOL_FEE_VERSION};
  current.epistemic={...(current.epistemic||{}),fraxswapFactoryTopology:valid?'MEASURED-full-factory-current-exact-block':'UNKNOWN',fraxswapFeeRecipientSplit:valid?measurement.epistemic.protocolFeeLpMintFlow:'UNKNOWN'};
  const surfaces=Object.values(current.surfaces||{}),measured=surfaces.filter(s=>String(s.measurementState||'').startsWith('MEASURED'));current.coverage.measuredSurfaceCount=measured.length;current.coverage.sourceBoundUnknownSurfaceCount=surfaces.length-measured.length;current.relationshipGraph=surfaces.flatMap(s=>s.mechanicalRelations.map((r,index)=>({surfaceId:s.id,index,...r})));current.coverage.relationshipCount=current.relationshipGraph.length;current.coverage.relationshipClassCounts=current.relationshipGraph.reduce((a,r)=>{const k=String(r.class||'UNKNOWN').split('-')[0];a[k]=(a[k]||0)+1;return a;},{});
  current.id=`frax-ecosystem:${sha256(stableStringify({priorId:base.id,protocolFee:valid?{blockNumber:measurement.blockNumber,blockHash:measurement.blockHash,factoryPairCount:measurement.factory.endPairCount,feeTo:measurement.factory.endFeeTo,protocolFeeMintEventCount:measurement.summary.protocolFeeMintEventCount,pairs:measurement.pairs.map(p=>[p.pair,p.protocolFeeFlow?.protocolMintEventCount??null,p.protocolFeeFlow?.protocolMintUnitsRaw??null])}:{status:measurement?.status||'UNKNOWN'},surfaceIds:current.coverage.surfaceIds})).slice(0,24)}`;
  const prevRows=Array.isArray(previousState?.protocolEvidence?.[FRAX_ECOSYSTEM_EVIDENCE_ID]?.observations)?previousState.protocolEvidence[FRAX_ECOSYSTEM_EVIDENCE_ID].observations:[];const rows=[...prevRows];if(!rows.some(r=>r?.id===current.id))rows.push(current);evidence.latest={observation:current};evidence.status=current.status;evidence.observations=rows.slice(-MAX_OBSERVATIONS);evidence.observationCount=evidence.observations.length;evidence.measurementExtensions={...(evidence.measurementExtensions||{}),fraxswapProtocolFeeRouting:FRAX_FRAXSWAP_PROTOCOL_FEE_VERSION};
  fraxSensor.ecosystemFamily={...(fraxSensor.ecosystemFamily||{}),status:current.status,measuredSurfaceCount:current.coverage.measuredSurfaceCount,sourceBoundUnknownSurfaceCount:current.coverage.sourceBoundUnknownSurfaceCount,latestObservationId:current.id,measurementExtensions:{...(fraxSensor.ecosystemFamily?.measurementExtensions||{}),fraxswapProtocolFeeRouting:FRAX_FRAXSWAP_PROTOCOL_FEE_VERSION}};if(fraxSensor?.latest?.observation)fraxSensor.latest.observation.ecosystemFamily=fraxSensor.ecosystemFamily;
  if(current.coverage.measuredSurfaceCount+current.coverage.sourceBoundUnknownSurfaceCount!==current.coverage.surfaceCount)throw new Error('Frax protocol-fee depth accounting drift');if(valid&&measurement.factory.endPairCount!==measurement.pairs.length)throw new Error('Fraxswap full factory pair materialization mismatch');if(current?.authority?.executionAuthority!=='none'||current?.epistemic?.executionAuthority!=='none'||measurement?.epistemic?.executionAuthority!=='none')throw new Error('Fraxswap protocol-fee execution authority leaked');return state;
}
