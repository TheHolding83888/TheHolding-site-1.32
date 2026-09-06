#!/usr/bin/env node
/**
 * Project X · factual collectible-fee income candidates.
 *
 * Converts only positive deltas between adjacent read-only collect.staticCall
 * observations for the exact same active NFT fingerprint into Canonical Income
 * Ledger accrued-entitlement candidates. Opening balances, fingerprint changes,
 * claim/reset decreases, cross-month intervals and Reference APR never create
 * income here.
 */

const VERSION='0.1-projectx-factual-fee-income-candidates';
const COMPANY='Cypher';
const REGISTRY='010';
const ROUTE='projectx-whype-usdc';
const PROTOCOL='Project X';
const SOURCE_FILE='companies/company-010-projectx-rate-history.json';
const EPS=1e-12;

const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
const round=(v,d=12)=>{if(!finite(v))return null;const f=10**d;return Math.round(Number(v)*f)/f;};
const monthKey=v=>{const t=Date.parse(v||'');return Number.isFinite(t)?new Date(t).toISOString().slice(0,7):null;};
const dayKey=v=>{const t=Date.parse(v||'');return Number.isFinite(t)?new Date(t).toISOString().slice(0,10):null;};

function validateAuthority(source){
  const a=source?.authority||{};
  if(a.readOnly!==true||a.walletSigning!==false||a.transactions!==false||a.executionAuthority!=='none'){
    throw new Error('Project X source authority expansion');
  }
}

function validateObservation(row,index){
  if(!row?.observedAt||!Number.isFinite(Date.parse(row.observedAt)))throw new Error(`Project X observation ${index} missing observedAt`);
  if(!row?.fingerprint||!String(row.fingerprint).trim())throw new Error(`Project X observation ${index} missing fingerprint`);
  if(row?.strategy?.pair!=='WHYPE-USDC')throw new Error(`Project X observation ${index} pair drift`);
  if(!String(row?.source||'').includes('collect.staticCall'))throw new Error(`Project X observation ${index} lost collect.staticCall provenance`);
  const feeKeys=Object.keys(row?.fees||{}).sort();
  const priceKeys=Object.keys(row?.prices||{}).sort();
  if(JSON.stringify(feeKeys)!==JSON.stringify(['USDC','WHYPE'])||JSON.stringify(priceKeys)!==JSON.stringify(['USDC','WHYPE'])){
    throw new Error(`Project X observation ${index} fee/price token set drift`);
  }
  for(const token of feeKeys){
    if(!finite(row.fees[token])||Number(row.fees[token])<0)throw new Error(`Project X observation ${index} invalid ${token} fee`);
    if(!finite(row.prices[token])||!(Number(row.prices[token])>0))throw new Error(`Project X observation ${index} invalid ${token} price`);
  }
}

function validateProjectXHistory(source){
  if(source?.version!=='0.1-projectx-rate-history')throw new Error('Project X history version drift');
  if(source?.engineVersion!=='0.2-projectx-dynamic-active-set-observed-fee-reference-apr')throw new Error('Project X history engine drift');
  if(source?.company?.registry!==REGISTRY||source?.company?.name!==COMPANY)throw new Error('Project X company identity drift');
  if(source?.methodology?.feeTierIsNotYield!==true)throw new Error('Project X fee-tier boundary drift');
  if(!Array.isArray(source?.methodology?.resetRules)||!source.methodology.resetRules.some(x=>String(x).includes('fingerprint changed'))||!source.methodology.resetRules.some(x=>String(x).includes('decreased materially'))){
    throw new Error('Project X reset-rule contract drift');
  }
  validateAuthority(source);
  const rows=Array.isArray(source?.observations)?source.observations:[];
  if(rows.length<2)throw new Error('Project X history needs at least two observations');
  let previous='';
  rows.forEach((row,index)=>{
    validateObservation(row,index);
    if(previous&&row.observedAt<=previous)throw new Error('Project X observations are not strictly chronological');
    previous=row.observedAt;
  });
  return rows;
}

