#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const ROOT=process.cwd();
const RECON=process.env.COMPANY_010_RECONCILIATION_INPUT||path.join(ROOT,'companies/company-010-reconciliation.json');
const STATE=process.env.COMPANY_010_PRODUCTION_OUTPUT||path.join(ROOT,'companies/company-010-production-state.json');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const n=x=>x!==null&&x!==undefined&&x!==''&&Number.isFinite(Number(x))?Number(x):null;
const round=(x,d=8)=>n(x)===null?null:Number(Number(x).toFixed(d));

const recon=read(RECON),state=read(STATE);
if(recon?.version!=='0.2-company-010-capital-reconciliation-stakedao-base')throw new Error('Stake DAO reconciliation v0.2 required');
if(state?.company?.registry!=='010'||state?.company?.name!=='Cypher')throw new Error('Cypher production state required');
if(recon?.authority?.executionAuthority!=='none'||state?.authority?.executionAuthority!=='none')throw new Error('authority drift');
if(recon?.ownerPolicy?.fluid?.status!=='out-of-scope')throw new Error('Fluid owner policy missing');

const sd=recon?.stakeDaoBase;
if(!sd?.ok||!sd?.result)throw new Error('Stake DAO Base reconciliation unavailable');
const s=sd.result;
const stakeUsd=n(s.totalPositionUsd),stakeShares=n(s.totalShares),stakeLp=n(s.totalLpAssets);
if(stakeUsd===null||stakeUsd<0||stakeShares===null||stakeShares<0||stakeLp===null||stakeLp<0)throw new Error('Stake DAO current position is not factually measured');
if(!Array.isArray(s.underlying)||s.underlying.length!==4)throw new Error('Stake DAO underlying decomposition incomplete');
const expected=['USDC','USDbC','axlUSDC','crvUSD'];
for(const sym of expected)if(!s.underlying.some(x=>x.symbol===sym&&n(x.quantity)!==null&&n(x.quantity)>=0))throw new Error(`Stake DAO ${sym} missing`);
const stakeActive=stakeUsd>0||stakeShares>0||stakeLp>0;
if(stakeActive&&!(stakeUsd>0&&stakeShares>0&&stakeLp>0))throw new Error('Stake DAO active-position components disagree');

state.version='0.3-company-010-production-state-stakedao-complete';
state.engineVersion='0.3-cypher-stakedao-base-owner-policy-close';
state.generatedAt=new Date().toISOString();
state.company.architecture='The Holding Standard';

state.capital.positions=(state.capital.positions||[]).filter(x=>x.assetId!=='stakedao-base-curve-4pool');
if(stakeActive)state.capital.positions.push({symbol:'STAKE-DAO-4POOL',assetId:'stakedao-base-curve-4pool',protocol:'Stake DAO',chain:'Base',strategy:'Curve 4pool · USDC/USDbC/axlUSDC/crvUSD',quantity:stakeShares,lpAssets:stakeLp,valueUsd:round(stakeUsd,2),priceUsd:round(stakeUsd/stakeShares,12),priceSource:'Stake DAO RewardVault shares + Curve official Base pool TVL',capitalLayer:'productiveDividend',source:s.source,underlying:s.underlying,capitalRule:'Count the Stake DAO vault once; underlying stablecoins are decomposition only.'});

const valued=state.capital.positions.filter(x=>n(x.valueUsd)!==null);
if(valued.length!==state.capital.positions.length)throw new Error('Company #010 cannot be marked complete with an unvalued in-scope capital row');
state.capital.valuedPositionCount=valued.length;state.capital.positionCount=state.capital.positions.length;state.capital.knownCapitalFloorUsd=round(valued.reduce((sum,x)=>sum+n(x.valueUsd),0),2);state.capital.totalCapitalUsd=state.capital.knownCapitalFloorUsd;state.capital.totalCapitalComplete=true;state.capital.knownButUnboundCapitalMayExist=false;
state.capital.layerValues={foundation:0,productiveDividend:0,stableReserve:0,rwa:0,venture:0,unclassified:0};
for(const x of valued){const layer=x.capitalLayer||'unclassified';state.capital.layerValues[layer]=round((state.capital.layerValues[layer]||0)+n(x.valueUsd),2)}

