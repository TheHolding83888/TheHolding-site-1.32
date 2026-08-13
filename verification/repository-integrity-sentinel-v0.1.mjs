#!/usr/bin/env node
/**
 * The Holding Repository Integrity Sentinel v0.1
 *
 * Deterministic, read-only structural verification layer.
 * It NEVER mutates project source, commits, pushes, executes project engines,
 * calls external APIs, or changes production data.
 *
 * Checks:
 *  1. Critical repository contract: stable directories/files + top-level JSON keys.
 *  2. Parse every repository JSON file.
 *  3. Parse dormant Node engines/scripts (.mjs/.cjs) with `node --check`.
 *  4. Local JS dependency references: import/export-from/dynamic literal import/require.
 *  5. GitHub workflow local paths: working-directory, local action uses, executable script refs.
 *  6. Local HTML script/stylesheet references.
 *  7. Unresolved merge-conflict markers in executable/config surfaces.
 *
 * Default = OBSERVER: findings become GitHub warnings and exit 0.
 * --enforce = fail closed after calibration.
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const VERSION = '0.1.1-calibration';
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));

function argsOf(argv) {
  const pick = (name) => {
    const i = argv.indexOf(name);
    return i >= 0 ? argv[i + 1] : null;
  };
  return {
    enforce: argv.includes('--enforce'),
    rootArg: pick('--root'),
    contractArg: pick('--contract')
  };
}

function repoRoot(rootArg) {
  if (rootArg) return path.resolve(rootArg);
  try {
    return execFileSync('git', ['rev-parse', '--show-toplevel'], {
      cwd: SCRIPT_DIR,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim();
  } catch {
    return path.resolve(SCRIPT_DIR, '..');
  }
}

const ARGS = argsOf(process.argv.slice(2));
const ROOT = repoRoot(ARGS.rootArg);
const CONTRACT_PATH = path.resolve(ARGS.contractArg || path.join(ROOT, 'verification', 'repository-contract-v0.1.json'));
const SKIP_DIRS = new Set(['.git', 'node_modules', 'vendor', 'dist', 'build', 'coverage', '.cache']);
const MODULE_EXTS = new Set(['.js', '.mjs', '.cjs']);
const WORKFLOW_EXTS = new Set(['.yml', '.yaml']);
const MERGE_GUARD_EXTS = new Set(['.js', '.mjs', '.cjs', '.html', '.htm', '.json', '.yml', '.yaml']);
const EXEC_REF_EXTS = new Set(['.js', '.mjs', '.cjs', '.py', '.sh']);

const findings = [];
const stats = {
  files: 0,
  jsonFiles: 0,
  jsonParseErrors: 0,
  nodeSyntaxFiles: 0,
  moduleFiles: 0,
  moduleRefs: 0,
  htmlFiles: 0,
  htmlRefs: 0,
  workflows: 0,
  workflowDirs: 0,
  workflowScriptRefs: 0,
  workflowLocalActions: 0,
  mergeGuardFiles: 0,
  contractDirectories: 0,
  contractFiles: 0,
  contractKeys: 0
};

function rel(p) {
  return path.relative(ROOT, p).split(path.sep).join('/') || '.';
}

function escapeActionMessage(value) {
  return String(value)
    .replace(/%/g, '%25')
    .replace(/\r/g, '%0D')
    .replace(/\n/g, '%0A');
}

function finding(kind, file, target, detail, severity = 'watch') {
  const row = { kind, severity, file: typeof file === 'string' ? file : rel(file), target: target || '', detail: String(detail || '') };
  findings.push(row);
  if (process.env.GITHUB_ACTIONS === 'true') {
    console.log(`::warning title=Repository Integrity Sentinel::${escapeActionMessage(`${kind}: ${row.file}${row.target ? ` → ${row.target}` : ''} — ${row.detail}`)}`);
  }
}

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.isDirectory() && SKIP_DIRS.has(ent.name)) continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

function readJson(file, report = true) {
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    return { ok: true, parsed };
  } catch (error) {
    if (report) finding('invalid-json', file, '', error.message);
    return { ok: false, parsed: null, error };
  }
}

function loadContract() {
  if (!fs.existsSync(CONTRACT_PATH)) {
    finding('missing-contract', rel(CONTRACT_PATH), '', 'Repository integrity contract does not exist.');
    return null;
  }
  const r = readJson(CONTRACT_PATH, true);
  if (!r.ok) return null;
  return r.parsed;
}

function checkContract(contract) {
  if (!contract || typeof contract !== 'object') return;
  for (const d of contract.requiredDirectories || []) {
    stats.contractDirectories++;
    const full = path.resolve(ROOT, d);
    if (!fs.existsSync(full) || !fs.statSync(full).isDirectory()) {
      finding('missing-critical-directory', CONTRACT_PATH, d, 'Critical repository directory is missing. Intentional architecture changes must update the contract in the same patch.');
    }
  }

  for (const item of contract.criticalFiles || []) {
    stats.contractFiles++;
    const p = item && item.path;
    if (!p || typeof p !== 'string') {
      finding('invalid-contract-entry', CONTRACT_PATH, '', 'criticalFiles entry is missing a string path.');
      continue;
    }
    const full = path.resolve(ROOT, p);
    if (!fs.existsSync(full) || !fs.statSync(full).isFile()) {
      finding('missing-critical-file', CONTRACT_PATH, p, 'Critical production surface is missing. Intentional moves/renames must update the contract in the same patch.');
      continue;
    }
    if (item.kind === 'json') {
      const r = readJson(full, false);
      if (!r.ok) {
        finding('invalid-critical-json', full, '', r.error.message);
        continue;
      }
      for (const key of item.requiredTopLevelKeys || []) {
        stats.contractKeys++;
        if (!Object.prototype.hasOwnProperty.call(r.parsed, key)) {
          finding('critical-schema-drift', full, key, `Required top-level key '${key}' is absent. If this schema change is intentional, update the repository contract in the same patch.`);
        }
      }
    }
  }
}

function parseAllJson(file) {
  stats.jsonFiles++;
  try {
    JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    stats.jsonParseErrors++;
    finding('invalid-json', file, '', error.message);
  }
}

function checkNodeSyntax(file) {
  const ext = path.extname(file).toLowerCase();
  if (ext !== '.mjs' && ext !== '.cjs') return;
  stats.nodeSyntaxFiles++;
  const run = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (run.status !== 0) {
    const detail = (run.stderr || run.stdout || `node --check exited ${run.status}`).trim().slice(0, 3000);
    finding('node-syntax-error', file, '', detail);
  }
}

function stripQueryHash(value) {
  return String(value || '').split('#')[0].split('?')[0];
}

function externalSpecifier(s) {
  if (!s) return true;
  if (/^(?:https?:|data:|blob:|node:|npm:|#|\/\/)/i.test(s)) return true;
  if (s.startsWith('.') || s.startsWith('/')) return false;
  return true;
}

function candidatePaths(base) {
  const out = [base];
  if (!path.extname(base)) {
    for (const ext of ['.js', '.mjs', '.cjs', '.json']) out.push(`${base}${ext}`);
    for (const name of ['index.js', 'index.mjs', 'index.cjs', 'index.json']) out.push(path.join(base, name));
  }
  return out;
}

function resolveLocal(fromFile, spec) {
  if (externalSpecifier(spec)) return { external: true, found: null, candidates: [] };
  const base = spec.startsWith('/')
    ? path.resolve(ROOT, `.${spec}`)
    : path.resolve(path.dirname(fromFile), spec);
  const candidates = candidatePaths(base);
  return { external: false, found: candidates.find((p) => fs.existsSync(p)) || null, candidates };
}

function stripCommentsConservatively(text) {
  // Conservative only: remove full-line // comments and block comments. This is not a JS parser;
  // it exists solely to reduce obvious false positives in literal-reference scanning.
  return text
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

function scanModules(file) {
  stats.moduleFiles++;
  const text = stripCommentsConservatively(fs.readFileSync(file, 'utf8'));
  const patterns = [
    /\bimport\s+(?:[^'"()]*?\s+from\s+)?['"]([^'"]+)['"]/g,
    /\bexport\s+[^'";]*?\s+from\s+['"]([^'"]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g
  ];
  const seen = new Set();
  for (const re of patterns) {
    for (const m of text.matchAll(re)) {
      const spec = stripQueryHash(m[1]);
      const key = `${m.index}:${spec}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const r = resolveLocal(file, spec);
      if (r.external) continue;
      stats.moduleRefs++;
      if (!r.found) {
        finding('missing-local-module', file, spec, `No matching local module. Tried: ${r.candidates.map(rel).join(', ')}`);
      }
    }
  }
}

function scanHtml(file) {
  stats.htmlFiles++;
  const text = fs.readFileSync(file, 'utf8');
  const refs = [];
  for (const m of text.matchAll(/<script\b[^>]*\bsrc\s*=\s*['"]([^'"]+)['"][^>]*>/gi)) refs.push({ kind: 'script', value: m[1] });
  for (const m of text.matchAll(/<link\b[^>]*\brel\s*=\s*['"][^'"]*stylesheet[^'"]*['"][^>]*\bhref\s*=\s*['"]([^'"]+)['"][^>]*>/gi)) refs.push({ kind: 'stylesheet', value: m[1] });
  for (const m of text.matchAll(/<link\b[^>]*\bhref\s*=\s*['"]([^'"]+)['"][^>]*\brel\s*=\s*['"][^'"]*stylesheet[^'"]*['"][^>]*>/gi)) refs.push({ kind: 'stylesheet', value: m[1] });
  const seen = new Set();
  for (const ref of refs) {
    const clean = stripQueryHash(ref.value);
    if (!clean || /^(?:https?:|data:|blob:|\/\/)/i.test(clean)) continue;
    const key = `${ref.kind}:${clean}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const r = resolveLocal(file, clean);
    if (r.external) continue;
    stats.htmlRefs++;
    if (!r.found) finding('missing-html-resource', file, ref.value, `${ref.kind} target does not exist in repository.`);
  }
}

function unquote(s) {
  const t = String(s || '').trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) return t.slice(1, -1);
  return t;
}

function dynamicValue(v) {
  return /\$\{\{|\$[A-Za-z_{]|github\.|env\.|matrix\.|inputs\./.test(String(v || ''));
}

function scanWorkflow(file) {
  stats.workflows++;
  const text = fs.readFileSync(file, 'utf8');
  const workingDirs = new Set(['.']);

  for (const m of text.matchAll(/^\s*working-directory\s*:\s*(.+?)\s*$/gm)) {
    const value = unquote(m[1].replace(/\s+#.*$/, ''));
    if (!value || dynamicValue(value)) continue;
    stats.workflowDirs++;
    workingDirs.add(value);
    const full = path.resolve(ROOT, value);
    if (!fs.existsSync(full) || !fs.statSync(full).isDirectory()) {
      finding('missing-working-directory', file, value, 'Workflow working-directory does not exist.');
    }
  }

  for (const m of text.matchAll(/^\s*uses\s*:\s*(\.\/[^\s#]+).*$/gm)) {
    const value = unquote(m[1]);
    if (dynamicValue(value)) continue;
    stats.workflowLocalActions++;
    const full = path.resolve(ROOT, value.slice(2));
    if (!fs.existsSync(full)) finding('missing-local-action', file, value, 'Workflow local action path does not exist.');
  }

  // Workflow script references are intentionally extracted only from executable contexts.
  // v0.1 scanned every token ending in .js/.mjs/etc. and therefore mistook prose/package
  // names such as "Node.js" and "bignumber.js" for repository scripts. v0.1.1 limits
  // detection to interpreter invocations (node/python/bash/sh) plus explicit ./ or ../ paths.
  const executableRefs = [];
  const lines = text.split(/\r?\n/);
  for (const rawLine of lines) {
    if (/^\s*#/.test(rawLine)) continue;
    const line = rawLine.replace(/\s+#.*$/, '');

    const interpreterRe = /\b(?:node|python3?|bash|sh)\s+(?:(?:--?[A-Za-z0-9_-]+)(?:[= ]+[^\s;&|]+)?\s+)*["']?([^"'`\s;&|]+\.(?:mjs|cjs|js|py|sh))["']?/gi;
    for (const m of line.matchAll(interpreterRe)) executableRefs.push(m[1]);

    const directRe = /(?:^|[\s;&|])((?:\.\.?\/)[A-Za-z0-9_./-]+\.(?:mjs|cjs|js|py|sh))(?=$|[\s;&|])/g;
    for (const m of line.matchAll(directRe)) executableRefs.push(m[1]);
  }

  const seen = new Set();
  for (const tokenRaw of executableRefs) {
    const token = stripQueryHash(tokenRaw);
    if (seen.has(token) || dynamicValue(token)) continue;
    seen.add(token);
    if (!EXEC_REF_EXTS.has(path.extname(token))) continue;
    stats.workflowScriptRefs++;
    const possible = [];
    if (token.startsWith('/')) possible.push(path.join(ROOT, token.slice(1)));
    else {
      possible.push(path.resolve(ROOT, token));
      for (const wd of workingDirs) possible.push(path.resolve(ROOT, wd, token));
    }
    if (!possible.some((p) => fs.existsSync(p))) {
      finding('missing-workflow-script', file, token, `Executable reference not found from repository root or declared working-directory. Tried: ${[...new Set(possible)].map(rel).join(', ')}`);
    }
  }
}

function mergeGuard(file) {
  if (!MERGE_GUARD_EXTS.has(path.extname(file).toLowerCase())) return;
  stats.mergeGuardFiles++;
  const text = fs.readFileSync(file, 'utf8');
  const markers = text.match(/^(?:<<<<<<<|=======|>>>>>>>)(?:\s|$).*$/gm);
  if (markers && markers.length) {
    finding('unresolved-merge-marker', file, '', `Found ${markers.length} unresolved merge-conflict marker line(s).`);
  }
}

function summary(status) {
  const lines = [
    '## The Holding Repository Integrity Sentinel',
    '',
    `- Version: \`${VERSION}\``,
    `- Mode: **${ARGS.enforce ? 'ENFORCE' : 'OBSERVER'}**`,
    `- Status: **${status}**`,
    `- Findings: **${findings.length}**`,
    `- Repository files scanned: **${stats.files}**`,
    `- Critical contract: ${stats.contractDirectories} directories · ${stats.contractFiles} files · ${stats.contractKeys} required JSON keys`,
    `- JSON parsed: ${stats.jsonFiles} files`,
    `- Node syntax checked: ${stats.nodeSyntaxFiles} .mjs/.cjs files`,
    `- Dependency refs: ${stats.moduleRefs} local modules · ${stats.htmlRefs} HTML resources`,
    `- Workflows: ${stats.workflows} files · ${stats.workflowScriptRefs} executable refs · ${stats.workflowDirs} working directories · ${stats.workflowLocalActions} local actions`,
    `- Merge-marker guarded: ${stats.mergeGuardFiles} files`,
    ''
  ];
  if (findings.length) {
    lines.push('### Findings', '');
    for (const f of findings) lines.push(`- \`${f.kind}\` — \`${f.file}\`${f.target ? ` → \`${f.target}\`` : ''}`);
    lines.push('');
  } else {
    lines.push('No repository integrity findings detected.', '');
  }
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${lines.join('\n')}\n`);
}

function main() {
  if (!fs.existsSync(ROOT)) {
    console.error(`Repository root does not exist: ${ROOT}`);
    process.exit(2);
  }
  const contract = loadContract();
  checkContract(contract);

  const files = walk(ROOT);
  stats.files = files.length;
  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    const r = rel(file);
    if (ext === '.json') parseAllJson(file);
    if (ext === '.mjs' || ext === '.cjs') checkNodeSyntax(file);
    if (MODULE_EXTS.has(ext)) scanModules(file);
    if (ext === '.html' || ext === '.htm') scanHtml(file);
    if (r.startsWith('.github/workflows/') && WORKFLOW_EXTS.has(ext)) scanWorkflow(file);
    mergeGuard(file);
  }

  const status = findings.length ? 'WATCH' : 'PASS';
  console.log(`\nThe Holding Repository Integrity Sentinel ${VERSION}`);
  console.log(`Root: ${ROOT}`);
  console.log(`Mode: ${ARGS.enforce ? 'ENFORCE' : 'OBSERVER'}`);
  console.log(`Status: ${status}`);
  console.log(`Findings: ${findings.length}`);
  console.log(`Scanned: ${stats.files} files · ${stats.jsonFiles} JSON · ${stats.nodeSyntaxFiles} Node syntax · ${stats.workflows} workflows`);
  console.log(`Contract: ${stats.contractDirectories} dirs · ${stats.contractFiles} files · ${stats.contractKeys} keys`);
  console.log(`References: ${stats.moduleRefs} modules · ${stats.htmlRefs} HTML · ${stats.workflowScriptRefs} workflow scripts`);

  if (findings.length) {
    console.log('\nFindings:');
    for (const [i, f] of findings.entries()) {
      console.log(`${i + 1}. [${f.kind}] ${f.file}${f.target ? ` → ${f.target}` : ''}`);
      console.log(`   ${f.detail}`);
    }
  } else {
    console.log('\nNo repository integrity findings detected.');
  }

  summary(status);
  if (ARGS.enforce && findings.length) process.exit(1);
}

main();
