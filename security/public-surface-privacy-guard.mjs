#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const POLICY_PATH = 'security/public-surface-privacy-policy.json';
const policy = JSON.parse(fs.readFileSync(POLICY_PATH, 'utf8'));

if (policy?.authority?.executionAuthority !== 'none') throw new Error('public surface privacy guard gained execution authority');
if (policy?.authority?.repositoryMutationAuthority !== false) throw new Error('public surface privacy guard gained repository mutation authority');
if (policy?.authority?.historicalRewriteAuthority !== false) throw new Error('public surface privacy guard gained history rewrite authority');

const extensions = new Set((policy.scope?.extensions || []).map(v => String(v).toLowerCase()));
const excludedPrefixes = (policy.scope?.excludedPathPrefixes || []).map(String);
const excludedExact = new Set((policy.scope?.excludedExactPaths || []).map(String));
const forbiddenLiterals = (policy.forbidden?.literalFragmentsCaseInsensitive || []).map(v => String(v).toLowerCase());
const forbiddenRegexes = (policy.forbidden?.regexes || []).map(v => new RegExp(v, 'i'));
const allowedEmailExact = new Set((policy.emailBoundary?.allowedExact || []).map(v => String(v).toLowerCase()));
const allowedEmailSuffixes = (policy.emailBoundary?.allowedSuffixes || []).map(v => String(v).toLowerCase());
const allowedPublicAddresses = new Set((policy.emailBoundary?.allowedPublicAddresses || []).map(v => String(v).toLowerCase()));
const emailRegex = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

function isScoped(file) {
  const normalized = file.replaceAll('\\', '/');
  if (excludedExact.has(normalized)) return false;
  if (excludedPrefixes.some(prefix => normalized.startsWith(prefix))) return false;
  return extensions.has(path.posix.extname(normalized).toLowerCase());
}

function emailAllowed(email) {
  const value = email.toLowerCase();
  return allowedEmailExact.has(value)
    || allowedPublicAddresses.has(value)
    || allowedEmailSuffixes.some(suffix => value.endsWith(suffix));
}

function trackedFiles() {
  return execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
    .split('\0')
    .filter(Boolean)
    .filter(isScoped);
}

const files = trackedFiles();
if (!files.length) throw new Error('public surface privacy guard found no scoped files');

const failures = [];
for (const file of files) {
  let content;
  try {
    content = fs.readFileSync(file, 'utf8');
  } catch {
    failures.push(`${file}: unreadable scoped text file`);
    continue;
  }

  const lower = content.toLowerCase();
  for (const literal of forbiddenLiterals) {
    if (lower.includes(literal)) failures.push(`${file}: forbidden developer/repository identifier class`);
  }
  for (const regex of forbiddenRegexes) {
    if (regex.test(content)) failures.push(`${file}: forbidden local/private path class`);
  }

  if (policy.emailBoundary?.scanEmails === true) {
    const emails = content.match(emailRegex) || [];
    for (const email of new Set(emails.map(v => v.toLowerCase()))) {
      if (!emailAllowed(email)) failures.push(`${file}: non-allowlisted email address present`);
    }
  }
}

if (failures.length) {
  for (const failure of failures) console.error(failure);
  throw new Error(`Public Surface Privacy Guard rejected ${failures.length} public metadata finding(s); matched values intentionally suppressed`);
}

console.log(`Public Surface Privacy Guard PASS — ${files.length} scoped web/text asset(s) verified; matched values suppressed`);
