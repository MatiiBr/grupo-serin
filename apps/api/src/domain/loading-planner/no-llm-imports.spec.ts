import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Fase 2 — zero-LLM-import guard. Structurally enforces the design's "the
 * solver keeps ZERO provider/LLM coupling" boundary ahead of Fase 3 (the
 * NestJS `planning-agent` module that will call DeepSeek via Huawei Cloud).
 * The pure domain under `domain/loading-planner/**` MUST NOT import any
 * LLM/provider SDK or generic HTTP client — it stays a plain, serializable
 * `generate(input)` function today, and gains an optional `constraints?`
 * argument later without ever making a network call itself.
 */

const FORBIDDEN_IMPORT_PATTERNS: RegExp[] = [
  /openai/i,
  /anthropic/i,
  /deepseek/i,
  /huawei/i,
  /@huaweicloud/i,
  /\baxios\b/i,
  /node-fetch/i,
  /\bundici\b/i,
  /\bgot\b/i,
  /\brequest\b/i,
  /^node:https?$/i,
  /^https?$/i,
];

const DOMAIN_ROOT = join(__dirname);

function collectSourceFiles(dir: string): string[] {
  const entries = readdirSync(dir);
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      files.push(...collectSourceFiles(fullPath));
      continue;
    }
    if (entry.endsWith('.ts') && !entry.endsWith('.spec.ts')) {
      files.push(fullPath);
    }
  }

  return files;
}

function importSpecifiers(source: string): string[] {
  const specifiers: string[] = [];
  const importRegex = /(?:import|export)\s[^;]*?from\s+['"]([^'"]+)['"]/g;
  const bareImportRegex = /import\s+['"]([^'"]+)['"]/g;
  const requireRegex = /require\(\s*['"]([^'"]+)['"]\s*\)/g;

  for (const regex of [importRegex, bareImportRegex, requireRegex]) {
    let match: RegExpExecArray | null;
    while ((match = regex.exec(source)) !== null) {
      specifiers.push(match[1]);
    }
  }

  return specifiers;
}

describe('domain/loading-planner — zero LLM/provider import guard (Fase 2)', () => {
  const sourceFiles = collectSourceFiles(DOMAIN_ROOT);

  it('finds the expected pure-domain source files (sanity check the scan itself is not vacuous)', () => {
    expect(sourceFiles.length).toBeGreaterThanOrEqual(4);
    expect(sourceFiles.some((file) => file.endsWith('heuristic-loading-planner.ts'))).toBe(true);
  });

  it.each(sourceFiles.map((file) => [file] as const))('%s imports no LLM/provider SDK or generic HTTP client', (file) => {
    const source = readFileSync(file, 'utf-8');
    const specifiers = importSpecifiers(source);

    const offenders = specifiers.filter((specifier) => FORBIDDEN_IMPORT_PATTERNS.some((pattern) => pattern.test(specifier)));

    expect(offenders).toEqual([]);
  });
});
