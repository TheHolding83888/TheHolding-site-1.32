#!/usr/bin/env node
/**
 * The Holding · Aero successor transition readiness v0.1
 *
 * Aero is announced, not yet a production protocol surface in The Holding.
 * This module records the bounded successor contract between the existing
 * Aerodrome / Velodrome evidence and the announced Aero architecture without
 * relabelling legacy history, fabricating migration state, or expanding any
 * execution / recommendation / allocation / prediction authority.
 *
 * Runtime builds do NOT fetch the web. Announced-design references below are
 * static provenance pointers reviewed by the operator and MUST be reverified
 * against production contracts before activation.
 */

export const AERO_TRANSITION_ID='aero-unification-2026';
export const AERO_TRANSITION_VERSION='0.1-aero-transition-readiness';

const OFFICIAL_REFERENCES=Object.freeze([
  {
    url:'https://aero.xyz/',
    class:'official-product-announcement',
    supports:['Aero 2026 launch intent','unified Ethereum liquidity layer','cross-chain exchange','AERO staking','100% exchange revenue distribution','AI/onchain integration direction']
  },
  {
    url:'https://aero.xyz/economics/',
    class:'official-economics-announcement',
    supports:['Aerodrome + Velodrome unification under AERO','sAERO','no voting / no epochs','real-time allocation','continuous exchange-revenue distribution','transferable staked-position NFT']
  },
  {
    url:'https://aero.xyz/features/predictive-allocation/',
    class:'official-feature-announcement',
    supports:['continuous cross-chain allocation','pool-by-pool live revenue','reallocation subject to cooldown','Autopilot direction','prospective allocation framing']
  },
  {
    url:'https://github.com/dromos-labs/metadex-specs/blob/main/docs/overview.md',
    class:'upstream-public-idea-draft-not-production-contract',
    supports:['federated root/leaf design','Base root','sAERO/sTOKEN terminology','per-second reward rates','decaying allocations','cross-chain rate propagation','per-chain ceilings','continuous fee/incentive accrual']
  },
  {
    url:'https://github.com/dromos-labs/metadex-specs/blob/main/docs/voter/voter.md',
    class:'upstream-public-idea-draft-not-production-contract',
    supports:['per-chain reward-rate accounting','allocation decay','activation timestamps','cooldowns','settle-all conservation','pause/suspend semantics']
  },
  {
    url:'https://github.com/dromos-labs/metadex-specs/blob/main/docs/gauge/gauge-factory.md',
    class:'upstream-public-idea-draft-not-production-contract',
    supports:['per-gauge emission caps','bounded cap-operator role','fee-to-emissions efficiency signal','local automation path']
  },
  {
    url:'https://github.com/dromos-labs/metadex-specs/blob/main/docs/rewards/rewards.md',
    class:'upstream-public-idea-draft-not-production-contract',
    supports:['continuous fee accrual','streaming incentive programs','decaying reward weights','cross-chain allocation settlement ordering']
  }
]);

function fail(message){throw new Error(message);}
function frozenCopy(value){return JSON.parse(JSON.stringify(value));}

function predecessor(state,protocolId,label){
  const row=state?.protocolLifecycle?.protocols?.[protocolId];
  if(!row)fail(`Aero transition predecessor missing: ${label}`);
  return {
    protocolId,
    label,
    maturityStage:row.maturityStage||null,
    operatingMode:row.operatingMode||null,
    continuityPolicy:'preserve-as-legacy-predecessor-history-do-not-relabel-as-Aero'
  };
}

