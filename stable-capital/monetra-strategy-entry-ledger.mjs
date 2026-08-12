#!/usr/bin/env node
/**
 * THE HOLDING · MONETRA STRATEGY ENTRY LEDGER v0.3
 *
 * Purpose:
 *   Reconstruct the actual principal deployed INTO each of Monetra's 10 productive
 *   stable strategies. This deliberately ignores unrelated wallet funding / withdrawals.
 *
 * Correct Stable Performance basis:
 *   - entry principal = stable units actually deposited/staked into the strategy;
 *   - current strategy value = canonical redeemable stable units;
 *   - claimable rewards stay separate, then are added to strategy income;
 *   - stablecoin market/depeg movement stays OUT of strategy income;
 *   - current APY is never used to reconstruct historical Performance.
 *
 * Output:
 *   /companies/company-008-strategy-entry-ledger.json
 *
 * GREEN semantics:
 *   Diagnostic GREEN means the collector ran and published evidence.
 *   Public Performance becomes ready only if every required strategy basis is
 *   reproducibly resolved.
 */

import fs from 'node:fs';
import path from 'node:path';
import {
  Contract,
  Interface,
  JsonRpcProvider,
  formatUnits,
  getAddress,
  id,
  zeroPadValue
} from 'ethers';

const VERSION = '0.4-monetra-strategy-entry-targeted-close';
const METHODOLOGY = '0.4-strategy-entry-provider-rotation-and-protocol-fixes';
const ROOT = path.resolve(process.cwd());

const RESOLVER_FILE =
  process.env.MONETRA_RESOLVER_FILE ||
  path.join(ROOT, 'companies', 'company-008-resolve.json');

const STABLE_FILE =
  process.env.STABLE_CAPITAL_DATA_FILE ||
  path.join(ROOT, 'companies', 'stable-capital-data.json');

const OUT_FILE =
  process.env.MONETRA_STRATEGY_ENTRY_LEDGER_FILE ||
  path.join(ROOT, 'companies', 'company-008-strategy-entry-ledger.json');

const WALLET = addr('0x888d39aee2aec979c81f125ea94bb3ceb60f6bbb');
const ZERO = '0x0000000000000000000000000000000000000000';
const TRANSFER_TOPIC = id('Transfer(address,address,uint256)');
const DEPOSIT_IFACE = new Interface([
  'event Deposit(address indexed sender,address indexed owner,uint256 assets,uint256 shares)'
]);

const ADDR = Object.freeze({
  // Base Aave USDC
  baseUsdc: addr('0x833589fcd6edb6e08f4c7c32d4f71b54bda02913'),
  baseAUsdc: addr('0x4e65fe4dba92790696d040ac24aa414708f5c0ab'),

  // Ethereum stable wrappers / underlyings
  crvusd: addr('0xf939e0a03fb07f59a73314e73794be0e57ac1b4e'),
  scrvusd: addr('0x0655977feb2f289a4ab78af67bab0d17aab84367'),

  fxsave: addr('0x7743e50f534a7f9f1791dde7dcd89f7783eefc39'),
  fxusdBasePool: addr('0x65c9a641afceb9c0e6034e558a319488fa0fa3be'),
  fxusd: addr('0x085780639cc2cacd35e474e71f4d000e2405d8f6'),
  ethUsdc: addr('0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'),
  ethUsdt: addr('0xdac17f958d2ee523a2206206994597c13d831ec7'),

  dola: addr('0x865377367054516e17014ccded1e7d814edc9ce4'),
  sdola: addr('0xb45ad160634c528cc3d2926d9807104fa3157305'),

  usds: addr('0xdc035d45d973e3ec169d2276ddab16f1e407384f'),
  susds: addr('0xa3931d71877c0e7a3148cb7eb4463524fec27fbd'),

  gho: addr('0x40d16fc0246ad3160ccc09b8d0d3a2cd28ae6c2f'),
  sgho: addr('0xe1753f2e00940cc31213dd92013cf019dfe4ca1d'),

  bold: addr('0x6440f144b7e50d6a8439336510312d2f54beb01d'),
  ybold: addr('0x9f4330700a36b29952869fac9b33f45eedd8a3d8'),
  ysybold: addr('0x23346b04a7f55b8760e5860aa5a77383d63491cd'),

  liquitySpWeth: addr('0x5721cbbd64fc7ae3ef44a0a3f9a790a9264cf9bf'),

  // Lido EarnUSD / Mellow
  lidoVault: addr('0x014e6da8f283c4af65b2aa0f201438680a004452'),
  lidoShareManager: addr('0x4ce1ac8f43e0e5bd7a346a98af777bf8fbea1981'),
  lidoDepositQueueUsdc: addr('0xc75e7e73b25fea8bb23eb55cc48ba55067b5be76'),
  lidoSyncDepositQueueUsdc: addr('0xf6afaf6afcae116dd37a779d50fe6c5fa6f8c8f5'),
  lidoDepositQueueUsdt: addr('0xeec5041c47cba1e31321ac6941bf09ad60645b73'),
  lidoSyncDepositQueueUsdt: addr('0x534d0beb82c47cf703bf9be959297658b65ec8e9'),

  // Fraxtal
  frxusd: addr('0xfc00000000000000000000000000000000000001'),
  sfrxusd: addr('0xfc00000000000000000000000000000000000008'),
  fraxtalStakeUnstake: addr('0xbfc4d34db83553725ec6c768da71d2d9c1456b55')
});

