import fs from 'node:fs';
import path from 'node:path';
import { Contract, JsonRpcProvider, ZeroAddress, concat, formatUnits, getAddress, keccak256, solidityPackedKeccak256 } from 'ethers';

const VERSION = '0.3-defitea-vlcvx-route-graph-scrvusd-proof';
const OUTPUT = process.env.REWARDS_OUTPUT || path.resolve('companies/rewards-data.json');
const DEFITEA = getAddress('0x78bf5AF472d5f6014b641eD70DE01862C05dA8c3');
const VOTIUM_REGISTRY = getAddress('0x92e6e43f99809df84ed2d533e1fd8017eb966ee2');
const UNION_FORWARD = getAddress('0xcc2a0f5e95c88aabd7b8e0db5c5252820cd47f91');
const UNION_ZAP_V9 = getAddress('0xd52ca71aafa4d2590aac1e35e3005242dd31e5ed');
const ASSET_REGISTRY = getAddress('0xcfa23b8f9062369b21049b9f4a4ce79d640d1873');
const SCRVUSD_DISTRIBUTOR = getAddress('0x17ac69dd3fb8f22b4f52dbdb8a3a0eb059367efc');
const SCRVUSD = getAddress('0x0655977FEb2f289A4aB78af67BAB0d17aAb84367');
const CRVUSD = getAddress('0xf939E0A03FB07F59A73314E73794Be0E57ac1b4E');
const API_BASE = 'https://api.llama.airforce';
const DIRECT_LABEL = 'Votium · vlCVX';
const UNION_LABEL = 'Votium + Union · vlCVX';
const RPCS = [...new Set([process.env.ETH_RPC_URL,'https://ethereum-rpc.publicnode.com','https://eth.llamarpc.com'].filter(Boolean))];

const REGISTRY_ABI = ['function registry(address) view returns (tuple(uint256 start,address to,uint256 expiration))'];
const ZAP_ABI = ['function outputTokens(uint256) view returns (address)'];
const ALLOC_ABI = ['function getAllocations(address[] members) view returns (uint16[16][] allocations)'];
const DIST_ABI = [
  'function token() view returns (address)',
  'function vault() view returns (address)',
  'function merkleRoot() view returns (bytes32)',
  'function week() view returns (uint32)',
  'function frozen() view returns (bool)',
  'function isClaimed(uint256 index) view returns (bool)'
];
const VAULT_ABI = [
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function convertToAssets(uint256 shares) view returns (uint256)'
];

