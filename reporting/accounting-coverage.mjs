#!/usr/bin/env node
/**
 * The Holding · Accounting Coverage Registry v0.2
 *
 * Diagnostic machine map of productive mechanisms versus canonical factual
 * accounting coverage. This layer discovers companies dynamically and treats
 * the Canonical Income Ledger as the sole factual earned-income authority.
 * Productivity/reference metrics and current reward state are inventory/state,
 * never period-income evidence by themselves.
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
const OUTPUT_FILE=process.env.ACCOUNTING_COVERAGE_FILE||path.join(ROOT,'reporting','accounting-coverage.json');

export const VERSION='0.2-dynamic-accounting-mechanism-coverage-registry';

// Stable identity is not the display string. Historical aliases are folded into
// the current canonical company name before discovery/coverage so a rename can
// never manufacture a phantom company. Add aliases only when the identity link
// is proven by registry/wallet provenance; unknown names remain separate.
export const COMPANY_ALIASES=Object.freeze({
  'aerocrvyb.eth':'aerocvxyb.eth'
});
export function canonicalCompanyName(name){
  const raw=String(name||'').trim();
  if(!raw)return'';
  return COMPANY_ALIASES[raw]||raw;
}

export const ENGINE_CLASS=Object.freeze({
  aerodrome_veaero:{family:'accrued-entitlement',mechanism:'governance-rewards',hints:['aerodrome','veaero','forty-acres','relay']},
  velodrome_vevelo:{family:'accrued-entitlement',mechanism:'governance-rewards',hints:['velodrome','vevelo','forty-acres']},
  convex_vlcvx:{family:'accrued-entitlement',mechanism:'governance-incentives',hints:['votium','union','vlcvx','convex']},
  curve_vecrv:{family:'accrued-entitlement',mechanism:'governance-fees',hints:['curve','vecrv','crvusd']},
  pendle_spendle:{family:'accrued-entitlement',mechanism:'governance-distribution',hints:['pendle','spendle']},
  fx_vefxn:{family:'accrued-entitlement',mechanism:'governance-rewards',hints:['fxn','vefxn','votemarket']},
  yieldbasis_veyb:{family:'accrued-entitlement',mechanism:'governance-fees',hints:['yield-basis','yieldbasis','veyb']},
  frax_vefrax:{family:'accrued-entitlement',mechanism:'governance-rewards',hints:['frax','vefrax','wfrax','yielddistributor']},
  venice_svvv:{family:'accrued-entitlement',mechanism:'staking-emissions',hints:['venice','svvv']},
  liquity_lqty:{family:'accrued-entitlement',mechanism:'staking-fees',hints:['liquity','lqty']},
  resupply_rsup:{family:'accrued-entitlement',mechanism:'staking-rewards',hints:['resupply','rsup']},
  icp_nns:{family:'accrued-entitlement',mechanism:'nns-voting-rewards',hints:['icp','nns']},
  beefy_cvxcrv:{family:'embedded-income',mechanism:'vault-ppfs-growth',hints:['beefy-cvxcrv','beefy','cvxcrv']},
  yieldbasis_yblp_wbtc:{family:'embedded-income',mechanism:'lp-pps-growth',hints:['yieldbasis','yb-wbtc','ybwbtc','wbtc']},
  yieldbasis_yblp_weth:{family:'embedded-income',mechanism:'lp-pps-growth',hints:['yieldbasis','yb-weth','ybweth','weth']},
  'gmx-gm-eth-usdc':{family:'embedded-income',mechanism:'gm-nav-growth',hints:['gmx','gm-eth-usdc']},
  'gmx-gm-btc-usdc':{family:'embedded-income',mechanism:'gm-nav-growth',hints:['gmx','gm-btc-usdc']},
  'hyperlend-0xfd739d4e423301ce9385c1fb8850539d657c296d':{family:'embedded-income',mechanism:'lending-index-growth',hints:['hyperlend']},
  stakedao_base_curve_4pool:{family:'embedded-income',mechanism:'lp-wrapper-growth',hints:['stakedao','stake dao','4pool']},
  concentrator_asdcrv:{family:'embedded-income',mechanism:'wrapper-pps-growth',hints:['concentrator','asdcrv']},
  convex_staked_cvxcrv:{family:'accrued-entitlement',mechanism:'claimable-reward-stream',hints:['convex','staked-cvxcrv','cvxcrv']},
  'projectx-whype-usdc':{family:'accrued-entitlement',mechanism:'claimable-fees',hints:['projectx','project x','whype']}
});

const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
const lower=v=>String(v||'').trim().toLowerCase();
const monthKey=v=>{const t=Date.parse(v||'');return Number.isFinite(t)?new Date(t).toISOString().slice(0,7):null;};
const unique=values=>[...new Set((values||[]).filter(Boolean))];
const sumKnown=values=>{const rows=(values||[]).filter(finite).map(Number);return rows.length?Number(rows.reduce((a,b)=>a+b,0).toFixed(8)):null;};
async function readJson(file){return JSON.parse(await fs.readFile(file,'utf8'));}
async function writeJson(file,data){await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,JSON.stringify(data,null,2)+'\n');}

function eventText(e){return [e?.route,e?.protocol,e?.asset,e?.token,e?.sourceFamily,e?.sourceIdentity,e?.sourceFile,e?.mechanismKind].map(lower).join(' ');}
function stateText(r){return [r?.route,r?.protocol,r?.asset,r?.token,r?.symbol,r?.routeKey,r?.source].map(lower).join(' ');}
function textMatches(text,hints){return (hints||[]).some(h=>h&&text.includes(lower(h)));}
function eventMatches(e,cls){return e?.family===cls.family&&textMatches(eventText(e),cls.hints);}
function stateMatches(r,cls){return textMatches(stateText(r),cls.hints);}
function companyMatches(raw,canonical){return canonicalCompanyName(raw)===canonical;}
function matchingCompanyKeys(obj,canonical){return Object.keys(obj||{}).filter(name=>companyMatches(name,canonical));}
function preferredCompanyKey(obj,canonical){
  const keys=matchingCompanyKeys(obj,canonical);
  if(keys.includes(canonical))return canonical;
  return keys[0]||null;
}
function companySourceAliases({productivity={},ledger={},embedded={},name}){
  const aliases=[...matchingCompanyKeys(productivity?.companies,name),...matchingCompanyKeys(ledger?.companies,name)];
  if(embedded?.company?.name&&companyMatches(embedded.company.name,name))aliases.push(embedded.company.name);
  return unique(aliases).sort();
}

export function validateCanonicalLedgerContract(ledger){
  if(!ledger||typeof ledger!=='object')throw new Error('Canonical Income Ledger missing');
  if(!Array.isArray(ledger.events))throw new Error('Canonical Income Ledger events missing');
  if(ledger?.semantics?.referenceAprCanBackfillEarnedIncome!==false)throw new Error('Reference APR regained earned-income authority');
  if(ledger?.semantics?.unknownIsNotZero!==true)throw new Error('Canonical Ledger lost unknown-is-not-zero epistemic contract');
  if(ledger?.authority?.executionAuthority!=='none')throw new Error('Canonical Ledger execution authority expanded');
  if(ledger?.authority?.capitalExecution!==false)throw new Error('Canonical Ledger capital authority expanded');
  return true;
}

export function discoverCompanies({productivity={},ledger={},embedded={}}={}){
  const raw=[...Object.keys(productivity?.companies||{}),...Object.keys(ledger?.companies||{})];
  if(embedded?.company?.name)raw.push(embedded.company.name);
  return unique(raw.map(canonicalCompanyName)).filter(Boolean).sort((a,b)=>a.localeCompare(b));
}

function productiveRows(productivity,name){
  const key=preferredCompanyKey(productivity?.companies,name);
  const rows=key?productivity?.companies?.[key]?.breakdown:null;
  return Array.isArray(rows)?rows:[];
}

function productiveValue(row){
  for(const key of ['value','valueUsd','productiveValueUsd','productiveValue'])if(finite(row?.[key]))return Number(row[key]);
  return null;
}

function classForEngine(engineId,protocol=null){
  const known=ENGINE_CLASS[engineId];
  if(known)return{...known,classified:true};
  return{family:'unknown',mechanism:'unclassified',hints:unique([engineId,protocol]),classified:false};
}

function embeddedMechanisms(embedded,name){
  if(!companyMatches(embedded?.company?.name,name))return[];
  return Object.entries(embedded?.positions||{}).map(([positionId,p])=>{
    const checkpoints=Array.isArray(p?.checkpoints)?p.checkpoints:[];
    const last=[...checkpoints].sort((a,b)=>String(a?.timestamp||'').localeCompare(String(b?.timestamp||''))).at(-1);
    return{
      engineId:`embedded:${positionId}`,
      principalId:positionId,
      protocol:p?.protocol||null,
      engineStatus:p?.accounting?.embeddedYieldEligible===true?'ok':'unknown',
      productiveValueUsd:finite(last?.economicValueUsd)?Number(last.economicValueUsd):null,
      class:{family:'embedded-income',mechanism:p?.incomeMode||'embedded-yield',hints:unique([positionId,p?.protocol,p?.chain]),classified:true},
      inventorySource:'companies/embedded-yield-ledger.json'
    };
  });
}

export function mechanismInventory({productivity={},embedded={},company}={}){
  const rows=productiveRows(productivity,company).map(row=>{
    const engineId=String(row?.engineId||'').trim();
    const protocol=productivity?.engines?.[engineId]?.protocol||row?.protocol||null;
    return{
      engineId,principalId:row?.principalId||null,protocol,engineStatus:row?.engineStatus||null,
      productiveValueUsd:productiveValue(row),class:classForEngine(engineId,protocol),
      inventorySource:'companies/productivity-data.json'
    };
  }).filter(x=>x.engineId);
  rows.push(...embeddedMechanisms(embedded,company));
  const map=new Map();
  for(const row of rows){
    if(!map.has(row.engineId)){map.set(row.engineId,row);continue;}
    const prior=map.get(row.engineId);
    map.set(row.engineId,{...prior,...row,productiveValueUsd:finite(row.productiveValueUsd)?row.productiveValueUsd:prior.productiveValueUsd});
  }
  return [...map.values()].sort((a,b)=>a.engineId.localeCompare(b.engineId));
}

function currentStateRows(ledger,name){
  const key=preferredCompanyKey(ledger?.companies,name);
  const rows=key?ledger?.companies?.[key]?.currentClaimableState?.rows:null;
  return Array.isArray(rows)?rows:[];
}

function companyEventMonths(events,name){
  const out=[];
  for(const e of events){
    if(!companyMatches(e?.company,name))continue;
    out.push(monthKey(e?.economicDate||e?.periodEnd),monthKey(e?.periodStart),monthKey(e?.periodEnd));
  }
  return unique(out).sort();
}

function companyMonths({productivity,ledger,embedded,name,asOfMonth}){
  const productivityKey=preferredCompanyKey(productivity?.companies,name);
  const out=[asOfMonth,monthKey(productivityKey?productivity?.companies?.[productivityKey]?.trackingStartedAt:null)];
  out.push(...companyEventMonths(ledger?.events||[],name));
  if(companyMatches(embedded?.company?.name,name)){
    out.push(monthKey(embedded?.trackingStartedAt));
    for(const p of Object.values(embedded?.positions||{})){
      out.push(monthKey(p?.trackingStartedAt));
      for(const row of p?.intervalHistory||[])out.push(monthKey(row?.startAt),monthKey(row?.endAt));
    }
  }
  return unique(out).sort();
}

function mechanismCoverage({events,stateRows,company,cls,month}){
  const factual=events.filter(e=>companyMatches(e?.company,company)&&monthKey(e?.economicDate||e?.periodEnd)===month&&eventMatches(e,cls));
  const state=stateRows.filter(r=>stateMatches(r,cls));
  const allMechanismEvents=events.filter(e=>companyMatches(e?.company,company)&&eventMatches(e,cls));
  const crossMonth=allMechanismEvents.filter(e=>monthKey(e?.periodStart)&&monthKey(e?.periodEnd)&&monthKey(e.periodStart)!==monthKey(e.periodEnd)&&monthKey(e?.economicDate||e?.periodEnd)===month);
  const valued=factual.filter(e=>finite(e?.usdValue));
  const status=factual.length?'factual-period-evidence':state.length?'state-observed-not-period-income':'reference-only-no-period-evidence';
  return{
    status,
    factualEventCount:factual.length,
    factualValuedEventCount:valued.length,
    factualUsdSubtotal:factual.length&&valued.length===factual.length?Number(valued.reduce((s,e)=>s+Number(e.usdValue),0).toFixed(8)):null,
    currentStateRouteCount:state.length,
    crossMonthEvidenceCount:crossMonth.length,
    firstFactualEvidenceAt:factual.length?factual.map(e=>e?.periodStart||e?.economicDate||e?.periodEnd).filter(Boolean).sort()[0]||null:null,
    lastFactualEvidenceAt:factual.length?factual.map(e=>e?.periodEnd||e?.economicDate).filter(Boolean).sort().at(-1)||null:null,
    mechanismCompleteForMonth:false,
    completionBlockers:unique([
      ...(factual.length?[]:['no-canonical-period-income-evidence']),
      ...(state.length&&!factual.length?['current-state-is-not-period-income']:[]),
      ...(crossMonth.length?['cross-month-boundary-requires-explicit-allocation']:[]),
      ...(cls.classified?[]:['unclassified-income-mechanism'])
    ])
  };
}

function registryIdentity({productivity,ledger,embedded,name}){
  const pKey=preferredCompanyKey(productivity?.companies,name),lKey=preferredCompanyKey(ledger?.companies,name);
  const candidates=[
    lKey?ledger?.companies?.[lKey]?.registry:null,
    pKey?productivity?.companies?.[pKey]?.registry:null,
    companyMatches(embedded?.company?.name,name)?embedded?.company?.registry:null
  ].filter(v=>v!==null&&v!==undefined&&v!=='');
  return candidates.length?String(candidates[0]):null;
}

function mechanismAggregate(engineId,rows,currentMonth){
  const companies=rows.map(x=>x.company).sort();
  const current=rows.map(x=>x.mechanism?.months?.[currentMonth]).filter(Boolean);
  const factualCompanies=rows.filter(x=>(x.mechanism?.months?.[currentMonth]?.factualEventCount||0)>0).map(x=>x.company).sort();
  const stateOnlyCompanies=rows.filter(x=>x.mechanism?.months?.[currentMonth]?.status==='state-observed-not-period-income').map(x=>x.company).sort();
  const referenceOnlyCompanies=rows.filter(x=>x.mechanism?.months?.[currentMonth]?.status==='reference-only-no-period-evidence').map(x=>x.company).sort();
  const sample=rows[0]?.mechanism||{};
  return{
    engineId,
    accountingFamily:sample.accountingFamily||'unknown',
    mechanismType:sample.mechanismType||'unclassified',
    protocols:unique(rows.map(x=>x.mechanism?.protocol)).sort(),
    activeCompanyCount:companies.length,
    companies,
    knownProductiveValueUsdTotal:sumKnown(rows.map(x=>x.mechanism?.productiveValueUsd)),
    knownProductiveValueCompanyCount:rows.filter(x=>finite(x.mechanism?.productiveValueUsd)).length,
    factualCompanyCount:factualCompanies.length,
    factualCompanies,
    stateOnlyCompanyCount:stateOnlyCompanies.length,
    stateOnlyCompanies,
    referenceOnlyCompanyCount:referenceOnlyCompanies.length,
    referenceOnlyCompanies,
    currentMonthFactualEventCount:current.reduce((s,x)=>s+Number(x?.factualEventCount||0),0),
    currentMonthFactualUsdSubtotal:current.length&&current.every(x=>x.factualEventCount===0||finite(x.factualUsdSubtotal))?Number(current.reduce((s,x)=>s+Number(x?.factualUsdSubtotal||0),0).toFixed(8)):null,
    reusableCoverageGap:factualCompanies.length<companies.length,
    referenceMetricIsAccountingAuthority:false,
    completionAuthority:false
  };
}

function unmatchedEvents(events,mechanismRows){
  const known=mechanismRows.map(x=>({company:x.company,cls:{family:x.mechanism.accountingFamily,hints:x.mechanism.accountingRouteHints}}));
  return events.filter(e=>!known.some(k=>companyMatches(e?.company,k.company)&&eventMatches(e,k.cls)));
}

export function buildAccountingCoverage({productivity={},ledger={},embedded={},generatedAt=null}={}){
  validateCanonicalLedgerContract(ledger);
  const sourceTimes=[generatedAt,ledger?.generatedAt,productivity?.generatedAt,embedded?.generatedAt].filter(Boolean).sort();
  const at=sourceTimes.at(-1)||new Date().toISOString();
  const currentMonth=monthKey(at)||new Date().toISOString().slice(0,7);
  const events=ledger.events||[];
  const companyNames=discoverCompanies({productivity,ledger,embedded});
  const companies={};
  const flat=[];

  for(const name of companyNames){
    const months=companyMonths({productivity,ledger,embedded,name,asOfMonth:currentMonth});
    const stateRows=currentStateRows(ledger,name);
    const mechanisms={};
    for(const item of mechanismInventory({productivity,embedded,company:name})){
      const monthMap={};
      for(const month of months)monthMap[month]=mechanismCoverage({events,stateRows,company:name,cls:item.class,month});
      mechanisms[item.engineId]={
        engineId:item.engineId,principalId:item.principalId,protocol:item.protocol,
        accountingFamily:item.class.family,mechanismType:item.class.mechanism,classified:item.class.classified,
        engineStatus:item.engineStatus,productiveValueUsd:item.productiveValueUsd,
        inventorySource:item.inventorySource,referenceMetricIsAccountingAuthority:false,
        accountingRouteHints:item.class.hints,months:monthMap
      };
    }
    const rows=Object.values(mechanisms);
    const currentRows=rows.map(x=>x.months[currentMonth]).filter(Boolean);
    const sourceAliases=companySourceAliases({productivity,ledger,embedded,name});
    companies[name]={
      name,registry:registryIdentity({productivity,ledger,embedded,name}),
      discoveredDynamically:true,canonicalIdentityApplied:true,sourceAliases,
      mechanismInventorySource:unique(rows.map(x=>x.inventorySource)).sort(),
      mechanismCount:rows.length,knownProductiveValueUsdTotal:sumKnown(rows.map(x=>x.productiveValueUsd)),
      currentMonth,
      currentMonthFactualMechanismCount:currentRows.filter(x=>x.factualEventCount>0).length,
      currentMonthStateOnlyMechanismCount:currentRows.filter(x=>x.status==='state-observed-not-period-income').length,
      currentMonthReferenceOnlyMechanismCount:currentRows.filter(x=>x.status==='reference-only-no-period-evidence').length,
      executionAuthority:'none',mechanisms
    };
    for(const mechanism of rows)flat.push({company:name,mechanism});
  }

  const mechanismIds=unique(flat.map(x=>x.mechanism.engineId)).sort();
  const mechanisms={};
  for(const engineId of mechanismIds)mechanisms[engineId]=mechanismAggregate(engineId,flat.filter(x=>x.mechanism.engineId===engineId),currentMonth);
  const unmatched=unmatchedEvents(events,flat);
  const unclassified=flat.filter(x=>x.mechanism.classified!==true);
  const gaps=Object.values(mechanisms)
    .filter(x=>x.reusableCoverageGap)
    .sort((a,b)=>b.activeCompanyCount-a.activeCompanyCount||(Number(b.knownProductiveValueUsdTotal||0)-Number(a.knownProductiveValueUsdTotal||0))||a.engineId.localeCompare(b.engineId))
    .map((x,index)=>({rank:index+1,engineId:x.engineId,activeCompanyCount:x.activeCompanyCount,knownProductiveValueUsdTotal:x.knownProductiveValueUsdTotal,factualCompanyCount:x.factualCompanyCount,stateOnlyCompanyCount:x.stateOnlyCompanyCount,referenceOnlyCompanyCount:x.referenceOnlyCompanyCount}));
  const aliasObservations=Object.values(companies).filter(c=>(c.sourceAliases||[]).some(x=>x!==c.name)).map(c=>({canonicalName:c.name,sourceAliases:c.sourceAliases}));

  return{
    version:VERSION,generatedAt:at,status:'diagnostic-no-completion-authority',currentMonth,
    sourceFreshness:{productivityGeneratedAt:productivity?.generatedAt||null,incomeLedgerGeneratedAt:ledger?.generatedAt||null,embeddedYieldGeneratedAt:embedded?.generatedAt||null},
    semantics:{
      canonicalLedgerIsSoleFactualIncomeAuthority:true,productivityCoverageIsNotAccountingCoverage:true,
      referenceMetricIsNotEarnedIncome:true,currentRewardStateIsNotPeriodIncome:true,
      factualEvidenceDoesNotImplyFullMechanismCoverage:true,partialEvidenceDoesNotCloseMonth:true,
      unknownIsNotZero:true,newCompanyDoesNotRequireNewAccountingEngineWhenMechanismAlreadySupported:true,
      unclassifiedMechanismIsVisibleGapNotZero:true,historicalCompanyAliasesCanonicalized:true,
      stringAliasCannotCreateNewCompanyIdentity:true
    },
    completionPolicy:{registryHasMonthClosingAuthority:false,registryHasIncomeCreationAuthority:false,coverageGapRankingIsDiagnosticOnly:true},
    authority:{executionAuthority:'none',walletAuthority:'none',claimingAuthority:'none',capitalExecution:false,monthClosingAuthority:false,methodologyMutationAuthority:'none'},
    summary:{
      companyCount:companyNames.length,mechanismInstanceCount:flat.length,uniqueMechanismCount:mechanismIds.length,
      classifiedMechanismInstanceCount:flat.length-unclassified.length,unclassifiedMechanismInstanceCount:unclassified.length,
      reusableCoverageGapCount:gaps.length,canonicalLedgerEventCount:events.length,unmatchedCanonicalEventCount:unmatched.length,
      canonicalizedAliasCompanyCount:aliasObservations.length
    },
    companyIdentityAliases:aliasObservations,
    gapRanking:gaps,
    unmatchedCanonicalEvents:unmatched.slice(0,50).map(e=>({eventKey:e?.eventKey||null,company:canonicalCompanyName(e?.company)||null,sourceCompany:e?.company||null,family:e?.family||null,protocol:e?.protocol||null,route:e?.route||null,sourceFile:e?.sourceFile||null})),
    mechanisms,companies
  };
}

async function main(){
  const[productivity,ledger,embedded]=await Promise.all([readJson(PRODUCTIVITY_FILE),readJson(INCOME_LEDGER_FILE),readJson(EMBEDDED_FILE)]);
  const output=buildAccountingCoverage({productivity,ledger,embedded});
  await writeJson(OUTPUT_FILE,output);
  console.log('Accounting Coverage Registry v0.2 built',{
    companies:output.summary.companyCount,mechanismInstances:output.summary.mechanismInstanceCount,
    uniqueMechanisms:output.summary.uniqueMechanismCount,coverageGaps:output.summary.reusableCoverageGapCount,
    unclassified:output.summary.unclassifiedMechanismInstanceCount,unmatchedLedgerEvents:output.summary.unmatchedCanonicalEventCount,
    canonicalizedAliasCompanies:output.summary.canonicalizedAliasCompanyCount,
    currentMonth:output.currentMonth,executionAuthority:output.authority.executionAuthority,
    topReusableGaps:output.gapRanking.slice(0,10)
  });
}

if(process.argv[1]&&path.resolve(process.argv[1])===__filename)main().catch(error=>{console.error(error);process.exitCode=1;});
