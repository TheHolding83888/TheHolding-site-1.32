#!/usr/bin/env node
/**
 * The Holding · Frax frxETH V2 EtherRouter realized routing v0.1
 *
 * Adjacent-checkpoint event accounting for realized EtherRouter ETH outflows.
 * Measures EtherSwept and EtherRequested from the pinned official EtherRouter,
 * classifies destinations against the exact current routing pointers, and keeps
 * the inbound / fungible-balance boundary explicit. depositEther() and receive()
 * accept ETH without emitting a routing event, so this atom does not claim a
 * complete cash-flow reconciliation, protocol revenue, or company cash flow.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const FRAX_FRXETH_V2_ETHER_ROUTER_FLOW_VERSION='0.1-frxeth-v2-ether-router-realized-routing-adjacent-checkpoint';
export const FRAX_ECOSYSTEM_EVIDENCE_ID='registry-frax-ecosystem';
export const FRAX_PROTOCOL_ID='registry-frax-vefrax';
export const FRAX_FRXETH_SURFACE_KEY='frxEthSfrxEth';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const REGISTRY_FILE=path.join(ROOT,'intelligence/economic-graph/frax-frxeth-registry.json');
const RPC_REGISTRY_FILE=path.join(ROOT,'intelligence/market-data/onchain-price-source-registry.json');
const EXPECTED_SOURCE_COMMIT='83dfe93b4a32b9ca0ab93d6e7c059fcd977320d4';
const RPC_TIMEOUT_MS=12_000;
const MAX_EVENTS=500;
const MAX_OBSERVATIONS=1000;
const E18=10n**18n;

function sha256(value){return crypto.createHash('sha256').update(value).digest('hex');}
function stableValue(value){if(Array.isArray(value))return value.map(stableValue);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(k=>[k,stableValue(value[k])]));return value;}
function stableStringify(value){return JSON.stringify(stableValue(value));}
function readJson(file){return JSON.parse(fs.readFileSync(file,'utf8'));}
function normalize(value){return String(value||'').toLowerCase();}
function validAddress(value){return /^0x[0-9a-fA-F]{40}$/.test(String(value||''));}
function asciiHex(value){return `0x${Buffer.from(value,'utf8').toString('hex')}`;}
function cleanHex(hex){const x=String(hex||'').replace(/^0x/,'');if(!/^[0-9a-f]*$/i.test(x)||x.length%64!==0)throw new Error('Invalid ABI payload');return x;}
function decodeWord(hex,index=0){const x=cleanHex(hex),start=index*64;if(x.length<start+64)throw new Error(`Invalid ABI word ${index}`);return BigInt(`0x${x.slice(start,start+64)}`);}
function decodeAddress(hex,index=0){const word=decodeWord(hex,index).toString(16).padStart(64,'0');return `0x${word.slice(24)}`;}
function quantity(hex){if(!/^0x[0-9a-f]+$/i.test(String(hex||'')))throw new Error('Invalid RPC quantity');return BigInt(hex);}
function hexQuantity(value){return `0x${BigInt(value).toString(16)}`;}
function units(raw){const sign=raw<0n?'-':'';const n=raw<0n?-raw:raw,whole=n/E18,fraction=(n%E18).toString().padStart(18,'0').replace(/0+$/,'');return Number(`${sign}${whole}${fraction?'.'+fraction:''}`);}
function round(value,digits=12){const n=Number(value);return Number.isFinite(n)?Number(n.toFixed(digits)):null;}
function eventKey(row){return `${String(row.txHash||'').toLowerCase()}:${row.logIndex}`;}

export function validateFraxFrxEthEtherRouterFlowRegistry(registry){
  if(registry?.version!=='0.1-frxeth-current-state-registry'||registry?.network!=='ethereum'||Number(registry?.chainId)!==1)throw new Error('frxETH EtherRouter flow registry identity drift');
  if(!validAddress(registry?.operations?.etherRouter)||!validAddress(registry?.operations?.lendingPool)||!validAddress(registry?.operations?.redemptionQueueV2))throw new Error('frxETH EtherRouter flow registry addresses invalid');
  if(registry?.sources?.officialSourceRepo!=='FraxFinance/frxETH-v2-public'||registry?.sources?.officialSourceCommit!==EXPECTED_SOURCE_COMMIT)throw new Error('frxETH EtherRouter flow source pin drift');
  if(registry?.epistemic?.unknownIsZero!==false||registry?.epistemic?.executionAuthority!=='none'||registry?.epistemic?.causalClaimAuthority!=='none')throw new Error('frxETH EtherRouter flow epistemic boundary drift');
  return registry;
}

function checkpointError(measurement,label,expectedRouter){
  if(measurement?.status!=='ok'||measurement?.measurementClass!=='MEASURED'||Number(measurement?.chainId)!==1)return `${label}-EtherRouter-measurement-unavailable`;
  if(!Number.isSafeInteger(Number(measurement?.blockNumber))||!/^0x[0-9a-f]+$/i.test(String(measurement?.blockTag||''))||!/^0x[0-9a-f]{64}$/i.test(String(measurement?.blockHash||'')))return `${label}-EtherRouter-checkpoint-invalid`;
  if(normalize(measurement?.router?.address)!==normalize(expectedRouter))return `${label}-EtherRouter-identity-drift`;
  if(!validAddress(measurement?.router?.lendingPool)||!validAddress(measurement?.router?.redemptionQueue))return `${label}-EtherRouter-routing-pointers-unavailable`;
  if(!/^\d+$/.test(String(measurement?.router?.nativeEthBalanceRaw||''))||!/^\d+$/.test(String(measurement?.consolidated?.ethTotalBalancedRaw||'')))return `${label}-EtherRouter-balance-counters-unavailable`;
  return null;
}

async function post(url,payload,fetchImpl){
  const response=await fetchImpl(url,{method:'POST',headers:{'content-type':'application/json',accept:'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(RPC_TIMEOUT_MS)});
  if(!response.ok)throw new Error(`RPC HTTP ${response.status}`);
  const body=await response.json();if(!Array.isArray(body))throw new Error('RPC response is not an array');
  const byId=new Map(body.map(row=>[Number(row?.id),row]));
  for(const req of payload){const row=byId.get(req.id);if(!row)throw new Error(`RPC result ${req.id} missing`);if(row.error)throw new Error(`RPC ${req.method} error: ${row.error?.message||'unknown error'}`);if(row.result===undefined||row.result===null)throw new Error(`RPC ${req.method} result missing`);}
  return byId;
}

async function postOne(url,payload,fetchImpl){
  const response=await fetchImpl(url,{method:'POST',headers:{'content-type':'application/json',accept:'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(RPC_TIMEOUT_MS)});
  if(!response.ok)throw new Error(`RPC HTTP ${response.status}`);
  const body=await response.json();if(Array.isArray(body)||!body||typeof body!=='object')throw new Error('RPC single response is invalid');
  if(body.error)throw new Error(`RPC ${payload.method} error: ${body.error?.message||'unknown error'}`);
  if(body.result===undefined||body.result===null)throw new Error(`RPC ${payload.method} result missing`);
  return body.result;
}

function unknown(source,reason,attempts=[]){return {
  version:FRAX_FRXETH_V2_ETHER_ROUTER_FLOW_VERSION,status:reason,measurementClass:'UNKNOWN',observedAt:null,network:'ethereum',chainId:1,blockNumber:null,blockTag:null,blockHash:null,
  router:{address:source?.operations?.etherRouter||null},interval:null,cumulativeSinceTracking:null,recentEvents:[],rpc:{endpointId:null,failoverAttempts:attempts,ethGetLogsTransport:'single-request-not-batched'},
  epistemic:{sourceType:'onchain-public-rpc-adjacent-checkpoint-event-accounting',realizedOutboundRouting:'UNKNOWN',inboundRouting:'UNKNOWN-no-complete-event-surface',fullFlowReconciliation:'UNKNOWN',withdrawalFeeToSpecificOutflow:'UNKNOWN-fungible-router-balance-not-traceable-without-transaction-level-proof',protocolRevenue:'UNKNOWN',validatorPerformance:'UNKNOWN',stakingRewards:'UNKNOWN',companyCashFlow:'UNKNOWN',unknownIsZero:false,causalClaimAuthority:'none',executionAuthority:'none'}
};}

function classifyAddress(address,current){
  const a=normalize(address);
  if(a===normalize(current?.router?.redemptionQueue))return 'redemptionQueue';
  if(validAddress(current?.router?.depositToAmoAddr)&&a===normalize(current.router.depositToAmoAddr))return 'depositAmo';
  if(a===normalize(current?.router?.lendingPool))return 'lendingPool';
  return 'other';
}

function decodeLog(log,topics,current){
  const topic0=String(log?.topics?.[0]||'').toLowerCase();
  const base={blockNumber:Number(quantity(log.blockNumber)),txHash:String(log.transactionHash||'').toLowerCase(),logIndex:Number(quantity(log.logIndex))};
  if(topic0===topics.etherSwept){
    if((log.topics||[]).length!==1||cleanHex(log.data).length!==2*64)throw new Error('EtherSwept ABI drift');
    const destAddress=decodeAddress(log.data,0),amountRaw=decodeWord(log.data,1);
    return {...base,type:'EtherSwept',destAddress,destinationClass:classifyAddress(destAddress,current),amountRaw:amountRaw.toString(),amountEth:round(units(amountRaw))};
  }
  if(topic0===topics.etherRequested){
    if((log.topics||[]).length!==1||cleanHex(log.data).length!==3*64)throw new Error('EtherRequested ABI drift');
    const recipientAddress=decodeAddress(log.data,0),amountToRequesterRaw=decodeWord(log.data,1),amountToRedemptionQueueRaw=decodeWord(log.data,2);
    return {...base,type:'EtherRequested',recipientAddress,recipientClass:classifyAddress(recipientAddress,current),amountToRequesterRaw:amountToRequesterRaw.toString(),amountToRequesterEth:round(units(amountToRequesterRaw)),amountToRedemptionQueueRaw:amountToRedemptionQueueRaw.toString(),amountToRedemptionQueueEth:round(units(amountToRedemptionQueueRaw))};
  }
  throw new Error(`Unexpected EtherRouter flow topic ${topic0}`);
}

function summarize(events,current,previous){
  let swept=0n,sweptRq=0n,sweptAmo=0n,sweptOther=0n,requested=0n,requestedRq=0n;
  let etherSweptCount=0,etherRequestedCount=0;
  const destinations=new Map();
  for(const event of events){
    if(event.type==='EtherSwept'){
      etherSweptCount++;const raw=BigInt(event.amountRaw);swept+=raw;
      if(event.destinationClass==='redemptionQueue')sweptRq+=raw;else if(event.destinationClass==='depositAmo')sweptAmo+=raw;else sweptOther+=raw;
      const key=normalize(event.destAddress);const prior=destinations.get(key)||{address:event.destAddress,destinationClass:event.destinationClass,amountRaw:0n,eventCount:0};prior.amountRaw+=raw;prior.eventCount++;destinations.set(key,prior);
    }else if(event.type==='EtherRequested'){
      etherRequestedCount++;requested+=BigInt(event.amountToRequesterRaw);requestedRq+=BigInt(event.amountToRedemptionQueueRaw);
    }
  }
  const eventReportedOutflow=swept+requested+requestedRq;
  const nativeDelta=BigInt(current.router.nativeEthBalanceRaw)-BigInt(previous.router.nativeEthBalanceRaw);
  const consolidatedDelta=BigInt(current.consolidated.ethTotalBalancedRaw)-BigInt(previous.consolidated.ethTotalBalancedRaw);
  return {
    eventCount:events.length,etherSweptCount,etherRequestedCount,
    sweptRaw:swept.toString(),sweptEth:round(units(swept)),sweptToRedemptionQueueRaw:sweptRq.toString(),sweptToRedemptionQueueEth:round(units(sweptRq)),sweptToDepositAmoRaw:sweptAmo.toString(),sweptToDepositAmoEth:round(units(sweptAmo)),sweptToOtherRaw:sweptOther.toString(),sweptToOtherEth:round(units(sweptOther)),
    requestedToRecipientRaw:requested.toString(),requestedToRecipientEth:round(units(requested)),requestedToRedemptionQueueRaw:requestedRq.toString(),requestedToRedemptionQueueEth:round(units(requestedRq)),
    eventReportedOutflowRaw:eventReportedOutflow.toString(),eventReportedOutflowEth:round(units(eventReportedOutflow)),routerNativeBalanceDeltaRaw:nativeDelta.toString(),routerNativeBalanceDeltaEth:round(units(nativeDelta)),consolidatedEthTotalBalancedDeltaRaw:consolidatedDelta.toString(),consolidatedEthTotalBalancedDeltaEth:round(units(consolidatedDelta)),
    destinations:[...destinations.values()].map(row=>({...row,amountRaw:row.amountRaw.toString(),amountEth:round(units(row.amountRaw))})).sort((a,b)=>b.amountEth-a.amountEth||a.address.localeCompare(b.address))
  };
}

function cumulative(previousMeasurement,interval,previousBlock){
  const prior=previousMeasurement?.measurementClass==='MEASURED'&&previousMeasurement?.cumulativeSinceTracking&&Number(previousMeasurement?.interval?.toBlockNumber)===Number(previousBlock)?previousMeasurement.cumulativeSinceTracking:null;
  const rawKeys=['sweptRaw','sweptToRedemptionQueueRaw','sweptToDepositAmoRaw','sweptToOtherRaw','requestedToRecipientRaw','requestedToRedemptionQueueRaw','eventReportedOutflowRaw'];
  const out={trackingStartBlock:prior?.trackingStartBlock??Number(previousBlock),throughBlock:interval.toBlockNumber,continuousFromTrackingStart:Boolean(prior)||!previousMeasurement};
  for(const key of rawKeys){const raw=(prior?.[key]!==undefined?BigInt(prior[key]):0n)+BigInt(interval.summary[key]);out[key]=raw.toString();out[key.replace(/Raw$/,'Eth')]=round(units(raw));}
  out.etherSweptCount=Number(prior?.etherSweptCount||0)+interval.summary.etherSweptCount;
  out.etherRequestedCount=Number(prior?.etherRequestedCount||0)+interval.summary.etherRequestedCount;
  return out;
}

export async function collectFraxFrxEthV2EtherRouterFlow({registry=null,rpcRegistry=null,fetchImpl=fetch,currentEtherRouterMeasurement,previousEtherRouterMeasurement,previousMeasurement=null}={}){
  const source=validateFraxFrxEthEtherRouterFlowRegistry(registry||readJson(REGISTRY_FILE));
  const currentError=checkpointError(currentEtherRouterMeasurement,'current',source.operations.etherRouter),previousError=checkpointError(previousEtherRouterMeasurement,'previous',source.operations.etherRouter);
  if(currentError||previousError)return unknown(source,`UNKNOWN-warming-${currentError||previousError}`);
  const current=currentEtherRouterMeasurement,previous=previousEtherRouterMeasurement,currentBlock=BigInt(current.blockNumber),previousBlock=BigInt(previous.blockNumber);
  if(currentBlock<=previousBlock)return unknown(source,'UNKNOWN-warming-adjacent-checkpoint-not-newer');
  const rpc=rpcRegistry||readJson(RPC_REGISTRY_FILE),network=rpc?.networks?.ethereum,endpoints=Array.isArray(network?.rpcFailover)?network.rpcFailover:[],attempts=[];
  if(Number(network?.chainId)!==1||!endpoints.length)throw new Error('Ethereum RPC registry unavailable');
  const router=source.operations.etherRouter;
  for(const endpoint of endpoints){
    try{
      const signatureRows=await post(endpoint.url,[
        {jsonrpc:'2.0',id:1,method:'eth_getBlockByNumber',params:[current.blockTag,false]},
        {jsonrpc:'2.0',id:2,method:'eth_getCode',params:[router,current.blockTag]},
        {jsonrpc:'2.0',id:10,method:'web3_sha3',params:[asciiHex('EtherSwept(address,uint256)')]},
        {jsonrpc:'2.0',id:11,method:'web3_sha3',params:[asciiHex('EtherRequested(address,uint256,uint256)')]}
      ],fetchImpl);
      const block=signatureRows.get(1).result;
      if(String(block?.hash||'').toLowerCase()!==String(current.blockHash).toLowerCase()||Number(quantity(block?.number))!==Number(current.blockNumber))throw new Error('Current EtherRouter block identity drift');
      const code=String(signatureRows.get(2).result||'');if(!/^0x[0-9a-f]+$/i.test(code)||code==='0x'||code==='0x0')throw new Error('EtherRouter deployed code missing');
      const topic=id=>String(signatureRows.get(id).result||'').toLowerCase();const topics={etherSwept:topic(10),etherRequested:topic(11)};for(const value of Object.values(topics))if(!/^0x[0-9a-f]{64}$/.test(value))throw new Error('EtherRouter event signature hash invalid');
      const logs=await postOne(endpoint.url,{jsonrpc:'2.0',id:20,method:'eth_getLogs',params:[{address:router,fromBlock:hexQuantity(previousBlock+1n),toBlock:current.blockTag,topics:[[topics.etherSwept,topics.etherRequested]]}]},fetchImpl);
      if(!Array.isArray(logs)||logs.length>MAX_EVENTS)throw new Error(`EtherRouter flow event window exceeds cap ${MAX_EVENTS}`);
      const events=logs.map(log=>{if(normalize(log?.address)!==normalize(router))throw new Error('EtherRouter flow log address drift');const b=quantity(log.blockNumber);if(b<=previousBlock||b>currentBlock)throw new Error('EtherRouter flow log escaped adjacent checkpoint window');return decodeLog(log,topics,current);}).sort((a,b)=>a.blockNumber-b.blockNumber||a.logIndex-b.logIndex);
      const summary=summarize(events,current,previous);
      const interval={fromBlockExclusive:Number(previousBlock),fromBlockHash:previous.blockHash,toBlockNumber:Number(currentBlock),toBlockHash:current.blockHash,eventQueryComplete:true,summary};
      const recentPrior=Array.isArray(previousMeasurement?.recentEvents)?previousMeasurement.recentEvents:[],recentEvents=[...recentPrior,...events].filter((row,index,rows)=>rows.findIndex(x=>eventKey(x)===eventKey(row))===index).slice(-MAX_EVENTS);
      return {
        version:FRAX_FRXETH_V2_ETHER_ROUTER_FLOW_VERSION,status:'ok',measurementClass:'MEASURED',observedAt:current.observedAt,network:'ethereum',chainId:1,blockNumber:Number(currentBlock),blockTag:current.blockTag,blockHash:current.blockHash,
        sourceBinding:{officialSourceRepo:source.sources.officialSourceRepo,officialSourceCommit:source.sources.officialSourceCommit,etherRouterSource:'src/contracts/ether-router/EtherRouter.sol',eventSurface:['EtherSwept(address,uint256)','EtherRequested(address,uint256,uint256)']},
        router:{address:router,currentPointers:{lendingPool:current.router.lendingPool,redemptionQueue:current.router.redemptionQueue,depositToAmoAddr:current.router.depositToAmoAddr},currentNativeEthBalanceRaw:current.router.nativeEthBalanceRaw,currentNativeEthBalance:current.router.nativeEthBalance,currentConsolidatedEthTotalBalancedRaw:current.consolidated.ethTotalBalancedRaw,currentConsolidatedEthTotalBalanced:current.consolidated.ethTotalBalanced},
        interval,cumulativeSinceTracking:cumulative(previousMeasurement,interval,Number(previousBlock)),recentEvents,
        rpc:{endpointId:endpoint.id,failoverAttempts:attempts,reusedCurrentEtherRouterCheckpoint:true,reusedPreviousEtherRouterCheckpoint:true,ethGetLogsTransport:'single-request-not-batched'},
        epistemic:{sourceType:'onchain-public-rpc-adjacent-checkpoint-event-accounting',realizedOutboundRouting:'MEASURED-EtherSwept-plus-EtherRequested-events',routingMechanics:'SOURCE-PINNED-sweep-prioritizes-redemption-queue-shortage-then-current-deposit-AMO-and-requestEther-can-pull-from-AMOs-for-lendingPool-or-redemptionQueue',inboundRouting:'PARTIAL-source-proven-depositEther-and-receive-accept-ETH-without-routing-events',fullFlowReconciliation:'UNKNOWN-inbound-depositEther-receive-have-no-complete-event-surface-and-consolidated-AMO-value-can-change',withdrawalFeeToSpecificOutflow:'UNKNOWN-fungible-router-balance-not-traceable-to-later-outflow-with-this-evidence',protocolRevenue:'UNKNOWN-routing-is-capital-movement-not-net-revenue',validatorPerformance:'UNKNOWN-not-measured-by-this-atom',stakingRewards:'UNKNOWN-not-measured-by-this-atom',companyCashFlow:'UNKNOWN-not-measured-by-this-atom',unknownIsZero:false,causalClaimAuthority:'none',executionAuthority:'none'}
      };
    }catch(error){attempts.push({endpointId:endpoint?.id||null,error:String(error instanceof Error?error.message:error).slice(0,240)});}
  }
  return unknown(source,attempts.length?`UNKNOWN-${attempts.at(-1).error.replace(/\s+/g,'-').slice(0,180)}`:'UNKNOWN-no-rpc-attempts',attempts);
}

function rebuildRelationships(current){const surfaces=Object.values(current?.surfaces||{});current.relationshipGraph=surfaces.flatMap(item=>(Array.isArray(item?.mechanicalRelations)?item.mechanicalRelations:[]).map((relation,index)=>({surfaceId:item.id,index,...relation})));current.coverage.relationshipCount=current.relationshipGraph.length;current.coverage.relationshipClassCounts=current.relationshipGraph.reduce((acc,r)=>{const key=String(r.class||'UNKNOWN').split('-')[0];acc[key]=(acc[key]||0)+1;return acc;},{});}

export function applyFraxFrxEthV2EtherRouterFlow({state,measurement}){
  if(!state||typeof state!=='object')throw new Error('Frax frxETH V2 EtherRouter flow adapter requires Economic Graph state');
  if(state?.authority?.executionAuthority!=='none'||state?.authority?.causalClaimAuthority!=='none')throw new Error('Frax EtherRouter flow adapter refuses Graph authority drift');
  const evidence=state?.protocolEvidence?.[FRAX_ECOSYSTEM_EVIDENCE_ID],current=evidence?.latest?.observation;if(!current||current.protocolId!==FRAX_PROTOCOL_ID)throw new Error('Frax EtherRouter flow adapter requires Frax ecosystem observation');
  const surface=current?.surfaces?.[FRAX_FRXETH_SURFACE_KEY];if(!surface||!String(surface.measurementState||'').startsWith('MEASURED'))throw new Error('Frax EtherRouter flow adapter requires measured frxETH surface');
  if(!surface?.measured?.v2Internals?.etherRouter)throw new Error('Frax EtherRouter flow adapter requires EtherRouter current-state atom');
  const before={surfaceCount:current.coverage.surfaceCount,measuredSurfaceCount:current.coverage.measuredSurfaceCount,sourceBoundUnknownSurfaceCount:current.coverage.sourceBoundUnknownSurfaceCount};
  surface.measured.v2Internals.etherRouterFlow=measurement;surface.measured.epistemic=surface.measured.epistemic||{};
  const measured=measurement?.status==='ok'&&measurement?.measurementClass==='MEASURED'&&measurement?.interval?.eventQueryComplete===true;
  surface.measured.epistemic.etherRouterRealizedOutboundRouting=measured?'MEASURED-adjacent-checkpoint-EtherSwept-plus-EtherRequested':'UNKNOWN';
  surface.measured.epistemic.etherRouterInboundRouting='PARTIAL-source-proven-no-complete-event-surface';
  surface.measured.epistemic.etherRouterFullFlowReconciliation='UNKNOWN';
  surface.measured.epistemic.etherRouterProtocolRevenue='UNKNOWN-routing-is-not-net-revenue';
  surface.measured.epistemic.executionAuthority='none';
  current.epistemic.frxEthV2EtherRouterRealizedOutboundRouting=surface.measured.epistemic.etherRouterRealizedOutboundRouting;
  current.epistemic.frxEthV2EtherRouterFullFlowReconciliation='UNKNOWN';current.epistemic.frxEthV2EtherRouterProtocolRevenue='UNKNOWN';
  surface.mechanicalRelations=(surface.mechanicalRelations||[]).filter(x=>x?.extension!=='frxeth-v2-ether-router-flow');
  surface.mechanicalRelations.push(
    {from:'EtherRouter EtherSwept events',to:'RedemptionQueue / current deposit AMO / other realized destinations',class:measured?'MEASURED-event-routing':'UNKNOWN',extension:'frxeth-v2-ether-router-flow',note:'Event amounts are realized outbound ETH routing; destination classification uses current exact-block pointers.'},
    {from:'EtherRouter EtherRequested events',to:'requested recipient + RedemptionQueue shortage routing',class:measured?'MEASURED-event-routing':'UNKNOWN',extension:'frxeth-v2-ether-router-flow',note:'Pinned source restricts requestEther caller to LendingPool or RedemptionQueue and may source ETH from AMOs.'},
    {from:'depositEther() / receive() ETH inflows',to:'EtherRouter native balance',class:'SOURCE-PINNED-PARTIAL-no-complete-event-surface',extension:'frxeth-v2-ether-router-flow',note:'Inbound ETH is accepted without a dedicated routing event, so full interval reconciliation remains UNKNOWN.'},
    {from:'ValidatorPool withdrawal fee routed to EtherRouter',to:'later EtherRouter outbound routing',class:'ASSOCIATED-fungible-balance-NOT-attributed',extension:'frxeth-v2-ether-router-flow',note:'Source proves the fee enters EtherRouter, but this atom does not claim that any later swept/requested ETH is that specific fee.'}
  );
  current.measurementExtensions={...(current.measurementExtensions||{}),frxEthV2EtherRouterFlow:FRAX_FRXETH_V2_ETHER_ROUTER_FLOW_VERSION};
  current.nextMeasurementUnlocks=(current.nextMeasurementUnlocks||[]).filter(x=>!String(x).startsWith('Backfill frxETH V2 EtherRouter routing history'));
  current.nextMeasurementUnlocks.push('Backfill frxETH V2 EtherRouter routing history before the tracking boundary; separately prove AMO-level composition/income and transaction-level links before promoting any routing to protocol revenue or company cash flow.');
  if(current.coverage.surfaceCount!==before.surfaceCount||current.coverage.measuredSurfaceCount!==before.measuredSurfaceCount||current.coverage.sourceBoundUnknownSurfaceCount!==before.sourceBoundUnknownSurfaceCount)throw new Error('frxETH V2 EtherRouter flow sub-atom must not change top-level Frax coverage');
  rebuildRelationships(current);current.authority={...(current.authority||{}),causalClaimAuthority:'none',executionAuthority:'none'};
  current.id=`frax-ecosystem:${sha256(stableStringify({baseObservationId:current.id||null,extension:FRAX_FRXETH_V2_ETHER_ROUTER_FLOW_VERSION,blockHash:measurement?.blockHash||null,eventReportedOutflow:measurement?.interval?.summary?.eventReportedOutflowRaw||null,fullFlowReconciliation:'UNKNOWN',protocolRevenue:'UNKNOWN',executionAuthority:'none'})).slice(0,16)}`;
  evidence.latest={observedAt:current.observedAt,observation:current};const observations=Array.isArray(evidence.observations)?evidence.observations:[];evidence.observations=[...observations,current].slice(-MAX_OBSERVATIONS);evidence.observationCount=evidence.observations.length;evidence.status=current.status;
  const sensor=state?.protocolSensors?.[FRAX_PROTOCOL_ID];if(sensor){sensor.ecosystemFamily=sensor.ecosystemFamily||{};sensor.ecosystemFamily.measurementExtensions=current.measurementExtensions;sensor.ecosystemFamily.coverage=current.coverage;sensor.ecosystemFamily.latestEvidenceId=current.id;sensor.epistemic={...(sensor.epistemic||{}),frxEthV2EtherRouterFlow:measured?'MEASURED':'UNKNOWN',executionAuthority:'none'};}
  if(current.authority.executionAuthority!=='none')throw new Error('Frax EtherRouter flow execution authority drift');return current;
}
