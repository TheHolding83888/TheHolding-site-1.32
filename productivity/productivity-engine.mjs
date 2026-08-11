#!/usr/bin/env node
/**
 * The Holding · Productivity / APR Engine v1.11
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
 * No wallet reward tracking. No claim tracking. Company addresses are used only for verifiable registry metadata such as founding events.
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
const COLLECTOR_VERSION = '1.14-company-007-yblp-signed-resolver';
const PENDLE_EPOCH_SECONDS = 14 * 24 * 60 * 60;
const PENDLE_SPENDLE_TOKEN = '0x999999999991e178d52cd95afd4b00d066664144';
const PENDLE_SURVIVOR_CAMPAIGNS = 3;
const PENDLE_SURVIVOR_SAMPLE_SIZE = 180;
const PENDLE_SURVIVOR_MIN_CLUSTER = 30;
const PENDLE_SURVIVOR_CLUSTER_TOLERANCE = 0.005; // ±0.5% around a common reward/balance ratio
const PENDLE_SURVIVOR_MAX_SPREAD_BPS = 75;
const PENDLE_SURVIVOR_MIN_DENSITY = 0.25;
const PENDLE_SURVIVOR_MIN_CAMPAIGNS = 2;
const PENDLE_SURVIVOR_MAX_SUPPLY_DEVIATION_PCT = 5;
const PENDLE_LKG_MAX_AGE_DAYS = 28;
const PENDLE_SURVIVOR_RPC_BUDGET_MS = 90_000;
const CURVE_WEEK_SECONDS = 7 * 24 * 60 * 60;
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0 Safari/537.36';
const RPC_TIMEOUT_MS = 7000;
const API_TIMEOUT_MS = 15000;

// Company #005: temporary registry identity. Its founding date is not hardcoded:
// the collector derives the earliest verifiable veVELO lock/mint on Optimism.
const COMPANY_005_NAME = '0x5860...83CA8.eth';
const COMPANY_005_ADDRESS = '0x58603461149Fc2A800a56d421e77DcbBA2D83CA8';
const VELODROME_V1_ESCROW = '0x9c7305eb78a432ced5c4d14cac27e8ed569a2e26';
const VELODROME_V2_ESCROW = '0xFAf8FD17D9840595845582fCB047DF13f006787d';
const OPTIMISM_BLOCKSCOUT_URLS = ['https://explorer.optimism.io','https://optimism.blockscout.com'];
const OPTIMISM_RPC_URLS = [
  process.env.OPTIMISM_RPC_URL,
  'https://optimism-rpc.publicnode.com',
  'https://mainnet.optimism.io',
  'https://optimism.drpc.org'
].filter(Boolean);
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

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
  'fxn-token':         'fx_vefxn',
  'yield-basis':       'yieldbasis_veyb',
  'frax-share':        'frax_vefrax',
  'velodrome-finance': 'velodrome_vevelo',
  'venice-token':      'venice_svvv',
  'liquity':           'liquity_lqty',
  'resupply':          'resupply_rsup',
  'internet-computer': 'icp_nns'
};

const ENGINE_META = {
  aerodrome_veaero: { protocol:'Aerodrome', principalSymbol:'AERO', sourceUrl:'https://www.40acres.finance/', nativeCadence:'weekly' },
  velodrome_vevelo: { protocol:'Velodrome', principalSymbol:'VELO', sourceUrl:'https://www.40acres.finance/', nativeCadence:'weekly' },
  convex_vlcvx:     { protocol:'Convex', principalSymbol:'CVX', sourceUrl:'https://www.convexfinance.com/lock-cvx', nativeCadence:'biweekly' },
  curve_vecrv:      { protocol:'Curve', principalSymbol:'CRV', sourceUrl:'https://classic.curve.finance/', nativeCadence:'weekly' },
  pendle_spendle:   { protocol:'Pendle', principalSymbol:'PENDLE', sourceUrl:'https://api-v2.pendle.finance/core/v1/spendle/data', nativeCadence:'14d' },
  fx_vefxn:         { protocol:'f(x)', principalSymbol:'FXN', sourceUrl:'https://fx.aladdin.club/v2/lock', nativeCadence:'weekly' },
  yieldbasis_veyb:  { protocol:'Yield Basis', principalSymbol:'YB', sourceUrl:'https://yieldbasis.com/analytics', nativeCadence:'epoch' },
  yieldbasis_yblp_wbtc: { protocol:'Yield Basis', principalSymbol:'BTC', sourceUrl:'companies/company-007-resolve.json', nativeCadence:'30d' },
  yieldbasis_yblp_weth: { protocol:'Yield Basis', principalSymbol:'ETH', sourceUrl:'companies/company-007-resolve.json', nativeCadence:'30d' },
  frax_vefrax:      { protocol:'Frax', principalSymbol:'FRAX', sourceUrl:'https://app.frax.finance/fxtl-vefxs', nativeCadence:'epoch' },
  venice_svvv:      { protocol:'Venice', principalSymbol:'VVV', sourceUrl:'https://venice.ai/token', nativeCadence:'continuous' },
  liquity_lqty:     { protocol:'Liquity', principalSymbol:'LQTY', sourceUrl:'https://www.liquity.org/stake', nativeCadence:'continuous/week-sampled' },
  resupply_rsup:    { protocol:'Resupply', principalSymbol:'RSUP', sourceUrl:'https://resupply.finance/governance/rsup', nativeCadence:'weekly' },
  icp_nns:          { protocol:'Internet Computer', principalSymbol:'ICP', sourceUrl:'https://dashboard.internetcomputer.org/governance', nativeCadence:'continuous' }
};

function nowIso() { return new Date().toISOString(); }
function round(n, d=4) { const f=10**d; return Math.round(n*f)/f; }
// Reference APR / APY can be a verified signed economic return (for example
// Yield Basis fundamental PPS growth). Bound the downside at -100% while
// preserving the existing upper sanity cap.
function saneApr(n) { return Number.isFinite(n) && n >= -100 && n <= MAX_REASONABLE_APR; }
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

async function discoverRecentPendleMerkleCampaigns(now=Math.floor(Date.now()/1000), limit=8) {
  // Pendle publishes the actual sPENDLE Merkle distributions in its official
  // GitHub repository. V1.7 reads several completed campaigns instead of only
  // the latest one so we can map the Merkle calendar to API epoch timestamps.
  const token='0x999999999991e178d52cd95afd4b00d066664144';
  const repoApi='https://api.github.com/repos/pendle-finance/merkle-distributions/contents/vependle-airdrop/1';
  const githubHeaders={'accept':'application/vnd.github+json'};
  if (process.env.GITHUB_TOKEN) githubHeaders.authorization=`Bearer ${process.env.GITHUB_TOKEN}`;
  const rows=await fetchJson(repoApi,{headers:githubHeaders},2);
  if (!Array.isArray(rows)) throw new Error('Pendle Merkle: repository directory listing unavailable');

  const names=rows
    .filter(x=>x?.type==='dir' && /^\d{4}-\d{2}-\d{2}-spendle(?:-airdrop)?$/i.test(String(x?.name||'')))
    .map(x=>String(x.name))
    .sort((a,b)=>b.localeCompare(a));

  const campaigns=[];
  for (const name of names.slice(0,Math.max(limit*2,12))) {
    if (campaigns.length>=limit) break;
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
      const users=d.users && typeof d.users==='object' ? d.users : {};
      const rewardUsers=Object.entries(users)
        .map(([address,rawReward])=>{
          let reward=NaN;
          try { reward=Number(formatUnits(BigInt(String(rawReward)),18)); } catch {}
          return {address:String(address).toLowerCase(),reward};
        })
        .filter(x=>/^0x[0-9a-f]{40}$/.test(x.address) && Number.isFinite(x.reward) && x.reward>0)
        .sort((a,b)=>b.reward-a.reward);
      // V1.8 survivor clustering needs a broad cross-section of recipients.
      // Keep some large rewards, then sample evenly through the distribution so
      // integrations / legacy virtual holders cannot dominate the diagnostic.
      const sampleMap=new Map();
      for (const x of rewardUsers.slice(0,40)) sampleMap.set(x.address,x);
      const stratifiedSlots=Math.max(0,PENDLE_SURVIVOR_SAMPLE_SIZE-40);
      for (let k=0;k<stratifiedSlots && rewardUsers.length;k++) {
        const q=(k+0.5)/stratifiedSlots;
        const x=rewardUsers[Math.min(rewardUsers.length-1,Math.floor((rewardUsers.length-1)*q))];
        if (x) sampleMap.set(x.address,x);
      }
      const sampleUsers=[...sampleMap.values()].slice(0,PENDLE_SURVIVOR_SAMPLE_SIZE);
      campaigns.push({
        campaign:name, source:raw, merkleRoot:campaign?.merkleRoot||null,
        fromTimestamp,toTimestamp,distributedSPendle,
        blockNumberStart:Number.isFinite(startBlock)?startBlock:null,
        blockNumberEnd:Number.isFinite(endBlock)?endBlock:null,
        userCount:Object.keys(users).length,
        sampleUsers
      });
    } catch {}
  }
  if (!campaigns.length) throw new Error('Pendle Merkle: no fully completed sPENDLE campaigns found');
  return campaigns.sort((a,b)=>b.toTimestamp-a.toTimestamp);
}

function pendleTokenUnits18(v) {
  try { return Number(formatUnits(BigInt(String(v)),18)); } catch { return NaN; }
}

function medianNumber(values) {
  const a=values.filter(Number.isFinite).slice().sort((x,y)=>x-y);
  if (!a.length) return NaN;
  const m=Math.floor(a.length/2);
  return a.length%2 ? a[m] : (a[m-1]+a[m])/2;
}

function publicPendleCampaign(c) {
  if (!c) return null;
  return {
    campaign:c.campaign,source:c.source,merkleRoot:c.merkleRoot,
    fromTimestamp:c.fromTimestamp,toTimestamp:c.toTimestamp,
    periodStart:new Date(c.fromTimestamp*1000).toISOString(),
    periodEnd:new Date(c.toTimestamp*1000).toISOString(),
    distributedSPendle:round(c.distributedSPendle,6),
    blockNumberStart:c.blockNumberStart,blockNumberEnd:c.blockNumberEnd,
    userCount:c.userCount
  };
}

function buildPendleEpochMap(campaigns,candidates) {
  const pairs=[];
  for (const campaign of campaigns) {
    const nearest=candidates
      .map(api=>({
        api,
        startOffsetSeconds:campaign.fromTimestamp-api.ts,
        endOffsetSeconds:campaign.toTimestamp-api.completedAt,
        startDistance:Math.abs(campaign.fromTimestamp-api.ts)
      }))
      .filter(x=>Math.abs(x.startOffsetSeconds)<=7*24*3600 && Math.abs(x.endOffsetSeconds)<=7*24*3600)
      .sort((a,b)=>a.startDistance-b.startDistance)[0];
    if (!nearest) continue;
    const api=nearest.api;
    const amountDiff=(Number.isFinite(api.buybackAmount)&&api.buybackAmount>=0)
      ? Math.abs(api.buybackAmount-campaign.distributedSPendle)
      : NaN;
    const amountTolerance=Math.max(1,Math.abs(campaign.distributedSPendle)*1e-5);
    const amountMatch=Number.isFinite(amountDiff) && api.buybackAmount>0 && amountDiff<=amountTolerance;
    pairs.push({
      campaign:campaign.campaign,
      merklePeriodStart:new Date(campaign.fromTimestamp*1000).toISOString(),
      merklePeriodEnd:new Date(campaign.toTimestamp*1000).toISOString(),
      merkleReward:round(campaign.distributedSPendle,6),
      apiIndex:api.i,
      apiPeriodStart:new Date(api.ts*1000).toISOString(),
      apiPeriodEnd:new Date(api.completedAt*1000).toISOString(),
      apiRevenue:Number.isFinite(api.revenue)?api.revenue:null,
      apiBuybackAmount:Number.isFinite(api.buybackAmount)?api.buybackAmount:null,
      apiPublishedApr:api.apr,
      startOffsetSeconds:nearest.startOffsetSeconds,
      endOffsetSeconds:nearest.endOffsetSeconds,
      offsetDays:round(nearest.startOffsetSeconds/86400,4),
      offsetDriftSeconds:Math.abs(nearest.startOffsetSeconds-nearest.endOffsetSeconds),
      amountDifference:Number.isFinite(amountDiff)?round(amountDiff,8):null,
      amountMatch
    });
  }
  const stablePairs=pairs.filter(x=>x.offsetDriftSeconds<=3600);
  const medianOffset=medianNumber(stablePairs.map(x=>x.startOffsetSeconds));
  const deviations=stablePairs.map(x=>Math.abs(x.startOffsetSeconds-medianOffset)).filter(Number.isFinite);
  const maxDeviation=deviations.length?Math.max(...deviations):NaN;
  const consensus=Number.isFinite(medianOffset) && stablePairs.length>=3 && Number.isFinite(maxDeviation) && maxDeviation<=3600;
  return {
    pairCount:pairs.length,
    exactAmountMatches:pairs.filter(x=>x.amountMatch).length,
    offsetConsensus:consensus,
    offsetSeconds:consensus?medianOffset:null,
    offsetDays:consensus?round(medianOffset/86400,4):null,
    maxOffsetDeviationSeconds:consensus?maxDeviation:null,
    pairs
  };
}

function chooseRatioCluster(rows, tolerance=0.01) {
  const usable=rows.filter(x=>Number.isFinite(x.ratio)&&x.ratio>0);
  if (!usable.length) return {cluster:[],medianRatio:NaN};
  let best=[];
  for (const seed of usable) {
    const group=usable.filter(x=>Math.abs(x.ratio-seed.ratio)/seed.ratio<=tolerance);
    if (group.length>best.length) best=group;
  }
  const medianRatio=medianNumber(best.map(x=>x.ratio));
  return {cluster:best,medianRatio};
}

async function fetchPendleCurrentBalanceSnapshot(campaigns) {
  const usable=(campaigns||[])
    .filter(c=>Array.isArray(c?.sampleUsers)&&c.sampleUsers.length)
    .slice(0,PENDLE_SURVIVOR_CAMPAIGNS);
  if (usable.length<2) return {status:'not-enough-campaigns'};

  const addresses=[...new Set(usable.flatMap(c=>c.sampleUsers.map(x=>String(x.address).toLowerCase())))];
  const iface=new Interface([
    'function balanceOf(address) view returns (uint256)',
    'function totalSupply() view returns (uint256)'
  ]);
  const urls=[
    process.env.ETH_RPC_URL,
    'https://ethereum-rpc.publicnode.com',
    'https://eth.llamarpc.com',
    'https://eth.drpc.org',
    'https://1rpc.io/eth',
    'https://rpc.flashbots.net'
  ].filter((x,i,a)=>x&&a.indexOf(x)===i);
  const errors=[];
  const deadline=Date.now()+PENDLE_SURVIVOR_RPC_BUDGET_MS;

  for (const rpc of urls) {
    if (Date.now()>=deadline) break;
    try {
      const balances=new Map();
      let cursor=0;
      let batchSize=48;
      let batchCalls=0;
      while (cursor<addresses.length) {
        if (Date.now()>=deadline) throw new Error('Pendle survivor RPC wall-clock budget exceeded');
        const part=addresses.slice(cursor,cursor+batchSize);
        const calls=part.map(address=>({
          method:'eth_call',
          params:[{to:PENDLE_SPENDLE_TOKEN,data:iface.encodeFunctionData('balanceOf',[address])},'latest']
        }));
        try {
          const out=await rpcBatch(rpc,calls,8000);
          for (let i=0;i<part.length;i++) {
            let bal=NaN;
            try { bal=Number(formatUnits(BigInt(String(out[i])),18)); } catch {}
            balances.set(part[i],Number.isFinite(bal)&&bal>=0?bal:NaN);
          }
          cursor+=part.length;
          batchCalls++;
          if (batchCalls>40) throw new Error('Pendle survivor batch safety cap exceeded');
          if (batchSize<64) batchSize=Math.min(64,batchSize+8);
        } catch(e) {
          if (batchSize<=12) throw e;
          batchSize=Math.max(12,Math.floor(batchSize/2));
          await new Promise(r=>setTimeout(r,180));
        }
      }
      const supplyHex=await rpcCall(rpc,'eth_call',[{
        to:PENDLE_SPENDLE_TOKEN,
        data:iface.encodeFunctionData('totalSupply',[])
      },'latest'],8000);
      let currentNativeSupply=NaN;
      try { currentNativeSupply=Number(formatUnits(BigInt(String(supplyHex)),18)); } catch {}
      return {
        status:'ok',rpc,observedAt:Math.floor(Date.now()/1000),addressCount:addresses.length,batchCalls,
        currentNativeSupply:Number.isFinite(currentNativeSupply)?currentNativeSupply:null,
        balances
      };
    } catch(e) {
      errors.push(`${rpc}: ${e?.message||e}`);
    }
  }
  return {status:Date.now()>=deadline?'rpc-budget-exhausted':'current-balance-rpc-unavailable',errors};
}

function pendleSurvivorCampaignDiagnostic(campaign,snapshot) {
  const rows=[];
  for (const user of campaign?.sampleUsers||[]) {
    const currentBalance=Number(snapshot?.balances?.get(String(user.address).toLowerCase()));
    const reward=Number(user.reward);
    const ratio=(Number.isFinite(currentBalance)&&currentBalance>0&&reward>0)?reward/currentBalance:NaN;
    rows.push({
      address:user.address,
      reward:round(reward,8),
      currentDirectBalance:Number.isFinite(currentBalance)?round(currentBalance,8):null,
      ratio:Number.isFinite(ratio)?ratio:null
    });
  }
  const directRows=rows.filter(x=>Number(x.currentDirectBalance)>0&&Number.isFinite(Number(x.ratio)));
  const {cluster,medianRatio}=chooseRatioCluster(directRows,PENDLE_SURVIVOR_CLUSTER_TOLERANCE);
  const deviations=(medianRatio>0)
    ? cluster.map(x=>Math.abs(Number(x.ratio)-medianRatio)/medianRatio*10000)
    : [];
  const maxSpreadBps=deviations.length?Math.max(...deviations):NaN;
  const clusterDensity=directRows.length?cluster.length/directRows.length:0;
  if (cluster.length<8 || !(medianRatio>0)) {
    return {
      campaign:campaign.campaign,status:'no-survivor-cluster',sampledUsers:rows.length,
      currentDirectBalanceUsers:directRows.length,clusterSize:cluster.length,
      clusterDensity:round(clusterDensity,4),maxClusterSpreadBps:Number.isFinite(maxSpreadBps)?round(maxSpreadBps,2):null,
      sample:rows.slice(0,24)
    };
  }
  const impliedActiveSupply=campaign.distributedSPendle/medianRatio;
  const rewardApr=medianRatio*(SECONDS_YEAR/PENDLE_EPOCH_SECONDS)*100;
  const currentNativeSupply=Number(snapshot?.currentNativeSupply);
  return {
    campaign:campaign.campaign,status:'diagnostic-survivor-cluster',sampledUsers:rows.length,
    currentDirectBalanceUsers:directRows.length,clusterSize:cluster.length,
    clusterDensity:round(clusterDensity,4),clusterTolerancePct:round(PENDLE_SURVIVOR_CLUSTER_TOLERANCE*100,3),
    maxClusterSpreadBps:Number.isFinite(maxSpreadBps)?round(maxSpreadBps,2):null,
    rewardPerActiveSPendle:medianRatio,
    diagnosticRewardApr:saneApr(rewardApr)?round(rewardApr):null,
    distributedSPendle:round(campaign.distributedSPendle,6),
    impliedActiveSPendle:round(impliedActiveSupply,4),
    currentNativeSupply:Number.isFinite(currentNativeSupply)?round(currentNativeSupply,4):null,
    impliedActiveToCurrentNativeRatio:Number.isFinite(currentNativeSupply)&&currentNativeSupply>0?round(impliedActiveSupply/currentNativeSupply,4):null,
    clusterAddresses:cluster.slice(0,40).map(x=>x.address),
    sample:rows.slice(0,24)
  };
}

function assessPendleSurvivorReplication(diagnostics) {
  const valid=(diagnostics||[]).filter(x=>
    x?.status==='diagnostic-survivor-cluster' &&
    saneApr(Number(x.diagnosticRewardApr)) &&
    Number(x.clusterSize)>=PENDLE_SURVIVOR_MIN_CLUSTER &&
    Number(x.maxClusterSpreadBps??1e9)<=PENDLE_SURVIVOR_MAX_SPREAD_BPS &&
    Number(x.clusterDensity||0)>=PENDLE_SURVIVOR_MIN_DENSITY &&
    Number(x.impliedActiveSPendle)>1_000_000 && Number(x.impliedActiveSPendle)<1_000_000_000
  );

  // V1.9 replaces the single ultra-tight 50 bps gate with a multi-signal gate.
  // A cluster is allowed a still-tight <=75 bps max deviation, but it must be
  // broad (>=30 holders, >=25% of direct-balance recipients), independently
  // replicate across campaigns, and imply mutually consistent active supplies.
  // This makes the promotion test stronger as a whole while avoiding a false
  // negative caused by a few tenths of a percent of survivor drift.
  const supplies=valid.map(x=>Number(x.impliedActiveSPendle)).filter(Number.isFinite).sort((a,b)=>a-b);
  const supplyMedian=supplies.length
    ? (supplies.length%2 ? supplies[(supplies.length-1)/2] : (supplies[supplies.length/2-1]+supplies[supplies.length/2])/2)
    : NaN;
  const maxSupplyDeviationPct=(Number.isFinite(supplyMedian)&&supplyMedian>0&&supplies.length)
    ? Math.max(...supplies.map(v=>Math.abs(v-supplyMedian)/supplyMedian*100))
    : NaN;
  const supplyConsistencyOk=Boolean(
    valid.length>=PENDLE_SURVIVOR_MIN_CAMPAIGNS &&
    Number.isFinite(maxSupplyDeviationPct) &&
    maxSupplyDeviationPct<=PENDLE_SURVIVOR_MAX_SUPPLY_DEVIATION_PCT
  );

  return {
    replicated:valid.length>=PENDLE_SURVIVOR_MIN_CAMPAIGNS && supplyConsistencyOk,
    validCampaigns:valid.length,
    minRequiredCampaigns:PENDLE_SURVIVOR_MIN_CAMPAIGNS,
    minClusterSize:PENDLE_SURVIVOR_MIN_CLUSTER,
    minClusterDensity:PENDLE_SURVIVOR_MIN_DENSITY,
    maxSpreadBps:PENDLE_SURVIVOR_MAX_SPREAD_BPS,
    maxSupplyDeviationPct:PENDLE_SURVIVOR_MAX_SUPPLY_DEVIATION_PCT,
    observedSupplyMedian:Number.isFinite(supplyMedian)?round(supplyMedian,4):null,
    observedMaxSupplyDeviationPct:Number.isFinite(maxSupplyDeviationPct)?round(maxSupplyDeviationPct,3):null,
    supplyConsistencyOk,
    campaigns:valid.map(x=>({
      campaign:x.campaign,apr:x.diagnosticRewardApr,clusterSize:x.clusterSize,
      clusterDensity:x.clusterDensity,maxClusterSpreadBps:x.maxClusterSpreadBps,
      impliedActiveSPendle:x.impliedActiveSPendle
    }))
  };
}

// Historical Transfer-log reconstruction was retired in v1.8.
// Public RPC backfills proved too slow/unreliable for a weekly production job.

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

  const candidates=[];
  for (let i=0;i<aprs.length;i++) {
    const a=normalizeAprNumber(aprs[i]);
    const ts=Number(timestamps[i]||0);
    if (!saneApr(a) || !ts) continue;
    const completedAt=ts+PENDLE_EPOCH_SECONDS;
    if (completedAt>now) continue;
    candidates.push({i,apr:a,ts,completedAt,revenue:Number(revenues[i]),buybackAmount:Number(buybackAmounts[i])});
  }
  if (!candidates.length) throw new Error('Pendle: no fully completed sPENDLE epoch in API history');
  candidates.sort((a,b)=>b.ts-a.ts);

  let campaigns=[],merkleError=null,epochMap=null,balanceDiagnostics=[];
  let survivorSnapshot={status:'not-run'};
  let survivorReplication={replicated:false,validCampaigns:0,minRequiredCampaigns:PENDLE_SURVIVOR_MIN_CAMPAIGNS,minClusterSize:PENDLE_SURVIVOR_MIN_CLUSTER,minClusterDensity:PENDLE_SURVIVOR_MIN_DENSITY,maxSpreadBps:PENDLE_SURVIVOR_MAX_SPREAD_BPS,maxSupplyDeviationPct:PENDLE_SURVIVOR_MAX_SUPPLY_DEVIATION_PCT,supplyConsistencyOk:false,campaigns:[]};
  try {
    campaigns=await discoverRecentPendleMerkleCampaigns(now,8);
    epochMap=buildPendleEpochMap(campaigns,candidates);
  } catch(e) { merkleError=e?.message||String(e); }

  // V1.8 deliberately avoids historical eth_getLogs backfills. Public RPCs made
  // that path slow and unreliable in v1.7. Instead, query only CURRENT sPENDLE
  // balances for a broad recipient sample. Holders whose balance has not changed
  // since an epoch form a very tight reward/current-balance ratio cluster. With
  // enough independent survivors, that common ratio recovers reward per active
  // sPENDLE without requiring archive state.
  if (campaigns.length>=2) {
    try {
      const snapshot=await fetchPendleCurrentBalanceSnapshot(campaigns);
      survivorSnapshot={
        status:snapshot.status,rpc:snapshot.rpc||null,observedAt:snapshot.observedAt||null,
        addressCount:snapshot.addressCount||null,batchCalls:snapshot.batchCalls||null,
        currentNativeSupply:snapshot.currentNativeSupply??null,errors:snapshot.errors||null
      };
      if (snapshot.status==='ok') {
        balanceDiagnostics=campaigns.slice(0,PENDLE_SURVIVOR_CAMPAIGNS).map(c=>pendleSurvivorCampaignDiagnostic(c,snapshot));
        survivorReplication=assessPendleSurvivorReplication(balanceDiagnostics);
      }
    } catch(e) {
      survivorSnapshot={status:'survivor-cluster-error',error:e?.message||String(e)};
    }
  }

  const publicCampaigns=campaigns.map(publicPendleCampaign);
  const research={
    merkleError,
    campaignCount:publicCampaigns.length,
    campaigns:publicCampaigns,
    epochMap,
    survivorSnapshot,
    balanceDiagnostics,
    survivorReplication,
    denominatorPolicy:'V1.9 uses replicated current-balance survivor clustering instead of historical archive state. A Merkle reward APR may become Reference APR only when broad reward/current-direct-sPENDLE clusters pass holder-count, density and spread gates across multiple campaigns, and the independently implied active supplies are mutually consistent. The cluster represents holders whose direct balance is statistically consistent with having remained unchanged since the reward snapshot.',
    rewardScope:'Reference APR reconstructed by this path is the sPENDLE buyback distribution component. In-kind point airdrops are intentionally excluded until they can be normalized independently.'
  };

  const internalState={
    ...currentSupplySnapshot,
    snapshots:snapshots.slice(-16),
    epochMapSummary:epochMap?{
      pairCount:epochMap.pairCount,
      exactAmountMatches:epochMap.exactAmountMatches,
      offsetConsensus:epochMap.offsetConsensus,
      offsetSeconds:epochMap.offsetSeconds,
      offsetDays:epochMap.offsetDays
    }:null,
    lastResearchAt:now,
    survivorSnapshotSummary:survivorSnapshot,
    survivorReplication,
    balanceDiagnosticSummary:balanceDiagnostics.map(x=>({
      campaign:x.campaign,status:x.status,clusterSize:x.clusterSize??null,clusterDensity:x.clusterDensity??null,
      maxClusterSpreadBps:x.maxClusterSpreadBps??null,diagnosticRewardApr:x.diagnosticRewardApr??null,
      impliedActiveSPendle:x.impliedActiveSPendle??null,currentNativeSupply:x.currentNativeSupply??null,
      impliedActiveToCurrentNativeRatio:x.impliedActiveToCurrentNativeRatio??null
    }))
  };

  const positive=candidates.find(x=>x.apr>0);
  if (positive) {
    return {
      apr:round(positive.apr), source:url, sourceType:'official-api+official-merkle',
      sourceMetric:'sPENDLE latest fully completed 14-day epoch APR · multi-epoch Merkle audited',
      periodStart:new Date(positive.ts*1000).toISOString(),periodEnd:new Date(positive.completedAt*1000).toISOString(),
      details:{
        epochTimestamp:positive.ts,epochCompletedAt:positive.completedAt,historyCount:aprs.length,selectedIndex:positive.i,
        revenue:Number.isFinite(positive.revenue)?positive.revenue:null,
        buybackAmount:Number.isFinite(positive.buybackAmount)?positive.buybackAmount:null,
        selectionRule:positive===candidates[0]?'latest-completed-positive-apr':'latest-completed-positive-apr-fallback',
        research,currentSupply:currentSupplySnapshot
      },
      internalState
    };
  }

  const latest=candidates[0];
  const revenue=Number(latest.revenue);
  const mappedLatest=epochMap?.pairs?.find(x=>x.apiIndex===latest.i) || null;
  const independentlyPositiveReward=Boolean(mappedLatest && Number(mappedLatest.merkleReward)>0 &&
    (!epochMap?.offsetConsensus || Math.abs(mappedLatest.startOffsetSeconds-Number(epochMap.offsetSeconds))<=3600));

  // V1.9 promotion gate. We accept a reconstructed APR only when:
  //   1) API/Merkle calendars have a stable multi-epoch offset,
  //   2) several historical reward amounts match,
  //   3) broad survivor clusters replicate across multiple campaigns,
  //   4) each valid cluster has >=30 holders, >=25% density and <=75 bps spread,
  //   5) independently implied active supplies remain within a 5% consistency band,
  //   6) the latest mapped campaign itself passes the same quality gates.
  // The inference is intentionally conservative: the common ratio is interpreted
  // as reward per active sPENDLE only when many independently sampled holders
  // agree. In-kind airdrops remain excluded from this buyback APR.
  const latestSurvivorDiag=mappedLatest ? balanceDiagnostics.find(x=>x?.campaign===mappedLatest.campaign) : null;
  const latestCampaign=mappedLatest ? campaigns.find(x=>x?.campaign===mappedLatest.campaign) : null;
  const latestClusterPlausible=Boolean(
    latestSurvivorDiag?.status==='diagnostic-survivor-cluster' &&
    Number(latestSurvivorDiag?.clusterSize||0)>=PENDLE_SURVIVOR_MIN_CLUSTER &&
    Number(latestSurvivorDiag?.clusterDensity||0)>=PENDLE_SURVIVOR_MIN_DENSITY &&
    Number(latestSurvivorDiag?.maxClusterSpreadBps??1e9)<=PENDLE_SURVIVOR_MAX_SPREAD_BPS &&
    Number(latestSurvivorDiag?.impliedActiveSPendle)>1_000_000 &&
    Number(latestSurvivorDiag?.impliedActiveSPendle)<1_000_000_000 &&
    saneApr(Number(latestSurvivorDiag?.diagnosticRewardApr))
  );
  const canPromoteSurvivorApr=Boolean(
    latest.apr===0 && independentlyPositiveReward && epochMap?.offsetConsensus &&
    Number(epochMap?.exactAmountMatches||0)>=3 && survivorReplication?.replicated &&
    latestClusterPlausible && latestCampaign
  );

  if (canPromoteSurvivorApr) {
    const reconstructedApr=Number(latestSurvivorDiag.diagnosticRewardApr);
    return {
      apr:round(reconstructedApr),
      source:latestCampaign.source,
      sourceType:'official-merkle+onchain-current-survivor-cluster',
      sourceMetric:'sPENDLE buyback distribution APR · replicated current-balance survivor reconstruction',
      periodStart:new Date(latestCampaign.fromTimestamp*1000).toISOString(),
      periodEnd:new Date(latestCampaign.toTimestamp*1000).toISOString(),
      details:{
        apiEpochTimestamp:latest.ts,apiEpochCompletedAt:latest.completedAt,publishedApiApr:0,
        revenue:Number.isFinite(revenue)?revenue:null,buybackAmount:Number.isFinite(latest.buybackAmount)?latest.buybackAmount:null,
        selectionRule:'replicated-current-balance-survivor-cluster',
        rewardScope:'sPENDLE buyback distribution only; in-kind airdrops excluded',
        inferenceNote:'APR is inferred from broad clusters of Merkle recipients whose current direct sPENDLE balances imply the same pro-rata reward rate. Promotion requires replication across multiple campaigns plus consistency of the independently reconstructed active-sPENDLE supply.',
        mappedMerkleCampaign:mappedLatest,selectedSurvivorDiagnostic:latestSurvivorDiag,
        replication:survivorReplication,research,currentSupply:currentSupplySnapshot
      },
      internalState
    };
  }

  if (latest.apr===0 && ((Number.isFinite(revenue)&&revenue>0) || independentlyPositiveReward)) {
    return {
      notReady:true, source:url, sourceType:'official-api+official-merkle+onchain-survivor-diagnostic',
      sourceMetric:'sPENDLE APR withheld · mapped positive rewards but survivor clustering has not yet passed promotion gate',
      periodStart:new Date(latest.ts*1000).toISOString(),periodEnd:new Date(latest.completedAt*1000).toISOString(),
      details:{
        epochTimestamp:latest.ts,epochCompletedAt:latest.completedAt,historyCount:aprs.length,selectedIndex:latest.i,
        publishedApr:0,revenue:Number.isFinite(revenue)?revenue:null,
        buybackAmount:Number.isFinite(latest.buybackAmount)?latest.buybackAmount:null,
        selectionRule:'zero-apr-positive-reward-survivor-cluster-not-yet-replicated',
        mappedMerkleCampaign:mappedLatest,
        research,currentSupply:currentSupplySnapshot,
        recentCompleted:candidates.slice(0,6).map(x=>({
          index:x.i,apr:x.apr,revenue:Number.isFinite(x.revenue)?x.revenue:null,
          buybackAmount:Number.isFinite(x.buybackAmount)?x.buybackAmount:null,
          periodStart:new Date(x.ts*1000).toISOString(),periodEnd:new Date(x.completedAt*1000).toISOString()
        }))
      },
      internalState
    };
  }

  return {
    apr:0, source:url, sourceType:'official-api+official-merkle+onchain-survivor-diagnostic',
    sourceMetric:'sPENDLE latest fully completed 14-day epoch APR · multi-source verified zero',
    periodStart:new Date(latest.ts*1000).toISOString(),periodEnd:new Date(latest.completedAt*1000).toISOString(),
    details:{
      epochTimestamp:latest.ts,epochCompletedAt:latest.completedAt,historyCount:aprs.length,selectedIndex:latest.i,
      revenue:Number.isFinite(revenue)?revenue:null,
      buybackAmount:Number.isFinite(latest.buybackAmount)?latest.buybackAmount:null,
      selectionRule:'genuine-zero-multi-source',mappedMerkleCampaign:mappedLatest,research,currentSupply:currentSupplySnapshot
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

async function collectIcpNns(browser) {
  const url='https://dashboard.internetcomputer.org/governance';
  const text=await renderedText(browser,url,{waitMs:5000});
  const t=normalizeText(text);
  // The official dashboard exposes an Annualized Estimate Rewards calculator.
  // The default/current maximum dissolve-delay selection is 2 years. Require
  // both pieces of context so a nearby unrelated percentage cannot be accepted.
  const hasTwoYear=/Neuron dissolve delay.{0,120}?2\s*years/i.test(t) || /2\s*years.{0,160}?Dissolve delay bonus/i.test(t);
  const apr=firstPercentAfter(t,'Annualized Estimate Rewards',220);
  if (!hasTwoYear) throw new Error('ICP NNS: 2-year dissolve-delay context not found');
  if (!saneApr(apr)) throw new Error('ICP NNS: Annualized Estimate Rewards not found');
  return {
    apr:round(apr), source:url, sourceType:'official-dashboard',
    sourceMetric:'NNS 2-year dissolve-delay Annualized Estimate Rewards',
    details:{dissolveDelayYears:2, rewardType:'NNS voting rewards', liveDashboard:true}
  };
}

function unixIso(v) {
  const n=Number(v);
  if (!Number.isFinite(n) || n<=0) return null;
  const d=new Date((n<1e12?n*1000:n));
  return Number.isFinite(d.getTime()) ? d.toISOString() : null;
}
function lowerAddr(v) { return String(v||'').toLowerCase(); }

async function blockscoutLegacy(action, params={}) {
  const qs=new URLSearchParams({module:'account',action,...params});
  let last=null;
  for (const base of OPTIMISM_BLOCKSCOUT_URLS) {
    try {
      const j=await fetchJson(`${base}/api?${qs.toString()}`,{},1);
      if (Array.isArray(j?.result)) return j.result;
      last=new Error(`unexpected Blockscout result from ${base}`);
    } catch(e) { last=e; }
  }
  throw last || new Error('Optimism Blockscout unavailable');
}


async function blockscoutNftInstanceTransfers(escrow, tokenId) {
  let last=null;
  for (const base of OPTIMISM_BLOCKSCOUT_URLS) {
    try {
      const j=await fetchJson(`${base}/api/v2/tokens/${escrow}/instances/${tokenId}/transfers`,{},2);
      if (Array.isArray(j?.items)) return j.items;
      last=new Error(`unexpected NFT instance transfer result from ${base}`);
    } catch(e) { last=e; }
  }
  throw last || new Error('Optimism Blockscout NFT instance transfers unavailable');
}

function blockscoutAddressHash(v) {
  if (typeof v === 'string') return lowerAddr(v);
  return lowerAddr(v?.hash || v?.address_hash || v?.address || '');
}
function blockscoutTransferIso(x) {
  const raw=x?.timestamp ?? x?.timeStamp ?? x?.block_timestamp;
  if (typeof raw === 'string' && /T/.test(raw)) {
    const d=new Date(raw);
    return Number.isFinite(d.getTime()) ? d.toISOString() : null;
  }
  return unixIso(raw);
}

async function company005CurrentVeNfts() {
  const provider=await providerFrom(OPTIMISM_RPC_URLS);
  const abi=[
    'function balanceOf(address owner) view returns (uint256)',
    'function ownerToNFTokenIdList(address owner, uint256 index) view returns (uint256)'
  ];
  const found=[];
  const errors=[];
  for (const [version,escrow] of [['v1',VELODROME_V1_ESCROW],['v2',VELODROME_V2_ESCROW]]) {
    try {
      const ve=new Contract(escrow,abi,provider);
      const count=Number(await ve.balanceOf(COMPANY_005_ADDRESS));
      for (let i=0;i<count;i++) {
        const tokenId=await ve.ownerToNFTokenIdList(COMPANY_005_ADDRESS,i);
        found.push({version,escrow,tokenId:tokenId.toString()});
      }
    } catch(e) { errors.push(`${version} veNFT enumeration: ${e?.shortMessage||e?.message||e}`); }
  }
  return {found,errors};
}

async function discoverCompany005Foundation(previousMeta={}) {
  const old=previousMeta?.[COMPANY_005_NAME];
  if (old?.foundedISO && old?.confidence==='high') return old;

  const wallet=lowerAddr(COMPANY_005_ADDRESS);
  const candidates=[];
  const errors=[];

  // Primary path: enumerate the wallet's current veVELO NFTs onchain, then ask
  // Blockscout for the complete ownership history of each exact NFT instance.
  // This is much more deterministic than scanning a wallet-wide transfer list.
  try {
    const owned=await company005CurrentVeNfts();
    errors.push(...owned.errors);
    for (const pos of owned.found) {
      try {
        const txs=await blockscoutNftInstanceTransfers(pos.escrow,pos.tokenId);
        for (const x of txs) {
          const from=blockscoutAddressHash(x.from), to=blockscoutAddressHash(x.to);
          if (to!==wallet) continue;
          const iso=blockscoutTransferIso(x); if (!iso) continue;
          candidates.push({
            foundedAt:iso, foundedISO:iso.slice(0,10),
            txHash:x.transaction_hash||x.hash||x.transactionHash||null,
            blockNumber:Number(x.block_number||x.blockNumber||0)||null,
            votingEscrow:pos.escrow, votingEscrowVersion:pos.version,
            method:from===ZERO_ADDRESS?'veNFT-mint-instance-history':'incoming-veNFT-instance-history',
            confidence:from===ZERO_ADDRESS?'high':'medium', tokenId:pos.tokenId
          });
        }
      } catch(e) { errors.push(`${pos.version} veNFT #${pos.tokenId} history: ${e?.message||e}`); }
    }
  } catch(e) { errors.push(`current veNFT enumeration: ${e?.message||e}`); }

  const mint=candidates.filter(x=>x.method==='veNFT-mint-instance-history').sort((a,b)=>a.foundedAt.localeCompare(b.foundedAt))[0];
  if (mint) return {...mint,source:'onchain+blockscout: exact veVELO NFT instance history',address:COMPANY_005_ADDRESS,discoveryErrors:errors};

  // Secondary path: legacy wallet-wide NFT transfer API. Kept for redundancy
  // and for cases where a lock was later transferred/merged and is no longer
  // among the wallet's current NFT inventory.
  for (const [version,escrow] of [['v1',VELODROME_V1_ESCROW],['v2',VELODROME_V2_ESCROW]]) {
    try {
      const txs=await blockscoutLegacy('tokennfttx',{
        address:COMPANY_005_ADDRESS,contractaddress:escrow,startblock:'0',endblock:'99999999',page:'1',offset:'1000',sort:'asc'
      });
      for (const x of txs) {
        const from=lowerAddr(x.from), to=lowerAddr(x.to), contract=lowerAddr(x.contractAddress||x.contractaddress||escrow);
        if (contract!==lowerAddr(escrow) || to!==wallet) continue;
        const iso=unixIso(x.timeStamp||x.timestamp);
        if (!iso) continue;
        candidates.push({
          foundedAt:iso, foundedISO:iso.slice(0,10), txHash:x.hash||x.transactionHash||null,
          votingEscrow:escrow, votingEscrowVersion:version,
          method:from===ZERO_ADDRESS?'veNFT-mint':'incoming-veNFT',
          confidence:from===ZERO_ADDRESS?'high':'medium', tokenId:x.tokenID||x.tokenId||null
        });
      }
    } catch(e) { errors.push(`${version} NFT transfers: ${e?.message||e}`); }
  }

  const minted=candidates.filter(x=>x.method==='veNFT-mint').sort((a,b)=>a.foundedAt.localeCompare(b.foundedAt));
  if (minted.length) return {...minted[0],source:'onchain: optimism-blockscout-votingescrow',address:COMPANY_005_ADDRESS,discoveryErrors:errors};

  // Final fallback: a direct wallet transaction to a VotingEscrow is strong
  // evidence of lock creation/increase, but less specific than an NFT mint.
  try {
    const txs=await blockscoutLegacy('txlist',{address:COMPANY_005_ADDRESS,startblock:'0',endblock:'99999999',page:'1',offset:'10000',sort:'asc'});
    for (const x of txs) {
      const to=lowerAddr(x.to);
      const escrow = to===lowerAddr(VELODROME_V1_ESCROW) ? VELODROME_V1_ESCROW : to===lowerAddr(VELODROME_V2_ESCROW) ? VELODROME_V2_ESCROW : null;
      if (!escrow || String(x.isError||'0')==='1') continue;
      const iso=unixIso(x.timeStamp||x.timestamp); if (!iso) continue;
      candidates.push({foundedAt:iso,foundedISO:iso.slice(0,10),txHash:x.hash||null,votingEscrow:escrow,
        votingEscrowVersion:escrow===VELODROME_V1_ESCROW?'v1':'v2',method:'direct-escrow-tx',confidence:'medium'});
    }
  } catch(e) { errors.push(`normal transactions: ${e?.message||e}`); }

  const incoming=candidates.sort((a,b)=>a.foundedAt.localeCompare(b.foundedAt))[0];
  if (incoming) return {...incoming,source:'onchain: optimism-blockscout-votingescrow',address:COMPANY_005_ADDRESS,discoveryErrors:errors};
  if (old?.foundedISO) return {...old,discoveryErrors:errors};
  return {address:COMPANY_005_ADDRESS,foundedISO:null,foundedAt:null,source:'onchain+blockscout: veVELO foundation discovery',method:null,confidence:'unresolved',discoveryErrors:errors};
}


async function collectCompany007YieldBasisLp(market) {
  const file=path.join(ROOT,'companies','company-007-resolve.json');
  const publicSource='companies/company-007-resolve.json';
  const j=await readJson(file,{});
  const yb=j?.results?.yieldBasis;
  const p=Array.isArray(yb?.positions) ? yb.positions.find(x=>x?.market===market) : null;
  const apr=Number(p?.fundamentalTradingApy30dPct);
  if (!(yb?.status==='ok' && saneApr(apr))) {
    return {notReady:true,source:publicSource,sourceType:'local-verified-resolver',sourceMetric:'Yield Basis FT APY (30D) pending reproducible historical PPS',details:{market,resolverStatus:yb?.status||'missing',resolverVersion:yb?.yieldBasisResolverVersion||null,productivityStatus:p?.productivityStatus||null}};
  }
  return {apr:round(apr),source:publicSource,sourceType:'local-verified-resolver',sourceMetric:'Yield Basis FT APY (30D) · fundamental PPS growth · emissions excluded',periodStart:p?.historicalTimestamp?new Date(Number(p.historicalTimestamp)*1000).toISOString():null,periodEnd:j?.generatedAt||nowIso(),details:{market,ppsNow:p?.ppsNow??null,pps30dAgo:p?.pps30dAgo??null,historicalProvider:p?.historicalProvider??null,resolverVersion:yb?.yieldBasisResolverVersion||null}};
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
    case 'yieldbasis_yblp_wbtc': return collectCompany007YieldBasisLp('yb-WBTC');
    case 'yieldbasis_yblp_weth': return collectCompany007YieldBasisLp('yb-WETH');
    case 'frax_vefrax': return collectFrax(browser);
    case 'venice_svvv': return collectVenice();
    case 'liquity_lqty': return collectLiquity(prices,previous);
    case 'resupply_rsup': return collectResupply(browser);
    case 'icp_nns': return collectIcpNns(browser);
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


function lastGoodEngineObservation(previous,id) {
  const hist=previous?.history?.engines?.[id];
  if (!Array.isArray(hist)) return null;
  for (let i=hist.length-1;i>=0;i--) {
    const row=hist[i];
    const apr=aprValue(row?.apr);
    if (!saneApr(apr)) continue;
    const periodEndMs=Date.parse(row?.periodEnd||'');
    const ageDays=Number.isFinite(periodEndMs) ? (Date.now()-periodEndMs)/86400000 : NaN;
    return {
      apr,
      snapshotKey:row?.snapshotKey||null,
      periodStart:row?.periodStart||null,
      periodEnd:row?.periodEnd||null,
      sourceType:row?.sourceType||null,
      ageDays
    };
  }
  return null;
}

function pendleValidationTemporarilyUnavailable(result) {
  const research=result?.details?.research;
  return Boolean(
    result?.notReady &&
    research?.merkleError &&
    Number(research?.campaignCount||0)===0
  );
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
    for (const p of positions) if ((p.engineId || ENGINE_BY_CG_ID[p.id]) && p.fixed===undefined) priceIds.add(p.id);
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
      if (!browser && ['aerodrome_veaero','velodrome_vevelo','convex_vlcvx','fx_vefxn','yieldbasis_veyb','frax_vefrax','resupply_rsup','icp_nns'].includes(engineId)) {
        throw new Error('browser collector unavailable');
      }
      const r=await runAdapter(engineId,{browser,prices,previous});
      if (r?.internalState && engineId==='liquity_lqty') liquityInternal=r.internalState;
      if (r?.internalState && engineId==='pendle_spendle') pendleInternal=r.internalState;
      if (r?.notReady) {
        // Pendle has already passed a strict replicated Merkle + onchain validation gate.
        // If the current run cannot re-open the official Merkle source at all (for
        // example a transient GitHub 403/429/5xx), do not erase that validated
        // Reference APR immediately. Carry the latest validated observation for a
        // bounded window, mark it STALE, and never add the stale carry to history.
        // If Merkle data is reachable but the current validation gate genuinely
        // fails, we keep the normal warming behavior instead of masking it.
        const pendleLkg=engineId==='pendle_spendle' && pendleValidationTemporarilyUnavailable(r)
          ? lastGoodEngineObservation(previous,engineId)
          : null;
        const pendleLkgFreshEnough=Boolean(
          pendleLkg && saneApr(pendleLkg.apr) &&
          Number.isFinite(pendleLkg.ageDays) &&
          pendleLkg.ageDays>=0 && pendleLkg.ageDays<=PENDLE_LKG_MAX_AGE_DAYS
        );
        if (pendleLkgFreshEnough) {
          engines[engineId]={
            engineId,...meta,aprLatest:round(pendleLkg.apr),
            sourceType:'last-known-good',
            sourceMetric:'sPENDLE last validated Reference APR · current Merkle validation temporarily unavailable',
            source:r.source||meta.sourceUrl,
            periodStart:pendleLkg.periodStart,
            periodEnd:pendleLkg.periodEnd,
            lastUpdatedAt:null,
            status:'stale',methodologyVersion:METHODOLOGY_VERSION,collectorVersion:COLLECTOR_VERSION,
            details:{
              staleReason:r?.details?.research?.merkleError||'current Pendle validation unavailable',
              stalePolicy:`bounded last-known-good; max ${PENDLE_LKG_MAX_AGE_DAYS} days from validated reward period end`,
              lastValidatedSnapshotKey:pendleLkg.snapshotKey,
              lastValidatedPeriodStart:pendleLkg.periodStart,
              lastValidatedPeriodEnd:pendleLkg.periodEnd,
              lastValidatedSourceType:pendleLkg.sourceType,
              staleAgeDays:round(pendleLkg.ageDays,2),
              currentAttempt:r.details||{}
            }
          };
          console.warn(`! ${engineId}: stale ${round(pendleLkg.apr)}% retained because current Merkle validation is unavailable (${r?.details?.research?.merkleError||'upstream unavailable'})`);
        } else {
          engines[engineId]={
            engineId,...meta,aprLatest:null,sourceType:r.sourceType,sourceMetric:r.sourceMetric,
            source:r.source||meta.sourceUrl,periodStart:r.periodStart||null,periodEnd:r.periodEnd||generatedAt,lastUpdatedAt:generatedAt,
            status:'warming',methodologyVersion:METHODOLOGY_VERSION,collectorVersion:COLLECTOR_VERSION,details:r.details||{}
          };
          console.warn(`… ${engineId}: source not ready; waiting for a valid observed period`);
        }
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

  const companyMetadata={...(previous?.companyMetadata||{})};
  const companyMetadataErrors={};
  try {
    companyMetadata[COMPANY_005_NAME]=await discoverCompany005Foundation(previous?.companyMetadata||{});
    const m=companyMetadata[COMPANY_005_NAME];
    console.log(`${m?.foundedISO?'✓':'!'} ${COMPANY_005_NAME} foundation: ${m?.foundedISO||'unresolved'} (${m?.method||'no verified lock event'})`);
    if (Array.isArray(m?.discoveryErrors) && m.discoveryErrors.length) companyMetadataErrors[COMPANY_005_NAME]=m.discoveryErrors;
  } catch(e) {
    companyMetadataErrors[COMPANY_005_NAME]=[e?.message||String(e)];
    if (previous?.companyMetadata?.[COMPANY_005_NAME]) companyMetadata[COMPANY_005_NAME]=previous.companyMetadata[COMPANY_005_NAME];
  }

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
    const productive=positions.filter(p=>p.engineId || ENGINE_BY_CG_ID[p.id]);
    let total=0, weighted=0, covered=0;
    const breakdown=[];
    let complete=productive.length>0;

    for (const p of productive) {
      const engineId=p.engineId || ENGINE_BY_CG_ID[p.id];
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
    const fullCoverage=complete && total>0 && coverage>=0.999999;
    // V1.8: a company/fund may publish a live covered APR before every engine is
    // ready. Unknown engines are EXCLUDED from both numerator and denominator;
    // they are never treated as 0%. Coverage makes the scope explicit. As soon
    // as a warming engine becomes valid, it joins automatically on the next run.
    const aprLatest=covered>0 ? weighted/covered : NaN;

    // Keep the historical average strictly comparable: only full-coverage
    // observations enter the canonical company APR history. Partial live APR is
    // still exposed in real time, but is not mixed into the long-run average.
    if (fullCoverage && saneApr(aprLatest)) {
      const obs={
        snapshotKey:snapKey,apr:round(aprLatest),periodEnd:generatedAt,
        totalProductiveValue:round(total,2),coveredProductiveValue:round(covered,2),coverage:1
      };
      historyCompanies[name]=upsertObservation(historyCompanies[name],obs);
    }
    const observations=(historyCompanies[name]||[]).filter(x=>saneApr(aprValue(x?.apr)));
    const histAvg=avg(observations.map(x=>aprValue(x.apr)));
    const oldCompany=previous?.companies?.[name];
    const usableAverage=saneApr(histAvg);
    const liveAprOk=saneApr(aprLatest);

    companies[name]={
      aprLatest:liveAprOk?round(aprLatest):null,
      aprHistoricalAverage:usableAverage?round(histAvg):null,
      observationCount:observations.length,
      trackingStartedAt:observations[0]?.periodEnd||oldCompany?.trackingStartedAt||null,
      updatedAt:generatedAt,
      source:'the-holding-productivity-intelligence-layer',
      status:fullCoverage && liveAprOk ? 'ok' : (liveAprOk ? 'partial' : 'partial'),
      aprScope:fullCoverage?'full-productive-capital':'covered-productive-capital',
      coverage:round(coverage,4),
      productiveValue:total>0?round(total,2):null,
      coveredProductiveValue:covered>0?round(covered,2):0,
      uncoveredProductiveValue:total>0?round(Math.max(0,total-covered),2):null,
      breakdown
    };
    console.log(`${companies[name].status==='ok'?'✓':'!'} ${name}: latest=${companies[name].aprLatest ?? '—'}% avg=${companies[name].aprHistoricalAverage ?? '—'}% coverage=${round(coverage*100,1)}%`);
  }

  const output={
    version:'1.14',methodologyVersion:METHODOLOGY_VERSION,collectorVersion:COLLECTOR_VERSION,generatedAt,snapshotKey:snapKey,
    note:'Reference APRs are normalized from official protocol APIs, onchain state, or official protocol frontends. Company APR is capital-weighted across productive positions with valid Reference APRs. coverage shows the share of productive capital currently included; unknown engines are excluded, never treated as 0%. Canonical historical company averages use full-coverage observations only.',
    engines,companies,companyMetadata,
    history:{engines:historyEngines,companies:historyCompanies},
    internalState:{liquity:liquityInternal,pendle:pendleInternal},
    diagnostics:{engineErrors,companyMetadataErrors,priceTimestamp:generatedAt,pricesUsed:prices}
  };

  await writeJson(DATA_FILE,output);
  const report={generatedAt,methodologyVersion:METHODOLOGY_VERSION,collectorVersion:COLLECTOR_VERSION,engines:Object.fromEntries(Object.entries(engines).map(([id,e])=>[id,{protocol:e.protocol,status:e.status,apr:e.aprLatest,source:e.source,sourceType:e.sourceType,sourceMetric:e.sourceMetric,periodStart:e.periodStart||null,periodEnd:e.periodEnd||null,error:e.error||null,details:e.details||null}]))};
  await writeJson(REPORT_FILE,report);
  console.log(`\nWrote ${DATA_FILE}`);
  console.log(`Wrote ${REPORT_FILE}`);
}

main().catch(err=>{ console.error(err); process.exitCode=1; });
