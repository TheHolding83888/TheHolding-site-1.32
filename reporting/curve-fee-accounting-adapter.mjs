import { Contract, Interface, JsonRpcProvider, formatUnits, getAddress } from 'ethers';

export const VERSION='0.1-curve-fee-distributor-factual-accrual-adapter';
export const FEE_DISTRIBUTOR=getAddress('0xD16d5eC345Dd86Fb63C6a9C43c517210F1027914');
export const CRVUSD=getAddress('0xf939E0A03FB07F59A73314E73794Be0E57ac1b4E');
const RPCS=[...new Set([process.env.ETH_RPC_URL,'https://ethereum-rpc.publicnode.com','https://eth.llamarpc.com','https://eth.drpc.org'].filter(Boolean))];
const ABI=[
  'function claim(address addr) returns (uint256)',
  'event Claimed(address indexed recipient,uint256 amount,uint256 claim_epoch,uint256 max_epoch)'
];
const CLAIMED_IFACE=new Interface([ABI[1]]);
const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
const lower=v=>String(v||'').toLowerCase();
const round=(v,d=12)=>Number(Number(v).toFixed(d));

function canonicalPrice(marketData={}){
  const rows=Object.values(marketData?.prices||{}).filter(row=>{
    const symbol=String(row?.symbol||'').toLowerCase();
    const ids=[row?.assetId,row?.providerId,row?.contract,row?.address].map(lower);
    return (symbol==='crvusd'||ids.includes(lower(CRVUSD)))&&finite(row?.usd)&&Number(row.usd)>0;
  });
  if(rows.length!==1)return null;
  const row=rows[0];
  return{usd:Number(row.usd),assetId:row.assetId||row.providerId||null,observedAt:row.observedAt||marketData?.observedAt||marketData?.generatedAt||null,source:row.source||null,status:row.status||null};
}

function pushWallet(out,seen,{company,wallet,walletAlias=null,routeStatus='ok'}){
  let normalized;
  try{normalized=getAddress(wallet);}catch{return;}
  const key=`${company}|${lower(normalized)}`;
  if(seen.has(key))return;
  seen.add(key);
  out.push({company,wallet:normalized,walletAlias:walletAlias||null,routeStatus});
}

export function discoverCurveFeeWallets(rewards={}){
  const out=[],seen=new Set();
  for(const [company,c] of Object.entries(rewards?.companies||{})){
    const sources=(c?.sources||[]).filter(x=>x?.route==='curve-fees'&&['ok','partial'].includes(x?.status));
    for(const source of sources){
      for(const row of source?.details?.walletResults||[]){
        if(row?.status!=='ok')continue;
        pushWallet(out,seen,{company,wallet:row?.wallet,walletAlias:row?.walletAlias,routeStatus:source.status});
      }
    }
    // Positive current reward rows are a safe discovery fallback when an older
    // Rewards snapshot predates walletResults. Absence of a reward row is never
    // interpreted as zero and therefore cannot create a factual boundary.
    for(const row of c?.rewards||[]){
      if(row?.route!=='curve-fees'||!row?.details?.wallet)continue;
      pushWallet(out,seen,{company,wallet:row.details.wallet,walletAlias:row.details.walletAlias,routeStatus:'reward-row-fallback'});
    }
  }
  return out.sort((a,b)=>a.company.localeCompare(b.company)||a.wallet.localeCompare(b.wallet));
}

async function providerAtBlock(){
  const errors=[];
  for(const url of RPCS){
    try{
      const provider=new JsonRpcProvider(url,1,{staticNetwork:true});
      const blockNumber=await provider.getBlockNumber();
      if(!Number.isSafeInteger(blockNumber)||blockNumber<=0)throw new Error('invalid Ethereum block');
      return{provider,blockNumber,transport:'ethereum-json-rpc'};
    }catch(error){errors.push(error?.shortMessage||error?.message||String(error));}
  }
  throw new Error(`Curve FeeDistributor RPC unavailable: ${errors.join(' | ')}`);
}

