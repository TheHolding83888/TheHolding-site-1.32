import fs from 'node:fs';
import { resolveCurveEmaPrices } from './onchain-curve-ema.mjs';

const registryBase=JSON.parse(fs.readFileSync('intelligence/market-data/onchain-price-source-registry.json','utf8'));
const marketData=JSON.parse(fs.readFileSync('intelligence/market-data/market-data.json','utf8'));
const network=registryBase.networks.ethereum;
const CRVUSD='0xf939e0a03fb07f59a73314e73794be0e57ac1b4e';
const YB='0x01791f726b4103694969820be083196cc7c045ff';
const POOL='0xec977f46467a3021785cff88894886e617abd65b';
const CRVUSD_USD_FEED='0xEEf0C605546958c1f899b6fB336C20671f9cD49F';
const DECIMALS='0x313ce567';
const LATEST='0xfeaf968c';

async function call(to,data){
  const attempts=[];
  for(const ep of network.rpcFailover){
    try{
      const r=await fetch(ep.url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'eth_call',params:[{to,data},'latest']}),signal:AbortSignal.timeout(10000)});
      if(!r.ok)throw new Error(`HTTP ${r.status}`);
      const j=await r.json(); if(j.error)throw new Error(j.error.message||JSON.stringify(j.error));
      return {result:j.result,endpointId:ep.id};
    }catch(e){attempts.push(`${ep.id}:${e instanceof Error?e.message:String(e)}`);}
  }
  throw new Error(`Ethereum RPC unavailable: ${attempts.join(' | ')}`);
}
function word(hex,i){const clean=String(hex).replace(/^0x/,'');const p=clean.slice(i*64,(i+1)*64);if(p.length!==64)throw new Error(`word ${i} missing`);return BigInt('0x'+p);}
const dec=Number(word((await call(CRVUSD_USD_FEED,DECIMALS)).result,0));
const round=(await call(CRVUSD_USD_FEED,LATEST)).result;
const answerRaw=word(round,1);
const updatedAt=Number(word(round,3));
const roundId=word(round,0); const answeredInRound=word(round,4);
const crvUsd=Number(answerRaw)/10**dec;
const age=Math.floor(Date.now()/1000)-updatedAt;
if(!(crvUsd>0)||age>90000||answeredInRound<roundId)throw new Error(`crvUSD/USD feed unhealthy price=${crvUsd} age=${age}`);

const coreObservations={crvusd:{assetId:'crvusd',symbol:'crvUSD',usd:crvUsd,status:'shadow-ok',source:'chainlink-v3',productionPriceAuthority:false,feedAgeSeconds:age}};
const registry={
  networks:{ethereum:network},
  assets:{
    'yield-basis':{assetId:'yield-basis',symbol:'YB',route:{
      type:'curve-ema-relative',network:'ethereum',pool:POOL,token:YB,quoteToken:CRVUSD,
      oracleDirection:'coin0-per-coin1',oracleScale:'1000000000000000000',quoteAssetId:'crvusd',feedQuote:'crvUSD',outputQuote:'USD',maxDivergencePct:10,authority:'shadow'
    }}
  }
};
const out=await resolveCurveEmaPrices({registry,marketData,coreObservations});
const obs=out.observations?.['yield-basis'];
console.log('YB Curve/crvUSD candidate LIVE proof');
console.log(JSON.stringify({
  chainlinkCrvUsdUsd:crvUsd,chainlinkAgeSeconds:age,pool:POOL,
  status:obs?.status,usd:obs?.usd,canonicalPriceUsd:obs?.canonicalPriceUsd,
  divergencePct:obs?.divergencePct,feedValueCrvUsdPerYb:obs?.feedValue,
  coin0:obs?.coin0,coin1:obs?.coin1,blockNumber:obs?.blockNumber,
  productionPriceAuthority:obs?.productionPriceAuthority
},null,2));
if(obs?.status!=='shadow-ok')throw new Error(`YB Curve/crvUSD candidate not healthy: ${obs?.status} ${obs?.error||''}`);
if(!(Number(obs?.usd)>0)||!(Number(obs?.divergencePct)<10))throw new Error('YB Curve/crvUSD price sanity failed');
