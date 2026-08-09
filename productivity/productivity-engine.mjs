#!/usr/bin/env node
/**
 * The Holding · Productivity / APR Engine v1
 *
 * SIMPLE-FIRST architecture:
 *   official protocol API / onchain data / official frontend
 *        -> normalized Reference APRs
 *        -> current CoinGecko prices + COMPANY_BOOK quantities
 *        -> capital-weighted company Blended APR
 *        -> one weekly observation
 *        -> historical average APR
 *        -> productivity-data.json consumed by companies.html
 *
 * No wallet tracking. No claim tracking. No company-address dependency.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { Contract, JsonRpcProvider, formatUnits } from 'ethers';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PAGE_FILE = process.env.PAGE_FILE || path.join(ROOT, 'companies.html');
const DATA_FILE = process.env.DATA_FILE || path.join(ROOT, 'productivity-data.json');
const REPORT_FILE = process.env.REPORT_FILE || path.join(ROOT, 'productivity-source-report.json');

const SECONDS_YEAR = 365 * 24 * 60 * 60;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_REASONABLE_APR = 500;
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0 Safari/537.36';

const ETH_RPC_URLS = [
  process.env.ETH_RPC_URL,
  'https://ethereum-rpc.publicnode.com',
  'https://eth.llamarpc.com'
].filter(Boolean);

const BASE_RPC_URLS = [
  process.env.BASE_RPC_URL,
  'https://mainnet.base.org',
  'https://base-rpc.publicnode.com'
].filter(Boolean);

/* Productive principal -> engine. BTC reserve is intentionally NOT mapped:
   the current APR metric describes the productive layer, matching the existing
   Company Passport / Productivity methodology. */
const ENGINE_BY_CG_ID = {
  'aerodrome-finance': 'aerodrome_veaero',
  'convex-finance':    'convex_vlcvx',
  'curve-dao-token':   'curve_vecrv',
  'pendle':            'pendle_spendle',
  'fxn':               'fx_vefxn',
  'yield-basis':       'yieldbasis_veyb',
  'frax-share':        'frax_vefrax',
  'velodrome-finance': 'velodrome_vevelo',
  'venice-token':      'venice_svvv',
  'liquity':           'liquity_lqty',
  'resupply':          'resupply_rsup'
};

const ENGINE_META = {
  aerodrome_veaero: { protocol:'Aerodrome', principalSymbol:'AERO', sourceUrl:'https://www.40acres.finance/', nativeCadence:'weekly' },
  velodrome_vevelo: { protocol:'Velodrome', principalSymbol:'VELO', sourceUrl:'https://www.40acres.finance/', nativeCadence:'weekly' },
  convex_vlcvx:     { protocol:'Convex', principalSymbol:'CVX', sourceUrl:'https://www.convexfinance.com/lock-cvx', nativeCadence:'biweekly' },
  curve_vecrv:      { protocol:'Curve', principalSymbol:'CRV', sourceUrl:'https://classic.curve.finance/', nativeCadence:'weekly' },
  pendle_spendle:   { protocol:'Pendle', principalSymbol:'PENDLE', sourceUrl:'https://api-v2.pendle.finance/core/v1/spendle/data', nativeCadence:'14d' },
  fx_vefxn:         { protocol:'f(x)', principalSymbol:'FXN', sourceUrl:'https://fx.aladdin.club/v2/lock', nativeCadence:'weekly' },
  yieldbasis_veyb:  { protocol:'Yield Basis', principalSymbol:'YB', sourceUrl:'https://yieldbasis.com/analytics', nativeCadence:'epoch' },
  frax_vefrax:      { protocol:'Frax', principalSymbol:'FRAX', sourceUrl:'https://app.frax.finance/fxtl-vefxs', nativeCadence:'epoch' },
  venice_svvv:      { protocol:'Venice', principalSymbol:'VVV', sourceUrl:'https://venice.ai/token', nativeCadence:'continuous' },
  liquity_lqty:     { protocol:'Liquity', principalSymbol:'LQTY', sourceUrl:'https://www.liquity.org/stake', nativeCadence:'continuous/week-sampled' },
  resupply_rsup:    { protocol:'Resupply', principalSymbol:'RSUP', sourceUrl:'https://resupply.finance/governance/rsup', nativeCadence:'weekly' }
};

