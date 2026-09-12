#!/usr/bin/env node
import { Interface, getAddress } from 'ethers';
import { DIRECT_ACCOUNTING_START, PROTOCOLS, decodeRewardClaimAttribution, trackedPositionDescriptors } from './ve33-accounting-evidence.mjs';

export const VERSION='0.1-ve33-transient-claim-recovery';
export const DEFAULT_SCAN_CHUNK_BLOCKS=9_500;
export const DEFAULT_SCAN_OVERLAP_BLOCKS=4_096;
export const RECOVERY_SEMANTICS=Object.freeze({
  discoveryOnly:true,
  createsIncome:false,
  createsRealisedCashFlow:false,
  currentClaimableBalanceIsPeriodIncome:false,
  claimIsSettlementNotSecondIncome:true,
  unknownIsNotZero:true,
  executionAuthority:'none',
  capitalExecution:false
});

const CLAIM_IFACE=new Interface(['event ClaimRewards(address indexed from,address indexed reward,uint256 amount)']);
export const CLAIM_REWARDS_TOPIC=CLAIM_IFACE.getEvent('ClaimRewards').topicHash;
const lower=value=>String(value||'').toLowerCase();
const isAddress=value=>/^0x[0-9a-f]{40}$/i.test(String(value||''));
const unique=values=>[...new Set((values||[]).filter(Boolean))];

export function indexedAddressTopic(address){
  if(!isAddress(address))throw new Error(`Invalid indexed address: ${address}`);
  return `0x${String(address).slice(2).toLowerCase().padStart(64,'0')}`;
}

export function claimProofKey({transactionHash,logIndex}){
  return `${lower(transactionHash)}:${Number(logIndex??0)}`;
}

export function recoveryLaneKey({protocolKey,company,holder,tokenId,rewardContract,rewardToken}){
  return [protocolKey,company,lower(holder),String(tokenId),lower(rewardContract),lower(rewardToken)].join('|');
}

export function recoveryScanStart({accountingStartBlock,lastScannedBlock=null,overlapBlocks=DEFAULT_SCAN_OVERLAP_BLOCKS}){
  const start=Math.max(0,Number(accountingStartBlock)||0);
  const last=Number(lastScannedBlock);
  if(!Number.isFinite(last)||last<=0)return start;
  return Math.max(start,last-Math.max(0,Number(overlapBlocks)||0));
}

export function directTrackedPositions(rewards,protocolKey){
  return trackedPositionDescriptors(rewards)
    .filter(x=>x.protocolKey===protocolKey&&x.mode==='direct'&&isAddress(x.holder))
    .map(x=>({
      protocolKey:x.protocolKey,protocol:x.protocol,company:x.company,route:x.route,
      holder:getAddress(x.holder),tokenId:String(x.tokenId),walletAlias:x.walletAlias||null,
      custodyContext:x.custodyContext||'direct-wallet'
    }));
}

export function knownCanonicalSettlementProofs(previous={}){
  const out=new Set();
  for(const event of previous?.events||[])for(const proof of event?.settlementProofs||[]){
    if(proof?.transactionHash)out.add(claimProofKey(proof));
  }
  return out;
}

export function knownCanonicalRecoveryLanes(previous={}){
  const out=new Set();
  for(const cp of previous?.checkpoints||[]){
    if(cp?.kind==='rebase-distributor'||!isAddress(cp?.rewardContract)||!isAddress(cp?.rewardToken))continue;
    if(!cp?.protocolKey||!cp?.company||!isAddress(cp?.holder)||!cp?.tokenId)continue;
    out.add(recoveryLaneKey(cp));
  }
  return out;
}

export function mergeRecoveryClaims(priorClaims=[],freshClaims=[]){
  const map=new Map();
  for(const row of [...(priorClaims||[]),...(freshClaims||[])]){
    if(!row?.transactionHash)continue;
    const key=claimProofKey(row);
    const prior=map.get(key);
    if(!prior||Number(row.blockNumber||0)>=Number(prior.blockNumber||0))map.set(key,row);
  }
  return [...map.values()].sort((a,b)=>Number(a.blockNumber||0)-Number(b.blockNumber||0)||Number(a.logIndex||0)-Number(b.logIndex||0));
}

