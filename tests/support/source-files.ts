/**
 * @file Lists source files under a folder for the tests that read source text (the holdout
 *   isolation test and the known-findings guard), skipping dependencies and build output.
 * @module @caa/tests/support/source-files
 * @see docs/standards/07-testing.md
 */
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

/** Folders never walked: dependencies and build output. */
const SKIPPED_FOLDERS: readonly string[] = ['node_modules', 'dist', '.next', 'coverage'];

/**
 * Lists the files under a folder, recursively, whose names pass the filter.
 *
 * @param folder - Absolute folder path.
 * @param isWanted - Decides from a file name whether the file is listed.
 * @returns Absolute file paths, in directory order.
 */
export function sourceFiles(folder: string, isWanted: (fileName: string) => boolean): string[] {
  return readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const path = join(folder, entry.name);
    if (entry.isDirectory()) {
      return SKIPPED_FOLDERS.includes(entry.name) ? [] : sourceFiles(path, isWanted);
    }
    return isWanted(entry.name) ? [path] : [];
  });
}