function buildProjectXIncomeCandidates(source,finalizeCandidate,generatedAt=new Date().toISOString()){
  if(typeof finalizeCandidate!=='function')throw new Error('Project X candidate finalizer missing');
  const rows=validateProjectXHistory(source);
  const candidates=[];
  const intervals=[];

  for(let i=1;i<rows.length;i++){
    const start=rows[i-1],end=rows[i];
    const base={startAt:start.observedAt,endAt:end.observedAt,startFingerprint:start.fingerprint,endFingerprint:end.fingerprint};

    if(start.fingerprint!==end.fingerprint){
      intervals.push({...base,status:'boundary-fingerprint-change',candidateEventCount:0});
      continue;
    }
    if(monthKey(start.observedAt)!==monthKey(end.observedAt)){
      intervals.push({...base,status:'boundary-cross-month-unallocated',candidateEventCount:0});
      continue;
    }

    const tokens=Object.keys(end.fees).sort();
    const deltas=Object.fromEntries(tokens.map(token=>[token,Number(end.fees[token])-Number(start.fees[token])]));
    if(tokens.some(token=>deltas[token]<-EPS)){
      intervals.push({...base,status:'boundary-claim-or-reset',candidateEventCount:0});
      continue;
    }

    let count=0;
    for(const token of tokens){
      const delta=deltas[token];
      if(!(delta>EPS))continue;
      const endpointPrice=Number(end.prices[token]);
      const usdValue=delta*endpointPrice;
      if(!(usdValue>0))throw new Error(`Project X ${token} positive delta produced invalid USD value`);
      const sourceIdentity=`${start.fingerprint}:${start.observedAt}:${end.observedAt}:${token}`;
      const event=finalizeCandidate({
        eventKey:`projectx-fee-accrual:${sourceIdentity}`,
        company:COMPANY,
        family:'accrued-entitlement',
        economicDate:dayKey(end.observedAt),
        periodStart:start.observedAt,
        periodEnd:end.observedAt,
        route:ROUTE,
        protocol:PROTOCOL,
        asset:token,
        amount:round(delta,12),
        usdValue:round(usdValue,8),
        valuationStatus:'frozen-at-interval-end-observed-token-price',
        valuationMethod:'interval-end-observed-token-price',
        valuationUnitUsd:round(endpointPrice,12),
        activeSetFingerprint:start.fingerprint,
        sourceFile:SOURCE_FILE,
        sourceFamily:'adjacent same-fingerprint collect.staticCall fee observations',
        sourceIdentity,
        evidenceStatus:'canonical-positive-collectible-fee-delta',
        openingBalanceCreatesIncome:false,
        claimOrResetIsSettlementBoundary:true,
        claimOrResetCreatesSecondIncome:false,
        crossMonthIntervalAutoAllocated:false,
        referenceAprUsed:false,
        laterClaimOrPriceMoveDoesNotRewriteIncome:true,
        unknownIsNotZero:true,
        executionAuthority:'none'
      },generatedAt);
      candidates.push(event);count++;
    }
    intervals.push({...base,status:count?'accepted-positive-fee-growth':'measured-zero-fee-growth',candidateEventCount:count});
  }

  return{
    version:VERSION,
    candidates,
    intervals,
    summary:{
      observationCount:rows.length,
      intervalCount:intervals.length,
      acceptedIntervalCount:intervals.filter(x=>x.status==='accepted-positive-fee-growth').length,
      measuredZeroIntervalCount:intervals.filter(x=>x.status==='measured-zero-fee-growth').length,
      fingerprintBoundaryCount:intervals.filter(x=>x.status==='boundary-fingerprint-change').length,
      claimResetBoundaryCount:intervals.filter(x=>x.status==='boundary-claim-or-reset').length,
      crossMonthBoundaryCount:intervals.filter(x=>x.status==='boundary-cross-month-unallocated').length,
      candidateEventCount:candidates.length
    },
    semantics:{
      openingBalanceCreatesIncome:false,
      fingerprintChangeCreatesIncome:false,
      claimOrResetCreatesIncome:false,
      claimOrResetIsSettlementBoundary:true,
      crossMonthIntervalAutoAllocated:false,
      referenceAprUsed:false,
      endpointObservedPriceFreezesValuation:true,
      currentClaimableBalanceIsPeriodIncome:false,
      unknownIsNotZero:true
    },
    authority:{executionAuthority:'none',walletAuthority:'none',claimingAuthority:'none',capitalExecution:false,methodologyMutationAuthority:'none'}
  };
}

export{VERSION,COMPANY,REGISTRY,ROUTE,PROTOCOL,SOURCE_FILE,validateProjectXHistory,buildProjectXIncomeCandidates};
