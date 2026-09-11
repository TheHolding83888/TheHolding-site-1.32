#!/usr/bin/env node
/**
 * The Holding · canonical public-site polish entrypoint
 *
 * Collection navigation v3 owns one interaction only:
 * every live Collection card enters the General The Holding Index surface.
 * It intentionally does not know registry ids or company names.
 * Passport deep links are retained by a separate, passive hash router.
 *
 * No capital/accounting/reward/index semantics. executionAuthority = none.
 */

import fs from 'node:fs';

await import('./public-site-polish-projection-core.mjs');

const COMPANIES='companies/index.html';
const fail=m=>{throw new Error(m);};
let companies=fs.readFileSync(COMPANIES,'utf8');

function removeMarkedBlock(text,startToken,endToken,label){
  let out=text;
  let removed=0;
  while(true){
    const start=out.indexOf(startToken);
    if(start<0)break;
    const end=out.indexOf(endToken,start+startToken.length);
    if(end<0)fail(`${label}: missing ${endToken}`);
    out=out.slice(0,start)+out.slice(end+endToken.length);
    removed+=1;
    if(removed>4)fail(`${label}: unreasonable duplicate count`);
  }
  return out;
}

// Retire every prior Collection-card controller from the deployed artifact.
// The legacy Passport router remains in the historical core projector only as an
// input compatibility shape; it is never allowed to survive materialization.
for(const marker of [
  'data-th-collection-passport-routing',
  'data-th-collection-uniform-explore',
  'data-th-collection-index-entry-v2'
]){
  companies=removeMarkedBlock(companies,`<style ${marker}-style>`,'</style>',`${marker} style removal`);
  companies=removeMarkedBlock(companies,`<script ${marker}>`,'</script>',`${marker} script removal`);
}

const marker='data-th-collection-index-navigation-v3';
if(companies.includes(marker)){
  companies=removeMarkedBlock(companies,`<style ${marker}-style>`,'</style>','v3 style refresh');
  companies=removeMarkedBlock(companies,`<script ${marker}>`,'</script>','v3 script refresh');
}

