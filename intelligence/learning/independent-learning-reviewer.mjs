#!/usr/bin/env node
/**
 * THE HOLDING — INDEPENDENT LEARNING REVIEWER v0.1
 *
 * Independent deterministic verification for the Decision & Outcome Learning
 * layer. The producer never grades itself: this reviewer recomputes hashes,
 * source bindings, lifecycle coverage, outcome consistency and confidence
 * calibration from published state.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { verifyGroundedBrainUpstreams } from '../brain-upstream-guard.mjs';

const ROOT = process.cwd();
const FILES = {
  brain: 'intelligence/brain-intelligence.json',
  stack: 'intelligence/cognitive-stack-state.json',
  cognitiveManifest: 'intelligence/cognitive-stack-release.json',
  learningRelease: 'intelligence/learning/learning-release.json',
  policy: 'intelligence/learning/decision-policy.json',
  ledger: 'intelligence/learning/decision-ledger.json',
  lifecycle: 'intelligence/learning-state/case-lifecycle.json',
  outcomes: 'intelligence/learning-state/outcome-memory.json',
  calibration: 'intelligence/learning-state/confidence-calibration.json',
  context: 'intelligence/learning-state/learning-context.json',
  eval: 'intelligence/learning-state/learning-eval.json',
};
const REVIEWER_VERSION = '0.1-independent-learning-reviewer';
const EVAL_VERSION = '0.1-learning-eval';
const args = new Set(process.argv.slice(2));
const VERIFY_CURRENT = args.has('--verify-current');
const SELF_TEST = args.has('--self-test');

function fail(message) { throw new Error(message); }
function sha256(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
  }
  return value;
}
function stableStringify(value) { return JSON.stringify(stableValue(value)); }
function readText(rel) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) fail(`Required learning file missing: ${rel}`);
  const text = fs.readFileSync(abs, 'utf8');
  if (!text.trim()) fail(`Required learning file empty: ${rel}`);
  return text;
}
function readJson(rel) {
  const text = readText(rel);
  try { return { text, data: JSON.parse(text) }; }
  catch (error) { fail(`Invalid JSON in ${rel}: ${error.message}`); }
}
function writeJson(rel, value) {
  fs.mkdirSync(path.dirname(path.join(ROOT, rel)), { recursive: true });
  fs.writeFileSync(path.join(ROOT, rel), JSON.stringify(value, null, 2) + '\n', 'utf8');
}
function coreWithoutIntegrity(obj) { const core = { ...obj }; delete core.integrity; return core; }
function decisionCore(entry) { const core = { ...entry }; delete core.integrity; return core; }
function stableEntity(caseObj) {
  const entity = caseObj?.entity ?? null;
  if (typeof entity === 'string' && /^\d+\s+current findings$/i.test(entity.trim())) return 'current findings';
  return entity;
}
function caseKey(caseObj) {
  return `CK-${sha256(stableStringify({
    domain: caseObj?.domain ?? null,
    category: caseObj?.category ?? null,
    entity: stableEntity(caseObj),
    recommendationClass: caseObj?.recommendationClass ?? null,
  })).slice(0, 20)}`;
}
function observationId(observation) {
  return `OBS-${sha256(stableStringify({
    observedAt: observation.observedAt,
    brainSnapshotHash: observation.brainSnapshotHash,
    brainSha256: observation.brainSha256,
    cognitiveChainHash: observation.cognitiveChainHash,
    activeCaseKeysHash: observation.activeCaseKeysHash,
  })).slice(0, 20)}`;
}
function mean(values) { return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null; }
function verifyLedger(ledger) {
  if (ledger?.version !== '0.1-decision-ledger' || !Array.isArray(ledger.decisions)) fail('Decision ledger schema invalid');
  if (ledger.decisionCount !== ledger.decisions.length) fail('Decision ledger count mismatch');
  let previous = null;
  for (let i = 0; i < ledger.decisions.length; i += 1) {
    const d = ledger.decisions[i];
    if (d?.chain?.previousDecisionHash !== previous) fail(`Decision ledger chain broken at ${i}`);
    if (d?.authority?.executable !== false || d?.authority?.executionAuthority !== 'none') fail(`Decision ${d?.decisionId ?? i} is executable`);
    const expected = sha256(stableStringify(decisionCore(d)));
    if (d?.integrity?.decisionHash !== expected) fail(`Decision hash mismatch at ${i}`);
    previous = expected;
  }
  const root = ledger.decisions[0]?.integrity?.decisionHash ?? null;
  const latest = ledger.decisions.at(-1)?.integrity?.decisionHash ?? null;
  if ((ledger.integrity?.chainRootHash ?? null) !== root) fail('Decision ledger root mismatch');
  if ((ledger.integrity?.latestDecisionHash ?? null) !== latest) fail('Decision ledger latest hash mismatch');
  if (ledger.integrity?.ledgerHash !== sha256(stableStringify(coreWithoutIntegrity(ledger)))) fail('Decision ledger hash mismatch');
}
function recomputeCalibration(outcomes, ledger) {
  const decisions = new Map(ledger.decisions.map((d) => [d.decisionId, d]));
  return outcomes.outcomes
    .filter((o) => o.status === 'settled' && typeof o.probabilityBps === 'number' && typeof o.eventObserved === 'boolean')
    .map((o) => {
      const p = o.probabilityBps / 10000;
      const y = o.eventObserved ? 1 : 0;
      return {
        decisionId: o.decisionId,
        recommendationClass: decisions.get(o.decisionId)?.sourceCase?.recommendationClass ?? null,
        brier: Number(((p - y) ** 2).toFixed(8)),
        observed: y,
        probabilityBps: o.probabilityBps,
      };
    });
}

if (SELF_TEST) {
  const x = { domain: 'economic', category: 'x', entity: 'y', recommendationClass: 'z' };
  if (!/^CK-[0-9a-f]{20}$/.test(caseKey(x))) fail('reviewer caseKey self-test failed');
  console.log(JSON.stringify({ status: 'pass', reviewerVersion: REVIEWER_VERSION }, null, 2));
  process.exit(0);
}

const loaded = Object.fromEntries(Object.entries(FILES).filter(([k]) => k !== 'eval').map(([k, rel]) => [k, readJson(rel)]));
const { brain, stack, cognitiveManifest, learningRelease, policy, ledger, lifecycle, outcomes, calibration, context } = Object.fromEntries(
  Object.entries(loaded).map(([k, v]) => [k, v.data])
);
const failures = [];
const warnings = [];
const checks = {};
function check(name, condition, message) {
  checks[name] = condition === true;
  if (!condition) failures.push(message ?? name);
}

check('policyVersion', policy?.version === '0.1-decision-outcome-learning-policy', 'Decision learning policy version mismatch');
check('policyNoExecution', policy?.safety?.capitalExecutionAllowed === false && policy?.safety?.walletActionAllowed === false && policy?.safety?.repositoryCodeMutationAllowed === false, 'Decision learning policy escaped no-execution boundary');
try { verifyLedger(ledger); checks.decisionLedgerHashChain = true; } catch (error) { checks.decisionLedgerHashChain = false; failures.push(error.message); }
try { verifyGroundedBrainUpstreams({ root: ROOT, brain }); checks.groundedBrainUpstreamCurrent = true; }
catch (error) { checks.groundedBrainUpstreamCurrent = false; failures.push(`Grounded Brain upstream verification failed: ${error.message}`); }

const brainSha = sha256(loaded.brain.text);
const policySha = sha256(loaded.policy.text);
const cognitiveManifestSha = sha256(loaded.cognitiveManifest.text);
const learningReleaseSha = sha256(loaded.learningRelease.text);
check('brainExactCognitiveBinding', stack?.chain?.groundedBrain?.sha256 === brainSha, 'Current Brain bytes do not match Cognitive Stack');
check('brainSnapshotBinding', stack?.chain?.groundedBrain?.snapshotHash === brain?.bridge?.snapshotHash, 'Current Brain snapshot does not match Cognitive Stack');
check('cognitiveReady', stack?.readyForManualInterpretation === true, 'Cognitive Stack not ready');
check('cognitiveReleaseExact', stack?.release?.exactByteMatch === true, 'Cognitive release not coherent');
check('cognitiveManifestCurrent', stack?.release?.manifestSha256 === cognitiveManifestSha && stack?.release?.releaseId === cognitiveManifest?.releaseId, 'Cognitive Stack was not built against the current cognitive release manifest');
check('bridgeExactUpstream', stack?.chain?.chatgptBridge?.exactCanonicalUpstreamBinding === true, 'ChatGPT Bridge exact-upstream binding is not current');
check('bridgeNoExecution', stack?.chain?.chatgptBridge?.noExecution === true, 'ChatGPT Bridge no-execution invariant is false');
check('learningReleaseId', learningRelease?.releaseId === '0.1-decision-outcome-learning-production', 'Learning releaseId mismatch');
check('cognitiveNoExecution', stack?.operatingContract?.executionAuthority === 'none', 'Cognitive Stack execution authority is not none');

check('lifecycleVersion', lifecycle?.version === '0.1-case-lifecycle', 'Case lifecycle version mismatch');
check('outcomeVersion', outcomes?.version === '0.1-outcome-memory', 'Outcome memory version mismatch');
check('calibrationVersion', calibration?.version === '0.1-confidence-calibration', 'Confidence calibration version mismatch');
check('contextVersion', context?.version === '0.1-learning-context', 'Learning context version mismatch');
check('sourceChainBinding', context?.source?.cognitiveChainHash === stack?.integrity?.chainHash && lifecycle?.source?.cognitiveChainHash === stack?.integrity?.chainHash && outcomes?.source?.cognitiveChainHash === stack?.integrity?.chainHash && calibration?.source?.cognitiveChainHash === stack?.integrity?.chainHash, 'Learning outputs are not bound to the current Cognitive Stack chain');
check('sourceBrainBinding', context?.source?.brainSha256 === brainSha && lifecycle?.source?.brainSha256 === brainSha, 'Learning outputs are not bound to current Brain bytes');
check('sourceLedgerBinding', context?.source?.decisionLedgerHash === ledger?.integrity?.ledgerHash && outcomes?.source?.decisionLedgerHash === ledger?.integrity?.ledgerHash && calibration?.source?.decisionLedgerHash === ledger?.integrity?.ledgerHash, 'Learning outputs are not bound to current decision ledger');
check('sourcePolicyBinding', context?.source?.decisionPolicySha256 === policySha && lifecycle?.source?.decisionPolicySha256 === policySha && outcomes?.source?.decisionPolicySha256 === policySha && calibration?.source?.decisionPolicySha256 === policySha, 'Learning outputs are not bound to current decision policy');
check('sourceCognitiveManifestBinding', context?.source?.cognitiveReleaseManifestSha256 === cognitiveManifestSha && lifecycle?.source?.cognitiveReleaseManifestSha256 === cognitiveManifestSha && outcomes?.source?.cognitiveReleaseManifestSha256 === cognitiveManifestSha && calibration?.source?.cognitiveReleaseManifestSha256 === cognitiveManifestSha, 'Learning outputs are not bound to current cognitive release manifest');
check('sourceLearningReleaseBinding', context?.source?.learningReleaseManifestSha256 === learningReleaseSha && lifecycle?.source?.learningReleaseManifestSha256 === learningReleaseSha && outcomes?.source?.learningReleaseManifestSha256 === learningReleaseSha && calibration?.source?.learningReleaseManifestSha256 === learningReleaseSha, 'Learning outputs are not bound to current Learning release manifest');
check('calibrationOutcomeBinding', calibration?.source?.outcomeMemoryHash === outcomes?.integrity?.stateHash, 'Confidence calibration is not bound to current outcome memory');

const lifecycleExpectedHash = sha256(stableStringify(coreWithoutIntegrity(lifecycle)));
const outcomesExpectedHash = sha256(stableStringify(coreWithoutIntegrity(outcomes)));
const calibrationExpectedHash = sha256(stableStringify(coreWithoutIntegrity(calibration)));
const contextExpectedHash = sha256(stableStringify(coreWithoutIntegrity(context)));
check('lifecycleIntegrity', lifecycle?.integrity?.stateHash === lifecycleExpectedHash, 'Case lifecycle integrity hash mismatch');
check('outcomeIntegrity', outcomes?.integrity?.stateHash === outcomesExpectedHash, 'Outcome memory integrity hash mismatch');
check('calibrationIntegrity', calibration?.integrity?.stateHash === calibrationExpectedHash, 'Calibration integrity hash mismatch');
check('learningContextIntegrity', context?.integrity?.learningHash === contextExpectedHash, 'Learning context hash mismatch');

const activeBrainKeys = new Set((brain?.reasoningCases ?? []).map(caseKey));
const activeLifecycleKeys = new Set((lifecycle?.records ?? []).filter((r) => r.status === 'active').map((r) => r.caseKey));
check('exactActiveCaseCoverage', activeBrainKeys.size === activeLifecycleKeys.size && [...activeBrainKeys].every((k) => activeLifecycleKeys.has(k)), 'Active Brain cases and lifecycle records do not match exactly');
check('contextActiveCaseCoverage', Array.isArray(context?.activeCases) && context.activeCases.length === activeBrainKeys.size && context.activeCases.every((x) => activeBrainKeys.has(x.caseKey)), 'Learning context active-case coverage mismatch');

const observations = Array.isArray(lifecycle?.observations) ? lifecycle.observations : [];
check('brainObservationJournalPresent', observations.length >= 1 && lifecycle?.observationCount === observations.length, 'Brain observation journal missing or count mismatch');
const observationIds = new Set();
for (const observation of observations) {
  check(`observation:${observation?.observationId ?? 'unknown'}:keys`, Array.isArray(observation?.activeCaseKeys) && observation.activeCaseCount === observation.activeCaseKeys.length && new Set(observation.activeCaseKeys).size === observation.activeCaseKeys.length, `Brain observation key set invalid: ${observation?.observationId ?? 'unknown'}`);
  const sortedKeys = Array.isArray(observation?.activeCaseKeys) ? [...observation.activeCaseKeys].sort() : [];
  check(`observation:${observation?.observationId ?? 'unknown'}:hash`, observation?.activeCaseKeysHash === sha256(stableStringify(sortedKeys)), `Brain observation active-case hash mismatch: ${observation?.observationId ?? 'unknown'}`);
  const core = { ...observation }; delete core.observationId;
  check(`observation:${observation?.observationId ?? 'unknown'}:id`, observation?.observationId === observationId(core), `Brain observation id mismatch: ${observation?.observationId ?? 'unknown'}`);
  check(`observation:${observation?.observationId ?? 'unknown'}:unique`, !observationIds.has(observation?.observationId), `Duplicate Brain observation: ${observation?.observationId ?? 'unknown'}`);
  observationIds.add(observation?.observationId);
}
const currentObservation = observations.find((o) => o.brainSnapshotHash === brain?.bridge?.snapshotHash && o.brainSha256 === brainSha && o.cognitiveChainHash === stack?.integrity?.chainHash);
check('currentBrainObservationPresent', Boolean(currentObservation), 'Current coherent Brain snapshot is missing from the observation journal');
if (currentObservation) {
  check('currentBrainObservationCoverage', currentObservation.activeCaseKeys.length === activeBrainKeys.size && currentObservation.activeCaseKeys.every((k) => activeBrainKeys.has(k)), 'Current Brain observation active-case set does not match current Brain');
}

const decisionIds = new Set(ledger.decisions.map((d) => d.decisionId));
check('outcomesMapKnownDecisions', Array.isArray(outcomes?.outcomes) && outcomes.outcomes.every((o) => decisionIds.has(o.decisionId)), 'Outcome memory references an unknown decision');
check('oneOutcomePerDecision', outcomes?.outcomes?.length === ledger.decisionCount && new Set(outcomes.outcomes.map((o) => o.decisionId)).size === ledger.decisionCount, 'Outcome memory is not one-to-one with decision ledger');
const decisionById = new Map(ledger.decisions.map((d) => [d.decisionId, d]));
const observationById = new Map(observations.map((o) => [o.observationId, o]));
for (const outcome of outcomes?.outcomes ?? []) {
  const decision = decisionById.get(outcome.decisionId);
  if (!decision) continue;
  check(`outcome:${outcome.decisionId}:event`, outcome.event === decision.prediction?.event, `Outcome event drift: ${outcome.decisionId}`);
  check(`outcome:${outcome.decisionId}:probability`, outcome.probabilityBps === decision.prediction?.probabilityBps, `Outcome probability drift: ${outcome.decisionId}`);
  check(`outcome:${outcome.decisionId}:reviewAt`, outcome.reviewAt === decision.prediction?.reviewAt, `Outcome review horizon drift: ${outcome.decisionId}`);
  if (outcome.status === 'settled') {
    const observation = observationById.get(outcome?.evidence?.observationId);
    check(`outcome:${outcome.decisionId}:observation`, Boolean(observation), `Settled outcome missing observation evidence: ${outcome.decisionId}`);
    if (observation) {
      const reviewMs = Date.parse(outcome.reviewAt);
      const observedMs = Date.parse(observation.observedAt);
      check(`outcome:${outcome.decisionId}:horizon`, Number.isFinite(reviewMs) && Number.isFinite(observedMs) && observedMs >= reviewMs, `Settled outcome predates review horizon: ${outcome.decisionId}`);
      const eligible = observations
        .filter((o) => Date.parse(o.observedAt) >= reviewMs)
        .sort((a, b) => Date.parse(a.observedAt) - Date.parse(b.observedAt));
      check(`outcome:${outcome.decisionId}:firstEligibleObservation`, eligible[0]?.observationId === observation.observationId, `Settled outcome is not bound to the earliest retained coherent observation at/after review: ${outcome.decisionId}`);
      const eventObserved = !observation.activeCaseKeys.includes(decision.caseKey);
      check(`outcome:${outcome.decisionId}:observedState`, outcome.eventObserved === eventObserved, `Settled outcome observed state mismatch: ${outcome.decisionId}`);
      check(`outcome:${outcome.decisionId}:settledAt`, outcome.settledAt === observation.observedAt, `Settled outcome timestamp does not match observation: ${outcome.decisionId}`);
      check(`outcome:${outcome.decisionId}:evidenceHashes`, outcome?.evidence?.brainSnapshotHash === observation.brainSnapshotHash && outcome?.evidence?.cognitiveChainHash === observation.cognitiveChainHash && outcome?.evidence?.activeCaseKeysHash === observation.activeCaseKeysHash, `Settled outcome evidence hashes mismatch: ${outcome.decisionId}`);
      check(`outcome:${outcome.decisionId}:statusLabel`, outcome?.evidence?.caseStatusAtReview === (eventObserved ? 'inactive' : 'active'), `Settled outcome status label mismatch: ${outcome.decisionId}`);
    }
  } else if (outcome.status === 'pending') {
    const reviewMs = Date.parse(outcome.reviewAt);
    const eligible = observations.filter((o) => Date.parse(o.observedAt) >= reviewMs);
    check(`outcome:${outcome.decisionId}:pendingNoEligibleObservation`, eligible.length === 0, `Pending outcome already has a coherent observation at/after review horizon: ${outcome.decisionId}`);
  } else if (outcome.status === 'unscored') {
    check(`outcome:${outcome.decisionId}:unscoredEvent`, decision.prediction?.event === 'none' && outcome.eventObserved === null, `Unscored outcome is inconsistent with decision prediction: ${outcome.decisionId}`);
  } else {
    check(`outcome:${outcome.decisionId}:status`, false, `Unsupported outcome status: ${outcome.status}`);
  }
}
const settledIds = new Set(outcomes.outcomes.filter((o) => o.status === 'settled').map((o) => o.decisionId));
check('lessonsOnlyFromSettledOutcomes', (outcomes.lessons ?? []).every((l) => settledIds.has(l.decisionId) && typeof l.epistemicNote === 'string'), 'Lesson exists without a settled outcome or epistemic note');

const points = recomputeCalibration(outcomes, ledger);
const recomputedMeanBrier = points.length ? Number((mean(points.map((p) => p.brier))).toFixed(8)) : null;
check('calibrationCount', calibration?.scoredOutcomeCount === points.length, 'Calibration scored-outcome count mismatch');
check('calibrationBrier', calibration?.meanBrierScore === recomputedMeanBrier, 'Calibration Brier score mismatch');
const highThreshold = Number(policy?.calibration?.highConfidenceThresholdBps ?? 8000);
const highMisses = points.filter((p) => p.probabilityBps >= highThreshold && p.observed === 0).map((p) => p.decisionId);
check('highConfidenceMissCount', calibration?.highConfidenceMissCount === highMisses.length, 'High-confidence miss count mismatch');
if (highMisses.length) warnings.push(`${highMisses.length} high-confidence prediction miss(es) are present; retain caution in similar future cases.`);
if (points.length < Number(policy?.calibration?.warmingUntilScoredOutcomes ?? 5)) warnings.push(`Confidence calibration is warming: ${points.length}/${policy.calibration.warmingUntilScoredOutcomes} scored outcomes.`);

check('contextNoExecution', context?.constraints?.executionAllowed === false && context?.constraints?.walletActionAllowed === false && context?.constraints?.autonomousCapitalActionAllowed === false && context?.constraints?.autonomousRepositoryCodeMutationAllowed === false && context?.constraints?.autonomousMethodologyMutationAllowed === false && context?.constraints?.autonomousPolicyMutationAllowed === false, 'Learning context escaped no-execution boundary');
check('decisionRecordsInert', context?.constraints?.decisionRecordsExecutable === false, 'Decision records became executable');
check('operatingContractNoExecution', context?.operatingContract?.executionAuthority === 'none', 'Learning operating contract grants execution authority');

if (failures.length) fail(`Independent learning review failed:\n${failures.join('\n')}`);

const evalCore = {
  version: EVAL_VERSION,
  reviewerVersion: REVIEWER_VERSION,
  generatedAt: new Date().toISOString(),
  status: 'pass',
  source: {
    cognitiveChainHash: stack.integrity?.chainHash ?? null,
    brainSha256: brainSha,
    brainSnapshotHash: brain?.bridge?.snapshotHash ?? null,
    decisionLedgerHash: ledger.integrity?.ledgerHash ?? null,
    learningHash: context.integrity?.learningHash ?? null,
  },
  checks,
  counts: {
    activeBrainCases: activeBrainKeys.size,
    rememberedCases: lifecycle.caseCount,
    brainObservations: lifecycle.observationCount,
    decisions: ledger.decisionCount,
    settledOutcomes: outcomes.settledCount,
    scoredOutcomes: calibration.scoredOutcomeCount,
    lessons: outcomes.lessons?.length ?? 0,
    highConfidenceMisses: calibration.highConfidenceMissCount,
  },
  warnings,
  failures: [],
  safety: {
    apiRequired: false,
    modelCallPerformed: false,
    executionAuthority: 'none',
    policyMutationAuthority: 'human-only',
  },
};
const evalHash = sha256(stableStringify(evalCore));
const evaluation = { ...evalCore, integrity: { evalHash } };

if (VERIFY_CURRENT) {
  const published = readJson(FILES.eval).data;
  check('publishedEvalVersion', published?.version === EVAL_VERSION, 'Published learning eval version mismatch');
  check('publishedEvalPass', published?.status === 'pass', 'Published learning eval is not pass');
  check('publishedEvalLearningHash', published?.source?.learningHash === context?.integrity?.learningHash, 'Published learning eval is not bound to current learning context');
  const publishedCore = coreWithoutIntegrity(published);
  if (published?.integrity?.evalHash !== sha256(stableStringify(publishedCore))) fail('Published learning eval integrity mismatch');
  if (failures.length) fail(`Published current-state verification failed:
${failures.join('\n')}`);
  console.log(JSON.stringify({
    status: 'verified',
    reviewerVersion: REVIEWER_VERSION,
    learningHash: context.integrity.learningHash,
    cognitiveChainHash: stack.integrity.chainHash,
    decisions: ledger.decisionCount,
    settledOutcomes: outcomes.settledCount,
    executionAuthority: 'none',
  }, null, 2));
  process.exit(0);
}

writeJson(FILES.eval, evaluation);
console.log(JSON.stringify({
  status: 'pass',
  reviewerVersion: REVIEWER_VERSION,
  checks: Object.keys(checks).length,
  warnings: warnings.length,
  learningHash: context.integrity.learningHash,
  evalHash,
  executionAuthority: 'none',
}, null, 2));
