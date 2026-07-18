# @thecodepace/fastify-skills

## 0.2.0

### Minor Changes

- 72432da: Add authentication rule for Fastify with @fastify/jwt and @fastify/auth patterns
- ae3b0b8: Add configuration best practices rule with Zod env schema, buildServer factory, and close-with-grace shutdown
- f024b23: Add Content Type Parser best-practice rule covering custom content type parsers, body size limits, multipart uploads with `@fastify/multipart`, catch-all parsers, regex matching, stream processing, and custom JSON parser error handling.
- 9c90ec7: Add CORS & Security Headers rule covering `@fastify/cors` (static and dynamic origin allow-list, supports string and RegExp origins), `@fastify/helmet` with Content-Security-Policy directives, registration order (security plugins before route plugins), minimal rate limiting example, and a `fastify-plugin` wrapper that composes all three
- b35a35e: Add Fastify Decorators best-practice rule covering `decorate`, `decorateRequest`, `decorateReply`, null initialisation for object decorators, getter/setter syntax, existence guards, TypeScript module augmentation, and plugin encapsulation.
- 38d9ea0: Add Delay Accepting Requests rule covering the decorator flag + onRequest hook pattern, explicit `fastify.ready()` sequencing, separate liveness/readiness probes for Kubernetes, and a reusable `fastify-plugin` wrapper. 503 responses include a `Retry-After` header for orchestrator-friendly behavior
- 88bbc7c: Add Deployment rule covering graceful shutdown with `close-with-grace`, liveness and readiness endpoints, listening on `0.0.0.0` for containers, secure `trustProxy` behind load balancers (specific IPs/CIDRs, never `true`), multi-stage Dockerfile with non-root user and healthcheck, and AWS Lambda adapter with `@fastify/aws-lambda`
- adbcd2f: Add comprehensive Fastify hooks rule covering all 15 hooks from the official documentation: request/reply hooks (`onRequest`, `preParsing`, `preValidation`, `preHandler`, `preSerialization`, `onError`, `onSend`, `onResponse`, `onTimeout`, `onRequestAbort`) and application hooks (`onReady`, `onListen`, `onClose`, `onRoute`, `onRegister`), with annotated lifecycle diagram, correct/incorrect examples, hook scoping guidance, route-level hooks, and async vs callback style.
- 008d5c4: Add HTTP Proxy rule covering `@fastify/http-proxy` for full prefix proxying, `@fastify/reply-from` for `reply.from()` with header rewrites and per-request options, `preHandler` auth with proper short-circuit, multi-upstream API gateway patterns, WebSocket proxying, timeout configuration, and inject() tests
- ae49cad: Add HTTP/2 Support rule covering TLS `h2` with HTTP/1.1 fallback, plain-text `h2c` for internal services behind a reverse proxy or service mesh, a typed `buildServer` factory, self-signed certificate generation for local development, and known limitations (no server push, `request.raw` for HTTP/2-specific APIs)
- bf1c47d: Add Fastify logging best-practice rule covering the built-in Pino logger, environment-aware log levels, pretty-printing in development, sensitive field redaction, custom serializers, child loggers for request context, per-route log suppression, and log level guidance.
- 58e9ab8: Add multipart & file uploads rule covering `@fastify/multipart` plugin setup, streaming uploads, per-route size limits, MIME/extension validation, mixed form fields, and inject() tests
- af518c3: Add Fastify performance optimization rule covering response schema usage for fast-json-stringify, schema pre-compilation with addSchema and $ref, load shedding with @fastify/under-pressure, streaming large responses, avoiding event-loop blocking, payload limits and timeouts, disabling unnecessary features, response compression, and benchmarking with autocannon.
- e3e8351: Add rate-limiting rule covering global rate limiting, per-route overrides, Redis-backed stores, custom key generators, custom error responses, and health route exemptions
- 30d2b3d: Add response serialization rule covering JSON Schema with fast-json-stringify
- 6feced2: Add a serialization-zod rule covering end-to-end request validation and response serialization with `fastify-type-provider-zod`, schema reuse, migration from raw JSON Schema to Zod schemas, accurate runtime compiler behavior, version compatibility, and strict-mode guidance.
- 3a584e3: Add Type Providers rule comparing the three main TypeScript providers for Fastify: `@fastify/type-provider-typebox` (JSON Schema builder), `@fastify/type-provider-json-schema-to-ts` (raw JSON Schema with `as const`), and `fastify-type-provider-zod` (Zod schemas with custom compilers). Covers `.withTypeProvider<T>()`, scoped providers across plugins, provider-specific plugin types (`FastifyPluginAsyncZod`, `FastifyPluginAsyncTypebox`), and the common pitfall of type providers not propagating into scoped plugin instances
- a693a93: Add WebSockets rule covering `@fastify/websocket` plugin setup, route handlers with `websocket: true`, connection lifecycle and cleanup, broadcasting across clients, JWT authentication via `preValidation`, and `injectWS` testing
- 33adeac: Add database integration, migrations, test containers, clean architecture, and unit testing rules

  - `database-integration.md`: Register a `pg` pool as a Fastify plugin; use `@nearform/sql` for injection-safe queries with tagged template literals
  - `database-migrations.md`: Manage schema changes with Postgrator (plain SQL files); run migrations before `server.listen()`
  - `test-containers.md`: Spin up real Postgres containers with Testcontainers for isolated integration tests
  - `clean-architecture.md`: Pure service-layer functions + thin route handlers with explicit dependency injection
  - `unit-testing.md`: Unit-test service functions in isolation using mock database stubs (vitest and node:test examples)

