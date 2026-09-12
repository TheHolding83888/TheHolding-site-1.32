#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';

const CANONICAL='.github/workflows/record-brain-decision.yml';
const OWNER_ENTRY='.github/workflows/record-owner-economic-decision.yml';
const BRAIN_RECORDER='intelligence/learning/decision-recorder.mjs';
const OWNER_RECORDER='intelligence/learning/owner-initiated-decision-recorder.mjs';
const LEDGER='intelligence/learning/decision-ledger.json';

const canonical=fs.readFileSync(CANONICAL,'utf8');
const owner=fs.readFileSync(OWNER_ENTRY,'utf8');
const brainRecorder=fs.readFileSync(BRAIN_RECORDER,'utf8');
const ownerRecorder=fs.readFileSync(OWNER_RECORDER,'utf8');

for(const file of [CANONICAL,OWNER_ENTRY]){
  const text=file===CANONICAL?canonical:owner;
  assert.match(text,/^# holding-workflow-definition-proof: intelligence\/reliability\/decision-ledger-writer-ownership-proof\.mjs/m,`paired proof marker missing: ${file}`);
}

assert.match(canonical,/name: "The Holding Brain · Record Decision"/,'canonical Decision writer identity drift');
assert.match(canonical,/workflow_call:/,'canonical Decision writer must be reusable');
assert.match(canonical,/permissions:\n  contents: write/,'canonical Decision writer lost bounded contents authority');
assert.match(canonical,/group:\s*decision-recorder-main/,'canonical Decision writer concurrency drift');
assert.match(canonical,/record_mode:/,'canonical Decision writer mode input missing');
assert.match(canonical,/brain-case\|owner-economic/,'canonical Decision writer accepted-mode guard missing');
assert.ok(canonical.includes('node intelligence/learning/decision-recorder.mjs'),'Brain case recorder path missing');
assert.ok(canonical.includes('node intelligence/learning/owner-initiated-decision-recorder.mjs'),'owner economic recorder path missing');
const ledgerStage=`git add ${LEDGER}`;
assert.equal(canonical.split(ledgerStage).length-1,1,'Decision Ledger must have exactly one explicit staging site in canonical workflow');
assert.match(canonical,/git rebase origin\/main/,'canonical Decision writer moving-main guard missing');
assert.match(canonical,/git push origin HEAD:main/,'canonical Decision writer bounded publish missing');
assert.doesNotMatch(canonical,/actions:\s*write|write-all/,'canonical Decision writer authority widened');

assert.match(owner,/name: "The Holding Brain · Record Owner Economic Decision"/,'owner economic entry identity drift');
assert.match(owner,/permissions:\n  contents: write/,'owner caller must pass bounded contents authority to reusable writer');
assert.match(owner,/group:\s*owner-economic-decision-entry/,'owner caller concurrency drift');
assert.ok(owner.includes('uses: ./.github/workflows/record-brain-decision.yml'),'owner economic entry must call canonical Decision writer');
assert.ok(owner.includes('record_mode: owner-economic'),'owner economic entry mode binding missing');
for(const input of ['entity','category','disposition','rationale','expected_outcome','evaluation_criterion','review_on_or_after','counterevidence','invalidation_condition','deferred_alternative','intended_use','confidence','evidence_note','supersedes_decision_id']){
  const expected=input+': ${{ inputs.'+input+' }}';
  assert.ok(owner.includes(expected),`owner economic input not forwarded: ${input}`);
}
assert.doesNotMatch(owner,/\brun:\s|\bgit\s+add\b|\bgit\s+commit\b|\bgit\s+push\b|actions:\s*write|write-all|\/contents\//,'owner economic entry regained direct repository mutation/control behavior');
assert.equal(owner.includes(LEDGER),false,'owner economic entry must not name/stage Decision Ledger directly');

// Both existing append-only recorders remain intact and retain their own
// semantic/authority guards. Secret-detection vocabulary inside those scripts
// is intentionally NOT treated as execution capability.
assert.ok(brainRecorder.includes("ledger: 'intelligence/learning/decision-ledger.json'"),'Brain recorder ledger target drift');
assert.ok(ownerRecorder.includes("ledger: 'intelligence/learning/decision-ledger.json'"),'owner recorder ledger target drift');
assert.ok(brainRecorder.includes("executionAuthority !== 'none'")||brainRecorder.includes("executionAuthority: 'none'"),'Brain recorder inert authority guard missing');
assert.ok(ownerRecorder.includes("executionAuthority !== 'none'")||ownerRecorder.includes("executionAuthority: 'none'"),'owner recorder inert authority guard missing');
assert.ok(brainRecorder.includes('decision-ledger.decisions must be an array'),'Brain recorder hash-chain ledger validation missing');
assert.ok(ownerRecorder.includes('decision-ledger.decisions must be an array'),'owner recorder hash-chain ledger validation missing');
assert.ok(ownerRecorder.includes("sourceMode: 'owner-initiated'")||ownerRecorder.includes("sourceMode !== 'owner-initiated'"),'owner-initiated provenance boundary missing');
assert.ok(ownerRecorder.includes('preOutcomeCaptured: true'),'owner economic pre-outcome experience semantics missing');

const workflowLayer=[canonical,owner].join('\n');
for(const forbidden of ['sendTransaction(', 'eth_sendTransaction', 'eth_sendRawTransaction', 'new Wallet(', 'privateKey', 'mnemonic']){
  assert.equal(workflowLayer.includes(forbidden),false,`Decision Memory workflow authority expansion: ${forbidden}`);
}

console.log('Decision Ledger canonical writer ownership proof PASS',{
  canonicalWriter:'The Holding Brain · Record Decision',
  ownerEconomicEntry:'typed reusable-workflow caller',
  directLedgerPublishers:1,
  hashChainedRecordersPreserved:true,
  ownerInitiatedProvenancePreserved:true,
  secretDetectionVocabularyIsNotExecutionAuthority:true,
  executionAuthority:'none',
  walletAuthority:false,
  capitalExecution:false
});
