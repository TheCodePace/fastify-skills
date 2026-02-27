---
title: Type Providers
impact: HIGH
impactDescription: Automatic TypeScript inference from schemas, eliminating manual type definitions
tags: typescript, type-providers, typebox, json-schema-to-ts, zod, type-safety
---

## Type Providers

**Impact: HIGH (automatic TypeScript inference from schemas, eliminating manual type definitions)**

Fastify's Type Provider system is a TypeScript-only feature that lets the framework automatically infer request and reply types directly from inline schemas. This eliminates the need to manually maintain separate type definitions alongside every schema. Call `.withTypeProvider<T>()` on a Fastify instance to activate a provider — it returns a new typed instance that infers types from route schemas.

### What `.withTypeProvider<T>()` Does

**Incorrect (manual type casting, types and schemas drift apart):**

```ts
import Fastify from "fastify";

const server = Fastify();

server.get("/users/:id", async (request, reply) => {
  // Manual casting — no runtime guarantee, types can desync from schema
  const { id } = request.params as { id: string };
  const { page } = request.query as { page: number };
  return findUser(id, page);
});
```

**Correct (use `.withTypeProvider<T>()` for automatic inference):**

```ts
import Fastify from "fastify";
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from "fastify-type-provider-zod";
import { z } from "zod";

const server = Fastify();
server.setValidatorCompiler(validatorCompiler);
server.setSerializerCompiler(serializerCompiler);

// .withTypeProvider() returns a typed instance — use it for all route definitions
const app = server.withTypeProvider<ZodTypeProvider>();

app.get(
  "/users/:id",
  {
    schema: {
      params: z.object({ id: z.string().uuid() }),
      querystring: z.object({ page: z.coerce.number().default(1) }),
    },
  },
  async (request, reply) => {
    // Types are inferred automatically from the schema
    // request.params.id → string
    // request.query.page → number
    return findUser(request.params.id, request.query.page);
  },
);
```

### Setting Up TypeBox (`@fastify/type-provider-typebox`)

TypeBox uses a JSON Schema–compatible builder API. Schemas are valid JSON Schema objects and work natively with Fastify's built-in Ajv validator — no custom compiler is needed.

**Correct (TypeBox type provider setup):**

```ts
import Fastify from "fastify";
import { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import { Type } from "@sinclair/typebox";

const server = Fastify().withTypeProvider<TypeBoxTypeProvider>();

server.get(
  "/users/:id",
  {
    schema: {
      params: Type.Object({ id: Type.String({ format: "uuid" }) }),
      querystring: Type.Object({
        page: Type.Integer({ minimum: 1, default: 1 }),
        limit: Type.Integer({ minimum: 1, maximum: 100, default: 20 }),
      }),
      response: {
        200: Type.Object({
          id: Type.String({ format: "uuid" }),
          name: Type.String(),
          email: Type.String({ format: "email" }),
        }),
      },
    },
  },
  async (request, reply) => {
    // request.params.id → string
    // request.query.page → number
    // request.query.limit → number
    return findUser(request.params.id);
  },
);
```

### Setting Up json-schema-to-ts (`@fastify/type-provider-json-schema-to-ts`)

This provider infers TypeScript types from plain JSON Schema objects using the `json-schema-to-ts` library. Use it when you already have raw JSON Schema definitions.

**Correct (json-schema-to-ts type provider setup):**

```ts
import Fastify from "fastify";
import { JsonSchemaToTsProvider } from "@fastify/type-provider-json-schema-to-ts";

const server = Fastify().withTypeProvider<JsonSchemaToTsProvider>();

server.get(
  "/users/:id",
  {
    schema: {
      params: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
        },
        required: ["id"],
      } as const,
      querystring: {
        type: "object",
        properties: {
          page: { type: "integer", minimum: 1, default: 1 },
        },
      } as const,
      response: {
        200: {
          type: "object",
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            email: { type: "string" },
          },
          required: ["id", "name", "email"],
        } as const,
      },
    },
  },
  async (request, reply) => {
    // request.params.id → string
    // request.query.page → number | undefined
    return findUser(request.params.id);
  },
);
```

Mark all schema objects with `as const` so `json-schema-to-ts` can infer literal types correctly.

### Setting Up Zod (`fastify-type-provider-zod`)

Zod is a community provider (`fastify-type-provider-zod`). Unlike TypeBox and json-schema-to-ts, Zod schemas are not JSON Schema — so you must register custom validator and serializer compilers.

**Correct (Zod type provider setup):**

```ts
import Fastify from "fastify";
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from "fastify-type-provider-zod";
import { z } from "zod";

const server = Fastify();

// Required: Zod schemas are not JSON Schema, so custom compilers are needed
server.setValidatorCompiler(validatorCompiler);
server.setSerializerCompiler(serializerCompiler);

const app = server.withTypeProvider<ZodTypeProvider>();

app.post(
  "/users",
  {
    schema: {
      body: z.object({
        name: z.string().min(1),
        email: z.string().email(),
      }),
      response: {
        201: z.object({
          id: z.string().uuid(),
          name: z.string(),
          email: z.string(),
        }),
      },
    },
  },
  async (request, reply) => {
    // request.body.name → string
    // request.body.email → string
    const user = await createUser(request.body);
    reply.status(201);
    return user;
  },
);
```

### Scoped Type Providers

