#!/usr/bin/env node
import assert from 'node:assert/strict';
import {collectFraxswapFeeToHistoryBackfill,applyFraxswapFeeToHistoryBackfill,FRAXSWAP_FEETO_HISTORY_BACKFILL_VERSION} from './frax-fraxswap-feeto-history-backfill.mjs';

const E18=10n**18n,ZERO='0x0000000000000000000000000000000000000000';
const A={pair:'0x1111111111111111111111111111111111111111',token0:'0x2222222222222222222222222222222222222222',token1:'0x3333333333333333333333333333333333333333',currentFeeTo:'0x4444444444444444444444444444444444444444',oldFeeTo:'0x5555555555555555555555555555555555555555',user:'0x6666666666666666666666666666666666666666',downstream:'0x7777777777777777777777777777777777777777',redeemer:'0x8888888888888888888888888888888888888888'};
const sigs=['Transfer(address,address,uint256)','Mint(address,uint256,uint256)','Burn(address,uint256,uint256,address)'];
const H=Object.fromEntries(sigs.map((s,i)=>[s,`0x${String(i+1).repeat(64).slice(0,64)}`]));
function u(v){return BigInt(v).toString(16).padStart(64,'0');}
function encU(v){return `0x${u(v)}`;}
function encWords(...v){return `0x${v.map(u).join('')}`;}
function topicAddr(v){return `0x${String(v).replace(/^0x/,'').toLowerCase().padStart(64,'0')}`;}
function tx(c){return `0x${c.repeat(64)}`;}
function bh(n){return `0x${BigInt(n).toString(16).padStart(64,'0')}`;}
function log({block,index,topic,topics=[],data='0x',txh}){return {address:A.pair,blockNumber:`0x${block.toString(16)}`,logIndex:`0x${index.toString(16)}`,transactionHash:txh,topics:[topic,...topics],data};}
const tA=tx('a'),tB=tx('b'),tC=tx('c'),tD=tx('d'),tE=tx('e');
const logs=[
  log({block:108,index:1,topic:H[sigs[0]],topics:[topicAddr(ZERO),topicAddr(A.currentFeeTo)],data:encU(5n*E18),txh:tA}),
  log({block:108,index:2,topic:H[sigs[0]],topics:[topicAddr(ZERO),topicAddr(A.user)],data:encU(20n*E18),txh:tA}),
  log({block:108,index:3,topic:H[sigs[1]],topics:[topicAddr(A.user)],data:encWords(10n*E18,10n*E18),txh:tA}),
  log({block:95,index:1,topic:H[sigs[0]],topics:[topicAddr(ZERO),topicAddr(A.oldFeeTo)],data:encU(3n*E18),txh:tB}),
  log({block:95,index:2,topic:H[sigs[2]],topics:[topicAddr(A.user),topicAddr(A.redeemer)],data:encWords(4n*E18,6n*E18),txh:tB}),
  log({block:102,index:1,topic:H[sigs[0]],topics:[topicAddr(A.currentFeeTo),topicAddr(A.downstream)],data:encU(2n*E18),txh:tC}),
  log({block:101,index:1,topic:H[sigs[0]],topics:[topicAddr(A.currentFeeTo),topicAddr(A.pair)],data:encU(1n*E18),txh:tD}),
  log({block:101,index:2,topic:H[sigs[0]],topics:[topicAddr(A.pair),topicAddr(ZERO)],data:encU(1n*E18),txh:tD}),
  log({block:101,index:3,topic:H[sigs[2]],topics:[topicAddr(A.user),topicAddr(A.redeemer)],data:encWords(2n*E18,3n*E18),txh:tD}),
  log({block:97,index:1,topic:H[sigs[0]],topics:[topicAddr(A.oldFeeTo),topicAddr(A.downstream)],data:encU(1n*E18),txh:tE})
];
function matchTopics(logTopics,filter){if(!filter)return true;for(let i=0;i<filter.length;i++){const f=filter[i];if(f===null||f===undefined)continue;const v=String(logTopics[i]||'').toLowerCase();if(Array.isArray(f)){if(!f.map(x=>String(x).toLowerCase()).includes(v))return false;}else if(String(f).toLowerCase()!==v)return false;}return true;}
function makeFetch(){return async (_url,options)=>{const reqs=JSON.parse(options.body);const out=reqs.map(req=>{if(req.method==='web3_sha3'){const s=Buffer.from(String(req.params[0]).slice(2),'hex').toString('utf8');return {jsonrpc:'2.0',id:req.id,result:H[s]};}if(req.method==='eth_getCode'){const b=BigInt(req.params[1]);return {jsonrpc:'2.0',id:req.id,result:b>=80n?'0x60016000':'0x'};}if(req.method==='eth_getBlockByNumber'){const b=BigInt(req.params[0]);return {jsonrpc:'2.0',id:req.id,result:{number:req.params[0],hash:bh(b)}};}if(req.method==='eth_getLogs'){const f=req.params[0],from=BigInt(f.fromBlock),to=BigInt(f.toBlock),addresses=new Set((Array.isArray(f.address)?f.address:[f.address]).map(x=>String(x).toLowerCase()));const rows=logs.filter(l=>addresses.has(l.address.toLowerCase())&&BigInt(l.blockNumber)>=from&&BigInt(l.blockNumber)<=to&&matchTopics(l.topics,f.topics));return {jsonrpc:'2.0',id:req.id,result:rows};}if(req.method==='eth_getTransactionReceipt'){const wanted=String(req.params[0]).toLowerCase();return {jsonrpc:'2.0',id:req.id,result:{transactionHash:wanted,logs:logs.filter(l=>String(l.transactionHash).toLowerCase()===wanted)}};}throw new Error(`Unexpected method ${req.method}`);});return {ok:true,async json(){return out;}};};}
function checkpoint(n){return {status:'ok',measurementClass:'MEASURED',chainId:252,blockNumber:n,blockTag:`0x${n.toString(16)}`,blockHash:bh(n),observedAt:`2026-08-28T12:00:${String(n%60).padStart(2,'0')}.000Z`,rpc:{endpointId:'synthetic'}};}
const previousBamm=checkpoint(110),currentBamm=checkpoint(120);
const protocolFee={version:'0.1-fraxtal-fraxswap-factory-feeto-lp-mints',status:'ok',measurementClass:'MEASURED',chainId:252,blockNumber:120,blockHash:bh(120),interval:{fromBlockExclusive:110,fromBlockHash:bh(110)},factory:{endPairCount:1,endFeeTo:A.currentFeeTo},coverage:{fullFactoryRegistryCurrent:true},pairs:[{pair:A.pair,token0:A.token0,token1:A.token1}],rpc:{endpointId:'synthetic'}};
const common={currentBammMeasurement:currentBamm,previousBammMeasurement:previousBamm,protocolFeeMeasurement:protocolFee,endpoints:[{id:'synthetic',url:'https://synthetic.invalid'}],fetchImpl:makeFetch(),discoveryWindowBlocks:11n,recipientLedgerWindowBlocks:20n,maxRecipientLedgerScansPerRun:2};
const first=await collectFraxswapFeeToHistoryBackfill({...common,previousBackfillMeasurement:null});
assert.equal(first.version,FRAXSWAP_FEETO_HISTORY_BACKFILL_VERSION);
assert.equal(first.status,'ok');assert.equal(first.measurementClass,'MEASURED');
assert.equal(first.coverage.factoryDeploymentBlock,80);
assert.equal(first.coverage.discovery.coveredFromBlockInclusive,100);assert.equal(first.coverage.discovery.coveredToBlockInclusive,110);assert.equal(first.coverage.discovery.nextToBlockInclusive,99);
assert.equal(first.summary.protocolFeeMintEventCountBackfilled,1);assert.equal(first.summary.historicalProtocolFeeRecipientCount,1);assert.equal(first.summary.trackedFeeToRecipientCount,1);
assert.equal(first.summary.outboundLpTransferEventCountBackfilled,2);assert.equal(first.summary.strictRedemptionCountBackfilled,1);assert.equal(first.history.strictRedemptions[0].redemptionRecipient.toLowerCase(),A.redeemer.toLowerCase());
assert.equal(first.epistemic.continuousFeeToStateHistory,'UNKNOWN-no-setFeeTo-event-and-no-complete-call-trace');

