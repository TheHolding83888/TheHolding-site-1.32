#!/usr/bin/env node
import fs from 'node:fs/promises';
import { Interface, JsonRpcProvider, getAddress } from 'ethers';
import { decodeRewardClaimAttribution } from './ve33-accounting-evidence.mjs';

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
const DIRECT_SELECTOR=DIRECT_IFACE.getFunction('getReward').selector;
const CLAIM_BRIBES_SELECTOR=VOTER_IFACE.getFunction('claimBribes').selector;
const CLAIM_FEES_SELECTOR=VOTER_IFACE.getFunction('claimFees').selector;
const CONFIG={
  aerodrome:{
    chainId:8453,
    voter:'0x16613524e02ad97eDfeF371bC883F2F5d6C480A5',
    rpc:[process.env.BASE_RPC_URL,'https://mainnet.base.org','https://base-rpc.publicnode.com'],
    rangeHints:{'mainnet.base.org':2000}
  },
  velodrome:{
    chainId:10,
    voter:'0x41C914ee0c7E1A5edCD0295623e6dC557B5aBf3C',
    rpc:[process.env.OPTIMISM_RPC_URL,'https://gateway.tenderly.co/public/optimism','https://mainnet.optimism.io','https://optimism-rpc.publicnode.com'],
    rangeHints:{}
  }
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

function providerLabel(url){
  try{return new URL(url).hostname||'configured-rpc';}
  catch{return'configured-rpc';}
}

async function providerPoolFor(protocol){
  const cfg=CONFIG[protocol],candidates=[],startupFailures=[];
  for(const url of unique(cfg.rpc)){
    const label=providerLabel(url);
    try{
      const provider=new JsonRpcProvider(url,cfg.chainId,{staticNetwork:true});
      await Promise.race([provider.getBlockNumber(),new Promise((_,reject)=>setTimeout(()=>reject(new Error('RPC timeout')),8_000))]);
      candidates.push({url,label,provider,maxLogRange:Number(cfg.rangeHints?.[label]||0)||null});
    }catch(error){
      startupFailures.push({provider:label,error:error?.shortMessage||error?.message||String(error)});
    }
  }
  if(!candidates.length)throw new Error(`No ${protocol} RPC available: ${JSON.stringify(startupFailures)}`);
  return{protocol,cfg,candidates,preferredIndex:0,startupFailures,queryFailures:[],failoverCount:0};
}

function errorText(error){
  return[
    error?.error?.message,error?.info?.error?.message,error?.shortMessage,error?.message,String(error||'')
  ].filter(Boolean).join(' | ').toLowerCase();
}

function isRangeError(error){
  return /block range is too large|limited to (?:a )?[0-9,]+ range|limited to\s*0\s*-\s*[0-9,]+\s*blocks?\s*range|range.*too large|exceed.*block.*range/.test(errorText(error));
}

function numericRangeLimit(error){
  const text=errorText(error);
  for(const pattern of [
    /limited to (?:a )?([0-9,]+) range/,
    /limited to\s*0\s*-\s*([0-9,]+)\s*blocks?\s*range/
  ]){
    const match=text.match(pattern);
    if(!match)continue;
    const value=Number(String(match[1]).replace(/,/g,''));
    if(Number.isFinite(value)&&value>0)return value;
  }
  return null;
}

async function queryLogsOnCandidate(candidate,addresses,fromBlock,toBlock){
  const span=Number(toBlock)-Number(fromBlock)+1;
  if(Number(candidate.maxLogRange)>0&&span>Number(candidate.maxLogRange)){
    const logs=[];
    for(let from=fromBlock;from<=toBlock;from+=Number(candidate.maxLogRange)){
      const to=Math.min(toBlock,from+Number(candidate.maxLogRange)-1);
      logs.push(...await queryLogsOnCandidate(candidate,addresses,from,to));
    }
    return logs;
  }
  try{
    return await candidate.provider.getLogs({address:addresses.length===1?addresses[0]:addresses,topics:[CLAIM_TOPIC],fromBlock,toBlock});
  }catch(error){
    const learned=numericRangeLimit(error);
    if(learned&&(!candidate.maxLogRange||learned<Number(candidate.maxLogRange)))candidate.maxLogRange=learned;
    if(!isRangeError(error)||fromBlock>=toBlock)throw error;
    if(Number(candidate.maxLogRange)>0&&span>Number(candidate.maxLogRange))return queryLogsOnCandidate(candidate,addresses,fromBlock,toBlock);
    const mid=Math.floor((fromBlock+toBlock)/2);
    const left=await queryLogsOnCandidate(candidate,addresses,fromBlock,mid);
    const right=await queryLogsOnCandidate(candidate,addresses,mid+1,toBlock);
    return[...left,...right];
  }
}

async function queryLogsWithFailover(pool,addresses,fromBlock,toBlock){
  let last=null;
  const order=[pool.preferredIndex,...pool.candidates.map((_,i)=>i).filter(i=>i!==pool.preferredIndex)];
  for(const index of order){
    const candidate=pool.candidates[index];
    try{
      const logs=await queryLogsOnCandidate(candidate,addresses,fromBlock,toBlock);
      if(index!==pool.preferredIndex){pool.preferredIndex=index;pool.failoverCount++;}
      return logs;
    }catch(error){
      last=error;
      if(pool.queryFailures.length<20)pool.queryFailures.push({
        provider:candidate.label,fromBlock,toBlock,
        error:error?.shortMessage||error?.error?.message||error?.info?.error?.message||error?.message||String(error)
      });
    }
  }
  throw last||new Error(`All ${pool.protocol} settlement RPCs failed for ${fromBlock}-${toBlock}`);
}

async function getTransactionWithFailover(pool,hash){
  let last=null;
  const order=[pool.preferredIndex,...pool.candidates.map((_,i)=>i).filter(i=>i!==pool.preferredIndex)];
  for(const index of order){
    const candidate=pool.candidates[index];
    try{
      const tx=await candidate.provider.getTransaction(hash);
      if(tx){
        if(index!==pool.preferredIndex){pool.preferredIndex=index;pool.failoverCount++;}
        return tx;
      }
    }catch(error){last=error;}
  }
  if(last)throw last;
  return null;
}

function positions(data,needle){
  const body=lower(data).replace(/^0x/,'');
  const target=lower(needle).replace(/^0x/,'');
  const out=[];
  if(!target)return out;
  let from=0;
  while(true){
    const at=body.indexOf(target,from);
    if(at<0)break;
    out.push(Math.floor(at/2));
    from=at+2;
    if(out.length>=20)break;
  }
  return out;
}

function calldataFingerprint(protocol,tx,rewardContract){
  const data=String(tx?.data||'0x');
  return{
    selector:data.slice(0,10),
    bytes:Math.max(0,(data.length-2)/2),
    directGetRewardSelector:DIRECT_SELECTOR,
    claimBribesSelector:CLAIM_BRIBES_SELECTOR,
    claimFeesSelector:CLAIM_FEES_SELECTOR,
    embeddedDirectGetRewardAtBytes:positions(data,DIRECT_SELECTOR),
    embeddedClaimBribesAtBytes:positions(data,CLAIM_BRIBES_SELECTOR),
    embeddedClaimFeesAtBytes:positions(data,CLAIM_FEES_SELECTOR),
    rewardContractAddressAtBytes:positions(data,rewardContract),
    voterAddressAtBytes:positions(data,CONFIG[protocol].voter),
    prefix:data.slice(0,Math.min(data.length,2050))
  };
}

const unresolved=[];
const resolvedNested=[];
const stats={};
for(const protocol of ['aerodrome','velodrome']){
  const {groups,index}=groupsForProtocol(protocol);
  const intervals=intervalsForProtocol(protocol,index);
  const pool=await providerPoolFor(protocol);
  const cache=new Map();
  let matchingClaimLogs=0;
  for(const lane of intervals){
    const groupNo=index.get(lower(lane.rewardContract));
    const addresses=groups[groupNo];
    for(let from=lane.fromBlock;from<=lane.toBlock;from+=MAX_LOG_BLOCKS){
      const to=Math.min(lane.toBlock,from+MAX_LOG_BLOCKS-1);
      const cacheKey=`${groupNo}|${from}|${to}`;
      if(!cache.has(cacheKey))cache.set(cacheKey,queryLogsWithFailover(pool,addresses,from,to));
      const logs=await cache.get(cacheKey);
      for(const log of logs){
        if(lower(log.address)!==lower(lane.rewardContract))continue;
        const parsed=CLAIM_IFACE.parseLog({topics:log.topics,data:log.data});
        if(!parsed)continue;
        const holder=getAddress(parsed.args[0]),rewardToken=getAddress(parsed.args[1]),amount=BigInt(parsed.args[2]);
        if(lower(holder)!==lower(lane.holder)||lower(rewardToken)!==lower(lane.rewardToken)||amount===0n)continue;
        matchingClaimLogs++;
        let tx=null,transactionError=null;
        try{tx=await getTransactionWithFailover(pool,log.transactionHash);}catch(error){transactionError=error?.shortMessage||error?.message||String(error);}
        const attribution=tx?decodeRewardClaimAttribution({
          to:tx.to,data:tx.data,rewardContract:lane.rewardContract,rewardToken:lane.rewardToken,
          voter:CONFIG[protocol].voter,holder:lane.holder
        }):{tokenId:null,path:'transaction-unavailable',error:transactionError};
        const proof={
          protocol,laneKey:lane.laneKey,tokenId:lane.tokenId,rewardContract:lane.rewardContract,rewardToken:lane.rewardToken,holder:lane.holder,
          fromBlock:lane.fromBlock,toBlock:lane.toBlock,blockNumber:Number(log.blockNumber),transactionHash:String(log.transactionHash),logIndex:Number(log.index??0),
          amountRaw:amount.toString(),decodedTokenId:attribution.tokenId,decodePath:attribution.path,transactionFrom:tx?.from?getAddress(tx.from):null,
          transactionTo:tx?.to?getAddress(tx.to):null,calldata:calldataFingerprint(protocol,tx,lane.rewardContract),error:attribution.error||null
        };
        if(attribution.tokenId!==lane.tokenId)unresolved.push(proof);
        else if(String(attribution.path||'').startsWith('holder-multicall-'))resolvedNested.push(proof);
      }
    }
  }
  stats[protocol]={
    laneIntervals:intervals.length,addressGroups:groups.length,cacheEntries:cache.size,matchingClaimLogs,
    preferredProvider:pool.candidates[pool.preferredIndex]?.label||null,
    candidateProviders:pool.candidates.map(x=>({provider:x.label,maxLogRange:x.maxLogRange||null})),
    startupFailures:pool.startupFailures,queryFailures:pool.queryFailures,failoverCount:pool.failoverCount
  };
}

const dedupe=rows=>[...new Map(rows.map(x=>[`${x.laneKey}|${x.transactionHash}|${x.logIndex}`,x])).values()];
const dedupedUnresolved=dedupe(unresolved),dedupedNested=dedupe(resolvedNested);
console.log('ve33 unresolved settlement attribution diagnostic',JSON.stringify({
  stats,
  unresolvedCount:dedupedUnresolved.length,
  resolvedHolderMulticallCount:dedupedNested.length,
  resolvedHolderMulticall:dedupedNested.slice(0,20),
  unresolved:dedupedUnresolved.slice(0,20)
},null,2));
