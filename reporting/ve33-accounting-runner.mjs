#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { Contract, JsonRpcProvider, formatUnits } from 'ethers';
import {
  PROTOCOLS,
  DIRECT_ACCOUNTING_START,
  FULL_ACCOUNTING_START,
  blockAtOrBefore,
  probeHistoricalBoundary,
  trackedPositionDescriptors,
  buildVe33Evidence,
  reconcileEntitlement
} from './ve33-accounting-evidence.mjs';
import { addRecoveryShadowRows } from './ve33-transient-claim-recovery.mjs';

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
export const TRANSIENT_RECOVERY_POLICY=Object.freeze({
  version:'0.2-exact-claim-block-reconciliation',
  discoveryOnly:true,
  createsIncome:false,
  createsRealisedCashFlow:false,
  canonicalVe33EvidenceRemainsEconomicAuthority:true,
  invalidAuthorityInput:'ignore-fail-closed',
  predeploymentZeroBaselineRequiresExactHistoricalCodeAbsence:true,
  exactClaimBlockStateRequiredBeforeCanonicalAdmission:true,
  claimSettlementAloneCreatesIncome:false,
  historicalUsdRemainsUnknownUntilIndependentValuation:true,
  executionAuthority:'none',
  capitalExecution:false
});
const DEFAULT_REWARDS=process.env.REWARDS_DATA_FILE||path.join(ROOT,'companies','rewards-data.json');
const DEFAULT_RECOVERY=process.env.VE33_TRANSIENT_RECOVERY_FILE||path.join(ROOT,'reporting','ve33-transient-claim-recovery.json');
const DEFAULT_OUTPUT=process.env.VE33_EVIDENCE_FILE||path.join(ROOT,'reporting','ve33-accounting-evidence.json');
const RPC_PROBE_TIMEOUT_MS=Math.max(2_000,Math.min(30_000,Number(process.env.VE33_HISTORICAL_RPC_PROBE_TIMEOUT_MS||10_000)));
const CURRENT_BLOCK_MARGIN=Math.max(32,Math.min(8_192,Number(process.env.VE33_CURRENT_BLOCK_MARGIN||1_024)));
const RECOVERY_STATE_TIMEOUT_MS=Math.max(2_000,Math.min(30_000,Number(process.env.VE33_RECOVERY_STATE_TIMEOUT_MS||10_000)));
const RECOVERY_REWARD_ABI=['function earned(address token,uint256 tokenId) view returns (uint256)'];
const RECOVERY_VE_ABI=['function ownerOf(uint256 tokenId) view returns (address)'];
const RECOVERY_ERC20_ABI=['function decimals() view returns (uint8)','function symbol() view returns (string)'];

const unique=values=>[...new Set((values||[]).filter(Boolean))];
const lower=value=>String(value||'').toLowerCase();
const waitTimeout=(promise,ms,label)=>Promise.race([
  promise,
  new Promise((_,reject)=>setTimeout(()=>reject(new Error(`${label} timeout after ${ms}ms`)),ms))
]);
const sha256=value=>crypto.createHash('sha256').update(String(value)).digest('hex');
const round=(value,digits=12)=>Number.isFinite(Number(value))?Number(Number(value).toFixed(digits)):null;

function git(args,{root=process.cwd()}={}){
  return execFileSync('git',args,{cwd:root,encoding:'utf8',maxBuffer:2*1024*1024,stdio:['ignore','pipe','pipe']}).trim();
}

export function safeWriterPublishContext({root=process.cwd(),env=process.env}={}){
  if(String(env?.GITHUB_ACTIONS||'').toLowerCase()!=='true')return false;
  try{return git(['log','-1','--pretty=%s'],{root})===SAFE_WRITER_EVIDENCE_REUSE.generatedDataCommit;}
  catch{return false;}
}

export function recoveryClaims(recovery={}){
  const claims=[];
  for(const[protocolKey,protocol]of Object.entries(recovery?.protocols||{})){
    for(const claim of protocol?.claims||[])claims.push({...claim,protocolKey:claim?.protocolKey||protocolKey});
  }
  return claims;
}

export function recoveryAuthorityValid(recovery={}){
  const semantics=recovery?.semantics||{},authority=recovery?.authority||{};
  return semantics.discoveryOnly===true&&
    semantics.createsIncome===false&&
    semantics.createsRealisedCashFlow===false&&
    semantics.executionAuthority==='none'&&
    (authority.executionAuthority===undefined||authority.executionAuthority==='none')&&
    (authority.capitalExecution===undefined||authority.capitalExecution===false);
}

