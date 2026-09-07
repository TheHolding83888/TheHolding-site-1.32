#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { Interface } from 'ethers';
import { decodeChainlinkRoundData, decodeUint256 } from '../intelligence/market-data/onchain-price-resolver-core.mjs';

const __filename=fileURLToPath(import.meta.url);
const __dirname=path.dirname(__filename);
const ROOT=path.resolve(__dirname,'..');

export const VERSION='0.2-historical-canonical-market-or-exact-chainlink-price';
export const CANONICAL_MARKET_DATA_REPO_PATH='intelligence/market-data/market-data.json';
export const MARKET_DATA_SCHEDULER_REPO_PATH='intelligence/market-data/market-data-scheduler-contract.json';
export const ONCHAIN_PRICE_REGISTRY_REPO_PATH='intelligence/market-data/onchain-price-source-registry.json';
export const HISTORICAL_TOKEN_ASSET_IDS=Object.freeze({
  '0x940181a94a35a4569e4529a3cdfb74e38fd98631':'aerodrome-finance',
  '0x9560e827af36c94d2ac33a39bce1fe78631088db':'velodrome-finance',
  // Canonical chain wrappers reuse the historical USD authority of their
  // underlying canonical asset. This is an identity alias only: it does not
  // create a price, use a current quote, or grant reward/accounting authority.
  '0x4200000000000000000000000000000000000006':'ethereum',
  '0x68f180fcce6836688e9084f035309e29bf0a2095':'bitcoin'
});

// Narrow historical-accounting routes for reward assets that were not yet part
// of the canonical Market Data snapshot at the original month boundary. Each
// route is read-only, pinned to the exact ve33 closing block already proven by
// the factual accrual event, and uses the Chainlink proxy deployed on the same
// Optimism chain. No stablecoin peg, current quote, or Reference APR is used.
export const HISTORICAL_OPTIMISM_CHAINLINK_TOKEN_FEEDS=Object.freeze({
  '0x0b2c639c533813f4aa9d7837caf62653d097ff85':Object.freeze({
    assetId:'usd-coin',symbol:'USDC',chainId:10,
    contract:'0x16a9FA2FDa030272Ce99B29CF780dFA30361E0f3',maxAgeSeconds:90000
  }),
  '0x4200000000000000000000000000000000000042':Object.freeze({
    assetId:'optimism',symbol:'OP',chainId:10,
    contract:'0x0D276FC14719f9292D5C1eA2198673d1f4269246',maxAgeSeconds:7200
  }),
  '0x94b008aa00579c1307b0ef2c499ad98a8ce58e58':Object.freeze({
    assetId:'tether',symbol:'USDT',chainId:10,
    contract:'0xECef79E109e997bCA29c1c0897ec9d7b03647F5E',maxAgeSeconds:90000
  }),
  '0x1f32b1c2345538c0c6f582fcb022739c4a194ebb':Object.freeze({
    assetId:'wrapped-steth',symbol:'wstETH',chainId:10,
    contract:'0x698B585CbC4407e2D54aa898B2600B53C68958f7',maxAgeSeconds:90000
  })
});

// A reusable exact-block route for assets without a direct USD oracle. The
// token is first quoted through a proven historical Velodrome V2 pool and that
// quote token is then valued by its exact-block Chainlink feed. This is not a
// stablecoin peg assumption: both legs are observed onchain at the same proven
// ve33 closing block. The msUSD route is intentionally explicit because msUSD
// has traded away from $1 and therefore must never be valued at a fixed peg.
export const HISTORICAL_OPTIMISM_VELODROME_TWAP_TOKEN_ROUTES=Object.freeze({
  '0x9dabae7274d28a45f0b65bf8ed201a5731492ca0':Object.freeze({
    assetId:'metronome-synth-usd',symbol:'msUSD',chainId:10,
    token:'0x9dAbAE7274D28A45F0B65Bf8ED201A5731492ca0',tokenDecimals:18,
    pool:'0xe07388b2a7bb29d3Ad8989e1074Bd00Bd0d3C43d',poolStable:true,
    quoteToken:'0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',quoteTokenSymbol:'USDC',quoteTokenDecimals:6,
    quoteChainlinkFeed:'0x16a9FA2FDa030272Ce99B29CF780dFA30361E0f3',
    twapGranularity:48
  })
});

