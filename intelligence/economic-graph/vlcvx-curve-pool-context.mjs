#!/usr/bin/env node
/**
 * The Holding · vlCVX Curve Pool Context v0.1
 * Read-only current Curve pool context for already-proven Votium → Curve gauge execution.
 * This layer does NOT claim historical votes caused current pool economics.
 */
import fs from 'node:fs';
import crypto from 'node:crypto';

const INPUT_FILE=process.env.VLCVX_VOTIUM_CURVE_GAUGE_FLOW_FILE||'intelligence/economic-graph/vlcvx-votium-curve-gauge-flow.json';
const OUTPUT_FILE=process.env.VLCVX_CURVE_POOL_CONTEXT_FILE||'intelligence/economic-graph/vlcvx-curve-pool-context.json';
const CURVE_API_BASE='https://api.curve.finance/v1';
const CURVE_API_REPO='curvefi/curve-api';
const CURVE_API_SOURCE_COMMIT='db3a08468efba830f69e43cfe99ea3f3715d2a5a';
const ENDPOINTS={
  gauges:`${CURVE_API_BASE}/getAllGauges`,
  pools:`${CURVE_API_BASE}/getPools/all/ethereum`,
  volumes:`${CURVE_API_BASE}/getVolumes/ethereum`,
};

function readJson(file){return JSON.parse(fs.readFileSync(file,'utf8'));}
function sha256File(file){return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');}
function fail(message){throw new Error(message);}
function lc(v){return String(v||'').toLowerCase();}
function isoMs(ms){return Number.isFinite(Number(ms))?new Date(Number(ms)).toISOString():null;}
function finiteOrNull(v){const n=Number(v);return Number.isFinite(n)?n:null;}
function addressOrNull(v){return /^0x[0-9a-f]{40}$/i.test(String(v||''))?String(v):null;}
function uniqueByAddress(rows){const out=new Map();for(const row of rows){const key=lc(row.gauge);if(key&&!out.has(key))out.set(key,row);}return [...out.values()];}

async function fetchCurve(endpoint,label){
  let last=null;
  for(let attempt=1;attempt<=3;attempt++){
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),20000);
    try{
      const response=await fetch(endpoint,{headers:{accept:'application/json','user-agent':'The-Holding-Curve-Context/0.1'},signal:controller.signal});
      if(!response.ok)throw new Error(`${label} HTTP ${response.status}`);
      const body=await response.json();
      if(body?.success!==true||typeof body?.data!=='object'||body.data===null)throw new Error(`${label} invalid Curve API envelope`);
      return{body,attempt};
    }catch(error){last=error;if(attempt<3)await new Promise(resolve=>setTimeout(resolve,1000*attempt));}
    finally{clearTimeout(timer);}
  }
  throw last||new Error(`${label} unavailable`);
}

function requireInput(input){
  if(input.version!=='0.1-vlcvx-votium-curve-gauge-flow'||input.status!=='shadow-cross-protocol-flow-proven')fail('Proven Votium → Curve upstream unavailable');
  if(input.coverage?.complete!==true||Number(input.coverage?.votiumGaugeCount)!==79||Number(input.coverage?.curveExecutedVotiumGaugeCount)!==79)fail('Votium → Curve upstream coverage incomplete');
  if(input.authority?.executionAuthority!=='none'||input.authority?.readOnly!==true)fail('Votium → Curve upstream authority regression');
  if(input.epistemic?.incentiveToVoteRelationship!=='CORRELATED-only-not-causal')fail('Votium → Curve causal boundary drift');
}

function normalizeGaugeDirectory(data){
  const values=Array.isArray(data)?data:Object.values(data||{});
  return values.filter(row=>lc(row.blockchainId)==='ethereum'&&addressOrNull(row.gauge));
}

function normalizePoolData(data){
  if(!Array.isArray(data?.poolData))fail('Curve pools response missing poolData');
  return data.poolData.filter(row=>addressOrNull(row.address));
}

function normalizeVolumeData(data){
  if(!Array.isArray(data?.pools))fail('Curve volumes response missing pools');
  return data.pools.filter(row=>addressOrNull(row.address));
}

function indexByAddress(rows,key='address'){
  const out=new Map();
  for(const row of rows){const address=lc(row?.[key]);if(address&&!out.has(address))out.set(address,row);}
  return out;
}