export function applyTransientClaimRecovery(rewards,recovery={}){
  const provided=Boolean(recovery&&typeof recovery==='object'&&Object.keys(recovery).length);
  const claims=recoveryClaims(recovery);
  const base={
    policyVersion:TRANSIENT_RECOVERY_POLICY.version,
    sidecarVersion:recovery?.version||null,
    sourceStatus:recovery?.status||null,
    sourceGeneratedAt:recovery?.generatedAt||null,
    claimCount:claims.length,
    shadowRowsInserted:0,
    discoveryOnly:true,
    createsIncome:false,
    createsRealisedCashFlow:false,
    economicAuthority:'canonical-ve33-accounting-evidence',
    executionAuthority:'none',
    capitalExecution:false
  };
  if(!provided)return{rewards,diagnostics:{...base,status:'not-provided'}};
  if(!recoveryAuthorityValid(recovery))return{rewards,diagnostics:{...base,status:'ignored-invalid-authority'}};
  const enriched=addRecoveryShadowRows(rewards,claims);
  return{
    rewards:enriched.rewards,
    diagnostics:{...base,status:claims.length?'applied':'valid-no-claims',shadowRowsInserted:enriched.inserted}
  };
}

export function evidenceInputFingerprint({
  rewards,
  recovery,
  root=process.cwd(),
  extra={},
  repoPaths=['companies/rewards-data.json','reporting/ve33-transient-claim-recovery.json','intelligence/market-data/market-data.json','intelligence/market-data/market-data-scheduler-contract.json']
}={}){
  const blobs={};
  for(const repoPath of repoPaths){
    try{blobs[repoPath]=git(['rev-parse',`HEAD:${repoPath}`],{root});}
    catch{blobs[repoPath]=null;}
  }
  return sha256(JSON.stringify({
    rewardsHash:sha256(JSON.stringify(rewards||{})),
    recoveryHash:sha256(JSON.stringify(recovery||{})),
    blobs,
    extra
  }));
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

export function historicalCodeBlockTag(blockTag,currentBlockNumber,margin=CURRENT_BLOCK_MARGIN){
  const n=numericBlockTag(blockTag);
  return Number.isFinite(n)&&n<Number(currentBlockNumber)-Number(margin)?n:null;
}

export function isExactCodeAbsence(code){
  return String(code||'').toLowerCase()==='0x';
}

export function transientVotingLaneKey(claim={}){
  if(!claim?.protocolKey||!claim?.company||!claim?.holder||!claim?.tokenId||!claim?.rewardContract||!claim?.rewardToken)return null;
  return [claim.protocolKey,claim.company,lower(claim.holder),String(claim.tokenId),'voting-reward',lower(claim.rewardContract),lower(claim.rewardToken)].join('|');
}

export function buildPredeploymentZeroCheckpoint({claim,boundaryAt,blockNumber,blockTimestamp=null,code='0x'}={}){
  if(!isExactCodeAbsence(code))return null;
  const laneKey=transientVotingLaneKey(claim);
  if(!laneKey||!Number.isFinite(Number(blockNumber))||Number(blockNumber)<=0)return null;
  return{
    ok:true,
    checkpointKey:`${laneKey}|${Number(blockNumber)}`,
    laneKey,
    company:claim.company,
    protocolKey:claim.protocolKey,
    protocol:claim.protocol||PROTOCOLS[claim.protocolKey]?.protocol||null,
    chain:claim.chain||PROTOCOLS[claim.protocolKey]?.chain||null,
    chainId:claim.chainId||PROTOCOLS[claim.protocolKey]?.chainId||null,
    route:claim.route,
    holder:claim.holder,
    tokenId:String(claim.tokenId),
    custodyContext:claim.custodyContext||'direct-wallet',
    kind:'voting-reward',
    rewardContract:claim.rewardContract,
    distributor:null,
    rewardToken:claim.rewardToken,
    rewardSymbol:claim.rewardSymbol||null,
    decimals:Number.isInteger(Number(claim.rewardDecimals))?Number(claim.rewardDecimals):null,
    observedAt:boundaryAt,
    blockNumber:Number(blockNumber),
    entitlementRaw:'0',
    entitlementAmount:0,
    monthBoundary:true,
    exactBlockTaggedState:true,
    accountingStart:DIRECT_ACCOUNTING_START,
    periodIncomeAuthority:false,
    unknownIsNotZero:true,
    predeploymentZeroProof:{
      proof:'eth_getCode-empty-at-exact-historical-boundary',
      rewardContract:claim.rewardContract,
      code,
      boundaryAt,
      blockNumber:Number(blockNumber),
      blockTimestamp,
      createsIncome:false,
      executionAuthority:'none'
    }
  };
}

export async function seedTransientPredeploymentZeroBaselines({previous={},recovery={},providers={}}={}){
  const checkpoints=[...(previous?.checkpoints||[])];
  const existing=new Set(checkpoints.map(x=>x?.checkpointKey).filter(Boolean));
  const diagnostics={
    policy:'exact historical eth_getCode absence proves zero opening entitlement; RPC failure or deployed code never implies zero',
    candidateClaimCount:0,
    seededCheckpointCount:0,
    skippedAlreadyRepresented:0,
    skippedExistingCheckpoint:0,
    skippedNoProvider:0,
    skippedNoEligibleBoundary:0,
    skippedContractAlreadyDeployed:0,
    unresolvedCodeReadCount:0,
    samples:[],
    createsIncome:false,
    executionAuthority:'none'
  };
  if(!recoveryAuthorityValid(recovery)){
    diagnostics.status='ignored-invalid-authority';
    return{previous:{...previous,checkpoints},diagnostics};
  }
  diagnostics.status='valid-authority';
  const candidates=recoveryClaims(recovery).filter(claim=>
    claim?.classification==='transient-orphan-claim'&&claim?.alreadyRepresented!==true&&
    Number.isFinite(Number(claim?.blockNumber))&&claim?.rewardContract&&claim?.rewardToken
  );
  diagnostics.candidateClaimCount=candidates.length;
  const boundaryCache=new Map();
  const latestCache=new Map();

  for(const claim of candidates){
    const provider=providers[claim.protocolKey];
    if(!provider){diagnostics.skippedNoProvider++;continue;}
    if(claim.alreadyRepresented===true){diagnostics.skippedAlreadyRepresented++;continue;}
    let latestNumber=latestCache.get(claim.protocolKey);
    if(!latestNumber){
      try{latestNumber=Number(await provider.getBlockNumber());latestCache.set(claim.protocolKey,latestNumber);}catch{diagnostics.skippedNoProvider++;continue;}
    }
    const eligible=[];
    for(const boundaryAt of REQUIRED_HISTORICAL_BOUNDARIES){
      const cacheKey=`${claim.protocolKey}|${boundaryAt}`;
      let boundary=boundaryCache.get(cacheKey);
      try{
        if(!boundary){boundary=await blockAtOrBefore(provider,boundaryAt,latestNumber,new Map());boundaryCache.set(cacheKey,boundary);}
      }catch{continue;}
      if(Number(boundary.blockNumber)<Number(claim.blockNumber))eligible.push({boundaryAt,...boundary});
    }
    eligible.sort((a,b)=>Number(b.blockNumber)-Number(a.blockNumber));
    if(!eligible.length){diagnostics.skippedNoEligibleBoundary++;continue;}
    const boundary=eligible[0];
    const laneKey=transientVotingLaneKey(claim);
    const checkpointKey=`${laneKey}|${Number(boundary.blockNumber)}`;
    if(existing.has(checkpointKey)){diagnostics.skippedExistingCheckpoint++;continue;}
    let code;
    try{code=await provider.getCode(claim.rewardContract,Number(boundary.blockNumber));}
    catch(error){
      diagnostics.unresolvedCodeReadCount++;
      if(diagnostics.samples.length<12)diagnostics.samples.push({status:'historical-code-read-unavailable',protocolKey:claim.protocolKey,company:claim.company,tokenId:String(claim.tokenId),rewardContract:claim.rewardContract,boundaryAt:boundary.boundaryAt,error:error?.shortMessage||error?.message||String(error)});
      continue;
    }
    if(!isExactCodeAbsence(code)){
      diagnostics.skippedContractAlreadyDeployed++;
      if(diagnostics.samples.length<12)diagnostics.samples.push({status:'contract-already-deployed-at-boundary',protocolKey:claim.protocolKey,company:claim.company,tokenId:String(claim.tokenId),rewardContract:claim.rewardContract,boundaryAt:boundary.boundaryAt,codeLength:String(code||'').length});
      continue;
    }
    const checkpoint=buildPredeploymentZeroCheckpoint({claim,boundaryAt:boundary.boundaryAt,blockNumber:boundary.blockNumber,blockTimestamp:boundary.blockTimestamp,code});
    if(!checkpoint)continue;
    checkpoints.push(checkpoint);
    existing.add(checkpoint.checkpointKey);
    diagnostics.seededCheckpointCount++;
    if(diagnostics.samples.length<12)diagnostics.samples.push({status:'predeployment-zero-baseline-proven',protocolKey:claim.protocolKey,company:claim.company,tokenId:String(claim.tokenId),rewardContract:claim.rewardContract,rewardToken:claim.rewardToken,boundaryAt:boundary.boundaryAt,blockNumber:Number(boundary.blockNumber)});
  }
  return{previous:{...previous,checkpoints},diagnostics};
}

export function recoveryProtocolCoverage(recovery={},protocolKey){
  const protocol=recovery?.protocols?.[protocolKey]||null,scan=protocol?.scan||{};
  const startBlock=Number(scan.accountingStartBlock),lastScannedBlock=Number(protocol?.lastScannedBlock??scan.lastScannedBlock);
  const unresolvedCount=Array.isArray(protocol?.unresolved)?protocol.unresolved.length:0;
  const usable=recoveryAuthorityValid(recovery)&&protocol?.status==='complete'&&scan.complete===true&&unresolvedCount===0&&
    Number.isFinite(startBlock)&&Number.isFinite(lastScannedBlock)&&startBlock>=0&&lastScannedBlock>=startBlock;
  return{
    usable,
    protocolKey,
    status:protocol?.status||null,
    scanComplete:scan.complete===true,
    startBlock:Number.isFinite(startBlock)?startBlock:null,
    lastScannedBlock:Number.isFinite(lastScannedBlock)?lastScannedBlock:null,
    unresolvedCount,
    createsIncome:false,
    executionAuthority:'none'
  };
}

function exactRecoveryClaim(claim,laneKey=null){
  const key=transientVotingLaneKey(claim);
  return Boolean(key&&(!laneKey||key===laneKey)&&claim?.alreadyRepresented!==true&&
    Number.isFinite(Number(claim?.blockNumber))&&Number(claim.blockNumber)>0&&
    /^0x[0-9a-f]{64}$/i.test(String(claim?.transactionHash||''))&&Number.isFinite(Number(claim?.logIndex))&&
    claim?.amountRaw!==undefined&&BigInt(claim.amountRaw)>0n&&claim?.executionAuthority==='none');
}

function recoveryOpeningProofValid(opening={}){
  return opening?.predeploymentZeroProof?.proof==='eth_getCode-empty-at-exact-historical-boundary'||
    opening?.recoveredClaimBlockProof?.proof==='exact-historical-claim-block-post-state';
}

export function buildRecoveredClaimBlockInterval({opening,claims=[],closingRaw,closingBlockNumber,closingAt,decimals,rewardSymbol=null}={}){
  const first=claims[0]||null,laneKey=transientVotingLaneKey(first);
  if(!opening?.checkpointKey||!recoveryOpeningProofValid(opening))return{accepted:false,status:'opening-proof-unavailable'};
  if(!laneKey||opening.laneKey!==laneKey)return{accepted:false,status:'lane-mismatch'};
  const blockNumber=Number(closingBlockNumber);
  if(!Number.isFinite(blockNumber)||blockNumber<=Number(opening.blockNumber))return{accepted:false,status:'invalid-closing-block'};
  const validClaims=claims.filter(claim=>exactRecoveryClaim(claim,laneKey)&&Number(claim.blockNumber)===blockNumber);
  if(!validClaims.length||validClaims.length!==claims.length)return{accepted:false,status:'invalid-settlement-proof'};
  const decimalsNumber=Number(decimals);
  if(!Number.isInteger(decimalsNumber)||decimalsNumber<0||decimalsNumber>255)return{accepted:false,status:'token-decimals-unavailable'};
  let settled=0n;
  for(const claim of validClaims)settled+=BigInt(claim.amountRaw);
  const reconciliation=reconcileEntitlement(opening.entitlementRaw,String(closingRaw),settled.toString());
  if(!reconciliation.accepted)return{accepted:false,status:reconciliation.status,reconciliation};
  const claim=first,checkpointKey=`${laneKey}|${blockNumber}`;
  const entitlementAmount=Number(formatUnits(BigInt(closingRaw),decimalsNumber));
  const checkpoint={
    ok:true,checkpointKey,laneKey,company:claim.company,protocolKey:claim.protocolKey,
    protocol:claim.protocol||PROTOCOLS[claim.protocolKey]?.protocol||null,
    chain:claim.chain||PROTOCOLS[claim.protocolKey]?.chain||null,chainId:claim.chainId||PROTOCOLS[claim.protocolKey]?.chainId||null,
    route:claim.route,holder:claim.holder,tokenId:String(claim.tokenId),custodyContext:claim.custodyContext||'direct-wallet',
    kind:'voting-reward',rewardContract:claim.rewardContract,distributor:null,rewardToken:claim.rewardToken,
    rewardSymbol:rewardSymbol||claim.rewardSymbol||null,decimals:decimalsNumber,observedAt:closingAt,blockNumber,
    entitlementRaw:String(closingRaw),entitlementAmount:round(entitlementAmount,12),monthBoundary:false,exactBlockTaggedState:true,
    accountingStart:DIRECT_ACCOUNTING_START,periodIncomeAuthority:false,unknownIsNotZero:true,
    recoveredClaimBlockProof:{
      proof:'exact-historical-claim-block-post-state',blockNumber,observedAt:closingAt,
      settlementProofCount:validClaims.length,createsIncome:false,executionAuthority:'none'
    }
  };
  if(reconciliation.earnedRaw==='0')return{accepted:true,status:'zero-new-earned',checkpoint,event:null,reconciliation};
  const amount=Number(formatUnits(BigInt(reconciliation.earnedRaw),decimalsNumber));
  const settlementProofs=validClaims.map(claim=>({
    blockNumber:Number(claim.blockNumber),transactionHash:String(claim.transactionHash),logIndex:Number(claim.logIndex),
    recipient:claim.holder,rewardToken:claim.rewardToken,amountRaw:String(claim.amountRaw),decodedTokenId:String(claim.tokenId),
    decodePath:claim.decodePath||'recovery-sidecar-exact-attribution',proofSource:'ve33-transient-claim-recovery-sidecar'
  }));
  const event={
    eventKey:`ve33:${laneKey}:${Number(opening.blockNumber)}:${blockNumber}`,
    company:claim.company,family:'accrued-entitlement',economicDate:String(closingAt).slice(0,10),
    periodStart:opening.observedAt,periodEnd:closingAt,route:claim.route,
    protocol:claim.protocol||PROTOCOLS[claim.protocolKey]?.protocol||null,
    chain:claim.chain||PROTOCOLS[claim.protocolKey]?.chain||null,chainId:claim.chainId||PROTOCOLS[claim.protocolKey]?.chainId||null,
    asset:rewardSymbol||claim.rewardSymbol||null,token:claim.rewardToken,amount:round(amount,12),amountRaw:reconciliation.earnedRaw,
    usdValue:null,valuationUnitUsd:null,valuationAt:closingAt,valuationStatus:'unvalued-fail-closed',
    valuationSourceFile:null,valuationSourceCommit:null,valuationSourceAssetId:null,valuationSourceStatus:null,valuationSnapshotAgeMinutes:null,
    sourceFile:'reporting/ve33-accounting-evidence.json',
    sourceFamily:'ve(3,3) exact recovered ClaimRewards with claim-block state reconciliation',
    sourceIdentity:`${opening.checkpointKey}->${checkpointKey}`,
    evidenceStatus:'factual-opening-plus-exact-settlement-to-exact-claim-block-closing-reconciliation',
    mechanismKind:'voting-reward',holder:claim.holder,custodyContext:claim.custodyContext||'direct-wallet',tokenId:String(claim.tokenId),
    rewardContract:claim.rewardContract,distributor:null,openingEntitlementRaw:String(opening.entitlementRaw),
    closingEntitlementRaw:String(closingRaw),settlementRaw:settled.toString(),settlementEventCount:settlementProofs.length,
    settlementProofs,periodAttributionMonth:String(closingAt).slice(0,7),referenceAprUsed:false,
    currentClaimableBalanceIsPeriodIncome:false,claimIsSecondIncomeEvent:false,laterClaimOrPriceMoveDoesNotRewriteIncome:true,
    unknownIsNotZero:true,executionAuthority:'none'
  };
  return{accepted:true,status:'positive-factual-accrual',checkpoint,event,reconciliation};
}

async function readRecoveryClaimBlockState({provider,claim,blockNumber}){
  const cfg=PROTOCOLS[claim.protocolKey];
  if(!provider||!cfg)throw new Error('recovery provider unavailable');
  const tokenId=BigInt(claim.tokenId),tag=Number(blockNumber);
  const owner=await waitTimeout(
    new Contract(cfg.votingEscrow,RECOVERY_VE_ABI,provider).ownerOf(tokenId,{blockTag:tag}),
    RECOVERY_STATE_TIMEOUT_MS,`${claim.protocolKey} recovery ownerOf ${tag}`
  );
  if(lower(owner)!==lower(claim.holder))throw new Error(`recovery holder mismatch at block ${tag}`);
  const closingRaw=await waitTimeout(
    new Contract(claim.rewardContract,RECOVERY_REWARD_ABI,provider).earned(claim.rewardToken,tokenId,{blockTag:tag}),
    RECOVERY_STATE_TIMEOUT_MS,`${claim.protocolKey} recovery earned ${tag}`
  );
  const token=new Contract(claim.rewardToken,RECOVERY_ERC20_ABI,provider);
  const decimals=Number(await waitTimeout(token.decimals({blockTag:tag}),RECOVERY_STATE_TIMEOUT_MS,`${claim.protocolKey} recovery decimals ${tag}`));
  let rewardSymbol=claim.rewardSymbol||null;
  if(!rewardSymbol){
    try{rewardSymbol=String(await waitTimeout(token.symbol({blockTag:tag}),RECOVERY_STATE_TIMEOUT_MS,`${claim.protocolKey} recovery symbol ${tag}`));}catch{}
  }
  const block=await waitTimeout(provider.getBlock(tag),RECOVERY_STATE_TIMEOUT_MS,`${claim.protocolKey} recovery block ${tag}`);
  if(!block)throw new Error(`recovery block ${tag} unavailable`);
  return{
    closingRaw:BigInt(closingRaw).toString(),decimals,rewardSymbol,
    blockNumber:tag,closingAt:new Date(Number(block.timestamp)*1000).toISOString()
  };
}

export async function seedRecoveredClaimBlockIntervals({previous={},recovery={},providers={}}={}){
  const checkpoints=[...(previous?.checkpoints||[])],events=[...(previous?.events||[])];
  const checkpointKeys=new Set(checkpoints.map(x=>x?.checkpointKey).filter(Boolean));
  const eventKeys=new Set(events.map(x=>x?.eventKey).filter(Boolean));
  const diagnostics={
    policy:'recovery sidecar is settlement-only; canonical income requires exact predeployment opening plus exact historical claim-block post-state reconciliation',
    candidateLaneCount:0,candidateClaimCount:0,acceptedIntervalCount:0,acceptedEventCount:0,zeroIntervalCount:0,
    skippedInvalidCoverage:0,skippedNoOpeningProof:0,skippedAlreadyMaterialized:0,unresolvedStateReadCount:0,
    samples:[],createsIncomeDirectly:false,createsRealisedCashFlow:false,historicalUsdRemainsUnknown:true,executionAuthority:'none'
  };
  if(!recoveryAuthorityValid(recovery)){
    diagnostics.status='ignored-invalid-authority';
    return{previous:{...previous,checkpoints,events},diagnostics};
  }
  diagnostics.status='valid-authority';
  const allClaims=recoveryClaims(recovery).filter(claim=>exactRecoveryClaim(claim));
  const orphanLaneKeys=new Set(allClaims.filter(claim=>claim.classification==='transient-orphan-claim').map(transientVotingLaneKey).filter(Boolean));
  diagnostics.candidateLaneCount=orphanLaneKeys.size;
  diagnostics.candidateClaimCount=allClaims.filter(claim=>orphanLaneKeys.has(transientVotingLaneKey(claim))).length;

  for(const laneKey of orphanLaneKeys){
    const laneClaims=allClaims.filter(claim=>transientVotingLaneKey(claim)===laneKey).sort((a,b)=>Number(a.blockNumber)-Number(b.blockNumber)||Number(a.logIndex)-Number(b.logIndex));
    const first=laneClaims[0];
    if(!first)continue;
    const coverage=recoveryProtocolCoverage(recovery,first.protocolKey);
    if(!coverage.usable){diagnostics.skippedInvalidCoverage++;continue;}
    let opening=checkpoints
      .filter(x=>x?.laneKey===laneKey&&x?.predeploymentZeroProof?.proof==='eth_getCode-empty-at-exact-historical-boundary'&&Number(x.blockNumber)<Number(first.blockNumber))
      .sort((a,b)=>Number(b.blockNumber)-Number(a.blockNumber))[0]||null;
    if(!opening||coverage.startBlock>Number(opening.blockNumber)){
      diagnostics.skippedNoOpeningProof++;
      if(diagnostics.samples.length<12)diagnostics.samples.push({status:'opening-proof-or-coverage-unavailable',laneKey,coverage,openingBlock:opening?.blockNumber||null});
      continue;
    }
    const byBlock=new Map();
    for(const claim of laneClaims){
      if(Number(claim.blockNumber)>Number(coverage.lastScannedBlock))continue;
      if(Number(claim.blockNumber)<=Number(opening.blockNumber))continue;
      const key=Number(claim.blockNumber),rows=byBlock.get(key)||[];
      rows.push(claim);byBlock.set(key,rows);
    }
    for(const[blockNumber,claims]of [...byBlock.entries()].sort((a,b)=>a[0]-b[0])){
      const checkpointKey=`${laneKey}|${blockNumber}`,eventKey=`ve33:${laneKey}:${Number(opening.blockNumber)}:${blockNumber}`;
      const existingCheckpoint=checkpoints.find(x=>x?.checkpointKey===checkpointKey)||null;
      const existingEvent=events.find(x=>x?.eventKey===eventKey)||null;
      if(existingCheckpoint&&existingEvent){opening=existingCheckpoint;diagnostics.skippedAlreadyMaterialized++;continue;}
      let state;
      try{state=await readRecoveryClaimBlockState({provider:providers[first.protocolKey],claim:claims[0],blockNumber});}
      catch(error){
        diagnostics.unresolvedStateReadCount++;
        if(diagnostics.samples.length<12)diagnostics.samples.push({status:'claim-block-state-unavailable',laneKey,blockNumber,error:error?.shortMessage||error?.message||String(error)});
        break;
      }
      const interval=buildRecoveredClaimBlockInterval({opening,claims,...state});
      if(!interval.accepted||!interval.checkpoint){
        diagnostics.unresolvedStateReadCount++;
        if(diagnostics.samples.length<12)diagnostics.samples.push({status:interval.status||'reconciliation-unavailable',laneKey,blockNumber});
        break;
      }
      if(!checkpointKeys.has(interval.checkpoint.checkpointKey)){
        checkpoints.push(interval.checkpoint);checkpointKeys.add(interval.checkpoint.checkpointKey);
      }
      opening=interval.checkpoint;
      diagnostics.acceptedIntervalCount++;
      if(interval.event&&!eventKeys.has(interval.event.eventKey)){
        events.push(interval.event);eventKeys.add(interval.event.eventKey);diagnostics.acceptedEventCount++;
      }else if(!interval.event){diagnostics.zeroIntervalCount++;}
      if(diagnostics.samples.length<12)diagnostics.samples.push({status:interval.status,laneKey,blockNumber,settlementProofCount:claims.length,earnedRaw:interval.event?.amountRaw||'0'});
    }
  }
  return{previous:{...previous,checkpoints,events},diagnostics};
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
  const currentGetCode=currentProvider.getCode.bind(currentProvider),archiveGetCode=archiveProvider.getCode.bind(archiveProvider);
  Object.assign(stats,{historicalCalls:0,currentCalls:0,currentFallbackCalls:0,historicalCodeReads:0,currentCodeReads:0,currentCodeFallbackReads:0,historicalFailures:0,currentPrimaryFailures:0,marginBlocks:CURRENT_BLOCK_MARGIN});
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
  currentProvider.getCode=async(address,blockTag)=>{
    const historicalBlock=historicalCodeBlockTag(blockTag,currentBlockNumber,CURRENT_BLOCK_MARGIN);
    if(historicalBlock!==null){
      stats.historicalCodeReads++;
      try{return await archiveGetCode(address,blockTag);}
      catch(error){stats.historicalFailures++;throw error;}
    }
    stats.currentCodeReads++;
    try{return await currentGetCode(address,blockTag);}
    catch(primaryError){
      stats.currentPrimaryFailures++;
      stats.currentCodeFallbackReads++;
      try{return await archiveGetCode(address,blockTag);}
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

export async function runVe33Accounting({rewards,recovery={},previous={},generatedAt=new Date().toISOString(),env=process.env}={}){
  const recoveryInput=applyTransientClaimRecovery(rewards,recovery);
  const accountingRewards=recoveryInput.rewards;
  const selection=await selectHistoricalProviders({rewards:accountingRewards,env});
  const missing=Object.entries(selection.diagnostics).filter(([,x])=>x.status!=='archive-capable-provider-selected'&&x.status!=='no-lanes').map(([k])=>k);
  if(missing.length&&requireHistoricalRpc(env))throw new Error(`ve33 historical RPC capability missing for: ${missing.join(', ')}`);

  const baseline=await seedTransientPredeploymentZeroBaselines({previous,recovery,providers:selection.providers});
  const recoveredIntervals=await seedRecoveredClaimBlockIntervals({previous:baseline.previous,recovery,providers:selection.providers});
  const output=await buildVe33Evidence({rewards:accountingRewards,previous:recoveredIntervals.previous,generatedAt,providers:selection.providers});
  output.runner={
    version:VERSION,
    historicalRpcPolicy:'current-capable primary RPC with exact block-tagged eth_call/eth_getCode routing to a separately proven archive-capable provider',
    requiredHistoricalBoundaries:[...REQUIRED_HISTORICAL_BOUNDARIES],
    requireHistoricalRpc:requireHistoricalRpc(env),
    transientClaimRecovery:recoveryInput.diagnostics,
    transientClaimPredeploymentBaselines:baseline.diagnostics,
    transientClaimBlockReconciliation:recoveredIntervals.diagnostics,
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
  const[rewards,recovery,previous]=await Promise.all([
    readJson(DEFAULT_REWARDS),
    readJson(DEFAULT_RECOVERY,{}),
    readJson(DEFAULT_OUTPUT,{})
  ]);
  const fingerprint=evidenceInputFingerprint({
    rewards,
    recovery,
    root:ROOT,
    extra:{
      runnerVersion:VERSION,
      recoveryPolicyVersion:TRANSIENT_RECOVERY_POLICY.version,
      requireHistoricalRpc:requireHistoricalRpc(process.env),
      requiredHistoricalBoundaries:[...REQUIRED_HISTORICAL_BOUNDARIES],
      predeploymentZeroBaselineRequiresExactHistoricalCodeAbsence:true,
      exactClaimBlockStateRequiredBeforeCanonicalAdmission:true
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

  const output=await runVe33Accounting({rewards,recovery,previous});
  output.runner.safeWriterInputFingerprint=fingerprint;
  output.runner.safeWriterEvidenceReuseVersion=SAFE_WRITER_EVIDENCE_REUSE.version;
  output.runner.safeWriterEvidenceReuseMaxAgeMinutes=SAFE_WRITER_EVIDENCE_REUSE.maxAgeMinutes;
  await writeJson(DEFAULT_OUTPUT,output);
  console.log('ve33 capability-aware accounting runner built',{
    status:output.status,
    runnerVersion:output.runner?.version,
    transientClaimRecovery:output.runner?.transientClaimRecovery||null,
    transientClaimPredeploymentBaselines:output.runner?.transientClaimPredeploymentBaselines||null,
    transientClaimBlockReconciliation:output.runner?.transientClaimBlockReconciliation||null,
    selectedProviders:Object.fromEntries(Object.entries(output.runner?.selection||{}).map(([k,v])=>[k,{current:v.currentProvider||null,archive:v.selectedProvider||null,mode:v.routingMode||null}])),
    boundaryFailures:Object.fromEntries(Object.entries(output.diagnostics?.protocols||{}).map(([k,v])=>[k,(v.boundaryFailures||[]).length])),
    currentStateFailures:Object.fromEntries(Object.entries(output.diagnostics?.protocols||{}).map(([k,v])=>[k,Number(v.currentStateFailureCount||0)])),
    stateFailures:Object.fromEntries(Object.entries(output.diagnostics?.protocols||{}).map(([k,v])=>[k,v.stateFailureCounts||{}])),
    settlementQueryFailures:output.diagnostics?.settlementQueryFailureCount||0,
    settlementRpc:Object.fromEntries(Object.entries(output.diagnostics?.protocols||{}).map(([k,v])=>[k,v.settlementRpc||null])),
    accepted:output.diagnostics?.acceptedPositiveIntervalCount||0,
    historicalPriceResolved:output.diagnostics?.historicalPriceResolvedIntervalCount||0,
    executionAuthority:output.authority?.executionAuthority
  });
}

if(process.argv[1]&&path.resolve(process.argv[1])===__filename)main().catch(error=>{console.error(error);process.exitCode=1;});
