#!/usr/bin/env tsx
/**
 * Data Validation Script
 * Validates shows.json and rulesets.json against their JSON schemas
 * and checks regex pattern validity
 */

import Ajv, { type AnySchema } from "ajv";
import addFormats from "ajv-formats";
import * as fs from "fs";
import * as path from "path";

const ROOT_DIR = path.resolve(__dirname, "..");
const DATA_DIR = path.join(ROOT_DIR, "data");
const SCHEMAS_DIR = path.join(ROOT_DIR, ".github", "schemas");

interface ValidationResult {
  valid: boolean;
  errors: string[];
}

interface Ruleset {
  id: number;
  mediaId: number;
  topic: string;
  filters: string;
  titleRegexRules: string;
  episodeRegex: string | null;
  seasonRegex: string | null;
  media: {
    media_tvdbId: number;
  };
}

interface Show {
  tvdbId: number;
  name: string;
}

interface Filter {
  type: string;
  value: string | number;
}

interface TitleRegexRule {
  type: string;
  pattern?: string;
}

// Initialize AJV with formats
const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

function loadJson<T>(filePath: string): T {
  const content = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(content) as T;
}

function validateJsonSchema(data: unknown, schemaPath: string, dataName: string): ValidationResult {
  const schema = loadJson<AnySchema>(schemaPath);
  const validate = ajv.compile(schema);
  const valid = validate(data);

  if (!valid && validate.errors) {
    const errors = validate.errors.map((err) => {
      const path = err.instancePath || "(root)";
      return `${dataName}${path}: ${err.message}`;
    });
    return { valid: false, errors };
  }

  return { valid: true, errors: [] };
}

function validateRegexPattern(pattern: string, context: string): string | null {
  try {
    new RegExp(pattern);
    return null;
  } catch (e) {
    return `Invalid regex in ${context}: "${pattern}" - ${(e as Error).message}`;
  }
}

function validateEmbeddedJson(jsonString: string, context: string): ValidationResult {
  try {
    JSON.parse(jsonString);
    return { valid: true, errors: [] };
  } catch (e) {
    return {
      valid: false,
      errors: [`Invalid embedded JSON in ${context}: ${(e as Error).message}`],
    };
  }
}

