import fs from 'node:fs';

const APP = 'agents/console/app.js';
const CORE = 'verification/ask-experience/corpus-core-v0.1.json';

function once(source, before, after, label) {
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: expected exactly one anchor, found ${count}`);
  return source.replace(before, after);
}

let app = fs.readFileSync(APP, 'utf8');
app = once(
  app,
  "  const includesAny = (q, list) => list.some(x => q.includes(norm(x)));\n",
  "  const includesAny = (q, list) => list.some(x => q.includes(norm(x)));\n  const isConcentrationIntent = q => {\n    const n = norm(q);\n    return includesAny(n, [\n      'concentration risk', 'concentration most visible', 'most concentrated', 'largest concentration',\n      'protocol concentration', 'cross company concentration', 'cross-company concentration',\n      'biggest protocol exposure', 'where are we most concentrated',\n      'где система наиболее сконцентрирована', 'где мы наиболее сконцентрированы',\n      'где у нас самая большая концентрация', 'концентрация по протоколам',\n      'что у нас с концентрацией', 'риск концентрации', 'концентрация риска'\n    ]) || ((n.includes('сконцентрир') || n.includes('концентрац')) && includesAny(n, ['где', 'самая', 'наиболее', 'больше', 'риск']));\n  };\n",
  'concentration intent helper'
);
app = once(
  app,
  "    if (includesAny(q, ['concentration risk', 'concentration most visible', 'риск концентрации', 'концентрация риска'])) return productiveConcentrationAnswer(lang);",
  "    if (isConcentrationIntent(q)) return productiveConcentrationAnswer(lang);",
  'owner concentration route'
);
app = once(
  app,
  "    if (includesAny(q, ['где система наиболее сконцентрирована', 'где у нас самая большая концентрация', 'концентрация по протоколам', 'что у нас с концентрацией', 'concentration risk', 'most concentrated', 'largest concentration', 'protocol concentration', 'cross company concentration', 'cross-company concentration', 'biggest protocol exposure', 'where are we most concentrated'])) return productiveConcentrationAnswer(lang);",
  "    if (isConcentrationIntent(q)) return productiveConcentrationAnswer(lang);",
  'main concentration route'
);
fs.writeFileSync(APP, app);

const core = JSON.parse(fs.readFileSync(CORE, 'utf8'));
const additions = [
  {
    id: 'quick-owner-brief-ru',
    prompt: 'Дай owner brief',
    expectedIntent: 'owner-brief',
    expectedConfidence: 'partial',
    requiredSourceArtifact: '/security/security-intelligence.json',
    requiredAdditionalSourceArtifact: '/intelligence/change-intelligence.json',
    requiredAnswerPattern: 'PRIORITY 1|Security|Learning',
    forbiddenSubstitution: ['generic fallback']
  },
  {
    id: 'quick-concentration-ru',
    prompt: 'Где мы наиболее сконцентрированы?',
    expectedIntent: 'cross-company-concentration',
    expectedConfidence: 'partial',
    requiredSourceArtifact: '/companies/productivity-data.json',
    requiredAdditionalSourceArtifact: '/companies/stable-capital-data.json',
    requiredAnswerPattern: 'MEASURED PRODUCTIVE-CAPITAL CONCENTRATION|измеренного ordinary productive capital',
    forbiddenSubstitution: ['generic fallback']
  },
  {
    id: 'quick-changes-ru',
    prompt: 'Что изменилось сейчас?',
    expectedIntent: 'change-salience',
    expectedConfidence: 'partial',
    requiredSourceArtifact: '/intelligence/change-intelligence.json',
    requiredAnswerPattern: 'verified Change Intelligence|material change|материальн',
    forbiddenSubstitution: ['generic fallback']
  },
  {
    id: 'quick-proposal-ru',
    prompt: 'Что система сейчас предлагает?',
    expectedIntent: 'proposal-status',
    expectedConfidence: 'measured',
    requiredSourceArtifact: '/intelligence/proposals/proposal-queue.json',
    requiredAnswerPattern: 'Proposal|предлож',
    forbiddenSubstitution: ['generic fallback']
  },
  {
    id: 'quick-learning-gap-ru',
    prompt: 'Чему OS ещё не может научиться?',
    expectedIntent: 'learning-boundary',
    expectedConfidence: 'measured',
    requiredSourceArtifact: '/intelligence/learning-state/learning-context.json',
    requiredAnswerPattern: 'outcome learning|settled outcomes|предел',
    forbiddenSubstitution: ['generic fallback']
  }
];
const byId = new Map((core.cases || []).map(x => [x.id, x]));
for (const item of additions) if (!byId.has(item.id)) core.cases.push(item);
fs.writeFileSync(CORE, JSON.stringify(core, null, 2) + '\n');

console.log('Ask v1.0.1 quick-command contract patch applied');
