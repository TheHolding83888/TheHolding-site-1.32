#!/usr/bin/env node
/**
 * THE HOLDING — COGNITIVE STACK VERIFIER v0.1
 *
 * Produces one machine-readable readiness state for:
 *   Security Sentinel -> Grounded Brain -> ChatGPT Bridge
 *
 * It does not reason about capital. It proves chain coherence.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { verifyGroundedBrainUpstreams, UPSTREAM_GUARD_VERSION } from './brain-upstream-guard.mjs';
import { verifyCognitiveRelease, RELEASE_GUARD_VERSION } from './cognitive-release-guard.mjs';

const ROOT = process.cwd();

const FILES = {
  security: 'security/security-intelligence.json',
  securityMemory: 'security/security-memory.json',
  brain: 'intelligence/brain-intelligence.json',
  bridge: 'intelligence/brain-chatgpt-bridge.json',
  bridgeEval: 'intelligence/brain-chatgpt-bridge-eval.json',
  state: 'intelligence/cognitive-stack-state.json',
  brief: 'intelligence/cognitive-stack-brief.md',
  eval: 'intelligence/cognitive-stack-eval.json',
};

const VERSION = '0.1-cognitive-stack-state';
const ENGINE_VERSION = '0.1-cognitive-stack-verifier';
const EVAL_VERSION = '0.1-cognitive-stack-eval';

const args = new Set(process.argv.slice(2));
const VERIFY_CURRENT = args.has('--verify-current');

function fail(message) {
  throw new Error(message);
}

function readText(rel) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) fail(`Required cognitive-stack file missing: ${rel}`);
  const text = fs.readFileSync(abs, 'utf8');
  if (!text.trim()) fail(`Required cognitive-stack file empty: ${rel}`);
  return text;
}

function readJson(rel) {
  const text = readText(rel);
  try {
    return { text, data: JSON.parse(text) };
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

function exactSecurityMemoryLink(security, securityMemory) {
  const latestSnapshot = security?.bridge?.snapshotHash;
  const memorySnapshot = securityMemory?.snapshotHash;
  if (!latestSnapshot || !memorySnapshot || latestSnapshot !== memorySnapshot) {
    fail('Security Intelligence and Security Memory snapshot hashes do not match');
  }
  return latestSnapshot;
}

function validateChain({ security, securityMemory, brain, bridge, bridgeEval, brainText }) {
  const failures = [];
  const warnings = [];

  if (security?.version !== '0.1-autonomous-security-intelligence') {
    failures.push(`unexpected Security Intelligence version: ${security?.version}`);
  }

  if (securityMemory?.version !== '0.1-security-memory') {
    failures.push(`unexpected Security Memory version: ${securityMemory?.version}`);
  }

  try {
    exactSecurityMemoryLink(security, securityMemory);
  } catch (error) {
    failures.push(error.message);
  }

  let upstream = null;
  try {
    upstream = verifyGroundedBrainUpstreams({
      root: ROOT,
      brain,
      requireFreshFlag: true,
    });
  } catch (error) {
    failures.push(error.message);
  }

  const currentBrainSha = sha256(brainText);

  if (bridge?.sourceBrain?.sha256 !== currentBrainSha) {
    failures.push('Bridge is not bound to the exact current Grounded Brain bytes');
  }

  if (bridge?.sourceBrain?.snapshotHash !== brain?.bridge?.snapshotHash) {
    failures.push('Bridge and Grounded Brain snapshot hashes do not match');
  }

  if (bridge?.sourceBrain?.inputCompositeHash !== brain?.bridge?.inputCompositeHash) {
    failures.push('Bridge and Grounded Brain input composite hashes do not match');
  }

  if (bridge?.grounding?.upstreamCurrent !== true) {
    failures.push('Bridge does not declare exact current upstream binding');
  }

  if (bridge?.grounding?.upstreamGuardVersion !== UPSTREAM_GUARD_VERSION) {
    failures.push('Bridge upstream guard version mismatch');
  }

  if (bridgeEval?.status !== 'pass') {
    failures.push('Bridge deterministic evaluation is not PASS');
  }

  if (bridge?.constraints?.apiRequired !== false) {
    failures.push('Bridge unexpectedly requires an API');
  }

  if (bridge?.constraints?.modelCallPerformed !== false) {
    failures.push('Bridge unexpectedly performed a model call');
  }

  if (bridge?.constraints?.executionAllowed !== false) {
    failures.push('Bridge unexpectedly enables execution');
  }

  if (brain?.constraints?.actionMode !== 'proposal-only') {
    failures.push('Grounded Brain escaped proposal-only mode');
  }

  const critical = Number(security?.severityCounts?.critical ?? 0);
  const high = Number(security?.severityCounts?.high ?? 0);
  const medium = Number(security?.severityCounts?.medium ?? 0);

  if (!Number.isFinite(critical) || !Number.isFinite(high) || !Number.isFinite(medium)) {
    failures.push('Security severity counts are not finite');
  }

  if (critical > 0) {
    warnings.push(`${critical} critical security finding(s) block interpretation readiness`);
  } else if (high > 0) {
    warnings.push(`${high} high security finding(s) require explicit human review`);
  }

  const chainCurrent = failures.length === 0;
  const readyForManualInterpretation = chainCurrent && critical === 0;
  const requiresImmediateHumanReview = critical > 0 || high > 0;

  return {
    failures,
    warnings,
    upstream,
    counts: { critical, high, medium },
    chainCurrent,
    readyForManualInterpretation,
    requiresImmediateHumanReview,
  };
}

function buildState({ securityLoaded, securityMemoryLoaded, brainLoaded, bridgeLoaded, bridgeEvalLoaded, validation, release }) {
  const { security, securityMemory, brain, bridge } = {
    security: securityLoaded.data,
    securityMemory: securityMemoryLoaded.data,
    brain: brainLoaded.data,
    bridge: bridgeLoaded.data,
  };

  const state = {
    version: VERSION,
    verifierVersion: ENGINE_VERSION,
    generatedAt: new Date().toISOString(),
    status:
      validation.failures.length > 0 || validation.counts.critical > 0
        ? 'blocked'
        : validation.requiresImmediateHumanReview
          ? 'watch'
          : bridge.status === 'watch' || brain.status === 'watch'
            ? 'watch'
            : 'ready',
    readyForManualInterpretation: validation.readyForManualInterpretation,
    requiresImmediateHumanReview: validation.requiresImmediateHumanReview,
    chain: {
      security: {
        file: FILES.security,
        generatedAt: security.generatedAt ?? null,
        status: security.status ?? null,
        sha256: sha256(securityLoaded.text),
        snapshotHash: security.bridge?.snapshotHash ?? null,
        critical: validation.counts.critical,
        high: validation.counts.high,
        medium: validation.counts.medium,
        memorySnapshotMatch:
          security.bridge?.snapshotHash === securityMemory.snapshotHash,
      },
      groundedBrain: {
        file: FILES.brain,
        generatedAt: brain.generatedAt ?? null,
        status: brain.status ?? null,
        sha256: sha256(brainLoaded.text),
        snapshotHash: brain.bridge?.snapshotHash ?? null,
        inputCompositeHash: brain.bridge?.inputCompositeHash ?? null,
        exactCanonicalUpstreamBinding: validation.upstream?.current === true,
      },
      chatgptBridge: {
        file: FILES.bridge,
        generatedAt: bridge.generatedAt ?? null,
        status: bridge.status ?? null,
        sha256: sha256(bridgeLoaded.text),
        sourceBrainSha256: bridge.sourceBrain?.sha256 ?? null,
        sourceBrainSnapshotHash: bridge.sourceBrain?.snapshotHash ?? null,
        exactCanonicalUpstreamBinding: bridge.grounding?.upstreamCurrent === true,
        caseCount: Array.isArray(bridge.cases) ? bridge.cases.length : null,
        evidenceCount: Array.isArray(bridge.evidenceCatalog) ? bridge.evidenceCatalog.length : null,
        noApiRequired: bridge.constraints?.apiRequired === false,
        noModelCall: bridge.constraints?.modelCallPerformed === false,
        noExecution: bridge.constraints?.executionAllowed === false,
      },
    },
    upstreamVector: (validation.upstream?.sources ?? []).map((item) => ({
      key: item.key,
      file: item.file,
      sha256: item.sha256,
      generatedAt: item.generatedAt,
      exactByteMatch: item.exactByteMatch === true,
    })),
    release: {
      guardVersion: RELEASE_GUARD_VERSION,
      releaseId: release.releaseId,
      manifestFile: release.manifestFile,
      manifestSha256: release.manifestSha256,
      staticFileCount: release.fileCount,
      exactByteMatch: release.current === true,
    },
    operatingContract: {
      canonicalManualSequence:
        'Security Sentinel -> Grounded Brain -> ChatGPT Bridge -> human-triggered ChatGPT interpretation',
      factsAuthority: 'intelligence/brain-intelligence.json',
      evidenceAuthority: 'intelligence/brain-intelligence.json',
      allowedActionAuthority: 'deterministic Grounded Brain case',
      interpretationAuthority: 'human-triggered replaceable ChatGPT',
      executionAuthority: 'none',
    },
    integrity: {
      chainHash: null,
    },
  };

  state.integrity.chainHash = sha256(
    stableStringify({
      version: state.version,
      status: state.status,
      readyForManualInterpretation: state.readyForManualInterpretation,
      chain: state.chain,
      upstreamVector: state.upstreamVector,
      release: state.release,
      operatingContract: state.operatingContract,
    })
  );

  return state;
}

function buildBrief(state, validation) {
  return [
    '# The Holding — Cognitive Stack State',
    '',
    `Generated: ${state.generatedAt}`,
    `Status: ${state.status}`,
    `Ready for manual interpretation: ${state.readyForManualInterpretation ? 'YES' : 'NO'}`,
    `Immediate human review: ${state.requiresImmediateHumanReview ? 'YES' : 'NO'}`,
    '',
    '## Release coherence',
    '',
    `Release: ${state.release.releaseId} · exact ${state.release.exactByteMatch}`,
    `Manifest: ${state.release.manifestSha256}`,
    '',
    '## Chain',
    '',
    `Security Sentinel: ${state.chain.security.status} · critical ${state.chain.security.critical} · high ${state.chain.security.high} · medium ${state.chain.security.medium}`,
    `Grounded Brain: ${state.chain.groundedBrain.status} · upstream exact ${state.chain.groundedBrain.exactCanonicalUpstreamBinding}`,
    `ChatGPT Bridge: ${state.chain.chatgptBridge.status} · cases ${state.chain.chatgptBridge.caseCount} · evidence ${state.chain.chatgptBridge.evidenceCount}`,
    '',
    '## Zero-extra-cost cognitive boundary',
    '',
    `API required: ${state.chain.chatgptBridge.noApiRequired ? 'NO' : 'YES'}`,
    `Model call performed by Bridge: ${state.chain.chatgptBridge.noModelCall ? 'NO' : 'YES'}`,
    `Execution enabled: ${state.chain.chatgptBridge.noExecution ? 'NO' : 'YES'}`,
    '',
    '## Integrity',
    '',
    `Chain hash: ${state.integrity.chainHash}`,
    '',
    validation.warnings.length
      ? `Warnings: ${validation.warnings.join(' | ')}`
      : 'Warnings: none',
    '',
    'If Ready for manual interpretation is YES, the owner may ask ChatGPT: `чекай brain`.',
    '',
  ].join('\n');
}

function loadAll() {
  return {
    securityLoaded: readJson(FILES.security),
    securityMemoryLoaded: readJson(FILES.securityMemory),
    brainLoaded: readJson(FILES.brain),
    bridgeLoaded: readJson(FILES.bridge),
    bridgeEvalLoaded: readJson(FILES.bridgeEval),
  };
}

function createCurrentState() {
  const release = verifyCognitiveRelease({ root: ROOT });
  const loaded = loadAll();
  const validation = validateChain({
    security: loaded.securityLoaded.data,
    securityMemory: loaded.securityMemoryLoaded.data,
    brain: loaded.brainLoaded.data,
    bridge: loaded.bridgeLoaded.data,
    bridgeEval: loaded.bridgeEvalLoaded.data,
    brainText: loaded.brainLoaded.text,
  });

  if (validation.failures.length) {
    fail(`Cognitive stack validation failed:\n${validation.failures.join('\n')}`);
  }

  const state = buildState({ ...loaded, validation, release });

  const evaluation = {
    version: EVAL_VERSION,
    verifierVersion: ENGINE_VERSION,
    generatedAt: state.generatedAt,
    status: 'pass',
    checks: {
      staticReleaseCoherent: state.release.exactByteMatch === true,
      securityMemoryLinked: state.chain.security.memorySnapshotMatch === true,
      groundedBrainExactUpstream: state.chain.groundedBrain.exactCanonicalUpstreamBinding === true,
      bridgeExactBrain: state.chain.chatgptBridge.sourceBrainSha256 === state.chain.groundedBrain.sha256,
      bridgeExactUpstream: state.chain.chatgptBridge.exactCanonicalUpstreamBinding === true,
      bridgeEvalPass: loaded.bridgeEvalLoaded.data.status === 'pass',
      noApiRequired: state.chain.chatgptBridge.noApiRequired === true,
      noModelCall: state.chain.chatgptBridge.noModelCall === true,
      noExecution: state.chain.chatgptBridge.noExecution === true,
    },
    warnings: validation.warnings,
    failures: [],
  };

  return { loaded, validation, state, evaluation };
}

if (VERIFY_CURRENT) {
  const current = createCurrentState();
  const published = readJson(FILES.state).data;
  const publishedEval = readJson(FILES.eval).data;

  if (published?.version !== VERSION) fail('Published cognitive stack state version mismatch');
  if (publishedEval?.version !== EVAL_VERSION || publishedEval?.status !== 'pass') {
    fail('Published cognitive stack evaluation missing or not PASS');
  }

  const expectedHash = current.state.integrity.chainHash;
  if (published?.integrity?.chainHash !== expectedHash) {
    fail('Published cognitive stack state is not current relative to live chain bytes');
  }

  console.log(JSON.stringify({
    status: 'verified',
    stackStatus: published.status,
    readyForManualInterpretation: published.readyForManualInterpretation,
    requiresImmediateHumanReview: published.requiresImmediateHumanReview,
    chainHash: published.integrity.chainHash,
  }, null, 2));
  process.exit(0);
}

const current = createCurrentState();

fs.writeFileSync(FILES.state, JSON.stringify(current.state, null, 2) + '\n', 'utf8');
fs.writeFileSync(FILES.eval, JSON.stringify(current.evaluation, null, 2) + '\n', 'utf8');
fs.writeFileSync(FILES.brief, buildBrief(current.state, current.validation), 'utf8');

console.log(JSON.stringify({
  version: current.state.version,
  generatedAt: current.state.generatedAt,
  status: current.state.status,
  readyForManualInterpretation: current.state.readyForManualInterpretation,
  requiresImmediateHumanReview: current.state.requiresImmediateHumanReview,
  chainHash: current.state.integrity.chainHash,
  security: current.state.chain.security,
  groundedBrain: current.state.chain.groundedBrain,
  chatgptBridge: current.state.chain.chatgptBridge,
}, null, 2));
