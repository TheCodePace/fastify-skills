---
title: Create Plugin for Reusable Functionality
impact: LOW-MEDIUM
impactDescription: Encapsulate reusable functionality in a plugin to promote modularity and maintainability
tags: plugins, modularity, maintainability
---

## Create Plugin for Reusable Functionality

When building a Fastify application, it's important to encapsulate reusable functionality in a plugin. This promotes modularity and maintainability, allowing you to easily reuse code across different parts of your application.

**Incorrect (create functionality directly in the server):**

`src/server.ts`

```ts
import Fastify from "fastify";

const server = Fastify();

server.decorate("utilityFunction", {
  foo: () => "bar",
});

server.get("/", async (_, reply) => {
  return server.utilityFunction.foo();
});

await server.listen(3000);
```

**Correct (encapsulate functionality in a plugin):**

`src/plugins/myPlugin.ts`

```ts
import { fp } from "fastify-plugin";

async function myPlugin(fastify, options) {
  fastify.decorate("utilityFunction", {
    foo: () => "bar",
  });
}

export default fp(myPlugin, {
  name: "my-plugin",
  fastify: "5.x", // specify compatible Fastify version
  dependencies: [], // specify any plugin dependencies if needed
});
```

`src/server.ts`

```ts
import Fastify from "fastify";
import myPlugin from "./plugins/myPlugin";

function buildServer(options: ServerOptions = {}) {
  const server = Fastify({
    logger: options.logger || false,
  });

  server.register(myPlugin);

  server.get("/", async (request, reply) => {
    return server.utilityFunction.foo();
  });

  return server;
}

const server = buildServer({ logger: true });
await server.listen(3000);
```
