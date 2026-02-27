---
title: Content Type Parser
impact: HIGH
impactDescription: Proper content type parsing ensures correct body handling, security, and support for diverse payload formats
tags: content-type, parsing, body, multipart, json, xml, stream, formbody
---

## Content Type Parser

**Impact: HIGH (Proper content type parsing ensures correct body handling, security, and support for diverse payload formats)**

Fastify includes built-in parsers for `application/json` and `text/plain`. Use `addContentTypeParser()` to handle additional content types such as URL-encoded forms, XML, binary streams, or protocol buffers. Always set explicit body size limits and prefer async parsers.

### Custom Content Type Parsers

**Incorrect (handling form data manually without a parser):**

```typescript
import Fastify from "fastify";

const app = Fastify();

// WRONG: manually parsing the raw body in a route handler
app.post("/form", async (request) => {
  const raw = request.body as string;
  const params = raw.split("&").reduce(
    (acc, pair) => {
      const [key, value] = pair.split("=");
      acc[decodeURIComponent(key)] = decodeURIComponent(value);
      return acc;
    },
    {} as Record<string, string>,
  );
  return params;
});
```

**Correct (register a content type parser with `addContentTypeParser`):**

```typescript
import Fastify from "fastify";

const app = Fastify();

// Async parser for application/x-www-form-urlencoded
app.addContentTypeParser(
  "application/x-www-form-urlencoded",
  { parseAs: "string" },
  async (request, body) => {
    const parsed = new URLSearchParams(body as string);
    return Object.fromEntries(parsed);
  },
);

app.post("/form", async (request) => {
  // request.body is already parsed
  return { received: request.body };
});
```

### Body Limit Configuration

**Incorrect (no body size limit, vulnerable to large payload attacks):**

```typescript
import Fastify from "fastify";

// WRONG: no bodyLimit — accepts arbitrarily large payloads
const app = Fastify();

app.addContentTypeParser(
  "application/json",
  { parseAs: "string" },
  async (request, body) => {
    return JSON.parse(body as string);
  },
);
```

**Correct (set explicit body limits globally, per route, or per content type):**

```typescript
import Fastify from "fastify";

// Global limit
const app = Fastify({
  bodyLimit: 1048576, // 1 MB
});

// Per content type limit
app.addContentTypeParser("application/json", {
  parseAs: "string",
  bodyLimit: 2097152, // 2 MB for JSON
}, async (request, body) => {
  return JSON.parse(body as string);
});

// Per route limit
app.post("/large-upload", {
  bodyLimit: 52428800, // 50 MB for this route only
}, async (request) => {
  return { size: JSON.stringify(request.body).length };
});
```

### Custom JSON Parser with Error Handling

**Incorrect (replacing the default JSON parser without proper error handling):**

```typescript
app.removeContentTypeParser("application/json");

app.addContentTypeParser(
  "application/json",
  { parseAs: "string" },
  async (request, body) => {
    // WRONG: no error handling — throws unstructured errors
    return JSON.parse(body as string);
  },
);
```

**Correct (catch parse errors and return structured error responses):**

```typescript
app.removeContentTypeParser("application/json");

app.addContentTypeParser(
  "application/json",
  { parseAs: "string" },
  async (request, body) => {
    try {
      return JSON.parse(body as string);
    } catch {
      const err = new Error("Invalid JSON payload");
      (err as any).statusCode = 400;
      throw err;
    }
  },
);
```

### Multipart Form Data

**Incorrect (parsing multipart data manually without size limits):**

```typescript
import fastifyMultipart from "@fastify/multipart";

// WRONG: no limits — allows unlimited file sizes and field counts
app.register(fastifyMultipart);

app.post("/upload", async (request) => {
  const data = await request.file();
  const buffer = await data!.toBuffer();
  return { size: buffer.length };
});
```

**Correct (use `@fastify/multipart` with explicit limits and validation):**

```typescript
import fastifyMultipart from "@fastify/multipart";

app.register(fastifyMultipart, {
  limits: {
    fieldNameSize: 100,
    fieldSize: 1024 * 1024,       // 1 MB
    fields: 10,
    fileSize: 10 * 1024 * 1024,   // 10 MB
    files: 5,
    headerPairs: 2000,
    parts: 1000,
  },
  throwFileSizeLimit: true,
});

app.post("/upload", async (request, reply) => {
  const data = await request.file();

  if (!data) {
    return reply.code(400).send({ error: "No file uploaded" });
  }

  const buffer = await data.toBuffer();

  return {
    filename: data.filename,
    mimetype: data.mimetype,
    size: buffer.length,
  };
});
```

### Catch-All Parser

**Incorrect (no handler for unknown content types — Fastify returns 415 Unsupported Media Type):**

```typescript
// WRONG: only the default json/text parsers exist
// Requests with other content types are rejected with 415
app.post("/data", async (request) => {
  return { received: request.body };
});
```

**Correct (register a catch-all parser with `*` to handle unknown content types):**

```typescript
app.addContentTypeParser("*", async (request, payload) => {
  const chunks: Buffer[] = [];

  for await (const chunk of payload) {
    chunks.push(chunk as Buffer);
  }

  const buffer = Buffer.concat(chunks);
  const contentType = request.headers["content-type"];

  if (contentType?.includes("json")) {
    return JSON.parse(buffer.toString("utf-8"));
  }

  if (contentType?.includes("text")) {
    return buffer.toString("utf-8");
  }

  return buffer;
});
```

### Content Type with Regex Matching

**Correct (use a regex to match content type families):**

```typescript
// Match any JSON-based content type (e.g., application/vnd.api+json)
app.addContentTypeParser(
  /^application\/.*\+json$/,
  { parseAs: "string" },
  async (request, body) => {
    return JSON.parse(body as string);
  },
);
```

### Stream Processing for Large Payloads

**Correct (return the raw stream for large payloads instead of buffering):**

```typescript
import { pipeline } from "node:stream/promises";
import { createWriteStream } from "node:fs";

app.addContentTypeParser(
  "application/octet-stream",
  async (request, payload) => {
    return payload; // Return stream directly
  },
);

app.post("/upload-stream", async (request) => {
  const destination = createWriteStream("/tmp/upload.bin");
  await pipeline(request.raw, destination);
  return { success: true };
});
```

Reference: [Fastify Content Type Parser](https://fastify.dev/docs/latest/Reference/ContentTypeParser/) | [Fastify Body Limit](https://fastify.dev/docs/latest/Reference/Server/#bodylimit) | [@fastify/multipart](https://github.com/fastify/fastify-multipart)
