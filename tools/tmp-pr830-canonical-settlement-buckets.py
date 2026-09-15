from pathlib import Path

p=Path('reporting/ve33-accounting-evidence.mjs')
s=p.read_text()

old="function settlementRouterFor(cfg,lanes=[]){"
new="function settlementRouterFor(cfg,lanes=[],latestBlockNumber=null){"
assert s.count(old)==1, s.count(old)
s=s.replace(old,new,1)

old="""  const queryCache=new Map();
  let preferredIndex=0;
"""
new="""  const queryCache=new Map();
  const configuredRangeHints=Object.values(cfg.settlementRangeHints||{}).map(Number).filter(x=>Number.isFinite(x)&&x>0);
  const CANONICAL_BUCKET_SIZE=Math.max(1,Math.min(MAX_LOG_BLOCKS,...(configuredRangeHints.length?configuredRangeHints:[MAX_LOG_BLOCKS])));
  const settlementCeiling=Number.isFinite(Number(latestBlockNumber))?Number(latestBlockNumber):Number.MAX_SAFE_INTEGER;
  let preferredIndex=0;
"""
assert s.count(old)==1, s.count(old)
s=s.replace(old,new,1)

old="""    addressSplitCount:0,rateLimitRetryCount:0,failoverCount:0,providerDisableCount:0,
    providerSuccessCounts:{},providerFailureCounts:{},failureSamples:[]
"""
new="""    addressSplitCount:0,rateLimitRetryCount:0,failoverCount:0,providerDisableCount:0,canonicalBucketMisses:0,
    providerSuccessCounts:{},providerFailureCounts:{},failureSamples:[]
"""
assert s.count(old)==1, s.count(old)
s=s.replace(old,new,1)

start=s.index("  const query=async({kind,lane,fromBlock,toBlock})=>{")
end=s.index("  return{\n    query,",start)
replacement="""  const query=async({kind,lane,fromBlock,toBlock})=>{
    const isRebase=kind==='rebase-distributor';
    const targetAddress=getAddress(isRebase?cfg.rewardsDistributor:lane.rewardContract);
    const group=settlementGroupByAddress.get(lower(targetAddress));
    if(!group)throw new Error(`Settlement contract not present in pooled address groups: ${targetAddress}`);
    const exactFrom=Number(fromBlock),exactTo=Math.min(Number(toBlock),settlementCeiling);
    if(exactTo<exactFrom)return[];
    const firstBucket=Math.floor(exactFrom/CANONICAL_BUCKET_SIZE),lastBucket=Math.floor(exactTo/CANONICAL_BUCKET_SIZE);
    const bucketWorks=[];
    for(let bucket=firstBucket;bucket<=lastBucket;bucket++){
      const bucketFrom=bucket*CANONICAL_BUCKET_SIZE;
      const bucketTo=Math.min(settlementCeiling,bucketFrom+CANONICAL_BUCKET_SIZE-1);
      const cacheKey=[`settlement-group-${group.index}`,`bucket-${bucket}`,bucketFrom,bucketTo].join('|');
      let work=queryCache.get(cacheKey);
      if(work){
        stats.cacheHits++;
      }else{
        stats.canonicalBucketMisses++;
        work=(async()=>{
          let last=null;
          const order=[preferredIndex,...candidates.map((_,i)=>i).filter(i=>i!==preferredIndex)].filter((x,i,a)=>a.indexOf(x)===i);
          for(const index of order){
            const candidate=candidates[index];
            if(candidate.disabledForSettlement)continue;
            try{
              const logs=await queryCandidate({candidate,index,isRebase,kind,lane,fromBlock:bucketFrom,toBlock:bucketTo,addresses:group.addresses});
              if(index!==preferredIndex){preferredIndex=index;stats.failoverCount++;}
              return logs;
            }catch(error){last=error;}
          }
          throw last||new Error(`No settlement-log RPC available for ${cfg.protocol}`);
        })();
        queryCache.set(cacheKey,work);
      }
      bucketWorks.push({cacheKey,work});
    }
    const combined=[];
    for(const{cacheKey,work}of bucketWorks){
      try{combined.push(...await work);}
      catch(error){if(queryCache.get(cacheKey)===work)queryCache.delete(cacheKey);throw error;}
    }
    const expectedTopic=lower(isRebase?CLAIMED_TOPIC:CLAIM_REWARDS_TOPIC);
    return combined.filter(log=>Number(log.blockNumber)>=exactFrom&&Number(log.blockNumber)<=exactTo&&lower(log.address)===lower(targetAddress)&&lower(log?.topics?.[0])===expectedTopic);
  };
"""
s=s[:start]+replacement+s[end:]

old="""      requestSpacingMs:REQUEST_SPACING_MS,queryAttempts:stats.queryAttempts,cacheHits:stats.cacheHits,cacheEntries:queryCache.size,
"""
new="""      requestSpacingMs:REQUEST_SPACING_MS,canonicalBucketSize:CANONICAL_BUCKET_SIZE,queryAttempts:stats.queryAttempts,cacheHits:stats.cacheHits,cacheEntries:queryCache.size,canonicalBucketMisses:stats.canonicalBucketMisses,
"""
assert s.count(old)==1, s.count(old)
s=s.replace(old,new,1)

old="const settlementRouter=settlementRouterFor(cfg,lanes);"
new="const settlementRouter=settlementRouterFor(cfg,lanes,latestNumber);"
assert s.count(old)==1, s.count(old)
s=s.replace(old,new,1)

p.write_text(s)