function nowIso() { return new Date().toISOString(); }
function round(n, d=4) { const f=10**d; return Math.round(n*f)/f; }
function saneApr(n) { return Number.isFinite(n) && n >= 0 && n <= MAX_REASONABLE_APR; }
function normalizeAprNumber(v) {
  if (v === null || v === undefined) return NaN;
  const cleaned = typeof v === 'string' ? v.replace(/,/g, '.').replace(/[%\s]/g, '') : v;
  let n = Number(cleaned);
  if (!Number.isFinite(n)) return NaN;
  // APIs commonly use decimal fractions while UIs use percentage points.
  if (n > 0 && n < 1) n *= 100;
  return saneApr(n) ? n : NaN;
}
function normalizePercentPoints(v) {
  if (v === null || v === undefined) return NaN;
  const n = Number(String(v).replace(/,/g,'.').replace(/[%\s]/g,''));
  return saneApr(n) ? n : NaN;
}
function normalizeText(s) { return String(s || '').replace(/\u00a0/g,' ').replace(/\s+/g,' ').trim(); }
function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function firstPercentAfter(text, label, maxGap=180) {
  const t = normalizeText(text);
  const re = new RegExp(escapeRe(label) + '.{0,'+maxGap+'}?([0-9]+(?:[.,][0-9]+)?)\\s*%', 'i');
  const m = t.match(re);
  return m ? normalizePercentPoints(m[1]) : NaN;
}
function firstPercentAround(text, label, radius=200) {
  const t = normalizeText(text);
  const i = t.toLowerCase().indexOf(label.toLowerCase());
  if (i < 0) return NaN;
  const chunk = t.slice(Math.max(0,i-radius), i+label.length+radius);
  const after = firstPercentAfter(chunk, label, radius);
  if (saneApr(after)) return after;
  const m = chunk.match(/([0-9]+(?:[.,][0-9]+)?)\s*%/);
  return m ? normalizePercentPoints(m[1]) : NaN;
}
function moneyAfter(text, label, maxGap=120) {
  const t=normalizeText(text);
  const re = new RegExp(escapeRe(label)+'.{0,'+maxGap+'}?\\$\\s*([0-9][0-9,]*(?:\\.[0-9]+)?)','i');
  const m=t.match(re);
  return m ? Number(m[1].replace(/,/g,'')) : NaN;
}
function percentAfter(text, label, maxGap=120) {
  return firstPercentAfter(text,label,maxGap);
}
function avg(arr) {
  const a=arr.filter(Number.isFinite);
  return a.length ? a.reduce((s,x)=>s+x,0)/a.length : NaN;
}

async function readJson(file, fallback={}) {
  try { return JSON.parse(await fs.readFile(file,'utf8')); } catch { return fallback; }
}
async function writeJson(file, data) {
  await fs.writeFile(file, JSON.stringify(data, null, 2) + '\n');
}
async function fetchJson(url, opts={}, attempts=3) {
  let last;
  for (let i=0;i<attempts;i++) {
    try {
      const c = new AbortController();
      const timer=setTimeout(()=>c.abort(), 30000);
      const r=await fetch(url,{...opts,signal:c.signal,headers:{'user-agent':USER_AGENT,'accept':'application/json',...(opts.headers||{})}});
      clearTimeout(timer);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.json();
    } catch(e) { last=e; await new Promise(r=>setTimeout(r,700*(i+1))); }
  }
  throw last;
}

