#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { JsonRpcProvider } from 'ethers';
import { PROTOCOLS, DIRECT_ACCOUNTING_START, blockAtOrBefore } from './ve33-accounting-evidence.mjs';
import {
  VERSION as RECOVERY_VERSION,
  DEFAULT_SCAN_CHUNK_BLOCKS,
  DEFAULT_SCAN_OVERLAP_BLOCKS,
  RECOVERY_SEMANTICS,
  directTrackedPositions,
  discoverProtocolTransientClaims,
  buildRecoveryState
} from './ve33-transient-claim-recovery.mjs';

const __filename=fileURLToPath(import.meta.url);
const __dirname=path.dirname(__filename);
const ROOT=path.resolve(__dirname,'..');

export const VERSION='0.1-ve33-transient-claim-recovery-writer';
const DEFAULT_REWARDS=process.env.REWARDS_DATA_FILE||path.join(ROOT,'companies','rewards-data.json');
const DEFAULT_EVIDENCE=process.env.VE33_EVIDENCE_FILE||path.join(ROOT,'reporting','ve33-accounting-evidence.json');
const DEFAULT_RECOVERY=process.env.VE33_TRANSIENT_RECOVERY_FILE||path.join(ROOT,'reporting','ve33-transient-claim-recovery.json');
const REQUEST_SPACING_MS=Math.max(0,Math.min(2_000,Number(process.env.VE33_RECOVERY_REQUEST_SPACING_MS||220)));
const SCAN_CHUNK_BLOCKS=Math.max(100,Math.min(20_000,Number(process.env.VE33_RECOVERY_SCAN_CHUNK_BLOCKS||DEFAULT_SCAN_CHUNK_BLOCKS)));
const SCAN_OVERLAP_BLOCKS=Math.max(0,Math.min(50_000,Number(process.env.VE33_RECOVERY_SCAN_OVERLAP_BLOCKS||DEFAULT_SCAN_OVERLAP_BLOCKS)));

const unique=values=>[...new Set((values||[]).filter(Boolean))];
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function readJson(file,fallback={}){try{return JSON.parse(await fs.readFile(file,'utf8'));}catch{return fallback;}}
async function writeJson(file,data){await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,JSON.stringify(data,null,2)+'\n');}

export function rpcLabel(url){try{return new URL(String(url)).hostname||'configured-rpc';}catch{return'configured-rpc';}}

export function recoveryRpcUrls(cfg,env=process.env){
  // Configured infrastructure is first. For public fallbacks prefer the second
  // canonical fallback (Base/Optimism official endpoint) before publicnode:
  // exact LAPTOP forensics proved publicnode can answer latest-block while
  // refusing an old transaction receipt.
  return unique([env?.[cfg.rpcEnv],...[...(cfg.rpcFallbacks||[])].reverse()]);
}

export function createRpcOperationRouter({cfg,env=process.env,providerFactory=null,requestSpacingMs=REQUEST_SPACING_MS}={}){
  if(!cfg)throw new Error('Recovery RPC router requires protocol config');
  const urls=recoveryRpcUrls(cfg,env);
  if(!urls.length)throw new Error(`No RPC candidates configured for ${cfg.protocol||'ve33 protocol'}`);
  const make=providerFactory||((url)=>new JsonRpcProvider(url,cfg.chainId,{staticNetwork:true}));
  const candidates=urls.map(url=>({url,label:rpcLabel(url),provider:make(url,cfg)}));
  let preferredIndex=0,nextRequestAt=0,gateTail=Promise.resolve();
  const stats={attempts:0,successes:{},failures:{},failoverCount:0,nullFallbackCount:0,lastProvider:null,failureSamples:[]};
  const pace=async()=>{
    let release;
    const prior=gateTail;
    gateTail=new Promise(resolve=>{release=resolve;});
    await prior;
    const delay=Math.max(0,nextRequestAt-Date.now());
    if(delay)await wait(delay);
    nextRequestAt=Date.now()+Math.max(0,Number(requestSpacingMs)||0);
    release();
  };
  const call=async(method,args=[],{nullIsFailure=false}={})=>{
    const order=[preferredIndex,...candidates.map((_,i)=>i).filter(i=>i!==preferredIndex)];
    let last=null;
    for(const index of order){
      const candidate=candidates[index];
      await pace();stats.attempts++;
      try{
        const fn=candidate.provider?.[method];
        if(typeof fn!=='function')throw new Error(`RPC provider missing ${method}`);
        const value=await fn.apply(candidate.provider,args);
        if(nullIsFailure&&(value===null||value===undefined)){
          stats.nullFallbackCount++;
          throw new Error(`${method} returned null`);
        }
        stats.successes[candidate.label]=(stats.successes[candidate.label]||0)+1;
        stats.lastProvider=candidate.label;
        if(index!==preferredIndex){preferredIndex=index;stats.failoverCount++;}
        return value;
      }catch(error){
        last=error;
        stats.failures[candidate.label]=(stats.failures[candidate.label]||0)+1;
        if(stats.failureSamples.length<20)stats.failureSamples.push({provider:candidate.label,method,error:error?.shortMessage||error?.message||String(error)});
      }
    }
    throw last||new Error(`${method} failed on all recovery RPC candidates`);
  };
  return{
    getBlockNumber:()=>call('getBlockNumber',[],{nullIsFailure:true}),
    getBlock:(blockTag)=>call('getBlock',[blockTag],{nullIsFailure:true}),
    getLogs:(filter)=>call('getLogs',[filter]),
    getTransaction:(hash)=>call('getTransaction',[hash],{nullIsFailure:true}),
    snapshot:()=>({
      candidateProviders:candidates.map(x=>x.label),preferredProvider:candidates[preferredIndex]?.label||null,
      requestSpacingMs:Number(requestSpacingMs)||0,attempts:stats.attempts,successes:{...stats.successes},failures:{...stats.failures},
      failoverCount:stats.failoverCount,nullFallbackCount:stats.nullFallbackCount,lastProvider:stats.lastProvider,
      failureSamples:[...stats.failureSamples]
    }),
    destroy:()=>{for(const c of candidates)try{c.provider?.destroy?.();}catch{}}
  };
}

