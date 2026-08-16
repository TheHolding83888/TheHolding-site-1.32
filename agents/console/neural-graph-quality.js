(() => {
  'use strict';

  if (typeof document === 'undefined' || typeof window === 'undefined') return;

  const QUALITY_URL = '/intelligence/neural-graph/neural-graph-quality.json';
  const REFRESH_MS = 60_000;
  const SECTION_ID = 'neuralGraphQuality';
  const VERSION = '0.1-neural-graph-quality-dashboard';

  const object = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const integer = value => Number.isInteger(Number(value)) ? Number(value) : null;
  const number = value => Number.isFinite(Number(value)) ? Number(value) : null;
  const fmt = value => integer(value) === null ? '—' : Number(value).toLocaleString('en-US');
  const pct = value => number(value) === null ? '—' : `${Number(value).toFixed(Number(value) % 1 ? 1 : 0)}%`;
  const ratio = value => number(value) === null ? '—' : Number(value).toFixed(2);

  function ensureStyle() {
    if (document.querySelector('style[data-th-neural-quality-style]')) return;
    const style = document.createElement('style');
    style.dataset.thNeuralQualityStyle = VERSION;
    style.textContent = `
      .ngq-section{padding:.1rem 0 5.2rem}.ngq-heading{max-width:850px;margin:0 auto 1.35rem;text-align:center}.ngq-eyebrow{margin-bottom:.62rem;color:#805f19;font:700 .61rem/1.2 'Space Grotesk',sans-serif;letter-spacing:.2em;text-transform:uppercase}.ngq-heading h2{margin:0 0 .65rem;font:300 clamp(1.9rem,4vw,2.85rem)/1.08 'Cormorant Garamond',Georgia,serif;letter-spacing:-.025em}.ngq-heading p{max-width:730px;margin:0 auto;color:var(--text-secondary);font-size:.9rem;line-height:1.68}.ngq-shell{overflow:hidden;border:1px solid rgba(67,57,34,.13);border-radius:18px;background:linear-gradient(180deg,rgba(255,255,255,.98),rgba(249,247,241,.92));box-shadow:0 24px 64px -44px rgba(72,55,22,.32)}.ngq-top{display:flex;align-items:center;justify-content:space-between;gap:1rem;padding:.76rem .95rem;border-bottom:1px solid rgba(67,57,34,.08);color:rgba(55,46,28,.5);font:600 .55rem/1.2 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.09em;text-transform:uppercase}.ngq-grid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));border-bottom:1px solid rgba(67,57,34,.08)}.ngq-card{min-width:0;padding:.95rem .78rem;border-right:1px solid rgba(67,57,34,.07)}.ngq-card:last-child{border-right:0}.ngq-value{color:#654b18;font:500 1.38rem/1.05 'Cormorant Garamond',Georgia,serif;font-variant-numeric:tabular-nums}.ngq-label{margin-top:.35rem;color:rgba(55,46,28,.49);font:700 .46rem/1.3 'Space Grotesk',sans-serif;letter-spacing:.085em;text-transform:uppercase}.ngq-sub{margin-top:.3rem;color:rgba(55,46,28,.43);font:500 .5rem/1.35 ui-monospace,SFMono-Regular,Menlo,monospace}.ngq-body{display:grid;grid-template-columns:1fr 1fr}.ngq-pane{padding:1rem}.ngq-pane:first-child{border-right:1px solid rgba(67,57,34,.07)}.ngq-kicker{margin-bottom:.58rem;color:#654b18;font:700 .54rem/1.2 'Space Grotesk',sans-serif;letter-spacing:.1em;text-transform:uppercase}.ngq-bars{display:grid;grid-template-columns:repeat(3,1fr);gap:.5rem}.ngq-mini{padding:.62rem .68rem;border:1px solid rgba(67,57,34,.08);border-radius:11px;background:rgba(255,255,255,.6)}.ngq-mini span{display:block;color:rgba(55,46,28,.44);font:700 .45rem/1.2 'Space Grotesk',sans-serif;letter-spacing:.08em;text-transform:uppercase}.ngq-mini strong{display:block;margin-top:.25rem;color:#654b18;font:500 .96rem/1.15 'Cormorant Garamond',Georgia,serif}.ngq-demand{margin-top:.72rem;display:flex;flex-wrap:wrap;gap:.35rem}.ngq-pill{padding:.32rem .45rem;border:1px solid rgba(154,75,75,.13);border-radius:999px;background:rgba(154,75,75,.035);color:#765252;font:600 .49rem/1.2 'Space Grotesk',sans-serif}.ngq-note{margin-top:.75rem;color:rgba(55,46,28,.58);font-size:.67rem;line-height:1.58}.ngq-foot{padding:.68rem .95rem;border-top:1px solid rgba(67,57,34,.07);color:rgba(55,46,28,.43);font:500 .51rem/1.45 'Space Grotesk',sans-serif}@media(max-width:980px){.ngq-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.ngq-card:nth-child(3){border-right:0}.ngq-card:nth-child(-n+3){border-bottom:1px solid rgba(67,57,34,.07)}}@media(max-width:680px){.ngq-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.ngq-card,.ngq-card:nth-child(3){border-right:1px solid rgba(67,57,34,.07);border-bottom:1px solid rgba(67,57,34,.07)}.ngq-card:nth-child(2n){border-right:0}.ngq-body{grid-template-columns:1fr}.ngq-pane:first-child{border-right:0;border-bottom:1px solid rgba(67,57,34,.07)}.ngq-bars{grid-template-columns:1fr 1fr}}
    `;
    document.head.appendChild(style);
  }

  function ensureSection() {
    let section = document.getElementById(SECTION_ID);
    if (section) return section;
    section = document.createElement('section');
    section.id = SECTION_ID;
    section.className = 'ngq-section';
    section.setAttribute('aria-label', 'Neural Graph Quality and Owner Activation');
    const graph = document.getElementById('neuralGraphGrowth');
    const map = document.getElementById('neuralMapExplorer');
    if (graph?.parentNode) graph.parentNode.insertBefore(section, map || graph.nextSibling);
    else document.body.appendChild(section);
    return section;
  }

  function metric(value, label, sub) {
    const card = document.createElement('div');
    card.className = 'ngq-card';
    const v = document.createElement('div'); v.className = 'ngq-value'; v.textContent = value;
    const l = document.createElement('div'); l.className = 'ngq-label'; l.textContent = label;
    const s = document.createElement('div'); s.className = 'ngq-sub'; s.textContent = sub;
    card.append(v,l,s); return card;
  }

  function mini(label, value) {
    const el = document.createElement('div'); el.className = 'ngq-mini';
    const span = document.createElement('span'); span.textContent = label;
    const strong = document.createElement('strong'); strong.textContent = value;
    el.append(span,strong); return el;
  }

  function render(q) {
    if (q?.version !== '0.2-neural-graph-quality-and-activation') throw new Error('Unexpected graph-quality version');
    if (q?.authority?.executionAuthority !== 'none' || q?.authority?.readOnly !== true) throw new Error('Graph-quality authority boundary failed');
    const activation = object(q.ownerActivation);
    const base = object(q.connectivity?.base);
    const enriched = object(q.connectivity?.enriched);
    const candidates = object(q.candidateCapacity);

    const section = ensureSection(); section.replaceChildren();
    const container = document.createElement('div'); container.className = 'container';
    const heading = document.createElement('div'); heading.className = 'ngq-heading';
    const eyebrow = document.createElement('div'); eyebrow.className = 'ngq-eyebrow'; eyebrow.textContent = 'Brain Quality · Usefulness Instrument';
    const h2 = document.createElement('h2'); h2.textContent = 'Connectivity & Activation.';
    const intro = document.createElement('p'); intro.textContent = 'Growth is useful only when knowledge connects and becomes usable. This instrument measures owner-teaching activation, graph isolation and candidate capacity beside the raw neuron count.';
    heading.append(eyebrow,h2,intro);

    const shell = document.createElement('div'); shell.className = 'ngq-shell';
    const top = document.createElement('div'); top.className = 'ngq-top';
    top.textContent = `THE HOLDING // GRAPH QUALITY // ${q.generatedAt || 'unavailable'} // AUTHORITY NONE`;

    const grid = document.createElement('div'); grid.className = 'ngq-grid';
    grid.append(
      metric(pct(activation.activationRatePct),'Owner Activation','concrete production primitive'),
      metric(fmt(activation.activated),'Activated',`${fmt(activation.partialActivatedCount)} partial`),
      metric(fmt(activation.blocked),'Blocked','missing primitive / source'),
      metric(fmt(activation.contextual),'Contextual','reasoning context by design'),
      metric(`${ratio(base.edgesPerNode)} → ${ratio(enriched.edgesPerNode)}`,'Edges / Neuron','base → activation-aware'),
      metric(`${fmt(base.zeroDegreeCount)} → ${fmt(enriched.zeroDegreeCount)}`,'Isolated Neurons','base → activation-aware')
    );

    const body = document.createElement('div'); body.className = 'ngq-body';
    const left = document.createElement('div'); left.className = 'ngq-pane';
    const lk = document.createElement('div'); lk.className = 'ngq-kicker'; lk.textContent = 'Network depth';
    const bars = document.createElement('div'); bars.className = 'ngq-bars';
    bars.append(
      mini('Components', `${fmt(base.connectedComponentCount)} → ${fmt(enriched.connectedComponentCount)}`),
      mini('Owner islands', `${fmt(activation.baseGraphZeroDegreeOwnerUnits)} → ${fmt(activation.enrichedGraphZeroDegreeOwnerUnits)}`),
      mini('Largest component', `${pct(base.largestComponentPct)} → ${pct(enriched.largestComponentPct)}`)
    );
    const note = document.createElement('div'); note.className = 'ngq-note';
    note.textContent = 'Semantic domain edges make owner knowledge traversable, but they do not count as operational activation. Activation requires a real production capability or measurement primitive.';
    left.append(lk,bars,note);

    const right = document.createElement('div'); right.className = 'ngq-pane';
    const rk = document.createElement('div'); rk.className = 'ngq-kicker'; rk.textContent = 'Candidate capacity & architecture demand';
    const cbars = document.createElement('div'); cbars.className = 'ngq-bars';
    cbars.append(
      mini('Active review', `${fmt(candidates.activeReviewCount)} / ${fmt(candidates.activeReviewCap)}`),
      mini('Blocked', fmt(candidates.blockedCount)),
      mini('Dormant', fmt(candidates.dormantCount)),
      mini('Promoted', fmt(candidates.promotedCount)),
      mini('Inventory', fmt(candidates.inventoryCount)),
      mini('Graph utility', q.utility?.measurementStatus || 'warming')
    );
    const demand = document.createElement('div'); demand.className = 'ngq-demand';
    for (const item of (Array.isArray(q.blockedArchitectureDemand) ? q.blockedArchitectureDemand : []).slice(0,8)) {
      const pill = document.createElement('span'); pill.className = 'ngq-pill'; pill.textContent = item.label || item.blockerId || 'blocked'; demand.appendChild(pill);
    }
    const rnote = document.createElement('div'); rnote.className = 'ngq-note';
    rnote.textContent = 'Candidates are preserved, not deleted for age. Only a bounded subset stays in active review. “Questions made answerable by graph” remains warming until graph traversal itself has a repeatable causal evaluation.';
    right.append(rk,cbars,demand,rnote);
    body.append(left,right);

    const foot = document.createElement('div'); foot.className = 'ngq-foot';
    foot.textContent = 'Activation ≠ quotation · semantic edge ≠ causal edge · contextual ≠ failed · blocked = ranked architecture demand · more graph ≠ more THI · execution authority none';
    shell.append(top,grid,body,foot); container.append(heading,shell); section.appendChild(container);
  }

  function unavailable(error) {
    const section = ensureSection(); section.replaceChildren();
    const container = document.createElement('div'); container.className = 'container';
    const shell = document.createElement('div'); shell.className = 'ngq-shell';
    const top = document.createElement('div'); top.className = 'ngq-top'; top.textContent = 'GRAPH QUALITY // CANONICAL QUALITY STATE UNAVAILABLE';
    const foot = document.createElement('div'); foot.className = 'ngq-foot'; foot.textContent = 'Fail closed: activation, isolation, connectivity and utility are never guessed in the browser.';
    shell.append(top,foot); container.appendChild(shell); section.appendChild(container);
    console.warn('[The Holding Graph Quality]', error);
  }

  async function refresh() {
    if (document.hidden) return;
    try {
      const response = await fetch(`${QUALITY_URL}?v=${Date.now()}`, { cache:'no-store', credentials:'same-origin' });
      if (!response.ok) throw new Error(`${QUALITY_URL} HTTP ${response.status}`);
      render(await response.json());
    } catch (error) { unavailable(error); }
  }

  ensureStyle(); refresh(); window.setInterval(refresh,REFRESH_MS);
  document.addEventListener('visibilitychange',()=>{ if (!document.hidden) refresh(); });
})();
