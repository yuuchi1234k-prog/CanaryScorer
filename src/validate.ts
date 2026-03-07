// validate.ts
// Single Responsibility: Lint, Type Check, and Validate Manifest without failing the CI.

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import * as v from 'valibot';

// Simple schema for manifest.json
const ManifestSchema = v.object({
  version: v.string()
});

function main(): void {
  console.log("--- STARTING VALIDATION MODE ---");

  // 1. Validate manifest.json if it exists
  const manifestPath = path.join(process.cwd(), 'manifest.json');
  if (fs.existsSync(manifestPath)) {
    console.log("Checking manifest.json structure...");
    try {
      const content = fs.readFileSync(manifestPath, 'utf-8');
      const json = JSON.parse(content) as unknown;
      const result = v.safeParse(ManifestSchema, json);
      
      if (result.success) {
        console.log("✅ manifest.json is valid.");
      } else {
        console.error("⚠️ manifest.json validation issues (non-fatal):");
        console.error(JSON.stringify(result.issues, null, 2));
      }
    } catch (e) {
      console.error("⚠️ manifest.json is invalid JSON:", e);
    }
  } else {
    console.log("ℹ️ No manifest.json found at root.");
  }

  // 2. Run Type Checking
  console.log("\nRunning TypeScript Type Check...");
  try {
    // --noEmit because we don't want to output files, just check types
    execSync('npx tsc --noEmit', { stdio: 'inherit' });
    console.log("✅ TypeScript check passed.");
  } catch (_error) {
    console.error("⚠️ TypeScript check found errors (non-fatal).");
    // We swallow the error to ensure exit code 0
  }

  // 3. Run Linting (assuming eslint is configured, otherwise skip)
  if (fs.existsSync(path.join(process.cwd(), '.eslintrc')) || 
      fs.existsSync(path.join(process.cwd(), '.eslintrc.json')) ||
      fs.existsSync(path.join(process.cwd(), 'eslint.config.js'))) {
    console.log("\nRunning Linter...");
    try {
      execSync('npx eslint .', { stdio: 'inherit' });
      console.log("✅ Lint check passed.");
    } catch (_error) {
      console.error("⚠️ Lint check found errors (non-fatal).");
    }
  } else {
    console.log("\nℹ️ No ESLint config found, skipping linting.");
  }

  console.log("\n--- VALIDATION COMPLETE ---");
  // Always exit 0 as requested
  process.exit(0);
}

main();