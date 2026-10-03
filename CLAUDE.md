@AGENTS.md

Architecture and acceptance requirements are owned by AGENTS.md and docs/DEPLOY.md.
Those documents distinguish Worker production/staging from the Docker recovery path.
Keep deployment status, account identifiers and operational evidence in private,
untracked storage. This repository contains generic procedures and public product
documentation only.

## Claude Code

For visible UI changes, use the Argent Chromium skills to verify interaction, layout, accessibility, and console output in the running app. Follow the UI gate in AGENTS.md.

Search discovery and measurement follow docs/CHATGPT-SEARCH.md. Preserve the
privacy and crawler invariants owned by AGENTS.md.

Dependency audits must follow the local patch regression gate owned by
AGENTS.md and docs/SECURITY.md.
