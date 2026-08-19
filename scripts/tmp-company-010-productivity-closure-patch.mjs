import fs from 'node:fs';

function patchFile(path, transform){
  const before=fs.readFileSync(path,'utf8');
  const after=transform(before);
  if(after===before)throw new Error(`no change produced for ${path}`);
  fs.writeFileSync(path,after);
}

patchFile('companies/company-010-public-adapter.js', s=>{
  const anchor="  function rewardPanel(){return rewardItem()?.querySelector('.ipx-rewards-panel')||null;}\n";
  if(!s.includes(anchor))throw new Error('rewardPanel anchor missing');
  const helper=`${anchor}  function normalizeCypherStakeDaoRewardLabel(){\n    const item=rewardItem();if(!item)return;\n    for(const el of item.querySelectorAll('.ipx-reward-protocol')){\n      const textNode=[...el.childNodes].find(n=>n.nodeType===3&&String(n.textContent||'').trim());\n      if(textNode&&String(textNode.textContent||'').trim()==='Stake DAO')textNode.textContent='Stake DAO · 4pool stables';\n    }\n  }\n`;
  s=s.replace(anchor,helper);
  const oldPost='    ensureCollectionCard();syncNetworkStats();polishPassportTitles();normalizeDefiteaPendleSurface();polishBalanceSheet();ensureStrategyRateBadges();ensureGmxApyCapsule();ensureUnifiedStrategyRewards();syncMeasuredEarnedPresentation();markPendingPerformance();';
  const newPost='    ensureCollectionCard();syncNetworkStats();polishPassportTitles();normalizeDefiteaPendleSurface();polishBalanceSheet();ensureStrategyRateBadges();ensureGmxApyCapsule();ensureUnifiedStrategyRewards();normalizeCypherStakeDaoRewardLabel();syncMeasuredEarnedPresentation();markPendingPerformance();';
  if(!s.includes(oldPost))throw new Error('postRenderPolish anchor missing');
  s=s.replace(oldPost,newPost);
  const oldObserver='    const observer=new MutationObserver(()=>{ensureCollectionCard();syncNetworkStats();polishPassportTitles();normalizeDefiteaPendleSurface();polishBalanceSheet();ensureStrategyRateBadges();ensureGmxApyCapsule();ensureUnifiedStrategyRewards();syncMeasuredEarnedPresentation();if(!installed)rerenderNativeSurfaces();else markPendingPerformance();});';
  const newObserver='    const observer=new MutationObserver(()=>{ensureCollectionCard();syncNetworkStats();polishPassportTitles();normalizeDefiteaPendleSurface();polishBalanceSheet();ensureStrategyRateBadges();ensureGmxApyCapsule();ensureUnifiedStrategyRewards();normalizeCypherStakeDaoRewardLabel();syncMeasuredEarnedPresentation();if(!installed)rerenderNativeSurfaces();else markPendingPerformance();});';
  if(!s.includes(oldObserver))throw new Error('observer anchor missing');
  return s.replace(oldObserver,newObserver);
});

patchFile('onboarding/company-010-resolve.mjs', s=>{
  const start=s.indexOf('async function concentratorFingerprint(){');
  const end=s.indexOf('async function directLdoArbitrum(){',start);
  if(start<0||end<0)throw new Error('Concentrator function anchors missing');
  const replacement=`async function concentratorHistory(){\n  const failures=[];\n  for(const url of RPC.ethereum){\n    try{\n      const provider=new JsonRpcProvider(url,1,{staticNetwork:true});\n      if(Number((await provider.getNetwork()).chainId)!==1)throw new Error('wrong chain');\n      const compounder=new Contract(CONCENTRATOR.asdCRV,['function convertToAssets(uint256) view returns(uint256)'],provider);\n      const latestBlock=await provider.getBlock('latest');if(!latestBlock)throw new Error('latest block unavailable');\n      const one=10n**18n,currentPpsRaw=BigInt(await compounder.convertToAssets(one));\n      const target=Number(latestBlock.timestamp)-30*86400,past=await findBlockByTimestamp(provider,target);\n      const pastPpsRaw=BigInt(await compounder.convertToAssets(one,{blockTag:past.number}));\n      const days=(Number(latestBlock.timestamp)-past.timestamp)/86400,current=Number(formatUnits(currentPpsRaw,18)),old=Number(formatUnits(pastPpsRaw,18));\n      if(!(days>20&&old>0&&current>0))throw new Error('invalid historical PPS interval');\n      const apr=(Math.pow(current/old,365/days)-1)*100;\n      return{status:'measured',days:round(days,6),pastBlock:past.number,pastTimestamp:new Date(past.timestamp*1000).toISOString(),pastPpsRaw:pastPpsRaw.toString(),currentPpsRaw:currentPpsRaw.toString(),pastPpsSdCRV:round(old),currentPpsSdCRV:round(current),referenceAprPct:round(apr,6),method:'30D asdCRV share→sdCRV PPS growth, annualized; measures wrapper embedded yield in sdCRV units',historicalProvider:new URL(url).hostname,failures};\n    }catch(e){failures.push({provider:(()=>{try{return new URL(url).hostname}catch{return 'unknown'}})(),error:err(e)})}\n  }\n  return{status:'warming',days:null,pastBlock:null,pastTimestamp:null,pastPpsRaw:null,currentPpsRaw:null,referenceAprPct:null,error:'No configured Ethereum RPC returned the historical asdCRV PPS state',failures};\n}\nasync function concentratorFingerprint(){const mesh=await providerMesh('ethereum',1,async provider=>{const compounder=new Contract(CONCENTRATOR.asdCRV,['function asset() view returns(address)','function totalAssets() view returns(uint256)','function convertToAssets(uint256) view returns(uint256)','function previewRedeem(uint256) view returns(uint256)'],provider);const history=await concentratorHistory();const wallets=[];for(const w of WALLETS){const direct=await erc20State(provider,CONCENTRATOR.asdCRV,w.address),gauge=await erc20State(provider,CONCENTRATOR.gaugeWrapper,w.address),shares=BigInt(direct.balanceRaw||0)+BigInt(gauge.balanceRaw||0);let underlying=0n;if(shares>0n)underlying=BigInt(await compounder.convertToAssets(shares));wallets.push({wallet:w.address,walletAlias:w.alias,directAsdCRV:direct,gaugeWrapper:gauge,aggregateSharesRaw:shares.toString(),aggregateShares:round(Number(formatUnits(shares,direct.decimals||18))),sdCRVUnderlyingRaw:underlying.toString(),sdCRVUnderlying:round(Number(formatUnits(underlying,18)))})}return{contracts:CONCENTRATOR,asset:getAddress(await compounder.asset()),totalAssetsRaw:String(await compounder.totalAssets()),history,wallets}});return{source:'AladdinDAO official deployed Concentrator addresses + Ethereum onchain current/historical read-only probes',...mesh}}\n`;
  return s.slice(0,start)+replacement+s.slice(end);
});

console.log('Company #010 productivity closure patch applied');
