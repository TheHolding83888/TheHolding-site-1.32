/*
 * The Holding · Public Capital Client v0.2.2
 * ------------------------------------------
 * Read-only browser client for generated local Market Data / Public Capital.
 * Legacy simple-price calls are intercepted locally; browsers never need to
 * contact CoinGecko directly and never need a CoinGecko credential.
 *
 * v0.2.2 also carries a narrow public-surface coherence guard for Defitea's
 * headline Reference APR. The canonical source remains Productivity
 * Intelligence; this client only keeps already-existing headline surfaces in
 * sync at one decimal place. Historical/average APR surfaces are untouched.
 */
(function (global) {
  'use strict';

  const VERSION = '0.2.2';
  const DEFAULT_URL = '/intelligence/market-data/public-capital-state.json';
  const MARKET_URL = '/intelligence/market-data/market-data.json';
  const PRODUCTIVITY_URL = '/companies/productivity-data.json';
  const LEGACY_SIMPLE_PRICE_PATH = '/intelligence/market-data/simple-price';
  const DEFAULT_TIMEOUT_MS = 4500;
  const originalFetch = global.fetch.bind(global);
  let cached = null;
  let pending = null;
  let cachedMarket = null;
  let pendingMarket = null;
  let cachedProductivity = null;
  let pendingProductivity = null;
  let defiteaObserver = null;
  let defiteaAprText = null;

  function finite(value) {
    if (value === null || value === undefined || value === '') return NaN;
    const n = Number(value);
    return Number.isFinite(n) ? n : NaN;
  }

  function money(value, digits) {
    const n = finite(value);
    if (!Number.isFinite(n)) return null;
    const d = Number.isInteger(digits) ? digits : 0;
    return '$' + n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
  }

  function percent(value, digits) {
    const n = finite(value);
    if (!Number.isFinite(n)) return null;
    const d = Number.isInteger(digits) ? digits : 1;
    return n.toFixed(d) + '%';
  }

  async function loadMarket() {
    if (cachedMarket) return cachedMarket;
    if (pendingMarket) return pendingMarket;
    pendingMarket = (async function () {
      const res = await originalFetch(MARKET_URL + '?t=' + Date.now(), { cache: 'no-store' });
      if (!res.ok) throw new Error('Market Data HTTP ' + res.status);
      const data = await res.json();
      if (!data || typeof data !== 'object' || !data.prices) throw new Error('Invalid Market Data snapshot');
      cachedMarket = data;
      return data;
    })().finally(function () { pendingMarket = null; });
    return pendingMarket;
  }

  async function loadProductivity(options) {
    const opts = options || {};
    if (!opts.force && cachedProductivity) return cachedProductivity;
    if (!opts.force && pendingProductivity) return pendingProductivity;
    pendingProductivity = (async function () {
      const controller = new AbortController();
      const timer = setTimeout(function () { controller.abort(); }, DEFAULT_TIMEOUT_MS);
      try {
        const res = await originalFetch(PRODUCTIVITY_URL + '?t=' + Date.now(), { cache: 'no-store', signal: controller.signal });
        if (!res.ok) throw new Error('Productivity HTTP ' + res.status);
        const data = await res.json();
        if (!data || typeof data !== 'object' || !data.companies) throw new Error('Invalid Productivity snapshot');
        cachedProductivity = data;
        return data;
      } finally {
        clearTimeout(timer);
      }
    })().finally(function () { pendingProductivity = null; });
    return pendingProductivity;
  }

  function isLegacySimplePrice(input) {
    try {
      const raw = typeof input === 'string' || input instanceof URL ? input : input && input.url;
      const u = new URL(raw, global.location && global.location.origin ? global.location.origin : 'https://theholding.ai');
      return u.pathname === LEGACY_SIMPLE_PRICE_PATH ||
        (u.hostname === 'api.coingecko.com' && u.pathname === '/api/v3/simple/price');
    } catch (_) { return false; }
  }

  function marketRowForProviderId(market, providerId) {
    const prices = market && market.prices ? market.prices : {};
    const direct = prices[providerId] || null;
    if (direct && (!direct.providerId || direct.providerId === providerId)) return direct;
    const rows = Object.values(prices);
    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i];
      if (row && row.providerId === providerId) return row;
    }
    return direct;
  }

  async function legacySimplePriceResponse(input) {
    const raw = typeof input === 'string' || input instanceof URL ? input : input && input.url;
    const u = new URL(raw, global.location && global.location.origin ? global.location.origin : 'https://theholding.ai');
    const ids = String(u.searchParams.get('ids') || '').split(',').map(function (x) { return x.trim(); }).filter(Boolean);
    const market = await loadMarket();
    const body = {};
    ids.forEach(function (id) {
      const row = marketRowForProviderId(market, id);
      const usd = finite(row && row.usd);
      if (Number.isFinite(usd) && usd >= 0) body[id] = { usd: usd };
    });
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'x-the-holding-market-data': 'shared-snapshot',
        'x-the-holding-external-request': '0'
      }
    });
  }

  global.fetch = function theHoldingLocalMarketFetch(input, init) {
    if (isLegacySimplePrice(input)) return legacySimplePriceResponse(input);
    return originalFetch(input, init);
  };

  async function load(options) {
    const opts = options || {};
    const url = opts.url || DEFAULT_URL;
    const timeoutMs = Number(opts.timeoutMs) > 0 ? Number(opts.timeoutMs) : DEFAULT_TIMEOUT_MS;
    if (!opts.force && cached) return cached;
    if (!opts.force && pending) return pending;
    pending = (async function () {
      const controller = new AbortController();
      const timer = setTimeout(function () { controller.abort(); }, timeoutMs);
      try {
        const sep = url.indexOf('?') === -1 ? '?' : '&';
        const res = await originalFetch(url + sep + 't=' + Date.now(), { cache: 'no-store', signal: controller.signal });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.json();
        if (!data || typeof data !== 'object' || !data.funds || !Array.isArray(data.companies)) throw new Error('Invalid Public Capital State');
        cached = data;
        return data;
      } catch (err) {
        console.warn('[TH Public Capital] snapshot unavailable:', err && err.message ? err.message : err);
        return cached;
      } finally {
        clearTimeout(timer);
        pending = null;
      }
    })();
    return pending;
  }

  function fund(id, snapshot) {
    const data = snapshot || cached;
    return data && data.funds ? data.funds[id] || null : null;
  }

  function company(key, snapshot) {
    const data = snapshot || cached;
    if (!data || !Array.isArray(data.companies)) return null;
    return data.companies.find(function (row) { return row && (row.registry === key || row.name === key); }) || null;
  }

  async function bind(root, options) {
    const scope = root || document;
    const data = await load(options);
    if (!data) return { updated: 0, snapshot: null };
    let updated = 0;
    scope.querySelectorAll('[data-tvl]').forEach(function (el) {
      const id = String(el.getAttribute('data-tvl') || '').toLowerCase();
      let value = null;
      if (id === 'total' || id === 'holding' || id === 'funds') value = data.totals && data.totals.fundEcosystemTvlUsd;
      else if (data.funds && data.funds[id]) value = data.funds[id].tvlUsd;
      const text = money(value, 0);
      if (text) { el.textContent = text; el.setAttribute('data-th-public-capital', 'automatic'); updated += 1; }
    });
    scope.querySelectorAll('[data-th-fund]').forEach(function (el) {
      const id = String(el.getAttribute('data-th-fund') || '').toLowerCase();
      const metric = String(el.getAttribute('data-th-fund-metric') || 'tvl').toLowerCase();
      const row = fund(id, data);
      if (!row) return;
      const digits = Number(el.getAttribute('data-th-digits'));
      const text = metric === 'reference-apr'
        ? percent(row.referenceAprPct, Number.isInteger(digits) ? digits : 1)
        : money(row.tvlUsd, Number.isInteger(digits) ? digits : 0);
      if (text) { el.textContent = text; el.setAttribute('data-th-public-capital', 'automatic'); updated += 1; }
    });
    scope.querySelectorAll('[data-th-company-capital]').forEach(function (el) {
      const key = el.getAttribute('data-th-company-capital');
      const row = company(key, data);
      const digits = Number(el.getAttribute('data-th-digits'));
      const text = row ? money(row.tvlUsd, Number.isInteger(digits) ? digits : 0) : null;
      if (text) { el.textContent = text; el.setAttribute('data-th-public-capital', 'automatic'); updated += 1; }
    });
    scope.querySelectorAll('[data-th-company-network-tvl]').forEach(function (el) {
      const digits = Number(el.getAttribute('data-th-digits'));
      const text = money(data.totals && data.totals.companyNetworkTvlUsd, Number.isInteger(digits) ? digits : 0);
      if (text) { el.textContent = text; el.setAttribute('data-th-public-capital', 'automatic'); updated += 1; }
    });
    return { updated: updated, snapshot: data };
  }

  function applyDefiteaHeadlineApr(root, text) {
    if (!text) return 0;
    const scope = root || document;
    const targets = [];
    const card = scope.querySelector && scope.querySelector('#apr-defitea');
    if (card) targets.push(card);
    if (scope.querySelectorAll) {
      scope.querySelectorAll('[data-th-company="defitea.eth"][data-th-company-apr="latest"]').forEach(function (el) { targets.push(el); });
    }
    let updated = 0;
    targets.forEach(function (el) {
      if (el.textContent !== text) { el.textContent = text; updated += 1; }
      el.setAttribute('data-th-defitea-apr-parity', 'latest');
      el.title = 'Current Reference APR · canonical Productivity Intelligence';
    });
    return updated;
  }

  async function syncDefiteaHeadlineApr(options) {
    try {
      const data = await loadProductivity(options);
      const row = data && data.companies ? data.companies['defitea.eth'] : null;
      const latest = finite(row && row.aprLatest);
      if (!Number.isFinite(latest) || latest < 0) throw new Error('Defitea latest APR unavailable');
      defiteaAprText = percent(latest, 1);
      applyDefiteaHeadlineApr(document, defiteaAprText);
      return { updated: true, aprLatest: latest, text: defiteaAprText };
    } catch (err) {
      console.warn('[TH Defitea APR parity] latest APR unavailable:', err && err.message ? err.message : err);
      return { updated: false, aprLatest: null, text: null };
    }
  }

  function observeDefiteaHeadlineApr() {
    if (!global.MutationObserver || defiteaObserver) return;
    defiteaObserver = new MutationObserver(function () {
      if (defiteaAprText) applyDefiteaHeadlineApr(document, defiteaAprText);
    });
    const root = document.documentElement || document.body;
    if (root) defiteaObserver.observe(root, { childList: true, subtree: true, characterData: true });
  }

  function autoBind() {
    bind(document).catch(function (err) { console.warn('[TH Public Capital] bind failed:', err && err.message ? err.message : err); });
    syncDefiteaHeadlineApr().catch(function () {});
    observeDefiteaHeadlineApr();
    setTimeout(function () { bind(document).catch(function () {}); }, 250);
    setTimeout(function () { syncDefiteaHeadlineApr().catch(function () {}); }, 350);
    setTimeout(function () { bind(document).catch(function () {}); }, 1200);
    setTimeout(function () { syncDefiteaHeadlineApr({ force: true }).catch(function () {}); }, 1400);
  }

  global.THPublicCapital = Object.freeze({
    version: VERSION,
    dataUrl: DEFAULT_URL,
    marketDataUrl: MARKET_URL,
    productivityDataUrl: PRODUCTIVITY_URL,
    load: load,
    loadMarket: loadMarket,
    loadProductivity: loadProductivity,
    getSnapshot: function () { return cached; },
    getFund: fund,
    getCompany: company,
    bind: bind,
    syncDefiteaHeadlineApr: syncDefiteaHeadlineApr,
    money: money,
    percent: percent
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', autoBind, { once: true });
  else autoBind();
})(window);
