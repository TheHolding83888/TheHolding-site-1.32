import fs from 'node:fs';
const base=JSON.parse(fs.readFileSync(new URL('./onchain-price-source-registry.json',import.meta.url),'utf8'));
const market=JSON.parse(fs.readFileSync(new URL('./market-data.json',import.meta.url),'utf8'));
const PAIR='0x09D1d767eDF8Fa23A64C51fa559E0688E526812F';
const OLAS='0x0001A500A6B18995B03f44bb040A5fFc28E45CB0'.toLowerCase();
const WETH='0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'.toLowerCase();
const SYNC='0x1c411e9a96e071241c2f21f7726b17ae89e3cab4c78be50e062b03a9fffbbad1';
const ethUsd=Number(market.prices?.ethereum?.usd),canonical=Number(market.prices?.autonolas?.usd);
const endpoints=[
  {id:'nodeflare',url:'https://rpc.nodeflare.app/eth/public',throttleMs:650},
  {id:'drpc',url:'https://eth.drpc.org'},
  {id:'1rpc-slash',url:'https://1rpc.io/eth/'},
  ...(base.networks?.ethereum?.rpcFailover||[])
];
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function call(ep,payload){
  if(ep.throttleMs)await sleep(ep.throttleMs);
  const r=await fetch(ep.url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload),redirect:'follow',signal:AbortSignal.timeout(12000)});
  if(!r.ok)throw new Error(`HTTP ${r.status}`);
  const b=await r.json();if(b?.error)throw new Error(b.error.message||'RPC error');return b.result;
}
function address(hex){return `0x${String(hex||'').replace(/^0x/,'').slice(-40)}`.toLowerCase();}
function reserves(data){const x=String(data||'').replace(/^0x/,'');return[BigInt('0x'+x.slice(0,64)),BigInt('0x'+x.slice(64,128))];}
async function one(ep){
  const latestHex=await call(ep,{jsonrpc:'2.0',id:1,method:'eth_blockNumber',params:[]});const latest=Number(BigInt(latestHex));
  const t0=address(await call(ep,{jsonrpc:'2.0',id:2,method:'eth_call',params:[{to:PAIR,data:'0x0dfe1681'},latestHex]}));
  const t1=address(await call(ep,{jsonrpc:'2.0',id:3,method:'eth_call',params:[{to:PAIR,data:'0xd21220a7'},latestHex]}));
  if(t0!==OLAS||t1!==WETH)throw new Error(`identity ${t0}/${t1}`);
  const latestBlock=await call(ep,{jsonrpc:'2.0',id:4,method:'eth_getBlockByNumber',params:[latestHex,false]});const now=Number(BigInt(latestBlock.timestamp));
  const logs=[];const first=latest-2400;
  for(let from=first;from<=latest;from+=50){const to=Math.min(latest,from+49);logs.push(...await call(ep,{jsonrpc:'2.0',id:100+from,method:'eth_getLogs',params:[{address:PAIR,topics:[SYNC],fromBlock:'0x'+from.toString(16),toBlock:'0x'+to.toString(16)}]}));}
  if(logs.length<2)throw new Error(`logs=${logs.length}`);
  const blocks=[...new Set(logs.map(l=>Number(BigInt(l.blockNumber))))].sort((a,b)=>a-b);const ts=new Map();
  for(const b of blocks){const row=await call(ep,{jsonrpc:'2.0',id:10000+b,method:'eth_getBlockByNumber',params:['0x'+b.toString(16),false]});ts.set(b,Number(BigInt(row.timestamp)));}
  const states=logs.map(l=>{const[a,b]=reserves(l.data);return a>0n&&b>0n?{ts:ts.get(Number(BigInt(l.blockNumber))),p:Number(b)/Number(a)}:null;}).filter(Boolean).sort((a,b)=>a.ts-b.ts);
  const target=now-21600;let prior=null;for(const s of states){if(s.ts<=target)prior=s;else break;}let start=target;if(!prior){prior=states[0];start=prior.ts;}if(now-start<1800)throw new Error(`window=${now-start}`);
  let cursor=start,p=prior.p,sum=0,transitions=0;for(const s of states){if(s.ts<=start)continue;if(s.ts>now)break;sum+=p*(s.ts-cursor);cursor=s.ts;p=s.p;transitions++;}sum+=p*(now-cursor);
  const wethPerOlas=sum/(now-start),usd=wethPerOlas*ethUsd,diff=Math.abs(usd-canonical)/canonical*100;
  return{status:diff<=10?'shadow-ok':'divergent',usd,divergencePct:diff,effectiveWindowSeconds:now-start,syncLogCount:logs.length,transitionCount:transitions,wethPerOlas};
}
const out=[];for(const ep of endpoints){try{const r=await one(ep);out.push({endpoint:ep.id,...r});if(r.status==='shadow-ok')break;}catch(e){out.push({endpoint:ep.id,status:'error',error:e.message});}}
console.log(JSON.stringify({canonical:{OLAS:canonical,ETH:ethUsd},results:out},null,2));
if(!out.some(x=>x.status==='shadow-ok'))process.exit(21);
