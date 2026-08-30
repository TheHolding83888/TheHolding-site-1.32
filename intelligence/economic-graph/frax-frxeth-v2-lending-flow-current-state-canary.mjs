#!/usr/bin/env node
import assert from 'node:assert/strict';
import { collectFraxFrxEthV2LendingFlowCurrentState, applyFraxFrxEthV2LendingFlowCurrentState } from './frax-frxeth-v2-lending-flow-current-state.mjs';
import registry from './frax-frxeth-registry.json' with { type:'json' };

const E18=10n**18n;
function word(v){return BigInt(v).toString(16).padStart(64,'0');}
function words(...values){return `0x${values.map(word).join('')}`;}
function addressWord(address){return String(address).toLowerCase().replace(/^0x/,'').padStart(64,'0');}
const hashes={
  'vPoolWithdrawalFee()':`0x11111111${'11'.repeat(28)}`,
  'MAX_WITHDRAWAL_FEE()':`0x22222222${'22'.repeat(28)}`,
  'AddInterest(uint256,uint256,uint256,uint256)':`0x${'33'.repeat(32)}`,
  'WithdrawalRegistered(address,address,uint256,uint256)':`0x${'44'.repeat(32)}`,
  'Borrow(address,address,uint256)':`0x${'55'.repeat(32)}`,
  'Repay(address,address,uint256)':`0x${'66'.repeat(32)}`
};
const pool='0x1000000000000000000000000000000000000001';
const recipient='0x2000000000000000000000000000000000000002';
const payor='0x3000000000000000000000000000000000000003';
function topicAddress(address){return `0x${addressWord(address)}`;}
function rpcRegistry(){return {networks:{ethereum:{chainId:1,rpcFailover:[{id:'first-fails',url:'https://first.invalid'},{id:'second-ok',url:'https://second.invalid'}]}}};}
function resultFor(req){
  if(req.method==='eth_getBlockByNumber')return {jsonrpc:'2.0',id:req.id,result:{number:'0x65',timestamp:'0x65920080',hash:`0x${'ab'.repeat(32)}`}};
  if(req.method==='eth_getCode')return {jsonrpc:'2.0',id:req.id,result:'0x6001600055'};
  if(req.method==='web3_sha3'){const sig=Buffer.from(req.params[0].slice(2),'hex').toString('utf8');return {jsonrpc:'2.0',id:req.id,result:hashes[sig]};}
  if(req.method==='eth_call'){
    if(req.params[0].data==='0x11111111')return {jsonrpc:'2.0',id:req.id,result:words(1000n)};
    if(req.params[0].data==='0x22222222')return {jsonrpc:'2.0',id:req.id,result:words(3000n)};
    throw new Error(`unexpected eth_call ${req.params[0].data}`);
  }
  if(req.method==='eth_getLogs')return {jsonrpc:'2.0',id:req.id,result:[
    {address:registry.operations.lendingPool,blockNumber:'0x65',transactionHash:`0x${'01'.repeat(32)}`,logIndex:'0x0',topics:[hashes['AddInterest(uint256,uint256,uint256,uint256)']],data:words(2n*E18,123n,0n,0n)},
    {address:registry.operations.lendingPool,blockNumber:'0x65',transactionHash:`0x${'02'.repeat(32)}`,logIndex:'0x1',topics:[hashes['WithdrawalRegistered(address,address,uint256,uint256)'],topicAddress(pool)],data:`0x${addressWord(recipient)}${word(99n*E18/10n)}${word(E18/10n)}`},
    {address:registry.operations.lendingPool,blockNumber:'0x65',transactionHash:`0x${'03'.repeat(32)}`,logIndex:'0x2',topics:[hashes['Borrow(address,address,uint256)'],topicAddress(pool)],data:`0x${addressWord(recipient)}${word(5n*E18)}`},
    {address:registry.operations.lendingPool,blockNumber:'0x65',transactionHash:`0x${'04'.repeat(32)}`,logIndex:'0x3',topics:[hashes['Repay(address,address,uint256)'],topicAddress(payor)],data:`0x${addressWord(pool)}${word(1n*E18)}`}
  ]};
  throw new Error(`unexpected ${req.method}`);
}
function makeFetch({allFail=false}={}){return async (url,options)=>{
  if(allFail||url.includes('first.invalid'))throw new Error('synthetic rpc outage');
  const payload=JSON.parse(options.body);
  if(Array.isArray(payload)){
    const rows=payload.map(resultFor);return {ok:true,async json(){return rows;}};
  }
  const row=resultFor(payload);return {ok:true,async json(){return row;}};
};}
function lending(block,interest,hashByte,observedAt){return {status:'ok',measurementClass:'MEASURED',chainId:1,blockNumber:block,blockTag:`0x${block.toString(16)}`,blockHash:`0x${hashByte.repeat(32)}`,observedAt,lendingPool:{address:registry.operations.lendingPool,interestAccrued:{raw:String(interest)}}};}
function baseState(){const surface={id:'frxeth-sfrxeth',measurementState:'MEASURED-current-onchain-partial',measured:{v2Internals:{lendingPool:{status:'ok'},validatorPoolCredit:{status:'ok'}},epistemic:{executionAuthority:'none'}},mechanicalRelations:[]};const observation={id:'frax-ecosystem:base',protocolId:'registry-frax-vefrax',status:'deep-sensor-family-fully-measured',authority:{executionAuthority:'none',causalClaimAuthority:'none'},epistemic:{executionAuthority:'none'},coverage:{surfaceCount:1,measuredSurfaceCount:1,sourceBoundUnknownSurfaceCount:0,relationshipCount:0,relationshipClassCounts:{}},surfaces:{frxEthSfrxEth:surface},relationshipGraph:[],measurementExtensions:{frxEthV2LendingPoolCurrentState:'0.1',frxEthV2ValidatorPoolCreditCurrentState:'0.1'},nextMeasurementUnlocks:[]};return {authority:{executionAuthority:'none',causalClaimAuthority:'none'},protocolEvidence:{'registry-frax-ecosystem':{latest:{observation},observations:[observation],observationCount:1,status:observation.status}},protocolSensors:{'registry-frax-vefrax':{ecosystemFamily:{},epistemic:{executionAuthority:'none'}}}};}

