(() => {
  'use strict';

  const ID = 'operatingEventIntelligence';
  const DATA_URL = '/intelligence/event-intelligence.json';
  if (typeof document === 'undefined' || document.getElementById(ID)) return;

  const css = `
    .oei-section{padding:0 0 2.25rem}.oei-shell{overflow:hidden;border:1px solid rgba(15,23,42,.12);border-radius:20px;background:#0a0f15;color:#f8fafc;box-shadow:0 24px 64px rgba(15,23,42,.14)}.oei-head{display:flex;align-items:flex-start;justify-content:space-between;gap:1rem;padding:1.1rem 1.25rem;border-bottom:1px solid rgba(255,255,255,.08)}.oei-kicker{font:600 .68rem/1.2 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.13em;text-transform:uppercase;color:#a5f3fc}.oei-head h2{margin:.35rem 0 0;font:500 clamp(1.5rem,2.5vw,2.15rem)/1.08 'Cormorant Garamond','Playfair Display',serif}.oei-head p{max-width:43rem;margin:.42rem 0 0;color:#748397;font:400 .73rem/1.5 'Space Grotesk','Inter',sans-serif}.oei-status{flex:0 0 auto;padding:.42rem .58rem;border:1px solid rgba(125,211,252,.18);border-radius:999px;color:#bae6fd;font:600 .63rem/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.08em}.oei-status.watch{border-color:rgba(251,191,36,.22);color:#fde68a}.oei-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:1px;background:rgba(255,255,255,.07)}.oei-metric{min-height:100px;padding:1rem 1.05rem;background:#0c1219}.oei-value{font:500 1.8rem/1 'Space Grotesk','Inter',sans-serif;letter-spacing:-.04em}.oei-label{margin-top:.45rem;color:#a9b7c7;font:600 .62rem/1.3 'Space Grotesk','Inter',sans-serif}.oei-note{margin-top:.25rem;color:#536274;font:500 .57rem/1.4 ui-monospace,SFMono-Regular,Menlo,monospace}.oei-body{display:grid;grid-template-columns:minmax(260px,.7fr) minmax(0,1.3fr);gap:1px;background:rgba(255,255,255,.07);border-top:1px solid rgba(255,255,255,.02)}.oei-side,.oei-feed{background:#0b1118;padding:1.15rem 1.2rem}.oei-mini{font:600 .6rem/1.2 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.11em;text-transform:uppercase;color:#66768a}.oei-side details{margin-top:.8rem;border:1px solid rgba(255,255,255,.07);border-radius:12px;background:rgba(255,255,255,.018)}.oei-side summary{cursor:pointer;list-style:none;padding:.8rem .85rem;color:#d7e1ec;font:600 .7rem/1.3 'Space Grotesk','Inter',sans-serif}.oei-side summary::-webkit-details-marker{display:none}.oei-list{padding:0 .85rem .8rem}.oei-type{display:flex;align-items:flex-start;justify-content:space-between;gap:.75rem;padding:.55rem 0;border-top:1px solid rgba(255,255,255,.05)}.oei-type:first-child{border-top:0}.oei-type-main{min-width:0}.oei-type-name{color:#cbd5e1;font:600 .64rem/1.35 ui-monospace,SFMono-Regular,Menlo,monospace;word-break:break-word}.oei-type-sub{margin-top:.14rem;color:#526171;font:400 .59rem/1.35 'Space Grotesk','Inter',sans-serif}.oei-pill{flex:0 0 auto;padding:.28rem .42rem;border-radius:999px;background:rgba(34,211,238,.08);color:#a5f3fc;font:600 .54rem/1 ui-monospace,SFMono-Regular,Menlo,monospace;text-transform:uppercase}.oei-pill.gap{background:rgba(251,191,36,.08);color:#fde68a}.oei-feed-top{display:flex;justify-content:space-between;gap:1rem;align-items:baseline;margin-bottom:.75rem}.oei-feed-title{color:#e2e8f0;font:600 .74rem/1.2 'Space Grotesk','Inter',sans-serif}.oei-feed-count{color:#526171;font:500 .6rem/1 ui-monospace,SFMono-Regular,Menlo,monospace}.oei-items{display:flex;flex-direction:column;gap:.55rem;max-height:650px;overflow:auto;padding-right:.1rem}.oei-event{position:relative;padding:.78rem .8rem .76rem 1rem;border:1px solid rgba(255,255,255,.065);border-radius:11px;background:rgba(255,255,255,.018)}.oei-event:before{content:"";position:absolute;left:.45rem;top:.9rem;width:4px;height:4px;border-radius:50%;background:#38bdf8}.oei-event[data-severity="review"]:before,.oei-event[data-severity="important"]:before{background:#fbbf24}.oei-event-meta{display:flex;flex-wrap:wrap;gap:.45rem .65rem;color:#526171;font:500 .56rem/1.25 ui-monospace,SFMono-Regular,Menlo,monospace}.oei-event-mode{color:#7dd3fc}.oei-event-headline{margin-top:.32rem;color:#e6edf5;font:600 .72rem/1.38 'Space Grotesk','Inter',sans-serif}.oei-event-detail{margin-top:.22rem;color:#718096;font:400 .64rem/1.45 'Space Grotesk','Inter',sans-serif}.oei-attribution{margin-top:.34rem;color:#8c98a8;font:500 .58rem/1.4 ui-monospace,SFMono-Regular,Menlo,monospace}.oei-foot{display:flex;justify-content:space-between;gap:1rem;padding:.78rem 1.2rem;border-top:1px solid rgba(255,255,255,.07);background:#080d12;color:#526171;font:500 .57rem/1.4 ui-monospace,SFMono-Regular,Menlo,monospace}.oei-unavailable{padding:1.4rem;color:#94a3b8;font:500 .72rem/1.5 ui-monospace,SFMono-Regular,Menlo,monospace}.oei-unavailable strong{color:#f8fafc}@media(max-width:900px){.oei-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.oei-body{grid-template-columns:1fr}.oei-items{max-height:520px}}@media(max-width:600px){.oei-section{padding-bottom:1.4rem}.oei-head{display:block;padding:1rem}.oei-status{display:inline-block;margin-top:.8rem}.oei-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.oei-metric{min-height:88px;padding:.85rem}.oei-side,.oei-feed{padding:1rem}.oei-foot{display:block;padding:.75rem 1rem}.oei-foot span+span{display:block;margin-top:.3rem}.oei-event-headline{font-size:.69rem}}
  `;

  function el(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }
  function fmtAge(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 'unknown';
    if (n < 1) return `${Math.round(n * 60)}m`;
    return `${n.toFixed(1)}h`;
  }
  function fmtTime(value) {
    const ms = Date.parse(value || '');
    if (!Number.isFinite(ms)) return 'unknown time';
    try { return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(ms)); }
    catch (_) { return new Date(ms).toISOString(); }
  }
  function validate(data) {
    if (!data || data.version !== '0.1-operating-event-intelligence') throw new Error('unexpected event intelligence version');
    if (data?.authority?.executionAuthority !== 'none' || data?.authority?.readOnly !== true) throw new Error('event intelligence authority mismatch');
    const t = data.tracked || {};
    for (const key of ['activeEventTypeCount','measuredEventTypeCount','derivedEventTypeCount','coverageGapCount']) {
      if (!Number.isInteger(Number(t[key])) || Number(t[key]) < 0) throw new Error(`invalid ${key}`);
    }
    if (!Array.isArray(t.eventTypes) || !Array.isArray(t.coverageGaps) || !Array.isArray(data?.feed?.items)) throw new Error('event intelligence arrays missing');
    return data;
  }
  function metric(value, label, note) {
    const box = el('div', 'oei-metric');
    box.append(el('div', 'oei-value', value), el('div', 'oei-label', label));
    if (note) box.append(el('div', 'oei-note', note));
    return box;
  }
  function trackedRows(rows, isGap) {
    const wrap = el('div', 'oei-list');
    for (const row of rows || []) {
      const item = el('div', 'oei-type');
      const main = el('div', 'oei-type-main');
      main.append(el('div', 'oei-type-name', row.id || 'unknown'));
      const note = isGap ? row.why : [row.mode, row.source].filter(Boolean).join(' · ');
      if (note) main.append(el('div', 'oei-type-sub', note));
      item.append(main, el('span', `oei-pill${isGap ? ' gap' : ''}`, isGap ? 'GAP' : (row.mode || 'active')));
      wrap.append(item);
    }
    return wrap;
  }
  function eventCard(item) {
    const card = el('article', 'oei-event');
    card.dataset.severity = item.severity || 'info';
    const meta = el('div', 'oei-event-meta');
    meta.append(el('span', '', fmtTime(item.occurredAt)), el('span', '', item.entity || 'System'), el('span', 'oei-event-mode', String(item.mode || 'measured').toUpperCase()));
    card.append(meta, el('div', 'oei-event-headline', item.headline || item.type || 'Operating event'));
    if (item.detail) card.append(el('div', 'oei-event-detail', item.detail));
    if (item.attribution?.note) card.append(el('div', 'oei-attribution', `Attribution: ${item.attribution.note}`));
    return card;
  }
  function skeleton() {
    const section = el('section', 'oei-section'); section.id = ID; section.setAttribute('aria-label', 'The Holding Operating Event Intelligence');
    const container = el('div', 'container'); const shell = el('div', 'oei-shell'); shell.id = 'oeiShell';
    const head = el('div', 'oei-head');
    const title = el('div'); title.append(el('div', 'oei-kicker', 'The Holding · Operating Intelligence'), el('h2', '', 'Company Event Feed'), el('p', '', 'Source-backed changes across companies and productive routes. Tracked coverage is counted separately from ideas that still need a canonical data source.'));
    const status = el('div', 'oei-status', 'CONNECTING'); status.id = 'oeiStatus'; head.append(title, status);
    const loading = el('div', 'oei-unavailable'); loading.append(el('strong', '', 'Loading operating events…'), document.createTextNode(' No event or tracked-count fallback is invented.'));
    shell.append(head, loading); container.append(shell); section.append(container); return section;
  }
  function render(data) {
    validate(data);
    const shell = document.getElementById('oeiShell'); if (!shell) return;
    const status = document.getElementById('oeiStatus');
    if (status) { status.textContent = data.status === 'ok' ? 'LIVE / SOURCE-BACKED' : 'WATCH / SOURCE AGE'; status.classList.toggle('watch', data.status !== 'ok'); }
    [...shell.children].slice(1).forEach(n => n.remove());
    const t = data.tracked;
    const grid = el('div', 'oei-grid');
    grid.append(
      metric(t.activeEventTypeCount, 'Tracked event types', 'real active/derived coverage'),
      metric(t.measuredEventTypeCount, 'Measured', 'direct canonical event history'),
      metric(t.derivedEventTypeCount, 'Derived', 'deterministic historical comparison'),
      metric(t.coverageGapCount, 'Coverage gaps', 'requested but not yet source-bound'),
      metric(data.feed.itemCount, 'Feed items', `of ${data.feed.totalDerivedFromAvailableHistory || data.feed.itemCount} available`)
    );
    const body = el('div', 'oei-body');
    const side = el('div', 'oei-side'); side.append(el('div', 'oei-mini', 'Coverage contract'));
    const active = document.createElement('details'); active.open = true; active.append(el('summary', '', `What is tracked · ${t.activeEventTypeCount}`), trackedRows(t.eventTypes, false));
    const gaps = document.createElement('details'); gaps.append(el('summary', '', `Next coverage gaps · ${t.coverageGapCount}`), trackedRows(t.coverageGaps, true));
    side.append(active, gaps);
    const feed = el('div', 'oei-feed');
    const feedTop = el('div', 'oei-feed-top'); feedTop.append(el('div', 'oei-feed-title', 'Latest operating events'), el('div', 'oei-feed-count', `${data.feed.itemCount} shown`)); feed.append(feedTop);
    const items = el('div', 'oei-items');
    if (!data.feed.items.length) items.append(el('div', 'oei-unavailable', 'No source-backed events in the available history yet.'));
    else for (const item of data.feed.items) items.append(eventCard(item));
    feed.append(items); body.append(side, feed);
    const foot = el('div', 'oei-foot');
    const rAge = fmtAge(data?.sourceHealth?.reporting?.ageHours); const hAge = fmtAge(data?.sourceHealth?.changeHistory?.ageHours);
    foot.append(el('span', '', `Reporting age ${rAge} · Observer history age ${hAge}`), el('span', '', 'READ-ONLY · CAUSALITY FAIL-CLOSED · EXECUTION NONE'));
    shell.append(grid, body, foot);
  }
  function unavailable(message) {
    const shell = document.getElementById('oeiShell'); if (!shell) return;
    const status = document.getElementById('oeiStatus'); if (status) { status.textContent = 'UNAVAILABLE'; status.classList.add('watch'); }
    [...shell.children].slice(1).forEach(n => n.remove());
    const box = el('div', 'oei-unavailable'); box.append(el('strong', '', 'Operating Event Intelligence unavailable. '), document.createTextNode(message || 'The UI refuses to invent tracked coverage or events.')); shell.append(box);
  }
  function mount() {
    const section = skeleton();
    const progress = document.getElementById('intelligenceProgress');
    const observer = document.querySelector('.observer-section');
    if (progress?.parentNode) progress.parentNode.insertBefore(section, progress.nextSibling);
    else if (observer?.parentNode) observer.parentNode.insertBefore(section, observer);
    else document.body.append(section);
  }
  async function boot() {
    try {
      const response = await fetch(`${DATA_URL}?v=${Date.now()}`, { cache: 'no-store', credentials: 'same-origin' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      render(await response.json());
    } catch (error) { unavailable(error?.message || 'Source unavailable'); }
  }

  const style = document.createElement('style'); style.dataset.thOperatingEventIntelligence = 'v0.1'; style.textContent = css; document.head.append(style);
  mount(); boot();
})();
