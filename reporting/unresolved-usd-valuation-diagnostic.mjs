#!/usr/bin/env node
import fs from 'node:fs';
import { buildCanonicalEarnedIncomeView } from './canonical-earned-income-view.mjs';

const LEDGER_FILE=process.env.INCOME_LEDGER_FILE||'./reporting/income-ledger.json';
const TARGET_MONTH=process.env.TARGET_MONTH||'2026-09';
const TARGET_COMPANIES=(process.env.TARGET_COMPANIES||'0x5860...83CA8.eth,Cypher,defitea.eth')
  .split(',').map(x=>x.trim()).filter(Boolean);

const ledger=JSON.parse(fs.readFileSync(LEDGER_FILE,'utf8'));
const view=buildCanonicalEarnedIncomeView(ledger);
const targets=new Set(TARGET_COMPANIES);
const rawEvents=Array.isArray(ledger.events)?ledger.events:[];
const byKey=new Map(rawEvents.map(event=>[event.eventKey,event]));

function detail(row){
  const event=byKey.get(row.eventKey)||null;
  return {
    eventKey:row.eventKey,
    company:row.company,
    family:row.family,
    protocol:row.protocol,
    route:row.route,
    asset:row.asset,
    amount:row.amount,
    usdValue:row.usdValue,
    economicDate:row.economicDate,
    periodStart:row.periodStart,
    periodEnd:row.periodEnd,
    reason:row.reason,
    periodAttributionMonth:event?.periodAttributionMonth||null,
    chain:event?.chain||null,
    chainId:event?.chainId??null,
    token:event?.token||event?.rewardToken||null,
    tokenId:event?.tokenId??null,
    rewardContract:event?.rewardContract||null,
    valuationAt:event?.valuationAt||null,
    valuationStatus:event?.valuationStatus||null,
    valuationSourceStatus:event?.valuationSourceStatus||null,
    settlementProofs:event?.settlementProofs||[],
    sourceFile:event?.sourceFile||null,
    sourceFamily:event?.sourceFamily||null,
    evidenceStatus:event?.evidenceStatus||null,
    immutableEconomicFieldsHash:event?.immutableEconomicFieldsHash||null
  };
}

const currentMonthBlockers=view.unresolved
  .filter(row=>targets.has(row.company)&&row.reason==='canonical-event-usd-valuation-incomplete')
  .map(detail)
  .filter(row=>row.periodAttributionMonth===TARGET_MONTH);

const grouped=Object.fromEntries(TARGET_COMPANIES.map(company=>[
  company,
  currentMonthBlockers.filter(row=>row.company===company)
]));

const output={
  version:'0.4-current-month-unresolved-usd-valuation-diagnostic',
  ledgerGeneratedAt:ledger.generatedAt||null,
  targetMonth:TARGET_MONTH,
  targetCompanies:TARGET_COMPANIES,
  currentMonthBlockerCount:currentMonthBlockers.length,
  countsByCompany:Object.fromEntries(TARGET_COMPANIES.map(company=>[company,grouped[company].length])),
  grouped,
  semantics:{
    diagnosticOnly:true,
    mutatesAccounting:false,
    createsIncome:false,
    currentPriceBackfillAllowed:false,
    unknownIsNotZero:true,
    executionAuthority:'none'
  }
};

console.log('Current-month unresolved canonical USD valuation blockers',JSON.stringify(output,null,2));
