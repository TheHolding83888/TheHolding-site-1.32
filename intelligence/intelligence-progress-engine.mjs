import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { verifyCognitiveRelease } from './cognitive-release-guard.mjs';

const ROOT = process.cwd();
const OUT = path.join(ROOT, 'intelligence/intelligence-progress.json');

const readJson = (rel, fallback = null) => {
  try { return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8')); }
  catch (error) {
    if (fallback !== null) return fallback;
    throw new Error(`Cannot read ${rel}: ${error.message}`);
  }
};

const finite = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const round = (value, digits = 1) => Number(Number(value).toFixed(digits));

const publicDiagnostic = value => {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  const scrubbed = raw
    .replaceAll(ROOT, '[repo]')
    .replace(/file:\/\/\/[^\s)]+/g, '[local-path]')
    .replace(/(?:^|\s)\/(?:home|Users|private|tmp)\/[^\s)]+/g, match => `${match.startsWith(' ') ? ' ' : ''}[local-path]`);
  const errorIndex = scrubbed.indexOf('Error: ');
  const relevant = errorIndex >= 0 ? scrubbed.slice(errorIndex) : scrubbed;
  return relevant.split(/\n\s+at\s/)[0].trim().slice(0, 1000) || null;
};

function liveCognitiveIntegrity() {
  let releaseCoherent = false;
  let releaseGuardError = null;
  try {
    releaseCoherent = verifyCognitiveRelease({ root: ROOT }).current === true;
  } catch (error) {
    releaseGuardError = publicDiagnostic(error?.message || error);
  }

  const verifier = spawnSync(
    process.execPath,
    [path.join(ROOT, 'intelligence/cognitive-stack-verifier.mjs'), '--verify-current'],
    { cwd: ROOT, encoding: 'utf8' }
  );
  const cognitiveEvalPass = verifier.status === 0;
  const cognitiveVerifierError = cognitiveEvalPass
    ? null
    : publicDiagnostic(verifier.stderr || verifier.stdout || `verifier exit ${verifier.status}`);

  return {
    releaseCoherent,
    cognitiveEvalPass,
    releaseGuardError,
    cognitiveVerifierError,
    source: 'live-canonical-guards'
  };
}

function curveScore(value, spec) {
  const weight = finite(spec?.weight);
  const curve = spec?.curve;
  if (curve === 'binary') return value === true ? weight : 0;
  if (curve === 'ratio') return weight * clamp(finite(value), 0, 1);
  if (curve === 'log1p') {
    const cap = Math.max(1, finite(spec?.cap, 1));
    const v = clamp(finite(value), 0, cap);
    return weight * (Math.log1p(v) / Math.log1p(cap));
  }
  throw new Error(`Unsupported THI curve: ${curve}`);
}

function staticQuestionBank() {
  const dir = path.join(ROOT, 'verification/ask-experience');
  if (!fs.existsSync(dir)) return { count: 0, files: [] };
  const files = fs.readdirSync(dir)
    .filter(name => /^corpus-.*\.json$/i.test(name))
    .sort();
  let count = 0;
  const details = [];
  for (const name of files) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'));
      const cases = Array.isArray(data?.cases) ? data.cases.length : 0;
      count += cases;
      details.push({ file: `verification/ask-experience/${name}`, cases });
    } catch (_) {
      details.push({ file: `verification/ask-experience/${name}`, cases: null });
    }
  }
  return { count, files: details };
}

function askRunStats(previous) {
  const totalEnv = Number(process.env.ASK_EXPERIENCE_TOTAL_RUNS);
  const successEnv = Number(process.env.ASK_EXPERIENCE_SUCCESSFUL_RUNS);
  const prev = previous?.metrics?.evaluation || {};
  const totalRuns = Number.isFinite(totalEnv) ? totalEnv : finite(prev.totalAskRuns, 0);
  const successfulRuns = Number.isFinite(successEnv) ? successEnv : finite(prev.successfulAskRuns, 0);
  return {
    totalRuns,
    successfulRuns,
    successRate: totalRuns > 0 ? clamp(successfulRuns / totalRuns, 0, 1) : 0,
    source: Number.isFinite(totalEnv) && Number.isFinite(successEnv)
      ? 'github-actions-api'
      : 'previous-progress-fallback'
  };
}

