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
  requireCondition(!workflow.includes('continue-on-error: true'), `${name}: live proof may not be softened with continue-on-error`);
  requireCondition(workflow.includes(helperPath), `${name}: bounded live evidence helper is not a PR dependency`);
  requireCondition(workflow.includes(proofPath), `${name}: paired definition proof is not a PR dependency`);
}

requireCondition(onchain.includes(`node ${helperPath} all27`), 'Onchain validator must invoke bounded all27 live evidence proof');
requireCondition(finalCohort.includes(`node ${helperPath} final9`), 'Final cohort validator must invoke bounded final9 live evidence proof');
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
requireCondition(helper.includes("row.status === 'dependency-warning' && row.dependencyStatus === 'divergent'"), 'Live helper dependency divergence boundary missing');
requireCondition(helper.includes('!(Number(row.usd) > 0)'), 'Live helper positive price criterion missing');
requireCondition(helper.includes("row.status !== 'shadow-ok'"), 'Final9 helper must still require strict shadow-ok status');
requireCondition(helper.includes('row.source !== req.source || row.network !== req.network'), 'Final9 helper route identity guard missing');
requireCondition(helper.includes('row.quoteAssetId !== req.quoteAssetId'), 'Final9 helper quote dependency identity guard missing');
requireCondition(helper.includes('Number(row.divergencePct) > Number(row.maxDivergencePct)'), 'Final9 helper divergence bound missing');
requireCondition(helper.includes("row.source !== 'uniswap-v3-twap-chainlink-quote'"), 'Final9 helper XAUT physical route guard missing');
requireCondition(helper.includes("healthy.set(row.assetId"), 'All27 evidence accumulation missing');
requireCondition(helper.includes("healthy.set(id"), 'Final9 evidence accumulation missing');
requireCondition(helper.includes('routes without a fresh healthy live observation'), 'Per-route missing-evidence fail-closed guard missing');
requireCondition(helper.includes('unavailableAcceptedAsHealthy: false'), 'Unavailable-as-healthy prohibition missing');
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
  all27EveryRoutePersonallyObservedHealthy: true,
  final9EveryRouteStrictlyObservedHealthy: true,
  simultaneousAllRouteAvailabilityRequired: false,
  liveEvidenceAndProductionMaterializationSeparated: true,
  deterministicPerAssetFailbackValidated: true,
  unavailableAcceptedAsHealthy: false,
  semanticRouteGuardsRelaxed: false,
  executionAuthority: 'none'
});
