import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { resolveProjectPath, getAgentDir } from '../util/paths.js';

export interface MemoryEntry {
  id: string;
  content: string;
  tags: string[];
  category: 'decision' | 'architecture' | 'learning' | 'convention' | 'general';
  createdAt: string;
  updatedAt: string;
  project?: string;
  score?: number;
}

export interface MemoryRecallResult {
  memories: MemoryEntry[];
  totalFound: number;
  query: string;
}

export class LocalMemoryManager {
  private static instance: LocalMemoryManager | null = null;

  public static getInstance(): LocalMemoryManager {
    if (!LocalMemoryManager.instance) {
      LocalMemoryManager.instance = new LocalMemoryManager();
    }
    return LocalMemoryManager.instance;
  }

  private getMemoryFilePath(projectPath?: string): string {
    const project = resolveProjectPath(projectPath || process.cwd());
    const agentDir = getAgentDir(project);
    if (!fs.existsSync(agentDir)) {
      fs.mkdirSync(agentDir, { recursive: true });
    }
    return path.join(agentDir, 'memories.json');
  }

  private readMemories(projectPath?: string): MemoryEntry[] {
    const file = this.getMemoryFilePath(projectPath);
    if (!fs.existsSync(file)) return [];
    try {
      const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }

  private writeMemories(memories: MemoryEntry[], projectPath?: string): void {
    const file = this.getMemoryFilePath(projectPath);
    fs.writeFileSync(file, JSON.stringify(memories, null, 2) + '\n', 'utf-8');
  }

  /**
   * Stores a persistent memory into the project ledger.
   */
  public store(
    content: string,
    options?: {
      tags?: string[];
      category?: MemoryEntry['category'];
      projectPath?: string;
    }
  ): MemoryEntry {
    const project = resolveProjectPath(options?.projectPath || process.cwd());
    const memories = this.readMemories(project);

    const now = new Date().toISOString();
    const id = `mem-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;

    const rawTags = options?.tags || [];
    const cleanTags = Array.from(
      new Set(
        rawTags
          .map((t) => t.trim().toLowerCase())
          .filter((t) => t.length > 0)
      )
    );

    const entry: MemoryEntry = {
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
  public recall(
    query: string,
    options?: {
      limit?: number;
      tag?: string;
      category?: string;
      projectPath?: string;
    }
  ): MemoryRecallResult {
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

    const scored: (MemoryEntry & { score: number })[] = [];

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
  public list(options?: { projectPath?: string; limit?: number }): MemoryEntry[] {
    const project = resolveProjectPath(options?.projectPath || process.cwd());
    const memories = this.readMemories(project);
    const limit = options?.limit || 50;
    return memories.slice(0, limit);
  }

  /**
   * Deletes a specific memory by ID.
   */
  public delete(id: string, options?: { projectPath?: string }): boolean {
    const project = resolveProjectPath(options?.projectPath || process.cwd());
    const memories = this.readMemories(project);
    const idx = memories.findIndex((m) => m.id === id);
    if (idx === -1) return false;

    memories.splice(idx, 1);
    this.writeMemories(memories, project);
    return true;
  }
}

export const globalMemoryManager = LocalMemoryManager.getInstance();
