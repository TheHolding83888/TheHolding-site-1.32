#!/usr/bin/env node
/**
 * The Holding · ICP NNS direct Governance factual-evidence probe v0.1
 *
 * PR-only, read-only diagnostic. Queries the canonical NNS Governance canister
 * directly instead of the Dashboard REST projection to learn which factual
 * neuron fields are anonymously observable for the canonical 41-neuron pool.
 *
 * It never creates accounting income, never writes repository files, never
 * signs transactions and never mutates methodology. Output is written only to
 * /tmp for CI inspection.
 */
import fs from 'node:fs/promises';
import { Actor, HttpAgent } from '@icp-sdk/core/agent';
import { IDL } from '@icp-sdk/core/candid';
import { Principal } from '@icp-sdk/core/principal';

const CONFIG_FILE='./intelligence/icp-nns/company-005-006-neuron-pool.json';
const OUTPUT_FILE='/tmp/icp-nns-governance-direct-probe.json';
const HOST='https://icp-api.io';
const GOVERNANCE_CANISTER_ID='rrkah-fqaaa-aaaaa-aaaaq-cai';
const EXPECTED_NEURON_COUNT=41;

const NeuronId=IDL.Record({id:IDL.Nat64});
const GovernanceError=IDL.Record({error_type:IDL.Int32,error_message:IDL.Text});
const NeuronInfo=IDL.Record({
  id:IDL.Opt(NeuronId),
  stake_e8s:IDL.Nat64,
  visibility:IDL.Opt(IDL.Int32),
  voting_power:IDL.Nat64,
  deciding_voting_power:IDL.Opt(IDL.Nat64),
  potential_voting_power:IDL.Opt(IDL.Nat64),
  staked_maturity_e8s_equivalent:IDL.Opt(IDL.Nat64)
});
const GetNeuronInfoResult=IDL.Variant({Ok:NeuronInfo,Err:GovernanceError});

const NeuronSubaccount=IDL.Record({subaccount:IDL.Vec(IDL.Nat8)});
const ListNeuronsRequest=IDL.Record({
  neuron_ids:IDL.Vec(IDL.Nat64),
  include_neurons_readable_by_caller:IDL.Bool,
  include_empty_neurons_readable_by_caller:IDL.Opt(IDL.Bool),
  include_public_neurons_in_full_neurons:IDL.Opt(IDL.Bool),
  page_number:IDL.Opt(IDL.Nat64),
  page_size:IDL.Opt(IDL.Nat64),
  neuron_subaccounts:IDL.Opt(IDL.Vec(NeuronSubaccount))
});
const FullNeuron=IDL.Record({
  id:IDL.Opt(NeuronId),
  maturity_e8s_equivalent:IDL.Nat64,
  staked_maturity_e8s_equivalent:IDL.Opt(IDL.Nat64),
  cached_neuron_stake_e8s:IDL.Nat64,
  auto_stake_maturity:IDL.Opt(IDL.Bool),
  visibility:IDL.Opt(IDL.Int32)
});
const ListNeuronsResponse=IDL.Record({full_neurons:IDL.Vec(FullNeuron)});

const idlFactory=({IDL})=>IDL.Service({
  get_neuron_info:IDL.Func([IDL.Nat64],[GetNeuronInfoResult],['query']),
  list_neurons:IDL.Func([ListNeuronsRequest],[ListNeuronsResponse],['query'])
});

const toNumber=v=>v===null||v===undefined?null:Number(v);
const optValue=v=>Array.isArray(v)&&v.length?v[0]:null;
const e8sToIcp=v=>v===null||v===undefined?null:Number(v)/1e8;
const idOf=v=>{
  const id=optValue(v?.id);
  return id?.id!==undefined?String(id.id):null;
};

const config=JSON.parse(await fs.readFile(CONFIG_FILE,'utf8'));
if(!Array.isArray(config.neuronIds)||config.neuronIds.length!==EXPECTED_NEURON_COUNT){
  throw new Error(`Expected canonical ${EXPECTED_NEURON_COUNT}-neuron pool`);
}
if(new Set(config.neuronIds).size!==EXPECTED_NEURON_COUNT)throw new Error('Canonical neuron pool contains duplicate IDs');

const agent=await HttpAgent.create({host:HOST});
const actor=Actor.createActor(idlFactory,{
  agent,
  canisterId:Principal.fromText(GOVERNANCE_CANISTER_ID)
});

