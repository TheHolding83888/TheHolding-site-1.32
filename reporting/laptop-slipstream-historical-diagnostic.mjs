#!/usr/bin/env node
import fs from 'node:fs/promises';

const POOL='0x99cf3e8bfb02c300312c53aac5d0b082e3d5975c';
const LAPTOP='0xb095274743941e953c746f9c228da9c18bb6ec29';
const USDC='0x833589fcd6edb6e08f4c7c32d4f71b54bda02913';
const CLAIM_BLOCKS=[51109971,51112441];
const TWAP_SECONDS=300;
const SELECTOR={token0:'0x0dfe1681',token1:'0xd21220a7',observe:'0x883bdbfd'};
const word=v=>BigInt(v).toString(16).padStart(64,'0');
const lower=v=>String(v||'').toLowerCase();
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function blockTag(block){return`0x${BigInt(block).toString(16)}`;}
function observeData(secondsAgo){return`${SELECTOR.observe}${word(32)}${word(2)}${word(secondsAgo)}${word(0)}`;}
function addressFromResult(hex){const raw=String(hex||'').replace(/^0x/,'');return`0x${raw.slice(24,64)}`.toLowerCase();}
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
  let lastError=null;
  for(let attempt=1;attempt<=5;attempt++){
    try{
      const res=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:attempt,method,params}),signal:AbortSignal.timeout(15_000)});
      if(!res.ok){
        const error=new Error(`HTTP ${res.status}`);
        if(res.status===429||res.status===503){lastError=error;await sleep(attempt*900);continue;}
        throw error;
      }
      const body=await res.json();if(body.error)throw new Error(body.error.message||'rpc error');return body.result;
    }catch(error){lastError=error;if(attempt<5){await sleep(attempt*900);continue;}}
  }
  throw lastError||new Error('RPC failed');
}
async function call(endpoint,to,data,block){return rpc(endpoint,'eth_call',[{to,data},blockTag(block)]);}
function laptopUsdcFromTick(avgTick,token0){
  const rawToken1PerToken0=Math.pow(1.0001,avgTick);
  return lower(token0)===LAPTOP?rawToken1PerToken0*1e12:(1/rawToken1PerToken0)/1e12;
}

const registry=JSON.parse(await fs.readFile('intelligence/market-data/onchain-price-source-registry.json','utf8'));
const configured=registry.networks.base.rpcFailover;
const endpoints=[...configured].sort((a,b)=>(a.id==='base-foundation'?-1:1)-(b.id==='base-foundation'?-1:1));
let success=null,attempts=[];
for(const endpoint of endpoints){
  try{
    const identityBlock=CLAIM_BLOCKS[0];
    const block=await rpc(endpoint.url,'eth_getBlockByNumber',[blockTag(identityBlock),false]);
    await sleep(700);
    const token0=addressFromResult(await call(endpoint.url,POOL,SELECTOR.token0,identityBlock));
    await sleep(700);
    const token1=addressFromResult(await call(endpoint.url,POOL,SELECTOR.token1,identityBlock));
    const identityMatches=new Set([token0,token1]).has(LAPTOP)&&new Set([token0,token1]).has(USDC);
    if(!identityMatches)throw new Error('pool token identity mismatch');
    const observations=[];
    for(const claimBlock of CLAIM_BLOCKS){
      await sleep(1100);
      const claimBlockHeader=claimBlock===identityBlock?block:await rpc(endpoint.url,'eth_getBlockByNumber',[blockTag(claimBlock),false]);
      await sleep(1100);
      const obs=decodeObserve(await call(endpoint.url,POOL,observeData(TWAP_SECONDS),claimBlock));
      if(obs.length!==2)throw new Error(`unexpected observe length ${obs.length}`);
      const delta=obs[1]-obs[0];
      let avg=delta/BigInt(TWAP_SECONDS);
      if(delta<0n&&delta%BigInt(TWAP_SECONDS)!==0n)avg-=1n;
      const avgTick=Number(avg);
      observations.push({
        claimBlock,
        blockTimestamp:new Date(Number(BigInt(claimBlockHeader.timestamp))*1000).toISOString(),
        secondsAgo:TWAP_SECONDS,
        avgTick,
        laptopUsdcPerToken:laptopUsdcFromTick(avgTick,token0)
      });
    }
    success={endpointId:endpoint.id,pool:POOL,token0,token1,identityMatches,observations};
    break;
  }catch(error){attempts.push({endpointId:endpoint.id,error:error.message});}
}
console.log(JSON.stringify({version:'0.2-laptop-slipstream-historical-diagnostic',success,attempts,semantics:{diagnosticOnly:true,spotPriceAuthority:false,twapOnly:true,twapSeconds:TWAP_SECONDS,currentPriceUsed:false,executionAuthority:'none'}},null,2));
if(!success||success.identityMatches!==true||success.observations.length!==CLAIM_BLOCKS.length)process.exitCode=1;
