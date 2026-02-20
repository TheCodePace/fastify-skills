---
title: Configuration Best Practices
impact: HIGH
impactDescription: Proper configuration improves security, reliability, and maintainability across environments
tags: configuration, environment, env, security, logger, options, zod
---

## Configuration Best Practices

Fastify's factory function accepts an options object that controls server behavior. Managing these options properly — along with environment-specific configuration using Zod — is essential for secure, production-ready applications.

### Define an Environment Schema with Zod

**Incorrect (reading `process.env` directly throughout the app):**

```ts
import Fastify from "fastify";

const server = Fastify({
  logger: process.env.NODE_ENV !== "production",
});

server.get("/", async (request, reply) => {
  // Scattered, unvalidated env access
  const dbUrl = process.env.DATABASE_URL;
  const apiKey = process.env.API_KEY;
  return { status: "ok" };
});
```

**Correct (validate and centralize config with Zod):**

```bash
npm install zod
```

`src/schema/env.ts`

```ts
import { z } from "zod";

export const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default("0.0.0.0"),
  DATABASE_URL: z.string().url(),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),
});

export type Env = z.infer<typeof envSchema>;
```

`src/plugins/config.ts`

```ts
import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import { envSchema, type Env } from "../schema/env.js";

declare module "fastify" {
  interface FastifyInstance {
    config: Env;
  }
}

async function configPlugin(fastify: FastifyInstance) {
  const config = envSchema.parse(process.env);
  fastify.decorate("config", config);
}

export default fp(configPlugin, {
  name: "config-plugin",
});
```

### Configure the Logger Properly

**Incorrect (using `console.log` or a bare boolean):**

```ts
import Fastify from "fastify";

const server = Fastify({ logger: true });

server.get("/", async (request, reply) => {
  console.log("Request received"); // loses structured logging
  return { status: "ok" };
});
```

**Correct (use Pino options for environment-appropriate logging with the env schema):**

```ts
import Fastify from "fastify";
import { envSchema } from "./schema/env.js";

const config = envSchema.parse(process.env);

const envToLogger: Record<string, object> = {
  development: {
    level: "debug",
    transport: {
      target: "pino-pretty",
      options: {
        translateTime: "HH:MM:ss Z",
        ignore: "pid,hostname",
      },
    },
  },
  production: {
    level: config.LOG_LEVEL,
  },
  test: {
    level: "silent",
  },
};

const server = Fastify({
  logger: envToLogger[config.NODE_ENV] ?? true,
});
```

### Set Appropriate Security Options

**Incorrect (using defaults without considering security):**

```ts
import Fastify from "fastify";

// Defaults leave proto and constructor poisoning at 'error',
// but other options are insecure for production
const server = Fastify();
```

**Correct (use a `buildServer` function with explicit security options):**

```ts
import Fastify from "fastify";
import type { Env } from "./schema/env.js";

interface BuildServerOptions {
  config: Env;
}

function buildServer({ config }: BuildServerOptions) {
  const server = Fastify({
    // Keep prototype poisoning protection at 'error' (default)
    onProtoPoisoning: "error",
    onConstructorPoisoning: "error",

    // Set a request timeout to protect against slow requests (DoS)
    requestTimeout: 120_000, // 2 minutes

    // Limit payload size to prevent abuse
    bodyLimit: 1_048_576, // 1 MiB (default), adjust as needed

    // Return 503 when server is closing for graceful shutdown
    return503OnClosing: true,

    // Close idle connections on shutdown for clean exits
    forceCloseConnections: "idle",
  });

  return server;
}
```

### Configure `trustProxy` When Behind a Reverse Proxy

**Incorrect (not configuring `trustProxy` when behind a load balancer):**

```ts
import Fastify from "fastify";

const server = Fastify();

server.get("/", async (request, reply) => {
  // request.ip will be the proxy's IP, not the client's
  return { ip: request.ip };
});
```

**Correct (set `trustProxy` to get the real client IP):**

```ts
import Fastify from "fastify";

const server = Fastify({
  // Trust first proxy hop (e.g., behind a single load balancer)
  trustProxy: true,
});

server.get("/", async (request, reply) => {
  // request.ip is now the real client IP from X-Forwarded-For
  // request.hostname uses X-Forwarded-Host
  // request.protocol uses X-Forwarded-Proto
  return {
    ip: request.ip,
    host: request.hostname,
    protocol: request.protocol,
  };
});
```

