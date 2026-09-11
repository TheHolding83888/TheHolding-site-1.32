import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import vm from 'node:vm';

const ROOT = process.cwd();
const OUT = path.join(ROOT, 'intelligence/capital-state/general-company-balance-sheet.json');
const PRODUCTIVITY = 'companies/productivity-data.json';
const MARKET_DATA = 'intelligence/market-data/market-data.json';
const UI_BOOK_SOURCE = 'companies/index.html';
const DEFITEA_STATE = 'companies/defitea-canonical-state.json';
const YIELD_RING_STATE = 'companies/yieldring-canonical-state.json';
const COMPANY001_OWNER_SNAPSHOT = 'companies/company-001-owner-capital-snapshot.json';

const BOOK = {
  'defitea.eth': [],
  'YieldRing.eth': [],
  '05081966.eth': [
    { id:'aerodrome-finance', qty:202, layer:'productive-dividend' },
    { id:'curve-dao-token', qty:480, layer:'productive-dividend' },
    { id:'frax-share', qty:393, layer:'productive-dividend' }
  ],
  'dinaz.eth': [
    { id:'yield-basis', qty:12029, layer:'productive-dividend' }
  ],
  '0x5860...83CA8.eth': [
    { id:'bitcoin', qty:0.1241, layer:'foundation', priceSource:'shared-market-data' },
    { id:'internet-computer', qty:1363, layer:'productive-dividend' },
    { id:'aerodrome-finance', qty:5000, layer:'productive-dividend' },
    { id:'velodrome-finance', qty:28326, layer:'productive-dividend' }
  ],
  'aerocvxyb.eth': [
    { id:'aerodrome-finance', qty:9230.248119304428, layer:'productive-dividend' },
    { id:'velodrome-finance', qty:6971.925992122776, layer:'productive-dividend' },
    { id:'yield-basis', qty:12499.999999999958, layer:'productive-dividend' },
    { id:'internet-computer', qty:1296, layer:'productive-dividend' }
  ],
  "Rook's portfolio": [
    { id:'bitcoin', qty:0.09949873, layer:'foundation', priceSource:'shared-market-data' },
    { id:'ethereum', qty:1.083229073375, layer:'foundation', priceSource:'shared-market-data' },
    { id:'aerodrome-finance', qty:4330.755126048871, layer:'productive-dividend' },
    { id:'convex-finance', qty:336.240148815125, layer:'productive-dividend' },
    { id:'curve-dao-token', qty:1368.677426931635, layer:'productive-dividend' },
    { id:'zksync', qty:8573.908961603593, layer:'unclassified', priceSource:'shared-market-data' },
    { id:'bitcoin', qty:0.00335757, layer:'productive-dividend', productivityOnly:true, engineId:'yieldbasis_yblp_wbtc' },
    { id:'ethereum', qty:0.29309327939659907, layer:'productive-dividend', productivityOnly:true, engineId:'yieldbasis_yblp_weth' }
  ],
  '1milliondollar.eth': [
    { id:'bitcoin', qty:0.07264572, layer:'foundation', priceSource:'shared-market-data' },
    { id:'ethereum', qty:0.167026130614, layer:'foundation', priceSource:'shared-market-data', evidenceStatus:'mixed-verified-native-plus-owner-observed', note:'0.006426130614 ETH verified native + 0.1606 owner-observed WETH; owner-observed component is not independently reproduced onchain.' },
    { id:'aerodrome-finance', qty:214.798088305326, layer:'productive-dividend' },
    { id:'convex-crv', qty:468.390991181449, layer:'productive-dividend' },
    { id:'yield-basis', qty:3737.585758274693, layer:'productive-dividend' }
  ]
};

const REGISTRY = [
  ['001','05081966.eth'],['002','YieldRing.eth'],['003','dinaz.eth'],['004','defitea.eth'],
  ['005','0x5860...83CA8.eth'],['006','aerocvxyb.eth'],['007',"Rook's portfolio"],['009','1milliondollar.eth']
];

