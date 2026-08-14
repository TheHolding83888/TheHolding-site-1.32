#!/usr/bin/env node
import fs from 'node:fs';

const APP = 'agents/console/app.js';
const AGENTS = 'agents/index.html';
let app = fs.readFileSync(APP, 'utf8');
let agents = fs.readFileSync(AGENTS, 'utf8');
const fail = m => { throw new Error(m); };
const replaceOnce = (text, before, after, label) => {
  const n = text.split(before).length - 1;
  if (n !== 1) fail(`${label}: expected exactly 1 anchor, found ${n}`);
  return text.replace(before, after);
};

app = replaceOnce(app,
`    decisions: '/intelligence/learning/decision-ledger.json',
    productivity: '/companies/productivity-data.json',`,
`    decisions: '/intelligence/learning/decision-ledger.json',
    proposals: '/intelligence/proposals/proposal-queue.json',
    builder: '/intelligence/builder/candidate-queue.json',
    guardian: '/intelligence/guardian/guardian-state.json',
    productivity: '/companies/productivity-data.json',`,
'URLS governance');

app = replaceOnce(app,
`    decisions: null,
    productivity: null,`,
`    decisions: null,
    proposals: null,
    builder: null,
    guardian: null,
    productivity: null,`,
'state governance');

app = replaceOnce(app,
`    if (/Decision & Outcome Learning/i.test(s)) { add(URLS.learning); add(URLS.decisions); }
    if (/project canon/i.test(s)) add('/intelligence/project-memory/CURRENT.md');`,
`    if (/Decision & Outcome Learning/i.test(s)) { add(URLS.learning); add(URLS.decisions); }
    if (/Proposal Work Queue/i.test(s)) add(URLS.proposals);
    if (/Builder Candidate Queue/i.test(s)) add(URLS.builder);
    if (/Guardian State/i.test(s)) add(URLS.guardian);
    if (/OS Governance/i.test(s)) { add(URLS.proposals); add(URLS.builder); add(URLS.guardian); }
    if (/project canon/i.test(s)) add('/intelligence/project-memory/CURRENT.md');`,
'answer artifact governance');

app = replaceOnce(app,
`    if (artifact === URLS.decisions) return state.decisions?.generatedAt || null;
    if (artifact === URLS.productivity) return state.productivity?.generatedAt || null;`,
`    if (artifact === URLS.decisions) return state.decisions?.generatedAt || null;
    if (artifact === URLS.proposals) return state.proposals?.generatedAt || null;
    if (artifact === URLS.builder) return state.builder?.generatedAt || null;
    if (artifact === URLS.guardian) return state.guardian?.generatedAt || null;
    if (artifact === URLS.productivity) return state.productivity?.generatedAt || null;`,
'artifact timestamps governance');

