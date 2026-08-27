#!/usr/bin/env node
/**
 * The Holding · Frax ecosystem sensor family v0.1
 *
 * Deepens lifecycle sensor #8 without creating additional lifecycle protocols.
 * The existing veFRAX surface remains the only currently measured Frax economic
 * surface inherited from canonical Productivity. The wider ecosystem is bound to
 * explicit official source contracts and tracked as UNKNOWN until a reproducible
 * collector/onchain accounting path supplies current values.
 *
 * This is deliberate: source readiness is not measurement, documented mechanics
 * are not realised cash flow, and topology is not causality.
 */
import crypto from 'node:crypto';

export const FRAX_PROTOCOL_ID='registry-frax-vefrax';
export const FRAX_ECOSYSTEM_EVIDENCE_ID='registry-frax-ecosystem';
export const FRAX_ECOSYSTEM_VERSION='0.1-frax-deep-ecosystem-sensor-family';
const MAX_OBSERVATIONS=1000;

function fail(message){throw new Error(message);}
function sha256(value){return crypto.createHash('sha256').update(value).digest('hex');}
function stableValue(value){
  if(Array.isArray(value))return value.map(stableValue);
  if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(k=>[k,stableValue(value[k])]));
  return value;
}
function stableStringify(value){return JSON.stringify(stableValue(value));}
function finite(value){return value!==null&&value!==undefined&&value!==''&&Number.isFinite(Number(value));}

const OFFICIAL_SOURCES={
  governanceVeFrax:{
    primary:'https://api.frax.finance/combineddata/',
    product:'https://app.frax.finance/fxtl-vefxs',
    note:'Canonical Productivity currently measures veFRAX governance productivity from the official Frax API/frontend.'
  },
  fraxtalFloxFxtl:{
    docs:'https://docs.frax.com/fraxtal/fraxtal-incentives/fraxtal-point-system',
    pointsContract:{chain:'Fraxtal',address:'0xaB4b7c5C9A7C8EbB97877085A6C3550ad4Ed3f97'},
    note:'FXTL is a points ledger. Tokenization/conversion assumptions are not measurement authority.'
  },
  frxUsdSfrxUsd:{
    docs:'https://docs.frax.com/frxusd',
    addresses:'https://docs.frax.com/protocol/assets/frxusd/addresses',
    frxUsd:{ethereum:'0xCAcd6fd266aF91b8AeD52aCCc382b4e165586E29',fraxtal:'0xfc00000000000000000000000000000000000001'},
    sfrxUsd:{ethereum:'0xcf62F905562626CfcDD2261162a51fd02Fc9c5b6',fraxtal:'0xfc00000000000000000000000000000000000008'},
    note:'Backing/yield composition is source topology until a current reproducible balance-sheet/accounting snapshot is ingested.'
  },
  fraxNet:{
    docs:'https://docs.frax.com/fraxnet',
    api:'https://api-net.frax.com',
    apiDocs:'https://docs.frax.com/fraxnet/api',
    factory:{chain:'Ethereum',address:'0xA3D62f83C433e2A56Af392E08a705A52DEd63696'},
    note:'Cross-chain mint/redeem routes are documented mechanics. Current flow volume remains UNKNOWN until transaction/API history is ingested.'
  },
  fraxlend:{
    docs:'https://docs.frax.com/protocol/subprotocols/fraxlend/overview',
    note:'Pair-level utilization, borrow rates, interest and fToken share-price state require pair-registry/onchain ingestion.'
  },
  fraxswapBamm:{
    fraxswapDocs:'https://docs.frax.com/protocol/subprotocols/fraxswap/overview',
    fraxswapAddresses:'https://docs.frax.com/protocol/subprotocols/fraxswap/addresses',
    bammDocs:'https://docs.frax.com/protocol/subprotocols/bamm/overview',
    bammAddresses:'https://docs.frax.com/protocol/subprotocols/bamm/addresses',
    fraxtalFraxswapFactory:'0xE30521fe7f3bEB6Ad556887b50739d6C7CA667E6',
    fraxtalBammFactory:'0x19928170D739139bfbBb6614007F8EEeD17DB0Ba',
    note:'Fraxswap/BAMM topology is bound; pool liquidity, fees, TWAMM activity, rented liquidity and borrow interest remain UNKNOWN until current state is ingested.'
  },
  fxb:{
    docs:'https://docs.frax.com/protocol/assets/frxusd/fxb',
    addressDocs:'https://docs.frax.com/protocol/assets/frxusd/addresses',
    knownSeries:[
      {maturity:'2026-12-31',ethereum:'0x76237BCfDbe8e06FB774663add96216961df4ff3',fraxtal:'0x8e9C334afc76106F08E0383907F4Fca9bB10BA3e'},
      {maturity:'2029-12-31',ethereum:null,fraxtal:'0xF1e2b576aF4C6a7eE966b14C810b772391e92153'},
      {maturity:'2055-12-31',ethereum:null,fraxtal:'0xc38173D34afaEA88Bc482813B3CD267bc8A1EA83'}
    ],
    identityBoundary:'Current Frax documentation describes FXB settlement in LFRAX. Do not silently relabel LFRAX as frxUSD without explicit accounting evidence.'
  },
  fxLiquidity:{
    docs:'https://docs.frax.com/protocol',
    note:'International/tokenized-currency FX-pool economics require explicit pool identities and current onchain/API measurements; no Treasury-yield→specific-pool incentive edge is assumed.'
  },
  revenueRouting:{
    docs:'https://docs.frax.com/protocol',
    note:'Economic activity→revenue source→costs/revenue share→eligible net revenue→veFRAX allocation→actual distribution→company cash flow must be proven link-by-link. Current end-to-end identity is UNKNOWN.'
  }
};