async function readClaimable(provider,wallet,blockNumber){
  const fd=new Contract(FEE_DISTRIBUTOR,ABI,provider);
  return BigInt(await fd.claim.staticCall(wallet,{blockTag:blockNumber}));
}

export async function observeCurveFeeStates({rewards={},generatedAt=new Date().toISOString(),provider=null,blockNumber=null,claimableReader=null}={}){
  const wallets=discoverCurveFeeWallets(rewards);
  if(!wallets.length)return{states:[],failures:[],blockNumber:null,transport:'no-discovered-wallets',discoveredWalletCount:0};
  let p=provider,bn=blockNumber,transport='provided-ethereum-json-rpc';
  if(!p){const selected=await providerAtBlock();p=selected.provider;bn=selected.blockNumber;transport=selected.transport;}
  if(!Number.isSafeInteger(Number(bn))||Number(bn)<=0)bn=await p.getBlockNumber();
  bn=Number(bn);
  const states=[],failures=[];
  for(const row of wallets){
    try{
      const raw=claimableReader?BigInt(await claimableReader({provider:p,wallet:row.wallet,blockNumber:bn,company:row.company})):await readClaimable(p,row.wallet,bn);
      if(raw<0n)throw new Error('negative claimable amount');
      states.push({
        stateKey:`${row.company}|${lower(row.wallet)}|${lower(CRVUSD)}`,
        company:row.company,wallet:row.wallet,walletAlias:row.walletAlias,feeDistributor:FEE_DISTRIBUTOR,
        token:CRVUSD,symbol:'crvUSD',decimals:18,amountRaw:raw.toString(),amount:Number(formatUnits(raw,18)),
        observedAt:generatedAt,blockNumber:bn,sourceRoute:'curve-fees',routeStatus:row.routeStatus,
        periodIncomeAuthority:false,currentClaimableBalanceIsPeriodIncome:false,unknownIsNotZero:true
      });
    }catch(error){
      failures.push({company:row.company,wallet:row.wallet,blockNumber:bn,error:error?.shortMessage||error?.message||String(error),unknownIsNotZero:true,periodIncomeAuthority:false});
    }
  }
  return{states:states.sort((a,b)=>a.stateKey.localeCompare(b.stateKey)),failures,blockNumber:bn,transport,discoveredWalletCount:wallets.length};
}

function latestBoundary(previousExtension,stateKey){
  return (previousExtension?.boundaries||[]).filter(x=>x?.stateKey===stateKey).sort((a,b)=>Number(a.blockNumber)-Number(b.blockNumber)).at(-1)||null;
}
function retainBoundaries(rows,maxPerKey=4000){
  const byKey=new Map();
  for(const row of rows){if(!row?.stateKey)continue;if(!byKey.has(row.stateKey))byKey.set(row.stateKey,[]);byKey.get(row.stateKey).push(row);}
  return [...byKey.values()].flatMap(rows=>rows.sort((a,b)=>Number(a.blockNumber)-Number(b.blockNumber)).slice(-maxPerKey))
    .sort((a,b)=>Number(a.blockNumber)-Number(b.blockNumber)||a.stateKey.localeCompare(b.stateKey));
}

async function scanClaimedWithProvider(provider,{wallet,fromBlock,toBlock}){
  if(fromBlock>toBlock)return[];
  const topics=CLAIMED_IFACE.encodeFilterTopics(CLAIMED_IFACE.getEvent('Claimed'),[wallet]);
  const rows=[];let cursor=fromBlock,span=100000,calls=0;
  while(cursor<=toBlock){
    if(++calls>300)throw new Error('Curve Claimed scan exceeded bounded call budget');
    const end=Math.min(toBlock,cursor+span-1);
    try{
      const logs=await provider.getLogs({address:FEE_DISTRIBUTOR,topics,fromBlock:cursor,toBlock:end});
      rows.push(...logs);cursor=end+1;
    }catch(error){
      if(span<=5000)throw error;
      span=Math.max(5000,Math.floor(span/2));
    }
  }
  return rows;
}

