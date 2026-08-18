/* The Holding · Company #010 Cypher public adapter · v0.9-global-strategy-rate-badges · v0.9.1-right-centered-strategy-rate-badges · v0.9.2-mobile-two-row-strategy-rate-badges · v0.10-unified-rewards-gmx-apy-capsule · v0.10.1-known-mechanism-compounded-usd-parity
 * Compatibility sentinel: preserves v0.6 Stake DAO native surface contracts while promoting GMX APY into the shared capsule vocabulary.
 * Productive-position badges are presentation-only projections of canonical Productivity breakdowns; reserve assets stay unbadged.
 * Mobile Passport canon: productive cards use title on row one, value bottom-left and APR/APY capsule bottom-right; desktop keeps right-centered capsules unchanged.
 * Rewards Drawer canon: one ledger, one row per strategy/reward state; no duplicate CRV or veAERO/veVELO sub-ledgers.
 * Known-mechanism parity: measured Compounded ve income preserves token amount + current USD valuation when canonical pricing exists; embedded USD is informational and excluded from claimable totals.
 * CRV-family wrappers are separate economic positions: direct CRV, Concentrator asdCRV/sdCRV and Convex staked cvxCRV are never summed as one token quantity.
 * Concentrator income is Compounded; Convex staked cvxCRV income is Claimable; an unproven rate is APR Pending, never a fake 0%.
 * veAERO / veVELO public reward state is read from current Company #010 rewards-data semantics, never inferred from another company.
 * GMX pool composition remains canonical diagnostic state and is not rendered publicly. GM token NAV is counted once; LP fee income is embedded in GM NAV and has no separate claim step.
 * Combined TVL compatibility sentinel: net.networkTvlUsd!==null&&net.networkTvlUsd!==undefined remains enforced through canonicalNetworkTvl().
 * Canonical source: /companies/company-010-production-state.json
 * Presentation: native Collection + General Index/Passport/Graph surfaces.
 * Capital completeness, Productivity coverage and Performance evidence remain separate contracts.
 */
