import { getAddress } from 'ethers';
import { collectVlCvxConvexTeamEligibilityProof } from './vlcvx-convex-team-eligibility-proof.mjs';

const VERSION='0.1-vlcvx-convex-team-settlement-boundary';
const ROOK="Rook's portfolio";
const ROUTE_ID='convex-finance-vlcvx';
const ROUTE_LABEL='Convex Finance · vlCVX';
const CONVEX_TEAM=getAddress('0x947B7742C403f20e5FaCcDAc5E092C943E7D0277');
const VOTIUM_DOCS='https://docs.votium.app/faq/vlcvx-faq';
const POLICY_REVIEWED_AT='2026-09-04';
const SETTLEMENT_STATE='no-votium-incentive-eligibility-observed-current-route';

const same=(a,b)=>{try{return getAddress(a)===getAddress(b)}catch{return false}};

export function validateVlCvxConvexTeamSettlementProof(proof){
  if(proof?.version!=='0.1-vlcvx-convex-team-gauge-eligibility-proof')throw new Error('Convex-Team eligibility proof version drift');
  if(proof?.executionAuthority!=='none'||proof?.claimTransactionAuthority!=='none')throw new Error('Convex-Team eligibility authority expanded');
  if(proof?.subject?.registry!=='007'||proof?.subject?.company!==ROOK||proof?.subject?.currentRoute!==ROUTE_ID)throw new Error('Rook Convex-Team proof subject drift');
  if(!same(proof?.subject?.currentGaugeDelegate,CONVEX_TEAM))throw new Error('Rook current delegate is not Convex Team');
  if(proof?.sourceModel?.votiumEligibilityDocs!==VOTIUM_DOCS)throw new Error('Votium eligibility source drift');
  if(proof?.semantics?.gaugeDelegationIsVotingAuthorityNotIncomeEvent!==true||proof?.semantics?.noManualVoteDoesNotByItselfProveUniversalZeroIncome!==true||proof?.semantics?.unknownIsNotZero!==true)throw new Error('Convex-Team proof semantic guard drift');
  const observedBlock=Number(proof?.observedBlock),summary=proof?.summary||{};
  if(!Number.isSafeInteger(observedBlock)||observedBlock<=0)throw new Error('Convex-Team proof block invalid');
  if(!(Number(summary.weightedProposalCount)>0)||summary.allWeightedProposalsConvexTeam!==true||summary.noManualOrSurrogateOverrideOnWeightedProposals!==true||Number(summary.nonConvexTeamWeightedProposalCount)!==0||Number(summary.manualOrSurrogateOverrideCount)!==0)throw new Error('Rook current Convex-Team participation boundary incomplete');
  return{
    version:VERSION,
    generatedAt:proof.generatedAt,
    observedBlock,
    executionAuthority:'none',
    claimTransactionAuthority:'none',
    subject:{registry:'007',company:ROOK,wallet:proof.subject.wallet,currentRoute:ROUTE_ID,currentGaugeDelegate:CONVEX_TEAM},
    settlement:{
      evidenceClass:'factual-current-route-eligibility-boundary',
      entitlement:SETTLEMENT_STATE,
      currentDelegate:'convex-team',
      currentDelegateAddress:CONVEX_TEAM,
      weightedProposalCount:Number(summary.weightedProposalCount),
      convexTeamWeightedProposalCount:Number(summary.convexTeamWeightedProposalCount),
      nonConvexTeamWeightedProposalCount:0,
      manualOrSurrogateOverrideCount:0,
      allWeightedProposalsConvexTeam:true,
      noManualOrSurrogateOverrideOnWeightedProposals:true,
      votiumEligibilityPolicy:{
        reviewedAt:POLICY_REVIEWED_AT,
        source:VOTIUM_DOCS,
        eligibilityPaths:['delegate-to-votium','manual-vote-on-incentivized-pool-or-proposal']
      },
      lockerPlatformRewardsTrackedSeparately:true,
      extraRewardDistributionTrackedSeparately:true,
      legacyResidualRewardsTrackedSeparately:true,
      universalExternalRewardZeroAsserted:false,
      currentRewardBalanceIsPeriodIncome:false,
      periodIncomeAuthority:false,
      trackingBoundaryComplete:true,
      unknownIsNotZero:true
    },
    semantics:{
      scope:'current Convex-Team vlCVX route eligibility/tracking boundary only',
      noRewardRowCreated:true,
      noZeroIncomeEventCreated:true,
      noUniversalExternalRewardZeroAssertion:true,
      unknownIsNotZero:true
    }
  };
}

