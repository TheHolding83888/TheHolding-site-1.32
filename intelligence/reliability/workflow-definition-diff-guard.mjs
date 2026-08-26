#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parsePullRequestTrigger, wakesForChangedFiles } from './workflow-fanout-audit.mjs';

const ROOT = process.cwd();
const DEFAULT_POLICY = 'intelligence/reliability/workflow-definition-diff-policy.json';

function git(args, options = {}) {
  return execFileSync('git', args, {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options
  }).trimEnd();
}

function readAt(sha, file) {
  try {
    return git(['show', `${sha}:${file}`]);
  } catch {
    return null;
  }
}

function diffAt(baseSha, headSha, file) {
  return git(['diff', '--unified=0', '--no-ext-diff', baseSha, headSha, '--', file]);
}

function changedFilesAt(baseSha, headSha) {
  const out = git(['diff', '--name-only', baseSha, headSha, '--']);
  return out ? out.split(/\r?\n/).filter(Boolean) : [];
}

function changedPayloadLines(diff) {
  return diff.split(/\r?\n/)
    .filter(line => (line.startsWith('+') || line.startsWith('-')) && !line.startsWith('+++') && !line.startsWith('---'));
}

function stripDiffPrefix(line) {
  return line.slice(1).trim();
}

function normalizeListItem(text) {
  return text.trim().replace(/^[-]\s*/, '').replace(/^['"]|['"]$/g, '').trim();
}

function actionFromBody(body) {
  const m = body.trim().match(/^(?:-\s*)?uses:\s*([^@\s]+)@([^\s#]+)(?:\s*#.*)?$/);
  return m ? { family: m[1], spec: `${m[1]}@${m[2]}` } : null;
}

function actionFromChangedLine(line) {
  return actionFromBody(stripDiffPrefix(line));
}

export function extractCentrallyProvenActionSpecs(text, allowedFamilies) {
  if (typeof text !== 'string' || !text.trim()) return [];
  const allowed = new Set(allowedFamilies || []);
  const specs = new Set();
  for (const line of text.split(/\r?\n/)) {
    const action = actionFromBody(line.trim());
    if (action && allowed.has(action.family)) specs.add(action.spec);
  }
  return [...specs].sort();
}

export function isCentralActionPinOnly(diff, allowedFamilies, centrallyProvenActionSpecs = []) {
  const lines = changedPayloadLines(diff);
  if (lines.length < 2) return false;
  const allowed = new Set(allowedFamilies || []);
  const proven = new Set(centrallyProvenActionSpecs || []);
  const removed = [];
  const added = [];
  for (const line of lines) {
    const action = actionFromChangedLine(line);
    if (!action || !allowed.has(action.family)) return false;
    if (line.startsWith('-')) removed.push(action);
    else added.push(action);
  }
  removed.sort((a, b) => a.family.localeCompare(b.family));
  added.sort((a, b) => a.family.localeCompare(b.family));
  if (!removed.length || removed.length !== added.length) return false;
  if (!removed.every((x, i) => x.family === added[i].family)) return false;
  return added.every(x => proven.has(x.spec));
}

export function isSelfTriggerReductionOnly({ file, diff, baseText, headText }) {
  if (baseText == null || headText == null) return false;
  const lines = changedPayloadLines(diff);
  if (lines.length !== 1 || !lines[0].startsWith('-')) return false;
  const removed = normalizeListItem(stripDiffPrefix(lines[0]));
  if (removed !== file) return false;

  const before = parsePullRequestTrigger(baseText);
  const after = parsePullRequestTrigger(headText);
  if (!before.enabled || !after.enabled) return false;
  if (!wakesForChangedFiles(before, [file])) return false;
  if (wakesForChangedFiles(after, [file])) return false;
  if (after.unbounded || after.pathsIgnore.length) return false;
  const remainingDomainPaths = after.paths.filter(p => !p.startsWith('.github/workflows/'));
  return remainingDomainPaths.length > 0;
}

export function evaluateWorkflowDefinitionChange({ file, baseText, headText, diff, changedFiles, policy, centrallyProvenActionSpecs = [] }) {
  if (baseText == null && headText != null) {
    const trigger = parsePullRequestTrigger(headText);
    const selfWake = wakesForChangedFiles(trigger, [file]);
    const domainChanged = changedFiles.filter(x => !x.startsWith('.github/workflows/')).some(x => wakesForChangedFiles(trigger, [x]));
    return selfWake || domainChanged
      ? { file, status: 'PASS', proof: selfWake ? 'added-workflow-self-wakes' : 'added-workflow-domain-proof' }
      : { file, status: 'FAIL', proof: 'added-workflow-without-verifier-proof' };
  }
  if (baseText != null && headText == null) {
    return { file, status: 'FAIL', proof: 'deleted-workflow-requires-bounded-maintenance-review' };
  }
  if (baseText == null || headText == null) {
    return { file, status: 'FAIL', proof: 'unknown-workflow-diff-state' };
  }

  const trigger = parsePullRequestTrigger(headText);
  if (wakesForChangedFiles(trigger, [file])) {
    return { file, status: 'PASS', proof: 'workflow-self-verifier-wakes' };
  }

  if (isCentralActionPinOnly(diff, policy.centrallyProvenActionFamilies || [], centrallyProvenActionSpecs)) {
    return { file, status: 'PASS', proof: 'central-exact-action-pin-canary' };
  }

  if (isSelfTriggerReductionOnly({ file, diff, baseText, headText })) {
    return { file, status: 'PASS', proof: 'bounded-self-trigger-reduction' };
  }

  if (!trigger.enabled) {
    return { file, status: 'FAIL', proof: 'pull-request-verifier-disabled-without-central-proof' };
  }

  const domainChanged = changedFiles
    .filter(x => !x.startsWith('.github/workflows/'))
    .some(x => wakesForChangedFiles(trigger, [x]));
  if (domainChanged) {
    return { file, status: 'PASS', proof: 'paired-domain-change-wakes-verifier' };
  }

  return { file, status: 'FAIL', proof: 'workflow-logic-change-without-verifier-proof' };
}

export function evaluateChanges({ baseSha, headSha, changedFiles, policy, reader = readAt, differ = diffAt }) {
  const centralProofWorkflow = policy.centralProofWorkflow || '';
  const centralProofText = centralProofWorkflow ? reader(headSha, centralProofWorkflow) : null;
  const centrallyProvenActionSpecs = extractCentrallyProvenActionSpecs(
    centralProofText,
    policy.centrallyProvenActionFamilies || []
  );
  const workflowFiles = changedFiles.filter(f => /^\.github\/workflows\/[^/]+\.ya?ml$/i.test(f)).sort();
  const results = workflowFiles.map(file => {
    const baseText = reader(baseSha, file);
    const headText = reader(headSha, file);
    const diff = differ(baseSha, headSha, file);
    return evaluateWorkflowDefinitionChange({
      file,
      baseText,
      headText,
      diff,
      changedFiles,
      policy,
      centrallyProvenActionSpecs
    });
  });
  return {
    version: policy.version,
    mode: policy.mode,
    authority: policy.authority,
    baseSha,
    headSha,
    centralProofWorkflow,
    centrallyProvenActionSpecs,
    changedWorkflowCount: workflowFiles.length,
    passCount: results.filter(x => x.status === 'PASS').length,
    failCount: results.filter(x => x.status === 'FAIL').length,
    results
  };
}

function assertAuthority(policy) {
  const expected = {
    readOnly: true,
    executionAuthority: 'none',
    repositoryMutationAuthority: false,
    workflowDispatchAuthority: false,
    capitalExecution: false,
    walletAuthority: false,
    methodologyMutationAuthority: false
  };
  for (const [key, value] of Object.entries(expected)) {
    if (policy.authority?.[key] !== value) throw new Error(`workflow definition guard authority expansion: ${key}`);
  }
  if (!policy.centralProofWorkflow || !policy.centralProofWorkflow.startsWith('.github/workflows/')) {
    throw new Error('workflow definition guard central proof workflow missing or invalid');
  }
}

function main() {
  const policyPath = process.env.WORKFLOW_DEFINITION_POLICY || DEFAULT_POLICY;
  const baseSha = process.env.BASE_SHA || '';
  const headSha = process.env.HEAD_SHA || '';
  if (!baseSha || !headSha) throw new Error('BASE_SHA and HEAD_SHA are required');
  const policy = JSON.parse(fs.readFileSync(path.resolve(ROOT, policyPath), 'utf8'));
  assertAuthority(policy);
  const changedFiles = changedFilesAt(baseSha, headSha);
  const report = evaluateChanges({ baseSha, headSha, changedFiles, policy });
  if (process.argv.includes('--json')) console.log(JSON.stringify(report, null, 2));
  else {
    console.log(`Workflow Definition Diff Guard ${report.version}`);
    console.log(`centralProof=${report.centralProofWorkflow} exactSpecs=${report.centrallyProvenActionSpecs.join(',') || '-'}`);
    for (const row of report.results) console.log(`${row.status}\t${row.file}\t${row.proof}`);
    console.log(`changed=${report.changedWorkflowCount} pass=${report.passCount} fail=${report.failCount}`);
  }
  if (report.failCount) process.exit(1);
}

const invoked = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) main();
