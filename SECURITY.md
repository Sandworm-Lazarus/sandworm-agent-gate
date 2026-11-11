# Security

Agent Gate is a local simulation and test harness, not authorization middleware. See [docs/THREAT_MODEL.md](docs/THREAT_MODEL.md) before adapting it to a live agent.

Please do not include real credentials, personal data, raw prompts, or private paths in public issues. Use a minimal synthetic fixture, expected decision and observed decision. Avoid sharing private input hashes when their contents are guessable.

The project has no remote execution or upload integration. Supported input boundaries and privacy behavior are covered by the local automated tests, not a security certification.
