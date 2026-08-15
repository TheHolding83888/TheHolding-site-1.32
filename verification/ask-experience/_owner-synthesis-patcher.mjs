import fs from 'node:fs';

const p = 'agents/console/app.js';
let s = fs.readFileSync(p, 'utf8');
const marker = 'async function ownerEvidenceSynthesis(raw, lang) {';

if (!s.includes(marker)) {
  const anchor = '  async function routeQuestion(raw) {';
  if (!s.includes(anchor)) throw new Error('routeQuestion anchor missing');

  const helper = `
  async function ownerEvidenceSynthesis(raw, lang) {
    const q = norm(raw);
    const ru = lang === 'ru';
    const unknown = (text, source = 'Console capability map') => ({ text, source, confidenceHint: 'unknown' });
    const partial = (text, source) => ({ text, source, confidenceHint: 'partial' });

    if (includesAny(q, ['furthest from the purpose', 'purpose it was created for', 'от цели создания', 'дальше всего от цели', 'зачем ее создавали'])) return unknown(
      ru
        ? 'Я пока не могу честно ранжировать компании по отклонению от цели создания: в текущем Ask нет канонического machine-readable поля purpose / success criterion для каждой компании. Я не буду подменять цель текущим APR, TVL или Performance.'
        : 'I cannot honestly rank companies by drift from their founding purpose yet: the current Ask has no canonical machine-readable purpose / success criterion for every company. I will not substitute current APR, TVL or Performance for purpose.',
      'Live Registry + Console capability map'
    );

    if (includesAny(q, ['changed most materially', 'what changed most', 'surprise me most', 'not looked', 'не смотрел месяц', 'что изменилось сильнее', 'что удивит больше'])) return unknown(
      ru
        ? 'Я вижу текущий verified state, но в этом интерфейсе пока нет нормализованного month-over-month change packet по всем компаниям. Поэтому я не буду объявлять самое важное изменение по памяти или по одной свежей цифре.'
        : 'I can see current verified state, but this surface does not yet load a normalized month-over-month change packet across all companies. I will not name the most material change from memory or from one fresh metric.',
      'Console capability map'
    );

    if (includesAny(q, ['productive capacity and realised cash flow', 'productivity and realised cash flow', 'productive capacity vs cash flow', 'продуктивност и реализован', 'продуктивност и cash flow'])) return unknown(
      ru
        ? 'Такой рейтинг сейчас нельзя построить корректно: Ask загружает current Productivity, но не загружает единый company-level Realised Cash Flow ledger. Reference APR/APY – это productive capacity, а не полученный cash flow; подменять одно другим нельзя.'
        : 'That ranking cannot be built correctly yet: Ask loads current Productivity but does not load a unified company-level Realised Cash Flow ledger. Reference APR/APY is productive capacity, not received cash flow, so I will not substitute one for the other.',
      'Live Productivity + Console capability map'
    );

    if (includesAny(q, ['concentration risk', 'concentration most visible', 'риск концентрации', 'концентрация риска'])) return unknown(
      ru
        ? 'В текущем Ask нет нормализованного cross-company exposure matrix по активам, протоколам и сетям. Поэтому я не могу честно назвать компанию с максимальной concentration risk. APR или одна позиция не являются заменой exposure concentration.'
        : 'The current Ask has no normalized cross-company exposure matrix across assets, protocols and chains, so I cannot honestly name the highest concentration risk. APR or one visible position is not a substitute for exposure concentration.',
      'Console capability map'
    );

    if (includesAny(q, ['becoming more mature', 'more mature as an economic object', 'maturity', 'reputation synthesis', 'становится зрелее', 'зрелост', 'репутац'])) return unknown(
      ru
        ? 'The Holding уже определяет зрелость как историю, provenance, productive evidence, cash-flow quality и время, но текущий Ask ещё не имеет канонического company-level Maturity / Reputation score. Поэтому точный рейтинг зрелости был бы выдумкой.'
        : 'The Holding already defines maturity through history, provenance, productive evidence, cash-flow quality and time, but Ask does not yet have a canonical company-level Maturity / Reputation score. A precise maturity ranking would therefore be invented.',
      'Live Registry + Console capability map'
    );

    if (includesAny(q, ['architecture is working as intended', 'architecture working', 'архитектура работает как задумано', 'архитектура работает'])) {
      const rows = Object.entries(safeObject(state.productivity?.companies))
        .map(([name, x]) => ({ name, apr: finite(x?.aprLatest), coverage: finite(x?.coverage), engines: safeArray(x?.breakdown).length }))
        .filter(x => x.apr !== null && x.coverage !== null)
        .sort((a, b) => (b.coverage - a.coverage) || (b.engines - a.engines) || (b.apr - a.apr));
      if (!rows.length) return unknown(ru ? 'Productivity state недостаточен для bounded architecture check.' : 'Productivity state is insufficient for a bounded architecture check.', 'Productivity unavailable');
      const best = rows[0];
      return partial(
        ru
          ? best.name + ' сейчас имеет один из самых сильных измеримых сигналов операционной полноты: ' + best.coverage.toFixed(1) + '% Productivity coverage, ' + best.engines + ' productive engine(s), Reference APR ' + best.apr.toFixed(2) + '%. Но это только proxy того, что productive architecture измерима и работает; без канонического success criterion я не называю это доказательством выполнения исходной цели.'
          : best.name + ' currently has one of the strongest measurable signals of operational completeness: ' + best.coverage.toFixed(1) + '% Productivity coverage, ' + best.engines + ' productive engine(s), and ' + best.apr.toFixed(2) + '% Reference APR. This is only a proxy that the productive architecture is measurable and operating; without a canonical success criterion I will not call it proof that the original purpose has been fulfilled.',
        'Live Productivity'
      );
    }

    if (includesAny(q, ['deserves the owner attention first', 'owner attention first', 'investigate first', 'attention first', 'внимание владельца', 'исследовать первым'])) {
      const cases = safeArray(state.learning?.activeCases);
      const decisionWorthy = cases.filter(x => x?.experienceEligibility === 'decision-worthy');
      const high = decisionWorthy.filter(x => String(x?.riskTier || '').toLowerCase() === 'high');
      if (decisionWorthy.length) {
        const domains = [...new Set(decisionWorthy.map(x => x?.domain).filter(Boolean))].join(', ');
        return partial(
          ru
            ? 'Первым заслуживает review не инвестиционная аллокация, а ' + decisionWorthy.length + ' decision-worthy OS case(s)' + (high.length ? ', из них ' + high.length + ' high-risk' : '') + '. Домены: ' + (domains || 'не классифицированы') + '. Это приоритет внимания по verified Learning queue, а не рекомендация двигать капитал.'
            : 'The first review target is not an investment allocation: it is the ' + decisionWorthy.length + ' decision-worthy OS case(s)' + (high.length ? ', including ' + high.length + ' high-risk' : '') + '. Domains: ' + (domains || 'unclassified') + '. This is an attention priority from the verified Learning queue, not a recommendation to move capital.',
          'Live Decision & Outcome Learning'
        );
      }
      return unknown(ru ? 'Learning queue сейчас не даёт проверенного decision-worthy приоритета.' : 'The Learning queue currently provides no verified decision-worthy priority.', 'Live Decision & Outcome Learning');
    }

    if (includesAny(q, ['can the os still not learn', 'cannot learn yet', 'later evidence does not exist', 'еще не может научиться', 'не может выучить пока', 'позднего доказательства нет'])) {
      const summary = safeObject(state.learning?.summary);
      const settled = finite(summary.settledOutcomeCount) ?? 0;
      const lessons = finite(summary.lessonCount) ?? 0;
      const decisions = finite(summary.decisionCount) ?? 0;
      return {
        text: ru
          ? 'Главный предел сейчас – outcome learning. В памяти есть ' + decisions + ' owner decision(s), но settled outcomes = ' + settled + ', deterministic lessons = ' + lessons + '. Поэтому OS пока не может доказательно учиться тому, какие решения оказались хорошими или плохими в последующем результате – нужное позднее evidence ещё не накопилось.'
          : 'The main limit today is outcome learning. Memory contains ' + decisions + ' owner decision(s), but settled outcomes = ' + settled + ' and deterministic lessons = ' + lessons + '. The OS therefore cannot yet learn, from later evidence, which decisions proved good or bad in outcome terms because that downstream evidence has not accumulated yet.',
        source: 'Live Decision & Outcome Learning',
        confidenceHint: 'measured'
      };
    }

    if (includesAny(q, ['company companion existed today', 'companion readiness', 'understand best', 'understand worst', 'куратор понимал лучше', 'companion понимал'])) return unknown(
      ru
        ? 'Я пока не могу честно назвать best/worst для Company Companion: текущий Ask не имеет company-scoped completeness matrix, объединяющей Company Book, history, Productivity, Rewards, Embedded Yield, Realised Cash Flow, decisions и data gaps. Наличие одного APR не равно полноте понимания компании.'
        : 'I cannot honestly name the best/worst Company Companion target yet: Ask has no company-scoped completeness matrix combining Company Book, history, Productivity, Rewards, Embedded Yield, Realised Cash Flow, decisions and data gaps. Having one APR is not the same as understanding a company.',
      'Console capability map'
    );

    if (includesAny(q, ['unresolved data gap', 'data gap', 'limits owner understanding', 'пробел в данных', 'нехватк данных'])) {
      const rows = Object.entries(safeObject(state.productivity?.companies))
        .map(([name, x]) => ({ name, coverage: finite(x?.coverage) }))
        .filter(x => x.coverage !== null)
        .sort((a, b) => a.coverage - b.coverage);
      const worst = rows[0];
      if (worst && worst.coverage < 99.999) return partial(
        ru
          ? 'В Productivity самый явный измеримый data gap сейчас у ' + worst.name + ': coverage ' + worst.coverage.toFixed(1) + '%. Это конкретный verified пробел, но я не называю его крупнейшим во всей OS без единой cross-layer data-quality queue.'
          : 'Within Productivity, the clearest measurable data gap is ' + worst.name + ' at ' + worst.coverage.toFixed(1) + '% coverage. That is a verified gap, but I will not call it the largest gap across the whole OS without a unified cross-layer data-quality queue.',
        'Live Productivity'
      );
      return partial(
        ru
          ? 'Productivity не показывает явного coverage gap среди измеримых компаний. Следующий ограничитель owner understanding нельзя честно выбрать из одного слоя: Ask пока не имеет единой cross-layer data-quality queue для Productivity + Rewards + Embedded + Cash Flow + history.'
          : 'Productivity does not expose an obvious coverage gap among measured companies. The next owner-understanding bottleneck cannot be chosen honestly from one layer: Ask does not yet have a unified cross-layer data-quality queue spanning Productivity, Rewards, Embedded Yield, Cash Flow and history.',
        'Live Productivity + Console capability map'
      );
    }

    return null;
  }

`;
  s = s.replace(anchor, helper + anchor);
}

const callAnchor = '    if (!q) return helpAnswer(lang);';
const callLine = '    const ownerSynthesis = await ownerEvidenceSynthesis(raw, lang);\n    if (ownerSynthesis) return ownerSynthesis;';
if (!s.includes(callLine)) {
  if (!s.includes(callAnchor)) throw new Error('routeQuestion empty-query anchor missing');
  s = s.replace(callAnchor, callAnchor + '\n\n' + callLine);
}

fs.writeFileSync(p, s, 'utf8');
console.log('Owner evidence synthesis patch applied.');
