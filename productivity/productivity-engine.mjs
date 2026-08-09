#!/usr/bin/env node
/**
 * The Holding · Productivity / APR Engine v1.5
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
import { Contract, JsonRpcProvider, Interface, formatUnits } from 'ethers';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PAGE_FILE = process.env.PAGE_FILE || path.join(ROOT, 'companies.html');
const DATA_FILE = process.env.DATA_FILE || path.join(ROOT, 'productivity-data.json');
const REPORT_FILE = process.env.REPORT_FILE || path.join(ROOT, 'productivity-source-report.json');

const SECONDS_YEAR = 365 * 24 * 60 * 60;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_REASONABLE_APR = 500;
const METHODOLOGY_VERSION = '1.1-simple-safe';
const COLLECTOR_VERSION = '1.5-pendle-merkle-audit';
const PENDLE_EPOCH_SECONDS = 14 * 24 * 60 * 60;
const CURVE_WEEK_SECONDS = 7 * 24 * 60 * 60;
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0 Safari/537.36';
const RPC_TIMEOUT_MS = 7000;
const API_TIMEOUT_MS = 15000;

const ETH_RPC_URLS = [
  process.env.ETH_RPC_URL,
  // Multiple public fallbacks. Liquity's first-run historical bootstrap may need
  // an RPC that permits older state/log queries; later weekly updates use only
  // current state and the persisted baseline.
  'https://eth.llamarpc.com',
  'https://eth.drpc.org',
  'https://1rpc.io/eth',
  'https://rpc.flashbots.net',
  'https://ethereum-rpc.publicnode.com'
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
function aprValue(v) {
  if (v === null || v === undefined || v === '') return NaN;
  const n = Number(v);
  return saneApr(n) ? n : NaN;
}
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
async function fetchJson(url, opts={}, attempts=2) {
  let last;
  for (let i=0;i<attempts;i++) {
    try {
      const c = new AbortController();
      const timer=setTimeout(()=>c.abort(), API_TIMEOUT_MS);
      const r=await fetch(url,{...opts,signal:c.signal,headers:{'user-agent':USER_AGENT,'accept':'application/json',...(opts.headers||{})}});
      clearTimeout(timer);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.json();
    } catch(e) { last=e; await new Promise(r=>setTimeout(r,700*(i+1))); }
  }
  throw last;
}


async function rpcCall(url, method, params=[], timeoutMs=RPC_TIMEOUT_MS) {
  const c=new AbortController();
  const timer=setTimeout(()=>c.abort(),timeoutMs);
  try {
    const r=await fetch(url,{
      method:'POST', signal:c.signal,
      headers:{'content-type':'application/json','accept':'application/json','user-agent':USER_AGENT},
      body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})
    });
    if (!r.ok) throw new Error(`RPC HTTP ${r.status}`);
    const j=await r.json();
    if (j?.error) throw new Error(j.error.message||`RPC error ${j.error.code}`);
    return j?.result;
  } finally { clearTimeout(timer); }
}

async function rpcBatch(url, calls, timeoutMs=10000) {
  const c=new AbortController();
  const timer=setTimeout(()=>c.abort(),timeoutMs);
  try {
    const body=calls.map((x,i)=>({jsonrpc:'2.0',id:i+1,method:x.method,params:x.params||[]}));
    const r=await fetch(url,{
      method:'POST', signal:c.signal,
      headers:{'content-type':'application/json','accept':'application/json','user-agent':USER_AGENT},
      body:JSON.stringify(body)
    });
    if (!r.ok) throw new Error(`RPC HTTP ${r.status}`);
    const j=await r.json();
    if (!Array.isArray(j)) throw new Error('RPC batch response is not an array');
    const byId=new Map(j.map(x=>[Number(x.id),x]));
    return body.map(x=>{
      const row=byId.get(Number(x.id));
      if (!row) throw new Error(`RPC batch missing id ${x.id}`);
      if (row.error) throw new Error(row.error.message||`RPC error ${row.error.code}`);
      return row.result;
    });
  } finally { clearTimeout(timer); }
}

function hexToNumber(hex) {
  if (hex===null || hex===undefined) return NaN;
  try { return Number(BigInt(hex)); } catch { return NaN; }
}

function findSemanticApr(root, terms=[]) {
  const wanted=terms.map(x=>String(x).toLowerCase());
  const seen=new Set();
  const candidates=[];
  function walk(node,path=[],depth=0) {
    if (!node || typeof node!=='object' || depth>12 || seen.has(node)) return;
    seen.add(node);
    if (!Array.isArray(node)) {
      const scalarText=Object.entries(node)
        .filter(([,v])=>['string','number','boolean'].includes(typeof v))
        .map(([k,v])=>`${k}:${v}`).join(' ').toLowerCase();
      const contextMatch=wanted.some(t=>scalarText.includes(t));
      if (contextMatch) {
        for (const [k,v] of Object.entries(node)) {
          if (!/(^|_|-)(apr|apy|vapr)(_|-|$)|apr|apy/i.test(k)) continue;
          const a=normalizeAprNumber(v);
          if (saneApr(a)) candidates.push({apr:a,path:path.concat(k).join('.'),context:scalarText.slice(0,320)});
        }
      }
    }
    for (const [k,v] of Object.entries(node)) if (v && typeof v==='object') walk(v,path.concat(k),depth+1);
  }
  walk(root);
  return candidates.sort((a,b)=>a.apr-b.apr)[0] || null;
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
    await page.goto(url,{waitUntil:'domcontentloaded',timeout:35000});
    try { await page.waitForLoadState('networkidle',{timeout:7000}); } catch {}
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
  // 40 Acres homepage simulator exposes a veNFT value indirectly through
  // max borrow + LTV, and the gross expected weekly voting rewards.
  // IMPORTANT: parse "30% LTV" specifically. v1 accidentally picked the
  // nearby 0.8% origination fee and understated APR by ~100x.
  const maxBorrow=moneyAfter(t,'max',40);
  const ltvMatch=t.match(/([0-9]+(?:[.,][0-9]+)?)\s*%\s*LTV/i);
  const ltv=ltvMatch?normalizePercentPoints(ltvMatch[1]):NaN;
  const weekly=moneyAfter(t,'Est. Weekly',60);
  let apr=NaN, principal=NaN;
  if (Number.isFinite(maxBorrow) && maxBorrow>0 && saneApr(ltv) && ltv>0 && Number.isFinite(weekly) && weekly>=0) {
    principal=maxBorrow/(ltv/100);
    apr=weekly*52/principal*100;
  }
  if (!saneApr(apr)) apr=firstPercentAround(t,'expected return',180);
  if (!saneApr(apr)) throw new Error(`40 Acres ${protocolName}: could not parse reference yield`);
  return {
    apr:round(apr), source:'https://www.40acres.finance/', sourceType:'official-frontend',
    sourceMetric:'40 Acres simulator gross expected weekly voting rewards annualized',
    details:{maxBorrow,ltv,weekly,impliedVeNftValue:Number.isFinite(principal)?round(principal,2):null}
  };
}

async function collectConvex(browser) {
  const url='https://www.convexfinance.com/lock-cvx';
  const text=await renderedText(browser,url,{waitMs:5500});
  const base=firstPercentAfter(text,'vAPR',100);
  const votium=firstPercentAfter(text,'Last Round Incentives APR on Votium',120);
  // User strategy is vlCVX delegated to Votium. Convex presents platform-fee
  // vAPR and Votium voting incentives as separate economic components.
  if (!saneApr(votium) && !saneApr(base)) throw new Error('Convex: vAPR/Votium APR not found');
  const apr=(saneApr(base)?base:0)+(saneApr(votium)?votium:0);
  if (!saneApr(apr)) throw new Error('Convex: invalid combined vlCVX APR');
  return {
    apr:round(apr), source:url, sourceType:'official-frontend',
    sourceMetric:'Locked CVX platform vAPR + last completed Votium incentives APR',
    details:{platformVapr:saneApr(base)?round(base):null,votiumLastRoundApr:saneApr(votium)?round(votium):null}
  };
}

async function collectCurve(browser, prices) {
  // V1.3: use bounded raw JSON-RPC batch calls. This keeps Curve fully onchain
  // but guarantees a dead public RPC cannot hold the whole GitHub Action open.
  const crvPrice=Number(prices['curve-dao-token']);
  const distributor='0xD16d5eC345Dd86Fb63C6a9C43c517210F1027914';
  if (crvPrice>0) {
    const iface=new Interface([
      'function tokens_per_week(uint256) view returns (uint256)',
      'function ve_supply(uint256) view returns (uint256)',
      'function last_token_time() view returns (uint256)'
    ]);
    const now=Math.floor(Date.now()/1000);
    const currentWeek=Math.floor(now/CURVE_WEEK_SECONDS)*CURVE_WEEK_SECONDS;
    const weeks=Array.from({length:10},(_,i)=>currentWeek-(i+1)*CURVE_WEEK_SECONDS);
    const calls=[
      {method:'eth_call',params:[{to:distributor,data:iface.encodeFunctionData('last_token_time',[])},'latest']},
      ...weeks.flatMap(week=>[
        {method:'eth_call',params:[{to:distributor,data:iface.encodeFunctionData('tokens_per_week',[week])},'latest']},
        {method:'eth_call',params:[{to:distributor,data:iface.encodeFunctionData('ve_supply',[week])},'latest']}
      ])
    ];
    const rpcErrors=[];
    for (const url of ETH_RPC_URLS.slice(0,5)) {
      try {
        const out=await rpcBatch(url,calls,10000);
        const lastTokenTime=Number(iface.decodeFunctionResult('last_token_time',out[0])[0]);
        const weekly=[];
        let k=1;
        for (const week of weeks) {
          const tokensRaw=iface.decodeFunctionResult('tokens_per_week',out[k++])[0];
          const veRaw=iface.decodeFunctionResult('ve_supply',out[k++])[0];
          if (lastTokenTime && week>Math.floor(lastTokenTime/CURVE_WEEK_SECONDS)*CURVE_WEEK_SECONDS) continue;
          const tokens=Number(formatUnits(tokensRaw,18));
          const veSupply=Number(formatUnits(veRaw,18));
          if (!(tokens>0) || !(veSupply>0)) continue;
          const apr=(tokens/veSupply)/crvPrice*52*100;
          if (!saneApr(apr)) continue;
          weekly.push({week,tokensCrvUSD:tokens,veSupply,apr:round(apr)});
          if (weekly.length>=4) break;
        }
        if (weekly.length) {
          const apr=avg(weekly.map(x=>x.apr));
          if (saneApr(apr)) return {
            apr:round(apr),
            source:`https://etherscan.io/address/${distributor}`,
            sourceType:'onchain',
            sourceMetric:weekly.length>=4?'veCRV crvUSD fee APR · 4 completed weeks average':'veCRV crvUSD fee APR · completed weeks average',
            periodStart:new Date(Math.min(...weekly.map(x=>x.week))*1000).toISOString(),
            periodEnd:new Date((Math.max(...weekly.map(x=>x.week))+CURVE_WEEK_SECONDS)*1000).toISOString(),
            details:{contract:distributor,rpc:url,crvPrice,crvUSDPriceAssumption:1,weeksUsed:weekly.length,lastTokenTime,weekly}
          };
        }
      } catch(e) { rpcErrors.push(`${url}: ${e?.message||e}`); }
    }
  }

  // Conservative official-frontend fallback, still bounded by Playwright timeouts.
  if (browser) {
    const urls=['https://classic.curve.finance/usecrv','https://classic.curve.finance/'];
    for (const url of urls) {
      try {
        const text=await renderedText(browser,url,{waitMs:4500});
        const t=normalizeText(text);
        const m=t.match(/veCRV holder APY\s*:?\s*([0-9]+(?:[.,][0-9]+)?)\s*%?\s*\(\s*4 weeks average\s*:?\s*([0-9]+(?:[.,][0-9]+)?)\s*%/i);
        const current=m?normalizePercentPoints(m[1]):firstPercentAround(t,'veCRV holder APY',130);
        const fourWeek=m?normalizePercentPoints(m[2]):firstPercentAround(t,'4 weeks average',100);
        const apr=saneApr(fourWeek)?fourWeek:current;
        if (saneApr(apr)) return {
          apr:round(apr), source:url, sourceType:'official-frontend',
          sourceMetric:saneApr(fourWeek)?'veCRV holder APY · 4-week average':'veCRV holder APY',
          details:{current:saneApr(current)?round(current):null,fourWeek:saneApr(fourWeek)?round(fourWeek):null}
        };
      } catch {}
    }
  }
  throw new Error('Curve: bounded onchain RPC + official frontend fallback unavailable');
}

async function discoverLatestPendleMerkleCampaign(now=Math.floor(Date.now()/1000)) {
  // Pendle publishes the actual sPENDLE Merkle distributions in its official
  // GitHub repository. These files give us a second first-party truth layer:
  // exact distribution window + exact amount of sPENDLE allocated to holders.
  // We use it to audit the API, NOT to invent a denominator that Pendle has not
  // published historically.
  const token='0x999999999991e178d52cd95afd4b00d066664144';
  const repoApi='https://api.github.com/repos/pendle-finance/merkle-distributions/contents/vependle-airdrop/1';
  const rows=await fetchJson(repoApi,{headers:{'accept':'application/vnd.github+json'}},2);
  if (!Array.isArray(rows)) throw new Error('Pendle Merkle: repository directory listing unavailable');

  const names=rows
    .filter(x=>x?.type==='dir' && /^\d{4}-\d{2}-\d{2}-spendle$/i.test(String(x?.name||'')))
    .map(x=>String(x.name))
    .sort((a,b)=>b.localeCompare(a));

  for (const name of names.slice(0,8)) {
    try {
      const raw=`https://raw.githubusercontent.com/pendle-finance/merkle-distributions/main/vependle-airdrop/1/${name}/campaign.json`;
      const campaign=await fetchJson(raw,{},2);
      const distributions=Array.isArray(campaign?.distributions)?campaign.distributions:[];
      const d=distributions.find(x=>String(x?.token||'').toLowerCase()===token);
      if (!d) continue;
      const fromTimestamp=Number(d.fromTimestamp||0);
      const toTimestamp=Number(d.toTimestamp||0);
      if (!(fromTimestamp>0) || !(toTimestamp>fromTimestamp) || toTimestamp>now) continue;
      let distributedSPendle=NaN;
      try { distributedSPendle=Number(formatUnits(BigInt(String(d.sumAmount)),18)); } catch {}
      if (!(distributedSPendle>=0)) continue;
      const desc=String(d.description||'');
      const startBlock=Number(desc.match(/blockNumberStart:\s*(\d+)/i)?.[1]||NaN);
      const endBlock=Number(desc.match(/blockNumberEnd:\s*(\d+)/i)?.[1]||NaN);
      return {
        campaign:name, source:raw, merkleRoot:campaign?.merkleRoot||null,
        fromTimestamp,toTimestamp,distributedSPendle,
        blockNumberStart:Number.isFinite(startBlock)?startBlock:null,
        blockNumberEnd:Number.isFinite(endBlock)?endBlock:null,
        userCount:d.users && typeof d.users==='object'?Object.keys(d.users).length:null
      };
    } catch {}
  }
  throw new Error('Pendle Merkle: no fully completed sPENDLE campaign found');
}

function pendleTokenUnits18(v) {
  try { return Number(formatUnits(BigInt(String(v)),18)); } catch { return NaN; }
}

async function collectPendle(previous) {
  const url='https://api-v2.pendle.finance/core/v1/spendle/data';
  const j=await fetchJson(url);
  const h=j.sPendleHistoricalData || j.spendleHistoricalData || {};
  const aprs=Array.isArray(h.aprs)?h.aprs:[];
  const timestamps=Array.isArray(h.timestamps)?h.timestamps:[];
  const revenues=Array.isArray(h.revenues)?h.revenues:[];
  const buybackAmounts=Array.isArray(h.buybackAmounts)?h.buybackAmounts:[];
  const now=Math.floor(Date.now()/1000);

  const totalStakedInSpendle=pendleTokenUnits18(j.totalStakedInSpendle);
  const virtualSpendleFromVependle=pendleTokenUnits18(j.virtualSpendleFromVependle);
  const totalPendleStaked=pendleTokenUnits18(j.totalPendleStaked);
  const currentEffectiveSupply=(Number.isFinite(totalStakedInSpendle)?totalStakedInSpendle:0)+
    (Number.isFinite(virtualSpendleFromVependle)?virtualSpendleFromVependle:0);

  // Preserve a Holding-owned audit trail of the current denominator components.
  // IMPORTANT: this is diagnostic state only. It is NOT substituted for a
  // historical active-sPENDLE snapshot, because Pendle rewards use the exact
  // active balance snapshot for each 14-day epoch (including virtual sPENDLE).
  const currentSupplySnapshot={
    snapshotKey:weekKey(new Date(now*1000)),
    observedAt:now,
    periodEnd:new Date(now*1000).toISOString(),
    totalPendleStaked:Number.isFinite(totalPendleStaked)?totalPendleStaked:null,
    totalStakedInSpendle:Number.isFinite(totalStakedInSpendle)?totalStakedInSpendle:null,
    virtualSpendleFromVependle:Number.isFinite(virtualSpendleFromVependle)?virtualSpendleFromVependle:null,
    currentEffectiveSupply:Number.isFinite(currentEffectiveSupply)&&currentEffectiveSupply>0?currentEffectiveSupply:null
  };
  const previousSnapshots=Array.isArray(previous?.internalState?.pendle?.snapshots)
    ? previous.internalState.pendle.snapshots.filter(Boolean)
    : [];
  const snapshotIndex=previousSnapshots.findIndex(x=>x?.snapshotKey===currentSupplySnapshot.snapshotKey);
  const snapshots=previousSnapshots.slice();
  if (snapshotIndex>=0) snapshots[snapshotIndex]=currentSupplySnapshot; else snapshots.push(currentSupplySnapshot);
  snapshots.sort((a,b)=>Number(a?.observedAt||0)-Number(b?.observedAt||0));
  const internalState={...currentSupplySnapshot,snapshots:snapshots.slice(-16)};

  // Pendle takes an active-sPENDLE snapshot every 14 days and distributes on
  // that cadence. A timestamp that has merely STARTED is not a completed epoch.
  const candidates=[];
  for (let i=0;i<aprs.length;i++) {
    const a=normalizeAprNumber(aprs[i]);
    const ts=Number(timestamps[i]||0);
    if (!saneApr(a) || !ts) continue;
    const completedAt=ts+PENDLE_EPOCH_SECONDS;
    if (completedAt>now) continue;
    candidates.push({
      i,apr:a,ts,completedAt,
      revenue:Number(revenues[i]),
      buybackAmount:Number(buybackAmounts[i])
    });
  }
  if (!candidates.length) throw new Error('Pendle: no fully completed sPENDLE epoch in API history');
  candidates.sort((a,b)=>b.ts-a.ts);

  // Independent first-party audit layer: exact Merkle distribution published
  // by Pendle. Failure to reach GitHub must never break the main API adapter.
  let merkle=null, merkleError=null, merkleApiMatch=null;
  try {
    merkle=await discoverLatestPendleMerkleCampaign(now);
    const eligible=candidates
      .filter(x=>Number.isFinite(x.buybackAmount) && x.buybackAmount>0)
      .map(x=>({x,diff:Math.abs(x.buybackAmount-merkle.distributedSPendle)}))
      .sort((a,b)=>a.diff-b.diff);
    if (eligible.length) {
      const best=eligible[0];
      const tolerance=Math.max(0.02,Math.abs(merkle.distributedSPendle)*1e-8);
      if (best.diff<=tolerance) merkleApiMatch={
        apiIndex:best.x.i,
        apiEpochTimestamp:best.x.ts,
        apiEpochCompletedAt:best.x.completedAt,
        apiBuybackAmount:best.x.buybackAmount,
        apiRevenue:Number.isFinite(best.x.revenue)?best.x.revenue:null,
        apiPublishedApr:best.x.apr,
        absoluteDifference:best.diff
      };
    }
  } catch(e) { merkleError=e?.message||String(e); }

  // If Pendle publishes a positive APR for a fully completed epoch, keep using
  // that official value. Merkle data is attached as an audit cross-check.
  const positive=candidates.find(x=>x.apr>0);
  if (positive) {
    return {
      apr:round(positive.apr), source:url, sourceType:'official-api',
      sourceMetric:'sPENDLE latest fully completed 14-day epoch APR · Merkle-audited',
      periodStart:new Date(positive.ts*1000).toISOString(),
      periodEnd:new Date(positive.completedAt*1000).toISOString(),
      details:{
        epochTimestamp:positive.ts,epochCompletedAt:positive.completedAt,historyCount:aprs.length,selectedIndex:positive.i,
        revenue:Number.isFinite(positive.revenue)?positive.revenue:null,
        buybackAmount:Number.isFinite(positive.buybackAmount)?positive.buybackAmount:null,
        selectionRule:positive===candidates[0]?'latest-completed-positive-apr':'latest-completed-positive-apr-fallback',
        merkle,merkleApiMatch,merkleError,
        denominatorPolicy:'Historical active-sPENDLE snapshot required; current supply is diagnostic only',
        currentSupply:internalState
      },
      internalState
    };
  }

  const latest=candidates[0];
  const revenue=Number(latest.revenue);
  const merkleReward=Number(merkle?.distributedSPendle);
  const independentlyPositiveReward=Boolean(merkleApiMatch && merkleApiMatch.apiIndex===latest.i && Number.isFinite(merkleReward) && merkleReward>0);

  // Strong guard: zero published APR cannot be treated as genuine when either
  // the API reports positive epoch revenue OR Pendle's own Merkle repository
  // proves a positive sPENDLE distribution. This makes v1.5 fail-safe across
  // two independent first-party data surfaces.
  if (latest.apr===0 && ((Number.isFinite(revenue)&&revenue>0) || independentlyPositiveReward)) {
    return {
      notReady:true, source:url, sourceType:'official-api+official-merkle',
      sourceMetric:'sPENDLE APR withheld · zero API APR conflicts with positive first-party rewards',
      periodStart:new Date(latest.ts*1000).toISOString(),
      periodEnd:new Date(latest.completedAt*1000).toISOString(),
      details:{
        epochTimestamp:latest.ts,epochCompletedAt:latest.completedAt,historyCount:aprs.length,selectedIndex:latest.i,
        publishedApr:0,revenue:Number.isFinite(revenue)?revenue:null,
        buybackAmount:Number.isFinite(latest.buybackAmount)?latest.buybackAmount:null,
        selectionRule:'zero-apr-positive-reward-dual-source-guard',
        merkle,merkleApiMatch,merkleError,
        denominatorPolicy:'No reconstructed APR until the exact historical ACTIVE sPENDLE snapshot (including virtual sPENDLE) is available',
        currentSupply:internalState,
        recentCompleted:candidates.slice(0,4).map(x=>({
          index:x.i,apr:x.apr,
          revenue:Number.isFinite(x.revenue)?x.revenue:null,
          buybackAmount:Number.isFinite(x.buybackAmount)?x.buybackAmount:null,
          periodStart:new Date(x.ts*1000).toISOString(),periodEnd:new Date(x.completedAt*1000).toISOString()
        }))
      },
      internalState
    };
  }

  // Genuine zero: completed epoch has zero APR and no positive reward signal
  // from either official source.
  return {
    apr:0, source:url, sourceType:'official-api+official-merkle',
    sourceMetric:'sPENDLE latest fully completed 14-day epoch APR · dual-source verified zero',
    periodStart:new Date(latest.ts*1000).toISOString(),
    periodEnd:new Date(latest.completedAt*1000).toISOString(),
    details:{
      epochTimestamp:latest.ts,epochCompletedAt:latest.completedAt,historyCount:aprs.length,selectedIndex:latest.i,
      revenue:Number.isFinite(revenue)?revenue:null,
      buybackAmount:Number.isFinite(latest.buybackAmount)?latest.buybackAmount:null,
      selectionRule:'genuine-zero-dual-source',merkle,merkleApiMatch,merkleError,currentSupply:internalState
    },
    internalState
  };
}

async function collectFx(browser) {
  const text=await renderedText(browser,'https://fx.aladdin.club/v2/lock',{waitMs:6000});
  let apr=firstPercentAfter(text,'APR',120);
  if (!saneApr(apr)) apr=firstPercentAround(text,'FXN Locker',260);
  if (!saneApr(apr)) throw new Error('f(x): veFXN APR not found');
  return {apr:round(apr),sourceType:'official-frontend',sourceMetric:'veFXN Locker APR'};
}

async function collectYieldBasis(browser) {
  const url='https://yieldbasis.com/analytics';
  const text=await renderedText(browser,url,{waitMs:5000,action:async page=>{
    // veYB APR is on a dedicated analytics tab, not necessarily rendered on the default Markets tab.
    for (const label of ['VeYB Revenue','veYB Revenue','Locks']) {
      try {
        const loc=page.getByText(label,{exact:false});
        if (await loc.count()) { await loc.first().click({timeout:5000}); await page.waitForTimeout(1800); break; }
      } catch {}
    }
  }});
  const t=normalizeText(text);
  let apr=firstPercentAfter(t,'veYB APR',180);
  if (!saneApr(apr)) apr=firstPercentAround(t,'veYB APR',220);
  if (!saneApr(apr)) throw new Error('Yield Basis: veYB APR not found after opening revenue tab');
  return {apr:round(apr),source:url,sourceType:'official-analytics',sourceMetric:'veYB APR · current/latest epoch'};
}

async function collectFrax(browser) {
  // First try Frax's own public APIs. They are more stable than DOM scraping.
  for (const url of ['https://api.frax.finance/combineddata/','https://api.frax.finance/pools']) {
    try {
      const j=await fetchJson(url);
      const c=findSemanticApr(j,['vefrax','vefxs','fraxtal vefxs']);
      if (c && saneApr(c.apr)) return {
        apr:round(c.apr), source:url, sourceType:'official-api', sourceMetric:'Fraxtal veFRAX/veFXS APR',
        details:{path:c.path}
      };
    } catch {}
  }
  // Frontend fallback.
  const urls=['https://app.frax.finance/fxtl-vefxs','https://frax.com/own-frax'];
  for (const url of urls) {
    try {
      const text=await renderedText(browser,url,{waitMs:8000});
      const t=normalizeText(text);
      let apr=firstPercentAround(t,'veFRAX',260);
      if (!saneApr(apr)) apr=firstPercentAround(t,'veFXS',260);
      if (!saneApr(apr)) apr=firstPercentAfter(t,'APR',160);
      if (saneApr(apr)) return {apr:round(apr),source:url,sourceType:'official-frontend',sourceMetric:'Fraxtal veFRAX lock APR'};
    } catch {}
  }
  throw new Error('Frax: veFRAX APR not found in official API/frontend');
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

async function collectLiquity(prices, previous) {
  const ethPrice=Number(prices.ethereum);
  const lqtyPrice=Number(prices.liquity);
  if (!(ethPrice>0) || !(lqtyPrice>0)) throw new Error('Liquity: ETH/LQTY price unavailable');
  const address='0x4f9fbb3f1e99b56e0fe2892e623ed36a76fc605d';
  const iface=new Interface([
    'function F_ETH() view returns (uint256)',
    'function F_LUSD() view returns (uint256)'
  ]);

  async function readCurrent(url) {
    // Current-state only. No archive lookups and no binary block search.
    const [blockHex,feHex,flHex]=await rpcBatch(url,[
      {method:'eth_getBlockByNumber',params:['latest',false]},
      {method:'eth_call',params:[{to:address,data:iface.encodeFunctionData('F_ETH',[])},'latest']},
      {method:'eth_call',params:[{to:address,data:iface.encodeFunctionData('F_LUSD',[])},'latest']}
    ],9000);
    if (!blockHex?.timestamp || !blockHex?.number) throw new Error('latest block unavailable');
    const feRaw=iface.decodeFunctionResult('F_ETH',feHex)[0];
    const flRaw=iface.decodeFunctionResult('F_LUSD',flHex)[0];
    return {
      url,
      fEth:Number(formatUnits(feRaw,18)),
      fLusd:Number(formatUnits(flRaw,18)),
      blockNumber:hexToNumber(blockHex.number),
      timestamp:hexToNumber(blockHex.timestamp)
    };
  }

  let current=null;
  const currentErrors=[];
  for (const url of ETH_RPC_URLS.slice(0,5)) {
    try { current=await readCurrent(url); break; }
    catch(e) { currentErrors.push(`${url}: ${e?.message||e}`); }
  }
  if (!current) throw new Error(`Liquity: current F_ETH/F_LUSD unavailable on bounded RPC fallbacks · ${currentErrors.join(' | ')}`);

  function baselineTimestamp(base) {
    const numeric=Number(base?.timestamp);
    if (Number.isFinite(numeric) && numeric>0) return numeric;
    const parsed=Date.parse(String(base?.timestamp||''));
    return Number.isFinite(parsed) ? Math.floor(parsed/1000) : NaN;
  }

  function calculateFromBaseline(base, method) {
    const baseTs=baselineTimestamp(base);
    const elapsed=current.timestamp-baseTs;
    if (!(elapsed>0)) return null;
    const dEth=Math.max(0,current.fEth-Number(base.fEth));
    const dLusd=Math.max(0,current.fLusd-Number(base.fLusd));
    const yieldUsdPerLqty=dEth*ethPrice+dLusd; // V1 simplification: LUSD = $1
    const periodReturn=yieldUsdPerLqty/lqtyPrice;
    const apr=periodReturn*(SECONDS_YEAR/elapsed)*100;
    if (!saneApr(apr)) return null;
    return {
      apr:round(apr), source:'https://docs.liquity.org/liquity-v1/faq/staking',
      sourceType:'onchain', sourceMetric:'LQTY F_ETH + F_LUSD observed-period delta annualized',
      periodStart:new Date(baseTs*1000).toISOString(),
      periodEnd:new Date(current.timestamp*1000).toISOString(),
      details:{contract:address,rpc:current.url,baselineMethod:method,deltaETHPerLQTY:dEth,deltaLUSDPerLQTY:dLusd,elapsedSeconds:elapsed,ethPrice,lqtyPrice},
      internalState:{fEth:current.fEth,fLusd:current.fLusd,timestamp:current.timestamp,blockNumber:current.blockNumber,rpc:current.url}
    };
  }

  const prev=previous?.internalState?.liquity;
  const prevTs=baselineTimestamp(prev);
  if (prev && Number.isFinite(Number(prev.fEth)) && Number.isFinite(Number(prev.fLusd)) && Number.isFinite(prevTs)) {
    const age=current.timestamp-prevTs;
    if (age>=5*24*3600 && age<=21*24*3600) {
      const calculated=calculateFromBaseline({...prev,timestamp:prevTs},'persisted-weekly-baseline');
      if (calculated) return calculated;
    }
    if (age>0 && age<5*24*3600) {
      const previousApr=aprValue(previous?.engines?.liquity_lqty?.aprLatest);
      if (saneApr(previousApr)) {
        return {
          apr:previousApr,
          source:'https://docs.liquity.org/liquity-v1/faq/staking',
          sourceType:'carry-forward',
          sourceMetric:'previous observed LQTY staking APR · awaiting next full weekly interval',
          periodStart:new Date(prevTs*1000).toISOString(), periodEnd:new Date(current.timestamp*1000).toISOString(),
          details:{contract:address,rpc:current.url,baselineAgeSeconds:age,reason:'Existing baseline is younger than 5 days; previous validated APR carried forward'},
          internalState:prev
        };
      }
      return {
        apr:null, notReady:true,
        source:'https://docs.liquity.org/liquity-v1/faq/staking',
        sourceType:'onchain-baseline',
        sourceMetric:'LQTY F_ETH + F_LUSD baseline maturing; APR starts after observed period',
        periodStart:new Date(prevTs*1000).toISOString(), periodEnd:new Date(current.timestamp*1000).toISOString(),
        details:{contract:address,rpc:current.url,baselineAgeSeconds:age,reason:'Existing baseline is younger than 5 days and is intentionally preserved'},
        internalState:prev
      };
    }
    // A very old baseline is intentionally reset rather than annualizing an
    // unrepresentative multi-week gap.
    if (age>21*24*3600) {
      return {
        apr:null, notReady:true,
        source:'https://docs.liquity.org/liquity-v1/faq/staking',
        sourceType:'onchain-baseline',
        sourceMetric:'LQTY baseline refreshed after long observation gap',
        periodStart:new Date(current.timestamp*1000).toISOString(), periodEnd:new Date(current.timestamp*1000).toISOString(),
        details:{contract:address,rpc:current.url,reason:'Previous baseline older than 21 days; clean baseline restarted'},
        internalState:{fEth:current.fEth,fLusd:current.fLusd,timestamp:current.timestamp,blockNumber:current.blockNumber,rpc:current.url}
      };
    }
  }

  // V1.3 deliberately does NOT bootstrap from historical/archive RPC state.
  // The v1.2 attempt proved that public archive fallbacks can stall a whole
  // GitHub Action. A clean Holding-owned baseline is slower by one week but is
  // deterministic, free, auditable, and safe.
  return {
    apr:null, notReady:true,
    source:'https://docs.liquity.org/liquity-v1/faq/staking',
    sourceType:'onchain-baseline',
    sourceMetric:'LQTY F_ETH + F_LUSD baseline initialized; APR starts after observed period',
    periodStart:new Date(current.timestamp*1000).toISOString(), periodEnd:new Date(current.timestamp*1000).toISOString(),
    details:{contract:address,rpc:current.url,reason:'Archive bootstrap disabled in v1.3; Holding-owned weekly baseline initialized'},
    internalState:{fEth:current.fEth,fLusd:current.fLusd,timestamp:current.timestamp,blockNumber:current.blockNumber,rpc:current.url}
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
    case 'curve_vecrv': return collectCurve(browser,prices);
    case 'pendle_spendle': return collectPendle(previous);
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
  const current=aprValue(p?.aprLatest);
  if (saneApr(current)) return current;
  const hist=previous?.history?.engines?.[id];
  if (Array.isArray(hist)) {
    for (let i=hist.length-1;i>=0;i--) {
      const a=aprValue(hist[i]?.apr);
      if (saneApr(a)) return a;
    }
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
  const previousRaw=await readJson(DATA_FILE,{});
  const previous=previousRaw?.methodologyVersion===METHODOLOGY_VERSION ? previousRaw : {};
  if (previousRaw?.methodologyVersion && previousRaw.methodologyVersion!==METHODOLOGY_VERSION) {
    console.warn(`[migration] Resetting v1.0 test history before first trusted v1.1 snapshot (${previousRaw.methodologyVersion} -> ${METHODOLOGY_VERSION})`);
  }
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
  let pendleInternal=previous?.internalState?.pendle || null;

  for (const engineId of Object.keys(ENGINE_META)) {
    const meta=ENGINE_META[engineId];
    try {
      if (!browser && ['aerodrome_veaero','velodrome_vevelo','convex_vlcvx','fx_vefxn','yieldbasis_veyb','frax_vefrax','resupply_rsup'].includes(engineId)) {
        throw new Error('browser collector unavailable');
      }
      const r=await runAdapter(engineId,{browser,prices,previous});
      if (r?.internalState && engineId==='liquity_lqty') liquityInternal=r.internalState;
      if (r?.internalState && engineId==='pendle_spendle') pendleInternal=r.internalState;
      if (r?.notReady) {
        engines[engineId]={
          engineId,...meta,aprLatest:null,sourceType:r.sourceType,sourceMetric:r.sourceMetric,
          source:r.source||meta.sourceUrl,periodStart:r.periodStart||null,periodEnd:r.periodEnd||generatedAt,lastUpdatedAt:generatedAt,
          status:'warming',methodologyVersion:METHODOLOGY_VERSION,collectorVersion:COLLECTOR_VERSION,details:r.details||{}
        };
        console.warn(`… ${engineId}: source not ready; waiting for a valid observed period`);
        continue;
      }
      if (!saneApr(r.apr)) throw new Error(`invalid APR ${r.apr}`);
      engines[engineId]={
        engineId,...meta,aprLatest:round(r.apr),sourceType:r.sourceType,sourceMetric:r.sourceMetric,
        source:r.source||meta.sourceUrl,periodStart:r.periodStart||null,periodEnd:r.periodEnd||generatedAt,lastUpdatedAt:generatedAt,
        status:'ok',methodologyVersion:METHODOLOGY_VERSION,collectorVersion:COLLECTOR_VERSION,details:r.details||{}
      };
            console.log(`✓ ${engineId}: ${round(r.apr,2)}%`);
    } catch(e) {
      const stale=lastGoodEngine(previous,engineId);
      engineErrors[engineId]=e?.message||String(e);
      if (saneApr(stale)) {
        engines[engineId]={engineId,...meta,aprLatest:stale,sourceType:'last-known-good',sourceMetric:'previous valid Reference APR',source:meta.sourceUrl,periodStart:null,periodEnd:generatedAt,lastUpdatedAt:previous?.engines?.[engineId]?.lastUpdatedAt||null,status:'stale',methodologyVersion:METHODOLOGY_VERSION,collectorVersion:COLLECTOR_VERSION,error:engineErrors[engineId]};
        console.warn(`! ${engineId}: stale ${stale}% (${engineErrors[engineId]})`);
      } else {
        engines[engineId]={engineId,...meta,aprLatest:null,sourceType:'unavailable',sourceMetric:null,source:meta.sourceUrl,periodStart:null,periodEnd:generatedAt,lastUpdatedAt:null,status:'error',methodologyVersion:METHODOLOGY_VERSION,collectorVersion:COLLECTOR_VERSION,error:engineErrors[engineId]};
        console.warn(`✗ ${engineId}: ${engineErrors[engineId]}`);
      }
    }
  }
  if (browser) await browser.close();

  // Maintain engine history only for fresh successful observations.
  const historyEngines={...(previous?.history?.engines||{})};
  // One-time cleanup: v1.3 accepted Pendle's 2026-W32 zero APR even though the
  // same completed epoch reported positive revenue. That observation is not
  // trusted and must not remain in historical averages.
  if (previous?.collectorVersion==='1.3-timeout-safe' && Array.isArray(historyEngines.pendle_spendle)) {
    historyEngines.pendle_spendle=historyEngines.pendle_spendle.filter(x=>!(x?.snapshotKey==='2026-W32' && Number(x?.apr)===0));
  }
  const snapKey=weekKey(new Date());
  for (const [id,e] of Object.entries(engines)) {
    const a=aprValue(e.aprLatest);
    if (e.status!=='ok' || !saneApr(a)) continue;
    historyEngines[id]=upsertObservation(historyEngines[id],{snapshotKey:snapKey,apr:a,periodStart:e.periodStart||null,periodEnd:e.periodEnd||generatedAt,sourceType:e.sourceType});
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
      const apr=aprValue(e?.aprLatest);
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
    const observations=(historyCompanies[name]||[]).filter(x=>saneApr(aprValue(x?.apr)));
    const histAvg=avg(observations.map(x=>aprValue(x.apr)));
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
    version:'1.5',methodologyVersion:METHODOLOGY_VERSION,collectorVersion:COLLECTOR_VERSION,generatedAt,snapshotKey:snapKey,
    note:'Reference APRs are normalized from official protocol APIs, onchain state, or official protocol frontends. Company APR is capital-weighted across productive positions only.',
    engines,companies,
    history:{engines:historyEngines,companies:historyCompanies},
    internalState:{liquity:liquityInternal,pendle:pendleInternal},
    diagnostics:{engineErrors,priceTimestamp:generatedAt,pricesUsed:prices}
  };

  await writeJson(DATA_FILE,output);
  const report={generatedAt,methodologyVersion:METHODOLOGY_VERSION,collectorVersion:COLLECTOR_VERSION,engines:Object.fromEntries(Object.entries(engines).map(([id,e])=>[id,{protocol:e.protocol,status:e.status,apr:e.aprLatest,source:e.source,sourceType:e.sourceType,sourceMetric:e.sourceMetric,periodStart:e.periodStart||null,periodEnd:e.periodEnd||null,error:e.error||null,details:e.details||null}]))};
  await writeJson(REPORT_FILE,report);
  console.log(`\nWrote ${DATA_FILE}`);
  console.log(`Wrote ${REPORT_FILE}`);
}

main().catch(err=>{ console.error(err); process.exitCode=1; });
