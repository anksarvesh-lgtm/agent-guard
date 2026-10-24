import fs from 'node:fs';
import path from 'node:path';
import { resolveProjectPath } from '../util/paths.js';
import { buildCodeGraph } from './codeGraph.js';
/**
 * Dynamically inspects project architecture, commands, and tech stack to generate
 * a tailored, context-dense AGENTS.md rulebook.
 */
export function generateAgentsMd(options = {}) {
    const projectPath = resolveProjectPath(options.projectPath);
    const projectName = path.basename(projectPath);
    const targetFile = options.outputPath || path.join(projectPath, 'AGENTS.md');
    // Detect tech stack and package scripts
    const techStack = [];
    const testCommands = [];
    const buildCommands = [];
    const pkgJsonPath = path.join(projectPath, 'package.json');
    let hasNode = false;
    let pkgData = null;
    if (fs.existsSync(pkgJsonPath)) {
        try {
            pkgData = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
            hasNode = true;
            techStack.push(`Node.js / TypeScript (${pkgData.name || projectName})`);
            if (pkgData.scripts) {
                if (pkgData.scripts.test)
                    testCommands.push(`npm test`);
                if (pkgData.scripts.build)
                    buildCommands.push(`npm run build`);
                if (pkgData.scripts.lint)
                    buildCommands.push(`npm run lint`);
            }
        }
        catch { }
    }
    if (fs.existsSync(path.join(projectPath, 'Cargo.toml'))) {
        techStack.push('Rust (Cargo)');
        testCommands.push('cargo test');
        buildCommands.push('cargo build');
    }
    if (fs.existsSync(path.join(projectPath, 'go.mod'))) {
        techStack.push('Go');
        testCommands.push('go test ./...');
        buildCommands.push('go build ./...');
    }
    if (fs.existsSync(path.join(projectPath, 'pyproject.toml')) || fs.existsSync(path.join(projectPath, 'requirements.txt'))) {
        techStack.push('Python');
        if (fs.existsSync(path.join(projectPath, 'pytest.ini')) || fs.existsSync(path.join(projectPath, 'tests'))) {
            testCommands.push('pytest');
        }
    }
    // Inspect source files via codeGraph
    const graph = buildCodeGraph(projectPath);
    const keyFiles = Object.keys(graph.files).slice(0, 8);
    const lines = [];
    lines.push('# Agent rules');
    lines.push('');
    lines.push('Always pass project_path (the full path of this workspace) to agent-guard tools.');
    lines.push('');
    lines.push('Start');
    lines.push('1. Call task_status. If a task is active, continue it. Do not start over.');
    lines.push('2. If none is active: call repo_brief, then task_start with a goal and 3 to 12 steps.');
    lines.push('3. Use the code-map tools to find code before opening files. Open a file only to edit it or when the map cannot answer.');
    lines.push('');
    lines.push('Work');
    lines.push('4. After every step call task_checkpoint with proof in the note (for example the test result).');
    lines.push('5. After every error call task_checkpoint with status failed and the error text. Fix the cause and retry the same step. Do not start another step while this one has tries left.');
    lines.push('6. If a step is reported blocked, write why and go on with the next allowed step.');
    lines.push('7. Do not stop while unblocked steps remain. Ask the user only about choices that change what the product does, never about things you can find out by reading code or running a test.');
    lines.push('8. Commit to git after each finished step.');
    if (hasNode && pkgData?.scripts?.bump) {
        lines[lines.length - 1] += ' Every time you push to git, always bump the version by .1 (+0.0.1 patch bump via npm run bump) before pushing.';
    }
    lines.push('');
    lines.push('Finish');
    lines.push('9. When task_status says the task is done, reply with 3 lines: what changed, what was tested, what is blocked.');
    lines.push('Never run denied commands. Never read or print secret files.');
    lines.push('');
    // Project context section
    lines.push('## Project Directives & Constraints');
    if (techStack.length > 0) {
        lines.push(`- **Environment**: ${techStack.join(', ')}`);
    }
    if (testCommands.length > 0) {
        lines.push(`- **Test Command**: \`${testCommands.join('` or `')}\``);
    }
    if (buildCommands.length > 0) {
        lines.push(`- **Build Command**: \`${buildCommands.join('` or `')}\``);
    }
    lines.push(`- **Total Code Symbols**: ${graph.totalSymbols} symbols across ${graph.fileCount} indexed files.`);
    lines.push('- **Code Navigation**: Always invoke `code_map({ action: "lookup", symbol_name: "..." })` or `code_map({ action: "slice", symbol_name: "..." })` to inspect declarations in 30-100 tokens rather than reading full files.');
    if (options.extraRules && options.extraRules.length > 0) {
        lines.push('');
        lines.push('## Additional Team Rules');
        for (const rule of options.extraRules) {
            lines.push(`- ${rule}`);
        }
    }
    const content = lines.join('\n') + '\n';
    const isNew = !fs.existsSync(targetFile);
    try {
        fs.writeFileSync(targetFile, content, 'utf-8');
    }
    catch (err) {
        throw new Error(`Failed to write AGENTS.md to ${targetFile}: ${err.message}`);
    }
    return {
        projectPath,
        outputPath: targetFile,
        content,
        isNew,
    };
}
//# sourceMappingURL=agentsMdGenerator.js.map