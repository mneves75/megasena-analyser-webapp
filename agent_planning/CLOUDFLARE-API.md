# Runtime-neutral API extraction

Failure inventory before implementation:
- Importing the handler must not start a listener, migrations, timers, or filesystem reads.
- Instances must not share rate-limit or response-cache state.
- Public internal-request headers must not exempt requests; trusted visitor metadata still consumes quota.
- Health, OPTIONS, unknown paths, and invalid methods retain security headers and the public quota.
- Production construction must reject missing or short HMAC secrets before serving requests.
- Audit and log buffers must belong to the object that writes them; failed drains must propagate.
- Bun startup, retention, shutdown, and all endpoint contracts remain compatible.

Validation starts with factory-entry regression tests before extraction. Worker integration and full gates belong to the integrator.

Completed:
- Shared API extraction preserves Bun startup and shutdown; factory owns quota/cache state.
- Per-object writer factories and request-scoped log context prevent cross-object persistence.
- Browser-bundle execution rejects accidental server-only imports in the shared logger.
- Workerd rejected manual writer transaction SQL. Writers now use the explicit runtime transaction adapter.
- Transaction failure controls prove rollback and retained-batch retry for audit and logs.
- Focused validation: nine test files, 23 passing cases; owned-file lint passes.
- Actual workerd fixture confirms seeded health returns 200 and audit/log rows persist.

Full repository gates and production preview verification remain with the integrator.
