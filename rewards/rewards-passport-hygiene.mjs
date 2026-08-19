#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const OUTPUT=process.env.REWARDS_OUTPUT||path.resolve('companies/rewards-data.json');
const data=JSON.parse(fs.readFileSync(OUTPUT,'utf8'));
const y=data.companies?.['YieldRing.eth'];
const cy=data.companies?.Cypher;
const nine=data.companies?.['1milliondollar.eth'];
if(!y||!cy||!nine)throw new Error('Required company Rewards states missing');

// Public Rewards naming contract:
// main label = Protocol · working asset / strategy
// detail line keeps the earned token and network; reward state stays separate.
// Only routes whose productive asset is already canonically proven are normalized here.
const ROUTE_LABELS=new Map([
  ['curve-fees','Curve · veCRV'],
  ['aerodrome-relay','Aerodrome · veAERO'],
  ['aerodrome-ve','Aerodrome · veAERO'],
  ['velodrome-ve','Velodrome · veVELO'],
  ['velodrome-ve-direct','Velodrome · veVELO'],
  ['pendle-spendle','Pendle · sPENDLE'],
  ['fx-fees','f(x) Protocol · veFXN'],
  ['liquity-staking','Liquity · staked LQTY'],
  ['stakedao-base-curve-4pool','Stake DAO · 4pool stables'],
  ['convex-staked-cvxcrv','Convex · staked cvxCRV']
]);
const labelCounts={};
for(const company of Object.values(data.companies||{})){
  for(const bucket of ['rewards','sources','embeddedIncome']){
    for(const row of company?.[bucket]||[]){
      const label=ROUTE_LABELS.get(row?.route);
      if(!label)continue;
      row.protocol=label;
      const key=`${row.route}:${bucket}`;
      labelCounts[key]=(labelCounts[key]||0)+1;
    }
  }
}

// Current Passport rule: historical route is shown only while it still carries
// a real residual reward. History remains in canonical diagnostics/memory, but a
// zero-residual route must not create a public “No current claimables” row.
if(y.vlCvxRoute?.currentRoute?.publicLabel!=='Votium + Union · vlCVX')throw new Error('YieldRing current vlCVX route drift');
const yLegacy=(y.rewards||[]).filter(r=>r.protocol==='Votium · vlCVX'&&r.details?.vlCvxRoute?.routeRole==='legacy-residual');
if(yLegacy.length===0){
  y.sources=(y.sources||[]).filter(s=>!(s.route==='votium-union'&&s.protocol!=='Votium + Union · vlCVX'));
}

// Cypher uses direct Convex staked-cvxCRV claimable accounting. Keep the public
// row tied to the strategy identity, never the ambiguous generic “Convex” label.
const cyCvx=(cy.rewards||[]).filter(r=>r.route==='convex-staked-cvxcrv');
if(cyCvx.some(r=>r.classification!=='unclaimed'))throw new Error('Cypher cvxCRV reward classification drift');
if(cyCvx.length<1)throw new Error('Cypher measured staked-cvxCRV reward missing');

// Company #009 is a different mechanism: Beefy auto-compounds Convex rewards
// into vault share value. It must never inherit Cypher's direct claimable row.
if((nine.rewards||[]).some(r=>r.route==='convex-staked-cvxcrv'))throw new Error('Company #009 incorrectly contains direct Convex staked-cvxCRV claimable rewards');

// Route-specific semantic guards. A productive position can earn several
// different incentive tokens; the title identifies the working asset while the
// actual earned symbol + chain remain deliberately untouched underneath.
for(const company of Object.values(data.companies||{})){
  for(const r of company?.rewards||[]){
    if(r.route==='curve-fees'&&(r.symbol!=='crvUSD'||r.chain!=='Ethereum'))throw new Error('Curve veCRV reward provenance drift');
    if(['aerodrome-relay','aerodrome-ve'].includes(r.route)&&r.chain!=='Base')throw new Error('Aerodrome veAERO chain provenance drift');
    if(['velodrome-ve','velodrome-ve-direct'].includes(r.route)&&r.chain!=='Optimism')throw new Error('Velodrome veVELO chain provenance drift');
    if(r.route==='fx-fees'&&r.chain!=='Ethereum')throw new Error('f(x) veFXN chain provenance drift');
    if(r.route==='liquity-staking'&&r.chain!=='Ethereum')throw new Error('Liquity staked LQTY chain provenance drift');
  }
}

data.methodology=data.methodology||{};
data.methodology.rewardsPassportRouteHygiene='Current Passport hides historical routes with zero residual claimables. Legacy routes remain visible only while residual Unclaimed exists. Public reward rows use Protocol · productive asset/strategy as the main identity, while the actual earned token and network remain separate provenance. Only routes with already-proven productive-asset identity are normalized; ambiguous multi-position routes remain unchanged rather than guessed. Direct Convex staked-cvxCRV claimables and Beefy auto-compounded cvxCRV are distinct mechanisms and must never be cross-projected.';
data.diagnostics=data.diagnostics||{};
data.diagnostics.rewardsPassportHygiene={version:'0.2-protocol-asset-label-parity',generatedAt:new Date().toISOString(),yieldRingLegacyResidualRows:yLegacy.length,yieldRingEmptyLegacySourceRemoved:yLegacy.length===0,cypherCvxCrvRowsRenamed:cyCvx.length,company009DirectConvexRows:0,protocolAssetLabelCounts:labelCounts,executionAuthority:'none'};
fs.writeFileSync(OUTPUT,JSON.stringify(data,null,2)+'\n');
console.log('REWARDS PASSPORT HYGIENE PASS',data.diagnostics.rewardsPassportHygiene);
