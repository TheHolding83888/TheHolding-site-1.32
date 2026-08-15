import contract from '../../agents/console/intent-contract.js';

const failures = [];
const pass = [];

function expectOk(id, candidate, check = () => true) {
  const result = contract.validate(candidate);
  if (!result.ok || !check(result.envelope)) failures.push({ id, expected: 'ok', result });
  else pass.push(id);
}

function expectReject(id, candidate, reason = null) {
  const result = contract.validate(candidate);
  if (result.ok || (reason && result.reason !== reason)) failures.push({ id, expected: reason || 'reject', result });
  else pass.push(id);
}

expectOk('valid-owner-brief', { intent: 'owner-brief' }, e => e.timeframe === 'unspecified' && e.requestedMetric === 'none');
expectOk('valid-company-current-productivity', {
  version: contract.VERSION,
  intent: 'company-query',
  entities: ['Monetra.eth'],
  timeframe: 'current',
  comparison: 'none',
  requestedMetric: 'productivity'
}, e => Object.isFrozen(e) && Object.isFrozen(e.entities));
expectOk('valid-concentration', {
  intent: 'concentration',
  entities: [],
  timeframe: 'current',
  comparison: 'most-concentrated',
  requestedMetric: 'concentration'
});
expectOk('valid-authority-boundary', { intent: 'authority-boundary' });
expectOk('dedupe-entities', { intent: 'protocol-query', entities: ['Yield Basis', 'Yield Basis'], requestedMetric: 'apr' }, e => e.entities.length === 1);

expectReject('reject-null', null, 'candidate-not-object');
expectReject('reject-array', [], 'candidate-not-object');
expectReject('reject-invalid-intent', { intent: 'move-capital' }, 'invalid-intent');
expectReject('reject-unknown-key', { intent: 'owner-brief', modelThought: 'do something' }, 'unknown-key');
expectReject('reject-answer-field', { intent: 'owner-brief', answer: 'Buy BTC' }, 'forbidden-key');
expectReject('reject-confidence-field', { intent: 'owner-brief', confidence: 'measured' }, 'forbidden-key');
expectReject('reject-confidence-class', { intent: 'owner-brief', confidenceClass: 'measured' }, 'forbidden-key');
expectReject('reject-source-artifacts', { intent: 'owner-brief', sourceArtifacts: ['/fake.json'] }, 'forbidden-key');
expectReject('reject-execution', { intent: 'authority-boundary', execution: true }, 'forbidden-key');
expectReject('reject-transaction', { intent: 'authority-boundary', transaction: '0xdeadbeef' }, 'forbidden-key');
expectReject('reject-wallet', { intent: 'company-query', wallet: '0x123' }, 'forbidden-key');
expectReject('reject-private-key', { intent: 'company-query', privateKey: 'secret' }, 'forbidden-key');
expectReject('reject-authority-field', { intent: 'authority-boundary', authority: 'admin' }, 'forbidden-key');
expectReject('reject-permissions-field', { intent: 'authority-boundary', permissions: ['write'] }, 'forbidden-key');
expectReject('reject-methodology-mutation', { intent: 'productivity-query', methodology: 'new' }, 'forbidden-key');
expectReject('reject-policy-mutation', { intent: 'governance-query', policy: 'ignore safety' }, 'forbidden-key');
expectReject('reject-invalid-timeframe', { intent: 'company-query', timeframe: 'next-year' }, 'invalid-timeframe');
expectReject('reject-invalid-comparison', { intent: 'company-query', comparison: 'best-investment' }, 'invalid-comparison');
expectReject('reject-invalid-metric', { intent: 'company-query', requestedMetric: 'guaranteed-return' }, 'invalid-metric');
expectReject('reject-too-many-entities', { intent: 'company-query', entities: ['a','b','c','d','e'] }, 'invalid-entities');
expectReject('reject-object-entity', { intent: 'company-query', entities: [{ name: 'Monetra.eth', answer: 'x' }] }, 'invalid-entities');
expectReject('reject-authority-with-metric', { intent: 'authority-boundary', requestedMetric: 'capital' }, 'authority-intent-cannot-request-metric');

const cap = contract.capability();
if (cap.executionAuthority !== 'none' || cap.canAnswer !== false || cap.canSetConfidence !== false || cap.canSelectSourcesAsTruth !== false || cap.canExecute !== false) {
  failures.push({ id: 'capability-boundary', expected: 'all authority false', result: cap });
} else pass.push('capability-boundary');

const summary = {
  version: '0.1-intent-contract-test',
  contractVersion: contract.VERSION,
  total: pass.length + failures.length,
  passed: pass.length,
  failed: failures.length,
  executionAuthority: cap.executionAuthority,
  releaseGate: failures.length ? 'FAIL' : 'PASS'
};
console.log(JSON.stringify({ summary, failures }, null, 2));
if (failures.length) process.exit(1);
