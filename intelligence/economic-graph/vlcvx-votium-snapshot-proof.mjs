#!/usr/bin/env node
import fs from 'node:fs';
import crypto from 'node:crypto';

const SNAPSHOT_ENDPOINT='https://hub.snapshot.org/graphql';
const ROUND_FLOW_FILE=process.env.VLCVX_VOTIUM_ROUND_FLOW_FILE||'intelligence/economic-graph/vlcvx-votium-round-flow.json';
const OUTPUT_FILE=process.env.VLCVX_VOTIUM_SNAPSHOT_PROOF_FILE||'intelligence/economic-graph/vlcvx-votium-snapshot-proof.json';
const GENESIS_ROUND_OFFSET=1348;
const EPOCH_SECONDS=14*86400;
const PROPOSAL_WINDOW_SECONDS=3*86400;
const DIAGNOSTIC_WINDOW_SECONDS=8*86400;
const TITLE_PREFIX='Gauge Weight for Week';

function sha256File(file){return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');}
function iso(sec){return new Date(Number(sec)*1000).toISOString();}
function fail(message){throw new Error(message);}
function readJson(file){return JSON.parse(fs.readFileSync(file,'utf8'));}
function roundStart(roundId){return (Number(roundId)+GENESIS_ROUND_OFFSET)*EPOCH_SECONDS;}

async function snapshotGraphql(query,attempt=1){
  try{
    const response=await fetch(SNAPSHOT_ENDPOINT,{method:'POST',headers:{'content-type':'application/json','accept':'application/json'},body:JSON.stringify({query})});
    if(!response.ok)throw new Error(`Snapshot HTTP ${response.status}`);
    const json=await response.json();
    if(json.errors?.length)throw new Error(`Snapshot GraphQL ${JSON.stringify(json.errors)}`);
    return json.data;
  }catch(error){
    if(attempt>=4)throw error;
    await new Promise(resolve=>setTimeout(resolve,attempt*1500));
    return snapshotGraphql(query,attempt+1);
  }
}

async function loadRecentCvxProposals(){
  const query=`query Proposals {
    proposals(
      first: 60,
      skip: 0,
      where: { space_in: [\"cvx.eth\"] },
      orderBy: \"created\",
      orderDirection: desc
    ) {
      id
      title
      choices
      created
      start
      end
      snapshot
      state
      space { id }
    }
  }`;
  const data=await snapshotGraphql(query);
  if(!Array.isArray(data?.proposals))fail('Snapshot cvx.eth proposals unavailable');
  return data.proposals;
}

function proposalSummary(p){return {id:p.id,title:p.title,created:Number(p.created),createdAt:iso(p.created),start:Number(p.start),startAt:iso(p.start),end:Number(p.end),endAt:iso(p.end),snapshotBlock:Number(p.snapshot),state:p.state,choiceCount:Array.isArray(p.choices)?p.choices.length:0};}

function mapRoundToProposal(round,proposals){
  const start=roundStart(round.roundId);
  const end=start+PROPOSAL_WINDOW_SECONDS;
  const gaugeWeight=proposals.filter(p=>String(p?.space?.id||'')==='cvx.eth'&&String(p?.title||'').startsWith(TITLE_PREFIX));
  const candidates=gaugeWeight.filter(p=>Number(p?.created)>start&&Number(p?.created)<end).sort((a,b)=>Number(a.created)-Number(b.created));
  const nearby=gaugeWeight.filter(p=>Math.abs(Number(p?.created)-start)<=DIAGNOSTIC_WINDOW_SECONDS).sort((a,b)=>Number(a.created)-Number(b.created));
  const selected=candidates.length===1?candidates[0]:null;
  return {
    roundId:Number(round.roundId),
    roundStartUnix:start,
    roundStart:iso(start),
    proposalWindowEndUnix:end,
    proposalWindowEnd:iso(end),
    candidateCount:candidates.length,
    mappingStatus:selected?'exact-official-window-title-match':candidates.length===0?'unresolved-no-match':'unresolved-ambiguous-match',
    proposal:selected?{...proposalSummary(selected),choices:Array.isArray(selected.choices)?selected.choices:[]}:null,
    nearbyGaugeWeightProposals:nearby.map(proposalSummary),
    onchainRound:{gaugeCount:Number(round.gaugeCount),incentiveCount:Number(round.incentiveCount),totalVotesReceivedRaw:String(round.totalVotesReceivedRaw),totalVotesReceivedContractUnits:Number(round.totalVotesReceivedContractUnits)}
  };
}

async function main(){
  const roundFlow=readJson(ROUND_FLOW_FILE);
  if(roundFlow.version!=='0.1-vlcvx-votium-round-flow')fail('Unexpected Votium round-flow source version');
  if(!Array.isArray(roundFlow.completedRounds)||roundFlow.completedRounds.length<2)fail('Insufficient completed Votium rounds');
  const proposals=await loadRecentCvxProposals();
  const roundMappings=roundFlow.completedRounds.map(round=>mapRoundToProposal(round,proposals));
  const exactMappedCount=roundMappings.filter(row=>row.mappingStatus==='exact-official-window-title-match').length;

  const state={
    version:'0.1-vlcvx-votium-snapshot-proof',engineVersion:'0.1-official-votium-snapshot-methodology-proof',generatedAt:new Date().toISOString(),status:exactMappedCount===roundMappings.length?'shadow-source-and-live-mapping-proven':'shadow-partial-proof',
    purpose:'Bind completed Votium v2 rounds to their cvx.eth Snapshot gauge-weight proposals and prove the semantic scale of Votium votesReceived without introducing causal, recommendation or execution authority.',
    authority:{readOnly:true,executionAuthority:'none',capitalExecution:false,walletAuthority:false,allocationAuthority:false,recommendationAuthority:false,predictionAuthority:false,causalClaimAuthority:'none',promotionAuthority:'none',methodologyMutationAuthority:false},
    sourceBinding:{roundFlowFile:'intelligence/economic-graph/vlcvx-votium-round-flow.json',roundFlowSha256:sha256File(ROUND_FLOW_FILE),roundFlowGeneratedAt:roundFlow.generatedAt,roundFlowObservationBlock:roundFlow.protocol?.observationBlock,companyRegistry:'004',candidateId:'defitea-convex-vlcvx-votium'},
    officialMethodologyEvidence:{
      votiumContract:{repository:'oo-00/Votium',commit:'e01cf1401c67cb81cfbd5158654b878bd9db1102',path:'contracts/Votium.sol',proof:'submitVoteTotals stores submitted gauge totals directly in votesReceived; endRound consumes those totals directly in incentive reward accounting without decimal rescaling.'},
      votiumJs:{repository:'oo-00/votium.js',commit:'f7f02dccbcff65acf6a35fe692481f1119452a8a',paths:['snap.js','votium.js','examples/roundTable.js'],proof:'Official Votium tooling tallies cvx.eth Snapshot voting power into vote.total, submits/displays that quantity as Votes, computes USD per vlCVX directly from it, and uses 25,000,000 as a human-scale vlCVX vote scenario.'},
      roundProposalRule:{space:'cvx.eth',titlePrefix:TITLE_PREFIX,rule:'Match the gauge-weight proposal created after the Votium round start and within the following 72 hours, mirroring official Votium snap.js.',genesisRoundOffset:GENESIS_ROUND_OFFSET,epochSeconds:EPOCH_SECONDS,proposalWindowSeconds:PROPOSAL_WINDOW_SECONDS}
    },
    voteUnitSemantics:{status:'source-proven-human-scale-vlcvx-voting-power',contractField:'votesReceived',interpretation:'human-scale vlCVX voting power, not 18-decimal token wei',decimalRescalingRequired:false,liveSnapshotVoteRecomputation:'not-yet-performed-by-v0.1',proofClass:'official-source-mechanics-plus-live-proposal-binding'},
    snapshot:{endpoint:SNAPSHOT_ENDPOINT,space:'cvx.eth',recentProposalCountObserved:proposals.length},coverage:{requestedRounds:roundMappings.length,exactMappedRounds:exactMappedCount,complete:exactMappedCount===roundMappings.length},roundMappings,
    epistemic:{proposalMapping:exactMappedCount===roundMappings.length?'measured-live-snapshot-plus-official-rule':'partial-unresolved',voteUnitMeaning:'attributed-by-official-votium-accounting-and-tooling-mechanics',liveVoteTotalEquality:'not-recomputed-by-v0.1',incentiveToVoteCausality:'not-claimed',downstreamCurveEconomicCausality:'not-claimed',companyIncomeConnection:'not-attributed-by-this-layer',primaryDriver:null},
    semantics:{unknownIsNotZero:true,proposalAssociationIsNotCausation:true,sourceMechanicsCanProveUnitMeaningWithoutProvingEconomicCause:true,snapshotVotePowerIsNotRealisedCompanyIncome:true,roundIncentivesDoNotByThemselvesProveVoteMigrationCause:true}
  };

  fs.writeFileSync(OUTPUT_FILE,JSON.stringify(state,null,2)+'\n');
  console.log('VLCVX VOTIUM SNAPSHOT MAPPING DIAGNOSTIC',roundMappings.map(row=>({roundId:row.roundId,roundStart:row.roundStart,status:row.mappingStatus,candidateCount:row.candidateCount,nearby:row.nearbyGaugeWeightProposals.map(p=>({title:p.title,createdAt:p.createdAt,id:p.id}))})));
  console.log('VLCVX VOTIUM SNAPSHOT PROOF PASS',{generatedAt:state.generatedAt,roundFlowHash:state.sourceBinding.roundFlowSha256,requestedRounds:state.coverage.requestedRounds,exactMappedRounds:state.coverage.exactMappedRounds,voteUnitSemantics:state.voteUnitSemantics.status,liveVoteTotalEquality:state.epistemic.liveVoteTotalEquality,executionAuthority:state.authority.executionAuthority});
}

main().catch(error=>{console.error(error);process.exit(1);});
