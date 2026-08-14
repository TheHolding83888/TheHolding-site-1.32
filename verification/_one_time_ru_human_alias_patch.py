from pathlib import Path
p=Path('agents/console/app.js')
s=p.read_text(encoding='utf-8')

anchor="""  const norm = text => fuzzyKnownLexemes(String(text || ''))
    .replace(/\\bholdng\\b/gi, 'holding')"""
if s.count(anchor)!=1: raise SystemExit(f'norm anchor expected 1 got {s.count(anchor)}')
insert="""  const FUZZY_RU_QUERY_LEXEMES = Object.freeze([
    'монетра', 'монетру', 'монетре', 'дефити', 'дефитеа', 'йелд', 'елд', 'бейсис',
    'аэродром', 'велодром', 'ревардс', 'реварды', 'ревардсам', 'награды', 'компания',
    'компании', 'использует', 'используют', 'продуктивность', 'доходность', 'сравни',
    'транзакцию', 'транзу'
  ]);

  function fuzzyKnownRuLexemes(text) {
    return String(text || '').replace(/[А-Яа-яЁё]{3,}/g, token => {
      const lower = token.toLowerCase().replace(/ё/g, 'е');
      if (FUZZY_RU_QUERY_LEXEMES.includes(lower)) return lower;
      const matches = FUZZY_RU_QUERY_LEXEMES.filter(candidate =>
        candidate[0] === lower[0]
        && Math.abs(candidate.length - lower.length) <= 1
        && editDistanceAtMostOne(lower, candidate)
      );
      return matches.length === 1 ? matches[0] : token;
    });
  }

  function canonicalizeHumanAliases(text) {
    return fuzzyKnownLexemes(fuzzyKnownRuLexemes(String(text || '')))
      .replace(/монетра|монетру|монетре/gi, 'monetra')
      .replace(/дефити|дефитеа/gi, 'defitea')
      .replace(/(?:йелд|елд)\\s+бейсис/gi, 'yield basis')
      .replace(/аэродром/gi, 'aerodrome')
      .replace(/велодром/gi, 'velodrome')
      .replace(/ревардс|реварды|ревардсам/gi, 'rewards');
  }

  const norm = text => canonicalizeHumanAliases(String(text || ''))
    .replace(/\\bholdng\\b/gi, 'holding')"""
s=s.replace(anchor,insert,1)
for marker in ['FUZZY_RU_QUERY_LEXEMES','function fuzzyKnownRuLexemes','function canonicalizeHumanAliases',".replace(/дефити|дефитеа/gi, 'defitea')"]:
    if marker not in s: raise SystemExit('missing '+marker)
p.write_text(s,encoding='utf-8')
print('RU transliteration and typo recovery patch PASS')
