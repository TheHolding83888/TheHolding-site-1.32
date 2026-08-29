#!/usr/bin/env node
/**
 * The Holding · Frax frxETH V2 RedemptionQueue exact-block state v0.1
 *
 * Measures bounded read-only RedemptionQueue V2 state at the same Ethereum
 * checkpoint selected by the base frxETH atom. It measures queue liabilities,
 * fee accounting, local ETH liquidity and the source-defined shortage/surplus
 * arithmetic without entering, redeeming, collecting or mutating the queue.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const FRAX_FRXETH_V2_REDEMPTION_QUEUE_VERSION='0.1-frxeth-v2-redemption-queue-exact-block';
export const FRAX_ECOSYSTEM_EVIDENCE_ID='registry-frax-ecosystem';
export const FRAX_PROTOCOL_ID='registry-frax-vefrax';
export const FRAX_FRXETH_SURFACE_KEY='frxEthSfrxEth';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const REGISTRY_FILE=path.join(ROOT,'intelligence/economic-graph/frax-frxeth-registry.json');
const RPC_REGISTRY_FILE=path.join(ROOT,'intelligence/market-data/onchain-price-source-registry.json');
const RPC_TIMEOUT_MS=10_000;
const MAX_OBSERVATIONS=1000;
const EXPECTED_SOURCE_COMMIT='83dfe93b4a32b9ca0ab93d6e7c059fcd977320d4';
const SELECTORS={
  redemptionQueueState:'0x1494ef63',
  redemptionQueueAccounting:'0x103cf9e3',
  ethShortageOrSurplus:'0x9c79ceb0',
  feeRecipient:'0x46904840',
  etherRouter:'0xc9cb9497',
  frxETH:'0x6ae3535e',
  sfrxETH:'0x7d7d7b0a',
  maxQueueLengthSeconds:'0xb8c2d71a',
  feePrecision:'0xe63a391f',
  maxRedemptionFee:'0x5abd98db',
  maxFrxEthPerNft:'0xdfe8ccbd',
  entrancyStatus:'0xa71ada54'
};

function sha256(value){return crypto.createHash('sha256').update(value).digest('hex');}
function stableValue(value){if(Array.isArray(value))return value.map(stableValue);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,stableValue(value[key])]));return value;}
function stableStringify(value){return JSON.stringify(stableValue(value));}
function readJson(file){return JSON.parse(fs.readFileSync(file,'utf8'));}
function normalize(value){return String(value||'').toLowerCase();}
function validAddress(value){return /^0x[0-9a-fA-F]{40}$/.test(String(value||''));}
function cleanHex(hex){const clean=String(hex||'').replace(/^0x/,'');if(!/^[0-9a-f]*$/i.test(clean)||clean.length%64!==0)throw new Error('Invalid ABI payload');return clean;}
function wordCount(hex){return cleanHex(hex).length/64;}
function decodeWord(hex,index=0){const clean=cleanHex(hex),start=index*64;if(clean.length<start+64)throw new Error(`Invalid ABI word ${index}`);return BigInt(`0x${clean.slice(start,start+64)}`);}
function decodeSignedWord(hex,index=0){const raw=decodeWord(hex,index),limit=1n<<255n,mod=1n<<256n;return raw>=limit?raw-mod:raw;}
function decodeQuantity(hex){if(!/^0x[0-9a-f]+$/i.test(String(hex||'')))throw new Error('Invalid RPC quantity');return BigInt(hex);}
function decodeAddress(hex,index=0){const word=decodeWord(hex,index).toString(16).padStart(64,'0');return `0x${word.slice(24)}`;}
function units(raw,decimals=18){const sign=raw<0n?'-':'';const abs=raw<0n?-raw:raw,base=10n**BigInt(decimals),whole=abs/base,fraction=(abs%base).toString().padStart(decimals,'0').replace(/0+$/,'');return Number(`${sign}${whole}${fraction?'.'+fraction:''}`);}
function round(value,digits=12){const n=Number(value);return Number.isFinite(n)?Number(n.toFixed(digits)):null;}
function feePct(raw,precision){return precision>0n?round(Number(raw)*100/Number(precision),8):null;}

export function validateFraxFrxEthRedemptionQueueRegistry(registry){
  if(registry?.version!=='0.1-frxeth-current-state-registry'||registry?.network!=='ethereum'||Number(registry?.chainId)!==1)throw new Error('frxETH RedemptionQueue registry identity drift');
  if(!validAddress(registry?.operations?.redemptionQueueV2)||!validAddress(registry?.operations?.etherRouter)||!validAddress(registry?.assets?.frxETH?.address)||!validAddress(registry?.assets?.sfrxETH?.address))throw new Error('frxETH RedemptionQueue registry addresses invalid');
  if(registry?.sources?.officialSourceRepo!=='FraxFinance/frxETH-v2-public'||registry?.sources?.officialSourceCommit!==EXPECTED_SOURCE_COMMIT)throw new Error('frxETH RedemptionQueue official source pin drift');
  if(registry?.epistemic?.unknownIsZero!==false||registry?.epistemic?.executionAuthority!=='none'||registry?.epistemic?.causalClaimAuthority!=='none')throw new Error('frxETH RedemptionQueue epistemic boundary drift');
  return registry;
}

async function postBatch(url,payload,fetchImpl){
  const response=await fetchImpl(url,{method:'POST',headers:{'content-type':'application/json',accept:'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(RPC_TIMEOUT_MS)});
  if(!response.ok)throw new Error(`RPC HTTP ${response.status}`);
  const body=await response.json();if(!Array.isArray(body))throw new Error('RPC response is not an array');
  const byId=new Map(body.map(row=>[Number(row?.id),row]));
  for(const req of payload){const row=byId.get(req.id);if(!row)throw new Error(`RPC result ${req.id} missing`);if(row.error)throw new Error(`RPC ${req.method} error: ${row.error?.message||'unknown error'}`);if(row.result===undefined||row.result===null)throw new Error(`RPC ${req.method} result missing`);}
  return byId;
}
function call(id,to,data,blockTag){return {jsonrpc:'2.0',id,method:'eth_call',params:[{to,data},blockTag]};}
function unknownMeasurement(source,reason,attempts=[]){
  return {
    version:FRAX_FRXETH_V2_REDEMPTION_QUEUE_VERSION,status:reason,measurementClass:'UNKNOWN',observedAt:null,network:'ethereum',chainId:1,blockNumber:null,blockTag:null,blockHash:null,
    redemptionQueue:{address:source?.operations?.redemptionQueueV2||null,deployedCodePresent:null,nativeEthBalance:null,state:null,accounting:null,liquidity:null,feeRecipient:null,topology:null,registryPointerParity:null},
    rpc:{endpointId:null,failoverAttempts:attempts,reusedCheckpoint:false},
    epistemic:{sourceType:'onchain-public-rpc-exact-block',currentStateMeasured:false,redemptionLiabilities:'UNKNOWN',unclaimedRedemptionFees:'UNKNOWN',pendingRedemptionFees:'UNKNOWN',queueLiquidityBalance:'UNKNOWN',aggregateProtocolRevenue:'UNKNOWN',downstreamFeeRouting:'UNKNOWN',validatorEconomics:'UNKNOWN',unknownIsZero:false,causalClaimAuthority:'none',executionAuthority:'none'}
  };
}

export async function collectFraxFrxEthV2RedemptionQueueCurrentState({registry=null,rpcRegistry=null,fetchImpl=fetch,checkpoint=null}={}){
  const source=validateFraxFrxEthRedemptionQueueRegistry(registry||readJson(REGISTRY_FILE));
  const rpc=rpcRegistry||readJson(RPC_REGISTRY_FILE),network=rpc?.networks?.ethereum,endpoints=Array.isArray(network?.rpcFailover)?network.rpcFailover:[],attempts=[];
  if(Number(network?.chainId)!==1||!endpoints.length)throw new Error('Ethereum RPC registry unavailable');
  const queue=source.operations.redemptionQueueV2;
  for(const endpoint of endpoints){
    try{
      let blockTag=checkpoint?.blockTag||null;
      if(!blockTag){const head=await postBatch(endpoint.url,[{jsonrpc:'2.0',id:1,method:'eth_blockNumber',params:[]}],fetchImpl);blockTag=head.get(1).result;}
      if(!/^0x[0-9a-f]+$/i.test(String(blockTag)))throw new Error('Invalid exact block tag');
      const rows=await postBatch(endpoint.url,[
        {jsonrpc:'2.0',id:2,method:'eth_getBlockByNumber',params:[blockTag,false]},
        {jsonrpc:'2.0',id:3,method:'eth_getCode',params:[queue,blockTag]},
        {jsonrpc:'2.0',id:4,method:'eth_getBalance',params:[queue,blockTag]},
        call(10,queue,SELECTORS.redemptionQueueState,blockTag),
        call(11,queue,SELECTORS.redemptionQueueAccounting,blockTag),
        call(12,queue,SELECTORS.ethShortageOrSurplus,blockTag),
        call(13,queue,SELECTORS.feeRecipient,blockTag),
        call(14,queue,SELECTORS.etherRouter,blockTag),
        call(15,queue,SELECTORS.frxETH,blockTag),
        call(16,queue,SELECTORS.sfrxETH,blockTag),
        call(17,queue,SELECTORS.maxQueueLengthSeconds,blockTag),
        call(18,queue,SELECTORS.feePrecision,blockTag),
        call(19,queue,SELECTORS.maxRedemptionFee,blockTag),
        call(20,queue,SELECTORS.maxFrxEthPerNft,blockTag),
        call(21,queue,SELECTORS.entrancyStatus,blockTag)
      ],fetchImpl);
      const block=rows.get(2).result,blockNumber=Number(decodeQuantity(block?.number||blockTag)),timestampSeconds=Number(decodeQuantity(block?.timestamp));
      if(!(blockNumber>0)||!(timestampSeconds>0)||!/^0x[0-9a-f]{64}$/i.test(String(block?.hash||'')))throw new Error('Exact block identity unavailable');
      const deployed=String(rows.get(3).result||'');if(!/^0x[0-9a-f]+$/i.test(deployed)||deployed==='0x'||deployed==='0x0')throw new Error('RedemptionQueue deployed code missing');

      const nativeEth=decodeQuantity(rows.get(4).result);
      const statePayload=rows.get(10).result,stateWords=wordCount(statePayload);
      if(stateWords<3)throw new Error('RedemptionQueue state ABI shape drift');
      const nextNftId=decodeWord(statePayload,0),queueLengthSecs=decodeWord(statePayload,1),redemptionFee=decodeWord(statePayload,2);
      const ttlEthRequested=stateWords>=5?decodeWord(statePayload,3):null,ttlEthServed=stateWords>=5?decodeWord(statePayload,4):null;

      const accountingPayload=rows.get(11).result;
      if(wordCount(accountingPayload)<3)throw new Error('RedemptionQueue accounting ABI shape drift');
      const etherLiabilities=decodeWord(accountingPayload,0),unclaimedFees=decodeWord(accountingPayload,1),pendingFees=decodeWord(accountingPayload,2);
      const netEthBalance=decodeSignedWord(rows.get(12).result,0),shortage=decodeWord(rows.get(12).result,1);

      const feeRecipient=decodeAddress(rows.get(13).result),etherRouter=decodeAddress(rows.get(14).result),frxETH=decodeAddress(rows.get(15).result),sfrxETH=decodeAddress(rows.get(16).result);
      const maxQueueLengthSeconds=decodeWord(rows.get(17).result),feePrecision=decodeWord(rows.get(18).result),maxRedemptionFee=decodeWord(rows.get(19).result),maxFrxEthPerNft=decodeWord(rows.get(20).result),entered=decodeWord(rows.get(21).result)!==0n;
      if(feePrecision!==1_000_000n||maxRedemptionFee!==20_000n||maxFrxEthPerNft!==1000n*10n**18n)throw new Error('RedemptionQueue source constant drift');

      const expectedNet=nativeEth-(etherLiabilities-pendingFees);
      const expectedShortage=expectedNet<0n?-expectedNet:0n;
      const netParity=expectedNet===netEthBalance,shortageParity=expectedShortage===shortage;
      if(!netParity||!shortageParity)throw new Error('RedemptionQueue shortage/surplus arithmetic parity drift');

      const pointerParity={
        etherRouter:normalize(etherRouter)===normalize(source.operations.etherRouter),
        frxETH:normalize(frxETH)===normalize(source.assets.frxETH.address),
        sfrxETH:normalize(sfrxETH)===normalize(source.assets.sfrxETH.address)
      };
      const registryPointerParity=Object.values(pointerParity).every(Boolean);
      const liquidityStatus=netEthBalance<0n?'SHORTAGE':netEthBalance>0n?'SURPLUS':'BALANCED';

      return {
        version:FRAX_FRXETH_V2_REDEMPTION_QUEUE_VERSION,status:'ok',measurementClass:'MEASURED',observedAt:new Date(timestampSeconds*1000).toISOString(),network:'ethereum',chainId:1,blockNumber,blockTag,blockHash:block.hash,
        sourceRegistryVersion:source.version,
        sourceBinding:{officialSourceRepo:source.sources.officialSourceRepo,officialSourceCommit:source.sources.officialSourceCommit,coreSource:'src/contracts/frxeth-redemption-queue-v2/FraxEtherRedemptionQueueCore.sol',v2Source:'src/contracts/frxeth-redemption-queue-v2/FraxEtherRedemptionQueueV2.sol',interfaceSource:'src/contracts/frxeth-redemption-queue-v2/interfaces/IFraxEtherRedemptionQueueV2.sol',shortageFunction:'ethShortageOrSurplus()',accountingFunction:'redemptionQueueAccounting()',stateFunction:'redemptionQueueState()'},
        redemptionQueue:{
          address:queue,deployedCodePresent:true,
          nativeEthBalance:{raw:nativeEth.toString(),eth:round(units(nativeEth))},
          state:{
            abiWordCount:stateWords,nextNftId:Number(nextNftId),queueLengthSecs:Number(queueLengthSecs),queueLengthDays:round(Number(queueLengthSecs)/86400,8),
            redemptionFeeRaw:redemptionFee.toString(),redemptionFeePct:feePct(redemptionFee,feePrecision),
            ttlEthRequested:ttlEthRequested===null?{status:'UNKNOWN-interface-shape-does-not-expose-current-core-field',raw:null,eth:null}:{status:'MEASURED',raw:ttlEthRequested.toString(),eth:round(units(ttlEthRequested))},
            ttlEthServed:ttlEthServed===null?{status:'UNKNOWN-interface-shape-does-not-expose-current-core-field',raw:null,eth:null}:{status:'MEASURED',raw:ttlEthServed.toString(),eth:round(units(ttlEthServed))}
          },
          accounting:{
            etherLiabilities:{raw:etherLiabilities.toString(),eth:round(units(etherLiabilities)),semantics:'ETH owed across outstanding redemption tickets'},
            unclaimedFees:{raw:unclaimedFees.toString(),frxEth:round(units(unclaimedFees)),semantics:'earned redemption fees not yet collected by protocol'},
            pendingFees:{raw:pendingFees.toString(),frxEth:round(units(pendingFees)),semantics:'contingent fees expected if outstanding tickets redeem fully'}
          },
          liquidity:{
            status:liquidityStatus,netEthBalanceRaw:netEthBalance.toString(),netEthBalanceEth:round(units(netEthBalance)),shortageRaw:shortage.toString(),shortageEth:round(units(shortage)),
            formula:'nativeEthBalance - (etherLiabilities - pendingFees)',netArithmeticParity:netParity,shortageArithmeticParity:shortageParity
          },
          feeRecipient,maxQueueLengthSeconds:Number(maxQueueLengthSeconds),feePrecisionRaw:feePrecision.toString(),maxRedemptionFeeRaw:maxRedemptionFee.toString(),maxRedemptionFeePct:feePct(maxRedemptionFee,feePrecision),maxFrxEthPerNftRaw:maxFrxEthPerNft.toString(),maxFrxEthPerNft:round(units(maxFrxEthPerNft)),entrancyStatus:entered,
          topology:{etherRouter,frxETH,sfrxETH},registryPointerParity,pointerParity
        },
        rpc:{endpointId:endpoint.id,failoverAttempts:attempts,reusedCheckpoint:Boolean(checkpoint?.blockTag)},
        epistemic:{
          sourceType:'onchain-public-rpc-exact-block',currentStateMeasured:true,
          redemptionLiabilities:'MEASURED-onchain-accounting',
          unclaimedRedemptionFees:'MEASURED-earned-uncollected-protocol-fees',
          pendingRedemptionFees:'MEASURED-contingent-not-realized',
          queueLiquidityBalance:'MEASURED-plus-DERIVED-mechanical-source-formula',
          cumulativeQueueFlow:stateWords>=5?'MEASURED-onchain-counters':'UNKNOWN-interface-source-shape-mismatch',
          feeRecipientIdentity:'MEASURED-current-onchain-pointer',
          downstreamFeeRouting:'UNKNOWN-beyond-current-fee-recipient-identity',
          aggregateProtocolRevenue:'UNKNOWN-not-complete-protocol-revenue-view',
          companyCashFlow:'UNKNOWN-not-measured-by-this-atom',
          validatorEconomics:'UNKNOWN-not-measured-by-this-atom',
          registryPointerParity,topologyDriftDetected:!registryPointerParity,unknownIsZero:false,causalClaimAuthority:'none',executionAuthority:'none'
        }
      };
    }catch(error){attempts.push({endpointId:endpoint?.id||null,error:String(error instanceof Error?error.message:error).slice(0,180)});}
  }
  return unknownMeasurement(source,attempts.length?`UNKNOWN-${attempts.at(-1).error.replace(/\s+/g,'-').slice(0,120)}`:'UNKNOWN-no-rpc-attempts',attempts);
}

function rebuildRelationships(current){
  const surfaces=Object.values(current?.surfaces||{});
  current.relationshipGraph=surfaces.flatMap(item=>(Array.isArray(item?.mechanicalRelations)?item.mechanicalRelations:[]).map((relation,index)=>({surfaceId:item.id,index,...relation})));
  current.coverage.relationshipCount=current.relationshipGraph.length;
  current.coverage.relationshipClassCounts=current.relationshipGraph.reduce((acc,relation)=>{const key=String(relation.class||'UNKNOWN').split('-')[0];acc[key]=(acc[key]||0)+1;return acc;},{});
}

export function applyFraxFrxEthV2RedemptionQueueCurrentState({state,measurement}){
  if(!state||typeof state!=='object')throw new Error('Frax frxETH V2 RedemptionQueue adapter requires Economic Graph state');
  if(state?.authority?.executionAuthority!=='none'||state?.authority?.causalClaimAuthority!=='none')throw new Error('Frax frxETH V2 RedemptionQueue adapter refuses Graph authority drift');
  const evidence=state?.protocolEvidence?.[FRAX_ECOSYSTEM_EVIDENCE_ID],current=evidence?.latest?.observation;
  if(!current||current.protocolId!==FRAX_PROTOCOL_ID)throw new Error('Frax frxETH V2 RedemptionQueue adapter requires Frax ecosystem observation');
  const surface=current?.surfaces?.[FRAX_FRXETH_SURFACE_KEY];
  if(!surface||!String(surface.measurementState||'').startsWith('MEASURED'))throw new Error('Frax frxETH V2 RedemptionQueue adapter requires measured frxETH surface');
  if(!surface?.measured?.v2Internals?.lendingPool)throw new Error('Frax frxETH V2 RedemptionQueue adapter requires prior LendingPool sub-atom');
  const coverageBefore={surfaceCount:current.coverage.surfaceCount,measuredSurfaceCount:current.coverage.measuredSurfaceCount,sourceBoundUnknownSurfaceCount:current.coverage.sourceBoundUnknownSurfaceCount};

  surface.measured.v2Internals=surface.measured.v2Internals||{};
  surface.measured.v2Internals.redemptionQueue=measurement;
  surface.measured.epistemic=surface.measured.epistemic||{};
  const measured=measurement?.status==='ok'&&measurement?.measurementClass==='MEASURED';

  surface.measured.epistemic.redemptionQueueState=measured?'MEASURED-current-Ethereum-exact-block':'UNKNOWN';
  surface.measured.epistemic.redemptionQueueLiabilities=measured?'MEASURED-onchain-accounting':'UNKNOWN';
  surface.measured.epistemic.redemptionQueueUnclaimedFees=measured?'MEASURED-earned-uncollected-protocol-fees':'UNKNOWN';
  surface.measured.epistemic.redemptionQueueLiquidity=measured?'MEASURED-plus-DERIVED-mechanical-source-formula':'UNKNOWN';
  surface.measured.epistemic.redemptionQueueAggregateProtocolRevenue='UNKNOWN-not-complete-protocol-revenue-view';
  surface.measured.epistemic.validatorEconomics='UNKNOWN-not-measured-by-this-atom';
  surface.measured.epistemic.executionAuthority='none';

  current.epistemic.frxEthV2RedemptionQueueState=measured?'MEASURED-current-Ethereum-exact-block':'UNKNOWN';
  current.epistemic.frxEthV2RedemptionQueueLiabilities=measured?'MEASURED-onchain-accounting':'UNKNOWN';
  current.epistemic.frxEthV2RedemptionQueueUnclaimedFees=measured?'MEASURED-earned-uncollected-protocol-fees':'UNKNOWN';
  current.epistemic.frxEthV2RedemptionQueueLiquidity=measured?'MEASURED-plus-DERIVED-mechanical-source-formula':'UNKNOWN';
  current.epistemic.frxEthV2RedemptionQueueAggregateProtocolRevenue='UNKNOWN';
  current.epistemic.frxEthV2ValidatorEconomics='UNKNOWN';

  surface.mechanicalRelations=(surface.mechanicalRelations||[]).filter(item=>item?.extension!=='frxeth-v2-redemption-queue');
  surface.mechanicalRelations.push(
    {from:'RedemptionQueue.redemptionQueueAccounting()',to:'outstanding ETH liabilities and redemption fee state',class:measured?'MEASURED-exact-block-accounting':'UNKNOWN',extension:'frxeth-v2-redemption-queue',note:'Unclaimed fees are earned protocol fee inventory; aggregate protocol revenue and downstream cash flow remain unproven.'},
    {from:'RedemptionQueue native ETH - (etherLiabilities - pendingFees)',to:'ethShortageOrSurplus()',class:measured?'DERIVED-mechanical-arithmetic-parity':'UNKNOWN',extension:'frxeth-v2-redemption-queue',note:'Exact source formula proved at the same block; no broader causal attribution.'},
    {from:'RedemptionQueue queue state',to:'current wait time / fee / cumulative request-served counters',class:measured?'MEASURED-exact-block-state':'UNKNOWN',extension:'frxeth-v2-redemption-queue',note:'Cumulative counters remain UNKNOWN if the runtime getter exposes only the legacy three-word interface shape.'},
    {from:'RedemptionQueue topology pointers',to:'source-pinned EtherRouter/frxETH/sfrxETH identities',class:measured&&measurement?.redemptionQueue?.registryPointerParity?'MEASURED-identity-parity':'UNKNOWN',extension:'frxeth-v2-redemption-queue',note:'Mechanical pointer parity only; feeRecipient is measured but not attributed beyond its current address.'}
  );

  current.measurementExtensions={...(current.measurementExtensions||{}),frxEthV2RedemptionQueueCurrentState:FRAX_FRXETH_V2_REDEMPTION_QUEUE_VERSION};
  current.nextMeasurementUnlocks=(current.nextMeasurementUnlocks||[]).filter(item=>!String(item).startsWith('Measure frxETH V2 '));
  current.nextMeasurementUnlocks.push(measured?'Measure frxETH V2 validator-pool credit / allowance / borrowed amount / solvency as a separate bounded sub-atom.':'Measure frxETH V2 RedemptionQueue liabilities, fee accounting and shortage/surplus from exact-block source-pinned state.');

  if(current.coverage.surfaceCount!==coverageBefore.surfaceCount||current.coverage.measuredSurfaceCount!==coverageBefore.measuredSurfaceCount||current.coverage.sourceBoundUnknownSurfaceCount!==coverageBefore.sourceBoundUnknownSurfaceCount)throw new Error('frxETH V2 RedemptionQueue sub-atom must not change top-level Frax coverage');
  rebuildRelationships(current);
  current.authority={...(current.authority||{}),causalClaimAuthority:'none',executionAuthority:'none'};
  current.observedAt=state.generatedAt||current.observedAt;
  current.id=`frax-ecosystem:${sha256(stableStringify({baseObservationId:current.id||null,extension:FRAX_FRXETH_V2_REDEMPTION_QUEUE_VERSION,blockHash:measurement?.blockHash||null,liabilities:measurement?.redemptionQueue?.accounting?.etherLiabilities?.raw||null,unclaimedFees:measurement?.redemptionQueue?.accounting?.unclaimedFees?.raw||null,net:measurement?.redemptionQueue?.liquidity?.netEthBalanceRaw||null,nextNftId:measurement?.redemptionQueue?.state?.nextNftId??null,pointerParity:measurement?.redemptionQueue?.registryPointerParity??null,executionAuthority:'none'})).slice(0,16)}`;

  evidence.latest={observedAt:current.observedAt,observation:current};
  const observations=Array.isArray(evidence.observations)?evidence.observations:[];
  evidence.observations=[...observations,current].slice(-MAX_OBSERVATIONS);
  evidence.observationCount=evidence.observations.length;
  evidence.status=current.status;
  const sensor=state?.protocolSensors?.[FRAX_PROTOCOL_ID];
  if(sensor){sensor.ecosystemFamily=sensor.ecosystemFamily||{};sensor.ecosystemFamily.measurementExtensions=current.measurementExtensions;sensor.ecosystemFamily.coverage=current.coverage;sensor.ecosystemFamily.latestEvidenceId=current.id;sensor.epistemic={...(sensor.epistemic||{}),frxEthV2RedemptionQueueCurrentState:measured?'MEASURED':'UNKNOWN',executionAuthority:'none'};}
  if(current.authority.executionAuthority!=='none')throw new Error('Frax frxETH V2 RedemptionQueue execution authority drift');
  return current;
}
