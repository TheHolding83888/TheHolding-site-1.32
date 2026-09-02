#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { Contract, Interface, JsonRpcProvider, getAddress, formatUnits } from 'ethers';

const __filename=fileURLToPath(import.meta.url);
const __dirname=path.dirname(__filename);
const ROOT=path.resolve(__dirname,'..');

export const VERSION='0.1-ve33-factual-accrual-evidence';
export const FULL_ACCOUNTING_START='2026-09-01T00:00:00.000Z';
const DEFAULT_REWARDS=process.env.REWARDS_DATA_FILE||path.join(ROOT,'companies','rewards-data.json');
const DEFAULT_OUTPUT=process.env.VE33_EVIDENCE_FILE||path.join(ROOT,'reporting','ve33-accounting-evidence.json');
const MAX_LOG_BLOCKS=80_000;
const MAX_CHECKPOINTS_PER_LANE=460;
const BLOCK_LOOKUP_TIMEOUT_MS=8_000;
const BLOCK_LOOKUP_RETRIES=3;
const RECENT_BOUNDARY_INITIAL_STEP=4_096;

export const PROTOCOLS=Object.freeze({
  aerodrome:{
    protocol:'Aerodrome',providerKey:'base',chain:'Base',chainId:8453,
    rpcEnv:'BASE_RPC_URL',rpcFallbacks:['https://base-rpc.publicnode.com','https://mainnet.base.org'],
    votingEscrow:'0xeBf418Fe2512e7E6bd9b87a8F0f294aCDC67e6B4',
    rewardsDistributor:'0x227f65131A261548b057215bB1D5Ab2997964C7d',
    voter:'0x16613524e02ad97eDfeF371bC883F2F5d6C480A5',
    baseToken:'0x940181a94A35A4569E4529A3CDfB74e38FD98631',baseSymbol:'AERO',
    routes:['aerodrome-ve']
  },
  velodrome:{
    protocol:'Velodrome',providerKey:'optimism',chain:'Optimism',chainId:10,
    rpcEnv:'OPTIMISM_RPC_URL',rpcFallbacks:['https://optimism-rpc.publicnode.com','https://mainnet.optimism.io'],
    votingEscrow:'0xFAf8FD17D9840595845582fCB047DF13f006787d',
    rewardsDistributor:'0x9D4736EC60715e71aFe72973f7885DCBC21EA99b',
    voter:'0x41C914ee0c7E1A5edCD0295623e6dC557B5aBf3C',
    baseToken:'0x9560e827aF36c94D2Ac33a39bCE1Fe78631088Db',baseSymbol:'VELO',
    routes:['velodrome-ve','velodrome-ve-direct']
  }
});

const REWARD_ABI=[
  'function rewardsListLength() view returns (uint256)',
  'function rewards(uint256 index) view returns (address)',
  'function earned(address token,uint256 tokenId) view returns (uint256)',
  'event ClaimRewards(address indexed from,address indexed reward,uint256 amount)'
];
const REWARDS_DISTRIBUTOR_ABI=[
  'function claimable(uint256 tokenId) view returns (uint256)',
  'event Claimed(uint256 indexed tokenId,uint256 indexed epochStart,uint256 indexed epochEnd,uint256 amount)'
];
const VE_ABI=['function ownerOf(uint256 tokenId) view returns (address)'];
const ERC20_ABI=['function decimals() view returns (uint8)','function symbol() view returns (string)'];
const DIRECT_REWARD_IFACE=new Interface(['function getReward(uint256 tokenId,address[] tokens)']);
const VOTER_CLAIM_IFACE=new Interface([
  'function claimBribes(address[] bribes,address[][] tokens,uint256 tokenId)',
  'function claimFees(address[] fees,address[][] tokens,uint256 tokenId)'
]);

const lower=v=>String(v||'').toLowerCase();
const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
const round=(v,d=12)=>finite(v)?Number(Number(v).toFixed(d)):null;
const isAddress=v=>/^0x[0-9a-f]{40}$/i.test(String(v||''));
const previousDay=v=>new Date(Date.parse(v)-1).toISOString().slice(0,10);
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));

