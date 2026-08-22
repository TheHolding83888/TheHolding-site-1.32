/* The Holding · Company Monthly Reports adapter · v0.2.0
 * Presentation only. Reads canonical /reporting/reporting-data.json.
 * Initial scope: defitea.eth. Historical months are rendered from the existing
 * Reporting archive; no accounting, TVL, Rewards methodology or execution authority changes.
 */
(() => {
  'use strict';
  if (window.__TH_MONTHLY_REPORT_ADAPTER__) return;

  const URL = '/reporting/reporting-data.json';
  const COMPANY = 'defitea.eth';
  let snapshot = null;
  let loading = null;
  let renderQueued = false;
  let selectedMonthKey = null;

  const lang = () => (document.documentElement.lang || 'en').toLowerCase().startsWith('ru') ? 'ru' : 'en';
  const finite = v => v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v));
  const money = (v, digits = 2) => finite(v)
    ? '$' + Number(v).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })
    : '—';
  const money0 = v => finite(v) ? '$' + Math.round(Number(v)).toLocaleString('en-US') : '—';
  const pct = v => finite(v) ? Number(v).toFixed(2) + '%' : '—';
  const generatedUsd = month => finite(month?.cashFlowUsd) ? month.cashFlowUsd : month?.generatedIncomeUsd;
  const node = (tag, className, text) => {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined && text !== null) el.textContent = String(text);
    return el;
  };

  const C = () => lang() === 'ru' ? {
    trigger: 'Ежемесячные отчёты', generated: 'Доход', monthYield: 'Доходность месяца',
    avgTvl: 'Средний TVL', reports: 'Отчёты фонда', live: 'Live', full: 'Полный отчёт',
    close: 'Закрыть отчёты фонда'
  } : {
    trigger: 'Monthly Reports', generated: 'Generated', monthYield: 'Month Yield',
    avgTvl: 'Average TVL', reports: 'Fund Reports', live: 'Live', full: 'Full Report',
    close: 'Close fund reports'
  };

  function svgIcon(kind, className) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 16 16');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    if (className) svg.setAttribute('class', className);
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', 'currentColor');
    path.setAttribute('stroke-width', '1.35');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
    path.setAttribute('d', kind === 'external' ? 'M6 4h6v6M12 4 4 12' : 'm4.25 6 3.75 3.75L11.75 6');
    svg.appendChild(path);
    return svg;
  }

  function monthParts(key) {
    const [year, month] = String(key || '').split('-').map(Number);
    return { year, month };
  }

  function monthLabel(key) {
    const { year, month } = monthParts(key);
    if (!year || !month) return key || '—';
    return new Intl.DateTimeFormat(lang() === 'ru' ? 'ru-RU' : 'en-US', { month: 'long', year: 'numeric' })
      .format(new Date(Date.UTC(year, month - 1, 1)));
  }

  function monthShort(key, includeYear = false) {
    const { year, month } = monthParts(key);
    if (!year || !month) return key || '—';
    const base = new Intl.DateTimeFormat(lang() === 'ru' ? 'ru-RU' : 'en-US', { month: 'short' })
      .format(new Date(Date.UTC(year, month - 1, 1)))
      .replace('.', '');
    return includeYear ? `${base} ’${String(year).slice(-2)}` : base;
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
    if (!fund?.months) return null;
    const keys = Object.keys(fund.months).filter(key => fund.months[key]).sort();
    if (!keys.length) return null;
    const currentKey = keys[keys.length - 1];
    if (!selectedMonthKey || !fund.months[selectedMonthKey]) selectedMonthKey = currentKey;
    return { fund, keys, currentKey };
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
      .th-mr-meta{grid-area:meta;justify-self:end;display:inline-flex;align-items:center;gap:.36rem;color:var(--text-2);font-size:.53rem;font-weight:650;white-space:nowrap}
      .th-mr-chevron{width:.82rem;height:.82rem;color:var(--gold);transition:transform .22s ease;flex:0 0 auto}
      .th-monthly-report-disclosure.open .th-mr-chevron{transform:rotate(180deg)}
      .th-mr-trigger:hover,.th-mr-trigger:focus-visible{background:rgba(168,132,44,.025)}
      .th-mr-trigger:focus-visible{outline:1px solid rgba(168,132,44,.34);outline-offset:2px}

      .th-monthly-report-panel{position:absolute;right:0;top:calc(100% + 9px);width:min(438px,calc(100vw - 30px));max-height:min(72vh,540px);overflow:auto;overscroll-behavior:contain;z-index:48;padding:.86rem;border:1px solid rgba(15,23,42,.085);border-radius:20px;background:radial-gradient(circle at 92% 0,rgba(255,255,255,1),rgba(255,255,255,0) 36%),rgba(252,252,249,.995);box-shadow:0 34px 74px -28px rgba(15,23,42,.34),0 10px 24px -18px rgba(15,23,42,.18);opacity:0;visibility:hidden;pointer-events:none;transform:translateY(-5px) scale(.985);transition:opacity .24s ease,visibility .24s ease,transform .26s cubic-bezier(.16,1,.3,1)}
      .th-monthly-report-disclosure.open>.th-monthly-report-panel{opacity:1;visibility:visible;pointer-events:auto;transform:translateY(0) scale(1)}
      .th-mr-head{display:flex;align-items:flex-start;justify-content:space-between;gap:1rem;padding:.16rem .14rem .68rem}
      .th-mr-head-copy{min-width:0}
      .th-mr-panel-kicker{color:var(--text-3);font-size:.49rem;font-weight:700;letter-spacing:.15em;text-transform:uppercase}
      .th-mr-title{margin-top:.22rem;font-family:'Cormorant Garamond',serif;font-size:1.48rem;font-weight:600;line-height:1;letter-spacing:-.02em;color:var(--text);text-transform:capitalize}
      .th-mr-close{flex:0 0 auto;width:30px;height:30px;display:inline-flex;align-items:center;justify-content:center;border:1px solid rgba(15,23,42,.07);border-radius:50%;background:rgba(255,255,255,.8);color:var(--text-3);font:400 1rem/1 'Space Grotesk',sans-serif;cursor:pointer}
      .th-mr-close:hover,.th-mr-close:focus-visible{color:var(--text);background:#fff}
      .th-mr-close:focus-visible{outline:1px solid rgba(168,132,44,.28);outline-offset:2px}

      .th-mr-months{display:flex;gap:.34rem;min-width:0;padding:.08rem .02rem .68rem;overflow-x:auto;overscroll-behavior-x:contain;scrollbar-width:none;-webkit-overflow-scrolling:touch;border-bottom:1px solid var(--line)}
      .th-mr-months::-webkit-scrollbar{display:none}
      .th-mr-month{appearance:none;-webkit-appearance:none;flex:0 0 auto;min-width:40px;border:1px solid rgba(15,23,42,.065);border-radius:999px;background:rgba(255,255,255,.66);padding:.28rem .48rem;color:var(--text-3);font:650 .51rem/1 'Space Grotesk',sans-serif;letter-spacing:.02em;text-align:center;cursor:pointer;transition:border-color .18s ease,background .18s ease,color .18s ease,box-shadow .18s ease}
      .th-mr-month:hover,.th-mr-month:focus-visible{color:var(--text);border-color:rgba(168,132,44,.22)}
      .th-mr-month:focus-visible{outline:1px solid rgba(168,132,44,.28);outline-offset:2px}
      .th-mr-month.active{color:var(--gold);border-color:rgba(168,132,44,.22);background:rgba(168,132,44,.055);box-shadow:inset 0 1px 0 rgba(255,255,255,.9)}

      .th-mr-core{display:grid;grid-template-columns:1.12fr .88fr;gap:.5rem;padding:.82rem 0 .5rem}
      .th-mr-core-card{min-width:0;padding:.78rem .74rem .72rem;border:1px solid rgba(15,23,42,.06);border-radius:14px;background:rgba(255,255,255,.69)}
      .th-mr-core-label{color:var(--text-3);font-size:.48rem;font-weight:700;letter-spacing:.095em;text-transform:uppercase;line-height:1.2}
      .th-mr-core-value{margin-top:.34rem;font-family:'Cormorant Garamond',serif;font-size:clamp(1.54rem,4.2vw,2.08rem);font-weight:600;line-height:.94;letter-spacing:-.028em;color:var(--text);font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .th-mr-core-card:first-child .th-mr-core-value{color:var(--gold)}
      .th-mr-context{display:flex;align-items:center;justify-content:space-between;gap:1rem;min-width:0;padding:.63rem .18rem .7rem;border-bottom:1px solid var(--line)}
      .th-mr-context-label{min-width:0;color:var(--text-3);font-size:.51rem;font-weight:650;letter-spacing:.045em;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .th-mr-context-value{flex:0 0 auto;color:var(--text-2);font-size:.69rem;font-weight:650;font-variant-numeric:tabular-nums;white-space:nowrap}
      .th-mr-status{display:inline-flex;align-items:center;margin-left:.42rem;padding:.13rem .34rem;border:1px solid rgba(10,124,78,.11);border-radius:999px;background:rgba(10,124,78,.045);color:var(--green);font-family:'Space Grotesk',sans-serif;font-size:.43rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;vertical-align:middle;white-space:nowrap}
      .th-mr-foot{display:flex;align-items:center;justify-content:flex-end;padding:.68rem .12rem .04rem}
      .th-mr-link{display:inline-flex;align-items:center;gap:.28rem;color:var(--green);font-size:.55rem;font-weight:700;text-decoration:none;white-space:nowrap}
      .th-mr-link svg{width:.76rem;height:.76rem;transition:transform .18s ease}
      .th-mr-link:hover,.th-mr-link:focus-visible{text-decoration:underline;text-underline-offset:3px}
      .th-mr-link:hover svg,.th-mr-link:focus-visible svg{transform:translate(1px,-1px)}

      .th-mr-backdrop{position:fixed;inset:0;z-index:2230;background:rgba(15,23,42,.14);backdrop-filter:blur(2px);-webkit-backdrop-filter:blur(2px);opacity:0;visibility:hidden;pointer-events:none;transition:opacity .22s ease,visibility .22s ease}
      .th-mr-backdrop.open{opacity:1;visibility:visible;pointer-events:auto}
      @media(max-width:760.98px){
        .th-defitea-financial-stack{gap:.42rem}
        .th-mr-trigger{padding:.58rem .64rem .56rem;column-gap:.5rem}
        .th-mr-kicker{font-size:.49rem;letter-spacing:.12em}
        .th-mr-value{font-size:1.22rem}
        .th-mr-value-label,.th-mr-meta{font-size:.49rem}
        .th-monthly-report-panel{position:fixed;left:14px;right:14px;top:50%;bottom:auto;width:auto;max-height:min(76vh,560px);z-index:2240;transform:translateY(-50%) scale(.975);padding:.74rem;border-radius:20px;opacity:0;visibility:hidden;pointer-events:none}
        .th-monthly-report-disclosure.open>.th-monthly-report-panel{opacity:0;visibility:hidden;pointer-events:none;transform:translateY(-50%) scale(.975)}
        .th-monthly-report-panel.th-mr-portal-open{opacity:1;visibility:visible;pointer-events:auto;transform:translateY(-50%) scale(1)}
        .th-mr-head{padding:.12rem .08rem .62rem}
        .th-mr-title{font-size:1.38rem}
        .th-mr-months{margin:0 -.08rem;padding-left:.08rem;padding-right:.08rem}
        .th-mr-core{gap:.42rem;padding-top:.72rem}
        .th-mr-core-card{padding:.68rem .62rem .64rem}
        .th-mr-core-label{font-size:.45rem}
        .th-mr-core-value{font-size:clamp(1.42rem,7vw,1.92rem)}
        .th-mr-context{padding:.58rem .12rem .64rem}
        .th-mr-context-label{font-size:.47rem}
        .th-mr-context-value{font-size:.64rem}
        .th-mr-link{font-size:.52rem}
        body.th-mr-overlay-open{overflow:hidden}
      }
      @media(max-width:360px){
        .th-mr-trigger{grid-template-columns:minmax(0,1fr) auto;column-gap:.34rem}
        .th-mr-kicker{font-size:.45rem}
        .th-mr-badge{font-size:.42rem;padding:.11rem .29rem}
        .th-mr-value{font-size:1.14rem}
        .th-mr-meta{font-size:.46rem}
        .th-monthly-report-panel{left:10px;right:10px;padding:.66rem}
        .th-mr-core{grid-template-columns:1fr 1fr;gap:.34rem}
        .th-mr-core-card{padding:.62rem .54rem .58rem}
        .th-mr-core-value{font-size:1.42rem}
      }
      @media(prefers-reduced-motion:reduce){.th-monthly-report-panel,.th-mr-chevron,.th-mr-backdrop,.th-mr-link svg{transition:none!important}}
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

  function coreMetric(label, value) {
    const card = node('div', 'th-mr-core-card');
    card.appendChild(node('div', 'th-mr-core-label', label));
    card.appendChild(node('div', 'th-mr-core-value', value));
    return card;
  }

  function applyMonth(disclosure, fund, key, focusMonth = false) {
    const month = fund?.months?.[key];
    if (!month) return;
    selectedMonthKey = key;
    const copy = C();
    const panel = disclosure.querySelector('.th-monthly-report-panel') || document.querySelector('.th-monthly-report-panel.th-mr-portal-open');
    if (!panel) return;

    const title = panel.querySelector('.th-mr-title');
    if (title) {
      title.textContent = monthLabel(key);
      if (month.status === 'provisional') title.appendChild(node('span', 'th-mr-status', copy.live));
    }
    const generated = panel.querySelector('[data-th-mr-generated]');
    const yieldEl = panel.querySelector('[data-th-mr-yield]');
    const tvl = panel.querySelector('[data-th-mr-tvl]');
    if (generated) generated.textContent = money(generatedUsd(month));
    if (yieldEl) yieldEl.textContent = pct(month.monthlyYieldPct);
    if (tvl) tvl.textContent = money0(month.averageTvlUsd);

    panel.querySelectorAll('.th-mr-month').forEach(btn => {
      const active = btn.dataset.month === key;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
      if (active) btn.setAttribute('aria-current', 'date'); else btn.removeAttribute('aria-current');
    });
    panel.setAttribute('aria-label', `${copy.reports} · ${monthLabel(key)}`);

    const active = panel.querySelector(`.th-mr-month[data-month="${CSS.escape(key)}"]`);
    if (active) active.scrollIntoView({ behavior: focusMonth ? 'smooth' : 'auto', block: 'nearest', inline: 'nearest' });
  }

  function buildDisclosure(state) {
    const copy = C();
    const { fund, keys, currentKey } = state;
    const current = fund.months[currentKey];
    const disclosure = node('div', 'th-monthly-report-disclosure');
    disclosure.dataset.monthlyReport = COMPANY;

    const trigger = node('button', 'th-mr-trigger');
    trigger.type = 'button';
    trigger.setAttribute('aria-expanded', 'false');
    trigger.appendChild(node('div', 'th-mr-kicker', copy.trigger));
    trigger.appendChild(node('span', 'th-mr-badge', `${monthShort(currentKey)} · ${copy.live}`));
    const valueWrap = node('div', 'th-mr-value-wrap');
    valueWrap.appendChild(node('span', 'th-mr-value', money(generatedUsd(current))));
    valueWrap.appendChild(node('span', 'th-mr-value-label', lang() === 'ru' ? 'за месяц' : 'this month'));
    trigger.appendChild(valueWrap);
    const meta = node('div', 'th-mr-meta');
    meta.appendChild(node('span', '', pct(current.monthlyYieldPct)));
    meta.appendChild(svgIcon('chevron', 'th-mr-chevron'));
    trigger.appendChild(meta);
    disclosure.appendChild(trigger);

    const panel = node('div', 'th-monthly-report-panel');
    panel.setAttribute('role', 'dialog');
    panel.__thOwner = disclosure;

    const head = node('div', 'th-mr-head');
    const headCopy = node('div', 'th-mr-head-copy');
    headCopy.appendChild(node('div', 'th-mr-panel-kicker', copy.reports));
    headCopy.appendChild(node('div', 'th-mr-title'));
    head.appendChild(headCopy);
    const close = node('button', 'th-mr-close', '×');
    close.type = 'button';
    close.setAttribute('aria-label', copy.close);
    head.appendChild(close);
    panel.appendChild(head);

    const years = new Set(keys.map(key => monthParts(key).year));
    const months = node('div', 'th-mr-months');
    months.setAttribute('role', 'group');
    months.setAttribute('aria-label', copy.trigger);
    keys.forEach(key => {
      const btn = node('button', 'th-mr-month', monthShort(key, years.size > 1));
      btn.type = 'button';
      btn.dataset.month = key;
      btn.setAttribute('aria-label', monthLabel(key));
      btn.setAttribute('aria-pressed', 'false');
      months.appendChild(btn);
    });
    panel.appendChild(months);

    const core = node('div', 'th-mr-core');
    const generatedCard = coreMetric(copy.generated, '—');
    generatedCard.querySelector('.th-mr-core-value').dataset.thMrGenerated = 'true';
    const yieldCard = coreMetric(copy.monthYield, '—');
    yieldCard.querySelector('.th-mr-core-value').dataset.thMrYield = 'true';
    core.appendChild(generatedCard);
    core.appendChild(yieldCard);
    panel.appendChild(core);

    const context = node('div', 'th-mr-context');
    context.appendChild(node('div', 'th-mr-context-label', copy.avgTvl));
    const contextValue = node('div', 'th-mr-context-value', '—');
    contextValue.dataset.thMrTvl = 'true';
    context.appendChild(contextValue);
    panel.appendChild(context);

    const foot = node('div', 'th-mr-foot');
    const link = node('a', 'th-mr-link');
    link.href = '/yield-reports/';
    link.appendChild(node('span', '', copy.full));
    link.appendChild(svgIcon('external'));
    foot.appendChild(link);
    panel.appendChild(foot);

    disclosure.appendChild(panel);
    applyMonth(disclosure, fund, selectedMonthKey || currentKey, false);
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

  function bind(disclosure, fund) {
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
    disclosure.querySelectorAll('.th-mr-month').forEach(btn => {
      btn.addEventListener('click', ev => {
        ev.preventDefault();
        ev.stopPropagation();
        applyMonth(disclosure, fund, btn.dataset.month, true);
      });
    });
  }

  function fingerprint(state) {
    const { fund, keys, currentKey } = state;
    return JSON.stringify([
      lang(), currentKey,
      ...keys.map(key => {
        const m = fund.months[key];
        return [key, generatedUsd(m), m.monthlyYieldPct, m.averageTvlUsd, m.status];
      })
    ]);
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
      bind(disclosure, state.fund);
      return true;
    }
    if (disclosure) closeDisclosure(disclosure, true);
    const next = buildDisclosure(state);
    next.dataset.fingerprint = fp;
    if (disclosure?.parentNode) disclosure.replaceWith(next); else stack.appendChild(next);
    bind(next, state.fund);
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
      window.__TH_MONTHLY_REPORT_ADAPTER__ = { version: '0.2.0-defitea-monthly-archive', render };
    } catch (err) {
      console.warn('[Monthly Reports]', err && err.message ? err.message : err);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();