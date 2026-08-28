#!/usr/bin/env node
import assert from 'node:assert/strict';
import { applyFraxEcosystemSensor } from './frax-ecosystem-sensor.mjs';
import { applyFraxBammOnchainMeasurement } from './frax-bamm-onchain.mjs';
import { collectFraxswapFlowFees,applyFraxswapFlowFees } from './frax-fraxswap-flow-fees.mjs';

const E18=10n**18n;
const A={bamm:'0x1111111111111111111111111111111111111111',pair:'0x2222222222222222222222222222222222222222',token0:'0x3333333333333333333333333333333333333333',token1:'0x4444444444444444444444444444444444444444'};
const PREV_HASH=`0x${'aa'.repeat(32)}`,CURR_HASH=`0x${'bb'.repeat(32)}`;
const FEE_HASH=`0x12345678${'00'.repeat(28)}`,FEE_SELECTOR=FEE_HASH.slice(0,10),SWAP_TOPIC=`0x${'11'.repeat(32)}`,FEE_TOPIC=`0x${'22'.repeat(32)}`;
function u(v){return BigInt(v).toString(16).padStart(64,'0');}
function encU(v){return `0x${u(v)}`;}
function encWords(...v){return `0x${v.map(u).join('')}`;}
function topicAddr(v){return `0x${String(v).replace(/^0x/,'').toLowerCase().padStart(64,'0')}`;}
function tx(byte){return `0x${byte.repeat(64)}`;}
function log({block,index,topic,data,txh,sender=A.bamm,to=A.pair}){return {address:A.pair,blockNumber:`0x${block.toString(16)}`,logIndex:`0x${index.toString(16)}`,transactionHash:txh,topics:topic===SWAP_TOPIC?[topic,topicAddr(sender),topicAddr(to)]:[topic],data};}
const syntheticLogs=[
  log({block:101,index:1,topic:SWAP_TOPIC,data:encWords(100n*E18,0n,0n,95n*E18),txh:tx('c')}),
  log({block:102,index:2,topic:FEE_TOPIC,data:encU(5n),txh:tx('d')}),
  log({block:103,index:3,topic:SWAP_TOPIC,data:encWords(0n,200n*E18,190n*E18,0n),txh:tx('e')})
];

function makeFetch(){return async (_url,options)=>{
  const reqs=JSON.parse(options.body);const out=reqs.map(req=>{
    if(req.method==='web3_sha3'){
      const sig=Buffer.from(String(req.params[0]).slice(2),'hex').toString('utf8');
      if(sig==='fee()')return {jsonrpc:'2.0',id:req.id,result:FEE_HASH};
      if(sig==='Swap(address,uint256,uint256,uint256,uint256,address)')return {jsonrpc:'2.0',id:req.id,result:SWAP_TOPIC};
      if(sig==='LpFeeUpdated(uint256)')return {jsonrpc:'2.0',id:req.id,result:FEE_TOPIC};
      throw new Error(`Unexpected sha3 signature ${sig}`);
    }
    if(req.method==='eth_getBlockByNumber'){
      const tag=req.params[0];
      if(tag==='0x64')return {jsonrpc:'2.0',id:req.id,result:{number:tag,timestamp:'0x65920080',hash:PREV_HASH}};
      if(tag==='0x67')return {jsonrpc:'2.0',id:req.id,result:{number:tag,timestamp:'0x65920086',hash:CURR_HASH}};
      throw new Error(`Unexpected block ${tag}`);
    }
    if(req.method==='eth_call'){
      const to=String(req.params[0].to).toLowerCase(),data=String(req.params[0].data).toLowerCase(),tag=req.params[1];
      if(to===A.pair.toLowerCase()&&data===FEE_SELECTOR.toLowerCase())return {jsonrpc:'2.0',id:req.id,result:encU(tag==='0x64'?9970n:9995n)};
      if((to===A.token0.toLowerCase()||to===A.token1.toLowerCase())&&data==='0x313ce567')return {jsonrpc:'2.0',id:req.id,result:encU(18n)};
      throw new Error(`Unexpected eth_call ${to} ${data} ${tag}`);
    }
    if(req.method==='eth_getLogs'){
      const f=req.params[0],from=BigInt(f.fromBlock),to=BigInt(f.toBlock);return {jsonrpc:'2.0',id:req.id,result:syntheticLogs.filter(x=>{const b=BigInt(x.blockNumber);return b>=from&&b<=to;})};
    }
    throw new Error(`Unexpected RPC method ${req.method}`);
  });
  return {ok:true,async json(){return out;}};
};}