const RPC = Object.freeze({
  ethereum: uniq([
    process.env.ETH_RPC_URL,
    process.env.ETH_RPC_URL_2,
    process.env.ETH_ARCHIVE_RPC_URL,
    'https://ethereum-rpc.publicnode.com',
    'https://eth.llamarpc.com',
    'https://eth.blockscout.com/api/eth-rpc'
  ]),
  base: uniq([
    process.env.BASE_RPC_URL,
    process.env.BASE_RPC_URL_2,
    'https://base-rpc.publicnode.com',
    'https://mainnet.base.org'
  ]),
  fraxtal: uniq([
    process.env.FRAXTAL_RPC_URL,
    process.env.FRAXTAL_RPC_URL_2,
    'https://fraxtal.gateway.tenderly.co',
    'https://rpc.frax.com'
  ])
});

const CHAIN_ID = Object.freeze({ ethereum:1, base:8453, fraxtal:252 });

const STRATEGIES = Object.freeze([
  {
    id:'base:aave:0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
    protocol:'Aave v3', chain:'base', mode:'aave-supply',
    wrapper:ADDR.baseAUsdc, underlying:ADDR.baseUsdc, terminal:'USDC'
  },
  {
    id:'ethereum:0x0655977feb2f289a4ab78af67bab0d17aab84367',
    protocol:'Curve', chain:'ethereum', mode:'erc4626',
    wrapper:ADDR.scrvusd, underlying:ADDR.crvusd, terminal:'crvUSD'
  },
  {
    id:'ethereum:0x7743e50f534a7f9f1791dde7dcd89f7783eefc39',
    protocol:'f(x) Protocol', chain:'ethereum', mode:'fxsave',
    wrapper:ADDR.fxsave, underlying:ADDR.fxusdBasePool, terminal:'fxUSD+USDC'
  },
  {
    id:'ethereum:0xb45ad160634c528cc3d2926d9807104fa3157305',
    protocol:'Inverse', chain:'ethereum', mode:'erc4626',
    wrapper:ADDR.sdola, underlying:ADDR.dola, terminal:'DOLA'
  },
  {
    id:'ethereum:0xa3931d71877c0e7a3148cb7eb4463524fec27fbd',
    protocol:'Sky', chain:'ethereum', mode:'erc4626',
    wrapper:ADDR.susds, underlying:ADDR.usds, terminal:'USDS'
  },
  {
    id:'ethereum:0xe1753f2e00940cc31213dd92013cf019dfe4ca1d',
    protocol:'Aave · sGHO', chain:'ethereum', mode:'erc4626',
    wrapper:ADDR.sgho, underlying:ADDR.gho, terminal:'GHO'
  },
  {
    id:'ethereum:0x23346b04a7f55b8760e5860aa5a77383d63491cd',
    protocol:'Yearn V3', chain:'ethereum', mode:'nested-erc4626',
    wrapper:ADDR.ysybold, underlying:ADDR.ybold, terminalUnderlying:ADDR.bold, terminal:'BOLD'
  },
  {
    id:'ethereum:0x4ce1ac8f43e0e5bd7a346a98af777bf8fbea1981',
    protocol:'Lido Earn', chain:'ethereum', mode:'lido-deposit-queue',
    wrapper:ADDR.lidoShareManager, underlying:null, terminal:'USD strategy NAV'
  },
  {
    id:'ethereum:liquity-v2-sp:weth',
    protocol:'Liquity V2', chain:'ethereum', mode:'liquity-sp',
    wrapper:null, underlying:ADDR.bold, terminal:'BOLD'
  },
  {
    id:'fraxtal:0xfc00000000000000000000000000000000000008',
    protocol:'Frax Finance', chain:'fraxtal', mode:'frax-sfrxusd',
    wrapper:ADDR.sfrxusd, underlying:ADDR.frxusd, terminal:'frxUSD'
  }
]);

