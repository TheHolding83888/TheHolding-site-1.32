/* The Holding · Company #010 Cypher public adapter · v0.1
 * Canonical source: /companies/company-010-production-state.json
 * Public rule: unknown != zero; partial != total; route readiness != claimable.
 * Index rule: Cypher remains visible but unweighted while totalCapitalComplete=false.
 */
(() => {
  'use strict';

  const STATE_URL = '/companies/company-010-production-state.json';
  const CAPITAL_URL = '/intelligence/capital-state/capital-state.json';
  const ENTRY = Object.freeze({ BTC:73482, ETH:2476, HYPE:38.62, CVX:1.84, CRV:0.228, AERO:0.60, LDO:0.8408, VELO:0.04762 });
  const PROTOCOLS = ['Bitcoin','Ethereum','Project X','Convex','Curve','Aerodrome','Velodrome','GMX','Concentrator','Fluid'];
  const $ = (s, root=document) => root.querySelector(s);
  const money = v => Number.isFinite(Number(v)) ? '$' + Number(v).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}) : '—';
  const pct = v => Number.isFinite(Number(v)) ? Number(v).toFixed(1) + '%' : '—';
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function language(){ return (document.documentElement.lang || localStorage.getItem('holdingLanguage') || 'en').toLowerCase().startsWith('ru') ? 'ru' : 'en'; }
  function t(en, ru){ return language()==='ru' ? ru : en; }

  function installStyles(){
    if ($('#thCompany010Styles')) return;
    const style=document.createElement('style');
    style.id='thCompany010Styles';
    style.textContent=`
      .company-card-010{cursor:pointer}.company-card-010 .cc-floor-note{font-size:.54rem;letter-spacing:.08em;text-transform:uppercase;color:var(--text-3);margin-top:.22rem}
      .thc10-index-note{display:flex;align-items:center;justify-content:space-between;gap:1rem;border:1px solid var(--line);border-radius:14px;padding:.9rem 1rem;margin:.85rem 0;background:rgba(168,132,44,.035);font-size:.72rem;color:var(--text-2)}
      .thc10-index-note b{font-family:'Cormorant Garamond',serif;font-size:1.15rem;font-weight:500;color:var(--text)}.thc10-pending{font-size:.58rem;letter-spacing:.13em;text-transform:uppercase;color:var(--gold)}
      .thc10-overlay{position:fixed;inset:0;z-index:10020;background:rgba(17,16,12,.52);backdrop-filter:blur(12px);display:none;align-items:flex-start;justify-content:center;overflow:auto;padding:4vh 1.25rem}
      .thc10-overlay.open{display:flex}.thc10-passport{width:min(1040px,100%);background:#fcfcfa;border:1px solid rgba(22,21,15,.13);border-radius:26px;box-shadow:0 30px 90px rgba(0,0,0,.22);padding:clamp(1.25rem,3vw,2.5rem);position:relative;color:var(--text)}
      .thc10-close{position:absolute;right:1.15rem;top:1rem;width:36px;height:36px;border-radius:50%;border:1px solid var(--line-strong);background:transparent;color:var(--text);font-size:1.25rem;cursor:pointer}
      .thc10-kicker{font-size:.58rem;letter-spacing:.2em;text-transform:uppercase;color:var(--gold);margin-bottom:.55rem}.thc10-title{font-family:'Cormorant Garamond',serif;font-size:clamp(2.4rem,6vw,4.3rem);font-weight:300;line-height:.96}.thc10-lede{max-width:720px;color:var(--text-2);font-size:.86rem;line-height:1.65;margin-top:.75rem}
      .thc10-live{display:inline-flex;gap:.42rem;align-items:center;font-size:.58rem;letter-spacing:.1em;text-transform:uppercase;margin-top:.85rem}.thc10-live i{width:7px;height:7px;border-radius:50%;background:#0a7c4e}
      .thc10-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:1px;background:var(--line);border:1px solid var(--line);border-radius:18px;overflow:hidden;margin:1.8rem 0}.thc10-metric{background:#fff;padding:1.15rem}.thc10-metric span{display:block;font-size:.55rem;letter-spacing:.1em;text-transform:uppercase;color:var(--text-3)}.thc10-metric b{display:block;font-family:'Cormorant Garamond',serif;font-size:1.7rem;font-weight:500;margin-top:.28rem}.thc10-metric small{display:block;font-size:.58rem;color:var(--text-3);margin-top:.2rem}
      .thc10-grid{display:grid;grid-template-columns:1.35fr .65fr;gap:1rem}.thc10-panel{border:1px solid var(--line);border-radius:18px;background:#fff;padding:1.15rem}.thc10-panel h4{font-family:'Cormorant Garamond',serif;font-size:1.45rem;font-weight:500;margin-bottom:.8rem}.thc10-row{display:grid;grid-template-columns:1.1fr .7fr .7fr .75fr;gap:.65rem;padding:.63rem 0;border-top:1px solid var(--line);font-size:.68rem;align-items:center}.thc10-row.head{font-size:.5rem;letter-spacing:.08em;text-transform:uppercase;color:var(--text-3);border-top:0}.thc10-row strong{font-weight:500}.thc10-muted{color:var(--text-3)}.thc10-warm{color:var(--gold)}
      .thc10-meta{display:grid;gap:.7rem}.thc10-meta div{border-top:1px solid var(--line);padding-top:.65rem}.thc10-meta span{display:block;font-size:.52rem;letter-spacing:.09em;text-transform:uppercase;color:var(--text-3)}.thc10-meta b{display:block;font-size:.72rem;font-weight:500;margin-top:.18rem;word-break:break-word}.thc10-rule{margin-top:1rem;border-left:2px solid var(--gold);padding:.72rem .85rem;background:var(--gold-soft);font-size:.68rem;line-height:1.55;color:var(--text-2)}
      .thc10-protos{display:flex;flex-wrap:wrap;gap:.4rem;margin-top:.75rem}.thc10-protos span{border:1px solid var(--line);border-radius:100px;padding:.28rem .55rem;font-size:.55rem;color:var(--text-2)}
      @media(max-width:760px){.thc10-overlay{padding:.7rem}.thc10-passport{border-radius:18px;padding:1.15rem}.thc10-metrics{grid-template-columns:repeat(2,1fr)}.thc10-grid{grid-template-columns:1fr}.thc10-row{grid-template-columns:1.1fr .65fr .65fr}.thc10-row>*:nth-child(4){display:none}.thc10-index-note{align-items:flex-start;flex-direction:column}.thc10-title{padding-right:2rem}}
    `;
    document.head.appendChild(style);
  }

  function ensureCard(state){
    if ($('.company-card-010')) return $('.company-card-010');
    const placeholder=$('.company-card.placeholder');
    if (!placeholder || !placeholder.parentNode) throw new Error('Company collection placeholder anchor missing');
    const card=document.createElement('div');
    card.className='company-card company-card-010 reveal';
    card.dataset.category='onchain'; card.setAttribute('role','button'); card.tabIndex=0; card.setAttribute('aria-controls','company010Passport');
    card.innerHTML=`
      <div class="cc-regnum"><span><span class="cc-reg-label">Registry</span> · 010</span><span class="cc-founded">Est. Jul 4, 2025</span></div>
      <div class="cc-top"><div class="cc-seal"><span class="cc-seal-mark" role="img" aria-label="The Holding registry seal"></span></div><div class="cc-status"><span class="cc-dot"></span><span>Live</span></div></div>
      <div class="cc-name">Cypher</div>
      <div class="cc-sub">A Bitcoin Standard company combining reserve capital with productive ve positions, GMX markets and concentrated onchain liquidity.</div>
      <div class="cc-metrics"><div><div class="cc-metric-label">Company TVL</div><div class="cc-metric-value gold" id="tvl-cypher">≥ ${money(state.capital.knownCapitalFloorUsd)}</div><div class="cc-floor-note">Measured capital floor</div></div><div><div class="cc-metric-label">Productivity</div><div class="cc-metric-value" id="apr-cypher">Partial · ${pct((state.productivity.coverage||0)*100)} covered</div></div></div>
      <span class="cc-extlink"><span class="cc-ext-label">Open Passport</span><svg class="cc-ext-arrow" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M4.5 11.5L11.5 4.5M11.5 4.5H5.5M11.5 4.5V10.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg></span>`;
    placeholder.parentNode.insertBefore(card, placeholder);
    card.style.opacity='1'; card.style.transform='none';
    card.addEventListener('click',openPassport); card.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openPassport();}});
    document.querySelectorAll('.filter-tab[data-filter]').forEach(btn=>btn.addEventListener('click',()=>{const f=btn.dataset.filter; card.style.display=(f==='all'||f==='onchain')?'':'none';}));
    const count=$('#companyCount'); if(count) count.textContent='10';
    return card;
  }

  let STATE=null;
  function positionRows(state){
    return state.capital.positions.map(p=>{
      const entry=ENTRY[p.symbol];
      const entryTxt=entry ? '$'+entry.toLocaleString('en-US',{maximumFractionDigits:5}) : 'Protocol share';
      const perf=entry && Number.isFinite(Number(p.priceUsd)) ? ((p.priceUsd/entry)-1)*100 : null;
      return `<div class="thc10-row"><strong>${esc(p.symbol)}</strong><span>${money(p.valueUsd)}</span><span>${entryTxt}</span><span class="${perf==null?'thc10-muted':perf>=0?'':'thc10-warm'}">${perf==null?'n/a':(perf>=0?'+':'')+perf.toFixed(1)+'%'}</span></div>`;
    }).join('');
  }
  function productivityRows(state){
    return state.productivity.positions.map(p=>{
      const measured=p.status==='measured';
      const supported=p.status==='supported-existing-adapter';
      const rate=measured ? pct(p.referenceAprPct) : supported ? t('Existing adapter','Существующий адаптер') : t('Warming','Накапливается');
      return `<div class="thc10-row"><strong>${esc(p.label)}</strong><span>${money(p.valueUsd)}</span><span class="${measured?'':'thc10-warm'}">${esc(rate)}</span><span>${esc(p.status)}</span></div>`;
    }).join('');
  }

  function ensurePassport(state){
    let ov=$('#company010Passport'); if(ov) return ov;
    ov=document.createElement('div'); ov.id='company010Passport'; ov.className='thc10-overlay'; ov.setAttribute('aria-hidden','true');
    ov.innerHTML=`<article class="thc10-passport" role="dialog" aria-modal="true" aria-label="Cypher Company Passport">
      <button class="thc10-close" type="button" aria-label="Close Passport">×</button>
      <div class="thc10-kicker">Registry 010 · Company Passport</div><div class="thc10-title">Cypher</div>
      <div class="thc10-live"><i></i>Live · Bitcoin Standard · Partial capital state</div>
      <p class="thc10-lede">${t('A layered Bitcoin Standard company measured from canonical onchain state. Fluid remains outside total capital until collateral, debt and net ETH exposure are independently resolved.','Компания Bitcoin Standard с послойным капиталом, измеряемая из канонического onchain-состояния. Fluid не включается в итоговый капитал, пока обеспечение, долг и чистая ETH-экспозиция не будут независимо подтверждены.')}</p>
      <section class="thc10-metrics">
        <div class="thc10-metric"><span>${t('Known capital floor','Измеренный минимум капитала')}</span><b>≥ ${money(state.capital.knownCapitalFloorUsd)}</b><small>${t('Not a complete total','Не полный итог')}</small></div>
        <div class="thc10-metric"><span>${t('Productivity coverage','Покрытие Productivity')}</span><b>${pct((state.productivity.coverage||0)*100)}</b><small>${t('APR-covered productive value','Продуктивный капитал с APR')}</small></div>
        <div class="thc10-metric"><span>${t('Performance','Performance')}</span><b>${t('Partial','Частично')}</b><small>${t('Company-level result withheld','Итог компании не публикуется')}</small></div>
        <div class="thc10-metric"><span>${t('Index','Индекс')}</span><b>${t('Pending','Ожидание')}</b><small>${t('Unweighted until Fluid closes','Без веса до закрытия Fluid')}</small></div>
      </section>
      <div class="thc10-grid"><section class="thc10-panel"><h4>${t('Company Book','Книга компании')}</h4><div class="thc10-row head"><span>Asset</span><span>Current</span><span>Entry</span><span>Asset P&amp;L</span></div>${positionRows(state)}<h4 style="margin-top:1.35rem">Productivity</h4><div class="thc10-row head"><span>Engine</span><span>Capital</span><span>Reference APR</span><span>Status</span></div>${productivityRows(state)}</section>
      <aside class="thc10-panel"><h4>${t('Operating contract','Операционный контракт')}</h4><div class="thc10-meta">
        <div><span>Founded</span><b>Jul 4, 2025 · owner-declared</b></div><div><span>Architecture</span><b>Layered Capital / Bitcoin Standard</b></div><div><span>Wallet 1</span><b>${esc(state.company.wallets[0].address)}</b></div><div><span>Wallet 2</span><b>${esc(state.company.wallets[1].address)}</b></div><div><span>Rewards</span><b>${t('Known routes: Aerodrome · Velodrome · Votium','Известные маршруты: Aerodrome · Velodrome · Votium')}</b></div><div><span>Execution authority</span><b>none</b></div></div>
        <div class="thc10-protos">${PROTOCOLS.map(x=>`<span>${esc(x)}</span>`).join('')}</div>
        <div class="thc10-rule"><b>${t('Epistemic boundary','Граница достоверности')}.</b> unknown ≠ 0 · partial ≠ total · Reference APR ≠ realised cash flow · route readiness ≠ claimable rewards. Fluid is excluded until net exposure is independently resolved.</div>
      </aside></div>
    </article>`;
    document.body.appendChild(ov);
    $('.thc10-close',ov).addEventListener('click',closePassport); ov.addEventListener('click',e=>{if(e.target===ov)closePassport();});
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&ov.classList.contains('open'))closePassport();});
    return ov;
  }
  function openPassport(){ if(!STATE)return; const ov=ensurePassport(STATE); ov.classList.add('open'); ov.setAttribute('aria-hidden','false'); document.body.style.overflow='hidden'; }
  function closePassport(){ const ov=$('#company010Passport'); if(!ov)return; ov.classList.remove('open'); ov.setAttribute('aria-hidden','true'); document.body.style.overflow=''; }

  function installPendingIndex(state){
    if ($('#thCompany010IndexPending')) return;
    const section=$('.index-sec'); if(!section) return;
    const anchor=$('.idx-table',section)||$('.index-board',section)||section.querySelector('[class*="idx-"]'); if(!anchor||!anchor.parentNode)return;
    const note=document.createElement('div'); note.id='thCompany010IndexPending'; note.className='thc10-index-note';
    note.innerHTML=`<div><b>Cypher · Registry 010</b><div>${t('Measured and live in the Registry. General Index weight is withheld while Fluid keeps total capital incomplete.','Измеряется и опубликована в Registry. Вес General Index не присваивается, пока Fluid оставляет общий капитал неполным.')}</div></div><span class="thc10-pending">${t('Pending · unweighted','Ожидание · без веса')}</span>`;
    anchor.parentNode.insertBefore(note,anchor);
  }

  function installJsonLd(){
    if ($('#thCompany010JsonLd')) return;
    const s=document.createElement('script'); s.type='application/ld+json'; s.id='thCompany010JsonLd';
    s.textContent=JSON.stringify({'@context':'https://schema.org','@type':'ListItem','position':10,'name':'Cypher','url':'https://theholding.ai/companies/#cypher'});
    document.head.appendChild(s);
  }

  async function start(){
    installStyles(); installJsonLd();
    const [stateRes,capitalRes]=await Promise.all([fetch(STATE_URL,{cache:'no-store'}),fetch(CAPITAL_URL,{cache:'no-store'}).catch(()=>null)]);
    if(!stateRes.ok) throw new Error('Cypher canonical state unavailable: '+stateRes.status);
    const state=await stateRes.json();
    if(state?.company?.registry!=='010'||state?.company?.name!=='Cypher') throw new Error('Cypher identity mismatch');
    if(state?.authority?.executionAuthority!=='none'||state?.authority?.transactions!==false) throw new Error('Cypher authority boundary drift');
    if(state?.capital?.totalCapitalComplete!==false) throw new Error('Adapter v0.1 expects fail-closed incomplete Fluid state');
    STATE=state; ensureCard(state); installPendingIndex(state);
    if(capitalRes?.ok){ const cap=await capitalRes.json(); const stat=$('#statTVL'); if(stat && cap?.network?.totalCapitalComplete===false && Number(cap?.network?.measuredCapitalFloorUsd)>0){ stat.textContent='≥ '+money(cap.network.measuredCapitalFloorUsd); stat.title=t('Measured network capital floor; full TVL withheld while Cypher Fluid exposure is unresolved.','Измеренный минимум капитала сети; полный TVL скрыт, пока Fluid-экспозиция Cypher не разрешена.'); } }
    window.dispatchEvent(new CustomEvent('theholding:company010-public-ready',{detail:{registry:'010',capitalFloorUsd:state.capital.knownCapitalFloorUsd,indexEligible:false}}));
  }

  const run=()=>start().catch(err=>{console.error('[Company #010 public adapter]',err);});
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',run,{once:true}); else run();
})();
