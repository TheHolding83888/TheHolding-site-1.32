import fs from 'node:fs';
import { AbiCoder, Contract, JsonRpcProvider, concat, getAddress, keccak256, solidityPackedKeccak256 } from 'ethers';
const AUTHORITY={executionAuthority:'none'};
const REWARDS=process.env.REWARDS_OUTPUT||'companies/rewards-data.json';
const AUDIT=process.env.VLCVX_AUDIT_OUTPUT||'/tmp/vlcvx-route-audit.json';
const UNION_AUDIT=process.env.UNION_AUDIT_OUTPUT||'/tmp/union-vlcvx-allocation-audit.json';
const RPCS=[...new Set([process.env.ETH_RPC_URL,'https://ethereum-rpc.publicnode.com','https://eth.llamarpc.com'].filter(Boolean))];
const UNION_DIST=getAddress('0x17ac69dd3fb8f22b4f52dbdb8a3a0eb059367efc');
const STAKE_DIST=getAddress('0x17F513CDE031C8B1E878Bde1Cb020cE29f77f380');
const SCRVUSD=getAddress('0x0655977FEb2f289A4aB78af67BAB0d17aAb84367');
const CONVEX_TEAM=getAddress('0x947B7742C403f20e5FaCcDAc5E092C943E7D0277');
const STAKE_URL='https://raw.githubusercontent.com/stake-dao/bounties-report/main/bounties-reports/latest/vlCVX/vlcvx_merkle_delegators.json';
const coder=AbiCoder.defaultAbiCoder();
const same=(a,b)=>{try{return getAddress(a)===getAddress(b)}catch{return false}};
const pair=(a,b)=>keccak256(String(a).toLowerCase()<String(b).toLowerCase()?concat([a,b]):concat([b,a]));
function unionProof(wallet,c,root){let x=solidityPackedKeccak256(['uint256','address','uint256'],[BigInt(c.index),wallet,BigInt(c.amount)]);for(const p of c.proof||[])x=pair(x,p);return x.toLowerCase()===String(root).toLowerCase()}
function stakeProof(wallet,token,amount,proof,root){let x=keccak256(keccak256(coder.encode(['address','address','uint256'],[wallet,token,amount])));for(const p of proof||[])x=pair(x,p);return x.toLowerCase()===String(root).toLowerCase()}
async function provider(){let last;for(const u of RPCS){try{const p=new JsonRpcProvider(u,1,{staticNetwork:true});await p.getBlockNumber();return p}catch(e){last=e}}throw last||new Error('RPC unavailable')}
async function json(url,{allow404=false}={}){const r=await fetch(url,{headers:{accept:'application/json'}});if(r.status===404&&allow404)return null;if(!r.ok)throw new Error(`${url} HTTP ${r.status}`);return r.json()}
async function main(){
 if(AUTHORITY.executionAuthority!=='none')throw new Error('execution authority expanded');
 const d=JSON.parse(fs.readFileSync(REWARDS,'utf8')),a=JSON.parse(fs.readFileSync(AUDIT,'utf8')),ua=JSON.parse(fs.readFileSync(UNION_AUDIT,'utf8')),p=await provider();
 if(d.diagnostics?.vlCvxRoutePromotion?.executionAuthority!=='none'||d.diagnostics?.vlCvxRoutePromotion?.claimTransactionAuthority!=='none')throw new Error('vlCVX promotion authority drift');
 const positives=a.companies.filter(x=>x.hasVlCvx);if(positives.map(x=>x.registry).sort().join(',')!=='002,004,007,010')throw new Error('current vlCVX registry set drift');
 const expected={'002':'Votium + Union · vlCVX','004':'Votium + Union · vlCVX','007':'Convex Finance · vlCVX','010':'Stake DAO · vlCVX'};
 const keys={'002':'YieldRing.eth','004':'defitea.eth','007':"Rook's portfolio",'010':'Cypher'};
 for(const c of positives){const w=c.wallets.find(x=>x.hasVlCvx);if(w.route?.publicLabel!==expected[c.registry])throw new Error(`route mismatch ${c.registry}: ${w.route?.publicLabel}`);const out=d.companies?.[keys[c.registry]];if(out?.vlCvxRoute?.currentRoute?.publicLabel!==expected[c.registry])throw new Error(`canonical route metadata missing ${c.registry}`);const src=(out.sources||[]).find(x=>x.route==='vlcvx-current-route');if(src?.protocol!==expected[c.registry])throw new Error(`current route source label missing ${c.registry}`)}
 // Direct Votium atoms are claim inventory, never current-route proof when the live route differs.
 for(const reg of ['004','007']){const c=d.companies[keys[reg]],legacy=(c.rewards||[]).filter(x=>x.protocol==='Votium · vlCVX'&&x.route==='votium-union');if(!legacy.length)throw new Error(`expected legacy Votium residuals missing ${reg}`);for(const r of legacy)if(r.details?.vlCvxRoute?.routeRole!=='legacy-residual')throw new Error(`legacy role missing ${reg}`)}
 // Union: verify official member proof against live distributor root for every current Union member.
 const ud=new Contract(UNION_DIST,['function merkleRoot() view returns (bytes32)','function isClaimed(uint256) view returns (bool)'],p),uroot=await ud.merkleRoot();
 for(const reg of ['002','004']){const w=a.companies.find(x=>x.registry===reg).wallets.find(x=>x.hasVlCvx),alloc=ua.members.find(x=>x.registry===reg);if(alloc?.selected?.length!==1||alloc.selected[0].settlementAsset!=='scrvUSD'||alloc.selected[0].sharePct!==100)throw new Error(`Union settlement allocation drift ${reg}`);const claim=await json(`https://api.llama.airforce/airdrop/scrvusd/${w.address}`,{allow404:true});const c=d.companies[keys[reg]],rows=(c.rewards||[]).filter(x=>x.route==='votium-union-scrvusd'&&x.details?.vlCvxRoute?.routeRole==='current');if(claim){if(!unionProof(w.address,claim,uroot))throw new Error(`Union Merkle proof invalid ${reg}`);const claimed=Boolean(await ud.isClaimed(BigInt(claim.index)));if(!claimed&&BigInt(claim.amount)>0n){if(rows.length!==1||rows[0].protocol!=='Votium + Union · vlCVX'||!same(rows[0].token,SCRVUSD)||rows[0].classification!=='unclaimed')throw new Error(`Union current reward parity failed ${reg}`)}else if(rows.length)throw new Error(`claimed/zero Union entitlement leaked ${reg}`)}else if(rows.length)throw new Error(`Union row fabricated on 404 ${reg}`)}
 // Stake DAO: active root, exact embedded proof, claimed subtraction and canonical current row.
 const sm=await json(STAKE_URL),sd=new Contract(STAKE_DIST,['function root() view returns (bytes32)','function claimed(address,address) view returns (uint256)'],p),sroot=await sd.root();if(String(sm.merkleRoot).toLowerCase()!==String(sroot).toLowerCase())throw new Error('Stake DAO latest delegator root is not active');const wallet=a.companies.find(x=>x.registry==='010').wallets.find(x=>x.hasVlCvx).address,entry=Object.entries(sm.claims||{}).find(([x])=>same(x,wallet));if(!entry)throw new Error('Cypher absent from active Stake DAO delegator root');const cy=d.companies.Cypher;for(const [tokenRaw,t] of Object.entries(entry[1].tokens||{})){const token=getAddress(tokenRaw),amount=BigInt(t.amount);if(!stakeProof(wallet,token,amount,t.proof,sroot))throw new Error('Stake DAO embedded proof invalid');const claimed=BigInt(await sd.claimed(wallet,token)),remaining=amount-claimed,rows=(cy.rewards||[]).filter(x=>x.route==='stake-dao-vlcvx'&&same(x.token,token));if(remaining>0n){if(rows.length!==1||rows[0].protocol!=='Stake DAO · vlCVX'||BigInt(rows[0].amountRaw)!==remaining)throw new Error('Stake DAO remaining entitlement parity failed')}else if(rows.length)throw new Error('fully claimed Stake DAO row leaked')}
 if((cy.sources||[]).some(x=>x.route==='votium-union'&&/union/i.test(String(x.protocol))))throw new Error('Cypher stale Votium+Union current source remains');
 const rook=d.companies["Rook's portfolio"],rookCurrent=(rook.sources||[]).find(x=>x.route==='vlcvx-current-route'),rs=rookCurrent?.details?.settlement||{};
 if(rookCurrent?.protocol!=='Convex Finance · vlCVX'||rookCurrent?.status!=='ok'||rookCurrent?.details?.currentRewardSettlement!=='no-votium-incentive-eligibility-observed-current-route'||rookCurrent?.details?.unknownIsNotZero!==true)throw new Error('Rook current Convex route factual boundary missing');
 if(rs?.evidenceClass!=='factual-current-route-eligibility-boundary'||rs?.trackingBoundaryComplete!==true||rs?.periodIncomeAuthority!==false||rs?.universalExternalRewardZeroAsserted!==false||rs?.unknownIsNotZero!==true)throw new Error('Rook current Convex settlement semantics drift');
 if(!same(rs?.currentDelegateAddress,CONVEX_TEAM)||rs?.allWeightedProposalsConvexTeam!==true||rs?.noManualOrSurrogateOverrideOnWeightedProposals!==true||Number(rs?.manualOrSurrogateOverrideCount)!==0||Number(rs?.nonConvexTeamWeightedProposalCount)!==0)throw new Error('Rook Convex-Team participation proof missing');
 if(rs?.lockerPlatformRewardsTrackedSeparately!==true||rs?.extraRewardDistributionTrackedSeparately!==true||rs?.legacyResidualRewardsTrackedSeparately!==true)throw new Error('Rook vlCVX component separation missing');
 console.log('vlCVX ROUTE PROMOTION GUARD PASS',{routes:expected,unionRoot:uroot,stakeDaoRoot:sroot,rookSettlement:rookCurrent.details.currentRewardSettlement});
}
main().catch(e=>{console.error(e);process.exitCode=1});