#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { execFileSync } from 'node:child_process';
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
export const SAFE_WRITER_EVIDENCE_REUSE=Object.freeze({
  version:'0.1-bounded-publication-reuse',
  generatedDataCommit:'data: update reporting and canonical income ledger',
  maxAgeMinutes:45,
  semantics:{
    reuseOnlyInsideGeneratedDataPublishCommit:true,
    sourceFingerprintMustMatch:true,
    staleEvidenceReuseForbidden:true,
    currentChainRefreshRemainsDefaultOutsidePublish:true,
    executionAuthority:'none'
  }
});
const DEFAULT_REWARDS=process.env.REWARDS_DATA_FILE||path.join(ROOT,'companies','rewards-data.json');
const DEFAULT_OUTPUT=process.env.VE33_EVIDENCE_FILE||path.join(ROOT,'reporting','ve33-accounting-evidence.json');
const RPC_PROBE_TIMEOUT_MS=Math.max(2_000,Math.min(30_000,Number(process.env.VE33_HISTORICAL_RPC_PROBE_TIMEOUT_MS||10_000)));
const CURRENT_BLOCK_MARGIN=Math.max(32,Math.min(8_192,Number(process.env.VE33_CURRENT_BLOCK_MARGIN||1_024)));

const unique=values=>[...new Set((values||[]).filter(Boolean))];
const waitTimeout=(promise,ms,label)=>Promise.race([
  promise,
  new Promise((_,reject)=>setTimeout(()=>reject(new Error(`${label} timeout after ${ms}ms`)),ms))
]);
const sha256=value=>crypto.createHash('sha256').update(String(value)).digest('hex');

function git(args,{root=process.cwd()}={}){
  return execFileSync('git',args,{cwd:root,encoding:'utf8',maxBuffer:2*1024*1024,stdio:['ignore','pipe','pipe']}).trim();
}

export function safeWriterPublishContext({root=process.cwd(),env=process.env}={}){
  if(String(env?.GITHUB_ACTIONS||'').toLowerCase()!=='true')return false;
  try{return git(['log','-1','--pretty=%s'],{root})===SAFE_WRITER_EVIDENCE_REUSE.generatedDataCommit;}
  catch{return false;}
}

export function evidenceInputFingerprint({
  rewards,
  root=process.cwd(),
  extra={},
  repoPaths=['companies/rewards-data.json','intelligence/market-data/market-data.json','intelligence/market-data/market-data-scheduler-contract.json']
}={}){
  const blobs={};
  for(const repoPath of repoPaths){
    try{blobs[repoPath]=git(['rev-parse',`HEAD:${repoPath}`],{root});}
    catch{blobs[repoPath]=null;}
  }
  return sha256(JSON.stringify({rewardsHash:sha256(JSON.stringify(rewards||{})),blobs,extra}));
}

export function evidenceFreshEnough(generatedAt,{now=Date.now(),maxAgeMinutes=SAFE_WRITER_EVIDENCE_REUSE.maxAgeMinutes}={}){
  const t=Date.parse(generatedAt||'');
  if(!Number.isFinite(t))return false;
  const ageMinutes=(now-t)/60_000;
  return ageMinutes>=0&&ageMinutes<=Number(maxAgeMinutes);
}

export function canReuseEvidence({previous,fingerprint,root=process.cwd(),env=process.env,maxAgeMinutes=SAFE_WRITER_EVIDENCE_REUSE.maxAgeMinutes,previousFingerprint=null}={}){
  if(!safeWriterPublishContext({root,env}))return false;
  const stored=previousFingerprint??previous?.runner?.safeWriterInputFingerprint??previous?.provenance?.safeWriterInputFingerprint??null;
  if(!stored||stored!==fingerprint)return false;
  return evidenceFreshEnough(previous?.generatedAt,{maxAgeMinutes});
}

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

export function numericBlockTag(value){
  if(typeof value==='number'&&Number.isFinite(value))return Number(value);
  if(typeof value==='bigint')return Number(value);
  if(typeof value==='string'&&/^0x[0-9a-f]+$/i.test(value))return Number.parseInt(value,16);
  if(typeof value==='string'&&/^\d+$/.test(value))return Number(value);
  return null;
}

export function historicalCallBlockTag(args,currentBlockNumber,margin=CURRENT_BLOCK_MARGIN){
  const tx=args?.[0]||null,explicit=args?.length>1?args[1]:undefined,tag=explicit??tx?.blockTag??null,n=numericBlockTag(tag);
  return Number.isFinite(n)&&n<Number(currentBlockNumber)-Number(margin)?n:null;
}

