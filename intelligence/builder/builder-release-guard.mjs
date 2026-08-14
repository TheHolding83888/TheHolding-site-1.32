#!/usr/bin/env node
import fs from 'node:fs';
import crypto from 'node:crypto';

const MANIFEST='intelligence/builder/builder-release.json';
const EXPECTED=[
  '.github/workflows/update-builder-candidates.yml',
  'intelligence/builder/README.md',
  'intelligence/builder/builder-policy.json',
  'intelligence/builder/candidate-schema.json',
  'intelligence/builder/builder-engine.mjs',
  'intelligence/builder/independent-builder-reviewer.mjs'
].sort();
const m=JSON.parse(fs.readFileSync(MANIFEST,'utf8'));
if(m.version!=='0.1-builder-release') throw new Error(`Unexpected Builder release version: ${m.version}`);
if(m.releaseId!=='0.1-self-improvement-builder-candidate-sandbox') throw new Error(`Unexpected Builder releaseId: ${m.releaseId}`);
const actual=(m.staticFiles??[]).map(x=>x.file).sort();
if(JSON.stringify(actual)!==JSON.stringify(EXPECTED)) throw new Error(`Builder static file contract mismatch: ${JSON.stringify(actual)}`);
for(const x of m.staticFiles??[]){
  if(!fs.existsSync(x.file)) throw new Error(`Missing Builder static file: ${x.file}`);
  const bytes=fs.readFileSync(x.file);
  const hash=crypto.createHash('sha256').update(bytes).digest('hex');
  if(hash!==x.sha256) throw new Error(`Builder static release mismatch: ${x.file}`);
  if(bytes.length!==x.bytes) throw new Error(`Builder static byte-size mismatch: ${x.file}`);
}
console.log('Builder static release coherence PASS',{releaseId:m.releaseId,staticFileCount:m.staticFiles?.length??0});
