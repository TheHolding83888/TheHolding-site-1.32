#!/usr/bin/env node
/**
 * The Holding · Canonical Income Ledger facade v0.1
 *
 * The pre-Project-X canonical builder is preserved byte-for-byte in
 * income-ledger-core.mjs. This facade extends that same append-only ledger with
 * Project X factual collectible-fee accruals and deterministic non-economic
 * recognition metadata for proven settlement lanes.
 *
 * No second ledger, no second source of truth, no Reference APR income, and no
 * execution authority are introduced.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import * as core from './income-ledger-core.mjs';
import { buildProjectXIncomeCandidates } from './projectx-income-candidates.mjs';
import { historicalCanonicalPriceAtBoundary } from './historical-canonical-price.mjs';
import {
  ve33EventIdentity,
  historicalValuationSourceMatchesVe33Identity
} from './ve33-historical-valuation-identity.mjs';

export * from './income-ledger-core.mjs';
export { buildProjectXIncomeCandidates } from './projectx-income-candidates.mjs';

const __filename=fileURLToPath(import.meta.url);
const __dirname=path.dirname(__filename);
const ROOT=path.resolve(__dirname,'..');
const CORE_FILE=path.join(__dirname,'income-ledger-core.mjs');
const PROJECTX_CANDIDATES_FILE=path.join(__dirname,'projectx-income-candidates.mjs');
const HISTORY_FILE=process.env.PROJECTX_HISTORY_FILE||path.join(ROOT,'companies','company-010-projectx-rate-history.json');
const DEFITEA_LEDGER_FILE=process.env.DEFITEA_INCOME_LEDGER_FILE||path.join(ROOT,'reporting','defitea-income-ledger.json');
const OUTPUT_FILE=process.env.INCOME_LEDGER_FILE||path.join(ROOT,'reporting','income-ledger.json');

const FORTY_ACRES_ROUTE='forty-acres-velodrome-received';
const FORTY_ACRES_SETTLEMENT_VERSION='0.1-40acres-actual-received-replaces-velodrome-reference';
const FORTY_ACRES_SETTLEMENT_OF='canonical-accrued-income:velodrome_vevelo:defitea.eth';
const HISTORICAL_VALUATION_RESOLUTION_VERSION='0.1-canonical-historical-valuation-resolution';
const VE33_SOURCE_FILE='reporting/ve33-accounting-evidence.json';
const MONTH_BOUNDARY=/^\d{4}-\d{2}-01T00:00:00\.000Z$/;

// The Reporting safe-writer already fingerprints income-ledger.mjs. These blob
// guards extend that fail-closed contract to the extracted immutable core and
// Project X candidate module without adding a second orchestration path.
const EXPECTED_CORE_GIT_BLOB='3a1c26a22c08d98257fea83a8a513a987ef75d39';
const EXPECTED_PROJECTX_CANDIDATES_GIT_BLOB='fd7860b37a1c45f772f826e43072b4a860072118';

async function readJson(file,fallback={}){try{return JSON.parse(await fs.readFile(file,'utf8'));}catch{return fallback;}}
async function writeJson(file,data){await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,JSON.stringify(data,null,2)+'\n');}
function gitBlobSha(content){const body=Buffer.isBuffer(content)?content:Buffer.from(content);const header=Buffer.from(`blob ${body.length}\0`);return crypto.createHash('sha1').update(Buffer.concat([header,body])).digest('hex');}
const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
const round=(v,d=8)=>finite(v)?Math.round(Number(v)*10**d)/10**d:null;
async function verifyExtensionIntegrity(){
  const[coreBytes,candidateBytes]=await Promise.all([fs.readFile(CORE_FILE),fs.readFile(PROJECTX_CANDIDATES_FILE)]);
  const coreSha=gitBlobSha(coreBytes),candidateSha=gitBlobSha(candidateBytes);
  if(coreSha!==EXPECTED_CORE_GIT_BLOB)throw new Error(`Canonical Income Ledger core integrity drift: ${coreSha}`);
  if(candidateSha!==EXPECTED_PROJECTX_CANDIDATES_GIT_BLOB)throw new Error(`Project X income candidate module integrity drift: ${candidateSha}`);
  return{coreSha,candidateSha};
}

export function annotateFortyAcresSettlementRecognition(ledger,defiteaSource){
  const contract=defiteaSource?.fortyAcresSettlement||null;
  const sourceEvents=Array.isArray(defiteaSource?.fortyAcresReceivedEvents)?defiteaSource.fortyAcresReceivedEvents:[];
  if(!sourceEvents.length)return{ledger,annotated:0};
  if(
    contract?.version!==FORTY_ACRES_SETTLEMENT_VERSION||
    contract?.route!==FORTY_ACRES_ROUTE||
    contract?.principalId!=='velodrome-finance'||
    contract?.referenceDoubleCountPrevented!==true||
    contract?.unknownIsNotZero!==true||
    contract?.executionAuthority!=='none'
  )throw new Error('40 Acres settlement recognition contract unavailable or drifted');

  const trackingSince=String(contract.trackingSince||'');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(trackingSince))throw new Error('40 Acres settlement tracking boundary invalid');
  const sourceKeys=new Set(sourceEvents.map(x=>x?.eventKey).filter(Boolean).map(x=>`defitea-received:${x}`));
  let annotated=0;
  const events=(ledger?.events||[]).map(event=>{
    if(!sourceKeys.has(event?.eventKey))return event;
    if(
      event.company!=='defitea.eth'||event.family!=='realised-cash-flow'||event.route!==FORTY_ACRES_ROUTE||
      event.protocol!=='40 Acres · veVELO'||event.sourceFile!=='reporting/defitea-income-ledger.json'||
      event.sourceFamily!=='fortyAcresReceivedEvents'||event.evidenceStatus!=='canonical-actual-net-received'||
      !event.physicalEventId||String(event.economicDate||'')<trackingSince||event.executionAuthority!=='none'
    )throw new Error(`40 Acres canonical settlement identity drift: ${event?.eventKey||'unknown'}`);
    const prior=event.incomeRecognition||null;
    if(prior&&(
      prior.recognizesEarnedIncome!==false||prior.settlementOf!==FORTY_ACRES_SETTLEMENT_OF
    ))throw new Error(`40 Acres income-recognition conflict: ${event.eventKey}`);
    annotated++;
    return{
      ...event,
      incomeRecognition:{
        recognizesEarnedIncome:false,
        settlementOf:FORTY_ACRES_SETTLEMENT_OF,
        recognitionBasis:'settlement-of-canonical-ve33-earned-accrual-lane',
        settlementStatus:'settled-net-receipt',
        mechanismId:'velodrome_vevelo',
        sourceContractVersion:contract.version,
        economicFieldsMutated:false,
        executionAuthority:'none'
      }
    };
  });

  if(annotated!==sourceKeys.size)throw new Error(`40 Acres settlement recognition parity mismatch: ${annotated}/${sourceKeys.size}`);
  return{
    ledger:{
      ...ledger,
      events,
      sourceState:{
        ...(ledger?.sourceState||{}),
        fortyAcresSettlementRecognition:{
          source:'reporting/defitea-income-ledger.json#fortyAcresSettlement',
          version:'0.1-canonical-settlement-only-recognition',
          sourceContractVersion:contract.version,
          route:FORTY_ACRES_ROUTE,
          mechanismId:'velodrome_vevelo',
          settlementOf:FORTY_ACRES_SETTLEMENT_OF,
          eventCount:annotated,
          economicFieldsMutated:false,
          referenceAprUsed:false,
          executionAuthority:'none'
        }
      },
      accountingExtensions:{
        ...(ledger?.accountingExtensions||{}),
        fortyAcresSettlementRecognition:{
          version:'0.1-canonical-settlement-only-recognition',
          family:'realised-cash-flow',
          recognizesEarnedIncome:false,
          settlementOf:FORTY_ACRES_SETTLEMENT_OF,
          accruedIncomeRemainsEarnedIncomeAuthority:true,
          receiptDoesNotReRecognizeIncome:true,
          unknownIsNotZero:true,
          executionAuthority:'none'
        }
      }
    },
    annotated
  };
}

function withoutValuationResolution(event){
  if(!event?.valuationResolution)return event;
  const{valuationResolution,...clean}=event;
  return clean;
}

function reusableIdentityBoundResolution(event,identity){
  const r=event?.valuationResolution||null;
  if(
    r?.version!==HISTORICAL_VALUATION_RESOLUTION_VERSION||r?.identityBound!==true||
    String(r?.identityToken||'').toLowerCase()!==identity.token||
    String(r?.boundaryAt||'')!==String(event?.periodEnd||'')||
    r?.economicFieldsMutated!==false||r?.referenceAprUsed!==false||r?.currentPriceUsed!==false||
    r?.unknownIsNotZero!==true||r?.executionAuthority!=='none'||r?.originalUsdValue!==null||
    !finite(r?.valuationUnitUsd)||Number(r.valuationUnitUsd)<=0||!finite(r?.resolvedUsdValue)||Number(r.resolvedUsdValue)<=0||
    !historicalValuationSourceMatchesVe33Identity(event,r)
  )return false;
  const observedMs=Date.parse(r.observedAt||''),boundaryMs=Date.parse(r.boundaryAt||'');
  if(!Number.isFinite(observedMs)||!Number.isFinite(boundaryMs)||observedMs>boundaryMs)return false;
  if(r.sourceFamily==='historical-onchain-chainlink-at-boundary'){
    if(r?.exactHistoricalBlock!==true||Number(r?.sourceBlockNumber)!==Number(identity.closeBlock))return false;
    const blockMs=Date.parse(r?.sourceBlockTimestamp||'');
    if(!Number.isFinite(blockMs)||blockMs>boundaryMs||observedMs>blockMs)return false;
  }
  const expected=round(Number(event.amount)*Number(r.valuationUnitUsd),8);
  return finite(expected)&&Math.abs(Number(expected)-Number(r.resolvedUsdValue))<=0.00000002;
}

export async function annotateHistoricalValuationResolution(ledger,{resolver=historicalCanonicalPriceAtBoundary}={}){
  const cache=new Map();
  let eligible=0,resolved=0,unresolved=0,identityMismatchEventCount=0,legacyResolutionReplacedCount=0,invalidPriorResolutionClearedCount=0,reusedIdentityBoundResolutionCount=0;
  const unresolvedStatuses={};
  const events=[];

  for(const event of ledger?.events||[]){
    const boundaryAt=String(event?.periodEnd||'');
    const isEligible=
      event?.family==='accrued-entitlement'&&
      event?.sourceFile===VE33_SOURCE_FILE&&
      event?.usdValue===null&&
      event?.valuationStatus==='unvalued-fail-closed'&&
      MONTH_BOUNDARY.test(boundaryAt)&&
      finite(event?.amount)&&Number(event.amount)>0&&
      event?.unknownIsNotZero===true&&event?.executionAuthority==='none';

    if(!isEligible){events.push(event);continue;}
    eligible++;
    const identity=ve33EventIdentity(event);
    const prior=event?.valuationResolution||null;
    const cleanEvent=withoutValuationResolution(event);
    if(!identity.ok){
      unresolved++;
      unresolvedStatuses[identity.status]=(unresolvedStatuses[identity.status]||0)+1;
      if(prior)invalidPriorResolutionClearedCount++;
      events.push(cleanEvent);
      continue;
    }
    if(identity.eventTokenMatchesIdentity!==true)identityMismatchEventCount++;
    if(reusableIdentityBoundResolution(event,identity)){
      resolved++;
      reusedIdentityBoundResolutionCount++;
      events.push(event);
      continue;
    }

    const key=`${identity.token}|${boundaryAt}|${identity.closeBlock}`;
    if(!cache.has(key))cache.set(key,Promise.resolve().then(()=>resolver({
      token:identity.token,boundaryAt,eventKey:event.eventKey,sourceIdentity:event.sourceIdentity
    })).catch(error=>({ok:false,status:'historical-canonical-price-resolver-error',error:error?.message||String(error)})));
    const valuation=await cache.get(key);
    const price=Number(valuation?.priceUsd),observedMs=Date.parse(valuation?.observedAt||''),boundaryMs=Date.parse(boundaryAt);
    if(valuation?.ok!==true||!(Number.isFinite(price)&&price>0)||!Number.isFinite(observedMs)||observedMs>boundaryMs){
      unresolved++;
      const status=valuation?.status||'historical-canonical-price-unavailable';
      unresolvedStatuses[status]=(unresolvedStatuses[status]||0)+1;
      if(prior)invalidPriorResolutionClearedCount++;
      events.push(cleanEvent);
      continue;
    }

    const resolvedUsdValue=round(Number(event.amount)*price,8);
    if(!(finite(resolvedUsdValue)&&Number(resolvedUsdValue)>0)){
      unresolved++;
      unresolvedStatuses['resolved-usd-value-invalid']=(unresolvedStatuses['resolved-usd-value-invalid']||0)+1;
      if(prior)invalidPriorResolutionClearedCount++;
      events.push(cleanEvent);
      continue;
    }

    const sourceFamily=valuation.sourceFamily||'canonical-market-data-git-history';
    const resolution={
      version:HISTORICAL_VALUATION_RESOLUTION_VERSION,
      resolvesUsdValue:true,
      resolvedUsdValue,
      valuationUnitUsd:round(price,12),
      boundaryAt,
      observedAt:valuation.observedAt,
      sourceFile:valuation.sourceFile||null,
      sourceCommit:valuation.commitSha||null,
      sourceAssetId:valuation.assetId||null,
      sourceStatus:valuation.status||'historical-canonical-market-price',
      snapshotAgeMinutes:finite(valuation.ageMinutes)?round(valuation.ageMinutes,6):null,
      sourceFamily,
      ...(sourceFamily==='historical-onchain-chainlink-at-boundary'?{
        sourceChainId:Number(valuation.chainId),
        sourceBlockNumber:Number(valuation.sourceBlockNumber),
        sourceBlockTimestamp:valuation.sourceBlockTimestamp||null,
        sourceContract:valuation.sourceContract||null,
        sourceRoundId:valuation.roundId||null,
        sourceAnsweredInRound:valuation.answeredInRound||null,
        sourceRpcEndpointId:valuation.rpcEndpointId||null,
        exactHistoricalBlock:valuation.exactHistoricalBlock===true
      }:{}),
      identityBound:true,
      identityToken:identity.token,
      identityOpenBlock:identity.openBlock,
      identityCloseBlock:identity.closeBlock,
      eventTokenMatchesIdentity:identity.eventTokenMatchesIdentity===true,
      identitySource:'ve33-eventKey+sourceIdentity',
      originalUsdValue:null,
      economicFieldsMutated:false,
      referenceAprUsed:false,
      currentPriceUsed:false,
      unknownIsNotZero:true,
      executionAuthority:'none'
    };
    if(!historicalValuationSourceMatchesVe33Identity(event,resolution)){
      unresolved++;
      unresolvedStatuses['historical-valuation-source-identity-mismatch']=(unresolvedStatuses['historical-valuation-source-identity-mismatch']||0)+1;
      if(prior)invalidPriorResolutionClearedCount++;
      events.push(cleanEvent);
      continue;
    }
    if(sourceFamily==='historical-onchain-chainlink-at-boundary'&&Number(resolution.sourceBlockNumber)!==Number(identity.closeBlock)){
      unresolved++;
      unresolvedStatuses['historical-chainlink-block-identity-mismatch']=(unresolvedStatuses['historical-chainlink-block-identity-mismatch']||0)+1;
      if(prior)invalidPriorResolutionClearedCount++;
      events.push(cleanEvent);
      continue;
    }
    if(prior&&JSON.stringify(prior)!==JSON.stringify(resolution))legacyResolutionReplacedCount++;
    resolved++;
    events.push({...cleanEvent,valuationResolution:resolution});
  }

  const summary={
    version:HISTORICAL_VALUATION_RESOLUTION_VERSION,
    eligibleEventCount:eligible,
    resolvedEventCount:resolved,
    unresolvedEventCount:unresolved,
    unresolvedStatuses,
    identityMismatchEventCount,
    legacyResolutionReplacedCount,
    invalidPriorResolutionClearedCount,
    reusedIdentityBoundResolutionCount,
    identityBinding:'ve33-eventKey+sourceIdentity',
    economicFieldsMutated:false,
    referenceAprUsed:false,
    currentPriceUsed:false,
    unknownIsNotZero:true,
    executionAuthority:'none'
  };
  return{
    ledger:{
      ...ledger,
      events,
      sourceState:{
        ...(ledger?.sourceState||{}),
        historicalValuationResolution:{
          ...summary,
          source:'canonical Market Data Git history or exact historical onchain Chainlink at original accounting boundary'
        }
      },
      accountingExtensions:{
        ...(ledger?.accountingExtensions||{}),
        historicalValuationResolution:{
          ...summary,
          immutableEventUsdValueRewritten:false,
          resolvedValueLivesInNonEconomicMetadata:true,
          mutableEventTokenMetadataIsNotValuationAuthority:true
        }
      }
    },
    ...summary
  };
}

function annotateProjectX(rebuilt,history,built,newEventsAdmitted,integrity,generatedAt){
  const s=built.summary;
  return{
    ...rebuilt,
    generatedAt,
    sourceState:{
      ...(rebuilt.sourceState||{}),
      projectXFeeAccrual:{
        file:'companies/company-010-projectx-rate-history.json',
        version:history?.version||null,
        engineVersion:history?.engineVersion||null,
        generatedAt:history?.generatedAt||null,
        observationCount:s.observationCount,
        intervalCount:s.intervalCount,
        acceptedIntervalCount:s.acceptedIntervalCount,
        measuredZeroIntervalCount:s.measuredZeroIntervalCount,
        fingerprintBoundaryCount:s.fingerprintBoundaryCount,
        claimResetBoundaryCount:s.claimResetBoundaryCount,
        crossMonthBoundaryCount:s.crossMonthBoundaryCount,
        candidateEventCount:s.candidateEventCount,
        sourceMethod:'adjacent same-fingerprint collect.staticCall fee growth',
        referenceAprUsed:false,
        currentClaimableBalanceIsPeriodIncome:false,
        laterPriceMovementRewritesClosedIncome:false,
        coreGitBlob:integrity.coreSha,
        candidateModuleGitBlob:integrity.candidateSha
      }
    },
    run:{
      ...(rebuilt.run||{}),
      projectXCandidateEventCount:s.candidateEventCount,
      projectXNewEventsAdmitted:newEventsAdmitted,
      projectXObservationCount:s.observationCount,
      projectXAcceptedIntervalCount:s.acceptedIntervalCount,
      projectXBoundaryCount:s.fingerprintBoundaryCount+s.claimResetBoundaryCount+s.crossMonthBoundaryCount
    },
    accountingExtensions:{
      ...(rebuilt.accountingExtensions||{}),
      projectXFeeAccrual:{
        version:built.version,
        source:'companies/company-010-projectx-rate-history.json',
        company:'Cypher',
        route:'projectx-whype-usdc',
        family:'accrued-entitlement',
        openingBalanceCreatesIncome:false,
        fingerprintChangeCreatesIncome:false,
        claimOrResetCreatesIncome:false,
        claimOrResetIsSettlementBoundary:true,
        crossMonthIntervalAutoAllocated:false,
        currentClaimableBalanceIsPeriodIncome:false,
        endpointObservedPriceFreezesValuation:true,
        referenceAprUsed:false,
        laterPriceMovementRewritesClosedIncome:false,
        unknownIsNotZero:true,
        executionAuthority:'none'
      }
    }
  };
}

export async function build(){
  const integrity=await verifyExtensionIntegrity();
  const base=await core.build();
  const[history,defiteaSource]=await Promise.all([readJson(HISTORY_FILE),readJson(DEFITEA_LEDGER_FILE)]);
  const generatedAt=base?.generatedAt||new Date().toISOString();
  const built=buildProjectXIncomeCandidates(history,core.finalizeCandidate,generatedAt);
  const admitted=core.admitEvents(base?.events,built.candidates);
  let rebuilt=base;

  if(admitted.admitted>0){
    // Temporary working-tree state only. If any subsequent validation/rebuild
    // fails, the workflow fails and the safe writer never publishes it.
    await writeJson(OUTPUT_FILE,{...base,events:admitted.events});
    rebuilt=await core.build();
  }

  const projectXAnnotated=annotateProjectX(rebuilt,history,built,admitted.admitted,integrity,generatedAt);
  const settlementAnnotated=annotateFortyAcresSettlementRecognition(projectXAnnotated,defiteaSource);
  const valuationAnnotated=await annotateHistoricalValuationResolution(settlementAnnotated.ledger);
  return{
    ...valuationAnnotated.ledger,
    run:{
      ...(valuationAnnotated.ledger.run||{}),
      fortyAcresSettlementOnlyRecognitionCount:settlementAnnotated.annotated,
      historicalValuationResolvedEventCount:valuationAnnotated.resolvedEventCount,
      historicalValuationUnresolvedEventCount:valuationAnnotated.unresolvedEventCount
    }
  };
}

async function main(){
  const output=await build();
  await writeJson(OUTPUT_FILE,output);
  console.log('Canonical Income Ledger built with factual accrual, settlement recognition and historical valuation resolution',{
    events:output.events?.length||0,
    newEvents:output.run?.newEventsAdmitted||0,
    projectXCandidates:output.run?.projectXCandidateEventCount||0,
    projectXNewEvents:output.run?.projectXNewEventsAdmitted||0,
    projectXAcceptedIntervals:output.run?.projectXAcceptedIntervalCount||0,
    fortyAcresSettlementOnlyRecognitions:output.run?.fortyAcresSettlementOnlyRecognitionCount||0,
    historicalValuationResolvedEvents:output.run?.historicalValuationResolvedEventCount||0,
    historicalValuationUnresolvedEvents:output.run?.historicalValuationUnresolvedEventCount||0,
    claimableSnapshots:output.claimableSnapshots?.length||0,
    companies:Object.keys(output.companies||{}).length,
    unknownIsNotZero:output.semantics?.unknownIsNotZero===true,
    referenceAprUsed:false,
    executionAuthority:output.authority?.executionAuthority||null
  });
}

if(process.argv[1]&&path.resolve(process.argv[1])===__filename)main().catch(error=>{console.error(error);process.exitCode=1;});
