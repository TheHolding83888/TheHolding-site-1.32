#!/usr/bin/env node
import fs from 'node:fs';
import crypto from 'node:crypto';

const COMPANY001_STATE='companies/company-001-owner-capital-snapshot.json';
const FUND_REGISTRY='intelligence/market-data/fund-capital-registry.json';
const INDEX='companies/index.html';
const COMPANY001_PAGE='05081966/index.html';
const BALANCE='intelligence/capital-state/general-company-balance-sheet.mjs';

const company001=JSON.parse(fs.readFileSync(COMPANY001_STATE,'utf8'));
const funds=JSON.parse(fs.readFileSync(FUND_REGISTRY,'utf8'));
const fail=m=>{throw new Error(m);};

const btc=(company001.positions||[]).find(x=>x.assetId==='bitcoin');
if(company001?.company!=='05081966.eth'||company001?.authority?.executionAuthority!=='none')fail('Company #001 owner snapshot authority drift');
if(Number(btc?.quantity)!==0.00126||Number(btc?.entryPriceUsd)!==77875||Number(btc?.costBasisUsd)!==98.1225)fail('Company #001 BTC owner snapshot drift');
const singulPositions=funds?.funds?.singul?.positions||[];
const diem=singulPositions.find(x=>x.assetId==='diem');
if(Number(diem?.quantity)!==0.07||diem?.pricing!=='fixed-total'||Number(diem?.fixedTotalValueUsd)!==150||diem?.evidenceStatus!=='owner-provided-current')fail('Singul DIEM owner snapshot drift');
if(singulPositions.some(x=>x.assetId==='beam-2'))fail('Singul BEAM must not remain in current canonical holdings');
const expectedSingul=new Map([
  ['decentraland',486],['the-sandbox',853],['ovr',838],['autonolas',1180],
  ['virtual-protocol',669],['mode',1000000],['elizaos',80808],['diem',0.07]
]);
for(const [id,qty] of expectedSingul){
  const row=singulPositions.find(x=>x.assetId===id);
  if(!row||Number(row.quantity)!==qty)fail(`Singul canonical quantity drift for ${id}`);
}

