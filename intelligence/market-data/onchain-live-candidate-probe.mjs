import fs from 'node:fs';
import { resolveUniswapV3TwapPrices } from './onchain-uniswap-v3-twap.mjs';
import { resolveUniswapV3ChainlinkQuotePrices } from './onchain-uniswap-v3-chainlink-quote.mjs';

const base = JSON.parse(fs.readFileSync(new URL('./onchain-price-source-registry.json', import.meta.url), 'utf8'));
const market = JSON.parse(fs.readFileSync(new URL('./market-data.json', import.meta.url), 'utf8'));
const ETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
const UNI_V3 = '0x1F98431c8aD98523631AE4a59f267346ea31F984';
const OLAS = '0x0001A500A6B18995B03f44bb040A5fFc28E45CB0';
const BEAM = '0x62D0A8458eD7719FDAF978fe5929C6D342B0bFcE';
const ELIZA = '0xea17Df5Cf6D172224892B5477A16ACb111182478';
const BSC_USDC = '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d';
const PANCAKE_V3 = '0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865';
const BSC_USDC_USD = '0x51597f405303C4377E36123cBc172b13269EA163';

const ethUsd = Number(market.prices?.ethereum?.usd);
if (!(ethUsd > 0)) throw new Error('Canonical ETH/USD missing for diagnostic dependency');
const coreObservations = { ethereum: { assetId: 'ethereum', status: 'shadow-ok', usd: ethUsd } };
const canonicalOlas = Number(market.prices?.autonolas?.usd);
const canonicalBeam = Number(market.prices?.['beam-2']?.usd);
const canonicalEliza = Number(market.prices?.elizaos?.usd);

function v3Route(assetId, symbol, token, fee, seconds) {
  return {
    assetId,
    symbol,
    route: {
      type: 'uniswap-v3-twap-relative', network: 'ethereum', factory: UNI_V3,
      token, quoteToken: ETH, tokenDecimals: 18, quoteTokenDecimals: 18,
      fee, twapWindowSeconds: seconds, quoteAssetId: 'ethereum', feedQuote: 'ETH', outputQuote: 'USD',
      maxDivergencePct: 10, authority: 'shadow'
    }
  };
}

const v3Assets = {
  olas_v3_1pct_1800: v3Route('olas_v3_1pct_1800','OLAS',OLAS,10000,1800),
  olas_v3_1pct_300: v3Route('olas_v3_1pct_300','OLAS',OLAS,10000,300),
  beam_v3_1pct_1800: v3Route('beam_v3_1pct_1800','BEAM',BEAM,10000,1800),
  beam_v3_1pct_300: v3Route('beam_v3_1pct_300','BEAM',BEAM,10000,300),
  beam_v3_03pct_1800: v3Route('beam_v3_03pct_1800','BEAM',BEAM,3000,1800),
  beam_v3_03pct_300: v3Route('beam_v3_03pct_300','BEAM',BEAM,3000,300)
};
const v3Market = { prices: {
  olas_v3_1pct_1800:{usd:canonicalOlas}, olas_v3_1pct_300:{usd:canonicalOlas},
  beam_v3_1pct_1800:{usd:canonicalBeam}, beam_v3_1pct_300:{usd:canonicalBeam},
  beam_v3_03pct_1800:{usd:canonicalBeam}, beam_v3_03pct_300:{usd:canonicalBeam}
} };
const v3 = await resolveUniswapV3TwapPrices({ registry:{networks:{ethereum:base.networks.ethereum},assets:v3Assets}, marketData:v3Market, coreObservations });

function elizaRoute(id, seconds) {
  return { assetId:id, symbol:'ELIZA', route:{
    type:'uniswap-v3-twap-chainlink-quote', network:'bsc', factory:PANCAKE_V3,
    token:ELIZA, quoteToken:BSC_USDC, fee:2500, twapWindowSeconds:seconds,
    quoteAssetId:'bsc-usdc-usd', quoteFeed:{type:'chainlink-v3',contract:BSC_USDC_USD,maxAgeSeconds:90000,quote:'USD'},
    feedQuote:'USDC', outputQuote:'USD', maxDivergencePct:10, authority:'shadow'
  }};
}
const elizaAssets = Object.fromEntries([300,120,60,30].map(s=>[`eliza_${s}`,elizaRoute(`eliza_${s}`,s)]));
const elizaMarket = { prices:Object.fromEntries([300,120,60,30].map(s=>[`eliza_${s}`,{usd:canonicalEliza}])) };
const eliza = await resolveUniswapV3ChainlinkQuotePrices({ registry:{networks:{bsc:base.networks.bsc},assets:elizaAssets}, marketData:elizaMarket });

const compact = obs => Object.fromEntries(Object.entries(obs||{}).map(([id,o])=>[id,{
  status:o.status, usd:o.usd, divergencePct:o.divergencePct, pool:o.pool, fee:o.fee,
  twapWindowSeconds:o.twapWindowSeconds, activeLiquidityRaw:o.activeLiquidityRaw,
  rpcEndpointId:o.rpcEndpointId, twapRpcEndpointId:o.twapRpcEndpointId, error:o.error||null
}]));
const result = {
  generatedAt:new Date().toISOString(),
  canonical:{OLAS:canonicalOlas,BEAM:canonicalBeam,ELIZA:canonicalEliza,ETH:ethUsd},
  ethereumV3:compact(v3.observations),
  elizaPancakeV3:compact(eliza.observations)
};
console.log(JSON.stringify(result,null,2));

const olasOk = Object.entries(v3.observations).filter(([id,o])=>id.startsWith('olas_') && o.status==='shadow-ok');
const beamOk = Object.entries(v3.observations).filter(([id,o])=>id.startsWith('beam_') && o.status==='shadow-ok');
const elizaOk = Object.entries(eliza.observations).filter(([,o])=>o.status==='shadow-ok');
console.log('CANDIDATE SUMMARY',{olasOk:olasOk.map(([id])=>id),beamOk:beamOk.map(([id])=>id),elizaOk:elizaOk.map(([id])=>id)});
if(!olasOk.length) process.exitCode=21;
if(!beamOk.length) process.exitCode=22;
if(!elizaOk.length) process.exitCode=23;
