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
const byKey=new Map((ledger.events||[]).map(event=>[event.eventKey,event]));

function detail(row){
  const event=byKey.get(row.eventKey)||{};
  return {
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
    reason:row.reason,
    sourceFile:event.sourceFile||null,
    sourceEvidenceFamily:event.sourceEvidenceFamily||null,
    sourceFamily:event.sourceFamily||null,
    sourceIdentity:event.sourceIdentity||null,
    chain:event.chain||null,
    chainId:event.chainId??null,
    protocolKey:event.protocolKey||null,
    laneKey:event.laneKey||null,
    holder:event.holder||event.wallet||null,
    tokenId:event.tokenId??null,
    rewardContract:event.rewardContract||null,
    rewardToken:event.rewardToken||null,
    blockNumber:event.blockNumber??null,
    openBlock:event.openBlock??null,
    closeBlock:event.closeBlock??null,
    transactionHash:event.transactionHash||null,
    valuationResolution:event.valuationResolution||null,
    immutableEconomicFieldsHash:event.immutableEconomicFieldsHash||null
  };
}

const allUsdIncomplete=view.unresolved
  .filter(row=>row.reason==='canonical-event-usd-valuation-incomplete')
  .map(detail);
const targetUnresolved=view.unresolved
  .filter(row=>targets.has(row.company))
  .map(detail);
const exactTargetUsdIncomplete=allUsdIncomplete.filter(row=>targets.has(row.company)&&row.month===TARGET_MONTH);

const output={
  version:'0.2-unresolved-usd-valuation-diagnostic',
  ledgerGeneratedAt:ledger.generatedAt||null,
  earnedViewSummary:view.summary,
  targetMonth:TARGET_MONTH,
  targetCompanies:TARGET_COMPANIES,
  exactTargetUsdIncompleteCount:exactTargetUsdIncomplete.length,
  exactTargetUsdIncomplete,
  allUsdIncompleteCount:allUsdIncomplete.length,
  allUsdIncomplete,
  targetUnresolvedCount:targetUnresolved.length,
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