const second=await collectFraxswapFeeToHistoryBackfill({...common,previousBackfillMeasurement:first});
assert.equal(second.status,'ok');assert.equal(second.coverage.discovery.coveredFromBlockInclusive,89);assert.equal(second.coverage.discovery.nextToBlockInclusive,88);
assert.equal(second.summary.protocolFeeMintEventCountBackfilled,2);assert.equal(second.summary.historicalProtocolFeeRecipientCount,2);assert.equal(second.summary.trackedFeeToRecipientCount,2);
assert.ok(second.history.protocolFeeMintEvents.some(x=>x.recipient.toLowerCase()===A.oldFeeTo.toLowerCase()&&x.blockNumber===95));
assert.ok(second.history.lpTransferEvents.some(x=>x.feeToRecipient.toLowerCase()===A.oldFeeTo.toLowerCase()&&x.blockNumber===97&&x.direction==='outbound'));
assert.equal(second.summary.outboundLpTransferEventCountBackfilled,3);assert.equal(second.summary.strictRedemptionCountBackfilled,1);
assert.equal(second.epistemic.historicalFlowCompleteness,'PARTIAL-contiguous-bounded-backfill-in-progress');
assert.doesNotThrow(()=>JSON.stringify(second));

const state={
  authority:{executionAuthority:'none',causalClaimAuthority:'none'},
  protocolSensors:{'registry-frax-vefrax':{latest:{observation:{}},ecosystemFamily:{}}},
  protocolEvidence:{'registry-frax-ecosystem':{status:'partial',observationCount:1,observations:[],latest:{observation:{id:'base',status:'partial',authority:{executionAuthority:'none',causalClaimAuthority:'none'},epistemic:{executionAuthority:'none'},surfaces:{fraxswapBamm:{measurementState:'MEASURED-partial',measured:{},mechanicalRelations:[]},revenueRouting:{measurementState:'UNKNOWN-current-value-not-ingested',measured:{},mechanicalRelations:[]}},coverage:{surfaceCount:2,surfaceIds:['fraxswap-bamm','revenue-routing'],measuredSurfaceCount:1,sourceBoundUnknownSurfaceCount:1,relationshipCount:0,relationshipClassCounts:{}}}}}}
};
applyFraxswapFeeToHistoryBackfill({state,previousState:null,measurement:second});
const obs=state.protocolEvidence['registry-frax-ecosystem'].latest.observation;
assert.equal(obs.measurementExtensions.fraxswapFeeToHistoricalBackfill,FRAXSWAP_FEETO_HISTORY_BACKFILL_VERSION);
assert.equal(obs.surfaces.revenueRouting.measurementState,'UNKNOWN-current-value-not-ingested');
assert.equal(obs.surfaces.revenueRouting.measured.fraxswapFeeToHistoricalBackfill.summary.protocolFeeMintEventCountBackfilled,2);
assert.equal(obs.epistemic.fraxswapContinuousFeeToStateHistory,'UNKNOWN');
assert.equal(obs.authority.executionAuthority,'none');
assert.doesNotThrow(()=>JSON.stringify(state));
console.log('FRAX FRAXSWAP FEETO HISTORICAL BACKFILL CANARY PASS',{deploymentBlock:second.coverage.factoryDeploymentBlock,discoveryCovered:[second.coverage.discovery.coveredFromBlockInclusive,second.coverage.discovery.coveredToBlockInclusive],protocolFeeMintEvents:second.summary.protocolFeeMintEventCountBackfilled,trackedRecipients:second.summary.trackedFeeToRecipientCount,outboundLpTransfers:second.summary.outboundLpTransferEventCountBackfilled,strictRedemptions:second.summary.strictRedemptionCountBackfilled,continuousFeeToStateHistory:second.epistemic.continuousFeeToStateHistory,revenueSurface:obs.surfaces.revenueRouting.measurementState});
