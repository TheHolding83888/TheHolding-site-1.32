#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = process.cwd();
const DEFAULT_POLICY = 'intelligence/reliability/repository-hygiene-policy.json';

function normalizePath(value) {
  return String(value || '').replaceAll('\\', '/').replace(/^\.\//, '');
}

function loadPolicy(policyPath = DEFAULT_POLICY) {
  return JSON.parse(fs.readFileSync(path.resolve(ROOT, policyPath), 'utf8'));
}

function isAllowed(filePath, policy) {
  const p = normalizePath(filePath);
  if ((policy.allowExactPaths || []).includes(p)) return true;
  return (policy.allowPathPrefixes || []).some(prefix => p.startsWith(normalizePath(prefix)));
}

function hardPathViolations(filePath, policy) {
  const p = normalizePath(filePath);
  if (isAllowed(p, policy)) return [];
  const base = path.posix.basename(p);
  const out = [];
  if ((policy.hardForbiddenBasenames || []).includes(base)) {
    out.push({ rule: 'hard-forbidden-basename', path: p, detail: base });
  }
  for (const suffix of policy.hardForbiddenSuffixes || []) {
    if (base.endsWith(suffix)) out.push({ rule: 'hard-forbidden-suffix', path: p, detail: suffix });
  }
  return out;
}

function suspiciousAddedPathViolations(filePath, policy) {
  const p = normalizePath(filePath);
  if (isAllowed(p, policy)) return [];
  const parts = p.toLowerCase().split('/');
  const base = path.posix.basename(p).toLowerCase();
  const out = [];
  for (const segment of policy.suspiciousAddedPathSegments || []) {
    if (parts.includes(String(segment).toLowerCase())) {
      out.push({ rule: 'suspicious-added-path-segment', path: p, detail: segment });
    }
  }
  for (const token of policy.suspiciousAddedBasenameTokens || []) {
    if (base.includes(String(token).toLowerCase())) {
      out.push({ rule: 'suspicious-added-basename-token', path: p, detail: token });
    }
  }
  return out;
}

function meaninglessContentViolation(filePath, content, policy) {
  const p = normalizePath(filePath);
  if (isAllowed(p, policy)) return [];
  const cfg = policy.meaninglessAddedContent || {};
  const buf = Buffer.isBuffer(content) ? content : Buffer.from(String(content ?? ''), 'utf8');
  if (buf.length > Number(cfg.maxBytes ?? 96)) return [];
  const normalized = buf.toString('utf8').replace(/^\uFEFF/, '').trim().toLowerCase();
  if (!normalized) return [{ rule: 'meaningless-added-content', path: p, detail: 'empty' }];
  if ((cfg.tokens || []).map(String).map(v => v.toLowerCase()).includes(normalized)) {
    return [{ rule: 'meaningless-added-content', path: p, detail: normalized }];
  }
  return [];
}

export function evaluateCandidate({ filePath, content = '', added = false, policy }) {
  const violations = [...hardPathViolations(filePath, policy)];
  if (added) {
    violations.push(...suspiciousAddedPathViolations(filePath, policy));
    violations.push(...meaninglessContentViolation(filePath, content, policy));
  }
  return violations;
}

function git(args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

function trackedFiles() {
  return git(['ls-files', '-z']).split('\0').filter(Boolean).map(normalizePath);
}

function changedFiles(base) {
  if (!base) return [];
  const output = git(['diff', '--name-status', '--find-renames', `${base}...HEAD`]);
  return output.split(/\r?\n/).filter(Boolean).map(line => {
    const parts = line.split('\t');
    const status = parts[0];
    const filePath = normalizePath(status.startsWith('R') ? parts[2] : parts[1]);
    return { status, path: filePath, added: status === 'A' || status.startsWith('R') };
  });
}

function parseArgs(argv) {
  const args = { base: null, policy: DEFAULT_POLICY, json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--base') args.base = argv[++i];
    else if (arg === '--policy') args.policy = argv[++i];
    else if (arg === '--json') args.json = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

export function runGuard({ base = null, policyPath = DEFAULT_POLICY } = {}) {
  const policy = loadPolicy(policyPath);
  const violations = [];

  if (policy.rules?.scanHardForbiddenAcrossTrackedRepository !== false) {
    for (const filePath of trackedFiles()) violations.push(...hardPathViolations(filePath, policy));
  }

  const changed = changedFiles(base);
  for (const item of changed) {
    if (!item.added) continue;
    let content = '';
    try {
      content = fs.readFileSync(path.resolve(ROOT, item.path));
    } catch {
      violations.push({ rule: 'added-file-unreadable', path: item.path, detail: 'cannot-read' });
      continue;
    }
    violations.push(...evaluateCandidate({ filePath: item.path, content, added: true, policy }));
  }

  const deduped = [...new Map(violations.map(v => [`${v.rule}|${v.path}|${v.detail}`, v])).values()];
  return { policyVersion: policy.version, base, checkedAddedFiles: changed.filter(x => x.added).length, violations: deduped };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = runGuard({ base: args.base, policyPath: args.policy });
  if (args.json) console.log(JSON.stringify(result, null, 2));
  else {
    console.log(`Repository Hygiene ${result.policyVersion}`);
    console.log(`Added/renamed candidates checked: ${result.checkedAddedFiles}`);
    if (!result.violations.length) console.log('Repository Hygiene Guard PASS');
    else {
      console.error(`Repository Hygiene Guard FAIL (${result.violations.length})`);
      for (const v of result.violations) console.error(`- ${v.rule}: ${v.path} (${v.detail})`);
    }
  }
  if (result.violations.length) process.exitCode = 1;
}

const invoked = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) main();