async function readJson(file,fallback={}){try{return JSON.parse(await fs.readFile(file,'utf8'));}catch{return fallback;}}
async function writeJson(file,data){await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,JSON.stringify(data,null,2)+'\n');}
function unique(values){return[...new Set((values||[]).filter(Boolean))];}

export function reconcileEntitlement(openingRaw,closingRaw,settlementRaw='0'){
  try{
    const opening=BigInt(openingRaw),closing=BigInt(closingRaw),settled=BigInt(settlementRaw);
    const earned=closing+settled-opening;
    if(earned<0n)return{accepted:false,status:'negative-reconciliation-required',earnedRaw:earned.toString()};
    if(earned===0n)return{accepted:true,status:'zero-new-earned',earnedRaw:'0'};
    return{accepted:true,status:'positive-factual-accrual',earnedRaw:earned.toString()};
  }catch{return{accepted:false,status:'invalid-boundary',earnedRaw:null};}
}

function laneKey(x){
  const parts=[x.protocolKey,x.company,lower(x.holder),String(x.tokenId),x.kind,lower(x.rewardContract||x.distributor),lower(x.rewardToken)];
  return parts.join('|');
}
function checkpointKey(lane,blockNumber){return`${lane.laneKey}|${blockNumber}`;}
function eventKey(lane,open,close){return`ve33:${lane.laneKey}:${open.blockNumber}:${close.blockNumber}`;}

function priceMap(rewards){
  const map=new Map();
  for(const c of Object.values(rewards?.companies||{}))for(const r of c?.rewards||[]){
    if(!isAddress(r?.token)||!(finite(r?.priceUsd)&&Number(r.priceUsd)>0))continue;
    const k=lower(r.token),arr=map.get(k)||[];
    arr.push({priceUsd:Number(r.priceUsd),priceMethod:r.priceMethod||null,observedAt:rewards.generatedAt||null});
    map.set(k,arr);
  }
  const out=new Map();
  for(const[k,rows]of map){rows.sort((a,b)=>a.priceUsd-b.priceUsd);out.set(k,rows[Math.floor(rows.length/2)]);}
  return out;
}

function sourcePositions(source){
  const out=[];
  const push=(pos,holder,walletAlias=null)=>{
    if(!pos?.tokenId||!isAddress(holder))return;
    out.push({...pos,holder:getAddress(holder),walletAlias,custodyContext:pos.custodyContext||'direct-wallet'});
  };
  for(const p of source?.details?.positions||[])push(p,p?.holderAddress||null,p?.walletAlias||null);
  for(const wr of source?.details?.walletResults||[])for(const p of wr?.details?.positions||[])push(p,p?.holderAddress||wr?.wallet,wr?.walletAlias||null);
  const seen=new Set();
  return out.filter(p=>{
    const k=`${lower(p.holder)}:${p.tokenId}:${p.mode||''}:${lower(p.freeManagedReward||'')}`;
    if(seen.has(k))return false;
    seen.add(k);
    return true;
  });
}

function currentRewardContracts(rewards,company,route,tokenId,providerKey){
  const out=[];
  const idx=rewards?.internalState?.directVeRewardIndex?.[`${providerKey}:${tokenId}`];
  for(const x of idx?.contracts||[])if(isAddress(x?.rewardAddress))out.push(getAddress(x.rewardAddress));
  for(const r of rewards?.companies?.[company]?.rewards||[]){
    if(r?.route!==route||String(r?.details?.tokenId||'')!==String(tokenId))continue;
    if(isAddress(r?.details?.rewardContract))out.push(getAddress(r.details.rewardContract));
  }
  return unique(out.map(lower)).map(getAddress);
}

