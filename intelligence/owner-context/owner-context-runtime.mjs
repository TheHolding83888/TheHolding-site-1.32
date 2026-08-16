#!/usr/bin/env node
/**
 * THE HOLDING — OWNER DECISION CONTEXT COMPILER v0.2
 *
 * Compiles canonical machine-readable owner teaching into one bounded,
 * provenance-aware, non-executable decision-context artifact.
 *
 * Audio question numbering and earlier text-teaching numbering remain separate
 * namespaces so historical teaching is not silently renumbered or conflated.
 *
 * This file does NOT create market facts, operational actions, methodology,
 * wallet authority, or capital authority. It only packages explicit owner
 * context for downstream interpretation beside the Grounded Brain.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = process.cwd();
const DIR = path.join(ROOT, 'intelligence/owner-context');
const OUTPUT = path.join(DIR, 'owner-decision-context.json');
const VERSION = '0.1-owner-decision-context-runtime';

const LEGACY_TEXT_FILE = 'owner-operating-context-text-tranches-1-3.json';

const MODULE_KEYS = new Set([
  'ownerBackground',
  'capitalArchitecture',
  'cashFlowSemantics',
  'repeatableDecisionPatterns',
  'positionActionTaxonomy',
  'stableReserveRegime',
  'trackingHooks',
  'learningProgram',
  'winnerGrowthAndLiquidity',
  'healthFactorRegime',
  'newProductiveAssetAdmission',
  'rwaLayer',
  'idealCompanyArchitecture',
  'runtimeReasoningHooks',
  'textTeaching',
]);

function fail(message) {
  throw new Error(message);
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

function readJson(file) {
  const text = fs.readFileSync(file, 'utf8');
  if (!text.trim()) fail(`Owner context source is empty: ${file}`);
  let data;
  try {
    data = JSON.parse(text);
  } catch (error) {
    fail(`Invalid owner context JSON ${file}: ${error.message}`);
  }
  return { text, data };
}

function sourceFiles() {
  if (!fs.existsSync(DIR)) fail('Owner context directory missing');
  const files = fs.readdirSync(DIR)
    .filter((name) =>
      name === LEGACY_TEXT_FILE ||
      name === 'owner-operating-profile.json' ||
      /^owner-operating-profile-tranche-\d+\.json$/.test(name)
    )
    .sort((a, b) => {
      if (a === LEGACY_TEXT_FILE) return -1;
      if (b === LEGACY_TEXT_FILE) return 1;
      if (a === 'owner-operating-profile.json') return -1;
      if (b === 'owner-operating-profile.json') return 1;
      const ta = Number(a.match(/tranche-(\d+)/)?.[1] ?? 0);
      const tb = Number(b.match(/tranche-(\d+)/)?.[1] ?? 0);
      return ta - tb || a.localeCompare(b);
    });

  if (files.length === 0) fail('No canonical machine-readable owner context sources found');
  return files;
}

function validateSource(name, data) {
  if (data?.status !== 'canonical-owner-context-read-only') {
    fail(`${name}: unexpected status ${data?.status}`);
  }
  if (data?.authority?.executionAuthority !== 'none') {
    fail(`${name}: owner context gained execution authority`);
  }
  if (data?.authority?.executable !== false) {
    fail(`${name}: owner context became executable`);
  }
  if (data?.authority?.walletAuthority !== false) {
    fail(`${name}: owner context gained wallet authority`);
  }
  if (data?.authority?.capitalExecution !== false) {
    fail(`${name}: owner context gained capital execution authority`);
  }
  if (data?.source?.provenance !== 'explicit-owner-teaching') {
    fail(`${name}: provenance is not explicit-owner-teaching`);
  }

  if (name === LEGACY_TEXT_FILE) {
    if (data?.source?.teachingNamespace !== 'text-tranches-1-3') {
      fail(`${name}: legacy text teaching namespace mismatch`);
    }
    if (data?.source?.teachingItemCount !== 25) {
      fail(`${name}: expected exactly 25 canonical text teaching items`);
    }
    if (!Array.isArray(data?.textTeaching?.items) || data.textTeaching.items.length !== 25) {
      fail(`${name}: textTeaching.items must contain exactly 25 items`);
    }
    const ids = data.textTeaching.items.map((item) => item?.id);
    if (new Set(ids).size !== ids.length || ids.some((id) => typeof id !== 'string' || !id)) {
      fail(`${name}: text teaching item IDs are invalid or duplicated`);
    }
  }
}

const compiledSources = [];
const allQuestions = new Set();
const allAsOf = [];
const teachingNamespaces = new Set();
let textTeachingItemCount = 0;
let ownerBackground = null;

for (const name of sourceFiles()) {
  const rel = `intelligence/owner-context/${name}`;
  const { text, data } = readJson(path.join(DIR, name));
  validateSource(name, data);

  const questions = Array.isArray(data?.source?.questionsCovered)
    ? data.source.questionsCovered.filter((x) => Number.isInteger(x) && x > 0)
    : [];
  questions.forEach((q) => allQuestions.add(q));

  const teachingNamespace = typeof data?.source?.teachingNamespace === 'string'
    ? data.source.teachingNamespace
    : questions.length > 0
      ? 'audio-owner-q'
      : null;
  if (teachingNamespace) teachingNamespaces.add(teachingNamespace);

  const sourceTeachingItemCount = Number.isInteger(data?.source?.teachingItemCount)
    ? data.source.teachingItemCount
    : 0;
  textTeachingItemCount += sourceTeachingItemCount;

  if (typeof data?.asOf === 'string') allAsOf.push(data.asOf);
  if (!ownerBackground && data?.ownerBackground) ownerBackground = data.ownerBackground;

  const modules = {};
  for (const [key, value] of Object.entries(data)) {
    if (MODULE_KEYS.has(key)) modules[key] = value;
  }

  compiledSources.push({
    file: rel,
    sha256: sha256(text),
    version: data.version ?? null,
    tranche: Number.isInteger(data?.source?.tranche) ? data.source.tranche : null,
    trancheRange: Array.isArray(data?.source?.trancheRange) ? data.source.trancheRange : null,
    questionsCovered: questions,
    teachingNamespace,
    teachingItemCount: sourceTeachingItemCount,
    sourceChannel: data?.source?.channel ?? null,
    humanReadableSource: data?.source?.humanReadableSource ?? null,
    modules,
  });
}

const sourceVector = compiledSources.map((source) => ({
  file: source.file,
  sha256: source.sha256,
  version: source.version,
  tranche: source.tranche,
  trancheRange: source.trancheRange,
  questionsCovered: source.questionsCovered,
  teachingNamespace: source.teachingNamespace,
  teachingItemCount: source.teachingItemCount,
}));
const sourceCompositeHash = sha256(stableStringify(sourceVector));
const questionsCovered = [...allQuestions].sort((a, b) => a - b);
const audioQuestionCount = questionsCovered.length;
const totalTeachingUnits = audioQuestionCount + textTeachingItemCount;
const asOf = allAsOf.sort().at(-1) ?? null;

const output = {
  version: VERSION,
  compilerVersion: '0.2-multi-namespace-owner-context-compiler',
  asOf,
  status: 'compiled-owner-decision-context',
  purpose:
    'Bounded owner decision context for interpretation beside the evidence-bound Grounded Brain.',
  provenance: {
    authority: 'explicit-owner-teaching',
    sourceCount: compiledSources.length,
    sourceCompositeHash,
    questionsCovered,
    questionCount: audioQuestionCount,
    audioQuestionsCovered: questionsCovered,
    audioQuestionCount,
    textTeachingItemCount,
    totalTeachingUnits,
    teachingNamespaces: [...teachingNamespaces].sort(),
    numberingRule:
      'Earlier text teaching items and later audio questions are separate namespaces and must not be silently renumbered into one sequence.',
  },
  ownerExperience: ownerBackground ?? {
    classification: 'unknown',
  },
  authority: {
    executable: false,
    executionAuthority: 'none',
    walletAuthority: false,
    capitalExecution: false,
    marketFactAuthority: false,
    securityFactAuthority: false,
    evidenceOverrideAuthority: false,
    deterministicActionOverrideAuthority: false,
    methodologyMutationAuthority: false,
    policyMutationAuthority: false,
    runtimeBinding: 'decision-context-overlay',
  },
  epistemicContract: {
    ownerTeachingIsDecisionContextNotMarketTruth: true,
    canonicalEconomicAndSecurityEvidenceWinsOnFactConflict: true,
    ownerHeuristicsRemainContextualUnlessExplicitlyPromotedByHumanPolicyChange: true,
    selfReportedExperienceRemainsSelfReported: true,
    peerInvestorObservationsRemainOwnerReportedUnlessIndependentlyVerified: true,
    uncertainSpeechIdentifiersRemainUnverified: true,
    noCausalProtocolEconomicsClaimWithoutMechanismSpecificEvidence: true,
    correlationDoesNotEstablishCausation: true,
    candidateMetricsAreNotLiveUntilSourceAndSemanticsAreVerified: true,
  },
  interpretationHints: {
    useFor: [
      'capital-layer-fit',
      'lock-aware-position-interpretation',
      'reinvestment-context',
      'stable-reserve-context',
      'concentration-context',
      'health-factor-context',
      'new-productive-asset-review-context',
      'rwa-layer-context',
      'company-architecture-context',
      'harvest-and-gas-context',
      'reward-price-versus-quantity-context',
      'protocol-economics-review-context',
      'decision-signal-severity-context',
    ],
    doNotUseFor: [
      'inventing-balances',
      'inventing-prices',
      'inventing-apr-or-rewards',
      'inventing-protocol-volume-or-revenue',
      'asserting-causal-edges-without-mechanism-evidence',
      'automatic-trades',
      'automatic-borrowing',
      'automatic-rebalancing',
      'automatic-methodology-change',
    ],
  },
  sources: compiledSources,
  contextHash: null,
};

output.contextHash = sha256(stableStringify({ ...output, contextHash: null }));

fs.writeFileSync(OUTPUT, JSON.stringify(output, null, 2) + '\n', 'utf8');

console.log(JSON.stringify({
  version: output.version,
  compilerVersion: output.compilerVersion,
  asOf: output.asOf,
  sourceCount: output.provenance.sourceCount,
  audioQuestionCount: output.provenance.audioQuestionCount,
  textTeachingItemCount: output.provenance.textTeachingItemCount,
  totalTeachingUnits: output.provenance.totalTeachingUnits,
  sourceCompositeHash: output.provenance.sourceCompositeHash,
  contextHash: output.contextHash,
  executionAuthority: output.authority.executionAuthority,
}, null, 2));
