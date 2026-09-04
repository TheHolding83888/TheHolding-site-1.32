import { Interface, JsonRpcProvider, formatUnits, getAddress } from 'ethers';

export const VERSION='0.1-vlcvx-locker-platform-factual-accrual-adapter';
const LOCKER=getAddress('0x72a19342e8F1838460eBFCCEf09F6585e32db86E');
const RPCS=[...new Set([process.env.ETH_RPC_URL,'https://ethereum-rpc.publicnode.com','https://eth.llamarpc.com','https://eth.drpc.org'].filter(Boolean))];
const REWARD_PAID_IFACE=new Interface(['event RewardPaid(address indexed _user,address indexed _rewardsToken,uint256 _reward)']);
const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
const round=(v,d=12)=>Number(Number(v).toFixed(d));
const lower=v=>String(v||'').toLowerCase();

function priceFor(symbol,marketData={}){
  const rows=Object.values(marketData?.prices||{}).filter(x=>String(x?.symbol||'').toUpperCase()===String(symbol||'').toUpperCase()&&finite(x?.usd)&&Number(x.usd)>0);
  if(rows.length!==1)return null;
  const row=rows[0];
  return{usd:Number(row.usd),assetId:row.assetId||row.providerId||null,observedAt:row.observedAt||marketData?.observedAt||marketData?.generatedAt||null,source:row.source||null,status:row.status||null};
}

export function extractVlCvxPlatformStates(rewards={}){
  const observedAt=rewards?.diagnostics?.vlCvxLockerPlatformProof?.generatedAt||rewards?.generatedAt||null;
  const out=[];
  for(const [company,c] of Object.entries(rewards?.companies||{})){
    const source=(c?.sources||[]).find(x=>x?.route==='vlcvx-locker-platform-rewards');
    if(source?.status!=='ok')continue;
    const d=source.details||{};
    if(d.component!=='locked-cvx-platform-rewards'||d.currentRewardStateIsNotPeriodIncome!==true||d.periodIncomeAuthority!==false||d.unknownIsNotZero!==true)continue;
    const blockNumber=Number(d.observedBlock);
    if(!Number.isSafeInteger(blockNumber)||blockNumber<=0)continue;
    const wallet=getAddress(d.wallet),locker=getAddress(d.locker);
    if(lower(locker)!==lower(LOCKER))throw new Error(`vlCVX platform locker drift ${company}`);
    for(const r of d.rewards||[]){
      if(!r?.token||r?.amountRaw===null||r?.amountRaw===undefined||!r?.symbol)continue;
      const amountRaw=BigInt(r.amountRaw);
      if(amountRaw<0n)throw new Error(`vlCVX platform negative amount ${company} ${r.symbol}`);
      out.push({
        stateKey:`${company}|${lower(wallet)}|${lower(r.token)}`,
        company,wallet,locker,token:getAddress(r.token),symbol:String(r.symbol),decimals:Number(r.decimals??18),
        amountRaw:amountRaw.toString(),amount:Number(r.amount||0),observedAt,blockNumber,currentRoute:d.currentRoute||null,
        sourceRoute:'vlcvx-locker-platform-rewards'
      });
    }
  }
  return out.sort((a,b)=>a.stateKey.localeCompare(b.stateKey));
}

function latestBoundary(previousExtension,stateKey){
  return (previousExtension?.boundaries||[]).filter(x=>x?.stateKey===stateKey).sort((a,b)=>Number(a.blockNumber)-Number(b.blockNumber)).at(-1)||null;
}
function retainBoundaries(rows,max=4000){
  const byKey=new Map();
  for(const r of rows){if(!r?.stateKey)continue;if(!byKey.has(r.stateKey))byKey.set(r.stateKey,[]);byKey.get(r.stateKey).push(r);}
  return[...byKey.values()].flatMap(x=>x.sort((a,b)=>Number(a.blockNumber)-Number(b.blockNumber)).slice(-max)).sort((a,b)=>Number(a.blockNumber)-Number(b.blockNumber)||a.stateKey.localeCompare(b.stateKey));
}

