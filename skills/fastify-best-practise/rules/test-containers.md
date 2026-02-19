---
title: Test Containers for Integration Tests
impact: HIGH
impactDescription: Real database containers in tests catch SQL errors and migration issues that mocks cannot, without requiring an external database
tags: testing, testcontainers, postgres, integration, docker
---

## Test Containers for Integration Tests

Use [Testcontainers](https://testcontainers.com/guides/getting-started-with-testcontainers-for-nodejs/) to spin up real database instances inside Docker for integration tests. This catches SQL errors, constraint violations, and migration issues that in-memory mocks cannot replicate, while keeping tests self-contained and reproducible.

### Setup

```bash
npm install --save-dev testcontainers
```

Docker must be running on the test machine (locally and in CI).

### Basic PostgreSQL Container

**Incorrect (pointing integration tests at a shared, always-on database):**

```ts
// WRONG: tests depend on external state — flaky, hard to reset, can't run in parallel
process.env.DATABASE_URL = "postgresql://user:pass@shared-db.example.com:5432/mydb";
```

**Correct (isolated container per test suite):**

`test/helpers/db.ts`

```ts
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import * as schema from "../../src/db/schema.js";

export async function startTestDatabase() {
  const container = await new PostgreSqlContainer("postgres:16-alpine").start();

  const pool = new Pool({ connectionString: container.getConnectionUri() });
  const db = drizzle(pool, { schema });

  // Apply all migrations so the schema matches production
  await migrate(db, { migrationsFolder: "./drizzle" });

  async function stop() {
    await pool.end();
    await container.stop();
  }

  return { db, pool, connectionUri: container.getConnectionUri(), stop };
}
```

### Wire the Container into buildServer

`test/helpers/server.ts`

```ts
import { buildServer } from "../../src/server.js";
import { startTestDatabase } from "./db.js";

export async function createIntegrationServer() {
  const { db, stop } = await startTestDatabase();

  // Override the db plugin by pre-decorating before registration
  const server = buildServer({ logger: false });

  // Replace the db decorator with our test instance
  server.decorate("db", db);

  await server.ready();

  return {
    server,
    async close() {
      await server.close();
      await stop();
    },
  };
}
```

Alternatively, pass the database URL via environment variable so the real `db` plugin uses the container:

```ts
export async function createIntegrationServer() {
  const container = await new PostgreSqlContainer("postgres:16-alpine").start();
  process.env.DATABASE_URL = container.getConnectionUri();

  const server = buildServer({ logger: false });
  await server.ready();

  return {
    server,
    async close() {
      await server.close();
      await container.stop();
    },
  };
}
```

### Writing an Integration Test

`test/routes/users.integration.test.ts`

```ts
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { createIntegrationServer } from "../helpers/server.js";

describe("Users routes (integration)", () => {
  let server: Awaited<ReturnType<typeof createIntegrationServer>>["server"];
  let close: () => Promise<void>;

  before(async () => {
    ({ server, close } = await createIntegrationServer());
  });

  after(async () => {
    await close();
  });

  it("POST /users creates a user and GET /users returns it", async () => {
    const createRes = await server.inject({
      method: "POST",
      url: "/users",
      payload: { name: "Alice", email: "alice@example.com" },
    });

    assert.strictEqual(createRes.statusCode, 201);
    const created = createRes.json();
    assert.ok(created.id);

    const listRes = await server.inject({ method: "GET", url: "/users" });
    assert.strictEqual(listRes.statusCode, 200);
    const users = listRes.json();
    assert.ok(users.some((u: { id: string }) => u.id === created.id));
  });
});
```

### With Vitest

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createIntegrationServer } from "../helpers/server.js";

describe("Users routes (integration)", () => {
  let ctx: Awaited<ReturnType<typeof createIntegrationServer>>;

  beforeAll(async () => {
    ctx = await createIntegrationServer();
  }, 60_000); // container startup can take ~30 s

  afterAll(async () => {
    await ctx.close();
  });

  it("returns an empty list initially", async () => {
    const res = await ctx.server.inject({ method: "GET", url: "/users" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
  });
});
```

### CI Configuration

```yaml
# .github/workflows/ci.yml (excerpt)
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22

      # Docker daemon is already available on ubuntu-latest runners
      - run: npm ci
      - run: npm test
```

No extra Docker service is required because Testcontainers manages container lifecycle automatically.

Reference: [Testcontainers for Node.js](https://node.testcontainers.org/) | [@testcontainers/postgresql](https://node.testcontainers.org/modules/postgresql/)
