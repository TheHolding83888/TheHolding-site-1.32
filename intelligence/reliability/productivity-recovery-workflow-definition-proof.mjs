#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';

const WORKFLOW_PATH = '.github/workflows/update-productivity.yml';
const workflow = fs.readFileSync(WORKFLOW_PATH, 'utf8');
const unified = fs.readFileSync('.github/workflows/unified-capital-refresh.yml', 'utf8');

assert.match(workflow, /^# holding-workflow-definition-proof: intelligence\/reliability\/productivity-recovery-workflow-definition-proof\.mjs$/m, 'paired workflow proof marker missing');
assert.match(workflow, /^on:\s*\n\s*workflow_dispatch:\s*$/m, 'Productivity diagnostic must remain workflow_dispatch-only');
assert.doesNotMatch(workflow, /\bpull_request\s*:|\bschedule\s*:|\bworkflow_run\s*:|\brepository_dispatch\s*:|\bpush\s*:/, 'Productivity diagnostic trigger authority widened');

// ONE ARTIFACT -> ONE CANONICAL WRITER: this legacy entrypoint is now a
// read-only diagnostic replay. Production publication remains exclusively in
// The Holding Capital · Unified Refresh, which itself has manual dispatch.
assert.match(workflow, /permissions:\s*\n\s*contents:\s*read/, 'Productivity diagnostic must be repository read-only');
assert.doesNotMatch(workflow, /contents:\s*write|permissions:\s*write-all|actions:\s*write|pull-requests:\s*write/, 'Productivity diagnostic regained repository/workflow write authority');
assert.doesNotMatch(workflow, /git\s+(?:add|commit|push)\b/, 'Productivity diagnostic regained repository publication behavior');
assert.doesNotMatch(workflow, /git push origin HEAD:main/, 'Productivity diagnostic regained canonical-main writer authority');
assert.match(workflow, /Verify diagnostic replay without repository publication/, 'read-only diagnostic terminal verification missing');
assert.match(workflow, /repositoryMutation:false/, 'explicit no-repository-mutation diagnostic missing');

assert.match(unified, /^name: "The Holding Capital · Unified Refresh"$/m, 'canonical Unified Capital writer missing');
assert.match(unified, /^\s*workflow_dispatch:\s*$/m, 'canonical Unified Capital writer lost manual dispatch');
assert.match(unified, /permissions:\s*\n\s*contents:\s*write/, 'canonical Unified Capital publication authority missing');
const publishBlock = unified.slice(unified.indexOf('- name: Publish one coherent capital snapshot safely'));
assert.ok(publishBlock.length > 0, 'canonical Unified Capital publish block missing');
for (const surface of [
  'companies/productivity-data.json',
  'companies/productivity-source-report.json',
  'companies/votemarket-reference-state.json',
  'intelligence/market-data/public-capital-state.json'
]) {
  assert.ok(publishBlock.includes(surface), `canonical Unified Capital writer does not own expected Productivity surface: ${surface}`);
}

assert.match(workflow, /concurrency:\s*\n\s*group:\s*productivity-weekly\s*\n\s*cancel-in-progress:\s*false/, 'Productivity concurrency contract drift');
assert.match(workflow, /onchainSelectedAssetCount\)!==26/, '26\/26 canonical Market Data guard missing');
assert.match(workflow, /node --check productivity\/votemarket-productivity-overlay\.mjs/, 'VoteMarket overlay syntax preflight missing');
assert.match(workflow, /node --check productivity\/votemarket-productivity-overlay-validation\.mjs/, 'VoteMarket deterministic validator syntax preflight missing');
assert.match(workflow, /node productivity\/votemarket-productivity-overlay-validation\.mjs/, 'VoteMarket deterministic validator execution missing');
assert.match(workflow, /capitalDoubleCount!==false\|\|diag\?\.idempotent!==true/, 'VoteMarket capital/idempotency runtime guard missing');
assert.match(workflow, /diag\?\.earnedIncomeAuthority!==false\|\|diag\?\.factualIncomeAuthority!==false\|\|diag\?\.executionAuthority!=='none'/, 'VoteMarket authority-separation runtime guard missing');
assert.match(workflow, /claimedPeriodPersistencePending!==false/, 'VoteMarket claimed-period persistence closure guard missing');
assert.match(workflow, /observationPersistence!=='claimed-aware-derived-cache'/, 'VoteMarket claimed-aware persistence mode guard missing');
assert.match(workflow, /companies\/votemarket-reference-state\.json/, 'VoteMarket persistence cache diagnostic missing');
assert.match(workflow, /state\?\.semantics\?\.sourceOfTruth!==false/, 'VoteMarket persistence cache source-of-truth guard missing');

const company010 = workflow.indexOf('node productivity/company-010-productivity-overlay.mjs');
const yieldring = workflow.indexOf('node productivity/yieldring-productivity-overlay.mjs');
const votemarket = workflow.indexOf('node productivity/votemarket-productivity-overlay.mjs');
assert.ok(company010 >= 0 && yieldring > company010 && votemarket > yieldring, 'Productivity overlay order must remain Company #010 -> YieldRing -> VoteMarket');

assert.match(workflow, /npm run update/, 'Productivity diagnostic replay missing');
assert.match(workflow, /node intelligence\/market-data\/public-capital-engine\.mjs/, 'public capital diagnostic recompute missing');
assert.doesNotMatch(workflow, /sendTransaction|eth_sendRawTransaction|eth_sendTransaction|\.transfer\(|\.approve\(|\.claim\(|\.vote\(/, 'Productivity workflow contains wallet/capital transaction behavior');

console.log('Productivity read-only diagnostic workflow definition proof PASS', {
  canonicalWriter: 'The Holding Capital · Unified Refresh',
  legacyRepositoryMutation: false,
  manualCanonicalRecoveryAvailable: true,
  overlayOrder: 'Company #010 -> YieldRing -> VoteMarket',
  voteMarketIdempotencyGuard: true,
  voteMarketClaimedAwarePersistence: true,
  persistenceStateSourceOfTruth: false,
  voteMarketCapitalCountedOnce: true,
  factualIncomeAuthority: false,
  executionAuthority: 'none'
});