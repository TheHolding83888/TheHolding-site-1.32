#!/usr/bin/env node
/**
 * The Holding · Pendle / sPENDLE accounting evidence v0.1
 *
 * Reuses canonical Productivity research only. No second collector, writer,
 * workflow-dispatch lane, recommendation authority or causal authority.
 *
 * Scope:
 *   - prove historical API buyback/distribution amount parity against official
 *     Merkle sPENDLE campaigns when the canonical mapping passes tolerance;
 *   - prove the stable publication-calendar offset already measured upstream;
 *   - keep revenue -> buyback causality and current-period APR explicitly
 *     unresolved until separate evidence closes those gates.
 */

export const PENDLE_ACCOUNTING_EVIDENCE_ID='defitea-pendle-spendle-accounting';
export const PENDLE_ACCOUNTING_EVIDENCE_VERSION='0.1-pendle-spendle-accounting-evidence';
const OFFICIAL_API='https://api-v2.pendle.finance/core/v1/spendle/data';

function fail(message){throw new Error(message);}
function finite(value){return value!==null&&value!==undefined&&value!==''&&Number.isFinite(Number(value));}
function n(value){return finite(value)?Number(value):null;}
function round(value,digits=8){const x=Number(value);return Number.isFinite(x)?Number(x.toFixed(digits)):null;}
function activeAttempt(engine){
  const details=engine?.details||{};
  return details?.currentAttempt&&typeof details.currentAttempt==='object'?details.currentAttempt:details;
}
function normalizePair(row){
  const apiBuyback=n(row?.apiBuybackAmount);
  const merkleReward=n(row?.merkleReward);
  return {
    campaign:row?.campaign||null,
    apiIndex:Number.isFinite(Number(row?.apiIndex))?Number(row.apiIndex):null,
    apiPeriodStart:row?.apiPeriodStart||null,
    apiPeriodEnd:row?.apiPeriodEnd||null,
    merklePeriodStart:row?.merklePeriodStart||null,
    merklePeriodEnd:row?.merklePeriodEnd||null,
    apiRevenue:n(row?.apiRevenue),
    apiBuybackAmount:apiBuyback,
    merkleDistributedSPendle:merkleReward,
    amountDifference:finite(row?.amountDifference)?round(row.amountDifference,8):(apiBuyback!==null&&merkleReward!==null?round(Math.abs(apiBuyback-merkleReward),8):null),
    amountMatch:row?.amountMatch===true,
    startOffsetSeconds:n(row?.startOffsetSeconds),
    endOffsetSeconds:n(row?.endOffsetSeconds),
    offsetDays:n(row?.offsetDays),
    offsetDriftSeconds:n(row?.offsetDriftSeconds)
  };
}

