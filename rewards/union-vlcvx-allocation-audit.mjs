import fs from 'node:fs';
import { Contract, JsonRpcProvider, ZeroAddress, getAddress } from 'ethers';

const INPUT=process.env.VLCVX_AUDIT_OUTPUT||'/tmp/vlcvx-route-audit.json';
const OUTPUT=process.env.UNION_AUDIT_OUTPUT||'/tmp/union-vlcvx-allocation-audit.json';
const RPCS=[...new Set([process.env.ETH_RPC_URL,'https://ethereum-rpc.publicnode.com','https://eth.llamarpc.com'].filter(Boolean))];
const ZAP=getAddress('0xd52ca71aafa4d2590aac1e35e3005242dd31e5ed');
const ASSET_REGISTRY=getAddress('0xcfa23b8f9062369b21049b9f4a4ce79d640d1873');
const CRVUSD=getAddress('0xf939E0A03FB07F59A73314E73794Be0E57ac1b4E');
const SCRVUSD=getAddress('0x0655977FEb2f289A4aB78af67BAB0d17aAb84367');
const ZAP_ABI=['function outputTokens(uint256) view returns (address)'];
const ALLOC_ABI=['function getAllocations(address[] members) view returns (uint16[16][] allocations)'];
const ERC20_ABI=['function symbol() view returns (string)'];
async function provider(){let last;for(const u of RPCS){try{const p=new JsonRpcProvider(u,1,{staticNetwork:true});await p.getBlockNumber();return p}catch(e){last=e}}throw last||new Error('RPC unavailable')}
async function main(){
 const audit=JSON.parse(fs.readFileSync(INPUT,'utf8')),p=await provider(),zap=new Contract(ZAP,ZAP_ABI,p),registry=new Contract(ASSET_REGISTRY,ALLOC_ABI,p);
 const outputs=[];for(let i=0;i<16;i++){try{const a=getAddress(await zap.outputTokens(i));if(a===ZeroAddress)break;let symbol=null;try{symbol=await new Contract(a,ERC20_ABI,p).symbol()}catch{}outputs.push({index:i,address:a,symbol})}catch{break}}
 const members=[];
 for(const c of audit.companies||[])for(const w of c.wallets||[])if(w.hasVlCvx&&w.forwarding?.effective&&w.forwarding?.identity==='union')members.push({registry:c.registry,company:c.name,wallet:w.address,alias:w.alias});
 const allocations=members.length?await registry.getAllocations(members.map(x=>x.wallet)):[];
 const rows=members.map((m,i)=>{const weights=Array.from(allocations[i]||[]).map(Number),total=weights.reduce((a,b)=>a+b,0),selected=outputs.filter(o=>Number(weights[o.index]||0)>0).map(o=>({index:o.index,address:o.address,symbol:o.symbol,weight:Number(weights[o.index]),sharePct:total?Number((Number(weights[o.index])/total*100).toFixed(6)):null,settlementAsset:getAddress(o.address)===CRVUSD?'scrvUSD':o.symbol||o.address,settlementToken:getAddress(o.address)===CRVUSD?SCRVUSD:o.address,specialized:getAddress(o.address)===CRVUSD?'crvUSD → scrvUSD ERC-4626 distributor':null}));return{...m,totalWeight:total,selected}});
 const out={version:'0.1-union-vlcvx-allocation-audit',generatedAt:new Date().toISOString(),executionAuthority:'none',contracts:{unionZap:ZAP,assetRegistry:ASSET_REGISTRY},outputs,members:rows};
 fs.writeFileSync(OUTPUT,JSON.stringify(out,null,2)+'\n');console.log('UNION VLCVX ALLOCATION LIVE PASS',JSON.stringify(rows,null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1});
