#!/usr/bin/env node
import assert from 'node:assert/strict';
import { collectFraxFrxEthV2ValidatorPoolCreditCurrentState, applyFraxFrxEthV2ValidatorPoolCreditCurrentState } from './frax-frxeth-v2-validator-pool-credit-current-state.mjs';
import registry from './frax-frxeth-registry.json' with { type:'json' };

const E18=10n**18n;
const BLOCK=21_404_300n;
const BLOCK_TAG=`0x${BLOCK.toString(16)}`;
const EVENT_TOPIC='0x2d81fbec11dcf80f26bdc0b2eb671b417a7bf920ac5545fe3ae32639f2395af8';
const POOL_A='0x1111111111111111111111111111111111111111';
const POOL_B='0x2222222222222222222222222222222222222222';
const OWNER_A='0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const OWNER_B='0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

function word(value){return BigInt(value).toString(16).padStart(64,'0');}
function bool(value){return word(value?1n:0n);}
function addressWord(address){return String(address).toLowerCase().replace(/^0x/,'').padStart(64,'0');}
function words(...values){return `0x${values.map(word).join('')}`;}
function addresses(...values){return `0x${values.map(addressWord).join('')}`;}
function quantity(value){return `0x${BigInt(value).toString(16)}`;}
function rpcRegistry(){return {networks:{ethereum:{chainId:1,rpcFailover:[{id:'first-fails',url:'https://first.invalid'},{id:'second-ok',url:'https://second.invalid'}]}}};}
function historyRpcRegistry(){return {version:'0.1-frxeth-validator-pool-history-rpc',network:'ethereum',chainId:1,endpoints:[{id:'history-ok',url:'https://history.invalid',capability:'synthetic-complete-history',source:'synthetic',authority:'discovery-only'}],semantics:{eventHistoryDiscoveryOnly:true,currentStateAuthority:false,priceAuthority:false,candidateIdentityRequiresExactBlockReproof:true,completeHistoryRequiredForMeasuredRegistry:true,unknownIsNotZero:true,executionAuthority:'none'}};}
function sigHash(selector){return `${selector}${'0'.repeat(56)}`;}
const SIGS={
  'validatorPoolAccounts(address)':'0x11111111',
  'wouldBeSolvent(address,bool,uint256,uint256)':'0x22222222',
  'owner()':'0x33333333',
  'lendingPool()':'0x44444444',
  'getAmountBorrowed()':'0x55555555',
  'getAmountAndSharesBorrowedStored()':'0x66666666',
  'DEFAULT_CREDIT_PER_VALIDATOR_I48_E12()':'0x77777777',
  'MAXIMUM_CREDIT_PER_VALIDATOR_I48_E12()':'0x88888888',
  'MISSING_CREDPERVAL_MULT()':'0x99999999'
};
function decodeAscii(hex){return Buffer.from(String(hex).replace(/^0x/,''),'hex').toString('utf8');}
function calldataAddress(data){return `0x${String(data).slice(10+24,10+64)}`.toLowerCase();}
function deploymentLog({owner,pool,block,index}){return {address:registry.operations.lendingPool,topics:[EVENT_TOPIC],data:addresses(owner,pool),blockNumber:quantity(block),logIndex:quantity(index),transactionHash:`0x${String(index+1).padStart(64,'0')}`};}
const DEPLOYMENTS=[deploymentLog({owner:OWNER_A,pool:POOL_A,block:21_404_240n,index:0}),deploymentLog({owner:OWNER_B,pool:POOL_B,block:21_404_250n,index:1})];

