import { spawn } from 'node:child_process';
export class WindowsSleepInhibitor {
    isSupported() {
        return process.platform === 'win32';
    }
    start(seconds) {
        // Continuous (0x80000000) | System Required (0x00000001) | Display Required (0x00000002)
        const psScript = `
      $code = @'
      [DllImport("kernel32.dll", CharSet = CharSet.Auto, SetLastError = true)]
      public static extern uint SetThreadExecutionState(uint esFlags);
'@
      $type = Add-Type -MemberDefinition $code -Name "Win32Power" -Namespace "AgentGuard" -PassThru
      $type::SetThreadExecutionState(0x80000003)
      Start-Sleep -Seconds ${seconds}
    `;
        const proc = spawn('powershell', ['-NoProfile', '-NonInteractive', '-Command', psScript], {
            stdio: 'ignore',
            detached: false,
        });
        return { process: proc };
    }
    stop(proc) {
        try {
            if (proc && !proc.killed) {
                proc.kill('SIGTERM');
            }
        }
        catch {
            // Ignore
        }
    }
}
//# sourceMappingURL=windows.js.map