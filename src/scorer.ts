// src/scorer.ts
// Single Responsibility: Aggregate fetched data, calculate ecosystem percentiles, and generate final scores with verbose logging.

import fs from 'node:fs';
import path from 'node:path';
import PQueue from 'p-queue';
import { ok, err, type Result } from 'neverthrow';
import * as v from 'valibot';
import { differenceInMilliseconds, parseISO } from 'date-fns';

import type { 
  PluginData, 
  EcosystemPercentiles, 
  ScoringContext 
} from './scorePlugin/index.js';
import { 
  scorePlugin, 
  PluginDataSchema 
} from './scorePlugin/index.js';

import type { 
  ScoreOutputItem, 
  ScoreReport 
} from './schemas.js';
import { ScoreReportSchema } from './schemas.js';
import { fetchCommunityPlugins, type DiscoveredPlugin } from './discovery.js';
import { writeJsonAtomic, readJsonSafe } from './fileUtils.js';

// ─── Types ───────────────────────────────────────────────────────────────────

interface LoadedPlugin {
  id: string;
  metadata: DiscoveredPlugin;
  data: PluginData;
  fetchedAt: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MS_PER_DAY = 1000 * 60 * 60 * 24;

function getAgeInDays(createdAt: string, now: string): number {
  const diffMs = differenceInMilliseconds(parseISO(now), parseISO(createdAt));
  return Math.max(1, diffMs / MS_PER_DAY);
}

function loadPluginData(filePath: string): Result<{ plugin: PluginData; now: string }, string> {
  try {
    const json = readJsonSafe<unknown>(filePath);
    
    const Schema = v.object({
      plugin: PluginDataSchema,
      now: v.string()
    });

    const result = v.safeParse(Schema, json);
    if (result.success) {
      return ok(result.output);
    }
    return err(`Validation failed for ${path.basename(filePath)}`);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return err(`File error: ${msg}`);
  }
}

// ─── Main Logic ──────────────────────────────────────────────────────────────

async function scoreDirectory(
  dataDir: string,
  outputFile: string,
  metadataList: DiscoveredPlugin[],
  label: string
): Promise<void> {
  console.log(`\n📊 --- SCORING ${label.toUpperCase()} PLUGINS ---`);
  
  if (!fs.existsSync(dataDir)) {
    console.warn(`⚠️ [Scorer] Data directory not found: ${dataDir}. Skipping.`);
    return;
  }

  const metadataMap = new Map<string, DiscoveredPlugin>();
  for (const p of metadataList) {
    metadataMap.set(p.id, p);
  }

  const files = fs.readdirSync(dataDir).filter((f: string) => f.endsWith('.json'));
  const loadedPlugins: LoadedPlugin[] = [];

  console.log(`📂 [Scorer] Reading ${files.length} data files from ${dataDir}...`);

  for (const file of files) {
    const id = file.replace('.json', '');
    
    const metadata = metadataMap.get(id) ?? {
      id,
      name: id,
      description: "Metadata unavailable",
      author: "Unknown",
      repo: ""
    };

    const loadResult = loadPluginData(path.join(dataDir, file));
    if (loadResult.isOk()) {
      loadedPlugins.push({
        id,
        metadata,
        data: loadResult.value.plugin,
        fetchedAt: loadResult.value.now
      });
    } else {
      console.warn(`⚠️ [Scorer] Skipping ${file}: ${loadResult.error}`);
    }
  }

  console.log(`✅ [Scorer] Successfully loaded ${loadedPlugins.length} ${label} plugins for scoring.`);

  if (loadedPlugins.length === 0) {
    console.warn(`⚠️ [Scorer] No valid plugins loaded for ${label}. Skipping.`);
    return;
  }

  console.log(`📈 [Scorer] Calculating ecosystem percentiles...`);
  const allDownloadsPerDay: number[] = [];
  const allStarRatios: number[] = [];

  for (const p of loadedPlugins) {
    const age = getAgeInDays(p.data.createdAt, p.fetchedAt);
    allDownloadsPerDay.push(p.data.totalDownloads / age);
    allStarRatios.push(p.data.stargazers / (p.data.totalDownloads + 1));
  }

  const ecosystem: EcosystemPercentiles = { allDownloadsPerDay, allStarRatios };
  const queue = new PQueue({ concurrency: 100 });
  const results: ScoreOutputItem[] = [];

  console.log(`🚀 [Scorer] Processing scores in parallel...`);

  const tasks = loadedPlugins.map((p: LoadedPlugin) => (): void => {
    const context: ScoringContext = {
      plugin: p.data,
      ecosystem,
      now: p.fetchedAt
    };

    const scoreResult = scorePlugin(context);

    if (scoreResult.isOk()) {
      const s = scoreResult.value;
      results.push({
        id: p.id,
        name: p.metadata.name,
        description: p.metadata.description,
        author: p.metadata.author,
        repo: p.metadata.repo,
        score: s.total,
        label: s.label,
        downloads: p.data.totalDownloads,
        stars: p.data.stargazers,
        lastUpdate: p.data.latestReleaseAt > p.data.lastCommitDate 
          ? p.data.latestReleaseAt 
          : p.data.lastCommitDate,
        scoreBreakdown: {
          adoption: s.dimensions.adoption.score,
          maintenance: s.dimensions.maintenance.score,
          stability: s.dimensions.stability.score,
          maturity: s.dimensions.maturity.score,
          communityHealth: s.dimensions.communityHealth.score
        }
      });
    } else {
        console.error(`❌ [Scorer] Failed to score ${p.id}:`, scoreResult.error);
    }
  });

  await queue.addAll(tasks);

  const report: ScoreReport = {
    generatedAt: new Date().toISOString(),
    plugins: results.sort((a: ScoreOutputItem, b: ScoreOutputItem) => b.score - a.score)
  };

  console.log(`🔍 [Scorer] Validating final report schema...`);
  const outputValidation = v.safeParse(ScoreReportSchema, report);
  if (!outputValidation.success) {
    console.error(`❌ [Scorer] Output schema validation failed for ${label}:`, outputValidation.issues);
    throw new Error(`Output schema validation failed for ${label}.`);
  }

  writeJsonAtomic(outputFile, report);
  console.log(`✅ [Scorer] ${label} scoring complete. Scored ${results.length} plugins. Written to ${outputFile}`);
}

async function main(): Promise<void> {
  console.log("=================================================");
  console.log("🚀 STARTING SCORER");
  console.log("=================================================");

  const communityList = await fetchCommunityPlugins();
  await scoreDirectory(
    path.join(process.cwd(), 'data'),
    path.join(process.cwd(), 'plugin-scores.json'),
    communityList,
    "Community"
  );
}

main().catch((error: unknown) => {
  const msg = error instanceof Error ? error.message : String(error);
  console.error("🛑 Fatal Scorer Error:", msg);
  process.exit(1);
});
