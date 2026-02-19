---
title: Clean Architecture — Separation of Concerns
impact: HIGH
impactDescription: Isolating business logic in pure functions makes code testable in milliseconds and easy to reuse across routes
tags: architecture, separation-of-concerns, services, pure-functions, handlers
---

## Clean Architecture — Separation of Concerns

Keep business logic in plain TypeScript functions (the *service layer*) and keep route handlers thin. Route handlers are responsible for parsing the request, calling a service function, and returning the response. This separation makes the logic independently testable, reusable, and framework-agnostic.

### The Three Layers

```
src/
  services/          # Pure business logic — no Fastify dependencies
    users.ts
  routes/
    users/
      index.ts       # Thin route handlers that call services
      schema.ts      # Zod schemas for validation
  plugins/
    db.ts            # Infrastructure (database, config, auth)
```

### Incorrect (logic mixed into the route handler)

```ts
// WRONG: validation, transformation, DB calls and HTTP concerns all tangled together
fastify.post("/users", async (request, reply) => {
  const { name, email } = request.body as { name: string; email: string };

  if (!name || name.trim().length < 2) {
    reply.status(400);
    return { error: "Name must be at least 2 characters" };
  }

  const existing = await fastify.db.query(
    "SELECT id FROM users WHERE email = $1",
    [email],
  );
  if (existing.rows.length > 0) {
    reply.status(409);
    return { error: "Email already registered" };
  }

  const hashed = await hashPassword(request.body.password);
  const { rows } = await fastify.db.query(
    "INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email",
    [name.trim(), email.toLowerCase(), hashed],
  );

  reply.status(201);
  return rows[0];
});
```

### Correct (thin handler + service layer)

`src/services/users.ts` — pure business logic, no Fastify import

```ts
import createError from "@fastify/error";
import type { Pool } from "pg";

export interface User {
  id: string;
  name: string;
  email: string;
}

export interface CreateUserInput {
  name: string;
  email: string;
  password: string;
}

const EmailAlreadyRegisteredError = createError(
  "EMAIL_ALREADY_REGISTERED",
  "Email %s is already registered",
  409,
);

export async function createUser(
  db: Pool,
  input: CreateUserInput,
): Promise<User> {
  const { name, email, password } = input;

  const existing = await db.query(
    "SELECT id FROM users WHERE email = $1",
    [email.toLowerCase()],
  );
  if (existing.rows.length > 0) {
    throw new EmailAlreadyRegisteredError(email);
  }

  const hashed = await hashPassword(password);
  const { rows } = await db.query<User>(
    "INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email",
    [name.trim(), email.toLowerCase(), hashed],
  );
  return rows[0];
}

export async function listUsers(db: Pool): Promise<User[]> {
  const { rows } = await db.query<User>(
    "SELECT id, name, email FROM users ORDER BY created_at DESC",
  );
  return rows;
}
```

`src/routes/users/schema.ts` — Zod schemas for request/response

```ts
import { z } from "zod";

export const CreateUserBody = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
});

export const UserResponse = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string().email(),
});
```

`src/routes/users/index.ts` — thin route handler

```ts
import type { FastifyInstance } from "fastify";
import { serializerCompiler, validatorCompiler } from "fastify-type-provider-zod";
import { CreateUserBody, UserResponse } from "./schema.js";
import { createUser, listUsers } from "../../services/users.js";

export default async function userRoutes(fastify: FastifyInstance) {
  fastify.setValidatorCompiler(validatorCompiler);
  fastify.setSerializerCompiler(serializerCompiler);

  fastify.get(
    "/",
    { schema: { response: { 200: UserResponse.array() } } },
    async () => listUsers(fastify.db),
  );

  fastify.post(
    "/",
    {
      schema: {
        body: CreateUserBody,
        response: { 201: UserResponse },
      },
    },
    async (request, reply) => {
      const user = await createUser(fastify.db, request.body);
      reply.status(201);
      return user;
    },
  );
}
```

### Inject Dependencies Explicitly

Pass dependencies (database, config, external clients) as function arguments rather than importing global singletons. This keeps service functions pure and easy to test:

```ts
// WRONG: service imports a global singleton
import { db } from "../db/client.js";

export async function listUsers() {
  return db.query("SELECT * FROM users");  // hidden dependency
}

// CORRECT: dependency passed as argument
export async function listUsers(db: Pool) {
  const { rows } = await db.query("SELECT * FROM users");
  return rows;
}
```

### When to Put Logic in the Route vs the Service

| Logic type                          | Where it lives         |
| ----------------------------------- | ---------------------- |
| Request parsing / response shaping  | Route handler          |
| Input validation (schema)           | Zod schema + route     |
| Business rules, domain invariants   | Service function       |
| Database queries                    | Service function       |
| HTTP status codes                   | Route handler          |
| Auth checks (who can do this?)      | Hook or route handler  |

Reference: [Fastify Routes](https://fastify.dev/docs/latest/Reference/Routes/) | [@fastify/error](https://github.com/fastify/fastify-error)
