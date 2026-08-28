#!/usr/bin/env node
/**
 * Thin production wrapper around the existing canonical Economic Graph build.
 * It preserves the same writer/workflow and adds one bounded read-only Frax
 * measurement before the graph is written.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { buildCanonicalEconomicGraph } from './economic-graph-canonical-runner.mjs';
import {
  collectFraxSfrxUsdOnchain,
  applyFraxSfrxUsdOnchainMeasurement
} from './frax-sfrxusd-onchain.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const OUT=process.env.ECONOMIC_GRAPH_FILE || path.join(ROOT,'intelligence/economic-graph/economic-graph.json');
const PRODUCTIVITY=process.env.PRODUCTIVITY_DATA_FILE || path.join(ROOT,'companies/productivity-data.json');
const REWARDS=process.env.REWARDS_DATA_FILE || path.join(ROOT,'companies/rewards-data.json');
const PRODUCTIVITY_ENGINE=path.join(ROOT,'productivity/productivity-engine.mjs');

function readJson(file,required=true){
  try{return JSON.parse(fs.readFileSync(file,'utf8'));}
  catch(error){if(!required&&error?.code==='ENOENT')return null;throw error;}
}
function sha256File(file){return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');}

async function main(){
  const productivity=readJson(PRODUCTIVITY);
  const rewards=readJson(REWARDS);
  const previousState=readJson(OUT,false);
  const state=buildCanonicalEconomicGraph({
    productivity,
    rewards,
    previousState,
    sourceSha256:sha256File(PRODUCTIVITY),
    rewardsSha256:sha256File(REWARDS),
    productivityEngineSha256:sha256File(PRODUCTIVITY_ENGINE)
  });

  const measurement=await collectFraxSfrxUsdOnchain();
  applyFraxSfrxUsdOnchainMeasurement({state,previousState,measurement});

  fs.mkdirSync(path.dirname(OUT),{recursive:true});
  fs.writeFileSync(OUT,JSON.stringify(state,null,2)+'\n');

  const ecosystem=state?.protocolEvidence?.['registry-frax-ecosystem']?.latest?.observation;
  const surface=ecosystem?.surfaces?.frxUsdSfrxUsd;
  console.log('ECONOMIC GRAPH + FRAX sfrxUSD MEASUREMENT PASS',{
    graphEngineVersion:state.engineVersion,
    fraxEcosystemStatus:ecosystem?.status,
    measuredSurfaces:ecosystem?.coverage?.measuredSurfaceCount,
    unknownSurfaces:ecosystem?.coverage?.sourceBoundUnknownSurfaceCount,
    sfrxUsdMeasurementState:surface?.measurementState,
    observedAt:surface?.measured?.observedAt,
    blockNumber:surface?.measured?.blockNumber,
    sharePriceFrxUsd:surface?.measured?.values?.sharePriceFrxUsd,
    intervalStatus:surface?.measured?.intervalEmbeddedYield?.status,
    intervalEmbeddedYieldPct:surface?.measured?.intervalEmbeddedYield?.embeddedYieldPct,
    rpcEndpointId:surface?.measured?.rpc?.endpointId,
    executionAuthority:ecosystem?.authority?.executionAuthority
  });
}

main().catch(error=>{console.error(error?.stack||error);process.exit(1);});
