#!/usr/bin/env node
/**
 * The Holding · Votium vlCVX → Curve Pool Economic Context v0.1
 *
 * Read-only downstream context over the already-proven Votium → Convex → Curve
 * executed gauge-flow artifact. Uses official Curve API surfaces to map gauges
 * to pools and attach current liquidity, 24h trading volume and base-yield
 * context. Current pool state is context, not proof that prior votes caused it.
 */
import fs from 'node:fs';
import crypto from 'node:crypto';

const UPSTREAM_FILE=process.env.VLCVX_VOTIUM_CURVE_GAUGE_FLOW_FILE||'intelligence/economic-graph/vlcvx-votium-curve-gauge-flow.json';
const OUTPUT_FILE=process.env.VLCVX_VOTIUM_CURVE_POOL_CONTEXT_FILE||'intelligence/economic-graph/vlcvx-votium-curve-pool-context.json';
const API_BASE='https://api.curve.finance/v1';
const ENDPOINTS={gauges:`${API_BASE}/getAllGauges`,pools:`${API_BASE}/getPools/all/ethereum`,volumes:`${API_BASE}/getVolumes/ethereum`};
const CURVE_API_REPOSITORY='curvefi/curve-api';
const CURVE_API_SOURCE_COMMIT='db3a08468efba830f69e43cfe99ea3f3715d2a5a';
const FETCH_TIMEOUT_MS=30000;
const FETCH_ATTEMPTS=4;

function readJson(file){return JSON.parse(fs.readFileSync(file,'utf8'));}
function readJsonOptional(file){try{const text=fs.readFileSync(file,'utf8');return text.trim()?JSON.parse(text):null;}catch(error){if(error?.code==='ENOENT')return null;throw error;}}
function sha256File(file){return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');}
function fail(message){throw new Error(message);}
function lc(value){return String(value||'').toLowerCase();}
function finiteOrNull(value){const n=Number(value);return Number.isFinite(n)?n:null;}
function round(value,digits=8){const n=Number(value);return Number.isFinite(n)?Number(n.toFixed(digits)):null;}
function safeDelta(a,b,digits=8){return Number.isFinite(Number(a))&&Number.isFinite(Number(b))?round(Number(a)-Number(b),digits):null;}
function unique(values){return [...new Set(values.filter(Boolean))];}

function requireUpstream(x){
  if(x?.version!=='0.1-vlcvx-votium-curve-gauge-flow')fail('Votium→Curve gauge-flow upstream version mismatch');
  if(x?.status!=='shadow-cross-protocol-flow-proven')fail(`Votium→Curve gauge-flow upstream unavailable: ${x?.status}`);
  if(x?.coverage?.complete!==true||Number(x.coverage.roundCount)!==2||Number(x.coverage.completeRoundCount)!==2)fail('Votium→Curve round coverage incomplete');
  if(Number(x.coverage.votiumGaugeCount)!==79||Number(x.coverage.curveExecutedVotiumGaugeCount)!==79)fail('Votium→Curve expected 79/79 gauge coverage missing');
  if(x?.authority?.executionAuthority!=='none'||x?.authority?.causalClaimAuthority!=='none'||x?.authority?.promotionAuthority!=='none')fail('Votium→Curve upstream authority drift');
}
async function fetchJson(url){
  let last=null;
  for(let attempt=1;attempt<=FETCH_ATTEMPTS;attempt++){
    const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),FETCH_TIMEOUT_MS);
    try{
      const response=await fetch(url,{headers:{accept:'application/json','user-agent':'TheHolding-Protocol-Economic-Intelligence/0.1'},signal:controller.signal});
      if(!response.ok)throw new Error(`${url} HTTP ${response.status}`);
      const payload=await response.json();clearTimeout(timer);return{payload,attempt};
    }catch(error){clearTimeout(timer);last=error;if(attempt<FETCH_ATTEMPTS)await new Promise(resolve=>setTimeout(resolve,750*attempt));}
  }
  throw last||new Error(`Curve API fetch failed: ${url}`);
}
function unwrap(payload){return payload?.data??payload;}
function gaugeRows(payload){
  const root=unwrap(payload),raw=root?.gauges??root;
  if(Array.isArray(raw))return raw.map(row=>({...row}));
  if(raw&&typeof raw==='object')return Object.entries(raw).filter(([,row])=>row&&typeof row==='object'&&!Array.isArray(row)).map(([key,row])=>({__mapKey:key,...row}));
  fail('Curve getAllGauges payload shape unsupported');
}
function poolRows(payload){const root=unwrap(payload),rows=root?.poolData??root?.pools??root;if(!Array.isArray(rows))fail('Curve getPools/all/ethereum payload shape unsupported');return rows;}
function volumeRows(payload){const root=unwrap(payload),rows=root?.pools??root?.poolData??root;if(!Array.isArray(rows))fail('Curve getVolumes/ethereum payload shape unsupported');return rows;}
function gaugeAddress(row){return[row?.gauge,row?.gaugeAddress,row?.address,row?.__mapKey].find(x=>/^0x[0-9a-f]{40}$/i.test(String(x||'')))||null;}
function poolAddressFromGauge(row){return[row?.poolAddress,row?.swap,row?.pool?.address,row?.swap_address].find(x=>/^0x[0-9a-f]{40}$/i.test(String(x||'')))||null;}
function poolAddress(row){return[row?.address,row?.poolAddress,row?.swap].find(x=>/^0x[0-9a-f]{40}$/i.test(String(x||'')))||null;}
function poolLiquidityUsd(row){for(const value of[row?.usdTotalExcludingBasePool,row?.usdTotal,row?.tvlUsd,row?.tvlUSD]){const n=finiteOrNull(value);if(n!==null&&n>=0)return n;}return null;}
function coinSymbols(row){const coins=Array.isArray(row?.coins)?row.coins:[];return unique(coins.map(c=>typeof c==='string'?c:(c?.symbol??c?.name??null)));}
function poolName(row,symbols){return row?.name??row?.symbol??row?.poolName??(symbols.length?symbols.join('/'):null);}
function priorPoolMap(previous){const map=new Map();if(!previous||!Array.isArray(previous.pools))return map;for(const row of previous.pools)if(/^0x[0-9a-f]{40}$/i.test(String(row?.poolAddress||'')))map.set(lc(row.poolAddress),row);return map;}

