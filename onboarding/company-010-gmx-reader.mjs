#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { AbiCoder, Contract, Interface, JsonRpcProvider, formatUnits, getAddress, id } from 'ethers';

const OUT=process.env.COMPANY_010_GMX_READER_OUTPUT||path.resolve('companies/company-010-gmx-reader.json');
const READER=getAddress('0xfA26cBb46e2614609406de08CA1Dc7f70a684184');
const DATASTORE=getAddress('0xFD70de6b91282D8017aA4E741e9Ae325CAb992d8');
const MARKETS=[
 {label:'ETH/USD [ETH-USDC]',token:getAddress('0x70d95587d40A2caf56bd97485aB3Eec10Bee6336')},
 {label:'BTC/USD [WBTC.b-USDC]',token:getAddress('0x47c031236e19d024b42f8AE6780E44A573170703')}
];
const WALLETS=[getAddress('0xd90d1e395de36e1e59c42f5df537801c26bbc03f'),getAddress('0x64688f4adc3f72cdb44d07e4879c724cd7025696')];
const RPC=[...new Set([process.env.ARBITRUM_RPC_URL,'https://arbitrum-one-rpc.publicnode.com','https://arb1.arbitrum.io/rpc'].filter(Boolean))];
const ZERO='0x0000000000000000000000000000000000000000';
const lower=x=>String(x||'').toLowerCase();
const round=(x,d=12)=>Number.isFinite(Number(x))?Number(Number(x).toFixed(d)):null;
const serialize=(x,space=0)=>JSON.stringify(x,(k,v)=>typeof v==='bigint'?v.toString():v,space);
const getMarketIface=new Interface(['function getMarket(address dataStore,address key) view returns (tuple(address marketToken,address indexToken,address longToken,address shortToken))']);
const priceIface=new Interface(['function getMarketTokenPrice(address dataStore,tuple(address marketToken,address indexToken,address longToken,address shortToken) market,tuple(uint256 min,uint256 max) indexTokenPrice,tuple(uint256 min,uint256 max) longTokenPrice,tuple(uint256 min,uint256 max) shortTokenPrice,bytes32 pnlFactorType,bool maximize) view']);
const coder=AbiCoder.defaultAbiCoder();

async function provider(){let last;for(const url of RPC){try{const p=new JsonRpcProvider(url,42161,{staticNetwork:true});if(Number((await p.getNetwork()).chainId)!==42161)throw new Error('wrong chain');return p}catch(e){last=e}}throw last||new Error('Arbitrum provider unavailable')}
async function fetchJson(url){const c=new AbortController(),t=setTimeout(()=>c.abort(),25000);try{const r=await fetch(url,{headers:{accept:'application/json','user-agent':'The-Holding-Cypher-GMX-Reader/0.1.3'},signal:c.signal,cache:'no-store'});if(!r.ok)throw new Error(`HTTP ${r.status}`);return await r.json()}finally{clearTimeout(t)}}
function findCatalogToken(root,address){const target=lower(address),seen=new Set();function walk(x,d=0){if(d>8||!x||typeof x!=='object'||seen.has(x))return null;seen.add(x);if(!Array.isArray(x)){const a=x.address??x.tokenAddress??x.contractAddress??null;if(typeof a==='string'&&lower(a)===target&&Number.isFinite(Number(x.decimals)))return x;for(const [k,v] of Object.entries(x)){if(lower(k)===target&&v&&typeof v==='object'&&Number.isFinite(Number(v.decimals)))return{address,...v}}}for(const v of Object.values(x)){const r=walk(v,d+1);if(r)return r}return null}return walk(root)}
async function tokenMeta(p,a,catalog){if(lower(a)===lower(ZERO))return{address:getAddress(ZERO),decimals:18,symbol:'ZERO',metadataSource:'synthetic-zero'};const c=new Contract(a,['function decimals() view returns(uint8)','function symbol() view returns(string)'],p);try{return{address:getAddress(a),decimals:Number(await c.decimals()),symbol:String(await c.symbol()),metadataSource:'onchain-erc20'}}catch{}const x=findCatalogToken(catalog,a);if(!x)throw new Error(`GMX token metadata missing for synthetic/non-ERC20 ${a}`);return{address:getAddress(a),decimals:Number(x.decimals),symbol:String(x.symbol??x.baseSymbol??x.name??'UNKNOWN'),metadataSource:'official-gmx-token-catalog'}}
function tickerFor(tickers,meta){const exact=tickers.find(x=>lower(x.tokenAddress)===lower(meta.address));if(exact)return exact;const sym=String(meta.symbol||'').toUpperCase();const symbolMatches=tickers.filter(x=>String(x.tokenSymbol||'').toUpperCase()===sym);return symbolMatches.length===1?symbolMatches[0]:null}
function readerPrice(ticker,decimals){if(!ticker)throw new Error('ticker missing');const rawMin=BigInt(ticker.minPrice),rawMax=BigInt(ticker.maxPrice);const hasOracleDecimals=ticker.oracleDecimals!==undefined&&ticker.oracleDecimals!==null&&Number.isInteger(Number(ticker.oracleDecimals));const oracleDecimals=hasOracleDecimals?Number(ticker.oracleDecimals):null;if(hasOracleDecimals&&(oracleDecimals<0||oracleDecimals>36))throw new Error('invalid oracleDecimals');const multiplier=hasOracleDecimals?10n**BigInt(oracleDecimals):1n;const min=rawMin*multiplier,max=rawMax*multiplier;if(min<=0n||max<=0n||min>max)throw new Error(`invalid Reader input ${ticker.tokenSymbol||ticker.tokenAddress}`);return{min,max,rawTicker:{tokenSymbol:ticker.tokenSymbol||null,tokenAddress:ticker.tokenAddress,minPrice:rawMin.toString(),maxPrice:rawMax.toString(),oracleDecimals,updatedAt:Number(ticker.updatedAt)},conversion:hasOracleDecimals?'documented-oracleDecimals-schema: raw * 10^oracleDecimals':'current-live-schema: raw minPrice/maxPrice consumed directly as Reader Price.Props; validated by official Reader output sanity gate'}}
function signedWord(hex){if(typeof hex!=='string'||hex.length<66)throw new Error('short Reader return');return coder.decode(['int256'],`0x${hex.slice(2,66)}`)[0]}

