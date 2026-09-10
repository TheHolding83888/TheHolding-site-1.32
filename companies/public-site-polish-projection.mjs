#!/usr/bin/env node
import fs from 'node:fs';

const HOME='index.html';
const YIELD_REPORTS='yield-reports/index.html';
const fail=m=>{throw new Error(m);};

function replaceOnce(text,oldText,newText,label){
  if(text.includes(newText))return text;
  const count=text.split(oldText).length-1;
  if(count!==1)fail(`${label}: expected exactly one old projection, found ${count}`);
  return text.replace(oldText,newText);
}

let home=fs.readFileSync(HOME,'utf8');

// Package 2 · compact product navigation. Keep Funds together as one group and
// expose the two major platform surfaces before the fund-specific links.
home=replaceOnce(home,
`                <a href="/for-investors" class="nav-link">How It Works</a>\n                <a href="/faq" class="nav-link">FAQ</a>\n                \n                <div class="nav-separator"></div>`,
`                <a href="/for-investors" class="nav-link">How It Works</a>\n                <a href="/faq" class="nav-link">FAQ</a>\n                <a href="/companies" class="nav-link">Companies</a>\n                <a href="/realty" class="nav-link">Real Estate</a>\n                \n                <div class="nav-separator"></div>`,
'homepage product navigation');

const oldDelays=`            .nav-links.active > :nth-child(1) { animation-delay: 0.05s; }  /* Home */\n            .nav-links.active > :nth-child(2) { animation-delay: 0.1s; }   /* separator */\n            .nav-links.active > :nth-child(3) { animation-delay: 0.15s; }  /* How It Works */\n            .nav-links.active > :nth-child(4) { animation-delay: 0.18s; }  /* FAQ */\n            .nav-links.active > :nth-child(5) { animation-delay: 0.23s; }  /* separator */\n            .nav-links.active > :nth-child(6) { animation-delay: 0.28s; }  /* Substantia */\n            .nav-links.active > :nth-child(7) { animation-delay: 0.31s; }  /* Defitea */\n            .nav-links.active > :nth-child(8) { animation-delay: 0.34s; }  /* Singul */\n            .nav-links.active > :nth-child(9) { animation-delay: 0.37s; }  /* Monetra */\n            .nav-links.active > :nth-child(10) { animation-delay: 0.40s; } /* Fructus */\n            .nav-links.active > :nth-child(11) { animation-delay: 0.45s; } /* separator */\n            .nav-links.active > :nth-child(12) { animation-delay: 0.50s; } /* Blog */`;
const newDelays=`            .nav-links.active > :nth-child(1) { animation-delay: 0.05s; }  /* Home */\n            .nav-links.active > :nth-child(2) { animation-delay: 0.09s; }  /* separator */\n            .nav-links.active > :nth-child(3) { animation-delay: 0.13s; }  /* How It Works */\n            .nav-links.active > :nth-child(4) { animation-delay: 0.17s; }  /* FAQ */\n            .nav-links.active > :nth-child(5) { animation-delay: 0.21s; }  /* Companies */\n            .nav-links.active > :nth-child(6) { animation-delay: 0.25s; }  /* Real Estate */\n            .nav-links.active > :nth-child(7) { animation-delay: 0.29s; }  /* separator */\n            .nav-links.active > :nth-child(8) { animation-delay: 0.33s; }  /* Substantia */\n            .nav-links.active > :nth-child(9) { animation-delay: 0.36s; }  /* Defitea */\n            .nav-links.active > :nth-child(10) { animation-delay: 0.39s; } /* Singul */\n            .nav-links.active > :nth-child(11) { animation-delay: 0.42s; } /* Monetra */\n            .nav-links.active > :nth-child(12) { animation-delay: 0.45s; } /* Fructus */\n            .nav-links.active > :nth-child(13) { animation-delay: 0.48s; } /* separator */\n            .nav-links.active > :nth-child(14) { animation-delay: 0.51s; } /* Blog */`;
home=replaceOnce(home,oldDelays,newDelays,'homepage mobile navigation sequence');

home=replaceOnce(home,
`                        <a href="/companies" class="footer-link">\n                            <span>Companies</span>\n                        </a>\n                        <a href="/manifesto" class="footer-link">`,
`                        <a href="/companies" class="footer-link">\n                            <span>Companies</span>\n                        </a>\n                        <a href="/realty" class="footer-link">\n                            <span>Real Estate</span>\n                        </a>\n                        <a href="/manifesto" class="footer-link">`,
'homepage footer Realty link');
home=replaceOnce(home,
`                        <span class="copyright-line1">Funds · Index · Onchain Companies · Real Estate</span>\n                        <span class="copyright-line2">Self-custodied capital architecture · Not financial advice</span>`,
`                        <span class="copyright-line1">Capital Architecture · Onchain Companies · Real Estate</span>\n                        <span class="copyright-line2">Self-custodied capital architecture · Not financial advice</span>`,
'homepage Capital Architecture footer description');

