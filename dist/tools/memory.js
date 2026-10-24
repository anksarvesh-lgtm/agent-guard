import { MemoryStoreSchema, MemoryRecallSchema, formatZodError } from '../util/schema.js';
import { resolveProjectPath } from '../util/paths.js';
import { logToolCall } from '../util/log.js';
import { globalMemoryManager } from '../memory/index.js';
export function handleMemoryStore(rawArgs) {
    const parseResult = MemoryStoreSchema.safeParse(rawArgs);
    if (!parseResult.success) {
        const err = formatZodError(parseResult.error);
        logToolCall('memory_store', null, 'BAD_INPUT', rawArgs?.project_path);
        return err;
    }
    const { content, tags, category, project_path } = parseResult.data;
    let validatedProject;
    try {
        validatedProject = resolveProjectPath(project_path || process.cwd());
    }
    catch (err) {
        logToolCall('memory_store', null, 'BAD_PROJECT_PATH', project_path);
        return err.message;
    }
    const entry = globalMemoryManager.store(content, {
        tags,
        category,
        projectPath: validatedProject,
    });
    logToolCall('memory_store', entry.id, 'OK', validatedProject);
    const lines = [
        `💾 [Persistent Memory Stored]`,
        `• ID: \`${entry.id}\``,
        `• Category: ${entry.category.toUpperCase()}`,
        `• Tags: ${entry.tags.length > 0 ? entry.tags.map(t => `#${t}`).join(', ') : 'none'}`,
        `• Content: "${entry.content}"`,
        `• Timestamp: ${entry.createdAt}`,
        '',
        `This insight is now permanently preserved in .agent/memories.json across sessions.`,
    ];
    return lines.join('\n');
}
export function handleMemoryRecall(rawArgs) {
    const parseResult = MemoryRecallSchema.safeParse(rawArgs);
    if (!parseResult.success) {
        const err = formatZodError(parseResult.error);
        logToolCall('memory_recall', null, 'BAD_INPUT', rawArgs?.project_path);
        return err;
    }
    const { query, limit, tag, category, project_path } = parseResult.data;
    let validatedProject;
    try {
        validatedProject = resolveProjectPath(project_path || process.cwd());
    }
    catch (err) {
        logToolCall('memory_recall', null, 'BAD_PROJECT_PATH', project_path);
        return err.message;
    }
    const result = globalMemoryManager.recall(query, {
        limit,
        tag,
        category,
        projectPath: validatedProject,
    });
    logToolCall('memory_recall', query, `FOUND_${result.memories.length}`, validatedProject);
    if (result.memories.length === 0) {
        return [
            `🔍 No memories found matching: "${query}".`,
            '',
            `Tip: Use \`memory_store\` to save architectural choices, bug fixes, or key patterns.`,
        ].join('\n');
    }
    const lines = [
        `🧠 [Memory Recall] Found ${result.totalFound} matching ${result.totalFound === 1 ? 'memory' : 'memories'} for "${query}":`,
        '',
    ];
    for (let i = 0; i < result.memories.length; i++) {
        const m = result.memories[i];
        const tagStr = m.tags.length > 0 ? ` [${m.tags.join(', ')}]` : '';
        lines.push(`${i + 1}. **[${m.category.toUpperCase()}]** ${m.content}${tagStr}`);
        lines.push(`   *(Saved ${new Date(m.createdAt).toLocaleDateString()} • ID: \`${m.id}\`)*`);
        lines.push('');
    }
    return lines.join('\n').trim();
}
//# sourceMappingURL=memory.js.map