from pathlib import Path
p=Path('agents/console/app.js')
s=p.read_text(encoding='utf-8')

old="""    const text = String(result.text || '');
    const lower = text.toLowerCase();
    const artifacts = safeArray(contract.sourceArtifacts);

    const positiveExecutionClaim ="""
new="""    const text = String(result.text || '');
    const lower = text.toLowerCase();
    const rawText = String(raw || '');
    const artifacts = safeArray(contract.sourceArtifacts);

    // Final-stage high-recall risk context. Input routing remains the first line, but these checks run
    // after the answer is built so paraphrase failure cannot silently fall through to a generic answer.
    const authorityRequest = /(?:sign|confirm|approve|execute).{0,30}(?:tx|transaction)|(?:tx|transaction).{0,30}(?:sign|confirm|approve|execute)|move.{0,20}(?:my|the).{0,12}capital|on my behalf.{0,30}(?:tx|transaction)/i.test(rawText)
      || /(?:подпис|подтверд|заапрув|исполн).{0,30}(?:транз|tx)|(?:транз|tx).{0,30}(?:подпис|подтверд|заапрув|исполн)|двиг.{0,20}капитал/i.test(rawText);
    const secretRequest = /private\s+key|seed\s+phrase|recovery\s+phrase|mnemonic|secret\s+key/i.test(rawText)
      || /приватн.{0,12}ключ|закрыт.{0,12}ключ|сид.{0,8}фраз|мнемонич|фраз.{0,10}восстанов/i.test(rawText);
    const personalizedAdviceRequest = /(?:what|which).{0,24}(?:should|recommend).{0,20}(?:i|me).{0,16}(?:buy|sell|allocate)|exact\s+allocation.{0,20}(?:i|my|me)|what\s+should\s+i\s+buy/i.test(rawText)
      || /(?:что|куда).{0,16}(?:мне|я).{0,16}(?:купить|продать|вложить|аллоцир)|точн.{0,12}аллокац.{0,20}(?:мне|мой)/i.test(rawText);

    const positiveExecutionClaim ="""
if s.count(old)!=1: raise SystemExit(f'guard header anchor expected 1 got {s.count(old)}')
s=s.replace(old,new,1)

s=s.replace('    if (privateKeyLeak || seedLeak) {','    if (secretRequest || privateKeyLeak || seedLeak) {',1)
s=s.replace('    if (positiveExecutionClaim && !explicitNoAuthority) {','    if ((authorityRequest || positiveExecutionClaim) && !explicitNoAuthority) {',1)
s=s.replace('    if (personalizedTrade) {','    if (personalizedAdviceRequest || personalizedTrade) {',1)

for marker in ['const authorityRequest =','const secretRequest =','const personalizedAdviceRequest =','authorityRequest || positiveExecutionClaim','secretRequest || privateKeyLeak','personalizedAdviceRequest || personalizedTrade']:
    if marker not in s: raise SystemExit('missing '+marker)
p.write_text(s,encoding='utf-8')
print('final-guard high-recall risk patch PASS')
