#!/usr/bin/env node
const WALLETS=['0x7eC6331188468269DC7C1Cf6a84C972632178B1E','0x9c548960bd053C8465F298a711b6343Ae0360309'];
const MARKETS={
  wbtc:{lt:'0x651D4b8168488FA163d85304662E8278d4c55BAa',gauge:'0xAa0b1d265F23972eafB7d088e963BD31403A58F5'},
  weth:{lt:'0x2B9c9f3BdcEb5d8E36a4704F08a78Fca53343cEa',gauge:'0xd829456FD63Ada7DE0657714A3A7A26DE403E3D8'}
};
const START_BLOCK=25732435;
const BURN_BLOCK=25902184;
const BURN_TX='0x713a9f36522a6e9fc762b9f2f9680e180358e6dc92ab5d82ed42ad8e2a37e6c1';
const RPC_URLS=[process.env.ETH_RPC_URL,process.env.ETH_RPC_URL_2,'https://eth.blockscout.com/api/eth-rpc','https://eth.merkle.io','https://ethereum-rpc.publicnode.com','https://eth.drpc.org','https://1rpc.io/eth','https://rpc.flashbots.net'].filter(Boolean);
const TRANSFER='0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const BALANCE_OF='0x70a08231';
const padAddr=a=>'0x'+a.toLowerCase().replace(/^0x/,'').padStart(64,'0');
const q=n=>'0x'+BigInt(n).toString(16);
const host=u=>{try{return new URL(u).hostname}catch{return 'configured'}};
const lower=v=>String(v||'').toLowerCase();
async function rpc(url,method,params,timeout=12000){const c=new AbortController(),t=setTimeout(()=>c.abort(),timeout);try{const r=await fetch(url,{method:'POST',headers:{'content-type':'application/json','user-agent':'The-Holding-YBLP-Custody-Diagnostic/0.2'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params}),signal:c.signal});if(!r.ok)throw new Error(`HTTP ${r.status}`);const b=await r.json();if(b.error)throw new Error(b.error.message||String(b.error.code));return b.result;}finally{clearTimeout(t)}}
async function bal(url,token,wallet,block='latest'){return rpc(url,'eth_call',[{to:token,data:BALANCE_OF+padAddr(wallet).slice(2)},block]);}
function transferRows(receipt){return(receipt?.logs||[]).filter(x=>lower(x?.topics?.[0])===TRANSFER&&x?.topics?.length>=3).map(x=>({token:lower(x.address),from:'0x'+String(x.topics[1]).slice(-40),to:'0x'+String(x.topics[2]).slice(-40),amountRaw:String(BigInt(x.data||'0x0')),logIndex:Number(BigInt(x.logIndex||'0x0'))}));}
for(const url of RPC_URLS){try{
  const latest=Number(BigInt(await rpc(url,'eth_blockNumber',[])));
  console.log(`YBLP focused diagnostic provider=${host(url)} latest=${latest}`);
  const header=await rpc(url,'eth_getBlockByNumber',[q(BURN_BLOCK),false]);
  const burnAt=header?.timestamp?new Date(Number(BigInt(header.timestamp))*1000).toISOString():null;
  console.log(JSON.stringify({burnBlock:BURN_BLOCK,burnAt,burnTx:BURN_TX}));
  for(const[market,contracts]of Object.entries(MARKETS))for(const[kind,address]of Object.entries(contracts))for(const wallet of WALLETS){
    const oldRaw=await bal(url,address,wallet,q(START_BLOCK));
    const currentRaw=await bal(url,address,wallet,'latest');
    console.log('BALANCE',JSON.stringify({market,kind,address,wallet,oldRaw:String(BigInt(oldRaw||'0x0')),currentRaw:String(BigInt(currentRaw||'0x0'))}));
  }
  const receipt=await rpc(url,'eth_getTransactionReceipt',[BURN_TX]);
  if(!receipt||lower(receipt.status)!=='0x1')throw new Error('burn transaction receipt unavailable or failed');
  console.log('BURN_TX_TRANSFERS',JSON.stringify(transferRows(receipt)));
  process.exit(0);
}catch(e){console.error(`YBLP focused diagnostic provider failed ${host(url)}: ${e?.message||e}`);}}
process.exitCode=1;
