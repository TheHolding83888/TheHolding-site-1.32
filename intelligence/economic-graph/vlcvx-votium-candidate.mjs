#!/usr/bin/env node
/**
 * The Holding · Defitea vlCVX / Votium Economic Graph candidate v0.1
 *
 * Shadow-only economic interpretation over already-canonical Productivity and
 * Rewards state. No second collector is introduced here.
 *
 * The candidate keeps three facts separate:
 *   1) Reference APR decomposition published by the canonical Productivity engine;
 *   2) Defitea's measured current vlCVX route (Votium → The Union);
 *   3) current / legacy claimable reward inventory from canonical Rewards state.
 *
 * Reference APR is not realised income. Reward inventory is not proof that any
 * individual incentive caused a later vote, fee, liquidity or company outcome.
 */

import crypto from 'node:crypto';

export const VLCVX_CANDIDATE_ID = 'defitea-convex-vlcvx-votium';
export const VLCVX_CANDIDATE_VERSION = '0.1-vlcvx-votium-shadow-admission';
const MULTI_CANDIDATE_LAYER_VERSION = '0.2-multi-candidate-shadow-admission';
const APR_TOLERANCE_PCT_POINTS = 0.0001;
const MAX_OBSERVATIONS = 1000;

function fail(message){throw new Error(message);}
function finite(value,label){const n=Number(value);if(!Number.isFinite(n))fail(`${label} must be finite`);return n;}
function finiteOrNull(value){const n=Number(value);return Number.isFinite(n)?n:null;}
function round(value,digits=8){const n=Number(value);return Number.isFinite(n)?Number(n.toFixed(digits)):null;}
function delta(current,prior,digits=8){return Number.isFinite(Number(current))&&Number.isFinite(Number(prior))?round(Number(current)-Number(prior),digits):null;}
function sha256Text(text){return crypto.createHash('sha256').update(text).digest('hex');}
function findDefitea(container){
  const companies=container?.companies;
  if(!companies||typeof companies!=='object')fail('companies map missing');
  if(companies['defitea.eth'])return companies['defitea.eth'];
  const rows=Object.entries(companies).filter(([key,c])=>[key,c?.name,c?.ens,c?.company,c?.label].filter(Boolean).some(x=>String(x).toLowerCase().includes('defitea')));
  if(rows.length!==1)fail(`Expected exactly one Defitea row, found ${rows.length}`);
  return rows[0][1];
}
function rewardSummary(rows,{zeroWhenEmpty=false}={}){
  const priced=rows.filter(row=>Number.isFinite(Number(row?.usdValue)));
  return {
    rowCount:rows.length,
    pricedRowCount:priced.length,
    knownUsd:rows.length||zeroWhenEmpty?round(priced.reduce((sum,row)=>sum+Number(row.usdValue||0),0),6):null,
    complete:rows.length===priced.length,
    tokens:[...new Set(rows.map(row=>row?.symbol).filter(Boolean))]
  };
}
function stableCore(o){return{
  referenceObservedAt:o.referenceObservedAt,
  rewardsObservedAt:o.rewardsObservedAt,
  canonicalReferenceAprPct:o.referenceProductivity.canonicalAprPct,
  platformVaprPct:o.referenceProductivity.components.platformVaprPct,
  votiumLastCompletedRoundAprPct:o.referenceProductivity.components.votiumLastCompletedRoundAprPct,
  liveVlCvxBalance:o.companyRoute.liveVlCvxBalance,
  routeId:o.companyRoute.routeId,
  currentClaimableUsd:o.rewardInventory.current.currentClaimableUsd,
  legacyKnownUsd:o.rewardInventory.legacyResidual.knownUsd,
  productivitySha256:o.provenance.productivitySha256,
  rewardsSha256:o.provenance.rewardsSha256
};}

