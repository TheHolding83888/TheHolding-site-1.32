#!/usr/bin/env node
import fs from 'node:fs';
import crypto from 'node:crypto';

const file=process.env.VLCVX_VOTIUM_CURVE_POOL_CONTEXT_FILE||'intelligence/economic-graph/vlcvx-votium-curve-pool-context.json';
const upstreamFile=process.env.VLCVX_VOTIUM_CURVE_GAUGE_FLOW_FILE||'intelligence/economic-graph/vlcvx-votium-curve-gauge-flow.json';
const x=JSON.parse(fs.readFileSync(file,'utf8'));
const upstream=JSON.parse(fs.readFileSync(upstreamFile,'utf8'));
const hash=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
function fail(message){throw new Error(message);}
function address(value){return /^0x[0-9a-f]{40}$/i.test(String(value||''));}
function finite(value){return Number.isFinite(Number(value));}

if(x.version!=='0.1-vlcvx-votium-curve-pool-context')fail('Votium Curve pool context version mismatch');
if(x.engineVersion!=='0.1-official-curve-api-pool-economic-context')fail('Votium Curve pool context engine mismatch');
if(!['shadow-downstream-pool-context-proven','shadow-downstream-pool-context-partial'].includes(x.status))fail(`Votium Curve pool context status invalid: ${x.status}`);
if(x.authority?.readOnly!==true||x.authority?.executionAuthority!=='none'||x.authority?.causalClaimAuthority!=='none'||x.authority?.promotionAuthority!=='none'||x.authority?.predictionAuthority!==false)fail('Votium Curve pool context authority regression');

const upstreamHash=hash(upstreamFile);
if(x.sourceBinding?.gaugeFlowSha256!==upstreamHash)fail('Votium Curve pool context exact upstream byte binding mismatch');
if(x.sourceBinding?.gaugeFlowGeneratedAt!==upstream.generatedAt||x.sourceBinding?.companyRegistry!=='004'||x.sourceBinding?.candidateId!=='defitea-convex-vlcvx-votium')fail('Votium Curve pool context source identity drift');
if(upstream.version!=='0.1-vlcvx-votium-curve-gauge-flow'||upstream.status!=='shadow-cross-protocol-flow-proven'||upstream.coverage?.complete!==true)fail('Votium Curve pool context upstream no longer proven');
if(Number(upstream.coverage.votiumGaugeCount)!==79||Number(upstream.coverage.curveExecutedVotiumGaugeCount)!==79)fail('Votium Curve pool context upstream lost 79/79 execution coverage');

const source=x.curveOfficialSource;
if(source?.repository!=='curvefi/curve-api'||source?.sourceCommit!=='db3a08468efba830f69e43cfe99ea3f3715d2a5a')fail('Curve official source pin drift');
if(source?.endpoints?.gauges!=='https://api.curve.finance/v1/getAllGauges'||source?.endpoints?.pools!=='https://api.curve.finance/v1/getPools/all/ethereum'||source?.endpoints?.volumes!=='https://api.curve.finance/v1/getVolumes/ethereum')fail('Curve official endpoint contract drift');
if(source?.semantics?.exactFeeUsd24h!=='not claimed because selected endpoints do not directly expose exact pool fee dollars')fail('Exact Curve fee USD boundary weakened');

const c=x.coverage;
if(Number(c?.upstreamRoundGaugeRowCount)!==79)fail('Votium Curve pool context lost 79 round-gauge rows');
if(!Number.isInteger(Number(c?.uniqueGaugeCount))||Number(c.uniqueGaugeCount)<1||Number(c.uniqueGaugeCount)>79)fail('Unique Curve gauge count invalid');
for(const key of ['curveGaugeResolvedCount','poolResolvedCount','liquidityResolvedCount','volume24hResolvedCount','feeYieldContextResolvedCount','exactFeeUsdResolvedCount','unresolvedGaugeCount','unresolvedPoolCount'])if(!Number.isInteger(Number(c?.[key]))||Number(c[key])<0)fail(`Coverage ${key} invalid`);
if(Number(c.curveGaugeResolvedCount)+Number(c.unresolvedGaugeCount)!==Number(c.uniqueGaugeCount))fail('Curve gauge coverage partition mismatch');
if(Number(c.poolResolvedCount)+Number(c.unresolvedPoolCount)!==Number(c.uniqueGaugeCount))fail('Curve pool coverage partition mismatch');
if(Number(c.exactFeeUsdResolvedCount)!==0)fail('Exact fee USD was fabricated by current context layer');
const coreComplete=Number(c.poolResolvedCount)===Number(c.uniqueGaugeCount)&&Number(c.liquidityResolvedCount)===Number(c.uniqueGaugeCount)&&Number(c.volume24hResolvedCount)===Number(c.uniqueGaugeCount)&&Number(c.feeYieldContextResolvedCount)===Number(c.uniqueGaugeCount);
if(Boolean(c.coreCurrentContextComplete)!==coreComplete)fail('Core current Curve context completion flag mismatch');
if((x.status==='shadow-downstream-pool-context-proven')!==coreComplete)fail('Votium Curve pool context status/completion mismatch');

