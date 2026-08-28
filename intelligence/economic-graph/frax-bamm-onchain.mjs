#!/usr/bin/env node
/**
 * The Holding · Fraxswap/BAMM registry-state sensor v0.1
 *
 * Bounded read-only exact-block measurement of the official Fraxtal BAMM
 * registry and every BAMM it currently contains. This atom proves topology and
 * the BAMM-native rented-liquidity -> utility -> borrow-rate path. It does not
 * yet measure Fraxswap volume/fees, lender interval yield, or revenue routing.
 *
 * No execution, price, recommendation, methodology or causal authority.
 */
import crypto from 'node:crypto';

export const FRAX_BAMM_ONCHAIN_VERSION='0.1-fraxtal-bamm-registry-exact-block';
export const FRAX_ECOSYSTEM_EVIDENCE_ID='registry-frax-ecosystem';
export const FRAX_PROTOCOL_ID='registry-frax-vefrax';
export const FRAXTAL_CHAIN_ID=252;
export const BAMM_FACTORY_FRAXTAL='0x19928170D739139bfbBb6614007F8EEeD17DB0Ba';
export const FRAXSWAP_FACTORY_FRAXTAL='0xE30521fe7f3bEB6Ad556887b50739d6C7CA667E6';
export const OFFICIAL_BAMM_SOURCE_REF='24118b75edc5377dee23c53ae419405287b92295';
export const FRAXTAL_RPC_ENDPOINTS=[
  {id:'fraxtal-official',url:'https://rpc.frax.com'},
  {id:'fraxtal-publicnode',url:'https://fraxtal-rpc.publicnode.com'}
];

const RPC_TIMEOUT_MS=12_000;
const MAX_BAMMS=250;
const MAX_BATCH_CALLS=160;
const MAX_OBSERVATIONS=1000;
const E18=10n**18n;

const S={
  bammsLength:'0x9a0bc2a9',bammsArray:'0x6f4b49c1',iFraxswapFactory:'0x0feef4b1',feeTo:'0x017e7e58',
  version:'0x54fd4d50',factory:'0xc45a0155',pair:'0xa8aa1b31',token0:'0x0dfe1681',token1:'0xd21220a7',
  sqrtRented:'0x19b730d5',rentedMultiplier:'0x90c371e6',timeSinceLastInterestPayment:'0xcf521eaf',
  fullUtilizationRate:'0xf331b0ec',variableInterestRate:'0x78f3a894',iBammErc20:'0x6bfd1cfb',
  previewInterestRate:'0xfab59f98',getReserves:'0x0902f1ac',totalSupply:'0x18160ddd',balanceOf:'0x70a08231',
  pairToBamm:'0x07be75f7',isBamm:'0x89439acf',FEE_SHARE:'0x922fb350',MAX_UTILITY_RATE:'0x9115eacd',PRECISION:'0xaaf5eb68'
};

