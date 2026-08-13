#!/usr/bin/env node
/**
 * The Holding Security Hardening v0.1.1
 *
 * Narrow purpose:
 *   Freeze GitHub-owned checkout/setup-node Actions that are currently referenced
 *   through mutable `@v4` tags.
 *
 * Safety:
 *   - Only exact `actions/checkout@v4` and `actions/setup-node@v4` refs are changed.
 *   - Any other mutable ref for these two Actions is fail-closed.
 *   - Existing full 40-char SHA pins are left untouched.
 *   - No business/data/methodology code is touched.
 *   - First deployment accepts only the audited baseline of 30 mutable refs,
 *     or 0 on an idempotent re-run.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const VERSION = '0.1.1-github-actions-sha-pinning';
const ROOT = process.cwd();
const WORKFLOWS_DIR = path.join(ROOT, '.github', 'workflows');
const REPORT_PATH = path.join(ROOT, 'security', 'security-hardening-report.json');
const VERIFY_ONLY = process.argv.includes('--verify-only');

const TARGETS = {
  'actions/checkout': {
    mutableRef: 'v4',
    pinnedRef: '11d5960a326750d5838078e36cf38b85af677262',
    versionNote: 'v4.4.0',
    provenance: 'official actions/checkout repository'
  },
  'actions/setup-node': {
    mutableRef: 'v4',
    pinnedRef: '49933ea5288caeca8642d1e84afbd3f7d6820020',
    versionNote: 'v4',
    provenance: 'official actions/setup-node v4 branch head, 2025-04-02'
  }
};

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function listWorkflowFiles() {
  if (!fs.existsSync(WORKFLOWS_DIR)) {
    throw new Error(`workflow directory missing: ${path.relative(ROOT, WORKFLOWS_DIR)}`);
  }
  return fs.readdirSync(WORKFLOWS_DIR)
    .filter((name) => /\.ya?ml$/i.test(name))
    .sort()
    .map((name) => path.join(WORKFLOWS_DIR, name));
}

function parseUsesLine(line) {
  const match = line.match(/^(\s*(?:-\s*)?uses:\s*)(actions\/(?:checkout|setup-node))@([^\s#'"]+)(?:\s+#.*)?\s*$/);
  if (!match) return null;
  return {
    prefix: match[1],
    action: match[2],
    ref: match[3]
  };
}

function scan(files) {
  const entries = [];
  for (const file of files) {
    const rel = path.relative(ROOT, file).replaceAll(path.sep, '/');
    const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
    lines.forEach((line, index) => {
      const parsed = parseUsesLine(line);
      if (!parsed) return;
      const fullSha = /^[0-9a-f]{40}$/i.test(parsed.ref);
      entries.push({
        file: rel,
        line: index + 1,
        action: parsed.action,
        ref: parsed.ref,
        immutable: fullSha
      });
    });
  }
  return entries;
}

function expectedBaselineAllowed(count) {
  const raw = process.env.EXPECTED_MUTABLE_REF_COUNTS || '30,0';
  const allowed = raw.split(',').map((x) => Number(x.trim())).filter(Number.isFinite);
  if (!allowed.length) throw new Error('EXPECTED_MUTABLE_REF_COUNTS contains no valid numbers');
  return allowed.includes(count);
}

const files = listWorkflowFiles();
const beforeEntries = scan(files);
const mutableBefore = beforeEntries.filter((x) => !x.immutable);

const unsupported = mutableBefore.filter((entry) => {
  const target = TARGETS[entry.action];
  return !target || entry.ref !== target.mutableRef;
});

if (unsupported.length) {
  throw new Error(
    'Unsupported mutable GitHub Action ref(s) detected; refusing to guess:\n' +
    unsupported.map((x) => `- ${x.file}:${x.line} ${x.action}@${x.ref}`).join('\n')
  );
}

if (VERIFY_ONLY) {
  if (mutableBefore.length !== 0) {
    throw new Error(
      `verify-only failed: ${mutableBefore.length} mutable target ref(s) remain:\n` +
      mutableBefore.map((x) => `- ${x.file}:${x.line} ${x.action}@${x.ref}`).join('\n')
    );
  }
  console.log(`Security hardening verify-only PASS: ${beforeEntries.length} target Action refs are immutable.`);
  process.exit(0);
}

if (!expectedBaselineAllowed(mutableBefore.length)) {
  throw new Error(
    `Audited mutable-ref baseline mismatch. Expected one of [${process.env.EXPECTED_MUTABLE_REF_COUNTS || '30,0'}], ` +
    `found ${mutableBefore.length}. Refusing broad rewrite.`
  );
}

const changedFiles = [];
const replacements = [];
const beforeHashes = {};

for (const file of files) {
  const rel = path.relative(ROOT, file).replaceAll(path.sep, '/');
  const original = fs.readFileSync(file, 'utf8');
  beforeHashes[rel] = sha256(original);

  let changed = false;
  const out = original.split(/\r?\n/).map((line, index) => {
    const parsed = parseUsesLine(line);
    if (!parsed) return line;

    const target = TARGETS[parsed.action];
    if (!target) return line;

    if (/^[0-9a-f]{40}$/i.test(parsed.ref)) {
      return line;
    }

    if (parsed.ref !== target.mutableRef) {
      throw new Error(`${rel}:${index + 1} unexpected mutable ref ${parsed.action}@${parsed.ref}`);
    }

    changed = true;
    replacements.push({
      file: rel,
      line: index + 1,
      action: parsed.action,
      from: parsed.ref,
      to: target.pinnedRef,
      versionNote: target.versionNote
    });

    return `${parsed.prefix}${parsed.action}@${target.pinnedRef} # ${target.versionNote}`;
  }).join('\n');

  if (changed) {
    fs.writeFileSync(file, out, 'utf8');
    changedFiles.push(rel);
  }
}

const afterEntries = scan(files);
const mutableAfter = afterEntries.filter((x) => !x.immutable);

if (mutableAfter.length) {
  throw new Error(
    `Post-patch validation failed: ${mutableAfter.length} mutable refs remain:\n` +
    mutableAfter.map((x) => `- ${x.file}:${x.line} ${x.action}@${x.ref}`).join('\n')
  );
}

for (const replacement of replacements) {
  const target = TARGETS[replacement.action];
  if (replacement.to !== target.pinnedRef) {
    throw new Error(`Pinned-ref invariant failed for ${replacement.action}`);
  }
}

const report = {
  version: VERSION,
  generatedAt: new Date().toISOString(),
  policy: {
    mode: 'narrow-reviewed-first-party-action-sha-pinning',
    immutableRefRequired: true,
    allowedMutableRefs: {
      'actions/checkout': 'v4',
      'actions/setup-node': 'v4'
    },
    idempotent: true,
    failClosedOnUnexpectedMutableRef: true
  },
  reviewedPins: TARGETS,
  summary: {
    workflowFilesScanned: files.length,
    targetActionRefsBefore: beforeEntries.length,
    mutableRefsBefore: mutableBefore.length,
    replacements: replacements.length,
    changedFileCount: changedFiles.length,
    targetActionRefsAfter: afterEntries.length,
    mutableRefsAfter: mutableAfter.length,
    status: mutableBefore.length === 0 ? 'already-hardened' : 'hardened'
  },
  changedFiles,
  replacements,
  integrity: {
    changedFilesAfter: Object.fromEntries(
      changedFiles.map((rel) => {
        const abs = path.join(ROOT, rel);
        return [rel, sha256(fs.readFileSync(abs, 'utf8'))];
      })
    ),
    unchangedWorkflowCount: files.length - changedFiles.length
  }
};

fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2) + '\n', 'utf8');

console.log(JSON.stringify({
  version: VERSION,
  mutableRefsBefore: mutableBefore.length,
  replacements: replacements.length,
  changedFiles: changedFiles.length,
  mutableRefsAfter: mutableAfter.length,
  report: path.relative(ROOT, REPORT_PATH).replaceAll(path.sep, '/')
}, null, 2));
