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

**Correct (build function with options and autoload):**

```ts
import path from "node:path";
import { fileURLToPath } from "node:url";
import Fastify from "fastify";
import autoload from "@fastify/autoload";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

interface ServerOptions {
  logger?: boolean;
}

function buildServer(options: ServerOptions = {}) {
  const server = Fastify({
    logger: options.logger || false,
  });

  // Autoload shared plugins (use fastify-plugin inside each)
  server.register(autoload, {
    dir: path.join(__dirname, "plugins"),
  });

  // Autoload routes (encapsulated, prefixes from folder names)
  server.register(autoload, {
    dir: path.join(__dirname, "routes"),
    autoHooks: true,
    cascadeHooks: true,
  });

  return server;
}

const server = buildServer({ logger: true });
await server.listen({ port: 3000 });
```
