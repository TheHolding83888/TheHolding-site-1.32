from pathlib import Path


def edit(path):
    p = Path(path)
    return p, p.read_text()


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly one match, found {count}')
    return text.replace(old, new, 1)


# 1) Exact historical price resolver: SNX direct Chainlink + LAPTOP Base Slipstream TWAP/USDC Chainlink.
p, s = edit('reporting/historical-canonical-price.mjs')
s = replace_once(
    s,
    "  '0x1f32b1c2345538c0c6f582fcb022739c4a194ebb':Object.freeze({assetId:'wrapped-steth',symbol:'wstETH',network:'optimism',chainId:10,contract:'0x698B585CbC4407e2D54aa898B2600B53C68958f7',maxAgeSeconds:90000})\n});",
    "  '0x1f32b1c2345538c0c6f582fcb022739c4a194ebb':Object.freeze({assetId:'wrapped-steth',symbol:'wstETH',network:'optimism',chainId:10,contract:'0x698B585CbC4407e2D54aa898B2600B53C68958f7',maxAgeSeconds:90000}),\n  '0x8700daec35af8ff88c16bdf0418774cb3d7599b4':Object.freeze({assetId:'synthetix-network-token',symbol:'SNX',network:'optimism',chainId:10,contract:'0x2FCF37343e916eAEd1f1DdaaF84458a359b53877',maxAgeSeconds:1200})\n});",
    'add Optimism SNX Chainlink route',
)

base_anchor = """export const HISTORICAL_BASE_CHAINLINK_TOKEN_FEEDS=Object.freeze({
  '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913':Object.freeze({assetId:'usd-coin',symbol:'USDC',network:'base',chainId:8453,contract:'0x7e860098F58bBFC8648a4311b374B1D669a2bc6B',maxAgeSeconds:90000})
});
"""
base_insert = base_anchor + """
export const HISTORICAL_BASE_SLIPSTREAM_TWAP_TOKEN_ROUTES=Object.freeze({
  '0xb095274743941e953c746f9c228da9c18bb6ec29':Object.freeze({
    assetId:'laptop',symbol:'LAPTOP',network:'base',chainId:8453,
    token:'0xB095274743941e953c746F9C228DA9c18Bb6ec29',tokenDecimals:18,
    pool:'0x99cf3e8bfb02c300312c53aac5d0b082e3d5975c',
    quoteToken:'0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',quoteTokenSymbol:'USDC',quoteTokenDecimals:6,
    quoteChainlinkFeed:'0x7e860098F58bBFC8648a4311b374B1D669a2bc6B',twapSeconds:300
  })
});
"""
s = replace_once(s, base_anchor, base_insert, 'add Base Slipstream route')

s = replace_once(
    s,
    """const VELODROME_SELECTORS=Object.freeze({
  token0:'0x0dfe1681',token1:'0xd21220a7',stable:'0x22be3de1',observationLength:'0xebeb31db',quote:'0x9e8cc04b'
});
""",
    """const VELODROME_SELECTORS=Object.freeze({
  token0:'0x0dfe1681',token1:'0xd21220a7',stable:'0x22be3de1',observationLength:'0xebeb31db',quote:'0x9e8cc04b'
});
const SLIPSTREAM_SELECTORS=Object.freeze({token0:'0x0dfe1681',token1:'0xd21220a7',observe:'0x883bdbfd'});
""",
    'add Slipstream selectors',
)

helper_anchor = """function encodeVelodromeQuote(tokenIn,amountIn,granularity){return`${VELODROME_SELECTORS.quote}${abiAddress(tokenIn)}${abiWord(amountIn)}${abiWord(granularity)}`;}
function decodeAddressResult(hex){const raw=String(hex||'').replace(/^0x/,'');if(raw.length<64)throw new Error('ABI address result missing');const out=`0x${raw.slice(-40)}`;if(!/^0x[0-9a-f]{40}$/i.test(out))throw new Error('ABI address result invalid');return out;}
function decodeBoolResult(hex){return decodeUint256(hex)!==0n;}
"""
helper_insert = helper_anchor + """function encodeSlipstreamObserve(secondsAgo){return`${SLIPSTREAM_SELECTORS.observe}${abiWord(32)}${abiWord(2)}${abiWord(secondsAgo)}${abiWord(0)}`;}
function signedBits(value,bits){const b=BigInt(bits),mod=1n<<b,mask=mod-1n,sign=1n<<(b-1n),v=BigInt(value)&mask;return v>=sign?v-mod:v;}
function decodeSlipstreamTickCumulatives(hex){
  const raw=String(hex||'').replace(/^0x/,'');if(raw.length<128)throw new Error('Slipstream observe result missing');
  const offset=Number(BigInt(`0x${raw.slice(0,64)}`));if(!Number.isSafeInteger(offset)||offset<32||offset%32!==0)throw new Error('Slipstream observe offset invalid');
  const base=offset*2;if(raw.length<base+64)throw new Error('Slipstream tick cumulative array missing');
  const length=Number(BigInt(`0x${raw.slice(base,base+64)}`));if(length!==2)throw new Error(`Slipstream observe length invalid: ${length}`);
  const ticks=[];for(let i=0;i<length;i++){const start=base+64+i*64;if(raw.length<start+64)throw new Error('Slipstream tick cumulative word missing');ticks.push(signedBits(BigInt(`0x${raw.slice(start,start+64)}`),56));}
  return ticks;
}
function slipstreamQuoteTokenPerReward({avgTick,token0,route}){
  if(!Number.isSafeInteger(avgTick))throw new Error('Slipstream average tick invalid');
  const rawToken1PerToken0=Math.pow(1.0001,avgTick),scale=10**(Number(route.tokenDecimals)-Number(route.quoteTokenDecimals));
  if(!(Number.isFinite(rawToken1PerToken0)&&rawToken1PerToken0>0&&Number.isFinite(scale)&&scale>0))throw new Error('Slipstream tick price invalid');
  const quotePerReward=lower(token0)===lower(route.token)?rawToken1PerToken0*scale:scale/rawToken1PerToken0;
  if(!(Number.isFinite(quotePerReward)&&quotePerReward>0))throw new Error('Slipstream derived quote invalid');
  return quotePerReward;
}
"""
s = replace_once(s, helper_anchor, helper_insert, 'add Slipstream helpers')

