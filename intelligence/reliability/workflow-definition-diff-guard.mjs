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

function actionFamilyFromChangedLine(line) {
  const body = stripDiffPrefix(line);
  const m = body.match(/^(?:-\s*)?uses:\s*([^@\s]+)@[^\s#]+(?:\s*#.*)?$/);
  return m ? m[1] : null;
}

export function isCentralActionPinOnly(diff, allowedFamilies) {
  const lines = changedPayloadLines(diff);
  if (lines.length < 2) return false;
  const removed = [];
  const added = [];
  for (const line of lines) {
    const family = actionFamilyFromChangedLine(line);
    if (!family || !allowedFamilies.includes(family)) return false;
    if (line.startsWith('-')) removed.push(family);
    else added.push(family);
  }
  removed.sort();
  added.sort();
  return removed.length > 0 && removed.length === added.length && removed.every((x, i) => x === added[i]);
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

export function evaluateWorkflowDefinitionChange({ file, baseText, headText, diff, changedFiles, policy }) {
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

  if (isCentralActionPinOnly(diff, policy.centrallyProvenActionFamilies || [])) {
    return { file, status: 'PASS', proof: 'central-common-action-pin-canary' };
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
  const workflowFiles = changedFiles.filter(f => /^\.github\/workflows\/[^/]+\.ya?ml$/i.test(f)).sort();
  const results = workflowFiles.map(file => {
    const baseText = reader(baseSha, file);
    const headText = reader(headSha, file);
    const diff = differ(baseSha, headSha, file);
    return evaluateWorkflowDefinitionChange({ file, baseText, headText, diff, changedFiles, policy });
  });
  return {
    version: policy.version,
    mode: policy.mode,
    authority: policy.authority,
    baseSha,
    headSha,
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
    for (const row of report.results) console.log(`${row.status}\t${row.file}\t${row.proof}`);
    console.log(`changed=${report.changedWorkflowCount} pass=${report.passCount} fail=${report.failCount}`);
  }
  if (report.failCount) process.exit(1);
}

const invoked = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) main();
