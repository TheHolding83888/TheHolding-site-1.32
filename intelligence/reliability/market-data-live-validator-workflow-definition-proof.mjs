import fs from 'node:fs';

const onchainPath = '.github/workflows/validate-onchain-market-data.yml';
const finalPath = '.github/workflows/validate-market-data-final-onchain-cohort.yml';
const helperPath = 'intelligence/reliability/market-data-live-evidence-proof.mjs';
const proofPath = 'intelligence/reliability/market-data-live-validator-workflow-definition-proof.mjs';
const healthProofPath = 'intelligence/market-data/market-data-materializer-health-boundary-validation.mjs';
const onchain = fs.readFileSync(onchainPath, 'utf8');
const finalCohort = fs.readFileSync(finalPath, 'utf8');
const helper = fs.readFileSync(helperPath, 'utf8');
const healthProof = fs.readFileSync(healthProofPath, 'utf8');

function requireCondition(ok, message) {
  if (!ok) throw new Error(message);
}

for (const [name, workflow] of [['onchain', onchain], ['final-cohort', finalCohort]]) {
  requireCondition(workflow.includes(`# holding-workflow-definition-proof: ${proofPath}`), `${name}: paired workflow definition proof marker missing`);
  requireCondition(/permissions:\s*\n\s*contents:\s*read/.test(workflow), `${name}: validator must remain read-only`);
  requireCondition(!/contents:\s*write/.test(workflow), `${name}: contents:write authority forbidden`);
  requireCondition(!/actions:\s*write/.test(workflow), `${name}: actions:write authority forbidden`);
  requireCondition(!/id-token:\s*write/.test(workflow), `${name}: id-token:write authority forbidden`);
  requireCondition(!workflow.includes('continue-on-error: true'), `${name}: audit may not be softened with continue-on-error`);
  requireCondition(workflow.includes(helperPath), `${name}: bounded live health helper is not a PR dependency`);
  requireCondition(workflow.includes(proofPath), `${name}: paired definition proof is not a PR dependency`);
}

requireCondition(onchain.includes(`node ${helperPath} all27`), 'Onchain validator must invoke bounded all27 live health audit');
requireCondition(finalCohort.includes(`node ${helperPath} final9`), 'Final cohort validator must invoke bounded final9 live health audit');
requireCondition(onchain.includes('Audit all 27 live routes across bounded public RPC attempts'), 'Onchain live audit step drift');
requireCondition(finalCohort.includes('Audit final-route live health across bounded public RPC attempts'), 'Final cohort live audit step drift');
requireCondition(onchain.includes('Prove 30-minute observation and per-asset materialization contract'), 'Onchain validator lost scheduler/materialization contract proof');
requireCondition(finalCohort.includes('Validate deterministic authority and failback contracts'), 'Final cohort validator lost deterministic authority/failback proof');
requireCondition(finalCohort.includes(`node ${healthProofPath}`), 'Final cohort validator must execute deterministic materializer health-boundary proof');
requireCondition(finalCohort.includes(`- '${healthProofPath}'`), 'Final cohort validator health-boundary proof is not a PR dependency');

requireCondition(helper.includes("const allowedModes = new Set(['all27', 'final9'])"), 'Live helper mode boundary drift');
requireCondition(helper.includes('const attempts = 3;'), 'Live helper bounded three-attempt contract missing');
requireCondition(helper.includes('attempt <= attempts'), 'Live helper bounded attempt loop missing');
requireCondition(helper.includes('attempt * 2000'), 'Live helper bounded backoff missing');
requireCondition(helper.includes("shadow.mode !== 'shadow'"), 'Live helper Shadow authority guard missing');
requireCondition(helper.includes('shadow.coverage?.assetCount !== 27'), 'Live helper 27-route accounting guard missing');
requireCondition(helper.includes("shadow.authority?.executionAuthority !== 'none'"), 'Live helper executionAuthority guard missing');
requireCondition(helper.includes("row.status === 'shadow-ok'"), 'Live helper shadow-ok route health criterion missing');
requireCondition(helper.includes("row.status === 'divergent'"), 'Live helper divergence telemetry criterion missing');
requireCondition(helper.includes("row.status === 'dependency-warning' && row.dependencyStatus === 'divergent'"), 'Live helper dependency divergence telemetry criterion missing');
requireCondition(helper.includes('!(Number(row.usd) > 0)'), 'Live helper positive price criterion missing');
requireCondition(helper.includes('assertFinalIdentity'), 'Final cohort semantic identity guard missing');
requireCondition(helper.includes('live route source identity drift'), 'Final cohort source identity fail-closed guard missing');
requireCondition(helper.includes('live route network identity drift'), 'Final cohort network identity fail-closed guard missing');
requireCondition(helper.includes('live quote dependency identity drift'), 'Final cohort quote dependency identity fail-closed guard missing');
requireCondition(helper.includes("row.source !== 'uniswap-v3-twap-chainlink-quote'"), 'Final cohort XAUT source guard missing');
requireCondition(helper.includes('0x6546055f46e866a4b9a4a13e81273e3152bae5da'), 'Final cohort XAUT pool guard missing');
requireCondition(helper.includes('transportIncomplete'), 'Live helper must distinguish transport incompleteness from semantic failure');
requireCondition(helper.includes('routesNotObservedHealthy: missing'), 'Live helper must expose unresolved route-health telemetry');
requireCondition(helper.includes('unavailableAcceptedAsHealthy: false'), 'Unavailable-as-healthy prohibition missing');
requireCondition(helper.includes('semanticIdentityGuardsFailClosed: true'), 'Semantic identity fail-closed declaration missing');
requireCondition(helper.includes('divergenceRemainsTelemetry: true'), 'Divergence telemetry contract missing');
requireCondition(helper.includes('deterministicFailbackValidatedSeparately: true'), 'Live helper must separate failback proof from public-RPC transport health');
requireCondition(helper.includes('productionAuthorityMaterializationPerformedHere: false'), 'Live helper must explicitly remain observation-only');
requireCondition(!helper.includes('market-data-authority-materializer.mjs'), 'Live helper must not materialize authority from a multi-attempt evidence window');
requireCondition(!helper.includes('market-data.json'), 'Live helper must not inspect or mutate canonical production Market Data');
requireCondition(!helper.includes('unavailableAcceptedAsHealthy: true'), 'Unavailable routes may not be accepted as healthy');

requireCondition(healthProof.includes("selectedLane !== 'coingecko-lane'"), 'Deterministic health proof must require CoinGecko failback on real dependency failure');
requireCondition(healthProof.includes('failedSelection.fallbackUsed !== true'), 'Deterministic health proof must require explicit fallbackUsed=true');
requireCondition(healthProof.includes('materializerDelegatesRuntimeHealthToSelector: true'), 'Materializer health delegation proof missing');
requireCondition(healthProof.includes("executionAuthority: 'none'"), 'Deterministic health proof execution authority boundary missing');

console.log('Market Data live validator workflow definitions PASS', {
  transportWindowAttempts: 3,
  liveTransportMayRemainExplicitlyPartial: true,
  unavailableAcceptedAsHealthy: false,
  semanticIdentityGuardsFailClosed: true,
  divergenceIsTelemetryNotAuthorityFailure: true,
  liveEvidenceAndProductionMaterializationSeparated: true,
  deterministicPerAssetFailbackValidated: true,
  productionUnknownMayNotBeInventedAsZero: true,
  executionAuthority: 'none'
});
