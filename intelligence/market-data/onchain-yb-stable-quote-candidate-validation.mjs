import fs from 'node:fs';
import { resolveUniswapV3ChainlinkQuotePrices } from './onchain-uniswap-v3-chainlink-quote.mjs';

const base = JSON.parse(fs.readFileSync('intelligence/market-data/onchain-price-source-registry.json','utf8'));
const marketData = JSON.parse(fs.readFileSync('intelligence/market-data/market-data.json','utf8'));
const canonical = Number(marketData?.prices?.['yield-basis']?.usd ?? marketData?.assets?.['yield-basis']?.usd ?? marketData?.['yield-basis']?.usd ?? 0);
if (!(canonical > 0)) throw new Error('Canonical YB price unavailable');

const YB='0x01791f726b4103694969820be083196cc7c045ff';
const FACTORY='0x1F98431c8aD98523631AE4a59f267346ea31F984';
const candidates=[
  {name:'YB/USDC 1%',quoteToken:'0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',feed:'0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6',feedQuote:'USDC'},
  {name:'YB/USDT 1%',quoteToken:'0xdAC17F958D2ee523a2206206994597C13D831ec7',feed:'0x3E7d1eAB13ad0104d2750B8863b489D65364e32D',feedQuote:'USDT'}
];

const results=[];
for(const candidate of candidates){
  const registry={
    ...base,
    assets:{
      'yield-basis':{
        assetId:'yield-basis',symbol:'YB',route:{
          type:'uniswap-v3-twap-chainlink-quote',network:'ethereum',factory:FACTORY,token:YB,
          quoteToken:candidate.quoteToken,fee:10000,twapWindowSeconds:3600,
          quoteAssetId:`ethereum-${candidate.feedQuote.toLowerCase()}-usd`,
          quoteFeed:{type:'chainlink-v3',contract:candidate.feed,maxAgeSeconds:90000,quote:'USD'},
          feedQuote:candidate.feedQuote,outputQuote:'USD',maxDivergencePct:10,authority:'shadow'
        }
      }
    }
  };
  const out=await resolveUniswapV3ChainlinkQuotePrices({registry,marketData});
  const obs=out.observations?.['yield-basis'];
  const usd=Number(obs?.usd || 0);
  results.push({
    name:candidate.name,status:obs?.status,usd:usd||null,canonicalUsd:canonical,
    divergencePct:usd>0?Math.abs(usd-canonical)/canonical*100:null,
    pool:obs?.pool||null,twapWindowSeconds:obs?.twapWindowSeconds||3600,
    quoteFeedUsd:obs?.quoteFeedUsd??null,quoteFeedAgeSeconds:obs?.quoteFeedAgeSeconds??null,
    rpcEndpointId:obs?.rpcEndpointId||null,productionPriceAuthority:obs?.productionPriceAuthority
  });
}
console.log('YB stable-quote candidate LIVE comparison');
console.log(JSON.stringify(results,null,2));
const healthy=results.filter(x=>x.status==='shadow-ok'&&x.usd>0&&x.divergencePct<10);
if(!healthy.length) throw new Error('No healthy YB stable-quote candidate');
healthy.sort((a,b)=>a.divergencePct-b.divergencePct);
console.log('RECOMMENDED='+JSON.stringify(healthy[0]));
