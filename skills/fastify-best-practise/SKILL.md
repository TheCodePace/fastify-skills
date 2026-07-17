---
name: fastify-best-practise
description: Apply Fastify best practices when creating servers, plugins, routes, schemas, hooks, configuration, decorators, authentication, logging, performance tuning, database integration, migrations, testing, clean architecture, and TypeScript integration. Use when writing or reviewing Fastify code, setting up a new Fastify project, or asking "How should I structure my Fastify app?"
---

# Fastify Best Practices

A curated set of rules and patterns for building production-ready Fastify applications. Each rule includes incorrect and correct examples with explanations.

## How It Works

1. The agent identifies that the user is working with Fastify or asking about Fastify patterns
2. The relevant rule file is loaded based on the topic (routes, validation, encapsulation, etc.)
3. The agent applies the best practices from the rule when generating or reviewing code

## Rules

The rules are organized by topic in the `rules/` directory. Each rule follows a consistent format with impact rating, incorrect/correct examples, and references to official docs.

| Rule                    | File                                                         | Impact     | Description                                                                                                                                                        |
| ----------------------- | ------------------------------------------------------------ | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Configuration           | [configuration.md](rules/configuration.md)                   | HIGH       | Environment config, logger setup, security options, and graceful shutdown                                                                                          |
| Create Server           | [create-server.md](rules/create-server.md)                   | LOW-MEDIUM | Use a `buildServer()` factory function for reusable, testable server setup                                                                                         |
| Create Plugin           | [create-plugin.md](rules/create-plugin.md)                   | LOW-MEDIUM | Encapsulate reusable functionality in plugins with `fastify-plugin`                                                                                                |
| Autoload                | [autoload.md](rules/autoload.md)                             | HIGH       | Automatically load plugins and routes from the filesystem with `@fastify/autoload`                                                                                 |
| Route Best Practices    | [route-best-practices.md](rules/route-best-practices.md)     | MEDIUM     | Organize routes with plugins/prefixes, use async handlers, full route options                                                                                      |
| Schema Validation (Zod) | [schema-validation-zod.md](rules/schema-validation-zod.md)   | HIGH       | Type-safe validation with Zod + `fastify-type-provider-zod`                                                                                                        |
| Serialization (Zod)     | [serialization-zod.md](rules/serialization-zod.md)           | HIGH       | Type-safe response serialization with Zod schemas, output validation, and compatibility notes                                                                      |
| Encapsulation           | [encapsulation.md](rules/encapsulation.md)                   | HIGH       | Proper scope isolation and when to use `fastify-plugin`                                                                                                            |
| Error Handling          | [error-handling.md](rules/error-handling.md)                 | HIGH       | Custom error handlers, `@fastify/error`, 404 handling, structured responses                                                                                        |
| Hooks & Lifecycle       | [hooks-lifecycle.md](rules/hooks-lifecycle.md)               | MEDIUM     | All request/reply and application hooks: onRequest, preParsing, preValidation, preHandler, preSerialization, onError, onSend, onResponse, onReady, onClose         |
| Logging                 | [logging.md](rules/logging.md)                               | HIGH       | Built-in Pino logger, request correlation, redaction, child loggers                                                                                                |
| Authentication          | [authentication.md](rules/authentication.md)                 | HIGH       | JWT auth with `@fastify/jwt`, multi-strategy with `@fastify/auth`                                                                                                  |
| Testing                 | [testing.md](rules/testing.md)                               | HIGH       | Test with `inject()`, buildServer pattern, vitest/node:test                                                                                                        |
| TypeScript              | [typescript-integration.md](rules/typescript-integration.md) | MEDIUM     | Type providers, module augmentation, typed decorators                                                                                                              |
| Decorators              | [decorators.md](rules/decorators.md)                         | MEDIUM     | Extend the Fastify instance, request, and reply with `decorate` / `decorateRequest` / `decorateReply`                                                              |
| Content Type Parser     | [content-type-parser.md](rules/content-type-parser.md)       | HIGH       | Custom content type parsers, body limits, multipart uploads, catch-all and regex matching                                                                          |
| Multipart & File Uploads | [multipart.md](rules/multipart.md)                          | HIGH       | File uploads with `@fastify/multipart`, streaming, size limits, MIME validation                                                                                    |
| WebSockets               | [websockets.md](rules/websockets.md)                         | HIGH       | Real-time bidirectional connections with `@fastify/websocket`, lifecycle handling, broadcasting, and authentication                                                              |
| HTTP Proxy               | [http-proxy.md](rules/http-proxy.md)                         | HIGH       | API gateway / BFF patterns with `@fastify/http-proxy` and `@fastify/reply-from`, auth hooks, error handling, multi-upstream routing                                            |
| Type Providers           | [type-providers.md](rules/type-providers.md)                 | HIGH       | Compare TypeBox, `json-schema-to-ts`, and Zod providers; `.withTypeProvider<T>()`; scoped providers in plugins; provider-specific plugin types                                          |
| Deployment               | [deployment.md](rules/deployment.md)                         | HIGH       | Graceful shutdown with `close-with-grace`, liveness/readiness probes, listen on `0.0.0.0`, `trustProxy`, multi-stage Dockerfile, AWS Lambda adapter            |
| HTTP/2                   | [http2.md](rules/http2.md)                                   | MEDIUM     | Enable HTTP/2 over TLS (`h2`) with HTTP/1.1 fallback, or plain-text `h2c` for internal services; typed `buildServer` factory                                              |
| CORS & Security Headers  | [cors-security.md](rules/cors-security.md)                   | HIGH       | `@fastify/cors` allow-list (static and dynamic), `@fastify/helmet` CSP/HSTS, registration order, combined security plugin                            |
| Delay Accepting Requests | [delay-accepting-requests.md](rules/delay-accepting-requests.md) | HIGH   | Reject requests with 503 until dependencies are ready; liveness vs. readiness probes for Kubernetes                                                  |
| Database Integration    | [database-integration.md](rules/database-integration.md)     | HIGH       | Register a `pg` pool as a Fastify plugin; use `@nearform/sql` for safe queries                                                                                     |
| Database Migrations     | [database-migrations.md](rules/database-migrations.md)       | HIGH       | Run Postgrator SQL migrations at startup; never modify applied files                                                                                               |
| Test Containers         | [test-containers.md](rules/test-containers.md)               | HIGH       | Spin up real Postgres containers with Testcontainers for integration tests                                                                                         |
| Clean Architecture      | [clean-architecture.md](rules/clean-architecture.md)         | HIGH       | Pure service-layer functions + thin route handlers; explicit dependency injection                                                                                  |
| Unit Testing            | [unit-testing.md](rules/unit-testing.md)                     | HIGH       | Unit-test service functions in isolation with mock database stubs                                                                                                  |
| Performance             | [performance.md](rules/performance.md)                       | HIGH       | Schema pre-compilation, serialization, load shedding, streaming, benchmarking                                                                                      |
| Rate Limiting           | [rate-limiting.md](rules/rate-limiting.md)                   | HIGH       | Protect APIs with `@fastify/rate-limit`, per-route overrides, Redis store, custom keys                                                                             |
| Serialization           | [serialization.md](rules/serialization.md)                   | HIGH       | Response serialization with JSON Schema and `fast-json-stringify`                                                                                                  |

