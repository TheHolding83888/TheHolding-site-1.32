#!/usr/bin/env node
import fs from 'node:fs/promises';
import { Contract, Interface, JsonRpcProvider, getAddress, formatUnits } from 'ethers';
import { PROTOCOLS, blockAtOrBefore, decodeRewardClaimAttribution } from './ve33-accounting-evidence.mjs';

const EVIDENCE_FILE=process.env.VE33_DIAGNOSTIC_EVIDENCE_FILE||'./reporting/ve33-accounting-evidence.json';
const REWARDS_FILE=process.env.REWARDS_DATA_FILE||'./companies/rewards-data.json';
const LOOKBACK_DAYS=Math.max(1,Math.min(31,Number(process.env.VE33_TRANSIENT_LOOKBACK_DAYS||7)));
const MAX_LOG_BLOCKS=7_500;
const ADDRESS_GROUP_SIZE=48;
const REQUEST_SPACING_MS=100;
const CLAIM_IFACE=new Interface(['event ClaimRewards(address indexed from,address indexed reward,uint256 amount)']);
const CLAIM_TOPIC=CLAIM_IFACE.getEvent('ClaimRewards').topicHash;
const ERC20_ABI=['function symbol() view returns (string)','function decimals() view returns (uint8)'];
const lower=value=>String(value||'').toLowerCase();
const isAddress=value=>/^0x[0-9a-f]{40}$/i.test(String(value||''));
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const unique=values=>[...new Set((values||[]).filter(Boolean))];

const [evidence,rewards]=await Promise.all([
  fs.readFile(EVIDENCE_FILE,'utf8').then(JSON.parse),
  fs.readFile(REWARDS_FILE,'utf8').then(JSON.parse)
]);

function proofId(txHash,logIndex){return `${lower(txHash)}:${Number(logIndex)}`;}
function laneIdentity({protocolKey,company,holder,tokenId,rewardContract,rewardToken}){
  return [protocolKey,company,lower(holder),String(tokenId),lower(rewardContract),lower(rewardToken)].join('|');
}

function directPositions(protocolKey){
  const byKey=new Map();
  for(const row of evidence.checkpoints||[]){
    if(row?.protocolKey!==protocolKey||row?.kind!=='rebase-distributor'||row?.custodyContext!=='direct-wallet')continue;
    if(!isAddress(row?.holder)||!row?.tokenId||!row?.company)continue;
    const position={protocolKey,company:row.company,holder:getAddress(row.holder),tokenId:String(row.tokenId)};
    byKey.set([position.company,lower(position.holder),position.tokenId].join('|'),position);
  }
  return [...byKey.values()];
}

function rewardContractsForPosition(cfg,position){
  const out=[];
  const idx=rewards?.internalState?.directVeRewardIndex?.[`${cfg.providerKey}:${position.tokenId}`];
  for(const row of idx?.contracts||[])if(isAddress(row?.rewardAddress))out.push(getAddress(row.rewardAddress));
  for(const cp of evidence.checkpoints||[]){
    if(cp?.protocolKey!==position.protocolKey||cp?.company!==position.company||String(cp?.tokenId||'')!==position.tokenId)continue;
    if(lower(cp?.holder)!==lower(position.holder)||cp?.kind==='rebase-distributor')continue;
    if(isAddress(cp?.rewardContract))out.push(getAddress(cp.rewardContract));
  }
  return unique(out.map(lower)).map(getAddress);
}

function contractPositionIndex(protocolKey,cfg){
  const index=new Map();
  const positions=directPositions(protocolKey);
  for(const position of positions){
    for(const rewardContract of rewardContractsForPosition(cfg,position)){
      const key=lower(rewardContract),rows=index.get(key)||[];
      rows.push({...position,rewardContract});
      index.set(key,rows);
    }
  }
  return {positions,index};
}

function knownLaneSet(){
  const out=new Set();
  for(const cp of evidence.checkpoints||[]){
    if(cp?.kind==='rebase-distributor'||!isAddress(cp?.rewardContract)||!isAddress(cp?.rewardToken))continue;
    out.add(laneIdentity(cp));
  }
  return out;
}

function representedSettlementProofs(){
  const out=new Set();
  for(const event of evidence.events||[])for(const proof of event?.settlementProofs||[]){
    if(proof?.transactionHash)out.add(proofId(proof.transactionHash,proof.logIndex??0));
  }
  return out;
}

async function providerCandidates(cfg){
  const urls=unique([process.env[cfg.rpcEnv],...cfg.rpcFallbacks]);
  const rows=[];
  for(const url of urls){
    try{
      const provider=new JsonRpcProvider(url,cfg.chainId,{staticNetwork:true});
      await Promise.race([provider.getBlockNumber(),new Promise((_,reject)=>setTimeout(()=>reject(new Error('RPC timeout')),8_000))]);
      rows.push({url,provider});
    }catch{}
  }
  if(!rows.length)throw new Error(`No ${cfg.protocol} RPC available for transient claim diagnostic`);
  return rows;
}

async function queryLogsWithFailover(candidates,filter){
  let last=null;
  for(const candidate of candidates){
    try{return await candidate.provider.getLogs(filter);}
    catch(error){last=error;}
  }
  throw last||new Error('ClaimRewards query failed on every RPC candidate');
}

async function tokenMeta(provider,token,cache){
  const key=lower(token);
  if(!cache.has(key))cache.set(key,(async()=>{
    const contract=new Contract(token,ERC20_ABI,provider);
    let symbol='TOKEN',decimals=18;
    try{symbol=String(await contract.symbol());}catch{}
    try{decimals=Number(await contract.decimals());}catch{}
    return{symbol,decimals};
  })());
  return cache.get(key);
}

