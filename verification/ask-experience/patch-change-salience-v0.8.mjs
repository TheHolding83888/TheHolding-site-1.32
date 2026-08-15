import fs from 'node:fs';

const path = 'agents/console/app.js';
let s = fs.readFileSync(path, 'utf8');

function replaceOnce(oldText, newText, label) {
  if (s.includes(newText)) {
    console.log(`${label}: already applied`);
    return;
  }
  if (!s.includes(oldText)) throw new Error(`${label}: expected anchor missing`);
  s = s.replace(oldText, newText);
  console.log(`${label}: applied`);
}

const block = lines => lines.join('\n');

replaceOnce(
  "    guardian: '/intelligence/guardian/guardian-state.json',\n    productivity: '/companies/productivity-data.json',",
  "    guardian: '/intelligence/guardian/guardian-state.json',\n    changeIntelligence: '/intelligence/change-intelligence.json',\n    productivity: '/companies/productivity-data.json',",
  'Change Intelligence URL'
);

replaceOnce(
  "    guardian: null,\n    productivity: null,",
  "    guardian: null,\n    changeIntelligence: null,\n    productivity: null,",
  'Change Intelligence state'
);

replaceOnce(
  "    if (/Guardian State/i.test(s)) add(URLS.guardian);\n    if (/OS Governance/i.test(s)) { add(URLS.proposals); add(URLS.builder); add(URLS.guardian); }",
  "    if (/Guardian State/i.test(s)) add(URLS.guardian);\n    if (/Change Intelligence/i.test(s)) add(URLS.changeIntelligence);\n    if (/OS Governance/i.test(s)) { add(URLS.proposals); add(URLS.builder); add(URLS.guardian); }",
  'Answer artifact binding'
);

replaceOnce(
  "    if (artifact === URLS.guardian) return state.guardian?.generatedAt || null;\n    if (artifact === URLS.productivity) return state.productivity?.generatedAt || null;",
  "    if (artifact === URLS.guardian) return state.guardian?.generatedAt || null;\n    if (artifact === URLS.changeIntelligence) return state.changeIntelligence?.generatedAt || null;\n    if (artifact === URLS.productivity) return state.productivity?.generatedAt || null;",
  'GeneratedAt binding'
);

const helperAnchor = "\n\n  async function ownerEvidenceSynthesis(raw, lang) {";
const helper = block([
  '',
  '',
  '  function changeSalienceScore(event) {',
  "    const severity = String(event?.severity || '').toLowerCase();",
  "    const category = String(event?.category || '').toLowerCase();",
  "    const metric = String(event?.metric || '').toLowerCase();",
  "    let score = severity === 'critical' ? 100 : severity === 'high' ? 80 : severity === 'watch' ? 60 : severity === 'medium' ? 45 : 10;",
  "    if (metric === 'new-daily-snapshot') score -= 8;",
  "    if (category === 'reporting' && metric === 'new-daily-snapshot') score -= 4;",
  '    const previous = finite(event?.previousValue);',
  '    const current = finite(event?.currentValue);',
  '    if (previous !== null && current !== null) {',
  '      const absDelta = Math.abs(current - previous);',
  '      const base = Math.max(Math.abs(previous), 1e-9);',
  '      const rel = absDelta / base;',
  '      score += Math.min(25, rel * 20);',
  '      if (absDelta > 1) score += Math.min(10, Math.log10(absDelta + 1) * 3);',
  '    }',
  '    if (event?.whyItMatters) score += 2;',
  '    return score;',
  '  }',
  '',
  "  function latestChangeSalienceAnswer(lang, mode = 'changes') {",
  '    const packet = state.changeIntelligence;',
  "    const ru = lang === 'ru';",
  '    const nl = String.fromCharCode(10);',
  '    if (!packet || packet?.sourceHealth?.allFresh !== true) return {',
  "      text: ru ? 'Change Intelligence сейчас недоступен или source health не полностью fresh. Я не буду собирать change summary из устаревшего состояния.' : 'Change Intelligence is unavailable or its source health is not fully fresh. I will not build a change summary from stale state.',",
  "      source: 'Change Intelligence unavailable',",
  "      confidenceHint: 'unknown'",
  '    };',
  '',
  '    const changes = safeArray(packet.whatChanged)',
  '      .map(event => ({ event, score: changeSalienceScore(event) }))',
  '      .sort((a, b) => b.score - a.score);',
  '    const watch = safeArray(packet.watchNext);',
  '    const previousAt = packet?.bridge?.previousSnapshotAt || null;',
  "    const horizon = previousAt ? (ru ? 'с предыдущего verified snapshot ' + dateShort(previousAt) : 'since the previous verified snapshot ' + dateShort(previousAt)) : (ru ? 'в последнем verified delta' : 'in the latest verified delta');",
  '',
  "    if (mode === 'attention') {",
  '      const rankedWatch = watch.slice().sort((a, b) => {',
  "        const w = x => String(x?.severity || '').toLowerCase() === 'critical' ? 100 : String(x?.severity || '').toLowerCase() === 'high' ? 80 : String(x?.severity || '').toLowerCase() === 'watch' ? 60 : 20;",
  '        return w(b) - w(a);',
  '      }).slice(0, 3);',
  "      const lines = rankedWatch.map((x, i) => (i + 1) + '. ' + String(x.summary || '') + (x.whyItMatters ? ' ' + String(x.whyItMatters) : ''));",
  '      const topChange = changes[0]?.event;',
  "      if (topChange) lines.push((ru ? 'Свежий material delta: ' : 'Fresh material delta: ') + topChange.summary);",
  '      return {',
  "        text: ru ? 'Сейчас я бы отделил operational noise от owner-attention так:' + nl + nl + (lines.join(nl) || 'Нет активных watch conditions.') + nl + nl + 'Это приоритет наблюдения из verified Change Intelligence, не инвестиционная рекомендация.' : 'I would separate operational noise from owner attention like this:' + nl + nl + (lines.join(nl) || 'There are no active watch conditions.') + nl + nl + 'This is a monitoring priority from verified Change Intelligence, not investment advice.',",
  "        source: 'Live Change Intelligence',",
  "        confidenceHint: 'measured'",
  '      };',
  '    }',
  '',
  '    if (!changes.length) return {',
  "      text: ru ? 'В последнем verified Observer delta материальных изменений не зафиксировано.' : 'No material changes were recorded in the latest verified Observer delta.',",
  "      source: 'Live Change Intelligence',",
  "      confidenceHint: 'measured'",
  '    };',
  '',
  "    const top = changes.slice(0, 3).map(({ event }, i) => (i + 1) + '. ' + event.summary + (event.whyItMatters ? ' ' + event.whyItMatters : ''));",
  '    return {',
  "      text: ru ? 'В verified Change Intelligence зафиксировано ' + changes.length + ' material change(s) ' + horizon + '. Наиболее значимые по bounded salience:' + nl + nl + top.join(nl) + nl + nl + 'Важно: это ранжирование последнего Observer delta, а не полный месячный анализ. Для горизонта «за месяц» нужно открыть Memory Vault history и агрегировать несколько snapshots.' : 'Verified Change Intelligence records ' + changes.length + ' material change(s) ' + horizon + '. The most significant by bounded salience are:' + nl + nl + top.join(nl) + nl + nl + 'Important: this ranks the latest Observer delta, not a full monthly history. A true “last month” answer requires aggregating multiple Memory Vault snapshots.',",
  "      source: 'Live Change Intelligence',",
  "      confidenceHint: 'partial'",
  '    };',
  '  }'
]);
replaceOnce(helperAnchor, helper + helperAnchor, 'Change salience helper');

