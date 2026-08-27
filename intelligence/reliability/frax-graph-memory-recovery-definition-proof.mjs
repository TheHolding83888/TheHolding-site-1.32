#!/usr/bin/env node
import fs from 'node:fs';

const recoveryPath='.github/workflows/resume-economic-graph-after-code-change.yml';
const explanatoryPath='.github/workflows/update-explanatory-context.yml';
const liveVerifierPath='.github/workflows/verify-economic-graph-live-build.yml';
const recovery=fs.readFileSync(recoveryPath,'utf8');
const explanatory=fs.readFileSync(explanatoryPath,'utf8');
const liveVerifier=fs.readFileSync(liveVerifierPath,'utf8');

function assert(condition,message){if(!condition)throw new Error(message);}

for(const required of [
  "intelligence/economic-graph/*.mjs",
  "intelligence/explanatory/*.mjs",
  'permissions:',
  'contents: read',
  'actions: write',
  'group: economic-graph-code-change-resume',
  'cancel-in-progress: false',
  'Rebuild canonical Economic Graph first',
  'Prove physical eight-protocol Graph and Frax ecosystem',
  'Rebuild Explanatory only after Graph materialization',
  'Prove exact Graph to Explanatory Frax handoff',
  'Refresh canonical Cognitive Stack from proven Explanatory',
  'Prove Brain consumed Frax deep context',
  'Refresh Learning after Cognitive success',
  'Refresh Proposal Work Queue after Learning success',
  'Refresh Downstream Continuity after Proposal success',
  'Refresh Project Memory after downstream success',
  'Refresh Intelligence Progress after Project Memory success',
  "eco.coverage?.surfaceCount)!==9",
  "eco.coverage?.measuredSurfaceCount)!==1",
  "eco.coverage?.sourceBoundUnknownSurfaceCount)!==8",
  "eco.epistemic?.revenueToVeFraxAprCausality",
  "eco.epistemic?.treasuryYieldToSpecificFxPoolIncentive",
  "eco.authority?.executionAuthority!=='none'",
  "eco.authority?.causalClaimAuthority!=='none'"
])assert(recovery.includes(required),`Recovery workflow contract missing: ${required}`);

assert(!/contents:\s*write/.test(recovery),'Recovery controller must not write repository contents directly');
assert(!recovery.includes('gh workflow run unified-capital-refresh.yml --ref main'),'Recovery must not reintroduce redundant Unified Capital dispatch');

const ordered=[
  'Rebuild canonical Economic Graph first',
  'Prove physical eight-protocol Graph and Frax ecosystem',
  'Rebuild Explanatory only after Graph materialization',
  'Prove exact Graph to Explanatory Frax handoff',
  'Refresh canonical Cognitive Stack from proven Explanatory',
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
assert(!pushBlock.includes('intelligence/explanatory/vlcvx-votium-curve-shadow-context.mjs'),'Premature Explanatory extension push race reintroduced');
assert(explanatory.includes("'the-holding-explanatory-context-production'"),'Explanatory serialized production lane missing');
assert(explanatory.includes("cancel-in-progress: ${{ github.event_name == 'pull_request' }}"),'Explanatory PR/production cancellation partition drift');

for(const required of [
  recoveryPath,
  explanatoryPath,
  'Graph→Explanatory→Brain→Memory recovery order drift',
  'Serialized non-cancellable recovery lane missing'
])assert(liveVerifier.includes(required),`Live verifier is not bound to new recovery topology: ${required}`);

console.log('FRAX GRAPH→MEMORY WORKFLOW DEFINITION PROOF PASS',{
  recoveryPath,
  explanatoryPath,
  liveVerifierPath,
  graphModuleCoverage:'globbed',
  sourceRaceBlocked:true,
  recoveryOrder:'Graph→Explanatory→Brain→Learning→Proposal→Downstream→Memory→Progress',
  controllerContentsAuthority:'read-only',
  executionAuthority:'none'
});
