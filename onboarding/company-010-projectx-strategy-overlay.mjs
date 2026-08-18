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
const CG_KEY=process.env.COINGECKO_API_KEY||'';
const VERSION='0.1-company-010-projectx-full-parity';
const ASSET_ID='projectx-whype-usdc';
const ROUTE_ID='projectx-whype-usdc';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const finite=x=>x!==null&&x!==undefined&&x!==''&&Number.isFinite(Number(x));
const n=x=>finite(x)?Number(x):null;
const round=(x,d=8)=>finite(x)?Number(Number(x).toFixed(d)):null;
const lower=x=>String(x||'').toLowerCase();
const err=e=>String(e?.shortMessage||e?.message||e||'unknown').replace(/https?:\/\/[^\s)]+/g,'[url-redacted]');

async function provider(){let last;for(const url of RPC){try{const p=new JsonRpcProvider(url,999,{staticNetwork:true});if(Number((await p.getNetwork()).chainId)!==999)throw new Error('wrong chain');return p}catch(e){last=e}}throw last||new Error('HyperEVM provider unavailable')}
async function usdcPrice(){const q=new URLSearchParams({ids:'usd-coin',vs_currencies:'usd'});if(CG_KEY)q.set('x_cg_demo_api_key',CG_KEY);const c=new AbortController(),t=setTimeout(()=>c.abort(),15000);try{const r=await fetch(`https://api.coingecko.com/api/v3/simple/price?${q}`,{headers:{accept:'application/json','user-agent':'The-Holding-ProjectX-Full-Parity/0.1'},signal:c.signal,cache:'no-store'});if(!r.ok)throw new Error(`CoinGecko HTTP ${r.status}`);const j=await r.json();const p=n(j?.['usd-coin']?.usd);if(!(p>0.8&&p<1.2))throw new Error(`USDC price outside bounded range: ${p}`);return p}finally{clearTimeout(t)}}
function recalcCapital(state){const valued=(state.capital?.positions||[]).filter(x=>n(x.valueUsd)!==null);if(valued.length!==(state.capital?.positions||[]).length)throw new Error('Project X promotion would leave an unvalued in-scope capital row');state.capital.valuedPositionCount=valued.length;state.capital.positionCount=valued.length;state.capital.knownCapitalFloorUsd=round(valued.reduce((s,x)=>s+n(x.valueUsd),0),2);state.capital.totalCapitalUsd=state.capital.knownCapitalFloorUsd;state.capital.totalCapitalComplete=true;state.capital.knownButUnboundCapitalMayExist=false;state.capital.layerValues={foundation:0,productiveDividend:0,stableReserve:0,rwa:0,venture:0,unclassified:0};for(const x of valued){const layer=x.capitalLayer||'unclassified';state.capital.layerValues[layer]=round((state.capital.layerValues[layer]||0)+n(x.valueUsd),2)}}
function recalcProductivity(state){const rows=state.productivity?.positions||[];const valued=rows.filter(x=>n(x.valueUsd)!==null);const covered=valued.filter(x=>x.status==='measured'||x.status==='supported-existing-adapter');state.productivity.knownProductiveValueUsd=round(valued.reduce((s,x)=>s+n(x.valueUsd),0),2);state.productivity.currentlyAprCoveredValueUsd=round(covered.reduce((s,x)=>s+n(x.valueUsd),0),2);state.productivity.coverage=state.productivity.knownProductiveValueUsd>0?round(state.productivity.currentlyAprCoveredValueUsd/state.productivity.knownProductiveValueUsd,6):null;state.productivity.status=state.productivity.coverage===1?'complete':'partial'}

