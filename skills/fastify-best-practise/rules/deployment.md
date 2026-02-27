---
title: Deployment
impact: HIGH
impactDescription: Proper deployment prevents dropped requests, downtime, and production incidents
tags: deployment, production, graceful-shutdown, docker, serverless, health-check, trust-proxy
---

## Deployment

**Impact: HIGH (Proper deployment prevents dropped requests, downtime, and production incidents)**

Production deployment requires graceful shutdown handling, health check endpoints, correct listen/ready sequencing, trust proxy configuration, Docker best practices, and serverless adapters. Misconfigurations lead to dropped requests during deploys, incorrect client IPs, and unnecessary downtime.

### Graceful Shutdown with `close-with-grace`

**Incorrect (no graceful shutdown — requests are dropped on SIGTERM):**

```ts
import Fastify from "fastify";

const app = Fastify({ logger: true });

// Routes registered here…

await app.listen({ port: 3000, host: "0.0.0.0" });
// Process exits immediately on SIGTERM — in-flight requests are dropped
```

**Correct (use `close-with-grace` for graceful shutdown):**

```ts
import Fastify from "fastify";
import closeWithGrace from "close-with-grace";

const app = Fastify({
  logger: true,
  forceCloseConnections: "idle",
});

// Register plugins and routes
await app.register(import("./plugins/index.js"));
await app.register(import("./routes/index.js"));

// Graceful shutdown — close-with-grace handles SIGTERM/SIGINT
closeWithGrace(
  { delay: process.env.FASTIFY_CLOSE_GRACE_DELAY || 10000 },
  async ({ signal, err }) => {
    if (err) {
      app.log.error({ err }, "Server closing due to error");
    } else {
      app.log.info({ signal }, "Server closing due to signal");
    }
    await app.close();
  },
);

await app.listen({
  port: parseInt(process.env.PORT || "3000", 10),
  host: "0.0.0.0",
});
```

### Health Check and Readiness Routes

**Incorrect (no health or readiness endpoints — orchestrators cannot verify the app is alive):**

```ts
import Fastify from "fastify";

const app = Fastify({ logger: true });

app.get("/", async () => {
  return { hello: "world" };
});

await app.listen({ port: 3000 });
```

**Correct (add `/health` and `/ready` routes for liveness and readiness probes):**

```ts
import Fastify from "fastify";

const app = Fastify({ logger: true });

// Liveness — lightweight, always returns ok
app.get("/health", { logLevel: "silent" }, async () => {
  return { status: "ok" };
});

// Readiness — checks dependencies before accepting traffic
app.get("/ready", async (request, reply) => {
  const checks: Record<string, boolean> = {};

  try {
    await app.db.query("SELECT 1");
    checks.database = true;
  } catch {
    checks.database = false;
  }

  const allHealthy = Object.values(checks).every(Boolean);
  if (!allHealthy) {
    reply.code(503);
  }

  return {
    status: allHealthy ? "ok" : "degraded",
    checks,
  };
});
```

### Listen on `0.0.0.0` and Correct Sequencing

**Incorrect (listen on localhost — unreachable inside Docker/Kubernetes):**

```ts
import Fastify from "fastify";

const app = Fastify({ logger: true });

// Default host is localhost/127.0.0.1 — container won't accept external traffic
await app.listen({ port: 3000 });
```

**Correct (listen on `0.0.0.0` with proper port config):**

```ts
import Fastify from "fastify";

const app = Fastify({ logger: true });

await app.listen({
  port: parseInt(process.env.PORT || "3000", 10),
  host: "0.0.0.0",
});
```

### Trust Proxy Behind a Reverse Proxy / Load Balancer

**Incorrect (no trustProxy — `request.ip` returns the proxy's IP, not the client's):**

```ts
import Fastify from "fastify";

const app = Fastify({ logger: true });

app.get("/whoami", async (request) => {
  // request.ip is the load balancer IP, not the real client
  return { ip: request.ip };
});
```

**Correct (enable trustProxy so `request.ip` returns the real client IP):**

```ts
import Fastify from "fastify";

const app = Fastify({
  logger: true,
  // Trust first proxy (load balancer / reverse proxy)
  trustProxy: true,
});

app.get("/whoami", async (request) => {
  // request.ip now reflects X-Forwarded-For correctly
  return { ip: request.ip };
});
```

### Docker Multi-Stage Build

**Incorrect (single-stage image with dev dependencies and root user):**

```dockerfile
FROM node:22
WORKDIR /app
COPY . .
RUN npm install
CMD ["node", "src/app.js"]
```

**Correct (multi-stage build, production deps only, non-root user):**

```dockerfile
# Build stage
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

# Production stage
FROM node:22-alpine
WORKDIR /app
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --chown=nodejs:nodejs ./src ./src
COPY --chown=nodejs:nodejs package.json ./
USER nodejs
EXPOSE 3000
ENV NODE_ENV=production
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1
CMD ["node", "src/app.js"]
```

### Serverless Deployment with `@fastify/aws-lambda`

**Incorrect (creating a new Fastify instance per invocation):**

```ts
// handler.ts
import Fastify from "fastify";

export const handler = async (event: any, context: any) => {
  // Bad: cold start on every invocation
  const app = Fastify();
  app.get("/", async () => ({ hello: "world" }));
  await app.ready();
  // manual event parsing…
};
```

**Correct (reuse the Fastify instance with `@fastify/aws-lambda`):**

```ts
// handler.ts
import awsLambdaFastify from "@fastify/aws-lambda";
import { buildServer } from "./server.js";

const app = buildServer();
const proxy = awsLambdaFastify(app);

export const handler = proxy;
```

Reference: [Fastify Deployment Recommendations](https://fastify.dev/docs/latest/Guides/Recommendations/) | [close-with-grace](https://github.com/mcollina/close-with-grace) | [Serverless Guide](https://fastify.dev/docs/latest/Guides/Serverless/) | [@fastify/aws-lambda](https://github.com/fastify/aws-lambda-fastify)