> For more control, use a specific IP, CIDR range, or count instead of `true`:
> `trustProxy: '127.0.0.1'` or `trustProxy: 1`.

### Use the `listen` Options Correctly

**Incorrect (listening on default without considering deployment):**

```ts
const server = buildServer({ config });
await server.listen({ port: 3000 });
// Listens on localhost — won't work in Docker containers
```

**Correct (use the parsed env config for host and port):**

```ts
import { envSchema } from "./schema/env.js";

const config = envSchema.parse(process.env);
const server = buildServer({ config });

await server.listen({
  port: config.PORT,
  host: config.HOST,
});
```

### Use a Complete `buildServer` Factory with Configuration

**Correct (combine all configuration best practices):**

`src/schema/env.ts`

```ts
import { z } from "zod";

export const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default("0.0.0.0"),
  DATABASE_URL: z.string().url(),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),
});

export type Env = z.infer<typeof envSchema>;
```

`src/server.ts`

```ts
import path from "node:path";
import { fileURLToPath } from "node:url";
import Fastify from "fastify";
import autoload from "@fastify/autoload";
import type { Env } from "./schema/env.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

const envToLogger: Record<string, object> = {
  development: {
    level: "debug",
    transport: {
      target: "pino-pretty",
      options: {
        translateTime: "HH:MM:ss Z",
        ignore: "pid,hostname",
      },
    },
  },
  production: {
    level: "info",
  },
  test: {
    level: "silent",
  },
};

export interface BuildServerOptions {
  config: Env;
  trustProxy?: boolean | string | number;
}

export function buildServer({ config, trustProxy }: BuildServerOptions) {
  const server = Fastify({
    logger: envToLogger[config.NODE_ENV] ?? true,
    trustProxy: trustProxy ?? false,
    requestTimeout: 120_000,
    bodyLimit: 1_048_576,
    return503OnClosing: true,
    forceCloseConnections: "idle",
  });

  // Autoload plugins (config, db, auth — all use fastify-plugin)
  server.register(autoload, {
    dir: path.join(__dirname, "plugins"),
  });

  // Autoload routes (encapsulated, prefixes from folder names)
  server.register(autoload, {
    dir: path.join(__dirname, "routes"),
    autoHooks: true,
    cascadeHooks: true,
  });

  return server;
}
```

### Handle Graceful Shutdown with `close-with-grace`

Use `close-with-grace` to handle process signals and errors in a consistent way. It listens for `SIGINT`, `SIGTERM`, uncaught exceptions, and unhandled rejections automatically.

```bash
npm install close-with-grace
```

**Correct (use `close-with-grace` in the app entry point):**

`src/app.ts`

```ts
import closeWithGrace from "close-with-grace";
import { envSchema } from "./schema/env.js";
import { buildServer } from "./server.js";

const config = envSchema.parse(process.env);
const server = buildServer({ config });

closeWithGrace({ delay: 10_000 }, async ({ signal, err }) => {
  if (err) {
    server.log.error({ err }, "server closing with error");
  } else {
    server.log.info(`${signal} received, server closing`);
  }
  await server.close();
});

await server.listen({
  port: config.PORT,
  host: config.HOST,
});
```

**Correct (handle cleanup in a plugin with `onClose` hook):**

`src/plugins/db.ts`

```ts
import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";

async function dbPlugin(fastify: FastifyInstance) {
  const pool = createPool(fastify.config.DATABASE_URL);

  fastify.decorate("db", pool);

  // Clean up the connection pool when the server closes
  fastify.addHook("onClose", async () => {
    fastify.log.info("closing database connection pool");
    await pool.end();
  });
}

export default fp(dbPlugin, {
  name: "db-plugin",
  dependencies: ["config-plugin"],
});
```

When `server.close()` is called by `close-with-grace`, Fastify triggers all registered `onClose` hooks — ensuring plugins clean up their resources (database connections, cache clients, etc.) in the correct order.

Reference: [Fastify Server Options](https://fastify.dev/docs/latest/Reference/Server/) | [close-with-grace](https://github.com/mcollina/close-with-grace)