function sha256(value){return crypto.createHash('sha256').update(value).digest('hex');}
function stableValue(value){if(Array.isArray(value))return value.map(stableValue);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(k=>[k,stableValue(value[k])]));return value;}
function stableStringify(value){return JSON.stringify(stableValue(value));}
function normalizeAddress(v){return String(v||'').toLowerCase();}
function sameAddress(a,b){return normalizeAddress(a)===normalizeAddress(b);}
function round(v,d=12){const n=Number(v);return Number.isFinite(n)?Number(n.toFixed(d)):null;}
function cleanAbi(hex){const x=String(hex||'').replace(/^0x/,'');if(!x.length||x.length%64!==0||!/^[0-9a-f]+$/i.test(x))throw new Error('Invalid ABI result');return x;}
function words(hex){const x=cleanAbi(hex),out=[];for(let i=0;i<x.length;i+=64)out.push(BigInt(`0x${x.slice(i,i+64)}`));return out;}
function word(hex){const out=words(hex);if(!out.length)throw new Error('Missing ABI word');return out[0];}
function address(hex){const x=cleanAbi(hex);return `0x${x.slice(24,64)}`;}
function bool(hex){return word(hex)!==0n;}
function signed256(v){const n=BigInt(v);return n>=(1n<<255n)?n-(1n<<256n):n;}
function addrArg(a){return normalizeAddress(a).replace(/^0x/,'').padStart(64,'0');}
function uintArg(v){return BigInt(v).toString(16).padStart(64,'0');}
function addressArray(hex){
  const x=cleanAbi(hex),wc=x.length/64,offset=Number(BigInt(`0x${x.slice(0,64)}`));
  if(!Number.isSafeInteger(offset)||offset%32!==0)throw new Error('Invalid BAMM array offset');
  const start=offset/32;if(start>=wc)throw new Error('BAMM array offset outside ABI');
  const len=Number(BigInt(`0x${x.slice(start*64,(start+1)*64)}`));
  if(!Number.isSafeInteger(len)||len<0||len>MAX_BAMMS||start+1+len>wc)throw new Error('Invalid BAMM registry length');
  return Array.from({length:len},(_,i)=>`0x${x.slice((start+1+i)*64+24,(start+2+i)*64)}`);
}
function isqrt(n){
  n=BigInt(n);if(n<0n)throw new Error('sqrt negative');if(n<2n)return n;
  let x0=1n<<(BigInt(n.toString(2).length)>>1n),x1=(x0+n/x0)>>1n;
  while(x1<x0){x0=x1;x1=(x0+n/x0)>>1n;}return x0;
}
function rpcQuantity(hex){if(!/^0x[0-9a-f]+$/i.test(String(hex||'')))throw new Error('Invalid RPC quantity');return BigInt(hex);}