s = replace_once(
    s,
    "export function historicalOptimismVelodromeTwapRouteForToken(token){return HISTORICAL_OPTIMISM_VELODROME_TWAP_TOKEN_ROUTES[lower(token)]||null;}\n",
    "export function historicalOptimismVelodromeTwapRouteForToken(token){return HISTORICAL_OPTIMISM_VELODROME_TWAP_TOKEN_ROUTES[lower(token)]||null;}\nexport function historicalBaseSlipstreamTwapRouteForToken(token){return HISTORICAL_BASE_SLIPSTREAM_TWAP_TOKEN_ROUTES[lower(token)]||null;}\n",
    'add Slipstream route accessor',
)

resolver_anchor = "export async function historicalCanonicalPriceAtBoundary({token,boundaryAt,eventKey=null,sourceIdentity=null,root=ROOT,gitRun=defaultGitRun,schedulerContract=null,maxHistoryCommits=96,onchainRegistry=null,rpcCall=defaultHistoricalRpcCall,fetchImpl=fetch}={}){\n"
slipstream_fn = """export async function historicalBaseSlipstreamTwapPriceAtBoundary({token,boundaryAt,eventKey=null,sourceIdentity=null,root=ROOT,onchainRegistry=null,rpcCall=defaultHistoricalRpcCall,fetchImpl=fetch}={}){
  const route=historicalBaseSlipstreamTwapRouteForToken(token);if(!route)return{ok:false,status:'token-not-historical-slipstream-twap-mapped',assetId:null};
  const boundaryMs=Date.parse(boundaryAt||'');if(!Number.isFinite(boundaryMs))return{ok:false,status:'invalid-accounting-boundary',assetId:route.assetId};
  const sourceBlockNumber=closingBlockFromVe33Identity({eventKey,sourceIdentity});if(!sourceBlockNumber)return{ok:false,status:'ve33-closing-block-proof-missing',assetId:route.assetId};
  let registry=onchainRegistry;try{if(!registry)registry=await readOnchainPriceRegistry(root);}catch(error){return{ok:false,status:'onchain-price-registry-unavailable',assetId:route.assetId,error:error?.message||String(error)};}
  const network=registry?.networks?.[route.network];if(Number(network?.chainId)!==route.chainId||!Array.isArray(network?.rpcFailover)||!network.rpcFailover.length)return{ok:false,status:'base-historical-rpc-fabric-unavailable',assetId:route.assetId};
  const blockTag=hexQuantity(sourceBlockNumber),attempts=[],observeData=encodeSlipstreamObserve(route.twapSeconds);
  for(const endpoint of network.rpcFailover){try{
    const block=await rpcCall({endpoint,method:'eth_getBlockByNumber',params:[blockTag,false],fetchImpl});
    if(lower(block?.number)!==lower(blockTag))return{ok:false,status:'ve33-closing-block-rpc-mismatch',assetId:route.assetId,sourceBlockNumber};
    const blockTimestampSeconds=Number(BigInt(block?.timestamp||'0x0')),blockTimestampMs=blockTimestampSeconds*1000;
    if(!(Number.isFinite(blockTimestampMs)&&blockTimestampMs>0))return{ok:false,status:'historical-slipstream-block-time-invalid',assetId:route.assetId,sourceBlockNumber};
    if(blockTimestampMs>boundaryMs)return{ok:false,status:'historical-slipstream-block-after-accounting-boundary',assetId:route.assetId,sourceBlockNumber};
    const boundaryLagSeconds=(boundaryMs-blockTimestampMs)/1000;if(boundaryLagSeconds>MAX_BOUNDARY_BLOCK_LAG_SECONDS)return{ok:false,status:'historical-slipstream-block-too-far-from-accounting-boundary',assetId:route.assetId,sourceBlockNumber,boundaryLagSeconds:Number(boundaryLagSeconds.toFixed(3))};
    const[token0Hex,token1Hex,observeHex]=await Promise.all([
      rpcCall({endpoint,method:'eth_call',params:[{to:route.pool,data:SLIPSTREAM_SELECTORS.token0},blockTag],fetchImpl}),
      rpcCall({endpoint,method:'eth_call',params:[{to:route.pool,data:SLIPSTREAM_SELECTORS.token1},blockTag],fetchImpl}),
      rpcCall({endpoint,method:'eth_call',params:[{to:route.pool,data:observeData},blockTag],fetchImpl})
    ]);
    const token0=decodeAddressResult(token0Hex),token1=decodeAddressResult(token1Hex),pair=new Set([lower(token0),lower(token1)]);
    if(pair.size!==2||!pair.has(lower(route.token))||!pair.has(lower(route.quoteToken)))return{ok:false,status:'historical-slipstream-pool-token-identity-mismatch',assetId:route.assetId,sourceBlockNumber};
    const ticks=decodeSlipstreamTickCumulatives(observeHex),delta=ticks[1]-ticks[0],window=BigInt(route.twapSeconds);let averageTick=delta/window;if(delta<0n&&delta%window!==0n)averageTick-=1n;
    const averageTickNumber=Number(averageTick);if(!Number.isSafeInteger(averageTickNumber))return{ok:false,status:'historical-slipstream-average-tick-invalid',assetId:route.assetId,sourceBlockNumber};
    const quoteTokenAmount=slipstreamQuoteTokenPerReward({avgTick:averageTickNumber,token0,route});
    const quoteUsd=await historicalBaseChainlinkPriceAtBoundary({token:route.quoteToken,boundaryAt,eventKey,sourceIdentity,root,onchainRegistry:registry,rpcCall,fetchImpl});
    if(quoteUsd?.ok!==true)return{ok:false,status:'historical-slipstream-quote-token-usd-unavailable',assetId:route.assetId,sourceBlockNumber,quoteStatus:quoteUsd?.status||null,quoteAssetId:quoteUsd?.assetId||null};
    if(lower(quoteUsd.sourceContract)!==lower(route.quoteChainlinkFeed)||Number(quoteUsd.sourceBlockNumber)!==sourceBlockNumber||Number(quoteUsd.chainId)!==route.chainId)return{ok:false,status:'historical-slipstream-quote-token-proof-mismatch',assetId:route.assetId,sourceBlockNumber};
    const priceUsd=quoteTokenAmount*Number(quoteUsd.priceUsd);if(!(Number.isFinite(priceUsd)&&priceUsd>0))return{ok:false,status:'historical-slipstream-derived-price-not-finite-positive',assetId:route.assetId,sourceBlockNumber};
    return{ok:true,status:'historical-onchain-slipstream-twap-chainlink-price',sourceFamily:'historical-onchain-slipstream-twap-chainlink-at-boundary',assetId:route.assetId,symbol:route.symbol,priceUsd,observedAt:quoteUsd.observedAt,ageMinutes:quoteUsd.ageMinutes,maxAgeMinutes:quoteUsd.maxAgeMinutes,chainId:route.chainId,sourceBlockNumber,sourceBlockTimestamp:new Date(blockTimestampMs).toISOString(),sourceContract:route.pool,rpcEndpointId:endpoint?.id||null,exactHistoricalBlock:true,poolToken0:token0,poolToken1:token1,quoteToken:route.quoteToken,quoteTokenSymbol:route.quoteTokenSymbol,quoteTokenAmount,twapSeconds:route.twapSeconds,averageTick:averageTickNumber,quoteChainlinkContract:quoteUsd.sourceContract,quoteRoundId:quoteUsd.roundId,quoteAnsweredInRound:quoteUsd.answeredInRound,quoteObservedAt:quoteUsd.observedAt,quotePriceUsd:quoteUsd.priceUsd,sourceFile:'reporting/historical-canonical-price.mjs#HISTORICAL_BASE_SLIPSTREAM_TWAP_TOKEN_ROUTES',priceSource:'onchain-slipstream-twap-plus-chainlink-quote-exact-historical-block',stablecoinPegAssumptionUsed:false,currentPriceUsed:false,referenceAprUsed:false,executionAuthority:'none'};
  }catch(error){attempts.push({endpointId:endpoint?.id||null,error:error?.message||String(error)});}}
  return{ok:false,status:'historical-onchain-slipstream-twap-rpc-unavailable',assetId:route.assetId,sourceBlockNumber,attempts};
}

""" + resolver_anchor
s = replace_once(s, resolver_anchor, slipstream_fn, 'add Slipstream resolver')
s = replace_once(
    s,
    "    if(historicalOptimismVelodromeTwapRouteForToken(token))return historicalOptimismVelodromeTwapPriceAtBoundary({token,boundaryAt,eventKey,sourceIdentity,root,onchainRegistry,rpcCall,fetchImpl});\n    return{ok:false,status:'token-not-canonical-market-data-mapped',assetId:null};",
    "    if(historicalOptimismVelodromeTwapRouteForToken(token))return historicalOptimismVelodromeTwapPriceAtBoundary({token,boundaryAt,eventKey,sourceIdentity,root,onchainRegistry,rpcCall,fetchImpl});\n    if(historicalBaseSlipstreamTwapRouteForToken(token))return historicalBaseSlipstreamTwapPriceAtBoundary({token,boundaryAt,eventKey,sourceIdentity,root,onchainRegistry,rpcCall,fetchImpl});\n    return{ok:false,status:'token-not-canonical-market-data-mapped',assetId:null};",
    'route LAPTOP through Slipstream resolver',
)
p.write_text(s)

