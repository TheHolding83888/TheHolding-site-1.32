/* The Holding · Company Monthly Report adapter · v0.1.0
 * Presentation only. Reads canonical /reporting/reporting-data.json.
 * Initial scope: defitea.eth. No accounting, TVL, Rewards or execution authority changes.
 */
(() => {
  'use strict';
  if (window.__TH_MONTHLY_REPORT_ADAPTER__) return;

  const URL = '/reporting/reporting-data.json';
  const COMPANY = 'defitea.eth';
  let snapshot = null;
  let loading = null;
  let renderQueued = false;

  const lang = () => (document.documentElement.lang || 'en').toLowerCase().startsWith('ru') ? 'ru' : 'en';
  const finite = v => v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v));
  const money = (v, digits = 2) => '$' + Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  const money0 = v => '$' + Math.round(Number(v || 0)).toLocaleString('en-US');
  const pct = v => finite(v) ? Number(v).toFixed(2) + '%' : '—';
  const node = (tag, className, text) => {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined && text !== null) el.textContent = String(text);
    return el;
  };

  const copy = () => lang() === 'ru' ? {
    trigger: 'Ежемесячный отчёт', generated: 'сгенерировано', live: 'Live',
    report: 'Отчёт фонда · Месяц', monthYield: 'Доходность месяца', annualised: 'Годовой темп',
    avgTvl: 'Средний TVL', observed: 'Наблюдение', days: 'дней',
    closedYtd: 'Закрытые месяцы YTD', yearAnnualised: '2026 годовой темп',
    includesLive: '8 месяцев · включая live август', model: 'Live reference model · не claim accounting',
    full: 'Полный отчёт', provisional: 'Предварительно', final: 'Финально',
    close: 'Закрыть ежемесячный отчёт'
  } : {
    trigger: 'Monthly Report', generated: 'generated', live: 'Live',
    report: 'Fund Report · Monthly', monthYield: 'Month Yield', annualised: 'Annualised',
    avgTvl: 'Average TVL', observed: 'Observed', days: 'days',
    closedYtd: 'Closed-month YTD', yearAnnualised: '2026 Annualised',
    includesLive: '8 months · incl. live August', model: 'Live reference model · not claim accounting',
    full: 'Full report', provisional: 'Provisional', final: 'Final',
    close: 'Close monthly report'
  };

  function monthLabel(key) {
    const [y, m] = String(key || '').split('-').map(Number);
    if (!y || !m) return key || '—';
    return new Intl.DateTimeFormat(lang() === 'ru' ? 'ru-RU' : 'en-US', { month: 'long', year: 'numeric' })
      .format(new Date(Date.UTC(y, m - 1, 1)));
  }

  function monthShort(key) {
    const [y, m] = String(key || '').split('-').map(Number);
    if (!y || !m) return key || '—';
    return new Intl.DateTimeFormat(lang() === 'ru' ? 'ru-RU' : 'en-US', { month: 'long' })
      .format(new Date(Date.UTC(y, m - 1, 1)));
  }

  async function load() {
    if (snapshot) return snapshot;
    if (loading) return loading;
    loading = fetch(URL + '?t=' + Date.now(), { cache: 'no-store' })
      .then(r => { if (!r.ok) throw new Error('Reporting HTTP ' + r.status); return r.json(); })
      .then(d => { snapshot = d; return d; })
      .finally(() => { loading = null; });
    return loading;
  }

  function currentState() {
    const fund = snapshot?.funds?.[COMPANY];
    if (!fund) return null;
    const summary = fund.summaries?.['2026'] || null;
    const monthKey = summary?.currentMonth || Object.keys(fund.months || {}).sort().at(-1) || null;
    const month = monthKey ? fund.months?.[monthKey] : null;
    if (!month) return null;
    return { fund, summary, monthKey, month };
  }

  function ensureStyle() {
    if (document.getElementById('th-monthly-report-style')) return;
    const s = document.createElement('style');
    s.id = 'th-monthly-report-style';
    s.textContent = `
      .th-defitea-financial-stack{min-width:0;display:grid;grid-template-rows:auto auto;gap:.52rem;align-content:start;align-self:stretch}
      .th-monthly-report-disclosure{position:relative;min-width:0;border:1px solid rgba(168,132,44,.14);border-radius:14px;background:radial-gradient(circle at 96% 0,rgba(255,255,255,.98),rgba(255,255,255,0) 36%),linear-gradient(180deg,rgba(255,253,247,.98),rgba(249,248,242,.93));box-shadow:0 14px 34px -30px rgba(22,21,15,.34),inset 0 1px 0 rgba(255,255,255,.94);overflow:visible}
      .th-mr-trigger{appearance:none;-webkit-appearance:none;width:100%;min-width:0;border:0;background:transparent;color:inherit;font:inherit;text-align:left;cursor:pointer;padding:.62rem .72rem .6rem;border-radius:inherit;display:grid;grid-template-columns:minmax(0,1fr) auto;grid-template-areas:'kicker badge' 'value meta';column-gap:.7rem;row-gap:.22rem;align-items:end}
      .th-mr-kicker{grid-area:kicker;color:var(--text-3);font-size:.52rem;font-weight:700;letter-spacing:.145em;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .th-mr-badge{grid-area:badge;justify-self:end;display:inline-flex;align-items:center;min-height:19px;padding:.14rem .38rem;border:1px solid rgba(10,124,78,.12);border-radius:999px;background:rgba(10,124,78,.05);color:var(--green);font-size:.49rem;font-weight:700;letter-spacing:.055em;text-transform:uppercase;white-space:nowrap}
      .th-mr-value-wrap{grid-area:value;min-width:0;display:flex;align-items:baseline;gap:.38rem}
      .th-mr-value{font-family:'Cormorant Garamond',serif;font-size:1.34rem;line-height:1;font-weight:600;letter-spacing:-.02em;color:var(--gold);font-variant-numeric:tabular-nums;white-space:nowrap}
      .th-mr-value-label{color:var(--text-3);font-size:.5rem;white-space:nowrap}
      .th-mr-meta{grid-area:meta;justify-self:end;display:inline-flex;align-items:center;gap:.36rem;color:var(--text-2);font-size:.53rem;font-weight:600;white-space:nowrap}
      .th-mr-arrow{color:var(--gold);font-size:.72rem;line-height:1;transition:transform .22s ease}
      .th-monthly-report-disclosure.open .th-mr-arrow{transform:rotate(180deg)}
      .th-mr-trigger:hover,.th-mr-trigger:focus-visible{background:rgba(168,132,44,.025)}
      .th-mr-trigger:focus-visible{outline:1px solid rgba(168,132,44,.34);outline-offset:2px}

      .th-monthly-report-panel{position:absolute;right:0;top:calc(100% + 9px);width:min(438px,calc(100vw - 30px));max-height:min(68vh,520px);overflow:auto;overscroll-behavior:contain;z-index:48;padding:.88rem;border:1px solid rgba(15,23,42,.085);border-radius:20px;background:radial-gradient(circle at 92% 0,rgba(255,255,255,1),rgba(255,255,255,0) 36%),rgba(252,252,249,.995);box-shadow:0 34px 74px -28px rgba(15,23,42,.34),0 10px 24px -18px rgba(15,23,42,.18);opacity:0;visibility:hidden;pointer-events:none;transform:translateY(-5px) scale(.985);transition:opacity .24s ease,visibility .24s ease,transform .26s cubic-bezier(.16,1,.3,1)}
      .th-monthly-report-disclosure.open>.th-monthly-report-panel{opacity:1;visibility:visible;pointer-events:auto;transform:translateY(0) scale(1)}
      .th-mr-head{display:flex;align-items:flex-start;justify-content:space-between;gap:1rem;padding:.18rem .18rem .72rem;border-bottom:1px solid var(--line)}
      .th-mr-head-copy{min-width:0}
      .th-mr-panel-kicker{color:var(--text-3);font-size:.5rem;font-weight:700;letter-spacing:.15em;text-transform:uppercase}
      .th-mr-title{margin-top:.22rem;font-family:'Cormorant Garamond',serif;font-size:1.42rem;font-weight:600;line-height:1;letter-spacing:-.02em;color:var(--text);text-transform:capitalize}
      .th-mr-close{flex:0 0 auto;width:30px;height:30px;display:inline-flex;align-items:center;justify-content:center;border:1px solid rgba(15,23,42,.07);border-radius:50%;background:rgba(255,255,255,.8);color:var(--text-3);font:400 1rem/1 'Space Grotesk',sans-serif;cursor:pointer}
      .th-mr-close:hover,.th-mr-close:focus-visible{color:var(--text);background:#fff}
      .th-mr-close:focus-visible{outline:1px solid rgba(168,132,44,.28);outline-offset:2px}
      .th-mr-hero{display:flex;align-items:flex-end;justify-content:space-between;gap:1rem;padding:1rem .18rem .88rem}
      .th-mr-hero-label{color:var(--text-3);font-size:.55rem;letter-spacing:.08em;text-transform:uppercase;font-weight:650}
      .th-mr-hero-value{margin-top:.28rem;font-family:'Cormorant Garamond',serif;font-size:2.3rem;line-height:.92;font-weight:600;letter-spacing:-.035em;color:var(--gold);font-variant-numeric:tabular-nums;white-space:nowrap}
      .th-mr-status{flex:0 0 auto;display:inline-flex;align-items:center;padding:.28rem .5rem;border:1px solid rgba(10,124,78,.12);border-radius:999px;background:rgba(10,124,78,.045);color:var(--green);font-size:.48rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;white-space:nowrap}
      .th-mr-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.48rem}
      .th-mr-metric{min-width:0;padding:.72rem .72rem .68rem;border:1px solid rgba(15,23,42,.065);border-radius:13px;background:rgba(255,255,255,.68)}
      .th-mr-metric-label{color:var(--text-3);font-size:.49rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;line-height:1.25}
      .th-mr-metric-value{margin-top:.3rem;color:var(--text);font-family:'Cormorant Garamond',serif;font-size:1.32rem;font-weight:600;line-height:1;letter-spacing:-.018em;font-variant-numeric:tabular-nums;white-space:nowrap}
      .th-mr-year{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0;margin-top:.62rem;border-top:1px solid var(--line);border-bottom:1px solid var(--line)}
      .th-mr-year-cell{min-width:0;padding:.72rem .5rem .68rem}
      .th-mr-year-cell+.th-mr-year-cell{border-left:1px solid var(--line)}
      .th-mr-year-label{color:var(--text-3);font-size:.48rem;font-weight:700;letter-spacing:.07em;text-transform:uppercase}
      .th-mr-year-value{margin-top:.26rem;color:var(--text);font-size:.78rem;font-weight:650;font-variant-numeric:tabular-nums;white-space:nowrap}
      .th-mr-year-note{margin-top:.15rem;color:var(--text-3);font-size:.5rem;line-height:1.35}
      .th-mr-foot{display:flex;align-items:center;justify-content:space-between;gap:.8rem;padding:.72rem .18rem .08rem}
      .th-mr-method{min-width:0;color:var(--text-3);font-size:.5rem;line-height:1.35}
      .th-mr-link{flex:0 0 auto;color:var(--green);font-size:.56rem;font-weight:700;text-decoration:none;white-space:nowrap}
      .th-mr-link:hover,.th-mr-link:focus-visible{text-decoration:underline;text-underline-offset:3px}

      .th-mr-backdrop{position:fixed;inset:0;z-index:2230;background:rgba(15,23,42,.14);backdrop-filter:blur(2px);-webkit-backdrop-filter:blur(2px);opacity:0;visibility:hidden;pointer-events:none;transition:opacity .22s ease,visibility .22s ease}
      .th-mr-backdrop.open{opacity:1;visibility:visible;pointer-events:auto}
      @media(max-width:760.98px){
        .th-defitea-financial-stack{gap:.42rem}
        .th-mr-trigger{padding:.58rem .64rem .56rem;column-gap:.5rem}
        .th-mr-kicker{font-size:.49rem;letter-spacing:.12em}
        .th-mr-value{font-size:1.22rem}
        .th-mr-value-label,.th-mr-meta{font-size:.49rem}
        .th-monthly-report-panel{position:fixed;left:14px;right:14px;top:50%;bottom:auto;width:auto;max-height:min(72vh,540px);z-index:2240;transform:translateY(-50%) scale(.975);padding:.76rem;border-radius:20px;opacity:0;visibility:hidden;pointer-events:none}
        .th-monthly-report-disclosure.open>.th-monthly-report-panel{opacity:0;visibility:hidden;pointer-events:none;transform:translateY(-50%) scale(.975)}
        .th-monthly-report-panel.th-mr-portal-open{opacity:1;visibility:visible;pointer-events:auto;transform:translateY(-50%) scale(1)}
        .th-mr-hero{padding:.88rem .12rem .78rem}
        .th-mr-hero-value{font-size:2rem}
        .th-mr-grid{gap:.42rem}
        .th-mr-metric{padding:.64rem .62rem .6rem}
        .th-mr-metric-label{font-size:.45rem}
        .th-mr-metric-value{font-size:1.18rem}
        .th-mr-year-cell{padding:.64rem .42rem .6rem}
        .th-mr-year-label{font-size:.44rem}
        .th-mr-year-value{font-size:.7rem}
        .th-mr-year-note,.th-mr-method{font-size:.47rem}
        .th-mr-foot{align-items:flex-end}
        body.th-mr-overlay-open{overflow:hidden}
      }
      @media(max-width:390px){
        .th-mr-trigger{grid-template-columns:minmax(0,1fr) auto;column-gap:.36rem}
        .th-mr-kicker{font-size:.46rem}
        .th-mr-badge{font-size:.44rem;padding:.12rem .32rem}
        .th-mr-value{font-size:1.14rem}
        .th-mr-value-label{display:none}
        .th-mr-meta{font-size:.46rem}
        .th-monthly-report-panel{left:10px;right:10px;padding:.68rem}
        .th-mr-title{font-size:1.28rem}
        .th-mr-hero-value{font-size:1.82rem}
        .th-mr-metric{padding:.58rem .54rem .56rem}
        .th-mr-metric-value{font-size:1.08rem}
        .th-mr-year-value{font-size:.66rem;white-space:normal}
        .th-mr-link{font-size:.52rem}
      }
      @media(prefers-reduced-motion:reduce){.th-monthly-report-panel,.th-mr-backdrop,.th-mr-arrow{transition-duration:.01ms!important}}
    `;
    document.head.appendChild(s);
  }

  function ensureBackdrop() {
    let bg = document.querySelector('.th-mr-backdrop');
    if (!bg) {
      bg = node('div', 'th-mr-backdrop');
      bg.setAttribute('aria-hidden', 'true');
      document.body.appendChild(bg);
    }
    return bg;
  }

  function metric(label, value) {
    const card = node('div', 'th-mr-metric');
    card.appendChild(node('div', 'th-mr-metric-label', label));
    card.appendChild(node('div', 'th-mr-metric-value', value));
    return card;
  }

  function yearCell(label, value, note) {
    const cell = node('div', 'th-mr-year-cell');
    cell.appendChild(node('div', 'th-mr-year-label', label));
    cell.appendChild(node('div', 'th-mr-year-value', value));
    if (note) cell.appendChild(node('div', 'th-mr-year-note', note));
    return cell;
  }

  function buildDisclosure(state) {
    const C = copy();
    const { month, monthKey, summary } = state;
    const disclosure = node('div', 'th-monthly-report-disclosure');
    disclosure.dataset.monthlyReport = COMPANY;

    const trigger = node('button', 'th-mr-trigger');
    trigger.type = 'button';
    trigger.setAttribute('aria-expanded', 'false');
    trigger.appendChild(node('div', 'th-mr-kicker', C.trigger));
    trigger.appendChild(node('span', 'th-mr-badge', `${monthShort(monthKey)} · ${C.live}`));
    const valueWrap = node('div', 'th-mr-value-wrap');
    valueWrap.appendChild(node('span', 'th-mr-value', money(month.cashFlowUsd)));
    valueWrap.appendChild(node('span', 'th-mr-value-label', C.generated));
    trigger.appendChild(valueWrap);
    const meta = node('div', 'th-mr-meta');
    meta.appendChild(node('span', '', `${pct(month.monthlyYieldPct)} · ${pct(month.annualizedAprPct)}`));
    meta.appendChild(node('span', 'th-mr-arrow', '⌄'));
    trigger.appendChild(meta);
    disclosure.appendChild(trigger);

    const panel = node('div', 'th-monthly-report-panel');
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', `${C.report} · ${monthLabel(monthKey)}`);
    panel.__thOwner = disclosure;

    const head = node('div', 'th-mr-head');
    const headCopy = node('div', 'th-mr-head-copy');
    headCopy.appendChild(node('div', 'th-mr-panel-kicker', C.report));
    headCopy.appendChild(node('div', 'th-mr-title', monthLabel(monthKey)));
    head.appendChild(headCopy);
    const close = node('button', 'th-mr-close', '×');
    close.type = 'button';
    close.setAttribute('aria-label', C.close);
    head.appendChild(close);
    panel.appendChild(head);

    const hero = node('div', 'th-mr-hero');
    const heroCopy = node('div');
    heroCopy.appendChild(node('div', 'th-mr-hero-label', C.generated));
    heroCopy.appendChild(node('div', 'th-mr-hero-value', money(month.cashFlowUsd)));
    hero.appendChild(heroCopy);
    hero.appendChild(node('span', 'th-mr-status', month.status === 'provisional' ? C.provisional : C.final));
    panel.appendChild(hero);

    const grid = node('div', 'th-mr-grid');
    grid.appendChild(metric(C.monthYield, pct(month.monthlyYieldPct)));
    grid.appendChild(metric(C.annualised, pct(month.annualizedAprPct)));
    grid.appendChild(metric(C.avgTvl, money0(month.averageTvlUsd)));
    const observed = finite(month.sampleDays) && finite(month.expectedDays)
      ? `${Number(month.sampleDays)} / ${Number(month.expectedDays)} ${C.days}`
      : '—';
    grid.appendChild(metric(C.observed, observed));
    panel.appendChild(grid);

    const year = node('div', 'th-mr-year');
    year.appendChild(yearCell(C.closedYtd, finite(summary?.ytdCashFlowUsd) ? money(summary.ytdCashFlowUsd) : '—', finite(summary?.closedMonths) ? `${Number(summary.closedMonths)} ${lang() === 'ru' ? 'закрытых месяцев' : 'closed months'}` : null));
    year.appendChild(yearCell(C.yearAnnualised, pct(summary?.annualizedCashFlowAprPct), finite(summary?.annualizedCashFlowAprMonths) ? `${Number(summary.annualizedCashFlowAprMonths)} ${lang() === 'ru' ? 'месяцев · включая live август' : 'months · incl. live August'}` : C.includesLive));
    panel.appendChild(year);

    const foot = node('div', 'th-mr-foot');
    foot.appendChild(node('div', 'th-mr-method', C.model));
    const link = node('a', 'th-mr-link', C.full + ' ↗');
    link.href = '/yield-reports/';
    foot.appendChild(link);
    panel.appendChild(foot);

    disclosure.appendChild(panel);
    return disclosure;
  }

  function restorePanel(panel, owner) {
    if (!panel || !owner || !owner.isConnected) return;
    if (panel.parentNode !== owner) owner.appendChild(panel);
    panel.classList.remove('th-mr-portal-open');
  }

  function closeDisclosure(owner, instant = false) {
    if (!owner) return;
    const trigger = owner.querySelector('.th-mr-trigger');
    const panel = owner.querySelector('.th-monthly-report-panel') || document.querySelector('.th-monthly-report-panel.th-mr-portal-open');
    owner.classList.remove('open');
    trigger?.setAttribute('aria-expanded', 'false');
    const bg = document.querySelector('.th-mr-backdrop');
    if (panel?.classList.contains('th-mr-portal-open')) {
      panel.classList.remove('th-mr-portal-open');
      bg?.classList.remove('open');
      document.body.classList.remove('th-mr-overlay-open');
      const finish = () => restorePanel(panel, owner);
      if (instant || window.matchMedia('(prefers-reduced-motion: reduce)').matches) finish();
      else window.setTimeout(finish, 240);
    }
  }

  function openDisclosure(owner) {
    const trigger = owner.querySelector('.th-mr-trigger');
    const panel = owner.querySelector('.th-monthly-report-panel');
    if (!trigger || !panel) return;
    const rewards = owner.closest('.th-defitea-financial-stack')?.querySelector('.ipx-defitea-rewards');
    if (typeof rewards?.__ipxCloseRewardPanel === 'function') rewards.__ipxCloseRewardPanel(false);

    owner.classList.add('open');
    trigger.setAttribute('aria-expanded', 'true');
    const mobile = window.matchMedia('(max-width: 760.98px)').matches;
    if (!mobile) return;

    panel.__thOwner = owner;
    const bg = ensureBackdrop();
    panel.classList.remove('th-mr-portal-open');
    document.body.appendChild(panel);
    document.body.classList.add('th-mr-overlay-open');
    bg.onclick = ev => { ev.preventDefault(); closeDisclosure(owner, false); };
    requestAnimationFrame(() => requestAnimationFrame(() => {
      bg.classList.add('open');
      panel.classList.add('th-mr-portal-open');
    }));
  }

  function bind(disclosure) {
    if (disclosure.dataset.bound === 'true') return;
    disclosure.dataset.bound = 'true';
    const trigger = disclosure.querySelector('.th-mr-trigger');
    const close = disclosure.querySelector('.th-mr-close');
    trigger?.addEventListener('click', ev => {
      ev.preventDefault();
      ev.stopPropagation();
      if (disclosure.classList.contains('open')) closeDisclosure(disclosure, false);
      else openDisclosure(disclosure);
    });
    close?.addEventListener('click', ev => {
      ev.preventDefault();
      ev.stopPropagation();
      closeDisclosure(disclosure, false);
    });
  }

  function fingerprint(state) {
    const { month, monthKey, summary } = state;
    return JSON.stringify([lang(), monthKey, month.cashFlowUsd, month.monthlyYieldPct, month.annualizedAprPct, month.averageTvlUsd, month.sampleDays, month.expectedDays, month.status, summary?.ytdCashFlowUsd, summary?.annualizedCashFlowAprPct, summary?.closedMonths, summary?.annualizedCashFlowAprMonths]);
  }

  function render() {
    const state = currentState();
    if (!state) return false;
    ensureStyle();

    const orphan = document.querySelector('.th-monthly-report-panel.th-mr-portal-open');
    if (orphan?.__thOwner && !orphan.__thOwner.isConnected) {
      orphan.classList.remove('th-mr-portal-open');
      document.querySelector('.th-mr-backdrop')?.classList.remove('open');
      document.body.classList.remove('th-mr-overlay-open');
      orphan.remove();
    }

    const item = document.querySelector('.ib-item[data-nm="defitea.eth"]');
    const ledger = item?.querySelector('.ipx-defitea-live-ledger');
    const rewards = ledger?.querySelector('.ipx-defitea-rewards');
    if (!item || !ledger || !rewards) return false;

    let stack = ledger.querySelector(':scope > .th-defitea-financial-stack');
    if (!stack) {
      stack = node('div', 'th-defitea-financial-stack');
      rewards.parentNode.insertBefore(stack, rewards);
      stack.appendChild(rewards);
    } else if (rewards.parentNode !== stack) {
      stack.insertBefore(rewards, stack.firstChild);
    }

    const fp = fingerprint(state);
    let disclosure = stack.querySelector(':scope > .th-monthly-report-disclosure');
    if (disclosure?.dataset.fingerprint === fp) {
      bind(disclosure);
      return true;
    }
    if (disclosure) closeDisclosure(disclosure, true);
    const next = buildDisclosure(state);
    next.dataset.fingerprint = fp;
    if (disclosure?.parentNode) disclosure.replaceWith(next); else stack.appendChild(next);
    bind(next);
    return true;
  }

  function queueRender() {
    if (renderQueued) return;
    renderQueued = true;
    requestAnimationFrame(() => {
      renderQueued = false;
      render();
    });
  }

  function bindGlobalClose() {
    if (window.__TH_MONTHLY_REPORT_GLOBAL_CLOSE__) return;
    window.__TH_MONTHLY_REPORT_GLOBAL_CLOSE__ = true;
    document.addEventListener('pointerdown', ev => {
      if (window.matchMedia('(max-width: 760.98px)').matches) return;
      const owner = document.querySelector('.th-monthly-report-disclosure.open');
      if (owner && !owner.contains(ev.target)) closeDisclosure(owner, false);
    });
    document.addEventListener('keydown', ev => {
      if (ev.key !== 'Escape') return;
      const owner = document.querySelector('.th-monthly-report-disclosure.open')
        || document.querySelector('.th-monthly-report-panel.th-mr-portal-open')?.__thOwner;
      if (owner) closeDisclosure(owner, false);
    });
  }

  async function start() {
    try {
      await load();
      render();
      bindGlobalClose();
      const observer = new MutationObserver(queueRender);
      observer.observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ['lang', 'class'] });
      window.__TH_MONTHLY_REPORT_ADAPTER__ = { version: '0.1.0-defitea-monthly-report', render };
    } catch (err) {
      console.warn('[Monthly Report]', err && err.message ? err.message : err);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