state.productivity.positions=(state.productivity.positions||[]).filter(x=>x.id!=='stakedao_base_curve_4pool');
const stakeApr=n(s.referenceAprPct??s.baseApyPct);
if(stakeActive)state.productivity.positions.push({id:'stakedao_base_curve_4pool',label:'Stake DAO · Curve 4pool Base',quantity:stakeShares,valueUsd:round(stakeUsd,2),referenceAprPct:stakeApr,status:stakeApr!==null?'measured':'warming',source:s.referenceAprSource||'Curve official Base pool base APY',methodology:s.referenceAprScope||'Base pool APY only; Stake DAO boosted CRV reward APR remains separate until independently annualised.'});
const prodValued=state.productivity.positions.filter(x=>n(x.valueUsd)!==null);const prodCovered=prodValued.filter(x=>x.status==='measured'||x.status==='supported-existing-adapter');
state.productivity.knownProductiveValueUsd=round(prodValued.reduce((sum,x)=>sum+n(x.valueUsd),0),2);state.productivity.currentlyAprCoveredValueUsd=round(prodCovered.reduce((sum,x)=>sum+n(x.valueUsd),0),2);state.productivity.coverage=state.productivity.knownProductiveValueUsd>0?round(state.productivity.currentlyAprCoveredValueUsd/state.productivity.knownProductiveValueUsd,6):null;state.productivity.status=state.productivity.coverage===1?'complete':'partial';

const claimableCrv=n(s.crvClaimable);state.rewards=state.rewards||{};state.rewards.status='partial-routes-known';state.rewards.supportedRoutes=Array.isArray(state.rewards.supportedRoutes)?state.rewards.supportedRoutes:[];
if(!state.rewards.supportedRoutes.some(x=>x.id==='stakedao-base-curve-4pool'))state.rewards.supportedRoutes.push({id:'stakedao-base-curve-4pool',walletAlias:'Wallet 2',protocol:'Stake DAO',chain:'Base'});
state.rewards.observations=(state.rewards.observations||[]).filter(x=>x.id!=='stakedao-base-curve-4pool-crv');
state.rewards.observations.push({id:'stakedao-base-curve-4pool-crv',protocol:'Stake DAO',chain:'Base',token:'CRV',claimable:claimableCrv,status:claimableCrv!==null?'measured':'warming',source:s.rewardAccounting?.source||'Stake DAO verified Accountant integral state on Base',method:s.rewardAccounting?.formula||null,currentPrincipalActive:stakeActive});
state.rewards.unboundMechanisms=(state.rewards.unboundMechanisms||[]).filter(x=>x!=='Stake DAO Curve 4pool');

state.gaps=(state.gaps||[]).filter(x=>x.id!=='fluid-net-eth'&&x.id!=='stakedao-base-apy');
if(stakeActive&&stakeApr===null)state.gaps.push({id:'stakedao-base-apy',severity:'productivity',status:'warming',meaning:'Stake DAO principal and CRV claimable are measured; Curve Base pool APY was unavailable in this run.'});
state.status='complete-total-capital';
state.performance={status:'partial-cost-basis',complete:false,reason:'Current capital is complete, but company-level Performance remains withheld until acquisition basis is reproducibly bound for wrapper and strategy positions including Stake DAO, GMX and HyperLend.'};
state.provenance=state.provenance||{};state.provenance.stakeDaoBase={reconciliationVersion:recon.version,intelligenceVersion:recon.stakeDaoIntelligence?.version||null,generatedAt:recon.generatedAt||null,vault:s.vault,pool:s.pool,currentPositionActive:stakeActive,currentPositionUsd:stakeUsd,zeroIsKnown:stakeUsd===0};
state.epistemicBoundary=state.epistemicBoundary||{};state.epistemicBoundary.fluidExcluded=true;state.epistemicBoundary.fluidOwnerPolicy='out-of-scope';state.epistemicBoundary.partialTotalIsNotTotal=true;state.epistemicBoundary.noDoubleCount=true;state.epistemicBoundary.knownZeroIsNotUnknown=true;

fs.writeFileSync(STATE,JSON.stringify(state,null,2)+'\n');
console.log(JSON.stringify({status:'PASS',version:state.version,totalCapitalUsd:state.capital.totalCapitalUsd,totalCapitalComplete:state.capital.totalCapitalComplete,performance:state.performance.status,stakeDaoCurrentPositionActive:stakeActive,stakeDaoValueUsd:stakeUsd,stakeDaoReferenceAprPct:stakeApr,stakeDaoClaimableCrv:claimableCrv,fluid:'out-of-scope',executionAuthority:state.authority.executionAuthority},null,2));
