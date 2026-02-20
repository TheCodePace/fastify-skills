---
title: Database Integration
impact: HIGH
impactDescription: Registering the database client as a Fastify plugin ensures a single shared connection pool and clean lifecycle management
tags: database, plugin, postgres, pg, nearform-sql, lifecycle
---

## Database Integration

Integrate your `pg` connection pool as a Fastify plugin using `fastify-plugin`. This gives every route handler access to the pool through `fastify.db` while keeping connection lifecycle management (connect on startup, disconnect on shutdown) tied to the server lifecycle.

Use `@nearform/sql` tagged template literals to build all queries. This prevents SQL injection by automatically parameterizing every interpolated value, and composes sub-queries safely without manual `$1` / `$2` index bookkeeping.

### Install

```bash
npm install pg @nearform/sql fastify-plugin
npm install --save-dev @types/pg
```

### Register the Pool as a Plugin

**Incorrect (creating a pool directly inside a route handler):**

```ts
import { Pool } from "pg";

// WRONG: a new pool is created on every request
server.get("/users", async (request, reply) => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const { rows } = await pool.query("SELECT * FROM users");
  return rows;
});
```

**Correct (single shared pool registered as a plugin):**

`src/plugins/db.ts`

```ts
import fp from "fastify-plugin";
import pg from "pg";
import type { FastifyInstance } from "fastify";

declare module "fastify" {
  interface FastifyInstance {
    db: pg.Pool;
  }
}

async function dbPlugin(fastify: FastifyInstance) {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

  // Verify connectivity at startup
  await pool.query("SELECT 1");

  fastify.decorate("db", pool);

  fastify.addHook("onClose", async () => {
    await pool.end();
  });
}

export default fp(dbPlugin, { name: "db" });
```

`src/server.ts`

```ts
import Fastify from "fastify";
import dbPlugin from "./plugins/db.js";

export function buildServer() {
  const server = Fastify({ logger: true });
  server.register(dbPlugin);
  return server;
}
```

### Write Queries with `@nearform/sql`

`@nearform/sql` turns a tagged template literal into a parameterized query object (`{ text, values }`) that `pg` accepts directly. Every interpolated value becomes a positional parameter — user input can never end up in the query string.

**Incorrect (string concatenation or untagged template literal):**

```ts
// WRONG: SQL injection risk — user input in the query string
const { rows } = await db.query(`SELECT * FROM users WHERE email = '${email}'`);
```

**Correct (tagged template literal with `@nearform/sql`):**

`src/routes/users/index.ts`

```ts
import SQL from "@nearform/sql";
import type pg from "pg";

function getUsers(db: pg.Pool) {
  const { rows } = await db.query(
    SQL`SELECT id, name, email FROM users ORDER BY created_at DESC`,
  );
  return rows;
}

function getUserById(db: pg.Pool, id: string) {
  const { rows } = await db.query(
    SQL`SELECT id, name, email FROM users WHERE id = ${id}`,
  );
  return rows[0];
}

function createUser(db: pg.Pool, user: { name: string; email: string }) {
  const { rows } = await db.query(SQL`
    INSERT INTO users (name, email)
    VALUES (${user.name.trim()}, ${user.email.toLowerCase()})
    RETURNING id, name, email
  `);
  return rows[0];
}
```

### Compose Queries with `@nearform/sql`

`@nearform/sql` supports safe composition of sub-queries and conditional clauses:

```ts
import SQL from "@nearform/sql";
import type pg from "pg";

interface UserFilter {
  email?: string;
  name?: string;
}

export async function findUsers(db: pg.Pool, filter: UserFilter) {
  // Build optional WHERE clauses
  const conditions = SQL``;

  if (filter.email) {
    conditions.append(SQL`AND email = ${filter.email}`);
  }
  if (filter.name) {
    conditions.append(SQL`AND name ILIKE ${"%" + filter.name + "%"}`);
  }

  const query = SQL`
    SELECT id, name, email FROM users
    WHERE deleted_at IS NULL
    ${conditions}
    ORDER BY created_at DESC
  `;

  const { rows } = await db.query(query);
  return rows;
}
```

### Environment Configuration

Store the database connection string in environment variables. Use `@fastify/env` or `zod` for type-safe config loading:

```ts
import fp from "fastify-plugin";
import { z } from "zod";
import type { FastifyInstance } from "fastify";

const EnvSchema = z.object({
  DATABASE_URL: z.string().url(),
});

declare module "fastify" {
  interface FastifyInstance {
    config: z.infer<typeof EnvSchema>;
  }
}

async function configPlugin(fastify: FastifyInstance) {
  const config = EnvSchema.parse(process.env);
  fastify.decorate("config", config);
}

export default fp(configPlugin, { name: "config" });
```

Register `configPlugin` before `dbPlugin` so `fastify.config.DATABASE_URL` is available when the pool is created.

Reference: [Fastify Decorators](https://fastify.dev/docs/latest/Reference/Decorators/) | [@nearform/sql](https://github.com/nearform/sql) | [node-postgres](https://node-postgres.com/)
