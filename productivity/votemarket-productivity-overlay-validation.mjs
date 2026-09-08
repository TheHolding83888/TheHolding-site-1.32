#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const OVERLAY=path.join(ROOT,'productivity/votemarket-productivity-overlay.mjs');
const fail=m=>{throw new Error(m);};
const near=(a,b,t=1e-6)=>Math.abs(Number(a)-Number(b))<=t;
const write=(p,v)=>fs.writeFileSync(p,JSON.stringify(v,null,2)+'\n');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));

function baseProductivity(){
  return {
    version:'1.16',generatedAt:'2026-09-08T12:00:00.000Z',snapshotKey:'2026-W37',note:'fixture',
    engines:{curve_vecrv:{aprLatest:5},fx_vefxn:{aprLatest:4}},history:{companies:{}},
    companies:{
      'fixture.eth':{
        status:'ok',aprLatest:6,productiveValue:2000,coveredProductiveValue:2000,coverage:1,
        breakdown:[
          {engineId:'curve_vecrv',principalId:'curve-dao-token',units:100,price:10,value:1000,apr:5,engineStatus:'ok'},
          {engineId:'fx_vefxn',principalId:'fxn-token',units:50,price:10,value:500,apr:4,engineStatus:'ok'},
          {engineId:'other',principalId:'other',units:1,price:500,value:500,apr:10,engineStatus:'ok'}
        ]
      }
    },diagnostics:{}
  };
}

function reward(route,epoch,usd,campaign,token='TOKEN'){
  const address=`0x${String(campaign).padStart(40,'0')}`;
  return {
    protocol:route==='votemarket-vecrv'?'VoteMarket · veCRV':'VoteMarket · veFXN',route,classification:'unclaimed',token:address,
    symbol:token,amountRaw:String(usd*1e6),amount:usd,usdValue:usd,wallet:'0x0000000000000000000000000000000000000001',walletAlias:'fixture',
    details:{epoch,epochDate:new Date(epoch*1000).toISOString(),chainId:1,gauge:`0x${String(campaign+10).padStart(40,'0')}`,campaignId:String(campaign),periodUpdated:true,accountVoteRaw:'1000000000000000000',rewardPerVoteRaw:'1000000000000000',feeRateRaw:'40000000000000000',proofUrl:'https://example.invalid/proof.json',calculation:'fixture'}
  };
}

function claimedSource(route,epoch,campaign){
  return {
    protocol:route==='votemarket-vecrv'?'VoteMarket · veCRV':'VoteMarket · veFXN',route,status:'ok',
    details:{walletResults:[{
      wallet:'0x0000000000000000000000000000000000000001',walletAlias:'fixture',status:'ok',rewardCount:0,
      details:{diagnostics:[{status:'already-claimed',epoch,chainId:1,campaignId:String(campaign),rewardToken:`0x${String(campaign).padStart(40,'0')}`,claimedRaw:'1',proofUrl:'https://example.invalid/proof.json'}]}
    }]}
  };
}

function executeOverlay(dataPath,rewardsPath,reportPath,statePath){
  const result=spawnSync(process.execPath,[OVERLAY],{cwd:ROOT,env:{...process.env,PRODUCTIVITY_DATA:dataPath,REWARDS_DATA:rewardsPath,PRODUCTIVITY_REPORT:reportPath,VOTEMARKET_REFERENCE_STATE:statePath},encoding:'utf8'});
  if(result.status!==0)fail(`overlay failed: ${result.stderr||result.stdout}`);
}

function harness(name){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),`th-vm-${name}-`));
  const dataPath=path.join(dir,'productivity.json');
  const rewardsPath=path.join(dir,'rewards.json');
  const reportPath=path.join(dir,'report.json');
  const statePath=path.join(dir,'state.json');
  write(dataPath,baseProductivity());
  write(reportPath,{engines:{}});
  return {dir,dataPath,rewardsPath,reportPath,statePath,run(rewards,{resetData=false}={}){
    if(resetData)write(dataPath,baseProductivity());
    write(rewardsPath,rewards);
    executeOverlay(dataPath,rewardsPath,reportPath,statePath);
    return {data:read(dataPath),report:read(reportPath),state:read(statePath)};
  },close(){fs.rmSync(dir,{recursive:true,force:true});}};
}

