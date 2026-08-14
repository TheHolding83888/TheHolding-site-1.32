#!/usr/bin/env node
import fs from 'node:fs';
import crypto from 'node:crypto';
const MANIFEST='intelligence/guardian/guardian-release.json';
const EXPECTED=[
  '.github/workflows/update-guardian-state.yml',
  'intelligence/guardian/README.md',
  'intelligence/guardian/guardian-policy.json',
  'intelligence/guardian/guardian-schema.json',
  'intelligence/guardian/guardian-engine.mjs',
  'intelligence/guardian/independent-guardian-reviewer.mjs'
].sort();
const m=JSON.parse(fs.readFileSync(MANIFEST,'utf8'));
if(m.version!=='0.1-guardian-release') throw new Error(`Unexpected Guardian release version: ${m.version}`);
if(m.releaseId!=='0.1-research-only-capability-gate') throw new Error(`Unexpected Guardian releaseId: ${m.releaseId}`);
const actual=(m.staticFiles??[]).map(x=>x.file).sort();
if(JSON.stringify(actual)!==JSON.stringify(EXPECTED)) throw new Error(`Guardian static file contract mismatch: ${JSON.stringify(actual)}`);
for(const x of m.staticFiles??[]){
  if(!fs.existsSync(x.file)) throw new Error(`Missing Guardian static file: ${x.file}`);
  const bytes=fs.readFileSync(x.file);
  const hash=crypto.createHash('sha256').update(bytes).digest('hex');
  if(hash!==x.sha256) throw new Error(`Guardian static release mismatch: ${x.file}`);
  if(bytes.length!==x.bytes) throw new Error(`Guardian static byte-size mismatch: ${x.file}`);
}
console.log('Guardian static release coherence PASS',{releaseId:m.releaseId,staticFileCount:m.staticFiles?.length??0});
