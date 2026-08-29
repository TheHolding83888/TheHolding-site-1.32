#!/usr/bin/env node
/**
 * The Holding · generic ERC20 + ERC4626 exact-block asset state collector v0.1
 *
 * Protocol-agnostic read-only primitive for one ERC20 asset and one ERC4626
 * vault sharing that asset. Optional operational contracts are checked only for
 * deployed bytecode presence. No price, causal, recommendation or execution
 * authority is introduced.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ERC20_ERC4626_ASSET_STATE_VERSION='0.1-generic-exact-block-erc20-erc4626';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const RPC_REGISTRY_FILE=path.join(ROOT,'intelligence/market-data/onchain-price-source-registry.json');
const RPC_TIMEOUT_MS=10_000;
const SELECTOR_TOTAL_SUPPLY='0x18160ddd';
const SELECTOR_TOTAL_ASSETS='0x01e1d114';
const SELECTOR_DECIMALS='0x313ce567';

function decodeUint256(hex){
  const clean=String(hex||'').replace(/^0x/,'');
  if(clean.length<64||!/^[0-9a-f]+$/i.test(clean))throw new Error('Invalid uint256 ABI result');
  return BigInt(`0x${clean.slice(0,64)}`);
}
function decodeRpcQuantity(hex){
  if(!/^0x[0-9a-f]+$/i.test(String(hex||'')))throw new Error('Invalid RPC quantity');
  return BigInt(hex);
}
function unitsToString(raw,decimals){
  const d=Number(decimals);
  if(!Number.isInteger(d)||d<0||d>36)throw new Error(`Invalid decimals ${decimals}`);
  const base=10n**BigInt(d),whole=raw/base,fraction=(raw%base).toString().padStart(d,'0').replace(/0+$/,'');
  return `${whole.toString()}${fraction?'.'+fraction:''}`;
}
function round(value,digits=12){const n=Number(value);return Number.isFinite(n)?Number(n.toFixed(digits)):null;}
function address(value,label){
  const v=String(value||'');
  if(!/^0x[0-9a-fA-F]{40}$/.test(v))throw new Error(`${label} address invalid`);
  return v;
}
function readRpcRegistry(){return JSON.parse(fs.readFileSync(RPC_REGISTRY_FILE,'utf8'));}
async function postBatch(url,payload,fetchImpl){
  const response=await fetchImpl(url,{method:'POST',headers:{'content-type':'application/json',accept:'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(RPC_TIMEOUT_MS)});
  if(!response.ok)throw new Error(`RPC HTTP ${response.status}`);
  const body=await response.json();
  if(!Array.isArray(body))throw new Error('RPC response is not an array');
  const byId=new Map(body.map(row=>[Number(row?.id),row]));
  for(const req of payload){
    const row=byId.get(req.id);
    if(!row)throw new Error(`RPC result ${req.id} missing`);
    if(row.error)throw new Error(`RPC ${req.method} error: ${row.error?.message||'unknown error'}`);
    if(row.result===undefined||row.result===null)throw new Error(`RPC ${req.method} result missing`);
  }
  return byId;
}

export async function collectErc20Erc4626AssetState({config,rpcRegistry=null,fetchImpl=fetch,checkpoint=null}={}){
  if(!config||typeof config!=='object')throw new Error('Generic ERC20/ERC4626 collector requires config');
  const networkKey=String(config.network||'');
  const sourceRegistry=rpcRegistry||readRpcRegistry();
  const network=sourceRegistry?.networks?.[networkKey];
  const expectedChainId=Number(config.chainId);
  const endpoints=Array.isArray(network?.rpcFailover)?network.rpcFailover:[];
  const assetAddress=address(config?.asset?.address,'asset');
  const vaultAddress=address(config?.vault?.address,'vault');
  const operationalContracts=Object.fromEntries(Object.entries(config?.operationalContracts||{}).map(([key,value])=>[key,address(value,`operational ${key}`)]));
  const attempts=[];
  if(Number(network?.chainId)!==expectedChainId||!endpoints.length)throw new Error(`RPC registry unavailable for ${networkKey}/${expectedChainId}`);

  for(const endpoint of endpoints){
    try{
      let blockTag=checkpoint?.blockTag||null;
      if(blockTag&&!/^0x[0-9a-f]+$/i.test(String(blockTag)))throw new Error('Invalid supplied checkpoint blockTag');
      if(!blockTag){
        const phase1=await postBatch(endpoint.url,[{jsonrpc:'2.0',id:1,method:'eth_blockNumber',params:[]}],fetchImpl);
        blockTag=phase1.get(1).result;
      }
      const codeTargets=[['asset',assetAddress],['vault',vaultAddress],...Object.entries(operationalContracts)];
      let id=100;
      const calls=[
        {jsonrpc:'2.0',id:2,method:'eth_getBlockByNumber',params:[blockTag,false]},
        {jsonrpc:'2.0',id:10,method:'eth_call',params:[{to:assetAddress,data:SELECTOR_TOTAL_SUPPLY},blockTag]},
        {jsonrpc:'2.0',id:11,method:'eth_call',params:[{to:assetAddress,data:SELECTOR_DECIMALS},blockTag]},
        {jsonrpc:'2.0',id:20,method:'eth_call',params:[{to:vaultAddress,data:SELECTOR_TOTAL_SUPPLY},blockTag]},
        {jsonrpc:'2.0',id:21,method:'eth_call',params:[{to:vaultAddress,data:SELECTOR_TOTAL_ASSETS},blockTag]},
        {jsonrpc:'2.0',id:22,method:'eth_call',params:[{to:vaultAddress,data:SELECTOR_DECIMALS},blockTag]}
      ];
      const codeIds={};
      for(const [key,target] of codeTargets){codeIds[key]=id;calls.push({jsonrpc:'2.0',id,method:'eth_getCode',params:[target,blockTag]});id+=1;}
      const phase2=await postBatch(endpoint.url,calls,fetchImpl);
      const block=phase2.get(2).result;
      const blockNumber=Number(decodeRpcQuantity(block?.number||blockTag));
      const timestampSeconds=Number(decodeRpcQuantity(block?.timestamp));
      if(!(blockNumber>0)||!(timestampSeconds>0)||!/^0x[0-9a-f]{64}$/i.test(String(block?.hash||'')))throw new Error('Exact block identity unavailable');

      const assetRaw=decodeUint256(phase2.get(10).result),assetDecimals=Number(decodeUint256(phase2.get(11).result));
      const sharesRaw=decodeUint256(phase2.get(20).result),assetsRaw=decodeUint256(phase2.get(21).result),vaultDecimals=Number(decodeUint256(phase2.get(22).result));
      if(sharesRaw<=0n||assetsRaw<=0n)throw new Error('ERC4626 totalSupply/totalAssets unavailable or zero');
      if(!Number.isInteger(assetDecimals)||!Number.isInteger(vaultDecimals)||assetDecimals<0||vaultDecimals<0||assetDecimals>36||vaultDecimals>36)throw new Error('Token decimals invalid');
      const codePresence={};
      for(const [key,target] of codeTargets){
        const code=String(phase2.get(codeIds[key]).result||'');
        codePresence[key]={address:target,deployed:/^0x[0-9a-f]+$/i.test(code)&&code!=='0x'&&code!=='0x0',byteLength:code.length>2?Math.floor((code.length-2)/2):0};
        if(!codePresence[key].deployed)throw new Error(`No deployed bytecode for ${key}`);
      }

      const assetSupply=Number(unitsToString(assetRaw,assetDecimals));
      const vaultSupply=Number(unitsToString(sharesRaw,vaultDecimals));
      const vaultTotalAssets=Number(unitsToString(assetsRaw,assetDecimals));
      const sharePriceAsset=vaultTotalAssets/vaultSupply;
      if(!Number.isFinite(assetSupply)||!Number.isFinite(vaultSupply)||!Number.isFinite(vaultTotalAssets)||!(sharePriceAsset>0))throw new Error('Decoded ERC20/ERC4626 state invalid');
      return {
        version:ERC20_ERC4626_ASSET_STATE_VERSION,status:'ok',measurementClass:'MEASURED',observedAt:new Date(timestampSeconds*1000).toISOString(),
        network:networkKey,chainId:expectedChainId,blockNumber,blockTag,blockHash:block.hash,
        asset:{label:config.asset.label||'asset',address:assetAddress,decimals:assetDecimals,totalSupplyRaw:assetRaw.toString(),totalSupply:round(assetSupply,8)},
        vault:{label:config.vault.label||'vault',address:vaultAddress,decimals:vaultDecimals,totalSupplyRaw:sharesRaw.toString(),totalSupply:round(vaultSupply,8),totalAssetsRaw:assetsRaw.toString(),totalAssets:round(vaultTotalAssets,8),sharePriceAsset:round(sharePriceAsset,12)},
        operationalCode:codePresence,
        rpc:{endpointId:endpoint.id,failoverAttempts:attempts},
        epistemic:{sourceType:'onchain-public-rpc-exact-block',currentStateMeasured:true,sharePriceMechanicalIdentity:'PROVEN-current-exact-block',operationalCodePresenceOnly:true,unknownIsZero:false,productionPriceAuthority:false,causalClaimAuthority:'none',executionAuthority:'none'}
      };
    }catch(error){attempts.push({endpointId:endpoint.id,error:error instanceof Error?error.message:String(error)});}
  }
  return {version:ERC20_ERC4626_ASSET_STATE_VERSION,status:'UNKNOWN-rpc-read-failed',measurementClass:'UNKNOWN',observedAt:null,network:networkKey,chainId:expectedChainId,asset:{label:config.asset.label||'asset',address:assetAddress,totalSupply:null},vault:{label:config.vault.label||'vault',address:vaultAddress,totalSupply:null,totalAssets:null,sharePriceAsset:null},operationalCode:null,rpc:{endpointId:null,failoverAttempts:attempts},epistemic:{sourceType:'onchain-public-rpc-exact-block',currentStateMeasured:false,unknownIsZero:false,productionPriceAuthority:false,causalClaimAuthority:'none',executionAuthority:'none'}};
}
