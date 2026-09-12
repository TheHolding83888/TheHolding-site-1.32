import fs from 'node:fs';
import path from 'node:path';
import { Contract, Interface, JsonRpcProvider, formatUnits, getAddress } from 'ethers';

const VERSION='0.1-vlcvx-extra-reward-distribution-proof';
const AUDIT=process.env.VLCVX_AUDIT_OUTPUT||'/tmp/vlcvx-route-audit.json';
const OUTPUT=process.env.VLCVX_EXTRA_REWARD_OUTPUT||'/tmp/vlcvx-extra-reward-distribution-proof.json';
const CANONICAL_REWARDS=process.env.REWARDS_OUTPUT||path.resolve('companies/rewards-data.json');
const TARGETS=['YieldRing.eth','defitea.eth',"Rook's portfolio",'Cypher'];
const RPCS=[...new Set([
  process.env.ETH_RPC_URL,
  'https://ethereum-rpc.publicnode.com',
  'https://eth.llamarpc.com',
  'https://eth.drpc.org',
  'https://rpc.flashbots.net',
  'https://1rpc.io/eth'
].filter(Boolean))];
const DISTRIBUTION=getAddress('0x9B622f2c40b80EF5efb14c2B2239511FfBFaB702');
const LOCKER=getAddress('0x72a19342e8F1838460eBFCCEf09F6585e32db86E');
const KNOWN_CREATION_TX='0x1591bd14e84575bb9f40681d7f9b9bc52f23699175f1d486f2e8f61241505e36';
// Convex community's long-running subgraph indexes this V2 distribution from block 14,356,209.
// Treat that as a conservative evidence boundary; current contract identity is still proven live.
const EVENT_SCAN_FROM_BLOCK=14_356_209;
const BLOCKSCOUT_LOGS='https://eth.blockscout.com/api';
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
const nonNegativeInt=v=>Number.isSafeInteger(Number(v))&&Number(v)>=0?Number(v):null;
const boundedError=e=>String(e?.shortMessage||e?.message||e||'unknown error').replace(/https?:\/\/[^\s|]+/g,'<provider>').slice(0,1600);

export async function vlCvxExtraRewardProvider(){
  let last;
  for(const url of RPCS){
    try{
      const p=new JsonRpcProvider(url,1,{staticNetwork:true});
      await p.getBlockNumber();
      return p;
    }catch(e){last=e}
  }
  throw last||new Error('Ethereum current-state RPC unavailable');
}

async function tokenMeta(provider,address){
  const token=getAddress(address),c=new Contract(token,ERC20_ABI,provider);
  const [symbol,decimals]=await Promise.all([c.symbol().catch(()=>token),c.decimals().catch(()=>18)]);
  return{token,symbol:String(symbol),decimals:Number(decimals)};
}

async function scanRewardAddedRpc(provider,fromBlock,toBlock){
  const logs=[];
  let cursor=fromBlock;
  let span=250000;
  let calls=0;
  while(cursor<=toBlock){
    if(++calls>250)throw new Error('RPC RewardAdded scan exceeded bounded call budget');
    const end=Math.min(toBlock,cursor+span-1);
    try{
      const rows=await provider.getLogs({address:DISTRIBUTION,topics:[rewardAddedTopic],fromBlock:cursor,toBlock:end});
      logs.push(...rows);
      cursor=end+1;
    }catch(e){
      if(span<=50000)throw new Error(`RewardAdded RPC range unsupported at ${cursor}-${end}: ${e?.shortMessage||e?.message||e}`);
      span=Math.max(50000,Math.floor(span/2));
    }
  }
  return logs;
}

function blockNumberOf(log){
  const v=log.blockNumber??log.block_number;
  if(typeof v==='number')return v;
  if(typeof v==='string')return v.startsWith('0x')?Number.parseInt(v,16):Number.parseInt(v,10);
  return NaN;
}

