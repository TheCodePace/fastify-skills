---
title: Unit Testing the Service Layer
impact: HIGH
impactDescription: Pure service functions can be unit-tested in milliseconds with no server, no database, and no I/O
tags: testing, unit-testing, services, mocks, vitest, node-test-runner
---

## Unit Testing the Service Layer

Service functions that follow the [clean-architecture](clean-architecture.md) pattern (pure functions that receive dependencies as arguments) are trivially unit-testable. Pass a lightweight mock or in-memory stub for the database and assert on the returned values or thrown errors — no HTTP server, no real database, no containers needed.

### Test a Service Function with a Mock Database

`src/services/users.ts` (service under test)

```ts
import createError from "@fastify/error";
import SQL from "@nearform/sql";
import type pg from "pg";

export interface User { id: string; name: string; email: string; }
export interface CreateUserInput { name: string; email: string; password: string; }

const EmailAlreadyRegisteredError = createError(
  "EMAIL_ALREADY_REGISTERED",
  "Email %s is already registered",
  409,
);

export async function createUser(db: pg.Pool, input: CreateUserInput): Promise<User> {
  const { rows: existing } = await db.query(
    SQL`SELECT id FROM users WHERE email = ${input.email.toLowerCase()}`,
  );
  if (existing.length > 0) {
    throw new EmailAlreadyRegisteredError(input.email);
  }
  const { rows } = await db.query<User>(SQL`
    INSERT INTO users (name, email)
    VALUES (${input.name.trim()}, ${input.email.toLowerCase()})
    RETURNING id, name, email
  `);
  return rows[0];
}
```

**Incorrect (spinning up a real server or database just to test a service):**

```ts
// WRONG: integration overhead to test a simple business rule
import { buildServer } from "../src/server.js";
const server = buildServer();
await server.ready();
const res = await server.inject({ method: "POST", url: "/users", payload: { ... } });
```

**Correct — vitest:**

`test/services/users.test.ts`

```ts
import { describe, it, expect, vi } from "vitest";
import { createUser } from "../../src/services/users.js";
import type pg from "pg";

function makeMockDb(overrides: Partial<pg.Pool> = {}): pg.Pool {
  return {
    query: vi.fn(),
    ...overrides,
  } as unknown as pg.Pool;
}

describe("createUser", () => {
  it("returns the new user on success", async () => {
    const db = makeMockDb({
      query: vi
        .fn()
        // First call: SELECT (no existing user)
        .mockResolvedValueOnce({ rows: [] })
        // Second call: INSERT
        .mockResolvedValueOnce({
          rows: [{ id: "uuid-1", name: "Alice", email: "alice@example.com" }],
        }),
    });

    const result = await createUser(db, {
      name: "Alice",
      email: "alice@example.com",
      password: "secret123",
    });

    expect(result).toEqual({ id: "uuid-1", name: "Alice", email: "alice@example.com" });
  });

  it("throws 409 when email is already registered", async () => {
    const db = makeMockDb({
      query: vi.fn().mockResolvedValueOnce({ rows: [{ id: "existing" }] }),
    });

    await expect(
      createUser(db, { name: "Bob", email: "alice@example.com", password: "pass" }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("normalizes email to lower-case before inserting", async () => {
    const queryMock = vi
      .fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: "u1", name: "Alice", email: "alice@example.com" }] });

    const db = makeMockDb({ query: queryMock });

    await createUser(db, { name: "Alice", email: "ALICE@EXAMPLE.COM", password: "pass" });

    // @nearform/sql builds a parameterized query object — inspect values, not the text
    const insertCall = queryMock.mock.calls[1][0]; // SqlStatement passed to pool.query()
    expect(insertCall.values).toContain("alice@example.com");
  });
});
```

**Correct — node:test:**

```ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createUser } from "../../src/services/users.js";
import type pg from "pg";

describe("createUser", () => {
  it("returns the new user on success", async () => {
    let callCount = 0;
    const db = {
      query: async () => {
        callCount++;
        if (callCount === 1) return { rows: [] };                   // SELECT
        return { rows: [{ id: "u1", name: "Alice", email: "alice@example.com" }] }; // INSERT
      },
    } as unknown as pg.Pool;

    const user = await createUser(db, { name: "Alice", email: "alice@example.com", password: "s" });
    assert.deepStrictEqual(user, { id: "u1", name: "Alice", email: "alice@example.com" });
  });

  it("throws when email already exists", async () => {
    const db = {
      query: async () => ({ rows: [{ id: "existing" }] }),
    } as unknown as pg.Pool;

    await assert.rejects(
      () => createUser(db, { name: "Bob", email: "dup@example.com", password: "s" }),
      (err: { statusCode: number }) => {
        assert.strictEqual(err.statusCode, 409);
        return true;
      },
    );
  });
});
```

### Structure Tests to Mirror the Source Tree

```
src/
  services/
    users.ts
    posts.ts
test/
  services/
    users.test.ts    # ← mirrors src/services/users.ts
    posts.test.ts
  routes/
    users.test.ts    # integration: route handler + real service + inject()
```

### What to Unit-test vs Integration-test

| What you want to verify                            | Test type        |
| -------------------------------------------------- | ---------------- |
| Business rule (e.g. duplicate email check)         | Unit test        |
| Input normalisation (trim, lower-case)             | Unit test        |
| Error type and status code thrown by service       | Unit test        |
| HTTP status code returned by the route             | Integration test |
| Request schema validation (400 for bad body)       | Integration test |
| End-to-end database reads/writes                   | Integration test (+ Testcontainers) |

Reference: [Vitest](https://vitest.dev/) | [node:test](https://nodejs.org/api/test.html) | [clean-architecture.md](clean-architecture.md)
