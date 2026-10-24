import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_REPO_ROOT = path.resolve(__dirname, '..', '..');
export function getRepoRoot(customRoot) {
    if (customRoot)
        return customRoot;
    // If dist/skills/manager.js -> root is ../..
    if (fs.existsSync(path.join(DEFAULT_REPO_ROOT, 'templates', 'skills', 'skills_index.json'))) {
        return DEFAULT_REPO_ROOT;
    }
    // If running from src/ during tests
    const altRoot = path.resolve(__dirname, '..');
    if (fs.existsSync(path.join(altRoot, 'templates', 'skills', 'skills_index.json'))) {
        return altRoot;
    }
    return DEFAULT_REPO_ROOT;
}
export function loadSkillsIndex(repoRoot) {
    const root = getRepoRoot(repoRoot);
    const indexPath = path.join(root, 'templates', 'skills', 'skills_index.json');
    let entries = [];
    if (fs.existsSync(indexPath)) {
        try {
            const raw = fs.readFileSync(indexPath, 'utf-8');
            entries = JSON.parse(raw);
        }
        catch (err) {
            console.error(`Failed to parse skills_index.json: ${err.message}`);
        }
    }
    // Ensure all curated skills in templates/skills/curated are registered and marked featured
    const curatedDir = path.join(root, 'templates', 'skills', 'curated');
    if (fs.existsSync(curatedDir)) {
        const curatedEntries = fs.readdirSync(curatedDir, { withFileTypes: true });
        for (const d of curatedEntries) {
            if (d.isDirectory()) {
                const existing = entries.find((s) => s.id === d.name);
                if (existing) {
                    existing.featured = true;
                }
                else {
                    entries.push({
                        id: d.name,
                        name: d.name,
                        category: d.name.includes('architecture')
                            ? 'architecture'
                            : d.name.includes('devops')
                                ? 'devops'
                                : 'development',
                        description: `Curated Agent Guard core skill: ${d.name}`,
                        tags: ['curated', 'agent-guard', d.name],
                        risk: 'safe',
                        source: 'agent-guard (Apache-2.0)',
                        author: 'Sarvesh (@anksarvesh-lgtm)',
                        featured: true,
                    });
                }
            }
        }
    }
    return entries;
}
export function listFeaturedSkills(repoRoot) {
    const all = loadSkillsIndex(repoRoot);
    return all.filter((s) => s.featured || s.id === 'agent-guard');
}
export function searchSkills(query, options, repoRoot) {
    const all = loadSkillsIndex(repoRoot);
    const q = query.trim().toLowerCase();
    const limit = options?.limit ?? 25;
    return all
        .filter((s) => {
        if (options?.category && s.category.toLowerCase() !== options.category.toLowerCase()) {
            return false;
        }
        if (!q)
            return true;
        const inId = s.id.toLowerCase().includes(q);
        const inName = s.name.toLowerCase().includes(q);
        const inDesc = s.description.toLowerCase().includes(q);
        const inTags = s.tags?.some((t) => t.toLowerCase().includes(q)) ?? false;
        return inId || inName || inDesc || inTags;
    })
        .slice(0, limit);
}
export function getSkillInfo(id, repoRoot) {
    const all = loadSkillsIndex(repoRoot);
    const targetId = id.trim().toLowerCase();
    return all.find((s) => s.id.toLowerCase() === targetId || s.name.toLowerCase() === targetId) || null;
}
export function getCategories(repoRoot) {
    const all = loadSkillsIndex(repoRoot);
    const map = new Map();
    for (const s of all) {
        const cat = s.category || 'uncategorized';
        map.set(cat, (map.get(cat) || 0) + 1);
    }
    return Array.from(map.entries())
        .map(([category, count]) => ({ category, count }))
        .sort((a, b) => b.count - a.count);
}
export function getDefaultSkillsDir() {
    const home = os.homedir();
    return path.join(home, '.gemini', 'antigravity', 'skills');
}
export function installSkill(id, options) {
    const root = getRepoRoot(options?.repoRoot);
    const skill = getSkillInfo(id, root);
    if (!skill) {
        return {
            success: false,
            destPath: '',
            message: `Skill "${id}" not found in Agent Guard catalog.`,
        };
    }
    const baseDir = options?.targetDir || getDefaultSkillsDir();
    const destDir = path.join(baseDir, skill.id);
    const destFile = path.join(destDir, 'SKILL.md');
    if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
    }
    // Check if curated template exists in repo
    const curatedTemplate = path.join(root, 'templates', 'skills', 'curated', skill.id, 'SKILL.md');
    const pluginTemplate = path.join(root, 'templates', 'plugin', 'agent-guard', 'skills', skill.id, 'SKILL.md');
    let content = '';
    if (fs.existsSync(curatedTemplate)) {
        content = fs.readFileSync(curatedTemplate, 'utf-8');
    }
    else if (fs.existsSync(pluginTemplate)) {
        content = fs.readFileSync(pluginTemplate, 'utf-8');
    }
    else {
        // Generate branded Agent Guard skill wrapper
        content = `---
name: ${skill.id}
description: "${skill.description.replace(/"/g, '\\"')}"
category: ${skill.category}
risk: ${skill.risk || 'safe'}
author: "Sarvesh (@anksarvesh-lgtm)"
supervisor: "@agent-guard"
license: Apache-2.0
---

# 🛡️ ${skill.name} (Agent Guard Edition)

> **Maintained by Sarvesh ([@anksarvesh-lgtm](https://github.com/anksarvesh-lgtm)) | Supervised by \`@agent-guard\`**  
> *Zero-Telemetry • Local-First • Autonomous Task Guarding*

---

## 🎯 Overview
${skill.description}

- **Category**: \`${skill.category}\`
- **Security Posture**: \`${skill.risk || 'safe'}\`
- **Tags**: \`${(skill.tags || []).join(', ') || 'none'}\`

## 🛡️ Agent Guard Supervision Rules
1. Call \`task_status\` before beginning work under this skill.
2. Structure implementation into 3 to 12 verifiable steps.
3. Call \`task_checkpoint\` after every step with test proofs.
4. Keep-awake lease is held during execution to prevent sleep.
`;
    }
    fs.writeFileSync(destFile, content, 'utf-8');
    return {
        success: true,
        destPath: destFile,
        message: `Skill "${skill.name}" successfully installed into: ${destFile}`,
    };
}
export function formatSkillsTable(skills) {
    if (skills.length === 0)
        return 'No matching skills found.';
    const lines = [];
    lines.push('-----------------------------------------------------------------------------------------------------');
    lines.push(`${'ID'.padEnd(28)} | ${'CATEGORY'.padEnd(20)} | ${'RISK'.padEnd(8)} | DESCRIPTION`);
    lines.push('-----------------------------------------------------------------------------------------------------');
    for (const s of skills) {
        const id = s.id.length > 27 ? s.id.slice(0, 24) + '...' : s.id;
        const cat = s.category.length > 19 ? s.category.slice(0, 16) + '...' : s.category;
        const risk = (s.risk || 'safe').padEnd(8);
        const desc = s.description.length > 60 ? s.description.slice(0, 57) + '...' : s.description;
        lines.push(`${id.padEnd(28)} | ${cat.padEnd(20)} | ${risk} | ${desc}`);
    }
    lines.push('-----------------------------------------------------------------------------------------------------');
    return lines.join('\n');
}
//# sourceMappingURL=manager.js.map