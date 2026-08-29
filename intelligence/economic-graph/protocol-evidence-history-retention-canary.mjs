#!/usr/bin/env node
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  compactProtocolEvidenceHistory,
  PROTOCOL_EVIDENCE_HISTORY_RETENTION_VERSION
} from './protocol-evidence-history-retention.mjs';

const EVIDENCE_ID='registry-frax-ecosystem';
function sha256Text(text){return crypto.createHash('sha256').update(text).digest('hex');}
function largeLedger(seed){
  return Array.from({length:800},(_,i)=>({
    pair:`0x${String(seed+i).padStart(40,'0')}`,
    blockNumber:100000+i,
    valueRaw:String((BigInt(seed+1)*10n**18n)+BigInt(i)),
    classification:i%2===0?'MEASURED-exact-log':'UNKNOWN-no-downstream-identity'
  }));
}
function observation(id,seed){
  return {
    id,
    version:'0.1-frax-deep-ecosystem-sensor-family',
    observedAt:`2026-08-29T0${seed}:00:00.000Z`,
    protocolId:'registry-frax-vefrax',
    lifecycleStage:'shadow',
    status:'partial-measured-with-unknowns',
    coverage:{surfaceCount:9,measuredSurfaceCount:8,sourceBoundUnknownSurfaceCount:1,relationshipCount:24},
    measurementExtensions:{fxLiquidityCurrent:'0.1-fraxtal-frxusd-liquidity-current-state'},
    surfaces:{
      fxLiquidity:{
        id:'fx-liquidity',label:'FX / tokenized-currency liquidity',mechanism:'frxUSD liquidity',
        measurementState:'MEASURED-current-fraxtal-frxusd-fraxswap-registry-partial',
        measured:{
          version:'0.1-fraxtal-frxusd-liquidity-current-state',status:'ok',measurementClass:'MEASURED',
          blockNumber:123456+seed,blockHash:`0x${'ab'.repeat(32)}`,
          summary:{factoryPairCount:428,matchingPairCount:62,totalBaseReserveRaw:'2374000000000000000000000'},
          epistemic:{usdTvl:'UNKNOWN-not-valued-by-this-atom',capitalMigration:'UNKNOWN-no-flow-proof',executionAuthority:'none'},
          pairs:largeLedger(seed)
        },
        mechanicalRelations:[{from:'pair reserves',to:'USD TVL',class:'UNKNOWN-counterpart-not-valued'}]
      },
      revenueRouting:{
        id:'revenue-routing',label:'Protocol revenue → veFRAX → company cash flow',mechanism:'end-to-end accounting',
        measurementState:'UNKNOWN-current-value-not-ingested',
        measured:{status:'partial-evidence',epistemic:{eligibleNetRevenue:'UNKNOWN',executionAuthority:'none'},events:largeLedger(seed+1000)},
        mechanicalRelations:[{from:'eligible net revenue',to:'veFRAX allocation',class:'UNKNOWN-until-governance/accounting-proof'}]
      }
    },
    relationshipGraph:[{surfaceId:'revenue-routing',index:0,from:'eligible net revenue',to:'veFRAX allocation',class:'UNKNOWN-until-governance/accounting-proof'}],
    epistemic:{unknownIsZero:false,revenueToVeFraxAprCausality:'UNKNOWN',executionAuthority:'none'},
    authority:{readOnly:true,executionAuthority:'none',causalClaimAuthority:'none'}
  };
}

const latest=observation('frax-latest',4);
const latestJson=JSON.stringify(latest);
const latestHash=sha256Text(latestJson);
const state={
  authority:{executionAuthority:'none',causalClaimAuthority:'none'},
  protocolEvidence:{
    [EVIDENCE_ID]:{
      latest:{observation:latest},
      observations:[observation('frax-1',1),observation('frax-2',2),observation('frax-3',3),structuredClone(latest)],
      observationCount:4
    }
  }
};
const before=Buffer.byteLength(JSON.stringify(state),'utf8');
const result=compactProtocolEvidenceHistory({state,evidenceId:EVIDENCE_ID,softLimitBytes:350_000});
const evidence=state.protocolEvidence[EVIDENCE_ID];
assert.equal(result.version,PROTOCOL_EVIDENCE_HISTORY_RETENTION_VERSION);
assert.ok(result.afterBytes<result.beforeBytes,'retention must shrink rich duplicated history');
assert.ok(result.afterBytes<350_000,'retained graph must remain below configured soft limit');
assert.equal(JSON.stringify(evidence.latest.observation),latestJson,'latest rich observation must remain byte-identical at JSON level');
assert.equal(evidence.historyRetention.latestPayloadSha256,latestHash);
assert.equal(evidence.observations.length,4);
for(const row of evidence.observations){
  assert.equal(row.historyRetention.mode,'compact-history-row');
  assert.match(row.historyRetention.originalPayloadSha256,/^[a-f0-9]{64}$/);
  assert.equal(row.coverage.surfaceCount,9);
  assert.equal(row.coverage.measuredSurfaceCount,8);
  assert.equal(row.coverage.sourceBoundUnknownSurfaceCount,1);
  assert.equal(row.surfaces.fxLiquidity.measurementState,'MEASURED-current-fraxtal-frxusd-fraxswap-registry-partial');
  assert.equal(row.surfaces.revenueRouting.measurementState,'UNKNOWN-current-value-not-ingested');
  assert.match(String(row.surfaces.fxLiquidity.measured.epistemic.usdTvl),/^UNKNOWN/);
  assert.match(String(row.surfaces.revenueRouting.measured.epistemic.eligibleNetRevenue),/^UNKNOWN/);
  assert.equal(row.authority.executionAuthority,'none');
}
assert.ok(before>result.afterBytes*2,'synthetic rich history should demonstrate material bounded reduction');
console.log('PROTOCOL EVIDENCE HISTORY RETENTION CANARY PASS',{
  beforeBytes:result.beforeBytes,
  afterBytes:result.afterBytes,
  reductionPct:result.reductionPct,
  historicalRows:result.historicalObservationCount,
  latestPayloadSha256:evidence.historyRetention.latestPayloadSha256,
  revenueRouting:evidence.observations.at(-1).surfaces.revenueRouting.measurementState,
  executionAuthority:evidence.latest.observation.authority.executionAuthority
});