export function buildAeroTransitionReadiness({state}){
  if(!state||typeof state!=='object')fail('Aero transition readiness requires Economic Graph state');
  if(state?.authority?.executionAuthority!=='none'||state?.authority?.causalClaimAuthority!=='none')fail('Aero transition refuses Economic Graph authority drift');
  if(state?.protocolLifecycle?.authority?.executionAuthority!=='none'||state?.protocolLifecycle?.authority?.workflowDispatchAuthority!==false)fail('Aero transition requires bounded Protocol Lifecycle authority');

  const predecessors=[
    predecessor(state,'defitea-aerodrome-veaero','Aerodrome / veAERO'),
    predecessor(state,'registry-velodrome-vevelo','Velodrome / veVELO')
  ];

  const activationGates={
    productionContractsPublishedAndVerified:false,
    supportedChainDeploymentMapVerified:false,
    sAeroStakingStateSourceVerified:false,
    rootAndLeafAllocationStateVerified:false,
    chainAndGaugeRewardRateStateVerified:false,
    continuousRevenueStreamsVerified:false,
    legacyMigrationMappingVerified:false,
    sourceFreshnessAndHashBindingVerified:false,
    safeLongitudinalObservationBoundaryVerified:false,
    authorityBoundaryReverified:false
  };

  return {
    id:AERO_TRANSITION_ID,
    version:AERO_TRANSITION_VERSION,
    status:'announced-not-activated',
    reviewedAt:'2026-08-26',
    evidenceClass:'announced-design-not-production-state',
    reverifyBeforeActivation:true,
    predecessors,
    successor:{
      protocol:'Aero',
      ticker:'AERO',
      stakingForm:'sAERO',
      announcedLaunchWindow:'2026',
      rootChain:'Base',
      architecture:'federated-root-leaf-cross-chain-liquidity-layer',
      operatingModel:'continuous-cross-chain-predictive-allocation',
      productionActivated:false,
      productionContractAddresses:null,
      migrationContractAddresses:null,
      walletMigrationFormula:'UNKNOWN-until-official-production-migration-contracts-and-rules-are-verified'
    },
    announcedDynamics:{
      predecessorEpochModel:'weekly-vote-epoch',
      successorVotingForLiquidityRewardDirection:false,
      successorEpochs:false,
      continuousAllocation:true,
      allocationChangesSubjectToCooldown:true,
      rewardsStreamPerSecond:true,
      exchangeRevenueAccruesContinuously:true,
      incentiveProgramsStreamContinuously:true,
      stakingWeightMayDecayWithStakingSchedule:true,
      rootAllocationDefaultInPublicIdeaDraft:true,
      localLeafAllocation:'future-toggle-in-public-idea-draft',
      crossChainRatePropagation:true,
      perChainCeilingSafetyModel:true,
      perGaugeEmissionCaps:true,
      boundedFeeResponsiveCapOperator:'public-idea-draft-design-only',
      crossChainTransitDriftMustBeMeasured:true,
      note:'Governance proposal voting is distinct from liquidity-reward allocation and is not declared removed.'
    },
    historyContract:{
      preserveAerodromeHistory:true,
      preserveVelodromeHistory:true,
      relabelLegacyObservationsAsAero:false,
      mergeLegacyTimeSeriesWithoutExplicitMigrationBoundary:false,
      firstAeroObservationMustUseProductionAeroSources:true,
      transitionBoundary:'Aero production activation + verified migration mapping',
      rule:'Pre-launch AERO/veAERO and VELO/veVELO evidence remains attributable to its original protocol and mechanism.'
    },
    futureSensorContract:{
      measuredAtoms:[
        'sAERO staking position / weight / decay schedule',
        'allocation changes by tokenId / operator / chain / pool / gauge / timestamp',
        'allocation cooldown state',
        'global Minter reward rate',
        'per-chain allocated reward rate',
        'per-gauge allocated and effective reward rate',
        'per-gauge reward caps / cap-operator bounds / unused allocation',
        'fee-to-emissions efficiency per gauge',
        'continuous exchange fee accrual',
        'streaming incentive program amount / rate / duration',
        'LP liquidity depth and concentration',
        'pool volume / fees / spread / execution quality',
        'cross-chain activation timestamp / propagation delay / convergence state',
        'chain pause / suspension state',
        'xTOKEN issuance / redemption / chain ceiling / unused-emissions state'
      ],
      mechanicalRelationsEligibleForAttribution:[
        'staking weight + allocation -> root/leaf allocation weight when reproduced from production contracts',
        'chainWeight / totalWeight × minterRate -> chain reward rate when reproduced from production contracts',
        'gauge allocation + cap -> effective gauge reward rate when reproduced from production contracts',
        'active allocation weight -> staker share of continuously accrued fee/incentive rewards when reproduced from production contracts',
        'streaming incentive amount / duration -> incentive tokens-per-second when reproduced from production contracts',
        'chain accumulator / ceiling -> maximum root redemption when reproduced from production contracts'
      ],
      relationshipsDefaultingToNonCausal:[
        'allocation -> future liquidity growth',
        'allocation -> future volume growth',
        'allocation -> future fee growth',
        'allocation -> future incentive intensity',
        'allocation -> future relative profitability',
        'market-flow signal -> future winning pool',
        'fee-to-emissions efficiency signal -> future optimal cap'
      ],
      epistemicDefault:'MEASURE first; ATTRIBUTED only for reproduced mechanical identities; prospective market outcomes remain CORRELATED/UNKNOWN until independently proven.'
    },
    prospectiveAllocationEvaluation:{
      enabledForResearch:true,
      executionEnabled:false,
      recommendationEnabled:false,
      predictionEnabled:false,
      protocol:'freeze-before-observe',
      requiredSequence:[
        'freeze pre-allocation evidence snapshot',
        'record hypothesis/proposal without executing',
        'wait a pre-registered evaluation window or native cooldown boundary',
        'measure subsequent liquidity / volume / fees / revenue / reward efficiency',
        'record support and counterevidence',
        'never rewrite the original hypothesis after outcome is known'
      ],
      candidateOutcomeMetrics:[
        'exchange revenue per unit of allocated AERO rewards',
        'fees per unit of effective gauge reward rate',
        'marginal fee growth per marginal AERO reward',
        'fee growth after allocation',
        'liquidity-depth change',
        'volume and execution-quality change',
        'reward efficiency relative to contemporaneous comparable pools',
        'allocation persistence / reversal after cooldown',
        'cross-chain propagation delay versus realized opportunity window'
      ],
      causalBoundary:'A profitable prospective allocation does not prove why demand moved or that the same signal will work again.'
    },
    activation:{
      ready:Object.values(activationGates).every(Boolean),
      gates:activationGates,
      rule:'Aero must remain a transition/readiness contract, not an active eighth lifecycle protocol, until every production activation gate is independently verified.'
    },
    sources:frozenCopy(OFFICIAL_REFERENCES),
    authority:{
      readOnly:true,
      executionAuthority:'none',
      capitalExecution:false,
      walletAuthority:false,
      allocationAuthority:false,
      recommendationAuthority:false,
      predictionAuthority:false,
      causalClaimAuthority:'none',
      migrationAuthority:'none',
      methodologyMutationAuthority:false,
      repositoryMutationAuthority:false,
      workflowDispatchAuthority:false
    }
  };
}

export function applyAeroTransitionReadiness({state}){
  const transition=buildAeroTransitionReadiness({state});
  return {
    ...state,
    protocolTransitions:{
      ...(state.protocolTransitions||{}),
      [AERO_TRANSITION_ID]:transition
    }
  };
}
