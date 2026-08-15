import fs from 'node:fs';

const runPath = process.argv[2];
if (!runPath) throw new Error('usage: node review-owner-unknown-v0.1.mjs <run.json>');
const run = JSON.parse(fs.readFileSync(runPath, 'utf8'));

const companyPattern = /Monetra|Defitea|YieldRing|1milliondollar|Rook|dinaz|aerocvxyb|05081966|company\s+#?\d{3}|компани[яи]\s+#?\d{3}/i;
const comparativePattern = /higher|lower|largest|smallest|most|least|better|worse|gap|versus|vs\.?|difference|выше|ниже|больш|меньш|хуже|лучше|разниц|относитель/i;
const changePattern = /changed|change|recent|since|month|now|today|измен|недав|месяц|сейчас|сегодня/i;
const genericDefinitionPattern = /^(The Holding is|A Personal Onchain Company is|Realised Cash Flow is|Found in The Holding public knowledge:)/i;
const numericEvidencePattern = /(?:\$|\b\d+(?:[.,]\d+)?%|\b\d{4}-\d{2}-\d{2}\b)/;

const rows=[];
for(const c of run.cases || []){
  const p=(c.prompts||[]).at(-1)||{};
  const q=String(p.question||'');
  const a=String(p.answer||'');
  const artifacts=p.answerContract?.sourceArtifacts||[];
  const target=String(c.discoveryTarget||'');
  const asksRanking=/which|what .*most|largest|furthest|best|worst|clearest|first|какая|какой|что .*больше|хуже|лучше|перв/i.test(q);
  const asksChange=changePattern.test(q) || /change|salience/i.test(target);
  const flags=[];
  if(asksRanking && !companyPattern.test(a) && !comparativePattern.test(a)) flags.push('ranking-without-resolved-object');
  if(asksChange && genericDefinitionPattern.test(a) && !numericEvidencePattern.test(a)) flags.push('change-question-generic-definition');
  if(/cross-company|cross-source|purpose|concentration|maturity|readiness|priorit/i.test(target) && artifacts.length < 2 && !companyPattern.test(a)) flags.push('synthesis-evidence-thin');
  if(genericDefinitionPattern.test(a) && a.length < 650) flags.push('generic-definition-shape');
  rows.push({
    id:c.id,
    origin:c.origin||run.origin||'owner-unknown',
    discoveryTarget:c.discoveryTarget||null,
    confidence:p.answerContract?.confidenceClass||'missing',
    sourceArtifactCount:artifacts.length,
    flags,
    needsHumanReview:flags.length>0,
    autoLearningAuthorized:false
  });
}
const flagged=rows.filter(x=>x.flags.length);
const output={
  version:'0.1-owner-unknown-non-authoritative-review',
  origin:'owner-unknown',
  releaseGateEligible:false,
  caseCount:rows.length,
  flaggedCount:flagged.length,
  flaggedRate:rows.length?Number((flagged.length/rows.length).toFixed(6)):0,
  interpretation:'Flags indicate weak evidence/synthesis shape, not factual incorrectness. Owner Unknown has no pre-known answer.',
  rows
};
process.stdout.write(JSON.stringify(output,null,2)+'\n');
