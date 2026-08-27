#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const CONTRACT_FILE = path.join(ROOT, 'reporting', 'reporting-scheduler-contract.json');
const WORKFLOW_FILE = path.join(ROOT, '.github', 'workflows', 'update-reporting.yml');
const ENGINE_FILE = path.join(ROOT, 'reporting', 'reporting-engine.mjs');

function resolveReportingDataFile() {
  const configured = process.env.REPORTING_DATA_FILE || './reporting/reporting-data.json';
  return path.isAbsolute(configured) ? configured : path.resolve(ROOT, configured);
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, 'utf8'));
}

function parseUtcLabel(label) {
  const m = /^(\d{2}):(\d{2}) UTC$/.exec(String(label || ''));
  if (!m) throw new Error(`invalid UTC time label: ${label}`);
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (hour > 23 || minute > 59) throw new Error(`invalid UTC time label: ${label}`);
  return hour * 60 + minute;
}

function assertSchedulerContract(contract, workflowText) {
  if (contract?.version !== '0.1-reporting-scheduler-contract') throw new Error('unexpected Reporting scheduler contract version');
  if (contract?.status !== 'production') throw new Error('Reporting scheduler contract is not production');
  if (contract?.timezone !== 'UTC') throw new Error('Reporting scheduler timezone must remain UTC');

  const cronMatch = /^(\d{1,2}) (\d{1,2}) \* \* \*$/.exec(String(contract?.cron || ''));
  if (!cronMatch) throw new Error(`unsupported Reporting cron: ${contract?.cron}`);
  const minute = Number(cronMatch[1]);
  const hour = Number(cronMatch[2]);
  if (minute > 59 || hour > 23) throw new Error(`invalid Reporting cron: ${contract.cron}`);
  const derivedLabel = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')} UTC`;
  if (contract.dailySnapshotUtc !== derivedLabel) {
    throw new Error(`Reporting scheduler label drift: cron=${derivedLabel} contract=${contract.dailySnapshotUtc}`);
  }

  const expectedCronLine = `- cron: '${contract.cron}'`;
  const cronOccurrences = workflowText.split(expectedCronLine).length - 1;
  if (cronOccurrences !== 1) {
    throw new Error(`Reporting workflow/contract cron drift: expected exactly one ${expectedCronLine}`);
  }
  if (!/group:\s*reporting-daily/.test(workflowText) || !/cancel-in-progress:\s*false/.test(workflowText)) {
    throw new Error('Reporting writer concurrency contract drift');
  }

  const snapshotMinute = parseUtcLabel(contract.dailySnapshotUtc);
  const upstreams = Array.isArray(contract.upstreamSequence) ? contract.upstreamSequence : [];
  if (upstreams.length < 1) throw new Error('Reporting scheduler upstream sequence missing');
  for (const upstream of upstreams) {
    if (!upstream?.workflow) throw new Error('Reporting scheduler upstream workflow missing');
    if (parseUtcLabel(upstream.nominalUtc) >= snapshotMinute) {
      throw new Error(`Reporting snapshot must remain after upstream ${upstream.workflow}`);
    }
  }

  for (const key of ['repositoryMutationAuthority', 'workflowDispatchAuthority', 'capitalExecution', 'walletAuthority', 'methodologyMutationAuthority']) {
    if (contract?.authority?.[key] !== false) throw new Error(`Reporting scheduler authority expansion: ${key}`);
  }
  if (contract?.epistemics?.naturalScheduleProofRequired !== true || contract?.epistemics?.manualDispatchDoesNotProveSchedulerHealth !== true || contract?.epistemics?.unknownIsNotZero !== true) {
    throw new Error('Reporting scheduler epistemic contract drift');
  }

  return { version: contract.version, cron: contract.cron, dailySnapshotUtc: contract.dailySnapshotUtc };
}

async function loadAndValidateContract() {
  const [contract, workflowText] = await Promise.all([
    readJson(CONTRACT_FILE),
    fs.readFile(WORKFLOW_FILE, 'utf8')
  ]);
  return { contract, proof: assertSchedulerContract(contract, workflowText) };
}

async function main() {
  const { contract, proof } = await loadAndValidateContract();
  if (process.argv.includes('--validate-contract')) {
    console.log('Reporting scheduler contract PASS', proof);
    return;
  }

  execFileSync(process.execPath, [ENGINE_FILE], {
    cwd: ROOT,
    stdio: 'inherit',
    env: process.env
  });

  const reportingFile = resolveReportingDataFile();
  const reporting = await readJson(reportingFile);
  if (!reporting?.schedule || typeof reporting.schedule !== 'object') throw new Error('Reporting output schedule metadata missing');
  reporting.schedule = {
    ...reporting.schedule,
    dailySnapshot: contract.dailySnapshotUtc,
    cron: contract.cron,
    contractVersion: contract.version,
    contractSource: 'reporting/reporting-scheduler-contract.json'
  };
  await fs.writeFile(reportingFile, JSON.stringify(reporting, null, 2) + '\n');
  console.log('Reporting scheduler metadata bound to contract', proof);
}

export { assertSchedulerContract };

main().catch(err => {
  console.error('Reporting scheduled runner failed:', err?.stack || err);
  process.exit(1);
});