function addr(x){
  try { return getAddress(String(x).toLowerCase()); }
  catch { return null; }
}
function lower(x){ return String(x||'').toLowerCase(); }
function uniq(xs){ return [...new Set((xs||[]).filter(Boolean))]; }
function finite(x){ return x!==null && x!==undefined && x!=='' && Number.isFinite(Number(x)); }
function round(x,d=9){ return finite(x)?Number(Number(x).toFixed(d)):null; }
function nowIso(){ return new Date().toISOString(); }
function safeBig(x){ try{return BigInt(x)}catch{return 0n} }
function errorText(e){ return String(e?.shortMessage||e?.message||e||'unknown').slice(0,1800) }
function readJson(file){ return JSON.parse(fs.readFileSync(file,'utf8')) }
function writeJson(file,v){ fs.mkdirSync(path.dirname(file),{recursive:true}); fs.writeFileSync(file,JSON.stringify(v,null,2)+'\n') }
function topicAddress(a){ return zeroPadValue(a,32) }

async function withProvider(chain,fn){
  const attempts=[];
  for(const url of RPC[chain]){
    let provider;
    try{
      provider=new JsonRpcProvider(url,CHAIN_ID[chain],{staticNetwork:true});
      const n=await provider.getNetwork();
      if(Number(n.chainId)!==CHAIN_ID[chain])throw new Error('wrong chain');
      const value=await fn(provider,url);
      try{provider.destroy?.()}catch{}
      return {ok:true,value,provider:new URL(url).hostname,attempts};
    }catch(e){
      attempts.push({url,error:errorText(e)});
      try{provider?.destroy?.()}catch{}
    }
  }
  return {ok:false,error:'all providers failed',attempts};
}

async function tokenMeta(provider,token,cache=new Map()){
  const k=lower(token);
  if(cache.has(k))return cache.get(k);
  const c=new Contract(token,[
    'function symbol() view returns (string)',
    'function decimals() view returns (uint8)'
  ],provider);
  let symbol=null,decimals=18;
  try{symbol=await c.symbol()}catch{}
  try{decimals=Number(await c.decimals())}catch{}
  const v={symbol,decimals};
  cache.set(k,v);
  return v;
}

async function getLogsAdaptive(provider,filter,fromBlock,toBlock,depth=0){
  try{return await provider.getLogs({...filter,fromBlock,toBlock})}
  catch(e){
    if(fromBlock>=toBlock||depth>=14)throw e;
    const mid=Math.floor((fromBlock+toBlock)/2);
    return [
      ...await getLogsAdaptive(provider,filter,fromBlock,mid,depth+1),
      ...await getLogsAdaptive(provider,filter,mid+1,toBlock,depth+1)
    ];
  }
}

async function findBlockAtOrBefore(provider,targetTs){
  const latest=await provider.getBlock('latest');
  if(!latest)throw new Error('latest block unavailable');
  let lo=0,hi=Number(latest.number),best=0;
  while(lo<=hi){
    const mid=Math.floor((lo+hi)/2);
    const b=await provider.getBlock(mid);
    if(!b){hi=mid-1;continue}
    if(Number(b.timestamp)<=targetTs){best=mid;lo=mid+1}else hi=mid-1;
  }
  const out=await provider.getBlock(best);
  if(!out)throw new Error('historical block unavailable');
  return out;
}

function resolverPosition(resolver,id){
  const rows=[
    ...(resolver?.stableCapital?.positions||[]),
    ...(resolver?.resolutionV13?.frax?.positions||[]),
    ...(resolver?.resolutionV14?.frax?.positions||[]),
    ...(resolver?.resolutionV13?.liquity?.positions||[]),
    ...(resolver?.resolutionV14?.liquity?.positions||[])
  ];
  return rows.find(x=>x?.id===id)||null;
}

function resolverEntryHint(resolver,id){
  const p=resolverPosition(resolver,id);
  const h=p?.history?.firstObservedActivity ||
          p?.history?.firstObservedInbound ||
          p?.history?.firstObservedInboundATokenTransfer ||
          null;
  return h?.txHash ? {
    txHash:h.txHash,
    timestamp:h.timestamp||null,
    block:h.block??null,
    source:'resolver-first-observed-activity'
  }:null;
}

