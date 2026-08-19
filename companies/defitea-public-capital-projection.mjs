#!/usr/bin/env node
import fs from 'node:fs';

const STATE='companies/defitea-canonical-state.json';
const INDEX='companies/index.html';
const BALANCE='intelligence/capital-state/general-company-balance-sheet.mjs';
const s=JSON.parse(fs.readFileSync(STATE,'utf8'));
const fail=m=>{throw new Error(m);};
if(s.version!=='0.1-defitea-canonical-state')fail('unexpected Defitea state version');
const byId=new Map(s.productivePositions.map(x=>[x.assetId,x]));
if(Number(byId.get('aerodrome-finance')?.quantity)!==2632||Number(byId.get('fxn-token')?.quantity)!==64.81)fail('Defitea canonical delta drift');
if(s.productivePositions.length!==11)fail('Defitea expected 11 productive positions');
if(s.costBasis?.aerodrome?.status!=='complete'||Number(s.costBasis.aerodrome.costBasisUsd)!==1121.3)fail('Defitea AERO basis incomplete');
if(s.costBasis?.fxn?.status!=='complete'||Number(s.costBasis.fxn.costBasisUsd)!==983.2386)fail('Defitea FXN basis incomplete');
if(s.authority?.executionAuthority!=='none')fail('Defitea authority drift');

function replaceOnce(text,oldText,newText,label){
  if(text.includes(newText))return text;
  const n=text.split(oldText).length-1;
  if(n!==1)fail(`${label}: expected one old projection, found ${n}`);
  return text.replace(oldText,newText);
}

let html=fs.readFileSync(INDEX,'utf8');
html=replaceOnce(html,
"        { id: 'aerodrome-finance', qty: 2440,  entry: 0.4265 },",
"        { id: 'aerodrome-finance', qty: 2632, entry: 0.4265, costBasisUsd: 1121.3, acquisition: 'mixed', acquisitionLots: [\n            { qty: 2440, entry: 0.4265, costBasisUsd: 1040.66, evidenceStatus: 'established' },\n            { qty: 192, entry: 0.42, costBasisUsd: 80.64, evidenceStatus: 'owner-provided' }\n        ] },",
'Defitea AERO Company Book');
html=replaceOnce(html,
"        { id: 'fxn-token',         qty: 59.81, entry: 15.06 },",
"        { id: 'fxn-token', qty: 64.81, entry: 15.06, costBasisUsd: 983.2386, acquisition: 'mixed', acquisitionLots: [\n            { qty: 59.81, entry: 15.06, costBasisUsd: 900.7386, evidenceStatus: 'established' },\n            { qty: 5, entry: 16.5, costBasisUsd: 82.5, evidenceStatus: 'owner-provided' }\n        ] },",
'Defitea FXN Company Book');
fs.writeFileSync(INDEX,html);

let bal=fs.readFileSync(BALANCE,'utf8');
bal=replaceOnce(bal,
"    { id:'aerodrome-finance', qty:2440, layer:'productive-dividend' },",
"    { id:'aerodrome-finance', qty:2632, layer:'productive-dividend' },",
'Defitea AERO General Balance');
bal=replaceOnce(bal,
"    { id:'fxn-token', qty:59.81, layer:'productive-dividend' },",
"    { id:'fxn-token', qty:64.81, layer:'productive-dividend' },",
'Defitea FXN General Balance');
fs.writeFileSync(BALANCE,bal);

if(!html.includes('costBasisUsd: 1121.3')||!html.includes('qty: 192, entry: 0.42'))fail('Defitea AERO lot projection missing');
if(!html.includes('costBasisUsd: 983.2386')||!html.includes('qty: 5, entry: 16.5'))fail('Defitea FXN lot projection missing');
console.log('Defitea canonical projection PASS',{
  positions:s.productivePositions.length,
  aero:byId.get('aerodrome-finance').quantity,
  aeroCostBasisUsd:s.costBasis.aerodrome.costBasisUsd,
  fxn:byId.get('fxn-token').quantity,
  fxnCostBasisUsd:s.costBasis.fxn.costBasisUsd,
  performance:'complete-lot-aware-cost-basis',
  executionAuthority:'none'
});
