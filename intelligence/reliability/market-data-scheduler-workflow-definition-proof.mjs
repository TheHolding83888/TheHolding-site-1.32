import fs from 'node:fs';

const workflowPath = '.github/workflows/market-data-refresh.yml';
const contractPath = 'intelligence/market-data/market-data-scheduler-contract.json';
const workflow = fs.readFileSync(workflowPath, 'utf8');
const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));

function requireCondition(ok, message) {
  if (!ok) throw new Error(message);
}

requireCondition(contract.version === '0.1-market-data-scheduler-contract', 'Market Data scheduler contract version drift');
requireCondition(contract.status === 'production', 'Market Data scheduler contract must be production');
requireCondition(contract.cron === '7,37 * * * *', 'Unexpected Shared Market Data cron');
requireCondition(Number(contract.cadenceMinutes) === 30, 'Shared Market Data cadence must remain 30 minutes');
requireCondition(contract.epistemics?.naturalScheduleProofRequired === true, 'Natural schedule proof boundary missing');
requireCondition(contract.epistemics?.pushOrManualRunDoesNotProveSchedulerHealth === true, 'Scheduler epistemic boundary missing');
requireCondition(contract.epistemics?.unknownIsNotZero === true, 'UNKNOWN != 0 boundary missing');
requireCondition(contract.authority?.repositoryMutationAuthority === true, 'Repository writer authority missing');
requireCondition(contract.authority?.workflowDispatchAuthority === false, 'Workflow dispatch authority expanded');
requireCondition(contract.authority?.capitalExecution === false, 'Capital execution authority expanded');
requireCondition(contract.authority?.walletAuthority === false, 'Wallet authority expanded');
requireCondition(contract.authority?.methodologyMutationAuthority === false, 'Methodology mutation authority expanded');

requireCondition(workflow.includes('# holding-workflow-definition-proof: intelligence/reliability/market-data-scheduler-workflow-definition-proof.mjs'), 'Workflow proof marker missing');
requireCondition(workflow.includes(`- cron: '${contract.cron}'`), 'Workflow cron does not match scheduler contract');
requireCondition(workflow.includes('workflow_dispatch:'), 'Manual recovery trigger missing');
requireCondition(workflow.includes('schedule:'), 'Natural schedule trigger missing');
requireCondition(workflow.includes("- 'intelligence/market-data/market-data-scheduler-contract.json'"), 'Scheduler contract is not a push dependency');
requireCondition(workflow.includes("- 'intelligence/reliability/market-data-scheduler-workflow-definition-proof.mjs'"), 'Scheduler proof is not a push dependency');
requireCondition(workflow.includes('group: shared-market-data-refresh'), 'Shared Market Data single-flight group drift');
requireCondition(workflow.includes('cancel-in-progress: false'), 'Production Market Data runs must not cancel in progress');
requireCondition(/permissions:\s*\n\s*contents:\s*write/.test(workflow), 'Expected bounded contents:write authority missing');
requireCondition(!/actions:\s*write/.test(workflow), 'Unexpected actions:write authority');
requireCondition(!/id-token:\s*write/.test(workflow), 'Unexpected id-token:write authority');
requireCondition(!/workflows?:\s*write/.test(workflow), 'Unexpected workflow write authority');

const minutes = contract.cron.split(' ')[0].split(',').map(Number).sort((a, b) => a - b);
requireCondition(minutes.length === 2 && minutes[1] - minutes[0] === 30, 'Cron no longer expresses an exact 30-minute cadence');

for (const output of contract.canonicalOutputs || []) {
  requireCondition(workflow.includes(output), `Canonical output not materialized by workflow: ${output}`);
}

console.log('Shared Market Data scheduler workflow definition PASS', {
  cron: contract.cron,
  cadenceMinutes: contract.cadenceMinutes,
  naturalScheduleProofRequired: contract.epistemics.naturalScheduleProofRequired,
  workflowDispatchAuthority: contract.authority.workflowDispatchAuthority,
  capitalExecution: contract.authority.capitalExecution
});
