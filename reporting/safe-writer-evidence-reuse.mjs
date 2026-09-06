#!/usr/bin/env node
import crypto from 'node:crypto';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const DEFAULT_MAX_AGE_MINUTES=45;
const GENERATED_DATA_COMMIT='data: update reporting and canonical income ledger';

function sha256(value){
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function git(args,{root=process.cwd()}={}){
  return execFileSync('git',args,{cwd:root,encoding:'utf8',maxBuffer:2*1024*1024,stdio:['ignore','pipe','pipe']}).trim();
}

export function safeWriterPublishContext({root=process.cwd(),env=process.env}={}){
  if(String(env?.GITHUB_ACTIONS||'').toLowerCase()!=='true')return false;
  try{return git(['log','-1','--pretty=%s'],{root})===GENERATED_DATA_COMMIT;}
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
  return sha256(JSON.stringify({
    rewardsHash:sha256(JSON.stringify(rewards||{})),
    blobs,
    extra
  }));
}

export function evidenceFreshEnough(generatedAt,{now=Date.now(),maxAgeMinutes=DEFAULT_MAX_AGE_MINUTES}={}){
  const t=Date.parse(generatedAt||'');
  if(!Number.isFinite(t))return false;
  const ageMinutes=(now-t)/60_000;
  return ageMinutes>=0&&ageMinutes<=Number(maxAgeMinutes);
}

export function canReuseEvidence({previous,fingerprint,root=process.cwd(),env=process.env,maxAgeMinutes=DEFAULT_MAX_AGE_MINUTES,previousFingerprint=null}={}){
  if(!safeWriterPublishContext({root,env}))return false;
  const stored=previousFingerprint??previous?.runner?.safeWriterInputFingerprint??previous?.provenance?.safeWriterInputFingerprint??null;
  if(!stored||stored!==fingerprint)return false;
  return evidenceFreshEnough(previous?.generatedAt,{maxAgeMinutes});
}

export const SAFE_WRITER_EVIDENCE_REUSE={
  version:'0.1-bounded-publication-reuse',
  generatedDataCommit:GENERATED_DATA_COMMIT,
  maxAgeMinutes:DEFAULT_MAX_AGE_MINUTES,
  semantics:{
    reuseOnlyInsideGeneratedDataPublishCommit:true,
    sourceFingerprintMustMatch:true,
    staleEvidenceReuseForbidden:true,
    currentChainRefreshRemainsDefaultOutsidePublish:true,
    executionAuthority:'none'
  }
};