function validateRulesetRegexPatterns(rulesets: Ruleset[]): ValidationResult {
  const errors: string[] = [];

  for (const ruleset of rulesets) {
    const context = `ruleset ${ruleset.id} (${ruleset.topic})`;

    // Validate episodeRegex
    if (ruleset.episodeRegex && ruleset.episodeRegex.trim() !== "") {
      const err = validateRegexPattern(ruleset.episodeRegex, `${context} episodeRegex`);
      if (err) errors.push(err);
    }

    // Validate seasonRegex
    if (ruleset.seasonRegex && ruleset.seasonRegex.trim() !== "") {
      const err = validateRegexPattern(ruleset.seasonRegex, `${context} seasonRegex`);
      if (err) errors.push(err);
    }

    // Validate filters JSON and regex patterns within
    const filtersResult = validateEmbeddedJson(ruleset.filters, `${context} filters`);
    if (!filtersResult.valid) {
      errors.push(...filtersResult.errors);
    } else {
      const filters: Filter[] = JSON.parse(ruleset.filters);
      for (let i = 0; i < filters.length; i++) {
        const filter = filters[i];
        if (filter.type === "Regex" && typeof filter.value === "string") {
          const err = validateRegexPattern(filter.value, `${context} filters[${i}]`);
          if (err) errors.push(err);
        }
      }
    }

    // Validate titleRegexRules JSON and regex patterns within
    const titleRulesResult = validateEmbeddedJson(
      ruleset.titleRegexRules,
      `${context} titleRegexRules`
    );
    if (!titleRulesResult.valid) {
      errors.push(...titleRulesResult.errors);
    } else {
      const titleRules: TitleRegexRule[] = JSON.parse(ruleset.titleRegexRules);
      for (let i = 0; i < titleRules.length; i++) {
        const rule = titleRules[i];
        if (rule.type === "regex" && rule.pattern) {
          const err = validateRegexPattern(rule.pattern, `${context} titleRegexRules[${i}]`);
          if (err) errors.push(err);
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

function checkDuplicateIds(rulesets: Ruleset[]): ValidationResult {
  const errors: string[] = [];
  const seenIds = new Set<number>();

  for (const ruleset of rulesets) {
    if (seenIds.has(ruleset.id)) {
      errors.push(`Duplicate ruleset ID: ${ruleset.id}`);
    }
    seenIds.add(ruleset.id);
  }

  return { valid: errors.length === 0, errors };
}

function checkDuplicateShowIds(shows: Show[]): ValidationResult {
  const errors: string[] = [];
  const seenIds = new Set<number>();

  for (const show of shows) {
    if (seenIds.has(show.tvdbId)) {
      errors.push(`Duplicate show tvdbId: ${show.tvdbId} (${show.name})`);
    }
    seenIds.add(show.tvdbId);
  }

  return { valid: errors.length === 0, errors };
}

async function main(): Promise<void> {
  console.log("Starting data validation...\n");
  let hasErrors = false;
  const allErrors: string[] = [];

  // Validate shows.json
  console.log("Validating shows.json...");
  const showsPath = path.join(DATA_DIR, "shows.json");
  const showsSchemaPath = path.join(SCHEMAS_DIR, "shows.schema.json");

  if (fs.existsSync(showsPath)) {
    const shows = loadJson<Show[]>(showsPath);

    // Schema validation
    const showsSchemaResult = validateJsonSchema(shows, showsSchemaPath, "shows.json");
    if (!showsSchemaResult.valid) {
      allErrors.push(...showsSchemaResult.errors);
      hasErrors = true;
    }

    // Duplicate check
    const showsDuplicateResult = checkDuplicateShowIds(shows);
    if (!showsDuplicateResult.valid) {
      allErrors.push(...showsDuplicateResult.errors);
      hasErrors = true;
    }

    console.log(`  Schema: ${showsSchemaResult.valid ? "PASS" : "FAIL"}`);
    console.log(`  Duplicates: ${showsDuplicateResult.valid ? "PASS" : "FAIL"}`);
  } else {
    console.log("  shows.json not found, skipping...");
  }

  // Validate rulesets.json
  console.log("\nValidating rulesets.json...");
  const rulesetsPath = path.join(DATA_DIR, "rulesets.json");
  const rulesetsSchemaPath = path.join(SCHEMAS_DIR, "rulesets.schema.json");

  if (fs.existsSync(rulesetsPath)) {
    const rulesets = loadJson<Ruleset[]>(rulesetsPath);

    // Schema validation
    const rulesetsSchemaResult = validateJsonSchema(rulesets, rulesetsSchemaPath, "rulesets.json");
    if (!rulesetsSchemaResult.valid) {
      allErrors.push(...rulesetsSchemaResult.errors);
      hasErrors = true;
    }

    // Duplicate check
    const rulesetsDuplicateResult = checkDuplicateIds(rulesets);
    if (!rulesetsDuplicateResult.valid) {
      allErrors.push(...rulesetsDuplicateResult.errors);
      hasErrors = true;
    }

    // Regex validation
    const regexResult = validateRulesetRegexPatterns(rulesets);
    if (!regexResult.valid) {
      allErrors.push(...regexResult.errors);
      hasErrors = true;
    }

    console.log(`  Schema: ${rulesetsSchemaResult.valid ? "PASS" : "FAIL"}`);
    console.log(`  Duplicates: ${rulesetsDuplicateResult.valid ? "PASS" : "FAIL"}`);
    console.log(`  Regex patterns: ${regexResult.valid ? "PASS" : "FAIL"}`);
  } else {
    console.log("  rulesets.json not found, skipping...");
  }

  // Summary
  console.log("\n" + "=".repeat(50));
  if (hasErrors) {
    console.log("VALIDATION FAILED\n");
    console.log("Errors:");
    for (const error of allErrors) {
      console.log(`  - ${error}`);
    }
    process.exit(1);
  } else {
    console.log("VALIDATION PASSED");
    console.log("All data files are valid.");
  }
}

main().catch((e) => {
  console.error("Validation script failed:", e);
  process.exit(1);
});
