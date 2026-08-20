import fs from 'node:fs';
import { resolveUniswapV3TwapPrices } from './onchain-uniswap-v3-twap.mjs';
import { resolveUniswapV3ChainlinkQuotePrices } from './onchain-uniswap-v3-chainlink-quote.mjs';

const base = JSON.parse(fs.readFileSync(new URL('./onchain-price-source-registry.json', import.meta.url), 'utf8'));
const market = JSON.parse(fs.readFileSync(new URL('./market-data.json', import.meta.url), 'utf8'));
const ETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
const UNI_V3 = '0x1F98431c8aD98523631AE4a59f267346ea31F984';
const OLAS = '0x0001A500A6B18995B03f44bb040A5fFc28E45CB0';
const OLAS_V2_PAIR = '0x09D1d767eDF8Fa23A64C51fa559E0688E526812F';
const BEAM = '0x62D0A8458eD7719FDAF978fe5929C6D342B0bFcE';
const ELIZA = '0xea17Df5Cf6D172224892B5477A16ACb111182478';
const BSC_USDC = '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d';
const PANCAKE_V3 = '0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865';
const BSC_USDC_USD = '0x51597f405303C4377E36123cBc172b13269EA163';
const SYNC_TOPIC = '0x1c411e9a96e071241c2f21f7726b17ae89e3cab4c78be50e062b03a9fffbbad1';

const ethUsd = Number(market.prices?.ethereum?.usd);
if (!(ethUsd > 0)) throw new Error('Canonical ETH/USD missing for diagnostic dependency');
const coreObservations = { ethereum: { assetId: 'ethereum', status: 'shadow-ok', usd: ethUsd } };
const canonicalOlas = Number(market.prices?.autonolas?.usd);
const canonicalBeam = Number(market.prices?.['beam-2']?.usd);
const canonicalEliza = Number(market.prices?.elizaos?.usd);

function v3Route(assetId, symbol, token, fee, seconds) {
  return { assetId, symbol, route: {
    type:'uniswap-v3-twap-relative', network:'ethereum', factory:UNI_V3,
    token, quoteToken:ETH, tokenDecimals:18, quoteTokenDecimals:18,
    fee, twapWindowSeconds:seconds, quoteAssetId:'ethereum', feedQuote:'ETH', outputQuote:'USD',
    maxDivergencePct:10, authority:'shadow'
  }};
}

const v3Assets = {
  olas_v3_1pct_1800:v3Route('olas_v3_1pct_1800','OLAS',OLAS,10000,1800),
  olas_v3_1pct_300:v3Route('olas_v3_1pct_300','OLAS',OLAS,10000,300),
  beam_v3_1pct_1800:v3Route('beam_v3_1pct_1800','BEAM',BEAM,10000,1800),
  beam_v3_1pct_300:v3Route('beam_v3_1pct_300','BEAM',BEAM,10000,300),
  beam_v3_03pct_1800:v3Route('beam_v3_03pct_1800','BEAM',BEAM,3000,1800),
  beam_v3_03pct_300:v3Route('beam_v3_03pct_300','BEAM',BEAM,3000,300)
};
const v3Market={prices:{
  olas_v3_1pct_1800:{usd:canonicalOlas},olas_v3_1pct_300:{usd:canonicalOlas},
  beam_v3_1pct_1800:{usd:canonicalBeam},beam_v3_1pct_300:{usd:canonicalBeam},
  beam_v3_03pct_1800:{usd:canonicalBeam},beam_v3_03pct_300:{usd:canonicalBeam}
}};
const v3=await resolveUniswapV3TwapPrices({registry:{networks:{ethereum:base.networks.ethereum},assets:v3Assets},marketData:v3Market,coreObservations});