const epoch=Math.floor(Date.parse('2026-09-03T00:00:00.000Z')/1000);
const happyRewards={
  version:'fixture',generatedAt:'2026-09-08T12:00:00.000Z',companies:{'fixture.eth':{rewards:[
    reward('votemarket-vecrv',epoch,10,1,'A'),reward('votemarket-vecrv',epoch,5,2,'B'),reward('votemarket-vefxn',epoch,2,3,'C')
  ],sources:[]}}
};

function assertHappy(data,report,state){
  const c=data.companies['fixture.eth'];
  const crv=c.breakdown.find(x=>x.engineId==='curve_vecrv');
  const fxn=c.breakdown.find(x=>x.engineId==='fx_vefxn');
  const vmCrv=crv.incomeChannels?.votemarket;
  const vmFxn=fxn.incomeChannels?.votemarket;
  const crvApr=15/1000*(365/7)*100;
  const fxnApr=2/500*(365/7)*100;
  if(Number(crv.value)!==1000||Number(fxn.value)!==500||Number(c.productiveValue)!==2000)fail('productive capital changed / doubled');
  if(vmCrv?.status!=='measured-reference'||vmCrv?.marketCount!==2||!near(vmCrv.aprPct,crvApr))fail('veCRV multi-market aggregation failed');
  if(vmFxn?.status!=='measured-reference'||vmFxn?.marketCount!==1||!near(vmFxn.aprPct,fxnApr))fail('veFXN VoteMarket aggregation failed');
  if(!near(crv.apr,5+crvApr)||!near(fxn.apr,4+fxnApr))fail('effective APR composition failed');
  const expected=(1000*(5+crvApr)+500*(4+fxnApr)+500*10)/2000;
  if(!near(c.aprLatest,expected,1e-4))fail('company blended APR recomputation failed');
  if(crv.incomeChannels.capitalDoubleCount!==false||crv.incomeChannels.factualIncomeAuthority!==false||crv.incomeChannels.earnedIncomeAuthority!==false)fail('epistemic/capital contract drift');
  if(crv.incomeChannels.idempotent!==true||data.diagnostics?.voteMarketIncomeChannels?.idempotent!==true)fail('idempotency contract missing');
  if(vmCrv?.claimedPeriodPersistencePending!==false||data.diagnostics?.voteMarketIncomeChannels?.claimedPeriodPersistencePending!==false)fail('claimed-period persistence not closed');
  if(state?.semantics?.sourceOfTruth!==false||state?.semantics?.factualIncomeAuthority!==false||state?.semantics?.executionAuthority!=='none')fail('persistence state authority drift');
  if(report?.voteMarketIncomeChannels?.capitalDoubleCount!==false)fail('source report diagnostic missing');
}

{
  const h=harness('happy');
  const x=h.run(happyRewards);
  assertHappy(x.data,x.report,x.state);
  h.close();
}

{
  const h=harness('idempotent');
  const first=h.run(happyRewards);
  const firstApr=first.data.companies['fixture.eth'].breakdown.find(x=>x.engineId==='curve_vecrv').apr;
  const second=h.run(happyRewards);
  assertHappy(second.data,second.report,second.state);
  const secondApr=second.data.companies['fixture.eth'].breakdown.find(x=>x.engineId==='curve_vecrv').apr;
  if(!near(firstApr,secondApr))fail('overlay rerun changed APR');
  const note='VoteMarket veCRV/veFXN rewards are modeled as supplementary income channels on the existing principal: capital is counted once, verified company-specific finalized periods may persist as derived Reference observations across a later claim, and the overlay never grants factual earned-income authority.';
  const occurrences=String(second.data.note||'').split(note).length-1;
  if(occurrences!==1)fail(`overlay note duplicated across rerun: ${occurrences}`);
  h.close();
}

