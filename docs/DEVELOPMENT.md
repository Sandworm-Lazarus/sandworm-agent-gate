# Development record

## 0.1.0 — 2026-11-11

Original Sandworm Agent Gate implementation: a no-dependency browser app and CommonJS-compatible engine for deterministic policy evaluation. Uses the user's Sandworm dark/coral visual language, embedded OFL fonts and original local network artwork.

Implemented tool/action allowlists, exact/segment-safe resource matching, explicit deny precedence, bounded integer micro-USD budgets and mandatory review for all write calls. Reports contain sanitized structural metadata plus exact-input and canonical-call SHA-256 fingerprints. Browser edits and stale asynchronous operations invalidate export state.

The synthetic fixture contains one allowed read, one pending-review write, and four denials (unknown tool, traversal, over-budget cost, private resource). It is not a real agent benchmark.

## Reproduce

```sh
npm test
npm run check
node scripts/audit.cjs examples/policy.json examples/calls.json > audit.json
```

Compare `audit.json` with `examples/expected-audit.json`. `npm run check` records source/fixture fingerprints in `reports/validation.json`. Fingerprints detect a changed source tree; they are not a cryptographic signature or an independent security review.

Initial targeted suite: 34 tests (29 engine, 5 controller), Node.js 24.22.1. Cases cover policy precedence, lexical traversal variants, exact and prefix boundaries, integer budget limits, duplicate keys and IDs, unsupported schemas, export minimization, deterministic hashes, pending-audit invalidation and asynchronous file-read races. Browser observations, when recorded by the release maintainer, are separate from this automated suite.

No actual tools or model calls are performed. No claim is made about hosted CI success, physical-device testing, server authorization, filesystem resolution or production spending enforcement.