const pyramidScript=`    <script data-th-fund-pyramid-links>\n    (function(){\n      var routes={substantia:'/substantia',defitea:'/defitea',singul:'/singul',fructus:'/fructus',monetra:'/monetra'};\n      function bind(){\n        document.querySelectorAll('.pyramid-item[data-allocation], .mobile-fund-card[data-allocation]').forEach(function(el){\n          var key=el.getAttribute('data-allocation'); var href=routes[key]; if(!href||el.dataset.thFundLinked==='1')return;\n          el.dataset.thFundLinked='1'; el.setAttribute('role','link'); el.setAttribute('tabindex','0'); el.style.cursor='pointer';\n          el.addEventListener('click',function(e){if(e.target.closest('a,button'))return; location.href=href;});\n          el.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();location.href=href;}});\n        });\n      }\n      if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();\n    })();\n    </script>\n`;
if(!home.includes('data-th-fund-pyramid-links')){
  const close='</body>';
  const count=home.split(close).length-1;
  if(count!==1)fail(`homepage pyramid script insertion: expected one </body>, found ${count}`);
  home=home.replace(close,pyramidScript+close);
}
for(const token of ['href="/companies"','href="/realty"',"substantia:'/substantia'","defitea:'/defitea'","singul:'/singul'","fructus:'/fructus'","monetra:'/monetra'","Capital Architecture · Onchain Companies · Real Estate"]){
  if(!home.includes(token))fail(`homepage public polish missing: ${token}`);
}
fs.writeFileSync(HOME,home);

// Package 3 · Defitea report mobile polish. The existing shared <=900px rule
// hides column 2 on both report tables; that removes Defitea Cash Flow, the core
// monthly metric. Restore only Defitea column 2 on phones and keep desktop and
// Monetra behavior untouched.
let reports=fs.readFileSync(YIELD_REPORTS,'utf8');
const reportMarker='/* The Holding · Defitea mobile cash-flow polish */';
if(!reports.includes(reportMarker)){
  const mobileCss=`\n        ${reportMarker}\n        @media (max-width: 600px) {\n            .defitea-reports .report-table th:nth-child(2),\n            .defitea-reports .report-table td:nth-child(2) { display: table-cell; }\n            .defitea-reports .report-table th,\n            .defitea-reports .report-table td { padding-left: 0.42rem; padding-right: 0.42rem; }\n            .defitea-reports .report-table th:nth-child(1), .defitea-reports .report-table td:nth-child(1) { width: 24%; }\n            .defitea-reports .report-table th:nth-child(2), .defitea-reports .report-table td:nth-child(2) { width: 30%; text-align: right; }\n            .defitea-reports .report-table th:nth-child(3), .defitea-reports .report-table td:nth-child(3) { width: 23%; text-align: center; }\n            .defitea-reports .report-table th:nth-child(4), .defitea-reports .report-table td:nth-child(4) { width: 23%; text-align: center; }\n            .defitea-reports .report-table th:nth-child(5), .defitea-reports .report-table td:nth-child(5) { display: none; }\n            .defitea-reports .td-month { font-size: 1rem; }\n            .defitea-reports .td-yield { font-size: 1.14rem; }\n            .defitea-reports .td-num, .defitea-reports .td-apy { font-size: 0.76rem; }\n        }\n`;
  const close='    </style>';
  const count=reports.split(close).length-1;
  if(count!==1)fail(`Yield Reports mobile CSS insertion: expected one </style>, found ${count}`);
  reports=reports.replace(close,mobileCss+close);
}
if(!reports.includes(reportMarker)||!reports.includes('.defitea-reports .report-table td:nth-child(2) { display: table-cell; }'))fail('Defitea mobile Cash Flow visibility contract missing');
fs.writeFileSync(YIELD_REPORTS,reports);

console.log('Public site polish projection PASS',{
  homepageCompaniesLink:true,
  homepageRealtyLink:true,
  footerWholeHoldingDescription:true,
  fiveFundPyramidRoutes:true,
  defiteaMobileCashFlowVisible:true,
  desktopReportsUntouched:true,
  executionAuthority:'none'
});
