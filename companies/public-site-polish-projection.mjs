#!/usr/bin/env node
/**
 * The Holding · canonical public-site polish entrypoint
 *
 * The existing public-site projection remains the core implementation. This
 * coordinator owns the Collection-card navigation contract requested by the
 * owner: every live company card has one destination — the top of The Holding
 * Index. Company-specific Passport deep links remain available independently,
 * but Collection cards never choose a Passport.
 *
 * No capital/accounting/reward/index semantics. executionAuthority = none.
 */

import fs from 'node:fs';

await import('./public-site-polish-projection-core.mjs');

const COMPANIES='companies/index.html';
const marker='data-th-collection-index-entry-v2';
const legacyMarker='data-th-collection-uniform-explore';
const fail=m=>{throw new Error(m);};
let companies=fs.readFileSync(COMPANIES,'utf8');

function replaceExactOnce(text,oldText,newText,label){
  if(text.includes(newText))return text;
  const count=text.split(oldText).length-1;
  if(count!==1)fail(`${label}: expected exactly one old projection, found ${count}`);
  return text.replace(oldText,newText);
}

function removeMarkedElement(text,startToken,endToken,label){
  const start=text.indexOf(startToken);
  if(start<0)return text;
  const second=text.indexOf(startToken,start+startToken.length);
  if(second>=0)fail(`${label}: duplicate start marker`);
  const end=text.indexOf(endToken,start);
  if(end<0)fail(`${label}: missing closing token`);
  return text.slice(0,start)+text.slice(end+endToken.length);
}

// One Collection navigation command. It deliberately lives inside the existing
// Passport/router script so click, keyboard, hash and history behavior share one
// navigation authority rather than competing event handlers.
companies=replaceExactOnce(companies,
`    function closeStablePassport(){
        if (typeof window.stablePassportSet === 'function') window.stablePassportSet(false,false);
    }
    function openGeneral(reg, name, opts){`,
`    function closeStablePassport(){
        if (typeof window.stablePassportSet === 'function') window.stablePassportSet(false,false);
    }
    function fixedTopInset(){
        var inset=16;
        document.querySelectorAll('header,.subnav').forEach(function(el){
            var style=window.getComputedStyle?window.getComputedStyle(el):null;
            if (!style || (style.position!=='fixed' && style.position!=='sticky')) return;
            var rect=el.getBoundingClientRect();
            if (rect.bottom>0 && rect.top<=8) inset=Math.max(inset,Math.ceil(rect.bottom)+12);
        });
        return inset;
    }
    function scrollCollectionIndexTop(){
        var section=document.getElementById('index');
        if (!section) return;
        var reduce=!!(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches);
        var top=section.getBoundingClientRect().top+window.pageYOffset-fixedTopInset();
        window.scrollTo({top:Math.max(0,top),behavior:reduce?'auto':'smooth'});
    }
    function writeIndexHash(push){
        try {
            if (push && location.hash!=='#index') history.pushState({thSurface:'index'},'','#index');
            else history.replaceState(history.state,'','#index');
        } catch (_) {}
    }
    function openCollectionIndex(opts){
        closeGeneralPassports();
        closeStablePassport();
        selectSurface('index');
        if (opts && opts.writeHash) writeIndexHash(!!opts.pushHistory);
        window.requestAnimationFrame(function(){
            window.requestAnimationFrame(scrollCollectionIndexTop);
        });
    }
    function openGeneral(reg, name, opts){`,
'Collection Index navigation authority');

companies=replaceExactOnce(companies,
`        var card = ev.target.closest('#companiesGrid .company-card:not(.placeholder)');
        if (card) {
            if (isExternalAffordance(ev.target)) return;
            var reg = card.dataset.thPassportRegistry || registryFromCard(card);
            if (!REGISTRY_TO_NAME[reg]) return;
            ev.preventDefault();
            ev.stopPropagation();
            openRegistry(reg,{writeHash:true,pushHistory:true});
            return;
        }`,
`        var card = ev.target.closest('#companiesGrid .company-card:not(.placeholder)');
        if (card) {
            ev.preventDefault();
            ev.stopPropagation();
            openCollectionIndex({writeHash:true,pushHistory:true});
            return;
        }`,
'Collection card click routes to Index');