const p=await provider();
const [tickers,apy,catalog]=await Promise.all([fetchJson('https://arbitrum-api.gmxinfra.io/prices/tickers'),fetchJson('https://arbitrum-api.gmxinfra.io/apy?period=30d'),fetchJson('https://arbitrum-api.gmxinfra.io/tokens')]);
const results=[];
for(const m of MARKETS){
 const market=await new Contract(READER,getMarketIface.fragments,p).getMarket(DATASTORE,m.token);
 if(lower(market.marketToken)!==lower(m.token))throw new Error(`${m.label}: market token mismatch`);
 const idx=lower(market.indexToken)===lower(ZERO)?await tokenMeta(p,market.longToken,catalog):await tokenMeta(p,market.indexToken,catalog);
 const lng=await tokenMeta(p,market.longToken,catalog),sht=await tokenMeta(p,market.shortToken,catalog);
 const idxP=readerPrice(tickerFor(tickers,idx),idx.decimals),longP=readerPrice(tickerFor(tickers,lng),lng.decimals),shortP=readerPrice(tickerFor(tickers,sht),sht.decimals);
 const props=[market.marketToken,market.indexToken,market.longToken,market.shortToken],pnl=id('MAX_PNL_FACTOR_FOR_TRADERS');
 const call=async maximize=>{const data=priceIface.encodeFunctionData('getMarketTokenPrice',[DATASTORE,props,[idxP.min,idxP.max],[longP.min,longP.max],[shortP.min,shortP.max],pnl,maximize]);return signedWord(await p.call({to:READER,data}))};
 const rawMin=await call(false),rawMax=await call(true);if(rawMin<=0n||rawMax<=0n||rawMin>rawMax)throw new Error(`${m.label}: invalid GM price range ${rawMin}..${rawMax}`);
 const minUsd=Number(formatUnits(rawMin,30)),maxUsd=Number(formatUnits(rawMax,30)),midUsd=(minUsd+maxUsd)/2;if(!(minUsd>0&&maxUsd>=minUsd&&maxUsd<1000))throw new Error(`${m.label}: implausible GM price ${minUsd}..${maxUsd}`);
 const gm=new Contract(m.token,['function balanceOf(address) view returns(uint256)','function decimals() view returns(uint8)'],p);const gmDecimals=Number(await gm.decimals());let rawBalance=0n;for(const w of WALLETS)rawBalance+=BigInt(await gm.balanceOf(w));const balance=Number(formatUnits(rawBalance,gmDecimals));
 const exactApy=apy?.markets?.[lower(m.token)]??apy?.markets?.[m.token]??Object.entries(apy?.markets||{}).find(([k])=>lower(k)===lower(m.token))?.[1]??null;let apr=Number(exactApy?.apy);if(!Number.isFinite(apr))throw new Error(`${m.label}: exact 30D APY missing`);if(Math.abs(apr)<=1)apr*=100;
 results.push({label:m.label,marketToken:m.token,market:{marketToken:getAddress(market.marketToken),indexToken:getAddress(market.indexToken),longToken:getAddress(market.longToken),shortToken:getAddress(market.shortToken)},tokens:{index:idx,long:lng,short:sht},oracleInputs:{index:idxP,long:longP,short:shortP},gmTokenPrice:{rawMin:rawMin.toString(),rawMax:rawMax.toString(),minUsd:round(minUsd),maxUsd:round(maxUsd),midUsd:round(midUsd),precision:'30-decimal USD per full 18-decimal GM token',method:'official current GMX Reader.getMarketTokenPrice, MAX_PNL_FACTOR_FOR_TRADERS, maximize false+true'},balance:round(balance),valueUsdMin:round(balance*minUsd,8),valueUsdMax:round(balance*maxUsd,8),valueUsdMid:round(balance*midUsd,8),referenceAprPct:round(apr,6),referenceAprPeriod:'30d',referenceAprSource:'official GMX Oracle API /apy exact market-token address key'});
}
const output={version:'0.1.3-company-010-gmx-reader-valuation',generatedAt:new Date().toISOString(),chainId:42161,contracts:{reader:READER,dataStore:DATASTORE},source:'GMX official current Arbitrum deployment addresses + token catalog + Oracle price tickers + Reader.getMarketTokenPrice + /apy?period=30d',results,totalValueUsdMin:round(results.reduce((s,x)=>s+x.valueUsdMin,0),8),totalValueUsdMax:round(results.reduce((s,x)=>s+x.valueUsdMax,0),8),totalValueUsdMid:round(results.reduce((s,x)=>s+x.valueUsdMid,0),8),authority:{readOnly:true,noTransactions:true,executionAuthority:'none'}};
fs.writeFileSync(OUT,serialize(output,2)+'\n');console.log(serialize({version:output.version,results:results.map(x=>({label:x.label,balance:x.balance,priceMin:x.gmTokenPrice.minUsd,priceMax:x.gmTokenPrice.maxUsd,valueMid:x.valueUsdMid,apr:x.referenceAprPct,tokens:x.tokens})),totalValueUsdMid:output.totalValueUsdMid,executionAuthority:'none'},2));
