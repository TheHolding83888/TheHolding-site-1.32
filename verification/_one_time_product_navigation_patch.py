from pathlib import Path
p=Path('agents/console/app.js')
s=p.read_text(encoding='utf-8')
anchor="""    return {
      text: lang === 'ru'
        ? 'Пока не могу ответить на это достаточно точно без свободной AI-модели. Я умею искать живые данные The Holding и публичные знания, но если подтверждённого ответа нет – лучше скажу «не знаю».\\
\\
Попробуй спросить про компанию, фонд, протокол, доходность, rewards, слои капитала, Brain, Learning или текущее состояние.'
        : 'I cannot answer that precisely enough yet without a free-form AI model. I can search live Holding data and public project knowledge, but if the evidence is not there, I would rather say “I don’t know”.\\
\\
Try a company, fund, protocol, productivity, rewards, capital layers, Brain, Learning or current state.',
      source: 'No sufficiently strong verified match'
    };"""
if s.count(anchor)!=1: raise SystemExit(f'fallback anchor expected 1 got {s.count(anchor)}')
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

"""+anchor
s=s.replace(anchor,block,1)
if "state.lastTopic = 'product-navigation'" not in s: raise SystemExit('navigation patch missing')
p.write_text(s,encoding='utf-8')
print('human product navigation patch PASS')
