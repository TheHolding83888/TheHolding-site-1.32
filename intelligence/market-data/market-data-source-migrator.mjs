import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const CLIENT_TAG = '<script src="/intelligence/market-data/public-capital-client.js"></script>';
const LOCAL_SIMPLE_PRICE = '/intelligence/market-data/simple-price';
const TARGETS = [
  'index.html',
  'companies/index.html',
  'defitea/index.html',
  'yield-reports/index.html',
  'substantia/index.html',
  'singul/index.html',
  'fructus/index.html',
  'monetra/index.html'
];

function replaceOnce(text, rx, replacement, label, {required = true} = {}) {
  const matches = [...text.matchAll(new RegExp(rx.source, rx.flags.includes('g') ? rx.flags : rx.flags + 'g'))];
  if (!matches.length) {
    if (required) throw new Error(`${label}: expected anchor missing`);
    return text;
  }
  if (matches.length !== 1) throw new Error(`${label}: expected exactly one anchor, found ${matches.length}`);
  return text.replace(rx, replacement);
}

function injectClient(html, rel) {
  if (html.includes(CLIENT_TAG)) return html;
  if (!html.includes('</head>')) throw new Error(`${rel}: </head> anchor missing`);
  return html.replace('</head>', `    ${CLIENT_TAG}\n</head>`);
}

function removeBrowserCoinGecko(html) {
  return html
    .replaceAll('https://api.coingecko.com/api/v3/simple/price', LOCAL_SIMPLE_PRICE)
    .replace(/CG-[A-Za-z0-9_-]{12,}/g, 'LOCAL-SNAPSHOT')
    .replace(/^\s*<link[^>]+(?:preconnect|dns-prefetch)[^>]+api\.coingecko\.com[^>]*>\s*\n?/gmi, '');
}

function canonicalDefiteaHoldingsBlock() {
  return `const defiteaHoldings = {\n            aero: 2632,\n            cvx: 1333,\n            crv: 4125,\n            pendle: 500,\n            fxn: 64.81,\n            yb: 10846,\n            fxs: 4224,\n            velo: 12180,\n            vvv: 50,\n            lqty: 1488,\n            rsup: 3682\n        };`;
}

function migrateHomepage(html) {
  html = replaceOnce(
    html,
    /const defiteaHoldings\s*=\s*\{[\s\S]*?\n\s*\};/,
    canonicalDefiteaHoldingsBlock(),
    'homepage Defitea holdings'
  );

  html = html.replace(
    /const co4\s*=\s*2440\s*\*\s*p\('aerodrome-finance'\)([\s\S]*?)59\.81\s*\*\s*p\('fxn-token'\)([\s\S]*?);/,
    "const co4 = 2632 * p('aerodrome-finance')$1" + "64.81 * p('fxn-token')$2;"
  );
  return html;
}

function migrateCompanies(html) {
  if (/const defiteaHoldings\s*=/.test(html)) {
    html = replaceOnce(
      html,
      /const defiteaHoldings\s*=\s*\{[\s\S]*?\n\s*\};/,
      canonicalDefiteaHoldingsBlock(),
      'companies Defitea holdings'
    );
  }
  return html;
}

function migrateSingul(html) {
  html = replaceOnce(
    html,
    /elizaos:\s*130000\s*,?\s*\/\/\s*ElizaOS[^\n]*/,
    'elizaos: 80808,               // ElizaOS · canonical owner quantity',
    'Singul ELIZA quantity'
  );
  return html;
}

function migrateFructus(html) {
  html = replaceOnce(
    html,
    /const fructusHoldings\s*=\s*\{[\s\S]*?\n\s*\};\s*\n\s*const FIXED_DBCON_VALUE[^\n]*\n\s*const FIXED_COPXON_VALUE[^\n]*\n/,
    `const fructusHoldings = {\n            ondo: 542          // ONDO Finance · canonical owner quantity\n        };\n\n`,
    'Fructus canonical holdings'
  );

  html = replaceOnce(
    html,
    /const ondoValue\s*=\s*fructusHoldings\.ondo[\s\S]*?const fructusTVL\s*=\s*ondoValue\s*\+\s*dbconValue\s*\+\s*copxonValue\s*;/,
    `const ondoValue = fructusHoldings.ondo * (prices['ondo-finance']?.usd || 0);\n                const fructusTVL = ondoValue;`,
    'Fructus TVL calculation'
  );
  return html;
}

function assertNoDirectCoinGecko(html, rel) {
  if (/api\.coingecko\.com\/api\/v3\/simple\/price/i.test(html)) {
    throw new Error(`${rel}: direct browser CoinGecko simple-price path remains`);
  }
  if (/CG-[A-Za-z0-9_-]{12,}/.test(html)) {
    throw new Error(`${rel}: public CoinGecko credential-like literal remains`);
  }
}

for (const rel of TARGETS) {
  const file = path.join(ROOT, rel);
  if (!fs.existsSync(file)) throw new Error(`${rel}: target file missing`);
  let html = fs.readFileSync(file, 'utf8');
  const before = html;

  html = injectClient(html, rel);
  html = removeBrowserCoinGecko(html);
  if (rel === 'index.html') html = migrateHomepage(html);
  if (rel === 'companies/index.html') html = migrateCompanies(html);
  if (rel === 'singul/index.html') html = migrateSingul(html);
  if (rel === 'fructus/index.html') html = migrateFructus(html);

  assertNoDirectCoinGecko(html, rel);
  if (html !== before) fs.writeFileSync(file, html);
  console.log(`${rel}: ${html === before ? 'already migrated' : 'migrated'}`);
}

const fructus = fs.readFileSync(path.join(ROOT, 'fructus/index.html'), 'utf8');
for (const forbidden of ['fructusHoldings.dbcon', 'fructusHoldings.copxon', 'FIXED_DBCON_VALUE', 'FIXED_COPXON_VALUE']) {
  if (fructus.includes(forbidden)) throw new Error(`Fructus calculation still contains ${forbidden}`);
}

const singul = fs.readFileSync(path.join(ROOT, 'singul/index.html'), 'utf8');
if (!/elizaos:\s*80808\b/.test(singul)) throw new Error('Singul ELIZA canonical quantity not migrated');

const homepage = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
if (!/aero:\s*2632\b/.test(homepage) || !/fxn:\s*64\.81\b/.test(homepage)) {
  throw new Error('Homepage Defitea canonical quantities not migrated');
}

console.log('Market Data public surface migration PASS');