export function trackedPositionDescriptors(rewards){
  const rows=[];
  for(const[company,c]of Object.entries(rewards?.companies||{})){
    for(const source of c?.sources||[]){
      for(const[protocolKey,cfg]of Object.entries(PROTOCOLS)){
        if(!cfg.routes.includes(source?.route))continue;
        for(const p of sourcePositions(source)){
          rows.push({
            company,protocolKey,protocol:cfg.protocol,route:source.route,holder:p.holder,
            walletAlias:p.walletAlias||null,tokenId:String(p.tokenId),mode:p.mode||null,
            custodyContext:p.custodyContext||'direct-wallet',managedTokenId:p.managedTokenId?String(p.managedTokenId):null,
            freeManagedReward:isAddress(p.freeManagedReward)?getAddress(p.freeManagedReward):null,
            rewardContracts:currentRewardContracts(rewards,company,source.route,p.tokenId,cfg.providerKey)
          });
        }
      }
    }
  }
  const seen=new Set();
  return rows.filter(x=>{
    const k=[x.company,x.protocolKey,x.route,lower(x.holder),x.tokenId,x.mode].join('|');
    if(seen.has(k))return false;
    seen.add(k);
    return true;
  });
}

async function providerFor(cfg){
  const urls=unique([process.env[cfg.rpcEnv],...cfg.rpcFallbacks]);
  let last=null;
  for(const url of urls){
    try{
      const p=new JsonRpcProvider(url,cfg.chainId);
      await Promise.race([
        p.getBlockNumber(),
        new Promise((_,reject)=>setTimeout(()=>reject(new Error('RPC timeout')),8_000))
      ]);
      return p;
    }catch(error){last=error;}
  }
  throw last||new Error(`No ${cfg.protocol} RPC available`);
}

async function getBlockReliable(provider,blockNumber,{attempts=BLOCK_LOOKUP_RETRIES,timeoutMs=BLOCK_LOOKUP_TIMEOUT_MS}={}){
  let last=null;
  for(let attempt=1;attempt<=attempts;attempt++){
    try{
      const block=await Promise.race([
        provider.getBlock(blockNumber),
        new Promise((_,reject)=>setTimeout(()=>reject(new Error(`Block ${blockNumber} lookup timeout`)),timeoutMs))
      ]);
      if(block)return block;
      last=new Error(`Block ${blockNumber} unavailable`);
    }catch(error){last=error;}
    if(attempt<attempts)await wait(250*attempt);
  }
  throw last||new Error(`Block ${blockNumber} unavailable`);
}

export async function blockAtOrBefore(provider,timestamp,latestNumber,cache=new Map()){
  const key=String(timestamp);
  if(cache.has(key))return cache.get(key);
  const target=Math.floor(Date.parse(timestamp)/1000);
  if(!Number.isFinite(target))throw new Error(`Invalid timestamp ${timestamp}`);

  const latest=await getBlockReliable(provider,latestNumber);
  if(Number(latest.timestamp)<=target){
    const out={blockNumber:Number(latest.number),blockTimestamp:new Date(Number(latest.timestamp)*1000).toISOString()};
    cache.set(key,out);
    return out;
  }

  let hiNumber=Number(latestNumber),loNumber=null,loBlock=null;
  let step=RECENT_BOUNDARY_INITIAL_STEP;
  while(loNumber===null){
    const candidate=Math.max(0,Number(latestNumber)-step);
    const block=await getBlockReliable(provider,candidate);
    if(Number(block.timestamp)<=target){
      loNumber=candidate;
      loBlock=block;
      break;
    }
    hiNumber=candidate;
    if(candidate===0)throw new Error(`Boundary ${timestamp} predates available chain history`);
    step*=2;
  }

  while(loNumber+1<hiNumber){
    const mid=Math.floor((loNumber+hiNumber)/2);
    const block=await getBlockReliable(provider,mid);
    if(Number(block.timestamp)<=target){
      loNumber=mid;
      loBlock=block;
    }else{
      hiNumber=mid;
    }
  }

  if(!loBlock)loBlock=await getBlockReliable(provider,loNumber);
  const out={blockNumber:Number(loBlock.number),blockTimestamp:new Date(Number(loBlock.timestamp)*1000).toISOString()};
  cache.set(key,out);
  return out;
}

