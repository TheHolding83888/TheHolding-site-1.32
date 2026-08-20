import fs from 'node:fs';

const registry=JSON.parse(fs.readFileSync('intelligence/market-data/onchain-price-source-registry.json','utf8'));
const network=registry.networks?.bsc;
if(!network) throw new Error('BSC network missing');
const pair='0x8f4D179d3b4FaA728Ee25845f673eF80DeA2cE5e';
const getReserves='0x0902f1ac';
const lookbacks=[800,1600,3200,6400];

async function rpc(url,method,params){
  const response=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params}),signal:AbortSignal.timeout(10000)});
  if(!response.ok) throw new Error(`HTTP ${response.status}`);
  const body=await response.json();
  if(body.error) throw new Error(body.error.message||JSON.stringify(body.error));
  return body.result;
}
const report=[];
for(const endpoint of network.rpcFailover||[]){
  const row={endpointId:endpoint.id,url:endpoint.url,currentBlock:null,probes:[]};
  try{
    const current=Number(BigInt(await rpc(endpoint.url,'eth_blockNumber',[])));
    row.currentBlock=current;
    for(const lookbackBlocks of lookbacks){
      const block=current-lookbackBlocks;
      const blockTag=`0x${BigInt(block).toString(16)}`;
      const probe={lookbackBlocks,blockNumber:block,blockTag,getBlock:false,historicalEthCall:false,error:null};
      try{
        const blockObj=await rpc(endpoint.url,'eth_getBlockByNumber',[blockTag,false]);
        probe.getBlock=Boolean(blockObj?.timestamp);
        const reserves=await rpc(endpoint.url,'eth_call',[{to:pair,data:getReserves},blockTag]);
        probe.historicalEthCall=typeof reserves==='string' && reserves.length>=2+64*3;
      }catch(error){ probe.error=error instanceof Error?error.message:String(error); }
      row.probes.push(probe);
    }
  }catch(error){ row.error=error instanceof Error?error.message:String(error); }
  report.push(row);
}
console.log('BSC public RPC historical-state capability');
console.log(JSON.stringify(report,null,2));
const capable=report.filter(row=>row.probes?.some(p=>p.lookbackBlocks>=800&&p.getBlock&&p.historicalEthCall));
if(!capable.length) throw new Error('No configured BSC public RPC endpoint supports required historical eth_call state');
console.log('ARCHIVE_CAPABLE_ENDPOINTS='+JSON.stringify(capable.map(x=>x.endpointId)));
