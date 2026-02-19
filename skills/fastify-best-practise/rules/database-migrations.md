---
title: Database Migrations
impact: HIGH
impactDescription: Running migrations automatically at startup keeps the schema in sync with the application code and prevents runtime errors
tags: migrations, database, postgrator, sql, schema
---

## Database Migrations

Always manage schema changes through plain SQL migration files tracked in version control. Use [Postgrator](https://github.com/rickbergfalk/postgrator) to apply them: it records the current schema version in a `schemaversion` table and runs only the files that have not yet been applied.

Run migrations at application startup (or as a separate CI step) so the database schema is always in sync with the deployed code.

### Install

```bash
npm install postgrator pg
```

### Migration File Naming Convention

Postgrator discovers migration files by name. Each file must follow the pattern:

```
{version}.{do|undo}.{description}.sql
```

Examples:
```
migrations/
  001.do.create-users-table.sql
  001.undo.create-users-table.sql
  002.do.add-avatar-to-users.sql
  002.undo.add-avatar-to-users.sql
```

`do` files are applied in ascending version order. `undo` files are run when rolling back. The `undo` file is optional if you never need to roll back a migration.

`migrations/001.do.create-users-table.sql`

```sql
CREATE TABLE users (
  id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name    TEXT NOT NULL,
  email   TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

`migrations/001.undo.create-users-table.sql`

```sql
DROP TABLE IF EXISTS users;
```

`migrations/002.do.add-avatar-to-users.sql`

```sql
ALTER TABLE users ADD COLUMN avatar TEXT;
```

### Run Migrations at Startup

**Incorrect (applying schema changes manually or never):**

```ts
// WRONG: schema changes applied by hand via psql — not repeatable, not tracked
// psql -U postgres -d mydb -c "ALTER TABLE users ADD COLUMN avatar TEXT"
```

**Correct (migrations run automatically before the server starts accepting traffic):**

`src/db/migrate.ts`

```ts
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import Postgrator from "postgrator";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

export async function runMigrations(connectionString?: string) {
  const client = new pg.Client({
    connectionString: connectionString ?? process.env.DATABASE_URL,
  });
  await client.connect();

  try {
    const postgrator = new Postgrator({
      migrationPattern: path.join(__dirname, "../../migrations/*"),
      driver: "pg",
      execQuery: (query) => client.query(query),
    });

    await postgrator.migrate();
  } finally {
    await client.end();
  }
}
```

`src/app.ts`

```ts
import { buildServer } from "./server.js";
import { runMigrations } from "./db/migrate.js";

await runMigrations();        // ← run before listen()

const server = buildServer();
await server.listen({ port: Number(process.env.PORT ?? 3000), host: "0.0.0.0" });
```

### Project Layout

```
migrations/                         # Raw SQL migration files (committed to git)
  001.do.create-users-table.sql
  001.undo.create-users-table.sql
  002.do.add-avatar-to-users.sql
  002.undo.add-avatar-to-users.sql
src/
  db/
    migrate.ts                      # runMigrations() helper
  plugins/
    db.ts                           # pg Pool plugin
  server.ts
  app.ts
```

### CI/CD Strategy

For production deployments, run migrations as a separate step before the new application version receives traffic:

```yaml
# .github/workflows/deploy.yml (excerpt)
steps:
  - name: Run database migrations
    run: node -e "import('./src/db/migrate.js').then(m => m.runMigrations())"
    env:
      DATABASE_URL: ${{ secrets.DATABASE_URL }}

  - name: Deploy application
    run: ./deploy.sh
```

This ensures that if a migration fails, the old application version keeps running without downtime.

### Never Modify Existing Migration Files

**Incorrect (editing an already-applied migration):**

```sql
-- WRONG: editing 001.do.create-users-table.sql after it has been applied breaks Postgrator's checksum validation
ALTER TABLE users ADD COLUMN avatar TEXT;   -- added after the fact
```

**Correct (always create a new migration file for changes):**

```bash
# Create migrations/002.do.add-avatar-to-users.sql
echo "ALTER TABLE users ADD COLUMN avatar TEXT;" > migrations/002.do.add-avatar-to-users.sql
```

Postgrator validates file checksums against what was previously applied. Editing an applied file causes migration to fail on the next run.

Reference: [Postgrator](https://github.com/rickbergfalk/postgrator) | [node-postgres](https://node-postgres.com/)
