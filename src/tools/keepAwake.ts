import { KeepAwakeSchema, formatZodError } from '../util/schema.js';
import { resolveProjectPath } from '../util/paths.js';
import { globalAwakeManager } from '../awake/manager.js';
import { logToolCall } from '../util/log.js';

export function handleKeepAwake(rawArgs: any): string {
  const parseResult = KeepAwakeSchema.safeParse(rawArgs);
  if (!parseResult.success) {
    const err = formatZodError(parseResult.error);
    logToolCall('keep_awake', null, 'BAD_INPUT', rawArgs?.project_path);
    return err;
  }

  const { action, minutes, reason, project_path } = parseResult.data;

  let validatedProject: string | undefined;
  if (project_path) {
    try {
      validatedProject = resolveProjectPath(project_path);
    } catch (err: any) {
      logToolCall('keep_awake', null, 'BAD_PROJECT_PATH', project_path);
      return err.message;
    }
  }

  try {
    if (action === 'hold') {
      const holdMinutes = minutes || 30;
      const status = globalAwakeManager.hold(holdMinutes, reason);
      logToolCall('keep_awake', null, 'HOLD_OK', validatedProject);

      const warningText = status.warning ? ` [Warning: ${status.warning}]` : '';
      return `Awake lease active: holding until ${status.heldUntil} (${status.minutesRemaining}m remaining).${warningText}`;
    }

    if (action === 'release') {
      const status = globalAwakeManager.release();
      logToolCall('keep_awake', null, 'RELEASE_OK', validatedProject);
      return 'Awake lease released. System sleep restored to normal.';
    }

    if (action === 'status') {
      const status = globalAwakeManager.status();
      logToolCall('keep_awake', null, 'STATUS_OK', validatedProject);

      if (status.isHolding) {
        const warningText = status.warning ? ` [Warning: ${status.warning}]` : '';
        return `Awake lease is ACTIVE: until ${status.heldUntil} (${status.minutesRemaining}m remaining, total ${status.totalTaskHeldMinutes}m held).${warningText}`;
      }
      return 'Awake lease is INACTIVE: normal operating system sleep policy applies.';
    }

    return 'BAD_INPUT: Unsupported action';
  } catch (err: any) {
    logToolCall('keep_awake', null, 'ERROR', validatedProject);
    return err.message;
  }
}
