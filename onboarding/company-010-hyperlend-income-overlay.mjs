#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { Contract, JsonRpcProvider, formatUnits, getAddress } from 'ethers';

const ROOT=process.cwd();
const STATE=process.env.COMPANY_010_STATE||path.join(ROOT,'companies/company-010-production-state.json');
const ASSET=getAddress('0xfD739d4e423301CE9385c1fb8850539D657C296D');
const DATA_PROVIDER=getAddress('0x5481bf8d3946e6a3168640c1d7523eb59f055a29');
const RPC=[...new Set([process.env.HYPEREVM_RPC_URL,'https://rpc.hyperlend.finance','https://rpc.hyperliquid.xyz/evm'].filter(Boolean))];
const VERSION='0.1-company-010-hyperlend-income-parity';
const RAY=10n**27n,HALF_RAY=RAY/2n;
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const finite=x=>x!==null&&x!==undefined&&x!==''&&Number.isFinite(Number(x));
const round=(x,d=12)=>finite(x)?Number(Number(x).toFixed(d)):null;
const lower=x=>String(x||'').toLowerCase();
const rayMul=(a,b)=>(a*b+HALF_RAY)/RAY;
const clean=e=>String(e?.shortMessage||e?.message||e||'unknown').replace(/https?:\/\/[^\s)]+/g,'[url-redacted]');
async function provider(){let last;for(const url of RPC){try{const p=new JsonRpcProvider(url,999,{staticNetwork:true});if(Number((await p.getNetwork()).chainId)!==999)throw new Error('wrong chain');return p}catch(e){last=e}}throw last||new Error('HyperEVM provider unavailable')}
async function tokenMeta(p,a){const c=new Contract(a,['function symbol() view returns(string)','function decimals() view returns(uint8)'],p);let symbol=null,decimals=18;try{symbol=String(await c.symbol())}catch{}try{decimals=Number(await c.decimals())}catch{}return{address:getAddress(a),symbol,decimals}}

