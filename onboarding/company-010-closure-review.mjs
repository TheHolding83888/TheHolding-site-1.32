#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const VERSION='0.4.1-company-010-economic-closure-reviewed';
const FILE=process.env.COMPANY_010_CLOSURE_OUTPUT||path.resolve('companies/company-010-closure.json');
const lower=x=>String(x||'').toLowerCase();
const round=(x,d=6)=>Number.isFinite(Number(x))?Number(Number(x).toFixed(d)):null;

async function fetchJson(url){const c=new AbortController(),t=setTimeout(()=>c.abort(),25000);try{const r=await fetch(url,{headers:{accept:'application/json','user-agent':'The-Holding-Cypher-Closure-Reviewer/0.4.1'},signal:c.signal,cache:'no-store'});if(!r.ok)throw new Error(`HTTP ${r.status}`);return await r.json()}finally{clearTimeout(t)}}
function exactAddressEntry(map,address){if(!map||typeof map!=='object'||Array.isArray(map))return null;const target=lower(address);for(const [k,v] of Object.entries(map))if(lower(k)===target)return{key:k,value:v};return null}
function normalizePct(x){let n=Number(x);if(!Number.isFinite(n))return null;if(Math.abs(n)<=1)n*=100;return round(n,6)}

const d=JSON.parse(fs.readFileSync(FILE,'utf8'));
if(d.version!=='0.4-company-010-economic-closure')throw new Error(`unexpected input ${d.version}`);
if(d.company?.registry!=='010'||d.company?.name!=='Cypher')throw new Error('company binding mismatch');
const api=await fetchJson('https://arbitrum-api.gmxinfra.io/apy?period=30d');
const markets=api?.markets;
if(!markets||typeof markets!=='object'||Array.isArray(markets))throw new Error('GMX /apy markets map missing');
const proofs=[];
for(const p of d.closure?.gmx?.positions||[]){const exact=exactAddressEntry(markets,p.token);if(!exact)throw new Error(`GMX APY exact market missing ${p.token}`);const raw=exact.value?.apy??exact.value?.baseApy??null;const pct=normalizePct(raw);if(pct===null)throw new Error(`GMX APY invalid ${p.token}`);p.referenceAprStatus='measured';p.referenceAprPct=pct;p.referenceAprEvidence={method:'exact-address-key-in-official-gmx-apy-markets-map',period:'30d',marketToken:p.token,matchedKey:exact.key,rawApy:Number(raw),referenceAprPct:pct,baseApy:Number.isFinite(Number(exact.value?.baseApy))?Number(exact.value.baseApy):null,boostedApy:Number.isFinite(Number(exact.value?.boostedApy))?Number(exact.value.boostedApy):null};proofs.push({marketToken:p.token,matchedKey:exact.key,referenceAprPct:pct})}
if(proofs.length!==2)throw new Error(`expected exactly two GMX positions, got ${proofs.length}`);
if(new Set(proofs.map(x=>lower(x.matchedKey))).size!==proofs.length)throw new Error('GMX APY address binding is not one-to-one');
d.unresolved=(d.unresolved||[]).filter(x=>x!=='gmx-reference-apr');
d.version=VERSION;
d.review={gmxExactAddressBinding:true,reviewedAt:new Date().toISOString(),source:'GMX official Oracle API /apy?period=30d',proofs,originalBroadParserRejected:true,rule:'Never derive one market APR by scanning a parent object containing multiple markets.'};
d.readiness.gmxApr='measured-exact-address-bound';
d.readiness.readyForProductionIntegrator=true;
fs.writeFileSync(FILE,JSON.stringify(d,null,2)+'\n');
console.log(JSON.stringify({version:VERSION,proofs,unresolved:d.unresolved,ready:d.readiness.readyForProductionIntegrator,executionAuthority:d.epistemicBoundary.executionAuthority},null,2));
