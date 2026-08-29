#!/usr/bin/env node
/**
 * The Holding · Frax bounded onchain Economic Graph enrichment v1.8
 *
 * One canonical sequential Frax writer path. Each protocol atom remains a
 * bounded read-only measurement with its own epistemic contract, but all atoms
 * enrich the same Economic Graph artifact. Rich current evidence remains full;
 * duplicated historical protocol-evidence payloads are compacted once at the
 * end of the writer so repository size grows slower than capability.
 * No new workflow, scheduler, orchestrator, price authority, methodology or
 * execution authority.
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { collectFraxSfrxUsdOnchain, applyFraxSfrxUsdOnchainMeasurement } from './frax-sfrxusd-onchain.mjs';
import { collectFraxFraxlendOnchain, applyFraxFraxlendOnchainMeasurement } from './frax-fraxlend-onchain.mjs';
import { collectFraxFraxlendRateModel, applyFraxFraxlendRateModel } from './frax-fraxlend-rate-model.mjs';
import { collectFraxFxbOnchain, applyFraxFxbOnchainMeasurement } from './frax-fxb-onchain.mjs';
import { collectFraxNetCurrentState, applyFraxNetCurrentState } from './frax-fraxnet-current-state.mjs';
import { collectFloxFxtlCurrentState, applyFloxFxtlCurrentState } from './frax-flox-fxtl-current-state.mjs';
import { collectFraxBammOnchain, applyFraxBammOnchainMeasurement } from './frax-bamm-onchain.mjs';
import { collectFraxFxLiquidityCurrentState, applyFraxFxLiquidityCurrentState } from './frax-fx-liquidity-current-state.mjs';
import { collectFraxswapFlowFees, applyFraxswapFlowFees } from './frax-fraxswap-flow-fees.mjs';
import { collectFraxswapTwamm, applyFraxswapTwamm } from './frax-fraxswap-twamm.mjs';
import { collectFraxswapProtocolFeeRouting, applyFraxswapProtocolFeeRouting } from './frax-fraxswap-protocol-fee-routing.mjs';
import { collectFraxswapFeeToLifecycle, applyFraxswapFeeToLifecycle } from './frax-fraxswap-feeto-lifecycle.mjs';
import { collectFraxswapFeeToHistoryBackfill, applyFraxswapFeeToHistoryBackfill } from './frax-fraxswap-feeto-history-backfill.mjs';
import { collectFraxRevenueRoutingCurrentState, applyFraxRevenueRoutingCurrentState } from './frax-revenue-routing-current-state.mjs';
import { collectFraxFrxEthCurrentState, applyFraxFrxEthCurrentState } from './frax-frxeth-current-state.mjs';
import { collectFraxFrxEthV2EtherRouterCurrentState, applyFraxFrxEthV2EtherRouterCurrentState } from './frax-frxeth-v2-ether-router-current-state.mjs';
import { collectFraxFrxEthV2LendingPoolCurrentState, applyFraxFrxEthV2LendingPoolCurrentState } from './frax-frxeth-v2-lending-pool-current-state.mjs';
import { collectFraxFpiFpisCurrentState, applyFraxFpiFpisCurrentState } from './frax-fpi-fpis-current-state.mjs';
import { compactProtocolEvidenceHistory } from './protocol-evidence-history-retention.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const OUT=process.env.ECONOMIC_GRAPH_FILE || path.join(ROOT,'intelligence/economic-graph/economic-graph.json');
const PREVIOUS=process.env.FRAX_PREVIOUS_GRAPH_FILE || null;
const FRAX_EVIDENCE_ID='registry-frax-ecosystem';

function readJson(file,label){
  if(!file)throw new Error(`${label} path missing`);
  if(!fs.existsSync(file))throw new Error(`${label} file missing: ${file}`);
  const parsed=JSON.parse(fs.readFileSync(file,'utf8'));
  if(!parsed||typeof parsed!=='object')throw new Error(`${label} JSON invalid`);
  return parsed;
}

async function main(){
  const state=readJson(OUT,'Current canonical Economic Graph');
  const previousState=readJson(PREVIOUS,'Published previous Economic Graph');
  if(state?.authority?.executionAuthority!=='none'||previousState?.authority?.executionAuthority!=='none')throw new Error('Economic Graph authority drift');
  if(state?.engineVersion!==previousState?.engineVersion)throw new Error('Published previous Graph engine identity drift');

  const sfrxUsdMeasurement=await collectFraxSfrxUsdOnchain();
  applyFraxSfrxUsdOnchainMeasurement({state,previousState,measurement:sfrxUsdMeasurement});

  const fraxlendMeasurement=await collectFraxFraxlendOnchain();
  applyFraxFraxlendOnchainMeasurement({state,previousState,measurement:fraxlendMeasurement});
  if(fraxlendMeasurement?.status==='ok'&&fraxlendMeasurement?.measurementClass==='MEASURED'){
    const proof=await collectFraxFraxlendRateModel({baseMeasurement:fraxlendMeasurement});
    applyFraxFraxlendRateModel({state,proof});
  }

  const fxbMeasurement=await collectFraxFxbOnchain();
  applyFraxFxbOnchainMeasurement({state,previousState,measurement:fxbMeasurement});

  const fraxNetMeasurement=await collectFraxNetCurrentState();
  applyFraxNetCurrentState({state,previousState,measurement:fraxNetMeasurement});

  const floxFxtlMeasurement=await collectFloxFxtlCurrentState();
  applyFloxFxtlCurrentState({state,previousState,measurement:floxFxtlMeasurement});

  const previousFraxEcosystem=previousState?.protocolEvidence?.[FRAX_EVIDENCE_ID]?.latest?.observation||null;
  const previousBammMeasurement=previousFraxEcosystem?.surfaces?.fraxswapBamm?.measured||null;
  const previousFeeToHistory=previousFraxEcosystem?.surfaces?.revenueRouting?.measured?.fraxswapFeeToHistoricalBackfill||null;
  const bammMeasurement=await collectFraxBammOnchain();
  applyFraxBammOnchainMeasurement({state,previousState,measurement:bammMeasurement});

  // Reusable liquidity-template proof: protocol identity is config, collection
  // is generic. The atom reuses the BAMM exact Fraxtal checkpoint when present,
  // so the extra surface does not create a second scheduler or independent
  // temporal truth. Only frxUSD reserve units are safely aggregated.
  const fxLiquidityMeasurement=await collectFraxFxLiquidityCurrentState({checkpoint:bammMeasurement?.status==='ok'?bammMeasurement:null});
  applyFraxFxLiquidityCurrentState({state,previousState,measurement:fxLiquidityMeasurement});

  if(bammMeasurement?.status==='ok'&&bammMeasurement?.measurementClass==='MEASURED'){
    const flow=await collectFraxswapFlowFees({currentBammMeasurement:bammMeasurement,previousBammMeasurement});
    applyFraxswapFlowFees({state,previousState,measurement:flow});

    const twamm=await collectFraxswapTwamm({currentBammMeasurement:bammMeasurement,previousBammMeasurement});
    applyFraxswapTwamm({state,previousState,measurement:twamm});

    const protocolFee=await collectFraxswapProtocolFeeRouting({currentBammMeasurement:bammMeasurement,previousBammMeasurement});
    applyFraxswapProtocolFeeRouting({state,previousState,measurement:protocolFee});

    const feeToLifecycle=await collectFraxswapFeeToLifecycle({currentBammMeasurement:bammMeasurement,previousBammMeasurement,protocolFeeMeasurement:protocolFee});
    applyFraxswapFeeToLifecycle({state,previousState,measurement:feeToLifecycle});

    const feeToHistory=await collectFraxswapFeeToHistoryBackfill({currentBammMeasurement:bammMeasurement,previousBammMeasurement,protocolFeeMeasurement:protocolFee,previousBackfillMeasurement:previousFeeToHistory});
    applyFraxswapFeeToHistoryBackfill({state,previousState,measurement:feeToHistory});
  }

  // Original ninth top-level Frax surface: current veFXS-weighted
  // YieldDistributor state. Source-of-funds and company realization stay UNKNOWN.
  const revenueRoutingMeasurement=await collectFraxRevenueRoutingCurrentState();
  applyFraxRevenueRoutingCurrentState({state,previousState,measurement:revenueRoutingMeasurement});

  // Frax fat-audit scope extension #1: frxETH / sfrxETH.
  const frxEthMeasurement=await collectFraxFrxEthCurrentState();
  applyFraxFrxEthCurrentState({state,previousState,measurement:frxEthMeasurement});

  // Reuse the same frxETH exact Ethereum checkpoint for a deeper V2 sub-atom.
  // Force-live is view-only: no EtherRouter cache write or execution authority.
  const frxEthEtherRouterMeasurement=await collectFraxFrxEthV2EtherRouterCurrentState({checkpoint:frxEthMeasurement?.status==='ok'?frxEthMeasurement:null});
  applyFraxFrxEthV2EtherRouterCurrentState({state,measurement:frxEthEtherRouterMeasurement});

  // Keep LendingPool as a separate bounded atom while reusing the same frxETH
  // exact-block checkpoint. Native utilization and addInterest preview are
  // read-only; previewed fees are not promoted to realized protocol revenue.
  const frxEthLendingPoolMeasurement=await collectFraxFrxEthV2LendingPoolCurrentState({checkpoint:frxEthMeasurement?.status==='ok'?frxEthMeasurement:null});
  applyFraxFrxEthV2LendingPoolCurrentState({state,measurement:frxEthLendingPoolMeasurement});

  // Frax fat-audit scope extension #2: source-pinned legacy Ethereum FPI/FPIS.
  // This is deliberately after frxETH so the existing extension contract remains
  // stable. Current Fraxtal FPIS Locker and revenue economics remain UNKNOWN.
  const fpiFpisMeasurement=await collectFraxFpiFpisCurrentState();
  applyFraxFpiFpisCurrentState({state,previousState,measurement:fpiFpisMeasurement});

  if(state?.authority?.executionAuthority!=='none')throw new Error('Frax bounded enrichment execution authority drift');

  // The full current Frax observation stays intact under latest.observation.
  // Historical duplicates are compacted only after every atom has finished so
  // no collector loses its published previous-checkpoint semantics.
  const retention=compactProtocolEvidenceHistory({state,evidenceId:FRAX_EVIDENCE_ID});
  fs.writeFileSync(OUT,retention.serialized);

  const ecosystem=state?.protocolEvidence?.[FRAX_EVIDENCE_ID]?.latest?.observation;
  const sfrxUsd=ecosystem?.surfaces?.frxUsdSfrxUsd;
  const fraxlend=ecosystem?.surfaces?.fraxlend;
  const fxb=ecosystem?.surfaces?.fxb;
  const fraxNet=ecosystem?.surfaces?.fraxNet;
  const floxFxtl=ecosystem?.surfaces?.fraxtalFloxFxtl;
  const fxLiquidity=ecosystem?.surfaces?.fxLiquidity;
  const bamm=ecosystem?.surfaces?.fraxswapBamm;
  const revenue=ecosystem?.surfaces?.revenueRouting;
  const frxEth=ecosystem?.surfaces?.frxEthSfrxEth;
  const fpiFpis=ecosystem?.surfaces?.fpiFpisVeFpis;
  const flow=bamm?.measured?.swapFlowFees;
  const twamm=bamm?.measured?.twammFlow;
  const protocolFee=bamm?.measured?.protocolFeeRouting;
  const feeToLifecycle=bamm?.measured?.feeToLpLifecycle;
  const feeToHistory=revenue?.measured?.fraxswapFeeToHistoricalBackfill;
  const yieldDistribution=revenue?.measured?.yieldDistributionCurrent;
  const frxEthLendingPool=frxEth?.measured?.v2Internals?.lendingPool;

  console.log('FRAX BOUNDED ONCHAIN CANONICAL GRAPH ENRICHMENT PASS',{
    graphEngineVersion:state.engineVersion,
    measuredSurfaces:ecosystem?.coverage?.measuredSurfaceCount,
    unknownSurfaces:ecosystem?.coverage?.sourceBoundUnknownSurfaceCount,
    sfrxUsd:{measurementState:sfrxUsd?.measurementState,blockNumber:sfrxUsd?.measured?.blockNumber,sharePriceFrxUsd:sfrxUsd?.measured?.values?.sharePriceFrxUsd,intervalStatus:sfrxUsd?.measured?.intervalEmbeddedYield?.status},
    fraxlend:{measurementState:fraxlend?.measurementState,blockNumber:fraxlend?.measured?.blockNumber,utilizationPct:fraxlend?.measured?.values?.utilizationPct,rateModelParity:fraxlend?.measured?.rateModel?.parity?.accepted},
    fxb:{measurementState:fxb?.measurementState,measuredOriginSeries:fxb?.measured?.coverage?.measuredOriginSeriesCount??null,configuredOriginSeries:fxb?.measured?.coverage?.configuredOriginSeriesCount??null,spotPrice:fxb?.measured?.epistemic?.spotPrice||'UNKNOWN',impliedYield:fxb?.measured?.epistemic?.impliedYield||'UNKNOWN'},
    fraxNet:{measurementState:fraxNet?.measurementState,status:fraxNet?.measured?.status||'UNKNOWN',measurementClass:fraxNet?.measured?.measurementClass||'UNKNOWN',mintDestinations:fraxNet?.measured?.coverage?.sourceBoundMintDestinationCount??null,redemptionDestinations:fraxNet?.measured?.coverage?.sourceBoundRedemptionDestinationCount??null,ethereumAssetRoutes:fraxNet?.measured?.coverage?.sourceBoundEthereumAssetRouteCount??null,exactBlockAnchors:fraxNet?.measured?.coverage?.exactBlockNetworkAnchorCount??null,relayJobsTotal:fraxNet?.measured?.api?.activeJobs?.totalJobs??null,relayJobsActive:fraxNet?.measured?.api?.activeJobs?.totalActive??null,relayJobCounts:fraxNet?.measured?.api?.activeJobs?.counts??null,crossChainFlowVolume:fraxNet?.measured?.epistemic?.crossChainFlowVolume||'UNKNOWN',processingEndpointsCalled:fraxNet?.measured?.epistemic?.processingEndpointsCalled??false},
    floxFxtl:{measurementState:floxFxtl?.measurementState,status:floxFxtl?.measured?.status||'UNKNOWN',blockNumber:floxFxtl?.measured?.network?.blockNumber??null,totalSupplyPoints:floxFxtl?.measured?.ledger?.totalSupplyPoints??null,currentEpoch:floxFxtl?.measured?.epistemic?.currentEpoch||'UNKNOWN',currentFarmEconomics:floxFxtl?.measured?.epistemic?.currentFarmEffectiveBalances||'UNKNOWN',companyPointExposure:floxFxtl?.measured?.epistemic?.companyPointExposure||'UNKNOWN',pointUsdValue:floxFxtl?.measured?.epistemic?.pointUsdValue||'UNKNOWN'},
    fxLiquidity:{measurementState:fxLiquidity?.measurementState,status:fxLiquidity?.measured?.status||'UNKNOWN',blockNumber:fxLiquidity?.measured?.network?.blockNumber??null,factoryPairCount:fxLiquidity?.measured?.summary?.factoryPairCount??null,frxUsdPairCount:fxLiquidity?.measured?.summary?.matchingPairCount??null,totalFrxUsdReserveRaw:fxLiquidity?.measured?.summary?.totalBaseReserveRaw??null,usdTvl:fxLiquidity?.measured?.epistemic?.usdTvl||'UNKNOWN',capitalMigration:fxLiquidity?.measured?.epistemic?.capitalMigration||'UNKNOWN'},
    bamm:{measurementState:bamm?.measurementState,blockNumber:bamm?.measured?.blockNumber,bammCount:bamm?.measured?.registry?.bammCount,activeRentedBammCount:bamm?.measured?.registry?.activeRentedBammCount},
    fraxswapRegularFlow:{status:flow?.status||'not-run-current-bamm-unavailable',regularSwapEventCount:flow?.summary?.regularSwapEventCount??null},
    fraxswapTwamm:{status:twamm?.status||'not-run-current-bamm-unavailable',virtualExecutionEventCount:twamm?.summary?.virtualExecutionEventCount??null},
    fraxswapProtocolFeeRouting:{status:protocolFee?.status||'not-run-current-bamm-unavailable',protocolFeeMintEventCount:protocolFee?.summary?.protocolFeeMintEventCount??null},
    fraxswapFeeToLpLifecycle:{status:feeToLifecycle?.status||'not-run-protocol-fee-prerequisite-unavailable',outboundTransferEventCount:feeToLifecycle?.summary?.outboundTransferEventCount??null,strictRedemptionCount:feeToLifecycle?.summary?.strictRedemptionCount??null},
    fraxswapFeeToHistoricalBackfill:{status:feeToHistory?.status||'not-run-protocol-fee-prerequisite-unavailable',protocolFeeMintEventsBackfilled:feeToHistory?.summary?.protocolFeeMintEventCountBackfilled??null,strictRedemptionsBackfilled:feeToHistory?.summary?.strictRedemptionCountBackfilled??null,continuousFeeToStateHistory:feeToHistory?.epistemic?.continuousFeeToStateHistory||'UNKNOWN'},
    revenueRoutingYieldDistribution:{measurementState:revenue?.measurementState,status:yieldDistribution?.status||'UNKNOWN',blockNumber:yieldDistribution?.network?.blockNumber??null,proxy:yieldDistribution?.distributor?.proxy??null,implementation:yieldDistribution?.distributor?.implementation??null,emittedToken:yieldDistribution?.distributor?.emittedToken??null,yieldRateRaw:yieldDistribution?.distributor?.yieldRateRaw??null,yieldDurationRaw:yieldDistribution?.distributor?.yieldDurationRaw??null,rewardArithmeticParity:yieldDistribution?.distributor?.rewardArithmeticParity??false,distributorInventoryRaw:yieldDistribution?.distributor?.emittedTokenBalanceRaw??null,upstreamFundingSource:yieldDistribution?.epistemic?.distributorFundingSource||'UNKNOWN',fraxswapFeeToLink:yieldDistribution?.epistemic?.fraxswapFeeToToDistributor||'UNKNOWN',companyCashFlow:yieldDistribution?.epistemic?.companyCashFlow||'UNKNOWN'},
    frxEth:{measurementState:frxEth?.measurementState,status:frxEth?.measured?.status||'UNKNOWN',blockNumber:frxEth?.measured?.blockNumber??null,frxEthSupply:frxEth?.measured?.asset?.totalSupply??null,sfrxEthSupply:frxEth?.measured?.vault?.totalSupply??null,sfrxEthTotalAssets:frxEth?.measured?.vault?.totalAssets??null,sharePriceFrxEth:frxEth?.measured?.vault?.sharePriceAsset??null,intervalStatus:frxEth?.measured?.intervalEmbeddedYield?.status||'UNKNOWN',validatorEconomics:frxEth?.measured?.epistemic?.validatorEconomics||'UNKNOWN',lendingIncome:frxEth?.measured?.epistemic?.lendingIncome||'UNKNOWN'},
    frxEthV2LendingPool:{status:frxEthLendingPool?.status||'UNKNOWN',blockNumber:frxEthLendingPool?.blockNumber??null,totalBorrowEth:frxEthLendingPool?.lendingPool?.totalBorrow?.amountEth??null,utilizationPct:frxEthLendingPool?.lendingPool?.utilization?.livePct??null,annualizedNominalRatePct:frxEthLendingPool?.lendingPool?.currentRateInfo?.annualizedNominalRatePct??null,interestAccruedEth:frxEthLendingPool?.lendingPool?.interestAccrued?.eth??null,pendingInterestPreviewEth:frxEthLendingPool?.preview?.interestEarned?.eth??null,previewState:frxEthLendingPool?.preview?.status||'UNKNOWN',registryPointerParity:frxEthLendingPool?.lendingPool?.registryPointerParity??null,protocolRevenue:frxEthLendingPool?.epistemic?.protocolRevenue||'UNKNOWN'},
    fpiFpis:{measurementState:fpiFpis?.measurementState,status:fpiFpis?.measured?.status||'UNKNOWN',blockNumber:fpiFpis?.measured?.blockNumber??null,fpiSupply:fpiFpis?.measured?.tokens?.FPI?.totalSupply??null,fpisSupply:fpiFpis?.measured?.tokens?.FPIS?.totalSupply??null,veFpisVotingPower:fpiFpis?.measured?.legacyVeFPIS?.totalVotingPower??null,veFpisTrackedPrincipal:fpiFpis?.measured?.legacyVeFPIS?.trackedFpisPrincipal??null,trackedPrincipalPct:fpiFpis?.measured?.legacyVeFPIS?.trackedPrincipalPctOfFpisSupply??null,pegState:fpiFpis?.measured?.pegState?.status||'UNKNOWN',treasuryYield:fpiFpis?.measured?.epistemic?.treasuryYield||'UNKNOWN',revenueRouting:fpiFpis?.measured?.epistemic?.revenueRouting||'UNKNOWN'},
    historyRetention:{version:retention.version,historicalRows:retention.historicalObservationCount,beforeBytes:retention.beforeBytes,afterBytes:retention.afterBytes,reductionPct:retention.reductionPct,softLimitBytes:retention.softLimitBytes},
    previousCheckpointSource:'explicit-published-graph-file',
    executionAuthority:ecosystem?.authority?.executionAuthority
  });
}

main().catch(error=>{console.error(error?.stack||error);process.exit(1);});
