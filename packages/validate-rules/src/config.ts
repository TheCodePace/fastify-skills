/**
 * Configuration for the validation tooling
 */

import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export const SKILLS_DIR = join(__dirname, "../../..", "skills");

export interface SkillConfig {
  name: string;
  title: string;
  description: string;
  skillDir: string;
  rulesDir: string;
}

export const SKILLS: Record<string, SkillConfig> = {
  "fastify-best-practise": {
    name: "fastify-best-practise",
    title: "Fastify Best Practices",
    description: "Fastify best practice rules",
    skillDir: join(SKILLS_DIR, "fastify-best-practise"),
    rulesDir: join(SKILLS_DIR, "fastify-best-practise/rules"),
  },
};
