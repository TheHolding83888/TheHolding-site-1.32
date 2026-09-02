#!/usr/bin/env node
import fs from 'node:fs/promises';
import { Contract, JsonRpcProvider } from 'ethers';

const evidencePath=process.env.VE33_DIAGNOSTIC_EVIDENCE_FILE||'./reporting/ve33-accounting-evidence.json';
const evidence=JSON.parse(await fs.readFile(evidencePath,'utf8'));

const CONFIG={
  aerodrome:{chainId:8453,rpcEnv:'BASE_RPC_URL',fallbacks:['https://base-rpc.publicnode.com','https://mainnet.base.org']},
  velodrome:{chainId:10,rpcEnv:'OPTIMISM_RPC_URL',fallbacks:['https://optimism-rpc.publicnode.com','https://mainnet.optimism.io']}
};
const REWARD_ABI=['event ClaimRewards(address indexed from,address indexed reward,uint256 amount)'];
const DISTRIBUTOR_ABI=['event Claimed(uint256 indexed tokenId,uint256 indexed epochStart,uint256 indexed epochEnd,uint256 amount)'];

function compactError(error){
  return{
    name:error?.name||null,
    code:error?.code||null,
    shortMessage:error?.shortMessage||null,
    message:error?.message||String(error),
    action:error?.action||null,
    reason:error?.reason||null,
    rpcError:error?.error?.message||null,
    infoError:error?.info?.error?.message||null,
    infoCode:error?.info?.error?.code??null,
    payload:error?.info?.payload||null
  };
}

function sampleInterval(protocol,kind){
  const groups=new Map();
  for(const row of evidence.checkpoints||[]){
    if(row.protocolKey!==protocol||row.kind!==kind)continue;
    const key=row.laneKey;
    if(!groups.has(key))groups.set(key,[]);
    groups.get(key).push(row);
  }
  for(const rows of groups.values()){
    rows.sort((a,b)=>Number(a.blockNumber)-Number(b.blockNumber));
    if(rows.length>=2)return{open:rows.at(-2),close:rows.at(-1)};
  }
  return null;
}

async function queryWithUrl({cfg,url,kind,open,fromBlock,toBlock}){
  const provider=new JsonRpcProvider(url,cfg.chainId);
  let latest=null;
  try{latest=await provider.getBlockNumber();}
  catch(error){return{url,status:'provider-unavailable',error:compactError(error)};}
  try{
    let contract,filter,address;
    if(kind==='rebase-distributor'){
      address=open.distributor;
      contract=new Contract(address,DISTRIBUTOR_ABI,provider);
      filter=contract.filters.Claimed(BigInt(open.tokenId));
    }else{
      address=open.rewardContract;
      contract=new Contract(address,REWARD_ABI,provider);
      filter=contract.filters.ClaimRewards(null,open.rewardToken);
    }
    const logs=await contract.queryFilter(filter,fromBlock,toBlock);
    return{url,status:'query-ok',latestBlock:latest,address,logCount:logs.length};
  }catch(error){
    return{
      url,status:'query-failed',latestBlock:latest,
      address:kind==='rebase-distributor'?open.distributor:open.rewardContract,
      error:compactError(error)
    };
  }
}

async function probe(protocol,kind){
  const cfg=CONFIG[protocol],sample=sampleInterval(protocol,kind);
  if(!sample)return{protocol,kind,status:'no-sample'};
  const{open,close}=sample,fromBlock=Number(open.blockNumber)+1,toBlock=Number(close.blockNumber);
  const urls=[process.env[cfg.rpcEnv],...cfg.fallbacks].filter(Boolean);
  const providers=[];
  for(const url of [...new Set(urls)])providers.push(await queryWithUrl({cfg,url,kind,open,fromBlock,toBlock}));
  return{
    protocol,kind,status:providers.some(x=>x.status==='query-ok')?'fallback-available':'all-query-paths-failed',
    tokenId:String(open.tokenId),rewardToken:open.rewardToken||null,fromBlock,toBlock,providers
  };
}

const results=[];
for(const protocol of ['aerodrome','velodrome']){
  results.push(await probe(protocol,'rebase-distributor'));
  results.push(await probe(protocol,'voting-reward'));
}
console.log('ve33 settlement query diagnostic JSON',JSON.stringify(results,null,2));

if(results.every(x=>x.status==='no-sample'))throw new Error('No persisted ve33 interval samples available for settlement diagnostic');
