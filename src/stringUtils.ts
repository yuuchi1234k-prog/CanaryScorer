// src/stringUtils.ts
// Single Responsibility: Utility functions for string manipulation and normalization.

/**
 * Scrubs a repository string to extract the "User/Repo" identifier.
 * 
 * @param url The raw input string
 * @returns The sanitized "User/Repo" identifier
 */
export const scrubRepositoryUrl = (url: string): string => {
  if (url.length === 0) { return ""; }
  let clean = url.trim();

  // 1. Handle "gh:" or "github:" shorthand
  if (/^(?:gh|github):/i.test(clean)) {
    clean = clean.replace(/^(?:gh|github):/i, "");
  }

  // 2. Handle standard URL protocols and git/ssh protocols
  clean = clean.replace(/^(?:https?|git|ssh|git\+ssh|ftp|ftps):\/\//i, "");

  // 3. Handle user@ syntax (common in SSH/SCP style)
  clean = clean.replace(/^[\w.-]+@/i, "");

  // 4. Handle GitHub domain (with optional www)
  clean = clean.replace(/^(?:www\.)?github\.com[:/]/i, "");

  // 5. Remove .git extension
  clean = clean.replace(/\.git(?:\/?$|(?=\/))/i, "");

  // 6. Clean up any leading slashes
  clean = clean.replace(/^\/+/, "");

  // 7. Extract User/Repo
  const parts = clean.split("/").filter((p: string): boolean => p.trim().length > 0);

  if (parts.length >= 2) {
    return `${parts[0] ?? ""}/${parts[1] ?? ""}`;
  }

  return clean;
};
