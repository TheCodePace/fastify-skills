---
title: Create Customizable Server
impact: LOW-MEDIUM
impactDescription: make the server customizable and reusable across different parts of the application
tags: initialization, application, app-startup
---

## Create Server Customizable and Reusable

When setting up a Fastify server, it's crucial to make it creation customizable and reusable across different parts of the application like development, testing, and production.

**Incorrect (creates a new server instance per request):**

```ts
import Fastify from "fastify";

const server = Fastify();

server.get("/", async (request, reply) => {
  // handle request
});

server.post("/data", async (request, reply) => {
  // handle request
});

await server.listen(3000);
```

**Correct (build function with options):**

```ts
import Fastify from "fastify";

interface ServerOptions {
  logger?: boolean;
}

function buildServer(options: ServerOptions = {}) {
  const server = Fastify({
    logger: options.logger || false,
  });

  server.get("/", async (request, reply) => {
    // handle request
  });

  server.post("/data", async (request, reply) => {
    // handle request
  });

  return server;
}

const server = buildServer({ logger: true });
await server.listen(3000);
```
