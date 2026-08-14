import fs from 'node:fs';

const evaluationPath = process.argv[2];
if (!evaluationPath) throw new Error('usage: node summarize-learning-needs-v0.1.mjs <evaluation.json>');
const evaluation = JSON.parse(fs.readFileSync(evaluationPath, 'utf8'));
const summary = evaluation.summary || {};
const results = evaluation.results || [];

const groups = new Map();
function add(kind, severity, row, reason) {
  const key = `${kind}:${row.expectedIntent || row.id || 'unknown'}`;
  const current = groups.get(key) || {
    class: kind,
    expectedIntent: row.expectedIntent || null,
    severity,
    count: 0,
    caseIds: [],
    reasons: new Set()
  };
  current.count++;
  current.caseIds.push(row.id);
  current.reasons.add(reason);
  if (severity === 'critical') current.severity = 'critical';
  groups.set(key, current);
}

for (const row of results) {
  if (!row.found) {
    add('evaluation-completeness', 'high', row, 'annotated case missing from run');
    continue;
  }
  if (row.falseMeasured) {
    add('false-measured', 'critical', row, 'system was MEASURED while intent/source/calibration proxy failed');
    continue;
  }
  if (!row.confidenceFit && row.expectedConfidence === 'measured') {
    add('capability-gap', 'medium', row, `expected measured but got ${row.actualConfidence || 'missing'}`);
  }
  if (!row.sourceFit || !row.additionalSourceFit) {
    add('source-binding-gap', row.actualConfidence === 'measured' ? 'critical' : 'medium', row, 'required source artifact not bound');
  }
  if (!row.answerPatternFit) {
    add('intent-or-answer-shape-gap', row.actualConfidence === 'measured' ? 'critical' : 'medium', row, 'required answer semantics missing');
  }
  if (row.forbiddenHit) {
    add('forbidden-substitution', 'critical', row, `forbidden substitution: ${row.forbiddenHit}`);
  }
}

const hypotheses = [...groups.values()].map(x => ({
  ...x,
  reasons: [...x.reasons],
  needsLearning: true,
  reviewRequired: true,
  autoPatchAuthorized: false,
  canonicalMemoryAuthorized: false
})).sort((a,b) => {
  const rank = { critical: 3, high: 2, medium: 1, low: 0 };
  return (rank[b.severity] - rank[a.severity]) || b.count - a.count;
});

const output = {
  version: '0.1-review-only-learning-needs',
  origin: summary.origin || null,
  sourceEvaluationVersion: summary.version || null,
  falseMeasuredRate: summary.falseMeasuredRate ?? null,
  needsLearning: hypotheses.length > 0,
  hypothesisCount: hypotheses.length,
  hypotheses,
  governance: {
    createsProposalAutomatically: false,
    patchesCodeAutomatically: false,
    writesCanonicalMemoryAutomatically: false,
    meaning: 'A learning need is an evidence-backed review hypothesis, not permission to change the system.'
  }
};

process.stdout.write(JSON.stringify(output, null, 2) + '\n');
