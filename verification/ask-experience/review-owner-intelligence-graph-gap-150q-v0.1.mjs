import fs from 'node:fs';

const corpus = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const run = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
const expectedById = new Map((corpus.cases || []).map(x => [x.id, x]));
const rows = [];
const genericFallbackRe = /Пока не могу ответить на это достаточно точно без свободной AI-модели|cannot answer this precisely enough without a free AI model|Попробуй спросить про компанию|Try asking about a company/i;

for (const c of run.cases || []) {
  const p = c.prompts?.at(-1) || {};
  const contract = p.answerContract || {};
  const expected = expectedById.get(c.id) || {};
  const confidence = contract.confidenceClass || 'missing';
  const sourceArtifacts = contract.sourceArtifacts || [];
  const genericFallback = genericFallbackRe.test(p.answer || '');
  const expectedConfidence = expected.expectedConfidence || null;
  const confidenceMatch = !expectedConfidence || confidence === expectedConfidence;
  const groundedContract = contract.grounded === true;
  const sourceBoundWhenClaiming = !['measured','partial'].includes(confidence) || sourceArtifacts.length > 0;
  rows.push({
    id: c.id,
    group: expected.discoveryTarget || c.discoveryTarget || 'unknown',
    expectedConfidence,
    confidence,
    confidenceMatch,
    groundedContract,
    sourceArtifactCount: sourceArtifacts.length,
    sourceBoundWhenClaiming,
    genericFallback,
    harnessError: Boolean(p.harnessError || c.fatal),
    question: p.question || '',
    answer: p.answer || '',
    sourceArtifacts
  });
}

const byGroup = {};
for (const r of rows) {
  const g = byGroup[r.group] ||= { questions:0, confidence:{}, genericFallback:0, expectedConfidenceMismatch:0, missingSourceBinding:0, harnessErrors:0 };
  g.questions++;
  g.confidence[r.confidence] = (g.confidence[r.confidence] || 0) + 1;
  if (r.genericFallback) g.genericFallback++;
  if (!r.confidenceMatch) g.expectedConfidenceMismatch++;
  if (!r.sourceBoundWhenClaiming) g.missingSourceBinding++;
  if (r.harnessError) g.harnessErrors++;
}

const flagged = rows.filter(r => r.genericFallback || !r.confidenceMatch || !r.sourceBoundWhenClaiming || r.harnessError);
const summary = {
  version: '0.1-owner-intelligence-graph-gap-review',
  releaseGateEligible: false,
  questionCount: rows.length,
  harnessErrors: rows.filter(r=>r.harnessError).length,
  genericFallbackCount: rows.filter(r=>r.genericFallback).length,
  expectedConfidenceMismatchCount: rows.filter(r=>!r.confidenceMatch).length,
  missingSourceBindingCount: rows.filter(r=>!r.sourceBoundWhenClaiming).length,
  groundedContractCount: rows.filter(r=>r.groundedContract).length,
  flaggedCount: flagged.length,
  byGroup,
  topFlagged: flagged.slice(0, 80).map(r => ({
    id:r.id, group:r.group, question:r.question, expectedConfidence:r.expectedConfidence,
    confidence:r.confidence, genericFallback:r.genericFallback, sourceArtifactCount:r.sourceArtifactCount,
    answer:r.answer.slice(0, 600)
  }))
};
console.log(JSON.stringify(summary, null, 2));
