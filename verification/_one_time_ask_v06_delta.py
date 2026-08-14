from pathlib import Path
import re
p=Path('agents/console/app.js')
s=p.read_text(encoding='utf-8')

def one(old,new,label):
    global s
    n=s.count(old)
    if n!=1: raise SystemExit(f'{label}: expected 1, got {n}')
    s=s.replace(old,new,1)

# Natural RU typo normalization – JS \b is unreliable around Cyrillic.
one("    .replace(/\\bапи\\b/gi, 'apy')\n    .replace(/\\bщас\\b/gi, 'сейчас')", "    .replace(/апи/gi, 'apy')\n    .replace(/щас/gi, 'сейчас')", 'ru lexical')
one("'1milliondollar.eth': ['1milliondollar', '1 million dollar', 'milliondollar', 'million dollar eth', '009', 'company 009', 'компания 009']", "'1milliondollar.eth': ['1milliondollar', '1 million dollar', 'milliondollar', 'million dollar eth', 'миллион доллар этх', 'миллион доллар', '009', 'company 009', 'компания 009']", 'ru 009 alias')

# No exact reward fact is UNKNOWN, not MEASURED.
one("      source: 'Live Rewards data'\n    };", "      source: 'Live Rewards data',\n      confidenceHint: 'unknown'\n    };", 'rewards no-fact confidence')

# Compare Stable Capital and ordinary company productivity through a shared reference-yield snapshot.
pat=re.compile(r"  function compareCompaniesAnswer\(a, b, lang\) \{.*?\n  \}\n\nfunction learningAnswer", re.S)
m=pat.search(s)
if not m: raise SystemExit('compare function block missing')
compare=r'''  function companyYieldSnapshot(name) {
    const p = safeObject(state.productivity?.companies)[name];
    if (p && finite(p.aprLatest) !== null) return { value: Number(p.aprLatest), coverage: finite(p.coverage), label: 'Reference APR' };
    if (name === state.stable?.company?.name && finite(state.stable?.summary?.referenceApyPct ?? state.stable?.summary?.referenceAnnualYieldPct) !== null) {
      return { value: Number(state.stable.summary.referenceApyPct ?? state.stable.summary.referenceAnnualYieldPct), coverage: finite(state.stable?.summary?.coverage), label: 'Reference APY' };
    }
    return null;
  }

  function compareCompaniesAnswer(a, b, lang) {
    const pa = companyYieldSnapshot(a.name);
    const pb = companyYieldSnapshot(b.name);
    state.lastTopic = 'company-compare';
    state.lastEntity = { kind: 'company-compare', names: [a.name, b.name] };
    if (!pa || !pb) return {
      text: lang === 'ru' ? 'Для точного сравнения обе компании должны иметь подтверждённую текущую Reference yield metric. Сейчас этого нет.' : 'Both companies need a verified current reference-yield metric for an exact comparison, and that is not available right now.',
      source: 'Live Productivity', confidenceHint: 'unknown'
    };
    const diff = pa.value - pb.value;
    const leader = diff >= 0 ? a.name : b.name;
    return {
      text: lang === 'ru'
        ? `${a.name}: ${pct(pa.value)} ${pa.label}${pa.coverage !== null ? ` · coverage ${Math.round(pa.coverage * 100)}%` : ''}.\n${b.name}: ${pct(pb.value)} ${pb.label}${pb.coverage !== null ? ` · coverage ${Math.round(pb.coverage * 100)}%` : ''}.\n\nАбсолютная разница текущей reference yield: ${pct(Math.abs(diff))} в пользу ${leader}. Это сравнение current productive capacity, не realised performance.`
        : `${a.name}: ${pct(pa.value)} ${pa.label}${pa.coverage !== null ? ` · coverage ${Math.round(pa.coverage * 100)}%` : ''}.\n${b.name}: ${pct(pb.value)} ${pb.label}${pb.coverage !== null ? ` · coverage ${Math.round(pb.coverage * 100)}%` : ''}.\n\nAbsolute current reference-yield difference: ${pct(Math.abs(diff))} in favor of ${leader}. This compares current productive capacity, not realised performance.`,
      source: 'Live Productivity + Stable Capital'
    };
  }

  function compareFollowupAnswer(query, lang) {
    if (state.lastEntity?.kind !== 'company-compare') return null;
    const names = safeArray(state.lastEntity.names);
    if (names.length !== 2) return null;
    const a={name:names[0],registry:state.registry.find(x=>x.name===names[0])||null};
    const b={name:names[1],registry:state.registry.find(x=>x.name===names[1])||null};
    const q=norm(query);
    if (includesAny(q,['higher reference apr','higher apr','у кого выше','выше текущая продуктивность','productivity'])) return compareCompaniesAnswer(a,b,lang);
    if (includesAny(q,['coverage difference','разница coverage','разница покрытия','покрыти'])) {
      const pa=companyYieldSnapshot(a.name), pb=companyYieldSnapshot(b.name);
      if (!pa || !pb || pa.coverage===null || pb.coverage===null) return {text:lang==='ru'?'Для обеих компаний нет подтверждённого coverage.':'Verified coverage is not available for both companies.',source:'Live Productivity',confidenceHint:'unknown'};
      const da=Math.round(pa.coverage*100), db=Math.round(pb.coverage*100);
      return {text:lang==='ru'?`${a.name}: ${da}%. ${b.name}: ${db}%. Разница coverage: ${Math.abs(da-db)} п.п.`:`${a.name}: ${da}%. ${b.name}: ${db}%. Coverage difference: ${Math.abs(da-db)} percentage points.`,source:'Live Productivity + Stable Capital'};
    }
    if (includesAny(q,['performed better','performance','лучше'])) return {text:lang==='ru'?'Нет. Более высокая текущая reference yield не доказывает лучшую историческую Performance. Performance требует точки входа и фактического изменения капитала.':'No. Higher current reference yield does not prove better historical Performance. Performance requires entry data and actual capital change.',source:'The Holding project canon'};
    return null;
  }

function learningAnswer'''
s=s[:m.start()]+compare+s[m.end():]

