export const LOCKED_MANAGED_EVIDENCE_VERSION='0.1-ve33-locked-managed-factual-accrual';

const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
const dayKey=v=>{const t=Date.parse(v||'');return Number.isFinite(t)?new Date(t).toISOString().slice(0,10):null;};

export function validateLockedManagedEvidence(source){
  if(!source?.version)return{present:false};
  if(source.version!==LOCKED_MANAGED_EVIDENCE_VERSION)throw new Error('locked-managed evidence version drift');
  const s=source?.semantics||{},a=source?.authority||{};
  if(s.openingBalanceCreatesIncome!==false||s.earnedIndependentOfWithdrawal!==true||s.withdrawalIsSettlementNotSecondIncome!==true||s.grossVeNftPrincipalDeltaIsIncomeAuthority!==false||s.referenceAprUsed!==false||s.laterPriceMovementRewritesClosedIncome!==false||s.unknownIsNotZero!==true)throw new Error('locked-managed evidence semantics invalid');
  if(a.executionAuthority!=='none'||a.walletAuthority!=='none'||a.claimingAuthority!=='none'||a.capitalExecution!==false||a.methodologyMutationAuthority!=='none')throw new Error('locked-managed authority expansion');
  return{present:true};
}

export function lockedManagedEvidenceCandidates(source,finalizeCandidate,generatedAt){
  const status=validateLockedManagedEvidence(source);if(!status.present)return[];
  const out=[],seen=new Set();
  for(const e of source?.events||[]){
    if(!e?.eventKey||seen.has(e.eventKey))throw new Error('locked-managed duplicate or missing event identity');seen.add(e.eventKey);
    if(e.family!=='embedded-compounded-income'||e.mechanismKind!=='locked-managed-reward'||!e.company||!e.route||!e.protocol||!dayKey(e.economicDate)||!(finite(e.amount)&&Number(e.amount)>0)||!e.amountRaw)throw new Error(`locked-managed event economics invalid: ${e.eventKey}`);
    if(!e.holder||!e.tokenId||!e.managedTokenId||!e.rewardContract||!e.token)throw new Error(`locked-managed event identity incomplete: ${e.eventKey}`);
    if(e.recognitionState!=='compounded-locked'||e.openingBalanceCreatesIncome!==false||e.earnedIndependentOfWithdrawal!==true||e.withdrawalIsSettlementNotSecondIncome!==true||e.grossVeNftPrincipalDeltaIsIncomeAuthority!==false||e.referenceAprUsed!==false||e.currentClaimableBalanceIsPeriodIncome!==false||e.claimIsSecondIncomeEvent!==false||e.laterClaimOrPriceMoveDoesNotRewriteIncome!==true||e.unknownIsNotZero!==true)throw new Error(`locked-managed recognition boundary invalid: ${e.eventKey}`);
    if(e.usdValue!==null&&e.usdValue!==undefined&&!(finite(e.usdValue)&&Number(e.usdValue)>0))throw new Error(`locked-managed USD value invalid: ${e.eventKey}`);
    out.push(finalizeCandidate({...e,family:'embedded-income',sourceEvidenceFamily:e.family,sourceFile:'reporting/ve33-locked-managed-accounting-evidence.json',sourceFamily:'ve(3,3) LockedManagedReward factual accrual'},generatedAt));
  }
  return out;
}
