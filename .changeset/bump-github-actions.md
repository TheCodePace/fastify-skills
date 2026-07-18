---
"@thecodepace/fastify-skills": patch
---

Maintain GitHub Actions and CI configuration:

- Bump GitHub Actions to latest major versions in `.github/workflows/ci.yaml` and `.github/workflows/release.yml`:
  - `actions/checkout` v6 → v7 (ESM, dep upgrades, blocks fork PR checkout for `pull_request_target`/`workflow_run`)
  - `actions/setup-node` v6 → v7 (ESM, dep upgrades, new `cache-primary-key`/`cache-matched-key` outputs)
  - `pnpm/action-setup` v4 → v6 (Node 24 runtime, pnpm v11 support; still honors the pinned `pnpm@10.30.1` from `package.json`)
- Fix the Release workflow, which was previously failing with "Unable to locate executable file: pnpm" by inserting the `pnpm/action-setup` step before `actions/setup-node`, matching the CI workflow.
- Extend `.github/dependabot.yml` with a `github-actions` ecosystem entry (weekly schedule) and mirror the existing `patch-and-minor` / `major` grouping so `.github/workflows/automerge.yml` keeps handling action PRs without modification.
