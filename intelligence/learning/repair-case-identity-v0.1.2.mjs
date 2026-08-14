#!/usr/bin/env node
import fs from 'node:fs';
import crypto from 'node:crypto';

const FILES = Object.freeze({
  recorder: 'intelligence/learning/decision-recorder.mjs',
  engine: 'intelligence/learning/decision-learning-engine.mjs',
  reviewer: 'intelligence/learning/independent-learning-reviewer.mjs',
  policy: 'intelligence/learning/decision-policy.json',
  release: 'intelligence/learning/learning-release.json',
  brain: 'intelligence/brain-intelligence.json',
});

const EXPECTED_OLD_SHA256 = Object.freeze({
  [FILES.recorder]: '6dcda350d81d400cbc1cb6f5d635e667371f189120e8b95c0ccb3ab1140123f2',
  [FILES.engine]: 'b2943cf12df5aa9410ca65e46c3e655fd4342f9a6d2b1ee8a295b2f03bcda619',
  [FILES.reviewer]: '05a84d1b24b01b83be908bec47bb54eb2916fcc9a5a8bcd28c9214214dff2f6c',
  [FILES.policy]: 'ef5a48cfd688011e62cb9e05940e9ce92d92133c0a0cfb290c853dfc5e33682d',
});

const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const fail = message => { throw new Error(message); };
const readText = p => fs.readFileSync(p, 'utf8');
const readJson = p => JSON.parse(readText(p));
const stableValue = value => {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(k => [k, stableValue(value[k])]));
  }
  return value;
};
const stableStringify = value => JSON.stringify(stableValue(value));

for (const p of Object.values(FILES)) {
  if (!fs.existsSync(p)) fail(`Repair missing required file: ${p}`);
}
for (const [p, expected] of Object.entries(EXPECTED_OLD_SHA256)) {
  const actual = sha256(fs.readFileSync(p));
  if (actual !== expected) fail(`Refuse stale/unknown baseline for ${p}: expected ${expected}, got ${actual}`);
}

const OLD_IDENTITY = `function stableEntity(caseObj) {
  const entity = caseObj?.entity ?? null;
  if (typeof entity === 'string' && /^\\d+\\s+current findings$/i.test(entity.trim())) return 'current findings';
  return entity;
}
function caseKey(caseObj) {
  return \`CK-\${sha256(stableStringify({
    domain: caseObj?.domain ?? null,
    category: caseObj?.category ?? null,
    entity: stableEntity(caseObj),
    recommendationClass: caseObj?.recommendationClass ?? null,
  })).slice(0, 20)}\`;
}`;

const NEW_IDENTITY = `function stableEntity(caseObj) {
  const entity = caseObj?.entity ?? null;
  if (typeof entity === 'string' && /^\\d+\\s+current findings$/i.test(entity.trim())) return 'current findings';
  return entity;
}
function stableCaseIdentity(caseObj) {
  const identity = {
    domain: caseObj?.domain ?? null,
    category: caseObj?.category ?? null,
    entity: stableEntity(caseObj),
    recommendationClass: caseObj?.recommendationClass ?? null,
  };
  // Persistent mechanism/security cases deliberately keep the original v0.1
  // identity bytes. Generic evidence-review cases are event observations and may
  // legitimately share domain/category/entity/recommendationClass, so only that
  // class receives a per-event discriminator. This preserves every existing
  // owner Decision caseKey while preventing event collisions as Brain grows.
  if (caseObj?.recommendationClass === 'evidence-review') {
    const eventDiscriminator = caseObj?.id ?? caseObj?.signal ?? null;
    if (!eventDiscriminator) fail('evidence-review case requires a stable event discriminator');
    identity.eventDiscriminator = eventDiscriminator;
  }
  return identity;
}
function caseKey(caseObj) {
  return \`CK-\${sha256(stableStringify(stableCaseIdentity(caseObj))).slice(0, 20)}\`;
}`;

for (const p of [FILES.recorder, FILES.engine, FILES.reviewer]) {
  const before = readText(p);
  const first = before.indexOf(OLD_IDENTITY);
  if (first < 0) fail(`Expected v0.1 identity implementation not found in ${p}`);
  if (before.indexOf(OLD_IDENTITY, first + 1) >= 0) fail(`Identity implementation occurs more than once in ${p}`);
  const after = before.replace(OLD_IDENTITY, NEW_IDENTITY);
  if (after === before) fail(`Identity replacement was a no-op in ${p}`);
  fs.writeFileSync(p, after, 'utf8');
}

