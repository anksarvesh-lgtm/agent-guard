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
export declare class LocalMemoryManager {
    private static instance;
    static getInstance(): LocalMemoryManager;
    private getMemoryFilePath;
    private readMemories;
    private writeMemories;
    /**
     * Stores a persistent memory into the project ledger.
     */
    store(content: string, options?: {
        tags?: string[];
        category?: MemoryEntry['category'];
        projectPath?: string;
    }): MemoryEntry;
    /**
     * Recalls relevant memories matching a natural language or keyword query.
     */
    recall(query: string, options?: {
        limit?: number;
        tag?: string;
        category?: string;
        projectPath?: string;
    }): MemoryRecallResult;
    /**
     * Lists all memories recorded for a workspace.
     */
    list(options?: {
        projectPath?: string;
        limit?: number;
    }): MemoryEntry[];
    /**
     * Deletes a specific memory by ID.
     */
    delete(id: string, options?: {
        projectPath?: string;
    }): boolean;
}
export declare const globalMemoryManager: LocalMemoryManager;
//# sourceMappingURL=index.d.ts.map