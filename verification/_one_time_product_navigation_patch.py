from pathlib import Path
p=Path('agents/console/app.js')
s=p.read_text(encoding='utf-8')

end_marker='\n  function buildQuick()'
end=s.find(end_marker)
if end<0: raise SystemExit('buildQuick boundary missing')
start=s.rfind('    return {',0,end)
if start<0: raise SystemExit('final fallback return missing')
window=s[start:end]
if "No sufficiently strong verified match" not in window:
    raise SystemExit('final return is not fail-closed fallback')
if "state.lastTopic = 'product-navigation'" in s:
    raise SystemExit('product navigation already exists')

block="""    const navigationIntent = includesAny(q, [
      'where should i start', 'where should a new person begin', 'where do i begin', 'where do i start',
      'i just found this site', 'new here', 'look first', 'bigger vision', 'read the vision',
      'с чего начать', 'с чего мне начать', 'я впервые тут', 'я первый раз тут', 'куда смотреть сначала',
      'где почитать видение', 'где почитать манифест'
    ]);
    if (navigationIntent) {
      state.lastTopic = 'product-navigation';
      return {
        text: lang === 'ru'
          ? 'Если ты здесь впервые, начни с Manifesto – там вся идея и дорожная карта. Затем открой Companies / Registry, чтобы увидеть реальные onchain-компании и их историю. После этого возвращайся в Ask The Holding и спрашивай про любую компанию, доходность, rewards, устройство OS или сравнение. Я помогу идти глубже по мере вопросов.'
          : 'If you are new here, start with the Manifesto for the full idea and roadmap. Then open Companies / Registry to see real onchain companies and their operating history. After that, come back to Ask The Holding and ask about any company, productivity, rewards, the OS, or comparisons. I can guide you deeper as questions emerge.',
        source: 'Public site knowledge: /manifesto /companies/ /agents/'
      };
    }

"""
s=s[:start]+block+s[start:]
if "state.lastTopic = 'product-navigation'" not in s: raise SystemExit('navigation patch missing')
p.write_text(s,encoding='utf-8')
print('human product navigation patch PASS')