async function scanRewardAddedBlockscout(fromBlock,toBlock){
  const logs=[];
  const span=250000;
  for(let cursor=fromBlock;cursor<=toBlock;cursor+=span){
    const end=Math.min(toBlock,cursor+span-1);
    const u=new URL(BLOCKSCOUT_LOGS);
    u.searchParams.set('module','logs');
    u.searchParams.set('action','getLogs');
    u.searchParams.set('fromBlock',String(cursor));
    u.searchParams.set('toBlock',String(end));
    u.searchParams.set('address',DISTRIBUTION);
    u.searchParams.set('topic0',rewardAddedTopic);
    const r=await fetch(u,{headers:{accept:'application/json'},signal:AbortSignal.timeout(20000)});
    if(!r.ok)throw new Error(`Blockscout RewardAdded HTTP ${r.status} at ${cursor}-${end}`);
    const body=await r.json();
    if(body?.status==='0'&&/no (records|logs)/i.test(String(body?.message||body?.result||'')))continue;
    if(!Array.isArray(body?.result))throw new Error(`Blockscout RewardAdded malformed response at ${cursor}-${end}`);
    if(body.result.length>=1000)throw new Error(`Blockscout RewardAdded range hit 1000-log cap at ${cursor}-${end}`);
    for(const row of body.result){
      const blockNumber=blockNumberOf(row);
      if(!Number.isFinite(blockNumber))throw new Error('Blockscout RewardAdded row missing block number');
      if(String(row?.topics?.[0]||'').toLowerCase()!==rewardAddedTopic.toLowerCase())continue;
      logs.push({topics:row.topics,data:row.data,blockNumber,transactionHash:row.transactionHash||row.transaction_hash||null});
    }
  }
  return logs;
}

async function collectRewardAddedHistory(toBlock){
  const errors=[];
  for(const url of RPCS){
    try{
      const provider=new JsonRpcProvider(url,1,{staticNetwork:true});
      await provider.getBlockNumber();
      const logs=await scanRewardAddedRpc(provider,EVENT_SCAN_FROM_BLOCK,toBlock);
      return{logs,transport:'ethereum-json-rpc',fromBlock:EVENT_SCAN_FROM_BLOCK,toBlock,scanComplete:true};
    }catch(e){errors.push(`rpc:${e?.shortMessage||e?.message||e}`)}
  }
  try{
    const logs=await scanRewardAddedBlockscout(EVENT_SCAN_FROM_BLOCK,toBlock);
    return{logs,transport:'blockscout-indexed-logs',fromBlock:EVENT_SCAN_FROM_BLOCK,toBlock,scanComplete:true};
  }catch(e){errors.push(`blockscout:${e?.message||e}`)}
  throw new Error(`RewardAdded history unavailable: ${errors.join(' | ')}`);
}

export function retainedVlCvxRewardInventory(previousData){
  const diag=previousData?.diagnostics?.vlCvxExtraRewardDistributionProof;
  if(diag?.version!==VERSION||diag?.executionAuthority!=='none'||diag?.component!=='locked-cvx-extra-reward-distribution')return null;
  const inventory=diag.rewardInventoryStatus;
  if(!['event-derived-token-inventory','complete-empty-rewardadded-history'].includes(inventory))return null;
  const eventCount=nonNegativeInt(diag.rewardAddedEventCount),tokenCount=nonNegativeInt(diag.rewardTokenCount);
  if(eventCount===null||tokenCount===null)return null;
  if(inventory==='complete-empty-rewardadded-history'&&(eventCount!==0||tokenCount!==0))return null;

  const sources=[];
  for(const name of TARGETS){
    const source=(previousData?.companies?.[name]?.sources||[]).find(x=>x.route==='vlcvx-extra-reward-distribution');
    if(!source?.details||source.details.component!=='locked-cvx-extra-reward-distribution'||source.details.unknownIsNotZero!==true||source.details.periodIncomeAuthority!==false)return null;
    sources.push(source);
  }
  const first=sources[0].details;
  const scanFrom=nonNegativeInt(first.rewardInventoryScanFromBlock),scanThrough=nonNegativeInt(first.rewardInventoryScanThroughBlock);
  if(scanFrom!==EVENT_SCAN_FROM_BLOCK||scanThrough===null||scanThrough<scanFrom)return null;
  for(const source of sources){
    const x=source.details;
    if(x.rewardInventoryStatus!==inventory||nonNegativeInt(x.rewardAddedEventCount)!==eventCount||nonNegativeInt(x.rewardTokenCount)!==tokenCount||nonNegativeInt(x.rewardInventoryScanFromBlock)!==scanFrom||nonNegativeInt(x.rewardInventoryScanThroughBlock)!==scanThrough)return null;
  }

  const tokenMap=new Map();
  const diagTokens=Array.isArray(diag.tokens)?diag.tokens:[];
  for(const row of [...diagTokens,...sources.flatMap(x=>Array.isArray(x.details.rewards)?x.details.rewards:[])]){
    try{
      const token=getAddress(row.token);
      if(!tokenMap.has(token.toLowerCase()))tokenMap.set(token.toLowerCase(),{token,symbol:String(row.symbol||token),decimals:Number(row.decimals??18),rewardEpochCount:nonNegativeInt(row.rewardEpochCount)});
    }catch{}
  }
  if(tokenCount!==tokenMap.size)return null;
  if(tokenCount>0&&[...tokenMap.values()].some(x=>x.rewardEpochCount===null||x.rewardEpochCount<=0))return null;

  return{
    generatedAt:String(diag.generatedAt||previousData.generatedAt||''),
    inventoryStatus:inventory,
    eventCount,
    tokenCount,
    tokens:[...tokenMap.values()],
    transport:String(first.rewardInventoryTransport||diag.rewardInventoryTransport||'retained-canonical-rewards'),
    scanFromBlock:scanFrom,
    scanThroughBlock:scanThrough,
    firstObservedRewardAddedBlock:diag.firstObservedRewardAddedBlock??null
  };
}

