#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const ROOT=process.cwd();
const DATA=process.env.REWARDS_DATA||path.join(ROOT,'companies/rewards-data.json');
const STATE=process.env.ICP_NNS_REWARDS_STATE||path.join(ROOT,'companies/icp-nns-rewards-state.json');
const ROUTE='icp-nns-governance';
const VERSION='0.1-icp-nns-canonical-rewards-projection';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
const round=(n,d=8)=>finite(n)?Number(Number(n).toFixed(d)):null;

const rewards=read(DATA);
const state=read(STATE);
if(state?.version!=='0.1-icp-nns-rewards-state')throw new Error('canonical ICP NNS rewards state required');
if(state?.route!==ROUTE||state?.asset!=='ICP'||state?.network!=='Internet Computer')throw new Error('ICP NNS state identity drift');
if(state?.capitalAccounting?.principalAddedToTvl!==false)throw new Error('ICP NNS principal TVL boundary missing');
if(state?.authority?.readOnly!==true||state?.authority?.claimTransactionAuthority!=='none'||state?.authority?.executionAuthority!=='none')throw new Error('ICP NNS authority drift');
if(state?.unknownIsNotZero!==true)throw new Error('ICP NNS UNKNOWN != 0 boundary missing');
if(!finite(state?.rewards?.canonicalIcpPriceUsd)||Number(state.rewards.canonicalIcpPriceUsd)<=0)throw new Error('canonical ICP price missing from state');
if(!finite(state?.rewards?.referenceAprPct)||Number(state.rewards.referenceAprPct)<0)throw new Error('canonical ICP NNS Reference APR missing from state');
if(!state?.rewards?.companies||Object.keys(state.rewards.companies).length!==2)throw new Error('ICP NNS two-company allocation missing');
const generatedAt=String(state.generatedAt||'');
if(!Number.isFinite(Date.parse(generatedAt)))throw new Error('ICP NNS state generatedAt invalid');

const requested=Number(state.publicNeuronObservation?.requestedNeuronCount);
const observed=Number(state.publicNeuronObservation?.detailOkCount);
if(requested!==41||!Number.isFinite(observed)||observed<0||observed>requested)throw new Error('ICP NNS neuron coverage drift');
const exact=state.rewards.mode==='public-exact-unstaked-maturity'&&state.rewards.estimated===false;
const common={
  rewardSource: exact
    ? 'ic-api: public exact maturity_e8s_equivalent'
    : 'model: owner-confirmed maturity baseline + canonical icp_nns Reference APR',
  mode:state.rewards.mode,
  estimated:state.rewards.estimated===true,
  exactPublicUnstakedMaturityAvailable:exact,
  referenceAprPct:round(state.rewards.referenceAprPct,6),
  aggregateNeuronCount:requested,
  liveNeuronCoverage:`${observed}/${requested}`,
  baselineMaturitySnapshotDate:state.rewards.baselineSnapshotDate,
  sourceStateGeneratedAt:generatedAt
};

