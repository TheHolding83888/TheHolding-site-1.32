#!/usr/bin/env node
import fs from 'node:fs';
import crypto from 'node:crypto';

const STATE='companies/yieldring-canonical-state.json';
const INDEX='companies/index.html';
const PAGE='yieldring/index.html';
const BALANCE='intelligence/capital-state/general-company-balance-sheet.mjs';
const state=JSON.parse(fs.readFileSync(STATE,'utf8'));
const fail=m=>{throw new Error(m);};
if(state.version!=='0.1-yieldring-canonical-state')fail('unexpected YieldRing state version');

const btc=state.capital.bitcoin;
const aero=state.capital.aerodrome;
if(Number(btc.quantity)!==0.0334||Number(btc.costBasisUsd)!==2121.88)fail('YieldRing BTC canonical contract drift');
if(Number(aero.quantity)!==678||Number(aero.costBasisUsd)!==274.464)fail('YieldRing AERO canonical contract drift');

function replaceOnce(text,oldText,newText,label){
  if(text.includes(newText))return text;
  const count=text.split(oldText).length-1;
  if(count!==1)fail(`${label}: expected exactly one old projection, found ${count}`);
  return text.replace(oldText,newText);
}
function gitBlobSha(text){
  const b=Buffer.from(text);
  return crypto.createHash('sha1').update(Buffer.from(`blob ${b.length}\0`)).update(b).digest('hex');
}

let html=fs.readFileSync(INDEX,'utf8');
const oldBook=`    'YieldRing.eth': [\n        { id: 'bitcoin',           qty: 0.03,  entry: 63442  },\n        { id: 'aerodrome-finance', qty: 480,   entry: 0.4068 },\n        { id: 'convex-finance',    qty: 240,   entry: 1.28   },\n        { id: 'frax-share',        qty: 800,   entry: 0.2628 }\n    ],`;
const newBook=`    'YieldRing.eth': [\n        { id: 'bitcoin', qty: 0.0334, entry: 63442, costBasisUsd: 2121.88, acquisition: 'mixed', acquisitionLots: [\n            { qty: 0.03, entry: 63442, costBasisUsd: 1903.26, evidenceStatus: 'established' },\n            { qty: 0.0034, entry: 64300, costBasisUsd: 218.62, evidenceStatus: 'owner-provided' }\n        ] },\n        { id: 'aerodrome-finance', qty: 678, entry: 0.4068, costBasisUsd: 274.464, acquisition: 'mixed', acquisitionLots: [\n            { qty: 480, entry: 0.4068, costBasisUsd: 195.264, evidenceStatus: 'established' },\n            { qty: 198, entry: 0.4, costBasisUsd: 79.2, evidenceStatus: 'owner-provided' }\n        ], relay: { mode: 'veAERO Maxi', managerId: '10298', managerAddress: '0xc9814f18a8751214f719de15c54d01b3d78ef14f', expectedUnderlyingLockCount: 2, evidenceStatus: 'owner-provided-not-yet-independently-reproduced' } },\n        { id: 'convex-finance', qty: 240, entry: 1.28 },\n        { id: 'frax-share', qty: 800, entry: 0.2628 }\n    ],`;
html=replaceOnce(html,oldBook,newBook,'companies/index.html YieldRing Company Book');
fs.writeFileSync(INDEX,html);
const indexBlob=gitBlobSha(html);

let page=fs.readFileSync(PAGE,'utf8');
page=replaceOnce(page,
`  var BTC = { id: 'bitcoin', name: 'Bitcoin', sub: 'Reserve · pledged as collateral', qty: 0.03 };`,
`  var BTC = { id: 'bitcoin', name: 'Bitcoin', sub: 'Reserve · pledged as collateral', qty: 0.0334 };`,
'YieldRing dedicated BTC');
page=replaceOnce(page,
`    { id: 'aerodrome-finance', name: 'veAERO', sub: 'Aero · locked', qty: 480 },`,
`    { id: 'aerodrome-finance', name: 'veAERO', sub: 'Aero · 2 locks · Maxi relay', qty: 678 },`,
'YieldRing dedicated veAERO');
if(!page.includes('veAERO Maxi')){
  page=replaceOnce(page,
`    <p class="note">The reserve is pledged on Llamalend, where roughly <b>$700 of liquidity</b> was drawn against it and committed to three long-term positions. The Bitcoin itself is never sold — a loan is serviced instead.</p>`,
`    <p class="note">The reserve is pledged on Llamalend, where roughly <b>$700 of liquidity</b> was drawn against it and committed to three long-term positions. The Bitcoin itself is never sold — a loan is serviced instead.</p>\n    <p class="note"><b>veAERO Maxi</b> · two managed veAERO locks are tracked as one Aerodrome productive position and one aggregated rewards line. Manager ID 10298 · 0xc981…14f.</p>`,
'YieldRing dedicated relay note');
}
fs.writeFileSync(PAGE,page);

let balance=fs.readFileSync(BALANCE,'utf8');
balance=replaceOnce(balance,
`    { id:'bitcoin', qty:0.03, layer:'foundation', priceSource:'coingecko' },\n    { id:'aerodrome-finance', qty:480, layer:'productive-dividend' },`,
`    { id:'bitcoin', qty:0.0334, layer:'foundation', priceSource:'coingecko' },\n    { id:'aerodrome-finance', qty:678, layer:'productive-dividend' },`,
'General Balance YieldRing quantities');
balance=balance.replace(/const EXPECTED_UI_BLOB_SHA = '[0-9a-f]{40}';/,`const EXPECTED_UI_BLOB_SHA = '${indexBlob}';`);
balance=replaceOnce(balance,
`if (productivity.version !== '1.15') throw new Error(\`unexpected Productivity version \${productivity.version}\`);`,
`if (!['1.15','1.16'].includes(productivity.version)) throw new Error(\`unexpected Productivity version \${productivity.version}\`);`,
'General Balance Productivity compatibility');
fs.writeFileSync(BALANCE,balance);

console.log('YieldRing public/capital projection PASS',{
  bitcoinQuantity:btc.quantity,
  bitcoinCostBasisUsd:btc.costBasisUsd,
  aeroQuantity:aero.quantity,
  aeroCostBasisUsd:aero.costBasisUsd,
  expectedIndexBlob:indexBlob,
  dedicatedPageProjected:true,
  relayMode:state.aerodromeRelay.mode,
  expectedUnderlyingLockCount:state.aerodromeRelay.expectedUnderlyingLockCount,
  executionAuthority:'none'
});
