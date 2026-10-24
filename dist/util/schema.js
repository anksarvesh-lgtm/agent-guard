import { z } from 'zod';
export function truncateText(text, maxLength) {
    if (text.length <= maxLength) {
        return text;
    }
    const cutoff = Math.max(0, maxLength - 5);
    return text.slice(0, cutoff) + '[cut]';
}
export const StepInputSchema = z.object({
    title: z
        .string()
        .min(1, 'Step title cannot be empty')
        .transform((val) => truncateText(val, 200)),
    depends_on: z.array(z.string()).optional().default([]),
});
export const TaskStartSchema = z.object({
    goal: z
        .string()
        .min(1, 'Goal cannot be empty')
        .transform((val) => truncateText(val, 500)),
    steps: z
        .array(StepInputSchema)
        .min(1, 'Must provide at least one step')
        .max(30, 'Cannot exceed 30 steps'),
    max_tries: z.number().int().min(1).max(5).optional().default(3),
    replace: z.boolean().optional().default(false),
    project_path: z.string().optional(),
});
export const TaskCheckpointSchema = z.object({
    step_id: z.string().min(1, 'step_id is required'),
    status: z.enum(['in_progress', 'done', 'failed']),
    note: z
        .string()
        .min(1, 'note is required')
        .transform((val) => truncateText(val, 500)),
    error: z
        .string()
        .optional()
        .transform((val) => (val ? truncateText(val, 500) : undefined)),
    add_steps: z.array(StepInputSchema).optional(),
    project_path: z.string().optional(),
});
export const TaskStatusSchema = z.object({
    project_path: z.string().optional(),
});
export const KeepAwakeSchema = z.object({
    action: z.enum(['hold', 'release', 'status']),
    minutes: z.number().int().min(1).max(240).optional(),
    reason: z.string().optional(),
    project_path: z.string().optional(),
});
export const RepoBriefSchema = z.object({
    refresh: z.boolean().optional().default(false),
    project_path: z.string().optional(),
});
export const TokenCounterSchema = z.object({
    model: z.string().optional().default('gemini-1.5-pro'),
    text: z.string().optional(),
    file_path: z.string().optional(),
    transcript_path: z.string().optional(),
    compare_all: z.boolean().optional().default(true),
    project_path: z.string().optional(),
});
export const AccountSwitcherSchema = z.object({
    action: z.enum(['status', 'switch', 'list', 'add', 'snapshot', 'remove', 'auto_rotate', 'configure', 'proxy', 'failover_proxy']),
    account_id: z.string().optional(),
    name: z.string().optional(),
    provider: z.enum(['antigravity', 'gemini', 'claude', 'openai', 'custom']).optional().default('antigravity'),
    token_content: z.string().optional(),
    token_source_file: z.string().optional(),
    api_key: z.string().optional(),
    threshold_percent: z.number().min(0.1).max(50).optional().default(1.0),
    enabled: z.boolean().optional(),
    reason: z.string().optional(),
    project_path: z.string().optional(),
});
/**
 * Formats Zod errors into a clean, human-readable BAD_INPUT error string
 */
export function formatZodError(error) {
    const issues = error.issues.map((i) => {
        const pathStr = i.path.length > 0 ? i.path.join('.') : 'root';
        return `${pathStr}: ${i.message}`;
    });
    return `BAD_INPUT: ${issues.join('; ')}`;
}
//# sourceMappingURL=schema.js.map