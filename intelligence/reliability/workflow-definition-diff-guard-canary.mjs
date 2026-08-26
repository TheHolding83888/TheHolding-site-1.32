#!/usr/bin/env node
import {
  evaluateWorkflowDefinitionChange,
  extractCentrallyProvenActionSpecs,
  isCentralActionPinOnly,
  isSelfTriggerReductionOnly
} from './workflow-definition-diff-guard.mjs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const policy = {
  centralProofWorkflow: '.github/workflows/workflow-control-plane.yml',
  centrallyProvenActionFamilies: ['actions/checkout', 'actions/setup-node', 'actions/upload-artifact']
};
const centralProof = `name: Control Plane\njobs:\n  audit:\n    steps:\n      - uses: actions/checkout@checkout-proven # v6\n      - uses: actions/setup-node@setup-proven # v6\n      - uses: actions/upload-artifact@upload-proven # v4\n`;
const provenSpecs = extractCentrallyProvenActionSpecs(centralProof, policy.centrallyProvenActionFamilies);
assert(provenSpecs.includes('actions/checkout@checkout-proven'), 'central checkout exact spec not discovered');
assert(provenSpecs.includes('actions/setup-node@setup-proven'), 'central setup-node exact spec not discovered');
assert(provenSpecs.includes('actions/upload-artifact@upload-proven'), 'central upload-artifact exact spec not discovered');

const file = '.github/workflows/domain.yml';
const baseSelf = `name: Domain\non:\n  pull_request:\n    paths:\n      - 'src/**'\n      - '.github/workflows/domain.yml'\njobs:\n  verify:\n    steps:\n      - uses: actions/checkout@old # v1\n`;
const headSelf = `name: Domain\non:\n  pull_request:\n    paths:\n      - 'src/**'\n      - '.github/workflows/domain.yml'\njobs:\n  verify:\n    steps:\n      - uses: actions/checkout@checkout-proven # v6\n`;
const headReduced = `name: Domain\non:\n  pull_request:\n    paths:\n      - 'src/**'\njobs:\n  verify:\n    steps:\n      - uses: actions/checkout@old # v1\n`;

let r = evaluateWorkflowDefinitionChange({
  file,
  baseText: baseSelf,
  headText: headSelf,
  diff: `@@ -9 +9 @@\n-      - uses: actions/checkout@old # v1\n+      - uses: actions/checkout@checkout-proven # v6`,
  changedFiles: [file],
  policy,
  centrallyProvenActionSpecs: provenSpecs
});
assert(r.status === 'PASS' && r.proof === 'workflow-self-verifier-wakes', 'self-waking workflow change must use its own verifier');

const pinDiff = `@@ -8 +8 @@\n-      - uses: actions/setup-node@old # v1\n+      - uses: actions/setup-node@setup-proven # v6`;
assert(isCentralActionPinOnly(pinDiff, policy.centrallyProvenActionFamilies, provenSpecs), 'exact centrally proven action pin update not recognized');
const unprovenPinDiff = `@@ -8 +8 @@\n-      - uses: actions/setup-node@old # v1\n+      - uses: actions/setup-node@same-family-unproven # v7`;
assert(!isCentralActionPinOnly(unprovenPinDiff, policy.centrallyProvenActionFamilies, provenSpecs), 'same-family unproven exact pin must fail closed');
assert(!isCentralActionPinOnly(`@@ -8 +8 @@\n-      - uses: actions/checkout@old\n+      - uses: actions/setup-node@setup-proven`, policy.centrallyProvenActionFamilies, provenSpecs), 'action-family swap must not count as pin-only');

const selfReductionDiff = `@@ -6 +5,0 @@\n-      - '.github/workflows/domain.yml'`;
assert(isSelfTriggerReductionOnly({ file, diff: selfReductionDiff, baseText: baseSelf, headText: headReduced }), 'bounded self-trigger reduction not recognized');
r = evaluateWorkflowDefinitionChange({
  file,
  baseText: baseSelf,
  headText: headReduced,
  diff: selfReductionDiff,
  changedFiles: [file],
  policy,
  centrallyProvenActionSpecs: provenSpecs
});
assert(r.status === 'PASS' && r.proof === 'bounded-self-trigger-reduction', 'safe self-trigger reduction must pass');

const reducedOldPin = headReduced;
const reducedProvenPin = headReduced.replace('actions/checkout@old # v1', 'actions/checkout@checkout-proven # v6');
r = evaluateWorkflowDefinitionChange({
  file,
  baseText: reducedOldPin,
  headText: reducedProvenPin,
  diff: `@@ -8 +8 @@\n-      - uses: actions/checkout@old # v1\n+      - uses: actions/checkout@checkout-proven # v6`,
  changedFiles: [file],
  policy,
  centrallyProvenActionSpecs: provenSpecs
});
assert(r.status === 'PASS' && r.proof === 'central-exact-action-pin-canary', 'central exact action pin proof must cover reduced workflow');

const reducedUnprovenPin = headReduced.replace('actions/checkout@old # v1', 'actions/checkout@same-family-unproven # v7');
r = evaluateWorkflowDefinitionChange({
  file,
  baseText: reducedOldPin,
  headText: reducedUnprovenPin,
  diff: `@@ -8 +8 @@\n-      - uses: actions/checkout@old # v1\n+      - uses: actions/checkout@same-family-unproven # v7`,
  changedFiles: [file],
  policy,
  centrallyProvenActionSpecs: provenSpecs
});
assert(r.status === 'FAIL' && r.proof === 'workflow-logic-change-without-verifier-proof', 'unproven exact pin on reduced workflow must fail closed');

const logicHead = headReduced.replace('name: Domain', 'name: Domain Changed');
r = evaluateWorkflowDefinitionChange({
  file,
  baseText: headReduced,
  headText: logicHead,
  diff: `@@ -1 +1 @@\n-name: Domain\n+name: Domain Changed`,
  changedFiles: [file],
  policy,
  centrallyProvenActionSpecs: provenSpecs
});
assert(r.status === 'FAIL' && r.proof === 'workflow-logic-change-without-verifier-proof', 'logic-only change without self trigger must fail closed');

r = evaluateWorkflowDefinitionChange({
  file,
  baseText: headReduced,
  headText: logicHead,
  diff: `@@ -1 +1 @@\n-name: Domain\n+name: Domain Changed`,
  changedFiles: [file, 'src/proof.mjs'],
  policy,
  centrallyProvenActionSpecs: provenSpecs
});
assert(r.status === 'PASS' && r.proof === 'paired-domain-change-wakes-verifier', 'paired domain change should wake reduced verifier');

const noDomainHead = `name: No Domain\non:\n  pull_request:\n    paths:\n      - '.github/workflows/no-domain.yml'\njobs: {}`;
assert(!isSelfTriggerReductionOnly({
  file: '.github/workflows/no-domain.yml',
  diff: `@@ -5 +4,0 @@\n-      - '.github/workflows/no-domain.yml'`,
  baseText: noDomainHead,
  headText: `name: No Domain\non:\n  pull_request:\n    paths:\n`
}), 'self-trigger removal without remaining domain path must not pass');

console.log('WORKFLOW DEFINITION DIFF GUARD CANARY PASS (exact central action proof / self-reduction / logic fail-closed)');