export async function proveNoInterveningCurveClaim({wallet,fromBlock,toBlock,provider=null,claimScanner=null}={}){
  if(fromBlock>toBlock)return{status:'no-intervening-claim-proven',claimCount:0,fromBlock,toBlock,transport:'empty-range'};
  if(claimScanner){
    const count=Number(await claimScanner({wallet,fromBlock,toBlock,feeDistributor:FEE_DISTRIBUTOR}))||0;
    return{status:count>0?'intervening-claim-observed':'no-intervening-claim-proven',claimCount:count,fromBlock,toBlock,transport:'injected-claim-scanner'};
  }
  if(provider){
    const rows=await scanClaimedWithProvider(provider,{wallet,fromBlock,toBlock});
    return{status:rows.length?'intervening-claim-observed':'no-intervening-claim-proven',claimCount:rows.length,fromBlock,toBlock,transport:'provided-ethereum-json-rpc'};
  }
  const errors=[];
  for(const url of RPCS){
    try{
      const p=new JsonRpcProvider(url,1,{staticNetwork:true});await p.getBlockNumber();
      const rows=await scanClaimedWithProvider(p,{wallet,fromBlock,toBlock});
      return{status:rows.length?'intervening-claim-observed':'no-intervening-claim-proven',claimCount:rows.length,fromBlock,toBlock,transport:'ethereum-json-rpc'};
    }catch(error){errors.push(error?.shortMessage||error?.message||String(error));}
  }
  throw new Error(`Curve Claimed continuity unavailable: ${errors.join(' | ')}`);
}

function boundaryFromState(state,marketData){
  const price=canonicalPrice(marketData);
  return{...state,priceUsd:price?.usd??null,priceAssetId:price?.assetId??null,priceObservedAt:price?.observedAt??null,priceSource:price?.source??null,priceStatus:price?.status??null};
}

