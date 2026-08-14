# The Holding Security Sentinel v0.2

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

## Browser trust review v0.2

`security/browser-trust-policy.json` is the explicit review layer for browser findings that cannot be judged correctly from a regex alone.

### Reviewed DOM HTML sinks

A reviewed `innerHTML` surface is suppressed only while **both** remain exact:
- the reviewed Git blob SHA of the whole file;
- the reviewed number of `innerHTML` assignments in that file.

Any file change invalidates the review automatically and the sinks return as normal findings until they are reviewed again. This keeps current trusted canonical rendering from generating permanent false-positive noise without creating a blanket file allowlist.

### Mutable third-party JavaScript

An exact external script URL can be registered as a reviewed mutable vendor dependency when static SRI would be technically inappropriate. The Sentinel then:
- permits that exact URL only on the explicitly reviewed page list;
- fetches and SHA-256 hashes the remote script on network-enabled scans;
- remembers the observed remote hash;
- opens one security finding if the remote bytes change, monitoring fails, the content type changes, or the trust-review window expires.

For the current Umami Cloud tracker, this is intentionally preferred over brittle SRI on the unversioned mutable `cloud.umami.is/script.js`. Umami's official documentation describes proxying/self-hosting and explicitly notes that a hosted copy must be refreshed when the tracker changes.

This is an **accepted monitored dependency**, not a claim that third-party JavaScript is risk-free. If The Holding later decides analytics is not worth the dependency, removal remains the strongest simplification.

## Permanent security memory

The layer writes:

- `security/security-memory.json` — current security state;
- `security/security-history.json` — rolling operational memory;
- `security/security-intelligence.json` — compact Brain / human bridge;
- `security/security-brief.md` — deterministic summary;
- `security/security-vault/` — indefinite append-only hash-chained deep memory.

This means future security reasoning can ask not only “what is risky now?” but also “when did this surface change?”, “is this finding new?”, and “what was resolved?”.

## Enforcement policy

- critical conditions are recorded and then make the workflow fail;
- high findings produce WATCH state but do not automatically break production;
- reviewed browser trust is fail-closed: changed reviewed files or changed/unverifiable third-party bytes reopen findings;
- the Sentinel never deletes files, rotates keys, rewrites application code, or changes capital permissions on its own.

## Security is layered

The Sentinel is one layer, not the whole defense. Repository rules/branch protection, account security, secret scanning, minimal workflow permissions, SHA-pinned Actions, browser hardening, domain/DNS security, backups, and AI tool-permission boundaries all remain required.
