#!/usr/bin/env node
import assert from 'node:assert/strict';
import { applyFraxEcosystemSensor } from './frax-ecosystem-sensor.mjs';
import { applyFraxBammOnchainMeasurement } from './frax-bamm-onchain.mjs';
import { collectFraxswapTwamm,applyFraxswapTwamm } from './frax-fraxswap-twamm.mjs';

const E18=10n**18n;
const A={bamm:'0x1111111111111111111111111111111111111111',pair:'0x2222222222222222222222222222222222222222',token0:'0x3333333333333333333333333333333333333333',token1:'0x4444444444444444444444444444444444444444',user:'0x5555555555555555555555555555555555555555'};
const PREV_HASH=`0x${'aa'.repeat(32)}`,CURR_HASH=`0x${'bb'.repeat(32)}`;
const signatures=['fee()','getTwammState()','getNextOrderID()','VirtualOrderExecution(uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256)','LongTermSwap0To1(address,uint256,uint256,uint256)','LongTermSwap1To0(address,uint256,uint256,uint256)','CancelLongTermOrder(address,uint256,address,uint256,address,uint256)','WithdrawProceedsFromLongTermOrder(address,uint256,address,uint256,bool)','LpFeeUpdated(uint256)'];
const hashes=new Map(signatures.map((s,i)=>[s,`0x${(i+1).toString(16).padStart(8,'0')}${String(i+1).padStart(2,'0').repeat(28)}`]));
const topic=s=>hashes.get(s).toLowerCase(),selector=s=>topic(s).slice(0,10);
function u(v){return BigInt(v).toString(16).padStart(64,'0');}
function encU(v){return `0x${u(v)}`;}
function encWords(...v){return `0x${v.map(u).join('')}`;}
function addrWord(a){return BigInt(a);}
function topicAddr(v){return `0x${String(v).replace(/^0x/,'').toLowerCase().padStart(64,'0')}`;}
function tx(byte){return `0x${byte.repeat(64)}`;}
function log({block,index,event,data,topics=[],txh}){return {address:A.pair,blockNumber:`0x${block.toString(16)}`,logIndex:`0x${index.toString(16)}`,transactionHash:txh,topics:[topic(event),...topics],data};}
const virtual='VirtualOrderExecution(uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256)',long0='LongTermSwap0To1(address,uint256,uint256,uint256)',long1='LongTermSwap1To0(address,uint256,uint256,uint256)',cancel='CancelLongTermOrder(address,uint256,address,uint256,address,uint256)',withdraw='WithdrawProceedsFromLongTermOrder(address,uint256,address,uint256,bool)',feeUpdate='LpFeeUpdated(uint256)';
const logs=[
  log({block:101,index:1,event:virtual,data:encWords(1700000001n,60n,1000n,1000n,0n,0n,48n*E18,98n*E18,100n*E18,50n*E18),txh:tx('a')}),
  log({block:101,index:2,event:long0,data:encWords(10n,1000n*E18,4n),topics:[topicAddr(A.user)],txh:tx('b')}),
  log({block:102,index:1,event:long1,data:encWords(11n,500n*E18,2n),topics:[topicAddr(A.user)],txh:tx('c')}),
  log({block:102,index:2,event:cancel,data:encWords(10n,addrWord(A.token0),100n*E18,addrWord(A.token1),20n*E18),topics:[topicAddr(A.user)],txh:tx('d')}),
  log({block:102,index:3,event:withdraw,data:encWords(11n,25n*E18,0n),topics:[topicAddr(A.user),topicAddr(A.token0)],txh:tx('e')}),
  log({block:103,index:1,event:feeUpdate,data:encU(5n),txh:tx('f')}),
  log({block:103,index:2,event:virtual,data:encWords(1700000061n,60n,1000n,1000n,0n,0n,0n,198n*E18,200n*E18,0n),txh:tx('g')})
];

