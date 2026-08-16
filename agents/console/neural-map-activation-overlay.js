(() => {
  'use strict';

  if (typeof document === 'undefined' || typeof window === 'undefined') return;

  const QUALITY_URL = '/intelligence/neural-graph/neural-graph-quality.json';
  const SECTION_ID = 'neuralMapExplorer';
  const VERSION = '0.2-neural-map-activation-overlay';
  const MAX_OVERLAY_NEIGHBORS = 18;

  const TYPE_META = Object.freeze({
    'context-domain': { label: 'Context Domain', fill: '#8d762e' },
    capability: { label: 'Capability', fill: '#2d7a63' },
    'coverage-gap': { label: 'Architecture Gap', fill: '#9a5d4b' },
    'code-surface': { label: 'Code Surface', fill: '#6d667f' },
    'architecture-demand': { label: 'Architecture Demand', fill: '#8b8b8b' },
    'candidate-metric': { label: 'Candidate', fill: '#b9a86b' },
    'memory-record': { label: 'Memory', fill: '#6c6f54' },
    entity: { label: 'Overlay Node', fill: '#69777f' }
  });

  const safeObject = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const esc = value => String(value ?? '');

  let quality = null;
  let overlayFocusId = null;
  let scheduled = false;

  function ensureStyle() {
    if (document.querySelector('style[data-th-neural-map-activation-overlay]')) return;
    const style = document.createElement('style');
    style.dataset.thNeuralMapActivationOverlay = VERSION;
    style.textContent = `
      .nmx-activation-edge{stroke:rgba(164,112,55,.58);stroke-width:1.45;stroke-dasharray:2.5 3.5;vector-effect:non-scaling-stroke}
      .nmx-activation-edge.direct{stroke-dasharray:none;stroke:rgba(45,122,99,.62)}
      .nmx-activation-node{cursor:pointer}
      .nmx-activation-node circle{stroke:#fff;stroke-width:2;vector-effect:non-scaling-stroke;filter:drop-shadow(0 3px 6px rgba(22,35,45,.18))}
      .nmx-activation-node text{font:700 9px/1.2 'Space Grotesk',sans-serif;fill:#31424c;paint-order:stroke;stroke:#fff;stroke-width:3px;stroke-linejoin:round;pointer-events:none}
      .nmx-activation-chip{display:inline-flex;align-items:center;gap:.28rem;margin:.45rem 0 .2rem;padding:.28rem .48rem;border-radius:999px;background:rgba(168,132,44,.09);color:#7b631d;font:700 .48rem/1.2 'Space Grotesk',sans-serif;letter-spacing:.07em;text-transform:uppercase}
      .nmx-activation-list{margin-top:.55rem;padding-top:.55rem;border-top:1px solid rgba(22,21,15,.08)}
      .nmx-activation-list button{display:flex;align-items:flex-start;justify-content:space-between;gap:.5rem;width:100%;padding:.45rem 0;border:0;border-top:1px solid rgba(22,21,15,.05);background:transparent;text-align:left;cursor:pointer}
      .nmx-activation-list b{color:#6d5620;font:600 .61rem/1.35 'Space Grotesk',sans-serif;overflow-wrap:anywhere}
      .nmx-activation-list small{color:rgba(22,21,15,.42);font:600 .45rem/1.2 ui-monospace,SFMono-Regular,Menlo,monospace}
    `;
    document.head.appendChild(style);
  }

  function selectedBaseId(section) {
    const selected = section.querySelector('.nmx-node.selected');
    const title = selected?.querySelector('title')?.textContent || '';
    const lines = title.split('\n').map(x => x.trim()).filter(Boolean);
    return lines.length ? lines[lines.length - 1] : null;
  }

  function overlayCatalog() {
    return {
      nodes: safeObject(quality?.overlay?.nodes),
      connections: safeObject(quality?.overlay?.connections)
    };
  }

  function mergedNode(id, section) {
    const overlay = overlayCatalog().nodes[id];
    if (overlay) return overlay;
    const baseGroup = [...section.querySelectorAll('.nmx-node')].find(group => {
      const title = group.querySelector('title')?.textContent || '';
      return title.split('\n').map(x => x.trim()).includes(id);
    });
    if (!baseGroup) return null;
    const title = baseGroup.querySelector('title')?.textContent || '';
    return { id, type: 'entity', label: title.split('\n')[0] || id, status: 'established', provenance: { source: 'base-neural-map' } };
  }

  function relatedEdges(nodeId) {
    return Object.values(overlayCatalog().connections).filter(edge => edge && (edge.from === nodeId || edge.to === nodeId));
  }

  function otherId(edge, nodeId) {
    return edge.from === nodeId ? edge.to : edge.from;
  }

  function nodeMeta(node) {
    return TYPE_META[node?.type] || TYPE_META.entity;
  }

  function shortLabel(node) {
    const text = esc(node?.label || node?.id || 'node');
    return text.length > 24 ? `${text.slice(0, 22)}…` : text;
  }

  function svgEl(tag, attrs = {}) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, String(v)));
    return el;
  }

  function basePosition(section, id) {
    const groups = [...section.querySelectorAll('.nmx-node')];
    for (const group of groups) {
      const title = group.querySelector('title')?.textContent || '';
      if (!title.split('\n').map(x => x.trim()).includes(id)) continue;
      const transform = group.getAttribute('transform') || '';
      const match = transform.match(/translate\(([-\d.]+)\s+([-\d.]+)\)/);
      if (match) return { x: Number(match[1]), y: Number(match[2]) };
    }
    return null;
  }

  function renderDetail(section, focusId, edges) {
    const detail = section.querySelector('.nmx-detail');
    if (!detail || !focusId || !edges.length) return;
    detail.querySelector('.nmx-activation-list')?.remove();
    detail.querySelector('.nmx-activation-chip')?.remove();

    const chip = document.createElement('div');
    chip.className = 'nmx-activation-chip';
    chip.textContent = `${edges.length} activation-aware relation${edges.length === 1 ? '' : 's'}`;

    const list = document.createElement('div');
    list.className = 'nmx-activation-list';
    edges.slice(0, 12).forEach(edge => {
      const targetId = otherId(edge, focusId);
      const node = overlayCatalog().nodes[targetId] || { id: targetId, label: targetId, type: 'entity' };
      const button = document.createElement('button');
      button.type = 'button';
      const b = document.createElement('b');
      b.textContent = shortLabel(node);
      const small = document.createElement('small');
      small.textContent = `${edge.kind} · ${edge.epistemicClass || edge.status || 'direct'}`;
      button.append(b, small);
      button.addEventListener('click', () => {
        overlayFocusId = targetId;
        redraw();
      });
      list.appendChild(button);
    });
    detail.append(chip, list);
  }

  function redraw() {
    scheduled = false;
    const section = document.getElementById(SECTION_ID);
    if (!section || !quality) return;
    const svg = section.querySelector('.nmx-canvas');
    const root = svg?.querySelector('[data-graph-root]');
    if (!svg || !root) return;
    root.querySelector('[data-th-activation-overlay]')?.remove();

    const baseSelectedId = selectedBaseId(section);
    const focusId = overlayFocusId || baseSelectedId;
    if (!focusId) {
      overlayFocusId = null;
      return;
    }
    if (baseSelectedId && overlayFocusId && !relatedEdges(overlayFocusId).length) overlayFocusId = null;

    const edges = relatedEdges(focusId).slice(0, MAX_OVERLAY_NEIGHBORS);
    if (!edges.length) {
      if (overlayFocusId && baseSelectedId && overlayFocusId !== baseSelectedId) {
        overlayFocusId = null;
        scheduleRedraw();
      }
      return;
    }

    const focusPos = basePosition(section, focusId) || basePosition(section, baseSelectedId) || { x: 320, y: 250 };
    const group = svgEl('g', { 'data-th-activation-overlay': VERSION });
    const neighbors = edges.map(edge => ({ edge, id: otherId(edge, focusId) })).filter(x => x.id);
    const radius = Math.max(92, Math.min(185, 92 + neighbors.length * 5));

    neighbors.forEach(({ edge, id }, index) => {
      const angle = (Math.PI * 2 * index / Math.max(1, neighbors.length)) - Math.PI / 2;
      const position = { x: focusPos.x + Math.cos(angle) * radius, y: focusPos.y + Math.sin(angle) * radius };
      const node = overlayCatalog().nodes[id] || { id, label: id, type: 'entity', status: 'established' };
      const meta = nodeMeta(node);

      const line = svgEl('line', { x1: focusPos.x, y1: focusPos.y, x2: position.x, y2: position.y });
      line.classList.add('nmx-activation-edge');
      if (edge.epistemicClass === 'direct') line.classList.add('direct');
      const lineTitle = svgEl('title');
      lineTitle.textContent = `${edge.kind} · ${edge.epistemicClass || edge.status || 'direct'}`;
      line.appendChild(lineTitle);
      group.appendChild(line);

      if (basePosition(section, id)) return;
      const nodeGroup = svgEl('g', { transform: `translate(${position.x} ${position.y})`, tabindex: '0', role: 'button', 'aria-label': `${meta.label}: ${node.label}` });
      nodeGroup.classList.add('nmx-activation-node');
      const circle = svgEl('circle', { r: 8.5, fill: meta.fill, opacity: node.status === 'candidate' ? .7 : .95 });
      const label = svgEl('text', { x: 0, y: 20, 'text-anchor': 'middle' });
      label.textContent = shortLabel(node);
      const title = svgEl('title');
      title.textContent = `${meta.label} · ${node.label}\n${node.id}`;
      nodeGroup.append(circle, label, title);
      const activate = () => { overlayFocusId = id; redraw(); };
      nodeGroup.addEventListener('click', event => { event.stopPropagation(); activate(); });
      nodeGroup.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); activate(); }
      });
      group.appendChild(nodeGroup);
    });

    root.appendChild(group);
    renderDetail(section, focusId, edges);
    const mode = section.querySelector('.nmx-mode');
    if (mode) mode.textContent = `${neighbors.length} activation-aware neighbors · quality overlay`;
  }

  function scheduleRedraw() {
    if (scheduled) return;
    scheduled = true;
    window.requestAnimationFrame(redraw);
  }

  function bind(section) {
    section.addEventListener('click', event => {
      const baseNode = event.target.closest?.('.nmx-node');
      if (baseNode) {
        overlayFocusId = null;
        scheduleRedraw();
      }
      if (event.target.closest?.('.nmx-btn')) scheduleRedraw();
    }, true);

    const observer = new MutationObserver(() => scheduleRedraw());
    observer.observe(section, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'transform'] });
    scheduleRedraw();
  }

  async function loadQuality() {
    const response = await fetch(`${QUALITY_URL}?v=${Date.now()}`, { cache: 'no-store', credentials: 'same-origin' });
    if (!response.ok) throw new Error(`${QUALITY_URL} HTTP ${response.status}`);
    const next = await response.json();
    if (next?.version !== '0.2-neural-graph-quality-and-activation') throw new Error('Unexpected Neural Graph quality telemetry');
    if (next?.authority?.executionAuthority !== 'none' || next?.authority?.readOnly !== true) throw new Error('Neural Graph quality authority boundary failed');
    quality = next;
  }

  async function init() {
    ensureStyle();
    await loadQuality();
    const waitUntil = Date.now() + 12000;
    while (Date.now() < waitUntil) {
      const section = document.getElementById(SECTION_ID);
      if (section?.querySelector('.nmx-canvas')) { bind(section); return; }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error('Neural Map base renderer unavailable');
  }

  init().catch(error => console.warn('[The Holding Neural Map Activation Overlay]', error));
})();