const SHARED_MARKET_IDS = ['bitcoin','ethereum','zksync'];
const round = (n,d=6) => { const p=10**d; return Number.isFinite(Number(n)) ? Math.round(Number(n)*p)/p : null; };
const readJson = rel => JSON.parse(fs.readFileSync(path.join(ROOT, rel),'utf8'));
const sha256File = rel => crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT,rel))).digest('hex');
const sha256Json = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const fail = message => { throw new Error(message); };

function extractBalancedObject(text,objectStart) {
  let depth=0,quote=null,escaped=false,lineComment=false,blockComment=false;
  for(let i=objectStart;i<text.length;i+=1){
    const ch=text[i],next=text[i+1]||'';
    if(lineComment){if(ch==='\n')lineComment=false;continue;}
    if(blockComment){if(ch==='*'&&next==='/'){blockComment=false;i+=1;}continue;}
    if(quote){if(escaped){escaped=false;continue;}if(ch==='\\'){escaped=true;continue;}if(ch===quote)quote=null;continue;}
    if(ch==='/'&&next==='/'){lineComment=true;i+=1;continue;}
    if(ch==='/'&&next==='*'){blockComment=true;i+=1;continue;}
    if(ch==='\''||ch==='"'||ch==='`'){quote=ch;continue;}
    if(ch==='{')depth+=1;
    else if(ch==='}'){
      depth-=1;
      if(depth===0)return text.slice(objectStart,i+1);
      if(depth<0)break;
    }
  }
  throw new Error('companies/index.html COMPANY_BOOK balanced object boundary missing');
}

function readUiCompanyBook() {
  const text=fs.readFileSync(path.join(ROOT,UI_BOOK_SOURCE),'utf8');
  const startMarker='const COMPANY_BOOK = ';
  const start=text.indexOf(startMarker);
  if(start<0)throw new Error('companies/index.html COMPANY_BOOK source missing');
  const objectStart=text.indexOf('{',start+startMarker.length);
  if(objectStart<0)throw new Error('companies/index.html COMPANY_BOOK object start missing');
  const literal=extractBalancedObject(text,objectStart);
  let book;
  try { book=vm.runInNewContext(`(${literal})`,Object.create(null),{timeout:100}); }
  catch (error) { throw new Error(`companies/index.html COMPANY_BOOK parse failed: ${error.message}`); }
  if(!book||typeof book!=='object'||Array.isArray(book))throw new Error('companies/index.html COMPANY_BOOK parsed to invalid value');
  return book;
}

function semanticRows(rows=[]) {
  if(!Array.isArray(rows))return null;
  return rows.map(row=>({
    id:String(row?.id||''),
    qty:Number(row?.qty),
    productivityOnly:row?.productivityOnly===true,
    engineId:row?.productivityOnly===true&&row?.engineId?String(row.engineId):null
  })).sort((a,b)=>`${a.id}|${a.productivityOnly?1:0}|${a.engineId||''}`.localeCompare(`${b.id}|${b.productivityOnly?1:0}|${b.engineId||''}`));
}

function bindUiCompanyBookSemantics(uiBook) {
  const bound={};
  for(const [,name] of REGISTRY){
    const expected=semanticRows(BOOK[name]);
    const actual=semanticRows(uiBook?.[name]);
    if(!expected||!actual)throw new Error(`${name}: browser Company Book semantic rows missing`);
    if(actual.length!==expected.length)throw new Error(`${name}: browser Company Book row-count drift expected=${expected.length} actual=${actual.length}`);
    for(let i=0;i<expected.length;i+=1){
      const e=expected[i],a=actual[i];
      if(a.id!==e.id||a.productivityOnly!==e.productivityOnly||a.engineId!==e.engineId)throw new Error(`${name}: browser Company Book identity/inclusion drift at row ${i+1}`);
      if(!Number.isFinite(a.qty)||Math.abs(a.qty-e.qty)>Math.max(1e-9,Math.abs(e.qty)*1e-9))throw new Error(`${name}: browser Company Book quantity drift for ${e.id}${e.engineId?`/${e.engineId}`:''}`);
    }
    bound[name]=actual;
  }
  return {companyCount:Object.keys(bound).length,semanticFields:['id','qty','productivityOnly','engineId'],sha256:sha256Json(bound)};
}