# 2) Bind Slipstream valuation provenance to immutable ve33 token + chain identity.
p, s = edit('reporting/ve33-historical-valuation-identity.mjs')
s = replace_once(
    s,
    "  historicalChainlinkRouteForToken,\n  historicalOptimismVelodromeTwapRouteForToken\n",
    "  historicalChainlinkRouteForToken,\n  historicalOptimismVelodromeTwapRouteForToken,\n  historicalBaseSlipstreamTwapRouteForToken\n",
    'import Slipstream route accessor',
)
identity_anchor = """  if(family==='historical-onchain-velodrome-twap-chainlink-at-boundary'){
    const route=historicalOptimismVelodromeTwapRouteForToken(identity.token);
    return Boolean(route)&&
      Number(event?.chainId)===Number(route.chainId)&&
      Number(resolution?.sourceChainId)===Number(route.chainId)&&
      String(resolution?.sourceAssetId||'')===String(route.assetId)&&
      lower(resolution?.sourceContract)===lower(route.pool)&&
      lower(resolution?.quoteToken)===lower(route.quoteToken)&&
      lower(resolution?.quoteChainlinkContract)===lower(route.quoteChainlinkFeed)&&
      Number(resolution?.twapGranularity)===Number(route.twapGranularity)&&
      resolution?.poolStable===route.poolStable&&
      resolution?.stablecoinPegAssumptionUsed===false&&
      String(resolution?.sourceStatus||'')==='historical-onchain-velodrome-twap-chainlink-price';
  }
"""
identity_insert = identity_anchor + """  if(family==='historical-onchain-slipstream-twap-chainlink-at-boundary'){
    const route=historicalBaseSlipstreamTwapRouteForToken(identity.token);
    const pair=new Set([lower(resolution?.poolToken0),lower(resolution?.poolToken1)]);
    return Boolean(route)&&
      Number(event?.chainId)===Number(route.chainId)&&
      Number(resolution?.sourceChainId)===Number(route.chainId)&&
      String(resolution?.sourceAssetId||'')===String(route.assetId)&&
      lower(resolution?.sourceContract)===lower(route.pool)&&
      lower(resolution?.quoteToken)===lower(route.quoteToken)&&
      lower(resolution?.quoteChainlinkContract)===lower(route.quoteChainlinkFeed)&&
      Number(resolution?.twapSeconds)===Number(route.twapSeconds)&&
      Number.isSafeInteger(Number(resolution?.averageTick))&&
      pair.size===2&&pair.has(lower(route.token))&&pair.has(lower(route.quoteToken))&&
      resolution?.stablecoinPegAssumptionUsed===false&&
      String(resolution?.sourceStatus||'')==='historical-onchain-slipstream-twap-chainlink-price';
  }
"""
s = replace_once(s, identity_anchor, identity_insert, 'add Slipstream identity binding')
p.write_text(s)

