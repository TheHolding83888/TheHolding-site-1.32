#!/usr/bin/env node
import fs from 'node:fs';
import { evaluateCandidate } from './repository-hygiene-guard.mjs';

const policy = JSON.parse(fs.readFileSync(new URL('./repository-hygiene-policy.json', import.meta.url), 'utf8'));

const positive = [
  { filePath: 'tmp/placeholder', content: 'x\n', added: true, expect: ['suspicious-added-path-segment', 'suspicious-added-basename-token', 'meaningless-added-content'] },
  { filePath: 'scratch/test.txt', content: 'test\n', added: true, expect: ['suspicious-added-path-segment', 'meaningless-added-content'] },
  { filePath: '.DS_Store', content: 'binary-ish', added: true, expect: ['hard-forbidden-basename'] },
  { filePath: 'src/app.js~', content: 'const ok = true;\n', added: true, expect: ['hard-forbidden-suffix'] }
];

const negative = [
  { filePath: 'src/x-coordinate.js', content: 'export const x = 1;\n', added: true },
  { filePath: 'verification/diagnostics/README.md', content: '# Intentional diagnostics\n', added: true },
  { filePath: 'intelligence/reliability/repository-hygiene-policy.json', content: '{"version":"test"}\n', added: true },
  { filePath: 'docs/temporary-liquidity-analysis.md', content: '# Temporary liquidity is an economic term here\n', added: true }
];

for (const fixture of positive) {
  const violations = evaluateCandidate({ ...fixture, policy });
  const rules = new Set(violations.map(v => v.rule));
  for (const expected of fixture.expect) {
    if (!rules.has(expected)) throw new Error(`positive canary missed ${expected} for ${fixture.filePath}`);
  }
}

for (const fixture of negative) {
  const violations = evaluateCandidate({ ...fixture, policy });
  if (violations.length) throw new Error(`negative canary false positive for ${fixture.filePath}: ${JSON.stringify(violations)}`);
}

console.log(`Repository Hygiene Canary PASS (${positive.length} positive / ${negative.length} negative)`);
