#!/usr/bin/env node

const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
const dayKey=v=>{const t=Date.parse(v||'');return Number.isFinite(t)?new Date(t).toISOString().slice(0,10):null;};

export function validateYieldBasisEvidence(source){
  if(!source?.version)return{present:false};
  if(source.version!=='0.1-yield-basis-factual-accrual-evidence'||source?.mechanism!=='yield-basis-fees')throw new Error('Yield Basis accounting evidence identity drift');
  const s=source?.semantics||{},a=source?.authority||{};
  if(s.openingBalanceCreatesIncome!==false||s.earnedIndependentOfClaim!==true||s.claimIsSettlementNotSecondIncome!==true||s.referenceAprUsed!==false||s.laterPriceMovementRewritesClosedIncome!==false||s.unknownIsNotZero!==true)throw new Error('Yield Basis accounting semantics invalid');
  if(a.executionAuthority!=='none'||a.walletAuthority!=='none'||a.claimingAuthority!=='none'||a.capitalExecution!==false||a.methodologyMutationAuthority!=='none')throw new Error('Yield Basis accounting authority expansion');
  return{present:true};
}

export function yieldBasisEvidenceCandidates(source,finalizeCandidate,generatedAt){
  const presence=validateYieldBasisEvidence(source);if(!presence.present)return[];
  const seen=new Set(),out=[];
  for(const e of source?.events||[]){
    if(!e?.eventKey||seen.has(e.eventKey))throw new Error('Yield Basis duplicate or missing event identity');seen.add(e.eventKey);
    if(e.family!=='accrued-entitlement'||e.route!=='yield-basis-fees'||!e.company||!dayKey(e.economicDate)||!(finite(e.amount)>0)||!e.amountRaw)throw new Error(`Yield Basis event economics invalid: ${e.eventKey}`);
    if(e.referenceAprUsed!==false||e.currentClaimableBalanceIsPeriodIncome!==false||e.claimIsSecondIncomeEvent!==false||e.laterClaimOrPriceMoveDoesNotRewriteIncome!==true||e.unknownIsNotZero!==true)throw new Error(`Yield Basis event recognition boundary invalid: ${e.eventKey}`);
    if(e.usdValue!==null&&e.usdValue!==undefined&&!(finite(e.usdValue)>0))throw new Error(`Yield Basis event USD value invalid: ${e.eventKey}`);
    out.push(finalizeCandidate({...e,sourceFile:'reporting/yield-basis-accounting-evidence.json',sourceFamily:'Yield Basis FeeDistributor factual accrual evidence'},generatedAt));
  }
  return out;
}
