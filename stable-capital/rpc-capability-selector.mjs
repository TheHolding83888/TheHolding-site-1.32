#!/usr/bin/env node
/**
 * THE HOLDING · STABLE RPC CAPABILITY SELECTOR v0.1
 *
 * Shared transport preflight for Stable Capital historical state reads.
 *
 * Invariants:
 * - endpoint liveness is NOT treated as historical/archive capability;
 * - a candidate is admitted only after an actual historical contract state read;
 * - selection is strategy-agnostic and can serve every Stable Capital adapter;
 * - URLs are never persisted; only sanitized provider host labels are written;
 * - if no candidate proves capability, the selector fails closed: no fake rate,
 *   no zero substitution, and the Stable collector remains responsible for
 *   emitting its canonical UNKNOWN/warming state.
 *
 * This module does not write Stable Capital economic data and is not a second
 * writer. It only selects transport for the existing canonical Stable writer.
 */

import fs from 'node:fs';
import path from 'node:path';
import { Contract, JsonRpcProvider } from 'ethers';

export const VERSION = '0.1-stable-rpc-capability';
export const DEFAULT_CHAIN_ID = 1;
// Post-Merge Ethereum block timestamps advance in 12-second slots. 50,500
// blocks therefore lands just beyond seven days, so the proven block can be
// reused by the collector without a second, rate-limit-heavy timestamp search.
export const DEFAULT_HISTORY_BLOCK_DISTANCE = 50_500;
export const DEFAULT_ATTEMPT_TIMEOUT_MS = 8_000;
export const DEFAULT_MAX_CANDIDATES = 6;
export const DEFAULT_PROBE_ADDRESS = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'; // Ethereum USDC

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function cleanUrl(value) {
  const raw = String(value || '').trim();
  if (!raw || /[\r\n]/.test(raw)) return null;
  try {
    const u = new URL(raw);
    if (!['https:', 'http:'].includes(u.protocol)) return null;
    return u.toString();
  } catch {
    return null;
  }
}

export function providerLabel(value) {
  try {
    const u = new URL(String(value));
    return u.hostname || 'configured-rpc';
  } catch {
    return 'configured-rpc';
  }
}

export function buildCandidateUrls(env = process.env) {
  return unique([
    cleanUrl(env.ETH_ARCHIVE_RPC_URL),
    cleanUrl(env.ETH_RPC_URL),
    cleanUrl(env.ETH_RPC_URL_2),
    'https://ethereum-rpc.publicnode.com/',
    'https://eth.llamarpc.com/',
    'https://eth.blockscout.com/api/eth-rpc'
  ]).slice(0, DEFAULT_MAX_CANDIDATES);
}

function errorText(error) {
  return String(error?.shortMessage || error?.message || error || 'unknown error').slice(0, 1000);
}

async function withTimeout(promise, timeoutMs, label) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
      })
    ]);
  } finally {
    clearTimeout(timer);
  }
}

export async function probeHistoricalCapability(url, {
  chainId = DEFAULT_CHAIN_ID,
  historyBlockDistance = DEFAULT_HISTORY_BLOCK_DISTANCE,
  timeoutMs = DEFAULT_ATTEMPT_TIMEOUT_MS,
  probeAddress = DEFAULT_PROBE_ADDRESS
} = {}) {
  const startedAt = Date.now();
  const provider = new JsonRpcProvider(url, chainId, { staticNetwork: true });
  try {
    const result = await withTimeout((async () => {
      const network = await provider.getNetwork();
      if (Number(network.chainId) !== Number(chainId)) {
        throw new Error(`wrong chain ${network.chainId}; expected ${chainId}`);
      }

      const latest = await provider.getBlock('latest');
      if (!latest || !Number.isFinite(Number(latest.number))) {
        throw new Error('latest block unavailable');
      }

      const historicalBlockNumber = Math.max(1, Number(latest.number) - Number(historyBlockDistance));
      const historicalBlock = await provider.getBlock(historicalBlockNumber);
      if (!historicalBlock) {
        throw new Error(`historical block ${historicalBlockNumber} unavailable`);
      }

      // The capability proof is intentionally an eth_call against historical
      // state, not merely getBlock(). A live RPC may serve old block headers
      // while refusing historical contract state.
      const probe = new Contract(probeAddress, ['function decimals() view returns (uint8)'], provider);
      const decimals = Number(await probe.decimals({ blockTag: historicalBlockNumber }));
      if (!Number.isFinite(decimals) || decimals < 0 || decimals > 255) {
        throw new Error(`invalid historical state probe result: ${decimals}`);
      }

      return {
        latestBlock: Number(latest.number),
        historicalBlock: historicalBlockNumber,
        historicalTimestamp: Number(historicalBlock.timestamp),
        probeDecimals: decimals
      };
    })(), timeoutMs, providerLabel(url));

    return {
      ok: true,
      provider: providerLabel(url),
      latencyMs: Date.now() - startedAt,
      ...result
    };
  } catch (error) {
    return {
      ok: false,
      provider: providerLabel(url),
      latencyMs: Date.now() - startedAt,
      error: errorText(error)
    };
  } finally {
    try { provider.destroy(); } catch {}
  }
}

