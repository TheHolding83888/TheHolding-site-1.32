#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { Contract, JsonRpcProvider, formatUnits, getAddress } from 'ethers';

const ROOT=process.cwd();
const DEEP=process.env.COMPANY_010_DEEP_INPUT||path.join(ROOT,'companies/company-010-deep-resolve.json');
const STATE=process.env.COMPANY_010_PRODUCTION_OUTPUT||path.join(ROOT,'companies/company-010-production-state.json');
const MANAGER=getAddress('0xead19ae861c29bbb2101e834922b2feee69b9091');
const RPC=[...new Set([process.env.HYPEREVM_RPC_URL,'https://rpc.hyperliquid.xyz/evm'].filter(Boolean))];
const MAX_UINT128=(1n<<128n)-1n;
const MIN_ACTIVE_NAV_USD=1;
const EXPECTED_ACTIVE_NFTS=2;
const CG_KEY=process.env.COINGECKO_API_KEY||'';
const VERSION='0.1-company-010-projectx-full-parity';
const ASSET_ID='projectx-whype-usdc';
const ROUTE_ID='projectx-whype-usdc';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const finite=x=>x!==null&&x!==undefined&&x!==''&&Number.isFinite(Number(x));
const n=x=>finite(x)?Number(x):null;
const round=(x,d=8)=>finite(x)?Number(Number(x).toFixed(d)):null;
const lower=x=>String(x||'').toLowerCase();
const cleanErr=e=>String(e?.shortMessage||e?.message||e||'unknown').replace(/https?:\/\/[^\s)]+/g,'[url-redacted]');
const bigint=x=>{try{return BigInt(x??0)}catch{return 0n}};

async function getProvider(){let last;for(const url of RPC){try{const p=new JsonRpcProvider(url,999,{staticNetwork:true});if(Number((await p.getNetwork()).chainId)!==999)throw new Error('wrong chain');return p}catch(e){last=e}}throw last||new Error('HyperEVM provider unavailable')}
async function getUsdcPrice(){const q=new URLSearchParams({ids:'usd-coin',vs_currencies:'usd'});if(CG_KEY)q.set('x_cg_demo_api_key',CG_KEY);const c=new AbortController(),t=setTimeout(()=>c.abort(),15000);try{const r=await fetch(`https://api.coingecko.com/api/v3/simple/price?${q}`,{headers:{accept:'application/json','user-agent':'The-Holding-ProjectX-Full-Parity/0.1'},signal:c.signal,cache:'no-store'});if(!r.ok)throw new Error(`CoinGecko HTTP ${r.status}`);const j=await r.json(),p=n(j?.['usd-coin']?.usd);if(!(p>0.8&&p<1.2))throw new Error(`USDC price outside bounded range: ${p}`);return p}finally{clearTimeout(t)}}
function recalcCapital(s){const rows=s.capital?.positions||[];if(rows.some(x=>n(x.valueUsd)===null))throw new Error('unvalued in-scope capital row');s.capital.valuedPositionCount=rows.length;s.capital.positionCount=rows.length;s.capital.knownCapitalFloorUsd=round(rows.reduce((a,x)=>a+n(x.valueUsd),0),2);s.capital.totalCapitalUsd=s.capital.knownCapitalFloorUsd;s.capital.totalCapitalComplete=true;s.capital.knownButUnboundCapitalMayExist=false;s.capital.layerValues={foundation:0,productiveDividend:0,stableReserve:0,rwa:0,venture:0,unclassified:0};for(const x of rows){const k=x.capitalLayer||'unclassified';s.capital.layerValues[k]=round((s.capital.layerValues[k]||0)+n(x.valueUsd),2)}}
function recalcProductivity(s){const rows=s.productivity?.positions||[],valued=rows.filter(x=>n(x.valueUsd)!==null),covered=valued.filter(x=>x.status==='measured'||x.status==='supported-existing-adapter');s.productivity.knownProductiveValueUsd=round(valued.reduce((a,x)=>a+n(x.valueUsd),0),2);s.productivity.currentlyAprCoveredValueUsd=round(covered.reduce((a,x)=>a+n(x.valueUsd),0),2);s.productivity.coverage=s.productivity.knownProductiveValueUsd>0?round(s.productivity.currentlyAprCoveredValueUsd/s.productivity.knownProductiveValueUsd,6):null;s.productivity.status=s.productivity.coverage===1?'complete':'partial'}