function monthBoundaries(startIso,endIso){
  const out=[],start=new Date(startIso),end=new Date(endIso);
  let y=start.getUTCFullYear(),m=start.getUTCMonth();
  while(true){
    const d=new Date(Date.UTC(y,m,1));
    if(d>end)break;
    if(d>=start)out.push(d.toISOString());
    m++;
    if(m>11){m=0;y++;}
  }
  return out;
}

async function rewardTokens(contract,blockTag){
  const n=Math.min(Number(await contract.rewardsListLength({blockTag})),32),out=[];
  for(let i=0;i<n;i++){
    const token=getAddress(await contract.rewards(i,{blockTag}));
    if(!out.some(x=>lower(x)===lower(token)))out.push(token);
  }
  return out;
}

async function tokenMeta(provider,token,blockTag){
  const c=new Contract(token,ERC20_ABI,provider);
  let symbol='TOKEN',decimals=18;
  try{symbol=await c.symbol({blockTag});}catch{}
  try{decimals=Number(await c.decimals({blockTag}));}catch{}
  return{symbol,decimals};
}

export function decodeRewardClaimTokenId({to,data,rewardContract,rewardToken,voter}){
  try{
    if(lower(to)===lower(rewardContract)){
      const p=DIRECT_REWARD_IFACE.parseTransaction({data});
      if(!p||p.name!=='getReward')return null;
      const tokens=[...p.args[1]].map(lower);
      if(!tokens.includes(lower(rewardToken)))return null;
      return String(p.args[0]);
    }
    if(lower(to)===lower(voter)){
      const p=VOTER_CLAIM_IFACE.parseTransaction({data});
      if(!p||!['claimBribes','claimFees'].includes(p.name))return null;
      const contracts=[...p.args[0]],tokens=[...p.args[1]],idx=contracts.findIndex(x=>lower(x)===lower(rewardContract));
      if(idx<0||!Array.from(tokens[idx]||[]).map(lower).includes(lower(rewardToken)))return null;
      return String(p.args[2]);
    }
  }catch{}
  return null;
}

async function rewardClaimSettlements({provider,contract,cfg,lane,fromBlock,toBlock}){
  if(toBlock<fromBlock)return{complete:true,amountRaw:'0',events:[],unresolved:[]};
  const filter=contract.filters.ClaimRewards(null,lane.rewardToken),events=[],unresolved=[];
  let total=0n;
  for(let from=fromBlock;from<=toBlock;from+=MAX_LOG_BLOCKS){
    const to=Math.min(toBlock,from+MAX_LOG_BLOCKS-1),logs=await contract.queryFilter(filter,from,to);
    for(const log of logs){
      const recipient=String(log?.args?.[0]||''),amount=BigInt(log?.args?.[2]||0);
      if(lower(recipient)!==lower(lane.holder)||amount===0n)continue;
      const tx=await provider.getTransaction(log.transactionHash);
      const decoded=tx?decodeRewardClaimTokenId({to:tx.to,data:tx.data,rewardContract:lane.rewardContract,rewardToken:lane.rewardToken,voter:cfg.voter}):null;
      const proof={
        blockNumber:Number(log.blockNumber),transactionHash:String(log.transactionHash||''),logIndex:Number(log.index??0),
        recipient,rewardToken:lane.rewardToken,amountRaw:amount.toString(),decodedTokenId:decoded,
        decodePath:tx?lower(tx.to)===lower(lane.rewardContract)?'direct-reward-getReward':lower(tx.to)===lower(cfg.voter)?'voter-claimFees-or-claimBribes':'unresolved-top-level-call':'transaction-unavailable'
      };
      if(decoded!==String(lane.tokenId)){unresolved.push(proof);continue;}
      total+=amount;
      events.push(proof);
    }
  }
  return{complete:unresolved.length===0,amountRaw:total.toString(),events,unresolved};
}

