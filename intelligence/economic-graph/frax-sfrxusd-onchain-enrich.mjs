#!/usr/bin/env node
/**
 * The Holding · Frax bounded onchain Economic Graph enrichment v1.1
 *
 * One canonical sequential Frax writer path. Each protocol atom remains a
 * bounded read-only measurement with its own epistemic contract, but all atoms
 * enrich the same Economic Graph artifact. No new workflow, scheduler,
 * orchestrator, price authority, methodology or execution authority.
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
import { collectFraxswapFlowFees, applyFraxswapFlowFees } from './frax-fraxswap-flow-fees.mjs';
import { collectFraxswapTwamm, applyFraxswapTwamm } from './frax-fraxswap-twamm.mjs';
import { collectFraxswapProtocolFeeRouting, applyFraxswapProtocolFeeRouting } from './frax-fraxswap-protocol-fee-routing.mjs';
import { collectFraxswapFeeToLifecycle, applyFraxswapFeeToLifecycle } from './frax-fraxswap-feeto-lifecycle.mjs';
import { collectFraxswapFeeToHistoryBackfill, applyFraxswapFeeToHistoryBackfill } from './frax-fraxswap-feeto-history-backfill.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const OUT=process.env.ECONOMIC_GRAPH_FILE || path.join(ROOT,'intelligence/economic-graph/economic-graph.json');
const PREVIOUS=process.env.FRAX_PREVIOUS_GRAPH_FILE || null;

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

  // FXB remains config-driven across contract generations. State/backing and
  // maturity are measured here; spot price / implied term yield are separate.
  const fxbMeasurement=await collectFraxFxbOnchain();
  applyFraxFxbOnchainMeasurement({state,previousState,measurement:fxbMeasurement});

  // FraxNet reuses this same bounded writer. Official route tables are
  // ATTRIBUTED topology, exact deployed-code anchors and read-only API state are
  // MEASURED, documented mint/redeem mechanics are MECHANICAL, and actual
  // cross-chain capital flow remains UNKNOWN until transaction/API history is
  // replayed. Processing endpoints are never called.
  const fraxNetMeasurement=await collectFraxNetCurrentState();
  applyFraxNetCurrentState({state,previousState,measurement:fraxNetMeasurement});

  // Flox / FXTL stays in this same sequential writer. Exact-block FxtlPoints
  // ledger identity and total point supply are MEASURED. Flox Rank, current
  // epoch boundaries, farm effective balances/multipliers, company balances and
  // any future token/USD value remain explicitly UNKNOWN in this atom.
  const floxFxtlMeasurement=await collectFloxFxtlCurrentState();
  applyFloxFxtlCurrentState({state,previousState,measurement:floxFxtlMeasurement});

  const previousFraxEcosystem=previousState?.protocolEvidence?.['registry-frax-ecosystem']?.latest?.observation||null;
  const previousBammMeasurement=previousFraxEcosystem?.surfaces?.fraxswapBamm?.measured||null;
  const previousFeeToHistory=previousFraxEcosystem?.surfaces?.revenueRouting?.measured?.fraxswapFeeToHistoricalBackfill||null;
  const bammMeasurement=await collectFraxBammOnchain();
  applyFraxBammOnchainMeasurement({state,previousState,measurement:bammMeasurement});

  if(bammMeasurement?.status==='ok'&&bammMeasurement?.measurementClass==='MEASURED'){
    const flow=await collectFraxswapFlowFees({currentBammMeasurement:bammMeasurement,previousBammMeasurement});
    applyFraxswapFlowFees({state,previousState,measurement:flow});

    const twamm=await collectFraxswapTwamm({currentBammMeasurement:bammMeasurement,previousBammMeasurement});
    applyFraxswapTwamm({state,previousState,measurement:twamm});

    const protocolFee=await collectFraxswapProtocolFeeRouting({currentBammMeasurement:bammMeasurement,previousBammMeasurement});
    applyFraxswapProtocolFeeRouting({state,previousState,measurement:protocolFee});

    const feeToLifecycle=await collectFraxswapFeeToLifecycle({
      currentBammMeasurement:bammMeasurement,
      previousBammMeasurement,
      protocolFeeMeasurement:protocolFee
    });
    applyFraxswapFeeToLifecycle({state,previousState,measurement:feeToLifecycle});

    const feeToHistory=await collectFraxswapFeeToHistoryBackfill({
      currentBammMeasurement:bammMeasurement,
      previousBammMeasurement,
      protocolFeeMeasurement:protocolFee,
      previousBackfillMeasurement:previousFeeToHistory
    });
    applyFraxswapFeeToHistoryBackfill({state,previousState,measurement:feeToHistory});
  }

  if(state?.authority?.executionAuthority!=='none')throw new Error('Frax bounded enrichment execution authority drift');
  fs.writeFileSync(OUT,JSON.stringify(state,null,2)+'\n');

  const ecosystem=state?.protocolEvidence?.['registry-frax-ecosystem']?.latest?.observation;
  const sfrxUsd=ecosystem?.surfaces?.frxUsdSfrxUsd;
  const fraxlend=ecosystem?.surfaces?.fraxlend;
  const fxb=ecosystem?.surfaces?.fxb;
  const fraxNet=ecosystem?.surfaces?.fraxNet;
  const floxFxtl=ecosystem?.surfaces?.fraxtalFloxFxtl;
  const bamm=ecosystem?.surfaces?.fraxswapBamm;
  const revenue=ecosystem?.surfaces?.revenueRouting;
  const flow=bamm?.measured?.swapFlowFees;
  const twamm=bamm?.measured?.twammFlow;
  const protocolFee=bamm?.measured?.protocolFeeRouting;
  const feeToLifecycle=bamm?.measured?.feeToLpLifecycle;
  const feeToHistory=revenue?.measured?.fraxswapFeeToHistoricalBackfill;

  console.log('FRAX BOUNDED ONCHAIN CANONICAL GRAPH ENRICHMENT PASS',{
    graphEngineVersion:state.engineVersion,
    measuredSurfaces:ecosystem?.coverage?.measuredSurfaceCount,
    unknownSurfaces:ecosystem?.coverage?.sourceBoundUnknownSurfaceCount,
    sfrxUsd:{
      measurementState:sfrxUsd?.measurementState,
      blockNumber:sfrxUsd?.measured?.blockNumber,
      sharePriceFrxUsd:sfrxUsd?.measured?.values?.sharePriceFrxUsd,
      intervalStatus:sfrxUsd?.measured?.intervalEmbeddedYield?.status
    },
    fraxlend:{
      measurementState:fraxlend?.measurementState,
      blockNumber:fraxlend?.measured?.blockNumber,
      utilizationPct:fraxlend?.measured?.values?.utilizationPct,
      rateModelParity:fraxlend?.measured?.rateModel?.parity?.accepted
    },
    fxb:{
      measurementState:fxb?.measurementState,
      measuredOriginSeries:fxb?.measured?.coverage?.measuredOriginSeriesCount??null,
      configuredOriginSeries:fxb?.measured?.coverage?.configuredOriginSeriesCount??null,
      spotPrice:fxb?.measured?.epistemic?.spotPrice||'UNKNOWN',
      impliedYield:fxb?.measured?.epistemic?.impliedYield||'UNKNOWN'
    },
    fraxNet:{
      measurementState:fraxNet?.measurementState,
      status:fraxNet?.measured?.status||'UNKNOWN',
      measurementClass:fraxNet?.measured?.measurementClass||'UNKNOWN',
      mintDestinations:fraxNet?.measured?.coverage?.sourceBoundMintDestinationCount??null,
      redemptionDestinations:fraxNet?.measured?.coverage?.sourceBoundRedemptionDestinationCount??null,
      ethereumAssetRoutes:fraxNet?.measured?.coverage?.sourceBoundEthereumAssetRouteCount??null,
      exactBlockAnchors:fraxNet?.measured?.coverage?.exactBlockNetworkAnchorCount??null,
      relayJobsTotal:fraxNet?.measured?.api?.activeJobs?.totalJobs??null,
      relayJobsActive:fraxNet?.measured?.api?.activeJobs?.totalActive??null,
      relayJobCounts:fraxNet?.measured?.api?.activeJobs?.counts??null,
      crossChainFlowVolume:fraxNet?.measured?.epistemic?.crossChainFlowVolume||'UNKNOWN',
      processingEndpointsCalled:fraxNet?.measured?.epistemic?.processingEndpointsCalled??false
    },
    floxFxtl:{
      measurementState:floxFxtl?.measurementState,
      status:floxFxtl?.measured?.status||'UNKNOWN',
      blockNumber:floxFxtl?.measured?.network?.blockNumber??null,
      totalSupplyPoints:floxFxtl?.measured?.ledger?.totalSupplyPoints??null,
      currentEpoch:floxFxtl?.measured?.epistemic?.currentEpoch||'UNKNOWN',
      currentFarmEconomics:floxFxtl?.measured?.epistemic?.currentFarmEffectiveBalances||'UNKNOWN',
      companyPointExposure:floxFxtl?.measured?.epistemic?.companyPointExposure||'UNKNOWN',
      pointUsdValue:floxFxtl?.measured?.epistemic?.pointUsdValue||'UNKNOWN'
    },
    bamm:{
      measurementState:bamm?.measurementState,
      blockNumber:bamm?.measured?.blockNumber,
      bammCount:bamm?.measured?.registry?.bammCount,
      activeRentedBammCount:bamm?.measured?.registry?.activeRentedBammCount
    },
    fraxswapRegularFlow:{
      status:flow?.status||'not-run-current-bamm-unavailable',
      regularSwapEventCount:flow?.summary?.regularSwapEventCount??null
    },
    fraxswapTwamm:{
      status:twamm?.status||'not-run-current-bamm-unavailable',
      virtualExecutionEventCount:twamm?.summary?.virtualExecutionEventCount??null
    },
    fraxswapProtocolFeeRouting:{
      status:protocolFee?.status||'not-run-current-bamm-unavailable',
      protocolFeeMintEventCount:protocolFee?.summary?.protocolFeeMintEventCount??null
    },
    fraxswapFeeToLpLifecycle:{
      status:feeToLifecycle?.status||'not-run-protocol-fee-prerequisite-unavailable',
      outboundTransferEventCount:feeToLifecycle?.summary?.outboundTransferEventCount??null,
      strictRedemptionCount:feeToLifecycle?.summary?.strictRedemptionCount??null
    },
    fraxswapFeeToHistoricalBackfill:{
      status:feeToHistory?.status||'not-run-protocol-fee-prerequisite-unavailable',
      protocolFeeMintEventsBackfilled:feeToHistory?.summary?.protocolFeeMintEventCountBackfilled??null,
      strictRedemptionsBackfilled:feeToHistory?.summary?.strictRedemptionCountBackfilled??null,
      continuousFeeToStateHistory:feeToHistory?.epistemic?.continuousFeeToStateHistory||'UNKNOWN'
    },
    previousCheckpointSource:'explicit-published-graph-file',
    executionAuthority:ecosystem?.authority?.executionAuthority
  });
}

main().catch(error=>{console.error(error?.stack||error);process.exit(1);});
