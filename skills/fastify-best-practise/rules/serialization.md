---
title: Response Serialization
impact: HIGH
impactDescription: 2-3x faster serialization with fast-json-stringify, automatic sensitive field stripping
tags: serialization, response, json-schema, fast-json-stringify, performance, security
---

## Response Serialization

**Impact: HIGH (2-3x faster serialization with fast-json-stringify, automatic sensitive field stripping)**

Fastify compiles `response` schemas into optimized serializer functions at startup using `fast-json-stringify`. This is one of Fastify's primary performance advantages over plain `JSON.stringify`. Without explicit response schemas, Fastify falls back to the slow path. Response schemas also act as a security layer — fields not defined in the schema are automatically stripped from the output.

### Define Response Schemas on Routes

**Incorrect (no response schema, slow path, leaks all fields):**

```ts
import Fastify from "fastify";

const server = Fastify();

server.get("/users/:id", async (request) => {
  const user = await db.findUser(request.params.id);
  // Uses JSON.stringify (slower), all fields including password are sent
  return user;
});
```

**Correct (response schema with fast-json-stringify):**

```ts
import Fastify from "fastify";

const server = Fastify();

server.get(
  "/users/:id",
  {
    schema: {
      response: {
        200: {
          type: "object",
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            email: { type: "string" },
            // password is NOT in schema — automatically stripped
          },
        },
      },
    },
  },
  async (request) => {
    const user = await db.findUser(request.params.id);
    // Even if user has a password field, it won't appear in the response
    return user;
  },
);
```

### Use `addSchema()` and `$ref` for Shared Output Schemas

**Incorrect (duplicating schemas across routes):**

```ts
server.get("/users/:id", {
  schema: {
    response: {
      200: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          email: { type: "string" },
        },
      },
    },
  },
}, handler);

server.get("/users", {
  schema: {
    response: {
      200: {
        type: "array",
        items: {
          // Same schema duplicated
          type: "object",
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            email: { type: "string" },
          },
        },
      },
    },
  },
}, handler);
```

**Correct (register shared schemas with `addSchema` and reference with `$ref`):**

```ts
import Fastify from "fastify";

const server = Fastify();

// Register shared schemas once
server.addSchema({
  $id: "user",
  type: "object",
  properties: {
    id: { type: "string", format: "uuid" },
    name: { type: "string" },
    email: { type: "string", format: "email" },
  },
  required: ["id", "name", "email"],
});

server.addSchema({
  $id: "error",
  type: "object",
  properties: {
    statusCode: { type: "integer" },
    error: { type: "string" },
    message: { type: "string" },
  },
});

// Reference in routes
server.get("/users/:id", {
  schema: {
    response: {
      200: { $ref: "user#" },
      404: { $ref: "error#" },
    },
  },
}, handler);

server.get("/users", {
  schema: {
    response: {
      200: {
        type: "array",
        items: { $ref: "user#" },
      },
    },
  },
}, handler);
```

### Multiple Status Code Schemas

**Correct (define schemas for specific and wildcard status codes):**

```ts
server.get("/users/:id", {
  schema: {
    response: {
      200: { $ref: "user#" },
      404: { $ref: "error#" },
      "4xx": {
        type: "object",
        properties: {
          statusCode: { type: "integer" },
          error: { type: "string" },
          message: { type: "string" },
        },
      },
      "5xx": {
        type: "object",
        properties: {
          statusCode: { type: "integer" },
          error: { type: "string" },
        },
      },
    },
  },
}, async (request, reply) => {
  const user = await db.findUser(request.params.id);
  if (!user) {
    reply.code(404);
    return { statusCode: 404, error: "Not Found", message: "User not found" };
  }
  return user;
});
```

### Custom Per-Route Serialization with `reply.serializer()`

Use `reply.serializer()` to override the default serializer for a specific reply. The provided function receives the payload and must return a string.

**Correct (custom serializer for a specific reply):**

```ts
server.get("/custom", async (request, reply) => {
  const data = await fetchData();
  // Override the default serializer for this reply only
  reply.serializer((payload) => {
    return JSON.stringify({ wrapped: payload, timestamp: Date.now() });
  });
  return data;
});
```

### Manual Serialization with `reply.serialize()`

Use `reply.serialize()` to manually invoke the schema-based serializer for the current route and status code. This is useful inside `preSerialization` hooks or when you need the serialized string for logging or caching.

**Correct (use reply.serialize for manual serialization):**

```ts
server.get(
  "/users/:id",
  {
    schema: {
      response: {
        200: { $ref: "user#" },
      },
    },
  },
  async (request, reply) => {
    const user = await db.findUser(request.params.id);
    // Manually serialize using the route's compiled serializer
    const serialized = reply.serialize(user);
    // Use for caching, logging, etc.
    await cache.set(`user:${user.id}`, serialized);
    return user;
  },
);
```

### Security: Exclude Sensitive Fields

Fields not listed in the response schema are automatically stripped by `fast-json-stringify`. Use this to prevent sensitive data from leaking:

**Incorrect (no schema, sensitive fields leak to client):**

```ts
server.get("/me", async (request) => {
  // Returns { id, name, email, passwordHash, ssn, ... }
  return await db.findUser(request.userId);
});
```

**Correct (schema strips sensitive fields automatically):**

```ts
server.get(
  "/me",
  {
    schema: {
      response: {
        200: {
          type: "object",
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            email: { type: "string" },
            // passwordHash, ssn, etc. are NOT listed — stripped from output
          },
        },
      },
    },
  },
  async (request) => {
    // passwordHash and ssn exist on the object but won't appear in the response
    return await db.findUser(request.userId);
  },
);
```

### Security Warning: Never Use User-Provided Schemas

`fast-json-stringify` compiles schemas into serializer functions using `new Function()`. Never pass untrusted or user-provided schemas — this can lead to arbitrary code execution.

**Incorrect (user-provided schema, code injection risk):**

```ts
server.post("/query", async (request) => {
  // DANGER: compiling user input into a function via new Function()
  const userSchema = request.body.outputSchema;
  reply.serializer(fastJson(userSchema));
  return await db.query(request.body.query);
});
```

**Correct (only use schemas defined in your codebase):**

```ts
// Define all schemas at startup in your own code
server.addSchema({
  $id: "queryResult",
  type: "object",
  properties: {
    rows: { type: "array", items: { type: "object" } },
    count: { type: "integer" },
  },
});

server.post(
  "/query",
  {
    schema: {
      response: {
        200: { $ref: "queryResult#" },
      },
    },
  },
  async (request) => {
    return await db.query(request.body.query);
  },
);
```

Reference: [Fastify Validation and Serialization](https://fastify.dev/docs/latest/Reference/Validation-and-Serialization/) | [fast-json-stringify](https://github.com/fastify/fast-json-stringify) | [Reply API](https://fastify.dev/docs/latest/Reference/Reply/)
