#!/usr/bin/env node
import fs from 'node:fs';

const APP = 'agents/console/app.js';
const AGENTS = 'agents/index.html';
const SNIPPET = 'verification/ask-os-conversation-v0.5-functions.txt';
let app = fs.readFileSync(APP, 'utf8');
let agents = fs.readFileSync(AGENTS, 'utf8');
const governanceFunctions = fs.readFileSync(SNIPPET, 'utf8').trimEnd();

function fail(message) { throw new Error(message); }
function replaceOnce(text, before, after, label) {
  const count = text.split(before).length - 1;
  if (count !== 1) fail(label + ': expected exactly 1 anchor, found ' + count);
  return text.replace(before, after);
}
function replaceFunction(text, startMarker, nextMarker, replacement, label) {
  const start = text.indexOf(startMarker);
  if (start < 0 || text.indexOf(startMarker, start + 1) >= 0) fail(label + ': start marker not unique');
  const end = text.indexOf(nextMarker, start);
  if (end < 0) fail(label + ': next marker missing');
  return text.slice(0, start) + replacement + '\n\n' + text.slice(end + 2);
}

app = replaceOnce(app,
  "    decisions: '/intelligence/learning/decision-ledger.json',\n    productivity: '/companies/productivity-data.json',",
  "    decisions: '/intelligence/learning/decision-ledger.json',\n    proposals: '/intelligence/proposals/proposal-queue.json',\n    builder: '/intelligence/builder/candidate-queue.json',\n    guardian: '/intelligence/guardian/guardian-state.json',\n    productivity: '/companies/productivity-data.json',",
  'URLS governance');

app = replaceOnce(app,
  "    decisions: null,\n    productivity: null,",
  "    decisions: null,\n    proposals: null,\n    builder: null,\n    guardian: null,\n    productivity: null,",
  'state governance');

app = replaceOnce(app,
  "    if (/Decision & Outcome Learning/i.test(s)) { add(URLS.learning); add(URLS.decisions); }\n    if (/project canon/i.test(s)) add('/intelligence/project-memory/CURRENT.md');",
  "    if (/Decision & Outcome Learning/i.test(s)) { add(URLS.learning); add(URLS.decisions); }\n    if (/Proposal Work Queue/i.test(s)) add(URLS.proposals);\n    if (/Builder Candidate Queue/i.test(s)) add(URLS.builder);\n    if (/Guardian State/i.test(s)) add(URLS.guardian);\n    if (/OS Governance/i.test(s)) { add(URLS.proposals); add(URLS.builder); add(URLS.guardian); }\n    if (/project canon/i.test(s)) add('/intelligence/project-memory/CURRENT.md');",
  'answer artifact governance');

app = replaceOnce(app,
  "    if (artifact === URLS.decisions) return state.decisions?.generatedAt || null;\n    if (artifact === URLS.productivity) return state.productivity?.generatedAt || null;",
  "    if (artifact === URLS.decisions) return state.decisions?.generatedAt || null;\n    if (artifact === URLS.proposals) return state.proposals?.generatedAt || null;\n    if (artifact === URLS.builder) return state.builder?.generatedAt || null;\n    if (artifact === URLS.guardian) return state.guardian?.generatedAt || null;\n    if (artifact === URLS.productivity) return state.productivity?.generatedAt || null;",
  'artifact timestamps');

app = replaceFunction(app, '  function proposalAnswer(lang) {', '  function learningAnswer(lang) {', governanceFunctions, 'governance functions');

const followup = [
"  function followupAnswer(query, lang) {",
"    const q = norm(query);",
"    if (!state.lastEntity || protocolGroup(query) || findCompany(query)) return null;",
"    if (state.lastEntity.kind === 'company') {",
"      const company = { name: state.lastEntity.name, registry: state.registry.find(x => x.name === state.lastEntity.name) || null };",
"      if (includesAny(q, ['истор', 'средн', 'histor', 'average'])) return companyAnswer(company, lang, query);",
"      if (includesAny(q, ['reward', 'награ', 'claimable', 'accrued'])) return rewardsAnswer(query, lang, company);",
"      if (includesAny(q, ['embedded', 'встроенн', 'внутри позиции'])) return embeddedAnswer(query, lang, company);",
"      if (includesAny(q, ['entry', 'точка входа', 'цена входа', 'покупк'])) return entryAnswer(query, lang, company);",
"    }",
"    if (state.lastEntity.kind === 'engine' && includesAny(q, ['а сейчас', 'current', 'текущ', 'доход', 'apr'])) {",
"      const e = safeObject(state.productivity?.engines)[state.lastEntity.id];",
"      if (e) return engineAnswer([e], lang);",
"    }",
"    if (state.lastEntity.kind === 'governance') {",
"      if (includesAny(q, ['почему', 'why', 'почему только', 'отфильтр'])) return whyFilteredAnswer(lang);",
"      if (includesAny(q, ['одобрен', 'approved', 'builder', 'guardian', 'может сделать', 'can execute', 'может сам'])) return governanceStatusAnswer(lang);",
"    }",
"    return null;",
"  }"
].join('\n');
app = replaceFunction(app, '  function followupAnswer(query, lang) {', '  async function loadLazy(kind) {', followup, 'follow-up');