const round=(v,d=10)=>Number.isFinite(Number(v))?Number(Number(v).toFixed(d)):null;
const finite=v=>v!==null&&v!==undefined&&Number.isFinite(Number(v));
const same=(a,b)=>{try{return getAddress(a)===getAddress(b)}catch{return false}};
const hashPair=(a,b)=>keccak256(String(a).toLowerCase()<String(b).toLowerCase()?concat([a,b]):concat([b,a]));
function verifyClaim(c,root){let h=solidityPackedKeccak256(['uint256','address','uint256'],[BigInt(c.index),DEFITEA,BigInt(c.amount)]);for(const p of c.proof||[])h=hashPair(h,p);return String(h).toLowerCase()===String(root).toLowerCase();}
async function fetchJson(url,{allow404=false,timeout=15000}={}){const ctl=new AbortController();const t=setTimeout(()=>ctl.abort(),timeout);try{const r=await fetch(url,{signal:ctl.signal,headers:{accept:'application/json'}});if(r.status===404&&allow404)return{found:false,status:404,data:null};if(!r.ok)throw new Error(`HTTP ${r.status}`);return{found:true,status:r.status,data:await r.json()};}finally{clearTimeout(t)}}
async function getProvider(){let last;for(const u of RPCS){try{const p=new JsonRpcProvider(u,1,{staticNetwork:true});await p.getBlockNumber();return p}catch(e){last=e}}throw last||new Error('Ethereum RPC unavailable')}
async function getOutputs(zap){const a=[];for(let i=0;i<16;i++){try{const x=getAddress(await zap.outputTokens(i));if(x===ZeroAddress)break;a.push(x)}catch{break}}return a}
async function getCrvUsdPrice(){const k=`ethereum:${CRVUSD.toLowerCase()}`;const {data}=await fetchJson(`https://coins.llama.fi/prices/current/${k}`);const p=Number(data?.coins?.[k]?.price);if(!(p>0))throw new Error('crvUSD price unavailable');return p}
function tokenSummary(rewards){const m=new Map();for(const r of rewards||[]){const k=`${r.symbol}|${r.token}`;if(!m.has(k))m.set(k,{symbol:r.symbol,token:r.token,amount:0,usd:0,complete:true});const x=m.get(k);x.amount+=Number(r.amount||0);if(finite(r.usdValue))x.usd+=Number(r.usdValue);else x.complete=false;}return[...m.values()].map(x=>({symbol:x.symbol,token:x.token,amount:round(x.amount,10),usdValue:x.complete?round(x.usd,6):null}))}
function recompute(c){const r=c.rewards||[],s=c.sources||[],n=Number(c.routeCount||0),ok=s.filter(x=>x.status==='ok').length,measured=s.filter(x=>['ok','partial'].includes(x.status)).length,unpriced=r.filter(x=>!finite(x.usdValue)).length;c.totalUsd=round(r.reduce((a,x)=>a+(finite(x.usdValue)?Number(x.usdValue):0),0),6);c.totalUsdIsComplete=n>0&&ok===n&&unpriced===0;c.routeCoverage=n?round(measured/n,6):0;c.completeRouteCoverage=n?round(ok/n,6):0;c.measuredRoutes=measured;c.completeRoutes=ok;c.pendingRoutes=s.filter(x=>x.status!=='ok').length;c.unpricedRewards=unpriced;c.rewardTokens=tokenSummary(r);c.status=c.totalUsdIsComplete?'ok':measured?'partial':'warming';}
function tagDirectVotiumLegacy(rewards){
  for(const r of rewards||[]){
    if(r?.protocol===DIRECT_LABEL&&r?.route==='votium-union'){
      r.details=r.details||{};
      r.details.vlCvxRoute={principalAsset:'vlCVX',delegationProtocol:'Votium',settlementProtocol:'Votium direct Merkle',payoutAsset:r.symbol||null,routeRole:'legacy-residual',path:`vlCVX → Votium → ${r.symbol||'direct reward'}`};
    }
  }
}
function insertUnionAdjacent(rewards,row){
  let lastDirect=-1;
  for(let i=0;i<rewards.length;i++)if(rewards[i]?.protocol===DIRECT_LABEL&&rewards[i]?.route==='votium-union')lastDirect=i;
  if(lastDirect>=0)rewards.splice(lastDirect+1,0,row);else rewards.push(row);
}

