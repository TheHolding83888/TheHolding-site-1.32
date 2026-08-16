(() => {
  'use strict';

  if (typeof document === 'undefined' || typeof window === 'undefined') return;

  const CONTEXT_URL = '/intelligence/owner-context/owner-decision-context.json';
  const OVERLAY_URL = '/intelligence/owner-context/brain-owner-context-overlay.json';
  const REFRESH_MS = 60_000;
  const SECTION_ID = 'ownerIntelligenceGrowth';

  const safeArray = value => Array.isArray(value) ? value : [];
  const finiteInt = value => {
    const number = Number(value);
    return Number.isInteger(number) && number >= 0 ? number : null;
  };
  const shortHash = value => typeof value === 'string' && value
    ? (value.length > 24 ? `${value.slice(0, 12)}…${value.slice(-10)}` : value)
    : 'unavailable';

  function collectNamedArrays(root, keyName) {
    const found = [];
    const seen = new WeakSet();
    function walk(value) {
      if (!value || typeof value !== 'object' || seen.has(value)) return;
      seen.add(value);
      if (Array.isArray(value)) {
        value.forEach(walk);
        return;
      }
      for (const [key, child] of Object.entries(value)) {
        if (key === keyName && Array.isArray(child)) found.push(...child);
        walk(child);
      }
    }
    walk(root);
    return found;
  }

  function stableKey(value) {
    if (typeof value === 'string') return value.trim();
    if (!value || typeof value !== 'object') return String(value || '');
    const ordered = Object.fromEntries(Object.keys(value).sort().map(key => [key, value[key]]));
    return JSON.stringify(ordered);
  }

  function deriveGraphStats(context) {
    const metrics = new Set(
      collectNamedArrays(context?.sources, 'trackingHooks').map(stableKey).filter(Boolean)
    );
    const edges = new Set(
      collectNamedArrays(context?.sources, 'relationshipCandidates').map(stableKey).filter(Boolean)
    );
    return { metricCandidates: metrics.size, relationshipCandidates: edges.size };
  }

  function ensureStyle() {
    if (document.querySelector('style[data-th-owner-intelligence-style]')) return;
    const style = document.createElement('style');
    style.dataset.thOwnerIntelligenceStyle = 'v0.1';
    style.textContent = `
      .owner-intelligence-section{padding:.25rem 0 5.5rem}.owner-intelligence-heading{max-width:900px;margin:0 auto 1.7rem;text-align:center}.owner-intelligence-eyebrow{margin-bottom:.7rem;color:var(--accent-azure,#2d5f87);font:700 .64rem/1.2 'Space Grotesk',sans-serif;letter-spacing:.22em;text-transform:uppercase}.owner-intelligence-heading h2{margin:0 0 .75rem;font:300 clamp(2rem,4.4vw,3.15rem)/1.08 'Cormorant Garamond',Georgia,serif;letter-spacing:-.025em}.owner-intelligence-heading p{max-width:720px;margin:0 auto;color:var(--text-secondary);font-size:.96rem;font-weight:300;line-height:1.72}.owner-intelligence-shell{overflow:hidden;border:1px solid rgba(22,21,15,.12);border-radius:20px;background:linear-gradient(180deg,rgba(255,255,255,.96),rgba(246,248,250,.88));box-shadow:0 28px 70px -42px rgba(22,35,45,.35)}.owner-intelligence-top{display:flex;align-items:center;justify-content:space-between;gap:1rem;padding:.82rem 1rem;border-bottom:1px solid rgba(22,21,15,.08);font:600 .58rem/1.25 ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;letter-spacing:.095em;text-transform:uppercase;color:rgba(22,21,15,.48)}.owner-intelligence-status{display:inline-flex;align-items:center;gap:.45rem;color:#42667f}.owner-intelligence-dot{width:7px;height:7px;border-radius:50%;background:#7891a2}.owner-intelligence-shell[data-health="ready"] .owner-intelligence-dot{background:#0a7c4e;box-shadow:0 0 0 4px rgba(10,124,78,.06)}.owner-intelligence-metrics{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));border-bottom:1px solid rgba(22,21,15,.08)}.owner-intelligence-metric{min-width:0;padding:1.05rem .9rem;border-right:1px solid rgba(22,21,15,.07)}.owner-intelligence-metric:last-child{border-right:0}.owner-intelligence-value{font:500 1.42rem/1.1 'Cormorant Garamond',Georgia,serif;color:#1f4463;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}.owner-intelligence-label{margin-top:.38rem;color:rgba(22,21,15,.45);font:700 .49rem/1.3 'Space Grotesk',sans-serif;letter-spacing:.105em;text-transform:uppercase}.owner-intelligence-body{display:grid;grid-template-columns:minmax(0,1.4fr) minmax(260px,.6fr)}.owner-intelligence-copy{padding:1.1rem 1.15rem 1.15rem;border-right:1px solid rgba(22,21,15,.07)}.owner-intelligence-copy strong{display:block;margin-bottom:.4rem;color:#1f4463;font:600 .62rem/1.25 ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;letter-spacing:.08em;text-transform:uppercase}.owner-intelligence-copy p{margin:0;color:rgba(22,21,15,.64);font-size:.72rem;line-height:1.62}.owner-intelligence-copy p+p{margin-top:.5rem}.owner-intelligence-integrity{padding:1.1rem 1rem;color:rgba(22,21,15,.5);font:500 .56rem/1.55 ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;overflow-wrap:anywhere}.owner-intelligence-integrity b{color:#1f4463;font-weight:600}.owner-intelligence-integrity div+div{margin-top:.35rem}.owner-intelligence-foot{padding:.72rem 1rem;border-top:1px solid rgba(22,21,15,.07);color:rgba(22,21,15,.42);font:500 .54rem/1.45 'Space Grotesk',sans-serif;letter-spacing:.035em}@media(max-width:900px){.owner-intelligence-metrics{grid-template-columns:repeat(3,minmax(0,1fr))}.owner-intelligence-metric:nth-child(3){border-right:0}.owner-intelligence-metric:nth-child(-n+3){border-bottom:1px solid rgba(22,21,15,.07)}.owner-intelligence-body{grid-template-columns:1fr}.owner-intelligence-copy{border-right:0;border-bottom:1px solid rgba(22,21,15,.07)}}@media(max-width:560px){.owner-intelligence-section{padding-bottom:4.25rem}.owner-intelligence-shell{border-radius:14px}.owner-intelligence-top{align-items:flex-start;flex-direction:column}.owner-intelligence-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.owner-intelligence-metric,.owner-intelligence-metric:nth-child(3){border-right:1px solid rgba(22,21,15,.07);border-bottom:1px solid rgba(22,21,15,.07)}.owner-intelligence-metric:nth-child(2n){border-right:0}.owner-intelligence-metric:nth-last-child(-n+2){border-bottom:0}}
    `;
    document.head.appendChild(style);
  }

  function makeMetric(value, label) {
    const card = document.createElement('div');
    card.className = 'owner-intelligence-metric';
    const valueEl = document.createElement('div');
    valueEl.className = 'owner-intelligence-value';
    valueEl.textContent = value;
    const labelEl = document.createElement('div');
    labelEl.className = 'owner-intelligence-label';
    labelEl.textContent = label;
    card.append(valueEl, labelEl);
    return card;
  }

  function ensureSection() {
    let section = document.getElementById(SECTION_ID);
    if (section) return section;
    section = document.createElement('section');
    section.id = SECTION_ID;
    section.className = 'owner-intelligence-section';
    section.setAttribute('aria-label', 'Owner Intelligence Graph Growth');
    const cognitive = document.getElementById('cognitive');
    if (cognitive?.parentNode) cognitive.parentNode.insertBefore(section, cognitive);
    else document.body.appendChild(section);
    return section;
  }

  function render(context, overlay) {
    if (context?.version !== '0.1-owner-decision-context-runtime') throw new Error('Unexpected owner context version');
    if (overlay?.version !== '0.1-brain-owner-context-overlay') throw new Error('Unexpected owner overlay version');
    if (context?.authority?.executionAuthority !== 'none' || context?.authority?.executable !== false) throw new Error('Owner context authority boundary failed');
    if (overlay?.constraints?.executionAllowed !== false) throw new Error('Owner overlay execution boundary failed');
    if (overlay?.ownerDecisionContext?.contextHash !== context?.contextHash) throw new Error('Owner overlay context hash mismatch');

    const provenance = context.provenance || {};
    const graph = deriveGraphStats(context);
    const total = finiteInt(provenance.totalTeachingUnits);
    const audio = finiteInt(provenance.audioQuestionCount);
    const text = finiteInt(provenance.textTeachingItemCount);
    const sources = finiteInt(provenance.sourceCount);
    const namespaces = safeArray(provenance.teachingNamespaces);

    const section = ensureSection();
    section.replaceChildren();
    const container = document.createElement('div');
    container.className = 'container';
    const heading = document.createElement('div');
    heading.className = 'owner-intelligence-heading';
    heading.innerHTML = '<div class="owner-intelligence-eyebrow">Knowledge Graph Growth · Live</div><h2>Owner Intelligence.</h2><p>Structured owner teaching is compiled beside the evidence-bound Brain. This shows knowledge ingestion and candidate graph growth without pretending that more answers automatically mean higher intelligence.</p>';

    const shell = document.createElement('div');
    shell.className = 'owner-intelligence-shell';
    shell.dataset.health = overlay?.status === 'ready-for-contextual-interpretation' ? 'ready' : 'watch';
    const top = document.createElement('div');
    top.className = 'owner-intelligence-top';
    const identity = document.createElement('div');
    identity.textContent = 'OWNER KNOWLEDGE // PROVENANCE-BOUND DECISION CONTEXT';
    const status = document.createElement('div');
    status.className = 'owner-intelligence-status';
    const dot = document.createElement('span');
    dot.className = 'owner-intelligence-dot';
    const statusText = document.createElement('span');
    statusText.textContent = overlay?.status === 'ready-for-contextual-interpretation' ? 'BOUND TO BRAIN' : 'REVIEW';
    status.append(dot, statusText);
    top.append(identity, status);

    const metrics = document.createElement('div');
    metrics.className = 'owner-intelligence-metrics';
    metrics.append(
      makeMetric(total === null ? '—' : String(total), 'Teaching Units'),
      makeMetric(audio === null ? '—' : String(audio), 'Audio Q'),
      makeMetric(text === null ? '—' : String(text), 'Text Teaching'),
      makeMetric(sources === null ? '—' : String(sources), 'Context Sources'),
      makeMetric(String(graph.metricCandidates), 'Metric Candidates'),
      makeMetric(String(graph.relationshipCandidates), 'Edge Candidates')
    );

    const body = document.createElement('div');
    body.className = 'owner-intelligence-body';
    const copy = document.createElement('div');
    copy.className = 'owner-intelligence-copy';
    const title = document.createElement('strong');
    title.textContent = 'How to read this';
    const p1 = document.createElement('p');
    p1.textContent = 'Teaching units are structured owner context. Metric and edge candidates are measurable possibilities extracted from that context — not live claims until reproducible source and semantics exist.';
    const p2 = document.createElement('p');
    p2.textContent = 'THI remains separate: answer volume does not raise maturity. Capability must improve through evidence, evaluation, decisions, outcomes and durable lessons.';
    copy.append(title, p1, p2);

    const integrity = document.createElement('div');
    integrity.className = 'owner-intelligence-integrity';
    const rows = [
      ['namespaces', namespaces.length ? namespaces.join(' · ') : 'unavailable'],
      ['context', shortHash(context.contextHash)],
      ['brain', shortHash(overlay?.sourceBrain?.snapshotHash)],
      ['authority', 'none'],
      ['as of', String(context.asOf || 'unavailable')]
    ];
    rows.forEach(([label, value]) => {
      const row = document.createElement('div');
      const b = document.createElement('b');
      b.textContent = `${label} · `;
      row.append(b, document.createTextNode(value));
      integrity.appendChild(row);
    });
    body.append(copy, integrity);

    const foot = document.createElement('div');
    foot.className = 'owner-intelligence-foot';
    foot.textContent = 'Read-only · owner teaching ≠ market truth · correlation ≠ causation · candidate metric ≠ tracked metric · execution authority none';
    shell.append(top, metrics, body, foot);
    container.append(heading, shell);
    section.appendChild(container);
  }

  function renderUnavailable(error) {
    const section = ensureSection();
    section.replaceChildren();
    const container = document.createElement('div');
    container.className = 'container';
    const shell = document.createElement('div');
    shell.className = 'owner-intelligence-shell';
    shell.dataset.health = 'watch';
    const top = document.createElement('div');
    top.className = 'owner-intelligence-top';
    top.textContent = 'OWNER INTELLIGENCE // CANONICAL CONTEXT UNAVAILABLE';
    const foot = document.createElement('div');
    foot.className = 'owner-intelligence-foot';
    foot.textContent = 'Fail closed: no fallback teaching counts, metrics or graph relationships are invented.';
    shell.append(top, foot);
    container.appendChild(shell);
    section.appendChild(container);
    console.warn('[The Holding Owner Intelligence] unavailable', error);
  }

  async function readJson(url) {
    const response = await fetch(`${url}?v=${Date.now()}`, { cache: 'no-store', credentials: 'same-origin' });
    if (!response.ok) throw new Error(`${url} HTTP ${response.status}`);
    return response.json();
  }

  async function refresh() {
    if (document.hidden) return;
    try {
      const [context, overlay] = await Promise.all([readJson(CONTEXT_URL), readJson(OVERLAY_URL)]);
      render(context, overlay);
    } catch (error) {
      renderUnavailable(error);
    }
  }

  ensureStyle();
  refresh();
  window.setInterval(refresh, REFRESH_MS);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
})();
