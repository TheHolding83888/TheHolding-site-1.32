#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT=process.cwd();
const SOURCE=process.env.COMPANY_010_RECONCILIATION_INPUT||path.join(ROOT,'companies/company-010-reconciliation.json');
const recon=JSON.parse(fs.readFileSync(SOURCE,'utf8'));
if(recon?.version!=='0.2-company-010-capital-reconciliation-stakedao-base')throw new Error('Company #010 reconciliation v0.2 required');
if(recon?.authority?.executionAuthority!=='none'||recon?.ownerPolicy?.fluid?.status!=='out-of-scope')throw new Error('Company #010 reconciliation policy/authority mismatch');
const stakeDao=recon?.stakeDaoBase;
const stakeDaoUsd=Number(stakeDao?.result?.totalPositionUsd);
if(stakeDao?.ok!==true||!stakeDao?.result||!Number.isFinite(stakeDaoUsd)||stakeDaoUsd<0)throw new Error('Stake DAO reconciliation must be factually resolved before baseline build');

// A factual zero is a valid current-state result, not an UNKNOWN. The downstream
// overlay decides whether an active capital row exists; the legacy bridge only
// requires a complete non-negative reconciliation result.
// Transitional compatibility boundary only: the established v0.2 production-state
// builder consumes the Aave/HyperLend/cvxCRV fields whose schema is unchanged.
// Stake DAO and the owner-policy completeness promotion are applied by the next
// explicit overlay. We never mutate the canonical reconciliation file.
const tmp=path.join(os.tmpdir(),`company-010-reconciliation-legacy-${process.pid}.json`);
fs.writeFileSync(tmp,JSON.stringify({...recon,version:'0.1-company-010-capital-reconciliation'},null,2)+'\n');
try{
  const child=spawnSync(process.execPath,['onboarding/company-010-production-state.mjs'],{cwd:ROOT,stdio:'inherit',env:{...process.env,COMPANY_010_RECONCILIATION_INPUT:tmp}});
  if(child.status!==0)process.exit(child.status??1);
}finally{try{fs.unlinkSync(tmp)}catch{}}
console.log(JSON.stringify({status:'PASS',bridge:'reconciliation-v0.2-to-established-baseline',canonicalSourceMutated:false,stakeDaoCurrentPositionUsd:stakeDaoUsd,stakeDaoCurrentPositionActive:stakeDaoUsd>0,stakeDaoOverlayRequired:true,executionAuthority:'none'},null,2));
