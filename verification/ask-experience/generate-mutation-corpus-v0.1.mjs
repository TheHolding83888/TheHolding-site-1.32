import fs from 'node:fs';
import crypto from 'node:crypto';

const intentsPath = process.argv[2];
const grammarPath = process.argv[3];
const seed = String(process.argv[4] || process.env.ASK_EXPERIENCE_SEED || new Date().toISOString().slice(0, 7));
const outputPath = process.argv[5] || 'artifacts/mutation-corpus.json';
if (!intentsPath || !grammarPath) throw new Error('usage: node generate-mutation-corpus-v0.1.mjs <intents.json> <grammar.json> <seed> [output.json]');

const intents = JSON.parse(fs.readFileSync(intentsPath, 'utf8'));
const grammar = JSON.parse(fs.readFileSync(grammarPath, 'utf8'));

function seed32(value) {
  return crypto.createHash('sha256').update(value).digest().readUInt32LE(0);
}
let state = seed32(seed) || 1;
function rand() {
  state ^= state << 13; state >>>= 0;
  state ^= state >>> 17; state >>>= 0;
  state ^= state << 5; state >>>= 0;
  return state / 0x100000000;
}
function pick(arr) { return arr[Math.floor(rand() * arr.length) % arr.length]; }

function fill(template, slots) {
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key) => {
    const values = slots[key];
    if (!Array.isArray(values) || !values.length) throw new Error(`missing slot ${key}`);
    return pick(values);
  });
}

function mutateSafeTypo(text, expectedIntent) {
  if (!grammar.generators?.typo?.enabled) return text;
  // High-risk safety intents rely on semantic paraphrase recipes; do not weaken them with random corruption.
  if (['authority', 'secret-request', 'personalized-allocation'].includes(expectedIntent)) return text;
  if (rand() > 0.45) return text;
  const tokens = [...text.matchAll(/[A-Za-zА-Яа-яЁё]{5,}/g)]
    .filter(m => !/private|secret|seed|sign|transaction|ключ|сид|транзак/i.test(m[0]));
  if (!tokens.length) return text;
  const chosen = pick(tokens);
  const word = chosen[0];
  const index = 1 + Math.floor(rand() * Math.max(1, word.length - 2));
  let mutated = word;
  const op = pick(grammar.generators.typo.operations || ['delete-character']);
  if (op === 'swap-adjacent' && index < word.length - 1) {
    mutated = word.slice(0, index) + word[index + 1] + word[index] + word.slice(index + 2);
  } else if (op === 'duplicate-character') {
    mutated = word.slice(0, index) + word[index] + word.slice(index);
  } else {
    mutated = word.slice(0, index) + word.slice(index + 1);
  }
  return text.slice(0, chosen.index) + mutated + text.slice(chosen.index + word.length);
}

const cases = [];
for (const intent of intents.intents || []) {
  if (!Array.isArray(intent.templates) || !intent.templates.length) continue;
  const template = pick(intent.templates);
  let prompt = fill(template, intent.slots || {});
  prompt = mutateSafeTypo(prompt, intent.expectedIntent);
  cases.push({
    id: `${intent.id}--${crypto.createHash('sha1').update(seed + '|' + intent.id).digest('hex').slice(0, 8)}`,
    baseIntentId: intent.id,
    origin: 'synthetic-mutation',
    prompt,
    expectedIntent: intent.expectedIntent ?? null,
    expectedConfidence: intent.expectedConfidence ?? null,
    requiredSourceArtifact: intent.requiredSourceArtifact ?? null,
    requiredAdditionalSourceArtifact: intent.requiredAdditionalSourceArtifact ?? null,
    requiredAnswerPattern: intent.requiredAnswerPattern ?? null,
    forbiddenSubstitution: intent.forbiddenSubstitution || []
  });
}

const output = {
  version: '0.1-generated-mutation-corpus',
  origin: 'synthetic-mutation',
  baseIntentVersion: intents.version,
  grammarVersion: grammar.version,
  seed,
  generatedStringsDurable: false,
  releaseGateEligible: intents.releaseGateEligible !== false,
  cases
};

fs.mkdirSync('artifacts', { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
console.log(JSON.stringify({ seed, grammarVersion: grammar.version, cases: cases.length, ids: cases.map(x => x.id) }, null, 2));
