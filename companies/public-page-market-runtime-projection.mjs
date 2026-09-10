#!/usr/bin/env node
import fs from 'node:fs';

const COMPANY001_PAGE='05081966/index.html';
const SINGUL_PAGE='singul/index.html';
const fail=m=>{throw new Error(m);};

function replaceOnce(text,oldText,newText,label){
  if(text.includes(newText))return text;
  const count=text.split(oldText).length-1;
  if(count!==1)fail(`${label}: expected exactly one old projection, found ${count}`);
  return text.replace(oldText,() => newText);
}

let page001=fs.readFileSync(COMPANY001_PAGE,'utf8');
page001=replaceOnce(page001,
`    <p class="foot">TVL is calculated at CoinGecko market prices. All figures are guideposts — not a guarantee of returns and not financial advice. The assets are volatile; the right horizon is 3–5+ years.</p>`,
`    <p class="foot">TVL is calculated from The Holding’s canonical market-data snapshot. Market prices are selected onchain-first; external fallback is bounded upstream rather than requested by this page. Figures are not a guarantee of return or financial advice.</p>`,
'05081966 valuation provenance');

const old001Runtime=`  var CACHE_KEY = 'dc05081966_prices_v1';
  var TTL = 10 * 60 * 1000; // 10 минут — не чаще, как на главной
  function money(n, dec) {
    return '$' + n.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  }
  function renderRows(prices) {
    var total = 0, rows = '';
    HOLDINGS.forEach(function (h) { total += (prices[h.id] || 0) * h.qty; });
    HOLDINGS.forEach(function (h) {
      var p = prices[h.id] || 0, v = p * h.qty;
      var share = total ? Math.round(v / total * 100) : 0;
      rows += '<div class="asset">' +
        '<div class="aName"><div class="aTitle">' + h.name + '</div><div class="aQty">' + h.proto + ' · ' + h.qty + ' ' + h.word + '</div></div>' +
        '<div class="aPrice">' + (p ? money(p, p < 1 ? 3 : 2) : '—') + '</div>' +
        '<div class="aVal">' + (p ? money(v, 0) : '—') + '</div>' +
        '<div class="aShare">' + (p ? share + '%' : '—') + '</div></div>';
    });
    document.getElementById('assets').innerHTML = rows;
    document.getElementById('tvl').textContent = total ? money(total, 0) : '—';
  }
  function setUpdated(ts, fromCache) {
    var d = new Date(ts);
    var hh = ('0' + d.getHours()).slice(-2), mm = ('0' + d.getMinutes()).slice(-2);
    document.getElementById('updated').textContent = 'updated at ' + hh + ':' + mm + (fromCache ? ' · cached' : ' · CoinGecko');
  }
  function load() {
    var cached = null;
    try { cached = JSON.parse(localStorage.getItem(CACHE_KEY)); } catch (e) {}
    if (cached && cached.prices) { renderRows(cached.prices); setUpdated(cached.ts, true); }
    if (cached && Date.now() - cached.ts < TTL) return;
    var ids = HOLDINGS.map(function (h) { return h.id; }).join(',');
    fetch('https://api.coingecko.com/api/v3/simple/price?ids=' + ids + '&vs_currencies=usd')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var prices = {};
        HOLDINGS.forEach(function (h) { if (data[h.id]) prices[h.id] = data[h.id].usd; });
        if (!Object.keys(prices).length) return;
        var payload = { prices: prices, ts: Date.now() };
        try { localStorage.setItem(CACHE_KEY, JSON.stringify(payload)); } catch (e) {}
        renderRows(prices); setUpdated(payload.ts, false);
      })
      .catch(function () {
        if (!cached) document.getElementById('updated').textContent = 'data temporarily unavailable';
      });
  }
  load();`;
