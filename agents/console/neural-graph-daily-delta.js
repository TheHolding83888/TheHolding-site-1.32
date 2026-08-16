(() => {
  'use strict';

  if (typeof document === 'undefined' || typeof window === 'undefined') return;

  const CURRENT_URL = '/intelligence/neural-graph/neural-graph-telemetry.json';
  const HISTORY_URL = '/intelligence/neural-graph/neural-graph-history.json';
  const VERSION = '0.1-neural-graph-daily-delta';
  const DAY_MS = 24 * 60 * 60 * 1000;

  function ensureStyle() {
    if (document.querySelector('style[data-th-neural-delta-style]')) return;
    const style = document.createElement('style');
    style.dataset.thNeuralDeltaStyle = VERSION;
    style.textContent = `
      .ng-daydelta{display:inline-flex;align-items:center;gap:.25rem;margin-top:.3rem;padding:.18rem .35rem;border-radius:999px;background:rgba(22,21,15,.035);color:rgba(22,21,15,.48);font:700 .45rem/1.2 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.02em}.ng-daydelta.up{background:rgba(10,124,78,.065);color:#0a7c4e}.ng-daydelta.down{background:rgba(150,72,72,.065);color:#8e4c4c}.ng-daydelta.flat{color:rgba(22,21,15,.42)}.ng-daydelta.warming{color:rgba(22,21,15,.36)}
    `;
    document.head.appendChild(style);
  }

  const finite = value => Number.isFinite(Number(value)) ? Number(value) : null;

  function nearestDailyBaseline(current, snapshots) {
    const now = Date.parse(current?.generatedAt || '');
    if (!Number.isFinite(now)) return null;
    const eligible = snapshots
      .filter(s => Number.isFinite(Date.parse(s?.generatedAt || '')) && now - Date.parse(s.generatedAt) >= DAY_MS * .8)
      .sort((a,b) => Date.parse(b.generatedAt) - Date.parse(a.generatedAt));
    return eligible[0] || null;
  }

  function pct(delta, prior) {
    if (!Number.isFinite(prior) || prior === 0) return null;
    return delta / Math.abs(prior) * 100;
  }

  function textFor(current, prior, includePct) {
    const a = finite(current); const b = finite(prior);
    if (a === null || b === null) return null;
    const d = a - b;
    if (d === 0) return { text: 'vs day · no change', cls: 'flat' };
    const sign = d > 0 ? '+' : '−';
    const abs = Math.abs(d).toLocaleString('en-US', { maximumFractionDigits: 2 });
    const p = includePct ? pct(d,b) : null;
    const tail = p === null ? '' : ` · ${p > 0 ? '+' : '−'}${Math.abs(p).toFixed(Math.abs(p) >= 10 ? 1 : 2)}%`;
    return { text: `vs day · ${sign}${abs}${tail}`, cls: d > 0 ? 'up' : 'down' };
  }

  function badge(payload) {
    const el = document.createElement('div');
    el.className = `ng-daydelta ${payload?.cls || 'warming'}`;
    el.textContent = payload?.text || 'daily comparison warming';
    el.title = payload?.title || 'Compared with the nearest canonical Neural Graph snapshot approximately one day earlier.';
    return el;
  }

  function findCard(label) {
    return [...document.querySelectorAll('#neuralGraphGrowth .ng-card')].find(card => card.querySelector('.ng-label')?.textContent?.trim().startsWith(label));
  }

  async function readJson(url) {
    const r = await fetch(`${url}?v=${Date.now()}`, { cache:'no-store', credentials:'same-origin' });
    if (!r.ok) throw new Error(`${url} HTTP ${r.status}`);
    return r.json();
  }

  async function apply() {
    const [current, history] = await Promise.all([readJson(CURRENT_URL), readJson(HISTORY_URL)]);
    if (current?.version !== '0.1-neural-graph-telemetry' || history?.version !== '0.1-neural-graph-history') throw new Error('Unexpected Neural Graph daily comparison source');
    const baseline = nearestDailyBaseline(current, Array.isArray(history.snapshots) ? history.snapshots : []);

    const specs = [
      ['Neurons', current?.totals?.neurons, baseline?.totals?.neurons, true],
      ['Neural Connections', current?.totals?.neuralConnections, baseline?.totals?.connections, true],
      ['Candidate Neurons', current?.totals?.candidateNeurons, baseline?.totals?.candidateNeurons, true],
      ['Candidate Connections', current?.totals?.candidateConnections, baseline?.totals?.candidateConnections, false]
    ];

    for (const [label, cur, prev, includePct] of specs) {
      const card = findCard(label); if (!card) continue;
      card.querySelector('.ng-daydelta')?.remove();
      const payload = baseline ? textFor(cur, prev, includePct) : { text:'daily comparison warming', cls:'warming', title:'A true day-over-day badge appears after a prior canonical snapshot exists roughly one day earlier.' };
      card.appendChild(badge(payload));
    }
  }

  ensureStyle();
  const wait = () => {
    if (document.getElementById('neuralGraphGrowth')) apply().catch(e => console.warn('[The Holding Neural Daily Delta]',e));
    else window.setTimeout(wait,120);
  };
  wait();
})();