async function discoverEarliestInboundWrapper(provider,strategy,foundedBlock){
  if(!strategy.wrapper)return null;
  const latest=await provider.getBlockNumber();
  const logs=await getLogsAdaptive(provider,{
    address:strategy.wrapper,
    topics:[TRANSFER_TOPIC,null,topicAddress(WALLET)]
  },foundedBlock,latest);
  if(!logs.length)return null;
  logs.sort((a,b)=>Number(a.blockNumber)-Number(b.blockNumber)||Number(a.index??0)-Number(b.index??0));
  const l=logs[0];
  const b=await provider.getBlock(l.blockNumber);
  return {
    txHash:l.transactionHash,
    block:Number(l.blockNumber),
    timestamp:b?new Date(Number(b.timestamp)*1000).toISOString():null,
    source:'wrapper-transfer-discovery'
  };
}

async function discoverLidoDeposit(provider,foundedBlock){
  const latest=await provider.getBlockNumber();
  const assets=[ADDR.ethUsdc,ADDR.ethUsdt];
  const queues=new Set([
    lower(ADDR.lidoDepositQueueUsdc),lower(ADDR.lidoSyncDepositQueueUsdc),
    lower(ADDR.lidoDepositQueueUsdt),lower(ADDR.lidoSyncDepositQueueUsdt),
    lower(ADDR.lidoVault)
  ]);
  const rows=[];
  for(const token of assets){
    const logs=await getLogsAdaptive(provider,{
      address:token,
      topics:[TRANSFER_TOPIC,topicAddress(WALLET)]
    },foundedBlock,latest);
    for(const l of logs){
      const to=addr('0x'+String(l.topics?.[2]||'').slice(-40));
      if(!to||!queues.has(lower(to)))continue;
      const m=await tokenMeta(provider,token);
      const amount=Number(formatUnits(safeBig(l.data),m.decimals));
      const b=await provider.getBlock(l.blockNumber);
      rows.push({
        txHash:l.transactionHash,block:Number(l.blockNumber),
        timestamp:b?new Date(Number(b.timestamp)*1000).toISOString():null,
        asset:token,symbol:m.symbol,amount,to,
        source:'lido-deposit-queue-transfer'
      });
    }
  }
  rows.sort((a,b)=>a.block-b.block);
  return rows[0]||null;
}

async function decodeReceipt(provider,txHash){
  const receipt=await provider.getTransactionReceipt(txHash);
  if(!receipt)throw new Error('receipt unavailable '+txHash);
  const cache=new Map();
  const transfers=[];
  const deposits=[];
  for(const l of receipt.logs){
    if(l.topics?.[0]===TRANSFER_TOPIC && l.topics.length>=3){
      const token=addr(l.address);
      const from=addr('0x'+String(l.topics[1]).slice(-40));
      const to=addr('0x'+String(l.topics[2]).slice(-40));
      const m=await tokenMeta(provider,token,cache);
      transfers.push({
        token,symbol:m.symbol,decimals:m.decimals,from,to,
        raw:safeBig(l.data).toString(),
        amount:Number(formatUnits(safeBig(l.data),m.decimals)),
        logIndex:Number(l.index??l.logIndex??0)
      });
    }
    try{
      const p=DEPOSIT_IFACE.parseLog({topics:l.topics,data:l.data});
      if(p?.name==='Deposit'){
        deposits.push({
          contract:addr(l.address),
          sender:addr(p.args.sender),
          owner:addr(p.args.owner),
          assetsRaw:p.args.assets.toString(),
          sharesRaw:p.args.shares.toString(),
          logIndex:Number(l.index??l.logIndex??0)
        });
      }
    }catch{}
  }
  const block=await provider.getBlock(receipt.blockNumber);
  return {
    receipt,
    blockNumber:Number(receipt.blockNumber),
    timestamp:block?new Date(Number(block.timestamp)*1000).toISOString():null,
    transfers,deposits
  };
}

async function fxBasePoolToNominal(provider,basePoolRaw,blockTag){
  const pool=new Contract(ADDR.fxusdBasePool,[
    'function previewRedeem(uint256) view returns (uint256 amountYieldOut,uint256 amountStableOut)'
  ],provider);
  const p=await pool.previewRedeem(basePoolRaw,{blockTag});
  const fx=Number(formatUnits(safeBig(p.amountYieldOut??p[0]),18));
  const usdc=Number(formatUnits(safeBig(p.amountStableOut??p[1]),6));
  return {nominal:fx+usdc,breakdown:{fxUSD:fx,USDC:usdc}};
}

async function nestedYboldToBold(provider,yboldSharesRaw,blockTag){
  const y=new Contract(ADDR.ybold,['function convertToAssets(uint256) view returns (uint256)'],provider);
  const raw=safeBig(await y.convertToAssets(yboldSharesRaw,{blockTag}));
  return {nominal:Number(formatUnits(raw,18)),raw:raw.toString()};
}

