# Fastify Skills

A collection of skills for AI coding agents ([Claude Code](https://docs.anthropic.com/en/docs/agents-and-tools/claude-code/overview), [Copilot](https://github.com/features/copilot), [Cursor](https://www.cursor.com/), etc.) to help you build production-ready [Fastify](https://fastify.dev/) applications following best practices.

Skills follow the [Agent Skills](https://agentskills.io/) format.

## Available Skills

### fastify-best-practise

Apply Fastify best practices when creating servers, plugins, routes, schemas, hooks, error handling, testing, and TypeScript integration.

| Rule                    | Impact     | Description                                                                |
| ----------------------- | ---------- | -------------------------------------------------------------------------- |
| Configuration           | HIGH       | Environment config, logger setup, security options, and graceful shutdown  |
| Create Server           | LOW-MEDIUM | Use a `buildServer()` factory function for reusable, testable server setup |
| Create Plugin           | LOW-MEDIUM | Encapsulate reusable functionality in plugins with `fastify-plugin`        |
| Autoload                | HIGH       | Automatically load plugins and routes with `@fastify/autoload`             |
| Route Best Practices    | MEDIUM     | Organize routes with plugins/prefixes, async handlers, full route options  |
| Schema Validation (Zod) | HIGH       | Type-safe validation with Zod + `fastify-type-provider-zod`                |
| Encapsulation           | HIGH       | Proper scope isolation and when to use `fastify-plugin`                    |
| Error Handling          | HIGH       | Custom error handlers, `@fastify/error`, `@fastify/sensible`, 404 handling |
| Hooks & Lifecycle       | MEDIUM     | Request lifecycle hooks for auth, logging, rate limiting                   |
| Testing                 | HIGH       | Test with `inject()`, buildServer pattern, vitest/node:test                |
| TypeScript              | MEDIUM     | Type providers, module augmentation, typed decorators                      |

## Installation

```bash
npx skills add TheCodePace/fastify-skills
```

## Usage

Skills are automatically available once installed. The agent will use them when relevant tasks are detected.

**Examples:**

- "Create a new Fastify server with routes and plugins"
- "Add a users REST API with Zod validation"
- "How should I structure my Fastify app?"
- "Write tests for my Fastify routes"

Each skill contains:

- `SKILL.md` — Instructions for the agent
- `rules/` — Best practice rules organized by topic

## License

MIT
