import fs from 'node:fs';

const path = 'agents/console/app.js';
let s = fs.readFileSync(path, 'utf8');

const oldText = [
  '    if (a.length === b.length) {',
  '      let mismatches = 0;',
  '      for (let i = 0; i < a.length; i++) if (a[i] !== b[i] && ++mismatches > 1) return false;',
  '      return true;',
  '    }'
].join('\n');

const newText = [
  '    if (a.length === b.length) {',
  '      const mismatch = [];',
  '      for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) mismatch.push(i);',
  '      if (mismatch.length <= 1) return true;',
  '      if (mismatch.length === 2) {',
  '        const [i, j] = mismatch;',
  '        return j === i + 1 && a[i] === b[j] && a[j] === b[i];',
  '      }',
  '      return false;',
  '    }'
].join('\n');

if (!s.includes(oldText)) throw new Error('expected edit-distance anchor missing');
if (s.includes(newText)) throw new Error('transposition recovery already present unexpectedly');
s = s.replace(oldText, newText);
fs.writeFileSync(path, s, 'utf8');
console.log('bounded adjacent-transposition recovery applied');
