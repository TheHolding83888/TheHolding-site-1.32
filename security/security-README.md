# The Holding Security Sentinel v0.1

The Security Sentinel is a deterministic defensive layer for The Holding.

It does **not** rely on secrecy of public source code and it does not claim to make the system impossible to attack. Its purpose is to reduce attack surface, remember security state, detect changes, and make dangerous conditions visible early.

## What it watches

- obvious credential / private-key patterns without storing the matched secret;
- GitHub Actions permissions and mutable `uses:` references;
- privileged triggers and dangerous shell patterns;
- browser-side execution sinks such as `innerHTML`, `document.write`, `eval`, and insecure HTTP fetches;
- externally hosted JavaScript without SRI;
- hashes of critical public pages and workflows;
- availability / HTTPS state of key public The Holding surfaces;
- new versus resolved findings over time.

## Permanent security memory

The layer writes:

- `security/security-memory.json` — current security state;
- `security/security-history.json` — rolling operational memory;
- `security/security-intelligence.json` — compact Brain / human bridge;
- `security/security-brief.md` — deterministic summary;
- `security/security-vault/` — indefinite append-only hash-chained deep memory.

This means future security reasoning can ask not only “what is risky now?” but also “when did this surface change?”, “is this finding new?”, and “what was resolved?”.

## Enforcement policy v0.1

- critical conditions are recorded and then make the workflow fail;
- high findings produce WATCH state but do not automatically break production;
- the Sentinel never deletes files, rotates keys, rewrites code, or changes capital permissions on its own.

Future versions can progressively add bounded remediation after the detector has earned trust.

## Security is layered

The Sentinel is one layer, not the whole defense. Repository rules/branch protection, account security, secret scanning, minimal workflow permissions, SHA-pinned Actions, browser hardening, domain/DNS security, backups, and later AI tool-permission boundaries all remain required.
