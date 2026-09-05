#!/usr/bin/env node
const WALLETS=['0x7eC6331188468269DC7C1Cf6a84C972632178B1E','0x9c548960bd053C8465F298a711b6343Ae0360309'];
const CONTRACTS={lt:'0x651D4b8168488FA163d85304662E8278d4c55BAa',gauge:'0xAa0b1d265F23972eafB7d088e963BD31403A58F5'};
const START_BLOCK=25732435;
const RPC_URLS=[process.env.ETH_RPC_URL,process.env.ETH_RPC_URL_2,'https://eth.blockscout.com/api/eth-rpc','https://ethereum-rpc.publicnode.com','https://eth.merkle.io','https://eth.drpc.org','https://1rpc.io/eth','https://rpc.flashbots.net'].filter(Boolean);
const TRANSFER='0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const BALANCE_OF='0x70a08231';
const padAddr=a=>'0x'+a.toLowerCase().replace(/^0x/,'').padStart(64,'0');
const q=n=>'0x'+BigInt(n).toString(16);
const host=u=>{try{return new URL(u).hostname}catch{return 'configured'}};
async function rpc(url,method,params,timeout=12000){const c=new AbortController(),t=setTimeout(()=>c.abort(),timeout);try{const r=await fetch(url,{method:'POST',headers:{'content-type':'application/json','user-agent':'The-Holding-YBLP-Custody-Diagnostic/0.1'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params}),signal:c.signal});if(!r.ok)throw new Error(`HTTP ${r.status}`);const b=await r.json();if(b.error)throw new Error(b.error.message||String(b.error.code));return b.result;}finally{clearTimeout(t)}}
async function bal(url,token,wallet,block='latest'){return rpc(url,'eth_call',[{to:token,data:BALANCE_OF+padAddr(wallet).slice(2)},block]);}
async function logs(url,address,topics,from,to){return rpc(url,'eth_getLogs',[{address,fromBlock:q(from),toBlock:q(to),topics}],20000);}
async function scan(url,address,wallet,latest){const out=[];for(let start=START_BLOCK;start<=latest;start+=5000){const end=Math.min(latest,start+4999);for(const topics of [[TRANSFER,padAddr(wallet)],[TRANSFER,null,padAddr(wallet)]]){const rows=await logs(url,address,topics,start,end);for(const x of rows||[])out.push(x);}}const unique=[...new Map(out.map(x=>[`${x.transactionHash}:${x.logIndex}`,x])).values()];unique.sort((a,b)=>Number(BigInt(a.blockNumber))-Number(BigInt(b.blockNumber)));return unique.map(x=>({block:Number(BigInt(x.blockNumber)),tx:x.transactionHash,from:'0x'+String(x.topics?.[1]||'').slice(-40),to:'0x'+String(x.topics?.[2]||'').slice(-40),amountRaw:String(BigInt(x.data||'0x0'))}));}
for(const url of RPC_URLS){try{const latestHex=await rpc(url,'eth_blockNumber',[]);const latest=Number(BigInt(latestHex));console.log(`YBLP custody diagnostic provider=${host(url)} latest=${latest}`);for(const [label,address] of Object.entries(CONTRACTS)){for(const wallet of WALLETS){const oldBal=await bal(url,address,wallet,q(START_BLOCK));const curBal=await bal(url,address,wallet,'latest');console.log(JSON.stringify({label,address,wallet,oldBalanceRaw:String(BigInt(oldBal||'0x0')),currentBalanceRaw:String(BigInt(curBal||'0x0'))}));const rows=await scan(url,address,wallet,latest);for(const row of rows)console.log('TRANSFER',JSON.stringify({label,address,wallet,...row}));}}process.exit(0);}catch(e){console.error(`YBLP diagnostic provider failed ${host(url)}: ${e?.message||e}`);}}
process.exitCode=1;
