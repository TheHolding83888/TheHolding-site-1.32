#!/usr/bin/env node
// Canonical Rewards post-processing entrypoint.
// Order matters: first materialize proven historical Received income, then apply
// the pre-existing Passport route-hygiene contract byte-for-byte from core.
await import('./forty-acres-received-ledger.mjs');
await import('./rewards-passport-hygiene-core.mjs');