const infos=[];
for(const rawId of config.neuronIds){
  const id=BigInt(rawId);
  try{
    const result=await actor.get_neuron_info(id);
    if('Err' in result){
      infos.push({
        neuronId:rawId,
        status:'governance-error',
        errorType:Number(result.Err.error_type),
        errorMessage:result.Err.error_message
      });
      continue;
    }
    const info=result.Ok;
    infos.push({
      neuronId:rawId,
      status:'ok',
      responseNeuronId:idOf(info),
      stakeIcp:e8sToIcp(info.stake_e8s),
      visibility:toNumber(optValue(info.visibility)),
      votingPower:toNumber(info.voting_power),
      decidingVotingPower:toNumber(optValue(info.deciding_voting_power)),
      potentialVotingPower:toNumber(optValue(info.potential_voting_power)),
      stakedMaturityIcp:e8sToIcp(optValue(info.staked_maturity_e8s_equivalent)),
      stakedMaturityFieldPresent:Array.isArray(info.staked_maturity_e8s_equivalent)&&info.staked_maturity_e8s_equivalent.length===1
    });
  }catch(error){
    infos.push({neuronId:rawId,status:'query-error',error:String(error?.message||error)});
  }
}

let fullNeurons=[];
let listNeuronsError=null;
try{
  const response=await actor.list_neurons({
    neuron_ids:config.neuronIds.map(BigInt),
    include_neurons_readable_by_caller:false,
    include_empty_neurons_readable_by_caller:[],
    include_public_neurons_in_full_neurons:[true],
    page_number:[],
    page_size:[],
    neuron_subaccounts:[]
  });
  fullNeurons=response.full_neurons.map(neuron=>({
    neuronId:idOf(neuron),
    cachedStakeIcp:e8sToIcp(neuron.cached_neuron_stake_e8s),
    ordinaryMaturityIcp:e8sToIcp(neuron.maturity_e8s_equivalent),
    stakedMaturityIcp:e8sToIcp(optValue(neuron.staked_maturity_e8s_equivalent)),
    autoStakeMaturity:optValue(neuron.auto_stake_maturity),
    visibility:toNumber(optValue(neuron.visibility))
  }));
}catch(error){
  listNeuronsError=String(error?.message||error);
}

const okInfos=infos.filter(x=>x.status==='ok');
const fullById=new Map(fullNeurons.map(x=>[x.neuronId,x]));
const canonicalFullNeurons=config.neuronIds.map(id=>fullById.get(id)).filter(Boolean);
const ordinaryMaturityObservedCount=canonicalFullNeurons.filter(x=>Number.isFinite(x.ordinaryMaturityIcp)).length;
const stakedMaturityObservedCount=okInfos.filter(x=>x.stakedMaturityFieldPresent).length;
const publicFullNeuronCount=canonicalFullNeurons.length;
const aggregateOrdinaryMaturityIcp=ordinaryMaturityObservedCount===EXPECTED_NEURON_COUNT
  ? canonicalFullNeurons.reduce((sum,x)=>sum+Number(x.ordinaryMaturityIcp),0)
  : null;
const aggregateStakedMaturityIcp=stakedMaturityObservedCount===EXPECTED_NEURON_COUNT
  ? okInfos.reduce((sum,x)=>sum+Number(x.stakedMaturityIcp||0),0)
  : null;

const result={
  version:'0.1-icp-nns-governance-direct-probe',
  observedAt:new Date().toISOString(),
  readOnly:true,
  executionAuthority:'none',
  accountingAuthority:false,
  referenceAprUsed:false,
  host:HOST,
  governanceCanisterId:GOVERNANCE_CANISTER_ID,
  requestedNeuronCount:EXPECTED_NEURON_COUNT,
  getNeuronInfoOkCount:okInfos.length,
  getNeuronInfoErrorCount:infos.length-okInfos.length,
  stakedMaturityObservedCount,
  aggregateStakedMaturityIcp,
  publicFullNeuronCount,
  ordinaryMaturityObservedCount,
  aggregateOrdinaryMaturityIcp,
  exactAggregateMaturityStateReady:Boolean(
    ordinaryMaturityObservedCount===EXPECTED_NEURON_COUNT &&
    stakedMaturityObservedCount===EXPECTED_NEURON_COUNT
  ),
  listNeuronsError,
  infos,
  fullNeurons:canonicalFullNeurons,
  invariants:{
    unknownIsNotZero:true,
    singleObservationIsStateNotPeriodIncome:true,
    directGovernanceObservationDoesNotCreateIncome:true,
    referenceAprCanNeverCreateFactualIncome:true
  }
};

await fs.writeFile(OUTPUT_FILE,JSON.stringify(result,null,2)+'\n');
console.log('ICP NNS DIRECT GOVERNANCE PROBE',JSON.stringify(result,null,2));

if(result.referenceAprUsed!==false||result.accountingAuthority!==false||result.executionAuthority!=='none'){
  throw new Error('ICP direct Governance probe authority boundary violated');
}
if(result.getNeuronInfoOkCount!==EXPECTED_NEURON_COUNT){
  throw new Error(`Direct Governance neuron-info coverage incomplete: ${result.getNeuronInfoOkCount}/${EXPECTED_NEURON_COUNT}`);
}
