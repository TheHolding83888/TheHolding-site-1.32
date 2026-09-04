import fs from 'node:fs';
import path from 'node:path';
import { Contract, JsonRpcProvider, getAddress } from 'ethers';

const VERSION='0.1-vlcvx-convex-team-gauge-eligibility-proof';
const OUTPUT=process.env.VLCVX_CONVEX_TEAM_OUTPUT||'/tmp/vlcvx-convex-team-eligibility-proof.json';
const AUDIT=process.env.VLCVX_AUDIT_OUTPUT||'/tmp/vlcvx-route-audit.json';
const RPCS=[...new Set([
  process.env.ETH_RPC_URL,
  'https://ethereum-rpc.publicnode.com',
  'https://eth.llamarpc.com',
  'https://eth.drpc.org',
  'https://rpc.flashbots.net'
].filter(Boolean))];

const ROOK=getAddress('0x7eC6331188468269DC7C1Cf6a84C972632178B1E');
const CONVEX_TEAM=getAddress('0x947B7742C403f20e5FaCcDAc5E092C943E7D0277');
const GAUGE_DELEGATION=getAddress('0xb8270eef1319173dE9f5033FED442F638ff1607d');
const CURVE_GAUGE_VOTING=getAddress('0x64D9B5AC386B70af9EDCD20A58cE9262D2EAC278');
const FX_GAUGE_VOTING=getAddress('0xDcEa673B021f1f431E7D0Ec70a63bF8DcB6d44E6');

const VOTING_ABI=[
  'function proposalCount() view returns (uint256)',
  'function proposals(uint256) view returns (uint48 startTime,uint48 endTime,uint48 epoch)',
  'function getVote(uint256,address) view returns (address[] gauges,uint256[] weights,bool voted,uint256 baseWeight,int256 adjustedWeight)'
];
const DELEGATION_ABI=[
  'function getDelegateAtEpoch(address user,uint256 epoch) view returns (address)',
  'function userWeightAtEpochOf(uint256 epoch,address user) view returns (uint256)'
];

async function provider(){
  let last;
  for(const url of RPCS){
    try{
      const p=new JsonRpcProvider(url,1,{staticNetwork:true});
      await p.getBlockNumber();
      return p;
    }catch(e){last=e;}
  }
  throw last||new Error('Ethereum RPC unavailable');
}

function same(a,b){try{return getAddress(a)===getAddress(b)}catch{return false}}
function iso(sec){return Number(sec)>0?new Date(Number(sec)*1000).toISOString():null}

async function inspectPlatform(p,{id,label,address}){
  const vote=new Contract(address,VOTING_ABI,p);
  const delegation=new Contract(GAUGE_DELEGATION,DELEGATION_ABI,p);
  const count=Number(await vote.proposalCount());
  if(!Number.isSafeInteger(count)||count<0)throw new Error(`${label} proposal count invalid`);
  const proposals=[];
  for(let proposalId=0;proposalId<count;proposalId++){
    const [prop,userVote]=await Promise.all([
      vote.proposals(proposalId),
      vote.getVote(proposalId,ROOK)
    ]);
    const epoch=Number(prop.epoch);
    if(!Number.isSafeInteger(epoch)||epoch<=0)throw new Error(`${label} proposal ${proposalId} epoch invalid`);
    const [delegate,delegatedWeightRaw]=await Promise.all([
      delegation.getDelegateAtEpoch(ROOK,epoch),
      delegation.userWeightAtEpochOf(epoch,ROOK)
    ]);
    const gauges=[...userVote[0]].map(getAddress),weights=[...userVote[1]].map(Number),voted=Boolean(userVote[2]);
    if(gauges.length!==weights.length)throw new Error(`${label} proposal ${proposalId} vote shape drift`);
    proposals.push({
      platformId:id,platform:label,contract:address,proposalId,
      startTime:Number(prop.startTime),startAt:iso(prop.startTime),endTime:Number(prop.endTime),endAt:iso(prop.endTime),epoch,
      delegate:getAddress(delegate),delegateIsConvexTeam:same(delegate,CONVEX_TEAM),
      delegatedWeightRaw:BigInt(delegatedWeightRaw).toString(),
      rookVoteObserved:voted,rookVoteGaugeCount:gauges.length,
      rookVote:{gauges,weights,voted,baseWeightRaw:BigInt(userVote[3]).toString(),adjustedWeightRaw:BigInt(userVote[4]).toString()},
      manualOrSurrogateOverrideObserved:voted
    });
  }
  return{platformId:id,platform:label,address,proposalCount:count,proposals};
}

