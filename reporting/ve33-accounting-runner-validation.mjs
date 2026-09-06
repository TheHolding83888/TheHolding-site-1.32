#!/usr/bin/env node
import assert from 'node:assert/strict';
import { PROTOCOLS, DIRECT_ACCOUNTING_START, FULL_ACCOUNTING_START } from './ve33-accounting-evidence.mjs';
import {
  VERSION,
  REQUIRED_HISTORICAL_BOUNDARIES,
  historicalRpcUrls,
  requireHistoricalRpc,
  rpcLabel,
  canReuseEvidence,
  evidenceFreshEnough,
  evidenceInputFingerprint,
  SAFE_WRITER_EVIDENCE_REUSE
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

const now=Date.parse('2026-09-06T12:30:00.000Z');
assert.equal(evidenceFreshEnough('2026-09-06T12:00:00.000Z',{now,maxAgeMinutes:45}),true);
assert.equal(evidenceFreshEnough('2026-09-06T11:00:00.000Z',{now,maxAgeMinutes:45}),false);
assert.equal(evidenceFreshEnough('not-a-time',{now,maxAgeMinutes:45}),false);

const fp1=evidenceInputFingerprint({rewards:{generatedAt:'x',companies:{}},root:process.cwd(),extra:{mode:'test'}});
const fp2=evidenceInputFingerprint({rewards:{generatedAt:'x',companies:{}},root:process.cwd(),extra:{mode:'test'}});
const fp3=evidenceInputFingerprint({rewards:{generatedAt:'y',companies:{}},root:process.cwd(),extra:{mode:'test'}});
assert.equal(fp1,fp2);
assert.notEqual(fp1,fp3);
assert.equal(canReuseEvidence({previous:{generatedAt:'2026-09-06T12:00:00.000Z',runner:{safeWriterInputFingerprint:fp1}},fingerprint:fp1,root:process.cwd(),env:{GITHUB_ACTIONS:'false'}}),false);

console.log('ve33 capability-aware historical RPC runner validation OK');