function canonicalMarketPrices() {
  const market=readJson(MARKET_DATA);
  const prices=market?.prices||{};
  const deterministicFixture=market?.validationFixture===true;
  const productionCanonical=market?.semantics?.perAssetAuthoritySelectionApplied===true;
  const entries=Object.entries(prices);
  if(entries.length!==26)throw new Error('general balance sheet requires complete 26-asset Market Data');
  if(!productionCanonical&&!deterministicFixture)throw new Error('general balance sheet requires canonical Market Data or explicit deterministic CI fixture');
  if(deterministicFixture&&Number(market?.semantics?.externalRequestCount)!==0)throw new Error('deterministic Market Data fixture must be zero-request');
  if(productionCanonical){
    if(Number(market?.authority?.unknownCount)!==0)throw new Error('general balance sheet refuses production Market Data with UNKNOWN assets');
    const onchainCount=Number(market?.authority?.onchainSelectedAssetCount);
    const fallbackCount=Number(market?.authority?.coingeckoSelectedAssetCount);
    if(!Number.isFinite(onchainCount)||!Number.isFinite(fallbackCount)||onchainCount+fallbackCount!==entries.length)throw new Error('general balance sheet requires complete per-asset authority lane coverage');
    if(Number(market?.coverage?.usableCoverage)!==1)throw new Error('general balance sheet requires fully usable canonical Market Data');
    for(const [id,row] of entries){
      const v=Number(row?.usd),lane=row?.authority?.selectedLane;
      if(!Number.isFinite(v)||v<=0)throw new Error(`${id}: canonical positive USD price unavailable`);
      if(row?.authority?.requestedPrimary!=='onchain')throw new Error(`${id}: onchain-primary request contract missing`);
      if(!['onchain','coingecko-lane'].includes(lane))throw new Error(`${id}: invalid canonical selected lane`);
      if(lane==='onchain'){
        if(row?.authority?.fallbackUsed!==false||!String(row?.source||'').startsWith('onchain-'))throw new Error(`${id}: invalid canonical onchain provenance`);
      }else if(row?.authority?.fallbackUsed!==true)throw new Error(`${id}: CoinGecko lane is allowed only as explicit fallback`);
    }
  }
  const out={},laneById={};
  for(const id of SHARED_MARKET_IDS){
    const row=prices[id],v=Number(row?.usd);
    if(!Number.isFinite(v)||v<=0)throw new Error(`missing canonical USD price for ${id}`);
    out[id]=v;
    laneById[id]=deterministicFixture?'deterministic-validation-fixture':row?.authority?.selectedLane||null;
  }
  return {prices:out,laneById,generatedAt:market.generatedAt||null,observedAt:market.observedAt||null,sha256:sha256File(MARKET_DATA),sourceFile:MARKET_DATA,deterministicFixture,productionCanonical,onchainSelectedAssetCount:productionCanonical?Number(market?.authority?.onchainSelectedAssetCount):null,coingeckoFallbackAssetCount:productionCanonical?Number(market?.authority?.coingeckoSelectedAssetCount):null,unknownCount:productionCanonical?Number(market?.authority?.unknownCount):null};
}

function assertCompleteStateRows(rows,{company,totalCostBasisUsd}){
  if(!Array.isArray(rows)||!rows.length)fail(`${company}: canonical current-capital rows missing`);
  let basis=0;
  for(const row of rows){
    if(!(Number(row.qty)>0))fail(`${company}: invalid quantity for ${row.id}`);
    if(!Number.isFinite(Number(row.costBasisUsd))||Number(row.costBasisUsd)<0)fail(`${company}: UNKNOWN cost basis for ${row.id}`);
    basis+=Number(row.costBasisUsd);
  }
  if(Math.abs(basis-Number(totalCostBasisUsd))>0.005)fail(`${company}: cost-basis total drift expected=${totalCostBasisUsd} actual=${basis}`);
}