async function parseCompanyBook() {
  const html = await fs.readFile(PAGE_FILE,'utf8');
  const m = html.match(/const COMPANY_BOOK\s*=\s*(\{[\s\S]*?\n\};)/);
  if (!m) throw new Error(`COMPANY_BOOK not found in ${PAGE_FILE}`);
  const expr = m[1].replace(/;\s*$/,'');
  const book = vm.runInNewContext('(' + expr + ')', Object.create(null), {timeout:1000});
  return book;
}

async function getCoinGeckoPrices(ids) {
  const unique=[...new Set(ids)].filter(Boolean);
  if (!unique.length) return {};
  const key=process.env.COINGECKO_API_KEY || '';
  const qs=new URLSearchParams({ids:unique.join(','),vs_currencies:'usd'});
  if (key) qs.set('x_cg_demo_api_key',key);
  const url='https://api.coingecko.com/api/v3/simple/price?'+qs.toString();
  const json=await fetchJson(url);
  const out={};
  for (const id of unique) if (json[id] && Number.isFinite(Number(json[id].usd))) out[id]=Number(json[id].usd);
  return out;
}

async function launchBrowser() {
  return chromium.launch({headless:true});
}

async function renderedText(browser, url, {waitMs=4500, action=null}={}) {
  const page=await browser.newPage({userAgent:USER_AGENT,viewport:{width:1440,height:1100}});
  try {
    await page.goto(url,{waitUntil:'domcontentloaded',timeout:60000});
    try { await page.waitForLoadState('networkidle',{timeout:12000}); } catch {}
    if (action) await action(page);
    if (waitMs) await page.waitForTimeout(waitMs);
    return await page.locator('body').innerText({timeout:15000});
  } finally { await page.close(); }
}

async function clickProtocol(page, name) {
  // Try semantic buttons first, then role buttons, then any visible exact text.
  for (const loc of [
    page.getByRole('button',{name,exact:true}),
    page.locator('button').filter({hasText:name}),
    page.getByText(name,{exact:true})
  ]) {
    try {
      const n=await loc.count();
      if (n) { await loc.last().click({timeout:5000}); await page.waitForTimeout(900); return true; }
    } catch {}
  }
  return false;
}

async function collect40Acres(browser, protocolName) {
  const url='https://www.40acres.finance/';
  const text=await renderedText(browser,url,{waitMs:1800,action:async page=>{
    await clickProtocol(page,protocolName);
  }});
  const t=normalizeText(text);
  // 40 Acres simulator exposes Max Borrow, LTV and gross Est. Weekly rewards.
  // Principal can be recovered as maxBorrow / LTV, avoiding fragile input selectors.
  const maxBorrow=moneyAfter(t,'max',40);
  const ltv=firstPercentAround(t,'LTV',45);
  const weekly=moneyAfter(t,'Est. Weekly',60);
  let apr=NaN;
  if (Number.isFinite(maxBorrow) && maxBorrow>0 && saneApr(ltv) && ltv>0 && Number.isFinite(weekly)) {
    const principal=maxBorrow/(ltv/100);
    apr=weekly*52/principal*100;
  }
  if (!saneApr(apr)) {
    // Some builds expose an explicit expected-return percentage instead.
    apr=firstPercentAround(t,'expected return',180);
  }
  if (!saneApr(apr)) throw new Error(`40 Acres ${protocolName}: could not parse simulator yield`);
  return {apr:round(apr),sourceType:'official-frontend',sourceMetric:'40 Acres gross expected weekly rewards annualized',details:{maxBorrow,ltv,weekly}};
}

async function collectConvex(browser) {
  const text=await renderedText(browser,'https://www.convexfinance.com/lock-cvx');
  // SIMPLE-FIRST: use the official top-level locked-CVX vAPR exactly as the user sees it.
  // Votium incentive APR is recorded as diagnostics but intentionally NOT added in v1
  // to avoid accidental double-counting.
  const base=firstPercentAfter(text,'vAPR',90);
  const votium=firstPercentAfter(text,'Last Round Incentives APR on Votium',100);
  if (!saneApr(base)) throw new Error('Convex: vAPR not found');
  return {apr:round(base),sourceType:'official-frontend',sourceMetric:'Locked CVX vAPR',details:{votiumLastRoundApr:saneApr(votium)?round(votium):null}};
}