const represented=representedSettlementProofs();
const knownLanes=knownLaneSet();
const results=[];
const protocolStats={};

for(const [protocolKey,cfg] of Object.entries(PROTOCOLS)){
  const {positions,index}=contractPositionIndex(protocolKey,cfg);
  if(!positions.length||!index.size){
    protocolStats[protocolKey]={positionCount:positions.length,rewardContractCount:index.size,queryCount:0,claimLogCount:0,provenClaimCount:0};
    continue;
  }

  const candidates=await providerCandidates(cfg);
  const provider=candidates[0].provider;
  const latestBlock=await provider.getBlockNumber();
  const sinceAt=new Date(Date.now()-LOOKBACK_DAYS*24*60*60*1000).toISOString();
  const since=await blockAtOrBefore(provider,sinceAt,latestBlock,new Map());
  const addresses=[...index.keys()].sort().map(getAddress);
  const groups=[];
  for(let i=0;i<addresses.length;i+=ADDRESS_GROUP_SIZE)groups.push(addresses.slice(i,i+ADDRESS_GROUP_SIZE));
  const txCache=new Map(),metaCache=new Map();
  let queryCount=0,claimLogCount=0,provenClaimCount=0;

  for(const group of groups){
    for(let from=Number(since.blockNumber);from<=latestBlock;from+=MAX_LOG_BLOCKS){
      const to=Math.min(latestBlock,from+MAX_LOG_BLOCKS-1);
      await wait(REQUEST_SPACING_MS);
      const logs=await queryLogsWithFailover(candidates,{address:group.length===1?group[0]:group,topics:[CLAIM_TOPIC],fromBlock:from,toBlock:to});
      queryCount++;
      claimLogCount+=logs.length;
      for(const log of logs){
        let parsed;
        try{parsed=CLAIM_IFACE.parseLog({topics:log.topics,data:log.data});}catch{continue;}
        if(!parsed)continue;
        const recipient=String(parsed.args?.[0]||''),rewardToken=String(parsed.args?.[1]||''),amountRaw=BigInt(parsed.args?.[2]||0);
        if(!isAddress(recipient)||!isAddress(rewardToken)||amountRaw<=0n)continue;
        const possible=(index.get(lower(log.address))||[]).filter(x=>lower(x.holder)===lower(recipient));
        if(!possible.length)continue;
        if(!txCache.has(log.transactionHash))txCache.set(log.transactionHash,provider.getTransaction(log.transactionHash));
        const tx=await txCache.get(log.transactionHash);
        if(!tx)continue;

        for(const position of possible){
          const attribution=decodeRewardClaimAttribution({
            to:tx.to,data:tx.data,rewardContract:getAddress(log.address),rewardToken:getAddress(rewardToken),
            voter:cfg.voter,holder:position.holder
          });
          if(String(attribution.tokenId||'')!==position.tokenId)continue;
          provenClaimCount++;
          const meta=await tokenMeta(provider,getAddress(rewardToken),metaCache);
          const id=proofId(log.transactionHash,log.index??0);
          const lane=laneIdentity({...position,rewardContract:getAddress(log.address),rewardToken:getAddress(rewardToken)});
          const classification=represented.has(id)
            ?'already-represented'
            :(knownLanes.has(lane)?'known-lane-pending-or-unsettled':'transient-orphan-claim');
          results.push({
            classification,protocolKey,protocol:cfg.protocol,chain:cfg.chain,company:position.company,
            holder:position.holder,tokenId:position.tokenId,rewardContract:getAddress(log.address),
            rewardToken:getAddress(rewardToken),rewardSymbol:meta.symbol,decimals:meta.decimals,
            amountRaw:amountRaw.toString(),amount:Number(formatUnits(amountRaw,meta.decimals)),
            blockNumber:Number(log.blockNumber),transactionHash:String(log.transactionHash),logIndex:Number(log.index??0),
            decodePath:attribution.path,knownHistoricalLane:knownLanes.has(lane),alreadyRepresented:represented.has(id),
            executionAuthority:'none'
          });
          break;
        }
      }
    }
  }

  protocolStats[protocolKey]={
    positionCount:positions.length,rewardContractCount:index.size,addressGroupCount:groups.length,
    fromBlock:Number(since.blockNumber),toBlock:latestBlock,sinceAt:since.blockTimestamp,
    queryCount,claimLogCount,provenClaimCount,
    rpcCandidates:candidates.map(x=>{try{return new URL(x.url).hostname;}catch{return'configured-rpc';}})
  };
}

const deduped=[...new Map(results.map(row=>[`${row.protocolKey}|${row.company}|${row.tokenId}|${proofId(row.transactionHash,row.logIndex)}`,row])).values()]
  .sort((a,b)=>a.blockNumber-b.blockNumber||a.logIndex-b.logIndex);
const byClass=Object.fromEntries(['already-represented','known-lane-pending-or-unsettled','transient-orphan-claim'].map(key=>[key,deduped.filter(x=>x.classification===key).length]));
const orphanClaims=deduped.filter(x=>x.classification==='transient-orphan-claim');
const pendingClaims=deduped.filter(x=>x.classification==='known-lane-pending-or-unsettled');

console.log('ve33 transient ClaimRewards diagnostic JSON',JSON.stringify({
  version:'0.1-ve33-transient-claim-diagnostic',lookbackDays:LOOKBACK_DAYS,
  semantics:{diagnosticOnly:true,createsIncome:false,mutatesCanonicalEvidence:false,unknownIsNotZero:true,executionAuthority:'none'},
  protocolStats,summary:{provenClaimCount:deduped.length,...byClass},
  transientOrphanClaims:orphanClaims,
  knownLanePendingOrUnsettled:pendingClaims
},null,2));
