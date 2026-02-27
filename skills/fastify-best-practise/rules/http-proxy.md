---
title: HTTP Proxy
impact: HIGH
impactDescription: Proper proxying patterns enable reliable API gateways and BFF architectures
tags: proxy, gateway, reverse-proxy, microservices, reply-from, http-proxy, bff
---

## HTTP Proxy

Fastify is commonly used as a BFF (Backend-for-Frontend) or API gateway. The `@fastify/http-proxy` and `@fastify/reply-from` plugins make it straightforward to proxy requests upstream while applying auth, logging, and transformation. Use `@fastify/http-proxy` for full route proxying and `@fastify/reply-from` for fine-grained `reply.from()` calls.

### Use `@fastify/http-proxy` for Route Proxying

**Incorrect (manually forwarding requests with `fetch`):**

```ts
import Fastify from "fastify";

const server = Fastify({ logger: true });

server.all("/api/*", async (request, reply) => {
  const url = `http://backend-service:3001${request.url}`;
  const response = await fetch(url, {
    method: request.method,
    headers: request.headers,
    body: request.method !== "GET" ? JSON.stringify(request.body) : undefined,
  });
  const data = await response.json();
  reply.status(response.status).send(data);
});
```

**Correct (use `@fastify/http-proxy` to proxy entire route prefixes):**

```bash
npm install @fastify/http-proxy
```

```ts
import Fastify from "fastify";
import httpProxy from "@fastify/http-proxy";

const server = Fastify({ logger: true });

server.register(httpProxy, {
  upstream: "http://backend-service:3001",
  prefix: "/api",
  rewritePrefix: "/v1",
  http2: false,
});

await server.listen({ port: 3000 });
```

### Apply Authentication Before Proxying

**Incorrect (no auth check before forwarding to upstream):**

```ts
import httpProxy from "@fastify/http-proxy";

server.register(httpProxy, {
  upstream: "http://internal-api:3002",
  prefix: "/internal",
});
```

**Correct (verify auth in `preHandler` before proxying):**

```ts
import httpProxy from "@fastify/http-proxy";

server.register(httpProxy, {
  upstream: "http://internal-api:3002",
  prefix: "/internal",
  preHandler: async (request, reply) => {
    if (!request.headers.authorization) {
      reply.code(401).send({ error: "Unauthorized" });
    }
  },
});
```

### Use `@fastify/reply-from` for Fine-Grained Proxying

**Incorrect (manually piping responses without proper header handling):**

```ts
import Fastify from "fastify";
import { pipeline } from "node:stream/promises";

const server = Fastify({ logger: true });

server.get("/users/:id", async (request, reply) => {
  const response = await fetch(
    `http://backend:3001/api/users/${request.params.id}`,
  );
  reply.status(response.status);
  await pipeline(response.body, reply.raw);
});
```

**Correct (use `reply.from()` with request/response manipulation):**

```bash
npm install @fastify/reply-from
```

```ts
import Fastify from "fastify";
import replyFrom from "@fastify/reply-from";

const server = Fastify({ logger: true });

server.register(replyFrom, {
  base: "http://backend-service:3001",
});

server.get("/users/:id", async (request, reply) => {
  return reply.from(`/api/users/${request.params.id}`, {
    rewriteRequestHeaders: (originalReq, headers) => ({
      ...headers,
      "x-request-id": request.id,
      "x-forwarded-for": request.ip,
    }),
    onResponse: (request, reply, res) => {
      reply.header("x-proxy", "fastify");
      reply.send(res);
    },
  });
});
```

### API Gateway with Multiple Backends

**Incorrect (hardcoding upstream URLs in each route handler):**

```ts
server.get("/users/*", async (request, reply) => {
  const res = await fetch(`http://users-service:3001${request.url}`);
  return res.json();
});

