#!/usr/bin/env node
/**
 * The Holding · registry-wide ve-gauge protocol lifecycle adapter v0.1
 *
 * First production instantiation: Velodrome / veVELO.
 *
 * This layer intentionally reuses canonical Productivity + Rewards evidence.
 * It does not add a collector, writer, workflow, market-data authority, Brain,
 * recommendation lane or execution authority. Reference productivity, locked
 * exposure, accrued rewards and vote/pool history remain separate economic
 * atoms. Their co-existence is descriptive unless a mechanical identity is
 * explicitly proven.
 */

import crypto from 'node:crypto';

export const VELODROME_PROTOCOL_ID='registry-velodrome-vevelo';
export const VE_GAUGE_SENSOR_VERSION='0.1-registry-ve-gauge-sensor';
const MAX_OBSERVATIONS=1000;
const MAX_TRANSITIONS=2000;
const APR_TOLERANCE_PCT_POINTS=0.01;
const MAX_REWARDS_AGE_SECONDS=8*24*60*60;

export const VELODROME_CONFIG=Object.freeze({
  protocolId:VELODROME_PROTOCOL_ID,
  label:'Velodrome / veVELO',
  protocol:'Velodrome',
  chain:'Optimism',
  engineId:'velodrome_vevelo',
  principalSymbol:'VELO',
  sourceUrl:'https://www.40acres.finance/',
  sourceType:'official-frontend',
  rewardRoute:'velodrome-ve',
  rewardProtocolPrefix:'Velodrome',
  nativeCadence:'weekly'
});

function fail(message){throw new Error(message);}
function finite(value){return value!==null&&value!==undefined&&value!==''&&Number.isFinite(Number(value));}
function numberOrNull(value){return finite(value)?Number(value):null;}
function round(value,digits=8){const n=Number(value);return Number.isFinite(n)?Number(n.toFixed(digits)):null;}
function sha256Text(text){return crypto.createHash('sha256').update(text).digest('hex');}
function stageRank(order,stage){return order.indexOf(stage);}
function check(id,pass,stage,detail,evidenceClass='measured'){return{id,pass:Boolean(pass),stage,evidenceClass,detail};}
function saneApr(value){return finite(value)&&Number(value)>=-100&&Number(value)<=500;}
function validSha(value){return /^[0-9a-f]{64}$/i.test(String(value||''));}
function positiveAmount(row){
  if(row?.amountRaw!==null&&row?.amountRaw!==undefined&&row?.amountRaw!==''){
    try{return BigInt(String(row.amountRaw))>0n;}catch{}
  }
  return finite(row?.amount)&&Number(row.amount)>0;
}
function evidenceSummary(checks){return{
  total:checks.length,
  passed:checks.filter(x=>x.pass).length,
  failed:checks.filter(x=>!x.pass).length,
  canonicalAtoms:checks.filter(x=>x.pass&&x.stage==='canonical').length,
  verifiedAtoms:checks.filter(x=>x.pass&&x.stage==='verified').length,
  shadowAtoms:checks.filter(x=>x.pass&&x.stage==='shadow').length
};}

function referenceFormula(engine){
  const weeklyRewardUsd=Number(engine?.details?.weekly);
  const impliedVeNftValueUsd=Number(engine?.details?.impliedVeNftValue);
  const periodsPerYear=52;
  const canonicalAprPct=Number(engine?.aprLatest);
  if(!(weeklyRewardUsd>=0)||!(impliedVeNftValueUsd>0)||!Number.isFinite(canonicalAprPct)){
    return {status:'unavailable',weeklyRewardUsd:numberOrNull(weeklyRewardUsd),impliedVeNftValueUsd:numberOrNull(impliedVeNftValueUsd),periodsPerYear,reproducedAprPct:null,canonicalAprPct:numberOrNull(canonicalAprPct),parityDeltaPctPoints:null,parityOk:false};
  }
  const reproducedAprPct=(weeklyRewardUsd/impliedVeNftValueUsd)*periodsPerYear*100;
  const parityDeltaPctPoints=reproducedAprPct-canonicalAprPct;
  return {
    status:'reproduced',
    weeklyRewardUsd:round(weeklyRewardUsd,8),
    impliedVeNftValueUsd:round(impliedVeNftValueUsd,8),
    periodsPerYear,
    reproducedAprPct:round(reproducedAprPct,6),
    canonicalAprPct:round(canonicalAprPct,6),
    parityDeltaPctPoints:round(parityDeltaPctPoints,6),
    parityOk:Math.abs(parityDeltaPctPoints)<=APR_TOLERANCE_PCT_POINTS,
    formula:'weekly_reward_usd / implied_veNFT_value_usd * 52 * 100',
    interpretation:'reference-productivity-simulator-identity-not-realized-company-return'
  };
}

