#!/usr/bin/env node
import fs from 'node:fs';

const recoveryPath='.github/workflows/resume-economic-graph-after-code-change.yml';
const explanatoryPath='.github/workflows/update-explanatory-context.yml';
const observerPath='.github/workflows/update-change-intelligence.yml';
const cognitivePath='.github/workflows/refresh-cognitive-stack.yml';
const liveVerifierPath='.github/workflows/verify-economic-graph-live-build.yml';
const freshnessGuardPath='intelligence/reliability/cognitive-freshness-guard.mjs';
const freshnessCanaryPath='intelligence/reliability/cognitive-freshness-guard-canary.mjs';
const validatorPoolHistoryConfigPath='intelligence/economic-graph/frax-frxeth-validator-pool-history-rpc.json';

const recovery=fs.readFileSync(recoveryPath,'utf8');
const explanatory=fs.readFileSync(explanatoryPath,'utf8');
const observer=fs.readFileSync(observerPath,'utf8');
const cognitive=fs.readFileSync(cognitivePath,'utf8');
const liveVerifier=fs.readFileSync(liveVerifierPath,'utf8');
const freshnessGuard=fs.readFileSync(freshnessGuardPath,'utf8');
const freshnessCanary=fs.readFileSync(freshnessCanaryPath,'utf8');

function assert(condition,message){if(!condition)throw new Error(message);}

for(const required of [
  "intelligence/economic-graph/*.mjs",
  "intelligence/explanatory/*.mjs",
  validatorPoolHistoryConfigPath,
  'permissions:',
  'contents: read',
  'actions: write',
  'group: economic-graph-code-change-resume',
  'cancel-in-progress: false',
  'Rebuild canonical Economic Graph first',
  'Prove physical eight-protocol Graph and Frax ecosystem',
  'Rebuild Explanatory only after Graph materialization',
  'Prove exact Graph to Explanatory Frax handoff',
  'Refresh Observer and System Memory before cognition',
  'Prove dependency-scoped Observer and System Memory contract',
  'Refresh canonical Cognitive Stack from proven Explanatory and Observer',
  'Prove Brain consumed Frax deep context',
  'Refresh Learning after Cognitive success',
  'Refresh Proposal Work Queue after Learning success',
  'Refresh Downstream Continuity after Proposal success',
  'Refresh Project Memory after downstream success',
  'Refresh Intelligence Progress after Project Memory success',
  "-f freshness_scope=economic-graph-recovery",
  "CHANGE_INTELLIGENCE_FILE=/tmp/change-intelligence.json",
  "SYSTEM_MEMORY_FILE=/tmp/system-memory.json",
  "--scope economic-graph-recovery",
  "--max-observer-age-hours 1",
  "intelligence/economic-graph/frax-sfrxusd-onchain.mjs",
  "intelligence/economic-graph/frax-sfrxusd-onchain-canary.mjs",
  "intelligence/economic-graph/frax-sfrxusd-onchain-enrich.mjs",
  "const surfaces=eco.surfaces||{}",
  "const baseExpected=[",
  "surfaceCount!==actualSurfaceKeys.length",
  "measured+unknown!==surfaceCount",
  "const graphSurfaceCount=Number(graphCoverage.surfaceCount)",
  "explanatorySurfaceCount!==graphSurfaceCount",
  "const explanatorySurfaceCount=Number(explanatoryFrax.coverage?.surfaceCount)",
  "Number(frax.surfaceCount)!==explanatorySurfaceCount",
  "measurementState.startsWith('MEASURED')",
  "measurementState.startsWith('UNKNOWN')",
  "sfrxUSD exact-block proof/value missing",
  "Explanatory Frax coverage not inherited from exact Graph",
  "Brain Frax coverage not inherited from Explanatory",
  "eco.epistemic?.revenueToVeFraxAprCausality",
  "eco.epistemic?.treasuryYieldToSpecificFxPoolIncentive",
  "eco.authority?.executionAuthority!=='none'",
  "eco.authority?.causalClaimAuthority!=='none'"
])assert(recovery.includes(required),`Recovery workflow contract missing: ${required}`);

const validatorPoolHistoryConfigOccurrences=recovery.split(validatorPoolHistoryConfigPath).length-1;
assert(validatorPoolHistoryConfigOccurrences>=2,'ValidatorPool history config must wake recovery and be verified in the recovery package');

for(const forbidden of [
  "surfaceCount!==9",
  "Number(explanatoryCoverage.surfaceCount)!==9",
  "Number(frax.surfaceCount)!==9",
  "Number(eco.coverage?.measuredSurfaceCount)!==1",
  "Number(eco.coverage?.sourceBoundUnknownSurfaceCount)!==8",
  "Explanatory Frax 9/1/8 coverage drift",
  "Brain Frax 9/1/8 coverage drift"
])assert(!recovery.includes(forbidden),`Recovery workflow retained stale fixed-depth contract: ${forbidden}`);