async function collectCurve(browser) {
  const text=await renderedText(browser,'https://classic.curve.finance/',{waitMs:6000});
  const t=normalizeText(text);
  const m=t.match(/veCRV holder APY\s*:\s*([0-9]+(?:[.,][0-9]+)?)\s*%?\s*\(\s*4 weeks average\s*:\s*([0-9]+(?:[.,][0-9]+)?)\s*%/i);
  const current=m?normalizePercentPoints(m[1]):firstPercentAround(t,'veCRV holder APY',100);
  const fourWeek=m?normalizePercentPoints(m[2]):firstPercentAround(t,'4 weeks average',80);
  const apr=saneApr(fourWeek)?fourWeek:current;
  if (!saneApr(apr)) throw new Error('Curve: veCRV holder APY not found');
  return {apr:round(apr),sourceType:'official-frontend',sourceMetric:saneApr(fourWeek)?'veCRV holder APY · 4-week average':'veCRV holder APY',details:{current:saneApr(current)?round(current):null,fourWeek:saneApr(fourWeek)?round(fourWeek):null}};
}

async function collectPendle() {
  const url='https://api-v2.pendle.finance/core/v1/spendle/data';
  const j=await fetchJson(url);
  const h=j.sPendleHistoricalData || j.spendleHistoricalData || {};
  const aprs=Array.isArray(h.aprs)?h.aprs:[];
  const timestamps=Array.isArray(h.timestamps)?h.timestamps:[];
  let idx=-1;
  for (let i=aprs.length-1;i>=0;i--) {
    const a=normalizeAprNumber(aprs[i]);
    if (!saneApr(a)) continue;
    const ts=Number(timestamps[i]||0);
    if (!ts || ts*1000 <= Date.now()) { idx=i; break; }
  }
  if (idx<0) throw new Error('Pendle: no valid completed sPENDLE APR');
  const apr=normalizeAprNumber(aprs[idx]);
  return {apr:round(apr),sourceType:'official-api',sourceMetric:'sPENDLE completed epoch APR',details:{epochTimestamp:timestamps[idx]||null,historyCount:aprs.length}};
}

async function collectFx(browser) {
  const text=await renderedText(browser,'https://fx.aladdin.club/v2/lock',{waitMs:6000});
  let apr=firstPercentAfter(text,'APR',120);
  if (!saneApr(apr)) apr=firstPercentAround(text,'FXN Locker',260);
  if (!saneApr(apr)) throw new Error('f(x): veFXN APR not found');
  return {apr:round(apr),sourceType:'official-frontend',sourceMetric:'veFXN Locker APR'};
}

async function collectYieldBasis(browser) {
  const text=await renderedText(browser,'https://yieldbasis.com/analytics',{waitMs:6500});
  const apr=firstPercentAfter(text,'veYB APR',140);
  if (!saneApr(apr)) throw new Error('Yield Basis: veYB APR not found');
  return {apr:round(apr),sourceType:'official-analytics',sourceMetric:'veYB APR · current/latest epoch'};
}

async function collectFrax(browser) {
  const urls=['https://app.frax.finance/fxtl-vefxs','https://frax.com/own-frax'];
  let last='';
  for (const url of urls) {
    try {
      const text=await renderedText(browser,url,{waitMs:6500});
      last=text;
      const t=normalizeText(text);
      // Prefer an APR near the veFRAX / veFXS lock context, then a generic APR.
      let apr=firstPercentAround(t,'veFRAX',220);
      if (!saneApr(apr)) apr=firstPercentAround(t,'veFXS',220);
      if (!saneApr(apr)) apr=firstPercentAfter(t,'APR',120);
      if (saneApr(apr)) return {apr:round(apr),sourceType:'official-frontend',sourceMetric:'Fraxtal veFRAX lock APR',details:{url}};
    } catch {}
  }
  throw new Error('Frax: veFRAX APR not found on official frontend');
}

async function providerFrom(urls) {
  let last;
  for (const url of urls) {
    try {
      const p=new JsonRpcProvider(url,undefined,{staticNetwork:false});
      await p.getBlockNumber();
      return p;
    } catch(e) { last=e; }
  }
  throw last || new Error('No RPC provider available');
}

async function collectVenice() {
  const provider=await providerFrom(BASE_RPC_URLS);
  const address='0x321b7ff75154472B18EDb199033fF4D116F340Ff';
  const abi=[
    'function emissionRatePerSecond() view returns (uint256)',
    'function totalSupply() view returns (uint256)'
  ];
  const c=new Contract(address,abi,provider);
  const [rateRaw,supplyRaw]=await Promise.all([c.emissionRatePerSecond(),c.totalSupply()]);
  const rate=Number(formatUnits(rateRaw,18));
  const supply=Number(formatUnits(supplyRaw,18));
  if (!(rate>=0) || !(supply>0)) throw new Error('Venice: invalid onchain emission/supply');
  const apr=rate*SECONDS_YEAR/supply*100;
  if (!saneApr(apr)) throw new Error(`Venice: unreasonable APR ${apr}`);
  return {apr:round(apr),sourceType:'onchain',sourceMetric:'VVV emissionRatePerSecond / total sVVV supply',details:{contract:address,rpc:provider._getConnection?.().url||'base-rpc',rateVVVPerSecond:rate,totalStakedVVV:supply}};
}

async function findBlockAtOrBefore(provider,targetTs) {
  let hi=await provider.getBlockNumber();
  let lo=Math.max(0,hi-80000); // comfortably more than ~7d on Ethereum
  let blo=await provider.getBlock(lo);
  if (!blo || blo.timestamp>targetTs) lo=0;
  while (lo+1<hi) {
    const mid=Math.floor((lo+hi)/2);
    const b=await provider.getBlock(mid);
    if (!b) { hi=mid; continue; }
    if (b.timestamp<=targetTs) lo=mid; else hi=mid;
  }
  return lo;
}

async function collectLiquity(prices, previous) {
  const ethPrice=prices.ethereum;
  const lqtyPrice=prices.liquity;
  if (!(ethPrice>0) || !(lqtyPrice>0)) throw new Error('Liquity: ETH/LQTY price unavailable');
  const provider=await providerFrom(ETH_RPC_URLS);
  const address='0x4f9fbb3f1e99b56e0fe2892e623ed36a76fc605d';
  const abi=['function F_ETH() view returns (uint256)','function F_LUSD() view returns (uint256)'];
  const c=new Contract(address,abi,provider);
  const [feNowRaw,flNowRaw,blockNow]=await Promise.all([c.F_ETH(),c.F_LUSD(),provider.getBlock('latest')]);
  const feNow=Number(formatUnits(feNowRaw,18));
  const flNow=Number(formatUnits(flNowRaw,18));
  let feOld,flOld,oldTs,oldBlock=null;
  const prevState=previous?.internalState?.liquity;
  if (prevState && Number.isFinite(Number(prevState.fEth)) && Number.isFinite(Number(prevState.fLusd)) && prevState.timestamp) {
    const elapsed=(Date.now()-new Date(prevState.timestamp).getTime())/1000;
    if (elapsed > 2*24*3600 && elapsed < 21*24*3600) {
      feOld=Number(prevState.fEth); flOld=Number(prevState.fLusd); oldTs=new Date(prevState.timestamp).getTime()/1000;
    }
  }
  if (!Number.isFinite(feOld) || !Number.isFinite(flOld)) {
    const target=Math.floor(blockNow.timestamp-7*24*3600);
    oldBlock=await findBlockAtOrBefore(provider,target);
    const oldContract=new Contract(address,abi,provider);
    const [a,b,blk]=await Promise.all([
      oldContract.F_ETH({blockTag:oldBlock}),
      oldContract.F_LUSD({blockTag:oldBlock}),
      provider.getBlock(oldBlock)
    ]);
    feOld=Number(formatUnits(a,18)); flOld=Number(formatUnits(b,18)); oldTs=blk.timestamp;
  }
  const elapsed=Math.max(1,blockNow.timestamp-oldTs);
  const dEth=Math.max(0,feNow-feOld);
  const dLusd=Math.max(0,flNow-flOld);
  const yieldUsdPerLqty=dEth*ethPrice+dLusd; // V1 assumption: LUSD = $1
  const periodReturn=yieldUsdPerLqty/lqtyPrice;
  const apr=periodReturn*(SECONDS_YEAR/elapsed)*100;
  if (!saneApr(apr)) throw new Error(`Liquity: unreasonable APR ${apr}`);
  return {
    apr:round(apr), sourceType:'onchain', sourceMetric:'LQTY F_ETH + F_LUSD weekly delta annualized',
    details:{contract:address,deltaETHPerLQTY:dEth,deltaLUSDPerLQTY:dLusd,elapsedSeconds:elapsed,oldBlock,ethPrice,lqtyPrice},
    internalState:{fEth:feNow,fLusd:flNow,timestamp:new Date(blockNow.timestamp*1000).toISOString()}
  };
}

async function collectResupply(browser) {
  const urls=['https://resupply.finance/governance/rsup','https://resupply.finance/'];
  for (const url of urls) {
    try {
      const text=await renderedText(browser,url,{waitMs:6000});
      const apr=firstPercentAfter(text,'vAPR',120) || firstPercentAround(text,'Staked RSUP vAPR',180);
      if (saneApr(apr)) return {apr:round(apr),sourceType:'official-frontend',sourceMetric:'Staked RSUP vAPR',details:{url}};
    } catch {}
  }
  throw new Error('Resupply: vAPR not found');
}

async function runAdapter(engineId,{browser,prices,previous}) {
  switch(engineId) {
    case 'aerodrome_veaero': return collect40Acres(browser,'Aerodrome');
    case 'velodrome_vevelo': return collect40Acres(browser,'Velodrome');
    case 'convex_vlcvx': return collectConvex(browser);
    case 'curve_vecrv': return collectCurve(browser);
    case 'pendle_spendle': return collectPendle();
    case 'fx_vefxn': return collectFx(browser);
    case 'yieldbasis_veyb': return collectYieldBasis(browser);
    case 'frax_vefrax': return collectFrax(browser);
    case 'venice_svvv': return collectVenice();
    case 'liquity_lqty': return collectLiquity(prices,previous);
    case 'resupply_rsup': return collectResupply(browser);
    default: throw new Error(`No adapter for ${engineId}`);
  }
}

function lastGoodEngine(previous,id) {
  const p=previous?.engines?.[id];
  if (p && saneApr(Number(p.aprLatest))) return Number(p.aprLatest);
  const hist=previous?.history?.engines?.[id];
  if (Array.isArray(hist)) {
    for (let i=hist.length-1;i>=0;i--) if (saneApr(Number(hist[i].apr))) return Number(hist[i].apr);
  }
  return NaN;
}

function upsertObservation(arr,obs) {
  const out=Array.isArray(arr)?arr.slice():[];
  const i=out.findIndex(x=>x.snapshotKey===obs.snapshotKey);
  if (i>=0) out[i]=obs; else out.push(obs);
  return out.sort((a,b)=>String(a.periodEnd).localeCompare(String(b.periodEnd)));
}

function weekKey(date=new Date()) {
  // ISO week key; stable across retries during the same weekly collection window.
  const d=new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth(),date.getUTCDate()));
  const day=d.getUTCDay()||7; d.setUTCDate(d.getUTCDate()+4-day);
  const y0=new Date(Date.UTC(d.getUTCFullYear(),0,1));
  const w=Math.ceil((((d-y0)/86400000)+1)/7);
  return `${d.getUTCFullYear()}-W${String(w).padStart(2,'0')}`;
}

