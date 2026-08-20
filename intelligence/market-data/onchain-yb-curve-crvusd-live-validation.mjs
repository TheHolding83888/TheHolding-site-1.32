import fs from 'node:fs';
import { mergeOnchainRegistryExtensions, resolveOnchainPrices } from './onchain-price-resolver.mjs';

const base=JSON.parse(fs.readFileSync('intelligence/market-data/onchain-price-source-registry.json','utf8'));
const ext=JSON.parse(fs.readFileSync('intelligence/market-data/onchain-price-source-registry-extensions.json','utf8'));
const marketData=JSON.parse(fs.readFileSync('intelligence/market-data/market-data.json','utf8'));
const effective=mergeOnchainRegistryExtensions(base,ext);
const route=effective.assets?.['yield-basis']?.route;

const exact={
  type:'curve-ema-chainlink-quote',network:'ethereum',pool:'0xec977f46467a3021785cff88894886e617abd65b',
  token:'0x01791f726b4103694969820be083196cc7c045ff',quoteToken:'0xf939e0a03fb07f59a73314e73794be0e57ac1b4e',
  quoteFeed:'0xeef0c605546958c1f899b6fb336c20671f9cd49f'
};
if(!route||route.type!==exact.type||route.network!==exact.network)throw new Error('YB Curve/Chainlink route identity drift');
for(const [field,value] of [['pool',exact.pool],['token',exact.token],['quoteToken',exact.quoteToken]])if(String(route[field]).toLowerCase()!==value)throw new Error(`YB ${field} drift`);
if(String(route.quoteFeed?.contract).toLowerCase()!==exact.quoteFeed)throw new Error('YB crvUSD/USD Chainlink feed drift');
if(route.quoteFeed?.type!=='chainlink-v3'||route.quoteFeed?.quote!=='USD'||Number(route.quoteFeed?.maxAgeSeconds)!==90000)throw new Error('YB quote-feed safety contract drift');
if(route.oracleDirection!=='coin0-per-coin1'||String(route.oracleScale)!=='1000000000000000000')throw new Error('YB Curve oracle direction/scale drift');
if(route.quoteAssetId!=='ethereum-crvusd-usd'||route.feedQuote!=='crvUSD'||route.outputQuote!=='USD')throw new Error('YB composition contract drift');
if(route.authority!=='shadow'||ext.semantics?.productionPriceAuthority!==false||ext.semantics?.executionAuthority!=='none')throw new Error('YB authority boundary drift');
if(ext.semantics?.stablecoinPegHardcoded!==false)throw new Error('Stablecoin hardcoded peg introduced');

const result=await resolveOnchainPrices({
  registry:{...effective,assets:{'yield-basis':effective.assets['yield-basis']}},
  marketData
});
const obs=result.observations?.['yield-basis'];
console.log('YB Curve/crvUSD top-level LIVE proof',JSON.stringify({
  resolverVersion:result.version,engineVersion:result.engineVersion,status:result.status,coverage:result.coverage,
  source:obs?.source,usd:obs?.usd,canonicalPriceUsd:obs?.canonicalPriceUsd,divergencePct:obs?.divergencePct,
  quoteFeedUsd:obs?.quoteFeedUsd,quoteFeedAgeSeconds:obs?.quoteFeedAgeSeconds,
  pool:obs?.pool,coin0:obs?.coin0,coin1:obs?.coin1,blockNumber:obs?.blockNumber,
  productionPriceAuthority:obs?.productionPriceAuthority,executionAuthority:result.authority?.executionAuthority
},null,2));
if(result.coverage?.assetCount!==1||result.coverage?.okCount!==1||result.coverage?.warningCount!==0||result.coverage?.unavailableCount!==0)throw new Error('YB isolated coverage is not 1/1 GREEN');
if(result.status!=='ok'||obs?.status!=='shadow-ok'||obs?.source!=='curve-ema-chainlink-quote')throw new Error(`YB live route unhealthy: ${obs?.status||'missing'}`);
if(!(Number(obs.usd)>0)||!(Number(obs.divergencePct)<10))throw new Error('YB live price sanity failed');
if(!(Number(obs.quoteFeedUsd)>0)||!(Number(obs.quoteFeedAgeSeconds)<=90000))throw new Error('YB Chainlink crvUSD dependency unhealthy');
if(obs.productionPriceAuthority!==false||result.authority?.executionAuthority!=='none')throw new Error('YB authority escaped Shadow boundary');