server.get("/orders/*", async (request, reply) => {
  const res = await fetch(`http://orders-service:3002${request.url}`);
  return res.json();
});
```

**Correct (register scoped plugins with `reply.from()` per service):**

```ts
import Fastify from "fastify";
import replyFrom from "@fastify/reply-from";

const server = Fastify({ logger: true });

const services = {
  users: "http://users-service:3001",
  orders: "http://orders-service:3002",
  products: "http://products-service:3003",
};

server.register(replyFrom);

server.register(
  async function (fastify) {
    fastify.all("/*", async (request, reply) => {
      return reply.from(request.url.replace("/users", ""), {
        base: services.users,
      });
    });
  },
  { prefix: "/users" },
);

server.register(
  async function (fastify) {
    fastify.all("/*", async (request, reply) => {
      return reply.from(request.url.replace("/orders", ""), {
        base: services.orders,
      });
    });
  },
  { prefix: "/orders" },
);

server.register(
  async function (fastify) {
    fastify.all("/*", async (request, reply) => {
      return reply.from(request.url.replace("/products", ""), {
        base: services.products,
      });
    });
  },
  { prefix: "/products" },
);
```

### Handle Upstream Errors

**Incorrect (no error handling when upstream is unavailable):**

```ts
server.get("/data", async (request, reply) => {
  return reply.from("/data");
});
```

**Correct (handle upstream errors with `onError` and per-route fallback):**

```ts
import replyFrom from "@fastify/reply-from";

server.register(replyFrom, {
  base: "http://backend:3001",
  onError: (reply, error) => {
    reply.log.error({ err: error }, "Proxy error");
    reply.code(502).send({
      error: "Bad Gateway",
      message: "Upstream service unavailable",
    });
  },
});

server.get("/data", async (request, reply) => {
  try {
    return await reply.from("/data");
  } catch (error) {
    request.log.error({ err: error }, "Failed to proxy request");
    return reply.code(503).send({
      error: "Service Unavailable",
      retryAfter: 30,
    });
  }
});
```

### WebSocket Proxying

**Correct (enable WebSocket proxying with `@fastify/http-proxy`):**

```ts
import Fastify from "fastify";
import httpProxy from "@fastify/http-proxy";

const server = Fastify({ logger: true });

server.register(httpProxy, {
  upstream: "http://ws-backend:3001",
  prefix: "/ws",
  websocket: true,
});
```

### Timeout Configuration

**Correct (configure proxy timeouts to avoid hanging requests):**

```ts
import replyFrom from "@fastify/reply-from";

server.register(replyFrom, {
  base: "http://backend:3001",
  http: {
    requestOptions: {
      timeout: 30000,
    },
  },
});
```

### Testing Proxied Routes

**Correct (test proxy routes using `inject()` with a mock upstream):**

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Fastify from "fastify";
import httpProxy from "@fastify/http-proxy";

describe("proxy routes", () => {
  let upstream;
  let gateway;

  beforeAll(async () => {
    upstream = Fastify();
    upstream.get("/v1/users", async () => {
      return [{ id: 1, name: "Alice" }];
    });
    await upstream.listen({ port: 0 });

    const port = upstream.addresses()[0].port;
    gateway = Fastify({ logger: false });
    gateway.register(httpProxy, {
      upstream: `http://127.0.0.1:${port}`,
      prefix: "/api",
      rewritePrefix: "/v1",
    });
    await gateway.ready();
  });

  afterAll(async () => {
    await gateway.close();
    await upstream.close();
  });

  it("proxies GET /api/users to upstream /v1/users", async () => {
    const response = await gateway.inject({
      method: "GET",
      url: "/api/users",
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([{ id: 1, name: "Alice" }]);
  });
});
```

Reference: [@fastify/http-proxy](https://github.com/fastify/fastify-http-proxy) | [@fastify/reply-from](https://github.com/fastify/fastify-reply-from) | [Fastify Reply](https://fastify.dev/docs/latest/Reference/Reply/)
