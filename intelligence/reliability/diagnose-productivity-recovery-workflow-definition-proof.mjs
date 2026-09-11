#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';

const WORKFLOW='.github/workflows/diagnose-productivity-recovery.yml';
const text=fs.readFileSync(WORKFLOW,'utf8');
const prBlock=text.slice(text.indexOf('  pull_request:'),text.indexOf('\n\npermissions:'));

assert.match(text,/^# holding-workflow-definition-proof: intelligence\/reliability\/diagnose-productivity-recovery-workflow-definition-proof\.mjs$/m,'paired proof marker missing');
assert.match(text,/permissions:\s*\n\s*contents:\s*read/,'Productivity diagnostic must remain read-only');
assert.doesNotMatch(text,/contents:\s*write|actions:\s*write|pull-requests:\s*write/,'Productivity diagnostic authority widened');

// The diagnostic independently runs the Productivity collector and overlays. It
// does not read or execute the generic Capital orchestrator, so that file must
// not wake this specialized PR check.
assert.doesNotMatch(prBlock,/intelligence\/capital-state\/unified-capital-refresh\.mjs/,'generic Capital orchestrator still wakes Productivity recovery diagnostic');

// Keep only the domains actually exercised by this diagnostic.
for(const token of [
  "'productivity/**'",
  "'intelligence/market-data/**'",
  "'companies/index.html'",
  "'companies/yieldring-canonical-state.json'",
  "'.github/workflows/update-productivity.yml'",
  "'.github/workflows/market-data-refresh.yml'",
  "'.github/workflows/unified-capital-refresh.yml'"
]) assert.ok(prBlock.includes(token),`required diagnostic trigger missing: ${token}`);

for(const token of [
  'market-data-validation-fixture.mjs',
  'coingecko-fetch-shim.mjs',
  'npm run update',
  'company-010-productivity-overlay.mjs',
  'yieldring-productivity-overlay.mjs',
  "d.version!=='1.16'",
  'externalRequestCount!==0',
  "executionAuthority!=='none'"
]) assert.ok(text.includes(token),`Productivity recovery proof surface missing: ${token}`);

assert.doesNotMatch(text,/sendTransaction|eth_sendRawTransaction|eth_sendTransaction|\.transfer\(|\.approve\(|\.claim\(|\.vote\(/,'Productivity diagnostic gained wallet/capital execution behavior');

console.log('Productivity recovery workflow definition proof PASS',{
  genericCapitalOrchestratorWake:false,
  exactProductivityCollector:true,
  deterministicMarketDataFixture:true,
  compatibilityOverlays:true,
  repositoryMutationAuthority:false,
  executionAuthority:'none'
});