function bammMeasurement({blockNumber,blockHash,observedAt}){return {
  version:'synthetic',status:'ok',measurementClass:'MEASURED',observedAt,chain:'fraxtal',chainId:252,blockNumber,blockTag:`0x${blockNumber.toString(16)}`,blockHash,
  contracts:{feeTo:'0x5555555555555555555555555555555555555555'},registry:{bammCount:1,allRegistryIdentitiesProven:true,activeRentedBammCount:1},
  bamms:[{bamm:A.bamm,pair:A.pair,token0:A.token0,token1:A.token1,raw:{utility:'100',borrowRatePerSecond:'200'},epistemic:{}}],rpc:{endpointId:'synthetic',failoverAttempts:[]},epistemic:{executionAuthority:'none'}
};}
function baseState(generatedAt){return {generatedAt,authority:{executionAuthority:'none',causalClaimAuthority:'none'},protocolLifecycle:{summary:{protocolCount:8},protocols:{'registry-frax-vefrax':{maturityStage:'shadow'}}},protocolSensors:{'registry-frax-vefrax':{latest:{observation:{epistemic:{executionAuthority:'none'},identityBoundary:{currentCanonicalPrincipal:'FRAX',currentCanonicalVoteEscrowLabel:'veFRAX'},referenceProductivity:{currentAprPct:5.25},registryExposure:{companyCount:3,positionCount:3},longitudinalEvidence:{canonicalSnapshotCount:4,validatedNativePeriodCount:0}}}}}};}

const prevBamm=bammMeasurement({blockNumber:100,blockHash:PREV_HASH,observedAt:'2026-08-28T12:00:00.000Z'}),currBamm=bammMeasurement({blockNumber:103,blockHash:CURR_HASH,observedAt:'2026-08-28T12:00:06.000Z'});
const previous=baseState('2026-08-28T12:00:00.000Z');applyFraxEcosystemSensor({state:previous,previousState:null});applyFraxBammOnchainMeasurement({state:previous,previousState:null,measurement:prevBamm});
const current=baseState('2026-08-28T12:00:06.000Z');applyFraxEcosystemSensor({state:current,previousState:previous});applyFraxBammOnchainMeasurement({state:current,previousState:previous,measurement:currBamm});
const measurement=await collectFraxswapFlowFees({currentBammMeasurement:currBamm,previousBammMeasurement:prevBamm,endpoints:[{id:'synthetic',url:'https://synthetic.invalid'}],fetchImpl:makeFetch()});
assert.equal(measurement.status,'ok');assert.equal(measurement.measurementClass,'MEASURED');assert.equal(measurement.coverage.fullRegistryInterval,true);assert.equal(measurement.summary.regularSwapEventCount,2);assert.equal(measurement.summary.feeUpdateEventCount,1);
const row=measurement.pairs[0];assert.equal(row.interval.swapCount,2);assert.equal(row.feeSchedule.startLpFeeBps,30);assert.equal(row.feeSchedule.endLpFeeBps,5);assert.equal(row.values.amount0InToken,'100');assert.equal(row.values.amount1InToken,'200');assert.equal(row.values.grossFee0Token,'0.3');assert.equal(row.values.grossFee1Token,'0.1');assert.equal(row.epistemic.twammFlow,'EXCLUDED-separate-mechanism');
applyFraxswapFlowFees({state:current,previousState:previous,measurement});const obs=current.protocolEvidence['registry-frax-ecosystem'].latest.observation;assert.match(obs.epistemic.fraxswapVolumeFees,/^MEASURED/);assert.equal(obs.epistemic.fraxswapTwammFlow,'UNKNOWN-separate-mechanism-not-in-regular-Swap-events');assert.equal(obs.authority.executionAuthority,'none');

console.log('FRAX FRAXSWAP FLOW + FEE CANARY PASS',{from:measurement.interval.fromBlockExclusive,to:measurement.interval.toBlockInclusive,swapEvents:measurement.summary.regularSwapEventCount,feeUpdates:measurement.summary.feeUpdateEventCount,grossFee0Token:row.values.grossFee0Token,grossFee1Token:row.values.grossFee1Token,twamm:row.epistemic.twammFlow,executionAuthority:obs.authority.executionAuthority});