app = replaceOnce(app,
`  function proposalAnswer(lang) {
    const items = meaningfulCases().filter(x => x?.deterministicAction).slice(0, 5);
    state.lastTopic = 'proposal';
    if (!items.length) return {
      text: lang === 'ru' ? 'В текущем Brain packet нет конкретного non-info предложения к действию.' : 'There is no concrete non-info action proposal in the current Brain packet.',
      source: 'Live Brain Bridge'
    };
    return {
      text: (lang === 'ru' ? 'Текущие предложения – только для рассмотрения, не автоматические действия:\n' : 'Current proposals – for review only, not automatic actions:\n') + items.map((x, i) => `${i + 1}. ${x.deterministicAction}`).join('\n'),
      source: 'Live Brain Bridge'
    };
  }`,
`  function activeProposals() {
    return safeArray(state.proposals?.proposals).filter(x => !['SUPERSEDED', 'REJECTED', 'RELEASED'].includes(String(x?.state || '').toUpperCase()));
  }

  function governanceCoherent() {
    const chain = state.stack?.integrity?.chainHash;
    const proposalHash = state.proposals?.integrity?.queueHash;
    const builderHash = state.builder?.integrity?.queueHash;
    return Boolean(
      chain &&
      state.proposals?.source?.cognitiveChainHash === chain &&
      proposalHash && state.builder?.source?.proposalQueueHash === proposalHash &&
      builderHash && state.guardian?.source?.candidateQueueHash === builderHash
    );
  }

  function proposalAnswer(lang) {
    const items = activeProposals().slice(0, 6);
    const s = state.proposals?.summary || {};
    state.lastTopic = 'proposal';
    state.lastEntity = { kind: 'governance', topic: 'proposal' };
    if (!state.proposals || !governanceCoherent()) return {
      text: lang === 'ru'
        ? 'Governance packet сейчас не подтверждён как coherent с текущим Cognitive Stack. Я не буду подменять Proposal сырыми Brain cases.'
        : 'The governance packet is not currently verified as coherent with the Cognitive Stack, so I will not substitute raw Brain cases for real Proposals.',
      source: 'Proposal Work Queue unavailable'
    };
    if (!items.length) return {
      text: lang === 'ru' ? 'В текущей Proposal Work Queue нет активных предложений.' : 'There are no active items in the current Proposal Work Queue.',
      source: 'Proposal Work Queue'
    };
    const intro = lang === 'ru'
      ? `Система наблюдает ${s.observedActiveCaseCount ?? '—'} активных case, но после фильтра опыта оставила ${s.activeCaseCount ?? items.length} decision-worthy и ${s.dataHygieneCaseCount ?? '—'} data-hygiene. Активных Proposal: ${s.activeProposalCount ?? items.length}.\n\n`
      : `The system observes ${s.observedActiveCaseCount ?? '—'} active cases, but the experience gate kept ${s.activeCaseCount ?? items.length} decision-worthy and ${s.dataHygieneCaseCount ?? '—'} data-hygiene. Active Proposals: ${s.activeProposalCount ?? items.length}.\n\n`;
    const rows = items.map((x, i) => `${i + 1}. [${x.rankClass || '—'} · ${x.state || '—'}] ${x.entity || x.category || x.proposalId}\n   ${x.proposedAction || ''}`);
    const tail = lang === 'ru'
      ? `\n\nОдобрено владельцем: ${s.ownerApprovedCount ?? 0}. Automatic approval/execution выключены.`
      : `\n\nOwner-approved: ${s.ownerApprovedCount ?? 0}. Automatic approval/execution remain disabled.`;
    return { text: intro + rows.join('\n') + tail, source: 'Proposal Work Queue' };
  }

  function governanceStatusAnswer(lang) {
    const p = state.proposals?.summary || {};
    const b = state.builder?.summary || {};
    const g = state.guardian?.summary || {};
    state.lastTopic = 'governance';
    state.lastEntity = { kind: 'governance', topic: 'status' };
    if (!governanceCoherent()) return {
      text: lang === 'ru' ? 'Governance chain сейчас не проходит exact coherence check. Действие не предполагается.' : 'The governance chain does not currently pass exact coherence checks. No action is implied.',
      source: 'OS Governance unavailable'
    };
    return {
      text: lang === 'ru'
        ? `Governance сейчас: Proposal ${p.activeProposalCount ?? 0} active / ${p.ownerApprovedCount ?? 0} owner-approved → Builder ${b.candidateCount ?? 0} candidates → Guardian ${g.researchOnlyCount ?? 0} research-only / ${g.sandboxBuildAuthorizedCount ?? 0} sandbox / ${g.productionMutationAuthorizedCount ?? 0} production-authorized.\n\nExecution authority: ${(state.guardian?.constraints?.executionAuthority || executionAuthority()).toUpperCase()}. Пока владелец ничего не одобрил, Builder остаётся пустым, а Guardian не выдаёт capability.`
        : `Governance now: Proposal ${p.activeProposalCount ?? 0} active / ${p.ownerApprovedCount ?? 0} owner-approved → Builder ${b.candidateCount ?? 0} candidates → Guardian ${g.researchOnlyCount ?? 0} research-only / ${g.sandboxBuildAuthorizedCount ?? 0} sandbox / ${g.productionMutationAuthorizedCount ?? 0} production-authorized.\n\nExecution authority: ${(state.guardian?.constraints?.executionAuthority || executionAuthority()).toUpperCase()}. Until the owner approves something, Builder stays empty and Guardian grants no capability.`,
      source: 'OS Governance · Proposal + Builder + Guardian'
    };
  }

  function whyFilteredAnswer(lang) {
    const s = state.proposals?.summary || {};
    state.lastTopic = 'proposal-filter';
    state.lastEntity = { kind: 'governance', topic: 'filter' };
    if (!state.proposals || !governanceCoherent()) return proposalAnswer(lang);
    return {
      text: lang === 'ru'
        ? `Потому что observation и decision experience теперь разделены. Learning наблюдает ${s.observedActiveCaseCount ?? '—'} активных case. ${s.dataHygieneCaseCount ?? '—'} классифицированы как data-hygiene – их полезно помнить, но они не должны отвлекать владельца и обучать систему как будто это решения. В Proposal прошли только ${s.activeCaseCount ?? '—'} decision-worthy case. Поэтому больше наблюдений не означает больше задач.`
        : `Because observation and decision experience are now separated. Learning observes ${s.observedActiveCaseCount ?? '—'} active cases. ${s.dataHygieneCaseCount ?? '—'} are data-hygiene – useful to remember, but they should not distract the owner or train the system as if they were decisions. Only ${s.activeCaseCount ?? '—'} decision-worthy cases reached Proposal. More observations no longer means more tasks.`,
      source: 'Proposal Work Queue + Decision & Outcome Learning'
    };
  }

  function compareCompaniesAnswer(a, b, lang) {
    const companies = safeObject(state.productivity?.companies);
    const pa = companies[a.name];
    const pb = companies[b.name];
    state.lastTopic = 'company-compare';
    state.lastEntity = { kind: 'company-compare', names: [a.name, b.name] };
    if (!pa || !pb || finite(pa.aprLatest) === null || finite(pb.aprLatest) === null) return {
      text: lang === 'ru' ? 'Для точного сравнения обе компании должны иметь подтверждённый current Reference APR. Сейчас этого нет.' : 'Both companies need verified current Reference APR for an exact comparison, and that is not available right now.',
      source: 'Live Productivity'
    };
    const ca = finite(pa.coverage);
    const cb = finite(pb.coverage);
    const diff = Number(pa.aprLatest) - Number(pb.aprLatest);
    return {
      text: lang === 'ru'
        ? `${a.name}: ${pct(pa.aprLatest)} Reference APR${ca !== null ? ` · coverage ${Math.round(ca * 100)}%` : ''}.\n${b.name}: ${pct(pb.aprLatest)} Reference APR${cb !== null ? ` · coverage ${Math.round(cb * 100)}%` : ''}.\n\nРазница текущего Reference APR: ${diff >= 0 ? '+' : ''}${pct(diff)} в пользу ${diff >= 0 ? a.name : b.name}. Это сравнение текущей productive capacity, не realized performance.`
        : `${a.name}: ${pct(pa.aprLatest)} Reference APR${ca !== null ? ` · coverage ${Math.round(ca * 100)}%` : ''}.\n${b.name}: ${pct(pb.aprLatest)} Reference APR${cb !== null ? ` · coverage ${Math.round(cb * 100)}%` : ''}.\n\nCurrent Reference APR difference: ${diff >= 0 ? '+' : ''}${pct(diff)} in favor of ${diff >= 0 ? a.name : b.name}. This compares current productive capacity, not realised performance.`,
      source: 'Live Productivity'
    };
  }`,
'governance + compare functions');