const VELODROME_POOL_IFACE=new Interface([
  'function token0() view returns (address)',
  'function token1() view returns (address)',
  'function stable() view returns (bool)',
  'function observationLength() view returns (uint256)',
  'function quote(address tokenIn,uint256 amountIn,uint256 granularity) view returns (uint256 amountOut)'
]);
const lower=v=>String(v||'').toLowerCase();
const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
const RPC_TIMEOUT_MS=10_000;
const MAX_BOUNDARY_BLOCK_LAG_SECONDS=120;

export function canonicalAssetIdForHistoricalToken(token){
  return HISTORICAL_TOKEN_ASSET_IDS[lower(token)]||null;
}

export function historicalOptimismChainlinkRouteForToken(token){
  return HISTORICAL_OPTIMISM_CHAINLINK_TOKEN_FEEDS[lower(token)]||null;
}

export function historicalOptimismVelodromeTwapRouteForToken(token){
  return HISTORICAL_OPTIMISM_VELODROME_TWAP_TOKEN_ROUTES[lower(token)]||null;
}

export function closingBlockFromVe33Identity({eventKey,sourceIdentity}={}){
  const eventMatch=String(eventKey||'').match(/:(\d+):(\d+)$/);
  if(eventMatch){
    const n=Number(eventMatch[2]);
    return Number.isSafeInteger(n)&&n>0?n:null;
  }
  const sourceMatch=String(sourceIdentity||'').match(/\|(\d+)->[^\n]*\|(\d+)$/);
  if(sourceMatch){
    const n=Number(sourceMatch[2]);
    return Number.isSafeInteger(n)&&n>0?n:null;
  }
  return null;
}

export function selectHistoricalCanonicalPrice({snapshot,token,boundaryAt,maxAgeMinutes}){
  const assetId=canonicalAssetIdForHistoricalToken(token);
  if(!assetId)return{ok:false,status:'token-not-canonical-market-data-mapped',assetId:null};

  const boundaryMs=Date.parse(boundaryAt||'');
  if(!Number.isFinite(boundaryMs))return{ok:false,status:'invalid-accounting-boundary',assetId};
  if(!(finite(maxAgeMinutes)&&Number(maxAgeMinutes)>=0))return{ok:false,status:'invalid-market-data-freshness-contract',assetId};

  const row=snapshot?.prices?.[assetId];
  if(!row)return{ok:false,status:'canonical-asset-missing-from-snapshot',assetId};
  if(!['fresh','stale-fallback'].includes(String(row.status||'')))return{ok:false,status:'canonical-price-status-not-usable',assetId,priceStatus:row.status||null};
  if(!(finite(row.usd)&&Number(row.usd)>0))return{ok:false,status:'canonical-price-not-finite-positive',assetId};

  const observedAt=row.observedAt||snapshot?.observedAt||snapshot?.generatedAt||null;
  const observedMs=Date.parse(observedAt||'');
  if(!Number.isFinite(observedMs))return{ok:false,status:'canonical-price-observation-time-missing',assetId};
  if(observedMs>boundaryMs)return{ok:false,status:'canonical-price-observed-after-accounting-boundary',assetId,observedAt};

  const ageMinutes=(boundaryMs-observedMs)/60_000;
  if(ageMinutes>Number(maxAgeMinutes))return{
    ok:false,status:'canonical-price-too-old-for-accounting-boundary',assetId,observedAt,
    ageMinutes:Number(ageMinutes.toFixed(6)),maxAgeMinutes:Number(maxAgeMinutes)
  };

  return{
    ok:true,status:'historical-canonical-market-price',assetId,priceUsd:Number(row.usd),
    observedAt,ageMinutes:Number(ageMinutes.toFixed(6)),maxAgeMinutes:Number(maxAgeMinutes),
    priceStatus:row.status,providerId:row.providerId||null,priceSource:row.source||null,
    snapshotGeneratedAt:snapshot?.generatedAt||null,snapshotObservedAt:snapshot?.observedAt||null,
    snapshotVersion:snapshot?.version||null
  };
}