async function scanRewardPaidWithProvider(provider,{wallet,token,fromBlock,toBlock}){
  if(fromBlock>toBlock)return[];
  const topics=REWARD_PAID_IFACE.encodeFilterTopics(REWARD_PAID_IFACE.getEvent('RewardPaid'),[wallet,token]);
  const rows=[];let cursor=fromBlock,span=100000,calls=0;
  while(cursor<=toBlock){
    if(++calls>300)throw new Error('vlCVX RewardPaid scan exceeded bounded call budget');
    const end=Math.min(toBlock,cursor+span-1);
    try{
      const logs=await provider.getLogs({address:LOCKER,topics,fromBlock:cursor,toBlock:end});rows.push(...logs);cursor=end+1;
    }catch(e){
      if(span<=5000)throw e;span=Math.max(5000,Math.floor(span/2));
    }
  }
  return rows;
}

export async function proveNoInterveningPlatformClaim({wallet,token,fromBlock,toBlock,provider=null}){
  if(fromBlock>toBlock)return{status:'no-intervening-claim-proven',claimCount:0,fromBlock,toBlock,transport:'empty-range'};
  if(provider){
    const rows=await scanRewardPaidWithProvider(provider,{wallet,token,fromBlock,toBlock});
    return{status:rows.length?'intervening-claim-observed':'no-intervening-claim-proven',claimCount:rows.length,fromBlock,toBlock,transport:'provided-ethereum-json-rpc'};
  }
  const errors=[];
  for(const url of RPCS){
    try{
      const p=new JsonRpcProvider(url,1,{staticNetwork:true});await p.getBlockNumber();
      const rows=await scanRewardPaidWithProvider(p,{wallet,token,fromBlock,toBlock});
      return{status:rows.length?'intervening-claim-observed':'no-intervening-claim-proven',claimCount:rows.length,fromBlock,toBlock,transport:'ethereum-json-rpc'};
    }catch(e){errors.push(e?.shortMessage||e?.message||String(e));}
  }
  throw new Error(`vlCVX RewardPaid continuity unavailable: ${errors.join(' | ')}`);
}

function boundaryFromState(state,marketData){
  const price=priceFor(state.symbol,marketData);
  return{...state,priceUsd:price?.usd??null,priceAssetId:price?.assetId??null,priceObservedAt:price?.observedAt??null,priceSource:price?.source??null,priceStatus:price?.status??null,periodIncomeAuthority:false,unknownIsNotZero:true};
}