function stageFor(value, policy) {
  return policy.index.stages.find(stage => value >= stage.min && value <= stage.max)?.label || 'Unknown';
}

function factor(policy, id, values) {
  const def = policy.factors[id];
  let score = 0;
  const contributions = {};
  for (const [metric, spec] of Object.entries(def.metrics)) {
    const part = curveScore(values[metric], spec);
    contributions[metric] = round(part, 2);
    score += part;
  }
  return {
    id,
    label: def.label,
    score: round(clamp(score, 0, def.max), 1),
    max: def.max,
    pct: round((clamp(score, 0, def.max) / def.max) * 100, 1),
    contributions
  };
}

function deltaMap(current, previous) {
  if (!previous) return null;
  const keys = [
    ['memoryVaultRuns', current.metrics.memory.memoryVaultRuns, previous.metrics?.memory?.memoryVaultRuns],
    ['memoryVaultEvents', current.metrics.memory.memoryVaultEvents, previous.metrics?.memory?.memoryVaultEvents],
    ['brainObservations', current.metrics.memory.brainObservations, previous.metrics?.memory?.brainObservations],
    ['rememberedCases', current.metrics.memory.rememberedCases, previous.metrics?.memory?.rememberedCases],
    ['evidenceMapped', current.metrics.reasoning.evidenceMapped, previous.metrics?.reasoning?.evidenceMapped],
    ['successfulAskRuns', current.metrics.evaluation.successfulAskRuns, previous.metrics?.evaluation?.successfulAskRuns],
    ['ownerDecisions', current.metrics.experience.ownerDecisions, previous.metrics?.experience?.ownerDecisions],
    ['settledOutcomes', current.metrics.experience.settledOutcomes, previous.metrics?.experience?.settledOutcomeCount],
    ['lessons', current.metrics.experience.lessons, previous.metrics?.experience?.lessons]
  ];
  return Object.fromEntries(keys.map(([key, a, b]) => [key, Number.isFinite(Number(b)) ? finite(a) - finite(b) : null]));
}