async function fraxSharesToFrxusd(provider,sharesRaw,blockTag){
  const r=new Contract(ADDR.fraxtalStakeUnstake,[
    'function convertToAssets(uint256) view returns (uint256)',
    'function previewRedeem(uint256) view returns (uint256)',
    'function pricePerShare() view returns (uint256)'
  ],provider);
  let raw=0n,method=null;
  try{raw=safeBig(await r.convertToAssets(sharesRaw,{blockTag}));method='convertToAssets'}
  catch{
    try{raw=safeBig(await r.previewRedeem(sharesRaw,{blockTag}));method='previewRedeem'}
    catch{
      const p=safeBig(await r.pricePerShare({blockTag}));
      raw=sharesRaw*p/(10n**18n);method='pricePerShare';
    }
  }
  return {nominal:Number(formatUnits(raw,18)),raw:raw.toString(),method};
}

function depositForWrapper(decoded,wrapper){
  return decoded.deposits.find(d=>lower(d.contract)===lower(wrapper)&&lower(d.owner)===lower(WALLET))
      || decoded.deposits.find(d=>lower(d.contract)===lower(wrapper))
      || null;
}

function stableTransferTo(decoded,token,targets){
  const ts=new Set(targets.filter(Boolean).map(lower));
  return decoded.transfers.find(t=>
    lower(t.token)===lower(token) &&
    (lower(t.from)===lower(WALLET)||ts.has(lower(t.to))) &&
    ts.has(lower(t.to))
  ) || null;
}