app = replaceOnce(app,
`  function followupAnswer(query, lang) {
    const q = norm(query);
    if (!state.lastEntity || protocolGroup(query) || findCompany(query)) return null;
    if (state.lastEntity.kind === 'company' && includesAny(q, ['истор', 'средн', 'histor', 'average'])) {
      return companyAnswer({ name: state.lastEntity.name, registry: state.registry.find(x => x.name === state.lastEntity.name) || null }, lang, query);
    }
    if (state.lastEntity.kind === 'engine' && includesAny(q, ['а сейчас', 'current', 'текущ', 'доход', 'apr'])) {
      const e = safeObject(state.productivity?.engines)[state.lastEntity.id];
      if (e) return engineAnswer([e], lang);
    }
    return null;
  }`,
`  function followupAnswer(query, lang) {
    const q = norm(query);
    if (!state.lastEntity || protocolGroup(query) || findCompany(query)) return null;
    if (state.lastEntity.kind === 'company') {
      const company = { name: state.lastEntity.name, registry: state.registry.find(x => x.name === state.lastEntity.name) || null };
      if (includesAny(q, ['истор', 'средн', 'histor', 'average'])) return companyAnswer(company, lang, query);
      if (includesAny(q, ['reward', 'награ', 'claimable', 'accrued'])) return rewardsAnswer(query, lang, company);
      if (includesAny(q, ['embedded', 'встроенн', 'внутри позиции'])) return embeddedAnswer(query, lang, company);
      if (includesAny(q, ['entry', 'точка входа', 'цена входа', 'покупк'])) return entryAnswer(query, lang, company);
    }
    if (state.lastEntity.kind === 'engine' && includesAny(q, ['а сейчас', 'current', 'текущ', 'доход', 'apr'])) {
      const e = safeObject(state.productivity?.engines)[state.lastEntity.id];
      if (e) return engineAnswer([e], lang);
    }
    if (state.lastEntity.kind === 'governance') {
      if (includesAny(q, ['почему', 'why', 'почему только', 'отфильтр'])) return whyFilteredAnswer(lang);
      if (includesAny(q, ['одобрен', 'approved', 'builder', 'guardian', 'может сделать', 'can execute', 'может сам'])) return governanceStatusAnswer(lang);
    }
    return null;
  }`,
'follow-up expansion');

