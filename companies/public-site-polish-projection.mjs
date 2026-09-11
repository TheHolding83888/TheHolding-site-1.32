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
const focusMarker='data-th-passport-focus-v2';
const fail=m=>{throw new Error(m);};
let companies=fs.readFileSync(COMPANIES,'utf8');

function replaceExactOnce(text,oldText,newText,label){
  if(text.includes(newText))return text;
  const count=text.split(oldText).length-1;
  if(count!==1)fail(`${label}: expected exactly one old projection, found ${count}`);
  return text.replace(oldText,newText);
}

// Passport viewport contract. Collection cards should open the exact company,
// not merely the top of the Index. After the existing disclosure finishes its
// layout transition, place the company row in a stable upper-third focus zone
// so the Passport itself is immediately readable on desktop and mobile.
if(!companies.includes(focusMarker)){
  companies=replaceExactOnce(companies,
`    function scrollRow(row){
        if (!row) return;
        var offset = window.innerWidth < 760 ? 72 : 104;
        var top = row.getBoundingClientRect().top + window.pageYOffset - offset;
        window.scrollTo({top:Math.max(0,top),behavior:(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)?'auto':'smooth'});
    }`,
`    var PASSPORT_FOCUS_MARKER='${focusMarker}';
    function passportFocusOffset(){
        return Math.max(84,Math.min(Math.round(window.innerHeight*0.20),170));
    }
    function focusPassport(block,anchor){
        if (!block) return;
        var reduce=!!(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches);
        var started=performance.now();
        var lastHeight=-1;
        var stableFrames=0;
        (function settle(){
            if (!block.isConnected) return;
            var height=block.getBoundingClientRect().height;
            stableFrames=Math.abs(height-lastHeight)<1?stableFrames+1:0;
            lastHeight=height;
            if (stableFrames<3&&performance.now()-started<650){
                requestAnimationFrame(settle);
                return;
            }
            var target=anchor&&anchor.isConnected?anchor:block;
            var rect=target.getBoundingClientRect();
            var top=window.pageYOffset+rect.top-passportFocusOffset();
            var maxTop=Math.max(0,document.documentElement.scrollHeight-window.innerHeight);
            window.scrollTo({top:Math.min(Math.max(0,top),maxTop),behavior:reduce?'auto':'smooth'});
        })();
    }
    function scrollRow(row){
        if (!row) return;
        focusPassport(row.closest('.ib-item')||row,row);
    }`,
  'Companies Passport contextual focus helper');

  companies=replaceExactOnce(companies,
`            if (row && !item.classList.contains('open')) row.click();
            else scrollRow(row);
            if (opts && opts.writeHash) writePassportHash(reg,!!opts.pushHistory);`,
`            if (row && !item.classList.contains('open')) row.click();
            focusPassport(item,row);
            if (opts && opts.writeHash) writePassportHash(reg,!!opts.pushHistory);`,
  'Companies general Passport post-open focus');

  companies=replaceExactOnce(companies,
`            if (passport && typeof window.stablePassportSet === 'function') {
                window.stablePassportSet(true,true);
                if (opts && opts.writeHash) writePassportHash(reg,!!opts.pushHistory);
                return;
            }`,
`            if (passport && typeof window.stablePassportSet === 'function') {
                window.stablePassportSet(true,true);
                focusPassport(passport,passport);
                if (opts && opts.writeHash) writePassportHash(reg,!!opts.pushHistory);
                return;
            }`,
  'Companies Stable Passport post-open focus');
}

for(const token of [
  focusMarker,
  'function focusPassport(block,anchor)',
  'stableFrames<3&&performance.now()-started<650',
  'focusPassport(item,row);',
  'focusPassport(passport,passport);'
]){
  if(!companies.includes(token))fail(`Collection Passport focus contract missing: ${token}`);
}

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
                var ownerCard = record.target && record.target.closest ? record.target.closest('#companiesGrid .company-card:not(.placeholder)') : null;
                if (ownerCard) normalize(ownerCard);
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
  'MutationObserver',
  'ownerCard'
]){
  if(!companies.includes(token))fail(`Collection uniform Explore contract missing: ${token}`);
}

fs.writeFileSync(COMPANIES,companies);

// Production-proof boundary: the projector is not considered successful until
// the file that is actually deployed contains the Passport router, the
// contextual focus contract and the owner-requested single-action Collection
// normalizer. This catches a green source change that failed to materialize into
// the public artifact.
const materialized=fs.readFileSync(COMPANIES,'utf8');
for(const token of [
  'data-th-collection-passport-routing',
  focusMarker,
  'function focusPassport(block,anchor)',
  'focusPassport(item,row);',
  marker,
  "card.setAttribute('href','#passport-' + reg)",
  "footer.className='cc-extlink cc-passport-action'",
  "window.addEventListener('popstate',scheduleLocationSync)"
]){
  if(!materialized.includes(token))fail(`Physical Collection Passport/Explore materialization missing: ${token}`);
}

console.log('Collection uniform Explore Company projection PASS',{
  uniformExploreCompany:true,
  wholeCardPassportTarget:true,
  externalCardTargetsRemoved:true,
  dynamicCompanyCardsObserved:true,
  contextualPassportFocus:true,
  focusAfterDisclosureSettles:true,
  physicalArtifactVerified:true,
  passportRouterReused:true,
  executionAuthority:'none'
});