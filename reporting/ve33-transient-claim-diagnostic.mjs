#!/usr/bin/env node
import fs from 'node:fs/promises';
import { Contract, Interface, JsonRpcProvider, getAddress, formatUnits } from 'ethers';
import { PROTOCOLS, decodeRewardClaimAttribution } from './ve33-accounting-evidence.mjs';

const EVIDENCE_FILE=process.env.VE33_DIAGNOSTIC_EVIDENCE_FILE||'./reporting/ve33-accounting-evidence.json';
const REWARDS_FILE=process.env.REWARDS_DATA_FILE||'./companies/rewards-data.json';
const REQUESTED_PROTOCOLS=new Set(String(process.env.VE33_TRANSIENT_PROTOCOLS||'aerodrome').split(',').map(x=>x.trim()).filter(Boolean));
const TX_HASHES=String(process.env.VE33_TRANSIENT_TX_HASHES||'').split(',').map(x=>x.trim()).filter(Boolean);
const CLAIM_IFACE=new Interface(['event ClaimRewards(address indexed from,address indexed reward,uint256 amount)']);
const CLAIM_TOPIC=CLAIM_IFACE.getEvent('ClaimRewards').topicHash.toLowerCase();
const ERC20_ABI=['function symbol() view returns (string)','function decimals() view returns (uint8)'];
const lower=value=>String(value||'').toLowerCase();
const isAddress=value=>/^0x[0-9a-f]{40}$/i.test(String(value||''));
const isTxHash=value=>/^0x[0-9a-f]{64}$/i.test(String(value||''));
const unique=values=>[...new Set((values||[]).filter(Boolean))];

