---
title: Request Validation and Response Serialization with Zod
impact: HIGH
impactDescription: Ensures request input and response output are validated against reusable Zod schemas with accurate Fastify type inference
tags: serialization, zod, schema, type-safety, response, migration, fastify-type-provider-zod
---

## Request Validation and Response Serialization with Zod

Use `fastify-type-provider-zod` when you want a single Zod schema source for request validation, response output validation, serialization, and TypeScript inference. Register the Zod validator and serializer compilers once, use `withTypeProvider<ZodTypeProvider>()` (or `FastifyPluginAsyncZod` in route plugins), then define `body`, `params`, `querystring`, `headers`, and `response` schemas with `z.object()`.

Install the matching Zod and type-provider versions for your project:

```bash
pnpm add fastify-type-provider-zod zod
```

Fastify's default JSON Schema pipeline uses AJV for validation and `fast-json-stringify` for response serialization. `fastify-type-provider-zod` plugs into Fastify's compiler hooks but replaces those default compilers for Zod routes: request parts are parsed with Zod, response payloads are validated/encoded with Zod, and the serializer returns a JSON string. Use the JSON Schema serialization rule when you specifically need raw `fast-json-stringify` schemas; use this rule when Zod type inference and schema reuse are the priority.

### Register the Zod Compilers and Type Provider

**Incorrect (no serializer compiler or response schema, unsafe casts, possible data leaks):**

```ts
import Fastify from "fastify";

const server = Fastify();

server.post("/users", async (request, reply) => {
  const body = request.body as { name: string; email: string };
  const user = await createUser(body);

  reply.status(201);
  return user; // passwordHash or internal fields can be sent accidentally
});
```

**Correct (register validator and serializer compilers and define response output):**

```ts
import Fastify from "fastify";
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from "fastify-type-provider-zod";
import { z } from "zod/v4";

const server = Fastify();

server.setValidatorCompiler(validatorCompiler);
server.setSerializerCompiler(serializerCompiler);

const app = server.withTypeProvider<ZodTypeProvider>();

const createUserBodySchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
});

const userResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string().email(),
});

app.post(
  "/users",
  {
    schema: {
      body: createUserBodySchema,
      response: {
        201: userResponseSchema,
      },
    },
  },
  async (request, reply) => {
    const user = await createUser(request.body);

    reply.status(201);
    return user; // output is validated and encoded through the Zod serializer
  },
);
```

### Validate Body, Params, Querystring, Headers, and Responses

Define every external input source explicitly. Fastify lower-cases incoming header names, so prefer lower-case keys in header schemas.

**Incorrect (only validates the body and manually reads untyped params/query/headers):**

```ts
app.put(
  "/users/:id",
  {
    schema: {
      body: z.object({ name: z.string().min(1) }),
    },
  },
  async (request) => {
    const params = request.params as { id: string };
    const query = request.query as { includePosts?: string };
    const requestId = request.headers["x-request-id"] as string | undefined;

    return updateUser(params.id, request.body, query.includePosts, requestId);
  },
);
```

**Correct (validate all request parts and the serialized response):**

```ts
const userParamsSchema = z.object({
  id: z.string().uuid(),
});

const userQuerySchema = z.object({
  includePosts: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
});

const requestHeadersSchema = z.object({
  "x-request-id": z.string().min(1).optional(),
});

const updateUserBodySchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional(),
});

const userWithPostsResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string().email(),
  posts: z
    .array(
      z.object({
        id: z.string().uuid(),
        title: z.string(),
      }),
    )
    .optional(),
});

app.put(
  "/users/:id",
  {
    schema: {
      params: userParamsSchema,
      querystring: userQuerySchema,
      headers: requestHeadersSchema,
      body: updateUserBodySchema,
      response: {
        200: userWithPostsResponseSchema,
      },
    },
  },
  async (request) => {
    return updateUser({
      id: request.params.id,
      includePosts: request.query.includePosts,
      requestId: request.headers["x-request-id"],
      input: request.body,
    });
  },
);
```

### Reuse Zod Schemas Across Routes and Plugins

Keep reusable schemas close to the resource, export shared schemas from a `schema.ts` file, and type route plugins with `FastifyPluginAsyncZod` after registering the compilers in a shared plugin.

**Incorrect (duplicates inline schemas and loses type-provider inference in plugins):**

```ts
export default async function userRoutes(fastify) {
  fastify.get("/:id", {
    schema: {
      params: z.object({ id: z.string().uuid() }),
      response: {
        200: z.object({ id: z.string().uuid(), name: z.string() }),
      },
    },
  }, async (request) => {
    const params = request.params as { id: string };
    return findUser(params.id);
  });

  fastify.post("/", {
    schema: {
      body: z.object({ name: z.string().min(1) }),
      response: {
        201: z.object({ id: z.string().uuid(), name: z.string() }),
      },
    },
  }, async (request, reply) => {
    reply.status(201);
    return createUser(request.body as { name: string });
  });
}
```

