#!/usr/bin/env node
/**
 * Pure fail-closed policy helper for historical reward-token valuation UNKNOWNs.
 *
 * It does not price anything and does not mutate accounting truth. It only
 * proves when the existing Canonical Income Ledger resolver has attempted every
 * eligible unresolved ve33 event and all remaining failures are accepted
 * terminal route-discovery outcomes. Any missing parity or non-terminal status
 * keeps the caller in engineering-actionable RED.
 */

export const VERSION='0.1-terminal-historical-valuation-unknown-policy';
export const CANONICAL_USD_INCOMPLETE_REASON='canonical-event-usd-valuation-incomplete';
export const TERMINAL_HISTORICAL_VALUATION_STATUSES=new Set([
  'historical-aerodrome-usdc-route-unavailable',
  'historical-aerodrome-usdc-route-ambiguous',
  'historical-velodrome-usdc-route-unavailable',
  'historical-velodrome-usdc-route-ambiguous'
]);

const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
const canonical=name=>String(name||'').trim()==='aerocrvyb.eth'?'aerocvxyb.eth':String(name||'').trim();
const monthKey=value=>{const t=Date.parse(value||'');return Number.isFinite(t)?new Date(t).toISOString().slice(0,7):null;};

export function isHistoricalValuationEligibleEvent(event){
  return event?.family==='accrued-entitlement'&&
    event?.sourceFile==='reporting/ve33-accounting-evidence.json'&&
    event?.usdValue===null&&
    event?.valuationStatus==='unvalued-fail-closed'&&
    Number.isFinite(Date.parse(String(event?.periodEnd||'')))&&
    finite(event?.amount)&&Number(event.amount)>0&&
    event?.unknownIsNotZero===true&&
    event?.executionAuthority==='none';
}

export function hasResolvedHistoricalValuation(event){
  const r=event?.valuationResolution||null;
  return r?.version==='0.1-canonical-historical-valuation-resolution'&&
    r?.resolvesUsdValue===true&&
    finite(r?.resolvedUsdValue)&&Number(r.resolvedUsdValue)>0&&
    finite(r?.valuationUnitUsd)&&Number(r.valuationUnitUsd)>0&&
    r?.identityBound===true&&
    r?.economicFieldsMutated===false&&
    r?.referenceAprUsed===false&&
    r?.currentPriceUsed===false&&
    r?.unknownIsNotZero===true&&
    r?.executionAuthority==='none';
}

function historicalResolutionSummary(ledger){
  return ledger?.accountingExtensions?.historicalValuationResolution||
    ledger?.sourceState?.historicalValuationResolution||null;
}

export function terminalHistoricalValuationContext(ledger){
  const summary=historicalResolutionSummary(ledger);
  if(
    summary?.version!=='0.1-canonical-historical-valuation-resolution'||
    summary?.economicFieldsMutated!==false||
    summary?.referenceAprUsed!==false||
    summary?.currentPriceUsed!==false||
    summary?.unknownIsNotZero!==true||
    summary?.executionAuthority!=='none'||
    Number(summary?.identityMismatchEventCount||0)!==0
  ) return{ok:false,reason:'historical-valuation-summary-contract-invalid',unresolvedEvents:[],statuses:{}};

  const eligible=(ledger?.events||[]).filter(isHistoricalValuationEligibleEvent);
  const resolved=eligible.filter(hasResolvedHistoricalValuation);
  const unresolved=eligible.filter(event=>!hasResolvedHistoricalValuation(event));
  const statuses=summary?.unresolvedStatuses&&typeof summary.unresolvedStatuses==='object'?summary.unresolvedStatuses:{};
  const statusEntries=Object.entries(statuses).filter(([,count])=>Number(count)>0);
  const statusCount=statusEntries.reduce((sum,[,count])=>sum+Number(count||0),0);
  const countsMatch=
    Number(summary?.eligibleEventCount)===eligible.length&&
    Number(summary?.resolvedEventCount)===resolved.length&&
    Number(summary?.unresolvedEventCount)===unresolved.length&&
    Number(summary?.eligibleEventCount)===Number(summary?.resolvedEventCount)+Number(summary?.unresolvedEventCount)&&
    statusCount===unresolved.length;
  if(!countsMatch)return{ok:false,reason:'historical-valuation-attempt-parity-mismatch',unresolvedEvents:unresolved,statuses};
  if(unresolved.length===0)return{ok:false,reason:'no-terminal-historical-valuation-unknowns',unresolvedEvents:[],statuses};
  if(statusEntries.some(([status])=>!TERMINAL_HISTORICAL_VALUATION_STATUSES.has(status))){
    return{ok:false,reason:'non-terminal-historical-valuation-status-present',unresolvedEvents:unresolved,statuses};
  }
  return{ok:true,reason:'resolver-attempted-all-remaining-failures-terminal',unresolvedEvents:unresolved,statuses};
}

export function terminalHistoricalUnknownForCompanyMonth({ledger,monthly,company,month,unresolvedEventCount,unresolvedReasons}={}){
  if(!/^\d{4}-\d{2}$/.test(String(month||'')))return{ok:false,reason:'invalid-month'};
  if(String(monthly?.incomeLedger?.generatedAt||'')!==String(ledger?.generatedAt||''))return{ok:false,reason:'monthly-ledger-generation-mismatch'};
  const reasons=Array.isArray(unresolvedReasons)?unresolvedReasons:[];
  if(reasons.length===0||reasons.some(reason=>reason!==CANONICAL_USD_INCOMPLETE_REASON))return{ok:false,reason:'mixed-or-nonvaluation-unresolved-reasons'};
  const context=terminalHistoricalValuationContext(ledger);
  if(!context.ok)return context;
  const matching=context.unresolvedEvents.filter(event=>canonical(event?.company)===canonical(company)&&monthKey(event?.economicDate||event?.periodEnd)===month);
  if(matching.length===0||matching.length!==Number(unresolvedEventCount||0)){
    return{ok:false,reason:'company-month-terminal-event-parity-mismatch',unresolvedEvents:matching,statuses:context.statuses};
  }
  return{
    ok:true,
    reason:'historical-usd-valuation-unprovable-fail-closed',
    unresolvedEvents:matching,
    statuses:context.statuses,
    eventKeys:matching.map(event=>event.eventKey).filter(Boolean)
  };
}
