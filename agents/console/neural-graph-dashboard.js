(() => {
  'use strict';

  if (typeof document === 'undefined' || typeof window === 'undefined') return;

  const TELEMETRY_URL = '/intelligence/neural-graph/neural-graph-telemetry.json';
  const REFRESH_MS = 60_000;
  const SECTION_ID = 'neuralGraphGrowth';
  const VERSION = '0.1-neural-graph-dashboard';

  const safeObject = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const finiteInt = value => Number.isInteger(Number(value)) && Number(value) >= 0 ? Number(value) : null;
  const fmt = value => finiteInt(value) === null ? '—' : Number(value).toLocaleString('en-US');
  const shortHash = value => typeof value === 'string' && value ? `${value.slice(0, 10)}…${value.slice(-8)}` : 'unavailable';

  function ensureStyle() {
    if (document.querySelector('style[data-th-neural-graph-style]')) return;
    const style = document.createElement('style');
    style.dataset.thNeuralGraphStyle = VERSION;
    style.textContent = `
      .ng-section{padding:.2rem 0 5.5rem}.ng-heading{max-width:900px;margin:0 auto 1.6rem;text-align:center}.ng-eyebrow{margin-bottom:.68rem;color:var(--accent-azure,#2d5f87);font:700 .63rem/1.2 'Space Grotesk',sans-serif;letter-spacing:.22em;text-transform:uppercase}.ng-heading h2{margin:0 0 .72rem;font:300 clamp(2rem,4.4vw,3.15rem)/1.08 'Cormorant Garamond',Georgia,serif;letter-spacing:-.025em}.ng-heading p{max-width:750px;margin:0 auto;color:var(--text-secondary);font-size:.94rem;font-weight:300;line-height:1.7}.ng-shell{overflow:hidden;border:1px solid rgba(25,41,53,.13);border-radius:20px;background:linear-gradient(180deg,rgba(255,255,255,.97),rgba(244,248,251,.9));box-shadow:0 28px 72px -44px rgba(26,55,75,.4)}.ng-top{display:flex;align-items:center;justify-content:space-between;gap:1rem;padding:.82rem 1rem;border-bottom:1px solid rgba(25,41,53,.08);font:600 .57rem/1.25 ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;letter-spacing:.095em;text-transform:uppercase;color:rgba(25,41,53,.5)}.ng-status{display:flex;align-items:center;gap:.45rem;color:#42667f}.ng-dot{width:7px;height:7px;border-radius:50%;background:#7891a2}.ng-shell[data-health="ready"] .ng-dot{background:#0a7c4e;box-shadow:0 0 0 4px rgba(10,124,78,.06)}.ng-primary{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));border-bottom:1px solid rgba(25,41,53,.08)}.ng-card{position:relative;min-width:0;padding:1.02rem .88rem;border-right:1px solid rgba(25,41,53,.07)}.ng-card:last-child{border-right:0}.ng-value{color:#1f4463;font:500 1.45rem/1.08 'Cormorant Garamond',Georgia,serif;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}.ng-label{display:flex;align-items:center;gap:.3rem;margin-top:.37rem;color:rgba(25,41,53,.48);font:700 .48rem/1.32 'Space Grotesk',sans-serif;letter-spacing:.1em;text-transform:uppercase}.ng-info{display:inline-flex;align-items:center;justify-content:center;width:14px;height:14px;border:1px solid rgba(45,95,135,.25);border-radius:50%;color:#56788f;font:700 9px/1 sans-serif;cursor:help}.ng-activity{margin-top:.32rem;color:rgba(25,41,53,.46);font:500 .52rem/1.4 ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;white-space:nowrap}.ng-body{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,.85fr)}.ng-breakdown{padding:1.05rem 1.1rem;border-right:1px solid rgba(25,41,53,.07)}.ng-side{padding:1.05rem 1.1rem}.ng-kicker{margin-bottom:.62rem;color:#1f4463;font:700 .57rem/1.2 'Space Grotesk',sans-serif;letter-spacing:.11em;text-transform:uppercase}.ng-chips{display:flex;flex-wrap:wrap;gap:.42rem}.ng-chip{display:inline-flex;align-items:center;gap:.35rem;padding:.38rem .52rem;border:1px solid rgba(45,95,135,.13);border-radius:999px;background:rgba(45,95,135,.035);color:rgba(25,41,53,.64);font:600 .53rem/1.2 'Space Grotesk',sans-serif}.ng-chip b{color:#1f4463;font-weight:700;font-variant-numeric:tabular-nums}.ng-explain{margin-top:.86rem;color:rgba(25,41,53,.62);font-size:.69rem;line-height:1.62}.ng-explain p{margin:0}.ng-explain p+p{margin-top:.42rem}.ng-quality{display:grid;grid-template-columns:1fr 1fr;gap:.55rem}.ng-quality-card{padding:.68rem .72rem;border:1px solid rgba(25,41,53,.08);border-radius:12px;background:rgba(255,255,255,.55)}.ng-quality-card span{display:block;color:rgba(25,41,53,.44);font:700 .47rem/1.2 'Space Grotesk',sans-serif;letter-spacing:.095em;text-transform:uppercase}.ng-quality-card strong{display:block;margin-top:.28rem;color:#1f4463;font:500 1rem/1.2 'Cormorant Garamond',Georgia,serif}.ng-integrity{margin-top:.75rem;color:rgba(25,41,53,.45);font:500 .52rem/1.5 ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;overflow-wrap:anywhere}.ng-foot{padding:.7rem 1rem;border-top:1px solid rgba(25,41,53,.07);color:rgba(25,41,53,.43);font:500 .53rem/1.48 'Space Grotesk',sans-serif;letter-spacing:.025em}@media(max-width:980px){.ng-primary{grid-template-columns:repeat(3,minmax(0,1fr))}.ng-card:nth-child(3){border-right:0}.ng-card:nth-child(-n+3){border-bottom:1px solid rgba(25,41,53,.07)}.ng-body{grid-template-columns:1fr}.ng-breakdown{border-right:0;border-bottom:1px solid rgba(25,41,53,.07)}}@media(max-width:560px){.ng-section{padding-bottom:4.2rem}.ng-shell{border-radius:14px}.ng-top{align-items:flex-start;flex-direction:column}.ng-primary{grid-template-columns:repeat(2,minmax(0,1fr))}.ng-card,.ng-card:nth-child(3){border-right:1px solid rgba(25,41,53,.07);border-bottom:1px solid rgba(25,41,53,.07)}.ng-card:nth-child(2n){border-right:0}.ng-card:nth-last-child(-n+2){border-bottom:0}.ng-quality{grid-template-columns:1fr 1fr}.ng-activity{white-space:normal}}
    `;
    document.head.appendChild(style);
  }

  function info(title) {
    const el = document.createElement('span');
    el.className = 'ng-info';
    el.textContent = '?';
    el.title = title;
    el.setAttribute('aria-label', title);
    return el;
  }

  function metricCard(value, label, tooltip, activity = null) {
    const card = document.createElement('div');
    card.className = 'ng-card';
    const valueEl = document.createElement('div');
    valueEl.className = 'ng-value';
    valueEl.textContent = value;
    const labelEl = document.createElement('div');
    labelEl.className = 'ng-label';
    labelEl.append(document.createTextNode(label), info(tooltip));
    card.append(valueEl, labelEl);
    if (activity) {
      const activityEl = document.createElement('div');
      activityEl.className = 'ng-activity';
      activityEl.textContent = activity;
      card.appendChild(activityEl);
    }
    return card;
  }

  function activityText(activity, kind) {
    if (activity?.mode !== 'activity') return '24h · baseline warming';
    const x = safeObject(activity?.[kind]);
    return `24h · +${finiteInt(x.added) ?? 0}  ~${finiteInt(x.updated) ?? 0}  −${finiteInt(x.removed) ?? 0}`;
  }

  function ensureSection() {
    let section = document.getElementById(SECTION_ID);
    if (section) return section;
    section = document.createElement('section');
    section.id = SECTION_ID;
    section.className = 'ng-section';
    section.setAttribute('aria-label', 'Neural Graph Brain Growth');

    // Keep owner-specific teaching telemetry and whole-OS graph telemetry adjacent.
    const owner = document.getElementById('ownerIntelligenceGrowth');
    const cognitive = document.getElementById('cognitive');
    if (owner?.parentNode) owner.parentNode.insertBefore(section, owner.nextSibling);
    else if (cognitive?.parentNode) cognitive.parentNode.insertBefore(section, cognitive);
    else document.body.appendChild(section);
    return section;
  }

  function chip(label, value) {
    const el = document.createElement('span');
    el.className = 'ng-chip';
    const text = document.createElement('span');
    text.textContent = label;
    const count = document.createElement('b');
    count.textContent = fmt(value);
    el.append(text, count);
    return el;
  }

  function render(telemetry) {
    if (telemetry?.version !== '0.1-neural-graph-telemetry') throw new Error('Unexpected Neural Graph version');
    if (telemetry?.authority?.executionAuthority !== 'none' || telemetry?.authority?.readOnly !== true) throw new Error('Neural Graph authority boundary failed');

    const totals = safeObject(telemetry.totals);
    const nodeTypes = safeObject(totals.nodeTypes);
    const epistemic = safeObject(totals.epistemicClasses);
    const activity = safeObject(telemetry.activity24h);

    const section = ensureSection();
    section.replaceChildren();
    const container = document.createElement('div');
    container.className = 'container';

    const heading = document.createElement('div');
    heading.className = 'ng-heading';
    const eyebrow = document.createElement('div');
    eyebrow.className = 'ng-eyebrow';
    eyebrow.textContent = 'Brain Growth · Live Instrument';
    const h2 = document.createElement('h2');
    h2.textContent = 'Neural Graph.';
    const intro = document.createElement('p');
    intro.textContent = 'A compact view of how The Holding accumulates reusable knowledge and links it together. Neurons are not only metrics; they can be companies, protocols, strategies, events, decisions, memory, security findings and other canonical knowledge nodes.';
    heading.append(eyebrow, h2, intro);

    const shell = document.createElement('div');
    shell.className = 'ng-shell';
    shell.dataset.health = telemetry.status === 'ok' ? 'ready' : 'watch';
    const top = document.createElement('div');
    top.className = 'ng-top';
    const identity = document.createElement('div');
    identity.textContent = 'THE HOLDING // KNOWLEDGE GRAPH TELEMETRY';
    const status = document.createElement('div');
    status.className = 'ng-status';
    const dot = document.createElement('span');
    dot.className = 'ng-dot';
    const statusText = document.createElement('span');
    statusText.textContent = telemetry.status === 'ok' ? 'CANONICAL / READ-ONLY' : 'REVIEW';
    status.append(dot, statusText);
    top.append(identity, status);

    const primary = document.createElement('div');
    primary.className = 'ng-primary';
    primary.append(
      metricCard(fmt(totals.neurons), 'Neurons', telemetry.semantics?.neuron || 'Established reusable knowledge nodes.', activityText(activity, 'neurons')),
      metricCard(fmt(totals.neuralConnections), 'Neural Connections', telemetry.semantics?.neuralConnection || 'Established provenance-aware relationships.', activityText(activity, 'connections')),
      metricCard(fmt(totals.candidateNeurons), 'Candidate Neurons', 'Potentially useful knowledge nodes discovered from context or architecture. They are not counted as established knowledge until source and semantics are verified.'),
      metricCard(fmt(totals.candidateConnections), 'Candidate Connections', 'Potential relationships that remain candidate, derived, owner-reported or hypothesized until their evidence class supports promotion.'),
      metricCard(fmt(nodeTypes.metric), 'Tracked Metric Nodes', 'Canonical metric instances that already exist in current machine-readable sources. This is narrower than all possible metric candidates.'),
      metricCard(fmt(nodeTypes['coverage-gap']), 'Explicit Gaps', 'Known missing capabilities or data coverage. A gap is a useful neuron because the system explicitly knows what it does not know.')
    );

    const body = document.createElement('div');
    body.className = 'ng-body';
    const breakdown = document.createElement('div');
    breakdown.className = 'ng-breakdown';
    const bk = document.createElement('div');
    bk.className = 'ng-kicker';
    bk.textContent = 'Neuron map';
    const chips = document.createElement('div');
    chips.className = 'ng-chips';
    const labels = [
      ['Companies', 'company'], ['Protocols', 'protocol'], ['Strategies', 'strategy'], ['Assets', 'asset'],
      ['Metrics', 'metric'], ['Events', 'event'], ['Brain Cases', 'brain-case'], ['Evidence', 'evidence'],
      ['Decisions', 'decision'], ['Memory', 'memory-record'], ['Security', 'security-finding'],
      ['Owner Context', 'owner-context'], ['Gaps', 'coverage-gap']
    ];
    for (const [label, key] of labels) if (finiteInt(nodeTypes[key]) !== null) chips.appendChild(chip(label, nodeTypes[key]));

    const explain = document.createElement('div');
    explain.className = 'ng-explain';
    const p1 = document.createElement('p');
    p1.textContent = 'Owner teaching is one source among many. It can create context or candidate metrics, but it does not automatically become market truth, a tracked metric, or a causal connection.';
    const p2 = document.createElement('p');
    p2.textContent = 'A neuron may stay the same identity while its state changes. That counts as an update, so the panel can show brain activity even when the total number of neurons does not increase.';
    explain.append(p1, p2);
    breakdown.append(bk, chips, explain);

    const side = document.createElement('div');
    side.className = 'ng-side';
    const qk = document.createElement('div');
    qk.className = 'ng-kicker';
    qk.textContent = 'Connection quality';
    const quality = document.createElement('div');
    quality.className = 'ng-quality';
    const qualityRows = [
      ['Direct', epistemic.direct],
      ['Derived', epistemic.derived],
      ['Candidate', totals.candidateConnections],
      ['24h snapshots', activity?.mode === 'activity' ? activity.snapshotCount : null]
    ];
    for (const [label, value] of qualityRows) {
      const card = document.createElement('div');
      card.className = 'ng-quality-card';
      const span = document.createElement('span');
      span.textContent = label;
      const strong = document.createElement('strong');
      strong.textContent = value === null || value === undefined ? (label === '24h snapshots' ? 'warming' : '—') : fmt(value);
      card.append(span, strong);
      quality.appendChild(card);
    }
    const integrity = document.createElement('div');
    integrity.className = 'ng-integrity';
    integrity.textContent = `snapshot ${String(telemetry.generatedAt || 'unavailable')} · graph ${shortHash(telemetry.integrity?.telemetryHash)} · authority none`;
    side.append(qk, quality, integrity);
    body.append(breakdown, side);

    const foot = document.createElement('div');
    foot.className = 'ng-foot';
    foot.textContent = 'Established knowledge ≠ candidate knowledge · correlation ≠ causation · owner context ≠ market fact · graph growth ≠ THI · execution authority none';

    shell.append(top, primary, body, foot);
    container.append(heading, shell);
    section.appendChild(container);
  }

  function renderUnavailable(error) {
    const section = ensureSection();
    section.replaceChildren();
    const container = document.createElement('div');
    container.className = 'container';
    const shell = document.createElement('div');
    shell.className = 'ng-shell';
    shell.dataset.health = 'watch';
    const top = document.createElement('div');
    top.className = 'ng-top';
    top.textContent = 'NEURAL GRAPH // CANONICAL TELEMETRY UNAVAILABLE';
    const foot = document.createElement('div');
    foot.className = 'ng-foot';
    foot.textContent = 'Fail closed: neuron counts, connection counts and daily growth are never guessed in the browser.';
    shell.append(top, foot);
    container.appendChild(shell);
    section.appendChild(container);
    console.warn('[The Holding Neural Graph]', error);
  }

  async function readJson() {
    const response = await fetch(`${TELEMETRY_URL}?v=${Date.now()}`, { cache: 'no-store', credentials: 'same-origin' });
    if (!response.ok) throw new Error(`${TELEMETRY_URL} HTTP ${response.status}`);
    return response.json();
  }

  async function refresh() {
    if (document.hidden) return;
    try { render(await readJson()); }
    catch (error) { renderUnavailable(error); }
  }

  ensureStyle();
  refresh();
  window.setInterval(refresh, REFRESH_MS);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
})();
