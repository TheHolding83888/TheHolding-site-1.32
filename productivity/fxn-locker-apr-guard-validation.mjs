#!/usr/bin/env node
import assert from 'node:assert/strict';
import { extractFxnLockerApr } from './fxn-locker-apr-guard.mjs';

// Canonical layout: exact Locker block.
assert.equal(
  extractFxnLockerApr(['FXN Locker Lock FXN and earn rewards APR 76.61% Total locked $1,234,567']),
  76.61
);

// A foreign APR before the Locker block must never win.
assert.equal(
  extractFxnLockerApr(['Market overview APR 4.20% Some card FXN Locker Voting power APR 76.61% Rewards']),
  76.61
);

// Support layouts that render the value before the APR label inside the same Locker scope.
assert.equal(
  extractFxnLockerApr(['FXN Locker Weekly rewards 33.90% APR Claim fees']),
  33.9
);

// Duplicate DOM copies with the same exact value remain unambiguous.
assert.equal(
  extractFxnLockerApr([
    'FXN Locker APR 26.10%',
    'Mobile drawer FXN Locker APR 26.10%'
  ]),
  26.1
);

// Divergent Locker values are ambiguous and must fail closed.
assert.throws(
  () => extractFxnLockerApr(['FXN Locker APR 26.10%', 'FXN Locker APR 76.61%']),
  /expected one unambiguous FXN Locker APR/
);

// Generic page APR without the Locker label is not admissible.
assert.throws(
  () => extractFxnLockerApr(['APR 76.61% Total protocol rewards']),
  /expected one unambiguous FXN Locker APR/
);

console.log('f(x) exact-source APR parser validation PASS');
