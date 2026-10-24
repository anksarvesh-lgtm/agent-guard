#!/usr/bin/env node

/**
 * Automates the complete push & release flow with a .1 patch bump:
 * 1. Bumps patch version (+0.0.1) across all files
 * 2. Compiles TypeScript build (npm run build)
 * 3. Runs complete test suite (npm test)
 * 4. Reinstalls extension into Antigravity IDE
 * 5. Commits version bump, tags vX.Y.Z and latest
 * 6. Pushes commits and tags to GitHub origin main
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

function run(cmd, desc) {
  console.log(`\n⏳ ${desc}...`);
  try {
    execSync(cmd, { cwd: REPO_ROOT, stdio: 'inherit' });
  } catch (err) {
    console.error(`\n❌ Failed at step: ${desc}`);
    process.exit(1);
  }
}

function main() {
  // 1. Run bump
  run('node scripts/bump.js', 'Bumping patch version (+0.0.1)');

  const pkg = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf-8'));
  const version = pkg.version;
  const tag = `v${version}`;

  // 2. Build
  run('npm run build', 'Compiling TypeScript build');

  // 3. Test
  run('npm test', 'Running Vitest test suite');

  // 4. Update extension in IDE
  run('node dist/cli.js extension install', 'Updating extension in Antigravity IDE');

  // 5. Git commit & tags
  run(`git add . && git commit -m "release: v${version} (+0.0.1 patch release)"`, `Committing release ${version}`);
  run(`git tag -fa ${tag} -m "Release ${tag}" && git tag -fa latest -m "Release ${tag}"`, `Creating git tags ${tag} and latest`);

  // 6. Push to GitHub
  run(`git push origin main && git push origin ${tag} && git push origin latest --force`, `Pushing release ${tag} to GitHub`);

  console.log(`\n🎉 Release v${version} successfully pushed and deployed!`);
}

main();