**Correct (share schemas and use a Zod-aware route plugin type):**

```ts
// src/plugins/zod.ts
import fp from "fastify-plugin";
import {
  serializerCompiler,
  validatorCompiler,
} from "fastify-type-provider-zod";

export default fp(async function zodPlugin(fastify) {
  fastify.setValidatorCompiler(validatorCompiler);
  fastify.setSerializerCompiler(serializerCompiler);
});
```

```ts
// src/routes/users/schema.ts
import { z } from "zod/v4";

export const userParamsSchema = z.object({
  id: z.string().uuid(),
});

export const createUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
});

export const userResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string().email(),
});
```

```ts
// src/routes/users/index.ts
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import {
  createUserSchema,
  userParamsSchema,
  userResponseSchema,
} from "./schema.js";

const userRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.get(
    "/:id",
    {
      schema: {
        params: userParamsSchema,
        response: { 200: userResponseSchema },
      },
    },
    async (request) => findUser(request.params.id),
  );

  fastify.post(
    "/",
    {
      schema: {
        body: createUserSchema,
        response: { 201: userResponseSchema },
      },
    },
    async (request, reply) => {
      const user = await createUser(request.body);
      reply.status(201);
      return user;
    },
  );
};

export default userRoutes;
```

### Migrate from Raw JSON Schema to Zod

When migrating route-by-route, avoid mixing raw JSON Schema into a Fastify scope whose compiler expects Zod schemas. Register Zod-enabled routes in their own encapsulated plugin or convert the route's `body`, `params`, `querystring`, `headers`, and `response` schemas together.

**Incorrect (raw JSON Schema plus manual casts):**

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
          required: ["id", "name", "price"],
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
    const body = request.body as { name: string; price: number };
    const item = await createItem(body.name, body.price);

    reply.status(201);
    return item;
  },
);
```

**Correct (Zod schemas provide runtime checks and inferred types):**

```ts
const itemInputSchema = z.object({
  name: z.string().min(1),
  price: z.number().nonnegative(),
});

const itemResponseSchema = itemInputSchema.extend({
  id: z.string().uuid(),
});

app.post(
  "/items",
  {
    schema: {
      body: itemInputSchema,
      response: {
        201: itemResponseSchema,
      },
    },
  },
  async (request, reply) => {
    const item = await createItem(request.body.name, request.body.price);

    reply.status(201);
    return item;
  },
);
```

### Known Limitations and Compatibility

**Runtime compiler behavior:** Zod routes do not run through AJV or `fast-json-stringify` at runtime after you install `validatorCompiler` and `serializerCompiler`. They use Fastify's compiler hooks, but the compilers are Zod-based. Use `jsonSchemaTransform` / `jsonSchemaTransformObject` for OpenAPI generation, not as proof that runtime validation uses AJV.

**Version compatibility:** Match `fastify-type-provider-zod` to your Zod major version. As of current package guidance, `fastify-type-provider-zod <= 4.x` targets Zod v3, `>= 5.x < 7.x` targets Zod v4, and `>= 7.x` targets Zod v4.2+ with `z.output<T>`-based response serialization. For v7+, prefer `import { z } from "zod/v4"` and return the post-transform output shape from handlers.

**Strict mode:** `z.object()` strips unknown keys by default; it does not reject them. Use `.strict()` when unknown request keys or response fields should fail validation, and use `.passthrough()` only when preserving extra keys is intentional.

**Incorrect (assumes default objects reject unknown fields):**

```ts
app.post(
  "/users",
  {
    schema: {
      body: z.object({ name: z.string() }),
      response: {
        201: z.object({ id: z.string().uuid(), name: z.string() }),
      },
    },
  },
  async (request, reply) => {
    reply.status(201);
    return createUser(request.body);
  },
);
```

**Correct (choose explicit unknown-key behavior):**

```ts
const createUserBodySchema = z
  .object({
    name: z.string().min(1),
  })
  .strict(); // reject unknown request fields instead of stripping them

const userResponseSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string(),
  })
  .strict(); // fail serialization if the handler returns extra fields

app.post(
  "/users",
  {
    schema: {
      body: createUserBodySchema,
      response: { 201: userResponseSchema },
    },
  },
  async (request, reply) => {
    const user = await createUser(request.body);

    reply.status(201);
    return user;
  },
);
```

Reference: [fastify-type-provider-zod](https://github.com/turkerdev/fastify-type-provider-zod) | [Fastify Type Providers](https://fastify.dev/docs/latest/Reference/Type-Providers/#zod) | [Fastify Validation and Serialization](https://fastify.dev/docs/latest/Reference/Validation-and-Serialization/) | [Zod](https://zod.dev/)