# 3) Canonical ledger: admit exact intraperiod ve33 boundaries and retain Slipstream proof metadata.
p, s = edit('reporting/income-ledger.mjs')
s = replace_once(s, "const MONTH_BOUNDARY=/^\\d{4}-\\d{2}-01T00:00:00\\.000Z$/;\n", '', 'remove month-only valuation gate')
s = replace_once(
    s,
    "  'historical-onchain-chainlink-at-boundary',\n  'historical-onchain-velodrome-twap-chainlink-at-boundary'\n",
    "  'historical-onchain-chainlink-at-boundary',\n  'historical-onchain-velodrome-twap-chainlink-at-boundary',\n  'historical-onchain-slipstream-twap-chainlink-at-boundary'\n",
    'add exact Slipstream source family',
)
s = replace_once(
    s,
    "const isEligible=event?.family==='accrued-entitlement'&&event?.sourceFile===VE33_SOURCE_FILE&&event?.usdValue===null&&event?.valuationStatus==='unvalued-fail-closed'&&MONTH_BOUNDARY.test(boundaryAt)&&finite(event?.amount)&&Number(event.amount)>0&&event?.unknownIsNotZero===true&&event?.executionAuthority==='none';",
    "const isEligible=event?.family==='accrued-entitlement'&&event?.sourceFile===VE33_SOURCE_FILE&&event?.usdValue===null&&event?.valuationStatus==='unvalued-fail-closed'&&Number.isFinite(Date.parse(boundaryAt))&&finite(event?.amount)&&Number(event.amount)>0&&event?.unknownIsNotZero===true&&event?.executionAuthority==='none';",
    'admit intraperiod factual ve33 boundaries',
)
ledger_anchor = """    const chainlinkFields=sourceFamily==='historical-onchain-chainlink-at-boundary'?{sourceRoundId:valuation.roundId||null,sourceAnsweredInRound:valuation.answeredInRound||null}:{};
    const twapFields=sourceFamily==='historical-onchain-velodrome-twap-chainlink-at-boundary'?{quoteToken:valuation.quoteToken||null,quoteTokenSymbol:valuation.quoteTokenSymbol||null,quoteAmountOutRaw:valuation.quoteAmountOutRaw||null,quoteTokenAmount:finite(valuation.quoteTokenAmount)?round(valuation.quoteTokenAmount,12):null,twapGranularity:Number(valuation.twapGranularity),observationLength:Number(valuation.observationLength),poolStable:valuation.poolStable===true,quoteChainlinkContract:valuation.quoteChainlinkContract||null,quoteRoundId:valuation.quoteRoundId||null,quoteAnsweredInRound:valuation.quoteAnsweredInRound||null,quoteObservedAt:valuation.quoteObservedAt||null,quotePriceUsd:finite(valuation.quotePriceUsd)?round(valuation.quotePriceUsd,12):null}:{};
    const resolution={version:HISTORICAL_VALUATION_RESOLUTION_VERSION,resolvesUsdValue:true,resolvedUsdValue,valuationUnitUsd:round(price,12),boundaryAt,observedAt:valuation.observedAt,sourceFile:valuation.sourceFile||null,sourceCommit:valuation.commitSha||null,sourceAssetId:valuation.assetId||null,sourceStatus:valuation.status||'historical-canonical-market-price',snapshotAgeMinutes:finite(valuation.ageMinutes)?round(valuation.ageMinutes,6):null,sourceFamily,...onchainCommon,...chainlinkFields,...twapFields,identityBound:true,identityToken:identity.token,identityOpenBlock:identity.openBlock,identityCloseBlock:identity.closeBlock,eventTokenMatchesIdentity:identity.eventTokenMatchesIdentity===true,identitySource:'ve33-eventKey+sourceIdentity',originalUsdValue:null,economicFieldsMutated:false,referenceAprUsed:false,currentPriceUsed:false,unknownIsNotZero:true,executionAuthority:'none'};
"""
ledger_insert = """    const chainlinkFields=sourceFamily==='historical-onchain-chainlink-at-boundary'?{sourceRoundId:valuation.roundId||null,sourceAnsweredInRound:valuation.answeredInRound||null}:{};
    const twapFields=sourceFamily==='historical-onchain-velodrome-twap-chainlink-at-boundary'?{quoteToken:valuation.quoteToken||null,quoteTokenSymbol:valuation.quoteTokenSymbol||null,quoteAmountOutRaw:valuation.quoteAmountOutRaw||null,quoteTokenAmount:finite(valuation.quoteTokenAmount)?round(valuation.quoteTokenAmount,12):null,twapGranularity:Number(valuation.twapGranularity),observationLength:Number(valuation.observationLength),poolStable:valuation.poolStable===true,quoteChainlinkContract:valuation.quoteChainlinkContract||null,quoteRoundId:valuation.quoteRoundId||null,quoteAnsweredInRound:valuation.quoteAnsweredInRound||null,quoteObservedAt:valuation.quoteObservedAt||null,quotePriceUsd:finite(valuation.quotePriceUsd)?round(valuation.quotePriceUsd,12):null}:{};
    const slipstreamFields=sourceFamily==='historical-onchain-slipstream-twap-chainlink-at-boundary'?{poolToken0:valuation.poolToken0||null,poolToken1:valuation.poolToken1||null,quoteToken:valuation.quoteToken||null,quoteTokenSymbol:valuation.quoteTokenSymbol||null,quoteTokenAmount:finite(valuation.quoteTokenAmount)?round(valuation.quoteTokenAmount,12):null,twapSeconds:Number(valuation.twapSeconds),averageTick:Number(valuation.averageTick),quoteChainlinkContract:valuation.quoteChainlinkContract||null,quoteRoundId:valuation.quoteRoundId||null,quoteAnsweredInRound:valuation.quoteAnsweredInRound||null,quoteObservedAt:valuation.quoteObservedAt||null,quotePriceUsd:finite(valuation.quotePriceUsd)?round(valuation.quotePriceUsd,12):null}:{};
    const resolution={version:HISTORICAL_VALUATION_RESOLUTION_VERSION,resolvesUsdValue:true,resolvedUsdValue,valuationUnitUsd:round(price,12),boundaryAt,observedAt:valuation.observedAt,sourceFile:valuation.sourceFile||null,sourceCommit:valuation.commitSha||null,sourceAssetId:valuation.assetId||null,sourceStatus:valuation.status||'historical-canonical-market-price',snapshotAgeMinutes:finite(valuation.ageMinutes)?round(valuation.ageMinutes,6):null,sourceFamily,...onchainCommon,...chainlinkFields,...twapFields,...slipstreamFields,identityBound:true,identityToken:identity.token,identityOpenBlock:identity.openBlock,identityCloseBlock:identity.closeBlock,eventTokenMatchesIdentity:identity.eventTokenMatchesIdentity===true,identitySource:'ve33-eventKey+sourceIdentity',originalUsdValue:null,economicFieldsMutated:false,referenceAprUsed:false,currentPriceUsed:false,unknownIsNotZero:true,executionAuthority:'none'};
"""
s = replace_once(s, ledger_anchor, ledger_insert, 'retain Slipstream provenance in canonical valuation resolution')
s = replace_once(
    s,
    "source:'canonical Market Data Git history, exact historical onchain Chainlink, or exact-block Velodrome TWAP plus Chainlink quote at original accounting boundary'",
    "source:'canonical Market Data Git history, exact historical onchain Chainlink, exact-block Velodrome TWAP plus Chainlink quote, or exact-block Slipstream TWAP plus Chainlink quote at original accounting boundary'",
    'document Slipstream canonical source',
)
p.write_text(s)

