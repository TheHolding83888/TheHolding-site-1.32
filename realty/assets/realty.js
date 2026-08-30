(function(){
 const root=document.documentElement,key='theholding-realty-theme';
 const saved=localStorage.getItem(key);if(saved)root.dataset.theme=saved;
 function syncTheme(){document.querySelectorAll('[data-theme-toggle]').forEach(b=>b.textContent=root.dataset.theme==='dark'?'☀':'◐')}
 function syncNav(){document.querySelectorAll('.navlinks').forEach(nav=>{if(!nav.querySelector('a[href="/realty/income/"]')){const physical=nav.querySelector('a[href="/realty/physical/"]');const a=document.createElement('a');a.href='/realty/income/';a.textContent='Income';if(location.pathname.startsWith('/realty/income/'))a.classList.add('active');if(physical)physical.after(a);else nav.append(a)}nav.querySelectorAll('a').forEach(a=>{if(a.getAttribute('href')==='/realty/income/'&&location.pathname.startsWith('/realty/income/'))a.classList.add('active')})})}
 document.addEventListener('click',e=>{const b=e.target.closest('[data-theme-toggle]');if(!b)return;root.dataset.theme=root.dataset.theme==='dark'?'light':'dark';localStorage.setItem(key,root.dataset.theme);syncTheme()});
 function ensureV2(){setTimeout(()=>{if(window.RealtyMedia||document.querySelector('script[src="/realty/assets/realty-v2.js"]'))return;const s=document.createElement('script');s.src='/realty/assets/realty-v2.js';document.body.append(s)},0)}
 function boot(){syncTheme();syncNav();ensureV2()}
 document.readyState==='loading'?document.addEventListener('DOMContentLoaded',boot):boot();
 window.Realty={fmt(v,currency='$'){if(v==null)return'Source unavailable';return currency+Number(v).toLocaleString(undefined,{maximumFractionDigits:2})},state(v){return v==null?'Not disclosed':v}};
})();