function makeFetch({allFail=false,block=BLOCK}={}){
  return async (url,options)=>{
    if(allFail||url.includes('first.invalid'))throw new Error('synthetic rpc outage');
    const parsed=JSON.parse(options.body),isBatch=Array.isArray(parsed),payload=isBatch?parsed:[parsed];
    if(url.includes('history.invalid')&&payload.some(req=>req.method!=='eth_getLogs'))throw new Error('history transport must never receive current-state calls');
    if(url.includes('second.invalid')&&payload.some(req=>req.method==='eth_getLogs'))return {ok:false,status:403,async json(){throw new Error('should not decode 403');}};
    const rows=payload.map(req=>{
      if(req.method==='eth_blockNumber')return {jsonrpc:'2.0',id:req.id,result:quantity(block)};
      if(req.method==='eth_getBlockByNumber')return {jsonrpc:'2.0',id:req.id,result:{number:req.params[0],timestamp:'0x65920080',hash:`0x${'ab'.repeat(32)}`}};
      if(req.method==='web3_sha3'){
        const signature=decodeAscii(req.params[0]);if(signature==='VPoolDeployed(address,address)')return {jsonrpc:'2.0',id:req.id,result:EVENT_TOPIC};
        const selector=SIGS[signature];if(!selector)throw new Error(`unexpected signature ${signature}`);return {jsonrpc:'2.0',id:req.id,result:sigHash(selector)};
      }
      if(req.method==='eth_getLogs'){
        assert.ok(url.includes('history.invalid'),'deep history must use discovery-only transport after primary 403');
        const filter=req.params[0],from=BigInt(filter.fromBlock),to=BigInt(filter.toBlock);
        if(to-from+1n>30n)return {jsonrpc:'2.0',id:req.id,error:{code:-32005,message:'block range too wide for synthetic archive provider'}};
        const logs=DEPLOYMENTS.filter(row=>{const b=BigInt(row.blockNumber);return b>=from&&b<=to&&b<=block;});return {jsonrpc:'2.0',id:req.id,result:logs};
      }
      if(req.method==='eth_getCode')return {jsonrpc:'2.0',id:req.id,result:'0x6001600055'};
      if(req.method==='eth_getBalance'){
        const target=String(req.params[0]).toLowerCase();const balance=target===POOL_A?3n*E18:target===POOL_B?2n*E18:0n;return {jsonrpc:'2.0',id:req.id,result:quantity(balance)};
      }
      if(req.method!=='eth_call')throw new Error(`unexpected ${req.method}`);
      assert.ok(url.includes('second.invalid'),'current exact-block calls must remain on canonical current-state RPC');assert.equal(req.params[1],quantity(block));
      const target=String(req.params[0].to).toLowerCase(),data=String(req.params[0].data).toLowerCase(),selector=data.slice(0,10);
      if(target===registry.operations.lendingPool.toLowerCase()){
        if(selector===SIGS['DEFAULT_CREDIT_PER_VALIDATOR_I48_E12()'])return {jsonrpc:'2.0',id:req.id,result:words(24_000_000_000_000n)};
        if(selector===SIGS['MAXIMUM_CREDIT_PER_VALIDATOR_I48_E12()'])return {jsonrpc:'2.0',id:req.id,result:words(31_000_000_000_000n)};
        if(selector===SIGS['MISSING_CREDPERVAL_MULT()'])return {jsonrpc:'2.0',id:req.id,result:words(1_000_000n)};
        const pool=calldataAddress(data);
        if(selector===SIGS['validatorPoolAccounts(address)']){
          if(pool===POOL_A)return {jsonrpc:'2.0',id:req.id,result:`0x${bool(true)}${bool(false)}${word(0)}${word(2)}${word(24_000_000_000_000n)}${word(10n*E18)}${word(20n*E18)}`};
          if(pool===POOL_B)return {jsonrpc:'2.0',id:req.id,result:`0x${bool(true)}${bool(false)}${word(0)}${word(1)}${word(30_000_000_000_000n)}${word(5n*E18)}${word(0)}`};
        }
        if(selector===SIGS['wouldBeSolvent(address,bool,uint256,uint256)']){
          if(pool===POOL_A)return {jsonrpc:'2.0',id:req.id,result:words(1,20n*E18,48n*E18)};
          if(pool===POOL_B)return {jsonrpc:'2.0',id:req.id,result:words(1,0,30n*E18)};
        }
      }
      if(target===POOL_A||target===POOL_B){
        if(selector===SIGS['owner()'])return {jsonrpc:'2.0',id:req.id,result:`0x${addressWord(target===POOL_A?OWNER_A:OWNER_B)}`};
        if(selector===SIGS['lendingPool()'])return {jsonrpc:'2.0',id:req.id,result:`0x${addressWord(registry.operations.lendingPool)}`};
        if(selector===SIGS['getAmountBorrowed()'])return {jsonrpc:'2.0',id:req.id,result:words(target===POOL_A?20n*E18:0n)};
        if(selector===SIGS['getAmountAndSharesBorrowedStored()'])return {jsonrpc:'2.0',id:req.id,result:words(target===POOL_A?19n*E18:0n,target===POOL_A?20n*E18:0n)};
      }
      throw new Error(`unexpected call ${target} ${selector}`);
    });
    return {ok:true,status:200,async json(){return isBatch?rows:rows[0];}};
  };
}

