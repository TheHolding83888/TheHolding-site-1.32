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

async function provider(){let last;for(const url of RPCS){try{const p=new JsonRpcProvider(url,1,{staticNetwork:true});await p.getBlockNumber();return p}catch(e){last=e}}throw last||new Error('Ethereum RPC unavailable')}
const round=(n,d=12)=>Number(Number(n).toFixed(d));

async function tokenMeta(p,address){
  const token=getAddress(address),c=new Contract(token,ERC20_ABI,p);
  const [symbol,decimals]=await Promise.all([c.symbol().catch(()=>token),c.decimals().catch(()=>18)]);
  return{token,symbol:String(symbol),decimals:Number(decimals)};
}

export async function buildVlCvxLockerPlatformProof({audit,provider:p}){
  if(audit?.version!=='0.2-vlcvx-full-registry-route-audit')throw new Error('vlCVX route audit version drift');
  const code=await p.getCode(LOCKER);if(!code||code==='0x')throw new Error('current CvxLockerV2 has no bytecode');
  if(String(audit?.contracts?.vlCVX||'').toLowerCase()!==LOCKER.toLowerCase())throw new Error('route audit locker != platform proof locker');
  const locker=new Contract(LOCKER,LOCKER_ABI,p),companies=[];
  for(const company of (audit.companies||[]).filter(x=>x.hasVlCvx)){
    const wallet=company.wallets?.find(x=>x.hasVlCvx);if(!wallet?.address)throw new Error(`positive vlCVX wallet missing ${company.registry}`);
    const [claimables,locked]=await Promise.all([locker.claimableRewards(wallet.address),locker.lockedBalances(wallet.address)]);
    const rewards=[];
    for(const row of claimables){
      const meta=await tokenMeta(p,row.token),raw=BigInt(row.amount),amount=Number(formatUnits(raw,meta.decimals));
      rewards.push({...meta,amountRaw:raw.toString(),amount:round(amount),observedZero:raw===0n});
    }
    companies.push({
      registry:company.registry,name:company.name,wallet:getAddress(wallet.address),currentRoute:wallet.route?.routeId||null,
      lockerBalanceVlCvx:Number(wallet.vlCvx?.balance||0),lockerTotalRaw:BigInt(locked.total).toString(),
      claimableRewardCount:rewards.length,positiveClaimableRewardCount:rewards.filter(x=>BigInt(x.amountRaw)>0n).length,rewards,
      evidenceClass:'observed-current-state',component:'locked-cvx-platform-rewards',
      periodIncomeAuthority:false,delegateIncentiveSettlementAuthority:false,zeroIsObservedZero:true,unknownIsNotZero:true
    });
  }
  if(companies.length!==4)throw new Error(`expected 4 live vlCVX companies, found ${companies.length}`);
  return{
    version:VERSION,generatedAt:new Date().toISOString(),executionAuthority:'none',claimTransactionAuthority:'none',
    contract:{name:'CvxLockerV2',address:LOCKER,method:'claimableRewards(address)'},
    semantics:{component:'locked-cvx-platform-rewards',currentRewardStateIsNotPeriodIncome:true,delegateIncentiveSettlementIsSeparate:true,doesNotResolveVotiumStakeDaoOrConvexTeamSettlement:true,referenceAprIsNotIncomeAuthority:true,unknownIsNotZero:true},
    summary:{companyCount:companies.length,positiveRewardCompanyCount:companies.filter(x=>x.positiveClaimableRewardCount>0).length},companies
  };
}

async function main(){const audit=JSON.parse(fs.readFileSync(AUDIT,'utf8')),p=await provider(),out=await buildVlCvxLockerPlatformProof({audit,provider:p});fs.writeFileSync(path.resolve(OUTPUT),JSON.stringify(out,null,2)+'\n');console.log('vlCVX locker platform proof PASS',JSON.stringify({summary:out.summary,companies:out.companies.map(x=>({registry:x.registry,name:x.name,route:x.currentRoute,positiveRewards:x.positiveClaimableRewardCount,rewards:x.rewards.map(r=>({symbol:r.symbol,amount:r.amount}))}))},null,2));}

if(import.meta.url===`file://${process.argv[1]}`)main().catch(e=>{console.error(e);process.exitCode=1});
