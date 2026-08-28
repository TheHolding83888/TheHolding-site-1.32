#!/usr/bin/env node
import assert from 'node:assert/strict';
import { applyFraxEcosystemSensor } from './frax-ecosystem-sensor.mjs';
import { collectFraxswapFeeToLifecycle,applyFraxswapFeeToLifecycle,FRAXSWAP_FEETO_LIFECYCLE_VERSION } from './frax-fraxswap-feeto-lifecycle.mjs';

const E18=10n**18n,ZERO='0x0000000000000000000000000000000000000000';
const A={
  pair:'0x1111111111111111111111111111111111111111',
  token0:'0x2222222222222222222222222222222222222222',
  token1:'0x3333333333333333333333333333333333333333',
  feeTo:'0x4444444444444444444444444444444444444444',
  user:'0x5555555555555555555555555555555555555555',
  downstream:'0x6666666666666666666666666666666666666666',
  redemptionRecipient:'0x7777777777777777777777777777777777777777'
};
const PREV_HASH=`0x${'aa'.repeat(32)}`,CURR_HASH=`0x${'bb'.repeat(32)}`;
const sigs=['balanceOf(address)','Transfer(address,address,uint256)','Burn(address,uint256,uint256,address)'];
const H=Object.fromEntries(sigs.map((s,i)=>[s,`0x${String(i+1).padStart(64,String(i+1))}`.slice(0,66)]));
function u(v){return BigInt(v).toString(16).padStart(64,'0');}
function encU(v){return `0x${u(v)}`;}
function encWords(...v){return `0x${v.map(u).join('')}`;}
function encAddr(v){return `0x${String(v).replace(/^0x/,'').toLowerCase().padStart(64,'0')}`;}
function topicAddr(v){return encAddr(v);}
function tx(byte){return `0x${byte.repeat(64)}`;}
function log({block,index,topic,data,topics=[],txh}){return {address:A.pair,blockNumber:`0x${block.toString(16)}`,logIndex:`0x${index.toString(16)}`,transactionHash:txh,topics:[topic,...topics],data};}

const logs=[
  log({block:101,index:1,topic:H['Transfer(address,address,uint256)'],topics:[topicAddr(ZERO),topicAddr(A.feeTo)],data:encU(5n*E18),txh:tx('a')}),
  log({block:102,index:1,topic:H['Transfer(address,address,uint256)'],topics:[topicAddr(ZERO),topicAddr(A.feeTo)],data:encU(50n*E18),txh:tx('b')}),
  log({block:103,index:1,topic:H['Transfer(address,address,uint256)'],topics:[topicAddr(A.feeTo),topicAddr(A.downstream)],data:encU(4n*E18),txh:tx('c')}),
  log({block:104,index:1,topic:H['Transfer(address,address,uint256)'],topics:[topicAddr(A.feeTo),topicAddr(A.pair)],data:encU(6n*E18),txh:tx('d')}),
  log({block:104,index:2,topic:H['Transfer(address,address,uint256)'],topics:[topicAddr(A.pair),topicAddr(ZERO)],data:encU(6n*E18),txh:tx('d')}),
  log({block:104,index:3,topic:H['Burn(address,uint256,uint256,address)'],topics:[topicAddr(A.user),topicAddr(A.redemptionRecipient)],data:encWords(2n*E18,3n*E18),txh:tx('d')})
];

function makeFetch(){return async (_url,options)=>{
  const reqs=JSON.parse(options.body);const out=reqs.map(req=>{
    if(req.method==='web3_sha3'){
      const s=Buffer.from(String(req.params[0]).slice(2),'hex').toString('utf8');if(!H[s])throw new Error(`Unexpected signature ${s}`);return {jsonrpc:'2.0',id:req.id,result:H[s]};
    }
    if(req.method==='eth_getBlockByNumber'){
      const tag=req.params[0];if(tag==='0x64')return {jsonrpc:'2.0',id:req.id,result:{number:tag,hash:PREV_HASH}};if(tag==='0x68')return {jsonrpc:'2.0',id:req.id,result:{number:tag,hash:CURR_HASH}};throw new Error(`Unexpected block ${tag}`);
    }
    if(req.method==='eth_call'){
      const tag=req.params[1];
      if(tag==='0x64')return {jsonrpc:'2.0',id:req.id,result:encU(20n*E18)};
      if(tag==='0x68')return {jsonrpc:'2.0',id:req.id,result:encU(65n*E18)};
      throw new Error(`Unexpected eth_call tag ${tag}`);
    }
    if(req.method==='eth_getLogs'){
      const f=req.params[0],from=BigInt(f.fromBlock),to=BigInt(f.toBlock);
      return {jsonrpc:'2.0',id:req.id,result:logs.filter(x=>{const b=BigInt(x.blockNumber);return b>=from&&b<=to;})};
    }
    throw new Error(`Unexpected method ${req.method}`);
  });return {ok:true,async json(){return out;}};
};}

function checkpoint({blockNumber,blockHash,observedAt}){return {status:'ok',measurementClass:'MEASURED',chainId:252,blockNumber,blockTag:`0x${blockNumber.toString(16)}`,blockHash,observedAt,rpc:{endpointId:'synthetic'}};}
const previousCheckpoint=checkpoint({blockNumber:100,blockHash:PREV_HASH,observedAt:'2026-08-28T12:00:00.000Z'});
const currentCheckpoint=checkpoint({blockNumber:104,blockHash:CURR_HASH,observedAt:'2026-08-28T12:00:08.000Z'});
const protocolFeeMeasurement={
  version:'0.1-fraxtal-fraxswap-factory-feeto-lp-mints',status:'ok',measurementClass:'MEASURED',chainId:252,
  blockNumber:104,blockHash:CURR_HASH,interval:{fromBlockExclusive:100,fromBlockHash:PREV_HASH},
  factory:{startPairCount:1,endPairCount:1,endFeeTo:A.feeTo,checkpointFeeToParity:true},
  coverage:{fullFactoryRegistryCurrent:true},
  pairs:[{pair:A.pair,token0:A.token0,token1:A.token1}],
  rpc:{endpointId:'synthetic'}
};