(() => {
  'use strict';

  const STATE_URL='/companies/company-010-production-state.json';
  const PRODUCTIVITY_URL='/companies/productivity-data.json';
  const CAPITAL_URL='/intelligence/capital-state/capital-state.json';
  const REWARDS_URL='/companies/rewards-data.json';
  const ENTRY=Object.freeze({BTC:73482,ETH:2476,HYPE:38.62,CVX:1.84,CRV:0.228,AERO:0.60,LDO:0.8408,VELO:0.04762});
  const UNIQUE_INDEX_GREENS=Object.freeze(['#183F34','#244B3F','#315748','#40634F','#506F54','#637B59','#788861','#8E966C','#A4A77A','#B9B88B']);
  const CYPHER_PRODUCTIVITY_ID=Object.freeze({
    'aerodrome-finance':'aerodrome_veaero',
    'velodrome-finance':'velodrome_vevelo',
    'stakedao-base-curve-4pool':'stakedao_base_curve_4pool',
    'concentrator-asdcrv':'concentrator_asdcrv',
    'convex-staked-cvxcrv':'convex_staked_cvxcrv'
  });
  let state=null,productivity=null,rewardsData=null,installed=false,indexColorHooked=false;

  const lang=()=> (document.documentElement.lang||'en').toLowerCase().startsWith('ru')?'ru':'en';
  const money=v=>'$'+Math.round(Number(v)||0).toLocaleString('en-US');
  const money2=v=>'$'+Number(v||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
  const pct=v=>Number(v).toFixed(1)+'%';
  const pct2=v=>Number(v).toFixed(2)+'%';
  const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));

  function protocols(){
    const p=['Bitcoin','Ethereum','Aave','Hyperliquid','Project X','Convex','Curve','Stake DAO','Aerodrome','Velodrome','GMX','Concentrator'];
    if((state?.capital?.positions||[]).some(x=>x.protocol==='HyperLend'||String(x.assetId||'').startsWith('hyperlend-')))p.splice(5,0,'HyperLend');
    return p;
  }

  function currentReferenceApr(){
    if(!state)return null;
    let covered=0,weighted=0;
    for(const p of state.productivity?.positions||[]){
      let apr=null;
      if(p.status==='measured'&&Number.isFinite(Number(p.referenceAprPct)))apr=Number(p.referenceAprPct);
      if(p.status==='supported-existing-adapter'){
        const live=productivity?.engines?.[p.id]?.aprLatest;
        if(Number.isFinite(Number(live)))apr=Number(live);
      }
      if(apr===null)continue;
      const value=Number(p.valueUsd)||0;covered+=value;weighted+=value*apr;
    }
    return covered>0?weighted/covered:null;
  }

  function cardCopy(){return lang()==='ru'
    ?'Компания The Holding Standard с резервным капиталом и продуктивными позициями в Aave, Stake DAO, HyperLend, Convex, Aerodrome, Velodrome, GMX, Project X и Concentrator.'
    :'A The Holding Standard company combining reserve capital with productive positions across Aave, Stake DAO, HyperLend, Convex, Aerodrome, Velodrome, GMX, Project X and Concentrator.';}

  function canonicalNetworkTvl(){
    const net=window.__TH_CAPITAL_STATE__?.network;
    if(!net)return null;
    const value=net.networkTvlUsd;
    return value!==null&&value!==undefined&&Number.isFinite(Number(value))?Number(value):null;
  }

  function syncNetworkStats(){
    const net=window.__TH_CAPITAL_STATE__?.network;
    if(!net)return;
    const exact=canonicalNetworkTvl();
    const top=document.getElementById('statTVL');
    const index=document.getElementById('idxNetworkValue');
    const display=exact!==null?money(exact):(Number.isFinite(Number(net.measuredCapitalFloorUsd))&&Number(net.measuredCapitalFloorUsd)>0?'≥ '+money(net.measuredCapitalFloorUsd):null);
    if(!display)return;
    if(top&&top.textContent!==display)top.textContent=display;
    if(index&&index.textContent!==display)index.textContent=display;
  }

  function ensureCollectionCard(){
    const placeholder=document.querySelector('.company-card.placeholder');
    if(!placeholder||!state)return;
    let card=document.querySelector('.company-card-010');
    if(!card){card=document.createElement('div');card.className='company-card company-card-010 reveal';card.dataset.category='standard';placeholder.parentNode.insertBefore(card,placeholder);}
    const apr=currentReferenceApr(),complete=state.capital?.totalCapitalComplete===true;
    card.innerHTML=`
      <div class="cc-regnum"><span><span class="cc-reg-label">${lang()==='ru'?'Реестр':'Registry'}</span> · 010</span><span class="cc-founded">${lang()==='ru'?'Осн. 4 июл 2025':'Est. Jul 4, 2025'}</span></div>
      <div class="cc-top"><div class="cc-seal"><span class="cc-seal-mark" role="img" aria-label="The Holding registry seal"></span></div><div class="cc-status"><span class="cc-dot"></span><span>Live</span></div></div>
      <div class="cc-name">Cypher</div><div class="cc-sub">${cardCopy()}</div>
      <div class="cc-metrics"><div><div class="cc-metric-label">${lang()==='ru'?'TVL компании':'Company TVL'}</div><div class="cc-metric-value gold" id="tvl-cypher">${complete?'':'≥ '}${money(complete?state.capital.totalCapitalUsd:state.capital.knownCapitalFloorUsd)}</div></div><div><div class="cc-metric-label">APR</div><div class="cc-metric-value" id="apr-cypher">${apr===null?(lang()==='ru'?'Ожидается':'Pending'):pct(apr)}</div></div></div>
      <span class="cc-extlink cc-extlink-static" aria-disabled="true"><span class="cc-ext-label">DeBank · Tracking</span></span>`;
    card.style.opacity='1';card.style.transform='none';
    const count=document.getElementById('companyCount');if(count)count.textContent='10';
    const stat=document.getElementById('statCompanies');if(stat)stat.textContent='10';
    syncNetworkStats();
  }

  function stakeDaoLabel(){return 'Stake DAO · 4pool stables';}

  function gmxCompactState(){
    const strategies=Array.isArray(state?.strategies?.gmx?.strategies)?state.strategies.gmx.strategies:[];
    const eth=strategies.find(x=>x.id==='gmx-gm-eth-usdc');
    const btc=strategies.find(x=>x.id==='gmx-gm-btc-usdc');
    const ethApy=Number(eth?.yield?.referenceAprPct),btcApy=Number(btc?.yield?.referenceAprPct);
    if(!eth||!btc||!Number.isFinite(ethApy)||!Number.isFinite(btcApy))return null;
    if(eth.yield?.referenceMetric!=='GMX 30D Fee APY'||btc.yield?.referenceMetric!=='GMX 30D Fee APY')return null;
    if(eth.yield?.incomeMode!=='embedded-in-gm-nav'||btc.yield?.incomeMode!=='embedded-in-gm-nav'||eth.yield?.claimableApplicable!==false||btc.yield?.claimableApplicable!==false)return null;
    return {label:'GMX · ETH-USDC / BTC-USDC',apy:`${pct2(ethApy)} / ${pct2(btcApy)}`};
  }

  function installRuntimeBook(){
    if(!state)return;
    if(typeof COMPANY_PROTOCOLS!=='undefined')COMPANY_PROTOCOLS.Cypher=protocols();
    if(typeof COMPANY_REWARDS_SCOPE!=='undefined'&&COMPANY_REWARDS_SCOPE?.add)COMPANY_REWARDS_SCOPE.add('Cypher');
    if(typeof COMPANY_ASSET_LABELS!=='undefined'){
      Object.assign(COMPANY_ASSET_LABELS,{hyperliquid:'HYPE','lido-dao':'LDO','convex-crv':'cvxCRV','concentrator-asdcrv':'Concentrator · sdCRV','convex-staked-cvxcrv':'Convex · staked cvxCRV','gmx-gm-eth-usdc':'GMX · ETH-USDC','gmx-gm-btc-usdc':'GMX · BTC-USDC'});
      for(const p of state.capital?.positions||[]){
        if(String(p.assetId||'').startsWith('hyperlend-'))COMPANY_ASSET_LABELS[p.assetId]=`HyperLend · ${p.underlyingSymbol||p.symbol||'Position'}`;
        if(p.assetId==='stakedao-base-curve-4pool')COMPANY_ASSET_LABELS[p.assetId]=stakeDaoLabel();
        const wstEth=Number(p.components?.aaveArbitrumWstEth);
        if(p.assetId==='ethereum'&&Number.isFinite(wstEth)&&wstEth>0)COMPANY_ASSET_LABELS['cypher-eth-equivalent']=`ETH (${wstEth.toFixed(6)} wstETH)`;
      }
    }
    if(typeof COMPANY_BOOK!=='undefined')COMPANY_BOOK.Cypher=(state.capital?.positions||[]).map(p=>{
      const underlying=String(p.underlyingSymbol||'').toUpperCase();
      const symbol=String(p.symbol||'');
      const entry=ENTRY[symbol]??ENTRY[underlying]??null;
      const wstEth=Number(p.components?.aaveArbitrumWstEth);
      const displayId=p.assetId==='ethereum'&&Number.isFinite(wstEth)&&wstEth>0?'cypher-eth-equivalent':(p.assetId||symbol.toLowerCase());
      return{id:displayId,qty:Number(p.quantity)||0,entry,costBasisUsd:entry!==null?(Number(p.quantity)||0)*entry:null,fixed:Number(p.priceUsd)||0};
    });
  }

  function cypherIndexRecord(){
    const apr=currentReferenceApr(),coverage=Number(state.productivity?.coverage||0)*100;
    const complete=state.capital?.totalCapitalComplete===true;
    const performancePending=state.performance?.complete!==true;
    return{nm:'Cypher',displayName:'Cypher',val:Number(complete?state.capital.totalCapitalUsd:state.capital.knownCapitalFloorUsd)||0,cost:null,pnl:null,pct:null,performancePending,href:null,indexEligible:complete,capitalFloor:!complete,capitalComplete:complete,cat:{en:complete?'Bitcoin Standard':'Bitcoin Standard · measured floor',ru:complete?'Bitcoin Standard':'Bitcoin Standard · измеренный минимум'},since:{en:'Jul 2025',ru:'Июл 2025'},reg:'010',foundedISO:'2025-07-04',founded:{en:'Jul 4, 2025',ru:'4 июл 2025'},arch:{en:'The Holding Standard',ru:'The Holding Standard'},protocols:protocols().length,status:{en:complete?'Productive':'Pending capital completion',ru:complete?'Активна':'Ожидает закрытия капитала'},aprNumeric:apr??0,aprLatest:apr,aprDisplay:{en:apr===null?'Pending':`${apr.toFixed(1)}% · ${coverage.toFixed(1)}% covered`,ru:apr===null?'Ожидается':`${apr.toFixed(1)}% · покрыто ${coverage.toFixed(1)}%`},aprSource:'canonical-company-state',aprObservationCount:0,pendingReason:complete?null:{en:'An in-scope capital mechanism is not yet fully bound',ru:'Один из учитываемых механизмов капитала ещё не полностью связан'}};
  }

  function installIndexRecord(){
    if(!state||typeof INDEX_STATE==='undefined'||!Array.isArray(INDEX_STATE))return false;
    installRuntimeBook();
    const existing=INDEX_STATE.find(c=>c&&c.nm==='Cypher'),next=cypherIndexRecord();
    if(existing)Object.assign(existing,next);else INDEX_STATE.push(next);
    return true;
  }

  function hookUniqueIndexColors(){
    if(indexColorHooked||typeof computeIndex!=='function')return false;
    const originalCompute=computeIndex;
    computeIndex=function(...args){
      const list=originalCompute.apply(this,args);
      const composite=list.slice().sort((a,b)=>(b.weight||0)-(a.weight||0));
      composite.forEach((c,i)=>{c.color=UNIQUE_INDEX_GREENS[Math.min(i,UNIQUE_INDEX_GREENS.length-1)];});
      return list;
    };
    indexColorHooked=true;
    return true;
  }

  function polishPassportTitles(){
    for(const card of document.querySelectorAll('.ipx-balance-card')){
      const kicker=card.querySelector('.ipx-ledger-kicker');
      if(kicker)kicker.textContent=lang()==='ru'?'Баланс · Стратегии':'Balance Sheet · Strategies';
    }
  }

  function ensureStrategyRateStyles(){
    if(document.getElementById('passport-strategy-rate-style'))return;
    const s=document.createElement('style');s.id='passport-strategy-rate-style';s.textContent=`
      .ipx-position-pill.has-strategy-rate{position:relative;padding-right:5.45rem}
      .ipx-strategy-rate-badge{position:absolute;right:.58rem;top:50%;transform:translateY(-50%);display:inline-flex;align-items:center;justify-content:center;gap:.22rem;min-height:23px;margin:0;padding:.18rem .52rem;border-radius:999px;border:1px solid rgba(22,21,15,.10);background:rgba(22,21,15,.035);color:rgba(22,21,15,.52);font-size:.50rem;line-height:1;font-weight:600;letter-spacing:.015em;font-variant-numeric:tabular-nums;white-space:nowrap;box-shadow:inset 0 1px 0 rgba(255,255,255,.72)}
      .ipx-strategy-rate-badge strong{color:#0a7c4e;font-weight:650}.ipx-strategy-rate-badge.pending strong{color:#8f7430}
      .ipx-strategy-rate-badge.gmx-multi{padding-left:.58rem;padding-right:.58rem}
      @media(max-width:760px){
        .ipx-position-pill.has-strategy-rate{display:grid;grid-template-columns:minmax(0,1fr) auto;grid-template-rows:auto auto;column-gap:.34rem;row-gap:.16rem;align-items:end;min-height:52px;padding:.38rem .44rem .34rem}
        .ipx-position-pill.has-strategy-rate .ipx-position-symbol{grid-column:1 / -1;grid-row:1;min-width:0;max-width:100%;white-space:normal;overflow-wrap:anywhere;padding:0}
        .ipx-position-pill.has-strategy-rate .ipx-position-qty{grid-column:1;grid-row:2;min-width:0;align-self:end;padding:0}
        .ipx-position-pill.has-strategy-rate .ipx-strategy-rate-badge{position:static;grid-column:2;grid-row:2;justify-self:end;align-self:end;right:auto;top:auto;transform:none;min-height:21px;margin:0;font-size:.45rem;padding:.16rem .44rem}
      }
    `;document.head.appendChild(s);
  }

  function productiveBreakdown(nm){return Array.isArray(productivity?.companies?.[nm]?.breakdown)?productivity.companies[nm].breakdown:[];}

  function rateForPosition(nm,pos){
    if(!pos||pos.productivityOnly)return null;
    const allBook=typeof COMPANY_BOOK!=='undefined'?(COMPANY_BOOK[nm]||[]):[];
    if(allBook.some(x=>x&&x.productivityOnly===true&&x.id===pos.id))return null;
    if(nm==='Cypher'){
      if(pos.id==='bitcoin'||pos.id==='cypher-eth-equivalent'||pos.id==='ethereum'||pos.id==='hyperliquid'||pos.id==='convex-finance'||pos.id==='curve-dao-token'||pos.id==='lido-dao')return null;
      if(String(pos.id).startsWith('gmx-gm-'))return null;
    }
    const principal=nm==='Cypher'?(CYPHER_PRODUCTIVITY_ID[pos.id]||pos.id):pos.id;
    const row=productiveBreakdown(nm).find(x=>x&&x.principalId===principal);
    if(!row)return null;
    const engine=productivity?.engines?.[row.engineId];
    const metric=String(engine?.sourceMetric||'');
    const kind=/\bAPY\b/i.test(metric)?'APY':'APR';
    return {kind,value:finite(row.apr)?Number(row.apr):null,pending:!finite(row.apr),engineStatus:row.engineStatus||null};
  }

  function ensureStrategyRateBadges(){
    if(!productivity||typeof COMPANY_BOOK==='undefined')return;
    ensureStrategyRateStyles();
    for(const item of document.querySelectorAll('.ib-item[data-nm]')){
      const nm=item.dataset.nm;
      const book=(COMPANY_BOOK[nm]||[]).filter(pos=>!pos.productivityOnly);
      const pills=[...item.querySelectorAll('.ipx-balance-card .ipx-position-pill')];
      for(const pill of pills){pill.classList.remove('has-strategy-rate');pill.querySelector('.ipx-strategy-rate-badge')?.remove();}
      for(const pos of book){
        const rate=rateForPosition(nm,pos);if(!rate)continue;
        const expected=typeof COMPANY_ASSET_LABELS!=='undefined'?(COMPANY_ASSET_LABELS[pos.id]||pos.id):pos.id;
        const pill=pills.find(p=>String(p.querySelector('.ipx-position-symbol')?.textContent||'').includes(expected));
        if(!pill)continue;
        pill.classList.add('has-strategy-rate');
        const badge=document.createElement('span');badge.className='ipx-strategy-rate-badge'+(rate.pending?' pending':'');
        badge.innerHTML=rate.pending?`<span>${rate.kind}</span><strong>Pending</strong>`:`<span>${rate.kind}</span><strong>${pct2(rate.value)}</strong>`;
        pill.appendChild(badge);
      }
    }
  }

  function polishBalanceSheet(){
    if(!state)return;
    polishPassportTitles();
    const item=document.querySelector('.ib-item[data-nm="Cypher"]');
    if(!item)return;
    let pills=[...item.querySelectorAll('.ipx-balance-card .ipx-position-pill')];
    if(!pills.length)return;
    const byLabel=needle=>pills.find(p=>String(p.querySelector('.ipx-position-symbol')?.textContent||'').includes(needle));

    const falseVeCrv=byLabel('veCRV');
    if(falseVeCrv){falseVeCrv.remove();pills=pills.filter(x=>x!==falseVeCrv);}

    const stake=byLabel('Stake DAO');
    const stakePosition=(state.capital?.positions||[]).find(p=>p.assetId==='stakedao-base-curve-4pool');
    if(stake&&stakePosition){
      const symbol=stake.querySelector('.ipx-position-symbol');
      const qty=stake.querySelector('.ipx-position-qty');
      if(symbol)symbol.textContent=stakeDaoLabel();
      if(qty)qty.textContent=money2(stakePosition.valueUsd);
      stake.dataset.cypherDisplay='stakedao-combined';
    }

    const gmxEth=byLabel('GMX · ETH-USDC');
    const gmxBtc=byLabel('GMX · BTC-USDC');
    const gmxPositions=(state.capital?.positions||[]).filter(p=>p.assetId==='gmx-gm-eth-usdc'||p.assetId==='gmx-gm-btc-usdc');
    const gmxValue=gmxPositions.reduce((s,p)=>s+(Number(p.valueUsd)||0),0);
    const compact=gmxCompactState();
    if(gmxEth&&gmxBtc&&gmxValue>0&&compact){
      const symbol=gmxEth.querySelector('.ipx-position-symbol');
      const qty=gmxEth.querySelector('.ipx-position-qty');
      if(symbol)symbol.textContent=compact.label;
      if(qty)qty.textContent=money2(gmxValue);
      gmxEth.dataset.cypherDisplay='gmx-combined-apy-capsule';
      gmxBtc.remove();
    }

    const crvStrategies=state.strategies?.crv?.strategies||[];
    const conc=crvStrategies.find(x=>x.id==='concentrator-asdcrv');
    const cvx=crvStrategies.find(x=>x.id==='convex-staked-cvxcrv');
    const concPill=byLabel('Concentrator');
    const cvxPill=byLabel('Convex · staked cvxCRV');
    if(concPill&&conc)concPill.dataset.cypherDisplay='concentrator-apr';
    if(cvxPill&&cvx)cvxPill.dataset.cypherDisplay='convex-cvxcrv-apr';
  }

  function ensureGmxApyCapsule(){
    const item=document.querySelector('.ib-item[data-nm="Cypher"]');
    const compact=gmxCompactState();
    if(!item||!compact)return;
    ensureStrategyRateStyles();
    const pill=[...item.querySelectorAll('.ipx-balance-card .ipx-position-pill')].find(p=>String(p.querySelector('.ipx-position-symbol')?.textContent||'').includes(compact.label));
    if(!pill)return;
    pill.classList.add('has-strategy-rate');
    pill.querySelector('.ipx-strategy-rate-badge')?.remove();
    const badge=document.createElement('span');badge.className='ipx-strategy-rate-badge gmx-multi';
    badge.innerHTML=`<span>APY</span><strong>${compact.apy}</strong>`;
    pill.appendChild(badge);
  }

  function ensureUnifiedRewardStyles(){
    if(document.getElementById('cypher-unified-reward-style'))return;
    const s=document.createElement('style');s.id='cypher-unified-reward-style';s.textContent=`
      .ipx-reward-row.cy-strategy-state-row .ipx-reward-state.pending{color:#8f7430;background:rgba(168,132,44,.055);border-color:rgba(168,132,44,.12)}
      .ipx-reward-row.cy-strategy-state-row .ipx-reward-state.compounded{color:#7a651f}
      .ipx-reward-row.cy-strategy-state-row .ipx-reward-usd{max-width:12rem}
    `;document.head.appendChild(s);
  }

  function rewardPanel(){return document.querySelector('.ib-item[data-nm="Cypher"] .ipx-rewards-panel');}
  function panelHasStrategy(panel,label){return [...panel.querySelectorAll('.ipx-reward-protocol')].some(x=>String(x.textContent||'').includes(label));}
  function embeddedRoute(route){return (rewardsData?.companies?.Cypher?.embeddedIncome||[]).find(x=>x.route===route&&x.state==='Compounded');}
  function rewardSource(route){return (rewardsData?.companies?.Cypher?.sources||[]).find(x=>x.route===route);}
  function compactEmbeddedAmount(route){
    const x=embeddedRoute(route);
    if(!finite(x?.amount)||Number(x.amount)<=0)return {amount:'',usd:''};
    return {
      amount:`${Number(x.amount).toLocaleString('en-US',{maximumFractionDigits:4})} ${x.symbol||''}`,
      usd:finite(x.usdValue)?money2(x.usdValue):''
    };
  }

  function appendStrategyStateRow(panel,{label,meta,stateName,amount='',amountMeta=''}){
    if(panelHasStrategy(panel,label))return;
    const row=document.createElement('div');row.className='ipx-reward-row cy-strategy-state-row';row.dataset.cypherUnifiedStrategy=label;
    const klass=stateName==='Compounded'?' compounded':stateName==='Pending'?' pending':'';
    row.innerHTML=`<div><div class="ipx-reward-protocol">${label}<span class="ipx-reward-state${klass}">${stateName}</span></div><div class="ipx-reward-meta">${meta}</div></div><div class="ipx-reward-right"><div class="ipx-reward-amount">${amount||'—'}</div>${amountMeta?`<div class="ipx-reward-usd">${amountMeta}</div>`:''}</div>`;
    const note=panel.querySelector('.ipx-reward-panel-note');
    if(note)panel.insertBefore(row,note);else panel.appendChild(row);
  }

  function ensureUnifiedStrategyRewards(){
    const panel=rewardPanel(),c=rewardsData?.companies?.Cypher;
    if(!panel||!c)return;
    ensureUnifiedRewardStyles();
    panel.querySelector('.cy-crv-income')?.remove();
    panel.querySelector('.cy-ve-income')?.remove();
    panel.querySelectorAll('.cy-strategy-state-row').forEach(x=>x.remove());

    const crv=state?.strategies?.crv;
    const conc=crv?.strategies?.find(x=>x.id==='concentrator-asdcrv');
    if(conc?.yield?.incomeMode==='auto-compounded'){
      appendStrategyStateRow(panel,{label:'Concentrator · sdCRV',meta:lang()==='ru'?'Доход автоматически реинвестируется в долю':'Yield is automatically reinvested into the share',stateName:'Compounded',amount:lang()==='ru'?'В доле':'Embedded',amountMeta:finite(conc.yield.referenceAprPct)?`APR ${pct2(conc.yield.referenceAprPct)}`:'APR Pending'});
    }

    for(const [name,route,symbol] of [['Aerodrome','aerodrome-ve','AERO'],['Velodrome','velodrome-ve-direct','VELO']]){
      const source=rewardSource(route),rawState=source?.details?.rewardState;
      const stateName=['Compounded','Claimable'].includes(rawState)?rawState:'Pending';
      if(stateName==='Claimable'&&panelHasStrategy(panel,name))continue;
      const embedded=stateName==='Compounded'?compactEmbeddedAmount(route):{amount:'',usd:''};
      const meta=stateName==='Compounded'
        ? (lang()==='ru'?'Доход остаётся внутри managed veNFT':'Yield remains inside the managed veNFT')
        : stateName==='Claimable'
          ? (lang()==='ru'?'Отдельно доступно к получению':'Separately claimable when accrued')
          : (lang()==='ru'?'Маршрут известен · измерение ожидается':'Known route · measurement pending');
      const amountMeta=stateName==='Compounded'?(embedded.usd?`Embedded income · ${embedded.usd}`:'Embedded income'):'';
      appendStrategyStateRow(panel,{label:`${name} · ve${symbol}`,meta,stateName,amount:embedded.amount||'—',amountMeta});
    }
  }

  function markPendingPerformance(){
    if(state?.performance?.complete===true)return;
    const item=document.querySelector('.ib-item[data-nm="Cypher"]');
    if(!item)return;
    item.dataset.performancePending='true';
    const pending=lang()==='ru'?'Ожидается':'Pending';
    const factor=item.querySelector('.ipx-factor.f-perf');
    if(factor){
      const value=factor.querySelector('.ipx-f-val');
      if(value)value.textContent=pending;
      const note=factor.querySelector('.ipx-f-note');
      if(note)note.textContent=lang()==='ru'?'Performance ещё не имеет полного подтверждённого cost basis. Для Composite используется нейтральный prior, а не наблюдаемая доходность.':'Performance does not yet have a complete verified cost basis. Composite uses a neutral prior here, not an observed return.';
      factor.setAttribute('data-performance-pending','true');
    }
  }

  function postRenderPolish(){
    ensureCollectionCard();
    syncNetworkStats();
    polishPassportTitles();
    polishBalanceSheet();
    ensureStrategyRateBadges();
    ensureGmxApyCapsule();
    ensureUnifiedStrategyRewards();
    markPendingPerformance();
  }

  function hookRender(){
    if(installed||typeof renderIndex!=='function')return false;
    hookUniqueIndexColors();
    const original=renderIndex;
    renderIndex=function(...args){if(state)installIndexRecord();const out=original.apply(this,args);postRenderPolish();return out;};
    installed=true;return true;
  }

  function rerenderNativeSurfaces(){
    hookUniqueIndexColors();
    hookRender();
    if(!installIndexRecord())return false;
    ensureCollectionCard();syncNetworkStats();
    if(typeof renderIndex==='function')renderIndex(typeof idxLang==='function'?idxLang():lang());
    postRenderPolish();
    if(typeof buildGraph==='function')buildGraph();
    return true;
  }

  async function start(){
    const[stateRes,prodRes,capitalRes,rewardsRes]=await Promise.all([fetch(STATE_URL,{cache:'no-store'}),fetch(PRODUCTIVITY_URL,{cache:'no-store'}).catch(()=>null),fetch(CAPITAL_URL,{cache:'no-store'}).catch(()=>null),fetch(REWARDS_URL,{cache:'no-store'}).catch(()=>null)]);
    if(!stateRes.ok)throw new Error('Cypher canonical state unavailable: '+stateRes.status);
    state=await stateRes.json();productivity=prodRes?.ok?await prodRes.json():null;window.__TH_CAPITAL_STATE__=capitalRes?.ok?await capitalRes.json():null;rewardsData=rewardsRes?.ok?await rewardsRes.json():null;
    if(state.company?.registry!=='010'||state.company?.name!=='Cypher')throw new Error('Cypher identity mismatch');
    if(state.authority?.executionAuthority!=='none'||state.authority?.transactions!==false)throw new Error('Cypher authority boundary drift');
    installRuntimeBook();ensureCollectionCard();syncNetworkStats();
    let attempts=0;
    const timer=setInterval(()=>{attempts+=1;if(rerenderNativeSurfaces()||attempts>600)clearInterval(timer);},100);
    rerenderNativeSurfaces();
    setInterval(syncNetworkStats,1000);
    const observer=new MutationObserver(()=>{ensureCollectionCard();syncNetworkStats();polishPassportTitles();polishBalanceSheet();ensureStrategyRateBadges();ensureGmxApyCapsule();ensureUnifiedStrategyRewards();if(!installed)rerenderNativeSurfaces();else markPendingPerformance();});
    observer.observe(document.documentElement,{attributes:true,attributeFilter:['lang','class']});
  }

  const run=()=>start().catch(err=>console.error('[Company #010 native public adapter]',err));
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run,{once:true});else run();
})();