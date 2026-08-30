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
 document.readyState==='loading'?document.addEventListener('DOMContentLoaded',sync):sync();
})();