function surface({id,label,mechanism,atoms,sourceContract,measurementState='UNKNOWN-current-value-not-ingested',measured=null,mechanicalRelations=[]}){
  return {id,label,mechanism,atoms,sourceContract,measurementState,measured,mechanicalRelations};
}

export function buildFraxEcosystemObservation({state}){
  const lifecycle=state?.protocolLifecycle?.protocols?.[FRAX_PROTOCOL_ID];
  const sensor=state?.protocolSensors?.[FRAX_PROTOCOL_ID];
  const frax=sensor?.latest?.observation;
  if(!lifecycle||!sensor||!frax)fail('Frax ecosystem family requires lifecycle sensor #8');
  if(lifecycle?.maturityStage!=='shadow'&&!['verified','canonical'].includes(lifecycle?.maturityStage))fail('Unexpected Frax lifecycle stage');
  if(frax?.epistemic?.executionAuthority!=='none')fail('Frax base sensor authority drift');
  if(frax?.identityBoundary?.currentCanonicalPrincipal!=='FRAX'||frax?.identityBoundary?.currentCanonicalVoteEscrowLabel!=='veFRAX')fail('Frax current identity boundary unavailable');

  const governanceMeasured={
    referenceAprPct:finite(frax?.referenceProductivity?.currentAprPct)?Number(frax.referenceProductivity.currentAprPct):null,
    companyCount:Number(frax?.registryExposure?.companyCount||0),
    positionCount:Number(frax?.registryExposure?.positionCount||0),
    canonicalSnapshotCount:Number(frax?.longitudinalEvidence?.canonicalSnapshotCount||0),
    validatedNativePeriodCount:Number(frax?.longitudinalEvidence?.validatedNativePeriodCount||0),
    lifecycleStage:lifecycle.maturityStage
  };

  const surfaces={
    governanceVeFrax:surface({
      id:'governance-vefrax',label:'FRAX / veFRAX',
      mechanism:'governance lock productivity + registry exposure + native-period maturity',
      atoms:['FRAX locked','veFRAX voting weight','Reference APR','company exposure','position exposure','native period boundaries','actual distributed reward asset'],
      sourceContract:OFFICIAL_SOURCES.governanceVeFrax,
      measurementState:'MEASURED-partial-current-governance-surface',measured:governanceMeasured,
      mechanicalRelations:[
        {from:'canonical Frax productivity source',to:'Reference APR',class:'MEASURED'},
        {from:'registry positions',to:'company exposure',class:'MEASURED'},
        {from:'protocol revenue',to:'veFRAX APR',class:'UNKNOWN'}
      ]
    }),
    fraxtalFloxFxtl:surface({
      id:'fraxtal-flox-fxtl',label:'Fraxtal / Flox / FXTL',
      mechanism:'activity and effective-balance based ecosystem points',
      atoms:['epoch id','epoch boundaries','gas/activity','eligible balances','effective balance','multiplier','FXTL earned','FXTL balance','company FXTL exposure'],
      sourceContract:OFFICIAL_SOURCES.fraxtalFloxFxtl,
      mechanicalRelations:[
        {from:'eligible activity/balance',to:'effective balance',class:'MECHANICAL-source-documented-not-currently-reproduced'},
        {from:'effective balance + multiplier',to:'FXTL earned',class:'MECHANICAL-source-documented-not-currently-reproduced'},
        {from:'FXTL points',to:'future token value',class:'UNKNOWN'}
      ]
    }),
    frxUsdSfrxUsd:surface({
      id:'frxusd-sfrxusd',label:'frxUSD / sfrxUSD',
      mechanism:'stablecoin reserves + ERC4626 savings yield + benchmark yield allocation',
      atoms:['frxUSD supply','sfrxUSD supply','sfrxUSD assets','share price','yield rate','reserve composition','Treasury/RWA allocation','AMO allocation','carry allocation','mint/redeem volume'],
      sourceContract:OFFICIAL_SOURCES.frxUsdSfrxUsd,
      mechanicalRelations:[
        {from:'sfrxUSD assets / shares',to:'share price',class:'MECHANICAL-ready-for-onchain-reproduction'},
        {from:'share-price change',to:'embedded yield',class:'MECHANICAL-ready-for-longitudinal-reproduction'},
        {from:'reserve yield',to:'specific FX-pool incentive',class:'UNKNOWN'}
      ]
    }),
    fraxNet:surface({
      id:'fraxnet',label:'FraxNet',
      mechanism:'cross-chain mint/redeem and canonical frxUSD routing',
      atoms:['supported mint routes','supported redemption routes','deposit jobs','redemption jobs','active jobs','minted frxUSD','redeemed frxUSD','source chain','destination chain','custodian route'],
      sourceContract:OFFICIAL_SOURCES.fraxNet,
      mechanicalRelations:[
        {from:'approved collateral deposit',to:'frxUSD mint',class:'MECHANICAL-source-documented-not-currently-reproduced'},
        {from:'frxUSD redemption',to:'USDC/custodian redemption path',class:'MECHANICAL-source-documented-not-currently-reproduced'},
        {from:'cross-chain route',to:'economic demand conclusion',class:'UNKNOWN'}
      ]
    }),
    fraxlend:surface({
      id:'fraxlend',label:'Fraxlend',
      mechanism:'isolated lending pairs and protocol-owned lending AMO',
      atoms:['pair','asset','collateral','total assets','total borrows','utilization','borrow rate','interest accrued','fToken shares','fToken share price','AMO supplied capital','protocol income'],
      sourceContract:OFFICIAL_SOURCES.fraxlend,
      mechanicalRelations:[
        {from:'total borrows / lendable capital',to:'utilization',class:'MECHANICAL-ready-for-onchain-reproduction'},
        {from:'utilization + rate model',to:'borrow rate',class:'MECHANICAL-ready-for-onchain-reproduction'},
        {from:'interest accrual',to:'fToken share price',class:'MECHANICAL-ready-for-onchain-reproduction'},
        {from:'Fraxlend activity',to:'veFRAX distribution',class:'UNKNOWN'}
      ]
    }),
    fraxswapBamm:surface({
      id:'fraxswap-bamm',label:'Fraxswap / BAMM',
      mechanism:'AMM/TWAMM liquidity + rented liquidity lending',
      atoms:['pair','reserves','liquidity','volume','swap fees','TWAMM long-term order flow','BAMM deposits','rented liquidity','utilization','borrow interest','lender yield'],
      sourceContract:OFFICIAL_SOURCES.fraxswapBamm,
      mechanicalRelations:[
        {from:'swap volume',to:'swap fees',class:'MECHANICAL-ready-for-pair-level-reproduction'},
        {from:'rented liquidity',to:'borrow interest',class:'MECHANICAL-ready-for-BAMM-reproduction'},
        {from:'Fraxswap/BAMM fees',to:'veFRAX cash flow',class:'UNKNOWN'}
      ]
    }),
    fxb:surface({
      id:'fxb',label:'FXB',
      mechanism:'zero-coupon bond term structure / maturity curve',
      atoms:['series','maturity','spot price','discount to face','implied annualized yield','supply','auction state','redemption asset identity'],
      sourceContract:OFFICIAL_SOURCES.fxb,
      mechanicalRelations:[
        {from:'spot price + face value + time to maturity',to:'implied yield',class:'MECHANICAL-ready-for-onchain-reproduction'},
        {from:'FXB demand',to:'frxUSD peg effect',class:'CORRELATED-until-transactional-causality-proven'},
        {from:'LFRAX identity',to:'frxUSD identity',class:'UNKNOWN-do-not-assume-equivalence'}
      ]
    }),
    fxLiquidity:surface({
      id:'fx-liquidity',label:'FX / tokenized-currency liquidity',
      mechanism:'frxUSD liquidity against tokenized currencies and stable assets',
      atoms:['pool identity','chain','paired asset','liquidity','volume','fees','base yield','incentives','price deviation','capital migration'],
      sourceContract:OFFICIAL_SOURCES.fxLiquidity,
      mechanicalRelations:[
        {from:'pool reserves',to:'liquidity',class:'MECHANICAL-ready-for-onchain-reproduction'},
        {from:'Treasury yield',to:'specific FX-pool incentive/yield',class:'UNKNOWN-no-accounting-edge'}
      ]
    }),
    revenueRouting:surface({
      id:'revenue-routing',label:'Protocol revenue → veFRAX → company cash flow',
      mechanism:'end-to-end accounting chain for eligible revenue and actual distributions',
      atoms:['economic activity','gross protocol revenue','costs','revenue share','eligible net revenue','veFRAX allocation','actual distribution asset','company claimable','company claimed','company realised cash flow'],
      sourceContract:OFFICIAL_SOURCES.revenueRouting,
      mechanicalRelations:[
        {from:'economic activity',to:'gross protocol revenue',class:'UNKNOWN-until-source-specific-accounting'},
        {from:'gross revenue - costs/revenue share',to:'eligible net revenue',class:'MECHANICAL-only-after-ledger-fields-exist'},
        {from:'eligible net revenue',to:'veFRAX allocation',class:'UNKNOWN-until-governance/accounting-proof'},
        {from:'actual distribution',to:'company cash flow',class:'UNKNOWN-until-company-route-is-proven'}
      ]
    })
  };

  const surfaceList=Object.values(surfaces);
  const measuredSurfaceCount=surfaceList.filter(x=>String(x.measurementState).startsWith('MEASURED')).length;
  const unknownSurfaceCount=surfaceList.length-measuredSurfaceCount;
  const relationshipGraph=surfaceList.flatMap(s=>s.mechanicalRelations.map((r,index)=>({surfaceId:s.id,index,...r})));
  const relationshipClassCounts=relationshipGraph.reduce((acc,r)=>{const key=String(r.class).split('-')[0];acc[key]=(acc[key]||0)+1;return acc;},{});

  const observation={
    version:FRAX_ECOSYSTEM_VERSION,
    observedAt:state.generatedAt||frax.observedAt||null,
    protocolId:FRAX_PROTOCOL_ID,
    lifecycleStage:lifecycle.maturityStage,
    status:unknownSurfaceCount===0?'deep-sensor-family-fully-measured':'deep-sensor-family-active-partial-measurement',
    scope:'registry-wide-frax-ecosystem',
    coverage:{
      surfaceCount:surfaceList.length,
      measuredSurfaceCount,
      sourceBoundUnknownSurfaceCount:unknownSurfaceCount,
      surfaceIds:surfaceList.map(x=>x.id),
      relationshipCount:relationshipGraph.length,
      relationshipClassCounts
    },
    surfaces,
    relationshipGraph,
    epistemic:{
      sourceReadinessIsMeasurement:false,
      documentedMechanismIsCurrentMeasurement:false,
      topologyIsCausality:false,
      unknownIsZero:false,
      currentMeasuredEconomicSurface:'governance-vefrax',
      revenueToVeFraxAprCausality:'UNKNOWN',
      treasuryYieldToSpecificFxPoolIncentive:'UNKNOWN',
      legacyEthereumToFraxtalLockMigration:'UNKNOWN',
      currentFraxNativePeriodDepth:governanceMeasured.validatedNativePeriodCount,
      predictionAuthority:'none',
      recommendationAuthority:'none',
      causalClaimAuthority:'none',
      executionAuthority:'none'
    },
    nextMeasurementUnlocks:[
      'Bind FraxtalPoints/Flox epoch reads to explicit epoch boundaries and company addresses.',
      'Ingest frxUSD/sfrxUSD current ERC20/ERC4626 state plus reproducible backing/allocation evidence.',
      'Enumerate FraxNet jobs/flows with bounded API or onchain event history.',
      'Enumerate Fraxlend Pair Registry and reproduce utilization/rate/share-price identities.',
      'Enumerate Fraxswap/BAMM factories and reproduce pool/liquidity/fee/borrow-interest state.',
      'Read FXB series price/supply/maturity state and reproduce implied yield.',
      'Resolve named FX pool identities before measuring liquidity/volume/fees/incentives.',
      'Prove revenue routing end-to-end before any protocol-revenue→veFRAX/company cash-flow claim.'
    ],
    authority:{
      readOnly:true,
      lifecyclePromotionAuthority:'none',
      repositoryMutationAuthority:false,
      workflowDispatchAuthority:false,
      allocationAuthority:false,
      recommendationAuthority:false,
      causalClaimAuthority:'none',
      executionAuthority:'none'
    }
  };
  observation.id=`frax-ecosystem:${sha256(stableStringify({
    measured:governanceMeasured,
    surfaceIds:observation.coverage.surfaceIds,
    relationshipGraph:observation.relationshipGraph,
    sources:OFFICIAL_SOURCES
  })).slice(0,24)}`;
  return observation;
}

