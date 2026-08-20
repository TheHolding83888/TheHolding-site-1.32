import fs from 'node:fs';

const registry = JSON.parse(fs.readFileSync('intelligence/market-data/onchain-price-source-registry.json','utf8'));
const GET_POOL = '1698ee82';
const LIQUIDITY = '1a686502';
const SLOT0 = '3850c7bd';
const OBSERVE = '883bdbfd';
const ZERO = '0x0000000000000000000000000000000000000000';
const WINDOWS = [3600,1800,900,600,300,180,120,60,30,15];
const MIN_ELIGIBLE_WINDOW = 60;

const targets = [
  {
    assetId:'yield-basis', symbol:'YB', network:'ethereum', factory:'0x1F98431c8aD98523631AE4a59f267346ea31F984',
    token:'0x01791f726b4103694969820be083196cc7c045ff', fees:[100,500,3000,10000],
    quotes:[
      {symbol:'WETH',address:'0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'},
      {symbol:'USDC',address:'0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'},
      {symbol:'USDT',address:'0xdAC17F958D2ee523a2206206994597C13D831ec7'},
      {symbol:'DAI',address:'0x6B175474E89094C44Da98b954EedeAC495271d0F'}
    ]
  },
  {
    assetId:'elizaos', symbol:'ELIZA', network:'bsc', factory:'0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865',
    token:'0xea17Df5Cf6D172224892B5477A16ACb111182478', fees:[100,500,2500,10000],
    quotes:[
      {symbol:'USDC',address:'0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d'},
      {symbol:'USDT',address:'0x55d398326f99059fF775485246999027B3197955'},
      {symbol:'WBNB',address:'0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c'}
    ]
  }
];

function padWord(hex){ return hex.replace(/^0x/,'').toLowerCase().padStart(64,'0'); }
function addressWord(address){ return padWord(address); }
function uintWord(value){ return BigInt(value).toString(16).padStart(64,'0'); }
function getPoolData(token, quote, fee){ return '0x'+GET_POOL+addressWord(token)+addressWord(quote)+uintWord(fee); }
function observeData(seconds){ return '0x'+OBSERVE+uintWord(32)+uintWord(2)+uintWord(seconds)+uintWord(0); }
function decodeAddress(result){ if(!result || result==='0x') return ZERO; return '0x'+result.slice(-40); }
function decodeUint(result){ if(!result || result==='0x') return null; return BigInt(result); }
function decodeSlot0(result){
  if(!result || result.length < 2+64*5) return null;
  const body=result.slice(2);
  const word=i=>BigInt('0x'+body.slice(i*64,(i+1)*64));
  return {observationIndex:Number(word(2)),observationCardinality:Number(word(3)),observationCardinalityNext:Number(word(4))};
}
async function rpc(networkId, method, params){
  const attempts=[];
  for(const endpoint of registry.networks?.[networkId]?.rpcFailover || []){
    try{
      const response=await fetch(endpoint.url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params}),signal:AbortSignal.timeout(10000)});
      if(!response.ok) throw new Error(`HTTP ${response.status}`);
      const body=await response.json();
      if(body.error) throw new Error(body.error.message || JSON.stringify(body.error));
      return {result:body.result,endpointId:endpoint.id};
    }catch(error){ attempts.push(`${endpoint.id}:${error instanceof Error?error.message:String(error)}`); }
  }
  throw new Error(`All ${networkId} RPC endpoints failed: ${attempts.join(' | ')}`);
}
async function ethCall(networkId,to,data){ return rpc(networkId,'eth_call',[{to,data},'latest']); }

const report={generatedAt:new Date().toISOString(),minimumEligibleTwapWindowSeconds:MIN_ELIGIBLE_WINDOW,targets:{}};
for(const target of targets){
  const rows=[];
  for(const quote of target.quotes){
    for(const fee of target.fees){
      let pool=ZERO;
      try{ pool=decodeAddress((await ethCall(target.network,target.factory,getPoolData(target.token,quote.address,fee))).result); }
      catch(error){ rows.push({quote:quote.symbol,fee,pool:null,discoveryError:String(error)}); continue; }
      if(pool.toLowerCase()===ZERO.toLowerCase()){ rows.push({quote:quote.symbol,fee,pool,exists:false}); continue; }
      const row={quote:quote.symbol,quoteToken:quote.address,fee,pool,exists:true};
      try{ row.liquidity=String(decodeUint((await ethCall(target.network,pool,'0x'+LIQUIDITY)).result)); }catch(error){ row.liquidityError=String(error); }
      try{ Object.assign(row,decodeSlot0((await ethCall(target.network,pool,'0x'+SLOT0)).result)||{}); }catch(error){ row.slot0Error=String(error); }
      row.observe={};
      for(const seconds of WINDOWS){
        try{ await ethCall(target.network,pool,observeData(seconds)); row.observe[seconds]='ok'; }
        catch(error){ row.observe[seconds]=String(error).includes('OLD')?'OLD':'error'; }
      }
      row.longestAvailableWindowSeconds=WINDOWS.find(seconds=>row.observe[seconds]==='ok') ?? null;
      row.eligibleAtOrAboveFloor=Number(row.longestAvailableWindowSeconds||0)>=MIN_ELIGIBLE_WINDOW && BigInt(row.liquidity||'0')>0n;
      rows.push(row);
    }
  }
  report.targets[target.assetId]=rows;
}

for(const [assetId,rows] of Object.entries(report.targets)){
  const viable=rows.filter(x=>x.eligibleAtOrAboveFloor).sort((a,b)=>(b.longestAvailableWindowSeconds||0)-(a.longestAvailableWindowSeconds||0));
  console.log(`\n=== ${assetId} viable pools (>=${MIN_ELIGIBLE_WINDOW}s) ===`);
  console.log(JSON.stringify(viable,null,2));
  console.log(`=== ${assetId} all discovered pools ===`);
  console.log(JSON.stringify(rows.filter(x=>x.exists),null,2));
}
console.log('\nDISCOVERY_REPORT_JSON='+JSON.stringify(report));
