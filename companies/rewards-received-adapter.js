/* The Holding · Rewards Received lifecycle adapter · v0.3.0
 * Presentation only. Reads canonical /companies/rewards-data.json and places proven
 * 40 Acres Received income directly beside the corresponding Velodrome accrual row.
 * Received remains separate from Claimable/Unclaimed, while the Passport headline
 * is the broader Tracked Rewards total (current accrued + proven Received).
 */
(() => {
  'use strict';
  if (window.__TH_REWARDS_RECEIVED_ADAPTER__) return;

  const URL = '/companies/rewards-data.json';
  let snapshot = null;
  let loading = null;
  let renderQueued = false;

  const lang = () => (document.documentElement.lang || 'en').toLowerCase().startsWith('ru') ? 'ru' : 'en';
  const finite = v => v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v));
  const money2 = v => '$' + Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const amountText = row => {
    if (!finite(row?.amount)) return '—';
    return Number(row.amount).toLocaleString('en-US', { maximumFractionDigits: 6 }) + (row.symbol ? ' ' + row.symbol : '');
  };
  const dateText = iso => {
    const t = Date.parse(iso || '');
    if (!Number.isFinite(t)) return null;
    return new Intl.DateTimeFormat(lang() === 'ru' ? 'ru-RU' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(t));
  };
  const node = (tag, className, text) => {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined && text !== null) el.textContent = String(text);
    return el;
  };

  function ensureStyle() {
    if (document.getElementById('th-rewards-received-style')) return;
    const s = document.createElement('style');
    s.id = 'th-rewards-received-style';
    s.textContent = `
      .ipx-reward-row.ipx-received-inline{background:rgba(10,124,78,.018)}
      .ipx-reward-state.received{color:#0a7c4e;background:rgba(10,124,78,.055);border-color:rgba(10,124,78,.13)}
      .ipx-received-proof{opacity:.72}
    `;
    document.head.appendChild(s);
  }

  async function load() {
    if (snapshot) return snapshot;
    if (loading) return loading;
    loading = fetch(URL + '?t=' + Date.now(), { cache: 'no-store' })
      .then(r => { if (!r.ok) throw new Error('Rewards HTTP ' + r.status); return r.json(); })
      .then(d => { snapshot = d; return d; })
      .finally(() => { loading = null; });
    return loading;
  }

  function companyState(name) {
    return snapshot?.companies?.[name] || null;
  }

  function applyTrackedHeadline(item, c) {
    if (!finite(c?.receivedIncomeUsd) || !(Number(c.receivedIncomeUsd) > 0)) return;
    const accrued = finite(c?.totalUsd) ? Number(c.totalUsd) : 0;
    const received = Number(c.receivedIncomeUsd);
    const combined = accrued + received;
    const incomplete = c?.totalUsdIsComplete === false;
    const value = item.querySelector('.ipx-rewards-value');
    const kicker = item.querySelector('.ipx-rewards-trigger .ipx-ledger-kicker');
    const caption = item.querySelector('.ipx-rewards-caption span');
    if (value) {
      value.textContent = money2(combined) + (incomplete ? '+' : '');
      value.classList.toggle('measuring', false);
      value.dataset.trackedRewards = 'accrued-plus-received';
      value.dataset.accruedUsd = String(accrued);
      value.dataset.receivedUsd = String(received);
    }
    if (kicker) kicker.textContent = lang() === 'ru' ? 'Отслеживаемые rewards' : 'Tracked Rewards';
    if (caption) caption.textContent = lang() === 'ru' ? 'Накоплено + получено ончейн' : 'Accrued + Received onchain';
  }

  function applyTrackedNote(panel, c) {
    if (!finite(c?.receivedIncomeUsd) || !(Number(c.receivedIncomeUsd) > 0)) return;
    const note = panel.querySelector('.ipx-reward-panel-note');
    if (!note) return;
    const before = note.textContent || '';
    const after = before
      .replace('Measured total', 'Tracked total')
      .replace('Измеренная сумма', 'Отслеживаемая сумма');
    if (after !== before) note.textContent = after;
  }

  function fingerprintFor(c, rows) {
    return JSON.stringify([
      lang(), c?.totalUsd, c?.totalUsdIsComplete, c?.receivedIncomeUsd, c?.receivedIncomeTransferCount,
      ...rows.map(row => [row.portfolio, row.recipient, row.symbol, row.amount, row.usdValue, row.transferCount, row.throughBlock])
    ]);
  }

  function receivedRow(row, fingerprint) {
    const el = node('div', 'ipx-reward-row ipx-received-inline');
    el.dataset.receivedLifecycle = 'onchain-proven';
    el.dataset.receivedFingerprint = fingerprint;
    const left = node('div');
    const protocol = node('div', 'ipx-reward-protocol', 'Velodrome · 40 Acres');
    protocol.appendChild(document.createTextNode(' '));
    protocol.appendChild(node('span', 'ipx-reward-state received', lang() === 'ru' ? 'Получено' : 'Received'));
    left.appendChild(protocol);

    const count = Number(row.transferCount || 0);
    const first = row.transfers?.[0]?.timestamp || row.trackingSince;
    const last = row.transfers?.[row.transfers.length - 1]?.timestamp || null;
    const dates = first && last && first !== last ? `${dateText(first)} – ${dateText(last)}` : dateText(first);
    const meta = [row.symbol, row.chain, dates, count ? `${count} ${lang() === 'ru' ? 'выплат' : (count === 1 ? 'payment' : 'payments')}` : null].filter(Boolean).join(' · ');
    left.appendChild(node('div', 'ipx-reward-meta', meta));
    left.appendChild(node('div', 'ipx-reward-meta ipx-received-proof', lang() === 'ru' ? 'Фактически выплачено · подтверждено onchain' : 'Actually paid · onchain proven'));
    el.appendChild(left);

    const right = node('div', 'ipx-reward-right');
    right.appendChild(node('div', 'ipx-reward-amount', amountText(row)));
    if (finite(row.usdValue)) right.appendChild(node('div', 'ipx-reward-usd', money2(row.usdValue)));
    el.appendChild(right);
    return el;
  }

  function velodromeAnchor(panel) {
    const rows = [...panel.querySelectorAll('.ipx-reward-row:not(.ipx-received-inline)')];
    return rows.find(row => /velodrome/i.test(row.textContent || '') && /40\s*acres/i.test(row.textContent || ''))
      || rows.find(row => /velodrome/i.test(row.querySelector('.ipx-reward-protocol')?.textContent || ''))
      || null;
  }

  function renderItem(item) {
    const name = item?.dataset?.nm;
    const c = companyState(name);
    const received = Array.isArray(c?.receivedIncome) ? c.receivedIncome.filter(x => x && x.state === 'Received') : [];
    const panel = item?.querySelector('.ipx-rewards-panel');
    if (!panel) return false;
    const existing = [...panel.querySelectorAll('.ipx-received-inline')];
    const rows = received.filter(x => Number(x.transferCount || 0) > 0 || Number(x.amount || 0) > 0);
    if (!rows.length) {
      existing.forEach(x => x.remove());
      return false;
    }

    applyTrackedHeadline(item, c);
    applyTrackedNote(panel, c);
    const fingerprint = fingerprintFor(c, rows);
    if (existing.length === rows.length && existing.every(x => x.dataset.receivedFingerprint === fingerprint)) return true;
    existing.forEach(x => x.remove());
    panel.querySelectorAll('.ipx-received-section').forEach(x => x.remove());
    ensureStyle();

    let anchor = velodromeAnchor(panel);
    rows.forEach(row => {
      const rendered = receivedRow(row, fingerprint);
      if (anchor?.parentNode) {
        anchor.parentNode.insertBefore(rendered, anchor.nextSibling);
        anchor = rendered;
      } else {
        const note = panel.querySelector('.ipx-reward-panel-note');
        if (note) panel.insertBefore(rendered, note); else panel.appendChild(rendered);
        anchor = rendered;
      }
    });
    return true;
  }

  function renderAll() {
    if (!snapshot) return;
    document.querySelectorAll('.ib-item[data-nm]').forEach(renderItem);
  }

  function queueRender() {
    if (renderQueued) return;
    renderQueued = true;
    requestAnimationFrame(() => {
      renderQueued = false;
      renderAll();
    });
  }

  async function start() {
    try {
      await load();
      renderAll();
      const observer = new MutationObserver(queueRender);
      observer.observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ['lang', 'class'] });
      window.__TH_REWARDS_RECEIVED_ADAPTER__ = { version: '0.3.0-inline-velodrome-received', renderAll };
    } catch (err) {
      console.warn('[Rewards Received]', err && err.message ? err.message : err);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
