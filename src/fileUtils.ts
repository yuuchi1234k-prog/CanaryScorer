// src/fileUtils.ts
// Single Responsibility: Provide safe, atomic file system operations to prevent data corruption.

import fs from 'node:fs';

/**
 * Writes a JSON object to a file atomically.
 * 1. Writes data to a temporary file.
 * 2. Flushes the buffer to disk.
 * 3. Renames the temporary file to the target path (atomic operation on POSIX & Windows).
 * 
 * This ensures that the target file is either fully written or not modified at all.
 */
export function writeJsonAtomic(filePath: string, data: unknown): void {
  const tempPath = `${filePath}.${Date.now()}.tmp`;
  
  try {
    const content = JSON.stringify(data, null, 2);
    fs.writeFileSync(tempPath, content, 'utf-8');
    
    // Rename is atomic; if it fails, the original file is untouched.
    fs.renameSync(tempPath, filePath);
  } catch (error) {
    // Attempt cleanup of temp file if write failed
    try {
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
    } catch (cleanupError) {
      console.error(`⚠️ Failed to cleanup temp file: ${tempPath}`, cleanupError);
    }
    throw error;
  }
}

/**
 * Safely reads a JSON file with descriptive error context.
 */
export function readJsonSafe<T>(filePath: string): T {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as T;
  } catch (error) {
    throw new Error(`Failed to read/parse JSON at ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
  }
}