# 4) Owner-facing canonical earned-income view: accept only fully proven Slipstream metadata.
p, s = edit('reporting/canonical-earned-income-view.mjs')
s = replace_once(
    s,
    "  'historical-onchain-chainlink-at-boundary',\n  'historical-onchain-velodrome-twap-chainlink-at-boundary'\n",
    "  'historical-onchain-chainlink-at-boundary',\n  'historical-onchain-velodrome-twap-chainlink-at-boundary',\n  'historical-onchain-slipstream-twap-chainlink-at-boundary'\n",
    'allow Slipstream source family in canonical view',
)
view_anchor = """    const derived = round(Number(resolution.quoteTokenAmount) * Number(resolution.quotePriceUsd), 12);
    if (!finite(derived) || Math.abs(Number(derived) - Number(resolution.valuationUnitUsd)) > 0.00000002) return false;
    return true;
  }

  return false;
}

function resolvedUsdValue(event) {
"""
view_insert = """    const derived = round(Number(resolution.quoteTokenAmount) * Number(resolution.quotePriceUsd), 12);
    if (!finite(derived) || Math.abs(Number(derived) - Number(resolution.valuationUnitUsd)) > 0.00000002) return false;
    return true;
  }

  if (family === 'historical-onchain-slipstream-twap-chainlink-at-boundary') {
    if (
      resolution?.sourceStatus !== 'historical-onchain-slipstream-twap-chainlink-price' ||
      !/^0x[0-9a-f]{40}$/i.test(String(resolution?.poolToken0 || '')) ||
      !/^0x[0-9a-f]{40}$/i.test(String(resolution?.poolToken1 || '')) ||
      !/^0x[0-9a-f]{40}$/i.test(String(resolution?.quoteToken || '')) ||
      !/^0x[0-9a-f]{40}$/i.test(String(resolution?.quoteChainlinkContract || '')) ||
      !/^\\d+$/.test(String(resolution?.quoteRoundId || '')) ||
      !/^\\d+$/.test(String(resolution?.quoteAnsweredInRound || '')) ||
      !Number.isSafeInteger(Number(resolution?.twapSeconds)) || Number(resolution.twapSeconds) <= 0 ||
      !Number.isSafeInteger(Number(resolution?.averageTick)) ||
      resolution?.stablecoinPegAssumptionUsed !== false ||
      !finite(resolution?.quoteTokenAmount) || Number(resolution.quoteTokenAmount) <= 0 ||
      !finite(resolution?.quotePriceUsd) || Number(resolution.quotePriceUsd) <= 0
    ) return false;
    const quoteObservedMs = Date.parse(resolution?.quoteObservedAt || '');
    if (!Number.isFinite(quoteObservedMs) || quoteObservedMs !== observedMs || quoteObservedMs > blockMs) return false;
    try {
      if (BigInt(resolution.quoteRoundId) <= 0n || BigInt(resolution.quoteAnsweredInRound) < BigInt(resolution.quoteRoundId)) return false;
    } catch { return false; }
    const derived = round(Number(resolution.quoteTokenAmount) * Number(resolution.quotePriceUsd), 12);
    if (!finite(derived) || Math.abs(Number(derived) - Number(resolution.valuationUnitUsd)) > 0.00000002) return false;
    return true;
  }

  return false;
}

function resolvedUsdValue(event) {
"""
s = replace_once(s, view_anchor, view_insert, 'validate Slipstream canonical valuation')
if "exactHistoricalOnchainVelodromeTwapChainlinkResolutionAllowed: true," in s:
    s = s.replace(
        "exactHistoricalOnchainVelodromeTwapChainlinkResolutionAllowed: true,",
        "exactHistoricalOnchainVelodromeTwapChainlinkResolutionAllowed: true,\n      exactHistoricalOnchainSlipstreamTwapChainlinkResolutionAllowed: true,",
        1,
    )
