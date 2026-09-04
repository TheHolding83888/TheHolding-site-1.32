import fs from 'node:fs';
import path from 'node:path';
import { Contract, Interface, JsonRpcProvider, formatUnits, getAddress } from 'ethers';

const VERSION='0.1-vlcvx-extra-reward-distribution-proof';
const AUDIT=process.env.VLCVX_AUDIT_OUTPUT||'/tmp/vlcvx-route-audit.json';
const OUTPUT=process.env.VLCVX_EXTRA_REWARD_OUTPUT||'/tmp/vlcvx-extra-reward-distribution-proof.json';
const RPCS=[...new Set([process.env.ETH_RPC_URL,'https://ethereum-rpc.publicnode.com','https://eth.llamarpc.com'].filter(Boolean))];
const DISTRIBUTION=getAddress('0x9B622f2c40b80EF5efb14c2B2239511FfBFaB702');
const LOCKER=getAddress('0x72a19342e8F1838460eBFCCEf09F6585e32db86E');
const KNOWN_CREATION_TX='0x1591bd14e84575bb9f40681d7f9b9bc52f23699175f1d486f2e8f61241505e36';
// Conservative pre-deployment boundary. The canonical Convex source predates deployment
// and was already present in March 2022; Ethereum block 14,000,000 is January 2022.
// We intentionally do not depend on old transaction receipts because otherwise healthy
// non-archive RPC transports can return null for a historical receipt.
const EVENT_SCAN_FROM_BLOCK=14_000_000;
const DISTRIBUTION_ABI=[
  'function cvxlocker() view returns (address)',
  'function rewardEpochsCount(address _token) view returns (uint256)',
  'function claimableRewards(address _account,address _token) view returns (uint256)',
  'event RewardAdded(address indexed _token,uint256 indexed _epoch,uint256 _reward)'
];
const ERC20_ABI=['function symbol() view returns (string)','function decimals() view returns (uint8)'];
const eventInterface=new Interface(DISTRIBUTION_ABI);
const rewardAddedTopic=eventInterface.getEvent('RewardAdded').topicHash;
const round=(n,d=12)=>Number(Number(n).toFixed(d));

export async function vlCvxExtraRewardProvider(){
  let last;
  for(const url of RPCS){
    try{
      const p=new JsonRpcProvider(url,1,{staticNetwork:true});
      await p.getBlockNumber();
      return p;
    }catch(e){last=e}
  }
  throw last||new Error('Ethereum RPC unavailable');
}

async function tokenMeta(provider,address){
  const token=getAddress(address),c=new Contract(token,ERC20_ABI,provider);
  const [symbol,decimals]=await Promise.all([c.symbol().catch(()=>token),c.decimals().catch(()=>18)]);
  return{token,symbol:String(symbol),decimals:Number(decimals)};
}

async function scanRewardAdded(provider,fromBlock,toBlock){
  const logs=[];
  let cursor=fromBlock;
  let span=100000;
  while(cursor<=toBlock){
    const end=Math.min(toBlock,cursor+span-1);
    try{
      const rows=await provider.getLogs({address:DISTRIBUTION,topics:[rewardAddedTopic],fromBlock:cursor,toBlock:end});
      logs.push(...rows);
      cursor=end+1;
      if(span<250000)span=Math.min(250000,span*2);
    }catch(e){
      if(span<=1000)throw new Error(`RewardAdded log scan failed at ${cursor}-${end}: ${e?.shortMessage||e?.message||e}`);
      span=Math.max(1000,Math.floor(span/2));
    }
  }
  return logs;
}

