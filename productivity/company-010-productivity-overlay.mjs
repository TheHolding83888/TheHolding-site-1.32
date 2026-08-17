#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const ROOT=process.cwd();
const DATA=process.env.PRODUCTIVITY_DATA||path.join(ROOT,'companies/productivity-data.json');
const STATE=process.env.COMPANY_010_STATE||path.join(ROOT,'companies/company-010-production-state.json');
const REPORT=process.env.PRODUCTIVITY_REPORT||path.join(ROOT,'companies/productivity-source-report.json');
const VERSION='1.16';
const COLLECTOR='1.16-company-010-state-backed-productivity-admission';
const METHODOLOGY='1.1-simple-safe';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const n=x=>Number.isFinite(Number(x))?Number(x):null;
const round=(x,d=4)=>n(x)===null?null:Number(Number(x).toFixed(d));

const data=read(DATA),state=read(STATE);
if(!['1.15','1.16'].includes(String(data.version)))throw new Error(`Productivity v1.15/v1.16 required, got ${data.version}`);
if(data.methodologyVersion!==METHODOLOGY)throw new Error('Productivity methodology mismatch');
if(state?.version!=='0.3-company-010-production-state-stakedao-complete'||state?.company?.registry!=='010'||state?.company?.name!=='Cypher')throw new Error('complete Cypher production state required');
if(state?.authority?.executionAuthority!=='none'||state?.epistemicBoundary?.unknownIsNotZero!==true||state?.epistemicBoundary?.noDoubleCount!==true)throw new Error('Cypher authority/epistemic boundary mismatch');

const positions=Array.isArray(state.productivity?.positions)?state.productivity.positions:[];
if(!positions.length)throw new Error('Cypher productive positions unavailable');
data.engines=data.engines||{};
const synthetic={};
let total=0,covered=0,weighted=0;
const breakdown=[];
for(const p of positions){
  const id=String(p.id||'').trim();
  const value=n(p.valueUsd);
  if(!id||value===null||value<0)throw new Error(`invalid Cypher productivity row ${id||'missing-id'}`);
  total+=value;
  let apr=null,engineStatus='warming',source=p.source||null,sourceType='company-010-canonical-state';
  if(p.status==='supported-existing-adapter'){
    const e=data.engines[id];
    const live=n(e?.aprLatest);
    if(live!==null){apr=live;engineStatus=e?.status||'ok';source=e?.source||source;sourceType=e?.sourceType||'existing-global-engine';}
  }else if(p.status==='measured'&&n(p.referenceAprPct)!==null){
    apr=n(p.referenceAprPct);engineStatus='ok';
    synthetic[id]={engineId:id,protocol:String(p.label||id).split(' · ')[0],principalSymbol:null,sourceUrl:source,nativeCadence:'current-state',aprLatest:round(apr),sourceType:'company-010-canonical-state',sourceMetric:String(p.label||id)+' Reference APR',source,periodStart:null,periodEnd:state.generatedAt||data.generatedAt,lastUpdatedAt:state.generatedAt||data.generatedAt,status:'ok',methodologyVersion:METHODOLOGY,collectorVersion:COLLECTOR,details:{company:'Cypher',registry:'010',stateVersion:state.version,scope:'state-backed measured Reference APR; not realised cash flow'}};
  }
  if(apr!==null){covered+=value;weighted+=value*apr;}
  else if(!data.engines[id]){
    synthetic[id]={engineId:id,protocol:String(p.label||id).split(' · ')[0],principalSymbol:null,sourceUrl:source,nativeCadence:'current-state',aprLatest:null,sourceType:'company-010-canonical-state',sourceMetric:null,source,periodStart:null,periodEnd:state.generatedAt||data.generatedAt,lastUpdatedAt:state.generatedAt||data.generatedAt,status:'warming',methodologyVersion:METHODOLOGY,collectorVersion:COLLECTOR,details:{company:'Cypher',registry:'010',stateVersion:state.version,reason:'Reference APR not reproducibly bound; unknown is excluded, never zero'}};
  }
  breakdown.push({engineId:id,principalId:id,units:n(p.quantity),price:null,value:round(value,2),apr:apr===null?null:round(apr),engineStatus:apr===null?'warming':engineStatus,source});
}
Object.assign(data.engines,synthetic);
const coverage=total>0?covered/total:0;
const aprLatest=covered>0?weighted/covered:null;
const prior=data.companies?.Cypher||null;
data.companies=data.companies||{};
data.companies.Cypher={aprLatest:aprLatest===null?null:round(aprLatest),aprHistoricalAverage:prior?.aprHistoricalAverage??null,observationCount:Number(prior?.observationCount||0),trackingStartedAt:prior?.trackingStartedAt||null,updatedAt:state.generatedAt||data.generatedAt,source:'the-holding-productivity-intelligence-layer',status:coverage>=0.999999&&aprLatest!==null?'ok':'partial',aprScope:coverage>=0.999999?'full-productive-capital':'covered-productive-capital',coverage:round(coverage,4),productiveValue:round(total,2),coveredProductiveValue:round(covered,2),uncoveredProductiveValue:round(Math.max(0,total-covered),2),breakdown,provenance:{companyStateVersion:state.version,companyStateGeneratedAt:state.generatedAt,admission:'state-backed-company-010'}};

data.companyMetadata=data.companyMetadata||{};
data.companyMetadata.Cypher={registry:'010',foundedISO:'2025-07-04',source:'companies/company-010-production-state.json',architecture:'The Holding Standard'};
data.version=VERSION;
data.collectorVersion=COLLECTOR;
data.generatedAt=new Date().toISOString();
data.note='Reference APRs are normalized from official protocol APIs, onchain state, official protocol frontends, and canonical state-backed company mechanisms. Company APR is capital-weighted across productive positions with valid Reference APRs. coverage shows the share currently included; unknown engines are excluded, never treated as 0%. Cypher reuses mature global engines for supported mechanisms and canonical measured state for GMX, HyperLend and Stake DAO.';
data.diagnostics=data.diagnostics||{};
data.diagnostics.company010={status:'admitted',stateVersion:state.version,stateGeneratedAt:state.generatedAt,totalProductiveValueUsd:round(total,2),coveredProductiveValueUsd:round(covered,2),coverage:round(coverage,6),unknownEngineIds:breakdown.filter(x=>x.apr===null).map(x=>x.engineId),executionAuthority:'none'};
fs.writeFileSync(DATA,JSON.stringify(data,null,2)+'\n');

if(fs.existsSync(REPORT)){
  const report=read(REPORT);report.collectorVersion=COLLECTOR;report.generatedAt=data.generatedAt;report.engines=report.engines||{};
  for(const [id,e] of Object.entries(synthetic))report.engines[id]={protocol:e.protocol,status:e.status,apr:e.aprLatest,source:e.source,sourceType:e.sourceType,sourceMetric:e.sourceMetric,periodStart:e.periodStart,periodEnd:e.periodEnd,error:null,details:e.details};
  report.company010={status:'admitted',company:data.companies.Cypher,stateVersion:state.version};
  fs.writeFileSync(REPORT,JSON.stringify(report,null,2)+'\n');
}
console.log(JSON.stringify({status:'PASS',version:VERSION,company:'Cypher',aprLatest:data.companies.Cypher.aprLatest,productiveValue:data.companies.Cypher.productiveValue,coveredProductiveValue:data.companies.Cypher.coveredProductiveValue,coverage:data.companies.Cypher.coverage,unknown:breakdown.filter(x=>x.apr===null).map(x=>x.engineId),executionAuthority:'none'},null,2));