import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_REPO_ROOT = path.resolve(__dirname, '..', '..');
export class JitSkillRouter {
    static instance = null;
    skills = [];
    invertedIndex = new Map();
    repoRoot;
    initialized = false;
    constructor(customRoot) {
        this.repoRoot = customRoot || this.resolveRepoRoot();
    }
    static getInstance(customRoot) {
        if (!JitSkillRouter.instance) {
            JitSkillRouter.instance = new JitSkillRouter(customRoot);
        }
        return JitSkillRouter.instance;
    }
    resolveRepoRoot() {
        if (fs.existsSync(path.join(DEFAULT_REPO_ROOT, 'templates', 'skills', 'skills_index.json'))) {
            return DEFAULT_REPO_ROOT;
        }
        const altRoot = path.resolve(__dirname, '..');
        if (fs.existsSync(path.join(altRoot, 'templates', 'skills', 'skills_index.json'))) {
            return altRoot;
        }
        return DEFAULT_REPO_ROOT;
    }
    ensureInitialized() {
        if (this.initialized)
            return;
        const seenIds = new Set();
        const loadSkillDirectory = (dirPath, tier, defaultCategory, defaultTags) => {
            if (!fs.existsSync(dirPath))
                return;
            try {
                const entries = fs.readdirSync(dirPath, { withFileTypes: true });
                for (const entry of entries) {
                    if (entry.isDirectory() && !seenIds.has(entry.name) && entry.name !== '_shared') {
                        const skillPath = path.join(dirPath, entry.name);
                        const skillMd = path.join(skillPath, 'SKILL.md');
                        let desc = `${defaultCategory} skill: ${entry.name}`;
                        if (fs.existsSync(skillMd)) {
                            const raw = fs.readFileSync(skillMd, 'utf-8');
                            const fm = raw.match(/^---\n([\s\S]*?)\n---/);
                            if (fm) {
                                const lines = fm[1].split('\n');
                                const line = lines.find((l) => l.startsWith('description:'));
                                if (line) {
                                    desc = line.replace('description:', '').trim().replace(/^['" >-]+/, '').slice(0, 200);
                                }
                            }
                        }
                        this.skills.push({
                            id: entry.name,
                            name: entry.name,
                            category: defaultCategory,
                            tier,
                            description: desc,
                            tags: [...defaultTags, entry.name],
                            diskPath: skillPath,
                        });
                        seenIds.add(entry.name);
                    }
                }
            }
            catch { }
        };
        // 1. Tier 1: Curated Skills in templates/skills/curated
        const curatedDir = path.join(this.repoRoot, 'templates', 'skills', 'curated');
        loadSkillDirectory(curatedDir, 'active', 'curated', ['curated', 'production']);
        // 2. Tier 1 Scientific Skills in templates/skills/scientific
        const scientificDir = path.join(this.repoRoot, 'templates', 'skills', 'scientific');
        loadSkillDirectory(scientificDir, 'active', 'scientific', [
            'scientific',
            'research',
            'bioinformatics',
            'chemistry',
            'astronomy',
            'physics',
        ]);
        // 3. Tier 1 Cognitive Memory Skills in templates/skills/memory
        const memoryDir = path.join(this.repoRoot, 'templates', 'skills', 'memory');
        loadSkillDirectory(memoryDir, 'active', 'memory', [
            'memory',
            'agentmemory',
            'long-term-memory',
            'persistence',
            'recall',
        ]);
        // 4. Tier 2: Composio SaaS Skills in templates/skills/composio (bundled) or external fallback
        const bundledComposio = path.join(this.repoRoot, 'templates', 'skills', 'composio');
        const fallbackComposio = path.join(path.dirname(this.repoRoot), 'agent-skills', 'skills', 'composio-skills');
        const composioDir = fs.existsSync(bundledComposio) ? bundledComposio : fallbackComposio;
        if (fs.existsSync(composioDir)) {
            try {
                const entries = fs.readdirSync(composioDir, { withFileTypes: true });
                for (const entry of entries) {
                    if (entry.isDirectory() && !seenIds.has(entry.name)) {
                        const skillPath = path.join(composioDir, entry.name);
                        const cleanName = entry.name.replace(/-automation$/, '');
                        this.skills.push({
                            id: entry.name,
                            name: cleanName,
                            category: 'saas-integration',
                            tier: 'composio',
                            description: `Automate ${cleanName} cloud workflows, actions, and API operations via Composio Rube MCP.`,
                            tags: ['composio', 'saas', 'cloud', cleanName, 'integration'],
                            diskPath: skillPath,
                        });
                        seenIds.add(entry.name);
                    }
                }
            }
            catch { }
        }
        // 3. Tier 3: Awesome Community Skills from templates/skills/skills_index.json
        const indexFile = path.join(this.repoRoot, 'templates', 'skills', 'skills_index.json');
        if (fs.existsSync(indexFile)) {
            try {
                const raw = fs.readFileSync(indexFile, 'utf-8');
                const list = JSON.parse(raw);
                for (const item of list) {
                    const id = item.id || item.name;
                    if (id && !seenIds.has(id)) {
                        this.skills.push({
                            id,
                            name: item.name || id,
                            category: item.category || 'community',
                            tier: 'community',
                            description: item.description || `Community agent skill: ${id}`,
                            tags: Array.isArray(item.tags) ? item.tags : [item.category || 'general'],
                        });
                        seenIds.add(id);
                    }
                }
            }
            catch { }
        }
        // Build Inverted Index for <5ms lookups
        this.invertedIndex.clear();
        for (let i = 0; i < this.skills.length; i++) {
            const s = this.skills[i];
            const tokens = this.tokenize(`${s.id} ${s.name} ${s.category} ${s.tags.join(' ')} ${s.description}`);
            for (const t of tokens) {
                if (!this.invertedIndex.has(t)) {
                    this.invertedIndex.set(t, new Set());
                }
                this.invertedIndex.get(t).add(i);
            }
        }
        this.initialized = true;
    }
    tokenize(text) {
        const rawTokens = text
            .toLowerCase()
            .replace(/[^a-z0-9_\-\s]/g, ' ')
            .split(/\s+/)
            .filter((w) => w.length > 1);
        const tokenSet = new Set();
        for (const w of rawTokens) {
            tokenSet.add(w);
            if (w.endsWith('s') && w.length > 3) {
                tokenSet.add(w.slice(0, -1));
            }
            if (w.endsWith('ing') && w.length > 5) {
                tokenSet.add(w.slice(0, -3));
            }
            if (w.endsWith('ed') && w.length > 4) {
                tokenSet.add(w.slice(0, -2));
            }
        }
        return Array.from(tokenSet);
    }
    getTotalSkillsCount() {
        this.ensureInitialized();
        return this.skills.length;
    }
    getStats() {
        this.ensureInitialized();
        return {
            totalSkills: this.skills.length,
            activeCount: this.skills.filter((s) => s.tier === 'active').length,
            scientificCount: this.skills.filter((s) => s.category === 'scientific').length,
            memoryCount: this.skills.filter((s) => s.category === 'memory').length,
            composioCount: this.skills.filter((s) => s.tier === 'composio').length,
            communityCount: this.skills.filter((s) => s.tier === 'community').length,
            uniqueTokens: this.invertedIndex.size,
        };
    }
    getSkillsByTier(tier) {
        this.ensureInitialized();
        return this.skills.filter((s) => s.tier === tier);
    }
    route(query, options) {
        this.ensureInitialized();
        const q = query.trim().toLowerCase();
        if (!q)
            return [];
        const limit = options?.limit ?? 5;
        const minScore = options?.minScore ?? 0.15;
        const tokens = this.tokenize(q);
        if (tokens.length === 0)
            return [];
        // Candidate retrieval using inverted index
        const candidateIndices = new Set();
        for (const t of tokens) {
            const matches = this.invertedIndex.get(t);
            if (matches) {
                for (const idx of matches) {
                    candidateIndices.add(idx);
                }
            }
        }
        // Score candidates
        const scored = [];
        for (const idx of candidateIndices) {
            const s = this.skills[idx];
            if (options?.tier && s.tier !== options.tier)
                continue;
            let rawScore = 0;
            const reasons = [];
            const idLower = s.id.toLowerCase();
            const nameLower = s.name.toLowerCase();
            // Exact ID / Slug Match
            if (idLower === q || nameLower === q) {
                rawScore += 100;
                reasons.push('exact_id_match');
            }
            else if (idLower.includes(q) || q.includes(idLower)) {
                rawScore += 60;
                reasons.push('substring_id_match');
            }
            // Token Matches
            let matchedTokens = 0;
            for (const t of tokens) {
                if (idLower === t || nameLower === t) {
                    rawScore += 40;
                    reasons.push(`term_exact:${t}`);
                    matchedTokens++;
                }
                else if (idLower.includes(t)) {
                    rawScore += 25;
                    reasons.push(`term_in_id:${t}`);
                    matchedTokens++;
                }
                else if (s.tags.some((tag) => tag.toLowerCase() === t || tag.toLowerCase().includes(t))) {
                    rawScore += 20;
                    reasons.push(`term_in_tags:${t}`);
                    matchedTokens++;
                }
                else if (s.category.toLowerCase().includes(t)) {
                    rawScore += 15;
                    reasons.push(`term_in_category:${t}`);
                    matchedTokens++;
                }
                else if (s.description.toLowerCase().includes(t)) {
                    rawScore += 8;
                    matchedTokens++;
                }
            }
            // Tier Priority: Curated active gets slight boost, Composio for SaaS gets boost
            if (s.tier === 'active')
                rawScore *= 1.25;
            if (s.tier === 'composio' && (q.includes('saas') || q.includes('api') || q.includes('automate')))
                rawScore *= 1.2;
            // Normalize score between 0 and 1
            const normalizedScore = Math.min(1.0, Math.round((rawScore / 100) * 100) / 100);
            if (normalizedScore >= minScore) {
                const confidence = normalizedScore >= 0.7 ? 'HIGH' : normalizedScore >= 0.4 ? 'MEDIUM' : 'LOW';
                const result = {
                    id: s.id,
                    name: s.name,
                    category: s.category,
                    tier: s.tier,
                    description: s.description,
                    score: normalizedScore,
                    confidence,
                    matchReasons: Array.from(new Set(reasons)),
                    diskPath: s.diskPath,
                };
                if (options?.loadContent && s.diskPath) {
                    result.content = this.readSkillContent(s);
                }
                scored.push(result);
            }
        }
        return scored.sort((a, b) => b.score - a.score).slice(0, limit);
    }
    readSkillContent(skill) {
        let filePath = '';
        if (skill.diskPath) {
            filePath = path.join(skill.diskPath, 'SKILL.md');
            if (fs.existsSync(filePath)) {
                return fs.readFileSync(filePath, 'utf-8');
            }
        }
        // Check curated templates
        const curated = path.join(this.repoRoot, 'templates', 'skills', 'curated', skill.id, 'SKILL.md');
        if (fs.existsSync(curated))
            return fs.readFileSync(curated, 'utf-8');
        // Check global skills
        const globalPath = path.join(process.env.HOME || '', '.gemini', 'config', 'skills', skill.id, 'SKILL.md');
        if (fs.existsSync(globalPath))
            return fs.readFileSync(globalPath, 'utf-8');
        // Check composio skills
        const composioPath = path.join(path.dirname(this.repoRoot), 'agent-skills', 'skills', 'composio-skills', skill.id, 'SKILL.md');
        if (fs.existsSync(composioPath))
            return fs.readFileSync(composioPath, 'utf-8');
        return undefined;
    }
}
export const globalJitSkillRouter = JitSkillRouter.getInstance();
//# sourceMappingURL=router.js.map