function defaultGitRun(args,{root=ROOT}={}){
  return execFileSync('git',args,{cwd:root,encoding:'utf8',maxBuffer:2*1024*1024,stdio:['ignore','pipe','pipe']});
}

async function readSchedulerContract(root=ROOT){
  const file=path.join(root,MARKET_DATA_SCHEDULER_REPO_PATH);
  return JSON.parse(await fs.readFile(file,'utf8'));
}

async function readOnchainPriceRegistry(root=ROOT){
  const file=path.join(root,ONCHAIN_PRICE_REGISTRY_REPO_PATH);
  return JSON.parse(await fs.readFile(file,'utf8'));
}

function hexQuantity(value){
  const n=BigInt(value);
  if(n<0n)throw new Error('negative RPC quantity');
  return`0x${n.toString(16)}`;
}

export async function defaultHistoricalRpcCall({endpoint,method,params,fetchImpl=fetch}={}){
  const url=typeof endpoint==='string'?endpoint:endpoint?.url;
  if(!url)throw new Error('historical RPC endpoint missing');
  const response=await fetchImpl(url,{
    method:'POST',headers:{'content-type':'application/json',accept:'application/json'},
    body:JSON.stringify({jsonrpc:'2.0',id:1,method,params}),
    signal:AbortSignal.timeout(RPC_TIMEOUT_MS)
  });
  if(!response.ok)throw new Error(`historical RPC HTTP ${response.status}`);
  const body=await response.json();
  if(body?.error)throw new Error(body.error?.message||'historical RPC error');
  if(body?.result===undefined||body?.result===null)throw new Error(`historical RPC ${method} result missing`);
  return body.result;
}