function makeFetch(){return async (_url,options)=>{
  const reqs=JSON.parse(options.body);const out=reqs.map(req=>{
    if(req.method==='web3_sha3'){const sig=Buffer.from(String(req.params[0]).slice(2),'hex').toString('utf8');if(!hashes.has(sig))throw new Error(`Unexpected sha3 ${sig}`);return {jsonrpc:'2.0',id:req.id,result:hashes.get(sig)};}
    if(req.method==='eth_getBlockByNumber'){const tag=req.params[0];if(tag==='0x64')return {jsonrpc:'2.0',id:req.id,result:{number:tag,timestamp:'0x6553f100',hash:PREV_HASH}};if(tag==='0x67')return {jsonrpc:'2.0',id:req.id,result:{number:tag,timestamp:'0x6553f106',hash:CURR_HASH}};throw new Error(`Unexpected block ${tag}`);}
    if(req.method==='eth_call'){
      const to=String(req.params[0].to).toLowerCase(),data=String(req.params[0].data).toLowerCase(),tag=req.params[1];
      if(to===A.pair.toLowerCase()&&data===selector('fee()'))return {jsonrpc:'2.0',id:req.id,result:encU(tag==='0x64'?9970n:9995n)};
      if(to===A.pair.toLowerCase()&&data===selector('getTwammState()'))return {jsonrpc:'2.0',id:req.id,result:tag==='0x64'?encWords(2_000_000n,1_000_000n,1_700_000_000n,3600n,10n,20n):encWords(3_000_000n,0n,1_700_000_061n,3600n,30n,40n)};
      if(to===A.pair.toLowerCase()&&data===selector('getNextOrderID()'))return {jsonrpc:'2.0',id:req.id,result:encU(tag==='0x64'?10n:12n)};
      if((to===A.token0.toLowerCase()||to===A.token1.toLowerCase())&&data==='0x313ce567')return {jsonrpc:'2.0',id:req.id,result:encU(18n)};
      throw new Error(`Unexpected eth_call ${to} ${data} ${tag}`);
    }
    if(req.method==='eth_getLogs'){const f=req.params[0],from=BigInt(f.fromBlock),to=BigInt(f.toBlock);return {jsonrpc:'2.0',id:req.id,result:logs.filter(x=>{const b=BigInt(x.blockNumber);return b>=from&&b<=to;})};}
    throw new Error(`Unexpected RPC method ${req.method}`);
  });return {ok:true,async json(){return out;}};
};}
function bammMeasurement({blockNumber,blockHash,observedAt}){return {version:'synthetic',status:'ok',measurementClass:'MEASURED',observedAt,chain:'fraxtal',chainId:252,blockNumber,blockTag:`0x${blockNumber.toString(16)}`,blockHash,contracts:{feeTo:'0x6666666666666666666666666666666666666666'},registry:{bammCount:1,allRegistryIdentitiesProven:true,activeRentedBammCount:1},bamms:[{bamm:A.bamm,pair:A.pair,token0:A.token0,token1:A.token1,raw:{utility:'100',borrowRatePerSecond:'200'},epistemic:{}}],rpc:{endpointId:'synthetic',failoverAttempts:[]},epistemic:{executionAuthority:'none'}};}
function baseState(generatedAt){return {generatedAt,authority:{executionAuthority:'none',causalClaimAuthority:'none'},protocolLifecycle:{summary:{protocolCount:8},protocols:{'registry-frax-vefrax':{maturityStage:'shadow'}}},protocolSensors:{'registry-frax-vefrax':{latest:{observation:{epistemic:{executionAuthority:'none'},identityBoundary:{currentCanonicalPrincipal:'FRAX',currentCanonicalVoteEscrowLabel:'veFRAX'},referenceProductivity:{currentAprPct:5.25},registryExposure:{companyCount:3,positionCount:3},longitudinalEvidence:{canonicalSnapshotCount:4,validatedNativePeriodCount:0}}}}}};}

const prevBamm=bammMeasurement({blockNumber:100,blockHash:PREV_HASH,observedAt:'2026-08-28T12:00:00.000Z'}),currBamm=bammMeasurement({blockNumber:103,blockHash:CURR_HASH,observedAt:'2026-08-28T12:00:06.000Z'});
const previous=baseState('2026-08-28T12:00:00.000Z');applyFraxEcosystemSensor({state:previous,previousState:null});applyFraxBammOnchainMeasurement({state:previous,previousState:null,measurement:prevBamm});
const current=baseState('2026-08-28T12:00:06.000Z');applyFraxEcosystemSensor({state:current,previousState:previous});applyFraxBammOnchainMeasurement({state:current,previousState:previous,measurement:currBamm});
const measurement=await collectFraxswapTwamm({currentBammMeasurement:currBamm,previousBammMeasurement:prevBamm,endpoints:[{id:'synthetic',url:'https://synthetic.invalid'}],fetchImpl:makeFetch()});
assert.equal(measurement.status,'ok');assert.equal(measurement.measurementClass,'MEASURED');assert.equal(measurement.coverage.fullRegistryInterval,true);assert.equal(measurement.summary.virtualExecutionEventCount,2);assert.equal(measurement.summary.newLongTermOrderCount,2);assert.equal(measurement.summary.cancelEventCount,1);assert.equal(measurement.summary.withdrawEventCount,1);assert.equal(measurement.summary.feeUpdateEventCount,1);
const row=measurement.pairs[0];assert.equal(row.state.start.nextOrderId,'10');assert.equal(row.state.end.nextOrderId,'12');assert.equal(row.values.token0SoldToken,'300');assert.equal(row.values.token1SoldToken,'50');assert.equal(row.values.newOrder0InputToken,'1000');assert.equal(row.values.newOrder1InputToken,'500');assert.equal(row.values.grossTwammFee0Token,'0.4');assert.equal(row.values.grossTwammFee1Token,'0.15');assert.equal(row.feeSchedule.startLpFeeBps,30);assert.equal(row.feeSchedule.endLpFeeBps,5);assert.equal(row.epistemic.ordinarySwapFlow,'EXCLUDED-separate-atom');
applyFraxswapTwamm({state:current,previousState:previous,measurement});const obs=current.protocolEvidence['registry-frax-ecosystem'].latest.observation;assert.match(obs.epistemic.fraxswapTwammFlow,/^MEASURED/);assert.equal(obs.epistemic.fraxswapFeeRecipientSplit,'UNKNOWN-until-_mintFee-feeTo-accounting');assert.equal(obs.authority.executionAuthority,'none');

console.log('FRAX FRAXSWAP TWAMM CANARY PASS',{from:measurement.interval.fromBlockExclusive,to:measurement.interval.toBlockInclusive,virtualExecutions:measurement.summary.virtualExecutionEventCount,newOrders:measurement.summary.newLongTermOrderCount,cancels:measurement.summary.cancelEventCount,withdraws:measurement.summary.withdrawEventCount,grossFee0Token:row.values.grossTwammFee0Token,grossFee1Token:row.values.grossTwammFee1Token,ordinarySwap:row.epistemic.ordinarySwapFlow,executionAuthority:obs.authority.executionAuthority});
