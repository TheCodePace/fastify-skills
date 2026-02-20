---
title: Decorators
impact: MEDIUM
impactDescription: Correct use of decorators enables safe, typed extension of the Fastify instance, request, and reply objects
tags: decorators, decorate, decorateRequest, decorateReply, typescript, module-augmentation
---

## Decorators

Fastify decorators allow you to attach custom properties and methods to the Fastify instance, the `Request` object, or the `Reply` object. Use `fastify.decorate()`, `fastify.decorateRequest()`, and `fastify.decorateReply()` to extend Fastify in a safe, encapsulation-aware way.

### Decorate the Fastify Instance

**Incorrect (attaching properties directly to the instance outside the plugin system):**

```ts
import Fastify from "fastify";

const fastify = Fastify();

// WRONG: mutating the instance directly — not encapsulation-aware
(fastify as any).myService = { greet: () => "hello" };
```

**Correct (use `fastify.decorate()`):**

```ts
import Fastify from "fastify";

const fastify = Fastify();

fastify.decorate("myService", {
  greet: () => "hello",
});

fastify.get("/hello", async () => {
  return fastify.myService.greet();
});
```

### Decorate the Request Object

**Incorrect (assigning custom data directly to `request` without declaring the decorator):**

```ts
fastify.addHook("preHandler", async (request) => {
  // WRONG: adds a property that Fastify doesn't know about
  (request as any).user = await authenticate(request);
});
```

**Correct (declare with `decorateRequest` before use):**

```ts
// Declare first — initialise with null for object types
fastify.decorateRequest("user", null);

fastify.addHook("preHandler", async (request, reply) => {
  request.user = await authenticate(request);
});

fastify.get("/profile", async (request) => {
  return { id: request.user.id };
});
```

### Decorate the Reply Object

**Correct (add a helper method to every reply):**

```ts
fastify.decorateReply("sendError", function (this: FastifyReply, statusCode: number, message: string) {
  return this.status(statusCode).send({ error: message });
});

fastify.get("/protected", async (request, reply) => {
  if (!request.headers.authorization) {
    return reply.sendError(401, "Unauthorized");
  }
  return { ok: true };
});
```

### Initialise Object Decorators with `null`

**Incorrect (sharing the same object reference across all requests):**

```ts
// WRONG: every request shares the same `context` object reference
fastify.decorateRequest("context", { requestId: "", traceId: "" });
```

**Correct (use `null` as the initial value and assign a fresh object per request):**

```ts
// Declare with null — Fastify will create an independent slot per request
fastify.decorateRequest("context", null);

fastify.addHook("onRequest", async (request) => {
  // Assign a new object for every request
  request.context = { requestId: request.id, traceId: crypto.randomUUID() };
});
```

### Use Getter / Setter Syntax

**Correct (lazy or computed decorator values using getter syntax):**

```ts
fastify.decorate("config", {
  getter() {
    return {
      dbUrl: process.env.DATABASE_URL ?? "postgres://localhost:5432/mydb",
      port: Number(process.env.PORT) || 3000,
    };
  },
});

fastify.get("/config", async () => {
  return fastify.config;
});
```

### Check for Existing Decorators

**Correct (guard against double-registration in shared plugins):**

```ts
if (!fastify.hasDecorator("myService")) {
  fastify.decorate("myService", { greet: () => "hello" });
}

if (!fastify.hasRequestDecorator("user")) {
  fastify.decorateRequest("user", null);
}

if (!fastify.hasReplyDecorator("sendError")) {
  fastify.decorateReply("sendError", function (code: number, msg: string) {
    return this.status(code).send({ error: msg });
  });
}
```

### TypeScript: Augment the Fastify Interfaces

**Incorrect (using `as any` casts instead of proper typing):**

```ts
fastify.decorate("myService", { greet: () => "hello" });

fastify.get("/", async () => {
  return (fastify as any).myService.greet(); // unsafe
});
```

**Correct (use module augmentation to type your decorators):**

```ts
import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

declare module "fastify" {
  interface FastifyInstance {
    myService: { greet: () => string };
    config: { dbUrl: string; port: number };
  }

  interface FastifyRequest {
    user: { id: string; email: string; role: string } | null;
    context: { requestId: string; traceId: string } | null;
  }

  interface FastifyReply {
    sendError: (statusCode: number, message: string) => FastifyReply;
  }
}

fastify.decorate("myService", { greet: () => "hello" });
fastify.decorateRequest("user", null);
fastify.decorateReply("sendError", function (this: FastifyReply, code: number, msg: string) {
  return this.status(code).send({ error: msg });
});
```

### Package Decorators Inside a Plugin

**Correct (encapsulate related decorators in a `fastify-plugin` wrapped plugin for shared use):**

```ts
import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";

declare module "fastify" {
  interface FastifyRequest {
    user: { id: string; role: string } | null;
  }
}

async function decoratorsPlugin(fastify: FastifyInstance) {
  fastify.decorateRequest("user", null);

  fastify.addHook("preHandler", async (request, reply) => {
    const token = request.headers.authorization?.replace("Bearer ", "");
    if (token) {
      request.user = await verifyToken(token);
    }
  });
}

export default fp(decoratorsPlugin, {
  name: "decorators-plugin",
  fastify: "5.x",
});
```

Reference: [Fastify Decorators](https://fastify.dev/docs/latest/Reference/Decorators/) | [Fastify TypeScript](https://fastify.dev/docs/latest/Reference/TypeScript/)
