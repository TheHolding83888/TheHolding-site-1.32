from pathlib import Path

p = Path('reporting/ve33-accounting-evidence.mjs')
s = p.read_text()

def replace_once(old, new, label):
    global s
    count = s.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 match, found {count}')
    s = s.replace(old, new, 1)

replace_once(
"""    rpcEnv:'BASE_RPC_URL',rpcFallbacks:['https://base-rpc.publicnode.com','https://mainnet.base.org'],
    settlementRangeHints:{'mainnet.base.org':2000},settlementRequestSpacingMs:200,
""",
"""    rpcEnv:'BASE_RPC_URL',rpcFallbacks:['https://base-rpc.publicnode.com','https://mainnet.base.org'],
    historicalReadFallbacks:['https://mainnet.base.org'],
    settlementRpcOrder:['https://mainnet.base.org','https://base-rpc.publicnode.com'],
    settlementRangeHints:{'mainnet.base.org':2000},settlementRequestSpacingMs:200,
""",
'base operation routing config')

replace_once(
"""function providerLabel(url){
  try{return new URL(url).hostname||'configured-rpc';}
  catch{return'configured-rpc';}
}

function settlementRouterFor(cfg,lanes=[],latestBlockNumber=null){
  const urls=unique([process.env[cfg.rpcEnv],...[...cfg.rpcFallbacks].reverse()]);
""",
"""function providerLabel(url){
  try{return new URL(url).hostname||'configured-rpc';}
  catch{return'configured-rpc';}
}

function historicalReadProvidersFor(cfg,primaryProvider){
  return[
    primaryProvider,
    ...unique(cfg.historicalReadFallbacks||[]).map(url=>new JsonRpcProvider(url,cfg.chainId))
  ];
}

function settlementRouterFor(cfg,lanes=[],latestBlockNumber=null){
  const urls=unique([...(cfg.settlementRpcOrder||[]),process.env[cfg.rpcEnv],...[...cfg.rpcFallbacks].reverse()]);
""",
'operation-specific provider helpers')

replace_once(
"""    addressSplitCount:0,rateLimitRetryCount:0,failoverCount:0,providerDisableCount:0,canonicalBucketMisses:0,
""",
"""    addressSplitCount:0,rateLimitRetryCount:0,transientRetryCount:0,failoverCount:0,providerDisableCount:0,canonicalBucketMisses:0,
""",
'settlement transient telemetry')

replace_once(
"""  const isRateLimitError=error=>/rate limit|over rate limit|requests per second|too many requests|http 429|status 429|rps capacity|exceeded.*capacity/.test(errorText(error));
  const isRangeError=error=>/block range is too large|limited to (?:a )?[0-9,]+ range|limited to\\s*0\\s*-\\s*[0-9,]+\\s*blocks?\\s*range|range.*too large|exceed.*block.*range/.test(errorText(error));
""",
"""  const isRateLimitError=error=>/rate limit|over rate limit|requests per second|too many requests|http 429|status 429|rps capacity|exceeded.*capacity/.test(errorText(error));
  const isTransientProviderError=error=>/503 service unavailable|502 bad gateway|504 gateway timeout|no backend is currently healthy|temporarily unavailable|service unavailable|gateway timeout/.test(errorText(error));
  const isRangeError=error=>/block range is too large|limited to (?:a )?[0-9,]+ range|limited to\\s*0\\s*-\\s*[0-9,]+\\s*blocks?\\s*range|range.*too large|exceed.*block.*range/.test(errorText(error));
""",
'provider transient classifier')

replace_once(
"""        if(isRateLimitError(error)&&attempt<attempts){
          stats.rateLimitRetryCount++;
          await wait(500*Math.pow(2,attempt-1));
          continue;
        }
""",
"""        if((isRateLimitError(error)||isTransientProviderError(error))&&attempt<attempts){
          if(isRateLimitError(error))stats.rateLimitRetryCount++;
          else stats.transientRetryCount++;
          await wait(500*Math.pow(2,attempt-1));
          continue;
        }
""",
'provider transient retry')

replace_once(
"""      addressSplitCount:stats.addressSplitCount,rateLimitRetryCount:stats.rateLimitRetryCount,failoverCount:stats.failoverCount,providerDisableCount:stats.providerDisableCount,
""",
"""      addressSplitCount:stats.addressSplitCount,rateLimitRetryCount:stats.rateLimitRetryCount,transientRetryCount:stats.transientRetryCount,failoverCount:stats.failoverCount,providerDisableCount:stats.providerDisableCount,
""",
'settlement transient snapshot')

