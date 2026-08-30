#!/usr/bin/env node
/**
 * The Holding · Frax frxETH V2 EtherRouter AMO composition v0.1
 *
 * Enumerates the current bounded EtherRouter AMO array at one exact Ethereum
 * block, verifies active mapping membership and AMO helper identity, then reads
 * each helper's source-defined balanced ETH/frxETH allocation. The aggregate is
 * mechanically reconciled to the already-measured force-live EtherRouter state.
 * This is capital composition/routing evidence, not protocol revenue, staking
 * rewards, validator performance or company cash flow.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const FRAX_FRXETH_V2_ETHER_ROUTER_AMO_COMPOSITION_VERSION='0.1-frxeth-v2-ether-router-amo-composition-exact-block';
export const FRAX_ECOSYSTEM_EVIDENCE_ID='registry-frax-ecosystem';
export const FRAX_PROTOCOL_ID='registry-frax-vefrax';
export const FRAX_FRXETH_SURFACE_KEY='frxEthSfrxEth';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const REGISTRY_FILE=path.join(ROOT,'intelligence/economic-graph/frax-frxeth-registry.json');
const RPC_REGISTRY_FILE=path.join(ROOT,'intelligence/market-data/onchain-price-source-registry.json');
const EXPECTED_SOURCE_COMMIT='83dfe93b4a32b9ca0ab93d6e7c059fcd977320d4';
const RPC_TIMEOUT_MS=10_000;
const MAX_AMO_ARRAY_SLOTS=16;
const SELECTORS={
  amosArray:'0x0255d779',
  amos:'0xbda767ab',
  depositToAmoAddr:'0xf5da169c',
  primaryWithdrawFromAmoAddr:'0xd6e51306',
  amoHelper:'0x855d0b70',
  consolidatedPacked:'0xafde785a'
};

function readJson(file){return JSON.parse(fs.readFileSync(file,'utf8'));}
function normalize(value){return String(value||'').toLowerCase();}
function validAddress(value){return /^0x[0-9a-fA-F]{40}$/.test(String(value||''));}
function word(value){return BigInt(value).toString(16).padStart(64,'0');}
function addressArg(value){return normalize(value).replace(/^0x/,'').padStart(64,'0');}
function call(id,to,data,blockTag){return {jsonrpc:'2.0',id,method:'eth_call',params:[{to,data},blockTag]};}
function decodeWord(hex,index=0){const clean=String(hex||'').replace(/^0x/,'');const start=index*64;if(clean.length<start+64||!/^[0-9a-f]+$/i.test(clean))throw new Error(`Invalid ABI word ${index}`);return BigInt(`0x${clean.slice(start,start+64)}`);}
function decodeAddress(hex,index=0){return `0x${decodeWord(hex,index).toString(16).padStart(64,'0').slice(24)}`;}
function decodeQuantity(hex){if(!/^0x[0-9a-f]+$/i.test(String(hex||'')))throw new Error('Invalid RPC quantity');return BigInt(hex);}
function units(raw,decimals=18){const base=10n**BigInt(decimals),whole=raw/base,fraction=(raw%base).toString().padStart(decimals,'0').replace(/0+$/,'');return Number(`${whole}${fraction?'.'+fraction:''}`);}
function round(value,digits=12){const n=Number(value);return Number.isFinite(n)?Number(n.toFixed(digits)):null;}
function boolWord(hex){return decodeWord(hex,0)!==0n;}

export function validateFraxFrxEthAmoCompositionRegistry(registry){
  if(registry?.version!=='0.1-frxeth-current-state-registry'||registry?.network!=='ethereum'||Number(registry?.chainId)!==1)throw new Error('frxETH AMO composition registry identity drift');
  if(!validAddress(registry?.operations?.etherRouter)||!validAddress(registry?.operations?.curveLsdAmo))throw new Error('frxETH AMO composition registry addresses invalid');
  if(registry?.sources?.officialSourceRepo!=='FraxFinance/frxETH-v2-public'||registry?.sources?.officialSourceCommit!==EXPECTED_SOURCE_COMMIT)throw new Error('frxETH AMO composition official source pin drift');
  if(registry?.epistemic?.unknownIsZero!==false||registry?.epistemic?.executionAuthority!=='none'||registry?.epistemic?.causalClaimAuthority!=='none')throw new Error('frxETH AMO composition epistemic boundary drift');
  return registry;
}

async function postBatch(url,payload,fetchImpl,{allowRpcErrors=false}={}){
  const response=await fetchImpl(url,{method:'POST',headers:{'content-type':'application/json',accept:'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(RPC_TIMEOUT_MS)});
  if(!response.ok)throw new Error(`RPC HTTP ${response.status}`);
  const body=await response.json();if(!Array.isArray(body))throw new Error('RPC response is not an array');
  const byId=new Map(body.map(row=>[Number(row?.id),row]));
  for(const req of payload){const row=byId.get(req.id);if(!row)throw new Error(`RPC result ${req.id} missing`);if(!allowRpcErrors&&row.error)throw new Error(`RPC ${req.method} error: ${row.error?.message||'unknown error'}`);if(!allowRpcErrors&&(row.result===undefined||row.result===null))throw new Error(`RPC ${req.method} result missing`);}
  return byId;
}

function unknownMeasurement(source,currentEtherRouterMeasurement,reason,attempts=[]){
  return {
    version:FRAX_FRXETH_V2_ETHER_ROUTER_AMO_COMPOSITION_VERSION,status:reason,measurementClass:'UNKNOWN',observedAt:null,network:'ethereum',chainId:1,
    blockNumber:currentEtherRouterMeasurement?.blockNumber??null,blockTag:currentEtherRouterMeasurement?.blockTag??null,blockHash:currentEtherRouterMeasurement?.blockHash??null,
    router:{address:source?.operations?.etherRouter||null,depositToAmoAddr:null,primaryWithdrawFromAmoAddr:null,arraySlotCount:null,activeAmoCount:null,arrayEnumerationComplete:false},
    amos:[],aggregate:{amoEthFreeRaw:null,amoEthFree:null,amoEthInLpBalancedRaw:null,amoEthInLpBalanced:null,amoEthTotalBalancedRaw:null,amoEthTotalBalanced:null,amoFrxEthFreeRaw:null,amoFrxEthFree:null,amoFrxEthInLpBalancedRaw:null,amoFrxEthInLpBalanced:null,routerNativeEthRaw:null,routerNativeEth:null,reconciliation:null},
    rpc:{endpointId:null,failoverAttempts:attempts},
    epistemic:{sourceType:'onchain-public-rpc-exact-block',currentStateMeasured:false,arrayEnumeration:'UNKNOWN',amoBalancedComposition:'UNKNOWN',fullCapitalComposition:'UNKNOWN-AMO-balanced-accounting-does-not-decompose-underlying-LP-assets-or-rewards',stakingRewards:'UNKNOWN-not-measured-by-this-atom',validatorPerformance:'UNKNOWN-not-measured-by-this-atom',protocolRevenue:'UNKNOWN-capital-composition-is-not-net-revenue',companyCashFlow:'UNKNOWN',unknownIsZero:false,causalClaimAuthority:'none',executionAuthority:'none'}
  };
}

export async function collectFraxFrxEthV2EtherRouterAmoComposition({registry=null,rpcRegistry=null,fetchImpl=fetch,currentEtherRouterMeasurement=null}={}){
  const source=validateFraxFrxEthAmoCompositionRegistry(registry||readJson(REGISTRY_FILE));
  const current=currentEtherRouterMeasurement;
  if(current?.status!=='ok'||current?.measurementClass!=='MEASURED'||!(Number(current?.blockNumber)>0)||!/^0x[0-9a-f]+$/i.test(String(current?.blockTag||''))||!/^0x[0-9a-f]{64}$/i.test(String(current?.blockHash||'')))return unknownMeasurement(source,current,'UNKNOWN-prerequisite-current-EtherRouter-exact-block-unavailable');
  const rpc=rpcRegistry||readJson(RPC_REGISTRY_FILE),network=rpc?.networks?.ethereum,endpoints=Array.isArray(network?.rpcFailover)?network.rpcFailover:[],attempts=[];
  if(Number(network?.chainId)!==1||!endpoints.length)throw new Error('Ethereum RPC registry unavailable');
  const router=source.operations.etherRouter,blockTag=current.blockTag;

  for(const endpoint of endpoints){
    try{
      const firstPayload=[
        {jsonrpc:'2.0',id:1,method:'eth_getBlockByNumber',params:[blockTag,false]},
        {jsonrpc:'2.0',id:2,method:'eth_getCode',params:[router,blockTag]},
        call(3,router,SELECTORS.depositToAmoAddr,blockTag),
        call(4,router,SELECTORS.primaryWithdrawFromAmoAddr,blockTag)
      ];
      for(let i=0;i<MAX_AMO_ARRAY_SLOTS;i++)firstPayload.push(call(100+i,router,`${SELECTORS.amosArray}${word(i)}`,blockTag));
      const first=await postBatch(endpoint.url,firstPayload,fetchImpl,{allowRpcErrors:true});
      const blockRow=first.get(1),codeRow=first.get(2),depositRow=first.get(3),withdrawRow=first.get(4);
      for(const [label,row] of [['block',blockRow],['code',codeRow],['deposit',depositRow],['withdraw',withdrawRow]])if(row?.error||row?.result===undefined||row?.result===null)throw new Error(`EtherRouter ${label} read failed: ${row?.error?.message||'missing result'}`);
      const block=blockRow.result,blockNumber=Number(decodeQuantity(block?.number||blockTag));
      if(blockNumber!==Number(current.blockNumber)||normalize(block?.hash)!==normalize(current.blockHash))throw new Error('EtherRouter AMO exact-block identity mismatch');
      const deployed=String(codeRow.result||'');if(!/^0x[0-9a-f]+$/i.test(deployed)||deployed==='0x'||deployed==='0x0')throw new Error('EtherRouter deployed code missing');

      const slots=[];let boundedEndFound=false;
      for(let i=0;i<MAX_AMO_ARRAY_SLOTS;i++){
        const row=first.get(100+i);
        if(row?.error||row?.result===undefined||row?.result===null){boundedEndFound=true;break;}
        slots.push({index:i,address:decodeAddress(row.result)});
      }
      if(!boundedEndFound)throw new Error(`AMO array exceeds bounded scan cap ${MAX_AMO_ARRAY_SLOTS}`);
      const nonZeroSlots=slots.filter(row=>normalize(row.address)!=='0x0000000000000000000000000000000000000000');
      const activeAddresses=[...new Set(nonZeroSlots.map(row=>normalize(row.address)))];
      const depositToAmoAddr=decodeAddress(depositRow.result),primaryWithdrawFromAmoAddr=decodeAddress(withdrawRow.result);

      const identityPayload=[];
      activeAddresses.forEach((amo,index)=>{
        identityPayload.push(call(200+index*3,router,`${SELECTORS.amos}${addressArg(amo)}`,blockTag));
        identityPayload.push(call(201+index*3,amo,SELECTORS.amoHelper,blockTag));
        identityPayload.push({jsonrpc:'2.0',id:202+index*3,method:'eth_getCode',params:[amo,blockTag]});
      });
      const identity=identityPayload.length?await postBatch(endpoint.url,identityPayload,fetchImpl):new Map();
      const amoRows=[];
      for(let index=0;index<activeAddresses.length;index++){
        const amo=activeAddresses[index],active=boolWord(identity.get(200+index*3).result),helper=decodeAddress(identity.get(201+index*3).result),amoCode=String(identity.get(202+index*3).result||'');
        if(!active)throw new Error(`Non-zero AMO array slot is inactive: ${amo}`);
        if(!validAddress(helper)||normalize(helper)==='0x0000000000000000000000000000000000000000')throw new Error(`AMO helper unavailable: ${amo}`);
        if(!/^0x[0-9a-f]+$/i.test(amoCode)||amoCode==='0x'||amoCode==='0x0')throw new Error(`AMO deployed code missing: ${amo}`);
        amoRows.push({address:amo,helper});
      }

      const balancePayload=[];
      amoRows.forEach((row,index)=>{
        balancePayload.push({jsonrpc:'2.0',id:300+index*2,method:'eth_getCode',params:[row.helper,blockTag]});
        balancePayload.push(call(301+index*2,row.helper,`${SELECTORS.consolidatedPacked}${addressArg(row.address)}`,blockTag));
      });
      const balances=balancePayload.length?await postBatch(endpoint.url,balancePayload,fetchImpl):new Map();
      const totals={ethFree:0n,ethInLp:0n,ethTotal:0n,frxFree:0n,frxInLp:0n};
      const amos=amoRows.map((row,index)=>{
        const helperCode=String(balances.get(300+index*2).result||'');if(!/^0x[0-9a-f]+$/i.test(helperCode)||helperCode==='0x'||helperCode==='0x0')throw new Error(`AMO helper deployed code missing: ${row.helper}`);
        const packed=balances.get(301+index*2).result;
        const ethFree=decodeWord(packed,0),ethInLp=decodeWord(packed,1),ethTotal=decodeWord(packed,2),frxFree=decodeWord(packed,3),frxInLp=decodeWord(packed,4);
        if(ethFree+ethInLp!==ethTotal)throw new Error(`AMO ETH accounting parity failed: ${row.address}`);
        totals.ethFree+=ethFree;totals.ethInLp+=ethInLp;totals.ethTotal+=ethTotal;totals.frxFree+=frxFree;totals.frxInLp+=frxInLp;
        return {address:row.address,helper:row.helper,active:true,isRegistryCurveLsdAmo:normalize(row.address)===normalize(source.operations.curveLsdAmo),isDepositPreference:normalize(row.address)===normalize(depositToAmoAddr),isPrimaryWithdrawPreference:normalize(row.address)===normalize(primaryWithdrawFromAmoAddr),balanced:{amoEthFreeRaw:ethFree.toString(),amoEthFree:round(units(ethFree)),amoEthInLpBalancedRaw:ethInLp.toString(),amoEthInLpBalanced:round(units(ethInLp)),amoEthTotalBalancedRaw:ethTotal.toString(),amoEthTotalBalanced:round(units(ethTotal)),amoFrxEthFreeRaw:frxFree.toString(),amoFrxEthFree:round(units(frxFree)),amoFrxEthInLpBalancedRaw:frxInLp.toString(),amoFrxEthInLpBalanced:round(units(frxInLp)),ethAccountingParity:true}};
      });

      const routerNative=BigInt(current?.router?.nativeEthBalanceRaw??'0');
      const consolidated=current?.consolidated||{};
      const reconciliation={
        ethFree:totals.ethFree+routerNative===BigInt(consolidated.ethFreeRaw),
        ethInLpBalanced:totals.ethInLp===BigInt(consolidated.ethInLpBalancedRaw),
        ethTotalBalanced:totals.ethTotal+routerNative===BigInt(consolidated.ethTotalBalancedRaw),
        frxEthFree:totals.frxFree===BigInt(consolidated.frxEthFreeRaw),
        frxEthInLpBalanced:totals.frxInLp===BigInt(consolidated.frxEthInLpBalancedRaw)
      };
      reconciliation.all=Object.values(reconciliation).every(Boolean);
      if(!reconciliation.all)throw new Error('AMO composition does not reconcile to force-live EtherRouter aggregate');
      const zero='0x0000000000000000000000000000000000000000';
      const depositPreferenceActive=normalize(depositToAmoAddr)===zero?null:activeAddresses.includes(normalize(depositToAmoAddr));
      const primaryWithdrawPreferenceActive=normalize(primaryWithdrawFromAmoAddr)===zero?null:activeAddresses.includes(normalize(primaryWithdrawFromAmoAddr));
      const registryCurveLsdAmoActive=activeAddresses.includes(normalize(source.operations.curveLsdAmo));

      return {
        version:FRAX_FRXETH_V2_ETHER_ROUTER_AMO_COMPOSITION_VERSION,status:'ok',measurementClass:'MEASURED',observedAt:current.observedAt,network:'ethereum',chainId:1,blockNumber,blockTag,blockHash:block.hash,
        sourceRegistryVersion:source.version,
        sourceBinding:{officialSourceRepo:source.sources.officialSourceRepo,officialSourceCommit:source.sources.officialSourceCommit,etherRouterSource:'src/contracts/ether-router/EtherRouter.sol',amoInterface:'src/contracts/ether-router/interfaces/IfrxEthV2AMO.sol',amoHelperInterface:'src/contracts/ether-router/interfaces/IfrxEthV2AMOHelper.sol',arrayGetter:'amosArray(uint256)',activeMapping:'amos(address)',balancedView:'getConsolidatedEthFrxEthBalancePacked(address)'},
        router:{address:router,depositToAmoAddr,primaryWithdrawFromAmoAddr,arraySlotCount:slots.length,activeAmoCount:activeAddresses.length,arrayEnumerationComplete:true,depositPreferenceActive,primaryWithdrawPreferenceActive,registryCurveLsdAmo:source.operations.curveLsdAmo,registryCurveLsdAmoActive},
        slots,amos,
        aggregate:{amoEthFreeRaw:totals.ethFree.toString(),amoEthFree:round(units(totals.ethFree)),amoEthInLpBalancedRaw:totals.ethInLp.toString(),amoEthInLpBalanced:round(units(totals.ethInLp)),amoEthTotalBalancedRaw:totals.ethTotal.toString(),amoEthTotalBalanced:round(units(totals.ethTotal)),amoFrxEthFreeRaw:totals.frxFree.toString(),amoFrxEthFree:round(units(totals.frxFree)),amoFrxEthInLpBalancedRaw:totals.frxInLp.toString(),amoFrxEthInLpBalanced:round(units(totals.frxInLp)),routerNativeEthRaw:routerNative.toString(),routerNativeEth:round(units(routerNative)),reconciliation},
        rpc:{endpointId:endpoint.id,failoverAttempts:attempts,reusedEtherRouterCheckpoint:true},
        epistemic:{sourceType:'onchain-public-rpc-exact-block',currentStateMeasured:true,arrayEnumeration:'MEASURED-bounded-current-array-until-out-of-bounds-revert',amoBalancedComposition:'MEASURED-source-defined-balanced-accounting',forceLiveAggregateReconciliation:'MECHANICAL-proven-exact-block',underlyingLpAssetDecomposition:'UNKNOWN-not-measured-by-this-atom',amoRewards:'UNKNOWN-not-measured-by-this-atom',stakingRewards:'UNKNOWN-not-measured-by-this-atom',validatorPerformance:'UNKNOWN-not-measured-by-this-atom',protocolRevenue:'UNKNOWN-capital-composition-is-not-net-revenue',companyCashFlow:'UNKNOWN',unknownIsZero:false,causalClaimAuthority:'none',executionAuthority:'none'}
      };
    }catch(error){attempts.push({endpointId:endpoint?.id||null,error:String(error instanceof Error?error.message:error).slice(0,220)});}
  }
  return unknownMeasurement(source,current,attempts.length?`UNKNOWN-${attempts.at(-1).error.replace(/\s+/g,'-').slice(0,140)}`:'UNKNOWN-no-rpc-attempts',attempts);
}

function rebuildRelationships(current){
  const surfaces=Object.values(current?.surfaces||{});
  current.relationshipGraph=surfaces.flatMap(item=>(Array.isArray(item?.mechanicalRelations)?item.mechanicalRelations:[]).map((relation,index)=>({surfaceId:item.id,index,...relation})));
  current.coverage.relationshipCount=current.relationshipGraph.length;
  current.coverage.relationshipClassCounts=current.relationshipGraph.reduce((acc,relation)=>{const key=String(relation.class||'UNKNOWN').split('-')[0];acc[key]=(acc[key]||0)+1;return acc;},{});
}

export function applyFraxFrxEthV2EtherRouterAmoComposition({state,measurement}){
  if(!state||typeof state!=='object')throw new Error('Frax frxETH V2 AMO composition adapter requires Economic Graph state');
  if(state?.authority?.executionAuthority!=='none'||state?.authority?.causalClaimAuthority!=='none')throw new Error('Frax frxETH V2 AMO composition adapter refuses Graph authority drift');
  const evidence=state?.protocolEvidence?.[FRAX_ECOSYSTEM_EVIDENCE_ID],baseCurrent=evidence?.latest?.observation,surface=baseCurrent?.surfaces?.[FRAX_FRXETH_SURFACE_KEY];
  if(!evidence||!baseCurrent||!surface?.measured?.v2Internals?.etherRouter)throw new Error('Frax frxETH EtherRouter prerequisite missing before AMO composition atom');
  const current=structuredClone(baseCurrent),nextSurface=current.surfaces[FRAX_FRXETH_SURFACE_KEY];
  const valid=measurement?.status==='ok'&&measurement?.measurementClass==='MEASURED'&&measurement?.router?.arrayEnumerationComplete===true&&measurement?.aggregate?.reconciliation?.all===true;
  nextSurface.measured.v2Internals={...(nextSurface.measured.v2Internals||{}),etherRouterAmoComposition:measurement};
  nextSurface.measured.epistemic={...(nextSurface.measured.epistemic||{}),etherRouterAmoComposition:valid?'MEASURED-exact-block-reconciled':'UNKNOWN',amoRewards:'UNKNOWN-not-measured-by-this-atom',protocolRevenue:'UNKNOWN-not-promoted-by-amo-composition'};
  nextSurface.mechanicalRelations=(nextSurface.mechanicalRelations||[]).filter(relation=>relation?.extension!=='frxEthV2EtherRouterAmoComposition');
  nextSurface.mechanicalRelations.push(
    {from:'active EtherRouter AMO balanced allocations + router native ETH',to:'EtherRouter force-live consolidated ETH/frxETH balance',class:valid?'MECHANICAL-proven-current-exact-block':'MECHANICAL-source-documented-current-state-UNKNOWN',extension:'frxEthV2EtherRouterAmoComposition'},
    {from:'depositToAmoAddr / primaryWithdrawFromAmoAddr',to:'active EtherRouter AMO set',class:valid?'MECHANICAL-proven-current-exact-block':'MECHANICAL-source-documented-current-state-UNKNOWN',extension:'frxEthV2EtherRouterAmoComposition'}
  );
  current.measurementExtensions={...(current.measurementExtensions||{}),frxEthV2EtherRouterAmoComposition:FRAX_FRXETH_V2_ETHER_ROUTER_AMO_COMPOSITION_VERSION};
  current.epistemic={...(current.epistemic||{}),frxEthV2EtherRouterAmoComposition:valid?'MEASURED-exact-block-reconciled':'UNKNOWN',frxEthV2EtherRouterAmoProtocolRevenue:'UNKNOWN'};
  current.authority={...(current.authority||{}),executionAuthority:'none',causalClaimAuthority:'none'};
  rebuildRelationships(current);
  evidence.latest={...evidence.latest,observation:current};
}
