#!/usr/bin/env node
/**
 * The Holding · Accounting Coverage Registry v0.7
 *
 * Diagnostic machine map of productive mechanisms versus canonical factual
 * accounting capability. Canonical Income Ledger is the sole authority for
 * earned-income events. Mechanism-specific evidence checkpoints prove that a
 * factual engine is actively tracking a company even when the current period
 * has no positive income event. Tracking proof never creates period income.
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
const REWARDS_FILE=process.env.REWARDS_DATA_FILE||path.join(ROOT,'companies','rewards-data.json');
const VE33_EVIDENCE_FILE=process.env.VE33_EVIDENCE_FILE||path.join(ROOT,'reporting','ve33-accounting-evidence.json');
const VE33_LOCKED_MANAGED_EVIDENCE_FILE=process.env.VE33_LOCKED_MANAGED_EVIDENCE_FILE||path.join(ROOT,'reporting','ve33-locked-managed-accounting-evidence.json');
const YIELD_BASIS_EVIDENCE_FILE=process.env.YIELD_BASIS_EVIDENCE_FILE||path.join(ROOT,'reporting','yield-basis-accounting-evidence.json');
const FRAX_EVIDENCE_FILE=process.env.FRAX_EVIDENCE_FILE||path.join(ROOT,'reporting','frax-yield-accounting-evidence.json');
const ICP_NNS_STATE_FILE=process.env.ICP_NNS_STATE_FILE||path.join(ROOT,'companies','icp-nns-rewards-state.json');
const ICP_NNS_CONFIG_FILE=process.env.ICP_NNS_CONFIG_FILE||path.join(ROOT,'intelligence','icp-nns','company-005-006-neuron-pool.json');
const COMPANY_010_STATE_FILE=process.env.COMPANY_010_STATE_FILE||path.join(ROOT,'companies','company-010-production-state.json');
const OUTPUT_FILE=process.env.ACCOUNTING_COVERAGE_FILE||path.join(ROOT,'reporting','accounting-coverage.json');

export const VERSION='0.7-projectx-factual-tracking-accounting-mechanism-coverage-registry';
export const COMPANY_ALIASES=Object.freeze({'aerocrvyb.eth':'aerocvxyb.eth'});
export function canonicalCompanyName(name){const raw=String(name||'').trim();return raw?(COMPANY_ALIASES[raw]||raw):'';}

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
async function readOptionalJson(file){try{return await readJson(file);}catch(error){if(error?.code==='ENOENT')return{};throw error;}}
async function writeJson(file,data){await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,JSON.stringify(data,null,2)+'\n');}

function eventText(e){return[e?.route,e?.protocol,e?.asset,e?.token,e?.sourceFamily,e?.sourceIdentity,e?.sourceFile,e?.mechanismKind].map(lower).join(' ');}
function stateText(r){return[r?.route,r?.protocol,r?.asset,r?.token,r?.symbol,r?.routeKey,r?.source].map(lower).join(' ');}
function textMatches(text,hints){return(hints||[]).some(h=>h&&text.includes(lower(h)));}
function eventMatches(e,cls){return e?.family===cls.family&&textMatches(eventText(e),cls.hints);}
function stateMatches(r,cls){return textMatches(stateText(r),cls.hints);}
function companyMatches(raw,canonical){return canonicalCompanyName(raw)===canonical;}
function matchingCompanyKeys(obj,canonical){return Object.keys(obj||{}).filter(name=>companyMatches(name,canonical));}
function preferredCompanyKey(obj,canonical){const keys=matchingCompanyKeys(obj,canonical);return keys.includes(canonical)?canonical:(keys[0]||null);}
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

function productiveRows(productivity,name){const key=preferredCompanyKey(productivity?.companies,name);const rows=key?productivity?.companies?.[key]?.breakdown:null;return Array.isArray(rows)?rows:[];}
function productiveValue(row){for(const key of['value','valueUsd','productiveValueUsd','productiveValue'])if(finite(row?.[key]))return Number(row[key]);return null;}
function classForEngine(engineId,protocol=null){const known=ENGINE_CLASS[engineId];return known?{...known,classified:true}:{family:'unknown',mechanism:'unclassified',hints:unique([engineId,protocol]),classified:false};}

function embeddedMechanisms(embedded,name){
  if(!companyMatches(embedded?.company?.name,name))return[];
  return Object.entries(embedded?.positions||{}).map(([positionId,p])=>{
    const checkpoints=Array.isArray(p?.checkpoints)?p.checkpoints:[];
    const last=[...checkpoints].sort((a,b)=>String(a?.timestamp||'').localeCompare(String(b?.timestamp||''))).at(-1);
    return{engineId:`embedded:${positionId}`,principalId:positionId,protocol:p?.protocol||null,engineStatus:p?.accounting?.embeddedYieldEligible===true?'ok':'unknown',productiveValueUsd:finite(last?.economicValueUsd)?Number(last.economicValueUsd):null,class:{family:'embedded-income',mechanism:p?.incomeMode||'embedded-yield',hints:unique([positionId,p?.protocol,p?.chain]),classified:true},inventorySource:'companies/embedded-yield-ledger.json'};
  });
}

export function mechanismInventory({productivity={},embedded={},company}={}){
  const rows=productiveRows(productivity,company).map(row=>{const engineId=String(row?.engineId||'').trim(),protocol=productivity?.engines?.[engineId]?.protocol||row?.protocol||null;return{engineId,principalId:row?.principalId||null,protocol,engineStatus:row?.engineStatus||null,productiveValueUsd:productiveValue(row),class:classForEngine(engineId,protocol),inventorySource:'companies/productivity-data.json'};}).filter(x=>x.engineId);
  rows.push(...embeddedMechanisms(embedded,company));
  const map=new Map();
  for(const row of rows){if(!map.has(row.engineId)){map.set(row.engineId,row);continue;}const prior=map.get(row.engineId);map.set(row.engineId,{...prior,...row,productiveValueUsd:finite(row.productiveValueUsd)?row.productiveValueUsd:prior.productiveValueUsd});}
  return[...map.values()].sort((a,b)=>a.engineId.localeCompare(b.engineId));
}

function currentStateRows(ledger,name){const key=preferredCompanyKey(ledger?.companies,name),rows=key?ledger?.companies?.[key]?.currentClaimableState?.rows:null;return Array.isArray(rows)?rows:[];}
function companyEventMonths(events,name){const out=[];for(const e of events){if(!companyMatches(e?.company,name))continue;out.push(monthKey(e?.economicDate||e?.periodEnd),monthKey(e?.periodStart),monthKey(e?.periodEnd));}return unique(out).sort();}
function companyMonths({productivity,ledger,embedded,name,asOfMonth}){
  const productivityKey=preferredCompanyKey(productivity?.companies,name),out=[asOfMonth,monthKey(productivityKey?productivity?.companies?.[productivityKey]?.trackingStartedAt:null)];
  out.push(...companyEventMonths(ledger?.events||[],name));
  if(companyMatches(embedded?.company?.name,name)){out.push(monthKey(embedded?.trackingStartedAt));for(const p of Object.values(embedded?.positions||{})){out.push(monthKey(p?.trackingStartedAt));for(const row of p?.intervalHistory||[])out.push(monthKey(row?.startAt),monthKey(row?.endAt));}}
  return unique(out).sort();
}

function pushTrackingProof(out,{engineId,company,observedAt,sourceFile,proofKey}){const canonical=canonicalCompanyName(company),month=monthKey(observedAt);if(!engineId||!canonical||!month)return;out.push({engineId,company:canonical,month,observedAt,sourceFile,proofKey:proofKey||null});}

export function icpNnsObservationProofs(state={},config={}){
  const out=[];
  if(state?.version!=='0.1-icp-nns-rewards-state'||state?.asset!=='ICP'||state?.network!=='Internet Computer'||state?.route!=='icp-nns-governance')return out;
  if(!['partial','ok'].includes(state?.status)||state?.unknownIsNotZero!==true)return out;
  if(state?.authority?.readOnly!==true||state?.authority?.executionAuthority!=='none'||state?.authority?.claimTransactionAuthority!=='none')return out;
  if(config?.version!=='0.1-icp-nns-shared-neuron-pool'||config?.asset!=='ICP'||config?.network!=='Internet Computer'||config?.positionType!=='NNS Governance Neurons')return out;
  if(config?.rewardPolicy?.referenceAprAccountingAuthority!==false||config?.rewardPolicy?.fallbackAccountingTreatment!=='analytics-state-estimate-only-never-earned-income'||config?.rewardPolicy?.unknownIsNotZero!==true||config?.rewardPolicy?.claimAuthority!=='none'||config?.rewardPolicy?.executionAuthority!=='none')return out;
  if(config?.security?.readOnly!==true||config?.security?.seedPhraseRequired!==false||config?.security?.identityPemRequired!==false||config?.security?.privateKeyRequired!==false)return out;
  const ids=Array.isArray(config?.neuronIds)?config.neuronIds.map(String):[];
  if(ids.length!==41||new Set(ids).size!==41)return out;
  const observation=state?.publicNeuronObservation||{},neurons=Array.isArray(state?.neurons)?state.neurons:[];
  if(Number(observation.requestedNeuronCount)!==ids.length||Number(observation.detailOkCount)!==ids.length||observation.fullDetailCoverage!==true||neurons.length!==ids.length)return out;
  if(neurons.some(x=>x?.detailStatus!=='ok'||!x?.neuronId))return out;
  const observedIds=neurons.map(x=>String(x.neuronId));
  if(new Set(observedIds).size!==ids.length||JSON.stringify([...observedIds].sort())!==JSON.stringify([...ids].sort()))return out;
  const allocations=Object.entries(config?.allocation?.companies||{});
  if(!allocations.length||allocations.some(([company,share])=>!canonicalCompanyName(company)||!finite(share)||Number(share)<=0))return out;
  const allocationTotal=allocations.reduce((sum,[,share])=>sum+Number(share),0);
  if(Math.abs(allocationTotal-1)>1e-12)return out;
  const observedAt=state?.generatedAt;
  if(!monthKey(observedAt))return out;
  for(const[company]of allocations)pushTrackingProof(out,{engineId:'icp_nns',company,observedAt,sourceFile:'companies/icp-nns-rewards-state.json',proofKey:`icp-nns:full-neuron-observation:${ids.length}:${observedAt}`});
  return out;
}

export function pendleSPendleObservationProofs(rewards={}){
  const out=[];
  const allowedProtocols=new Set(['pendle','pendle · spendle']);
  const allowedRewardSources=new Set(['official Pendle API: dashboard merkle rewards','official Pendle API: sPENDLE accrued ETH fees']);
  for(const[company,c]of Object.entries(rewards?.companies||{})){
    const source=(c?.sources||[]).find(x=>x?.route==='pendle-spendle');
    if(source?.status!=='ok'||!allowedProtocols.has(lower(source?.protocol))||lower(source?.metric)!=='official spendle holder + dashboard claimable rewards apis')continue;
    const walletResults=Array.isArray(source?.details?.walletResults)?source.details.walletResults:[];
    if(!walletResults.length)continue;
    const wallets=walletResults.map(x=>lower(x?.wallet));
    if(wallets.some(x=>!/^0x[0-9a-f]{40}$/.test(x))||new Set(wallets).size!==wallets.length)continue;
    if(walletResults.some(x=>x?.status!=='ok'||!Number.isSafeInteger(Number(x?.rewardCount))||Number(x.rewardCount)<0))continue;
    const rows=(c?.rewards||[]).filter(x=>x?.route==='pendle-spendle');
    const rowsStrong=rows.every(x=>allowedProtocols.has(lower(x?.protocol))&&x?.classification==='unclaimed'&&finite(x?.amount)&&Number(x.amount)>=0&&allowedRewardSources.has(x?.source)&&wallets.includes(lower(x?.details?.wallet)));
    if(!rowsStrong)continue;
    const counts=new Map(wallets.map(wallet=>[wallet,0]));
    for(const row of rows){const wallet=lower(row?.details?.wallet);counts.set(wallet,(counts.get(wallet)||0)+1);}
    if(walletResults.some(x=>counts.get(lower(x.wallet))!==Number(x.rewardCount)))continue;
    const observedAt=c?.updatedAt||rewards?.generatedAt;
    if(!monthKey(observedAt))continue;
    pushTrackingProof(out,{engineId:'pendle_spendle',company,observedAt,sourceFile:'companies/rewards-data.json',proofKey:`pendle-spendle:${[...wallets].sort().join(',')}:${rows.length}`});
  }
  return out;
}

export function veniceSVvvObservationProofs(rewards={}){
  const out=[];
  const allowedProtocols=new Set(['venice','venice · svvv']);
  const vvv='0xacfe6019ed1a7dc6f7b508c02d1b04ec88cc21bf';
  for(const[company,c]of Object.entries(rewards?.companies||{})){
    const source=(c?.sources||[]).find(x=>x?.route==='venice-staking');
    if(source?.status!=='ok'||!allowedProtocols.has(lower(source?.protocol))||lower(source?.metric)!=='stakingv2.pendingrewards(user)')continue;
    const walletResults=Array.isArray(source?.details?.walletResults)?source.details.walletResults:[];
    if(!walletResults.length)continue;
    const wallets=walletResults.map(x=>lower(x?.wallet));
    if(wallets.some(x=>!/^0x[0-9a-f]{40}$/.test(x))||new Set(wallets).size!==wallets.length)continue;
    if(walletResults.some(x=>x?.status!=='ok'||!Number.isSafeInteger(Number(x?.rewardCount))||Number(x.rewardCount)<0))continue;
    const rows=(c?.rewards||[]).filter(x=>x?.route==='venice-staking');
    const rowsStrong=rows.every(x=>allowedProtocols.has(lower(x?.protocol))&&lower(x?.token)===vvv&&x?.classification==='unclaimed'&&finite(x?.amount)&&Number(x.amount)>=0&&lower(x?.source)==='onchain: venice stakingv2.pendingrewards'&&wallets.includes(lower(x?.details?.wallet)));
    if(!rowsStrong)continue;
    const counts=new Map(wallets.map(wallet=>[wallet,0]));
    for(const row of rows){const wallet=lower(row?.details?.wallet);counts.set(wallet,(counts.get(wallet)||0)+1);}
    if(walletResults.some(x=>counts.get(lower(x.wallet))!==Number(x.rewardCount)))continue;
    const observedAt=c?.updatedAt||rewards?.generatedAt;
    if(!monthKey(observedAt))continue;
    pushTrackingProof(out,{engineId:'venice_svvv',company,observedAt,sourceFile:'companies/rewards-data.json',proofKey:`venice-svvv:${[...wallets].sort().join(',')}:${rows.length}`});
  }
  return out;
}

export function resupplyRsupObservationProofs(rewards={}){
  const out=[];
  const allowedProtocols=new Set(['resupply','resupply · staked rsup']);
  const allowedSource='onchain: GovStaker.earned(account,rewardToken)';
  for(const[company,c]of Object.entries(rewards?.companies||{})){
    const source=(c?.sources||[]).find(x=>x?.route==='resupply-staking');
    if(source?.status!=='ok'||!allowedProtocols.has(lower(source?.protocol))||lower(source?.metric)!=='govstaker dynamic reward tokens + earned(account,token)')continue;
    const walletResults=Array.isArray(source?.details?.walletResults)?source.details.walletResults:[];
    if(!walletResults.length)continue;
    const wallets=walletResults.map(x=>lower(x?.wallet));
    if(wallets.some(x=>!/^0x[0-9a-f]{40}$/.test(x))||new Set(wallets).size!==wallets.length)continue;
    if(walletResults.some(x=>x?.status!=='ok'||!Number.isSafeInteger(Number(x?.rewardCount))||Number(x.rewardCount)<0))continue;
    const rows=(c?.rewards||[]).filter(x=>x?.route==='resupply-staking');
    const rowsStrong=rows.every(x=>allowedProtocols.has(lower(x?.protocol))&&x?.classification==='unclaimed'&&finite(x?.amount)&&Number(x.amount)>=0&&x?.source===allowedSource&&wallets.includes(lower(x?.details?.wallet)));
    if(!rowsStrong)continue;
    const counts=new Map(wallets.map(wallet=>[wallet,0]));
    for(const row of rows){const wallet=lower(row?.details?.wallet);counts.set(wallet,(counts.get(wallet)||0)+1);}
    if(walletResults.some(x=>counts.get(lower(x.wallet))!==Number(x.rewardCount)))continue;
    const observedAt=c?.updatedAt||rewards?.generatedAt;
    if(!monthKey(observedAt))continue;
    pushTrackingProof(out,{engineId:'resupply_rsup',company,observedAt,sourceFile:'companies/rewards-data.json',proofKey:`resupply-rsup:${[...wallets].sort().join(',')}:${rows.length}`});
  }
  return out;
}

export function liquityLqtyObservationProofs(rewards={}){
  const out=[];
  const governance='0x807def5e7d057df05c796f4bc75c3fe82bd6eee1';
  const stakingV1='0x4f9fbb3f1e99b56e0fe2892e623ed36a76fc605d';
  const lusd='0x5f98805a4e8be255a32880fdec7f6728c6568ba0';
  const allowedProtocols=new Set(['liquity','liquity · staked lqty']);
  const allowedSource='onchain: Liquity V1 LQTYStaking pending gain across wallet + V2 UserProxy';
  const addressOk=v=>/^0x[0-9a-f]{40}$/.test(lower(v));
  const rawOk=v=>/^\d+$/.test(String(v??''));
  for(const[company,c]of Object.entries(rewards?.companies||{})){
    const source=(c?.sources||[]).find(x=>x?.route==='liquity-staking');
    if(source?.status!=='ok'||!allowedProtocols.has(lower(source?.protocol))||lower(source?.metric)!=='lqtystaking pending eth + lusd across direct wallet and liquity v2 userproxy')continue;
    const details=source?.details||{},primary=lower(details?.primaryUserProxy),accounts=Array.isArray(details?.rewardAccounts)?details.rewardAccounts:[];
    if(lower(details?.governance)!==governance||lower(details?.stakingV1)!==stakingV1||!addressOk(primary)||!(Number(details?.primaryUserProxyStakedLqty)>0)||details?.unknownIsNotZero!==true||details?.rewardState!=='Claimable'||!accounts.length)continue;
    const accountAddresses=accounts.map(x=>lower(x?.account));
    const accountKinds=new Set(['direct-v1','liquity-v2-userproxy']);
    if(accountAddresses.some(x=>!addressOk(x))||new Set(accountAddresses).size!==accountAddresses.length)continue;
    if(accounts.some(x=>!addressOk(x?.wallet)||!accountKinds.has(x?.accountKind)||x?.readError||!rawOk(x?.pendingEthRaw)||!rawOk(x?.pendingLusdRaw)))continue;
    const primaryAccount=accounts.find(x=>lower(x?.account)===primary&&x?.accountKind==='liquity-v2-userproxy');
    if(!primaryAccount||!(Number(primaryAccount?.stakedLqty)>0))continue;
    let totalEthRaw=0n,totalLusdRaw=0n;
    try{for(const row of accounts){totalEthRaw+=BigInt(row.pendingEthRaw);totalLusdRaw+=BigInt(row.pendingLusdRaw);}}catch{continue;}
    const expectedTokens=[];if(totalEthRaw>0n)expectedTokens.push('native:eth');if(totalLusdRaw>0n)expectedTokens.push(lusd);
    const rows=(c?.rewards||[]).filter(x=>x?.route==='liquity-staking');
    const rowsStrong=rows.every(x=>allowedProtocols.has(lower(x?.protocol))&&x?.classification==='unclaimed'&&finite(x?.amount)&&Number(x.amount)>0&&x?.source===allowedSource&&['native:eth',lusd].includes(lower(x?.token))&&lower(x?.details?.userProxy)===primary&&x?.details?.unknownIsNotZero===true&&x?.details?.rewardState==='Claimable');
    if(!rowsStrong||rows.length!==expectedTokens.length)continue;
    const rowTokens=rows.map(x=>lower(x.token)).sort();
    if(JSON.stringify(rowTokens)!==JSON.stringify([...expectedTokens].sort()))continue;
    const observedAt=c?.updatedAt||rewards?.generatedAt;
    if(!monthKey(observedAt))continue;
    pushTrackingProof(out,{engineId:'liquity_lqty',company,observedAt,sourceFile:'companies/rewards-data.json',proofKey:`liquity-lqty:${primary}:${accounts.length}:${rows.length}`});
  }
  return out;
}

export function hyperlendKhypeObservationProofs(state={},rewards={}){
  const out=[];
  const engineId='hyperlend-0xfd739d4e423301ce9385c1fb8850539d657c296d';
  const asset='0xfd739d4e423301ce9385c1fb8850539d657c296d';
  const hToken='0xa55de93cde5a34c5521b7584022846829cb74366';
  const dataProvider='0x5481bf8d3946e6a3168640c1d7523eb59f055a29';
  const addressOk=v=>/^0x[0-9a-f]{40}$/.test(lower(v));
  const rawOk=v=>/^\d+$/.test(String(v??''));
  const RAY=10n**27n,HALF_RAY=RAY/2n,rayMul=(a,b)=>(a*b+HALF_RAY)/RAY;
  const strategy=state?.strategies?.hyperlend,company='Cypher';
  if(state?.company?.registry!=='010'||state?.company?.name!==company||strategy?.version!=='0.1-company-010-hyperlend-income-parity'||strategy?.status!=='measured'||strategy?.protocol!=='HyperLend'||strategy?.chain!=='HyperEVM'||strategy?.market!=='kHYPE supply')return out;
  if(lower(strategy?.underlyingAsset)!==asset||lower(strategy?.hToken)!==hToken||lower(strategy?.dataProvider)!==dataProvider||!addressOk(strategy?.pool))return out;
  if(state?.authority?.executionAuthority!=='none'||strategy?.authority?.readOnly!==true||strategy?.authority?.walletSigning!==false||strategy?.authority?.transactions!==false||strategy?.authority?.executionAuthority!=='none')return out;
  const boundary=strategy?.accountingBoundary||{},epistemic=state?.epistemicBoundary||{};
  if(boundary?.embeddedInterestAlreadyInPrincipalBalance!==true||boundary?.embeddedInterestNotAdditiveCapital!==true||boundary?.embeddedInterestNotClaimable!==true||boundary?.externalIncentivesSeparateFromSupplyApr!==true||boundary?.noDoubleCount!==true)return out;
  if(epistemic?.hyperlendSupplyInterestIsEmbedded!==true||epistemic?.hyperlendEmbeddedInterestIsNotClaimable!==true||epistemic?.hyperlendExternalIncentivesAreSeparate!==true||epistemic?.hyperlendAprIsNotRealisedIncome!==true)return out;
  const primary=strategy?.income?.primary||{},wallets=Array.isArray(primary?.wallets)?primary.wallets:[];
  if(primary?.state!=='Compounded'||primary?.classification!=='embedded-lending-interest'||primary?.claimableApplicable!==false||primary?.measurementStatus!=='measured'||!lower(primary?.metric).includes('scaledbalance')||!lower(primary?.metric).includes('liquidity index')||!wallets.length)return out;
  const companyWallets=(state?.company?.wallets||[]).map(x=>lower(x?.address)).sort(),observedWallets=wallets.map(x=>lower(x?.wallet)).sort();
  if(companyWallets.length!==observedWallets.length||companyWallets.some(x=>!addressOk(x))||new Set(observedWallets).size!==observedWallets.length||JSON.stringify(companyWallets)!==JSON.stringify(observedWallets))return out;
  let totalAmount=0,positiveScaled=false,currentIndex=null;
  try{
    for(const row of wallets){
      if(row?.status!=='measured'||!rawOk(row?.scaledBalanceRaw)||!rawOk(row?.previousLiquidityIndex)||!rawOk(row?.currentLiquidityIndex)||!finite(row?.embeddedInterestSinceLastAction)||Number(row.embeddedInterestSinceLastAction)<0)return out;
      const scaled=BigInt(row.scaledBalanceRaw),previous=BigInt(row.previousLiquidityIndex),current=BigInt(row.currentLiquidityIndex);
      if(current<=0n)return out;
      if(currentIndex===null)currentIndex=current;else if(currentIndex!==current)return out;
      let amount=0;
      if(scaled>0n){
        positiveScaled=true;
        if(previous<=0n||current<previous)return out;
        const nowRaw=rayMul(scaled,current),previousRaw=rayMul(scaled,previous);
        if(nowRaw<previousRaw)return out;
        amount=Number(nowRaw-previousRaw)/1e18;
      }
      if(Number(row.embeddedInterestSinceLastAction)!==Number(amount.toFixed(12)))return out;
      totalAmount+=amount;
    }
  }catch{return out;}
  if(!positiveScaled||!finite(primary?.amount)||Number(primary.amount)!==Number(totalAmount.toFixed(12)))return out;
  const ext=strategy?.income?.externalIncentives||{},extCount=Number(ext?.rewardAssetCount),extRows=Array.isArray(ext?.rewards)?ext.rewards:[];
  if(!['none','configured'].includes(ext?.status)||!Number.isSafeInteger(extCount)||extCount<0||extRows.length!==extCount)return out;
  const c=rewards?.companies?.[company],source=(c?.sources||[]).find(x=>x?.route==='hyperlend-khype'),embeddedRows=(c?.embeddedIncome||[]).filter(x=>x?.route==='hyperlend-khype');
  if(source?.status!=='ok'||source?.protocol!=='HyperLend'||source?.chain!=='HyperEVM'||lower(source?.metric)!=='khype supply interest via scaled balance + liquidity index')return out;
  const details=source?.details||{};
  if(lower(details?.hToken)!==hToken||details?.rewardState!=='Compounded'||details?.incomeMode!=='embedded-lending-interest'||details?.claimableApplicable!==false||details?.embeddedMeasurementStatus!=='measured'||details?.externalIncentivesStatus!==ext.status||Number(details?.externalRewardAssetCount)!==extCount)return out;
  if(embeddedRows.length!==1)return out;
  const embeddedRow=embeddedRows[0];
  if(embeddedRow?.protocol!=='HyperLend'||embeddedRow?.chain!=='HyperEVM'||embeddedRow?.state!=='Compounded'||embeddedRow?.claimableApplicable!==false||embeddedRow?.classification!=='compounded-embedded'||embeddedRow?.usdValueIncludedInClaimableTotal!==false||!finite(embeddedRow?.amount)||Number(embeddedRow.amount)!==Number(primary.amount))return out;
  if(extCount>0){
    const incentiveSource=(c?.sources||[]).find(x=>x?.route==='hyperlend-khype-incentives'),incentiveRows=(c?.rewards||[]).filter(x=>x?.route==='hyperlend-khype-incentives');
    if(incentiveSource?.status!=='ok'||incentiveSource?.details?.rewardState!=='Claimable'||Number(incentiveSource?.details?.rewardAssetCount)!==extCount||incentiveRows.length!==extCount||incentiveRows.some(x=>x?.classification!=='unclaimed'||!finite(x?.amount)||Number(x.amount)<0))return out;
  }
  const observedAt=state?.provenance?.hyperlendIncome?.generatedAt||c?.updatedAt||state?.generatedAt||rewards?.generatedAt;
  if(!monthKey(observedAt))return out;
  pushTrackingProof(out,{engineId,company,observedAt,sourceFile:'companies/company-010-production-state.json#strategies.hyperlend',proofKey:`hyperlend-khype:${hToken}:${currentIndex?.toString()||'unknown'}:${wallets.length}`});
  return out;
}

export function projectXWhypeUsdcObservationProofs(state={}){
  const out=[];
  const engineId='projectx-whype-usdc',company='Cypher';
  const manager='0xead19ae861c29bbb2101e834922b2feee69b9091';
  const whype='0x5555555555555555555555555555555555555555';
  const usdc='0xb88339cb7199b77e23db6e890353e22632ba630f';
  const addressOk=v=>/^0x[0-9a-f]{40}$/.test(lower(v));
  const approx=(a,b,tolerance=1e-9)=>finite(a)&&finite(b)&&Math.abs(Number(a)-Number(b))<=tolerance;
  const strategy=state?.strategies?.projectX;
  if(state?.company?.registry!=='010'||state?.company?.name!==company||strategy?.version!=='0.1-company-010-projectx-full-parity'||strategy?.status!=='measured-principal-and-claimable'||strategy?.id!==engineId||strategy?.protocol!=='Project X'||strategy?.chain!=='HyperEVM'||strategy?.pair!=='WHYPE-USDC'||lower(strategy?.manager)!==manager)return out;
  if(state?.authority?.executionAuthority!=='none'||strategy?.authority?.readOnly!==true||strategy?.authority?.walletSigning!==false||strategy?.authority?.transactions!==false||strategy?.authority?.executionAuthority!=='none')return out;
  const boundary=strategy?.accountingBoundary||{},epistemic=state?.epistemicBoundary||{};
  if(boundary?.multiLegPrincipalComplete!==true||boundary?.dynamicActiveNftInventory!==true||boundary?.dustAndEmptyNftsExcluded!==true||boundary?.otherPairNftsExcluded!==true||boundary?.whypeRemovedFromGeneralHype!==true||boundary?.usdcIncludedInStrategyNav!==true||boundary?.strategyNavCountedOnce!==true||boundary?.claimableFeesExcludedFromCapital!==true||boundary?.noDoubleCount!==true)return out;
  if(epistemic?.unknownIsNotZero!==true||epistemic?.referenceAprIsNotRealisedIncome!==true||epistemic?.claimableRewardsAreNotRealisedCashFlow!==true||epistemic?.noDoubleCount!==true||epistemic?.projectXOnlyEconomicallyActiveNfts!==true||epistemic?.projectXActiveNftCountDynamic!==true||epistemic?.projectXDustAndEmptyNftsExcluded!==true||epistemic?.projectXOtherPairsExcluded!==true||epistemic?.projectXNonzeroLiquidityRequiresMeasuredPrincipal!==true||epistemic?.projectXClaimableFeesAreNotPrincipal!==true||epistemic?.projectXFeeTierIsNotApr!==true)return out;
  const positions=Array.isArray(strategy?.positions)?strategy.positions:[],admission=strategy?.admission||{};
  if(!positions.length||Number(strategy?.nftCount)!==positions.length||Number(admission?.actualActiveNftCount)!==positions.length||!(Number(admission?.minimumActiveNftCount)>=1)||positions.length<Number(admission.minimumActiveNftCount))return out;
  const tokenIds=positions.map(x=>String(x?.tokenId||''));
  if(tokenIds.some(x=>!/^\d+$/.test(x))||new Set(tokenIds).size!==tokenIds.length)return out;
  let principalWhype=0,principalUsdc=0,claimableWhype=0,claimableUsdc=0,navUsd=0;
  for(const row of positions){
    if(!addressOk(row?.wallet)||!/^\d+$/.test(String(row?.liquidity??''))||BigInt(String(row.liquidity))<=0n||!(Number(row?.navUsd)>0))return out;
    if(!finite(row?.principal?.WHYPE)||Number(row.principal.WHYPE)<0||!finite(row?.principal?.USDC)||Number(row.principal.USDC)<0||!finite(row?.claimable?.WHYPE)||Number(row.claimable.WHYPE)<0||!finite(row?.claimable?.USDC)||Number(row.claimable.USDC)<0)return out;
    if(!lower(row?.measurement?.principal).includes('decreaseliquidity.staticcall')||!lower(row?.measurement?.claimable).includes('collect.staticcall')||!lower(row?.measurement?.principal).includes('read-only')||!lower(row?.measurement?.claimable).includes('read-only'))return out;
    principalWhype+=Number(row.principal.WHYPE);principalUsdc+=Number(row.principal.USDC);claimableWhype+=Number(row.claimable.WHYPE);claimableUsdc+=Number(row.claimable.USDC);navUsd+=Number(row.navUsd);
  }
  const principal=strategy?.principal||{};
  if(!approx(principal?.WHYPE,principalWhype,1e-9)||!approx(principal?.USDC,principalUsdc,1e-6)||!approx(principal?.navUsd,navUsd,0.01)||!(Number(principal?.navUsd)>0)||!(Number(admission?.activeNavFloorUsd)>=0)||Number(principal.navUsd)<Number(admission.activeNavFloorUsd))return out;
  const rewards=strategy?.rewards||{},tokens=Array.isArray(rewards?.tokens)?rewards.tokens:[];
  if(rewards?.route!==engineId||rewards?.claimableApplicable!==true||rewards?.measurementStatus!=='measured'||!lower(rewards?.source).includes('collect.staticcall')||tokens.length!==2)return out;
  const bySymbol=new Map(tokens.map(x=>[String(x?.symbol||'').toUpperCase(),x]));
  const whypeRow=bySymbol.get('WHYPE'),usdcRow=bySymbol.get('USDC');
  if(!whypeRow||!usdcRow||bySymbol.size!==2||lower(whypeRow?.address)!==whype||lower(usdcRow?.address)!==usdc)return out;
  if(!approx(whypeRow?.amount,claimableWhype,1e-9)||!approx(usdcRow?.amount,claimableUsdc,1e-6))return out;
  for(const row of[whypeRow,usdcRow])if(!finite(row?.amount)||Number(row.amount)<0||!finite(row?.priceUsd)||Number(row.priceUsd)<=0||!finite(row?.usdValue)||Number(row.usdValue)<0)return out;
  if(!approx(rewards?.totalUsd,Number(whypeRow.usdValue)+Number(usdcRow.usdValue),1e-6))return out;
  const supported=(state?.rewards?.supportedRoutes||[]).find(x=>x?.id===engineId);
  if(supported?.protocol!=='Project X'||supported?.chain!=='HyperEVM'||supported?.claimableState!=='measured')return out;
  const projected=(state?.rewards?.observations||[]).filter(x=>x?.route===engineId);
  if(projected.length!==2)return out;
  for(const [symbol,expected]of[['WHYPE',whypeRow],['USDC',usdcRow]]){
    const row=projected.find(x=>String(x?.token||'').toUpperCase()===symbol);
    const expectedAddress=symbol==='WHYPE'?whype:usdc;
    if(!row||row?.protocol!=='Project X'||row?.chain!=='HyperEVM'||row?.status!=='measured'||lower(row?.tokenAddress)!==expectedAddress||!lower(row?.source).includes('collect.staticcall')||!lower(row?.method).includes('read-only'))return out;
    if(!approx(row?.claimable,expected?.amount,symbol==='WHYPE'?1e-9:1e-6)||!approx(row?.priceUsd,expected?.priceUsd,1e-8)||!approx(row?.usdValue,expected?.usdValue,1e-6))return out;
  }
  const productivity=(state?.productivity?.positions||[]).find(x=>x?.id===engineId);
  if(!productivity||productivity?.claimableApplicable!==true||productivity?.incomeMode!=='separate-claimable-fees'||!finite(productivity?.valueUsd)||!approx(productivity.valueUsd,principal.navUsd,0.01))return out;
  const observedAt=strategy?.generatedAt||state?.provenance?.projectX?.deepGeneratedAt||state?.generatedAt;
  if(!monthKey(observedAt))return out;
  pushTrackingProof(out,{engineId,company,observedAt,sourceFile:'companies/company-010-production-state.json#strategies.projectX',proofKey:`projectx-whype-usdc:${manager}:${[...tokenIds].sort().join(',')}:${observedAt}`});
  return out;
}

function strongVlCvxRouteProofs(rewards={}){
  const out=[];
  for(const[company,c]of Object.entries(rewards?.companies||{})){
    const route=c?.vlCvxRoute,current=route?.currentRoute,source=(c?.sources||[]).find(x=>x?.route==='vlcvx-current-route');
    if(route?.principalAsset!=='vlCVX'||!current?.routeId||source?.status!=='ok')continue;
    const settlement=source?.details?.settlement||{};let strong=false;
    if(current.routeId==='votium-union')strong=settlement?.forwardingEffective===true&&Number(settlement?.allocationSharePct)===100&&settlement?.unknownIsNotZero===true;
    else if(current.routeId==='stake-dao-vlcvx'){
      const root=lower(settlement?.root),activeRoot=lower(settlement?.activeRoot),claims=Array.isArray(settlement?.claims)?settlement.claims:[],provenAbsent=settlement?.entitlement==='proven-absent-from-active-root';
      strong=/^0x[0-9a-f]{64}$/.test(root)&&root===activeRoot&&settlement?.unknownIsNotZero===true&&(provenAbsent||claims.every(x=>x?.proofValid===true));
    }else if(current.routeId==='convex-finance-vlcvx'){
      strong=settlement?.evidenceClass==='factual-current-route-eligibility-boundary'&&settlement?.entitlement==='no-votium-incentive-eligibility-observed-current-route'&&settlement?.trackingBoundaryComplete===true&&settlement?.allWeightedProposalsConvexTeam===true&&settlement?.noManualOrSurrogateOverrideOnWeightedProposals===true&&Number(settlement?.manualOrSurrogateOverrideCount)===0&&Number(settlement?.nonConvexTeamWeightedProposalCount)===0&&settlement?.lockerPlatformRewardsTrackedSeparately===true&&settlement?.extraRewardDistributionTrackedSeparately===true&&settlement?.legacyResidualRewardsTrackedSeparately===true&&settlement?.periodIncomeAuthority===false&&settlement?.universalExternalRewardZeroAsserted===false&&settlement?.unknownIsNotZero===true;
    }
    if(strong)pushTrackingProof(out,{engineId:'convex_vlcvx',company,observedAt:source?.details?.settlementGeneratedAt||route?.generatedAt||c?.updatedAt||rewards?.generatedAt,sourceFile:'companies/rewards-data.json',proofKey:`vlcvx:${route?.wallet||company}:${current.routeId}`});
  }
  return out;
}

function strongCvxCrvClaimableProofs(rewards={}){
  const out=[];
  const allowedProtocols=new Set(['convex','convex · staked cvxcrv']);
  for(const[company,c]of Object.entries(rewards?.companies||{})){
    const source=(c?.sources||[]).find(x=>x?.route==='convex-staked-cvxcrv');
    if(source?.status!=='ok'||!allowedProtocols.has(lower(source?.protocol))||lower(source?.metric)!=='cvxcrvstakingwrapper earned(account)')continue;
    const details=source?.details||{},rows=(c?.rewards||[]).filter(x=>x?.route==='convex-staked-cvxcrv'),declaredCount=Number(details?.rewardCount);
    const rowsStrong=rows.every(x=>allowedProtocols.has(lower(x?.protocol))&&x?.classification==='unclaimed'&&finite(x?.amount)&&Number(x.amount)>=0);
    const strong=details?.rewardState==='Claimable'&&String(details?.stateVersion||'').length>0&&Number.isSafeInteger(declaredCount)&&declaredCount>=0&&declaredCount===rows.length&&rowsStrong;
    if(!strong)continue;
    pushTrackingProof(out,{engineId:'convex_staked_cvxcrv',company,observedAt:c?.updatedAt||rewards?.generatedAt,sourceFile:'companies/rewards-data.json',proofKey:`convex-staked-cvxcrv:${company}:${declaredCount}`});
  }
  return out;
}

function curveFeeAccrualProofs(ledger={}){
  const out=[],ext=ledger?.accountingExtensions?.curveFeeAccrual;
  const sem=ext?.semantics||{},authority=ext?.authority||{};
  if(!String(ext?.version||'').startsWith('0.1-curve-fee-distributor-'))return out;
  if(!['factual-boundary-tracking','partial-factual-boundary-tracking'].includes(ext?.status))return out;
  if(sem.openingBalanceCreatesIncome!==false||sem.currentClaimableBalanceIsPeriodIncome!==false||sem.referenceAprUsed!==false||sem.unknownIsNotZero!==true)return out;
  if(authority.executionAuthority!=='none'||authority.capitalExecution!==false)return out;
  for(const row of Array.isArray(ext?.boundaries)?ext.boundaries:[]){
    if(row?.sourceRoute!=='curve-fees'||!row?.company||!row?.wallet||!Number.isSafeInteger(Number(row?.blockNumber))||Number(row.blockNumber)<=0)continue;
    if(row?.periodIncomeAuthority!==false||row?.currentClaimableBalanceIsPeriodIncome!==false||row?.unknownIsNotZero!==true)continue;
    pushTrackingProof(out,{engineId:'curve_vecrv',company:row.company,observedAt:row.observedAt||ext.generatedAt,sourceFile:'reporting/income-ledger.json#accountingExtensions.curveFeeAccrual',proofKey:`curve-fees:${lower(row.wallet)}:${Number(row.blockNumber)}`});
  }
  return out;
}

export function factualTrackingProofs({ve33={},ve33LockedManaged={},yieldBasis={},frax={},rewards={},ledger={},icpNnsState={},icpNnsConfig={},company010State={}}={}){
  const out=[];
  const ve33Rows=[...((Array.isArray(ve33?.checkpoints)?ve33.checkpoints:[]).map(x=>({...x,__source:'reporting/ve33-accounting-evidence.json'}))),...((Array.isArray(ve33LockedManaged?.checkpoints)?ve33LockedManaged.checkpoints:[]).map(x=>({...x,__source:'reporting/ve33-locked-managed-accounting-evidence.json'})))];
  for(const row of ve33Rows){if(row?.ok===false)continue;const engineId=row?.protocolKey==='aerodrome'?'aerodrome_veaero':row?.protocolKey==='velodrome'?'velodrome_vevelo':null;pushTrackingProof(out,{engineId,company:row?.company,observedAt:row?.observedAt,sourceFile:row?.__source,proofKey:row?.checkpointKey});}
  for(const row of Array.isArray(yieldBasis?.checkpoints)?yieldBasis.checkpoints:[])pushTrackingProof(out,{engineId:'yieldbasis_veyb',company:row?.company,observedAt:row?.observedAt,sourceFile:'reporting/yield-basis-accounting-evidence.json',proofKey:row?.checkpointKey});
  for(const row of Array.isArray(frax?.checkpoints)?frax.checkpoints:[])pushTrackingProof(out,{engineId:'frax_vefrax',company:row?.company,observedAt:row?.observedAt,sourceFile:'reporting/frax-yield-accounting-evidence.json',proofKey:row?.checkpointKey});
  out.push(...strongVlCvxRouteProofs(rewards),...strongCvxCrvClaimableProofs(rewards),...pendleSPendleObservationProofs(rewards),...veniceSVvvObservationProofs(rewards),...resupplyRsupObservationProofs(rewards),...liquityLqtyObservationProofs(rewards),...hyperlendKhypeObservationProofs(company010State,rewards),...projectXWhypeUsdcObservationProofs(company010State),...curveFeeAccrualProofs(ledger),...icpNnsObservationProofs(icpNnsState,icpNnsConfig));
  return[...new Map(out.map(x=>[[x.engineId,x.company,x.month,x.proofKey].join('|'),x])).values()];
}

function mechanismCoverage({events,stateRows,trackingProofs,company,engineId,cls,month}){
  const factual=events.filter(e=>companyMatches(e?.company,company)&&monthKey(e?.economicDate||e?.periodEnd)===month&&eventMatches(e,cls));
  const state=stateRows.filter(r=>stateMatches(r,cls));
  const proofs=trackingProofs.filter(p=>p.engineId===engineId&&p.company===company&&p.month===month);
  const allMechanismEvents=events.filter(e=>companyMatches(e?.company,company)&&eventMatches(e,cls));
  const crossMonth=allMechanismEvents.filter(e=>monthKey(e?.periodStart)&&monthKey(e?.periodEnd)&&monthKey(e.periodStart)!==monthKey(e.periodEnd)&&monthKey(e?.economicDate||e?.periodEnd)===month);
  const valued=factual.filter(e=>finite(e?.usdValue)),factualTrackingActive=factual.length>0||proofs.length>0;
  const status=factual.length?'factual-period-evidence':proofs.length?'factual-tracking-no-period-event':state.length?'state-observed-not-factual-tracking':'reference-only-no-factual-tracking';
  return{status,factualTrackingActive,factualTrackingProofCount:proofs.length,factualTrackingProofSources:unique(proofs.map(p=>p.sourceFile)).sort(),factualEventCount:factual.length,factualValuedEventCount:valued.length,factualUsdSubtotal:factual.length&&valued.length===factual.length?Number(valued.reduce((s,e)=>s+Number(e.usdValue),0).toFixed(8)):null,currentStateRouteCount:state.length,crossMonthEvidenceCount:crossMonth.length,firstFactualEvidenceAt:factual.length?factual.map(e=>e?.periodStart||e?.economicDate||e?.periodEnd).filter(Boolean).sort()[0]||null:null,lastFactualEvidenceAt:factual.length?factual.map(e=>e?.periodEnd||e?.economicDate).filter(Boolean).sort().at(-1)||null:null,mechanismCompleteForMonth:false,completionBlockers:unique([...(factual.length?[]:['no-canonical-period-income-evidence']),...(factualTrackingActive?[]:['no-factual-engine-tracking-proof']),...(state.length&&!factualTrackingActive?['current-state-is-not-period-income']:[]),...(crossMonth.length?['cross-month-boundary-requires-explicit-allocation']:[]),...(cls.classified?[]:['unclassified-income-mechanism'])])};
}

function registryIdentity({productivity,ledger,embedded,name}){const pKey=preferredCompanyKey(productivity?.companies,name),lKey=preferredCompanyKey(ledger?.companies,name),candidates=[lKey?ledger?.companies?.[lKey]?.registry:null,pKey?productivity?.companies?.[pKey]?.registry:null,companyMatches(embedded?.company?.name,name)?embedded?.company?.registry:null].filter(v=>v!==null&&v!==undefined&&v!=='');return candidates.length?String(candidates[0]):null;}

function mechanismAggregate(engineId,rows,currentMonth){
  const companies=rows.map(x=>x.company).sort(),current=rows.map(x=>x.mechanism?.months?.[currentMonth]).filter(Boolean);
  const trackingCompanies=rows.filter(x=>x.mechanism?.months?.[currentMonth]?.factualTrackingActive===true).map(x=>x.company).sort();
  const eventCompanies=rows.filter(x=>(x.mechanism?.months?.[currentMonth]?.factualEventCount||0)>0).map(x=>x.company).sort();
  const stateOnlyCompanies=rows.filter(x=>x.mechanism?.months?.[currentMonth]?.status==='state-observed-not-factual-tracking').map(x=>x.company).sort();
  const referenceOnlyCompanies=rows.filter(x=>x.mechanism?.months?.[currentMonth]?.status==='reference-only-no-factual-tracking').map(x=>x.company).sort(),sample=rows[0]?.mechanism||{};
  return{engineId,accountingFamily:sample.accountingFamily||'unknown',mechanismType:sample.mechanismType||'unclassified',protocols:unique(rows.map(x=>x.mechanism?.protocol)).sort(),activeCompanyCount:companies.length,companies,knownProductiveValueUsdTotal:sumKnown(rows.map(x=>x.mechanism?.productiveValueUsd)),knownProductiveValueCompanyCount:rows.filter(x=>finite(x.mechanism?.productiveValueUsd)).length,factualTrackingCompanyCount:trackingCompanies.length,factualTrackingCompanies:trackingCompanies,factualEventCompanyCount:eventCompanies.length,factualEventCompanies:eventCompanies,factualCompanyCount:trackingCompanies.length,factualCompanies:trackingCompanies,stateOnlyCompanyCount:stateOnlyCompanies.length,stateOnlyCompanies,referenceOnlyCompanyCount:referenceOnlyCompanies.length,referenceOnlyCompanies,currentMonthFactualEventCount:current.reduce((s,x)=>s+Number(x?.factualEventCount||0),0),currentMonthFactualUsdSubtotal:current.length&&current.every(x=>x.factualEventCount===0||finite(x.factualUsdSubtotal))?Number(current.reduce((s,x)=>s+Number(x?.factualUsdSubtotal||0),0).toFixed(8)):null,reusableCoverageGap:trackingCompanies.length<companies.length,referenceMetricIsAccountingAuthority:false,completionAuthority:false};
}

function unmatchedEvents(events,mechanismRows){const known=mechanismRows.map(x=>({company:x.company,cls:{family:x.mechanism.accountingFamily,hints:x.mechanism.accountingRouteHints}}));return events.filter(e=>!known.some(k=>companyMatches(e?.company,k.company)&&eventMatches(e,k.cls)));}

export function buildAccountingCoverage({productivity={},ledger={},embedded={},factualEvidence={},generatedAt=null}={}){
  validateCanonicalLedgerContract(ledger);
  const tracking=factualTrackingProofs({...factualEvidence,ledger});
  const sourceTimes=[generatedAt,ledger?.generatedAt,productivity?.generatedAt,embedded?.generatedAt,factualEvidence?.rewards?.generatedAt,factualEvidence?.ve33?.generatedAt,factualEvidence?.ve33LockedManaged?.generatedAt,factualEvidence?.yieldBasis?.generatedAt,factualEvidence?.frax?.generatedAt,factualEvidence?.icpNnsState?.generatedAt,factualEvidence?.company010State?.provenance?.hyperlendIncome?.generatedAt,factualEvidence?.company010State?.strategies?.projectX?.generatedAt,factualEvidence?.company010State?.generatedAt].filter(Boolean).sort(),at=sourceTimes.at(-1)||new Date().toISOString(),currentMonth=monthKey(at)||new Date().toISOString().slice(0,7),events=ledger.events||[],companyNames=discoverCompanies({productivity,ledger,embedded}),companies={},flat=[];
  for(const name of companyNames){
    const months=companyMonths({productivity,ledger,embedded,name,asOfMonth:currentMonth}),stateRows=currentStateRows(ledger,name),mechanisms={};
    for(const item of mechanismInventory({productivity,embedded,company:name})){
      const monthMap={};for(const month of months)monthMap[month]=mechanismCoverage({events,stateRows,trackingProofs:tracking,company:name,engineId:item.engineId,cls:item.class,month});
      mechanisms[item.engineId]={engineId:item.engineId,principalId:item.principalId,protocol:item.protocol,accountingFamily:item.class.family,mechanismType:item.class.mechanism,classified:item.class.classified,engineStatus:item.engineStatus,productiveValueUsd:item.productiveValueUsd,inventorySource:item.inventorySource,referenceMetricIsAccountingAuthority:false,accountingRouteHints:item.class.hints,months:monthMap};
    }
    const rows=Object.values(mechanisms),currentRows=rows.map(x=>x.months[currentMonth]).filter(Boolean),sourceAliases=companySourceAliases({productivity,ledger,embedded,name});
    companies[name]={name,registry:registryIdentity({productivity,ledger,embedded,name}),discoveredDynamically:true,canonicalIdentityApplied:true,sourceAliases,mechanismInventorySource:unique(rows.map(x=>x.inventorySource)).sort(),mechanismCount:rows.length,knownProductiveValueUsdTotal:sumKnown(rows.map(x=>x.productiveValueUsd)),currentMonth,currentMonthFactualTrackingMechanismCount:currentRows.filter(x=>x.factualTrackingActive).length,currentMonthFactualEventMechanismCount:currentRows.filter(x=>x.factualEventCount>0).length,currentMonthFactualMechanismCount:currentRows.filter(x=>x.factualTrackingActive).length,currentMonthStateOnlyMechanismCount:currentRows.filter(x=>x.status==='state-observed-not-factual-tracking').length,currentMonthReferenceOnlyMechanismCount:currentRows.filter(x=>x.status==='reference-only-no-factual-tracking').length,executionAuthority:'none',mechanisms};
    for(const mechanism of rows)flat.push({company:name,mechanism});
  }
  const mechanismIds=unique(flat.map(x=>x.mechanism.engineId)).sort(),mechanisms={};for(const engineId of mechanismIds)mechanisms[engineId]=mechanismAggregate(engineId,flat.filter(x=>x.mechanism.engineId===engineId),currentMonth);
  const unmatched=unmatchedEvents(events,flat),unclassified=flat.filter(x=>x.mechanism.classified!==true),gaps=Object.values(mechanisms).filter(x=>x.reusableCoverageGap).sort((a,b)=>b.activeCompanyCount-a.activeCompanyCount||(Number(b.knownProductiveValueUsdTotal||0)-Number(a.knownProductiveValueUsdTotal||0))||a.engineId.localeCompare(b.engineId)).map((x,index)=>({rank:index+1,engineId:x.engineId,activeCompanyCount:x.activeCompanyCount,knownProductiveValueUsdTotal:x.knownProductiveValueUsdTotal,factualTrackingCompanyCount:x.factualTrackingCompanyCount,factualEventCompanyCount:x.factualEventCompanyCount,factualCompanyCount:x.factualCompanyCount,stateOnlyCompanyCount:x.stateOnlyCompanyCount,referenceOnlyCompanyCount:x.referenceOnlyCompanyCount}));
  const aliasObservations=Object.values(companies).filter(c=>(c.sourceAliases||[]).some(x=>x!==c.name)).map(c=>({canonicalName:c.name,sourceAliases:c.sourceAliases}));
  return{version:VERSION,generatedAt:at,status:'diagnostic-no-completion-authority',currentMonth,sourceFreshness:{productivityGeneratedAt:productivity?.generatedAt||null,incomeLedgerGeneratedAt:ledger?.generatedAt||null,embeddedYieldGeneratedAt:embedded?.generatedAt||null,rewardsGeneratedAt:factualEvidence?.rewards?.generatedAt||null,ve33EvidenceGeneratedAt:factualEvidence?.ve33?.generatedAt||null,ve33LockedManagedEvidenceGeneratedAt:factualEvidence?.ve33LockedManaged?.generatedAt||null,yieldBasisEvidenceGeneratedAt:factualEvidence?.yieldBasis?.generatedAt||null,fraxEvidenceGeneratedAt:factualEvidence?.frax?.generatedAt||null,icpNnsStateGeneratedAt:factualEvidence?.icpNnsState?.generatedAt||null,company010ProjectXGeneratedAt:factualEvidence?.company010State?.strategies?.projectX?.generatedAt||null,company010StateGeneratedAt:factualEvidence?.company010State?.provenance?.hyperlendIncome?.generatedAt||factualEvidence?.company010State?.generatedAt||null},semantics:{canonicalLedgerIsSoleFactualIncomeAuthority:true,productivityCoverageIsNotAccountingCoverage:true,referenceMetricIsNotEarnedIncome:true,currentRewardStateIsNotPeriodIncome:true,factualTrackingProofIsNotPeriodIncome:true,routeStateCanProveTrackingOnlyWithSettlementProof:true,unresolvedSettlementCannotProveFactualTracking:true,zeroPeriodEventDoesNotImplyCoverageGap:true,coverageGapMeansMissingFactualTrackingCapability:true,factualEvidenceDoesNotImplyFullMechanismCoverage:true,partialEvidenceDoesNotCloseMonth:true,unknownIsNotZero:true,newCompanyDoesNotRequireNewAccountingEngineWhenMechanismAlreadySupported:true,unclassifiedMechanismIsVisibleGapNotZero:true,historicalCompanyAliasesCanonicalized:true,stringAliasCannotCreateNewCompanyIdentity:true},completionPolicy:{registryHasMonthClosingAuthority:false,registryHasIncomeCreationAuthority:false,coverageGapRankingIsDiagnosticOnly:true},authority:{executionAuthority:'none',walletAuthority:'none',claimingAuthority:'none',capitalExecution:false,monthClosingAuthority:false,methodologyMutationAuthority:'none'},summary:{companyCount:companyNames.length,mechanismInstanceCount:flat.length,uniqueMechanismCount:mechanismIds.length,classifiedMechanismInstanceCount:flat.length-unclassified.length,unclassifiedMechanismInstanceCount:unclassified.length,reusableCoverageGapCount:gaps.length,canonicalLedgerEventCount:events.length,unmatchedCanonicalEventCount:unmatched.length,canonicalizedAliasCompanyCount:aliasObservations.length,factualTrackingProofCount:tracking.length},companyIdentityAliases:aliasObservations,gapRanking:gaps,unmatchedCanonicalEvents:unmatched.slice(0,50).map(e=>({eventKey:e?.eventKey||null,company:canonicalCompanyName(e?.company)||null,sourceCompany:e?.company||null,family:e?.family||null,protocol:e?.protocol||null,route:e?.route||null,sourceFile:e?.sourceFile||null})),mechanisms,companies};
}

async function main(){
  const[productivity,ledger,embedded,rewards,ve33,ve33LockedManaged,yieldBasis,frax,icpNnsState,icpNnsConfig,company010State]=await Promise.all([readJson(PRODUCTIVITY_FILE),readJson(INCOME_LEDGER_FILE),readJson(EMBEDDED_FILE),readOptionalJson(REWARDS_FILE),readOptionalJson(VE33_EVIDENCE_FILE),readOptionalJson(VE33_LOCKED_MANAGED_EVIDENCE_FILE),readOptionalJson(YIELD_BASIS_EVIDENCE_FILE),readOptionalJson(FRAX_EVIDENCE_FILE),readOptionalJson(ICP_NNS_STATE_FILE),readOptionalJson(ICP_NNS_CONFIG_FILE),readOptionalJson(COMPANY_010_STATE_FILE)]);
  const output=buildAccountingCoverage({productivity,ledger,embedded,factualEvidence:{rewards,ve33,ve33LockedManaged,yieldBasis,frax,icpNnsState,icpNnsConfig,company010State}});
  await writeJson(OUTPUT_FILE,output);
  console.log('Accounting Coverage Registry v0.7 built',{companies:output.summary.companyCount,mechanismInstances:output.summary.mechanismInstanceCount,uniqueMechanisms:output.summary.uniqueMechanismCount,coverageGaps:output.summary.reusableCoverageGapCount,unclassified:output.summary.unclassifiedMechanismInstanceCount,unmatchedLedgerEvents:output.summary.unmatchedCanonicalEventCount,canonicalizedAliasCompanies:output.summary.canonicalizedAliasCompanyCount,factualTrackingProofs:output.summary.factualTrackingProofCount,currentMonth:output.currentMonth,executionAuthority:output.authority.executionAuthority,topReusableGaps:output.gapRanking.slice(0,10)});
}

if(process.argv[1]&&path.resolve(process.argv[1])===__filename)main().catch(error=>{console.error(error);process.exitCode=1;});