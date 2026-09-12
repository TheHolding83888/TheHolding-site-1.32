import fs from 'node:fs';

const workflowPath = '.github/workflows/market-data-refresh.yml';
const dailyWorkflowPath = '.github/workflows/market-data-coingecko-daily.yml';
const contractPath = 'intelligence/market-data/market-data-scheduler-contract.json';
const workflow = fs.readFileSync(workflowPath, 'utf8');
const daily = fs.readFileSync(dailyWorkflowPath, 'utf8');
const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));

function requireCondition(ok, message) {
  if (!ok) throw new Error(message);
}
function count(text, token) {
  return text.split(token).length - 1;
}

requireCondition(contract.version === '0.4-validated-snapshot-publish', 'Market Data scheduler contract version drift');
requireCondition(contract.status === 'production', 'Market Data scheduler contract must be production');
requireCondition(contract.cron === '7,37 * * * *', 'Primary Shared Market Data cron drift');
requireCondition(contract.recoveryCron === '22,52 * * * *', 'Shared Market Data recovery cron drift');
requireCondition(Number(contract.cadenceMinutes) === 30, 'Shared Market Data materialization target must remain 30 minutes');
requireCondition(Number(contract.schedulerAttemptCadenceMinutes) === 15, 'Combined Shared Market Data attempt cadence must remain 15 minutes');
requireCondition(Number(contract.scheduledRefreshAdmissionAgeMinutes) === 25, 'Shared Market Data freshness admission threshold drift');

const cg = contract.dailyCoinGeckoSourceLane;
requireCondition(cg?.workflow === 'The Holding Market Data · Daily CoinGecko Baseline', 'CoinGecko source-lane workflow identity drift');
requireCondition(cg?.canonicalCron === '12 3 * * *', 'CoinGecko primary cron drift');
requireCondition(cg?.recoveryCron === '12 7,11,15,19,23 * * *', 'CoinGecko recovery cron drift');
requireCondition(Number(cg?.schedulerAttemptCadenceMinutes) === 240, 'CoinGecko scheduled attempt spacing drift');
requireCondition(Number(cg?.scheduledRefreshAdmissionAgeMinutes) === 960, 'CoinGecko freshness admission threshold drift');
requireCondition(Number(cg?.plannedMaxAgeAtNextDueSlotMinutes) === 1200, 'CoinGecko planned due-slot maximum age drift');
requireCondition(Number(cg?.fallbackMaxAgeHours) === 30, 'CoinGecko fallback age boundary drift');
requireCondition(Number(cg?.plannedSchedulerDeliverySafetyMarginMinutes) === 600, 'CoinGecko delivery safety margin drift');
requireCondition(cg?.sourceLaneOutput === 'intelligence/market-data/market-data-coingecko.json', 'CoinGecko source-lane output drift');
for (const [key, expected] of Object.entries({
  sameWriterRecoverySchedule: true,
  singleCanonicalWriter: true,
  secondWriter: false,
  freshRecoverySlotsSuppressed: true,
  nonScheduleDefinitionChangesAlwaysAdmitted: true,
  externalRequestOccursOnlyWhenAdmitted: true,
  onchainPrimaryAuthorityUnchanged: true,
})) requireCondition(cg?.[key] === expected, `CoinGecko resilience contract drift: ${key}`);
const fallbackMinutes = Number(cg.fallbackMaxAgeHours) * 60;
requireCondition(Number(cg.plannedMaxAgeAtNextDueSlotMinutes) === Number(cg.scheduledRefreshAdmissionAgeMinutes) + Number(cg.schedulerAttemptCadenceMinutes), 'CoinGecko due-slot age arithmetic drift');
requireCondition(fallbackMinutes - Number(cg.plannedMaxAgeAtNextDueSlotMinutes) === Number(cg.plannedSchedulerDeliverySafetyMarginMinutes), 'CoinGecko stale-boundary safety margin arithmetic drift');
requireCondition(Number(cg.plannedSchedulerDeliverySafetyMarginMinutes) >= 480, 'CoinGecko recovery schedule leaves insufficient scheduler-delay margin');

