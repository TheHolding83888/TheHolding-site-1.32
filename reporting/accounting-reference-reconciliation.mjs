#!/usr/bin/env node
/**
 * The Holding · Accounting Reference Reconciliation v0.1
 *
 * Diagnostic comparison only. This layer explains where Reference/Estimated and
 * factual Confirmed accounting differ; it never creates income, closes a month,
 * replaces UNKNOWN, or mutates Canonical Income Ledger semantics.
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const ROOT=process.cwd();
const MONTHLY_FILE=process.env.COMPANY_MONTHLY_REPORTS_FILE||path.join(ROOT,'reporting','company-monthly-reports.json');
const COVERAGE_FILE=process.env.ACCOUNTING_COVERAGE_FILE||path.join(ROOT,'reporting','accounting-coverage.json');
const REPORTING_FILE=process.env.REPORTING_DATA_FILE||path.join(ROOT,'reporting','reporting-data.json');
const NOTICE_FILE=process.env.ACCOUNTING_NOTICE_QUEUE_FILE||path.join(ROOT,'reporting','accounting-notice-queue.json');
const OUTPUT_FILE=process.env.ACCOUNTING_REFERENCE_RECONCILIATION_FILE||path.join(ROOT,'reporting','accounting-reference-reconciliation.json');
const VERSION='0.1-accounting-reference-reconciliation';
const START_MONTH='2026-08';

const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
const round=(v,d=8)=>{if(!finite(v))return null;const p=10**d;return Math.round(Number(v)*p)/p;};
const canonical=name=>String(name||'').trim()==='aerocrvyb.eth'?'aerocvxyb.eth':String(name||'').trim();
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const write=(file,data)=>{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(data,null,2)+'\n');};
const monthKey=value=>{const raw=String(value||'');if(/^\d{4}-\d{2}/.test(raw))return raw.slice(0,7);const t=Date.parse(raw);return Number.isFinite(t)?new Date(t).toISOString().slice(0,7):null;};
const unique=values=>[...new Set((values||[]).filter(Boolean))];

function ratioBand(referenceUsd,confirmedUsd){
  if(!finite(referenceUsd)||Number(referenceUsd)<=0||!finite(confirmedUsd))return{captureRatio:null,signalBand:'not-comparable',attention:'context'};
  const ratio=Number(confirmedUsd)/Number(referenceUsd);
  if(ratio<0.30)return{captureRatio:round(ratio,6),signalBand:'wide-divergence',attention:'high'};
  if(ratio<0.70)return{captureRatio:round(ratio,6),signalBand:'material-divergence',attention:'moderate'};
  if(ratio<0.90)return{captureRatio:round(ratio,6),signalBand:'review-band',attention:'review'};
  if(ratio<=1.10)return{captureRatio:round(ratio,6),signalBand:'broad-parity-band',attention:'low'};
  return{captureRatio:round(ratio,6),signalBand:'above-reference',attention:'review'};
}

function companyNoticeContext(queue,company,month){
  if(queue?.currentMonth!==month)return{categories:[],blockers:[],actions:[],engineeringActionable:false,parked:false};
  const rows=(queue?.rows||[]).filter(row=>canonical(row?.company)===canonical(company));
  return{
    categories:unique(rows.map(row=>row?.category)).sort(),
    blockers:unique(rows.map(row=>row?.blocker)).sort(),
    actions:unique(rows.map(row=>row?.action)).sort(),
    engineeringActionable:rows.some(row=>row?.engineeringActionable===true),
    parked:rows.some(row=>row?.parked===true)
  };
}

function companyPeriodRows(monthly,queue){
  const rows=[];
  for(const [companyName,company] of Object.entries(monthly?.companies||{})){
    for(const [month,row] of Object.entries(company?.months||{})){
      if(month<START_MONTH)continue;
      const view=row?.incomeView||{};
      const referenceUsd=view?.estimated?.available===true&&finite(view?.estimated?.usd)?Number(view.estimated.usd):null;
      const confirmedUsd=finite(view?.confirmed?.usd)?Number(view.confirmed.usd):null;
      const deltaUsd=finite(referenceUsd)&&finite(confirmedUsd)?round(referenceUsd-confirmedUsd):null;
      const ratio=ratioBand(referenceUsd,confirmedUsd);
      const lifecycle=row?.incomeAccounting?.lifecycle||{};
      const unresolvedReasons=Array.isArray(lifecycle?.unresolvedReasons)?lifecycle.unresolvedReasons:[];
      const notices=companyNoticeContext(queue,companyName,month);
      const partialPeriod=row?.partialPeriod===true||String(view?.confirmed?.periodStart||'').slice(0,7)!==month||row?.status==='provisional';
      const reasonCodes=unique([
        'reference-comparator-is-non-factual',
        row?.accountingCoverageComplete===true?'factual-period-coverage-complete':'factual-period-coverage-incomplete',
        partialPeriod?'partial-observation-window':null,
        Number(lifecycle?.unresolvedEventCount||0)>0?'lifecycle-events-unresolved':null,
        unresolvedReasons.some(reason=>String(reason).includes('period-boundary'))?'period-boundary-evidence':null,
        notices.parked?'owner-data-pending':null
      ]);
      rows.push({
        id:['company-period',canonical(companyName),month].join(':'),
        scope:'company-period',
        company:canonical(companyName),
        registry:company?.registry||null,
        month,
        referenceUsd:round(referenceUsd),
        confirmedUsd:round(confirmedUsd),
        deltaUsd,
        ...ratio,
        referenceAvailable:finite(referenceUsd),
        confirmedAvailable:finite(confirmedUsd),
        factualTrackingActive:null,
        eventCount:Number(view?.confirmed?.evidenceCount||row?.accountingEvidenceCount||0),
        accountingStatus:row?.accountingStatus||null,
        factualPeriodComplete:row?.accountingCoverageComplete===true,
        periodBoundaryIssue:unresolvedReasons.some(reason=>String(reason).includes('period-boundary')),
        modelVariancePossible:finite(referenceUsd),
        modelVarianceIsProven:false,
        partialPeriod,
        periodStart:view?.confirmed?.periodStart||row?.periodStart||null,
        periodEnd:view?.confirmed?.periodEnd||row?.periodEnd||null,
        referenceScopeContributors:Array.isArray(view?.estimated?.scopeContributors)?view.estimated.scopeContributors:[],
        referenceScopeComponents:Array.isArray(view?.estimated?.scopeComponents)?view.estimated.scopeComponents:[],
        confirmedOwnerBreakdown:Array.isArray(view?.confirmed?.canonicalOwnerBreakdown)?view.confirmed.canonicalOwnerBreakdown:[],
        unresolvedLifecycleEventCount:Number(lifecycle?.unresolvedEventCount||0),
        unresolvedLifecycleReasons:unresolvedReasons,
        noticeCategories:notices.categories,
        noticeBlockers:notices.blockers,
        noticeActions:notices.actions,
        engineeringActionable:notices.engineeringActionable,
        parked:notices.parked,
        reconciliationStatus:notices.parked?'parked-owner-data-pending':!finite(referenceUsd)||!finite(confirmedUsd)?'not-comparable':Number(lifecycle?.unresolvedEventCount||0)>0?'lifecycle-review':ratio.signalBand,
        reasonCodes,
        comparisonSemantic:'Reference/Estimated and Confirmed are independent non-additive views. Delta and captureRatio are diagnostics, not missing-income or completeness authority.',
        sourceOfTruth:false,
        incomeCreationAuthority:false,
        monthClosingAuthority:false,
        canReplaceUnknown:false,
        executionAuthority:'none'
      });
    }
  }
  return rows;
}

function defiteaReferenceByMechanism(reporting){
  const daily=reporting?.funds?.['defitea.eth']?.daily||[];
  const map=new Map();
  for(const day of daily){
    const month=monthKey(day?.date);
    if(!month||month<START_MONTH)continue;
    for(const position of day?.positions||[]){
      const engineId=String(position?.engineId||'').trim();
      if(!engineId||!finite(position?.valueUsd)||!finite(position?.referenceApr))continue;
      const key=`${month}|${engineId}`;
      if(!map.has(key))map.set(key,{month,engineId,referenceUsd:0,dates:new Set(),positionIds:new Set(),rateStatuses:new Set()});
      const entry=map.get(key);
      entry.referenceUsd+=Number(position.valueUsd)*Number(position.referenceApr)/100/365;
      entry.dates.add(String(day.date));
      entry.positionIds.add(String(position?.principalId||engineId));
      if(position?.rateStatus)entry.rateStatuses.add(String(position.rateStatus));
    }
  }
  return map;
}

function defiteaMechanismRows(reporting,coverage){
  const out=[];
  const reference=defiteaReferenceByMechanism(reporting);
  const company=coverage?.companies?.['defitea.eth'];
  for(const [key,ref] of reference){
    const state=company?.mechanisms?.[ref.engineId]?.months?.[ref.month]||null;
    const referenceUsd=round(ref.referenceUsd);
    const confirmedUsd=state&&finite(state?.factualUsdSubtotal)?Number(state.factualUsdSubtotal):null;
    const deltaUsd=finite(referenceUsd)&&finite(confirmedUsd)?round(referenceUsd-confirmedUsd):null;
    const ratio=ratioBand(referenceUsd,confirmedUsd);
    const dates=[...ref.dates].sort();
    const periodBoundaryIssue=Number(state?.crossMonthEvidenceCount||0)>0||(state?.completionBlockers||[]).includes('cross-month-boundary-requires-explicit-allocation');
    const tracking=state?.factualTrackingActive===true;
    const eventCount=Number(state?.factualEventCount||0);
    const partialPeriod=dates[0]!==`${ref.month}-01`||ref.month===coverage?.currentMonth;
    const reasonCodes=unique([
      'base-position-reference-comparator-is-non-factual',
      partialPeriod?'partial-reference-window':null,
      tracking?'factual-tracking-active':'missing-factual-tracking-capability',
      tracking&&eventCount===0?'tracking-no-period-event':null,
      eventCount>0?'factual-period-events-observed':null,
      periodBoundaryIssue?'period-boundary-evidence':null
    ]);
    let reconciliationStatus='not-comparable';
    if(!tracking)reconciliationStatus='missing-capability';
    else if(eventCount===0)reconciliationStatus='tracking-no-period-event';
    else if(periodBoundaryIssue)reconciliationStatus='boundary-review';
    else if(finite(referenceUsd)&&finite(confirmedUsd))reconciliationStatus=ratio.signalBand;
    out.push({
      id:['mechanism-base-reference','defitea.eth',ref.month,ref.engineId].join(':'),
      scope:'mechanism-base-reference',
      company:'defitea.eth',
      registry:company?.registry||'004',
      month:ref.month,
      mechanism:ref.engineId,
      referenceUsd,
      confirmedUsd:round(confirmedUsd),
      deltaUsd,
      ...ratio,
      referenceAvailable:finite(referenceUsd),
      confirmedAvailable:finite(confirmedUsd),
      factualTrackingActive:tracking,
      eventCount,
      trackingStatus:state?.status||null,
      periodBoundaryIssue,
      crossMonthEvidenceCount:Number(state?.crossMonthEvidenceCount||0),
      modelVariancePossible:true,
      modelVarianceIsProven:false,
      partialPeriod,
      referenceSampleDays:dates.length,
      referencePeriodStart:dates[0]||null,
      referencePeriodEnd:dates.at(-1)||null,
      referencePositionIds:[...ref.positionIds].sort(),
      referenceRateStatuses:[...ref.rateStatuses].sort(),
      referenceBasis:'canonical Reporting daily position valueUsd × admitted Reference APR / 365',
      referenceScope:'Defitea base productive positions only',
      referenceScopeExcludes:['associated-company-reference-contributors','supplementary-income-channel-reference-not-represented-in-the-daily-position-row'],
      companyEstimatedReconciliationAuthority:false,
      reconciliationStatus,
      reasonCodes,
      completionBlockers:Array.isArray(state?.completionBlockers)?state.completionBlockers:[],
      comparisonSemantic:'Mechanism row compares observed base-position Reference economics with canonical factual events matched to the mechanism. It does not claim to decompose the entire company Estimated total.',
      sourceOfTruth:false,
      incomeCreationAuthority:false,
      monthClosingAuthority:false,
      canReplaceUnknown:false,
      executionAuthority:'none'
    });
  }
  return out.sort((a,b)=>a.month.localeCompare(b.month)||a.mechanism.localeCompare(b.mechanism));
}

const monthly=read(MONTHLY_FILE);
const coverage=read(COVERAGE_FILE);
const reporting=read(REPORTING_FILE);
const queue=read(NOTICE_FILE);

if(monthly?.trackingPolicy?.referenceIncomeIsEarnedIncomeAuthority!==false||monthly?.trackingPolicy?.executionAuthority!=='none')throw new Error('Company Monthly Reports authority drift');
if(coverage?.status!=='diagnostic-no-completion-authority'||coverage?.semantics?.canonicalLedgerIsSoleFactualIncomeAuthority!==true||coverage?.authority?.monthClosingAuthority!==false)throw new Error('Accounting Coverage authority drift');
if(queue?.status!=='diagnostic-no-completion-authority'||queue?.authority?.sourceOfTruth!==false||queue?.authority?.incomeCreationAuthority!==false)throw new Error('Accounting Notice Queue authority drift');
if(!Array.isArray(reporting?.funds?.['defitea.eth']?.daily))throw new Error('Canonical Defitea Reporting daily history missing');

const companyRows=companyPeriodRows(monthly,queue);
const mechanismRows=defiteaMechanismRows(reporting,coverage);
const rows=[...companyRows,...mechanismRows];
const comparable=rows.filter(row=>finite(row.referenceUsd)&&finite(row.confirmedUsd)&&Number(row.referenceUsd)>0);
const output={
  version:VERSION,
  generatedAt:new Date().toISOString(),
  status:'diagnostic-no-completion-authority',
  periodStart:START_MONTH,
  purpose:'Continuously compare independent Reference/Estimated and factual Confirmed accounting so economically meaningful spread is detected and explained rather than discovered manually.',
  semantics:{
    sourceOfTruth:false,
    canonicalIncomeLedgerRemainsSoleFactualIncomeAuthority:true,
    referenceEstimateIsFactualIncome:false,
    referenceEstimateCanBackfillIncome:false,
    deltaIsMissingIncome:false,
    captureRatioIsAccountingCompleteness:false,
    signalBandIsAccountingStatus:false,
    broadParityDoesNotCloseMonth:true,
    modelVariancePossibleDoesNotProveModelVariance:true,
    companyAndMechanismRowsHaveDifferentReferenceScopes:true,
    mechanismRowsDoNotNecessarilySumToCompanyEstimated:true,
    unknownIsNotZero:true
  },
  diagnosticBands:{
    basis:'confirmedUsd / referenceUsd; comparator only',
    wideDivergence:'ratio < 0.30',
    materialDivergence:'0.30 <= ratio < 0.70',
    reviewBand:'0.70 <= ratio < 0.90',
    broadParityBand:'0.90 <= ratio <= 1.10',
    aboveReference:'ratio > 1.10',
    accountingAuthority:false,
    monthClosingAuthority:false
  },
  sourceState:{
    companyMonthlyReports:{file:'reporting/company-monthly-reports.json',version:monthly.version,generatedAt:monthly.generatedAt},
    accountingCoverage:{file:'reporting/accounting-coverage.json',version:coverage.version,generatedAt:coverage.generatedAt},
    reporting:{file:'reporting/reporting-data.json',version:reporting.version,generatedAt:reporting.generatedAt},
    accountingNoticeQueue:{file:'reporting/accounting-notice-queue.json',version:queue.version,generatedAt:queue.generatedAt}
  },
  summary:{
    rowCount:rows.length,
    companyPeriodRowCount:companyRows.length,
    mechanismBaseReferenceRowCount:mechanismRows.length,
    comparableRowCount:comparable.length,
    highAttentionCount:comparable.filter(row=>row.attention==='high').length,
    moderateAttentionCount:comparable.filter(row=>row.attention==='moderate').length,
    reviewAttentionCount:comparable.filter(row=>row.attention==='review').length,
    lowAttentionCount:comparable.filter(row=>row.attention==='low').length,
    parkedCount:companyRows.filter(row=>row.parked).length,
    engineeringActionableCompanyPeriodCount:companyRows.filter(row=>row.engineeringActionable).length
  },
  prioritizationPolicy:{
    order:['engineering-actionable','absolute-dollar-delta','productive-capital/reusable-mechanism-context','small-dollar-tail'],
    numericalConvergenceTarget:false,
    target:'100% of economically meaningful divergence should become evidence-explained, explicitly model-variance, explicitly pending, or permanently UNKNOWN/partial where proof is unavailable.'
  },
  rows,
  authority:{
    readOnly:true,
    sourceOfTruth:false,
    incomeCreationAuthority:false,
    factualIncomeAuthority:false,
    referenceIncomeAuthority:false,
    accountingCompletionAuthority:false,
    monthClosingAuthority:false,
    canReplaceUnknown:false,
    methodologyMutationAuthority:'none',
    walletAuthority:'none',
    capitalExecution:false,
    executionAuthority:'none'
  }
};
write(OUTPUT_FILE,output);
console.log('Accounting Reference Reconciliation v0.1 built',output.summary);
