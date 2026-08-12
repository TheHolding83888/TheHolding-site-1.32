import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Contract, JsonRpcProvider, formatUnits, getAddress } from 'ethers';

const VERSION = '1.4-company-008-fraxtal-sfrxusd-close';
const EXPECTED_PRIOR = '1.3-company-008-stable-diagnostic-safe-sbold';
const INPUT = process.env.COMPANY_008_RESOLVE_INPUT || path.resolve('companies/company-008-resolve.json');
const OUTPUT = process.env.COMPANY_008_RESOLVE_OUTPUT || path.resolve('companies/company-008-resolve.json');

const A = x => getAddress(String(x).toLowerCase());
const WALLET = A('0x888d39aee2aec979c81f125ea94bb3ceb60f6bbb');
const FRAXTAL = Object.freeze({
  chainId: 252n,
  sfrxUsd: A('0xfc00000000000000000000000000000000000008'),
  frxUsd: A('0xfc00000000000000000000000000000000000001')
});
const ETH_FRXUSD = A('0xcacd6fd266af91b8aed52accc382b4e165586e29');

const RPC_URLS = [
  process.env.FRAXTAL_RPC_URL,
  process.env.FRAXTAL_RPC_URL_2,
  'https://fraxtal.gateway.tenderly.co',
  'https://rpc.frax.com'
].filter(Boolean);

function lower(x){ return String(x||'').toLowerCase(); }
function round(x,d=12){ const n=Number(x); return Number.isFinite(n)?Number(n.toFixed(d)):null; }
function sha256(x){ return crypto.createHash('sha256').update(String(x)).digest('hex'); }
function err(e){ return String(e?.shortMessage||e?.message||e||'unknown').slice(0,1200); }
function positive(x){ try { const n=BigInt(x); return n>0n?n:0n; } catch { return 0n; } }

