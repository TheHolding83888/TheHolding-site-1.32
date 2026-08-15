import fs from 'node:fs';

const path = 'agents/console/app.js';
let s = fs.readFileSync(path, 'utf8');

function once(before, after, label) {
  const n = s.split(before).length - 1;
  if (n !== 1) throw new Error(`${label}: expected one anchor, found ${n}`);
  s = s.replace(before, after);
}

once(
`  function companyEvidenceNeedles(companyName) {
    const name = String(companyName || '');
    const n = norm(name);
    const out = [name];
    if (n.includes('83ca8')) out.push('83ca8', '0x5860...83CA8.eth', '0x58...CA8.eth');`,
`  function canonicalCompanyEvidenceName(companyName) {
    const name = String(companyName || '');
    const n = norm(name);
    if (n.includes('83ca8') || n === '0x58...ca8.eth' || n.startsWith('0x58...ca8')) return '0x5860...83CA8.eth';
    return name;
  }

  function companyEvidenceNeedles(companyName) {
    const name = canonicalCompanyEvidenceName(companyName);
    const n = norm(name);
    const out = [name];
    if (n.includes('83ca8')) out.push('83ca8', '5860', '0x5860...83CA8.eth', '0x58...ca8.eth');`,
'canonical identity helper');

once(
`    const names = [...new Set([
      ...state.registry.map(x => x.name),
      ...Object.keys(safeObject(state.productivity?.companies)),
      state.stable?.company?.name
    ].filter(Boolean))];`,
`    const names = [...new Set([
      ...state.registry.map(x => x.name),
      ...Object.keys(safeObject(state.productivity?.companies)),
      state.stable?.company?.name
    ].filter(Boolean).map(canonicalCompanyEvidenceName))];`,
'company-understanding identity dedupe');

once(
`      const registry = state.registry.some(x => x.name === name);`,
`      const registry = state.registry.some(x => companyEvidenceNeedles(name).some(needle => {
        const a = norm(x.name), b = norm(needle);
        return a === b || (b === '83ca8' && a.includes('ca8'));
      }));`,
'registry alias reconciliation');

once(
`      return { name, registry, productivity, rewardsEvidence, embeddedEvidence, entryEvidence, common };`,
`      const displayName = name === '0x5860...83CA8.eth'
        ? (state.registry.find(x => norm(x.name) === '0x58...ca8.eth')?.name || name)
        : name;
      return { name: displayName, evidenceName: name, registry, productivity, rewardsEvidence, embeddedEvidence, entryEvidence, common };`,
'display identity');

fs.writeFileSync(path, s);

const out = fs.readFileSync(path, 'utf8');
for (const token of ['canonicalCompanyEvidenceName', "n === '0x58...ca8.eth'", '.map(canonicalCompanyEvidenceName)', 'evidenceName: name']) {
  if (!out.includes(token)) throw new Error(`missing repair token: ${token}`);
}
console.log('Company evidence identity dedupe repair applied');
