#!/usr/bin/env node
/**
 * The Holding · Accounting Coverage Registry v0.1
 *
 * Diagnostic-only registry of productive income mechanisms and the factual
 * evidence presently available for each one. It has no authority to create
 * income, close a month, mutate methodology, or execute capital actions.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __filename=fileURLToPath(import.meta.url);
const ROOT=path.resolve(path.dirname(__filename),'..');
const PRODUCTIVITY_FILE=process.env.PRODUCTIVITY_DATA_FILE||path.join(ROOT,'companies','productivity-data.json');
const INCOME_LEDGER_FILE=process.env.INCOME_LEDGER_FILE||path.join(ROOT,'reporting','income-ledger.json');
const EMBEDDED_FILE=process.env.EMBEDDED_YIELD_LEDGER_FILE||path.join(ROOT,'companies','embedded-yield-ledger.json');
const MONTHLY_FILE=process.env.COMPANY_MONTHLY_REPORTS_FILE||path.join(ROOT,'reporting','company-monthly-reports.json');
const OUTPUT_FILE=process.env.ACCOUNTING_COVERAGE_FILE||path.join(ROOT,'reporting','accounting-coverage.json');

const REGISTRY=Object.freeze({
  '05081966.eth':'001','YieldRing.eth':'002','dinaz.eth':'003','defitea.eth':'004',
  '0x5860...83CA8.eth':'005','aerocvxyb.eth':'006',"Rook's portfolio":'007',
  'Monetra.eth':'008','1milliondollar.eth':'009','Cypher':'010'
});

const ENGINE_CLASS=Object.freeze({
  aerodrome_veaero:{family:'accrued-entitlement',mechanism:'governance-rewards',accountingRouteHints:['aerodrome','relay','forty-acres']},
  velodrome_vevelo:{family:'accrued-entitlement',mechanism:'governance-rewards',accountingRouteHints:['velodrome','forty-acres']},
  convex_vlcvx:{family:'accrued-entitlement',mechanism:'governance-incentives',accountingRouteHints:['votium','union','vlcvx','convex']},
  curve_vecrv:{family:'accrued-entitlement',mechanism:'governance-fees',accountingRouteHints:['curve','vecrv','votemarket']},
  pendle_spendle:{family:'accrued-entitlement',mechanism:'governance-distribution',accountingRouteHints:['pendle','spendle']},
  fx_vefxn:{family:'accrued-entitlement',mechanism:'governance-rewards',accountingRouteHints:['fxn','vefxn','votemarket']},
  yieldbasis_veyb:{family:'accrued-entitlement',mechanism:'governance-rewards',accountingRouteHints:['yield-basis','yieldbasis','veyb']},
  frax_vefrax:{family:'accrued-entitlement',mechanism:'governance-rewards',accountingRouteHints:['frax','vefrax','wfrax']},
  venice_svvv:{family:'accrued-entitlement',mechanism:'staking-emissions',accountingRouteHints:['venice','svvv']},
  liquity_lqty:{family:'accrued-entitlement',mechanism:'staking-fees',accountingRouteHints:['liquity','lqty']},
  resupply_rsup:{family:'accrued-entitlement',mechanism:'staking-rewards',accountingRouteHints:['resupply','rsup']},
  icp_nns:{family:'accrued-entitlement',mechanism:'nns-voting-rewards',accountingRouteHints:['icp','nns']},
  beefy_cvxcrv:{family:'embedded-income',mechanism:'vault-ppfs-growth',accountingRouteHints:['beefy-cvxcrv','beefy']},
  yieldbasis_yblp_wbtc:{family:'embedded-income',mechanism:'lp-pps-growth',accountingRouteHints:['yieldbasis','yb-wbtc','wbtc']},
  yieldbasis_yblp_weth:{family:'embedded-income',mechanism:'lp-pps-growth',accountingRouteHints:['yieldbasis','yb-weth','weth']},
  'gmx-gm-eth-usdc':{family:'embedded-income',mechanism:'gm-nav-growth',accountingRouteHints:['gmx','gm-eth-usdc']},
  'gmx-gm-btc-usdc':{family:'embedded-income',mechanism:'gm-nav-growth',accountingRouteHints:['gmx','gm-btc-usdc']},
  'hyperlend-0xfd739d4e423301ce9385c1fb8850539d657c296d':{family:'embedded-income',mechanism:'lending-index-growth',accountingRouteHints:['hyperlend']},
  stakedao_base_curve_4pool:{family:'embedded-income',mechanism:'lp-wrapper-growth',accountingRouteHints:['stakedao','stake dao','4pool']},
  concentrator_asdcrv:{family:'embedded-income',mechanism:'wrapper-pps-growth',accountingRouteHints:['concentrator','asdcrv']},
  convex_staked_cvxcrv:{family:'accrued-entitlement',mechanism:'claimable-reward-stream',accountingRouteHints:['convex','cvxcrv']},
  'projectx-whype-usdc':{family:'accrued-entitlement',mechanism:'claimable-fees',accountingRouteHints:['projectx','project x','whype']}
});

const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
const lower=v=>String(v||'').trim().toLowerCase();
const monthKey=v=>{const t=Date.parse(v||'');return Number.isFinite(t)?new Date(t).toISOString().slice(0,7):null;};
const dayKey=v=>{const t=Date.parse(v||'');return Number.isFinite(t)?new Date(t).toISOString().slice(0,10):null;};
async function readJson(file){return JSON.parse(await fs.readFile(file,'utf8'));}
async function writeJson(file,data){await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,JSON.stringify(data,null,2)+'\n');}

function evidenceText(e){return [e?.route,e?.protocol,e?.asset,e?.sourceFamily,e?.sourceIdentity,e?.sourceFile].map(lower).join(' ');}
function routeMatches(e,hints){const text=evidenceText(e);return hints.some(h=>text.includes(lower(h)));}
function stateText(r){return [r?.route,r?.protocol,r?.chain,r?.token,r?.symbol,r?.routeKey].map(lower).join(' ');}
function stateMatches(r,hints){const text=stateText(r);return hints.some(h=>text.includes(lower(h)));}
function monthEvidence(events,company,hints,family,month){return events.filter(e=>e.company===company&&e.family===family&&monthKey(e.economicDate||e.periodEnd)===month&&routeMatches(e,hints));}
function companyMonths(monthly,name){return Object.keys(monthly?.companies?.[name]?.months||{}).sort();}
function productiveRows(productivity,name){return productivity?.companies?.[name]?.breakdown||[];}

function coverageStatus({events,stateRows,engineClass,engineId,company,month,monthlyRow}){
  const factual=monthEvidence(events,company,engineClass.accountingRouteHints,engineClass.family,month);
  const state=stateRows.filter(r=>stateMatches(r,engineClass.accountingRouteHints));
  const crossMonth=events.filter(e=>e.company===company&&e.family===engineClass.family&&routeMatches(e,engineClass.accountingRouteHints)&&monthKey(e.periodStart)!==monthKey(e.periodEnd));
  const explicitBeefy=engineId==='beefy_cvxcrv'&&factual.some(e=>e.sourceFile==='companies/company-009-beefy-cvxcrv-income.json');
  let status='reference-only-no-period-evidence';
  let evidenceLevel='none';
  if(factual.length){status='partial-factual-period-evidence';evidenceLevel='mechanism-specific';}
  else if(state.length){status='state-observed-not-period-income';evidenceLevel='state-only';}
  if(explicitBeefy){status='partial-factual-embedded-intervals';evidenceLevel='mechanism-specific';}
  const monthComplete=monthlyRow?.accountingCoverageComplete===true;
  return{
    status,evidenceLevel,
    factualEventCount:factual.length,
    factualValuedEventCount:factual.filter(e=>finite(e.usdValue)).length,
    factualUsdSubtotal:factual.length&&factual.every(e=>finite(e.usdValue))?Number(factual.reduce((s,e)=>s+Number(e.usdValue),0).toFixed(8)):null,
    currentStateRouteCount:state.length,
    crossMonthEvidenceCount:crossMonth.length,
    firstFactualEvidenceAt:factual.length?[...factual].map(e=>e.periodStart||e.economicDate).sort()[0]:null,
    lastFactualEvidenceAt:factual.length?[...factual].map(e=>e.periodEnd||e.economicDate).sort().at(-1):null,
    mechanismCompleteForMonth:false,
    companyMonthAccountingComplete:monthComplete,
    completionBlockers:[
      ...(factual.length===0?['no-canonical-period-income-evidence']:[]),
      ...(state.length>0&&factual.length===0?['current-state-is-not-period-income']:[]),
      ...(crossMonth.length>0?['cross-month-boundary-requires-explicit-allocation']:[]),
      ...(!engineClass?['unclassified-income-mechanism']:[])
    ]
  };
}

function monetaMechanisms(embedded){
  return Object.entries(embedded?.positions||{}).map(([positionId,p])=>({
    engineId:`monetra:${positionId}`,
    principalId:positionId,
    protocol:p?.protocol||null,
    value:null,
    engineStatus:p?.accounting?.embeddedYieldEligible===true?'ok':'unknown',
    class:{family:'embedded-income',mechanism:p?.incomeMode||'stable-embedded-yield',accountingRouteHints:[positionId,p?.protocol].filter(Boolean)}
  }));
}

function monetaCoverage(embedded,positionId,month,monthlyRow){
  const p=embedded?.positions?.[positionId]||{};
  const intervals=(p.intervalHistory||[]).filter(x=>x?.accepted===true&&x?.status==='ok'&&monthKey(x.startAt)===month&&monthKey(x.endAt)===month);
  const rejected=(p.intervalHistory||[]).filter(x=>monthKey(x.endAt)===month&&!(x?.accepted===true&&x?.status==='ok'));
  return{
    status:intervals.length?'partial-factual-embedded-intervals':'no-accepted-period-intervals',
    evidenceLevel:intervals.length?'canonical-accepted-interval':'none',
    factualEventCount:intervals.length,
    factualValuedEventCount:intervals.filter(x=>finite(x.incomeUsd)).length,
    factualUsdSubtotal:intervals.length&&intervals.every(x=>finite(x.incomeUsd))?Number(intervals.reduce((s,x)=>s+Number(x.incomeUsd),0).toFixed(8)):null,
    currentStateRouteCount:0,
    crossMonthEvidenceCount:(p.intervalHistory||[]).filter(x=>monthKey(x.startAt)!==monthKey(x.endAt)&&monthKey(x.endAt)===month).length,
    firstFactualEvidenceAt:intervals.length?intervals.map(x=>x.startAt).sort()[0]:null,
    lastFactualEvidenceAt:intervals.length?intervals.map(x=>x.endAt).sort().at(-1):null,
    mechanismCompleteForMonth:false,
    companyMonthAccountingComplete:monthlyRow?.accountingCoverageComplete===true,
    completionBlockers:[
      ...(intervals.length===0?['no-accepted-canonical-interval']:[]),
      ...(rejected.length?['rejected-or-reconciliation-needed-intervals-present']:[]),
      ...((p.trackingStartedAt||embedded?.trackingStartedAt||'').slice(0,7)===month&&dayKey(p.trackingStartedAt||embedded?.trackingStartedAt)!==`${month}-01`?['tracking-started-after-month-start']:[])
    ]
  };
}

function legacyArchive(name,month,monthlyRow){return name==='defitea.eth'&&month<='2026-07'&&monthlyRow?.accountingStatus==='complete-legacy-verified-realised';}

async function build(){
  const [productivity,ledger,embedded,monthly]=await Promise.all([
    readJson(PRODUCTIVITY_FILE),readJson(INCOME_LEDGER_FILE),readJson(EMBEDDED_FILE),readJson(MONTHLY_FILE)
  ]);
  if(ledger?.version!=='0.1-canonical-income-ledger')throw new Error('Canonical Income Ledger version mismatch');
  if(monthly?.version!=='0.3-company-monthly-earned-income-accounting')throw new Error('Monthly accounting version mismatch');
  if(ledger?.semantics?.referenceAprCanBackfillEarnedIncome!==false||ledger?.semantics?.unknownIsNotZero!==true)throw new Error('Canonical accounting epistemic contract invalid');
  const events=ledger.events||[];
  const companies={};
  for(const [name,registry] of Object.entries(REGISTRY).sort(([,a],[,b])=>a.localeCompare(b))){
    const months=companyMonths(monthly,name);
    const stateRows=ledger?.companies?.[name]?.currentClaimableState?.rows||[];
    const rawMechanisms=name==='Monetra.eth'?monetaMechanisms(embedded):productiveRows(productivity,name).map(r=>({
      engineId:r.engineId,principalId:r.principalId||null,protocol:productivity?.engines?.[r.engineId]?.protocol||null,
      valueUsd:finite(r.value)?Number(r.value):null,engineStatus:r.engineStatus||null,class:ENGINE_CLASS[r.engineId]||null
    }));
    const mechanismMap={};
    for(const m of rawMechanisms){
      const cls=m.class||{family:'unknown',mechanism:'unclassified',accountingRouteHints:[m.engineId,m.protocol].filter(Boolean)};
      const monthMap={};
      for(const month of months){
        const monthlyRow=monthly?.companies?.[name]?.months?.[month];
        monthMap[month]=name==='Monetra.eth'
          ? monetaCoverage(embedded,m.principalId,month,monthlyRow)
          : coverageStatus({events,stateRows,engineClass:cls,engineId:m.engineId,company:name,month,monthlyRow});
      }
      mechanismMap[m.engineId]={
        engineId:m.engineId,principalId:m.principalId||null,protocol:m.protocol||null,
        accountingFamily:cls.family,mechanismType:cls.mechanism,engineStatus:m.engineStatus||null,
        productiveValueUsd:m.valueUsd??null,
        referenceMetricIsAccountingAuthority:false,
        accountingRouteHints:cls.accountingRouteHints,
        months:monthMap
      };
    }
    const monthSummary={};
    for(const month of months){
      const row=monthly?.companies?.[name]?.months?.[month];
      const legacy=legacyArchive(name,month,row);
      const mechanismRows=Object.values(mechanismMap).map(m=>m.months[month]).filter(Boolean);
      const blockers=[...new Set(mechanismRows.flatMap(x=>x.completionBlockers||[]))];
      const factualMechanisms=mechanismRows.filter(x=>x.factualEventCount>0).length;
      monthSummary[month]={
        accountingStatus:row?.accountingStatus||null,
        accountingCoverageComplete:row?.accountingCoverageComplete===true,
        legacyVerifiedRealisedArchive:legacy,
        mechanismCount:mechanismRows.length,
        mechanismsWithFactualPeriodEvidence:factualMechanisms,
        mechanismsWithoutFactualPeriodEvidence:Math.max(0,mechanismRows.length-factualMechanisms),
        registryReadyToCloseMonth:legacy||false,
        registryCompletionAuthority:false,
        blockers:legacy?[]:[...blockers,...(mechanismRows.length===0?['no-mechanism-inventory']:[])]
      };
    }
    companies[name]={
      registry,name,
      mechanismInventorySource:name==='Monetra.eth'?'companies/embedded-yield-ledger.json':'companies/productivity-data.json',
      mechanismCount:Object.keys(mechanismMap).length,
      mechanisms:mechanismMap,
      months:monthSummary,
      executionAuthority:'none'
    };
  }
  const allMechanisms=Object.values(companies).flatMap(c=>Object.values(c.mechanisms));
  return{
    version:'0.1-accounting-mechanism-coverage-registry',
    generatedAt:new Date().toISOString(),
    status:'diagnostic-no-completion-authority',
    purpose:'Inventory every active productive income mechanism and expose factual accounting-evidence gaps before any month may be declared complete.',
    semantics:{productivityCoverageIsNotAccountingCoverage:true,referenceMetricIsNotEarnedIncome:true,currentRewardStateIsNotPeriodIncome:true,factualEvidenceDoesNotImplyFullMechanismCoverage:true,partialEvidenceDoesNotCloseMonth:true,unknownIsNotZero:true},
    completionPolicy:{registryHasMonthClosingAuthority:false,futureCompletionRequiresAllActiveMechanismsCovered:true,futureCompletionRequiresCanonicalValuation:true,futureCompletionRequiresNoUnallocatedCrossMonthIntervals:true,futureCompletionRequiresNoUnresolvedStateDiscontinuity:true,futureCompletionRequiresNoUnknownMechanism:true,defiteaLegacyVerifiedRealisedArchivePreserved:true},
    sources:{
      productivity:{file:'companies/productivity-data.json',version:productivity.version||null,generatedAt:productivity.generatedAt||null},
      incomeLedger:{file:'reporting/income-ledger.json',version:ledger.version||null,generatedAt:ledger.generatedAt||null},
      monetraEmbeddedYield:{file:'companies/embedded-yield-ledger.json',version:embedded.version||null,generatedAt:embedded.generatedAt||null},
      monthlyAccounting:{file:'reporting/company-monthly-reports.json',version:monthly.version||null,generatedAt:monthly.generatedAt||null}
    },
    summary:{
      companyCount:Object.keys(companies).length,
      mechanismCount:allMechanisms.length,
      classifiedMechanismCount:allMechanisms.filter(m=>m.accountingFamily!=='unknown').length,
      unclassifiedMechanismCount:allMechanisms.filter(m=>m.accountingFamily==='unknown').length,
      companiesWithAllMechanismsClassified:Object.values(companies).filter(c=>Object.values(c.mechanisms).every(m=>m.accountingFamily!=='unknown')).length
    },
    companies,
    authority:{executionAuthority:'none',walletAuthority:'none',capitalExecution:false,monthClosingAuthority:false,methodologyMutationAuthority:'none'}
  };
}

async function main(){const output=await build();await writeJson(OUTPUT_FILE,output);console.log('Accounting Coverage Registry built',output.summary);}
export{ENGINE_CLASS,build};
if(process.argv[1]&&path.resolve(process.argv[1])===__filename)main().catch(err=>{console.error(err);process.exitCode=1;});
