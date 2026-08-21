function finite(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function isoAgeSeconds(value, nowMs) {
  if (!value) return Infinity;
  const t = Date.parse(value);
  if (!Number.isFinite(t)) return Infinity;
  return Math.max(0, (nowMs - t) / 1000);
}

function coingeckoLane(marketData, assetId) {
  const row = marketData?.prices?.[assetId] || null;
  const usd = finite(row?.usd);
  return {
    lane: 'coingecko-lane',
    eligible: usd !== null && usd >= 0,
    usd,
    status: row?.status || 'unknown',
    observedAt: row?.observedAt || marketData?.observedAt || null,
    source: row?.source || null,
    reason: usd !== null && usd >= 0 ? 'canonical-market-data-usable' : 'canonical-market-data-unusable'
  };
}

function divergenceTelemetryOnly(policy) {
  // CoinGecko is a daily fallback/sanity lane. A fresh, structurally valid
  // onchain observation must not lose authority solely because the market has
  // moved away from that older daily reference. Divergence stays visible in
  // Shadow telemetry; stale/invalid/RPC/dependency failures still fail back.
  return policy?.semantics?.coinGeckoRemainsFallbackAndSanityCheck === true;
}

function observationStatusEligible(policy, observation, override) {
  const required = policy.onchainEligibility.requiredObservationStatus;
  const status = observation?.status;
  if (status === required) return true;
  if (!divergenceTelemetryOnly(policy)) return false;
  if (status === 'divergent') return true;
  return status === 'dependency-warning'
    && override?.requiredDependencyStatus === required
    && observation?.dependencyStatus === 'divergent';
}

function dependencyStatusEligible(policy, observation, override) {
  const required = override?.requiredDependencyStatus;
  if (!required) return true;
  if (observation?.dependencyStatus === required) return true;
  return divergenceTelemetryOnly(policy)
    && required === policy.onchainEligibility.requiredObservationStatus
    && observation?.dependencyStatus === 'divergent';
}

function onchainLane(policy, shadow, assetId, nowMs) {
  const observation = shadow?.observations?.[assetId] || null;
  const usd = finite(observation?.usd);
  const snapshotAgeSeconds = isoAgeSeconds(shadow?.generatedAt, nowMs);
  const override = policy.assetOverrides?.[assetId] || {};
  // Runtime source/dependency health is eligibility, not structural route identity: failed checks fall back through policy order.
  // Cross-source divergence against the daily CoinGecko cache is telemetry only; it is not evidence that a fresh onchain route failed.
  const checks = {
    snapshotMode: shadow?.mode === policy.onchainEligibility.requiredSnapshotMode,
    observationStatus: observationStatusEligible(policy, observation, override),
    snapshotFresh: snapshotAgeSeconds <= Number(policy.onchainEligibility.maxShadowSnapshotAgeSeconds),
    finitePositiveUsd: policy.onchainEligibility.requireFinitePositiveUsd !== true || (usd !== null && usd > 0),
    snapshotNotProductionAuthority: policy.onchainEligibility.requireSnapshotProductionPriceAuthorityFalse !== true || shadow?.semantics?.productionPriceAuthority === false,
    observationNotProductionAuthority: policy.onchainEligibility.requireObservationProductionPriceAuthorityFalse !== true || observation?.productionPriceAuthority === false,
    noExecutionAuthority: policy.onchainEligibility.requireExecutionAuthorityNone !== true || shadow?.authority?.executionAuthority === 'none',
    requiredObservationSource: !override.requiredObservationSource || observation?.source === override.requiredObservationSource,
    requiredDependencyStatus: dependencyStatusEligible(policy, observation, override),
    requiredQuoteAssetId: !override.requiredQuoteAssetId || observation?.quoteAssetId === override.requiredQuoteAssetId,
    requiredFeedQuote: !override.requiredFeedQuote || observation?.feedQuote === override.requiredFeedQuote,
    requiredOutputQuote: !override.requiredOutputQuote || observation?.outputQuote === override.requiredOutputQuote
  };
  const eligible = Object.values(checks).every(Boolean);
  const crossSourceDivergenceTelemetry = observation?.status === 'divergent'
    || (observation?.status === 'dependency-warning' && observation?.dependencyStatus === 'divergent');
  return {
    lane: 'onchain-shadow',
    eligible,
    usd,
    status: observation?.status || 'missing',
    observedAt: shadow?.generatedAt || null,
    source: observation?.source || null,
    snapshotAgeSeconds,
    checks,
    crossSourceDivergenceTelemetry,
    reason: eligible
      ? (crossSourceDivergenceTelemetry ? 'onchain-shadow-eligible-divergence-telemetry-only' : 'onchain-shadow-eligible')
      : 'onchain-shadow-ineligible'
  };
}

export function selectMarketDataAuthority({ policy, marketData, shadow, assetId, nowMs = Date.now() }) {
  if (!policy || !marketData || !shadow || !assetId) throw new Error('Authority selector inputs incomplete');
  const override = policy.assetOverrides?.[assetId] || null;
  const requestedPrimary = override?.requestedPrimary || policy.defaultProductionAuthority;
  if (!['coingecko-lane', 'onchain'].includes(requestedPrimary)) throw new Error(`Unsupported requestedPrimary for ${assetId}: ${requestedPrimary}`);
  if (requestedPrimary === 'onchain' && policy.globalOnchainPromotionEnabled !== true) {
    throw new Error(`Onchain promotion requested for ${assetId} while global promotion gate is disabled`);
  }

  const cg = coingeckoLane(marketData, assetId);
  const onchain = onchainLane(policy, shadow, assetId, nowMs);
  const order = policy.fallbackOrderByRequestedPrimary?.[requestedPrimary];
  if (!Array.isArray(order) || !order.length) throw new Error(`Fallback order missing for ${requestedPrimary}`);

  for (const lane of order) {
    if (lane === 'coingecko-lane' && cg.eligible) {
      return { assetId, requestedPrimary, selectedLane: cg.lane, selected: cg, fallbackUsed: requestedPrimary !== 'coingecko-lane', onchainCandidate: onchain, coingeckoCandidate: cg };
    }
    if (lane === 'onchain-shadow' && onchain.eligible) {
      return { assetId, requestedPrimary, selectedLane: onchain.lane, selected: onchain, fallbackUsed: false, onchainCandidate: onchain, coingeckoCandidate: cg };
    }
    if (lane === 'unknown') {
      return { assetId, requestedPrimary, selectedLane: 'unknown', selected: { lane: 'unknown', eligible: true, usd: null, status: 'unknown', source: null, observedAt: null, reason: 'no-eligible-price-lane' }, fallbackUsed: true, onchainCandidate: onchain, coingeckoCandidate: cg };
    }
  }
  throw new Error(`Authority selection exhausted without terminal lane for ${assetId}`);
}

export function evaluateMarketDataAuthority({ policy, marketData, shadow, nowMs = Date.now() }) {
  const assetIds = Object.keys(marketData?.prices || {});
  const selections = {};
  let onchainSelectedCount = 0;
  let coingeckoSelectedCount = 0;
  let unknownCount = 0;
  let fallbackCount = 0;
  let divergenceTelemetryCount = 0;

  for (const assetId of assetIds) {
    const row = selectMarketDataAuthority({ policy, marketData, shadow, assetId, nowMs });
    selections[assetId] = row;
    if (row.selectedLane === 'onchain-shadow') onchainSelectedCount += 1;
    else if (row.selectedLane === 'coingecko-lane') coingeckoSelectedCount += 1;
    else unknownCount += 1;
    if (row.fallbackUsed) fallbackCount += 1;
    if (row.selectedLane === 'onchain-shadow' && row.onchainCandidate?.crossSourceDivergenceTelemetry) divergenceTelemetryCount += 1;
  }

  return {
    version: '0.3-market-data-authority-evaluation-divergence-telemetry-aware',
    mode: policy.mode,
    generatedAt: new Date(nowMs).toISOString(),
    semantics: {
      dryRunOnly: policy.semantics?.productionWriterIntegrationEnabled === false,
      perAssetAuthority: true,
      dependencyAwareEligibility: true,
      coinGeckoDivergenceTelemetryOnlyForHealthyOnchainPrimary: divergenceTelemetryOnly(policy),
      productionMutationPerformed: false,
      executionAuthority: 'none'
    },
    coverage: {
      assetCount: assetIds.length,
      onchainSelectedCount,
      coingeckoSelectedCount,
      unknownCount,
      fallbackCount,
      divergenceTelemetryCount
    },
    selections
  };
}