function buildContext(gaugeRow,gaugeIndex,poolIndex,volumeIndex){
  const gauge=lc(gaugeRow.gauge);
  const directory=gaugeIndex.get(gauge)||null;
  const isPool=directory?.isPool!==false&&Boolean(addressOrNull(directory?.swap));
  const poolAddress=isPool?lc(directory.swap):null;
  const pool=poolAddress?poolIndex.get(poolAddress)||null:null;
  const volume=poolAddress?volumeIndex.get(poolAddress)||null:null;
  const mapped=Boolean(directory&&isPool&&poolAddress&&pool);
  const volumeMapped=Boolean(volume);
  const tvlUsd=pool?finiteOrNull(pool.usdTotal):null;
  const tvlUsdExcludingBasePool=pool?finiteOrNull(pool.usdTotalExcludingBasePool):null;
  const volume24hUsd=volume?finiteOrNull(volume.volumeUSD):null;
  const dailyBaseApyPct=volume?finiteOrNull(volume.latestDailyApyPcent):null;
  const weeklyBaseApyPct=volume?finiteOrNull(volume.latestWeeklyApyPcent):null;
  const includedLstApyPct=volume?finiteOrNull(volume.includedApyPcentFromLsts):null;
  return{
    gauge:gaugeRow.gauge,
    mapping:{
      status:mapped?'mapped':'unknown',
      curveDirectoryMatched:Boolean(directory),
      isPoolGauge:isPool,
      poolAddress:poolAddress?directory.swap:null,
      poolName:directory?.name??pool?.name??null,
      poolShortName:directory?.shortName??null,
      registryId:pool?.registryId??null,
      poolType:directory?.type??pool?.type??null,
      factory:directory?.factory??pool?.factory??null,
      poolUrls:Array.isArray(directory?.poolUrls)?directory.poolUrls:[],
    },
    currentPoolEconomics:{
      status:mapped&&volumeMapped?'measured-current-context':'partial-current-context',
      tvlUsd,
      tvlUsdExcludingBasePool,
      volume24hUsd,
      dailyBaseApyPct,
      weeklyBaseApyPct,
      includedLstApyPct,
      virtualPrice:volume?.virtualPrice??pool?.virtualPrice??null,
      sourceReportedZeroVolume:volumeMapped&&volume24hUsd===0,
      directFeeUsd:null,
    },
    currentGaugeContext:{
      isKilled:directory?.is_killed??null,
      hasNoCrv:directory?.hasNoCrv??null,
      gaugeCrvApy:Array.isArray(directory?.gaugeCrvApy)?directory.gaugeCrvApy:null,
      gaugeFutureCrvApy:Array.isArray(directory?.gaugeFutureCrvApy)?directory.gaugeFutureCrvApy:null,
    },
    evidence:{
      gaugeToPool:'MEASURED-official-Curve-gauge-directory',
      poolTvl:'MEASURED-official-Curve-API-derived-current',
      poolVolume24h:'MEASURED-official-Curve-API-current-window',
      baseApy:'MEASURED-official-Curve-API-derived-rate',
      directFees:'UNKNOWN-not-measured-by-v0.1',
    }
  };
}