## Usage

When generating Fastify code, read the relevant rule file(s) for the topic and apply the patterns shown. For a new project, all rules are relevant. For specific tasks, load only what's needed:

- **New project setup**: `create-server.md`, `configuration.md`, `autoload.md`, `encapsulation.md`, `typescript-integration.md`
- **Adding routes**: `route-best-practices.md`, `autoload.md`, `schema-validation-zod.md`, `serialization-zod.md`, `serialization.md`
- **Adding shared services**: `create-plugin.md`, `autoload.md`, `encapsulation.md`
- **Configuration/environment**: `configuration.md`
- **Error handling**: `error-handling.md`
- **Auth/middleware**: `authentication.md`, `hooks-lifecycle.md`, `encapsulation.md`
- **Rate limiting**: `rate-limiting.md`, `hooks-lifecycle.md`
- **Custom decorators**: `decorators.md`, `typescript-integration.md`
- **Logging**: `logging.md`
- **Body parsing/file uploads**: `content-type-parser.md`, `multipart.md`
- **Schema / type providers**: `schema-validation-zod.md`, `serialization-zod.md`, `serialization.md`, `type-providers.md`
- **HTTP/2 / TLS**: `http2.md`, `configuration.md`
- **CORS / security headers**: `cors-security.md`, `rate-limiting.md`
- **Production deployment**: `deployment.md`, `delay-accepting-requests.md`, `configuration.md`
- **Real-time / WebSockets**: `websockets.md`, `authentication.md`, `hooks-lifecycle.md`
- **API gateway / proxying**: `http-proxy.md`, `hooks-lifecycle.md`, `error-handling.md`
- **Startup / health checks**: `delay-accepting-requests.md`, `hooks-lifecycle.md`, `configuration.md`
- **Performance tuning**: `performance.md`, `schema-validation-zod.md`
- **Writing tests**: `testing.md`, `create-server.md`
- **Database setup**: `database-integration.md`, `database-migrations.md`
- **Integration tests with a real DB**: `test-containers.md`, `testing.md`
- **Clean separation of concerns**: `clean-architecture.md`, `unit-testing.md`
- **Unit testing business logic**: `unit-testing.md`, `clean-architecture.md`
- **Response serialization**: `serialization.md`, `serialization-zod.md`, `schema-validation-zod.md`