function elizaRoute(id,seconds){return{assetId:id,symbol:'ELIZA',route:{
  type:'uniswap-v3-twap-chainlink-quote',network:'bsc',factory:PANCAKE_V3,
  token:ELIZA,quoteToken:BSC_USDC,fee:2500,twapWindowSeconds:seconds,
  quoteAssetId:'bsc-usdc-usd',quoteFeed:{type:'chainlink-v3',contract:BSC_USDC_USD,maxAgeSeconds:90000,quote:'USD'},
  feedQuote:'USDC',outputQuote:'USD',maxDivergencePct:10,authority:'shadow'
}};}
const elizaAssets=Object.fromEntries([300,120,60,30].map(s=>[`eliza_${s}`,elizaRoute(`eliza_${s}`,s)]));
const elizaMarket={prices:Object.fromEntries([300,120,60,30].map(s=>[`eliza_${s}`,{usd:canonicalEliza}]))};
const eliza=await resolveUniswapV3ChainlinkQuotePrices({registry:{networks:{bsc:base.networks.bsc},assets:elizaAssets},marketData:elizaMarket});

async function rpc(endpoint,payload){
  const response=await fetch(endpoint.url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(12000)});
  if(!response.ok)throw new Error(`HTTP ${response.status}`);
  const body=await response.json();
  if(Array.isArray(payload)){
    if(!Array.isArray(body))throw new Error('Expected batch response');
    const byId=new Map(body.map(x=>[Number(x.id),x]));
    for(const req of payload){const row=byId.get(Number(req.id));if(!row||row.error)throw new Error(row?.error?.message||`Missing RPC ${req.id}`);}
    return byId;
  }
  if(body?.error)throw new Error(body.error.message||'RPC error');
  return body.result;
}
function decodeAddress(hex){const clean=String(hex||'').replace(/^0x/,'');return `0x${clean.slice(-40)}`.toLowerCase();}
function syncReserves(data){const clean=String(data||'').replace(/^0x/,'');if(clean.length<128)throw new Error('Sync data short');return[BigInt(`0x${clean.slice(0,64)}`),BigInt(`0x${clean.slice(64,128)}`)];}
function divergence(a,b){return a>0&&b>0?Math.abs(a-b)/b*100:null;}

