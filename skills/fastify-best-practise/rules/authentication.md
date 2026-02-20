---
title: Authentication
impact: HIGH
impactDescription: Proper authentication secures APIs and prevents unauthorized access
tags: authentication, jwt, auth, security, bearer, token, preHandler
---

## Authentication

Authentication is critical for securing Fastify APIs. Use `@fastify/jwt` for JWT-based authentication and `@fastify/auth` to compose multiple auth strategies. Implement auth as a decorator and hook — never inline token parsing in route handlers.

### Setup `@fastify/jwt` as a Plugin

**Incorrect (inline token verification in every route):**

```ts
import Fastify from "fastify";
import jwt from "jsonwebtoken";

const server = Fastify();

server.get("/profile", async (request, reply) => {
  const token = request.headers.authorization?.replace("Bearer ", "");
  if (!token) {
    reply.status(401);
    return { error: "Unauthorized" };
  }
  try {
    const decoded = jwt.verify(token, "my-secret");
    return { user: decoded };
  } catch {
    reply.status(401);
    return { error: "Invalid token" };
  }
});
```

**Correct (register `@fastify/jwt` as a shared plugin):**

```bash
npm install @fastify/jwt
```

`src/plugins/jwt.ts`

```ts
import fp from "fastify-plugin";
import fjwt from "@fastify/jwt";

async function jwtPlugin(fastify) {
  await fastify.register(fjwt, {
    secret: fastify.config.JWT_SECRET,
  });

  fastify.decorate("authenticate", async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch (error) {
      reply.status(401);
      return reply.send({ error: "Unauthorized" });
    }
  });
}

export default fp(jwtPlugin, {
  name: "jwt",
  fastify: "5.x",
  dependencies: ["config"],
});
```

`src/server.ts`

```ts
import Fastify from "fastify";
import autoload from "@fastify/autoload";
import { join } from "node:path";

function buildServer(options = {}) {
  const server = Fastify({ logger: options.logger || false });

  server.register(autoload, {
    dir: join(import.meta.dirname, "plugins"),
  });

  server.register(autoload, {
    dir: join(import.meta.dirname, "routes"),
    autoHooks: true,
    cascadeHooks: true,
  });

  return server;
}

export default buildServer;
```

### Protect Routes with a `preHandler` Hook

**Incorrect (calling verify manually in the handler):**

```ts
server.get("/profile", async (request, reply) => {
  try {
    const user = server.jwt.verify(request.headers.authorization);
    return getUserProfile(user.id);
  } catch {
    reply.status(401);
    return { error: "Unauthorized" };
  }
});
```

**Correct (use the `authenticate` decorator as a preHandler):**

`src/routes/users/index.ts`

```ts
async function userRoutes(fastify) {
  fastify.get(
    "/profile",
    { preHandler: [fastify.authenticate] },
    async (request) => {
      return getUserProfile(request.user.id);
    },
  );
}

export default userRoutes;
```

### Scope Auth to Route Groups with Hooks

**Correct (apply auth to all routes in a plugin using `_hooks.ts`):**

`src/routes/protected/_hooks.ts`

```ts
async function protectedHooks(fastify) {
  fastify.addHook("onRequest", async (request, reply) => {
    await fastify.authenticate(request, reply);
  });
}

export default protectedHooks;
```

`src/routes/protected/dashboard/index.ts`

```ts
async function dashboardRoutes(fastify) {
  // No auth boilerplate — handled by _hooks.ts
  fastify.get("/", async (request) => {
    return getDashboard(request.user.id);
  });
}

export default dashboardRoutes;
```

### Generate and Return Tokens

**Correct (sign tokens on login):**

`src/routes/auth/index.ts`

```ts
async function authRoutes(fastify) {
  fastify.post("/login", async (request, reply) => {
    const { email, password } = request.body;
    const user = await verifyCredentials(email, password);
    if (!user) {
      reply.status(401);
      return { error: "Invalid credentials" };
    }

    const token = fastify.jwt.sign(
      { id: user.id, role: user.role },
      { expiresIn: "1h" },
    );
    return { token };
  });

  fastify.post("/refresh", async (request, reply) => {
    const { token: oldToken } = request.body;
    try {
      const payload = fastify.jwt.verify(oldToken);
      const newToken = fastify.jwt.sign(
        { id: payload.id, role: payload.role },
        { expiresIn: "1h" },
      );
      return { token: newToken };
    } catch {
      reply.status(401);
      return { error: "Invalid or expired token" };
    }
  });
}

export default authRoutes;
```

### Compose Multiple Auth Strategies with `@fastify/auth`

Use `@fastify/auth` when routes need to support multiple authentication methods (e.g., JWT or API key).

```bash
npm install @fastify/auth
```

**Correct (compose JWT + API key strategies):**

`src/plugins/auth.ts`

```ts
import fp from "fastify-plugin";
import fauth from "@fastify/auth";

async function authPlugin(fastify) {
  await fastify.register(fauth);

  fastify.decorate("verifyApiKey", async (request, reply) => {
    const apiKey = request.headers["x-api-key"];
    if (!apiKey) {
      throw new Error("Missing API key");
    }
    const valid = await validateApiKey(apiKey);
    if (!valid) {
      throw new Error("Invalid API key");
    }
    request.user = { type: "api-key" };
  });

  fastify.decorate(
    "verifyJwtOrApiKey",
    fastify.auth([fastify.authenticate, fastify.verifyApiKey]),
  );
}

export default fp(authPlugin, {
  name: "auth",
  fastify: "5.x",
  dependencies: ["jwt"],
});
```

`src/routes/data/index.ts`

```ts
async function dataRoutes(fastify) {
  fastify.get(
    "/",
    { preHandler: [fastify.verifyJwtOrApiKey] },
    async (request) => {
      return getData(request.user);
    },
  );
}

export default dataRoutes;
```

### Add TypeScript Support

**Correct (augment Fastify types for `user` and decorators):**

`src/types.d.ts`

```ts
import type { FastifyRequest, FastifyReply } from "fastify";

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (
      request: FastifyRequest,
      reply: FastifyReply,
    ) => Promise<void>;
    verifyApiKey: (
      request: FastifyRequest,
      reply: FastifyReply,
    ) => Promise<void>;
    verifyJwtOrApiKey: (
      request: FastifyRequest,
      reply: FastifyReply,
    ) => Promise<void>;
  }
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: { id: string; role: string };
    user: { id: string; role: string };
  }
}
```

### Testing Authenticated Routes

**Correct (generate a token in tests with `inject()`):**

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import buildServer from "../src/server.js";

describe("authenticated routes", () => {
  let server;

  beforeAll(async () => {
    server = buildServer({ logger: false });
    await server.ready();
  });

  afterAll(async () => {
    await server.close();
  });

  it("returns 401 without a token", async () => {
    const response = await server.inject({
      method: "GET",
      url: "/profile",
    });
    expect(response.statusCode).toBe(401);
  });

  it("returns profile with a valid token", async () => {
    const token = server.jwt.sign({ id: "user-1", role: "admin" });
    const response = await server.inject({
      method: "GET",
      url: "/profile",
      headers: {
        authorization: `Bearer ${token}`,
      },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toHaveProperty("id", "user-1");
  });
});
```

Reference: [@fastify/jwt](https://github.com/fastify/fastify-jwt) | [@fastify/auth](https://github.com/fastify/fastify-auth) | [Fastify Decorators](https://fastify.dev/docs/latest/Reference/Decorators/)