export async function buildVlCvxExtraRewardDistributionProof({audit,provider}){
  if(audit?.version!=='0.2-vlcvx-full-registry-route-audit')throw new Error('vlCVX route audit version drift');
  if(String(audit?.contracts?.vlCVX||'').toLowerCase()!==LOCKER.toLowerCase())throw new Error('route audit locker != extra reward locker');
  const live=(audit.companies||[]).filter(x=>x.hasVlCvx);
  if(live.length!==4)throw new Error(`expected 4 live vlCVX companies, found ${live.length}`);

  const [latestBlock,distributionCode]=await Promise.all([
    provider.getBlockNumber(),
    provider.getCode(DISTRIBUTION)
  ]);
  if(!distributionCode||distributionCode==='0x')throw new Error('vlCVX extra reward distribution has no bytecode');
  if(latestBlock<=EVENT_SCAN_FROM_BLOCK)throw new Error('invalid event scan boundary');

  const distribution=new Contract(DISTRIBUTION,DISTRIBUTION_ABI,provider);
  const boundLocker=getAddress(await distribution.cvxlocker());
  if(boundLocker.toLowerCase()!==LOCKER.toLowerCase())throw new Error('extra reward distribution locker binding drift');

  const logs=await scanRewardAdded(provider,EVENT_SCAN_FROM_BLOCK,latestBlock);
  if(!logs.length)throw new Error('no RewardAdded history found');
  const tokenAddresses=[...new Set(logs.map(log=>getAddress(eventInterface.parseLog(log).args._token)).map(x=>x.toLowerCase()))].map(lower=>getAddress(lower));
  if(!tokenAddresses.length)throw new Error('RewardAdded history produced empty token inventory');

  const tokens=[];
  for(const address of tokenAddresses){
    const meta=await tokenMeta(provider,address);
    const epochCount=Number(await distribution.rewardEpochsCount(meta.token));
    if(!Number.isSafeInteger(epochCount)||epochCount<=0)throw new Error(`invalid reward epoch count for ${meta.token}`);
    tokens.push({...meta,rewardEpochCount:epochCount});
  }

  const companies=[];
  for(const company of live){
    const wallet=company.wallets?.find(x=>x.hasVlCvx);
    if(!wallet?.address)throw new Error(`positive vlCVX wallet missing ${company.registry}`);
    const rewards=[];
    for(const token of tokens){
      const raw=BigInt(await distribution.claimableRewards(wallet.address,token.token));
      rewards.push({...token,amountRaw:raw.toString(),amount:round(formatUnits(raw,token.decimals)),observedZero:raw===0n});
    }
    companies.push({
      registry:company.registry,
      name:company.name,
      wallet:getAddress(wallet.address),
      currentRoute:wallet.route?.routeId||null,
      claimableRewardCount:rewards.length,
      positiveClaimableRewardCount:rewards.filter(x=>BigInt(x.amountRaw)>0n).length,
      rewards,
      evidenceClass:'observed-current-state',
      component:'locked-cvx-extra-reward-distribution',
      periodIncomeAuthority:false,
      delegateIncentiveSettlementAuthority:false,
      zeroIsObservedZero:true,
      unknownIsNotZero:true
    });
  }

  return{
    version:VERSION,
    generatedAt:new Date().toISOString(),
    executionAuthority:'none',
    claimTransactionAuthority:'none',
    source:{
      implementation:'convex-eth/platform/contracts/contracts/vlCvxExtraRewardDistribution.sol',
      knownCreationTransaction:KNOWN_CREATION_TX,
      rewardInventoryMethod:'RewardAdded(address,uint256,uint256) event history',
      archivalReceiptRequired:false
    },
    contract:{
      name:'vlCvxExtraRewardDistribution',
      address:DISTRIBUTION,
      locker:boundLocker,
      eventScanFromBlock:EVENT_SCAN_FROM_BLOCK,
      firstObservedRewardAddedBlock:Math.min(...logs.map(x=>x.blockNumber)),
      observedThroughBlock:latestBlock,
      claimableMethod:'claimableRewards(address,address)'
    },
    semantics:{
      component:'locked-cvx-extra-reward-distribution',
      rewardInventoryIsEventDerived:true,
      holderEpochDistributionComponent:true,
      currentRewardStateIsNotPeriodIncome:true,
      delegateIncentiveSettlementIsSeparate:true,
      doesNotByItselfResolveCurrentDelegateSettlement:true,
      referenceAprIsNotIncomeAuthority:true,
      unknownIsNotZero:true
    },
    summary:{
      companyCount:companies.length,
      rewardTokenCount:tokens.length,
      rewardAddedEventCount:logs.length,
      positiveRewardCompanyCount:companies.filter(x=>x.positiveClaimableRewardCount>0).length
    },
    tokens,
    companies
  };
}

export async function collectVlCvxExtraRewardDistributionProof({auditFile=AUDIT}={}){
  const audit=JSON.parse(fs.readFileSync(auditFile,'utf8'));
  const provider=await vlCvxExtraRewardProvider();
  return buildVlCvxExtraRewardDistributionProof({audit,provider});
}

async function main(){
  const out=await collectVlCvxExtraRewardDistributionProof();
  fs.writeFileSync(path.resolve(OUTPUT),JSON.stringify(out,null,2)+'\n');
  console.log('vlCVX EXTRA REWARD DISTRIBUTION PROOF PASS',JSON.stringify({
    contract:out.contract,
    summary:out.summary,
    tokens:out.tokens.map(t=>({symbol:t.symbol,token:t.token,rewardEpochCount:t.rewardEpochCount})),
    companies:out.companies.map(c=>({registry:c.registry,name:c.name,route:c.currentRoute,positiveRewards:c.positiveClaimableRewardCount,rewards:c.rewards.filter(r=>!r.observedZero).map(r=>({symbol:r.symbol,amount:r.amount}))}))
  },null,2));
}

if(import.meta.url===`file://${process.argv[1]}`)main().catch(e=>{console.error(e);process.exitCode=1});
