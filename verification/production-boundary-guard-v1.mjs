import fs from 'node:fs';
import path from 'node:path';

const candidateRoot = path.resolve(process.argv[2] || '.');
const baselineRoot = path.resolve(process.argv[3] || candidateRoot);
const failures = [];
const notes = [];

const fail = message => failures.push(message);
const note = message => notes.push(message);
const read = (root, rel) => {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) {
    fail(`missing required file: ${rel}`);
    return '';
  }
  return fs.readFileSync(file, 'utf8');
};
const json = (root, rel) => {
  const text = read(root, rel);
  if (!text) return null;
  try { return JSON.parse(text); }
  catch (error) { fail(`invalid JSON in ${rel}: ${error.message}`); return null; }
};

const criticalFiles = [
  'index.html',
  'agents/index.html',
  'agents/console/index.html',
  'wrangler.jsonc',
  'worker/site-root.js',
  'worker/index.js',
  'worker/api-only.js',
  'worker/wrangler.learning.jsonc',
  'verification/production-boundary-guard-v1.mjs',
  '.github/workflows/production-boundary-guard.yml'
];
for (const rel of criticalFiles) {
  if (fs.existsSync(path.join(baselineRoot, rel)) && !fs.existsSync(path.join(candidateRoot, rel))) {
    fail(`critical production file deletion is forbidden: ${rel}`);
  }
}

