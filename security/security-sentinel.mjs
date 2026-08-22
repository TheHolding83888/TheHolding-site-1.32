#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const SENTINEL_VERSION = '0.2-browser-trust-aware-security-sentinel';
const LAYER_VERSION = '0.1-autonomous-security-intelligence';
const MEMORY_VERSION = '0.1-security-memory';
const HISTORY_VERSION = '0.1-security-history';
const VAULT_MANIFEST_VERSION = '0.1-security-vault-manifest';
const VAULT_RECORD_VERSION = '0.1-security-vault-record';
const BROWSER_TRUST_POLICY_VERSION = '0.1-browser-trust-policy';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const OUT = {
  memory: path.join(ROOT, 'security', 'security-memory.json'),
  history: path.join(ROOT, 'security', 'security-history.json'),
  latest: path.join(ROOT, 'security', 'security-intelligence.json'),
  brief: path.join(ROOT, 'security', 'security-brief.md'),
  vaultRoot: path.join(ROOT, 'security', 'security-vault'),
  vaultManifest: path.join(ROOT, 'security', 'security-vault', 'manifest.json'),
};
const BROWSER_TRUST_POLICY_PATH = path.join(ROOT, 'security', 'browser-trust-policy.json');
const SITE_BASE = process.env.SECURITY_SITE_BASE_URL || 'https://theholding.ai';
const SKIP_NETWORK = process.env.SECURITY_SKIP_NETWORK === '1';
const generatedAt = new Date().toISOString();

function ensureDir(file) { fs.mkdirSync(path.dirname(file), {recursive:true}); }
function readJson(file, required=false) {
  try { return JSON.parse(fs.readFileSync(file,'utf8')); }
  catch (err) {
    if (!required && err?.code === 'ENOENT') return null;
    throw err;
  }
}
function writeJson(file, value) { ensureDir(file); fs.writeFileSync(file, JSON.stringify(value,null,2)+'\n'); }
function sha256Text(v) { return crypto.createHash('sha256').update(v).digest('hex'); }
function sha256File(file) { return sha256Text(fs.readFileSync(file)); }
function gitBlobSha1(file) {
  const bytes=fs.readFileSync(file);
  return crypto.createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
}
function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  return `{${Object.keys(value).sort().map(k=>`${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
}
function hashObject(v) { return sha256Text(stableStringify(v)); }
function rel(file) { return path.relative(ROOT,file).replaceAll(path.sep,'/'); }
function safeArray(v) { return Array.isArray(v) ? v : []; }
function sevRank(s) { return ({info:0,low:1,medium:2,high:3,critical:4})[s] ?? 0; }
function lineOf(text, index) { return text.slice(0,index).split('\n').length; }

const browserPolicy=readJson(BROWSER_TRUST_POLICY_PATH,true);
if (browserPolicy.version!==BROWSER_TRUST_POLICY_VERSION) throw new Error(`Unexpected browser trust policy: ${browserPolicy.version}`);
const domReviewByFile=new Map(safeArray(browserPolicy.reviewedDomInnerHtml).map(x=>[x.file,x]));
const externalTrustByUrl=new Map(safeArray(browserPolicy.externalScripts).map(x=>[x.url,x]));
const trustedExternalUsage=new Map();
const browserTrust={
  policyVersion:browserPolicy.version,
  policySha256:sha256File(BROWSER_TRUST_POLICY_PATH),
  reviewedAt:browserPolicy.reviewedAt??null,
  domReviews:[],
  externalScripts:[],
  summary:null,
};

