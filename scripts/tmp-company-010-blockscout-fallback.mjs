import fs from 'node:fs';
// Trigger after the branch-local workflow exists.
const p='onboarding/company-010-resolve.mjs';
let s=fs.readFileSync(p,'utf8');
const old="  ethereum:[...new Set([process.env.ETH_RPC_URL,process.env.ETH_RPC_URL_2,'https://ethereum-rpc.publicnode.com','https://eth.llamarpc.com'].filter(Boolean))],";
const next="  ethereum:[...new Set([process.env.ETH_RPC_URL,process.env.ETH_RPC_URL_2,'https://ethereum-rpc.publicnode.com','https://eth.llamarpc.com','https://eth.blockscout.com/api/eth-rpc'].filter(Boolean))],";
if(!s.includes(old))throw new Error('Ethereum RPC mesh anchor missing');
s=s.replace(old,next);
fs.writeFileSync(p,s);
console.log('Blockscout historical eth_call fallback added');
