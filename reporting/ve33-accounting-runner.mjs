#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { JsonRpcProvider } from 'ethers';
import {
  PROTOCOLS,
  DIRECT_ACCOUNTING_START,
  FULL_ACCOUNTING_START,
  blockAtOrBefore,
  probeHistoricalBoundary,
  trackedPositionDescriptors,
  buildVe33Evidence
} from './ve33-accounting-evidence.mjs';

const __filename=fileURLToPath(import.meta.url);
const __dirname=path.dirname(__filename);
const ROOT=path.resolve(__dirname,'..');

export const VERSION='0.1-ve33-capability-aware-historical-rpc-runner';
export const REQUIRED_HISTORICAL_BOUNDARIES=Object.freeze([DIRECT_ACCOUNTING_START,FULL_ACCOUNTING_START]);
const DEFAULT_REWARDS=process.env.REWARDS_DATA_FILE||path.join(ROOT,'companies','rewards-data.json');
const DEFAULT_OUTPUT=process.env.VE33_EVIDENCE_FILE||path.join(ROOT,'reporting','ve33-accounting-evidence.json');
const RPC_PROBE_TIMEOUT_MS=Math.max(2_000,Math.min(30_000,Number(process.env.VE33_HISTORICAL_RPC_PROBE_TIMEOUT_MS||10_000)));

const unique=values=>[...new Set((values||[]).filter(Boolean))];
const waitTimeout=(promise,ms,label)=>Promise.race([
  promise,
  new Promise((_,reject)=>setTimeout(()=>reject(new Error(`${label} timeout after ${ms}ms`)),ms))
]);

async function readJson(file,fallback={}){try{return JSON.parse(await fs.readFile(file,'utf8'));}catch{return fallback;}}
async function writeJson(file,data){await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,JSON.stringify(data,null,2)+'\n');}

export function rpcLabel(url){
  try{return new URL(String(url)).hostname||'configured-rpc';}
  catch{return'configured-rpc';}
}

export function historicalRpcUrls(cfg,env=process.env){
  return unique([env?.[cfg.rpcEnv],...(cfg.rpcFallbacks||[])]);
}

export function requireHistoricalRpc(env=process.env){
  return /^(1|true|yes)$/i.test(String(env?.VE33_REQUIRE_HISTORICAL_RPC||''));
}

async function probeCandidate({url,cfg,protocolKey,lanes}){
  const provider=new JsonRpcProvider(url,cfg.chainId,{staticNetwork:true});
  const label=rpcLabel(url),boundaries=[];
  try{
    const latestNumber=Number(await waitTimeout(provider.getBlockNumber(),RPC_PROBE_TIMEOUT_MS,`${protocolKey} latest-block ${label}`));
    if(!(latestNumber>0))throw new Error(`${protocolKey} ${label} returned invalid latest block`);
    const cache=new Map();
    for(const boundaryAt of REQUIRED_HISTORICAL_BOUNDARIES){
      const boundary=await blockAtOrBefore(provider,boundaryAt,latestNumber,cache);
      const capability=await waitTimeout(
        probeHistoricalBoundary({provider,cfg,lanes,blockNumber:boundary.blockNumber}),
        RPC_PROBE_TIMEOUT_MS,
        `${protocolKey} historical-state ${label} ${boundaryAt}`
      );
      boundaries.push({
        boundaryAt,
        blockNumber:Number(boundary.blockNumber),
        blockTimestamp:boundary.blockTimestamp,
        available:capability?.available===true,
        status:capability?.status||'unknown',
        sampleTokenId:capability?.sampleTokenId||null,
        error:capability?.error||null
      });
      if(capability?.available!==true)throw new Error(`${protocolKey} ${label} cannot read historical state at ${boundaryAt}: ${capability?.error||capability?.status||'unknown'}`);
    }
    return{ok:true,provider,label,latestNumber,boundaries};
  }catch(error){
    try{provider.destroy();}catch{}
    return{ok:false,provider:null,label,latestNumber:null,boundaries,error:error?.shortMessage||error?.message||String(error)};
  }
}