companies=replaceExactOnce(companies,
`        var card = ev.target.closest('#companiesGrid .company-card.th-passport-entry');
        if (!card || card.tagName === 'A' || isExternalAffordance(ev.target)) return;
        if (ev.key !== 'Enter' && ev.key !== ' ') return;
        ev.preventDefault();
        var reg = card.dataset.thPassportRegistry || registryFromCard(card);
        openRegistry(reg,{writeHash:true,pushHistory:true});`,
`        var card = ev.target.closest('#companiesGrid .company-card.th-index-entry');
        if (!card || card.tagName === 'A') return;
        if (ev.key !== 'Enter' && ev.key !== ' ') return;
        ev.preventDefault();
        openCollectionIndex({writeHash:true,pushHistory:true});`,
'Collection card keyboard routes to Index');

companies=replaceExactOnce(companies,
`        if (match) {
            openRegistry(match[1],{writeHash:false,pushHistory:false});
            return;
        }
        if (hash === '#collection') {`,
`        if (match) {
            openRegistry(match[1],{writeHash:false,pushHistory:false});
            return;
        }
        if (hash === '#index') {
            openCollectionIndex({writeHash:false,pushHistory:false});
            return;
        }
        if (hash === '#collection') {`,
'Collection Index Back/Forward sync');

// Remove the superseded Passport-targeting Collection normalizer entirely. The
// new normalizer below is generic: no registry allow-list and no company-specific
// target. A future 011+ card inherits the same contract automatically.
companies=removeMarkedElement(
  companies,
  `<style ${legacyMarker}-style>`,
  '</style>',
  'Legacy Collection style removal'
);
companies=removeMarkedElement(
  companies,
  `<script ${legacyMarker}>`,
  '</script>',
  'Legacy Collection script removal'
);

if(!companies.includes(marker)){
  const addon=`
<style ${marker}-style>
    #companiesGrid .company-card.th-index-entry { cursor: pointer; }
    #companiesGrid .company-card.th-index-entry .cc-index-action { pointer-events: none; }
    #companiesGrid .company-card.th-index-entry:hover .cc-ext-label {
        opacity: 0.95;
        color: var(--gold);
    }
    #companiesGrid .company-card.th-index-entry:hover .cc-ext-arrow {
        color: var(--gold);
        opacity: 1;
        transform: translate(2px, -2px);
    }
    #companiesGrid .company-card.th-index-entry:focus-visible {
        outline: 1px solid var(--gold-line);
        outline-offset: 4px;
    }
</style>
<script ${marker}>
(function(){
    'use strict';
    var observer=null;

    function isRu(card){
        var row=card&&card.querySelector('.cc-regnum');
        return /^ru(?:-|$)/i.test(document.documentElement.lang||'') || /Реестр/i.test(String(row&&row.textContent||''));
    }

    function actionMarkup(card){
        var label=isRu(card)?'Перейти к компании':'Explore Company';
        return '<span class="cc-ext-label" data-i18n="card.explore">'+label+'</span>'+
            '<svg class="cc-ext-arrow" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M4.5 11.5L11.5 4.5M11.5 4.5H5.5M11.5 4.5V10.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    }

    function normalize(card){
        if (!card || card.classList.contains('placeholder')) return;

        card.classList.remove('th-passport-entry');
        card.classList.add('th-index-entry');
        delete card.dataset.thPassportRegistry;
        delete card.dataset.thPassportCompany;
        card.dataset.thIndexTarget='index';

        if (card.tagName==='A') {
            card.setAttribute('href','#index');
            card.removeAttribute('target');
            card.removeAttribute('rel');
        } else {
            card.setAttribute('role','link');
            card.setAttribute('tabindex','0');
        }

        card.setAttribute('aria-label',isRu(card)?'Открыть The Holding Index':'Open The Holding Index');

        var footer=card.querySelector('.cc-extlink');
        if (!footer) {
            footer=document.createElement('span');
            card.appendChild(footer);
        }
        var alreadyUniform=footer.classList.contains('cc-index-action') &&
            footer.querySelector('[data-i18n="card.explore"]') &&
            !footer.querySelector('.cc-ext-debank') &&
            footer.children.length===2;
        footer.className='cc-extlink cc-index-action';
        footer.removeAttribute('aria-disabled');
        footer.removeAttribute('role');
        footer.removeAttribute('tabindex');
        footer.removeAttribute('data-href');
        if (!alreadyUniform) footer.innerHTML=actionMarkup(card);
    }

    function normalizeTree(root){
        if (!root) return;
        if (root.matches&&root.matches('#companiesGrid .company-card:not(.placeholder)')) normalize(root);
        if (root.querySelectorAll) root.querySelectorAll('#companiesGrid .company-card:not(.placeholder), .company-card:not(.placeholder)').forEach(normalize);
    }

    function boot(){
        var grid=document.getElementById('companiesGrid');
        if (!grid) return;
        normalizeTree(grid);
        observer=new MutationObserver(function(records){
            records.forEach(function(record){
                var ownerCard=record.target&&record.target.closest?record.target.closest('#companiesGrid .company-card:not(.placeholder)'):null;
                if (ownerCard) normalize(ownerCard);
                record.addedNodes.forEach(function(node){
                    if (node&&node.nodeType===1) normalizeTree(node);
                });
            });
        });
        observer.observe(grid,{childList:true,subtree:true});
        document.querySelectorAll('.lang-switch button').forEach(function(btn){
            if (btn.dataset.thIndexEntryBound==='1') return;
            btn.dataset.thIndexEntryBound='1';
            btn.addEventListener('click',function(){window.requestAnimationFrame(function(){normalizeTree(grid);});});
        });
    }

    if (document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
    else boot();
})();
</script>
`;
  const close='</body>';
  const count=companies.split(close).length-1;
  if(count!==1)fail(`Collection Index entry insertion: expected one </body>, found ${count}`);
  companies=companies.replace(close,addon+close);
}

