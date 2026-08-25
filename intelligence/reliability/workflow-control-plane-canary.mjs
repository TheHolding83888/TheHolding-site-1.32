#!/usr/bin/env node
import { buildControlPlane } from './workflow-control-plane.mjs';

const policy = {
  version: '0.1-workflow-control-plane-canary',
  mode: 'observe-then-tighten',
  authority: {
    readOnly: true,
    executionAuthority: 'none',
    repositoryMutationAuthority: false,
    workflowDispatchAuthority: false,
    capitalExecution: false,
    walletAuthority: false,
    methodologyMutationAuthority: false
  }
};

const entries = [
  {
    file: '.github/workflows/reader.yml',
    text: `name: Reader\non:\n  pull_request:\npermissions:\n  contents: read\nconcurrency:\n  group: reader\njobs:\n  read:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo ok\n`
  },
  {
    file: '.github/workflows/copilot-shadow.yml',
    text: `name: Copilot Shadow\non: workflow_dispatch\npermissions:\n  contents: read\njobs:\n  shadow:\n    runs-on: ubuntu-latest\n    permissions:\n      contents: read\n      copilot-requests: write\n    steps:\n      - run: echo model-shadow\n`
  },
  {
    file: '.github/workflows/writer.yml',
    text: `name: Writer\non:\n  push:\npermissions:\n  contents: write\njobs:\n  write:\n    runs-on: ubuntu-latest\n    steps:\n      - run: |\n          git add generated/shared.json\n          git commit -m update\n          git push\n`
  },
  {
    file: '.github/workflows/second-writer.yml',
    text: `name: Second Writer\non: workflow_dispatch\npermissions:\n  contents: write\nconcurrency: second-writer\njobs:\n  write:\n    runs-on: ubuntu-latest\n    steps:\n      - run: git add generated/shared.json\n`
  },
  {
    file: '.github/workflows/downstream.yml',
    text: `name: Downstream\non:\n  workflow_run:\n    workflows:\n      - "Writer"\n    types:\n      - completed\npermissions:\n  contents: read\njobs:\n  read:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo downstream\n`
  },
  {
    file: '.github/workflows/dispatcher.yml',
    text: `name: Dispatcher\non: workflow_dispatch\npermissions:\n  contents: read\n  actions: write\nconcurrency: dispatcher\njobs:\n  dispatch:\n    runs-on: ubuntu-latest\n    steps:\n      - run: gh workflow run downstream.yml\n`
  },
  {
    file: '.github/workflows/cycle-a.yml',
    text: `name: Cycle A\non: workflow_dispatch\npermissions:\n  actions: write\nconcurrency: cycle-a\njobs:\n  x:\n    runs-on: ubuntu-latest\n    steps:\n      - run: gh workflow run cycle-b.yml\n`
  },
  {
    file: '.github/workflows/cycle-b.yml',
    text: `name: Cycle B\non: workflow_dispatch\npermissions:\n  actions: write\nconcurrency: cycle-b\njobs:\n  x:\n    runs-on: ubuntu-latest\n    steps:\n      - run: gh workflow run cycle-a.yml\n`
  }
];

const report = buildControlPlane({ entries, policy });
const writer = report.workflows.find(w => w.id === 'writer');
if (!writer?.repositoryWriterCapable || writer.hasConcurrency) throw new Error('repository writer classification canary failed');
if (!report.findings.some(f => f.id === 'repository-writer-without-concurrency' && f.workflow === 'writer')) throw new Error('repository writer concurrency canary failed');
if (!report.graph.edges.some(e => e.from === 'writer' && e.to === 'downstream' && e.type === 'workflow_run')) throw new Error('workflow_run edge canary failed');
if (report.graph.unresolved.some(e => e.from === 'completed')) throw new Error('workflow_run types leaked into source graph');
if (!report.graph.edges.some(e => e.from === 'dispatcher' && e.to === 'downstream' && e.type === 'workflow-dispatch')) throw new Error('dispatch edge canary failed');
if (!report.duplicateCandidateWriters.some(x => x.candidatePath === 'generated/shared.json' && x.workflows.length === 2)) throw new Error('duplicate writer canary failed');
if (!report.graph.cycles.some(c => c.includes('cycle-a') && c.includes('cycle-b'))) throw new Error('cycle detection canary failed');

const reader = report.workflows.find(w => w.id === 'reader');
if (!reader || reader.repositoryWriterCapable || reader.workflowControlCapable || reader.privilegedWorkflow) throw new Error('read-only negative canary failed');

const copilot = report.workflows.find(w => w.id === 'copilot-shadow');
if (!copilot?.otherWritePermission || copilot.repositoryWriterCapable || copilot.workflowControlCapable) throw new Error('other write-permission taxonomy canary failed');
if (report.findings.some(f => f.workflow === 'copilot-shadow' && /without-concurrency/.test(f.id))) throw new Error('other write permission incorrectly requires orchestration concurrency');

console.log('Workflow Control Plane Canary PASS (repo-writer / control / workflow_run field scope / duplicate-writer / cycle / read-only / other-write-permission)');
