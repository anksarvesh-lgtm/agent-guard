import fs from 'node:fs';
import path from 'node:path';
import { getBriefPath, getTrapsPath } from '../util/paths.js';
import { getProjectFreshness, FreshnessInfo } from './stale.js';
import { isSensitiveOrIgnored } from './sanitize.js';

const HARD_CHAR_LIMIT = 8000;

export function buildRepoBrief(projectPath: string, freshness?: FreshnessInfo): string {
  const fresh = freshness ?? getProjectFreshness(projectPath);
  const projectName = path.basename(projectPath);
  const now = new Date().toISOString();

  const lines: string[] = [];

  // Header line with embedded metadata for staleness detection
  lines.push(`<!-- BRIEF: COMMIT=${fresh.commit} HASH=${fresh.filesHash} DATE=${now} -->`);
  lines.push(`# Project Brief: ${projectName}`);
  lines.push(`- **Commit**: \`${fresh.commit}\` | **Updated**: ${now} | **Files Tracked**: ${fresh.fileCount}\n`);

  // 1. What it is: First paragraph of README
  lines.push(`## Overview`);
  let overview = 'No README.md found.';
  for (const readmeName of ['README.md', 'readme.md', 'README', 'Readme.md']) {
    const readmePath = path.join(projectPath, readmeName);
    if (fs.existsSync(readmePath)) {
      try {
        const raw = fs.readFileSync(readmePath, 'utf-8');
        const paragraphs = raw
          .split(/\n\s*\n/)
          .map((p) => p.trim())
          .filter((p) => p.length > 0);
        if (paragraphs.length > 0) {
          const nonHeader = paragraphs.find((p) => !p.startsWith('#'));
          overview = (nonHeader || paragraphs[0].replace(/^#+\s*/, '')).slice(0, 300);
        }
      } catch {}
      break;
    }
  }
  lines.push(overview);
  lines.push('');

  // 2. Tech stack: inspect manifests
  lines.push(`## Tech Stack`);
  const stackItems: string[] = [];
  const pkgJsonPath = path.join(projectPath, 'package.json');
  if (fs.existsSync(pkgJsonPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
      stackItems.push(`- Node.js / JavaScript/TypeScript (name: ${pkg.name || 'unnamed'})`);
      if (pkg.dependencies) {
        const topDeps = Object.keys(pkg.dependencies).slice(0, 8).join(', ');
        stackItems.push(`  Deps: ${topDeps}`);
      }
    } catch {}
  }
  if (fs.existsSync(path.join(projectPath, 'Cargo.toml'))) stackItems.push('- Rust (Cargo.toml)');
  if (fs.existsSync(path.join(projectPath, 'go.mod'))) stackItems.push('- Go (go.mod)');
  if (fs.existsSync(path.join(projectPath, 'pubspec.yaml'))) stackItems.push('- Flutter / Dart (pubspec.yaml)');
  if (fs.existsSync(path.join(projectPath, 'requirements.txt')) || fs.existsSync(path.join(projectPath, 'pyproject.toml'))) {
    stackItems.push('- Python (requirements.txt / pyproject.toml)');
  }
  if (fs.existsSync(path.join(projectPath, 'pom.xml'))) stackItems.push('- Java / Maven (pom.xml)');
  if (fs.existsSync(path.join(projectPath, 'build.gradle'))) stackItems.push('- Java / Gradle (build.gradle)');

  if (stackItems.length === 0) {
    lines.push('- Generic / Stack undetected');
  } else {
    lines.push(stackItems.slice(0, 10).join('\n'));
  }
  lines.push('');

  // 3. Folder map: top 2 levels with counts
  lines.push(`## Folder Layout (Top 2 Levels)`);
  const dirCounts: Record<string, number> = {};
  for (const f of fresh.files) {
    const parts = f.split('/');
    if (parts.length === 1) {
      dirCounts['.'] = (dirCounts['.'] || 0) + 1;
    } else {
      const top2 = parts.length >= 2 ? `${parts[0]}/${parts[1]}` : parts[0];
      dirCounts[top2] = (dirCounts[top2] || 0) + 1;
    }
  }
  const sortedDirs = Object.entries(dirCounts)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(0, 40);
  for (const [dir, count] of sortedDirs) {
    lines.push(`- \`${dir}\`: ${count} file${count === 1 ? '' : 's'}`);
  }
  lines.push('');

  // 4. Entry points
  lines.push(`## Likely Entry Points`);
  const entryPoints = fresh.files
    .filter((f) => {
      const base = path.basename(f, path.extname(f)).toLowerCase();
      return ['main', 'index', 'app', 'server', 'cli'].includes(base);
    })
    .slice(0, 10);
  if (entryPoints.length > 0) {
    for (const ep of entryPoints) {
      lines.push(`- \`${ep}\``);
    }
  } else {
    lines.push('- None identified');
  }
  lines.push('');

  // 5. Commands to build, test, and run
  lines.push(`## Key Commands`);
  const commands: string[] = [];
  if (fs.existsSync(pkgJsonPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
      if (pkg.scripts) {
        for (const [scriptName, cmd] of Object.entries(pkg.scripts).slice(0, 12)) {
          commands.push(`- \`npm run ${scriptName}\`: \`${cmd}\``);
        }
      }
    } catch {}
  }
  const makefilePath = path.join(projectPath, 'Makefile');
  if (fs.existsSync(makefilePath)) {
    commands.push('- `make`: Makefile present in project root');
  }
  if (commands.length > 0) {
    lines.push(commands.slice(0, 15).join('\n'));
  } else {
    lines.push('- No build/test scripts found');
  }
  lines.push('');

  // 6. Existing project rules (AGENTS.md, CLAUDE.md, etc.)
  for (const ruleFileName of ['AGENTS.md', 'CLAUDE.md', 'RULES.md', '.rules.md']) {
    const rulePath = path.join(projectPath, ruleFileName);
    if (fs.existsSync(rulePath)) {
      try {
        const content = fs.readFileSync(rulePath, 'utf-8').trim().slice(0, 1000);
        lines.push(`## Project Rules (${ruleFileName})`);
        lines.push(content);
        lines.push('');
      } catch {}
      break;
    }
  }

  // 7. Known traps: .agent/traps.md
  const trapsPath = getTrapsPath(projectPath);
  if (fs.existsSync(trapsPath)) {
    try {
      const traps = fs.readFileSync(trapsPath, 'utf-8').trim().slice(0, 1500);
      if (traps.length > 0) {
        lines.push(`## Known Traps (.agent/traps.md)`);
        lines.push(traps);
        lines.push('');
      }
    } catch {}
  }

  let finalOutput = lines.join('\n');
  if (finalOutput.length > HARD_CHAR_LIMIT) {
    finalOutput = finalOutput.slice(0, HARD_CHAR_LIMIT - 40) + '\n\n[Brief capped at 8,000 characters]';
  }

  // Cache to .agent/brief.md
  try {
    const briefPath = getBriefPath(projectPath);
    fs.writeFileSync(briefPath, finalOutput, 'utf-8');
  } catch {}

  return finalOutput;
}
