---
title: Hooks and Lifecycle
impact: MEDIUM
impactDescription: Proper use of hooks enables clean cross-cutting concerns and request pipeline control
tags: hooks, lifecycle, middleware, onRequest, preParsing, preValidation, preHandler, preSerialization, onSend, onResponse, onError, onTimeout, onRequestAbort, onReady, onListen, onClose, onRoute, onRegister
---

## Hooks and Lifecycle

Fastify uses a hook-based lifecycle instead of traditional middleware. Hooks give fine-grained control over the request/response pipeline. Understanding the lifecycle order and using the right hook for each concern is critical.

### Lifecycle Order

```
Incoming Request
  └─ onRequest          ← IP blocking, rate limiting, CORS
      └─ preParsing     ← stream modification, decompression
          └─ preValidation  ← custom auth token extraction
              └─ preHandler ← authentication, authorization
                  └─ handler (your route)
                      └─ preSerialization  ← augment/transform response object
                          └─ onSend        ← modify serialized payload / set headers
                              └─ onResponse ← logging, metrics (after response sent)

Error in any step → onError → onSend → onResponse
Timeout in any step → onTimeout
Client abort → onRequestAbort
```

---

## Request/Reply Hooks

### `onRequest` — Earliest Entry Point

Runs before the body is parsed. Best for IP blocking, rate limiting, CORS, and request logging.

**Incorrect (rate limiting in the handler):**

```ts
server.get("/data", async (request, reply) => {
  // WRONG: body already parsed before this check
  if (await isRateLimited(request.ip)) {
    reply.status(429);
    return { error: "Too Many Requests" };
  }
  return fetchData();
});
```

**Correct (rate limiting in `onRequest`):**

```ts
fastify.addHook("onRequest", async (request, reply) => {
  // Runs before parsing — minimal overhead for rejected requests
  if (await isRateLimited(request.ip)) {
    reply.status(429);
    return reply.send({ error: "Too Many Requests" });
  }
});
```

---

### `preParsing` — Intercept the Raw Body Stream

Runs after `onRequest` but before the body is parsed. Use to wrap or replace the raw request stream (e.g. decompression, decryption).

**Correct (wrap stream for custom decompression):**

```ts
fastify.addHook("preParsing", async (request, reply, payload) => {
  // `payload` is the raw ReadableStream
  // Return a transformed stream or the original
  return decompress(payload);
});
```

---

### `preValidation` — Before Schema Validation

Runs after body parsing, before schema validation. Use for custom body transformations or token extraction that must happen before validation.

**Correct (normalize request body before validation):**

```ts
fastify.addHook("preValidation", async (request, reply) => {
  if (request.body && typeof request.body === "object") {
    // Normalize field names before schema validation runs
    const body = request.body as Record<string, unknown>;
    body.email = body.email?.toString().toLowerCase();
  }
});
```

---

### `preHandler` — Authentication and Authorization

Runs after validation, just before the route handler. Best place for authentication and authorization checks.

**Incorrect (authentication in the handler):**

```ts
server.get("/profile", async (request, reply) => {
  // WRONG: auth logic mixed into business logic
  const token = request.headers.authorization;
  if (!token) {
    reply.status(401);
    return { error: "Unauthorized" };
  }
  const user = await verifyToken(token);
  if (!user) {
    reply.status(401);
    return { error: "Unauthorized" };
  }
  return getUserProfile(user.id);
});
```

**Correct (authentication as a `preHandler` hook):**

```ts
async function authHook(request: FastifyRequest, reply: FastifyReply) {
  const token = request.headers.authorization?.replace("Bearer ", "");
  if (!token) {
    reply.status(401);
    return reply.send({ error: "Unauthorized" });
  }
  try {
    request.user = await verifyToken(token);
  } catch {
    reply.status(401);
    return reply.send({ error: "Unauthorized" });
  }
}

server.get("/profile", { preHandler: [authHook] }, async (request) => {
  // Clean handler — only business logic
  return getUserProfile(request.user.id);
});
```

---

### `preSerialization` — Augment the Response Payload

Runs after the handler returns, before the response object is serialized to JSON. Use to add metadata to every response.

**Correct (wrap all responses with a standard envelope):**

```ts
fastify.addHook("preSerialization", async (request, reply, payload) => {
  // `payload` is the value returned by the handler (not yet serialized)
  return {
    data: payload,
    meta: {
      requestId: request.id,
      timestamp: new Date().toISOString(),
    },
  };
});
```

> **Note:** `preSerialization` is NOT called when the payload is a `string`, `Buffer`, `stream`, or `null`.

---

### `onError` — Hook Into the Error Flow

Runs when an error is thrown during the request lifecycle. Use for custom error logging or error transformation before the error handler fires.

**Correct (log errors with additional context):**

```ts
fastify.addHook("onError", async (request, reply, error) => {
  // Runs before the error handler — use for side effects only
  request.log.error(
    { err: error, url: request.url, method: request.method },
    "Request error",
  );
});
```

> **Note:** `onError` is for side effects (logging, metrics). To modify the error response, use `setErrorHandler` instead.

---

### `onSend` — Modify the Serialized Payload

Runs after serialization, just before the response is sent. Use to modify the serialized string/buffer or set final response headers.

**Correct (inject `X-Request-Id` header into every response):**

```ts
fastify.addHook("onSend", async (request, reply, payload) => {
  reply.header("X-Request-Id", request.id);
  return payload; // must return payload (possibly modified)
});
```

**Correct (compress or modify the serialized payload):**

```ts
fastify.addHook("onSend", async (request, reply, payload) => {
  if (typeof payload === "string" && payload.length > 1024) {
    reply.header("Content-Encoding", "gzip");
    return gzipPayload(payload);
  }
  return payload;
});
```

