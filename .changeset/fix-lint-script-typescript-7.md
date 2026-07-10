---
"@thecodepace/fastify-skills": patch
---

Pin `typescript` catalog version back to `^6.0.3` so `typescript-eslint@8.63.0` can resolve the runtime TypeScript API. The previous bump to `typescript@7.0.2` changed the package's `exports` map so `require("typescript")` no longer exposes `Extension`, which crashed `pnpm lint` with `TypeError: Cannot read properties of undefined (reading 'Cjs')`.
