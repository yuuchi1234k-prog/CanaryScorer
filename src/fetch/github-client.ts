// src/fetch/github-client.ts
// Single Responsibility: Create and configure an authenticated Octokit instance.

import { Octokit } from "octokit";
import invariant from "tiny-invariant";

/**
 * Creates an authenticated Octokit client.
 * Rate limit handling is done at the request level in paginate.ts,
 * not via the throttle plugin, for more precise control.
 *
 * @param pat - GitHub Personal Access Token. Must be non-empty.
 * @returns Configured Octokit instance.
 */
export function createGitHubClient(pat: string): Octokit {
  invariant(pat.length > 0, "GitHub PAT must not be empty");

  return new Octokit({
    auth: pat,
    userAgent: 'CanaryScorer (yuuchi1234k-prog; https://github.com/yuuchi1234k-prog/CanaryScorer)',
  });
}