---

### `onResponse` — After the Response Is Sent

Runs after the response has been sent to the client. Use for access logging, metrics, and cleanup. Cannot modify the response.

**Correct (record request duration metrics):**

```ts
fastify.addHook("onResponse", async (request, reply) => {
  const duration = reply.elapsedTime;
  metrics.record({
    method: request.method,
    url: request.routeOptions.url,
    statusCode: reply.statusCode,
    duration,
  });
});
```

---

### `onTimeout` — Handle Request Timeouts

Runs when the request times out (connection timeout, not route timeout). Use to log timeout events.

**Correct (log timed-out requests):**

```ts
fastify.addHook("onTimeout", async (request, reply) => {
  request.log.warn(
    { url: request.url, method: request.method },
    "Request timed out",
  );
});
```

---

### `onRequestAbort` — Handle Client Disconnects

Runs when the client closes the connection before a response is sent. Use to cancel in-flight work.

**Correct (cancel in-flight database queries on abort):**

```ts
fastify.addHook("onRequestAbort", async (request) => {
  request.log.info({ url: request.url }, "Client aborted request");
  // Cancel any in-progress operations tied to this request
  await request.dbContext?.cancel();
});
```

---

## Application Hooks

### `onReady` — Before Server Starts Listening

Runs when `fastify.ready()` is called, after all plugins are loaded but before the server starts accepting connections. Use for startup checks, warming caches, and preflight validation.

**Correct (verify external dependencies are reachable):**

```ts
fastify.addHook("onReady", async () => {
  const healthy = await checkDatabaseConnection();
  if (!healthy) {
    throw new Error("Database is not reachable — aborting startup");
  }
  fastify.log.info("All dependencies healthy");
});
```

---

### `onListen` — After Server Starts Listening

Runs after the server has successfully bound to a port and is accepting connections.

**Correct (log the server address after startup):**

```ts
fastify.addHook("onListen", async () => {
  const address = fastify.server.address();
  const addr =
    address && typeof address === "object"
      ? `${address.address}:${address.port}`
      : String(address);
  fastify.log.info(`Server listening at ${addr}`);
});
```

---

### `onClose` — Server Shutdown Cleanup

Runs when `fastify.close()` is called. Use to close database connections, flush buffers, and release external resources.

**Correct (close database connection on shutdown):**

```ts
fastify.addHook("onClose", async (instance) => {
  await instance.db.end();
  instance.log.info("Database connection closed");
});
```

---

### `onRoute` — React to Route Registration

Runs synchronously each time a route is added. Use for introspection, documentation generation, or applying global defaults.

**Correct (auto-attach auth hook to routes with `auth: true` config):**

```ts
fastify.addHook("onRoute", (routeOptions) => {
  if (routeOptions.config?.auth === true) {
    const existing = routeOptions.preHandler ?? [];
    routeOptions.preHandler = [
      ...(Array.isArray(existing) ? existing : [existing]),
      authHook,
    ];
  }
});
```

---

### `onRegister` — React to Plugin Registration

Runs each time `fastify.register()` is called with a new plugin scope. Use for cross-cutting setup across scopes.

**Correct (log every plugin registration):**

```ts
fastify.addHook("onRegister", (instance, opts) => {
  instance.log.debug({ prefix: opts.prefix }, "Plugin registered");
});
```

---

## Scoping Hooks with Encapsulation

**Incorrect (global auth hook blocks public routes):**

```ts
// WRONG: this hook applies to ALL routes — blocks /health
fastify.addHook("preHandler", async (request, reply) => {
  if (!request.headers.authorization) {
    reply.status(401);
    return reply.send({ error: "Unauthorized" });
  }
});

fastify.get("/health", async () => ({ status: "ok" }));
fastify.get("/profile", async (request) => getProfile(request.user));
```

**Correct (hook scoped to only the protected plugin):**

```ts
async function protectedRoutes(fastify: FastifyInstance) {
  // This hook applies ONLY to routes inside this plugin scope
  fastify.addHook("preHandler", async (request, reply) => {
    if (!request.headers.authorization) {
      reply.status(401);
      return reply.send({ error: "Unauthorized" });
    }
  });

  fastify.get("/profile", async (request) => getProfile(request.user));
  fastify.get("/settings", async (request) => getSettings(request.user));
}

async function publicRoutes(fastify: FastifyInstance) {
  // No auth hook here — these routes are public
  fastify.get("/health", async () => ({ status: "ok" }));
}

server.register(protectedRoutes, { prefix: "/api" });
server.register(publicRoutes);
```

---

## Route-Level Hooks

Apply hooks to individual routes using the route options object.

**Correct (per-route hooks using route options):**

```ts
server.get(
  "/admin/settings",
  {
    onRequest: [rateLimitHook],
    preHandler: [authHook, adminOnlyHook],
  },
  async (request) => {
    return getAdminSettings();
  },
);
```

---

## Async vs Callback Style

Prefer async hooks. Use the callback (`done`) style only when wrapping legacy synchronous code.

**Incorrect (mixing async + done callback):**

```ts
fastify.addHook("onRequest", async (request, reply, done) => {
  // WRONG: done is not a parameter of async hooks
  done();
});
```

**Correct (async hook):**

```ts
fastify.addHook("onRequest", async (request, reply) => {
  await doSomething();
  // No done() needed — just return or throw
});
```

**Correct (callback hook for sync code):**

```ts
fastify.addHook("onRequest", (request, reply, done) => {
  doSomethingSync();
  done();
});
```

Reference: [Fastify Lifecycle](https://fastify.dev/docs/latest/Reference/Lifecycle/) | [Fastify Hooks](https://fastify.dev/docs/latest/Reference/Hooks/)
