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

requireCondition(contract.version === '0.4-validated-snapshot-publish', 'Market Data scheduler contract version drift');
requireCondition(contract.status === 'production', 'Market Data scheduler contract must be production');
requireCondition(contract.cron === '7,37 * * * *', 'Primary Shared Market Data cron drift');
requireCondition(contract.recoveryCron === '22,52 * * * *', 'Shared Market Data recovery cron drift');
requireCondition(Number(contract.cadenceMinutes) === 30, 'Shared Market Data materialization target must remain 30 minutes');
requireCondition(Number(contract.schedulerAttemptCadenceMinutes) === 15, 'Combined Shared Market Data attempt cadence must remain 15 minutes');
requireCondition(Number(contract.scheduledRefreshAdmissionAgeMinutes) === 25, 'Shared Market Data freshness admission threshold drift');
requireCondition(contract.deliveryResilience?.primaryThirtyMinuteHeartbeatPreserved === true, 'Primary 30-minute heartbeat preservation boundary missing');
requireCondition(contract.deliveryResilience?.sameWorkflowRecoverySchedule === true, 'Same-workflow recovery schedule boundary missing');
requireCondition(contract.deliveryResilience?.singleCanonicalWriter === true, 'Single canonical Market Data writer boundary missing');
requireCondition(contract.deliveryResilience?.secondWriter === false, 'A second Market Data writer is forbidden');
requireCondition(contract.deliveryResilience?.externalWatchdogDispatch === false, 'External watchdog dispatch must remain disabled');
requireCondition(contract.deliveryResilience?.scheduledAttemptSkipsWhenSnapshotFresh === true, 'Fresh scheduled-attempt no-op boundary missing');
requireCondition(contract.deliveryResilience?.nonScheduleEventsAlwaysAdmitted === true, 'Push/manual recovery admission boundary missing');
requireCondition(contract.deliveryResilience?.validatedSnapshotPreservedAcrossUnrelatedRebase === true, 'Validated snapshot preservation boundary missing');
requireCondition(contract.deliveryResilience?.liveRpcRecomputeAfterUnrelatedRebase === false, 'Unrelated rebase must not cause a second live RPC recompute');
requireCondition(contract.deliveryResilience?.candidateSupersededWhenMarketInputsChangeAfterValidation === true, 'Post-validation Market Data input-change supersession boundary missing');
requireCondition(contract.deliveryResilience?.publishRetryRevalidatesMainInputBoundary === true, 'Publish retry must re-check the main input boundary');
requireCondition(contract.separationOfConcerns?.dailyCoinGeckoBaselineIsSeparate === true, 'Daily CoinGecko source-lane separation missing');
requireCondition(contract.epistemics?.naturalScheduleProofRequired === true, 'Natural schedule proof boundary missing');
requireCondition(contract.epistemics?.pushOrManualRunDoesNotProveSchedulerHealth === true, 'Scheduler epistemic boundary missing');
requireCondition(contract.epistemics?.schedulerAttemptDoesNotEqualMaterialization === true, 'Attempt/materialization epistemic boundary missing');
requireCondition(contract.epistemics?.validatedSnapshotDoesNotBecomeInvalidBecauseUnrelatedRepositoryFilesChanged === true, 'Validated snapshot epistemic boundary missing');
requireCondition(contract.epistemics?.marketInputChangeInvalidatesPreChangeCandidate === true, 'Market-input invalidation epistemic boundary missing');
requireCondition(contract.epistemics?.unknownIsNotZero === true, 'UNKNOWN != 0 boundary missing');
requireCondition(contract.epistemics?.priceSnapshotMustPrecedeCapitalValuation === true, 'price-before-capital epistemic boundary missing');
requireCondition(contract.epistemics?.generationParityDeterminesMarketDataHandoff === true, 'generation-parity handoff epistemic boundary missing');
requireCondition(contract.separationOfConcerns?.marketDataWriterDoesNotWritePublicCapitalState === true, 'Market Data/Public Capital writer separation missing');
requireCondition(contract.separationOfConcerns?.marketDataWorkflowCompletionObservedByUnifiedCapital === true, 'Market Data workflow completion handoff missing');
requireCondition(contract.separationOfConcerns?.marketDataNoopCompletionSuppressedByGenerationParity === true, 'Market Data no-op completion suppression missing');
requireCondition(contract.separationOfConcerns?.capitalStateRebuiltBeforePublicCapital === true, 'Capital State -> Public Capital order missing');
requireCondition(contract.separationOfConcerns?.reverseCapitalStateWakeRemoved === true, 'reverse Capital State -> Market Data wake must remain removed');
requireCondition(contract.separationOfConcerns?.publicCapitalMaterializationOwner === 'The Holding Capital · Unified Refresh', 'Public Capital materialization owner drift');
requireCondition(contract.authority?.repositoryMutationAuthority === true, 'Repository writer authority missing');
requireCondition(contract.authority?.workflowDispatchAuthority === false, 'Workflow dispatch authority expanded');
requireCondition(contract.authority?.capitalExecution === false, 'Capital execution authority expanded');
requireCondition(contract.authority?.walletAuthority === false, 'Wallet authority expanded');
requireCondition(contract.authority?.methodologyMutationAuthority === false, 'Methodology mutation authority expanded');