function collectExposure(productivity,config){
  const rows=[];
  for(const [companyKey,company] of Object.entries(productivity?.companies||{})){
    for(const position of Array.isArray(company?.breakdown)?company.breakdown:[]){
      if(position?.engineId!==config.engineId||!(Number(position?.units)>0))continue;
      rows.push({
        companyKey,
        companyName:company?.name||companyKey,
        registry:company?.registry||null,
        engineId:position.engineId,
        principalId:position?.principalId||null,
        units:round(position.units,12),
        productiveValueUsd:finite(position?.value)?round(position.value,8):null,
        aprPct:finite(position?.apr)?round(position.apr,6):null,
        engineStatus:position?.engineStatus||productivity?.engines?.[position.engineId]?.status||null
      });
    }
  }
  const companyKeys=[...new Set(rows.map(x=>x.companyKey))].sort();
  return {
    rows,
    companyKeys,
    companyCount:companyKeys.length,
    positionCount:rows.length,
    totalLockedUnits:round(rows.reduce((sum,row)=>sum+Number(row.units||0),0),12),
    knownProductiveValueUsd:round(rows.reduce((sum,row)=>sum+(finite(row.productiveValueUsd)?Number(row.productiveValueUsd):0),0),8)
  };
}

function rewardFingerprint(row){
  return sha256Text(JSON.stringify({
    route:row.route||null,
    protocol:row.protocol||null,
    chain:row.chain||null,
    walletAlias:row.walletAlias||null,
    wallet:row.wallet||null,
    tokenId:row.tokenId??row.veNftTokenId??row.nftId??row?.meta?.tokenId??null,
    token:row.token||null,
    symbol:row.symbol||null,
    amountRaw:row.amountRaw??null,
    amount:row.amount??null,
    rewardContract:row.rewardContract||row.contract||null
  }));
}

function collectRewardRows(rewards,config){
  const stack=[rewards];
  const unique=new Map();
  while(stack.length){
    const value=stack.pop();
    if(!value||typeof value!=='object')continue;
    if(Array.isArray(value)){
      for(let i=value.length-1;i>=0;i--)stack.push(value[i]);
      continue;
    }
    const routeMatch=value.route===config.rewardRoute;
    const protocolMatch=String(value.protocol||'').startsWith(config.rewardProtocolPrefix);
    const chainMatch=!value.chain||value.chain===config.chain;
    const tokenLike=Boolean(value.token||value.symbol);
    if(routeMatch&&protocolMatch&&chainMatch&&tokenLike&&positiveAmount(value)){
      const row={
        route:value.route,
        protocol:value.protocol,
        chain:value.chain||config.chain,
        walletAlias:value.walletAlias||null,
        wallet:value.wallet||null,
        tokenId:String(value.tokenId??value.veNftTokenId??value.nftId??value?.meta?.tokenId??'' )||null,
        token:value.token||null,
        symbol:value.symbol||null,
        amountRaw:value.amountRaw!==undefined&&value.amountRaw!==null?String(value.amountRaw):null,
        amount:finite(value.amount)?round(value.amount,12):null,
        decimals:finite(value.decimals)?Number(value.decimals):null,
        usdValue:finite(value.usdValue)?round(value.usdValue,8):(finite(value.valueUsd)?round(value.valueUsd,8):null),
        state:value.state||value.rewardState||value.classification||null,
        rewardContract:value.rewardContract||value.contract||null
      };
      unique.set(rewardFingerprint(row),row);
    }
    for(const child of Object.values(value))if(child&&typeof child==='object')stack.push(child);
  }
  const rows=[...unique.values()];
  const symbols=[...new Set(rows.map(x=>x.symbol).filter(Boolean))].sort();
  const wallets=[...new Set(rows.map(x=>x.walletAlias||x.wallet).filter(Boolean))].sort();
  const tokenIds=[...new Set(rows.map(x=>x.tokenId).filter(Boolean))].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
  const knownUsdValue=round(rows.reduce((sum,row)=>sum+(finite(row.usdValue)?Number(row.usdValue):0),0),8);
  return {rows,symbols,wallets,tokenIds,rowCount:rows.length,knownUsdValue};
}

