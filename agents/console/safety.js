(() => {
  'use strict';

  const form = document.getElementById('askForm');
  const input = document.getElementById('question');
  const button = document.getElementById('askButton');
  const messages = document.getElementById('messages');
  const optIn = document.getElementById('learningOptIn');
  const learningState = document.getElementById('learningState');

  if (!form || !input || !messages || !optIn) return;

  const MAX_QUESTION = 700;
  const contexts = new Map();
  const pending = [];
  let seq = 0;
  let intakeEnabled = false;

  const norm = value => String(value || '').toLowerCase().replace(/ё/g, 'е');

  const patterns = {
    directFinancialAdvice: [
      /что\s+(?:мне\s+)?(?:купить|продать|покупать|продавать|инвестировать)/i,
      /куда\s+(?:мне\s+)?(?:вложить|инвестировать)/i,
      /стоит\s+ли\s+(?:мне\s+)?(?:купить|покупать|продать|продавать|вложить|инвестировать)/i,
      /сколько\s+(?:мне\s+)?(?:вложить|инвестировать|купить)/i,
      /составь\s+(?:мне\s+)?(?:портфель|аллокац)/i,
      /(?:what|which)\s+should\s+i\s+(?:buy|sell|invest)/i,
      /where\s+should\s+i\s+invest/i,
      /how\s+much\s+should\s+i\s+invest/i,
      /(?:build|make)\s+me\s+(?:a\s+)?portfolio/i,
      /recommend\s+(?:me\s+)?(?:a\s+)?(?:coin|token|protocol|investment)/i,
      /best\s+(?:coin|token|protocol|investment)\s+for\s+me/i
    ],
    personalLegalTax: [
      /что\s+(?:мне\s+)?делать\s+с\s+налог/i,
      /как\s+(?:мне\s+)?(?:не\s+платить|избежать)\s+налог/i,
      /дай\s+(?:мне\s+)?юридическ/i,
      /legal\s+advice\s+for\s+me/i,
      /how\s+can\s+i\s+avoid\s+tax/i,
      /what\s+should\s+i\s+do\s+about\s+(?:my\s+)?tax/i
    ],
    promptInjection: [
      /ignore\s+(?:all\s+)?(?:previous|prior|system|developer)\s+instructions/i,
      /reveal\s+(?:the\s+)?(?:system|developer)\s+prompt/i,
      /show\s+(?:me\s+)?(?:your\s+)?(?:system|developer)\s+(?:prompt|message)/i,
      /jailbreak/i,
      /bypass\s+(?:the\s+)?(?:guard|policy|safety|instructions)/i,
      /act\s+as\s+root/i,
      /execute\s+(?:this\s+)?(?:shell|command|code)/i,
      /run\s+(?:this\s+)?(?:shell|terminal|bash|powershell)/i,
      /exfiltrat/i
    ],
    phishing: [
      /(?:connect|подключи)\s+(?:your|мой|кошелек|wallet).*(?:sign|подпиш)/i,
      /(?:claim|получи).*(?:airdrop|эйрдроп).*(?:sign|подпиш|connect|wallet)/i,
      /(?:send|отправ).*(?:seed|private key|сид фраз|приватн)/i
    ]
  };

  const secretPatterns = [
    /\b0x[a-f0-9]{64}\b/i,
    /\b(?:api[_ -]?key|secret|password|passphrase|private[_ -]?key|seed[_ -]?phrase|mnemonic)\s*[:=]\s*\S{8,}/i,
    /\b(?:bearer\s+)[a-z0-9._~+\/=-]{16,}\b/i,
    /\beyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\b/,
    /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i,
    /\b(?:seed phrase|mnemonic|сид[- ]?фраза)\s*[:=]\s*(?:[a-zа-яё]{2,}\s+){5,}[a-zа-яё]{2,}/i
  ];

  function matchAny(text, list) {
    return list.some(rx => rx.test(text));
  }

  function classify(text) {
    const q = String(text || '').trim();
    if (!q) return { blocked: false, category: 'empty', reason: null };
    if (q.length > MAX_QUESTION) {
      return { blocked: true, category: 'oversize', reason: 'message-too-long' };
    }
    if (secretPatterns.some(rx => rx.test(q))) {
      return { blocked: true, category: 'secret-risk', reason: 'possible-secret' };
    }
    if (matchAny(q, patterns.phishing)) {
      return { blocked: true, category: 'phishing-risk', reason: 'phishing-or-wallet-control' };
    }
    if (matchAny(q, patterns.promptInjection)) {
      return { blocked: true, category: 'prompt-injection', reason: 'untrusted-control-instruction' };
    }
    if (matchAny(q, patterns.directFinancialAdvice)) {
      return { blocked: true, category: 'financial-advice', reason: 'personalized-financial-action' };
    }
    if (matchAny(q, patterns.personalLegalTax)) {
      return { blocked: true, category: 'legal-tax-advice', reason: 'personalized-legal-tax-action' };
    }
    return {
      blocked: false,
      category: /https?:\/\/|www\./i.test(q) ? 'external-link-present' : 'allowed',
      reason: null
    };
  }

  function langOf(text) {
    return /[а-яё]/i.test(text) ? 'ru' : 'en';
  }

  function addLocalMessage(kind, text, source = '') {
    const box = document.createElement('div');
    box.className = `msg ${kind}`;
    const meta = document.createElement('span');
    meta.className = 'meta';
    meta.textContent = kind === 'user' ? 'You' : 'The Holding';
    const body = document.createElement('span');
    body.textContent = text;
    box.append(meta, body);
    if (source) {
      const src = document.createElement('span');
      src.className = 'source';
      src.textContent = source;
      box.appendChild(src);
    }
    messages.appendChild(box);
    messages.scrollTop = messages.scrollHeight;
    return box;
  }

  function safeRefusal(category, lang) {
    const ru = {
      'secret-risk': 'Похоже, сообщение может содержать секрет: seed phrase, private key, пароль или токен. Я не буду отправлять или сохранять такие данные для обучения. Никому их не отправляй.',
      'phishing-risk': 'Я не выполняю просьбы, связанные с передачей seed/private key, подписью неизвестных транзакций или сомнительными claim-ссылками. Могу объяснить риск простыми словами.',
      'prompt-injection': 'Я не принимаю сообщения посетителей как команды для системных правил, инструментов, GitHub или капитала. Можно задавать обычные вопросы о The Holding.',
      'financial-advice': 'Я могу показать проверяемые данные, доходность, механику и риски, но не буду говорить, что тебе покупать, продавать, куда вкладывать или сколько инвестировать.',
      'legal-tax-advice': 'Я могу объяснить общие правила и показать официальные источники, но не даю персональных юридических или налоговых рекомендаций.',
      'oversize': `Сообщение слишком длинное. Пожалуйста, сократи его примерно до ${MAX_QUESTION} символов.`
    };
    const en = {
      'secret-risk': 'This message may contain a secret such as a seed phrase, private key, password or token. I will not send or store it for learning. Never send such secrets to anyone.',
      'phishing-risk': 'I will not help transfer seed/private keys, sign unknown transactions or follow suspicious claim links. I can explain the risk instead.',
      'prompt-injection': 'Visitor text is never treated as authority over system rules, tools, GitHub or capital. You can still ask normal questions about The Holding.',
      'financial-advice': 'I can show verifiable data, productivity, mechanisms and risks, but I will not tell you what to buy or sell, where to invest, or how much to allocate.',
      'legal-tax-advice': 'I can explain general rules and point to official sources, but I do not provide personalized legal or tax advice.',
      'oversize': `This message is too long. Please shorten it to about ${MAX_QUESTION} characters.`
    };
    return (lang === 'ru' ? ru : en)[category] || (lang === 'ru'
      ? 'Я не могу безопасно обработать этот запрос в текущем режиме.'
      : 'I cannot safely process this request in the current mode.');
  }

  function sourceFromNode(node) {
    return node.querySelector('.source')?.textContent?.trim() || '';
  }

  function bodyFromNode(node) {
    const spans = node.querySelectorAll('span');
    return spans[1]?.textContent?.trim() || '';
  }

  async function postJson(url, body) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4500);
    try {
      const response = await fetch(url, {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal
      });
      if (!response.ok) return null;
      return await response.json();
    } catch (_) {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  async function record(context, answer, source, outcome) {
    if (!intakeEnabled || !optIn.checked || context?.classification?.blocked) return null;
    const payload = {
      schema: '0.1-safe-conversation-learning',
      consent: true,
      question: context.question,
      language: context.language,
      clientCategory: context.classification.category,
      answer: String(answer || '').slice(0, 2400),
      source: String(source || '').slice(0, 400),
      outcome: String(outcome || 'answered')
    };
    return postJson('/api/learning-intake', payload);
  }

  function addFeedback(node, eventId) {
    if (!eventId || node.querySelector('.learning-feedback')) return;
    const row = document.createElement('span');
    row.className = 'learning-feedback';
    const label = document.createElement('span');
    label.textContent = 'Helpful?';
    const yes = document.createElement('button');
    const no = document.createElement('button');
    yes.type = no.type = 'button';
    yes.textContent = 'Yes';
    no.textContent = 'No';
    const vote = async signal => {
      yes.disabled = no.disabled = true;
      const result = await postJson('/api/learning-feedback', { eventId, signal });
      label.textContent = result?.accepted ? 'Thanks — used as a learning signal.' : 'Feedback unavailable.';
    };
    yes.addEventListener('click', () => vote('helpful'));
    no.addEventListener('click', () => vote('not-helpful'));
    row.append(label, yes, no);
    node.appendChild(row);
  }

  async function finalizeNode(node, context) {
    if (!context || context.done || node.classList.contains('pending')) return;
    context.done = true;
    const answer = bodyFromNode(node);
    const source = sourceFromNode(node);
    const lower = norm(answer);
    const outcome = lower.includes('не могу ответить') || lower.includes('cannot answer')
      ? 'unknown'
      : lower.includes('не удалось') || lower.includes('could not safely')
        ? 'error'
        : 'answered';
    const result = await record(context, answer, source, outcome);
    if (result?.eventId) addFeedback(node, result.eventId);
    contexts.delete(context.id);
  }

  function bindPendingNodes() {
    const unbound = [...messages.querySelectorAll('.msg.system.pending:not([data-learning-token])')];
    for (const node of unbound) {
      const context = pending.shift();
      if (!context) break;
      node.dataset.learningToken = context.id;
      context.node = node;
      contexts.set(context.id, context);
    }
    for (const node of messages.querySelectorAll('.msg.system[data-learning-token]:not(.pending)')) {
      const context = contexts.get(node.dataset.learningToken);
      if (context) finalizeNode(node, context);
    }
  }

  const observer = new MutationObserver(bindPendingNodes);
  observer.observe(messages, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });

  form.addEventListener('submit', event => {
    const q = input.value.trim();
    if (!q) return;
    const classification = classify(q);
    const language = langOf(q);

    if (classification.blocked) {
      event.preventDefault();
      event.stopImmediatePropagation();
      input.value = '';
      if (button) button.disabled = true;
      addLocalMessage('user', q);
      addLocalMessage('system', safeRefusal(classification.category, language), `Safety boundary · ${classification.category}`);
      return;
    }

    pending.push({
      id: `q-${Date.now()}-${++seq}`,
      question: q,
      language,
      classification,
      done: false
    });
  }, true);

  optIn.addEventListener('change', () => {
    try { localStorage.setItem('holding-learning-opt-in', optIn.checked ? '1' : '0'); } catch (_) {}
  });

  async function bootLearningStatus() {
    try {
      const response = await fetch(`/api/learning-status?v=${Date.now()}`, {
        cache: 'no-store',
        credentials: 'same-origin'
      });
      if (!response.ok) throw new Error(String(response.status));
      const status = await response.json();
      intakeEnabled = status?.intakeEnabled === true;
      optIn.disabled = !intakeEnabled;
      let remembered = false;
      try { remembered = localStorage.getItem('holding-learning-opt-in') === '1'; } catch (_) {}
      optIn.checked = intakeEnabled && remembered;
      if (learningState) {
        learningState.textContent = intakeEnabled
          ? 'Safe learning available · opt-in only'
          : 'Learning intake not enabled yet';
      }
    } catch (_) {
      intakeEnabled = false;
      optIn.disabled = true;
      optIn.checked = false;
      if (learningState) learningState.textContent = 'Learning intake not enabled yet';
    }
  }

  window.HoldingConversationSafety = Object.freeze({ classify });
  bootLearningStatus();
})();

// Read-only UI bootstrap. Kept outside the safety IIFE so telemetry surfaces
// remain independent from conversation intake and cannot affect its policy.
(() => {
  if (typeof document === 'undefined') return;
  const scripts = [
    {
      selector: 'script[data-th-intelligence-progress-loader]',
      src: '/agents/console/intelligence-progress.js?v=0.1',
      dataset: ['thIntelligenceProgressLoader', 'v0.1']
    },
    {
      selector: 'script[data-th-operating-event-intelligence-loader]',
      src: '/agents/console/event-intelligence.js?v=0.1',
      dataset: ['thOperatingEventIntelligenceLoader', 'v0.1']
    }
  ];
  for (const spec of scripts) {
    if (document.querySelector(spec.selector)) continue;
    const script = document.createElement('script');
    script.src = spec.src;
    script.async = false;
    script.defer = true;
    script.dataset[spec.dataset[0]] = spec.dataset[1];
    document.head.appendChild(script);
  }
})();
