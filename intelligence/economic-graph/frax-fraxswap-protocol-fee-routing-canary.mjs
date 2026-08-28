#!/usr/bin/env node
import assert from 'node:assert/strict';
import { applyFraxEcosystemSensor } from './frax-ecosystem-sensor.mjs';
import { collectFraxswapProtocolFeeRouting,applyFraxswapProtocolFeeRouting } from './frax-fraxswap-protocol-fee-routing.mjs';
import { FRAXSWAP_FACTORY_FRAXTAL } from './frax-bamm-onchain.mjs';

const E18=10n**18n,ZERO='0x0000000000000000000000000000000000000000';
const A={pair:'0x1111111111111111111111111111111111111111',token0:'0x2222222222222222222222222222222222222222',token1:'0x3333333333333333333333333333333333333333',feeTo:'0x4444444444444444444444444444444444444444',user:'0x5555555555555555555555555555555555555555',sender:'0x6666666666666666666666666666666666666666'};
const PREV_HASH=`0x${'aa'.repeat(32)}`,CURR_HASH=`0x${'bb'.repeat(32)}`;
const sigs=['feeTo()','allPairsLength()','allPairs(uint256)','factory()','token0()','token1()','kLast()','totalSupply()','balanceOf(address)','Transfer(address,address,uint256)','Mint(address,uint256,uint256)','Burn(address,uint256,uint256,address)'];
const H=Object.fromEntries(sigs.map((s,i)=>[s,`0x${(i+1).toString(16).padStart(8,String((i+1)%10))}${String(i+1).padStart(56,'0').slice(0,56)}`.slice(0,66)]));
function u(v){return BigInt(v).toString(16).padStart(64,'0');}
function encU(v){return `0x${u(v)}`;}
function encWords(...v){return `0x${v.map(u).join('')}`;}
function encAddr(v){return `0x${String(v).replace(/^0x/,'').toLowerCase().padStart(64,'0')}`;}
function topicAddr(v){return encAddr(v);}
function tx(byte){return `0x${byte.repeat(64)}`;}
function log({block,index,topic,data,topics=[],txh}){return {address:A.pair,blockNumber:`0x${block.toString(16)}`,logIndex:`0x${index.toString(16)}`,transactionHash:txh,topics:[topic,...topics],data};}
const logs=[
  log({block:101,index:1,topic:H['Transfer(address,address,uint256)'],topics:[topicAddr(ZERO),topicAddr(A.feeTo)],data:encU(5n*E18),txh:tx('a')}),
  log({block:101,index:2,topic:H['Transfer(address,address,uint256)'],topics:[topicAddr(ZERO),topicAddr(A.user)],data:encU(100n*E18),txh:tx('a')}),
  log({block:101,index:3,topic:H['Mint(address,uint256,uint256)'],topics:[topicAddr(A.sender)],data:encWords(10n*E18,20n*E18),txh:tx('a')}),
  log({block:102,index:1,topic:H['Transfer(address,address,uint256)'],topics:[topicAddr(ZERO),topicAddr(A.feeTo)],data:encU(3n*E18),txh:tx('b')}),
  log({block:102,index:2,topic:H['Burn(address,uint256,uint256,address)'],topics:[topicAddr(A.sender),topicAddr(A.user)],data:encWords(1n*E18,2n*E18),txh:tx('b')}),
  // User deliberately mints LP to feeTo. Source order says the final zero-origin
  // Transfer before Mint is the user mint, so it must NOT be counted as protocol fee.
  log({block:103,index:1,topic:H['Transfer(address,address,uint256)'],topics:[topicAddr(ZERO),topicAddr(A.feeTo)],data:encU(50n*E18),txh:tx('c')}),
  log({block:103,index:2,topic:H['Mint(address,uint256,uint256)'],topics:[topicAddr(A.sender)],data:encWords(5n*E18,6n*E18),txh:tx('c')})
];

