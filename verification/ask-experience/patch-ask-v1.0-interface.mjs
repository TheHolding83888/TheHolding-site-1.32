import fs from 'node:fs';

const indexPath='agents/index.html';
const appPath='agents/console/app.js';
let html=fs.readFileSync(indexPath,'utf8');
let app=fs.readFileSync(appPath,'utf8');
function once(source,before,after,label){const n=source.split(before).length-1;if(n!==1)throw new Error(`${label}: expected 1 anchor, found ${n}`);return source.replace(before,after);}

html=once(html,'THE HOLDING // CAPITAL OS INTELLIGENCE <span class="oslab-version">v0.9</span>','THE HOLDING // CAPITAL OS INTELLIGENCE <span class="oslab-version">v1.0</span>','version');
html=once(html,'<span class="oslab-capability-proof"><strong>Source-bound</strong> · Change + Salience · Owner Brief · Execution none</span>','<span class="oslab-capability-proof"><strong>Source-bound</strong> · Change + Salience · Owner Brief · Exposure Synthesis · Execution none</span>','capability proof');
html=once(html,'placeholder="Спроси: что изменилось? что важно сейчас? дай owner brief…"','placeholder="Спроси: где концентрация? что изменилось? дай owner brief…"','placeholder');
html=once(html,'<!-- Ask The Holding v0.9 · cross-source Owner Brief + Change/Salience + source-bound safety -->','<!-- Ask The Holding v1.0 · exposure concentration + Owner Brief + Change/Salience + source-bound safety -->','version comment');
html=once(html,'<script src="/agents/console/app.js?v=0.9" defer></script>','<script src="/agents/console/app.js?v=1.0" defer></script>','cache bust');

app=once(app,"    const labels = ['Дай owner brief', 'Что изменилось сейчас?', 'Что система сейчас предлагает?', 'Чему OS ещё не может научиться?', 'Может ли система что-то выполнить?'];","    const labels = ['Дай owner brief', 'Где мы наиболее сконцентрированы?', 'Что изменилось сейчас?', 'Что система сейчас предлагает?', 'Чему OS ещё не может научиться?'];",'quick commands');
app=once(app,"      'Привет 🙂 Я читаю живое состояние The Holding OS и уже умею не только находить факты, но и связывать Change Intelligence, Security, Learning и Governance в bounded owner-level картину. Спроси, что изменилось, что важно сейчас или дай owner brief.',\n      'Live Capital OS · source-bound synthesis'","      'Привет 🙂 Я читаю живое состояние The Holding OS, связываю Change Intelligence, Security, Learning и Governance и теперь умею отдельно показывать measured concentration по productive capital без выдуманного risk score. Спроси, где система сконцентрирована, что изменилось или дай owner brief.',\n      'Live Capital OS · source-bound synthesis + exposure view'",'greeting');
fs.writeFileSync(indexPath,html);fs.writeFileSync(appPath,app);console.log('Ask v1.0 interface evolution prepared');