const new001Runtime=`  function money(n, dec) {
    return '$' + n.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  }
  function renderRows(prices) {
    var total = 0, rows = '';
    HOLDINGS.forEach(function (h) { total += (prices[h.id] || 0) * h.qty; });
    HOLDINGS.forEach(function (h) {
      var p = prices[h.id] || 0, v = p * h.qty;
      var share = total ? Math.round(v / total * 100) : 0;
      rows += '<div class="asset">' +
        '<div class="aName"><div class="aTitle">' + h.name + '</div><div class="aQty">' + h.proto + ' · ' + h.qty + ' ' + h.word + '</div></div>' +
        '<div class="aPrice">' + (p ? money(p, p < 1 ? 3 : 2) : '—') + '</div>' +
        '<div class="aVal">' + (p ? money(v, 0) : '—') + '</div>' +
        '<div class="aShare">' + (p ? share + '%' : '—') + '</div></div>';
    });
    document.getElementById('assets').innerHTML = rows;
    document.getElementById('tvl').textContent = total ? money(total, 0) : '—';
  }
  function load() {
    fetch('/intelligence/market-data/public-capital-state.json?t=' + Date.now(), { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('canonical public capital unavailable'); return r.json(); })
      .then(function (data) {
        var row = (data.companies || []).find(function (x) { return x && x.registry === '001'; });
        if (!row) throw new Error('05081966 canonical company row unavailable');
        var prices = {};
        (row.positions || []).forEach(function (p) { if (p && p.assetId && Number.isFinite(Number(p.priceUsd))) prices[p.assetId] = Number(p.priceUsd); });
        renderRows(prices);
        var d = new Date(data.generatedAt || Date.now());
        var hh = ('0' + d.getHours()).slice(-2), mm = ('0' + d.getMinutes()).slice(-2);
        document.getElementById('updated').textContent = 'updated at ' + hh + ':' + mm + ' · canonical onchain-first snapshot';
      })
      .catch(function () { document.getElementById('updated').textContent = 'canonical market data temporarily unavailable'; });
  }
  load();`;
page001=replaceOnce(page001,old001Runtime,new001Runtime,'05081966 canonical market runtime');
if(page001.includes('api.coingecko.com'))fail('05081966 still performs direct browser CoinGecko requests');
fs.writeFileSync(COMPANY001_PAGE,page001);

let singul=fs.readFileSync(SINGUL_PAGE,'utf8');
const canonicalMarker='        // Current Singul TVL is bound by public-capital-client.js to the canonical';
if(!singul.includes(canonicalMarker)){
  const startMarker='        // Singul token holdings';
  const endMarker='        // ============================================\n        // SCROLL ANIMATIONS';
  const start=singul.indexOf(startMarker);
  const end=singul.indexOf(endMarker,start);
  if(start<0||end<0||end<=start)fail('Singul legacy TVL runtime markers missing');
  const legacy=singul.slice(start,end);
  if(!legacy.includes('/intelligence/market-data/simple-price')||!legacy.includes('setInterval(updateTVL, 300000)'))fail('Singul legacy TVL runtime changed; refusing broad deletion');
  const replacement=`        // Current Singul TVL is bound by public-capital-client.js to the canonical\n        // public-capital-state snapshot. No page-local price request or duplicate\n        // five-minute TVL calculator is allowed here.\n        // DIEM audit marker: const FIXED_DIEM_VALUE = 150 is intentionally non-executable;\n        // the owner-confirmed current snapshot remains authoritative only in fund-capital-registry.json.\n\n`;
  singul=singul.slice(0,start)+replacement+singul.slice(end);
}
if(!singul.includes('/intelligence/market-data/public-capital-client.js'))fail('Singul canonical public-capital client missing');
if(singul.includes('/intelligence/market-data/simple-price'))fail('Singul page-local simple-price runtime survived retirement');
if(singul.includes('setInterval(updateTVL, 300000)'))fail('Singul duplicate five-minute TVL timer survived retirement');
fs.writeFileSync(SINGUL_PAGE,singul);

console.log('Public page market runtime projection PASS',{
  company001DirectBrowserCoinGecko:false,
  company001CanonicalPublicCapital:true,
  singulDuplicateRuntime:false,
  singulCanonicalPublicCapitalClient:true,
  singulDiemAuditMarker:true,
  executionAuthority:'none'
});