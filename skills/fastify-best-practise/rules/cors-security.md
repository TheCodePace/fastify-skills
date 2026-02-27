---
title: CORS & Security Headers
impact: HIGH
impactDescription: Prevents cross-origin attacks, clickjacking, MIME-sniffing, and other common vulnerabilities
tags: cors, security, headers, helmet, rate-limit, csrf
---

## CORS & Security Headers

**Impact: HIGH (Prevents cross-origin attacks, clickjacking, MIME-sniffing, and other common vulnerabilities)**

Properly configuring CORS and security headers is foundational for any production Fastify API. Use `@fastify/cors` for Cross-Origin Resource Sharing, `@fastify/helmet` for security headers (CSP, HSTS, X-Frame-Options, etc.), and `@fastify/rate-limit` for abuse protection. Register security plugins before route plugins to ensure all responses include the correct headers.

### Configure `@fastify/cors`

**Incorrect (wildcard origin with credentials):**

```ts
import Fastify from "fastify";
import cors from "@fastify/cors";

const server = Fastify();

// origin: '*' with credentials: true is invalid — browsers will reject the response
server.register(cors, {
  origin: "*",
  credentials: true,
});
```

**Correct (explicit origin allow-list with credentials):**

```bash
npm install @fastify/cors
```

```ts
import Fastify from "fastify";
import cors from "@fastify/cors";

const server = Fastify();

server.register(cors, {
  origin: ["https://example.com", "https://app.example.com"],
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
  exposedHeaders: ["X-Total-Count"],
  credentials: true,
  maxAge: 86400, // 24 hours
});
```

### Dynamic CORS Origin

**Correct (validate origins dynamically with a callback):**

```ts
server.register(cors, {
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) {
      return callback(null, true);
    }

    const allowedOrigins = [
      "https://example.com",
      "https://app.example.com",
      /\.example\.com$/,
    ];

    const isAllowed = allowedOrigins.some((allowed) =>
      allowed instanceof RegExp ? allowed.test(origin) : allowed === origin,
    );

    if (isAllowed) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"), false);
    }
  },
  credentials: true,
});
```

### Security Headers with `@fastify/helmet`

**Incorrect (no security headers — relying on browser defaults):**

```ts
import Fastify from "fastify";

const server = Fastify();

// No helmet registered — responses lack CSP, HSTS, X-Frame-Options, etc.
server.get("/", async () => {
  return { hello: "world" };
});
```

**Correct (register `@fastify/helmet` with a Content-Security-Policy):**

```bash
npm install @fastify/helmet
```

```ts
import Fastify from "fastify";
import helmet from "@fastify/helmet";

const server = Fastify();

server.register(helmet, {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://api.example.com"],
    },
  },
});
```

### Combine CORS + Helmet in the Correct Registration Order

**Incorrect (helmet registered after routes):**

```ts
import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import autoload from "@fastify/autoload";
import { join } from "node:path";

const server = Fastify();

// Routes registered before security plugins — early responses miss headers
server.register(autoload, {
  dir: join(import.meta.dirname, "routes"),
});
server.register(cors, { origin: ["https://example.com"] });
server.register(helmet);
```

**Correct (security plugins first, then routes):**

```ts
import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import autoload from "@fastify/autoload";
import { join } from "node:path";

function buildServer(options = {}) {
  const server = Fastify(options);

  // 1. Security plugins — registered first
  server.register(helmet);
  server.register(cors, {
    origin: process.env.ALLOWED_ORIGINS?.split(",") || ["https://example.com"],
    credentials: true,
  });

  // 2. Application plugins (db, auth, config, etc.)
  server.register(autoload, {
    dir: join(import.meta.dirname, "plugins"),
  });

  // 3. Routes — registered last
  server.register(autoload, {
    dir: join(import.meta.dirname, "routes"),
    autoHooks: true,
    cascadeHooks: true,
  });

  return server;
}

export default buildServer;
```

### Rate Limiting with `@fastify/rate-limit`

**Incorrect (no rate limiting — API is open to abuse):**

```ts
import Fastify from "fastify";

const server = Fastify();

server.post("/login", async (request) => {
  // No rate limit — attackers can brute-force credentials
  return authenticate(request.body);
});
```

**Correct (global rate limit with per-route overrides):**

```bash
npm install @fastify/rate-limit
```

```ts
import Fastify from "fastify";
import rateLimit from "@fastify/rate-limit";

const server = Fastify();

server.register(rateLimit, {
  max: 100,
  timeWindow: "1 minute",
  errorResponseBuilder: (_request, context) => ({
    statusCode: 429,
    error: "Too Many Requests",
    message: `Rate limit exceeded. Retry in ${context.after}`,
    retryAfter: context.after,
  }),
});

// Stricter limit for sensitive endpoints
server.post(
  "/login",
  {
    config: {
      rateLimit: {
        max: 5,
        timeWindow: "1 minute",
      },
    },
  },
  async (request) => {
    return authenticate(request.body);
  },
);

// Skip rate limiting for health checks
server.get(
  "/health",
  {
    config: {
      rateLimit: false,
    },
  },
  async () => ({ status: "ok" }),
);
```

### Full Security Setup as a Plugin

**Correct (encapsulate all security config in a shared plugin):**

`src/plugins/security.ts`

```ts
import fp from "fastify-plugin";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";

async function securityPlugin(fastify) {
  await fastify.register(helmet, {
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        "script-src": ["'self'"],
      },
    },
  });

  await fastify.register(cors, {
    origin: process.env.ALLOWED_ORIGINS?.split(",") || false,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  });

  await fastify.register(rateLimit, {
    max: 100,
    timeWindow: "1 minute",
  });
}

export default fp(securityPlugin, {
  name: "security",
  fastify: "5.x",
});
```

Reference: [@fastify/cors](https://github.com/fastify/fastify-cors) | [@fastify/helmet](https://github.com/fastify/fastify-helmet) | [@fastify/rate-limit](https://github.com/fastify/fastify-rate-limit)
