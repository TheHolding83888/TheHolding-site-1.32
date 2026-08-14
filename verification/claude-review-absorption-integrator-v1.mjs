#!/usr/bin/env node
import fs from 'node:fs';
import crypto from 'node:crypto';

const fail = (m) => { throw new Error(m); };
const read = p => fs.readFileSync(p, 'utf8');
const write = (p, s) => fs.writeFileSync(p, s, 'utf8');
const sha = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const bytes = p => fs.statSync(p).size;

function replaceExact(file, before, after, label) {
  const text = read(file);
  const count = text.split(before).length - 1;
  if (count !== 1) fail(`${label}: expected exactly one anchor in ${file}, got ${count}`);
  write(file, text.replace(before, after));
}

function mutateJson(file, fn) {
  const obj = JSON.parse(read(file));
  fn(obj);
  write(file, JSON.stringify(obj, null, 2) + '\n');
}

function rebindManifest(file) {
  const m = JSON.parse(read(file));
  const entries = Array.isArray(m.files) ? m.files : Array.isArray(m.staticFiles) ? m.staticFiles : null;
  if (!entries) fail(`No bindable file list in ${file}`);
  for (const e of entries) {
    if (!e.file || !fs.existsSync(e.file)) fail(`${file}: missing bound file ${e.file}`);
    e.sha256 = sha(e.file);
    if (Object.hasOwn(e, 'bytes')) e.bytes = bytes(e.file);
  }
  write(file, JSON.stringify(m, null, 2) + '\n');
}

// ---------------------------------------------------------------------------
// T1, improved: reuse existing recommendationClass instead of duplicating a
// second Brain caseClass. Policy deterministically maps recommendation classes
// to experience eligibility; high/critical Security always requires a decision
// path even if its category is new.
// ---------------------------------------------------------------------------
mutateJson('intelligence/learning/decision-policy.json', p => {
  p.experienceEligibility = {
    version: '0.1-decision-quality-gate',
    decisionWorthyRecommendationClasses: [
      'security-review',
      'security-provenance-triage',
      'third-party-trust-review',
      'human-security-escalation'
    ],
    dataHygieneRecommendationClasses: [
      'data-gap-resolution',
      'coverage-resolution',
      'reward-route-resolution',
      'stable-coverage-resolution',
      'evidence-review'
    ],
    securitySeveritiesAlwaysDecisionWorthy: ['high', 'critical'],
    rule: 'All Brain cases remain observable lifecycle memory. Only decision-worthy cases may receive owner Decision Learning records, scored outcomes, calibration, deterministic lessons, or active Proposal work. Unknown eligibility fails closed.'
  };
});

replaceExact(
  'intelligence/learning/decision-learning-engine.mjs',
  "function experienceClass(caseObj) {\n  return `EC-${sha256(stableStringify({\n    domain: caseObj?.domain ?? null,\n    category: caseObj?.category ?? null,\n    recommendationClass: caseObj?.recommendationClass ?? null,\n  })).slice(0, 16)}`;\n}\n",
  "function experienceClass(caseObj) {\n  return `EC-${sha256(stableStringify({\n    domain: caseObj?.domain ?? null,\n    category: caseObj?.category ?? null,\n    recommendationClass: caseObj?.recommendationClass ?? null,\n  })).slice(0, 16)}`;\n}\nfunction experienceEligibility(policy, caseObj) {\n  const cfg = policy?.experienceEligibility ?? {};\n  const recommendationClass = caseObj?.recommendationClass ?? null;\n  const severity = String(caseObj?.severity ?? '').toLowerCase();\n  const domain = caseObj?.domain ?? null;\n  if (domain === 'security' && (cfg.securitySeveritiesAlwaysDecisionWorthy ?? []).includes(severity)) return 'decision-worthy';\n  if ((cfg.decisionWorthyRecommendationClasses ?? []).includes(recommendationClass)) return 'decision-worthy';\n  if ((cfg.dataHygieneRecommendationClasses ?? []).includes(recommendationClass)) return 'data-hygiene';\n  fail(`Unclassified experience eligibility for recommendationClass=${recommendationClass} domain=${domain} severity=${severity}`);\n}\n",
  'learning eligibility helper'
);