// Both Market Data writers are proven by this one deterministic boundary proof.
const proofMarker = '# holding-workflow-definition-proof: intelligence/reliability/market-data-scheduler-workflow-definition-proof.mjs';
requireCondition(workflow.includes(proofMarker), 'Shared Market Data workflow proof marker missing');
requireCondition(daily.includes(proofMarker), 'Daily CoinGecko workflow proof marker missing');

// Shared Refresh is the only writer for canonical Market Data + onchain shadow.
requireCondition(workflow.includes(`- cron: '${contract.cron}'`), 'Workflow primary cron does not match scheduler contract');
requireCondition(workflow.includes(`- cron: '${contract.recoveryCron}'`), 'Workflow recovery cron does not match scheduler contract');
requireCondition(workflow.includes('workflow_dispatch:'), 'Manual recovery trigger missing');
requireCondition(workflow.includes('schedule:'), 'Natural schedule trigger missing');
requireCondition(workflow.includes("- 'intelligence/market-data/market-data-coingecko.json'"), 'Daily source lane is not a Shared Refresh push dependency');
requireCondition(workflow.includes("- 'intelligence/market-data/market-data-scheduler-contract.json'"), 'Scheduler contract is not a push dependency');
requireCondition(workflow.includes("- 'intelligence/reliability/market-data-scheduler-workflow-definition-proof.mjs'"), 'Scheduler proof is not a push dependency');
requireCondition(workflow.includes('group: shared-market-data-refresh'), 'Shared Market Data single-flight group drift');
requireCondition(workflow.includes('cancel-in-progress: false'), 'Production Market Data runs must not cancel in progress');
requireCondition(/permissions:\s*\n\s*contents:\s*write/.test(workflow), 'Expected bounded contents:write authority missing');
requireCondition(!/actions:\s*write/.test(workflow), 'Unexpected actions:write authority');
requireCondition(!/id-token:\s*write/.test(workflow), 'Unexpected id-token:write authority');
requireCondition(!/workflows?:\s*write/.test(workflow), 'Unexpected workflow write authority');
requireCondition(workflow.includes('- name: Determine scheduled refresh admission'), 'Scheduled freshness admission step missing');
requireCondition(workflow.includes('id: cadence'), 'Scheduled freshness admission output id missing');
requireCondition(workflow.includes("ADMISSION_AGE_MINUTES: '25'"), 'Scheduled freshness admission threshold does not match contract');
requireCondition(workflow.includes('GITHUB_EVENT_NAME'), 'Scheduled admission must distinguish natural schedule from push/manual recovery');
requireCondition(workflow.includes('intelligence/market-data/market-data.json'), 'Scheduled admission canonical Market Data input missing');
requireCondition(workflow.includes('- name: Publish canonical Market Data state safely'), 'bounded canonical Market Data publish step missing');
requireCondition(!workflow.includes('node intelligence/market-data/public-capital-engine.mjs'), 'Market Data workflow must not rebuild Public Capital directly');
requireCondition(!workflow.includes('intelligence/market-data/public-capital-state.json'), 'Market Data workflow must not own or stage Public Capital State');
requireCondition(!workflow.includes("- 'intelligence/capital-state/capital-state.json'"), 'reverse Capital State -> Market Data wake reintroduced');

