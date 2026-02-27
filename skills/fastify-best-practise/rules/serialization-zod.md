---
title: Response Serialization with Zod
impact: HIGH
impactDescription: Ensures type-safe, schema-validated response output with zero manual casting and fast serialization via fast-json-stringify
tags: serialization, zod, schema, type-safety, response, migration, fastify-type-provider-zod
---

## Response Serialization with Zod

`fastify-type-provider-zod` bridges Zod schemas with Fastify's built-in validation and serialization pipeline. Under the hood, validation still runs through AJV (Zod schemas are converted at runtime) and serialization still uses `fast-json-stringify` (response schemas are compiled to fast serializers). This means you get full TypeScript inference without giving up Fastify's raw performance.

### How Validation and Serialization Work Under the Hood

When you call `server.setValidatorCompiler(validatorCompiler)` and `server.setSerializerCompiler(serializerCompiler)`:

1. **Request validation**: Zod's `parse()` runs on `body`, `params`, `querystring`, and `headers` before the handler is called. On failure, Fastify returns a `400` error automatically.
2. **Response serialization**: The Zod response schema is compiled to a `fast-json-stringify` serializer at startup. Extra fields are stripped and types are coerced, giving you both safety and speed.
3. **Type inference**: `withTypeProvider<ZodTypeProvider>()` wires the inferred TypeScript types from each schema directly into `request.body`, `request.params`, etc.

### Serialization Setup

**Incorrect (no serializer compiler — response is `JSON.stringify`-only, no stripping):**

```ts
import Fastify from "fastify";
import { z } from "zod";

const server = Fastify();

// Only validator is set — serialization is untyped
server.post("/users", async (request, reply) => {
  const body = request.body as { name: string };
  const user = await createUser(body.name);
  // Extra sensitive fields (e.g., passwordHash) could leak into the response
  return user;
});
```

**Correct (register both compilers for validated input and serialized output):**

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
server.setSerializerCompiler(serializerCompiler); // enables fast-json-stringify for Zod schemas

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
          // passwordHash is NOT listed here — it will be stripped from the response
        }),
      },
    },
  },
  async (request, reply) => {
    const user = await createUser(request.body);
    reply.status(201);
    return user; // extra fields are stripped by the serializer
  },
);
```

### Migrating from Raw JSON Schema to Zod

**Incorrect (raw JSON Schema — no TypeScript inference, verbose, error-prone):**

```ts
server.post(
  "/items",
  {
    schema: {
      body: {
        type: "object",
        required: ["name", "price"],
        properties: {
          name: { type: "string", minLength: 1 },
          price: { type: "number", minimum: 0 },
        },
        additionalProperties: false,
      },
      response: {
        201: {
          type: "object",
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            price: { type: "number" },
          },
        },
      },
    },
  },
  async (request, reply) => {
    const body = request.body as { name: string; price: number }; // manual cast
    const item = await createItem(body.name, body.price);
    reply.status(201);
    return item;
  },
);
```

**Correct (Zod schemas — inferred types, composable, no manual casts):**

```ts
import { serializerCompiler, validatorCompiler, type ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";

server.setValidatorCompiler(validatorCompiler);
server.setSerializerCompiler(serializerCompiler);

const app = server.withTypeProvider<ZodTypeProvider>();

const itemSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  price: z.number(),
});

app.post(
  "/items",
  {
    schema: {
      body: z.object({
        name: z.string().min(1),
        price: z.number().nonnegative(),
      }),
      response: {
        201: itemSchema,
      },
    },
  },
  async (request, reply) => {
    // request.body is fully typed — no cast needed
    const item = await createItem(request.body.name, request.body.price);
    reply.status(201);
    return item;
  },
);
```

### Known Limitations

**Zod v4 support**: `fastify-type-provider-zod` targets **Zod v3**. Zod v4 introduced a new internal API (`z.core`) and is not yet fully supported. Pin your Zod dependency to `^3` until official v4 support is announced.

**Incorrect (Zod v4 may break the type provider):**

```ts
// package.json
// "zod": "^4.0.0"  ← not yet supported by fastify-type-provider-zod

import { z } from "zod";
// z.object() behaves differently in v4 — schema compilation may fail at runtime
```

**Correct (pin to Zod v3):**

```ts
// package.json
// "zod": "^3.22.0"  ← stable, fully supported

import { z } from "zod";
const schema = z.object({ name: z.string() }); // works as expected
```

**Strict mode**: By default the type provider does not enable Zod's strict object parsing. Unrecognized keys are **not** rejected by Zod itself — Fastify's AJV layer handles `additionalProperties` stripping for request bodies. If you need Zod-level strict parsing, call `.strict()` explicitly on the object schema.

**Incorrect (assumes Zod rejects extra keys by default):**

```ts
app.post("/users", {
  schema: {
    body: z.object({ name: z.string() }), // extra keys are NOT rejected by Zod alone
  },
}, async (request) => {
  // request.body may still contain extra properties at runtime
  return {};
});
```

**Correct (use `.strict()` if you need Zod to reject extra keys):**

```ts
app.post("/users", {
  schema: {
    body: z.object({ name: z.string() }).strict(), // Zod rejects unknown keys
  },
}, async (request) => {
  return {};
});
```

Reference: [fastify-type-provider-zod](https://github.com/turkerdev/fastify-type-provider-zod) | [Fastify Validation and Serialization](https://fastify.dev/docs/latest/Reference/Validation-and-Serialization/) | [Fastify Type Providers](https://fastify.dev/docs/latest/Reference/Type-Providers/#zod)
