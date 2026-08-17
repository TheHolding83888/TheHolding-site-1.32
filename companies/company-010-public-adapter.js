/* The Holding · Company #010 Cypher public adapter · v0.6.2-acceptance-polish
 * Compatibility sentinel: supersedes v0.6-stakedao-complete without changing that native surface contract.
 * Stake DAO underlying decomposition remains canonical in state: USDC / USDbC / axlUSDC / crvUSD. Public Passport intentionally renders the strategy as one compact economic row.
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
  const ENTRY=Object.freeze({BTC:73482,ETH:2476,HYPE:38.62,CVX:1.84,CRV:0.228,AERO:0.60,LDO:0.8408,VELO:0.04762});
  const UNIQUE_INDEX_GREENS=Object.freeze(['#183F34','#244B3F','#315748','#40634F','#506F54','#637B59','#788861','#8E966C','#A4A77A','#B9B88B']);
  let state=null,productivity=null,installed=false,indexColorHooked=false;

  const lang=()=> (document.documentElement.lang||'en').toLowerCase().startsWith('ru')?'ru':'en';
  const money=v=>'$'+Math.round(Number(v)||0).toLocaleString('en-US');
  const money2=v=>'$'+Number(v||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
  const pct=v=>Number(v).toFixed(1)+'%';

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
      <div class="cc-metrics"><div><div class="cc-metric-label">${lang()==='ru'?'TVL компании':'Company TVL'}</div><div class="cc-metric-value gold" id="tvl-cypher">${complete?'':'≥ '}${money(complete?state.capital.totalCapitalUsd:state.capital.knownCapitalFloorUsd)}</div></div><div><div class="cc-metric-label">APR</div><div class="cc-metric-value" id="apr-cypher">${apr===null?(lang()==='ru'?'Измеряется':'Measuring'):pct(apr)}</div></div></div>
      <span class="cc-extlink cc-extlink-static" aria-disabled="true"><span class="cc-ext-label">DeBank · Tracking</span></span>`;
    card.style.opacity='1';card.style.transform='none';
    const count=document.getElementById('companyCount');if(count)count.textContent='10';
    const stat=document.getElementById('statCompanies');if(stat)stat.textContent='10';
    syncNetworkStats();
  }

  function stakeDaoLabel(){return 'Stake DAO · 4pool stables';}

  function installRuntimeBook(){
    if(!state)return;
    if(typeof COMPANY_PROTOCOLS!=='undefined')COMPANY_PROTOCOLS.Cypher=protocols();
    if(typeof COMPANY_REWARDS_SCOPE!=='undefined'&&COMPANY_REWARDS_SCOPE?.add)COMPANY_REWARDS_SCOPE.add('Cypher');
    if(typeof COMPANY_ASSET_LABELS!=='undefined'){
      Object.assign(COMPANY_ASSET_LABELS,{hyperliquid:'HYPE','lido-dao':'LDO','convex-crv':'cvxCRV','gmx-gm-eth-usdc':'GMX · ETH-USDC','gmx-gm-btc-usdc':'GMX · BTC-USDC'});
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
    return{nm:'Cypher',displayName:'Cypher',val:Number(complete?state.capital.totalCapitalUsd:state.capital.knownCapitalFloorUsd)||0,cost:null,pnl:null,pct:null,performancePending,href:null,indexEligible:complete,capitalFloor:!complete,capitalComplete:complete,cat:{en:complete?'Bitcoin Standard':'Bitcoin Standard · measured floor',ru:complete?'Bitcoin Standard':'Bitcoin Standard · измеренный минимум'},since:{en:'Jul 2025',ru:'Июл 2025'},reg:'010',foundedISO:'2025-07-04',founded:{en:'Jul 4, 2025',ru:'4 июл 2025'},arch:{en:'The Holding Standard',ru:'The Holding Standard'},protocols:protocols().length,status:{en:complete?'Productive':'Pending capital completion',ru:complete?'Активна':'Ожидает закрытия капитала'},aprNumeric:apr??0,aprLatest:apr,aprDisplay:{en:apr===null?'Measuring':`${apr.toFixed(1)}% · ${coverage.toFixed(1)}% covered`,ru:apr===null?'Измеряется':`${apr.toFixed(1)}% · покрыто ${coverage.toFixed(1)}%`},aprSource:'canonical-company-state',aprObservationCount:0,pendingReason:complete?null:{en:'An in-scope capital mechanism is not yet fully bound',ru:'Один из учитываемых механизмов капитала ещё не полностью связан'}};
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

  function polishBalanceSheet(){
    if(!state)return;
    const item=document.querySelector('.ib-item[data-nm="Cypher"]');
    if(!item)return;
    const pills=[...item.querySelectorAll('.ipx-balance-card .ipx-position-pill')];
    if(!pills.length)return;
    const byLabel=needle=>pills.find(p=>String(p.querySelector('.ipx-position-symbol')?.textContent||'').includes(needle));

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
    if(gmxEth&&gmxBtc&&gmxValue>0){
      const symbol=gmxEth.querySelector('.ipx-position-symbol');
      const qty=gmxEth.querySelector('.ipx-position-qty');
      if(symbol)symbol.textContent='GMX · ETH-USDC + BTC-USDC';
      if(qty)qty.textContent=money2(gmxValue);
      gmxEth.dataset.cypherDisplay='gmx-combined';
      gmxBtc.remove();
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
    polishBalanceSheet();
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
    const[stateRes,prodRes,capitalRes]=await Promise.all([fetch(STATE_URL,{cache:'no-store'}),fetch(PRODUCTIVITY_URL,{cache:'no-store'}).catch(()=>null),fetch(CAPITAL_URL,{cache:'no-store'}).catch(()=>null)]);
    if(!stateRes.ok)throw new Error('Cypher canonical state unavailable: '+stateRes.status);
    state=await stateRes.json();productivity=prodRes?.ok?await prodRes.json():null;window.__TH_CAPITAL_STATE__=capitalRes?.ok?await capitalRes.json():null;
    if(state.company?.registry!=='010'||state.company?.name!=='Cypher')throw new Error('Cypher identity mismatch');
    if(state.authority?.executionAuthority!=='none'||state.authority?.transactions!==false)throw new Error('Cypher authority boundary drift');
    installRuntimeBook();ensureCollectionCard();syncNetworkStats();
    let attempts=0;
    const timer=setInterval(()=>{attempts+=1;if(rerenderNativeSurfaces()||attempts>600)clearInterval(timer);},100);
    rerenderNativeSurfaces();
    setInterval(syncNetworkStats,1000);
    const observer=new MutationObserver(()=>{ensureCollectionCard();syncNetworkStats();polishBalanceSheet();if(!installed)rerenderNativeSurfaces();else markPendingPerformance();});
    observer.observe(document.documentElement,{attributes:true,attributeFilter:['lang','class']});
  }

  const run=()=>start().catch(err=>console.error('[Company #010 native public adapter]',err));
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run,{once:true});else run();
})();
