#!/usr/bin/env node
import fs from 'node:fs';
import { completePerformanceEvidence, renderCompanyBookBlock, replaceCompanyBookBlock, validateCompleteBasis } from './company-capital-state-contract.mjs';

const STATE='companies/defitea-canonical-state.json';
const INDEX='companies/index.html';
const state=JSON.parse(fs.readFileSync(STATE,'utf8'));
const fail=m=>{throw new Error(m);};

if(state.version!=='0.2-defitea-canonical-state')fail('unexpected Defitea state version');
if(state.company?.registry!=='004'||state.company?.name!=='defitea.eth')fail('Defitea identity drift');
if(state.authority?.executionAuthority!=='none')fail('Defitea authority drift');
if(state.capitalAggregation?.economicIdentity!=='defitea-fund-equals-defitea-company'||state.capitalAggregation?.fundCompanyTvlParityRequired!==true)fail('Defitea fund/company economic identity drift');

const positions=state.productivePositions||[];
validateCompleteBasis(positions,{company:'defitea.eth',expectedCount:11,expectedTotalUsd:state.costBasis?.totalUsd});
if(state.costBasis?.status!=='complete'||Number(state.costBasis?.coveredPositionCount)!==11||Number(state.costBasis?.totalPositionCount)!==11)fail('Defitea portfolio cost basis is not complete');
const snapshot=completePerformanceEvidence(state.evidenceSnapshot,state.costBasis.totalUsd,{label:'Defitea screenshot evidence'});

const rows=positions.map(position=>({
  assetId:position.assetId,
  quantity:Number(position.quantity),
  entryPriceUsd:Number.isFinite(Number(position.averageBuyPriceDisplayed))?Number(position.averageBuyPriceDisplayed):null,
  costBasisUsd:Number(position.costBasisUsd),
  evidenceStatus:position.evidenceStatus
}));

let html=fs.readFileSync(INDEX,'utf8');
const rendered=renderCompanyBookBlock('defitea.eth',rows);
html=replaceCompanyBookBlock(html,'defitea.eth',rendered);
fs.writeFileSync(INDEX,html);

for(const row of rows){
  const basisToken=`costBasisUsd: ${row.costBasisUsd}`;
  if(!html.includes(basisToken))fail(`Defitea physical Company Book basis missing for ${row.assetId}`);
}
if(html.includes("'defitea.eth': [\n        { id: 'frax-share', qty: 4456"))fail('retired Defitea rounded/partial FRAX projection survived');

console.log('Defitea canonical projection PASS',{
  positions:rows.length,
  costBasisStatus:state.costBasis.status,
  totalCostBasisUsd:state.costBasis.totalUsd,
  evidenceSnapshotMarketValueUsd:snapshot.market,
  evidenceSnapshotPerformancePct:snapshot.pct,
  livePerformance:'dynamic-current-canonical-market-value-vs-complete-historical-cost-basis',
  executionAuthority:'none'
});
