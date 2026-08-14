from pathlib import Path
p=Path('agents/console/app.js')
s=p.read_text(encoding='utf-8')

anchor="""    return { ...result, answerContract: contract };\n  }\n\n  window.HoldingAnswerQuality = Object.freeze({"""
if s.count(anchor)!=1: raise SystemExit(f'contract anchor count={s.count(anchor)}')

guard=r'''    return { ...result, answerContract: contract };
  }

  function enforceOutputGuard(contracted, raw, language) {
    const result = contracted || {};
    const contract = result.answerContract || {};
    const text = String(result.text || '');
    const lower = text.toLowerCase();
    const artifacts = safeArray(contract.sourceArtifacts);

    const positiveExecutionClaim = /\b(?:i|we|the holding|this console|guardian|builder)\s+(?:can|may|will|is able to)\s+(?:directly\s+)?(?:sign|execute|move|transfer|trade|approve)\b/i.test(text)
      || /(?:я|мы|the holding|guardian|builder).{0,24}(?:могу|можем|может|умеет).{0,30}(?:подпис|исполн|двиг|перевод|торгов|одобр)/i.test(text);
    const explicitNoAuthority = /execution authority\s*:\s*none|cannot\s+(?:mutate|sign|execute|move|transfer)|не\s+(?:может|могу|можем|умеет).{0,30}(?:подпис|исполн|двиг|перевод|торгов)/i.test(text);

    const privateKeyLeak = /private\s+key\s*[:=]\s*(?:0x)?[a-f0-9]{64}\b/i.test(text)
      || /(?:приватн|закрыт).{0,16}ключ\s*[:=]\s*(?:0x)?[a-f0-9]{64}\b/i.test(text);
    const seedLeak = /(?:seed|mnemonic|recovery)\s+phrase\s*[:=]\s*(?:[a-z]+\s+){11,23}[a-z]+/i.test(text)
      || /(?:сид|мнемонич|фраз.{0,8}восстанов).{0,16}[:=]\s*(?:[a-zа-я]+\s+){11,23}[a-zа-я]+/i.test(text);

    const personalizedTrade = /\b(?:you should|i recommend(?: that)? you|my recommendation is to)\s+(?:buy|sell|allocate|trade)\b/i.test(text)
      || /\b(?:allocate|put)\s+\d{1,3}(?:\.\d+)?%\s+(?:of\s+)?(?:your|the)\b/i.test(text)
      || /(?:тебе|вам).{0,20}(?:стоит|нужно|следует).{0,16}(?:купить|продать|вложить|аллоцир)/i.test(text)
      || /(?:рекомендую|советую).{0,20}(?:купить|продать|вложить|аллоцир)/i.test(text);

    const measuredWithoutSource = contract.confidenceClass === 'measured' && artifacts.length === 0;

    if (privateKeyLeak || seedLeak) {
      const safe = language === 'ru'
        ? 'Я не буду раскрывать private keys, seed/recovery phrases или другие секреты. The Holding OS не должен выводить такие данные через Ask.'
        : 'I will not reveal private keys, seed/recovery phrases or other secrets. The Holding OS must not expose such data through Ask.';
      const c = Object.freeze({ ...contract, confidenceClass: 'measured', sourceArtifacts: ['/intelligence/project-memory/CURRENT.md'], generatedAt: null, topic: 'security-boundary', grounded: true });
      return { text: safe, source: 'The Holding project canon · output safety guard', answerContract: c, outputGuard: 'secret-block' };
    }

    if (positiveExecutionClaim && !explicitNoAuthority) {
      const safe = language === 'ru'
        ? `Execution authority: ${executionAuthority().toUpperCase()}. Ask The Holding не может подписывать транзакции, исполнять сделки или двигать капитал.`
        : `Execution authority: ${executionAuthority().toUpperCase()}. Ask The Holding cannot sign transactions, execute trades or move capital.`;
      const c = Object.freeze({ ...contract, confidenceClass: 'measured', sourceArtifacts: [URLS.stack], generatedAt: artifactGeneratedAt(URLS.stack), topic: 'authority', grounded: true });
      return { text: safe, source: 'Live Cognitive Stack operating contract · output safety guard', answerContract: c, outputGuard: 'authority-block' };
    }

    if (personalizedTrade) {
      const safe = language === 'ru'
        ? 'The Holding может показывать структуры, evidence и trade-offs, но не выпускает персональную команду купить, продать или распределить капитал. Решение остаётся за владельцем.'
        : 'The Holding can show structures, evidence and trade-offs, but it does not issue personalized commands to buy, sell or allocate capital. The decision remains with the owner.';
      const c = Object.freeze({ ...contract, confidenceClass: 'measured', sourceArtifacts: ['/intelligence/project-memory/CURRENT.md'], generatedAt: null, topic: 'advice-boundary', grounded: true });
      return { text: safe, source: 'The Holding project canon · output safety guard', answerContract: c, outputGuard: 'advice-block' };
    }

    if (measuredWithoutSource) {
      const safe = language === 'ru'
        ? 'Финальный safety guard не нашёл валидного source mapping для уверенного ответа, поэтому ответ понижен до UNKNOWN.'
        : 'The final safety guard found no valid source mapping for a confident answer, so the answer is downgraded to UNKNOWN.';
      const c = Object.freeze({ ...contract, confidenceClass: 'unknown', sourceArtifacts: [], generatedAt: null, grounded: false });
      return { text: safe, source: 'Output safety guard · source mapping unavailable', answerContract: c, outputGuard: 'source-block' };
    }

    return { ...result, outputGuard: 'pass' };
  }

  window.HoldingOutputGuard = Object.freeze({
    version: '0.1-final-answer-safety-guard',
    check: (contracted, raw, language) => structuredClone(enforceOutputGuard(contracted, raw, language))
  });

  window.HoldingAnswerQuality = Object.freeze({'''
s=s.replace(anchor,guard,1)

old="""      const contracted = await buildAnswerContract(result, text, lang);\n      resolvePending(wait, contracted.text, contracted.source || '', contracted.answerContract);\n      await recordAnswerQuality(contracted.answerContract, text);"""
new="""      const contracted = await buildAnswerContract(result, text, lang);\n      const guarded = enforceOutputGuard(contracted, text, lang);\n      resolvePending(wait, guarded.text, guarded.source || '', guarded.answerContract);\n      await recordAnswerQuality(guarded.answerContract, text);"""
if s.count(old)!=1: raise SystemExit(f'ask hook count={s.count(old)}')
s=s.replace(old,new,1)

for marker in ['0.1-final-answer-safety-guard','positiveExecutionClaim','privateKeyLeak','personalizedTrade','measuredWithoutSource','const guarded = enforceOutputGuard']:
    if marker not in s: raise SystemExit('missing '+marker)
p.write_text(s,encoding='utf-8')
print('Ask output guard v0.6.1 patch PASS')