async function rebaseSettlements({contract,lane,fromBlock,toBlock}){
  if(toBlock<fromBlock)return{complete:true,amountRaw:'0',events:[]};
  const events=[];
  let total=0n;
  for(let from=fromBlock;from<=toBlock;from+=MAX_LOG_BLOCKS){
    const to=Math.min(toBlock,from+MAX_LOG_BLOCKS-1),logs=await contract.queryFilter(contract.filters.Claimed(BigInt(lane.tokenId)),from,to);
    for(const log of logs){
      const amount=BigInt(log?.args?.[3]||0);
      total+=amount;
      events.push({
        blockNumber:Number(log.blockNumber),transactionHash:String(log.transactionHash||''),logIndex:Number(log.index??0),
        tokenId:String(log.args?.[0]||lane.tokenId),epochStart:String(log.args?.[1]||''),epochEnd:String(log.args?.[2]||''),amountRaw:amount.toString()
      });
    }
  }
  return{complete:true,amountRaw:total.toString(),events};
}

function retainCheckpoints(rows){
  const groups=new Map();
  for(const x of rows){if(!groups.has(x.laneKey))groups.set(x.laneKey,[]);groups.get(x.laneKey).push(x);}
  return[...groups.values()]
    .flatMap(xs=>xs.sort((a,b)=>Number(a.blockNumber)-Number(b.blockNumber)).slice(-MAX_CHECKPOINTS_PER_LANE))
    .sort((a,b)=>a.laneKey.localeCompare(b.laneKey)||Number(a.blockNumber)-Number(b.blockNumber));
}
function eventEconomicDate(close){return close?.monthBoundary?previousDay(close.observedAt):String(close.observedAt).slice(0,10);}
function intervalMonth(open,close){
  const economicDate=eventEconomicDate(close),month=economicDate.slice(0,7),a=String(open.observedAt).slice(0,7),b=close.monthBoundary?month:String(close.observedAt).slice(0,7);
  return a===b?month:(close.monthBoundary?month:null);
}

async function buildProtocolLanes({rewards,cfg,protocolKey,provider,latestNumber,prices}){
  const descriptors=trackedPositionDescriptors(rewards).filter(x=>x.protocolKey===protocolKey),lanes=[];
  for(const p of descriptors){
    if(p.mode==='direct'){
      lanes.push({
        protocolKey,protocol:cfg.protocol,chain:cfg.chain,chainId:cfg.chainId,route:p.route,company:p.company,
        holder:p.holder,walletAlias:p.walletAlias,tokenId:p.tokenId,custodyContext:p.custodyContext,
        kind:'rebase-distributor',distributor:cfg.rewardsDistributor,rewardContract:null,
        rewardToken:getAddress(cfg.baseToken),rewardSymbol:cfg.baseSymbol,decimals:18
      });
      for(const rewardAddress of p.rewardContracts){
        const c=new Contract(rewardAddress,REWARD_ABI,provider);
        let tokens=[];
        try{tokens=await rewardTokens(c,latestNumber);}catch{continue;}
        for(const token of tokens){
          const meta=await tokenMeta(provider,token,latestNumber);
          lanes.push({
            protocolKey,protocol:cfg.protocol,chain:cfg.chain,chainId:cfg.chainId,route:p.route,company:p.company,
            holder:p.holder,walletAlias:p.walletAlias,tokenId:p.tokenId,custodyContext:p.custodyContext,
            kind:'voting-reward',rewardContract:getAddress(rewardAddress),distributor:null,
            rewardToken:getAddress(token),rewardSymbol:meta.symbol,decimals:meta.decimals
          });
        }
      }
    }
    if(p.mode==='managed'&&p.freeManagedReward){
      const c=new Contract(p.freeManagedReward,REWARD_ABI,provider);
      let tokens=[];
      try{tokens=await rewardTokens(c,latestNumber);}catch{continue;}
      for(const token of tokens){
        const meta=await tokenMeta(provider,token,latestNumber);
        lanes.push({
          protocolKey,protocol:cfg.protocol,chain:cfg.chain,chainId:cfg.chainId,route:p.route,company:p.company,
          holder:p.holder,walletAlias:p.walletAlias,tokenId:p.tokenId,custodyContext:p.custodyContext,
          managedTokenId:p.managedTokenId,kind:'free-managed-reward',rewardContract:getAddress(p.freeManagedReward),
          distributor:null,rewardToken:getAddress(token),rewardSymbol:meta.symbol,decimals:meta.decimals
        });
      }
    }
  }
  const seen=new Set();
  return lanes.filter(x=>{
    x.laneKey=laneKey(x);
    x.price=prices.get(lower(x.rewardToken))||null;
    if(seen.has(x.laneKey))return false;
    seen.add(x.laneKey);
    return true;
  });
}