function replaceOnce(text,oldText,newText,label){
  if(text.includes(newText))return text;
  const count=text.split(oldText).length-1;
  if(count!==1)fail(`${label}: expected exactly one old projection, found ${count}`);
  return text.replace(oldText,() => newText);
}
function replaceExactCount(text,oldText,newText,label,expectedCount){
  const oldCount=text.split(oldText).length-1;
  const newCount=text.split(newText).length-1;
  if(oldCount===0 && newCount===expectedCount)return text;
  if(oldCount!==expectedCount||newCount!==0)fail(`${label}: expected ${expectedCount} old and 0 new projections, found old=${oldCount} new=${newCount}`);
  return text.split(oldText).join(newText);
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

/* The clean public page contains two legacy boot paths. Keep their capital
   semantics aligned without manufacturing a third copy. Use small common
   fragments instead of one brittle whole-block replacement so both paths are
   updated deterministically while preserving UNKNOWN != 0. */
const oldPublicReader=`    const publicCompanyTvl = (key, fallback) => {
        const row = publicCapitalSnapshot && Array.isArray(publicCapitalSnapshot.companies)
            ? publicCapitalSnapshot.companies.find(x => x && (x.registry === key || x.name === key))
            : null;
        const value = Number(row && row.tvlUsd);
        return Number.isFinite(value) && value >= 0 ? value : fallback;
    };`;
const newPublicReader=`    const publicCompanyRow = key => publicCapitalSnapshot && Array.isArray(publicCapitalSnapshot.companies)
        ? publicCapitalSnapshot.companies.find(x => x && (x.registry === key || x.name === key)) || null
        : null;
    const publicCompanyTvl = (key, fallback) => {
        const row = publicCompanyRow(key);
        const value = row && row.tvlUsd !== null && row.tvlUsd !== undefined && row.tvlUsd !== '' ? Number(row.tvlUsd) : NaN;
        return Number.isFinite(value) && value >= 0 ? value : fallback;
    };
    const publicCompanyNetworkContribution = (key, fallback) => {
        const row = publicCompanyRow(key);
        const value = row && row.networkContributionUsd !== null && row.networkContributionUsd !== undefined && row.networkContributionUsd !== ''
            ? Number(row.networkContributionUsd) : NaN;
        return Number.isFinite(value) && value >= 0 ? value : fallback;
    };`;
html=replaceExactCount(html,oldPublicReader,newPublicReader,'companies/index.html canonical public-capital reader',2);

const oldPublicValueLoop=`    [[F1,tvl1],[F2,tvl2],[F3,tvl3],[F4,tvl4],[F5,tvl5],[F6,tvl6],[F7,tvl7],[F9,tvl9]].forEach(([f,v]) => {
        f.value = v;
        f.pnl = Number.isFinite(Number(f.cost)) ? v - Number(f.cost) : 0;
        f.pct = Number(f.cost) > 0 ? (v / Number(f.cost) - 1) * 100 : 0;
    });`;
const newPublicValueLoop=`    [[F1,tvl1,'001'],[F2,tvl2,'002'],[F3,tvl3,'003'],[F4,tvl4,'004'],[F5,tvl5,'005'],[F6,tvl6,'006'],[F7,tvl7,'007'],[F9,tvl9,'009']].forEach(([f,v,key]) => {
        const row = publicCompanyRow(key);
        const consolidatedWithoutBasis = key === '004' && row?.performanceBasisStatus === 'consolidated-current-value-without-automatic-consolidated-cost-basis';
        const hasCost = !consolidatedWithoutBasis && f.cost !== null && f.cost !== undefined && f.cost !== '' && Number.isFinite(Number(f.cost)) && Number(f.cost) > 0;
        f.value = v;
        f.indexCapitalValue = publicCompanyNetworkContribution(key, v);
        if (hasCost) {
            f.pnl = v - Number(f.cost);
            f.pct = (v / Number(f.cost) - 1) * 100;
        } else {
            f.cost = null;
            f.pnl = null;
            f.pct = null;
        }
    });`;
html=replaceExactCount(html,oldPublicValueLoop,newPublicValueLoop,'companies/index.html canonical TVL/performance/network contribution loop',2);

html=replaceExactCount(html,
`    { key: 'capital',      weight: 0.35, raw: c => Math.sqrt(Math.max(c.val, 0)) },`,
`    { key: 'capital',      weight: 0.35, raw: c => Math.sqrt(Math.max(c.indexCapitalValue ?? c.val, 0)) },`,
'companies/index.html Composite unique Capital factor',2);
html=replaceExactCount(html,
`    const totalVal = eligible.reduce((s, c) => s + Math.max(c.val, 0), 0);`,
`    const totalVal = eligible.reduce((s, c) => s + Math.max(c.indexCapitalValue ?? c.val, 0), 0);`,
'companies/index.html TVL lens unique denominator',2);
html=replaceExactCount(html,
`        c.tvlWeight = totalVal > 0 ? Math.max(c.val, 0) / totalVal : (eligible.length ? 1 / eligible.length : 0);`,
`        c.tvlWeight = totalVal > 0 ? Math.max(c.indexCapitalValue ?? c.val, 0) / totalVal : (eligible.length ? 1 / eligible.length : 0);`,
'companies/index.html TVL lens unique company weight',2);
html=replaceExactCount(html,
`    const measuredTotal = list.reduce((s, c) => s + (c.val > 0 ? c.val : 0), 0);`,
`    const measuredTotal = list.reduce((s, c) => s + ((c.indexCapitalValue ?? c.val) > 0 ? (c.indexCapitalValue ?? c.val) : 0), 0);`,
'companies/index.html Index unique network value',2);

html=replaceExactCount(html,
`    ];
    syncCompanyAprDisplays(idxLang());`,
`    ];
    INDEX_STATE.forEach(c => {
        const fallback = Number.isFinite(Number(c.val)) ? Number(c.val) : 0;
        c.indexCapitalValue = publicCompanyNetworkContribution(c.reg, fallback);
    });
    syncCompanyAprDisplays(idxLang());`,
'companies/index.html Index unique network-contribution binding',2);

fs.writeFileSync(INDEX,html);
const indexBlob=gitBlobSha(html);

let page001=fs.readFileSync(COMPANY001_PAGE,'utf8');
page001=replaceOnce(page001,
`  var HOLDINGS = [
    { id: 'aerodrome-finance', name: 'Aero', proto: 'Aero Finance', qty: 202, word: 'tokens' },
    { id: 'frax-share', name: 'FRAX', proto: 'Frax Finance', qty: 393, word: 'tokens' },
    { id: 'curve-dao-token', name: 'CRV', proto: 'Curve Finance', qty: 480, word: 'tokens' }
  ];`,
`  var HOLDINGS = [
    { id: 'bitcoin', name: 'BTC', proto: 'Bitcoin reserve', qty: 0.00126, word: 'BTC' },
    { id: 'aerodrome-finance', name: 'Aero', proto: 'Aero Finance', qty: 202, word: 'tokens' },
    { id: 'frax-share', name: 'FRAX', proto: 'Frax Finance', qty: 393, word: 'tokens' },
    { id: 'curve-dao-token', name: 'CRV', proto: 'Curve Finance', qty: 480, word: 'tokens' }
  ];`,
'05081966 dedicated holdings');
page001=replaceOnce(page001,
`    <p class="lockNote" style="margin-top:14px;">All assets are committed to the <b>maximum 4-year lock</b> — this entitles the Company to a share of the protocols’ cash flows and protects the capital from impulsive decisions.</p>`,
`    <p class="lockNote" style="margin-top:14px;">Productive protocol positions are committed to the <b>maximum 4-year lock</b> where the protocol supports it. BTC is held as reserve capital and is not presented as a locked cash-flow position.</p>`,
'05081966 dedicated lock semantics');
fs.writeFileSync(COMPANY001_PAGE,page001);

let balance=fs.readFileSync(BALANCE,'utf8');
if(!balance.includes("const COMPANY001_OWNER_SNAPSHOT = 'companies/company-001-owner-capital-snapshot.json';"))fail('General Balance no longer binds Company #001 owner snapshot');
balance=balance.replace(/const EXPECTED_UI_BLOB_SHA = '[0-9a-f]{40}';/,`const EXPECTED_UI_BLOB_SHA = '${indexBlob}';`);
fs.writeFileSync(BALANCE,balance);

// Retire old page-local price engines only after the current owner/state
// projections have been applied. The runtime projection is idempotent, so
// future coherent refreshes remain stable after the generated pages are saved.
await import('./public-page-market-runtime-projection.mjs');
// Apply bounded public-site navigation/footer/pyramid polish through a separate
// deterministic projector. This has no capital, methodology or execution authority.
await import('./public-site-polish-projection.mjs');

console.log('Owner balance site projection PASS',{
  company001BtcQuantity:btc.quantity,
  company001BtcEntryPriceUsd:btc.entryPriceUsd,
  company001BtcCostBasisUsd:btc.costBasisUsd,
  singulDiemQuantity:diem.quantity,
  singulDiemFixedTotalValueUsd:diem.fixedTotalValueUsd,
  singulCurrentPositionCount:singulPositions.length,
  singulBeamExcluded:true,
  expectedIndexBlob:indexBlob,
  cleanBootPathsUpdated:2,
  defiteaConsolidatedDisplayUsesUniqueIndexContribution:true,
  partialCostBasisPerformanceRemainsUnknown:true,
  manualSnapshotIsNotOnchainObservation:true,
  publicSitePolishProjected:true,
  executionAuthority:'none'
});