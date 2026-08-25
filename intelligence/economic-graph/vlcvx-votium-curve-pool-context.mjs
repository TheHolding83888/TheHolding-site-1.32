#!/usr/bin/env node
/**
 * The Holding · Votium vlCVX → Curve Pool Economic Context v0.1
 *
 * Read-only downstream context over the production-proven Votium → Convex →
 * Curve gauge execution bridge. Current official Curve pool state is joined
 * only where the current Curve gauge directory says a historical gauge is a
 * live pool gauge. Missing/retired/non-pool gauges are classified explicitly;
 * they are never converted into fake zero liquidity, volume or fees.
 */
import fs from 'node:fs';
import crypto from 'node:crypto';

const UPSTREAM_FILE=process.env.VLCVX_VOTIUM_CURVE_GAUGE_FLOW_FILE||'intelligence/economic-graph/vlcvx-votium-curve-gauge-flow.json';
const OUTPUT_FILE=process.env.VLCVX_VOTIUM_CURVE_POOL_CONTEXT_FILE||'intelligence/economic-graph/vlcvx-votium-curve-pool-context.json';
const API_BASE='https://api.curve.finance/v1';
const ENDPOINTS={gauges:`${API_BASE}/getAllGauges`,pools:`${API_BASE}/getPools/all/ethereum`,volumes:`${API_BASE}/getVolumes/ethereum`};
const CURVE_API_REPOSITORY='curvefi/curve-api';
const CURVE_API_SOURCE_COMMIT='db3a08468efba830f69e43cfe99ea3f3715d2a5a';

function readJson(file){return JSON.parse(fs.readFileSync(file,'utf8'));}
function readJsonOptional(file){try{const text=fs.readFileSync(file,'utf8');return text.trim()?JSON.parse(text):null;}catch(error){if(error?.code==='ENOENT')return null;throw error;}}
function sha256File(file){return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');}
function fail(message){throw new Error(message);}
function lc(value){return String(value||'').toLowerCase();}
function finiteOrNull(value){const n=Number(value);return Number.isFinite(n)?n:null;}
function round(value,digits=8){const n=Number(value);return Number.isFinite(n)?Number(n.toFixed(digits)):null;}
function delta(a,b,digits=8){return Number.isFinite(Number(a))&&Number.isFinite(Number(b))?round(Number(a)-Number(b),digits):null;}
function unique(values){return [...new Set(values.filter(Boolean))];}
function isAddress(value){return /^0x[0-9a-f]{40}$/i.test(String(value||''));}

function requireUpstream(x){
  if(x?.version!=='0.1-vlcvx-votium-curve-gauge-flow'||x?.status!=='shadow-cross-protocol-flow-proven')fail('Proven Votium→Curve upstream unavailable');
  if(x?.coverage?.complete!==true||Number(x.coverage.roundCount)!==2||Number(x.coverage.completeRoundCount)!==2)fail('Votium→Curve round coverage incomplete');
  if(Number(x.coverage.votiumGaugeCount)!==79||Number(x.coverage.curveExecutedVotiumGaugeCount)!==79)fail('Votium→Curve expected 79/79 gauge coverage missing');
  if(x?.authority?.readOnly!==true||x?.authority?.executionAuthority!=='none'||x?.authority?.causalClaimAuthority!=='none'||x?.authority?.promotionAuthority!=='none')fail('Votium→Curve upstream authority drift');
}

async function fetchJson(url){
  let last=null;
  for(let attempt=1;attempt<=4;attempt++){
    const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),30000);
    try{
      const response=await fetch(url,{headers:{accept:'application/json','user-agent':'TheHolding-Protocol-Economic-Intelligence/0.1'},signal:controller.signal});
      if(!response.ok)throw new Error(`${url} HTTP ${response.status}`);
      const payload=await response.json();
      if(payload?.success===false)throw new Error(`${url} Curve API success=false`);
      clearTimeout(timer);return{payload,attempt};
    }catch(error){clearTimeout(timer);last=error;if(attempt<4)await new Promise(resolve=>setTimeout(resolve,750*attempt));}
  }
  throw last||new Error(`Curve API fetch failed: ${url}`);
}
function unwrap(payload){return payload?.data??payload;}
function gaugeRows(payload){const root=unwrap(payload),raw=root?.gauges??root;if(Array.isArray(raw))return raw;if(raw&&typeof raw==='object')return Object.entries(raw).filter(([,row])=>row&&typeof row==='object'&&!Array.isArray(row)).map(([key,row])=>({__mapKey:key,...row}));fail('Curve getAllGauges shape unsupported');}
function poolRows(payload){const root=unwrap(payload),rows=root?.poolData??root?.pools??root;if(!Array.isArray(rows))fail('Curve getPools/all/ethereum shape unsupported');return rows;}
function volumeRows(payload){const root=unwrap(payload),rows=root?.pools??root?.poolData??root;if(!Array.isArray(rows))fail('Curve getVolumes/ethereum shape unsupported');return rows;}
function gaugeAddress(row){return[row?.gauge,row?.gaugeAddress,row?.address,row?.__mapKey].find(isAddress)||null;}
function candidatePoolAddress(row){return[row?.poolAddress,row?.swap,row?.pool?.address,row?.swap_address].find(isAddress)||null;}
function poolAddress(row){return[row?.address,row?.poolAddress,row?.swap].find(isAddress)||null;}
function poolLiquidityUsd(row){for(const value of[row?.usdTotalExcludingBasePool,row?.usdTotal,row?.tvlUsd,row?.tvlUSD]){const n=finiteOrNull(value);if(n!==null&&n>=0)return n;}return null;}
function symbols(row){return unique((Array.isArray(row?.coins)?row.coins:[]).map(c=>typeof c==='string'?c:(c?.symbol??c?.name??null)));}
function priorMap(previous){const out=new Map();for(const row of previous?.pools||[])if(isAddress(row?.poolAddress))out.set(lc(row.poolAddress),row);return out;}

