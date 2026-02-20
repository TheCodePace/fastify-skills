# Copilot Instructions

## Changeset Requirement

When completing work for a PR, **always ensure a changeset file exists** before considering the task done.

### Rules

1. **Check for existing changesets**: Before creating a new changeset, check if a changeset file already exists in the `.changeset/` directory (files ending in `.md`, excluding `README.md`). If a relevant changeset already covers the current changes, do not create a duplicate.
2. **Create a changeset if missing**: If no changeset exists for the current changes, create one by running:
   ```bash
   pnpm changeset
   ```
3. **Choose the correct bump type**:
   - `patch` — bug fixes, documentation updates, minor tweaks
   - `minor` — new features, new skills, new rules
   - `major` — breaking changes
4. **Include affected packages**: If the change affects a workspace package (e.g., `@thecodepace/validate-rules`), list it in the changeset frontmatter instead of or in addition to the root package.
5. **Write a clear summary**: The changeset description should be a concise, human-readable summary of what changed and why.
