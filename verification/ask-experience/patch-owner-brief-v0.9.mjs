import fs from 'node:fs';

const path = 'agents/console/app.js';
let s = fs.readFileSync(path, 'utf8');
const block = lines => lines.join('\n');

function replaceOnce(oldText, newText, label) {
  if (s.includes(newText)) { console.log(`${label}: already applied`); return; }
  if (!s.includes(oldText)) throw new Error(`${label}: expected anchor missing`);
  s = s.replace(oldText, newText);
  console.log(`${label}: applied`);
}

replaceOnce(
  "    changeIntelligence: '/intelligence/change-intelligence.json',\n    productivity: '/companies/productivity-data.json',",
  "    changeIntelligence: '/intelligence/change-intelligence.json',\n    securityIntelligence: '/security/security-intelligence.json',\n    productivity: '/companies/productivity-data.json',",
  'Security Intelligence URL'
);

replaceOnce(
  "    changeIntelligence: null,\n    productivity: null,",
  "    changeIntelligence: null,\n    securityIntelligence: null,\n    productivity: null,",
  'Security Intelligence state'
);

replaceOnce(
  "    if (/Change Intelligence/i.test(s)) add(URLS.changeIntelligence);\n    if (/OS Governance/i.test(s)) { add(URLS.proposals); add(URLS.builder); add(URLS.guardian); }",
  "    if (/Change Intelligence/i.test(s)) add(URLS.changeIntelligence);\n    if (/Security Intelligence/i.test(s)) add(URLS.securityIntelligence);\n    if (/OS Governance/i.test(s)) { add(URLS.proposals); add(URLS.builder); add(URLS.guardian); }",
  'Security answer artifact binding'
);

replaceOnce(
  "    if (artifact === URLS.changeIntelligence) return state.changeIntelligence?.generatedAt || null;\n    if (artifact === URLS.productivity) return state.productivity?.generatedAt || null;",
  "    if (artifact === URLS.changeIntelligence) return state.changeIntelligence?.generatedAt || null;\n    if (artifact === URLS.securityIntelligence) return state.securityIntelligence?.generatedAt || null;\n    if (artifact === URLS.productivity) return state.productivity?.generatedAt || null;",
  'Security generatedAt binding'
);

