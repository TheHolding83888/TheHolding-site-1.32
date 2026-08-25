#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildControlPlane, readEntries } from './workflow-control-plane.mjs';

const ROOT = process.cwd();
const POLICY_FILE = 'intelligence/reliability/workflow-control-plane-policy.json';
const BASELINE_FILE = 'intelligence/reliability/workflow-control-plane-baseline.json';

function sortedUnique(values = []) {
  return [...new Set(values)].sort();
}

function setEqual(a = [], b = []) {
  const aa = sortedUnique(a);
  const bb = sortedUnique(b);
  return aa.length === bb.length && aa.every((v, i) => v === bb[i]);
}

function violation(id, workflow, detail) {
  return { id, workflow, detail };
}

export function validateBaseline(baseline) {
  const failures = [];
  const requiredArrays = [
    'knownRepositoryWriters',
    'knownWorkflowControllers',
    'knownOtherWritePermissionWorkflows',
    'allowedPullRequestTargetWorkflows'
  ];
  for (const key of requiredArrays) {
    if (!Array.isArray(baseline?.[key])) failures.push(`baseline.${key} must be an array`);
  }
  if (!baseline?.knownDuplicateCandidateWriters || typeof baseline.knownDuplicateCandidateWriters !== 'object' || Array.isArray(baseline.knownDuplicateCandidateWriters)) {
    failures.push('baseline.knownDuplicateCandidateWriters must be an object');
  }
  if (!baseline?.currentDebt || typeof baseline.currentDebt !== 'object') failures.push('baseline.currentDebt missing');
  if (!baseline?.summary || typeof baseline.summary !== 'object') failures.push('baseline.summary missing');
  if (!baseline?.observedHead) failures.push('baseline.observedHead missing');

  if (failures.length) return failures;

  if (baseline.summary.repositoryWriterCount !== baseline.knownRepositoryWriters.length) {
    failures.push('baseline repository writer count does not match knownRepositoryWriters');
  }
  if (baseline.summary.workflowControlCount !== baseline.knownWorkflowControllers.length) {
    failures.push('baseline workflow control count does not match knownWorkflowControllers');
  }
  if (baseline.summary.otherWritePermissionWorkflowCount !== baseline.knownOtherWritePermissionWorkflows.length) {
    failures.push('baseline other-write count does not match knownOtherWritePermissionWorkflows');
  }
  if (baseline.currentDebt.pullRequestTargetCount !== baseline.allowedPullRequestTargetWorkflows.length) {
    failures.push('baseline pull_request_target count does not match allowedPullRequestTargetWorkflows');
  }
  if (baseline.currentDebt.duplicateCandidateWriterPathCount !== Object.keys(baseline.knownDuplicateCandidateWriters).length) {
    failures.push('baseline duplicate-writer count does not match knownDuplicateCandidateWriters');
  }
  for (const [candidatePath, owners] of Object.entries(baseline.knownDuplicateCandidateWriters)) {
    if (!Array.isArray(owners) || owners.length < 2) failures.push(`baseline duplicate writer entry invalid: ${candidatePath}`);
  }
  for (const key of ['writeAllCount', 'broadGitAddCount', 'unresolvedEdgeCount', 'cycleCount']) {
    if (Number(baseline.currentDebt[key]) !== 0) failures.push(`baseline ${key} must remain zero in v0.1`);
  }
  return failures;
}

