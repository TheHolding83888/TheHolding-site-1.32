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
      assetId: 'ethereum',
      symbol: 'ETH',
      route: {
        type: 'chainlink-v3',
        network: 'ethereum',
        contract: '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419',
        quote: 'USD',
        maxAgeSeconds: 7200,
        maxDivergencePct: 2,
        authority: 'shadow'
      }
    }
  }
};

const marketData = {
  prices: {
    ethereum: { usd: 2092.71 }
  }
};

let calls = 0;
const fetchImpl = async (url, options) => {
  calls += 1;
  if (url.includes('first.invalid')) throw new Error('synthetic endpoint failure');
  const payload = JSON.parse(options.body);
  assert.equal(payload.length, 3, 'Chainlink observation must use one batched RPC request');
  assert.equal(payload[0].method, 'eth_blockNumber');
  assert.equal(payload[1].method, 'eth_call');
  assert.equal(payload[2].method, 'eth_call');
  return {
    ok: true,
    status: 200,
    async json() {
      return [
        { jsonrpc: '2.0', id: 1, result: '0x1234' },
        { jsonrpc: '2.0', id: 2, result: `0x${word(8)}` },
        {
          jsonrpc: '2.0',
          id: 3,
          result: chainlinkRound({
            roundId: 100,
            answer: 209271000000,
            startedAt: nowSeconds - 90,
            updatedAt: nowSeconds - 60,
            answeredInRound: 100
          })
        }
      ];
    }
  };
};

const output = await resolveOnchainPrices({ registry, marketData, fetchImpl, nowMs });
const eth = output.observations.ethereum;

assert.equal(calls, 2, 'Resolver must fail over exactly once in this fixture');
assert.equal(output.status, 'ok');
assert.equal(output.mode, 'shadow');
assert.equal(output.semantics.productionPriceAuthority, false);
assert.equal(output.semantics.paidRpcRequired, false);
assert.equal(output.authority.executionAuthority, 'none');
assert.equal(output.coverage.assetCount, 1);
assert.equal(output.coverage.okCount, 1);
assert.equal(output.coverage.unavailableCount, 0);
assert.equal(eth.status, 'shadow-ok');
assert.equal(eth.usd, 2092.71);
assert.equal(eth.canonicalPriceUsd, 2092.71);
assert.equal(eth.divergencePct, 0);
assert.equal(eth.blockNumber, 0x1234);
assert.equal(eth.feedAgeSeconds, 60);
assert.equal(eth.rpcEndpointId, 'second-works');
assert.equal(eth.rpcFailoverAttempts, 1);
assert.equal(eth.productionPriceAuthority, false);

console.log('Onchain Price Resolver deterministic validation PASS', {
  asset: eth.assetId,
  usd: eth.usd,
  blockNumber: eth.blockNumber,
  failoverAttempts: eth.rpcFailoverAttempts,
  productionPriceAuthority: eth.productionPriceAuthority
});
