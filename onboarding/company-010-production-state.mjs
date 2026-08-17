#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const VERSION='0.1-company-010-production-state';
const ENGINE_VERSION='0.1-cypher-reviewed-current-state-admission';
const ROOT=process.cwd();
const DISCOVERY=process.env.COMPANY_010_DISCOVERY_INPUT||path.join(ROOT,'companies/company-010-discovery.json');
const CLOSURE=process.env.COMPANY_010_CLOSURE_INPUT||path.join(ROOT,'companies/company-010-closure.json');
const GMX=process.env.COMPANY_010_GMX_INPUT||path.join(ROOT,'companies/company-010-gmx-reader.json');
const OUT=process.env.COMPANY_010_PRODUCTION_OUTPUT||path.join(ROOT,'companies/company-010-production-state.json');
const CG_KEY=process.env.COINGECKO_API_KEY||'';
const PRICE_IDS={BTC:'bitcoin',ETH:'ethereum',HYPE:'hyperliquid',CVX:'convex-finance',CRV:'curve-dao-token',AERO:'aerodrome-finance',LDO:'lido-dao',VELO:'velodrome-finance'};
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const round=(n,d=8)=>Number.isFinite(Number(n))?Number(Number(n).toFixed(d)):null;
const n=x=>Number.isFinite(Number(x))?Number(x):null;

async function prices(){
  if(process.env.COMPANY_010_PRICE_FIXTURE){const j=JSON.parse(process.env.COMPANY_010_PRICE_FIXTURE);return Object.fromEntries(Object.keys(PRICE_IDS).map(symbol=>[symbol,n(j[symbol])]));}
  const ids=[...new Set(Object.values(PRICE_IDS))];
  const params=new URLSearchParams({ids:ids.join(','),vs_currencies:'usd'});
  if(CG_KEY) params.set('x_cg_demo_api_key',CG_KEY);
  const c=new AbortController(); const t=setTimeout(()=>c.abort(),15000);
  try{
    const r=await fetch(`https://api.coingecko.com/api/v3/simple/price?${params}`,{headers:{accept:'application/json','user-agent':'The-Holding-Cypher-Production-State/0.1'},signal:c.signal});
    if(!r.ok) throw new Error(`CoinGecko HTTP ${r.status}`);
    const j=await r.json();
    return Object.fromEntries(Object.entries(PRICE_IDS).map(([symbol,id])=>[symbol,n(j?.[id]?.usd)]));
  } finally { clearTimeout(t); }
}
function valued(symbol,quantity,priceMap,extra={}){
  const q=n(quantity), p=n(priceMap[symbol]);
  return {symbol,quantity:q,priceUsd:p,valueUsd:q!==null&&p!==null?round(q*p,2):null,priceSource:p!==null?'CoinGecko simple price':null,...extra};
}

