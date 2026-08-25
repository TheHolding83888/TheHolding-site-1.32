#!/usr/bin/env node
import { evaluateNoNewDebt, validateBaseline } from './workflow-control-plane-enforce.mjs';

const baseline = {
  version: 'canary-baseline',
  observedHead: 'canary',
  summary: {
    repositoryWriterCount: 1,
    workflowControlCount: 1,
    otherWritePermissionWorkflowCount: 1
  },
  knownRepositoryWriters: ['writer-a'],
  knownWorkflowControllers: ['controller-a'],
  knownOtherWritePermissionWorkflows: ['external-a'],
  allowedPullRequestTargetWorkflows: ['trusted-prt'],
  knownDuplicateCandidateWriters: {
    'generated/shared.json': ['writer-a', 'writer-b']
  },
  currentDebt: {
    pullRequestTargetCount: 1,
    duplicateCandidateWriterPathCount: 1,
    writeAllCount: 0,
    broadGitAddCount: 0,
    unresolvedEdgeCount: 0,
    cycleCount: 0
  }
};

function workflow(id, overrides = {}) {
  return {
    id,
    hasConcurrency: true,
    repositoryWriterCapable: false,
    workflowControlCapable: false,
    otherWritePermission: false,
    privilegedWorkflow: false,
    writeAll: false,
    broadGitAdd: false,
    pullRequestTarget: false,
    candidateWriterPaths: [],
    controlMetadata: { roles: [], truthPlane: null, controlDomain: null },
    ...overrides
  };
}

function report(overrides = {}) {
  return {
    workflows: [
      workflow('writer-a', { repositoryWriterCapable: true, privilegedWorkflow: true, candidateWriterPaths: ['generated/shared.json'] }),
      workflow('writer-b', { repositoryWriterCapable: true, privilegedWorkflow: true, candidateWriterPaths: ['generated/shared.json'] }),
      workflow('controller-a', { workflowControlCapable: true, privilegedWorkflow: true }),
      workflow('external-a', { otherWritePermission: true, privilegedWorkflow: true }),
      workflow('trusted-prt', { pullRequestTarget: true })
    ],
    graph: { unresolved: [], cycles: [] },
    duplicateCandidateWriters: [
      { candidatePath: 'generated/shared.json', workflows: ['writer-a', 'writer-b'] }
    ],
    ...overrides
  };
}

function ids(r) {
  return new Set(evaluateNoNewDebt(r, baseline).map(v => v.id));
}

if (validateBaseline(baseline).length) throw new Error('valid baseline canary rejected');
if (evaluateNoNewDebt(report(), baseline).length) throw new Error('frozen baseline should pass');

const reduced = report({ duplicateCandidateWriters: [] });
if (evaluateNoNewDebt(reduced, baseline).length) throw new Error('debt reduction should pass without baseline rewrite');

const noConcurrency = report();
noConcurrency.workflows[0] = { ...noConcurrency.workflows[0], hasConcurrency: false };
if (!ids(noConcurrency).has('repository-writer-without-concurrency')) throw new Error('writer concurrency canary failed');

const newWriterBad = report();
newWriterBad.workflows.push(workflow('writer-new', { repositoryWriterCapable: true, privilegedWorkflow: true }));
const newWriterBadIds = ids(newWriterBad);
for (const required of ['new-repository-writer-missing-role', 'new-repository-writer-missing-truth-plane', 'new-repository-writer-missing-domain']) {
  if (!newWriterBadIds.has(required)) throw new Error(`new writer declaration canary failed: ${required}`);
}

const newWriterGood = report();
newWriterGood.workflows.push(workflow('writer-new', {
  repositoryWriterCapable: true,
  privilegedWorkflow: true,
  candidateWriterPaths: ['generated/new.json'],
  controlMetadata: { roles: ['repository-writer'], truthPlane: 'generated/new.json', controlDomain: 'canary-new-domain' }
}));
if (evaluateNoNewDebt(newWriterGood, baseline).length) throw new Error('declared new writer should pass');

