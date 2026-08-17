#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const ROOT=process.cwd();
const pagePath=path.join(ROOT,'companies/index.html');
const mode=process.argv.includes('--write')?'write':'check';
let html=fs.readFileSync(pagePath,'utf8');
const original=html;
const count=n=>html.split(n).length-1;
function once(n,l){const c=count(n);if(c!==1)throw new Error(`${l}: expected exactly one anchor, found ${c}`)}
function replaceOnce(a,b,l){once(a,l);html=html.replace(a,b)}

if(!html.includes('companies.html · v1.25.2'))throw new Error('Unexpected Companies page generation; fresh review required');
if(!html.includes('"numberOfItems": 10')||!html.includes('"position": 10, "name": "Cypher"'))throw new Error('Cypher Registry admission missing');
if(!html.includes('data-company-010-public-adapter'))throw new Error('Cypher adapter loader missing');
if(!html.includes('const eligible = list.filter(c => c.indexEligible !== false);'))throw new Error('pending-aware computeIndex prerequisite missing');

if(!html.includes('const measuredTotal = list.reduce((s, c) => s + (c.val > 0 ? c.val : 0), 0);')){
  replaceOnce(
`    const eligibleList = list.filter(c => c.indexEligible !== false);
    const total = eligibleList.reduce((s, c) => s + (c.val > 0 ? c.val : 0), 0);
    const pct   = c => activeWeight(c) * 100;`,
`    const eligibleList = list.filter(c => c.indexEligible !== false);
    const measuredTotal = list.reduce((s, c) => s + (c.val > 0 ? c.val : 0), 0);
    const hasPending = list.some(c => c.indexEligible === false);
    const pct   = c => activeWeight(c) * 100;`,
  'General measured-floor header');
  replaceOnce("    if (nv) nv.textContent = total > 0 ? money(total) : 'Live';","    if (nv) nv.textContent = measuredTotal > 0 ? ((hasPending ? '≥ ' : '') + money(measuredTotal)) : 'Live';",'General Network Value measured floor');
  replaceOnce('    if (cn) cn.textContent = eligibleList.length;','    if (cn) cn.textContent = list.length;','General surface company count');
}

if(!html.includes("seg.className = 'index-comp-seg' + (c.indexEligible === false ? ' pending' : '');")){
  replaceOnce(
`        eligibleList.forEach((c, i) => {
            const seg = document.createElement('div');
            seg.className = 'index-comp-seg';
            seg.dataset.nm = c.nm;
            seg.style.width = pct(c).toFixed(2) + '%';
            seg.style.background = shade(i);
            seg.title = companyDisplayName(c.nm) + ' · ' + pct(c).toFixed(1) + '%';
            bar.appendChild(seg);
        });`,
`        list.forEach((c, i) => {
            const seg = document.createElement('div');
            seg.className = 'index-comp-seg' + (c.indexEligible === false ? ' pending' : '');
            seg.dataset.nm = c.nm;
            seg.style.width = c.indexEligible === false ? '0%' : pct(c).toFixed(2) + '%';
            seg.style.background = shade(i);
            seg.title = companyDisplayName(c.nm) + ' · ' + (c.indexEligible === false ? (lang === 'ru' ? 'Вес ожидается' : 'Weight pending') : pct(c).toFixed(1) + '%');
            bar.appendChild(seg);
        });`,
  'composition pending marker');
  replaceOnce(
`        eligibleList.forEach((c, i) => {
            const it = document.createElement('span');
            it.className = 'icl-item';
            it.dataset.nm = c.nm;
            it.innerHTML = '<span class="icl-swatch" style="background:' + shade(i) + '"></span>'
                         + '<b>' + companyDisplayName(c.nm) + '</b> <span class="icl-w">' + pct(c).toFixed(1) + '%</span>';
            leg.appendChild(it);
        });`,
`        list.forEach((c, i) => {
            const it = document.createElement('span');
            it.className = 'icl-item' + (c.indexEligible === false ? ' pending' : '');
            it.dataset.nm = c.nm;
            it.innerHTML = '<span class="icl-swatch" style="background:' + shade(i) + '"></span>'
                         + '<b>' + companyDisplayName(c.nm) + '</b> <span class="icl-w">' + (c.indexEligible === false ? (lang === 'ru' ? 'Ожидание' : 'Pending') : pct(c).toFixed(1) + '%') + '</span>';
            leg.appendChild(it);
        });`,
  'composition pending legend');
}

if(html.includes('const comps = computeIndex().filter(c => c.indexEligible !== false).slice().sort((a, b) => (b.weight || 0) - (a.weight || 0));')){
  replaceOnce('const comps = computeIndex().filter(c => c.indexEligible !== false).slice().sort((a, b) => (b.weight || 0) - (a.weight || 0));','const comps = computeIndex().slice().sort((a, b) => (b.weight || 0) - (a.weight || 0));','Graph includes pending company presence');
}
if(!html.includes("const rCo = c => c.indexEligible === false ? P.rCoMin")){
  replaceOnce('const rCo = c => P.rCoMax * Math.sqrt(Math.min(wt(c), 1));',"const rCo = c => c.indexEligible === false ? P.rCoMin : P.rCoMax * Math.sqrt(Math.min(wt(c), 1));",'Graph pending company radius');
}
if(!html.includes('.index-comp-seg.pending{min-width:3px;opacity:.58}')){
  replaceOnce('.ib-item[data-index-pending="true"] .ibw-track{opacity:.28}',`.ib-item[data-index-pending="true"] .ibw-track{opacity:.28}
        .index-comp-seg.pending{min-width:3px;opacity:.58}
        .icl-item.pending .icl-w{color:var(--gold)}`,'pending composition style');
}

const oldPerf="econ(L.performance, c.cost > 0 ? fmtPct(c.pct) : '—')";
const pendingPerf="econ(L.performance, c.cost > 0 ? fmtPct(c.pct) : (c.performancePending ? (lang === 'ru' ? 'Ожидается' : 'Pending') : '—'))";
if(html.includes(oldPerf))replaceOnce(oldPerf,pendingPerf,'explicit pending Performance state');

const required=[
  'const measuredTotal = list.reduce((s, c) => s + (c.val > 0 ? c.val : 0), 0);',
  "if (cn) cn.textContent = list.length;",
  "seg.className = 'index-comp-seg' + (c.indexEligible === false ? ' pending' : '');",
  "c.indexEligible === false ? (lang === 'ru' ? 'Ожидание' : 'Pending')",
  'const comps = computeIndex().slice().sort',
  "const rCo = c => c.indexEligible === false ? P.rCoMin",
  '.index-comp-seg.pending{min-width:3px;opacity:.58}',
  "c.performancePending ? (lang === 'ru' ? 'Ожидается' : 'Pending')"
];
for(const x of required)if(!html.includes(x))throw new Error('Missing reconciled General Index/Graph integration: '+x);

if(mode==='write'){
  if(html!==original)fs.writeFileSync(pagePath,html);
  console.log(JSON.stringify({status:'PASS',mode,changed:html!==original,page:'companies/index.html',ui:'native-general-passport',surfacePresence:'all-general-companies',weighting:'eligible-only',graphPendingPresence:true,pendingPerformanceExplicit:true},null,2));
}else{
  const out=path.join(ROOT,'.tmp-company-010-public-admission.html');fs.writeFileSync(out,html);
  console.log(JSON.stringify({status:'PASS',mode,changed:html!==original,preview:out,surfacePresence:'all-general-companies',weighting:'eligible-only',graphPendingPresence:true,pendingPerformanceExplicit:true},null,2));
}
