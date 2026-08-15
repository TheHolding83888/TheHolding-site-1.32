import fs from 'node:fs';

const p='.github/workflows/ask-experience.yml';
let s=fs.readFileSync(p,'utf8');
const coreAnchor=`      - name: Annotated core regression
        if: env.RUN_MODE == 'core' || env.RUN_MODE == 'all'`;
if((s.split(coreAnchor).length-1)!==1) throw new Error('core anchor mismatch');
const semanticStep=`      - name: Frozen semantic substitution boundary
        if: env.RUN_MODE == 'core' || env.RUN_MODE == 'all'
        env:
          ASK_BASE_URL: http://127.0.0.1:8080/agents/
          ASK_EXPERIENCE_RUN_ID: \${{ github.run_id }}-semantic-safety
          ASK_EXPERIENCE_ORIGIN: synthetic-semantic-safety
        shell: bash
        run: |
          set -euo pipefail
          node verification/ask-experience/runner-v0.1.mjs verification/ask-experience/corpus-semantic-safety-v0.1.json artifacts/ask-experience-semantic-safety.json
          set +e
          node verification/ask-experience/evaluator-v0.1.mjs verification/ask-experience/corpus-semantic-safety-v0.1.json artifacts/ask-experience-semantic-safety.json > artifacts/ask-experience-semantic-safety-evaluation.json
          rc=$?
          set -e
          node verification/ask-experience/summarize-learning-needs-v0.1.mjs artifacts/ask-experience-semantic-safety-evaluation.json > artifacts/ask-experience-semantic-safety-learning-needs.json
          exit "$rc"

`;
s=s.replace(coreAnchor,semanticStep+coreAnchor);
const gateAnchor="          if(mode==='core'||mode==='all') names.push('core');";
if((s.split(gateAnchor).length-1)!==1) throw new Error('gate anchor mismatch');
s=s.replace(gateAnchor,"          if(mode==='core'||mode==='all') { names.push('semantic-safety'); names.push('core'); }");
fs.writeFileSync(p,s);

const transient='.github/workflows/_ask_semantic_safety_candidate.yml';
if(fs.existsSync(transient)) fs.rmSync(transient);
console.log(JSON.stringify({semanticGateIntegrated:true,prCoreGate:true,parallelCandidateWorkflowRemoved:true},null,2));