export function addRecoveryShadowRows(rewards,claims=[]){
  const enriched=structuredClone(rewards||{});
  enriched.companies=enriched.companies||{};
  let inserted=0;
  const seen=new Set();
  for(const [company,c] of Object.entries(enriched.companies||{})){
    for(const r of c?.rewards||[]){
      if(r?.route&&r?.token&&r?.details?.tokenId&&r?.details?.rewardContract){
        seen.add([company,r.route,String(r.details.tokenId),lower(r.details.rewardContract),lower(r.token)].join('|'));
      }
    }
  }
  for(const claim of claims||[]){
    if(!claim?.company||!claim?.route||!claim?.tokenId||!isAddress(claim?.rewardContract)||!isAddress(claim?.rewardToken))continue;
    const company=enriched.companies[claim.company];
    if(!company)continue;
    const key=[claim.company,claim.route,String(claim.tokenId),lower(claim.rewardContract),lower(claim.rewardToken)].join('|');
    if(seen.has(key))continue;
    company.rewards=Array.isArray(company.rewards)?company.rewards:[];
    company.rewards.push({
      route:claim.route,
      token:getAddress(claim.rewardToken),
      symbol:claim.rewardSymbol||null,
      amount:null,
      usdValue:null,
      status:'historical-claim-recovery-shadow',
      accountingAuthority:false,
      periodIncomeAuthority:false,
      realisedCashFlowAuthority:false,
      unknownIsNotZero:true,
      executionAuthority:'none',
      details:{
        tokenId:String(claim.tokenId),
        rewardContract:getAddress(claim.rewardContract),
        historicalClaimRecovery:true,
        sourceProof:claimProofKey(claim)
      }
    });
    seen.add(key);inserted++;
  }
  return{rewards:enriched,inserted};
}

function parseClaimLog(log){
  try{
    const parsed=CLAIM_IFACE.parseLog({topics:log.topics,data:log.data});
    if(!parsed)return null;
    const recipient=String(parsed.args?.[0]||''),rewardToken=String(parsed.args?.[1]||''),amountRaw=BigInt(parsed.args?.[2]||0);
    if(!isAddress(recipient)||!isAddress(rewardToken)||amountRaw<=0n||!isAddress(log?.address))return null;
    return{
      recipient:getAddress(recipient),rewardToken:getAddress(rewardToken),rewardContract:getAddress(log.address),
      amountRaw:amountRaw.toString(),blockNumber:Number(log.blockNumber),transactionHash:String(log.transactionHash||''),logIndex:Number(log.index??0)
    };
  }catch{return null;}
}