app = replaceOnce(app,
  "    if (includesAny(q, ['что система предлагает', 'что предлагаешь', 'proposal', 'recommendation', 'recommend', 'что делать дальше'])) return proposalAnswer(lang);\n    if (includesAny(q, ['чему система учится', 'как система учится', 'learning status', 'learning now'])) return learningAnswer(lang);",
  "    if (includesAny(q, ['почему только 3', 'почему три', 'почему так мало proposal', 'why only 3', 'data hygiene', 'decision worthy', 'decision-worthy'])) return whyFilteredAnswer(lang);\n    if (includesAny(q, ['что уже одобрено', 'что одобрено', 'approved proposal', 'builder', 'guardian', 'может ли система выполнить', 'может ли это быть выполнено', 'can execute', 'governance status'])) return governanceStatusAnswer(lang);\n    if (includesAny(q, ['что система предлагает', 'что предлагаешь', 'proposal', 'recommendation', 'recommend', 'что делать дальше'])) return proposalAnswer(lang);\n    if (includesAny(q, ['чему система учится', 'как система учится', 'learning status', 'learning now'])) return learningAnswer(lang);",
  'route governance');

const compareBlock = [
"    const company = findCompany(raw);",
"    const compareIntent = includesAny(q, ['сравни', 'сравнить', 'compare', 'versus']);",
"    if (compareIntent) {",
"      const matches = findCompanies(raw);",
"      if (matches.length >= 2) return compareCompaniesAnswer(matches[0], matches[1], lang);",
"    }"
].join('\n');
app = replaceOnce(app, '    const company = findCompany(raw);', compareBlock, 'company compare route');

app = replaceOnce(app,
  "      const [stack, bridge, learning, decisions, productivity, stable, companiesHtml] = await Promise.all([\n        getJson(URLS.stack),\n        getJson(URLS.bridge),\n        getJson(URLS.learning, true),\n        getJson(URLS.decisions, true),\n        getJson(URLS.productivity),",
  "      const [stack, bridge, learning, decisions, proposals, builder, guardian, productivity, stable, companiesHtml] = await Promise.all([\n        getJson(URLS.stack),\n        getJson(URLS.bridge),\n        getJson(URLS.learning, true),\n        getJson(URLS.decisions, true),\n        getJson(URLS.proposals, true),\n        getJson(URLS.builder, true),\n        getJson(URLS.guardian, true),\n        getJson(URLS.productivity),",
  'boot loaders');

app = replaceOnce(app,
  "        decisions,\n        productivity,\n        stable,",
  "        decisions,\n        proposals,\n        builder,\n        guardian,\n        productivity,\n        stable,",
  'boot assign');

app = replaceOnce(app,
  "    const labels = ['Сколько сейчас компаний?', 'Какая доходность Aerodrome?', 'Что с Monetra?', 'Как устроены слои капитала?', 'Что требует внимания?'];",
  "    const labels = ['Сколько сейчас компаний?', 'Сравни defitea.eth и YieldRing.eth', 'Что система предлагает?', 'Почему только 3 proposal?', 'Может ли система что-то выполнить?'];",
  'quick prompts');

agents = replaceOnce(agents, '/agents/console/app.js?v=0.4', '/agents/console/app.js?v=0.5', 'cache version');
agents = replaceOnce(agents, '<!-- Ask The Holding v0.4 · reused source-bound router + safety layer -->', '<!-- Ask The Holding v0.5 · OS governance synthesis + source-bound safety -->', 'Ask release comment');

fs.writeFileSync(APP, app);
fs.writeFileSync(AGENTS, agents);
console.log(JSON.stringify({ status: 'patched', release: 'Ask The Holding v0.5', persistentLearningActivated: false, executionAuthorityChanged: false }, null, 2));