const productivity=readJson(PRODUCTIVITY);
const defiteaState=readJson(DEFITEA_STATE);
const yieldRingState=readJson(YIELD_RING_STATE);
const company001OwnerSnapshot=readJson(COMPANY001_OWNER_SNAPSHOT);
if (!['1.15','1.16'].includes(productivity.version)) throw new Error(`unexpected Productivity version ${productivity.version}`);
if(defiteaState?.company?.name!=='defitea.eth'||defiteaState?.authority?.executionAuthority!=='none'||defiteaState?.costBasis?.status!=='complete')throw new Error('Defitea canonical state invalid');
if(yieldRingState?.company!=='YieldRing.eth'||yieldRingState?.authority?.executionAuthority!=='none'||yieldRingState?.portfolioCostBasis?.status!=='complete')throw new Error('YieldRing canonical state invalid');
if(company001OwnerSnapshot?.company!=='05081966.eth'||company001OwnerSnapshot?.authority?.executionAuthority!=='none')throw new Error('Company #001 owner snapshot invalid');

BOOK['defitea.eth']=(defiteaState.productivePositions||[]).map(p=>({id:p.assetId,qty:Number(p.quantity),layer:'productive-dividend',evidenceStatus:p.evidenceStatus||'owner-provided-portfolio-screenshot',costBasisUsd:Number(p.costBasisUsd),entryPriceUsd:Number(p.averageBuyPriceDisplayed),sourceType:'owner-provided-portfolio-screenshot'}));
BOOK['YieldRing.eth']=Object.values(yieldRingState.capital||{}).map(p=>({id:p.assetId,qty:Number(p.quantity),layer:p.assetId==='bitcoin'?'foundation':'productive-dividend',...(p.assetId==='bitcoin'?{priceSource:'shared-market-data'}:{}),evidenceStatus:p.evidenceStatus||'owner-provided-portfolio-screenshot',costBasisUsd:Number(p.costBasisUsd),sourceType:'owner-provided-portfolio-screenshot'}));
assertCompleteStateRows(BOOK['defitea.eth'],{company:'defitea.eth',totalCostBasisUsd:defiteaState.costBasis.totalUsd});
assertCompleteStateRows(BOOK['YieldRing.eth'],{company:'YieldRing.eth',totalCostBasisUsd:yieldRingState.portfolioCostBasis.totalUsd});

for(const p of company001OwnerSnapshot.positions||[]){
  if(p?.assetId!=='bitcoin'||Number(p?.quantity)<=0||p?.primaryCapitalLayer!=='foundation')throw new Error('Company #001 owner snapshot contains unsupported position');
  BOOK['05081966.eth'].push({id:p.assetId,qty:Number(p.quantity),layer:p.primaryCapitalLayer,priceSource:'shared-market-data',evidenceStatus:p.evidenceStatus||'owner-provided-current',note:p.note||null,entryPriceUsd:Number(p.entryPriceUsd),costBasisUsd:Number(p.costBasisUsd),sourceType:p.sourceType||'owner-confirmed-manual-current-snapshot'});
}

const browserCompanyBookBinding=bindUiCompanyBookSemantics(readUiCompanyBook());
const market=canonicalMarketPrices();
const companies=[];
let networkTotal=0,networkProductiveExposure=0;
const layerTotals={foundationUsd:0,productiveDividendUsd:0,stableReserveUsd:0,rwaUsd:0,ventureUsd:0,unclassifiedUsd:0};

