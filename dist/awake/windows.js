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
        proc.on('error', () => {
            // Helper failed
        });
        return { process: proc };
    }
    stop(proc) {
        try {
            if (proc && !proc.killed && proc.pid) {
                proc.kill('SIGTERM');
                setTimeout(() => {
                    try {
                        if (!proc.killed && proc.exitCode === null && proc.pid) {
                            proc.kill('SIGKILL');
                        }
                    }
                    catch { }
                }, 500).unref();
            }
        }
        catch {
            // Ignore
        }
    }
}
//# sourceMappingURL=windows.js.map