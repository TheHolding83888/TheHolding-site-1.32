(() => {
  'use strict';

  if (typeof document === 'undefined' || typeof window === 'undefined') return;

  const REFRESH_MS = 60_000;
  const THI_URL = '/intelligence/intelligence-progress.json';
  const NEWS_URL = '/intelligence/event-intelligence.json';
  const THI_SCRIPT = '/agents/console/intelligence-progress.js';
  const NEWS_SCRIPT = '/agents/console/event-intelligence.js';

  // English-first presentation layer for Ask The Holding. The underlying router
  // remains bilingual; this only changes the default visible console copy.
  if (!document.querySelector('script[data-th-ask-english-first-loader]')) {
    const askUi = document.createElement('script');
    askUi.src = '/agents/console/ask-english-first-ui.js?v=0.1';
    askUi.defer = true;
    askUi.dataset.thAskEnglishFirstLoader = 'v0.1';
    document.head.appendChild(askUi);
  }

  // Owner Intelligence is deliberately separate from THI. It visualizes
  // provenance-bound teaching/graph growth without rewarding raw answer volume
  // as maturity or pretending candidate metrics are already live.
  if (!document.querySelector('script[data-th-owner-intelligence-loader]')) {
    const ownerUi = document.createElement('script');
    ownerUi.src = '/agents/console/owner-intelligence.js?v=0.1';
    ownerUi.defer = true;
    ownerUi.dataset.thOwnerIntelligenceLoader = 'v0.1';
    document.head.appendChild(ownerUi);
  }

  // Whole-OS Neural Graph telemetry. Owner Intelligence remains the owner-
  // teaching contribution view; this instrument covers canonical knowledge
  // nodes and provenance-aware relationships across economic, memory, security,
  // Brain, decision and owner-context sources.
  if (!document.querySelector('script[data-th-neural-graph-loader]')) {
    const neuralGraph = document.createElement('script');
    neuralGraph.src = '/agents/console/neural-graph-dashboard.js?v=0.1';
    neuralGraph.defer = true;
    neuralGraph.dataset.thNeuralGraphLoader = 'v0.1';
    document.head.appendChild(neuralGraph);
  }

  // Graph-quality telemetry sits beside raw growth. It measures owner-teaching
  // activation, graph isolation/components and bounded candidate review so raw
  // neuron counts cannot masquerade as useful intelligence.
  if (!document.querySelector('script[data-th-neural-graph-quality-loader]')) {
    const graphQuality = document.createElement('script');
    graphQuality.src = '/agents/console/neural-graph-quality.js?v=0.1';
    graphQuality.defer = true;
    graphQuality.dataset.thNeuralGraphQualityLoader = 'v0.1';
    document.head.appendChild(graphQuality);
  }

  // Day-over-day badges are a companion to canonical graph history. They do
  // not backfill or invent yesterday's state: the badge remains warming until
  // a real prior daily snapshot exists.
  if (!document.querySelector('script[data-th-neural-graph-delta-loader]')) {
    const dailyDelta = document.createElement('script');
    dailyDelta.src = '/agents/console/neural-graph-daily-delta.js?v=0.1';
    dailyDelta.defer = true;
    dailyDelta.dataset.thNeuralGraphDeltaLoader = 'v0.1';
    document.head.appendChild(dailyDelta);
  }

  // Interactive topology is a read-only view over the same canonical node and
  // connection catalog. It opens as a bounded subgraph to avoid a misleading
  // spaghetti map, then expands one neighborhood at a time through user clicks.
  if (!document.querySelector('script[data-th-neural-map-loader]')) {
    const neuralMap = document.createElement('script');
    neuralMap.src = '/agents/console/neural-map-explorer.js?v=0.1';
    neuralMap.defer = true;
    neuralMap.dataset.thNeuralMapLoader = 'v0.1';
    document.head.appendChild(neuralMap);
  }

  // Activation-aware companion for the proven base Neural Map renderer. It does
  // not invent browser-side relations: it visualizes only the canonical overlay
  // published by neural-graph-quality.json (semantic domains, capabilities,
  // blockers, security/code surfaces, memory chain and architecture demand).
  if (!document.querySelector('script[data-th-neural-map-activation-loader]')) {
    const activationOverlay = document.createElement('script');
    activationOverlay.src = '/agents/console/neural-map-activation-overlay.js?v=0.2';
    activationOverlay.defer = true;
    activationOverlay.dataset.thNeuralMapActivationLoader = 'v0.2';
    document.head.appendChild(activationOverlay);
  }

  // Bounded conversational cortex. This is a read-only owner-context / graph
  // synthesis layer over the existing Ask router. safety.js is the parent
  // loader and therefore registers its capture guard before this script can
  // receive any form submission. Ordinary company/APR/Rewards questions remain
  // owned by the established app.js router.
  if (!document.querySelector('script[data-th-owner-context-cortex-loader]')) {
    const cortex = document.createElement('script');
    cortex.src = '/agents/console/owner-context-conversation.js?v=0.1';
    cortex.defer = true;
    cortex.dataset.thOwnerContextCortexLoader = 'v0.1';
    document.head.appendChild(cortex);
  }

  // Desktop-safe ownership of THI spacing. This lives outside The Holding News
  // so the score layout never depends on whether the News component loaded.
  const style = document.createElement('style');
  style.dataset.thLivePanelsRefresh = 'v0.5';
  style.textContent = `
    @media (min-width: 901px) {
      #intelligenceProgress .thi-index-row {
        margin: .18rem 0 .92rem !important;
        transform: translateY(-7px);
      }
      #intelligenceProgress .thi-stage {
        position: relative;
        z-index: 3;
        margin-top: .08rem;
      }
    }
    @media (min-width: 601px) and (max-width: 900px) {
      #intelligenceProgress .thi-index-row { margin-bottom: .78rem !important; }
    }
  `;
  document.head.appendChild(style);

  const state = {
    thiGeneratedAt: null,
    newsGeneratedAt: null,
    refreshing: false
  };

  async function readJson(url) {
    const response = await fetch(`${url}?v=${Date.now()}`, {
      cache: 'no-store',
      credentials: 'same-origin'
    });
    if (!response.ok) throw new Error(`${url} HTTP ${response.status}`);
    return response.json();
  }

  function reloadComponent({ sectionId, loaderSelector, src, datasetKey, datasetValue }) {
    document.getElementById(sectionId)?.remove();
    document.querySelector(loaderSelector)?.remove();

    const script = document.createElement('script');
    script.src = `${src}?v=${Date.now()}`;
    script.async = false;
    script.defer = true;
    script.dataset[datasetKey] = datasetValue;
    document.head.appendChild(script);
  }

  async function establishBaseline() {
    try {
      const [thi, news] = await Promise.all([readJson(THI_URL), readJson(NEWS_URL)]);
      state.thiGeneratedAt = thi?.generatedAt || null;
      state.newsGeneratedAt = news?.generatedAt || null;
    } catch (error) {
      console.warn('[The Holding Live Panels] baseline unavailable', error);
    }
  }

  async function refreshIfChanged() {
    if (state.refreshing || document.hidden) return;
    state.refreshing = true;
    try {
      const [thi, news] = await Promise.all([readJson(THI_URL), readJson(NEWS_URL)]);
      const nextThi = thi?.generatedAt || null;
      const nextNews = news?.generatedAt || null;

      if (state.thiGeneratedAt && nextThi && nextThi !== state.thiGeneratedAt) {
        reloadComponent({
          sectionId: 'intelligenceProgress',
          loaderSelector: 'script[data-th-intelligence-progress-loader]',
          src: THI_SCRIPT,
          datasetKey: 'thIntelligenceProgressLoader',
          datasetValue: 'live-refresh'
        });
      }

      if (state.newsGeneratedAt && nextNews && nextNews !== state.newsGeneratedAt) {
        reloadComponent({
          sectionId: 'operatingEventIntelligence',
          loaderSelector: 'script[data-th-operating-event-intelligence-loader]',
          src: NEWS_SCRIPT,
          datasetKey: 'thOperatingEventIntelligenceLoader',
          datasetValue: 'live-refresh'
        });
      }

      state.thiGeneratedAt = nextThi;
      state.newsGeneratedAt = nextNews;
    } catch (error) {
      // Fail closed: keep the last verified snapshot on screen rather than
      // replacing it with invented values or a transient network error.
      console.warn('[The Holding Live Panels] refresh check unavailable', error);
    } finally {
      state.refreshing = false;
    }
  }

  establishBaseline();
  window.setInterval(refreshIfChanged, REFRESH_MS);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) refreshIfChanged();
  });
})();