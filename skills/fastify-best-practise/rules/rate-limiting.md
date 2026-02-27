---
title: Rate Limiting
impact: HIGH
impactDescription: Protects APIs from abuse, DDoS, and brute-force attacks
tags: rate-limit, security, throttle, abuse, ddos, brute-force
---

## Rate Limiting

**Impact: HIGH (Protects APIs from abuse, DDoS, and brute-force attacks)**

Rate limiting is essential for production Fastify APIs. Use `@fastify/rate-limit` to enforce request limits globally, per-route, or per-user. The plugin integrates with Fastify's encapsulation system and supports Redis for multi-instance deployments.

### Register `@fastify/rate-limit` Globally

**Incorrect (manual rate limiting with in-memory counters):**

```ts
const requestCounts = new Map();

server.addHook("onRequest", async (request, reply) => {
  const ip = request.ip;
  const count = requestCounts.get(ip) || 0;
  if (count > 100) {
    reply.status(429);
    return reply.send({ error: "Too many requests" });
  }
  requestCounts.set(ip, count + 1);
});
```

**Correct (register `@fastify/rate-limit` as a plugin):**

```bash
npm install @fastify/rate-limit
```

`src/plugins/rate-limit.ts`

```ts
import fp from "fastify-plugin";
import rateLimit from "@fastify/rate-limit";

async function rateLimitPlugin(fastify) {
  await fastify.register(rateLimit, {
    max: 100,
    timeWindow: "1 minute",
  });
}

export default fp(rateLimitPlugin, {
  name: "rate-limit",
  fastify: "5.x",
});
```

### Override Rate Limits Per Route

**Incorrect (no per-route control — same limits for all endpoints):**

```ts
import rateLimit from "@fastify/rate-limit";

async function buildServer() {
  const server = Fastify();
  await server.register(rateLimit, { max: 100, timeWindow: "1 minute" });

  // Login endpoint shares the same 100/min limit as all other routes
  server.post("/login", async (request) => {
    return authenticate(request.body);
  });

  return server;
}
```

**Correct (use route-level `config.rateLimit` to override):**

```ts
server.post(
  "/login",
  {
    config: {
      rateLimit: {
        max: 5,
        timeWindow: "1 minute",
      },
    },
  },
  async (request) => {
    return authenticate(request.body);
  },
);

server.get(
  "/search",
  {
    config: {
      rateLimit: {
        max: 30,
        timeWindow: "1 minute",
      },
    },
  },
  async (request) => {
    return search(request.query);
  },
);
```

### Use Redis for Multi-Instance Deployments

**Incorrect (default in-memory store with multiple server instances):**

```ts
// Each instance tracks limits independently — users get N × max requests
await server.register(rateLimit, {
  max: 100,
  timeWindow: "1 minute",
  // No store configured — defaults to in-memory
});
```

**Correct (use Redis store for shared state across instances):**

```bash
npm install @fastify/rate-limit ioredis
```

```ts
import fp from "fastify-plugin";
import rateLimit from "@fastify/rate-limit";
import Redis from "ioredis";

async function rateLimitPlugin(fastify) {
  const redis = new Redis({
    host: fastify.config.REDIS_HOST,
    port: fastify.config.REDIS_PORT,
  });

  await fastify.register(rateLimit, {
    max: 100,
    timeWindow: "1 minute",
    redis,
  });
}

export default fp(rateLimitPlugin, {
  name: "rate-limit",
  fastify: "5.x",
  dependencies: ["config"],
});
```

### Custom Key Generators

**Incorrect (relying only on default IP-based limiting):**

```ts
await server.register(rateLimit, {
  max: 100,
  timeWindow: "1 minute",
  // Default: keyGenerator uses request.ip
  // Authenticated users behind a proxy all share the same limit
});
```

**Correct (use custom key generators for user-aware limiting):**

```ts
await server.register(rateLimit, {
  max: 100,
  timeWindow: "1 minute",
  keyGenerator: (request) => {
    // Rate limit by authenticated user ID, fall back to IP
    return request.user?.id || request.ip;
  },
});
```

Per-route key generator for API key-based limiting:

```ts
server.get(
  "/api/data",
  {
    config: {
      rateLimit: {
        max: 1000,
        timeWindow: "1 hour",
        keyGenerator: (request) => {
          return request.headers["x-api-key"] || request.ip;
        },
      },
    },
  },
  async (request) => {
    return getData();
  },
);
```

### Custom Error Responses

**Incorrect (relying on default error format):**

```ts
// Default response: { statusCode: 429, error: "Too Many Requests", message: "..." }
// No retry information or consistent error structure
await server.register(rateLimit, {
  max: 100,
  timeWindow: "1 minute",
});
```

**Correct (provide a custom error response with retry info):**

```ts
await server.register(rateLimit, {
  max: 100,
  timeWindow: "1 minute",
  errorResponseBuilder: (request, context) => {
    return {
      statusCode: 429,
      error: "Too Many Requests",
      message: `Rate limit exceeded. Try again in ${context.after}.`,
      retryAfter: context.after,
    };
  },
});
```

### Exempt Health and Internal Routes

**Incorrect (health check and internal routes are rate limited):**

```ts
await server.register(rateLimit, { max: 100, timeWindow: "1 minute" });

// Health check is rate limited — monitoring probes may fail
server.get("/health", async () => {
  return { status: "ok" };
});
```

**Correct (use `allowList` or disable rate limits on specific routes):**

```ts
await server.register(rateLimit, {
  max: 100,
  timeWindow: "1 minute",
  allowList: ["127.0.0.1", "::1"],
});

// Disable rate limit on health check route
server.get(
  "/health",
  { config: { rateLimit: false } },
  async () => {
    return { status: "ok" };
  },
);

// Disable rate limit on readiness probe
server.get(
  "/ready",
  { config: { rateLimit: false } },
  async () => {
    return { status: "ready" };
  },
);
```

Reference: [@fastify/rate-limit](https://github.com/fastify/fastify-rate-limit) | [Fastify Ecosystem](https://fastify.dev/docs/latest/Guides/Ecosystem/)
