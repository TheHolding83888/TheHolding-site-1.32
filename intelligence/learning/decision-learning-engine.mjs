#!/usr/bin/env node
/**
 * THE HOLDING — DECISION & OUTCOME LEARNING ENGINE v0.1
 *
 * Builds a deterministic, evidence-bound experience layer downstream of the
 * current Cognitive Stack:
 *
 *   Brain Case -> Human Decision -> Observed Outcome -> Deterministic Lesson
 *
 * It DOES NOT execute decisions and DOES NOT change Grounded Brain policy.
 * It learns by persistent structured memory, observed case lifecycles and
 * calibration of recorded predictions — not by changing model weights.
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
  brief: 'intelligence/learning-state/learning-brief.md',
  eval: 'intelligence/learning-state/learning-eval.json',
};

const ENGINE_VERSION = '0.1-decision-outcome-learning-engine';
const LIFECYCLE_VERSION = '0.1-case-lifecycle';
const OUTCOME_VERSION = '0.1-outcome-memory';
const CALIBRATION_VERSION = '0.1-confidence-calibration';
const CONTEXT_VERSION = '0.1-learning-context';
const SKIP_EXIT = 3;
const UNCHANGED_EXIT = 4;

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
function ensureDir(rel) { fs.mkdirSync(path.dirname(path.join(ROOT, rel)), { recursive: true }); }
function readText(rel, required = true) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) {
    if (!required) return null;
    fail(`Required file missing: ${rel}`);
  }
  const text = fs.readFileSync(abs, 'utf8');
  if (required && !text.trim()) fail(`Required file empty: ${rel}`);
  return text;
}
function readJson(rel, required = true) {
  const text = readText(rel, required);
  if (text === null) return null;
  try { return { text, data: JSON.parse(text) }; }
  catch (error) { fail(`Invalid JSON in ${rel}: ${error.message}`); }
}
function writeJson(rel, value) {
  ensureDir(rel);
  fs.writeFileSync(path.join(ROOT, rel), JSON.stringify(value, null, 2) + '\n', 'utf8');
}
function validIso(value) {
  if (typeof value !== 'string') return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}
function nowIso() {
  const override = process.env.LEARNING_NOW;
  if (override) {
    const parsed = validIso(override);
    if (!parsed) fail('LEARNING_NOW is invalid');
    return parsed;
  }
  return new Date().toISOString();
}
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
function experienceClass(caseObj) {
  return `EC-${sha256(stableStringify({
    domain: caseObj?.domain ?? null,
    category: caseObj?.category ?? null,
    recommendationClass: caseObj?.recommendationClass ?? null,
  })).slice(0, 16)}`;
}
function casePayloadHash(caseObj) {
  return sha256(stableStringify({
    id: caseObj?.id ?? null,
    domain: caseObj?.domain ?? null,
    severity: caseObj?.severity ?? null,
    category: caseObj?.category ?? null,
    entity: caseObj?.entity ?? null,
    signal: caseObj?.signal ?? null,
    whyItMatters: caseObj?.whyItMatters ?? null,
    whatFollows: caseObj?.whatFollows ?? null,
    whatShouldBeDone: caseObj?.whatShouldBeDone ?? null,
    recommendationClass: caseObj?.recommendationClass ?? null,
    riskTier: caseObj?.riskTier ?? null,
    confidence: caseObj?.confidence ?? null,
    actionMode: caseObj?.actionMode ?? null,
  }));
}
function validatePolicy(policy) {
  if (policy?.version !== '0.1-decision-outcome-learning-policy') fail('Unexpected decision policy version');
  if (policy?.mode !== 'evidence-bound-human-decision-memory') fail('Decision learning policy mode mismatch');
  if (policy?.safety?.capitalExecutionAllowed !== false) fail('Learning policy unexpectedly enables capital execution');
  if (policy?.safety?.walletActionAllowed !== false) fail('Learning policy unexpectedly enables wallet actions');
  if (policy?.safety?.repositoryCodeMutationAllowed !== false) fail('Learning policy unexpectedly enables code mutation');
  if (policy?.safety?.lessonsMayChangePolicyAutomatically !== false) fail('Lessons may not mutate policy automatically');
}
function ledgerCore(ledger) { const core = { ...ledger }; delete core.integrity; return core; }
function decisionCore(entry) { const core = { ...entry }; delete core.integrity; return core; }
function validateLedger(ledger) {
  if (ledger?.version !== '0.1-decision-ledger') fail(`Unexpected decision ledger version: ${ledger?.version}`);
  if (!Array.isArray(ledger?.decisions)) fail('decision ledger decisions missing');
  if (ledger.decisionCount !== ledger.decisions.length) fail('decision ledger count mismatch');
  let previous = null;
  for (let i = 0; i < ledger.decisions.length; i += 1) {
    const d = ledger.decisions[i];
    if (d?.chain?.previousDecisionHash !== previous) fail(`decision chain broken at ${i}`);
    const hash = sha256(stableStringify(decisionCore(d)));
    if (d?.integrity?.decisionHash !== hash) fail(`decision hash mismatch at ${i}`);
    if (d?.authority?.executable !== false || d?.authority?.executionAuthority !== 'none') {
      fail(`decision ${d?.decisionId ?? i} escaped inert memory authority`);
    }
    previous = hash;
  }
  const expectedRoot = ledger.decisions[0]?.integrity?.decisionHash ?? null;
  const expectedLatest = ledger.decisions.at(-1)?.integrity?.decisionHash ?? null;
  if ((ledger.integrity?.chainRootHash ?? null) !== expectedRoot) fail('decision ledger root mismatch');
  if ((ledger.integrity?.latestDecisionHash ?? null) !== expectedLatest) fail('decision ledger latest hash mismatch');
  if (ledger.integrity?.ledgerHash !== sha256(stableStringify(ledgerCore(ledger)))) fail('decision ledger hash mismatch');
}
function coherentSource(brainLoaded, stack, cognitiveManifestLoaded) {
  const brain = brainLoaded.data;
  const brainSha = sha256(brainLoaded.text);
  const cognitiveManifestSha = sha256(cognitiveManifestLoaded.text);
  const cognitiveManifest = cognitiveManifestLoaded.data;
  const reasons = [];
  try { verifyGroundedBrainUpstreams({ root: ROOT, brain }); }
  catch (error) { reasons.push(`Grounded Brain is not current relative to canonical upstreams: ${error.message}`); }
  if (stack?.readyForManualInterpretation !== true) reasons.push('cognitive stack is not ready for manual interpretation');
  if (stack?.release?.exactByteMatch !== true) reasons.push('cognitive release is not exact-byte coherent');
  if (stack?.release?.manifestSha256 !== cognitiveManifestSha) reasons.push('cognitive stack was built against a different cognitive release manifest');
  if (stack?.release?.releaseId !== cognitiveManifest?.releaseId) reasons.push('cognitive stack releaseId does not match current cognitive release manifest');
  if (stack?.chain?.groundedBrain?.sha256 !== brainSha) reasons.push('stack is not bound to current Brain bytes');
  if (stack?.chain?.groundedBrain?.snapshotHash !== brain?.bridge?.snapshotHash) reasons.push('stack/Brain snapshot mismatch');
  if (stack?.chain?.groundedBrain?.exactCanonicalUpstreamBinding !== true) reasons.push('Brain exact upstream binding is false');
  if (stack?.chain?.chatgptBridge?.exactCanonicalUpstreamBinding !== true) reasons.push('Bridge exact upstream binding is false');
  if (stack?.chain?.chatgptBridge?.noExecution !== true) reasons.push('Bridge no-execution invariant is false');
  if (stack?.operatingContract?.executionAuthority !== 'none') reasons.push('Cognitive Stack execution authority is not none');
  return { ok: reasons.length === 0, reasons, brainSha, cognitiveManifestSha };
}
function loadLifecycle() {
  const loaded = readJson(FILES.lifecycle, false);
  if (!loaded) return {
    version: LIFECYCLE_VERSION,
    engineVersion: ENGINE_VERSION,
    generatedAt: null,
    source: null,
    caseCount: 0,
    activeCaseCount: 0,
    resolvedCaseCount: 0,
    records: [],
    events: [],
    observations: [],
    integrity: { stateHash: null },
  };
  const x = loaded.data;
  if (x?.version !== LIFECYCLE_VERSION || !Array.isArray(x?.records) || !Array.isArray(x?.events) || !Array.isArray(x?.observations)) {
    fail('Existing case-lifecycle.json has unexpected schema');
  }
  return x;
}
function loadOutcomeMemory() {
  const loaded = readJson(FILES.outcomes, false);
  if (!loaded) return null;
  const x = loaded.data;
  if (x?.version !== OUTCOME_VERSION || !Array.isArray(x?.outcomes)) fail('Existing outcome-memory.json has unexpected schema');
  const core = { ...x }; delete core.integrity;
  if (x?.integrity?.stateHash !== sha256(stableStringify(core))) fail('Existing outcome-memory.json integrity mismatch');
  return x;
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
function statusAt(events, key, timestamp) {
  const t = Date.parse(timestamp);
  if (!Number.isFinite(t)) return 'unknown';
  const relevant = events
    .filter((e) => e.caseKey === key && Date.parse(e.observedAt) <= t)
    .sort((a, b) => Date.parse(a.observedAt) - Date.parse(b.observedAt));
  let status = 'unknown';
  for (const e of relevant) {
    if (e.type === 'opened' || e.type === 'reopened') status = 'active';
    else if (e.type === 'resolved') status = 'resolved';
  }
  return status;
}
function eventId(event) {
  return `CE-${sha256(stableStringify({
    caseKey: event.caseKey,
    type: event.type,
    observedAt: event.observedAt,
    brainSnapshotHash: event.brainSnapshotHash,
    payloadHash: event.payloadHash ?? null,
  })).slice(0, 20)}`;
}
function outcomeId(decisionId) { return `OUT-${sha256(decisionId).slice(0, 20)}`; }
function lessonId(outcome) { return `LESS-${sha256(stableStringify({ decisionId: outcome.decisionId, settledAt: outcome.settledAt, observed: outcome.eventObserved })).slice(0, 20)}`; }
function deterministicLesson(decision, outcome) {
  if (outcome.status !== 'settled') return null;
  const observed = outcome.eventObserved === true;
  const d = decision.disposition;
  let text;
  if (d === 'accept' && observed) text = 'The accepted recommendation was followed by the case being observed inactive at or after the review horizon.';
  else if (d === 'accept' && !observed) text = 'The accepted recommendation was not followed by observed case resolution by the review horizon; similar future cases should retain additional caution.';
  else if (d === 'defer' && observed) text = 'The deferred case was observed inactive by the review horizon without an accepted intervention recorded in this ledger; intervention necessity may have been overstated.';
  else if (d === 'defer' && !observed) text = 'The deferred case remained active at the review horizon; delay alone did not coincide with resolution.';
  else if (d === 'reject' && observed) text = 'The rejected recommendation was followed by the case being observed inactive by the review horizon; the proposed intervention may not have been necessary.';
  else if (d === 'reject' && !observed) text = 'The rejected recommendation was followed by the case remaining active at the review horizon; future rejection of similar cases deserves stronger justification.';
  else if (d === 'modify' && observed) text = 'A modified owner decision was followed by the case being observed inactive by the review horizon; preserve the modification details for future comparison.';
  else text = 'A modified owner decision was followed by the case remaining active at the review horizon; the modified approach did not coincide with resolution inside the review window.';
  return {
    lessonId: lessonId(outcome),
    createdAt: outcome.settledAt,
    caseKey: decision.caseKey,
    caseId: decision.caseId,
    decisionId: decision.decisionId,
    recommendationClass: decision.sourceCase?.recommendationClass ?? null,
    disposition: decision.disposition,
    event: outcome.event,
    eventObserved: outcome.eventObserved,
    text,
    epistemicNote: 'This is an observed association in The Holding memory, not proof of causation.',
  };
}
function mean(values) { return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null; }
function buildCalibration(policy, outcomes, decisions, generatedAt, source) {
  const byId = new Map(decisions.map((d) => [d.decisionId, d]));
  const scored = outcomes.filter((o) => o.status === 'settled' && typeof o.eventObserved === 'boolean' && typeof o.probabilityBps === 'number');
  const points = scored.map((o) => {
    const p = o.probabilityBps / 10000;
    const y = o.eventObserved ? 1 : 0;
    const brier = (p - y) ** 2;
    return {
      decisionId: o.decisionId,
      caseKey: o.caseKey,
      recommendationClass: byId.get(o.decisionId)?.sourceCase?.recommendationClass ?? null,
      probabilityBps: o.probabilityBps,
      observed: y,
      brierScore: Number(brier.toFixed(8)),
    };
  });
  const bins = policy.calibration.binsBps.map(([min, max]) => {
    const items = points.filter((p) => p.probabilityBps >= min && p.probabilityBps <= max);
    return {
      minBps: min,
      maxBps: max,
      count: items.length,
      meanPredictedProbability: items.length ? Number((mean(items.map((x) => x.probabilityBps / 10000))).toFixed(6)) : null,
      observedEventRate: items.length ? Number((mean(items.map((x) => x.observed))).toFixed(6)) : null,
      meanBrierScore: items.length ? Number((mean(items.map((x) => x.brierScore))).toFixed(8)) : null,
    };
  });
  const highThreshold = Number(policy.calibration.highConfidenceThresholdBps);
  const highConfidenceMisses = points.filter((p) => p.probabilityBps >= highThreshold && p.observed === 0).map((p) => p.decisionId);
  const byClassMap = new Map();
  for (const p of points) {
    const key = p.recommendationClass ?? 'unknown';
    if (!byClassMap.has(key)) byClassMap.set(key, []);
    byClassMap.get(key).push(p);
  }
  const byRecommendationClass = [...byClassMap.entries()].sort().map(([key, items]) => ({
    recommendationClass: key,
    scoredOutcomeCount: items.length,
    observedEventRate: Number((mean(items.map((x) => x.observed))).toFixed(6)),
    meanBrierScore: Number((mean(items.map((x) => x.brierScore))).toFixed(8)),
  }));
  const warmingUntil = Number(policy.calibration.warmingUntilScoredOutcomes);
  const result = {
    version: CALIBRATION_VERSION,
    engineVersion: ENGINE_VERSION,
    generatedAt,
    source,
    status: points.length >= warmingUntil ? 'measured' : 'warming',
    scoredOutcomeCount: points.length,
    warmingUntilScoredOutcomes: warmingUntil,
    meanBrierScore: points.length ? Number((mean(points.map((p) => p.brierScore))).toFixed(8)) : null,
    observedEventRate: points.length ? Number((mean(points.map((p) => p.observed))).toFixed(6)) : null,
    highConfidenceMissCount: highConfidenceMisses.length,
    highConfidenceMissDecisionIds: highConfidenceMisses,
    bins,
    byRecommendationClass,
    points,
  };
  result.integrity = { stateHash: sha256(stableStringify({ ...result, integrity: undefined })) };
  return result;
}

const generatedAt = nowIso();
const policyLoaded = readJson(FILES.policy);
const ledgerLoaded = readJson(FILES.ledger);
const brainLoaded = readJson(FILES.brain);
const stackLoaded = readJson(FILES.stack);
const cognitiveManifestLoaded = readJson(FILES.cognitiveManifest);
const learningReleaseLoaded = readJson(FILES.learningRelease);
validatePolicy(policyLoaded.data);
validateLedger(ledgerLoaded.data);
const coherence = coherentSource(brainLoaded, stackLoaded.data, cognitiveManifestLoaded);
if (!coherence.ok) {
  console.log(JSON.stringify({
    status: 'skipped',
    reason: 'cognitive-stack-not-coherent',
    details: coherence.reasons,
    skipExitCode: SKIP_EXIT,
  }, null, 2));
  process.exit(SKIP_EXIT);
}

const brain = brainLoaded.data;
const stack = stackLoaded.data;
const policy = policyLoaded.data;
const ledger = ledgerLoaded.data;
const policySha = sha256(policyLoaded.text);
const learningReleaseSha = sha256(learningReleaseLoaded.text);
const existingContextLoaded = readJson(FILES.context, false);
const requiredExistingState = [FILES.lifecycle, FILES.outcomes, FILES.calibration, FILES.context, FILES.brief, FILES.eval]
  .every((rel) => fs.existsSync(path.join(ROOT, rel)) && fs.statSync(path.join(ROOT, rel)).size > 0);
if (requiredExistingState && existingContextLoaded?.data?.engineVersion === ENGINE_VERSION) {
  const src = existingContextLoaded.data.source ?? {};
  const sourceUnchanged =
    src.brainSha256 === coherence.brainSha &&
    src.brainSnapshotHash === (brain.bridge?.snapshotHash ?? null) &&
    src.cognitiveChainHash === (stack.integrity?.chainHash ?? null) &&
    src.decisionLedgerHash === (ledger.integrity?.ledgerHash ?? null) &&
    src.decisionPolicySha256 === policySha &&
    src.cognitiveReleaseManifestSha256 === coherence.cognitiveManifestSha &&
    src.learningReleaseManifestSha256 === learningReleaseSha;
  if (sourceUnchanged) {
    console.log(JSON.stringify({
      status: 'unchanged',
      reason: 'no-new-coherent-brain-decision-policy-or-release-input',
      unchangedExitCode: UNCHANGED_EXIT,
      learningHash: existingContextLoaded.data?.integrity?.learningHash ?? null,
      executionAuthority: 'none',
    }, null, 2));
    process.exit(UNCHANGED_EXIT);
  }
}
const previous = loadLifecycle();
const previousOutcomeMemory = loadOutcomeMemory();
const currentCases = Array.isArray(brain.reasoningCases) ? brain.reasoningCases : [];
const currentByKey = new Map();
for (const item of currentCases) {
  if (!item?.id || item.actionMode !== 'proposal-only' || !Array.isArray(item.evidence) || item.evidence.length === 0) {
    fail(`Current Brain case is invalid: ${item?.id ?? 'unknown'}`);
  }
  const key = caseKey(item);
  if (currentByKey.has(key)) fail(`Stable caseKey collision in current Brain: ${key}`);
  currentByKey.set(key, item);
}

const previousByKey = new Map(previous.records.map((r) => [r.caseKey, r]));
const records = previous.records.map((r) => ({ ...r }));
const recordByKey = new Map(records.map((r) => [r.caseKey, r]));
let events = [...previous.events];
let observations = [...previous.observations];
const brainObservedAt = validIso(brain.generatedAt) ?? generatedAt;
const brainSnapshotHash = brain.bridge?.snapshotHash ?? null;
const activeCaseKeys = [...currentByKey.keys()].sort();
const activeCaseKeysHash = sha256(stableStringify(activeCaseKeys));
const currentObservationCore = {
  observedAt: brainObservedAt,
  brainSnapshotHash,
  brainSha256: coherence.brainSha,
  cognitiveChainHash: stack.integrity?.chainHash ?? null,
  activeCaseCount: activeCaseKeys.length,
  activeCaseKeysHash,
  activeCaseKeys,
};
const currentObservation = { ...currentObservationCore, observationId: observationId(currentObservationCore) };
if (!observations.some((o) => o.observationId === currentObservation.observationId)) observations.push(currentObservation);

for (const [key, item] of currentByKey.entries()) {
  const payloadHash = casePayloadHash(item);
  const expClass = experienceClass(item);
  const prior = recordByKey.get(key);
  if (!prior) {
    const record = {
      caseKey: key,
      experienceClass: expClass,
      currentCaseId: item.id,
      domain: item.domain ?? null,
      category: item.category ?? null,
      entity: item.entity ?? null,
      recommendationClass: item.recommendationClass ?? null,
      riskTier: item.riskTier ?? null,
      firstSeenAt: brainObservedAt,
      lastSeenAt: brainObservedAt,
      firstBrainSnapshotHash: brainSnapshotHash,
      lastBrainSnapshotHash: brainSnapshotHash,
      lastPayloadHash: payloadHash,
      status: 'active',
      activeObservationCount: 1,
      resolutionCount: 0,
      reopenCount: 0,
      lastResolvedAt: null,
      lastChangedAt: brainObservedAt,
    };
    records.push(record);
    recordByKey.set(key, record);
    const event = { caseKey: key, caseId: item.id, type: 'opened', observedAt: brainObservedAt, brainSnapshotHash, payloadHash };
    event.eventId = eventId(event);
    events.push(event);
    continue;
  }

  const wasResolved = prior.status === 'resolved';
  const changed = prior.lastPayloadHash !== payloadHash || prior.currentCaseId !== item.id;
  prior.currentCaseId = item.id;
  prior.domain = item.domain ?? prior.domain;
  prior.category = item.category ?? prior.category;
  prior.entity = item.entity ?? prior.entity;
  prior.recommendationClass = item.recommendationClass ?? prior.recommendationClass;
  prior.riskTier = item.riskTier ?? prior.riskTier;
  prior.experienceClass = expClass;
  prior.lastSeenAt = brainObservedAt;
  prior.lastBrainSnapshotHash = brainSnapshotHash;
  prior.activeObservationCount = Number(prior.activeObservationCount ?? 0) + (previous.source?.brainSnapshotHash === brainSnapshotHash ? 0 : 1);
  if (wasResolved) {
    prior.status = 'active';
    prior.reopenCount = Number(prior.reopenCount ?? 0) + 1;
    prior.lastPayloadHash = payloadHash;
    prior.lastChangedAt = brainObservedAt;
    const event = { caseKey: key, caseId: item.id, type: 'reopened', observedAt: brainObservedAt, brainSnapshotHash, payloadHash };
    event.eventId = eventId(event);
    events.push(event);
  } else if (changed && previous.source?.brainSnapshotHash !== brainSnapshotHash) {
    prior.lastPayloadHash = payloadHash;
    prior.lastChangedAt = brainObservedAt;
    const event = { caseKey: key, caseId: item.id, type: 'changed', observedAt: brainObservedAt, brainSnapshotHash, payloadHash };
    event.eventId = eventId(event);
    events.push(event);
  } else {
    prior.status = 'active';
    prior.lastPayloadHash = payloadHash;
  }
}

if (previous.source?.brainSnapshotHash !== brainSnapshotHash) {
  for (const record of records) {
    if (record.status === 'active' && !currentByKey.has(record.caseKey)) {
      record.status = 'resolved';
      record.resolutionCount = Number(record.resolutionCount ?? 0) + 1;
      record.lastResolvedAt = brainObservedAt;
      record.lastChangedAt = brainObservedAt;
      const event = {
        caseKey: record.caseKey,
        caseId: record.currentCaseId,
        type: 'resolved',
        observedAt: brainObservedAt,
        brainSnapshotHash,
        payloadHash: record.lastPayloadHash ?? null,
      };
      event.eventId = eventId(event);
      events.push(event);
    }
  }
}

// De-duplicate exact lifecycle events and bound memory.
const eventSeen = new Set();
events = events.filter((e) => {
  const id = e.eventId ?? eventId(e);
  e.eventId = id;
  if (eventSeen.has(id)) return false;
  eventSeen.add(id);
  return true;
}).sort((a, b) => Date.parse(a.observedAt) - Date.parse(b.observedAt));
const maxEvents = Number(policy.history.maxLifecycleEvents);
events = events.slice(-maxEvents);

// Preserve a compact, independently verifiable journal of coherent Brain
// observations. Any observation already used to settle an outcome is retained
// even if it falls outside the normal rolling window.
for (const observation of observations) {
  if (!Array.isArray(observation?.activeCaseKeys)) fail('Brain observation activeCaseKeys missing');
  if (observation.activeCaseCount !== observation.activeCaseKeys.length) fail(`Brain observation case count mismatch: ${observation?.observationId ?? 'unknown'}`);
  if (observation.activeCaseKeysHash !== sha256(stableStringify([...observation.activeCaseKeys].sort()))) fail(`Brain observation active-case hash mismatch: ${observation?.observationId ?? 'unknown'}`);
  const core = { ...observation }; delete core.observationId;
  if (observation.observationId !== observationId(core)) fail(`Brain observation id mismatch: ${observation?.observationId ?? 'unknown'}`);
}
const observationMap = new Map();
for (const observation of observations) observationMap.set(observation.observationId, observation);
observations = [...observationMap.values()].sort((a, b) => Date.parse(a.observedAt) - Date.parse(b.observedAt));
const protectedObservationIds = new Set(
  (previousOutcomeMemory?.outcomes ?? [])
    .filter((o) => o.status === 'settled' && o?.evidence?.observationId)
    .map((o) => o.evidence.observationId)
);
protectedObservationIds.add(currentObservation.observationId);
const maxObservations = Number(policy.history.maxBrainObservations ?? 2000);
const protectedObservations = observations.filter((o) => protectedObservationIds.has(o.observationId));
const rollingObservations = observations.filter((o) => !protectedObservationIds.has(o.observationId)).slice(-Math.max(0, maxObservations - protectedObservations.length));
observations = [...protectedObservations, ...rollingObservations].sort((a, b) => Date.parse(a.observedAt) - Date.parse(b.observedAt));

const maxCases = Number(policy.history.maxCaseRecords);
const boundedRecords = records
  .sort((a, b) => Date.parse(b.lastSeenAt ?? b.lastChangedAt ?? 0) - Date.parse(a.lastSeenAt ?? a.lastChangedAt ?? 0))
  .slice(0, maxCases)
  .sort((a, b) => a.caseKey.localeCompare(b.caseKey));

const lifecycle = {
  version: LIFECYCLE_VERSION,
  engineVersion: ENGINE_VERSION,
  generatedAt,
  source: {
    brainFile: FILES.brain,
    brainSha256: coherence.brainSha,
    brainSnapshotHash,
    brainGeneratedAt: brainObservedAt,
    cognitiveStackFile: FILES.stack,
    cognitiveChainHash: stack.integrity?.chainHash ?? null,
    cognitiveReleaseId: stack.release?.releaseId ?? null,
    cognitiveReleaseManifestSha256: coherence.cognitiveManifestSha,
    decisionPolicySha256: policySha,
    learningReleaseManifestSha256: learningReleaseSha,
  },
  caseCount: boundedRecords.length,
  activeCaseCount: boundedRecords.filter((r) => r.status === 'active').length,
  resolvedCaseCount: boundedRecords.filter((r) => r.status === 'resolved').length,
  observationCount: observations.length,
  records: boundedRecords,
  events,
  observations,
};
lifecycle.integrity = { stateHash: sha256(stableStringify(lifecycle)) };

// Evaluate decision outcomes only after a coherent Brain observation at/after reviewAt.
// Once settled, an outcome is immutable evidence memory: later case reopening must
// not rewrite what was actually observed at the original review horizon.
const previousOutcomesByDecision = new Map((previousOutcomeMemory?.outcomes ?? []).map((o) => [o.decisionId, o]));
const observationsById = new Map(observations.map((o) => [o.observationId, o]));
const outcomes = [];
for (const decision of ledger.decisions) {
  const prediction = decision.prediction ?? { event: 'none' };
  const priorOutcome = previousOutcomesByDecision.get(decision.decisionId) ?? null;
  if (priorOutcome?.status === 'settled') {
    if (priorOutcome.event !== prediction.event) fail(`Settled outcome event drift for decision ${decision.decisionId}`);
    if (priorOutcome.probabilityBps !== prediction.probabilityBps) fail(`Settled outcome probability drift for decision ${decision.decisionId}`);
    if (priorOutcome.reviewAt !== prediction.reviewAt) fail(`Settled outcome review horizon drift for decision ${decision.decisionId}`);
    if (!priorOutcome?.evidence?.observationId || !observationsById.has(priorOutcome.evidence.observationId)) {
      fail(`Settled outcome lost its Brain observation evidence: ${decision.decisionId}`);
    }
    outcomes.push(priorOutcome);
    continue;
  }

  if (prediction.event === 'none') {
    outcomes.push({
      outcomeId: outcomeId(decision.decisionId),
      decisionId: decision.decisionId,
      caseId: decision.caseId,
      caseKey: decision.caseKey,
      event: 'none',
      status: 'unscored',
      probabilityBps: null,
      reviewAt: null,
      settledAt: null,
      eventObserved: null,
      evidence: {
        source: FILES.lifecycle,
        observationId: null,
        caseStatusAtReview: null,
        brainObservationAtOrAfterReview: false,
      },
    });
    continue;
  }
  if (prediction.event !== 'case-resolved-by-review') fail(`Unsupported prediction event in ledger: ${prediction.event}`);
  const reviewAt = validIso(prediction.reviewAt);
  if (!reviewAt) fail(`Decision ${decision.decisionId} has invalid reviewAt`);
  const brainAt = Date.parse(currentObservation.observedAt);
  const reviewMs = Date.parse(reviewAt);
  if (brainAt < reviewMs) {
    outcomes.push({
      outcomeId: outcomeId(decision.decisionId),
      decisionId: decision.decisionId,
      caseId: decision.caseId,
      caseKey: decision.caseKey,
      event: prediction.event,
      status: 'pending',
      probabilityBps: prediction.probabilityBps,
      reviewAt,
      settledAt: null,
      eventObserved: null,
      evidence: {
        source: FILES.lifecycle,
        observationId: null,
        caseStatusAtReview: 'not-yet-observed',
        brainObservationAtOrAfterReview: false,
        latestBrainObservedAt: currentObservation.observedAt,
        latestBrainObservationId: currentObservation.observationId,
      },
    });
    continue;
  }

  const eventObserved = !currentObservation.activeCaseKeys.includes(decision.caseKey);
  const observedStatus = eventObserved ? 'inactive' : 'active';
  outcomes.push({
    outcomeId: outcomeId(decision.decisionId),
    decisionId: decision.decisionId,
    caseId: decision.caseId,
    caseKey: decision.caseKey,
    event: prediction.event,
    status: 'settled',
    probabilityBps: prediction.probabilityBps,
    reviewAt,
    settledAt: currentObservation.observedAt,
    eventObserved,
    evidence: {
      source: FILES.lifecycle,
      observationId: currentObservation.observationId,
      caseStatusAtReview: observedStatus,
      brainObservationAtOrAfterReview: true,
      observedAt: currentObservation.observedAt,
      cognitiveChainHash: currentObservation.cognitiveChainHash,
      brainSnapshotHash: currentObservation.brainSnapshotHash,
      activeCaseKeysHash: currentObservation.activeCaseKeysHash,
    },
  });
}

const lessons = outcomes
  .filter((o) => o.status === 'settled')
  .map((o) => deterministicLesson(ledger.decisions.find((d) => d.decisionId === o.decisionId), o))
  .filter(Boolean)
  .slice(-Number(policy.history.maxLessons));
const outcomeMemory = {
  version: OUTCOME_VERSION,
  engineVersion: ENGINE_VERSION,
  generatedAt,
  source: {
    decisionLedgerFile: FILES.ledger,
    decisionLedgerHash: ledger.integrity?.ledgerHash ?? null,
    caseLifecycleFile: FILES.lifecycle,
    caseLifecycleHash: lifecycle.integrity.stateHash,
    cognitiveChainHash: stack.integrity?.chainHash ?? null,
    cognitiveReleaseManifestSha256: coherence.cognitiveManifestSha,
    decisionPolicySha256: policySha,
    learningReleaseManifestSha256: learningReleaseSha,
  },
  decisionCount: ledger.decisionCount,
  outcomeCount: outcomes.length,
  pendingCount: outcomes.filter((o) => o.status === 'pending').length,
  settledCount: outcomes.filter((o) => o.status === 'settled').length,
  scoredCount: outcomes.filter((o) => o.status === 'settled' && typeof o.probabilityBps === 'number').length,
  outcomes,
  lessons,
};
outcomeMemory.integrity = { stateHash: sha256(stableStringify(outcomeMemory)) };

const calibration = buildCalibration(policy, outcomes, ledger.decisions, generatedAt, {
  decisionLedgerHash: ledger.integrity?.ledgerHash ?? null,
  outcomeMemoryHash: outcomeMemory.integrity?.stateHash ?? null,
  cognitiveChainHash: stack.integrity?.chainHash ?? null,
  cognitiveReleaseManifestSha256: coherence.cognitiveManifestSha,
  decisionPolicySha256: policySha,
  learningReleaseManifestSha256: learningReleaseSha,
});

// Build peer experience groups to let future reasoning compare similar mechanisms.
const groupMap = new Map();
for (const record of boundedRecords) {
  const key = record.experienceClass;
  if (!groupMap.has(key)) groupMap.set(key, { experienceClass: key, domain: record.domain, category: record.category, recommendationClass: record.recommendationClass, caseKeys: [] });
  groupMap.get(key).caseKeys.push(record.caseKey);
}
const decisionsByCase = new Map();
for (const d of ledger.decisions) {
  if (!decisionsByCase.has(d.caseKey)) decisionsByCase.set(d.caseKey, []);
  decisionsByCase.get(d.caseKey).push(d);
}
const outcomesByCase = new Map();
for (const o of outcomes) {
  if (!outcomesByCase.has(o.caseKey)) outcomesByCase.set(o.caseKey, []);
  outcomesByCase.get(o.caseKey).push(o);
}
const lessonsByCase = new Map();
for (const l of lessons) {
  if (!lessonsByCase.has(l.caseKey)) lessonsByCase.set(l.caseKey, []);
  lessonsByCase.get(l.caseKey).push(l);
}
const peerExperience = [...groupMap.values()].slice(0, Number(policy.history.maxPeerExperienceGroups)).map((group) => {
  const ds = group.caseKeys.flatMap((k) => decisionsByCase.get(k) ?? []);
  const os = group.caseKeys.flatMap((k) => outcomesByCase.get(k) ?? []).filter((o) => o.status === 'settled');
  const scored = os.filter((o) => typeof o.eventObserved === 'boolean');
  return {
    ...group,
    caseCount: group.caseKeys.length,
    decisionCount: ds.length,
    settledOutcomeCount: os.length,
    observedResolutionRate: scored.length ? Number((mean(scored.map((o) => o.eventObserved ? 1 : 0))).toFixed(6)) : null,
  };
});
const peerByClass = new Map(peerExperience.map((g) => [g.experienceClass, g]));
const activeCases = currentCases.map((item) => {
  const key = caseKey(item);
  const record = recordByKey.get(key) ?? boundedRecords.find((r) => r.caseKey === key);
  const ds = decisionsByCase.get(key) ?? [];
  const os = outcomesByCase.get(key) ?? [];
  const settled = os.filter((o) => o.status === 'settled');
  const ls = lessonsByCase.get(key) ?? [];
  return {
    caseId: item.id,
    caseKey: key,
    experienceClass: experienceClass(item),
    domain: item.domain ?? null,
    category: item.category ?? null,
    entity: item.entity ?? null,
    recommendationClass: item.recommendationClass ?? null,
    riskTier: item.riskTier ?? null,
    confidence: item.confidence ?? null,
    lifecycle: {
      firstSeenAt: record?.firstSeenAt ?? null,
      lastSeenAt: record?.lastSeenAt ?? null,
      activeObservationCount: record?.activeObservationCount ?? null,
      resolutionCount: record?.resolutionCount ?? 0,
      reopenCount: record?.reopenCount ?? 0,
    },
    decisionMemory: {
      decisionCount: ds.length,
      latestDecision: ds.length ? {
        decisionId: ds.at(-1).decisionId,
        recordedAt: ds.at(-1).recordedAt,
        disposition: ds.at(-1).disposition,
        prediction: ds.at(-1).prediction,
      } : null,
    },
    outcomeMemory: {
      settledOutcomeCount: settled.length,
      observedResolutionRate: settled.length ? Number((mean(settled.map((o) => o.eventObserved ? 1 : 0))).toFixed(6)) : null,
      latestLesson: ls.at(-1)?.text ?? null,
    },
    peerExperience: peerByClass.get(experienceClass(item)) ?? null,
  };
});

const contextCore = {
  version: CONTEXT_VERSION,
  engineVersion: ENGINE_VERSION,
  generatedAt,
  status: 'ready',
  headline:
    ledger.decisionCount === 0
      ? `Learning memory is initialized around ${activeCases.length} active Brain case(s); no owner decisions have been recorded yet.`
      : `Learning memory links ${ledger.decisionCount} owner decision(s), ${outcomeMemory.settledCount} settled outcome(s), and ${lessons.length} deterministic lesson(s).`,
  source: {
    cognitiveStackFile: FILES.stack,
    cognitiveChainHash: stack.integrity?.chainHash ?? null,
    cognitiveReleaseId: stack.release?.releaseId ?? null,
    brainFile: FILES.brain,
    brainSha256: coherence.brainSha,
    brainSnapshotHash,
    brainGeneratedAt: brainObservedAt,
    decisionLedgerFile: FILES.ledger,
    decisionLedgerHash: ledger.integrity?.ledgerHash ?? null,
    decisionPolicyFile: FILES.policy,
    decisionPolicySha256: policySha,
    cognitiveReleaseManifestFile: FILES.cognitiveManifest,
    cognitiveReleaseManifestSha256: coherence.cognitiveManifestSha,
    learningReleaseManifestFile: FILES.learningRelease,
    learningReleaseManifestSha256: learningReleaseSha,
  },
  summary: {
    activeCaseCount: activeCases.length,
    rememberedCaseCount: lifecycle.caseCount,
    brainObservationCount: lifecycle.observationCount,
    decisionCount: ledger.decisionCount,
    pendingOutcomeCount: outcomeMemory.pendingCount,
    settledOutcomeCount: outcomeMemory.settledCount,
    scoredOutcomeCount: outcomeMemory.scoredCount,
    lessonCount: lessons.length,
    confidenceCalibrationStatus: calibration.status,
    meanBrierScore: calibration.meanBrierScore,
    highConfidenceMissCount: calibration.highConfidenceMissCount,
  },
  activeCases,
  peerExperience,
  lessons: lessons.slice(-Number(policy.history.maxContextLessons)),
  calibration: {
    status: calibration.status,
    scoredOutcomeCount: calibration.scoredOutcomeCount,
    warmingUntilScoredOutcomes: calibration.warmingUntilScoredOutcomes,
    meanBrierScore: calibration.meanBrierScore,
    observedEventRate: calibration.observedEventRate,
    highConfidenceMissCount: calibration.highConfidenceMissCount,
    bins: calibration.bins,
    byRecommendationClass: calibration.byRecommendationClass,
  },
  operatingContract: {
    sequence: 'Grounded Brain case -> owner decision -> observed case lifecycle -> outcome -> deterministic lesson -> future manual interpretation',
    factsAuthority: 'canonical economic/security inputs via Grounded Brain',
    decisionAuthority: 'human owner',
    outcomeAuthority: 'deterministically observed case lifecycle at coherent Brain snapshots',
    lessonAuthority: 'deterministic association only; no causal claim',
    policyChangeAuthority: 'human only',
    executionAuthority: 'none',
  },
  constraints: {
    apiRequired: false,
    modelCallPerformed: false,
    executionAllowed: false,
    walletActionAllowed: false,
    autonomousCapitalActionAllowed: false,
    autonomousRepositoryCodeMutationAllowed: false,
    autonomousMethodologyMutationAllowed: false,
    autonomousPolicyMutationAllowed: false,
    decisionRecordsExecutable: false,
  },
};
const learningHash = sha256(stableStringify(contextCore));
const context = { ...contextCore, integrity: { learningHash } };

const brief = [
  '# The Holding — Decision & Outcome Learning Loop',
  '',
  `Generated: ${generatedAt}`,
  `Status: ${context.status}`,
  `Cognitive chain: ${context.source.cognitiveChainHash}`,
  '',
  '## Memory',
  '',
  `Active Brain cases: ${context.summary.activeCaseCount}`,
  `Remembered cases: ${context.summary.rememberedCaseCount}`,
  `Coherent Brain observations: ${context.summary.brainObservationCount}`,
  `Owner decisions: ${context.summary.decisionCount}`,
  `Settled outcomes: ${context.summary.settledOutcomeCount}`,
  `Lessons: ${context.summary.lessonCount}`,
  '',
  '## Confidence calibration',
  '',
  `Status: ${context.summary.confidenceCalibrationStatus}`,
  `Scored outcomes: ${context.summary.scoredOutcomeCount}`,
  `Mean Brier score: ${context.summary.meanBrierScore ?? 'n/a'}`,
  `High-confidence misses: ${context.summary.highConfidenceMissCount}`,
  '',
  '## Safety',
  '',
  'No API. No model call. No execution authority. No wallet action. No automatic policy mutation.',
  '',
  'This layer learns by persistent, verifiable experience memory — not by silently changing model weights or execution rules.',
  '',
].join('\n');

writeJson(FILES.lifecycle, lifecycle);
writeJson(FILES.outcomes, outcomeMemory);
writeJson(FILES.calibration, calibration);
writeJson(FILES.context, context);
ensureDir(FILES.brief);
fs.writeFileSync(path.join(ROOT, FILES.brief), brief, 'utf8');

console.log(JSON.stringify({
  status: 'ready',
  engineVersion: ENGINE_VERSION,
  generatedAt,
  cognitiveChainHash: context.source.cognitiveChainHash,
  learningHash,
  activeCases: context.summary.activeCaseCount,
  rememberedCases: context.summary.rememberedCaseCount,
  decisions: context.summary.decisionCount,
  settledOutcomes: context.summary.settledOutcomeCount,
  lessons: context.summary.lessonCount,
  calibration: context.summary.confidenceCalibrationStatus,
  executionAuthority: 'none',
}, null, 2));