async function fetchJson(url, timeoutMs=15000){
  const ctrl=new AbortController(); const t=setTimeout(()=>ctrl.abort(),timeoutMs);
  try{
    const r=await fetch(url,{signal:ctrl.signal,cache:'no-store',headers:{'user-agent':'The-Holding-Monetra-Fraxtal-Resolver/1.4'}});
    if(!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally { clearTimeout(t); }
}

async function selectProvider(){
  const errors=[];
  for(const url of RPC_URLS){
    const p=new JsonRpcProvider(url,252,{staticNetwork:true});
    try{
      const [network,block]=await Promise.all([p.getNetwork(),p.getBlockNumber()]);
      if(BigInt(network.chainId)!==FRAXTAL.chainId) throw new Error(`wrong chain id ${network.chainId}`);
      return {provider:p,host:new URL(url).hostname,block,errors};
    }catch(e){ errors.push(`${new URL(url).hostname}: ${err(e)}`); }
  }
  return {provider:null,host:null,block:null,errors};
}

async function llamaPrice(chain,address){
  const key=`${chain}:${lower(address)}`;
  try{
    const j=await fetchJson(`https://coins.llama.fi/prices/current/${encodeURIComponent(key)}`);
    const hit=j?.coins?.[key] || j?.coins?.[`${chain}:${address}`];
    const px=Number(hit?.price);
    if(Number.isFinite(px)&&px>0) return {status:'ok',priceUsd:px,source:`defillama-contract:${chain}`};
  }catch(e){ return {status:'unavailable',priceUsd:null,source:`defillama-contract:${chain}`,error:err(e)}; }
  return {status:'unavailable',priceUsd:null,source:`defillama-contract:${chain}`};
}

async function meta(provider,address){
  const c=new Contract(address,[
    'function symbol() view returns (string)',
    'function name() view returns (string)',
    'function decimals() view returns (uint8)'
  ],provider);
  let symbol=null,name=null,decimals=18;
  try{symbol=await c.symbol();}catch{}
  try{name=await c.name();}catch{}
  try{decimals=Number(await c.decimals());}catch{}
  return {address:A(address),symbol,name,decimals};
}

async function resolveFraxtalSfrxUsd(provider){
  const c=new Contract(FRAXTAL.sfrxUsd,[
    'function balanceOf(address) view returns (uint256)',
    'function decimals() view returns (uint8)',
    'function asset() view returns (address)',
    'function previewRedeem(uint256) view returns (uint256)',
    'function convertToAssets(uint256) view returns (uint256)'
  ],provider);

  const raw=positive(await c.balanceOf(WALLET));
  if(raw<=0n) return {status:'absent',chain:'Fraxtal',wrapper:FRAXTAL.sfrxUsd};

  let shareDecimals=18;
  try{shareDecimals=Number(await c.decimals());}catch{}
  const shares=Number(formatUnits(raw,shareDecimals));

  let asset=FRAXTAL.frxUsd;
  try{asset=A(await c.asset());}catch{}

  let assetsRaw=0n,method=null,redeemError=null;
  try{assetsRaw=positive(await c.previewRedeem(raw));method='previewRedeem';}
  catch(e1){
    try{assetsRaw=positive(await c.convertToAssets(raw));method='convertToAssets';}
    catch(e2){redeemError=`${err(e1)} | ${err(e2)}`;}
  }

  const underlyingMeta=await meta(provider,asset);
  const underlyingAmount=assetsRaw>0n?Number(formatUnits(assetsRaw,underlyingMeta.decimals)):null;

  let price=await llamaPrice('fraxtal',asset);
  let crossChainPriceFallback=false;
  if(price.priceUsd==null){
    const eth=await llamaPrice('ethereum',ETH_FRXUSD);
    if(eth.priceUsd!=null){
      price={...eth,source:'defillama-contract:ethereum-frxusd-cross-chain-economic-reference'};
      crossChainPriceFallback=true;
    }
  }

  let valueUsd=underlyingAmount!=null&&price.priceUsd!=null?underlyingAmount*price.priceUsd:null;
  let wrapperPriceFallback=null;
  if(valueUsd==null){
    wrapperPriceFallback=await llamaPrice('fraxtal',FRAXTAL.sfrxUsd);
    if(wrapperPriceFallback.priceUsd!=null) valueUsd=shares*wrapperPriceFallback.priceUsd;
  }

  return {
    status:valueUsd!=null?'ok':'unpriced',
    position:{
      id:`fraxtal:${lower(FRAXTAL.sfrxUsd)}`,
      chain:'Fraxtal',
      protocol:'Frax Finance',
      positionType:'Savings Stable',
      wrapper:FRAXTAL.sfrxUsd,
      wrapperSymbol:'sfrxUSD',
      name:'Staked Frax USD',
      sharesOrBalance:round(shares),
      shareRaw:raw.toString(),
      underlying:asset,
      underlyingSymbol:underlyingMeta.symbol||'frxUSD',
      redeemableUnderlying:underlyingAmount!=null?round(underlyingAmount):null,
      economicValuation:{
        status:valueUsd!=null?'ok':'unpriced',
        terminalType:'stable-asset',
        terminal:asset,
        terminalSymbol:underlyingMeta.symbol||'frxUSD',
        terminalAmount:underlyingAmount!=null?round(underlyingAmount):null,
        price,
        wrapperPriceFallback,
        crossChainPriceFallback,
        valueUsd:valueUsd!=null?round(valueUsd,12):null,
        path:underlyingAmount!=null?[
          {token:FRAXTAL.sfrxUsd,symbol:'sfrxUSD',amount:round(shares),standard:'ERC-4626-like',redeemMethod:method,redeemableToken:asset,redeemableSymbol:underlyingMeta.symbol||'frxUSD',redeemableAmount:round(underlyingAmount)},
          {token:asset,symbol:underlyingMeta.symbol||'frxUSD',amount:round(underlyingAmount)}
        ]:[{token:FRAXTAL.sfrxUsd,symbol:'sfrxUSD',amount:round(shares),standard:'ERC-4626-like',redeemMethod:null,error:redeemError}]
      },
      valueUsd:valueUsd!=null?round(valueUsd,6):null,
      valuationStatus:valueUsd!=null?'ok':'unpriced',
      valuationCanonical:valueUsd!=null&&underlyingAmount!=null&&price.priceUsd!=null,
      incomeMode:'embedded-yield',
      productive:true,
      ownerHintMatched:'Frax Finance',
      methodologyNote:'Fraxtal-native sfrxUSD. Embedded Yield is exchange-rate/share-value growth; current-book value uses redeemable frxUSD when reproducible. Historical income must be flow-adjusted.',
      history:{firstObservedInbound:null,currentCheckpoint:{timestamp:new Date().toISOString(),sharesOrBalance:round(shares),redeemableUnderlying:underlyingAmount!=null?round(underlyingAmount):null,economicValueUsd:valueUsd!=null?round(valueUsd,6):null}}
    }
  };
}

function upsert(arr,p){
  if(!p)return;
  const i=arr.findIndex(x=>x.id===p.id||(p.wrapper&&lower(x.wrapper)===lower(p.wrapper)));
  if(i>=0)arr[i]=p;else arr.push(p);
}
function summarize(positions){
  const priced=positions.filter(p=>Number.isFinite(Number(p.valueUsd)));
  const total=priced.reduce((s,p)=>s+Number(p.valueUsd),0);
  const byProtocol={},byType={},byStable={};
  for(const p of priced){
    byProtocol[p.protocol]=round((byProtocol[p.protocol]||0)+Number(p.valueUsd),6);
    byType[p.positionType]=round((byType[p.positionType]||0)+Number(p.valueUsd),6);
    const sym=p.underlyingSymbol||p.symbol||p.wrapperSymbol||'Unknown';
    byStable[sym]=round((byStable[sym]||0)+Number(p.valueUsd),6);
  }
  return {
    totalUsd:round(total,6),
    productiveUsd:round(positions.filter(p=>p.productive).reduce((s,p)=>s+Number(p.valueUsd||0),0),6),
    liquidUsd:round(positions.filter(p=>!p.productive).reduce((s,p)=>s+Number(p.valueUsd||0),0),6),
    positionCount:positions.length,
    pricedPositions:priced.length,
    byProtocol,byType,byStable
  };
}

async function main(){
  if(!fs.existsSync(INPUT)) throw new Error(`missing prior resolver input: ${INPUT}`);
  const priorText=fs.readFileSync(INPUT,'utf8');
  const prior=JSON.parse(priorText);
  if(prior.version!==EXPECTED_PRIOR) throw new Error(`expected ${EXPECTED_PRIOR}, got ${prior.version}`);
  if(prior.company?.registry!=='008'||prior.company?.name!=='Monetra.eth'||lower(prior.company?.wallet)!==lower(WALLET)) throw new Error('Company #008 identity mismatch');
  if(prior.company?.founding?.date!=='2026-05-27') throw new Error('founding regression');
  if(!Array.isArray(prior.stableCapital?.positions)||prior.stableCapital.positions.length<9) throw new Error('v1.3 stable positions missing');

  const startedAt=new Date().toISOString();
  const positions=prior.stableCapital.positions.map(x=>({...x}));
  const selected=await selectProvider();

  let frax={status:'provider-unavailable',error:selected.errors.join(' | ')};
  if(selected.provider){
    try{frax=await resolveFraxtalSfrxUsd(selected.provider);}
    catch(e){frax={status:'probe-error',error:err(e),chain:'Fraxtal',wrapper:FRAXTAL.sfrxUsd};}
  }
  if(frax.position) upsert(positions,frax.position);

  const summary=summarize(positions);
  const target=Number(prior.ownerEvidence?.stableStrategyUsdApprox||100);
  const delta=summary.totalUsd-target;

  const checks={...(prior.ownerHintCoverage?.checks||{})};
  checks['Frax Finance']=positions.some(p=>p.ownerHintMatched==='Frax Finance');
  const missingHints=Object.entries(checks).filter(([,v])=>!v).map(([k])=>k);
  const unpriced=positions.filter(p=>p.valueUsd==null);
  const bookReady=missingHints.length===0&&unpriced.length===0&&Math.abs(delta)<=15;

  const unresolved=(prior.stableCapital?.unresolved||[]).filter(x=>!String(x.mechanism||'').toLowerCase().includes('frax'));
  if(!checks['Frax Finance']) unresolved.push({mechanism:'Frax Finance / sfrxUSD on Fraxtal',status:frax.status,error:frax.error||null});

  const output={
    ...prior,
    version:VERSION,
    generatedAt:new Date().toISOString(),
    startedAt,
    purpose:'narrow Fraxtal-only closure of owner-confirmed sfrxUSD; preserve all v1.3 Stable Capital positions and avoid reopening solved Ethereum/Base mechanisms',
    preservation:{
      ...(prior.preservation||{}),
      priorResolverVersion:prior.version,
      priorResolverSha256:sha256(priorText),
      priorStablePositionCount:prior.stableCapital.positions.length,
      principle:'v1.4 is Fraxtal-only; all v1.3 positions and founding evidence are preserved'
    },
    resolutionV14:{
      target:'Frax Finance / sfrxUSD',
      chain:'Fraxtal',
      chainId:252,
      officialTokenAddresses:{sfrxUSD:FRAXTAL.sfrxUsd,frxUSD:FRAXTAL.frxUsd},
      provider:selected.host,
      providerBlock:selected.block,
      providerErrorsBeforeSuccess:selected.errors,
      frax,
      moduleExecution:{fraxtalProviderAvailable:!!selected.provider,fraxStatus:frax.status},
      engineeringGuard:'technical success and economic completeness remain separate; missing Fraxtal data publishes diagnostics instead of discarding them'
    },
    stableCapital:{
      ...prior.stableCapital,
      positions,
      summary,
      reconciliation:{ownerStableStrategyUsdApprox:target,reproducedStableCapitalUsd:summary.totalUsd,deltaVsOwnerApproxUsd:round(delta,6),withinLoose15UsdBand:Math.abs(delta)<=15,note:'owner target is diagnostic only; no value is forced'},
      unresolved
    },
    ownerHintCoverage:{
      ...(prior.ownerHintCoverage||{}),
      checks,
      missingHints,
      aaveEvidenceCount:positions.filter(p=>p.ownerHintMatched==='Aave V3').length,
      note:'Frax hint closes only if the Fraxtal sfrxUSD balance is reproduced; green workflow indicates diagnostic execution, not forced economic completeness.'
    },
    history:{
      ...(prior.history||{}),
      v14CheckpointSeed:frax.position?{id:frax.position.id,protocol:'Frax Finance',chain:'Fraxtal',incomeMode:'embedded-yield',currentCheckpoint:frax.position.history?.currentCheckpoint||null}:null
    },
    productionReadiness:{
      ...(prior.productionReadiness||{}),
      stableCapitalBookReady:bookReady,
      currentStateReconciled:bookReady,
      embeddedYieldLedgerSeedReady:bookReady,
      embeddedYieldHistoryReady:false,
      productivityIntegrationReady:false,
      rewardsIntegrationReady:false,
      pageIntegrationReady:bookReady,
      reportingIntegrationReady:false,
      rationale:bookReady?'current Stable Capital book reconciled including Fraxtal sfrxUSD; next phase is Reference APY normalization + Embedded Yield history':'Fraxtal probe published but current book remains open; inspect resolutionV14.frax/missingHints without reopening solved positions'
    }
  };

  fs.mkdirSync(path.dirname(OUTPUT),{recursive:true});
  fs.writeFileSync(OUTPUT,JSON.stringify(output,null,2)+'\n');
  console.log(JSON.stringify({
    version:output.version,
    fraxStatus:frax.status,
    stableCapitalUsd:summary.totalUsd,
    positionCount:summary.positionCount,
    deltaVsOwnerApproxUsd:round(delta,6),
    missingHints,
    bookReady
  },null,2));
}
main().catch(e=>{console.error(e);process.exit(1);});
