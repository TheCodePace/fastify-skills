---
title: Schema Validation with Zod
impact: HIGH
impactDescription: Type-safe request/response validation with automatic TypeScript inference and serialization
tags: validation, zod, schema, type-safety, serialization
---

## Schema Validation with Zod

Fastify has built-in support for JSON Schema validation, but using Zod via `fastify-type-provider-zod` provides a superior developer experience with TypeScript type inference, composable schemas, and runtime validation. This eliminates manual type casting and keeps validation and types in sync.

### Setup

Install dependencies:

```bash
npm install zod fastify-type-provider-zod
```

### Configure the Type Provider

**Incorrect (no type provider, manual casting):**

```ts
import Fastify from "fastify";

const server = Fastify();

server.post("/users", async (request, reply) => {
  const { name, email } = request.body as { name: string; email: string };
  // no runtime validation, unsafe
  return createUser(name, email);
});
```

**Correct (use Zod type provider):**

```ts
import Fastify from "fastify";
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from "fastify-type-provider-zod";
import { z } from "zod";

const server = Fastify();

// Set up the Zod validator and serializer compilers
server.setValidatorCompiler(validatorCompiler);
server.setSerializerCompiler(serializerCompiler);

// Use withTypeProvider for full type inference
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
    // request.body is fully typed: { name: string; email: string }
    const { name, email } = request.body;
    const user = await createUser(name, email);
    reply.status(201);
    return user;
  },
);
```

### Validate Params, Querystring, and Headers

**Correct (validate all input sources):**

```ts
import { z } from "zod";

const paramsSchema = z.object({
  id: z.string().uuid(),
});

const querySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

app.get(
  "/users/:id/posts",
  {
    schema: {
      params: paramsSchema,
      querystring: querySchema,
    },
  },
  async (request, reply) => {
    // request.params.id is string, request.query.page is number
    const { id } = request.params;
    const { page, limit } = request.query;
    return getUserPosts(id, page, limit);
  },
);
```

### Reuse Schemas Across Routes

**Correct (define shared schemas):**

```ts
import { z } from "zod";

// Shared schemas
const userSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string().email(),
  createdAt: z.string().datetime(),
});

const errorSchema = z.object({
  statusCode: z.number(),
  error: z.string(),
  message: z.string(),
});

// Reuse in routes
app.get(
  "/users/:id",
  {
    schema: {
      params: z.object({ id: z.string().uuid() }),
      response: {
        200: userSchema,
        404: errorSchema,
      },
    },
  },
  async (request, reply) => {
    const user = await findUser(request.params.id);
    if (!user) {
      reply.status(404);
      return { statusCode: 404, error: "Not Found", message: "User not found" };
    }
    return user;
  },
);
```

### Setup in a Plugin (Recommended for large apps)

**Correct (set compilers once in a plugin):**

```ts
import fp from "fastify-plugin";
import {
  serializerCompiler,
  validatorCompiler,
} from "fastify-type-provider-zod";

export default fp(
  async function zodPlugin(fastify) {
    fastify.setValidatorCompiler(validatorCompiler);
    fastify.setSerializerCompiler(serializerCompiler);
  },
  {
    name: "zod-plugin",
  },
);
```

### Use Zod Type Provider Inside Route Plugins

When using the Zod plugin registered globally, type your route plugins with `FastifyPluginAsyncZod` to get full type inference without calling `withTypeProvider` manually:

`src/plugins/zod.ts`

```ts
import fp from "fastify-plugin";
import {
  serializerCompiler,
  validatorCompiler,
} from "fastify-type-provider-zod";

export default fp(
  async function zodPlugin(fastify) {
    fastify.setValidatorCompiler(validatorCompiler);
    fastify.setSerializerCompiler(serializerCompiler);
  },
  {
    name: "zod-plugin",
  },
);
```

`src/routes/users/index.ts`

