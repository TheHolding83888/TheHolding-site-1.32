#!/usr/bin/env node
/**
 * Company #007 current-state downstream binding.
 *
 * The discovery + targeted resolver artifacts are the current inventory proof.
 * This projector removes redeemed Yield Basis LP mechanisms from CURRENT
 * Productivity/Capital while preserving historical observations in their
 * existing histories. It does not create income, mutate accounting methodology,
 * or gain wallet/capital execution authority.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT=process.cwd();
const COMPANY="Rook's portfolio";
const DISCOVERY='companies/company-007-discovery.json';
const RESOLVE='companies/company-007-resolve.json';
const PRODUCTIVITY='companies/productivity-data.json';
const GENERAL='intelligence/capital-state/general-company-balance-sheet.json';
const MARKET='intelligence/market-data/market-data.json';
const EPS=1e-9;

const read=rel=>JSON.parse(fs.readFileSync(path.join(ROOT,rel),'utf8'));
const write=(rel,data)=>fs.writeFileSync(path.join(ROOT,rel),JSON.stringify(data,null,2)+'\n');
const n=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))?Number(v):null;
const round=(v,d=6)=>n(v)===null?null:Number(Number(v).toFixed(d));
const assert=(ok,msg)=>{if(!ok)throw new Error(`Company #007 current-state binding: ${msg}`);};
const unique=a=>[...new Set((a||[]).filter(Boolean))];

const PRODUCTIVE_PUBLIC={
  AERO:{assetId:'aerodrome-finance',engineId:'aerodrome_veaero',layer:'productive-dividend'},
  CVX:{assetId:'convex-finance',engineId:'convex_vlcvx',layer:'productive-dividend'},
  CRV:{assetId:'curve-dao-token',engineId:'curve_vecrv',layer:'productive-dividend'}
};
const PUBLIC_META={
  BTC:{assetId:'bitcoin',layer:'foundation',marketId:'bitcoin'},
  ETH:{assetId:'ethereum',layer:'foundation',marketId:'ethereum'},
  AERO:PRODUCTIVE_PUBLIC.AERO,
  CVX:PRODUCTIVE_PUBLIC.CVX,
  CRV:PRODUCTIVE_PUBLIC.CRV,
  LINK:{assetId:'chainlink',layer:'unclassified',marketId:'chainlink'},
  ZK:{assetId:'zksync',layer:'unclassified',marketId:'zksync'}
};
const YB_MARKETS={
  'yb-WBTC':{assetId:'bitcoin',engineId:'yieldbasis_yblp_wbtc'},
  'yb-WETH':{assetId:'ethereum',engineId:'yieldbasis_yblp_weth'}
};
const CURRENT_YB_MARKETS=Object.keys(YB_MARKETS);

function loadAuthority(){
  const discovery=read(DISCOVERY),resolve=read(RESOLVE);
  assert(discovery?.version==='1.0-current-state-fast','unexpected discovery schema');
  assert(resolve?.version==='1.1-targeted-resolver','unexpected resolver schema');
  assert(discovery?.company?.registry==='007'&&resolve?.company?.registry==='007','registry mismatch');
  assert(discovery?.company?.name===COMPANY&&resolve?.company?.name===COMPANY,'company identity mismatch');
  const dg=Date.parse(discovery.generatedAt||''),rg=Date.parse(resolve.generatedAt||'');
  assert(Number.isFinite(dg)&&Number.isFinite(rg),'generatedAt missing');
  assert(rg+5*60_000>=dg,'resolver predates discovery outside bounded tolerance');
  const yb=resolve?.results?.yieldBasis;
  assert(yb?.status==='ok','Yield Basis resolver is not ok');
  assert(yb?.sourceMeshExhausted===false,'Yield Basis source mesh exhausted');
  const q=yb?.currentStateQuorum;
  assert(Number(q?.required)>=2&&Number(q?.matching)>=Number(q.required),'current-state quorum missing');
  assert(yb?.methodology?.currentStateProofIsIncomeAuthority===false,'current-state proof gained income authority');

  const discoveryYb=discovery?.discovery?.yieldBasis;
  assert(Array.isArray(discoveryYb?.positions),'discovery Yield Basis positions missing');
  const activeResolve=Array.isArray(yb.positions)?yb.positions:[];
  const activeDiscovery=discoveryYb.positions.filter(p=>n(p?.totalUnderlying)>EPS);
  const resolveMarkets=unique(activeResolve.map(p=>p?.market)).sort();
  const discoveryMarkets=unique(activeDiscovery.map(p=>p?.market)).sort();
  assert(JSON.stringify(resolveMarkets)===JSON.stringify(discoveryMarkets),`active Yield Basis set mismatch resolver=${resolveMarkets} discovery=${discoveryMarkets}`);
  for(const market of resolveMarkets)assert(YB_MARKETS[market],`unsupported active Yield Basis market ${market}`);
  const zeroMarkets=new Set((yb?.verifiedZeroMarkets||[]).map(x=>x?.market));
  for(const market of CURRENT_YB_MARKETS){
    assert(resolveMarkets.includes(market)||zeroMarkets.has(market),`${market} is neither active nor verified zero`);
  }

  const proposed=Array.isArray(discovery?.proposedCompanyBook)?discovery.proposedCompanyBook:[];
  assert(proposed.length>0,'proposed current Company Book missing');
  const bySymbol=new Map(proposed.filter(x=>x?.selectedForPublicBalance!==false).map(x=>[x.symbol,x]));
  const crv=resolve?.results?.crv,link=resolve?.results?.link;
  assert(crv?.status==='ok'&&n(crv.publicCandidateQuantity)!==null,'resolved CRV quantity unavailable');
  assert(link?.status==='ok'&&n(link.quantity)!==null,'resolved LINK quantity unavailable');
  if(bySymbol.has('CRV'))bySymbol.get('CRV').quantity=n(crv.publicCandidateQuantity);
  if(bySymbol.has('LINK'))bySymbol.get('LINK').quantity=n(link.quantity);

  return {discovery,resolve,yb,discoveryYb,activeResolve,activeDiscovery,bySymbol,resolveMarkets,zeroMarkets:[...zeroMarkets].sort()};
}

function rowPrice(existing,productivity,engineId,principalId){
  const prior=(existing||[]).find(x=>x?.engineId===engineId);
  const p=n(prior?.price);
  if(p!==null&&p>0)return p;
  const diag=n(productivity?.diagnostics?.pricesUsed?.[principalId]);
  if(diag!==null&&diag>0)return diag;
  return null;
}
function engineApr(productivity,engineId,existing=[]){
  const e=productivity?.engines?.[engineId];
  const prior=existing.find(x=>x?.engineId===engineId);
  const apr=n(e?.aprLatest)??n(prior?.apr);
  return {apr,engineStatus:e?.status||prior?.engineStatus||'missing'};
}
function upsertCurrentCompanyHistory(productivity,company){
  productivity.history=productivity.history||{};
  productivity.history.companies=productivity.history.companies||{};
  let history=Array.isArray(productivity.history.companies[COMPANY])?[...productivity.history.companies[COMPANY]]:[];
  const key=productivity.snapshotKey;
  history=history.filter(x=>x?.snapshotKey!==key);
  if(company.coverage>=0.999999&&n(company.aprLatest)!==null&&n(company.productiveValue)>0){
    history.push({snapshotKey:key,apr:round(company.aprLatest,4),periodEnd:productivity.generatedAt,totalProductiveValue:round(company.productiveValue,2),coveredProductiveValue:round(company.coveredProductiveValue,2),coverage:1});
  }
  history.sort((a,b)=>String(a?.periodEnd||'').localeCompare(String(b?.periodEnd||'')));
  productivity.history.companies[COMPANY]=history;
  const valid=history.map(x=>n(x?.apr)).filter(x=>x!==null&&x>=-100&&x<=500);
  company.observationCount=valid.length;
  company.aprHistoricalAverage=valid.length?round(valid.reduce((s,x)=>s+x,0)/valid.length,4):null;
  company.trackingStartedAt=history[0]?.periodEnd||company.trackingStartedAt||null;
}

function applyProductivity(authority){
  const data=read(PRODUCTIVITY);
  assert(['1.15','1.16'].includes(String(data.version)),'unsupported Productivity schema');
  const company=data?.companies?.[COMPANY];
  assert(company&&Array.isArray(company.breakdown),'Rook Productivity breakdown missing');
  const old=[...company.breakdown];
  const next=[];

  for(const [symbol,meta] of Object.entries(PRODUCTIVE_PUBLIC)){
    const quantity=n(authority.bySymbol.get(symbol)?.quantity);
    assert(quantity!==null&&quantity>=0,`${symbol} current quantity unavailable`);
    if(quantity<=EPS)continue;
    const prior=old.find(x=>x?.engineId===meta.engineId);
    assert(prior,`${symbol} established Productivity row missing`);
    const price=rowPrice(old,data,meta.engineId,meta.assetId);
    assert(price!==null&&price>0,`${symbol} current price unavailable`);
    const {apr,engineStatus}=engineApr(data,meta.engineId,old);
    next.push({...prior,engineId:meta.engineId,principalId:meta.assetId,units:quantity,price,value:round(quantity*price,2),apr,engineStatus});
  }

  for(const r of authority.activeResolve){
    const meta=YB_MARKETS[r.market];
    const discovered=authority.activeDiscovery.find(x=>x?.market===r.market);
    const quantity=n(discovered?.totalUnderlying);
    assert(quantity!==null&&quantity>EPS,`${r.market} active underlying unavailable`);
    const prior=old.find(x=>x?.engineId===meta.engineId);
    const price=rowPrice(old,data,meta.engineId,meta.assetId);
    assert(price!==null&&price>0,`${r.market} current underlying price unavailable`);
    const {apr,engineStatus}=engineApr(data,meta.engineId,old);
    next.push({
      ...(prior||{}),engineId:meta.engineId,principalId:meta.assetId,units:quantity,price,value:round(quantity*price,2),
      apr,engineStatus,source:'companies/company-007-resolve.json',
      currentState:{market:r.market,custody:discovered?.custody||null,directLtShares:n(discovered?.directLtShares),gaugeShares:n(discovered?.gaugeShares),totalUnderlying:quantity}
    });
  }

  let total=0,covered=0,weighted=0,complete=next.length>0;
  for(const row of next){
    const value=n(row.value),apr=n(row.apr);
    if(value===null||value<0){complete=false;continue;}
    total+=value;
    if(apr!==null&&apr>=-100&&apr<=500&&!['warming','unavailable','error','missing'].includes(row.engineStatus)){covered+=value;weighted+=value*apr;}
    else complete=false;
  }
  const coverage=total>0?covered/total:0;
  const aprLatest=covered>0?weighted/covered:null;
  company.breakdown=next;
  company.productiveValue=round(total,2);
  company.coveredProductiveValue=round(covered,2);
  company.uncoveredProductiveValue=round(Math.max(0,total-covered),2);
  company.coverage=round(coverage,6);
  company.aprLatest=aprLatest===null?null:round(aprLatest,4);
  company.status=complete&&coverage>=0.999999&&aprLatest!==null?'ok':'partial';
  company.aprScope=coverage>=0.999999?'full-productive-capital':'covered-productive-capital';
  company.updatedAt=data.generatedAt;
  company.currentInventoryAuthority='companies/company-007-discovery.json + companies/company-007-resolve.json';
  upsertCurrentCompanyHistory(data,company);

  data.diagnostics=data.diagnostics||{};
  data.diagnostics.company007CurrentState={
    version:'0.1-current-state-downstream-binding',
    discoveryGeneratedAt:authority.discovery.generatedAt,
    resolverGeneratedAt:authority.resolve.generatedAt,
    activeYieldBasisMarkets:authority.resolveMarkets,
    verifiedZeroYieldBasisMarkets:authority.zeroMarkets,
    currentProductiveEngineIds:next.map(x=>x.engineId),
    historicalEngineHistoryPreserved:true,
    unknownIsNotZero:true,
    currentStateProofIsIncomeAuthority:false,
    executionAuthority:'none'
  };
  data.note=String(data.note||'')+' Company #007 current productive inventory is rebound from fresh discovery/resolve evidence; redeemed YBLP mechanisms are excluded from current inventory while historical observations remain preserved.';
  write(PRODUCTIVITY,data);
  return data;
}

function marketPrice(market,id){
  const row=market?.prices?.[id];
  const price=n(row?.usd);
  assert(price!==null&&price>0,`canonical market price unavailable for ${id}`);
  return price;
}
function productivePrice(productivity,engineId){
  const row=productivity?.companies?.[COMPANY]?.breakdown?.find(x=>x?.engineId===engineId);
  const price=n(row?.price);
  assert(price!==null&&price>0,`Productivity price unavailable for ${engineId}`);
  return {price,row};
}

function applyGeneral(authority,productivity){
  const general=read(GENERAL),market=read(MARKET);
  assert(general?.version==='0.1-general-company-balance-sheet','unexpected General Balance schema');
  const idx=(general.companies||[]).findIndex(x=>x?.registry==='007');
  assert(idx>=0,'Company #007 General Balance row missing');
  const positions=[];
  const layers={foundationUsd:0,productiveDividendUsd:0,stableReserveUsd:0,rwaUsd:0,ventureUsd:0,unclassifiedUsd:0};
  let representedProductiveExposure=0;

  for(const [symbol,row] of authority.bySymbol.entries()){
    const meta=PUBLIC_META[symbol];
    if(!meta)continue;
    const quantity=n(row?.quantity);
    assert(quantity!==null&&quantity>=0,`${symbol} public quantity unavailable`);
    if(quantity<=EPS)continue;
    let price,productiveAttribute=false,priceProvenance;
    if(meta.engineId){
      const p=productivePrice(productivity,meta.engineId);price=p.price;productiveAttribute=true;representedProductiveExposure+=n(p.row?.value)||0;priceProvenance='canonical-productivity-breakdown-current-state-bound';
    }else{
      price=marketPrice(market,meta.marketId);priceProvenance='canonical-shared-market-data';
    }
    const value=quantity*price;
    const key=meta.layer==='foundation'?'foundationUsd':meta.layer==='productive-dividend'?'productiveDividendUsd':'unclassifiedUsd';
    layers[key]+=value;
    positions.push({assetId:meta.assetId,units:round(quantity,12),priceUsd:round(price,12),valueUsd:round(value),primaryCapitalLayer:meta.layer,productiveAttribute,priceProvenance,evidenceStatus:'current-state-proven',note:null,inclusion:'included-once-in-company-total',productivityOnly:false});
  }

  for(const r of authority.activeResolve){
    const meta=YB_MARKETS[r.market],discovered=authority.activeDiscovery.find(x=>x?.market===r.market),quantity=n(discovered?.totalUnderlying);
    assert(quantity!==null&&quantity>EPS,`${r.market} active General Balance quantity unavailable`);
    const p=productivePrice(productivity,meta.engineId);
    const exposure=n(p.row?.value);
    assert(exposure!==null&&exposure>=0,`${r.market} productive exposure unavailable`);
    representedProductiveExposure+=exposure;
    positions.push({assetId:meta.assetId,engineId:meta.engineId,units:round(quantity,12),priceUsd:round(p.price,12),productiveExposureValueUsd:round(exposure),primaryCapitalLayer:null,productiveAttribute:true,productivityOnly:true,inclusion:'excluded-from-capital-total-productivity-representation',doubleCountPolicy:'excluded from capital total because current Yield Basis underlying is already included inside the public BTC/ETH quantity'});
  }

  const pCompany=productivity?.companies?.[COMPANY];
  const productiveExpected=n(pCompany?.productiveValue);
  assert(productiveExpected!==null&&productiveExpected>=0,'current Productive exposure unavailable');
  assert(Math.abs(representedProductiveExposure-productiveExpected)<=0.05,`Productivity reconciliation failed represented=${representedProductiveExposure} expected=${productiveExpected}`);
  const total=Object.values(layers).reduce((s,v)=>s+v,0);
  assert(total>0,'current total capital unavailable');
  for(const k of Object.keys(layers))layers[k]=round(layers[k]);

  general.companies[idx]={
    ...general.companies[idx],name:COMPANY,status:'total-capital-complete',totalCapitalUsd:round(total),totalCapitalComplete:true,
    sourceScope:'company-007-current-state-discovery-plus-targeted-resolver',productiveMeasuredExposureUsd:round(productiveExpected),
    primaryProductiveDividendCapitalUsd:round(layers.productiveDividendUsd),
    productiveExposureOutsidePrimaryProductiveLayerUsd:round(Math.max(0,productiveExpected-layers.productiveDividendUsd)),
    layerValues:layers,
    epistemicNote:'Company #007 current inventory is bound to fresh discovery + targeted resolver evidence. Verified-zero Yield Basis positions are excluded from current productive inventory; historical records remain preserved outside current capital state.',
    positions
  };

  const layerTotals={foundationUsd:0,productiveDividendUsd:0,stableReserveUsd:0,rwaUsd:0,ventureUsd:0,unclassifiedUsd:0};
  let networkTotal=0,networkProductive=0,networkPrimaryProductive=0;
  for(const c of general.companies){
    const t=n(c.totalCapitalUsd),p=n(c.productiveMeasuredExposureUsd);
    assert(t!==null&&t>0&&p!==null&&p>=0,`${c.name}: invalid post-overlay capital totals`);
    networkTotal+=t;networkProductive+=p;networkPrimaryProductive+=n(c.primaryProductiveDividendCapitalUsd)||0;
    for(const k of Object.keys(layerTotals))layerTotals[k]+=n(c?.layerValues?.[k])||0;
  }
  for(const k of Object.keys(layerTotals))layerTotals[k]=round(layerTotals[k]);
  general.network={...general.network,generalCompanyCount:general.companies.length,totalCapitalCompleteCompanyCount:general.companies.filter(x=>x.totalCapitalComplete===true).length,generalCompanyTvlUsd:round(networkTotal),productiveMeasuredExposureUsd:round(networkProductive),primaryProductiveDividendCapitalUsd:round(networkPrimaryProductive),layerValues:layerTotals};
  general.engineVersion='0.3-company-007-current-state-bound';
  general.generatedAt=new Date().toISOString();
  general.purpose='Machine-readable total-capital binding for the general Registry. Company #007 is current-state-bound from discovery + targeted resolver evidence; other established companies retain the normalized browser/canonical-state routes.';
  general.sourceState=general.sourceState||{};
  general.sourceState.company007CurrentState={discoveryFile:DISCOVERY,discoveryGeneratedAt:authority.discovery.generatedAt,resolverFile:RESOLVE,resolverGeneratedAt:authority.resolve.generatedAt,activeYieldBasisMarkets:authority.resolveMarkets,verifiedZeroYieldBasisMarkets:authority.zeroMarkets,currentStateProofIsIncomeAuthority:false,executionAuthority:'none'};
  general.semantics=general.semantics||{};
  general.semantics.company007CurrentInventory='fresh discovery + targeted resolver; current zero is measured zero, UNKNOWN != 0; historical positions are not rewritten as absent';
  write(GENERAL,general);
  return general;
}

const authority=loadAuthority();
const productivity=applyProductivity(authority);
const general=applyGeneral(authority,productivity);
const rook=general.companies.find(x=>x.registry==='007');
console.log(JSON.stringify({status:'PASS',version:'0.1-current-state-downstream-binding',company:COMPANY,discoveryGeneratedAt:authority.discovery.generatedAt,resolverGeneratedAt:authority.resolve.generatedAt,activeYieldBasisMarkets:authority.resolveMarkets,currentProductiveEngines:productivity.companies[COMPANY].breakdown.map(x=>x.engineId),productiveValueUsd:productivity.companies[COMPANY].productiveValue,totalCapitalUsd:rook.totalCapitalUsd,unknownIsNotZero:true,currentStateProofIsIncomeAuthority:false,executionAuthority:'none'},null,2));