export async function runRecoveryWriter({
  rewards,previousEvidence={},previousState={},generatedAt=new Date().toISOString(),env=process.env,
  providerRouters={},accountingStartBlocks={},protocolKeys=Object.keys(PROTOCOLS),providerFactory=null
}={}){
  const protocolResults={},rpcDiagnostics={};
  for(const protocolKey of protocolKeys){
    const cfg=PROTOCOLS[protocolKey];
    if(!cfg)throw new Error(`Unknown ve33 recovery protocol ${protocolKey}`);
    const positions=directTrackedPositions(rewards,protocolKey);
    if(!positions.length){
      protocolResults[protocolKey]={status:'no-direct-positions',claims:[],unresolved:[],scan:{fromBlock:null,toBlock:null,lastScannedBlock:null,queriedRanges:0,holderCount:0,positionCount:0,complete:true,overlapBlocks:SCAN_OVERLAP_BLOCKS},semantics:RECOVERY_SEMANTICS};
      rpcDiagnostics[protocolKey]={status:'not-needed-no-direct-positions'};
      continue;
    }
    const router=providerRouters[protocolKey]||createRpcOperationRouter({cfg,env,providerFactory});
    try{
      const latest=Number(await router.getBlockNumber());
      if(!(latest>0))throw new Error(`${protocolKey} recovery latest block unavailable`);
      const accountingStartBlock=Number(accountingStartBlocks[protocolKey])>0
        ?Number(accountingStartBlocks[protocolKey])
        :Number((await blockAtOrBefore(router,DIRECT_ACCOUNTING_START,latest,new Map())).blockNumber);
      const result=await discoverProtocolTransientClaims({
        rewards,previous:previousEvidence,recoveryState:previousState,protocolKey,provider:router,
        accountingStartBlock,latestBlockNumber:latest,scanChunkBlocks:SCAN_CHUNK_BLOCKS,scanOverlapBlocks:SCAN_OVERLAP_BLOCKS
      });
      result.scan={...result.scan,accountingStartBlock,rpc:router.snapshot?.()||null};
      protocolResults[protocolKey]=result;
      rpcDiagnostics[protocolKey]={status:'complete',...(router.snapshot?.()||{})};
    }catch(error){
      const prior=previousState?.protocols?.[protocolKey]||{};
      const message=error?.shortMessage||error?.message||String(error);
      protocolResults[protocolKey]={
        status:'partial',claims:prior.claims||[],
        unresolved:[...(prior.unresolved||[]),{reason:'protocol-scan-failed',error:message}],
        scan:{
          fromBlock:null,toBlock:null,lastScannedBlock:prior.lastScannedBlock??null,queriedRanges:0,
          holderCount:new Set(positions.map(x=>String(x.holder).toLowerCase())).size,positionCount:positions.length,
          complete:false,overlapBlocks:SCAN_OVERLAP_BLOCKS,rpc:router.snapshot?.()||null
        },
        semantics:RECOVERY_SEMANTICS
      };
      rpcDiagnostics[protocolKey]={status:'partial-scan-failed',error:message,...(router.snapshot?.()||{})};
    }finally{
      if(!providerRouters[protocolKey])router.destroy?.();
    }
  }

  const output=buildRecoveryState({previousState,protocolResults,generatedAt});
  output.writer={
    version:VERSION,recoveryVersion:RECOVERY_VERSION,
    policy:'tracked-holder ClaimRewards discovery only; no economic admission; overlap cursor persisted per protocol; failed protocol scans preserve prior cursor and remain partial',
    scanChunkBlocks:SCAN_CHUNK_BLOCKS,scanOverlapBlocks:SCAN_OVERLAP_BLOCKS,
    rpc:rpcDiagnostics,executionAuthority:'none',capitalExecution:false
  };
  return output;
}

async function main(){
  const[rewards,previousEvidence,previousState]=await Promise.all([
    readJson(DEFAULT_REWARDS),readJson(DEFAULT_EVIDENCE,{}),readJson(DEFAULT_RECOVERY,{})
  ]);
  const output=await runRecoveryWriter({rewards,previousEvidence,previousState});
  await writeJson(DEFAULT_RECOVERY,output);
  console.log('ve33 transient ClaimRewards recovery state built',{
    status:output.status,
    claims:Object.fromEntries(Object.entries(output.protocols||{}).map(([k,v])=>[k,(v.claims||[]).length])),
    unresolved:Object.fromEntries(Object.entries(output.protocols||{}).map(([k,v])=>[k,(v.unresolved||[]).length])),
    lastScannedBlock:Object.fromEntries(Object.entries(output.protocols||{}).map(([k,v])=>[k,v.lastScannedBlock||null])),
    executionAuthority:output.authority?.executionAuthority
  });
}

if(process.argv[1]&&path.resolve(process.argv[1])===__filename)main().catch(error=>{console.error(error);process.exitCode=1;});
