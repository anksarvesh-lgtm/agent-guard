import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { resolveProjectPath, getAgentDir } from '../util/paths.js';
export class LocalMemoryManager {
    static instance = null;
    static getInstance() {
        if (!LocalMemoryManager.instance) {
            LocalMemoryManager.instance = new LocalMemoryManager();
        }
        return LocalMemoryManager.instance;
    }
    getMemoryFilePath(projectPath) {
        const project = resolveProjectPath(projectPath || process.cwd());
        const agentDir = getAgentDir(project);
        if (!fs.existsSync(agentDir)) {
            fs.mkdirSync(agentDir, { recursive: true });
        }
        return path.join(agentDir, 'memories.json');
    }
    readMemories(projectPath) {
        const file = this.getMemoryFilePath(projectPath);
        if (!fs.existsSync(file))
            return [];
        try {
            const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
            return Array.isArray(data) ? data : [];
        }
        catch {
            return [];
        }
    }
    writeMemories(memories, projectPath) {
        const file = this.getMemoryFilePath(projectPath);
        fs.writeFileSync(file, JSON.stringify(memories, null, 2) + '\n', 'utf-8');
    }
    /**
     * Stores a persistent memory into the project ledger.
     */
    store(content, options) {
        const project = resolveProjectPath(options?.projectPath || process.cwd());
        const memories = this.readMemories(project);
        const now = new Date().toISOString();
        const id = `mem-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
        const rawTags = options?.tags || [];
        const cleanTags = Array.from(new Set(rawTags
            .map((t) => t.trim().toLowerCase())
            .filter((t) => t.length > 0)));
        const entry = {
            id,
            content: content.trim(),
            tags: cleanTags,
            category: options?.category || 'general',
            createdAt: now,
            updatedAt: now,
            project,
        };
        memories.unshift(entry);
        this.writeMemories(memories, project);
        return entry;
    }
    /**
     * Recalls relevant memories matching a natural language or keyword query.
     */
    recall(query, options) {
        const project = resolveProjectPath(options?.projectPath || process.cwd());
        const memories = this.readMemories(project);
        const q = query.trim().toLowerCase();
        const limit = options?.limit || 5;
        const filterTag = options?.tag ? options.tag.trim().toLowerCase() : undefined;
        const filterCat = options?.category ? options.category.trim().toLowerCase() : undefined;
        const tokens = q
            .replace(/[^a-z0-9_\-\s]/g, ' ')
            .split(/\s+/)
            .filter((w) => w.length > 1);
        const scored = [];
        for (const mem of memories) {
            if (filterTag && !mem.tags.some((t) => t.includes(filterTag))) {
                continue;
            }
            if (filterCat && mem.category.toLowerCase() !== filterCat) {
                continue;
            }
            let score = 0;
            const contentLower = mem.content.toLowerCase();
            // Exact substring match
            if (contentLower.includes(q)) {
                score += 50;
            }
            // Keyword token scoring
            for (const t of tokens) {
                if (contentLower.includes(t)) {
                    score += 15;
                }
                if (mem.tags.some((tag) => tag.includes(t))) {
                    score += 25;
                }
            }
            if (score > 0 || !q) {
                scored.push({ ...mem, score });
            }
        }
        scored.sort((a, b) => b.score - a.score || b.createdAt.localeCompare(a.createdAt));
        const results = scored.slice(0, limit);
        return {
            memories: results,
            totalFound: scored.length,
            query,
        };
    }
    /**
     * Lists all memories recorded for a workspace.
     */
    list(options) {
        const project = resolveProjectPath(options?.projectPath || process.cwd());
        const memories = this.readMemories(project);
        const limit = options?.limit || 50;
        return memories.slice(0, limit);
    }
    /**
     * Deletes a specific memory by ID.
     */
    delete(id, options) {
        const project = resolveProjectPath(options?.projectPath || process.cwd());
        const memories = this.readMemories(project);
        const idx = memories.findIndex((m) => m.id === id);
        if (idx === -1)
            return false;
        memories.splice(idx, 1);
        this.writeMemories(memories, project);
        return true;
    }
}
export const globalMemoryManager = LocalMemoryManager.getInstance();
//# sourceMappingURL=index.js.map