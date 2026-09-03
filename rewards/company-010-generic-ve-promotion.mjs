#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT=process.cwd();
const ENGINE=process.env.REWARDS_ENGINE_SOURCE||path.join(ROOT,'rewards/company-rewards-engine.mjs');
const DATA=process.env.REWARDS_DATA||path.join(ROOT,'companies/rewards-data.json');
const WALLET='0x64688F4Adc3f72CdB44d07e4879C724CD7025696';
const START='const COMPANIES = [';
const END='\n];\n\nconst ERC20_ABI';
const DIRECT_INDEX_MARKER=[
  '    const key = directVeIndexKey(cfg.providerKey, tokenId);',
  '    const indexEntry = directVeRewardIndex.get(key) || null;',
  '    const recent = await boundedRecentVotedPools(cfg, tokenId, provider, indexEntry);'
].join('\n');
const REQUIRED_ENGINE_MARKERS=[
  "const VERSION = '0.3.9'",
  'async function collectVeProtocol',
  'directVeRewardIndex',
  'boundedRecentVotedPools',
  'async function currentVoterRewardRegistry',
  'async function probeRewardParticipation',
  DIRECT_INDEX_MARKER,
  "case 'aerodrome-ve': return collectVeProtocol",
  "case 'velodrome-ve-direct': return collectVeProtocol"
];

function readJson(file){return JSON.parse(fs.readFileSync(file,'utf8'));}
function writeJson(file,data){fs.writeFileSync(file,JSON.stringify(data,null,2)+'\n');}
function findSource(company,route){return(company?.sources||[]).find(x=>x?.route===route)||null;}
function flattenedPositions(source){
  const out=[];
  let walletScopedCount=0;
  for(const wr of source?.details?.walletResults||[]){
    for(const p of wr?.details?.positions||[]){
      out.push({...p,holderAddress:p?.holderAddress||wr?.wallet||null,walletAlias:p?.walletAlias||wr?.walletAlias||null});
      walletScopedCount++;
    }
  }
  if(walletScopedCount===0){
    for(const p of source?.details?.positions||[])out.push({...p,holderAddress:p?.holderAddress||source?.details?.wallet||null});
  }
  const seen=new Set();
  return out.filter(p=>{
    const key=[String(p?.holderAddress||'').toLowerCase(),String(p?.tokenId||''),String(p?.mode||'')].join('|');
    if(!p?.tokenId||seen.has(key))return false;
    seen.add(key);return true;
  });
}
function assertGenericCypher(cypher){
  if(!cypher)throw new Error('generic Cypher result missing');
  for(const [route,expectedChain] of [['aerodrome-ve','Base'],['velodrome-ve-direct','Optimism']]){
    const source=findSource(cypher,route);
    if(!source||!['ok','partial'].includes(source.status))throw new Error(`generic ${route} source missing or unmeasured`);
    if(source.chain!==expectedChain)throw new Error(`generic ${route} chain drift`);
    const positions=flattenedPositions(source);
    if(!positions.length)throw new Error(`generic ${route} exact veNFT position missing`);
    for(const p of positions){
      if(String(p.holderAddress||'').toLowerCase()!==WALLET.toLowerCase())throw new Error(`generic ${route} holder drift`);
      if(!/^\d+$/.test(String(p.tokenId||'')))throw new Error(`generic ${route} tokenId missing`);
      if(p.mode==='managed'){
        if(!/^\d+$/.test(String(p.managedTokenId||''))||!/^0x[0-9a-f]{40}$/i.test(String(p.lockedManagedReward||'')))throw new Error(`generic ${route} managed custody evidence incomplete`);
      }else if(p.mode==='direct'){
        if(p.operationalDiscovery?.complete!==true){
          const diagnostic={sourceStatus:source.status,tokenId:String(p.tokenId),operationalDiscovery:p.operationalDiscovery||null,rewardIndex:p.rewardIndex||null,currentVotedPools:p.currentVotedPools||[],recentVotedPools:p.recentVotedPools||[],matchedRewardContracts:p.matchedRewardContracts||[]};
          throw new Error(`generic ${route} direct operational discovery incomplete: ${JSON.stringify(diagnostic)}`);
        }
        if(!p.rewardIndex||!Number.isFinite(Number(p.rewardIndex.contractCount)))throw new Error(`generic ${route} direct reward index missing`);
        if(p.rewardIndex.bootstrapComplete!==true)throw new Error(`generic ${route} direct reward index bootstrap incomplete`);
      }else throw new Error(`generic ${route} unsupported custody mode ${String(p.mode)}`);
    }
  }
}

