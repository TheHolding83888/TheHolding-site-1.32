#!/usr/bin/env node
import fs from 'node:fs';
import { Contract, JsonRpcProvider, concat, getAddress, id, keccak256, solidityPackedKeccak256 } from 'ethers';

const VERSION='0.1-votium-union-accounting-evidence';
const REWARDS=process.env.REWARDS_OUTPUT||'companies/rewards-data.json';
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

const pairHash=(a,b)=>keccak256(String(a).toLowerCase()<String(b).toLowerCase()?concat([a,b]):concat([b,a]));
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
async function findRootEvent(root,week){
  const signature=id('MerkleRootUpdated(bytes32,uint32)').toLowerCase();
  const expectedRoot=String(root).toLowerCase();
  const expectedWeek=weekTopic(week).toLowerCase();
  let next=null;
  for(let page=0;page<12;page++){
    const url=new URL(`${BLOCKSCOUT}/addresses/${DISTRIBUTOR}/logs`);
    for(const [k,v] of Object.entries(next||{}))url.searchParams.set(k,String(v));
    const payload=await fetchJson(url,'Blockscout Union logs');
    for(const log of payload.items||[]){
      const topics=(log.topics||[]).map(x=>String(x).toLowerCase());
      if(topics[0]!==signature||topics[1]!==expectedRoot||topics[2]!==expectedWeek)continue;
      const transactionHash=String(log.transaction_hash||'');
      if(!/^0x[0-9a-f]{64}$/i.test(transactionHash))throw new Error('Union root event transaction hash missing');
      const tx=await fetchJson(`${BLOCKSCOUT}/transactions/${transactionHash}`,'Blockscout Union root transaction');
      if(!Number.isFinite(Date.parse(tx.timestamp)))throw new Error('Union root event timestamp missing');
      return{blockNumber:Number(log.block_number),blockHash:log.block_hash,transactionHash,logIndex:Number(log.index??0),publishedAt:new Date(tx.timestamp).toISOString(),proofClass:'blockscout-indexed-onchain-MerkleRootUpdated-root-week-exact-match'};
    }
    next=payload.next_page_params;
    if(!next)break;
  }
  throw new Error(`Current Union root event not found for week ${week}`);
}
function routeWallet(rewards,company){
  const c=rewards.companies?.[company];
  if(!c)throw new Error(`Rewards company missing: ${company}`);
  const route=c.vlCvxRoute;
  if(route?.currentRoute?.routeId!=='votium-union')throw new Error(`Current vlCVX route is not votium-union for ${company}`);
  if(!route.wallet)throw new Error(`Current vlCVX wallet missing for ${company}`);
  return{companyState:c,route,wallet:getAddress(route.wallet)};
}

async function main(){
  const rewards=JSON.parse(fs.readFileSync(REWARDS,'utf8'));
  const {provider,endpointClass}=await providerWithFallback();
  try{
    const head=await provider.getBlockNumber();
    const distributor=new Contract(DISTRIBUTOR,ABI,provider);
    const [root,weekRaw]=await Promise.all([distributor.merkleRoot({blockTag:head}),distributor.week({blockTag:head})]);
    const week=Number(weekRaw);
    if(!/^0x[0-9a-f]{64}$/i.test(root)||!Number.isSafeInteger(week)||week<1)throw new Error('Union current root/week unavailable');
    const rootEvent=await findRootEvent(root,week);
    const members=[];
    for(const identity of MEMBERS){
      const {route,wallet}=routeWallet(rewards,identity.company);
      const api=await fetchClaim(wallet);
      if(api.status==='not-published'){
        members.push({...identity,wallet,currentRoute:route.currentRoute,settlementAsset:'scrvUSD',entitlementStatus:'unknown-not-published',leaf:null,unknownIsNotZero:true,periodIncomeAuthority:false});
        continue;
      }
      const claim=api.claim;
      const proofValid=verifyClaim(wallet,claim,root);
      if(!proofValid)throw new Error(`Union scrvUSD proof invalid for ${identity.company}`);
      const claimed=Boolean(await distributor.isClaimed(BigInt(claim.index),{blockTag:head}));
      members.push({...identity,wallet,currentRoute:route.currentRoute,settlementAsset:'scrvUSD',entitlementStatus:claimed?'published-claimed-state':'published-unclaimed-state',leaf:{index:String(claim.index),amountRaw:String(claim.amount),proofValid,claimed,merkleRoot:root,week},unknownIsNotZero:true,periodIncomeAuthority:false});
    }
    const out={
      version:VERSION,
      generatedAt:new Date().toISOString(),
      status:'factual-current-state-baseline-not-period-income',
      purpose:'Establish a reusable factual Votium -> The Union scrvUSD accounting evidence boundary for every company on the same settlement route. Current rollover entitlement state is preserved without pretending it is period income.',
      authority:{readOnly:true,executionAuthority:'none',walletAuthority:false,capitalExecution:false,claimTransactionAuthority:'none',periodIncomeAuthority:false,monthClosingAuthority:false,methodologyMutationAuthority:false},
      protocol:{chain:'Ethereum',delegationProtocol:'Votium',settlementProtocol:'The Union',distributor:DISTRIBUTOR,observationBlock:head,rpcEndpointClass:endpointClass,rootEventIndex:'Blockscout Ethereum v2 address logs + transaction timestamp'},
      distribution:{week,merkleRoot:root,rootEvent},
      members,
      accountingBoundary:{
        family:'accrued-entitlement',
        mechanism:'votium-union-scrvusd',
        currentLeafSemantic:'rollover-capable-current-entitlement-state',
        currentLeafIsPeriodIncome:false,
        claimStateRewritesEarnedIncome:false,
        referenceAprAllowedAsIncome:false,
        recognitionRule:'No income event is admitted from one current Merkle leaf. A period increment requires a prior comparable factual leaf or independently identified round allocation, plus continuity/reconciliation across claims and root changes.',
        positiveDeltaRule:'A positive share delta may become an accrued-entitlement candidate only after prior/current leaves are bound to distinct proven distribution weeks and no lifecycle discontinuity can explain the delta.',
        decreaseRule:'A lower current leaf is reconciliation-required, never negative income by default.',
        historicalRecoveryHint:'Use retained canonical Rewards/Git history and onchain MerkleRootUpdated/Claimed events; never substitute Reference APR.',
        unknownIsNotZero:true
      },
      diagnostics:{memberCount:members.length,publishedLeafCount:members.filter(x=>x.leaf).length,unclaimedLeafCount:members.filter(x=>x.leaf&&!x.leaf.claimed).length,admissionCandidateCount:0,referenceAprUsed:false}
    };
    fs.writeFileSync(OUTPUT,JSON.stringify(out,null,2)+'\n');
    console.log('VOTIUM UNION ACCOUNTING EVIDENCE PASS',{week,root,publishedAt:rootEvent.publishedAt,members:out.diagnostics.memberCount,publishedLeaves:out.diagnostics.publishedLeafCount,admissionCandidates:out.diagnostics.admissionCandidateCount,periodIncomeAuthority:out.authority.periodIncomeAuthority,executionAuthority:out.authority.executionAuthority});
  }finally{try{provider.destroy()}catch{}}
}
main().catch(error=>{console.error(error);process.exit(1)});