- f05e857: Replace ESLint and `typescript-eslint` with `oxlint` (lint) and `oxfmt` (format). Removes `eslint`, `@eslint/js`, `@eslint/markdown`, `globals`, `typescript-eslint`, and `jiti` from devDependencies. Adds `oxlint` and `oxfmt`. Adds `.oxlintrc.json` (correctness + suspicious categories, with allowlists for `__dirname` / `__filename` and `no-await-in-loop`) and `.oxfmtrc.json` (Prettier-compatible defaults, print width 100, single-quote off, trailing commas all, embedded language formatting auto; ignores `.changeset/*.md` and `CHANGELOG.md` so `@changesets/cli` output is left untouched). `pnpm lint` runs `oxlint`, `pnpm lint:fix` runs `oxlint --fix`, and new `pnpm format` / `pnpm format:check` run `oxfmt`. Pre-commit lefthook now runs oxlint and oxfmt in parallel. CI gains a format check step.

### Patch Changes

- dcd278d: Maintain GitHub Actions and CI configuration:

  - Bump GitHub Actions to latest major versions in `.github/workflows/ci.yaml` and `.github/workflows/release.yml`:
    - `actions/checkout` v6 → v7 (ESM, dep upgrades, blocks fork PR checkout for `pull_request_target`/`workflow_run`)
    - `actions/setup-node` v6 → v7 (ESM, dep upgrades, new `cache-primary-key`/`cache-matched-key` outputs)
    - `pnpm/action-setup` v4 → v6 (Node 24 runtime, pnpm v11 support; still honors the pinned `pnpm@10.30.1` from `package.json`)
  - Fix the Release workflow, which was previously failing with "Unable to locate executable file: pnpm" by inserting the `pnpm/action-setup` step before `actions/setup-node`, matching the CI workflow.
  - Extend `.github/dependabot.yml` with a `github-actions` ecosystem entry (weekly schedule) and mirror the existing `patch-and-minor` / `major` grouping so `.github/workflows/automerge.yml` keeps handling action PRs without modification.

- 84fac89: Pin `typescript` catalog version back to `^6.0.3` so `typescript-eslint@8.63.0` can resolve the runtime TypeScript API. The previous bump to `typescript@7.0.2` changed the package's `exports` map so `require("typescript")` no longer exposes `Extension`, which crashed `pnpm lint` with `TypeError: Cannot read properties of undefined (reading 'Cjs')`.

## 0.1.0

### Minor Changes

- 0c24ac7: Init Fastify Skills
