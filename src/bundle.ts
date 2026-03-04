// src/bundle.ts
// Single Responsibility: Aggregate all individual plugin data files into a single master JSON file with atomic writes and detailed logging.

import fs from 'node:fs';
import path from 'node:path';
import * as v from 'valibot';
import { PluginDataSchema } from './scorePlugin/index.js';
import type { PluginData } from './schemas.js';
import { writeJsonAtomic, readJsonSafe } from './fileUtils.js';

// Schema for the individual file wrapper
const FileWrapperSchema = v.object({
  plugin: PluginDataSchema,
  now: v.string()
});

function bundleDirectory(dataDir: string, outputFile: string, label: string): void {
  console.log(`\n📦 --- BUNDLING ${label.toUpperCase()} PLUGINS ---`);
  
  if (!fs.existsSync(dataDir)) {
    console.warn(`⚠️ [Bundler] Data directory not found at: ${dataDir}. Skipping.`);
    return;
  }

  const files = fs.readdirSync(dataDir).filter((f: string) => f.endsWith('.json'));
  console.log(`📂 [Bundler] Found ${files.length} ${label} plugin data files.`);

  const bundle: Record<string, PluginData> = {};
  let successCount = 0;
  let errorCount = 0;

  for (const file of files) {
    const pluginId = file.replace('.json', '');
    const filePath = path.join(dataDir, file);

    try {
      const json = readJsonSafe<unknown>(filePath);

      // Validate structure
      const result = v.safeParse(FileWrapperSchema, json);

      if (result.success) {
        bundle[pluginId] = result.output.plugin;
        successCount++;
      } else {
        console.warn(`⚠️ [Bundler] Validation failed for ${file}:`, JSON.stringify(result.issues, null, 2));
        errorCount++;
      }
    } catch (error) {
      console.error(`❌ [Bundler] Error processing ${file}:`, error);
      errorCount++;
    }
  }

  console.log(`✅ [Bundler] Bundling complete for ${label}.`);
  console.log(`   Included: ${successCount}`);
  console.log(`   Skipped:  ${errorCount}`);

  writeJsonAtomic(outputFile, bundle);
  console.log(`💾 [Bundler] Master bundle written to: ${outputFile}`);
}

function main(): void {
  console.log("=================================================");
  console.log("🚀 STARTING BUNDLER");
  console.log("=================================================");

  bundleDirectory(
    path.join(process.cwd(), 'data'),
    path.join(process.cwd(), 'all-plugins-data.json'),
    "Community"
  );
}

try {
  main();
} catch (err: unknown) {
  console.error("🛑 Fatal Bundler Error:", err);
  process.exit(1);
}
