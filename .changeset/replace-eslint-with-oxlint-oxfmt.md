---
"@thecodepace/fastify-skills": minor
---

Replace ESLint and `typescript-eslint` with `oxlint` (lint) and `oxfmt` (format). Removes `eslint`, `@eslint/js`, `@eslint/markdown`, `globals`, `typescript-eslint`, and `jiti` from devDependencies. Adds `oxlint` and `oxfmt`. Adds `.oxlintrc.json` (correctness + suspicious categories, with allowlists for `__dirname` / `__filename` and `no-await-in-loop`) and `.oxfmtrc.json` (Prettier-compatible defaults, print width 100, single-quote off, trailing commas all, embedded language formatting auto; ignores `.changeset/*.md` and `CHANGELOG.md` so `@changesets/cli` output is left untouched). `pnpm lint` runs `oxlint`, `pnpm lint:fix` runs `oxlint --fix`, and new `pnpm format` / `pnpm format:check` run `oxfmt`. Pre-commit lefthook now runs oxlint and oxfmt in parallel. CI gains a format check step.
