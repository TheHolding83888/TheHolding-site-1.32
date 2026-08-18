import fs from 'node:fs';
import path from 'node:path';
import { Contract, JsonRpcProvider, ZeroAddress, formatUnits, getAddress } from 'ethers';

const VERSION = '0.1-vlcvx-full-registry-route-audit';
const OUTPUT = process.env.VLCVX_AUDIT_OUTPUT || path.resolve('companies/vlcvx-route-audit.json');
const RPCS = [...new Set([process.env.ETH_RPC_URL, 'https://ethereum-rpc.publicnode.com', 'https://eth.llamarpc.com'].filter(Boolean))];

const VLCVX = getAddress('0x72a19342e8F1838460eBFCCEf09F6585e32db86E');
const GAUGE_DELEGATION = getAddress('0xb8270eef1319173dE9f5033FED442F638ff1607d');
const CURVE_GAUGE_PLATFORM = getAddress('0x64D9B5AC386B70af9EDCD20A58cE9262D2EAC278');
const FORWARD_REGISTRY = getAddress('0x92e6E43f99809dF84ed2D533e1FD8017eb966ee2');
const UNION_FORWARD = getAddress('0xCC2a0F5e95C88AAbD7b8E0Db5C5252820Cd47f91');
const STAKEDAO_FORWARD = getAddress('0xAe86A3993D13C8D77Ab77dBB8ccdb9b7Bc18cd09');
const STAKEDAO_DELEGATE = getAddress('0xbB06fEFB8f23A7c60C93fe20464DB6687C51955f');
const VOTIUM_DOCS_DELEGATE = getAddress('0xde1E6A7ED0ad3F61D531a8a78E83CcDdbd6E0c49');

const COMPANIES = [
  { registry:'001', name:'05081966.eth', wallets:[{alias:'05081966.eth', address:'0x7CdF49f589038242e77847573604441E383f5429'}] },
  { registry:'002', name:'YieldRing.eth', wallets:[{alias:'YieldRing.eth', ens:'yieldring.eth'}] },
  { registry:'003', name:'dinaz.eth', wallets:[{alias:'dinaz.eth', address:'0xcA2Ea0ef8eF6937e01EB9c72AEcaC24Dd1Ea7cEc'}] },
  { registry:'004', name:'defitea.eth', wallets:[{alias:'defitea.eth', address:'0x78bf5AF472d5f6014b641eD70DE01862C05dA8c3'},{alias:'Defitea Operations',address:'0x6640C1AF0BF7e77fa223d4Af2F779e55dcFB8D2d'}] },
  { registry:'005', name:'0x5860...83CA8.eth', wallets:[{alias:'0x5860...83CA8.eth', address:'0x58603461149Fc2A800a56d421e77DcbBA2D83CA8'}] },
  { registry:'006', name:'aerocvxyb.eth', wallets:[{alias:'Aero / Velo wallet',address:'0xA641752824d512FA8683758c6b2D8A04ea46dcD0'},{alias:'Yield Basis wallet',address:'0x6c6543eBA07946706Fd10a1064FA773326B5f5a9'}] },
  { registry:'007', name:"Rook's portfolio", wallets:[{alias:'Wallet 1',address:'0x7eC6331188468269DC7C1Cf6a84C972632178B1E'},{alias:'Wallet 2',address:'0x9c548960bd053C8465F298a711b6343Ae0360309'}] },
  { registry:'008', name:'Monetra.eth', wallets:[{alias:'Monetra.eth',address:'0x888D39aeE2AEC979c81f125EA94BB3cEB60F6bBB'}] },
  { registry:'009', name:'1milliondollar.eth', wallets:[{alias:'1milliondollar.eth',address:'0xe4b9c9ced406baffe406e63f83d39daaef150596'}] },
  { registry:'010', name:'Cypher', wallets:[{alias:'Wallet 1',address:'0xd90d1e395DE36e1e59C42F5dF537801C26BbC03f'},{alias:'Wallet 2',address:'0x64688F4Adc3f72CdB44d07e4879C724CD7025696'}] }
];