export async function collectVlCvxConvexTeamEligibilityProof({auditFile=AUDIT}={}){
  const audit=JSON.parse(fs.readFileSync(auditFile,'utf8'));
  if(audit?.version!=='0.2-vlcvx-full-registry-route-audit')throw new Error('vlCVX route audit version drift');
  const rookCompany=(audit.companies||[]).find(x=>x.registry==='007');
  const rookWallet=rookCompany?.wallets?.find(x=>x.hasVlCvx&&same(x.address,ROOK));
  if(!rookWallet)throw new Error('Rook live vlCVX wallet missing');
  if(rookWallet.route?.routeId!=='convex-finance-vlcvx'||rookWallet.delegate?.identity!=='convex-finance'||!same(rookWallet.delegate?.address,CONVEX_TEAM))throw new Error('Rook current Convex-Team route drift');

  const p=await provider();
  const [observedBlock,curve,fx]=await Promise.all([
    p.getBlockNumber(),
    inspectPlatform(p,{id:'curve',label:'Curve Gauge Voting',address:CURVE_GAUGE_VOTING}),
    inspectPlatform(p,{id:'fx',label:'f(x) Gauge Voting',address:FX_GAUGE_VOTING})
  ]);
  const proposals=[...curve.proposals,...fx.proposals].sort((a,b)=>a.startTime-b.startTime||a.platformId.localeCompare(b.platformId)||a.proposalId-b.proposalId);
  const weighted=proposals.filter(x=>BigInt(x.delegatedWeightRaw)>0n);
  const manual=weighted.filter(x=>x.manualOrSurrogateOverrideObserved);
  const team=weighted.filter(x=>x.delegateIsConvexTeam);
  const nonTeam=weighted.filter(x=>!x.delegateIsConvexTeam);

  return{
    version:VERSION,generatedAt:new Date().toISOString(),executionAuthority:'none',claimTransactionAuthority:'none',
    observedBlock:Number(observedBlock),
    subject:{registry:'007',company:"Rook's portfolio",wallet:ROOK,currentRoute:'convex-finance-vlcvx',currentGaugeDelegate:CONVEX_TEAM},
    contracts:{gaugeDelegation:GAUGE_DELEGATION,curveGaugeVoting:CURVE_GAUGE_VOTING,fxGaugeVoting:FX_GAUGE_VOTING},
    sourceModel:{
      votingCode:'convex-eth/voting GaugeVotePlatform + Delegation',
      officialConvexLockPage:'https://www.convexfinance.com/lock-cvx',
      votiumEligibilityDocs:'https://docs.votium.app/faq/vlcvx-faq',
      note:'This proof establishes onchain delegation and direct/surrogate vote participation only. It does not by itself assert that an unenumerated external incentive route cannot exist.'
    },
    semantics:{
      gaugeDelegationIsVotingAuthorityNotIncomeEvent:true,
      userVoteOverrideIsSeparatelyObservable:true,
      noManualVoteDoesNotByItselfProveUniversalZeroIncome:true,
      currentPlatformRewardsTrackedSeparately:true,
      legacyResidualsTrackedSeparately:true,
      unknownIsNotZero:true
    },
    summary:{
      platformCount:2,proposalCount:proposals.length,weightedProposalCount:weighted.length,
      convexTeamWeightedProposalCount:team.length,nonConvexTeamWeightedProposalCount:nonTeam.length,
      manualOrSurrogateOverrideCount:manual.length,
      allWeightedProposalsConvexTeam:weighted.length>0&&nonTeam.length===0,
      noManualOrSurrogateOverrideOnWeightedProposals:weighted.length>0&&manual.length===0
    },
    platforms:[curve,fx],proposals
  };
}

async function main(){
  const out=await collectVlCvxConvexTeamEligibilityProof();
  fs.writeFileSync(path.resolve(OUTPUT),JSON.stringify(out,null,2)+'\n');
  console.log('vlCVX CONVEX TEAM ELIGIBILITY PROOF PASS',JSON.stringify({subject:out.subject,observedBlock:out.observedBlock,summary:out.summary,weightedProposals:out.proposals.filter(x=>BigInt(x.delegatedWeightRaw)>0n).map(x=>({platform:x.platform,proposalId:x.proposalId,epoch:x.epoch,startAt:x.startAt,endAt:x.endAt,delegate:x.delegate,delegatedWeightRaw:x.delegatedWeightRaw,manualOrSurrogateOverrideObserved:x.manualOrSurrogateOverrideObserved,rookVoteGaugeCount:x.rookVoteGaugeCount}))},null,2));
}

if(import.meta.url===`file://${process.argv[1]}`)main().catch(e=>{console.error(e);process.exitCode=1});
