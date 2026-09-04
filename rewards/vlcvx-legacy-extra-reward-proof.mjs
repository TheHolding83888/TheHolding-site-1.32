import fs from 'node:fs';
import path from 'node:path';
import { Contract, Interface, JsonRpcProvider, formatUnits, getAddress } from 'ethers';

const VERSION='0.1-vlcvx-legacy-extra-reward-proof';
const AUDIT=process.env.VLCVX_AUDIT_OUTPUT||'/tmp/vlcvx-route-audit.json';
const OUTPUT=process.env.VLCVX_LEGACY_EXTRA_REWARD_OUTPUT||'/tmp/vlcvx-legacy-extra-reward-proof.json';
const RPCS=[...new Set([
  process.env.ETH_RPC_URL,
  'https://ethereum-rpc.publicnode.com',
  'https://eth.llamarpc.com',
  'https://eth.drpc.org',
  'https://rpc.flashbots.net',
  'https://1rpc.io/eth'
].filter(Boolean))];

const DISTRIBUTION=getAddress('0xDecc7d761496d30F30b92Bdf764fb8803c79360D');
const OLD_LOCKER=getAddress('0xD18140b4B819b895A3dba5442F959fA44994AF50');
const KNOWN_CREATION_TX='0xa3964b0efbd26ae8d2c15d126ecdda1d0bb3460086b5bc7b3501e8af2eeeef01';
// Contract creation was 2021-10-08. This boundary intentionally starts well before deployment.
const EVENT_SCAN_FROM_BLOCK=13_300_000;
const BLOCKSCOUT_LOGS='https://eth.blockscout.com/api';
const ABI=[
  'function cvxlocker() view returns (address)',
  'function rewardEpochsCount(address _token) view returns (uint256)',
  'function claimableRewards(address _account,address _token) view returns (uint256)',
  'event RewardAdded(address indexed _token,uint256 indexed _epoch,uint256 _reward)'
];
const ERC20_ABI=['function symbol() view returns (string)','function decimals() view returns (uint8)'];
const iface=new Interface(ABI);
const rewardAddedTopic=iface.getEvent('RewardAdded').topicHash;
const round=(n,d=12)=>Number(Number(n).toFixed(d));

async function provider(){
  let last;
  for(const url of RPCS){
    try{
      const p=new JsonRpcProvider(url,1,{staticNetwork:true});
      await p.getBlockNumber();
      return p;
    }catch(e){last=e;}
  }
  throw last||new Error('Ethereum RPC unavailable');
}

async function tokenMeta(p,address){
  const token=getAddress(address),c=new Contract(token,ERC20_ABI,p);
  const [symbol,decimals]=await Promise.all([c.symbol().catch(()=>token),c.decimals().catch(()=>18)]);
  return{token,symbol:String(symbol),decimals:Number(decimals)};
}

function blockNumberOf(log){
  const v=log.blockNumber??log.block_number;
  if(typeof v==='number')return v;
  if(typeof v==='string')return v.startsWith('0x')?Number.parseInt(v,16):Number.parseInt(v,10);
  return NaN;
}

function rewardTokenOf(log){
  const topic0=String(log?.topics?.[0]||'');
  const tokenTopic=String(log?.topics?.[1]||'');
  if(topic0.toLowerCase()!==rewardAddedTopic.toLowerCase())throw new Error('legacy RewardAdded topic0 drift');
  if(!/^0x[0-9a-fA-F]{64}$/.test(tokenTopic))throw new Error('legacy RewardAdded indexed token topic missing');
  return getAddress(`0x${tokenTopic.slice(-40)}`);
}

async function scanRpc(p,fromBlock,toBlock){
  const logs=[];let cursor=fromBlock,span=250000,calls=0;
  while(cursor<=toBlock){
    if(++calls>300)throw new Error('legacy RewardAdded scan exceeded bounded call budget');
    const end=Math.min(toBlock,cursor+span-1);
    try{
      const rows=await p.getLogs({address:DISTRIBUTION,topics:[rewardAddedTopic],fromBlock:cursor,toBlock:end});
      logs.push(...rows);cursor=end+1;
    }catch(e){
      if(span<=50000)throw new Error(`legacy RewardAdded RPC range unsupported ${cursor}-${end}: ${e?.shortMessage||e?.message||e}`);
      span=Math.max(50000,Math.floor(span/2));
    }
  }
  return logs;
}

