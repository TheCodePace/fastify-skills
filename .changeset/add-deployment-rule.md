---
"@thecodepace/fastify-skills": minor
---

Add Deployment rule covering graceful shutdown with `close-with-grace`, liveness and readiness endpoints, listening on `0.0.0.0` for containers, secure `trustProxy` behind load balancers (specific IPs/CIDRs, never `true`), multi-stage Dockerfile with non-root user and healthcheck, and AWS Lambda adapter with `@fastify/aws-lambda`