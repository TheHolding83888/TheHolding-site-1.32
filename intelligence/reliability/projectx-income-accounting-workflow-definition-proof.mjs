#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';

const file='.github/workflows/verify-projectx-income-accounting.yml';
const text=fs.readFileSync(file,'utf8');
assert.match(text,/name:\s*Verify Project X Income Accounting/);
assert.match(text,/permissions:\s*\n\s*contents:\s*read/);
assert.doesNotMatch(text,/contents:\s*write/);
assert.doesNotMatch(text,/schedule:/);
for(const forbidden of [
  /sendTransaction/i,
  /new Wallet\(/i,
  /private[_-]?key/i,
  /walletSigning:\s*true/i,
  /executionAuthority:\s*(?:write|execute|wallet|capital)/i,
  /capitalExecution:\s*true/i
]) assert.doesNotMatch(text,forbidden);
assert.match(text,/projectx-income-candidates-validation\.mjs/);
assert.match(text,/income-ledger-validation\.mjs/);
assert.match(text,/company-monthly-earned-income-validation\.mjs/);
console.log('Project X income accounting workflow definition proof PASS',{readOnly:true,schedule:false,executionAuthority:'none'});
