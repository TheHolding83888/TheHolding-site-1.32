#!/usr/bin/env node
import fs from 'node:fs';
import { AbiCoder, Contract, JsonRpcProvider, concat, getAddress, id, keccak256, solidityPackedKeccak256 } from 'ethers';

const VERSION='0.2-votium-union-accounting-evidence';
const REWARDS=process.env.REWARDS_OUTPUT||'companies/rewards-data.json';
const BASELINE=process.env.VOTIUM_UNION_ACCOUNTING_BASELINE||'reporting/votium-union-accounting-baseline.json';
const OUTPUT=process.env.VOTIUM_UNION_ACCOUNTING_EVIDENCE_OUTPUT||'/tmp/votium-union-accounting-evidence.json';
const UNION_API='https://api.llama.airforce';
const BLOCKSCOUT='https://eth.blockscout.com/api/v2';
const DISTRIBUTOR=getAddress('0x17ac69dd3fb8f22b4f52dbdb8a3a0eb059367efc');
const MEMBERS=[
  {registry:'002',company:'YieldRing.eth'},
  {registry:'004',company:'defitea.eth'}
];
const ABI=[
  'function merkleRoot() view returns (bytes32)',
  'function week() view returns (uint32)',
  'function isClaimed(uint256 index) view returns (bool)'
];
const coder=AbiCoder.defaultAbiCoder();

