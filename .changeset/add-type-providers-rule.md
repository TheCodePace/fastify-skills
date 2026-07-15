---
"@thecodepace/fastify-skills": minor
---

Add Type Providers rule comparing the three main TypeScript providers for Fastify: `@fastify/type-provider-typebox` (JSON Schema builder), `@fastify/type-provider-json-schema-to-ts` (raw JSON Schema with `as const`), and `fastify-type-provider-zod` (Zod schemas with custom compilers). Covers `.withTypeProvider<T>()`, scoped providers across plugins, provider-specific plugin types (`FastifyPluginAsyncZod`, `FastifyPluginAsyncTypebox`), and the common pitfall of type providers not propagating into scoped plugin instances