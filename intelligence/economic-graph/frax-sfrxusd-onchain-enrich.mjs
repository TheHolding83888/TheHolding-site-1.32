#!/usr/bin/env node
/**
 * The Holding · Frax sfrxUSD Economic Graph enrichment v0.1
 *
 * Runs only after the canonical Economic Graph runner. The current Graph state
 * is enriched with one bounded read-only sfrxUSD exact-block measurement while
 * interval history compares only against an explicitly supplied published
 * previous Graph checkpoint.
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import {
  collectFraxSfrxUsdOnchain,
  applyFraxSfrxUsdOnchainMeasurement
} from './frax-sfrxusd-onchain.mjs';

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

  const measurement=await collectFraxSfrxUsdOnchain();
  applyFraxSfrxUsdOnchainMeasurement({state,previousState,measurement});
  fs.writeFileSync(OUT,JSON.stringify(state,null,2)+'\n');

  const ecosystem=state?.protocolEvidence?.['registry-frax-ecosystem']?.latest?.observation;
  const surface=ecosystem?.surfaces?.frxUsdSfrxUsd;
  console.log('FRAX sfrxUSD CANONICAL GRAPH ENRICHMENT PASS',{
    graphEngineVersion:state.engineVersion,
    measurementState:surface?.measurementState,
    measuredSurfaces:ecosystem?.coverage?.measuredSurfaceCount,
    unknownSurfaces:ecosystem?.coverage?.sourceBoundUnknownSurfaceCount,
    observedAt:surface?.measured?.observedAt,
    blockNumber:surface?.measured?.blockNumber,
    sharePriceFrxUsd:surface?.measured?.values?.sharePriceFrxUsd,
    intervalStatus:surface?.measured?.intervalEmbeddedYield?.status,
    intervalEmbeddedYieldPct:surface?.measured?.intervalEmbeddedYield?.embeddedYieldPct,
    rpcEndpointId:surface?.measured?.rpc?.endpointId,
    previousCheckpointSource:'explicit-published-graph-file',
    executionAuthority:ecosystem?.authority?.executionAuthority
  });
}

main().catch(error=>{console.error(error?.stack||error);process.exit(1);});