export async function buildVlCvxPlatformAccrual({rewards={},marketData={},previousExtension=null,generatedAt=new Date().toISOString(),provider=null}={}){
  const current=extractVlCvxPlatformStates(rewards),priorBoundaries=Array.isArray(previousExtension?.boundaries)?previousExtension.boundaries:[];
  const appended=[],events=[],reconciliation=[];let baselineCount=0,unchangedCount=0,positiveDeltaCount=0;
  for(const state of current){
    const boundary=boundaryFromState(state,marketData),prev=latestBoundary(previousExtension,state.stateKey);
    const duplicate=prev&&Number(prev.blockNumber)===Number(boundary.blockNumber)&&String(prev.amountRaw)===String(boundary.amountRaw);
    if(!duplicate)appended.push(boundary);
    if(!prev||!Number.isSafeInteger(Number(prev.blockNumber))||Number(prev.blockNumber)>=Number(boundary.blockNumber)){
      if(!prev)baselineCount++;
      continue;
    }
    const deltaRaw=BigInt(boundary.amountRaw)-BigInt(prev.amountRaw);
    if(deltaRaw===0n){unchangedCount++;continue;}
    if(deltaRaw<0n){
      reconciliation.push({stateKey:state.stateKey,company:state.company,symbol:state.symbol,previousBlock:Number(prev.blockNumber),currentBlock:Number(boundary.blockNumber),previousAmountRaw:String(prev.amountRaw),currentAmountRaw:String(boundary.amountRaw),reason:'claimable-decrease-requires-reconciliation',periodIncomeAuthority:false,unknownIsNotZero:true});
      continue;
    }
    positiveDeltaCount++;
    const continuity=await proveNoInterveningPlatformClaim({wallet:state.wallet,token:state.token,fromBlock:Number(prev.blockNumber)+1,toBlock:Number(boundary.blockNumber),provider});
    if(continuity.status!=='no-intervening-claim-proven'){
      reconciliation.push({stateKey:state.stateKey,company:state.company,symbol:state.symbol,previousBlock:Number(prev.blockNumber),currentBlock:Number(boundary.blockNumber),reason:'positive-delta-with-intervening-claim-not-admitted',claimContinuity:continuity,periodIncomeAuthority:false,unknownIsNotZero:true});
      continue;
    }
    const decimals=Number.isInteger(Number(state.decimals))?Number(state.decimals):18;
    const deltaAmount=Number(formatUnits(deltaRaw,decimals));
    if(!(deltaAmount>0))throw new Error(`vlCVX platform positive raw delta became invalid amount ${state.stateKey}`);
    const usdValue=finite(boundary.priceUsd)?round(deltaAmount*Number(boundary.priceUsd),8):null;
    events.push({
      eventKey:`vlcvx-platform:${lower(state.wallet)}:${lower(state.token)}:${Number(prev.blockNumber)}:${Number(boundary.blockNumber)}`,
      company:state.company,family:'accrued-entitlement',route:'vlcvx-locker-platform-rewards',protocol:'Convex · CvxLockerV2',
      economicDate:String(boundary.observedAt||generatedAt).slice(0,10),periodStart:prev.observedAt||null,periodEnd:boundary.observedAt||generatedAt,
      asset:state.symbol,token:state.token,amount:round(deltaAmount,12),amountRaw:deltaRaw.toString(),usdValue,
      valuationStatus:usdValue===null?'unvalued-canonical-price-unavailable':'frozen-canonical-market-price-at-recognition',
      valuationAssetId:boundary.priceAssetId||null,valuationUnitUsd:finite(boundary.priceUsd)?Number(boundary.priceUsd):null,valuationObservedAt:boundary.priceObservedAt||null,valuationSource:boundary.priceSource||null,
      sourceIdentity:`${state.stateKey}:${Number(prev.blockNumber)}:${Number(boundary.blockNumber)}`,sourceFamily:'CvxLockerV2 claimableRewards factual positive delta',
      evidenceStatus:'canonical-positive-claimable-delta-no-intervening-RewardPaid',claimContinuityStatus:continuity.status,claimContinuity:continuity,
      currentClaimableBalanceIsPeriodIncome:false,claimIsSecondIncomeEvent:false,laterClaimOrPriceMoveDoesNotRewriteIncome:true,referenceAprUsed:false,unknownIsNotZero:true,executionAuthority:'none'
    });
  }
  const boundaries=retainBoundaries([...priorBoundaries,...appended]);
  return{
    events,
    extension:{
      version:VERSION,status:'factual-boundary-tracking',generatedAt,mechanism:'vlcvx-locker-platform-rewards',component:'locked-cvx-platform-rewards',locker:LOCKER,
      boundaries,reconciliation,
      semantics:{openingBalanceCreatesIncome:false,earnedIndependentOfClaim:true,claimIsSettlementNotSecondIncome:true,currentClaimableBalanceIsPeriodIncome:false,positiveDeltaRequiresNoInterveningRewardPaid:true,claimableDecreaseCreatesNegativeIncome:false,referenceAprUsed:false,laterPriceMovementRewritesClosedIncome:false,delegateIncentiveSettlementIsSeparate:true,unknownIsNotZero:true},
      diagnostics:{currentStateCount:current.length,companyCount:new Set(current.map(x=>x.company)).size,baselineCount,positiveDeltaCount,candidateEventCount:events.length,reconciliationCount:reconciliation.length,unchangedCount},
      authority:{executionAuthority:'none',walletAuthority:'none',claimingAuthority:'none',capitalExecution:false,methodologyMutationAuthority:'none'}
    }
  };
}
