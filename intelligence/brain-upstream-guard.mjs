#!/usr/bin/env node
/**
 * THE HOLDING — GROUNDED BRAIN UPSTREAM GUARD v0.2
 *
 * Reusable exact-byte provenance guard.
 *
 * It proves that a Grounded Brain packet is still based on the CURRENT
 * canonical upstream files it claims to represent, including the normalized
 * Explanatory Context that carries Economic Graph driver context.
 *
 * Validation reads are allowed, but raw upstream content is never packaged
 * into the ChatGPT Bridge.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const UPSTREAM_GUARD_VERSION = '0.2-exact-canonical-source-binding-explanatory';

const SOURCE_ALLOWLIST = Object.freeze({
  change: 'intelligence/change-intelligence.json',
  systemMemory: 'intelligence/system-memory.json',
  security: 'security/security-intelligence.json',
  securityMemory: 'security/security-memory.json',
  explanatory: 'intelligence/explanatory/explanatory-context.json',
});

const BRAIN_POLICY_FILE = 'intelligence/brain-policy.json';

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function readText(root, rel) {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) {
    throw new Error(`Grounded Brain upstream missing: ${rel}`);
  }
  const text = fs.readFileSync(abs, 'utf8');
  if (!text.trim()) {
    throw new Error(`Grounded Brain upstream empty: ${rel}`);
  }
  return text;
}

function isoOrNull(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

export function verifyGroundedBrainUpstreams({
  root = process.cwd(),
  brain,
  requireFreshFlag = true,
} = {}) {
  if (!brain || typeof brain !== 'object') {
    throw new Error('Grounded Brain object is required for upstream verification');
  }

  const recorded = brain?.grounding?.sources;
  if (!recorded || typeof recorded !== 'object') {
    throw new Error('Grounded Brain grounding.sources is missing');
  }

  if (requireFreshFlag && brain?.grounding?.allRequiredSourcesFresh !== true) {
    throw new Error('Grounded Brain does not declare all required sources fresh');
  }

  const brainGeneratedAt = isoOrNull(brain.generatedAt);
  if (!brainGeneratedAt) {
    throw new Error('Grounded Brain generatedAt is invalid');
  }

  const vector = [];

  for (const [key, expectedFile] of Object.entries(SOURCE_ALLOWLIST)) {
    const meta = recorded[key];

    if (!meta || typeof meta !== 'object') {
      throw new Error(`Grounded Brain source metadata missing: ${key}`);
    }

    if (meta.file !== expectedFile) {
      throw new Error(
        `Grounded Brain source path mismatch for ${key}: expected ${expectedFile}, got ${meta.file}`
      );
    }

    if (typeof meta.sha256 !== 'string' || !/^[0-9a-f]{64}$/i.test(meta.sha256)) {
      throw new Error(`Grounded Brain source SHA invalid for ${key}`);
    }

    const currentText = readText(root, expectedFile);
    const currentSha256 = sha256(currentText);

    if (currentSha256 !== meta.sha256) {
      throw new Error(
        `Grounded Brain is not current relative to canonical upstream state: ${expectedFile}. ` +
        `Run Grounded Brain again before creating or interpreting the Bridge.`
      );
    }

    const sourceGeneratedAt = isoOrNull(meta.generatedAt);
    if (!sourceGeneratedAt) {
      throw new Error(`Grounded Brain source generatedAt invalid for ${key}`);
    }

    if (Date.parse(sourceGeneratedAt) > Date.parse(brainGeneratedAt)) {
      throw new Error(
        `Grounded Brain source ${expectedFile} is timestamped after the Brain packet`
      );
    }

    if (meta.freshness !== 'fresh') {
      throw new Error(`Grounded Brain source is not fresh: ${expectedFile}`);
    }

    vector.push({
      key,
      file: expectedFile,
      sha256: currentSha256,
      generatedAt: sourceGeneratedAt,
      freshness: meta.freshness,
      exactByteMatch: true,
      packagedRawContent: false,
    });
  }

  const policyMeta = brain?.grounding?.policy;
  if (!policyMeta || policyMeta.file !== BRAIN_POLICY_FILE) {
    throw new Error('Grounded Brain policy metadata/path is invalid');
  }

  if (typeof policyMeta.sha256 !== 'string' || !/^[0-9a-f]{64}$/i.test(policyMeta.sha256)) {
    throw new Error('Grounded Brain policy SHA is invalid');
  }

  const currentPolicyText = readText(root, BRAIN_POLICY_FILE);
  const currentPolicySha256 = sha256(currentPolicyText);

  if (currentPolicySha256 !== policyMeta.sha256) {
    throw new Error(
      'Grounded Brain policy changed after Brain generation. Run Grounded Brain again.'
    );
  }

  return {
    version: UPSTREAM_GUARD_VERSION,
    current: true,
    checkedAt: new Date().toISOString(),
    sourceCount: vector.length,
    sources: vector,
    brainPolicy: {
      file: BRAIN_POLICY_FILE,
      sha256: currentPolicySha256,
      exactByteMatch: true,
      packagedRawContent: false,
    },
  };
}
