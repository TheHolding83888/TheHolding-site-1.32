#!/usr/bin/env node
/**
 * The Holding · Protocol Evidence History Retention v0.1
 *
 * Rich protocol evidence belongs in `latest.observation`; longitudinal history
 * keeps compact, truth-preserving summaries instead of duplicating full event
 * ledgers and pair registries on every snapshot. This prevents the canonical
 * Economic Graph artifact from growing past GitHub's file limit while keeping
 * exact current evidence, coverage, provenance hashes and epistemic classes.
 *
 * No evidence is promoted or reclassified here. Full historical payloads remain
 * recoverable from Git history by their retained SHA-256 identity.
 */
import crypto from 'node:crypto';

export const PROTOCOL_EVIDENCE_HISTORY_RETENTION_VERSION='0.1-compact-rich-history';
export const ECONOMIC_GRAPH_SOFT_LIMIT_BYTES=90_000_000;
const COMPACT_MODE='compact-history-row';
const MAX_INLINE_ARRAY_ITEMS=24;
const MAX_INLINE_STRING_LENGTH=1024;
const MAX_INLINE_OBJECT_BYTES=8192;
const MAX_DEPTH=5;

function sha256Text(text){return crypto.createHash('sha256').update(text).digest('hex');}
function jsonBytes(value){return Buffer.byteLength(JSON.stringify(value),'utf8');}
function isPrimitive(value){return value===null||['string','number','boolean'].includes(typeof value);}

function compactValue(value,depth=0){
  if(value===undefined)return undefined;
  if(value===null||typeof value==='number'||typeof value==='boolean')return value;
  if(typeof value==='string'){
    if(value.length<=MAX_INLINE_STRING_LENGTH)return value;
    return {kind:'string-summary',length:value.length,sha256:sha256Text(value),prefix:value.slice(0,256)};
  }
  if(Array.isArray(value)){
    if(value.length<=MAX_INLINE_ARRAY_ITEMS&&value.every(isPrimitive))return value;
    const raw=JSON.stringify(value);
    return {
      kind:'array-summary',
      count:value.length,
      sha256:sha256Text(raw),
      sample:value.slice(0,Math.min(3,value.length)).map(item=>compactValue(item,depth+1))
    };
  }
  if(typeof value!=='object')return String(value);
  if(depth>=MAX_DEPTH){
    const raw=JSON.stringify(value);
    return {kind:'object-summary',keys:Object.keys(value).sort(),sha256:sha256Text(raw),bytes:Buffer.byteLength(raw,'utf8')};
  }
  const raw=JSON.stringify(value);
  if(Buffer.byteLength(raw,'utf8')<=MAX_INLINE_OBJECT_BYTES)return value;
  const out={};
  for(const key of Object.keys(value).sort()){
    const compacted=compactValue(value[key],depth+1);
    if(compacted!==undefined)out[key]=compacted;
  }
  return out;
}

function compactMeasurement(measured){
  if(measured===null||measured===undefined)return measured??null;
  if(typeof measured!=='object')return measured;
  const raw=JSON.stringify(measured);
  const preferredKeys=[
    'version','collectorVersion','status','measurementClass','observedAt',
    'blockNumber','blockTag','blockHash','network','rpc','provenance','scope',
    'summary','coverage','epistemic'
  ];
  const summary={};
  for(const key of preferredKeys){
    if(!(key in measured))continue;
    const compacted=compactValue(measured[key]);
    if(compacted!==undefined)summary[key]=compacted;
  }
  summary.historyRetention={
    mode:'measurement-summary',
    originalBytes:Buffer.byteLength(raw,'utf8'),
    originalPayloadSha256:sha256Text(raw)
  };
  return summary;
}

function compactSurface(surface){
  if(!surface||typeof surface!=='object')return surface;
  return {
    id:surface.id??null,
    label:surface.label??null,
    mechanism:surface.mechanism??null,
    measurementState:surface.measurementState??null,
    sourceContract:compactValue(surface.sourceContract),
    mechanicalRelations:compactValue(surface.mechanicalRelations),
    measured:compactMeasurement(surface.measured)
  };
}

