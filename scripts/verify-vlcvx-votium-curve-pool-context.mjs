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
if(x.engineVersion!=='0.2-official-curve-api-current-pool-classification')fail('Votium Curve pool context engine mismatch');
if(x.status!=='shadow-downstream-pool-context-proven')fail(`Votium Curve pool context incomplete: ${x.status}`);
if(x.authority?.readOnly!==true||x.authority?.executionAuthority!=='none'||x.authority?.causalClaimAuthority!=='none'||x.authority?.promotionAuthority!=='none'||x.authority?.predictionAuthority!==false)fail('Votium Curve pool context authority regression');

const upstreamHash=hash(upstreamFile);
if(x.sourceBinding?.gaugeFlowSha256!==upstreamHash||x.sourceBinding?.gaugeFlowGeneratedAt!==upstream.generatedAt)fail('Votium Curve pool context exact upstream byte binding mismatch');
if(x.sourceBinding?.companyRegistry!=='004'||x.sourceBinding?.candidateId!=='defitea-convex-vlcvx-votium')fail('Votium Curve pool context identity drift');
if(upstream.version!=='0.1-vlcvx-votium-curve-gauge-flow'||upstream.status!=='shadow-cross-protocol-flow-proven'||upstream.coverage?.complete!==true)fail('Votium Curve pool upstream no longer proven');
if(Number(upstream.coverage.votiumGaugeCount)!==79||Number(upstream.coverage.curveExecutedVotiumGaugeCount)!==79)fail('Votium Curve pool upstream lost 79/79 coverage');

const source=x.curveOfficialSource;
if(source?.repository!=='curvefi/curve-api'||source?.sourceCommit!=='db3a08468efba830f69e43cfe99ea3f3715d2a5a')fail('Curve official source pin drift');
if(source?.endpoints?.gauges!=='https://api.curve.finance/v1/getAllGauges'||source?.endpoints?.pools!=='https://api.curve.finance/v1/getPools/all/ethereum'||source?.endpoints?.volumes!=='https://api.curve.finance/v1/getVolumes/ethereum')fail('Curve official endpoint contract drift');
if(source?.semantics?.historicalOrRetiredGauges!=='absence from current directory is classified, never interpreted as zero current pool economics')fail('Historical Curve gauge classification rule weakened');
if(source?.semantics?.exactFeeUsd24h!=='not claimed because selected endpoints do not directly expose exact pool fee dollars')fail('Exact Curve fee USD boundary weakened');

const c=x.coverage;
if(Number(c?.upstreamRoundGaugeRowCount)!==79)fail('Votium Curve pool context lost 79 round-gauge rows');
if(!Number.isInteger(Number(c?.uniqueGaugeCount))||Number(c.uniqueGaugeCount)<1||Number(c.uniqueGaugeCount)>79)fail('Unique gauge count invalid');
for(const key of ['currentDirectoryResolvedGaugeCount','currentDirectoryMissingGaugeCount','currentPoolEligibleGaugeCount','currentPoolNonEligibleOrHistoricalGaugeCount','currentPoolContextCompleteCount','unresolvedEligiblePoolContextCount','poolResolvedCount','liquidityResolvedCount','volume24hResolvedCount','feeYieldContextResolvedCount','exactFeeUsdResolvedCount'])if(!Number.isInteger(Number(c?.[key]))||Number(c[key])<0)fail(`Coverage ${key} invalid`);
if(Number(c.currentDirectoryResolvedGaugeCount)+Number(c.currentDirectoryMissingGaugeCount)!==Number(c.uniqueGaugeCount))fail('Current Curve directory partition mismatch');
if(Number(c.currentPoolEligibleGaugeCount)+Number(c.currentPoolNonEligibleOrHistoricalGaugeCount)!==Number(c.uniqueGaugeCount))fail('Current pool eligibility partition mismatch');
if(Number(c.currentPoolContextCompleteCount)+Number(c.unresolvedEligiblePoolContextCount)!==Number(c.currentPoolEligibleGaugeCount))fail('Current eligible pool context partition mismatch');
if(Number(c.currentPoolContextCompleteCount)!==Number(c.currentPoolEligibleGaugeCount)||Number(c.unresolvedEligiblePoolContextCount)!==0)fail('Not every currently eligible Curve pool gauge has complete context');
if(Number(c.poolResolvedCount)!==Number(c.currentPoolEligibleGaugeCount)||Number(c.liquidityResolvedCount)!==Number(c.currentPoolEligibleGaugeCount)||Number(c.volume24hResolvedCount)!==Number(c.currentPoolEligibleGaugeCount)||Number(c.feeYieldContextResolvedCount)!==Number(c.currentPoolEligibleGaugeCount))fail('Current eligible Curve pool measurement coverage incomplete');
if(Number(c.exactFeeUsdResolvedCount)!==0)fail('Exact fee USD fabricated');
if(c.allGaugeRowsClassified!==true||c.currentPoolContextComplete!==true)fail('Curve gauge classification/current pool context not complete');