function build() {
  const policy = readJson('intelligence/intelligence-progress-policy.json');
  const learning = readJson('intelligence/learning-state/learning-context.json', {});
  const ledger = readJson('intelligence/learning/decision-ledger.json', {});
  const vault = readJson('intelligence/memory-vault/manifest.json', {});
  const brainHistory = readJson('intelligence/brain-history.json', {});
  const stack = readJson('intelligence/cognitive-stack-state.json', {});
  const security = readJson('security/security-intelligence.json', {});
  const change = readJson('intelligence/change-intelligence.json', {});
  const previous = fs.existsSync(OUT) ? readJson('intelligence/intelligence-progress.json', {}) : null;
  const bank = staticQuestionBank();
  const ask = askRunStats(previous);
  const liveCognitive = liveCognitiveIntegrity();

  const learningSummary = learning?.summary || {};
  const bridge = stack?.chain?.chatgptBridge || {};
  const brain = stack?.chain?.groundedBrain || {};
  const severity = security?.severityCounts || {};

  const metrics = {
    memory: {
      memoryVaultRuns: finite(vault?.runCount),
      memoryVaultEvents: finite(vault?.eventCount),
      brainObservations: finite(brainHistory?.observationCount, finite(learningSummary?.brainObservationCount)),
      rememberedCases: finite(learningSummary?.rememberedCaseCount)
    },
    reasoning: {
      evidenceMapped: finite(bridge?.evidenceCount),
      activeCases: finite(bridge?.caseCount, finite(learningSummary?.activeCaseCount)),
      exactUpstreamBinding: brain?.exactCanonicalUpstreamBinding === true && bridge?.exactCanonicalUpstreamBinding === true,
      releaseCoherent: liveCognitive.releaseCoherent
    },
    evaluation: {
      totalAskRuns: ask.totalRuns,
      successfulAskRuns: ask.successfulRuns,
      askSuccessRate: round(ask.successRate, 4),
      staticQuestionBank: bank.count,
      staticQuestionBankFiles: bank.files,
      historicalQuestionChecks: null,
      historicalQuestionChecksNote: 'Exact cumulative question executions were not durably counted before Intelligence Progress v0.1. The UI therefore reports verified Ask runs and the current static question bank without inventing a historical question total.',
      askRunSource: ask.source
    },
    experience: {
      ownerDecisions: finite(ledger?.decisionCount, finite(learningSummary?.decisionCount)),
      settledOutcomes: finite(learningSummary?.settledOutcomeCount),
      scoredOutcomes: finite(learningSummary?.scoredOutcomeCount),
      lessons: finite(learningSummary?.lessonCount),
      confidenceCalibrationStatus: String(learningSummary?.confidenceCalibrationStatus || 'unknown')
    },
    integrity: {
      cognitiveEvalPass: liveCognitive.cognitiveEvalPass,
      cognitiveIntegritySource: liveCognitive.source,
      releaseGuardError: liveCognitive.releaseGuardError,
      cognitiveVerifierError: liveCognitive.cognitiveVerifierError,
      noExecutionAuthority: stack?.operatingContract?.executionAuthority === 'none' && bridge?.noExecution === true,
      noCriticalSecurity: finite(severity?.critical) === 0,
      observerFresh: change?.sourceHealth?.allFresh === true,
      learningReady: learning?.status === 'ready',
      securityStatus: String(security?.status || 'unknown'),
      critical: finite(severity?.critical),
      high: finite(severity?.high),
      medium: finite(severity?.medium)
    }
  };

  const factors = [
    factor(policy, 'memory', metrics.memory),
    factor(policy, 'reasoning', metrics.reasoning),
    factor(policy, 'evaluation', {
      successfulAskRuns: metrics.evaluation.successfulAskRuns,
      staticQuestionBank: metrics.evaluation.staticQuestionBank,
      askSuccessRate: metrics.evaluation.askSuccessRate
    }),
    factor(policy, 'experience', metrics.experience),
    factor(policy, 'integrity', metrics.integrity)
  ];

  const value = round(factors.reduce((sum, item) => sum + item.score, 0), 1);
  const stage = stageFor(value, policy);
  const lowest = factors.slice().sort((a, b) => (a.pct - b.pct) || a.id.localeCompare(b.id))[0];
  const nextStage = policy.index.stages.find(item => item.min > value) || null;
  const now = process.env.PROGRESS_GENERATED_AT || new Date().toISOString();
  const previousScore = Number.isFinite(Number(previous?.index?.value)) ? Number(previous.index.value) : null;

  const current = {
    version: '0.1-intelligence-progress',
    engineVersion: '0.2.1-live-cognitive-integrity-public-safe-thi-engine',
    generatedAt: now,
    index: {
      name: policy.index.name,
      shortName: policy.index.shortName,
      value,
      max: policy.index.max,
      stage,
      delta: previousScore === null ? null : round(value - previousScore, 1),
      nextStage: nextStage ? { label: nextStage.label, threshold: nextStage.min, pointsAway: round(nextStage.min - value, 1) } : null,
      disclaimer: policy.index.purpose
    },
    factors,
    metrics,
    bottleneck: {
      factor: lowest.id,
      label: lowest.label,
      pct: lowest.pct,
      summary: lowest.id === 'experience'
        ? 'The system has more observation and evaluation evidence than settled real-world outcomes. More decision → outcome → lesson cycles are the highest-value next intelligence gain.'
        : `The lowest current maturity factor is ${lowest.label}.`
    },
    growth: {
      previousGeneratedAt: previous?.generatedAt || null,
      metricDelta: null
    },
    sourceFreshness: {
      learningGeneratedAt: learning?.generatedAt || null,
      brainGeneratedAt: brain?.generatedAt || null,
      securityGeneratedAt: security?.generatedAt || null,
      observerGeneratedAt: change?.generatedAt || null
    },
    policy: {
      file: 'intelligence/intelligence-progress-policy.json',
      version: policy.version,
      automaticPolicyMutation: policy?.authority?.automaticPolicyMutation === true
    },
    authority: {
      executable: false,
      executionAuthority: 'none',
      note: 'THI is read-only progress telemetry. It cannot execute capital actions, change methodology, or self-promote capabilities.'
    },
    history: []
  };

  current.growth.metricDelta = deltaMap(current, previous);

  const maxSnapshots = finite(policy?.history?.maxSnapshots, 120);
  const dedupeWindowMinutes = finite(policy?.history?.dedupeWindowMinutes, 30);
  const previousHistory = Array.isArray(previous?.history) ? previous.history : [];
  const snapshot = {
    generatedAt: now,
    value,
    stage,
    factors: Object.fromEntries(factors.map(item => [item.id, item.score])),
    metrics: {
      memoryVaultRuns: metrics.memory.memoryVaultRuns,
      brainObservations: metrics.memory.brainObservations,
      rememberedCases: metrics.memory.rememberedCases,
      successfulAskRuns: metrics.evaluation.successfulAskRuns,
      ownerDecisions: metrics.experience.ownerDecisions,
      settledOutcomes: metrics.experience.settledOutcomes,
      lessons: metrics.experience.lessons
    }
  };
  const previousSnapshot = previousHistory.at(-1) || null;
  const previousMs = previousSnapshot?.generatedAt ? Date.parse(previousSnapshot.generatedAt) : NaN;
  const nowMs = Date.parse(now);
  const sameEvidence = previousSnapshot &&
    previousSnapshot.value === snapshot.value &&
    JSON.stringify(previousSnapshot.metrics) === JSON.stringify(snapshot.metrics) &&
    JSON.stringify(previousSnapshot.factors) === JSON.stringify(snapshot.factors);
  const withinDedupeWindow = Number.isFinite(previousMs) && Number.isFinite(nowMs) &&
    (nowMs - previousMs) >= 0 && (nowMs - previousMs) < dedupeWindowMinutes * 60000;

  current.history = sameEvidence && withinDedupeWindow
    ? previousHistory.slice(-maxSnapshots)
    : [...previousHistory, snapshot].slice(-maxSnapshots);

  return current;
}

