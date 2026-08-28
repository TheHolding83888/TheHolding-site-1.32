#!/usr/bin/env node
/**
 * The Holding · Frax bounded onchain Economic Graph enrichment v0.3
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
  // measured immediately above. Failure keeps the pair surface MEASURED while
  // rate-model causality remains UNKNOWN; it never fabricates a rate relation.
  const fraxlendRateModelProof=await collectFraxFraxlendRateModel({baseMeasurement:fraxlendMeasurement});
  applyFraxFraxlendRateModel({state,proof:fraxlendRateModelProof});

  fs.writeFileSync(OUT,JSON.stringify(state,null,2)+'\n');

  const ecosystem=state?.protocolEvidence?.['registry-frax-ecosystem']?.latest?.observation;
  const sfrxUsd=ecosystem?.surfaces?.frxUsdSfrxUsd;
  const fraxlend=ecosystem?.surfaces?.fraxlend;
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
    previousCheckpointSource:'explicit-published-graph-file',
    executionAuthority:ecosystem?.authority?.executionAuthority
  });
}

main().catch(error=>{console.error(error?.stack||error);process.exit(1);});
