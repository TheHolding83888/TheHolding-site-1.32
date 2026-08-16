(() => {
  'use strict';

  if (typeof document === 'undefined' || typeof window === 'undefined') return;

  const TELEMETRY_URL = '/intelligence/neural-graph/neural-graph-telemetry.json';
  const SECTION_ID = 'neuralMapExplorer';
  const VERSION = '0.1-neural-map-explorer';
  const MAX_NEIGHBORS = 42;
  const MAX_OVERVIEW_NODES = 72;

  const TYPE_META = Object.freeze({
    company: { label: 'Company', fill: '#0a7c4e' },
    protocol: { label: 'Protocol', fill: '#b58b20' },
    strategy: { label: 'Strategy', fill: '#2d5f87' },
    asset: { label: 'Asset', fill: '#6b5f91' },
    metric: { label: 'Metric', fill: '#4b7f8e' },
    'metric-definition': { label: 'Metric', fill: '#4b7f8e' },
    event: { label: 'Event', fill: '#8b6b3e' },
    'brain-case': { label: 'Brain Case', fill: '#40566b' },
    evidence: { label: 'Evidence', fill: '#6f7f86' },
    decision: { label: 'Decision', fill: '#9b5d48' },
    'memory-record': { label: 'Memory', fill: '#6c6f54' },
    'security-finding': { label: 'Security', fill: '#9a4b4b' },
    'owner-context': { label: 'Owner Context', fill: '#a8842c' },
    'coverage-gap': { label: 'Gap', fill: '#8b8b8b' },
    'candidate-metric': { label: 'Candidate', fill: '#b9a86b' },
    entity: { label: 'Entity', fill: '#69777f' }
  });

  const safeObject = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const safeArray = value => Array.isArray(value) ? value : [];
  const esc = value => String(value ?? '');

  let telemetry = null;
  let selectedId = null;
  let showCandidates = false;
  let transform = { x: 0, y: 0, scale: 1 };

  function ensureStyle() {
    if (document.querySelector('style[data-th-neural-map-style]')) return;
    const style = document.createElement('style');
    style.dataset.thNeuralMapStyle = VERSION;
    style.textContent = `
      .nmx-section{padding:.15rem 0 5.5rem}.nmx-heading{max-width:900px;margin:0 auto 1.45rem;text-align:center}.nmx-eyebrow{margin-bottom:.65rem;color:var(--accent-azure,#2d5f87);font:700 .62rem/1.2 'Space Grotesk',sans-serif;letter-spacing:.22em;text-transform:uppercase}.nmx-heading h2{margin:0 0 .68rem;font:300 clamp(2rem,4.4vw,3.05rem)/1.08 'Cormorant Garamond',Georgia,serif;letter-spacing:-.025em}.nmx-heading p{max-width:760px;margin:0 auto;color:var(--text-secondary);font-size:.92rem;line-height:1.68}.nmx-shell{overflow:hidden;border:1px solid rgba(22,21,15,.12);border-radius:20px;background:rgba(255,255,255,.96);box-shadow:0 28px 72px -46px rgba(22,35,45,.36)}.nmx-toolbar{display:flex;align-items:center;justify-content:space-between;gap:.8rem;padding:.75rem .9rem;border-bottom:1px solid rgba(22,21,15,.08)}.nmx-toolbar-left,.nmx-toolbar-right{display:flex;align-items:center;gap:.45rem;flex-wrap:wrap}.nmx-btn{appearance:none;border:1px solid rgba(45,95,135,.15);border-radius:999px;background:#fff;padding:.42rem .65rem;color:#28475d;font:700 .52rem/1 'Space Grotesk',sans-serif;letter-spacing:.06em;text-transform:uppercase;cursor:pointer}.nmx-btn:hover{background:rgba(45,95,135,.05)}.nmx-btn[aria-pressed="true"]{background:rgba(168,132,44,.09);border-color:rgba(168,132,44,.28);color:#80631b}.nmx-mode{color:rgba(22,21,15,.48);font:600 .53rem/1.25 ui-monospace,SFMono-Regular,Menlo,monospace}.nmx-layout{display:grid;grid-template-columns:minmax(0,1.6fr) minmax(270px,.4fr);min-height:540px}.nmx-canvas-wrap{position:relative;min-height:540px;background:radial-gradient(circle at 50% 50%,rgba(45,95,135,.035),transparent 55%),linear-gradient(180deg,#fbfcfd,#f7f8f7);overflow:hidden}.nmx-canvas{width:100%;height:540px;touch-action:none;cursor:grab}.nmx-canvas.is-panning{cursor:grabbing}.nmx-edge{stroke:rgba(55,76,90,.22);stroke-width:1.25;vector-effect:non-scaling-stroke}.nmx-edge.derived{stroke-dasharray:5 4;stroke:rgba(45,95,135,.34)}.nmx-edge.candidate{stroke-dasharray:3 4;stroke:rgba(168,132,44,.4)}.nmx-node{cursor:pointer;transition:opacity .15s ease}.nmx-node circle{stroke:#fff;stroke-width:2;vector-effect:non-scaling-stroke;filter:drop-shadow(0 3px 6px rgba(22,35,45,.15))}.nmx-node text{font:600 10px/1.2 'Space Grotesk',sans-serif;fill:#263743;paint-order:stroke;stroke:#fff;stroke-width:3px;stroke-linejoin:round;pointer-events:none}.nmx-node.selected circle{stroke:#16150f;stroke-width:2.6}.nmx-node.dim{opacity:.28}.nmx-detail{padding:1rem 1.05rem;border-left:1px solid rgba(22,21,15,.08);background:rgba(252,252,250,.92)}.nmx-detail-kicker{color:#2d5f87;font:700 .55rem/1.2 'Space Grotesk',sans-serif;letter-spacing:.12em;text-transform:uppercase}.nmx-detail h3{margin:.45rem 0 .35rem;font:500 1.4rem/1.1 'Cormorant Garamond',Georgia,serif;color:#182a35;overflow-wrap:anywhere}.nmx-type{display:inline-flex;margin-bottom:.8rem;padding:.25rem .45rem;border-radius:999px;background:rgba(45,95,135,.06);color:#45677d;font:700 .48rem/1.2 'Space Grotesk',sans-serif;letter-spacing:.08em;text-transform:uppercase}.nmx-detail-row{padding:.58rem 0;border-top:1px solid rgba(22,21,15,.07)}.nmx-detail-row span{display:block;color:rgba(22,21,15,.42);font:700 .47rem/1.2 'Space Grotesk',sans-serif;letter-spacing:.08em;text-transform:uppercase}.nmx-detail-row strong{display:block;margin-top:.24rem;color:rgba(22,21,15,.72);font:500 .66rem/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;overflow-wrap:anywhere}.nmx-links{margin-top:.2rem}.nmx-link{display:flex;align-items:center;justify-content:space-between;gap:.5rem;width:100%;padding:.48rem 0;border:0;border-top:1px solid rgba(22,21,15,.06);background:transparent;text-align:left;cursor:pointer}.nmx-link b{color:#28475d;font:600 .62rem/1.35 'Space Grotesk',sans-serif;overflow-wrap:anywhere}.nmx-link small{color:rgba(22,21,15,.42);font:600 .47rem/1.2 ui-monospace,SFMono-Regular,Menlo,monospace}.nmx-legend{position:absolute;left:.75rem;bottom:.65rem;display:flex;gap:.42rem;flex-wrap:wrap;max-width:78%;pointer-events:none}.nmx-legend span{display:inline-flex;align-items:center;gap:.28rem;padding:.25rem .4rem;border:1px solid rgba(22,21,15,.08);border-radius:999px;background:rgba(255,255,255,.88);backdrop-filter:blur(5px);color:rgba(22,21,15,.56);font:600 .46rem/1 'Space Grotesk',sans-serif}.nmx-legend i{width:7px;height:7px;border-radius:50%;display:block}.nmx-note{position:absolute;right:.75rem;bottom:.7rem;color:rgba(22,21,15,.38);font:600 .47rem/1.2 ui-monospace,SFMono-Regular,Menlo,monospace}.nmx-foot{padding:.66rem .9rem;border-top:1px solid rgba(22,21,15,.07);color:rgba(22,21,15,.42);font:500 .52rem/1.45 'Space Grotesk',sans-serif}@media(max-width:900px){.nmx-layout{grid-template-columns:1fr}.nmx-detail{border-left:0;border-top:1px solid rgba(22,21,15,.08)}.nmx-canvas-wrap,.nmx-canvas{min-height:500px;height:500px}}@media(max-width:560px){.nmx-shell{border-radius:14px}.nmx-toolbar{align-items:flex-start;flex-direction:column}.nmx-canvas-wrap,.nmx-canvas{min-height:430px;height:430px}.nmx-legend{max-width:94%}.nmx-note{display:none}}
    `;
    document.head.appendChild(style);
  }

  function ensureSection() {
    let section = document.getElementById(SECTION_ID);
    if (section) return section;
    section = document.createElement('section');
    section.id = SECTION_ID;
    section.className = 'nmx-section';
    section.setAttribute('aria-label', 'Interactive Neural Map Explorer');
    const graph = document.getElementById('neuralGraphGrowth');
    const cognitive = document.getElementById('cognitive');
    if (graph?.parentNode) graph.parentNode.insertBefore(section, graph.nextSibling);
    else if (cognitive?.parentNode) cognitive.parentNode.insertBefore(section, cognitive);
    else document.body.appendChild(section);
    return section;
  }

  function catalog() {
    return {
      nodes: safeObject(telemetry?.catalog?.nodes),
      connections: safeObject(telemetry?.catalog?.connections)
    };
  }

  function nodeMeta(node) {
    return TYPE_META[node?.type] || TYPE_META.entity;
  }

  function relevantConnections(nodeId) {
    const all = Object.values(catalog().connections);
    return all.filter(c => c && (c.from === nodeId || c.to === nodeId) && (showCandidates || c.status !== 'candidate'));
  }

  function neighborIds(nodeId) {
    const ids = [];
    for (const edge of relevantConnections(nodeId)) {
      ids.push(edge.from === nodeId ? edge.to : edge.from);
    }
    return [...new Set(ids)].filter(id => catalog().nodes[id]).slice(0, MAX_NEIGHBORS);
  }

  function overviewIds() {
    const nodes = Object.values(catalog().nodes).filter(n => showCandidates || n.status !== 'candidate');
    const preferred = ['company','protocol','strategy','decision','brain-case','owner-context','event'];
    const out = [];
    for (const type of preferred) {
      const group = nodes.filter(n => n.type === type);
      const cap = type === 'company' ? 12 : type === 'strategy' ? 18 : type === 'event' ? 10 : 8;
      out.push(...group.slice(0, cap).map(n => n.id));
      if (out.length >= MAX_OVERVIEW_NODES) break;
    }
    return [...new Set(out)].slice(0, MAX_OVERVIEW_NODES);
  }

  function graphSelection() {
    const nodes = catalog().nodes;
    if (!selectedId || !nodes[selectedId]) {
      const ids = overviewIds();
      const idSet = new Set(ids);
      const edges = Object.values(catalog().connections).filter(c => c && idSet.has(c.from) && idSet.has(c.to) && (showCandidates || c.status !== 'candidate'));
      return { mode: 'overview', ids, edges };
    }
    const ids = [selectedId, ...neighborIds(selectedId)];
    const idSet = new Set(ids);
    const edges = Object.values(catalog().connections).filter(c => c && idSet.has(c.from) && idSet.has(c.to) && (showCandidates || c.status !== 'candidate'));
    return { mode: 'neighborhood', ids, edges };
  }

  function layout(selection, width, height) {
    const nodes = catalog().nodes;
    const positions = new Map();
    const cx = width / 2;
    const cy = height / 2;
    if (selection.mode === 'neighborhood') {
      positions.set(selectedId, { x: cx, y: cy, r: 17 });
      const neighbors = selection.ids.filter(id => id !== selectedId);
      const rings = neighbors.length > 22 ? 2 : 1;
      neighbors.forEach((id, i) => {
        const ring = rings === 2 && i >= Math.ceil(neighbors.length / 2) ? 1 : 0;
        const ringItems = ring === 0 ? Math.min(neighbors.length, Math.ceil(neighbors.length / 2)) : neighbors.length - Math.ceil(neighbors.length / 2);
        const localIndex = ring === 0 ? i : i - Math.ceil(neighbors.length / 2);
        const radius = ring === 0 ? Math.min(width, height) * .28 : Math.min(width, height) * .43;
        const angle = (Math.PI * 2 * localIndex / Math.max(1, ringItems)) - Math.PI / 2;
        positions.set(id, { x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius, r: 10 });
      });
      return positions;
    }

    const byType = new Map();
    for (const id of selection.ids) {
      const type = nodes[id]?.type || 'entity';
      if (!byType.has(type)) byType.set(type, []);
      byType.get(type).push(id);
    }
    const groups = [...byType.entries()];
    groups.forEach(([type, ids], gi) => {
      const baseAngle = (Math.PI * 2 * gi / Math.max(1, groups.length)) - Math.PI / 2;
      const gcx = cx + Math.cos(baseAngle) * Math.min(width, height) * .24;
      const gcy = cy + Math.sin(baseAngle) * Math.min(width, height) * .24;
      ids.forEach((id, i) => {
        const radius = ids.length > 1 ? Math.min(78, 24 + ids.length * 2.5) : 0;
        const angle = Math.PI * 2 * i / Math.max(1, ids.length);
        positions.set(id, { x: gcx + Math.cos(angle) * radius, y: gcy + Math.sin(angle) * radius, r: type === 'company' ? 13 : 9 });
      });
    });
    return positions;
  }

  function shortLabel(node) {
    const text = esc(node?.label || node?.id || 'node');
    return text.length > 22 ? `${text.slice(0, 20)}…` : text;
  }

  function svgEl(tag, attrs = {}) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    Object.entries(attrs).forEach(([k,v]) => el.setAttribute(k, String(v)));
    return el;
  }

  function renderCanvas(svg, detail) {
    const rect = svg.getBoundingClientRect();
    const width = Math.max(640, rect.width || 900);
    const height = Math.max(430, rect.height || 540);
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.replaceChildren();

    const selection = graphSelection();
    const positions = layout(selection, width, height);
    const root = svgEl('g', { transform: `translate(${transform.x} ${transform.y}) scale(${transform.scale})` });
    root.dataset.graphRoot = '1';

    for (const edge of selection.edges) {
      const a = positions.get(edge.from); const b = positions.get(edge.to);
      if (!a || !b) continue;
      const line = svgEl('line', { x1:a.x, y1:a.y, x2:b.x, y2:b.y });
      line.classList.add('nmx-edge');
      if (edge.status === 'candidate') line.classList.add('candidate');
      else if (edge.epistemicClass === 'derived') line.classList.add('derived');
      const title = svgEl('title');
      title.textContent = `${edge.kind} · ${edge.epistemicClass || edge.status || 'direct'}`;
      line.appendChild(title);
      root.appendChild(line);
    }

    for (const id of selection.ids) {
      const node = catalog().nodes[id]; const p = positions.get(id);
      if (!node || !p) continue;
      const meta = nodeMeta(node);
      const group = svgEl('g', { transform:`translate(${p.x} ${p.y})`, tabindex:'0', role:'button', 'aria-label':`${meta.label}: ${node.label}` });
      group.classList.add('nmx-node');
      if (id === selectedId) group.classList.add('selected');
      const circle = svgEl('circle', { r:p.r, fill:meta.fill, opacity: node.status === 'candidate' ? .68 : .94 });
      const label = svgEl('text', { x:0, y:p.r + 14, 'text-anchor':'middle' });
      label.textContent = shortLabel(node);
      const title = svgEl('title');
      title.textContent = `${meta.label} · ${node.label}\n${node.id}`;
      group.append(circle, label, title);
      const activate = () => { selectedId = id; transform = { x:0, y:0, scale:1 }; renderCanvas(svg, detail); renderDetail(detail); };
      group.addEventListener('click', activate);
      group.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(); } });
      root.appendChild(group);
    }

    svg.appendChild(root);
    const mode = document.querySelector('#neuralMapExplorer .nmx-mode');
    if (mode) mode.textContent = selection.mode === 'overview' ? `${selection.ids.length} visible nodes · click to explore` : `${selection.ids.length - 1} direct neighbors · click a neighbor to travel`;
  }

  function renderDetail(detail) {
    const nodes = catalog().nodes;
    const node = selectedId ? nodes[selectedId] : null;
    detail.replaceChildren();
    const kicker = document.createElement('div'); kicker.className = 'nmx-detail-kicker'; kicker.textContent = node ? 'Selected neuron' : 'Map navigation';
    const h3 = document.createElement('h3'); h3.textContent = node?.label || 'Explore the graph';
    const type = document.createElement('div'); type.className = 'nmx-type'; type.textContent = node ? nodeMeta(node).label : 'Overview';
    detail.append(kicker, h3, type);

    if (!node) {
      const row = document.createElement('div'); row.className='nmx-detail-row';
      const s=document.createElement('span'); s.textContent='How it works';
      const strong=document.createElement('strong'); strong.textContent='Click any node to center it and reveal its direct neighborhood. Scroll to zoom; drag to pan. Candidate links can be toggled separately.';
      row.append(s,strong); detail.appendChild(row); return;
    }

    const edges = relevantConnections(node.id);
    const provenance = safeObject(node.provenance);
    const rows = [
      ['Canonical ID', node.id],
      ['Status', node.status || 'established'],
      ['Connections', String(edges.length)],
      ['Source', provenance.source || 'canonical graph'],
      ['Authority', provenance.authority || (node.type === 'owner-context' ? 'context-only' : 'source-bound')]
    ];
    rows.forEach(([label,value]) => { const row=document.createElement('div'); row.className='nmx-detail-row'; const s=document.createElement('span'); s.textContent=label; const strong=document.createElement('strong'); strong.textContent=esc(value); row.append(s,strong); detail.appendChild(row); });

    const links = document.createElement('div'); links.className='nmx-links';
    edges.slice(0,18).forEach(edge => {
      const otherId = edge.from === node.id ? edge.to : edge.from;
      const other = nodes[otherId]; if (!other) return;
      const btn=document.createElement('button'); btn.type='button'; btn.className='nmx-link';
      const b=document.createElement('b'); b.textContent=shortLabel(other);
      const small=document.createElement('small'); small.textContent=`${edge.kind} · ${edge.epistemicClass || edge.status}`;
      btn.append(b,small); btn.addEventListener('click',()=>{ selectedId=otherId; transform={x:0,y:0,scale:1}; const svg=document.querySelector('#neuralMapExplorer .nmx-canvas'); if(svg){renderCanvas(svg,detail);renderDetail(detail);} });
      links.appendChild(btn);
    });
    if (links.children.length) detail.appendChild(links);
  }

  function bindPanZoom(svg, detail) {
    let dragging = false, sx = 0, sy = 0, ox = 0, oy = 0;
    svg.addEventListener('wheel', e => {
      e.preventDefault();
      const next = Math.min(2.4, Math.max(.55, transform.scale * (e.deltaY < 0 ? 1.12 : .9)));
      transform.scale = next; renderCanvas(svg, detail);
    }, { passive:false });
    svg.addEventListener('pointerdown', e => { if (e.target.closest?.('.nmx-node')) return; dragging=true; sx=e.clientX; sy=e.clientY; ox=transform.x; oy=transform.y; svg.setPointerCapture?.(e.pointerId); svg.classList.add('is-panning'); });
    svg.addEventListener('pointermove', e => { if(!dragging) return; transform.x=ox+(e.clientX-sx); transform.y=oy+(e.clientY-sy); const root=svg.querySelector('[data-graph-root]'); if(root) root.setAttribute('transform',`translate(${transform.x} ${transform.y}) scale(${transform.scale})`); });
    const end = e => { dragging=false; svg.releasePointerCapture?.(e.pointerId); svg.classList.remove('is-panning'); };
    svg.addEventListener('pointerup',end); svg.addEventListener('pointercancel',end);
  }

  function render() {
    if (telemetry?.version !== '0.1-neural-graph-telemetry') throw new Error('Unexpected Neural Graph telemetry');
    if (telemetry?.authority?.executionAuthority !== 'none') throw new Error('Neural Graph authority boundary failed');

    const section=ensureSection(); section.replaceChildren();
    const container=document.createElement('div'); container.className='container';
    const heading=document.createElement('div'); heading.className='nmx-heading';
    const eyebrow=document.createElement('div'); eyebrow.className='nmx-eyebrow'; eyebrow.textContent='Interactive Knowledge Topology · Live';
    const h2=document.createElement('h2'); h2.textContent='Neural Map.';
    const intro=document.createElement('p'); intro.textContent='A navigable view of the same canonical neurons and neural connections counted by Brain Growth. The map intentionally opens as a readable subgraph rather than dumping the entire knowledge graph into one spaghetti diagram.';
    heading.append(eyebrow,h2,intro);

    const shell=document.createElement('div'); shell.className='nmx-shell';
    const toolbar=document.createElement('div'); toolbar.className='nmx-toolbar';
    const left=document.createElement('div'); left.className='nmx-toolbar-left';
    const overview=document.createElement('button'); overview.type='button'; overview.className='nmx-btn'; overview.textContent='Overview';
    const reset=document.createElement('button'); reset.type='button'; reset.className='nmx-btn'; reset.textContent='Reset view';
    const candidates=document.createElement('button'); candidates.type='button'; candidates.className='nmx-btn'; candidates.textContent='Candidates'; candidates.setAttribute('aria-pressed',String(showCandidates));
    left.append(overview,reset,candidates);
    const right=document.createElement('div'); right.className='nmx-toolbar-right'; const mode=document.createElement('div'); mode.className='nmx-mode'; mode.textContent='loading topology'; right.appendChild(mode); toolbar.append(left,right);

    const layout=document.createElement('div'); layout.className='nmx-layout';
    const wrap=document.createElement('div'); wrap.className='nmx-canvas-wrap';
    const svg=svgEl('svg',{class:'nmx-canvas','aria-label':'Interactive neural graph map'});
    const legend=document.createElement('div'); legend.className='nmx-legend';
    [['Company','#0a7c4e'],['Protocol','#b58b20'],['Strategy','#2d5f87'],['Metric','#4b7f8e'],['Owner','#a8842c'],['Other','#69777f']].forEach(([label,color])=>{const span=document.createElement('span');const i=document.createElement('i');i.style.background=color;span.append(i,document.createTextNode(label));legend.appendChild(span);});
    const note=document.createElement('div'); note.className='nmx-note'; note.textContent='scroll · zoom  /  drag · pan';
    wrap.append(svg,legend,note);
    const detail=document.createElement('aside'); detail.className='nmx-detail';
    layout.append(wrap,detail);
    const foot=document.createElement('div'); foot.className='nmx-foot'; foot.textContent='Established edges are solid/direct or dashed/derived. Candidate links are optional and never imply causation. Map navigation is read-only; execution authority remains none.';
    shell.append(toolbar,layout,foot); container.append(heading,shell); section.appendChild(container);

    overview.addEventListener('click',()=>{selectedId=null;transform={x:0,y:0,scale:1};renderCanvas(svg,detail);renderDetail(detail);});
    reset.addEventListener('click',()=>{transform={x:0,y:0,scale:1};renderCanvas(svg,detail);});
    candidates.addEventListener('click',()=>{showCandidates=!showCandidates;candidates.setAttribute('aria-pressed',String(showCandidates));renderCanvas(svg,detail);renderDetail(detail);});
    bindPanZoom(svg,detail); renderCanvas(svg,detail); renderDetail(detail);
  }

  async function load() {
    const response=await fetch(`${TELEMETRY_URL}?v=${Date.now()}`,{cache:'no-store',credentials:'same-origin'});
    if(!response.ok) throw new Error(`${TELEMETRY_URL} HTTP ${response.status}`);
    telemetry=await response.json(); render();
  }

  ensureStyle();
  load().catch(error=>console.warn('[The Holding Neural Map]',error));
})();