p.write_text(s)

# 5) Extend existing deterministic validation with real September-shaped SNX/LAPTOP acceptance fixtures.
p, s = edit('reporting/historical-canonical-price-validation.mjs')
s = replace_once(
    s,
    "  VERSION,HISTORICAL_TOKEN_ASSET_IDS,HISTORICAL_OPTIMISM_CHAINLINK_TOKEN_FEEDS,HISTORICAL_BASE_CHAINLINK_TOKEN_FEEDS,HISTORICAL_OPTIMISM_VELODROME_TWAP_TOKEN_ROUTES,\n  canonicalAssetIdForHistoricalToken,historicalOptimismChainlinkRouteForToken,historicalBaseChainlinkRouteForToken,historicalChainlinkRouteForToken,historicalOptimismVelodromeTwapRouteForToken,closingBlockFromVe33Identity,",
    "  VERSION,HISTORICAL_TOKEN_ASSET_IDS,HISTORICAL_OPTIMISM_CHAINLINK_TOKEN_FEEDS,HISTORICAL_BASE_CHAINLINK_TOKEN_FEEDS,HISTORICAL_BASE_SLIPSTREAM_TWAP_TOKEN_ROUTES,HISTORICAL_OPTIMISM_VELODROME_TWAP_TOKEN_ROUTES,\n  canonicalAssetIdForHistoricalToken,historicalOptimismChainlinkRouteForToken,historicalBaseChainlinkRouteForToken,historicalChainlinkRouteForToken,historicalOptimismVelodromeTwapRouteForToken,historicalBaseSlipstreamTwapRouteForToken,closingBlockFromVe33Identity,",
    'import new historical routes in validation',
)
s = replace_once(s, "assert.equal(Object.keys(HISTORICAL_OPTIMISM_CHAINLINK_TOKEN_FEEDS).length,4);", "assert.equal(Object.keys(HISTORICAL_OPTIMISM_CHAINLINK_TOKEN_FEEDS).length,5);", 'expect SNX Chainlink route')
s = replace_once(s, "assert.equal(Object.keys(HISTORICAL_BASE_CHAINLINK_TOKEN_FEEDS).length,1);", "assert.equal(Object.keys(HISTORICAL_BASE_CHAINLINK_TOKEN_FEEDS).length,1);\nassert.equal(Object.keys(HISTORICAL_BASE_SLIPSTREAM_TWAP_TOKEN_ROUTES).length,1);", 'expect LAPTOP Slipstream route')
route_test_anchor = """assert.equal(historicalChainlinkRouteForToken(baseUsdcToken,8453)?.contract.toLowerCase(),baseUsdcRoute.contract.toLowerCase());
assert.equal(historicalChainlinkRouteForToken(baseUsdcToken,10),null,'Base USDC proof must not cross chain identity');
"""
route_test_insert = route_test_anchor + """const snxToken='0x8700dAec35aF8Ff88c16BdF0418774CB3D7599B4';
const snxRoute=historicalOptimismChainlinkRouteForToken(snxToken);
assert.equal(snxRoute?.assetId,'synthetix-network-token');
assert.equal(snxRoute?.chainId,10);
assert.equal(snxRoute?.contract.toLowerCase(),'0x2fcf37343e916eaed1f1ddaaf84458a359b53877');
assert.equal(snxRoute?.maxAgeSeconds,1200);
const laptopToken='0xB095274743941e953c746F9C228DA9c18Bb6ec29';
const laptopRoute=historicalBaseSlipstreamTwapRouteForToken(laptopToken);
assert.equal(laptopRoute?.assetId,'laptop');
assert.equal(laptopRoute?.chainId,8453);
assert.equal(laptopRoute?.pool.toLowerCase(),'0x99cf3e8bfb02c300312c53aac5d0b082e3d5975c');
assert.equal(laptopRoute?.quoteToken.toLowerCase(),baseUsdcToken.toLowerCase());
assert.equal(laptopRoute?.quoteChainlinkFeed.toLowerCase(),baseUsdcRoute.contract.toLowerCase());
assert.equal(laptopRoute?.twapSeconds,300);
"""
s = replace_once(s, route_test_anchor, route_test_insert, 'validate SNX and LAPTOP route registry')

