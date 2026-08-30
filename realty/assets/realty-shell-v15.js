(function(){
 'use strict';
 const q=s=>document.querySelector(s);
 const themeKey='theholding-realty-theme';
 const state={snapshot:null};
 const menuCss=document.createElement('link');menuCss.rel='stylesheet';menuCss.href='/realty/assets/realty-shell-v15-menu.css';document.head.append(menuCss);
 const fmtNumber=n=>Number(n).toLocaleString(undefined,{maximumFractionDigits:0});
 const money=(n,c='$')=>n==null?'Not disclosed':c+Number(n).toLocaleString(undefined,{maximumFractionDigits:2});
 const returnLabel=x=>{
   if(x.avgYieldPct!=null)return x.avgYieldPct+'% Avg. Rental Yield';
   if(x.estimatedAnnualReturnPct!=null)return x.estimatedAnnualReturnPct+'% Estimated Annual Return';
   if(x.returnObservation&&x.returnObservation.valuePct!=null)return x.returnObservation.valuePct+'% '+x.returnObservation.label;
   return 'Not disclosed';
 };
 const physicalValue=x=>{
   if(x.sharePriceUsd!=null)return money(x.sharePriceUsd)+'/share';
   if(x.projectValueEur!=null)return '€'+fmtNumber(x.projectValueEur);
   return 'Not disclosed';
 };
 const digitalPrice=x=>x.askNative||x.topOfferNative||(x.bestOfferUsd!=null?money(x.bestOfferUsd):'Not disclosed');
 function setText(sel,value){const el=q(sel);if(el)el.textContent=value}
 function themeIcon(){const b=q('[data-theme-toggle]');if(!b)return;const dark=document.documentElement.dataset.theme==='dark';b.textContent=dark?'☀':'◐';b.setAttribute('aria-label',dark?'Switch to light mode':'Switch to dark mode');b.setAttribute('title',dark?'Light mode':'Dark mode')}
 function toggleTheme(){const root=document.documentElement;root.dataset.theme=root.dataset.theme==='dark'?'light':'dark';try{localStorage.setItem(themeKey,root.dataset.theme)}catch(e){}themeIcon()}
 function toggleMenu(force){const menu=q('[data-v15-mobile-menu]');if(!menu)return;const next=typeof force==='boolean'?force:!menu.classList.contains('open');menu.classList.toggle('open',next);menu.hidden=!next;menu.setAttribute('aria-hidden',String(!next));const button=q('[data-v15-menu]');if(button)button.setAttribute('aria-expanded',String(next))}
 document.addEventListener('click',e=>{
   if(e.target.closest('[data-theme-toggle]')){e.preventDefault();toggleTheme();return}
   if(e.target.closest('[data-v15-menu]')){e.preventDefault();toggleMenu();return}
   if(e.target.closest('[data-v15-mobile-menu] a')){toggleMenu(false);return}
   if(q('[data-v15-mobile-menu].open')&&!e.target.closest('[data-v15-mobile-menu]'))toggleMenu(false)
 });
 document.addEventListener('keydown',e=>{if(e.key==='Escape')toggleMenu(false)});

 function makeCard(x,kind){
   const a=document.createElement('a');
   a.className='v15-card '+(kind==='digital'?'digital':'physical');
   a.href=kind==='digital'?'/realty/parcel/?id='+encodeURIComponent(x.id):'/realty/property/?id='+encodeURIComponent(x.id);
   const visual=document.createElement('div');visual.className='v15-card-visual';
   const badge=document.createElement('span');badge.className='v15-card-badge';badge.textContent=kind==='digital'?(x.world||'Digital World'):(x.platform||x.marketSurface||'Physical World');visual.append(badge);
   const body=document.createElement('div');body.className='v15-card-body';
   const h=document.createElement('h3');h.textContent=x.name;
   const meta=document.createElement('div');meta.className='v15-card-meta';meta.textContent=kind==='digital'?[(x.world||''),(x.type||''),(x.coordinates||'')].filter(Boolean).join(' · '):[(x.location||''),(x.type||'')].filter(Boolean).join(' · ');
   const data=document.createElement('div');data.className='v15-card-data';
   function datum(label,value){const d=document.createElement('div'),s=document.createElement('span'),b=document.createElement('b');s.textContent=label;b.textContent=value;d.append(s,b);return d}
   if(kind==='digital')data.append(datum('Ask / offer',digitalPrice(x)),datum('Income','No intrinsic income tracked'));
   else data.append(datum('Entry / value',physicalValue(x)),datum('Return',returnLabel(x)));
   const src=document.createElement('div');src.className='v15-card-source';const left=document.createElement('span'),right=document.createElement('span');left.textContent=(x.sourceLabel||x.platform||x.world||'Source')+' · '+(x.sourceChecked||'date unavailable');right.textContent='Open record →';src.append(left,right);
   body.append(h,meta,data,src);a.append(visual,body);return a;
 }
 function render(d){
   state.snapshot=d;
   const tracked=(d.marketDirectory||[]).filter(x=>x.status==='Tracked').length;
   const observations=(d.realWorld||[]).length+(d.digitalWorld||[]).length;
   const returns=(d.realWorld||[]).filter(x=>x.avgYieldPct!=null||x.estimatedAnnualReturnPct!=null||(x.returnObservation&&x.returnObservation.valuePct!=null)).length;
   const checked=[...(d.realWorld||[]),...(d.digitalWorld||[])].map(x=>x.sourceChecked).filter(Boolean).sort().reverse()[0];
   setText('[data-kpi="markets"]',tracked||'—');setText('[data-kpi="observations"]',observations||'—');setText('[data-kpi="returns"]',returns||'—');setText('[data-kpi="checked"]',checked||'Unavailable');
   const all=[...(d.realWorld||[]).map(x=>({...x,__kind:'physical'})),...(d.digitalWorld||[]).map(x=>({...x,__kind:'digital'}))];
   const preferred=['blocksquare-sky-mansion-palm-jumeirah','lofty-fallwood','sandbox-happyland','otherside-18123'];
   let selected=preferred.map(id=>all.find(x=>x.id===id)).filter(Boolean);
   if(selected.length<4)selected=[...selected,...all.filter(x=>!selected.includes(x)).slice(0,4-selected.length)];
   const holder=q('#v15Featured');if(holder)holder.replaceChildren(...selected.map(x=>makeCard(x,x.__kind)));
   const physicalMarkets=[...new Set((d.realWorld||[]).map(x=>x.platform||x.marketSurface).filter(Boolean))];
   const digitalMarkets=[...new Set((d.digitalWorld||[]).map(x=>x.world).filter(Boolean))];
   setText('[data-market-count="physical"]',physicalMarkets.length+' observed');setText('[data-market-count="digital"]',digitalMarkets.length+' observed');
 }
 function load(){
   const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);
   fetch('/realty/data/market-snapshot.json',{cache:'no-store',signal:controller.signal}).then(r=>{if(!r.ok)throw new Error('snapshot '+r.status);return r.json()}).then(render).catch(()=>{const h=q('#v15Featured');if(h)h.innerHTML='<div style="grid-column:1/-1;padding:24px;color:var(--muted);font-size:10px">Market snapshot temporarily unavailable. The portal shell remains available.</div>'}).finally(()=>clearTimeout(timer));
 }
 themeIcon();toggleMenu(false);load();
})();