export async function buildVlCvxExtraRewardDistributionProof({audit,provider,previousData=null}){
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

  let history=null,retained=null,freshHistoryError=null;
  try{
    history=await collectRewardAddedHistory(latestBlock);
    if(history.scanComplete!==true||history.fromBlock!==EVENT_SCAN_FROM_BLOCK||history.toBlock!==latestBlock)throw new Error('RewardAdded history completeness drift');
  }catch(e){
    freshHistoryError=boundedError(e);
    retained=retainedVlCvxRewardInventory(previousData);
    if(!retained)throw new Error(`${freshHistoryError}; no validated retained canonical RewardAdded inventory available`);
  }
  const freshHistory=Boolean(history);
  const logs=freshHistory?history.logs:[];
  const historicalEvidence=freshHistory?{
    status:'fresh-verified',
    freshness:'current-run',
    freshVerificationAvailable:true,
    partial:false,
    retainedFromGeneratedAt:null,
    lastVerifiedScanThroughBlock:latestBlock,
    freshVerificationError:null
  }:{
    status:'retained-last-verified',
    freshness:'unknown',
    freshVerificationAvailable:false,
    partial:true,
    retainedFromGeneratedAt:retained.generatedAt||null,
    lastVerifiedScanThroughBlock:retained.scanThroughBlock,
    freshVerificationError:freshHistoryError
  };

  const tokenAddresses=freshHistory
    ?[...new Set(logs.map(log=>getAddress(eventInterface.parseLog(log).args._token)).map(x=>x.toLowerCase()))].map(lower=>getAddress(lower))
    :retained.tokens.map(x=>x.token);

  const tokens=[];
  for(const address of tokenAddresses){
    const meta=await tokenMeta(provider,address);
    const epochCount=Number(await distribution.rewardEpochsCount(meta.token));
    if(!Number.isSafeInteger(epochCount)||epochCount<=0)throw new Error(`invalid reward epoch count for ${meta.token}`);
    tokens.push({...meta,rewardEpochCount:epochCount});
  }

  const inventoryStatus=freshHistory
    ?(tokens.length?'event-derived-token-inventory':'complete-empty-rewardadded-history')
    :retained.inventoryStatus;
  const rewardAddedEventCount=freshHistory?logs.length:retained.eventCount;
  if(!freshHistory&&tokens.length!==retained.tokenCount)throw new Error('retained reward token inventory reconstruction drift');

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
      evidenceClass:freshHistory?'observed-current-state':'observed-current-state-with-retained-historical-inventory',
      component:'locked-cvx-extra-reward-distribution',
      rewardInventoryStatus:inventoryStatus,
      currentInventoryStatus:freshHistory?inventoryStatus:'unknown-current-inventory',
      freshHistoryVerificationAvailable:freshHistory,
      historyFreshness:freshHistory?'current-run':'unknown',
      partial:!freshHistory,
      periodIncomeAuthority:false,
      delegateIncentiveSettlementAuthority:false,
      zeroIsObservedZero:true,
      unknownIsNotZero:true
    });
  }

  return{
    version:VERSION,
    generatedAt:new Date().toISOString(),
    status:freshHistory?'ok':'partial',
    executionAuthority:'none',
    claimTransactionAuthority:'none',
    historicalEvidence,
    source:{
      implementation:'convex-eth/platform/contracts/contracts/vlCvxExtraRewardDistribution.sol',
      knownCreationTransaction:KNOWN_CREATION_TX,
      eventBoundaryReference:'convex-community/convex-stats-subgraph vlCvxExtraRewardDistributionV2 startBlock',
      rewardInventoryMethod:'RewardAdded(address,uint256,uint256) event history',
      rewardInventoryTransport:freshHistory?history.transport:`retained-last-verified:${retained.transport}`,
      rewardInventoryScanComplete:freshHistory,
      retainedLastVerifiedScanComplete:!freshHistory,
      rewardInventoryScanFromBlock:freshHistory?history.fromBlock:retained.scanFromBlock,
      rewardInventoryScanThroughBlock:freshHistory?history.toBlock:retained.scanThroughBlock,
      currentStateObservedBlock:latestBlock,
      freshHistoryVerificationAvailable:freshHistory,
      archivalReceiptRequired:false
    },
    contract:{
      name:'vlCvxExtraRewardDistribution',
      address:DISTRIBUTION,
      locker:boundLocker,
      eventScanFromBlock:EVENT_SCAN_FROM_BLOCK,
      firstObservedRewardAddedBlock:freshHistory
        ?(logs.length?Math.min(...logs.map(x=>x.blockNumber)):null)
        :(retained.firstObservedRewardAddedBlock??null),
      observedThroughBlock:freshHistory?latestBlock:retained.scanThroughBlock,
      currentStateObservedBlock:latestBlock,
      claimableMethod:'claimableRewards(address,address)'
    },
    semantics:{
      component:'locked-cvx-extra-reward-distribution',
      rewardInventoryIsEventDerived:true,
      rewardInventoryScanComplete:freshHistory,
      retainedLastVerifiedInventoryAvailable:!freshHistory,
      emptyRewardAddedHistoryMeansNoKnownRewardEpochs:freshHistory,
      currentInventoryMayHaveChangedWhenHistoryIsRetained:!freshHistory,
      holderEpochDistributionComponent:true,
      currentRewardStateIsNotPeriodIncome:true,
      delegateIncentiveSettlementIsSeparate:true,
      doesNotByItselfResolveCurrentDelegateSettlement:true,
      referenceAprIsNotIncomeAuthority:true,
      unknownIsNotZero:true
    },
    summary:{
      proofStatus:freshHistory?'ok':'partial',
      companyCount:companies.length,
      rewardTokenCount:tokens.length,
      rewardAddedEventCount,
      rewardInventoryStatus:inventoryStatus,
      currentInventoryStatus:freshHistory?inventoryStatus:'unknown-current-inventory',
      historyStatus:historicalEvidence.status,
      historyFreshness:historicalEvidence.freshness,
      freshHistoryVerificationAvailable:freshHistory,
      partial:!freshHistory,
      positiveRewardCompanyCount:companies.filter(x=>x.positiveClaimableRewardCount>0).length
    },
    tokens,
    companies
  };
}