export async function buildCurveFeeAccrual({rewards={},marketData={},previousExtension=null,generatedAt=new Date().toISOString(),provider=null,blockNumber=null,currentStates=null,claimableReader=null,claimScanner=null}={}){
  const observation=currentStates?{states:currentStates,failures:[],blockNumber:currentStates[0]?.blockNumber??blockNumber,transport:'injected-current-states',discoveredWalletCount:new Set(currentStates.map(x=>`${x.company}|${lower(x.wallet)}`)).size}:await observeCurveFeeStates({rewards,generatedAt,provider,blockNumber,claimableReader});
  const current=observation.states||[],priorBoundaries=Array.isArray(previousExtension?.boundaries)?previousExtension.boundaries:[];
  const appended=[],events=[],reconciliation=[];let baselineCount=0,unchangedCount=0,positiveDeltaCount=0;
  for(const state of current){
    if(state?.sourceRoute!=='curve-fees'||lower(state?.feeDistributor)!==lower(FEE_DISTRIBUTOR)||lower(state?.token)!==lower(CRVUSD))throw new Error(`Curve factual state identity drift ${state?.company||'unknown'}`);
    if(!Number.isSafeInteger(Number(state.blockNumber))||Number(state.blockNumber)<=0)throw new Error(`Curve factual state block missing ${state.company}`);
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
      reconciliation.push({stateKey:state.stateKey,company:state.company,wallet:state.wallet,previousBlock:Number(prev.blockNumber),currentBlock:Number(boundary.blockNumber),previousAmountRaw:String(prev.amountRaw),currentAmountRaw:String(boundary.amountRaw),reason:'claimable-decrease-requires-reconciliation',periodIncomeAuthority:false,unknownIsNotZero:true});
      continue;
    }
    positiveDeltaCount++;
    const continuity=await proveNoInterveningCurveClaim({wallet:state.wallet,fromBlock:Number(prev.blockNumber)+1,toBlock:Number(boundary.blockNumber),provider,claimScanner});
    if(continuity.status!=='no-intervening-claim-proven'){
      reconciliation.push({stateKey:state.stateKey,company:state.company,wallet:state.wallet,previousBlock:Number(prev.blockNumber),currentBlock:Number(boundary.blockNumber),reason:'positive-delta-with-intervening-claim-not-admitted',claimContinuity:continuity,periodIncomeAuthority:false,unknownIsNotZero:true});
      continue;
    }
    const amount=Number(formatUnits(deltaRaw,18));
    if(!(amount>0))throw new Error(`Curve positive raw delta became invalid amount ${state.stateKey}`);
    const usdValue=finite(boundary.priceUsd)?round(amount*Number(boundary.priceUsd),8):null;
    events.push({
      eventKey:`curve-fees:${lower(state.wallet)}:${Number(prev.blockNumber)}:${Number(boundary.blockNumber)}`,
      company:state.company,family:'accrued-entitlement',route:'curve-fees',protocol:'Curve · FeeDistributor',
      economicDate:String(boundary.observedAt||generatedAt).slice(0,10),periodStart:prev.observedAt||null,periodEnd:boundary.observedAt||generatedAt,
      asset:'crvUSD',token:CRVUSD,amount:round(amount,12),amountRaw:deltaRaw.toString(),usdValue,
      valuationStatus:usdValue===null?'unvalued-canonical-price-unavailable':'frozen-canonical-market-price-at-recognition',
      valuationAssetId:boundary.priceAssetId||null,valuationUnitUsd:finite(boundary.priceUsd)?Number(boundary.priceUsd):null,valuationObservedAt:boundary.priceObservedAt||null,valuationSource:boundary.priceSource||null,
      sourceIdentity:`${state.stateKey}:${Number(prev.blockNumber)}:${Number(boundary.blockNumber)}`,
      sourceFamily:'Curve FeeDistributor exact claimable positive delta',sourceFile:'reporting/income-ledger.json#accountingExtensions.curveFeeAccrual',
      evidenceStatus:'canonical-positive-claimable-delta-no-intervening-Claimed',claimContinuityStatus:continuity.status,claimContinuity:continuity,
      currentClaimableBalanceIsPeriodIncome:false,claimIsSecondIncomeEvent:false,laterClaimOrPriceMoveDoesNotRewriteIncome:true,referenceAprUsed:false,unknownIsNotZero:true,executionAuthority:'none'
    });
  }
  const boundaries=retainBoundaries([...priorBoundaries,...appended]);
  const status=observation.failures?.length?'partial-factual-boundary-tracking':'factual-boundary-tracking';
  return{
    events,
    extension:{
      version:VERSION,status,generatedAt,mechanism:'curve-vecrv-fee-distributor',component:'crvusd-fee-entitlement',feeDistributor:FEE_DISTRIBUTOR,token:CRVUSD,
      boundaries,reconciliation,failures:observation.failures||[],
      semantics:{openingBalanceCreatesIncome:false,earnedIndependentOfClaim:true,claimIsSettlementNotSecondIncome:true,currentClaimableBalanceIsPeriodIncome:false,positiveDeltaRequiresNoInterveningClaimed:true,claimableDecreaseCreatesNegativeIncome:false,referenceAprUsed:false,laterPriceMovementRewritesClosedIncome:false,stablePriceEffectSeparate:true,unknownIsNotZero:true},
      diagnostics:{observedBlock:observation.blockNumber??null,transport:observation.transport,discoveredWalletCount:observation.discoveredWalletCount,currentStateCount:current.length,companyCount:new Set(current.map(x=>x.company)).size,baselineCount,positiveDeltaCount,candidateEventCount:events.length,reconciliationCount:reconciliation.length,unchangedCount,failureCount:observation.failures?.length||0},
      authority:{executionAuthority:'none',walletAuthority:'none',claimingAuthority:'none',capitalExecution:false,methodologyMutationAuthority:'none'}
    }
  };
}
