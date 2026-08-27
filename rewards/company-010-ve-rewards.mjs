#!/usr/bin/env node
import fs from 'node:fs';
import { Contract, JsonRpcProvider, ZeroAddress, formatUnits, getAddress } from 'ethers';

const STATE=process.env.COMPANY_010_STATE||'companies/company-010-production-state.json';
const OUTPUT=process.env.COMPANY_010_VE_REWARDS||'/tmp/company-010-ve-rewards.json';
const state=JSON.parse(fs.readFileSync(STATE,'utf8'));
if(state?.company?.registry!=='010'||state?.company?.name!=='Cypher')throw new Error('canonical Company #010 state required');
if(state?.authority?.executionAuthority!=='none')throw new Error('Company #010 authority drift');
const wallet2=(state.company.wallets||[]).find(x=>x.alias==='Wallet 2');
if(!wallet2?.address)throw new Error('Company #010 Wallet 2 required');

const CONFIG={
  aerodrome:{protocol:'Aerodrome',route:'aerodrome-ve',chain:'Base',rpc:[process.env.BASE_RPC_URL,process.env.BASE_RPC_URL_2,'https://base-rpc.publicnode.com','https://mainnet.base.org'],token:'0x940181a94A35A4569E4529A3CDfB74e38FD98631',symbol:'AERO',ve:'0xeBf418Fe2512e7E6bd9b87a8F0f294aCDC67e6B4',distributor:'0x227f65131A261548b057215bB1D5Ab2997964C7d'},
  velodrome:{protocol:'Velodrome',route:'velodrome-ve-direct',chain:'Optimism',rpc:[process.env.OPTIMISM_RPC_URL,'https://optimism-rpc.publicnode.com','https://mainnet.optimism.io'],token:'0x9560e827aF36c94D2Ac33a39bCE1Fe78631088Db',symbol:'VELO',ve:'0xFAf8FD17D9840595845582fCB047DF13f006787d',distributor:'0x9D4736EC60715e71aFe72973f7885DCBC21EA99b'}
};
const VE_ABI=['function balanceOf(address owner) view returns (uint256)','function ownerToNFTokenIdList(address owner,uint256 index) view returns (uint256)','function idToManaged(uint256 tokenId) view returns (uint256)','function managedToLocked(uint256 managedTokenId) view returns (address)','function managedToFree(uint256 managedTokenId) view returns (address)'];
const DIST_ABI=['function claimable(uint256 tokenId) view returns (uint256)'];
const REWARD_ABI=['function earned(address token,uint256 tokenId) view returns (uint256)'];

const unique=a=>[...new Set(a.filter(Boolean).map(x=>String(x).trim()).filter(Boolean))];
async function providerFor(cfg){let last=null;for(const url of unique(cfg.rpc)){try{const p=new JsonRpcProvider(url,undefined,{staticNetwork:false});await p.getBlockNumber();return p}catch(e){last=e}}throw last||new Error(`${cfg.chain} RPC unavailable`)}
const n18=x=>Number(formatUnits(x,18));