app = replaceOnce(app,
`    if (includesAny(q, ['что система предлагает', 'что предлагаешь', 'proposal', 'recommendation', 'recommend', 'что делать дальше'])) return proposalAnswer(lang);
    if (includesAny(q, ['чему система учится', 'как система учится', 'learning status', 'learning now'])) return learningAnswer(lang);`,
`    if (includesAny(q, ['почему только 3', 'почему три', 'почему так мало proposal', 'why only 3', 'data hygiene', 'decision worthy', 'decision-worthy'])) return whyFilteredAnswer(lang);
    if (includesAny(q, ['что уже одобрено', 'что одобрено', 'approved proposal', 'builder', 'guardian', 'может ли система выполнить', 'может ли это быть выполнено', 'can execute', 'governance status'])) return governanceStatusAnswer(lang);
    if (includesAny(q, ['что система предлагает', 'что предлагаешь', 'proposal', 'recommendation', 'recommend', 'что делать дальше'])) return proposalAnswer(lang);
    if (includesAny(q, ['чему система учится', 'как система учится', 'learning status', 'learning now'])) return learningAnswer(lang);`,
'route governance');

app = replaceOnce(app,
`    const company = findCompany(raw);
    const asksRewards = includesAny(q, ['reward', 'награ', 'claimable', 'accrued']);`,
`    const company = findCompany(raw);
    const compareIntent = includesAny(q, ['сравни', 'сравнить', 'compare', 'versus', ' vs ']);
    if (compareIntent) {
      const matches = [];
      const aliasesText = norm(raw);
      const knownNames = new Set([...state.registry.map(x => x.name), ...Object.keys(safeObject(state.productivity?.companies))].filter(Boolean));
      for (const name of knownNames) {
        const found = findCompany(name + ' ' + raw);
        const nn = norm(name);
        if ((aliasesText.includes(nn) || found?.name === name) && !matches.some(x => x.name === name)) matches.push({ name, registry: state.registry.find(x => x.name === name) || null });
      }
      const explicit = [...knownNames].map(name => ({ name, registry: state.registry.find(x => x.name === name) || null })).filter(x => norm(raw).includes(norm(x.name)));
      for (const x of explicit) if (!matches.some(y => y.name === x.name)) matches.push(x);
      if (matches.length >= 2) return compareCompaniesAnswer(matches[0], matches[1], lang);
    }
    const asksRewards = includesAny(q, ['reward', 'награ', 'claimable', 'accrued']);`,
'company compare route');

app = replaceOnce(app,
`      const [stack, bridge, learning, decisions, productivity, stable, companiesHtml] = await Promise.all([
        getJson(URLS.stack),
        getJson(URLS.bridge),
        getJson(URLS.learning, true),
        getJson(URLS.decisions, true),
        getJson(URLS.productivity),`,
`      const [stack, bridge, learning, decisions, proposals, builder, guardian, productivity, stable, companiesHtml] = await Promise.all([
        getJson(URLS.stack),
        getJson(URLS.bridge),
        getJson(URLS.learning, true),
        getJson(URLS.decisions, true),
        getJson(URLS.proposals, true),
        getJson(URLS.builder, true),
        getJson(URLS.guardian, true),
        getJson(URLS.productivity),`,
'boot loaders');

app = replaceOnce(app,
`        decisions,
        productivity,
        stable,`,
`        decisions,
        proposals,
        builder,
        guardian,
        productivity,
        stable,`,
'boot state assign');

app = replaceOnce(app,
`    const labels = ['Сколько сейчас компаний?', 'Какая доходность Aerodrome?', 'Что с Monetra?', 'Как устроены слои капитала?', 'Что требует внимания?'];`,
`    const labels = ['Сколько сейчас компаний?', 'Сравни defitea.eth и YieldRing.eth', 'Что система предлагает?', 'Почему только 3 proposal?', 'Может ли система что-то выполнить?'];`,
'quick prompts');

agents = replaceOnce(agents, './console/app.js?v=0.4', './console/app.js?v=0.5', 'agents app cache version');
agents = agents.replace(/v0\.4 source-bound answers/g, 'v0.5 OS conversation synthesis');

fs.writeFileSync(APP, app);
fs.writeFileSync(AGENTS, agents);
console.log(JSON.stringify({ status: 'patched', release: 'Ask The Holding v0.5', persistentLearningActivated: false, executionAuthorityChanged: false }, null, 2));
