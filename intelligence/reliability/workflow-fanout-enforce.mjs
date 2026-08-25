#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { auditFanout, readEntries } from './workflow-fanout-audit.mjs';

const ROOT = process.cwd();
const POLICY_FILE = 'intelligence/reliability/workflow-fanout-policy.json';
const BASELINE_FILE = 'intelligence/reliability/workflow-fanout-baseline.json';

function violation(id, detail) {
  return { id, detail };
}

export function validateBaseline(baseline) {
  const failures = [];
  if (baseline?.version !== '0.1-workflow-fanout-baseline') failures.push('unexpected baseline version');
  if (baseline?.status !== 'FROZEN_NO_NEW_FANOUT_DEBT') failures.push('baseline is not frozen');
  if (!baseline?.observedHead) failures.push('baseline observedHead missing');
  if (!Array.isArray(baseline?.protectedWorkflowFleetWakeIds) || baseline.protectedWorkflowFleetWakeIds.length < 1) failures.push('protectedWorkflowFleetWakeIds missing');
  const ceilings = baseline?.ceilings || {};
  for (const key of ['workflowFleetWakeCount','reductionCandidateWorkflowFleetWakeCount','selfDefinitionWakeCount','unboundedPullRequestCount']) {
    if (!Number.isInteger(ceilings[key]) || ceilings[key] < 0) failures.push(`invalid ceiling: ${key}`);
  }
  return failures;
}

export function evaluateFanout(report, baseline) {
  const violations = [];
  const ceilings = baseline.ceilings || {};
  const summary = report.summary || {};
  for (const key of ['workflowFleetWakeCount','reductionCandidateWorkflowFleetWakeCount','selfDefinitionWakeCount','unboundedPullRequestCount']) {
    if (Number(summary[key]) > Number(ceilings[key])) {
      violations.push(violation('fanout-ceiling-expanded', `${key}: current=${summary[key]} ceiling=${ceilings[key]}`));
    }
  }

  const byId = new Map((report.workflows || []).map(w => [w.id, w]));
  for (const id of baseline.protectedWorkflowFleetWakeIds || []) {
    const workflow = byId.get(id);
    if (!workflow) violations.push(violation('protected-workflow-missing', id));
    else if (workflow.workflowFleetWake !== true) violations.push(violation('protected-workflow-no-longer-wakes', id));
  }
  return violations.sort((a, b) => `${a.id}|${a.detail}`.localeCompare(`${b.id}|${b.detail}`));
}

export function enforceFanout(report, baseline) {
  const baselineFailures = validateBaseline(baseline);
  if (baselineFailures.length) {
    const error = new Error(`Workflow Fan-out baseline integrity failed: ${baselineFailures.join('; ')}`);
    error.code = 'FANOUT_BASELINE_INTEGRITY';
    error.details = baselineFailures;
    throw error;
  }
  const violations = evaluateFanout(report, baseline);
  if (violations.length) {
    const error = new Error(`Workflow Fan-out no-new-debt failed with ${violations.length} violation(s)`);
    error.code = 'FANOUT_NO_NEW_DEBT';
    error.details = violations;
    throw error;
  }
  return { status: 'PASS', violationCount: 0 };
}

function main() {
  const policy = JSON.parse(fs.readFileSync(path.resolve(ROOT, POLICY_FILE), 'utf8'));
  const baseline = JSON.parse(fs.readFileSync(path.resolve(ROOT, BASELINE_FILE), 'utf8'));
  const report = auditFanout(readEntries(), policy);
  const baselineFailures = validateBaseline(baseline);
  const violations = baselineFailures.length ? [] : evaluateFanout(report, baseline);
  const result = {
    version: '0.1-workflow-fanout-no-new-debt',
    mode: policy.mode,
    authority: policy.authority,
    baseline: {
      version: baseline.version,
      observedHead: baseline.observedHead,
      observedBy: baseline.observedBy,
      ceilings: baseline.ceilings,
      protectedWorkflowFleetWakeIds: baseline.protectedWorkflowFleetWakeIds
    },
    summary: report.summary,
    baselineIntegrity: baselineFailures.length ? 'FAIL' : 'PASS',
    baselineFailures,
    noNewFanoutDebt: violations.length ? 'FAIL' : 'PASS',
    violationCount: violations.length,
    violations
  };
  if (process.argv.includes('--json')) console.log(JSON.stringify(result, null, 2));
  else console.log(`Workflow Fan-out no-new-debt ${result.noNewFanoutDebt}; violations=${result.violationCount}`);
  if (baselineFailures.length || violations.length) process.exit(1);
}

const invoked = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) main();