async function main(){
  const discovery=read(DISCOVERY), closure=read(CLOSURE), gmx=read(GMX);
  if(discovery?.company?.registry!=='010'||discovery?.company?.name!=='Cypher') throw new Error('Company #010 discovery binding mismatch');
  if(closure?.version!=='0.4.1-company-010-economic-closure-reviewed') throw new Error('reviewed closure required');
  if(gmx?.version!=='0.1.3-company-010-gmx-reader-valuation') throw new Error('reviewed GMX Reader valuation required');
  if(closure?.epistemicBoundary?.unknownIsNotZero!==true||closure?.epistemicBoundary?.fluidExcluded!==true) throw new Error('Company #010 epistemic boundary missing');
  if(closure?.epistemicBoundary?.executionAuthority!=='none'||gmx?.authority?.executionAuthority!=='none') throw new Error('Company #010 source gained execution authority');

  const p=await prices();
  const b=closure.companyBookCandidate||{};
  const direct=[
    valued('BTC',b.BTC?.quantity,p,{assetId:'bitcoin',capitalLayer:'foundation',source:'reviewed Company #010 closure'}),
    valued('ETH',b.ETH?.quantity,p,{assetId:'ethereum',capitalLayer:'foundation',source:'reviewed Company #010 closure',fluidExcluded:true}),
    valued('HYPE',b.HYPE?.quantity,p,{assetId:'hyperliquid',capitalLayer:'productiveDividend',source:'reviewed Company #010 closure',components:b.HYPE?.components||null}),
    valued('CVX',b.CVX?.quantity,p,{assetId:'convex-finance',capitalLayer:'productiveDividend',source:'reviewed Company #010 closure',productiveQuantity:n(b.CVX?.productiveQuantity)}),
    valued('CRV',b.CRV?.quantity,p,{assetId:'curve-dao-token',capitalLayer:'productiveDividend',source:'reviewed Company #010 closure',components:b.CRV?.components||null}),
    valued('AERO',b.AERO?.quantity,p,{assetId:'aerodrome-finance',capitalLayer:'productiveDividend',source:'reviewed Company #010 closure',productiveQuantity:n(b.AERO?.productiveQuantity)}),
    valued('LDO',b.LDO?.quantity,p,{assetId:'lido-dao',capitalLayer:'productiveDividend',source:'reviewed Company #010 closure',productiveStatus:'unproven-direct-token-only'}),
    valued('VELO',b.VELO?.quantity,p,{assetId:'velodrome-finance',capitalLayer:'productiveDividend',source:'reviewed Company #010 closure',productiveQuantity:n(b.VELO?.productiveQuantity)})
  ];
  const gmxRows=(gmx.results||[]).map((x,i)=>({
    symbol:i===0?'GM-ETH-USDC':'GM-BTC-USDC',assetId:i===0?'gmx-gm-eth-usdc':'gmx-gm-btc-usdc',quantity:n(x.balance),priceUsd:n(x.gmTokenPrice?.midUsd),valueUsd:round(x.valueUsdMid,2),capitalLayer:'productiveDividend',source:'official GMX Reader current market-token valuation',marketToken:x.marketToken||x.token||null,referenceAprPct:n(x.referenceAprPct),referenceAprStatus:'measured',referenceAprSource:'GMX official 30D APY exact market-token address'}));
  if(gmxRows.length!==2||gmxRows.some(x=>!(x.valueUsd>0)&&x.valueUsd!==0)) throw new Error('exact two GMX valued positions required');

  const positions=[...direct,...gmxRows];
  const valuedPositions=positions.filter(x=>Number.isFinite(x.valueUsd));
  const knownCapitalFloorUsd=round(valuedPositions.reduce((s,x)=>s+x.valueUsd,0),2);
  const layerValues={foundation:0,productiveDividend:0,stableReserve:0,rwa:0,venture:0,unclassified:0};
  for(const x of valuedPositions) layerValues[x.capitalLayer]=round((layerValues[x.capitalLayer]||0)+x.valueUsd,2);

  const productive=[];
  const addProductive=(id,label,quantity,valueUsd,apr,status,source)=>productive.push({id,label,quantity:n(quantity),valueUsd:n(valueUsd),referenceAprPct:n(apr),status,source});
  const cvx=direct.find(x=>x.symbol==='CVX'), aero=direct.find(x=>x.symbol==='AERO'), velo=direct.find(x=>x.symbol==='VELO'), hype=direct.find(x=>x.symbol==='HYPE'), crv=direct.find(x=>x.symbol==='CRV');
  const cvxProd=n(b.CVX?.productiveQuantity); addProductive('convex_vlcvx','Convex vlCVX',cvxProd,cvxProd!==null&&cvx?.priceUsd!==null?round(cvxProd*cvx.priceUsd,2):null,null,'supported-existing-adapter','The Holding Productivity engine convex_vlcvx');
  const aeroProd=n(b.AERO?.productiveQuantity); addProductive('aerodrome_veaero','Aerodrome veAERO',aeroProd,aeroProd!==null&&aero?.priceUsd!==null?round(aeroProd*aero.priceUsd,2):null,null,'supported-existing-adapter','The Holding Productivity engine aerodrome_veaero');
  const veloProd=n(b.VELO?.productiveQuantity); addProductive('velodrome_vevelo','Velodrome veVELO',veloProd,veloProd!==null&&velo?.priceUsd!==null?round(veloProd*velo.priceUsd,2):null,null,'supported-existing-adapter','The Holding Productivity engine velodrome_vevelo');
  for(const row of gmxRows) addProductive(row.assetId,row.symbol,row.quantity,row.valueUsd,row.referenceAprPct,'measured',row.referenceAprSource);
  const projectXQty=n(b.HYPE?.components?.projectXPrincipal); addProductive('projectx_hype','Project X HYPE',projectXQty,projectXQty!==null&&hype?.priceUsd!==null?round(projectXQty*hype.priceUsd,2):null,null,'warming','principal measured; Reference APR not yet reproducibly bound');
  const sdQty=n(b.CRV?.components?.concentratorSdCrvUnderlying); addProductive('concentrator_sdcrv','Concentrator sdCRV underlying CRV',sdQty,sdQty!==null&&crv?.priceUsd!==null?round(sdQty*crv.priceUsd,2):null,null,'warming','underlying CRV principal measured; Reference APR not yet reproducibly bound');
  const productiveValued=productive.filter(x=>Number.isFinite(x.valueUsd));
  const productiveKnownUsd=round(productiveValued.reduce((s,x)=>s+x.valueUsd,0),2);
  const currentlyAprCoveredUsd=round(productiveValued.filter(x=>x.status==='measured'||x.status==='supported-existing-adapter').reduce((s,x)=>s+x.valueUsd,0),2);

  const gaps=[
    {id:'fluid-net-eth',severity:'blocking-total-capital',status:'explicitly-deferred',meaning:'Fluid ETH loop may contain economic capital but is excluded until deposited collateral, borrowed ETH and net exposure are independently resolved.'},
    {id:'project-x-reference-apr',severity:'productivity',status:'warming',meaning:'Project X HYPE principal is measured; Reference APR is not yet reproducibly bound.'},
    {id:'concentrator-reference-apr',severity:'productivity',status:'warming',meaning:'Concentrator sdCRV underlying CRV principal is measured; Reference APR is not yet reproducibly bound.'}
  ];

  const out={
    version:VERSION,engineVersion:ENGINE_VERSION,generatedAt:new Date().toISOString(),
    company:{...closure.company,foundingMethod:discovery.company.foundingMethod,foundingConfidence:discovery.company.foundingConfidence,wallets:discovery.company.wallets},
    status:'partial-total-capital',
    capital:{knownCapitalFloorUsd,totalCapitalUsd:null,totalCapitalComplete:false,knownButUnboundCapitalMayExist:true,valuedPositionCount:valuedPositions.length,positionCount:positions.length,layerValues,positions},
    productivity:{status:'partial',knownProductiveValueUsd:productiveKnownUsd,currentlyAprCoveredValueUsd:currentlyAprCoveredUsd,coverage:productiveKnownUsd>0?round(currentlyAprCoveredUsd/productiveKnownUsd,6):null,positions:productive,rule:'Unknown Reference APR is excluded, never treated as 0%.'},
    rewards:{status:'partial-routes-known',supportedRoutes:[{id:'aerodrome-ve',walletAlias:'Wallet 2'},{id:'velodrome-ve-direct',walletAlias:'Wallet 2'},{id:'votium-union',walletAlias:'Wallet 2'}],unboundMechanisms:['Project X HYPE','GMX GM markets','Concentrator sdCRV'],rule:'Route readiness is not claimable amount and is not realised cash flow.'},
    gaps,
    provenance:{closure:{version:closure.version,generatedAt:closure.generatedAt},gmxReader:{version:gmx.version,generatedAt:gmx.generatedAt||null},priceSource:'CoinGecko simple price at production-state collection time'},
    epistemicBoundary:{unknownIsNotZero:true,partialTotalIsNotTotal:true,fluidExcluded:true,referenceAprIsNotRealisedIncome:true,claimableRewardsAreNotRealisedCashFlow:true,noTransactions:true,executionAuthority:'none'},
    authority:{readOnly:true,walletSigning:false,transactions:false,capitalMovement:false,methodologyMutation:false,executionAuthority:'none'}
  };
  fs.writeFileSync(OUT,JSON.stringify(out,null,2)+'\n');
  console.log('COMPANY #010 PRODUCTION STATE PASS', {knownCapitalFloorUsd,totalCapitalComplete:false,productivityCoverage:out.productivity.coverage,gaps:gaps.map(x=>x.id),executionAuthority:'none'});
}
main().catch(e=>{console.error(e?.stack||e);process.exit(1)});
