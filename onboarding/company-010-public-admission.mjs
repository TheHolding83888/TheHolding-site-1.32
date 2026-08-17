#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const ROOT=process.cwd();
const pagePath=path.join(ROOT,'companies/index.html');
const mode=process.argv.includes('--write')?'write':'check';
let html=fs.readFileSync(pagePath,'utf8');
const original=html;

function count(needle){ return html.split(needle).length-1; }
function once(needle,label){ const n=count(needle); if(n!==1) throw new Error(`${label}: expected exactly one anchor, found ${n}`); }
function replaceOnce(from,to,label){ once(from,label); html=html.replace(from,to); }
function replaceSection(start,end,replacement,label){
  const a=html.indexOf(start), b=html.indexOf(end,a+start.length);
  if(a<0||b<0) throw new Error(`${label}: section anchors missing`);
  if(html.indexOf(start,a+1)>=0) throw new Error(`${label}: start anchor not unique`);
  html=html.slice(0,a)+replacement+'\n\n'+html.slice(b);
}

if(!html.includes('companies.html · v1.25.2')) throw new Error('Unexpected Companies page generation; fresh review required');
if(!html.includes('"numberOfItems": 10') || !html.includes('"position": 10, "name": "Cypher"')) throw new Error('Cypher Registry #010 admission missing');
if(!html.includes('data-company-010-public-adapter')) throw new Error('Cypher adapter loader missing');

const computeV02=`function computeIndex() {
    if (!INDEX_STATE) return [];
    const list = INDEX_STATE.slice();
    const eligible = list.filter(c => c.indexEligible !== false);
    const pending = list.filter(c => c.indexEligible === false);
    list.forEach(c => { c.score = {}; c.rel = {}; });
    IDX_FACTORS.forEach(f => {
        const raws = eligible.map(f.raw);
        const sum  = raws.reduce((s, v) => s + v, 0) || 1;
        eligible.forEach((c, i) => { c.score[f.key] = raws[i] / sum; });
        pending.forEach(c => { c.score[f.key] = 0; });
    });
    let maxShare = 1e-9;
    eligible.forEach(c => IDX_FACTORS.forEach(f => { maxShare = Math.max(maxShare, c.score[f.key]); }));
    const totalVal = eligible.reduce((s, c) => s + Math.max(c.val, 0), 0);
    eligible.forEach(c => {
        IDX_FACTORS.forEach(f => { c.rel[f.key] = c.score[f.key] / maxShare; });
        c.weight = IDX_FACTORS.reduce((s, f) => s + f.weight * c.score[f.key], 0);
        c.tvlWeight = totalVal > 0 ? Math.max(c.val, 0) / totalVal : (eligible.length ? 1 / eligible.length : 0);
    });
    pending.forEach(c => {
        IDX_FACTORS.forEach(f => { c.rel[f.key] = 0; });
        c.weight = 0;
        c.tvlWeight = 0;
        c.color = '#819064';
    });
    const byComposite = eligible.slice().sort((a, b) => (b.weight || 0) - (a.weight || 0));
    const NOBLE_GREENS = ['#183F34','#2C574B','#466956','#647653','#819064','#9AA57A','#AFB78C'];
    byComposite.forEach((c, i) => { c.color = NOBLE_GREENS[Math.min(i, NOBLE_GREENS.length - 1)]; });
    const key = IDX_MODE === 'tvl' ? 'tvlWeight' : 'weight';
    return eligible.sort((a,b)=>b[key]-a[key]).concat(pending);
}`;

if(!html.includes('const eligible = list.filter(c => c.indexEligible !== false);')) {
  replaceSection('function computeIndex() {','// Which weighting lens the index is currently displayed through',computeV02,'pending-aware computeIndex');
}

if(!html.includes('const eligibleList = list.filter(c => c.indexEligible !== false);')) {
  replaceOnce(
`    const list  = computeIndex();
    const total = list.reduce((s, c) => s + (c.val > 0 ? c.val : 0), 0);
    const pct   = c => activeWeight(c) * 100;`,
`    const list  = computeIndex();
    const eligibleList = list.filter(c => c.indexEligible !== false);
    const total = eligibleList.reduce((s, c) => s + (c.val > 0 ? c.val : 0), 0);
    const pct   = c => activeWeight(c) * 100;`,
  'renderIndex eligible header');
  replaceOnce('if (cn) cn.textContent = list.length;','if (cn) cn.textContent = eligibleList.length;','constituent count');
  replaceOnce("if (ld) ld.textContent = list[0] ? companyDisplayName(list[0].nm) : '—';","if (ld) ld.textContent = eligibleList[0] ? companyDisplayName(eligibleList[0].nm) : '—';",'index leader');
  replaceOnce("        list.forEach((c, i) => {\n            const seg = document.createElement('div');","        eligibleList.forEach((c, i) => {\n            const seg = document.createElement('div');",'composition bar eligibility');
  replaceOnce("        list.forEach((c, i) => {\n            const it = document.createElement('span');","        eligibleList.forEach((c, i) => {\n            const it = document.createElement('span');",'composition legend eligibility');
}