const measurement=await collectFraxswapFeeToLifecycle({
  currentBammMeasurement:currentCheckpoint,
  previousBammMeasurement:previousCheckpoint,
  protocolFeeMeasurement,
  endpoints:[{id:'synthetic',url:'https://synthetic.invalid'}],
  fetchImpl:makeFetch()
});
assert.equal(measurement.status,'ok');
assert.equal(measurement.version,FRAXSWAP_FEETO_LIFECYCLE_VERSION);
assert.equal(measurement.measurementClass,'MEASURED');
assert.equal(measurement.summary.pairCount,1);
assert.equal(measurement.summary.pairCountWithPositiveEndBalance,1);
assert.equal(measurement.summary.pairCountWithOutflows,1);
assert.equal(measurement.summary.outboundTransferEventCount,2);
assert.equal(measurement.summary.pairCountWithStrictRedemptions,1);
assert.equal(measurement.summary.strictRedemptionCount,1);
assert.equal(measurement.summary.unresolvedPairTransferOutflowCount,0);
const life=measurement.pairs[0].lifecycle;
assert.equal(life.startFeeToBalanceLp,'20');
assert.equal(life.endFeeToBalanceLp,'65');
assert.equal(life.inboundUnitsRaw,(55n*E18).toString());
assert.equal(life.outboundUnitsRaw,(10n*E18).toString());
assert.equal(life.balanceConservationProven,true);
assert.equal(life.strictRedemptionCount,1);
assert.equal(life.redemptions[0].redemptionRecipient.toLowerCase(),A.redemptionRecipient.toLowerCase());
assert.equal(life.redemptions[0].amount0Raw,(2n*E18).toString());
assert.equal(life.redemptions[0].amount1Raw,(3n*E18).toString());
assert.match(measurement.epistemic.feeToLpRedemptionFlow,/^MEASURED/);
assert.equal(measurement.epistemic.protocolRevenueUsdClaim,false);
assert.equal(measurement.epistemic.veFraxDistributionClaim,false);
assert.doesNotThrow(()=>JSON.stringify(measurement));

function baseState(generatedAt){return {
  generatedAt,
  authority:{executionAuthority:'none',causalClaimAuthority:'none'},
  protocolLifecycle:{summary:{protocolCount:8},protocols:{'registry-frax-vefrax':{maturityStage:'shadow'}}},
  protocolSensors:{'registry-frax-vefrax':{latest:{observation:{
    epistemic:{executionAuthority:'none'},
    identityBoundary:{currentCanonicalPrincipal:'FRAX',currentCanonicalVoteEscrowLabel:'veFRAX'},
    referenceProductivity:{currentAprPct:5.25},
    registryExposure:{companyCount:3,positionCount:3},
    longitudinalEvidence:{canonicalSnapshotCount:4,validatedNativePeriodCount:0}
  }}}}
};}
const state=baseState('2026-08-28T12:00:08.000Z');
applyFraxEcosystemSensor({state,previousState:null});
const before=state.protocolEvidence['registry-frax-ecosystem'].latest.observation;
assert.equal(before.surfaces.revenueRouting.measurementState,'UNKNOWN-current-value-not-ingested');
applyFraxswapFeeToLifecycle({state,previousState:null,measurement});
const obs=state.protocolEvidence['registry-frax-ecosystem'].latest.observation;
assert.equal(obs.measurementExtensions.fraxswapFeeToLpLifecycle,FRAXSWAP_FEETO_LIFECYCLE_VERSION);
assert.equal(obs.surfaces.revenueRouting.measurementState,'UNKNOWN-current-value-not-ingested');
assert.equal(obs.surfaces.revenueRouting.measured.fraxswapFeeToLpLifecycle.version,FRAXSWAP_FEETO_LIFECYCLE_VERSION);
assert.match(obs.epistemic.fraxswapFeeToLpHoldings,/^MEASURED/);
assert.equal(obs.epistemic.fraxswapDownstreamRecipientSemantics,'UNKNOWN');
assert.equal(obs.coverage.measuredSurfaceCount+obs.coverage.sourceBoundUnknownSurfaceCount,obs.coverage.surfaceCount);
assert.equal(obs.authority.executionAuthority,'none');
assert.doesNotThrow(()=>JSON.stringify(state));

console.log('FRAX FRAXSWAP FEETO LP LIFECYCLE CANARY PASS',{
  pairCount:measurement.summary.pairCount,
  startFeeToLp:life.startFeeToBalanceLp,
  endFeeToLp:life.endFeeToBalanceLp,
  outboundTransfers:measurement.summary.outboundTransferEventCount,
  strictRedemptions:measurement.summary.strictRedemptionCount,
  unresolvedPairOutflows:measurement.summary.unresolvedPairTransferOutflowCount,
  revenueSurfaceState:obs.surfaces.revenueRouting.measurementState,
  downstreamRecipientSemantics:obs.epistemic.fraxswapDownstreamRecipientSemantics,
  executionAuthority:obs.authority.executionAuthority
});
