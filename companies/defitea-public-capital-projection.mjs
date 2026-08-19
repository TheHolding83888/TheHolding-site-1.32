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
"        { id: 'aerodrome-finance', qty: 2632, entry: 0.4265, costBasisStatus: 'partial', establishedCostBasisUsd: 1040.66, incrementalQtyCostBasisUnknown: 192 },",
'Defitea AERO Company Book');
html=replaceOnce(html,
"        { id: 'fxn-token',         qty: 59.81, entry: 15.06 },",
"        { id: 'fxn-token', qty: 64.81, entry: 15.06, costBasisStatus: 'partial', establishedCostBasisUsd: 900.7386, incrementalQtyCostBasisUnknown: 5 },",
'Defitea FXN Company Book');

const oldBookFigures=`function bookFigures(nm, prices) {
    const pos = COMPANY_BOOK[nm] || [];
    let value = 0, cost = 0;
    pos.forEach(p => {
        if (p.productivityOnly) return;
        const price = (p.fixed !== undefined) ? p.fixed : (prices[p.id] || 0);
        value += p.qty * price;
        const explicitCost = p.costBasisUsd !== null && p.costBasisUsd !== undefined && p.costBasisUsd !== ''
            && Number.isFinite(Number(p.costBasisUsd)) ? Number(p.costBasisUsd) : null;
        cost += explicitCost !== null ? explicitCost : p.qty * p.entry;
    });
    return { value: value, cost: cost, pnl: value - cost, pct: cost > 0 ? (value / cost - 1) * 100 : 0 };
}`;
const newBookFigures=`function bookFigures(nm, prices) {
    const pos = COMPANY_BOOK[nm] || [];
    let value = 0, knownCost = 0, costComplete = true;
    pos.forEach(p => {
        if (p.productivityOnly) return;
        const price = (p.fixed !== undefined) ? p.fixed : (prices[p.id] || 0);
        value += p.qty * price;
        if (p.costBasisStatus === 'partial') {
            costComplete = false;
            const established = Number(p.establishedCostBasisUsd);
            if (Number.isFinite(established) && established >= 0) knownCost += established;
            return;
        }
        const explicitCost = p.costBasisUsd !== null && p.costBasisUsd !== undefined && p.costBasisUsd !== ''
            && Number.isFinite(Number(p.costBasisUsd)) ? Number(p.costBasisUsd) : null;
        const entry = p.entry !== null && p.entry !== undefined && Number.isFinite(Number(p.entry)) ? Number(p.entry) : null;
        if (explicitCost !== null) knownCost += explicitCost;
        else if (entry !== null) knownCost += p.qty * entry;
        else costComplete = false;
    });
    const cost = costComplete ? knownCost : 0;
    return {
        value,
        cost,
        knownCostBasisUsd: knownCost,
        costComplete,
        performancePending: !costComplete,
        pnl: costComplete ? value - knownCost : undefined,
        pct: costComplete && knownCost > 0 ? (value / knownCost - 1) * 100 : undefined
    };
}`;
html=replaceOnce(html,oldBookFigures,newBookFigures,'Company Book partial cost-basis semantics');
html=replaceOnce(html,
"        { nm: 'defitea.eth',   val: tvl4, cost: F4.cost, pnl: F4.pnl, pct: F4.pct, href: 'https://theholding.ai/defitea/',",
"        { nm: 'defitea.eth',   val: tvl4, cost: F4.cost, pnl: F4.pnl, pct: F4.pct, performancePending: F4.performancePending, knownCostBasisUsd: F4.knownCostBasisUsd, href: 'https://theholding.ai/defitea/',",
'Defitea Performance pending projection');
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

if(!html.includes("performancePending: F4.performancePending"))fail('Defitea Performance must fail closed while incremental basis is unknown');
if(!html.includes("incrementalQtyCostBasisUnknown: 192")||!html.includes("incrementalQtyCostBasisUnknown: 5"))fail('Defitea partial cost-basis provenance missing');
console.log('Defitea canonical projection PASS',{positions:s.productivePositions.length,aero:byId.get('aerodrome-finance').quantity,fxn:byId.get('fxn-token').quantity,performance:'pending-partial-cost-basis',executionAuthority:'none'});
