import fs from 'node:fs';
import crypto from 'node:crypto';

const intentsPath = process.argv[2];
const grammarPath = process.argv[3];
const seed = String(process.argv[4] || process.env.ASK_EXPERIENCE_SEED || new Date().toISOString().slice(0, 7));
const outputPath = process.argv[5] || 'artifacts/mutation-corpus.json';
if (!intentsPath || !grammarPath) throw new Error('usage: node generate-mutation-corpus-v0.1.mjs <intents.json> <grammar.json> <seed> [output.json]');

const intents = JSON.parse(fs.readFileSync(intentsPath, 'utf8'));
const grammar = JSON.parse(fs.readFileSync(grammarPath, 'utf8'));
// Keep the legacy Ask Experience mutation lane lightweight unless a caller explicitly
// opts into a larger campaign. Conversation Gauntlet sets this env to 10; the older
// monthly/all lane therefore exercises one unseen surface per semantic family instead
// of accidentally duplicating the full heavy campaign.
const requestedVariants = Number(process.env.ASK_EXPERIENCE_VARIANTS_PER_INTENT || 1);
const variantsPerIntent = Math.max(1, Math.min(20, Number.isFinite(requestedVariants) ? Math.floor(requestedVariants) : 1));

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

function mutateOneToken(text, expectedIntent) {
  if (!grammar.generators?.typo?.enabled) return text;
  if (['authority', 'secret-request', 'personalized-allocation', 'companion-authority'].includes(expectedIntent)) return text;
  const tokens = [...text.matchAll(/[A-Za-zА-Яа-яЁё]{5,}/g)]
    .filter(m => !/private|secret|seed|sign|transaction|wallet|ключ|сид|транзак|кошел/i.test(m[0]));
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

function surfaceMutate(text, expectedIntent) {
  let out = String(text);
  const typoChance = Number(grammar.generators?.typo?.gauntletChance ?? 0.55);
  const maxTypos = Math.max(1, Math.min(2, Number(grammar.generators?.typo?.gauntletMaxEdits ?? 2)));
  if (rand() < typoChance) out = mutateOneToken(out, expectedIntent);
  if (maxTypos > 1 && rand() < typoChance * 0.35) out = mutateOneToken(out, expectedIntent);
  if (grammar.generators?.punctuationNoise?.enabled && rand() < 0.3) {
    out = pick(['  ', '... ', ' — ', ', ']) + out + (rand() < 0.5 ? '?' : '');
  }
  if (grammar.generators?.casualCase?.enabled && rand() < 0.2) out = out.charAt(0).toLowerCase() + out.slice(1);
  return out.trim();
}

function chooseSurface(intent) {
  const sessionTemplates = Array.isArray(intent.sessionTemplates) ? intent.sessionTemplates : [];
  const promptTemplates = Array.isArray(intent.templates) ? intent.templates : [];
  const useSession = sessionTemplates.length && (promptTemplates.length === 0 || rand() < Number(intent.sessionChance ?? 0.35));
  if (useSession) {
    const sessionTemplate = pick(sessionTemplates);
    if (!Array.isArray(sessionTemplate) || !sessionTemplate.length) throw new Error(`invalid session template for ${intent.id}`);
    return { session: sessionTemplate.map(turn => surfaceMutate(fill(turn, intent.slots || {}), intent.expectedIntent)) };
  }
  if (!promptTemplates.length) throw new Error(`intent ${intent.id} has no templates`);
  return { prompt: surfaceMutate(fill(pick(promptTemplates), intent.slots || {}), intent.expectedIntent) };
}

const cases = [];
for (const intent of intents.intents || []) {
  for (let variant = 0; variant < variantsPerIntent; variant++) {
    const surface = chooseSurface(intent);
    const fingerprint = crypto.createHash('sha1').update(`${seed}|${intent.id}|${variant}`).digest('hex').slice(0, 10);
    cases.push({
      id: `${intent.id}--${fingerprint}`,
      baseIntentId: intent.id,
      capabilityClass: intent.capabilityClass || null,
      origin: 'synthetic-mutation',
      ...surface,
      expectedIntent: intent.expectedIntent ?? null,
      expectedConfidence: intent.expectedConfidence ?? null,
      requiredSourceArtifact: intent.requiredSourceArtifact ?? null,
      requiredAdditionalSourceArtifact: intent.requiredAdditionalSourceArtifact ?? null,
      requiredAnswerPattern: intent.requiredAnswerPattern ?? null,
      forbiddenSubstitution: intent.forbiddenSubstitution || []
    });
  }
}

const output = {
  version: '0.2-generated-conversation-gauntlet-corpus',
  origin: 'synthetic-mutation',
  baseIntentVersion: intents.version,
  grammarVersion: grammar.version,
  seed,
  variantsPerIntent,
  generatedStringsDurable: false,
  releaseGateEligible: intents.releaseGateEligible !== false,
  target: intents.target || { falseMeasuredRate: 0, falseUnknownRate: 0 },
  cases
};

fs.mkdirSync('artifacts', { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
console.log(JSON.stringify({
  seed,
  grammarVersion: grammar.version,
  intentFamilies: (intents.intents || []).length,
  variantsPerIntent,
  cases: cases.length,
  multiTurnCases: cases.filter(x => Array.isArray(x.session)).length,
  generatedStringsDurable: false
}, null, 2));