const publishStart = workflow.indexOf('- name: Publish canonical Market Data state safely');
requireCondition(publishStart >= 0, 'Market Data publish step body missing');
const publish = workflow.slice(publishStart);
requireCondition(publish.includes('git add intelligence/market-data/market-data.json intelligence/market-data/onchain-price-shadow.json'), 'Shared Refresh canonical output staging drift');
requireCondition(!/git add[^\n]*market-data-coingecko\.json/.test(publish), 'Shared Refresh regained Daily CoinGecko source-lane writer authority');
requireCondition(publish.includes('validated_base="$(git rev-parse HEAD)"'), 'Validated base SHA is not captured before publish');
requireCondition(publish.includes('market_input_paths=('), 'Market Data retry input boundary missing');
requireCondition(publish.includes('changed_inputs=('), 'Market Data retry changed-input detection missing');
requireCondition(publish.includes('git diff --name-only "$validated_base" "$latest_main" -- "${market_input_paths[@]}"'), 'Market Data retry does not compare validated base with latest main input boundary');
requireCondition(publish.includes('Validated Market Data candidate superseded by newer Market Data inputs.'), 'Input-change supersession path missing');
requireCondition(publish.includes('Unrelated main churn detected; preserving validated Market Data snapshot through rebase.'), 'Validated snapshot unrelated-rebase preservation path missing');
requireCondition(publish.includes('git rebase origin/main'), 'Bounded rebase retry missing');
const rebaseIndex = publish.indexOf('git rebase origin/main');
const afterRebase = publish.slice(rebaseIndex);
requireCondition(!afterRebase.includes("MARKET_DATA_DAILY_REFRESH='false' node intelligence/market-data/market-data-engine.mjs"), 'Market Data engine must not rerun after unrelated rebase');
requireCondition(!afterRebase.includes('node intelligence/market-data/onchain-price-resolver.mjs'), 'Live onchain resolver must not rerun after unrelated rebase');
requireCondition(!afterRebase.includes('node intelligence/market-data/market-data-authority-materializer.mjs'), 'Authority materializer must not rerun after unrelated rebase');
for (const token of [
  'intelligence/market-data/market-data-engine.mjs',
  'intelligence/market-data/market-data-coingecko.json',
  'intelligence/market-data/market-data-authority-policy.json',
  'intelligence/market-data/market-data-authority-materializer.mjs',
  'intelligence/market-data/onchain-price-source-registry.json',
  'intelligence/market-data/onchain-price-source-registry-extensions.json',
  'intelligence/market-data/onchain-price-resolver.mjs',
  'intelligence/market-data/market-data-scheduler-contract.json',
  '.github/workflows/market-data-refresh.yml'
]) requireCondition(publish.includes(`'${token}'`), `Market Data retry input boundary missing: ${token}`);

// Daily CoinGecko owns only the external source-lane snapshot. It may validate
// canonical authority ephemerally, but it cannot publish canonical/public state.
requireCondition(daily.includes("cron: '12 3 * * *'"), 'Daily CoinGecko schedule drift');
requireCondition(daily.includes('workflow_dispatch:'), 'Daily CoinGecko manual recovery trigger missing');
requireCondition(daily.includes('group: shared-market-data-refresh'), 'Daily and Shared Market Data writers must remain single-flight');
requireCondition(/permissions:\s*\n\s*contents:\s*write/.test(daily), 'Daily source-lane repository writer authority missing');
requireCondition(!/actions:\s*write/.test(daily), 'Daily workflow actions:write authority expanded');
requireCondition(!/id-token:\s*write/.test(daily), 'Daily workflow id-token:write authority expanded');
requireCondition(daily.includes("MARKET_DATA_DAILY_REFRESH: 'true'"), 'Daily external source-lane gate missing');
requireCondition(!daily.includes('node intelligence/market-data/onchain-price-resolver.mjs'), 'Daily CoinGecko workflow must not perform onchain RPC observation');
requireCondition(!daily.includes('node intelligence/market-data/public-capital-engine.mjs'), 'Daily CoinGecko workflow regained Public Capital materialization');
requireCondition(!daily.includes('intelligence/market-data/public-capital-state.json'), 'Daily CoinGecko workflow regained Public Capital ownership');
requireCondition(daily.includes('- name: Publish daily CoinGecko source lane safely'), 'Daily source-lane publish step missing');
const dailyPublishStart = daily.indexOf('- name: Publish daily CoinGecko source lane safely');
const dailyPublish = daily.slice(dailyPublishStart);
requireCondition(dailyPublish.includes('git checkout -- intelligence/market-data/market-data.json'), 'Daily workflow must discard ephemeral canonical Market Data before publication');
requireCondition(dailyPublish.includes('git add intelligence/market-data/market-data-coingecko.json'), 'Daily source-lane staging missing');
requireCondition(!/git add[^\n]*market-data\.json/.test(dailyPublish), 'Daily workflow regained canonical Market Data writer authority');
requireCondition(!/git add[^\n]*onchain-price-shadow\.json/.test(dailyPublish), 'Daily workflow regained onchain shadow writer authority');
requireCondition(dailyPublish.includes('validated_base="$(git rev-parse HEAD)"'), 'Daily validated base SHA missing');
requireCondition(dailyPublish.includes('daily_input_paths=('), 'Daily source-lane retry input boundary missing');
requireCondition(dailyPublish.includes('Validated daily CoinGecko candidate superseded by newer source-lane inputs.'), 'Daily input-change supersession path missing');
requireCondition(dailyPublish.includes('Unrelated main churn detected; preserving validated daily CoinGecko source snapshot through rebase.'), 'Daily unrelated-rebase preservation path missing');
requireCondition(dailyPublish.includes('git rebase origin/main'), 'Daily bounded rebase retry missing');
const dailyRebaseIndex = dailyPublish.indexOf('git rebase origin/main');
const dailyAfterRebase = dailyPublish.slice(dailyRebaseIndex);
requireCondition(!dailyAfterRebase.includes('market-data-engine.mjs'), 'Daily external source fetch must not rerun after unrelated rebase');
requireCondition(!dailyAfterRebase.includes('market-data-authority-materializer.mjs'), 'Daily ephemeral authority materialization must not rerun after unrelated rebase');

