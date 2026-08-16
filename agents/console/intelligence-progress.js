(() => {
  'use strict';

  const ID = 'intelligenceProgress';
  const DATA_URL = '/intelligence/intelligence-progress.json';
  if (typeof document === 'undefined' || document.getElementById(ID)) return;

  const css = `
    .thi-section{padding:0 0 2.25rem}.thi-shell{position:relative;overflow:hidden;border-radius:20px;border:1px solid rgba(15,23,42,.12);background:linear-gradient(145deg,#0b0f14 0%,#0f1720 58%,#101820 100%);box-shadow:0 28px 70px rgba(15,23,42,.16);color:#f8fafc}.thi-shell:before{content:"";position:absolute;inset:-30% -10% auto 50%;height:340px;background:radial-gradient(circle,rgba(56,189,248,.14),transparent 62%);pointer-events:none}.thi-top{position:relative;z-index:1;display:flex;align-items:center;justify-content:space-between;gap:1rem;padding:1rem 1.25rem;border-bottom:1px solid rgba(255,255,255,.08)}.thi-kicker{font:600 .7rem/1.2 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.13em;text-transform:uppercase;color:rgba(186,230,253,.82)}.thi-live{display:inline-flex;align-items:center;gap:.48rem;font:600 .68rem/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.08em;color:#bae6fd}.thi-dot{width:7px;height:7px;border-radius:50%;background:#38bdf8;box-shadow:0 0 16px rgba(56,189,248,.75)}.thi-main{position:relative;z-index:1;display:grid;grid-template-columns:minmax(250px,.75fr) minmax(0,1.45fr);gap:1px;background:rgba(255,255,255,.07)}.thi-hero,.thi-detail{background:rgba(8,12,17,.92)}.thi-hero{padding:1.55rem 1.35rem;display:flex;flex-direction:column;justify-content:space-between;min-height:330px}.thi-index-label{font:600 .66rem/1.2 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.14em;text-transform:uppercase;color:rgba(148,163,184,.86)}.thi-index-row{display:flex;align-items:flex-end;gap:.7rem;margin:.45rem 0 .2rem}.thi-index{font:500 clamp(4.2rem,9vw,7.3rem)/.88 'Cormorant Garamond','Playfair Display',serif;letter-spacing:-.055em;color:#f8fafc}.thi-outof{padding-bottom:.55rem;font:500 .82rem/1 ui-monospace,SFMono-Regular,Menlo,monospace;color:#64748b}.thi-stage{font:600 .85rem/1.2 'Space Grotesk','Inter',sans-serif;letter-spacing:.04em;color:#7dd3fc}.thi-delta{margin-left:.42rem;color:#86efac}.thi-delta.down{color:#fda4af}.thi-explain{margin-top:1rem;max-width:28rem;color:#94a3b8;font:400 .78rem/1.55 'Space Grotesk','Inter',sans-serif}.thi-next{margin-top:1.25rem;padding-top:1rem;border-top:1px solid rgba(255,255,255,.07)}.thi-next strong{display:block;font:600 .78rem/1.4 'Space Grotesk','Inter',sans-serif;color:#e2e8f0}.thi-next small{display:block;margin-top:.2rem;color:#64748b;font:500 .68rem/1.45 ui-monospace,SFMono-Regular,Menlo,monospace}.thi-detail{padding:1.4rem}.thi-title-row{display:flex;align-items:flex-start;justify-content:space-between;gap:1rem;margin-bottom:1rem}.thi-title h2{margin:0;font:500 clamp(1.45rem,2.4vw,2rem)/1.1 'Cormorant Garamond','Playfair Display',serif;color:#f8fafc}.thi-title p{margin:.38rem 0 0;color:#64748b;font:400 .72rem/1.45 'Space Grotesk','Inter',sans-serif;max-width:38rem}.thi-spark{width:132px;height:42px;flex:0 0 auto;opacity:.95}.thi-factors{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:.6rem;margin-bottom:1rem}.thi-factor{padding:.72rem .72rem .66rem;border:1px solid rgba(255,255,255,.07);border-radius:10px;background:rgba(255,255,255,.025)}.thi-factor-top{display:flex;justify-content:space-between;gap:.5rem;align-items:baseline}.thi-factor-name{font:600 .63rem/1.2 'Space Grotesk','Inter',sans-serif;color:#cbd5e1}.thi-factor-score{font:600 .64rem/1 ui-monospace,SFMono-Regular,Menlo,monospace;color:#94a3b8}.thi-track{height:4px;margin-top:.55rem;border-radius:99px;background:rgba(148,163,184,.12);overflow:hidden}.thi-fill{height:100%;border-radius:99px;background:linear-gradient(90deg,#38bdf8,#a5f3fc);transition:width .7s ease}.thi-factor[data-low="true"] .thi-fill{background:linear-gradient(90deg,#f59e0b,#fde68a)}.thi-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:.6rem}.thi-card{min-height:86px;padding:.75rem;border:1px solid rgba(255,255,255,.065);border-radius:10px;background:rgba(255,255,255,.018)}.thi-card-value{font:500 1.35rem/1.05 'Space Grotesk','Inter',sans-serif;color:#f8fafc;letter-spacing:-.03em}.thi-card-label{margin-top:.32rem;color:#94a3b8;font:600 .62rem/1.25 'Space Grotesk','Inter',sans-serif}.thi-card-note{margin-top:.22rem;color:#526171;font:500 .57rem/1.32 ui-monospace,SFMono-Regular,Menlo,monospace}.thi-bottom{position:relative;z-index:1;display:grid;grid-template-columns:1.2fr .8fr;gap:1px;background:rgba(255,255,255,.07);border-top:1px solid rgba(255,255,255,.02)}.thi-insight,.thi-boundary{padding:.9rem 1.25rem;background:rgba(8,12,17,.94)}.thi-mini{font:600 .59rem/1.2 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.11em;text-transform:uppercase;color:#64748b}.thi-insight strong,.thi-boundary strong{display:block;margin-top:.32rem;color:#dbeafe;font:600 .75rem/1.45 'Space Grotesk','Inter',sans-serif}.thi-insight span,.thi-boundary span{display:block;margin-top:.18rem;color:#64748b;font:400 .66rem/1.45 'Space Grotesk','Inter',sans-serif}.thi-boundary{text-align:right}.thi-unavailable{padding:2rem 1.3rem;color:#94a3b8;font:500 .76rem/1.55 ui-monospace,SFMono-Regular,Menlo,monospace}.thi-unavailable strong{color:#f8fafc}@media(max-width:900px){.thi-main{grid-template-columns:1fr}.thi-hero{min-height:0}.thi-factors{grid-template-columns:repeat(2,minmax(0,1fr))}.thi-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.thi-bottom{grid-template-columns:1fr}.thi-boundary{text-align:left}}@media(max-width:540px){.thi-section{padding-bottom:1.4rem}.thi-top{padding:.85rem 1rem}.thi-hero,.thi-detail{padding:1.05rem}.thi-index{font-size:4.8rem}.thi-factors{grid-template-columns:1fr 1fr}.thi-metrics{grid-template-columns:1fr 1fr}.thi-title-row{display:block}.thi-spark{margin-top:.8rem;width:100%;height:38px}.thi-card{min-height:78px}.thi-explain{font-size:.73rem}.thi-insight,.thi-boundary{padding:.8rem 1rem}}
  `;

  function el(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }

  function metricCard(value, label, note) {
    const card = el('div', 'thi-card');
    card.append(el('div', 'thi-card-value', value), el('div', 'thi-card-label', label));
    if (note) card.append(el('div', 'thi-card-note', note));
    return card;
  }

  function fmtDelta(value) {
    if (value === null || value === undefined || !Number.isFinite(Number(value))) return 'baseline';
    const n = Number(value);
    return `${n >= 0 ? '+' : ''}${n.toFixed(1)}`;
  }

  function sparkline(history) {
    const wrap = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    wrap.setAttribute('class', 'thi-spark');
    wrap.setAttribute('viewBox', '0 0 132 42');
    wrap.setAttribute('aria-label', 'THI progress history');
    const rows = Array.isArray(history) ? history.filter(x => Number.isFinite(Number(x?.value))).slice(-24) : [];
    if (!rows.length) return wrap;
    const vals = rows.map(x => Number(x.value));
    const lo = Math.max(0, Math.min(...vals) - 2);
    const hi = Math.min(100, Math.max(...vals) + 2);
    const span = Math.max(1, hi - lo);
    const points = vals.map((v, i) => {
      const x = vals.length === 1 ? 66 : 3 + (i / (vals.length - 1)) * 126;
      const y = 38 - ((v - lo) / span) * 32;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
    const baseline = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    baseline.setAttribute('x1', '3'); baseline.setAttribute('y1', '38'); baseline.setAttribute('x2', '129'); baseline.setAttribute('y2', '38');
    baseline.setAttribute('stroke', 'rgba(148,163,184,.18)'); baseline.setAttribute('stroke-width', '1');
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    line.setAttribute('points', points); line.setAttribute('fill', 'none'); line.setAttribute('stroke', '#38bdf8'); line.setAttribute('stroke-width', '2'); line.setAttribute('stroke-linecap', 'round'); line.setAttribute('stroke-linejoin', 'round');
    wrap.append(baseline, line);
    return wrap;
  }

  function validate(data) {
    if (!data || data.version !== '0.1-intelligence-progress') throw new Error('unexpected progress version');
    const value = Number(data?.index?.value);
    if (!Number.isFinite(value) || value < 0 || value > 100) throw new Error('invalid THI value');
    const factors = Array.isArray(data.factors) ? data.factors : [];
    if (factors.length !== 5) throw new Error('invalid THI factor set');
    const sum = factors.reduce((n, f) => n + Number(f?.score || 0), 0);
    if (Math.abs(sum - value) > 0.6) throw new Error('THI factor sum mismatch');
    return data;
  }

  function sectionSkeleton() {
    const section = el('section', 'thi-section');
    section.id = ID;
    section.setAttribute('aria-label', 'The Holding Intelligence Progress');
    const container = el('div', 'container');
    const shell = el('div', 'thi-shell');
    shell.id = 'thiShell';
    const top = el('div', 'thi-top');
    top.append(el('div', 'thi-kicker', 'The Holding Intelligence · Growth telemetry'));
    const live = el('div', 'thi-live'); live.append(el('span', 'thi-dot'), el('span', '', 'CONNECTING'));
    live.lastChild.id = 'thiStatus'; top.append(live);
    const loading = el('div', 'thi-unavailable');
    loading.append(el('strong', '', 'Loading verified intelligence progress…'), document.createTextNode(' No fallback score is invented.'));
    shell.append(top, loading); container.append(shell); section.append(container);
    return section;
  }

  function render(data) {
    validate(data);
    const shell = document.getElementById('thiShell');
    if (!shell) return;
    const status = document.getElementById('thiStatus');
    if (status) status.textContent = 'LIVE / VERIFIED';
    [...shell.children].slice(1).forEach(node => node.remove());

    const main = el('div', 'thi-main');
    const hero = el('div', 'thi-hero');
    const heroTop = el('div');
    heroTop.append(el('div', 'thi-index-label', 'THI · Intelligence maturity index'));
    const row = el('div', 'thi-index-row');
    row.append(el('div', 'thi-index', Number(data.index.value).toFixed(1)), el('div', 'thi-outof', '/ 100'));
    heroTop.append(row);
    const stage = el('div', 'thi-stage', data.index.stage || 'Unknown');
    const delta = el('span', 'thi-delta', ` ${fmtDelta(data.index.delta)}`);
    if (Number(data.index.delta) < 0) delta.classList.add('down');
    stage.append(delta); heroTop.append(stage);
    heroTop.append(el('div', 'thi-explain', 'A deterministic maturity score built from memory, grounded reasoning, evaluation, real decision experience and system integrity. It is not psychometric IQ and cannot be increased by test volume alone.'));
    hero.append(heroTop);
    const next = el('div', 'thi-next');
    if (data.index.nextStage) {
      next.append(el('strong', '', `Next stage · ${data.index.nextStage.label}`), el('small', '', `${data.index.nextStage.pointsAway} THI points away · real outcomes and lessons carry the most weight`));
    } else {
      next.append(el('strong', '', 'Top maturity stage reached'), el('small', '', 'Future progress is shown through evidence depth and history, not a score above 100.'));
    }
    hero.append(next);

    const detail = el('div', 'thi-detail');
    const titleRow = el('div', 'thi-title-row');
    const title = el('div', 'thi-title'); title.append(el('h2', '', 'How the Brain is getting smarter'), el('p', '', 'Simple view of what the system has actually observed, tested, remembered and learned.'));
    titleRow.append(title, sparkline(data.history)); detail.append(titleRow);

    const factors = el('div', 'thi-factors');
    const lowestId = data?.bottleneck?.factor;
    for (const f of data.factors) {
      const box = el('div', 'thi-factor'); if (f.id === lowestId) box.dataset.low = 'true';
      const ftop = el('div', 'thi-factor-top'); ftop.append(el('span', 'thi-factor-name', f.label), el('span', 'thi-factor-score', `${Number(f.score).toFixed(1)} / ${f.max}`));
      const track = el('div', 'thi-track'); const fill = el('div', 'thi-fill'); fill.style.width = `${Math.max(0, Math.min(100, Number(f.pct) || 0))}%`; track.append(fill); box.append(ftop, track); factors.append(box);
    }
    detail.append(factors);

    const m = data.metrics || {};
    const cards = el('div', 'thi-metrics');
    const askNote = `${m.evaluation?.totalAskRuns ?? '—'} total · ${Math.round((Number(m.evaluation?.askSuccessRate) || 0) * 100)}% success`;
    const bank = m.evaluation?.staticQuestionBank;
    cards.append(
      metricCard(m.memory?.brainObservations ?? '—', 'Brain observations', 'coherent reasoning history'),
      metricCard(m.memory?.rememberedCases ?? '—', 'Cases remembered', `${m.memory?.memoryVaultEvents ?? '—'} material memory events`),
      metricCard(m.reasoning?.evidenceMapped ?? '—', 'Evidence mapped', `${m.reasoning?.activeCases ?? '—'} active reasoning cases`),
      metricCard(m.evaluation?.successfulAskRuns ?? '—', 'Verified Ask runs', askNote),
      metricCard(bank ?? '—', 'Question bank', bank === null || bank === undefined ? 'recalculating from canonical corpora' : 'current canonical test cases'),
      metricCard(m.experience?.ownerDecisions ?? '—', 'Owner decisions', 'durable decision memory'),
      metricCard(m.experience?.settledOutcomes ?? '—', 'Settled outcomes', 'real-world result cycles'),
      metricCard(m.experience?.lessons ?? '—', 'Lessons earned', 'evidence-backed, not inferred')
    );
    detail.append(cards);
    main.append(hero, detail);

    const bottom = el('div', 'thi-bottom');
    const insight = el('div', 'thi-insight'); insight.append(el('div', 'thi-mini', 'Current intelligence bottleneck'), el('strong', '', data?.bottleneck?.summary || 'No bottleneck summary available.'));
    const growth = data?.growth?.metricDelta || {};
    const changed = Object.entries(growth).filter(([,v]) => Number(v) > 0).map(([k,v]) => `${k} +${v}`).slice(0,3);
    insight.append(el('span', '', changed.length ? `Since previous snapshot: ${changed.join(' · ')}` : 'Waiting for the next telemetry snapshot to show measurable growth.'));
    const boundary = el('div', 'thi-boundary'); boundary.append(el('div', 'thi-mini', 'Authority / freshness'), el('strong', '', 'READ-ONLY · EXECUTION NONE'), el('span', '', `Updated ${data.generatedAt ? new Date(data.generatedAt).toLocaleString() : '—'} · policy cannot self-mutate`));
    bottom.append(insight, boundary);
    shell.append(main, bottom);
  }

  function fail(error) {
    const status = document.getElementById('thiStatus'); if (status) status.textContent = 'TELEMETRY UNAVAILABLE';
    const shell = document.getElementById('thiShell'); if (!shell) return;
    [...shell.children].slice(1).forEach(node => node.remove());
    const box = el('div', 'thi-unavailable'); box.append(el('strong', '', 'Intelligence progress could not be verified.'), document.createTextNode(' The interface refuses to invent a score and will recover when canonical telemetry is available.'));
    shell.append(box);
    console.warn('[The Holding Intelligence Progress] unavailable', error);
  }

  const style = el('style'); style.dataset.thIntelligenceProgress = 'v0.1'; style.textContent = css; document.head.append(style);
  const section = sectionSkeleton();
  const observer = document.querySelector('.observer-section');
  if (observer?.parentNode) observer.parentNode.insertBefore(section, observer); else document.body.append(section);

  fetch(`${DATA_URL}?v=${Date.now()}`, { cache: 'no-store' })
    .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
    .then(render)
    .catch(fail);
})();