const policy = readJson(FILES.policy);
if (policy.version !== '0.1-decision-outcome-learning-policy') fail(`Unexpected Learning policy version: ${policy.version}`);
if (policy.mode !== 'evidence-bound-human-decision-memory') fail(`Unexpected Learning policy mode: ${policy.mode}`);
policy.caseIdentity = {
  ...(policy.caseIdentity ?? {}),
  identityVersion: '0.1.2-collision-safe-event-identity',
  eventIdentity: {
    appliesWhenRecommendationClass: 'evidence-review',
    discriminatorField: 'id',
    fallbackField: 'signal',
    note: 'Generic evidence-review cases represent discrete observed events. They retain the original stable fields and add a per-event discriminator only for this recommendation class, preventing collisions without changing existing persistent caseKeys or owner decision bindings.'
  }
};
fs.writeFileSync(FILES.policy, JSON.stringify(policy, null, 2) + '\n', 'utf8');

// Compatibility proof: the two already-recorded P0 owner decisions MUST retain
// their exact stable keys. Only evidence-review event identity may change.
function stableEntityForTest(caseObj) {
  const entity = caseObj?.entity ?? null;
  if (typeof entity === 'string' && /^\d+\s+current findings$/i.test(entity.trim())) return 'current findings';
  return entity;
}
function keyForTest(caseObj) {
  const identity = {
    domain: caseObj?.domain ?? null,
    category: caseObj?.category ?? null,
    entity: stableEntityForTest(caseObj),
    recommendationClass: caseObj?.recommendationClass ?? null,
  };
  if (caseObj?.recommendationClass === 'evidence-review') {
    const eventDiscriminator = caseObj?.id ?? caseObj?.signal ?? null;
    if (!eventDiscriminator) fail('test evidence-review case missing discriminator');
    identity.eventDiscriminator = eventDiscriminator;
  }
  return `CK-${sha256(stableStringify(identity)).slice(0, 20)}`;
}
const existingKeyProofs = [
  [{ domain:'security', category:'external-script-no-sri', entity:'7 current findings', recommendationClass:'third-party-trust-review' }, 'CK-106f8e0ade4286d3d496'],
  [{ domain:'security', category:'dom-innerhtml', entity:'31 current findings', recommendationClass:'security-provenance-triage' }, 'CK-8793263ff6a84dddf9f1'],
];
for (const [sample, expected] of existingKeyProofs) {
  const actual = keyForTest(sample);
  if (actual !== expected) fail(`Existing owner-decision caseKey compatibility failed: expected ${expected}, got ${actual}`);
}
const eventBase = { domain:'economic', category:'reporting', entity:'defitea.eth', recommendationClass:'evidence-review' };
const eventA = keyForTest({ ...eventBase, id:'aaaaaaaaaaaaaaaaaaaaaaaa' });
const eventB = keyForTest({ ...eventBase, id:'bbbbbbbbbbbbbbbbbbbbbbbb' });
if (eventA === eventB) fail('Evidence-review event discriminator self-test failed');

// Prove the current Brain has no caseKey collisions under the repaired identity.
const brain = readJson(FILES.brain);
const cases = brain.reasoningCases ?? [];
const seen = new Map();
for (const c of cases) {
  const key = keyForTest(c);
  if (seen.has(key)) {
    fail(`Repaired identity still collides in current Brain: ${key} (${seen.get(key)} / ${c.id})`);
  }
  seen.set(key, c.id);
}

const release = readJson(FILES.release);
if (release.version !== '0.1-learning-release') fail(`Unexpected Learning release version: ${release.version}`);
if (release.releaseId !== '0.1-decision-outcome-learning-production') fail(`Unexpected Learning releaseId: ${release.releaseId}`);
release.purpose = 'Fail closed on partial deployment of Decision & Outcome Learning, including collision-safe event case identity v0.1.2, coherent Cognitive Stack triggering, Security bindings, and the canonical autonomous cognitive-cycle release.';
for (const p of [FILES.recorder, FILES.engine, FILES.reviewer, FILES.policy]) {
  const item = release.files?.find(x => x.file === p);
  if (!item) fail(`Learning release manifest does not bind ${p}`);
  item.sha256 = sha256(fs.readFileSync(p));
}
fs.writeFileSync(FILES.release, JSON.stringify(release, null, 2) + '\n', 'utf8');

console.log(JSON.stringify({
  status: 'patched',
  repairVersion: '0.1.2-collision-safe-event-identity',
  currentBrainCaseCount: cases.length,
  uniqueCurrentCaseKeys: seen.size,
  preservedOwnerDecisionCaseKeys: existingKeyProofs.map(([, key]) => key),
  eventDiscriminatorProof: { eventA, eventB, distinct: eventA !== eventB },
  newSha256: Object.fromEntries([
    FILES.recorder, FILES.engine, FILES.reviewer, FILES.policy, FILES.release
  ].map(p => [p, sha256(fs.readFileSync(p))]))
}, null, 2));
