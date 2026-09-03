#!/usr/bin/env node
import fs from 'node:fs/promises';
import { Interface, JsonRpcProvider, getAddress } from 'ethers';

const EVIDENCE_FILE=process.env.VE33_DIAGNOSTIC_EVIDENCE_FILE||'./reporting/ve33-accounting-evidence.json';
const MAX_LOG_BLOCKS=9_500;
const ADDRESS_GROUP_SIZE=48;
const CLAIM_IFACE=new Interface(['event ClaimRewards(address indexed from,address indexed reward,uint256 amount)']);
const DIRECT_IFACE=new Interface(['function getReward(uint256 tokenId,address[] tokens)']);
const VOTER_IFACE=new Interface([
  'function claimBribes(address[] bribes,address[][] tokens,uint256 tokenId)',
  'function claimFees(address[] fees,address[][] tokens,uint256 tokenId)'
]);
const CLAIM_TOPIC=CLAIM_IFACE.getEvent('ClaimRewards').topicHash;
const CONFIG={
  aerodrome:{chainId:8453,voter:'0x16613524e02ad97eDfeF371bC883F2F5d6C480A5',rpc:[process.env.BASE_RPC_URL,'https://mainnet.base.org','https://base-rpc.publicnode.com']},
  velodrome:{chainId:10,voter:'0x41C914ee0c7E1A5edCD0295623e6dC557B5aBf3C',rpc:[process.env.OPTIMISM_RPC_URL,'https://gateway.tenderly.co/public/optimism','https://mainnet.optimism.io','https://optimism-rpc.publicnode.com']}
};
const lower=v=>String(v||'').toLowerCase();
const unique=v=>[...new Set((v||[]).filter(Boolean))];
const evidence=JSON.parse(await fs.readFile(EVIDENCE_FILE,'utf8'));

function groupsForProtocol(protocol){
  const addresses=unique((evidence.checkpoints||[])
    .filter(x=>x.protocolKey===protocol&&x.kind!=='rebase-distributor'&&x.rewardContract)
    .map(x=>lower(x.rewardContract))).sort().map(getAddress);
  const groups=[];
  for(let i=0;i<addresses.length;i+=ADDRESS_GROUP_SIZE)groups.push(addresses.slice(i,i+ADDRESS_GROUP_SIZE));
  const index=new Map();
  groups.forEach((g,i)=>g.forEach(a=>index.set(lower(a),i)));
  return{groups,index};
}

function intervalsForProtocol(protocol,groupIndex){
  const byLane=new Map();
  for(const row of evidence.checkpoints||[]){
    if(row.protocolKey!==protocol||row.kind==='rebase-distributor'||!row.rewardContract)continue;
    if(groupIndex.get(lower(row.rewardContract))===undefined)continue;
    if(!byLane.has(row.laneKey))byLane.set(row.laneKey,[]);
    byLane.get(row.laneKey).push(row);
  }
  const eventKeys=new Set((evidence.events||[]).map(x=>x.eventKey));
  const out=[];
  for(const rows of byLane.values()){
    rows.sort((a,b)=>Number(a.blockNumber)-Number(b.blockNumber));
    for(let i=1;i<rows.length;i++){
      const open=rows[i-1],close=rows[i];
      if(Number(close.blockNumber)<=Number(open.blockNumber))continue;
      const key=`ve33:${open.laneKey}:${open.blockNumber}:${close.blockNumber}`;
      if(eventKeys.has(key))continue;
      out.push({laneKey:open.laneKey,protocol,rewardContract:getAddress(open.rewardContract),rewardToken:getAddress(open.rewardToken),holder:getAddress(open.holder),tokenId:String(open.tokenId),fromBlock:Number(open.blockNumber)+1,toBlock:Number(close.blockNumber)});
    }
  }
  return out;
}

async function providerFor(protocol){
  const cfg=CONFIG[protocol];
  let last=null;
  for(const url of unique(cfg.rpc)){
    try{
      const p=new JsonRpcProvider(url,cfg.chainId,{staticNetwork:true});
      await Promise.race([p.getBlockNumber(),new Promise((_,reject)=>setTimeout(()=>reject(new Error('RPC timeout')),8_000))]);
      return p;
    }catch(error){last=error;}
  }
  throw last||new Error(`No ${protocol} RPC available`);
}

async function queryLogs(protocol,provider,addresses,fromBlock,toBlock){
  const logs=[];
  for(let from=fromBlock;from<=toBlock;from+=MAX_LOG_BLOCKS){
    const to=Math.min(toBlock,from+MAX_LOG_BLOCKS-1);
    logs.push(...await provider.getLogs({address:addresses.length===1?addresses[0]:addresses,topics:[CLAIM_TOPIC],fromBlock:from,toBlock:to}));
  }
  return logs;
}

function decodeKnownCall({protocol,to,data,rewardContract,rewardToken}){
  if(!to||!data)return null;
  try{
    if(lower(to)===lower(rewardContract)){
      const parsed=DIRECT_IFACE.parseTransaction({data});
      if(parsed?.name==='getReward'&&[...parsed.args[1]].map(lower).includes(lower(rewardToken)))return{tokenId:String(parsed.args[0]),path:'direct-reward-getReward',to:getAddress(to)};
    }
    if(lower(to)===lower(CONFIG[protocol].voter)){
      const parsed=VOTER_IFACE.parseTransaction({data});
      if(!parsed||!['claimBribes','claimFees'].includes(parsed.name))return null;
      const contracts=[...parsed.args[0]],tokens=[...parsed.args[1]],idx=contracts.findIndex(x=>lower(x)===lower(rewardContract));
      if(idx>=0&&Array.from(tokens[idx]||[]).map(lower).includes(lower(rewardToken)))return{tokenId:String(parsed.args[2]),path:`voter-${parsed.name}`,to:getAddress(to)};
    }
  }catch{}
  return null;
}

