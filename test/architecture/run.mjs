import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const DEFAULT_DIR = path.dirname(fileURLToPath(import.meta.url));

/**
 * Discover *.test.mjs under dir and run them with node --test.
 * Exits 1 when the directory is missing or contains zero test files
 * (Node 20 --test exits 0 on missing/unexpanded globs).
 *
 * @param {string} [dir] Absolute or relative architecture test directory
 * @returns {Promise<number>} process exit code
 */
export function runArchitectureTests(dir = DEFAULT_DIR) {
  const absDir = path.resolve(dir);

  return new Promise((resolve) => {
    let entries;
    try {
      entries = fs.readdirSync(absDir);
    } catch (err) {
      const code = /** @type {NodeJS.ErrnoException} */ (err).code;
      if (code === 'ENOENT') {
        console.error(`[architecture] test directory not found: ${absDir}`);
        resolve(1);
        return;
      }
      console.error(`[architecture] failed to read ${absDir}:`, err);
      resolve(1);
      return;
    }

    const files = entries
      .filter((name) => name.endsWith('.test.mjs'))
      .sort()
      .map((name) => path.join(absDir, name));

    if (files.length === 0) {
      console.error(
        `[architecture] no *.test.mjs files in ${absDir} (refusing silent green)`,
      );
      resolve(1);
      return;
    }

    const child = spawn(process.execPath, ['--test', ...files], {
      stdio: 'inherit',
    });

    child.on('error', (err) => {
      console.error('[architecture] failed to spawn node --test:', err);
      resolve(1);
    });

    child.on('exit', (code, signal) => {
      if (signal) {
        console.error(`[architecture] node --test terminated by signal ${signal}`);
        resolve(1);
        return;
      }
      resolve(code === null ? 1 : code);
    });
  });
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const target = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_DIR;
  const code = await runArchitectureTests(target);
  process.exit(code);
}