const previous=lending(100,10n*E18,'cd','2026-08-30T00:00:00.000Z');
const current=lending(101,12n*E18,'ab','2026-08-30T00:00:12.000Z');
const measured=await collectFraxFrxEthV2LendingFlowCurrentState({registry,rpcRegistry:rpcRegistry(),fetchImpl:makeFetch(),currentLendingPoolMeasurement:current,previousLendingPoolMeasurement:previous});
assert.equal(measured.status,'ok');assert.equal(measured.measurementClass,'MEASURED');assert.equal(measured.rpc.endpointId,'second-ok');assert.equal(measured.rpc.ethGetLogsTransport,'single-request-not-batched');assert.equal(measured.interval.interestEventCounterParity,true);assert.equal(measured.interval.summary.interestEarnedEth,2);assert.equal(measured.interval.summary.withdrawalFeeEth,0.1);assert.equal(measured.interval.summary.borrowEth,5);assert.equal(measured.interval.summary.repayEth,1);assert.equal(measured.interval.summary.netBorrowFlowEth,4);assert.equal(measured.lendingPool.vPoolWithdrawalFee.pct,0.1);assert.equal(measured.epistemic.protocolRevenue,'UNKNOWN-interest-accrual-and-cost-recovery-fees-are-not-sufficient-for-net-protocol-revenue');assert.equal(measured.epistemic.stakingRewards,'UNKNOWN-not-measured-by-this-atom');

const state=baseState();applyFraxFrxEthV2LendingFlowCurrentState({state,measurement:measured});const obs=state.protocolEvidence['registry-frax-ecosystem'].latest.observation;assert.equal(obs.coverage.surfaceCount,1);assert.equal(obs.coverage.measuredSurfaceCount,1);assert.equal(obs.epistemic.frxEthV2LendingInterestFlow,'MEASURED-adjacent-checkpoint-events-with-counter-parity');assert.equal(obs.epistemic.frxEthV2LendingProtocolRevenue,'UNKNOWN');assert.equal(obs.surfaces.frxEthSfrxEth.measured.epistemic.stakingRewards,'UNKNOWN-not-measured-by-this-atom');assert.equal(obs.authority.executionAuthority,'none');assert.ok(obs.surfaces.frxEthSfrxEth.mechanicalRelations.some(x=>x.extension==='frxeth-v2-lending-flow'));

const priorMeasurement={measurementClass:'MEASURED',interval:{toBlockNumber:100},cumulativeSinceTracking:{trackingStartBlock:90,interestEarnedRaw:String(3n*E18),reportedFeesAmountRaw:'0',withdrawalFeeRaw:String(E18/5n),withdrawnNetRaw:String(20n*E18),borrowRaw:String(7n*E18),repayRaw:String(2n*E18),addInterestCount:2,withdrawalCount:1,borrowCount:1,repayCount:1},recentEvents:[]};
const accumulated=await collectFraxFrxEthV2LendingFlowCurrentState({registry,rpcRegistry:rpcRegistry(),fetchImpl:makeFetch(),currentLendingPoolMeasurement:current,previousLendingPoolMeasurement:previous,previousMeasurement:priorMeasurement});assert.equal(accumulated.cumulativeSinceTracking.trackingStartBlock,90);assert.equal(accumulated.cumulativeSinceTracking.interestEarnedEth,5);assert.equal(accumulated.cumulativeSinceTracking.withdrawalFeeEth,0.3);assert.equal(accumulated.cumulativeSinceTracking.continuousFromTrackingStart,true);

const unavailable=await collectFraxFrxEthV2LendingFlowCurrentState({registry,rpcRegistry:rpcRegistry(),fetchImpl:makeFetch({allFail:true}),currentLendingPoolMeasurement:current,previousLendingPoolMeasurement:previous});assert.match(unavailable.status,/^UNKNOWN/);assert.equal(unavailable.measurementClass,'UNKNOWN');assert.equal(unavailable.epistemic.protocolRevenue,'UNKNOWN');
console.log('FRAX frxETH V2 LENDING / WITHDRAWAL FLOW CANARY PASS',{interestEarnedEth:measured.interval.summary.interestEarnedEth,withdrawalFeeEth:measured.interval.summary.withdrawalFeeEth,netBorrowFlowEth:measured.interval.summary.netBorrowFlowEth,withdrawalFeeRatePct:measured.lendingPool.vPoolWithdrawalFee.pct,protocolRevenue:measured.epistemic.protocolRevenue,executionAuthority:obs.authority.executionAuthority});
