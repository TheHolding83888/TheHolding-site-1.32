#!/usr/bin/env node
/**
 * The Holding · Frax bounded onchain Economic Graph enrichment v0.6
 *
 * Runs only after the canonical Economic Graph runner. The current Graph state
 * is enriched sequentially through existing Frax surfaces using bounded read-only
 * exact-block measurements. Longitudinal intervals compare only against an
 * explicitly supplied published previous Graph checkpoint.
 *
 * This remains one canonical Graph writer path. It does not create a new
 * workflow, scheduler, orchestrator, price authority, methodology or execution
 * authority.
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import {
  collectFraxSfrxUsdOnchain,
  applyFraxSfrxUsdOnchainMeasurement
} from './frax-sfrxusd-onchain.mjs';
import {
  collectFraxFraxlendOnchain,
  applyFraxFraxlendOnchainMeasurement
} from './frax-fraxlend-onchain.mjs';
import {
  collectFraxFraxlendRateModel,
  applyFraxFraxlendRateModel
} from './frax-fraxlend-rate-model.mjs';
import {
  collectFraxBammOnchain,
  applyFraxBammOnchainMeasurement
} from './frax-bamm-onchain.mjs';
import {
  collectFraxswapFlowFees,
  applyFraxswapFlowFees
} from './frax-fraxswap-flow-fees.mjs';
import {
  collectFraxswapTwamm,
  applyFraxswapTwamm
} from './frax-fraxswap-twamm.mjs';

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

  // Rate-model proof is explicitly bound to the exact same Fraxlend pair/block
  // measured immediately above. If the bounded pair read itself is unavailable,
  // the already-established Fraxlend UNKNOWN state is preserved and no rate
  // relation is fabricated. A rate-model mismatch after a valid pair read is
  // also stored as UNKNOWN by the adapter rather than weakening the proof gate.
  if(fraxlendMeasurement?.status==='ok'&&fraxlendMeasurement?.measurementClass==='MEASURED'){
    const fraxlendRateModelProof=await collectFraxFraxlendRateModel({baseMeasurement:fraxlendMeasurement});
    applyFraxFraxlendRateModel({state,proof:fraxlendRateModelProof});
  }

  // BAMM is a separate Fraxtal exact-block domain. The registry-first measurement
  // is still applied through this same canonical writer. A Fraxtal/RPC failure
  // degrades only the BAMM surface to UNKNOWN; it does not fabricate zero state or
  // collapse already-proven Ethereum Frax surfaces.
  const previousBammMeasurement=previousState?.protocolEvidence?.['registry-frax-ecosystem']?.latest?.observation?.surfaces?.fraxswapBamm?.measured||null;
  const bammMeasurement=await collectFraxBammOnchain();
  applyFraxBammOnchainMeasurement({state,previousState,measurement:bammMeasurement});

  // Fraxswap pair identity is shared, but ordinary Swap flow and TWAMM virtual
  // execution are intentionally separate economic atoms. Both consume the same
  // bounded pair registry and the same pair of published Fraxtal checkpoints.
  // Gross fee units remain mechanical only; feeTo/_mintFee revenue routing is
  // still UNKNOWN until separately proven.
  if(bammMeasurement?.status==='ok'&&bammMeasurement?.measurementClass==='MEASURED'){
    const fraxswapFlowFees=await collectFraxswapFlowFees({currentBammMeasurement:bammMeasurement,previousBammMeasurement});
    applyFraxswapFlowFees({state,previousState,measurement:fraxswapFlowFees});

    const fraxswapTwamm=await collectFraxswapTwamm({currentBammMeasurement:bammMeasurement,previousBammMeasurement});
    applyFraxswapTwamm({state,previousState,measurement:fraxswapTwamm});
  }

  fs.writeFileSync(OUT,JSON.stringify(state,null,2)+'\n');

  const ecosystem=state?.protocolEvidence?.['registry-frax-ecosystem']?.latest?.observation;
  const sfrxUsd=ecosystem?.surfaces?.frxUsdSfrxUsd;
  const fraxlend=ecosystem?.surfaces?.fraxlend;
  const bamm=ecosystem?.surfaces?.fraxswapBamm;
  const flow=bamm?.measured?.swapFlowFees;
  const twamm=bamm?.measured?.twammFlow;
  console.log('FRAX BOUNDED ONCHAIN CANONICAL GRAPH ENRICHMENT PASS',{
    graphEngineVersion:state.engineVersion,
    measuredSurfaces:ecosystem?.coverage?.measuredSurfaceCount,
    unknownSurfaces:ecosystem?.coverage?.sourceBoundUnknownSurfaceCount,
    sfrxUsd:{
      measurementState:sfrxUsd?.measurementState,
      observedAt:sfrxUsd?.measured?.observedAt,
      blockNumber:sfrxUsd?.measured?.blockNumber,
      sharePriceFrxUsd:sfrxUsd?.measured?.values?.sharePriceFrxUsd,
      intervalStatus:sfrxUsd?.measured?.intervalEmbeddedYield?.status,
      intervalEmbeddedYieldPct:sfrxUsd?.measured?.intervalEmbeddedYield?.embeddedYieldPct,
      rpcEndpointId:sfrxUsd?.measured?.rpc?.endpointId
    },
    fraxlend:{
      measurementState:fraxlend?.measurementState,
      observedAt:fraxlend?.measured?.observedAt,
      blockNumber:fraxlend?.measured?.blockNumber,
      pair:fraxlend?.measured?.contracts?.pair,
      registryMembership:fraxlend?.measured?.registry?.pairMembershipProven,
      utilizationPct:fraxlend?.measured?.values?.utilizationPct,
      borrowRatePerSecond:fraxlend?.measured?.values?.borrowRatePerSecond,
      fTokenSharePriceAsset:fraxlend?.measured?.values?.fTokenSharePriceAsset,
      intervalStatus:fraxlend?.measured?.intervalEmbeddedYield?.status,
      intervalEmbeddedYieldPct:fraxlend?.measured?.intervalEmbeddedYield?.embeddedYieldPct,
      rateModelStatus:fraxlend?.measured?.rateModel?.status,
      rateModelClass:fraxlend?.measured?.rateModel?.measurementClass,
      rateModelMechanismState:fraxlend?.measured?.rateModel?.mechanismState,
      rateModelParity:fraxlend?.measured?.rateModel?.parity?.accepted,
      rateModelReproduction:fraxlend?.measured?.epistemic?.borrowRateModelReproduction,
      rpcEndpointId:fraxlend?.measured?.rpc?.endpointId
    },
    bamm:{
      measurementState:bamm?.measurementState,
      observedAt:bamm?.measured?.observedAt,
      blockNumber:bamm?.measured?.blockNumber,
      bammCount:bamm?.measured?.registry?.bammCount,
      activeRentedBammCount:bamm?.measured?.registry?.activeRentedBammCount,
      allRegistryIdentitiesProven:bamm?.measured?.registry?.allRegistryIdentitiesProven,
      rpcEndpointId:bamm?.measured?.rpc?.endpointId,
      sample:Array.isArray(bamm?.measured?.bamms)?bamm.measured.bamms.slice(0,3).map(x=>({bamm:x.bamm,pair:x.pair,utilityPct:x.values?.utilityPct,borrowRatePerSecond:x.values?.borrowRatePerSecond})):[]
    },
    fraxswapRegularFlow:{
      status:flow?.status||'not-run-current-bamm-unavailable',
      measurementClass:flow?.measurementClass||'UNKNOWN',
      fromBlockExclusive:flow?.interval?.fromBlockExclusive??null,
      toBlockInclusive:flow?.interval?.toBlockInclusive??null,
      fullRegistryInterval:flow?.coverage?.fullRegistryInterval??false,
      pairCountWithRegularSwaps:flow?.summary?.pairCountWithRegularSwaps??null,
      regularSwapEventCount:flow?.summary?.regularSwapEventCount??null,
      feeUpdateEventCount:flow?.summary?.feeUpdateEventCount??null,
      twammFlow:flow?.epistemic?.twammFlow||'UNKNOWN',
      feeRecipientSplit:flow?.epistemic?.feeRecipientSplit||'UNKNOWN'
    },
    fraxswapTwamm:{
      status:twamm?.status||'not-run-current-bamm-unavailable',
      measurementClass:twamm?.measurementClass||'UNKNOWN',
      fromBlockExclusive:twamm?.interval?.fromBlockExclusive??null,
      toBlockInclusive:twamm?.interval?.toBlockInclusive??null,
      fullRegistryInterval:twamm?.coverage?.fullRegistryInterval??false,
      pairCountWithVirtualExecution:twamm?.summary?.pairCountWithVirtualExecution??null,
      pairCountWithNewLongTermOrders:twamm?.summary?.pairCountWithNewLongTermOrders??null,
      virtualExecutionEventCount:twamm?.summary?.virtualExecutionEventCount??null,
      newLongTermOrderCount:twamm?.summary?.newLongTermOrderCount??null,
      cancelEventCount:twamm?.summary?.cancelEventCount??null,
      withdrawEventCount:twamm?.summary?.withdrawEventCount??null,
      feeUpdateEventCount:twamm?.summary?.feeUpdateEventCount??null,
      ordinarySwapFlow:twamm?.epistemic?.ordinarySwapFlow||'UNKNOWN',
      feeRecipientSplit:twamm?.epistemic?.feeRecipientSplit||'UNKNOWN'
    },
    previousCheckpointSource:'explicit-published-graph-file',
    executionAuthority:ecosystem?.authority?.executionAuthority
  });
}

main().catch(error=>{console.error(error?.stack||error);process.exit(1);});
