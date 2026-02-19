---
title: Error Handling
impact: HIGH
impactDescription: Consistent error handling improves API reliability, debugging, and client experience
tags: errors, error-handling, custom-errors, not-found, status-codes
---

## Error Handling

Fastify provides a powerful error handling system. Use custom error handlers, proper HTTP status codes, and structured error responses. Avoid leaking internal details to clients while ensuring meaningful error messages for debugging.

### Set a Custom Error Handler

**Incorrect (no custom error handler, leaking stack traces):**

```ts
import Fastify from "fastify";

const server = Fastify();

server.get("/users/:id", async (request, reply) => {
  // If this throws, Fastify sends the raw error with stack trace
  const user = await db.findUser(request.params.id);
  return user;
});
```

**Correct (custom error handler with structured responses):**

```ts
import Fastify from "fastify";

const server = Fastify({ logger: true });

server.setErrorHandler(async (error, request, reply) => {
  // Log the full error
  request.log.error(error);

  // Validation errors from schema validation
  if (error.validation) {
    reply.status(400);
    return {
      statusCode: 400,
      error: "Bad Request",
      message: error.message,
    };
  }

  // Custom application errors
  if (error.statusCode) {
    reply.status(error.statusCode);
    return {
      statusCode: error.statusCode,
      error: error.name,
      message: error.message,
    };
  }

  // Unexpected errors — don't leak internals
  reply.status(500);
  return {
    statusCode: 500,
    error: "Internal Server Error",
    message: "An unexpected error occurred",
  };
});
```

### Use `createError` from `@fastify/error`

**Incorrect (throwing plain Error objects):**

```ts
server.get("/users/:id", async (request, reply) => {
  const user = await findUser(request.params.id);
  if (!user) {
    throw new Error("User not found"); // no status code, generic error
  }
  return user;
});
```

**Correct (use @fastify/error for typed, reusable errors):**

```ts
import createError from "@fastify/error";

const UserNotFoundError = createError(
  "USER_NOT_FOUND",
  "User %s not found",
  404,
);
const InsufficientPermissionsError = createError(
  "INSUFFICIENT_PERMISSIONS",
  "You do not have permission to %s",
  403,
);

server.get("/users/:id", async (request, reply) => {
  const { id } = request.params as { id: string };
  const user = await findUser(id);
  if (!user) {
    throw new UserNotFoundError(id);
  }
  return user;
});
```

### Handle 404 with `setNotFoundHandler`

**Correct (custom 404 handler):**

```ts
server.setNotFoundHandler(async (request, reply) => {
  reply.status(404);
  return {
    statusCode: 404,
    error: "Not Found",
    message: `Route ${request.method} ${request.url} not found`,
  };
});
```

### Use Reply Status Codes Correctly

**Incorrect (setting status after sending):**

```ts
server.post("/users", async (request, reply) => {
  const user = await createUser(request.body);
  return reply.send(user); // defaults to 200, should be 201
});
```

**Correct (set status before returning):**

```ts
server.post("/users", async (request, reply) => {
  const user = await createUser(request.body);
  reply.status(201);
  return user;
});
```

### Simplify with `@fastify/sensible`

`@fastify/sensible` adds convenient HTTP error methods and utilities to your Fastify instance, reducing boilerplate for common error responses.

```bash
npm install @fastify/sensible
```

**Register the plugin:**

```ts
import Fastify from "fastify";
import sensible from "@fastify/sensible";

const server = Fastify({ logger: true });
server.register(sensible);
```

**Use `httpErrors` for clean throws:**

```ts
server.get("/users/:id", async (request, reply) => {
  const { id } = request.params as { id: string };
  const user = await findUser(id);
  if (!user) {
    throw server.httpErrors.notFound(`User ${id} not found`);
  }
  return user;
});

server.put("/users/:id", async (request, reply) => {
  if (!request.user) {
    throw server.httpErrors.unauthorized("Authentication required");
  }
  if (request.user.role !== "admin") {
    throw server.httpErrors.forbidden("Admin access required");
  }
  // update user
});
```

**Use the `to` helper for async error handling without try/catch:**

```ts
server.get("/data", async (request, reply) => {
  const [error, data] = await server.to(fetchExternalData());
  if (error) {
    request.log.error(error);
    throw server.httpErrors.badGateway("External service unavailable");
  }
  return data;
});
```

**Available error methods include:**

- `httpErrors.badRequest(message?)` → 400
- `httpErrors.unauthorized(message?)` → 401
- `httpErrors.forbidden(message?)` → 403
- `httpErrors.notFound(message?)` → 404
- `httpErrors.conflict(message?)` → 409
- `httpErrors.gone(message?)` → 410
- `httpErrors.unprocessableEntity(message?)` → 422
- `httpErrors.tooManyRequests(message?)` → 429
- `httpErrors.internalServerError(message?)` → 500
- `httpErrors.badGateway(message?)` → 502
- `httpErrors.serviceUnavailable(message?)` → 503
- `httpErrors.gatewayTimeout(message?)` → 504

Reference: [@fastify/sensible](https://github.com/fastify/fastify-sensible)

### Scoped Error Handlers

**Correct (different error handling per context):**

```ts
async function apiRoutes(fastify) {
  // JSON error responses for API routes
  fastify.setErrorHandler(async (error, request, reply) => {
    request.log.error(error);
    const statusCode = error.statusCode || 500;
    reply.status(statusCode);
    return {
      statusCode,
      error: error.name || "Error",
      message: error.message,
    };
  });

  fastify.get("/data", async () => {
    return fetchData();
  });
}
```

Reference: [Fastify Error Handling](https://fastify.dev/docs/latest/Reference/Errors/) | [@fastify/error](https://github.com/fastify/fastify-error)