async function scanBlockscout(fromBlock,toBlock){
  const logs=[],span=250000;
  for(let cursor=fromBlock;cursor<=toBlock;cursor+=span){
    const end=Math.min(toBlock,cursor+span-1),u=new URL(BLOCKSCOUT_LOGS);
    u.searchParams.set('module','logs');u.searchParams.set('action','getLogs');
    u.searchParams.set('fromBlock',String(cursor));u.searchParams.set('toBlock',String(end));
    u.searchParams.set('address',DISTRIBUTION);u.searchParams.set('topic0',rewardAddedTopic);
    const r=await fetch(u,{headers:{accept:'application/json'},signal:AbortSignal.timeout(20000)});
    if(!r.ok)throw new Error(`Blockscout legacy RewardAdded HTTP ${r.status} ${cursor}-${end}`);
    const body=await r.json();
    if(body?.status==='0'&&/no (records|logs)/i.test(String(body?.message||body?.result||'')))continue;
    if(!Array.isArray(body?.result))throw new Error(`Blockscout legacy RewardAdded malformed ${cursor}-${end}`);
    if(body.result.length>=1000)throw new Error(`Blockscout legacy RewardAdded hit 1000-log cap ${cursor}-${end}`);
    for(const row of body.result){
      const blockNumber=blockNumberOf(row);
      if(!Number.isFinite(blockNumber))throw new Error('Blockscout legacy RewardAdded missing block');
      if(String(row?.topics?.[0]||'').toLowerCase()!==rewardAddedTopic.toLowerCase())continue;
      logs.push({topics:row.topics,data:row.data??null,blockNumber,transactionHash:row.transactionHash||row.transaction_hash||null});
    }
  }
  return logs;
}

async function rewardHistory(toBlock){
  const errors=[];
  for(const url of RPCS){
    try{
      const p=new JsonRpcProvider(url,1,{staticNetwork:true});await p.getBlockNumber();
      const logs=await scanRpc(p,EVENT_SCAN_FROM_BLOCK,toBlock);
      return{logs,transport:'ethereum-json-rpc',scanComplete:true,fromBlock:EVENT_SCAN_FROM_BLOCK,toBlock};
    }catch(e){errors.push(`rpc:${e?.shortMessage||e?.message||e}`);}
  }
  try{
    const logs=await scanBlockscout(EVENT_SCAN_FROM_BLOCK,toBlock);
    return{logs,transport:'blockscout-indexed-logs',scanComplete:true,fromBlock:EVENT_SCAN_FROM_BLOCK,toBlock};
  }catch(e){errors.push(`blockscout:${e?.message||e}`);}
  throw new Error(`legacy RewardAdded history unavailable: ${errors.join(' | ')}`);
}

function registryWallets(audit){
  const out=[];
  for(const company of audit?.companies||[]){
    for(const wallet of company?.wallets||[]){
      if(!wallet?.address)continue;
      out.push({registry:company.registry,name:company.name,wallet:getAddress(wallet.address),walletAlias:wallet.alias||null,currentVlCvx:Boolean(wallet.hasVlCvx),currentRoute:wallet.route?.routeId||null});
    }
  }
  return[...new Map(out.map(x=>[x.wallet.toLowerCase(),x])).values()];
}