const dueGuard = "if: steps.cadence.outputs.due == 'true'";
const dueGuardCount = workflow.split(dueGuard).length - 1;
requireCondition(dueGuardCount === 8, `Expected 8 admitted refresh guards, found ${dueGuardCount}`);

function cronMinutes(cron) {
  return cron.split(' ')[0].split(',').map(Number).sort((a, b) => a - b);
}
const primaryMinutes = cronMinutes(contract.cron);
const recoveryMinutes = cronMinutes(contract.recoveryCron);
requireCondition(primaryMinutes.length === 2 && primaryMinutes[1] - primaryMinutes[0] === 30, 'Primary cron no longer expresses an exact 30-minute cadence');
requireCondition(recoveryMinutes.length === 2 && recoveryMinutes[1] - recoveryMinutes[0] === 30, 'Recovery cron must remain a 30-minute offset schedule');
const combinedMinutes = [...primaryMinutes, ...recoveryMinutes].sort((a, b) => a - b);
const gaps = combinedMinutes.map((minute, index) => {
  const next = index === combinedMinutes.length - 1 ? combinedMinutes[0] + 60 : combinedMinutes[index + 1];
  return next - minute;
});
requireCondition(gaps.every(gap => gap === contract.schedulerAttemptCadenceMinutes), 'Combined primary/recovery schedule spacing drift');
requireCondition(contract.scheduledRefreshAdmissionAgeMinutes > contract.schedulerAttemptCadenceMinutes, 'Admission threshold must suppress the immediate recovery slot');
requireCondition(contract.scheduledRefreshAdmissionAgeMinutes < contract.cadenceMinutes, 'Admission threshold must become due before the target materialization cadence');

for (const output of contract.canonicalOutputs || []) {
  requireCondition(workflow.includes(output), `Canonical output not materialized by workflow: ${output}`);
}
for (const output of contract.downstreamOutputs || []) {
  requireCondition(!workflow.includes(output), `Downstream capital output must not be owned by Market Data workflow: ${output}`);
}

const noWalletPattern = /sendTransaction|eth_sendRawTransaction|eth_sendTransaction|\.transfer\(|\.approve\(|\.claim\(|\.vote\(/;
requireCondition(!noWalletPattern.test(workflow), 'Shared Market Data workflow contains wallet/capital transaction behavior');
requireCondition(!noWalletPattern.test(daily), 'Daily CoinGecko workflow contains wallet/capital transaction behavior');

console.log('Market Data single-owner writer chain definition PASS', {
  primaryCron: contract.cron,
  recoveryCron: contract.recoveryCron,
  dailyCron: '12 3 * * *',
  targetCadenceMinutes: contract.cadenceMinutes,
  schedulerAttemptCadenceMinutes: contract.schedulerAttemptCadenceMinutes,
  scheduledRefreshAdmissionAgeMinutes: contract.scheduledRefreshAdmissionAgeMinutes,
  dailyBaselineWriter: 'The Holding Market Data · Daily CoinGecko Baseline',
  canonicalMarketDataWriter: 'The Holding Market Data · Shared Refresh',
  downstreamMaterializationOwner: contract.separationOfConcerns.publicCapitalMaterializationOwner,
  dailyWritesCanonicalMarketData:false,
  dailyWritesPublicCapital:false,
  sharedWritesDailySourceLane:false,
  sharedWritesPublicCapital:false,
  workflowCompletionHandoff:true,
  generationParityAdmission:true,
  validatedSnapshotPreservedAcrossUnrelatedRebase:true,
  liveRpcRecomputeAfterUnrelatedRebase:false,
  marketInputChangeSupersedesCandidate:true,
  singleCanonicalWriter: contract.deliveryResilience.singleCanonicalWriter,
  workflowDispatchAuthority: contract.authority.workflowDispatchAuthority,
  capitalExecution: contract.authority.capitalExecution,
  executionAuthority:'none'
});