function collectVoteHistory(rewards,config,rewardTokenIds=[]){
  const cache=rewards?.internalState?.historicalVoteCache;
  const rows=[];
  if(cache&&typeof cache==='object'){
    const rewardSet=new Set(rewardTokenIds.map(String));
    const candidates=Object.entries(cache).filter(([key,value])=>key.startsWith('optimism:')||value?.providerKey==='optimism');
    const matched=rewardSet.size?candidates.filter(([key])=>rewardSet.has(String(key.split(':').at(-1)))):candidates;
    const selected=matched.length?matched:candidates;
    for(const [cacheKey,value] of selected){
      const pools=Array.isArray(value?.pools)?value.pools.filter(Boolean):[];
      rows.push({
        cacheKey,
        tokenId:String(cacheKey.split(':').at(-1)||'' )||null,
        providerKey:value?.providerKey||config.chain.toLowerCase(),
        complete:value?.complete===true,
        poolCount:pools.length,
        uniquePools:[...new Set(pools)].sort(),
        firstVoteBlock:finite(value?.firstVoteBlock)?Number(value.firstVoteBlock):null,
        lastVoteBlock:finite(value?.lastVoteBlock)?Number(value.lastVoteBlock):null,
        throughBlock:finite(value?.throughBlock)?Number(value.throughBlock):null,
        mintBlock:finite(value?.mintDiscovery?.blockNumber)?Number(value.mintDiscovery.blockNumber):null
      });
    }
  }
  const uniquePools=[...new Set(rows.flatMap(x=>x.uniquePools))].sort();
  return {
    rows,
    veNftCount:rows.length,
    completeVeNftCount:rows.filter(x=>x.complete).length,
    totalPoolReferences:rows.reduce((sum,row)=>sum+row.poolCount,0),
    uniquePoolCount:uniquePools.length,
    uniquePools,
    scope:rewardTokenIds.length?'reward-route-tokenIds-cross-matched-to-bounded-history-cache':'bounded-optimism-ve-vote-history-cache',
    historyBoundary:'collector-defined fresh 180-day Voted tail plus persisted validated baseline; older unresolved history is UNKNOWN, never zero'
  };
}

function rewardFreshness(productivity,rewards){
  const p=Date.parse(productivity?.generatedAt||'');
  const r=Date.parse(rewards?.generatedAt||'');
  const ageSeconds=Number.isFinite(p)&&Number.isFinite(r)?Math.max(0,(p-r)/1000):null;
  return {productivityGeneratedAt:productivity?.generatedAt||null,rewardsGeneratedAt:rewards?.generatedAt||null,ageSeconds:round(ageSeconds,3),withinBound:finite(ageSeconds)&&Number(ageSeconds)<=MAX_REWARDS_AGE_SECONDS,maxAgeSeconds:MAX_REWARDS_AGE_SECONDS};
}

function stableObservationCore(observation){return{
  observedAt:observation.observedAt,
  snapshotKey:observation.snapshotKey,
  aprPct:observation.referenceProductivity.currentAprPct,
  formulaParity:observation.referenceProductivity.formula.parityDeltaPctPoints,
  companyKeys:observation.registryExposure.companyKeys,
  rewardRows:observation.accruedRewards.rowCount,
  rewardSymbols:observation.accruedRewards.symbols,
  voteVeNfts:observation.votePoolHistory.veNftCount,
  votePools:observation.votePoolHistory.uniquePoolCount,
  productivitySha256:observation.provenance.productivitySha256,
  rewardsSha256:observation.provenance.rewardsSha256
};}