replace_once(
"""async function ownerAt({provider,cfg,lane,blockNumber,ownerCache}){
  const key=`${lower(cfg.votingEscrow)}:${blockNumber}:${lane.tokenId}`;
  if(!ownerCache.has(key)){
    const ve=new Contract(cfg.votingEscrow,VE_ABI,provider);
    ownerCache.set(key,ve.ownerOf(BigInt(lane.tokenId),{blockTag:blockNumber}).then(getAddress));
  }
  return ownerCache.get(key);
}

async function readLaneState({provider,cfg,lane,blockNumber,observedAt,monthBoundary=false,ownerCache=new Map()}){
  try{
    const owner=await ownerAt({provider,cfg,lane,blockNumber,ownerCache});
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
      accountingStart:lane.accountingStart||FULL_ACCOUNTING_START,periodIncomeAuthority:false,unknownIsNotZero:true
    };
  }catch(error){return{ok:false,status:'state-read-unavailable',error:error?.shortMessage||error?.message||String(error)};}
}

export async function probeHistoricalBoundary({provider,cfg,lanes,blockNumber}){
  const sample=lanes.find(x=>x.kind==='rebase-distributor')||lanes[0];
  if(!sample)return{available:true,status:'no-lanes'};
  try{
    await new Contract(cfg.rewardsDistributor,REWARDS_DISTRIBUTOR_ABI,provider).claimable(BigInt(sample.tokenId),{blockTag:blockNumber});
    return{available:true,status:'historical-state-readable',sampleTokenId:sample.tokenId};
  }catch(error){
    return{available:false,status:'historical-state-unavailable',sampleTokenId:sample.tokenId,error:error?.shortMessage||error?.message||String(error)};
  }
}
""",
"""async function ownerAt({provider,cfg,lane,blockNumber,ownerCache,providerKey='primary'}){
  const key=`${providerKey}:${lower(cfg.votingEscrow)}:${blockNumber}:${lane.tokenId}`;
  if(!ownerCache.has(key)){
    const ve=new Contract(cfg.votingEscrow,VE_ABI,provider);
    ownerCache.set(key,ve.ownerOf(BigInt(lane.tokenId),{blockTag:blockNumber}).then(getAddress));
  }
  return ownerCache.get(key);
}

async function readLaneState({provider,providers=null,cfg,lane,blockNumber,observedAt,monthBoundary=false,ownerCache=new Map()}){
  const candidates=Array.isArray(providers)&&providers.length?providers:[provider];
  let last=null;
  for(let providerIndex=0;providerIndex<candidates.length;providerIndex++){
    const candidate=candidates[providerIndex];
    try{
      const owner=await ownerAt({provider:candidate,cfg,lane,blockNumber,ownerCache,providerKey:`provider-${providerIndex}`});
      if(lower(owner)!==lower(lane.holder))return{ok:false,status:'holder-mismatch',owner};
      let raw;
      if(lane.kind==='rebase-distributor')raw=await new Contract(cfg.rewardsDistributor,REWARDS_DISTRIBUTOR_ABI,candidate).claimable(BigInt(lane.tokenId),{blockTag:blockNumber});
      else raw=await new Contract(lane.rewardContract,REWARD_ABI,candidate).earned(lane.rewardToken,BigInt(lane.tokenId),{blockTag:blockNumber});
      return{
        ok:true,checkpointKey:checkpointKey(lane,blockNumber),laneKey:lane.laneKey,company:lane.company,
        protocolKey:lane.protocolKey,protocol:lane.protocol,chain:lane.chain,chainId:lane.chainId,route:lane.route,
        holder:lane.holder,tokenId:lane.tokenId,custodyContext:lane.custodyContext,kind:lane.kind,
        rewardContract:lane.rewardContract,distributor:lane.distributor,rewardToken:lane.rewardToken,rewardSymbol:lane.rewardSymbol,
        decimals:lane.decimals,observedAt,blockNumber,entitlementRaw:BigInt(raw).toString(),
        entitlementAmount:round(Number(formatUnits(raw,lane.decimals)),12),monthBoundary,exactBlockTaggedState:true,
        accountingStart:lane.accountingStart||FULL_ACCOUNTING_START,periodIncomeAuthority:false,unknownIsNotZero:true
      };
    }catch(error){last=error;}
  }
  return{ok:false,status:'state-read-unavailable',error:last?.shortMessage||last?.message||String(last||'state read unavailable')};
}

export async function probeHistoricalBoundary({provider,providers=null,cfg,lanes,blockNumber}){
  const sample=lanes.find(x=>x.kind==='rebase-distributor')||lanes[0];
  if(!sample)return{available:true,status:'no-lanes'};
  const candidates=Array.isArray(providers)&&providers.length?providers:[provider];
  let last=null;
  for(const candidate of candidates){
    try{
      await new Contract(cfg.rewardsDistributor,REWARDS_DISTRIBUTOR_ABI,candidate).claimable(BigInt(sample.tokenId),{blockTag:blockNumber});
      return{available:true,status:'historical-state-readable',sampleTokenId:sample.tokenId};
    }catch(error){last=error;}
  }
  return{available:false,status:'historical-state-unavailable',sampleTokenId:sample.tokenId,error:last?.shortMessage||last?.message||String(last||'historical state unavailable')};
}
""",
'operation-level historical state failover')

replace_once(
"""    const provider=providers[protocolKey]||await providerFor(cfg);
    const latestNumber=await provider.getBlockNumber(),latestBlock=await getBlockReliable(provider,latestNumber);
""",
"""    const provider=providers[protocolKey]||await providerFor(cfg);
    const historicalReadProviders=providers[protocolKey]?[provider]:historicalReadProvidersFor(cfg,provider);
    const latestNumber=await provider.getBlockNumber(),latestBlock=await getBlockReliable(provider,latestNumber);
""",
'historical provider pool wiring')

replace_once(
"const capability=await probeHistoricalBoundary({provider,cfg,lanes:eligibleLanes,blockNumber:block.blockNumber});",
"const capability=await probeHistoricalBoundary({provider,providers:historicalReadProviders,cfg,lanes:eligibleLanes,blockNumber:block.blockNumber});",
'historical boundary capability failover')

replace_once(
"state:await readLaneState({provider,cfg,lane,blockNumber:b.blockNumber,observedAt:boundaryAt,monthBoundary:true,ownerCache})",
"state:await readLaneState({provider,providers:historicalReadProviders,cfg,lane,blockNumber:b.blockNumber,observedAt:boundaryAt,monthBoundary:true,ownerCache})",
'historical lane state failover')

replace_once(
"state:await readLaneState({provider,cfg,lane,blockNumber:latestNumber,observedAt,monthBoundary:false,ownerCache})",
"state:await readLaneState({provider,providers:historicalReadProviders,cfg,lane,blockNumber:latestNumber,observedAt,monthBoundary:false,ownerCache})",
'current lane state failover')

p.write_text(s)
print('PR830 hybrid routing patch applied')
