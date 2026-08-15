import fs from 'node:fs';

const path = 'agents/console/app.js';
let app = fs.readFileSync(path, 'utf8');

function once(source, before, after, label) {
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: expected exactly one anchor, found ${count}`);
  return source.replace(before, after);
}

const before = `  function hasCompanyEvidence(data, companyName, numericFields) {\n    if (!data || !companyName) return false;\n    const hits = collectNamedObjects(data, companyName, 24);\n    return hits.some(hit => numericFact(hit.value, numericFields));\n  }\n`;
const after = `  function companyEvidenceNeedles(companyName) {\n    const name = String(companyName || '');\n    const n = norm(name);\n    const out = [name];\n    if (n.includes('83ca8')) out.push('83ca8', '0x5860...83CA8.eth', '0x58...CA8.eth');\n    if (n.includes('rook')) out.push('Rook', "Rook's portfolio");\n    if (n.includes('1milliondollar') || n.includes('million dollar')) out.push('1milliondollar');\n    return [...new Set(out.filter(Boolean))];\n  }\n\n  function productivityForCompany(companyName) {\n    const companies = safeObject(state.productivity?.companies);\n    if (companies[companyName]) return companies[companyName];\n    const needles = companyEvidenceNeedles(companyName).map(norm);\n    for (const [key, value] of Object.entries(companies)) {\n      const nk = norm(key);\n      if (needles.some(needle => needle && (nk.includes(needle) || needle.includes(nk)))) return value;\n      if (needles.includes('83ca8') && nk.includes('83ca8')) return value;\n    }\n    return null;\n  }\n\n  function hasCompanyEvidence(data, companyName, numericFields) {\n    if (!data || !companyName) return false;\n    for (const needle of companyEvidenceNeedles(companyName)) {\n      const hits = collectNamedObjects(data, needle, 24);\n      if (hits.some(hit => numericFact(hit.value, numericFields))) return true;\n    }\n    return false;\n  }\n`;
app = once(app, before, after, 'company evidence identity helper');
app = once(
  app,
  `      const ordinaryProductivity = Boolean(safeObject(state.productivity?.companies)[name]);`,
  `      const ordinaryProductivity = Boolean(productivityForCompany(name));`,
  'company understanding productivity lookup'
);
fs.writeFileSync(path, app);
console.log('Ask v1.1 company evidence identity reconciliation applied');