rpc_anchor = "const historicalUsdc=await historicalCanonicalPriceAtBoundary({token:usdcToken,boundaryAt:boundary,eventKey:`ve33:synthetic:${openingBlock}:${closingBlock}`,onchainRegistry:registry,rpcCall:exactHistoricalRpc()});\n"
rpc_insert = """const laptopClosingBlock=51109971,laptopOpeningBlock=50715726,laptopBoundary='2026-09-10T03:01:29.000Z',laptopBoundarySeconds=Math.floor(Date.parse(laptopBoundary)/1000),laptopBlockTag=`0x${BigInt(laptopClosingBlock).toString(16)}`;
const snxClosingBlock=156807818,snxOpeningBlock=156311011,snxBoundary='2026-09-12T12:00:13.000Z',snxBoundarySeconds=Math.floor(Date.parse(snxBoundary)/1000),snxBlockTag=`0x${BigInt(snxClosingBlock).toString(16)}`;
const slipstreamIface=new Interface(['function token0() view returns (address)','function token1() view returns (address)','function observe(uint32[]) view returns (int56[] tickCumulatives,uint160[] secondsPerLiquidityCumulativeX128s)']);
function exactLaptopHistoricalRpc({avgTick=275745,usdcAnswer=99990000n,updatedAt=BigInt(laptopBoundarySeconds-240)}={}){
  return async({endpoint,method,params})=>{
    assert.equal(endpoint.id,'test-base');
    if(method==='eth_getBlockByNumber'){assert.equal(params[0],laptopBlockTag);return{number:laptopBlockTag,timestamp:`0x${BigInt(laptopBoundarySeconds).toString(16)}`};}
    if(method!=='eth_call')throw new Error(`unexpected LAPTOP RPC method ${method}`);
    assert.equal(params[1],laptopBlockTag,'LAPTOP historical call escaped exact ve33 closing block');
    const to=String(params[0]?.to||'').toLowerCase(),data=String(params[0]?.data||'').toLowerCase();
    if(to===laptopRoute.pool.toLowerCase()){
      if(data==='0x0dfe1681')return slipstreamIface.encodeFunctionResult('token0',[baseUsdcToken]);
      if(data==='0xd21220a7')return slipstreamIface.encodeFunctionResult('token1',[laptopToken]);
      if(data.startsWith('0x883bdbfd'))return slipstreamIface.encodeFunctionResult('observe',[[0n,BigInt(avgTick)*300n],[0n,0n]]);
    }
    if(to===baseUsdcRoute.contract.toLowerCase()){
      if(data==='0x313ce567')return`0x${abiWord(8)}`;
      if(data==='0xfeaf968c')return encodeRoundData({roundId:88n,answer:usdcAnswer,startedAt:updatedAt-60n,updatedAt,answeredInRound:88n});
    }
    throw new Error(`unexpected LAPTOP historical eth_call ${to} ${data}`);
  };
}
function exactSnxHistoricalRpc({answer=123456789n,updatedAt=BigInt(snxBoundarySeconds-300)}={}){
  return async({endpoint,method,params})=>{
    assert.equal(endpoint.id,'test-optimism');
    if(method==='eth_getBlockByNumber'){assert.equal(params[0],snxBlockTag);return{number:snxBlockTag,timestamp:`0x${BigInt(snxBoundarySeconds).toString(16)}`};}
    if(method!=='eth_call')throw new Error(`unexpected SNX RPC method ${method}`);
    assert.equal(params[1],snxBlockTag,'SNX historical call escaped exact ve33 closing block');
    const to=String(params[0]?.to||'').toLowerCase(),data=String(params[0]?.data||'').toLowerCase();
    assert.equal(to,snxRoute.contract.toLowerCase(),'SNX proof used wrong Chainlink feed');
    if(data==='0x313ce567')return`0x${abiWord(8)}`;
    if(data==='0xfeaf968c')return encodeRoundData({roundId:99n,answer,startedAt:updatedAt-60n,updatedAt,answeredInRound:99n});
    throw new Error(`unexpected SNX historical eth_call ${to} ${data}`);
  };
}

const historicalLaptop=await historicalCanonicalPriceAtBoundary({token:laptopToken,boundaryAt:laptopBoundary,eventKey:`ve33:synthetic:${laptopOpeningBlock}:${laptopClosingBlock}`,onchainRegistry:baseRegistry,rpcCall:exactLaptopHistoricalRpc()});
assert.equal(historicalLaptop.ok,true);assert.equal(historicalLaptop.sourceFamily,'historical-onchain-slipstream-twap-chainlink-at-boundary');assert.equal(historicalLaptop.sourceBlockNumber,laptopClosingBlock);assert.equal(historicalLaptop.sourceContract.toLowerCase(),laptopRoute.pool.toLowerCase());assert.equal(historicalLaptop.twapSeconds,300);assert.equal(historicalLaptop.averageTick,275745);assert.equal(historicalLaptop.stablecoinPegAssumptionUsed,false);assert.equal(historicalLaptop.currentPriceUsed,false);assert.equal(historicalLaptop.referenceAprUsed,false);assert.ok(historicalLaptop.priceUsd>1.05&&historicalLaptop.priceUsd<1.07);
const historicalSnx=await historicalCanonicalPriceAtBoundary({token:snxToken,boundaryAt:snxBoundary,eventKey:`ve33:synthetic:${snxOpeningBlock}:${snxClosingBlock}`,onchainRegistry:registry,rpcCall:exactSnxHistoricalRpc()});
assert.equal(historicalSnx.ok,true);assert.equal(historicalSnx.sourceFamily,'historical-onchain-chainlink-at-boundary');assert.equal(historicalSnx.sourceBlockNumber,snxClosingBlock);assert.equal(historicalSnx.chainId,10);assert.equal(historicalSnx.sourceContract.toLowerCase(),snxRoute.contract.toLowerCase());assert.equal(historicalSnx.priceUsd,1.23456789);

""" + rpc_anchor
s = replace_once(s, rpc_anchor, rpc_insert, 'add exact LAPTOP/SNX resolver fixtures')