const helperAnchor = "\n\n  async function ownerEvidenceSynthesis(raw, lang) {";
const helper = block([
  '', '',
  '  function ownerBriefAnswer(lang) {',
  "    const ru = lang === 'ru';",
  '    const nl = String.fromCharCode(10);',
  '    const sec = state.securityIntelligence;',
  '    const learning = state.learning;',
  '    const proposals = state.proposals;',
  '    const change = state.changeIntelligence;',
  '    if (!sec && !learning && !change) return {',
  "      text: ru ? 'Owner Brief сейчас нельзя собрать из проверенных live sources. Я не буду заменять его общими словами.' : 'The Owner Brief cannot be built from verified live sources right now. I will not replace it with generic commentary.',",
  "      source: 'Owner Brief sources unavailable',",
  "      confidenceHint: 'unknown'",
  '    };',
  '',
  '    const lines = [];',
  '    const secCounts = safeObject(sec?.severityCounts);',
  "    const secHigh = finite(secCounts.high) ?? 0;",
  "    const secMedium = finite(secCounts.medium) ?? 0;",
  "    const secCritical = finite(secCounts.critical) ?? 0;",
  '    const highFindings = safeArray(sec?.currentFindings).filter(x => String(x?.severity || \'\').toLowerCase() === \'high\');',
  '    const highGroups = new Map();',
  '    for (const item of highFindings) {',
  "      const key = String(item?.category || 'other');",
  '      highGroups.set(key, (highGroups.get(key) || 0) + 1);',
  '    }',
  "    const groupText = [...highGroups.entries()].map(([k, n]) => k + '×' + n).join(', ');",
  '',
  '    const cases = safeArray(learning?.activeCases);',
  "    const decisionWorthy = cases.filter(x => x?.experienceEligibility === 'decision-worthy');",
  "    const highCases = decisionWorthy.filter(x => String(x?.riskTier || '').toLowerCase() === 'high');",
  "    const decisionDomains = [...new Set(decisionWorthy.map(x => x?.domain).filter(Boolean))].join(', ');",
  '    const proposalSummary = safeObject(proposals?.summary);',
  '    const activeProposalCount = finite(proposalSummary.activeProposalCount) ?? 0;',
  '    const ownerApprovedCount = finite(proposalSummary.ownerApprovedCount) ?? 0;',
  '',
  '    if (sec) {',
  "      lines.push((ru ? 'PRIORITY 1 · Security / decision review' : 'PRIORITY 1 · Security / decision review'));",
  "      lines.push(ru ? 'Fresh Security: ' + String(sec.status || 'unknown').toUpperCase() + ' · Critical ' + secCritical + ' / High ' + secHigh + ' / Medium ' + secMedium + (groupText ? ' · High groups: ' + groupText : '') + '.' : 'Fresh Security: ' + String(sec.status || 'unknown').toUpperCase() + ' · Critical ' + secCritical + ' / High ' + secHigh + ' / Medium ' + secMedium + (groupText ? ' · High groups: ' + groupText : '') + '.');",
  '    }',
  '    if (learning) {',
  "      lines.push(ru ? 'Learning: ' + decisionWorthy.length + ' decision-worthy case(s)' + (highCases.length ? ', ' + highCases.length + ' high-risk' : '') + (decisionDomains ? ' · domains: ' + decisionDomains : '') + '.' : 'Learning: ' + decisionWorthy.length + ' decision-worthy case(s)' + (highCases.length ? ', ' + highCases.length + ' high-risk' : '') + (decisionDomains ? ' · domains: ' + decisionDomains : '') + '.');",
  '    }',
  '    if (proposals) {',
  "      lines.push(ru ? 'Governance: ' + activeProposalCount + ' active proposal(s), owner-approved ' + ownerApprovedCount + '. Execution остаётся disabled.' : 'Governance: ' + activeProposalCount + ' active proposal(s), owner-approved ' + ownerApprovedCount + '. Execution remains disabled.');",
  '    }',
  '    if (sec && learning) {',
  "      lines.push(ru ? 'Важно: Security, Learning и Proposal здесь коррелируют по одной цепочке evidence → review → proposal; их counts нельзя складывать как независимые проблемы.' : 'Important: Security, Learning and Proposal are correlated views of one evidence → review → proposal chain; their counts must not be added as independent problems.');",
  '    }',
  '',
  '    const watch = safeArray(change?.watchNext).slice(0, 3);',
  '    if (watch.length) {',
  "      lines.push('');",
  "      lines.push(ru ? 'PRIORITY 2 · Economic / data watch' : 'PRIORITY 2 · Economic / data watch');",
  '      watch.forEach((x, i) => lines.push((i + 1) + '. ' + String(x?.summary || \'Watch condition\') + (x?.whyItMatters ? \' \' + String(x.whyItMatters) : \'\')));',
  '    }',
  '',
  '    const topChange = safeArray(change?.whatChanged)',
  '      .map(event => ({ event, score: changeSalienceScore(event) }))',
  '      .sort((a, b) => b.score - a.score)[0]?.event;',
  '    if (topChange) {',
  "      lines.push('');",
  "      lines.push(ru ? 'FRESH MATERIAL DELTA' : 'FRESH MATERIAL DELTA');",
  "      lines.push(String(topChange.summary || '') + (topChange.whyItMatters ? ' ' + String(topChange.whyItMatters) : ''));",
  '    }',
  '',
  '    const secAt = Date.parse(sec?.generatedAt || \'\');',
  '    const learningAt = Date.parse(learning?.generatedAt || \'\');',
  '    const proposalAt = Date.parse(proposals?.generatedAt || \'\');',
  '    const freshnessNotes = [];',
  '    if (Number.isFinite(secAt) && Number.isFinite(learningAt) && secAt > learningAt) freshnessNotes.push(ru ? \'Security snapshot свежее Learning; текущие security counts беру из Security Intelligence.\' : \'The Security snapshot is newer than Learning; current security counts come from Security Intelligence.\');',
  '    if (Number.isFinite(secAt) && Number.isFinite(proposalAt) && secAt > proposalAt) freshnessNotes.push(ru ? \'Proposal может слегка отставать от последнего Security scan и остаётся governance view, а не current-risk counter.\' : \'Proposal may lag the latest Security scan slightly and remains a governance view, not the current-risk counter.\');',
  '    if (freshnessNotes.length) {',
  "      lines.push('');",
  "      lines.push(ru ? 'UNCERTAINTY / FRESHNESS' : 'UNCERTAINTY / FRESHNESS');",
  '      freshnessNotes.forEach(x => lines.push(x));',
  '    }',
  '',
  "    lines.push('');",
  "    lines.push(ru ? 'Это owner-attention / decision-support brief. Он не говорит покупать, продавать или двигать капитал.' : 'This is an owner-attention / decision-support brief. It does not tell the owner to buy, sell or move capital.');",
  '    return {',
  "      text: lines.join(nl),",
  "      source: 'Live Security Intelligence + Live Decision & Outcome Learning + Proposal Work Queue + Live Change Intelligence',",
  "      confidenceHint: 'partial'",
  '    };',
  '  }'
]);
replaceOnce(helperAnchor, helper + helperAnchor, 'Owner Brief helper');

