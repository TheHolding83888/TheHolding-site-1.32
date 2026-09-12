#!/usr/bin/env node
import assert from 'node:assert/strict';
import { PROTOCOLS, DIRECT_ACCOUNTING_START, FULL_ACCOUNTING_START } from './ve33-accounting-evidence.mjs';
import {
  VERSION,
  REQUIRED_HISTORICAL_BOUNDARIES,
  historicalRpcUrls,
  requireHistoricalRpc,
  rpcLabel,
  historicalCodeBlockTag,
  isExactCodeAbsence,
  transientVotingLaneKey,
  buildPredeploymentZeroCheckpoint,
  attachHistoricalCallRouter,
  canReuseEvidence,
  evidenceFreshEnough,
  evidenceInputFingerprint,
  recoveryClaims,
  recoveryAuthorityValid,
  applyTransientClaimRecovery,
  SAFE_WRITER_EVIDENCE_REUSE,
  TRANSIENT_RECOVERY_POLICY
} from './ve33-accounting-runner.mjs';

assert.equal(VERSION,'0.1-ve33-capability-aware-historical-rpc-runner');
assert.deepEqual(REQUIRED_HISTORICAL_BOUNDARIES,[DIRECT_ACCOUNTING_START,FULL_ACCOUNTING_START]);
assert.equal(rpcLabel('https://base-rpc.publicnode.com'),'base-rpc.publicnode.com');
assert.equal(rpcLabel('not-a-url'),'configured-rpc');

const cfg={rpcEnv:'TEST_RPC_URL',rpcFallbacks:['https://fallback-one.example','https://fallback-two.example','https://fallback-one.example']};
assert.deepEqual(historicalRpcUrls(cfg,{TEST_RPC_URL:'https://configured.example'}),[
  'https://configured.example',
  'https://fallback-one.example',
  'https://fallback-two.example'
]);
assert.deepEqual(historicalRpcUrls(cfg,{}),['https://fallback-one.example','https://fallback-two.example']);
assert.equal(requireHistoricalRpc({VE33_REQUIRE_HISTORICAL_RPC:'1'}),true);
assert.equal(requireHistoricalRpc({VE33_REQUIRE_HISTORICAL_RPC:'true'}),true);
assert.equal(requireHistoricalRpc({VE33_REQUIRE_HISTORICAL_RPC:'yes'}),true);
assert.equal(requireHistoricalRpc({VE33_REQUIRE_HISTORICAL_RPC:'0'}),false);
assert.equal(requireHistoricalRpc({}),false);

for(const key of ['aerodrome','velodrome']){
  const p=PROTOCOLS[key];
  assert.ok(p?.rpcEnv);
  assert.ok(Array.isArray(p?.rpcFallbacks)&&p.rpcFallbacks.length>=2);
  assert.ok(historicalRpcUrls(p,{}).length>=2,`${key} must keep multiple existing historical RPC candidates`);
}

assert.equal(SAFE_WRITER_EVIDENCE_REUSE.semantics.reuseOnlyInsideGeneratedDataPublishCommit,true);
assert.equal(SAFE_WRITER_EVIDENCE_REUSE.semantics.sourceFingerprintMustMatch,true);
assert.equal(SAFE_WRITER_EVIDENCE_REUSE.semantics.staleEvidenceReuseForbidden,true);
assert.equal(SAFE_WRITER_EVIDENCE_REUSE.semantics.currentChainRefreshRemainsDefaultOutsidePublish,true);
assert.equal(SAFE_WRITER_EVIDENCE_REUSE.semantics.executionAuthority,'none');
assert.equal(TRANSIENT_RECOVERY_POLICY.discoveryOnly,true);
assert.equal(TRANSIENT_RECOVERY_POLICY.createsIncome,false);
assert.equal(TRANSIENT_RECOVERY_POLICY.createsRealisedCashFlow,false);
assert.equal(TRANSIENT_RECOVERY_POLICY.canonicalVe33EvidenceRemainsEconomicAuthority,true);
assert.equal(TRANSIENT_RECOVERY_POLICY.predeploymentZeroBaselineRequiresExactHistoricalCodeAbsence,true);
assert.equal(TRANSIENT_RECOVERY_POLICY.executionAuthority,'none');

