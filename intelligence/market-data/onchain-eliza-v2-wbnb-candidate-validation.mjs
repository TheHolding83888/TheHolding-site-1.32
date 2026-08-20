import fs from 'node:fs';
import { resolveUniswapV2HistoricalTwapPrices } from './onchain-uniswap-v2-historical-twap.mjs';
import { mergeOnchainRegistryExtensions } from './onchain-price-resolver.mjs';
import { decodeChainlinkRoundData, decodeUint256 } from './onchain-price-resolver-core.mjs';

const BASE = JSON.parse(fs.readFileSync('intelligence/market-data/onchain-price-source-registry.json','utf8'));
const EXT = JSON.parse(fs.readFileSync('intelligence/market-data/onchain-price-source-registry-extensions.json','utf8'));
const MARKET = JSON.parse(fs.readFileSync('intelligence/market-data/market-data.json','utf8'));
const EFFECTIVE = mergeOnchainRegistryExtensions(BASE, EXT);
const NETWORK = EFFECTIVE.networks?.bsc;
if (!NETWORK) throw new Error('BSC network missing from effective registry');

const ELIZA = '0xea17Df5Cf6D172224892B5477A16ACb111182478';
const WBNB = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c';
const PAIR = '0x8f4D179d3b4FaA728Ee25845f673eF80DeA2cE5e';
const BNB_USD = '0x0567F2323251f0Aab15c8DfB1967E4e8A7D42aeE';
const DECIMALS = '0x313ce567';
const LATEST_ROUND_DATA = '0xfeaf968c';
const TOKEN0 = '0x0dfe1681';
const TOKEN1 = '0xd21220a7';
const GET_RESERVES = '0x0902f1ac';
const LOOKBACKS = [800, 1600, 3200, 6400];

