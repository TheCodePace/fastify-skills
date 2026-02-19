---
title: Testing with Fastify
impact: HIGH
impactDescription: Reliable tests using inject() ensure correctness without starting HTTP servers
tags: testing, inject, vitest, node-test-runner, integration
---

## Testing with Fastify

Fastify's built-in `inject()` method allows you to test routes without starting an HTTP server. This makes tests fast, isolated, and reliable. Always use the `buildServer` pattern to create testable server instances.

### Use `inject()` Instead of HTTP Requests

**Incorrect (starting a real server in tests):**

```ts
import { test } from "node:test";

test("GET /users", async ({ assert }) => {
  const server = buildServer();
  await server.listen({ port: 0 });
  const address = server.addresses()[0];

  // WRONG: real HTTP requests are slow, flaky, and port-dependent
  const res = await fetch(`http://localhost:${address.port}/users`);
  const data = await res.json();
  assert.ok(Array.isArray(data));

  await server.close();
});
```

**Correct (use inject for fast, reliable tests):**

```ts
import { describe, test, before } from "node:test";
import { buildServer } from "../src/server.js";
import { FastifyInstance } from "fastify";

describe("GET /users", () => {
  let server: FastifyInstance;

  before(() => {
    server = buildServer();
  });

  test("returns a list", async ({ assert }) => {
    const response = await server.inject({
      method: "GET",
      url: "/users",
    });

    assert.strictEqual(response.statusCode, 200);
    const body = response.json();
    assert.ok(Array.isArray(body));
  });
});
```

### Test with `vitest`

**Correct (vitest with inject):**

```ts
import { describe, it, expect, beforeAll } from "vitest";
import { buildServer } from "../src/server.js";
import { FastifyInstance } from "fastify";

describe("User routes", () => {
  let server: FastifyInstance;

  beforeAll(() => {
    server = buildServer({ logger: false });
  });

  it("should return users list", async () => {
    const response = await server.inject({
      method: "GET",
      url: "/users",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(expect.arrayContaining([]));
  });

  it("should create a user", async () => {
    const response = await server.inject({
      method: "POST",
      url: "/users",
      payload: {
        name: "John Doe",
        email: "john@example.com",
      },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      name: "John Doe",
      email: "john@example.com",
    });
  });

  it("should return 400 for invalid body", async () => {
    const response = await server.inject({
      method: "POST",
      url: "/users",
      payload: {
        name: "", // invalid
      },
    });

    expect(response.statusCode).toBe(400);
  });
});
```

### Test Authenticated Routes

**Correct (inject with headers):**

```ts
it("should return profile for authenticated user", async () => {
  const token = generateTestToken({ userId: "123" });

  const response = await server.inject({
    method: "GET",
    url: "/profile",
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  expect(response.statusCode).toBe(200);
  expect(response.json()).toHaveProperty("id", "123");
});

it("should return 401 without token", async () => {
  const response = await server.inject({
    method: "GET",
    url: "/profile",
  });

  expect(response.statusCode).toBe(401);
});
```

### Use the BuildServer Pattern

**Correct (buildServer with autoload enables easy test setup):**

```ts
// src/server.ts
import path from "node:path";
import { fileURLToPath } from "node:url";
import Fastify from "fastify";
import autoload from "@fastify/autoload";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

interface ServerOptions {
  logger?: boolean;
}

export function buildServer(options: ServerOptions = {}) {
  const server = Fastify({
    logger: options.logger ?? false,
  });

  // Autoload shared plugins
  server.register(autoload, {
    dir: path.join(__dirname, "plugins"),
  });

  // Autoload routes
  server.register(autoload, {
    dir: path.join(__dirname, "routes"),
    autoHooks: true,
    cascadeHooks: true,
  });

  return server;
}
```

```ts
// test/helpers.ts
import { buildServer } from "../src/server.js";

export function createTestServer() {
  return buildServer({ logger: false });
}
```

Reference: [Fastify Testing](https://fastify.dev/docs/latest/Guides/Testing/) | [Fastify inject()](https://fastify.dev/docs/latest/Reference/Server/#inject)
