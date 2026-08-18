#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const OUTPUT=process.env.REWARDS_OUTPUT||path.resolve('companies/rewards-data.json');
const data=JSON.parse(fs.readFileSync(OUTPUT,'utf8'));
const y=data.companies?.['YieldRing.eth'];
const cy=data.companies?.Cypher;
const nine=data.companies?.['1milliondollar.eth'];
if(!y||!cy||!nine)throw new Error('Required company Rewards states missing');

// Current Passport rule: historical route is shown only while it still carries
// a real residual reward. History remains in canonical diagnostics/memory, but a
// zero-residual route must not create a public “No current claimables” row.
if(y.vlCvxRoute?.currentRoute?.publicLabel!=='Votium + Union · vlCVX')throw new Error('YieldRing current vlCVX route drift');
const yLegacy=(y.rewards||[]).filter(r=>r.protocol==='Votium · vlCVX'&&r.details?.vlCvxRoute?.routeRole==='legacy-residual');
if(yLegacy.length===0){
  y.sources=(y.sources||[]).filter(s=>!(s.route==='votium-union'&&s.protocol!=='Votium + Union · vlCVX'));
}

// Cypher uses direct Convex staked-cvxCRV claimable accounting. Give the public
// row the strategy identity, not the ambiguous generic “Convex” label.
let renamed=0;
for(const r of cy.rewards||[]){
  if(r.route==='convex-staked-cvxcrv'){
    if(r.classification!=='unclaimed')throw new Error('Cypher cvxCRV reward classification drift');
    r.protocol='Convex · staked cvxCRV';renamed++;
  }
}
for(const s of cy.sources||[])if(s.route==='convex-staked-cvxcrv')s.protocol='Convex · staked cvxCRV';
if(renamed<1)throw new Error('Cypher measured staked-cvxCRV reward missing');

// Company #009 is a different mechanism: Beefy auto-compounds Convex rewards
// into vault share value. It must never inherit Cypher's direct claimable row.
if((nine.rewards||[]).some(r=>r.route==='convex-staked-cvxcrv'))throw new Error('Company #009 incorrectly contains direct Convex staked-cvxCRV claimable rewards');

data.methodology=data.methodology||{};
data.methodology.rewardsPassportRouteHygiene='Current Passport hides historical routes with zero residual claimables. Legacy routes remain visible only while residual Unclaimed exists. Direct Convex staked-cvxCRV claimables and Beefy auto-compounded cvxCRV are distinct mechanisms and must never be cross-projected.';
data.diagnostics=data.diagnostics||{};
data.diagnostics.rewardsPassportHygiene={version:'0.1-vlcvx-cvxcrv-route-hygiene',generatedAt:new Date().toISOString(),yieldRingLegacyResidualRows:yLegacy.length,yieldRingEmptyLegacySourceRemoved:yLegacy.length===0,cypherCvxCrvRowsRenamed:renamed,company009DirectConvexRows:0,executionAuthority:'none'};
fs.writeFileSync(OUTPUT,JSON.stringify(data,null,2)+'\n');
console.log('REWARDS PASSPORT HYGIENE PASS',data.diagnostics.rewardsPassportHygiene);
