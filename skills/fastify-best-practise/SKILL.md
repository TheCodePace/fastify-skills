---
name: fastify-best-practise
description: Apply Fastify best practices for servers, plugins, routes, database integration, testing, and architecture patterns. Use when writing or reviewing Fastify code, setting up a new Fastify project, or asking "How should I structure my Fastify app?"
---

# Fastify Best Practices

A curated set of rules and patterns for building production-ready Fastify applications. Each rule includes incorrect and correct examples with explanations.

## How It Works

1. The agent identifies that the user is working with Fastify or asking about Fastify patterns
2. The relevant rule file is loaded based on the topic (routes, validation, encapsulation, etc.)
3. The agent applies the best practices from the rule when generating or reviewing code

## Rules

The rules are organized by topic in the `rules/` directory. Each rule follows a consistent format with impact rating, incorrect/correct examples, and references to official docs.

| Rule                    | File                                                         | Impact     | Description                                                                   |
| ----------------------- | ------------------------------------------------------------ | ---------- | ----------------------------------------------------------------------------- |
| Create Server           | [create-server.md](rules/create-server.md)                   | LOW-MEDIUM | Use a `buildServer()` factory function for reusable, testable server setup    |
| Create Plugin           | [create-plugin.md](rules/create-plugin.md)                   | LOW-MEDIUM | Encapsulate reusable functionality in plugins with `fastify-plugin`           |
| Autoload                | [autoload.md](rules/autoload.md)                             | HIGH       | Automatically load plugins and routes from the filesystem with `@fastify/autoload` |
| Route Best Practices    | [route-best-practices.md](rules/route-best-practices.md)     | MEDIUM     | Organize routes with plugins/prefixes, use async handlers, full route options |
| Schema Validation (Zod) | [schema-validation-zod.md](rules/schema-validation-zod.md)   | HIGH       | Type-safe validation with Zod + `fastify-type-provider-zod`                   |
| Encapsulation           | [encapsulation.md](rules/encapsulation.md)                   | HIGH       | Proper scope isolation and when to use `fastify-plugin`                       |
| Error Handling          | [error-handling.md](rules/error-handling.md)                 | HIGH       | Custom error handlers, `@fastify/error`, 404 handling, structured responses   |
| Hooks & Lifecycle       | [hooks-lifecycle.md](rules/hooks-lifecycle.md)               | MEDIUM     | Request lifecycle hooks for auth, logging, rate limiting                      |
| Testing                 | [testing.md](rules/testing.md)                               | HIGH       | Test with `inject()`, buildServer pattern, vitest/node:test                   |
| TypeScript              | [typescript-integration.md](rules/typescript-integration.md) | MEDIUM     | Type providers, module augmentation, typed decorators                         |
| Database Integration    | [database-integration.md](rules/database-integration.md)     | HIGH       | Register pg/Drizzle/Prisma as a Fastify plugin with lifecycle management      |
| Database Migrations     | [database-migrations.md](rules/database-migrations.md)       | HIGH       | Run Drizzle/Prisma migrations at startup; never modify applied files          |
| Test Containers         | [test-containers.md](rules/test-containers.md)               | HIGH       | Spin up real Postgres containers with Testcontainers for integration tests    |
| Clean Architecture      | [clean-architecture.md](rules/clean-architecture.md)         | HIGH       | Pure service-layer functions + thin route handlers; explicit dependency injection |
| Unit Testing            | [unit-testing.md](rules/unit-testing.md)                     | HIGH       | Unit-test service functions in isolation with mock database stubs             |

## Usage

When generating Fastify code, read the relevant rule file(s) for the topic and apply the patterns shown. For a new project, all rules are relevant. For specific tasks, load only what's needed:

- **New project setup**: `create-server.md`, `autoload.md`, `encapsulation.md`, `typescript-integration.md`
- **Adding routes**: `route-best-practices.md`, `autoload.md`, `schema-validation-zod.md`
- **Adding shared services**: `create-plugin.md`, `autoload.md`, `encapsulation.md`
- **Error handling**: `error-handling.md`
- **Auth/middleware**: `hooks-lifecycle.md`, `encapsulation.md`
- **Writing tests**: `testing.md`, `create-server.md`
- **Database setup**: `database-integration.md`, `database-migrations.md`
- **Integration tests with a real DB**: `test-containers.md`, `testing.md`
- **Clean separation of concerns**: `clean-architecture.md`, `unit-testing.md`
- **Unit testing business logic**: `unit-testing.md`, `clean-architecture.md`

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
    schema.ts       # Drizzle/Prisma schema (source of truth)
    migrate.ts      # runMigrations() helper
  server.ts         # buildServer() with autoload registration
  app.ts            # Entry point — runMigrations() then server.listen()
drizzle/            # Generated migration SQL files (committed to git)
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
> - **Zod validation**: Request/response schemas with type inference
> - **Encapsulation**: Shared plugins use `fastify-plugin`, routes stay scoped
> - **Error handling**: Custom error handler with `@fastify/error`
> - **Database**: Client registered as a plugin with `fastify-plugin` for shared pool and lifecycle management
> - **Migrations**: Applied via `drizzle-kit migrate` / `prisma migrate deploy` before server starts
> - **Clean architecture**: Business logic in pure service functions; route handlers stay thin
> - **Unit tests**: Service functions tested in isolation with mock db stubs
> - **Integration tests**: Real Postgres container via Testcontainers

## Reference

- [Fastify Documentation](https://fastify.dev/docs/latest/)
- [Fastify GitHub](https://github.com/fastify/fastify)
- [Fastify Ecosystem](https://fastify.dev/ecosystem/)
- [@fastify/autoload](https://github.com/fastify/fastify-autoload)
