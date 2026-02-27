---
title: WebSockets
impact: HIGH
impactDescription: Enables real-time features like chat, live updates, and notifications
tags: websocket, ws, realtime, socket, broadcast, @fastify/websocket
---

## WebSockets

Real-time features (chat, live updates, notifications) are a common requirement. Fastify supports WebSockets via `@fastify/websocket`, which integrates naturally with the route and plugin system. Register it as a plugin, define WebSocket routes alongside HTTP routes, and use Fastify hooks for authentication.

### Register `@fastify/websocket` as a Plugin

**Incorrect (using the `ws` library directly, bypassing Fastify's plugin system):**

```ts
import Fastify from "fastify";
import { WebSocketServer } from "ws";

const server = Fastify();
const wss = new WebSocketServer({ server: server.server });

wss.on("connection", (socket) => {
  socket.on("message", (message) => {
    socket.send(`Echo: ${message}`);
  });
});

await server.listen({ port: 3000 });
```

**Correct (register `@fastify/websocket` as a Fastify plugin):**

```bash
npm install @fastify/websocket
```

`src/plugins/websocket.ts`

```ts
import fp from "fastify-plugin";
import websocket from "@fastify/websocket";

async function websocketPlugin(fastify) {
  await fastify.register(websocket, {
    options: {
      maxPayload: 1048576, // 1 MB max message size
    },
  });
}

export default fp(websocketPlugin, {
  name: "websocket",
  fastify: "5.x",
});
```

### Define WebSocket Routes

**Incorrect (mixing WebSocket handling with HTTP logic in the same handler):**

```ts
server.get("/updates", async (request, reply) => {
  if (request.headers.upgrade === "websocket") {
    // manually upgrade...
  } else {
    return { status: "ok" };
  }
});
```

**Correct (use the `websocket: true` route option):**

`src/routes/ws/index.ts`

```ts
async function wsRoutes(fastify) {
  fastify.get("/echo", { websocket: true }, (socket, request) => {
    request.log.info("Client connected");

    socket.on("message", (message) => {
      const data = message.toString();
      request.log.info({ msg: data }, "Received message");
      socket.send(`Echo: ${data}`);
    });

    socket.on("close", () => {
      request.log.info("Client disconnected");
    });

    socket.on("error", (error) => {
      request.log.error({ err: error }, "WebSocket error");
    });
  });
}

export default wsRoutes;
```

### Handle Connection Lifecycle

Always listen for `message`, `close`, and `error` events. Clean up resources on `close` to prevent memory leaks.

**Incorrect (ignoring `close` and `error`, leaking resources):**

```ts
const clients = new Set();

fastify.get("/ws", { websocket: true }, (socket, request) => {
  clients.add(socket);

  socket.on("message", (message) => {
    // process message
  });
  // Missing close/error handlers — clients set grows forever
});
```

**Correct (full lifecycle with cleanup):**

```ts
const clients = new Set();

fastify.get("/ws", { websocket: true }, (socket, request) => {
  clients.add(socket);

  socket.on("message", (message) => {
    // process message
  });

  socket.on("close", () => {
    clients.delete(socket);
    request.log.info("Client disconnected");
  });

  socket.on("error", (error) => {
    clients.delete(socket);
    request.log.error({ err: error }, "WebSocket error");
  });
});
```

### Broadcasting to Multiple Clients

**Correct (track connected clients and broadcast):**

```ts
import type { WebSocket } from "ws";

const clients = new Set<WebSocket>();

async function chatRoutes(fastify) {
  fastify.get("/chat", { websocket: true }, (socket, request) => {
    clients.add(socket);

    socket.on("message", (message) => {
      // Broadcast to all other connected clients
      for (const client of clients) {
        if (client !== socket && client.readyState === WebSocket.OPEN) {
          client.send(message.toString());
        }
      }
    });

    socket.on("close", () => {
      clients.delete(socket);
    });

    socket.on("error", () => {
      clients.delete(socket);
    });
  });

  // Trigger a broadcast from an HTTP endpoint
  fastify.post("/chat/broadcast", async (request) => {
    const { message } = request.body as { message: string };

    for (const client of clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ type: "broadcast", message }));
      }
    }

    return { sent: clients.size };
  });
}

export default chatRoutes;
```

### Authenticate WebSocket Connections

WebSocket connections are upgraded from HTTP, so Fastify hooks like `preValidation` run before the upgrade. Use a token in the query string or the `Authorization` header.

**Incorrect (no authentication — any client can connect):**

```ts
fastify.get("/ws", { websocket: true }, (socket, request) => {
  // No auth check — open to everyone
  socket.on("message", (message) => {
    handlePrivateMessage(message);
  });
});
```

**Correct (authenticate via `preValidation` hook):**

```ts
fastify.get(
  "/ws",
  {
    websocket: true,
    preValidation: async (request, reply) => {
      const token =
        (request.query as { token?: string }).token ||
        request.headers.authorization?.replace("Bearer ", "");

      if (!token) {
        reply.code(401).send({ error: "Token required" });
        return;
      }

      try {
        request.user = await request.jwtVerify({ onlyCookie: false });
      } catch {
        reply.code(401).send({ error: "Invalid token" });
      }
    },
  },
  (socket, request) => {
    request.log.info({ userId: request.user.id }, "Authenticated WS client");

    socket.on("message", (message) => {
      // Handle authenticated messages
    });
  },
);
```

### Combine WebSocket and HTTP Routes in the Same Plugin

**Correct (colocate WebSocket and REST endpoints in one encapsulated plugin):**

`src/routes/notifications/index.ts`

```ts
async function notificationRoutes(fastify) {
  const subscribers = new Set<import("ws").WebSocket>();

  // WebSocket route — clients subscribe to live notifications
  fastify.get("/live", { websocket: true }, (socket, request) => {
    subscribers.add(socket);

    socket.on("close", () => {
      subscribers.delete(socket);
    });

    socket.on("error", () => {
      subscribers.delete(socket);
    });
  });

  // HTTP route — create a notification and push it to subscribers
  fastify.post("/", async (request) => {
    const notification = request.body;
    const saved = await saveNotification(notification);

    for (const client of subscribers) {
      if (client.readyState === 1) {
        client.send(JSON.stringify(saved));
      }
    }

    return saved;
  });

  // HTTP route — list past notifications
  fastify.get("/", async () => {
    return getNotifications();
  });
}

export default notificationRoutes;
```

### TypeScript Support

**Correct (augment Fastify types for WebSocket routes):**

`src/types.d.ts`

```ts
import type { FastifyRequest } from "fastify";
import type { WebSocket } from "ws";

declare module "fastify" {
  interface RouteShorthandOptions {
    websocket?: boolean;
  }
}
```

### Testing WebSocket Routes

**Correct (test with `fastify.injectWS` provided by `@fastify/websocket`):**

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import buildServer from "../src/server.js";

describe("websocket routes", () => {
  let server;

  beforeAll(async () => {
    server = buildServer({ logger: false });
    await server.ready();
  });

  afterAll(async () => {
    await server.close();
  });

  it("echoes messages back", async () => {
    const ws = await server.injectWS("/echo");

    const reply = new Promise((resolve) => {
      ws.on("message", (data) => resolve(data.toString()));
    });

    ws.send("hello");

    expect(await reply).toBe("Echo: hello");

    ws.terminate();
  });
});
```

Reference: [@fastify/websocket](https://github.com/fastify/fastify-websocket) | [Fastify Ecosystem](https://fastify.dev/docs/latest/Guides/Ecosystem/)
