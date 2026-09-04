import fs from 'node:fs';
import path from 'node:path';
import { Contract, JsonRpcProvider, formatUnits, getAddress } from 'ethers';

const VERSION='0.1-vlcvx-locker-platform-proof';
const AUDIT=process.env.VLCVX_AUDIT_OUTPUT||'/tmp/vlcvx-route-audit.json';
const OUTPUT=process.env.VLCVX_LOCKER_PLATFORM_OUTPUT||'/tmp/vlcvx-locker-platform-proof.json';
const RPCS=[...new Set([process.env.ETH_RPC_URL,'https://ethereum-rpc.publicnode.com','https://eth.llamarpc.com'].filter(Boolean))];
const LOCKER=getAddress('0x72a19342e8F1838460eBFCCEf09F6585e32db86E');
const LOCKER_ABI=[
  'function claimableRewards(address _account) view returns (tuple(address token,uint256 amount)[] userRewards)',
  'function lockedBalances(address _user) view returns (uint256 total,uint256 unlockable,uint256 locked,tuple(uint112 amount,uint32 unlockTime)[] lockData)'
];
const ERC20_ABI=['function symbol() view returns (string)','function decimals() view returns (uint8)'];

export async function vlCvxEthereumProvider(){let last;for(const url of RPCS){try{const p=new JsonRpcProvider(url,1,{staticNetwork:true});await p.getBlockNumber();return p}catch(e){last=e}}throw last||new Error('Ethereum RPC unavailable')}
const round=(n,d=12)=>Number(Number(n).toFixed(d));

async function tokenMeta(p,address){
  const token=getAddress(address),c=new Contract(token,ERC20_ABI,p);
  const [symbol,decimals]=await Promise.all([c.symbol().catch(()=>token),c.decimals().catch(()=>18)]);
  return{token,symbol:String(symbol),decimals:Number(decimals)};
}

export async function buildVlCvxLockerPlatformProof({audit,provider:p}){
  if(audit?.version!=='0.2-vlcvx-full-registry-route-audit')throw new Error('vlCVX route audit version drift');
  const [code,observedBlock]=await Promise.all([p.getCode(LOCKER),p.getBlockNumber()]);
  if(!code||code==='0x')throw new Error('current CvxLockerV2 has no bytecode');
  if(!Number.isSafeInteger(Number(observedBlock))||Number(observedBlock)<=0)throw new Error('current CvxLockerV2 observed block invalid');
  if(String(audit?.contracts?.vlCVX||'').toLowerCase()!==LOCKER.toLowerCase())throw new Error('route audit locker != platform proof locker');
  const locker=new Contract(LOCKER,LOCKER_ABI,p),companies=[];
  for(const company of (audit.companies||[]).filter(x=>x.hasVlCvx)){
    const wallet=company.wallets?.find(x=>x.hasVlCvx);if(!wallet?.address)throw new Error(`positive vlCVX wallet missing ${company.registry}`);
    const [claimables,locked]=await Promise.all([locker.claimableRewards(wallet.address,{blockTag:observedBlock}),locker.lockedBalances(wallet.address,{blockTag:observedBlock})]);
    const rewards=[];
    for(const row of claimables){
      const meta=await tokenMeta(p,row.token),raw=BigInt(row.amount),amount=Number(formatUnits(raw,meta.decimals));
      rewards.push({...meta,amountRaw:raw.toString(),amount:round(amount),observedZero:raw===0n});
    }
    companies.push({registry:company.registry,name:company.name,wallet:getAddress(wallet.address),currentRoute:wallet.route?.routeId||null,lockerBalanceVlCvx:Number(wallet.vlCvx?.balance||0),lockerTotalRaw:BigInt(locked.total).toString(),claimableRewardCount:rewards.length,positiveClaimableRewardCount:rewards.filter(x=>BigInt(x.amountRaw)>0n).length,rewards,evidenceClass:'observed-current-state',component:'locked-cvx-platform-rewards',observedBlock:Number(observedBlock),periodIncomeAuthority:false,delegateIncentiveSettlementAuthority:false,zeroIsObservedZero:true,unknownIsNotZero:true});
  }
  if(companies.length!==4)throw new Error(`expected 4 live vlCVX companies, found ${companies.length}`);
  return{version:VERSION,generatedAt:new Date().toISOString(),executionAuthority:'none',claimTransactionAuthority:'none',contract:{name:'CvxLockerV2',address:LOCKER,method:'claimableRewards(address)',observedBlock:Number(observedBlock)},semantics:{component:'locked-cvx-platform-rewards',currentRewardStateIsNotPeriodIncome:true,delegateIncentiveSettlementIsSeparate:true,doesNotResolveVotiumStakeDaoOrConvexTeamSettlement:true,referenceAprIsNotIncomeAuthority:true,unknownIsNotZero:true},summary:{companyCount:companies.length,positiveRewardCompanyCount:companies.filter(x=>x.positiveClaimableRewardCount>0).length},companies};
}

