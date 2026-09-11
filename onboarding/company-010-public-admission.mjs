#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const ROOT=process.cwd();
const pagePath=path.join(ROOT,'companies/index.html');
const previewPath=path.join(ROOT,'.tmp-company-010-public-admission.html');
const html=fs.readFileSync(pagePath,'utf8');

// Historical Company #010 admission is complete. This entrypoint is retained as
// a deterministic read-only validator for the already-admitted native surface.
// Production publication belongs to the canonical Companies writer.
if(process.argv.includes('--write')){
  throw new Error('Company #010 public admission writer is retired; canonical Companies publication is owned elsewhere.');
}

const requireText=(text,label)=>{
  if(!html.includes(text))throw new Error(`${label} missing from canonical Companies surface`);
};

requireText('"numberOfItems": 10','10-company structured-data count');
requireText('"position": 10, "name": "Cypher"','Cypher structured-data registry position');
requireText('id="companyCount">10','10-company visible count');
requireText('/companies/company-010-public-adapter.js','Cypher public adapter loader');
requireText('const eligible = list.filter(c => c.indexEligible !== false);','pending-aware index eligibility');
requireText('const measuredTotal = list.reduce','measured network-capital floor');
requireText('if (cn) cn.textContent = list.length;','presence count independent from weighting');
requireText("seg.className = 'index-comp-seg' + (c.indexEligible === false ? ' pending' : '');",'pending composition marker');
requireText("const rCo = c => c.indexEligible === false ? P.rCoMin",'pending graph-presence radius');
requireText('const comps = computeIndex().slice().sort','graph includes pending company presence');
requireText("c.performancePending ? (lang === 'ru' ? 'Ожидается' : 'Pending')",'explicit pending performance state');

const loaderCount=(html.match(/data-company-010-public-adapter/g)||[]).length;
if(loaderCount!==1)throw new Error(`Cypher adapter loader multiplicity drift: expected 1, got ${loaderCount}`);

// Keep the temporary preview contract for existing verification workflows, but
// the preview is now an exact copy of the canonical page: no patching, no hidden
// materialization and no repository mutation.
fs.writeFileSync(previewPath,html);

console.log(JSON.stringify({
  status:'PASS',
  mode:'read-only-validator',
  changed:false,
  preview:previewPath,
  canonicalPage:'companies/index.html',
  historicalAdmissionComplete:true,
  repositoryMutation:false,
  canonicalWriter:'The Holding Capital · Unified Refresh',
  surfacePresence:'all-general-companies',
  weighting:'eligible-only',
  graphPendingPresence:true,
  pendingPerformanceExplicit:true,
  executionAuthority:'none'
},null,2));
