#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { AbiCoder, Contract, JsonRpcProvider, formatUnits, getAddress, id, keccak256 } from 'ethers';

const ROOT=process.cwd();
const GMX=process.env.COMPANY_010_GMX_INPUT||path.join(ROOT,'companies/company-010-gmx-reader.json');
const STATE=process.env.COMPANY_010_PRODUCTION_OUTPUT||path.join(ROOT,'companies/company-010-production-state.json');
const DATASTORE=getAddress('0xFD70de6b91282D8017aA4E741e9Ae325CAb992d8');
const RPC=[...new Set([process.env.ARBITRUM_RPC_URL,'https://arbitrum-one-rpc.publicnode.com','https://arb1.arbitrum.io/rpc'].filter(Boolean))];
const coder=AbiCoder.defaultAbiCoder();
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const n=x=>x!==null&&x!==undefined&&x!==''&&Number.isFinite(Number(x))?Number(x):null;
const round=(x,d=8)=>n(x)===null?null:Number(Number(x).toFixed(d));
const lower=x=>String(x||'').toLowerCase();

async function provider(){let last;for(const url of RPC){try{const p=new JsonRpcProvider(url,42161,{staticNetwork:true});if(Number((await p.getNetwork()).chainId)!==42161)throw new Error('wrong chain');return p}catch(e){last=e}}throw last||new Error('Arbitrum provider unavailable')}
function poolAmountKey(market,token){return keccak256(coder.encode(['bytes32','address','address'],[id('POOL_AMOUNT'),market,token]))}
function priceUsdFromReader(rawPrice,decimals){if(rawPrice===null||rawPrice===undefined)return null;const raw=BigInt(rawPrice);if(raw<=0n)return null;const scaled=raw*(10n**BigInt(decimals));return Number(formatUnits(scaled,30))}

const gmx=read(GMX),state=read(STATE);
if(gmx?.version!=='0.1.3-company-010-gmx-reader-valuation')throw new Error('reviewed GMX Reader v0.1.3 required');
if(state?.company?.registry!=='010'||state?.company?.name!=='Cypher')throw new Error('Cypher production state required');
if(state?.capital?.totalCapitalComplete!==true)throw new Error('complete Company #010 capital required');
if(state?.authority?.executionAuthority!=='none'||gmx?.authority?.executionAuthority!=='none')throw new Error('authority drift');
if(!Array.isArray(gmx.results)||gmx.results.length!==2)throw new Error('exactly two reviewed GMX markets required');

const p=await provider();
const ds=new Contract(DATASTORE,['function getUint(bytes32 key) view returns(uint256)'],p);
const strategies=[];
for(const x of gmx.results){
  const market=getAddress(x.marketToken);
  const long=getAddress(x.market?.longToken);
  const short=getAddress(x.market?.shortToken);
  const longMeta=x.tokens?.long,shortMeta=x.tokens?.short;
  if(!longMeta||!shortMeta)throw new Error(`${x.label}: GMX long/short token metadata missing`);
  const [longRaw,shortRaw]=await Promise.all([ds.getUint(poolAmountKey(market,long)),ds.getUint(poolAmountKey(market,short))]);
  const longDecimals=Number(longMeta.decimals),shortDecimals=Number(shortMeta.decimals);
  const longAmount=Number(formatUnits(longRaw,longDecimals)),shortAmount=Number(formatUnits(shortRaw,shortDecimals));
  const longReaderMin=x.oracleInputs?.long?.min,longReaderMax=x.oracleInputs?.long?.max;
  const shortReaderMin=x.oracleInputs?.short?.min,shortReaderMax=x.oracleInputs?.short?.max;
  const longPriceMin=priceUsdFromReader(longReaderMin,longDecimals),longPriceMax=priceUsdFromReader(longReaderMax,longDecimals);
  const shortPriceMin=priceUsdFromReader(shortReaderMin,shortDecimals),shortPriceMax=priceUsdFromReader(shortReaderMax,shortDecimals);
  const longPrice=longPriceMin!==null&&longPriceMax!==null?(longPriceMin+longPriceMax)/2:null;
  const shortPrice=shortPriceMin!==null&&shortPriceMax!==null?(shortPriceMin+shortPriceMax)/2:null;
  const longUsd=longPrice!==null?longAmount*longPrice:null,shortUsd=shortPrice!==null?shortAmount*shortPrice:null;
  const grossTokenUsd=longUsd!==null&&shortUsd!==null?longUsd+shortUsd:null;
  const longWeight=grossTokenUsd>0?longUsd/grossTokenUsd:null;
  const shortWeight=grossTokenUsd>0?shortUsd/grossTokenUsd:null;
  const stateRow=(state.capital.positions||[]).find(r=>lower(r.marketToken)===lower(market)||lower(r.assetId)===lower(x.label.includes('ETH')?'gmx-gm-eth-usdc':'gmx-gm-btc-usdc'));
  if(!stateRow||!(n(stateRow.valueUsd)>0))throw new Error(`${x.label}: canonical GMX capital row missing`);
  const prod=(state.productivity.positions||[]).find(r=>lower(r.id)===lower(stateRow.assetId));
  if(!prod||prod.status!=='measured'||n(prod.referenceAprPct)===null)throw new Error(`${x.label}: measured GMX Fee APY missing`);
  strategies.push({
    id:stateRow.assetId,
    protocol:'GMX',chain:'Arbitrum',market:x.label,marketToken:market,
    companyPosition:{gmBalance:n(x.balance),gmTokenPriceUsd:n(x.gmTokenPrice?.midUsd),strategyNavUsd:n(stateRow.valueUsd),capitalAccounting:'Count GM token strategy NAV once; do not add underlying pool tokens to Company BTC/ETH/stable balances.'},
    poolExposureDiagnostic:{
      source:'GMX DataStore POOL_AMOUNT exact market + long/short token keys; token prices are the same official Oracle inputs used for Reader valuation',
      long:{symbol:longMeta.symbol,address:long,amount:round(longAmount,8),usd:round(longUsd,2),grossTokenWeight:round(longWeight,6)},
      short:{symbol:shortMeta.symbol,address:short,amount:round(shortAmount,8),usd:round(shortUsd,2),grossTokenWeight:round(shortWeight,6)},
      grossPoolTokenValueUsd:round(grossTokenUsd,2),
      interpretation:'Diagnostic gross pool-token composition only. It is not additive Company capital and is not an exact withdrawal quote because GM token NAV also reflects trader PnL, borrowing fees and impact-pool mechanics.'
    },
    yield:{
      referenceMetric:'GMX 30D Fee APY',referenceAprPct:n(prod.referenceAprPct),source:'GMX official Oracle API /apy?period=30d exact market-token address',
      incomeMode:'embedded-in-gm-nav',claimableApplicable:false,separateClaimStep:false,
      economics:'Trading, swap, borrowing and liquidation fees allocated to LPs accrue to the market pool and increase GM token value; no separate LP fee claim/distribution step.',
      protocolFeeShareNote:'On Arbitrum/Avalanche, GMX documentation states 63% of collected fees go to the pool and 37% to the protocol.',
      annualizedPerformanceRole:'diagnostic-only-not-reference-yield',
      annualizedPerformanceMeaning:'GM pool annualized performance also captures market-token NAV effects from underlying prices and trader PnL; it must not replace Fee APY as Reference Productivity.'
    }
  });
}