if(!Array.isArray(x.pools)||x.pools.length!==Number(c.uniqueGaugeCount))fail('Unique Curve gauge context rows missing');
const seen=new Set();
for(const row of x.pools){
  if(!address(row.gaugeAddress))fail('Invalid Curve gauge address');
  const key=String(row.gaugeAddress).toLowerCase();if(seen.has(key))fail('Duplicate Curve gauge context');seen.add(key);
  if(row.currentPoolEligible===true){
    if(row.currentDirectoryResolved!==true||row.contextClass!=='complete-current-pool-context'||row.poolResolved!==true||!address(row.poolAddress))fail(`Eligible Curve gauge ${row.gaugeAddress} lacks complete pool mapping`);
    if(!finite(row.liquidityUsd)||Number(row.liquidityUsd)<0||!finite(row.volume24hUsd)||Number(row.volume24hUsd)<0)fail(`Eligible Curve pool ${row.poolAddress} liquidity/volume invalid`);
    if(!finite(row.baseDailyApyPcent)||!finite(row.baseWeeklyApyPcent)||!finite(row.includedLSTApyPcent)||!finite(row.feeYieldDailyApyExcludingLSTPcent))fail(`Eligible Curve pool ${row.poolAddress} fee-yield context incomplete`);
    const reproduced=Number(row.baseDailyApyPcent)-Number(row.includedLSTApyPcent);if(Math.abs(reproduced-Number(row.feeYieldDailyApyExcludingLSTPcent))>1e-7)fail(`Eligible Curve pool ${row.poolAddress} fee-yield arithmetic mismatch`);
    if(row.semantics?.liquidity!=='MEASURED-official-curve-api-current-state'||row.semantics?.volume24h!=='MEASURED-official-curve-api-current-state'||row.semantics?.baseApy!=='MEASURED-official-curve-api-fee-yield-context')fail(`Eligible Curve pool ${row.poolAddress} measured semantics missing`);
  }else{
    if(!['historical-or-retired-not-in-current-directory','current-directory-non-pool-or-no-pool-mapping'].includes(row.contextClass))fail(`Non-eligible Curve gauge ${row.gaugeAddress} has unresolved current classification ${row.contextClass}`);
    if(row.poolAddress!==null||row.poolResolved!==false||row.liquidityUsd!==null||row.volume24hUsd!==null||row.baseDailyApyPcent!==null||row.feeYieldDailyApyExcludingLSTPcent!==null)fail(`Non-eligible/historical Curve gauge ${row.gaugeAddress} fabricated current pool economics`);
  }
  if(row.exactFeeUsd24h!==null||row.exactFeeUsdClass!=='UNKNOWN-not-exposed-by-selected-official-current-endpoints')fail('Exact fee USD boundary violated');
  if(row.semantics?.historicalVoteToCurrentPoolState!=='CORRELATED-temporal-context-only-not-causal')fail('Historical vote/current pool causal boundary weakened');
  if(row.movement?.comparable===true&&row.movement?.rule!=='Like-for-like current Curve API snapshot delta only; no vote→pool causality is inferred.')fail('Pool movement semantics weakened');
}