const pairHash=(a,b)=>keccak256(String(a).toLowerCase()<String(b).toLowerCase()?concat([a,b]):concat([b,a]));
const round=(v,d=12)=>{const n=Number(v);if(!Number.isFinite(n))return null;const f=10**d;return Math.round(n*f)/f;};
function verifyClaim(wallet,claim,root){
  let h=solidityPackedKeccak256(['uint256','address','uint256'],[BigInt(claim.index),getAddress(wallet),BigInt(claim.amount)]);
  for(const p of claim.proof||[])h=pairHash(h,p);
  return h.toLowerCase()===String(root).toLowerCase();
}
async function fetchJson(url,label){
  const response=await fetch(url,{headers:{accept:'application/json'}});
  if(!response.ok)throw new Error(`${label} HTTP ${response.status}`);
  return response.json();
}
async function fetchClaim(wallet){
  const response=await fetch(`${UNION_API}/airdrop/scrvusd/${wallet}`,{headers:{accept:'application/json'}});
  if(response.status===404)return{status:'not-published',claim:null,httpStatus:404};
  if(!response.ok)throw new Error(`Union scrvUSD API HTTP ${response.status} for ${wallet}`);
  const claim=await response.json();
  if(claim?.index===undefined||claim?.amount===undefined||!Array.isArray(claim?.proof))throw new Error(`Union scrvUSD claim schema invalid for ${wallet}`);
  return{status:'published',claim,httpStatus:response.status};
}
function rpcCandidates(){return [...new Set([process.env.ETH_RPC_URL,'https://ethereum-rpc.publicnode.com','https://eth.llamarpc.com'].filter(Boolean))];}
function rpcLabel(url){if(url===process.env.ETH_RPC_URL)return'configured-secret';try{return new URL(url).hostname}catch{return'configured'}}
async function providerWithFallback(){let last=null;for(const url of rpcCandidates()){const p=new JsonRpcProvider(url,1,{staticNetwork:true});try{await p.getBlockNumber();return{provider:p,endpointClass:rpcLabel(url)}}catch(e){last=e;try{p.destroy()}catch{}}}throw last||new Error('Ethereum RPC unavailable')}
function weekTopic(week){return `0x${BigInt(week).toString(16).padStart(64,'0')}`;}
function addressTopic(address){return `0x${getAddress(address).slice(2).toLowerCase().padStart(64,'0')}`;}
async function distributorLogs(){
  const pages=[];let next=null;
  for(let page=0;page<24;page++){
    const url=new URL(`${BLOCKSCOUT}/addresses/${DISTRIBUTOR}/logs`);
    for(const [k,v] of Object.entries(next||{}))url.searchParams.set(k,String(v));
    const payload=await fetchJson(url,'Blockscout Union logs');
    pages.push(...(payload.items||[]));
    next=payload.next_page_params;
    if(!next)break;
  }
  return pages;
}
function rootEventFromLogs(logs,root,week){
  const signature=id('MerkleRootUpdated(bytes32,uint32)').toLowerCase();
  const expectedRoot=String(root).toLowerCase();
  const expectedWeek=weekTopic(week).toLowerCase();
  const log=logs.find(item=>{
    const topics=(item.topics||[]).map(x=>String(x).toLowerCase());
    return topics[0]===signature&&topics[1]===expectedRoot&&topics[2]===expectedWeek;
  });
  if(!log)throw new Error(`Union root event not found for week ${week}`);
  return log;
}
async function enrichRootEvent(log){
  const transactionHash=String(log.transaction_hash||'');
  if(!/^0x[0-9a-f]{64}$/i.test(transactionHash))throw new Error('Union root event transaction hash missing');
  const tx=await fetchJson(`${BLOCKSCOUT}/transactions/${transactionHash}`,'Blockscout Union root transaction');
  if(!Number.isFinite(Date.parse(tx.timestamp)))throw new Error('Union root event timestamp missing');
  return{blockNumber:Number(log.block_number),blockHash:log.block_hash,transactionHash,logIndex:Number(log.index??0),publishedAt:new Date(tx.timestamp).toISOString(),proofClass:'blockscout-indexed-onchain-MerkleRootUpdated-root-week-exact-match'};
}
function claimsBetween(logs,account,fromBlock,toBlock){
  const signature=id('Claimed(uint256,uint256,address,uint256)').toLowerCase();
  const accountTopic=addressTopic(account);
  const out=[];
  for(const log of logs){
    const blockNumber=Number(log.block_number);
    if(!(blockNumber>fromBlock&&blockNumber<=toBlock))continue;
    const topics=(log.topics||[]).map(x=>String(x).toLowerCase());
    if(topics[0]!==signature||topics[2]!==accountTopic)continue;
    if(!/^0x[0-9a-f]{64}$/i.test(topics[1]||''))throw new Error('Union Claimed amount topic invalid');
    const decoded=coder.decode(['uint256','uint256'],log.data||'0x');
    out.push({
      blockNumber,
      transactionHash:String(log.transaction_hash||''),
      logIndex:Number(log.index??0),
      index:BigInt(decoded[0]).toString(),
      amountRaw:BigInt(topics[1]).toString(),
      week:BigInt(decoded[1]).toString()
    });
  }
  return out.sort((a,b)=>a.blockNumber-b.blockNumber||a.logIndex-b.logIndex);
}
function routeWallet(rewards,company){
  const c=rewards.companies?.[company];
  if(!c)throw new Error(`Rewards company missing: ${company}`);
  const route=c.vlCvxRoute;
  if(route?.currentRoute?.routeId!=='votium-union')throw new Error(`Current vlCVX route is not votium-union for ${company}`);
  if(!route.wallet)throw new Error(`Current vlCVX wallet missing for ${company}`);
  return{companyState:c,route,wallet:getAddress(route.wallet)};
}
function valuationFromRewards(companyState,leaf){
  const rows=(companyState?.rewards||[]).filter(x=>x?.route==='votium-union-scrvusd');
  if(rows.length!==1)return{status:'unavailable',reason:`expected one current Union reward row, got ${rows.length}`};
  const row=rows[0];
  if(row.amountRaw!==undefined&&BigInt(row.amountRaw)!==BigInt(leaf.amountRaw))return{status:'unavailable',reason:'current Rewards amountRaw does not match proven Union leaf'};
  const amount=Number(row.amount),usd=Number(row.usdValue);
  if(!(amount>0)||!(usd>=0))return{status:'unavailable',reason:'current Union reward row lacks complete amount/USD valuation'};
  const unitUsd=usd/amount;
  if(!(unitUsd>0))return{status:'unavailable',reason:'current Union reward unit valuation invalid'};
  return{status:'canonical-current-rewards-valuation',amount,usdValue:usd,unitUsd,source:'companies/rewards-data.json current Votium + Union scrvUSD row'};
}

