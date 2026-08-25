#!/usr/bin/env node
import { evaluateWorkflowDefinitionChange, isCentralActionPinOnly, isSelfTriggerReductionOnly } from './workflow-definition-diff-guard.mjs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const policy = {
  centrallyProvenActionFamilies: ['actions/checkout', 'actions/setup-node', 'actions/upload-artifact']
};
const file = '.github/workflows/domain.yml';
const baseSelf = `name: Domain\non:\n  pull_request:\n    paths:\n      - 'src/**'\n      - '.github/workflows/domain.yml'\njobs:\n  verify:\n    steps:\n      - uses: actions/checkout@old # v1\n`;
const headSelf = `name: Domain\non:\n  pull_request:\n    paths:\n      - 'src/**'\n      - '.github/workflows/domain.yml'\njobs:\n  verify:\n    steps:\n      - uses: actions/checkout@new # v2\n`;
const headReduced = `name: Domain\non:\n  pull_request:\n    paths:\n      - 'src/**'\njobs:\n  verify:\n    steps:\n      - uses: actions/checkout@old # v1\n`;

let r = evaluateWorkflowDefinitionChange({
  file,
  baseText: baseSelf,
  headText: headSelf,
  diff: `@@ -9 +9 @@\n-      - uses: actions/checkout@old # v1\n+      - uses: actions/checkout@new # v2`,
  changedFiles: [file],
  policy
});
assert(r.status === 'PASS' && r.proof === 'workflow-self-verifier-wakes', 'self-waking workflow change must use its own verifier');

const pinDiff = `@@ -8 +8 @@\n-      - uses: actions/setup-node@old # v1\n+      - uses: actions/setup-node@new # v2`;
assert(isCentralActionPinOnly(pinDiff, policy.centrallyProvenActionFamilies), 'allowlisted action pin update not recognized');
assert(!isCentralActionPinOnly(`@@ -8 +8 @@\n-      - uses: actions/checkout@old\n+      - uses: actions/setup-node@new`, policy.centrallyProvenActionFamilies), 'action-family swap must not count as pin-only');

const selfReductionDiff = `@@ -6 +5,0 @@\n-      - '.github/workflows/domain.yml'`;
assert(isSelfTriggerReductionOnly({ file, diff: selfReductionDiff, baseText: baseSelf, headText: headReduced }), 'bounded self-trigger reduction not recognized');
r = evaluateWorkflowDefinitionChange({
  file,
  baseText: baseSelf,
  headText: headReduced,
  diff: selfReductionDiff,
  changedFiles: [file],
  policy
});
assert(r.status === 'PASS' && r.proof === 'bounded-self-trigger-reduction', 'safe self-trigger reduction must pass');

const reducedOldPin = headReduced;
const reducedNewPin = headReduced.replace('actions/checkout@old # v1', 'actions/checkout@new # v2');
r = evaluateWorkflowDefinitionChange({
  file,
  baseText: reducedOldPin,
  headText: reducedNewPin,
  diff: `@@ -8 +8 @@\n-      - uses: actions/checkout@old # v1\n+      - uses: actions/checkout@new # v2`,
  changedFiles: [file],
  policy
});
assert(r.status === 'PASS' && r.proof === 'central-common-action-pin-canary', 'central action pin proof must cover reduced workflow');

const logicHead = headReduced.replace('name: Domain', 'name: Domain Changed');
r = evaluateWorkflowDefinitionChange({
  file,
  baseText: headReduced,
  headText: logicHead,
  diff: `@@ -1 +1 @@\n-name: Domain\n+name: Domain Changed`,
  changedFiles: [file],
  policy
});
assert(r.status === 'FAIL' && r.proof === 'workflow-logic-change-without-verifier-proof', 'logic-only change without self trigger must fail closed');

r = evaluateWorkflowDefinitionChange({
  file,
  baseText: headReduced,
  headText: logicHead,
  diff: `@@ -1 +1 @@\n-name: Domain\n+name: Domain Changed`,
  changedFiles: [file, 'src/proof.mjs'],
  policy
});
assert(r.status === 'PASS' && r.proof === 'paired-domain-change-wakes-verifier', 'paired domain change should wake reduced verifier');

const noDomainHead = `name: No Domain\non:\n  pull_request:\n    paths:\n      - '.github/workflows/no-domain.yml'\njobs: {}`;
assert(!isSelfTriggerReductionOnly({
  file: '.github/workflows/no-domain.yml',
  diff: `@@ -5 +4,0 @@\n-      - '.github/workflows/no-domain.yml'`,
  baseText: noDomainHead,
  headText: `name: No Domain\non:\n  pull_request:\n    paths:\n` 
}), 'self-trigger removal without remaining domain path must not pass');

console.log('WORKFLOW DEFINITION DIFF GUARD CANARY PASS');
