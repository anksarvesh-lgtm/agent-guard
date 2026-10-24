#!/usr/bin/env node

/**
 * Automatically bumps the patch version (+0.0.1) across all project files:
 * - package.json
 * - package-lock.json
 * - src/index.ts
 * - templates/plugin/agent-guard/plugin.json
 * - VERSIONS.md
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

function bumpSemver(version) {
  const parts = version.split('.');
  if (parts.length !== 3) {
    throw new Error(`Invalid semver: ${version}`);
  }
  const major = parseInt(parts[0], 10);
  const minor = parseInt(parts[1], 10);
  const patch = parseInt(parts[2], 10) + 1;
  return `${major}.${minor}.${patch}`;
}

function updateFile(filePath, regex, replacement) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf-8');
  const updated = content.replace(regex, replacement);
  fs.writeFileSync(filePath, updated, 'utf-8');
}

function main() {
  const pkgPath = path.join(REPO_ROOT, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  const oldVersion = pkg.version;
  const newVersion = bumpSemver(oldVersion);

  console.log(`🛡️  Bumping Agent Guard version: ${oldVersion} -> ${newVersion}`);

  // 1. package.json
  pkg.version = newVersion;
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');

  // 2. package-lock.json
  const lockPath = path.join(REPO_ROOT, 'package-lock.json');
  if (fs.existsSync(lockPath)) {
    try {
      const lock = JSON.parse(fs.readFileSync(lockPath, 'utf-8'));
      lock.version = newVersion;
      if (lock.packages && lock.packages['']) {
        lock.packages[''].version = newVersion;
      }
      fs.writeFileSync(lockPath, JSON.stringify(lock, null, 2) + '\n', 'utf-8');
    } catch {}
  }

  // 3. src/index.ts
  const srcIndexPath = path.join(REPO_ROOT, 'src', 'index.ts');
  updateFile(srcIndexPath, /version:\s*['"][0-9.]+['"]/, `version: '${newVersion}'`);

  // 4. templates/plugin/agent-guard/plugin.json
  const pluginJsonPath = path.join(REPO_ROOT, 'templates', 'plugin', 'agent-guard', 'plugin.json');
  updateFile(pluginJsonPath, /"version":\s*"[0-9.]+"/, `"version": "${newVersion}"`);

  // 5. VERSIONS.md
  const versionsMdPath = path.join(REPO_ROOT, 'VERSIONS.md');
  updateFile(versionsMdPath, /- \*\*Agent Guard\*\*:\s*`[0-9.]+`/, `- **Agent Guard**: \`${newVersion}\``);

  console.log(`✅ Successfully updated version to ${newVersion} across all files.`);
}

main();
