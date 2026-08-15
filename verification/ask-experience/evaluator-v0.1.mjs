import fs from 'node:fs';

const corpusPath = process.argv[2];
const runPath = process.argv[3];
if (!corpusPath || !runPath) throw new Error('usage: node evaluator-v0.1.mjs <corpus.json> <run.json>');

const corpus = JSON.parse(fs.readFileSync(corpusPath, 'utf8'));
const run = JSON.parse(fs.readFileSync(runPath, 'utf8'));

const legacyRows = (run.sessions || []).flatMap(s => (s.prompts || []).map(p => ({ session: s.name, ...p })));
const caseRows = (run.cases || []).map(c => ({
  caseId: c.id,
  origin: c.origin || run.origin || corpus.origin || 'synthetic-regression',
  ...((c.prompts || []).at(-1) || {})
}));
const rows = caseRows.length ? caseRows : legacyRows;

const norm = x => String(x || '').toLowerCase().replace(/ё/g, 'е');
const sourceArtifacts = row => row?.answerContract?.sourceArtifacts || row?.contract?.sourceArtifacts || [];
const confidence = row => row?.answerContract?.confidenceClass || row?.contract?.confidenceClass || row?.confidenceClass || null;

function findRow(test) {
  if (caseRows.length) {
    const byId = caseRows.find(x => x.caseId === test.id);
    if (byId) return byId;
  }
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

function metricIsOnlyNegatedMention(text, metric) {
  const m = metric.toLowerCase();
  const escaped = m.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const negation = '(?:not|never|will not|won.t|do not|don.t|cannot|не буду|не подмен|не замен|не равно|не является|нельзя)';
  const substitution = '(?:substitut|replace|use|подмен|замен|выдава|считать)';
  const before = new RegExp(`${negation}.{0,70}\\b${escaped}\\b`, 'i');
  const after = new RegExp(`\\b${escaped}\\b.{0,70}(?:${negation}|${substitution})`, 'i');
  const metricValue = new RegExp(`\\b${escaped}\\b.{0,20}\\d+(?:[.,]\\d+)?%`, 'i');
  return (before.test(text) || after.test(text)) && !metricValue.test(text);
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
    if (raw === 'APY' && /\bapy\b/i.test(text)) {
      if (!metricIsOnlyNegatedMention(text, 'APY')) return raw;
      continue;
    }
    if (raw === 'APR' && /\bapr\b/i.test(text)) {
      if (!metricIsOnlyNegatedMention(text, 'APR')) return raw;
      continue;
    }
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
let strictFailures = 0;

for (const test of corpus.cases || []) {
  const row = findRow(test);
  const r = {
    id: test.id,
    origin: row?.origin || test.origin || run.origin || corpus.origin || 'synthetic-regression',
    found: Boolean(row),
    expectedIntent: test.expectedIntent ?? null,
    expectedConfidence: test.expectedConfidence ?? null,
    actualConfidence: row ? confidence(row) : null,
    sourceFit: false,
    additionalSourceFit: true,
    confidenceFit: false,
    answerPatternFit: false,
    forbiddenHit: null,
    intentProxyFit: false,
    falseMeasured: false,
    strictPass: false
  };
  if (!row) {
    strictFailures++;
    results.push(r);
    continue;
  }

  evaluated++;
  const artifacts = sourceArtifacts(row);
  r.sourceFit = test.requiredSourceArtifact === null || !test.requiredSourceArtifact || artifacts.includes(test.requiredSourceArtifact);
  if (test.requiredAdditionalSourceArtifact) r.additionalSourceFit = artifacts.includes(test.requiredAdditionalSourceArtifact);
  r.confidenceFit = !test.expectedConfidence || r.actualConfidence === test.expectedConfidence;
  r.answerPatternFit = containsPattern(row.answer || row.text || '', test.requiredAnswerPattern);
  r.forbiddenHit = forbiddenHit(row.answer || row.text || '', test.forbiddenSubstitution);
  if (r.actualConfidence === 'measured') measuredCount++;

  // Until Ask exposes a canonical intent enum in the Answer Contract, intent correctness is proxied by
  // required answer semantics + source fit + forbidden-substitution checks. Query-understanding may later
  // replace only this proxy; deterministic source/confidence/output gates remain authoritative.
  r.intentProxyFit = r.answerPatternFit && r.sourceFit && r.additionalSourceFit && !r.forbiddenHit;

  // A MEASURED answer is false-confident when its intent/source proxy fails OR the annotated corpus says
  // the correct confidence should be lower. Correct UNKNOWN is therefore a success, not a coverage failure.
  r.falseMeasured = r.actualConfidence === 'measured' && (!r.intentProxyFit || (test.expectedConfidence && test.expectedConfidence !== 'measured'));
  if (r.falseMeasured) falseMeasured++;

  r.strictPass = r.intentProxyFit && r.confidenceFit;
  if (!r.strictPass) strictFailures++;
  if (r.sourceFit && r.additionalSourceFit) sourceFitCount++;
  if (r.confidenceFit) confidenceFitCount++;
  if (r.answerPatternFit) answerPatternFitCount++;
  results.push(r);
}

const rate = (n, d) => d ? Number((n / d).toFixed(6)) : 0;
const corpusCases = (corpus.cases || []).length;
const falseMeasuredRate = rate(falseMeasured, measuredCount);
const complete = evaluated === corpusCases;
const trustGate = falseMeasured === 0 && complete ? 'PASS' : 'FAIL';
const strictInvariantGate = strictFailures === 0 && complete ? 'PASS' : 'FAIL';
const releaseGate = corpus.frozen === true ? strictInvariantGate : trustGate;

const summary = {
  version: '0.2-origin-scoped-false-measured-evaluator',
  origin: run.origin || corpus.origin || 'synthetic-regression',
  corpusVersion: corpus.version,
  runVersion: run.version || null,
  seed: run.seed || corpus.seed || null,
  grammarVersion: run.grammarVersion || corpus.grammarVersion || null,
  evaluated,
  corpusCases,
  measuredCount,
  falseMeasuredCount: falseMeasured,
  falseMeasuredRate,
  sourceFitRate: rate(sourceFitCount, evaluated),
  expectedConfidenceFitRate: rate(confidenceFitCount, evaluated),
  requiredAnswerPatternFitRate: rate(answerPatternFitCount, evaluated),
  strictFailureCount: strictFailures,
  trustGate,
  strictInvariantGate,
  releaseGate,
  crossOriginAggregateScore: false,
  note: 'Metrics are scoped to one evidence origin. Intent is currently evaluated via a strict proxy because the Answer Contract does not yet expose actualIntent.'
};

const output = { summary, results };
process.stdout.write(JSON.stringify(output, null, 2) + '\n');
if (releaseGate !== 'PASS') process.exitCode = 2;
