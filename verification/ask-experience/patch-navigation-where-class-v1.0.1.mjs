import fs from 'node:fs';

const path = 'agents/console/app.js';
let app = fs.readFileSync(path, 'utf8');
const before = "    'performance', 'profit', 'embedded', 'current', 'first', 'registry', 'passport', 'learning', 'proposal', 'builder',";
const after = "    'performance', 'profit', 'embedded', 'current', 'first', 'where', 'registry', 'passport', 'learning', 'proposal', 'builder',";
const count = app.split(before).length - 1;
if (count !== 1) throw new Error(`where navigation class: expected one lexicon anchor, found ${count}`);
app = app.replace(before, after);
fs.writeFileSync(path, app);
console.log('Added bounded where typo recovery class');
