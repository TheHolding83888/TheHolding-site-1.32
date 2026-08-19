import fs from 'node:fs';
// Trigger the branch-local parity patch after the workflow exists.
const adapter='companies/company-010-public-adapter.js';
let a=fs.readFileSync(adapter,'utf8');
if(!a.includes("'convex-finance':'convex_vlcvx'")){
  const mapNeedle="    'velodrome-finance':'velodrome_vevelo',\n";
  if(!a.includes(mapNeedle))throw new Error('Cypher productivity map anchor missing');
  a=a.replace(mapNeedle,mapNeedle+"    'convex-finance':'convex_vlcvx',\n");
}
const oldGuard="pos.id==='hyperliquid'||pos.id==='convex-finance'||pos.id==='curve-dao-token'";
if(a.includes(oldGuard))a=a.replace(oldGuard,"pos.id==='hyperliquid'||pos.id==='curve-dao-token'");
if(!a.includes("'convex-finance':'convex_vlcvx'"))throw new Error('vlCVX mapping missing');
if(a.includes(oldGuard))throw new Error('vlCVX still excluded from Passport APR');
fs.writeFileSync(adapter,a);

const verifier='.github/workflows/verify-company-010-public-admission.yml';
let v=fs.readFileSync(verifier,'utf8');
const oldList="\"pos.id==='hyperliquid'\",\"pos.id==='convex-finance'\",\"pos.id==='curve-dao-token'\"";
const newList="\"pos.id==='hyperliquid'\",\"pos.id==='curve-dao-token'\"";
if(v.includes(oldList))v=v.replace(oldList,newList);
const marker="if(!a.includes(\"const kind=/\\\\bAPY\\\\b/i.test(metric)?'APY':'APR'\"))throw new Error('APR/APY metric distinction missing');";
if(!v.includes("Cypher vlCVX Productivity mapping missing")){
  if(!v.includes(marker))throw new Error('Verifier insertion anchor missing');
  v=v.replace(marker,"if(!a.includes(\"'convex-finance':'convex_vlcvx'\"))throw new Error('Cypher vlCVX Productivity mapping missing');\n          "+marker);
}
fs.writeFileSync(verifier,v);
console.log('Cypher vlCVX APR parity patch applied');
