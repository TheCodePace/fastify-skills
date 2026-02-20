/**
 * Parser for rule markdown files
 */

import { readFile } from "fs/promises";
import type { ImpactLevel, Rule } from "./types.js";

export interface ParsedRule {
  rule: Rule;
}

/**
 * Parse a rule markdown file into a Rule object
 */
export async function parseRuleFile(filePath: string): Promise<ParsedRule> {
  const rawContent = await readFile(filePath, "utf-8");
  const content = rawContent.replace(/\r\n/g, "\n");

  // Extract frontmatter
  let frontmatter: Record<string, string> = {};
  let contentStart = 0;

  if (content.startsWith("---")) {
    const frontmatterEnd = content.indexOf("---", 3);
    if (frontmatterEnd !== -1) {
      const frontmatterText = content.slice(3, frontmatterEnd).trim();
      frontmatterText.split("\n").forEach((line) => {
        const [key, ...valueParts] = line.split(":");
        if (key && valueParts.length) {
          const value = valueParts.join(":").trim();
          frontmatter[key.trim()] = value.replace(/^["']|["']$/g, "");
        }
      });
      contentStart = frontmatterEnd + 3;
    }
  }

  // Parse the rule content
  const ruleContent = content.slice(contentStart).trim();
  const ruleLines = ruleContent.split("\n");

  // Extract title (first ## heading)
  let title = "";
  let titleLine = 0;
  for (let i = 0; i < ruleLines.length; i++) {
    if (ruleLines[i].startsWith("##") && !ruleLines[i].startsWith("###")) {
      title = ruleLines[i].replace(/^##+\s*/, "").trim();
      titleLine = i;
      break;
    }
  }

  // Extract impact, explanation, examples, references
  let impact: ImpactLevel = "MEDIUM";
  let impactDescription = "";
  let explanation = "";
  const examples: Rule["examples"] = [];
  const references: string[] = [];

  let currentExample: {
    label: string;
    description?: string;
    code: string;
    language?: string;
    additionalText?: string;
  } | null = null;
  let inCodeBlock = false;
  let codeBlockLanguage = "typescript";
  let codeBlockContent: string[] = [];
  let afterCodeBlock = false;
  let additionalText: string[] = [];
  let hasCodeBlockForCurrentExample = false;

  for (let i = titleLine + 1; i < ruleLines.length; i++) {
    const line = ruleLines[i];

    // Impact line
    if (line.includes("**Impact:")) {
      const match = line.match(
        /\*\*Impact:\s*(\w+(?:-\w+)?)\s*(?:\(([^)]+)\))?/i,
      );
      if (match) {
        impact = match[1].toUpperCase().replace(/-/g, "-") as ImpactLevel;
        impactDescription = match[2] || "";
      }
      continue;
    }

    // Code block start/end
    if (line.startsWith("```")) {
      if (inCodeBlock) {
        if (currentExample) {
          currentExample.code = codeBlockContent.join("\n");
          currentExample.language = codeBlockLanguage;
        }
        codeBlockContent = [];
        inCodeBlock = false;
        afterCodeBlock = true;
      } else {
        inCodeBlock = true;
        hasCodeBlockForCurrentExample = true;
        codeBlockLanguage = line.slice(3).trim() || "typescript";
        codeBlockContent = [];
        afterCodeBlock = false;
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockContent.push(line);
      continue;
    }

    // Example label: **Label:** or **Label (description):**
    const labelMatch = line.match(/^\*\*([^:]+?):\*?\*?$/);
    if (labelMatch) {
      if (currentExample) {
        if (additionalText.length > 0) {
          currentExample.additionalText = additionalText.join("\n\n");
          additionalText = [];
        }
        examples.push(currentExample);
      }
      afterCodeBlock = false;
      hasCodeBlockForCurrentExample = false;

      const fullLabel = labelMatch[1].trim();
      const descMatch = fullLabel.match(
        /^([A-Za-z]+(?:\s+[A-Za-z]+)*)\s*\(([^()]+)\)$/,
      );
      currentExample = {
        label: descMatch ? descMatch[1].trim() : fullLabel,
        description: descMatch ? descMatch[2].trim() : undefined,
        code: "",
        language: codeBlockLanguage,
      };
      continue;
    }

    // Reference links
    if (line.startsWith("Reference:") || line.startsWith("References:")) {
      if (currentExample) {
        if (additionalText.length > 0) {
          currentExample.additionalText = additionalText.join("\n\n");
          additionalText = [];
        }
        examples.push(currentExample);
        currentExample = null;
      }

      const refMatch = line.match(/\[([^\]]+)\]\(([^)]+)\)/g);
      if (refMatch) {
        references.push(
          ...refMatch.map((ref) => {
            const m = ref.match(/\[([^\]]+)\]\(([^)]+)\)/);
            return m ? m[2] : ref;
          }),
        );
      }
      continue;
    }

    // Regular text
    if (line.trim() && !line.startsWith("#")) {
      if (!currentExample && !inCodeBlock) {
        explanation += (explanation ? "\n\n" : "") + line;
      } else if (
        currentExample &&
        (afterCodeBlock || !hasCodeBlockForCurrentExample)
      ) {
        additionalText.push(line);
      }
    }
  }

  // Handle last example
  if (currentExample) {
    if (additionalText.length > 0) {
      currentExample.additionalText = additionalText.join("\n\n");
    }
    examples.push(currentExample);
  }

  const rule: Rule = {
    title: frontmatter.title || title,
    impact: (frontmatter.impact as ImpactLevel) || impact,
    impactDescription:
      frontmatter.impactDescription || impactDescription || undefined,
    explanation: frontmatter.explanation || explanation.trim(),
    examples,
    references: frontmatter.references
      ? frontmatter.references.split(",").map((r: string) => r.trim())
      : references.length > 0
      ? references
      : undefined,
    tags: frontmatter.tags
      ? frontmatter.tags.split(",").map((t: string) => t.trim())
      : undefined,
  };

  return { rule };
}
