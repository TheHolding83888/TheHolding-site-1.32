#!/usr/bin/env node
import fs from 'node:fs';
import { completePerformanceEvidence, extractCompanyBookBlock, renderCompanyBookBlock, replaceCompanyBookBlock, validateCompleteBasis } from './company-capital-state-contract.mjs';

const STATE='companies/yieldring-canonical-state.json';
const INDEX='companies/index.html';
const PAGE='yieldring/index.html';
const state=JSON.parse(fs.readFileSync(STATE,'utf8'));
const fail=m=>{throw new Error(m);};

if(state.version!=='0.2-yieldring-canonical-state'||state.company!=='YieldRing.eth'||state.registry!=='002')fail('unexpected YieldRing canonical state');
if(state.authority?.executionAuthority!=='none')fail('YieldRing authority drift');
if(state.wallet?.address!=='0x90815314fB9e7F015AB5845572FE5BcC0Ba14669')fail('YieldRing wallet identity drift');
if(state.wallet?.onchainReconciliationStatus!=='pending-independent-reproduction')fail('YieldRing onchain evidence must not be silently promoted');

const positions=Object.values(state.capital||{});
validateCompleteBasis(positions,{company:'YieldRing.eth',expectedCount:4,expectedTotalUsd:state.portfolioCostBasis?.totalUsd});
if(state.portfolioCostBasis?.status!=='complete'||Number(state.portfolioCostBasis?.coveredPositionCount)!==4||Number(state.portfolioCostBasis?.totalPositionCount)!==4)fail('YieldRing portfolio cost basis is not complete');
const snapshot=completePerformanceEvidence(state.evidenceSnapshot,state.portfolioCostBasis.totalUsd,{label:'YieldRing screenshot evidence'});
const frax=state.capital?.frax;
if(Number(frax?.quantity)!==1032||Number(frax?.costBasisUsd)!==279.57||frax?.costBasisStatus!=='complete')fail('YieldRing complete FRAX acquisition basis drift');

const rows=positions.map(position=>({
  assetId:position.assetId,
  quantity:Number(position.quantity),
  entryPriceUsd:null,
  costBasisUsd:Number(position.costBasisUsd),
  evidenceStatus:position.evidenceStatus,
  ...(position.assetId==='aerodrome-finance'?{relay:{
    mode:state.aerodromeRelay.mode,
    managerId:state.aerodromeRelay.managerId,
    managerAddress:state.aerodromeRelay.managerAddress,
    expectedUnderlyingLockCount:state.aerodromeRelay.expectedUnderlyingLockCount,
    evidenceStatus:state.aerodromeRelay.evidenceStatus
  }}:{})
}));

let html=fs.readFileSync(INDEX,'utf8');
const rendered=renderCompanyBookBlock('YieldRing.eth',rows);
html=replaceCompanyBookBlock(html,'YieldRing.eth',rendered);
fs.writeFileSync(INDEX,html);

const page=fs.readFileSync(PAGE,'utf8');
if(!page.includes("{ id: 'frax-share', name: 'veFRAX', sub: 'Frax · locked', qty: 1032 }"))fail('YieldRing dedicated page current FRAX quantity missing');
if(page.includes('api.coingecko.com'))fail('YieldRing dedicated page still performs direct browser CoinGecko requests');
if(!page.includes('/intelligence/market-data/public-capital-state.json'))fail('YieldRing dedicated page canonical market runtime missing');
if(!page.includes('2 locks · Maxi relay'))fail('YieldRing dedicated veAERO relay label missing');

const activeBlock=extractCompanyBookBlock(html,'YieldRing.eth');
if(activeBlock!==rendered)fail('YieldRing canonical Company Book block did not materialize exactly inside COMPANY_BOOK');
for(const row of rows){
  const basisToken=`costBasisUsd: ${row.costBasisUsd}`;
  if(!activeBlock.includes(basisToken))fail(`YieldRing active Company Book basis missing for ${row.assetId}`);
}
if(activeBlock.includes('knownCostBasisUsd')||activeBlock.includes("costBasisStatus: 'partial'"))fail('YieldRing active Company Book remained partial after canonical projection');

console.log('YieldRing public/capital projection PASS',{
  positions:rows.length,
  totalCostBasisUsd:state.portfolioCostBasis.totalUsd,
  fraxQuantity:frax.quantity,
  fraxCostBasisUsd:frax.costBasisUsd,
  evidenceSnapshotMarketValueUsd:snapshot.market,
  evidenceSnapshotPerformancePct:snapshot.pct,
  onchainReconciliationStatus:state.wallet.onchainReconciliationStatus,
  livePerformance:'dynamic-current-canonical-market-value-vs-complete-historical-cost-basis',
  activeCompanyBookScoped:true,
  relayMode:state.aerodromeRelay.mode,
  executionAuthority:'none'
});
