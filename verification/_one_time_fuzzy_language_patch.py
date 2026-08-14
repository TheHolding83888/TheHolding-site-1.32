from pathlib import Path
p=Path('agents/console/app.js')
s=p.read_text(encoding='utf-8')

old="""  const isRu = text => /[а-яё]/i.test(text);
  const norm = text => String(text || '')
    .replace(/\\bholdng\\b/gi, 'holding')"""
new="""  const isRu = text => /[а-яё]/i.test(text);

  // Conservative human-language typo recovery. This is intentionally NOT global fuzzy search.
  // Only known entity/protocol/intent lexemes may be corrected, with edit distance <= 1.
  const FUZZY_QUERY_LEXEMES = Object.freeze([
    'holding', 'monetra', 'defitea', 'yieldring', 'yield', 'basis', 'aerodrome', 'velodrome',
    'rewards', 'reward', 'claimable', 'companies', 'company', 'using', 'compare', 'productivity',
    'performance', 'embedded', 'current', 'registry', 'passport', 'learning', 'proposal', 'builder',
    'guardian', 'transaction', 'authority', 'allocation'
  ]);

  function editDistanceAtMostOne(a, b) {
    if (a === b) return true;
    if (Math.abs(a.length - b.length) > 1) return false;
    if (a.length === b.length) {
      let mismatches = 0;
      for (let i = 0; i < a.length; i++) if (a[i] !== b[i] && ++mismatches > 1) return false;
      return true;
    }
    const shorter = a.length < b.length ? a : b;
    const longer = a.length < b.length ? b : a;
    let i = 0, j = 0, edits = 0;
    while (i < shorter.length && j < longer.length) {
      if (shorter[i] === longer[j]) { i++; j++; continue; }
      if (++edits > 1) return false;
      j++;
    }
    return true;
  }

  function fuzzyKnownLexemes(text) {
    return String(text || '').replace(/[A-Za-z][A-Za-z0-9-]{3,}/g, token => {
      const lower = token.toLowerCase();
      if (FUZZY_QUERY_LEXEMES.includes(lower)) return lower;
      const matches = FUZZY_QUERY_LEXEMES.filter(candidate =>
        candidate[0] === lower[0]
        && Math.abs(candidate.length - lower.length) <= 1
        && editDistanceAtMostOne(lower, candidate)
      );
      return matches.length === 1 ? matches[0] : token;
    });
  }

  const norm = text => fuzzyKnownLexemes(String(text || ''))
    .replace(/\\bholdng\\b/gi, 'holding')"""
if s.count(old)!=1: raise SystemExit(f'norm anchor expected 1 got {s.count(old)}')
s=s.replace(old,new,1)

old_route="""if (protocolGroup(raw) && includesAny(q,['which companies','какие компании','кто использует','companies use','компании используют'])) return protocolCompaniesAnswer(protocolGroup(raw),lang);"""
new_route="""if (protocolGroup(raw) && includesAny(q,['which companies','who uses','who is using','which ones use','какие компании','кто использует','companies use','компании используют'])) return protocolCompaniesAnswer(protocolGroup(raw),lang);"""
if s.count(old_route)!=1: raise SystemExit(f'protocol-company route anchor expected 1 got {s.count(old_route)}')
s=s.replace(old_route,new_route,1)

for marker in ['FUZZY_QUERY_LEXEMES','function editDistanceAtMostOne','function fuzzyKnownLexemes','who is using']:
    if marker not in s: raise SystemExit('missing '+marker)
p.write_text(s,encoding='utf-8')
print('conservative fuzzy language patch PASS')
