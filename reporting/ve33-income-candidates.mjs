export const VE33_EVIDENCE_VERSION='0.1-ve33-factual-accrual-evidence';

const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
const dayKey=v=>{const t=Date.parse(v||'');return Number.isFinite(t)?new Date(t).toISOString().slice(0,10):null;};

export function validateVe33Evidence(source){
  if(!source?.version)return{present:false};
  if(source.version!==VE33_EVIDENCE_VERSION)throw new Error('ve33 evidence version drift');
  const s=source?.semantics||{},a=source?.authority||{};
  if(s.openingBalanceCreatesIncome!==false||s.earnedIndependentOfClaim!==true||s.claimIsSettlementNotSecondIncome!==true||s.rebaseDepositIntoVeNftIsSecondIncome!==false||s.referenceAprUsed!==false||s.laterPriceMovementRewritesClosedIncome!==false||s.unknownIsNotZero!==true)throw new Error('ve33 evidence semantics invalid');
  if(a.executionAuthority!=='none'||a.walletAuthority!=='none'||a.claimingAuthority!=='none'||a.capitalExecution!==false||a.methodologyMutationAuthority!=='none')throw new Error('ve33 evidence authority expansion');
  return{present:true};
}

export function ve33EvidenceCandidates(source,finalizeCandidate,generatedAt){
  const status=validateVe33Evidence(source);if(!status.present)return[];
  const out=[],seen=new Set();
  for(const e of source?.events||[]){
    if(!e?.eventKey||seen.has(e.eventKey))throw new Error('ve33 duplicate or missing event identity');seen.add(e.eventKey);
    if(e.family!=='accrued-entitlement'||!e.company||!e.route||!e.protocol||!dayKey(e.economicDate)||!(finite(e.amount)&&Number(e.amount)>0)||!e.amountRaw)throw new Error(`ve33 event economics invalid: ${e.eventKey}`);
    if(!['voting-reward','free-managed-reward','rebase-distributor'].includes(e.mechanismKind))throw new Error(`ve33 unsupported mechanism kind: ${e.eventKey}`);
    if(!e.holder||!e.tokenId||!e.token)throw new Error(`ve33 event mechanism identity incomplete: ${e.eventKey}`);
    if(e.referenceAprUsed!==false||e.currentClaimableBalanceIsPeriodIncome!==false||e.claimIsSecondIncomeEvent!==false||e.laterClaimOrPriceMoveDoesNotRewriteIncome!==true||e.unknownIsNotZero!==true)throw new Error(`ve33 recognition boundary invalid: ${e.eventKey}`);
    if(e.usdValue!==null&&e.usdValue!==undefined&&!(finite(e.usdValue)&&Number(e.usdValue)>0))throw new Error(`ve33 USD value invalid: ${e.eventKey}`);
    if(e.mechanismKind==='rebase-distributor'&&e.rewardContract!==null)throw new Error(`ve33 rebase rewardContract must be null: ${e.eventKey}`);
    if(e.mechanismKind!=='rebase-distributor'&&!e.rewardContract)throw new Error(`ve33 reward contract missing: ${e.eventKey}`);
    out.push(finalizeCandidate({...e,sourceFile:'reporting/ve33-accounting-evidence.json',sourceFamily:'ve(3,3) factual accrual evidence'},generatedAt));
  }
  return out;
}
