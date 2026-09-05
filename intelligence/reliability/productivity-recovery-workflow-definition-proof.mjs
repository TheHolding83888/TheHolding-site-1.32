#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';

const WORKFLOW_PATH = '.github/workflows/update-productivity.yml';
const workflow = fs.readFileSync(WORKFLOW_PATH, 'utf8');

assert.match(workflow, /^# holding-workflow-definition-proof: intelligence\/reliability\/productivity-recovery-workflow-definition-proof\.mjs$/m, 'paired workflow proof marker missing');
assert.match(workflow, /^on:\s*\n\s*workflow_dispatch:\s*$/m, 'Productivity recovery must remain workflow_dispatch-only');
assert.doesNotMatch(workflow, /\bpull_request\s*:|\bschedule\s*:|\bworkflow_run\s*:|\brepository_dispatch\s*:|\bpush\s*:/, 'Productivity recovery trigger authority widened');
assert.match(workflow, /permissions:\s*\n\s*contents:\s*write/, 'Productivity writer permission missing');
assert.doesNotMatch(workflow, /permissions:\s*write-all|actions:\s*write|pull-requests:\s*write/, 'Productivity recovery permissions widened');
assert.match(workflow, /concurrency:\s*\n\s*group:\s*productivity-weekly\s*\n\s*cancel-in-progress:\s*false/, 'Productivity concurrency contract drift');
assert.match(workflow, /onchainSelectedAssetCount\)!==26/, '26\/26 canonical Market Data guard missing');
assert.match(workflow, /for attempt in 1 2 3/, 'bounded safe-writer retry contract missing');
assert.match(workflow, /git fetch origin main/, 'fresh-main reconciliation missing');
assert.match(workflow, /git rebase origin\/main/, 'safe-writer rebase missing');
assert.match(workflow, /git push origin HEAD:main/, 'canonical main writer target drift');

const retryStart = workflow.indexOf('for attempt in 1 2 3');
assert.ok(retryStart >= 0, 'retry loop missing');
const retry = workflow.slice(retryStart);
assert.doesNotMatch(retry, /node - <<'NODE'/, 'retry loop reintroduced indentation-sensitive heredoc');
assert.match(retry, /node -e '/, 'retry loop must use indentation-safe inline canonical Market Data check');
assert.match(retry, /npm --prefix productivity run update/, 'fresh-main Productivity recompute missing');
assert.match(retry, /node productivity\/company-010-productivity-overlay\.mjs/, 'Company #010 overlay recompute missing');
assert.match(retry, /node productivity\/yieldring-productivity-overlay\.mjs/, 'YieldRing overlay recompute missing');
assert.match(retry, /node intelligence\/market-data\/public-capital-engine\.mjs/, 'public capital recompute missing');
assert.doesNotMatch(workflow, /sendTransaction|eth_sendRawTransaction|eth_sendTransaction|\.transfer\(|\.approve\(/, 'Productivity workflow contains wallet/capital transaction behavior');

console.log('Productivity recovery safe-writer workflow definition proof PASS');
