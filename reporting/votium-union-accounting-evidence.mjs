#!/usr/bin/env node
import fs from 'node:fs';
import { AbiCoder, Contract, JsonRpcProvider, concat, getAddress, keccak256 } from 'ethers';

const VERSION='0.1-votium-union-accounting-evidence';
const REWARDS=process.env.REWARDS_OUTPUT||'companies/rewards-data.json';
const OUTPUT=process.env.VOTIUM_UNION_ACCOUNTING_EVIDENCE_OUTPUT||'/tmp/votium-union-accounting-evidence.json';
const UNION_API='https://api.llama.airforce';
const DISTRIBUTOR=getAddress('0x17ac69dd3fb8f22b4f52dbdb8a3a0eb059367efc');
const MEMBERS=[
  {registry:'002',company:'YieldRing.eth'},
  {registry:'004',company:'defitea.eth'}
];
const ABI=[
  'function merkleRoot() view returns (bytes32)',
  'function week() view returns (uint32)',
  'function isClaimed(uint256 index) view returns (bool)',
  'event MerkleRootUpdated(bytes32 indexed merkleRoot,uint32 indexed week)',
  'event Claimed(uint256 index,uint256 indexed amount,address indexed account,uint256 week)'
];
const coder=AbiCoder.defaultAbiCoder();

const same=(a,b)=>{try{return getAddress(a)===getAddress(b)}catch{return false}};
const pairHash=(a,b)=>keccak256(String(a).toLowerCase()<String(b).toLowerCase()?concat([a,b]):concat([b,a]));
function verifyClaim(wallet,claim,root){
  let h=keccak256(coder.encode(['uint256','address','uint256'],[BigInt(claim.index),getAddress(wallet),BigInt(claim.amount)]));
  for(const p of claim.proof||[])h=pairHash(h,p);
  return h.toLowerCase()===String(root).toLowerCase();
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
async function findRootEvent(distributor,root,week,head){
  const filter=distributor.filters.MerkleRootUpdated(root,week);
  let to=head;
  for(let i=0;i<24&&to>=0;i++){
    const from=Math.max(0,to-99_999);
    const logs=await distributor.queryFilter(filter,from,to);
    if(logs.length){
      const log=logs.at(-1),block=await log.getBlock();
      return{blockNumber:Number(log.blockNumber),blockHash:log.blockHash,transactionHash:log.transactionHash,logIndex:Number(log.index??0),publishedAt:new Date(Number(block.timestamp)*1000).toISOString(),proofClass:'onchain-MerkleRootUpdated-root-week-exact-match'};
    }
    to=from-1;
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
    const rootEvent=await findRootEvent(distributor,root,week,head);
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
      protocol:{chain:'Ethereum',delegationProtocol:'Votium',settlementProtocol:'The Union',distributor:DISTRIBUTOR,observationBlock:head,rpcEndpointClass:endpointClass},
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