export async function selectHistoricalRpc({
  candidates = buildCandidateUrls(),
  chainId = DEFAULT_CHAIN_ID,
  historyBlockDistance = DEFAULT_HISTORY_BLOCK_DISTANCE,
  timeoutMs = DEFAULT_ATTEMPT_TIMEOUT_MS,
  probeAddress = DEFAULT_PROBE_ADDRESS
} = {}) {
  const attempts = [];
  for (const url of unique(candidates.map(cleanUrl).filter(Boolean)).slice(0, DEFAULT_MAX_CANDIDATES)) {
    const probe = await probeHistoricalCapability(url, {
      chainId,
      historyBlockDistance,
      timeoutMs,
      probeAddress
    });
    attempts.push(probe);
    if (probe.ok) {
      return { ok: true, url, selected: probe, attempts };
    }
  }
  return { ok: false, url: null, selected: null, attempts };
}

export function capabilityArtifact(selection, generatedAt = new Date().toISOString()) {
  return {
    version: VERSION,
    generatedAt,
    chain: { name: 'Ethereum', chainId: DEFAULT_CHAIN_ID },
    capability: 'historical-contract-state-read',
    status: selection?.ok ? 'ready' : 'unavailable-fail-closed',
    selected: selection?.selected ? {
      provider: selection.selected.provider,
      latestBlock: selection.selected.latestBlock,
      historicalBlock: selection.selected.historicalBlock,
      historicalTimestamp: selection.selected.historicalTimestamp,
      latencyMs: selection.selected.latencyMs,
      probeDecimals: selection.selected.probeDecimals
    } : null,
    attempts: (selection?.attempts || []).map(row => ({
      ok: row.ok === true,
      provider: row.provider || 'configured-rpc',
      latencyMs: Number(row.latencyMs) || null,
      latestBlock: Number.isFinite(Number(row.latestBlock)) ? Number(row.latestBlock) : null,
      historicalBlock: Number.isFinite(Number(row.historicalBlock)) ? Number(row.historicalBlock) : null,
      error: row.ok ? null : String(row.error || 'unknown error').slice(0, 1000)
    })),
    probe: {
      address: DEFAULT_PROBE_ADDRESS,
      method: 'decimals()',
      historicalBlockDistance: DEFAULT_HISTORY_BLOCK_DISTANCE,
      requirement: 'historical eth_call must succeed; liveness/header history alone is insufficient'
    },
    invariants: {
      strategyAgnosticTransport: true,
      endpointLivenessIsNotHistoricalCapability: true,
      unknownNeverZero: true,
      failClosed: true,
      secondStableWriterCreated: false,
      executionAuthority: 'none'
    }
  };
}

function writeGithubEnv(selectedUrl, selected) {
  const envFile = process.env.GITHUB_ENV;
  if (!envFile || !selectedUrl || !selected) return false;
  const historicalBlock = Number(selected.historicalBlock);
  const historicalTimestamp = Number(selected.historicalTimestamp);
  if (!Number.isInteger(historicalBlock) || historicalBlock < 1
    || !Number.isInteger(historicalTimestamp) || historicalTimestamp < 1) return false;
  fs.appendFileSync(envFile, [
    `ETH_ARCHIVE_RPC_URL=${selectedUrl}`,
    `ETH_ARCHIVE_BLOCK_NUMBER=${historicalBlock}`,
    `ETH_ARCHIVE_BLOCK_TIMESTAMP=${historicalTimestamp}`,
    ''
  ].join('\n'), 'utf8');
  return true;
}

async function runCli() {
  const root = path.resolve(process.cwd());
  const outFile = process.env.STABLE_RPC_CAPABILITY_FILE
    || path.join(root, 'intelligence', 'reliability', 'stable-rpc-capability.json');

  const selection = await selectHistoricalRpc();
  const artifact = capabilityArtifact(selection);
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');

  if (selection.ok) {
    writeGithubEnv(selection.url, selection.selected);
    console.log(`Stable historical RPC capability PASS via ${selection.selected.provider}; historical block ${selection.selected.historicalBlock}.`);
  } else {
    // Deliberately do not fail the workflow. The economic collector must still
    // run and publish UNKNOWN/null where historical truth cannot be proven.
    console.log(`Stable historical RPC capability UNAVAILABLE; fail-closed path preserved across ${selection.attempts.length} candidates.`);
  }
  console.log(`Capability artifact: ${path.relative(root, outFile)}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCli().catch(error => {
    console.error(errorText(error));
    process.exitCode = 1;
  });
}