for (const [registry,name] of REGISTRY) {
  const sourceRows=BOOK[name],pCompany=productivity.companies?.[name];
  if (!sourceRows || !pCompany) throw new Error(`${name}: missing Company Book or Productivity binding`);
  const pBreakdown=pCompany.breakdown||[];
  const productiveById=new Map(pBreakdown.map(p=>[p.principalId,p]));
  const productiveByEngine=new Map(pBreakdown.map(p=>[p.engineId,p]));
  const positions=[];
  const layers={foundationUsd:0,productiveDividendUsd:0,stableReserveUsd:0,rwaUsd:0,ventureUsd:0,unclassifiedUsd:0};
  let representedProductiveExposure=0;

  for (const row of sourceRows) {
    if (row.productivityOnly) {
      const pp=productiveByEngine.get(row.engineId);
      if (!pp) throw new Error(`${name}: productivityOnly row ${row.engineId} missing from canonical Productivity breakdown`);
      if (Math.abs(Number(pp.units)-Number(row.qty)) > Math.max(1e-9,Math.abs(Number(row.qty))*1e-9)) throw new Error(`${name}: productivityOnly quantity drift for ${row.engineId}`);
      const exposureValue=Number(pp.value);
      if (!Number.isFinite(exposureValue)||exposureValue<0) throw new Error(`${name}: invalid productive exposure for ${row.engineId}`);
      representedProductiveExposure+=exposureValue;
      positions.push({assetId:row.id,engineId:row.engineId,units:round(row.qty,12),priceUsd:round(pp.price,12),productiveExposureValueUsd:round(exposureValue),primaryCapitalLayer:null,productiveAttribute:true,productivityOnly:true,inclusion:'excluded-from-capital-total-productivity-representation',doubleCountPolicy:'excluded from capital total because the same economic BTC/ETH exposure is already represented by the parent Company Book holding; retained only as a Productivity attribute/proof'});
      continue;
    }

    let price=null,priceProvenance=null,productiveAttribute=false;
    const pp=productiveById.get(row.id);
    if (row.priceSource==='shared-market-data') {
      price=Number(market.prices[row.id]);
      const lane=market.laneById[row.id];
      priceProvenance=market.deterministicFixture?'deterministic-validation-fixture':lane==='onchain'?'canonical-shared-market-data-onchain':'canonical-shared-market-data-coingecko-fallback';
    } else {
      if (!pp) throw new Error(`${name}: productive Company Book row ${row.id} missing from canonical Productivity breakdown`);
      if (Math.abs(Number(pp.units)-Number(row.qty)) > Math.max(1e-9,Math.abs(Number(row.qty))*1e-9)) throw new Error(`${name}: quantity drift for ${row.id}`);
      price=Number(pp.price);
      priceProvenance='canonical-productivity-breakdown';
      productiveAttribute=true;
      representedProductiveExposure+=Number(pp.value);
    }
    if (!Number.isFinite(price)||price<=0) throw new Error(`${name}: invalid price for ${row.id}`);
    const value=Number(row.qty)*price;
    const key = row.layer==='foundation'?'foundationUsd':row.layer==='productive-dividend'?'productiveDividendUsd':row.layer==='unclassified'?'unclassifiedUsd':null;
    if (!key) throw new Error(`${name}: unsupported capital layer ${row.layer}`);
    layers[key]+=value;
    positions.push({assetId:row.id,units:round(row.qty,12),priceUsd:round(price,12),valueUsd:round(value),primaryCapitalLayer:row.layer,productiveAttribute,priceProvenance,evidenceStatus:row.evidenceStatus||'established',note:row.note||null,...(Number.isFinite(row.entryPriceUsd)?{entryPriceUsd:round(row.entryPriceUsd,6)}:{}),...(Number.isFinite(row.costBasisUsd)?{costBasisUsd:round(row.costBasisUsd,6),costBasisStatus:'complete'}:{}),...(row.sourceType?{sourceType:row.sourceType}:{}),inclusion:'included-once-in-company-total',productivityOnly:false});
  }

  const productiveExpected=Number(pCompany.productiveValue);
  if (!Number.isFinite(productiveExpected)||productiveExpected<0) throw new Error(`${name}: canonical Productive exposure unavailable`);
  if (Math.abs(representedProductiveExposure-productiveExpected)>0.05) throw new Error(`${name}: Company Book representations do not reconcile to canonical Productive exposure`);
  const total=Object.values(layers).reduce((s,v)=>s+v,0);
  if (!(total>0)) throw new Error(`${name}: total capital unavailable`);
  for (const k of Object.keys(layers)) { layers[k]=round(layers[k]); layerTotals[k]+=layers[k]; }
  networkTotal+=total;networkProductiveExposure+=productiveExpected;
  const completeBasis=(name==='defitea.eth'||name==='YieldRing.eth');
  companies.push({
    registry,name,status:'total-capital-complete',totalCapitalUsd:round(total),totalCapitalComplete:true,
    sourceScope:(name==='05081966.eth')?'browser-company-book-baseline-plus-canonical-owner-state':completeBasis?'canonical-company-state-projected-to-browser-company-book':'browser-company-book-normalized-to-machine-readable-balance-sheet',
    costBasisStatus:completeBasis?'complete':null,
    historicalCostBasisUsd:name==='defitea.eth'?Number(defiteaState.costBasis.totalUsd):name==='YieldRing.eth'?Number(yieldRingState.portfolioCostBasis.totalUsd):null,
    productiveMeasuredExposureUsd:round(productiveExpected),primaryProductiveDividendCapitalUsd:round(layers.productiveDividendUsd),productiveExposureOutsidePrimaryProductiveLayerUsd:round(Math.max(0,productiveExpected-layers.productiveDividendUsd)),layerValues:layers,
    epistemicNote:name==='1milliondollar.eth'?'Total includes an explicitly disclosed owner-observed WETH component; provenance is preserved rather than silently upgraded to independently reproduced onchain evidence.':name==='YieldRing.eth'?'Current quantities and acquisition basis are owner-evidenced and complete for Performance; independent blockchain-native reproduction remains pending and is not falsely claimed.':name==='defitea.eth'?'Current quantities and historical acquisition basis are complete from owner-provided holdings screenshots; live market value remains canonical-market-data-driven.':name==='05081966.eth'?'Current BTC position is owner-confirmed manual evidence pending unified blockchain-native balance discovery.':null,
    positions
  });
}