for (const [key, expected] of Object.entries({
  primaryThirtyMinuteHeartbeatPreserved: true,
  sameWorkflowRecoverySchedule: true,
  singleCanonicalWriter: true,
  secondWriter: false,
  externalWatchdogDispatch: false,
  scheduledAttemptSkipsWhenSnapshotFresh: true,
  nonScheduleEventsAlwaysAdmitted: true,
  validatedSnapshotPreservedAcrossUnrelatedRebase: true,
  liveRpcRecomputeAfterUnrelatedRebase: false,
  candidateSupersededWhenMarketInputsChangeAfterValidation: true,
  publishRetryRevalidatesMainInputBoundary: true,
})) requireCondition(contract.deliveryResilience?.[key] === expected, `Shared Market Data resilience contract drift: ${key}`);

requireCondition(contract.separationOfConcerns?.dailyCoinGeckoBaselineIsSeparate === true, 'Daily CoinGecko source-lane separation missing');
requireCondition(contract.separationOfConcerns?.sharedRefreshMayReuseDailyCoinGeckoWithoutExternalRequest === true, 'Shared Refresh CoinGecko reuse boundary missing');
requireCondition(contract.separationOfConcerns?.onchainObservationRunsEveryAdmittedSharedRefresh === true, 'Onchain observation cadence boundary missing');
requireCondition(contract.separationOfConcerns?.marketDataWriterDoesNotWritePublicCapitalState === true, 'Market Data/Public Capital writer separation missing');
requireCondition(contract.separationOfConcerns?.marketDataWorkflowCompletionObservedByUnifiedCapital === true, 'Market Data workflow completion handoff missing');
requireCondition(contract.separationOfConcerns?.marketDataNoopCompletionSuppressedByGenerationParity === true, 'Market Data no-op completion suppression missing');
requireCondition(contract.separationOfConcerns?.capitalStateRebuiltBeforePublicCapital === true, 'Capital State -> Public Capital order missing');
requireCondition(contract.separationOfConcerns?.reverseCapitalStateWakeRemoved === true, 'reverse Capital State -> Market Data wake must remain removed');
requireCondition(contract.separationOfConcerns?.publicCapitalMaterializationOwner === 'The Holding Capital · Unified Refresh', 'Public Capital materialization owner drift');

for (const [key, expected] of Object.entries({
  naturalScheduleProofRequired: true,
  pushOrManualRunDoesNotProveSchedulerHealth: true,
  schedulerAttemptDoesNotEqualMaterialization: true,
  validatedSnapshotDoesNotBecomeInvalidBecauseUnrelatedRepositoryFilesChanged: true,
  marketInputChangeInvalidatesPreChangeCandidate: true,
  unknownIsNotZero: true,
  partialIsNotTotal: true,
  oneEconomicPositionOnce: true,
  priceSnapshotMustPrecedeCapitalValuation: true,
  generationParityDeterminesMarketDataHandoff: true,
})) requireCondition(contract.epistemics?.[key] === expected, `Market Data epistemic contract drift: ${key}`);
for (const [key, expected] of Object.entries({
  repositoryMutationAuthority: true,
  workflowDispatchAuthority: false,
  capitalExecution: false,
  walletAuthority: false,
  methodologyMutationAuthority: false,
})) requireCondition(contract.authority?.[key] === expected, `Market Data authority contract drift: ${key}`);

const proofMarker = '# holding-workflow-definition-proof: intelligence/reliability/market-data-scheduler-workflow-definition-proof.mjs';
requireCondition(workflow.includes(proofMarker), 'Shared Market Data workflow proof marker missing');
requireCondition(daily.includes(proofMarker), 'Daily CoinGecko workflow proof marker missing');