{
  const h=harness('claimed-transition');
  const firstRewards={version:'fixture',generatedAt:'2026-09-08T12:00:00.000Z',companies:{'fixture.eth':{rewards:[reward('votemarket-vecrv',epoch,10,1,'A')],sources:[]}}};
  const first=h.run(firstRewards);
  const firstRow=first.data.companies['fixture.eth'].breakdown.find(x=>x.engineId==='curve_vecrv');
  const firstApr=firstRow.incomeChannels.votemarket.aprPct;
  const claimedRewards={version:'fixture',generatedAt:'2026-09-09T12:00:00.000Z',companies:{'fixture.eth':{rewards:[],sources:[claimedSource('votemarket-vecrv',epoch,1)]}}};
  const second=h.run(claimedRewards,{resetData:true});
  const row=second.data.companies['fixture.eth'].breakdown.find(x=>x.engineId==='curve_vecrv');
  const channel=row.incomeChannels.votemarket;
  if(channel.status!=='measured-reference'||!near(channel.aprPct,firstApr))fail('claimed period lost measured Reference APR continuity');
  if(channel.persistenceUsed!==true||channel.claimedMarketCount!==1||channel.currentMarketCount!==0||channel.persistedMarketCount!==1)fail('claimed persistence metadata wrong');
  if(channel.markets?.[0]?.claimState!=='claimed-observed'||channel.markets?.[0]?.observationSource!=='derived-persistence-cache')fail('claimed market provenance missing');
  if(second.data.diagnostics?.voteMarketIncomeChannels?.claimedTransitionCount!==1)fail('claimed transition diagnostic missing');
  const stateMarket=Object.values(second.state.companies['fixture.eth'].routes['votemarket-vecrv'].epochs[String(epoch)].markets)[0];
  if(stateMarket.claimState!=='claimed-observed')fail('state did not persist claimed transition');
  h.close();
}

{
  const h=harness('unknown-claimed');
  const rewards={version:'fixture',generatedAt:'2026-09-09T12:00:00.000Z',companies:{'fixture.eth':{rewards:[],sources:[claimedSource('votemarket-vecrv',epoch,9)]}}};
  const x=h.run(rewards);
  const row=x.data.companies['fixture.eth'].breakdown.find(r=>r.engineId==='curve_vecrv');
  if(row.incomeChannels?.votemarket?.status!=='unavailable'||Number(row.apr)!==5)fail('never-observed claimed period must remain unavailable');
  if(x.data.diagnostics?.voteMarketIncomeChannels?.unresolvedClaimedDiagnosticCount!==1)fail('unknown claimed diagnostic must stay explicit');
  h.close();
}

{
  const h=harness('unpriced');
  const rewards={version:'fixture',generatedAt:'2026-09-08T12:00:00.000Z',companies:{'fixture.eth':{rewards:[
    reward('votemarket-vecrv',epoch,10,1,'A'),{...reward('votemarket-vecrv',epoch,5,2,'B'),usdValue:null}
  ],sources:[]}}};
  const x=h.run(rewards);
  const row=x.data.companies['fixture.eth'].breakdown.find(r=>r.engineId==='curve_vecrv');
  if(row.incomeChannels?.votemarket?.status!=='partial-unpriced')fail('partial USD period must fail closed');
  if(Number(row.apr)!==5||row.incomeChannels?.effectiveAprIncludesVoteMarket!==false)fail('partial VoteMarket period changed APR');
  h.close();
}

{
  const h=harness('stale');
  const staleEpoch=Math.floor(Date.parse('2026-07-01T00:00:00.000Z')/1000);
  const rewards={version:'fixture',generatedAt:'2026-09-08T12:00:00.000Z',companies:{'fixture.eth':{rewards:[reward('votemarket-vefxn',staleEpoch,2,4,'D')],sources:[]}}};
  const x=h.run(rewards);
  const row=x.data.companies['fixture.eth'].breakdown.find(r=>r.engineId==='fx_vefxn');
  if(row.incomeChannels?.votemarket?.status!=='stale-period')fail('stale VoteMarket period must fail closed');
  if(Number(row.apr)!==4)fail('stale VoteMarket period changed APR');
  h.close();
}

console.log('VoteMarket Productivity overlay validation PASS',{multiMarketAggregation:true,capitalCountedOnce:true,idempotent:true,claimedPeriodPersistence:true,unknownClaimedFailsClosed:true,partialUsdFailsClosed:true,stalePeriodFailsClosed:true,persistenceStateSourceOfTruth:false,factualIncomeAuthority:false,executionAuthority:'none'});