const EXCLUDED_DIRS = new Set(['.git','node_modules','.cache','.next','dist','build']);
const TEXT_EXT = new Set(['.html','.htm','.js','.mjs','.cjs','.json','.yml','.yaml','.md','.css','.txt','.toml','.xml','.sh']);
const GENERATED_SECURITY = new Set([
  'security/security-memory.json','security/security-history.json','security/security-intelligence.json','security/security-brief.md'
]);
function walk(dir, out=[]) {
  for (const ent of fs.readdirSync(dir,{withFileTypes:true})) {
    if (EXCLUDED_DIRS.has(ent.name)) continue;
    const abs = path.join(dir,ent.name);
    const rp = rel(abs);
    if (rp.startsWith('security/security-vault/')) continue;
    if (ent.isDirectory()) walk(abs,out);
    else if (ent.isFile() && !GENERATED_SECURITY.has(rp) && TEXT_EXT.has(path.extname(ent.name).toLowerCase())) out.push(abs);
  }
  return out;
}

const findings=[];
function addFinding({severity='medium',category,file=null,line=null,entity=null,summary,whyItMatters=null,evidence=null}) {
  const core={severity,category,file,line,entity,summary,whyItMatters,evidence};
  const id=sha256Text(stableStringify(core));
  findings.push({id,...core});
}

const secretPatterns = [
  ['private-key','critical',/-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/g],
  ['github-token','critical',/\bgh[pousr]_[A-Za-z0-9_]{20,}\b/g],
  ['openai-key','critical',/\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/g],
  ['anthropic-key','critical',/\bsk-ant-[A-Za-z0-9_-]{20,}\b/g],
  ['aws-access-key','critical',/\bAKIA[0-9A-Z]{16}\b/g],
];

function scanSecrets(file,text) {
  for (const [kind,severity,rx] of secretPatterns) {
    rx.lastIndex=0;
    for (const m of text.matchAll(rx)) {
      addFinding({severity,category:'secret-exposure',file:rel(file),line:lineOf(text,m.index),entity:kind,
        summary:`Potential ${kind} detected in public repository text.`,
        whyItMatters:'Credentials committed to a public repository can be copied and abused. The Sentinel stores only the pattern type and location, never the matched secret.'});
    }
  }
}

