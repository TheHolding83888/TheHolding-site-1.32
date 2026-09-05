#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';

const WORKFLOW_PATH = '.github/workflows/operator-command-bridge.yml';
const workflow = fs.readFileSync(WORKFLOW_PATH, 'utf8');

assert.match(workflow, /^# holding-workflow-definition-proof: intelligence\/reliability\/operator-command-bridge-workflow-definition-proof\.mjs$/m, 'paired workflow proof marker missing');
assert.match(workflow, /on:\s*\n\s*push:\s*\n\s*branches:\s*\[main\]\s*\n\s*paths:\s*\n\s*- 'intelligence\/operator\/command\.json'/, 'operator bridge must remain command-file push driven');
assert.doesNotMatch(workflow, /\bworkflow_dispatch\s*:|\bpull_request\s*:|\bschedule\s*:|\brepository_dispatch\s*:/, 'operator bridge trigger authority widened');
assert.match(workflow, /permissions:\s*\n\s*contents:\s*read\s*\n\s*actions:\s*write/, 'operator bridge bounded permissions drift');
assert.doesNotMatch(workflow, /contents:\s*write|permissions:\s*write-all|pull-requests:\s*write/, 'operator bridge gained repository mutation authority');
assert.match(workflow, /'0\.7-operator-command'/, 'operator command v0.7 is not admitted');

for (const [operation, target] of [
  ['discover_company_007', 'discover-company-007.yml'],
  ['resolve_company_007', 'resolve-company-007.yml'],
  ['refresh_productivity', 'update-productivity.yml'],
]) {
  assert.ok(workflow.includes(`cmd.operation === '${operation}'`), `${operation} is not explicitly allowlisted`);
  assert.ok(workflow.includes(`targetWorkflow = '${target}'`), `${operation} target drift`);
}

assert.match(workflow, /refresh-cognitive-stack\.yml\|update-proposal-work-queue\.yml\|update-builder-candidates\.yml\|record-brain-decision\.yml\|discover-company-007\.yml\|resolve-company-007\.yml\|update-productivity\.yml/, 'shell-level exact workflow allowlist drift');
assert.match(workflow, /cmd\.requestedBy !== 'owner' \|\| cmd\.approval !== 'explicit'/, 'explicit owner approval gate missing');
assert.match(workflow, /cmd\.arbitraryWorkflowAllowed !== false/, 'arbitrary workflow prohibition missing');
assert.match(workflow, /cmd\.walletActionAllowed !== false/, 'wallet action prohibition missing');
assert.match(workflow, /cmd\.capitalExecutionAllowed !== false/, 'capital execution prohibition missing');

const securityInvocation = workflow.indexOf('\n          wait_command_security\n');
const boundedDataLane = workflow.indexOf('if [[ "$OPERATION" =~ ^(discover_company_007|resolve_company_007|refresh_productivity)$ ]]', securityInvocation);
assert.ok(securityInvocation >= 0, 'command-bound Security Sentinel invocation missing');
assert.ok(boundedDataLane > securityInvocation, 'data-only lane must remain behind Security Sentinel');
assert.match(workflow, /dispatch_and_wait "\$TARGET_WORKFLOW" \/tmp\/operator-target-dispatch\.json "\$TARGET_LABEL" "\$TARGET_HEAD"/, 'bounded data target dispatch missing');
assert.match(workflow, /printf '\{"ref":"main"\}' > \/tmp\/operator-target-dispatch\.json|dispatch = \{ ref: 'main' \}/, 'main-only dispatch contract missing');
assert.doesNotMatch(workflow, /git push|git commit|\/contents\/[^\s"']+.*-X\s+(?:PUT|PATCH|POST)/, 'bridge gained repository mutation behavior');
assert.doesNotMatch(workflow, /sendTransaction|eth_sendRawTransaction|eth_sendTransaction|\.transfer\(|\.approve\(/, 'bridge contains wallet/capital transaction behavior');

console.log('Operator Command Bridge v0.7 bounded data-lane workflow definition proof PASS');