// Shared Refresh remains the sole canonical Market Data + onchain shadow writer.
requireCondition(count(workflow, `- cron: '${contract.cron}'`) === 1, 'Shared workflow primary cron multiplicity drift');
requireCondition(count(workflow, `- cron: '${contract.recoveryCron}'`) === 1, 'Shared workflow recovery cron multiplicity drift');
requireCondition(workflow.includes('workflow_dispatch:'), 'Shared manual recovery trigger missing');
requireCondition(workflow.includes('schedule:'), 'Shared natural schedule trigger missing');
for (const path of [
  "- 'intelligence/market-data/market-data-coingecko.json'",
  "- 'intelligence/market-data/market-data-scheduler-contract.json'",
  "- 'intelligence/reliability/market-data-scheduler-workflow-definition-proof.mjs'",
]) requireCondition(workflow.includes(path), `Shared Market Data push dependency missing: ${path}`);
requireCondition(workflow.includes('group: shared-market-data-refresh'), 'Shared Market Data single-flight group drift');
requireCondition(workflow.includes('cancel-in-progress: false'), 'Production Market Data runs must not cancel in progress');
requireCondition(/permissions:\s*\n\s*contents:\s*write/.test(workflow), 'Expected bounded Shared contents:write authority missing');
requireCondition(!/actions:\s*write/.test(workflow), 'Unexpected Shared actions:write authority');
requireCondition(!/id-token:\s*write/.test(workflow), 'Unexpected Shared id-token:write authority');
requireCondition(!/workflows?:\s*write/.test(workflow), 'Unexpected Shared workflow write authority');
requireCondition(workflow.includes('- name: Determine scheduled refresh admission'), 'Shared scheduled freshness admission step missing');
requireCondition(workflow.includes('id: cadence'), 'Shared scheduled freshness admission output id missing');
requireCondition(workflow.includes("ADMISSION_AGE_MINUTES: '25'"), 'Shared freshness threshold does not match contract');
requireCondition(workflow.includes('intelligence/market-data/market-data.json'), 'Shared admission canonical Market Data input missing');
requireCondition(workflow.includes('- name: Publish canonical Market Data state safely'), 'Shared bounded publish step missing');
requireCondition(!workflow.includes('node intelligence/market-data/public-capital-engine.mjs'), 'Shared Market Data must not rebuild Public Capital directly');
requireCondition(!workflow.includes('intelligence/market-data/public-capital-state.json'), 'Shared Market Data must not own Public Capital State');
requireCondition(!workflow.includes("- 'intelligence/capital-state/capital-state.json'"), 'reverse Capital State -> Market Data wake reintroduced');
const sharedDueGuard = "if: steps.cadence.outputs.due == 'true'";
requireCondition(count(workflow, sharedDueGuard) === 8, `Expected 8 Shared admitted refresh guards, found ${count(workflow, sharedDueGuard)}`);