export function applyFraxEcosystemSensor({state,previousState}){
  if(!state||typeof state!=='object')fail('Frax ecosystem sensor requires Economic Graph state');
  if(state?.authority?.executionAuthority!=='none'||state?.authority?.causalClaimAuthority!=='none')fail('Frax ecosystem sensor refuses Graph authority drift');
  const beforeCount=Number(state?.protocolLifecycle?.summary?.protocolCount||Object.keys(state?.protocolLifecycle?.protocols||{}).length);
  if(beforeCount!==8)fail(`Frax ecosystem family requires the eight-protocol lifecycle surface, got ${beforeCount}`);

  const current=buildFraxEcosystemObservation({state});
  const previousRows=Array.isArray(previousState?.protocolEvidence?.[FRAX_ECOSYSTEM_EVIDENCE_ID]?.observations)
    ? previousState.protocolEvidence[FRAX_ECOSYSTEM_EVIDENCE_ID].observations
    : [];
  const observations=[...previousRows];
  if(!observations.some(x=>x?.id===current.id))observations.push(current);
  const bounded=observations.slice(-MAX_OBSERVATIONS);

  state.protocolEvidence={...(state.protocolEvidence||{}),[FRAX_ECOSYSTEM_EVIDENCE_ID]:{
    version:FRAX_ECOSYSTEM_VERSION,
    status:current.status,
    protocolId:FRAX_PROTOCOL_ID,
    latest:{observation:current},
    observationCount:bounded.length,
    observations:bounded,
    authority:current.authority
  }};
  const fraxSensor=state.protocolSensors?.[FRAX_PROTOCOL_ID];
  if(!fraxSensor)fail('Frax lifecycle sensor disappeared during ecosystem attachment');
  fraxSensor.ecosystemFamily={
    evidenceId:FRAX_ECOSYSTEM_EVIDENCE_ID,
    version:FRAX_ECOSYSTEM_VERSION,
    status:current.status,
    surfaceCount:current.coverage.surfaceCount,
    measuredSurfaceCount:current.coverage.measuredSurfaceCount,
    sourceBoundUnknownSurfaceCount:current.coverage.sourceBoundUnknownSurfaceCount,
    latestObservationId:current.id
  };
  if(fraxSensor?.latest?.observation)fraxSensor.latest.observation.ecosystemFamily=fraxSensor.ecosystemFamily;

  const afterCount=Number(state?.protocolLifecycle?.summary?.protocolCount||Object.keys(state?.protocolLifecycle?.protocols||{}).length);
  if(afterCount!==beforeCount)fail('Frax ecosystem family must not create another lifecycle protocol');
  if(state?.protocolLifecycle?.protocols?.[FRAX_PROTOCOL_ID]?.maturityStage!==current.lifecycleStage)fail('Frax ecosystem family changed Frax lifecycle maturity');
  if(current.coverage.surfaceCount!==9||current.coverage.measuredSurfaceCount!==1)fail('Frax ecosystem v0.1 coverage contract drift');
  if(current.epistemic?.executionAuthority!=='none'||current.authority?.executionAuthority!=='none')fail('Frax ecosystem execution authority leaked');
  if(!String(current.epistemic?.treasuryYieldToSpecificFxPoolIncentive||'').startsWith('UNKNOWN'))fail('Treasury→FX pool causal boundary weakened');
  if(!String(current.epistemic?.revenueToVeFraxAprCausality||'').startsWith('UNKNOWN'))fail('Revenue→veFRAX APR causal boundary weakened');
  return state;
}
