---
title: HTTP QUERY Method
impact: HIGH
impactDescription: Use Fastify's native RFC 10008 support for safe, idempotent queries that carry request content
tags: query, http-method, safe-method, rfc-10008, validation
---

## HTTP QUERY Method

The HTTP `QUERY` method defined by [RFC 10008](https://datatracker.ietf.org/doc/html/rfc10008) asks a resource to process request content safely and idempotently. It fits read-only searches, reports, and analytics whose structured input is too large or complex for a URI. Unlike `POST`, its semantics permit automatic retries; unlike `GET`, its request content has defined meaning.

Fastify supports `QUERY` natively from version 5.11.0. Use Node.js 22 or newer so the Node HTTP parser recognizes the method. Do not install a separate plugin or call `addHttpMethod()` for `QUERY` on supported versions.

### Use the Native `query` Shorthand

Declare a `QUERY` route with `fastify.query()`. The equivalent full route declaration uses `method: "QUERY"`; both participate in the normal Fastify lifecycle, validation, serialization, hooks, and TypeScript inference.

**Incorrect (using POST for an operation that is explicitly safe and idempotent):**

```ts
app.post("/search", async (request) => {
  return runSearch(request.body);
});
```

**Correct (use the native QUERY shorthand with request and response schemas):**

```ts
type SearchBody = {
  term: string;
  filters?: Record<string, string>;
};

app.query<{ Body: SearchBody }>(
  "/search",
  {
    schema: {
      body: {
        type: "object",
        properties: {
          term: { type: "string", minLength: 1 },
          filters: {
            type: "object",
            additionalProperties: { type: "string" },
          },
        },
        required: ["term"],
        additionalProperties: false,
      },
      response: {
        200: {
          type: "object",
          properties: {
            results: { type: "array", items: { type: "string" } },
          },
          required: ["results"],
        },
      },
    },
  },
  async (request) => {
    return runSearch(request.body);
  },
);
```

Use the full declaration when route construction is dynamic:

```ts
app.route({
  method: "QUERY",
  url: "/search",
  schema: { body: searchBodySchema },
  handler: async (request) => runSearch(request.body),
});
```

### Require Content and Its Media Type

RFC 10008 defines a query through both its content and media type. Fastify therefore rejects `QUERY` requests before the handler when content is absent, its type is missing, or parsing fails.

| Request problem         | Status | Fastify error code                   |
| ----------------------- | ------ | ------------------------------------ |
| Missing `Content-Type`  | `400`  | `FST_ERR_ROUTE_MISSING_CONTENT_TYPE` |
| Missing request content | `400`  | `FST_ERR_ROUTE_MISSING_CONTENT`      |
| Invalid JSON content    | `400`  | `FST_ERR_CTP_INVALID_JSON_BODY`      |
| Unsupported media type  | `415`  | `FST_ERR_CTP_INVALID_MEDIA_TYPE`     |

A syntactically valid request can still fail its route body schema. Keep the schema strict and return a domain-appropriate error, such as `422`, when valid query content cannot be processed semantically.

### Keep QUERY Handlers Safe and Idempotent

Clients and intermediaries may retry or deduplicate `QUERY` requests. The handler must not make changes requested by the client to the target resource. Incidental server behavior such as metrics or access logging is fine, but business writes belong on methods such as `POST`, `PATCH`, or `DELETE`.

**Incorrect (a QUERY request changes application state):**

```ts
app.query("/reports", async (request) => {
  await db.reports.create(request.body);
  return { created: true };
});
```

**Correct (the same request content always describes a read-only operation):**

```ts
app.query("/reports", async (request) => {
  return db.reports.find(request.body);
});
```

### Handle RFC Features Outside Fastify Core

Fastify 5.11 provides method registration, the shorthand, content parsing, validation, lifecycle handling, TypeScript types, and required content errors. It does not automatically implement the rest of RFC 10008:

- A cache key for a `QUERY` response must incorporate the request content and related metadata. Do not expose responses to a shared cache that keys only by method and URL; use `private` or `no-store` unless the cache is body-aware.
- `Content-Location` can identify a `GET`-able resource containing the result. `Location` can identify an equivalent resource that repeats the query through `GET`. Add either only when the application actually provides that resource.
- `Accept-Query` advertises the query media types supported by a resource. Set it explicitly when clients need format discovery.
- Browsers preflight `QUERY` requests because the method is not CORS-safelisted. Include `QUERY` in the configured CORS methods for cross-origin clients.

```ts
app.query("/search", async (request, reply) => {
  const { id, results } = await runSearch(request.body);

  reply
    .header("accept-query", '"application/json"')
    .header("content-location", `/search/results/${id}`)
    .header("cache-control", "private, max-age=60");

  return { results };
});
```

### Test Native QUERY Behavior

Use `fastify.inject()` with a serialized body and an explicit `Content-Type`. Cover both the route result and Fastify's RFC-specific rejection paths.

```ts
import assert from "node:assert/strict";
import { test } from "node:test";
import buildServer from "../src/server.js";

test("QUERY /search validates request content", async (t) => {
  const app = buildServer({ logger: false });
  t.after(() => app.close());

  const valid = await app.inject({
    method: "QUERY",
    url: "/search",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ term: "fastify" }),
  });
  assert.equal(valid.statusCode, 200);

  const missingType = await app.inject({
    method: "QUERY",
    url: "/search",
    body: JSON.stringify({ term: "fastify" }),
  });
  assert.equal(missingType.statusCode, 400);
  assert.equal(missingType.json().code, "FST_ERR_ROUTE_MISSING_CONTENT_TYPE");

  const missingContent = await app.inject({
    method: "QUERY",
    url: "/search",
    headers: { "content-type": "application/json" },
  });
  assert.equal(missingContent.statusCode, 400);
  assert.equal(missingContent.json().code, "FST_ERR_ROUTE_MISSING_CONTENT");
});
```

Reference: [RFC 10008](https://datatracker.ietf.org/doc/html/rfc10008) | [Fastify PR #6832](https://github.com/fastify/fastify/pull/6832) | [Fastify v5.11.0 release](https://github.com/fastify/fastify/releases/tag/v5.11.0) | [Fastify server methods](https://fastify.dev/docs/latest/Reference/Server/#addhttpmethod)
