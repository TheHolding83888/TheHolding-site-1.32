#!/usr/bin/env node
import fs from 'node:fs';
import { extractKnownFingerprints, planIncidentWrites, marker } from './runtime-reliability-incident-sink.mjs';

const policy = JSON.parse(fs.readFileSync(new URL('./runtime-reliability-policy.json', import.meta.url), 'utf8'));
const incident = {
  type: 'repeated-failure', severity: 'red', subject: 'worker-a', detail: '2 consecutive production failures',
  classFingerprint: 'abcdef123456789012', occurrenceFingerprint: '1234567890abcdef123456', regression: false,
  rootCause: 'UNKNOWN_UNTIL_REVIEWED'
};
const report = { generatedAt: '2026-08-25T17:30:00.000Z', materialIncidents: [incident] };
function assert(cond, msg) { if (!cond) throw new Error(msg); }

const createPlan = planIncidentWrites(report, [], policy);
assert(createPlan.length === 1 && createPlan[0].action === 'create', 'new incident must create one issue');
assert(createPlan[0].body.includes(marker(incident.classFingerprint)), 'issue body must carry durable fingerprint');

const openRecent = [{ number: 11, state: 'open', body: marker(incident.classFingerprint), updated_at: '2026-08-25T16:30:00.000Z' }];
assert(planIncidentWrites(report, openRecent, policy).length === 0, 'cooldown must prevent comment spam');

const openOld = [{ number: 11, state: 'open', body: marker(incident.classFingerprint), updated_at: '2026-08-25T09:30:00.000Z' }];
const commentPlan = planIncidentWrites(report, openOld, policy);
assert(commentPlan.length === 1 && commentPlan[0].action === 'comment', 'old open incident should receive bounded recurrence comment');

const closed = [{ number: 11, state: 'closed', body: marker(incident.classFingerprint), updated_at: '2026-08-25T17:20:00.000Z' }];
const reopenPlan = planIncidentWrites(report, closed, policy);
assert(reopenPlan.length === 1 && reopenPlan[0].action === 'reopen', 'closed known incident must reopen on recurrence');

const known = extractKnownFingerprints([{ body: marker(incident.classFingerprint) }, { body: 'none' }]);
assert(known.length === 1 && known[0] === incident.classFingerprint, 'known fingerprint extraction failed');

console.log('Runtime Reliability incident sink canary PASS');