if(!html.includes("c.indexEligible === false ? '—' : (i + 1)")) {
  replaceOnce("'<span class=\"ib-rank\">' + (i + 1) + '</span>'","'<span class=\"ib-rank\">' + (c.indexEligible === false ? '—' : (i + 1)) + '</span>'",'pending rank');
  replaceOnce("'<span class=\"ib-value\">' + (c.val > 0 ? money(c.val) : 'Live') + '</span>'","'<span class=\"ib-value\">' + (c.val > 0 ? ((c.capitalFloor ? '≥ ' : '') + money(c.val)) : 'Live') + '</span>'",'capital floor row value');
  replaceOnce("'<span class=\"ibw-pct\">' + w.toFixed(1) + '%</span></span>'","'<span class=\"ibw-pct\">' + (c.indexEligible === false ? (lang === 'ru' ? 'Ожидание' : 'Pending') : w.toFixed(1) + '%') + '</span></span>'",'pending row weight');
  replaceOnce("econ(L.companyTVL, c.val > 0 ? money(c.val) : 'Live', 'gold')","econ(L.companyTVL, c.val > 0 ? ((c.capitalFloor ? '≥ ' : '') + money(c.val)) : 'Live', 'gold')",'passport capital floor');
  replaceOnce("wfld(L.weight, ((c.weight || 0) * 100).toFixed(1) + '%', IDX_MODE === 'composite')","wfld(L.weight, c.indexEligible === false ? (lang === 'ru' ? 'Ожидание' : 'Pending') : ((c.weight || 0) * 100).toFixed(1) + '%', c.indexEligible !== false && IDX_MODE === 'composite')",'passport pending composite weight');
  replaceOnce("wfld(L.tvlWeight, ((c.tvlWeight || 0) * 100).toFixed(1) + '%', IDX_MODE === 'tvl')","wfld(L.tvlWeight, c.indexEligible === false ? (lang === 'ru' ? 'Ожидание' : 'Pending') : ((c.tvlWeight || 0) * 100).toFixed(1) + '%', c.indexEligible !== false && IDX_MODE === 'tvl')",'passport pending tvl weight');
  replaceOnce("            item.className = 'ib-item';\n            item.dataset.nm = c.nm;","            item.className = 'ib-item';\n            item.dataset.nm = c.nm;\n            if (c.indexEligible === false) item.dataset.indexPending = 'true';",'pending item marker');
}

if(!html.includes('computeIndex().filter(c => c.indexEligible !== false).slice().sort')) {
  replaceOnce(
    "const comps = computeIndex().slice().sort((a, b) => (b.weight || 0) - (a.weight || 0));",
    "const comps = computeIndex().filter(c => c.indexEligible !== false).slice().sort((a, b) => (b.weight || 0) - (a.weight || 0));",
    'graph excludes pending companies'
  );
}

if(!html.includes('data-index-pending="true"')) {
  replaceOnce('</style>','        .ib-item[data-index-pending="true"] .ipx-composite{display:none}\n        .ib-item[data-index-pending="true"] .ibw-track{opacity:.28}\n    </style>','pending passport style');
}

const required=[
  'const eligible = list.filter(c => c.indexEligible !== false);',
  'const eligibleList = list.filter(c => c.indexEligible !== false);',
  "c.indexEligible === false ? '—' : (i + 1)",
  "c.indexEligible === false ? (lang === 'ru' ? 'Ожидание' : 'Pending')",
  "item.dataset.indexPending = 'true';",
  '.ib-item[data-index-pending="true"] .ipx-composite{display:none}',
  'computeIndex().filter(c => c.indexEligible !== false).slice().sort'
];
for(const x of required) if(!html.includes(x)) throw new Error('Missing native pending integration: '+x);

if(mode==='write'){
  if(html!==original) fs.writeFileSync(pagePath,html);
  console.log(JSON.stringify({status:'PASS',mode,changed:html!==original,page:'companies/index.html',ui:'native-general-passport',indexAdmission:'pending-unweighted'},null,2));
}else{
  const out=path.join(ROOT,'.tmp-company-010-public-admission.html');
  fs.writeFileSync(out,html);
  console.log(JSON.stringify({status:'PASS',mode,changed:html!==original,preview:out,ui:'native-general-passport',indexAdmission:'pending-unweighted'},null,2));
}
