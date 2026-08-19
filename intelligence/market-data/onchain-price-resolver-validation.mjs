import assert from 'node:assert/strict';
import { resolveOnchainPrices } from './onchain-price-resolver.mjs';

const nowMs = Date.UTC(2026, 7, 19, 19, 30, 0);
const nowSeconds = Math.floor(nowMs / 1000);

function word(value) {
  let n = BigInt(value);
  if (n < 0n) n = (1n << 256n) + n;
  return n.toString(16).padStart(64, '0');
}
function chainlinkRound({ roundId, answer, startedAt, updatedAt, answeredInRound }) {
  return `0x${word(roundId)}${word(answer)}${word(startedAt)}${word(updatedAt)}${word(answeredInRound)}`;
}

const registry = {
  version: 'validation',
  networks: {
    ethereum: {
      chainId: 1,
      rpcFailover: [
        { id: 'first-fails', url: 'https://first.invalid' },
        { id: 'second-works', url: 'https://second.invalid' }
      ]
    }
  },
  assets: {
    ethereum: {
      assetId: 'ethereum', symbol: 'ETH',
      route: { type: 'chainlink-v3', network: 'ethereum', contract: '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419', quote: 'USD', maxAgeSeconds: 7200, maxDivergencePct: 2, authority: 'shadow' }
    },
    bitcoin: {
      assetId: 'bitcoin', symbol: 'BTC',
      route: { type: 'chainlink-v3', network: 'ethereum', contract: '0xF4030086522a5bEEa4988F8cA5B36dbC97BeE88c', quote: 'USD', maxAgeSeconds: 7200, maxDivergencePct: 2, authority: 'shadow' }
    }
  }
};
const marketData = { prices: { ethereum: { usd: 2092.71 }, bitcoin: { usd: 68000 } } };

let calls = 0;
const fetchImpl = async (url, options) => {
  calls += 1;
  if (url.includes('first.invalid')) throw new Error('synthetic endpoint failure');
  const payload = JSON.parse(options.body);
  assert.equal(payload.length, 5, 'Two same-network routes must share one block request plus four eth_calls');
  assert.equal(payload.filter(x => x.method === 'eth_blockNumber').length, 1, 'Block number must be requested once per network batch');
  assert.equal(payload.filter(x => x.method === 'eth_call').length, 4);
  const ids = payload.map(x => x.id);
  assert.deepEqual(ids, [1, 1000, 1001, 1002, 1003]);
  return {
    ok: true,
    status: 200,
    async json() {
      return [
        { jsonrpc: '2.0', id: 1, result: '0x1234' },
        { jsonrpc: '2.0', id: 1000, result: `0x${word(8)}` },
        { jsonrpc: '2.0', id: 1001, result: chainlinkRound({ roundId: 100, answer: 209271000000, startedAt: nowSeconds - 90, updatedAt: nowSeconds - 60, answeredInRound: 100 }) },
        { jsonrpc: '2.0', id: 1002, result: `0x${word(8)}` },
        { jsonrpc: '2.0', id: 1003, result: chainlinkRound({ roundId: 200, answer: 6800000000000, startedAt: nowSeconds - 90, updatedAt: nowSeconds - 60, answeredInRound: 200 }) }
      ];
    }
  };
};

const output = await resolveOnchainPrices({ registry, marketData, fetchImpl, nowMs });
const eth = output.observations.ethereum;
const btc = output.observations.bitcoin;

assert.equal(calls, 2, 'Two routes on one network with one failed endpoint must require only two HTTP requests total');
assert.equal(output.status, 'ok');
assert.equal(output.mode, 'shadow');
assert.equal(output.semantics.productionPriceAuthority, false);
assert.equal(output.semantics.paidRpcRequired, false);
assert.equal(output.semantics.oneHttpBatchPerNetworkPerAttempt, true);
assert.equal(output.semantics.duplicateBlockRequestsWithinNetwork, false);
assert.equal(output.authority.executionAuthority, 'none');
assert.equal(output.coverage.assetCount, 2);
assert.equal(output.coverage.okCount, 2);
assert.equal(output.coverage.unavailableCount, 0);
assert.equal(output.rpcEfficiency.networkCount, 1);
assert.equal(output.rpcEfficiency.routeCount, 2);
assert.equal(output.rpcEfficiency.httpBatchRequestCount, 2);
assert.equal(output.networks.ethereum.routeCount, 2);
assert.equal(output.networks.ethereum.batchCallCount, 5);
assert.equal(output.networks.ethereum.httpBatchRequestCount, 2);
assert.equal(output.networks.ethereum.rpcFailoverAttempts, 1);
assert.equal(eth.status, 'shadow-ok');
assert.equal(eth.usd, 2092.71);
assert.equal(eth.canonicalPriceUsd, 2092.71);
assert.equal(eth.divergencePct, 0);
assert.equal(eth.blockNumber, 0x1234);
assert.equal(eth.feedAgeSeconds, 60);
assert.equal(eth.rpcEndpointId, 'second-works');
assert.equal(eth.rpcFailoverAttempts, 1);
assert.equal(btc.status, 'shadow-ok');
assert.equal(btc.usd, 68000);
assert.equal(btc.canonicalPriceUsd, 68000);
assert.equal(btc.divergencePct, 0);
assert.equal(btc.blockNumber, 0x1234);
assert.equal(btc.rpcEndpointId, 'second-works');
assert.equal(btc.productionPriceAuthority, false);

console.log('Onchain Price Resolver network-batch validation PASS', {
  routes: output.rpcEfficiency.routeCount,
  networks: output.rpcEfficiency.networkCount,
  httpBatchRequestCount: output.rpcEfficiency.httpBatchRequestCount,
  blockRequestsPerNetwork: 1,
  failoverAttempts: output.networks.ethereum.rpcFailoverAttempts,
  productionPriceAuthority: false
});
