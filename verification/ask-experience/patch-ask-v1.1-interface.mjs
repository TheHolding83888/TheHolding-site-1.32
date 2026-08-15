import fs from 'node:fs';

const indexPath='agents/index.html';
const appPath='agents/console/app.js';
const corePath='verification/ask-experience/corpus-core-v0.1.json';
let html=fs.readFileSync(indexPath,'utf8');
let app=fs.readFileSync(appPath,'utf8');
const core=JSON.parse(fs.readFileSync(corePath,'utf8'));

function replaceOnce(source,before,after,label){
  const n=source.split(before).length-1;
  if(n!==1) throw new Error(`${label}: expected 1 anchor, found ${n}`);
  return source.replace(before,after);
}

html=replaceOnce(html,'CAPITAL OS INTELLIGENCE <span class="oslab-version">v1.0</span>','CAPITAL OS INTELLIGENCE <span class="oslab-version">v1.1</span>','visible version');
html=replaceOnce(html,'<strong>Source-bound</strong> · Change + Salience · Owner Brief · Exposure Synthesis · Execution none','<strong>Source-bound</strong> · Change + Salience · Owner Brief · Exposure Synthesis · Company Understanding · Execution none','capability proof');
html=replaceOnce(html,'placeholder="Спроси: где концентрация? что изменилось? дай owner brief…"','placeholder="Спроси: что OS знает о компаниях? где концентрация? дай owner brief…"','question placeholder');

const scriptRe=/\/agents\/console\/app\.js\?v=1\.0/g;
const matches=[...html.matchAll(scriptRe)];
if(matches.length!==1) throw new Error(`cache bust: expected 1 v1.0 app script, found ${matches.length}`);
html=html.replace(scriptRe,'/agents/console/app.js?v=1.1');

app=replaceOnce(app,
"    const labels = ['Дай owner brief', 'Где мы наиболее сконцентрированы?', 'Что изменилось сейчас?', 'Что система сейчас предлагает?', 'Чему OS ещё не может научиться?'];",
"    const labels = ['Дай owner brief', 'Что OS знает о компаниях?', 'Где мы наиболее сконцентрированы?', 'Что изменилось сейчас?', 'Что система сейчас предлагает?', 'Чему OS ещё не может научиться?'];",
'quick commands');

app=replaceOnce(app,
"      'Привет 🙂 Я читаю живое состояние The Holding OS, связываю Change Intelligence, Security, Learning и Governance и теперь умею отдельно показывать measured concentration по productive capital без выдуманного risk score. Спроси, где система сконцентрирована, что изменилось или дай owner brief.',\n      'Live Capital OS · source-bound synthesis + exposure view'",
"      'Привет 🙂 Я читаю живое состояние The Holding OS, связываю Change Intelligence, Security, Learning и Governance, показываю measured concentration и теперь могу сравнить ширину подтверждаемого company-level evidence без выдуманного Companion Score. Спроси, что OS знает о компаниях, где система сконцентрирована или дай owner brief.',\n      'Live Capital OS · synthesis + exposure + company understanding'",
'boot greeting');

const id='quick-company-understanding-ru';
if((core.cases||[]).some(x=>x.id===id)) throw new Error('core regression already exists');
core.cases.push({
  id,
  prompt:'Что OS знает о компаниях?',
  expectedIntent:'company-understanding',
  expectedConfidence:'partial',
  requiredSourceArtifact:'/companies/',
  requiredAnswerPattern:'EVIDENCE SURFACE MAP|не Companion Score|not a Companion Score',
  forbiddenSubstitution:['maturity score','risk score','company quality ranking']
});

fs.writeFileSync(indexPath,html);
fs.writeFileSync(appPath,app);
fs.writeFileSync(corePath,JSON.stringify(core,null,2)+'\n');

for(const [path,tokens] of [[indexPath,['v1.1','Company Understanding','app.js?v=1.1']],[appPath,['Что OS знает о компаниях?','companyUnderstandingAnswer']],[corePath,[id,'Что OS знает о компаниях?']]]){
  const text=fs.readFileSync(path,'utf8');
  for(const token of tokens) if(!text.includes(token)) throw new Error(`${path}: missing ${token}`);
}
console.log('Ask v1.1 interface evolution prepared');