function upsert(companyName,allocation){
  const company=rewards.companies?.[companyName];
  if(!company)throw new Error(`Rewards company missing: ${companyName}`);
  const amount=Number(allocation?.unclaimedIcp);
  const usd=Number(allocation?.unclaimedUsd);
  const base=Number(allocation?.productiveNnsBaseIcp);
  const share=Number(allocation?.allocationShare);
  if(!Number.isFinite(amount)||amount<0||!Number.isFinite(usd)||usd<0||!Number.isFinite(base)||base<0||!Number.isFinite(share)||share<=0)throw new Error(`invalid ICP allocation: ${companyName}`);
  const sourceDetails={...common,companyProductiveNnsBaseIcp:round(base,8),allocationShare:share};
  company.rewards=Array.isArray(company.rewards)?company.rewards.filter(x=>x?.route!==ROUTE):[];
  company.sources=Array.isArray(company.sources)?company.sources.filter(x=>x?.route!==ROUTE):[];
  company.rewardTokens=Array.isArray(company.rewardTokens)?company.rewardTokens.filter(x=>x?.symbol!=='ICP'):[];
  company.rewards.push({
    protocol:'Internet Computer · NNS Governance',route:ROUTE,chain:'Internet Computer',token:null,symbol:'ICP',
    amount:round(amount,8),classification:'unclaimed',source:sourceDetails.rewardSource,usdValue:round(usd,6),
    priceUsd:round(state.rewards.canonicalIcpPriceUsd,8),priceMethod:'canonical-market-data:internet-computer',
    details:{
      productiveAsset:'ICP',positionType:'NNS Governance Neurons',allocationPolicy:'owner-declared-50-50-shared-neuron-pool',
      rewardMeasurementMode:sourceDetails.mode,estimated:sourceDetails.estimated,
      exactPublicUnstakedMaturityAvailable:sourceDetails.exactPublicUnstakedMaturityAvailable,
      referenceAprPct:sourceDetails.referenceAprPct,aggregateNeuronCount:sourceDetails.aggregateNeuronCount,
      liveNeuronCoverage:sourceDetails.liveNeuronCoverage,companyProductiveNnsBaseIcp:sourceDetails.companyProductiveNnsBaseIcp,
      baselineMaturitySnapshotDate:sourceDetails.baselineMaturitySnapshotDate,sourceStateGeneratedAt:generatedAt,
      unknownIsNotZero:true,usdValueIncludedInTvl:false,principalIncludedInTvlAgain:false,
      claimTransactionAuthority:'none',executionAuthority:'none'
    }
  });
  company.sources.push({
    protocol:'Internet Computer · NNS Governance',route:ROUTE,status:sourceDetails.estimated?'partial':'ok',chain:'Internet Computer',
    metric:sourceDetails.estimated
      ? 'Unclaimed maturity estimate · public neuron state + owner baseline + canonical NNS Reference APR'
      : 'Public exact unstaked NNS maturity',
    note:sourceDetails.estimated
      ? 'Private/public neuron data does not prove complete exact unstaked maturity. The displayed Unclaimed amount is a bounded estimate anchored to the owner-confirmed maturity baseline and current canonical NNS Reference APR.'
      : 'Exact public unstaked maturity coverage is complete for the tracked neuron pool.',
    details:{...sourceDetails,unknownIsNotZero:true,claimTransactionAuthority:'none',executionAuthority:'none'}
  });
  company.rewardTokens.push({symbol:'ICP',token:null,amount:round(amount,8),usdValue:round(usd,6)});
  const knownClaimable=company.rewards.reduce((sum,r)=>finite(r?.usdValue)?sum+Number(r.usdValue):sum,0);
  company.knownAccruedUsd=round(knownClaimable,6);
  company.claimableUsd=round(knownClaimable,6);
  company.totalUsd=round(knownClaimable,6);
  if(sourceDetails.estimated)company.totalUsdIsComplete=false;
  company.status=sourceDetails.estimated?'partial':(company.status||'ok');
  company.updatedAt=generatedAt;
}

let allocationSum=0;
for(const [name,allocation] of Object.entries(state.rewards.companies)){
  allocationSum+=Number(allocation.allocationShare||0);
  upsert(name,allocation);
}
if(Math.abs(allocationSum-1)>1e-9)throw new Error('ICP NNS allocation shares must sum to 1');
const names=Object.keys(state.rewards.companies);
const amounts=names.map(name=>Number(state.rewards.companies[name].unclaimedIcp));
if(amounts.length!==2||Math.abs(amounts[0]-amounts[1])>1e-8)throw new Error('ICP NNS owner 50/50 allocation drift');

rewards.diagnostics=rewards.diagnostics||{};
rewards.diagnostics.icpNns={
  capability:state.engineVersion,
  projectionVersion:VERSION,
  status:state.status,
  route:ROUTE,
  aggregateUnclaimedIcp:state.rewards.aggregateUnclaimedIcp,
  measurementMode:state.rewards.mode,
  estimated:state.rewards.estimated===true,
  referenceAprPct:state.rewards.referenceAprPct,
  companies:state.rewards.companies,
  liveNeuronCoverage:common.liveNeuronCoverage,
  voting:state.publicNeuronObservation?.voting,
  dissolvingNeuronCount:state.publicNeuronObservation?.dissolvingNeuronCount,
  principalAddedToTvl:false,
  sourceOfTruth:'companies/icp-nns-rewards-state.json',
  sourceStateGeneratedAt:generatedAt,
  sourceStateRepositoryMutationAuthority:'Update ICP NNS Rewards',
  repositoryMutationAuthority:'Update Company Rewards',
  claimTransactionAuthority:'none',
  executionAuthority:'none',
  unknownIsNotZero:true
};
rewards.generatedAt=new Date().toISOString();
rewards.date=rewards.generatedAt.slice(0,10);
fs.writeFileSync(DATA,JSON.stringify(rewards,null,2)+'\n');
console.log('ICP NNS canonical Rewards projection PASS',{
  version:VERSION,sourceStateGeneratedAt:generatedAt,companies:names,aggregateUnclaimedIcp:state.rewards.aggregateUnclaimedIcp,
  repositoryMutationAuthority:'Update Company Rewards',executionAuthority:'none'
});
