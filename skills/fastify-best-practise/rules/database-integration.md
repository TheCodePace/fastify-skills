---
title: Database Integration
impact: HIGH
impactDescription: Registering the database client as a Fastify plugin ensures a single shared connection pool and clean lifecycle management
tags: database, plugin, postgres, drizzle, prisma, lifecycle
---

## Database Integration

Integrate your database client as a Fastify plugin using `fastify-plugin`. This gives every route handler access to the client through `fastify.db` (or a similar decorator) while keeping connection lifecycle management (connect on startup, disconnect on shutdown) tied to the server lifecycle.

### Register the Database Client as a Plugin

**Incorrect (creating a database client directly inside a route handler):**

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
import { Pool } from "pg";
import type { FastifyInstance } from "fastify";

declare module "fastify" {
  interface FastifyInstance {
    db: Pool;
  }
}

async function dbPlugin(fastify: FastifyInstance) {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

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

`src/routes/users/index.ts`

```ts
import type { FastifyInstance } from "fastify";

export default async function userRoutes(fastify: FastifyInstance) {
  fastify.get("/", async () => {
    const { rows } = await fastify.db.query("SELECT * FROM users");
    return rows;
  });
}
```

### Using Drizzle ORM

`src/plugins/db.ts`

```ts
import fp from "fastify-plugin";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "../db/schema.js";
import type { FastifyInstance } from "fastify";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

declare module "fastify" {
  interface FastifyInstance {
    db: NodePgDatabase<typeof schema>;
  }
}

async function dbPlugin(fastify: FastifyInstance) {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool, { schema });

  fastify.decorate("db", db);

  fastify.addHook("onClose", async () => {
    await pool.end();
  });
}

export default fp(dbPlugin, { name: "db" });
```

`src/routes/users/index.ts`

```ts
import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { users } from "../../db/schema.js";

export default async function userRoutes(fastify: FastifyInstance) {
  fastify.get("/", async () => {
    return fastify.db.select().from(users);
  });

  fastify.get("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const [user] = await fastify.db
      .select()
      .from(users)
      .where(eq(users.id, id));
    return user ?? reply.status(404).send({ message: "Not found" });
  });
}
```

### Using Prisma

`src/plugins/db.ts`

```ts
import fp from "fastify-plugin";
import { PrismaClient } from "@prisma/client";
import type { FastifyInstance } from "fastify";

declare module "fastify" {
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}

async function prismaPlugin(fastify: FastifyInstance) {
  const prisma = new PrismaClient();
  await prisma.$connect();

  fastify.decorate("prisma", prisma);

  fastify.addHook("onClose", async () => {
    await prisma.$disconnect();
  });
}

export default fp(prismaPlugin, { name: "prisma" });
```

`src/routes/users/index.ts`

```ts
import type { FastifyInstance } from "fastify";

export default async function userRoutes(fastify: FastifyInstance) {
  fastify.get("/", async () => {
    return fastify.prisma.user.findMany();
  });
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
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
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

Reference: [Fastify Decorators](https://fastify.dev/docs/latest/Reference/Decorators/) | [Drizzle ORM](https://orm.drizzle.team/) | [Prisma](https://www.prisma.io/docs)
