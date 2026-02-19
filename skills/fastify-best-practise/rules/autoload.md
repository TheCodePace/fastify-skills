---
title: Autoload Plugins and Routes
impact: HIGH
impactDescription: Eliminate manual register() calls — automatically load plugins and routes from the filesystem
tags: autoload, plugins, routes, file-system, convention
---

## Autoload Plugins and Routes

`@fastify/autoload` automatically loads plugins and routes from directories, removing the need for manual `register()` calls. It respects Fastify's encapsulation model and supports prefixes derived from folder names.

### Setup

```bash
npm install @fastify/autoload
```

### Basic Usage

**Incorrect (manually registering every plugin and route):**

```ts
import Fastify from "fastify";
import dbPlugin from "./plugins/db.js";
import authPlugin from "./plugins/auth.js";
import configPlugin from "./plugins/config.js";
import userRoutes from "./routes/users/index.js";
import postRoutes from "./routes/posts/index.js";
import commentRoutes from "./routes/comments/index.js";

function buildServer() {
  const server = Fastify({ logger: true });

  // Must manually add every new plugin and route
  server.register(dbPlugin);
  server.register(authPlugin);
  server.register(configPlugin);
  server.register(userRoutes, { prefix: "/users" });
  server.register(postRoutes, { prefix: "/posts" });
  server.register(commentRoutes, { prefix: "/comments" });

  return server;
}
```

**Correct (use @fastify/autoload):**

```ts
import path from "node:path";
import { fileURLToPath } from "node:url";
import Fastify from "fastify";
import autoload from "@fastify/autoload";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

function buildServer() {
  const server = Fastify({ logger: true });

  // Load all plugins from plugins/ — these use fastify-plugin, so they're shared
  server.register(autoload, {
    dir: path.join(__dirname, "plugins"),
  });

  // Load all routes from routes/ — each folder becomes a prefix automatically
  server.register(autoload, {
    dir: path.join(__dirname, "routes"),
    options: { prefix: "/api" }, // optional: add a global prefix
    autoHooks: true, // load _hooks files automatically
    cascadeHooks: true, // propagate hooks to child directories
  });

  return server;
}
```

### Directory Convention

Autoload derives route prefixes from folder names. Each folder should have an `index.ts` that exports a Fastify plugin function:

```
src/
  plugins/              # Autoloaded — shared plugins (use fastify-plugin)
    db.ts
    auth.ts
    config.ts
  routes/               # Autoloaded — encapsulated route plugins
    _hooks.ts           # Hooks applied to all routes (with autoHooks: true)
    users/
      index.ts          # → /users (or /api/users with global prefix)
      _hooks.ts         # Hooks applied to /users and children only
      schema.ts         # Not autoloaded (no default export plugin)
    posts/
      index.ts          # → /posts
      comments/
        index.ts        # → /posts/comments (nested prefix)
```

### Parameterized Routes with Folder Names

Use a folder name prefixed with `_` to define a route parameter. The folder name becomes a `:param` in the URL:

```
src/
  routes/
    users/
      index.ts              # GET /users → list all users
      _id/
        index.ts            # GET /users/:id → get user by id
        posts/
          index.ts          # GET /users/:id/posts → get posts for a user
    posts/
      index.ts              # GET /posts → list all posts
      _id/
        index.ts            # GET /posts/:id → get post by id
        comments/
          index.ts          # GET /posts/:id/comments → comments for a post
          _commentId/
            index.ts        # GET /posts/:id/comments/:commentId → single comment
```

`src/routes/users/index.ts` — list & create users:

```ts
import { FastifyInstance } from "fastify";

async function userRoutes(fastify: FastifyInstance) {
  fastify.get("/", async (request, reply) => {
    return fastify.db.query("SELECT * FROM users");
  });

  fastify.post("/", async (request, reply) => {
    // create user
  });
}

export default userRoutes;
```

`src/routes/users/_id/index.ts` — single user by param:

```ts
import { FastifyInstance } from "fastify";

async function userByIdRoutes(fastify: FastifyInstance) {
  // The :id param is part of the URL prefix from the folder name
  fastify.get("/", async (request, reply) => {
    const { id } = request.params as { id: string };
    return fastify.db.query("SELECT * FROM users WHERE id = $1", [id]);
  });

  fastify.put("/", async (request, reply) => {
    const { id } = request.params as { id: string };
    // update user
  });

  fastify.delete("/", async (request, reply) => {
    const { id } = request.params as { id: string };
    // delete user
  });
}

export default userByIdRoutes;
```

`src/routes/users/_id/posts/index.ts` — nested resource:

```ts
import { FastifyInstance } from "fastify";

async function userPostsRoutes(fastify: FastifyInstance) {
  // URL is /users/:id/posts
  fastify.get("/", async (request, reply) => {
    const { id } = request.params as { id: string };
    return fastify.db.query("SELECT * FROM posts WHERE user_id = $1", [id]);
  });
}

export default userPostsRoutes;
```

### Route File Convention

Each `index.ts` in a route folder exports an async Fastify plugin:

### Auto Hooks

With `autoHooks: true`, files named `_hooks.ts` are loaded as encapsulated hooks for that directory and its children:

`src/routes/_hooks.ts` — global route hooks:

```ts
import { FastifyInstance } from "fastify";

export default async function globalHooks(fastify: FastifyInstance) {
  fastify.addHook("onRequest", async (request, reply) => {
    request.log.info({ url: request.url }, "incoming request");
  });
}
```

`src/routes/users/_hooks.ts` — hooks only for `/users/*`:

```ts
import { FastifyInstance } from "fastify";

export default async function userHooks(fastify: FastifyInstance) {
  fastify.addHook("preHandler", async (request, reply) => {
    // Auth check only for user routes
    if (!request.headers.authorization) {
      reply.status(401);
      return reply.send({ error: "Unauthorized" });
    }
  });
}
```

### Autoload Options

```ts
server.register(autoload, {
  dir: path.join(__dirname, "routes"),

  // Prefix all routes
  options: { prefix: "/api" },

  // Load _hooks.ts files automatically
  autoHooks: true,

  // Propagate parent hooks to child directories
  cascadeHooks: true,

  // Ignore files matching pattern
  ignorePattern: /^_.*|\.test\./,

  // Only load .ts or .js files
  matchFilter: /^[^_].*\.(ts|js)$/,

  // Force ESM loading
  forceESM: true,

  // Enable parameterized routes with folder names like _id → :id
  routeParams: true,
});
```

Reference: [@fastify/autoload](https://github.com/fastify/fastify-autoload)