export function applyVlCvxExtraRewardDistributionProof(data,proof){
  if(proof?.version!==VERSION||proof?.executionAuthority!=='none'||proof?.claimTransactionAuthority!=='none')throw new Error('invalid vlCVX extra reward distribution proof');
  const fresh=proof?.historicalEvidence?.status==='fresh-verified'&&proof?.historicalEvidence?.freshVerificationAvailable===true&&proof?.historicalEvidence?.partial===false;
  const retained=proof?.historicalEvidence?.status==='retained-last-verified'&&proof?.historicalEvidence?.freshVerificationAvailable===false&&proof?.historicalEvidence?.freshness==='unknown'&&proof?.historicalEvidence?.partial===true;
  if(!fresh&&!retained)throw new Error('vlCVX historical evidence state invalid');
  if(fresh&&(proof?.source?.rewardInventoryScanComplete!==true||proof?.semantics?.rewardInventoryScanComplete!==true))throw new Error('fresh vlCVX extra reward inventory is not complete');
  if(retained&&(proof?.source?.rewardInventoryScanComplete!==false||proof?.source?.retainedLastVerifiedScanComplete!==true||proof?.semantics?.rewardInventoryScanComplete!==false||proof?.semantics?.retainedLastVerifiedInventoryAvailable!==true))throw new Error('retained vlCVX history must remain explicit partial evidence');
  if(proof?.semantics?.currentRewardStateIsNotPeriodIncome!==true||proof?.semantics?.delegateIncentiveSettlementIsSeparate!==true||proof?.semantics?.doesNotByItselfResolveCurrentDelegateSettlement!==true||proof?.semantics?.unknownIsNotZero!==true)throw new Error('vlCVX extra reward semantic boundary drift');
  const inventory=proof?.summary?.rewardInventoryStatus;
  if(!['event-derived-token-inventory','complete-empty-rewardadded-history'].includes(inventory))throw new Error('vlCVX extra reward inventory status invalid');
  if(inventory==='complete-empty-rewardadded-history'&&(Number(proof?.summary?.rewardTokenCount)!==0||Number(proof?.summary?.rewardAddedEventCount)!==0))throw new Error('vlCVX complete-empty inventory counters drift');
  if(retained&&proof?.summary?.currentInventoryStatus!=='unknown-current-inventory')throw new Error('retained history must not assert current inventory completeness');
  for(const row of proof.companies||[]){
    const c=data.companies?.[row.name];if(!c)throw new Error(`canonical Rewards company missing ${row.name}`);
    if(row.component!=='locked-cvx-extra-reward-distribution'||row.periodIncomeAuthority!==false||row.delegateIncentiveSettlementAuthority!==false||row.unknownIsNotZero!==true)throw new Error(`vlCVX extra reward company boundary drift ${row.registry}`);
    if(row.rewardInventoryStatus!==inventory)throw new Error(`vlCVX extra reward inventory parity drift ${row.registry}`);
    if(retained&&(row.currentInventoryStatus!=='unknown-current-inventory'||row.partial!==true||row.freshHistoryVerificationAvailable!==false))throw new Error(`vlCVX retained history epistemic drift ${row.registry}`);
    c.sources=c.sources||[];
    const source={
      protocol:'Convex · vlCVX extra reward distribution',
      route:'vlcvx-extra-reward-distribution',
      status:fresh?'ok':'partial',
      chain:'Ethereum',
      metric:'vlCvxExtraRewardDistribution RewardAdded inventory + claimableRewards(address,token) current state',
      note:fresh
        ?(inventory==='complete-empty-rewardadded-history'
          ?'Complete bounded RewardAdded history contains no reward epochs for this distribution component. This is factual component tracking only: no period income is created and the separate delegate-incentive settlement lane remains unresolved where applicable.'
          :'Reward-token inventory is derived from complete RewardAdded history and current claimable state is observed per token. This is factual component tracking only: no period income is created and delegate-incentive settlement remains separate.')
        :'Fresh RewardAdded history is unavailable. The token inventory is retained only from the last verified canonical snapshot; current inventory completeness is unknown. Current contract identity and claimable state for retained tokens were re-read. No zero-income or period-income conclusion is created.',
      details:{
        principalAsset:'vlCVX',
        component:'locked-cvx-extra-reward-distribution',
        wallet:row.wallet,
        distribution:proof.contract.address,
        locker:proof.contract.locker,
        claimableRewardsMethod:proof.contract.claimableMethod,
        rewardInventoryStatus:inventory,
        currentInventoryStatus:proof.summary.currentInventoryStatus,
        rewardInventoryMethod:proof.source.rewardInventoryMethod,
        rewardInventoryTransport:proof.source.rewardInventoryTransport,
        rewardInventoryScanComplete:fresh,
        retainedLastVerifiedScanComplete:retained,
        rewardInventoryScanFromBlock:proof.source.rewardInventoryScanFromBlock,
        rewardInventoryScanThroughBlock:proof.source.rewardInventoryScanThroughBlock,
        currentStateObservedBlock:proof.source.currentStateObservedBlock,
        historyStatus:proof.historicalEvidence.status,
        historyFreshness:proof.historicalEvidence.freshness,
        freshHistoryVerificationAvailable:proof.historicalEvidence.freshVerificationAvailable,
        retainedFromGeneratedAt:proof.historicalEvidence.retainedFromGeneratedAt,
        partial:proof.historicalEvidence.partial,
        rewardAddedEventCount:proof.summary.rewardAddedEventCount,
        rewardTokenCount:proof.summary.rewardTokenCount,
        rewards:row.rewards,
        positiveClaimableRewardCount:row.positiveClaimableRewardCount,
        currentRoute:row.currentRoute,
        periodIncomeAuthority:false,
        delegateIncentiveSettlementAuthority:false,
        currentRewardStateIsNotPeriodIncome:true,
        unknownIsNotZero:true
      }
    };
    const i=c.sources.findIndex(x=>x.route===source.route);if(i>=0)c.sources[i]=source;else c.sources.push(source);
  }
  data.diagnostics=data.diagnostics||{};
  data.diagnostics.vlCvxExtraRewardDistributionProof={
    version:proof.version,
    generatedAt:proof.generatedAt,
    status:proof.status,
    executionAuthority:'none',
    component:'locked-cvx-extra-reward-distribution',
    companyCount:proof.summary.companyCount,
    rewardInventoryStatus:inventory,
    currentInventoryStatus:proof.summary.currentInventoryStatus,
    rewardAddedEventCount:proof.summary.rewardAddedEventCount,
    rewardTokenCount:proof.summary.rewardTokenCount,
    rewardInventoryTransport:proof.source.rewardInventoryTransport,
    rewardInventoryScanFromBlock:proof.source.rewardInventoryScanFromBlock,
    rewardInventoryScanThroughBlock:proof.source.rewardInventoryScanThroughBlock,
    currentStateObservedBlock:proof.source.currentStateObservedBlock,
    firstObservedRewardAddedBlock:proof.contract.firstObservedRewardAddedBlock,
    historyStatus:proof.historicalEvidence.status,
    historyFreshness:proof.historicalEvidence.freshness,
    freshHistoryVerificationAvailable:proof.historicalEvidence.freshVerificationAvailable,
    retainedFromGeneratedAt:proof.historicalEvidence.retainedFromGeneratedAt,
    partial:proof.historicalEvidence.partial,
    tokens:proof.tokens.map(t=>({token:t.token,symbol:t.symbol,decimals:t.decimals,rewardEpochCount:t.rewardEpochCount})),
    unknownIsNotZero:true,
    periodIncomeAuthority:false,
    semanticBoundary:'component factual state only; retained historical inventory never becomes current completeness, zero-income evidence, delegate-incentive settlement, or period income'
  };
  return data;
}