async function main() {
  const generatedAt=nowIso();
  const previous=await readJson(DATA_FILE,{});
  const companyBook=await parseCompanyBook();

  const priceIds=new Set(['ethereum','liquity']);
  for (const positions of Object.values(companyBook)) {
    for (const p of positions) if (ENGINE_BY_CG_ID[p.id] && p.fixed===undefined) priceIds.add(p.id);
  }
  let prices={};
  try { prices=await getCoinGeckoPrices([...priceIds]); }
  catch(e) { console.warn('[prices]',e.message); }

  let browser=null;
  try { browser=await launchBrowser(); }
  catch(e) { console.warn('[browser] Chromium unavailable:',e.message); }

  const engines={};
  const engineErrors={};
  let liquityInternal=previous?.internalState?.liquity || null;

  for (const engineId of Object.keys(ENGINE_META)) {
    const meta=ENGINE_META[engineId];
    try {
      if (!browser && ['aerodrome_veaero','velodrome_vevelo','convex_vlcvx','curve_vecrv','fx_vefxn','yieldbasis_veyb','frax_vefrax','resupply_rsup'].includes(engineId)) {
        throw new Error('browser collector unavailable');
      }
      const r=await runAdapter(engineId,{browser,prices,previous});
      if (!saneApr(r.apr)) throw new Error(`invalid APR ${r.apr}`);
      engines[engineId]={
        engineId,...meta,aprLatest:round(r.apr),sourceType:r.sourceType,sourceMetric:r.sourceMetric,
        source:meta.sourceUrl,periodStart:null,periodEnd:generatedAt,lastUpdatedAt:generatedAt,
        status:'ok',methodologyVersion:'1.0-simple',details:r.details||{}
      };
      if (r.internalState && engineId==='liquity_lqty') liquityInternal=r.internalState;
      console.log(`✓ ${engineId}: ${round(r.apr,2)}%`);
    } catch(e) {
      const stale=lastGoodEngine(previous,engineId);
      engineErrors[engineId]=e?.message||String(e);
      if (saneApr(stale)) {
        engines[engineId]={engineId,...meta,aprLatest:stale,sourceType:'last-known-good',sourceMetric:'previous valid Reference APR',source:meta.sourceUrl,periodStart:null,periodEnd:generatedAt,lastUpdatedAt:previous?.engines?.[engineId]?.lastUpdatedAt||null,status:'stale',methodologyVersion:'1.0-simple',error:engineErrors[engineId]};
        console.warn(`! ${engineId}: stale ${stale}% (${engineErrors[engineId]})`);
      } else {
        engines[engineId]={engineId,...meta,aprLatest:null,sourceType:'unavailable',sourceMetric:null,source:meta.sourceUrl,periodStart:null,periodEnd:generatedAt,lastUpdatedAt:null,status:'error',methodologyVersion:'1.0-simple',error:engineErrors[engineId]};
        console.warn(`✗ ${engineId}: ${engineErrors[engineId]}`);
      }
    }
  }
  if (browser) await browser.close();

  // Maintain engine history only for fresh successful observations.
  const historyEngines={...(previous?.history?.engines||{})};
  const snapKey=weekKey(new Date());
  for (const [id,e] of Object.entries(engines)) {
    if (e.status!=='ok' || !saneApr(Number(e.aprLatest))) continue;
    historyEngines[id]=upsertObservation(historyEngines[id],{snapshotKey:snapKey,apr:Number(e.aprLatest),periodEnd:generatedAt,sourceType:e.sourceType});
  }

  const companies={};
  const historyCompanies={...(previous?.history?.companies||{})};

  for (const [name,positions] of Object.entries(companyBook)) {
    const productive=positions.filter(p=>ENGINE_BY_CG_ID[p.id]);
    let total=0, weighted=0, covered=0;
    const breakdown=[];
    let complete=productive.length>0;

    for (const p of productive) {
      const engineId=ENGINE_BY_CG_ID[p.id];
      const e=engines[engineId];
      const price=p.fixed!==undefined ? Number(p.fixed) : Number(prices[p.id]);
      const value=Number(p.qty)*price;
      const apr=e?Number(e.aprLatest):NaN;
      const priceOk=Number.isFinite(price)&&price>0;
      const aprOk=saneApr(apr);
      if (!priceOk || !Number.isFinite(value) || value<0) complete=false;
      if (priceOk && Number.isFinite(value)) total+=value;
      if (priceOk && Number.isFinite(value) && aprOk) {
        weighted+=value*apr; covered+=value;
      } else complete=false;
      breakdown.push({engineId,principalId:p.id,units:Number(p.qty),price:priceOk?price:null,value:priceOk?round(value,2):null,apr:aprOk?apr:null,engineStatus:e?.status||'missing'});
    }

    const coverage=total>0?covered/total:0;
    const aprLatest=complete && total>0 ? weighted/total : NaN;

    if (saneApr(aprLatest)) {
      const obs={snapshotKey:snapKey,apr:round(aprLatest),periodEnd:generatedAt,totalProductiveValue:round(total,2)};
      historyCompanies[name]=upsertObservation(historyCompanies[name],obs);
    }
    const observations=(historyCompanies[name]||[]).filter(x=>saneApr(Number(x.apr)));
    const histAvg=avg(observations.map(x=>Number(x.apr)));
    const oldCompany=previous?.companies?.[name];
    const usableAverage=saneApr(histAvg);

    companies[name]={
      aprLatest:saneApr(aprLatest)?round(aprLatest):null,
      aprHistoricalAverage:usableAverage?round(histAvg):null,
      observationCount:observations.length,
      trackingStartedAt:observations[0]?.periodEnd||oldCompany?.trackingStartedAt||null,
      updatedAt:generatedAt,
      source:'the-holding-productivity-engine',
      status:(saneApr(aprLatest)&&usableAverage)?'ok':'partial',
      coverage:round(coverage,4),
      productiveValue:total>0?round(total,2):null,
      breakdown
    };
    console.log(`${companies[name].status==='ok'?'✓':'!'} ${name}: latest=${companies[name].aprLatest ?? '—'}% avg=${companies[name].aprHistoricalAverage ?? '—'}% coverage=${round(coverage*100,1)}%`);
  }

  const output={
    version:'1.0',methodologyVersion:'1.0-simple',generatedAt,snapshotKey:snapKey,
    note:'Reference APRs are normalized from official protocol APIs, onchain state, or official protocol frontends. Company APR is capital-weighted across productive positions only.',
    engines,companies,
    history:{engines:historyEngines,companies:historyCompanies},
    internalState:{liquity:liquityInternal},
    diagnostics:{engineErrors,priceTimestamp:generatedAt,pricesUsed:prices}
  };

  await writeJson(DATA_FILE,output);
  const report={generatedAt,engines:Object.fromEntries(Object.entries(engines).map(([id,e])=>[id,{protocol:e.protocol,status:e.status,apr:e.aprLatest,source:e.source,sourceType:e.sourceType,sourceMetric:e.sourceMetric,error:e.error||null,details:e.details||null}]))};
  await writeJson(REPORT_FILE,report);
  console.log(`\nWrote ${DATA_FILE}`);
  console.log(`Wrote ${REPORT_FILE}`);
}

main().catch(err=>{ console.error(err); process.exitCode=1; });
