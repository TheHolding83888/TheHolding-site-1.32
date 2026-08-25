#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = process.cwd();
const WORKFLOW_DIR = '.github/workflows';
const DEFAULT_POLICY = 'intelligence/reliability/workflow-control-plane-policy.json';

function cleanScalar(value) {
  return String(value ?? '').trim().replace(/^['"]|['"]$/g, '');
}

function workflowName(text, fallback) {
  const match = text.match(/^name:\s*(.+?)\s*$/m);
  return match ? cleanScalar(match[1]) : fallback;
}

function lineIndent(line) {
  return (line.match(/^\s*/) || [''])[0].length;
}

function collectYamlBlock(lines, startIndex) {
  const parentIndent = lineIndent(lines[startIndex]);
  const block = [];
  for (let i = startIndex + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line.trim() || line.trim().startsWith('#')) {
      block.push(line);
      continue;
    }
    if (lineIndent(line) <= parentIndent) break;
    block.push(line);
  }
  return block;
}

function parseInlineList(value) {
  const raw = cleanScalar(value);
  if (!raw.startsWith('[') || !raw.endsWith(']')) return [];
  return raw.slice(1, -1).split(',').map(cleanScalar).filter(Boolean);
}

function parseOn(text) {
  const lines = text.split(/\r?\n/);
  const triggers = new Set();
  const schedules = [];
  const workflowRunSources = [];

  for (let i = 0; i < lines.length; i += 1) {
    const match = lines[i].match(/^on:\s*(.*?)\s*$/);
    if (!match) continue;
    const inline = match[1];
    if (inline) {
      const list = parseInlineList(inline);
      if (list.length) list.forEach(v => triggers.add(v));
      else triggers.add(cleanScalar(inline));
      break;
    }

    const block = collectYamlBlock(lines, i);
    let activeTop = null;
    let workflowRunField = null;

    for (const line of block) {
      const top = line.match(/^\s{2}([A-Za-z0-9_-]+):(?:\s*(.*))?$/);
      if (top) {
        activeTop = top[1];
        workflowRunField = null;
        triggers.add(activeTop);
        continue;
      }

      if (activeTop === 'schedule') {
        const cron = line.match(/cron:\s*['"]?([^'"]+)['"]?\s*$/);
        if (cron) schedules.push(cron[1].trim());
        continue;
      }

      if (activeTop === 'workflow_run') {
        const field = line.match(/^\s{4}([A-Za-z0-9_-]+):(?:\s*(.*))?$/);
        if (field) {
          workflowRunField = field[1];
          if (workflowRunField === 'workflows') {
            const list = parseInlineList(field[2]);
            list.forEach(v => workflowRunSources.push(v));
          }
          continue;
        }

        if (workflowRunField === 'workflows') {
          const listItem = line.match(/^\s{6,}-\s*['"]?(.+?)['"]?\s*$/);
          if (listItem) workflowRunSources.push(cleanScalar(listItem[1]));
        }
      }
    }
    break;
  }

  return {
    triggers: [...triggers].sort(),
    schedules: [...new Set(schedules)].sort(),
    workflowRunSources: [...new Set(workflowRunSources)].sort()
  };
}

function parsePermissions(text) {
  const lines = text.split(/\r?\n/);
  const scopes = [];
  for (let i = 0; i < lines.length; i += 1) {
    const m = lines[i].match(/^(\s*)permissions:\s*(.*?)\s*$/);
    if (!m) continue;
    const indent = m[1].length;
    const inline = cleanScalar(m[2]);
    const entries = {};
    if (inline) {
      entries['*'] = inline;
    } else {
      for (let j = i + 1; j < lines.length; j += 1) {
        const line = lines[j];
        if (!line.trim() || line.trim().startsWith('#')) continue;
        if (lineIndent(line) <= indent) break;
        const kv = line.match(/^\s*([A-Za-z0-9_-]+):\s*([^#]+?)\s*$/);
        if (kv) entries[kv[1]] = cleanScalar(kv[2]);
      }
    }
    scopes.push({ indent, entries });
  }
  return scopes;
}

function permissionSignals(scopes) {
  const signals = [];
  const otherWritePermissions = new Set();
  let contentsWrite = false;
  let actionsWrite = false;
  let writeAll = false;

  for (const scope of scopes) {
    for (const [key, valueRaw] of Object.entries(scope.entries)) {
      const value = String(valueRaw).toLowerCase();
      if (value === 'write' || value === 'write-all') signals.push(`permission:${key}:${value}`);
      if (key === 'contents' && value === 'write') contentsWrite = true;
      else if (key === 'actions' && value === 'write') actionsWrite = true;
      else if (value === 'write' && key !== '*') otherWritePermissions.add(key);
      if ((key === '*' && value === 'write-all') || value === 'write-all') writeAll = true;
    }
  }

  return {
    contentsWrite,
    actionsWrite,
    writeAll,
    otherWritePermissions: [...otherWritePermissions].sort(),
    signals: [...new Set(signals)].sort()
  };
}

function extractDispatchTargets(text) {
  const targets = new Set();
  const patterns = [
    /gh\s+workflow\s+run\s+['"]?([^\s'"\\]+)['"]?/g,
    /actions\/workflows\/([^/\s'"}]+)\/dispatches/g
  ];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) targets.add(cleanScalar(match[1]));
  }
  return [...targets].sort();
}

function extractCandidateWriterPaths(text) {
  const paths = new Set();
  let broadGitAdd = false;
  for (const match of text.matchAll(/git\s+add\s+([^\n\r]+)/g)) {
    const payload = match[1].replace(/[#;&|].*$/, '').trim();
    if (/^(?:-A|--all|\.)(?:\s|$)/.test(payload)) broadGitAdd = true;
    for (const tokenRaw of payload.split(/\s+/)) {
      const token = cleanScalar(tokenRaw.replace(/\\$/, ''));
      if (!token || token.startsWith('-') || token === '.') continue;
      if (token.includes('${{') || token.includes('$')) continue;
      if (/^[A-Za-z0-9_.\/-]+$/.test(token) && token.includes('/')) paths.add(token.replace(/^\.\//, ''));
    }
  }
  for (const match of text.matchAll(/(?:writeFile|writeFileSync)\s*\(\s*['"]([^'"]+)['"]/g)) {
    const p = match[1].replace(/^\.\//, '');
    if (!p.includes('$') && !path.isAbsolute(p)) paths.add(p);
  }
  return { paths: [...paths].sort(), broadGitAdd };
}

function scanWorkflowText(filePath, text) {
  const base = path.basename(filePath);
  const on = parseOn(text);
  const permissionScopes = parsePermissions(text);
  const perm = permissionSignals(permissionScopes);
  const hasConcurrency = /^\s*concurrency:\s*/m.test(text);
  const gitCommit = /\bgit\s+commit\b/.test(text);
  const gitPush = /\bgit\s+push\b/.test(text);
  const contentsApiWrite = /\bgh\s+api\b[^\n]*(?:--method\s+(?:PUT|PATCH|POST|DELETE)|-X\s*(?:PUT|PATCH|POST|DELETE))[^\n]*(?:\/contents\/|contents\?)/i.test(text)
    || /\/repos\/[^\s]+\/contents\//.test(text);
  const dispatchTargets = extractDispatchTargets(text);
  const candidate = extractCandidateWriterPaths(text);
  const pullRequestTarget = on.triggers.includes('pull_request_target') || /^\s*pull_request_target\s*:/m.test(text);

  const repositoryWriterCapable = perm.contentsWrite || gitCommit || gitPush || contentsApiWrite || perm.writeAll;
  const workflowControlCapable = perm.actionsWrite || dispatchTargets.length > 0 || perm.writeAll;
  const otherWritePermission = perm.otherWritePermissions.length > 0;
  const privilegedWorkflow = repositoryWriterCapable || workflowControlCapable || otherWritePermission || perm.writeAll;

  const writeSignals = [
    ...perm.signals,
    ...(gitCommit ? ['git-commit'] : []),
    ...(gitPush ? ['git-push'] : []),
    ...(contentsApiWrite ? ['contents-api-write'] : []),
    ...(dispatchTargets.length ? ['workflow-dispatch'] : [])
  ];

  return {
    file: filePath.replaceAll('\\', '/'),
    id: base.replace(/\.ya?ml$/i, ''),
    name: workflowName(text, base),
    triggers: on.triggers,
    schedules: on.schedules,
    workflowRunSources: on.workflowRunSources,
    dispatchTargets,
    permissions: permissionScopes,
    hasConcurrency,
    repositoryWriterCapable,
    workflowControlCapable,
    otherWritePermission,
    otherWritePermissions: perm.otherWritePermissions,
    privilegedWorkflow,
    contentsWrite: perm.contentsWrite,
    actionsWrite: perm.actionsWrite,
    writeAll: perm.writeAll,
    pullRequestTarget,
    writeSignals: [...new Set(writeSignals)].sort(),
    candidateWriterPaths: candidate.paths,
    broadGitAdd: candidate.broadGitAdd
  };
}

function resolveWorkflowTarget(target, byName, byId) {
  const normalized = cleanScalar(target);
  const normalizedId = normalized.replace(/\.ya?ml$/i, '');
  if (byId.has(normalizedId)) return byId.get(normalizedId);
  if (byName.has(normalized)) return byName.get(normalized);
  return null;
}

function buildGraph(workflows) {
  const byName = new Map(workflows.map(w => [w.name, w.id]));
  const byId = new Map(workflows.map(w => [w.id, w.id]));
  const edges = [];
  const unresolved = [];

  for (const workflow of workflows) {
    for (const source of workflow.workflowRunSources) {
      const from = resolveWorkflowTarget(source, byName, byId);
      if (from) edges.push({ from, to: workflow.id, type: 'workflow_run' });
      else unresolved.push({ from: source, to: workflow.id, type: 'workflow_run' });
    }
    for (const target of workflow.dispatchTargets) {
      const to = resolveWorkflowTarget(target, byName, byId);
      if (to) edges.push({ from: workflow.id, to, type: 'workflow-dispatch' });
      else unresolved.push({ from: workflow.id, to: target, type: 'workflow-dispatch' });
    }
  }

  const uniqueEdges = [...new Map(edges.map(e => [`${e.from}|${e.to}|${e.type}`, e])).values()]
    .sort((a, b) => `${a.from}|${a.to}|${a.type}`.localeCompare(`${b.from}|${b.to}|${b.type}`));
  return { edges: uniqueEdges, unresolved };
}

function detectCycles(workflows, edges) {
  const adjacency = new Map(workflows.map(w => [w.id, []]));
  for (const edge of edges) {
    if (adjacency.has(edge.from) && adjacency.has(edge.to)) adjacency.get(edge.from).push(edge.to);
  }
  const state = new Map();
  const stack = [];
  const cycles = new Set();

  function visit(node) {
    state.set(node, 1);
    stack.push(node);
    for (const next of adjacency.get(node) || []) {
      if (!state.has(next)) visit(next);
      else if (state.get(next) === 1) {
        const start = stack.lastIndexOf(next);
        cycles.add([...stack.slice(start), next].join(' -> '));
      }
    }
    stack.pop();
    state.set(node, 2);
  }

  for (const workflow of workflows) if (!state.has(workflow.id)) visit(workflow.id);
  return [...cycles].sort();
}

function duplicateWriterCandidates(workflows) {
  const owners = new Map();
  for (const workflow of workflows) {
    if (!workflow.repositoryWriterCapable) continue;
    for (const p of workflow.candidateWriterPaths) {
      if (!owners.has(p)) owners.set(p, []);
      owners.get(p).push(workflow.id);
    }
  }
  return [...owners.entries()]
    .filter(([, ids]) => new Set(ids).size > 1)
    .map(([candidatePath, ids]) => ({ candidatePath, workflows: [...new Set(ids)].sort() }))
    .sort((a, b) => a.candidatePath.localeCompare(b.candidatePath));
}

function finding(id, severity, workflow, detail) {
  return { id, severity, workflow, detail };
}

export function buildControlPlane({ entries, policy }) {
  const workflows = entries.map(({ file, text }) => scanWorkflowText(file, text)).sort((a, b) => a.file.localeCompare(b.file));
  const graph = buildGraph(workflows);
  const cycles = detectCycles(workflows, graph.edges);
  const duplicates = duplicateWriterCandidates(workflows);
  const findings = [];

  for (const w of workflows) {
    if (w.repositoryWriterCapable && !w.hasConcurrency) {
      findings.push(finding('repository-writer-without-concurrency', 'watch', w.id, 'repository writer candidate has no concurrency declaration'));
    }
    if (w.workflowControlCapable && !w.hasConcurrency) {
      findings.push(finding('workflow-control-without-concurrency', 'watch', w.id, 'workflow control actor has no concurrency declaration'));
    }
    if (w.writeAll) findings.push(finding('write-all-permission', 'high', w.id, 'write-all permission detected'));
    if (w.pullRequestTarget) findings.push(finding('pull-request-target', 'high', w.id, 'pull_request_target trigger detected'));
    if (w.broadGitAdd) findings.push(finding('broad-git-add', 'watch', w.id, 'broad git add detected'));
  }
  for (const item of duplicates) findings.push(finding('duplicate-candidate-writer', 'watch', item.workflows.join(','), item.candidatePath));
  for (const item of graph.unresolved) findings.push(finding('unresolved-workflow-edge', 'info', item.from, `${item.type}:${item.to}`));
  for (const cycle of cycles) findings.push(finding('workflow-cycle', 'high', 'graph', cycle));

  const sourceHash = crypto.createHash('sha256');
  for (const entry of entries.slice().sort((a, b) => a.file.localeCompare(b.file))) {
    sourceHash.update(entry.file);
    sourceHash.update('\0');
    sourceHash.update(entry.text);
    sourceHash.update('\0');
  }

  const triggerCounts = {};
  for (const w of workflows) {
    for (const trigger of w.triggers) triggerCounts[trigger] = (triggerCounts[trigger] || 0) + 1;
  }

  const repositoryWriters = workflows.filter(w => w.repositoryWriterCapable);
  const workflowControllers = workflows.filter(w => w.workflowControlCapable);
  const privileged = workflows.filter(w => w.privilegedWorkflow);
  const summary = {
    workflowCount: workflows.length,
    repositoryWriterCount: repositoryWriters.length,
    repositoryWriterWithoutConcurrencyCount: repositoryWriters.filter(w => !w.hasConcurrency).length,
    workflowControlCount: workflowControllers.length,
    workflowControlWithoutConcurrencyCount: workflowControllers.filter(w => !w.hasConcurrency).length,
    otherWritePermissionWorkflowCount: workflows.filter(w => w.otherWritePermission).length,
    privilegedWorkflowCount: privileged.length,
    contentsWriteCount: workflows.filter(w => w.contentsWrite).length,
    actionsWriteCount: workflows.filter(w => w.actionsWrite).length,
    scheduledCount: workflows.filter(w => w.schedules.length).length,
    workflowRunConsumerCount: workflows.filter(w => w.workflowRunSources.length).length,
    dispatchingWorkflowCount: workflows.filter(w => w.dispatchTargets.length).length,
    broadGitAddCount: workflows.filter(w => w.broadGitAdd).length,
    duplicateCandidateWriterPathCount: duplicates.length,
    resolvedEdgeCount: graph.edges.length,
    unresolvedEdgeCount: graph.unresolved.length,
    cycleCount: cycles.length,
    findingCount: findings.length,
    triggerCounts: Object.fromEntries(Object.entries(triggerCounts).sort(([a], [b]) => a.localeCompare(b)))
  };

  return {
    version: policy.version,
    mode: policy.mode,
    source: { directory: WORKFLOW_DIR, sha256: sourceHash.digest('hex') },
    authority: policy.authority,
    epistemics: {
      topology: 'MEASURED_FROM_WORKFLOW_SOURCE',
      repositoryWriterClassification: 'MEASURED_FROM_CONTENTS_PERMISSION_OR_REPOSITORY_MUTATION_SIGNAL',
      workflowControlClassification: 'MEASURED_FROM_ACTIONS_PERMISSION_OR_DISPATCH_SIGNAL',
      otherWritePermissionClassification: 'SEPARATE_NOT_REPOSITORY_WRITER_BY_ITSELF',
      candidateWriterPaths: 'HEURISTIC',
      unresolvedEdgeMeansUnknown: true,
      observedDebtIsNotAutomaticallyFailureInV01: true
    },
    summary,
    graph: { ...graph, cycles },
    duplicateCandidateWriters: duplicates,
    findings: findings.sort((a, b) => `${a.severity}|${a.id}|${a.workflow}|${a.detail}`.localeCompare(`${b.severity}|${b.id}|${b.workflow}|${b.detail}`)),
    workflows
  };
}

function readEntries(dir = WORKFLOW_DIR) {
  const abs = path.resolve(ROOT, dir);
  return fs.readdirSync(abs)
    .filter(name => /\.ya?ml$/i.test(name))
    .sort()
    .map(name => ({ file: `${dir}/${name}`, text: fs.readFileSync(path.join(abs, name), 'utf8') }));
}

function assertAuthority(policy) {
  const a = policy.authority || {};
  const required = {
    readOnly: true,
    executionAuthority: 'none',
    repositoryMutationAuthority: false,
    workflowDispatchAuthority: false,
    capitalExecution: false,
    walletAuthority: false,
    methodologyMutationAuthority: false
  };
  for (const [key, expected] of Object.entries(required)) {
    if (a[key] !== expected) throw new Error(`control-plane authority boundary failed: ${key}`);
  }
}

function main() {
  const json = process.argv.includes('--json');
  const policy = JSON.parse(fs.readFileSync(path.resolve(ROOT, DEFAULT_POLICY), 'utf8'));
  assertAuthority(policy);
  const report = buildControlPlane({ entries: readEntries(), policy });
  if (json) console.log(JSON.stringify(report, null, 2));
  else {
    console.log(`Workflow Control Plane ${report.version} · ${report.mode}`);
    console.log(JSON.stringify(report.summary, null, 2));
    if (report.graph.cycles.length) console.log(`Cycles: ${report.graph.cycles.join(' | ')}`);
    console.log('Workflow Control Plane audit PASS (observation mode)');
  }
}

const invoked = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) main();

export { scanWorkflowText, detectCycles, duplicateWriterCandidates };