function build({upstream,upstreamHash,gaugesPayload,poolsPayload,volumesPayload,attempts,previous}){
  const gaugeDirectory=gaugeRows(gaugesPayload),poolData=poolRows(poolsPayload),volumeData=volumeRows(volumesPayload);
  const gaugeMap=new Map();
  for(const row of gaugeDirectory){const address=gaugeAddress(row);if(!address)continue;const chain=lc(row?.blockchainId??row?.chain??'');if(chain&&chain!=='ethereum')continue;if(!gaugeMap.has(lc(address)))gaugeMap.set(lc(address),row);}
  const poolMap=new Map();for(const row of poolData){const address=poolAddress(row);if(address)poolMap.set(lc(address),row);}
  const volumeMap=new Map();for(const row of volumeData){const address=poolAddress(row);if(address)volumeMap.set(lc(address),row);}

  const upstreamRows=[];
  for(const r of upstream.rounds||[])for(const g of r.gauges||[])upstreamRows.push({roundId:Number(r.roundId),roundStart:r.roundStart,proposalId:Number(r.proposalId),gauge:g.gauge,incentiveCount:Number(g.incentiveCount),votiumVotesReceived:Number(g.votiumVotesReceived),votiumVoteSharePct:finiteOrNull(g.votiumVoteSharePct),curveExecutedWeightBps:Number(g.curveExecutedWeightBps),curveExecutionBlock:Number(g.curveExecutionBlock),curveExecutionTxHash:g.curveExecutionTxHash});
  if(upstreamRows.length!==79)fail(`Expected 79 round-gauge rows, found ${upstreamRows.length}`);

  const prior=priorMap(previous),contexts=[];
  for(const gaugeKey of unique(upstreamRows.map(row=>lc(row.gauge)))){
    const canonicalGauge=upstreamRows.find(row=>lc(row.gauge)===gaugeKey)?.gauge??gaugeKey;
    const directory=gaugeMap.get(gaugeKey)||null;
    const rawPoolAddress=directory?candidatePoolAddress(directory):null;
    const currentPoolEligible=Boolean(directory&&directory?.isPool!==false&&rawPoolAddress);
    const pAddress=currentPoolEligible?rawPoolAddress:null;
    const pool=pAddress?poolMap.get(lc(pAddress))||null:null;
    const volume=pAddress?volumeMap.get(lc(pAddress))||null:null;
    const liquidity=pool?poolLiquidityUsd(pool):null;
    const volume24h=volume?finiteOrNull(volume.volumeUSD??volume.trading_volume_24h):null;
    const dailyApy=volume?finiteOrNull(volume.latestDailyApyPcent):null;
    const weeklyApy=volume?finiteOrNull(volume.latestWeeklyApyPcent):null;
    const lstApy=volume?finiteOrNull(volume.includedApyPcentFromLsts):null;
    const feeYield=dailyApy!==null&&lstApy!==null?delta(dailyApy,lstApy,8):null;
    const contextClass=!directory?'historical-or-retired-not-in-current-directory':!currentPoolEligible?'current-directory-non-pool-or-no-pool-mapping':!pool?'current-pool-mapping-without-pool-record':!volume?'current-pool-record-without-volume-record':'complete-current-pool-context';
    const old=pAddress?prior.get(lc(pAddress))||null:null;
    contexts.push({
      gaugeAddress:canonicalGauge,
      currentDirectoryResolved:Boolean(directory),
      currentPoolEligible,
      contextClass,
      gaugeName:directory?.name??directory?.shortName??null,
      gaugeType:directory?.type??null,
      gaugeKilled:directory?.is_killed??null,
      poolAddress:pAddress,
      poolResolved:Boolean(pool),
      poolName:pool?.name??pool?.symbol??directory?.name??null,
      poolType:pool?.type??directory?.type??null,
      registryId:pool?.registryId??null,
      coins:pool?symbols(pool):[],
      liquidityUsd:liquidity,
      volume24hUsd:volume24h,
      baseDailyApyPcent:dailyApy,
      baseWeeklyApyPcent:weeklyApy,
      includedLSTApyPcent:lstApy,
      feeYieldDailyApyExcludingLSTPcent:feeYield,
      exactFeeUsd24h:null,
      exactFeeUsdClass:'UNKNOWN-not-exposed-by-selected-official-current-endpoints',
      movement:old?{priorObservedAt:previous?.observedAt??null,liquidityUsdDelta:delta(liquidity,old.liquidityUsd,2),volume24hUsdDelta:delta(volume24h,old.volume24hUsd,2),baseDailyApyDeltaPctPoints:delta(dailyApy,old.baseDailyApyPcent,8),comparable:true,rule:'Like-for-like current Curve API snapshot delta only; no vote→pool causality is inferred.'}:{priorObservedAt:null,liquidityUsdDelta:null,volume24hUsdDelta:null,baseDailyApyDeltaPctPoints:null,comparable:false,rule:'First observed current Curve API snapshot.'},
      semantics:{currentDirectory:directory?'MEASURED-official-curve-api-current-directory':'UNKNOWN-historical-or-retired-current-directory-status',liquidity:pool?'MEASURED-official-curve-api-current-state':'NOT-APPLICABLE-or-UNKNOWN-current-pool-context',volume24h:volume?'MEASURED-official-curve-api-current-state':'NOT-APPLICABLE-or-UNKNOWN-current-pool-context',baseApy:volume?'MEASURED-official-curve-api-fee-yield-context':'NOT-APPLICABLE-or-UNKNOWN-current-pool-context',feeYieldExcludingLST:feeYield!==null?'DERIVED-arithmetic-context-not-exact-fee-usd':'NOT-APPLICABLE-or-UNKNOWN-current-pool-context',historicalVoteToCurrentPoolState:'CORRELATED-temporal-context-only-not-causal'}
    });
  }
  contexts.sort((a,b)=>lc(a.gaugeAddress).localeCompare(lc(b.gaugeAddress)));
  const ctxMap=new Map(contexts.map(row=>[lc(row.gaugeAddress),row]));
  const roundGaugeRows=upstreamRows.map(row=>{const ctx=ctxMap.get(lc(row.gauge));return{...row,currentPoolEligible:ctx.currentPoolEligible,contextClass:ctx.contextClass,poolAddress:ctx.poolAddress,poolName:ctx.poolName,liquidityUsd:ctx.liquidityUsd,volume24hUsd:ctx.volume24hUsd,baseDailyApyPcent:ctx.baseDailyApyPcent,feeYieldDailyApyExcludingLSTPcent:ctx.feeYieldDailyApyExcludingLSTPcent,exactFeeUsd24h:null,semantics:{voteAndExecution:'MEASURED/ATTRIBUTED-upstream',currentPoolContext:ctx.contextClass==='complete-current-pool-context'?'MEASURED-official-curve-api':'NOT-APPLICABLE-or-UNKNOWN-current-pool-context',relationship:'CORRELATED-context-only-not-causal'}};});

  const directoryResolved=contexts.filter(x=>x.currentDirectoryResolved).length;
  const eligible=contexts.filter(x=>x.currentPoolEligible);
  const complete=eligible.filter(x=>x.contextClass==='complete-current-pool-context');
  const poolResolved=eligible.filter(x=>x.poolResolved).length;
  const liquidityResolved=eligible.filter(x=>x.liquidityUsd!==null).length;
  const volumeResolved=eligible.filter(x=>x.volume24hUsd!==null).length;
  const feeYieldResolved=eligible.filter(x=>x.feeYieldDailyApyExcludingLSTPcent!==null).length;
  const classified=contexts.every(x=>['historical-or-retired-not-in-current-directory','current-directory-non-pool-or-no-pool-mapping','current-pool-mapping-without-pool-record','current-pool-record-without-volume-record','complete-current-pool-context'].includes(x.contextClass));
  const currentPoolContextComplete=classified&&complete.length===eligible.length;
  const now=new Date().toISOString();

  return{
    version:'0.1-vlcvx-votium-curve-pool-context',engineVersion:'0.2-official-curve-api-current-pool-classification',generatedAt:now,observedAt:now,status:currentPoolContextComplete?'shadow-downstream-pool-context-proven':'shadow-downstream-pool-context-partial',purpose:'Classify every historically proven Votium→Curve gauge against the current official Curve directory and measure current liquidity, 24h volume and fee-derived base-yield context for every currently eligible pool gauge without claiming historical votes caused current pool economics.',authority:{readOnly:true,executionAuthority:'none',capitalExecution:false,walletAuthority:false,allocationAuthority:false,recommendationAuthority:false,predictionAuthority:false,causalClaimAuthority:'none',promotionAuthority:'none',methodologyMutationAuthority:false},sourceBinding:{gaugeFlowFile:'intelligence/economic-graph/vlcvx-votium-curve-gauge-flow.json',gaugeFlowSha256:upstreamHash,gaugeFlowGeneratedAt:upstream.generatedAt,companyRegistry:'004',candidateId:'defitea-convex-vlcvx-votium'},curveOfficialSource:{repository:CURVE_API_REPOSITORY,sourceCommit:CURVE_API_SOURCE_COMMIT,endpoints:ENDPOINTS,endpointAttempts:attempts,semantics:{getAllGauges:'official current gauge directory and gauge→pool eligibility/mapping',getPoolsAllEthereum:'official current Ethereum pool registry and USD liquidity state',getVolumesEthereum:'official current 24h trading volume and base APY context backed by Curve Prices API',historicalOrRetiredGauges:'absence from current directory is classified, never interpreted as zero current pool economics',exactFeeUsd24h:'not claimed because selected endpoints do not directly expose exact pool fee dollars'}},coverage:{upstreamRoundGaugeRowCount:79,uniqueGaugeCount:contexts.length,currentDirectoryResolvedGaugeCount:directoryResolved,currentDirectoryMissingGaugeCount:contexts.length-directoryResolved,currentPoolEligibleGaugeCount:eligible.length,currentPoolNonEligibleOrHistoricalGaugeCount:contexts.length-eligible.length,currentPoolContextCompleteCount:complete.length,unresolvedEligiblePoolContextCount:eligible.length-complete.length,poolResolvedCount:poolResolved,liquidityResolvedCount:liquidityResolved,volume24hResolvedCount:volumeResolved,feeYieldContextResolvedCount:feeYieldResolved,exactFeeUsdResolvedCount:0,allGaugeRowsClassified:classified,currentPoolContextComplete},pools:contexts,roundGaugeRows,epistemic:{currentGaugeDirectory:'MEASURED-official-curve-api-with-explicit-historical-absence',gaugeToCurrentPool:'MEASURED-when-current-directory-maps-pool',currentLiquidity:'MEASURED-for-currently-eligible-pool-gauges',currentVolume24h:'MEASURED-for-currently-eligible-pool-gauges',baseYieldContext:'MEASURED-for-currently-eligible-pool-gauges',feeYieldExcludingLST:'DERIVED-arithmetic-context',exactFeeUsd:'UNKNOWN',historicalVoteToCurrentLiquidityVolumeFees:'CORRELATED-context-only-not-causal',companyIncomeConnection:'not-attributed-by-this-layer',primaryDriver:null},semantics:{unknownIsNotZero:true,historicalOrRetiredGaugeIsNotZeroPool:true,currentPoolStateAfterHistoricalVoteIsContextNotCause:true,volumeZeroFromCurveApiIsApiReportedNotInferred:true,baseApyIsFeeYieldContextNotExactFeeUsd:true,executedGaugeWeightIsNotPoolRevenue:true,protocolFlowIsNotRealisedCompanyIncome:true,correlationMustNotBePromotedToAttribution:true}
  };
}