const VLCVX_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function lockedBalances(address) view returns (uint256 total,uint256 unlockable,uint256 locked,tuple(uint112 amount,uint32 unlockTime)[] lockData)'
];
const DELEGATION_ABI = [
  'function getDelegateAtEpoch(address user,uint256 epoch) view returns (address)',
  'function userWeightAtEpochOf(uint256 epoch,address user) view returns (uint256)'
];
const PLATFORM_ABI = [
  'function proposalCount() view returns (uint256)',
  'function proposals(uint256) view returns (uint48 startTime,uint48 endTime,uint48 epoch)'
];
const FORWARD_ABI = [
  'function currentEpoch() view returns (uint256)',
  'function registry(address) view returns (uint256 start,address to,uint256 expiration)'
];

const same=(a,b)=>{try{return getAddress(a)===getAddress(b)}catch{return false}};
const fmt=x=>Number(formatUnits(x||0n,18));

async function provider(){let last;for(const url of RPCS){try{const p=new JsonRpcProvider(url,1,{staticNetwork:true});await p.getBlockNumber();return p}catch(e){last=e}}throw last||new Error('Ethereum RPC unavailable')}
async function newestVlCvxEpoch(platform){const n=Number(await platform.proposalCount());for(let id=n-1;id>=0;id--){const p=await platform.proposals(id);if(Number(p.epoch)>0&&Number(p.endTime)>0)return{proposalId:id,startTime:Number(p.startTime),endTime:Number(p.endTime),epoch:Number(p.epoch)};}throw new Error('No usable vlCVX GaugeVotePlatform proposal');}

function delegateIdentity(addr,votiumEns){
  if(!addr||same(addr,ZeroAddress))return{kind:'self-or-undelegated',label:'Self / undelegated'};
  if(same(addr,STAKEDAO_DELEGATE))return{kind:'stake-dao',label:'Stake DAO'};
  if(same(addr,VOTIUM_DOCS_DELEGATE)|| (votiumEns&&same(addr,votiumEns)))return{kind:'votium',label:'Votium'};
  return{kind:'custom-or-unknown',label:'Custom / unknown delegate'};
}
function forwardingIdentity(to){
  if(!to||same(to,ZeroAddress))return{kind:'none',label:'Direct / no forwarding'};
  if(same(to,UNION_FORWARD))return{kind:'union',label:'The Union'};
  if(same(to,STAKEDAO_FORWARD))return{kind:'stake-dao-forwarder',label:'Stake DAO Votium forwarder'};
  return{kind:'custom-or-unknown',label:'Custom / unknown forwarding'};
}
function classify(delegate,forward,effective){
  if(delegate.kind==='votium'&&effective&&forward.kind==='union')return{routeId:'votium-union',publicLabel:'Votium + Union · vlCVX',path:'vlCVX → Votium → The Union'};
  if(delegate.kind==='votium')return{routeId:'votium-direct',publicLabel:'Votium · vlCVX',path:'vlCVX → Votium → direct Votium settlement'};
  if(delegate.kind==='stake-dao')return{routeId:'stake-dao-vlcvx',publicLabel:'Stake DAO · vlCVX',path:effective&&forward.kind==='stake-dao-forwarder'?'vlCVX → Stake DAO → Stake DAO settlement':'vlCVX → Stake DAO'};
  if(delegate.kind==='self-or-undelegated')return{routeId:'self-or-manual',publicLabel:'Direct / manual · vlCVX',path:'vlCVX → self / manual voting'};
  return{routeId:'unknown-delegate',publicLabel:'vlCVX · Route Pending',path:`vlCVX → ${delegate.label}`};
}