async function collect(cfg){
  const p=await providerFor(cfg),ve=new Contract(cfg.ve,VE_ABI,p),dist=new Contract(cfg.distributor,DIST_ABI,p);
  const count=Number(await ve.balanceOf(wallet2.address));
  const positions=[];let compounded=0,claimable=0,managedCount=0,directCount=0;const issues=[];
  for(let i=0;i<count;i++){
    const tokenId=await ve.ownerToNFTokenIdList(wallet2.address,i);let managedId=0n,locked=ZeroAddress,free=ZeroAddress,lockedEarned=0n,freeEarned=0n,rebase=0n;
    try{managedId=await ve.idToManaged(tokenId)}catch(e){issues.push(`token ${tokenId}: idToManaged ${e.shortMessage||e.message}`)}
    if(managedId>0n){
      managedCount++;
      try{locked=getAddress(await ve.managedToLocked(managedId))}catch(e){issues.push(`token ${tokenId}: managedToLocked ${e.shortMessage||e.message}`)}
      try{free=getAddress(await ve.managedToFree(managedId))}catch{}
      if(locked&&locked!==ZeroAddress){try{lockedEarned=await new Contract(locked,REWARD_ABI,p).earned(cfg.token,tokenId)}catch(e){issues.push(`token ${tokenId}: locked earned ${e.shortMessage||e.message}`)}}
      if(free&&free!==ZeroAddress){try{freeEarned=await new Contract(free,REWARD_ABI,p).earned(cfg.token,tokenId)}catch(e){issues.push(`token ${tokenId}: free earned ${e.shortMessage||e.message}`)}}
    }else directCount++;
    try{rebase=await dist.claimable(tokenId)}catch(e){issues.push(`token ${tokenId}: distributor claimable ${e.shortMessage||e.message}`)}
    compounded+=n18(lockedEarned);claimable+=n18(freeEarned)+n18(rebase);
    positions.push({tokenId:tokenId.toString(),managedId:managedId.toString(),mode:managedId>0n?'managed':'direct',lockedManagedReward:locked===ZeroAddress?null:locked,freeManagedReward:free===ZeroAddress?null:free,compoundedBaseToken:n18(lockedEarned),claimableBaseToken:n18(freeEarned)+n18(rebase),rebaseClaimable:n18(rebase)});
  }
  const mode=managedCount>0&&directCount===0?'managed-compounded':directCount>0&&managedCount===0?'direct':'mixed';
  const directNeedsFullIndex=directCount>0;
  const status=count===0?'warming':issues.length||directNeedsFullIndex?'partial':'ok';
  const publicState=mode==='managed-compounded'?'Compounded':mode==='direct'&&issues.length===0?'Claimable':'Pending';
  return {protocol:cfg.protocol,route:cfg.route,chain:cfg.chain,status,wallet:wallet2.address,walletAlias:'Wallet 2',veNftCount:count,managedCount,directCount,mode,publicState,compounded:{symbol:cfg.symbol,amount:Number(compounded.toFixed(12)),classification:'compounded-locked'},claimable:{symbol:cfg.symbol,amount:Number(claimable.toFixed(12)),classification:'unclaimed'},positions,issues,source:'existing The Holding ve mechanism · VotingEscrow managed state + Locked/FreeManagedReward.earned + RewardsDistributor.claimable',unknownIsNotZero:status!=='ok',directRouteNeedsExistingFullRewardIndex:directNeedsFullIndex};
}

const routes={};for(const [k,cfg] of Object.entries(CONFIG)){try{routes[k]=await collect(cfg)}catch(e){routes[k]={protocol:cfg.protocol,route:cfg.route,chain:cfg.chain,status:'error',wallet:wallet2.address,walletAlias:'Wallet 2',veNftCount:null,managedCount:null,directCount:null,mode:'unknown',publicState:'Pending',compounded:{symbol:cfg.symbol,amount:null,classification:'compounded-locked'},claimable:{symbol:cfg.symbol,amount:null,classification:'unclaimed'},positions:[],issues:[e.shortMessage||e.message],source:'existing The Holding ve mechanism',unknownIsNotZero:true,directRouteNeedsExistingFullRewardIndex:false}}}
const out={version:'0.1-company-010-ve-reward-state',generatedAt:new Date().toISOString(),company:'Cypher',walletScope:{alias:'Wallet 2',address:wallet2.address},routes,semantics:{managedLockedReward:'Compounded',directRoute:'Claimable when current distributor accrual is measured without read errors; route completeness may remain partial until the established full direct reward index is bound for Company #010',unknown:'Pending',unknownIsNotZero:true},authority:{readOnly:true,transactions:false,executionAuthority:'none'}};
fs.writeFileSync(OUTPUT,JSON.stringify(out,null,2)+'\n');console.log(JSON.stringify({status:'PASS',...Object.fromEntries(Object.entries(routes).map(([k,v])=>[k,{status:v.status,mode:v.mode,publicState:v.publicState,veNftCount:v.veNftCount,compounded:v.compounded.amount,claimable:v.claimable.amount,directRouteNeedsExistingFullRewardIndex:v.directRouteNeedsExistingFullRewardIndex}]))},null,2));