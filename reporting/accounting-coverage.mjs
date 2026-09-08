#!/usr/bin/env node
/**
 * The Holding · Accounting Coverage Registry v0.13
 *
 * Canonical facade over the v0.12 coverage core. v0.13 adds explicit
 * supplementary-route → principal isolation so a shared incentive platform
 * label (for example VoteMarket) cannot attribute one factual entitlement to
 * two productive principals. Canonical Income Ledger events are never mutated.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import * as core from './accounting-coverage-v012-core.mjs';

const __filename=fileURLToPath(import.meta.url);
const ROOT=path.resolve(path.dirname(__filename),'..');
const PRODUCTIVITY_FILE=process.env.PRODUCTIVITY_DATA_FILE||path.join(ROOT,'companies','productivity-data.json');
const INCOME_LEDGER_FILE=process.env.INCOME_LEDGER_FILE||path.join(ROOT,'reporting','income-ledger.json');
const EMBEDDED_FILE=process.env.EMBEDDED_YIELD_LEDGER_FILE||path.join(ROOT,'companies','embedded-yield-ledger.json');
const REWARDS_FILE=process.env.REWARDS_DATA_FILE||path.join(ROOT,'companies','rewards-data.json');
const VE33_EVIDENCE_FILE=process.env.VE33_EVIDENCE_FILE||path.join(ROOT,'reporting','ve33-accounting-evidence.json');
const VE33_LOCKED_MANAGED_EVIDENCE_FILE=process.env.VE33_LOCKED_MANAGED_EVIDENCE_FILE||path.join(ROOT,'reporting','ve33-locked-managed-accounting-evidence.json');
const YIELD_BASIS_EVIDENCE_FILE=process.env.YIELD_BASIS_EVIDENCE_FILE||path.join(ROOT,'reporting','yield-basis-accounting-evidence.json');
const FRAX_EVIDENCE_FILE=process.env.FRAX_EVIDENCE_FILE||path.join(ROOT,'reporting','frax-yield-accounting-evidence.json');
const ICP_NNS_STATE_FILE=process.env.ICP_NNS_STATE_FILE||path.join(ROOT,'companies','icp-nns-rewards-state.json');
const ICP_NNS_CONFIG_FILE=process.env.ICP_NNS_CONFIG_FILE||path.join(ROOT,'intelligence','icp-nns','company-005-006-neuron-pool.json');
const COMPANY_010_STATE_FILE=process.env.COMPANY_010_STATE_FILE||path.join(ROOT,'companies','company-010-production-state.json');
const OUTPUT_FILE=process.env.ACCOUNTING_COVERAGE_FILE||path.join(ROOT,'reporting','accounting-coverage.json');

export const VERSION='0.13-supplementary-route-principal-isolation-accounting-mechanism-coverage-registry';
export const COMPANY_ALIASES=core.COMPANY_ALIASES;
export const canonicalCompanyName=core.canonicalCompanyName;
export const ENGINE_CLASS=Object.freeze({
  ...core.ENGINE_CLASS,
  fx_vefxn:Object.freeze({...core.ENGINE_CLASS.fx_vefxn,hints:Object.freeze(['fxn','vefxn'])})
});
export const SUPPLEMENTARY_ROUTE_ENGINE=Object.freeze({
  'votemarket-vecrv':'curve_vecrv',
  'votemarket-vefxn':'fx_vefxn'
});

export const validateCanonicalLedgerContract=core.validateCanonicalLedgerContract;
export const discoverCompanies=core.discoverCompanies;
export const mechanismInventory=core.mechanismInventory;
export const icpNnsObservationProofs=core.icpNnsObservationProofs;
export const pendleSPendleObservationProofs=core.pendleSPendleObservationProofs;
export const veniceSVvvObservationProofs=core.veniceSVvvObservationProofs;
export const resupplyRsupObservationProofs=core.resupplyRsupObservationProofs;
export const liquityLqtyObservationProofs=core.liquityLqtyObservationProofs;
export const hyperlendKhypeObservationProofs=core.hyperlendKhypeObservationProofs;
export const projectXWhypeUsdcObservationProofs=core.projectXWhypeUsdcObservationProofs;
export const concentratorAsdCrvObservationProofs=core.concentratorAsdCrvObservationProofs;
export const gmxV2MarketObservationProofs=core.gmxV2MarketObservationProofs;
export const factualTrackingProofs=core.factualTrackingProofs;
export const explicitSettlementMechanismLinks=core.explicitSettlementMechanismLinks;

const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
const lower=v=>String(v||'').trim().toLowerCase();
const unique=values=>[...new Set((values||[]).filter(Boolean))];
const monthKey=v=>{const t=Date.parse(v||'');return Number.isFinite(t)?new Date(t).toISOString().slice(0,7):null;};
const eventText=e=>[e?.route,e?.protocol,e?.asset,e?.token,e?.sourceFamily,e?.sourceIdentity,e?.sourceFile,e?.mechanismKind].map(lower).join(' ');
const stateText=r=>[r?.route,r?.protocol,r?.asset,r?.token,r?.symbol,r?.routeKey,r?.source].map(lower).join(' ');
const textMatches=(text,hints)=>(hints||[]).some(h=>h&&text.includes(lower(h)));
const companyMatches=(raw,canonical)=>canonicalCompanyName(raw)===canonical;

function routeAllowsEngine(row,engineId){
  const bound=SUPPLEMENTARY_ROUTE_ENGINE[lower(row?.route)];
  return !bound||bound===engineId;
}
function eventMatches(e,engineId,mechanism){
  return routeAllowsEngine(e,engineId)&&e?.family===mechanism?.accountingFamily&&textMatches(eventText(e),mechanism?.accountingRouteHints);
}
function stateMatches(row,engineId,mechanism){
  return routeAllowsEngine(row,engineId)&&textMatches(stateText(row),mechanism?.accountingRouteHints);
}
function preferredCompanyKey(obj,canonical){
  const keys=Object.keys(obj||{}).filter(name=>companyMatches(name,canonical));
  return keys.includes(canonical)?canonical:(keys[0]||null);
}
function currentStateRows(ledger,company){
  const key=preferredCompanyKey(ledger?.companies,company);
  const rows=key?ledger?.companies?.[key]?.currentClaimableState?.rows:null;
  return Array.isArray(rows)?rows:[];
}
function normalizedHints(engineId,mechanism){
  const cls=ENGINE_CLASS[engineId];
  return cls?.hints?[...cls.hints]:(Array.isArray(mechanism?.accountingRouteHints)?mechanism.accountingRouteHints:[]);
}
function recomputeMonthRow({row,events,stateRows,company,engineId,mechanism,month}){
  mechanism.accountingRouteHints=normalizedHints(engineId,mechanism);
  const factual=events.filter(e=>companyMatches(e?.company,company)&&monthKey(e?.economicDate||e?.periodEnd)===month&&eventMatches(e,engineId,mechanism));
  const state=stateRows.filter(r=>stateMatches(r,engineId,mechanism));
  const allMechanismEvents=events.filter(e=>companyMatches(e?.company,company)&&eventMatches(e,engineId,mechanism));
  const crossMonth=allMechanismEvents.filter(e=>monthKey(e?.periodStart)&&monthKey(e?.periodEnd)&&monthKey(e.periodStart)!==monthKey(e.periodEnd)&&monthKey(e?.economicDate||e?.periodEnd)===month);
  const explicitMonth=/^\d{4}-(0[1-9]|1[0-2])$/;
  const explicitlyAttributed=crossMonth.filter(e=>explicitMonth.test(String(e?.periodAttributionMonth||''))&&e.periodAttributionMonth===month);
  const attributedKeys=new Set(explicitlyAttributed.map(e=>e?.eventKey||`${e?.periodStart}|${e?.periodEnd}|${e?.sourceIdentity||''}`));
  const unresolved=crossMonth.filter(e=>!attributedKeys.has(e?.eventKey||`${e?.periodStart}|${e?.periodEnd}|${e?.sourceIdentity||''}`));
  const valued=factual.filter(e=>finite(e?.usdValue));
  const proofCount=Number(row?.factualTrackingProofCount||0);
  const partialCount=Number(row?.factualTrackingPartialObservationCount||0);
  const factualTrackingActive=factual.length>0||proofCount>0;
  const status=factual.length?'factual-period-evidence':proofCount?'factual-tracking-no-period-event':state.length?'state-observed-not-factual-tracking':'reference-only-no-factual-tracking';
  const first=factual.map(e=>e?.periodStart||e?.economicDate||e?.periodEnd).filter(Boolean).sort()[0]||null;
  const last=factual.map(e=>e?.periodEnd||e?.economicDate).filter(Boolean).sort().at(-1)||null;
  const completionBlockers=unique([
    ...(factual.length?[]:['no-canonical-period-income-evidence']),
    ...(factualTrackingActive?[]:['no-factual-engine-tracking-proof']),
    ...(state.length&&!factualTrackingActive?['current-state-is-not-period-income']:[]),
    ...(partialCount?['current-source-observation-partial']:[]),
    ...(unresolved.length?['cross-month-boundary-requires-explicit-allocation']:[]),
    ...(mechanism?.classified===true?[]:['unclassified-income-mechanism'])
  ]);
  return{
    ...row,
    status,
    factualTrackingActive,
    factualEventCount:factual.length,
    factualValuedEventCount:valued.length,
    factualUsdSubtotal:factual.length&&valued.length===factual.length?Number(valued.reduce((sum,e)=>sum+Number(e.usdValue),0).toFixed(8)):null,
    currentStateRouteCount:state.length,
    crossMonthEvidenceCount:crossMonth.length,
    crossMonthExplicitlyAttributedCount:explicitlyAttributed.length,
    crossMonthUnresolvedCount:unresolved.length,
    firstFactualEvidenceAt:first,
    lastFactualEvidenceAt:last,
    mechanismCompleteForMonth:false,
    completionBlockers
  };
}
function rebuildCompanySummaries(output){
  for(const company of Object.values(output?.companies||{})){
    const current=company?.currentMonth||output.currentMonth;
    const rows=Object.values(company?.mechanisms||{}).map(m=>m?.months?.[current]).filter(Boolean);
    company.currentMonthFactualTrackingMechanismCount=rows.filter(x=>x.factualTrackingActive===true).length;
    company.currentMonthFactualEventMechanismCount=rows.filter(x=>Number(x.factualEventCount||0)>0).length;
    company.currentMonthFactualMechanismCount=company.currentMonthFactualTrackingMechanismCount;
    company.currentMonthPartialObservationMechanismCount=rows.filter(x=>Number(x.factualTrackingPartialObservationCount||0)>0).length;
    company.currentMonthStateOnlyMechanismCount=rows.filter(x=>x.status==='state-observed-not-factual-tracking').length;
    company.currentMonthReferenceOnlyMechanismCount=rows.filter(x=>x.status==='reference-only-no-factual-tracking').length;
  }
}
function rebuildMechanismAggregates(output){
  for(const [engineId,aggregate] of Object.entries(output?.mechanisms||{})){
    const entries=Object.entries(output?.companies||{}).map(([name,c])=>({name,mechanism:c?.mechanisms?.[engineId]})).filter(x=>x.mechanism);
    const current=entries.map(x=>({name:x.name,row:x.mechanism?.months?.[output.currentMonth]})).filter(x=>x.row);
    const tracking=current.filter(x=>x.row.factualTrackingActive===true).map(x=>x.name).sort();
    const factual=current.filter(x=>Number(x.row.factualEventCount||0)>0).map(x=>x.name).sort();
    const stateOnly=current.filter(x=>x.row.status==='state-observed-not-factual-tracking').map(x=>x.name).sort();
    const referenceOnly=current.filter(x=>x.row.status==='reference-only-no-factual-tracking').map(x=>x.name).sort();
    aggregate.factualTrackingCompanyCount=tracking.length;
    aggregate.factualTrackingCompanies=tracking;
    aggregate.factualEventCompanyCount=factual.length;
    aggregate.factualEventCompanies=factual;
    aggregate.factualCompanyCount=tracking.length;
    aggregate.factualCompanies=tracking;
    aggregate.stateOnlyCompanyCount=stateOnly.length;
    aggregate.stateOnlyCompanies=stateOnly;
    aggregate.referenceOnlyCompanyCount=referenceOnly.length;
    aggregate.referenceOnlyCompanies=referenceOnly;
    aggregate.currentMonthFactualEventCount=current.reduce((sum,x)=>sum+Number(x.row.factualEventCount||0),0);
    aggregate.currentMonthFactualUsdSubtotal=current.length&&current.every(x=>Number(x.row.factualEventCount||0)===0||finite(x.row.factualUsdSubtotal))?Number(current.reduce((sum,x)=>sum+Number(x.row.factualUsdSubtotal||0),0).toFixed(8)):null;
    aggregate.currentMonthPartialObservationCompanyCount=current.filter(x=>Number(x.row.factualTrackingPartialObservationCount||0)>0).length;
    aggregate.reusableCoverageGap=tracking.length<Number(aggregate.activeCompanyCount||entries.length);
  }
}
function rebuildGapRanking(output){
  output.gapRanking=Object.values(output?.mechanisms||{}).filter(x=>x.reusableCoverageGap).sort((a,b)=>b.activeCompanyCount-a.activeCompanyCount||(Number(b.knownProductiveValueUsdTotal||0)-Number(a.knownProductiveValueUsdTotal||0))||a.engineId.localeCompare(b.engineId)).map((x,index)=>({rank:index+1,engineId:x.engineId,activeCompanyCount:x.activeCompanyCount,knownProductiveValueUsdTotal:x.knownProductiveValueUsdTotal,factualTrackingCompanyCount:x.factualTrackingCompanyCount,factualEventCompanyCount:x.factualEventCompanyCount,factualCompanyCount:x.factualCompanyCount,stateOnlyCompanyCount:x.stateOnlyCompanyCount,referenceOnlyCompanyCount:x.referenceOnlyCompanyCount}));
}
function rebuildUnmatched(output,events){
  const linked=new Set((output?.settlementMechanismLinks||[]).map(x=>x.eventKey));
  const unmatched=[];
  for(const e of events){
    if(linked.has(e?.eventKey))continue;
    const company=canonicalCompanyName(e?.company);
    const mechanisms=Object.values(output?.companies?.[company]?.mechanisms||{});
    if(mechanisms.some(m=>eventMatches(e,m.engineId,m)))continue;
    unmatched.push(e);
  }
  output.unmatchedCanonicalEvents=unmatched.slice(0,50).map(e=>({eventKey:e?.eventKey||null,company:canonicalCompanyName(e?.company)||null,sourceCompany:e?.company||null,family:e?.family||null,protocol:e?.protocol||null,route:e?.route||null,sourceFile:e?.sourceFile||null}));
  output.summary.unmatchedCanonicalEventCount=unmatched.length;
}

export function applySupplementaryRoutePrincipalIsolation(output,ledger={}){
  const events=Array.isArray(ledger?.events)?ledger.events:[];
  for(const [companyName,company] of Object.entries(output?.companies||{})){
    const stateRows=currentStateRows(ledger,companyName);
    for(const [engineId,mechanism] of Object.entries(company?.mechanisms||{})){
      mechanism.accountingRouteHints=normalizedHints(engineId,mechanism);
      for(const [month,row] of Object.entries(mechanism?.months||{})){
        mechanism.months[month]=recomputeMonthRow({row,events,stateRows,company:companyName,engineId,mechanism,month});
      }
    }
  }
  rebuildCompanySummaries(output);
  rebuildMechanismAggregates(output);
  rebuildGapRanking(output);
  rebuildUnmatched(output,events);
  output.version=VERSION;
  output.semantics={
    ...(output.semantics||{}),
    supplementaryRoutePrincipalIsolation:true,
    genericSupplementaryRouteHintCannotCrossPrincipal:true,
    supplementaryPlatformLabelDoesNotCreatePrincipalIdentity:true
  };
  output.summary.reusableCoverageGapCount=output.gapRanking.length;
  output.summary.currentMonthPartialObservationMechanismCount=Object.values(output?.companies||{}).reduce((sum,c)=>sum+Number(c.currentMonthPartialObservationMechanismCount||0),0);
  return output;
}

export function buildAccountingCoverage(args={}){
  const output=core.buildAccountingCoverage(args);
  return applySupplementaryRoutePrincipalIsolation(output,args?.ledger||{});
}

async function readJson(file){return JSON.parse(await fs.readFile(file,'utf8'));}
async function readOptionalJson(file){try{return await readJson(file);}catch(error){if(error?.code==='ENOENT')return{};throw error;}}
async function writeJson(file,data){await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,JSON.stringify(data,null,2)+'\n');}

async function main(){
  const[productivity,ledger,embedded,rewards,ve33,ve33LockedManaged,yieldBasis,frax,icpNnsState,icpNnsConfig,company010State]=await Promise.all([
    readJson(PRODUCTIVITY_FILE),readJson(INCOME_LEDGER_FILE),readJson(EMBEDDED_FILE),readOptionalJson(REWARDS_FILE),readOptionalJson(VE33_EVIDENCE_FILE),readOptionalJson(VE33_LOCKED_MANAGED_EVIDENCE_FILE),readOptionalJson(YIELD_BASIS_EVIDENCE_FILE),readOptionalJson(FRAX_EVIDENCE_FILE),readOptionalJson(ICP_NNS_STATE_FILE),readOptionalJson(ICP_NNS_CONFIG_FILE),readOptionalJson(COMPANY_010_STATE_FILE)
  ]);
  const output=buildAccountingCoverage({productivity,ledger,embedded,factualEvidence:{rewards,ve33,ve33LockedManaged,yieldBasis,frax,icpNnsState,icpNnsConfig,company010State}});
  await writeJson(OUTPUT_FILE,output);
  console.log('Accounting Coverage Registry v0.13 built',{companies:output.summary.companyCount,mechanismInstances:output.summary.mechanismInstanceCount,uniqueMechanisms:output.summary.uniqueMechanismCount,coverageGaps:output.summary.reusableCoverageGapCount,partialObservationMechanisms:output.summary.currentMonthPartialObservationMechanismCount,settlementLinks:output.summary.settlementLinkedCanonicalEventCount,unclassified:output.summary.unclassifiedMechanismInstanceCount,unmatchedLedgerEvents:output.summary.unmatchedCanonicalEventCount,canonicalizedAliasCompanies:output.summary.canonicalizedAliasCompanyCount,factualTrackingProofs:output.summary.factualTrackingProofCount,currentMonth:output.currentMonth,executionAuthority:output.authority.executionAuthority,supplementaryRoutePrincipalIsolation:true});
}

if(process.argv[1]&&path.resolve(process.argv[1])===__filename)main().catch(error=>{console.error(error);process.exitCode=1;});
