# Security Policy

## Supported Versions

| Version | Supported          |
| :---    | :---               |
| 0.1.x   | :white_check_mark: |

---

## Security Guarantees & Isolation Boundaries

Agent Guard is designed for safe local pair programming with AI agents. Its security model includes:

1. **Strict Path Sandboxing**:
   - Jails all writes to `<project>/.agent/`.
   - Never writes or modifies files in the user home directory (`~`), filesystem root (`/`), or system directories (`/System`, `/usr`, `/bin`, `C:\Windows`, etc.).
   - Refuses paths that do not possess a `.git` or `.agent` directory.

2. **Secret Filtering & Redaction**:
   - `repo_brief` strictly filters out `.env*`, `*.pem`, `*.key`, `id_rsa`, `credentials`, `secrets`, and files under 20 bytes resembling tokens.
   - Logs to `.agent/log.txt` record only tool timestamps, step IDs, and result codes — never prompts, notes, or code contents.

3. **Safe Command Execution**:
   - Agent Guard never executes arbitrary shell commands constructed from LLM text.
   - Only fixed OS helper commands (`caffeinate`, `powershell SetThreadExecutionState`, `systemd-inhibit`) and fixed git probes (`git rev-parse HEAD`, `git ls-files`) are spawned.

---

## Reporting a Vulnerability

If you discover a security vulnerability within Agent Guard, please **do not** report it publicly through GitHub issues.

Instead, please report it via private disclosure through GitHub Security Advisories or by emailing the project maintainers directly.

Please include:
- A description of the issue and potential impact
- Steps to reproduce or proof-of-concept
- Affected versions and platforms

We appreciate your responsible disclosure and will respond promptly to investigate and patch reported vulnerabilities.