export async function historicalOptimismChainlinkPriceAtBoundary({
  token,boundaryAt,eventKey=null,sourceIdentity=null,root=ROOT,onchainRegistry=null,
  rpcCall=defaultHistoricalRpcCall,fetchImpl=fetch
}={}){
  const route=historicalOptimismChainlinkRouteForToken(token);
  if(!route)return{ok:false,status:'token-not-historical-chainlink-mapped',assetId:null};
  const boundaryMs=Date.parse(boundaryAt||'');
  if(!Number.isFinite(boundaryMs))return{ok:false,status:'invalid-accounting-boundary',assetId:route.assetId};
  const sourceBlockNumber=closingBlockFromVe33Identity({eventKey,sourceIdentity});
  if(!sourceBlockNumber)return{ok:false,status:'ve33-closing-block-proof-missing',assetId:route.assetId};

  let registry=onchainRegistry;
  try{if(!registry)registry=await readOnchainPriceRegistry(root);}catch(error){
    return{ok:false,status:'onchain-price-registry-unavailable',assetId:route.assetId,error:error?.message||String(error)};
  }
  const network=registry?.networks?.optimism;
  if(Number(network?.chainId)!==route.chainId||!Array.isArray(network?.rpcFailover)||!network.rpcFailover.length){
    return{ok:false,status:'optimism-historical-rpc-fabric-unavailable',assetId:route.assetId};
  }

  const blockTag=hexQuantity(sourceBlockNumber),attempts=[];
  for(const endpoint of network.rpcFailover){
    try{
      const block=await rpcCall({endpoint,method:'eth_getBlockByNumber',params:[blockTag,false],fetchImpl});
      if(lower(block?.number)!==lower(blockTag))return{ok:false,status:'ve33-closing-block-rpc-mismatch',assetId:route.assetId,sourceBlockNumber};
      const blockTimestampSeconds=Number(BigInt(block?.timestamp||'0x0'));
      const blockTimestampMs=blockTimestampSeconds*1000;
      if(!(Number.isFinite(blockTimestampMs)&&blockTimestampMs>0))return{ok:false,status:'historical-chainlink-block-time-invalid',assetId:route.assetId,sourceBlockNumber};
      if(blockTimestampMs>boundaryMs)return{ok:false,status:'historical-chainlink-block-after-accounting-boundary',assetId:route.assetId,sourceBlockNumber};
      const boundaryLagSeconds=(boundaryMs-blockTimestampMs)/1000;
      if(boundaryLagSeconds>MAX_BOUNDARY_BLOCK_LAG_SECONDS)return{
        ok:false,status:'historical-chainlink-block-too-far-from-accounting-boundary',assetId:route.assetId,
        sourceBlockNumber,boundaryLagSeconds:Number(boundaryLagSeconds.toFixed(3))
      };

      const[decimalsHex,roundHex]=await Promise.all([
        rpcCall({endpoint,method:'eth_call',params:[{to:route.contract,data:'0x313ce567'},blockTag],fetchImpl}),
        rpcCall({endpoint,method:'eth_call',params:[{to:route.contract,data:'0xfeaf968c'},blockTag],fetchImpl})
      ]);
      const decimals=Number(decodeUint256(decimalsHex));
      if(!Number.isInteger(decimals)||decimals<0||decimals>36)return{ok:false,status:'historical-chainlink-decimals-invalid',assetId:route.assetId,sourceBlockNumber};
      const round=decodeChainlinkRoundData(roundHex);
      if(!(round.answer>0n)||round.roundId<=0n||round.answeredInRound<round.roundId){
        return{ok:false,status:'historical-chainlink-round-integrity-invalid',assetId:route.assetId,sourceBlockNumber};
      }
      const updatedAtSeconds=Number(round.updatedAt);
      const observedAtMs=updatedAtSeconds*1000;
      if(!(Number.isFinite(observedAtMs)&&observedAtMs>0)||observedAtMs>blockTimestampMs||observedAtMs>boundaryMs){
        return{ok:false,status:'historical-chainlink-observation-time-invalid',assetId:route.assetId,sourceBlockNumber};
      }
      const ageSeconds=(boundaryMs-observedAtMs)/1000;
      if(ageSeconds>Number(route.maxAgeSeconds))return{
        ok:false,status:'historical-onchain-chainlink-price-stale',assetId:route.assetId,sourceBlockNumber,
        observedAt:new Date(observedAtMs).toISOString(),ageSeconds:Number(ageSeconds.toFixed(3)),maxAgeSeconds:route.maxAgeSeconds
      };
      const priceUsd=Number(round.answer)/10**decimals;
      if(!(Number.isFinite(priceUsd)&&priceUsd>0))return{ok:false,status:'historical-chainlink-price-not-finite-positive',assetId:route.assetId,sourceBlockNumber};

      return{
        ok:true,status:'historical-onchain-chainlink-price',sourceFamily:'historical-onchain-chainlink-at-boundary',
        assetId:route.assetId,symbol:route.symbol,priceUsd,
        observedAt:new Date(observedAtMs).toISOString(),ageMinutes:Number((ageSeconds/60).toFixed(6)),
        maxAgeMinutes:Number((route.maxAgeSeconds/60).toFixed(6)),chainId:route.chainId,
        sourceBlockNumber,sourceBlockTimestamp:new Date(blockTimestampMs).toISOString(),
        sourceContract:route.contract,roundId:round.roundId.toString(),answeredInRound:round.answeredInRound.toString(),
        rpcEndpointId:endpoint?.id||null,
        sourceFile:'reporting/historical-canonical-price.mjs#HISTORICAL_OPTIMISM_CHAINLINK_TOKEN_FEEDS',
        priceSource:'onchain-chainlink-v3-exact-historical-block',
        exactHistoricalBlock:true,currentPriceUsed:false,referenceAprUsed:false,executionAuthority:'none'
      };
    }catch(error){
      attempts.push({endpointId:endpoint?.id||null,error:error?.message||String(error)});
    }
  }
  return{ok:false,status:'historical-onchain-chainlink-rpc-unavailable',assetId:route.assetId,sourceBlockNumber,attempts};
}