const publishStart = workflow.indexOf('- name: Publish canonical Market Data state safely');
requireCondition(publishStart >= 0, 'Shared Market Data publish body missing');
const publish = workflow.slice(publishStart);
requireCondition(publish.includes('git add intelligence/market-data/market-data.json intelligence/market-data/onchain-price-shadow.json'), 'Shared canonical output staging drift');
requireCondition(!/git add[^\n]*market-data-coingecko\.json/.test(publish), 'Shared Refresh regained Daily CoinGecko writer authority');
requireCondition(publish.includes('validated_base="$(git rev-parse HEAD)"'), 'Shared validated base SHA missing');
requireCondition(publish.includes('market_input_paths=('), 'Shared retry input boundary missing');
requireCondition(publish.includes('changed_inputs=('), 'Shared changed-input detection missing');
requireCondition(publish.includes('git diff --name-only "$validated_base" "$latest_main" -- "${market_input_paths[@]}"'), 'Shared retry main-input comparison missing');
requireCondition(publish.includes('Validated Market Data candidate superseded by newer Market Data inputs.'), 'Shared input-change supersession missing');
requireCondition(publish.includes('Unrelated main churn detected; preserving validated Market Data snapshot through rebase.'), 'Shared unrelated-rebase preservation missing');
requireCondition(publish.includes('git rebase origin/main'), 'Shared bounded rebase retry missing');
const afterRebase = publish.slice(publish.indexOf('git rebase origin/main'));
requireCondition(!afterRebase.includes("MARKET_DATA_DAILY_REFRESH='false' node intelligence/market-data/market-data-engine.mjs"), 'Shared engine must not rerun after unrelated rebase');
requireCondition(!afterRebase.includes('node intelligence/market-data/onchain-price-resolver.mjs'), 'Shared onchain resolver must not rerun after unrelated rebase');
requireCondition(!afterRebase.includes('node intelligence/market-data/market-data-authority-materializer.mjs'), 'Shared materializer must not rerun after unrelated rebase');
for (const token of [
  'intelligence/market-data/market-data-engine.mjs',
  'intelligence/market-data/market-data-coingecko.json',
  'intelligence/market-data/market-data-authority-policy.json',
  'intelligence/market-data/market-data-authority-materializer.mjs',
  'intelligence/market-data/onchain-price-source-registry.json',
  'intelligence/market-data/onchain-price-source-registry-extensions.json',
  'intelligence/market-data/onchain-price-resolver.mjs',
  'intelligence/market-data/market-data-scheduler-contract.json',
  '.github/workflows/market-data-refresh.yml',
]) requireCondition(publish.includes(`'${token}'`), `Shared retry input boundary missing: ${token}`);

// CoinGecko recovery is multiple opportunities inside the SAME source-lane writer.
requireCondition(count(daily, `- cron: '${cg.canonicalCron}'`) === 1, 'CoinGecko primary schedule multiplicity drift');
requireCondition(count(daily, `- cron: '${cg.recoveryCron}'`) === 1, 'CoinGecko recovery schedule multiplicity drift');
requireCondition(daily.includes('workflow_dispatch:'), 'CoinGecko manual recovery trigger missing');
requireCondition(daily.includes('push:'), 'CoinGecko source-definition push recovery trigger missing');
for (const path of [
  "- 'intelligence/market-data/market-price-registry.json'",
  "- 'intelligence/market-data/market-data-engine.mjs'",
  "- 'intelligence/market-data/market-data-authority-policy.json'",
  "- 'intelligence/market-data/market-data-authority-materializer.mjs'",
  "- 'intelligence/market-data/market-data-scheduler-contract.json'",
  "- 'intelligence/reliability/market-data-scheduler-workflow-definition-proof.mjs'",
  "- '.github/workflows/market-data-coingecko-daily.yml'",
]) requireCondition(daily.includes(path), `CoinGecko definition/source push dependency missing: ${path}`);
requireCondition(!daily.includes("- 'intelligence/market-data/market-data-coingecko.json'"), 'CoinGecko output must not self-trigger source writer');
requireCondition(daily.includes('group: shared-market-data-refresh'), 'Daily and Shared writers must remain single-flight');
requireCondition(daily.includes('cancel-in-progress: false'), 'CoinGecko production runs must not cancel in progress');
requireCondition(/permissions:\s*\n\s*contents:\s*write/.test(daily), 'CoinGecko source-lane contents:write authority missing');
requireCondition(!/actions:\s*write/.test(daily), 'CoinGecko actions:write authority expanded');
requireCondition(!/id-token:\s*write/.test(daily), 'CoinGecko id-token:write authority expanded');
requireCondition(daily.includes('- name: Determine scheduled CoinGecko source admission'), 'CoinGecko freshness admission step missing');
requireCondition(daily.includes('id: cadence'), 'CoinGecko freshness admission output id missing');
requireCondition(daily.includes("ADMISSION_AGE_MINUTES: '960'"), 'CoinGecko admission threshold does not match contract');
requireCondition(daily.includes("GITHUB_EVENT_NAME: ${{ github.event_name }}"), 'CoinGecko admission must distinguish schedule from push/manual');
requireCondition(daily.includes("source.get('observedAt') or source.get('generatedAt')"), 'CoinGecko admission source timestamp hierarchy missing');
requireCondition(daily.includes('scheduled-source-still-fresh'), 'CoinGecko fresh scheduled no-op path missing');
requireCondition(daily.includes('source-freshness-unprovable-refresh-fail-closed'), 'CoinGecko unprovable freshness fail-closed refresh path missing');
const dailyDueGuard = "if: steps.cadence.outputs.due == 'true'";
requireCondition(count(daily, dailyDueGuard) === 6, `Expected 6 CoinGecko admitted refresh guards, found ${count(daily, dailyDueGuard)}`);
requireCondition(daily.includes("MARKET_DATA_DAILY_REFRESH: 'true'"), 'CoinGecko explicit external-fetch gate missing');
requireCondition(daily.includes('- name: Refresh CoinGecko baseline exactly once\n        if: steps.cadence.outputs.due == \'true\''), 'CoinGecko external fetch is not freshness-gated');
requireCondition(!daily.includes('node intelligence/market-data/onchain-price-resolver.mjs'), 'CoinGecko source lane must not perform onchain RPC observation');
requireCondition(!daily.includes('node intelligence/market-data/public-capital-engine.mjs'), 'CoinGecko source lane regained Public Capital materialization');
requireCondition(!daily.includes('intelligence/market-data/public-capital-state.json'), 'CoinGecko source lane regained Public Capital ownership');
requireCondition(daily.includes('- name: Publish daily CoinGecko source lane safely'), 'CoinGecko source-lane publish step missing');

