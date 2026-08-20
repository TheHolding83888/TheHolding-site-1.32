import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';

const ROOT = process.cwd();
const OUT = path.join(ROOT, 'intelligence/capital-state/general-company-balance-sheet.json');
const PRODUCTIVITY = 'companies/productivity-data.json';
const UI_BOOK_SOURCE = 'companies/index.html';

const EXPECTED_UI_BLOB_SHA = '014e3a6fb8886e129df34fa0753db15d54eda694';

const BOOK = {
  'defitea.eth': [
    { id:'aerodrome-finance', qty:2632, layer:'productive-dividend' },
    { id:'convex-finance', qty:1333, layer:'productive-dividend' },
    { id:'curve-dao-token', qty:4125, layer:'productive-dividend' },
    { id:'pendle', qty:500, layer:'productive-dividend' },
    { id:'fxn-token', qty:64.81, layer:'productive-dividend' },
    { id:'yield-basis', qty:10846, layer:'productive-dividend' },
    { id:'frax-share', qty:4224, layer:'productive-dividend' },
    { id:'velodrome-finance', qty:12180, layer:'productive-dividend' },
    { id:'venice-token', qty:50, layer:'productive-dividend' },
    { id:'liquity', qty:1488, layer:'productive-dividend' },
    { id:'resupply', qty:3682, layer:'productive-dividend' }
  ],
  'YieldRing.eth': [
    { id:'bitcoin', qty:0.0334, layer:'foundation', priceSource:'coingecko' },
    { id:'aerodrome-finance', qty:678, layer:'productive-dividend' },
    { id:'convex-finance', qty:240, layer:'productive-dividend' },
    { id:'frax-share', qty:800, layer:'productive-dividend' }
  ],
  '05081966.eth': [
    { id:'aerodrome-finance', qty:202, layer:'productive-dividend' },
    { id:'curve-dao-token', qty:480, layer:'productive-dividend' },
    { id:'frax-share', qty:393, layer:'productive-dividend' }
  ],
  'dinaz.eth': [
    { id:'yield-basis', qty:12029, layer:'productive-dividend' }
  ],
  '0x5860...83CA8.eth': [
    { id:'bitcoin', qty:0.1241, layer:'foundation', priceSource:'coingecko' },
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
    { id:'bitcoin', qty:0.09949873, layer:'foundation', priceSource:'coingecko' },
    { id:'ethereum', qty:1.083229073375, layer:'foundation', priceSource:'coingecko' },
    { id:'aerodrome-finance', qty:4330.755126048871, layer:'productive-dividend' },
    { id:'convex-finance', qty:336.240148815125, layer:'productive-dividend' },
    { id:'curve-dao-token', qty:1368.677426931635, layer:'productive-dividend' },
    { id:'zksync', qty:8573.908961603593, layer:'unclassified', priceSource:'coingecko' },
    { id:'bitcoin', qty:0.00335757, layer:'productive-dividend', productivityOnly:true, engineId:'yieldbasis_yblp_wbtc' },
    { id:'ethereum', qty:0.29309327939659907, layer:'productive-dividend', productivityOnly:true, engineId:'yieldbasis_yblp_weth' }
  ],
  '1milliondollar.eth': [
    { id:'bitcoin', qty:0.07264572, layer:'foundation', priceSource:'coingecko' },
    { id:'ethereum', qty:0.167026130614, layer:'foundation', priceSource:'coingecko', evidenceStatus:'mixed-verified-native-plus-owner-observed', note:'0.006426130614 ETH verified native + 0.1606 owner-observed WETH; owner-observed component is not independently reproduced onchain.' },
    { id:'aerodrome-finance', qty:214.798088305326, layer:'productive-dividend' },
    { id:'convex-crv', qty:468.390991181449, layer:'productive-dividend' },
    { id:'yield-basis', qty:3737.585758274693, layer:'productive-dividend' }
  ]
};

const REGISTRY = [
  ['001','05081966.eth'],['002','YieldRing.eth'],['003','dinaz.eth'],['004','defitea.eth'],
  ['005','0x5860...83CA8.eth'],['006','aerocvxyb.eth'],['007',"Rook's portfolio"],['009','1milliondollar.eth']
];

