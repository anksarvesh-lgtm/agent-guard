import { TaskStartSchema, formatZodError } from '../util/schema.js';
import { resolveProjectPath } from '../util/paths.js';
import { readLedger, writeLedger, archiveCurrentTask } from '../ledger.js';
import { logToolCall } from '../util/log.js';
import { globalAwakeManager } from '../awake/manager.js';
import { TaskLedger, Step } from '../types.js';

export function handleTaskStart(rawArgs: any): string {
  const parseResult = TaskStartSchema.safeParse(rawArgs);
  if (!parseResult.success) {
    const err = formatZodError(parseResult.error);
    logToolCall('task_start', null, 'BAD_INPUT', rawArgs?.project_path);
    return err;
  }

  const { goal, steps, max_tries, replace, project_path } = parseResult.data;

  let validatedProject: string;
  try {
    validatedProject = resolveProjectPath(project_path);
  } catch (err: any) {
    logToolCall('task_start', null, 'BAD_PROJECT_PATH', project_path);
    return err.message;
  }

  // Check existing active task
  const existing = readLedger(validatedProject);
  if (existing && existing.status === 'active') {
    if (!replace) {
      logToolCall('task_start', null, 'TASK_ACTIVE', validatedProject);
      return `TASK_ACTIVE: Task ${existing.task_id} is currently active. Call task_status to inspect, or pass replace: true to archive it.`;
    }
    archiveCurrentTask(validatedProject);
  }

  const now = new Date().toISOString();
  const dateStr = now.slice(0, 10).replace(/-/g, '');
  const randSuffix = Math.floor(1000 + Math.random() * 9000);
  const taskId = `t-${dateStr}-${randSuffix}`;

  const ledgerSteps: Step[] = steps.map((s, idx) => ({
    id: `s${idx + 1}`,
    title: s.title,
    status: idx === 0 ? 'in_progress' : 'pending',
    tries: 0,
    max_tries,
    depends_on: s.depends_on || [],
    note: null,
    last_error: null,
    updated_at: now,
  }));

  const ledger: TaskLedger = {
    version: 1,
    task_id: taskId,
    goal,
    status: 'active',
    created_at: now,
    updated_at: now,
    checkpoint_count: 0,
    steps: ledgerSteps,
  };

  writeLedger(ledger, validatedProject);

  // Start 30-minute awake lease
  let awakeNotice = '';
  try {
    const lease = globalAwakeManager.hold(30, `Task start: ${taskId}`);
    if (lease.warning) {
      awakeNotice = ` (Notice: ${lease.warning})`;
    }
  } catch (e: any) {
    awakeNotice = ` (Awake lease notice: ${e.message})`;
  }

  logToolCall('task_start', 's1', 'OK', validatedProject);

  const stepLines = ledgerSteps.map((s) => `- [${s.id}] (${s.status}) ${s.title}`).join('\n');
  return `Task started: ${taskId}\nGoal: ${goal}\nSteps:\n${stepLines}\n\nFirst step to do: s1 (${ledgerSteps[0].title})${awakeNotice}`;
}