function validatedSnapshotKey(observation){
  if(observation?.epistemic?.currentCompositeObservation!=='validated-current-composite')return null;
  return observation?.snapshotKey||null;
}

export function buildVeGaugeRegistryObservation({productivity,rewards,productivitySha256,rewardsSha256,config}){
  if(!productivity||typeof productivity!=='object')fail(`${config.label} lifecycle requires Productivity state`);
  if(!rewards||typeof rewards!=='object')fail(`${config.label} lifecycle requires Rewards state`);
  if(!validSha(productivitySha256)||!validSha(rewardsSha256))fail(`${config.label} lifecycle source SHA-256 missing`);
  const engine=productivity?.engines?.[config.engineId];
  if(!engine)fail(`${config.label} canonical Productivity engine missing`);
  if(engine?.protocol!==config.protocol||engine?.principalSymbol!==config.principalSymbol)fail(`${config.label} Productivity identity drift`);
  if(engine?.sourceUrl!==config.sourceUrl||engine?.sourceType!==config.sourceType)fail(`${config.label} Productivity source authority drift`);
  if(engine?.nativeCadence!==config.nativeCadence)fail(`${config.label} native cadence drift`);
  const formula=referenceFormula(engine);
  const referenceCurrent=engine.status==='ok'&&saneApr(engine.aprLatest)&&formula.parityOk;
  const exposure=collectExposure(productivity,config);
  const accrued=collectRewardRows(rewards,config);
  const voteHistory=collectVoteHistory(rewards,config,accrued.tokenIds);
  const freshness=rewardFreshness(productivity,rewards);
  const methodology=String(rewards?.methodology?.aerodromeVelodrome||'');
  const rewardsPolicyBound=methodology.includes('veVELO')&&methodology.includes('180-day')&&methodology.toLowerCase().includes('distributed wallet payouts are not counted');
  const observedAt=productivity.generatedAt||engine.lastUpdatedAt;
  if(!Number.isFinite(Date.parse(observedAt)))fail(`${config.label} observation timestamp invalid`);
  const compositeValidated=referenceCurrent&&exposure.companyCount>=2&&accrued.rowCount>0&&voteHistory.completeVeNftCount>0&&voteHistory.uniquePoolCount>0&&freshness.withinBound&&rewardsPolicyBound;
  const observation={
    observedAt,
    snapshotKey:productivity.snapshotKey||String(observedAt).slice(0,10),
    protocol:config.protocol,
    scope:'registry-wide-multi-company',
    mechanism:'veNFT governance lock + votes/pools + accrued reward-route context',
    referenceProductivity:{
      engineId:config.engineId,
      status:engine.status||null,
      currentAprPct:numberOrNull(engine.aprLatest),
      nativeCadence:engine.nativeCadence||null,
      sourceUrl:engine.sourceUrl||null,
      sourceType:engine.sourceType||null,
      sourceMetric:engine.sourceMetric||null,
      formula,
      stateClass:referenceCurrent?'measured-current-formula-reproduced':'warming-formula-not-proven'
    },
    registryExposure:{
      companyCount:exposure.companyCount,
      positionCount:exposure.positionCount,
      companyKeys:exposure.companyKeys,
      totalLockedUnits:exposure.totalLockedUnits,
      knownProductiveValueUsd:exposure.knownProductiveValueUsd,
      rows:exposure.rows,
      stateClass:exposure.companyCount>=2?'measured-registry-wide-exposure':'partial-registry-exposure'
    },
    accruedRewards:{
      sourceClass:'canonical-rewards-route-state',
      route:config.rewardRoute,
      chain:config.chain,
      rowCount:accrued.rowCount,
      symbols:accrued.symbols,
      walletCount:accrued.wallets.length,
      wallets:accrued.wallets,
      tokenIds:accrued.tokenIds,
      knownUsdValue:accrued.knownUsdValue,
      rows:accrued.rows,
      methodologyBound:rewardsPolicyBound,
      accountingBoundary:'accrued protocol-side rewards only; distributed wallet payouts and realized cash flow are excluded'
    },
    votePoolHistory:voteHistory,
    freshness,
    provenance:{
      productivityFile:'companies/productivity-data.json',
      rewardsFile:'companies/rewards-data.json',
      productivityGeneratedAt:productivity.generatedAt||null,
      rewardsGeneratedAt:rewards.generatedAt||null,
      productivitySnapshotKey:productivity.snapshotKey||null,
      productivitySha256,
      rewardsSha256
    },
    epistemic:{
      observationClass:'registry-wide-ve-gauge-protocol-sensor',
      currentCompositeObservation:compositeValidated?'validated-current-composite':'warming-current-composite',
      referenceAprIdentity:formula.parityOk?'ATTRIBUTED-mechanical-reference-simulator-identity':'UNKNOWN-formula-parity-not-proven',
      currentLockedExposure:'MEASURED-canonical-productivity-company-state',
      accruedRewards:'MEASURED-canonical-rewards-route-state',
      historicalVotesAndPools:voteHistory.completeVeNftCount>0?'MEASURED-bounded-vote-cache':'UNKNOWN-vote-history-not-materialized',
      voteToRewardOutcome:'CORRELATED-context-only-not-causal',
      voteToPoolEconomicOutcome:'UNKNOWN-no-end-to-end-current-pool-fee-attribution',
      referenceAprToRealizedCompanyReturn:'UNKNOWN-reference-apr-is-not-realized-income',
      causalAttribution:'unresolved-beyond-proven-reference-formula',
      protocolWidePrimaryDriver:null,
      predictionAuthority:'none',
      recommendationAuthority:'none',
      executionAuthority:'none'
    }
  };
  observation.id=`velodrome:${observation.snapshotKey}:${sha256Text(JSON.stringify(stableObservationCore(observation))).slice(0,20)}`;
  return observation;
}