const COINGECKO_IDS = ['bitcoin','ethereum','zksync'];
const round = (n,d=6) => { const p=10**d; return Number.isFinite(Number(n)) ? Math.round(Number(n)*p)/p : null; };
const readJson = rel => JSON.parse(fs.readFileSync(path.join(ROOT, rel),'utf8'));
const sha256File = rel => crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT,rel))).digest('hex');
const gitBlobSha = rel => {
  const buf=fs.readFileSync(path.join(ROOT,rel));
  return crypto.createHash('sha1').update(Buffer.from(`blob ${buf.length}\0`)).update(buf).digest('hex');
};

async function livePrices() {
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${COINGECKO_IDS.join(',')}&vs_currencies=usd`;
  const r = await fetch(url, { headers:{accept:'application/json','user-agent':'The-Holding-Capital-State/0.2'} });
  if (!r.ok) throw new Error(`CoinGecko price request failed: ${r.status}`);
  const j = await r.json();
  const out={};
  for (const id of COINGECKO_IDS) {
    const v=Number(j?.[id]?.usd);
    if (!Number.isFinite(v) || v<=0) throw new Error(`missing live USD price for ${id}`);
    out[id]=v;
  }
  return { prices:out, sourceUrl:url, fetchedAt:new Date().toISOString() };
}

const productivity=readJson(PRODUCTIVITY);
if (!['1.15','1.16'].includes(productivity.version)) throw new Error(`unexpected Productivity version ${productivity.version}`);
if (gitBlobSha(UI_BOOK_SOURCE) !== EXPECTED_UI_BLOB_SHA) {
  throw new Error('companies/index.html changed since Company Book normalization; review browser Company Book before publishing balance sheet');
}

const cg=await livePrices();
const companies=[];
let networkTotal=0;
let networkProductiveExposure=0;
const layerTotals={foundationUsd:0,productiveDividendUsd:0,stableReserveUsd:0,rwaUsd:0,ventureUsd:0,unclassifiedUsd:0};

for (const [registry,name] of REGISTRY) {
  const sourceRows=BOOK[name];
  const pCompany=productivity.companies?.[name];
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
      positions.push({
        assetId:row.id,engineId:row.engineId,units:round(row.qty,12),priceUsd:round(pp.price,12),productiveExposureValueUsd:round(exposureValue),
        primaryCapitalLayer:null,productiveAttribute:true,productivityOnly:true,
        inclusion:'excluded-from-capital-total-productivity-representation',
        doubleCountPolicy:'excluded from capital total because the same economic BTC/ETH exposure is already represented by the parent Company Book holding; retained only as a Productivity attribute/proof'
      });
      continue;
    }

    let price=null;
    let priceProvenance=null;
    let productiveAttribute=false;
    const pp=productiveById.get(row.id);
    if (row.priceSource==='coingecko') {
      price=Number(cg.prices[row.id]);
      priceProvenance='coingecko-live-simple-price';
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
    positions.push({
      assetId:row.id, units:round(row.qty,12), priceUsd:round(price,12), valueUsd:round(value),
      primaryCapitalLayer:row.layer, productiveAttribute, priceProvenance,
      evidenceStatus:row.evidenceStatus||'established', note:row.note||null,
      inclusion:'included-once-in-company-total', productivityOnly:false
    });
  }

  const productiveExpected=Number(pCompany.productiveValue);
  if (!Number.isFinite(productiveExpected)||productiveExpected<0) throw new Error(`${name}: canonical Productive exposure unavailable`);
  if (Math.abs(representedProductiveExposure-productiveExpected)>0.05) throw new Error(`${name}: Company Book representations do not reconcile to canonical Productive exposure`);

  const total=Object.values(layers).reduce((s,v)=>s+v,0);
  if (!(total>0)) throw new Error(`${name}: total capital unavailable`);

  for (const k of Object.keys(layers)) { layers[k]=round(layers[k]); layerTotals[k]+=layers[k]; }
  networkTotal+=total;
  networkProductiveExposure+=productiveExpected;
  companies.push({
    registry,name,status:'total-capital-complete',totalCapitalUsd:round(total),totalCapitalComplete:true,
    sourceScope:'browser-company-book-normalized-to-machine-readable-balance-sheet',
    productiveMeasuredExposureUsd:round(productiveExpected),
    primaryProductiveDividendCapitalUsd:round(layers.productiveDividendUsd),
    productiveExposureOutsidePrimaryProductiveLayerUsd:round(Math.max(0,productiveExpected-layers.productiveDividendUsd)),
    layerValues:layers,
    epistemicNote:name==='1milliondollar.eth'?'Total includes an explicitly disclosed owner-observed WETH component; provenance is preserved rather than silently upgraded to independently reproduced onchain evidence.':null,
    positions
  });
}

for (const k of Object.keys(layerTotals)) layerTotals[k]=round(layerTotals[k]);
const output={
  version:'0.1-general-company-balance-sheet',
  engineVersion:'0.1-browser-book-bound-balance-sheet-normalizer',
  generatedAt:new Date().toISOString(),status:'ok',
  purpose:'Machine-readable total-capital binding for the eight general Registry companies, normalized from the existing browser Company Book and reconciled against canonical Productivity without conflating productive exposure with primary capital layer.',
  authority:{readOnly:true,executionAuthority:'none',capitalExecution:false,allocationAuthority:false,policyMutationAuthority:false,methodologyMutationAuthority:false},
  semantics:{
    unknownPolicy:'unknown != zero',
    doubleCountPolicy:'productivityOnly rows never add a second copy of parent BTC/ETH economic exposure',
    productiveExposure:'A capital position can be economically productive while its primary capital layer remains Foundation or another layer; Productivity is an earning attribute, not automatically a Productive Dividend capital classification.',
    layerTaxonomy:['foundation','productive-dividend','stable-reserve','rwa','venture','unclassified']
  },
  sourceState:{
    browserCompanyBook:{file:UI_BOOK_SOURCE,gitBlobSha:EXPECTED_UI_BLOB_SHA,sha256:sha256File(UI_BOOK_SOURCE),role:'existing UI Company Book quantities and inclusion semantics'},
    productivity:{file:PRODUCTIVITY,version:productivity.version,generatedAt:productivity.generatedAt||null,sha256:sha256File(PRODUCTIVITY),role:'productive quantity/exposure reconciliation and productive-asset current prices'},
    livePrices:{provider:'CoinGecko',ids:COINGECKO_IDS,sourceUrl:cg.sourceUrl,fetchedAt:cg.fetchedAt,role:'current BTC/ETH/ZK prices already used by the public browser TVL surface'}
  },
  network:{
    generalCompanyCount:REGISTRY.length,
    totalCapitalCompleteCompanyCount:companies.length,
    generalCompanyTvlUsd:round(networkTotal),
    productiveMeasuredExposureUsd:round(networkProductiveExposure),
    primaryProductiveDividendCapitalUsd:round(layerTotals.productiveDividendUsd),
    layerValues:layerTotals
  },
  companies,
  gaps:[
    {id:'company-009-owner-observed-weth-proof',severity:'evidence-quality',affects:['company-009-foundation-provenance'],detail:'0.1606 WETH remains owner-observed and is not silently represented as independently reproduced onchain evidence.'},
    {id:'unclassified-zk-layer',severity:'classification',affects:['registry-007-layer-allocation'],detail:'ZK is included in total capital but remains unclassified rather than being promoted into Foundation/Productive/RWA/Venture without a proven economic-layer rule.'}
  ]
};

fs.mkdirSync(path.dirname(OUT),{recursive:true});
fs.writeFileSync(OUT,JSON.stringify(output,null,2)+'\n');
console.log('General company balance sheet built',{
  companies:companies.length,
  generalCompanyTvlUsd:output.network.generalCompanyTvlUsd,
  productiveMeasuredExposureUsd:output.network.productiveMeasuredExposureUsd,
  primaryProductiveDividendCapitalUsd:output.network.primaryProductiveDividendCapitalUsd,
  executionAuthority:output.authority.executionAuthority
});
