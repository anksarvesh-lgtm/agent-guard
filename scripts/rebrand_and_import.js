#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');
const SCRATCH_REPOS = path.resolve(REPO_ROOT, '..', 'scratch', 'repos');

console.log('🛡️ Agent Guard Skill Rebranding & Integration Engine\n');

function rebrandSkillMd(rawContent, skillName, division = 'Scientific Research & Computational Science') {
  // Parse frontmatter
  const fmMatch = rawContent.match(/^---\n([\s\S]*?)\n---/);
  let frontmatter = '';
  let body = rawContent;

  if (fmMatch) {
    frontmatter = fmMatch[1];
    body = rawContent.slice(fmMatch[0].length).trim();
  }

  // Parse lines of frontmatter
  const lines = frontmatter.split('\n');
  const newFmLines = [];
  let hasAuthor = false;
  let hasSupervisor = false;
  let hasLicense = false;

  for (const line of lines) {
    if (line.startsWith('author:') || line.startsWith('skill-author:')) {
      newFmLines.push('author: Sarvesh (@anksarvesh-lgtm)');
      hasAuthor = true;
    } else if (line.startsWith('supervisor:')) {
      newFmLines.push('supervisor: "@agent-guard"');
      hasSupervisor = true;
    } else if (line.startsWith('license:')) {
      newFmLines.push('license: Apache-2.0');
      hasLicense = true;
    } else {
      newFmLines.push(line);
    }
  }

  if (!hasAuthor) newFmLines.push('author: Sarvesh (@anksarvesh-lgtm)');
  if (!hasSupervisor) newFmLines.push('supervisor: "@agent-guard"');
  if (!hasLicense) newFmLines.push('license: Apache-2.0');

  // Strip existing top badges or headers from body if any
  let cleanBody = body;
  cleanBody = cleanBody.replace(/^<p align="center">[\s\S]*?<\/p>\s*/i, '');
  cleanBody = cleanBody.replace(/^> \*\*Maintained by[\s\S]*?\n\n/i, '');

  const brandedHeader = [
    `<p align="center">`,
    `  <img src="https://raw.githubusercontent.com/anksarvesh-lgtm/agent-guard/main/assets/logo.png" alt="Agent Guard Logo" width="320" />`,
    `</p>`,
    ``,
    `> **Maintained by Sarvesh ([@anksarvesh-lgtm](https://github.com/anksarvesh-lgtm)) | Supervised by \`@agent-guard\`**`,
    `> *${division} Division • Zero-Telemetry • Local-First*`,
    ``,
    `---`,
    ``
  ].join('\n');

  return `---\n${newFmLines.join('\n').trim()}\n---\n\n${brandedHeader}${cleanBody}\n`;
}

// 1. Rebrand & Import Scientific Skills
const sciSrc = path.join(SCRATCH_REPOS, 'scientific-agent-skills', 'skills');
const sciDest = path.join(REPO_ROOT, 'templates', 'skills', 'scientific');
fs.mkdirSync(sciDest, { recursive: true });

let sciCount = 0;
if (fs.existsSync(sciSrc)) {
  const entries = fs.readdirSync(sciSrc, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const srcDir = path.join(sciSrc, entry.name);
      const destDir = path.join(sciDest, entry.name);
      fs.mkdirSync(destDir, { recursive: true });

      // Copy all files and subdirectories
      fs.cpSync(srcDir, destDir, { recursive: true });

      // Rebrand SKILL.md
      const skillMdPath = path.join(destDir, 'SKILL.md');
      if (fs.existsSync(skillMdPath)) {
        const raw = fs.readFileSync(skillMdPath, 'utf-8');
        const rebranded = rebrandSkillMd(raw, entry.name, 'Computational Science & Research');
        fs.writeFileSync(skillMdPath, rebranded, 'utf-8');
      }
      sciCount++;
    }
  }
}
console.log(`✅ Imported & rebranded ${sciCount} scientific skills into templates/skills/scientific/`);

// 2. Rebrand & Import Memory Skills
const memSrc = path.join(SCRATCH_REPOS, 'agentmemory', 'plugin', 'skills');
const memDest = path.join(REPO_ROOT, 'templates', 'skills', 'memory');
fs.mkdirSync(memDest, { recursive: true });

let memCount = 0;
if (fs.existsSync(memSrc)) {
  const entries = fs.readdirSync(memSrc, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const srcDir = path.join(memSrc, entry.name);
      const destDir = path.join(memDest, entry.name);
      fs.mkdirSync(destDir, { recursive: true });

      fs.cpSync(srcDir, destDir, { recursive: true });

      const skillMdPath = path.join(destDir, 'SKILL.md');
      if (fs.existsSync(skillMdPath)) {
        const raw = fs.readFileSync(skillMdPath, 'utf-8');
        const rebranded = rebrandSkillMd(raw, entry.name, 'Cognitive Architecture & Long-Term Memory');
        fs.writeFileSync(skillMdPath, rebranded, 'utf-8');
      }
      memCount++;
    }
  }
}
console.log(`✅ Imported & rebranded ${memCount} cognitive memory skills into templates/skills/memory/`);

// 3. Rebrand & Import ClaudecodeUI Skills
const uiSrc = path.join(SCRATCH_REPOS, 'claudecodeui', '.agents', 'skills');
const curatedDest = path.join(REPO_ROOT, 'templates', 'skills', 'curated');

