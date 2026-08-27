#!/usr/bin/env node
/**
 * The Holding · Canonical Income Ledger v0.1
 *
 * Durable append-only evidence ledger. Reference productivity, current
 * claimable state, accrued entitlement, realised cash flow, embedded income
 * and market performance remain distinct economic families.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename=fileURLToPath(import.meta.url);
const __dirname=path.dirname(__filename);
const ROOT=path.resolve(__dirname,'..');

const POLICY_FILE=process.env.INCOME_LEDGER_POLICY_FILE||path.join(ROOT,'reporting','income-ledger-policy.json');
const REPORTING_FILE=process.env.REPORTING_DATA_FILE||path.join(ROOT,'reporting','reporting-data.json');
const DEFITEA_LEDGER_FILE=process.env.DEFITEA_INCOME_LEDGER_FILE||path.join(ROOT,'reporting','defitea-income-ledger.json');
const EMBEDDED_LEDGER_FILE=process.env.EMBEDDED_YIELD_LEDGER_FILE||path.join(ROOT,'companies','embedded-yield-ledger.json');
const REWARDS_FILE=process.env.REWARDS_DATA_FILE||path.join(ROOT,'companies','rewards-data.json');
const REALISED_FILE=process.env.REALISED_CASH_FLOW_FILE||path.join(ROOT,'intelligence','realised-cash-flow','realised-cash-flow.json');
const OUTPUT_FILE=process.env.INCOME_LEDGER_FILE||path.join(ROOT,'reporting','income-ledger.json');

const VERSION='0.1-canonical-income-ledger';
const METHODOLOGY_VERSION='0.1-append-only-evidence-family-accounting';
const DEFITEA='defitea.eth';
const MONETRA='Monetra.eth';

function finite(v){if(v===null||v===undefined||v==='')return NaN;const n=Number(v);return Number.isFinite(n)?n:NaN;}
function round(v,d=8){const n=finite(v);if(!Number.isFinite(n))return null;const f=10**d;return Math.round(n*f)/f;}
function dayKey(v){if(!v)return null;const t=Date.parse(v);return Number.isFinite(t)?new Date(t).toISOString().slice(0,10):(/^\d{4}-\d{2}-\d{2}/.test(String(v))?String(v).slice(0,10):null);}
function monthKey(v){const d=dayKey(v);return d?d.slice(0,7):null;}
function stableStringify(v){if(v===null||typeof v!=='object')return JSON.stringify(v);if(Array.isArray(v))return`[${v.map(stableStringify).join(',')}]`;return`{${Object.keys(v).sort().map(k=>`${JSON.stringify(k)}:${stableStringify(v[k])}`).join(',')}}`;}
function sha256(v){return crypto.createHash('sha256').update(stableStringify(v)).digest('hex');}
async function readJson(file,fallback={}){try{return JSON.parse(await fs.readFile(file,'utf8'));}catch{return fallback;}}
async function writeJson(file,data){await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,JSON.stringify(data,null,2)+'\n');}

function validatePolicy(policy){
  if(policy?.version!=='0.1-canonical-income-ledger-policy')throw new Error('Canonical Income Ledger policy version mismatch');
  if(!['production-candidate','production'].includes(policy?.status))throw new Error('Canonical Income Ledger policy status invalid');
  for(const key of ['eventIdentityRequired','eventEconomicFieldsImmutableAfterAdmission','claimOrWalletMovementDoesNotErasePriorIncome','currentClaimableBalanceIsStateNotPeriodIncome','claimableDecreaseDoesNotProveRealisedCashFlow','claimableIncreaseWithoutMechanismIdentityDoesNotProvePeriodIncome','missingClaimableRouteDoesNotMeanZero','embeddedIncomeRequiresAcceptedCanonicalInterval','realisedCashFlowRequiresMechanismSpecificProof','referenceAprCanNeverBackfillEarnedIncome','stablePriceEffectIsSeparateFromEmbeddedIncome','unknownIsNotZero','crossFamilySummationForbidden']){
    if(policy?.rules?.[key]!==true)throw new Error(`Canonical Income Ledger policy rule invalid: ${key}`);
  }
  const a=policy?.authority||{};
  if(a.executionAuthority!=='none'||a.walletAuthority!=='none'||a.claimingAuthority!=='none'||a.capitalExecution!==false||a.methodologyMutationAuthority!=='none')throw new Error('Canonical Income Ledger authority expansion');
  return policy;
}

function economicHashPayload(e){return{eventKey:e.eventKey,company:e.company,family:e.family,route:e.route||null,protocol:e.protocol||null,economicDate:e.economicDate||null,periodStart:e.periodStart||null,periodEnd:e.periodEnd||null,asset:e.asset||null,amount:e.amount??null,usdValue:e.usdValue??null,stablePriceEffectUsd:e.stablePriceEffectUsd??null,physicalEventId:e.physicalEventId||null,sourceIdentity:e.sourceIdentity||null};}
function finalizeCandidate(e,generatedAt){
  if(!e?.eventKey||!e?.company||!e?.family)throw new Error('Income event identity incomplete');
  if(!['accrued-entitlement','realised-cash-flow','embedded-income'].includes(e.family))throw new Error(`Income event family invalid: ${e.family}`);
  const out={...e,firstObservedAt:e.firstObservedAt||generatedAt,retention:'indefinite',laterStateChangeDoesNotEraseIncome:true,executionAuthority:'none'};
  out.immutableEconomicFieldsHash=sha256(economicHashPayload(out));
  return out;
}
function admitEvents(previousEvents,candidates){
  const byKey=new Map(),physical=new Map();
  for(const prior of Array.isArray(previousEvents)?previousEvents:[]){
    if(!prior?.eventKey)throw new Error('Prior Canonical Income Ledger event missing eventKey');
    const expected=sha256(economicHashPayload(prior));
    if(prior.immutableEconomicFieldsHash&&prior.immutableEconomicFieldsHash!==expected)throw new Error(`Prior income event hash drift: ${prior.eventKey}`);
    const normalized={...prior,immutableEconomicFieldsHash:expected};
    byKey.set(prior.eventKey,normalized);
    if(prior.family==='realised-cash-flow'&&prior.physicalEventId){
      const k=`${prior.company}:${prior.physicalEventId}`;
      if(physical.has(k)&&physical.get(k)!==prior.eventKey)throw new Error(`Prior realised physical event collision: ${k}`);
      physical.set(k,prior.eventKey);
    }
  }
  let admitted=0;
  for(const row of candidates){
    const existing=byKey.get(row.eventKey);
    if(existing){
      if(existing.immutableEconomicFieldsHash!==row.immutableEconomicFieldsHash)throw new Error(`Income event economic mutation detected: ${row.eventKey}`);
      continue;
    }
    if(row.family==='realised-cash-flow'&&row.physicalEventId){
      const k=`${row.company}:${row.physicalEventId}`,priorKey=physical.get(k);
      if(priorKey&&priorKey!==row.eventKey)throw new Error(`Cross-source realised cash-flow collision: ${k} -> ${priorKey} | ${row.eventKey}`);
      physical.set(k,row.eventKey);
    }
    byKey.set(row.eventKey,row);admitted++;
  }
  return{events:[...byKey.values()].sort((a,b)=>String(a.economicDate||a.periodEnd||'').localeCompare(String(b.economicDate||b.periodEnd||''))||a.eventKey.localeCompare(b.eventKey)),admitted};
}

function defiteaCandidates(ledger,generatedAt){
  const out=[];
  for(const e of ledger?.voteMarketEvents||[]){
    if(!e?.eventKey||!dayKey(e.eventDate)||!(finite(e.usdValue)>0))continue;
    out.push(finalizeCandidate({eventKey:`defitea-entitlement:${e.eventKey}`,company:DEFITEA,family:'accrued-entitlement',economicDate:dayKey(e.eventDate),periodStart:dayKey(e.eventDate),periodEnd:dayKey(e.eventDate),route:e.route||null,protocol:e.protocol||null,asset:e.rewardSymbol||e.rewardToken||null,amount:Number.isFinite(finite(e.rewardAmount))?round(e.rewardAmount,12):null,usdValue:round(e.usdValue,8),valuationStatus:'source-valued-frozen',sourceFile:'reporting/defitea-income-ledger.json',sourceFamily:'voteMarketEvents',sourceIdentity:e.eventKey,evidenceStatus:'canonical-observed-entitlement-event',firstObservedAt:e.firstObservedAt||null},generatedAt));
  }
  for(const e of ledger?.fortyAcresReceivedEvents||[]){
    if(!e?.eventKey||!dayKey(e.eventDate)||!(finite(e.usdValue)>0))continue;
    const chainId=String(e.chain||'').toLowerCase().includes('optimism')?10:null,tx=String(e.txHash||'').toLowerCase(),idx=Number(e.logIndex);
    const physical=chainId&&/^0x[0-9a-f]{64}$/.test(tx)&&Number.isInteger(idx)?`${chainId}:${tx}:${idx}`:null;
    out.push(finalizeCandidate({eventKey:`defitea-received:${e.eventKey}`,company:DEFITEA,family:'realised-cash-flow',economicDate:dayKey(e.eventDate),periodStart:dayKey(e.eventDate),periodEnd:dayKey(e.eventDate),route:e.route||null,protocol:e.protocol||null,asset:e.payoutSymbol||e.payoutToken||null,amount:Number.isFinite(finite(e.amount))?round(e.amount,12):null,usdValue:round(e.usdValue,8),valuationStatus:'source-valued-frozen',physicalEventId:physical,sourceFile:'reporting/defitea-income-ledger.json',sourceFamily:'fortyAcresReceivedEvents',sourceIdentity:e.eventKey,evidenceStatus:'canonical-actual-net-received',firstObservedAt:e.firstObservedAt||null},generatedAt));
  }
  return out;
}
function embeddedCandidates(ledger,generatedAt){
  const out=[];
  if(ledger?.company?.name!==MONETRA||ledger?.company?.registry!=='008')return out;
  for(const [positionId,p] of Object.entries(ledger?.positions||{}))for(const e of p?.intervalHistory||[]){
    if(e?.status!=='ok'||e?.accepted!==true)continue;
    const income=finite(e.incomeUsd);if(!Number.isFinite(income)||!e.startAt||!e.endAt)throw new Error(`${positionId}: accepted Embedded Yield interval missing canonical economics`);
    const startMonth=monthKey(e.startAt),endMonth=monthKey(e.endAt);
    out.push(finalizeCandidate({eventKey:`monetra-embedded:${positionId}:${e.startAt}:${e.endAt}`,company:MONETRA,family:'embedded-income',economicDate:dayKey(e.endAt),periodStart:e.startAt,periodEnd:e.endAt,route:positionId,protocol:e.protocol||p.protocol||null,asset:e.terminalSymbol||null,amount:Number.isFinite(finite(e.incomeUnderlying))?round(e.incomeUnderlying,12):null,usdValue:round(income,8),stablePriceEffectUsd:Number.isFinite(finite(e.stablePriceEffectUsd))?round(e.stablePriceEffectUsd,8):null,valuationStatus:'canonical-interval-end-valuation',periodAttributionStatus:startMonth&&startMonth===endMonth?'single-month':'cross-month-boundary-unallocated',sourceFile:'companies/embedded-yield-ledger.json',sourceFamily:'accepted intervalHistory',sourceIdentity:`${positionId}:${e.startAt}:${e.endAt}`,evidenceStatus:'accepted-canonical-embedded-yield-interval'},generatedAt));
  }
  return out;
}
function realisedCandidates(realised,generatedAt){
  const out=[];
  for(const [company,c] of Object.entries(realised?.companies||{}))for(const row of c?.ledger?.rows||[]){
    if(row?.classification!=='realised-income'||row?.countedAsRealisedCashFlow!==true)continue;
    if(!row?.eventId||!row?.physicalEventId)throw new Error(`${company}: realised cash-flow accepted row missing canonical identity`);
    const usd=finite(row.usdValue);
    out.push(finalizeCandidate({eventKey:`realised:${row.eventId}`,company,family:'realised-cash-flow',economicDate:dayKey(row.timestamp),periodStart:row.timestamp||null,periodEnd:row.timestamp||null,route:row.adapterId||null,protocol:row.protocol||null,asset:row.asset||null,amount:Number.isFinite(finite(row.amount))?round(row.amount,12):null,usdValue:Number.isFinite(usd)?round(usd,8):null,valuationStatus:row.valuationStatus||'not-valued',physicalEventId:row.physicalEventId,sourceFile:'intelligence/realised-cash-flow/realised-cash-flow.json',sourceFamily:'accepted realised-income row',sourceIdentity:row.eventId,evidenceStatus:`tier-${row.evidenceTier||'unknown'}-mechanism-specific`},generatedAt));
  }
  return out;
}

function rewardStateRows(company){
  const byKey=new Map();
  for(const r of company?.rewards||[]){
    if(r?.includedInClaimableTotal===false)continue;
    const route=String(r?.route||'').trim(),protocol=String(r?.protocol||'').trim(),token=String(r?.token||r?.symbol||'').trim(),wallet=String(r?.wallet||r?.details?.wallet||'').trim();
    const routeKey=[route||protocol||'route-unknown',token||'token-unknown',wallet||'wallet-unknown'].map(x=>x.toLowerCase()).join(':');
    const amount=finite(r?.amount),usd=finite(r?.usdValue);
    const row={routeKey,route:route||null,protocol:protocol||null,token:r?.token||null,symbol:r?.symbol||null,wallet:wallet||null,classification:r?.classification||null,amount:Number.isFinite(amount)?round(amount,12):null,usdValue:Number.isFinite(usd)?round(usd,8):null,source:r?.source||null,includedInClaimableTotal:true,unknownIsNotZero:true};
    const prior=byKey.get(routeKey);
    if(prior&&stableStringify(prior)!==stableStringify(row))throw new Error(`Claimable state identity collision: ${routeKey}`);
    byKey.set(routeKey,row);
  }
  return[...byKey.values()].sort((a,b)=>a.routeKey.localeCompare(b.routeKey));
}
function continuityFor(previous,current,policy){
  const prev=new Map((previous?.rows||[]).map(x=>[x.routeKey,x])),cur=new Map((current?.rows||[]).map(x=>[x.routeKey,x]));
  return[...new Set([...prev.keys(),...cur.keys()])].sort().map(routeKey=>{
    const a=prev.get(routeKey),b=cur.get(routeKey);let state,deltaAmount=null,deltaUsd=null;
    if(!a&&b)state=policy.claimableContinuity.new;
    else if(a&&!b)state=policy.claimableContinuity.missing;
    else{
      const av=finite(a?.amount),bv=finite(b?.amount),au=finite(a?.usdValue),bu=finite(b?.usdValue);
      if(Number.isFinite(av)&&Number.isFinite(bv)){deltaAmount=round(bv-av,12);state=bv>av?policy.claimableContinuity.increase:bv<av?policy.claimableContinuity.decrease:policy.claimableContinuity.unchanged;}
      else if(Number.isFinite(au)&&Number.isFinite(bu)){deltaUsd=round(bu-au,8);state=bu>au?policy.claimableContinuity.increase:bu<au?policy.claimableContinuity.decrease:policy.claimableContinuity.unchanged;}
      else state='comparison-unknown-not-zero';
      if(deltaUsd===null&&Number.isFinite(au)&&Number.isFinite(bu))deltaUsd=round(bu-au,8);
    }
    return{routeKey,state,previousAmount:a?.amount??null,currentAmount:b?.amount??null,deltaAmount,previousUsdValue:a?.usdValue??null,currentUsdValue:b?.usdValue??null,deltaUsd,periodIncomeAuthority:false,realisedCashFlowAuthority:false,unknownIsNotZero:true};
  });
}
function buildClaimableSnapshots(previous,rewards,policy){
  const prior=Array.isArray(previous)?previous:[];
  if(!rewards?.generatedAt||!rewards?.companies||typeof rewards.companies!=='object')return{snapshots:prior,currentByCompany:{},continuity:{}};
  const byKey=new Map(prior.filter(x=>x?.snapshotKey).map(x=>[x.snapshotKey,x])),currentByCompany={},continuity={};
  for(const [company,c] of Object.entries(rewards.companies)){
    const rows=rewardStateRows(c);
    const snapshot={snapshotKey:`rewards:${rewards.generatedAt}:${company}`,capturedAt:rewards.generatedAt,company,canonicalClaimableTotalUsd:Number.isFinite(finite(c?.totalUsd))?round(c.totalUsd,8):null,rows,stateOnly:true,periodIncomeAuthority:false,realisedCashFlowAuthority:false,unknownIsNotZero:true};
    const priorCompany=[...byKey.values()].filter(x=>x.company===company&&x.capturedAt<rewards.generatedAt).sort((a,b)=>a.capturedAt.localeCompare(b.capturedAt)).at(-1)||null;
    continuity[company]=continuityFor(priorCompany,snapshot,policy);byKey.set(snapshot.snapshotKey,snapshot);currentByCompany[company]=snapshot;
  }
  const max=Number(policy?.retention?.claimableSnapshots)||730;
  return{snapshots:[...byKey.values()].sort((a,b)=>String(a.capturedAt).localeCompare(String(b.capturedAt))).slice(-max),currentByCompany,continuity};
}

function eventMonth(e){if(e.family==='embedded-income'){const a=monthKey(e.periodStart),b=monthKey(e.periodEnd);return a&&a===b?b:null;}return monthKey(e.economicDate||e.periodEnd);}
function familySummary(events){const valued=events.filter(e=>Number.isFinite(finite(e.usdValue))),unvalued=events.length-valued.length,subtotal=valued.reduce((s,e)=>s+finite(e.usdValue),0);return{eventCount:events.length,valuedEventCount:valued.length,unvaluedEventCount:unvalued,usdComplete:unvalued===0,usd:events.length&&unvalued===0?round(subtotal,8):(events.length===0?0:null),valuedUsdSubtotal:round(subtotal,8),unknownIsNotZero:true};}
function buildMonthly(events,company){
  const groups=new Map();
  for(const e of events.filter(x=>x.company===company)){const m=eventMonth(e);if(!m)continue;if(!groups.has(m))groups.set(m,[]);groups.get(m).push(e);}
  const out={};
  for(const [month,rows] of [...groups.entries()].sort(([a],[b])=>a.localeCompare(b))){
    const accrued=rows.filter(x=>x.family==='accrued-entitlement'),realised=rows.filter(x=>x.family==='realised-cash-flow'),embedded=rows.filter(x=>x.family==='embedded-income');
    const stablePrice=embedded.filter(x=>Number.isFinite(finite(x.stablePriceEffectUsd))).reduce((s,x)=>s+finite(x.stablePriceEffectUsd),0);
    out[month]={month,families:{accruedEntitlement:familySummary(accrued),realisedCashFlow:familySummary(realised),embeddedIncome:familySummary(embedded)},stablePriceEffectUsd:embedded.length?round(stablePrice,8):null,combinedIncomeUsd:null,crossFamilySumAllowed:false,note:'Economic families stay separate; accrued entitlement, realised cash flow and embedded income may overlap economically.'};
  }
  return out;
}
function referenceState(reporting,company){const f=reporting?.funds?.[company];if(!f)return null;const latest=f.latestSnapshot||{},month=monthKey(latest.date||reporting.generatedAt),current=month?f.months?.[month]||null:null;return{semantic:f.semantic||null,latestDate:latest.date||null,currentMonth:month,currentMonthReferenceOrGeneratedIncomeUsd:Number.isFinite(finite(current?.cashFlowUsd??current?.generatedIncomeUsd))?round(current.cashFlowUsd??current.generatedIncomeUsd,8):null,source:'reporting/reporting-data.json',earnedIncomeAuthority:false};}
function buildCompanies({events,currentByCompany,continuity,reporting,realised}){
  const names=new Set(events.map(e=>e.company));Object.keys(currentByCompany||{}).forEach(x=>names.add(x));Object.keys(realised?.companies||{}).forEach(x=>names.add(x));if(reporting?.funds?.[DEFITEA])names.add(DEFITEA);if(reporting?.funds?.[MONETRA])names.add(MONETRA);
  const out={};
  for(const name of [...names].sort()){
    const rows=events.filter(e=>e.company===name),crossMonthEmbedded=rows.filter(e=>e.family==='embedded-income'&&eventMonth(e)===null).length;
    out[name]={status:'partial',eventCount:rows.length,eventCountsByFamily:{accruedEntitlement:rows.filter(e=>e.family==='accrued-entitlement').length,realisedCashFlow:rows.filter(e=>e.family==='realised-cash-flow').length,embeddedIncome:rows.filter(e=>e.family==='embedded-income').length},referenceState:referenceState(reporting,name),currentClaimableState:currentByCompany?.[name]||null,claimableContinuity:continuity?.[name]||[],monthly:buildMonthly(events,name),coverage:{overallComplete:false,accruedEntitlement:name===DEFITEA?'partial-mechanism-specific':'unknown',realisedCashFlow:realised?.companies?.[name]?.ledger?.coverage?.complete===true?'complete':(rows.some(e=>e.family==='realised-cash-flow')?'partial-mechanism-specific':'unknown'),embeddedIncome:name===MONETRA?'canonical-accepted-intervals-only':'unknown',crossMonthEmbeddedIntervalsExcludedFromMonthlyAttribution:crossMonthEmbedded,unknownIsNotZero:true}};
  }
  return out;
}

async function build(){
  const generatedAt=new Date().toISOString();
  const [policyRaw,reporting,defiteaLedger,embedded,rewards,realised,previous]=await Promise.all([readJson(POLICY_FILE),readJson(REPORTING_FILE),readJson(DEFITEA_LEDGER_FILE),readJson(EMBEDDED_LEDGER_FILE),readJson(REWARDS_FILE),readJson(REALISED_FILE),readJson(OUTPUT_FILE,{})]);
  const policy=validatePolicy(policyRaw),candidates=[...defiteaCandidates(defiteaLedger,generatedAt),...embeddedCandidates(embedded,generatedAt),...realisedCandidates(realised,generatedAt)],admitted=admitEvents(previous?.events,candidates),claimable=buildClaimableSnapshots(previous?.claimableSnapshots,rewards,policy),companies=buildCompanies({events:admitted.events,currentByCompany:claimable.currentByCompany,continuity:claimable.continuity,reporting,realised});
  return{
    version:VERSION,methodologyVersion:METHODOLOGY_VERSION,policyVersion:policy.version,generatedAt,status:'partial',
    semantics:{noCollapseRule:'Do not sum accrued entitlement + realised cash flow + embedded income + reference productivity into one income number without explicit non-overlap reconciliation.',claimableStateRule:'Current claimable balances and their deltas are state observations, not period-income or realised-cash-flow authority.',continuityRule:'Claims, reinvestment, transfers, source disappearance and protocol resets do not erase previously admitted income events. Ambiguous decreases become local reconciliation-needed states.',unknownIsNotZero:true,referenceAprCanBackfillEarnedIncome:false,stablePriceEffectSeparate:true},
    sourceState:{reporting:{file:'reporting/reporting-data.json',version:reporting?.version||null,generatedAt:reporting?.generatedAt||null},defiteaIncomeLedger:{file:'reporting/defitea-income-ledger.json',version:defiteaLedger?.version||null,updatedAt:defiteaLedger?.updatedAt||null},embeddedYieldLedger:{file:'companies/embedded-yield-ledger.json',version:embedded?.version||null,generatedAt:embedded?.generatedAt||null},rewards:{file:'companies/rewards-data.json',version:rewards?.version||null,generatedAt:rewards?.generatedAt||null},realisedCashFlow:{file:'intelligence/realised-cash-flow/realised-cash-flow.json',version:realised?.version||null,generatedAt:realised?.generatedAt||null,overallCoverageComplete:realised?.methodology?.overallCoverageComplete===true}},
    events:admitted.events,claimableSnapshots:claimable.snapshots,companies,
    run:{candidateEventCount:candidates.length,newEventsAdmitted:admitted.admitted,retainedHistoricalEventCount:Math.max(0,admitted.events.length-admitted.admitted),claimableSnapshotCount:claimable.snapshots.length},
    authority:{executionAuthority:'none',walletAuthority:'none',claimingAuthority:'none',capitalExecution:false,methodologyMutationAuthority:'none'}
  };
}
async function main(){const output=await build();await writeJson(OUTPUT_FILE,output);console.log('Canonical Income Ledger built',{events:output.events.length,newEvents:output.run.newEventsAdmitted,claimableSnapshots:output.claimableSnapshots.length,companies:Object.keys(output.companies).length,unknownIsNotZero:output.semantics.unknownIsNotZero,executionAuthority:output.authority.executionAuthority});}

export{VERSION,METHODOLOGY_VERSION,validatePolicy,economicHashPayload,finalizeCandidate,admitEvents,defiteaCandidates,embeddedCandidates,realisedCandidates,rewardStateRows,continuityFor,buildClaimableSnapshots,eventMonth,familySummary,buildMonthly,build};
if(process.argv[1]&&path.resolve(process.argv[1])===__filename)main().catch(err=>{console.error(err);process.exitCode=1;});
