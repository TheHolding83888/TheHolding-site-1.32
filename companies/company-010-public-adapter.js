/* The Holding · Company #010 Cypher public adapter · v0.2-native-ui
 * Canonical source: /companies/company-010-production-state.json
 * Presentation rule: reuse the existing Collection + General Passport UI contract.
 * Index rule: Cypher is visible but unweighted while totalCapitalComplete=false.
 */
(() => {
  'use strict';

  const STATE_URL = '/companies/company-010-production-state.json';
  const PRODUCTIVITY_URL = '/companies/productivity-data.json';
  const CAPITAL_URL = '/intelligence/capital-state/capital-state.json';
  const ENTRY = Object.freeze({ BTC:73482, ETH:2476, HYPE:38.62, CVX:1.84, CRV:0.228, AERO:0.60, LDO:0.8408, VELO:0.04762 });
  const PRODUCTIVE_ROUTE_IDS = new Set(['convex_vlcvx','aerodrome_veaero','velodrome_vevelo','gmx-gm-eth-usdc','gmx-gm-btc-usdc','projectx_hype','concentrator_sdcrv']);

  let state = null;
  let productivity = null;
  let installed = false;

  const lang = () => (document.documentElement.lang || 'en').toLowerCase().startsWith('ru') ? 'ru' : 'en';
  const money = v => '$' + Math.round(Number(v) || 0).toLocaleString('en-US');
  const pct = v => Number(v).toFixed(1) + '%';

  function currentReferenceApr() {
    if (!state) return null;
    let covered = 0;
    let weighted = 0;
    for (const p of state.productivity?.positions || []) {
      if (!PRODUCTIVE_ROUTE_IDS.has(p.id)) continue;
      let apr = null;
      if (p.status === 'measured' && Number.isFinite(Number(p.referenceAprPct))) apr = Number(p.referenceAprPct);
      if (p.status === 'supported-existing-adapter') {
        const live = productivity?.engines?.[p.id]?.aprLatest;
        if (Number.isFinite(Number(live))) apr = Number(live);
      }
      if (apr === null) continue;
      const value = Number(p.valueUsd) || 0;
      covered += value;
      weighted += value * apr;
    }
    return covered > 0 ? weighted / covered : null;
  }

  function cardCopy() {
    return lang() === 'ru'
      ? 'Компания Bitcoin Standard с резервным капиталом и продуктивными позициями в Convex, Aerodrome, Velodrome, GMX, Project X и Concentrator.'
      : 'A Bitcoin Standard company combining reserve capital with productive positions across Convex, Aerodrome, Velodrome, GMX, Project X and Concentrator.';
  }

  function ensureCollectionCard() {
    const placeholder = document.querySelector('.company-card.placeholder');
    if (!placeholder || !state) return;
    let card = document.querySelector('.company-card-010');
    if (!card) {
      card = document.createElement('div');
      card.className = 'company-card company-card-010 reveal';
      card.dataset.category = 'standard';
      placeholder.parentNode.insertBefore(card, placeholder);
    }
    const apr = currentReferenceApr();
    card.innerHTML = `
      <div class="cc-regnum"><span><span class="cc-reg-label">${lang()==='ru'?'Реестр':'Registry'}</span> · 010</span><span class="cc-founded">${lang()==='ru'?'Осн. 4 июл 2025':'Est. Jul 4, 2025'}</span></div>
      <div class="cc-top">
        <div class="cc-seal"><span class="cc-seal-mark" role="img" aria-label="The Holding registry seal"></span></div>
        <div class="cc-status"><span class="cc-dot"></span><span>Live</span></div>
      </div>
      <div class="cc-name">Cypher</div>
      <div class="cc-sub">${cardCopy()}</div>
      <div class="cc-metrics">
        <div><div class="cc-metric-label">${lang()==='ru'?'TVL компании':'Company TVL'}</div><div class="cc-metric-value gold" id="tvl-cypher">≥ ${money(state.capital.knownCapitalFloorUsd)}</div></div>
        <div><div class="cc-metric-label">APR</div><div class="cc-metric-value" id="apr-cypher">${apr===null ? (lang()==='ru'?'Измеряется':'Measuring') : pct(apr)}</div></div>
      </div>
      <span class="cc-extlink cc-extlink-static" aria-disabled="true"><span class="cc-ext-label">DeBank · Tracking</span></span>`;
    card.style.opacity = '1';
    card.style.transform = 'none';
    const count = document.getElementById('companyCount'); if (count) count.textContent = '10';
    const stat = document.getElementById('statCompanies'); if (stat) stat.textContent = '10';
    const statTVL = document.getElementById('statTVL');
    if (statTVL && window.__TH_CAPITAL_STATE__?.network?.totalCapitalComplete === false) {
      statTVL.textContent = '≥ ' + money(window.__TH_CAPITAL_STATE__.network.measuredCapitalFloorUsd);
    }
  }

  function installRuntimeBook() {
    if (!state) return;
    if (typeof COMPANY_PROTOCOLS !== 'undefined') {
      COMPANY_PROTOCOLS.Cypher = ['Bitcoin','Ethereum','Project X','Convex','Curve','Aero','Velodrome','GMX','Concentrator','Fluid'];
    }
    if (typeof COMPANY_ASSET_LABELS !== 'undefined') {
      Object.assign(COMPANY_ASSET_LABELS, {
        hyperliquid:'HYPE', 'lido-dao':'LDO', 'gmx-gm-eth-usdc':'GM · ETH-USDC', 'gmx-gm-btc-usdc':'GM · BTC-USDC'
      });
    }
    if (typeof COMPANY_BOOK !== 'undefined') {
      COMPANY_BOOK.Cypher = (state.capital?.positions || []).map(p => ({
        id: p.assetId || p.symbol.toLowerCase(), qty: Number(p.quantity) || 0,
        entry: ENTRY[p.symbol] ?? null,
        costBasisUsd: ENTRY[p.symbol] != null ? (Number(p.quantity) || 0) * ENTRY[p.symbol] : null,
        fixed: Number(p.priceUsd) || 0
      }));
    }
  }

  function cypherIndexRecord() {
    const apr = currentReferenceApr();
    const coverage = Number(state.productivity?.coverage || 0) * 100;
    const aprTextEn = apr === null ? 'Measuring' : `${apr.toFixed(1)}% · ${coverage.toFixed(1)}% covered`;
    const aprTextRu = apr === null ? 'Измеряется' : `${apr.toFixed(1)}% · покрыто ${coverage.toFixed(1)}%`;
    return {
      nm:'Cypher', displayName:'Cypher', val:Number(state.capital.knownCapitalFloorUsd)||0,
      cost:0, pnl:0, pct:0, href:null, indexEligible:false, capitalFloor:true, capitalComplete:false,
      cat:{ en:'Bitcoin Standard · measured floor', ru:'Bitcoin Standard · измеренный минимум' },
      since:{ en:'Jul 2025', ru:'Июл 2025' }, reg:'010', foundedISO:'2025-07-04',
      founded:{ en:'Jul 4, 2025', ru:'4 июл 2025' },
      arch:{ en:'Layered Capital / Bitcoin Standard', ru:'Layered Capital / Bitcoin Standard' },
      protocols:10, status:{ en:'Pending capital completion', ru:'Ожидает закрытия капитала' },
      aprNumeric: apr ?? 0, aprLatest: apr, aprDisplay:{en:aprTextEn,ru:aprTextRu}, aprSource:'canonical-partial', aprObservationCount:0,
      pendingReason:{ en:'Fluid net ETH remains unresolved', ru:'Чистая ETH-экспозиция Fluid ещё не закрыта' }
    };
  }

  function installIndexRecord() {
    if (!state || typeof INDEX_STATE === 'undefined' || !Array.isArray(INDEX_STATE)) return false;
    const existing = INDEX_STATE.find(c => c && c.nm === 'Cypher');
    const next = cypherIndexRecord();
    if (existing) Object.assign(existing, next);
    else INDEX_STATE.push(next);
    return true;
  }

  function rerenderNativeSurfaces() {
    if (!installIndexRecord()) return false;
    ensureCollectionCard();
    if (typeof renderIndex === 'function') renderIndex(typeof idxLang === 'function' ? idxLang() : lang());
    if (typeof buildGraph === 'function') buildGraph();
    return true;
  }

  function hookRender() {
    if (installed || typeof renderIndex !== 'function') return;
    const original = renderIndex;
    renderIndex = function(...args) {
      const out = original.apply(this, args);
      ensureCollectionCard();
      return out;
    };
    installed = true;
  }

  async function start() {
    const [stateRes, prodRes, capitalRes] = await Promise.all([
      fetch(STATE_URL,{cache:'no-store'}),
      fetch(PRODUCTIVITY_URL,{cache:'no-store'}).catch(()=>null),
      fetch(CAPITAL_URL,{cache:'no-store'}).catch(()=>null)
    ]);
    if (!stateRes.ok) throw new Error('Cypher canonical state unavailable: '+stateRes.status);
    state = await stateRes.json();
    productivity = prodRes?.ok ? await prodRes.json() : null;
    window.__TH_CAPITAL_STATE__ = capitalRes?.ok ? await capitalRes.json() : null;

    if (state.company?.registry !== '010' || state.company?.name !== 'Cypher') throw new Error('Cypher identity mismatch');
    if (state.authority?.executionAuthority !== 'none' || state.authority?.transactions !== false) throw new Error('Cypher authority boundary drift');
    if (state.capital?.totalCapitalComplete !== false) throw new Error('Cypher native UI v0.2 expects incomplete Fluid state');

    installRuntimeBook();
    hookRender();

    let attempts = 0;
    const timer = setInterval(() => {
      attempts += 1;
      if (rerenderNativeSurfaces() || attempts > 40) clearInterval(timer);
    }, 100);
    rerenderNativeSurfaces();

    const observer = new MutationObserver(() => ensureCollectionCard());
    observer.observe(document.documentElement,{attributes:true,attributeFilter:['lang','class']});
  }

  const run = () => start().catch(err => console.error('[Company #010 native public adapter]', err));
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run, {once:true}); else run();
})();