let uiCount = 0;
if (fs.existsSync(uiSrc)) {
  const entries = fs.readdirSync(uiSrc, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const srcDir = path.join(uiSrc, entry.name);
      const destDir = path.join(curatedDest, entry.name);
      fs.mkdirSync(destDir, { recursive: true });

      fs.cpSync(srcDir, destDir, { recursive: true });

      const skillMdPath = path.join(destDir, 'SKILL.md');
      if (fs.existsSync(skillMdPath)) {
        const raw = fs.readFileSync(skillMdPath, 'utf-8');
        const rebranded = rebrandSkillMd(raw, entry.name, 'Full-Stack Architecture & Module Engineering');
        fs.writeFileSync(skillMdPath, rebranded, 'utf-8');
      }
      uiCount++;
    }
  }
}
console.log(`✅ Imported & rebranded ${uiCount} module standards skills into templates/skills/curated/`);

// 4. Create Agent Skills Patterns skill
const patternDest = path.join(curatedDest, 'agent-skills-patterns');
fs.mkdirSync(patternDest, { recursive: true });
const patternMd = `---
name: agent-skills-patterns
description: Master Agent Skills architecture, progressive disclosure patterns, directory conventions (.agents/skills/), YAML frontmatter specification, and multi-agent host compatibility under Agent Guard supervision.
author: Sarvesh (@anksarvesh-lgtm)
supervisor: "@agent-guard"
license: Apache-2.0
---

# 📐 Agent Skills Design Patterns & Specification

<p align="center">
  <img src="https://raw.githubusercontent.com/anksarvesh-lgtm/agent-guard/main/assets/logo.png" alt="Agent Guard Logo" width="320" />
</p>

> **Maintained by Sarvesh ([@anksarvesh-lgtm](https://github.com/anksarvesh-lgtm)) | Supervised by \`@agent-guard\`**
> *Agent Skills Architecture & Standards • Zero-Telemetry • Local-First*

---

## 🎯 Role Overview
The **Agent Skills Patterns** skill encapsulates the universal Agent Skills specification and progressive disclosure architecture adopted by Google Antigravity, Claude Code, Cursor, Codex, and Gemini CLI.

## 🏗️ 5 Core Design Patterns

### 1. Progressive Disclosure Pattern
- **Phase 1: Discovery** — Agent inspects only \`name\` and \`description\` from index (0 tokens prompt bloat).
- **Phase 2: JIT Activation** — When a user request matches semantic query, agent loads full \`SKILL.md\` runbook on-demand.
- **Phase 3: Execution** — Specialized auxiliary scripts (\`scripts/\`) and references (\`references/\`) are invoked only if needed.

### 2. Guarded Workflow Pattern
- Enforces pre-conditions, checklists, and deterministic validation rules before executing mutations.

### 3. Context Budget Discipline
- Keep \`SKILL.md\` concise (< 500 lines, < 5,000 tokens). Move bulky reference manuals to \`references/\`.

### 4. Hermetic Directory Convention
\`\`\`text
<project>/.agents/skills/<skill-name>/
├── SKILL.md          # Mandatory runbook & frontmatter
├── scripts/          # Optional deterministic helper scripts
├── references/       # Optional deep-dive docs
└── assets/           # Optional templates & schemas
\`\`\`

### 5. Multi-Host Interoperability
- Project-level \`.agents/skills/\` automatically overrides user-level \`~/.gemini/config/skills/\` or \`~/.agents/skills/\`.
`;
fs.writeFileSync(path.join(patternDest, 'SKILL.md'), patternMd, 'utf-8');
console.log('✅ Created agent-skills-patterns skill in templates/skills/curated/agent-skills-patterns/');

// 5. Create Agent GUI Dashboard skill
const guiDest = path.join(curatedDest, 'agent-gui-dashboard');
fs.mkdirSync(guiDest, { recursive: true });
const guiMd = `---
name: agent-gui-dashboard
description: Web and desktop graphical interface wrapper for Agent Guard and AI coding agents. Run local or remote interactive sessions with file explorers, integrated shell, terminal streams, and mobile responsive controls.
author: Sarvesh (@anksarvesh-lgtm)
supervisor: "@agent-guard"
license: Apache-2.0
---

# 🖥️ Agent Guard Web & Desktop GUI Dashboard

<p align="center">
  <img src="https://raw.githubusercontent.com/anksarvesh-lgtm/agent-guard/main/assets/logo.png" alt="Agent Guard Logo" width="320" />
</p>

> **Maintained by Sarvesh ([@anksarvesh-lgtm](https://github.com/anksarvesh-lgtm)) | Supervised by \`@agent-guard\`**
> *Developer Experience & Visual Interfaces • Zero-Telemetry • Local-First*

---

## 🎯 Role Overview
The **Agent GUI Dashboard** provides a visual, reactive control center for AI agent sessions. It wraps command-line agents into a full web and desktop workspace equipped with:

- **Interactive Chat Interface**: Real-time streaming conversation view with rich markdown and artifacts.
- **Integrated Terminal**: Direct shell access to active agent execution environments.
- **File Explorer**: Visual file tree with syntax-highlighted editor and diff inspector.
- **Cross-Device Access**: Responsive web layout accessible from desktop, tablet, or phone.
- **Agent Switcher**: Non-disruptive switching between Google Antigravity, Claude Code, and Cursor.
`;
fs.writeFileSync(path.join(guiDest, 'SKILL.md'), guiMd, 'utf-8');
console.log('✅ Created agent-gui-dashboard skill in templates/skills/curated/agent-gui-dashboard/');

console.log('\n🎉 Rebranding & Integration complete!');