function buildContext({upstream,upstreamSha256,gaugesPayload,poolsPayload,volumesPayload,attempts,previous}){
  const allGauges=gaugeRows(gaugesPayload),allPools=poolRows(poolsPayload),allVolumes=volumeRows(volumesPayload);
  const gaugeMap=new Map();
  for(const row of allGauges){const address=gaugeAddress(row);if(!address)continue;const chain=lc(row?.blockchainId??row?.chain??row?.pool?.blockchainId??'');if(chain&&chain!=='ethereum')continue;if(!gaugeMap.has(lc(address)))gaugeMap.set(lc(address),row);}
  const poolMap=new Map();for(const row of allPools){const address=poolAddress(row);if(address)poolMap.set(lc(address),row);}
  const volumeMap=new Map();for(const row of allVolumes){const address=poolAddress(row);if(address)volumeMap.set(lc(address),row);}

  const upstreamRows=[];
  for(const r of upstream.rounds||[])for(const g of r.gauges||[])upstreamRows.push({roundId:Number(r.roundId),roundStart:r.roundStart,proposalId:Number(r.proposalId),gauge:g.gauge,incentiveCount:Number(g.incentiveCount),votiumVotesReceived:Number(g.votiumVotesReceived),votiumVoteSharePct:finiteOrNull(g.votiumVoteSharePct),curveExecutedWeightBps:Number(g.curveExecutedWeightBps),curveExecutionBlock:Number(g.curveExecutionBlock),curveExecutionTxHash:g.curveExecutionTxHash});
  if(upstreamRows.length!==79)fail(`Expected 79 round-gauge rows, found ${upstreamRows.length}`);

  const uniqueGaugeAddresses=unique(upstreamRows.map(row=>lc(row.gauge))),poolContexts=new Map();
  for(const gaugeKey of uniqueGaugeAddresses){
    const gaugeRow=gaugeMap.get(gaugeKey)||null,pAddress=gaugeRow?poolAddressFromGauge(gaugeRow):null,pRow=pAddress?poolMap.get(lc(pAddress))||null:null,vRow=pAddress?volumeMap.get(lc(pAddress))||null:null;
    const symbols=pRow?coinSymbols(pRow):[],liquidity=pRow?poolLiquidityUsd(pRow):null,volume=vRow?finiteOrNull(vRow.volumeUSD??vRow.trading_volume_24h):null,dailyApy=vRow?finiteOrNull(vRow.latestDailyApyPcent):null,weeklyApy=vRow?finiteOrNull(vRow.latestWeeklyApyPcent):null,lstApy=vRow?finiteOrNull(vRow.includedApyPcentFromLsts):null,feeYieldDaily=(dailyApy!==null&&lstApy!==null)?safeDelta(dailyApy,lstApy,8):null;
    poolContexts.set(gaugeKey,{gaugeAddress:null,curveGaugeResolved:Boolean(gaugeRow),gaugeName:gaugeRow?.name??gaugeRow?.shortName??null,gaugeType:gaugeRow?.type??null,poolAddress:pAddress,poolResolved:Boolean(pRow),poolName:pRow?poolName(pRow,symbols):null,poolType:pRow?.type??gaugeRow?.type??null,registryId:pRow?.registryId??null,coins:symbols,liquidityUsd:liquidity,volume24hUsd:volume,baseDailyApyPcent:dailyApy,baseWeeklyApyPcent:weeklyApy,includedLSTApyPcent:lstApy,feeYieldDailyApyExcludingLSTPcent:feeYieldDaily,exactFeeUsd24h:null,exactFeeUsdClass:'UNKNOWN-not-exposed-by-selected-official-current-endpoints',semantics:{liquidity:'MEASURED-official-curve-api-current-state',volume24h:'MEASURED-official-curve-api-current-state',baseApy:'MEASURED-official-curve-api-fee-yield-context',feeYieldExcludingLST:'DERIVED-arithmetic-context-not-exact-fee-usd',historicalVoteToCurrentPoolState:'CORRELATED-temporal-context-only-not-causal'}});
  }
  for(const[key,row]of poolContexts)row.gaugeAddress=upstreamRows.find(x=>lc(x.gauge)===key)?.gauge??key;
  const prior=priorPoolMap(previous),pools=[],uniquePoolKeys=new Set();
  for(const[,ctx]of poolContexts){
    const priorRow=ctx.poolAddress?prior.get(lc(ctx.poolAddress))||null:null;
    pools.push({...ctx,movement:priorRow?{priorObservedAt:previous?.observedAt??null,liquidityUsdDelta:safeDelta(ctx.liquidityUsd,priorRow.liquidityUsd,2),volume24hUsdDelta:safeDelta(ctx.volume24hUsd,priorRow.volume24hUsd,2),baseDailyApyDeltaPctPoints:safeDelta(ctx.baseDailyApyPcent,priorRow.baseDailyApyPcent,8),comparable:true,rule:'Like-for-like current Curve API snapshot delta only; no vote→pool causality is inferred.'}:{priorObservedAt:null,liquidityUsdDelta:null,volume24hUsdDelta:null,baseDailyApyDeltaPctPoints:null,comparable:false,rule:'First observed current Curve API snapshot.'}});if(ctx.poolAddress)uniquePoolKeys.add(lc(ctx.poolAddress));
  }
  pools.sort((a,b)=>lc(a.gaugeAddress).localeCompare(lc(b.gaugeAddress)));
  const roundGaugeRows=upstreamRows.map(row=>{const ctx=poolContexts.get(lc(row.gauge));return{...row,poolAddress:ctx?.poolAddress??null,poolName:ctx?.poolName??null,liquidityUsd:ctx?.liquidityUsd??null,volume24hUsd:ctx?.volume24hUsd??null,baseDailyApyPcent:ctx?.baseDailyApyPcent??null,feeYieldDailyApyExcludingLSTPcent:ctx?.feeYieldDailyApyExcludingLSTPcent??null,exactFeeUsd24h:null,semantics:{voteAndExecution:'MEASURED/ATTRIBUTED-upstream',currentPoolContext:'MEASURED-official-curve-api',relationship:'CORRELATED-context-only-not-causal'}};});
  const gaugeResolved=pools.filter(x=>x.curveGaugeResolved).length,poolResolved=pools.filter(x=>x.poolResolved).length,liquidityResolved=pools.filter(x=>x.liquidityUsd!==null).length,volumeResolved=pools.filter(x=>x.volume24hUsd!==null).length,feeYieldResolved=pools.filter(x=>x.feeYieldDailyApyExcludingLSTPcent!==null).length;
  const allCoreCurrentContext=poolResolved===pools.length&&liquidityResolved===pools.length&&volumeResolved===pools.length&&feeYieldResolved===pools.length;
  const now=new Date().toISOString();
  return{version:'0.1-vlcvx-votium-curve-pool-context',engineVersion:'0.1-official-curve-api-pool-economic-context',generatedAt:now,observedAt:now,status:allCoreCurrentContext?'shadow-downstream-pool-context-proven':'shadow-downstream-pool-context-partial',purpose:'Attach official current Curve pool liquidity, 24h trading volume and fee-derived base-yield context to proven Votium→Convex→Curve gauge execution without claiming historical votes caused current pool economics.',authority:{readOnly:true,executionAuthority:'none',capitalExecution:false,walletAuthority:false,allocationAuthority:false,recommendationAuthority:false,predictionAuthority:false,causalClaimAuthority:'none',promotionAuthority:'none',methodologyMutationAuthority:false},sourceBinding:{gaugeFlowFile:'intelligence/economic-graph/vlcvx-votium-curve-gauge-flow.json',gaugeFlowSha256:upstreamSha256,gaugeFlowGeneratedAt:upstream.generatedAt,companyRegistry:'004',candidateId:'defitea-convex-vlcvx-votium'},curveOfficialSource:{repository:CURVE_API_REPOSITORY,sourceCommit:CURVE_API_SOURCE_COMMIT,endpoints:ENDPOINTS,endpointAttempts:attempts,semantics:{getAllGauges:'official gauge registry and gauge→pool mapping',getPoolsAllEthereum:'official current pool registry and USD liquidity state',getVolumesEthereum:'official current 24h trading volume and base APY context backed by Curve Prices API',exactFeeUsd24h:'not claimed because selected endpoints do not directly expose exact pool fee dollars'}},coverage:{upstreamRoundGaugeRowCount:upstreamRows.length,uniqueGaugeCount:pools.length,uniquePoolCount:uniquePoolKeys.size,curveGaugeResolvedCount:gaugeResolved,poolResolvedCount:poolResolved,liquidityResolvedCount:liquidityResolved,volume24hResolvedCount:volumeResolved,feeYieldContextResolvedCount:feeYieldResolved,exactFeeUsdResolvedCount:0,coreCurrentContextComplete:allCoreCurrentContext,unresolvedGaugeCount:pools.length-gaugeResolved,unresolvedPoolCount:pools.length-poolResolved},pools,roundGaugeRows,epistemic:{gaugeToPool:'MEASURED-official-curve-api',currentLiquidity:'MEASURED-official-curve-api',currentVolume24h:'MEASURED-official-curve-api',baseYieldContext:'MEASURED-official-curve-api',feeYieldExcludingLST:'DERIVED-arithmetic-context',exactFeeUsd:'UNKNOWN',historicalVoteToCurrentLiquidityVolumeFees:'CORRELATED-context-only-not-causal',companyIncomeConnection:'not-attributed-by-this-layer',primaryDriver:null},semantics:{unknownIsNotZero:true,currentPoolStateAfterHistoricalVoteIsContextNotCause:true,volumeZeroFromCurveApiIsApiReportedNotInferred:true,baseApyIsFeeYieldContextNotExactFeeUsd:true,executedGaugeWeightIsNotPoolRevenue:true,protocolFlowIsNotRealisedCompanyIncome:true,correlationMustNotBePromotedToAttribution:true}};
}