function buildMovement(current,prior){return{
  priorObservationId:prior?.id||null,
  comparable:Boolean(prior),
  referenceAprDeltaPctPoints:prior&&finite(current.referenceProductivity.currentAprPct)&&finite(prior.referenceProductivity?.currentAprPct)?round(Number(current.referenceProductivity.currentAprPct)-Number(prior.referenceProductivity.currentAprPct),6):null,
  companyCountDelta:prior?Number(current.registryExposure.companyCount)-Number(prior.registryExposure?.companyCount||0):null,
  lockedUnitsDelta:prior?round(Number(current.registryExposure.totalLockedUnits||0)-Number(prior.registryExposure?.totalLockedUnits||0),8):null,
  rewardRowCountDelta:prior?Number(current.accruedRewards.rowCount)-Number(prior.accruedRewards?.rowCount||0):null,
  uniquePoolCountDelta:prior?Number(current.votePoolHistory.uniquePoolCount)-Number(prior.votePoolHistory?.uniquePoolCount||0):null,
  note:'Like-for-like Velodrome observations only. APR/reward/vote/pool co-movement is descriptive and never promoted to causality by this delta.'
};}

function transitionFingerprint(protocolId,from,to,basis){return sha256Text(JSON.stringify({protocolId,from,to,basis}));}