function selfTest() {
  const policy = readJson('intelligence/intelligence-progress-policy.json');
  const totalWeight = Object.values(policy.factors).reduce((sum, f) => sum + finite(f.max), 0);
  if (totalWeight !== 100) throw new Error(`THI factor max total must equal 100; got ${totalWeight}`);
  for (const [id, f] of Object.entries(policy.factors)) {
    const metricWeight = Object.values(f.metrics).reduce((sum, spec) => sum + finite(spec.weight), 0);
    if (metricWeight !== finite(f.max)) throw new Error(`${id} metric weights ${metricWeight} != max ${f.max}`);
  }
  const staged = policy.index.stages;
  if (!Array.isArray(staged) || staged[0]?.min !== 0 || staged.at(-1)?.max !== 100) throw new Error('THI stages must cover 0..100');
  const localPath = ['', 'home', 'runner', 'work', 'repo', 'repo', 'example.mjs:1'].join('/');
  const localUrl = ['file:', '', localPath].join('/');
  const sample = publicDiagnostic(`${localUrl}\nError: Example public-safe failure\n    at fail (${localUrl}:1)`);
  if (sample !== 'Error: Example public-safe failure') throw new Error(`THI diagnostic sanitization failed: ${sample}`);
  if (sample.includes(localPath) || sample.includes(localUrl)) throw new Error('THI diagnostic sanitization leaked a local fixture path');
  console.log('Intelligence Progress self-test PASS', { policy: policy.version, totalWeight, publicDiagnostic: sample });
}

if (process.argv.includes('--self-test')) {
  selfTest();
  process.exit(0);
}

const output = build();
fs.writeFileSync(OUT, `${JSON.stringify(output, null, 2)}\n`);
console.log('Intelligence Progress generated', {
  generatedAt: output.generatedAt,
  thi: output.index.value,
  stage: output.index.stage,
  bottleneck: output.bottleneck.factor,
  askRuns: output.metrics.evaluation.successfulAskRuns,
  questionBank: output.metrics.evaluation.staticQuestionBank,
  ownerDecisions: output.metrics.experience.ownerDecisions,
  outcomes: output.metrics.experience.settledOutcomes,
  lessons: output.metrics.experience.lessons,
  releaseCoherent: output.metrics.reasoning.releaseCoherent,
  cognitiveEvalPass: output.metrics.integrity.cognitiveEvalPass
});