#!/usr/bin/env node
/**
 * The Holding · ICP NNS factual accounting evidence probe v0.2
 *
 * Read-only diagnostic. It never creates accounting income and never writes
 * repository files. Its only job is to test whether the public Dashboard API
 * exposes enough native NNS evidence to reconstruct reward allocations without
 * using Reference APR.
 */
import fs from 'node:fs/promises';

const CONFIG_FILE='./intelligence/icp-nns/company-005-006-neuron-pool.json';
const API='https://ic-api.internetcomputer.org/api/v3';
const TIMEOUT_MS=15000;

async function fetchJson(url){
  const c=new AbortController();
  const timer=setTimeout(()=>c.abort(),TIMEOUT_MS);
  try{
    const r=await fetch(url,{signal:c.signal,headers:{accept:'application/json','user-agent':'The-Holding-ICP-NNS-Factual-Probe/0.2'}});
    if(!r.ok) throw new Error(`HTTP ${r.status} ${url}`);
    return await r.json();
  }finally{clearTimeout(timer);}
}

function primitivePaths(root,max=80){
  const out=[]; const seen=new Set();
  function walk(node,prefix='',depth=0){
    if(out.length>=max||depth>6||node===null||node===undefined)return;
    if(typeof node!=='object'){
      if(['string','number','boolean'].includes(typeof node)) out.push([prefix,node]);
      return;
    }
    if(seen.has(node))return; seen.add(node);
    if(Array.isArray(node)){
      for(let i=0;i<Math.min(node.length,3);i++)walk(node[i],`${prefix}[${i}]`,depth+1);
      return;
    }
    for(const [k,v] of Object.entries(node)){
      if(out.length>=max)break;
      walk(v,prefix?`${prefix}.${k}`:k,depth+1);
    }
  }
  walk(root);
  return out;
}

function objectsWith(root,keys){
  const out=[]; const seen=new Set();
  function walk(node){
    if(!node||typeof node!=='object'||seen.has(node))return;
    seen.add(node);
    if(!Array.isArray(node)&&keys.every(k=>Object.prototype.hasOwnProperty.call(node,k)))out.push(node);
    for(const v of Object.values(node))if(v&&typeof v==='object')walk(v);
  }
  walk(root); return out;
}

function firstField(root,key){
  const seen=new Set();
  function walk(node){
    if(!node||typeof node!=='object'||seen.has(node))return {found:false,value:null};
    seen.add(node);
    if(!Array.isArray(node)&&Object.prototype.hasOwnProperty.call(node,key))return {found:true,value:node[key]};
    for(const v of Object.values(node)){
      if(v&&typeof v==='object'){
        const hit=walk(v); if(hit.found)return hit;
      }
    }
    return {found:false,value:null};
  }
  return walk(root);
}

function safeValue(v){
  if(v===null||v===undefined)return null;
  if(typeof v==='number'||typeof v==='boolean')return v;
  if(typeof v==='string')return v.length>160?`${v.slice(0,157)}...`:v;
  return Array.isArray(v)?`array(${v.length})`:`object(${Object.keys(v).slice(0,12).join(',')})`;
}

function rowShape(row){
  if(!row||typeof row!=='object'||Array.isArray(row))return [];
  return Object.keys(row).sort();
}

const config=JSON.parse(await fs.readFile(CONFIG_FILE,'utf8'));
if(!Array.isArray(config.neuronIds)||config.neuronIds.length!==41)throw new Error('Expected canonical 41-neuron pool');

// Three deterministic representatives are enough to prove endpoint capability
// without hammering the API during a PR diagnostic.
const probeIds=[config.neuronIds[0],config.neuronIds[Math.floor(config.neuronIds.length/2)],config.neuronIds.at(-1)];
const neuronDiagnostics=[];
let firstParticipatingProposalId=null;
let fallbackProposalId=null;
for(const id of probeIds){
  const participatingUrl=`${API}/neurons/${id}/ballots?limit=200&offset=0&include_vote=1&include_vote=2`;
  const [detail,ballots,participatingBallots,recent]=await Promise.all([
    fetchJson(`${API}/neurons/${id}`),
    fetchJson(`${API}/neurons/${id}/ballots?limit=200&offset=0`),
    fetchJson(participatingUrl),
    fetchJson(`${API}/neurons/${id}/recent-ballots`)
  ]);
  const ballotRows=objectsWith(ballots,['proposal_id','vote']);
  const participatingRows=objectsWith(participatingBallots,['proposal_id','vote']);
  const recentRows=objectsWith(recent,['proposal_id','vote']);
  const eligible=participatingRows.filter(x=>Number(x.vote)===1||Number(x.vote)===2);
  if(!firstParticipatingProposalId){
    const candidate=eligible[0]?.proposal_id;
    if(candidate!==undefined&&candidate!==null)firstParticipatingProposalId=Number(candidate);
  }
  if(!fallbackProposalId){
    const candidate=ballotRows[0]?.proposal_id;
    if(candidate!==undefined&&candidate!==null)fallbackProposalId=Number(candidate);
  }
  const m=firstField(detail,'maturity_e8s_equivalent');
  const sm=firstField(detail,'staked_maturity_e8s_equivalent');
  const auto=firstField(detail,'auto_stake_maturity');
  neuronDiagnostics.push({
    detailOk:true,
    ordinaryMaturityFieldExposed:m.found,
    ordinaryMaturityValueType:m.found?typeof m.value:null,
    stakedMaturityFieldExposed:sm.found,
    stakedMaturityValueType:sm.found?typeof sm.value:null,
    autoStakeMaturityFieldExposed:auto.found,
    autoStakeMaturity:safeValue(auto.value),
    fullBallotRowCount:ballotRows.length,
    filteredParticipatingBallotRowCount:participatingRows.length,
    filteredEligibleVoteRowCount:eligible.length,
    recentBallotRowCount:recentRows.length,
    firstFullBallotKeys:rowShape(ballotRows[0]),
    firstParticipatingBallotKeys:rowShape(participatingRows[0]),
    firstParticipatingBallot:participatingRows[0]?Object.fromEntries(Object.entries(participatingRows[0]).map(([k,v])=>[k,safeValue(v)])):null,
    ballotPrimitiveShape:primitivePaths(ballots,20).map(([p,v])=>[p,safeValue(v)]),
    participatingPrimitiveShape:primitivePaths(participatingBallots,30).map(([p,v])=>[p,safeValue(v)])
  });
}