export async function collectVlCvxLegacyExtraRewardProof({auditFile=AUDIT}={}){
  const audit=JSON.parse(fs.readFileSync(auditFile,'utf8'));
  if(audit?.version!=='0.2-vlcvx-full-registry-route-audit')throw new Error('vlCVX route audit version drift');
  const p=await provider();
  const [latestBlock,code]=await Promise.all([p.getBlockNumber(),p.getCode(DISTRIBUTION)]);
  if(!code||code==='0x')throw new Error('legacy vlCVX extra reward distribution has no bytecode');
  if(latestBlock<=EVENT_SCAN_FROM_BLOCK)throw new Error('legacy scan boundary invalid');
  const dist=new Contract(DISTRIBUTION,ABI,p);
  const locker=getAddress(await dist.cvxlocker());
  if(locker.toLowerCase()!==OLD_LOCKER.toLowerCase())throw new Error(`legacy distribution locker drift ${locker}`);

  const history=await rewardHistory(latestBlock);
  if(history.scanComplete!==true||history.fromBlock!==EVENT_SCAN_FROM_BLOCK||history.toBlock!==latestBlock)throw new Error('legacy RewardAdded history incomplete');
  // Token is indexed in RewardAdded. Derive inventory from topic[1] so indexed-log
  // transports that omit the non-indexed data payload cannot create a false RED.
  const parsed=history.logs.map(log=>({log,token:rewardTokenOf(log)}));
  const tokenAddresses=[...new Set(parsed.map(x=>x.token.toLowerCase()))].map(getAddress);
  const tokens=[];
  for(const address of tokenAddresses){
    const meta=await tokenMeta(p,address),epochCount=Number(await dist.rewardEpochsCount(meta.token));
    if(!Number.isSafeInteger(epochCount)||epochCount<=0)throw new Error(`legacy reward epoch count invalid ${meta.token}`);
    const eventCount=parsed.filter(x=>x.token.toLowerCase()===meta.token.toLowerCase()).length;
    tokens.push({...meta,rewardEpochCount:epochCount,rewardAddedEventCount:eventCount});
  }

  const wallets=registryWallets(audit),rows=[];
  for(const w of wallets){
    const rewards=[];
    for(const token of tokens){
      const raw=BigInt(await dist.claimableRewards(w.wallet,token.token));
      rewards.push({...token,amountRaw:raw.toString(),amount:round(formatUnits(raw,token.decimals)),observedZero:raw===0n});
    }
    rows.push({...w,rewards,positiveClaimableRewardCount:rewards.filter(x=>BigInt(x.amountRaw)>0n).length,evidenceClass:'observed-current-legacy-residual-state',periodIncomeAuthority:false,currentDelegateSettlementAuthority:false,unknownIsNotZero:true});
  }

  const positive=rows.filter(x=>x.positiveClaimableRewardCount>0);
  return{
    version:VERSION,generatedAt:new Date().toISOString(),executionAuthority:'none',claimTransactionAuthority:'none',
    source:{officialConvexContractsRegistry:'convex-eth/platform contracts/contracts.json',knownCreationTransaction:KNOWN_CREATION_TX,rewardInventoryMethod:'complete RewardAdded indexed-token history from conservative pre-deployment boundary',rewardInventoryTransport:history.transport,rewardInventoryScanComplete:true,rewardInventoryScanFromBlock:history.fromBlock,rewardInventoryScanThroughBlock:history.toBlock},
    contract:{name:'vlCvxExtraRewardDistribution OLD',address:DISTRIBUTION,locker,expectedOldLocker:OLD_LOCKER,observedThroughBlock:latestBlock},
    semantics:{legacyResidualOnly:true,currentStateIsNotPeriodIncome:true,currentGaugeDelegateSettlementIsSeparate:true,positiveLegacyClaimableDoesNotProveCurrentDelegateIncentive:true,zeroClaimableIsObservedZeroForEnumeratedLegacyTokensOnly:true,unknownIsNotZero:true},
    summary:{registryCompanyCount:new Set(rows.map(x=>x.registry)).size,registryWalletCount:rows.length,currentVlCvxWalletCount:rows.filter(x=>x.currentVlCvx).length,rewardTokenCount:tokens.length,rewardAddedEventCount:history.logs.length,positiveClaimableWalletCount:positive.length,positiveCurrentVlCvxWalletCount:positive.filter(x=>x.currentVlCvx).length},
    tokens,positiveWallets:positive.map(x=>({registry:x.registry,name:x.name,wallet:x.wallet,currentVlCvx:x.currentVlCvx,currentRoute:x.currentRoute,rewards:x.rewards.filter(r=>!r.observedZero)})),wallets:rows
  };
}

async function main(){
  const out=await collectVlCvxLegacyExtraRewardProof();
  fs.writeFileSync(path.resolve(OUTPUT),JSON.stringify(out,null,2)+'\n');
  console.log('vlCVX LEGACY EXTRA REWARD PROOF PASS',JSON.stringify({contract:out.contract,summary:out.summary,tokens:out.tokens.map(t=>({symbol:t.symbol,token:t.token,epochs:t.rewardEpochCount,events:t.rewardAddedEventCount})),positiveWallets:out.positiveWallets.map(x=>({registry:x.registry,name:x.name,currentVlCvx:x.currentVlCvx,currentRoute:x.currentRoute,rewards:x.rewards.map(r=>({symbol:r.symbol,amount:r.amount}))}))},null,2));
}

if(import.meta.url===`file://${process.argv[1]}`)main().catch(e=>{console.error(e);process.exitCode=1});
