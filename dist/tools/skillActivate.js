import fs from 'node:fs';
import path from 'node:path';
import { SkillActivateSchema, formatZodError } from '../util/schema.js';
import { resolveProjectPath } from '../util/paths.js';
import { globalJitSkillRouter } from '../skills/router.js';
import { logToolCall } from '../util/log.js';
export function handleSkillActivate(rawArgs) {
    const parseResult = SkillActivateSchema.safeParse(rawArgs);
    if (!parseResult.success) {
        const err = formatZodError(parseResult.error);
        logToolCall('skill_activate', rawArgs?.query, 'BAD_INPUT', rawArgs?.project_path);
        return err;
    }
    const { query, project_path, auto_install, limit } = parseResult.data;
    let validatedProject;
    if (project_path) {
        try {
            validatedProject = resolveProjectPath(project_path);
        }
        catch {
            validatedProject = undefined;
        }
    }
    const matches = globalJitSkillRouter.route(query, {
        limit,
        minScore: 0.2,
        loadContent: true,
    });
    if (matches.length === 0) {
        logToolCall('skill_activate', query, 'NO_MATCH', validatedProject);
        return [
            `🔍 No skills found matching: "${query}".`,
            '',
            'Suggestions:',
            '• Try broader terms (e.g. "docker", "stripe", "react", "security", "database").',
            '• Search the 3,600+ catalog from CLI: `node dist/cli.js skills search <term>`',
            '• View all 114 categories: `node dist/cli.js skills categories`',
        ].join('\n');
    }
    const topMatch = matches[0];
    let autoInstallNote = '';
    // Auto-install / symlink into workspace if requested and project path is valid
    if (auto_install && validatedProject && topMatch.diskPath && fs.existsSync(topMatch.diskPath)) {
        try {
            const targetDir = path.join(validatedProject, '.agents', 'skills', topMatch.id);
            if (!fs.existsSync(targetDir)) {
                fs.mkdirSync(path.dirname(targetDir), { recursive: true });
                try {
                    fs.symlinkSync(topMatch.diskPath, targetDir, 'dir');
                    autoInstallNote = ` [Permanently linked to .agents/skills/${topMatch.id}]`;
                }
                catch {
                    fs.cpSync(topMatch.diskPath, targetDir, { recursive: true });
                    autoInstallNote = ` [Installed to .agents/skills/${topMatch.id}]`;
                }
                // Ensure .agents/skills.json includes the local skills directory
                const skillsJsonPath = path.join(validatedProject, '.agents', 'skills.json');
                let currentCfg = { entries: [] };
                if (fs.existsSync(skillsJsonPath)) {
                    try {
                        currentCfg = JSON.parse(fs.readFileSync(skillsJsonPath, 'utf-8'));
                    }
                    catch { }
                }
                currentCfg.entries = currentCfg.entries || [];
                const hasRel = currentCfg.entries.some((e) => e.path === '.agents/skills');
                if (!hasRel) {
                    currentCfg.entries.unshift({ path: '.agents/skills' });
                }
                currentCfg.skills = currentCfg.skills || [];
                if (!currentCfg.skills.some((s) => s.id === topMatch.id)) {
                    currentCfg.skills.push({
                        id: topMatch.id,
                        name: topMatch.name,
                        tier: topMatch.tier,
                        category: topMatch.category,
                        activated_at: new Date().toISOString(),
                    });
                }
                fs.writeFileSync(skillsJsonPath, JSON.stringify(currentCfg, null, 2) + '\n', 'utf-8');
            }
        }
        catch (e) {
            autoInstallNote = ` [Link notice: ${e.message}]`;
        }
    }
    logToolCall('skill_activate', query, 'OK', validatedProject);
    const lines = [
        `⚡ [JIT Skill Activated] "${topMatch.name}" (${topMatch.id})`,
        `• Tier: ${topMatch.tier.toUpperCase()} | Category: ${topMatch.category} | Confidence: ${topMatch.confidence} (Score: ${Math.round(topMatch.score * 100)}%)${autoInstallNote}`,
        `• Description: ${topMatch.description}`,
        '',
    ];
    if (topMatch.content) {
        lines.push('---');
        lines.push('### 📖 Procedural Instructions & Runbook:');
        lines.push(topMatch.content.trim());
        lines.push('---');
    }
    else {
        lines.push(`ℹ️ This is a cataloged skill from the 3,600+ library.`);
        lines.push(`Run \`node dist/cli.js skills install "${topMatch.id}"\` to pull full template files.`);
    }
    if (matches.length > 1) {
        lines.push('');
        lines.push('🎯 Related Candidate Skills:');
        for (let i = 1; i < matches.length; i++) {
            const m = matches[i];
            lines.push(`• **\`${m.id}\`** (${m.tier}): ${m.description.slice(0, 80)}... (Score: ${Math.round(m.score * 100)}%)`);
        }
    }
    return lines.join('\n');
}
//# sourceMappingURL=skillActivate.js.map