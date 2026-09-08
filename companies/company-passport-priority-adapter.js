/* The Holding · Company Passport priority adapter · v0.7.1
 * Presentation only.
 *
 * Confirmed remains the factual accounting lane. Estimated remains a separate,
 * non-additive backend reference lane. Accounting Coverage is diagnostic only.
 * This adapter only translates canonical machine state into compact owner-facing
 * language; it never creates income, changes ownership, or closes accounting.
 */
(() => {
  'use strict';
  if (window.__TH_COMPANY_PASSPORT_PRIORITY_ADAPTER__) return;

  const REPORT_URL = '/reporting/company-monthly-reports.json';
  const COVERAGE_URL = '/reporting/accounting-coverage.json';
  const INCOME_VIEW_VERSION = '0.1-confirmed-estimated-non-additive';
  const SNAPSHOT_TTL_MS = 5 * 60 * 1000;
  let queued = false;
  let monthlySnapshot = null;
  let monthlyLoading = null;
  let monthlyLoadedAt = 0;
  let coverageSnapshot = null;
  let coverageLoading = null;
  let coverageLoadedAt = 0;

  const lang = () => (document.documentElement.lang || 'en').toLowerCase().startsWith('ru') ? 'ru' : 'en';
  const finite = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
  const money = value => finite(value)
    ? '$' + Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '—';
  const pct = value => finite(value) ? Number(value).toFixed(2) + '%' : '—';
  const stale = loadedAt => !loadedAt || Date.now() - loadedAt >= SNAPSHOT_TTL_MS;

  const TOKEN_CASE = Object.freeze({
    aero: 'AERO', veaero: 'veAERO', velo: 'VELO', vevelo: 'veVELO',
    crv: 'CRV', vecrv: 'veCRV', cvx: 'CVX', vlcvx: 'vlCVX', cvxcrv: 'cvxCRV',
    fxn: 'FXN', vefxn: 'veFXN', frax: 'FRAX', vefrax: 'veFRAX',
    yb: 'YB', veyb: 'veYB', pendle: 'PENDLE', spendle: 'sPENDLE',
    lqty: 'LQTY', rsup: 'RSUP', icp: 'ICP', gmx: 'GMX', nft: 'NFT'
  });

  function setText(el, text) {
    if (el && el.textContent !== text) el.textContent = text;
  }

  function promoteApr() {
    let moved = 0;
    document.querySelectorAll('.ib-item[data-nm] .ipx-apr-field').forEach(apr => {
      const grid = apr.parentElement;
      if (!grid || !grid.classList.contains('ipx-grid')) return;
      if (grid.firstElementChild !== apr) {
        grid.insertBefore(apr, grid.firstElementChild);
        moved += 1;
      }
      apr.dataset.thPassportPriority = 'primary-rate';
    });
    return moved;
  }

  function loadMonthlySnapshot({ force = false } = {}) {
    if (!force && monthlySnapshot && !stale(monthlyLoadedAt)) return Promise.resolve(monthlySnapshot);
    if (monthlyLoading) return monthlyLoading;
    monthlyLoading = fetch(REPORT_URL + '?t=' + Date.now(), { cache: 'no-store' })
      .then(response => {
        if (!response.ok) throw new Error('Company Monthly Reports HTTP ' + response.status);
        return response.json();
      })
      .then(data => {
        monthlySnapshot = data;
        monthlyLoadedAt = Date.now();
        return data;
      })
      .finally(() => { monthlyLoading = null; });
    return monthlyLoading;
  }

  function loadCoverageSnapshot({ force = false } = {}) {
    if (!force && coverageSnapshot && !stale(coverageLoadedAt)) return Promise.resolve(coverageSnapshot);
    if (coverageLoading) return coverageLoading;
    coverageLoading = fetch(COVERAGE_URL + '?t=' + Date.now(), { cache: 'no-store' })
      .then(response => {
        if (!response.ok) throw new Error('Accounting Coverage HTTP ' + response.status);
        return response.json();
      })
      .then(data => {
        if (data?.status !== 'diagnostic-no-completion-authority') throw new Error('Accounting Coverage authority contract invalid');
        if (data?.authority?.monthClosingAuthority !== false || data?.authority?.executionAuthority !== 'none') {
          throw new Error('Accounting Coverage authority expanded');
        }
        coverageSnapshot = data;
        coverageLoadedAt = Date.now();
        return data;
      })
      .catch(err => {
        coverageSnapshot = null;
        coverageLoadedAt = 0;
        console.warn('[Company Passport accounting transparency]', err?.message || err);
        return null;
      })
      .finally(() => { coverageLoading = null; });
    return coverageLoading;
  }

  function refreshSnapshots({ force = false } = {}) {
    return Promise.all([loadMonthlySnapshot({ force }), loadCoverageSnapshot({ force })]).then(() => {
      patchMonthlyReports();
      return { monthlySnapshot, coverageSnapshot };
    });
  }

  function orderedMonths(company) {
    return Object.keys(company?.months || {}).filter(key => company.months[key]).sort();
  }

  function validIncomeView(month) {
    const view = month?.incomeView;
    if (view?.version !== INCOME_VIEW_VERSION) return null;
    if (view?.unknownIsNotZero !== true || view?.executionAuthority !== 'none') return null;
    if (view?.relationship?.additive !== false || view?.relationship?.confirmedPlusEstimatedIsValidTotal !== false) return null;
    if (view?.relationship?.estimatedMayOverlapConfirmedEconomics !== true || view?.relationship?.estimatedIsAlternativeAnalyticView !== true) return null;
    if (view?.scope) {
      if (view.scope.canonicalOwnershipPreserved !== true || view.scope.crossCompanyReattributionAllowed !== false) return null;
      if (view.scope.holdingWideAggregationMustUseCanonicalOwners !== true || view.scope.executionAuthority !== 'none') return null;
    }
    return view;
  }

  function displayIncome(month) {
    if (!month) return { usd: null, observedOnly: false };
    const view = validIncomeView(month);
    if (view?.confirmed) {
      const confirmed = view.confirmed;
      if (confirmed.factualRecognizedAmount === true && finite(confirmed.usd)) {
        return { usd: Number(confirmed.usd), observedOnly: confirmed.fullPeriodComplete !== true };
      }
      return { usd: null, observedOnly: false };
    }
    if (finite(month.generatedIncomeUsd)) return { usd: Number(month.generatedIncomeUsd), observedOnly: false };
    const observed = month.accountingStatus === 'partial-observed' && Number(month.accountingEvidenceCount || 0) > 0;
    return observed && finite(month.observedEarnedIncomeUsd)
      ? { usd: Number(month.observedEarnedIncomeUsd), observedOnly: true }
      : { usd: null, observedOnly: false };
  }

  function displayYield(month) {
    if (!month) return { value: null, observedOnly: false };
    const view = validIncomeView(month);
    if (view?.confirmed) {
      const confirmed = view.confirmed;
      if (confirmed.factualRecognizedAmount === true && finite(confirmed.yieldPct)) {
        return { value: Number(confirmed.yieldPct), observedOnly: confirmed.fullPeriodComplete !== true };
      }
      return { value: null, observedOnly: false };
    }
    if (finite(month.monthlyYieldPct)) return { value: Number(month.monthlyYieldPct), observedOnly: false };
    const observed = month.accountingStatus === 'partial-observed' && Number(month.accountingEvidenceCount || 0) > 0;
    return observed && finite(month.observedPeriodYieldPct)
      ? { value: Number(month.observedPeriodYieldPct), observedOnly: true }
      : { value: null, observedOnly: false };
  }

  function displayEstimate(month) {
    const estimated = validIncomeView(month)?.estimated;
    if (!estimated || estimated.available !== true) return { available: false, usd: null, yieldPct: null, associatedCompanies: [] };
    if (estimated.basis !== 'existing-reference-model') return { available: false, usd: null, yieldPct: null, associatedCompanies: [] };
    if (estimated.earnedIncomeAuthority !== false || estimated.factualIncomeAuthority !== false) return { available: false, usd: null, yieldPct: null, associatedCompanies: [] };
    if (estimated.canCloseAccountingCoverage !== false || estimated.canReplaceUnknown !== false) return { available: false, usd: null, yieldPct: null, associatedCompanies: [] };
    if (!finite(estimated.usd)) return { available: false, usd: null, yieldPct: null, associatedCompanies: [] };
    return {
      available: true,
      usd: Number(estimated.usd),
      yieldPct: finite(estimated.yieldPct) ? Number(estimated.yieldPct) : null,
      associatedCompanies: Array.isArray(estimated.associatedCompaniesIncluded) ? estimated.associatedCompaniesIncluded.filter(Boolean) : []
    };
  }

  function formatPeriod(month) {
    if (!month?.periodStart && !month?.periodEnd) return '—';
    const locale = lang() === 'ru' ? 'ru-RU' : 'en-US';
    const fmt = value => {
      if (!value) return '—';
      const t = Date.parse(value);
      if (!Number.isFinite(t)) return String(value);
      return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
        .format(new Date(t)).replace('.', '');
    };
    if (month.periodStart && month.periodEnd && month.periodStart === month.periodEnd) return fmt(month.periodStart);
    return `${fmt(month.periodStart)} – ${fmt(month.periodEnd)}`;
  }

  function copy() {
    return lang() === 'ru' ? {
      confirmed: 'Подтверждённый доход', confirmedShort: 'подтверждено', confirmedYield: 'Подтверждённая доходность',
      estimated: 'Оценка по модели', estimatedNote: 'Оценка по APR за тот же период — ориентир, а не подтверждённый доход.',
      period: 'Период наблюдения',
      trackingSummary: (tracking, total, events) => `Трекинг ${tracking}/${total} · События ${events}/${total}`,
      partial: 'В сумму входит только подтверждённый доход. Всё, что ещё не подтверждено, остаётся за её пределами.',
      awaiting: 'Трекинг работает. Подтверждённых событий дохода за этот период пока нет.',
      trackingNoEvent: label => `${label} — трекинг работает; события дохода за этот период пока нет.`,
      stateOnly: label => `${label} — пока не включено: позиция видна, но трекинг дохода ещё не подтверждён.`,
      referenceOnly: label => `${label} — пока не включено: трекинг фактического дохода ещё не подтверждён.`,
      boundary: label => `${label} — часть периода пока не включена: нужно подтвердить границу периода.`,
      unclassified: label => `${label} — пока не включено: канал дохода ещё не классифицирован.`,
      unresolved: (label, count) => count > 1
        ? `${label} — ${count} события пока не включены: нужно дополнительное подтверждение.`
        : `${label} — пока не включено: нужно дополнительное подтверждение.`,
      unresolvedGeneric: 'Часть дохода пока не включена: нужно дополнительное подтверждение.',
      more: count => `Ещё ${count} ${count === 1 ? 'пункт требует' : count < 5 ? 'пункта требуют' : 'пунктов требуют'} внимания.`
    } : {
      confirmed: 'Confirmed income', confirmedShort: 'confirmed', confirmedYield: 'Confirmed yield',
      estimated: 'Estimated', estimatedNote: 'APR-based estimate for the same period — a reference, not confirmed income.',
      period: 'Observation period',
      trackingSummary: (tracking, total, events) => `Tracking ${tracking}/${total} · Events ${events}/${total}`,
      partial: 'Only confirmed income is included. Anything not yet confirmed stays out.',
      awaiting: 'Tracking is active. No confirmed income event has appeared for this period yet.',
      trackingNoEvent: label => `${label} — tracking is active; no income event has appeared for this period yet.`,
      stateOnly: label => `${label} — not included yet: the position is visible, but income tracking is not confirmed.`,
      referenceOnly: label => `${label} — not included yet: factual income tracking is not confirmed.`,
      boundary: label => `${label} — part of this period is not included yet: the boundary still needs confirmation.`,
      unclassified: label => `${label} — not included yet: this income channel is not classified.`,
      unresolved: (label, count) => count > 1
        ? `${label} — ${count} events are not included yet: more confirmation is needed.`
        : `${label} — not included yet: one more confirmation is needed.`,
      unresolvedGeneric: 'Some income is not included yet because more confirmation is needed.',
      more: count => `${count} more ${count === 1 ? 'item requires' : 'items require'} attention.`
    };
  }

  function ensurePeriodRow(panel) {
    let row = panel.querySelector('.th-mr-observed-period');
    if (row) return row;
    const context = panel.querySelector('.th-mr-context');
    if (!context) return null;
    row = document.createElement('div');
    row.className = 'th-mr-context th-mr-observed-period';
    const label = document.createElement('div'); label.className = 'th-mr-context-label'; label.dataset.thObservedPeriodLabel = 'true';
    const value = document.createElement('div'); value.className = 'th-mr-context-value'; value.dataset.thObservedPeriodValue = 'true';
    row.append(label, value);
    context.insertAdjacentElement('afterend', row);
    return row;
  }

  function ensureEstimateRow(panel) {
    let row = panel.querySelector('.th-mr-estimated-view');
    if (!row) {
      row = document.createElement('div'); row.className = 'th-mr-estimated-view'; row.hidden = true;
      const head = document.createElement('div'); head.className = 'th-mr-estimated-head';
      const label = document.createElement('div'); label.className = 'th-mr-estimated-label'; label.dataset.thEstimatedLabel = 'true';
      const values = document.createElement('div'); values.className = 'th-mr-estimated-values';
      const amount = document.createElement('span'); amount.className = 'th-mr-estimated-amount'; amount.dataset.thEstimatedAmount = 'true';
      const yieldValue = document.createElement('span'); yieldValue.className = 'th-mr-estimated-yield'; yieldValue.dataset.thEstimatedYield = 'true';
      values.append(amount, yieldValue); head.append(label, values);
      const note = document.createElement('div'); note.className = 'th-mr-estimated-note'; note.dataset.thEstimatedNote = 'true';
      row.append(head, note);
    }
    const period = panel.querySelector('.th-mr-observed-period') || ensurePeriodRow(panel);
    if (period && row.previousElementSibling !== period) period.insertAdjacentElement('afterend', row);
    else if (!period && !row.isConnected) {
      const context = panel.querySelector('.th-mr-context');
      if (context) context.insertAdjacentElement('afterend', row); else panel.appendChild(row);
    }
    return row;
  }

  function ensureTrackingSummary(panel) {
    let row = panel.querySelector('.th-mr-tracking-summary');
    if (!row) { row = document.createElement('div'); row.className = 'th-mr-tracking-summary'; row.hidden = true; }
    const anchor = panel.querySelector('[data-th-mr-accounting-note]') || panel.querySelector('.th-mr-core');
    if (anchor && row.previousElementSibling !== anchor) anchor.insertAdjacentElement('afterend', row);
    else if (!anchor && !row.isConnected) panel.appendChild(row);
    return row;
  }

  function ensureTransparencyStyle() {
    if (document.getElementById('th-accounting-transparency-style')) return;
    const style = document.createElement('style');
    style.id = 'th-accounting-transparency-style';
    style.textContent = `
      .th-mr-estimated-view{display:grid;gap:.2rem;margin:.14rem .18rem .28rem;padding:.48rem .58rem;border:1px solid var(--line);border-radius:.65rem;background:color-mix(in srgb,var(--panel) 78%,transparent);min-width:0}
      .th-mr-estimated-view[hidden],.th-mr-tracking-summary[hidden],.th-mr-accounting-notices[hidden]{display:none}
      .th-mr-estimated-head{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:baseline;gap:.55rem;min-width:0}
      .th-mr-estimated-label{color:var(--text-2);font-size:.57rem;font-weight:650;letter-spacing:.015em;min-width:0}
      .th-mr-estimated-values{display:flex;align-items:baseline;justify-content:flex-end;gap:.45rem;font-variant-numeric:tabular-nums;white-space:nowrap;min-width:0}
      .th-mr-estimated-amount{color:var(--text-1);font-size:.7rem;font-weight:700}.th-mr-estimated-yield{color:var(--text-3);font-size:.55rem;font-weight:600}
      .th-mr-estimated-note{color:var(--text-3);font-size:.48rem;font-weight:520;line-height:1.42;text-transform:none;overflow-wrap:anywhere}
      .th-mr-tracking-summary{margin:.02rem .18rem .3rem;padding:.35rem .52rem;border-radius:.52rem;background:color-mix(in srgb,var(--panel) 62%,transparent);color:var(--text-2);font-size:.5rem;font-weight:650;letter-spacing:.01em;font-variant-numeric:tabular-nums}
      .th-mr-accounting-notices{display:grid;gap:.24rem;margin:.02rem .18rem .42rem;padding-top:.34rem;border-top:1px solid var(--line)}
      .th-mr-accounting-notice{position:relative;padding-left:.68rem;color:var(--text-3);font-size:.5rem;font-weight:550;line-height:1.42;letter-spacing:.005em;text-transform:none;overflow-wrap:anywhere}
      .th-mr-accounting-notice::before{content:'·';position:absolute;left:.08rem;top:-.01em;color:var(--gold);font-size:.72rem;line-height:1}
      @media(max-width:760.98px){.th-mr-estimated-view{margin-left:.12rem;margin-right:.12rem;padding:.45rem .5rem}.th-mr-estimated-head{gap:.38rem}.th-mr-estimated-label{font-size:.54rem}.th-mr-estimated-amount{font-size:.66rem}.th-mr-estimated-yield{font-size:.51rem}.th-mr-tracking-summary,.th-mr-accounting-notices{margin-left:.12rem;margin-right:.12rem}.th-mr-accounting-notice{font-size:.49rem}}
      @media(max-width:390px){.th-mr-estimated-head{grid-template-columns:1fr}.th-mr-estimated-values{justify-content:flex-start}}
    `;
    document.head.appendChild(style);
  }

  function ensureNoticeHost(panel) {
    let host = panel.querySelector('.th-mr-accounting-notices');
    if (!host) { host = document.createElement('div'); host.className = 'th-mr-accounting-notices'; host.hidden = true; }
    const tracking = panel.querySelector('.th-mr-tracking-summary') || ensureTrackingSummary(panel);
    const status = panel.querySelector('[data-th-mr-accounting-note]');
    const anchor = tracking || status;
    if (anchor && host.previousElementSibling !== anchor) anchor.insertAdjacentElement('afterend', host);
    else if (!anchor && !host.isConnected) panel.appendChild(host);
    return host;
  }

  function coverageCompany(name) {
    const companies = coverageSnapshot?.companies || {};
    if (companies[name]) return companies[name];
    return Object.values(companies).find(company => Array.isArray(company?.sourceAliases) && company.sourceAliases.includes(name)) || null;
  }

  function sameCoverageCompany(eventCompany, requestedName) {
    if (eventCompany === requestedName) return true;
    const company = coverageCompany(requestedName);
    return Boolean(company && (company.name === eventCompany || company.sourceAliases?.includes(eventCompany)));
  }

  function eventMonth(event) {
    const raw = event?.economicDate || event?.periodEnd || event?.periodStart;
    const t = Date.parse(raw || '');
    return Number.isFinite(t) ? new Date(t).toISOString().slice(0, 7) : null;
  }

  function canonicalWord(word) {
    const raw = String(word || '').trim();
    const key = raw.toLowerCase();
    return TOKEN_CASE[key] || (raw.length <= 3 ? raw.toUpperCase() : raw.charAt(0).toUpperCase() + raw.slice(1));
  }

  function readableId(value) {
    return String(value || '').split(/[_-]+/).filter(Boolean).map(canonicalWord).join(' ');
  }

  function normalizedWords(value) {
    return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/).filter(Boolean);
  }

  function incomeChannelLabel({ protocol, engineId, route, family } = {}) {
    const protocolLabel = String(protocol || '').trim();
    const protocolWords = new Set(normalizedWords(protocolLabel));
    const candidate = engineId || route || family || '';
    const detailWords = String(candidate).split(/[_-]+/).filter(Boolean).filter(word => !protocolWords.has(word.toLowerCase()));
    const detail = detailWords.map(canonicalWord).join(' ');
    if (protocolLabel && detail && !normalizedWords(protocolLabel).join(' ').includes(normalizedWords(detail).join(' '))) return `${protocolLabel} · ${detail}`;
    return protocolLabel || detail || readableId(candidate) || 'Strategy';
  }

  function mechanismLabel(mechanism) {
    return incomeChannelLabel({ protocol: mechanism?.protocol, engineId: mechanism?.engineId });
  }

  function unmatchedChannelKey(event) {
    return [event?.company, event?.protocol, event?.route, event?.family, event?.sourceFile].map(x => String(x || '').toLowerCase()).join('|');
  }

  function unmatchedChannelLabel(event) {
    return incomeChannelLabel({ protocol: event?.protocol, route: event?.route, family: event?.family });
  }

  function monthMechanismStates(companyName, selectedMonth) {
    const company = coverageCompany(companyName);
    return Object.values(company?.mechanisms || {}).map(mechanism => ({ mechanism, state: mechanism?.months?.[selectedMonth] })).filter(row => row.state);
  }

  function trackingSummary(companyName, selectedMonth) {
    const rows = monthMechanismStates(companyName, selectedMonth);
    if (!rows.length) return null;
    const total = rows.length;
    const tracking = rows.filter(({ state }) => state?.factualTrackingActive === true || ['factual-period-evidence', 'factual-tracking-no-period-event'].includes(state?.status)).length;
    const withEvents = rows.filter(({ state }) => Number(state?.factualEventCount || 0) > 0).length;
    return { total, tracking, withEvents };
  }

  function renderTrackingSummary(panel, companyName, selectedMonth) {
    ensureTransparencyStyle();
    const row = ensureTrackingSummary(panel);
    if (!row) return;
    const summary = trackingSummary(companyName, selectedMonth);
    if (!summary) { row.hidden = true; return; }
    setText(row, copy().trackingSummary(summary.tracking, summary.total, summary.withEvents));
    row.dataset.thTracking = `${summary.tracking}/${summary.total}`;
    row.dataset.thEventMechanisms = `${summary.withEvents}/${summary.total}`;
    row.hidden = false;
  }

  function removeLegacyScopeNote(panel) {
    panel.querySelectorAll('.th-mr-income-scope-note').forEach(row => row.remove());
  }

  function accountingNotices(companyName, selectedMonth, month, incomeView) {
    if (month?.accountingCoverageComplete === true) return [];
    const c = copy();
    const notices = [];

    for (const { mechanism, state } of monthMechanismStates(companyName, selectedMonth)) {
      const label = mechanismLabel(mechanism);
      const blockers = Array.isArray(state.completionBlockers) ? state.completionBlockers : [];
      if (mechanism?.classified !== true || blockers.includes('unclassified-income-mechanism')) {
        notices.push({ key: `unclassified:${mechanism.engineId}`, text: c.unclassified(label) });
        continue;
      }
      if (state.status === 'factual-tracking-no-period-event' || (state.factualTrackingActive === true && Number(state.factualEventCount || 0) === 0)) {
        notices.push({ key: `tracking-no-event:${mechanism.engineId}`, text: c.trackingNoEvent(label) });
      } else if (state.status === 'state-observed-not-factual-tracking') {
        notices.push({ key: `state:${mechanism.engineId}`, text: c.stateOnly(label) });
      } else if (state.status === 'reference-only-no-factual-tracking') {
        notices.push({ key: `reference:${mechanism.engineId}`, text: c.referenceOnly(label) });
      }
      if (Number(state.crossMonthEvidenceCount || 0) > 0 || blockers.includes('cross-month-boundary-requires-explicit-allocation')) {
        notices.push({ key: `boundary:${mechanism.engineId}`, text: c.boundary(label) });
      }
    }

    const unmatched = (coverageSnapshot?.unmatchedCanonicalEvents || []).filter(event => {
      const m = eventMonth(event);
      return sameCoverageCompany(event?.company, companyName) && (!m || m === selectedMonth);
    });
    const groupedUnmatched = new Map();
    for (const event of unmatched) {
      const key = unmatchedChannelKey(event);
      const group = groupedUnmatched.get(key) || { event, count: 0 };
      group.count += 1;
      groupedUnmatched.set(key, group);
    }
    for (const [key, group] of groupedUnmatched) {
      const label = unmatchedChannelLabel(group.event);
      notices.push({ key: `unmatched-channel:${key}`, text: label ? c.unresolved(label, group.count) : c.unresolvedGeneric });
    }

    const unresolvedReasons = month?.incomeAccounting?.lifecycle?.unresolvedReasons || [];
    if (unresolvedReasons.length && !unmatched.length) notices.push({ key: 'unresolved-ledger', text: c.unresolvedGeneric });

    const deduped = [...new Map(notices.map(item => [item.key, item])).values()];
    if (!deduped.length) {
      if (incomeView.observedOnly) return [{ key: 'partial-confirmed-only', text: c.partial }];
      return [{ key: 'awaiting-confirmed-evidence', text: c.awaiting }];
    }
    if (incomeView.observedOnly) deduped.unshift({ key: 'partial-confirmed-only', text: c.partial });
    const maxDetailed = 5;
    if (deduped.length <= maxDetailed) return deduped;
    const hidden = deduped.length - maxDetailed;
    return [...deduped.slice(0, maxDetailed), { key: `more:${hidden}`, text: c.more(hidden) }];
  }

  function renderAccountingNotices(panel, companyName, selectedMonth, month, incomeView) {
    ensureTransparencyStyle();
    const host = ensureNoticeHost(panel);
    const notices = accountingNotices(companyName, selectedMonth, month, incomeView);
    const fingerprint = JSON.stringify([lang(), coverageSnapshot?.generatedAt || null, selectedMonth, notices]);
    if (host.dataset.thNoticeFingerprint === fingerprint) return;
    host.dataset.thNoticeFingerprint = fingerprint;
    host.replaceChildren();
    notices.forEach(item => {
      const line = document.createElement('div'); line.className = 'th-mr-accounting-notice'; line.dataset.noticeKey = item.key; line.textContent = item.text; host.appendChild(line);
    });
    host.hidden = notices.length === 0;
  }

  function renderEstimate(panel, estimate) {
    ensureTransparencyStyle();
    const row = ensureEstimateRow(panel);
    const c = copy();
    if (!row) return;
    if (!estimate.available) { row.hidden = true; row.dataset.thEstimateAuthority = 'none'; return; }
    setText(row.querySelector('[data-th-estimated-label]'), c.estimated);
    setText(row.querySelector('[data-th-estimated-amount]'), money(estimate.usd));
    setText(row.querySelector('[data-th-estimated-yield]'), pct(estimate.yieldPct));
    setText(row.querySelector('[data-th-estimated-note]'), c.estimatedNote);
    row.hidden = false;
    row.dataset.thEstimateAuthority = 'reference-model-non-factual';
    row.dataset.thEstimateAdditive = 'false';
  }

  function patchDisclosure(disclosure, companyName, company) {
    const keys = orderedMonths(company);
    if (!keys.length) return;
    const currentKey = keys[keys.length - 1];
    const current = company.months[currentKey];
    const currentIncome = displayIncome(current);
    const currentYield = displayYield(current);
    const c = copy();
    setText(disclosure.querySelector('.th-mr-trigger .th-mr-value'), money(currentIncome.usd));
    setText(disclosure.querySelector('.th-mr-trigger .th-mr-value-label'), c.confirmedShort);
    setText(disclosure.querySelector('.th-mr-trigger .th-mr-meta span'), pct(currentYield.value));
    disclosure.dataset.thIncomeDisplay = currentIncome.observedOnly ? 'confirmed-partial-canonical' : 'confirmed-complete-or-empty';
    disclosure.dataset.thYieldDisplay = currentYield.observedOnly ? 'confirmed-period-canonical' : 'confirmed-complete-or-empty';

    const panel = disclosure.querySelector('.th-monthly-report-panel') || document.querySelector(`.th-monthly-report-panel.th-mr-portal-open[data-company="${CSS.escape(companyName)}"]`);
    if (!panel) return;
    const activeButton = panel.querySelector('.th-mr-month.active[aria-pressed="true"]') || panel.querySelector('.th-mr-month.active');
    const selectedKey = activeButton?.dataset.month && company.months[activeButton.dataset.month] ? activeButton.dataset.month : currentKey;
    const selected = company.months[selectedKey];
    const selectedIncome = displayIncome(selected);
    const selectedYield = displayYield(selected);
    const selectedEstimate = displayEstimate(selected);

    const generatedValue = panel.querySelector('[data-th-mr-generated]');
    setText(generatedValue, money(selectedIncome.usd));
    setText(generatedValue?.closest('.th-mr-core-card')?.querySelector('.th-mr-core-label'), c.confirmed);
    const yieldValue = panel.querySelector('[data-th-mr-yield]');
    setText(yieldValue, pct(selectedYield.value));
    setText(yieldValue?.closest('.th-mr-core-card')?.querySelector('.th-mr-core-label'), c.confirmedYield);

    const periodRow = ensurePeriodRow(panel);
    if (periodRow) {
      setText(periodRow.querySelector('[data-th-observed-period-label]'), c.period);
      setText(periodRow.querySelector('[data-th-observed-period-value]'), formatPeriod(selected));
      periodRow.hidden = !(selectedIncome.observedOnly || selectedYield.observedOnly || selectedEstimate.available);
    }

    removeLegacyScopeNote(panel);
    renderTrackingSummary(panel, companyName, selectedKey);
    renderAccountingNotices(panel, companyName, selectedKey, selected, selectedIncome);
    renderEstimate(panel, selectedEstimate);
    panel.dataset.thIncomeDisplay = selectedIncome.observedOnly ? 'confirmed-partial-canonical' : 'confirmed-complete-or-empty';
    panel.dataset.thYieldDisplay = selectedYield.observedOnly ? 'confirmed-period-canonical' : 'confirmed-complete-or-empty';
    panel.dataset.thEstimatedDisplay = selectedEstimate.available ? 'reference-model-non-factual' : 'unavailable';
  }

  function patchMonthlyReports() {
    if (!monthlySnapshot?.companies) return 0;
    let patched = 0;
    document.querySelectorAll('.th-monthly-report-disclosure[data-company]').forEach(disclosure => {
      const name = disclosure.dataset.company;
      const company = monthlySnapshot.companies[name];
      if (!company) return;
      patchDisclosure(disclosure, name, company);
      patched += 1;
    });
    return patched;
  }

  function queueRefresh() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; promoteApr(); patchMonthlyReports(); });
  }

  function refreshOnReportInteraction(event) {
    const trigger = event.target?.closest?.('.th-monthly-report-disclosure .th-mr-trigger, .th-monthly-report-panel .th-mr-month');
    if (!trigger) return;
    refreshSnapshots({ force: false }).catch(err => console.warn('[Company Passport live reporting refresh]', err?.message || err));
  }

  function start() {
    promoteApr();
    refreshSnapshots({ force: true }).catch(err => console.warn('[Company Passport confirmed/estimated income]', err?.message || err));
    document.addEventListener('click', refreshOnReportInteraction, { capture: true });
    const observer = new MutationObserver(queueRefresh);
    observer.observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'aria-pressed', 'lang'] });

    window.__TH_COMPANY_PASSPORT_PRIORITY_ADAPTER__ = {
      version: '0.7.1-human-accounting-notices',
      promoteApr, patchMonthlyReports, refreshSnapshots, snapshotTtlMs: SNAPSHOT_TTL_MS,
      incomeDisplayPolicy: 'confirmed-canonical-events-explicit-reporting-scope',
      yieldDisplayPolicy: 'confirmed-canonical-yield-explicit-reporting-scope',
      estimatedDisplayPolicy: 'backend-incomeView-estimated-only-non-additive-apr-reference-view',
      transparencyPolicy: 'diagnostic-accounting-coverage-notices-never-income-authority',
      noticeGroupingPolicy: 'income-channel-reason-not-raw-event',
      trackingNoEventVisible: true, trackingPresentedWithConfirmed: true,
      associatedCompanyScopeVisible: false, associatedCompanyCapitalIncluded: false,
      browserCalculatesEstimatedIncome: false, confirmedPlusEstimatedIsValidTotal: false,
      estimatedIncomeAuthority: false, estimatedCanCloseAccountingCoverage: false,
      noticesCreateIncome: false, coverageHasCompletionAuthority: false,
      referenceIncomeAuthority: false, executionAuthority: 'none'
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();