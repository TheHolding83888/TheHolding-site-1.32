(() => {
  'use strict';

  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const VERSION = '0.2-runtime-evidence-cortex';
  const PACKET_URL = '/intelligence/runtime-evidence/runtime-reasoning-evidence.json';
  const CONTEXT_URL = '/intelligence/owner-context/owner-decision-context.json';
  const CONTRACT_VERSION = '0.2-runtime-capability-source-bound-answer-contract';

  const norm = value => String(value || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[’']/g, '')
    .replace(/[^a-zа-я0-9.$%+→-]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const arr = value => Array.isArray(value) ? value : [];
  const hasAny = (text, tokens) => tokens.some(token => text.includes(norm(token)));

  async function readJson(url) {
    const response = await fetch(`${url}?v=${Date.now()}`, { cache: 'no-store', credentials: 'same-origin' });
    if (!response.ok) throw new Error(`${url} HTTP ${response.status}`);
    return response.json();
  }

  function isLiveHealthFactorQuestion(raw) {
    const q = norm(raw);
    if (!q) return false;
    const hf = hasAny(q, ['health factor', ' hf ', 'hf у', 'hf монетра', 'фактор здоровья', 'ликвидац']);
    if (!hf) return false;
    return hasAny(q, [
      'сейчас', 'сегодня', 'текущий', 'текущая', 'current', 'now', 'today',
      'monetra', 'монетра', 'aave', 'долг', 'debt', 'collateral', 'залог',
      'позици', 'position', 'какой hf', 'what is hf', 'есть ли'
    ]);
  }

  function findHealthFactorModule(context) {
    for (const source of arr(context?.sources)) {
      const module = source?.modules?.healthFactorRegime;
      if (module) return module;
    }
    return null;
  }

  function formatRawBase(value) {
    if (value === null || value === undefined) return '—';
    const raw = Number(value);
    if (!Number.isFinite(raw)) return String(value);
    return (raw / 1e8).toLocaleString('en-US', { maximumFractionDigits: 2 });
  }

  function makeMessage(kind, text, source = '') {
    const messages = document.getElementById('messages');
    if (!messages) return null;
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

  function applyContract(box, packet, obs, lang, grounded) {
    if (!box) return;
    box.dataset.answerContractVersion = CONTRACT_VERSION;
    box.dataset.answerCortexVersion = VERSION;
    box.dataset.answerTopic = 'live-health-factor';
    box.dataset.answerGrounded = grounded ? 'true' : 'false';
    box.dataset.answerLanguage = lang;
    box.dataset.answerSourceArtifacts = grounded
      ? `${PACKET_URL}|${obs?.provenance?.source || ''}|${CONTEXT_URL}`
      : CONTEXT_URL;
    box.dataset.answerProvenanceClass = grounded
      ? 'runtime-evidence-plus-owner-context'
      : 'owner-context-live-evidence-unavailable';
    box.dataset.runtimePacketHash = packet?.integrity?.packetHash || '';
    box.dataset.runtimePacketVersion = packet?.version || '';
  }

  function packetCapabilityIsFresh(packet, capability) {
    if (!packet || !capability) return false;
    if (packet.version === '0.1-runtime-reasoning-evidence') {
      return packet?.freshness?.riskSourceFresh === true;
    }
    if (packet.version === '0.2-runtime-reasoning-evidence') {
      const age = Number(capability?.sourceAgeHours);
      const max = Number(capability?.maxSourceAgeHours);
      if (!Number.isFinite(age) || !Number.isFinite(max)) return false;
      if (age < 0 || age > max) return false;
      const catalog = arr(packet?.registry?.catalog).find(x => x?.capabilityId === capability.capabilityId);
      return catalog?.sourceExists === true && catalog?.schemaInspected === true && catalog?.fresh === true && catalog?.adapterReady === true;
    }
    return false;
  }

  async function answer(raw) {
    const lang = /[а-яё]/i.test(raw) ? 'ru' : 'en';
    const input = document.getElementById('question');
    const button = document.getElementById('askButton');
    if (input) input.value = '';
    if (button) button.disabled = true;
    makeMessage('user', raw);
    const pending = makeMessage('system', lang === 'ru' ? 'Проверяю live risk evidence…' : 'Checking live risk evidence…', 'Runtime Evidence · loading');
    pending?.classList.add('pending');

    let packet = null;
    let context = null;
    try {
      [packet, context] = await Promise.all([
        readJson(PACKET_URL).catch(() => null),
        readJson(CONTEXT_URL)
      ]);

      if (context?.version !== '0.1-owner-decision-context-runtime' || context?.authority?.executionAuthority !== 'none') {
        throw new Error('Owner context validation failed');
      }

      const hfModule = findHealthFactorModule(context) || {};
      const preferred = arr(hfModule?.generalPreferredOrientation?.approxMinRange);
      const ownerReference = preferred.length ? `${preferred.join('–')}+` : '~1.8–2+';

      const capability = arr(packet?.capabilities).find(x => x?.capabilityId === 'health-factor-monitoring');
      const observations = arr(capability?.observations);
      const q = norm(raw);
      const requestedMonetra = hasAny(q, ['monetra', 'монетра', 'company 008', '#008', '008']);
      const obs = requestedMonetra
        ? observations.find(x => x?.companyRegistry === '008' || norm(x?.companyName).includes('monetra'))
        : observations[0];

      const packetVersionAccepted = packet?.version === '0.1-runtime-reasoning-evidence' || packet?.version === '0.2-runtime-reasoning-evidence';
      const grounded = packetVersionAccepted
        && packet?.authority?.executionAuthority === 'none'
        && packetCapabilityIsFresh(packet, capability)
        && capability?.runtimeStatus === 'activated'
        && !!obs;

      let text;
      if (!grounded) {
        text = lang === 'ru'
          ? `Owner Q7 по-прежнему задаёт контекст: Health Factor — regime-aware safety margin, а не один жёсткий порог; общая owner-ориентация около ${ownerReference}. Но свежий runtime evidence packet сейчас недоступен или не прошёл capability freshness/activation boundary, поэтому текущий HF компании я не буду выдумывать.`
          : `Owner Q7 still provides the context: Health Factor is a regime-aware safety margin, not one hard threshold; the general owner orientation is around ${ownerReference}. But the current runtime evidence packet is unavailable or did not pass capability freshness/activation boundaries, so I will not invent a live company HF.`;
      } else if (obs.debtPresent === false) {
        text = lang === 'ru'
          ? `${obs.companyName || `Company #${obs.companyRegistry}`} · ${obs.protocol} ${obs.chain}: live onchain state показывает collateral ≈ $${formatRawBase(obs.totalCollateralBaseRaw)}, debt = $0. Поэтому Health Factor сейчас экономически неприменим и канонически хранится как null / no-debt — не как искусственно огромное число.\n\nOwner Q7 используется только как interpretation context: ориентир около ${ownerReference} относится к ситуациям, где долг реально есть. Сейчас hard threshold/action не возникает. Непокрытые измерения остаются явными: ${arr(capability.unresolvedDimensions).slice(0, 6).join(', ')}.`
          : `${obs.companyName || `Company #${obs.companyRegistry}`} · ${obs.protocol} ${obs.chain}: live onchain state shows collateral ≈ $${formatRawBase(obs.totalCollateralBaseRaw)}, debt = $0. Health Factor is therefore economically not applicable and is canonically stored as null / no-debt — not as an artificial huge number.\n\nOwner Q7 is interpretation context only: the roughly ${ownerReference} orientation applies when debt actually exists. No hard threshold/action is created here. Explicit unresolved dimensions remain: ${arr(capability.unresolvedDimensions).slice(0, 6).join(', ')}.`;
      } else {
        const hf = Number(obs.healthFactor);
        const hfText = Number.isFinite(hf) ? hf.toFixed(3) : 'unknown';
        text = lang === 'ru'
          ? `${obs.companyName || `Company #${obs.companyRegistry}`} · ${obs.protocol} ${obs.chain}: текущий live Health Factor = ${hfText}; collateral ≈ $${formatRawBase(obs.totalCollateralBaseRaw)}, debt ≈ $${formatRawBase(obs.totalDebtBaseRaw)}. Это измеренный onchain account state на block ${obs.blockNumber ?? '—'}.\n\nOwner Q7 даёт контекст около ${ownerReference}, но система не превращает его в автоматический borrow/repay/deleverage threshold. Market regime, collateral volatility, debt-asset semantics и buffers должны быть известны отдельно до более сильного вывода.`
          : `${obs.companyName || `Company #${obs.companyRegistry}`} · ${obs.protocol} ${obs.chain}: current live Health Factor = ${hfText}; collateral ≈ $${formatRawBase(obs.totalCollateralBaseRaw)}, debt ≈ $${formatRawBase(obs.totalDebtBaseRaw)}. This is measured onchain account state at block ${obs.blockNumber ?? '—'}.\n\nOwner Q7 provides context around ${ownerReference}, but the system does not convert it into an automatic borrow/repay/deleverage threshold. Market regime, collateral volatility, debt-asset semantics and buffers remain separate required inputs for a stronger conclusion.`;
      }

      pending?.classList.remove('pending');
      const spans = pending?.querySelectorAll('span');
      if (spans?.[1]) spans[1].textContent = text;
      const src = pending?.querySelector('.source');
      if (src) src.textContent = grounded ? 'Runtime Evidence · live onchain + Owner Q7' : 'Runtime Evidence · degraded locally';
      applyContract(pending, packet, obs, lang, grounded);
    } catch (error) {
      pending?.classList.remove('pending');
      const spans = pending?.querySelectorAll('span');
      if (spans?.[1]) spans[1].textContent = lang === 'ru'
        ? 'Live HF evidence сейчас не прошёл validation. Я не буду подменять текущий onchain state догадкой.'
        : 'Live HF evidence did not pass validation. I will not replace current onchain state with a guess.';
      const src = pending?.querySelector('.source');
      if (src) src.textContent = 'Runtime Evidence · fail-closed';
      applyContract(pending, packet, null, lang, false);
      console.warn('[The Holding Runtime Evidence Cortex]', error);
    } finally {
      if (input) input.focus();
    }
  }

  function boot() {
    const form = document.getElementById('askForm');
    const input = document.getElementById('question');
    if (!form || !input) return;

    form.addEventListener('submit', event => {
      const raw = input.value.trim();
      if (!raw || !isLiveHealthFactorQuestion(raw)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      void answer(raw);
    }, true);

    window.HoldingRuntimeEvidenceCortex = Object.freeze({
      version: VERSION,
      classify: isLiveHealthFactorQuestion,
      authority: Object.freeze({ executable: false, executionAuthority: 'none' })
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