for (const k of Object.keys(layerTotals)) layerTotals[k]=round(layerTotals[k]);
const output={
  version:'0.1-general-company-balance-sheet',
  engineVersion:'0.2.4-complete-company-basis',
  generatedAt:new Date().toISOString(),status:'ok',
  purpose:'Machine-readable total-capital binding for the eight general Registry companies. Defitea and YieldRing consume complete canonical acquisition-basis states; current valuation remains canonical-market-data-driven. Browser Company Book remains a semantic projection/guard rather than a competing source of truth.',
  authority:{readOnly:true,executionAuthority:'none',capitalExecution:false,allocationAuthority:false,policyMutationAuthority:false,methodologyMutationAuthority:false},
  semantics:{unknownPolicy:'unknown != zero',partialCostBasisIsNotTotal:true,completeCostBasisRequiresEveryCurrentPosition:true,newPositionWithoutBasisRevertsPerformanceToPartial:true,ownerConfirmedManualSnapshotIsNotOnchainObservation:true,browserCompanyBookGuard:'semantic-quantity-and-inclusion-binding',publicSitePolishDoesNotInvalidateCompanyBook:true,marketPriceAuthority:market.deterministicFixture?'deterministic zero-request CI fixture':'canonical per-asset Market Data; onchain primary with explicit bounded CoinGecko fallback; no direct external price request',deterministicValidationFixture:market.deterministicFixture,perAssetFallbackAllowed:!market.deterministicFixture,productionUnknownAccepted:false,doubleCountPolicy:'productivityOnly rows never add a second copy of parent BTC/ETH economic exposure',productiveExposure:'A capital position can be economically productive while its primary capital layer remains Foundation or another layer; Productivity is an earning attribute, not automatically a Productive Dividend capital classification.',layerTaxonomy:['foundation','productive-dividend','stable-reserve','rwa','venture','unclassified']},
  sourceState:{
    browserCompanyBook:{file:UI_BOOK_SOURCE,semanticBindingSha256:browserCompanyBookBinding.sha256,semanticFields:browserCompanyBookBinding.semanticFields,companyCount:browserCompanyBookBinding.companyCount,sha256:sha256File(UI_BOOK_SOURCE),role:'browser projection semantic quantities/inclusion; unrelated public-site polish may change surrounding HTML without invalidating capital normalization'},
    defiteaCanonicalState:{file:DEFITEA_STATE,version:defiteaState.version||null,effectiveAt:defiteaState.effectiveAt||null,sha256:sha256File(DEFITEA_STATE),role:'current canonical Defitea quantities plus complete historical acquisition basis from owner-provided holdings evidence'},
    yieldRingCanonicalState:{file:YIELD_RING_STATE,version:yieldRingState.version||null,effectiveAt:yieldRingState.effectiveAt||null,sha256:sha256File(YIELD_RING_STATE),role:'current canonical YieldRing quantities plus complete historical acquisition basis; blockchain-native reconciliation status remains explicit'},
    company001OwnerSnapshot:{file:COMPANY001_OWNER_SNAPSHOT,version:company001OwnerSnapshot.version||null,asOf:company001OwnerSnapshot.asOf||null,sha256:sha256File(COMPANY001_OWNER_SNAPSHOT),role:'provenance-explicit temporary current-capital bridge; not independently reproduced onchain'},
    productivity:{file:PRODUCTIVITY,version:productivity.version,generatedAt:productivity.generatedAt||null,sha256:sha256File(PRODUCTIVITY),role:'productive quantity/exposure reconciliation and productive-asset current prices'},
    marketData:{file:market.sourceFile,generatedAt:market.generatedAt,observedAt:market.observedAt,sha256:market.sha256,assetIds:SHARED_MARKET_IDS,onchainSelectedAssetCount:market.onchainSelectedAssetCount,coingeckoFallbackAssetCount:market.coingeckoFallbackAssetCount,unknownCount:market.unknownCount,role:market.deterministicFixture?'deterministic zero-request validation prices; never production authority':'canonical per-asset BTC/ETH/ZK prices; onchain primary with explicit bounded fallback; no direct external price request'}
  },
  network:{generalCompanyCount:REGISTRY.length,totalCapitalCompleteCompanyCount:companies.length,generalCompanyTvlUsd:round(networkTotal),productiveMeasuredExposureUsd:round(networkProductiveExposure),primaryProductiveDividendCapitalUsd:round(layerTotals.productiveDividendUsd),layerValues:layerTotals},
  companies,
  gaps:[
    {id:'company-009-owner-observed-weth-proof',severity:'evidence-quality',affects:['company-009-foundation-provenance'],detail:'0.1606 WETH remains owner-observed and is not silently represented as independently reproduced onchain evidence.'},
    {id:'company-002-onchain-reconciliation-pending',severity:'evidence-quality',affects:['company-002-provenance'],detail:'YieldRing quantities and acquisition basis are complete from owner evidence, but blockchain-native reproduction of all direct and protocol-managed positions remains pending; no onchain confirmation is fabricated.'},
    {id:'company-001-btc-manual-current-snapshot',severity:'evidence-quality',affects:['company-001-current-capital-provenance'],detail:'0.00205 BTC is owner-confirmed current capital and explicitly remains manual evidence until blockchain-native discovery reproduces it.'},
    {id:'unclassified-zk-layer',severity:'classification',affects:['registry-007-layer-allocation'],detail:'ZK is included in total capital but remains unclassified rather than being promoted into Foundation/Productive/RWA/Venture without a proven economic-layer rule.'}
  ]
};

fs.mkdirSync(path.dirname(OUT),{recursive:true});
fs.writeFileSync(OUT,JSON.stringify(output,null,2)+'\n');
console.log('General company balance sheet built',{
  companies:companies.length,
  generalCompanyTvlUsd:output.network.generalCompanyTvlUsd,
  productiveMeasuredExposureUsd:output.network.productiveMeasuredExposureUsd,
  defiteaCostBasisUsd:Number(defiteaState.costBasis.totalUsd),
  yieldRingCostBasisUsd:Number(yieldRingState.portfolioCostBasis.totalUsd),
  marketDataSha256:market.sha256,
  deterministicValidationFixture:market.deterministicFixture,
  executionAuthority:'none'
});
