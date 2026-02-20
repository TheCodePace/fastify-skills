#!/usr/bin/env node
/**
 * Validate rule files follow the correct structure
 */

import { readdir } from "fs/promises";
import { join } from "path";
import { SKILLS } from "./config.js";
import { parseRuleFile } from "./parser.js";
import type { ImpactLevel, Rule } from "./types.js";

interface ValidationError {
  file: string;
  message: string;
}

const VALID_IMPACTS: ImpactLevel[] = [
  "CRITICAL",
  "HIGH",
  "MEDIUM-HIGH",
  "MEDIUM",
  "LOW-MEDIUM",
  "LOW",
];

/**
 * Validate a single rule
 */
function validateRule(rule: Rule, file: string): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!rule.title || rule.title.trim().length === 0) {
    errors.push({ file, message: "Missing or empty title" });
  }

  if (!rule.explanation || rule.explanation.trim().length === 0) {
    errors.push({ file, message: "Missing or empty explanation" });
  }

  if (!rule.examples || rule.examples.length === 0) {
    errors.push({
      file,
      message:
        "Missing examples (need at least one incorrect and one correct example)",
    });
  } else {
    const codeExamples = rule.examples.filter(
      (e) => e.code && e.code.trim().length > 0,
    );

    const hasIncorrect = codeExamples.some(
      (e) =>
        e.label.toLowerCase().includes("incorrect") ||
        e.label.toLowerCase().includes("wrong") ||
        e.label.toLowerCase().includes("bad"),
    );
    const hasCorrect = codeExamples.some(
      (e) =>
        e.label.toLowerCase().includes("correct") ||
        e.label.toLowerCase().includes("good") ||
        e.label.toLowerCase().includes("usage") ||
        e.label.toLowerCase().includes("implementation") ||
        e.label.toLowerCase().includes("example"),
    );

    if (codeExamples.length === 0) {
      errors.push({ file, message: "Missing code examples" });
    } else if (!hasIncorrect && !hasCorrect) {
      errors.push({
        file,
        message: "Missing incorrect or correct examples",
      });
    }
  }

  if (!VALID_IMPACTS.includes(rule.impact)) {
    errors.push({
      file,
      message: `Invalid impact level: ${
        rule.impact
      }. Must be one of: ${VALID_IMPACTS.join(", ")}`,
    });
  }

  return errors;
}

/**
 * Main validation function
 */
async function validate() {
  try {
    let totalFiles = 0;
    const allErrors: ValidationError[] = [];

    for (const [skillName, config] of Object.entries(SKILLS)) {
      console.log(`\nValidating skill: ${skillName}`);
      console.log(`Rules directory: ${config.rulesDir}`);

      const files = await readdir(config.rulesDir);
      const ruleFiles = files.filter(
        (f) => f.endsWith(".md") && !f.startsWith("_"),
      );
      totalFiles += ruleFiles.length;

      for (const file of ruleFiles) {
        const filePath = join(config.rulesDir, file);
        try {
          const { rule } = await parseRuleFile(filePath);
          const errors = validateRule(rule, `${skillName}/${file}`);
          allErrors.push(...errors);
        } catch (error) {
          allErrors.push({
            file: `${skillName}/${file}`,
            message: `Failed to parse: ${
              error instanceof Error ? error.message : String(error)
            }`,
          });
        }
      }
    }

    if (allErrors.length > 0) {
      console.error("\n\u2717 Validation failed:\n");
      allErrors.forEach((error) => {
        console.error(`  ${error.file}: ${error.message}`);
      });
      process.exit(1);
    } else {
      console.log(`\n\u2713 All ${totalFiles} rule files are valid`);
    }
  } catch (error) {
    console.error("Validation failed:", error);
    process.exit(1);
  }
}

validate();