async function main(){
  const deep=read(DEEP),state=read(STATE);
  if(deep?.version!=='0.3-company-010-deep-mechanism-resolver')throw new Error('Company #010 deep resolver v0.3 required');
  if(!['0.3-company-010-production-state-stakedao-complete','0.4-company-010-production-state-crv-strategies'].includes(String(state?.version))||state?.company?.registry!=='010'||state?.company?.name!=='Cypher')throw new Error('compatible Company #010 production state required');
  if(state?.authority?.executionAuthority!=='none'||state?.epistemicBoundary?.unknownIsNotZero!==true)throw new Error('authority/epistemic boundary mismatch');
  const px=deep?.deep?.projectX;if(!px?.ok||!px.result)throw new Error('Project X deep resolver unavailable');
  if(lower(px.result.manager)!==lower(MANAGER))throw new Error('Project X manager mismatch');
  const whype=getAddress(px.result.whype),raw=(px.result.wallets||[]).flatMap(w=>(w.positions||[]).map(pos=>({...pos,wallet:w.wallet,walletAlias:w.walletAlias})));
  if(!raw.length||Number(px.result.totalNftCount)!==raw.length)throw new Error('Project X NFT inventory mismatch');

  const hype=(state.capital?.positions||[]).find(x=>x.assetId==='hyperliquid'||x.symbol==='HYPE');
  if(!hype||!(n(hype.priceUsd)>0))throw new Error('canonical HYPE price unavailable');
  const hypePx=n(hype.priceUsd),usdcPx=await getUsdcPrice();
  const candidates=[],ignored=[];

  for(const pos of raw){
    const t0={...pos.token0,address:getAddress(pos.token0.address)},t1={...pos.token1,address:getAddress(pos.token1.address)};
    const w0=lower(t0.address)===lower(whype),w1=lower(t1.address)===lower(whype),u0=String(t0.symbol||'').toUpperCase()==='USDC',u1=String(t1.symbol||'').toUpperCase()==='USDC';
    if(Number(w0)+Number(w1)!==1||Number(u0)+Number(u1)!==1){ignored.push({tokenId:String(pos.tokenId),reason:'different-pair-or-token'});continue}
    const liq=bigint(pos.liquidity);
    if(liq<=0n){ignored.push({tokenId:String(pos.tokenId),reason:'empty-zero-liquidity'});continue}
    const p0=n(pos.principalAmount0),p1=n(pos.principalAmount1);
    if(p0===null||p1===null)throw new Error(`Project X NFT ${pos.tokenId} has nonzero liquidity but unresolved principal legs`);
    const pWhype=w0?p0:p1,pUsdc=u0?p0:p1,navUsd=pWhype*hypePx+pUsdc*usdcPx;
    if(!(navUsd>=MIN_ACTIVE_NAV_USD)){ignored.push({tokenId:String(pos.tokenId),reason:'dust-below-active-nav-floor',navUsd:round(navUsd,6)});continue}
    candidates.push({...pos,t0,t1,w0,u0,principalWhype:pWhype,principalUsdc:pUsdc,navUsd});
  }
  if(candidates.length!==EXPECTED_ACTIVE_NFTS)throw new Error(`Project X active-capital NFT count must be exactly ${EXPECTED_ACTIVE_NFTS}, got ${candidates.length}`);

  const provider=await getProvider();
  const npm=new Contract(MANAGER,['function collect((uint256 tokenId,address recipient,uint128 amount0Max,uint128 amount1Max)) payable returns(uint256 amount0,uint256 amount1)'],provider);
  const perNft=[];let whypePrincipal=0,usdcPrincipal=0,whypeClaimable=0,usdcClaimable=0,usdcAddress=null;
  for(const pos of candidates){
    const currentUsdc=getAddress(pos.u0?pos.t0.address:pos.t1.address);if(usdcAddress&&lower(usdcAddress)!==lower(currentUsdc))throw new Error('Project X USDC address changed across active NFTs');usdcAddress=currentUsdc;
    const owner=getAddress(pos.owner||pos.wallet);let collected;
    try{collected=await npm.collect.staticCall({tokenId:BigInt(pos.tokenId),recipient:owner,amount0Max:MAX_UINT128,amount1Max:MAX_UINT128},{from:owner})}catch(e){throw new Error(`Project X NFT ${pos.tokenId} collect.staticCall failed: ${cleanErr(e)}`)}
    const a0=Number(formatUnits(collected.amount0??collected[0],Number(pos.t0.decimals))),a1=Number(formatUnits(collected.amount1??collected[1],Number(pos.t1.decimals)));
    const cWhype=pos.w0?a0:a1,cUsdc=pos.u0?a0:a1;
    whypePrincipal+=pos.principalWhype;usdcPrincipal+=pos.principalUsdc;whypeClaimable+=cWhype;usdcClaimable+=cUsdc;
    perNft.push({tokenId:String(pos.tokenId),wallet:owner,walletAlias:pos.walletAlias||null,feeTier:n(pos.feeTier),tickLower:n(pos.tickLower),tickUpper:n(pos.tickUpper),liquidity:String(pos.liquidity),navUsd:round(pos.navUsd,6),principal:{WHYPE:round(pos.principalWhype,12),USDC:round(pos.principalUsdc,12)},claimable:{WHYPE:round(cWhype,12),USDC:round(cUsdc,12)},measurement:{principal:'decreaseLiquidity.staticCall full current liquidity; read-only',claimable:'collect.staticCall max uint128; read-only'}});
  }
  whypePrincipal=round(whypePrincipal,12);usdcPrincipal=round(usdcPrincipal,12);whypeClaimable=round(whypeClaimable,12);usdcClaimable=round(usdcClaimable,12);
  const priorProject=n(hype.components?.projectXPrincipal);if(priorProject===null)throw new Error('legacy Project X HYPE component missing');
  const omittedWhypeUsd=Math.abs(priorProject-whypePrincipal)*hypePx;if(omittedWhypeUsd>MIN_ACTIVE_NAV_USD)throw new Error(`excluded Project X WHYPE exceeds dust boundary: $${omittedWhypeUsd}`);

  const nativeHype=(n(hype.components?.hyperEvmNative)||0)+(n(hype.components?.hyperCoreSpot)||0);hype.quantity=round(nativeHype,12);hype.valueUsd=round(nativeHype*hypePx,2);hype.source='reviewed Company #010 closure · direct/native HYPE only; active Project X WHYPE-USDC capital is separate';hype.components={hyperEvmNative:round(n(hype.components?.hyperEvmNative)||0,12),hyperCoreSpot:round(n(hype.components?.hyperCoreSpot)||0,12),projectXSeparatedToStrategy:ASSET_ID};

  const navUsd=whypePrincipal*hypePx+usdcPrincipal*usdcPx,claimableWhypeUsd=whypeClaimable*hypePx,claimableUsdcUsd=usdcClaimable*usdcPx;
  if(!(navUsd>0))throw new Error('Project X active strategy NAV unavailable');
  state.capital.positions=(state.capital.positions||[]).filter(x=>x.assetId!==ASSET_ID);
  state.capital.positions.push({symbol:'PX-WHYPE-USDC',assetId:ASSET_ID,protocol:'Project X',chain:'HyperEVM',strategy:'WHYPE-USDC concentrated liquidity',publicLabel:'Project X · WHYPE-USDC',quantity:1,quantityMeaning:'aggregate of exactly two economically active Company #010 Project X NFTs',priceUsd:round(navUsd,8),valueUsd:round(navUsd,2),priceSource:'WHYPE canonical Company #010 price + current USDC price',capitalLayer:'productiveDividend',source:'Project X enumerable NFT state + read-only full-liquidity exit simulation',principal:{WHYPE:whypePrincipal,USDC:usdcPrincipal,nftCount:perNft.length,perNft},prices:{WHYPE:round(hypePx,8),USDC:round(usdcPx,8)},ignoredNfts:ignored,admission:{activeNavFloorUsd:MIN_ACTIVE_NAV_USD,expectedActiveNftCount:EXPECTED_ACTIVE_NFTS},capitalRule:'Count active Project X strategy NAV once. Empty/dust/other-pair NFTs are excluded from this strategy. WHYPE principal is not additive HYPE capital.'});
  recalcCapital(state);

  state.productivity.positions=(state.productivity.positions||[]).filter(x=>!['projectx_hype',ASSET_ID].includes(x.id));
  state.productivity.positions.push({id:ASSET_ID,label:'Project X · WHYPE-USDC',quantity:1,valueUsd:round(navUsd,2),referenceAprPct:null,status:'warming',source:'two active Project X WHYPE-USDC NFTs',referenceMetric:null,incomeMode:'separate-claimable-fees',claimableApplicable:true,methodology:'Fee tier is not yield. APR stays Pending until a reproducible first-party yield time series is bound.'});
  recalcProductivity(state);

  state.rewards=state.rewards||{};state.rewards.supportedRoutes=(state.rewards.supportedRoutes||[]).filter(x=>x.id!==ROUTE_ID);state.rewards.supportedRoutes.push({id:ROUTE_ID,protocol:'Project X',chain:'HyperEVM',walletAlias:'active Company #010 Project X NFTs only',claimableState:'measured'});
  state.rewards.observations=(state.rewards.observations||[]).filter(x=>x.route!==ROUTE_ID);
  state.rewards.observations.push({id:'projectx-whype-claimable',route:ROUTE_ID,protocol:'Project X',chain:'HyperEVM',token:'WHYPE',tokenAddress:whype,claimable:whypeClaimable,usdValue:round(claimableWhypeUsd,6),priceUsd:round(hypePx,8),status:'measured',source:'collect.staticCall across exactly two active WHYPE-USDC NFTs',method:'read-only; no signature or transaction'});
  state.rewards.observations.push({id:'projectx-usdc-claimable',route:ROUTE_ID,protocol:'Project X',chain:'HyperEVM',token:'USDC',tokenAddress:usdcAddress,claimable:usdcClaimable,usdValue:round(claimableUsdcUsd,6),priceUsd:round(usdcPx,8),status:'measured',source:'collect.staticCall across exactly two active WHYPE-USDC NFTs',method:'read-only; no signature or transaction'});
  state.rewards.unboundMechanisms=(state.rewards.unboundMechanisms||[]).filter(x=>!/^Project X/i.test(String(x)));

  state.strategies=state.strategies||{};state.strategies.projectX={version:VERSION,generatedAt:new Date().toISOString(),status:'measured-principal-and-claimable',id:ASSET_ID,protocol:'Project X',chain:'HyperEVM',pair:'WHYPE-USDC',manager:MANAGER,nftCount:perNft.length,positions:perNft,ignoredNfts:ignored,admission:{activeNavFloorUsd:MIN_ACTIVE_NAV_USD,expectedActiveNftCount:EXPECTED_ACTIVE_NFTS,actualActiveNftCount:perNft.length},principal:{WHYPE:whypePrincipal,USDC:usdcPrincipal,navUsd:round(navUsd,2),prices:{WHYPE:round(hypePx,8),USDC:round(usdcPx,8)}},rewards:{route:ROUTE_ID,publicStatus:'Unclaimed',claimableApplicable:true,measurementStatus:'measured',tokens:[{symbol:'WHYPE',address:whype,amount:whypeClaimable,priceUsd:round(hypePx,8),usdValue:round(claimableWhypeUsd,6)},{symbol:'USDC',address:usdcAddress,amount:usdcClaimable,priceUsd:round(usdcPx,8),usdValue:round(claimableUsdcUsd,6)}],totalUsd:round(claimableWhypeUsd+claimableUsdcUsd,6),source:'collect.staticCall across exactly two active NFTs'},yield:{status:'warming',referenceAprPct:null,publicStatus:'APR Pending',reason:'Fee tier is not yield; no reproducible first-party Project X Reference APR time series has been proven.'},accountingBoundary:{multiLegPrincipalComplete:true,activeNftCountExactlyTwo:true,dustAndEmptyNftsExcluded:true,otherPairNftsExcluded:true,whypeRemovedFromGeneralHype:true,usdcIncludedInStrategyNav:true,strategyNavCountedOnce:true,claimableFeesExcludedFromCapital:true,noDoubleCount:true},authority:{readOnly:true,walletSigning:false,transactions:false,executionAuthority:'none'}};

  state.gaps=(state.gaps||[]).filter(x=>x.id!=='project-x-reference-apr');state.gaps.push({id:'project-x-reference-apr',severity:'productivity',status:'warming',meaning:'Two active Project X WHYPE-USDC NFTs have complete principal and claimable-fee measurement; Reference APR remains Pending.'});
  state.provenance=state.provenance||{};state.provenance.projectX={version:VERSION,deepResolverVersion:deep.version,deepGeneratedAt:deep.generatedAt||null,manager:MANAGER,principalMethod:'existing decreaseLiquidity.staticCall reader reused',claimableMethod:'collect.staticCall max uint128',admissionMethod:'exact WHYPE-USDC pair + zero-liquidity exclusion + current strategy NAV >= $1; exactly two active NFTs required; nonzero-liquidity missing principal fails closed'};
  state.epistemicBoundary=state.epistemicBoundary||{};Object.assign(state.epistemicBoundary,{projectXMultiLegPromotionComplete:true,projectXOnlyEconomicallyActiveNfts:true,projectXActiveNftCountExactlyTwo:true,projectXDustAndEmptyNftsExcluded:true,projectXOtherPairsExcluded:true,projectXNonzeroLiquidityRequiresMeasuredPrincipal:true,projectXWhypeIsNotAdditiveHype:true,projectXUsdcIsPartOfStrategyNav:true,projectXClaimableFeesAreNotPrincipal:true,projectXFeeTierIsNotApr:true,multiLegResolvedMustPromoteAllEconomicLegs:true});
  state.generatedAt=new Date().toISOString();fs.writeFileSync(STATE,JSON.stringify(state,null,2)+'\n');
  console.log(JSON.stringify({status:'PASS',version:VERSION,activeNftCount:perNft.length,ignoredNftCount:ignored.length,activeTokenIds:perNft.map(x=>x.tokenId),principal:{WHYPE:whypePrincipal,USDC:usdcPrincipal,navUsd:round(navUsd,2)},claimable:{WHYPE:whypeClaimable,USDC:usdcClaimable,usd:round(claimableWhypeUsd+claimableUsdcUsd,6)},omittedLegacyWhypeUsd:round(omittedWhypeUsd,6),companyTotalCapitalUsd:state.capital.totalCapitalUsd,referenceApr:'Pending',executionAuthority:'none'},null,2));
}
main().catch(e=>{console.error(e?.stack||e);process.exit(1)});
