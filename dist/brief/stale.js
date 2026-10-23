import { execSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { isSensitiveOrIgnored } from './sanitize.js';
export function getProjectFreshness(projectPath) {
    let isGit = false;
    let commit = 'none';
    let files = [];
    try {
        const gitDir = path.join(projectPath, '.git');
        if (fs.existsSync(gitDir)) {
            commit = execSync('git rev-parse HEAD', {
                cwd: projectPath,
                encoding: 'utf-8',
                timeout: 2000,
            }).trim();
            const lsOutput = execSync('git ls-files', {
                cwd: projectPath,
                encoding: 'utf-8',
                timeout: 3000,
                maxBuffer: 10 * 1024 * 1024,
            });
            files = lsOutput
                .split('\n')
                .map((f) => f.trim())
                .filter((f) => f.length > 0 && !isSensitiveOrIgnored(f));
            isGit = true;
        }
    }
    catch {
        isGit = false;
    }
    // Fallback for non-git directory
    if (!isGit) {
        let latestMtime = 0;
        const collected = [];
        const walk = (dir, depth) => {
            if (depth > 5)
                return;
            let entries = [];
            try {
                entries = fs.readdirSync(dir, { withFileTypes: true });
            }
            catch {
                return;
            }
            for (const ent of entries) {
                const full = path.join(dir, ent.name);
                const rel = path.relative(projectPath, full);
                if (isSensitiveOrIgnored(rel))
                    continue;
                if (ent.isDirectory()) {
                    walk(full, depth + 1);
                }
                else if (ent.isFile()) {
                    collected.push(rel);
                    try {
                        const stat = fs.statSync(full);
                        if (stat.mtimeMs > latestMtime) {
                            latestMtime = stat.mtimeMs;
                        }
                    }
                    catch { }
                }
            }
        };
        walk(projectPath, 0);
        commit = `mtime-${Math.floor(latestMtime)}`;
        files = collected;
    }
    // Compute a short hash of the sorted file names
    const hash = crypto
        .createHash('sha256')
        .update(files.slice().sort().join('\n'))
        .digest('hex')
        .slice(0, 8);
    return {
        isGit,
        commit: commit.slice(0, 8),
        filesHash: hash,
        fileCount: files.length,
        files,
    };
}
export function parseBriefHeader(briefContent) {
    const firstLine = briefContent.split('\n')[0] || '';
    const match = firstLine.match(/<!-- BRIEF: COMMIT=([a-zA-Z0-9_-]+) HASH=([a-zA-Z0-9_-]+)/);
    if (match) {
        return { commit: match[1], hash: match[2] };
    }
    return null;
}
//# sourceMappingURL=stale.js.map