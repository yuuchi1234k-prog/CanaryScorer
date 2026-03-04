// src/discovery.ts
// Single Responsibility: Fetch and normalize metadata for both Community and Beta plugins with extensive logging.

import * as v from 'valibot';
import { NextDataRootSchema } from './schemas.js';
import { scrubRepositoryUrl } from './stringUtils.js';

export interface DiscoveredPlugin {
  id: string;
  name: string;
  description: string;
  author: string;
  repo: string;
  prNumber?: number;
  prStatus?: string | null;
  prLabels?: string[];
}

const USER_AGENT = 'CanaryScorer (Lae-Aragi; https://github.com/Lae-Aragi/CanaryScorer)';

/**
 * Scrapes the ObsidianStats beta page for plugin data.
 */
export async function fetchBetaPlugins(): Promise<DiscoveredPlugin[]> {
  console.log("🔍 [Discovery] Starting Beta Plugins fetch from obsidianstats.com...");
  try {
    const url = "https://www.obsidianstats.com/beta";
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT }
    });

    console.log(`🔍 [Discovery] HTTP Status: ${res.status} ${res.statusText}`);

    if (!res.ok) {
      console.error(`❌ [Discovery] Failed to fetch beta plugins. Status: ${res.status}`);
      return [];
    }

    const html = await res.text();
    console.log(`🔍 [Discovery] Received HTML content (${html.length} bytes). Parsing for __NEXT_DATA__...`);

    const regex = /<script id="__NEXT_DATA__" type="application\/json">([^<]+)<\/script>/;
    const match = regex.exec(html);
    
    if (!match || typeof match[1] !== 'string') {
      console.warn("⚠️ [Discovery] No __NEXT_DATA__ script tag found in HTML. The site structure may have changed.");
      return [];
    }
    
    console.log("🔍 [Discovery] __NEXT_DATA__ found. Parsing JSON...");
    const json = JSON.parse(match[1]) as unknown;
    
    console.log("🔍 [Discovery] Validating JSON schema...");
    const parseResult = v.safeParse(NextDataRootSchema, json);
    
    if (!parseResult.success) {
      console.error("❌ [Discovery] Beta JSON schema validation failed:", JSON.stringify(parseResult.issues, null, 2));
      return [];
    }
    
    const { entries } = parseResult.output.props.pageProps;
    console.log(`🔍 [Discovery] Found ${entries.length} raw entries. Filtering for valid plugins...`);

    const plugins: DiscoveredPlugin[] = [];
    
    for (const entry of entries) {
      if (entry.type !== "plugin") { 
        continue; 
      }
      
      const { repo, name: pluginName } = entry;

      if (typeof repo !== 'string' || repo.length === 0) {
        console.warn(`⚠️ [Discovery] Skipping entry ${entry.id}: Missing repo URL.`);
        continue; 
      }
      if (typeof pluginName !== 'string' || pluginName.length === 0) { 
        console.warn(`⚠️ [Discovery] Skipping entry ${entry.id}: Missing plugin name.`);
        continue; 
      }
      
      const scrubbedRepo = scrubRepositoryUrl(repo);
      if (scrubbedRepo.length === 0) { 
        console.warn(`⚠️ [Discovery] Skipping entry ${entry.id}: Repo URL '${repo}' scrubbed to empty string.`);
        continue; 
      }
      
      const rawLabelsStr = entry.prLabels ?? "";
      const rawLabels = rawLabelsStr.split(",");
      const labels = rawLabels
        .map((l: string): string => l.trim())
        .filter((l: string): boolean => l.toLowerCase() !== "plugin" && l.length > 0);
          
      plugins.push({
        id: entry.id,
        name: pluginName,
        description: entry.description ?? "No description available.",
        author: entry.author ?? "Unknown",
        repo: scrubbedRepo,
        prNumber: entry.prNumber,
        prStatus: entry.status ?? entry.prStatus,
        prLabels: labels,
      });
    }

    console.log(`✅ [Discovery] Successfully discovered ${plugins.length} Beta plugins.`);
    return plugins;
  } catch (e: unknown) {
    console.error("❌ [Discovery] Critical error fetching beta plugins:", e);
    return [];
  }
}

/**
 * Fetches the official community plugins list.
 */
export async function fetchCommunityPlugins(): Promise<DiscoveredPlugin[]> {
  console.log("🔍 [Discovery] Starting Community Plugins fetch from GitHub...");
  try {
    const url = "https://raw.githubusercontent.com/obsidianmd/obsidian-releases/master/community-plugins.json";
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT }
    });
    
    console.log(`🔍 [Discovery] HTTP Status: ${res.status} ${res.statusText}`);

    if (!res.ok) {
      console.error(`❌ [Discovery] Failed to fetch community plugins. Status: ${res.statusText}`);
      return [];
    }
    
    const data = await res.json() as DiscoveredPlugin[];
    console.log(`✅ [Discovery] Successfully discovered ${data.length} Community plugins.`);
    return data;
  } catch (e: unknown) {
    console.error("❌ [Discovery] Critical error fetching community plugins:", e);
    return [];
  }
}