const [lastRewardEvent,totalAvailable]=await Promise.all([
  fetchJson(`${API}/metrics/last-reward-event?format=json`),
  fetchJson(`${API}/metrics/latest-reward-event-total-available?format=json`)
]);

const sampledProposalId=Number.isFinite(firstParticipatingProposalId)?firstParticipatingProposalId:fallbackProposalId;
let proposal=null;
if(Number.isFinite(sampledProposalId)&&sampledProposalId>0){
  proposal=await fetchJson(`${API}/proposals/${sampledProposalId}`);
}

const proposalFields={
  rewardStatus:firstField(proposal,'reward_status'),
  topic:firstField(proposal,'topic'),
  totalPotentialVotingPower:firstField(proposal,'total_potential_voting_power'),
  rewardEventRound:firstField(proposal,'reward_event_round'),
  rewardEventEndTimestampSeconds:firstField(proposal,'reward_event_end_timestamp_seconds')
};

const result={
  version:'0.2-icp-nns-factual-evidence-probe',
  observedAt:new Date().toISOString(),
  readOnly:true,
  executionAuthority:'none',
  referenceAprUsed:false,
  testedNeuronCount:probeIds.length,
  neuronDiagnostics,
  fullBallotsAvailable:neuronDiagnostics.some(x=>x.fullBallotRowCount>0),
  participatingBallotFilterAvailable:neuronDiagnostics.some(x=>x.filteredParticipatingBallotRowCount>0),
  eligibleVotesObserved:neuronDiagnostics.some(x=>x.filteredEligibleVoteRowCount>0),
  ballotVotingPowerFieldObserved:neuronDiagnostics.some(x=>x.firstParticipatingBallotKeys.includes('voting_power')),
  exactOrdinaryMaturityPubliclyObserved:neuronDiagnostics.some(x=>x.ordinaryMaturityFieldExposed),
  exactStakedMaturityPubliclyObserved:neuronDiagnostics.some(x=>x.stakedMaturityFieldExposed),
  lastRewardEventShape:primitivePaths(lastRewardEvent,50).map(([p,v])=>[p,safeValue(v)]),
  totalAvailableShape:primitivePaths(totalAvailable,50).map(([p,v])=>[p,safeValue(v)]),
  sampledProposalId:Number.isFinite(sampledProposalId)?sampledProposalId:null,
  sampledProposalFields:Object.fromEntries(Object.entries(proposalFields).map(([k,hit])=>[k,hit?.found?safeValue(hit.value):null])),
  sampledProposalShape:proposal?primitivePaths(proposal,100).map(([p,v])=>[p,safeValue(v)]):[],
  exactRewardReconstructionReady:false,
  accountingAuthority:false
};

// Exact reconstruction is not promoted merely because vote history exists.
// Historical ballot voting power and a deterministic reward-round binding must
// both be demonstrated before this probe may ever graduate to accounting input.
result.exactRewardReconstructionReady = Boolean(
  result.eligibleVotesObserved &&
  result.ballotVotingPowerFieldObserved &&
  result.sampledProposalFields.totalPotentialVotingPower &&
  result.sampledProposalFields.rewardEventRound
);

await fs.writeFile('/tmp/icp-nns-factual-evidence-probe.json',JSON.stringify(result,null,2)+'\n');
console.log('ICP NNS FACTUAL EVIDENCE PROBE',JSON.stringify(result,null,2));

if(result.referenceAprUsed!==false||result.accountingAuthority!==false||result.executionAuthority!=='none'){
  throw new Error('ICP factual probe authority boundary violated');
}
