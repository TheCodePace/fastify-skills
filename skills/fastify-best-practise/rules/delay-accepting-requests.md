---
title: Delay Accepting Requests
impact: HIGH
impactDescription: Prevents request failures during startup by ensuring all dependencies are ready before accepting traffic
tags: ready, onReady, onRequest, decorator, 503, kubernetes, readiness, liveness, health-check, startup
---

## Delay Accepting Requests

**Impact: HIGH (prevents request failures during startup)**

When a Fastify server starts, there is a window between the moment the server begins listening and the moment all dependencies (database connections, caches, external services) are fully initialised. Requests arriving in this window can fail or return incorrect results. Use a decorator flag combined with hooks to reject early requests with a `503 Service Unavailable` until the application is truly ready.

### Basic Pattern: Decorator Flag + Hooks

**Incorrect (listening before dependencies are ready):**

```ts
import Fastify from "fastify";

const fastify = Fastify({ logger: true });

fastify.get("/users", async () => {
  // If the DB connection is not yet established, this will throw
  return fastify.db.query("SELECT * FROM users");
});

// WRONG: starts accepting requests immediately — DB may not be connected yet
await fastify.listen({ port: 3000 });
connectToDatabase(); // races with incoming requests
```

**Correct (use a decorator flag to gate requests):**

```ts
import Fastify from "fastify";

const fastify = Fastify({ logger: true });

// 1. Declare a boolean decorator — false until dependencies are ready
fastify.decorate("isReady", false);

// 2. Reject requests that arrive before the server is ready
fastify.addHook("onRequest", async (request, reply) => {
  if (!fastify.isReady) {
    reply.status(503);
    return reply.send({ error: "Service Unavailable", message: "Server is starting up" });
  }
});

// 3. Verify dependencies in onReady, then flip the flag
fastify.addHook("onReady", async () => {
  await connectToDatabase();
  await warmUpCache();
  fastify.isReady = true;
  fastify.log.info("All dependencies ready — accepting requests");
});

await fastify.listen({ port: 3000 });
```

---

### Correct Sequencing with `fastify.ready()`

The `fastify.ready()` method triggers plugin loading and fires all `onReady` hooks. By default, `fastify.listen()` calls `ready()` internally, but you can call it explicitly to separate initialisation from listening.

**Correct (explicit `ready()` before `listen()`):**

```ts
import Fastify from "fastify";

const fastify = Fastify({ logger: true });

// Register plugins, routes, hooks…
fastify.register(dbPlugin);
fastify.register(routes);

// Explicitly await ready — all plugins loaded, onReady hooks fired
await fastify.ready();
fastify.log.info("Fastify is ready");

// Now start listening — the server is fully initialised
await fastify.listen({ port: 3000 });
```

---

### Health Checks: Liveness vs. Readiness

When deploying with Kubernetes (or any orchestrator), expose separate endpoints for liveness and readiness probes. A liveness probe tells the orchestrator the process is alive; a readiness probe tells it the process is ready to receive traffic.

**Incorrect (single health endpoint that hides startup state):**

```ts
// WRONG: always returns 200 — orchestrator routes traffic before DB is connected
fastify.get("/health", async () => {
  return { status: "ok" };
});
```

**Correct (separate liveness and readiness endpoints):**

```ts
import Fastify from "fastify";

const fastify = Fastify({ logger: true });

fastify.decorate("isReady", false);

// Liveness — is the process alive? Always 200 if the event loop is running
fastify.get("/healthz", async () => {
  return { status: "alive" };
});

// Readiness — are all dependencies up? Returns 503 until ready
fastify.get("/readyz", async (request, reply) => {
  if (!fastify.isReady) {
    reply.status(503);
    return { status: "not ready" };
  }
  return { status: "ready" };
});

// Skip the isReady gate for health-check routes
fastify.addHook("onRequest", async (request, reply) => {
  if (request.url === "/healthz" || request.url === "/readyz") {
    return; // allow health checks through
  }
  if (!fastify.isReady) {
    reply.status(503);
    return reply.send({ error: "Service Unavailable" });
  }
});

fastify.addHook("onReady", async () => {
  await connectToDatabase();
  await warmUpCache();
  fastify.isReady = true;
  fastify.log.info("All dependencies ready");
});

await fastify.listen({ port: 3000 });
```

---

### Plugin Pattern: Encapsulate the Readiness Gate

**Correct (package the readiness pattern as a reusable plugin):**

```ts
import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";

declare module "fastify" {
  interface FastifyInstance {
    isReady: boolean;
  }
}

async function readinessPlugin(
  fastify: FastifyInstance,
  opts: { healthPaths?: string[] },
) {
  const skip = new Set(opts.healthPaths ?? ["/healthz", "/readyz"]);

  fastify.decorate("isReady", false);

  fastify.addHook("onRequest", async (request, reply) => {
    if (skip.has(request.url)) return;
    if (!fastify.isReady) {
      reply.status(503);
      return reply.send({ error: "Service Unavailable" });
    }
  });

  fastify.get("/healthz", async () => ({ status: "alive" }));

  fastify.get("/readyz", async (request, reply) => {
    if (!fastify.isReady) {
      reply.status(503);
      return { status: "not ready" };
    }
    return { status: "ready" };
  });
}

export default fp(readinessPlugin, {
  name: "readiness",
  fastify: "5.x",
});
```

Then in your server:

```ts
import readinessPlugin from "./plugins/readiness.js";

fastify.register(readinessPlugin, { healthPaths: ["/healthz", "/readyz"] });

fastify.addHook("onReady", async () => {
  await connectToDatabase();
  fastify.isReady = true;
});
```

---

### Kubernetes Manifest Example

```yaml
# Relevant section of a Kubernetes Deployment spec
containers:
  - name: api
    livenessProbe:
      httpGet:
        path: /healthz
        port: 3000
      initialDelaySeconds: 5
      periodSeconds: 10
    readinessProbe:
      httpGet:
        path: /readyz
        port: 3000
      initialDelaySeconds: 3
      periodSeconds: 5
```

The orchestrator will not send traffic until `/readyz` returns `200`, giving the application time to connect to databases, warm caches, and load configuration.

Reference: [Delay Accepting Requests](https://fastify.dev/docs/latest/Guides/Delay-Accepting-Requests/) | [Fastify Hooks](https://fastify.dev/docs/latest/Reference/Hooks/) | [Fastify Decorators](https://fastify.dev/docs/latest/Reference/Decorators/)
