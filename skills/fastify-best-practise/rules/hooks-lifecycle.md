---
title: Hooks and Lifecycle
impact: MEDIUM
impactDescription: Proper use of hooks enables clean cross-cutting concerns and request pipeline control
tags: hooks, lifecycle, middleware, onRequest, preHandler, onSend
---

## Hooks and Lifecycle

Fastify uses a hook-based lifecycle instead of traditional middleware. Hooks give fine-grained control over the request/response pipeline. Understanding the lifecycle order and using the right hook for each concern is critical.

### Lifecycle Order

```
Incoming Request
  └─ onRequest
      └─ preParsing
          └─ preValidation
              └─ preHandler
                  └─ handler (your route)
                      └─ preSerialization
                          └─ onSend
                              └─ onResponse
```

### Use the Right Hook for Each Concern

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

**Correct (authentication as a preHandler hook):**

```ts
async function authHook(request, reply) {
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

server.get("/profile", { preHandler: [authHook] }, async (request, reply) => {
  // Clean handler — only business logic
  return getUserProfile(request.user.id);
});
```

### Scope Hooks with Encapsulation

**Correct (hooks scoped to specific route groups):**

```ts
async function protectedRoutes(fastify) {
  // This hook applies ONLY to routes inside this plugin
  fastify.addHook("preHandler", async (request, reply) => {
    if (!request.headers.authorization) {
      reply.status(401);
      return reply.send({ error: "Unauthorized" });
    }
  });

  fastify.get("/profile", async (request) => {
    return getProfile(request.user);
  });

  fastify.get("/settings", async (request) => {
    return getSettings(request.user);
  });
}

async function publicRoutes(fastify) {
  // No auth hook here — these routes are public
  fastify.get("/health", async () => {
    return { status: "ok" };
  });
}

server.register(protectedRoutes, { prefix: "/api" });
server.register(publicRoutes);
```

### Use `onRequest` for Early Checks

**Correct (rate limiting / IP blocking in onRequest):**

```ts
fastify.addHook("onRequest", async (request, reply) => {
  // Runs before parsing — minimal overhead for rejected requests
  if (isBlocked(request.ip)) {
    reply.status(429);
    return reply.send({ error: "Too Many Requests" });
  }
});
```

### Use `onSend` to Modify Responses

**Correct (add response headers via onSend):**

```ts
fastify.addHook("onSend", async (request, reply, payload) => {
  reply.header("X-Request-Id", request.id);
  return payload;
});
```

### Use `onClose` for Cleanup

**Correct (close database connections on shutdown):**

```ts
fastify.addHook("onClose", async (instance) => {
  await instance.db.end();
  instance.log.info("Database connection closed");
});
```

Reference: [Fastify Lifecycle](https://fastify.dev/docs/latest/Reference/Lifecycle/) | [Fastify Hooks](https://fastify.dev/docs/latest/Reference/Hooks/)
