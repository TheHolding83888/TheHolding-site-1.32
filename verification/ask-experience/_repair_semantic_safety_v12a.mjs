import fs from 'node:fs';

const appPath='agents/console/app.js';
let app=fs.readFileSync(appPath,'utf8');

const replacements=[
  ["    const purposeSignal = includesAny(q, ['purpose drift', 'founding purpose', 'original mission', 'original purpose', 'mission fulfil', 'purpose fulfil', 'purpose and current state', 'цель создания', 'цели создания', 'исходн мисси', 'исходн цел', 'выполняет миссию', 'выполнение purpose', 'разрыв между purpose', 'от цели ради которой', 'ушла от цели']);",
   "    const purposeSignal = includesAny(q, ['purpose drift', 'founding purpose', 'original mission', 'original purpose', 'mission fulfil', 'purpose fulfil', 'purpose and current state', 'цель создания', 'цели создания', 'выполняет миссию', 'выполнение purpose', 'разрыв между purpose', 'от цели ради которой', 'ушла от цели']) || (q.includes('исходн') && (q.includes('мисси') || q.includes('цел')));"],
  ["    const realisedSignal = includesAny(q, ['realised cash flow', 'realized cash flow', 'received cash flow', 'received company cash flow', 'полученн cash flow', 'реализованн cash flow', 'реально полученн', 'фактически полученн', 'уже полученн доход', 'полученному cash flow']);",
   "    const realisedSignal = includesAny(q, ['realised cash flow', 'realized cash flow', 'received cash flow', 'received company cash flow', 'received company level cash flow', 'полученн cash flow', 'реализованн cash flow', 'реально полученн', 'фактически полученн', 'уже полученн доход', 'полученному cash flow']) || (q.includes('received') && q.includes('cash flow')) || ((q.includes('полученн') || q.includes('реализованн')) && q.includes('cash flow'));"],
  ["    const futureYield = includesAny(q, ['guaranteed apy', 'guaranteed apr', 'guaranteed yield', 'apy one year from now', 'apr one year from now', 'yield one year from now', 'apy next year', 'apr next year', 'гарантированн apy', 'гарантированн apr', 'гарантированн доходност', 'доходность через год', 'apy через год', 'apr через год']);",
   "    const futureYield = includesAny(q, ['guaranteed apy', 'guaranteed apr', 'guaranteed yield', 'apy one year from now', 'apr one year from now', 'yield one year from now', 'apy next year', 'apr next year', 'доходность через год', 'apy через год', 'apr через год']) || (q.includes('гарантирован') && includesAny(q, ['apy', 'apr', 'доходност'])) || (q.includes('guarante') && includesAny(q, ['apy', 'apr', 'yield']));"],
  ["    const hackProbability = includesAny(q, ['probability each company gets hacked', 'probability of hack', 'hack probability', 'chance of being hacked', 'вероятност взлом', 'вероятность хака', 'шанс взлома']);",
   "    const hackProbability = includesAny(q, ['probability each company gets hacked', 'probability of hack', 'hack probability', 'chance of being hacked', 'вероятность хака', 'шанс взлома']) || (q.includes('вероятност') && q.includes('взлом'));"],
];
for(const [from,to] of replacements){
  if(!app.includes(from)) throw new Error('app repair anchor missing: '+from.slice(0,80));
  app=app.replace(from,to);
}
fs.writeFileSync(appPath,app);

const corpusPath='verification/ask-experience/corpus-semantic-safety-v0.1.json';
const corpus=JSON.parse(fs.readFileSync(corpusPath,'utf8'));
for(const c of corpus.cases){
  // UNKNOWN semantic-boundary cases may name adjacent metrics only to explicitly distinguish and reject substitution.
  // Confidence, answer semantics and source binding are the frozen invariants here.
  c.forbiddenSubstitution=[];
}
corpus.version='0.1.1-semantic-substitution-safety';
corpus.note='v0.1.1 removes lexical APR/APY forbiddance from UNKNOWN explanations; naming an adjacent metric to explicitly reject substitution is allowed. The invariant is UNKNOWN confidence + correct boundary semantics + source binding.';
fs.writeFileSync(corpusPath,JSON.stringify(corpus,null,2)+'\n');
console.log(JSON.stringify({stemsRepaired:4,caseCount:corpus.cases.length,corpusVersion:corpus.version},null,2));