export async function selectHistoricalProviders({rewards,env=process.env}={}){
  const descriptors=trackedPositionDescriptors(rewards),providers={},diagnostics={};
  for(const[protocolKey,cfg]of Object.entries(PROTOCOLS)){
    const lanes=descriptors.filter(x=>x.protocolKey===protocolKey),urls=historicalRpcUrls(cfg,env),attempts=[];
    if(!lanes.length){
      diagnostics[protocolKey]={status:'no-lanes',selectedProvider:null,candidateProviders:urls.map(rpcLabel),attempts:[]};
      continue;
    }
    let selected=null;
    for(const url of urls){
      const result=await probeCandidate({url,cfg,protocolKey,lanes});
      attempts.push({provider:result.label,ok:result.ok,boundaries:result.boundaries||[],error:result.error||null});
      if(result.ok){selected=result;break;}
    }
    if(selected){
      providers[protocolKey]=selected.provider;
      diagnostics[protocolKey]={
        status:'archive-capable-provider-selected',
        selectedProvider:selected.label,
        candidateProviders:urls.map(rpcLabel),
        requiredBoundaries:[...REQUIRED_HISTORICAL_BOUNDARIES],
        attempts
      };
    }else{
      diagnostics[protocolKey]={
        status:'no-archive-capable-provider-selected',
        selectedProvider:null,
        candidateProviders:urls.map(rpcLabel),
        requiredBoundaries:[...REQUIRED_HISTORICAL_BOUNDARIES],
        attempts
      };
    }
  }
  return{providers,diagnostics};
}

export async function runVe33Accounting({rewards,previous={},generatedAt=new Date().toISOString(),env=process.env}={}){
  const selection=await selectHistoricalProviders({rewards,env});
  const missing=Object.entries(selection.diagnostics).filter(([,x])=>x.status==='no-archive-capable-provider-selected').map(([k])=>k);
  if(missing.length&&requireHistoricalRpc(env))throw new Error(`ve33 historical RPC capability missing for: ${missing.join(', ')}`);

  const output=await buildVe33Evidence({rewards,previous,generatedAt,providers:selection.providers});
  output.runner={
    version:VERSION,
    historicalRpcPolicy:'capability-aware candidate selection across existing protocol RPC endpoints before factual boundary reconstruction',
    requiredHistoricalBoundaries:[...REQUIRED_HISTORICAL_BOUNDARIES],
    requireHistoricalRpc:requireHistoricalRpc(env),
    selection:selection.diagnostics,
    executionAuthority:'none',
    capitalExecution:false
  };
  for(const[protocolKey,diag]of Object.entries(selection.diagnostics)){
    if(output?.diagnostics?.protocols?.[protocolKey])output.diagnostics.protocols[protocolKey].historicalStateRpcSelection=diag;
  }
  return output;
}

async function main(){
  const[rewards,previous]=await Promise.all([readJson(DEFAULT_REWARDS),readJson(DEFAULT_OUTPUT,{})]);
  const output=await runVe33Accounting({rewards,previous});
  await writeJson(DEFAULT_OUTPUT,output);
  console.log('ve33 capability-aware accounting runner built',{
    status:output.status,
    runnerVersion:output.runner?.version,
    selectedProviders:Object.fromEntries(Object.entries(output.runner?.selection||{}).map(([k,v])=>[k,v.selectedProvider||null])),
    boundaryFailures:Object.fromEntries(Object.entries(output.diagnostics?.protocols||{}).map(([k,v])=>[k,(v.boundaryFailures||[]).length])),
    accepted:output.diagnostics?.acceptedPositiveIntervalCount||0,
    historicalPriceResolved:output.diagnostics?.historicalPriceResolvedIntervalCount||0,
    executionAuthority:output.authority?.executionAuthority
  });
}

if(process.argv[1]&&path.resolve(process.argv[1])===__filename)main().catch(error=>{console.error(error);process.exitCode=1;});
