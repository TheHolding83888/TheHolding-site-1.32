#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const ROOT=process.cwd();
const pagePath=path.join(ROOT,'companies/index.html');
const mode=process.argv.includes('--write')?'write':'check';
let html=fs.readFileSync(pagePath,'utf8');
const original=html;

function once(needle,label){
  const n=html.split(needle).length-1;
  if(n!==1) throw new Error(`${label}: expected exactly one anchor, found ${n}`);
}
function replaceOnce(from,to,label){ once(from,label); html=html.replace(from,to); }

if(!html.includes('companies.html · v1.25.2')) throw new Error('Unexpected Companies page generation; fresh review required');

if(!html.includes('"numberOfItems": 10')){
  replaceOnce('"numberOfItems": 9','"numberOfItems": 10','JSON-LD registry count');
  replaceOnce(
    '{ "@type": "ListItem", "position": 9, "name": "1milliondollar.eth" }',
    '{ "@type": "ListItem", "position": 9, "name": "1milliondollar.eth" },\n        { "@type": "ListItem", "position": 10, "name": "Cypher", "url": "https://theholding.ai/companies/#cypher" }',
    'JSON-LD company #009 tail'
  );
}

if(!html.includes('id="companyCount">10')){
  replaceOnce('id="companyCount">9','id="companyCount">10','collection count');
}

if(!html.includes("'Cypher': ['Bitcoin'")){
  replaceOnce(
    "    '1milliondollar.eth': ['Bitcoin','Ethereum','Aave','Morpho','Lombard','Aero','Beefy','Convex','Curve','Yield Basis']\n};",
    "    '1milliondollar.eth': ['Bitcoin','Ethereum','Aave','Morpho','Lombard','Aero','Beefy','Convex','Curve','Yield Basis'],\n    'Cypher': ['Bitcoin','Ethereum','Project X','Convex','Curve','Aero','Velodrome','GMX','Concentrator','Fluid']\n};",
    'protocol registry tail'
  );
}

const loader='<script src="/companies/company-010-public-adapter.js" defer data-company-010-public-adapter></script>';
if(!html.includes(loader)) replaceOnce('\n</body>',`\n${loader}\n</body>`,'body close');

const checks=[
  ['companies.html · v1.25.2','page generation'],
  ['"numberOfItems": 10','JSON-LD count'],
  ['"position": 10, "name": "Cypher"','JSON-LD Cypher'],
  ['id="companyCount">10','collection count'],
  ["'Cypher': ['Bitcoin'",'protocol registry'],
  [loader,'public adapter loader']
];
for(const [needle,label] of checks){ if(!html.includes(needle)) throw new Error(`Missing ${label}`); }
if((html.split(loader).length-1)!==1) throw new Error('Cypher public adapter loader must appear exactly once');
if(/reg:'010'/.test(html)) throw new Error('Cypher must not enter weighted INDEX_STATE while total capital is incomplete');

if(mode==='write'){
  if(html!==original) fs.writeFileSync(pagePath,html);
  console.log(JSON.stringify({status:'PASS',mode,changed:html!==original,page:'companies/index.html',registryCount:10,indexAdmission:'pending-unweighted'},null,2));
}else{
  const out=path.join(ROOT,'.tmp-company-010-public-admission.html');
  fs.writeFileSync(out,html);
  console.log(JSON.stringify({status:'PASS',mode,changed:html!==original,preview:out,registryCount:10,indexAdmission:'pending-unweighted'},null,2));
}