function workflowHasWrite(text) {
  return /^\s*permissions:\s*write-all\s*$/m.test(text) || /^\s*contents:\s*write\s*$/m.test(text) || /^\s*actions:\s*write\s*$/m.test(text);
}
function scanWorkflow(file,text) {
  const rp=rel(file);
  const hasWrite=workflowHasWrite(text);
  if (/^\s*permissions:\s*write-all\s*$/m.test(text)) addFinding({severity:'critical',category:'workflow-permission',file:rp,summary:'Workflow grants write-all permissions.',whyItMatters:'A compromised workflow step would receive unnecessarily broad repository authority.'});
  if (/^\s*pull_request_target\s*:/m.test(text)) addFinding({severity:'high',category:'privileged-trigger',file:rp,summary:'Workflow uses pull_request_target.',whyItMatters:'This trigger runs in a privileged base-repository context and requires special care around untrusted pull-request code.'});
  if (/\b(?:curl|wget)\b[^\n|]*\|\s*(?:bash|sh)\b/g.test(text)) addFinding({severity:'high',category:'remote-code-pipe',file:rp,summary:'Workflow pipes downloaded network content directly into a shell.',whyItMatters:'Remote content can change outside repository review and execute with workflow permissions.'});
  if (/\beval\s+["'$\w]/g.test(text)) addFinding({severity:'high',category:'shell-eval',file:rp,summary:'Workflow contains shell eval.',whyItMatters:'Eval can turn untrusted data into executable shell code.'});
  const lines=text.split('\n');
  lines.forEach((ln,i)=>{
    const m=ln.match(/^\s*-?\s*uses:\s*([^\s#]+)/);
    if (!m) return;
    const ref=m[1];
    if (ref.startsWith('./') || ref.startsWith('docker://')) return;
    const at=ref.lastIndexOf('@');
    const version=at>=0?ref.slice(at+1):'';
    if (!/^[0-9a-f]{40}$/i.test(version)) {
      addFinding({severity:hasWrite?'high':'medium',category:'unpinned-action',file:rp,line:i+1,entity:ref,
        summary:`GitHub Action is referenced by mutable ref: ${ref}.`,
        whyItMatters:hasWrite?'This workflow has write capability; a moved or compromised action tag would have a larger blast radius.':'Full commit-SHA pinning makes the executed action immutable and reviewable.'});
    }
  });
}

function rememberTrustedExternal(url,rp) {
  const rec=trustedExternalUsage.get(url)||{files:new Set()};
  rec.files.add(rp);
  trustedExternalUsage.set(url,rec);
}

function scanWebCode(file,text) {
  const rp=rel(file);

  const innerRx=/\.innerHTML\s*=\s*/g;
  const innerMatches=[...text.matchAll(innerRx)];
  if (innerMatches.length) {
    const review=domReviewByFile.get(rp)||null;
    const currentBlob=gitBlobSha1(file);
    const valid=!!review && review.gitBlobSha1===currentBlob && Number(review.expectedCount)===innerMatches.length;
    browserTrust.domReviews.push({
      file:rp,
      status:valid?'reviewed':'unreviewed',
      classification:review?.classification??null,
      sinkCount:innerMatches.length,
      expectedCount:review?.expectedCount??null,
      currentGitBlobSha1:currentBlob,
      reviewedGitBlobSha1:review?.gitBlobSha1??null,
      rationale:valid?(review.rationale??null):null,
    });
    if (!valid) {
      for (const m of innerMatches) addFinding({severity:'medium',category:'dom-innerhtml',file:rp,line:lineOf(text,m.index),summary:'Dynamic innerHTML assignment detected.',whyItMatters:'If any assigned value later becomes user-controlled or external data, this can become a DOM-XSS sink.',evidence:review?{reviewInvalidated:true,expectedGitBlobSha1:review.gitBlobSha1,currentGitBlobSha1:currentBlob,expectedCount:review.expectedCount,currentCount:innerMatches.length}:null});
    }
  }

  const checks=[
    ['dom-insert-html','medium',/\.insertAdjacentHTML\s*\(/g,'insertAdjacentHTML usage detected.','HTML-string sinks require strict control or sanitization when data is not fully trusted.'],
    ['document-write','high',/\bdocument\.write\s*\(/g,'document.write usage detected.','This is a dangerous HTML execution sink and should be avoided in production surfaces.'],
    ['javascript-eval','high',/(?<![$\w])eval\s*\(/g,'JavaScript eval usage detected.','Eval can execute attacker-controlled strings if data boundaries are ever breached.'],
    ['new-function','high',/\bnew\s+Function\s*\(/g,'Dynamic Function constructor detected.','Dynamic code construction expands injection risk.'],
    ['insecure-fetch','high',/\bfetch\s*\(\s*[`'\"]http:\/\//g,'Insecure HTTP fetch detected.','Plain HTTP can be modified in transit.'],
  ];
  for (const [category,severity,rx,summary,why] of checks) {
    rx.lastIndex=0;
    for (const m of text.matchAll(rx)) addFinding({severity,category,file:rp,line:lineOf(text,m.index),summary,whyItMatters:why});
  }

  const scriptRx=/<script\b[^>]*\bsrc=["'](https?:\/\/[^"']+)["'][^>]*>/gi;
  for (const m of text.matchAll(scriptRx)) {
    const tag=m[0], url=m[1];
    if (/\bintegrity=["']/i.test(tag)) continue;
    const trust=externalTrustByUrl.get(url)||null;
    const expected=trust && safeArray(trust.expectedFiles).includes(rp);
    if (expected) {
      rememberTrustedExternal(url,rp);
      continue;
    }
    addFinding({severity:'medium',category:'external-script-no-sri',file:rp,line:lineOf(text,m.index),entity:url,summary:`External script without Subresource Integrity: ${url}`,whyItMatters:'A compromised third-party script host can execute code in visitors’ browsers. SRI is useful when the asset is immutable.',evidence:trust?{knownProvider:true,unexpectedFile:true}:null});
  }
}

const files=walk(ROOT).sort();
let scannedBytes=0;
for (const file of files) {
  const st=fs.statSync(file);
  if (st.size > 5*1024*1024) continue;
  const text=fs.readFileSync(file,'utf8');
  scannedBytes += Buffer.byteLength(text);
  scanSecrets(file,text);
  const rp=rel(file);
  if (rp.startsWith('.github/workflows/') && /\.ya?ml$/i.test(rp)) scanWorkflow(file,text);
  if (/\.(?:html?|js|mjs|cjs)$/i.test(rp)) scanWebCode(file,text);
}

const criticalSurfaceCandidates = [
  'index.html','companies/index.html','agents/index.html','yield-reports/index.html','monetra/index.html',
  'intelligence/change-intelligence-engine.mjs','.github/workflows/update-change-intelligence.yml'
];
const workflowDir=path.join(ROOT,'.github','workflows');
if (fs.existsSync(workflowDir)) {
  for (const n of fs.readdirSync(workflowDir).filter(x=>/\.ya?ml$/i.test(x)).sort()) criticalSurfaceCandidates.push(`.github/workflows/${n}`);
}
const criticalHashes={};
for (const rp of [...new Set(criticalSurfaceCandidates)].sort()) {
  const abs=path.join(ROOT,rp);
  if (fs.existsSync(abs) && fs.statSync(abs).isFile()) criticalHashes[rp]=sha256File(abs);
}

const previousMemory=readJson(OUT.memory,false);
if (previousMemory?.repository?.criticalHashes) {
  for (const [rp,hash] of Object.entries(criticalHashes)) {
    const old=previousMemory.repository.criticalHashes[rp];
    if (old && old!==hash) addFinding({severity:'medium',category:'critical-surface-change',file:rp,summary:`Security-sensitive surface changed: ${rp}.`,whyItMatters:'The change may be legitimate, but future reasoning can now correlate it with the exact security scan that followed.',evidence:{previousSha256:old,currentSha256:hash}});
  }
}

function expired(iso) {
  const t=Date.parse(String(iso||''));
  return Number.isFinite(t) && Date.parse(generatedAt)>=t;
}

async function probeTrustedExternalScript(entry, filesUsed) {
  const state={
    url:entry.url,
    provider:entry.provider??null,
    purpose:entry.purpose??null,
    decision:entry.decision??null,
    sriPolicy:entry.sriPolicy??null,
    reviewAfter:entry.reviewAfter??null,
    files:[...filesUsed].sort(),
    networkSkipped:SKIP_NETWORK,
    ok:null,
    sha256:null,
    etag:null,
    lastModified:null,
    contentType:null,
    bytes:null,
    error:null,
  };
  if (expired(entry.reviewAfter)) {
    addFinding({severity:'medium',category:'third-party-script-trust-review-expired',entity:entry.url,summary:`Third-party script trust review expired: ${entry.url}`,whyItMatters:'Mutable third-party JavaScript should be re-reviewed periodically even when its URL is intentionally trusted.',evidence:{provider:entry.provider??null,reviewAfter:entry.reviewAfter??null,files:state.files}});
  }
  if (SKIP_NETWORK || entry.monitorRemoteHash!==true) return state;

  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),10000);
  try {
    const res=await fetch(entry.url,{redirect:'follow',signal:controller.signal,headers:{'user-agent':'The-Holding-Security-Sentinel/0.2'}});
    state.ok=res.ok;
    state.contentType=res.headers.get('content-type');
    state.etag=res.headers.get('etag');
    state.lastModified=res.headers.get('last-modified');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const bytes=Buffer.from(await res.arrayBuffer());
    state.bytes=bytes.length;
    if (bytes.length>1024*1024) throw new Error(`script larger than 1 MiB (${bytes.length})`);
    state.sha256=sha256Text(bytes);
    const prior=safeArray(previousMemory?.browserTrust?.externalScripts).find(x=>x.url===entry.url && x.sha256);
    if (prior?.sha256 && prior.sha256!==state.sha256) {
      addFinding({severity:'medium',category:'third-party-script-content-change',entity:entry.url,summary:`Reviewed third-party script bytes changed: ${entry.url}`,whyItMatters:'A mutable vendor script changed outside the repository. The change may be legitimate, but the trust decision should be re-checked before treating the new bytes as routine.',evidence:{provider:entry.provider??null,previousSha256:prior.sha256,currentSha256:state.sha256,etag:state.etag,lastModified:state.lastModified,files:state.files}});
    }
    if (!/javascript|ecmascript/i.test(String(state.contentType||''))) {
      addFinding({severity:'medium',category:'third-party-script-content-type',entity:entry.url,summary:`Reviewed third-party script returned unexpected content type: ${state.contentType||'missing'}`,whyItMatters:'A JavaScript dependency should resolve to a JavaScript content type; an unexpected response can indicate routing or provider changes.',evidence:{provider:entry.provider??null,files:state.files}});
    }
  } catch(err) {
    state.ok=false;
    state.error=err?.name==='AbortError'?'timeout':String(err?.message||err);
    addFinding({severity:'medium',category:'third-party-script-monitor-failed',entity:entry.url,summary:`Could not verify reviewed third-party script: ${entry.url}`,whyItMatters:'The dependency remains externally trusted, so losing independent visibility into its current bytes should remain visible until monitoring recovers.',evidence:{provider:entry.provider??null,error:state.error,files:state.files}});
  } finally { clearTimeout(timer); }
  return state;
}

for (const [url,usage] of [...trustedExternalUsage.entries()].sort((a,b)=>a[0].localeCompare(b[0]))) {
  const entry=externalTrustByUrl.get(url);
  if (entry) browserTrust.externalScripts.push(await probeTrustedExternalScript(entry,usage.files));
}
browserTrust.domReviews.sort((a,b)=>a.file.localeCompare(b.file));
browserTrust.summary={
  reviewedDomFileCount:browserTrust.domReviews.filter(x=>x.status==='reviewed').length,
  reviewedDomSinkCount:browserTrust.domReviews.filter(x=>x.status==='reviewed').reduce((s,x)=>s+x.sinkCount,0),
  unreviewedDomFileCount:browserTrust.domReviews.filter(x=>x.status!=='reviewed').length,
  trustedExternalScriptCount:browserTrust.externalScripts.length,
  trustedExternalScriptUsageCount:browserTrust.externalScripts.reduce((s,x)=>s+x.files.length,0),
};

async function probe(url) {
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),10000);
  try {
    const res=await fetch(url,{redirect:'follow',signal:controller.signal,headers:{'user-agent':'The-Holding-Security-Sentinel/0.2'}});
    const headers={
      strictTransportSecurity:res.headers.get('strict-transport-security'),
      contentSecurityPolicy:res.headers.get('content-security-policy'),
      xContentTypeOptions:res.headers.get('x-content-type-options'),
      referrerPolicy:res.headers.get('referrer-policy'),
      contentType:res.headers.get('content-type'),
    };
    return {url,status:res.status,ok:res.ok,finalUrl:res.url,https:res.url.startsWith('https://'),headers};
  } catch(err) { return {url,status:null,ok:false,finalUrl:null,https:false,error:err?.name==='AbortError'?'timeout':String(err?.message||err)}; }
  finally { clearTimeout(timer); }
}

const probePaths=['/','/companies/','/agents/','/yield-reports/','/monetra/','/intelligence/change-intelligence.json'];
const siteProbes=[];
if (!SKIP_NETWORK) {
  for (const p of probePaths) siteProbes.push(await probe(new URL(p,SITE_BASE).toString()));
  for (const p of siteProbes) {
    if (!p.ok) addFinding({severity:'high',category:'public-surface-unavailable',entity:p.url,summary:`Public security probe failed for ${p.url}.`,whyItMatters:'Unexpected unavailability can indicate deployment, routing, domain or hosting trouble.',evidence:{status:p.status,error:p.error??null}});
    else if (!p.https) addFinding({severity:'critical',category:'https-downgrade',entity:p.url,summary:`Public surface resolved without HTTPS: ${p.finalUrl}.`,whyItMatters:'Capital infrastructure should not expose visitors to plaintext transport.'});
  }
}

findings.sort((a,b)=>sevRank(b.severity)-sevRank(a.severity)||a.category.localeCompare(b.category)||String(a.file||a.entity||'').localeCompare(String(b.file||b.entity||'')));
const severityCounts={critical:0,high:0,medium:0,low:0,info:0};
for (const f of findings) severityCounts[f.severity]=(severityCounts[f.severity]||0)+1;

const previousFindings=new Map(safeArray(previousMemory?.findings).map(f=>[f.id,f]));
const currentFindings=new Map(findings.map(f=>[f.id,f]));
const newFindings=findings.filter(f=>!previousFindings.has(f.id));
const resolvedFindings=[...previousFindings.values()].filter(f=>!currentFindings.has(f.id));
const status=severityCounts.critical>0?'critical':severityCounts.high>0?'watch':'green';
const headline=status==='critical' ? `${severityCounts.critical} critical security finding${severityCounts.critical===1?'':'s'} require immediate attention.` : status==='watch' ? `${severityCounts.high} high-signal security watch item${severityCounts.high===1?'':'s'} detected; no critical secret exposure found.` : 'No high or critical security findings detected in this scan.';

function timestampPart(iso) { return iso.replaceAll(':','-').replaceAll('.','-'); }
function vaultPath(iso,hash) { const d=new Date(iso); return `security/security-vault/${d.getUTCFullYear()}/${String(d.getUTCMonth()+1).padStart(2,'0')}/${timestampPart(iso)}-${hash.slice(0,10)}.json`; }
function verifyRecord(record) {
  const core={...record}; delete core.integrity;
  const actual=hashObject(core);
  if (actual!==record?.integrity?.recordHash) throw new Error('Security Vault record integrity mismatch.');
  if ((record.chain?.previousRecordHash??null)!==(record.integrity?.previousRecordHash??null)) throw new Error('Security Vault previous hash mismatch.');
}
let manifest=readJson(OUT.vaultManifest,false)||{version:VAULT_MANIFEST_VERSION,sentinelVersion:SENTINEL_VERSION,recordVersion:VAULT_RECORD_VERSION,policy:{mode:'append-only-hash-chained',canonicalRetention:'indefinite',hardLifetimeCap:null},startedAt:null,lastUpdatedAt:null,runCount:0,findingOccurrenceCount:0,chainRootHash:null,latestRecord:null,runs:[]};
if (manifest.version!==VAULT_MANIFEST_VERSION || !Array.isArray(manifest.runs) || manifest.runCount!==manifest.runs.length) throw new Error('Security Vault manifest invalid.');
const scanSnapshot={repository:{filesScanned:files.length,bytesScanned:scannedBytes,criticalHashes},site:{baseUrl:SITE_BASE,networkSkipped:SKIP_NETWORK,probes:siteProbes},browserTrust,findings};
const snapshotHash=hashObject(scanSnapshot);
const coreRecord={version:VAULT_RECORD_VERSION,sentinelVersion:SENTINEL_VERSION,layerVersion:LAYER_VERSION,generatedAt,mode:previousMemory?'delta':'baseline',snapshotHash,chain:{previousRecordHash:manifest.latestRecord?.recordHash??null},status,headline,newFindingIds:newFindings.map(x=>x.id),resolvedFindingIds:resolvedFindings.map(x=>x.id),snapshot:scanSnapshot};
const recordHash=hashObject(coreRecord);
const record={...coreRecord,integrity:{algorithm:'sha256',recordHash,previousRecordHash:coreRecord.chain.previousRecordHash}};
verifyRecord(record);
const recordPath=vaultPath(generatedAt,snapshotHash);
const recordAbs=path.join(ROOT,recordPath);
if (fs.existsSync(recordAbs)) {
  const existing=readJson(recordAbs,true); verifyRecord(existing);
  if (existing.integrity.recordHash!==recordHash) throw new Error(`Security Vault refuses to overwrite ${recordPath}`);
} else writeJson(recordAbs,record);
const meta={generatedAt,recordPath,recordHash,previousRecordHash:record.integrity.previousRecordHash,snapshotHash,status,findingCount:findings.length,criticalCount:severityCounts.critical,highCount:severityCounts.high,newFindingCount:newFindings.length,resolvedFindingCount:resolvedFindings.length};
manifest={...manifest,sentinelVersion:SENTINEL_VERSION,lastUpdatedAt:generatedAt,startedAt:manifest.startedAt||generatedAt,runCount:manifest.runCount+1,findingOccurrenceCount:manifest.findingOccurrenceCount+findings.length,chainRootHash:manifest.chainRootHash||recordHash,latestRecord:meta,runs:[...manifest.runs,meta]};
for(let i=0;i<manifest.runs.length;i++){const exp=i===0?null:manifest.runs[i-1].recordHash;if((manifest.runs[i].previousRecordHash??null)!==exp)throw new Error(`Security Vault chain broken at ${i}`);}
writeJson(OUT.vaultManifest,manifest);

const memory={version:MEMORY_VERSION,sentinelVersion:SENTINEL_VERSION,generatedAt,status,snapshotHash,repository:scanSnapshot.repository,site:scanSnapshot.site,browserTrust,findings,securityVault:{version:VAULT_MANIFEST_VERSION,runCount:manifest.runCount,startedAt:manifest.startedAt,latestRecordPath:recordPath,latestRecordHash:recordHash,chainRootHash:manifest.chainRootHash}};
const oldHistory=readJson(OUT.history,false)||{version:HISTORY_VERSION,sentinelVersion:SENTINEL_VERSION,startedAt:generatedAt,lastUpdatedAt:null,runs:[],events:[]};
const oldEvents=new Map(safeArray(oldHistory.events).map(e=>[e.id,e]));
const changeEvents=[];
for (const f of newFindings) changeEvents.push({id:sha256Text(`new:${f.id}`),type:'finding-opened',detectedAt:generatedAt,findingId:f.id,severity:f.severity,category:f.category,summary:f.summary,file:f.file??null,entity:f.entity??null});
for (const f of resolvedFindings) changeEvents.push({id:sha256Text(`resolved:${f.id}:${generatedAt.slice(0,10)}`),type:'finding-resolved',detectedAt:generatedAt,findingId:f.id,severity:f.severity,category:f.category,summary:`Resolved: ${f.summary}`,file:f.file??null,entity:f.entity??null});
for(const e of changeEvents) oldEvents.set(e.id,e);
const priorRunCount=Number(oldHistory?.lifetime?.runCount??safeArray(oldHistory.runs).length)||0;
const history={version:HISTORY_VERSION,sentinelVersion:SENTINEL_VERSION,startedAt:oldHistory.startedAt||generatedAt,lastUpdatedAt:generatedAt,retention:{operationalRuns:730,operationalEvents:5000,longTermCanonicalMemory:'security/security-vault/'},lifetime:{runCount:priorRunCount+1,vaultRunCount:manifest.runCount,vaultStartedAt:manifest.startedAt},runs:[...safeArray(oldHistory.runs),{generatedAt,status,snapshotHash,recordPath,recordHash,findingCount:findings.length,criticalCount:severityCounts.critical,highCount:severityCounts.high,newFindingCount:newFindings.length,resolvedFindingCount:resolvedFindings.length}].slice(-730),events:[...oldEvents.values()].sort((a,b)=>String(a.detectedAt).localeCompare(String(b.detectedAt))).slice(-5000)};
const protectNext=[];
if (severityCounts.critical) protectNext.push({priority:'critical',action:'Investigate critical findings before any expansion of write-capable automation.'});
if (findings.some(f=>f.category==='unpinned-action')) protectNext.push({priority:'high',action:'Pin write-capable GitHub Actions to reviewed full commit SHAs, then let Dependabot propose controlled updates.'});
if (findings.some(f=>f.category==='dom-innerhtml'||f.category==='dom-insert-html')) protectNext.push({priority:'medium',action:'Re-review the changed DOM rendering surface; reviewed innerHTML exemptions are valid only for exact unchanged Git blobs.'});
if (findings.some(f=>f.category==='third-party-script-content-change'||f.category==='third-party-script-trust-review-expired'||f.category==='third-party-script-monitor-failed'||f.category==='third-party-script-content-type')) protectNext.push({priority:'medium',action:'Re-review the monitored third-party JavaScript trust decision before treating the changed/unverifiable vendor bytes as routine.'});
if (!SKIP_NETWORK && siteProbes.some(p=>p.ok && !p.headers?.contentSecurityPolicy)) protectNext.push({priority:'medium',action:'Plan a Content Security Policy in report-only mode before enforcing it across the public portal.'});
protectNext.push({priority:'roadmap',action:'Before interactive AI dialogue: add prompt-injection boundaries, tool permission gates, private/public context separation and immutable action audit logs.'});
const latest={version:LAYER_VERSION,sentinelVersion:SENTINEL_VERSION,generatedAt,status,headline,severityCounts,source:{filesScanned:files.length,bytesScanned:scannedBytes,siteProbes:siteProbes.length},browserTrust:{policyVersion:browserTrust.policyVersion,policySha256:browserTrust.policySha256,summary:browserTrust.summary,externalScripts:browserTrust.externalScripts},whatChanged:{newFindings:newFindings.slice(0,30),resolvedFindings:resolvedFindings.slice(0,60)},currentFindings:findings.slice(0,100),protectNext,bridge:{purpose:'Compact security handoff for The Holding Brain / human review.',snapshotHash,securityVault:{runCount:manifest.runCount,startedAt:manifest.startedAt,latestRecordPath:recordPath,latestRecordHash:recordHash,chainRootHash:manifest.chainRootHash}}};

function buildBrief(){const l=[];l.push('# The Holding — Autonomous Security Intelligence','',`**Generated:** ${generatedAt}`,`**Sentinel:** ${SENTINEL_VERSION}`,'',`## ${headline}`,'',`- Critical: ${severityCounts.critical}` ,`- High: ${severityCounts.high}`,`- Medium: ${severityCounts.medium}`,`- New findings: ${newFindings.length}`,`- Resolved findings: ${resolvedFindings.length}`,'','## Browser trust review','',`- Reviewed DOM files: ${browserTrust.summary.reviewedDomFileCount}.`,`- Reviewed DOM sinks: ${browserTrust.summary.reviewedDomSinkCount}.`,`- Unreviewed DOM files: ${browserTrust.summary.unreviewedDomFileCount}.`,`- Monitored external scripts: ${browserTrust.summary.trustedExternalScriptCount} across ${browserTrust.summary.trustedExternalScriptUsageCount} page(s).`,'','## Protect next','');for(const p of protectNext)l.push(`- **${p.priority}** — ${p.action}`);l.push('','## Permanent security memory','',`- Security Vault runs: ${manifest.runCount}.`,`- Latest record: \`${recordPath}\`.`,'- Vault retention: indefinite / append-only hash chain.','','---','The Sentinel does not expose matched secrets in its reports and does not make autonomous destructive changes. Critical findings are intended to fail the workflow after the safe report is published.','');return l.join('\n');}

writeJson(OUT.memory,memory); writeJson(OUT.history,history); writeJson(OUT.latest,latest); ensureDir(OUT.brief); fs.writeFileSync(OUT.brief,buildBrief()+'\n');
console.log('The Holding Security Sentinel complete.');
console.log(`Status: ${status}`); console.log(`Findings: ${findings.length} | critical ${severityCounts.critical} | high ${severityCounts.high}`); console.log(`Browser trust: ${browserTrust.summary.reviewedDomSinkCount} reviewed DOM sinks | ${browserTrust.summary.trustedExternalScriptCount} monitored external script(s)`); console.log(`New: ${newFindings.length} | resolved ${resolvedFindings.length}`); console.log(`Security Vault runs: ${manifest.runCount}`); console.log(`Snapshot: ${snapshotHash}`);
