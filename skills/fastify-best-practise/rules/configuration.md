---
title: Configuration Best Practices
impact: HIGH
impactDescription: Proper configuration improves security, reliability, and maintainability across environments
tags: configuration, environment, env, security, logger, options
---

## Configuration Best Practices

Fastify's factory function accepts an options object that controls server behavior. Managing these options properly — along with environment-specific configuration — is essential for secure, production-ready applications.

### Use `@fastify/env` for Environment Configuration

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

**Correct (validate and centralize config with `@fastify/env`):**

```bash
npm install @fastify/env
```

`src/plugins/config.ts`

```ts
import fp from "fastify-plugin";
import fastifyEnv from "@fastify/env";
import type { FastifyInstance } from "fastify";

const schema = {
  type: "object",
  required: ["PORT", "DATABASE_URL"],
  properties: {
    NODE_ENV: {
      type: "string",
      default: "development",
    },
    PORT: {
      type: "number",
      default: 3000,
    },
    DATABASE_URL: {
      type: "string",
    },
    LOG_LEVEL: {
      type: "string",
      default: "info",
    },
  },
};

async function configPlugin(fastify: FastifyInstance) {
  await fastify.register(fastifyEnv, {
    confKey: "config",
    schema,
    dotenv: true,
  });
}

export default fp(configPlugin, {
  name: "config-plugin",
});
```

```ts
// Type your config with module augmentation
declare module "fastify" {
  interface FastifyInstance {
    config: {
      NODE_ENV: string;
      PORT: number;
      DATABASE_URL: string;
      LOG_LEVEL: string;
    };
  }
}
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

**Correct (use Pino options for environment-appropriate logging):**

```ts
import Fastify from "fastify";

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

const environment = process.env.NODE_ENV ?? "development";

const server = Fastify({
  logger: envToLogger[environment] ?? true,
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

**Correct (explicitly configure security-relevant options):**

```ts
import Fastify from "fastify";

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

### Use `pluginTimeout` for Debugging Slow Plugins

**Incorrect (ignoring plugin timeout during development):**

```ts
import Fastify from "fastify";

// Default pluginTimeout is 10000ms — may cause confusing
// ERR_AVVIO_PLUGIN_TIMEOUT errors if a plugin takes too long
const server = Fastify();
```

**Correct (increase timeout for known slow plugins in development):**

```ts
import Fastify from "fastify";

const server = Fastify({
  // Increase plugin loading timeout in development
  // when dealing with slow database connections, etc.
  pluginTimeout: process.env.NODE_ENV === "development" ? 60_000 : 10_000,
});
```

### Use the `listen` Options Correctly

**Incorrect (listening on default without considering deployment):**

```ts
const server = buildServer();
await server.listen({ port: 3000 });
// Listens on localhost — won't work in Docker containers
```

**Correct (bind to `0.0.0.0` for containerized environments):**

```ts
const server = buildServer();

await server.listen({
  port: Number(process.env.PORT) || 3000,
  // Use 0.0.0.0 in Docker/containers, localhost for local dev
  host: process.env.HOST || "0.0.0.0",
});
```

### Use a Complete `buildServer` Factory with Configuration

**Correct (combine all configuration best practices):**

```ts
import path from "node:path";
import { fileURLToPath } from "node:url";
import Fastify from "fastify";
import autoload from "@fastify/autoload";

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

interface BuildServerOptions {
  logger?: boolean | object;
  trustProxy?: boolean | string | number;
}

function buildServer(options: BuildServerOptions = {}) {
  const environment = process.env.NODE_ENV ?? "development";

  const server = Fastify({
    logger: options.logger ?? envToLogger[environment] ?? true,
    trustProxy: options.trustProxy ?? false,
    requestTimeout: 120_000,
    bodyLimit: 1_048_576,
    return503OnClosing: true,
    forceCloseConnections: "idle",
    pluginTimeout: environment === "development" ? 60_000 : 10_000,
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

export default buildServer;
```

### Handle Graceful Shutdown

**Correct (listen for termination signals and close cleanly):**

`src/app.ts`

```ts
import buildServer from "./server.js";

const server = buildServer();

const signals: NodeJS.Signals[] = ["SIGINT", "SIGTERM"];

for (const signal of signals) {
  process.on(signal, async () => {
    server.log.info(`Received ${signal}, shutting down gracefully`);
    await server.close();
    process.exit(0);
  });
}

await server.listen({
  port: Number(process.env.PORT) || 3000,
  host: process.env.HOST || "0.0.0.0",
});
```

Reference: [Fastify Server Options](https://fastify.dev/docs/latest/Reference/Server/) | [@fastify/env](https://github.com/fastify/fastify-env)