## Recommended Project Structure

Using `@fastify/autoload`, plugins and routes are loaded automatically from their directories:

```
src/
  plugins/          # Autoloaded — shared plugins (use fastify-plugin)
    db.ts           # Database client (pg/Drizzle/Prisma) + lifecycle
    auth.ts
    config.ts
  routes/           # Autoloaded — encapsulated route plugins (NO fastify-plugin)
    _hooks.ts       # Global route hooks (with autoHooks: true)
    users/
      index.ts      # → /users  (thin handler — calls services/users.ts)
      _hooks.ts     # Hooks for /users scope only
      schema.ts     # Zod schemas
    posts/
      index.ts      # → /posts
      schema.ts
  services/         # Pure business logic — no Fastify imports, injectable deps
    users.ts
    posts.ts
  db/
    migrate.ts      # runMigrations() helper (uses Postgrator)
  server.ts         # buildServer() with autoload registration
  app.ts            # Entry point — runMigrations() then server.listen()
migrations/         # Raw SQL files (committed to git): 001.do.*.sql, 001.undo.*.sql
test/
  services/
    users.test.ts   # Unit tests — pure functions, mock db
  routes/
    users.test.ts   # Integration tests — inject() + real schema
  helpers/
    server.ts       # createTestServer() / createIntegrationServer()
    db.ts           # startTestDatabase() via Testcontainers
```

## Present Results to User

When applying these best practices, mention which rule(s) you followed:

> Applied Fastify best practices:
>
> - **Route organization**: Routes grouped by resource with prefixes
> - **Zod validation and serialization**: Request/response schemas with type inference and output validation
> - **Encapsulation**: Shared plugins use `fastify-plugin`, routes stay scoped
> - **Error handling**: Custom error handler with `@fastify/error`
> - **Performance**: Response schemas, shared schema references, load shedding, streaming, and benchmark guidance
> - **Database**: Client registered as a plugin with `fastify-plugin` for shared pool and lifecycle management
> - **Migrations**: Applied via Postgrator (`runMigrations()`) before server starts; raw SQL files tracked in git
> - **Clean architecture**: Business logic in pure service functions; route handlers stay thin
> - **Unit tests**: Service functions tested in isolation with mock db stubs
> - **Integration tests**: Real Postgres container via Testcontainers

## Reference

- [Fastify Documentation](https://fastify.dev/docs/latest/)
- [Fastify GitHub](https://github.com/fastify/fastify)
- [Fastify Ecosystem](https://fastify.dev/ecosystem/)
- [@fastify/autoload](https://github.com/fastify/fastify-autoload)
