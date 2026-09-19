#!/usr/bin/env node
import fs from 'node:fs';

const WORKFLOW = '.github/workflows/production-deployment-smoke.yml';
const ASSET_IGNORE = '.assetsignore';
const PROOF = 'intelligence/reliability/production-deployment-smoke-definition-proof.mjs';

function requireInvariant(condition, message) {
  if (!condition) throw new Error(message);
}

const workflow = fs.readFileSync(WORKFLOW, 'utf8');
const assetIgnore = fs.readFileSync(ASSET_IGNORE, 'utf8');

requireInvariant(
  workflow.includes(`# holding-workflow-definition-proof: ${PROOF}`),
  'deployment smoke must stay bound to this deterministic workflow-definition proof'
);
requireInvariant(
  workflow.includes("^\\.assetsignore$|(^|/)wrangler[^/]*\\.jsonc?$|^worker/|^index\\.html$|^agents/|^companies/index\\.html$"),
  '.assetsignore must remain deployment-sensitive in the Cloudflare preview gate'
);
requireInvariant(
  workflow.includes('Workers Builds: theholdingprotocol'),
  'deployment smoke must continue to require the canonical Cloudflare Workers build check'
);
requireInvariant(
  workflow.includes('Cloudflare build succeeded but did not expose a valid Version ID.'),
  'preview gate must continue to fail closed when Cloudflare does not expose a valid Version ID'
);
requireInvariant(
  workflow.includes('Production homepage smoke'),
  'post-merge production homepage smoke must remain enabled'
);
requireInvariant(
  assetIgnore.split(/\r?\n/).includes('intelligence/economic-graph/economic-graph.json'),
  'oversized canonical Economic Graph must remain outside the public static-asset bundle'
);
requireInvariant(
  assetIgnore.split(/\r?\n/).includes('intelligence/brain-intelligence.json'),
  'oversized canonical Brain intelligence must remain outside the public static-asset bundle'
);

console.log('PRODUCTION DEPLOYMENT SMOKE DEFINITION PROOF PASS');
console.log(JSON.stringify({
  workflow: WORKFLOW,
  proof: PROOF,
  deploymentSensitiveAssetBoundary: true,
  cloudflareExactCheckRequired: true,
  validVersionIdRequired: true,
  productionSmokePreserved: true,
  excludedCanonicalLargeArtifacts: [
    'intelligence/economic-graph/economic-graph.json',
    'intelligence/brain-intelligence.json'
  ]
}, null, 2));