replaceOnce(
  "    if (includesAny(q, ['changed most materially', 'what changed most', 'surprise me most', 'not looked', 'не смотрел месяц', 'что изменилось сильнее', 'что удивит больше'])) return unknown(\n      ru\n        ? 'Я вижу текущий verified state, но в этом интерфейсе пока нет нормализованного month-over-month change packet по всем компаниям. Поэтому я не буду объявлять самое важное изменение по памяти или по одной свежей цифре.'\n        : 'I can see current verified state, but this surface does not yet load a normalized month-over-month change packet across all companies. I will not name the most material change from memory or from one fresh metric.',\n      'Console capability map'\n    );",
  "    if (includesAny(q, ['changed most materially', 'what changed most', 'surprise me most', 'not looked', 'не смотрел месяц', 'что изменилось сильнее', 'что удивит больше'])) return latestChangeSalienceAnswer(lang, 'changes');",
  'Owner Unknown change synthesis'
);

replaceOnce(
  "    if (includesAny(q, ['что требует внимания', 'требует внимания', 'needs attention', 'attention items', 'проблемы сейчас'])) return attentionAnswer(lang);",
  "    if (includesAny(q, ['что важнее сейчас', 'что реально важно', 'what matters now', 'what actually matters', 'what should i pay attention to', 'на что обратить внимание'])) return latestChangeSalienceAnswer(lang, 'attention');\n    if (includesAny(q, ['что изменилось', 'что изменилось сейчас', 'what changed', 'latest changes', 'recent changes'])) return latestChangeSalienceAnswer(lang, 'changes');\n    if (includesAny(q, ['что требует внимания', 'требует внимания', 'needs attention', 'attention items', 'проблемы сейчас'])) return latestChangeSalienceAnswer(lang, 'attention');",
  'Route change + salience intents'
);

replaceOnce(
  "      const [stack, bridge, learning, decisions, proposals, builder, guardian, productivity, stable, companiesHtml] = await Promise.all([\n        getJson(URLS.stack),\n        getJson(URLS.bridge),\n        getJson(URLS.learning, true),\n        getJson(URLS.decisions, true),\n        getJson(URLS.proposals, true),\n        getJson(URLS.builder, true),\n        getJson(URLS.guardian, true),\n        getJson(URLS.productivity),",
  "      const [stack, bridge, learning, decisions, proposals, builder, guardian, changeIntelligence, productivity, stable, companiesHtml] = await Promise.all([\n        getJson(URLS.stack),\n        getJson(URLS.bridge),\n        getJson(URLS.learning, true),\n        getJson(URLS.decisions, true),\n        getJson(URLS.proposals, true),\n        getJson(URLS.builder, true),\n        getJson(URLS.guardian, true),\n        getJson(URLS.changeIntelligence, true),\n        getJson(URLS.productivity),",
  'Boot Promise list'
);

replaceOnce(
  "        guardian,\n        productivity,",
  "        guardian,\n        changeIntelligence,\n        productivity,",
  'Boot state assign'
);

fs.writeFileSync(path, s, 'utf8');
console.log('Ask v0.8 Change + Salience patch complete');