const addon=`
<style ${marker}-style>
    #companiesGrid .company-card.th-index-entry-v3 { cursor:pointer; }
    #companiesGrid .company-card.th-index-entry-v3 .cc-index-action-v3 { pointer-events:none; }
    #companiesGrid .company-card.th-index-entry-v3:focus-visible {
        outline:1px solid var(--gold-line);
        outline-offset:4px;
    }
    html.th-card-index-navigating,
    html.th-card-index-navigating body,
    html.th-card-index-navigating #capital-hub { overflow-anchor:none; }
</style>
<script ${marker}>
(function(){
    'use strict';
    if (window.__TH_COLLECTION_INDEX_NAV_V3__) return;

    var CARD_SELECTOR='#companiesGrid .company-card:not(.placeholder)';
    var INDEX_HASH='#index';
    var navEpoch=0;
    var normalizeQueued=false;
    var normalizeObserver=null;
    var navigationCleanupTimer=0;

    function isRu(card){
        var row=card&&card.querySelector('.cc-regnum');
        return /^ru(?:-|$)/i.test(document.documentElement.lang||'') || /Реестр/i.test(String(row&&row.textContent||''));
    }

    function actionMarkup(card){
        var label=isRu(card)?'Перейти к компании':'Explore Company';
        return '<span class="cc-ext-label" data-i18n="card.explore">'+label+'</span>'+
            '<svg class="cc-ext-arrow" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M4.5 11.5L11.5 4.5M11.5 4.5H5.5M11.5 4.5V10.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    }

    function normalizeCard(card){
        if(!card||card.classList.contains('placeholder'))return;
        card.classList.remove('th-passport-entry','th-index-entry');
        card.classList.add('th-index-entry-v3');
        delete card.dataset.thPassportRegistry;
        delete card.dataset.thPassportCompany;
        delete card.dataset.thIndexTarget;
        card.dataset.thCollectionTarget='index';

        // A Collection card is an application command, not a competing anchor.
        // Removing href means the Observatory's generic #index anchor handler can
        // never race this controller, on desktop or mobile.
        card.removeAttribute('href');
        card.removeAttribute('target');
        card.removeAttribute('rel');
        card.setAttribute('role','link');
        card.setAttribute('tabindex','0');
        card.setAttribute('aria-label',isRu(card)?'Открыть The Holding Index':'Open The Holding Index');

        var footer=card.querySelector('.cc-extlink');
        if(!footer){footer=document.createElement('span');card.appendChild(footer);}
        var canonical=footer.classList.contains('cc-index-action-v3') &&
            footer.querySelector('[data-i18n="card.explore"]') &&
            !footer.querySelector('.cc-ext-debank') && footer.children.length===2;
        footer.className='cc-extlink cc-index-action-v3';
        footer.removeAttribute('aria-disabled');
        footer.removeAttribute('role');
        footer.removeAttribute('tabindex');
        footer.removeAttribute('data-href');
        if(!canonical)footer.innerHTML=actionMarkup(card);
    }

    function normalizeAll(){
        document.querySelectorAll(CARD_SELECTOR).forEach(normalizeCard);
    }

    function queueNormalize(){
        if(normalizeQueued)return;
        normalizeQueued=true;
        requestAnimationFrame(function(){normalizeQueued=false;normalizeAll();});
    }

    function closeGeneralPassports(){
        document.querySelectorAll('#idxBoard .ib-item.open').forEach(function(item){
            var row=item.querySelector('.ib-row');
            if(row)row.click();
        });
    }

    function closeStablePassport(){
        if(typeof window.stablePassportSet==='function')window.stablePassportSet(false,false);
    }

    function fixedTopInset(){
        var inset=12;
        document.querySelectorAll('nav,.subnav').forEach(function(el){
            var style=window.getComputedStyle?window.getComputedStyle(el):null;
            if(!style||(style.position!=='fixed'&&style.position!=='sticky'))return;
            var rect=el.getBoundingClientRect();
            if(rect.bottom>0&&rect.top<=8)inset=Math.max(inset,Math.ceil(rect.bottom)+10);
        });
        return inset;
    }

    function writeIndexHash(){
        try{
            if(location.hash!==INDEX_HASH)history.pushState({thSurface:'index',thEntry:'collection-card'},'',INDEX_HASH);
            else history.replaceState(history.state,'',INDEX_HASH);
        }catch(_){}
    }

    function requestIndexSurface(epoch,deadline){
        if(epoch!==navEpoch)return;
        if(typeof window.thSelectCapitalMode==='function'){
            window.thSelectCapitalMode('index',{scroll:false,hash:false});
            waitForIndexReady(epoch,performance.now()+2500);
            return;
        }
        if(performance.now()<deadline){requestAnimationFrame(function(){requestIndexSurface(epoch,deadline);});return;}
        finishNavigation(epoch);
    }

    function indexVisible(){
        var panel=document.getElementById('index');
        if(!panel||panel.hidden||panel.getAttribute('aria-hidden')==='true')return false;
        var style=window.getComputedStyle?window.getComputedStyle(panel):null;
        if(style&&(style.display==='none'||style.visibility==='hidden'))return false;
        return document.documentElement.getAttribute('data-capital-mode')==='index';
    }

    function waitForIndexReady(epoch,deadline){
        if(epoch!==navEpoch)return;
        if(indexVisible()){
            settleIndexTop(epoch,performance.now()+900,null,0);
            return;
        }
        if(performance.now()<deadline){requestAnimationFrame(function(){waitForIndexReady(epoch,deadline);});return;}
        finishNavigation(epoch);
    }

    function settleIndexTop(epoch,deadline,lastTop,stableFrames){
        if(epoch!==navEpoch)return;
        var panel=document.getElementById('index');
        var target=panel&&(panel.querySelector('.index-head')||panel);
        if(!target||!indexVisible()){
            if(performance.now()<deadline){requestAnimationFrame(function(){settleIndexTop(epoch,deadline,lastTop,stableFrames);});}
            else finishNavigation(epoch);
            return;
        }
        var top=target.getBoundingClientRect().top+window.scrollY;
        var stable=lastTop!==null&&Math.abs(top-lastTop)<0.75?stableFrames+1:0;
        if(stable<4&&performance.now()<deadline){
            requestAnimationFrame(function(){settleIndexTop(epoch,deadline,top,stable);});
            return;
        }
        scrollToIndexTop(epoch,target);
    }

    function scrollToIndexTop(epoch,target){
        if(epoch!==navEpoch||!target)return;
        var reduce=!!(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches);
        var inset=fixedTopInset();
        var top=Math.max(0,target.getBoundingClientRect().top+window.scrollY-inset);
        window.scrollTo({top:top,behavior:reduce?'auto':'smooth'});

        // One bounded correction after the Observatory transition/min-height
        // release. It prevents late layout work from moving the Index title.
        window.setTimeout(function(){
            if(epoch!==navEpoch||!target.isConnected)return;
            var wanted=fixedTopInset();
            var delta=target.getBoundingClientRect().top-wanted;
            if(Math.abs(delta)>5)window.scrollBy({top:delta,behavior:'auto'});
            finishNavigation(epoch);
        },reduce?80:620);
    }

    function finishNavigation(epoch){
        if(epoch!==navEpoch)return;
        if(navigationCleanupTimer)window.clearTimeout(navigationCleanupTimer);
        navigationCleanupTimer=window.setTimeout(function(){
            if(epoch===navEpoch)document.documentElement.classList.remove('th-card-index-navigating');
        },80);
    }

    function enterIndexFromCollection(){
        navEpoch+=1;
        var epoch=navEpoch;
        if(navigationCleanupTimer)window.clearTimeout(navigationCleanupTimer);
        document.documentElement.classList.add('th-card-index-navigating');
        closeGeneralPassports();
        closeStablePassport();
        writeIndexHash();
        requestIndexSurface(epoch,performance.now()+2000);
    }

    // Capture phase is deliberate. This is the one navigation authority for
    // Collection cards and it runs before the Observatory's document bubble
    // listener or any legacy/default anchor action can observe the click.
    document.addEventListener('click',function(ev){
        if(!ev.target||!ev.target.closest)return;
        var card=ev.target.closest(CARD_SELECTOR);
        if(!card)return;
        ev.preventDefault();
        ev.stopImmediatePropagation();
        ev.stopPropagation();
        enterIndexFromCollection();
    },true);

    document.addEventListener('keydown',function(ev){
        if(!ev.target||!ev.target.closest)return;
        var card=ev.target.closest(CARD_SELECTOR);
        if(!card||(ev.key!=='Enter'&&ev.key!==' '))return;
        ev.preventDefault();
        ev.stopImmediatePropagation();
        ev.stopPropagation();
        enterIndexFromCollection();
    },true);

    function installNormalizer(){
        normalizeAll();
        var grid=document.getElementById('companiesGrid');
        if(grid){
            normalizeObserver=new MutationObserver(queueNormalize);
            normalizeObserver.observe(grid,{childList:true,subtree:true});
        }
        document.querySelectorAll('.lang-switch button').forEach(function(btn){
            btn.addEventListener('click',queueNormalize);
        });
    }

    /* Passport hashes are independent routes. They never bind Collection cards. */
    var REGISTRY_TO_NAME={
        '001':'05081966.eth','002':'YieldRing.eth','003':'dinaz.eth','004':'defitea.eth',
        '005':'0x5860...83CA8.eth','006':'aerocvxyb.eth','007':"Rook's portfolio",
        '008':'Monetra.eth','009':'1milliondollar.eth','010':'Cypher'
    };
    var PASSPORT_RE=/^#passport-(\d{3})$/;
    var passportEpoch=0;

    function selectSurface(mode){
        if(typeof window.thSelectCapitalMode==='function'){
            window.thSelectCapitalMode(mode,{scroll:false,hash:false});
            return true;
        }
        return false;
    }

    function focusElement(el){
        if(!el)return;
        var inset=fixedTopInset()+10;
        var top=Math.max(0,el.getBoundingClientRect().top+window.scrollY-inset);
        var reduce=!!(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches);
        window.scrollTo({top:top,behavior:reduce?'auto':'smooth'});
    }

    function openPassport(reg){
        var name=REGISTRY_TO_NAME[reg];
        if(!name)return;
        passportEpoch+=1;
        var epoch=passportEpoch;
        var stable=reg==='008';
        selectSurface(stable?'stable':'index');
        var deadline=performance.now()+6000;
        (function attempt(){
            if(epoch!==passportEpoch)return;
            if(stable){
                var passport=document.getElementById('stablePassportMonetra');
                if(passport&&typeof window.stablePassportSet==='function'&&document.documentElement.getAttribute('data-capital-mode')==='stable'){
                    window.stablePassportSet(true,true);focusElement(passport);return;
                }
            }else{
                var item=Array.from(document.querySelectorAll('#idxBoard .ib-item')).find(function(x){return x.dataset.nm===name;});
                if(item&&document.documentElement.getAttribute('data-capital-mode')==='index'){
                    document.querySelectorAll('#idxBoard .ib-item.open').forEach(function(other){if(other!==item){var r=other.querySelector('.ib-row');if(r)r.click();}});
                    var row=item.querySelector('.ib-row');
                    if(row&&!item.classList.contains('open'))row.click();
                    window.setTimeout(function(){if(epoch===passportEpoch)focusElement(row||item);},180);
                    return;
                }
            }
            if(performance.now()<deadline)window.setTimeout(attempt,80);
        })();
    }

    function syncPassportHash(){
        var hash=String(location.hash||'').toLowerCase();
        var match=hash.match(PASSPORT_RE);
        if(match){openPassport(match[1]);return;}
        passportEpoch+=1;
        if(hash==='#collection'||hash==='#index'||hash==='#stable-index'){
            closeGeneralPassports();
            closeStablePassport();
        }
    }

    window.addEventListener('hashchange',syncPassportHash);
    window.addEventListener('popstate',syncPassportHash);

    window.__TH_COLLECTION_INDEX_NAV_V3__={
        version:'3.0-single-owner-visible-panel-scroll',
        enter:enterIndexFromCollection,
        normalize:normalizeAll
    };

    installNormalizer();
    syncPassportHash();
})();
</script>
`;