acceptance_anchor = "const msUsdEvent=ve33Fixture({token:msUsdToken,asset:'msUSD',amount:0.003,immutable:'immutable-msusd-sentinel'});\n"
acceptance_insert = """const laptopHolder='0x58603461149fc2a800a56d421e77dcbba2d83ca8',laptopReward='0x7591a0d4a21170a8bb3c02bf89f13d7757aebade';
const laptopLane=`aerodrome|0x5860...83CA8.eth|${laptopHolder}|1938|voting-reward|${laptopReward}|${laptopToken.toLowerCase()}`;
const laptopEvent={eventKey:`ve33:${laptopLane}:${laptopOpeningBlock}:${laptopClosingBlock}`,company:'0x5860...83CA8.eth',family:'accrued-entitlement',route:'aerodrome-ve',protocol:'Aerodrome',chain:'Base',chainId:8453,economicDate:'2026-09-10',periodStart:'2026-09-01T00:00:00.000Z',periodEnd:laptopBoundary,asset:'LAPTOP',token:laptopToken,amount:67.615020175016,amountRaw:'67615020175015840449',usdValue:null,valuationStatus:'unvalued-fail-closed',sourceFile:'reporting/ve33-accounting-evidence.json',sourceFamily:'ve(3,3) factual accrual evidence',sourceIdentity:`${laptopLane}|${laptopOpeningBlock}->${laptopLane}|${laptopClosingBlock}`,unknownIsNotZero:true,executionAuthority:'none',immutableEconomicFieldsHash:'immutable-real-laptop-sentinel'};
const laptopLedger=await annotateHistoricalValuationResolution({version:'0.1-canonical-income-ledger',events:[laptopEvent]},{resolver:async(args)=>historicalCanonicalPriceAtBoundary({...args,onchainRegistry:baseRegistry,rpcCall:exactLaptopHistoricalRpc()})});
assert.equal(laptopLedger.resolvedEventCount,1,'intraperiod LAPTOP event must be eligible for exact historical valuation');assert.equal(laptopLedger.unresolvedEventCount,0);const laptopResolved=laptopLedger.ledger.events[0],laptopResolution=laptopResolved.valuationResolution;assert.equal(laptopResolved.usdValue,null,'immutable event USD must stay null');assert.equal(laptopResolved.immutableEconomicFieldsHash,'immutable-real-laptop-sentinel');assert.equal(laptopResolution.sourceFamily,'historical-onchain-slipstream-twap-chainlink-at-boundary');assert.equal(laptopResolution.sourceBlockNumber,laptopClosingBlock);assert.equal(laptopResolution.twapSeconds,300);assert.equal(laptopResolution.stablecoinPegAssumptionUsed,false);assert.equal(historicalValuationSourceMatchesVe33Identity(laptopResolved,laptopResolution),true);assert.equal(recognitionDecision(laptopResolved).status,'recognized');
const snxHolder='0xefda6d86c6ea8bb80cf6456214432d45f14d06d4',snxReward='0x3ecaad2d3996df95d415d4c1c0f7587b22dbd901';
const snxLane=`velodrome|defitea.eth|${snxHolder}|32671|voting-reward|${snxReward}|${snxToken.toLowerCase()}`;
const snxEvent={eventKey:`ve33:${snxLane}:${snxOpeningBlock}:${snxClosingBlock}`,company:'defitea.eth',family:'accrued-entitlement',route:'velodrome-ve',protocol:'Velodrome',chain:'Optimism',chainId:10,economicDate:'2026-09-12',periodStart:'2026-09-01T00:00:00.000Z',periodEnd:snxBoundary,asset:'SNX',token:snxToken,amount:2.80734254553,amountRaw:'2807342545529763243',usdValue:null,valuationStatus:'unvalued-fail-closed',sourceFile:'reporting/ve33-accounting-evidence.json',sourceFamily:'ve(3,3) factual accrual evidence',sourceIdentity:`${snxLane}|${snxOpeningBlock}->${snxLane}|${snxClosingBlock}`,unknownIsNotZero:true,executionAuthority:'none',immutableEconomicFieldsHash:'immutable-real-snx-sentinel'};
const snxLedger=await annotateHistoricalValuationResolution({version:'0.1-canonical-income-ledger',events:[snxEvent]},{resolver:async(args)=>historicalCanonicalPriceAtBoundary({...args,onchainRegistry:registry,rpcCall:exactSnxHistoricalRpc()})});
assert.equal(snxLedger.resolvedEventCount,1,'intraperiod SNX event must be eligible for exact historical valuation');assert.equal(snxLedger.unresolvedEventCount,0);assert.equal(snxLedger.ledger.events[0].usdValue,null);assert.equal(snxLedger.ledger.events[0].immutableEconomicFieldsHash,'immutable-real-snx-sentinel');assert.equal(historicalValuationSourceMatchesVe33Identity(snxLedger.ledger.events[0],snxLedger.ledger.events[0].valuationResolution),true);assert.equal(recognitionDecision(snxLedger.ledger.events[0]).status,'recognized');

""" + acceptance_anchor
s = replace_once(s, acceptance_anchor, acceptance_insert, 'add intraperiod LAPTOP/SNX ledger acceptance')
s = s.replace(
    'Historical canonical + multi-chain exact-block Chainlink + Velodrome TWAP route identity binding validation OK',
    'Historical canonical + intraperiod multi-chain Chainlink + Velodrome/Slipstream TWAP identity binding validation OK',
)
p.write_text(s)

print('Intraperiod historical valuation edits staged successfully')
