---
title: HTTP/2 Support
impact: MEDIUM
impactDescription: Enables multiplexed connections and improved performance for concurrent requests
tags: http2, h2, h2c, tls, https, server, performance
---

## HTTP/2 Support

**Impact: MEDIUM (enables multiplexed connections and improved performance for concurrent requests)**

Fastify has built-in HTTP/2 support via Node.js core. HTTP/2 improves performance through multiplexed streams, header compression, and server push. Always use HTTP/2 over TLS (`h2`) for public-facing services and consider plain-text HTTP/2 (`h2c`) for internal/service-to-service communication.

### Enable HTTP/2 with TLS (Recommended)

**Incorrect (HTTP/1.1 only, no HTTP/2 support):**

```ts
import Fastify from "fastify";

const server = Fastify({
  logger: true,
});

await server.listen({ port: 3000 });
```

**Correct (HTTP/2 over TLS with HTTP/1.1 fallback):**

```ts
import Fastify from "fastify";
import { readFileSync } from "node:fs";

const server = Fastify({
  http2: true,
  https: {
    allowHTTP1: true, // support HTTP/1.1 clients as fallback
    key: readFileSync("./certs/key.pem"),
    cert: readFileSync("./certs/cert.pem"),
  },
  logger: true,
});

await server.listen({ port: 3000 });
```

Set `allowHTTP1: true` so clients that do not support HTTP/2 can still connect via HTTP/1.1. This is critical for gradual migration and broad compatibility.

### HTTP/2 Plain Text (h2c) for Internal Services

**Incorrect (using TLS for internal service-to-service calls that already run inside a trusted network):**

```ts
import Fastify from "fastify";
import { readFileSync } from "node:fs";

// Unnecessary TLS overhead for internal gRPC-style communication
const server = Fastify({
  http2: true,
  https: {
    key: readFileSync("./certs/key.pem"),
    cert: readFileSync("./certs/cert.pem"),
  },
});
```

**Correct (plain-text HTTP/2 for internal services behind a reverse proxy or service mesh):**

```ts
import Fastify from "fastify";

const server = Fastify({
  http2: true,
  logger: true,
});

await server.listen({ port: 3000 });
```

Use `h2c` only when TLS is terminated upstream (e.g., by a load balancer, reverse proxy, or service mesh). Never expose plain-text HTTP/2 to the public internet.

### Build Server Factory with HTTP/2

**Incorrect (hardcoded server setup without reusable factory):**

```ts
import Fastify from "fastify";
import { readFileSync } from "node:fs";

const server = Fastify({
  http2: true,
  https: {
    allowHTTP1: true,
    key: readFileSync("./certs/key.pem"),
    cert: readFileSync("./certs/cert.pem"),
  },
});

server.get("/", async () => ({ hello: "world" }));
await server.listen({ port: 3000 });
```

**Correct (reusable factory with environment-aware HTTP/2 configuration):**

```ts
import Fastify from "fastify";
import { readFileSync } from "node:fs";
import { join } from "node:path";

interface ServerOptions {
  logger?: boolean;
  http2?: boolean;
  certDir?: string;
}

function buildServer(options: ServerOptions = {}) {
  const { logger = true, http2 = false, certDir = "./certs" } = options;

  const serverOptions: Record<string, unknown> = { logger };

  if (http2) {
    serverOptions.http2 = true;
    serverOptions.https = {
      allowHTTP1: true,
      key: readFileSync(join(certDir, "key.pem")),
      cert: readFileSync(join(certDir, "cert.pem")),
    };
  }

  const server = Fastify(serverOptions);
  return server;
}

export default buildServer;
```

### Generate Self-Signed Certificates for Local Development

Use `openssl` to create self-signed certificates for local HTTP/2 development:

```bash
mkdir -p certs
openssl req -x509 -newkey rsa:2048 -nodes \
  -keyout certs/key.pem -out certs/cert.pem \
  -days 365 -subj "/CN=localhost"
```

Add `certs/` to `.gitignore` — never commit private keys to version control.

### Known Limitations

- **HTTP/2 push** is not supported by Fastify (Node.js deprecated `Http2ServerResponse.push` in recent versions).
- Use `req.raw` to access the underlying `Http2ServerRequest` when you need HTTP/2-specific APIs such as stream priority or trailers.
- Some older HTTP clients and proxies may not support HTTP/2; always set `allowHTTP1: true` for public-facing servers.

Reference: [Fastify HTTP/2](https://fastify.dev/docs/latest/Reference/HTTP2/) | [Fastify Server Options](https://fastify.dev/docs/latest/Reference/Server/)
