/*
 * The Holding · Public Capital Client v0.1
 * ----------------------------------------
 * Read-only browser client for /intelligence/market-data/public-capital-state.json.
 * Pages render generated local state only. No browser-side CoinGecko requests.
 */
(function (global) {
  'use strict';

  const VERSION = '0.1';
  const DEFAULT_URL = '/intelligence/market-data/public-capital-state.json';
  const DEFAULT_TIMEOUT_MS = 4500;
  let cached = null;
  let pending = null;

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
        const res = await fetch(url + sep + 't=' + Date.now(), { cache: 'no-store', signal: controller.signal });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.json();
        if (!data || typeof data !== 'object' || !data.funds || !Array.isArray(data.companies)) {
          throw new Error('Invalid Public Capital State');
        }
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
    return data.companies.find(function (row) {
      return row && (row.registry === key || row.name === key);
    }) || null;
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
      if (text) {
        el.textContent = text;
        el.setAttribute('data-th-public-capital', 'automatic');
        updated += 1;
      }
    });

    scope.querySelectorAll('[data-th-fund]').forEach(function (el) {
      const id = String(el.getAttribute('data-th-fund') || '').toLowerCase();
      const metric = String(el.getAttribute('data-th-fund-metric') || 'tvl').toLowerCase();
      const row = fund(id, data);
      if (!row) return;
      const text = metric === 'reference-apr'
        ? percent(row.referenceAprPct, Number(el.getAttribute('data-th-digits')) || 1)
        : money(row.tvlUsd, Number(el.getAttribute('data-th-digits')) || 0);
      if (text) {
        el.textContent = text;
        el.setAttribute('data-th-public-capital', 'automatic');
        updated += 1;
      }
    });

    scope.querySelectorAll('[data-th-company-capital]').forEach(function (el) {
      const key = el.getAttribute('data-th-company-capital');
      const row = company(key, data);
      const text = row ? money(row.tvlUsd, Number(el.getAttribute('data-th-digits')) || 0) : null;
      if (text) {
        el.textContent = text;
        el.setAttribute('data-th-public-capital', 'automatic');
        updated += 1;
      }
    });

    scope.querySelectorAll('[data-th-company-network-tvl]').forEach(function (el) {
      const text = money(data.totals && data.totals.companyNetworkTvlUsd, Number(el.getAttribute('data-th-digits')) || 0);
      if (text) {
        el.textContent = text;
        el.setAttribute('data-th-public-capital', 'automatic');
        updated += 1;
      }
    });

    return { updated: updated, snapshot: data };
  }

  function autoBind() {
    bind(document).catch(function (err) {
      console.warn('[TH Public Capital] bind failed:', err && err.message ? err.message : err);
    });
  }

  global.THPublicCapital = Object.freeze({
    version: VERSION,
    dataUrl: DEFAULT_URL,
    load: load,
    getSnapshot: function () { return cached; },
    getFund: fund,
    getCompany: company,
    bind: bind,
    money: money,
    percent: percent
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', autoBind, { once: true });
  else autoBind();
})(window);
