#!/usr/bin/env node
/**
 * Company #007 · Yield Basis LP current-state proof v0.1
 *
 * Purpose: distinguish a verified current zero position from UNKNOWN before the
 * Company #007 discovery artifact is allowed to replace the last-known-good
 * production state. This is read-only state evidence, never period-income
 * authority and never a wallet/capital execution path.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { Contract, JsonRpcProvider, ZeroAddress, getAddress } from 'ethers';

const VERSION='0.1-yblp-current-state-quorum';
const OUTPUT=process.env.COMPANY_007_YBLP_CURRENT_STATE_OUTPUT||path.resolve('companies/company-007-yblp-current-state.json');
const WALLETS=[
  getAddress('0x7ec6331188468269dc7c1cf6a84c972632178b1e'),
  getAddress('0x9c548960bd053c8465f298a711b6343ae0360309')
];
const HYBRID_FACTORY=getAddress('0xbdc32268851c324c6185809271dfe6d8dab8dc5b');
const MARKETS=[
  {family:'BTC',version:'current',market:'yb-WBTC',lt:getAddress('0x651d4b8168488fa163d85304662e8278d4c55baa'),gauge:getAddress('0xaa0b1d265f23972eafb7d088e963bd31403a58f5')},
  {family:'ETH',version:'current',market:'yb-WETH',lt:getAddress('0x2b9c9f3bdceb5d8e36a4704f08a78fca53343cea'),gauge:getAddress('0xd829456fd63ada7de0657714a3a7a26de403e3d8')},
  {family:'BTC',version:'deprecated-v2',market:'yb-WBTC v2',lt:getAddress('0xfbf3c16676055776ab9b286492d8f13e30e2e763'),gauge:getAddress('0xbc56e3edb67b56d598ace07668b138815f45d7aa')},
  {family:'BTC',version:'deprecated-legacy',market:'yb-WBTC Legacy',lt:getAddress('0x6095a220c5567360d459462a25b1ad5aead45204'),gauge:getAddress('0x37f45e64935e7b8383d2f034048b32770b04e8bd')},
  {family:'ETH',version:'deprecated-legacy',market:'yb-WETH Legacy',lt:getAddress('0x931d40dd07b25b91932b481b63631ea86d236e09'),gauge:getAddress('0xe4e656b5215a82009969219b1babb7c0757a3315')}
];
const RPC_URLS=[
  process.env.ETH_RPC_URL,
  process.env.ETH_RPC_URL_2,
  'https://eth.blockscout.com/api/eth-rpc',
  'https://eth.merkle.io',
  'https://ethereum-rpc.publicnode.com',
  'https://eth.drpc.org',
  'https://1rpc.io/eth',
  'https://rpc.flashbots.net'
].filter(Boolean);
const REQUIRED_QUORUM=Number(process.env.COMPANY_007_YBLP_REQUIRED_QUORUM||2);
const ZERO=ZeroAddress.toLowerCase();
const lower=x=>String(x||'').toLowerCase();
const host=url=>{try{return new URL(url).hostname}catch{return 'configured'}};
const positive=x=>{try{return BigInt(x)>0n}catch{return false}};

async function resolveHybridVault(provider,wallet){
  const factory=new Contract(HYBRID_FACTORY,[
    'function vaults(address) view returns (address)',
    'function user_to_vault(address) view returns (address)'
  ],provider);
  const errors=[];
  for(const method of ['vaults','user_to_vault']){
    try{
      const value=getAddress(await factory[method](wallet));
      return {resolved:true,vault:lower(value)===ZERO?null:value,method,errors};
    }catch(error){errors.push(`${method}: ${error?.shortMessage||error?.message||error}`);}
  }
  throw new Error(`HybridVault mapping unreadable for ${wallet}: ${errors.join(' | ')}`);
}

async function snapshot(url){
  const provider=new JsonRpcProvider(url);
  try{
    const blockNumber=await provider.getBlockNumber();
    if(!(blockNumber>0))throw new Error('latest block unavailable');
    const holders=[];
    for(const wallet of WALLETS){
      holders.push({holder:wallet,owner:wallet,custody:'wallet'});
      const hybrid=await resolveHybridVault(provider,wallet);
      if(hybrid.vault)holders.push({holder:hybrid.vault,owner:wallet,custody:'Yield Basis HybridVault'});
    }
    const uniqueHolders=[...new Map(holders.map(x=>[lower(x.holder),x])).values()];
    const rows=[];
    for(const market of MARKETS){
      const lt=new Contract(market.lt,['function balanceOf(address) view returns (uint256)'],provider);
      const gauge=new Contract(market.gauge,['function balanceOf(address) view returns (uint256)'],provider);
      for(const h of uniqueHolders){
        const direct=await lt.balanceOf(h.holder);
        const gaugeShares=await gauge.balanceOf(h.holder);
        rows.push({...market,...h,directLtBalanceRaw:direct.toString(),gaugeShareBalanceRaw:gaugeShares.toString()});
      }
    }
    const fingerprint=JSON.stringify(rows.map(x=>[
      lower(x.lt),lower(x.gauge),lower(x.holder),x.directLtBalanceRaw,x.gaugeShareBalanceRaw
    ]));
    return {provider:host(url),blockNumber,holders:uniqueHolders,rows,fingerprint};
  }finally{
    provider.destroy();
  }
}

async function main(){
  const successes=[];
  const errors=[];
  for(const url of RPC_URLS){
    try{
      const s=await snapshot(url);
      successes.push(s);
      if(successes.filter(x=>x.fingerprint===s.fingerprint).length>=REQUIRED_QUORUM)break;
    }catch(error){errors.push(`${host(url)}: ${error?.shortMessage||error?.message||error}`);}
  }
  const groups=new Map();
  for(const s of successes){const arr=groups.get(s.fingerprint)||[];arr.push(s);groups.set(s.fingerprint,arr);}
  const consensus=[...groups.values()].sort((a,b)=>b.length-a.length)[0]||[];
  if(consensus.length<REQUIRED_QUORUM){
    throw new Error(`YBLP current-state quorum not reached (${consensus.length}/${REQUIRED_QUORUM}); UNKNOWN != 0; ${errors.join(' | ')}`);
  }
  const canonical=consensus[0];
  const markets=MARKETS.map(m=>{
    const rows=canonical.rows.filter(x=>lower(x.lt)===lower(m.lt));
    const active=rows.filter(x=>positive(x.directLtBalanceRaw)||positive(x.gaugeShareBalanceRaw));
    return {...m,currentState:active.length?'active':'verified-zero',activeHoldings:active,allHoldings:rows};
  });
  const output={
    version:VERSION,
    generatedAt:new Date().toISOString(),
    status:'ok',
    purpose:'Fail-closed current-state custody proof for Company #007 Yield Basis LP inventory; verified zero is distinct from unknown.',
    quorum:{required:REQUIRED_QUORUM,matching:consensus.length,providers:consensus.map(x=>x.provider),blocks:consensus.map(x=>x.blockNumber)},
    company:{registry:'007',name:"Rook's portfolio",wallets:WALLETS},
    holders:canonical.holders,
    markets,
    semantics:{unknownIsNotZero:true,verifiedZeroMayLeaveCurrentInventory:true,historyMustBePreserved:true,currentStateIsNotPeriodIncome:true,referenceAprUsed:false},
    authority:{readOnly:true,executionAuthority:'none',walletAuthority:'none',claimingAuthority:'none',capitalExecution:false},
    sourceErrors:errors
  };
  await fs.mkdir(path.dirname(OUTPUT),{recursive:true});
  await fs.writeFile(OUTPUT,JSON.stringify(output,null,2)+'\n');
  console.log('Company #007 YBLP current-state proof',JSON.stringify({status:output.status,quorum:output.quorum,markets:markets.map(x=>({market:x.market,state:x.currentState,activeHoldings:x.activeHoldings.length}))}));
}

main().catch(error=>{console.error(error);process.exitCode=1;});