const oldOwnerBranch = block([
  "    if (includesAny(q, ['deserves the owner attention first', 'owner attention first', 'investigate first', 'attention first', 'внимание владельца', 'исследовать первым'])) {",
  '      const cases = safeArray(state.learning?.activeCases);',
  "      const decisionWorthy = cases.filter(x => x?.experienceEligibility === 'decision-worthy');",
  "      const high = decisionWorthy.filter(x => String(x?.riskTier || '').toLowerCase() === 'high');",
  '      if (decisionWorthy.length) {',
  "        const domains = [...new Set(decisionWorthy.map(x => x?.domain).filter(Boolean))].join(', ');",
  '        return partial(',
  '          ru',
  "            ? 'Первым заслуживает review не инвестиционная аллокация, а ' + decisionWorthy.length + ' decision-worthy OS case(s)' + (high.length ? ', из них ' + high.length + ' high-risk' : '') + '. Домены: ' + (domains || 'не классифицированы') + '. Это приоритет внимания по verified Learning queue, а не рекомендация двигать капитал.'",
  "            : 'The first review target is not an investment allocation: it is the ' + decisionWorthy.length + ' decision-worthy OS case(s)' + (high.length ? ', including ' + high.length + ' high-risk' : '') + '. Domains: ' + (domains || 'unclassified') + '. This is an attention priority from the verified Learning queue, not a recommendation to move capital.',",
  "          'Live Decision & Outcome Learning'",
  '        );',
  '      }',
  "      return unknown(ru ? 'Learning queue сейчас не даёт проверенного decision-worthy приоритета.' : 'The Learning queue currently provides no verified decision-worthy priority.', 'Live Decision & Outcome Learning');",
  '    }'
]);
replaceOnce(
  oldOwnerBranch,
  "    if (includesAny(q, ['deserves the owner attention first', 'owner attention first', 'investigate first', 'attention first', 'внимание владельца', 'исследовать первым', 'owner brief', 'дай owner brief', 'дай бриф владельца'])) return ownerBriefAnswer(lang);",
  'Owner Unknown review routing'
);

replaceOnce(
  "    if (includesAny(q, ['что важнее сейчас', 'что реально важно', 'what matters now', 'what actually matters', 'what should i pay attention to', 'на что обратить внимание'])) return latestChangeSalienceAnswer(lang, 'attention');",
  "    if (includesAny(q, ['что важнее сейчас', 'что реально важно', 'what matters now', 'what actually matters', 'what should i pay attention to', 'на что обратить внимание', 'что мне реально надо знать сейчас', 'what do i actually need to know now'])) return ownerBriefAnswer(lang);",
  'Generic owner brief routing'
);

replaceOnce(
  "    const labels = ['Сколько сейчас компаний?', 'Сравни defitea.eth и YieldRing.eth', 'Что система предлагает?', 'Почему только 3 proposal?', 'Может ли система что-то выполнить?'];",
  "    const labels = ['Сколько сейчас компаний?', 'Сравни defitea.eth и YieldRing.eth', 'Что реально требует внимания?', 'Что система предлагает?', 'Может ли система что-то выполнить?'];",
  'Visible quick action'
);

replaceOnce(
  "      const [stack, bridge, learning, decisions, proposals, builder, guardian, changeIntelligence, productivity, stable, companiesHtml] = await Promise.all([",
  "      const [stack, bridge, learning, decisions, proposals, builder, guardian, changeIntelligence, securityIntelligence, productivity, stable, companiesHtml] = await Promise.all([",
  'Boot destructuring'
);
replaceOnce(
  "        getJson(URLS.changeIntelligence, true),\n        getJson(URLS.productivity),",
  "        getJson(URLS.changeIntelligence, true),\n        getJson(URLS.securityIntelligence, true),\n        getJson(URLS.productivity),",
  'Boot security load'
);
replaceOnce(
  "        changeIntelligence,\n        productivity,",
  "        changeIntelligence,\n        securityIntelligence,\n        productivity,",
  'Boot state security assign'
);

replaceOnce(
  "    $('securityFact').textContent = String(security()?.status || 'unknown').toUpperCase();",
  "    $('securityFact').textContent = String(state.securityIntelligence?.status || security()?.status || 'unknown').toUpperCase();",
  'Visible security freshness'
);

fs.writeFileSync(path, s, 'utf8');
console.log('Ask v0.9 Cross-Source Owner Brief patch complete');
