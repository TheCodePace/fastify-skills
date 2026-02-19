---
title: Route Best Practices
impact: MEDIUM
impactDescription: Improve code organization, maintainability, and performance of route definitions
tags: routes, organization, async, prefixes
---

## Route Best Practices

Fastify routes should be organized using plugins with prefixes, always use async handlers, and leverage the full route options object for complex routes. This keeps the codebase modular and takes advantage of Fastify's optimized routing.

### Organize Routes with Plugins and Prefixes

**Incorrect (all routes in a single file):**

```ts
import Fastify from "fastify";

const server = Fastify();

server.get("/users", async (request, reply) => {
  // list users
});

server.get("/users/:id", async (request, reply) => {
  // get user
});

server.post("/users", async (request, reply) => {
  // create user
});

server.get("/posts", async (request, reply) => {
  // list posts
});

server.get("/posts/:id", async (request, reply) => {
  // get post
});
```

**Correct (routes organized in plugins with prefixes):**

`src/routes/v1/users.ts`

```ts
import { FastifyInstance } from "fastify";

async function userRoutes(fastify: FastifyInstance) {
  fastify.get("/", async (request, reply) => {
    // list users
  });

  fastify.get("/:id", async (request, reply) => {
    // get user
  });

  fastify.post("/", async (request, reply) => {
    // create user
  });
}

export default userRoutes;
```

`src/routes/v1/posts.ts`

```ts
import { FastifyInstance } from "fastify";

async function postRoutes(fastify: FastifyInstance) {
  fastify.get("/", async (request, reply) => {
    // list posts
  });

  fastify.get("/:id", async (request, reply) => {
    // get post
  });
}

export default postRoutes;
```

`src/server.ts` — manual registration:

```ts
import Fastify from "fastify";
import userRoutes from "./routes/v1/users";
import postRoutes from "./routes/v1/posts";

function buildServer() {
  const server = Fastify({ logger: true });

  server.register(userRoutes, { prefix: "/v1/users" });
  server.register(postRoutes, { prefix: "/v1/posts" });

  return server;
}
```

**Even better (use @fastify/autoload for automatic route loading):**

`src/server.ts`

```ts
import path from "node:path";
import { fileURLToPath } from "node:url";
import Fastify from "fastify";
import autoload from "@fastify/autoload";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

function buildServer() {
  const server = Fastify({ logger: true });

  server.register(autoload, {
    dir: path.join(__dirname, "plugins"),
  });

  // Each folder in routes/ becomes a prefix: routes/v1/users/ → /api/v1/users
  server.register(autoload, {
    dir: path.join(__dirname, "routes"),
    options: { prefix: "/api" },
    autoHooks: true,
    cascadeHooks: true,
  });

  return server;
}
```

With autoload, adding a new resource is just creating a new folder — no imports or registration needed.

### Use Async Handlers and Return Values

**Incorrect (using callback-style reply.send):**

```ts
server.get("/data", (request, reply) => {
  const data = fetchData();
  reply.send(data);
});
```

**Correct (use async and return the value):**

```ts
server.get("/data", async (request, reply) => {
  const data = await fetchData();
  return data;
});
```

### Use Full Route Options for Complex Routes

**Correct (full route declaration with schema and hooks):**

```ts
server.route({
  method: "GET",
  url: "/users/:id",
  schema: {
    params: {
      type: "object",
      properties: {
        id: { type: "string" },
      },
      required: ["id"],
    },
    response: {
      200: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
        },
      },
    },
  },
  preHandler: async (request, reply) => {
    // authentication check
  },
  handler: async (request, reply) => {
    const { id } = request.params as { id: string };
    return getUserById(id);
  },
});
```

Reference: [Fastify Routes Documentation](https://fastify.dev/docs/latest/Reference/Routes/)
