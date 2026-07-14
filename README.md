# Fastify Skills

A collection of skills for AI coding agents ([Claude Code](https://docs.anthropic.com/en/docs/agents-and-tools/claude-code/overview), [Copilot](https://github.com/features/copilot), [Cursor](https://www.cursor.com/), etc.) to help you build production-ready [Fastify](https://fastify.dev/) applications following best practices.

Skills follow the [Agent Skills](https://agentskills.io/) format.

## Available Skills

### fastify-best-practise

Apply Fastify best practices when creating servers, plugins, routes, schemas, hooks, configuration, decorators, authentication, logging, performance tuning, database integration, migrations, testing, clean architecture, and TypeScript integration.

| Rule                    | Impact     | Description                                                                                                                   |
| ----------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Configuration           | HIGH       | Environment config, logger setup, security options, and graceful shutdown                                                     |
| Create Server           | LOW-MEDIUM | Use a `buildServer()` factory function for reusable, testable server setup                                                    |
| Create Plugin           | LOW-MEDIUM | Encapsulate reusable functionality in plugins with `fastify-plugin`                                                           |
| Autoload                | HIGH       | Automatically load plugins and routes with `@fastify/autoload`                                                                |
| Route Best Practices    | MEDIUM     | Organize routes with plugins/prefixes, async handlers, full route options                                                     |
| Schema Validation (Zod) | HIGH       | Type-safe validation with Zod + `fastify-type-provider-zod`                                                                   |
| Serialization (Zod)     | HIGH       | Type-safe response serialization with Zod schemas, output validation, and compatibility notes                                  |
| Encapsulation           | HIGH       | Proper scope isolation and when to use `fastify-plugin`                                                                       |
| Error Handling          | HIGH       | Custom error handlers, `@fastify/error`, `@fastify/sensible`, 404 handling                                                    |
| Hooks & Lifecycle       | MEDIUM     | Full lifecycle hook coverage: request pipeline (`onRequest` → `onResponse`), application hooks (`onReady`, `onClose`), scoped hooks |
| Logging                 | HIGH       | Built-in Pino logger, request correlation, redaction, child loggers                                                           |
| Authentication          | HIGH       | JWT auth with `@fastify/jwt`, multi-strategy with `@fastify/auth`                                                             |
| Testing                 | HIGH       | Test with `inject()`, buildServer pattern, vitest/node:test                                                                   |
| TypeScript              | MEDIUM     | Type providers, module augmentation, typed decorators                                                                         |
| Decorators              | MEDIUM     | Extend the Fastify instance, request, and reply with `decorate` / `decorateRequest` / `decorateReply`                         |
| Content Type Parser     | HIGH       | Custom content type parsers, body limits, multipart uploads, catch-all and regex matching                                     |
| Multipart & File Uploads | HIGH      | File uploads with `@fastify/multipart`, streaming, size limits, MIME validation                                              |
| Database Integration    | HIGH       | Register a shared `pg` pool as a Fastify plugin; use `@nearform/sql` for safe queries                                         |
| Database Migrations     | HIGH       | Manage schema changes with Postgrator; run migrations before `server.listen()`                                                |
| Test Containers         | HIGH       | Spin up real Postgres containers with Testcontainers for isolated integration tests                                           |
| Clean Architecture      | HIGH       | Pure service-layer functions + thin route handlers; explicit dependency injection                                             |
| Unit Testing            | HIGH       | Unit-test service functions in isolation with mock database stubs                                                             |
| Performance             | HIGH       | Schema pre-compilation, serialization, load shedding, streaming, benchmarking                                                 |
| Rate Limiting           | HIGH       | Protect APIs with `@fastify/rate-limit`, per-route overrides, Redis store, custom keys                                        |
| Serialization           | HIGH       | Response serialization with JSON Schema and `fast-json-stringify`                                                             |

## Installation

```bash
npx skills add TheCodePace/fastify-skills
```

## Usage

Skills are automatically available once installed. The agent will use them when relevant tasks are detected.

**Examples:**

- "Create a new Fastify server with routes and plugins"
- "Add a users REST API with Zod validation"
- "How should I structure my Fastify app?"
- "Write tests for my Fastify routes"
- "Integrate a PostgreSQL database into my Fastify app"
- "Set up database migrations with Postgrator"
- "How do I separate business logic from route handlers?"

Each skill contains:

- `SKILL.md` — Instructions for the agent
- `rules/` — Best practice rules organized by topic

## License

MIT