async function probeOlasSyncLogTwapOn(endpoint){
  const latestHex=await rpc(endpoint,{jsonrpc:'2.0',id:1,method:'eth_blockNumber',params:[]});
  const latest=Number(BigInt(latestHex));
  const tokenRows=await rpc(endpoint,[
    {jsonrpc:'2.0',id:1,method:'eth_call',params:[{to:OLAS_V2_PAIR,data:'0x0dfe1681'},latestHex]},
    {jsonrpc:'2.0',id:2,method:'eth_call',params:[{to:OLAS_V2_PAIR,data:'0xd21220a7'},latestHex]},
    {jsonrpc:'2.0',id:3,method:'eth_getBlockByNumber',params:[latestHex,false]}
  ]);
  const token0=decodeAddress(tokenRows.get(1).result),token1=decodeAddress(tokenRows.get(2).result);
  if(token0!==OLAS.toLowerCase()||token1!==ETH.toLowerCase())throw new Error(`Pair identity mismatch ${token0}/${token1}`);
  const nowTs=Number(BigInt(tokenRows.get(3).result.timestamp));
  const lookbackBlocks=2400,chunk=50;
  const first=Math.max(0,latest-lookbackBlocks);
  const logs=[];
  let id=100;
  for(let from=first;from<=latest;from+=chunk){
    const to=Math.min(latest,from+chunk-1);
    const rows=await rpc(endpoint,{jsonrpc:'2.0',id:id++,method:'eth_getLogs',params:[{address:OLAS_V2_PAIR,topics:[SYNC_TOPIC],fromBlock:`0x${from.toString(16)}`,toBlock:`0x${to.toString(16)}`}]});
    logs.push(...rows);
  }
  if(logs.length<2)throw new Error(`Too few Sync logs: ${logs.length}`);
  const blocks=[...new Set(logs.map(x=>Number(BigInt(x.blockNumber))))].sort((a,b)=>a-b);
  const blockPayload=blocks.map((b,i)=>({jsonrpc:'2.0',id:10000+i,method:'eth_getBlockByNumber',params:[`0x${b.toString(16)}`,false]}));
  const byId=await rpc(endpoint,blockPayload);
  const tsByBlock=new Map(blocks.map((b,i)=>[b,Number(BigInt(byId.get(10000+i).result.timestamp))]));
  const states=logs.map(log=>{const [r0,r1]=syncReserves(log.data);if(r0<=0n||r1<=0n)return null;return{block:Number(BigInt(log.blockNumber)),ts:tsByBlock.get(Number(BigInt(log.blockNumber))),price:Number(r1)/Number(r0)};}).filter(Boolean).sort((a,b)=>a.ts-b.ts||a.block-b.block);
  const targetSeconds=21600;
  const targetStart=nowTs-targetSeconds;
  let prior=null;
  for(const state of states){if(state.ts<=targetStart)prior=state;else break;}
  let start=targetStart;
  if(!prior){prior=states[0];start=prior.ts;}
  if(nowTs-start<1800)throw new Error(`Effective log TWAP window too short: ${nowTs-start}s`);
  let cursor=start,currentPrice=prior.price,weighted=0;
  let used=0;
  for(const state of states){
    if(state.ts<=start)continue;
    if(state.ts>nowTs)break;
    weighted+=currentPrice*(state.ts-cursor);
    cursor=state.ts;currentPrice=state.price;used++;
  }
  weighted+=currentPrice*(nowTs-cursor);
  const effectiveSeconds=nowTs-start;
  const wethPerOlas=weighted/effectiveSeconds;
  const usd=wethPerOlas*ethUsd;
  const diff=divergence(usd,canonicalOlas);
  return{status:usd>0&&diff!==null&&diff<=10?'shadow-ok':'divergent',usd,divergencePct:diff,effectiveWindowSeconds:effectiveSeconds,syncLogCount:logs.length,transitionCount:used,rpcEndpointId:endpoint.id,token0,token1,wethPerOlas};
}
async function probeOlasSyncLogTwap(){
  const attempts=[];
  const preferred=[...(base.networks.ethereum.rpcFailover||[])].sort((a,b)=>a.id==='1rpc'?-1:b.id==='1rpc'?1:0);
  for(const endpoint of preferred){try{return await probeOlasSyncLogTwapOn(endpoint);}catch(error){attempts.push(`${endpoint.id}:${error.message}`);}}
  return{status:'rpc-unavailable',error:attempts.join(' | ')};
}
const olasLog=await probeOlasSyncLogTwap();

const compact=obs=>Object.fromEntries(Object.entries(obs||{}).map(([id,o])=>[id,{status:o.status,usd:o.usd,divergencePct:o.divergencePct,pool:o.pool,fee:o.fee,twapWindowSeconds:o.twapWindowSeconds,activeLiquidityRaw:o.activeLiquidityRaw,rpcEndpointId:o.rpcEndpointId,twapRpcEndpointId:o.twapRpcEndpointId,error:o.error||null}]));
const result={generatedAt:new Date().toISOString(),canonical:{OLAS:canonicalOlas,BEAM:canonicalBeam,ELIZA:canonicalEliza,ETH:ethUsd},ethereumV3:compact(v3.observations),elizaPancakeV3:compact(eliza.observations),olasV2SyncLogTwap:olasLog};
console.log(JSON.stringify(result,null,2));
const olasV3Ok=Object.entries(v3.observations).filter(([id,o])=>id.startsWith('olas_')&&o.status==='shadow-ok');
const beamOk=Object.entries(v3.observations).filter(([id,o])=>id.startsWith('beam_')&&o.status==='shadow-ok');
const elizaOk=Object.entries(eliza.observations).filter(([,o])=>o.status==='shadow-ok');
const olasOk=olasV3Ok.length>0||olasLog.status==='shadow-ok';
console.log('CANDIDATE SUMMARY',{olasV3Ok:olasV3Ok.map(([id])=>id),olasLog:olasLog.status,beamOk:beamOk.map(([id])=>id),elizaOk:elizaOk.map(([id])=>id)});
if(!olasOk)process.exitCode=21;
if(!beamOk.length)process.exitCode=22;
if(!elizaOk.length)process.exitCode=23;
