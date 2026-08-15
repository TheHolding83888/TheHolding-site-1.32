import fs from 'node:fs';
const p='agents/console/app.js';
let s=fs.readFileSync(p,'utf8');
const from="That period predates verified tracking, and without a separate backfill the OS has no exact historical income figure for it.";
const to="That period predates tracking, and without a separate backfill the OS has no exact historical income figure for it.";
if((s.split(from).length-1)!==1) throw new Error('pretracking copy anchor mismatch');
s=s.replace(from,to);
fs.writeFileSync(p,s);
console.log('pretracking safety copy repaired');
