---
title: Performance
impact: HIGH
impactDescription: Correct schema usage, serialization, and resource management unlock Fastify's full speed
tags: performance, optimization, serialization, schema, benchmarking, caching, streaming
---

## Performance

Fastify is the fastest Node.js web framework, but many of its performance gains are opt-in. They require correct schema usage, pre-compilation, and avoiding known slow paths.

### Always Define Response Schemas

Response schemas enable `fast-json-stringify`, which is significantly faster than `JSON.stringify`.

**Incorrect (no response schema — falls back to slow `JSON.stringify`):**

```ts
import Fastify from "fastify";

const server = Fastify({ logger: true });

server.get("/users", async () => {
  return db.users.findAll(); // serialized with JSON.stringify
});
```

**Correct (response schema enables `fast-json-stringify`):**

```ts
import Fastify from "fastify";

const server = Fastify({ logger: true });

server.get(
  "/users",
  {
    schema: {
      response: {
        200: {
          type: "array",
          items: {
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
  },
  async () => {
    return db.users.findAll();
  },
);
```

### Pre-compile Schemas with `addSchema` and `$ref`

Add schemas at startup so they are compiled once. Re-use them across routes via `$ref`.

**Incorrect (duplicated inline schemas compiled per route):**

```ts
const userSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    name: { type: "string" },
    email: { type: "string" },
  },
};

// Schema is compiled separately for every route that inlines it
server.get("/users", { schema: { response: { 200: { type: "array", items: userSchema } } } }, handler);
server.get("/users/:id", { schema: { response: { 200: userSchema } } }, handler);
```

**Correct (register shared schemas once, reference with `$ref`):**

```ts
server.addSchema({
  $id: "User",
  type: "object",
  properties: {
    id: { type: "string" },
    name: { type: "string" },
    email: { type: "string" },
  },
});

server.get(
  "/users",
  { schema: { response: { 200: { type: "array", items: { $ref: "User#" } } } } },
  handler,
);

server.get(
  "/users/:id",
  { schema: { response: { 200: { $ref: "User#" } } } },
  handler,
);
```

### Use `@fastify/under-pressure` for Load Shedding

Protect the application from overload by monitoring event-loop delay, heap, and RSS.

**Incorrect (no overload protection — server degrades silently):**

```ts
import Fastify from "fastify";

const server = Fastify({ logger: true });
// No load shedding; under heavy load the server becomes unresponsive
```

**Correct (register `@fastify/under-pressure`):**

```bash
npm install @fastify/under-pressure
```

```ts
import Fastify from "fastify";
import underPressure from "@fastify/under-pressure";

const server = Fastify({ logger: true });

server.register(underPressure, {
  maxEventLoopDelay: 1000,
  maxHeapUsedBytes: 1_000_000_000,
  maxRssBytes: 1_500_000_000,
  maxEventLoopUtilization: 0.98,
  pressureHandler: (_request, reply, type, _value) => {
    reply.code(503).send({
      error: "Service Unavailable",
      message: `Server under pressure: ${type}`,
    });
  },
});
```

### Stream Large Responses

Stream large payloads instead of buffering them into memory.

**Incorrect (read entire file into memory):**

```ts
import { readFile } from "node:fs/promises";

server.get("/large-file", async () => {
  const content = await readFile("./large-file.json", "utf-8");
  return JSON.parse(content); // buffers the whole file, then serializes again
});
```

**Correct (stream the file directly):**

```ts
import { createReadStream } from "node:fs";

server.get("/large-file", async (_request, reply) => {
  const stream = createReadStream("./large-file.json");
  reply.type("application/json");
  return reply.send(stream);
});
```

### Avoid Blocking the Event Loop

Offload CPU-intensive work to a worker-thread pool with `piscina`.

**Incorrect (blocking computation on the main thread):**

```ts
server.post("/compute", async (request) => {
  // Blocks the event loop for every request
  return heavyComputation(request.body);
});
```

**Correct (offload to a worker-thread pool):**

```ts
import Piscina from "piscina";
import { join } from "node:path";

const pool = new Piscina({
  filename: join(import.meta.dirname, "workers", "compute.js"),
});

server.post("/compute", async (request) => {
  return pool.run(request.body);
});
```

### Configure Payload Limits and Timeouts

Set appropriate body limits and connection timeouts to prevent resource exhaustion.

**Incorrect (default limits for all routes including uploads):**

```ts
import Fastify from "fastify";

const server = Fastify(); // default 1 MiB bodyLimit, no explicit timeouts
```

**Correct (tune global and per-route limits):**

```ts
import Fastify from "fastify";

const server = Fastify({
  bodyLimit: 1_048_576, // 1 MiB global default
  connectionTimeout: 30_000,
  keepAliveTimeout: 5_000,
});

// Allow larger payloads only where needed
server.post(
  "/upload",
  { bodyLimit: 10_485_760 }, // 10 MiB for this route
  uploadHandler,
);
```

### Disable Unnecessary Features in Production

Turn off features you do not use to reduce per-request overhead.

**Incorrect (leaving defaults that add overhead):**

```ts
import Fastify from "fastify";

const server = Fastify({
  logger: true, // logs every request at default level
});
```

**Correct (disable or tune features you do not need):**

```ts
import Fastify from "fastify";

const server = Fastify({
  disableRequestLogging: true, // skip per-request log lines
  trustProxy: false, // no proxy header parsing
  caseSensitive: true, // slight routing speedup
  logger: {
    level: process.env.LOG_LEVEL || "warn",
  },
});
```

### Use Compression for Responses

Compress responses to reduce bandwidth, but only above a reasonable threshold.

**Correct (register `@fastify/compress`):**

```bash
npm install @fastify/compress
```

```ts
import Fastify from "fastify";
import compress from "@fastify/compress";

const server = Fastify({ logger: true });

server.register(compress, {
  global: true,
  threshold: 1024, // only compress responses > 1 KiB
  encodings: ["gzip", "deflate"],
});
```

### Benchmark with Autocannon

Use `autocannon` for reliable HTTP benchmarks. Avoid benchmarking through reverse proxies or with `curl` loops.

**Incorrect (unreliable ad-hoc benchmarking):**

```bash
# Single sequential requests — does not measure throughput
time curl http://localhost:3000/api/users
```

**Correct (use autocannon with concurrent connections):**

```bash
npm install -g autocannon

# 100 connections, 30 seconds, pipelining factor 10
autocannon -c 100 -d 30 -p 10 http://localhost:3000/api/users
```

```ts
// Programmatic benchmarking
import autocannon from "autocannon";

const result = await autocannon({
  url: "http://localhost:3000/api/users",
  connections: 100,
  duration: 30,
  pipelining: 10,
});

console.log(autocannon.printResult(result));
```

### Profile with Flame Graphs

Use `@platformatic/flame` to generate interactive flame graphs and pinpoint bottlenecks.

**Correct (generate a flame graph):**

```bash
npx @platformatic/flame app.js
```

Reference: [Fastify Benchmarking Guide](https://fastify.dev/docs/latest/Guides/Benchmarking/) | [Fastify Validation & Serialization](https://fastify.dev/docs/latest/Reference/Validation-and-Serialization/) | [Fastify Server Options](https://fastify.dev/docs/latest/Reference/Server/)
