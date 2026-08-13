#!/usr/bin/env node
/**
 * THE HOLDING BRAIN — GROUNDED REASONING GATEWAY v0.1
 *
 * Purpose:
 *   Convert canonical Observer + Security intelligence into a compact,
 *   evidence-bound reasoning layer answering:
 *     1. What changed?
 *     2. Why does it matter?
 *     3. What follows?
 *     4. What should be done?
 *     5. What evidence supports each conclusion?
 *
 * This is intentionally NOT an LLM.
 * It is the deterministic grounding substrate that future GPT / Claude /
 * other models may read. No reasoning case is allowed without evidence.
 *
 * Safety:
 *   - read-only over canonical economic/security inputs;
 *   - proposal-only recommendations;
 *   - no wallet actions;
 *   - no methodology mutation;
 *   - no source-data mutation;
 *   - no workflow-plane mutation;
 *   - no secret access;
 *   - unknown/stale remains unknown/stale.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = process.cwd();

const FILES = {
  change: 'intelligence/change-intelligence.json',
  systemMemory: 'intelligence/system-memory.json',
  security: 'security/security-intelligence.json',
  securityMemory: 'security/security-memory.json',
  policy: 'intelligence/brain-policy.json',
  output: 'intelligence/brain-intelligence.json',
  history: 'intelligence/brain-history.json',
  brief: 'intelligence/brain-brief.md',
};

const ENGINE_VERSION = '0.1-deterministic-evidence-bound-reasoner';
const OUTPUT_VERSION = '0.1-grounded-reasoning-gateway';
const HISTORY_VERSION = '0.1-brain-history';

function fail(message) {
  throw new Error(message);
}

function readText(rel) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) fail(`Required file missing: ${rel}`);
  const text = fs.readFileSync(abs, 'utf8');
  if (!text.trim()) fail(`Required file empty: ${rel}`);
  return text;
}

function readJson(rel) {
  const text = readText(rel);
  try {
    return { data: JSON.parse(text), text };
  } catch (error) {
    fail(`Invalid JSON in ${rel}: ${error.message}`);
  }
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, stableValue(value[key])])
    );
  }
  return value;
}

function stableStringify(value) {
  return JSON.stringify(stableValue(value));
}

function finiteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function isoOrNull(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

function ageHours(iso, nowMs) {
  if (!iso) return null;
  return Math.max(0, (nowMs - Date.parse(iso)) / 3_600_000);
}

function sourceGeneratedAt(key, obj) {
  if (key === 'securityMemory') {
    return isoOrNull(obj?.latest?.generatedAt ?? obj?.generatedAt);
  }
  if (key === 'systemMemory') {
    return isoOrNull(obj?.generatedAt ?? obj?.latest?.generatedAt);
  }
  return isoOrNull(obj?.generatedAt);
}

function evidence(source, pointer, value, sourceSha256, observedAt, extra = {}) {
  return {
    source,
    pointer,
    value,
    sourceSha256,
    observedAt: observedAt ?? null,
    interpretation: extra.interpretation ?? 'direct',
    ...(extra.selector ? { selector: extra.selector } : {}),
    ...(extra.note ? { note: extra.note } : {}),
  };
}

function recommendationForCategory(category, item = {}) {
  const map = {
    'adapter-state': {
      implication:
        'Until the adapter returns to a reproducible ok state, any full-current measurement that depends on it remains unsupported.',
      recommendation:
        'Keep the adapter explicitly warming/unknown and use the normal bounded resolver or collector path when the required interval/source becomes available. Do not substitute zero.',
      recommendationClass: 'data-gap-resolution',
      riskTier: 'low',
    },
    'productivity-coverage': {
      implication:
        'The covered productive rate remains useful only within its stated coverage; unresolved productive capital must stay excluded rather than be fabricated.',
      recommendation:
        'Prioritize the unresolved adapter(s) contributing to the coverage gap, preserve covered-rate semantics, and promote to full coverage only after reproducible evidence exists.',
      recommendationClass: 'coverage-resolution',
      riskTier: 'low',
    },
    'rewards-completeness': {
      implication:
        'Pending reward routes make earned-value memory incomplete even when currently measured routes are correct.',
      recommendation:
        'Resolve only the pending reward route(s) with bounded current-state reads and claimed-state checks. Preserve solved routes and never treat pending as zero.',
      recommendationClass: 'reward-route-resolution',
      riskTier: 'low',
    },
    'stable-capital-coverage': {
      implication:
        'The current Stable Capital rate is not fully observed, so replacing the last verified full-coverage rate would overstate certainty.',
      recommendation:
        'Preserve last-full-coverage display semantics and resolve the current warming stable position before promoting a new full-current APY.',
      recommendationClass: 'stable-coverage-resolution',
      riskTier: 'low',
    },
    'critical-surface-change': {
      implication:
        'A security-sensitive surface changed. The change can be legitimate, but it should remain correlated with the scan that followed.',
      recommendation:
        'Review the changed surface against the intended patch and regression baseline. Do not infer compromise from the hash change alone.',
      recommendationClass: 'security-review',
      riskTier: 'medium',
    },
    'dom-innerhtml': {
      implication:
        'A DOM execution sink exists. Risk depends on whether external or user-controlled values can reach it.',
      recommendation:
        'Classify the sink by provenance first. Replace with textContent or safe DOM construction only where untrusted/dynamic data can reach the sink; avoid blind bulk rewrites.',
      recommendationClass: 'security-provenance-triage',
      riskTier: 'medium',
    },
    'external-script-no-sri': {
      implication:
        'A third-party script origin is part of the browser trust boundary.',
      recommendation:
        'Assess SRI feasibility, self-hosting, removal, or tighter CSP for the exact script. Preserve analytics behavior until the safer replacement is verified.',
      recommendationClass: 'third-party-trust-review',
      riskTier: 'medium',
    },
  };

  return map[category] ?? {
    implication:
      'The signal is real, but the current deterministic policy has no category-specific consequence beyond continued observation.',
    recommendation:
      'Inspect the cited evidence before proposing any change. Do not invent a remediation path that is not supported by canonical data.',
    recommendationClass: 'evidence-review',
    riskTier: 'low',
  };
}

function priorityScore(caseObj) {
  const severity = caseObj.severity;
  if (severity === 'critical') return 100;
  if (severity === 'high') return 90;
  if (severity === 'medium') return 65;
  if (severity === 'watch') return 50;
  return 25;
}

function dedupeEvidence(items) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const key = stableStringify({
      source: item.source,
      pointer: item.pointer,
      selector: item.selector ?? null,
      value: item.value,
      sourceSha256: item.sourceSha256,
    });
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function validatePolicy(policy) {
  if (policy?.version !== '0.1-grounded-brain-policy') {
    fail(`Unexpected brain policy version: ${policy?.version}`);
  }
  if (policy?.mode !== 'read-only-proposal-only') {
    fail(`Brain policy must remain read-only-proposal-only`);
  }
  if (policy?.grounding?.evidenceRequiredForEveryReasoningCase !== true) {
    fail('Brain policy must require evidence for every reasoning case');
  }
  if (policy?.actions?.autonomousCapitalActionAllowed !== false) {
    fail('Autonomous capital action must be disabled in v0.1');
  }
  if (policy?.actions?.autonomousRepositoryCodeMutationAllowed !== false) {
    fail('Autonomous repository code mutation must be disabled in v0.1');
  }
}

const now = new Date();
const nowMs = now.getTime();

const loaded = {
  change: readJson(FILES.change),
  systemMemory: readJson(FILES.systemMemory),
  security: readJson(FILES.security),
  securityMemory: readJson(FILES.securityMemory),
  policy: readJson(FILES.policy),
};

const change = loaded.change.data;
const systemMemory = loaded.systemMemory.data;
const security = loaded.security.data;
const securityMemory = loaded.securityMemory.data;
const policy = loaded.policy.data;

validatePolicy(policy);

if (!Array.isArray(change?.watchNext)) fail('change-intelligence.watchNext must be an array');
if (!Array.isArray(change?.whatChanged)) fail('change-intelligence.whatChanged must be an array');
if (!security?.severityCounts || typeof security.severityCounts !== 'object') {
  fail('security-intelligence.severityCounts missing');
}
if (!Array.isArray(security?.currentFindings)) fail('security-intelligence.currentFindings must be an array');

const sourceMeta = {};
for (const key of ['change', 'systemMemory', 'security', 'securityMemory']) {
  const rel = FILES[key];
  const obj = loaded[key].data;
  const generatedAt = sourceGeneratedAt(key, obj);
  const maxAgeHours = Number(policy?.grounding?.maxSourceAgeHours?.[key] ?? 48);
  const age = ageHours(generatedAt, nowMs);
  const freshness = age === null
    ? 'unknown'
    : age <= maxAgeHours
      ? 'fresh'
      : 'stale';

  sourceMeta[key] = {
    file: rel,
    sha256: sha256(loaded[key].text),
    generatedAt,
    ageHours: age === null ? null : Number(age.toFixed(3)),
    expectedMaxAgeHours: maxAgeHours,
    freshness,
  };
}

const policySha256 = sha256(loaded.policy.text);
const allSourcesFresh = Object.values(sourceMeta).every((x) => x.freshness === 'fresh');

const inputCompositeHash = sha256(stableStringify({
  sourceHashes: Object.fromEntries(
    Object.entries(sourceMeta).map(([k, v]) => [k, v.sha256])
  ),
  policySha256,
}));

let previousHistory = [];
if (fs.existsSync(path.join(ROOT, FILES.history))) {
  const historyRaw = fs.readFileSync(path.join(ROOT, FILES.history), 'utf8').trim();
  if (historyRaw) {
    const parsed = JSON.parse(historyRaw);
    if (parsed?.version !== HISTORY_VERSION || !Array.isArray(parsed?.observations)) {
      fail('Existing brain-history.json has unexpected schema');
    }
    previousHistory = parsed.observations;
  }
}

const lastInputHash = previousHistory.at(-1)?.inputCompositeHash ?? null;
const mode = previousHistory.length === 0
  ? 'baseline'
  : lastInputHash === inputCompositeHash
    ? 'steady'
    : 'delta';

const cases = [];

// Economic/system watch cases — already normalized by Observer.
change.watchNext.forEach((item, index) => {
  const category = String(item?.category ?? 'unknown');
  const policyResult = recommendationForCategory(category, item);
  const ev = evidence(
    FILES.change,
    `/watchNext/${index}`,
    item,
    sourceMeta.change.sha256,
    sourceMeta.change.generatedAt,
    { note: 'Direct normalized watch item emitted by The Holding Observer.' }
  );

  cases.push({
    id: sha256(stableStringify({
      domain: 'economic',
      entity: item?.entity ?? null,
      category,
      summary: item?.summary ?? null,
    })).slice(0, 24),
    domain: 'economic',
    severity: item?.severity ?? 'watch',
    category,
    entity: item?.entity ?? null,
    signal: item?.summary ?? 'Observer watch item.',
    whyItMatters:
      typeof item?.whyItMatters === 'string' && item.whyItMatters.trim()
        ? item.whyItMatters.trim()
        : policyResult.implication,
    whatFollows: policyResult.implication,
    whatShouldBeDone: policyResult.recommendation,
    recommendationClass: policyResult.recommendationClass,
    riskTier: policyResult.riskTier,
    actionMode: 'proposal-only',
    confidence: allSourcesFresh ? 'high' : 'limited-by-source-freshness',
    evidence: [ev],
  });
});

// Material Observer changes are also reasoning inputs.
change.whatChanged.forEach((item, index) => {
  const category = String(item?.category ?? 'system-change');
  const policyResult = recommendationForCategory(category, item);
  cases.push({
    id: sha256(stableStringify({
      domain: 'system-change',
      entity: item?.entity ?? null,
      category,
      summary: item?.summary ?? item,
    })).slice(0, 24),
    domain: 'system-change',
    severity: item?.severity ?? 'watch',
    category,
    entity: item?.entity ?? null,
    signal: item?.summary ?? 'Material Observer change.',
    whyItMatters: item?.whyItMatters ?? policyResult.implication,
    whatFollows: policyResult.implication,
    whatShouldBeDone: policyResult.recommendation,
    recommendationClass: policyResult.recommendationClass,
    riskTier: policyResult.riskTier,
    actionMode: 'proposal-only',
    confidence: allSourcesFresh ? 'high' : 'limited-by-source-freshness',
    evidence: [
      evidence(
        FILES.change,
        `/whatChanged/${index}`,
        item,
        sourceMeta.change.sha256,
        sourceMeta.change.generatedAt,
        { note: 'Direct material-change event emitted by The Holding Observer.' }
      ),
    ],
  });
});

// Security critical/high — each remains explicit.
security.currentFindings
  .filter((finding) => ['critical', 'high'].includes(finding?.severity))
  .forEach((finding, index) => {
    const category = String(finding?.category ?? 'security-finding');
    const policyResult = recommendationForCategory(category, finding);
    cases.push({
      id: `security-${String(finding?.id ?? index).slice(0, 24)}`,
      domain: 'security',
      severity: finding?.severity,
      category,
      entity: finding?.entity ?? finding?.file ?? null,
      signal: finding?.summary ?? 'Security finding.',
      whyItMatters: finding?.whyItMatters ?? policyResult.implication,
      whatFollows:
        finding?.severity === 'critical'
          ? 'Critical security evidence blocks any assumption of normal operation until the finding is understood and contained.'
          : policyResult.implication,
      whatShouldBeDone:
        finding?.severity === 'critical'
          ? 'Escalate for immediate human review. Do not expose matched secret material, do not broaden permissions, and do not allow autonomous remediation.'
          : policyResult.recommendation,
      recommendationClass:
        finding?.severity === 'critical'
          ? 'human-security-escalation'
          : policyResult.recommendationClass,
      riskTier: finding?.severity === 'critical' ? 'critical' : 'high',
      actionMode: 'proposal-only',
      confidence: allSourcesFresh ? 'high' : 'limited-by-source-freshness',
      evidence: [
        evidence(
          FILES.security,
          `/currentFindings/${security.currentFindings.indexOf(finding)}`,
          finding,
          sourceMeta.security.sha256,
          sourceMeta.security.generatedAt,
          { note: 'Direct current finding emitted by The Holding Security Sentinel.' }
        ),
      ],
    });
  });

// Aggregate medium security debt by category to avoid 42 repetitive reasoning cases.
const mediumByCategory = new Map();
security.currentFindings
  .filter((finding) => finding?.severity === 'medium')
  .forEach((finding) => {
    const category = String(finding?.category ?? 'security-medium');
    if (!mediumByCategory.has(category)) mediumByCategory.set(category, []);
    mediumByCategory.get(category).push(finding);
  });

for (const [category, findings] of [...mediumByCategory.entries()].sort()) {
  const policyResult = recommendationForCategory(category, findings[0]);
  const representative = findings.slice(0, 3).map((f) => ({
    id: f?.id ?? null,
    file: f?.file ?? null,
    line: f?.line ?? null,
    summary: f?.summary ?? null,
  }));

  cases.push({
    id: sha256(stableStringify({
      domain: 'security',
      severity: 'medium',
      category,
      count: findings.length,
    })).slice(0, 24),
    domain: 'security',
    severity: 'medium',
    category,
    entity: findings.length === 1
      ? (findings[0]?.file ?? findings[0]?.entity ?? null)
      : `${findings.length} current findings`,
    signal: `${findings.length} current medium security finding(s) in category ${category}.`,
    whyItMatters: findings[0]?.whyItMatters ?? policyResult.implication,
    whatFollows: policyResult.implication,
    whatShouldBeDone: policyResult.recommendation,
    recommendationClass: policyResult.recommendationClass,
    riskTier: 'medium',
    actionMode: 'proposal-only',
    confidence: allSourcesFresh ? 'high' : 'limited-by-source-freshness',
    evidence: [
      evidence(
        FILES.security,
        '/currentFindings',
        {
          derivedCount: findings.length,
          representative,
        },
        sourceMeta.security.sha256,
        sourceMeta.security.generatedAt,
        {
          interpretation: 'derived-from-direct-findings',
          selector: `severity=medium&category=${category}`,
          note: 'Count is derived deterministically from current Security Sentinel findings.',
        }
      ),
    ],
  });
}

cases.sort((a, b) => {
  const score = priorityScore(b) - priorityScore(a);
  if (score !== 0) return score;
  return String(a.category).localeCompare(String(b.category));
});

const maxCases = Number(policy?.reasoning?.maxCases ?? 25);
const reasoningCases = cases.slice(0, maxCases);

for (const item of reasoningCases) {
  if (!Array.isArray(item.evidence) || item.evidence.length === 0) {
    fail(`Reasoning case ${item.id} has no evidence`);
  }
  if (item.actionMode !== 'proposal-only') {
    fail(`Reasoning case ${item.id} violates proposal-only policy`);
  }
}

const severityCounts = security.severityCounts;
const critical = finiteNumber(severityCounts.critical) ? severityCounts.critical : 0;
const high = finiteNumber(severityCounts.high) ? severityCounts.high : 0;
const medium = finiteNumber(severityCounts.medium) ? severityCounts.medium : 0;

let status = 'ready';
if (!allSourcesFresh) status = 'insufficient';
else if (critical > 0) status = 'critical';
else if (high > 0 || reasoningCases.length > 0) status = 'watch';

const economicChangeCount = change.whatChanged.length;
const economicWatchCount = change.watchNext.length;
const securityNewCount = Array.isArray(security?.whatChanged?.newFindings)
  ? security.whatChanged.newFindings.length
  : 0;
const securityResolvedCount = Array.isArray(security?.whatChanged?.resolvedFindings)
  ? security.whatChanged.resolvedFindings.length
  : 0;

const whatChangedAnswer = economicChangeCount === 0 && securityNewCount === 0 && securityResolvedCount === 0
  ? 'No new material Observer or Security change events are present in the current canonical inputs. Existing watch items remain active.'
  : `Current canonical inputs contain ${economicChangeCount} material Observer change(s), ${securityNewCount} new security finding event(s), and ${securityResolvedCount} resolved security finding event(s).`;

const evidenceLedger = dedupeEvidence(reasoningCases.flatMap((item) => item.evidence));

const correctionMeta =
  change?.bridge?.memoryVault?.corrections
  ?? systemMemory?.memoryVault?.corrections
  ?? null;

const output = {
  version: OUTPUT_VERSION,
  reasonerVersion: ENGINE_VERSION,
  generatedAt: now.toISOString(),
  mode,
  status,
  headline:
    status === 'critical'
      ? 'Grounded reasoning detected a critical security condition requiring human escalation.'
      : status === 'insufficient'
        ? 'Grounded reasoning is limited because one or more required canonical sources are stale or missing freshness metadata.'
        : reasoningCases.length > 0
          ? `${reasoningCases.length} evidence-bound reasoning case(s) are active across economic and security memory.`
          : 'Canonical memory is fresh and no active reasoning case requires attention.',
  currentPosture: {
    observer: {
      mode: change?.mode ?? null,
      materialChangeCount: economicChangeCount,
      watchCount: economicWatchCount,
      snapshotHash: change?.bridge?.snapshotHash ?? null,
      sourceCompositeHash: change?.bridge?.sourceCompositeHash ?? null,
    },
    memory: {
      vaultRunCount: change?.bridge?.memoryVault?.runCount ?? null,
      vaultEventCount: change?.bridge?.memoryVault?.eventCount ?? null,
      correctionEntryCount: correctionMeta?.entryCount ?? null,
      correctionPrecedence: correctionMeta?.interpretationPrecedence ?? null,
    },
    security: {
      status: security?.status ?? null,
      critical,
      high,
      medium,
      newFindingEvents: securityNewCount,
      resolvedFindingEvents: securityResolvedCount,
    },
  },
  questions: {
    whatChanged: {
      answer: whatChangedAnswer,
      confidence: allSourcesFresh ? 'high' : 'limited-by-source-freshness',
      evidence: dedupeEvidence([
        evidence(
          FILES.change,
          '/whatChanged',
          change.whatChanged,
          sourceMeta.change.sha256,
          sourceMeta.change.generatedAt
        ),
        evidence(
          FILES.security,
          '/whatChanged',
          security?.whatChanged ?? null,
          sourceMeta.security.sha256,
          sourceMeta.security.generatedAt
        ),
      ]),
    },
    whyItMatters: reasoningCases.map((item) => ({
      id: item.id,
      entity: item.entity,
      answer: item.whyItMatters,
      evidenceRefs: item.evidence.map((ev) => ({
        source: ev.source,
        pointer: ev.pointer,
        selector: ev.selector ?? null,
        sourceSha256: ev.sourceSha256,
      })),
    })),
    whatFollows: reasoningCases.map((item) => ({
      id: item.id,
      entity: item.entity,
      answer: item.whatFollows,
      confidence: item.confidence,
    })),
    whatShouldBeDone: reasoningCases.map((item) => ({
      id: item.id,
      entity: item.entity,
      answer: item.whatShouldBeDone,
      recommendationClass: item.recommendationClass,
      riskTier: item.riskTier,
      actionMode: item.actionMode,
    })),
  },
  reasoningCases,
  evidenceLedger,
  grounding: {
    allRequiredSourcesFresh: allSourcesFresh,
    sources: sourceMeta,
    policy: {
      file: FILES.policy,
      sha256: policySha256,
      version: policy.version,
      mode: policy.mode,
    },
    principles: [
      'No reasoning case without evidence.',
      'Unknown or stale remains unknown or stale.',
      'Correction ledger interpretation takes precedence over superseded historical interpretation when applicable.',
      'Recommendations are proposals, not executable actions.',
      'Security-critical workflow-plane changes remain human-gated.',
    ],
  },
  constraints: {
    actionMode: 'proposal-only',
    autonomousCapitalActionAllowed: false,
    autonomousRepositoryCodeMutationAllowed: false,
    autonomousMethodologyMutationAllowed: false,
    sourceDataMutationAllowed: false,
    workflowPlaneMutationAllowed: false,
    secretAccessRequired: false,
  },
  bridge: {
    purpose:
      'Canonical evidence-bound reasoning packet for future human/AI interpretation. Read this before opening large memory artifacts.',
    inputCompositeHash,
    snapshotHash: null,
    previousInputCompositeHash: lastInputHash,
  },
};

output.bridge.snapshotHash = sha256(stableStringify({
  ...output,
  generatedAt: null,
  bridge: {
    ...output.bridge,
    snapshotHash: null,
  },
}));

const observation = {
  generatedAt: output.generatedAt,
  inputCompositeHash,
  snapshotHash: output.bridge.snapshotHash,
  mode,
  status,
  reasoningCaseCount: reasoningCases.length,
  economicMaterialChangeCount: economicChangeCount,
  economicWatchCount,
  security: { critical, high, medium },
  sourceHashes: Object.fromEntries(
    Object.entries(sourceMeta).map(([k, v]) => [k, v.sha256])
  ),
  policySha256,
};

const historyObservations = [...previousHistory];
if (lastInputHash !== inputCompositeHash) {
  historyObservations.push(observation);
}

const maxHistory = Number(policy?.history?.maxObservations ?? 730);
const boundedHistory = historyObservations.slice(-maxHistory);

const history = {
  version: HISTORY_VERSION,
  reasonerVersion: ENGINE_VERSION,
  lastUpdatedAt: output.generatedAt,
  policy: {
    maxObservations: maxHistory,
    longTermMemoryAuthority: 'intelligence/memory-vault/',
    note:
      'Brain history is bounded operational reasoning history. Economic canonical deep memory remains the Memory Vault; Security deep memory remains the Security Vault.',
  },
  observationCount: boundedHistory.length,
  observations: boundedHistory,
};

const briefLines = [
  '# The Holding Brain — Grounded Reasoning Brief',
  '',
  `Generated: ${output.generatedAt}`,
  `Mode: ${output.mode}`,
  `Status: ${output.status}`,
  '',
  `## ${output.headline}`,
  '',
  '### What changed',
  output.questions.whatChanged.answer,
  '',
  '### Why it matters / What follows / What should be done',
];

if (reasoningCases.length === 0) {
  briefLines.push('', '- No active reasoning cases.');
} else {
  reasoningCases.forEach((item, index) => {
    briefLines.push(
      '',
      `#### ${index + 1}. ${item.entity ?? item.category}`,
      `- Signal: ${item.signal}`,
      `- Why it matters: ${item.whyItMatters}`,
      `- What follows: ${item.whatFollows}`,
      `- Proposed next step: ${item.whatShouldBeDone}`,
      `- Action mode: ${item.actionMode}`,
      `- Evidence: ${item.evidence.map((ev) => `${ev.source}${ev.pointer}`).join(', ')}`
    );
  });
}

briefLines.push(
  '',
  '---',
  '',
  'This layer does not execute capital actions, mutate methodology, rewrite source data, or modify the workflow plane.',
  'Every reasoning case is evidence-bound and proposal-only.',
  ''
);

fs.mkdirSync(path.dirname(path.join(ROOT, FILES.output)), { recursive: true });
fs.writeFileSync(
  path.join(ROOT, FILES.output),
  JSON.stringify(output, null, 2) + '\n',
  'utf8'
);
fs.writeFileSync(
  path.join(ROOT, FILES.history),
  JSON.stringify(history, null, 2) + '\n',
  'utf8'
);
fs.writeFileSync(
  path.join(ROOT, FILES.brief),
  briefLines.join('\n'),
  'utf8'
);

console.log(JSON.stringify({
  version: output.version,
  reasonerVersion: output.reasonerVersion,
  generatedAt: output.generatedAt,
  mode: output.mode,
  status: output.status,
  reasoningCaseCount: output.reasoningCases.length,
  evidenceCount: output.evidenceLedger.length,
  allRequiredSourcesFresh: output.grounding.allRequiredSourcesFresh,
  inputCompositeHash: output.bridge.inputCompositeHash,
  snapshotHash: output.bridge.snapshotHash,
}, null, 2));