const company='0x5860...83CA8.eth';
const rewardContract='0x7591A0D4a21170a8bB3C02Bf89F13D7757AeBADe';
const rewardToken='0xB095274743941e953c746F9C228DA9c18Bb6ec29';
const recovery={
  version:'0.1-ve33-transient-claim-recovery',
  generatedAt:'2026-09-12T10:39:00.000Z',
  status:'discovery-complete',
  semantics:{
    discoveryOnly:true,
    createsIncome:false,
    createsRealisedCashFlow:false,
    executionAuthority:'none',
    capitalExecution:false
  },
  authority:{executionAuthority:'none',capitalExecution:false},
  protocols:{
    aerodrome:{claims:[{
      protocolKey:'aerodrome',protocol:'Aerodrome',chain:'Base',chainId:8453,company,route:'aerodrome-ve',
      holder:'0x58603461149Fc2A800a56d421e77DcbBA2D83CA8',tokenId:'1938',
      rewardContract,rewardToken,rewardSymbol:'LAPTOP',amountRaw:'67615020175015840449',blockNumber:51109971,
      transactionHash:'0xaad260eb97a2414e45dc5f105e8966932ca8795eb267aacd9ce85b929cd37153',
      logIndex:28,classification:'transient-orphan-claim',alreadyRepresented:false,knownHistoricalLane:false,
      accountingAuthority:false,periodIncomeAuthority:false,executionAuthority:'none'
    }]}
  }
};
const rewards={companies:{[company]:{rewards:[]}}};
const claims=recoveryClaims(recovery);
assert.equal(claims.length,1);
assert.equal(claims[0].protocolKey,'aerodrome');
assert.equal(recoveryAuthorityValid(recovery),true);
const applied=applyTransientClaimRecovery(rewards,recovery);
assert.equal(applied.diagnostics.status,'applied');
assert.equal(applied.diagnostics.claimCount,1);
assert.equal(applied.diagnostics.shadowRowsInserted,1);
assert.equal(applied.diagnostics.createsIncome,false);
assert.equal(applied.diagnostics.createsRealisedCashFlow,false);
assert.equal(applied.diagnostics.executionAuthority,'none');
assert.equal(rewards.companies[company].rewards.length,0,'recovery enrichment must not mutate canonical rewards input');
const shadow=applied.rewards.companies[company].rewards[0];
assert.equal(shadow.status,'historical-claim-recovery-shadow');
assert.equal(shadow.amount,null);
assert.equal(shadow.usdValue,null);
assert.equal(shadow.accountingAuthority,false);
assert.equal(shadow.periodIncomeAuthority,false);
assert.equal(shadow.realisedCashFlowAuthority,false);
assert.equal(shadow.executionAuthority,'none');
assert.equal(shadow.details.tokenId,'1938');
assert.equal(shadow.details.rewardContract.toLowerCase(),rewardContract.toLowerCase());
assert.equal(shadow.token.toLowerCase(),rewardToken.toLowerCase());
assert.equal(shadow.details.sourceProof,'0xaad260eb97a2414e45dc5f105e8966932ca8795eb267aacd9ce85b929cd37153:28');

const lapClaim=claims[0];
assert.equal(isExactCodeAbsence('0x'),true);
assert.equal(isExactCodeAbsence('0x0'),true);
assert.equal(isExactCodeAbsence('0x00'),true);
assert.equal(isExactCodeAbsence('0x01'),false);
assert.equal(isExactCodeAbsence('0x6000'),false);
assert.equal(historicalCodeBlockTag(50715726,51211957),50715726);
assert.equal(historicalCodeBlockTag(51211900,51211957),null);
const expectedLane='aerodrome|0x5860...83CA8.eth|0x58603461149fc2a800a56d421e77dcbba2d83ca8|1938|voting-reward|0x7591a0d4a21170a8bb3c02bf89f13d7757aebade|0xb095274743941e953c746f9c228da9c18bb6ec29';
assert.equal(transientVotingLaneKey(lapClaim),expectedLane);
const zeroCheckpoint=buildPredeploymentZeroCheckpoint({
  claim:lapClaim,boundaryAt:'2026-09-01T00:00:00.000Z',blockNumber:50715726,blockTimestamp:'2026-08-31T23:59:59.000Z',code:'0x'
});
assert.ok(zeroCheckpoint);
assert.equal(zeroCheckpoint.checkpointKey,`${expectedLane}|50715726`);
assert.equal(zeroCheckpoint.entitlementRaw,'0');
assert.equal(zeroCheckpoint.entitlementAmount,0);
assert.equal(zeroCheckpoint.monthBoundary,true);
assert.equal(zeroCheckpoint.periodIncomeAuthority,false);
assert.equal(zeroCheckpoint.unknownIsNotZero,true);
assert.equal(zeroCheckpoint.predeploymentZeroProof.proof,'eth_getCode-empty-at-exact-historical-boundary');
assert.equal(zeroCheckpoint.predeploymentZeroProof.createsIncome,false);
assert.equal(zeroCheckpoint.predeploymentZeroProof.executionAuthority,'none');
assert.equal(buildPredeploymentZeroCheckpoint({claim:lapClaim,boundaryAt:'2026-09-01T00:00:00.000Z',blockNumber:50715726,code:'0x6000'}),null,'deployed contract must never fabricate a zero opening');

