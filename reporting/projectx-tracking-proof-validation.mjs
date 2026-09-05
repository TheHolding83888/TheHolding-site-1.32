#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { projectXWhypeUsdcObservationProofs } from './accounting-coverage.mjs';

const STATE_FILE=process.env.COMPANY_010_STATE_FILE||'./companies/company-010-production-state.json';
const MANAGER='0xeaD19AE861c29bBb2101E834922B2FEee69B9091';
const WALLET='0x64688F4Adc3f72CdB44d07e4879C724CD7025696';
const WHYPE='0x5555555555555555555555555555555555555555';
const USDC='0xb88339CB7199b77E23DB6E890353E22632Ba630f';

function fixture(){
  const generatedAt='2026-09-05T12:00:00.000Z';
  return{
    generatedAt,
    company:{registry:'010',name:'Cypher',wallets:[{alias:'Wallet 2',address:WALLET}]},
    authority:{readOnly:true,walletSigning:false,transactions:false,capitalMovement:false,methodologyMutation:false,executionAuthority:'none'},
    epistemicBoundary:{
      unknownIsNotZero:true,
      referenceAprIsNotRealisedIncome:true,
      claimableRewardsAreNotRealisedCashFlow:true,
      noDoubleCount:true,
      projectXOnlyEconomicallyActiveNfts:true,
      projectXActiveNftCountDynamic:true,
      projectXDustAndEmptyNftsExcluded:true,
      projectXOtherPairsExcluded:true,
      projectXNonzeroLiquidityRequiresMeasuredPrincipal:true,
      projectXClaimableFeesAreNotPrincipal:true,
      projectXFeeTierIsNotApr:true
    },
    productivity:{positions:[{id:'projectx-whype-usdc',valueUsd:263.1,status:'measured',referenceAprPct:44,claimableApplicable:true,incomeMode:'separate-claimable-fees'}]},
    rewards:{
      supportedRoutes:[{id:'projectx-whype-usdc',protocol:'Project X',chain:'HyperEVM',claimableState:'measured'}],
      observations:[
        {id:'projectx-whype-claimable',route:'projectx-whype-usdc',protocol:'Project X',chain:'HyperEVM',token:'WHYPE',tokenAddress:WHYPE,claimable:0.006,priceUsd:80,usdValue:0.48,status:'measured',source:'collect.staticCall across current economically active WHYPE-USDC NFTs',method:'read-only; no signature or transaction'},
        {id:'projectx-usdc-claimable',route:'projectx-whype-usdc',protocol:'Project X',chain:'HyperEVM',token:'USDC',tokenAddress:USDC,claimable:0.5,priceUsd:1,usdValue:0.5,status:'measured',source:'collect.staticCall across current economically active WHYPE-USDC NFTs',method:'read-only; no signature or transaction'}
      ]
    },
    strategies:{
      projectX:{
        version:'0.1-company-010-projectx-full-parity',generatedAt,status:'measured-principal-and-claimable',id:'projectx-whype-usdc',protocol:'Project X',chain:'HyperEVM',pair:'WHYPE-USDC',manager:MANAGER,nftCount:1,
        positions:[{tokenId:'535783',wallet:WALLET,walletAlias:'Wallet 2',feeTier:500,tickLower:-235380,tickUpper:-231320,liquidity:'151729044303278',navUsd:263.1,principal:{WHYPE:0.5,USDC:223.1},claimable:{WHYPE:0.006,USDC:0.5},measurement:{principal:'decreaseLiquidity.staticCall full current liquidity; read-only',claimable:'collect.staticCall max uint128; read-only'}}],
        admission:{activeNavFloorUsd:1,minimumActiveNftCount:1,actualActiveNftCount:1},
        principal:{WHYPE:0.5,USDC:223.1,navUsd:263.1,prices:{WHYPE:80,USDC:1}},
        rewards:{route:'projectx-whype-usdc',publicStatus:'Unclaimed',claimableApplicable:true,measurementStatus:'measured',tokens:[{symbol:'WHYPE',address:WHYPE,amount:0.006,priceUsd:80,usdValue:0.48},{symbol:'USDC',address:USDC,amount:0.5,priceUsd:1,usdValue:0.5}],totalUsd:0.98,source:'collect.staticCall across the current economically active NFT set'},
        yield:{status:'measured',referenceAprPct:44,referenceMetric:'reference-only'},
        accountingBoundary:{multiLegPrincipalComplete:true,dynamicActiveNftInventory:true,dustAndEmptyNftsExcluded:true,otherPairNftsExcluded:true,whypeRemovedFromGeneralHype:true,usdcIncludedInStrategyNav:true,strategyNavCountedOnce:true,claimableFeesExcludedFromCapital:true,noDoubleCount:true},
        authority:{readOnly:true,walletSigning:false,transactions:false,executionAuthority:'none'}
      }
    }
  };
}