async function probeCurrentCandidate({url,cfg,protocolKey,lanes}){
  const provider=new JsonRpcProvider(url,cfg.chainId,{staticNetwork:true}),label=rpcLabel(url);
  try{
    const latestNumber=Number(await waitTimeout(provider.getBlockNumber(),RPC_PROBE_TIMEOUT_MS,`${protocolKey} current latest-block ${label}`));
    if(!(latestNumber>0))throw new Error(`${protocolKey} ${label} returned invalid latest block`);
    const capability=await waitTimeout(
      probeHistoricalBoundary({provider,cfg,lanes,blockNumber:latestNumber}),
      RPC_PROBE_TIMEOUT_MS,
      `${protocolKey} current-state ${label}`
    );
    if(capability?.available!==true)throw new Error(`${protocolKey} ${label} cannot read current ve33 state: ${capability?.error||capability?.status||'unknown'}`);
    return{ok:true,provider,url,label,latestNumber,sampleTokenId:capability.sampleTokenId||null};
  }catch(error){
    try{provider.destroy();}catch{}
    return{ok:false,provider:null,url,label,latestNumber:null,error:error?.shortMessage||error?.message||String(error)};
  }
}

async function probeHistoricalCandidate({url,cfg,protocolKey,lanes}){
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
    return{ok:true,provider,url,label,latestNumber,boundaries};
  }catch(error){
    try{provider.destroy();}catch{}
    return{ok:false,provider:null,url,label,latestNumber:null,boundaries,error:error?.shortMessage||error?.message||String(error)};
  }
}

export function attachHistoricalCallRouter({currentProvider,archiveProvider,currentBlockNumber,stats={}}){
  const currentCall=currentProvider.call.bind(currentProvider),archiveCall=archiveProvider.call.bind(archiveProvider);
  Object.assign(stats,{historicalCalls:0,currentCalls:0,currentFallbackCalls:0,historicalFailures:0,currentPrimaryFailures:0,marginBlocks:CURRENT_BLOCK_MARGIN});
  currentProvider.call=async(...args)=>{
    const historicalBlock=historicalCallBlockTag(args,currentBlockNumber,CURRENT_BLOCK_MARGIN);
    if(historicalBlock!==null){
      stats.historicalCalls++;
      try{return await archiveCall(...args);}
      catch(error){stats.historicalFailures++;throw error;}
    }
    stats.currentCalls++;
    try{return await currentCall(...args);}
    catch(primaryError){
      stats.currentPrimaryFailures++;
      stats.currentFallbackCalls++;
      try{return await archiveCall(...args);}
      catch{throw primaryError;}
    }
  };
  return currentProvider;
}

export async function selectHistoricalProviders({rewards,env=process.env}={}){
  const descriptors=trackedPositionDescriptors(rewards),providers={},diagnostics={};
  for(const[protocolKey,cfg]of Object.entries(PROTOCOLS)){
    const lanes=descriptors.filter(x=>x.protocolKey===protocolKey),urls=historicalRpcUrls(cfg,env),currentAttempts=[],historicalAttempts=[];
    if(!lanes.length){
      diagnostics[protocolKey]={status:'no-lanes',selectedProvider:null,currentProvider:null,candidateProviders:urls.map(rpcLabel),currentAttempts:[],attempts:[]};
      continue;
    }

    let current=null;
    for(const url of urls){
      const result=await probeCurrentCandidate({url,cfg,protocolKey,lanes});
      currentAttempts.push({provider:result.label,ok:result.ok,error:result.error||null});
      if(result.ok){current=result;break;}
    }

    let selected=null;
    for(const url of urls){
      const result=await probeHistoricalCandidate({url,cfg,protocolKey,lanes});
      historicalAttempts.push({provider:result.label,ok:result.ok,boundaries:result.boundaries||[],error:result.error||null});
      if(result.ok){selected=result;break;}
    }

    const routingStats={};
    if(current&&selected){
      if(current.url===selected.url){
        try{selected.provider.destroy();}catch{}
        providers[protocolKey]=current.provider;
      }else{
        providers[protocolKey]=attachHistoricalCallRouter({currentProvider:current.provider,archiveProvider:selected.provider,currentBlockNumber:current.latestNumber,stats:routingStats});
      }
      diagnostics[protocolKey]={
        status:'archive-capable-provider-selected',
        selectedProvider:selected.label,
        currentProvider:current.label,
        routingMode:current.url===selected.url?'single-provider-current-and-history':'current-primary-with-archive-block-call-routing',
        routingStats,
        candidateProviders:urls.map(rpcLabel),
        requiredBoundaries:[...REQUIRED_HISTORICAL_BOUNDARIES],
        currentAttempts,
        attempts:historicalAttempts
      };
    }else if(current){
      providers[protocolKey]=current.provider;
      diagnostics[protocolKey]={
        status:'no-archive-capable-provider-selected',
        selectedProvider:null,
        currentProvider:current.label,
        routingMode:'current-only-fail-closed-history',
        routingStats,
        candidateProviders:urls.map(rpcLabel),
        requiredBoundaries:[...REQUIRED_HISTORICAL_BOUNDARIES],
        currentAttempts,
        attempts:historicalAttempts
      };
    }else{
      diagnostics[protocolKey]={
        status:'no-current-provider-selected',
        selectedProvider:selected?.label||null,
        currentProvider:null,
        routingMode:'no-provider',
        routingStats,
        candidateProviders:urls.map(rpcLabel),
        requiredBoundaries:[...REQUIRED_HISTORICAL_BOUNDARIES],
        currentAttempts,
        attempts:historicalAttempts
      };
      if(selected?.provider)try{selected.provider.destroy();}catch{}
    }
  }
  return{providers,diagnostics};
}