const routingStats={};
const currentProvider={
  call:async()=> 'current-call',
  getCode:async()=> '0x6000'
};
const archiveProvider={
  call:async()=> 'archive-call',
  getCode:async()=> '0x'
};
const routed=attachHistoricalCallRouter({currentProvider,archiveProvider,currentBlockNumber:51211957,stats:routingStats});
assert.equal(await routed.getCode(rewardContract,50715726),'0x','historical code proof must route to archive-capable provider');
assert.equal(await routed.getCode(rewardContract,51211950),'0x6000','near-current code read must stay on current provider');
assert.equal(routingStats.historicalCodeReads,1);
assert.equal(routingStats.currentCodeReads,1);

const invalidRecovery=structuredClone(recovery);
invalidRecovery.semantics.createsIncome=true;
assert.equal(recoveryAuthorityValid(invalidRecovery),false);
const ignored=applyTransientClaimRecovery(rewards,invalidRecovery);
assert.equal(ignored.diagnostics.status,'ignored-invalid-authority');
assert.equal(ignored.diagnostics.shadowRowsInserted,0);
assert.equal(ignored.rewards,rewards);
assert.equal(ignored.rewards.companies[company].rewards.length,0);

const noRecovery=applyTransientClaimRecovery(rewards,{});
assert.equal(noRecovery.diagnostics.status,'not-provided');
assert.equal(noRecovery.diagnostics.shadowRowsInserted,0);

const now=Date.parse('2026-09-06T12:30:00.000Z');
assert.equal(evidenceFreshEnough('2026-09-06T12:00:00.000Z',{now,maxAgeMinutes:45}),true);
assert.equal(evidenceFreshEnough('2026-09-06T11:00:00.000Z',{now,maxAgeMinutes:45}),false);
assert.equal(evidenceFreshEnough('not-a-time',{now,maxAgeMinutes:45}),false);

const fp1=evidenceInputFingerprint({rewards:{generatedAt:'x',companies:{}},recovery:{generatedAt:'r1'},root:process.cwd(),extra:{mode:'test'}});
const fp2=evidenceInputFingerprint({rewards:{generatedAt:'x',companies:{}},recovery:{generatedAt:'r1'},root:process.cwd(),extra:{mode:'test'}});
const fp3=evidenceInputFingerprint({rewards:{generatedAt:'y',companies:{}},recovery:{generatedAt:'r1'},root:process.cwd(),extra:{mode:'test'}});
const fp4=evidenceInputFingerprint({rewards:{generatedAt:'x',companies:{}},recovery:{generatedAt:'r2'},root:process.cwd(),extra:{mode:'test'}});
assert.equal(fp1,fp2);
assert.notEqual(fp1,fp3);
assert.notEqual(fp1,fp4,'new recovery sidecar input must invalidate safe evidence reuse');
assert.equal(canReuseEvidence({previous:{generatedAt:'2026-09-06T12:00:00.000Z',runner:{safeWriterInputFingerprint:fp1}},fingerprint:fp1,root:process.cwd(),env:{GITHUB_ACTIONS:'false'}}),false);

console.log('ve33 capability-aware historical RPC runner validation OK',{
  transientClaimRecovery:true,
  exactLaptopShadowLane:true,
  exactHistoricalCodeAbsenceCanProveZeroOpening:true,
  deployedContractCannotFabricateZeroOpening:true,
  historicalCodeReadsRouteToArchiveProvider:true,
  invalidRecoveryAuthorityFailsClosed:true,
  recoveryFingerprintInvalidatesReuse:true,
  createsIncome:false,
  executionAuthority:'none'
});
