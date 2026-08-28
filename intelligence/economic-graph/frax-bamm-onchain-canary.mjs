#!/usr/bin/env node
import assert from 'node:assert/strict';
import { applyFraxEcosystemSensor } from './frax-ecosystem-sensor.mjs';
import { collectFraxBammOnchain,applyFraxBammOnchainMeasurement,BAMM_FACTORY_FRAXTAL,FRAXSWAP_FACTORY_FRAXTAL } from './frax-bamm-onchain.mjs';

const E18=10n**18n;
const A={bamm:'0x1111111111111111111111111111111111111111',pair:'0x2222222222222222222222222222222222222222',token0:'0x3333333333333333333333333333333333333333',token1:'0x4444444444444444444444444444444444444444',wrapper:'0x5555555555555555555555555555555555555555',rate:'0x6666666666666666666666666666666666666666',feeTo:'0x7777777777777777777777777777777777777777'};
const sel={bammsLength:'0x9a0bc2a9',bammsArray:'0x6f4b49c1',iFraxswapFactory:'0x0feef4b1',feeTo:'0x017e7e58',version:'0x54fd4d50',factory:'0xc45a0155',pair:'0xa8aa1b31',token0:'0x0dfe1681',token1:'0xd21220a7',sqrtRented:'0x19b730d5',rentedMultiplier:'0x90c371e6',last:'0xcf521eaf',full:'0xf331b0ec',rate:'0x78f3a894',wrapper:'0x6bfd1cfb',feeShare:'0x922fb350',maxUtility:'0x9115eacd',precision:'0xaaf5eb68',isBamm:'0x89439acf',pairToBamm:'0x07be75f7',reserves:'0x0902f1ac',totalSupply:'0x18160ddd',balanceOf:'0x70a08231',preview:'0xfab59f98'};
function u(v){return BigInt(v).toString(16).padStart(64,'0');}
function encU(v){return '0x'+u(v);}
function encA(v){return '0x'+String(v).replace(/^0x/,'').toLowerCase().padStart(64,'0');}
function encWords(...v){return '0x'+v.map(u).join('');}
function encAddrArray(rows){return '0x'+u(32)+u(rows.length)+rows.map(x=>String(x).replace(/^0x/,'').toLowerCase().padStart(64,'0')).join('');}
function makeFetch({allFail=false}={}){return async (url,options)=>{
  if(allFail)throw new Error('synthetic Fraxtal outage');
  const reqs=JSON.parse(options.body);const out=reqs.map(req=>{
    if(req.method==='eth_blockNumber')return {jsonrpc:'2.0',id:req.id,result:'0x64'};
    if(req.method==='eth_getBlockByNumber')return {jsonrpc:'2.0',id:req.id,result:{timestamp:'0x65920080',hash:`0x${'ab'.repeat(32)}`}};
    assert.equal(req.method,'eth_call');assert.equal(req.params[1],'0x64','all BAMM reads must share exact block');
    const to=String(req.params[0].to).toLowerCase(),data=String(req.params[0].data).toLowerCase(),s=data.slice(0,10);
    if(to===BAMM_FACTORY_FRAXTAL.toLowerCase()){
      if(s===sel.bammsLength)return {jsonrpc:'2.0',id:req.id,result:encU(1)};
      if(s===sel.bammsArray)return {jsonrpc:'2.0',id:req.id,result:encAddrArray([A.bamm])};
      if(s===sel.iFraxswapFactory)return {jsonrpc:'2.0',id:req.id,result:encA(FRAXSWAP_FACTORY_FRAXTAL)};
      if(s===sel.feeTo)return {jsonrpc:'2.0',id:req.id,result:encA(A.feeTo)};
      if(s===sel.isBamm)return {jsonrpc:'2.0',id:req.id,result:encU(1)};
      if(s===sel.pairToBamm)return {jsonrpc:'2.0',id:req.id,result:encA(A.bamm)};
    }
    if(to===A.bamm.toLowerCase()){
      if(s===sel.version)return {jsonrpc:'2.0',id:req.id,result:encWords(0,5,2)};
      if(s===sel.factory)return {jsonrpc:'2.0',id:req.id,result:encA(BAMM_FACTORY_FRAXTAL)};
      if(s===sel.pair)return {jsonrpc:'2.0',id:req.id,result:encA(A.pair)};
      if(s===sel.token0)return {jsonrpc:'2.0',id:req.id,result:encA(A.token0)};
      if(s===sel.token1)return {jsonrpc:'2.0',id:req.id,result:encA(A.token1)};
      if(s===sel.sqrtRented)return {jsonrpc:'2.0',id:req.id,result:encU(100)};
      if(s===sel.rentedMultiplier)return {jsonrpc:'2.0',id:req.id,result:encU(E18)};
      if(s===sel.last)return {jsonrpc:'2.0',id:req.id,result:encU(1_700_000_000)};
      if(s===sel.full)return {jsonrpc:'2.0',id:req.id,result:encU(123456789)};
      if(s===sel.rate)return {jsonrpc:'2.0',id:req.id,result:encA(A.rate)};
      if(s===sel.wrapper)return {jsonrpc:'2.0',id:req.id,result:encA(A.wrapper)};
      if(s===sel.feeShare)return {jsonrpc:'2.0',id:req.id,result:encU(1000)};
      if(s===sel.maxUtility)return {jsonrpc:'2.0',id:req.id,result:encU(950000000000000000n)};
      if(s===sel.precision)return {jsonrpc:'2.0',id:req.id,result:encU(E18)};
      if(s===sel.preview)return {jsonrpc:'2.0',id:req.id,result:encU(10_000_000_000n)};
    }
    if(to===A.pair.toLowerCase()){
      if(s===sel.factory)return {jsonrpc:'2.0',id:req.id,result:encA(FRAXSWAP_FACTORY_FRAXTAL)};
      if(s===sel.token0)return {jsonrpc:'2.0',id:req.id,result:encA(A.token0)};
      if(s===sel.token1)return {jsonrpc:'2.0',id:req.id,result:encA(A.token1)};
      if(s===sel.reserves)return {jsonrpc:'2.0',id:req.id,result:encWords(1000,4000,1_700_000_000)};
      if(s===sel.totalSupply)return {jsonrpc:'2.0',id:req.id,result:encU(100)};
      if(s===sel.balanceOf)return {jsonrpc:'2.0',id:req.id,result:encU(25)};
    }
    if(to===A.wrapper.toLowerCase()&&s===sel.totalSupply)return {jsonrpc:'2.0',id:req.id,result:encU(50)};
    throw new Error(`Unexpected BAMM call ${to} ${data}`);
  });return {ok:true,async json(){return out;}};
};}
function baseState(){return {generatedAt:'2026-08-28T00:00:00.000Z',authority:{executionAuthority:'none',causalClaimAuthority:'none'},protocolLifecycle:{summary:{protocolCount:8},protocols:{'registry-frax-vefrax':{maturityStage:'shadow'}}},protocolSensors:{'registry-frax-vefrax':{latest:{observation:{epistemic:{executionAuthority:'none'},identityBoundary:{currentCanonicalPrincipal:'FRAX',currentCanonicalVoteEscrowLabel:'veFRAX'},referenceProductivity:{currentAprPct:5.25},registryExposure:{companyCount:3,positionCount:3},longitudinalEvidence:{canonicalSnapshotCount:4,validatedNativePeriodCount:0}}}}}};}