export async function historicalOptimismVelodromeTwapPriceAtBoundary({
  token,boundaryAt,eventKey=null,sourceIdentity=null,root=ROOT,onchainRegistry=null,
  rpcCall=defaultHistoricalRpcCall,fetchImpl=fetch
}={}){
  const route=historicalOptimismVelodromeTwapRouteForToken(token);
  if(!route)return{ok:false,status:'token-not-historical-velodrome-twap-mapped',assetId:null};
  const boundaryMs=Date.parse(boundaryAt||'');
  if(!Number.isFinite(boundaryMs))return{ok:false,status:'invalid-accounting-boundary',assetId:route.assetId};
  const sourceBlockNumber=closingBlockFromVe33Identity({eventKey,sourceIdentity});
  if(!sourceBlockNumber)return{ok:false,status:'ve33-closing-block-proof-missing',assetId:route.assetId};

  let registry=onchainRegistry;
  try{if(!registry)registry=await readOnchainPriceRegistry(root);}catch(error){
    return{ok:false,status:'onchain-price-registry-unavailable',assetId:route.assetId,error:error?.message||String(error)};
  }
  const network=registry?.networks?.optimism;
  if(Number(network?.chainId)!==route.chainId||!Array.isArray(network?.rpcFailover)||!network.rpcFailover.length){
    return{ok:false,status:'optimism-historical-rpc-fabric-unavailable',assetId:route.assetId};
  }

  const blockTag=hexQuantity(sourceBlockNumber),attempts=[];
  const amountIn=10n**BigInt(route.tokenDecimals);
  const callData={
    token0:VELODROME_POOL_IFACE.encodeFunctionData('token0'),
    token1:VELODROME_POOL_IFACE.encodeFunctionData('token1'),
    stable:VELODROME_POOL_IFACE.encodeFunctionData('stable'),
    observationLength:VELODROME_POOL_IFACE.encodeFunctionData('observationLength'),
    quote:VELODROME_POOL_IFACE.encodeFunctionData('quote',[route.token,amountIn,route.twapGranularity])
  };

  for(const endpoint of network.rpcFailover){
    try{
      const block=await rpcCall({endpoint,method:'eth_getBlockByNumber',params:[blockTag,false],fetchImpl});
      if(lower(block?.number)!==lower(blockTag))return{ok:false,status:'ve33-closing-block-rpc-mismatch',assetId:route.assetId,sourceBlockNumber};
      const blockTimestampSeconds=Number(BigInt(block?.timestamp||'0x0'));
      const blockTimestampMs=blockTimestampSeconds*1000;
      if(!(Number.isFinite(blockTimestampMs)&&blockTimestampMs>0))return{ok:false,status:'historical-velodrome-block-time-invalid',assetId:route.assetId,sourceBlockNumber};
      if(blockTimestampMs>boundaryMs)return{ok:false,status:'historical-velodrome-block-after-accounting-boundary',assetId:route.assetId,sourceBlockNumber};
      const boundaryLagSeconds=(boundaryMs-blockTimestampMs)/1000;
      if(boundaryLagSeconds>MAX_BOUNDARY_BLOCK_LAG_SECONDS)return{
        ok:false,status:'historical-velodrome-block-too-far-from-accounting-boundary',assetId:route.assetId,
        sourceBlockNumber,boundaryLagSeconds:Number(boundaryLagSeconds.toFixed(3))
      };

      const[token0Hex,token1Hex,stableHex,observationLengthHex,quoteHex]=await Promise.all([
        rpcCall({endpoint,method:'eth_call',params:[{to:route.pool,data:callData.token0},blockTag],fetchImpl}),
        rpcCall({endpoint,method:'eth_call',params:[{to:route.pool,data:callData.token1},blockTag],fetchImpl}),
        rpcCall({endpoint,method:'eth_call',params:[{to:route.pool,data:callData.stable},blockTag],fetchImpl}),
        rpcCall({endpoint,method:'eth_call',params:[{to:route.pool,data:callData.observationLength},blockTag],fetchImpl}),
        rpcCall({endpoint,method:'eth_call',params:[{to:route.pool,data:callData.quote},blockTag],fetchImpl})
      ]);
      const token0=String(VELODROME_POOL_IFACE.decodeFunctionResult('token0',token0Hex)[0]);
      const token1=String(VELODROME_POOL_IFACE.decodeFunctionResult('token1',token1Hex)[0]);
      const stable=Boolean(VELODROME_POOL_IFACE.decodeFunctionResult('stable',stableHex)[0]);
      const observationLength=Number(VELODROME_POOL_IFACE.decodeFunctionResult('observationLength',observationLengthHex)[0]);
      const quoteAmountOutRaw=BigInt(VELODROME_POOL_IFACE.decodeFunctionResult('quote',quoteHex)[0]);
      const pair=new Set([lower(token0),lower(token1)]);
      if(pair.size!==2||!pair.has(lower(route.token))||!pair.has(lower(route.quoteToken))){
        return{ok:false,status:'historical-velodrome-pool-token-identity-mismatch',assetId:route.assetId,sourceBlockNumber};
      }
      if(stable!==route.poolStable)return{ok:false,status:'historical-velodrome-pool-stable-identity-mismatch',assetId:route.assetId,sourceBlockNumber};
      if(!Number.isSafeInteger(observationLength)||observationLength<=Number(route.twapGranularity)){
        return{ok:false,status:'historical-velodrome-observation-history-insufficient',assetId:route.assetId,sourceBlockNumber,observationLength,twapGranularity:route.twapGranularity};
      }
      if(quoteAmountOutRaw<=0n)return{ok:false,status:'historical-velodrome-twap-quote-not-positive',assetId:route.assetId,sourceBlockNumber};

      const quoteUsd=await historicalOptimismChainlinkPriceAtBoundary({
        token:route.quoteToken,boundaryAt,eventKey,sourceIdentity,root,onchainRegistry:registry,rpcCall,fetchImpl
      });
      if(quoteUsd?.ok!==true)return{
        ok:false,status:'historical-velodrome-quote-token-usd-unavailable',assetId:route.assetId,sourceBlockNumber,
        quoteStatus:quoteUsd?.status||null,quoteAssetId:quoteUsd?.assetId||null
      };
      if(lower(quoteUsd.sourceContract)!==lower(route.quoteChainlinkFeed)||Number(quoteUsd.sourceBlockNumber)!==sourceBlockNumber){
        return{ok:false,status:'historical-velodrome-quote-token-proof-mismatch',assetId:route.assetId,sourceBlockNumber};
      }
      const quoteTokenAmount=Number(quoteAmountOutRaw)/10**Number(route.quoteTokenDecimals);
      const priceUsd=quoteTokenAmount*Number(quoteUsd.priceUsd);
      if(!(Number.isFinite(priceUsd)&&priceUsd>0))return{ok:false,status:'historical-velodrome-derived-price-not-finite-positive',assetId:route.assetId,sourceBlockNumber};

      return{
        ok:true,status:'historical-onchain-velodrome-twap-chainlink-price',
        sourceFamily:'historical-onchain-velodrome-twap-chainlink-at-boundary',
        assetId:route.assetId,symbol:route.symbol,priceUsd,
        observedAt:quoteUsd.observedAt,ageMinutes:quoteUsd.ageMinutes,maxAgeMinutes:quoteUsd.maxAgeMinutes,
        chainId:route.chainId,sourceBlockNumber,sourceBlockTimestamp:new Date(blockTimestampMs).toISOString(),
        sourceContract:route.pool,rpcEndpointId:endpoint?.id||null,exactHistoricalBlock:true,
        quoteToken:route.quoteToken,quoteTokenSymbol:route.quoteTokenSymbol,
        quoteAmountOutRaw:quoteAmountOutRaw.toString(),quoteTokenAmount,
        twapGranularity:route.twapGranularity,observationLength,poolStable:stable,
        quoteChainlinkContract:quoteUsd.sourceContract,quoteRoundId:quoteUsd.roundId,
        quoteAnsweredInRound:quoteUsd.answeredInRound,quoteObservedAt:quoteUsd.observedAt,
        quotePriceUsd:quoteUsd.priceUsd,
        sourceFile:'reporting/historical-canonical-price.mjs#HISTORICAL_OPTIMISM_VELODROME_TWAP_TOKEN_ROUTES',
        priceSource:'onchain-velodrome-v2-twap-plus-chainlink-quote-exact-historical-block',
        stablecoinPegAssumptionUsed:false,currentPriceUsed:false,referenceAprUsed:false,executionAuthority:'none'
      };
    }catch(error){
      attempts.push({endpointId:endpoint?.id||null,error:error?.message||String(error)});
    }
  }
  return{ok:false,status:'historical-onchain-velodrome-twap-rpc-unavailable',assetId:route.assetId,sourceBlockNumber,attempts};
}