if(!Array.isArray(x.roundGaugeRows)||x.roundGaugeRows.length!==79)fail('Votium Curve pool round-gauge rows missing');
for(const row of x.roundGaugeRows){
  if(![128,129].includes(Number(row.roundId))||!address(row.gauge)||!finite(row.votiumVotesReceived)||Number(row.votiumVotesReceived)<=0||!Number.isInteger(Number(row.curveExecutedWeightBps))||Number(row.curveExecutedWeightBps)<0)fail('Round-gauge upstream evidence invalid');
  if(row.currentPoolEligible===true){if(!address(row.poolAddress)||row.semantics?.currentPoolContext!=='MEASURED-official-curve-api')fail('Eligible round-gauge current pool context missing');}
  else if(row.poolAddress!==null||row.semantics?.currentPoolContext!=='NOT-APPLICABLE-or-UNKNOWN-current-pool-context')fail('Historical/non-pool round-gauge current context fabricated');
  if(row.exactFeeUsd24h!==null||row.semantics?.relationship!=='CORRELATED-context-only-not-causal')fail('Round-gauge fee/causal boundary weakened');
}

if(x.epistemic?.currentGaugeDirectory!=='MEASURED-official-curve-api-with-explicit-historical-absence'||x.epistemic?.gaugeToCurrentPool!=='MEASURED-when-current-directory-maps-pool'||x.epistemic?.currentLiquidity!=='MEASURED-for-currently-eligible-pool-gauges'||x.epistemic?.currentVolume24h!=='MEASURED-for-currently-eligible-pool-gauges'||x.epistemic?.baseYieldContext!=='MEASURED-for-currently-eligible-pool-gauges'||x.epistemic?.feeYieldExcludingLST!=='DERIVED-arithmetic-context'||x.epistemic?.exactFeeUsd!=='UNKNOWN')fail('Votium Curve pool epistemic classes incomplete');
if(x.epistemic?.historicalVoteToCurrentLiquidityVolumeFees!=='CORRELATED-context-only-not-causal'||x.epistemic?.companyIncomeConnection!=='not-attributed-by-this-layer'||x.epistemic?.primaryDriver!==null)fail('Votium Curve pool causal boundary weakened');
if(x.semantics?.unknownIsNotZero!==true||x.semantics?.historicalOrRetiredGaugeIsNotZeroPool!==true||x.semantics?.currentPoolStateAfterHistoricalVoteIsContextNotCause!==true||x.semantics?.volumeZeroFromCurveApiIsApiReportedNotInferred!==true||x.semantics?.baseApyIsFeeYieldContextNotExactFeeUsd!==true||x.semantics?.executedGaugeWeightIsNotPoolRevenue!==true||x.semantics?.protocolFlowIsNotRealisedCompanyIncome!==true||x.semantics?.correlationMustNotBePromotedToAttribution!==true)fail('Votium Curve pool semantic invariants missing');

console.log('VLCVX VOTIUM CURVE POOL CONTEXT VERIFY PASS',{upstreamHash,status:x.status,directory:`${c.currentDirectoryResolvedGaugeCount}/${c.uniqueGaugeCount}`,poolEligible:c.currentPoolEligibleGaugeCount,poolContext:`${c.currentPoolContextCompleteCount}/${c.currentPoolEligibleGaugeCount}`,historicalOrNonPool:c.currentPoolNonEligibleOrHistoricalGaugeCount,exactFeeUsd:x.epistemic.exactFeeUsd,causality:x.epistemic.historicalVoteToCurrentLiquidityVolumeFees,executionAuthority:x.authority.executionAuthority});
