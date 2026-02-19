---
title: Encapsulation
impact: HIGH
impactDescription: Proper encapsulation prevents scope leaks and enables modular, maintainable architecture
tags: encapsulation, plugins, scope, fastify-plugin, decorators
---

## Encapsulation

Encapsulation is a core principle in Fastify. Every `register` call creates a new encapsulated context — plugins, decorators, and hooks registered inside it are scoped to that context and its children. Use `fastify-plugin` only when you intentionally need to break encapsulation and share a plugin's registrations with the parent scope.

### Understand Encapsulated Contexts

**Each `register` creates an isolated scope:**

```
Root
├── register(dbPlugin)        → uses fastify-plugin → shared with all
├── register(authRoutes, { prefix: '/auth' })
│   └── has access to db, but its hooks/decorators stay here
├── register(userRoutes, { prefix: '/users' })
│   └── has access to db, but NOT to authRoutes' decorators
```

### Only Use `fastify-plugin` for Shared Plugins

**Incorrect (using fastify-plugin for routes):**

```ts
import fp from "fastify-plugin";

// WRONG: routes should NOT break encapsulation
export default fp(async function userRoutes(fastify) {
  fastify.get("/users", async () => {
    return getUsers();
  });
});
```

**Correct (routes stay encapsulated, shared services use fastify-plugin):**

`src/plugins/db.ts` — shared across the app:

```ts
import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";

interface DbPluginOptions {
  connectionString: string;
}

async function dbPlugin(fastify: FastifyInstance, options: DbPluginOptions) {
  const pool = createPool(options.connectionString);

  fastify.decorate("db", pool);

  fastify.addHook("onClose", async () => {
    await pool.end();
  });
}

export default fp(dbPlugin, {
  name: "db-plugin",
  fastify: "5.x",
});
```

`src/routes/users.ts` — stays encapsulated:

```ts
import { FastifyInstance } from "fastify";

// No fastify-plugin wrapper → encapsulated
async function userRoutes(fastify: FastifyInstance) {
  // fastify.db is available because db-plugin used fastify-plugin
  fastify.get("/", async (request, reply) => {
    return fastify.db.query("SELECT * FROM users");
  });
}

export default userRoutes;
```

### Scope Decorators Properly

**Incorrect (polluting global scope with route-specific decorators):**

```ts
import fp from "fastify-plugin";
import { FastifyInstance } from "fastify";

// WRONG: this decorator is only needed in admin routes
export default fp(async function adminPlugin(fastify: FastifyInstance) {
  fastify.decorate("isAdmin", (request) => {
    return request.user?.role === "admin";
  });
});
```

**Correct (keep route-specific decorators encapsulated):**

```ts
// No fp wrapper — isAdmin stays scoped to admin routes
async function adminRoutes(fastify: FastifyInstance) {
  fastify.decorate("isAdmin", (request) => {
    return request.user?.role === "admin";
  });

  fastify.addHook("preHandler", async (request, reply) => {
    if (!fastify.isAdmin(request)) {
      reply.status(403);
      return { error: "Forbidden" };
    }
  });

  fastify.get("/dashboard", async () => {
    return { stats: await getAdminStats() };
  });
}

export default adminRoutes;
```

### Use `dependencies` to Declare Plugin Requirements

**Correct (declare what your plugin depends on):**

```ts
import fp from "fastify-plugin";
import { FastifyInstance } from "fastify";

interface CachePluginOptions {
  // Define any options your cache plugin might need
}

export default fp(
  async function cachePlugin(
    fastify: FastifyInstance,
    options: CachePluginOptions,
  ) {
    // This plugin requires the db plugin to be registered
    fastify.decorate("cache", {
      get: async (key) =>
        fastify.db.query("SELECT value FROM cache WHERE key = $1", [key]),
      set: async (key, value) =>
        fastify.db.query("INSERT INTO cache (key, value) VALUES ($1, $2)", [
          key,
          value,
        ]),
    });
  },
  {
    name: "cache-plugin",
    dependencies: ["db-plugin"], // Fastify will error if db-plugin isn't registered
  },
);
```

### Recommended Project Structure (with @fastify/autoload)

Use `@fastify/autoload` to load both directories automatically. Plugins in `plugins/` use `fastify-plugin` so they're shared globally. Routes in `routes/` stay encapsulated with prefixes derived from folder names.

```
src/
  plugins/          # Autoloaded — shared plugins (use fastify-plugin)
    db.ts
    auth.ts
    cache.ts
  routes/           # Autoloaded — encapsulated route plugins (NO fastify-plugin)
    _hooks.ts       # Hooks for all routes (with autoHooks: true)
    users/
      index.ts      # → /users
      _hooks.ts     # Hooks for /users only
      schema.ts
    posts/
      index.ts      # → /posts
      schema.ts
  server.ts         # buildServer with autoload
```

```ts
// src/server.ts
import path from "node:path";
import { fileURLToPath } from "node:url";
import Fastify from "fastify";
import autoload from "@fastify/autoload";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

export function buildServer(options = {}) {
  const server = Fastify(options);

  // Shared plugins — fastify-plugin breaks encapsulation intentionally
  server.register(autoload, {
    dir: path.join(__dirname, "plugins"),
  });

  // Routes — stay encapsulated, prefixes from folder names
  server.register(autoload, {
    dir: path.join(__dirname, "routes"),
    autoHooks: true,
    cascadeHooks: true,
  });

  return server;
}
```

Reference: [Fastify Encapsulation](https://fastify.dev/docs/latest/Reference/Encapsulation/) | [Fastify Plugins](https://fastify.dev/docs/latest/Reference/Plugins/) | [@fastify/autoload](https://github.com/fastify/fastify-autoload)
