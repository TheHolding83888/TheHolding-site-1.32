#!/usr/bin/env node
import fs from 'node:fs';
import { Contract, JsonRpcProvider, formatUnits, getAddress } from 'ethers';

const STATE=process.env.COMPANY_010_STATE||'companies/company-010-production-state.json';
const RPCS=[...new Set([process.env.ETH_RPC_URL,process.env.ETH_RPC_URL_2,'https://ethereum-rpc.publicnode.com','https://eth.llamarpc.com'].filter(Boolean))];
const UTILITY=getAddress('0xadd2F542f9FF06405Fabf8CaE4A74bD0FE29c673');
const WRAPPER=getAddress('0xaa0C3f5F7DFD688C6E646F66CD2a6B66ACdbE434');
const CVXCRV=getAddress('0x62B9c7356A2Dc64a1969e19C23e4f579F9810Aa7');
const SECONDS_YEAR=365*24*60*60;
const ABI=[
  'function stkcvxcrv() view returns (address)',
  'function accountRewardRates(address account) view returns (address[] tokens,uint256[] rates,uint256[] groups)',
  'function accountExtraRewardRates(address account) view returns (address[] tokens,uint256[] rates,uint256[] groups)'
];
const ERC20=['function symbol() view returns (string)'];
const round=(x,d=8)=>Number(Number(x).toFixed(d));

async function provider(){let last;for(const url of RPCS){try{const p=new JsonRpcProvider(url,1,{staticNetwork:true});await p.getBlockNumber();return p}catch(e){last=e}}throw last||new Error('Ethereum RPC unavailable')}
async function prices(tokens){
 const ids=[...new Set(tokens.map(t=>`ethereum:${t.toLowerCase()}`))];
 const r=await fetch(`https://coins.llama.fi/prices/current/${ids.join(',')}`,{headers:{accept:'application/json'}});
 if(!r.ok)throw new Error(`DeFiLlama prices HTTP ${r.status}`);
 const j=await r.json(),out=new Map();
 for(const t of tokens){const k=`ethereum:${t.toLowerCase()}`,v=Number(j?.coins?.[k]?.price);if(v>0)out.set(t.toLowerCase(),v)}
 return out;
}
async function symbol(p,t){try{return await new Contract(t,ERC20,p).symbol()}catch{return t.slice(0,6)+'…'+t.slice(-4)}}
function rows(tuple,source){const [tokens,rates,groups]=tuple;return tokens.map((t,i)=>({token:getAddress(t),rateRaw:BigInt(rates[i]),group:Number(groups[i]),source})).filter(x=>x.rateRaw>0n)}

async function main(){
 const d=JSON.parse(fs.readFileSync(STATE,'utf8'));
 if(d.company?.registry!=='010'||d.company?.name!=='Cypher'||d.authority?.executionAuthority!=='none')throw new Error('Cypher canonical state / authority mismatch');
 const cvx=d.strategies?.crv?.strategies?.find(x=>x.id==='convex-staked-cvxcrv');
 const prod=(d.productivity?.positions||[]).find(x=>x.id==='convex_staked_cvxcrv');
 if(!cvx||!prod||!(Number(cvx.principal?.cvxCRV)>0))throw new Error('Cypher staked cvxCRV strategy missing');
 const account=d.company.wallets?.find(x=>x.alias==='Wallet 2')?.address;
 if(!account)throw new Error('Cypher Wallet 2 missing');
 const p=await provider(),u=new Contract(UTILITY,ABI,p);
 const bound=getAddress(await u.stkcvxcrv());if(bound!==WRAPPER)throw new Error(`Convex utility wrapper mismatch ${bound}`);
 const [mainRates,extraRates]=await Promise.all([u.accountRewardRates(account),u.accountExtraRewardRates(account)]);
 const streams=[...rows(mainRates,'main'),...rows(extraRates,'extra')];
 if(!streams.length)throw new Error('No positive Convex reward streams; fail closed');
 const allTokens=[CVXCRV,...streams.map(x=>x.token)],px=await prices(allTokens),depositPrice=px.get(CVXCRV.toLowerCase());
 if(!(depositPrice>0))throw new Error('cvxCRV price unavailable');
 const measured=[];let apr=0;
 for(const s of streams){const price=px.get(s.token.toLowerCase());if(!(price>0))throw new Error(`positive reward stream unpriced ${s.token}`);const ratePerSecond=Number(formatUnits(s.rateRaw,18));const component=ratePerSecond*SECONDS_YEAR*price/depositPrice*100;if(!Number.isFinite(component)||component<0||component>1000)throw new Error(`invalid component APR ${s.token}: ${component}`);apr+=component;measured.push({token:s.token,symbol:await symbol(p,s.token),group:s.group,source:s.source,ratePerSecond:round(ratePerSecond,18),priceUsd:round(price,8),aprPct:round(component,8)})}
 if(!(apr>=0&&apr<=1000))throw new Error(`invalid aggregate APR ${apr}`);
 const now=new Date().toISOString();
 const proof={version:'0.1-convex-official-account-reward-rates',generatedAt:now,account:getAddress(account),utility:UTILITY,wrapper:WRAPPER,depositToken:CVXCRV,depositPriceUsd:round(depositPrice,8),referenceAprPct:round(apr,8),streams:measured,source:'Convex official CvxCrvUtilities accountRewardRates + accountExtraRewardRates; DeFiLlama contract prices',executionAuthority:'none'};
 Object.assign(cvx.yield,{referenceAprPct:proof.referenceAprPct,status:'measured',source:'Convex official CvxCrvUtilities onchain account reward rates',metric:'Convex preference-weighted current reward-stream vAPR',methodology:'Official accountRewardRates/accountExtraRewardRates already apply current user reward preference and CVX mint conversion. Every positive stream must be priced; otherwise APR fails closed.',publicStatus:'Claimable',incomeMode:'separate-claimable-rewards',claimableApplicable:true,proof});
 Object.assign(prod,{referenceAprPct:proof.referenceAprPct,status:'measured',source:'Convex official CvxCrvUtilities onchain account reward rates',referenceMetric:'Convex preference-weighted current reward-stream vAPR',incomeMode:'separate-claimable-rewards',claimableApplicable:true,methodology:'Official account-specific reward-stream rates; separate Unclaimed rewards remain distinct from Reference APR.'});
 d.gaps=(d.gaps||[]).filter(x=>x.id!=='convex-staked-cvxcrv-reference-apr');
 d.provenance=d.provenance||{};d.provenance.convexCvxCrvRate=proof;
 fs.writeFileSync(STATE,JSON.stringify(d,null,2)+'\n');
 console.log('COMPANY #010 CONVEX cvxCRV RATE PASS',JSON.stringify({aprPct:proof.referenceAprPct,streamCount:measured.length,streams:measured.map(x=>`${x.symbol}:${x.aprPct}%`),executionAuthority:'none'},null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1});