export function buildVlCvxVotiumCandidateObservation({productivity,rewards,productivitySha256,rewardsSha256}){
  if(!productivity||!rewards)fail('vlCVX candidate requires Productivity and Rewards state');
  if(!/^[0-9a-f]{64}$/i.test(String(productivitySha256||'')))fail('Productivity SHA-256 missing');
  if(!/^[0-9a-f]{64}$/i.test(String(rewardsSha256||'')))fail('Rewards SHA-256 missing');

  const engine=productivity?.engines?.convex_vlcvx;
  if(!engine||engine.status!=='ok')fail('Canonical convex_vlcvx Productivity engine unavailable');
  if(engine.sourceType!=='official-frontend'||engine.sourceUrl!=='https://www.convexfinance.com/lock-cvx')fail('vlCVX Reference APR source authority drift');
  if(engine.sourceMetric!=='Locked CVX platform vAPR + last completed Votium incentives APR')fail('vlCVX Reference APR metric drift');
  const canonicalAprPct=finite(engine.aprLatest,'vlCVX canonical Reference APR');
  const platformVaprPct=finite(engine?.details?.platformVapr,'vlCVX platform vAPR');
  const votiumLastCompletedRoundAprPct=finite(engine?.details?.votiumLastRoundApr,'Votium last completed round APR');
  const reproducedAprPct=platformVaprPct+votiumLastCompletedRoundAprPct;
  const parityDeltaPctPoints=canonicalAprPct-reproducedAprPct;
  if(Math.abs(parityDeltaPctPoints)>APR_TOLERANCE_PCT_POINTS)fail(`vlCVX Reference APR decomposition parity failed: ${canonicalAprPct} != ${reproducedAprPct}`);

  const company=findDefitea(rewards);
  const route=company?.vlCvxRoute;
  if(!route||route.principalAsset!=='vlCVX')fail('Defitea canonical vlCVX route state missing');
  if(route?.currentRoute?.routeId!=='votium-union')fail(`Defitea current vlCVX route drift: ${route?.currentRoute?.routeId}`);
  if(route?.delegate?.identity!=='votium')fail('Defitea current vlCVX delegate is not proven Votium');
  if(route?.forwarding?.identity!=='union'||route?.forwarding?.effective!==true)fail('Defitea current Votium forwarding is not proven effective Union');
  const liveVlCvxBalance=finite(route.liveBalance,'Defitea live vlCVX balance');
  if(!(liveVlCvxBalance>0))fail('Defitea live vlCVX balance must be positive');

  const routeSource=(company?.sources||[]).find(row=>row?.route==='vlcvx-current-route');
  if(!routeSource)fail('Defitea current vlCVX Rewards source missing');
  if(!['ok','partial','warming'].includes(routeSource.status))fail(`Unsupported vlCVX route source status: ${routeSource.status}`);
  const settlement=routeSource?.details?.settlement;
  const settlementRows=Array.isArray(settlement)?settlement:(settlement?[settlement]:[]);
  const scrvUsdAllocation=settlementRows.length?settlementRows.find(x=>x?.settlementAsset==='scrvUSD'||x?.symbol==='scrvUSD'||x?.payoutAsset==='scrvUSD'):null;

  const allRows=company?.rewards||[];
  const currentRows=allRows.filter(row=>row?.details?.vlCvxRoute?.routeRole==='current'&&row?.details?.vlCvxRoute?.delegationProtocol==='Votium');
  const legacyRows=allRows.filter(row=>row?.details?.vlCvxRoute?.routeRole==='legacy-residual'&&String(row?.protocol||'').includes('Votium'));
  const current=rewardSummary(currentRows,{zeroWhenEmpty:routeSource.status==='ok'});
  const legacy=rewardSummary(legacyRows);
  const currentClaimableUsd=routeSource.status==='ok'&&current.complete?current.knownUsd:null;

  const referenceObservedAt=engine.lastUpdatedAt||engine.periodEnd||productivity.generatedAt;
  const rewardsObservedAt=route.generatedAt||company.updatedAt||rewards.generatedAt;
  if(!Number.isFinite(Date.parse(referenceObservedAt)))fail('vlCVX Reference observation timestamp invalid');
  if(!Number.isFinite(Date.parse(rewardsObservedAt)))fail('vlCVX Rewards observation timestamp invalid');
  const sourceSkewHours=Math.abs(Date.parse(referenceObservedAt)-Date.parse(rewardsObservedAt))/36e5;
  const incentiveSharePct=canonicalAprPct>0?votiumLastCompletedRoundAprPct/canonicalAprPct*100:null;

  const observation={
    cohortId:VLCVX_CANDIDATE_ID,
    status:'shadow-measured-not-promoted',
    referenceObservedAt,
    rewardsObservedAt,
    company:{registry:'004',name:'defitea.eth'},
    protocolStack:['Convex','Votium','The Union'],
    mechanism:'CVX lock → vlCVX voting delegation → Votium incentive market → Union settlement',
    asset:'vlCVX',
    referenceProductivity:{
      canonicalAprPct:round(canonicalAprPct,6),
      status:engine.status,
      sourceUrl:engine.sourceUrl,
      sourceType:engine.sourceType,
      sourceMetric:engine.sourceMetric,
      nativeCadence:engine.nativeCadence,
      components:{
        platformVaprPct:round(platformVaprPct,6),
        votiumLastCompletedRoundAprPct:round(votiumLastCompletedRoundAprPct,6),
        reproducedAprPct:round(reproducedAprPct,6),
        parityDeltaPctPoints:round(parityDeltaPctPoints,6),
        votiumShareOfReferenceAprPct:round(incentiveSharePct,6),
        status:'proven-canonical-reference-decomposition'
      },
      semanticBoundary:'Reference APR only; not realised company income.'
    },
    companyRoute:{
      liveVlCvxBalance:round(liveVlCvxBalance,10),
      wallet:route.wallet??null,
      routeId:route.currentRoute.routeId,
      publicLabel:route.currentRoute.publicLabel??null,
      path:route.currentRoute.path??'vlCVX → Votium → The Union',
      delegate:route.delegate,
      forwarding:route.forwarding,
      sourceStatus:routeSource.status,
      settlementAsset:scrvUsdAllocation?'scrvUSD':(routeSource?.details?.settlementAsset??null),
      routeStateClass:'measured-current-canonical-rewards-route'
    },
    rewardInventory:{
      current:{...current,currentClaimableUsd,semanticClass:routeSource.status==='ok'?'measured-current-entitlement-state':'partial-or-warming-current-entitlement'},
      legacyResidual:{...legacy,semanticClass:'measured-legacy-residual-rows-only'},
      rule:'Current Votium→Union settlement and legacy direct Votium residuals are independent facts and must not be collapsed.'
    },
    marketBreathSeed:{
      cadence:'biweekly',
      measuredAtoms:['locked-CVX reference productivity','Votium completed-round incentive APR','current Votium delegation route','Union settlement route','current claim inventory','legacy residual claim inventory'],
      missingAtoms:['Votium round-wide incentive USD by proposal/pool','vlCVX vote distribution by gauge','round-to-round incentive flow migration','Curve gauge emission response','downstream pool liquidity/volume/fee response'],
      nextUnlock:'Add round-level Votium incentive + vlCVX vote-flow history, then join to Curve gauge / pool economics without causal overclaim.'
    },
    temporalBoundary:{
      sourceSnapshotsAreSameTime:referenceObservedAt===rewardsObservedAt,
      sourceSkewHours:round(sourceSkewHours,6),
      rule:'Never treat a completed-round Votium Reference APR and a later claimable snapshot as one same-time realised-yield formula.'
    },
    provenance:{
      productivityFile:'companies/productivity-data.json',
      productivityGeneratedAt:productivity.generatedAt??null,
      productivitySha256,
      rewardsFile:'companies/rewards-data.json',
      rewardsGeneratedAt:rewards.generatedAt??null,
      rewardsSha256
    },
    epistemic:{
      admissionClass:'shadow-candidate',
      referenceDecomposition:'proven-arithmetic-identity-from-canonical-productivity',
      routeState:'measured-from-canonical-rewards-route-graph',
      rewardInventory:'measured-or-explicitly-warming-by-canonical-rewards-state',
      causalAttribution:'unresolved-between-incentives-votes-emissions-liquidity-volume-fees-and-company-outcome',
      primaryDriver:null,
      recommendationAuthority:'none',
      predictionAuthority:'none',
      promotionAuthority:'none'
    }
  };
  observation.id=`vlcvx-votium:${String(referenceObservedAt).slice(0,10)}:${sha256Text(JSON.stringify(stableCore(observation))).slice(0,20)}`;
  return observation;
}

