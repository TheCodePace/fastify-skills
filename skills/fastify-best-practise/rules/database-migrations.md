---
title: Database Migrations
impact: HIGH
impactDescription: Running migrations automatically at startup keeps the schema in sync with the application code and prevents runtime errors
tags: migrations, database, drizzle, prisma, schema, flyway
---

## Database Migrations

Always manage schema changes through migration files tracked in version control. Run migrations at application startup (or as a separate CI step) so the database schema is always in sync with the deployed code.

### Run Migrations at Startup

**Incorrect (applying schema changes manually or never):**

```ts
// WRONG: schema changes applied by hand via psql — not repeatable, not tracked
// psql -U postgres -d mydb -c "ALTER TABLE users ADD COLUMN avatar TEXT"
```

**Correct (migrations run automatically before the server starts accepting traffic):**

`src/app.ts`

```ts
import { buildServer } from "./server.js";
import { runMigrations } from "./db/migrate.js";

const server = buildServer();

await runMigrations();        // ← run before listen()
await server.listen({ port: Number(process.env.PORT ?? 3000), host: "0.0.0.0" });
```

### Drizzle ORM Migrations

**Generate migration files:**

```bash
# Generate a new migration based on schema changes
npx drizzle-kit generate
```

**Apply migrations at startup:**

`src/db/migrate.ts`

```ts
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

export async function runMigrations() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool);

  await migrate(db, { migrationsFolder: "./drizzle" });

  await pool.end();
}
```

**Project layout:**

```
drizzle/           # Generated migration SQL files (committed to git)
  0000_init.sql
  0001_add_avatar.sql
drizzle.config.ts  # Drizzle Kit config
src/
  db/
    schema.ts      # Source of truth for table definitions
    migrate.ts     # runMigrations() helper
```

`drizzle.config.ts`

```ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

### Prisma Migrations

**Create a migration:**

```bash
npx prisma migrate dev --name add_avatar_to_user
```

**Apply migrations in production / at startup:**

```bash
npx prisma migrate deploy
```

`src/db/migrate.ts`

```ts
import { execSync } from "node:child_process";

export function runMigrations() {
  execSync("npx prisma migrate deploy", { stdio: "inherit" });
}
```

Or call `migrate deploy` as a pre-start script in `package.json`:

```json
{
  "scripts": {
    "start": "prisma migrate deploy && node dist/app.js"
  }
}
```

### CI/CD Strategy

For production deployments, run migrations as a separate step before the new application version receives traffic:

```yaml
# .github/workflows/deploy.yml (excerpt)
steps:
  - name: Run database migrations
    run: npx drizzle-kit migrate
    env:
      DATABASE_URL: ${{ secrets.DATABASE_URL }}

  - name: Deploy application
    run: ./deploy.sh
```

This ensures that if a migration fails, the old application version keeps running without downtime.

### Never Modify Existing Migration Files

**Incorrect (editing an already-applied migration):**

```sql
-- WRONG: editing 0000_init.sql after it has been applied breaks the migration history
ALTER TABLE users ADD COLUMN avatar TEXT;   -- added after the fact
```

**Correct (always create a new migration for changes):**

```bash
npx drizzle-kit generate   # creates 0001_add_avatar.sql
```

Reference: [Drizzle Kit Migrations](https://orm.drizzle.team/docs/migrations) | [Prisma Migrate](https://www.prisma.io/docs/orm/prisma-migrate)