export async function collectVlCvxConvexTeamSettlementProof(options={}){
  return validateVlCvxConvexTeamSettlementProof(await collectVlCvxConvexTeamEligibilityProof(options));
}

export function applyVlCvxConvexTeamSettlementProof(data,proof){
  const p=proof?.settlement?proof:validateVlCvxConvexTeamSettlementProof(proof);
  const company=data?.companies?.[ROOK];
  if(!company)throw new Error('Rook canonical Rewards company missing');
  if(company?.vlCvxRoute?.principalAsset!=='vlCVX'||company?.vlCvxRoute?.currentRoute?.routeId!==ROUTE_ID)throw new Error('Rook canonical vlCVX route drift');
  const current=(company.sources||[]).find(x=>x?.route==='vlcvx-current-route');
  if(!current||current.protocol!==ROUTE_LABEL||current.status!=='partial'||current?.details?.currentRewardSettlement!=='unresolved'||current?.details?.unknownIsNotZero!==true)throw new Error('Rook unresolved current route prerequisite missing');
  const platform=(company.sources||[]).find(x=>x?.route==='vlcvx-locker-platform-rewards');
  if(platform?.status!=='ok'||platform?.details?.periodIncomeAuthority!==false||platform?.details?.delegateIncentiveSettlementAuthority!==false)throw new Error('Rook locker platform component proof missing');
  const extra=(company.sources||[]).find(x=>x?.route==='vlcvx-extra-reward-distribution');
  if(extra?.status!=='ok'||extra?.details?.periodIncomeAuthority!==false)throw new Error('Rook current extra reward distribution proof missing');

  const rewardsBefore=JSON.stringify(company.rewards||[]);
  const claimableBefore=company.claimableUsd??company.totalUsd??null;
  current.status='ok';
  current.note='Current delegate is Convex Team. The audited weighted Curve/f(x) proposal set is fully Convex-Team delegated with no Rook manual/surrogate override; under the reviewed Votium eligibility paths, no current Votium incentive entitlement path is observed. Locker platform, current extra-distribution, and legacy residual reward state remain separately tracked. This is a tracking boundary only, not a zero-income assertion.';
  current.details={
    ...(current.details||{}),
    currentRewardSettlement:SETTLEMENT_STATE,
    settlement:p.settlement,
    settlementObservedBlock:p.observedBlock,
    settlementGeneratedAt:p.generatedAt,
    periodIncomeAuthority:false,
    universalExternalRewardZeroAsserted:false,
    unknownIsNotZero:true
  };
  if(JSON.stringify(company.rewards||[])!==rewardsBefore)throw new Error('Convex-Team settlement proof mutated Rook reward rows');
  if((company.claimableUsd??company.totalUsd??null)!==claimableBefore)throw new Error('Convex-Team settlement proof mutated Rook claimable aggregate');

  data.diagnostics=data.diagnostics||{};
  data.diagnostics.vlCvxConvexTeamSettlement={
    version:VERSION,
    generatedAt:p.generatedAt,
    observedBlock:p.observedBlock,
    executionAuthority:'none',
    claimTransactionAuthority:'none',
    company:ROOK,
    currentRoute:ROUTE_ID,
    currentRewardSettlement:SETTLEMENT_STATE,
    scope:'tracking-proof-only',
    periodIncomeAuthority:false,
    rewardRowsCreated:false,
    universalExternalRewardZeroAsserted:false,
    unknownIsNotZero:true
  };
  return data;
}

async function main(){
  const proof=await collectVlCvxConvexTeamSettlementProof();
  console.log('vlCVX CONVEX TEAM SETTLEMENT PROOF PASS',JSON.stringify({subject:proof.subject,observedBlock:proof.observedBlock,settlement:proof.settlement,semantics:proof.semantics},null,2));
}

if(import.meta.url===`file://${process.argv[1]}`)main().catch(e=>{console.error(e);process.exitCode=1});