export function applyVlCvxLockerPlatformProof(data,proof){
  if(proof?.version!==VERSION||proof?.executionAuthority!=='none')throw new Error('invalid vlCVX locker platform proof');
  if(!Number.isSafeInteger(Number(proof?.contract?.observedBlock))||Number(proof.contract.observedBlock)<=0)throw new Error('vlCVX locker platform observed block missing');
  for(const row of proof.companies||[]){
    const c=data.companies?.[row.name];if(!c)throw new Error(`canonical Rewards company missing ${row.name}`);
    if(Number(row.observedBlock)!==Number(proof.contract.observedBlock))throw new Error(`vlCVX locker platform block parity drift ${row.registry}`);
    c.sources=c.sources||[];
    const source={protocol:'Convex · vlCVX platform rewards',route:'vlcvx-locker-platform-rewards',status:'ok',chain:'Ethereum',metric:'CvxLockerV2 claimableRewards(address) current state',note:'Direct CvxLockerV2 platform-reward state is reproducibly observed. This is component tracking only: current reward state is not period income and it does not resolve the separate delegate-incentive settlement lane.',details:{principalAsset:'vlCVX',component:'locked-cvx-platform-rewards',wallet:row.wallet,locker:proof.contract.address,claimableRewardsMethod:proof.contract.method,observedBlock:Number(row.observedBlock),rewards:row.rewards,positiveClaimableRewardCount:row.positiveClaimableRewardCount,currentRoute:row.currentRoute,periodIncomeAuthority:false,delegateIncentiveSettlementAuthority:false,currentRewardStateIsNotPeriodIncome:true,unknownIsNotZero:true}};
    const i=c.sources.findIndex(x=>x.route===source.route);if(i>=0)c.sources[i]=source;else c.sources.push(source);
  }
  data.diagnostics=data.diagnostics||{};data.diagnostics.vlCvxLockerPlatformProof={version:proof.version,generatedAt:proof.generatedAt,observedBlock:Number(proof.contract.observedBlock),executionAuthority:'none',component:'locked-cvx-platform-rewards',companyCount:proof.summary.companyCount,semanticBoundary:'component factual state only; does not close unresolved delegate-incentive settlement or create period income'};
  return data;
}

export async function collectVlCvxLockerPlatformProof({auditFile=AUDIT}={}){const audit=JSON.parse(fs.readFileSync(auditFile,'utf8')),p=await vlCvxEthereumProvider();return buildVlCvxLockerPlatformProof({audit,provider:p});}

async function main(){const out=await collectVlCvxLockerPlatformProof();fs.writeFileSync(path.resolve(OUTPUT),JSON.stringify(out,null,2)+'\n');console.log('vlCVX locker platform proof PASS',JSON.stringify({observedBlock:out.contract.observedBlock,summary:out.summary,companies:out.companies.map(x=>({registry:x.registry,name:x.name,route:x.currentRoute,positiveRewards:x.positiveClaimableRewardCount,rewards:x.rewards.map(r=>({symbol:r.symbol,amount:r.amount}))}))},null,2));}

if(import.meta.url===`file://${process.argv[1]}`)main().catch(e=>{console.error(e);process.exitCode=1});
