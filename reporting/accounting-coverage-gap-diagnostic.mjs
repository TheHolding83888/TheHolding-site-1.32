#!/usr/bin/env node
import fs from 'node:fs';
import process from 'node:process';

const file=process.env.ACCOUNTING_COVERAGE_FILE||'./reporting/accounting-coverage.json';
const data=JSON.parse(fs.readFileSync(file,'utf8'));
const rows=(data.gapRanking||[]).map(g=>{
  const m=data.mechanisms?.[g.engineId]||{};
  return{
    rank:g.rank,
    engineId:g.engineId,
    activeCompanyCount:m.activeCompanyCount||0,
    factualTrackingCompanyCount:m.factualTrackingCompanyCount||0,
    factualEventCompanyCount:m.factualEventCompanyCount||0,
    missingFactualTrackingCompanies:[...(m.stateOnlyCompanies||[]),...(m.referenceOnlyCompanies||[])],
    stateOnlyCompanies:m.stateOnlyCompanies||[],
    referenceOnlyCompanies:m.referenceOnlyCompanies||[],
    knownProductiveValueUsdTotal:m.knownProductiveValueUsdTotal??null
  };
});
console.log('Accounting coverage factual-tracking gaps',JSON.stringify(rows.slice(0,20),null,2));