function addStateNativeFirstOnboarding(source){
  if(!source.includes(DIRECT_INDEX_MARKER))throw new Error('generic Rewards direct-index anchor changed');
  const replacement=[
    '    const key = directVeIndexKey(cfg.providerKey, tokenId);',
    '    let indexEntry = directVeRewardIndex.get(key) || null;',
    '    let firstOnboarding = null;',
    '',
    '    // A new direct veNFT needs one complete bootstrap before the cheap daily tail',
    '    // is authoritative. Use protocol state, not explorer history: the deployed',
    '    // Voter registry retains every pool, and VotingReward participation state',
    '    // proves exactly which reward contracts this tokenId has ever entered.',
    '    if (!indexEntry) {',
    '      try {',
    '        const registrySnapshot = await currentVoterRewardRegistry(cfg, provider);',
    '        if (registrySnapshot.complete !== true) {',
    '          firstOnboarding = {',
    "            complete: false, source: 'onchain-current-voter-registry',",
    "            errors: ['voter-registry-incomplete:' + (registrySnapshot.issues || []).join(' | ')],",
    '            rawPoolCount: registrySnapshot.rawPoolCount,',
    '            rewardContractCount: registrySnapshot.rewardContractCount',
    '          };',
    '        } else {',
    '          const participationRows = await mapLimit(registrySnapshot.entries, 24, async entry => ({',
    '            entry,',
    '            participation: await probeRewardParticipation(entry.rewardAddress, tokenId, provider, cfg)',
    '          }));',
    '          const unknown = participationRows.filter(x => x.participation?.known !== true);',
    '          if (unknown.length) {',
    '            firstOnboarding = {',
    "              complete: false, source: 'onchain-current-voter-registry',",
    "              errors: ['reward-participation-unknown:' + unknown.length],",
    '              rawPoolCount: registrySnapshot.rawPoolCount,',
    '              rewardContractCount: registrySnapshot.rewardContractCount,',
    '              unknownRewardContracts: unknown.slice(0, 20).map(x => ({',
    '                rewardAddress: x.entry?.rewardAddress || null,',
    '                errors: x.participation?.errors || []',
    '              }))',
    '            };',
    '          } else {',
    '            const participated = participationRows',
    '              .filter(x => x.participation?.participates === true)',
    '              .map(x => ({',
    '                ...x.entry,',
    '                firstSeenAt: NOW,',
    '                lastSeenAt: NOW',
    '              }));',
    '            const bootstrapBlock = Number(await provider.getBlockNumber());',
    '            indexEntry = upsertDirectVeIndex(cfg.providerKey, tokenId, {',
    '              contracts: participated,',
    '              observedAt: NOW,',
    '              recentStartBlock: bootstrapBlock,',
    '              recentThroughBlock: bootstrapBlock,',
    "              bootstrapSource: 'current-voter-registry-participation',",
    '              bootstrapComplete: true,',
    '              lastUpdatedAt: NOW',
    '            });',
    '            firstOnboarding = {',
    "              complete: true, source: 'onchain-current-voter-registry',",
    '              latestBlock: bootstrapBlock,',
    '              rawPoolCount: registrySnapshot.rawPoolCount,',
    '              rewardContractCount: registrySnapshot.rewardContractCount,',
    '              participatedRewardContractCount: participated.length,',
    '              probeCount: participationRows.length',
    '            };',
    '          }',
    '        }',
    '      } catch (e) {',
    '        firstOnboarding = {',
    "          complete: false, source: 'onchain-current-voter-registry',",
    "          errors: ['voter-registry-bootstrap:' + redactKnownRpcUrls(e?.message || e)]",
    '        };',
    '      }',
    '    }',
    '',
    '    const recent = firstOnboarding?.complete === true ? {',
    '      complete: true,',
    "      mode: 'first-onboarding-voter-registry-participation',",
    "      source: 'onchain-current-voter-registry',",
    '      startBlock: firstOnboarding.latestBlock,',
    '      throughBlock: firstOnboarding.latestBlock,',
    '      latestBlock: firstOnboarding.latestBlock,',
    '      pools: [],',
    '      logCount: 0,',
    '      requestCount: firstOnboarding.probeCount,',
    '      budgetMs: 0,',
    '      errors: []',
    '    } : await boundedRecentVotedPools(cfg, tokenId, provider, indexEntry);',
    '    if (firstOnboarding && firstOnboarding.complete !== true) {',
    "      recent.mode = 'voter-registry-bootstrap-fallback:' + recent.mode;",
    '      recent.errors = [...(firstOnboarding.errors || []), ...(recent.errors || [])];',
    '    }'
  ].join('\n');
  return source.replace(DIRECT_INDEX_MARKER,replacement);
}

