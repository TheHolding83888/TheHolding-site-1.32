import fs from 'node:fs';

const indexPath = 'agents/index.html';
const appPath = 'agents/console/app.js';
let html = fs.readFileSync(indexPath, 'utf8');
let app = fs.readFileSync(appPath, 'utf8');

function replaceOnce(source, before, after, label) {
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: expected exactly one anchor, found ${count}`);
  return source.replace(before, after);
}

html = replaceOnce(
  html,
  '#console .oslab-dialog { padding:1.25rem; }',
  `#console .oslab-capability-rail {\n            display:flex;\n            align-items:center;\n            gap:.5rem;\n            flex-wrap:wrap;\n            padding:.72rem 1rem;\n            border-bottom:1px solid rgba(255,255,255,.08);\n            background:rgba(138,184,221,.028);\n        }\n        #console .oslab-capability-label { color:#7896ad; font:700 .5rem/1.2 'Space Grotesk',sans-serif; letter-spacing:.13em; text-transform:uppercase; margin-right:.15rem; }\n        #console .oslab-capability-step { color:#72808b; border:1px solid rgba(255,255,255,.08); border-radius:999px; padding:.28rem .5rem; font:600 .52rem/1.1 'Space Grotesk',sans-serif; letter-spacing:.045em; }\n        #console .oslab-capability-step.done { color:#9fb3c2; }\n        #console .oslab-capability-step.current { color:#d8edf9; border-color:rgba(138,184,221,.34); background:rgba(138,184,221,.09); box-shadow:inset 0 0 18px rgba(138,184,221,.035); }\n        #console .oslab-capability-divider { color:#53626e; font-size:.6rem; }\n        #console .oslab-capability-proof { color:#8ea2b0; margin-left:auto; font:600 .5rem/1.2 'Space Grotesk',sans-serif; letter-spacing:.065em; text-transform:uppercase; }\n        #console .oslab-capability-proof strong { color:#cfe3f0; font-weight:600; }\n        #console .oslab-version { color:#86a8bf; margin-left:.35rem; font-size:.52rem; letter-spacing:.08em; }\n        #console .oslab-dialog { padding:1.25rem; }`,
  'capability CSS'
);

html = replaceOnce(
  html,
  '<div>THE HOLDING // KNOWLEDGE ROUTER</div>',
  '<div>THE HOLDING // CAPITAL OS INTELLIGENCE <span class="oslab-version">v0.9</span></div>',
  'console title'
);

html = replaceOnce(
  html,
  '<div class="oslab-summary-label">In plain language</div>',
  '<div class="oslab-summary-label">Verified operating picture</div>',
  'summary label'
);

const facts = `                <div class="oslab-facts">\n                    <div class="oslab-fact"><strong id="companyFact">—</strong><span>Companies</span></div>\n                    <div class="oslab-fact"><strong id="engineFact">—</strong><span>Productivity engines</span></div>\n                    <div class="oslab-fact"><strong id="stableFact">—</strong><span>Stable positions</span></div>\n                    <div class="oslab-fact"><strong id="securityFact">—</strong><span>Security</span></div>\n                </div>`;
const factsPlus = `${facts}\n                <div class="oslab-capability-rail" aria-label="Ask The Holding maturity">\n                    <span class="oslab-capability-label">Ask maturity</span>\n                    <span class="oslab-capability-step done">Router</span><span class="oslab-capability-divider">›</span>\n                    <span class="oslab-capability-step done">Context</span><span class="oslab-capability-divider">›</span>\n                    <span class="oslab-capability-step done">Generalizing</span><span class="oslab-capability-divider">›</span>\n                    <span class="oslab-capability-step current">Synthesizing</span>\n                    <span class="oslab-capability-proof"><strong>Source-bound</strong> · Change + Salience · Owner Brief · Execution none</span>\n                </div>`;
html = replaceOnce(html, facts, factsPlus, 'capability rail');

html = replaceOnce(
  html,
  'placeholder="Спроси: сколько компаний? какая доходность Aerodrome? что такое слои капитала?"',
  'placeholder="Спроси: что изменилось? что важно сейчас? дай owner brief…"',
  'question placeholder'
);

html = replaceOnce(
  html,
  '<!-- Ask The Holding v0.5 · OS governance synthesis + source-bound safety -->',
  '<!-- Ask The Holding v0.9 · cross-source Owner Brief + Change/Salience + source-bound safety -->',
  'Ask version comment'
);
html = replaceOnce(
  html,
  '<script src="/agents/console/app.js?v=0.8" defer></script>',
  '<script src="/agents/console/app.js?v=0.9" defer></script>',
  'Ask app cache bust'
);

const oldQuick = "    const labels = ['Сколько сейчас компаний?', 'Сравни defitea.eth и YieldRing.eth', 'Что реально требует внимания?', 'Что система предлагает?', 'Может ли система что-то выполнить?'];";
const newQuick = "    const labels = ['Дай owner brief', 'Что изменилось сейчас?', 'Что система сейчас предлагает?', 'Чему OS ещё не может научиться?', 'Может ли система что-то выполнить?'];";
app = replaceOnce(app, oldQuick, newQuick, 'quick commands');

app = replaceOnce(
  app,
  "      'Привет 🙂 Я уже читаю живые знания The Holding. Можно спрашивать обычным языком про компании, фонды, слои капитала, доходность протоколов, Stable Capital и состояние мозга системы.',\n      'Live Registry + Productivity + Stable Capital + Cognitive Stack'",
  "      'Привет 🙂 Я читаю живое состояние The Holding OS и уже умею не только находить факты, но и связывать Change Intelligence, Security, Learning и Governance в bounded owner-level картину. Спроси, что изменилось, что важно сейчас или дай owner brief.',\n      'Live Capital OS · source-bound synthesis'",
  'boot greeting'
);

fs.writeFileSync(indexPath, html);
fs.writeFileSync(appPath, app);
console.log('Ask v0.9 interface patch prepared');
