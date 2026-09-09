#!/usr/bin/env node
/**
 * The Holding · Accounting Notice Queue v0.2
 *
 * A derived operational projection of canonical monthly accounting truth.
 * It never creates income, closes coverage, replaces UNKNOWN, or becomes a
 * second accounting source of truth. The queue exists only to turn Passport
 * notices into one machine-readable work surface.
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const ROOT=process.cwd();
const COVERAGE_FILE=process.env.ACCOUNTING_COVERAGE_FILE||path.join(ROOT,'reporting','accounting-coverage.json');
const MONTHLY_FILE=process.env.COMPANY_MONTHLY_REPORTS_FILE||path.join(ROOT,'reporting','company-monthly-reports.json');
const ICP_FILE=process.env.ICP_NNS_FACTUAL_SNAPSHOTS_FILE||path.join(ROOT,'reporting','icp-nns-factual-snapshots.json');
const OUTPUT_FILE=process.env.ACCOUNTING_NOTICE_QUEUE_FILE||path.join(ROOT,'reporting','accounting-notice-queue.json');

const VERSION='0.2-accounting-notice-queue-boundary-evidence-pending';
const BOUNDARY_EVIDENCE_PENDING_REASON='period-boundary-evidence-pending-no-exact-month-cut';
const CATEGORIES=new Set([
  'missing-capability',
  'tracking-no-period-event',
  'period-lifecycle-reconciliation',
  'reference-vs-factual-divergence'
]);
const PRIORITY={
  'missing-capability':1,
  'period-lifecycle-reconciliation':2,
  'tracking-no-period-event':3,
  'reference-vs-factual-divergence':4
};
const canonical=name=>String(name||'').trim()==='aerocrvyb.eth'?'aerocvxyb.eth':String(name||'').trim();
const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
const round=(v,digits=8)=>{if(!finite(v))return null;const p=10**digits;return Math.round(Number(v)*p)/p;};
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const write=(file,data)=>{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(data,null,2)+'\n');};
const monthlyCompany=(monthly,name)=>{
  const key=Object.keys(monthly?.companies||{}).find(k=>canonical(k)===canonical(name));
  return key?monthly.companies[key]:null;
};
const currentMonthRow=(monthly,name,month)=>monthlyCompany(monthly,name)?.months?.[month]||null;
const incomeView=row=>row?.incomeView||{};
const companyAmounts=row=>{
  const view=incomeView(row);
  const confirmed=finite(view?.confirmed?.usd)?Number(view.confirmed.usd):(finite(row?.observedEarnedIncomeUsd)?Number(row.observedEarnedIncomeUsd):null);
  const estimated=view?.estimated?.available===false?null:(finite(view?.estimated?.usd)?Number(view.estimated.usd):(finite(row?.referenceAnalytics?.generatedIncomeUsd)?Number(row.referenceAnalytics.generatedIncomeUsd):null));
  return{
    confirmedUsd:round(confirmed),
    estimatedUsd:round(estimated),
    deltaUsd:finite(confirmed)&&finite(estimated)?round(Number(estimated)-Number(confirmed)):null
  };
};
const lifecycle=row=>row?.incomeAccounting?.lifecycle||{};
const boundaryEvidencePending=reasons=>Array.isArray(reasons)&&reasons.length>0&&reasons.every(reason=>reason===BOUNDARY_EVIDENCE_PENDING_REASON);

const coverage=read(COVERAGE_FILE);
const monthly=read(MONTHLY_FILE);
const icp=read(ICP_FILE);
if(coverage?.status!=='diagnostic-no-completion-authority')throw new Error('Accounting Coverage must remain diagnostic-only');
if(coverage?.authority?.monthClosingAuthority!==false||coverage?.authority?.executionAuthority!=='none')throw new Error('Accounting Coverage authority drift');
if(monthly?.trackingPolicy?.referenceIncomeIsEarnedIncomeAuthority!==false||monthly?.trackingPolicy?.executionAuthority!=='none')throw new Error('Monthly Reporting authority drift');
if(icp?.semantics?.singleSnapshotCanCreateIncome!==false||icp?.authority?.periodIncomeAuthority!==false)throw new Error('ICP factual snapshot authority drift');

const month=coverage.currentMonth;
if(!/^\d{4}-\d{2}$/.test(String(month||'')))throw new Error('Accounting Coverage currentMonth missing');
const ownerDataPending=icp?.status==='baseline-only-no-period-income'&&Array.isArray(icp?.snapshots)&&icp.snapshots.length<2;
const rows=[];
const makeBase=({company,registry,scope,mechanism,category,trackingState,blocker,action,engineeringActionable,parked=false})=>({
  id:[category,canonical(company),month,mechanism||scope].join(':'),
  company:canonical(company),
  registry:registry||null,
  month,
  scope,
  mechanism:mechanism||null,
  category,
  priority:PRIORITY[category],
  trackingState:trackingState||null,
  blocker:blocker||null,
  action,
  engineeringActionable:Boolean(engineeringActionable),
  parked:Boolean(parked),
  sourceOfTruth:false,
  incomeCreationAuthority:false,
  monthClosingAuthority:false,
  canReplaceUnknown:false,
  executionAuthority:'none'
});

for(const [companyKey,c] of Object.entries(coverage.companies||{})){
  const company=canonical(companyKey);
  const monthRow=currentMonthRow(monthly,company,month);
  const companyContext=companyAmounts(monthRow);
  for(const [engineId,m] of Object.entries(c?.mechanisms||{})){
    const state=m?.months?.[month];
    if(!state)continue;
    const mechanismConfirmed=finite(state?.factualUsdSubtotal)?round(state.factualUsdSubtotal):null;
    const common={
      companyContext,
      productiveValueUsd:finite(m?.productiveValueUsd)?round(m.productiveValueUsd):null,
      accountingFamily:m?.accountingFamily||null,
      factualTrackingActive:state?.factualTrackingActive===true,
      factualEventCount:Number(state?.factualEventCount||0),
      estimatedUsd:null,
      confirmedUsd:mechanismConfirmed,
      deltaUsd:null,
      amountScope:'mechanism-confirmed-only; estimated remains company-period context unless a canonical mechanism estimate exists'
    };

    if(engineId==='icp_nns'&&ownerDataPending){
      rows.push({
        ...makeBase({company,registry:c?.registry,scope:'mechanism',mechanism:engineId,category:'period-lifecycle-reconciliation',trackingState:state?.status,blocker:'owner-data-pending',action:'await-owner-factual-snapshot',engineeringActionable:false,parked:true}),
        ...common,
        ownerEvidence:{snapshotCount:icp.snapshots.length,status:icp.status,nextRequiredEvidence:'second comparable owner factual NNS maturity snapshot'}
      });
      continue;
    }

    if(m?.reusableCoverageGap===true||state?.factualTrackingActive!==true){
      rows.push({
        ...makeBase({company,registry:c?.registry,scope:'mechanism',mechanism:engineId,category:'missing-capability',trackingState:state?.status,blocker:'missing-factual-tracking-capability',action:'build-reusable-factual-tracking-or-prove-objective-impossibility',engineeringActionable:true}),
        ...common
      });
      continue;
    }

    if(state?.status==='factual-tracking-no-period-event'||(state?.factualTrackingActive===true&&Number(state?.factualEventCount||0)===0)){
      rows.push({
        ...makeBase({company,registry:c?.registry,scope:'mechanism',mechanism:engineId,category:'tracking-no-period-event',trackingState:state?.status,blocker:null,action:'observe-normal-cadence; no-engineering-action-unless-evidence-boundary-breaks',engineeringActionable:false}),
        ...common
      });
    }
  }

  if(monthRow){
    const amounts=companyAmounts(monthRow);
    const life=lifecycle(monthRow);
    if(Number(life?.unresolvedEventCount||0)>0){
      const unresolvedReasons=Array.isArray(life?.unresolvedReasons)?life.unresolvedReasons:[];
      const exactCutEvidencePending=boundaryEvidencePending(unresolvedReasons);
      rows.push({
        ...makeBase({
          company,
          registry:c?.registry,
          scope:'company-period',
          mechanism:'__company_period__',
          category:'period-lifecycle-reconciliation',
          trackingState:monthRow?.accountingStatus||null,
          blocker:exactCutEvidencePending?'historical-boundary-evidence-pending':'unresolved-period-lifecycle-events',
          action:exactCutEvidencePending?'await-exact-boundary-evidence-no-proration':'reconcile-period-boundary-settlement-or-lifecycle-semantics',
          engineeringActionable:!exactCutEvidencePending,
          parked:exactCutEvidencePending
        }),
        ...amounts,
        amountScope:'company-period',
        unresolvedEventCount:Number(life.unresolvedEventCount||0),
        unresolvedReasons,
        boundaryEvidencePending:exactCutEvidencePending,
        prorationAllowed:false
      });
    }
    if(finite(amounts.confirmedUsd)&&finite(amounts.estimatedUsd)&&Math.abs(Number(amounts.deltaUsd||0))>1e-8){
      rows.push({
        ...makeBase({company,registry:c?.registry,scope:'company-period',mechanism:'__company_period__',category:'reference-vs-factual-divergence',trackingState:monthRow?.accountingStatus||null,blocker:null,action:'diagnostic-comparison-only; investigate only when evidence makes divergence material',engineeringActionable:false}),
        ...amounts,
        amountScope:'company-period',
        comparisonSemantic:'Estimated is a non-factual Reference-model comparator; delta is not missing income and has no completion authority.'
      });
    }
  }
}

for(const row of rows)if(!CATEGORIES.has(row.category))throw new Error(`Unknown queue category ${row.category}`);
rows.sort((a,b)=>a.priority-b.priority||Number(b.engineeringActionable)-Number(a.engineeringActionable)||a.company.localeCompare(b.company)||String(a.mechanism).localeCompare(String(b.mechanism)));
const count=category=>rows.filter(x=>x.category===category).length;
const output={
  version:VERSION,
  generatedAt:new Date().toISOString(),
  status:'diagnostic-no-completion-authority',
  currentMonth:month,
  purpose:'Single derived operational queue for Company Passport accounting notices and reconciliation work. Canonical sources remain unchanged and authoritative.',
  semantics:{
    sourceOfTruth:false,
    canonicalIncomeLedgerRemainsSoleFactualIncomeAuthority:true,
    accountingCoverageRemainsFactualTrackingAuthority:true,
    companyMonthlyReportsRemainPresentationAuthority:true,
    estimatedIncomeIsFactualIncome:false,
    estimatedIncomeCanCloseAccountingCoverage:false,
    confirmedPlusEstimatedIsValidTotal:false,
    deltaIsMissingIncome:false,
    trackingNoPeriodEventIsError:false,
    ownerDataPendingIsEngineeringFailure:false,
    boundaryEvidencePendingIsEngineeringFailure:false,
    crossMonthIntervalProrationAllowed:false,
    boundaryEvidencePendingCanCloseAccountingCoverage:false,
    unknownIsNotZero:true
  },
  sourceState:{
    accountingCoverage:{file:'reporting/accounting-coverage.json',version:coverage.version,generatedAt:coverage.generatedAt},
    companyMonthlyReports:{file:'reporting/company-monthly-reports.json',version:monthly.version,generatedAt:monthly.generatedAt},
    icpNnsFactualSnapshots:{file:'reporting/icp-nns-factual-snapshots.json',version:icp.version,status:icp.status,snapshotCount:Array.isArray(icp.snapshots)?icp.snapshots.length:0}
  },
  classificationContract:{
    'missing-capability':'Actual reusable factual-tracking capability is absent; engineering action is justified.',
    'tracking-no-period-event':'Factual tracking exists but no event has occurred in the selected month; this is not an error.',
    'period-lifecycle-reconciliation':'Evidence exists but period/lifecycle attribution needs reconciliation. An explicit historical-boundary-evidence-pending blocker means the source interval crosses a calendar boundary without an exact cut; it remains UNKNOWN/partial and must not be time-prorated.',
    'reference-vs-factual-divergence':'Confirmed factual income and non-factual Reference estimate are shown side by side as a diagnostic comparison only.'
  },
  summary:{
    rowCount:rows.length,
    engineeringActionableCount:rows.filter(x=>x.engineeringActionable).length,
    parkedCount:rows.filter(x=>x.parked).length,
    missingCapabilityCount:count('missing-capability'),
    trackingNoPeriodEventCount:count('tracking-no-period-event'),
    periodLifecycleReconciliationCount:count('period-lifecycle-reconciliation'),
    referenceVsFactualDivergenceCount:count('reference-vs-factual-divergence'),
    ownerDataPendingCount:rows.filter(x=>x.blocker==='owner-data-pending').length,
    boundaryEvidencePendingCount:rows.filter(x=>x.blocker==='historical-boundary-evidence-pending').length
  },
  rows,
  authority:{
    readOnly:true,
    sourceOfTruth:false,
    incomeCreationAuthority:false,
    factualIncomeAuthority:false,
    monthClosingAuthority:false,
    canReplaceUnknown:false,
    methodologyMutationAuthority:'none',
    walletAuthority:'none',
    capitalExecution:false,
    executionAuthority:'none'
  }
};
write(OUTPUT_FILE,output);
console.log('Accounting Notice Queue v0.2 built',output.summary);
