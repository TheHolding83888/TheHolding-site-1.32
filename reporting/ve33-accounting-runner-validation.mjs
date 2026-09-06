#!/usr/bin/env node
import assert from 'node:assert/strict';
import { PROTOCOLS, DIRECT_ACCOUNTING_START, FULL_ACCOUNTING_START } from './ve33-accounting-evidence.mjs';
import { VERSION, REQUIRED_HISTORICAL_BOUNDARIES, historicalRpcUrls, requireHistoricalRpc, rpcLabel } from './ve33-accounting-runner.mjs';

assert.equal(VERSION,'0.1-ve33-capability-aware-historical-rpc-runner');
assert.deepEqual(REQUIRED_HISTORICAL_BOUNDARIES,[DIRECT_ACCOUNTING_START,FULL_ACCOUNTING_START]);
assert.equal(rpcLabel('https://base-rpc.publicnode.com'),'base-rpc.publicnode.com');
assert.equal(rpcLabel('not-a-url'),'configured-rpc');

const cfg={rpcEnv:'TEST_RPC_URL',rpcFallbacks:['https://fallback-one.example','https://fallback-two.example','https://fallback-one.example']};
assert.deepEqual(historicalRpcUrls(cfg,{TEST_RPC_URL:'https://configured.example'}),[
  'https://configured.example',
  'https://fallback-one.example',
  'https://fallback-two.example'
]);
assert.deepEqual(historicalRpcUrls(cfg,{}),['https://fallback-one.example','https://fallback-two.example']);
assert.equal(requireHistoricalRpc({VE33_REQUIRE_HISTORICAL_RPC:'1'}),true);
assert.equal(requireHistoricalRpc({VE33_REQUIRE_HISTORICAL_RPC:'true'}),true);
assert.equal(requireHistoricalRpc({VE33_REQUIRE_HISTORICAL_RPC:'yes'}),true);
assert.equal(requireHistoricalRpc({VE33_REQUIRE_HISTORICAL_RPC:'0'}),false);
assert.equal(requireHistoricalRpc({}),false);

for(const key of ['aerodrome','velodrome']){
  const p=PROTOCOLS[key];
  assert.ok(p?.rpcEnv);
  assert.ok(Array.isArray(p?.rpcFallbacks)&&p.rpcFallbacks.length>=2);
  assert.ok(historicalRpcUrls(p,{}).length>=2,`${key} must keep multiple existing historical RPC candidates`);
}

console.log('ve33 capability-aware historical RPC runner validation OK');