async function readLaneState({provider,cfg,lane,blockNumber,observedAt,monthBoundary=false}){
  try{
    const ve=new Contract(cfg.votingEscrow,VE_ABI,provider),owner=getAddress(await ve.ownerOf(BigInt(lane.tokenId),{blockTag:blockNumber}));
    if(lower(owner)!==lower(lane.holder))return{ok:false,status:'holder-mismatch',owner};
    let raw;
    if(lane.kind==='rebase-distributor')raw=await new Contract(cfg.rewardsDistributor,REWARDS_DISTRIBUTOR_ABI,provider).claimable(BigInt(lane.tokenId),{blockTag:blockNumber});
    else raw=await new Contract(lane.rewardContract,REWARD_ABI,provider).earned(lane.rewardToken,BigInt(lane.tokenId),{blockTag:blockNumber});
    return{
      ok:true,checkpointKey:checkpointKey(lane,blockNumber),laneKey:lane.laneKey,company:lane.company,
      protocolKey:lane.protocolKey,protocol:lane.protocol,chain:lane.chain,chainId:lane.chainId,route:lane.route,
      holder:lane.holder,tokenId:lane.tokenId,custodyContext:lane.custodyContext,kind:lane.kind,
      rewardContract:lane.rewardContract,distributor:lane.distributor,rewardToken:lane.rewardToken,rewardSymbol:lane.rewardSymbol,
      decimals:lane.decimals,observedAt,blockNumber,entitlementRaw:BigInt(raw).toString(),
      entitlementAmount:round(Number(formatUnits(raw,lane.decimals)),12),monthBoundary,exactBlockTaggedState:true,
      periodIncomeAuthority:false,unknownIsNotZero:true
    };
  }catch(error){return{ok:false,status:'archive-state-unavailable',error:error?.shortMessage||error?.message||String(error)};}
}