Different plugins can use different type providers. Each `.withTypeProvider()` call creates an isolated typed scope — the provider does not leak into sibling or parent scopes.

**Correct (different providers in different plugins):**

```ts
import Fastify from "fastify";
import { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from "fastify-type-provider-zod";
import { Type } from "@sinclair/typebox";
import { z } from "zod";

const server = Fastify();

// Plugin A uses TypeBox
server.register(async function pluginA(instance) {
  const app = instance.withTypeProvider<TypeBoxTypeProvider>();
  app.get(
    "/typebox-route",
    {
      schema: {
        response: {
          200: Type.Object({ message: Type.String() }),
        },
      },
    },
    async () => ({ message: "TypeBox" }),
  );
});

// Plugin B uses Zod
server.register(async function pluginB(instance) {
  instance.setValidatorCompiler(validatorCompiler);
  instance.setSerializerCompiler(serializerCompiler);
  const app = instance.withTypeProvider<ZodTypeProvider>();
  app.get(
    "/zod-route",
    {
      schema: {
        response: {
          200: z.object({ message: z.string() }),
        },
      },
    },
    async () => ({ message: "Zod" }),
  );
});
```

### Propagating Typed Instance into Plugin Functions

When writing route plugins, use the provider-specific plugin type (e.g., `FastifyPluginAsyncZod`, `FastifyPluginAsyncTypebox`) so the `fastify` argument is already typed — no manual `.withTypeProvider()` call needed.

**Incorrect (untyped `fastify` parameter in the plugin, routes lose inference):**

```ts
import { FastifyPluginAsync } from "fastify";
import { z } from "zod";

// FastifyPluginAsync has no type provider — schema types are not inferred
const routes: FastifyPluginAsync = async function (fastify) {
  fastify.get(
    "/users",
    {
      schema: {
        querystring: z.object({ page: z.coerce.number().default(1) }),
      },
    },
    async (request) => {
      // request.query is unknown — no inference
      return getUsers(request.query);
    },
  );
};

export default routes;
```

**Correct (use provider-specific plugin type for full inference):**

```ts
import { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";

// FastifyPluginAsyncZod types the fastify argument with ZodTypeProvider
const routes: FastifyPluginAsyncZod = async function (fastify) {
  fastify.get(
    "/users",
    {
      schema: {
        querystring: z.object({ page: z.coerce.number().default(1) }),
      },
    },
    async (request) => {
      // request.query.page → number (fully inferred)
      return getUsers(request.query.page);
    },
  );
};

export default routes;
```

The same pattern applies to TypeBox:

**Correct (TypeBox plugin type):**

```ts
import { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import { Type } from "@sinclair/typebox";

const routes: FastifyPluginAsyncTypebox = async function (fastify) {
  fastify.get(
    "/items",
    {
      schema: {
        querystring: Type.Object({
          page: Type.Integer({ minimum: 1, default: 1 }),
        }),
      },
    },
    async (request) => {
      // request.query.page → number (fully inferred)
      return getItems(request.query.page);
    },
  );
};

export default routes;
```

### Common Mistake: Using the Untyped Instance Inside a Scoped Plugin

When you call `.withTypeProvider()` on the outer instance and then pass the scoped `fastify` parameter into a registered plugin, the scoped argument is untyped. You must either call `.withTypeProvider()` again or use the provider-specific plugin type.

**Incorrect (scoped instance loses type provider):**

```ts
import Fastify from "fastify";
import {
  validatorCompiler,
  serializerCompiler,
  type ZodTypeProvider,
} from "fastify-type-provider-zod";
import { z } from "zod";

const server = Fastify();
server.setValidatorCompiler(validatorCompiler);
server.setSerializerCompiler(serializerCompiler);
const app = server.withTypeProvider<ZodTypeProvider>();

// The outer `app` is typed, but the `instance` argument is NOT
app.register(async function routes(instance) {
  instance.get(
    "/users",
    {
      schema: {
        querystring: z.object({ page: z.coerce.number().default(1) }),
      },
    },
    async (request) => {
      // request.query is NOT inferred — instance lost the type provider
      return getUsers(request.query);
    },
  );
});
```

**Correct (re-apply type provider or use typed plugin type):**

```ts
import Fastify from "fastify";
import {
  validatorCompiler,
  serializerCompiler,
  type ZodTypeProvider,
} from "fastify-type-provider-zod";
import { z } from "zod";

const server = Fastify();
server.setValidatorCompiler(validatorCompiler);
server.setSerializerCompiler(serializerCompiler);

// Option 1: Re-apply withTypeProvider inside the plugin
server.register(async function routes(instance) {
  const app = instance.withTypeProvider<ZodTypeProvider>();
  app.get(
    "/users",
    {
      schema: {
        querystring: z.object({ page: z.coerce.number().default(1) }),
      },
    },
    async (request) => {
      // request.query.page → number
      return getUsers(request.query.page);
    },
  );
});
```

Reference: [Fastify Type Providers](https://fastify.dev/docs/latest/Reference/Type-Providers/) | [Write a Type Provider](https://fastify.dev/docs/latest/Guides/Write-Type-Provider/) | [@fastify/type-provider-typebox](https://github.com/fastify/fastify-type-provider-typebox) | [@fastify/type-provider-json-schema-to-ts](https://github.com/fastify/fastify-type-provider-json-schema-to-ts) | [fastify-type-provider-zod](https://github.com/turkerdev/fastify-type-provider-zod)
