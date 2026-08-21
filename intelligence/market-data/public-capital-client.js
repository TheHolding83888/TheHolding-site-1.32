/*
 * The Holding · Public Capital Client v0.3.1
 * ------------------------------------------
 * Read-only browser client for generated local Market Data / Public Capital.
 * Legacy simple-price calls are intercepted locally; browsers never need to
 * contact CoinGecko directly and never need a CoinGecko credential.
 *
 * v0.2.2 introduced Defitea headline APR coherence.
 * v0.3.0 extended canonical-source discipline across critical public surfaces.
 * v0.3.1 keeps the homepage Network narrative aligned with the evolved product:
 * Network · Index · Intelligence · Passports.
 */
(function (global) {
  'use strict';

  const VERSION = '0.3.1';
  const DEFAULT_URL = '/intelligence/market-data/public-capital-state.json';
  const MARKET_URL = '/intelligence/market-data/market-data.json';
  const PRODUCTIVITY_URL = '/companies/productivity-data.json';
  const LEGACY_SIMPLE_PRICE_PATH = '/intelligence/market-data/simple-price';
  const DEFAULT_TIMEOUT_MS = 4500;
  const CURRENT_NETWORK_PROTOCOL_ASSET_COUNT = 29;
  const HOMEPAGE_NETWORK_SUB = 'A live network of sovereign onchain companies — independently owned and measured through capital, productivity, rewards and operating history.';
  const HOMEPAGE_NETWORK_CAPS = 'The Holding Network · Index · Intelligence · Passports';
  const originalFetch = global.fetch.bind(global);
  let cached = null;
  let pending = null;
  let cachedMarket = null;
  let pendingMarket = null;
  let cachedProductivity = null;
  let pendingProductivity = null;
  let publicSurfaceObserver = null;
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

  function applyDefiteaCurrentTvl(root, data) {
    const scope = root || document;
    const row = fund('defitea', data);
    const text = row ? money(row.tvlUsd, 0) : null;
    if (!text || !scope.querySelectorAll) return 0;
    let updated = 0;
    scope.querySelectorAll('[data-tvl="defitea"], [data-tvl-perf="defitea"]').forEach(function (el) {
      if (el.textContent !== text) { el.textContent = text; updated += 1; }
      el.setAttribute('data-th-current-tvl-authority', 'public-capital-state');
      el.title = 'Current capital · canonical Public Capital State';
    });
    return updated;
  }

  function applySubstantiaMarketDataProvenance(root, data) {
    const scope = root || document;
    if (!scope.querySelectorAll) return 0;
    const source = data && data.sourceState ? data.sourceState : {};
    const observedAt = source.marketDataObservedAt || source.marketDataGeneratedAt || null;
    const observed = observedAt ? new Date(observedAt) : null;
    const valid = observed && !Number.isNaN(observed.getTime());
    const stamp = valid ? observed.toLocaleTimeString('en-GB', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit' }) + ' UTC' : null;
    const text = stamp ? 'Observed ' + stamp + ' · Market Data' : 'Canonical Market Data';
    let updated = 0;
    scope.querySelectorAll('[data-tvl-updated="substantia"]').forEach(function (el) {
      if (el.textContent !== text) { el.textContent = text; updated += 1; }
      el.setAttribute('data-th-market-data-provenance', 'canonical');
      el.title = 'Canonical Market Data observation; asset-level provenance is preserved upstream';
    });
    return updated;
  }

  function applyHomepageNetwork(root, data) {
    const scope = root || document;
    if (!scope.querySelector) return 0;
    let updated = 0;
    const networkValue = data && data.totals ? money(data.totals.companyNetworkTvlUsd, 0) : null;
    const valueEl = scope.querySelector('#nsNetworkValue');
    if (valueEl && networkValue && valueEl.textContent !== networkValue) {
      valueEl.textContent = networkValue;
      valueEl.setAttribute('data-th-company-network-tvl', '');
      valueEl.title = 'All registered companies · canonical Public Capital State';
      updated += 1;
    }
    const companyCount = Array.isArray(data && data.companies) ? data.companies.length : null;
    if (scope.querySelectorAll) {
      scope.querySelectorAll('.ns-stats .ns-stat').forEach(function (stat) {
        const bold = stat.querySelector('b');
        const text = String(stat.textContent || '');
        if (bold && Number.isFinite(companyCount) && /Companies/i.test(text)) {
          const next = String(companyCount);
          if (bold.textContent !== next) { bold.textContent = next; updated += 1; }
          stat.title = 'Canonical registry company count';
        }
        if (bold && /Protocols\s*&\s*Assets/i.test(text)) {
          const next = String(CURRENT_NETWORK_PROTOCOL_ASSET_COUNT);
          if (bold.textContent !== next) { bold.textContent = next; updated += 1; }
          stat.title = 'Current unique protocol / asset map across the 10-company registry';
        }
      });
    }
    const sub = scope.querySelector('.network-section .ns-sub, .ns-section .ns-sub, .ns-sub');
    if (sub && sub.textContent !== HOMEPAGE_NETWORK_SUB) {
      sub.textContent = HOMEPAGE_NETWORK_SUB;
      updated += 1;
    }
    if (scope.querySelectorAll) {
      scope.querySelectorAll('.ns-caps-full, .ns-caps-short').forEach(function (el) {
        if (el.textContent !== HOMEPAGE_NETWORK_CAPS) {
          el.textContent = HOMEPAGE_NETWORK_CAPS;
          updated += 1;
        }
      });
    }
    return updated;
  }

  function nearestFundCard(el) {
    if (!el) return null;
    if (el.closest) {
      const direct = el.closest('.fund-card, .fund-item, article');
      if (direct) return direct;
    }
    let node = el.parentElement;
    for (let i = 0; node && i < 6; i += 1, node = node.parentElement) {
      if (node.querySelectorAll && node.querySelectorAll('.fund-metric').length >= 2) return node;
    }
    return null;
  }

  function applyHomepageMonetra(root, data) {
    const scope = root || document;
    const row = fund('monetra', data);
    if (!row || !scope.querySelectorAll) return 0;
    const apy = percent(row.referenceAprPct, 2);
    if (!apy) return 0;
    let updated = 0;
    const cards = [];
    scope.querySelectorAll('[data-tvl="monetra"]').forEach(function (el) {
      const card = nearestFundCard(el);
      if (card && cards.indexOf(card) === -1) cards.push(card);
    });
    cards.forEach(function (card) {
      card.querySelectorAll('.fund-metric').forEach(function (metric) {
        const label = metric.querySelector('.fund-metric-label');
        const value = metric.querySelector('.fund-metric-value');
        if (!label || !value) return;
        if (/^Status$/i.test(String(label.textContent || '').trim()) || /Reference APY/i.test(String(label.textContent || ''))) {
          if (label.textContent !== 'Reference APY') { label.textContent = 'Reference APY'; updated += 1; }
          if (value.textContent !== apy) { value.textContent = apy; updated += 1; }
          value.setAttribute('data-th-fund', 'monetra');
          value.setAttribute('data-th-fund-metric', 'reference-apr');
          value.setAttribute('data-th-digits', '2');
          value.title = 'Canonical Stable Capital Reference APY';
        }
      });
      card.querySelectorAll('p').forEach(function (p) {
        const text = String(p.textContent || '').trim();
        if (text === 'Monetra is a building layer of The Holding.') {
          p.textContent = 'Monetra is the live stable-capital layer of The Holding.';
          updated += 1;
        }
      });
    });
    return updated;
  }

  function applyMonetraStandalone(root, data) {
    const path = String(global.location && global.location.pathname || '').replace(/\/+$/, '') || '/';
    if (path !== '/monetra') return 0;
    const scope = root || document;
    const row = fund('monetra', data);
    if (!row || !scope.querySelectorAll) return 0;
    const capital = money(row.tvlUsd, 2);
    const apy = percent(row.referenceAprPct, 2);
    if (!capital || !apy) return 0;
    const stats = Array.from(scope.querySelectorAll('.hero-stats .hero-stat'));
    if (stats.length < 2) return 0;
    let updated = 0;
    function setStat(stat, valueText, labelText) {
      if (!stat) return;
      const value = stat.querySelector('.hero-stat-value');
      const label = stat.querySelector('.hero-stat-label');
      if (value && value.textContent !== valueText) { value.textContent = valueText; updated += 1; }
      if (label && label.textContent !== labelText) { label.textContent = labelText; updated += 1; }
    }
    setStat(stats[0], capital, 'Current Capital');
    setStat(stats[1], apy, 'Reference APY');
    if (stats[2]) setStat(stats[2], 'Live', 'Stable Strategy Tracking');
    stats[0].setAttribute('data-th-monetra-live', 'capital');
    stats[1].setAttribute('data-th-monetra-live', 'reference-apy');
    return updated;
  }

  function applySingulCanonicalHoldings(root, data) {
    const path = String(global.location && global.location.pathname || '').replace(/\/+$/, '') || '/';
    if (path !== '/singul') return 0;
    const scope = root || document;
    const row = fund('singul', data);
    if (!row || !Array.isArray(row.positions) || !scope.querySelectorAll) return 0;
    const liveSymbols = new Set(row.positions.map(function (p) { return String(p && p.symbol || '').toUpperCase(); }).filter(Boolean));
    const aliases = {
      'VIRTUALS PROTOCOL': 'VIRTUAL',
      'ELIZAOS': 'ELIZA',
      'MODE NETWORK': 'MODE',
      'OVER THE REALITY': 'OVR'
    };
    let updated = 0;
    const heading = scope.querySelector('.assets-title');
    if (heading && /Current Holdings/i.test(String(heading.textContent || '')) && heading.textContent !== 'Current Onchain Holdings') {
      heading.textContent = 'Current Onchain Holdings';
      updated += 1;
    }
    scope.querySelectorAll('.assets-list .asset-item').forEach(function (item) {
      const nameEl = item.querySelector('.asset-name');
      if (!nameEl) return;
      const raw = String(nameEl.textContent || '').trim();
      const upper = raw.toUpperCase();
      const symbol = aliases[upper] || upper;
      const isCanonical = liveSymbols.has(symbol);
      if (!isCanonical) {
        if (!item.hidden) { item.hidden = true; updated += 1; }
        item.setAttribute('data-th-current-holding', 'research-only');
        item.title = 'Research / focus area · not in current canonical Singul balance';
      } else {
        if (item.hidden) { item.hidden = false; updated += 1; }
        item.setAttribute('data-th-current-holding', 'canonical');
      }
    });
    return updated;
  }

  function applyPublicSurfaceCoherence(root, data) {
    if (!data) return 0;
    let updated = 0;
    updated += applyDefiteaCurrentTvl(root, data);
    updated += applySubstantiaMarketDataProvenance(root, data);
    updated += applyHomepageNetwork(root, data);
    updated += applyHomepageMonetra(root, data);
    updated += applyMonetraStandalone(root, data);
    updated += applySingulCanonicalHoldings(root, data);
    return updated;
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
    updated += applyPublicSurfaceCoherence(scope, data);
    return { updated: updated, snapshot: data };
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

  function observePublicSurfaceCoherence() {
    if (!global.MutationObserver || publicSurfaceObserver) return;
    publicSurfaceObserver = new MutationObserver(function () {
      if (defiteaAprText) applyDefiteaHeadlineApr(document, defiteaAprText);
      if (cached) applyPublicSurfaceCoherence(document, cached);
    });
    const root = document.documentElement || document.body;
    if (root) publicSurfaceObserver.observe(root, { childList: true, subtree: true, characterData: true });
  }

  function autoBind() {
    bind(document).catch(function (err) { console.warn('[TH Public Capital] bind failed:', err && err.message ? err.message : err); });
    syncDefiteaHeadlineApr().catch(function () {});
    observePublicSurfaceCoherence();
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
    applyPublicSurfaceCoherence: applyPublicSurfaceCoherence,
    money: money,
    percent: percent
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', autoBind, { once: true });
  else autoBind();
})(window);
