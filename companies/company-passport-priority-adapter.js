/* The Holding · Company Passport priority adapter · v0.5.0
 * Presentation only.
 * 1) Promotes the existing APR field to the first metadata row in every
 *    standard Company Passport.
 * 2) Makes Canonical Income Ledger income visible as Confirmed even while
 *    full-period accounting coverage is still incomplete.
 * 3) Shows the backend-provided Estimated lane as a separate, non-additive
 *    alternative model view for the same period.
 * 4) Shows the matching confirmed-period yield when factual income exists but
 *    full-month coverage is incomplete.
 * 5) Projects live diagnostic Accounting Coverage into subtle per-period
 *    notices. Missing/uncertain mechanisms remain visible without blocking
 *    already-confirmed income from being shown.
 *
 * This adapter never creates income, calculates factual income, estimates
 * missing days in the browser, adds Confirmed + Estimated, changes accounting
 * completion, substitutes Reference APR for factual income, or expands
 * execution authority. Accounting Coverage remains diagnostic only.
 */
(() => {
  'use strict';
  if (window.__TH_COMPANY_PASSPORT_PRIORITY_ADAPTER__) return;

  const REPORT_URL = '/reporting/company-monthly-reports.json';
  const COVERAGE_URL = '/reporting/accounting-coverage.json';
  const INCOME_VIEW_VERSION = '0.1-confirmed-estimated-non-additive';
  let queued = false;
  let monthlySnapshot = null;
  let monthlyLoading = null;
  let coverageSnapshot = null;
  let coverageLoading = null;

  const lang = () => (document.documentElement.lang || 'en').toLowerCase().startsWith('ru') ? 'ru' : 'en';
  const finite = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
  const money = value => finite(value)
    ? '$' + Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '—';
  const pct = value => finite(value) ? Number(value).toFixed(2) + '%' : '—';

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

  function loadMonthlySnapshot() {
    if (monthlySnapshot) return Promise.resolve(monthlySnapshot);
    if (monthlyLoading) return monthlyLoading;
    monthlyLoading = fetch(REPORT_URL + '?t=' + Date.now(), { cache: 'no-store' })
      .then(response => {
        if (!response.ok) throw new Error('Company Monthly Reports HTTP ' + response.status);
        return response.json();
      })
      .then(data => {
        monthlySnapshot = data;
        return data;
      })
      .finally(() => { monthlyLoading = null; });
    return monthlyLoading;
  }

  function loadCoverageSnapshot() {
    if (coverageSnapshot) return Promise.resolve(coverageSnapshot);
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
        return data;
      })
      .catch(err => {
        coverageSnapshot = null;
        console.warn('[Company Passport accounting transparency]', err?.message || err);
        return null;
      })
      .finally(() => { coverageLoading = null; });
    return coverageLoading;
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
    if (finite(month.generatedIncomeUsd)) {
      return { usd: Number(month.generatedIncomeUsd), observedOnly: false };
    }
    const hasObservedEvidence = month.accountingStatus === 'partial-observed' && Number(month.accountingEvidenceCount || 0) > 0;
    if (hasObservedEvidence && finite(month.observedEarnedIncomeUsd)) {
      return { usd: Number(month.observedEarnedIncomeUsd), observedOnly: true };
    }
    return { usd: null, observedOnly: false };
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
    if (finite(month.monthlyYieldPct)) {
      return { value: Number(month.monthlyYieldPct), observedOnly: false };
    }
    const hasObservedEvidence = month.accountingStatus === 'partial-observed' && Number(month.accountingEvidenceCount || 0) > 0;
    if (hasObservedEvidence && finite(month.observedPeriodYieldPct)) {
      return { value: Number(month.observedPeriodYieldPct), observedOnly: true };
    }
    return { value: null, observedOnly: false };
  }

  function displayEstimate(month) {
    const view = validIncomeView(month);
    const estimated = view?.estimated;
    if (!estimated || estimated.available !== true) return { available: false, usd: null, yieldPct: null };
    if (estimated.basis !== 'existing-reference-model') return { available: false, usd: null, yieldPct: null };
    if (estimated.earnedIncomeAuthority !== false || estimated.factualIncomeAuthority !== false) return { available: false, usd: null, yieldPct: null };
    if (estimated.canCloseAccountingCoverage !== false || estimated.canReplaceUnknown !== false) return { available: false, usd: null, yieldPct: null };
    if (!finite(estimated.usd)) return { available: false, usd: null, yieldPct: null };
    return {
      available: true,
      usd: Number(estimated.usd),
      yieldPct: finite(estimated.yieldPct) ? Number(estimated.yieldPct) : null
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
      confirmed: 'Подтверждённый доход',
      confirmedShort: 'подтверждено',
      confirmedYield: 'Подтверждённая доходность',
      estimated: 'Оценка по модели',
      estimatedNote: 'Оценка — альтернативная модель за тот же период. Она не прибавляется к подтверждённому доходу.',
      period: 'Период наблюдения',
      partial: 'Показан только подтверждённый доход. Неподтверждённые части в сумму не подставляются.',
      awaiting: 'Трекинг активен; подтверждённых событий дохода за этот период пока нет.',
      stateOnly: label => `${label} — пока не включено: состояние позиции видно, но фактический трекинг дохода не подтверждён.`,
      referenceOnly: label => `${label} — пока не включено: фактический трекинг дохода ещё не подтверждён.`,
      boundary: label => `${label} — часть периода пока не включена: требуется подтверждение границы периода.`,
      unclassified: label => `${label} — пока не включено: механизм дохода ещё не классифицирован.`,
      unresolved: label => `${label} — событие дохода пока не включено: требуется дополнительное подтверждение.`,
      unresolvedGeneric: 'Часть событий дохода пока не включена: требуется дополнительное подтверждение.',
      more: count => `Ещё ${count} ${count === 1 ? 'позиция' : count < 5 ? 'позиции' : 'позиций'} пока не включено.`
    } : {
      confirmed: 'Confirmed income',
      confirmedShort: 'confirmed',
      confirmedYield: 'Confirmed yield',
      estimated: 'Estimated',
      estimatedNote: 'Estimate is an alternative model view for the same period. It is not added to confirmed income.',
      period: 'Observation period',
      partial: 'Only confirmed income is shown. Unconfirmed components are never substituted into the total.',
      awaiting: 'Tracking is active; there are no confirmed income events for this period yet.',
      stateOnly: label => `${label} — not counted yet: position state is visible, but factual income tracking is not proven.`,
      referenceOnly: label => `${label} — not counted yet: factual income tracking is not proven.`,
      boundary: label => `${label} — part of the period is not counted yet: the period boundary still needs proof.`,
      unclassified: label => `${label} — not counted yet: the income mechanism is not classified.`,
      unresolved: label => `${label} — income event is not counted yet: additional evidence is required.`,
      unresolvedGeneric: 'Some income events are not counted yet because additional evidence is required.',
      more: count => `${count} more ${count === 1 ? 'position is' : 'positions are'} not counted yet.`
    };
  }

  function ensurePeriodRow(panel) {
    let row = panel.querySelector('.th-mr-observed-period');
    if (row) return row;
    const context = panel.querySelector('.th-mr-context');
    if (!context) return null;
    row = document.createElement('div');
    row.className = 'th-mr-context th-mr-observed-period';
    const label = document.createElement('div');
    label.className = 'th-mr-context-label';
    label.dataset.thObservedPeriodLabel = 'true';
    const value = document.createElement('div');
    value.className = 'th-mr-context-value';
    value.dataset.thObservedPeriodValue = 'true';
    row.append(label, value);
    context.insertAdjacentElement('afterend', row);
    return row;
  }

  function ensureEstimateRow(panel) {
    let row = panel.querySelector('.th-mr-estimated-view');
    if (row) return row;
    row = document.createElement('div');
    row.className = 'th-mr-estimated-view';
    row.hidden = true;

    const head = document.createElement('div');
    head.className = 'th-mr-estimated-head';
    const label = document.createElement('div');
    label.className = 'th-mr-estimated-label';
    label.dataset.thEstimatedLabel = 'true';
    const values = document.createElement('div');
    values.className = 'th-mr-estimated-values';
    const amount = document.createElement('span');
    amount.className = 'th-mr-estimated-amount';
    amount.dataset.thEstimatedAmount = 'true';
    const yieldValue = document.createElement('span');
    yieldValue.className = 'th-mr-estimated-yield';
    yieldValue.dataset.thEstimatedYield = 'true';
    values.append(amount, yieldValue);
    head.append(label, values);

    const note = document.createElement('div');
    note.className = 'th-mr-estimated-note';
    note.dataset.thEstimatedNote = 'true';
    row.append(head, note);

    const period = panel.querySelector('.th-mr-observed-period') || ensurePeriodRow(panel);
    if (period) period.insertAdjacentElement('afterend', row);
    else {
      const context = panel.querySelector('.th-mr-context');
      if (context) context.insertAdjacentElement('afterend', row);
      else panel.appendChild(row);
    }
    return row;
  }

  function ensureTransparencyStyle() {
    if (document.getElementById('th-accounting-transparency-style')) return;
    const style = document.createElement('style');
    style.id = 'th-accounting-transparency-style';
    style.textContent = `
      .th-mr-estimated-view{display:grid;gap:.2rem;margin:.14rem .18rem .42rem;padding:.48rem .58rem;border:1px solid var(--line);border-radius:.65rem;background:color-mix(in srgb,var(--panel) 78%,transparent)}
      .th-mr-estimated-view[hidden]{display:none}
      .th-mr-estimated-head{display:flex;align-items:baseline;justify-content:space-between;gap:.8rem}
      .th-mr-estimated-label{color:var(--text-2);font-size:.57rem;font-weight:650;letter-spacing:.015em}
      .th-mr-estimated-values{display:flex;align-items:baseline;justify-content:flex-end;gap:.45rem;font-variant-numeric:tabular-nums}
      .th-mr-estimated-amount{color:var(--text-1);font-size:.7rem;font-weight:700}
      .th-mr-estimated-yield{color:var(--text-3);font-size:.55rem;font-weight:600}
      .th-mr-estimated-note{color:var(--text-3);font-size:.48rem;font-weight:520;line-height:1.42;text-transform:none}
      .th-mr-accounting-notices{display:grid;gap:.24rem;margin:.02rem .18rem .42rem;padding-top:.34rem;border-top:1px solid var(--line)}
      .th-mr-accounting-notices[hidden]{display:none}
      .th-mr-accounting-notice{position:relative;padding-left:.68rem;color:var(--text-3);font-size:.5rem;font-weight:550;line-height:1.42;letter-spacing:.005em;text-transform:none}
      .th-mr-accounting-notice::before{content:'·';position:absolute;left:.08rem;top:-.01em;color:var(--gold);font-size:.72rem;line-height:1}
      @media(max-width:760.98px){.th-mr-estimated-view{margin-left:.12rem;margin-right:.12rem}.th-mr-accounting-notices{margin-left:.12rem;margin-right:.12rem}.th-mr-accounting-notice{font-size:.49rem}}
    `;
    document.head.appendChild(style);
  }

  function ensureNoticeHost(panel) {
    let host = panel.querySelector('.th-mr-accounting-notices');
    if (host) return host;
    host = document.createElement('div');
    host.className = 'th-mr-accounting-notices';
    host.hidden = true;
    const status = panel.querySelector('[data-th-mr-accounting-note]');
    const context = panel.querySelector('.th-mr-context');
    if (status) status.insertAdjacentElement('afterend', host);
    else if (context) context.insertAdjacentElement('beforebegin', host);
    else panel.appendChild(host);
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

  function mechanismLabel(mechanism) {
    const raw = mechanism?.protocol || mechanism?.engineId || 'Strategy';
    return String(raw).replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function accountingNotices(companyName, monthKey, month, incomeView) {
    if (month?.accountingCoverageComplete === true) return [];
    const c = copy();
    const notices = [];
    const company = coverageCompany(companyName);

    for (const mechanism of Object.values(company?.mechanisms || {})) {
      const state = mechanism?.months?.[monthKey];
      if (!state) continue;
      const label = mechanismLabel(mechanism);
      const blockers = Array.isArray(state.completionBlockers) ? state.completionBlockers : [];
      if (mechanism?.classified !== true || blockers.includes('unclassified-income-mechanism')) {
        notices.push({ key: `unclassified:${mechanism.engineId}`, text: c.unclassified(label) });
        continue;
      }
      if (state.status === 'state-observed-not-factual-tracking') {
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
      return sameCoverageCompany(event?.company, companyName) && (!m || m === monthKey);
    });
    for (const event of unmatched) {
      const label = String(event?.protocol || event?.route || event?.asset || '').trim();
      notices.push({ key: `unmatched:${event?.eventKey || label}`, text: label ? c.unresolved(label) : c.unresolvedGeneric });
    }

    const unresolvedReasons = month?.incomeAccounting?.lifecycle?.unresolvedReasons || [];
    if (unresolvedReasons.length && !unmatched.length) {
      notices.push({ key: 'unresolved-ledger', text: c.unresolvedGeneric });
    }

    const deduped = [...new Map(notices.map(item => [item.key, item])).values()];
    if (!deduped.length) {
      if (incomeView.observedOnly) return [{ key: 'partial-confirmed-only', text: c.partial }];
      return [{ key: 'awaiting-confirmed-evidence', text: c.awaiting }];
    }

    if (incomeView.observedOnly) deduped.unshift({ key: 'partial-confirmed-only', text: c.partial });
    const maxDetailed = 6;
    if (deduped.length <= maxDetailed) return deduped;
    const hidden = deduped.length - maxDetailed;
    return [...deduped.slice(0, maxDetailed), { key: `more:${hidden}`, text: c.more(hidden) }];
  }

  function renderAccountingNotices(panel, companyName, monthKey, month, incomeView) {
    ensureTransparencyStyle();
    const host = ensureNoticeHost(panel);
    const notices = accountingNotices(companyName, monthKey, month, incomeView);
    const fingerprint = JSON.stringify([lang(), coverageSnapshot?.generatedAt || null, monthKey, notices]);
    if (host.dataset.thNoticeFingerprint === fingerprint) return;
    host.dataset.thNoticeFingerprint = fingerprint;
    host.replaceChildren();
    notices.forEach(item => {
      const line = document.createElement('div');
      line.className = 'th-mr-accounting-notice';
      line.dataset.noticeKey = item.key;
      line.textContent = item.text;
      host.appendChild(line);
    });
    host.hidden = notices.length === 0;
  }

  function renderEstimate(panel, estimate) {
    ensureTransparencyStyle();
    const row = ensureEstimateRow(panel);
    const c = copy();
    if (!row) return;
    if (!estimate.available) {
      row.hidden = true;
      row.dataset.thEstimateAuthority = 'none';
      return;
    }
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

    const triggerValue = disclosure.querySelector('.th-mr-trigger .th-mr-value');
    const triggerLabel = disclosure.querySelector('.th-mr-trigger .th-mr-value-label');
    const triggerYield = disclosure.querySelector('.th-mr-trigger .th-mr-meta span');
    setText(triggerValue, money(currentIncome.usd));
    setText(triggerLabel, c.confirmedShort);
    setText(triggerYield, pct(currentYield.value));
    disclosure.dataset.thIncomeDisplay = currentIncome.observedOnly ? 'confirmed-partial-canonical' : 'confirmed-complete-or-empty';
    disclosure.dataset.thYieldDisplay = currentYield.observedOnly ? 'confirmed-period-canonical' : 'confirmed-complete-or-empty';

    const panel = disclosure.querySelector('.th-monthly-report-panel') ||
      document.querySelector(`.th-monthly-report-panel.th-mr-portal-open[data-company="${CSS.escape(companyName)}"]`);
    if (!panel) return;

    const activeButton = panel.querySelector('.th-mr-month.active[aria-pressed="true"]') || panel.querySelector('.th-mr-month.active');
    const selectedKey = activeButton?.dataset.month && company.months[activeButton.dataset.month]
      ? activeButton.dataset.month
      : currentKey;
    const selected = company.months[selectedKey];
    const selectedIncome = displayIncome(selected);
    const selectedYield = displayYield(selected);
    const selectedEstimate = displayEstimate(selected);

    const generatedValue = panel.querySelector('[data-th-mr-generated]');
    const generatedLabel = generatedValue?.closest('.th-mr-core-card')?.querySelector('.th-mr-core-label');
    setText(generatedValue, money(selectedIncome.usd));
    setText(generatedLabel, c.confirmed);

    const yieldValue = panel.querySelector('[data-th-mr-yield]');
    const yieldLabel = yieldValue?.closest('.th-mr-core-card')?.querySelector('.th-mr-core-label');
    setText(yieldValue, pct(selectedYield.value));
    setText(yieldLabel, c.confirmedYield);

    const periodRow = ensurePeriodRow(panel);
    if (periodRow) {
      setText(periodRow.querySelector('[data-th-observed-period-label]'), c.period);
      setText(periodRow.querySelector('[data-th-observed-period-value]'), formatPeriod(selected));
      periodRow.hidden = !(selectedIncome.observedOnly || selectedYield.observedOnly || selectedEstimate.available);
    }

    renderEstimate(panel, selectedEstimate);
    renderAccountingNotices(panel, companyName, selectedKey, selected, selectedIncome);
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
    requestAnimationFrame(() => {
      queued = false;
      promoteApr();
      patchMonthlyReports();
    });
  }

  function start() {
    promoteApr();
    Promise.all([loadMonthlySnapshot(), loadCoverageSnapshot()])
      .then(() => patchMonthlyReports())
      .catch(err => console.warn('[Company Passport confirmed/estimated income]', err?.message || err));

    const observer = new MutationObserver(queueRefresh);
    observer.observe(document.documentElement, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['class', 'aria-pressed', 'lang']
    });

    window.__TH_COMPANY_PASSPORT_PRIORITY_ADAPTER__ = {
      version: '0.5.0-confirmed-estimated',
      promoteApr,
      patchMonthlyReports,
      incomeDisplayPolicy: 'confirmed-canonical-income-only-main-lane',
      yieldDisplayPolicy: 'confirmed-canonical-yield-only-main-lane',
      estimatedDisplayPolicy: 'backend-incomeView-estimated-only-non-additive-alternative-view',
      transparencyPolicy: 'diagnostic-accounting-coverage-notices-never-income-authority',
      browserCalculatesEstimatedIncome: false,
      confirmedPlusEstimatedIsValidTotal: false,
      estimatedIncomeAuthority: false,
      estimatedCanCloseAccountingCoverage: false,
      noticesCreateIncome: false,
      coverageHasCompletionAuthority: false,
      referenceIncomeAuthority: false,
      executionAuthority: 'none'
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
