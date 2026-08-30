#!/usr/bin/env node
/**
 * The Holding · Frax frxETH V2 lending / withdrawal flow v0.1
 *
 * Adjacent-checkpoint event accounting for the current LendingPool. The atom
 * measures accrued borrower interest and ValidatorPool withdrawal-fee flow,
 * while keeping protocol revenue, validator rewards and company cash flow
 * explicitly UNKNOWN. AddInterest fee return fields are retained as raw event
 * evidence only: in the pinned source they are declared but not assigned by
 * _addInterest, so they are not promoted into revenue semantics.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const FRAX_FRXETH_V2_LENDING_FLOW_VERSION='0.1-frxeth-v2-lending-withdrawal-flow-adjacent-checkpoint';
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
function topicAddress(topic){const x=String(topic||'').replace(/^0x/,'');if(x.length!==64||!/^[0-9a-f]+$/i.test(x))throw new Error('Invalid indexed address topic');return `0x${x.slice(24)}`;}
function quantity(hex){if(!/^0x[0-9a-f]+$/i.test(String(hex||'')))throw new Error('Invalid RPC quantity');return BigInt(hex);}
function hexQuantity(value){return `0x${BigInt(value).toString(16)}`;}
function units(raw){const sign=raw<0n?'-':'';const n=raw<0n?-raw:raw,whole=n/E18,fraction=(n%E18).toString().padStart(18,'0').replace(/0+$/,'');return Number(`${sign}${whole}${fraction?'.'+fraction:''}`);}
function round(value,digits=12){const n=Number(value);return Number.isFinite(n)?Number(n.toFixed(digits)):null;}
function eventKey(row){return `${String(row.txHash||'').toLowerCase()}:${row.logIndex}`;}

export function validateFraxFrxEthLendingFlowRegistry(registry){
  if(registry?.version!=='0.1-frxeth-current-state-registry'||registry?.network!=='ethereum'||Number(registry?.chainId)!==1)throw new Error('frxETH lending-flow registry identity drift');
  if(!validAddress(registry?.operations?.lendingPool)||!validAddress(registry?.operations?.etherRouter))throw new Error('frxETH lending-flow operation addresses invalid');
  if(registry?.sources?.officialSourceRepo!=='FraxFinance/frxETH-v2-public'||registry?.sources?.officialSourceCommit!==EXPECTED_SOURCE_COMMIT)throw new Error('frxETH lending-flow source pin drift');
  if(registry?.epistemic?.unknownIsZero!==false||registry?.epistemic?.executionAuthority!=='none'||registry?.epistemic?.causalClaimAuthority!=='none')throw new Error('frxETH lending-flow epistemic boundary drift');
  return registry;
}

function validateLendingMeasurement(measurement,label,expectedAddress){
  if(measurement?.status!=='ok'||measurement?.measurementClass!=='MEASURED'||Number(measurement?.chainId)!==1)throw new Error(`${label} LendingPool measurement unavailable`);
  if(!Number.isSafeInteger(Number(measurement?.blockNumber))||!/^0x[0-9a-f]+$/i.test(String(measurement?.blockTag||''))||!/^0x[0-9a-f]{64}$/i.test(String(measurement?.blockHash||'')))throw new Error(`${label} LendingPool checkpoint invalid`);
  if(normalize(measurement?.lendingPool?.address)!==normalize(expectedAddress))throw new Error(`${label} LendingPool identity drift`);
  if(!/^\d+$/.test(String(measurement?.lendingPool?.interestAccrued?.raw||'')))throw new Error(`${label} LendingPool interest counter unavailable`);
  return measurement;
}

async function post(url,payload,fetchImpl){
  const response=await fetchImpl(url,{method:'POST',headers:{'content-type':'application/json',accept:'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(RPC_TIMEOUT_MS)});
  if(!response.ok)throw new Error(`RPC HTTP ${response.status}`);
  const body=await response.json();if(!Array.isArray(body))throw new Error('RPC response is not an array');
  const byId=new Map(body.map(row=>[Number(row?.id),row]));
  for(const req of payload){const row=byId.get(req.id);if(!row)throw new Error(`RPC result ${req.id} missing`);if(row.error)throw new Error(`RPC ${req.method} error: ${row.error?.message||'unknown error'}`);if(row.result===undefined||row.result===null)throw new Error(`RPC ${req.method} result missing`);}
  return byId;
}

function unknown(source,reason,attempts=[]){return {
  version:FRAX_FRXETH_V2_LENDING_FLOW_VERSION,status:reason,measurementClass:'UNKNOWN',observedAt:null,network:'ethereum',chainId:1,blockNumber:null,blockTag:null,blockHash:null,
  lendingPool:{address:source?.operations?.lendingPool||null,vPoolWithdrawalFee:null,maxWithdrawalFee:null},interval:null,cumulativeSinceTracking:null,recentEvents:[],rpc:{endpointId:null,failoverAttempts:attempts},
  epistemic:{sourceType:'onchain-public-rpc-adjacent-checkpoint-event-accounting',lendingInterestAccrual:'UNKNOWN',withdrawalFeeFlow:'UNKNOWN',reportedAddInterestFeeFields:'UNKNOWN',protocolRevenue:'UNKNOWN',validatorPerformance:'UNKNOWN',stakingRewards:'UNKNOWN',companyCashFlow:'UNKNOWN',unknownIsZero:false,causalClaimAuthority:'none',executionAuthority:'none'}
};}

function decodeLog(log,topics){
  const topic0=String(log?.topics?.[0]||'').toLowerCase(),base={blockNumber:Number(quantity(log.blockNumber)),txHash:String(log.transactionHash||'').toLowerCase(),logIndex:Number(quantity(log.logIndex))};
  if(topic0===topics.addInterest){
    if((log.topics||[]).length!==1||cleanHex(log.data).length!==4*64)throw new Error('AddInterest ABI drift');
    return {...base,type:'AddInterest',interestEarnedRaw:decodeWord(log.data,0).toString(),rateRaw:decodeWord(log.data,1).toString(),reportedFeesAmountRaw:decodeWord(log.data,2).toString(),reportedFeesShareRaw:decodeWord(log.data,3).toString()};
  }
  if(topic0===topics.withdrawalRegistered){
    if((log.topics||[]).length!==2||cleanHex(log.data).length!==3*64)throw new Error('WithdrawalRegistered ABI drift');
    return {...base,type:'WithdrawalRegistered',validatorPool:topicAddress(log.topics[1]),endRecipient:decodeAddress(log.data,0),sentBackAmountRaw:decodeWord(log.data,1).toString(),feeAmountRaw:decodeWord(log.data,2).toString()};
  }
  if(topic0===topics.borrow){
    if((log.topics||[]).length!==2||cleanHex(log.data).length!==2*64)throw new Error('Borrow ABI drift');
    return {...base,type:'Borrow',validatorPool:topicAddress(log.topics[1]),recipient:decodeAddress(log.data,0),amountRaw:decodeWord(log.data,1).toString()};
  }
  if(topic0===topics.repay){
    if((log.topics||[]).length!==2||cleanHex(log.data).length!==2*64)throw new Error('Repay ABI drift');
    return {...base,type:'Repay',payor:topicAddress(log.topics[1]),targetPool:decodeAddress(log.data,0),amountRaw:decodeWord(log.data,1).toString()};
  }
  throw new Error(`Unexpected LendingPool event topic ${topic0}`);
}

function summarize(events){
  let interest=0n,reportedFees=0n,reportedFeeShares=0n,withdrawalFees=0n,withdrawnNet=0n,borrow=0n,repay=0n;
  let addInterestCount=0,withdrawalCount=0,borrowCount=0,repayCount=0;
  for(const event of events){
    if(event.type==='AddInterest'){addInterestCount++;interest+=BigInt(event.interestEarnedRaw);reportedFees+=BigInt(event.reportedFeesAmountRaw);reportedFeeShares+=BigInt(event.reportedFeesShareRaw);}
    else if(event.type==='WithdrawalRegistered'){withdrawalCount++;withdrawalFees+=BigInt(event.feeAmountRaw);withdrawnNet+=BigInt(event.sentBackAmountRaw);}
    else if(event.type==='Borrow'){borrowCount++;borrow+=BigInt(event.amountRaw);}
    else if(event.type==='Repay'){repayCount++;repay+=BigInt(event.amountRaw);}
  }
  return {eventCount:events.length,addInterestCount,withdrawalCount,borrowCount,repayCount,interestEarnedRaw:interest.toString(),interestEarnedEth:round(units(interest)),reportedFeesAmountRaw:reportedFees.toString(),reportedFeesAmountEth:round(units(reportedFees)),reportedFeesShareRaw:reportedFeeShares.toString(),withdrawalFeeRaw:withdrawalFees.toString(),withdrawalFeeEth:round(units(withdrawalFees)),withdrawnNetRaw:withdrawnNet.toString(),withdrawnNetEth:round(units(withdrawnNet)),borrowRaw:borrow.toString(),borrowEth:round(units(borrow)),repayRaw:repay.toString(),repayEth:round(units(repay)),netBorrowFlowRaw:(borrow-repay).toString(),netBorrowFlowEth:round(units(borrow-repay))};
}

function cumulative(previous,interval,previousBlock){
  const prior=previous?.measurementClass==='MEASURED'&&previous?.cumulativeSinceTracking&&Number(previous?.interval?.toBlockNumber)===Number(previousBlock)?previous.cumulativeSinceTracking:null;
  const keys=['interestEarnedRaw','reportedFeesAmountRaw','withdrawalFeeRaw','withdrawnNetRaw','borrowRaw','repayRaw'];
  const out={trackingStartBlock:prior?.trackingStartBlock??Number(previousBlock),throughBlock:interval.toBlockNumber,continuousFromTrackingStart:Boolean(prior)||!previous};
  for(const key of keys){const raw=(prior?.[key]!==undefined?BigInt(prior[key]):0n)+BigInt(interval.summary[key]);out[key]=raw.toString();out[key.replace(/Raw$/,'Eth')]=round(units(raw));}
  out.addInterestCount=Number(prior?.addInterestCount||0)+interval.summary.addInterestCount;
  out.withdrawalCount=Number(prior?.withdrawalCount||0)+interval.summary.withdrawalCount;
  out.borrowCount=Number(prior?.borrowCount||0)+interval.summary.borrowCount;
  out.repayCount=Number(prior?.repayCount||0)+interval.summary.repayCount;
  return out;
}

export async function collectFraxFrxEthV2LendingFlowCurrentState({registry=null,rpcRegistry=null,fetchImpl=fetch,currentLendingPoolMeasurement,previousLendingPoolMeasurement,previousMeasurement=null}={}){
  const source=validateFraxFrxEthLendingFlowRegistry(registry||readJson(REGISTRY_FILE));
  const current=validateLendingMeasurement(currentLendingPoolMeasurement,'Current',source.operations.lendingPool),previous=validateLendingMeasurement(previousLendingPoolMeasurement,'Previous',source.operations.lendingPool);
  const currentBlock=BigInt(current.blockNumber),previousBlock=BigInt(previous.blockNumber);if(currentBlock<=previousBlock)throw new Error('Lending-flow requires a newer exact block');
  const currentInterest=BigInt(current.lendingPool.interestAccrued.raw),previousInterest=BigInt(previous.lendingPool.interestAccrued.raw);if(currentInterest<previousInterest)throw new Error('LendingPool interestAccrued counter regressed');
  const expectedInterestDelta=currentInterest-previousInterest;
  const rpc=rpcRegistry||readJson(RPC_REGISTRY_FILE),network=rpc?.networks?.ethereum,endpoints=Array.isArray(network?.rpcFailover)?network.rpcFailover:[],attempts=[];if(Number(network?.chainId)!==1||!endpoints.length)throw new Error('Ethereum RPC registry unavailable');
  const lendingPool=source.operations.lendingPool;
  for(const endpoint of endpoints){
    try{
      const signatureRows=await post(endpoint.url,[
        {jsonrpc:'2.0',id:1,method:'eth_getBlockByNumber',params:[current.blockTag,false]},
        {jsonrpc:'2.0',id:2,method:'eth_getCode',params:[lendingPool,current.blockTag]},
        {jsonrpc:'2.0',id:10,method:'web3_sha3',params:[asciiHex('vPoolWithdrawalFee()')]},
        {jsonrpc:'2.0',id:11,method:'web3_sha3',params:[asciiHex('MAX_WITHDRAWAL_FEE()')]},
        {jsonrpc:'2.0',id:20,method:'web3_sha3',params:[asciiHex('AddInterest(uint256,uint256,uint256,uint256)')]},
        {jsonrpc:'2.0',id:21,method:'web3_sha3',params:[asciiHex('WithdrawalRegistered(address,address,uint256,uint256)')]},
        {jsonrpc:'2.0',id:22,method:'web3_sha3',params:[asciiHex('Borrow(address,address,uint256)')]},
        {jsonrpc:'2.0',id:23,method:'web3_sha3',params:[asciiHex('Repay(address,address,uint256)')]}
      ],fetchImpl);
      const block=signatureRows.get(1).result;if(String(block?.hash||'').toLowerCase()!==String(current.blockHash).toLowerCase()||Number(quantity(block?.number))!==Number(current.blockNumber))throw new Error('Current LendingPool block identity drift');
      const code=String(signatureRows.get(2).result||'');if(!/^0x[0-9a-f]+$/i.test(code)||code==='0x'||code==='0x0')throw new Error('LendingPool deployed code missing');
      const hash=id=>String(signatureRows.get(id).result||'').toLowerCase();for(const id of [10,11,20,21,22,23])if(!/^0x[0-9a-f]{64}$/.test(hash(id)))throw new Error(`web3_sha3 signature ${id} invalid`);
      const selectors={withdrawalFee:hash(10).slice(0,10),maxWithdrawalFee:hash(11).slice(0,10)};
      const topics={addInterest:hash(20),withdrawalRegistered:hash(21),borrow:hash(22),repay:hash(23)};
      const stateAndLogs=await post(endpoint.url,[
        {jsonrpc:'2.0',id:30,method:'eth_call',params:[{to:lendingPool,data:selectors.withdrawalFee},current.blockTag]},
        {jsonrpc:'2.0',id:31,method:'eth_call',params:[{to:lendingPool,data:selectors.maxWithdrawalFee},current.blockTag]},
        {jsonrpc:'2.0',id:40,method:'eth_getLogs',params:[{address:lendingPool,fromBlock:hexQuantity(previousBlock+1n),toBlock:current.blockTag,topics:[[topics.addInterest,topics.withdrawalRegistered,topics.borrow,topics.repay]]}]}
      ],fetchImpl);
      const withdrawalFee=decodeWord(stateAndLogs.get(30).result),maxWithdrawalFee=decodeWord(stateAndLogs.get(31).result);if(maxWithdrawalFee!==3000n||withdrawalFee>maxWithdrawalFee)throw new Error('ValidatorPool withdrawal fee source/live bound drift');
      const logs=stateAndLogs.get(40).result;if(!Array.isArray(logs)||logs.length>MAX_EVENTS)throw new Error(`Lending-flow event window exceeds cap ${MAX_EVENTS}`);
      const events=logs.map(log=>{if(normalize(log?.address)!==normalize(lendingPool))throw new Error('Lending-flow log address drift');const b=quantity(log.blockNumber);if(b<=previousBlock||b>currentBlock)throw new Error('Lending-flow log escaped adjacent checkpoint window');return decodeLog(log,topics);}).sort((a,b)=>a.blockNumber-b.blockNumber||a.logIndex-b.logIndex);
      const summary=summarize(events),eventInterest=BigInt(summary.interestEarnedRaw),interestCounterParity=eventInterest===expectedInterestDelta;if(!interestCounterParity)throw new Error(`AddInterest event/counter parity failed: events=${eventInterest} counterDelta=${expectedInterestDelta}`);
      const interval={fromBlockExclusive:Number(previousBlock),fromBlockHash:previous.blockHash,toBlockNumber:Number(currentBlock),toBlockHash:current.blockHash,eventQueryComplete:true,interestCounterDeltaRaw:expectedInterestDelta.toString(),interestCounterDeltaEth:round(units(expectedInterestDelta)),interestEventCounterParity:true,summary};
      const recentPrior=Array.isArray(previousMeasurement?.recentEvents)?previousMeasurement.recentEvents:[],recentEvents=[...recentPrior,...events].filter((row,index,rows)=>rows.findIndex(x=>eventKey(x)===eventKey(row))===index).slice(-MAX_EVENTS);
      return {
        version:FRAX_FRXETH_V2_LENDING_FLOW_VERSION,status:'ok',measurementClass:'MEASURED',observedAt:current.observedAt,network:'ethereum',chainId:1,blockNumber:Number(currentBlock),blockTag:current.blockTag,blockHash:current.blockHash,
        sourceBinding:{officialSourceRepo:source.sources.officialSourceRepo,officialSourceCommit:source.sources.officialSourceCommit,lendingPoolCoreSource:'src/contracts/lending-pool/LendingPoolCore.sol',lendingPoolSource:'src/contracts/lending-pool/LendingPool.sol',validatorPoolSource:'src/contracts/ValidatorPool.sol',etherRouterSource:'src/contracts/ether-router/EtherRouter.sol'},
        lendingPool:{address:lendingPool,vPoolWithdrawalFee:{raw:withdrawalFee.toString(),pct:round(Number(withdrawalFee)/10_000,6),precisionRaw:'1000000'},maxWithdrawalFee:{raw:maxWithdrawalFee.toString(),pct:0.3}},
        interval,cumulativeSinceTracking:cumulative(previousMeasurement,interval,Number(previousBlock)),recentEvents,
        rpc:{endpointId:endpoint.id,failoverAttempts:attempts,reusedCurrentLendingCheckpoint:true,reusedPreviousLendingCheckpoint:true},
        epistemic:{sourceType:'onchain-public-rpc-adjacent-checkpoint-event-accounting',lendingInterestAccrual:'MEASURED-AddInterest-event-plus-interestAccrued-counter-parity',interestCashRealization:'UNKNOWN-accrual-is-not-cash-receipt',withdrawalFeeFlow:'MEASURED-WithdrawalRegistered-event-amount-plus-SOURCE-PINNED-ValidatorPool-to-EtherRouter-route',withdrawalFeeEconomicRole:'ATTRIBUTED-source-comment-cost-recovery-for-slippage-LP-fees-and-beacon-gas-not-profit',reportedAddInterestFeeFields:'MEASURED-raw-event-fields-NOT-PROMOTED-pinned-_addInterest-does-not-assign-fee-returns',protocolRevenue:'UNKNOWN-interest-accrual-and-cost-recovery-fees-are-not-sufficient-for-net-protocol-revenue',validatorPerformance:'UNKNOWN-not-measured-by-this-atom',stakingRewards:'UNKNOWN-not-measured-by-this-atom',companyCashFlow:'UNKNOWN-not-measured-by-this-atom',unknownIsZero:false,causalClaimAuthority:'none',executionAuthority:'none'}
      };
    }catch(error){attempts.push({endpointId:endpoint?.id||null,error:String(error instanceof Error?error.message:error).slice(0,240)});}
  }
  return unknown(source,attempts.length?`UNKNOWN-${attempts.at(-1).error.replace(/\s+/g,'-').slice(0,180)}`:'UNKNOWN-no-rpc-attempts',attempts);
}

function rebuildRelationships(current){const surfaces=Object.values(current?.surfaces||{});current.relationshipGraph=surfaces.flatMap(item=>(Array.isArray(item?.mechanicalRelations)?item.mechanicalRelations:[]).map((relation,index)=>({surfaceId:item.id,index,...relation})));current.coverage.relationshipCount=current.relationshipGraph.length;current.coverage.relationshipClassCounts=current.relationshipGraph.reduce((acc,r)=>{const key=String(r.class||'UNKNOWN').split('-')[0];acc[key]=(acc[key]||0)+1;return acc;},{});}

export function applyFraxFrxEthV2LendingFlowCurrentState({state,measurement}){
  if(!state||typeof state!=='object')throw new Error('Frax frxETH V2 lending-flow adapter requires Economic Graph state');if(state?.authority?.executionAuthority!=='none'||state?.authority?.causalClaimAuthority!=='none')throw new Error('Frax frxETH V2 lending-flow adapter refuses Graph authority drift');
  const evidence=state?.protocolEvidence?.[FRAX_ECOSYSTEM_EVIDENCE_ID],current=evidence?.latest?.observation;if(!current||current.protocolId!==FRAX_PROTOCOL_ID)throw new Error('Frax lending-flow adapter requires Frax ecosystem observation');const surface=current?.surfaces?.[FRAX_FRXETH_SURFACE_KEY];if(!surface||!String(surface.measurementState||'').startsWith('MEASURED'))throw new Error('Frax lending-flow adapter requires measured frxETH surface');
  if(!surface?.measured?.v2Internals?.lendingPool||!surface?.measured?.v2Internals?.validatorPoolCredit)throw new Error('Frax lending-flow adapter requires LendingPool and ValidatorPool credit atoms');
  const before={surfaceCount:current.coverage.surfaceCount,measuredSurfaceCount:current.coverage.measuredSurfaceCount,sourceBoundUnknownSurfaceCount:current.coverage.sourceBoundUnknownSurfaceCount};surface.measured.v2Internals.lendingFlow=measurement;surface.measured.epistemic=surface.measured.epistemic||{};
  const measured=measurement?.status==='ok'&&measurement?.measurementClass==='MEASURED'&&measurement?.interval?.interestEventCounterParity===true;
  surface.measured.epistemic.lendingInterestFlow=measured?'MEASURED-adjacent-checkpoint-events-with-counter-parity':'UNKNOWN';
  surface.measured.epistemic.validatorWithdrawalFeeFlow=measured?'MEASURED-event-amount-plus-SOURCE-PINNED-route-to-EtherRouter':'UNKNOWN';
  surface.measured.epistemic.lendingProtocolRevenue='UNKNOWN-not-proven-net-protocol-revenue';surface.measured.epistemic.companyCashFlow='UNKNOWN-not-measured-by-this-atom';surface.measured.epistemic.stakingRewards='UNKNOWN-not-measured-by-this-atom';surface.measured.epistemic.executionAuthority='none';
  current.epistemic.frxEthV2LendingInterestFlow=surface.measured.epistemic.lendingInterestFlow;current.epistemic.frxEthV2ValidatorWithdrawalFeeFlow=surface.measured.epistemic.validatorWithdrawalFeeFlow;current.epistemic.frxEthV2LendingProtocolRevenue='UNKNOWN';current.epistemic.frxEthV2CompanyCashFlow='UNKNOWN';
  surface.mechanicalRelations=(surface.mechanicalRelations||[]).filter(x=>x?.extension!=='frxeth-v2-lending-flow');surface.mechanicalRelations.push(
    {from:'LendingPool AddInterest.interestEarned events',to:'LendingPool interestAccrued delta',class:measured?'MEASURED-event-counter-parity':'UNKNOWN',extension:'frxeth-v2-lending-flow',note:'Accrued borrower interest claim only; not cash realization or net protocol revenue.'},
    {from:'ValidatorPool withdrawal fee',to:'LendingPool WithdrawalRegistered feeAmount',class:measured?'MEASURED-adjacent-checkpoint-event-flow':'UNKNOWN',extension:'frxeth-v2-lending-flow',note:'Exact event amount for successful withdrawal transactions.'},
    {from:'ValidatorPool.withdraw()',to:'EtherRouter ETH balance / AMO routing',class:measured?'SOURCE-PINNED-MECHANICAL-route':'UNKNOWN',extension:'frxeth-v2-lending-flow',note:'Pinned source sends the withdrawal fee to EtherRouter after registerWithdrawal; economic role is cost recovery, not proven profit.'},
    {from:'LendingPool Borrow / Repay events',to:'adjacent-checkpoint lending principal flow',class:measured?'MEASURED-event-flow':'UNKNOWN',extension:'frxeth-v2-lending-flow',note:'Mechanical activity context; no borrower intent or causal attribution.'}
  );
  current.measurementExtensions={...(current.measurementExtensions||{}),frxEthV2LendingFlowCurrentState:FRAX_FRXETH_V2_LENDING_FLOW_VERSION};
  current.nextMeasurementUnlocks=(current.nextMeasurementUnlocks||[]).filter(x=>!String(x).startsWith('Backfill frxETH V2 lending-flow history'));
  current.nextMeasurementUnlocks.push('Backfill frxETH V2 lending-flow history before the tracking boundary and separately prove downstream EtherRouter disposition, validator rewards and company cash flow.');
  if(current.coverage.surfaceCount!==before.surfaceCount||current.coverage.measuredSurfaceCount!==before.measuredSurfaceCount||current.coverage.sourceBoundUnknownSurfaceCount!==before.sourceBoundUnknownSurfaceCount)throw new Error('frxETH V2 lending-flow sub-atom must not change top-level Frax coverage');
  rebuildRelationships(current);current.authority={...(current.authority||{}),causalClaimAuthority:'none',executionAuthority:'none'};current.id=`frax-ecosystem:${sha256(stableStringify({baseObservationId:current.id||null,extension:FRAX_FRXETH_V2_LENDING_FLOW_VERSION,blockHash:measurement?.blockHash||null,interest:measurement?.interval?.summary?.interestEarnedRaw||null,withdrawalFee:measurement?.interval?.summary?.withdrawalFeeRaw||null,borrow:measurement?.interval?.summary?.borrowRaw||null,repay:measurement?.interval?.summary?.repayRaw||null,protocolRevenue:'UNKNOWN',executionAuthority:'none'})).slice(0,16)}`;
  evidence.latest={observedAt:current.observedAt,observation:current};const observations=Array.isArray(evidence.observations)?evidence.observations:[];evidence.observations=[...observations,current].slice(-MAX_OBSERVATIONS);evidence.observationCount=evidence.observations.length;evidence.status=current.status;
  const sensor=state?.protocolSensors?.[FRAX_PROTOCOL_ID];if(sensor){sensor.ecosystemFamily=sensor.ecosystemFamily||{};sensor.ecosystemFamily.measurementExtensions=current.measurementExtensions;sensor.ecosystemFamily.coverage=current.coverage;sensor.ecosystemFamily.latestEvidenceId=current.id;sensor.epistemic={...(sensor.epistemic||{}),frxEthV2LendingFlowCurrentState:measured?'MEASURED':'UNKNOWN',executionAuthority:'none'};}
  if(current.authority.executionAuthority!=='none')throw new Error('Frax lending-flow execution authority drift');return current;
}
