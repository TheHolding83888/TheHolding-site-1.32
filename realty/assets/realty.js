(function(){
 const root=document.documentElement; const key='theholding-realty-theme';
 const saved=localStorage.getItem(key); if(saved) root.dataset.theme=saved;
 function sync(){document.querySelectorAll('[data-theme-toggle]').forEach(b=>b.textContent=root.dataset.theme==='dark'?'☀':'◐')}
 document.addEventListener('click',e=>{const b=e.target.closest('[data-theme-toggle]');if(!b)return;root.dataset.theme=root.dataset.theme==='dark'?'light':'dark';localStorage.setItem(key,root.dataset.theme);sync()});sync();
 window.Realty={fmt(v,currency='$'){if(v==null)return 'Source unavailable';return currency+Number(v).toLocaleString(undefined,{maximumFractionDigits:2})},state(v){return v==null?'Not disclosed':v}};
})();