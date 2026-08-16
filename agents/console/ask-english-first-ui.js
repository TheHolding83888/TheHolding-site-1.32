(() => {
  'use strict';

  if (typeof document === 'undefined') return;

  const form = document.getElementById('askForm');
  const input = document.getElementById('question');
  const quick = document.getElementById('quick');
  const messages = document.getElementById('messages');
  if (!form || !input || !quick || !messages) return;

  const WELCOME = 'Hi 🙂 I read the live state of The Holding OS, connect Change Intelligence, Security, Learning and Governance, show measured concentration, and compare the breadth of verified company-level evidence. Ask what the OS knows about the companies, where the system is concentrated, or request an owner brief.';
  const FAIL_CLOSED = 'The canonical live data could not be loaded right now. I will not replace it with guesses. Please refresh the page and try again shortly.';

  const prompts = [
    'Give me an owner brief',
    'What does the OS know about the companies?',
    'Where is the system most concentrated?',
    'What changed recently?',
    'What is the system proposing now?',
    'What can the OS not learn yet?'
  ];

  function replaceVisibleRussianSystemCopy(root = messages) {
    for (const node of root.querySelectorAll?.('.msg.system') || []) {
      const spans = node.querySelectorAll('span');
      const body = spans[1];
      if (!body) continue;
      const text = String(body.textContent || '');
      if (text.startsWith('Привет 🙂 Я читаю живое состояние The Holding OS')) body.textContent = WELCOME;
      if (text.startsWith('Сейчас не удалось загрузить канонические live данные')) body.textContent = FAIL_CLOSED;
    }
  }

  function rebuildQuickPrompts() {
    const current = [...quick.querySelectorAll('button')];
    if (!current.length) return false;
    quick.replaceChildren();
    for (const text of prompts) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = text;
      button.addEventListener('click', () => {
        input.value = text;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        if (typeof form.requestSubmit === 'function') form.requestSubmit();
        else form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      });
      quick.appendChild(button);
    }
    return true;
  }

  input.placeholder = 'Ask: what does the OS know about the companies? Where is concentration highest? Give me an owner brief…';

  let quickDone = rebuildQuickPrompts();
  replaceVisibleRussianSystemCopy();

  const observer = new MutationObserver(() => {
    if (!quickDone) quickDone = rebuildQuickPrompts();
    replaceVisibleRussianSystemCopy();
  });
  observer.observe(document.getElementById('console') || document.body, { childList: true, subtree: true });
})();