async function main(){
  const rewards=JSON.parse(fs.readFileSync(REWARDS,'utf8'));
  const baseline=JSON.parse(fs.readFileSync(BASELINE,'utf8'));
  if(baseline?.version!=='0.1-votium-union-accounting-baseline')throw new Error('Union accounting baseline version drift');
  if(String(baseline?.protocol?.distributor||'').toLowerCase()!==DISTRIBUTOR.toLowerCase())throw new Error('Union accounting baseline distributor drift');
  const baselineWeek=Number(baseline?.distribution?.week),baselineRoot=String(baseline?.distribution?.merkleRoot||'');
  if(!Number.isSafeInteger(baselineWeek)||baselineWeek<1||!/^0x[0-9a-f]{64}$/i.test(baselineRoot))throw new Error('Union accounting baseline boundary invalid');
  const {provider,endpointClass}=await providerWithFallback();
  try{
    const head=await provider.getBlockNumber();
    const distributor=new Contract(DISTRIBUTOR,ABI,provider);
    const [root,weekRaw,logs]=await Promise.all([distributor.merkleRoot({blockTag:head}),distributor.week({blockTag:head}),distributorLogs()]);
    const week=Number(weekRaw);
    if(!/^0x[0-9a-f]{64}$/i.test(root)||!Number.isSafeInteger(week)||week<1)throw new Error('Union current root/week unavailable');
    const [baselineRootEvent,rootEvent]=await Promise.all([
      enrichRootEvent(rootEventFromLogs(logs,baselineRoot,baselineWeek)),
      enrichRootEvent(rootEventFromLogs(logs,root,week))
    ]);
    if(rootEvent.blockNumber<=baselineRootEvent.blockNumber||week<=baselineWeek)throw new Error('Union current boundary is not newer than factual baseline');

    const members=[];const intervals=[];
    for(const identity of MEMBERS){
      const {companyState,route,wallet}=routeWallet(rewards,identity.company);
      const baselineMember=(baseline.members||[]).find(x=>x.registry===identity.registry&&x.company===identity.company);
      if(!baselineMember||getAddress(baselineMember.wallet)!==wallet||baselineMember?.leaf?.proofValid!==true||baselineMember?.leaf?.claimed!==false)throw new Error(`Union factual baseline member invalid for ${identity.company}`);
      const api=await fetchClaim(wallet);
      if(api.status==='not-published'){
        members.push({...identity,wallet,currentRoute:route.currentRoute,settlementAsset:'scrvUSD',entitlementStatus:'unknown-not-published',leaf:null,unknownIsNotZero:true,periodIncomeAuthority:false});
        intervals.push({...identity,status:'reconciliation-required-current-leaf-not-published',canonicalAdmissionEligible:false,unknownIsNotZero:true});
        continue;
      }
      const claim=api.claim,index=BigInt(claim.index),amountRaw=BigInt(claim.amount);
      const proofValid=verifyClaim(wallet,{...claim,index,amount:amountRaw},root);
      if(!proofValid)throw new Error(`Union scrvUSD proof invalid for ${identity.company}`);
      const claimed=Boolean(await distributor.isClaimed(index,{blockTag:head}));
      const leaf={index:index.toString(),amountRaw:amountRaw.toString(),proofValid,claimed,merkleRoot:root,week};
      members.push({...identity,wallet,currentRoute:route.currentRoute,settlementAsset:'scrvUSD',entitlementStatus:claimed?'published-claimed-state':'published-unclaimed-state',leaf,unknownIsNotZero:true,periodIncomeAuthority:false});

      const claimEvents=claimsBetween(logs,wallet,baselineRootEvent.blockNumber,rootEvent.blockNumber);
      const previousRaw=BigInt(baselineMember.leaf.amountRaw),deltaRaw=amountRaw-previousRaw;
      const valuation=valuationFromRewards(companyState,leaf);
      const common={...identity,wallet,mechanism:'votium-union-scrvusd',family:'accrued-entitlement',asset:'scrvUSD',previousBoundary:{week:baselineWeek,merkleRoot:baselineRoot,rootEvent:baselineRootEvent,index:String(baselineMember.leaf.index),amountRaw:previousRaw.toString(),claimedAtBaseline:false},currentBoundary:{week,merkleRoot:root,rootEvent,index:index.toString(),amountRaw:amountRaw.toString(),claimedAtObservation:claimed},claimEventsBetweenBoundaries:claimEvents,noClaimBetweenBoundaries:claimEvents.length===0,referenceAprUsed:false,unknownIsNotZero:true,executionAuthority:'none'};
      if(claimEvents.length){
        intervals.push({...common,status:'reconciliation-required-claim-between-boundaries',canonicalAdmissionEligible:false,deltaRaw:null,amount:null,usdValue:null,valuationStatus:'not-admitted'});
        continue;
      }
      if(deltaRaw<0n){
        intervals.push({...common,status:'reconciliation-required-entitlement-decrease',canonicalAdmissionEligible:false,deltaRaw:deltaRaw.toString(),amount:null,usdValue:null,valuationStatus:'not-admitted'});
        continue;
      }
      if(deltaRaw===0n){
        intervals.push({...common,status:'factual-no-new-accrual',canonicalAdmissionEligible:false,deltaRaw:'0',amount:0,usdValue:0,valuationStatus:'no-income-event'});
        continue;
      }
      if(valuation.status!=='canonical-current-rewards-valuation'){
        intervals.push({...common,status:'reconciliation-required-valuation-unavailable',canonicalAdmissionEligible:false,deltaRaw:deltaRaw.toString(),amount:round(Number(deltaRaw)/1e18,12),usdValue:null,valuationStatus:valuation.status,valuationReason:valuation.reason});
        continue;
      }
      const amount=Number(deltaRaw)/1e18,usdValue=amount*valuation.unitUsd;
      intervals.push({...common,status:'factual-positive-accrual-candidate',canonicalAdmissionEligible:true,periodIncomeAuthorityCandidate:true,deltaRaw:deltaRaw.toString(),amount:round(amount,12),usdValue:round(usdValue,8),valuationUnitUsd:round(valuation.unitUsd,12),valuationAt:rootEvent.publishedAt,valuationStatus:'frozen-at-current-proven-distribution-boundary',valuationSource:valuation.source,evidenceStatus:'prior-and-current-merkle-leaves-plus-no-claim-continuity'});
    }

    const candidates=intervals.filter(x=>x.canonicalAdmissionEligible===true);
    const out={
      version:VERSION,
      generatedAt:new Date().toISOString(),
      status:'factual-current-state-with-bounded-accrual-candidates',
      purpose:'Prove reusable Votium -> The Union -> scrvUSD factual entitlement boundaries and admit only positive no-claim deltas as candidates for the canonical income ledger.',
      authority:{readOnly:true,executionAuthority:'none',walletAuthority:false,capitalExecution:false,claimTransactionAuthority:'none',periodIncomeAuthority:false,canonicalLedgerAdmissionAuthority:false,monthClosingAuthority:false,methodologyMutationAuthority:false},
      protocol:{chain:'Ethereum',delegationProtocol:'Votium',settlementProtocol:'The Union',distributor:DISTRIBUTOR,observationBlock:head,rpcEndpointClass:endpointClass,rootEventIndex:'Blockscout Ethereum v2 address logs + transaction timestamp',claimEventIndex:'Blockscout Ethereum v2 Claimed(index,amount,account,week) logs'},
      baseline:{sourceFile:BASELINE,version:baseline.version,capturedAt:baseline.capturedAt,distribution:{week:baselineWeek,merkleRoot:baselineRoot,rootEvent:baselineRootEvent}},
      distribution:{week,merkleRoot:root,rootEvent},
      members,
      intervals,
      accountingBoundary:{
        family:'accrued-entitlement',mechanism:'votium-union-scrvusd',currentLeafSemantic:'rollover-capable-current-entitlement-state',currentLeafIsPeriodIncome:false,claimStateRewritesEarnedIncome:false,referenceAprAllowedAsIncome:false,
        recognitionRule:'A positive delta is eligible only when prior and current leaves are factual, roots/weeks are independently proven onchain, no member Claimed event occurred between those distribution boundaries, and the current reward row supplies complete token/USD valuation.',
        claimContinuityRule:'Any Claimed event between distribution boundaries invalidates simple leaf subtraction and requires reconciliation. A later claim after the recognized boundary does not erase already recognized income.',
        decreaseRule:'A lower current leaf is reconciliation-required, never negative income by default.',unknownIsNotZero:true
      },
      diagnostics:{memberCount:members.length,publishedLeafCount:members.filter(x=>x.leaf).length,unclaimedLeafCount:members.filter(x=>x.leaf&&!x.leaf.claimed).length,intervalCount:intervals.length,admissionCandidateCount:candidates.length,admissionCandidateUsd:round(candidates.reduce((s,x)=>s+Number(x.usdValue||0),0),8),referenceAprUsed:false}
    };
    fs.writeFileSync(OUTPUT,JSON.stringify(out,null,2)+'\n');
    console.log('VOTIUM UNION ACCOUNTING EVIDENCE PASS',{baselineWeek,currentWeek:week,root,publishedAt:rootEvent.publishedAt,members:out.diagnostics.memberCount,candidates:out.diagnostics.admissionCandidateCount,candidateUsd:out.diagnostics.admissionCandidateUsd,periodIncomeAuthority:out.authority.periodIncomeAuthority,executionAuthority:out.authority.executionAuthority});
  }finally{try{provider.destroy()}catch{}}
}
main().catch(error=>{console.error(error);process.exit(1)});
