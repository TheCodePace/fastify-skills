---
title: TypeScript Integration
impact: MEDIUM
impactDescription: Full type safety across routes, plugins, and decorators for a better developer experience
tags: typescript, type-providers, generics, decorators, module-augmentation
---

## TypeScript Integration

Fastify has first-class TypeScript support. Use type providers, module augmentation for decorators, and proper generics to get full type safety across your application.

### Use Type Providers

**Incorrect (manual type casting):**

```ts
server.get("/users/:id", async (request, reply) => {
  const { id } = request.params as { id: string };
  const { page } = request.query as { page: string };
  return findUser(id);
});
```

**Correct (use a type provider for automatic inference):**

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
    // request.params.id is string
    // request.query.page is number
    return findUser(request.params.id);
  },
);
```

### Type Decorators with Module Augmentation

**Incorrect (untyped decorators):**

```ts
fastify.decorate("config", { dbUrl: "postgres://..." });

// Later: fastify.config is `any` or unknown
fastify.get("/", async () => {
  return { db: (fastify as any).config.dbUrl }; // unsafe
});
```

**Correct (augment the FastifyInstance interface):**

```ts
import { FastifyInstance } from "fastify";

// Declare your decorator types
declare module "fastify" {
  interface FastifyInstance {
    config: {
      dbUrl: string;
      port: number;
    };
  }
}

// Now fastify.config is fully typed everywhere
fastify.decorate("config", {
  dbUrl: process.env.DATABASE_URL || "postgres://localhost:5432/mydb",
  port: Number(process.env.PORT) || 3000,
});
```

### Type Request Properties

**Correct (type custom request properties added by hooks):**

```ts
declare module "fastify" {
  interface FastifyRequest {
    user: {
      id: string;
      email: string;
      role: string;
    };
  }
}

// Now request.user is typed in all handlers
fastify.addHook("preHandler", async (request, reply) => {
  request.user = await verifyToken(request.headers.authorization);
});

fastify.get("/profile", async (request) => {
  return { email: request.user.email }; // fully typed
});
```

### Type Plugin Options

**Correct (typed plugin options):**

```ts
import fp from "fastify-plugin";
import { FastifyInstance } from "fastify";

interface CachePluginOptions {
  ttl: number;
  maxSize: number;
}

async function cachePlugin(
  fastify: FastifyInstance,
  options: CachePluginOptions,
) {
  const cache = new Map<string, { value: unknown; expires: number }>();

  fastify.decorate("cache", {
    get: (key: string) => {
      const entry = cache.get(key);
      if (!entry || Date.now() > entry.expires) return undefined;
      return entry.value;
    },
    set: (key: string, value: unknown) => {
      if (cache.size >= options.maxSize) cache.clear();
      cache.set(key, { value, expires: Date.now() + options.ttl });
    },
  });
}

export default fp(cachePlugin, { name: "cache-plugin" });
```

Reference: [Fastify TypeScript](https://fastify.dev/docs/latest/Reference/TypeScript/) | [Type Providers](https://fastify.dev/docs/latest/Reference/Type-Providers/)