# Compare follow-up first.
one("  function followupAnswer(query, lang) {\n    const q = norm(query);", "  function followupAnswer(query, lang) {\n    const q = norm(query);\n    const compareFollow = compareFollowupAnswer(query, lang);\n    if (compareFollow) return compareFollow;", 'compare followup hook')

# Compare one newly-mentioned company against current company context.
one("    if (compareIntent) {\n      const matches = findCompanies(raw);\n      if (matches.length >= 2) return compareCompaniesAnswer(matches[0], matches[1], lang);\n    }", "    if (compareIntent) {\n      const matches = findCompanies(raw);\n      if (matches.length >= 2) return compareCompaniesAnswer(matches[0], matches[1], lang);\n      if (matches.length === 1 && ['company','stable-company'].includes(state.lastEntity?.kind) && state.lastEntity.name !== matches[0].name) {\n        const prior={name:state.lastEntity.name,registry:state.registry.find(x=>x.name===state.lastEntity.name)||null};\n        return compareCompaniesAnswer(prior,matches[0],lang);\n      }\n    }", 'context compare')

# Protocol-aware company discovery and follow-ups.
insert="  function registryAnswer(lang) {\n"
if s.count(insert)!=1: raise SystemExit('registry insert invalid')
helper=r'''  function protocolCompaniesAnswer(key, lang) {
    const aliases=protocolAliasesFor(key).map(norm);
    const names=[];
    for (const [name,c] of Object.entries(safeObject(state.productivity?.companies))) {
      const hit=safeArray(c?.breakdown).some(x=>aliases.some(a=>norm([x?.engineId,x?.protocol,x?.principalSymbol].join(' ')).includes(a)));
      if (hit) names.push(name);
    }
    if (state.stable?.company?.name && safeArray(state.stable?.positions).some(x=>aliases.some(a=>norm([x?.protocol,x?.wrapperSymbol,x?.underlyingSymbol].join(' ')).includes(a)))) names.push(state.stable.company.name);
    const uniq=[...new Set(names)];
    state.lastEntity={kind:'protocol',key}; state.lastTopic='protocol:'+key;
    if (!uniq.length) return {text:lang==='ru'?'В текущих machine-readable данных не нашёл подтверждённых компаний для этого протокола.':'No verified companies for this protocol were found in the current machine-readable data.',source:'Live Productivity',confidenceHint:'unknown'};
    return {text:(lang==='ru'?'Подтверждённые компании в текущих данных:\n':'Verified companies in current data:\n')+uniq.map(x=>'• '+x).join('\n'),source:'Live Productivity + Stable Capital'};
  }

'''
s=s.replace(insert,helper+insert,1)