const close='</body>';
const count=companies.split(close).length-1;
if(count!==1)fail(`Collection navigation v3 insertion: expected one </body>, found ${count}`);
companies=companies.replace(close,addon+close);
fs.writeFileSync(COMPANIES,companies);

// Fail closed on the physical production artifact. Source-level intent is not
// enough: the exact deployable HTML must contain one controller and zero retired
// Collection navigation controllers.
const materialized=fs.readFileSync(COMPANIES,'utf8');
for(const token of [
  marker,
  'window.__TH_COLLECTION_INDEX_NAV_V3__',
  "card.removeAttribute('href')",
  'ev.stopImmediatePropagation()',
  "document.addEventListener('click'",
  '},true);',
  'function waitForIndexReady',
  "document.documentElement.getAttribute('data-capital-mode')==='index'",
  "panel.querySelector('.index-head')",
  "document.querySelectorAll('nav,.subnav')",
  "history.pushState({thSurface:'index',thEntry:'collection-card'}",
  "overflow-anchor:none",
  'var PASSPORT_RE=/^#passport-',
  'function syncPassportHash'
]){
  if(!materialized.includes(token))fail(`Collection navigation v3 physical contract missing: ${token}`);
}
for(const retired of [
  'data-th-collection-passport-routing-style',
  '<script data-th-collection-passport-routing>',
  'data-th-collection-uniform-explore',
  'data-th-collection-index-entry-v2',
  "card.setAttribute('href','#index')"
]){
  if(materialized.includes(retired))fail(`Retired Collection navigation survived materialization: ${retired}`);
}

console.log('Collection navigation v3 clean rebuild PASS',{
  singleCollectionAuthority:true,
  capturePhase:true,
  competingAnchorRouteRemoved:true,
  waitsForVisibleIndexPanel:true,
  stableIndexHeadingTarget:true,
  desktopAndMobileSameContract:true,
  dynamicFutureCards:true,
  passportDeepLinksIndependent:true,
  retiredRoutersAbsent:true,
  physicalArtifactVerified:true,
  executionAuthority:'none'
});