async function main(){
 const state=read(STATE);
 if(state?.version!=='0.3-company-010-production-state-stakedao-complete'||state?.company?.registry!=='010'||state?.company?.name!=='Cypher')throw new Error('compatible Company #010 state required');
 if(state?.authority?.executionAuthority!=='none')throw new Error('execution authority drift');
 const cap=(state.capital?.positions||[]).find(x=>x.assetId===`hyperlend-${lower(ASSET)}`);
 const prod=(state.productivity?.positions||[]).find(x=>x.id===`hyperlend-${lower(ASSET)}`);
 if(!cap||!prod||!(Number(cap.quantity)>0)||!(Number(cap.priceUsd)>0)||!(Number(prod.referenceAprPct)>=0))throw new Error('measured HyperLend kHYPE principal/rate required');
 const wallets=state.company?.wallets||[];if(!wallets.length)throw new Error('Company #010 wallets missing');
 const p=await provider();
 const dp=new Contract(DATA_PROVIDER,['function getReserveTokensAddresses(address asset) view returns(address aTokenAddress,address stableDebtTokenAddress,address variableDebtTokenAddress)'],p);
 const reserve=await dp.getReserveTokensAddresses(ASSET);const hToken=getAddress(reserve.aTokenAddress??reserve[0]);
 if(lower(hToken)==='0x0000000000000000000000000000000000000000')throw new Error('HyperLend hToken unavailable');
 const h=new Contract(hToken,[
  'function symbol() view returns(string)','function decimals() view returns(uint8)','function scaledBalanceOf(address user) view returns(uint256)','function getPreviousIndex(address user) view returns(uint256)','function getIncentivesController() view returns(address)','function REWARDS_CONTROLLER() view returns(address)','function POOL() view returns(address)'
 ],p);
 const [hSymbol,hDecimals,poolAddr]=await Promise.all([h.symbol(),h.decimals(),h.POOL()]);
 let controller='0x0000000000000000000000000000000000000000';try{controller=getAddress(await h.REWARDS_CONTROLLER())}catch{try{controller=getAddress(await h.getIncentivesController())}catch{}}
 const pool=new Contract(getAddress(poolAddr),['function getReserveNormalizedIncome(address asset) view returns(uint256)'],p);
 const currentIndex=BigInt(await pool.getReserveNormalizedIncome(ASSET));if(currentIndex<=0n)throw new Error('HyperLend current liquidity index unavailable');
 let embeddedAmount=0,embeddedComplete=true;const embeddedWallets=[];
 for(const w of wallets){const user=getAddress(w.address);const [scaled,prev]=await Promise.all([h.scaledBalanceOf(user),h.getPreviousIndex(user)]);const scaledRaw=BigInt(scaled),prevIndex=BigInt(prev);let amount=null,status='measured';if(scaledRaw===0n)amount=0;else if(prevIndex<=0n){status='warming';embeddedComplete=false}else{const nowRaw=rayMul(scaledRaw,currentIndex),prevRaw=rayMul(scaledRaw,prevIndex),delta=nowRaw>=prevRaw?nowRaw-prevRaw:0n;amount=Number(formatUnits(delta,Number(hDecimals)));embeddedAmount+=amount}embeddedWallets.push({wallet:user,walletAlias:w.alias||null,scaledBalanceRaw:scaledRaw.toString(),previousLiquidityIndex:prevIndex.toString(),currentLiquidityIndex:currentIndex.toString(),embeddedInterestSinceLastAction:amount===null?null:round(amount,12),status})}
 const embeddedUsd=embeddedComplete?embeddedAmount*Number(cap.priceUsd):null;

 let incentiveStatus='none',rewardAssets=[],incentives=[];
 if(lower(controller)!=='0x0000000000000000000000000000000000000000'){
  const rc=new Contract(controller,['function getRewardsByAsset(address asset) view returns(address[])','function getUserRewards(address[] assets,address user,address reward) view returns(uint256)','function getRewardsData(address asset,address reward) view returns(uint256 index,uint256 emissionPerSecond,uint256 lastUpdateTimestamp,uint256 distributionEnd)'],p);
  rewardAssets=(await rc.getRewardsByAsset(hToken)).map(getAddress);
  incentiveStatus=rewardAssets.length?'configured':'none';
  for(const reward of rewardAssets){const meta=await tokenMeta(p,reward);let total=0;const byWallet=[];let emission=null,distributionEnd=null;try{const d=await rc.getRewardsData(hToken,reward);emission=String(d.emissionPerSecond??d[1]);distributionEnd=Number(d.distributionEnd??d[3])}catch{}
   for(const w of wallets){const user=getAddress(w.address);let raw;try{raw=BigInt(await rc.getUserRewards([hToken],user,reward))}catch(e){throw new Error(`HyperLend getUserRewards failed ${meta.symbol||reward}: ${clean(e)}`)}const amount=Number(formatUnits(raw,meta.decimals));total+=amount;byWallet.push({wallet:user,walletAlias:w.alias||null,amount:round(amount,12),amountRaw:raw.toString()})}
   incentives.push({rewardToken:reward,symbol:meta.symbol||'Reward',decimals:meta.decimals,claimable:round(total,12),wallets:byWallet,emissionPerSecondRaw:emission,distributionEnd,status:'measured',classification:'unclaimed',source:'HyperLend hToken RewardsController getRewardsByAsset + getUserRewards'})
  }
 }
 state.strategies=state.strategies||{};state.strategies.hyperlend={version:VERSION,status:'measured',protocol:'HyperLend',chain:'HyperEVM',market:'kHYPE supply',underlyingAsset:ASSET,hToken,hTokenSymbol:String(hSymbol),dataProvider:DATA_PROVIDER,pool:getAddress(poolAddr),referenceAprPct:Number(prod.referenceAprPct),income:{primary:{state:'Compounded',classification:'embedded-lending-interest',claimableApplicable:false,amount:embeddedComplete?round(embeddedAmount,12):null,symbol:'kHYPE',usdValue:embeddedUsd===null?null:round(embeddedUsd,6),measurementStatus:embeddedComplete?'measured':'warming',metric:'scaledBalance × (current liquidity index − previous user index)',wallets:embeddedWallets,source:'HyperLend hToken scaledBalanceOf/getPreviousIndex + Pool getReserveNormalizedIncome',note:'Supply interest accrues inside the hToken balance. It is already part of strategy NAV and must not be added again to capital or claimable totals.'},externalIncentives:{status:incentiveStatus,controller:lower(controller)==='0x0000000000000000000000000000000000000000'?null:controller,rewardAssetCount:rewardAssets.length,rewards:incentives,classification:rewardAssets.length?'unclaimed':'none',source:'HyperLend hToken RewardsController'}},accountingBoundary:{embeddedInterestAlreadyInPrincipalBalance:true,embeddedInterestNotAdditiveCapital:true,embeddedInterestNotClaimable:true,externalIncentivesSeparateFromSupplyApr:true,noDoubleCount:true},authority:{readOnly:true,walletSigning:false,transactions:false,executionAuthority:'none'}};
 state.rewards=state.rewards||{};state.rewards.embeddedIncomeMechanisms=Array.isArray(state.rewards.embeddedIncomeMechanisms)?state.rewards.embeddedIncomeMechanisms:[];state.rewards.embeddedIncomeMechanisms=state.rewards.embeddedIncomeMechanisms.filter(x=>x.id!=='hyperlend-khype');state.rewards.embeddedIncomeMechanisms.push({id:'hyperlend-khype',protocol:'HyperLend',chain:'HyperEVM',state:'Compounded',incomeMode:'embedded-lending-interest',claimableApplicable:false,symbol:'kHYPE',amount:embeddedComplete?round(embeddedAmount,12):null,usdValue:embeddedUsd===null?null:round(embeddedUsd,6),referenceAprPct:Number(prod.referenceAprPct),measurementStatus:embeddedComplete?'measured':'warming',source:'HyperLend scaled balance + liquidity index',note:'Embedded lending interest is already inside current hToken balance and strategy NAV.'});
 state.rewards.observations=(state.rewards.observations||[]).filter(x=>x.route!=='hyperlend-khype-incentives');for(const x of incentives){state.rewards.observations.push({id:`hyperlend-${lower(x.rewardToken)}-claimable`,route:'hyperlend-khype-incentives',protocol:'HyperLend',chain:'HyperEVM',token:x.symbol,tokenAddress:x.rewardToken,claimable:x.claimable,usdValue:null,status:'measured-unpriced',classification:'unclaimed',source:x.source})}
 state.rewards.supportedRoutes=(state.rewards.supportedRoutes||[]).filter(x=>x.id!=='hyperlend-khype-incentives');if(rewardAssets.length)state.rewards.supportedRoutes.push({id:'hyperlend-khype-incentives',protocol:'HyperLend',chain:'HyperEVM',walletAlias:'canonical Company #010 wallets',claimableState:'measured'});
 state.rewards.unboundMechanisms=(state.rewards.unboundMechanisms||[]).filter(x=>x!=='HyperLend');
 state.epistemicBoundary=state.epistemicBoundary||{};Object.assign(state.epistemicBoundary,{hyperlendSupplyInterestIsEmbedded:true,hyperlendEmbeddedInterestIsNotClaimable:true,hyperlendExternalIncentivesAreSeparate:true,hyperlendAprIsNotRealisedIncome:true});
 state.provenance=state.provenance||{};state.provenance.hyperlendIncome={version:VERSION,generatedAt:new Date().toISOString(),underlyingAsset:ASSET,hToken,rewardsController:lower(controller)==='0x0000000000000000000000000000000000000000'?null:controller,proof:'HyperLend/Aave-compatible hToken scaled balance + liquidity index; separate RewardsController enumeration'};
 fs.writeFileSync(STATE,JSON.stringify(state,null,2)+'\n');
 console.log(JSON.stringify({status:'PASS',version:VERSION,hToken,hTokenSymbol:String(hSymbol),referenceAprPct:Number(prod.referenceAprPct),embedded:{status:embeddedComplete?'measured':'warming',kHYPE:embeddedComplete?round(embeddedAmount,12):null,usd:embeddedUsd===null?null:round(embeddedUsd,6)},incentives:{controller:state.strategies.hyperlend.income.externalIncentives.controller,rewardAssetCount:rewardAssets.length,rewards:incentives.map(x=>({symbol:x.symbol,claimable:x.claimable,emissionPerSecondRaw:x.emissionPerSecondRaw,distributionEnd:x.distributionEnd}))},executionAuthority:'none'},null,2));
}
main().catch(e=>{console.error(e?.stack||e);process.exit(1)});