async function main(){
  const upstream=readJson(UPSTREAM_FILE);requireUpstream(upstream);const upstreamHash=sha256File(UPSTREAM_FILE),previous=readJsonOptional(OUTPUT_FILE);
  const[gauges,pools,volumes]=await Promise.all([fetchJson(ENDPOINTS.gauges),fetchJson(ENDPOINTS.pools),fetchJson(ENDPOINTS.volumes)]);
  const state=build({upstream,upstreamHash,gaugesPayload:gauges.payload,poolsPayload:pools.payload,volumesPayload:volumes.payload,attempts:{getAllGauges:gauges.attempt,getPoolsAllEthereum:pools.attempt,getVolumesEthereum:volumes.attempt},previous});
  fs.writeFileSync(OUTPUT_FILE,JSON.stringify(state,null,2)+'\n');
  console.log('VLCVX VOTIUM CURVE POOL CONTEXT PASS',{generatedAt:state.generatedAt,status:state.status,directory:`${state.coverage.currentDirectoryResolvedGaugeCount}/${state.coverage.uniqueGaugeCount}`,poolEligible:state.coverage.currentPoolEligibleGaugeCount,poolContext:`${state.coverage.currentPoolContextCompleteCount}/${state.coverage.currentPoolEligibleGaugeCount}`,liquidity:`${state.coverage.liquidityResolvedCount}/${state.coverage.currentPoolEligibleGaugeCount}`,volume24h:`${state.coverage.volume24hResolvedCount}/${state.coverage.currentPoolEligibleGaugeCount}`,feeYieldContext:`${state.coverage.feeYieldContextResolvedCount}/${state.coverage.currentPoolEligibleGaugeCount}`,historicalOrNonPool:state.coverage.currentPoolNonEligibleOrHistoricalGaugeCount,exactFeeUsd:state.epistemic.exactFeeUsd,executionAuthority:state.authority.executionAuthority});
}
main().catch(error=>{console.error(error?.stack||error);process.exit(1);});