state.strategies=state.strategies||{};
state.strategies.gmx={
  version:'0.1-company-010-gmx-strategy-intelligence',generatedAt:new Date().toISOString(),status:'measured',
  strategyCount:strategies.length,totalStrategyNavUsd:round(strategies.reduce((s,x)=>s+(n(x.companyPosition.strategyNavUsd)||0),0),2),
  strategies,
  accountingBoundary:{underlyingPoolTokensAreExposureOnly:true,underlyingPoolTokensAddedToReserveBalances:false,gmTokenNavCountedOnce:true,noDoubleCount:true},
  rewardsBoundary:{lpFeeIncome:'embedded-in-gm-nav',separateClaimableLpFees:false,claimableAmount:null,claimableStatus:'not-applicable-by-mechanism'},
  authority:{readOnly:true,noTransactions:true,executionAuthority:'none'}
};

for(const row of state.capital.positions||[]){
  const s=strategies.find(x=>x.id===row.assetId);if(!s)continue;
  row.protocol='GMX';row.chain='Arbitrum';row.strategyClass='GMX V2 market liquidity';row.capitalRule=s.companyPosition.capitalAccounting;row.underlyingExposureDiagnostic=s.poolExposureDiagnostic;
}
for(const row of state.productivity.positions||[]){
  const s=strategies.find(x=>x.id===row.id);if(!s)continue;
  row.referenceMetric='GMX 30D Fee APY';row.incomeMode='embedded-in-gm-nav';row.claimableApplicable=false;row.methodology='Use exact-market GMX Fee APY as Reference Productivity. Do not substitute total GM performance or underlying token price performance.';
}
state.rewards=state.rewards||{};
state.rewards.unboundMechanisms=(state.rewards.unboundMechanisms||[]).filter(x=>x!=='GMX GM markets');
state.rewards.embeddedIncomeMechanisms=(state.rewards.embeddedIncomeMechanisms||[]).filter(x=>x.id!=='gmx-v2-market-liquidity');
state.rewards.embeddedIncomeMechanisms.push({id:'gmx-v2-market-liquidity',protocol:'GMX',chain:'Arbitrum',positionIds:strategies.map(x=>x.id),incomeMode:'embedded-in-gm-nav',claimableApplicable:false,claimableAmount:null,status:'measured-mechanism',source:'GMX official Providing liquidity documentation + exact-market Fee APY',note:'LP fee income increases GM NAV. There is no separate claim step, so this mechanism must not be represented as a zero claimable reward.'});
state.provenance=state.provenance||{};state.provenance.gmxStrategy={version:state.strategies.gmx.version,generatedAt:state.strategies.gmx.generatedAt,sourceReaderVersion:gmx.version,dataStore:DATASTORE};
state.epistemicBoundary=state.epistemicBoundary||{};state.epistemicBoundary.gmxUnderlyingExposureIsNotAdditiveCapital=true;state.epistemicBoundary.gmxEmbeddedIncomeIsNotClaimableReward=true;

fs.writeFileSync(STATE,JSON.stringify(state,null,2)+'\n');
console.log(JSON.stringify({status:'PASS',version:state.strategies.gmx.version,totalStrategyNavUsd:state.strategies.gmx.totalStrategyNavUsd,strategies:strategies.map(x=>({id:x.id,navUsd:x.companyPosition.strategyNavUsd,feeApyPct:x.yield.referenceAprPct,long:x.poolExposureDiagnostic.long,short:x.poolExposureDiagnostic.short,incomeMode:x.yield.incomeMode,claimableApplicable:false})),btcEthDoubleCount:false,executionAuthority:'none'},null,2));