export function applyVeGaugeRegistryLifecycle({state,previousState,productivity,rewards,productivitySha256,rewardsSha256,policy,config}){
  if(!state||typeof state!=='object')fail(`${config.label} lifecycle requires Economic Graph state`);
  if(state?.authority?.executionAuthority!=='none'||state?.authority?.causalClaimAuthority!=='none')fail(`${config.label} lifecycle refuses Economic Graph authority drift`);
  if(!state?.protocolLifecycle||state.protocolLifecycle.authority?.executionAuthority!=='none'||state.protocolLifecycle.authority?.workflowDispatchAuthority!==false)fail(`Base Protocol Lifecycle must run before ${config.label} adapter`);
  const p=policy?.protocols?.[config.protocolId];
  if(!p)fail(`${config.label} lifecycle policy missing`);
  if(!Array.isArray(policy?.stageOrder)||policy.stageOrder.join('>')!=='discovery>shadow>verified>canonical')fail(`${config.label} lifecycle stage order drift`);
  const current=buildVeGaugeRegistryObservation({productivity,rewards,productivitySha256,rewardsSha256,config});
  const previousRows=Array.isArray(previousState?.protocolSensors?.[config.protocolId]?.observations)?previousState.protocolSensors[config.protocolId].observations:[];
  const rows=[...previousRows];
  if(!rows.some(x=>x?.id===current.id))rows.push(current);
  const observations=rows.slice(-MAX_OBSERVATIONS);
  const latest=observations.at(-1);
  const prior=[...observations].reverse().find(x=>x?.id!==latest?.id)||null;
  const validatedObservations=observations.filter(x=>validatedSnapshotKey(x)!==null);
  const validatedSnapshotKeys=[...new Set(validatedObservations.map(validatedSnapshotKey))];
  const validatedSnapshotCount=validatedSnapshotKeys.length;
  const requiredValidatedSnapshotCount=Number(p.verifiedMinimumDistinctSnapshotCount||2);
  const checks=[
    check('sensor-materialized',true,'shadow',`${config.label} registry-wide sensor is materialized from canonical Productivity + Rewards.`,'sensor-state'),
    check('reference-formula-parity',latest.referenceProductivity.stateClass==='measured-current-formula-reproduced'&&latest.referenceProductivity.formula?.parityOk===true,'verified','Reference APR simulator identity is reproduced within canonical tolerance.','mechanical-identity'),
    check('registry-exposure-breadth',Number(latest.registryExposure.companyCount)>=2&&Number(latest.registryExposure.positionCount)>=2,'verified','At least two current registry companies/positions expose the veVELO mechanism.','registry-state'),
    check('current-accrued-reward-route',latest.accruedRewards.methodologyBound===true&&Number(latest.accruedRewards.rowCount)>0,'verified','Canonical Rewards contains positive current Velodrome ve-route reward evidence under bounded accounting.','protocol-reward-state'),
    check('bounded-vote-pool-history',Number(latest.votePoolHistory.veNftCount)>0&&Number(latest.votePoolHistory.completeVeNftCount)===Number(latest.votePoolHistory.veNftCount)&&Number(latest.votePoolHistory.uniquePoolCount)>0,'verified','Bounded Optimism veNFT vote history is materialized with complete cached pool sets.','longitudinal-vote-state'),
    check('rewards-freshness',latest.freshness.withinBound===true,'verified',`Rewards evidence is within the ${MAX_REWARDS_AGE_SECONDS}s freshness bound relative to Productivity.`,'freshness'),
    check('distinct-snapshot-depth',validatedSnapshotCount>=requiredValidatedSnapshotCount,'verified',`At least ${requiredValidatedSnapshotCount} distinct canonical weekly Productivity snapshots are validated; repeated observations of one week do not count twice.`,'longitudinal-observation'),
    check('causal-boundary-preserved',latest.epistemic.voteToRewardOutcome==='CORRELATED-context-only-not-causal'&&latest.epistemic.voteToPoolEconomicOutcome.startsWith('UNKNOWN-')&&latest.epistemic.protocolWidePrimaryDriver===null,'canonical','Votes/rewards/pools remain non-causal until a mechanical downstream identity is proven.','epistemic-boundary'),
    check('end-to-end-vote-gauge-pool-fee-accounting',false,'canonical','Canonical promotion remains blocked until vote → gauge/pool execution → current pool fee/incentive accounting is mechanically proven.','mechanical-execution')
  ];
  const verifiedIds=['reference-formula-parity','registry-exposure-breadth','current-accrued-reward-route','bounded-vote-pool-history','rewards-freshness','distinct-snapshot-depth'];
  const verifiedGate=verifiedIds.every(id=>checks.find(x=>x.id===id)?.pass);
  const canonicalGate=verifiedGate&&checks.find(x=>x.id==='causal-boundary-preserved')?.pass&&checks.find(x=>x.id==='end-to-end-vote-gauge-pool-fee-accounting')?.pass;
  const stage=canonicalGate?'canonical':(verifiedGate?'verified':'shadow');
  const previousProtocol=previousState?.protocolLifecycle?.protocols?.[config.protocolId]||null;
  const priorStage=previousProtocol?.maturityStage||null;
  const basis=checks.map(x=>[x.id,x.pass,x.stage]);
  const changed=priorStage!==null&&priorStage!==stage;
  const fingerprint=changed?transitionFingerprint(config.protocolId,priorStage,stage,basis):null;
  const previousTransitions=Array.isArray(state.protocolLifecycle?.transitions)?state.protocolLifecycle.transitions:[];
  const transitions=[...previousTransitions];
  if(fingerprint&&!transitions.some(x=>x?.fingerprint===fingerprint))transitions.push({fingerprint,protocolId:config.protocolId,from:priorStage,to:stage,observedAt:latest.observedAt,automatic:true,reason:'deterministic-pre-approved-evidence-gate'});
  const protocolResult={
    protocolId:config.protocolId,
    label:p.label||config.label,
    maturityStage:stage,
    operatingMode:stage==='canonical'?'continuous-monitoring':'shadow-monitoring',
    automaticallyEvaluated:true,
    automaticallyPromoted:priorStage!==null&&stageRank(policy.stageOrder,stage)>stageRank(policy.stageOrder,priorStage),
    automaticallyRegressed:priorStage!==null&&stageRank(policy.stageOrder,stage)<stageRank(policy.stageOrder,priorStage),
    evidence:evidenceSummary(checks),
    checks,
    blockers:stage==='canonical'?[]:checks.filter(x=>!x.pass).map(x=>x.id),
    unknowns:[
      'why Velodrome Reference APR changes remains UNKNOWN outside the reproduced simulator identity',
      'vote → accrued reward and vote → pool economic outcome causality remains unresolved',
      'pre-boundary historical vote state outside the collector cache is UNKNOWN, never zero',
      'Reference APR is not realized company return or Realised Cash Flow'
    ],
    longitudinalEvidence:{
      validatedObservationCount:validatedObservations.length,
      validatedSnapshotCount,
      requiredValidatedSnapshotCount,
      validatedSnapshotKeys
    },
    priorMaturityStage:priorStage,
    transitionFingerprint:fingerprint,
    epistemicBoundary:'Protocol-wide maturity never upgrades unproven vote/reward/pool causality or execution authority.'
  };
  const protocols={...(state.protocolLifecycle.protocols||{}),[config.protocolId]:protocolResult};
  const stageCounts=Object.values(protocols).reduce((acc,row)=>{acc[row.maturityStage]=(acc[row.maturityStage]||0)+1;return acc;},{});
  return {
    ...state,
    protocolLifecycle:{
      ...state.protocolLifecycle,
      scope:policy.scope,
      semantics:{...(state.protocolLifecycle.semantics||{}),...(policy.laws||{}),protocolWideCanonicalDoesNotEraseUnknownEdges:true},
      summary:{protocolCount:Object.keys(protocols).length,stageCounts,automaticTransitionsRecorded:transitions.slice(-MAX_TRANSITIONS).length},
      protocols,
      transitions:transitions.slice(-MAX_TRANSITIONS)
    },
    protocolSensors:{
      ...(state.protocolSensors||{}),
      [config.protocolId]:{
        version:VE_GAUGE_SENSOR_VERSION,
        status:stage==='canonical'?'continuous-monitoring':(stage==='verified'?'verified-shadow-monitoring':'shadow-observation-active'),
        identity:{protocol:config.protocol,principalSymbol:config.principalSymbol,chain:config.chain,scope:'registry-wide-multi-company',family:'ve-gauge'},
        latest:{observation:latest,movement:buildMovement(latest,prior)},
        observationCount:observations.length,
        validatedObservationCount:validatedObservations.length,
        validatedSnapshotCount,
        validatedSnapshotKeys,
        observations,
        authority:{executionAuthority:'none',capitalExecution:false,walletAuthority:false,allocationAuthority:false,causalClaimAuthority:'none',recommendationAuthority:'none',predictionAuthority:'none'}
      }
    }
  };
}

export function applyVelodromeLifecycle(args){
  return applyVeGaugeRegistryLifecycle({...args,config:VELODROME_CONFIG});
}