async function post(url,payload,fetchImpl){
  const response=await fetchImpl(url,{method:'POST',headers:{'content-type':'application/json',accept:'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(RPC_TIMEOUT_MS)});
  if(!response.ok)throw new Error(`RPC HTTP ${response.status}`);
  const body=await response.json();if(!Array.isArray(body))throw new Error('RPC response is not an array');
  const byId=new Map(body.map(r=>[Number(r?.id),r]));
  for(const req of payload){const r=byId.get(req.id);if(!r)throw new Error(`RPC result ${req.id} missing`);if(r.error)throw new Error(`RPC ${req.method} error: ${r.error?.message||'unknown'}`);if(r.result===undefined||r.result===null)throw new Error(`RPC ${req.method} result missing`);}
  return byId;
}
async function batchedCalls(url,calls,fetchImpl){
  const out=new Map();for(let i=0;i<calls.length;i+=MAX_BATCH_CALLS){const part=await post(url,calls.slice(i,i+MAX_BATCH_CALLS),fetchImpl);for(const [k,v] of part)out.set(k,v);}return out;
}
function unknown(attempts,reason='UNKNOWN-fraxtal-bamm-read-failed'){
  return {version:FRAX_BAMM_ONCHAIN_VERSION,status:reason,measurementClass:'UNKNOWN',observedAt:null,chain:'fraxtal',chainId:FRAXTAL_CHAIN_ID,
    contracts:{bammFactory:BAMM_FACTORY_FRAXTAL,expectedFraxswapFactory:FRAXSWAP_FACTORY_FRAXTAL},registry:{bammCount:null,allRegistryIdentitiesProven:false},bamms:[],rpc:{endpointId:null,failoverAttempts:attempts},
    provenance:{officialDocs:'docs.frax.com/protocol/subprotocols/bamm/addresses',officialSourceRepository:'FraxFinance/public-frax-bamm',officialSourceRef:OFFICIAL_BAMM_SOURCE_REF},
    epistemic:{currentStateMeasured:false,registryWide:false,swapVolumeFees:'UNKNOWN',lenderIntervalYield:'UNKNOWN',revenueRouting:'UNKNOWN',unknownIsZero:false,annualizationPerformed:false,causalClaimAuthority:'none',executionAuthority:'none'}};
}

export async function collectFraxBammOnchain({fetchImpl=fetch,endpoints=FRAXTAL_RPC_ENDPOINTS}={}){
  const attempts=[];
  for(const endpoint of endpoints){
    try{
      const p1=await post(endpoint.url,[{jsonrpc:'2.0',id:1,method:'eth_blockNumber',params:[]}],fetchImpl);
      const blockTag=p1.get(1).result,blockNumber=rpcQuantity(blockTag);
      const call=(id,to,data)=>({jsonrpc:'2.0',id,method:'eth_call',params:[{to,data},blockTag]});
      const p2=await post(endpoint.url,[
        {jsonrpc:'2.0',id:2,method:'eth_getBlockByNumber',params:[blockTag,false]},
        call(10,BAMM_FACTORY_FRAXTAL,S.bammsLength),call(11,BAMM_FACTORY_FRAXTAL,S.bammsArray),
        call(12,BAMM_FACTORY_FRAXTAL,S.iFraxswapFactory),call(13,BAMM_FACTORY_FRAXTAL,S.feeTo)
      ],fetchImpl);
      const block=p2.get(2).result,timestamp=Number(rpcQuantity(block?.timestamp));
      if(!(timestamp>0)||!/^0x[0-9a-f]{64}$/i.test(String(block?.hash||'')))throw new Error('Fraxtal exact block identity unavailable');
      const listed=addressArray(p2.get(11).result),length=Number(word(p2.get(10).result));
      if(length!==listed.length||length<1||length>MAX_BAMMS)throw new Error(`BAMM registry length mismatch ${length}/${listed.length}`);
      if(new Set(listed.map(normalizeAddress)).size!==listed.length)throw new Error('Duplicate BAMM registry identity');
      const fraxswapFactory=address(p2.get(12).result),feeTo=address(p2.get(13).result);
      if(!sameAddress(fraxswapFactory,FRAXSWAP_FACTORY_FRAXTAL))throw new Error(`Fraxswap factory identity drift ${fraxswapFactory}`);

      let id=1000;const calls=[];const ids=[];
      for(const bamm of listed){
        const x={bamm,base:id};ids.push(x);
        calls.push(call(id++,bamm,S.version),call(id++,bamm,S.factory),call(id++,bamm,S.pair),call(id++,bamm,S.token0),call(id++,bamm,S.token1),
          call(id++,bamm,S.sqrtRented),call(id++,bamm,S.rentedMultiplier),call(id++,bamm,S.timeSinceLastInterestPayment),call(id++,bamm,S.fullUtilizationRate),
          call(id++,bamm,S.variableInterestRate),call(id++,bamm,S.iBammErc20),call(id++,bamm,S.FEE_SHARE),call(id++,bamm,S.MAX_UTILITY_RATE),call(id++,bamm,S.PRECISION),
          call(id++,BAMM_FACTORY_FRAXTAL,S.isBamm+addrArg(bamm)));
      }
      const p3=await batchedCalls(endpoint.url,calls,fetchImpl);
      const draft=[];
      for(const x of ids){
        let n=x.base;const ver=words(p3.get(n++).result).slice(0,3).map(Number),factory=address(p3.get(n++).result),pair=address(p3.get(n++).result),token0=address(p3.get(n++).result),token1=address(p3.get(n++).result);
        const sqrtRented=signed256(word(p3.get(n++).result)),rentedMultiplier=word(p3.get(n++).result),lastInterest=word(p3.get(n++).result),fullUtil=word(p3.get(n++).result),rateContract=address(p3.get(n++).result),wrapper=address(p3.get(n++).result);
        const feeShare=word(p3.get(n++).result),maxUtility=word(p3.get(n++).result),precision=word(p3.get(n++).result),registered=bool(p3.get(n++).result);
        if(ver.join('.')!=='0.5.2')throw new Error(`Unsupported BAMM version ${ver.join('.')} at ${x.bamm}`);
        if(!sameAddress(factory,BAMM_FACTORY_FRAXTAL)||!registered)throw new Error(`BAMM factory membership drift ${x.bamm}`);
        if(sqrtRented<0n||precision!==E18||maxUtility!==950000000000000000n||feeShare!==1000n)throw new Error(`BAMM constants/accounting drift ${x.bamm}`);
        draft.push({...x,ver,factory,pair,token0,token1,sqrtRented,rentedMultiplier,lastInterest,fullUtil,rateContract,wrapper,feeShare,maxUtility,precision});
      }

      const pairCalls=[];id=50000;
      for(const d of draft){
        d.pairBase=id;
        pairCalls.push(call(id++,d.pair,S.factory),call(id++,d.pair,S.token0),call(id++,d.pair,S.token1),call(id++,d.pair,S.getReserves),call(id++,d.pair,S.totalSupply),
          call(id++,d.pair,S.balanceOf+addrArg(d.bamm)),call(id++,BAMM_FACTORY_FRAXTAL,S.pairToBamm+addrArg(d.pair)),call(id++,d.wrapper,S.totalSupply));
      }
      const p4=await batchedCalls(endpoint.url,pairCalls,fetchImpl);
      for(const d of draft){
        let n=d.pairBase;const pairFactory=address(p4.get(n++).result),pairToken0=address(p4.get(n++).result),pairToken1=address(p4.get(n++).result),res=words(p4.get(n++).result),pairSupply=word(p4.get(n++).result),pairBalance=word(p4.get(n++).result),mappedBamm=address(p4.get(n++).result),wrapperSupply=word(p4.get(n++).result);
        if(!sameAddress(pairFactory,fraxswapFactory)||!sameAddress(pairToken0,d.token0)||!sameAddress(pairToken1,d.token1)||!sameAddress(mappedBamm,d.bamm))throw new Error(`BAMM/Fraxswap pair identity drift ${d.bamm}`);
        if(res.length<2)throw new Error(`Fraxswap reserves unavailable ${d.pair}`);
        const reserve0=res[0],reserve1=res[1],sqrtReserve=isqrt(reserve0*reserve1),sqrtBalance=pairSupply===0n?0n:(pairBalance*sqrtReserve)/pairSupply;
        const sqrtRentedReal=(d.sqrtRented*d.rentedMultiplier)/d.precision,den=sqrtBalance+sqrtRentedReal,utility=den===0n?0n:(sqrtRentedReal*d.precision)/den;
        if(utility>d.maxUtility)throw new Error(`BAMM utility exceeds protocol maximum ${d.bamm}`);
        Object.assign(d,{pairSupply,pairBalance,wrapperSupply,reserve0,reserve1,sqrtReserve,sqrtBalance,sqrtRentedReal,utility});
      }

      const rateCalls=[];id=90000;for(const d of draft){d.rateId=id;rateCalls.push(call(id++,d.bamm,S.previewInterestRate+uintArg(d.utility)));}
      const p5=await batchedCalls(endpoint.url,rateCalls,fetchImpl);
      const rows=draft.map(d=>{
        const rate=word(p5.get(d.rateId).result);
        return {bamm:d.bamm,pair:d.pair,token0:d.token0,token1:d.token1,wrapper:d.wrapper,rateContract:d.rateContract,version:d.ver.join('.'),
          identity:{factoryMembershipProven:true,pairFactoryProven:true,pairToBammMappingProven:true,tokenIdentityParityProven:true},
          raw:{reserve0:d.reserve0.toString(),reserve1:d.reserve1.toString(),pairTotalSupply:d.pairSupply.toString(),pairBalanceHeldByBamm:d.pairBalance.toString(),wrapperTotalSupply:d.wrapperSupply.toString(),sqrtRented:d.sqrtRented.toString(),rentedMultiplier:d.rentedMultiplier.toString(),sqrtBalance:d.sqrtBalance.toString(),sqrtRentedReal:d.sqrtRentedReal.toString(),utility:d.utility.toString(),borrowRatePerSecond:rate.toString(),fullUtilizationRate:d.fullUtil.toString(),lastInterestTimestamp:d.lastInterest.toString()},
          values:{utilityPct:round(Number(d.utility)*100/1e18,8),borrowRatePerSecond:round(Number(rate)/1e18,18),protocolInterestFeeSharePct:Number(d.feeShare)/100},
          epistemic:{pairState:'MEASURED-current-exact-block',utility:'DERIVED-MECHANICAL-protocol-native-formula',borrowRate:'DERIVED-MECHANICAL-previewInterestRate',volume:'UNKNOWN',swapFees:'UNKNOWN',lenderYield:'UNKNOWN'}};
      });

      return {version:FRAX_BAMM_ONCHAIN_VERSION,status:'ok',measurementClass:'MEASURED',observedAt:new Date(timestamp*1000).toISOString(),chain:'fraxtal',chainId:FRAXTAL_CHAIN_ID,blockNumber:Number(blockNumber),blockTag,blockHash:block.hash,
        contracts:{bammFactory:BAMM_FACTORY_FRAXTAL,fraxswapFactory,feeTo},registry:{bammCount:rows.length,allRegistryIdentitiesProven:true,activeRentedBammCount:rows.filter(r=>BigInt(r.raw.sqrtRentedReal)>0n).length},bamms:rows,
        identities:{selectionRule:'all addresses returned by official BAMMFactory.bammsArray at the same exact block; no hand-picked market',heterogeneousUnitsNotAggregated:true},
        provenance:{officialDocs:'docs.frax.com/protocol/subprotocols/bamm/addresses',officialSourceRepository:'FraxFinance/public-frax-bamm',officialSourceRef:OFFICIAL_BAMM_SOURCE_REF,publicRpc:'official Fraxtal RPC with PublicNode failover'},
        rpc:{endpointId:endpoint.id,failoverAttempts:attempts},
        epistemic:{currentStateMeasured:true,registryWide:true,rentedLiquidityToUtility:'PROVEN-MECHANICAL',utilityToBorrowRate:'PROVEN-MECHANICAL-protocol-view',swapVolumeFees:'UNKNOWN',twammOrderFlow:'UNKNOWN',lenderIntervalYield:'UNKNOWN',revenueRouting:'UNKNOWN',upstreamWhyRentChanged:'UNKNOWN',unknownIsZero:false,annualizationPerformed:false,protocolWideAprClaim:false,causalClaimAuthority:'none',executionAuthority:'none'}};
    }catch(error){attempts.push({endpointId:endpoint.id,error:error instanceof Error?error.message:String(error)});}
  }
  return unknown(attempts);
}

export function applyFraxBammOnchainMeasurement({state,previousState,measurement}){
  if(!state||typeof state!=='object')throw new Error('Frax BAMM adapter requires Economic Graph state');
  if(state?.authority?.executionAuthority!=='none'||state?.authority?.causalClaimAuthority!=='none')throw new Error('Frax BAMM adapter refuses Graph authority drift');
  const evidence=state?.protocolEvidence?.[FRAX_ECOSYSTEM_EVIDENCE_ID],base=evidence?.latest?.observation,fraxSensor=state?.protocolSensors?.[FRAX_PROTOCOL_ID];
  if(!evidence||!base||!fraxSensor)throw new Error('Frax ecosystem evidence missing before BAMM enrichment');
  const current=structuredClone(base),surface=current?.surfaces?.fraxswapBamm;if(!surface)throw new Error('Fraxswap/BAMM surface missing');
  const valid=measurement?.status==='ok'&&measurement?.measurementClass==='MEASURED'&&measurement?.registry?.allRegistryIdentitiesProven===true&&Number(measurement?.registry?.bammCount)>0&&Array.isArray(measurement?.bamms)&&measurement.bamms.length===Number(measurement.registry.bammCount);
  if(valid){
    surface.measurementState='MEASURED-current-onchain-bamm-registry';surface.measured=measurement;
    surface.mechanicalRelations=surface.mechanicalRelations.map(r=>r.from==='rented liquidity'&&r.to==='borrow interest'?{...r,class:'MECHANICAL-proven-current-BAMM-utility-rate-path'}:r);
  }else{surface.measurementState='UNKNOWN-current-onchain-read-unavailable';surface.measured=measurement||unknown([]);}
  const surfaces=Object.values(current.surfaces||{}),measured=surfaces.filter(s=>String(s.measurementState||'').startsWith('MEASURED'));
  current.coverage.measuredSurfaceCount=measured.length;current.coverage.sourceBoundUnknownSurfaceCount=surfaces.length-measured.length;
  current.relationshipGraph=surfaces.flatMap(s=>s.mechanicalRelations.map((r,index)=>({surfaceId:s.id,index,...r})));
  current.coverage.relationshipCount=current.relationshipGraph.length;current.coverage.relationshipClassCounts=current.relationshipGraph.reduce((a,r)=>{const k=String(r.class||'UNKNOWN').split('-')[0];a[k]=(a[k]||0)+1;return a;},{});
  current.status=current.coverage.sourceBoundUnknownSurfaceCount===0?'deep-sensor-family-fully-measured':'deep-sensor-family-active-partial-measurement';
  current.epistemic.measuredEconomicSurfaces=measured.map(s=>s.id);current.epistemic.bammRegistryState=valid?'MEASURED-registry-wide':'UNKNOWN';current.epistemic.bammUtility=valid?'DERIVED-MECHANICAL':'UNKNOWN';current.epistemic.bammBorrowRate=valid?'DERIVED-MECHANICAL':'UNKNOWN';current.epistemic.fraxswapVolumeFees='UNKNOWN-not-yet-measured';current.epistemic.bammLenderYield='UNKNOWN-not-yet-longitudinal';
  current.measurementExtensions={...(current.measurementExtensions||{}),bammOnchain:FRAX_BAMM_ONCHAIN_VERSION};
  current.nextMeasurementUnlocks=(current.nextMeasurementUnlocks||[]).map(x=>String(x).startsWith('Enumerate Fraxswap pairs')?'BAMM registry topology and rented-liquidity utility/rate state are now measured; next add Fraxswap pair volume/fee flow and BAMM lender longitudinal yield without aggregating heterogeneous units.':x);
  current.id=`frax-ecosystem:${sha256(stableStringify({priorId:base.id,bamm:valid?{blockNumber:measurement.blockNumber,blockHash:measurement.blockHash,bammCount:measurement.registry.bammCount,rows:measurement.bamms.map(r=>[r.bamm,r.pair,r.raw.utility,r.raw.borrowRatePerSecond])}:{status:measurement?.status||'UNKNOWN'},surfaceIds:current.coverage.surfaceIds})).slice(0,24)}`;
  const prevRows=Array.isArray(previousState?.protocolEvidence?.[FRAX_ECOSYSTEM_EVIDENCE_ID]?.observations)?previousState.protocolEvidence[FRAX_ECOSYSTEM_EVIDENCE_ID].observations:[];const rows=[...prevRows];if(!rows.some(r=>r?.id===current.id))rows.push(current);const bounded=rows.slice(-MAX_OBSERVATIONS);
  evidence.latest={observation:current};evidence.status=current.status;evidence.observations=bounded;evidence.observationCount=bounded.length;evidence.measurementExtensions={...(evidence.measurementExtensions||{}),bammOnchain:FRAX_BAMM_ONCHAIN_VERSION};
  fraxSensor.ecosystemFamily={...(fraxSensor.ecosystemFamily||{}),status:current.status,measuredSurfaceCount:current.coverage.measuredSurfaceCount,sourceBoundUnknownSurfaceCount:current.coverage.sourceBoundUnknownSurfaceCount,latestObservationId:current.id,measurementExtensions:{...(fraxSensor.ecosystemFamily?.measurementExtensions||{}),bammOnchain:FRAX_BAMM_ONCHAIN_VERSION}};if(fraxSensor?.latest?.observation)fraxSensor.latest.observation.ecosystemFamily=fraxSensor.ecosystemFamily;
  if(current.coverage.surfaceCount!==surfaces.length||current.coverage.surfaceCount!==9)throw new Error('Frax BAMM surface count drift');
  if(current.coverage.measuredSurfaceCount+current.coverage.sourceBoundUnknownSurfaceCount!==current.coverage.surfaceCount)throw new Error('Frax BAMM depth accounting drift');
  if(valid&&!current.epistemic.measuredEconomicSurfaces.includes('fraxswap-bamm'))throw new Error('BAMM measured surface promotion missing');
  if(current?.authority?.executionAuthority!=='none'||current?.epistemic?.executionAuthority!=='none'||measurement?.epistemic?.executionAuthority!=='none')throw new Error('Frax BAMM execution authority leaked');
  return state;
}
