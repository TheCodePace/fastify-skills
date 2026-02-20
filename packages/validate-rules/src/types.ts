/**
 * Type definitions for Fastify best practice rules
 */

export type ImpactLevel =
  | "CRITICAL"
  | "HIGH"
  | "MEDIUM-HIGH"
  | "MEDIUM"
  | "LOW-MEDIUM"
  | "LOW";

export interface CodeExample {
  label: string;
  description?: string;
  code: string;
  language?: string;
  additionalText?: string;
}

export interface Rule {
  title: string;
  impact: ImpactLevel;
  impactDescription?: string;
  explanation: string;
  examples: CodeExample[];
  references?: string[];
  tags?: string[];
}