export async function runVe33Accounting({rewards,previous={},generatedAt=new Date().toISOString(),env=process.env}={}){
  const selection=await selectHistoricalProviders({rewards,env});
  const missing=Object.entries(selection.diagnostics).filter(([,x])=>x.status!=='archive-capable-provider-selected'&&x.status!=='no-lanes').map(([k])=>k);
  if(missing.length&&requireHistoricalRpc(env))throw new Error(`ve33 historical RPC capability missing for: ${missing.join(', ')}`);

  const output=await buildVe33Evidence({rewards,previous,generatedAt,providers:selection.providers});
  output.runner={
    version:VERSION,
    historicalRpcPolicy:'current-capable primary RPC with exact block-tagged eth_call routing to a separately proven archive-capable provider',
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
  const fingerprint=evidenceInputFingerprint({
    rewards,
    root:ROOT,
    extra:{
      runnerVersion:VERSION,
      requireHistoricalRpc:requireHistoricalRpc(process.env),
      requiredHistoricalBoundaries:[...REQUIRED_HISTORICAL_BOUNDARIES]
    }
  });

  if(canReuseEvidence({previous,fingerprint,root:ROOT,env:process.env})){
    console.log('ve33 safe-writer publication reuse',{
      status:previous.status,
      generatedAt:previous.generatedAt,
      reuseVersion:SAFE_WRITER_EVIDENCE_REUSE.version,
      executionAuthority:previous.authority?.executionAuthority||'none'
    });
    return previous;
  }

  const output=await runVe33Accounting({rewards,previous});
  output.runner.safeWriterInputFingerprint=fingerprint;
  output.runner.safeWriterEvidenceReuseVersion=SAFE_WRITER_EVIDENCE_REUSE.version;
  output.runner.safeWriterEvidenceReuseMaxAgeMinutes=SAFE_WRITER_EVIDENCE_REUSE.maxAgeMinutes;
  await writeJson(DEFAULT_OUTPUT,output);
  console.log('ve33 capability-aware accounting runner built',{
    status:output.status,
    runnerVersion:output.runner?.version,
    selectedProviders:Object.fromEntries(Object.entries(output.runner?.selection||{}).map(([k,v])=>[k,{current:v.currentProvider||null,archive:v.selectedProvider||null,mode:v.routingMode||null}])),
    boundaryFailures:Object.fromEntries(Object.entries(output.diagnostics?.protocols||{}).map(([k,v])=>[k,(v.boundaryFailures||[]).length])),
    currentStateFailures:Object.fromEntries(Object.entries(output.diagnostics?.protocols||{}).map(([k,v])=>[k,Number(v.currentStateFailureCount||0)])),
    stateFailures:Object.fromEntries(Object.entries(output.diagnostics?.protocols||{}).map(([k,v])=>[k,v.stateFailureCounts||{}])),
    accepted:output.diagnostics?.acceptedPositiveIntervalCount||0,
    historicalPriceResolved:output.diagnostics?.historicalPriceResolvedIntervalCount||0,
    executionAuthority:output.authority?.executionAuthority
  });
}

if(process.argv[1]&&path.resolve(process.argv[1])===__filename)main().catch(error=>{console.error(error);process.exitCode=1;});