export async function collectVlCvxExtraRewardDistributionProof({auditFile=AUDIT,previousData=null}={}){
  const audit=JSON.parse(fs.readFileSync(auditFile,'utf8'));
  const provider=await vlCvxExtraRewardProvider();
  let canonical=previousData;
  if(!canonical&&fs.existsSync(CANONICAL_REWARDS))canonical=JSON.parse(fs.readFileSync(CANONICAL_REWARDS,'utf8'));
  return buildVlCvxExtraRewardDistributionProof({audit,provider,previousData:canonical});
}

async function main(){
  const out=await collectVlCvxExtraRewardDistributionProof();
  fs.writeFileSync(path.resolve(OUTPUT),JSON.stringify(out,null,2)+'\n');
  console.log('vlCVX EXTRA REWARD DISTRIBUTION PROOF PASS',JSON.stringify({
    status:out.status,
    historyStatus:out.historicalEvidence.status,
    historyFreshness:out.historicalEvidence.freshness,
    freshHistoryVerificationAvailable:out.historicalEvidence.freshVerificationAvailable,
    transport:out.source.rewardInventoryTransport,
    contract:out.contract,
    summary:out.summary,
    tokens:out.tokens.map(t=>({symbol:t.symbol,token:t.token,rewardEpochCount:t.rewardEpochCount})),
    companies:out.companies.map(c=>({registry:c.registry,name:c.name,route:c.currentRoute,rewardInventoryStatus:c.rewardInventoryStatus,currentInventoryStatus:c.currentInventoryStatus,positiveRewards:c.positiveClaimableRewardCount,rewards:c.rewards.filter(r=>!r.observedZero).map(r=>({symbol:r.symbol,amount:r.amount}))}))
  },null,2));
}

if(import.meta.url===`file://${process.argv[1]}`)main().catch(e=>{console.error(e);process.exitCode=1});