const newControllerBad = report();
newControllerBad.workflows.push(workflow('controller-new', { workflowControlCapable: true, privilegedWorkflow: true }));
const controllerBadIds = ids(newControllerBad);
if (!controllerBadIds.has('new-workflow-controller-missing-role') || !controllerBadIds.has('new-workflow-controller-missing-domain')) throw new Error('new controller declaration canary failed');

const newControllerGood = report();
newControllerGood.workflows.push(workflow('controller-new', {
  workflowControlCapable: true,
  privilegedWorkflow: true,
  controlMetadata: { roles: ['workflow-controller'], truthPlane: null, controlDomain: 'canary-orchestration' }
}));
if (evaluateNoNewDebt(newControllerGood, baseline).length) throw new Error('declared new controller should pass');

const newExternalBad = report();
newExternalBad.workflows.push(workflow('external-new', { otherWritePermission: true, privilegedWorkflow: true }));
if (!ids(newExternalBad).has('new-other-write-permission-missing-role')) throw new Error('external write declaration canary failed');

const newExternalGood = report();
newExternalGood.workflows.push(workflow('external-new', {
  otherWritePermission: true,
  privilegedWorkflow: true,
  controlMetadata: { roles: ['external-writer'], truthPlane: null, controlDomain: 'issues-metadata' }
}));
if (evaluateNoNewDebt(newExternalGood, baseline).length) throw new Error('declared external writer should pass');

const duplicateNew = report({
  duplicateCandidateWriters: [
    { candidatePath: 'generated/shared.json', workflows: ['writer-a', 'writer-b'] },
    { candidatePath: 'generated/another.json', workflows: ['writer-a', 'writer-b'] }
  ]
});
if (!ids(duplicateNew).has('new-duplicate-candidate-writer-forbidden')) throw new Error('new duplicate path canary failed');

const duplicateWidened = report({
  duplicateCandidateWriters: [{ candidatePath: 'generated/shared.json', workflows: ['writer-a', 'writer-b', 'writer-c'] }]
});
if (!ids(duplicateWidened).has('duplicate-candidate-writer-widened')) throw new Error('duplicate widening canary failed');

const unresolved = report({ graph: { unresolved: [{ from: 'a', to: 'missing', type: 'workflow_run' }], cycles: [] } });
if (!ids(unresolved).has('unresolved-workflow-edge-forbidden')) throw new Error('unresolved edge canary failed');

const cycle = report({ graph: { unresolved: [], cycles: ['a -> b -> a'] } });
if (!ids(cycle).has('workflow-cycle-forbidden')) throw new Error('cycle canary failed');

const newPrt = report();
newPrt.workflows.push(workflow('new-prt', { pullRequestTarget: true }));
if (!ids(newPrt).has('new-pull-request-target-forbidden')) throw new Error('new pull_request_target canary failed');

const privilegedPrt = report();
privilegedPrt.workflows[4] = { ...privilegedPrt.workflows[4], repositoryWriterCapable: true, privilegedWorkflow: true };
if (!ids(privilegedPrt).has('privileged-pull-request-target-forbidden')) throw new Error('privileged pull_request_target canary failed');

const writeAll = report();
writeAll.workflows.push(workflow('write-all', { writeAll: true, privilegedWorkflow: true }));
if (!ids(writeAll).has('write-all-forbidden')) throw new Error('write-all canary failed');

const broad = report();
broad.workflows.push(workflow('broad-add', { broadGitAdd: true }));
if (!ids(broad).has('broad-git-add-forbidden')) throw new Error('broad git add canary failed');

const brokenBaseline = structuredClone(baseline);
brokenBaseline.summary.repositoryWriterCount = 99;
if (!validateBaseline(brokenBaseline).length) throw new Error('baseline integrity canary failed');

console.log('Workflow Control Plane No-New-Debt Canary PASS (baseline / reduction / concurrency / declarations / duplicate widening / unresolved / cycles / pull_request_target / write-all / broad-add)');
