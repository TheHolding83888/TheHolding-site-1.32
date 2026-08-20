import { decodeChainlinkRoundData, decodeUint256, isRetryableRpcError } from './onchain-price-resolver-core.mjs';
import { resolveCurveEmaPrices } from './onchain-curve-ema.mjs';

export const CURVE_EMA_CHAINLINK_QUOTE_ROUTE_TYPE = 'curve-ema-chainlink-quote';
const RPC_TIMEOUT_MS = 10_000;
const DECIMALS_SELECTOR = '0x313ce567';
const LATEST_ROUND_DATA_SELECTOR = '0xfeaf968c';

function finite(value){ const n=Number(value); return Number.isFinite(n)?n:null; }
function statusRank(status){
  if(status==='shadow-ok')return 'ok';
  if(['divergent','dependency-warning'].includes(status))return 'warning';
  return 'unavailable';
}
async function postBatch(endpoint,payload,fetchImpl){
  const response=await fetchImpl(endpoint.url,{method:'POST',headers:{'content-type':'application/json',accept:'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(RPC_TIMEOUT_MS)});
  if(!response.ok)throw new Error(`RPC HTTP ${response.status}`);
  const body=await response.json();
  if(!Array.isArray(body))throw new Error('RPC batch response is not an array');
  const byId=new Map(body.map(row=>[Number(row?.id),row]));
  for(const request of payload)if(!byId.has(request.id))throw new Error(`RPC result ${request.id} missing`);
  const retryable=payload.map(request=>byId.get(request.id)).filter(row=>row?.error&&isRetryableRpcError(row.error));
  if(retryable.length)throw new Error(`Retryable RPC endpoint error: ${[...new Set(retryable.map(row=>String(row.error?.message||'retryable RPC error')))].join(' | ')}`);
  return byId;
}
async function withFailover(network,payload,fetchImpl){
  const attempts=[];
  for(const endpoint of network?.rpcFailover||[]){
    try{return {byId:await postBatch(endpoint,payload,fetchImpl),endpointId:endpoint.id,attempts};}
    catch(error){attempts.push({endpointId:endpoint.id,error:error instanceof Error?error.message:String(error)});}
  }
  throw new Error(`All public RPC endpoints failed: ${attempts.map(x=>`${x.endpointId}:${x.error}`).join(' | ')}`);
}
function failure(entry,network,status,error,extra={}){
  return {assetId:entry.assetId,symbol:entry.asset.symbol||null,usd:null,status,authority:'shadow',source:CURVE_EMA_CHAINLINK_QUOTE_ROUTE_TYPE,network:entry.route.network,chainId:network?.chainId??null,pool:entry.route.pool,token:entry.route.token,quoteToken:entry.route.quoteToken,quoteFeedContract:entry.route.quoteFeed?.contract||null,error,productionPriceAuthority:false,...extra};
}

export async function resolveCurveEmaChainlinkQuotePrices({registry,marketData,fetchImpl=fetch,nowMs=Date.now()}){
  const entries=Object.entries(registry.assets||{}).filter(([,asset])=>asset?.route?.type===CURVE_EMA_CHAINLINK_QUOTE_ROUTE_TYPE).map(([assetId,asset])=>({assetId,asset,route:asset.route}));
  const grouped=new Map();
  for(const entry of entries){
    if(entry.route?.quoteFeed?.type!=='chainlink-v3')throw new Error(`${entry.assetId}: quoteFeed.type must be chainlink-v3`);
    if(entry.route?.quoteFeed?.quote!=='USD')throw new Error(`${entry.assetId}: quoteFeed.quote must be USD`);
    if(!entry.route?.quoteAssetId)throw new Error(`${entry.assetId}: quoteAssetId missing`);
    if(!grouped.has(entry.route.network))grouped.set(entry.route.network,[]);
    grouped.get(entry.route.network).push(entry);
  }

  const dependencyObservations={};
  const dependencyByAsset={};
  const dependencyNetworks={};
  const eligibleAssets={};
  const preflightFailures={};
  let dependencyHttpRequests=0;

  for(const [networkId,rows] of grouped.entries()){
    const network=registry.networks?.[networkId];
    if(!network){for(const entry of rows)preflightFailures[entry.assetId]=failure(entry,null,'network-unavailable',`Network ${networkId} missing`);continue;}
    const payload=[{jsonrpc:'2.0',id:1,method:'eth_blockNumber',params:[]}];
    const ids=new Map(); let nextId=15000;
    for(const entry of rows){
      const rowIds={decimals:nextId++,round:nextId++}; ids.set(entry.assetId,rowIds);
      payload.push(
        {jsonrpc:'2.0',id:rowIds.decimals,method:'eth_call',params:[{to:entry.route.quoteFeed.contract,data:DECIMALS_SELECTOR},'latest']},
        {jsonrpc:'2.0',id:rowIds.round,method:'eth_call',params:[{to:entry.route.quoteFeed.contract,data:LATEST_ROUND_DATA_SELECTOR},'latest']}
      );
    }
    try{
      const result=await withFailover(network,payload,async(...args)=>{dependencyHttpRequests+=1;return fetchImpl(...args);});
      const blockRow=result.byId.get(1); if(blockRow?.error||!blockRow?.result)throw new Error(blockRow?.error?.message||'Block result missing');
      const blockNumber=Number(BigInt(blockRow.result));
      dependencyNetworks[networkId]={chainId:network.chainId,rpcEndpointId:result.endpointId,blockNumber,paidRpcRequired:false,routeCount:rows.length,batchCallCount:payload.length,httpBatchRequestCount:result.attempts.length+1,rpcFailoverAttempts:result.attempts.length,chainlinkCurveQuoteDependencyBatch:true};
      for(const entry of rows){
        const rowIds=ids.get(entry.assetId),decRow=result.byId.get(rowIds.decimals),roundRow=result.byId.get(rowIds.round);
        if(decRow?.error||!decRow?.result||roundRow?.error||!roundRow?.result){preflightFailures[entry.assetId]=failure(entry,network,'quote-dependency-rpc-error',decRow?.error?.message||roundRow?.error?.message||'Chainlink quote result missing',{rpcEndpointId:result.endpointId,blockNumber});continue;}
        try{
          const decimals=Number(decodeUint256(decRow.result)); const round=decodeChainlinkRoundData(roundRow.result);
          const answer=Number(round.answer)/10**decimals; const updatedAtSeconds=Number(round.updatedAt); const age=Math.max(0,Math.floor(nowMs/1000)-updatedAtSeconds); const maxAge=Number(entry.route.quoteFeed.maxAgeSeconds||0);
          if(!Number.isInteger(decimals)||decimals<0||decimals>36||!(answer>0)||!(updatedAtSeconds>0)||round.answeredInRound<round.roundId){preflightFailures[entry.assetId]=failure(entry,network,'invalid-quote-feed','Chainlink quote feed round invalid',{rpcEndpointId:result.endpointId,blockNumber,quoteFeedAgeSeconds:age});continue;}
          if(!(maxAge>0)||age>maxAge){preflightFailures[entry.assetId]=failure(entry,network,'stale-quote-feed',`Chainlink quote feed stale: ${age}s > ${maxAge}s`,{rpcEndpointId:result.endpointId,blockNumber,quoteFeedAgeSeconds:age,quoteFeedUpdatedAt:new Date(updatedAtSeconds*1000).toISOString()});continue;}
          const dependency={assetId:entry.route.quoteAssetId,symbol:entry.route.feedQuote||null,usd:answer,status:'shadow-ok',authority:'shadow',source:'chainlink-v3-quote-dependency',network:networkId,chainId:network.chainId,contract:entry.route.quoteFeed.contract,decimals,feedAgeSeconds:age,maxAgeSeconds:maxAge,updatedAt:new Date(updatedAtSeconds*1000).toISOString(),productionPriceAuthority:false};
          dependencyByAsset[entry.assetId]=dependency; dependencyObservations[entry.route.quoteAssetId]=dependency;
          eligibleAssets[entry.assetId]={...entry.asset,route:{...entry.route,type:'curve-ema-relative'}};
        }catch(error){preflightFailures[entry.assetId]=failure(entry,network,'quote-dependency-decode-error',error instanceof Error?error.message:String(error),{rpcEndpointId:result.endpointId,blockNumber});}
      }
    }catch(error){for(const entry of rows)preflightFailures[entry.assetId]=failure(entry,network,'quote-dependency-rpc-unavailable',error instanceof Error?error.message:String(error));}
  }

  let curve={observations:{},networks:{},coverage:{assetCount:0,okCount:0,warningCount:0,unavailableCount:0},rpcEfficiency:{networkCount:0,routeCount:0,httpBatchRequestCount:0}};
  if(Object.keys(eligibleAssets).length)curve=await resolveCurveEmaPrices({registry:{...registry,assets:eligibleAssets},marketData,coreObservations:dependencyObservations,fetchImpl});

  const observations={...preflightFailures};
  for(const [assetId,obs] of Object.entries(curve.observations||{})){
    const original=registry.assets?.[assetId]?.route; const dependency=dependencyByAsset[assetId];
    observations[assetId]={...obs,source:CURVE_EMA_CHAINLINK_QUOTE_ROUTE_TYPE,quoteFeedContract:original?.quoteFeed?.contract||null,quoteFeedUsd:finite(dependency?.usd),quoteFeedAgeSeconds:dependency?.feedAgeSeconds??null,quoteDependencySource:dependency?.source||null,composition:`Curve price_oracle() EMA × same-cycle Chainlink ${original?.feedQuote||'quote'}/USD`,productionPriceAuthority:false};
  }

  let okCount=0,warningCount=0,unavailableCount=0;
  for(const observation of Object.values(observations)){const rank=statusRank(observation.status);if(rank==='ok')okCount+=1;else if(rank==='warning')warningCount+=1;else unavailableCount+=1;}
  const networks={...(curve.networks||{})};
  for(const [networkId,dep] of Object.entries(dependencyNetworks)){
    const base=networks[networkId];
    networks[networkId]=base?{...base,routeCount:Number(base.routeCount||0)+Number(dep.routeCount||0),batchCallCount:Number(base.batchCallCount||0)+Number(dep.batchCallCount||0),httpBatchRequestCount:Number(base.httpBatchRequestCount||0)+Number(dep.httpBatchRequestCount||0),rpcFailoverAttempts:Number(base.rpcFailoverAttempts||0)+Number(dep.rpcFailoverAttempts||0),chainlinkCurveQuoteDependencyRouteCount:dep.routeCount,chainlinkCurveQuoteDependencyEndpointId:dep.rpcEndpointId}:dep;
  }
  return {observations,networks,coverage:{assetCount:entries.length,okCount,warningCount,unavailableCount},rpcEfficiency:{networkCount:new Set([...Object.keys(curve.networks||{}),...Object.keys(dependencyNetworks)]).size,routeCount:entries.length,httpBatchRequestCount:Number(curve.rpcEfficiency?.httpBatchRequestCount||0)+dependencyHttpRequests}};
}