```ts
import { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";

const userSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string().email(),
});

const userRoutes: FastifyPluginAsyncZod = async function (fastify) {
  fastify.get(
    "/",
    {
      schema: {
        querystring: z.object({
          page: z.coerce.number().int().positive().default(1),
          limit: z.coerce.number().int().min(1).max(100).default(20),
        }),
        response: {
          200: z.array(userSchema),
        },
      },
    },
    async (request, reply) => {
      // request.query.page and request.query.limit are fully typed as numbers
      const { page, limit } = request.query;
      return getUsers(page, limit);
    },
  );

  fastify.post(
    "/",
    {
      schema: {
        body: z.object({
          name: z.string().min(1),
          email: z.string().email(),
        }),
        response: {
          201: userSchema,
        },
      },
    },
    async (request, reply) => {
      // request.body is typed: { name: string; email: string }
      const user = await createUser(request.body);
      reply.status(201);
      return user;
    },
  );

  fastify.get(
    "/:id",
    {
      schema: {
        params: z.object({ id: z.string().uuid() }),
        response: {
          200: userSchema,
        },
      },
    },
    async (request, reply) => {
      // request.params.id is typed as string
      const user = await findUser(request.params.id);
      if (!user) {
        throw fastify.httpErrors.notFound(
          `User ${request.params.id} not found`,
        );
      }
      return user;
    },
  );
};

export default userRoutes;
```

### Split Routes and Schemas in Separate Files

For maintainability, keep Zod schemas in a dedicated `schema.ts` file next to the route `index.ts`. This keeps route handlers clean and makes schemas easy to reuse and test independently.

**Recommended folder structure:**

```
src/
  routes/
    users/
      index.ts        # Route handlers only
      schema.ts       # Zod schemas for this resource
    posts/
      index.ts
      schema.ts
  schemas/
    shared.ts         # Shared schemas used across multiple routes (errors, pagination, etc.)
```

`src/schemas/shared.ts` — reusable schemas:

```ts
import { z } from "zod";

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const errorSchema = z.object({
  statusCode: z.number(),
  error: z.string(),
  message: z.string(),
});
```

`src/routes/users/schema.ts` — schemas for the users resource:

```ts
import { z } from "zod";

export const userSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string().email(),
  createdAt: z.string().datetime(),
});

export const createUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
});

export const updateUserSchema = createUserSchema.partial();

export const userParamsSchema = z.object({
  id: z.string().uuid(),
});
```

`src/routes/users/index.ts` — clean handlers importing schemas:

```ts
import { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { paginationSchema } from "../../schemas/shared.js";
import {
  userSchema,
  createUserSchema,
  updateUserSchema,
  userParamsSchema,
} from "./schema.js";

const userRoutes: FastifyPluginAsyncZod = async function (fastify) {
  fastify.get(
    "/",
    {
      schema: {
        querystring: paginationSchema,
        response: { 200: userSchema.array() },
      },
    },
    async (request) => {
      const { page, limit } = request.query;
      return getUsers(page, limit);
    },
  );

  fastify.post(
    "/",
    {
      schema: {
        body: createUserSchema,
        response: { 201: userSchema },
      },
    },
    async (request, reply) => {
      const user = await createUser(request.body);
      reply.status(201);
      return user;
    },
  );

  fastify.get(
    "/:id",
    {
      schema: {
        params: userParamsSchema,
        response: { 200: userSchema },
      },
    },
    async (request) => {
      const user = await findUser(request.params.id);
      if (!user) {
        throw fastify.httpErrors.notFound(
          `User ${request.params.id} not found`,
        );
      }
      return user;
    },
  );

  fastify.patch(
    "/:id",
    {
      schema: {
        params: userParamsSchema,
        body: updateUserSchema,
        response: { 200: userSchema },
      },
    },
    async (request) => {
      return updateUser(request.params.id, request.body);
    },
  );
};

export default userRoutes;
```

Reference: [fastify-type-provider-zod](https://github.com/turkerdev/fastify-type-provider-zod) | [Fastify Validation and Serialization](https://fastify.dev/docs/latest/Reference/Validation-and-Serialization/)
