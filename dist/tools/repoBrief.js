import fs from 'node:fs';
import { RepoBriefSchema, formatZodError } from '../util/schema.js';
import { resolveProjectPath, getBriefPath } from '../util/paths.js';
import { buildRepoBrief } from '../brief/build.js';
import { getProjectFreshness, parseBriefHeader } from '../brief/stale.js';
import { logToolCall } from '../util/log.js';
export function handleRepoBrief(rawArgs) {
    const parseResult = RepoBriefSchema.safeParse(rawArgs);
    if (!parseResult.success) {
        const err = formatZodError(parseResult.error);
        logToolCall('repo_brief', null, 'BAD_INPUT', rawArgs?.project_path);
        return err;
    }
    const { refresh, project_path } = parseResult.data;
    let validatedProject;
    try {
        validatedProject = resolveProjectPath(project_path);
    }
    catch (err) {
        logToolCall('repo_brief', null, 'BAD_PROJECT_PATH', project_path);
        return err.message;
    }
    const briefPath = getBriefPath(validatedProject);
    const exists = fs.existsSync(briefPath);
    if (refresh || !exists) {
        const newBrief = buildRepoBrief(validatedProject);
        logToolCall('repo_brief', null, 'REBUILT', validatedProject);
        return `BRIEF: FRESH\n\n${newBrief}`;
    }
    // Brief exists and refresh wasn't explicitly requested
    try {
        const cached = fs.readFileSync(briefPath, 'utf-8');
        const header = parseBriefHeader(cached);
        const freshness = getProjectFreshness(validatedProject);
        if (header && header.commit === freshness.commit && header.hash === freshness.filesHash) {
            logToolCall('repo_brief', null, 'CACHED', validatedProject);
            return `BRIEF: UP TO DATE\n\n${cached}`;
        }
        // It's out of date
        if (freshness.fileCount < 5000) {
            const rebuilt = buildRepoBrief(validatedProject, freshness);
            logToolCall('repo_brief', null, 'AUTO_REBUILT', validatedProject);
            return `BRIEF: REBUILT (detected commit change to ${freshness.commit})\n\n${rebuilt}`;
        }
        // Over 5,000 files: return cached with notice
        logToolCall('repo_brief', null, 'OUT_OF_DATE', validatedProject);
        return `BRIEF: OUT OF DATE (built at ${header?.commit || 'unknown'}, now ${freshness.commit}). Project has ${freshness.fileCount} files; pass refresh: true to rebuild.\n\n${cached}`;
    }
    catch (err) {
        // If reading cached fails, rebuild
        const fallback = buildRepoBrief(validatedProject);
        logToolCall('repo_brief', null, 'FALLBACK_BUILD', validatedProject);
        return `BRIEF: REBUILT\n\n${fallback}`;
    }
}
//# sourceMappingURL=repoBrief.js.map