export function promoteCypherThroughGenericRewards(){
  if(!fs.existsSync(DATA))throw new Error(`canonical Rewards data missing: ${DATA}`);
  const original=fs.readFileSync(ENGINE,'utf8');
  for(const marker of REQUIRED_ENGINE_MARKERS)if(!original.includes(marker))throw new Error(`generic Rewards engine compatibility marker missing: ${marker}`);
  const start=original.indexOf(START),end=original.indexOf(END,start);
  if(start<0||end<0||end<=start)throw new Error('generic Rewards COMPANIES registry anchor changed');
  const registrySlice=original.slice(start,end+3);
  if(registrySlice.includes("name: 'Cypher'")){
    const current=readJson(DATA);
    const cypher=current?.companies?.Cypher;
    assertGenericCypher(cypher);
    return {status:'native-generic-registry',company:'Cypher',executionAuthority:'none'};
  }

  const extension=`const COMPANIES = [\n  {\n    name: 'Cypher',\n    wallets: [{ alias: 'Wallet 2', address: '${WALLET}' }],\n    routes: ['aerodrome-ve', 'velodrome-ve-direct']\n  }\n];`;
  let transformed=original.slice(0,start)+extension+original.slice(end+3);
  transformed=addStateNativeFirstOnboarding(transformed);

  const tempDir=fs.mkdtempSync(path.join(path.dirname(ENGINE),'.holding-cypher-generic-'));
  const tempEngine=path.join(tempDir,'company-rewards-engine-cypher.mjs');
  const tempData=path.join(tempDir,'rewards-data.json');

  try{
    fs.writeFileSync(tempEngine,transformed);
    fs.copyFileSync(DATA,tempData);

    const run=spawnSync(process.execPath,[tempEngine],{
      cwd:ROOT,
      env:{...process.env,REWARDS_OUTPUT:tempData},
      encoding:'utf8',
      timeout:600_000,
      maxBuffer:16*1024*1024
    });
    if(run.status!==0){
      const stderr=String(run.stderr||'').slice(-8000),stdout=String(run.stdout||'').slice(-8000);
      throw new Error(`generic Cypher Rewards promotion failed (${run.status}): ${stderr||stdout||'no output'}`);
    }

    const promoted=readJson(tempData),cypher=promoted?.companies?.Cypher;
    assertGenericCypher(cypher);
    const canonical=readJson(DATA);
    canonical.companies=canonical.companies&&typeof canonical.companies==='object'&&!Array.isArray(canonical.companies)?canonical.companies:{};
    canonical.companies.Cypher=cypher;
    canonical.internalState=canonical.internalState&&typeof canonical.internalState==='object'?canonical.internalState:{};
    const promotedState=promoted?.internalState||{};
    for(const key of ['historicalVoteCache','directVeRewardIndex']){
      canonical.internalState[key]={...(canonical.internalState[key]||{}),...(promotedState[key]||{})};
    }
    canonical.engineErrors=canonical.engineErrors&&typeof canonical.engineErrors==='object'?canonical.engineErrors:{};
    for(const key of Object.keys(canonical.engineErrors))if(key==='Cypher'||key.startsWith('Cypher:'))delete canonical.engineErrors[key];
    writeJson(DATA,canonical);

    const summary={
      status:'promoted-through-existing-generic-engine',
      company:'Cypher',
      wallet:WALLET,
      routes:['aerodrome-ve','velodrome-ve-direct'],
      genericEngineVersion:promoted.version||null,
      genericCollectorVersion:promoted.collectorVersion||null,
      directVeRewardIndexCount:Object.keys(promotedState.directVeRewardIndex||{}).length,
      executionAuthority:'none'
    };
    console.log('Company #010 generic ve promotion PASS',summary);
    return summary;
  }finally{
    fs.rmSync(tempDir,{recursive:true,force:true});
  }
}

if(import.meta.url===`file://${process.argv[1]}`){
  try{promoteCypherThroughGenericRewards();}
  catch(error){console.error(error);process.exitCode=1;}
}
