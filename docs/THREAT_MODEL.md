# Threat model — Agent Gate 0.1.0

## Purpose and trust boundary

This is a browser-local/Node policy simulator. It evaluates user-supplied JSON, never executes tool calls, and cannot confer real authority. Its UI, imported data, and policy are all controlled by the local user. Anyone can change the JavaScript or policy. It must not be relied on as an enforcement boundary between an attacker and privileged tools.

## Controls implemented

- Network access is absent from application code; CSP blocks `connect-src` and form submission. Fonts/assets are local. GitHub links navigate only when clicked.
- No local/session storage, cookies, telemetry, or automatic API integrations.
- Text-only rendering (`textContent` and form values); no untrusted HTML injection or dynamic code evaluation.
- Byte/count/depth budgets bound JSON parsing and policy evaluation. Decoded duplicate object keys and `__proto__`, `constructor`, `prototype` keys are rejected before native parsing.
- Invalid policies reject the entire audit. Malformed call objects, unknown tool/action/resource/cost shapes, and duplicate call IDs fail closed.
- Resource matching accepts a narrow canonical ASCII path language. No decoding means double-encoded traversal is rejected rather than normalized incorrectly. Prefix matches require segment boundaries.
- Explicit deny precedes allow. Every permitted write yields review. There is no in-app approval bypass.
- Export omits raw tool names, IDs, paths, and arguments. Error strings do not include original input or filesystem paths. Editing or clearing input invalidates pending and completed audits.

## Remaining risks and exclusions

- No authentication, object ownership model, signed approvals, tool execution, MCP integration, network sandbox, or production middleware is included.
- Argument contents are not semantically evaluated. An allowlisted tool could still be dangerous with malicious arguments in a real system.
- Paths are lexical values, not actual files. Symlinks, case-insensitive filesystems, mount points, URL paths and non-ASCII names are outside this model.
- Cost values are estimates supplied by the caller. The engine checks per-call thresholds only; it cannot validate prices or enforce cumulative spending.
- Hashes reveal equality and can be guessed for low-entropy secrets. Sanitized audit is not guaranteed anonymous; inspect before sharing.
- Browser extensions, clipboard/OS tools, screen captures, compromised dependencies/runtime, and a malicious hosting operator can still observe or change local inputs.
- Clearing the UI is not guaranteed memory erasure. Source text exists in browser memory until collected; no secure deletion claim is made.
- Node CLI follows normal OS filesystem semantics for the paths explicitly supplied by its user. Do not offer the CLI as a service accepting untrusted file paths.

## Intended production use

Use fixtures to test a separately implemented server-side boundary. Authenticate the principal, validate each tool's schema, enforce object ownership and canonical resource resolution, bind approvals to immutable calls and an authenticated approver, recheck policy at execution, and record safe audit events. The demonstration is a starting point for deterministic tests, not evidence that those controls are deployed.