export function compactProtocolEvidenceObservation(observation){
  if(!observation||typeof observation!=='object')throw new Error('Protocol evidence history compaction requires an observation object');
  if(observation?.historyRetention?.mode===COMPACT_MODE&&observation?.historyRetention?.version===PROTOCOL_EVIDENCE_HISTORY_RETENTION_VERSION)return observation;
  const raw=JSON.stringify(observation);
  const surfaces=Object.fromEntries(Object.entries(observation.surfaces||{}).map(([id,surface])=>[id,compactSurface(surface)]));
  return {
    id:observation.id??null,
    version:observation.version??null,
    observedAt:observation.observedAt??null,
    protocolId:observation.protocolId??null,
    lifecycleStage:observation.lifecycleStage??null,
    status:observation.status??null,
    coverage:compactValue(observation.coverage),
    measurementExtensions:compactValue(observation.measurementExtensions),
    surfaces,
    relationshipGraph:compactValue(observation.relationshipGraph),
    epistemic:compactValue(observation.epistemic),
    authority:compactValue(observation.authority),
    historyRetention:{
      version:PROTOCOL_EVIDENCE_HISTORY_RETENTION_VERSION,
      mode:COMPACT_MODE,
      originalBytes:Buffer.byteLength(raw,'utf8'),
      originalPayloadSha256:sha256Text(raw),
      fullPayloadLocation:'Git history; current full payload remains protocolEvidence[evidenceId].latest.observation',
      semantics:'Compaction preserves historical identity, coverage, measurement states, evidence classes, authority and bounded measurement summaries. It does not promote UNKNOWN, association, flow or causality.'
    }
  };
}

export function compactProtocolEvidenceHistory({state,evidenceId,softLimitBytes=ECONOMIC_GRAPH_SOFT_LIMIT_BYTES}){
  if(!state||typeof state!=='object')throw new Error('Protocol evidence retention requires Economic Graph state');
  if(state?.authority?.executionAuthority!=='none')throw new Error('Protocol evidence retention refuses execution-authority drift');
  const evidence=state?.protocolEvidence?.[evidenceId];
  if(!evidence||typeof evidence!=='object')throw new Error(`Protocol evidence missing: ${evidenceId}`);
  const latest=evidence?.latest?.observation;
  if(!latest||typeof latest!=='object')throw new Error(`Protocol evidence latest observation missing: ${evidenceId}`);
  const originalLatestJson=JSON.stringify(latest);
  const beforeBytes=jsonBytes(state);
  const rows=Array.isArray(evidence.observations)?evidence.observations:[];
  evidence.observations=rows.map(compactProtocolEvidenceObservation);
  evidence.observationCount=evidence.observations.length;
  evidence.historyRetention={
    version:PROTOCOL_EVIDENCE_HISTORY_RETENTION_VERSION,
    mode:'latest-full-history-compact',
    historicalObservationCount:evidence.observations.length,
    latestObservationId:latest.id??null,
    latestFullPayloadRetained:true,
    latestPayloadSha256:sha256Text(originalLatestJson),
    softLimitBytes
  };
  if(JSON.stringify(evidence?.latest?.observation)!==originalLatestJson)throw new Error('Protocol evidence retention mutated latest full observation');
  if(evidence?.latest?.observation?.authority?.executionAuthority!=='none')throw new Error('Protocol evidence retention latest authority drift');

  const serialized=JSON.stringify(state,null,2)+'\n';
  const afterBytes=Buffer.byteLength(serialized,'utf8');
  if(afterBytes>softLimitBytes){
    throw new Error(`Economic Graph remains above retention soft limit after compaction: ${afterBytes} > ${softLimitBytes} bytes`);
  }
  return {
    version:PROTOCOL_EVIDENCE_HISTORY_RETENTION_VERSION,
    evidenceId,
    historicalObservationCount:evidence.observations.length,
    beforeBytes,
    afterBytes,
    reducedBytes:beforeBytes-afterBytes,
    reductionPct:beforeBytes>0?Number((((beforeBytes-afterBytes)/beforeBytes)*100).toFixed(4)):0,
    softLimitBytes,
    serialized
  };
}
