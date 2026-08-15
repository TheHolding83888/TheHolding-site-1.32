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
const helper = `\n\n  function changeSalienceScore(event) {\n    const severity = String(event?.severity || '').toLowerCase();\n    const category = String(event?.category || '').toLowerCase();\n    const metric = String(event?.metric || '').toLowerCase();\n    let score = severity === 'critical' ? 100 : severity === 'high' ? 80 : severity === 'watch' ? 60 : severity === 'medium' ? 45 : 10;\n    if (metric === 'new-daily-snapshot') score -= 8;\n    if (category === 'reporting' && metric === 'new-daily-snapshot') score -= 4;\n    const previous = finite(event?.previousValue);\n    const current = finite(event?.currentValue);\n    if (previous !== null && current !== null) {\n      const absDelta = Math.abs(current - previous);\n      const base = Math.max(Math.abs(previous), 1e-9);\n      const rel = absDelta / base;\n      score += Math.min(25, rel * 20);\n      if (absDelta > 1) score += Math.min(10, Math.log10(absDelta + 1) * 3);\n    }\n    if (event?.whyItMatters) score += 2;\n    return score;\n  }\n\n  function latestChangeSalienceAnswer(lang, mode = 'changes') {\n    const packet = state.changeIntelligence;\n    const ru = lang === 'ru';\n    if (!packet || packet?.sourceHealth?.allFresh !== true) return {\n      text: ru\n        ? 'Change Intelligence сейчас недоступен или source health не полностью fresh. Я не буду собирать change summary из устаревшего состояния.'\n        : 'Change Intelligence is unavailable or its source health is not fully fresh. I will not build a change summary from stale state.',\n      source: 'Change Intelligence unavailable',\n      confidenceHint: 'unknown'\n    };\n\n    const changes = safeArray(packet.whatChanged)\n      .map(event => ({ event, score: changeSalienceScore(event) }))\n      .sort((a, b) => b.score - a.score);\n    const watch = safeArray(packet.watchNext);\n    const previousAt = packet?.bridge?.previousSnapshotAt || null;\n    const horizon = previousAt ? (ru ? 'с предыдущего verified snapshot ' + dateShort(previousAt) : 'since the previous verified snapshot ' + dateShort(previousAt)) : (ru ? 'в последнем verified delta' : 'in the latest verified delta');\n\n    if (mode === 'attention') {\n      const rankedWatch = watch.slice().sort((a, b) => {\n        const w = x => String(x?.severity || '').toLowerCase() === 'critical' ? 100 : String(x?.severity || '').toLowerCase() === 'high' ? 80 : String(x?.severity || '').toLowerCase() === 'watch' ? 60 : 20;\n        return w(b) - w(a);\n      }).slice(0, 3);\n      const lines = rankedWatch.map((x, i) => (i + 1) + '. ' + String(x.summary || '') + (x.whyItMatters ? ' ' + String(x.whyItMatters) : ''));\n      const topChange = changes[0]?.event;\n      if (topChange) lines.push((ru ? 'Свежий material delta: ' : 'Fresh material delta: ') + topChange.summary);\n      return {\n        text: ru\n          ? 'Сейчас я бы отделил operational noise от owner-attention так:\n\n' + (lines.join('\\n') || 'Нет активных watch conditions.') + '\n\nЭто приоритет наблюдения из verified Change Intelligence, не инвестиционная рекомендация.'\n          : 'I would separate operational noise from owner attention like this:\n\n' + (lines.join('\\n') || 'There are no active watch conditions.') + '\n\nThis is a monitoring priority from verified Change Intelligence, not investment advice.',\n        source: 'Live Change Intelligence',\n        confidenceHint: 'measured'\n      };\n    }\n\n    if (!changes.length) return {\n      text: ru ? 'В последнем verified Observer delta материальных изменений не зафиксировано.' : 'No material changes were recorded in the latest verified Observer delta.',\n      source: 'Live Change Intelligence',\n      confidenceHint: 'measured'\n    };\n\n    const top = changes.slice(0, 3).map(({ event }, i) => (i + 1) + '. ' + event.summary + (event.whyItMatters ? ' ' + event.whyItMatters : ''));\n    return {\n      text: ru\n        ? 'В verified Change Intelligence зафиксировано ' + changes.length + ' material change(s) ' + horizon + '. Наиболее значимые по bounded salience:\n\n' + top.join('\\n') + '\n\nВажно: это ранжирование последнего Observer delta, а не полный месячный анализ. Для горизонта «за месяц» нужно открыть Memory Vault history и агрегировать несколько snapshots.'\n        : 'Verified Change Intelligence records ' + changes.length + ' material change(s) ' + horizon + '. The most significant by bounded salience are:\n\n' + top.join('\\n') + '\n\nImportant: this ranks the latest Observer delta, not a full monthly history. A true “last month” answer requires aggregating multiple Memory Vault snapshots.',\n      source: 'Live Change Intelligence',\n      confidenceHint: 'partial'\n    };\n  }`;
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