replaceExact(
  'intelligence/learning/decision-learning-engine.mjs',
  "const policy = policyLoaded.data;\nconst ledger = ledgerLoaded.data;\nconst policySha = sha256(policyLoaded.text);",
  "const policy = policyLoaded.data;\nconst ledger = ledgerLoaded.data;\nfor (const decision of ledger.decisions) {\n  if (experienceEligibility(policy, decision.sourceCase ?? {}) !== 'decision-worthy') {\n    fail(`Decision ${decision.decisionId} is bound to a non-decision-worthy Brain case; refusing outcome learning/calibration noise`);\n  }\n}\nconst policySha = sha256(policyLoaded.text);",
  'learning ledger eligibility gate'
);

replaceExact(
  'intelligence/learning/decision-learning-engine.mjs',
  "    confidence: item.confidence ?? null,\n    lifecycle: {",
  "    confidence: item.confidence ?? null,\n    experienceEligibility: experienceEligibility(policy, item),\n    lifecycle: {",
  'learning active case eligibility'
);

replaceExact(
  'intelligence/learning/decision-learning-engine.mjs',
  "    activeCaseCount: activeCases.length,\n    rememberedCaseCount: lifecycle.caseCount,",
  "    activeCaseCount: activeCases.length,\n    decisionWorthyActiveCaseCount: activeCases.filter((x) => x.experienceEligibility === 'decision-worthy').length,\n    dataHygieneActiveCaseCount: activeCases.filter((x) => x.experienceEligibility === 'data-hygiene').length,\n    rememberedCaseCount: lifecycle.caseCount,",
  'learning summary eligibility counts'
);

replaceExact(
  'intelligence/learning/decision-learning-engine.mjs',
  "  `Active Brain cases: ${context.summary.activeCaseCount}`,\n  `Remembered cases: ${context.summary.rememberedCaseCount}` ,",
  "  `Active Brain cases observed: ${context.summary.activeCaseCount}`,\n  `Decision-worthy active cases: ${context.summary.decisionWorthyActiveCaseCount}`,\n  `Data-hygiene active cases: ${context.summary.dataHygieneActiveCaseCount}`,\n  `Remembered cases: ${context.summary.rememberedCaseCount}` ,",
  'learning brief eligibility counts'
);

// The exact brief anchor above may differ by spacing in the live file; provide a
// second fail-closed replacement path only if the first expected literal failed
// before writing. This line is never reached on mismatch because replaceExact
// throws, intentionally forcing us to inspect drift instead of guessing.

replaceExact(
  'intelligence/learning/decision-recorder.mjs',
  "if (!Array.isArray(sourceCase.evidence) || sourceCase.evidence.length === 0) fail('Source Brain case has no evidence');\n\nconst recordedAt = new Date().toISOString();",
  "if (!Array.isArray(sourceCase.evidence) || sourceCase.evidence.length === 0) fail('Source Brain case has no evidence');\nconst eligibility = policy.experienceEligibility ?? {};\nconst decisionWorthy =\n  (sourceCase.domain === 'security' && (eligibility.securitySeveritiesAlwaysDecisionWorthy ?? []).includes(String(sourceCase.severity ?? '').toLowerCase())) ||\n  (eligibility.decisionWorthyRecommendationClasses ?? []).includes(sourceCase.recommendationClass);\nif (!decisionWorthy) {\n  fail(`Brain case ${caseId} is observational/data-hygiene, not decision-worthy; it may remain in lifecycle memory but cannot enter owner Decision Learning or calibration`);\n}\n\nconst recordedAt = new Date().toISOString();",
  'decision recorder quality gate'
);

