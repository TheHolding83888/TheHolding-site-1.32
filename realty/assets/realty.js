(function(){
 const root=document.documentElement,key='theholding-realty-theme';
 const saved=localStorage.getItem(key);if(saved)root.dataset.theme=saved;
 function syncTheme(){document.querySelectorAll('[data-theme-toggle]').forEach(b=>b.textContent=root.dataset.theme==='dark'?'☀':'◐')}
 function ensureNavLink(nav,href,label,afterHref){if(nav.querySelector('a[href="'+href+'"]'))return;const a=document.createElement('a');a.href=href;a.textContent=label;const anchor=afterHref&&nav.querySelector('a[href="'+afterHref+'"]');if(anchor)anchor.after(a);else nav.append(a)}
 function syncNav(){document.querySelectorAll('.navlinks').forEach(nav=>{ensureNavLink(nav,'/realty/income/','Income','/realty/physical/');ensureNavLink(nav,'/realty/sources/','Sources','/realty/markets/');nav.querySelectorAll('a').forEach(a=>{const href=a.getAttribute('href');if(href==='/realty/income/'&&location.pathname.startsWith('/realty/income/'))a.classList.add('active');if(href==='/realty/sources/'&&location.pathname.startsWith('/realty/sources/'))a.classList.add('active')})})}
 document.addEventListener('click',e=>{const b=e.target.closest('[data-theme-toggle]');if(!b)return;root.dataset.theme=root.dataset.theme==='dark'?'light':'dark';localStorage.setItem(key,root.dataset.theme);syncTheme()});
 function ensureV2(){setTimeout(()=>{if(window.RealtyMedia||document.querySelector('script[src="/realty/assets/realty-v2.js"]'))return;const s=document.createElement('script');s.src='/realty/assets/realty-v2.js';document.body.append(s)},0)}
 function boot(){syncTheme();syncNav();ensureV2()}
 document.readyState==='loading'?document.addEventListener('DOMContentLoaded',boot):boot();
 window.Realty={fmt(v,currency='$'){if(v==null)return'Source unavailable';return currency+Number(v).toLocaleString(undefined,{maximumFractionDigits:2})},state(v){return v==null?'Not disclosed':v}};
})();