async function post(endpoint, payload) {
  const response = await fetch(endpoint.url, {
    method: 'POST', headers: {'content-type':'application/json'}, body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10000)
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const body = await response.json();
  if (!Array.isArray(body)) throw new Error('RPC batch response not array');
  return new Map(body.map(row => [Number(row.id), row]));
}
async function batch(payload) {
  const errors=[];
  for (const endpoint of NETWORK.rpcFailover || []) {
    try { return { byId: await post(endpoint,payload), endpointId:endpoint.id }; }
    catch (error) { errors.push(`${endpoint.id}:${error instanceof Error?error.message:String(error)}`); }
  }
  throw new Error(`All BSC public RPC endpoints failed: ${errors.join(' | ')}`);
}
function addressFrom(hex) {
  const clean=String(hex||'').replace(/^0x/,'');
  if(clean.length<64) throw new Error('address decode failed');
  return `0x${clean.slice(24,64)}`;
}
function reserveWords(hex) {
  const clean=String(hex||'').replace(/^0x/,'');
  const word=i=>BigInt(`0x${clean.slice(i*64,(i+1)*64)}`);
  return { reserve0:word(0), reserve1:word(1) };
}

const preflightPayload = [
  {jsonrpc:'2.0',id:1,method:'eth_call',params:[{to:PAIR,data:TOKEN0},'latest']},
  {jsonrpc:'2.0',id:2,method:'eth_call',params:[{to:PAIR,data:TOKEN1},'latest']},
  {jsonrpc:'2.0',id:3,method:'eth_call',params:[{to:PAIR,data:GET_RESERVES},'latest']},
  {jsonrpc:'2.0',id:4,method:'eth_call',params:[{to:ELIZA,data:DECIMALS},'latest']},
  {jsonrpc:'2.0',id:5,method:'eth_call',params:[{to:WBNB,data:DECIMALS},'latest']},
  {jsonrpc:'2.0',id:6,method:'eth_call',params:[{to:BNB_USD,data:DECIMALS},'latest']},
  {jsonrpc:'2.0',id:7,method:'eth_call',params:[{to:BNB_USD,data:LATEST_ROUND_DATA},'latest']}
];
const preflight = await batch(preflightPayload);
for (let id=1; id<=7; id++) {
  const row=preflight.byId.get(id);
  if (row?.error || !row?.result) throw new Error(`Preflight RPC ${id} failed: ${row?.error?.message || 'missing result'}`);
}
const token0=addressFrom(preflight.byId.get(1).result);
const token1=addressFrom(preflight.byId.get(2).result);
const reserves=reserveWords(preflight.byId.get(3).result);
const elizaDecimals=Number(decodeUint256(preflight.byId.get(4).result));
const wbnbDecimals=Number(decodeUint256(preflight.byId.get(5).result));
const feedDecimals=Number(decodeUint256(preflight.byId.get(6).result));
const round=decodeChainlinkRoundData(preflight.byId.get(7).result);
const bnbUsd=Number(round.answer) / 10 ** feedDecimals;
const feedAgeSeconds=Math.max(0,Math.floor(Date.now()/1000)-Number(round.updatedAt));
if (!(bnbUsd>0) || feedAgeSeconds>7200 || round.answeredInRound<round.roundId) throw new Error('BNB/USD Chainlink dependency unhealthy');
if (new Set([token0.toLowerCase(),token1.toLowerCase()]).size !== 2) throw new Error('Pair token identity invalid');
if (![token0.toLowerCase(),token1.toLowerCase()].includes(ELIZA.toLowerCase()) || ![token0.toLowerCase(),token1.toLowerCase()].includes(WBNB.toLowerCase())) throw new Error(`Pair token mismatch: ${token0}/${token1}`);
if (reserves.reserve0<=0n || reserves.reserve1<=0n) throw new Error('ELIZA/WBNB V2 pair has zero reserves');
if (elizaDecimals!==9 || wbnbDecimals!==18) throw new Error(`Unexpected decimals ELIZA=${elizaDecimals} WBNB=${wbnbDecimals}`);

const dependency={assetId:'binancecoin',symbol:'BNB',usd:bnbUsd,status:'shadow-ok',authority:'shadow',source:'chainlink-v3-quote-dependency',productionPriceAuthority:false};
const candidates=[];
for (const lookbackBlocks of LOOKBACKS) {
  const route={
    type:'uniswap-v2-historical-twap-relative', network:'bsc', pair:PAIR, token:ELIZA, quoteToken:WBNB,
    tokenDecimals:elizaDecimals, quoteTokenDecimals:wbnbDecimals, lookbackBlocks,
    minTwapWindowSeconds:300, maxTwapWindowSeconds:7200, quoteAssetId:'binancecoin', feedQuote:'BNB', outputQuote:'USD',
    maxDivergencePct:10, authority:'shadow'
  };
  const result=await resolveUniswapV2HistoricalTwapPrices({
    registry:{...EFFECTIVE,assets:{elizaos:{assetId:'elizaos',symbol:'ELIZA',route}}},
    marketData:MARKET, coreObservations:{binancecoin:dependency}
  });
  const obs=result.observations?.elizaos || null;
  candidates.push({lookbackBlocks,status:obs?.status||'missing',usd:obs?.usd??null,canonicalPriceUsd:obs?.canonicalPriceUsd??null,divergencePct:obs?.divergencePct??null,effectiveTwapWindowSeconds:obs?.effectiveTwapWindowSeconds??null,currentReserve0Raw:obs?.currentReserve0Raw??null,currentReserve1Raw:obs?.currentReserve1Raw??null,rpcEndpointId:obs?.rpcEndpointId??null,twapRpcEndpointId:obs?.twapRpcEndpointId??null,error:obs?.error??null});
}

console.log('ELIZA V2/WBNB historical TWAP LIVE discovery');
console.log(JSON.stringify({pair:PAIR,token0,token1,elizaDecimals,wbnbDecimals,currentReserve0Raw:reserves.reserve0.toString(),currentReserve1Raw:reserves.reserve1.toString(),bnbUsd,chainlinkFeed:BNB_USD,chainlinkFeedAgeSeconds:feedAgeSeconds,preflightRpcEndpointId:preflight.endpointId,canonicalUsd:MARKET.prices?.elizaos?.usd,candidates},null,2));
const healthy=candidates.filter(x=>x.status==='shadow-ok' && Number(x.effectiveTwapWindowSeconds)>=300 && Number(x.divergencePct)<=10);
if (!healthy.length) throw new Error('No healthy ELIZA V2/WBNB historical TWAP candidate');
healthy.sort((a,b)=>Number(b.effectiveTwapWindowSeconds)-Number(a.effectiveTwapWindowSeconds));
console.log('BEST_ELIZA_V2_CANDIDATE='+JSON.stringify(healthy[0]));
