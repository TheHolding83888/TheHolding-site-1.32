#!/usr/bin/env node
import fs from 'node:fs/promises';

const POOL='0x99cf3e8bfb02c300312c53aac5d0b082e3d5975c';
const LAPTOP='0xb095274743941e953c746f9c228da9c18bb6ec29';
const USDC='0x833589fcd6edb6e08f4c7c32d4f71b54bda02913';
const CLAIM_BLOCK=51109971;
const SELECTOR={token0:'0x0dfe1681',token1:'0xd21220a7',slot0:'0x3850c7bd',liquidity:'0x1a686502',tickSpacing:'0xd0c93a7c',observe:'0x883bdbfd'};
const word=v=>BigInt(v).toString(16).padStart(64,'0');
const blockTag=`0x${BigInt(CLAIM_BLOCK).toString(16)}`;
const lower=v=>String(v||'').toLowerCase();
function observeData(secondsAgo){return`${SELECTOR.observe}${word(32)}${word(2)}${word(secondsAgo)}${word(0)}`;}
function addressFromResult(hex){const raw=String(hex||'').replace(/^0x/,'');return`0x${raw.slice(24,64)}`.toLowerCase();}
function uint(hex,wordIndex=0){const raw=String(hex||'').replace(/^0x/,'');return BigInt(`0x${raw.slice(wordIndex*64,(wordIndex+1)*64)}`);}
function signed(value,bits){const b=BigInt(bits),limit=1n<<(b-1n),mod=1n<<b;return value>=limit?value-mod:value;}
function decodeObserve(hex){
  const raw=String(hex||'').replace(/^0x/,'');
  const firstOffset=Number(BigInt(`0x${raw.slice(0,64)}`));
  const base=firstOffset*2;
  const len=Number(BigInt(`0x${raw.slice(base,base+64)}`));
  const ticks=[];
  for(let i=0;i<len;i++)ticks.push(signed(BigInt(`0x${raw.slice(base+64+i*64,base+128+i*64)}`),56));
  return ticks;
}
async function rpc(endpoint,method,params){
  const res=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params}),signal:AbortSignal.timeout(12_000)});
  if(!res.ok)throw new Error(`HTTP ${res.status}`);
  const body=await res.json();if(body.error)throw new Error(body.error.message||'rpc error');return body.result;
}
async function call(endpoint,to,data){return rpc(endpoint,'eth_call',[{to,data},blockTag]);}
function priceFromTick(tick){
  // token0/token1 raw price = 1.0001^tick; decimals adjustment applied after onchain identity proof.
  const raw=Math.pow(1.0001,Number(tick));
  return raw;
}

const registry=JSON.parse(await fs.readFile('intelligence/market-data/onchain-price-source-registry.json','utf8'));
const endpoints=registry.networks.base.rpcFailover;
let success=null,attempts=[];
for(const endpoint of endpoints){
  try{
    const block=await rpc(endpoint.url,'eth_getBlockByNumber',[blockTag,false]);
    const [token0Hex,token1Hex,slot0Hex,liquidityHex,tickSpacingHex]=await Promise.all([
      call(endpoint.url,POOL,SELECTOR.token0),call(endpoint.url,POOL,SELECTOR.token1),call(endpoint.url,POOL,SELECTOR.slot0),call(endpoint.url,POOL,SELECTOR.liquidity),call(endpoint.url,POOL,SELECTOR.tickSpacing)
    ]);
    const token0=addressFromResult(token0Hex),token1=addressFromResult(token1Hex);
    const slotTick=Number(signed(uint(slot0Hex,1),24));
    const windows=[60,300,900,1800];
    const observations=[];
    for(const secondsAgo of windows){
      try{
        const obs=decodeObserve(await call(endpoint.url,POOL,observeData(secondsAgo)));
        if(obs.length!==2)throw new Error(`unexpected observe length ${obs.length}`);
        const delta=obs[1]-obs[0];
        let avg=delta/BigInt(secondsAgo);
        if(delta<0n&&delta%BigInt(secondsAgo)!==0n)avg-=1n;
        const avgTick=Number(avg),rawPriceToken1PerToken0=priceFromTick(avgTick);
        // LAPTOP has 18 decimals and USDC 6. If LAPTOP=token0, human USDC/LAPTOP = raw * 10^(18-6); inverse if reversed.
        const laptopUsdLike=lower(token0)===LAPTOP?rawPriceToken1PerToken0*1e12:(1/rawPriceToken1PerToken0)/1e12;
        observations.push({secondsAgo,ok:true,avgTick,rawPriceToken1PerToken0,laptopQuoteTokenPerToken:laptopUsdLike});
      }catch(error){observations.push({secondsAgo,ok:false,error:error.message});}
    }
    success={endpointId:endpoint.id,claimBlock:CLAIM_BLOCK,blockTimestamp:new Date(Number(BigInt(block.timestamp))*1000).toISOString(),pool:POOL,token0,token1,identityMatches:new Set([token0,token1]).has(LAPTOP)&&new Set([token0,token1]).has(USDC),slotTick,liquidity:uint(liquidityHex).toString(),tickSpacing:Number(signed(uint(tickSpacingHex),24)),observations};
    break;
  }catch(error){attempts.push({endpointId:endpoint.id,error:error.message});}
}
console.log(JSON.stringify({version:'0.1-laptop-slipstream-historical-diagnostic',success,attempts,semantics:{diagnosticOnly:true,spotPriceAuthority:false,twapOnly:true,currentPriceUsed:false,executionAuthority:'none'}},null,2));
if(!success||success.identityMatches!==true)process.exitCode=1;