export async function historicalCanonicalPriceAtBoundary({
  token,boundaryAt,eventKey=null,sourceIdentity=null,root=ROOT,gitRun=defaultGitRun,schedulerContract=null,maxHistoryCommits=96,
  onchainRegistry=null,rpcCall=defaultHistoricalRpcCall,fetchImpl=fetch
}={}){
  const assetId=canonicalAssetIdForHistoricalToken(token);
  if(!assetId){
    if(historicalOptimismChainlinkRouteForToken(token))return historicalOptimismChainlinkPriceAtBoundary({
      token,boundaryAt,eventKey,sourceIdentity,root,onchainRegistry,rpcCall,fetchImpl
    });
    if(historicalOptimismVelodromeTwapRouteForToken(token))return historicalOptimismVelodromeTwapPriceAtBoundary({
      token,boundaryAt,eventKey,sourceIdentity,root,onchainRegistry,rpcCall,fetchImpl
    });
    return{ok:false,status:'token-not-canonical-market-data-mapped',assetId:null};
  }

  let scheduler=schedulerContract;
  try{if(!scheduler)scheduler=await readSchedulerContract(root);}catch(error){
    return{ok:false,status:'market-data-scheduler-contract-unavailable',assetId,error:error?.message||String(error)};
  }
  const maxAgeMinutes=Number(scheduler?.scheduledRefreshAdmissionAgeMinutes);
  if(!(Number.isFinite(maxAgeMinutes)&&maxAgeMinutes>=0))return{ok:false,status:'invalid-market-data-freshness-contract',assetId};

  let commits=[];
  try{
    const raw=gitRun(['log','--format=%H',`--before=${boundaryAt}`,'HEAD','--',CANONICAL_MARKET_DATA_REPO_PATH],{root});
    commits=String(raw||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean).slice(0,Math.max(1,Number(maxHistoryCommits)||96));
  }catch(error){
    return{ok:false,status:'canonical-market-data-git-history-unavailable',assetId,error:error?.message||String(error)};
  }
  if(!commits.length)return{ok:false,status:'canonical-market-data-git-history-empty',assetId};

  let best=null,lastFailure=null;
  for(const commitSha of commits){
    try{
      const raw=gitRun(['show',`${commitSha}:${CANONICAL_MARKET_DATA_REPO_PATH}`],{root});
      const snapshot=JSON.parse(String(raw));
      const selected=selectHistoricalCanonicalPrice({snapshot,token,boundaryAt,maxAgeMinutes});
      if(selected.ok){
        if(!best||Date.parse(selected.observedAt)>Date.parse(best.observedAt))best={...selected,commitSha,sourceFile:CANONICAL_MARKET_DATA_REPO_PATH,sourceFamily:'canonical-market-data-git-history'};
      }else lastFailure={...selected,commitSha};
    }catch(error){lastFailure={ok:false,status:'canonical-market-data-history-snapshot-unreadable',assetId,commitSha,error:error?.message||String(error)};}
  }
  return best||lastFailure||{ok:false,status:'historical-canonical-price-unavailable',assetId};
}

async function main(){
  const token=process.argv[2],boundaryAt=process.argv[3],eventKey=process.argv[4]||null;
  if(!token||!boundaryAt)throw new Error('usage: historical-canonical-price.mjs <token> <boundaryAt> [ve33-event-key]');
  const result=await historicalCanonicalPriceAtBoundary({token,boundaryAt,eventKey});
  console.log(JSON.stringify(result,null,2));
  if(!result.ok)process.exitCode=2;
}

if(process.argv[1]&&path.resolve(process.argv[1])===__filename)main().catch(error=>{console.error(error);process.exitCode=1;});