import fs from 'node:fs';
import path from 'node:path';
import { getAgentDir, resolveProjectPath } from './paths.js';
export function getRunningTasksPath(projectPath) {
    const root = resolveProjectPath(projectPath || process.cwd());
    return path.join(getAgentDir(root), 'running_tasks.json');
}
export function readRunningTasks(projectPath) {
    try {
        const filePath = getRunningTasksPath(projectPath);
        if (!fs.existsSync(filePath))
            return [];
        const content = fs.readFileSync(filePath, 'utf-8');
        const data = JSON.parse(content);
        return Array.isArray(data.tasks) ? data.tasks : [];
    }
    catch {
        return [];
    }
}
export function writeRunningTasks(tasks, projectPath) {
    try {
        const filePath = getRunningTasksPath(projectPath);
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        const data = {
            version: 1,
            tasks,
        };
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    }
    catch { }
}
export function registerRunningTask(taskInput, projectPath) {
    const tasks = readRunningTasks(projectPath);
    const now = new Date().toISOString();
    const rand = Math.floor(1000 + Math.random() * 9000);
    const type = taskInput.type || 'custom';
    const id = `${type}-${Date.now().toString(36)}-${rand}`;
    const newTask = {
        id,
        name: taskInput.name,
        type,
        status: 'in_progress',
        current_phase: taskInput.current_phase,
        details: taskInput.details,
        progress_percent: taskInput.progress_percent ?? 0,
        pid: taskInput.pid,
        log_file: taskInput.log_file,
        started_at: now,
        updated_at: now,
    };
    tasks.unshift(newTask);
    // Keep up to 20 most recent
    writeRunningTasks(tasks.slice(0, 20), projectPath);
    return newTask;
}
export function updateRunningTask(taskId, updates, projectPath) {
    const tasks = readRunningTasks(projectPath);
    const idx = tasks.findIndex((t) => t.id === taskId);
    if (idx === -1)
        return null;
    tasks[idx] = {
        ...tasks[idx],
        ...updates,
        updated_at: new Date().toISOString(),
    };
    writeRunningTasks(tasks, projectPath);
    return tasks[idx];
}
export function completeRunningTask(taskId, result, projectPath) {
    const tasks = readRunningTasks(projectPath);
    const idx = tasks.findIndex((t) => t.id === taskId);
    if (idx === -1)
        return false;
    const success = result?.success !== false;
    tasks[idx].status = success ? 'completed' : 'failed';
    tasks[idx].progress_percent = success ? 100 : tasks[idx].progress_percent;
    if (result?.note)
        tasks[idx].details = result.note;
    if (result?.error)
        tasks[idx].error = result.error;
    tasks[idx].updated_at = new Date().toISOString();
    writeRunningTasks(tasks, projectPath);
    return true;
}
//# sourceMappingURL=taskRegistry.js.map