async function main(){
  const deep=read(DEEP),state=read(STATE);
  if(deep?.version!=='0.3-company-010-deep-mechanism-resolver')throw new Error(`Company #010 deep resolver v0.3 required, got ${deep?.version}`);
  if(!['0.3-company-010-production-state-stakedao-complete','0.4-company-010-production-state-crv-strategies'].includes(String(state?.version))||state?.company?.registry!=='010'||state?.company?.name!=='Cypher')throw new Error('compatible Company #010 production state required');
  if(state?.authority?.executionAuthority!=='none'||state?.epistemicBoundary?.unknownIsNotZero!==true)throw new Error('Company #010 authority/epistemic boundary mismatch');
  const px=deep?.deep?.projectX;
  if(!px?.ok||!px.result)throw new Error('Project X deep resolver result unavailable');
  if(lower(px.result.manager)!==lower(MANAGER))throw new Error('Project X manager binding mismatch');
  const whype=getAddress(px.result.whype);
  const wallets=Array.isArray(px.result.wallets)?px.result.wallets:[];
  const rawPositions=wallets.flatMap(w=>(w.positions||[]).map(pos=>({...pos,wallet:w.wallet,walletAlias:w.walletAlias})));
  if(!rawPositions.length)throw new Error('Project X has no current NFT positions');
  if(Number(px.result.totalNftCount)!==rawPositions.length)throw new Error('Project X NFT count mismatch');

  const p=await provider();
  const npm=new Contract(MANAGER,['function collect((uint256 tokenId,address recipient,uint128 amount0Max,uint128 amount1Max)) payable returns(uint256 amount0,uint256 amount1)'],p);
  const perNft=[];let whypePrincipal=0,usdcPrincipal=0,whypeClaimable=0,usdcClaimable=0;let usdcAddress=null;
  for(const pos of rawPositions){
    const t0={...pos.token0,address:getAddress(pos.token0.address)},t1={...pos.token1,address:getAddress(pos.token1.address)};
    const isWhype0=lower(t0.address)===lower(whype),isWhype1=lower(t1.address)===lower(whype);
    const isUsdc0=String(t0.symbol||'').toUpperCase()==='USDC',isUsdc1=String(t1.symbol||'').toUpperCase()==='USDC';
    if(Number(isWhype0)+Number(isWhype1)!==1||Number(isUsdc0)+Number(isUsdc1)!==1)throw new Error(`Project X NFT ${pos.tokenId} is not exact WHYPE-USDC pair`);
    const currentUsdc=getAddress(isUsdc0?t0.address:t1.address);if(usdcAddress&&lower(usdcAddress)!==lower(currentUsdc))throw new Error('Project X USDC token address changed across NFTs');usdcAddress=currentUsdc;
    const principal0=n(pos.principalAmount0),principal1=n(pos.principalAmount1);if(principal0===null||principal1===null)throw new Error(`Project X NFT ${pos.tokenId} principal leg missing`);
    const owner=getAddress(pos.owner||pos.wallet);
    let collected;
    try{collected=await npm.collect.staticCall({tokenId:BigInt(pos.tokenId),recipient:owner,amount0Max:MAX_UINT128,amount1Max:MAX_UINT128},{from:owner})}catch(e){throw new Error(`Project X NFT ${pos.tokenId} collect.staticCall failed: ${err(e)}`)}
    const amount0=Number(formatUnits(collected.amount0??collected[0],Number(t0.decimals))),amount1=Number(formatUnits(collected.amount1??collected[1],Number(t1.decimals)));
    const principalWhype=isWhype0?principal0:principal1,principalUsdc=isUsdc0?principal0:principal1;
    const claimableWhype=isWhype0?amount0:amount1,claimableUsdc=isUsdc0?amount0:amount1;
    whypePrincipal+=principalWhype;usdcPrincipal+=principalUsdc;whypeClaimable+=claimableWhype;usdcClaimable+=claimableUsdc;
    perNft.push({tokenId:String(pos.tokenId),wallet:owner,walletAlias:pos.walletAlias||null,feeTier:n(pos.feeTier),tickLower:n(pos.tickLower),tickUpper:n(pos.tickUpper),liquidity:String(pos.liquidity),principal:{WHYPE:round(principalWhype,12),USDC:round(principalUsdc,12)},claimable:{WHYPE:round(claimableWhype,12),USDC:round(claimableUsdc,12)},diagnostics:{tokensOwed0:n(pos.tokensOwed0),tokensOwed1:n(pos.tokensOwed1)},measurement:{principal:'decreaseLiquidity.staticCall full current liquidity; read-only',claimable:'collect.staticCall max uint128 from current NFT owner; read-only and includes current fee-growth update'}});
  }
  whypePrincipal=round(whypePrincipal,12);usdcPrincipal=round(usdcPrincipal,12);whypeClaimable=round(whypeClaimable,12);usdcClaimable=round(usdcClaimable,12);
  if(!(whypePrincipal>=0&&usdcPrincipal>0))throw new Error('Project X principal legs not both promoted');

  const hype=(state.capital?.positions||[]).find(x=>x.assetId==='hyperliquid'||x.symbol==='HYPE');
  if(!hype||!(n(hype.priceUsd)>0))throw new Error('canonical HYPE price unavailable');
  const priorProject=n(hype.components?.projectXPrincipal);if(priorProject===null||Math.abs(priorProject-whypePrincipal)>Math.max(1e-7,Math.abs(whypePrincipal)*1e-6))throw new Error(`Project X WHYPE principal does not match legacy HYPE component: ${priorProject} vs ${whypePrincipal}`);
  const nativeHype=(n(hype.components?.hyperEvmNative)||0)+(n(hype.components?.hyperCoreSpot)||0);hype.quantity=round(nativeHype,12);hype.valueUsd=round(nativeHype*n(hype.priceUsd),2);hype.source='reviewed Company #010 closure · direct/native HYPE only; Project X WHYPE-USDC is accounted as a separate strategy position';hype.components={hyperEvmNative:round(n(hype.components?.hyperEvmNative)||0,12),hyperCoreSpot:round(n(hype.components?.hyperCoreSpot)||0,12),projectXSeparatedToStrategy:ASSET_ID};

  const usdcPx=await usdcPrice(),hypePx=n(hype.priceUsd);
  const navUsd=whypePrincipal*hypePx+usdcPrincipal*usdcPx;
  const claimableWhypeUsd=whypeClaimable*hypePx,claimableUsdcUsd=usdcClaimable*usdcPx;
  if(!(navUsd>0))throw new Error('Project X strategy NAV unavailable');

  state.capital.positions=(state.capital.positions||[]).filter(x=>x.assetId!==ASSET_ID);
  state.capital.positions.push({symbol:'PX-WHYPE-USDC',assetId:ASSET_ID,protocol:'Project X',chain:'HyperEVM',strategy:'WHYPE-USDC concentrated liquidity',publicLabel:'Project X · WHYPE-USDC',quantity:1,quantityMeaning:'one aggregate current Project X strategy book across all Company #010 NFTs',priceUsd:round(navUsd,8),valueUsd:round(navUsd,2),priceSource:'WHYPE uses canonical Company #010 HYPE current price; USDC uses CoinGecko usd-coin current price',capitalLayer:'productiveDividend',source:'Project X enumerable NonfungiblePositionManager + read-only full-liquidity exit simulation',principal:{WHYPE:whypePrincipal,USDC:usdcPrincipal,nftCount:perNft.length,perNft},prices:{WHYPE:round(hypePx,8),USDC:round(usdcPx,8)},capitalRule:'Count aggregate Project X strategy NAV once. WHYPE principal is not additive HYPE capital and USDC principal is not added as a separate reserve balance.'});
  recalcCapital(state);

  state.productivity.positions=(state.productivity.positions||[]).filter(x=>!['projectx_hype',ASSET_ID].includes(x.id));
  state.productivity.positions.push({id:ASSET_ID,label:'Project X · WHYPE-USDC',quantity:1,valueUsd:round(navUsd,2),referenceAprPct:null,status:'warming',source:'Project X current WHYPE-USDC strategy NAV from canonical onchain NFT state',referenceMetric:null,incomeMode:'separate-claimable-fees',claimableApplicable:true,methodology:'Pool fee tier is not yield. Reference APR remains Pending until a reproducible first-party Project X yield time series is independently bound.'});
  recalcProductivity(state);

  state.rewards=state.rewards||{};state.rewards.supportedRoutes=Array.isArray(state.rewards.supportedRoutes)?state.rewards.supportedRoutes:[];
  state.rewards.supportedRoutes=state.rewards.supportedRoutes.filter(x=>x.id!==ROUTE_ID);state.rewards.supportedRoutes.push({id:ROUTE_ID,protocol:'Project X',chain:'HyperEVM',walletAlias:'Both canonical Company #010 wallets',claimableState:'measured'});
  state.rewards.observations=(state.rewards.observations||[]).filter(x=>x.route!==ROUTE_ID);
  state.rewards.observations.push({id:'projectx-whype-claimable',route:ROUTE_ID,protocol:'Project X',chain:'HyperEVM',token:'WHYPE',tokenAddress:whype,claimable:whypeClaimable,usdValue:round(claimableWhypeUsd,6),priceUsd:round(hypePx,8),status:'measured',source:'Project X NonfungiblePositionManager collect.staticCall max uint128 across current Company #010 NFTs',method:'read-only collect simulation; no signature, transaction or state mutation'});
  state.rewards.observations.push({id:'projectx-usdc-claimable',route:ROUTE_ID,protocol:'Project X',chain:'HyperEVM',token:'USDC',tokenAddress:usdcAddress,claimable:usdcClaimable,usdValue:round(claimableUsdcUsd,6),priceUsd:round(usdcPx,8),status:'measured',source:'Project X NonfungiblePositionManager collect.staticCall max uint128 across current Company #010 NFTs',method:'read-only collect simulation; no signature, transaction or state mutation'});
  state.rewards.unboundMechanisms=(state.rewards.unboundMechanisms||[]).filter(x=>!/^Project X/i.test(String(x)));

  state.strategies=state.strategies||{};state.strategies.projectX={version:VERSION,generatedAt:new Date().toISOString(),status:'measured-principal-and-claimable',id:ASSET_ID,protocol:'Project X',chain:'HyperEVM',pair:'WHYPE-USDC',manager:MANAGER,nftCount:perNft.length,principal:{WHYPE:whypePrincipal,USDC:usdcPrincipal,navUsd:round(navUsd,2),prices:{WHYPE:round(hypePx,8),USDC:round(usdcPx,8)}},positions:perNft,rewards:{route:ROUTE_ID,publicStatus:'Unclaimed',claimableApplicable:true,measurementStatus:'measured',tokens:[{symbol:'WHYPE',address:whype,amount:whypeClaimable,priceUsd:round(hypePx,8),usdValue:round(claimableWhypeUsd,6)},{symbol:'USDC',address:usdcAddress,amount:usdcClaimable,priceUsd:round(usdcPx,8),usdValue:round(claimableUsdcUsd,6)}],totalUsd:round(claimableWhypeUsd+claimableUsdcUsd,6),source:'Project X NonfungiblePositionManager collect.staticCall with current fee-growth update'},yield:{status:'warming',referenceAprPct:null,publicStatus:'APR Pending',reason:'Fee tier is not yield; no reproducible first-party Project X Reference APR time series has been proven.'},accountingBoundary:{multiLegPrincipalComplete:true,whypeRemovedFromGeneralHype:true,usdcIncludedInStrategyNav:true,strategyNavCountedOnce:true,claimableFeesExcludedFromCapital:true,noDoubleCount:true},authority:{readOnly:true,walletSigning:false,transactions:false,executionAuthority:'none'}};

  state.gaps=(state.gaps||[]).filter(x=>x.id!=='project-x-reference-apr');state.gaps.push({id:'project-x-reference-apr',severity:'productivity',status:'warming',meaning:'Project X WHYPE-USDC principal and both claimable fee legs are measured; Reference APR remains Pending until a reproducible first-party yield time series is proven.'});
  state.provenance=state.provenance||{};state.provenance.projectX={version:VERSION,deepResolverVersion:deep.version,deepGeneratedAt:deep.generatedAt||null,manager:MANAGER,principalMethod:'existing decreaseLiquidity.staticCall reader reused',claimableMethod:'collect.staticCall max uint128 added as bounded promotion proof'};
  state.epistemicBoundary=state.epistemicBoundary||{};Object.assign(state.epistemicBoundary,{projectXMultiLegPromotionComplete:true,projectXWhypeIsNotAdditiveHype:true,projectXUsdcIsPartOfStrategyNav:true,projectXClaimableFeesAreNotPrincipal:true,projectXFeeTierIsNotApr:true,multiLegResolvedMustPromoteAllEconomicLegs:true});
  state.generatedAt=new Date().toISOString();
  fs.writeFileSync(STATE,JSON.stringify(state,null,2)+'\n');
  console.log(JSON.stringify({status:'PASS',version:VERSION,nftCount:perNft.length,principal:{WHYPE:whypePrincipal,USDC:usdcPrincipal,navUsd:round(navUsd,2)},claimable:{WHYPE:whypeClaimable,USDC:usdcClaimable,usd:round(claimableWhypeUsd+claimableUsdcUsd,6)},companyTotalCapitalUsd:state.capital.totalCapitalUsd,productivityCoverage:state.productivity.coverage,referenceApr:'Pending',executionAuthority:'none'},null,2));
}
main().catch(e=>{console.error(e?.stack||e);process.exit(1)});