const m=await collectFraxBammOnchain({fetchImpl:makeFetch(),endpoints:[{id:'synthetic',url:'https://synthetic.invalid'}]});
assert.equal(m.status,'ok');assert.equal(m.measurementClass,'MEASURED');assert.equal(m.registry.bammCount,1);assert.equal(m.registry.activeRentedBammCount,1);assert.equal(m.bamms[0].identity.pairToBammMappingProven,true);assert.equal(m.bamms[0].raw.sqrtBalance,'500');assert.equal(m.bamms[0].raw.sqrtRentedReal,'100');assert.equal(m.bamms[0].raw.utility,'166666666666666666');assert.ok(Math.abs(m.bamms[0].values.utilityPct-16.66666667)<1e-8);assert.equal(m.bamms[0].raw.borrowRatePerSecond,'10000000000');assert.equal(m.epistemic.executionAuthority,'none');
const state=baseState();applyFraxEcosystemSensor({state,previousState:null});applyFraxBammOnchainMeasurement({state,previousState:null,measurement:m});const obs=state.protocolEvidence['registry-frax-ecosystem'].latest.observation;assert.equal(obs.surfaces.fraxswapBamm.measurementState,'MEASURED-current-onchain-bamm-registry');assert.equal(obs.coverage.measuredSurfaceCount,2);assert.equal(obs.coverage.sourceBoundUnknownSurfaceCount,7);assert.equal(obs.epistemic.fraxswapVolumeFees,'UNKNOWN-not-yet-measured');assert.equal(obs.authority.executionAuthority,'none');
const unavailable=await collectFraxBammOnchain({fetchImpl:makeFetch({allFail:true}),endpoints:[{id:'fail',url:'https://fail.invalid'}]});assert.match(unavailable.status,/^UNKNOWN/);assert.equal(unavailable.registry.bammCount,null);
console.log('FRAX BAMM ONCHAIN SENSOR CANARY PASS',{bammCount:m.registry.bammCount,utilityPct:m.bamms[0].values.utilityPct,borrowRatePerSecond:m.bamms[0].values.borrowRatePerSecond,measuredSurfaces:obs.coverage.measuredSurfaceCount,executionAuthority:obs.authority.executionAuthority});

if(process.env.GITHUB_ACTIONS==='true'){
  const live=await collectFraxBammOnchain();
  if(live.status!=='ok'||live.measurementClass!=='MEASURED'||!(live.registry?.bammCount>0)||live.registry?.allRegistryIdentitiesProven!==true)throw new Error(`FRAX BAMM LIVE PROBE FAILED ${JSON.stringify(live.rpc)}`);
  if(!live.bamms.every(x=>x.identity?.factoryMembershipProven&&x.identity?.pairFactoryProven&&x.identity?.pairToBammMappingProven&&x.identity?.tokenIdentityParityProven))throw new Error('FRAX BAMM live registry identity incomplete');
  console.log('FRAX BAMM LIVE EXACT-BLOCK PROOF PASS',{observedAt:live.observedAt,blockNumber:live.blockNumber,blockHash:live.blockHash,bammCount:live.registry.bammCount,activeRentedBammCount:live.registry.activeRentedBammCount,rpcEndpoint:live.rpc.endpointId,executionAuthority:live.epistemic.executionAuthority,sample:live.bamms.slice(0,3).map(x=>({bamm:x.bamm,pair:x.pair,utilityPct:x.values.utilityPct,borrowRatePerSecond:x.values.borrowRatePerSecond}))});
}