if(!Array.isArray(x.pools)||x.pools.length!==Number(c.uniqueGaugeCount))fail('Votium Curve pool context unique gauge rows missing');
const seen=new Set();
for(const row of x.pools){
  if(!address(row.gaugeAddress))fail('Invalid Curve gauge address');
  const gaugeKey=String(row.gaugeAddress).toLowerCase();if(seen.has(gaugeKey))fail('Duplicate Curve gauge context row');seen.add(gaugeKey);
  if(row.curveGaugeResolved!==true)continue;
  if(!address(row.poolAddress))fail(`Resolved Curve gauge ${row.gaugeAddress} missing pool address`);
  if(row.poolResolved===true){
    if(!finite(row.liquidityUsd)||Number(row.liquidityUsd)<0)fail(`Curve pool ${row.poolAddress} liquidity invalid`);
    if(!finite(row.volume24hUsd)||Number(row.volume24hUsd)<0)fail(`Curve pool ${row.poolAddress} 24h volume invalid`);
    if(!finite(row.baseDailyApyPcent)||!finite(row.baseWeeklyApyPcent)||!finite(row.includedLSTApyPcent)||!finite(row.feeYieldDailyApyExcludingLSTPcent))fail(`Curve pool ${row.poolAddress} base-yield context incomplete`);
    const reproduced=Number(row.baseDailyApyPcent)-Number(row.includedLSTApyPcent);if(Math.abs(reproduced-Number(row.feeYieldDailyApyExcludingLSTPcent))>1e-7)fail(`Curve pool ${row.poolAddress} fee-yield arithmetic mismatch`);
  }
  if(row.exactFeeUsd24h!==null||row.exactFeeUsdClass!=='UNKNOWN-not-exposed-by-selected-official-current-endpoints')fail(`Curve pool ${row.poolAddress} exact fee USD boundary violated`);
  if(row.semantics?.historicalVoteToCurrentPoolState!=='CORRELATED-temporal-context-only-not-causal')fail(`Curve pool ${row.poolAddress} causal boundary weakened`);
  if(row.movement?.comparable===true&&row.movement?.rule!=='Like-for-like current Curve API snapshot delta only; no vote→pool causality is inferred.')fail('Curve pool movement semantics weakened');
}

if(!Array.isArray(x.roundGaugeRows)||x.roundGaugeRows.length!==79)fail('Votium Curve pool round-gauge rows missing');
for(const row of x.roundGaugeRows){
  if(![128,129].includes(Number(row.roundId))||!address(row.gauge)||!finite(row.votiumVotesReceived)||Number(row.votiumVotesReceived)<=0||!Number.isInteger(Number(row.curveExecutedWeightBps))||Number(row.curveExecutedWeightBps)<0)fail('Votium Curve pool upstream round-gauge evidence invalid');
  if(row.poolAddress!==null&&!address(row.poolAddress))fail('Votium Curve pool mapped pool address invalid');
  if(row.exactFeeUsd24h!==null)fail('Votium Curve pool round row fabricated exact fee USD');
  if(row.semantics?.relationship!=='CORRELATED-context-only-not-causal')fail('Votium Curve pool round relationship promoted beyond evidence');
}

if(x.epistemic?.gaugeToPool!=='MEASURED-official-curve-api'||x.epistemic?.currentLiquidity!=='MEASURED-official-curve-api'||x.epistemic?.currentVolume24h!=='MEASURED-official-curve-api'||x.epistemic?.baseYieldContext!=='MEASURED-official-curve-api'||x.epistemic?.feeYieldExcludingLST!=='DERIVED-arithmetic-context'||x.epistemic?.exactFeeUsd!=='UNKNOWN')fail('Votium Curve pool epistemic classes incomplete');
if(x.epistemic?.historicalVoteToCurrentLiquidityVolumeFees!=='CORRELATED-context-only-not-causal'||x.epistemic?.companyIncomeConnection!=='not-attributed-by-this-layer'||x.epistemic?.primaryDriver!==null)fail('Votium Curve pool causal boundary weakened');
if(x.semantics?.unknownIsNotZero!==true||x.semantics?.currentPoolStateAfterHistoricalVoteIsContextNotCause!==true||x.semantics?.volumeZeroFromCurveApiIsApiReportedNotInferred!==true||x.semantics?.baseApyIsFeeYieldContextNotExactFeeUsd!==true||x.semantics?.executedGaugeWeightIsNotPoolRevenue!==true||x.semantics?.protocolFlowIsNotRealisedCompanyIncome!==true||x.semantics?.correlationMustNotBePromotedToAttribution!==true)fail('Votium Curve pool semantic invariants missing');

console.log('VLCVX VOTIUM CURVE POOL CONTEXT VERIFY PASS',{upstreamHash,status:x.status,gauges:`${c.curveGaugeResolvedCount}/${c.uniqueGaugeCount}`,pools:`${c.poolResolvedCount}/${c.uniqueGaugeCount}`,liquidity:`${c.liquidityResolvedCount}/${c.uniqueGaugeCount}`,volume24h:`${c.volume24hResolvedCount}/${c.uniqueGaugeCount}`,feeYieldContext:`${c.feeYieldContextResolvedCount}/${c.uniqueGaugeCount}`,exactFeeUsd:x.epistemic.exactFeeUsd,causality:x.epistemic.historicalVoteToCurrentLiquidityVolumeFees,executionAuthority:x.authority.executionAuthority});
