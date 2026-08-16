#!/usr/bin/env node
/**
 * THE HOLDING — OWNER DECISION CONTEXT COMPILER v0.1
 *
 * Compiles canonical machine-readable owner teaching into one bounded,
 * provenance-aware, non-executable decision-context artifact.
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
      name === 'owner-operating-profile.json' ||
      /^owner-operating-profile-tranche-\d+\.json$/.test(name)
    )
    .sort((a, b) => {
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
}

const compiledSources = [];
const allQuestions = new Set();
const allAsOf = [];
let ownerBackground = null;

for (const name of sourceFiles()) {
  const rel = `intelligence/owner-context/${name}`;
  const { text, data } = readJson(path.join(DIR, name));
  validateSource(name, data);

  const questions = Array.isArray(data?.source?.questionsCovered)
    ? data.source.questionsCovered.filter((x) => Number.isInteger(x) && x > 0)
    : [];
  questions.forEach((q) => allQuestions.add(q));
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
    questionsCovered: questions,
    sourceChannel: data?.source?.channel ?? null,
    modules,
  });
}

const sourceVector = compiledSources.map((source) => ({
  file: source.file,
  sha256: source.sha256,
  version: source.version,
  tranche: source.tranche,
  questionsCovered: source.questionsCovered,
}));
const sourceCompositeHash = sha256(stableStringify(sourceVector));
const questionsCovered = [...allQuestions].sort((a, b) => a - b);
const asOf = allAsOf.sort().at(-1) ?? null;

const output = {
  version: VERSION,
  asOf,
  status: 'compiled-owner-decision-context',
  purpose:
    'Bounded owner decision context for interpretation beside the evidence-bound Grounded Brain.',
  provenance: {
    authority: 'explicit-owner-teaching',
    sourceCount: compiledSources.length,
    sourceCompositeHash,
    questionsCovered,
    questionCount: questionsCovered.length,
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
    ],
    doNotUseFor: [
      'inventing-balances',
      'inventing-prices',
      'inventing-apr-or-rewards',
      'inventing-protocol-volume-or-revenue',
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
  asOf: output.asOf,
  sourceCount: output.provenance.sourceCount,
  questionCount: output.provenance.questionCount,
  sourceCompositeHash: output.provenance.sourceCompositeHash,
  contextHash: output.contextHash,
  executionAuthority: output.authority.executionAuthority,
}, null, 2));
