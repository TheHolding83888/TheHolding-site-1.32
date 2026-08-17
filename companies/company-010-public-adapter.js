/* The Holding · Company #010 Cypher public adapter · v0.8-strategy-rewards-polish
 * Compatibility sentinel: preserves v0.6.4 GMX compact APY and v0.6 Stake DAO native surface contracts.
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

  function gmxCompactLabel(){
    const strategies=Array.isArray(state?.strategies?.gmx?.strategies)?state.strategies.gmx.strategies:[];
    const eth=strategies.find(x=>x.id==='gmx-gm-eth-usdc');
    const btc=strategies.find(x=>x.id==='gmx-gm-btc-usdc');
    const ethApy=Number(eth?.yield?.referenceAprPct),btcApy=Number(btc?.yield?.referenceAprPct);
    if(!eth||!btc||!Number.isFinite(ethApy)||!Number.isFinite(btcApy))return null;
    if(eth.yield?.referenceMetric!=='GMX 30D Fee APY'||btc.yield?.referenceMetric!=='GMX 30D Fee APY')return null;
    if(eth.yield?.incomeMode!=='embedded-in-gm-nav'||btc.yield?.incomeMode!=='embedded-in-gm-nav'||eth.yield?.claimableApplicable!==false||btc.yield?.claimableApplicable!==false)return null;
    return `GMX · ETH-USDC / BTC-USDC · APY ${pct2(ethApy)} / ${pct2(btcApy)}`;
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
      const walker=document.createTreeWalker(card,NodeFilter.SHOW_TEXT);
      let node;while((node=walker.nextNode())){if(node.nodeValue?.trim()==='Balance Sheet')node.nodeValue=node.nodeValue.replace('Balance Sheet','Balance Sheet · Strategies.');}
    }
  }

  function strategyAprLabel(strategy){return finite(strategy?.yield?.referenceAprPct)?`APR ${pct2(strategy.yield.referenceAprPct)}`:'APR Pending';}

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
    const compactLabel=gmxCompactLabel();
    if(gmxEth&&gmxBtc&&gmxValue>0&&compactLabel){
      const symbol=gmxEth.querySelector('.ipx-position-symbol');
      const qty=gmxEth.querySelector('.ipx-position-qty');
      if(symbol)symbol.textContent=compactLabel;
      if(qty)qty.textContent=money2(gmxValue);
      gmxEth.dataset.cypherDisplay='gmx-combined-apy';
      gmxBtc.remove();
    }

    const crvStrategies=state.strategies?.crv?.strategies||[];
    const conc=crvStrategies.find(x=>x.id==='concentrator-asdcrv');
    const cvx=crvStrategies.find(x=>x.id==='convex-staked-cvxcrv');
    const concPill=byLabel('Concentrator');
    const cvxPill=byLabel('Convex · staked cvxCRV');
    if(concPill&&conc){const symbol=concPill.querySelector('.ipx-position-symbol');if(symbol)symbol.textContent=`Concentrator · sdCRV · ${strategyAprLabel(conc)}`;concPill.dataset.cypherDisplay='concentrator-apr';}
    if(cvxPill&&cvx){const symbol=cvxPill.querySelector('.ipx-position-symbol');if(symbol)symbol.textContent=`Convex · staked cvxCRV · ${strategyAprLabel(cvx)}`;cvxPill.dataset.cypherDisplay='convex-cvxcrv-apr';}
  }

  function ensureCrvIncomeStyles(){
    if(document.getElementById('cypher-crv-income-style'))return;
    const s=document.createElement('style');s.id='cypher-crv-income-style';s.textContent=`
      .cy-crv-income{margin-top:.65rem;padding-top:.62rem;border-top:1px solid rgba(22,21,15,.10)}
      .cy-crv-income-head{font-size:.54rem;letter-spacing:.13em;text-transform:uppercase;color:rgba(22,21,15,.38);margin-bottom:.38rem}
      .cy-crv-income-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:.65rem;align-items:center;padding:.43rem 0;border-top:1px solid rgba(22,21,15,.06)}
      .cy-crv-income-row:first-of-type{border-top:0}.cy-crv-income-name{font-size:.62rem;color:rgba(22,21,15,.72)}
      .cy-crv-income-meta{font-size:.55rem;color:rgba(22,21,15,.42);margin-top:.08rem}.cy-crv-income-right{text-align:right;white-space:nowrap}
      .cy-crv-income-rate{font-size:.66rem;font-weight:500;color:#16150f}.cy-crv-income-state{display:inline-block;margin-top:.1rem;font-size:.49rem;letter-spacing:.07em;text-transform:uppercase;color:rgba(22,21,15,.42)}
      .cy-crv-income-state.compounded{color:#0a7c4e}.cy-crv-income-state.claimable{color:rgba(22,21,15,.48)}.cy-crv-income-state.pending{color:#a8842c}
    `;document.head.appendChild(s);
  }

  function compactClaimable(strategy){
    const rows=[];
    for(const w of strategy?.claimable?.wallets||[])for(const r of w.rewards||[])if(finite(r.amount)&&Number(r.amount)>0)rows.push(r);
    if(!rows.length)return lang()==='ru'?'Сейчас нет положительного начисления':'No positive accrued balance now';
    const grouped=new Map();for(const r of rows){const k=r.symbol||'Reward',v=grouped.get(k)||{amount:0,usd:0,usdOk:true};v.amount+=Number(r.amount)||0;if(finite(r.usdValue))v.usd+=Number(r.usdValue);else v.usdOk=false;grouped.set(k,v)}
    return [...grouped.entries()].slice(0,3).map(([sym,v])=>`${v.amount.toLocaleString('en-US',{maximumFractionDigits:4})} ${sym}${v.usdOk?' · '+money2(v.usd):''}`).join(' / ');
  }

  function ensureCrvStrategyIncome(){
    const crv=state?.strategies?.crv;
    if(crv?.version!=='0.1-company-010-crv-strategy-intelligence'||!Array.isArray(crv.strategies)||crv.strategies.length!==2)return;
    const conc=crv.strategies.find(x=>x.id==='concentrator-asdcrv');
    const cvx=crv.strategies.find(x=>x.id==='convex-staked-cvxcrv');
    if(!conc||!cvx||conc.yield?.incomeMode!=='auto-compounded'||cvx.yield?.incomeMode!=='separate-claimable-rewards')return;
    const item=document.querySelector('.ib-item[data-nm="Cypher"]');
    const panel=item?.querySelector('.ipx-rewards-panel');
    if(!panel)return;
    ensureCrvIncomeStyles();
    panel.querySelector('.cy-crv-income')?.remove();
    const block=document.createElement('div');block.className='cy-crv-income';block.dataset.cypherCrvIncome='true';
    const concApr=finite(conc.yield.referenceAprPct)?pct2(conc.yield.referenceAprPct):null;
    const cvxApr=finite(cvx.yield.referenceAprPct)?pct2(cvx.yield.referenceAprPct):null;
    const pending=lang()==='ru'?'Ожидается':'Pending';
    block.innerHTML=`
      <div class="cy-crv-income-head">${lang()==='ru'?'CRV · доходные стратегии':'CRV · strategy income'}</div>
      <div class="cy-crv-income-row"><div><div class="cy-crv-income-name">Concentrator · sdCRV</div><div class="cy-crv-income-meta">${lang()==='ru'?'Доход автоматически увеличивает стоимость доли':'Yield is automatically reinvested into the share'}</div></div><div class="cy-crv-income-right"><div class="cy-crv-income-rate">APR ${concApr||pending}</div><span class="cy-crv-income-state compounded">Compounded</span></div></div>
      <div class="cy-crv-income-row"><div><div class="cy-crv-income-name">Convex · staked cvxCRV</div><div class="cy-crv-income-meta">${compactClaimable(cvx)}</div></div><div class="cy-crv-income-right"><div class="cy-crv-income-rate">APR ${cvxApr||pending}</div><span class="cy-crv-income-state claimable">Claimable</span></div></div>`;
    panel.appendChild(block);
  }

  function compactVeAmount(route,stateName){
    const c=rewardsData?.companies?.Cypher;
    if(!c)return '';
    if(stateName==='Compounded'){
      const x=(c.embeddedIncome||[]).find(v=>v.route===route&&v.state==='Compounded');
      return finite(x?.amount)&&Number(x.amount)>0?`${Number(x.amount).toLocaleString('en-US',{maximumFractionDigits:4})} ${x.symbol||''}`:'';
    }
    const rows=(c.rewards||[]).filter(x=>x.route===route&&finite(x.amount)&&Number(x.amount)>0);
    if(!rows.length)return '';
    return rows.map(x=>`${Number(x.amount).toLocaleString('en-US',{maximumFractionDigits:4})} ${x.symbol||''}`).join(' / ');
  }

  function ensureVeStrategyIncome(){
    const c=rewardsData?.companies?.Cypher;
    const item=document.querySelector('.ib-item[data-nm="Cypher"]');
    const panel=item?.querySelector('.ipx-rewards-panel');
    if(!c||!panel)return;
    const routes=[['Aerodrome','aerodrome-ve'],['Velodrome','velodrome-ve-direct']];
    const resolved=routes.map(([name,route])=>{const s=(c.sources||[]).find(x=>x.route===route);return{name,route,source:s,state:s?.details?.rewardState||'Pending'};});
    ensureCrvIncomeStyles();
    panel.querySelector('.cy-ve-income')?.remove();
    const block=document.createElement('div');block.className='cy-crv-income cy-ve-income';block.dataset.cypherVeIncome='true';
    const rows=resolved.map(x=>{const valid=['Compounded','Claimable'].includes(x.state),stateName=valid?x.state:'Pending',amount=valid?compactVeAmount(x.route,stateName):'',klass=stateName==='Compounded'?'compounded':stateName==='Claimable'?'claimable':'pending';const meta=amount|| (stateName==='Compounded'?(lang()==='ru'?'Доход остаётся внутри managed veNFT':'Yield remains inside the managed veNFT'):stateName==='Claimable'?(lang()==='ru'?'Отдельно доступно к получению':'Separately claimable when accrued'):(lang()==='ru'?'Маршрут известен, измерение ожидается':'Known route · measurement pending'));return `<div class="cy-crv-income-row"><div><div class="cy-crv-income-name">${x.name} · ve${x.name==='Aerodrome'?'AERO':'VELO'}</div><div class="cy-crv-income-meta">${meta}</div></div><div class="cy-crv-income-right"><span class="cy-crv-income-state ${klass}">${stateName}</span></div></div>`;}).join('');
    block.innerHTML=`<div class="cy-crv-income-head">${lang()==='ru'?'veAERO / veVELO · доход':'veAERO / veVELO · income'}</div>${rows}`;
    panel.appendChild(block);
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
    ensureCrvStrategyIncome();
    ensureVeStrategyIncome();
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
    const observer=new MutationObserver(()=>{ensureCollectionCard();syncNetworkStats();polishPassportTitles();polishBalanceSheet();ensureCrvStrategyIncome();ensureVeStrategyIncome();if(!installed)rerenderNativeSurfaces();else markPendingPerformance();});
    observer.observe(document.documentElement,{attributes:true,attributeFilter:['lang','class']});
  }

  const run=()=>start().catch(err=>console.error('[Company #010 native public adapter]',err));
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run,{once:true});else run();
})();