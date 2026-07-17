---
"@thecodepace/fastify-skills": minor
---

Add Delay Accepting Requests rule covering the decorator flag + onRequest hook pattern, explicit `fastify.ready()` sequencing, separate liveness/readiness probes for Kubernetes, and a reusable `fastify-plugin` wrapper. 503 responses include a `Retry-After` header for orchestrator-friendly behavior