if(!TX_HASHES.length)throw new Error('VE33_TRANSIENT_TX_HASHES is required for exact-tx transient claim diagnostic');
if(TX_HASHES.some(x=>!isTxHash(x)))throw new Error('VE33_TRANSIENT_TX_HASHES contains an invalid transaction hash');

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
function knownContractsForPosition(cfg,position){
  const out=[];
  const idx=rewards?.internalState?.directVeRewardIndex?.[`${cfg.providerKey}:${position.tokenId}`];
  for(const row of idx?.contracts||[])if(isAddress(row?.rewardAddress))out.push(lower(row.rewardAddress));
  for(const cp of evidence.checkpoints||[]){
    if(cp?.protocolKey!==position.protocolKey||cp?.company!==position.company||String(cp?.tokenId||'')!==position.tokenId)continue;
    if(lower(cp?.holder)!==lower(position.holder)||cp?.kind==='rebase-distributor')continue;
    if(isAddress(cp?.rewardContract))out.push(lower(cp.rewardContract));
  }
  return new Set(unique(out));
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
async function providerFor(cfg){
  const urls=unique([process.env[cfg.rpcEnv],...cfg.rpcFallbacks]);
  for(const url of urls){
    try{
      const provider=new JsonRpcProvider(url,cfg.chainId,{staticNetwork:true});
      await Promise.race([provider.getBlockNumber(),new Promise((_,reject)=>setTimeout(()=>reject(new Error('RPC timeout')),8_000))]);
      return {provider,host:(()=>{try{return new URL(url).hostname;}catch{return'configured-rpc';}})()};
    }catch{}
  }
  throw new Error(`No ${cfg.protocol} RPC available for transient claim diagnostic`);
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
const selectedProtocols=Object.entries(PROTOCOLS).filter(([protocolKey])=>REQUESTED_PROTOCOLS.has(protocolKey));
if(!selectedProtocols.length)throw new Error(`No matching ve33 protocol for VE33_TRANSIENT_PROTOCOLS=${[...REQUESTED_PROTOCOLS].join(',')}`);

for(const [protocolKey,cfg] of selectedProtocols){
  const positions=directPositions(protocolKey);
  const positionsByHolder=new Map();
  for(const position of positions){
    position.knownRewardContracts=knownContractsForPosition(cfg,position);
    const key=lower(position.holder),rows=positionsByHolder.get(key)||[];
    rows.push(position);positionsByHolder.set(key,rows);
  }
  const {provider,host}=await providerFor(cfg);
  const metaCache=new Map();
  let receiptCount=0,claimLogCount=0,provenClaimCount=0;

  for(const txHash of TX_HASHES){
    const [tx,receipt]=await Promise.all([provider.getTransaction(txHash),provider.getTransactionReceipt(txHash)]);
    if(!tx||!receipt)continue;
    receiptCount++;
    for(const log of receipt.logs||[]){
      if(lower(log?.topics?.[0])!==CLAIM_TOPIC)continue;
      let parsed;
      try{parsed=CLAIM_IFACE.parseLog({topics:log.topics,data:log.data});}catch{continue;}
      if(!parsed)continue;
      claimLogCount++;
      const recipient=String(parsed.args?.[0]||''),rewardToken=String(parsed.args?.[1]||''),amountRaw=BigInt(parsed.args?.[2]||0);
      if(!isAddress(recipient)||!isAddress(rewardToken)||amountRaw<=0n)continue;
      const possible=positionsByHolder.get(lower(recipient))||[];
      for(const position of possible){
        const rewardContract=getAddress(log.address);
        const attribution=decodeRewardClaimAttribution({
          to:tx.to,data:tx.data,rewardContract,rewardToken:getAddress(rewardToken),
          voter:cfg.voter,holder:position.holder
        });
        if(String(attribution.tokenId||'')!==position.tokenId)continue;
        provenClaimCount++;
        const meta=await tokenMeta(provider,getAddress(rewardToken),metaCache);
        const id=proofId(txHash,log.index??0);
        const lane=laneIdentity({...position,rewardContract,rewardToken:getAddress(rewardToken)});
        const knownHistoricalLane=knownLanes.has(lane);
        const alreadyRepresented=represented.has(id);
        const rewardContractKnown=position.knownRewardContracts.has(lower(rewardContract));
        const classification=alreadyRepresented
          ?'already-represented'
          :(knownHistoricalLane?'known-lane-pending-or-unsettled':'transient-orphan-claim');
        results.push({
          classification,protocolKey,protocol:cfg.protocol,chain:cfg.chain,company:position.company,
          holder:position.holder,tokenId:position.tokenId,rewardContract,rewardContractKnown,
          rewardToken:getAddress(rewardToken),rewardSymbol:meta.symbol,decimals:meta.decimals,
          amountRaw:amountRaw.toString(),amount:Number(formatUnits(amountRaw,meta.decimals)),
          blockNumber:Number(log.blockNumber),transactionHash:String(txHash),logIndex:Number(log.index??0),
          decodePath:attribution.path,knownHistoricalLane,alreadyRepresented,executionAuthority:'none'
        });
        break;
      }
    }
  }
  protocolStats[protocolKey]={positionCount:positions.length,requestedTransactionCount:TX_HASHES.length,receiptCount,claimLogCount,provenClaimCount,rpcHost:host};
}

const deduped=[...new Map(results.map(row=>[`${row.protocolKey}|${row.company}|${row.tokenId}|${proofId(row.transactionHash,row.logIndex)}`,row])).values()]
  .sort((a,b)=>a.blockNumber-b.blockNumber||a.logIndex-b.logIndex);
const classes=['already-represented','known-lane-pending-or-unsettled','transient-orphan-claim'];
const byClass=Object.fromEntries(classes.map(key=>[key,deduped.filter(x=>x.classification===key).length]));
const output={
  version:'0.2-ve33-transient-claim-diagnostic',requestedProtocols:[...REQUESTED_PROTOCOLS],transactionHashes:TX_HASHES,
  semantics:{diagnosticOnly:true,createsIncome:false,mutatesCanonicalEvidence:false,claimIsSettlementNotSecondIncome:true,unknownIsNotZero:true,executionAuthority:'none'},
  protocolStats,summary:{provenClaimCount:deduped.length,...byClass},claims:deduped
};
console.log('ve33 transient ClaimRewards diagnostic JSON',JSON.stringify(output,null,2));
if(!deduped.length)throw new Error('No provable tracked ve33 ClaimRewards events found in requested transaction fixture(s)');