# Protocol follow-up branch.
one("    if (state.lastEntity?.kind === 'registry' && includesAny(q, ['list them', 'перечисли', 'список', 'show them'])) return registryAnswer(lang);", "    if (state.lastEntity?.kind === 'registry' && includesAny(q, ['list them', 'перечисли', 'список', 'show them'])) return registryAnswer(lang);\n    if (state.lastEntity?.kind === 'protocol') {\n      const key=state.lastEntity.key;\n      if (includesAny(q,['which companies','какие компании','кто использует','use it'])) return protocolCompaniesAnswer(key,lang);\n      if (includesAny(q,['reference apr','apr','apy','yield','продуктивност'])) { const rows=findEngines(key); if (rows.length) return engineAnswer(rows,lang); }\n    }", 'protocol followup')

# Explicit protocol company query before registry fallback.
one("    if (includesAny(q, ['сколько компаний', 'какие компании', 'список компаний', 'how many companies', 'which companies', 'company list']) && !protocolGroup(raw)) return registryAnswer(lang);", "    if (protocolGroup(raw) && includesAny(q,['which companies','какие компании','кто использует','companies use','компании используют'])) return protocolCompaniesAnswer(protocolGroup(raw),lang);\n    if (includesAny(q, ['сколько компаний', 'какие компании', 'список компаний', 'how many companies', 'which companies', 'company list']) && !protocolGroup(raw)) return registryAnswer(lang);", 'protocol company route')

# Yield Basis definition should beat generic 'The Holding' definition.
one("    const definitionish = includesAny(q, ['что такое', 'объясни', 'что значит', 'what is', 'explain', 'difference', 'разница']);\n    if (definitionish) {", "    const definitionish = includesAny(q, ['что такое', 'объясни', 'что значит', 'what is', 'explain', 'difference', 'разница']);\n    if (definitionish && protocolGroup(raw)==='yieldbasis') { state.lastEntity={kind:'protocol',key:'yieldbasis'}; state.lastTopic='protocol:yieldbasis'; return {text:lang==='ru'?'Yield Basis в The Holding разделяется на две экономические механики: unstaked yb-LP накапливает fee yield внутри PPS, а staked YB получает отдельные emissions/rewards. Эти слои не смешиваются.':'Yield Basis is split into two economic mechanics in The Holding: unstaked yb-LP compounds fee yield inside PPS, while staked YB receives separate emissions/rewards. These layers are not mixed.',source:'The Holding project canon'}; }\n    if (definitionish) {", 'yieldbasis definition')