function baseState(){
  const surface={id:'frxeth-sfrxeth',measurementState:'MEASURED-current-onchain-partial',measured:{v2Internals:{lendingPool:{status:'ok'},redemptionQueue:{status:'ok'}},epistemic:{executionAuthority:'none'}},mechanicalRelations:[]};
  const observation={id:'frax-ecosystem:base',protocolId:'registry-frax-vefrax',status:'deep-sensor-family-fully-measured',authority:{executionAuthority:'none',causalClaimAuthority:'none'},epistemic:{executionAuthority:'none',measuredEconomicSurfaces:['frxeth-sfrxeth']},coverage:{surfaceCount:11,measuredSurfaceCount:11,sourceBoundUnknownSurfaceCount:0,relationshipCount:0,relationshipClassCounts:{}},surfaces:{frxEthSfrxEth:surface},relationshipGraph:[],scopeExtensions:{frxEth:{version:'0.1'}},measurementExtensions:{frxEthCurrentState:'0.1',frxEthV2LendingPoolCurrentState:'0.1',frxEthV2RedemptionQueueCurrentState:'0.1'},nextMeasurementUnlocks:['Measure frxETH V2 ValidatorPool deployment registry, credit, borrow allowance, live debt and solvency from exact-block source-pinned state.']};
  return {generatedAt:'2026-08-29T15:15:00.000Z',authority:{executionAuthority:'none',causalClaimAuthority:'none'},protocolEvidence:{'registry-frax-ecosystem':{latest:{observation},observations:[observation],observationCount:1,status:observation.status}},protocolSensors:{'registry-frax-vefrax':{ecosystemFamily:{measurementExtensions:{...observation.measurementExtensions}},epistemic:{executionAuthority:'none'}}}};
}

const measured=await collectFraxFrxEthV2ValidatorPoolCreditCurrentState({registry,rpcRegistry:rpcRegistry(),historyRpcRegistry:historyRpcRegistry(),fetchImpl:makeFetch(),checkpoint:{blockTag:BLOCK_TAG}});
assert.equal(measured.status,'ok');assert.equal(measured.measurementClass,'MEASURED');assert.equal(measured.rpc.endpointId,'second-ok');assert.equal(measured.rpc.reusedCheckpoint,true);
assert.equal(measured.rpc.logDiscovery.transport,'public-history-rpc-failover');assert.equal(measured.rpc.logDiscovery.endpointId,'history-ok');assert.equal(measured.rpc.logDiscovery.endpointRole,'dedicated-history-rpc');assert.equal(measured.rpc.logDiscovery.failoverAttempts.length,1);assert.equal(measured.rpc.logDiscovery.failoverAttempts[0].endpointId,'second-ok');assert.match(measured.rpc.logDiscovery.failoverAttempts[0].error,/403/);assert.equal(measured.rpc.logDiscovery.providerTransport,'single-request-full-range-first');assert.ok(measured.rpc.logDiscovery.adaptiveSplitCount>0);assert.ok(measured.rpc.logDiscovery.requestCount>1);assert.ok(measured.rpc.logDiscovery.smallestSuccessfulSpanBlocks<=30);
assert.equal(measured.epistemic.currentStateAuthorityEndpoint,'second-ok');assert.equal(measured.epistemic.historyTransportAuthority,'discovery-only');assert.equal(measured.epistemic.candidateIdentityReproof,'MEASURED-current-code-pointer-account-arithmetic');
assert.equal(measured.coverage.completeVPoolDeployedHistory,true);assert.equal(measured.summary.deployedPoolCount,2);assert.equal(measured.summary.initializedPoolCount,2);assert.equal(measured.summary.totalValidatorCount,3);assert.equal(measured.summary.totalCreditEth,78);assert.equal(measured.summary.totalLiveBorrowEth,20);assert.equal(measured.summary.totalBorrowAllowanceEth,15);assert.equal(measured.summary.totalNativePoolBalanceEth,5);assert.equal(measured.summary.activeBorrowingPoolCount,1);assert.equal(measured.summary.insolventPoolCount,0);assert.equal(measured.validatorPools[0].solvency.mechanicalParity,true);assert.equal(measured.validatorPools[0].solvency.creditUtilizationPct,41.66666667);assert.equal(measured.epistemic.stakingRewards,'UNKNOWN-native-balance-is-not-reward-attribution');assert.equal(measured.epistemic.protocolRevenue,'UNKNOWN-not-measured-by-this-atom');assert.equal(measured.epistemic.executionAuthority,'none');

