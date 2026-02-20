# AGENTS.md

This file provides guidance to AI coding agents (Claude Code, Cursor, Copilot, etc.) when working with code in this repository.

## Repository Overview

A collection of skills for Claude.ai, Claude Code, Copilot, Cursor and all the AI coding agents enable to run Skill for working with fastify. Skills are packaged instructions and scripts that extend AI capabilities.

## Existing Skills

### fastify-best-practise

Apply Fastify best practices when creating servers, plugins, routes, schemas, hooks, decorators, error handling, testing, and TypeScript integration.

Rules are stored in `skills/fastify-best-practise/rules/`:

| Rule                    | File                          | Impact     |
| ----------------------- | ----------------------------- | ---------- |
| Create Server           | `create-server.md`            | LOW-MEDIUM |
| Create Plugin           | `create-plugin.md`            | LOW-MEDIUM |
| Autoload                | `autoload.md`                 | HIGH       |
| Route Best Practices    | `route-best-practices.md`     | MEDIUM     |
| Schema Validation (Zod) | `schema-validation-zod.md`    | HIGH       |
| Encapsulation           | `encapsulation.md`            | HIGH       |
| Error Handling          | `error-handling.md`           | HIGH       |
| Hooks & Lifecycle       | `hooks-lifecycle.md`          | MEDIUM     |
| Testing                 | `testing.md`                  | HIGH       |
| TypeScript              | `typescript-integration.md`   | MEDIUM     |
| Decorators              | `decorators.md`               | MEDIUM     |

When adding a new rule to this skill:

1. Create the rule file in `skills/fastify-best-practise/rules/` following the `_template.md` format.
2. Add a row to the rules table in `skills/fastify-best-practise/SKILL.md`.
3. Add the rule to the relevant usage entries in `SKILL.md`.
4. Update the rules table in `README.md`.
5. Update the rules table in this file (`AGENTS.md`).

## Creating a New Skill

### Directory Structure

```
skills/
  {skill-name}/           # kebab-case directory name
    SKILL.md              # Required: skill definition
    scripts/              # Required: executable scripts
      {script-name}.sh    # Bash scripts (preferred)
  {skill-name}.zip        # Required: packaged for distribution
```

### Naming Conventions

- **Skill directory**: `kebab-case` (e.g., `fastify-plugin`, `log-monitor`)
- **SKILL.md**: Always uppercase, always this exact filename
- **Scripts**: `kebab-case.sh` (e.g., `deploy.sh`, `fetch-logs.sh`)
- **Zip file**: Must match directory name exactly: `{skill-name}.zip`

### SKILL.md Format

````markdown
---
name: { skill-name }
description:
  {
    One sentence describing when to use this skill. Include trigger phrases like "Deploy my app",
    "Check logs",
    etc.,
  }
---

# {Skill Title}

{Brief description of what the skill does.}

## How It Works

{Numbered list explaining the skill's workflow}

## Usage

```bash
bash /mnt/skills/user/{skill-name}/scripts/{script}.sh [args]
```
````

**Arguments:**

- `arg1` - Description (defaults to X)

**Examples:**
{Show 2-3 common usage patterns}

## Output

{Show example output users will see}

## Present Results to User

{Template for how Claude should format results when presenting to users}

## Troubleshooting

{Common issues and solutions, especially network/permissions errors}

````

### Best Practices for Context Efficiency

Skills are loaded on-demand — only the skill name and description are loaded at startup. The full `SKILL.md` loads into context only when the agent decides the skill is relevant. To minimize context usage:

- **Keep SKILL.md under 500 lines** — put detailed reference material in separate files
- **Write specific descriptions** — helps the agent know exactly when to activate the skill
- **Use progressive disclosure** — reference supporting files that get read only when needed
- **Prefer scripts over inline code** — script execution doesn't consume context (only output does)
- **File references work one level deep** — link directly from SKILL.md to supporting files

### Script Requirements

- Use `#!/bin/bash` shebang
- Use `set -e` for fail-fast behavior
- Write status messages to stderr: `echo "Message" >&2`
- Write machine-readable output (JSON) to stdout
- Include a cleanup trap for temp files
- Reference the script path as `/mnt/skills/user/{skill-name}/scripts/{script}.sh`

### Creating the Zip Package

After creating or updating a skill:

```bash
cd skills
zip -r {skill-name}.zip {skill-name}/
````

### End-User Installation

Document these two installation methods for users:

**Claude Code:**

```bash
cp -r skills/{skill-name} ~/.claude/skills/
```

**claude.ai:**
Add the skill to project knowledge or paste SKILL.md contents into the conversation.

If the skill requires network access, instruct users to add required domains at `claude.ai/settings/capabilities`.

Add the skill to project knowledge or paste SKILL.md contents into the conversation.

If the skill requires network access, instruct users to add required domains at `claude.ai/settings/capabilities`.
