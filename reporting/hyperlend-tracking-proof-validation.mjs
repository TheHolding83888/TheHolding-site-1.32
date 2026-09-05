#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { hyperlendKhypeObservationProofs } from './accounting-coverage.mjs';

const STATE_FILE=process.env.COMPANY_010_STATE_FILE||'./companies/company-010-production-state.json';
const REWARDS_FILE=process.env.REWARDS_DATA_FILE||'./companies/rewards-data.json';
const ASSET='0xfD739d4e423301CE9385c1fb8850539D657C296D';
const HTOKEN='0xa55DE93CDE5A34c5521B7584022846829CB74366';
const DATA_PROVIDER='0x5481bf8d3946E6A3168640c1D7523eB59F055a29';
const POOL='0x00A89d7a5A02160f20150EbEA7a2b5E4879A1A8b';
const WALLET='0x64688F4Adc3f72CdB44d07e4879C724CD7025696';

function fixture(){
  const generatedAt='2026-09-05T12:00:00.000Z';
  const state={
    generatedAt,
    company:{registry:'010',name:'Cypher',wallets:[{alias:'Wallet 2',address:WALLET}]},
    authority:{readOnly:true,walletSigning:false,transactions:false,capitalMovement:false,methodologyMutation:false,executionAuthority:'none'},
    provenance:{hyperlendIncome:{version:'0.1-company-010-hyperlend-income-parity',generatedAt}},
    strategies:{
      hyperlend:{
        version:'0.1-company-010-hyperlend-income-parity',status:'measured',protocol:'HyperLend',chain:'HyperEVM',market:'kHYPE supply',
        underlyingAsset:ASSET,hToken:HTOKEN,hTokenSymbol:'hHyperEvmkHYPE',dataProvider:DATA_PROVIDER,pool:POOL,referenceAprPct:60,
        income:{
          primary:{
            state:'Compounded',classification:'embedded-lending-interest',claimableApplicable:false,amount:0.000001,symbol:'kHYPE',usdValue:0.000086,
            measurementStatus:'measured',metric:'scaledBalance × (current liquidity index − previous user index)',
            wallets:[{wallet:WALLET,walletAlias:'Wallet 2',scaledBalanceRaw:'1000000000000000000',previousLiquidityIndex:'1000000000000000000000000000',currentLiquidityIndex:'1000001000000000000000000000',embeddedInterestSinceLastAction:0.000001,status:'measured'}]
          },
          externalIncentives:{status:'none',controller:null,rewardAssetCount:0,rewards:[],classification:'none'}
        },
        accountingBoundary:{embeddedInterestAlreadyInPrincipalBalance:true,embeddedInterestNotAdditiveCapital:true,embeddedInterestNotClaimable:true,externalIncentivesSeparateFromSupplyApr:true,noDoubleCount:true},
        authority:{readOnly:true,walletSigning:false,transactions:false,executionAuthority:'none'}
      }
    }
  };
  const rewards={
    generatedAt,
    companies:{
      Cypher:{
        updatedAt:generatedAt,
        sources:[{
          protocol:'HyperLend',route:'hyperlend-khype',status:'ok',chain:'HyperEVM',metric:'kHYPE supply interest via scaled balance + liquidity index',
          details:{market:'kHYPE',hToken:HTOKEN,rewardState:'Compounded',incomeMode:'embedded-lending-interest',claimableApplicable:false,embeddedMeasurementStatus:'measured',externalIncentivesStatus:'none',externalRewardAssetCount:0,unknownIsNotZero:false}
        }],
        embeddedIncome:[{
          protocol:'HyperLend',route:'hyperlend-khype',chain:'HyperEVM',state:'Compounded',claimableApplicable:false,symbol:'kHYPE',amount:0.000001,
          classification:'compounded-embedded',usdValue:0.000086,usdValueIncludedInClaimableTotal:false,metric:'scaledBalance × (current liquidity index − previous user index)'
        }],
        rewards:[]
      }
    }
  };
  return{state,rewards};
}

const valid=fixture();
const proofs=hyperlendKhypeObservationProofs(valid.state,valid.rewards);
assert.equal(proofs.length,1,'valid HyperLend lending-index observation must prove tracking');
assert.equal(proofs[0].engineId,'hyperlend-0xfd739d4e423301ce9385c1fb8850539d657c296d');
assert.equal(proofs[0].company,'Cypher');

const warming=fixture();warming.state.strategies.hyperlend.income.primary.measurementStatus='warming';
assert.equal(hyperlendKhypeObservationProofs(warming.state,warming.rewards).length,0,'warming HyperLend state gained factual tracking authority');

const badAuthority=fixture();badAuthority.state.strategies.hyperlend.authority.executionAuthority='wallet';
assert.equal(hyperlendKhypeObservationProofs(badAuthority.state,badAuthority.rewards).length,0,'HyperLend proof survived execution-authority drift');

const missingBasis=fixture();missingBasis.state.strategies.hyperlend.income.primary.wallets[0].previousLiquidityIndex='0';
assert.equal(hyperlendKhypeObservationProofs(missingBasis.state,missingBasis.rewards).length,0,'positive HyperLend principal without previous index gained tracking authority');

const indexRegression=fixture();indexRegression.state.strategies.hyperlend.income.primary.wallets[0].currentLiquidityIndex='999999000000000000000000000';
assert.equal(hyperlendKhypeObservationProofs(indexRegression.state,indexRegression.rewards).length,0,'regressed HyperLend liquidity index gained tracking authority');

const amountMismatch=fixture();amountMismatch.state.strategies.hyperlend.income.primary.amount=0.1;
assert.equal(hyperlendKhypeObservationProofs(amountMismatch.state,amountMismatch.rewards).length,0,'HyperLend raw index proof accepted a fabricated embedded amount');

const claimableDrift=fixture();claimableDrift.rewards.companies.Cypher.embeddedIncome[0].claimableApplicable=true;
assert.equal(hyperlendKhypeObservationProofs(claimableDrift.state,claimableDrift.rewards).length,0,'embedded HyperLend interest became claimable and still proved tracking');

const missingProjection=fixture();missingProjection.rewards.companies.Cypher.sources=[];
assert.equal(hyperlendKhypeObservationProofs(missingProjection.state,missingProjection.rewards).length,0,'unprojected HyperLend state gained accounting tracking authority');

if(fs.existsSync(STATE_FILE)&&fs.existsSync(REWARDS_FILE)){
  const state=JSON.parse(fs.readFileSync(STATE_FILE,'utf8'));
  const rewards=JSON.parse(fs.readFileSync(REWARDS_FILE,'utf8'));
  const live=hyperlendKhypeObservationProofs(state,rewards);
  assert.ok(live.some(x=>x.company==='Cypher'&&x.engineId==='hyperlend-0xfd739d4e423301ce9385c1fb8850539d657c296d'),'live canonical HyperLend observation does not satisfy factual tracking proof');
}

console.log('HyperLend kHYPE factual tracking validation PASS',{embeddedIndexTracking:true,rawIndexReconciliation:true,claimableAuthority:false,periodIncomeAuthority:false,referenceAprAuthority:false,executionAuthority:'none'});
