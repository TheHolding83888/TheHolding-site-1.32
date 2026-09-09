#!/usr/bin/env node
import fs from 'node:fs';
import crypto from 'node:crypto';

const COMPANY001_STATE='companies/company-001-owner-capital-snapshot.json';
const FUND_REGISTRY='intelligence/market-data/fund-capital-registry.json';
const INDEX='companies/index.html';
const COMPANY001_PAGE='05081966/index.html';
const SINGUL_PAGE='singul/index.html';
const BALANCE='intelligence/capital-state/general-company-balance-sheet.mjs';

const company001=JSON.parse(fs.readFileSync(COMPANY001_STATE,'utf8'));
const funds=JSON.parse(fs.readFileSync(FUND_REGISTRY,'utf8'));
const fail=m=>{throw new Error(m);};

const btc=(company001.positions||[]).find(x=>x.assetId==='bitcoin');
if(company001?.company!=='05081966.eth'||company001?.authority?.executionAuthority!=='none')fail('Company #001 owner snapshot authority drift');
if(Number(btc?.quantity)!==0.00126||Number(btc?.entryPriceUsd)!==77875||Number(btc?.costBasisUsd)!==98.1225)fail('Company #001 BTC owner snapshot drift');
const diem=(funds?.funds?.singul?.positions||[]).find(x=>x.assetId==='diem');
if(Number(diem?.quantity)!==0.07||diem?.pricing!=='fixed-total'||Number(diem?.fixedTotalValueUsd)!==150||diem?.evidenceStatus!=='owner-provided-current')fail('Singul DIEM owner snapshot drift');

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
const old001=`    '05081966.eth': [\n        { id: 'aerodrome-finance', qty: 202,   entry: 0.4954 },\n        { id: 'curve-dao-token',   qty: 480,   entry: 0.2126 },\n        { id: 'frax-share',        qty: 393,   entry: 0.2589 }\n    ],`;
const new001=`    '05081966.eth': [\n        { id: 'bitcoin', qty: 0.00126, entry: 77875, costBasisUsd: 98.1225, evidenceStatus: 'owner-provided-current', source: 'owner-confirmed-manual-current-snapshot' },\n        { id: 'aerodrome-finance', qty: 202,   entry: 0.4954 },\n        { id: 'curve-dao-token',   qty: 480,   entry: 0.2126 },\n        { id: 'frax-share',        qty: 393,   entry: 0.2589 }\n    ],`;
html=replaceOnce(html,old001,new001,'companies/index.html Company #001 Company Book');
html=replaceOnce(html,
`    '05081966.eth':  ['Curve','Aero','Frax'],`,
`    '05081966.eth':  ['Bitcoin','Curve','Aero','Frax'],`,
'companies/index.html Company #001 protocol/asset map');
html=replaceOnce(html,
`    // 05081966.eth: AERO 202 / FRAX 393 / CRV 480`,
`    // 05081966.eth: BTC 0.00126 / AERO 202 / FRAX 393 / CRV 480`,
'companies/index.html Company #001 balance comment');
fs.writeFileSync(INDEX,html);
const indexBlob=gitBlobSha(html);

let page001=fs.readFileSync(COMPANY001_PAGE,'utf8');
page001=replaceOnce(page001,
`  var HOLDINGS = [\n    { id: 'aerodrome-finance', name: 'Aero', proto: 'Aero Finance', qty: 202, word: 'tokens' },\n    { id: 'frax-share', name: 'FRAX', proto: 'Frax Finance', qty: 393, word: 'tokens' },\n    { id: 'curve-dao-token', name: 'CRV', proto: 'Curve Finance', qty: 480, word: 'tokens' }\n  ];`,
`  var HOLDINGS = [\n    { id: 'bitcoin', name: 'BTC', proto: 'Bitcoin reserve', qty: 0.00126, word: 'BTC' },\n    { id: 'aerodrome-finance', name: 'Aero', proto: 'Aero Finance', qty: 202, word: 'tokens' },\n    { id: 'frax-share', name: 'FRAX', proto: 'Frax Finance', qty: 393, word: 'tokens' },\n    { id: 'curve-dao-token', name: 'CRV', proto: 'Curve Finance', qty: 480, word: 'tokens' }\n  ];`,
'05081966 dedicated holdings');
page001=replaceOnce(page001,
`    <p class="lockNote" style="margin-top:14px;">All assets are committed to the <b>maximum 4-year lock</b> — this entitles the Company to a share of the protocols’ cash flows and protects the capital from impulsive decisions.</p>`,
`    <p class="lockNote" style="margin-top:14px;">Productive protocol positions are committed to the <b>maximum 4-year lock</b> where the protocol supports it. BTC is held as reserve capital and is not presented as a locked cash-flow position.</p>`,
'05081966 dedicated lock semantics');
fs.writeFileSync(COMPANY001_PAGE,page001);

let singul=fs.readFileSync(SINGUL_PAGE,'utf8');
singul=replaceOnce(singul,
`            diem: 0.07                    // DIEM - fixed $86 (not on CoinGecko)`,
`            diem: 0.07                    // DIEM - owner-confirmed $150 current valuation snapshot`,
'Singul DIEM holdings comment');
singul=replaceOnce(singul,
`        const FIXED_DIEM_VALUE = 86;      // Fixed $86 total value for DIEM (0.07 tokens)`,
`        const FIXED_DIEM_VALUE = 150;     // Owner-confirmed current valuation snapshot for 0.07 DIEM`,
'Singul DIEM fixed value');
singul=replaceOnce(singul,
`                    // 'diem' - not on CoinGecko, using fixed $86 value instead`,
`                    // 'diem' - no validated dynamic route; using owner-confirmed $150 snapshot`,
'Singul DIEM price-route comment');
singul=replaceOnce(singul,
`                const diemValue = FIXED_DIEM_VALUE;  // Fixed $86 for 0.07 DIEM (not on CoinGecko)`,
`                const diemValue = FIXED_DIEM_VALUE;  // Owner-confirmed current snapshot; not an onchain-observed market price`,
'Singul DIEM valuation comment');
fs.writeFileSync(SINGUL_PAGE,singul);

let balance=fs.readFileSync(BALANCE,'utf8');
if(!balance.includes("const COMPANY001_OWNER_SNAPSHOT = 'companies/company-001-owner-capital-snapshot.json';"))fail('General Balance no longer binds Company #001 owner snapshot');
balance=balance.replace(/const EXPECTED_UI_BLOB_SHA = '[0-9a-f]{40}';/,`const EXPECTED_UI_BLOB_SHA = '${indexBlob}';`);
fs.writeFileSync(BALANCE,balance);

console.log('Owner balance site projection PASS',{
  company001BtcQuantity:btc.quantity,
  company001BtcEntryPriceUsd:btc.entryPriceUsd,
  company001BtcCostBasisUsd:btc.costBasisUsd,
  singulDiemQuantity:diem.quantity,
  singulDiemFixedTotalValueUsd:diem.fixedTotalValueUsd,
  expectedIndexBlob:indexBlob,
  manualSnapshotIsNotOnchainObservation:true,
  executionAuthority:'none'
});