async function resolveEntry(provider,strategy,hint,foundedBlock){
  let entry=hint;
  if(strategy.mode==='lido-deposit-queue'){
    const d=await discoverLidoDeposit(provider,foundedBlock);
    if(d)entry=d;
  }else if(!entry){
    entry=await discoverEarliestInboundWrapper(provider,strategy,foundedBlock);
  }
  if(!entry?.txHash)throw new Error('entry transaction not found');

  const decoded=await decodeReceipt(provider,entry.txHash);
  const blockTag=decoded.blockNumber;
  let principal=null;
  let principalSymbol=strategy.terminal;
  let evidence=null;
  let confidence='high';

  if(strategy.mode==='erc4626'){
    const dep=depositForWrapper(decoded,strategy.wrapper);
    if(dep){
      const m=await tokenMeta(provider,strategy.underlying);
      principal=Number(formatUnits(BigInt(dep.assetsRaw),m.decimals));
      principalSymbol=m.symbol||strategy.terminal;
      evidence={type:'ERC4626-Deposit',...dep};
    }else{
      const t=stableTransferTo(decoded,strategy.underlying,[strategy.wrapper]);
      if(!t)throw new Error('ERC4626 underlying deposit not found');
      principal=t.amount; principalSymbol=t.symbol||strategy.terminal;
      evidence={type:'underlying-transfer',...t};
      confidence='medium';
    }
  }

  if(strategy.mode==='fxsave'){
    const dep=depositForWrapper(decoded,strategy.wrapper);
    if(dep){
      const nav=await fxBasePoolToNominal(provider,BigInt(dep.assetsRaw),blockTag);
      principal=nav.nominal; principalSymbol='fxUSD+USDC';
      evidence={type:'fxSAVE-Deposit-terminalized',...dep,terminalBreakdown:nav.breakdown};
    }else{
      const inbound=decoded.transfers.find(x=>
        lower(x.token)===lower(strategy.wrapper) &&
        lower(x.to)===lower(WALLET) &&
        finite(x.amount)
      );
      if(!inbound?.raw)throw new Error('fxSAVE inbound share transfer not found');
      const fxsave=new Contract(ADDR.fxsave,[
        'function convertToAssets(uint256) view returns (uint256)'
      ],provider);
      const basePoolRaw=safeBig(await fxsave.convertToAssets(BigInt(inbound.raw),{blockTag}));
      const nav=await fxBasePoolToNominal(provider,basePoolRaw,blockTag);
      principal=nav.nominal; principalSymbol='fxUSD+USDC';
      evidence={
        type:'fxSAVE-inbound-shares-terminalized-at-entry',
        sharesRaw:inbound.raw,
        shares:inbound.amount,
        from:inbound.from,
        basePoolRaw:basePoolRaw.toString(),
        terminalBreakdown:nav.breakdown
      };
      confidence='high';
    }
  }

  if(strategy.mode==='nested-erc4626'){
    const dep=depositForWrapper(decoded,strategy.wrapper);
    if(!dep)throw new Error('nested ERC4626 Deposit event not found');
    const terminal=await nestedYboldToBold(provider,BigInt(dep.assetsRaw),blockTag);
    principal=terminal.nominal; principalSymbol='BOLD';
    evidence={type:'ysyBOLD-Deposit-terminalized',...dep,terminalRaw:terminal.raw};
  }

  if(strategy.mode==='aave-supply'){
    const t=decoded.transfers.find(x=>
      lower(x.token)===lower(strategy.underlying) &&
      lower(x.from)===lower(WALLET) &&
      (lower(x.to)===lower(strategy.wrapper) || x.amount>0)
    );
    if(!t)throw new Error('Aave USDC supply transfer not found');
    principal=t.amount; principalSymbol='USDC';
    evidence={type:'Aave-underlying-supply-transfer',...t};
  }

  if(strategy.mode==='liquity-sp'){
    const t=decoded.transfers.find(x=>
      lower(x.token)===lower(ADDR.bold) &&
      lower(x.from)===lower(WALLET) &&
      lower(x.to)===lower(ADDR.liquitySpWeth)
    );
    if(!t)throw new Error('Liquity user BOLD deposit transfer not found');
    principal=t.amount; principalSymbol='BOLD';
    evidence={type:'Liquity-user-to-StabilityPool-transfer',...t};
  }

  if(strategy.mode==='lido-deposit-queue'){
    if(!entry.asset||!finite(entry.amount))throw new Error('Lido deposit amount unresolved');
    principal=Number(entry.amount);
    principalSymbol=entry.symbol||'USDC/USDT';
    evidence={
      type:'Lido-official-deposit-queue-transfer',
      asset:entry.asset,to:entry.to,amount:entry.amount,
      officialArchitecture:'Mellow/Lido EarnUSD DepositQueue'
    };
  }

  if(strategy.mode==='frax-sfrxusd'){
    const dep=depositForWrapper(decoded,strategy.wrapper);
    if(dep){
      const m=await tokenMeta(provider,ADDR.frxusd);
      principal=Number(formatUnits(BigInt(dep.assetsRaw),m.decimals));
      principalSymbol='frxUSD';
      evidence={type:'sfrxUSD-Deposit',...dep};
    }else{
      const t=decoded.transfers.find(x=>
        lower(x.token)===lower(ADDR.frxusd) &&
        (lower(x.to)===lower(ADDR.fraxtalStakeUnstake)||lower(x.to)===lower(ADDR.sfrxusd))
      );
      if(t){
        principal=t.amount; principalSymbol='frxUSD';
        evidence={type:'frxUSD-stake-transfer',...t};
      }else{
        const mint=decoded.transfers.find(x=>
          lower(x.token)===lower(ADDR.sfrxusd) &&
          lower(x.to)===lower(WALLET) &&
          lower(x.from)===lower(ZERO)
        );
        if(!mint)throw new Error('sfrxUSD entry evidence not found');
        const m=await tokenMeta(provider,ADDR.sfrxusd);
        const sharesRaw=BigInt(Math.round(mint.amount*10**Math.min(m.decimals,15))) *
          10n**BigInt(Math.max(0,m.decimals-15));
        // For unusual decimal conversion, prefer raw log-derived share amount.
        const log=decoded.receipt.logs.find(l=>
          lower(l.address)===lower(ADDR.sfrxusd)&&
          l.topics?.[0]===TRANSFER_TOPIC&&
          lower(addr('0x'+String(l.topics[2]).slice(-40)))===lower(WALLET)
        );
        const raw=log?safeBig(log.data):sharesRaw;
        const v=await fraxSharesToFrxusd(provider,raw,blockTag);
        principal=v.nominal; principalSymbol='frxUSD';
        evidence={type:'sfrxUSD-mint-historical-PPS',sharesRaw:raw.toString(),method:v.method};
        confidence='medium';
      }
    }
  }

  if(!(principal>0))throw new Error('entry principal unresolved');

  return {
    txHash:entry.txHash,
    block:decoded.blockNumber,
    timestamp:decoded.timestamp||entry.timestamp||null,
    principalNominalStable:round(principal,12),
    principalSymbol,
    confidence,
    evidence,
    receiptDiagnostics:{
      transferCount:decoded.transfers.length,
      depositEventCount:decoded.deposits.length
    }
  };
}