function buildMovement(current,prior){return{
  priorObservationId:prior?.id??null,
  referenceElapsedHours:prior?round((Date.parse(current.referenceObservedAt)-Date.parse(prior.referenceObservedAt))/36e5,6):null,
  rewardsElapsedHours:prior?round((Date.parse(current.rewardsObservedAt)-Date.parse(prior.rewardsObservedAt))/36e5,6):null,
  referenceAprDeltaPctPoints:prior?delta(current.referenceProductivity.canonicalAprPct,prior.referenceProductivity?.canonicalAprPct,6):null,
  votiumAprDeltaPctPoints:prior?delta(current.referenceProductivity.components.votiumLastCompletedRoundAprPct,prior.referenceProductivity?.components?.votiumLastCompletedRoundAprPct,6):null,
  liveVlCvxBalanceDelta:prior?delta(current.companyRoute.liveVlCvxBalance,prior.companyRoute?.liveVlCvxBalance,10):null,
  currentClaimableUsdDelta:prior?delta(current.rewardInventory.current.currentClaimableUsd,prior.rewardInventory?.current?.currentClaimableUsd,6):null,
  comparable:Boolean(prior),
  note:'Like-for-like deltas only. No incentive→vote→fee causal delta is inferred.'
};}

export function applyVlCvxVotiumCandidate({state,previousState,productivity,rewards,productivitySha256,rewardsSha256}){
  if(!state||typeof state!=='object')fail('Economic Graph base state missing');
  if(state?.authority?.executionAuthority!=='none'||state?.authority?.causalClaimAuthority!=='none')fail('vlCVX candidate refuses Economic Graph authority drift');
  const current=buildVlCvxVotiumCandidateObservation({productivity,rewards,productivitySha256,rewardsSha256});
  const previousRows=Array.isArray(previousState?.candidateCohorts?.[VLCVX_CANDIDATE_ID]?.observations)?previousState.candidateCohorts[VLCVX_CANDIDATE_ID].observations:[];
  const observations=[...previousRows];
  if(!observations.some(row=>row?.id===current.id))observations.push(current);
  const bounded=observations.slice(-MAX_OBSERVATIONS),latest=bounded.at(-1),prior=[...bounded].reverse().find(row=>row?.id!==latest?.id)??null;
  const ids=[...new Set([...(state?.candidateLayer?.candidateIds||Object.keys(state?.candidateCohorts||{})),VLCVX_CANDIDATE_ID])];
  state.candidateLayer={
    version:MULTI_CANDIDATE_LAYER_VERSION,
    status:'shadow-admission-active',
    candidateCount:ids.length,
    candidateIds:ids,
    canonicalCohortCountUnchanged:Number(state?.coverage?.cohortCount)===2,
    rule:'Candidate telemetry may be measured and historized before downstream causal/consumer promotion. Candidate presence does not expand canonical cohort authority.',
    promotionAuthority:'none'
  };
  state.candidateCohorts={
    ...(state.candidateCohorts||{}),
    [VLCVX_CANDIDATE_ID]:{
      cohortId:VLCVX_CANDIDATE_ID,
      status:'shadow-measured-not-promoted',
      identity:{companyRegistry:'004',company:'defitea.eth',protocol:'Convex / Votium / The Union',mechanism:'vlCVX delegation and incentive settlement',asset:'vlCVX'},
      latest:{observation:latest,movement:buildMovement(latest,prior)},
      observationCount:bounded.length,
      observations:bounded,
      attribution:{
        status:'reference-decomposition-proven-route-measured-causality-unresolved',
        referenceDecompositionProven:true,
        currentRouteMeasured:true,
        rewardInventoryContextMeasured:true,
        mechanicalInputs:['Locked CVX platform vAPR','last completed Votium incentives APR'],
        primaryDriver:null,
        blockedQuestion:'how-votium-incentive-flow-moves-vlcvx-votes-and-downstream-curve-pool-economics',
        unlockCondition:'round-level Votium incentives + vlCVX vote allocation + Curve gauge emission and pool fee/volume/liquidity evidence on aligned periods',
        promotionAuthority:'none'
      }
    }
  };
  return state;
}
