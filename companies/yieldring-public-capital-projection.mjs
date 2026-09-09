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
const frax=state.capital.frax;
if(Number(btc.quantity)!==0.0334||Number(btc.costBasisUsd)!==2121.88)fail('YieldRing BTC canonical contract drift');
if(Number(aero.quantity)!==678||Number(aero.costBasisUsd)!==274.464)fail('YieldRing AERO canonical contract drift');
if(Number(frax?.quantity)!==1032||frax?.costBasisStatus!=='partial'||frax?.costBasisUsd!==null||Number(frax?.knownCostBasisUsd)!==210.24)fail('YieldRing FRAX canonical/UNKNOWN cost-basis contract drift');

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
const oldBook=`    'YieldRing.eth': [\n        { id: 'bitcoin', qty: 0.0334, entry: 63442, costBasisUsd: 2121.88, acquisition: 'mixed', acquisitionLots: [\n            { qty: 0.03, entry: 63442, costBasisUsd: 1903.26, evidenceStatus: 'established' },\n            { qty: 0.0034, entry: 64300, costBasisUsd: 218.62, evidenceStatus: 'owner-provided' }\n        ] },\n        { id: 'aerodrome-finance', qty: 678, entry: 0.4068, costBasisUsd: 274.464, acquisition: 'mixed', acquisitionLots: [\n            { qty: 480, entry: 0.4068, costBasisUsd: 195.264, evidenceStatus: 'established' },\n            { qty: 198, entry: 0.4, costBasisUsd: 79.2, evidenceStatus: 'owner-provided' }\n        ], relay: { mode: 'veAERO Maxi', managerId: '10298', managerAddress: '0xc9814f18a8751214f719de15c54d01b3d78ef14f', expectedUnderlyingLockCount: 2, evidenceStatus: 'owner-provided-not-yet-independently-reproduced' } },\n        { id: 'convex-finance', qty: 240, entry: 1.28 },\n        { id: 'frax-share', qty: 800, entry: 0.2628 }\n    ],`;
const newBook=`    'YieldRing.eth': [\n        { id: 'bitcoin', qty: 0.0334, entry: 63442, costBasisUsd: 2121.88, acquisition: 'mixed', acquisitionLots: [\n            { qty: 0.03, entry: 63442, costBasisUsd: 1903.26, evidenceStatus: 'established' },\n            { qty: 0.0034, entry: 64300, costBasisUsd: 218.62, evidenceStatus: 'owner-provided' }\n        ] },\n        { id: 'aerodrome-finance', qty: 678, entry: 0.4068, costBasisUsd: 274.464, acquisition: 'mixed', acquisitionLots: [\n            { qty: 480, entry: 0.4068, costBasisUsd: 195.264, evidenceStatus: 'established' },\n            { qty: 198, entry: 0.4, costBasisUsd: 79.2, evidenceStatus: 'owner-provided' }\n        ], relay: { mode: 'veAERO Maxi', managerId: '10298', managerAddress: '0xc9814f18a8751214f719de15c54d01b3d78ef14f', expectedUnderlyingLockCount: 2, evidenceStatus: 'owner-provided-not-yet-independently-reproduced' } },\n        { id: 'convex-finance', qty: 240, entry: 1.28 },\n        { id: 'frax-share', qty: 1032, entry: null, costBasisUsd: null, costBasisStatus: 'partial', knownCostBasisUsd: 210.24, acquisition: 'mixed', acquisitionLots: [\n            { qty: 800, entry: 0.2628, costBasisUsd: 210.24, evidenceStatus: 'established' },\n            { qty: 232, entry: null, costBasisUsd: null, evidenceStatus: 'owner-provided-current' }\n        ] }\n    ],`;
html=replaceOnce(html,oldBook,newBook,'companies/index.html YieldRing Company Book');

