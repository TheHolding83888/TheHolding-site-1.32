#!/usr/bin/env node
import { enforceFanout, evaluateFanout, validateBaseline } from './workflow-fanout-enforce.mjs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const baseline = {
  version: '0.1-workflow-fanout-baseline',
  status: 'FROZEN_NO_NEW_FANOUT_DEBT',
  observedHead: 'canary',
  protectedWorkflowFleetWakeIds: ['global'],
  ceilings: {
    workflowFleetWakeCount: 10,
    reductionCandidateWorkflowFleetWakeCount: 9,
    selfDefinitionWakeCount: 10,
    unboundedPullRequestCount: 2
  }
};

const report = {
  summary: {
    workflowFleetWakeCount: 9,
    reductionCandidateWorkflowFleetWakeCount: 8,
    selfDefinitionWakeCount: 9,
    unboundedPullRequestCount: 1
  },
  workflows: [
    { id: 'global', workflowFleetWake: true },
    { id: 'domain', workflowFleetWake: true }
  ]
};

assert(validateBaseline(baseline).length === 0, 'valid baseline rejected');
assert(enforceFanout(report, baseline).status === 'PASS', 'debt reduction must pass');

const expanded = structuredClone(report);
expanded.summary.workflowFleetWakeCount = 11;
assert(evaluateFanout(expanded, baseline).some(v => v.id === 'fanout-ceiling-expanded'), 'fan-out expansion was not rejected');

const unbounded = structuredClone(report);
unbounded.summary.unboundedPullRequestCount = 3;
assert(evaluateFanout(unbounded, baseline).some(v => v.id === 'fanout-ceiling-expanded'), 'unbounded PR expansion was not rejected');

const lostProtected = structuredClone(report);
lostProtected.workflows[0].workflowFleetWake = false;
assert(evaluateFanout(lostProtected, baseline).some(v => v.id === 'protected-workflow-no-longer-wakes'), 'protected global check loss was not rejected');

console.log('WORKFLOW FAN-OUT ENFORCEMENT CANARY PASS');