for(const token of [
  marker,
  "card.setAttribute('href','#index')",
  "card.classList.add('th-index-entry')",
  "card.dataset.thIndexTarget='index'",
  'Open The Holding Index',
  'MutationObserver',
  'ownerCard',
  'function openCollectionIndex(opts)',
  "document.getElementById('index')",
  'openCollectionIndex({writeHash:true,pushHistory:true});',
  "if (hash === '#index')"
]){
  if(!companies.includes(token))fail(`Collection Index contract missing: ${token}`);
}
if(companies.includes(`<script ${legacyMarker}>`) || companies.includes(`<style ${legacyMarker}-style>`)){
  fail('Legacy company-specific Collection normalizer still materialized');
}

fs.writeFileSync(COMPANIES,companies);

// Production-proof boundary: GREEN requires the exact file that is deployed to
// contain the generic Collection -> Index contract. Passport deep-link routing
// remains available, but no Collection card may materialize a Passport target.
const materialized=fs.readFileSync(COMPANIES,'utf8');
for(const token of [
  'data-th-collection-passport-routing',
  marker,
  'function openCollectionIndex(opts)',
  "document.getElementById('index')",
  "card.setAttribute('href','#index')",
  "card.classList.add('th-index-entry')",
  'openCollectionIndex({writeHash:true,pushHistory:true});',
  "window.addEventListener('popstate',scheduleLocationSync)"
]){
  if(!materialized.includes(token))fail(`Physical Collection -> Index materialization missing: ${token}`);
}
if(materialized.includes(`<script ${legacyMarker}>`) || materialized.includes(`<style ${legacyMarker}-style>`)){
  fail('Physical artifact still contains superseded Collection Passport normalizer');
}

console.log('Collection uniform The Holding Index projection PASS',{
  oneDestinationForAllCards:true,
  collectionTarget:'The Holding Index',
  genericFutureCards:true,
  smoothIndexTop:true,
  fixedHeaderAware:true,
  deepPassportLinksPreserved:true,
  backForwardIndexSync:true,
  externalCardTargetsRemoved:true,
  dynamicCompanyCardsObserved:true,
  physicalArtifactVerified:true,
  executionAuthority:'none'
});