const oldBookFigures=`function bookFigures(nm, prices) {\n    const pos = COMPANY_BOOK[nm] || [];\n    let value = 0, cost = 0;\n    pos.forEach(p => {\n        if (p.productivityOnly) return;\n        const price = (p.fixed !== undefined) ? p.fixed : (prices[p.id] || 0);\n        value += p.qty * price;\n        const explicitCost = p.costBasisUsd !== null && p.costBasisUsd !== undefined && p.costBasisUsd !== ''\n            && Number.isFinite(Number(p.costBasisUsd)) ? Number(p.costBasisUsd) : null;\n        cost += explicitCost !== null ? explicitCost : p.qty * p.entry;\n    });\n    return { value: value, cost: cost, pnl: value - cost, pct: cost > 0 ? (value / cost - 1) * 100 : 0 };\n}\n\nconst fmtMoney  = v => '$' + Math.round(v).toLocaleString('en-US');\nconst fmtSigned = v => (v >= 0 ? '+' : '−') + '$' + Math.abs(Math.round(v)).toLocaleString('en-US');\nconst fmtPct    = v => (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(1) + '%';`;
const newBookFigures=`function bookFigures(nm, prices) {\n    const pos = COMPANY_BOOK[nm] || [];\n    let value = 0, knownCost = 0, costComplete = true;\n    pos.forEach(p => {\n        if (p.productivityOnly) return;\n        const price = (p.fixed !== undefined) ? p.fixed : (prices[p.id] || 0);\n        value += p.qty * price;\n        const explicitCost = p.costBasisUsd !== null && p.costBasisUsd !== undefined && p.costBasisUsd !== ''\n            && Number.isFinite(Number(p.costBasisUsd)) ? Number(p.costBasisUsd) : null;\n        const entry = p.entry !== null && p.entry !== undefined && p.entry !== '' && Number.isFinite(Number(p.entry))\n            ? Number(p.entry) : null;\n        if (explicitCost !== null) knownCost += explicitCost;\n        else if (entry !== null) knownCost += p.qty * entry;\n        else {\n            costComplete = false;\n            if (p.knownCostBasisUsd !== null && p.knownCostBasisUsd !== undefined && p.knownCostBasisUsd !== '' && Number.isFinite(Number(p.knownCostBasisUsd))) knownCost += Number(p.knownCostBasisUsd);\n        }\n    });\n    const cost = costComplete ? knownCost : null;\n    return { value: value, cost: cost, knownCostBasisUsd: knownCost, costBasisStatus: costComplete ? 'complete' : 'partial', pnl: costComplete ? value - knownCost : null, pct: costComplete && knownCost > 0 ? (value / knownCost - 1) * 100 : null };\n}\n\nconst finiteUiNumber = v => v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v));\nconst fmtMoney  = v => finiteUiNumber(v) ? '$' + Math.round(Number(v)).toLocaleString('en-US') : '—';\nconst fmtSigned = v => finiteUiNumber(v) ? (Number(v) >= 0 ? '+' : '−') + '$' + Math.abs(Math.round(Number(v))).toLocaleString('en-US') : '—';\nconst fmtPct    = v => finiteUiNumber(v) ? (Number(v) >= 0 ? '+' : '−') + Math.abs(Number(v)).toFixed(1) + '%' : '—';`;
html=replaceOnce(html,oldBookFigures,newBookFigures,'companies/index.html partial cost basis guard');
fs.writeFileSync(INDEX,html);
const indexBlob=gitBlobSha(html);

let page=fs.readFileSync(PAGE,'utf8');
page=replaceOnce(page,
`    { id: 'frax-share', name: 'veFRAX', sub: 'Frax · locked', qty: 800 }`,
`    { id: 'frax-share', name: 'veFRAX', sub: 'Frax · locked', qty: 1032 }`,
'YieldRing dedicated veFRAX');
fs.writeFileSync(PAGE,page);

let balance=fs.readFileSync(BALANCE,'utf8');
if(!balance.includes("const YIELD_RING_STATE = 'companies/yieldring-canonical-state.json';"))fail('General Balance no longer binds canonical YieldRing state');
balance=balance.replace(/const EXPECTED_UI_BLOB_SHA = '[0-9a-f]{40}';/,`const EXPECTED_UI_BLOB_SHA = '${indexBlob}';`);
fs.writeFileSync(BALANCE,balance);

console.log('YieldRing public/capital projection PASS',{
  bitcoinQuantity:btc.quantity,
  bitcoinCostBasisUsd:btc.costBasisUsd,
  aeroQuantity:aero.quantity,
  aeroCostBasisUsd:aero.costBasisUsd,
  fraxQuantity:frax.quantity,
  fraxCostBasisStatus:frax.costBasisStatus,
  fraxKnownCostBasisUsd:frax.knownCostBasisUsd,
  expectedIndexBlob:indexBlob,
  dedicatedPageProjected:true,
  partialCostBasisNullGuard:true,
  relayMode:state.aerodromeRelay.mode,
  expectedUnderlyingLockCount:state.aerodromeRelay.expectedUnderlyingLockCount,
  executionAuthority:'none'
});
