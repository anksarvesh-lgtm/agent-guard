import fs from 'node:fs';
import path from 'node:path';
import { getLogPath } from './paths.js';

const MAX_LOG_SIZE_BYTES = 1024 * 1024; // 1 MB

/**
 * Appends a single line to `<project>/.agent/log.txt`:
 * Format: ISO_TIMESTAMP [TOOL] [STEP_ID] [RESULT_CODE]
 * Strictly avoids logging goal, prompt, notes, or secret values.
 * Rotates to log.1.txt if file exceeds 1 MB.
 */
export function logToolCall(
  toolName: string,
  stepId: string | undefined | null,
  resultCode: string,
  projectPath?: string
): void {
  try {
    const logFile = getLogPath(projectPath);
    if (fs.existsSync(logFile)) {
      const stats = fs.statSync(logFile);
      if (stats.size >= MAX_LOG_SIZE_BYTES) {
        const rotatedFile = path.join(path.dirname(logFile), 'log.1.txt');
        try {
          if (fs.existsSync(rotatedFile)) {
            fs.unlinkSync(rotatedFile);
          }
          fs.renameSync(logFile, rotatedFile);
        } catch {
          // Ignore rotation error, file will just be appended
        }
      }
    }

    const timestamp = new Date().toISOString();
    const cleanStep = stepId && stepId.trim() !== '' ? stepId.trim() : '-';
    const cleanResult = resultCode.trim();
    const line = `${timestamp} [${toolName}] [${cleanStep}] [${cleanResult}]\n`;

    fs.appendFileSync(logFile, line, 'utf-8');
  } catch (err) {
    // Logging failure must never break execution
  }
}
