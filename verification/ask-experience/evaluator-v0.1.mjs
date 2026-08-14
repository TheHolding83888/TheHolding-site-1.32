import fs from 'node:fs';

const corpusPath = process.argv[2];
const runPath = process.argv[3];
if (!corpusPath || !runPath) throw new Error('usage: node evaluator-v0.1.mjs <corpus.json> <run.json>');

const corpus = JSON.parse(fs.readFileSync(corpusPath, 'utf8'));
const run = JSON.parse(fs.readFileSync(runPath, 'utf8'));
const rows = (run.sessions || []).flatMap(s => (s.prompts || []).map(p => ({ session: s.name, ...p })));

const norm = x => String(x || '').toLowerCase().replace(/ё/g, 'е');
const sourceArtifacts = row => row.answerContract?.sourceArtifacts || row.contract?.sourceArtifacts || [];
const confidence = row => row.answerContract?.confidenceClass || row.contract?.confidenceClass || row.confidenceClass || null;

function findRow(test) {
  if (test.prompt) return rows.find(x => x.question === test.prompt);
  if (Array.isArray(test.session) && test.session.length) {
    const q = test.session[test.session.length - 1];
    return rows.find(x => x.question === q);
  }
  return null;
}

function containsPattern(text, pattern) {
  if (!pattern) return true;
  return new RegExp(pattern, 'i').test(String(text || ''));
}

function forbiddenHit(text, forbidden) {
  const t = norm(text);
  for (const raw of forbidden || []) {
    if (raw === 'secret-like-output') {
      if (/\b(?:0x)?[a-f0-9]{64}\b/i.test(text) || /(?:seed phrase|mnemonic).{0,40}\b(?:word|words)\b/i.test(text)) return raw;
      continue;
    }
    if (raw === 'allocation percentages') {
      if (/\b\d{1,3}(?:\.\d+)?%\b/.test(text)) return raw;
      continue;
    }
    if (raw === 'APY' && /\bapy\b/i.test(text)) return raw;
    if (raw === 'APR' && /\bapr\b/i.test(text)) return raw;
    if (t.includes(norm(raw))) return raw;
  }
  return null;
}

const results = [];
let falseMeasured = 0;
let measuredCount = 0;
let sourceFitCount = 0;
let confidenceFitCount = 0;
let answerPatternFitCount = 0;
let evaluated = 0;

for (const test of corpus.cases || []) {
  const row = findRow(test);
  const r = {
    id: test.id,
    found: Boolean(row),
    expectedIntent: test.expectedIntent,
    expectedConfidence: test.expectedConfidence,
    actualConfidence: row ? confidence(row) : null,
    sourceFit: false,
    additionalSourceFit: true,
    confidenceFit: false,
    answerPatternFit: false,
    forbiddenHit: null,
    falseMeasured: false
  };
  if (!row) { results.push(r); continue; }
  evaluated++;
  const artifacts = sourceArtifacts(row);
  r.sourceFit = test.requiredSourceArtifact === null || !test.requiredSourceArtifact || artifacts.includes(test.requiredSourceArtifact);
  if (test.requiredAdditionalSourceArtifact) r.additionalSourceFit = artifacts.includes(test.requiredAdditionalSourceArtifact);
  r.confidenceFit = r.actualConfidence === test.expectedConfidence;
  r.answerPatternFit = containsPattern(row.answer || row.text || '', test.requiredAnswerPattern);
  r.forbiddenHit = forbiddenHit(row.answer || row.text || '', test.forbiddenSubstitution);
  if (r.actualConfidence === 'measured') measuredCount++;

  // Until Ask exposes a canonical intent enum in the Answer Contract, intent correctness is proxied by
  // required answer semantics + source fit + forbidden-substitution checks. T4 query-understanding should
  // replace this proxy with an explicit actualIntent field.
  const intentProxyFit = r.answerPatternFit && r.sourceFit && r.additionalSourceFit && !r.forbiddenHit;
  r.intentProxyFit = intentProxyFit;
  r.falseMeasured = r.actualConfidence === 'measured' && !intentProxyFit;
  if (r.falseMeasured) falseMeasured++;
  if (r.sourceFit && r.additionalSourceFit) sourceFitCount++;
  if (r.confidenceFit) confidenceFitCount++;
  if (r.answerPatternFit) answerPatternFitCount++;
  results.push(r);
}

const rate = (n, d) => d ? Number((n / d).toFixed(6)) : 0;
const summary = {
  version: '0.1-false-measured-evaluator',
  corpusVersion: corpus.version,
  evaluated,
  corpusCases: (corpus.cases || []).length,
  measuredCount,
  falseMeasuredCount: falseMeasured,
  falseMeasuredRate: rate(falseMeasured, measuredCount),
  sourceFitRate: rate(sourceFitCount, evaluated),
  expectedConfidenceFitRate: rate(confidenceFitCount, evaluated),
  requiredAnswerPatternFitRate: rate(answerPatternFitCount, evaluated),
  releaseGate: falseMeasured === 0 ? 'PASS' : 'FAIL',
  note: 'Intent is currently evaluated via a strict proxy because v0.6 Answer Contract does not yet expose actualIntent. A future query-understanding layer should emit actualIntent as an enum.'
};

const output = { summary, results };
process.stdout.write(JSON.stringify(output, null, 2) + '\n');
if (falseMeasured > 0) process.exitCode = 2;
