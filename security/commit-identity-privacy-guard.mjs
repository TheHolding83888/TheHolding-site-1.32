#!/usr/bin/env node

import fs from 'node:fs';

const eventPath = process.env.GITHUB_EVENT_PATH;
const eventName = process.env.GITHUB_EVENT_NAME;
const token = process.env.GITHUB_TOKEN;
const repository = process.env.GITHUB_REPOSITORY;
const sha = process.env.GITHUB_SHA;

if (!eventPath || !eventName || !token || !repository) {
  throw new Error('commit identity privacy guard missing GitHub runtime context');
}

const policy = JSON.parse(fs.readFileSync('security/commit-identity-privacy-policy.json', 'utf8'));
const event = JSON.parse(fs.readFileSync(eventPath, 'utf8'));

if (policy?.authority?.executionAuthority !== 'none') {
  throw new Error('commit identity privacy policy gained execution authority');
}
if (policy?.boundary?.historicalRewriteAuthorized !== false) {
  throw new Error('historical rewrite authority must remain false');
}
if (policy?.boundary?.printRejectedEmailValues !== false) {
  throw new Error('rejected email values must never be printed');
}

const exact = new Set((policy.allowed?.exactEmails || []).map(v => String(v).toLowerCase()));
const suffixes = (policy.allowed?.emailSuffixes || []).map(v => String(v).toLowerCase());

function isAllowedEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  if (!email) return false;
  return exact.has(email) || suffixes.some(suffix => email.endsWith(suffix));
}

async function github(path) {
  const response = await fetch(`https://api.github.com${path}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'the-holding-commit-identity-privacy-guard'
    }
  });
  if (!response.ok) {
    throw new Error(`GitHub API request failed with status ${response.status}`);
  }
  return response.json();
}

async function prCommits() {
  const number = event.pull_request?.number;
  if (!number) throw new Error('pull_request event missing PR number');
  const [owner, repo] = repository.split('/');
  const commits = [];
  for (let page = 1; ; page += 1) {
    const batch = await github(`/repos/${owner}/${repo}/pulls/${number}/commits?per_page=100&page=${page}`);
    commits.push(...batch);
    if (batch.length < 100) break;
    if (page >= 20) throw new Error('PR commit list exceeds bounded privacy scan capacity');
  }
  return commits;
}

async function pushCommits() {
  const [owner, repo] = repository.split('/');
  const before = event.before;
  const after = event.after || sha;
  if (!after) throw new Error('push event missing after SHA');
  if (!before || /^0+$/.test(before)) {
    return [await github(`/repos/${owner}/${repo}/commits/${after}`)];
  }
  const comparison = await github(`/repos/${owner}/${repo}/compare/${before}...${after}`);
  if (comparison.total_commits > 250) {
    throw new Error('push commit range exceeds bounded privacy scan capacity');
  }
  return comparison.commits || [];
}

async function manualCommit() {
  if (!sha) throw new Error('workflow_dispatch missing GITHUB_SHA');
  const [owner, repo] = repository.split('/');
  return [await github(`/repos/${owner}/${repo}/commits/${sha}`)];
}

let commits;
if (eventName === 'pull_request') commits = await prCommits();
else if (eventName === 'push') commits = await pushCommits();
else if (eventName === 'workflow_dispatch') commits = await manualCommit();
else throw new Error(`unsupported event ${eventName}`);

if (!commits.length) throw new Error('no commits available for identity privacy validation');

const failures = [];
for (const commit of commits) {
  const shortSha = String(commit.sha || '').slice(0, 12) || 'unknown-sha';
  const authorEmail = commit.commit?.author?.email;
  const committerEmail = commit.commit?.committer?.email;
  if (!isAllowedEmail(authorEmail)) failures.push(`${shortSha}: unsafe author identity`);
  if (!isAllowedEmail(committerEmail)) failures.push(`${shortSha}: unsafe committer identity`);
}

if (failures.length) {
  for (const failure of failures) console.error(failure);
  throw new Error(`Commit Identity Privacy Guard rejected ${failures.length} identity field(s); email values intentionally suppressed`);
}

console.log(`Commit Identity Privacy Guard PASS — ${commits.length} commit(s) verified; email values suppressed`);