const dailyPublishStart = daily.indexOf('- name: Publish daily CoinGecko source lane safely');
requireCondition(dailyPublishStart >= 0, 'CoinGecko publish body missing');
const dailyPublish = daily.slice(dailyPublishStart);
requireCondition(dailyPublish.includes('git checkout -- intelligence/market-data/market-data.json'), 'CoinGecko writer must discard ephemeral canonical Market Data');
requireCondition(dailyPublish.includes('git add intelligence/market-data/market-data-coingecko.json'), 'CoinGecko source-lane staging missing');
requireCondition(!/git add[^\n]*market-data\.json/.test(dailyPublish), 'CoinGecko writer regained canonical Market Data authority');
requireCondition(!/git add[^\n]*onchain-price-shadow\.json/.test(dailyPublish), 'CoinGecko writer regained onchain shadow authority');
requireCondition(dailyPublish.includes('validated_base="$(git rev-parse HEAD)"'), 'CoinGecko validated base SHA missing');
requireCondition(dailyPublish.includes('daily_input_paths=('), 'CoinGecko retry input boundary missing');
requireCondition(dailyPublish.includes("'intelligence/market-data/market-data-scheduler-contract.json'"), 'CoinGecko retry input boundary missing scheduler contract');
requireCondition(dailyPublish.includes('Validated daily CoinGecko candidate superseded by newer source-lane inputs.'), 'CoinGecko input-change supersession missing');
requireCondition(dailyPublish.includes('Unrelated main churn detected; preserving validated daily CoinGecko source snapshot through rebase.'), 'CoinGecko unrelated-rebase preservation missing');
requireCondition(dailyPublish.includes('git rebase origin/main'), 'CoinGecko bounded rebase retry missing');
const dailyAfterRebase = dailyPublish.slice(dailyPublish.indexOf('git rebase origin/main'));
requireCondition(!dailyAfterRebase.includes('market-data-engine.mjs'), 'CoinGecko external fetch must not rerun after unrelated rebase');
requireCondition(!dailyAfterRebase.includes('market-data-authority-materializer.mjs'), 'CoinGecko ephemeral materialization must not rerun after unrelated rebase');

