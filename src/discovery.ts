// src/discovery.ts
// Single Responsibility: Fetch and normalize metadata for Community plugins with extensive logging.

export interface DiscoveredPlugin {
  id: string;
  name: string;
  description: string;
  author: string;
  repo: string;
}

const USER_AGENT = 'CanaryScorer (Lae-Aragi; https://github.com/Lae-Aragi/CanaryScorer)';

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
