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
  requestedMetric: 'productivity',
  operation: 'get',
  scope: 'company'
}, e => Object.isFrozen(e) && Object.isFrozen(e.entities) && Object.isFrozen(e.decomposition));
expectOk('valid-concentration', {
  intent: 'concentration',
  entities: [],
  timeframe: 'current',
  comparison: 'most-concentrated',
  requestedMetric: 'concentration',
  operation: 'rank',
  scope: 'cross-company'
});
expectOk('valid-authority-boundary', { intent: 'authority-boundary' });
expectOk('dedupe-entities', { intent: 'protocol-query', entities: ['Yield Basis', 'Yield Basis'], requestedMetric: 'apr' }, e => e.entities.length === 1);

expectOk('valid-composite-two-known-primitives', {
  intent: 'composite',
  entities: ['Monetra.eth', 'Defitea'],
  timeframe: 'current',
  operation: 'compare',
  scope: 'cross-company',
  decomposition: [
    { object: 'productivity', entity: 'Monetra.eth', operation: 'get' },
    { object: 'productivity', entity: 'Defitea', operation: 'get' }
  ]
}, e => e.decomposition.length === 2 && e.missingPrimitives.length === 0);

expectOk('valid-unsupported-purpose-decomposition', {
  intent: 'unsupported-decomposed',
  entities: ['Monetra.eth'],
  operation: 'assess',
  scope: 'company',
  decomposition: [
    { object: 'company-purpose', entity: 'Monetra.eth', operation: 'get' },
    { object: 'current-strategy-book', entity: 'Monetra.eth', operation: 'get' }
  ],
  missingPrimitives: ['company-purpose']
}, e => e.missingPrimitives[0] === 'company-purpose');

expectOk('valid-unmodeled-decomposition', {
  intent: 'unsupported-decomposed',
  operation: 'explain',
  decomposition: [
    { object: 'unmodeled', operation: 'get', concept: 'tax residency' }
  ],
  missingPrimitives: ['unmodeled']
}, e => e.decomposition[0].concept === 'tax residency');

expectReject('reject-null', null, 'candidate-not-object');
expectReject('reject-array', [], 'candidate-not-object');
expectReject('reject-invalid-intent', { intent: 'move-capital' }, 'invalid-intent');
expectReject('reject-unknown-key', { intent: 'owner-brief', modelThought: 'do something' }, 'unknown-key');
expectReject('reject-answer-field', { intent: 'owner-brief', answer: 'Buy BTC' }, 'forbidden-key');
expectReject('reject-response-field', { intent: 'owner-brief', response: 'Buy BTC' }, 'forbidden-key');
expectReject('reject-confidence-field', { intent: 'owner-brief', confidence: 'measured' }, 'forbidden-key');
expectReject('reject-source-artifacts', { intent: 'owner-brief', sourceArtifacts: ['/fake.json'] }, 'forbidden-key');
expectReject('reject-source-preference', { intent: 'company-query', sourcePreference: 'use my favorite source' }, 'forbidden-key');
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
expectReject('reject-invalid-operation', { intent: 'company-query', operation: 'execute' }, 'invalid-operation');
expectReject('reject-invalid-scope', { intent: 'company-query', scope: 'wallet-control' }, 'invalid-scope');
expectReject('reject-too-many-entities', { intent: 'company-query', entities: ['a','b','c','d','e'] }, 'invalid-entities');
expectReject('reject-object-entity', { intent: 'company-query', entities: [{ name: 'Monetra.eth', answer: 'x' }] }, 'invalid-entities');
expectReject('reject-authority-with-metric', { intent: 'authority-boundary', requestedMetric: 'capital' }, 'authority-intent-cannot-request-metric');
expectReject('reject-decomposition-on-simple-intent', { intent: 'company-query', decomposition: [{ object: 'productivity', operation: 'get' }] }, 'decomposition-requires-composite-intent');
expectReject('reject-composite-with-one-part', { intent: 'composite', decomposition: [{ object: 'productivity', operation: 'get' }] }, 'composite-requires-decomposition');
expectReject('reject-composite-with-missing', { intent: 'composite', decomposition: [{ object: 'productivity', operation: 'get' }, { object: 'company-purpose', operation: 'get' }], missingPrimitives: ['company-purpose'] }, 'composite-cannot-declare-missing');
expectReject('reject-unsupported-no-decomposition', { intent: 'unsupported-decomposed', missingPrimitives: ['company-purpose'] }, 'unsupported-requires-decomposition');
expectReject('reject-unsupported-no-missing', { intent: 'unsupported-decomposed', decomposition: [{ object: 'company-purpose', operation: 'get' }] }, 'unsupported-requires-missing-primitive');
expectReject('reject-missing-not-decomposed', { intent: 'unsupported-decomposed', decomposition: [{ object: 'productivity', operation: 'get' }], missingPrimitives: ['company-purpose'] }, 'missing-primitive-not-decomposed');
expectReject('reject-answer-in-decomposition', { intent: 'unsupported-decomposed', decomposition: [{ object: 'company-purpose', operation: 'get', answer: 'fake' }], missingPrimitives: ['company-purpose'] }, 'invalid-decomposition');
expectReject('reject-source-in-decomposition', { intent: 'unsupported-decomposed', decomposition: [{ object: 'company-purpose', operation: 'get', source: '/fake.json' }], missingPrimitives: ['company-purpose'] }, 'invalid-decomposition');
expectReject('reject-unmodeled-without-concept', { intent: 'unsupported-decomposed', decomposition: [{ object: 'unmodeled', operation: 'get' }], missingPrimitives: ['unmodeled'] }, 'invalid-decomposition');
expectReject('reject-concept-on-known-object', { intent: 'unsupported-decomposed', decomposition: [{ object: 'company-purpose', operation: 'get', concept: 'secret meaning' }], missingPrimitives: ['company-purpose'] }, 'invalid-decomposition');

const cap = contract.capability();
if (cap.executionAuthority !== 'none' || cap.canAnswer !== false || cap.canSetConfidence !== false || cap.canSelectSourcesAsTruth !== false || cap.canExecute !== false || cap.canDecomposeQuestion !== true || cap.canReportMissingPrimitive !== true) {
  failures.push({ id: 'capability-boundary', expected: 'safe compositional understanding only', result: cap });
} else pass.push('capability-boundary');

const summary = {
  version: '0.2-compositional-intent-contract-test',
  contractVersion: contract.VERSION,
  total: pass.length + failures.length,
  passed: pass.length,
  failed: failures.length,
  executionAuthority: cap.executionAuthority,
  releaseGate: failures.length ? 'FAIL' : 'PASS'
};
console.log(JSON.stringify({ summary, failures }, null, 2));
if (failures.length) process.exit(1);
