---
"@thecodepace/fastify-skills": minor
---

Add HTTP/2 Support rule covering TLS `h2` with HTTP/1.1 fallback, plain-text `h2c` for internal services behind a reverse proxy or service mesh, a typed `buildServer` factory, self-signed certificate generation for local development, and known limitations (no server push, `request.raw` for HTTP/2-specific APIs)