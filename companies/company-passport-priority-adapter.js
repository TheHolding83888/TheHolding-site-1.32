/* The Holding · Company Passport priority adapter · v0.3.0
 * Presentation only.
 * 1) Promotes the existing APR field to the first metadata row in every
 *    standard Company Passport.
 * 2) Makes already-recognized Canonical Income Ledger income visible in the
 *    Monthly Reports surface even while full-period accounting coverage is
 *    still incomplete.
 * 3) Shows the matching observed-period yield when factual income exists but
 *    full-month coverage is incomplete. That yield is explicitly labelled as
 *    observed/confirmed and never masquerades as a complete monthly yield.
 *
 * This adapter never creates income, calculates factual income, estimates
 * missing days, changes accounting completion, substitutes Reference APR, or
 * expands execution authority. It only renders fields already materialized by
 * canonical Reporting.
 */
(() => {
  'use strict';
  if (window.__TH_COMPANY_PASSPORT_PRIORITY_ADAPTER__) return;

  const REPORT_URL = '/reporting/company-monthly-reports.json';
  let queued = false;
  let monthlySnapshot = null;
  let monthlyLoading = null;

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

  function orderedMonths(company) {
    return Object.keys(company?.months || {}).filter(key => company.months[key]).sort();
  }

  function displayIncome(month) {
    if (!month) return { usd: null, observedOnly: false };
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
    if (finite(month.monthlyYieldPct)) {
      return { value: Number(month.monthlyYieldPct), observedOnly: false };
    }
    const hasObservedEvidence = month.accountingStatus === 'partial-observed' && Number(month.accountingEvidenceCount || 0) > 0;
    if (hasObservedEvidence && finite(month.observedPeriodYieldPct)) {
      return { value: Number(month.observedPeriodYieldPct), observedOnly: true };
    }
    return { value: null, observedOnly: false };
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
      generated: 'Доход',
      observed: 'Подтверждённый доход',
      observedShort: 'подтверждено',
      monthShort: 'за месяц',
      monthYield: 'Доходность месяца',
      observedYield: 'Подтверждённая доходность',
      period: 'Период наблюдения'
    } : {
      generated: 'Generated',
      observed: 'Observed earned income',
      observedShort: 'observed',
      monthShort: 'this month',
      monthYield: 'Month Yield',
      observedYield: 'Observed period yield',
      period: 'Observation period'
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
    setText(triggerLabel, currentIncome.observedOnly ? c.observedShort : c.monthShort);
    setText(triggerYield, pct(currentYield.value));
    disclosure.dataset.thIncomeDisplay = currentIncome.observedOnly ? 'observed-canonical' : 'complete-or-empty';
    disclosure.dataset.thYieldDisplay = currentYield.observedOnly ? 'observed-period-canonical' : 'complete-or-empty';

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

    const generatedValue = panel.querySelector('[data-th-mr-generated]');
    const generatedLabel = generatedValue?.closest('.th-mr-core-card')?.querySelector('.th-mr-core-label');
    setText(generatedValue, money(selectedIncome.usd));
    setText(generatedLabel, selectedIncome.observedOnly ? c.observed : c.generated);

    const yieldValue = panel.querySelector('[data-th-mr-yield]');
    const yieldLabel = yieldValue?.closest('.th-mr-core-card')?.querySelector('.th-mr-core-label');
    setText(yieldValue, pct(selectedYield.value));
    setText(yieldLabel, selectedYield.observedOnly ? c.observedYield : c.monthYield);

    const periodRow = ensurePeriodRow(panel);
    if (periodRow) {
      setText(periodRow.querySelector('[data-th-observed-period-label]'), c.period);
      setText(periodRow.querySelector('[data-th-observed-period-value]'), formatPeriod(selected));
      periodRow.hidden = !(selectedIncome.observedOnly || selectedYield.observedOnly);
    }

    panel.dataset.thIncomeDisplay = selectedIncome.observedOnly ? 'observed-canonical' : 'complete-or-empty';
    panel.dataset.thYieldDisplay = selectedYield.observedOnly ? 'observed-period-canonical' : 'complete-or-empty';
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
    loadMonthlySnapshot()
      .then(() => patchMonthlyReports())
      .catch(err => console.warn('[Company Passport observed income]', err?.message || err));

    const observer = new MutationObserver(queueRefresh);
    observer.observe(document.documentElement, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['class', 'aria-pressed', 'lang']
    });

    window.__TH_COMPANY_PASSPORT_PRIORITY_ADAPTER__ = {
      version: '0.3.0-apr-plus-observed-canonical-income-and-yield',
      promoteApr,
      patchMonthlyReports,
      incomeDisplayPolicy: 'complete-generated-income-or-partial-observed-canonical-income-with-evidence',
      yieldDisplayPolicy: 'complete-month-yield-or-partial-observed-period-yield-with-canonical-income-evidence',
      referenceIncomeAuthority: false,
      executionAuthority: 'none'
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