export function buildPendleAccountingEvidence({productivity,productivitySha256}){
  if(!productivity||typeof productivity!=='object')fail('Pendle accounting evidence requires Productivity state');
  if(!/^[0-9a-f]{64}$/i.test(String(productivitySha256||'')))fail('Pendle accounting evidence Productivity SHA-256 missing');
  const engine=productivity?.engines?.pendle_spendle;
  if(!engine)fail('Canonical pendle_spendle Productivity engine missing');
  if(engine.protocol!=='Pendle'||engine.sourceUrl!==OFFICIAL_API||engine.nativeCadence!=='14d')fail('Pendle accounting source identity/cadence drift');

  const attempt=activeAttempt(engine);
  const research=attempt?.research||{};
  const epochMap=research?.epochMap||{};
  const pairs=Array.isArray(epochMap?.pairs)?epochMap.pairs.map(normalizePair):[];
  const pairCount=Number(epochMap?.pairCount||pairs.length||0);
  const amountMatches=Number(epochMap?.exactAmountMatches||pairs.filter(x=>x.amountMatch).length||0);
  const offsetConsensus=epochMap?.offsetConsensus===true;
  const maxOffsetDeviationSeconds=n(epochMap?.maxOffsetDeviationSeconds);
  const amountParityProven=Boolean(pairCount>=3&&amountMatches===pairCount&&pairs.length>=3);
  const calendarParityProven=Boolean(offsetConsensus&&finite(epochMap?.offsetSeconds)&&maxOffsetDeviationSeconds!==null&&maxOffsetDeviationSeconds<=3600);
  const historicalDistributionPublicationIdentityProven=amountParityProven&&calendarParityProven;
  const currentPeriodValidated=engine.status==='ok'&&finite(engine.aprLatest)&&['replicated-current-balance-survivor-cluster','genuine-zero-multi-source'].includes(attempt?.selectionRule||'');

  return {
    version:PENDLE_ACCOUNTING_EVIDENCE_VERSION,
    evidenceId:PENDLE_ACCOUNTING_EVIDENCE_ID,
    status:historicalDistributionPublicationIdentityProven?'historical-distribution-publication-identity-proven':'warming',
    generatedFrom:{
      productivityFile:'companies/productivity-data.json',
      productivityGeneratedAt:productivity.generatedAt||null,
      productivitySha256,
      engineId:'pendle_spendle',
      sourceUrl:engine.sourceUrl,
      sourceType:engine.sourceType||null,
      nativeCadence:engine.nativeCadence
    },
    coverage:{
      mappedCampaigns:pairCount,
      amountMatches,
      amountMatchRate:pairCount>0?round(amountMatches/pairCount,6):null,
      stableCalendarOffset:calendarParityProven,
      offsetSeconds:n(epochMap?.offsetSeconds),
      offsetDays:n(epochMap?.offsetDays),
      maxOffsetDeviationSeconds,
      historicalDistributionPublicationIdentityProven,
      currentPeriodValidated
    },
    historicalPairs:pairs.slice(-16),
    relations:{
      apiBuybackAmountToMerkleDistribution:historicalDistributionPublicationIdentityProven
        ?'ATTRIBUTED-mechanical-publication-parity-within-canonical-tolerance'
        :'UNKNOWN-insufficient-cross-source-parity',
      apiEpochToMerkleCampaignCalendar:calendarParityProven
        ?'ATTRIBUTED-stable-publication-calendar-offset'
        :'UNKNOWN-calendar-alignment-not-proven',
      protocolRevenueToBuyback:'UNKNOWN-upstream-accounting-or-causal-conversion-not-proven',
      buybackDistributionToCurrentReferenceApr:currentPeriodValidated
        ?'MEASURED-current-period-reference-apr-validated-by-canonical-productivity'
        :'UNKNOWN-current-period-reference-apr-not-validated'
    },
    epistemicBoundary:'Historical API buyback/distribution amount parity with official Merkle campaigns proves downstream publication/accounting consistency only. It does not prove why protocol revenue changed, that revenue caused a specific buyback amount, or that any historical distribution explains the current APR.',
    nextUnlocks:[
      'current completed sPENDLE period maps to an official Merkle campaign and passes the canonical survivor-denominator gate',
      'at least two distinct validated current-period lifecycle observations accumulate',
      'a protocol-specific reproducible accounting identity closes revenue -> buyback -> distribution without causal overreach'
    ],
    authority:{
      readOnly:true,
      executionAuthority:'none',
      repositoryMutationAuthority:false,
      workflowDispatchAuthority:false,
      recommendationAuthority:'none',
      predictionAuthority:'none',
      causalClaimAuthority:'none',
      methodologyMutationAuthority:false
    }
  };
}

export function applyPendleAccountingEvidence({state,productivity,productivitySha256}){
  if(!state||typeof state!=='object')fail('Pendle accounting evidence requires Economic Graph state');
  if(state?.authority?.executionAuthority!=='none'||state?.authority?.causalClaimAuthority!=='none')fail('Pendle accounting evidence refuses authority drift');
  const evidence=buildPendleAccountingEvidence({productivity,productivitySha256});
  state.protocolEvidence={...(state.protocolEvidence||{}),[PENDLE_ACCOUNTING_EVIDENCE_ID]:evidence};
  return state;
}
