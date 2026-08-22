/* The Holding · Rewards Received lifecycle adapter · v0.1.2
 * Presentation only. Reads canonical /companies/rewards-data.json and appends a
 * separate Received history section to Company Passports when onchain evidence exists.
 * Received never changes current Claimable/Unclaimed headline totals.
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
      .ipx-received-section{margin-top:.65rem;padding-top:.62rem;border-top:1px solid rgba(22,21,15,.08)}
      .ipx-received-head{display:flex;align-items:end;justify-content:space-between;gap:.8rem;margin:0 0 .38rem}
      .ipx-received-title{font-size:.58rem;line-height:1;text-transform:uppercase;letter-spacing:.12em;color:rgba(22,21,15,.46);font-weight:650}
      .ipx-received-total{font-size:.72rem;line-height:1;color:#0a7c4e;font-weight:650;font-variant-numeric:tabular-nums}
      .ipx-reward-state.received{color:#0a7c4e;background:rgba(10,124,78,.055);border-color:rgba(10,124,78,.13)}
      .ipx-received-proof{opacity:.72}
      @media(max-width:760px){.ipx-received-head{margin-top:.1rem}.ipx-received-title{font-size:.54rem}.ipx-received-total{font-size:.68rem}}
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

  function fingerprintFor(c, rows) {
    return JSON.stringify([
      lang(),
      c?.receivedIncomeUsd,
      c?.receivedIncomeTransferCount,
      ...rows.map(row => [row.portfolio, row.recipient, row.symbol, row.amount, row.usdValue, row.transferCount, row.throughBlock])
    ]);
  }

  function receivedRow(row) {
    const el = node('div', 'ipx-reward-row');
    const left = node('div');
    const protocol = node('div', 'ipx-reward-protocol', row.protocol || '40 Acres · veVELO');
    protocol.appendChild(document.createTextNode(' '));
    protocol.appendChild(node('span', 'ipx-reward-state received', lang() === 'ru' ? 'Получено' : 'Received'));
    left.appendChild(protocol);

    const count = Number(row.transferCount || 0);
    const first = row.transfers?.[0]?.timestamp || row.trackingSince;
    const last = row.transfers?.[row.transfers.length - 1]?.timestamp || null;
    const dates = first && last && first !== last ? `${dateText(first)} – ${dateText(last)}` : dateText(first);
    const meta = [row.symbol, row.chain, dates, count ? `${count} ${lang() === 'ru' ? 'выплат' : (count === 1 ? 'payment' : 'payments')}` : null].filter(Boolean).join(' · ');
    left.appendChild(node('div', 'ipx-reward-meta', meta));
    left.appendChild(node('div', 'ipx-reward-meta ipx-received-proof', lang() === 'ru' ? '40 Acres · подтверждено onchain' : '40 Acres · onchain proven'));
    el.appendChild(left);

    const right = node('div', 'ipx-reward-right');
    right.appendChild(node('div', 'ipx-reward-amount', amountText(row)));
    if (finite(row.usdValue)) right.appendChild(node('div', 'ipx-reward-usd', money2(row.usdValue)));
    el.appendChild(right);
    return el;
  }

  function renderItem(item) {
    const name = item?.dataset?.nm;
    const c = companyState(name);
    const received = Array.isArray(c?.receivedIncome) ? c.receivedIncome.filter(x => x && x.state === 'Received') : [];
    const panel = item?.querySelector('.ipx-rewards-panel');
    if (!panel) return false;
    const existing = panel.querySelector('.ipx-received-section');
    const rows = received.filter(x => Number(x.transferCount || 0) > 0 || Number(x.amount || 0) > 0);
    if (!rows.length) {
      existing?.remove();
      return false;
    }

    const fingerprint = fingerprintFor(c, rows);
    if (existing?.dataset?.receivedFingerprint === fingerprint) return true;
    existing?.remove();
    ensureStyle();

    const section = node('div', 'ipx-received-section');
    section.dataset.receivedLifecycle = 'onchain-proven';
    section.dataset.receivedFingerprint = fingerprint;
    const head = node('div', 'ipx-received-head');
    head.appendChild(node('div', 'ipx-received-title', lang() === 'ru' ? 'Получено · история' : 'Received · History'));
    const totalUsd = finite(c.receivedIncomeUsd) ? Number(c.receivedIncomeUsd) : null;
    head.appendChild(node('div', 'ipx-received-total', totalUsd === null ? '' : money2(totalUsd)));
    section.appendChild(head);
    rows.forEach(row => section.appendChild(receivedRow(row)));

    const note = panel.querySelector('.ipx-reward-panel-note');
    if (note) panel.insertBefore(section, note); else panel.appendChild(section);
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
      window.__TH_REWARDS_RECEIVED_ADAPTER__ = { version: '0.1.2-40acres-received-history', renderAll };
    } catch (err) {
      console.warn('[Rewards Received]', err && err.message ? err.message : err);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
