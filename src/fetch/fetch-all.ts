// src/fetch/fetch-all.ts
// Single Responsibility: Orchestrate all fetches and assemble the complete scoring data with verbose logging.

import { ok, err, type Result } from "neverthrow";
import * as v from "valibot";
import type { PluginData } from "../schemas.js";
import type { FetchError, RepoId } from "./fetch-schemas.js";
import { FetchInputSchema } from "./fetch-schemas.js";
import { createGitHubClient } from "./github-client.js";
import { fetchRepoCoreAndFirstPages } from "./fetch-repo-core.js";
import { fetchRemainingReleases, computeDownloads, type ReleaseData } from "./fetch-releases.js";
import { fetchRemainingIssues, classifyIssues } from "./fetch-issues.js";
import { fetchRemainingPullRequests, classifyPRs } from "./fetch-pull-requests.js";
import { assemblePluginData } from "./assemble.js";

function parseRepo(repo: string): RepoId {
  const [owner, repoName] = repo.split("/");
  return { owner: owner ?? "", name: repoName ?? "" };
}

export async function fetchPluginData(
  input: { readonly pat: string; readonly repo: string; },
  deadline?: number
): Promise<Result<{ plugin: PluginData; now: string }, FetchError>> {
  // 1. Validate Input
  const inputParsed = v.safeParse(FetchInputSchema, input);
  if (!inputParsed.success) {
    console.error(`❌ [Fetch] Input validation failed for ${input.repo}`);
    return err({
      kind: "FetchValidationError",
      message: "Invalid input",
      issues: inputParsed.issues.map((i: v.BaseIssue<unknown>) => ({
        path: i.path?.map((p: v.IssuePathItem) => String(p.key)).join(".") ?? "<root>",
        message: i.message,
      })),
    });
  }

  const { pat, repo: repoStr } = inputParsed.output;
  const repoId = parseRepo(repoStr);
  const now = new Date().toISOString();

  console.log(`📡 [Fetch] Initializing fetch for ${repoStr} (Owner: ${repoId.owner}, Name: ${repoId.name})`);

  const client = createGitHubClient(pat);

  // 2. Fetch Core Data
  let currentRepoId = repoId;
  console.log(`📡 [Fetch] Requesting Core Data & First Pages for ${currentRepoId.owner}/${currentRepoId.name}...`);
  let coreResult = await fetchRepoCoreAndFirstPages(client, currentRepoId, now, deadline);

  // 3. Handle Redirects / Not Found
  if (coreResult.isErr()) {
    const msg = coreResult.error.message.toLowerCase();
    const isNotFound = msg.includes("could not resolve") || 
                       msg.includes("not found") || 
                       msg.includes("not_found") || 
                       ("status" in coreResult.error && coreResult.error.status === 404);

    if (isNotFound) {
      console.warn(`⚠️ [Fetch] Repo ${currentRepoId.owner}/${currentRepoId.name} not found. Attempting to resolve redirect...`);
      try {
        const restRes = await client.request("GET /repos/{owner}/{repo}", {
          owner: currentRepoId.owner,
          repo: currentRepoId.name,
        });
        const resolvedFullName = restRes.data.full_name as string | undefined;
        
        if (resolvedFullName && resolvedFullName.toLowerCase() !== repoStr.toLowerCase()) {
          console.log(`🔄 [Fetch] Redirect detected: ${repoStr} -> ${resolvedFullName}. Retrying fetch with new coordinates.`);
          currentRepoId = parseRepo(resolvedFullName);
          coreResult = await fetchRepoCoreAndFirstPages(client, currentRepoId, now, deadline);
        } else {
          console.warn(`⚠️ [Fetch] No redirect found or same name returned. Cannot recover.`);
        }
      } catch (restErr) {
        console.error(`❌ [Fetch] Fallback resolution failed: ${restErr instanceof Error ? restErr.message : String(restErr)}`);
      }
    }

    if (coreResult.isErr()) {
      console.error(`❌ [Fetch] Core fetch failed for ${repoStr}: [${coreResult.error.kind}] ${coreResult.error.message}`);
      return err(coreResult.error);
    }
  }

  const coreData = coreResult.value;
  console.log(`✅ [Fetch] Core data received. Stars: ${coreData.stargazerCount}, Created: ${coreData.createdAt}`);

  // 4. Pagination
  const paginationPromises = [];
  const paginationKeys: string[] = [];

  if (coreData.releasesPageInfo.hasNextPage && coreData.releasesPageInfo.endCursor) {
    console.log(`📄 [Fetch] Pagination required for Releases. Starting cursor: ${coreData.releasesPageInfo.endCursor}`);
    paginationKeys.push("releases");
    paginationPromises.push(
      fetchRemainingReleases(client, currentRepoId, coreData.releasesPageInfo.endCursor, deadline)
    );
  }

  if (coreData.openIssuesPageInfo.hasNextPage && coreData.openIssuesPageInfo.endCursor) {
    console.log(`📄 [Fetch] Pagination required for Open Issues. Starting cursor: ${coreData.openIssuesPageInfo.endCursor}`);
    paginationKeys.push("openIssues");
    paginationPromises.push(
      fetchRemainingIssues(client, currentRepoId, "OPEN", coreData.openIssuesPageInfo.endCursor, deadline)
    );
  }

  if (coreData.closedIssuesPageInfo.hasNextPage && coreData.closedIssuesPageInfo.endCursor) {
    console.log(`📄 [Fetch] Pagination required for Closed Issues. Starting cursor: ${coreData.closedIssuesPageInfo.endCursor}`);
    paginationKeys.push("closedIssues");
    paginationPromises.push(
      fetchRemainingIssues(client, currentRepoId, "CLOSED", coreData.closedIssuesPageInfo.endCursor, deadline)
    );
  }

  if (coreData.openPRsPageInfo.hasNextPage && coreData.openPRsPageInfo.endCursor) {
    console.log(`📄 [Fetch] Pagination required for Open PRs. Starting cursor: ${coreData.openPRsPageInfo.endCursor}`);
    paginationKeys.push("openPRs");
    paginationPromises.push(
      fetchRemainingPullRequests(client, currentRepoId, "OPEN", coreData.openPRsPageInfo.endCursor, deadline)
    );
  }

  if (coreData.closedPRsPageInfo.hasNextPage && coreData.closedPRsPageInfo.endCursor) {
    console.log(`📄 [Fetch] Pagination required for Closed PRs. Starting cursor: ${coreData.closedPRsPageInfo.endCursor}`);
    paginationKeys.push("closedPRs");
    paginationPromises.push(
      fetchRemainingPullRequests(client, currentRepoId, "CLOSED", coreData.closedPRsPageInfo.endCursor, deadline)
    );
  }

  if (coreData.mergedPRsPageInfo.hasNextPage && coreData.mergedPRsPageInfo.endCursor) {
    console.log(`📄 [Fetch] Pagination required for Merged PRs. Starting cursor: ${coreData.mergedPRsPageInfo.endCursor}`);
    paginationKeys.push("mergedPRs");
    paginationPromises.push(
      fetchRemainingPullRequests(client, currentRepoId, "MERGED", coreData.mergedPRsPageInfo.endCursor, deadline)
    );
  }

  if (paginationPromises.length > 0) {
    console.log(`⏳ [Fetch] Waiting for ${paginationPromises.length} pagination tasks...`);
  }

  const paginationResults = await Promise.all(paginationPromises);

  for (const result of paginationResults) {
    if (result.isErr()) {
      console.error(`❌ [Fetch] Pagination failed: [${result.error.kind}] ${result.error.message}`);
      return err(result.error);
    }
  }

  const paginatedData: Record<string, readonly unknown[] | undefined> = {};
  for (let i = 0; i < paginationKeys.length; i++) {
    const key = paginationKeys[i];
    const res = paginationResults[i];
    if (key && res) {
      paginatedData[key] = res._unsafeUnwrap() as readonly unknown[];
      console.log(`✅ [Fetch] Pagination complete for ${key}. Fetched ${(paginatedData[key] ?? []).length} additional items.`);
    }
  }

  // 5. Assembly
  console.log(`🧩 [Fetch] Assembling final data structure...`);

  const allReleaseNodes = [
    ...coreData.releasesFirstPage,
    ...((paginatedData["releases"] as typeof coreData.releasesFirstPage | undefined) ?? []),
  ];

  const allOpenIssueNodes = [
    ...coreData.openIssuesFirstPage,
    ...((paginatedData["openIssues"] as typeof coreData.openIssuesFirstPage | undefined) ?? []),
  ];

  const allClosedIssueNodes = [
    ...coreData.closedIssuesFirstPage,
    ...((paginatedData["closedIssues"] as typeof coreData.closedIssuesFirstPage | undefined) ?? []),
  ];

  const allOpenPRNodes = [
    ...coreData.openPRsFirstPage,
    ...((paginatedData["openPRs"] as typeof coreData.openPRsFirstPage | undefined) ?? []),
  ];

  const allClosedPRNodes = [
    ...coreData.closedPRsFirstPage,
    ...((paginatedData["closedPRs"] as typeof coreData.closedPRsFirstPage | undefined) ?? []),
  ];

  const allMergedPRNodes = [
    ...coreData.mergedPRsFirstPage,
    ...((paginatedData["mergedPRs"] as typeof coreData.mergedPRsFirstPage | undefined) ?? []),
  ];

  const releases = computeDownloads(allReleaseNodes);
  const totalDownloads = releases.reduce((sum: number, r: ReleaseData) => sum + r.downloads, 0);

  const issues = classifyIssues(allOpenIssueNodes, allClosedIssueNodes);
  const prs = classifyPRs(allOpenPRNodes, allClosedPRNodes, allMergedPRNodes);

  const pluginData = assemblePluginData(
    coreData,
    releases,
    issues,
    prs,
    totalDownloads
  );

  console.log(`🎉 [Fetch] Complete for ${repoStr}. Total Downloads: ${totalDownloads}, Total Releases: ${pluginData.totalReleases}`);
  return ok({ plugin: pluginData, now });
}