function makeFetch(){return async (_url,options)=>{
  const reqs=JSON.parse(options.body);const out=reqs.map(req=>{
    if(req.method==='web3_sha3'){
      const s=Buffer.from(String(req.params[0]).slice(2),'hex').toString('utf8');if(!H[s])throw new Error(`Unexpected signature ${s}`);return {jsonrpc:'2.0',id:req.id,result:H[s]};
    }
    if(req.method==='eth_getBlockByNumber'){
      const tag=req.params[0];if(tag==='0x64')return {jsonrpc:'2.0',id:req.id,result:{number:tag,timestamp:'0x65920080',hash:PREV_HASH}};if(tag==='0x67')return {jsonrpc:'2.0',id:req.id,result:{number:tag,timestamp:'0x65920086',hash:CURR_HASH}};throw new Error(`Unexpected block ${tag}`);
    }
    if(req.method==='eth_call'){
      const to=String(req.params[0].to).toLowerCase(),data=String(req.params[0].data).toLowerCase(),tag=req.params[1];
      const sel=s=>H[s].slice(0,10).toLowerCase();
      if(to===FRAXSWAP_FACTORY_FRAXTAL.toLowerCase()&&data===sel('feeTo()'))return {jsonrpc:'2.0',id:req.id,result:encAddr(A.feeTo)};
      if(to===FRAXSWAP_FACTORY_FRAXTAL.toLowerCase()&&data===sel('allPairsLength()'))return {jsonrpc:'2.0',id:req.id,result:encU(1n)};
      if(to===FRAXSWAP_FACTORY_FRAXTAL.toLowerCase()&&data.startsWith(sel('allPairs(uint256)')))return {jsonrpc:'2.0',id:req.id,result:encAddr(A.pair)};
      if(to===A.pair.toLowerCase()&&data===sel('factory()'))return {jsonrpc:'2.0',id:req.id,result:encAddr(FRAXSWAP_FACTORY_FRAXTAL)};
      if(to===A.pair.toLowerCase()&&data===sel('token0()'))return {jsonrpc:'2.0',id:req.id,result:encAddr(A.token0)};
      if(to===A.pair.toLowerCase()&&data===sel('token1()'))return {jsonrpc:'2.0',id:req.id,result:encAddr(A.token1)};
      if(to===A.pair.toLowerCase()&&data===sel('kLast()'))return {jsonrpc:'2.0',id:req.id,result:encU(123n)};
      if(to===A.pair.toLowerCase()&&data===sel('totalSupply()'))return {jsonrpc:'2.0',id:req.id,result:encU(1000n*E18)};
      if(to===A.pair.toLowerCase()&&data.startsWith(sel('balanceOf(address)')))return {jsonrpc:'2.0',id:req.id,result:encU(8n*E18)};
      throw new Error(`Unexpected eth_call ${to} ${data} ${tag}`);
    }
    if(req.method==='eth_getLogs'){
      const f=req.params[0],from=BigInt(f.fromBlock),to=BigInt(f.toBlock);return {jsonrpc:'2.0',id:req.id,result:logs.filter(x=>{const b=BigInt(x.blockNumber);return b>=from&&b<=to;})};
    }
    throw new Error(`Unexpected method ${req.method}`);
  });return {ok:true,async json(){return out;}};
};}
function checkpoint({blockNumber,blockHash,observedAt}){return {status:'ok',measurementClass:'MEASURED',chainId:252,blockNumber,blockTag:`0x${blockNumber.toString(16)}`,blockHash,observedAt,rpc:{endpointId:'synthetic'},registry:{bammCount:1,allRegistryIdentitiesProven:true},bamms:[{pair:A.pair,bamm:'0x7777777777777777777777777777777777777777',token0:A.token0,token1:A.token1}]};}
function baseState(generatedAt){return {generatedAt,authority:{executionAuthority:'none',causalClaimAuthority:'none'},protocolLifecycle:{summary:{protocolCount:8},protocols:{'registry-frax-vefrax':{maturityStage:'shadow'}}},protocolSensors:{'registry-frax-vefrax':{latest:{observation:{epistemic:{executionAuthority:'none'},identityBoundary:{currentCanonicalPrincipal:'FRAX',currentCanonicalVoteEscrowLabel:'veFRAX'},referenceProductivity:{currentAprPct:5.25},registryExposure:{companyCount:3,positionCount:3},longitudinalEvidence:{canonicalSnapshotCount:4,validatedNativePeriodCount:0}}}}}};}
const previousCheckpoint=checkpoint({blockNumber:100,blockHash:PREV_HASH,observedAt:'2026-08-28T12:00:00.000Z'}),currentCheckpoint=checkpoint({blockNumber:103,blockHash:CURR_HASH,observedAt:'2026-08-28T12:00:06.000Z'});
const measurement=await collectFraxswapProtocolFeeRouting({currentBammMeasurement:currentCheckpoint,previousBammMeasurement:previousCheckpoint,endpoints:[{id:'synthetic',url:'https://synthetic.invalid'}],fetchImpl:makeFetch()});
assert.equal(measurement.status,'ok');assert.equal(measurement.measurementClass,'MEASURED');assert.equal(measurement.factory.endPairCount,1);assert.equal(measurement.factory.endFeeTo.toLowerCase(),A.feeTo.toLowerCase());assert.equal(measurement.factory.checkpointFeeToParity,true);assert.equal(measurement.coverage.fullFactoryRegistryCurrent,true);assert.equal(measurement.coverage.bammSubsetPairCount,1);assert.equal(measurement.summary.protocolFeeMintEventCount,2);assert.equal(measurement.summary.pairCountWithProtocolFeeMints,1);assert.equal(measurement.pairs[0].protocolFeeFlow.protocolMintUnitsLp,'8');assert.equal(measurement.pairs[0].protocolFeeFlow.mintCallCount,2);assert.equal(measurement.pairs[0].protocolFeeFlow.burnCallCount,1);assert.match(measurement.epistemic.protocolFeeLpMintFlow,/^MEASURED/);assert.equal(measurement.epistemic.heterogeneousLpUnitsAggregated,false);
const persistedEvents=measurement.pairs[0].protocolFeeFlow.protocolEvents;assert.deepEqual(persistedEvents.map(x=>x.valueRaw),[(5n*E18).toString(),(3n*E18).toString()]);assert.ok(persistedEvents.every(x=>typeof x.valueRaw==='string'&&!Object.hasOwn(x,'value')));assert.doesNotThrow(()=>JSON.stringify(measurement));
const state=baseState('2026-08-28T12:00:06.000Z');applyFraxEcosystemSensor({state,previousState:null});applyFraxswapProtocolFeeRouting({state,previousState:null,measurement});const obs=state.protocolEvidence['registry-frax-ecosystem'].latest.observation;assert.equal(obs.measurementExtensions.fraxswapProtocolFeeRouting,'0.1-fraxtal-fraxswap-factory-feeto-lp-mints');assert.match(obs.epistemic.fraxswapFactoryTopology,/^MEASURED/);assert.match(obs.epistemic.fraxswapFeeRecipientSplit,/^MEASURED/);assert.equal(obs.coverage.measuredSurfaceCount+obs.coverage.sourceBoundUnknownSurfaceCount,obs.coverage.surfaceCount);assert.equal(obs.authority.executionAuthority,'none');assert.doesNotThrow(()=>JSON.stringify(state));
console.log('FRAX FRAXSWAP PROTOCOL FEE ROUTING CANARY PASS',{factoryPairs:measurement.factory.endPairCount,feeTo:measurement.factory.endFeeTo,bammSubsetPairs:measurement.coverage.bammSubsetPairCount,protocolFeeMintPairs:measurement.summary.pairCountWithProtocolFeeMints,protocolFeeMintEvents:measurement.summary.protocolFeeMintEventCount,pairProtocolFeeLp:measurement.pairs[0].protocolFeeFlow.protocolMintUnitsLp,jsonSerializable:true,continuousFeeToStability:measurement.epistemic.feeToIntervalStability,executionAuthority:obs.authority.executionAuthority});