export function evaluateNoNewDebt(report, baseline) {
  const violations = [];
  const knownWriters = new Set(baseline.knownRepositoryWriters || []);
  const knownControllers = new Set(baseline.knownWorkflowControllers || []);
  const knownOtherWrite = new Set(baseline.knownOtherWritePermissionWorkflows || []);
  const allowedPrTarget = new Set(baseline.allowedPullRequestTargetWorkflows || []);
  const knownDuplicates = baseline.knownDuplicateCandidateWriters || {};

  for (const w of report.workflows || []) {
    const roles = new Set(w.controlMetadata?.roles || []);
    const truthPlane = String(w.controlMetadata?.truthPlane || '').trim();
    const controlDomain = String(w.controlMetadata?.controlDomain || '').trim();

    if (w.repositoryWriterCapable) {
      if (!w.hasConcurrency) {
        violations.push(violation('repository-writer-without-concurrency', w.id, 'repository writers must serialize/coalesce through concurrency'));
      }
      if (!knownWriters.has(w.id)) {
        if (!roles.has('repository-writer')) violations.push(violation('new-repository-writer-missing-role', w.id, 'new repository writers must declare # holding-control-plane: repository-writer'));
        if (!truthPlane) violations.push(violation('new-repository-writer-missing-truth-plane', w.id, 'new repository writers must declare # holding-truth-plane'));
        if (!controlDomain) violations.push(violation('new-repository-writer-missing-domain', w.id, 'new repository writers must declare # holding-control-domain'));
      }
    }

    if (w.workflowControlCapable) {
      if (!w.hasConcurrency) {
        violations.push(violation('workflow-controller-without-concurrency', w.id, 'workflow control actors must serialize/coalesce through concurrency'));
      }
      if (!knownControllers.has(w.id)) {
        if (!roles.has('workflow-controller')) violations.push(violation('new-workflow-controller-missing-role', w.id, 'new workflow controllers must declare # holding-control-plane: workflow-controller'));
        if (!controlDomain) violations.push(violation('new-workflow-controller-missing-domain', w.id, 'new workflow controllers must declare # holding-control-domain'));
      }
    }

    if (w.otherWritePermission && !knownOtherWrite.has(w.id)) {
      if (!roles.has('external-writer')) violations.push(violation('new-other-write-permission-missing-role', w.id, 'new non-repository write permissions require # holding-control-plane: external-writer'));
      if (!controlDomain) violations.push(violation('new-other-write-permission-missing-domain', w.id, 'new non-repository write permissions require # holding-control-domain'));
      if (!w.hasConcurrency) violations.push(violation('new-other-write-permission-without-concurrency', w.id, 'new non-repository write actors require concurrency'));
    }

    if (w.writeAll) violations.push(violation('write-all-forbidden', w.id, 'write-all is not allowed by the frozen v0.1 baseline'));
    if (w.broadGitAdd) violations.push(violation('broad-git-add-forbidden', w.id, 'broad git add is not allowed; writers must materialize explicit paths'));

    if (w.pullRequestTarget) {
      if (!allowedPrTarget.has(w.id)) violations.push(violation('new-pull-request-target-forbidden', w.id, 'new pull_request_target surfaces are not allowed by the frozen baseline'));
      if (w.privilegedWorkflow) violations.push(violation('privileged-pull-request-target-forbidden', w.id, 'pull_request_target workflows must remain read-only/non-privileged'));
    }
  }

  for (const edge of report.graph?.unresolved || []) {
    violations.push(violation('unresolved-workflow-edge-forbidden', edge.from, `${edge.type}:${edge.to}`));
  }
  for (const cycle of report.graph?.cycles || []) {
    violations.push(violation('workflow-cycle-forbidden', 'graph', cycle));
  }

  for (const item of report.duplicateCandidateWriters || []) {
    const allowedOwners = knownDuplicates[item.candidatePath];
    if (!allowedOwners) {
      violations.push(violation('new-duplicate-candidate-writer-forbidden', item.workflows.join(','), item.candidatePath));
      continue;
    }
    const widened = item.workflows.filter(id => !allowedOwners.includes(id));
    if (widened.length) {
      violations.push(violation('duplicate-candidate-writer-widened', widened.join(','), `${item.candidatePath}; baseline owners=${allowedOwners.join(',')}`));
    }
  }

  return violations.sort((a, b) => `${a.id}|${a.workflow}|${a.detail}`.localeCompare(`${b.id}|${b.workflow}|${b.detail}`));
}

export function enforceNoNewDebt(report, baseline) {
  const baselineFailures = validateBaseline(baseline);
  if (baselineFailures.length) {
    const error = new Error(`Workflow Control Plane baseline integrity failed: ${baselineFailures.join('; ')}`);
    error.code = 'BASELINE_INTEGRITY';
    error.details = baselineFailures;
    throw error;
  }

  const violations = evaluateNoNewDebt(report, baseline);
  if (violations.length) {
    const error = new Error(`Workflow Control Plane no-new-debt gate failed with ${violations.length} violation(s)`);
    error.code = 'NO_NEW_DEBT';
    error.details = violations;
    throw error;
  }
  return { status: 'PASS', violationCount: 0 };
}

function main() {
  const json = process.argv.includes('--json');
  const policy = JSON.parse(fs.readFileSync(path.resolve(ROOT, POLICY_FILE), 'utf8'));
  const baseline = JSON.parse(fs.readFileSync(path.resolve(ROOT, BASELINE_FILE), 'utf8'));
  const report = buildControlPlane({ entries: readEntries(), policy });
  const baselineFailures = validateBaseline(baseline);
  const violations = baselineFailures.length ? [] : evaluateNoNewDebt(report, baseline);
  const result = {
    version: '0.1-workflow-control-plane-no-new-debt',
    mode: policy.mode,
    baseline: {
      version: baseline.version,
      observedHead: baseline.observedHead,
      observedBy: baseline.observedBy
    },
    authority: policy.authority,
    summary: report.summary,
    baselineIntegrity: baselineFailures.length ? 'FAIL' : 'PASS',
    baselineFailures,
    noNewDebt: violations.length ? 'FAIL' : 'PASS',
    violationCount: violations.length,
    violations
  };

  if (json) console.log(JSON.stringify(result, null, 2));
  else console.log(`Workflow Control Plane no-new-debt ${result.noNewDebt}; violations=${result.violationCount}`);

  if (baselineFailures.length || violations.length) process.exit(1);
}

const invoked = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) main();

export { setEqual };