async function main(){
  const p=await provider();
  const vl=new Contract(VLCVX,VLCVX_ABI,p), del=new Contract(GAUGE_DELEGATION,DELEGATION_ABI,p), platform=new Contract(CURVE_GAUGE_PLATFORM,PLATFORM_ABI,p), fw=new Contract(FORWARD_REGISTRY,FORWARD_ABI,p);
  const [voteEpoch,forwardEpoch,votiumEns]=await Promise.all([newestVlCvxEpoch(platform),fw.currentEpoch(),p.resolveName('votium.eth').catch(()=>null)]);
  if(votiumEns && !same(votiumEns,VOTIUM_DOCS_DELEGATE))throw new Error(`votium.eth resolution drift: ${votiumEns} vs docs ${VOTIUM_DOCS_DELEGATE}`);
  const generatedAt=new Date().toISOString(), companies=[];
  for(const company of COMPANIES){
    const walletRows=[];
    for(const w of company.wallets){
      const address=getAddress(w.address || await p.resolveName(w.ens));
      const [bal,locked,delegate,weight,fwd]=await Promise.all([vl.balanceOf(address),vl.lockedBalances(address),del.getDelegateAtEpoch(address,voteEpoch.epoch),del.userWeightAtEpochOf(voteEpoch.epoch,address),fw.registry(address)]);
      const balance=fmt(bal),lockedAmount=fmt(locked.locked),unlockable=fmt(locked.unlockable),total=fmt(locked.total),delegatedWeight=fmt(weight);
      const hasVlCvx=balance>1e-12||lockedAmount>1e-12||total>1e-12;
      const d=delegateIdentity(delegate,votiumEns), f=forwardingIdentity(fwd.to);
      const start=Number(fwd.start),expiration=Number(fwd.expiration),forwardEpochN=Number(forwardEpoch),forwardingEffective=start>0&&start<=forwardEpochN&&expiration>forwardEpochN;
      const route=hasVlCvx?classify(d,f,forwardingEffective):null;
      walletRows.push({alias:w.alias,address,hasVlCvx,vlCvx:{balance,lockerTotal:total,locked:lockedAmount,unlockable,delegatedWeight,epoch:voteEpoch.epoch},delegate:{address:getAddress(delegate),identity:d.kind,label:d.label},forwarding:{registry:FORWARD_REGISTRY,currentEpoch:forwardEpochN,start,to:getAddress(fwd.to),expiration,effective:forwardingEffective,identity:f.kind,label:f.label},route});
    }
    const positive=walletRows.filter(x=>x.hasVlCvx);
    companies.push({registry:company.registry,name:company.name,hasVlCvx:positive.length>0,totalVlCvx:positive.reduce((s,x)=>s+x.vlCvx.balance,0),routes:[...new Set(positive.map(x=>x.route?.publicLabel).filter(Boolean))],wallets:walletRows});
  }
  const positive=companies.filter(x=>x.hasVlCvx);
  const out={version:VERSION,generatedAt,executionAuthority:'none',methodology:{principal:'Convex vlCVX locker balanceOf + lockedBalances',delegation:'current Convex onchain GaugeDelegation.getDelegateAtEpoch at newest usable Curve GaugeVotePlatform vlCVX epoch',settlement:'Votium Forwarder Registry registry(wallet) at registry currentEpoch',unknownIsNotZero:true,claimAuthority:'none'},contracts:{vlCVX:VLCVX,gaugeDelegation:GAUGE_DELEGATION,curveGaugeVotePlatform:CURVE_GAUGE_PLATFORM,votiumForwarderRegistry:FORWARD_REGISTRY,votiumDelegate:VOTIUM_DOCS_DELEGATE,votiumEnsResolved:votiumEns,stakeDaoDelegate:STAKEDAO_DELEGATE,unionForward:UNION_FORWARD,stakeDaoForward:STAKEDAO_FORWARD},epochs:{vlCvxVote:voteEpoch,votiumForwarding:Number(forwardEpoch)},summary:{companyCount:companies.length,vlCvxCompanyCount:positive.length,vlCvxCompanies:positive.map(x=>({registry:x.registry,name:x.name,totalVlCvx:x.totalVlCvx,routes:x.routes}))},companies};
  fs.writeFileSync(OUTPUT,JSON.stringify(out,null,2)+'\n');
  console.log('vlCVX full-registry route audit PASS',JSON.stringify(out.summary,null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1});
