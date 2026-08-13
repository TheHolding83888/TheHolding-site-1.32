#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';

export const RELEASE_GUARD_VERSION = '0.1-static-release-coherence';
export const DEFAULT_MANIFEST = 'intelligence/cognitive-stack-release.json';

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function readText(root, rel) {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) throw new Error(`Cognitive release file missing: ${rel}`);
  const text = fs.readFileSync(abs, 'utf8');
  if (!text.trim()) throw new Error(`Cognitive release file empty: ${rel}`);
  return text;
}

export function verifyCognitiveRelease({ root = process.cwd(), manifestFile = DEFAULT_MANIFEST } = {}) {
  const manifestText = readText(root, manifestFile);
  let manifest;
  try {
    manifest = JSON.parse(manifestText);
  } catch (error) {
    throw new Error(`Invalid cognitive release manifest JSON: ${error.message}`);
  }

  if (manifest?.version !== '0.1-cognitive-stack-release') {
    throw new Error(`Unexpected cognitive release manifest version: ${manifest?.version}`);
  }
  if (manifest?.releaseId !== '0.2.1-release-coherence') {
    throw new Error(`Unexpected cognitive releaseId: ${manifest?.releaseId}`);
  }
  if (!Array.isArray(manifest?.files) || manifest.files.length < 1) {
    throw new Error('Cognitive release manifest files missing');
  }

  const seen = new Set();
  const verified = [];

  for (const item of manifest.files) {
    const rel = item?.file;
    const expected = item?.sha256;

    if (typeof rel !== 'string' || !rel || rel.includes('..') || path.isAbsolute(rel)) {
      throw new Error(`Unsafe cognitive release path: ${rel}`);
    }
    if (seen.has(rel)) throw new Error(`Duplicate cognitive release file: ${rel}`);
    seen.add(rel);

    if (typeof expected !== 'string' || !/^[0-9a-f]{64}$/i.test(expected)) {
      throw new Error(`Invalid expected SHA-256 for ${rel}`);
    }

    const actual = sha256(readText(root, rel));
    if (actual !== expected) {
      throw new Error(
        `Cognitive release coherence mismatch: ${rel}. Expected ${expected}, got ${actual}. ` +
        `Re-upload the complete reviewed release package.`
      );
    }

    verified.push({ file: rel, sha256: actual, exactByteMatch: true });
  }

  return {
    version: RELEASE_GUARD_VERSION,
    current: true,
    releaseId: manifest.releaseId,
    manifestFile,
    manifestSha256: sha256(manifestText),
    fileCount: verified.length,
    files: verified,
  };
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : null;

if (invokedPath === import.meta.url) {
  try {
    console.log(JSON.stringify(verifyCognitiveRelease(), null, 2));
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
