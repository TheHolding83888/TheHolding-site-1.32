#!/usr/bin/env node
import fs from 'node:fs';
import crypto from 'node:crypto';
import { Contract, JsonRpcProvider, formatUnits, getAddress } from 'ethers';

const SNAPSHOT_ENDPOINT='https://hub.snapshot.org/graphql';
const ROUND_FLOW_FILE=process.env.VLCVX_VOTIUM_ROUND_FLOW_FILE||'intelligence/economic-graph/vlcvx-votium-round-flow.json';
const OUTPUT_FILE=process.env.VLCVX_VOTIUM_SNAPSHOT_PROOF_FILE||'intelligence/economic-graph/vlcvx-votium-snapshot-proof.json';
const GENESIS_ROUND_OFFSET=1348;
const EPOCH_SECONDS=14*86400;
const PROPOSAL_WINDOW_SECONDS=3*86400;
const TITLE_PREFIX='Gauge Weight for Week';
const LEGACY_ROUND=127;
const FIRST_ONCHAIN_ROUND=128;
const CURRENT_CURVE_GAUGE_VOTING='0x64D9B5AC386B70af9EDCD20A58cE9262D2EAC278';
const OLD_CURVE_GAUGE_VOTING='0x21F304a9DF75E087A035B4c5792bD4e6BB7AF8aF';
const VLCVX_SCALE=10n**18n;
const CONVEX_VOTING_SOURCE_SHA='242b592718ff939e0a15e490a7df9730267f0999';
const PLATFORM_ABI=[
  'function proposalCount() view returns (uint256)',
  'function proposals(uint256) view returns (uint48 startTime,uint48 endTime,uint48 epoch)',
  'function voteTotals(uint256) view returns (uint256)',
  'function getGaugeCount(uint256) view returns (uint256)',
  'function getGaugeEntry(uint256,uint256) view returns (address gauge,uint256 totalWeight)'
];