replaceExact(
  'intelligence/learning/independent-learning-reviewer.mjs',
  "check('contextActiveCaseCoverage', Array.isArray(context?.activeCases) && context.activeCases.length === activeBrainKeys.size && context.activeCases.every((x) => activeBrainKeys.has(x.caseKey)), 'Learning context active-case coverage mismatch');\n",
  "check('contextActiveCaseCoverage', Array.isArray(context?.activeCases) && context.activeCases.length === activeBrainKeys.size && context.activeCases.every((x) => activeBrainKeys.has(x.caseKey)), 'Learning context active-case coverage mismatch');\nconst eligibilityCfg = policy?.experienceEligibility ?? {};\nconst decisionClassSet = new Set(eligibilityCfg.decisionWorthyRecommendationClasses ?? []);\nconst hygieneClassSet = new Set(eligibilityCfg.dataHygieneRecommendationClasses ?? []);\nfor (const c of context?.activeCases ?? []) {\n  const expectedEligibility = c.domain === 'security' && (eligibilityCfg.securitySeveritiesAlwaysDecisionWorthy ?? []).includes(String(c.riskTier === 'critical' ? 'critical' : c.riskTier === 'high' ? 'high' : '').toLowerCase())\n    ? 'decision-worthy'\n    : decisionClassSet.has(c.recommendationClass)\n      ? 'decision-worthy'\n      : hygieneClassSet.has(c.recommendationClass)\n        ? 'data-hygiene'\n        : null;\n  check(`experienceEligibility:${c.caseKey}`, expectedEligibility !== null && c.experienceEligibility === expectedEligibility, `Learning case eligibility mismatch: ${c.caseKey}`);\n}\nfor (const d of ledger.decisions ?? []) {\n  const sc = d.sourceCase ?? {};\n  const eligible = (sc.domain === 'security' && (eligibilityCfg.securitySeveritiesAlwaysDecisionWorthy ?? []).includes(String(sc.severity ?? '').toLowerCase())) || decisionClassSet.has(sc.recommendationClass);\n  check(`decisionEligibility:${d.decisionId}`, eligible, `Decision ${d.decisionId} is bound to data-hygiene and must not enter calibration`);\n}\n",
  'independent learning eligibility review'
);

// Proposal becomes a selector instead of a 1:1 rename of every observation.
replaceExact(
  'intelligence/proposals/proposal-engine.mjs',
  "const activeCases = Array.isArray(learning.activeCases) ? learning.activeCases : [];\nif (Number.isInteger(learning.summary?.activeCaseCount) && learning.summary.activeCaseCount !== activeCases.length) {\n  throw new Error(`Learning activeCaseCount mismatch: summary=${learning.summary.activeCaseCount} array=${activeCases.length}`);\n}\n",
  "const observedActiveCases = Array.isArray(learning.activeCases) ? learning.activeCases : [];\nif (Number.isInteger(learning.summary?.activeCaseCount) && learning.summary.activeCaseCount !== observedActiveCases.length) {\n  throw new Error(`Learning activeCaseCount mismatch: summary=${learning.summary.activeCaseCount} array=${observedActiveCases.length}`);\n}\nfor (const c of observedActiveCases) {\n  if (!['decision-worthy','data-hygiene'].includes(c.experienceEligibility)) throw new Error(`Learning case missing deterministic experienceEligibility: ${c.caseKey}`);\n}\nconst activeCases = observedActiveCases.filter(c => c.experienceEligibility === 'decision-worthy');\n",
  'proposal eligibility selection'
);
replaceExact('intelligence/proposals/proposal-engine.mjs', "engineVersion: '0.1.1-deterministic-proposal-engine'", "engineVersion: '0.1.2-decision-eligible-proposal-engine'", 'proposal engine version');
replaceExact(
  'intelligence/proposals/proposal-engine.mjs',
  "  headline: `${active.length} active proposal(s) synthesized from ${activeCases.length} active Learning case(s); execution remains disabled.`,",
  "  headline: `${active.length} active proposal(s) synthesized from ${activeCases.length} decision-worthy case(s) out of ${observedActiveCases.length} observed active Learning case(s); execution remains disabled.`,",
  'proposal headline'
);
replaceExact(
  'intelligence/proposals/proposal-engine.mjs',
  "    activeCaseCount: activeCases.length,\n    totalProposalCount: proposals.length,",
  "    activeCaseCount: activeCases.length,\n    observedActiveCaseCount: observedActiveCases.length,\n    dataHygieneCaseCount: observedActiveCases.length - activeCases.length,\n    totalProposalCount: proposals.length,",
  'proposal summary selection'
);

