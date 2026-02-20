---
"@thecodepace/fastify-skills": minor
---

Add database integration, migrations, test containers, clean architecture, and unit testing rules

- `database-integration.md`: Register a `pg` pool as a Fastify plugin; use `@nearform/sql` for injection-safe queries with tagged template literals
- `database-migrations.md`: Manage schema changes with Postgrator (plain SQL files); run migrations before `server.listen()`
- `test-containers.md`: Spin up real Postgres containers with Testcontainers for isolated integration tests
- `clean-architecture.md`: Pure service-layer functions + thin route handlers with explicit dependency injection
- `unit-testing.md`: Unit-test service functions in isolation using mock database stubs (vitest and node:test examples)