function sha256File(file){return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');}
function iso(sec){return Number(sec)>0?new Date(Number(sec)*1000).toISOString():null;}
function fail(message){throw new Error(message);}
function readJson(file){return JSON.parse(fs.readFileSync(file,'utf8'));}
function roundStart(roundId){return (Number(roundId)+GENESIS_ROUND_OFFSET)*EPOCH_SECONDS;}
function ceilVlCvx(raw){return (BigInt(raw)+VLCVX_SCALE-1n)/VLCVX_SCALE;}
function pct(a,b){return b?Number((BigInt(a)*1000000n/BigInt(b)))/10000:null;}
function rpcCandidates(){return [...new Set([process.env.ETH_RPC_URL,'https://ethereum-rpc.publicnode.com','https://eth.llamarpc.com'].filter(Boolean))];}
function rpcLabel(url){if(url===process.env.ETH_RPC_URL)return'configured-secret';try{return new URL(url).hostname;}catch{return'configured';}}
async function providerWithFallback(){let last=null;for(const url of rpcCandidates()){const provider=new JsonRpcProvider(url,1,{staticNetwork:true});try{await provider.getBlockNumber();return{provider,endpointClass:rpcLabel(url)};}catch(e){last=e;try{provider.destroy();}catch{}}}throw last||new Error('No working Ethereum RPC');}

async function snapshotGraphql(query,attempt=1){
  try{
    const response=await fetch(SNAPSHOT_ENDPOINT,{method:'POST',headers:{'content-type':'application/json','accept':'application/json'},body:JSON.stringify({query})});
    if(!response.ok)throw new Error(`Snapshot HTTP ${response.status}`);
    const json=await response.json();
    if(json.errors?.length)throw new Error(`Snapshot GraphQL ${JSON.stringify(json.errors)}`);
    return json.data;
  }catch(error){if(attempt>=4)throw error;await new Promise(resolve=>setTimeout(resolve,attempt*1500));return snapshotGraphql(query,attempt+1);}
}
async function loadRecentCvxProposals(){
  const query=`query Proposals { proposals(first: 60, skip: 0, where: { space_in: [\"cvx.eth\"] }, orderBy: \"created\", orderDirection: desc) { id title choices created start end snapshot state space { id } } }`;
  const data=await snapshotGraphql(query);if(!Array.isArray(data?.proposals))fail('Snapshot cvx.eth proposals unavailable');return data.proposals;
}
function mapSnapshot(round,proposals){
  const start=roundStart(round.roundId),end=start+PROPOSAL_WINDOW_SECONDS;
  const candidates=proposals.filter(p=>String(p?.space?.id||'')==='cvx.eth'&&String(p?.title||'').startsWith(TITLE_PREFIX)&&Number(p.created)>start&&Number(p.created)<end).sort((a,b)=>Number(a.created)-Number(b.created));
  const selected=candidates.length===1?candidates[0]:null;
  return{status:selected?'exact-official-window-title-match':candidates.length===0?'no-official-window-match':'ambiguous-official-window-match',candidateCount:candidates.length,proposal:selected?{id:selected.id,title:selected.title,created:Number(selected.created),createdAt:iso(selected.created),start:Number(selected.start),startAt:iso(selected.start),end:Number(selected.end),endAt:iso(selected.end),snapshotBlock:Number(selected.snapshot),choiceCount:Array.isArray(selected.choices)?selected.choices.length:0}:null};
}

async function readPlatform(provider,address,label,blockTag){
  const contract=new Contract(address,PLATFORM_ABI,provider),count=Number(await contract.proposalCount({blockTag})),proposals=[];
  for(let id=0;id<count;id++){
    const p=await contract.proposals(id,{blockTag});
    const [voteTotalRaw,gaugeCountRaw]=await Promise.all([contract.voteTotals(id,{blockTag}),contract.getGaugeCount(id,{blockTag})]);
    const gaugeCount=Number(gaugeCountRaw),gauges=[];
    for(let i=0;i<gaugeCount;i++){const row=await contract.getGaugeEntry(id,i,{blockTag});gauges.push({gauge:getAddress(row.gauge),totalWeightRaw:row.totalWeight.toString(),totalWeightVlCvx:Number(formatUnits(row.totalWeight,18)),ceilVlCvx:ceilVlCvx(row.totalWeight).toString()});}
    proposals.push({platformLabel:label,platformAddress:getAddress(address),proposalId:id,startTime:Number(p.startTime),startAt:iso(p.startTime),endTime:Number(p.endTime),endAt:iso(p.endTime),epoch:Number(p.epoch),voteTotalRaw:voteTotalRaw.toString(),voteTotalVlCvx:Number(formatUnits(voteTotalRaw,18)),gaugeCount,gauges});
  }
  return{label,address:getAddress(address),proposalCount:count,proposals};
}
function exactStartProposal(roundId,platform){const start=roundStart(roundId),matches=platform.proposals.filter(p=>p.startTime===start);return matches.length===1?matches[0]:null;}
function compareVotiumToOnchain(round,proposal){
  if(!proposal)return{votiumGaugeCount:round.gauges.length,onchainMatchedGaugeCount:0,exactCeilMatchCount:0,coveragePct:0,exactCeilMatchPct:0,complete:false,gauges:[]};
  const byGauge=new Map(proposal.gauges.map(g=>[g.gauge.toLowerCase(),g]));
  const gauges=round.gauges.map(v=>{
    const c=byGauge.get(String(v.gauge).toLowerCase())||null;
    const votiumRaw=BigInt(v.votesReceivedRaw);
    const ceiling=c?ceilVlCvx(c.totalWeightRaw):null;
    return{gauge:v.gauge,votiumVotesReceived:v.votesReceivedRaw,onchainGaugeTotalRaw:c?.totalWeightRaw??null,onchainGaugeTotalVlCvx:c?.totalWeightVlCvx??null,onchainGaugeTotalCeilVlCvx:ceiling?.toString()??null,exactCeilEquality:ceiling===null?false:ceiling===votiumRaw};
  });
  const matched=gauges.filter(g=>g.onchainGaugeTotalRaw!==null).length,exact=gauges.filter(g=>g.exactCeilEquality).length,total=gauges.length;
  return{votiumGaugeCount:total,onchainMatchedGaugeCount:matched,exactCeilMatchCount:exact,coveragePct:pct(matched,total),exactCeilMatchPct:pct(exact,total),complete:matched===total&&exact===total,gauges};
}

async function main(){
  const roundFlow=readJson(ROUND_FLOW_FILE);if(roundFlow.version!=='0.1-vlcvx-votium-round-flow'||!Array.isArray(roundFlow.completedRounds)||roundFlow.completedRounds.length<3)fail('Unexpected Votium round-flow source');
  const recent=roundFlow.completedRounds.slice(-3);if(recent.map(r=>Number(r.roundId)).join(',')!=='127,128,129')fail('Expected completed Votium rounds 127-129 for transition proof');
  const snapshotProposals=await loadRecentCvxProposals(),{provider,endpointClass}=await providerWithFallback();
  try{
    const blockTag=await provider.getBlockNumber();
    const [oldPlatform,currentPlatform]=await Promise.all([readPlatform(provider,OLD_CURVE_GAUGE_VOTING,'old-replaced-curve-gauge-voting',blockTag),readPlatform(provider,CURRENT_CURVE_GAUGE_VOTING,'current-curve-gauge-voting',blockTag)]);
    const rows=recent.map(round=>{
      const roundId=Number(round.roundId),snapshot=mapSnapshot(round,snapshotProposals),oldProposal=exactStartProposal(roundId,oldPlatform),currentProposal=exactStartProposal(roundId,currentPlatform);
      const oldComparison=compareVotiumToOnchain(round,oldProposal),currentComparison=compareVotiumToOnchain(round,currentProposal);
      let regime='unresolved',status='unresolved';
      if(roundId===LEGACY_ROUND&&snapshot.status==='exact-official-window-title-match'){regime='legacy-snapshot';status='proven';}
      if(roundId>=FIRST_ONCHAIN_ROUND&&snapshot.status==='no-official-window-match'&&currentProposal&&currentComparison.complete){regime='convex-onchain';status='proven';}
      return{roundId,roundStartUnix:roundStart(roundId),roundStart:iso(roundStart(roundId)),regime,status,snapshot,oldOnchainProposal:oldProposal?{platformAddress:oldProposal.platformAddress,proposalId:oldProposal.proposalId,startAt:oldProposal.startAt,endAt:oldProposal.endAt,epoch:oldProposal.epoch,voteTotalVlCvx:oldProposal.voteTotalVlCvx,gaugeCount:oldProposal.gaugeCount,comparison:oldComparison}:null,currentOnchainProposal:currentProposal?{platformAddress:currentProposal.platformAddress,proposalId:currentProposal.proposalId,startAt:currentProposal.startAt,endAt:currentProposal.endAt,epoch:currentProposal.epoch,voteTotalVlCvx:currentProposal.voteTotalVlCvx,gaugeCount:currentProposal.gaugeCount,comparison:currentComparison}:null};
    });
    const complete=rows.every(r=>r.status==='proven')&&rows[0].regime==='legacy-snapshot'&&rows.slice(1).every(r=>r.regime==='convex-onchain');
    const onchainRows=rows.filter(r=>r.regime==='convex-onchain');
    const state={
      version:'0.2-vlcvx-votium-voting-provenance',engineVersion:'0.2-transition-aware-snapshot-to-convex-onchain',generatedAt:new Date().toISOString(),status:complete?'shadow-voting-provenance-proven':'shadow-partial-proof',
      purpose:'Prove the Votium vlCVX voting-source transition from legacy cvx.eth Snapshot to Convex onchain GaugeVotePlatform and bind post-migration Votium votesReceived to exact onchain vlCVX gauge totals.',
      authority:{readOnly:true,executionAuthority:'none',capitalExecution:false,walletAuthority:false,allocationAuthority:false,recommendationAuthority:false,predictionAuthority:false,causalClaimAuthority:'none',promotionAuthority:'none',methodologyMutationAuthority:false},
      sourceBinding:{roundFlowFile:'intelligence/economic-graph/vlcvx-votium-round-flow.json',roundFlowSha256:sha256File(ROUND_FLOW_FILE),companyRegistry:'004',candidateId:'defitea-convex-vlcvx-votium'},
      observation:{ethereumBlock:blockTag,rpcEndpointClass:endpointClass,snapshotEndpoint:SNAPSHOT_ENDPOINT},
      sourceAuthority:{
        legacyVotium:{contractRepo:'oo-00/Votium',contractCommit:'e01cf1401c67cb81cfbd5158654b878bd9db1102',toolingRepo:'oo-00/votium.js',toolingCommit:'f7f02dccbcff65acf6a35fe692481f1119452a8a',method:'cvx.eth Gauge Weight for Week proposal matched inside official 72-hour round window'},
        convexOnchain:{repository:'convex-eth/voting',commit:CONVEX_VOTING_SOURCE_SHA,currentCurveGaugeVoting:CURRENT_CURVE_GAUGE_VOTING,oldCurveGaugeVoting:OLD_CURVE_GAUGE_VOTING,mechanics:'GaugeVotePlatform stores raw 18-decimal vlCVX voteTotals/gaugeTotals; GaugeProposer starts biweekly proposals at vlCVX epoch timestamps; Votium post-migration votesReceived equals ceil(gaugeTotal / 1e18) for every incentivized gauge observed.'}
      },
      transition:{lastLegacyRound:LEGACY_ROUND,lastLegacyRoundStart:iso(roundStart(LEGACY_ROUND)),firstConvexOnchainRound:FIRST_ONCHAIN_ROUND,firstConvexOnchainRoundStart:iso(roundStart(FIRST_ONCHAIN_ROUND)),boundaryStatus:complete?'live-cross-source-proven':'unresolved'},
      coverage:{roundCount:rows.length,provenRoundCount:rows.filter(r=>r.status==='proven').length,legacySnapshotRoundCount:rows.filter(r=>r.regime==='legacy-snapshot').length,convexOnchainRoundCount:onchainRows.length,onchainVotiumGaugeCount:onchainRows.reduce((s,r)=>s+r.currentOnchainProposal.comparison.votiumGaugeCount,0),onchainExactGaugeMatchCount:onchainRows.reduce((s,r)=>s+r.currentOnchainProposal.comparison.exactCeilMatchCount,0),complete},
      rounds:rows,
      voteUnitSemantics:{status:complete?'proven-human-scale-vlcvx-voting-power':'partial',legacyClass:'official-votium-snapshot-voting-power',postMigrationClass:'ceil-of-convex-onchain-18dp-vlcvx-gauge-total',decimalRule:'Votium votesReceived = ceil(Convex GaugeVotePlatform gaugeTotal / 1e18) after migration',proofClass:'official-source-mechanics-plus-live-cross-contract-gauge-equality'},
      epistemic:{votingSourceTransition:complete?'attributed-by-live-cross-source-mechanics':'unresolved',postMigrationGaugeEquality:complete?'measured-exact-integer-ceiling-equality':'partial',incentiveToVoteCausality:'not-claimed',downstreamCurveEconomicCausality:'not-claimed',companyIncomeConnection:'not-attributed-by-this-layer',primaryDriver:null},
      semantics:{unknownIsNotZero:true,missingSnapshotAfterMigrationIsExpected:true,proposalAssociationIsNotEconomicCausation:true,votingSourceProofIsNotIncentiveCausality:true,protocolVotingPowerIsNotRealisedCompanyIncome:true}
    };
    fs.writeFileSync(OUTPUT_FILE,JSON.stringify(state,null,2)+'\n');
    console.log('VLCVX VOTIUM VOTING PROVENANCE PASS',{block:blockTag,status:state.status,transition:state.transition,coverage:state.coverage,voteUnitSemantics:state.voteUnitSemantics.status,executionAuthority:state.authority.executionAuthority});
  }finally{try{provider.destroy();}catch{}}
}
main().catch(error=>{console.error(error);process.exit(1);});