const valid=fixture();
let proofs=projectXWhypeUsdcObservationProofs(valid);
assert.equal(proofs.length,1,'valid Project X current-state observation must prove factual tracking');
assert.equal(proofs[0].engineId,'projectx-whype-usdc');
assert.equal(proofs[0].company,'Cypher');
assert.equal(proofs[0].sourceFile,'companies/company-010-production-state.json#strategies.projectX');

const referenceDrift=fixture();
referenceDrift.strategies.projectX.yield.referenceAprPct=999999;
referenceDrift.productivity.positions[0].referenceAprPct=999999;
assert.equal(projectXWhypeUsdcObservationProofs(referenceDrift).length,1,'reference APR leaked into factual tracking authority');

const badAuthority=fixture();
badAuthority.strategies.projectX.authority.transactions=true;
assert.equal(projectXWhypeUsdcObservationProofs(badAuthority).length,0,'transaction-capable Project X state gained accounting tracking authority');

const claimableMismatch=fixture();
claimableMismatch.strategies.projectX.rewards.tokens[0].amount=0.5;
assert.equal(projectXWhypeUsdcObservationProofs(claimableMismatch).length,0,'Project X claimable mismatch failed open');

const missingProjection=fixture();
missingProjection.rewards.observations.pop();
assert.equal(projectXWhypeUsdcObservationProofs(missingProjection).length,0,'incomplete Project X reward projection gained tracking authority');

const missingMeasurement=fixture();
missingMeasurement.strategies.projectX.positions[0].measurement.claimable='unknown';
assert.equal(projectXWhypeUsdcObservationProofs(missingMeasurement).length,0,'unmeasured Project X claimable state gained tracking authority');

const knownZero=fixture();
knownZero.strategies.projectX.positions[0].claimable={WHYPE:0,USDC:0};
knownZero.strategies.projectX.rewards.tokens[0].amount=0;
knownZero.strategies.projectX.rewards.tokens[0].usdValue=0;
knownZero.strategies.projectX.rewards.tokens[1].amount=0;
knownZero.strategies.projectX.rewards.tokens[1].usdValue=0;
knownZero.strategies.projectX.rewards.totalUsd=0;
knownZero.rewards.observations[0].claimable=0;
knownZero.rewards.observations[0].usdValue=0;
knownZero.rewards.observations[1].claimable=0;
knownZero.rewards.observations[1].usdValue=0;
assert.equal(projectXWhypeUsdcObservationProofs(knownZero).length,1,'measured Project X zero claimable was treated as unknown');

if(fs.existsSync(STATE_FILE)){
  const live=JSON.parse(fs.readFileSync(STATE_FILE,'utf8'));
  proofs=projectXWhypeUsdcObservationProofs(live);
  assert.ok(proofs.some(x=>x.company==='Cypher'&&x.engineId==='projectx-whype-usdc'),'live canonical Project X observation does not satisfy factual tracking proof');
}

console.log('Project X WHYPE-USDC factual tracking validation PASS',{currentStateTracking:true,referenceAprAuthority:false,periodIncomeAuthority:false,claimAuthority:false,executionAuthority:'none'});
