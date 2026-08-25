#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = process.cwd();
const WORKFLOW_DIR = '.github/workflows';
const DEFAULT_POLICY = 'intelligence/reliability/workflow-fanout-policy.json';

function clean(value) {
  return String(value ?? '').trim().replace(/^['"]|['"]$/g, '');
}

function indent(line) {
  return (line.match(/^\s*/) || [''])[0].length;
}

function inlineList(value) {
  const raw = clean(value);
  if (!raw.startsWith('[') || !raw.endsWith(']')) return [];
  return raw.slice(1, -1).split(',').map(clean).filter(Boolean);
}

function collectBlock(lines, startIndex) {
  const parent = indent(lines[startIndex]);
  const block = [];
  for (let i = startIndex + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line.trim() || line.trim().startsWith('#')) {
      block.push(line);
      continue;
    }
    if (indent(line) <= parent) break;
    block.push(line);
  }
  return block;
}

function parseListField(block, field) {
  const out = [];
  let active = false;
  let fieldIndent = null;
  for (const line of block) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const m = line.match(/^(\s*)([A-Za-z0-9_-]+):(?:\s*(.*))?$/);
    if (m) {
      const key = m[2];
      if (key === field) {
        active = true;
        fieldIndent = m[1].length;
        const vals = inlineList(m[3] || '');
        if (vals.length) out.push(...vals);
        else if (clean(m[3] || '')) out.push(clean(m[3]));
        continue;
      }
      if (active && m[1].length <= fieldIndent) active = false;
    }
    if (active) {
      const item = line.match(/^\s*-\s*['"]?(.+?)['"]?\s*$/);
      if (item) out.push(clean(item[1]));
    }
  }
  return [...new Set(out)];
}

export function parsePullRequestTrigger(text) {
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const on = lines[i].match(/^on:\s*(.*?)\s*$/);
    if (!on) continue;
    const inline = clean(on[1]);
    if (inline) {
      const values = inlineList(inline);
      const triggers = values.length ? values : [inline];
      return triggers.includes('pull_request')
        ? { enabled: true, paths: [], pathsIgnore: [], unbounded: true, source: 'inline-on' }
        : { enabled: false, paths: [], pathsIgnore: [], unbounded: false, source: 'inline-on' };
    }

    const onBlock = collectBlock(lines, i);
    for (let j = 0; j < onBlock.length; j += 1) {
      const top = onBlock[j].match(/^\s{2}pull_request:(?:\s*(.*))?$/);
      if (!top) continue;
      const suffix = clean(top[1] || '');
      if (suffix && suffix !== '{}') {
        return { enabled: true, paths: [], pathsIgnore: [], unbounded: true, source: 'pull-request-inline' };
      }
      const pullBlock = collectBlock(onBlock, j);
      const paths = parseListField(pullBlock, 'paths');
      const pathsIgnore = parseListField(pullBlock, 'paths-ignore');
      return {
        enabled: true,
        paths,
        pathsIgnore,
        unbounded: paths.length === 0 && pathsIgnore.length === 0,
        source: 'pull-request-block'
      };
    }
    return { enabled: false, paths: [], pathsIgnore: [], unbounded: false, source: 'on-block' };
  }
  return { enabled: false, paths: [], pathsIgnore: [], unbounded: false, source: 'missing-on' };
}

function globRegex(patternRaw) {
  let pattern = clean(patternRaw);
  const negative = pattern.startsWith('!');
  if (negative) pattern = pattern.slice(1);
  let out = '^';
  for (let i = 0; i < pattern.length; i += 1) {
    const ch = pattern[i];
    if (ch === '*') {
      if (pattern[i + 1] === '*') {
        while (pattern[i + 1] === '*') i += 1;
        if (pattern[i + 1] === '/') {
          i += 1;
          out += '(?:.*/)?';
        } else out += '.*';
      } else out += '[^/]*';
      continue;
    }
    if (ch === '?') {
      out += '[^/]';
      continue;
    }
    if ('\\.^$+{}()|[]'.includes(ch)) out += `\\${ch}`;
    else out += ch;
  }
  out += '$';
  return { negative, regex: new RegExp(out) };
}

function matchesPaths(file, patterns) {
  let included = false;
  for (const raw of patterns) {
    const { negative, regex } = globRegex(raw);
    if (!regex.test(file)) continue;
    included = !negative;
  }
  return included;
}

function ignoredBy(file, patterns) {
  return patterns.some(raw => globRegex(raw).regex.test(file));
}

export function wakesForChangedFiles(trigger, changedFiles) {
  if (!trigger.enabled || changedFiles.length === 0) return false;
  if (trigger.paths.length) return changedFiles.some(file => matchesPaths(file, trigger.paths));
  if (trigger.pathsIgnore.length) return changedFiles.some(file => !ignoredBy(file, trigger.pathsIgnore));
  return true;
}

function nameFromText(text, fallback) {
  return clean(text.match(/^name:\s*(.+?)\s*$/m)?.[1] || fallback);
}

export function auditFanout(entries, policy) {
  const workflowFiles = entries.map(e => e.file).sort();
  const protectedIds = new Set(policy.protectedWorkflowChangeChecks || []);
  const workflows = entries.map(entry => {
    const id = path.basename(entry.file).replace(/\.ya?ml$/i, '');
    const trigger = parsePullRequestTrigger(entry.text);
    const selfDefinitionWake = wakesForChangedFiles(trigger, [entry.file]);
    const workflowFleetWake = wakesForChangedFiles(trigger, workflowFiles);
    let wakeClass = 'none';
    if (workflowFleetWake) {
      if (protectedIds.has(id)) wakeClass = 'protected-global-check';
      else if (trigger.unbounded) wakeClass = 'unbounded-pr-candidate';
      else if (selfDefinitionWake) wakeClass = 'self-definition-candidate';
      else wakeClass = 'workflow-fleet-candidate';
    }
    return {
      id,
      name: nameFromText(entry.text, id),
      file: entry.file,
      pullRequest: trigger,
      selfDefinitionWake,
      workflowFleetWake,
      protectedWorkflowChangeCheck: protectedIds.has(id),
      wakeClass
    };
  }).sort((a, b) => a.id.localeCompare(b.id));

  const pr = workflows.filter(w => w.pullRequest.enabled);
  const selfWake = workflows.filter(w => w.selfDefinitionWake);
  const fleetWake = workflows.filter(w => w.workflowFleetWake);
  const protectedWake = fleetWake.filter(w => w.protectedWorkflowChangeCheck);
  const reducibleWake = fleetWake.filter(w => !w.protectedWorkflowChangeCheck);
  const unbounded = pr.filter(w => w.pullRequest.unbounded);
  const selfPathBounded = pr.filter(w => !w.pullRequest.unbounded && w.selfDefinitionWake);

  return {
    version: policy.version,
    mode: policy.mode,
    authority: policy.authority,
    epistemics: policy.epistemics,
    summary: {
      workflowCount: workflows.length,
      pullRequestWorkflowCount: pr.length,
      unboundedPullRequestCount: unbounded.length,
      selfDefinitionWakeCount: selfWake.length,
      boundedSelfDefinitionWakeCount: selfPathBounded.length,
      workflowFleetWakeCount: fleetWake.length,
      protectedWorkflowFleetWakeCount: protectedWake.length,
      reductionCandidateWorkflowFleetWakeCount: reducibleWake.length,
      theoreticalProtectedFloorCount: protectedWake.length
    },
    scenarios: {
      selfDefinitionChange: 'Only each workflow own YAML is considered changed for that workflow.',
      workflowFleetChange: `All ${workflowFiles.length} workflow YAML files are considered changed together; this models broad GitHub Actions dependency updates such as Dependabot action-pin refreshes.`
    },
    protectedWorkflowChangeChecks: [...protectedIds].sort(),
    reductionCandidates: reducibleWake.map(w => ({
      id: w.id,
      wakeClass: w.wakeClass,
      unbounded: w.pullRequest.unbounded,
      selfDefinitionWake: w.selfDefinitionWake,
      paths: w.pullRequest.paths,
      pathsIgnore: w.pullRequest.pathsIgnore
    })),
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
    if (policy.authority?.[key] !== value) throw new Error(`workflow fan-out authority expansion: ${key}`);
  }
}

function main() {
  const policyFile = process.argv.includes('--policy')
    ? process.argv[process.argv.indexOf('--policy') + 1]
    : DEFAULT_POLICY;
  const policy = JSON.parse(fs.readFileSync(path.resolve(ROOT, policyFile), 'utf8'));
  assertAuthority(policy);
  const report = auditFanout(readEntries(), policy);
  if (process.argv.includes('--json')) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  else {
    console.log(`Workflow Fan-out Audit ${report.version} · ${report.mode}`);
    console.log(JSON.stringify(report.summary, null, 2));
    console.log('Reduction candidates:');
    for (const item of report.reductionCandidates) {
      console.log(`${item.id}\tclass=${item.wakeClass}\tunbounded=${item.unbounded}\tself=${item.selfDefinitionWake}`);
    }
    console.log('Workflow Fan-out audit PASS');
  }
}

const invoked = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) main();

export { globRegex, readEntries };