async function main(){
  const input=readJson(INPUT_FILE);requireInput(input);
  const inputHash=sha256File(INPUT_FILE);
  const fetchedAt=new Date().toISOString();
  const [gaugesRes,poolsRes,volumesRes]=await Promise.all([
    fetchCurve(ENDPOINTS.gauges,'Curve gauges'),
    fetchCurve(ENDPOINTS.pools,'Curve pools'),
    fetchCurve(ENDPOINTS.volumes,'Curve volumes'),
  ]);
  const gaugeDirectory=normalizeGaugeDirectory(gaugesRes.body.data);
  const pools=normalizePoolData(poolsRes.body.data);
  const volumes=normalizeVolumeData(volumesRes.body.data);
  const gaugeIndex=indexByAddress(gaugeDirectory,'gauge');
  const poolIndex=indexByAddress(pools,'address');
  const volumeIndex=indexByAddress(volumes,'address');

  const upstreamRows=input.rounds.flatMap(round=>round.gauges.map(gauge=>({
    roundId:Number(round.roundId),proposalId:Number(round.proposalId),roundStart:round.roundStart,
    gauge:gauge.gauge,curveExecutedWeightBps:Number(gauge.curveExecutedWeightBps),votiumVotesReceived:Number(gauge.votiumVotesReceived),
  })));
  const uniqueGaugeRows=uniqueByAddress(upstreamRows);
  const contexts=uniqueGaugeRows.map(row=>buildContext(row,gaugeIndex,poolIndex,volumeIndex));
  const contextByGauge=new Map(contexts.map(context=>[lc(context.gauge),context]));
  const rounds=input.rounds.map(round=>({
    roundId:Number(round.roundId),proposalId:Number(round.proposalId),roundStart:round.roundStart,
    temporalInterpretation:'historical vote/execution evidence joined to current Curve pool context; current pool metrics are not backfilled to the round timestamp',
    gauges:round.gauges.map(gauge=>{
      const context=contextByGauge.get(lc(gauge.gauge));
      return{
        gauge:gauge.gauge,
        curveExecutedWeightBps:Number(gauge.curveExecutedWeightBps),
        votiumVotesReceived:Number(gauge.votiumVotesReceived),
        poolAddress:context?.mapping.poolAddress??null,
        poolName:context?.mapping.poolName??null,
        currentTvlUsd:context?.currentPoolEconomics.tvlUsd??null,
        currentVolume24hUsd:context?.currentPoolEconomics.volume24hUsd??null,
        currentDailyBaseApyPct:context?.currentPoolEconomics.dailyBaseApyPct??null,
        currentWeeklyBaseApyPct:context?.currentPoolEconomics.weeklyBaseApyPct??null,
        mappingStatus:context?.mapping.status??'unknown',
        semantics:{
          voteToExecutedGaugeWeight:'ATTRIBUTED-and-execution-confirmed',
          gaugeToPool:'MEASURED-registry-mapping',
          poolMetrics:'MEASURED-current-context',
          historicalVoteToCurrentPoolEconomics:'CORRELATED-context-only-not-causal',
        }
      };
    })
  }));

  const roundGaugeObservationCount=rounds.reduce((sum,round)=>sum+round.gauges.length,0);
  const mappedRoundGaugeObservationCount=rounds.reduce((sum,round)=>sum+round.gauges.filter(g=>g.mappingStatus==='mapped').length,0);
  const uniqueGaugeCount=contexts.length;
  const mappedUniqueGaugeCount=contexts.filter(context=>context.mapping.status==='mapped').length;
  const volumeMappedUniqueGaugeCount=contexts.filter(context=>context.mapping.status==='mapped'&&context.currentPoolEconomics.volume24hUsd!==null).length;
  const complete=roundGaugeObservationCount===79&&mappedRoundGaugeObservationCount===79&&uniqueGaugeCount>0&&mappedUniqueGaugeCount===uniqueGaugeCount&&volumeMappedUniqueGaugeCount===uniqueGaugeCount;

  const state={
    version:'0.1-vlcvx-curve-pool-context',
    engineVersion:'0.1-current-curve-pool-economic-context',
    generatedAt:new Date().toISOString(),
    status:complete?'shadow-current-pool-context-proven':'shadow-partial-current-pool-context',
    purpose:'Attach official current Curve pool identity, TVL, 24h volume and base APY context to already-proven Votium → Curve executed gauge weights without treating current pool economics as a historical outcome or causal consequence of voting.',
    authority:{readOnly:true,executionAuthority:'none',capitalExecution:false,walletAuthority:false,allocationAuthority:false,recommendationAuthority:false,predictionAuthority:false,causalClaimAuthority:'none',promotionAuthority:'none',methodologyMutationAuthority:false},
    sourceBinding:{
      upstreamFile:'intelligence/economic-graph/vlcvx-votium-curve-gauge-flow.json',upstreamSha256:inputHash,
      companyRegistry:'004',candidateId:'defitea-convex-vlcvx-votium',
      curveApiRepository:CURVE_API_REPO,curveApiSourceCommit:CURVE_API_SOURCE_COMMIT,
      endpoints:ENDPOINTS,
    },
    observation:{
      fetchedAt,
      curveApiGeneratedAt:{
        gauges:isoMs(gaugesRes.body.generatedTimeMs),pools:isoMs(poolsRes.body.generatedTimeMs),volumes:isoMs(volumesRes.body.generatedTimeMs),
      },
      requestAttempts:{gauges:gaugesRes.attempt,pools:poolsRes.attempt,volumes:volumesRes.attempt},
      temporalBoundary:'Pool TVL, 24h volume and base APY are current Curve API observations at this run. They are not historical snapshots for Votium rounds 128/129.',
    },
    coverage:{
      roundCount:rounds.length,roundGaugeObservationCount,mappedRoundGaugeObservationCount,
      uniqueGaugeCount,mappedUniqueGaugeCount,volumeMappedUniqueGaugeCount,
      complete,
    },
    currentGaugePoolContexts:contexts,
    rounds,
    epistemic:{
      gaugeExecution:'MEASURED-upstream-event-proof',
      gaugeToPoolMapping:'MEASURED-official-Curve-directory',
      currentPoolTvl:'MEASURED-official-Curve-API-derived-current',
      currentPoolVolume24h:'MEASURED-official-Curve-API-current-window',
      currentBaseApy:'MEASURED-official-Curve-API-derived-rate',
      directPoolFees:'UNKNOWN-not-measured-by-v0.1',
      voteToPoolEconomicsRelationship:'CORRELATED-context-only-not-causal',
      companyIncomeConnection:'not-attributed-by-this-layer',
      primaryDriver:null,
    },
    semantics:{
      unknownIsNotZero:true,
      currentContextIsNotHistoricalOutcome:true,
      executedGaugeWeightIsNotPoolRevenue:true,
      volumeIsNotDirectFeeRevenue:true,
      baseApyIsNotRealisedCompanyIncome:true,
      correlationMustNotBePromotedToAttribution:true,
      sourceReportedZeroVolumeIsNotMissingData:true,
    }
  };
  fs.writeFileSync(OUTPUT_FILE,JSON.stringify(state,null,2)+'\n');
  console.log('VLCVX CURVE POOL CONTEXT PASS',{
    generatedAt:state.generatedAt,status:state.status,coverage:state.coverage,
    curveApiGeneratedAt:state.observation.curveApiGeneratedAt,
    directPoolFees:state.epistemic.directPoolFees,
    voteToPoolEconomics:state.epistemic.voteToPoolEconomicsRelationship,
    executionAuthority:state.authority.executionAuthority,
  });
}

main().catch(error=>{console.error(error);process.exit(1);});