async function main(){
  const upstream=readJson(UPSTREAM_FILE);requireUpstream(upstream);const upstreamSha256=sha256File(UPSTREAM_FILE),previous=readJsonOptional(OUTPUT_FILE);
  const[gauges,pools,volumes]=await Promise.all([fetchJson(ENDPOINTS.gauges),fetchJson(ENDPOINTS.pools),fetchJson(ENDPOINTS.volumes)]);
  const state=buildContext({upstream,upstreamSha256,gaugesPayload:gauges.payload,poolsPayload:pools.payload,volumesPayload:volumes.payload,attempts:{getAllGauges:gauges.attempt,getPoolsAllEthereum:pools.attempt,getVolumesEthereum:volumes.attempt},previous});
  fs.writeFileSync(OUTPUT_FILE,JSON.stringify(state,null,2)+'\n');
  console.log('VLCVX VOTIUM CURVE POOL CONTEXT PASS',{generatedAt:state.generatedAt,status:state.status,gauges:`${state.coverage.curveGaugeResolvedCount}/${state.coverage.uniqueGaugeCount}`,pools:`${state.coverage.poolResolvedCount}/${state.coverage.uniqueGaugeCount}`,liquidity:`${state.coverage.liquidityResolvedCount}/${state.coverage.uniqueGaugeCount}`,volume24h:`${state.coverage.volume24hResolvedCount}/${state.coverage.uniqueGaugeCount}`,feeYieldContext:`${state.coverage.feeYieldContextResolvedCount}/${state.coverage.uniqueGaugeCount}`,exactFeeUsd:state.epistemic.exactFeeUsd,executionAuthority:state.authority.executionAuthority});
}
main().catch(error=>{console.error(error?.stack||error);process.exit(1);});
