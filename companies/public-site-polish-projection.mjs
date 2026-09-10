#!/usr/bin/env node
/**
 * The Holding · canonical public-site polish entrypoint
 *
 * The existing public-site projection remains the core implementation. This
 * coordinator runs it first, then applies the bounded Collection-card action
 * contract requested by the owner: one CTA, one destination, one interaction
 * model for every live company card.
 *
 * No capital/accounting/reward/index semantics. executionAuthority = none.
 */

import fs from 'node:fs';

await import('./public-site-polish-projection-core.mjs');

const COMPANIES='companies/index.html';
const marker='data-th-collection-uniform-explore';
const fail=m=>{throw new Error(m);};
let companies=fs.readFileSync(COMPANIES,'utf8');

if(!companies.includes(marker)){
  const addon=`
<style ${marker}-style>
    #companiesGrid .company-card.th-passport-entry { cursor: pointer; }
    #companiesGrid .company-card.th-passport-entry .cc-passport-action { pointer-events: none; }
    #companiesGrid .company-card.th-passport-entry:hover .cc-ext-label {
        opacity: 0.95;
        color: var(--gold);
    }
    #companiesGrid .company-card.th-passport-entry:hover .cc-ext-arrow {
        color: var(--gold);
        opacity: 1;
        transform: translate(2px, -2px);
    }
    #companiesGrid .company-card.th-passport-entry:focus-visible {
        outline: 1px solid var(--gold-line);
        outline-offset: 4px;
    }
</style>
<script ${marker}>
(function(){
    'use strict';
    var KNOWN = new Set(['001','002','003','004','005','006','007','008','009','010']);
    var observer = null;

    function registryFromCard(card){
        var row = card && card.querySelector('.cc-regnum');
        var text = String(row && row.textContent || '');
        var match = text.match(/(?:Registry|Реестр)\\s*·\\s*(\\d{3})/i) || text.match(/·\\s*(\\d{3})/);
        return match ? match[1] : '';
    }

    function isRu(card){
        var row = card && card.querySelector('.cc-regnum');
        return /^ru(?:-|$)/i.test(document.documentElement.lang || '') || /Реестр/i.test(String(row && row.textContent || ''));
    }

    function exploreMarkup(card){
        var label = isRu(card) ? 'Перейти к компании' : 'Explore Company';
        return '<span class="cc-ext-label" data-i18n="card.explore">' + label + '</span>' +
            '<svg class="cc-ext-arrow" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M4.5 11.5L11.5 4.5M11.5 4.5H5.5M11.5 4.5V10.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    }

    function normalize(card){
        if (!card || card.classList.contains('placeholder')) return;
        var reg = registryFromCard(card);
        if (!KNOWN.has(reg)) return;

        card.classList.add('th-passport-entry');
        card.dataset.thPassportRegistry = reg;

        if (card.tagName === 'A') {
            card.setAttribute('href','#passport-' + reg);
            card.removeAttribute('target');
            card.removeAttribute('rel');
        } else {
            card.setAttribute('role','link');
            card.setAttribute('tabindex','0');
        }

        var visibleName = card.querySelector('.cc-name');
        card.setAttribute('aria-label',(isRu(card) ? 'Открыть паспорт компании · ' : 'Open Company Passport · ') + String(visibleName && visibleName.textContent || '').trim());

        var footer = card.querySelector('.cc-extlink');
        if (!footer) {
            footer = document.createElement('span');
            card.appendChild(footer);
        }
        var alreadyUniform = footer.classList.contains('cc-passport-action') &&
            footer.querySelector('[data-i18n="card.explore"]') &&
            !footer.querySelector('.cc-ext-debank') &&
            footer.children.length === 2;
        footer.className='cc-extlink cc-passport-action';
        footer.removeAttribute('aria-disabled');
        footer.removeAttribute('role');
        footer.removeAttribute('tabindex');
        footer.removeAttribute('data-href');
        if (!alreadyUniform) footer.innerHTML=exploreMarkup(card);
    }

    function normalizeTree(root){
        if (!root) return;
        if (root.matches && root.matches('#companiesGrid .company-card:not(.placeholder)')) normalize(root);
        if (root.querySelectorAll) root.querySelectorAll('#companiesGrid .company-card:not(.placeholder), .company-card:not(.placeholder)').forEach(normalize);
    }

    function boot(){
        var grid=document.getElementById('companiesGrid');
        if (!grid) return;
        normalizeTree(grid);
        observer=new MutationObserver(function(records){
            records.forEach(function(record){
                record.addedNodes.forEach(function(node){
                    if (node && node.nodeType === 1) normalizeTree(node);
                });
            });
        });
        observer.observe(grid,{childList:true,subtree:true});
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
    else boot();
})();
</script>
`;
  const close='</body>';
  const count=companies.split(close).length-1;
  if(count!==1)fail(`Collection uniform Explore insertion: expected one </body>, found ${count}`);
  companies=companies.replace(close,addon+close);
}

for(const token of [
  marker,
  "card.setAttribute('href','#passport-' + reg)",
  "card.removeAttribute('target')",
  "cc-extlink cc-passport-action",
  'data-i18n="card.explore"',
  'Explore Company',
  'MutationObserver'
]){
  if(!companies.includes(token))fail(`Collection uniform Explore contract missing: ${token}`);
}

fs.writeFileSync(COMPANIES,companies);

console.log('Collection uniform Explore Company projection PASS',{
  uniformExploreCompany:true,
  wholeCardPassportTarget:true,
  externalCardTargetsRemoved:true,
  dynamicCompanyCardsObserved:true,
  passportRouterReused:true,
  executionAuthority:'none'
});
