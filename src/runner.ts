// src/runner.ts
// Single Responsibility: Orchestrate the fetching of plugins sequentially per category, respecting global deadlines and checkpointing state.

import fs from 'node:fs';
import path from 'node:path';
import { fetchPluginData } from './fetch/fetch-index.js';
import { fetchCommunityPlugins, type DiscoveredPlugin } from './discovery.js';
import { writeJsonAtomic, readJsonSafe } from './fileUtils.js';

const MAX_DURATION_MS = 5.5 * 60 * 60 * 1000; // 5.5 hours

interface ProgressState {
  isFinished: boolean;
}

async function processCategory(
  plugins: DiscoveredPlugin[],
  dataDir: string,
  pat: string,
  label: string,
  deadline: number,
  progressState: ProgressState
): Promise<void> {
  console.log(`\n📂 [${label}] Processing Category...`);
  
  if (plugins.length === 0) {
    console.log(`📦 [${label}] No plugins found. Skipping.`);
    return;
  }

  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    console.log(`📁 [${label}] Created data directory: ${dataDir}`);
  }

  const total: number = plugins.length;
  console.log(`📦 [${label}] Found ${total} plugins to process.`);
  console.log("-----------------------------------------------");

  let completed: number = 0;
  let skipped: number = 0;
  let successCount: number = 0;
  let failCount: number = 0;

  for (const plugin of plugins) {
    // 1. Check Global Deadline
    if (Date.now() > deadline) {
      console.log(`⏳ [${label}] Global deadline exceeded at ${new Date().toISOString()}. Stopping process.`);
      progressState.isFinished = false;
      break;
    }

    const filePath: string = path.join(dataDir, `${plugin.id}.json`);
    let shouldFetch = true;

    // 2. Checkpoint Logic
    if (fs.existsSync(filePath)) {
      try {
        const parsed = readJsonSafe<{ now: string }>(filePath);
        const fetchedAt = new Date(parsed.now).getTime();
        const ageHours = (Date.now() - fetchedAt) / (1000 * 60 * 60);
        
        if (ageHours < 6) {
          console.log(`⏭️  [${label}] [${String(completed + 1).padStart(4, ' ')}/${total}] ${plugin.id.padEnd(30)} SKIPPED (Fresh: ${ageHours.toFixed(1)}h old)`);
          skipped++;
          completed++;
          shouldFetch = false;
        } else {
          console.log(`🔄 [${label}] [${String(completed + 1).padStart(4, ' ')}/${total}] ${plugin.id.padEnd(30)} STALE (Age: ${ageHours.toFixed(1)}h) -> Re-fetching`);
        }
      } catch (e) {
        console.warn(`⚠️ [${label}] [${plugin.id}] Existing file corrupted or invalid. Re-fetching. Error:`, e);
      }
    } else {
      console.log(`🆕 [${label}] [${String(completed + 1).padStart(4, ' ')}/${total}] ${plugin.id.padEnd(30)} NEW -> Fetching`);
    }

    if (!shouldFetch) {
      continue;
    }

    const pluginStart: number = Date.now();
    try {
      // eslint-disable-next-line no-await-in-loop
      const result = await fetchPluginData({ pat, repo: plugin.repo }, deadline);

      if (result.isOk()) {
        // Atomic Write to prevent data corruption
        writeJsonAtomic(filePath, result.value);
        
        successCount++;
        const duration: number = Date.now() - pluginStart;
        console.log(`✅ [${label}] [${String(completed + 1).padStart(4, ' ')}/${total}] ${plugin.id.padEnd(30)} SUCCESS (${duration}ms)`);
      } else {
        const errData = result.error;
        if (errData.kind === "DeadlineExceededError") {
          console.log(`⏳ [${label}] Rate limit wait exceeds deadline for ${plugin.id}. Stopping.`);
          progressState.isFinished = false;
          break;
        }
        failCount++;
        console.error(`❌ [${label}] [${String(completed + 1).padStart(4, ' ')}/${total}] ${plugin.id.padEnd(30)} FAILED: [${errData.kind}] ${errData.message}`);
        if ('issues' in errData) {
          console.error(`   Validation Issues:`, JSON.stringify(errData.issues));
        }
      }
    } catch (err: unknown) {
      failCount++;
      const msg: string = err instanceof Error ? err.message : String(err);
      console.error(`💥 [${label}] [${String(completed + 1).padStart(4, ' ')}/${total}] ${plugin.id.padEnd(30)} CRITICAL EXCEPTION: ${msg}`);
    } finally {
      completed++;
    }
  }

  console.log("-----------------------------------------------");
  console.log(`🏁 [${label}] FETCH STOPPED/COMPLETE`);
  console.log(`⏭️  Skipped (Fresh): ${skipped}`);
  console.log(`✅ Successful:      ${successCount}`);
  console.log(`❌ Failed:          ${failCount}`);
  console.log(`📊 Total Processed: ${successCount + failCount}`);
  console.log("-----------------------------------------------");
}

async function main(): Promise<void> {
  const startTime: number = Date.now();
  const deadline: number = startTime + MAX_DURATION_MS;
  
  console.log("=================================================");
  console.log("🚀 STARTING PLUGIN DATA FETCH (CHECKPOINT & RESUME)");
  console.log(`🕒 Started at: ${new Date(startTime).toISOString()}`);
  console.log(`🛑 Deadline:   ${new Date(deadline).toISOString()}`);
  console.log("=================================================");

  const pat: string | undefined = process.env["PAT_1"];
  if (!pat) {
    throw new Error("❌ No PAT provided. Please set GITHUB_TOKEN or PAT_1.");
  }

  console.log("📥 Fetching plugin metadata lists...");
  const communityPlugins = await fetchCommunityPlugins();

  const progressState: ProgressState = { isFinished: true };

  // Process categories sequentially to respect rate limits and logic clarity
  await Promise.all([
    processCategory(communityPlugins, path.join(process.cwd(), 'data'), pat, "Community", deadline, progressState)
  ]);

  // Save state for the workflow to read
  const progressFile = path.join(process.cwd(), "progress.json");
  console.log(`💾 Saving progress state to ${progressFile}...`);
  writeJsonAtomic(progressFile, progressState);

  const totalDurationMinutes: string = ((Date.now() - startTime) / 1000 / 60).toFixed(2);
  console.log("=================================================");
  console.log(`⏱️  Total Duration: ${totalDurationMinutes} minutes`);
  console.log(`🏁 Finished entirely: ${progressState.isFinished}`);
  console.log("=================================================");
}

main().catch((err: unknown) => {
  const msg: string = err instanceof Error ? err.message : String(err);
  console.error("\n🛑 FATAL RUNNER ERROR:", msg);
  process.exit(1);
});
