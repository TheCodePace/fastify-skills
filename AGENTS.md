# AGENTS.md

This file provides guidance to AI coding agents (Claude Code, Cursor, Copilot, etc.) when working with code in this repository.

## Repository Overview

A collection of skills for Claude.ai, Claude Code, Copilot, Cursor and all the AI coding agents enable to run Skill for working with fastify. Skills are packaged instructions and scripts that extend AI capabilities.

## Package Manager

This repository uses **pnpm** (v10.30.1). Always use `pnpm` instead of `npm` or `yarn`.

```bash
pnpm install        # install dependencies
pnpm run lint       # lint all files with ESLint
pnpm run validate   # validate all rule files against the rule schema
```

## Creating a New Skill

### Directory Structure

```
skills/
  {skill-name}/           # kebab-case directory name
    SKILL.md              # Required: skill definition
    rules/                # Required: best-practice rule files
      {rule-name}.md      # One file per rule topic
  {skill-name}.zip        # Required: packaged for distribution
```

### Naming Conventions

- **Skill directory**: `kebab-case` (e.g., `fastify-plugin`, `log-monitor`)
- **SKILL.md**: Always uppercase, always this exact filename
- **Rule files**: `kebab-case.md` (e.g., `error-handling.md`, `database-integration.md`)
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

## Rules

| Rule | File | Impact | Description |
| ---- | ---- | ------ | ----------- |
| ...  | ...  | ...    | ...         |

## Usage

{Topic-based guide linking to relevant rule files}

## Recommended Project Structure

{Directory tree showing the recommended layout}

## Present Results to User

{Template for how the agent should format results when presenting to users}

## Reference

{Links to official documentation}
````

### Rule File Format

Each rule file must follow this format exactly so the `validate-rules` tool can parse it. Files starting with `_` (e.g., `_template.md`) are excluded from validation.

````markdown
---
title: Rule Title Here
impact: HIGH
impactDescription: Optional description of impact
tags: tag1, tag2
---

## Rule Title Here

Brief explanation of the rule and why it matters.

**Incorrect (description of what's wrong):**

```typescript
// Bad code example here
```

**Correct (description of what's right):**

```typescript
// Good code example here
```

Reference: [Link text](https://example.com)
````

**Key requirements validated by `pnpm run validate`:**

- `title` — required (non-empty)
- `impact` — must be one of: `CRITICAL`, `HIGH`, `MEDIUM-HIGH`, `MEDIUM`, `LOW-MEDIUM`, `LOW`
- `explanation` — required (text before the first example label)
- Examples — at least one `**Incorrect ...:**` label **and** one `**Correct ...:**` label, each followed by a fenced code block. Do **not** use `###` headings as example labels; use bold labels (`**...**`) instead.

### Best Practices for Context Efficiency

Skills are loaded on-demand — only the skill name and description are loaded at startup. The full `SKILL.md` loads into context only when the agent decides the skill is relevant. To minimize context usage:

- **Keep SKILL.md under 500 lines** — put detailed reference material in separate files
- **Write specific descriptions** — helps the agent know exactly when to activate the skill
- **Use progressive disclosure** — reference supporting files that get read only when needed
- **Prefer scripts over inline code** — script execution doesn't consume context (only output does)
- **File references work one level deep** — link directly from SKILL.md to supporting files

### Creating the Zip Package

After creating or updating a skill:

```bash
cd skills
zip -r {skill-name}.zip {skill-name}/
```

### Adding a Changeset

Every change to skill content should be accompanied by a changeset file so that semantic versioning is maintained automatically.

```bash
# Create .changeset/{descriptive-name}.md
```

```markdown
---
"@thecodepace/fastify-skills": minor
---

Short description of the change.
```

Use `patch` for fixes, `minor` for new rules or content additions, `major` for breaking changes.

### End-User Installation

Document these two installation methods for users:

**Claude Code:**

```bash
cp -r skills/{skill-name} ~/.claude/skills/
```

**claude.ai:**
Add the skill to project knowledge or paste SKILL.md contents into the conversation.

If the skill requires network access, instruct users to add required domains at `claude.ai/settings/capabilities`.

