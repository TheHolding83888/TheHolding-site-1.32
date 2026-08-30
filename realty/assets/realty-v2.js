(function(){
 const key='theholding-realty-watchlist-v1';
 function load(){try{return JSON.parse(localStorage.getItem(key)||'[]')}catch(e){return []}}
 function save(v){localStorage.setItem(key,JSON.stringify(v))}
 function token(kind,id){return kind+':'+id}
 function has(kind,id){return load().includes(token(kind,id))}
 function toggle(kind,id){const t=token(kind,id);let a=load();a=a.includes(t)?a.filter(x=>x!==t):[...a,t];save(a);sync();window.dispatchEvent(new CustomEvent('realty-watchlist-change',{detail:a}));return a.includes(t)}
 function sync(){document.querySelectorAll('[data-watch-id]').forEach(b=>{const on=has(b.dataset.watchKind||'asset',b.dataset.watchId);b.setAttribute('aria-pressed',String(on));b.textContent=on?'✓ Saved':'☆ Watch'})}
 document.addEventListener('click',e=>{const b=e.target.closest('[data-watch-id]');if(!b)return;e.preventDefault();e.stopPropagation();toggle(b.dataset.watchKind||'asset',b.dataset.watchId)});
 window.RealtyWatch={load,has,toggle,token,sync};

 const compareKey='theholding-realty-compare-v1';
 function compareLoad(){try{return JSON.parse(localStorage.getItem(compareKey)||'[]').filter(Boolean).slice(0,4)}catch(e){return []}}
 function compareSave(v){localStorage.setItem(compareKey,JSON.stringify(v.slice(0,4)))}
 function compareHas(id){return compareLoad().includes(id)}
 function compareSet(ids){const a=[...new Set((ids||[]).filter(Boolean))].slice(0,4);compareSave(a);compareSync();window.dispatchEvent(new CustomEvent('realty-compare-change',{detail:a}));return a}
 function compareToggle(id){let a=compareLoad();if(a.includes(id))a=a.filter(x=>x!==id);else if(a.length<4)a=[...a,id];compareSet(a);return a.includes(id)}
 function compareSync(){const a=compareLoad();document.querySelectorAll('[data-compare-id]').forEach(b=>{const on=a.includes(b.dataset.compareId);b.setAttribute('aria-pressed',String(on));b.textContent=on?'✓ Compare':'＋ Compare';b.disabled=!on&&a.length>=4});let tray=document.getElementById('realtyCompareTray');if(!a.length){if(tray)tray.remove();return}if(!tray){tray=document.createElement('div');tray.id='realtyCompareTray';tray.className='compare-tray';tray.innerHTML='<div><span>Property shortlist</span><b id="realtyCompareCount"></b></div><a href="/realty/compare/">Compare now →</a>';document.body.append(tray)}const c=tray.querySelector('#realtyCompareCount');if(c)c.textContent=a.length+' / 4 selected'}
 document.addEventListener('click',e=>{const b=e.target.closest('[data-compare-id]');if(!b)return;e.preventDefault();e.stopPropagation();compareToggle(b.dataset.compareId)});
 window.RealtyCompare={load:compareLoad,has:compareHas,toggle:compareToggle,set:compareSet,sync:compareSync,clear(){compareSet([])}};

 let mediaPromise=null;
 function media(){return mediaPromise||(mediaPromise=fetch('/realty/data/property-media.json').then(r=>{if(!r.ok)throw new Error('media');return r.json()}).catch(()=>({records:{}})))}
 function idFromCard(card){try{const u=new URL(card.getAttribute('href'),location.origin);return u.searchParams.get('id')}catch(e){return null}}
 function mayDisplay(m){return !!(m&&m.hero&&m.displayPolicy==='display_allowed')}
 function decorateCard(card,records){if(card.dataset.mediaChecked)return;card.dataset.mediaChecked='1';const id=idFromCard(card),m=id&&records[id],visual=card.querySelector('.visual');if(!mayDisplay(m)||!visual)return;const img=document.createElement('img');img.src=m.hero;img.alt='';img.loading='lazy';img.decoding='async';img.addEventListener('load',()=>visual.classList.add('has-media'));img.addEventListener('error',()=>img.remove());visual.prepend(img);const badge=document.createElement('span');badge.className='media-badge';badge.textContent='Source photo';visual.append(badge)}
 function scan(root=document){media().then(d=>root.querySelectorAll('.card[href*="?id="]').forEach(card=>decorateCard(card,d.records||{})))}
 function hero(id,container){return media().then(d=>{const m=(d.records||{})[id];if(!m||!container)return m||null;if(mayDisplay(m)){const img=document.createElement('img');img.src=m.hero;img.alt='';img.loading='eager';img.decoding='async';img.addEventListener('load',()=>container.classList.add('has-media'));img.addEventListener('error',()=>img.remove());container.prepend(img);const badge=document.createElement('span');badge.className='media-badge detail-badge';badge.textContent=m.mediaSource;container.append(badge)}return m})}
 function observe(){scan();const obs=new MutationObserver(muts=>{if(muts.some(m=>m.addedNodes.length)){scan();compareSync();sync()}});obs.observe(document.body,{childList:true,subtree:true})}
 window.RealtyMedia={load:media,scan,hero,mayDisplay};
 function boot(){sync();compareSync();observe()}
 document.readyState==='loading'?document.addEventListener('DOMContentLoaded',boot):boot();
})();
