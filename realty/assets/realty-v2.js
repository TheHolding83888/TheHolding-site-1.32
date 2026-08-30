(function(){
 const key='theholding-realty-watchlist-v1';
 function load(){try{return JSON.parse(localStorage.getItem(key)||'[]')}catch(e){return []}}
 function save(v){localStorage.setItem(key,JSON.stringify(v))}
 function token(kind,id){return kind+':'+id}
 function has(kind,id){return load().includes(token(kind,id))}
 function toggle(kind,id){const t=token(kind,id);let a=load();a=a.includes(t)?a.filter(x=>x!==t):[...a,t];save(a);sync();window.dispatchEvent(new CustomEvent('realty-watchlist-change',{detail:a}));return a.includes(t)}
 function sync(){document.querySelectorAll('[data-watch-id]').forEach(b=>{const on=has(b.dataset.watchKind||'asset',b.dataset.watchId);b.setAttribute('aria-pressed',String(on));b.textContent=on?'✓ Saved':'☆ Watch'})}
 document.addEventListener('click',e=>{const b=e.target.closest('[data-watch-id]');if(!b)return;e.preventDefault();toggle(b.dataset.watchKind||'asset',b.dataset.watchId)});
 window.RealtyWatch={load,has,toggle,token,sync};

 let mediaPromise=null;
 function media(){return mediaPromise||(mediaPromise=fetch('/realty/data/property-media.json').then(r=>{if(!r.ok)throw new Error('media');return r.json()}).catch(()=>({records:{}})))}
 function idFromCard(card){try{const u=new URL(card.getAttribute('href'),location.origin);return u.searchParams.get('id')}catch(e){return null}}
 function mayDisplay(m){return !!(m&&m.hero&&m.displayPolicy==='display_allowed')}
 function decorateCard(card,records){if(card.dataset.mediaChecked)return;card.dataset.mediaChecked='1';const id=idFromCard(card),m=id&&records[id],visual=card.querySelector('.visual');if(!mayDisplay(m)||!visual)return;const img=document.createElement('img');img.src=m.hero;img.alt='';img.loading='lazy';img.decoding='async';img.addEventListener('load',()=>visual.classList.add('has-media'));img.addEventListener('error',()=>img.remove());visual.prepend(img);const badge=document.createElement('span');badge.className='media-badge';badge.textContent='Source photo';visual.append(badge)}
 function scan(root=document){media().then(d=>root.querySelectorAll('.card[href*="?id="]').forEach(card=>decorateCard(card,d.records||{})))}
 function hero(id,container){return media().then(d=>{const m=(d.records||{})[id];if(!m||!container)return m||null;if(mayDisplay(m)){const img=document.createElement('img');img.src=m.hero;img.alt='';img.loading='eager';img.decoding='async';img.addEventListener('load',()=>container.classList.add('has-media'));img.addEventListener('error',()=>img.remove());container.prepend(img);const badge=document.createElement('span');badge.className='media-badge detail-badge';badge.textContent=m.mediaSource;container.append(badge)}return m})}
 function observe(){scan();const obs=new MutationObserver(muts=>{if(muts.some(m=>m.addedNodes.length))scan()});obs.observe(document.body,{childList:true,subtree:true})}
 window.RealtyMedia={load:media,scan,hero,mayDisplay};
 function boot(){sync();observe()}
 document.readyState==='loading'?document.addEventListener('DOMContentLoaded',boot):boot();
})();
