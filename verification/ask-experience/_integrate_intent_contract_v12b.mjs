import fs from 'node:fs';

const appPath='agents/console/app.js';
const indexPath='agents/index.html';
let app=fs.readFileSync(appPath,'utf8');
let html=fs.readFileSync(indexPath,'utf8');

const strictAnchor="(() => {\n  'use strict';\n\n";
if ((app.split(strictAnchor).length-1)!==1) throw new Error('app strict anchor mismatch');
const contractBlock=`(() => {\n  'use strict';\n\n  const intentContract = window.HoldingIntentContract;\n\n  function validateIntentContract() {\n    if (!intentContract || intentContract.VERSION !== '0.1-intent-contract-firewall') throw new Error('Intent Contract unavailable');\n    const capability = intentContract.capability();\n    if (!capability || capability.executionAuthority !== 'none' || capability.canAnswer !== false || capability.canSetConfidence !== false || capability.canSelectSourcesAsTruth !== false || capability.canExecute !== false) {\n      throw new Error('Intent Contract authority boundary mismatch');\n    }\n    const valid = intentContract.validate({ intent: 'owner-brief' });\n    const poisoned = intentContract.validate({ intent: 'owner-brief', answer: 'forbidden' });\n    if (!valid?.ok || poisoned?.ok) throw new Error('Intent Contract validation invariant failed');\n    return capability;\n  }\n\n`;
app=app.replace(strictAnchor,contractBlock);

const bootAnchor=`  async function boot() {\n    buildQuick();\n    try {`;
if ((app.split(bootAnchor).length-1)!==1) throw new Error('boot anchor mismatch');
app=app.replace(bootAnchor,`  async function boot() {\n    try {\n      validateIntentContract();\n      buildQuick();`);
fs.writeFileSync(appPath,app);

const scriptsAnchor=`    <script src="/agents/console/safety.js?v=0.1" defer></script>\n    <script src="/agents/console/app.js?v=1.1" defer></script>`;
if ((html.split(scriptsAnchor).length-1)!==1) throw new Error('script anchor mismatch');
html=html.replace(scriptsAnchor,`    <script src="/agents/console/safety.js?v=0.1" defer></script>\n    <script src="/agents/console/intent-contract.js?v=0.1" defer></script>\n    <script src="/agents/console/app.js?v=1.2b" defer></script>`);
fs.writeFileSync(indexPath,html);

console.log(JSON.stringify({liveIntentContractIntegrated:true,appBootFailClosed:true,scriptOrder:['safety','intent-contract','app']},null,2));