function currentNominalFor(strategy,position){
  const snap=position?.currentSnapshot||{};
  if(strategy.mode==='lido-deposit-queue'){
    return {
      comparable:false,
      nominal:null,
      symbol:'USD strategy NAV',
      reason:'Current Lido EarnUSD position still needs canonical Mellow/Lido share-oracle NAV adapter; market-price approximation is not used for strategy Performance.'
    };
  }
  let nominal=finite(snap.underlyingAmount)?Number(snap.underlyingAmount):null;
  if(!finite(nominal)){
    return {comparable:false,nominal:null,symbol:snap.terminalSymbol||strategy.terminal,reason:'current canonical nominal amount unavailable'};
  }
  let claimable=0;
  if(strategy.mode==='liquity-sp'&&finite(snap?.accruedClaimable?.amount)){
    claimable=Number(snap.accruedClaimable.amount);
  }
  return {
    comparable:true,
    nominal:round(nominal+claimable,12),
    principalInsidePosition:round(nominal,12),
    claimableAdded:round(claimable,12),
    symbol:snap.terminalSymbol||strategy.terminal,
    basis:'canonical redeemable nominal stable units; market/depeg price excluded'
  };
}

async function main(){
  const startedAt=nowIso();
  const resolver=readJson(RESOLVER_FILE);
  const stable=readJson(STABLE_FILE);

  if(resolver?.company?.registry!=='008'||resolver?.company?.name!=='Monetra.eth')throw new Error('resolver identity mismatch');
  if(stable?.company?.registry!=='008'||stable?.company?.name!=='Monetra.eth')throw new Error('Stable Capital identity mismatch');
  if((stable.positions||[]).length!==10)throw new Error('expected exactly 10 Stable Capital positions');

  const foundedAt=resolver?.company?.founding?.foundedAt||stable?.company?.foundedAt||'2026-05-27T05:46:11Z';
  const foundedTs=Math.floor(new Date(foundedAt).getTime()/1000);

  const stableById=Object.fromEntries((stable.positions||[]).map(p=>[p.id,p]));
  const rows=[];
  const sourceDiagnostics={ethereum:[],base:[],fraxtal:[]};

  for(const s of STRATEGIES){
    const r=await withProvider(s.chain,async(provider,url)=>{
      const foundedBlockObj=await findBlockAtOrBefore(provider,foundedTs);
      const hint=resolverEntryHint(resolver,s.id);
      const entry=await resolveEntry(provider,s,hint,Number(foundedBlockObj.number));
      return {
        provider:new URL(url).hostname,
        foundedBlock:Number(foundedBlockObj.number),
        entry
      };
    });

    if(r.ok){
      sourceDiagnostics[s.chain].push({
        id:s.id,status:'ok',provider:r.value.provider,
        foundedBlock:r.value.foundedBlock,
        failedProviderAttempts:r.attempts
      });
      const current=currentNominalFor(s,stableById[s.id]);
      const performance=
        current.comparable && finite(r.value.entry.principalNominalStable)
          ? {
              status:'comparable',
              incomeNominalStable:round(Number(current.nominal)-Number(r.value.entry.principalNominalStable),12),
              returnPct:round((Number(current.nominal)/Number(r.value.entry.principalNominalStable)-1)*100,8)
            }
          : {status:'pending',incomeNominalStable:null,returnPct:null};

      rows.push({
        id:s.id,protocol:s.protocol,chain:s.chain,mode:s.mode,
        entry:r.value.entry,current,performance,
        ownerTargetApproximatelyTen:
          Math.abs(Number(r.value.entry.principalNominalStable)-10)<=0.25
      });
    }else{
      sourceDiagnostics[s.chain].push({
        id:s.id,status:'failed',attempts:r.attempts,error:r.error
      });
      rows.push({
        id:s.id,protocol:s.protocol,chain:s.chain,mode:s.mode,
        entry:{status:'error',error:r.error||'all chain providers failed',attempts:r.attempts},
        current:currentNominalFor(s,stableById[s.id]),
        performance:{status:'pending',incomeNominalStable:null,returnPct:null},
        ownerTargetApproximatelyTen:null
      });
    }
  }

  // Restore canonical strategy ordering.
  const order=new Map(STRATEGIES.map((s,i)=>[s.id,i]));
  rows.sort((a,b)=>order.get(a.id)-order.get(b.id));

  const entryResolved=rows.filter(r=>finite(r?.entry?.principalNominalStable));
  const comparable=rows.filter(r=>r?.performance?.status==='comparable');
  const entryPrincipalTotal=round(entryResolved.reduce((s,r)=>s+Number(r.entry.principalNominalStable),0),12);
  const comparablePrincipalTotal=round(comparable.reduce((s,r)=>s+Number(r.entry.principalNominalStable),0),12);
  const comparableCurrentTotal=round(comparable.reduce((s,r)=>s+Number(r.current.nominal),0),12);
  const comparableIncome=round(Number(comparableCurrentTotal||0)-Number(comparablePrincipalTotal||0),12);
  const comparableReturnPct =
    Number(comparablePrincipalTotal)>0
      ? round((Number(comparableCurrentTotal)/Number(comparablePrincipalTotal)-1)*100,8)
      : null;

  const unresolved=rows.filter(r=>!finite(r?.entry?.principalNominalStable)||r?.current?.comparable!==true)
    .map(r=>({
      id:r.id,protocol:r.protocol,
      entryResolved:finite(r?.entry?.principalNominalStable),
      currentComparable:r?.current?.comparable===true,
      reason:r?.entry?.error||r?.current?.reason||'unknown'
    }));

  const fullEntryReady=entryResolved.length===10;
  const fullPerformanceReady=fullEntryReady&&comparable.length===10&&unresolved.length===0;

  const out={
    version:VERSION,
    methodologyVersion:METHODOLOGY,
    generatedAt:nowIso(),
    startedAt,
    company:{
      registry:'008',name:'Monetra.eth',wallet:WALLET,foundedAt
    },
    correction:{
      supersedesPublicPerformanceFromBoundaryFlowLedger:true,
      reason:'Wallet boundary inflows/outflows are not the correct cost basis for this Stable Company because the wallet was also used for routing, swaps and temporary capital movement. Performance must begin when capital enters each productive strategy.',
      previousBoundaryLedgerTreatment:'retain as diagnostic capital-routing history only; do not use its netInvestedUsd as public Stable strategy Performance basis.',
      userIntent:'Track the approximately 10 stable tokens deployed into each of 10 productive strategies, then measure what those strategy positions have produced.',
      v04TargetedFixes:[
        'Rotate RPC provider per strategy when a provider returns 403 or another strategy-specific failure.',
        'Reconstruct fxSAVE entry from inbound fxSAVE shares when there is no local ERC4626 Deposit event.',
        'For Liquity use only the user BOLD transfer into the Stability Pool; ignore protocol mint events from the zero address.',
        'Keep Lido current nominal NAV fail-closed until the canonical Mellow/Lido oracle path is reproduced.'
      ]
    },
    methodology:{
      invested:'Sum of stable units actually deposited/staked into the 10 productive strategies, reconstructed from protocol deposit/stake transactions.',
      currentStrategyValue:'Canonical redeemable nominal stable units in each strategy. Stablecoin market/depeg movement is excluded from strategy income.',
      performance:'Current nominal stable units + separately claimable strategy rewards - strategy entry principal.',
      priceEffect:'USD market-price/depeg movement remains a separate Stable Price Effect and does not masquerade as strategy yield.',
      walletFlows:'External wallet funding, bridging, swaps and unrelated withdrawals are ignored unless they are themselves the protocol entry transaction.',
      apy:'Reference APY remains current productive capacity and is never used to backfill historical Performance.'
    },
    sourceDiagnostics,
    summary:{
      strategyCount:10,
      entryResolvedCount:entryResolved.length,
      currentNominalComparableCount:comparable.length,
      ownerApproxTenMatchedCount:rows.filter(r=>r.ownerTargetApproximatelyTen===true).length,
      entryPrincipalNominalStableResolvedTotal:entryPrincipalTotal,
      comparablePrincipalNominalStable:comparablePrincipalTotal,
      comparableCurrentNominalStable:comparableCurrentTotal,
      comparableIncomeNominalStable:comparableIncome,
      comparableReturnPct,
      fullEntryReady,
      fullPerformanceReady,
      publicInvestedReady:fullEntryReady,
      publicPerformanceReady:fullPerformanceReady,
      note:fullPerformanceReady
        ? 'All 10 strategy-entry bases and current nominal stable values are reproducibly comparable.'
        : 'Do not publish aggregate Performance yet. Resolve only the listed strategy gaps; wallet boundary-flow archaeology is no longer the Performance basis.'
    },
    strategies:rows,
    unresolved,
    integrationContract:{
      publicInvestedField:'strategyInvestedNominalStable',
      publicPerformanceBasis:'strategy-entry-nominal-stable',
      require:'summary.fullPerformanceReady === true',
      desiredPassport:'Invested · Current Capital · Performance $/% · APY · Claimable'
    }
  };

  writeJson(OUT_FILE,out);

  console.log('Monetra Strategy Entry Ledger v0.3');
  console.log(JSON.stringify(out.summary,null,2));
  if(unresolved.length)console.log('Unresolved:',JSON.stringify(unresolved,null,2));
}

main().catch(e=>{
  console.error('MONETRA STRATEGY ENTRY LEDGER FATAL:',e);
  process.exitCode=1;
});
