import assert from 'node:assert/strict';
import { resolveOnchainPrices } from './onchain-price-resolver.mjs';

const nowMs = Date.UTC(2026, 7, 19, 20, 30, 0);
const nowSeconds = Math.floor(nowMs / 1000);

function word(value) {
  let n = BigInt(value);
  if (n < 0n) n = (1n << 256n) + n;
  return n.toString(16).padStart(64, '0');
}
function chainlinkRound({ roundId, answer, startedAt, updatedAt, answeredInRound }) {
  return `0x${word(roundId)}${word(answer)}${word(startedAt)}${word(updatedAt)}${word(answeredInRound)}`;
}

const ETH = '0x0000000000000000000000000000000000000001';
const FXS = '0x0000000000000000000000000000000000000002';
const CVXETH = '0x0000000000000000000000000000000000000003';
const PENDLE = '0x0000000000000000000000000000000000000004';

const registry = {
  version: 'validation',
  networks: {
    ethereum: {
      chainId: 1,
      rpcFailover: [
        { id: 'eth-first-fails', url: 'https://eth-first.invalid' },
        { id: 'eth-second-works', url: 'https://eth-second.invalid' }
      ]
    },
    optimism: {
      chainId: 10,
      rpcFailover: [{ id: 'op-works', url: 'https://op.invalid' }]
    }
  },
  assets: {
    ethereum: {
      assetId: 'ethereum', symbol: 'ETH',
      route: { type: 'chainlink-v3', network: 'ethereum', contract: ETH, quote: 'USD', maxAgeSeconds: 7200, maxDivergencePct: 2, authority: 'shadow' }
    },
    'frax-share': {
      assetId: 'frax-share', symbol: 'FXS',
      route: { type: 'chainlink-v3', network: 'ethereum', contract: FXS, quote: 'USD', maxAgeSeconds: 7200, maxDivergencePct: 2, authority: 'shadow' }
    },
    'convex-finance': {
      assetId: 'convex-finance', symbol: 'CVX',
      route: { type: 'chainlink-v3-relative', network: 'ethereum', contract: CVXETH, quoteAssetId: 'ethereum', feedQuote: 'ETH', outputQuote: 'USD', maxAgeSeconds: 7200, maxDivergencePct: 2, authority: 'shadow' }
    },
    pendle: {
      assetId: 'pendle', symbol: 'PENDLE',
      route: { type: 'chainlink-v3', network: 'optimism', contract: PENDLE, quote: 'USD', maxAgeSeconds: 7200, maxDivergencePct: 2, authority: 'shadow' }
    }
  }
};

const marketData = {
  prices: {
    ethereum: { usd: 2000 },
    'frax-share': { usd: 0.30 },
    'convex-finance': { usd: 2 },
    pendle: { usd: 1.40 }
  }
};

let calls = 0;
const fetchImpl = async (url, options) => {
  calls += 1;
  if (url.includes('eth-first.invalid')) throw new Error('synthetic Ethereum endpoint failure');
  const payload = JSON.parse(options.body);
  assert.equal(payload.filter(x => x.method === 'eth_blockNumber').length, 1, 'One block request per network batch');
  const response = [{ jsonrpc: '2.0', id: 1, result: url.includes('op.invalid') ? '0x2000' : '0x1000' }];

  for (const req of payload.filter(x => x.method === 'eth_call')) {
    const to = req.params?.[0]?.to;
    const isDecimals = req.params?.[0]?.data === '0x313ce567';
    if (isDecimals) {
      response.push({ jsonrpc: '2.0', id: req.id, result: `0x${word(8)}` });
      continue;
    }
    let answer;
    let roundId;
    if (to === ETH) { answer = 200000000000n; roundId = 100n; }
    else if (to === FXS) { answer = 30000000n; roundId = 200n; }
    else if (to === CVXETH) { answer = 100000n; roundId = 300n; } // 0.001 CVX/ETH with 8 decimals
    else if (to === PENDLE) { answer = 140000000n; roundId = 400n; }
    else throw new Error(`Unexpected test feed ${to}`);
    response.push({ jsonrpc: '2.0', id: req.id, result: chainlinkRound({ roundId, answer, startedAt: nowSeconds - 90, updatedAt: nowSeconds - 60, answeredInRound: roundId }) });
  }

  return { ok: true, status: 200, async json() { return response; } };
};

const output = await resolveOnchainPrices({ registry, marketData, fetchImpl, nowMs });
const eth = output.observations.ethereum;
const fxs = output.observations['frax-share'];
const cvx = output.observations['convex-finance'];
const pendle = output.observations.pendle;

assert.equal(calls, 3, 'One failed Ethereum batch + one successful Ethereum batch + one successful Optimism batch');
assert.equal(output.status, 'ok');
assert.equal(output.mode, 'shadow');
assert.equal(output.semantics.productionPriceAuthority, false);
assert.equal(output.semantics.paidRpcRequired, false);
assert.equal(output.semantics.oneHttpBatchPerNetworkPerAttempt, true);
assert.equal(output.semantics.composableRelativePriceRoutes, true);
assert.equal(output.semantics.relativeRoutesReuseSameCycleQuoteObservation, true);
assert.equal(output.authority.executionAuthority, 'none');
assert.equal(output.coverage.assetCount, 4);
assert.equal(output.coverage.okCount, 4);
assert.equal(output.coverage.unavailableCount, 0);
assert.equal(output.rpcEfficiency.networkCount, 2);
assert.equal(output.rpcEfficiency.routeCount, 4);
assert.equal(output.rpcEfficiency.httpBatchRequestCount, 3);
assert.equal(output.networks.ethereum.routeCount, 3);
assert.equal(output.networks.ethereum.batchCallCount, 7);
assert.equal(output.networks.ethereum.rpcFailoverAttempts, 1);
assert.equal(output.networks.optimism.routeCount, 1);
assert.equal(output.networks.optimism.batchCallCount, 3);
assert.equal(output.networks.optimism.rpcFailoverAttempts, 0);
assert.equal(eth.status, 'shadow-ok');
assert.equal(eth.usd, 2000);
assert.equal(fxs.status, 'shadow-ok');
assert.equal(fxs.usd, 0.3);
assert.equal(cvx.status, 'shadow-ok');
assert.equal(cvx.feedValue, 0.001);
assert.equal(cvx.quoteAssetId, 'ethereum');
assert.equal(cvx.quoteAssetUsd, 2000);
assert.equal(cvx.usd, 2);
assert.equal(cvx.divergencePct, 0);
assert.equal(cvx.dependencyStatus, 'shadow-ok');
assert.equal(pendle.status, 'shadow-ok');
assert.equal(pendle.usd, 1.4);
assert.equal(pendle.network, 'optimism');
assert.equal(pendle.blockNumber, 0x2000);

console.log('Onchain Price Resolver multi-network composable validation PASS', {
  routes: output.rpcEfficiency.routeCount,
  networks: output.rpcEfficiency.networkCount,
  httpBatchRequestCount: output.rpcEfficiency.httpBatchRequestCount,
  ethereumRoutes: output.networks.ethereum.routeCount,
  optimismRoutes: output.networks.optimism.routeCount,
  cvxComposition: cvx.composition,
  productionPriceAuthority: false
});
