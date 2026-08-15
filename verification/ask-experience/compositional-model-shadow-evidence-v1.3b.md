# Ask v1.3B — Compositional Model Shadow Evidence

Status: durable evaluation evidence; **not production answer authority**
Date: 2026-08-15

## Decision

The current evidence justifies keeping model-assisted compositional understanding as a **bounded shadow/evaluation capability** inside the canonical Ask Experience harness.

It does **not** justify routing live Ask understanding through the model yet.

Canonical authority remains:

`human language → [optional untrusted shadow candidate] → Intent Contract Firewall → deterministic evidence plane → Answer Contract / Output Guard`

- model answer authority: none
- model source-truth authority: none
- model factual-confidence authority: none
- executionAuthority: none
- livePromotionRecommended: false

## Deterministic ceiling evidence

Prior browser-level compositional pressure run:
- run `31893047155`
- 10 compound / multi-turn cases
- exact tested SHA `1b3248dfcf01adb7ba287dff5358ff8ea1cbe4d7`

The deterministic router frequently represented only one requested semantic subpart in compound requests. This justified testing a model in shadow mode, not replacing the evidence plane.

## Tuned shadow set — v0.5

Run:
- workflow run `31903737329`
- job `95058306322`
- exact head `5e2307de2eb1ad583bf7ee61174bfe4a068cbcfd`
- artifact `9251809087`
- artifact ZIP SHA-256 `d864a779f117844d355f93a1cc4172b9a01c8e479ffbe985e1f95ffcd317636f`

Results:
- cases: 10
- firewall accepted: 10/10 = 100%
- inference / parse errors: 0
- strict semantic pass: 7/10 = 70%
- required semantic subparts: 16
- omitted subparts: 0
- semantic subpart recall: 100%
- unsupported safe: 4/4 = 100%
- authority safe: 1/1 = 100%
- raw forbidden control fields: 0
- forbidden candidate accepted by firewall: 0

Main remaining errors were over-decomposition and directional comparison precision, not omitted requested subparts or authority escape.

## Frozen independent holdout — first and only pre-tuning inference

The holdout corpus was frozen before any holdout inference and must not be tuned to the observed outputs.

Run:
- workflow run `31903948050`
- job `95058812120`
- exact head `06a28a70f2a9ed0dabce1ee705ed1461739dfce4`
- artifact `9251879400`
- artifact ZIP SHA-256 `c6cd6e35fef7f5b1ea658a6c88a1ffe1c87f878f15828d197c8cba8d704a64d9`

Results:
- cases: 16
- firewall accepted: 15/16 = 93.75%
- inference / parse errors: 0
- strict semantic pass: 12/16 = 75%
- required semantic subparts: 28
- omitted subparts: 2
- semantic subpart recall: 92.86%
- unsupported safe: 6/6 = 100%
- authority safe: 2/2 = 100%
- raw forbidden control fields: 0
- forbidden candidate accepted by firewall: 0

Observed miss classes:
1. one lexical-language mismatch in the evaluator's free-form `unmodeled` concept check while the primitive structure itself was correct;
2. one schema-consistency rejection: simple `change-salience` intent incorrectly carried decomposition;
3. one noisy entity normalization miss (`Montra` vs Monetra);
4. one real omitted semantic primitive in a Yield Basis protocol/productivity/rewards question.

The frozen holdout remains unchanged after observing these misses.

## Exact clean-branch deterministic proof

After rebuilding v1.3B from fresh `main` and integrating `model-shadow` as a **manual-only mode of the single canonical Ask Experience workflow**, the exact clean candidate survived the full deterministic `all` run:

- run `31904383291`
- job `95059829221`
- exact tested SHA `3ed386cb91bd252c2f6748350e09e8c5e93542b2`
- artifact `9251956049`
- artifact ZIP SHA-256 `235400c06358ded8b7aeb224ec78245da5dc11023b9a5183776a5ed7d7dbc116`
- Output Guard: PASS
- Intent Contract: 48/48 PASS
- Safety: 8/8 PASS
- Semantic Safety: 26/26 PASS
- Core: 22/22 PASS
- fresh Mutation: 7/7 PASS, seed `2026-08-31904383291-1`
- Owner Unknown: exactly 3/12 remain review-flagged
- `falseMeasuredRate = 0` on all release-gated origins
- `falseUnknownRate = 0` on annotated answerable cases
- source fit = 100%
- confidence fit = 100%
- required answer-pattern fit = 100%
- executionAuthority = none

The earlier workflow-definition RED on commit `7803833e5baba855dcf594bbc0719683fc5c02cb` was caused by an invalid six-field monthly cron introduced during integration. It was corrected to the original valid five-field cron before the above proof. No product behavior was involved in that RED.

## Provider reproducibility boundary

Current transport is GitHub Copilot CLI using short-lived GitHub Actions identity.

Current model selection is `auto`:
- provider identity is intentionally replaceable;
- exact underlying model identity is not pinned/reproducible;
- attempts to request `gpt-5.4` and `claude-sonnet-4.6` were unavailable for the current Copilot account;
- provider/model variability is therefore part of the reason this remains evidence-only shadow infrastructure.

## Promotion disposition

**EVIDENCE_ONLY_SHADOW**

Do not promote the model into the live Ask understanding path yet.

Before any later promotion proposal, require new evidence that addresses:
- schema consistency;
- entity normalization under noisy/mixed language;
- semantic-subpart completeness on genuinely unseen cases;
- comparison/ranking precision;
- repeated-run stochastic stability with an identified/pinned provider where practical;
- deterministic Safety / Semantic Safety / Core / Mutation remaining GREEN;
- `false-MEASURED = 0` preserved after integration.

The current result is still a meaningful architectural win: the OS now has a safe, canonical place to evaluate stronger language understanding without granting the model truth, confidence, source or execution authority.
