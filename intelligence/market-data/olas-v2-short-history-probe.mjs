import fs from 'node:fs';
import { resolveUniswapV2HistoricalTwapPrices } from './onchain-uniswap-v2-historical-twap.mjs';
const base=JSON.parse(fs.readFileSync(new URL('./onchain-price-source-registry.json',import.meta.url),'utf8'));
const market=JSON.parse(fs.readFileSync(new URL('./market-data.json',import.meta.url),'utf8'));
const ethUsd=Number(market.prices?.ethereum?.usd);const olasUsd=Number(market.prices?.autonolas?.usd);
const route={assetId:'autonolas',symbol:'OLAS',route:{
 type:'uniswap-v2-historical-twap-relative',network:'ethereum',pair:'0x09D1d767eDF8Fa23A64C51fa559E0688E526812F',
 token:'0x0001A500A6B18995B03f44bb040A5fFc28E45CB0',quoteToken:'0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
 tokenDecimals:18,quoteTokenDecimals:18,lookbackBlocks:60,minTwapWindowSeconds:500,maxTwapWindowSeconds:1100,
 quoteAssetId:'ethereum',feedQuote:'ETH',outputQuote:'USD',maxDivergencePct:10,authority:'shadow'
}};
const out=await resolveUniswapV2HistoricalTwapPrices({registry:{networks:{ethereum:base.networks.ethereum},assets:{autonolas:route}},marketData:{prices:{autonolas:{usd:olasUsd}}},coreObservations:{ethereum:{status:'shadow-ok',usd:ethUsd}}});
console.log(JSON.stringify({coverage:out.coverage,network:out.networks?.ethereum,observation:out.observations?.autonolas},null,2));
if(out.observations?.autonolas?.status!=='shadow-ok')process.exit(21);