replaceExact('intelligence/proposals/independent-proposal-reviewer.mjs', "if (q.engineVersion !== '0.1.1-deterministic-proposal-engine') errors.push(`unexpected engine version ${q.engineVersion}`);", "if (q.engineVersion !== '0.1.2-decision-eligible-proposal-engine') errors.push(`unexpected engine version ${q.engineVersion}`);", 'proposal reviewer engine version');
replaceExact(
  'intelligence/proposals/independent-proposal-reviewer.mjs',
  "const activeCaseKeys = new Set((learning.activeCases ?? []).map(x => x.caseKey));",
  "const observedLearningCases = learning.activeCases ?? [];\nconst eligibleLearningCases = observedLearningCases.filter(x => x.experienceEligibility === 'decision-worthy');\nconst activeCaseKeys = new Set(eligibleLearningCases.map(x => x.caseKey));\nif (q.summary?.activeCaseCount !== eligibleLearningCases.length) errors.push('Proposal activeCaseCount is not decision-worthy Learning count');\nif (q.summary?.observedActiveCaseCount !== observedLearningCases.length) errors.push('Proposal observedActiveCaseCount mismatch');\nif (q.summary?.dataHygieneCaseCount !== observedLearningCases.length - eligibleLearningCases.length) errors.push('Proposal dataHygieneCaseCount mismatch');",
  'proposal reviewer eligibility'
);
replaceExact(
  'intelligence/proposals/independent-proposal-reviewer.mjs',
  "    proposals: q.proposals?.length ?? 0,\n    activeLearningCases: learning.activeCases?.length ?? 0,",
  "    proposals: q.proposals?.length ?? 0,\n    observedActiveLearningCases: observedLearningCases.length,\n    decisionWorthyActiveLearningCases: eligibleLearningCases.length,",
  'proposal reviewer counts'
);

replaceExact('intelligence/proposals/proposal-decision-bridge.mjs', "if (q.engineVersion !== '0.1.1-deterministic-proposal-engine') fail(`Unexpected Proposal engine version: ${q.engineVersion}`);", "if (q.engineVersion !== '0.1.2-decision-eligible-proposal-engine') fail(`Unexpected Proposal engine version: ${q.engineVersion}`);", 'decision bridge proposal version');
replaceExact(
  'intelligence/proposals/proposal-decision-bridge.mjs',
  "const learningByCase = new Map((learning.activeCases ?? []).map(c => [c.caseKey, c]));",
  "const learningByCase = new Map((learning.activeCases ?? []).filter(c => c.experienceEligibility === 'decision-worthy').map(c => [c.caseKey, c]));",
  'decision bridge eligibility'
);
replaceExact(
  'intelligence/proposals/independent-proposal-decision-reviewer.mjs',
  "const activeLearning = new Map((learning.activeCases ?? []).map(c => [c.caseKey, c]));",
  "const activeLearning = new Map((learning.activeCases ?? []).filter(c => c.experienceEligibility === 'decision-worthy').map(c => [c.caseKey, c]));",
  'decision reviewer eligibility'
);

// Guardian state must retire automatically whenever its live upstream capability
// basis changes, rather than surviving until a Guardian source file happens to move.
replaceExact(
  '.github/workflows/update-guardian-state.yml',
  "      - 'intelligence/guardian/guardian-release.json'\n",
  "      - 'intelligence/guardian/guardian-release.json'\n      - 'intelligence/builder/candidate-queue.json'\n      - 'intelligence/builder/candidate-eval.json'\n      - 'intelligence/proposals/proposal-queue.json'\n      - 'intelligence/learning/decision-ledger.json'\n",
  'guardian upstream retirement triggers'
);

// Rebind exact-byte release manifests after all source changes.
rebindManifest('intelligence/learning/learning-release.json');
rebindManifest('intelligence/proposals/proposal-release.json');
rebindManifest('intelligence/guardian/guardian-release.json');

console.log(JSON.stringify({
  status: 'patched',
  change: 'decision-quality-gated-learning + proposal selection + guardian retirement',
  authorityChanged: false,
  capitalAuthority: 'none',
  repositoryMutationAuthority: 'unchanged',
}, null, 2));