function decodeTokenId({protocol,tx,rewardContract,rewardToken}){
  if(!tx)return{tokenId:null,path:'transaction-unavailable',to:null};
  const to=tx.to?getAddress(tx.to):null;
  const decoded=decodeKnownCall({protocol,to,data:tx.data,rewardContract,rewardToken});
  if(decoded)return decoded;
  return{tokenId:null,path:'unresolved-top-level-call',to};
}

function flattenTraceCalls(root,out=[],depth=0){
  if(!root||typeof root!=='object'||depth>32)return out;
  if(root.to&&root.input)out.push({from:root.from||null,to:root.to,input:root.input,type:root.type||null,depth,error:root.error||null,revertReason:root.revertReason||null});
  for(const child of root.calls||[])flattenTraceCalls(child,out,depth+1);
  return out;
}

async function traceNestedSettlement({provider,protocol,transactionHash,rewardContract,rewardToken}){
  const attempts=[
    ['debug_traceTransaction',[transactionHash,{tracer:'callTracer',timeout:'15s'}]],
    ['debug_traceTransaction',[transactionHash,{tracer:'callTracer'}]]
  ];
  let lastError=null;
  for(const [method,params] of attempts){
    try{
      const trace=await Promise.race([
        provider.send(method,params),
        new Promise((_,reject)=>setTimeout(()=>reject(new Error('trace timeout')),20_000))
      ]);
      const calls=flattenTraceCalls(trace);
      const matches=[];
      for(const call of calls){
        const decoded=decodeKnownCall({protocol,to:call.to,data:call.input,rewardContract,rewardToken});
        if(decoded)matches.push({...decoded,from:call.from,depth:call.depth,type:call.type,error:call.error||null,revertReason:call.revertReason||null,inputSelector:String(call.input||'').slice(0,10)});
      }
      return{status:matches.length?'trace-proof-found':'trace-readable-no-matching-call',callCount:calls.length,matches};
    }catch(error){lastError=error;}
  }
  return{status:'trace-unavailable',callCount:0,matches:[],error:lastError?.shortMessage||lastError?.message||String(lastError||'unknown trace error')};
}

const unresolved=[];
const stats={};
const providersByProtocol={};
for(const protocol of ['aerodrome','velodrome']){
  const {groups,index}=groupsForProtocol(protocol);
  const intervals=intervalsForProtocol(protocol,index);
  const provider=await providerFor(protocol);
  providersByProtocol[protocol]=provider;
  const cache=new Map();
  let matchingClaimLogs=0;
  for(const lane of intervals){
    const groupNo=index.get(lower(lane.rewardContract));
    const addresses=groups[groupNo];
    for(let from=lane.fromBlock;from<=lane.toBlock;from+=MAX_LOG_BLOCKS){
      const to=Math.min(lane.toBlock,from+MAX_LOG_BLOCKS-1);
      const cacheKey=`${groupNo}|${from}|${to}`;
      if(!cache.has(cacheKey))cache.set(cacheKey,queryLogs(protocol,provider,addresses,from,to));
      const logs=await cache.get(cacheKey);
      for(const log of logs){
        if(lower(log.address)!==lower(lane.rewardContract))continue;
        const parsed=CLAIM_IFACE.parseLog({topics:log.topics,data:log.data});
        if(!parsed)continue;
        const holder=getAddress(parsed.args[0]),rewardToken=getAddress(parsed.args[1]),amount=BigInt(parsed.args[2]);
        if(lower(holder)!==lower(lane.holder)||lower(rewardToken)!==lower(lane.rewardToken)||amount===0n)continue;
        matchingClaimLogs++;
        const tx=await provider.getTransaction(log.transactionHash);
        const decoded=decodeTokenId({protocol,tx,rewardContract:lane.rewardContract,rewardToken:lane.rewardToken});
        if(decoded.tokenId!==lane.tokenId)unresolved.push({
          protocol,laneKey:lane.laneKey,tokenId:lane.tokenId,rewardContract:lane.rewardContract,rewardToken:lane.rewardToken,holder:lane.holder,
          fromBlock:lane.fromBlock,toBlock:lane.toBlock,blockNumber:Number(log.blockNumber),transactionHash:String(log.transactionHash),logIndex:Number(log.index??0),
          amountRaw:amount.toString(),decodedTokenId:decoded.tokenId,decodePath:decoded.path,transactionFrom:tx?.from?getAddress(tx.from):null,transactionTo:decoded.to,
          transactionSelector:String(tx?.data||'').slice(0,10),transactionDataBytes:Math.max(0,(String(tx?.data||'').length-2)/2),error:decoded.error||null
        });
      }
    }
  }
  stats[protocol]={laneIntervals:intervals.length,addressGroups:groups.length,cacheEntries:cache.size,matchingClaimLogs};
}

const deduped=[...new Map(unresolved.map(x=>[`${x.laneKey}|${x.transactionHash}|${x.logIndex}`,x])).values()];
const traceCache=new Map();
for(const row of deduped){
  const key=[row.protocol,row.transactionHash,lower(row.rewardContract),lower(row.rewardToken)].join('|');
  if(!traceCache.has(key))traceCache.set(key,traceNestedSettlement({provider:providersByProtocol[row.protocol],protocol:row.protocol,transactionHash:row.transactionHash,rewardContract:row.rewardContract,rewardToken:row.rewardToken}));
  row.nestedTrace=await traceCache.get(key);
}
console.log('ve33 unresolved settlement attribution diagnostic',JSON.stringify({stats,unresolvedCount:deduped.length,unresolved:deduped.slice(0,20)},null,2));
