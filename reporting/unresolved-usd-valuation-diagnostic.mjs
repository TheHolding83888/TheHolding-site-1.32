#!/usr/bin/env node
import fs from 'node:fs';
import { buildCanonicalEarnedIncomeView } from './canonical-earned-income-view.mjs';

const LEDGER_FILE=process.env.INCOME_LEDGER_FILE||'./reporting/income-ledger.json';
const TARGET_COMPANIES=(process.env.TARGET_COMPANIES||'0x5860...83CA8.eth,Cypher,defitea.eth')
  .split(',').map(x=>x.trim()).filter(Boolean);

const ledger=JSON.parse(fs.readFileSync(LEDGER_FILE,'utf8'));
const view=buildCanonicalEarnedIncomeView(ledger);
const targets=new Set(TARGET_COMPANIES);
const rawEvents=Array.isArray(ledger.events)?ledger.events:[];
const byKey=new Map(rawEvents.map(event=>[event.eventKey,event]));
const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));

function candidateRawEvents(row){
  const exact=byKey.get(row.eventKey);
  if(exact)return[exact];
  const rowTime=Date.parse(row.economicDate||'');
  return rawEvents.filter(event=>{
    if(String(event.company||'')!==String(row.company||''))return false;
    if(String(event.asset||event.symbol||'').toUpperCase()!==String(row.asset||'').toUpperCase())return false;
    if(finite(row.amount)&&finite(event.amount)&&Math.abs(Number(event.amount)-Number(row.amount))>1e-12)return false;
    const eventTime=Date.parse(event.economicDate||event.periodEnd||event.observedAt||'');
    if(Number.isFinite(rowTime)&&Number.isFinite(eventTime)&&Math.abs(eventTime-rowTime)>5*60_000)return false;
    return true;
  }).slice(0,5);
}

function summarizeRaw(event){
  if(!event)return null;
  return {
    ...event,
    _rawKeys:Object.keys(event).sort()
  };
}

function detail(row){
  const candidates=candidateRawEvents(row);
  return {
    normalized:{
      eventKey:row.eventKey,
      company:row.company,
      month:row.month,
      family:row.family,
      protocol:row.protocol,
      route:row.route,
      asset:row.asset,
      amount:row.amount,
      usdValue:row.usdValue,
      economicDate:row.economicDate,
      periodStart:row.periodStart,
      periodEnd:row.periodEnd,
      reason:row.reason
    },
    rawCandidateCount:candidates.length,
    rawCandidates:candidates.map(summarizeRaw)
  };
}

const targetUnresolved=view.unresolved
  .filter(row=>targets.has(row.company)&&row.reason==='canonical-event-usd-valuation-incomplete')
  .map(detail);

const output={
  version:'0.3-unresolved-usd-valuation-diagnostic',
  ledgerGeneratedAt:ledger.generatedAt||null,
  earnedViewSummary:view.summary,
  targetCompanies:TARGET_COMPANIES,
  targetUsdIncompleteCount:targetUnresolved.length,
  targetUnresolved,
  semantics:{
    diagnosticOnly:true,
    mutatesAccounting:false,
    createsIncome:false,
    currentPriceBackfillAllowed:false,
    unknownIsNotZero:true,
    executionAuthority:'none'
  }
};

console.log('Unresolved canonical USD valuation diagnostic',JSON.stringify(output,null,2));