export async function buildVe33Evidence({rewards,previous={},generatedAt=new Date().toISOString(),providers={}}={}){
  const authority={executionAuthority:'none',walletAuthority:'none',claimingAuthority:'none',capitalExecution:false,methodologyMutationAuthority:'none'};
  const prices=priceMap(rewards),existing=new Map((previous?.checkpoints||[]).filter(x=>x?.checkpointKey).map(x=>[x.checkpointKey,x])),priorEvents=new Map((previous?.events||[]).filter(x=>x?.eventKey).map(x=>[x.eventKey,x]));
  const diagnostics={protocols:{},laneCount:0,acceptedPositiveIntervalCount:0,zeroIntervalCount:0,reconciliationCount:0,unresolvedSettlementCount:0,unvaluedIntervalCount:0,referenceAprUsed:false,unknownIsNotZero:true};

  for(const[protocolKey,cfg]of Object.entries(PROTOCOLS)){
    const provider=providers[protocolKey]||await providerFor(cfg);
    const latestNumber=await provider.getBlockNumber(),latestBlock=await getBlockReliable(provider,latestNumber);
    const observedAt=new Date(Number(latestBlock.timestamp)*1000).toISOString(),blockCache=new Map();
    const lanes=await buildProtocolLanes({rewards,cfg,protocolKey,provider,latestNumber,prices});
    diagnostics.laneCount+=lanes.length;
    const pd={latestBlockNumber:latestNumber,observedAt,laneCount:lanes.length,boundaryFailures:[],intervalCount:0,settlementEventCount:0};
    diagnostics.protocols[protocolKey]=pd;

    const boundaries=monthBoundaries(FULL_ACCOUNTING_START,observedAt);
    const boundaryBlocks=new Map();
    for(const boundaryAt of boundaries){
      try{
        boundaryBlocks.set(boundaryAt,await blockAtOrBefore(provider,boundaryAt,latestNumber,blockCache));
      }catch(error){
        pd.boundaryFailures.push({
          laneKey:null,boundaryAt,status:'boundary-block-unavailable',
          error:error?.shortMessage||error?.message||String(error)
        });
      }
    }

    for(const lane of lanes){
      for(const boundaryAt of boundaries){
        const b=boundaryBlocks.get(boundaryAt);
        if(!b)continue;
        const key=checkpointKey(lane,b.blockNumber);
        if(existing.has(key))continue;
        const state=await readLaneState({provider,cfg,lane,blockNumber:b.blockNumber,observedAt:boundaryAt,monthBoundary:true});
        if(state.ok)existing.set(key,state);else pd.boundaryFailures.push({laneKey:lane.laneKey,boundaryAt,...state});
      }
      const current=await readLaneState({provider,cfg,lane,blockNumber:latestNumber,observedAt,monthBoundary:false});
      if(current.ok)existing.set(current.checkpointKey,current);else pd.boundaryFailures.push({laneKey:lane.laneKey,boundaryAt:observedAt,...current});
    }

    const protocolCheckpoints=[...existing.values()].filter(x=>x.protocolKey===protocolKey).sort((a,b)=>a.laneKey.localeCompare(b.laneKey)||Number(a.blockNumber)-Number(b.blockNumber));
    for(const lane of lanes){
      const rows=protocolCheckpoints.filter(x=>x.laneKey===lane.laneKey);
      for(let i=1;i<rows.length;i++){
        const open=rows[i-1],close=rows[i];
        if(Number(close.blockNumber)<=Number(open.blockNumber))continue;
        pd.intervalCount++;
        const key=eventKey(lane,open,close);
        if(priorEvents.has(key))continue;
        let settlements;
        try{
          settlements=lane.kind==='rebase-distributor'
            ?await rebaseSettlements({contract:new Contract(cfg.rewardsDistributor,REWARDS_DISTRIBUTOR_ABI,provider),lane,fromBlock:Number(open.blockNumber)+1,toBlock:Number(close.blockNumber)})
            :await rewardClaimSettlements({provider,contract:new Contract(lane.rewardContract,REWARD_ABI,provider),cfg,lane,fromBlock:Number(open.blockNumber)+1,toBlock:Number(close.blockNumber)});
        }catch{diagnostics.reconciliationCount++;continue;}
        pd.settlementEventCount+=(settlements.events||[]).length;
        if(settlements.complete!==true){
          diagnostics.reconciliationCount++;
          diagnostics.unresolvedSettlementCount+=(settlements.unresolved||[]).length;
          continue;
        }
        const r=reconcileEntitlement(open.entitlementRaw,close.entitlementRaw,settlements.amountRaw);
        if(!r.accepted){diagnostics.reconciliationCount++;continue;}
        if(r.earnedRaw==='0'){diagnostics.zeroIntervalCount++;continue;}
        const month=intervalMonth(open,close);
        if(!month){diagnostics.reconciliationCount++;continue;}
        const amount=Number(formatUnits(BigInt(r.earnedRaw),lane.decimals)),unitUsd=lane.price?.priceUsd||null,usdValue=finite(unitUsd)?amount*Number(unitUsd):null;
        if(!finite(usdValue))diagnostics.unvaluedIntervalCount++;
        const event={
          eventKey:key,company:lane.company,family:'accrued-entitlement',economicDate:eventEconomicDate(close),periodStart:open.observedAt,periodEnd:close.observedAt,
          route:lane.route,protocol:lane.protocol,chain:lane.chain,chainId:lane.chainId,asset:lane.rewardSymbol,token:lane.rewardToken,
          amount:round(amount,12),amountRaw:r.earnedRaw,usdValue:finite(usdValue)?round(usdValue,8):null,valuationUnitUsd:finite(unitUsd)?round(unitUsd,12):null,
          valuationAt:lane.price?.observedAt||close.observedAt,valuationStatus:finite(usdValue)?'frozen-at-closing-accounting-boundary':'unvalued-fail-closed',
          sourceFile:'reporting/ve33-accounting-evidence.json',sourceFamily:'ve(3,3) cumulative entitlement with claim settlement reconciliation',
          sourceIdentity:`${open.checkpointKey}->${close.checkpointKey}`,evidenceStatus:'factual-opening-plus-settlement-to-closing-reconciliation',
          mechanismKind:lane.kind,holder:lane.holder,custodyContext:lane.custodyContext,tokenId:lane.tokenId,rewardContract:lane.rewardContract,distributor:lane.distributor,
          openingEntitlementRaw:open.entitlementRaw,closingEntitlementRaw:close.entitlementRaw,settlementRaw:settlements.amountRaw,
          settlementEventCount:(settlements.events||[]).length,settlementProofs:settlements.events||[],periodAttributionMonth:month,
          referenceAprUsed:false,currentClaimableBalanceIsPeriodIncome:false,claimIsSecondIncomeEvent:false,laterClaimOrPriceMoveDoesNotRewriteIncome:true,
          unknownIsNotZero:true,executionAuthority:'none'
        };
        priorEvents.set(key,event);
        diagnostics.acceptedPositiveIntervalCount++;
      }
    }
  }

  const checkpoints=retainCheckpoints([...existing.values()].filter(x=>x?.checkpointKey));
  const events=[...priorEvents.values()].sort((a,b)=>String(a.periodEnd||'').localeCompare(String(b.periodEnd||''))||a.eventKey.localeCompare(b.eventKey));
  const partial=diagnostics.reconciliationCount||diagnostics.unvaluedIntervalCount||Object.values(diagnostics.protocols).some(x=>x.boundaryFailures.length);
  return{
    version:VERSION,generatedAt,status:partial?'partial':'factual-boundary-tracking',fullAccountingStart:FULL_ACCOUNTING_START,
    semantics:{
      openingBalanceCreatesIncome:false,earnedIndependentOfClaim:true,claimIsSettlementNotSecondIncome:true,
      rebaseDepositIntoVeNftIsSecondIncome:false,referenceAprUsed:false,laterPriceMovementRewritesClosedIncome:false,unknownIsNotZero:true,
      directVotingRewardFormula:'closing earned + proven ClaimRewards - opening earned',
      rebaseFormula:'closing claimable + proven Claimed - opening claimable'
    },
    scope:{
      included:['direct veNFT voting fee/incentive reward lanes','direct veNFT RewardsDistributor rebase lanes','managed FreeManagedReward lanes'],
      deferred:['LockedManagedReward / Relay compounded lane pending exact withdrawal settlement identity','40 Acres payout non-overlap reconciliation with existing Defitea settlement evidence']
    },
    authority,checkpoints,events,diagnostics
  };
}

async function main(){
  const[rewards,previous]=await Promise.all([readJson(DEFAULT_REWARDS),readJson(DEFAULT_OUTPUT,{})]);
  const output=await buildVe33Evidence({rewards,previous});
  await writeJson(DEFAULT_OUTPUT,output);
  console.log('ve(3,3) factual accounting evidence built',{
    status:output.status,checkpoints:output.checkpoints.length,events:output.events.length,lanes:output.diagnostics.laneCount,
    accepted:output.diagnostics.acceptedPositiveIntervalCount,reconciliations:output.diagnostics.reconciliationCount,
    boundaryFailures:Object.values(output.diagnostics.protocols||{}).reduce((sum,x)=>sum+(x.boundaryFailures||[]).length,0),
    executionAuthority:output.authority.executionAuthority
  });
}

if(process.argv[1]&&path.resolve(process.argv[1])===__filename)main().catch(error=>{console.error(error);process.exitCode=1;});
