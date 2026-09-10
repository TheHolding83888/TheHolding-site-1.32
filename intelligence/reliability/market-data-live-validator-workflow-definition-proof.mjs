import fs from 'node:fs';

const onchainPath = '.github/workflows/validate-onchain-market-data.yml';
const finalPath = '.github/workflows/validate-market-data-final-onchain-cohort.yml';
const proofPath = 'intelligence/reliability/market-data-live-validator-workflow-definition-proof.mjs';
const onchain = fs.readFileSync(onchainPath, 'utf8');
const finalCohort = fs.readFileSync(finalPath, 'utf8');

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
  requireCondition(workflow.includes('for attempt in 1 2 3; do'), `${name}: bounded three-attempt live proof missing`);
  requireCondition(workflow.includes('sleep $((attempt * 2))'), `${name}: bounded retry backoff missing`);
}

requireCondition(onchain.includes('prove_27_routes()'), 'Onchain validator: strict 27-route proof function missing');
requireCondition(onchain.includes("Number(shadow.coverage?.unavailableCount)!==0"), 'Onchain validator: unavailable routes must still fail');
requireCondition(onchain.includes("shadow.coverage?.okCount)+Number(shadow.coverage?.warningCount)!==27"), 'Onchain validator: 27-route coverage accounting guard missing');
requireCondition(onchain.includes("row?.status==='shadow-ok'"), 'Onchain validator: shadow-ok route health guard missing');
requireCondition(onchain.includes("row?.status==='divergent'"), 'Onchain validator: bounded divergence telemetry allowance missing');
requireCondition(onchain.includes("row?.status==='dependency-warning'&&row?.dependencyStatus==='divergent'"), 'Onchain validator: dependency divergence telemetry boundary missing');
requireCondition(onchain.includes("if(!(Number(row?.usd)>0))"), 'Onchain validator: positive live price guard missing');
requireCondition(onchain.includes("shadow.authority?.executionAuthority!=='none'"), 'Onchain validator: executionAuthority boundary missing');
requireCondition(onchain.includes('Live 27-route proof failed after 3 bounded strict attempts.'), 'Onchain validator: all-attempts-failed terminal guard missing');

requireCondition(finalCohort.includes('prove_live_snapshot()'), 'Final cohort validator: full-snapshot proof function missing');
requireCondition(finalCohort.includes("if(ids.length!==9)"), 'Final cohort validator: exact nine reviewed assets guard missing');
requireCondition(finalCohort.includes("row.status!=='shadow-ok'||!(Number(row.usd)>0)"), 'Final cohort validator: strict final-route health guard missing');
requireCondition(finalCohort.includes("row.source!==req.source||row.network!==req.network"), 'Final cohort validator: route identity guard missing');
requireCondition(finalCohort.includes("row.quoteAssetId!==req.quoteAssetId"), 'Final cohort validator: quote dependency identity guard missing');
requireCondition(finalCohort.includes("Number(row.divergencePct)>Number(row.maxDivergencePct)"), 'Final cohort validator: divergence bound guard missing');
requireCondition(finalCohort.includes("xaut.source!=='uniswap-v3-twap-chainlink-quote'"), 'Final cohort validator: XAUT physical route guard missing');
requireCondition(finalCohort.includes("m.authority?.onchainSelectedAssetCount!==26"), 'Final cohort validator: 26/26 canonical onchain selection guard missing');
requireCondition(finalCohort.includes("m.authority?.coingeckoSelectedAssetCount!==0"), 'Final cohort validator: CoinGecko selection must remain zero in full live proof');
requireCondition(finalCohort.includes("m.authority?.fallbackCount!==0"), 'Final cohort validator: fallback count must remain zero in full live proof');
requireCondition(finalCohort.includes("m.authority?.unknownCount!==0"), 'Final cohort validator: unknown count must remain zero in full live proof');
requireCondition(finalCohort.includes("row.authority?.selectedLane!=='onchain'"), 'Final cohort validator: every canonical asset must remain physically onchain-selected');
requireCondition(finalCohort.includes("m.authority?.executionAuthority!=='none'"), 'Final cohort validator: executionAuthority boundary missing');
requireCondition(finalCohort.includes('Final canonical onchain proof failed after 3 bounded strict attempts.'), 'Final cohort validator: all-attempts-failed terminal guard missing');

console.log('Market Data bounded strict live validator workflow definitions PASS', {
  onchainAttempts: 3,
  finalCohortAttempts: 3,
  onchainRouteCount: 27,
  reviewedFinalRouteCount: 9,
  canonicalOnchainSelectionCount: 26,
  semanticGuardsRelaxed: false,
  executionAuthority: 'none'
});