const homepage = read(candidateRoot, 'index.html');
if (homepage) {
  if (!/<link\s+rel=["']canonical["']\s+href=["']https:\/\/theholding\.ai\/["']/i.test(homepage)) {
    fail('homepage must keep canonical https://theholding.ai/');
  }
  if (!/<title>[^<]*TheHolding\.ai/i.test(homepage)) fail('homepage title must identify TheHolding.ai');
  if (/Ask The Holding\./i.test(homepage) || /KNOWLEDGE ROUTER/i.test(homepage) || /Live knowledge console/i.test(homepage)) {
    fail('root index.html must never become the Ask The Holding interface');
  }
}

const agentsHtml = read(candidateRoot, 'agents/index.html');
if (agentsHtml) {
  if (!/id=["']ask-the-holding["']/i.test(agentsHtml)) fail('canonical Ask The Holding section missing from /agents/');
  if (!/Ask The Holding/i.test(agentsHtml)) fail('Ask The Holding identity missing from /agents/');
  if (!/THE HOLDING OBSERVER/i.test(agentsHtml)) fail('Observer surface missing from unified /agents/ OS Lab');
  if (!/Cognitive Stack/i.test(agentsHtml)) fail('Cognitive Stack surface missing from unified /agents/ OS Lab');
  if (!/(?:\/agents\/console|\.\/console)\/safety\.js\?v=0\.1/i.test(agentsHtml)) {
    fail('verified Console safety v0.1 layer must remain attached to /agents/ through the canonical console asset path');
  }
  if (!/(?:\/agents\/console|\.\/console)\/app\.js\?v=[0-9][A-Za-z0-9._-]*/i.test(agentsHtml)) {
    fail('a versioned Ask router must remain attached to /agents/ through the canonical console asset path');
  }
}

const legacyConsoleHtml = read(candidateRoot, 'agents/console/index.html');
if (legacyConsoleHtml) {
  if (!/Moved to The Holding OS Lab/i.test(legacyConsoleHtml)) fail('legacy /agents/console/ must identify the OS Lab move');
  if (!/url=\/agents\/#ask-the-holding/i.test(legacyConsoleHtml)) fail('legacy /agents/console/ must redirect to /agents/#ask-the-holding');
  if (!/<link\s+rel=["']canonical["']\s+href=["']https:\/\/theholding\.ai\/agents\/["']/i.test(legacyConsoleHtml)) {
    fail('legacy /agents/console/ must canonicalize to https://theholding.ai/agents/');
  }
  if (!/noindex,follow/i.test(legacyConsoleHtml)) fail('legacy /agents/console/ must remain noindex,follow');
}

const rootWrangler = json(candidateRoot, 'wrangler.jsonc');
if (rootWrangler) {
  if (rootWrangler.name !== 'theholdingprotocol') fail('root wrangler name must remain theholdingprotocol');
  if (rootWrangler.main !== 'worker/site-root.js') fail('root wrangler main must remain worker/site-root.js');
  if (rootWrangler.assets?.directory !== '.') fail('root wrangler assets.directory must remain repository root (.)');
  if (rootWrangler.assets?.binding !== 'ASSETS') fail('root wrangler assets.binding must remain ASSETS');
  if (Array.isArray(rootWrangler.routes) && rootWrangler.routes.length) fail('root theholdingprotocol wrangler must not declare routes');
  if (rootWrangler.route) fail('root theholdingprotocol wrangler must not declare a route');
  const exported = rootWrangler.exports?.LearningIntake;
  if (!exported || exported.type !== 'durable-object' || exported.storage !== 'sqlite') {
    fail('root wrangler must preserve provisioned LearningIntake durable-object export');
  }
}

const siteRoot = read(candidateRoot, 'worker/site-root.js');
if (siteRoot) {
  if (!/export\s*\{\s*LearningIntake\s*\}/.test(siteRoot)) fail('site-root must preserve LearningIntake export');
  if (!/env\.ASSETS\.fetch\(request\)/.test(siteRoot)) fail('site-root must serve canonical static assets');
  if (/agents\/console|learning-intake|learning-status|learning-feedback|learning-insights/i.test(siteRoot)) {
    fail('site-root must not route OS Lab/Console or learning API traffic');
  }
  const fetchBodies = [...siteRoot.matchAll(/async\s+fetch\s*\([^)]*\)\s*\{([\s\S]*?)\n\s*\}/g)].map(m => m[1]);
  if (fetchBodies.length !== 1 || !/return\s+env\.ASSETS\.fetch\(request\)\s*;?\s*$/.test(fetchBodies[0].trim())) {
    fail('site-root fetch handler must be a static-assets-only pass-through');
  }
}

const learningWrangler = json(candidateRoot, 'worker/wrangler.learning.jsonc');
if (learningWrangler) {
  if (learningWrangler.name !== 'theholding-learning-intake') fail('learning Worker must use isolated project name');
  if (learningWrangler.main !== 'api-only.js') fail('learning Worker main must remain api-only.js');
  if (learningWrangler.assets) fail('learning Worker must not bundle or own static site assets');
  const routes = Array.isArray(learningWrangler.routes) ? learningWrangler.routes : [];
  if (routes.length !== 1 || routes[0]?.pattern !== 'theholding.ai/api/*' || routes[0]?.zone_name !== 'theholding.ai') {
    fail('learning Worker route must be exactly theholding.ai/api/* in zone theholding.ai');
  }
  const binding = (learningWrangler.durable_objects?.bindings || []).find(x => x.name === 'LEARNING_INTAKE');
  if (!binding || binding.class_name !== 'LearningIntake') fail('learning Worker must preserve LEARNING_INTAKE -> LearningIntake binding');
  const exported = learningWrangler.exports?.LearningIntake;
  if (!exported || exported.type !== 'durable-object' || exported.storage !== 'sqlite') {
    fail('learning Worker must preserve LearningIntake sqlite export');
  }
  if (String(learningWrangler.vars?.LEARNING_INTAKE_ENABLED) !== 'false') {
    fail('conversation learning must remain fail-closed in repository config');
  }
}

const apiOnly = read(candidateRoot, 'worker/api-only.js');
if (apiOnly) {
  const allowed = [
    '/api/learning-status',
    '/api/learning-intake',
    '/api/learning-feedback',
    '/api/learning-insights'
  ];
  for (const p of allowed) if (!apiOnly.includes(`'${p}'`)) fail(`api-only allowlist missing ${p}`);
  if (!/if\s*\(!API_PATHS\.has\(url\.pathname\)\)/.test(apiOnly) || !/status:\s*404/.test(apiOnly)) {
    fail('api-only Worker must fail closed with 404 outside explicit API allowlist');
  }
  if (/ASSETS\.fetch|agents\/console/i.test(apiOnly)) fail('api-only Worker must never serve main-site assets');
}

const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
  if (entry.name === '.git' || entry.name === 'node_modules') return [];
  const full = path.join(dir, entry.name);
  return entry.isDirectory() ? walk(full) : [full];
});
for (const file of walk(candidateRoot)) {
  const rel = path.relative(candidateRoot, file).replaceAll('\\', '/');
  if (!/(^|\/)wrangler[^/]*\.jsonc?$/.test(rel)) continue;
  let cfg;
  try { cfg = JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { continue; }
  const routes = [...(Array.isArray(cfg.routes) ? cfg.routes : []), ...(cfg.route ? [cfg.route] : [])];
  for (const route of routes) {
    const pattern = typeof route === 'string' ? route : route?.pattern;
    if (!pattern) continue;
    if (pattern.startsWith('theholding.ai') && !(rel === 'worker/wrangler.learning.jsonc' && pattern === 'theholding.ai/api/*')) {
      fail(`${rel} declares forbidden primary-domain route: ${pattern}`);
    }
  }
  if (cfg.name !== 'theholdingprotocol' && cfg.assets?.directory === 'agents/console') {
    fail(`${rel} must not bundle agents/console as Worker assets`);
  }
}

const baselineWrangler = json(baselineRoot, 'wrangler.jsonc');
if (baselineWrangler?.exports?.LearningIntake && !rootWrangler?.exports?.LearningIntake) {
  fail('provisioned LearningIntake cannot be silently removed; explicit reviewed lifecycle/migration is required');
}

if (failures.length) {
  console.error('\nPRODUCTION BOUNDARY GUARD: FAIL');
  for (const item of failures) console.error(`- ${item}`);
  process.exit(1);
}

note('canonical homepage ownership verified');
note('unified Ask The Holding OS Lab verified at /agents/');
note('legacy /agents/console/ redirect contract verified');
note('learning Worker constrained to theholding.ai/api/*');
note('LearningIntake lifecycle continuity preserved');
note('critical production files present');
console.log('PRODUCTION BOUNDARY GUARD: GREEN');
for (const item of notes) console.log(`- ${item}`);