export async function discoverProtocolTransientClaims({
  rewards,previous={},recoveryState={},protocolKey,provider,accountingStartBlock,latestBlockNumber,
  scanChunkBlocks=DEFAULT_SCAN_CHUNK_BLOCKS,scanOverlapBlocks=DEFAULT_SCAN_OVERLAP_BLOCKS
}={}){
  const cfg=PROTOCOLS[protocolKey];
  if(!cfg)throw new Error(`Unknown ve33 protocol: ${protocolKey}`);
  if(!provider)throw new Error(`Provider required for ${protocolKey} transient-claim discovery`);
  const positions=directTrackedPositions(rewards,protocolKey);
  if(!positions.length){
    return{status:'no-direct-positions',claims:[],scan:{fromBlock:null,toBlock:null,lastScannedBlock:null,complete:true},semantics:RECOVERY_SEMANTICS};
  }
  const byHolder=new Map();
  for(const p of positions){const key=lower(p.holder),rows=byHolder.get(key)||[];rows.push(p);byHolder.set(key,rows);}
  const holderTopics=unique(positions.map(x=>indexedAddressTopic(x.holder)));
  const latest=Number(latestBlockNumber??await provider.getBlockNumber());
  const priorProtocol=recoveryState?.protocols?.[protocolKey]||{};
  const fromBlock=recoveryScanStart({accountingStartBlock,lastScannedBlock:priorProtocol.lastScannedBlock,overlapBlocks:scanOverlapBlocks});
  const knownProofs=knownCanonicalSettlementProofs(previous);
  const knownLanes=knownCanonicalRecoveryLanes(previous);
  const fresh=[];
  const unresolved=[];
  let queriedRanges=0;

  for(let from=fromBlock;from<=latest;from+=Math.max(1,Number(scanChunkBlocks)||DEFAULT_SCAN_CHUNK_BLOCKS)){
    const to=Math.min(latest,from+Math.max(1,Number(scanChunkBlocks)||DEFAULT_SCAN_CHUNK_BLOCKS)-1);
    queriedRanges++;
    const logs=await provider.getLogs({topics:[CLAIM_REWARDS_TOPIC,holderTopics],fromBlock:from,toBlock:to});
    for(const log of logs||[]){
      const parsed=parseClaimLog(log);if(!parsed)continue;
      const candidates=byHolder.get(lower(parsed.recipient))||[];
      if(!candidates.length)continue;
      const tx=await provider.getTransaction(parsed.transactionHash);
      if(!tx){unresolved.push({...parsed,reason:'transaction-unavailable'});continue;}
      const matched=[];
      for(const position of candidates){
        const attribution=decodeRewardClaimAttribution({
          to:tx.to,data:tx.data,rewardContract:parsed.rewardContract,rewardToken:parsed.rewardToken,
          voter:cfg.voter,holder:position.holder
        });
        if(String(attribution.tokenId||'')!==position.tokenId)continue;
        matched.push({position,attribution});
      }
      if(matched.length!==1){
        unresolved.push({...parsed,reason:matched.length?'ambiguous-token-attribution':'token-id-unresolved',candidateMatches:matched.length});
        continue;
      }
      const {position,attribution}=matched[0];
      const lane=recoveryLaneKey({...position,rewardContract:parsed.rewardContract,rewardToken:parsed.rewardToken});
      const proof=claimProofKey(parsed);
      fresh.push({
        ...parsed,protocolKey,protocol:cfg.protocol,chain:cfg.chain,chainId:cfg.chainId,
        company:position.company,route:position.route,holder:position.holder,tokenId:position.tokenId,
        custodyContext:position.custodyContext,decodePath:attribution.path,laneKey:lane,
        classification:knownProofs.has(proof)?'already-represented':(knownLanes.has(lane)?'known-lane-pending-or-unsettled':'transient-orphan-claim'),
        alreadyRepresented:knownProofs.has(proof),knownHistoricalLane:knownLanes.has(lane),
        accountingAuthority:false,periodIncomeAuthority:false,executionAuthority:'none'
      });
    }
  }

  const claims=mergeRecoveryClaims(priorProtocol.claims||[],fresh);
  return{
    status:unresolved.length?'partial':'complete',claims,unresolved,
    scan:{fromBlock,toBlock:latest,lastScannedBlock:latest,queriedRanges,holderCount:holderTopics.length,positionCount:positions.length,complete:unresolved.length===0,overlapBlocks:scanOverlapBlocks},
    semantics:RECOVERY_SEMANTICS
  };
}

export function buildRecoveryState({previousState={},protocolResults={},generatedAt=new Date().toISOString()}={}){
  const protocols={...(previousState?.protocols||{})};
  for(const [protocolKey,result] of Object.entries(protocolResults||{})){
    protocols[protocolKey]={
      status:result.status,
      lastScannedBlock:result.scan?.lastScannedBlock??protocols[protocolKey]?.lastScannedBlock??null,
      claims:mergeRecoveryClaims(protocols[protocolKey]?.claims||[],result.claims||[]),
      unresolved:result.unresolved||[],
      scan:result.scan||null
    };
  }
  const incomplete=Object.values(protocols).some(x=>x?.status==='partial'||x?.scan?.complete===false||(x?.unresolved||[]).length>0);
  return{
    version:VERSION,generatedAt,status:incomplete?'partial':'discovery-complete',accountingStart:DIRECT_ACCOUNTING_START,
    semantics:RECOVERY_SEMANTICS,protocols,
    authority:{executionAuthority:'none',walletAuthority:'none',claimingAuthority:'none',capitalExecution:false,methodologyMutationAuthority:'none'}
  };
}