assert(observer.includes('workflow_dispatch:'),'Canonical Change Intelligence Observer lacks workflow_dispatch entrypoint');
assert(observer.includes('intelligence/system-memory.json'),'Observer no longer materializes System Memory');
assert(observer.includes('intelligence/change-intelligence.json'),'Observer no longer materializes Change Intelligence');
assert(!/contents:\s*write/.test(recovery),'Recovery controller must not write repository contents directly');
assert(!recovery.includes('gh workflow run unified-capital-refresh.yml --ref main'),'Recovery must not reintroduce redundant Unified Capital dispatch');

for(const required of [
  'workflow_dispatch:',
  'freshness_scope:',
  'default: global',
  'economic-graph-recovery',
  'intelligence/reliability/cognitive-freshness-guard.mjs',
  "github.event.workflow_run.event != 'workflow_dispatch'"
])assert(cognitive.includes(required),`Cognitive workflow scoped-freshness contract missing: ${required}`);
assert(!cognitive.includes("change.sourceHealth?.allFresh !== true"),'Cognitive workflow reintroduced inline global freshness coupling');

for(const required of [
  "global: Object.freeze",
  "'economic-graph-recovery': Object.freeze",
  "Object.freeze(['productivity', 'rewards'])",
  "unrelatedStaleSources",
  "Unknown cognitive freshness scope"
])assert(freshnessGuard.includes(required),`Freshness guard contract missing: ${required}`);
for(const required of [
  'global stale reporting',
  "for (const key of ['productivity', 'rewards'])",
  'graph dependency stale ${key}',
  'snapshot mismatch',
  'observer age',
  'unknown scope'
])assert(freshnessCanary.includes(required),`Freshness canary coverage missing: ${required}`);

const ordered=[
  'Rebuild canonical Economic Graph first',
  'Prove physical eight-protocol Graph and Frax ecosystem',
  'Rebuild Explanatory only after Graph materialization',
  'Prove exact Graph to Explanatory Frax handoff',
  'Refresh Observer and System Memory before cognition',
  'Prove dependency-scoped Observer and System Memory contract',
  'Refresh canonical Cognitive Stack from proven Explanatory and Observer',
  'Prove Brain consumed Frax deep context',
  'Refresh Learning after Cognitive success',
  'Refresh Proposal Work Queue after Learning success',
  'Refresh Downstream Continuity after Proposal success',
  'Refresh Project Memory after downstream success',
  'Refresh Intelligence Progress after Project Memory success',
  'Prove Project Memory is physically current after recovery'
].map(x=>recovery.indexOf(x));
assert(ordered.every(x=>x>=0)&&ordered.every((x,i)=>i===0||x>ordered[i-1]),'Recovery transaction order drift');

const pushBlock=explanatory.match(/\n  push:\n([\s\S]*?)\n\npermissions:/)?.[1]||'';
assert(pushBlock.includes('intelligence/economic-graph/economic-graph.json'),'Explanatory materialized Graph wake missing');
assert(!pushBlock.includes('intelligence/explanatory/explanatory-context.mjs'),'Premature Explanatory source push race reintroduced');
assert(!pushBlock.includes('intelligence/explanatory/vlcvx-votium-curve-shadow-context.mjs'),'Premature Explanatory extension source push race reintroduced');
assert(explanatory.includes("'the-holding-explanatory-context-production'"),'Explanatory serialized production lane missing');
assert(explanatory.includes("cancel-in-progress: ${{ github.event_name == 'pull_request' }}"),'Explanatory PR/production cancellation partition drift');

for(const required of [
  recoveryPath,
  explanatoryPath,
  cognitivePath,
  freshnessGuardPath,
  freshnessCanaryPath,
  'Prove dependency-scoped Observer and System Memory contract',
  'freshness_scope=economic-graph-recovery',
  'Serialized non-cancellable recovery lane missing'
])assert(liveVerifier.includes(required),`Live verifier is not bound to dependency-scoped recovery topology: ${required}`);

console.log('FRAX GRAPH→SCOPED COGNITION→MEMORY WORKFLOW DEFINITION PROOF PASS',{
  recoveryPath,
  explanatoryPath,
  observerPath,
  cognitivePath,
  liveVerifierPath,
  freshnessGuardPath,
  graphModuleCoverage:'globbed',
  fraxDepthContract:'base-plus-materialized-scope-extensions',
  sfrxUsdExactBlockBoundary:true,
  validatorPoolHistoryConfigRecovery:true,
  sourceRaceBlocked:true,
  globalFreshnessStillFailClosed:true,
  graphRecoveryFreshnessDependencies:['productivity','rewards'],
  unrelatedStaleSourcesRemainVisible:true,
  duplicateWorkflowDispatchCognitiveWakeBlocked:true,
  recoveryOrder:'Graph→Explanatory→Observer→Brain→Learning→Proposal→Downstream→Memory→Progress',
  controllerContentsAuthority:'read-only',
  executionAuthority:'none'
});