async function main(){
  const data=JSON.parse(fs.readFileSync(OUTPUT,'utf8'));
  const c=data.companies?.['defitea.eth']; if(!c)throw new Error('Defitea rewards state missing');
  const p=await getProvider(), now=new Date().toISOString();
  c.rewards=(c.rewards||[]).filter(x=>x.route!=='votium-union-scrvusd');
  tagDirectVotiumLegacy(c.rewards);

  const registry=new Contract(VOTIUM_REGISTRY,REGISTRY_ABI,p),zap=new Contract(UNION_ZAP_V9,ZAP_ABI,p),alloc=new Contract(ASSET_REGISTRY,ALLOC_ABI,p),dist=new Contract(SCRVUSD_DISTRIBUTOR,DIST_ABI,p),vault=new Contract(SCRVUSD,VAULT_ABI,p);
  const [forward,outputs,allocationResult,inputToken,distVault,root,week,frozen,symbol,decimals]=await Promise.all([
    registry.registry(DEFITEA),getOutputs(zap),alloc.getAllocations([DEFITEA]),dist.token(),dist.vault(),dist.merkleRoot(),dist.week(),dist.frozen(),vault.symbol(),vault.decimals()
  ]);
  if(!same(inputToken,CRVUSD))throw new Error(`scrvUSD distributor input token mismatch: ${inputToken}`);
  if(!same(distVault,SCRVUSD))throw new Error(`scrvUSD distributor vault mismatch: ${distVault}`);

  const weights=Array.from(allocationResult?.[0]||[]).map(Number);if(weights.length!==16)throw new Error(`allocation vector length ${weights.length}`);
  const outputIndex=outputs.findIndex(x=>same(x,CRVUSD));
  const weight=outputIndex>=0?Number(weights[outputIndex]||0):null,totalWeight=weights.reduce((a,x)=>a+x,0),sharePct=weight!==null&&totalWeight>0?round(weight/totalWeight*100,6):null;

  const forwardTo=getAddress(forward.to),start=Number(forward.start||0),expiration=Number(forward.expiration||0),nowSec=Math.floor(Date.now()/1000);
  const configured=same(forwardTo,UNION_FORWARD),effective=configured&&start<=nowSec&&(expiration===0||expiration>nowSec);

  let api;try{api=await fetchJson(`${API_BASE}/airdrop/scrvusd/${DEFITEA}`,{allow404:true})}catch(e){api={found:null,status:null,data:null,error:e.message}}
  let entitlement=null,row=null,state='warming',reason=null;
  if(api.found===true){
    const claim=api.data||{};if(claim.index===undefined||claim.amount===undefined||!Array.isArray(claim.proof))throw new Error('Union claim schema invalid');
    if(!verifyClaim(claim,root))throw new Error('Union claim proof/root mismatch');
    const claimed=Boolean(await dist.isClaimed(BigInt(claim.index))),sharesRaw=BigInt(claim.amount),shares=Number(formatUnits(sharesRaw,Number(decimals))),assetsRaw=sharesRaw>0n?await vault.convertToAssets(sharesRaw):0n,assets=Number(formatUnits(assetsRaw,18));
    let crvUsdPrice=null,usdValue=null,priceError=null;try{crvUsdPrice=await getCrvUsdPrice();usdValue=round(assets*crvUsdPrice,6)}catch(e){priceError=e.message}
    entitlement={status:claimed?'claimed':'unclaimed',index:String(claim.index),amountRaw:sharesRaw.toString(),shares:round(shares,12),proofValid:true,claimed,merkleRoot:root,distributorWeek:Number(week),distributorFrozen:Boolean(frozen),crvUsdAssetsRaw:assetsRaw.toString(),crvUsdAssets:round(assets,12),crvUsdPrice,usdValue,priceError};
    if(!claimed&&sharesRaw>0n){
      row={protocol:UNION_LABEL,route:'votium-union-scrvusd',chain:'Ethereum',token:SCRVUSD,symbol:String(symbol||'scrvUSD'),amountRaw:sharesRaw.toString(),decimals:Number(decimals),amount:round(shares,10),classification:'unclaimed',source:'Llama Airforce official member airdrop + live distributor Merkle proof/isClaimed',usdValue,priceUsd:crvUsdPrice,priceMethod:crvUsdPrice?'scrvUSD convertToAssets(crvUSD) × DefiLlama crvUSD contract price':null,details:{wallet:DEFITEA,walletAlias:'defitea.eth',delegationPath:'vlCVX → Votium → The Union → scrvUSD',vlCvxRoute:{principalAsset:'vlCVX',delegationProtocol:'Votium',settlementProtocol:'The Union',payoutAsset:String(symbol||'scrvUSD'),routeRole:'current',path:'vlCVX → Votium → The Union → scrvUSD'},forwardingTarget:forwardTo,forwardingEffective:effective,allocationRegistry:ASSET_REGISTRY,allocationOutputToken:CRVUSD,allocationOutputIndex:outputIndex,allocationWeight:weight,allocationTotalWeight:totalWeight,allocationSharePct:sharePct,distributor:SCRVUSD_DISTRIBUTOR,distributorInputToken:CRVUSD,distributorVault:SCRVUSD,distributorWeek:Number(week),merkleIndex:String(claim.index),merkleRoot:root,proofValid:true,claimed:false,airdropId:'scrvusd',redeemSymbol:'crvUSD',redeemAmount:round(assets,12),unknownIsNotZero:true}};
      insertUnionAdjacent(c.rewards,row);state='measured';
    }else state=claimed?'claimed':'measured-zero-entitlement';
  }else if(api.found===false){reason=effective?'Union forwarding/allocation are observable but no current scrvUSD member entitlement is published for this wallet yet. HTTP 404 is not zero.':'No current entitlement and forwarding is not proven effective.';state='warming';}
  else{reason=`Official Union member endpoint unavailable: ${api.error||'unknown'}`;state='partial'}

  const i=(c.sources||[]).findIndex(x=>x.route==='votium-union'),old=i>=0?c.sources[i]:null;
  const source={protocol:'Convex / Votium + Union',route:'votium-union',status:['measured','claimed','measured-zero-entitlement'].includes(state)?(old?.status==='ok'?'ok':'partial'):state==='partial'?'partial':'warming',chain:'Ethereum',metric:'direct Votium Merkle + Union forwarding/allocation + scrvUSD member Merkle',note:reason||(state==='measured'?'Union scrvUSD entitlement is Merkle-verified and onchain unclaimed.':state==='claimed'?'Current Union entitlement is proven already claimed and excluded from Unclaimed.':'Union member state measured without positive unclaimed entitlement.'),details:{directVotium:old?{status:old.status,metric:old.metric,note:old.note,details:old.details||null}:null,union:{capability:VERSION,wallet:DEFITEA,forwarding:{registry:VOTIUM_REGISTRY,to:forwardTo,expectedUnionForward:UNION_FORWARD,configured,effective,start,expiration},allocation:{registry:ASSET_REGISTRY,unionZap:UNION_ZAP_V9,outputTokens:outputs,weights,totalWeight,scrvUsdSourceToken:CRVUSD,scrvUsdOutputIndex:outputIndex,scrvUsdWeight:weight,scrvUsdSharePct:sharePct,scrvUsdSelected:weight!==null?weight>0:null},airdrop:{api:`${API_BASE}/airdrop/scrvusd/{address}`,apiStatus:api.status,entitlement,unknownIsNotZero:true,rolloverAware:true},contracts:{distributor:SCRVUSD_DISTRIBUTOR,inputToken:CRVUSD,vault:SCRVUSD,distributorWeek:Number(week),distributorFrozen:Boolean(frozen),merkleRoot:root},state},vlCvxRouteGraph:{principalAsset:'vlCVX',currentRoute:'Votium + Union',currentSettlementAsset:'scrvUSD',legacyResidualRoute:(c.rewards||[]).some(r=>r?.protocol===DIRECT_LABEL&&r?.route==='votium-union')?'Votium direct':null,preserveLegacyResidualUntilClaimed:true,publicLabels:{direct:DIRECT_LABEL,union:UNION_LABEL}},unknownIsNotZero:true}};
  if(i>=0)c.sources[i]=source;else c.sources.push(source);
  c.updatedAt=now;recompute(c);
  data.methodology=data.methodology||{};data.methodology.convex='vlCVX is treated as a route graph: principal → delegation/management → settlement → payout assets. Direct Votium wallet Merkle claims remain independently measured as legacy residual claimables when a newer route is active. The Union lane reads Votium registry forwarding and Union AssetRegistry allocation onchain. scrvUSD member entitlement is accepted only from the official Llama Airforce airdrop endpoint after local Merkle verification against the live specialized distributor and onchain isClaimed=false. The distributor receives crvUSD, deposits it into the official scrvUSD ERC-4626 vault, and distributes scrvUSD shares; share value is therefore measured through convertToAssets(crvUSD), not hardcoded at $1. API 404/absent entitlement remains warming (unknown != zero).';
  data.diagnostics=data.diagnostics||{};data.diagnostics.defiteaUnion={capability:VERSION,generatedAt:now,executionAuthority:'none',wallet:DEFITEA,state,forwardingEffective:effective,scrvUsdAllocationSharePct:sharePct,entitlementStatus:entitlement?.status||(api.found===false?'not-published':'unknown'),unclaimedScrvUsdAmount:row?.amount??null,unclaimedScrvUsdUsd:row?.usdValue??null,routeGraph:{principalAsset:'vlCVX',legacyResidual:'Votium direct',current:'Votium + Union',settlementAsset:'scrvUSD',publicOrder:[DIRECT_LABEL,UNION_LABEL]},unknownIsNotZero:true,claimTransactionAuthority:'none'};
  fs.writeFileSync(OUTPUT,JSON.stringify(data,null,2)+'\n');
  console.log('Defitea vlCVX route graph + Union scrvUSD overlay PASS',data.diagnostics.defiteaUnion);
}
main().catch(e=>{console.error(e);process.exitCode=1});