function cronMinutes(cron) {
  return cron.split(' ')[0].split(',').map(Number).sort((a, b) => a - b);
}
const primaryMinutes = cronMinutes(contract.cron);
const recoveryMinutes = cronMinutes(contract.recoveryCron);
requireCondition(primaryMinutes.length === 2 && primaryMinutes[1] - primaryMinutes[0] === 30, 'Shared primary cron no longer expresses exact 30-minute cadence');
requireCondition(recoveryMinutes.length === 2 && recoveryMinutes[1] - recoveryMinutes[0] === 30, 'Shared recovery cron must remain a 30-minute offset schedule');
const combinedMinutes = [...primaryMinutes, ...recoveryMinutes].sort((a, b) => a - b);
const gaps = combinedMinutes.map((minute, index) => {
  const next = index === combinedMinutes.length - 1 ? combinedMinutes[0] + 60 : combinedMinutes[index + 1];
  return next - minute;
});
requireCondition(gaps.every(gap => gap === contract.schedulerAttemptCadenceMinutes), 'Shared primary/recovery schedule spacing drift');
requireCondition(contract.scheduledRefreshAdmissionAgeMinutes > contract.schedulerAttemptCadenceMinutes, 'Shared admission threshold must suppress immediate recovery slot');
requireCondition(contract.scheduledRefreshAdmissionAgeMinutes < contract.cadenceMinutes, 'Shared admission threshold must become due before target cadence');

for (const output of contract.canonicalOutputs || []) requireCondition(workflow.includes(output), `Canonical output not materialized by Shared workflow: ${output}`);
for (const output of contract.downstreamOutputs || []) requireCondition(!workflow.includes(output), `Downstream capital output must not be owned by Shared Market Data: ${output}`);

const noWalletPattern = /sendTransaction|eth_sendRawTransaction|eth_sendTransaction|\.transfer\(|\.approve\(|\.claim\(|\.vote\(/;
requireCondition(!noWalletPattern.test(workflow), 'Shared Market Data contains wallet/capital transaction behavior');
requireCondition(!noWalletPattern.test(daily), 'CoinGecko source lane contains wallet/capital transaction behavior');

console.log('Market Data single-owner writer chain definition PASS', {
  sharedPrimaryCron: contract.cron,
  sharedRecoveryCron: contract.recoveryCron,
  sharedTargetCadenceMinutes: contract.cadenceMinutes,
  sharedSchedulerAttemptCadenceMinutes: contract.schedulerAttemptCadenceMinutes,
  sharedAdmissionAgeMinutes: contract.scheduledRefreshAdmissionAgeMinutes,
  coinGeckoPrimaryCron: cg.canonicalCron,
  coinGeckoRecoveryCron: cg.recoveryCron,
  coinGeckoAttemptCadenceMinutes: cg.schedulerAttemptCadenceMinutes,
  coinGeckoAdmissionAgeMinutes: cg.scheduledRefreshAdmissionAgeMinutes,
  coinGeckoPlannedMaxAgeAtDueSlotMinutes: cg.plannedMaxAgeAtNextDueSlotMinutes,
  coinGeckoFallbackMaxAgeHours: cg.fallbackMaxAgeHours,
  coinGeckoSchedulerDeliverySafetyMarginMinutes: cg.plannedSchedulerDeliverySafetyMarginMinutes,
  dailyBaselineWriter: 'The Holding Market Data · Daily CoinGecko Baseline',
  canonicalMarketDataWriter: 'The Holding Market Data · Shared Refresh',
  publicCapitalWriter: contract.separationOfConcerns.publicCapitalMaterializationOwner,
  duplicateWriterAuthority: false,
  executionAuthority: 'none',
});