const state=baseState();applyFraxFrxEthV2ValidatorPoolCreditCurrentState({state,measurement:measured});const obs=state.protocolEvidence['registry-frax-ecosystem'].latest.observation,surface=obs.surfaces.frxEthSfrxEth;
assert.equal(obs.coverage.surfaceCount,11);assert.equal(obs.coverage.measuredSurfaceCount,11);assert.equal(obs.coverage.sourceBoundUnknownSurfaceCount,0);assert.equal(surface.measured.v2Internals.validatorPoolCredit.summary.totalValidatorCount,3);assert.equal(surface.measured.epistemic.validatorPoolCredit,'MEASURED-plus-DERIVED-source-formula-parity');assert.equal(surface.measured.epistemic.stakingRewards,'UNKNOWN-native-balance-is-not-reward-attribution');assert.equal(obs.epistemic.frxEthV2ValidatorPoolRegistry,'MEASURED-VPoolDeployed-history');assert.equal(obs.epistemic.frxEthV2ValidatorPerformance,'UNKNOWN');assert.match(obs.nextMeasurementUnlocks[0],/BeaconOracle/);assert.equal(obs.authority.executionAuthority,'none');

const increment=await collectFraxFrxEthV2ValidatorPoolCreditCurrentState({registry,rpcRegistry:rpcRegistry(),historyRpcRegistry:historyRpcRegistry(),fetchImpl:makeFetch({block:BLOCK+1n}),checkpoint:{blockTag:quantity(BLOCK+1n)},previousMeasurement:measured});
assert.equal(increment.status,'ok');assert.equal(increment.rpc.incrementalDiscovery,true);assert.equal(increment.coverage.deployedPoolCount,2);assert.equal(increment.coverage.newPoolsDiscoveredThisRun,0);assert.equal(increment.rpc.logDiscovery.transport,'public-history-rpc-failover');assert.equal(increment.rpc.logDiscovery.endpointId,'history-ok');assert.equal(increment.rpc.logDiscovery.adaptiveSplitCount,0);

const unavailable=await collectFraxFrxEthV2ValidatorPoolCreditCurrentState({registry,rpcRegistry:rpcRegistry(),historyRpcRegistry:historyRpcRegistry(),fetchImpl:makeFetch({allFail:true}),checkpoint:{blockTag:BLOCK_TAG}});assert.match(unavailable.status,/^UNKNOWN/);assert.equal(unavailable.measurementClass,'UNKNOWN');
const state2=baseState();applyFraxFrxEthV2ValidatorPoolCreditCurrentState({state:state2,measurement:unavailable});assert.equal(state2.protocolEvidence['registry-frax-ecosystem'].latest.observation.epistemic.frxEthV2ValidatorPoolRegistry,'UNKNOWN');assert.equal(state2.protocolEvidence['registry-frax-ecosystem'].latest.observation.authority.executionAuthority,'none');

console.log('FRAX frxETH V2 VALIDATOR POOL CREDIT CANARY PASS',{blockNumber:measured.blockNumber,deployedPools:measured.summary.deployedPoolCount,validators:measured.summary.totalValidatorCount,totalCreditEth:measured.summary.totalCreditEth,totalBorrowEth:measured.summary.totalLiveBorrowEth,activeBorrowingPools:measured.summary.activeBorrowingPoolCount,currentStateRpc:measured.rpc.endpointId,historyRpc:measured.rpc.logDiscovery.endpointId,historyRole:measured.rpc.logDiscovery.endpointRole,providerTransport:measured.rpc.logDiscovery.providerTransport,adaptiveSplits:measured.rpc.logDiscovery.adaptiveSplitCount,stakingRewards:measured.epistemic.stakingRewards,executionAuthority:obs.authority.executionAuthority});