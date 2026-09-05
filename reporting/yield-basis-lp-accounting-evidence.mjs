#!/usr/bin/env node
/**
 * The Holding · Yield Basis LP factual tracking evidence v0.1
 *
 * Read-only current-state proof for Company #007 Yield Basis LP positions.
 * It verifies canonical company ownership across both direct LT custody and the
 * canonical Yield Basis gauge, while observing LT.pricePerShare() at the same
 * Ethereum block. This proves mechanism tracking only. It does NOT create
 * period income, backfill income from Reference APR, or grant transaction authority.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __filename=fileURLToPath(import.meta.url);
const ROOT=path.resolve(path.dirname(__filename),'..');
const PRODUCTIVITY_FILE=process.env.PRODUCTIVITY_DATA_FILE||path.join(ROOT,'companies','productivity-data.json');
const DISCOVERY_FILE=process.env.COMPANY_007_DISCOVERY_FILE||path.join(ROOT,'companies','company-007-discovery.json');
const OUTPUT_FILE=process.env.YIELD_BASIS_LP_EVIDENCE_FILE||path.join(ROOT,'reporting','yield-basis-lp-accounting-evidence.json');

export const VERSION='0.1-yield-basis-lp-factual-tracking';
export const COMPANY="Rook's portfolio";
export const REGISTRY='007';
export const PRICE_PER_SHARE_SELECTOR='0x99530b06';
export const BALANCE_OF_SELECTOR='0x70a08231';
export const MARKETS=Object.freeze({
  yieldbasis_yblp_wbtc:{market:'yb-WBTC',family:'BTC',lt:'0x651d4b8168488fa163d85304662e8278d4c55baa',gauge:'0xaa0b1d265f23972eafb7d088e963bd31403a58f5'},
  yieldbasis_yblp_weth:{market:'yb-WETH',family:'ETH',lt:'0x2b9c9f3bdceb5d8e36a4704f08a78fca53343cea',gauge:'0xd829456fd63ada7de0657714a3a7a26de403e3d8'}
});
const RPC_URLS=[process.env.ETH_RPC_URL,process.env.ETH_RPC_URL_2,'https://eth.merkle.io','https://eth.blockscout.com/api/eth-rpc','https://eth.llamarpc.com','https://ethereum-rpc.publicnode.com','https://eth.drpc.org','https://1rpc.io/eth','https://rpc.flashbots.net'].filter(Boolean);
const TIMEOUT_MS=Number(process.env.YIELD_BASIS_LP_RPC_TIMEOUT_MS||8000);

const lower=v=>String(v||'').trim().toLowerCase();
const isAddress=v=>/^0x[0-9a-f]{40}$/.test(lower(v));
const isHexQuantity=v=>/^0x[0-9a-f]+$/i.test(String(v||''));
const positiveHex=v=>{try{return BigInt(v)>0n;}catch{return false;}};
const padAddress=v=>lower(v).slice(2).padStart(64,'0');
const nowIso=()=>new Date().toISOString();
const safeHost=url=>{try{return new URL(url).hostname;}catch{return 'configured';}};

async function readJson(file){return JSON.parse(await fs.readFile(file,'utf8'));}
async function writeJson(file,data){await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,JSON.stringify(data,null,2)+'\n');}
async function rpc(url,method,params=[],timeoutMs=TIMEOUT_MS){
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{const response=await fetch(url,{method:'POST',signal:controller.signal,cache:'no-store',headers:{'content-type':'application/json','accept':'application/json','user-agent':'The-Holding-Yield-Basis-LP-Accounting/0.1'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})});if(!response.ok)throw new Error(`HTTP ${response.status}`);const body=await response.json();if(body?.error)throw new Error(body.error.message||`RPC ${body.error.code}`);if(body?.result===null||body?.result===undefined)throw new Error(`${method} returned no result`);return body.result;}finally{clearTimeout(timer);}
}

function canonicalWallets(discovery){if(discovery?.company?.registry!==REGISTRY||discovery?.company?.name!==COMPANY)throw new Error('Company #007 discovery identity mismatch');const wallets=(discovery?.company?.wallets||[]).map(x=>lower(x?.address)).filter(isAddress);if(!wallets.length||new Set(wallets).size!==wallets.length)throw new Error('Company #007 canonical wallets missing or duplicated');return wallets;}
function validateCanonicalMarketBindings(discovery){const positions=Array.isArray(discovery?.discovery?.yieldBasis?.positions)?discovery.discovery.yieldBasis.positions:[];for(const expected of Object.values(MARKETS)){const row=positions.find(x=>x?.market===expected.market);if(!row||lower(row.lt)!==expected.lt||lower(row.gauge)!==expected.gauge)throw new Error(`${expected.market} canonical LT/gauge binding mismatch`);}return true;}
function validateProductivityInventory(productivity){const company=productivity?.companies?.[COMPANY];if(!company)throw new Error('Company #007 missing from productivity inventory');const rows=Array.isArray(company?.breakdown)?company.breakdown:[];for(const engineId of Object.keys(MARKETS)){const row=rows.find(x=>x?.engineId===engineId);if(!row)throw new Error(`${engineId} missing from Company #007 productivity inventory`);const value=[row?.value,row?.valueUsd,row?.productiveValueUsd,row?.productiveValue].find(v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v)));if(!(Number(value)>0))throw new Error(`${engineId} has no positive productive value`);}return true;}
function rowHasHolding(row){return(Array.isArray(row?.holdings)?row.holdings:[]).some(x=>positiveHex(x?.directLtBalanceRaw)||positiveHex(x?.gaugeShareBalanceRaw));}

export function validateEvidenceOutput(output){
  if(output?.version!==VERSION)throw new Error('Yield Basis LP evidence version mismatch');
  if(!['ok','partial'].includes(output?.status))throw new Error('Yield Basis LP evidence status invalid');
  if(output?.semantics?.factualTrackingProofIsNotPeriodIncome!==true||output?.semantics?.openingBalanceCreatesIncome!==false||output?.semantics?.referenceAprUsed!==false||output?.semantics?.unknownIsNotZero!==true)throw new Error('Yield Basis LP evidence semantic boundary invalid');
  if(output?.authority?.readOnly!==true||output?.authority?.executionAuthority!=='none'||output?.authority?.walletAuthority!=='none'||output?.authority?.claimingAuthority!=='none'||output?.authority?.capitalExecution!==false)throw new Error('Yield Basis LP evidence authority expanded');
  const checkpoints=Array.isArray(output?.checkpoints)?output.checkpoints:[];if(!checkpoints.length)throw new Error('Yield Basis LP evidence has no checkpoints');
  for(const row of checkpoints){const expected=MARKETS[row?.engineId];if(!expected||row?.company!==COMPANY||String(row?.registry)!==REGISTRY||row?.chain!=='Ethereum'||row?.protocol!=='Yield Basis'||row?.market!==expected.market||lower(row?.lt)!==expected.lt||lower(row?.gauge)!==expected.gauge)throw new Error('Yield Basis LP checkpoint identity mismatch');if(row?.ok!==true||row?.factualTrackingProof!==true||row?.periodIncomeAuthority!==false||row?.openingBalanceCreatesIncome!==false||row?.referenceAprUsed!==false||row?.unknownIsNotZero!==true||row?.executionAuthority!=='none')throw new Error(`${row?.engineId} tracking boundary invalid`);if(!Number.isSafeInteger(Number(row?.blockNumber))||Number(row.blockNumber)<=0||!row?.observedAt||!positiveHex(row?.pricePerShareRaw))throw new Error(`${row?.engineId} onchain observation invalid`);const holdings=Array.isArray(row?.holdings)?row.holdings:[];const holders=Array.isArray(row?.holders)?row.holders:[];if(!holdings.length||holdings.some(x=>!isAddress(x?.wallet)||!isHexQuantity(x?.directLtBalanceRaw)||!isHexQuantity(x?.gaugeShareBalanceRaw))||!rowHasHolding(row))throw new Error(`${row?.engineId} custody-aware holding proof invalid`);if(!holders.length||holders.some(x=>!isAddress(x?.wallet)||!isHexQuantity(x?.balanceRaw))||!holders.some(x=>positiveHex(x.balanceRaw)))throw new Error(`${row?.engineId} compatibility holder proof invalid`);if(!['direct-lt','gauge','mixed'].includes(row?.activeHoldingPath))throw new Error(`${row?.engineId} active holding path invalid`);}
  return true;
}

export async function buildEvidence({productivity,discovery,rpcUrl,blockHex}={}){
  validateProductivityInventory(productivity);validateCanonicalMarketBindings(discovery);const wallets=canonicalWallets(discovery);const block=await rpc(rpcUrl,'eth_getBlockByNumber',[blockHex,false]);if(!block?.number||!block?.timestamp)throw new Error('Ethereum block header unavailable');const blockNumber=Number(BigInt(block.number));const observedAt=new Date(Number(BigInt(block.timestamp))*1000).toISOString();const checkpoints=[];
  for(const[engineId,market]of Object.entries(MARKETS)){const pps=await rpc(rpcUrl,'eth_call',[{to:market.lt,data:PRICE_PER_SHARE_SELECTOR},blockHex]);if(!positiveHex(pps))throw new Error(`${engineId} pricePerShare is not positive`);const holdings=[];for(const wallet of wallets){const data=BALANCE_OF_SELECTOR+padAddress(wallet);const directLtBalanceRaw=await rpc(rpcUrl,'eth_call',[{to:market.lt,data},blockHex]);const gaugeShareBalanceRaw=await rpc(rpcUrl,'eth_call',[{to:market.gauge,data},blockHex]);if(!isHexQuantity(directLtBalanceRaw)||!isHexQuantity(gaugeShareBalanceRaw))throw new Error(`${engineId} malformed custody balance result`);holdings.push({wallet,directLtBalanceRaw,gaugeShareBalanceRaw});}const directCount=holdings.filter(x=>positiveHex(x.directLtBalanceRaw)).length;const gaugeCount=holdings.filter(x=>positiveHex(x.gaugeShareBalanceRaw)).length;if(!directCount&&!gaugeCount)throw new Error(`${engineId} canonical wallets hold no direct LT or canonical gauge shares`);const activeHoldingPath=directCount&&gaugeCount?'mixed':gaugeCount?'gauge':'direct-lt';const holders=holdings.map(x=>({wallet:x.wallet,balanceRaw:positiveHex(x.directLtBalanceRaw)?x.directLtBalanceRaw:x.gaugeShareBalanceRaw,custodyPath:positiveHex(x.directLtBalanceRaw)&&positiveHex(x.gaugeShareBalanceRaw)?'mixed':positiveHex(x.gaugeShareBalanceRaw)?'gauge':'direct-lt'}));checkpoints.push({ok:true,engineId,company:COMPANY,registry:REGISTRY,chain:'Ethereum',protocol:'Yield Basis',market:market.market,family:market.family,lt:market.lt,gauge:market.gauge,blockNumber,observedAt,source:'ethereum-json-rpc',sourceMethod:'LT.pricePerShare() + LT.balanceOf(company wallet) + canonical gauge.balanceOf(company wallet), same block',rpcHost:safeHost(rpcUrl),pricePerShareRaw:pps,holdings,holders,positiveDirectLtHolderCount:directCount,positiveGaugeHolderCount:gaugeCount,activeHoldingPath,factualTrackingProof:true,periodIncomeAuthority:false,openingBalanceCreatesIncome:false,referenceAprUsed:false,unknownIsNotZero:true,executionAuthority:'none',checkpointKey:`yield-basis-lp:${engineId}:${blockNumber}`});}
  const output={version:VERSION,generatedAt:nowIso(),status:checkpoints.length===Object.keys(MARKETS).length?'ok':'partial',purpose:'Read-only factual current-state tracking proof for Company #007 Yield Basis LP PPS-growth mechanisms across direct LT and canonical gauge custody; never period-income authority by itself.',source:{chain:'Ethereum',blockNumber,observedAt,rpcHost:safeHost(rpcUrl)},semantics:{factualTrackingProofIsNotPeriodIncome:true,openingBalanceCreatesIncome:false,referenceAprUsed:false,currentPpsIsNotPeriodIncome:true,custodyLocationDoesNotCreateIncome:true,unknownIsNotZero:true},authority:{readOnly:true,executionAuthority:'none',walletAuthority:'none',claimingAuthority:'none',capitalExecution:false,methodologyMutationAuthority:'none'},checkpoints};validateEvidenceOutput(output);return output;
}

export async function buildEvidenceFromSourceMesh({productivity,discovery}={}){const errors=[];for(const url of RPC_URLS){try{const blockHex=await rpc(url,'eth_blockNumber');if(!isHexQuantity(blockHex)||!positiveHex(blockHex))throw new Error('invalid latest block');const output=await buildEvidence({productivity,discovery,rpcUrl:url,blockHex});output.source.rpcFallbackErrors=errors;return output;}catch(error){errors.push(`${safeHost(url)}: ${String(error?.message||error)}`);}}throw new Error(`Ethereum RPC source mesh exhausted before a complete same-provider observation: ${errors.join(' | ')}`);}
async function main(){const[productivity,discovery]=await Promise.all([readJson(PRODUCTIVITY_FILE),readJson(DISCOVERY_FILE)]);const output=await buildEvidenceFromSourceMesh({productivity,discovery});await writeJson(OUTPUT_FILE,output);console.log('Yield Basis LP factual tracking evidence built',{status:output.status,blockNumber:output.source.blockNumber,rpcHost:output.source.rpcHost,checkpoints:output.checkpoints.length,holdingPaths:Object.fromEntries(output.checkpoints.map(x=>[x.engineId,x.activeHoldingPath])),company:COMPANY,executionAuthority:output.authority.executionAuthority,fallbacks:output.source.rpcFallbackErrors.length});}
if(process.argv[1]&&path.resolve(process.argv[1])===__filename)main().catch(error=>{console.error(error);process.exitCode=1;});
