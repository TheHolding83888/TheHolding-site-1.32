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
const lower=v=>String(v||'').toLowerCase();

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

async function providerFor(cfg){
  const urls=[process.env[cfg.rpcEnv],...cfg.fallbacks].filter(Boolean);
  const failures=[];
  for(const url of urls){
    try{
      const provider=new JsonRpcProvider(url,cfg.chainId);
      const latest=await provider.getBlockNumber();
      return{provider,url,latest,failures};
    }catch(error){failures.push({url,error:compactError(error)});}
  }
  throw new Error(`No provider available: ${JSON.stringify(failures)}`);
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

async function probe(protocol,kind){
  const cfg=CONFIG[protocol],sample=sampleInterval(protocol,kind);
  if(!sample)return{protocol,kind,status:'no-sample'};
  const{provider,url,latest,failures}=await providerFor(cfg);
  const{open,close}=sample,fromBlock=Number(open.blockNumber)+1,toBlock=Number(close.blockNumber);
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
    return{
      protocol,kind,status:'query-ok',provider:url,providerFallbackFailures:failures,latestBlock:latest,
      address,tokenId:String(open.tokenId),rewardToken:open.rewardToken||null,fromBlock,toBlock,logCount:logs.length
    };
  }catch(error){
    return{
      protocol,kind,status:'query-failed',provider:url,providerFallbackFailures:failures,latestBlock:latest,
      address:kind==='rebase-distributor'?open.distributor:open.rewardContract,
      tokenId:String(open.tokenId),rewardToken:open.rewardToken||null,fromBlock,toBlock,error:compactError(error)
    };
  }
}

const results=[];
for(const protocol of ['aerodrome','velodrome']){
  results.push(await probe(protocol,'rebase-distributor'));
  results.push(await probe(protocol,'voting-reward'));
}
console.log('ve33 settlement query diagnostic JSON',JSON.stringify(results,null,2));

if(results.every(x=>x.status==='no-sample'))throw new Error('No persisted ve33 interval samples available for settlement diagnostic');
