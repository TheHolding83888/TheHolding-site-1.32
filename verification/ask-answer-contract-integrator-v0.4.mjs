#!/usr/bin/env node
import fs from 'node:fs';

const APP = 'agents/console/app.js';
const app = fs.readFileSync(APP, 'utf8');
const fail = message => { throw new Error(message); };

if (!app.includes("const ANSWER_CONTRACT_VERSION = '0.1-source-bound-answer-contract';")) {
  fail('Ask v0.4 product patch is not present; refusing repair against an unexpected baseline.');
}

function replaceExact(text, before, after, label) {
  const count = text.split(before).length - 1;
  if (count !== 1) fail(`${label}: expected exactly one malformed target, found ${count}`);
  return text.replace(before, after);
}

let next = app;
next = replaceExact(
  next,
  "    const hasMeasuredValue = /(?:$|d+(?:[.,]d+)?%)/.test(String(result?.text || ''));",
  String.raw`    const hasMeasuredValue = /(?:\$|\d+(?:[.,]\d+)?%)/.test(String(result?.text || ''));`,
  'measured-value regex repair'
);
next = replaceExact(
  next,
  "    const coverageMatches = [...String(result?.text || '').matchAll(/(?:coverage|покрытие)[^0-9]{0,24}(d+(?:[.,]d+)?)%/gi)];",
  String.raw`    const coverageMatches = [...String(result?.text || '').matchAll(/(?:coverage|покрытие)[^0-9]{0,24}(\d+(?:[.,]\d+)?)%/gi)];`,
  'coverage regex repair'
);

if (next === app) fail('Repair produced no product diff.');
fs.writeFileSync(APP, next, 'utf8');

console.log(JSON.stringify({
  status: 'repaired',
  target: APP,
  repairs: ['measured-value-regex', 'coverage-regex'],
  persistentLearningActivated: false
}, null, 2));
