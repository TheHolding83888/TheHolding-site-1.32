/*
 * The Holding · Productivity Intelligence UI Core v1.2
 * ----------------------------------------------------
 * One read-only client for the canonical Productivity Intelligence Layer.
 * Source of truth: /companies/productivity-data.json
 *
 * Intended for reuse across The Holding pages. Pages should never recalculate
 * Reference APR locally; they only render the normalized central snapshot.
 */
(function (global) {
  'use strict';

  const VERSION = '1.2';
  const DEFAULT_DATA_URL = '/companies/productivity-data.json';
  const DEFAULT_TIMEOUT_MS = 4500;

  let cachedSnapshot = null;
  let pendingLoad = null;

  function finiteNumber(value) {
    if (value === null || value === undefined || value === '') return NaN;
    const n = Number(value);
    return Number.isFinite(n) ? n : NaN;
  }

  function formatApr(value, digits) {
    const n = finiteNumber(value);
    if (!Number.isFinite(n)) return null;
    return n.toFixed(Number.isInteger(digits) ? digits : 1) + '%';
  }

  async function fetchSnapshot(options) {
    const opts = options || {};
    const dataUrl = opts.dataUrl || DEFAULT_DATA_URL;
    const timeoutMs = Number(opts.timeoutMs) > 0 ? Number(opts.timeoutMs) : DEFAULT_TIMEOUT_MS;
    const force = Boolean(opts.force);

    if (!force && cachedSnapshot) return cachedSnapshot;
    if (!force && pendingLoad) return pendingLoad;

    pendingLoad = (async function () {
      const controller = new AbortController();
      const timer = setTimeout(function () { controller.abort(); }, timeoutMs);
      try {
        const sep = dataUrl.indexOf('?') === -1 ? '?' : '&';
        const res = await fetch(dataUrl + sep + 't=' + Date.now(), {
          cache: 'no-store',
          signal: controller.signal
        });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.json();
        if (!data || typeof data !== 'object' || !data.engines || !data.companies) {
          throw new Error('Invalid productivity snapshot');
        }
        cachedSnapshot = data;
        return data;
      } catch (err) {
        console.warn('[TH Productivity Intelligence] snapshot unavailable:', err && err.message ? err.message : err);
        return cachedSnapshot;
      } finally {
        clearTimeout(timer);
        pendingLoad = null;
      }
    })();

    return pendingLoad;
  }

  function getEngine(engineId, snapshot) {
    const data = snapshot || cachedSnapshot;
    return data && data.engines ? data.engines[engineId] || null : null;
  }

  function getCompany(companyName, snapshot) {
    const data = snapshot || cachedSnapshot;
    return data && data.companies ? data.companies[companyName] || null : null;
  }

  /*
   * Generic protocol APR binder.
   *
   * Markup contract:
   *   <div data-th-engine="curve_vecrv">
   *     <span data-th-apr>8+%</span>
   *     <span data-th-apr-label>APR</span>
   *   </div>
   *
   * If the central snapshot contains a finite APR, it replaces the static
   * fallback. If an engine is warming/unavailable, the fallback remains until
   * a future snapshot becomes valid. No internal status needs to be exposed.
   */
  async function bindProtocolAprs(root, options) {
    const scope = root || document;
    const opts = options || {};
    const snapshot = await fetchSnapshot(opts);
    if (!snapshot) return { updated: 0, fallback: 0, snapshot: null };

    let updated = 0;
    let fallback = 0;
    const rows = scope.querySelectorAll('[data-th-engine]');

    rows.forEach(function (row) {
      const engineId = row.getAttribute('data-th-engine');
      const target = row.querySelector('[data-th-apr]');
      if (!engineId || !target) return;

      const engine = getEngine(engineId, snapshot);
      const apr = engine ? finiteNumber(engine.aprLatest) : NaN;

      if (Number.isFinite(apr) && apr >= 0) {
        target.textContent = formatApr(apr, 1);
        target.setAttribute('data-th-auto', 'true');
        row.setAttribute('data-th-productivity', 'automatic');
        if (engine.lastUpdatedAt || snapshot.generatedAt) {
          target.title = 'Reference APR · updated ' + (engine.lastUpdatedAt || snapshot.generatedAt);
        }
        updated += 1;
      } else {
        row.setAttribute('data-th-productivity', 'fallback');
        fallback += 1;
      }
    });

    return { updated: updated, fallback: fallback, snapshot: snapshot };
  }


  /*
   * Resolve the public company APR presentation from the canonical snapshot.
   * `latest` is always the current validated live APR when available.
   * `average` uses the canonical full-coverage historical average when one
   * exists; until then it intentionally starts from the validated live APR.
   * Internal coverage / partial status remains in the data layer and is not
   * exposed by this presentation helper.
   */
  function resolveCompanyApr(companyName, snapshot) {
    const data = snapshot || cachedSnapshot;
    const company = getCompany(companyName, data);
    if (!company) return null;

    const latest = finiteNumber(company.aprLatest);
    const historicalAverage = finiteNumber(company.aprHistoricalAverage);
    const publicAverage = Number.isFinite(historicalAverage) ? historicalAverage : latest;

    return {
      companyName: companyName,
      latest: Number.isFinite(latest) ? latest : NaN,
      average: Number.isFinite(publicAverage) ? publicAverage : NaN,
      historicalAverage: Number.isFinite(historicalAverage) ? historicalAverage : NaN,
      updatedAt: company.updatedAt || (data && data.generatedAt) || null,
      source: company.source || 'the-holding-productivity-intelligence-layer',
      status: company.status || null,
      coverage: finiteNumber(company.coverage)
    };
  }

  /*
   * Generic company APR binder.
   *
   * Markup contract:
   *   <span data-th-company="defitea.eth" data-th-company-apr="latest">13.3%</span>
   *   <span data-th-company="defitea.eth" data-th-company-apr="average">13.3%</span>
   *
   * Missing central data never replaces the static fallback.
   */
  async function bindCompanyAprs(root, options) {
    const scope = root || document;
    const opts = options || {};
    const snapshot = await fetchSnapshot(opts);
    if (!snapshot) return { updated: 0, fallback: 0, snapshot: null };

    let updated = 0;
    let fallback = 0;
    const targets = scope.querySelectorAll('[data-th-company][data-th-company-apr]');

    targets.forEach(function (target) {
      const companyName = target.getAttribute('data-th-company');
      const mode = (target.getAttribute('data-th-company-apr') || 'latest').toLowerCase();
      const resolved = resolveCompanyApr(companyName, snapshot);
      const value = resolved ? (mode === 'average' ? resolved.average : resolved.latest) : NaN;
      const digitsAttr = Number(target.getAttribute('data-th-apr-digits'));
      const digits = Number.isInteger(digitsAttr) && digitsAttr >= 0 && digitsAttr <= 4 ? digitsAttr : 1;

      if (Number.isFinite(value) && value >= 0) {
        target.textContent = formatApr(value, digits);
        target.setAttribute('data-th-auto', 'true');
        target.setAttribute('data-th-productivity', 'automatic');
        if (resolved.updatedAt) {
          target.title = (mode === 'average' ? 'Average APR' : 'Reference APR') + ' · updated ' + resolved.updatedAt;
        }
        updated += 1;
      } else {
        target.setAttribute('data-th-productivity', 'fallback');
        fallback += 1;
      }
    });

    return { updated: updated, fallback: fallback, snapshot: snapshot };
  }

  global.THProductivity = Object.freeze({
    version: VERSION,
    dataUrl: DEFAULT_DATA_URL,
    load: fetchSnapshot,
    getSnapshot: function () { return cachedSnapshot; },
    getEngine: getEngine,
    getCompany: getCompany,
    resolveCompanyApr: resolveCompanyApr,
    formatApr: formatApr,
    bindProtocolAprs: bindProtocolAprs,
    bindCompanyAprs: bindCompanyAprs
  });
})(window);