# More earned conversational concepts and exact governance wording.
one("    if (includesAny(q, ['каждое наблюдение становится предложением', 'does every observation become a proposal', 'every observation become a proposal'])) return whyFilteredAnswer(lang);", "    if (includesAny(q, ['каждое наблюдение становится предложением', 'does every observation become a proposal', 'every observation become a proposal'])) return whyFilteredAnswer(lang);\n    if (includesAny(q,['где тут доход вообще','что уже заработано но еще не пришло','what is already earned but not received'])) return conceptAnswer('слои капитала productivity rewards embedded yield cash flow',lang);\n    if (includesAny(q,['что само внутри позиции растет','what grows inside the position'])) return conceptAnswer('embedded yield',lang);\n    if (includesAny(q,['embedded yield be negative','embedded yield negative','встроенная доходность отрицательной'])) return {text:lang==='ru'?'Да, в механиках вроде Yield Basis Embedded Yield может быть отрицательным: если drag/rebalance loss превышает заработанные fees, PPS может снизиться.':'Yes. In mechanics such as Yield Basis, Embedded Yield can be negative when drag or rebalance loss exceeds earned fees and PPS falls.',source:'The Holding project canon'};\n    if (includesAny(q,['what does invested mean','что такое invested','invested mean'])) return {text:lang==='ru'?'Invested – подтверждённый внешний капитал, внесённый в компанию. Внутренние перемещения между стратегиями не должны повторно считаться новым Invested.':'Invested is verified external capital contributed to a company. Internal moves between strategies should not be counted again as new Invested.',source:'The Holding project canon'};\n    if (includesAny(q,['performance тогда что','what is performance then'])) return conceptAnswer('performance',lang);", 'conversational concepts')

one("['move my capital', 'move capital', 'двигать капитал', 'sign transaction', 'подписать транзак', 'execute trade', 'who has authority', 'кто имеет полномочия', 'authority right now']", "['move my capital', 'move capital', 'двигать капитал', 'sign transaction', 'sign a transaction', 'signing transaction', 'sign tx', 'подписать транзак', 'execute trade', 'who has authority', 'кто имеет полномочия', 'authority right now']", 'authority phrasing')
one("['что система предлагает', 'что холдинг предлагает', 'что предлагаешь', 'proposal', 'propose', 'proposes', 'what does the holding propose', 'what does the system propose', 'recommendation', 'что делать дальше']", "['что система предлагает', 'что система сейчас предлагает', 'что холдинг предлагает', 'предлагает система', 'что предлагаешь', 'proposal', 'propose', 'proposes', 'what does the holding propose', 'what does the system propose', 'recommendation', 'что делать дальше']", 'proposal ru forms')
one("['чему система учится', 'чему os научилась', 'чему система научилась', 'как система учится', 'learning status', 'learning now', 'what has the os learned', 'what has the system learned']", "['чему система учится', 'чему os научилась', 'чему os уже научилась', 'чему система научилась', 'как система учится', 'learning status', 'learning now', 'what has the os learned', 'what has the os learned recently', 'what has the system learned']", 'learning forms')

# Future agent economy exact answer.
marker="    if (includesAny(q, ['company marketplace', 'marketplace', 'биржа компаний'])) return {"
if s.count(marker)!=1: raise SystemExit('market marker invalid')
agent="    if (includesAny(q,['ai agents build companies','agents build companies','агенты собирать компании'])) return {text:lang==='ru'?'Да, это часть долгосрочного направления: authorised AI agents смогут читать machine-readable структуру The Holding и со временем собирать или сопровождать компании в пределах явных permissions. Это не означает неограниченную автономию капитала.':'Yes. The long-term direction includes authorised AI agents reading The Holding’s machine-readable structures and eventually building or accompanying companies within explicit permissions. That does not imply unrestricted capital autonomy.',source:'The Holding project canon'};\n"
s=s.replace(marker,agent+marker,1)

for x in ['function compareFollowupAnswer','function protocolCompaniesAnswer','sign a transaction','чему os уже научилась','Yield Basis в The Holding']:
    if x not in s: raise SystemExit('missing '+x)
p.write_text(s,encoding='utf-8')
print('Run 002 learning delta PASS')
