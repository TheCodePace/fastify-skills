---
title: Logging
impact: HIGH
impactDescription: Structured logging improves observability, debugging, and production monitoring
tags: logging, pino, logger, request-log, serializers, redaction
---

## Logging

Fastify has built-in structured logging powered by [Pino](https://getpino.io/). Always enable logging via the `logger` option when creating the server. Use `request.log` inside handlers and hooks rather than a module-level logger so that each log entry is automatically correlated with the request ID.

### Enable the Built-in Logger

**Incorrect (no logger, using `console.log`):**

```ts
import Fastify from "fastify";

const server = Fastify(); // logger disabled by default

server.get("/users", async (request, reply) => {
  console.log("Fetching users"); // not structured, no request correlation
  return fetchUsers();
});
```

**Correct (enable logger and use `request.log`):**

```ts
import Fastify from "fastify";

const server = Fastify({ logger: true });

server.get("/users", async (request, reply) => {
  request.log.info("Fetching users"); // structured, includes reqId automatically
  return fetchUsers();
});
```

### Use Different Log Levels per Environment

**Incorrect (same log level in all environments):**

```ts
const server = Fastify({ logger: true });
```

**Correct (configure level based on environment):**

```ts
import Fastify from "fastify";

const isProd = process.env.NODE_ENV === "production";

const server = Fastify({
  logger: {
    level: isProd ? "info" : "debug",
  },
});
```

### Use Pretty Printing in Development

Pino outputs newline-delimited JSON by default which is ideal for production. In development, use `pino-pretty` for human-readable output.

```bash
npm install --save-dev pino-pretty
```

**Correct (pretty transport in development only):**

```ts
import Fastify from "fastify";

const isDev = process.env.NODE_ENV !== "production";

const server = Fastify({
  logger: {
    level: "debug",
    transport: isDev
      ? {
          target: "pino-pretty",
          options: {
            translateTime: "HH:MM:ss Z",
            ignore: "pid,hostname",
          },
        }
      : undefined,
  },
});
```

### Redact Sensitive Fields

Never log passwords, tokens, or personal data. Use the `redact` option to mask sensitive fields.

**Incorrect (logging request body that may contain secrets):**

```ts
const server = Fastify({ logger: true });

server.addHook("preHandler", async (request) => {
  request.log.info({ body: request.body }, "Request body"); // may log passwords
});
```

**Correct (redact sensitive paths):**

```ts
import Fastify from "fastify";

const server = Fastify({
  logger: {
    level: "info",
    redact: {
      paths: [
        "req.headers.authorization",
        "req.headers.cookie",
        "body.password",
        "body.token",
        "body.creditCard",
      ],
      censor: "[REDACTED]",
    },
  },
});
```

### Use Custom Serializers

Fastify provides default serializers for `req` and `res`. Override them to control which request/response fields are logged and to add custom fields.

**Incorrect (logging entire request and response objects):**

```ts
server.addHook("onResponse", async (request, reply) => {
  request.log.info({ request, reply }, "Request completed"); // too verbose, may leak data
});
```

**Correct (use custom serializers at server level):**

```ts
import Fastify from "fastify";

const server = Fastify({
  logger: {
    level: "info",
    serializers: {
      req(request) {
        return {
          method: request.method,
          url: request.url,
          hostname: request.hostname,
          remoteAddress: request.ip,
        };
      },
      res(reply) {
        return {
          statusCode: reply.statusCode,
        };
      },
    },
  },
});
```

### Use Child Loggers for Context

Create a child logger to attach additional context (e.g., user ID, tenant ID) to all log entries within a request.

**Incorrect (repeating context in every log call):**

```ts
server.get("/orders", async (request, reply) => {
  const userId = request.user.id;
  request.log.info({ userId }, "Listing orders");
  const orders = await getOrders(userId);
  request.log.info({ userId, count: orders.length }, "Orders fetched");
  return orders;
});
```

**Correct (bind context with a child logger):**

```ts
server.get("/orders", async (request, reply) => {
  const log = request.log.child({ userId: request.user.id });
  log.info("Listing orders");
  const orders = await getOrders(request.user.id);
  log.info({ count: orders.length }, "Orders fetched");
  return orders;
});
```

### Disable Logging for Specific Routes

Some routes (e.g., health checks) are called frequently and produce noisy logs. Disable logging per route.

**Correct (disable logging for health check):**

```ts
server.get("/health", { logLevel: "silent" }, async () => {
  return { status: "ok" };
});
```

### Log at the Right Level

| Level   | Use case                                                           |
| ------- | ------------------------------------------------------------------ |
| `trace` | Very detailed internal flow (disable in production)               |
| `debug` | Diagnostic information useful during development                  |
| `info`  | Normal application events (request received, service started)     |
| `warn`  | Unexpected but recoverable situations                             |
| `error` | Errors that require attention but don't crash the process         |
| `fatal` | Unrecoverable errors — process should exit                        |

```ts
server.get("/payments", async (request, reply) => {
  request.log.debug({ params: request.params }, "Payment request received");

  try {
    const result = await processPayment(request.body);
    request.log.info({ paymentId: result.id }, "Payment processed");
    return result;
  } catch (error) {
    request.log.error({ error }, "Payment processing failed");
    throw error;
  }
});
```

Reference: [Fastify Logging](https://fastify.dev/docs/latest/Reference/Logging/) | [Pino documentation](https://getpino.io/)
