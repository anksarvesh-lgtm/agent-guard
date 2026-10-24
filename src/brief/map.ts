import fs from 'node:fs';
import path from 'node:path';

/**
 * Generate a clean ASCII tree representation of the project files.
 */
export function generateDirectoryTreeMap(files: string[], maxDepth: number = 2): string {
  interface TreeNode {
    name: string;
    files: string[];
    children: Record<string, TreeNode>;
  }

  const root: TreeNode = { name: '.', files: [], children: {} };

  for (const file of files) {
    const parts = file.split('/');
    let current = root;

    for (let i = 0; i < parts.length - 1; i++) {
      const dir = parts[i];
      if (!current.children[dir]) {
        current.children[dir] = { name: dir, files: [], children: {} };
      }
      current = current.children[dir];
    }
    current.files.push(parts[parts.length - 1]);
  }

  const lines: string[] = ['.'];

  function renderTree(node: TreeNode, prefix: string, depth: number): void {
    if (depth > maxDepth) return;

    const childDirKeys = Object.keys(node.children).sort();
    const isLeafLevel = depth === maxDepth;

    for (let i = 0; i < childDirKeys.length; i++) {
      const dirName = childDirKeys[i];
      const child = node.children[dirName];
      const isLastDir = i === childDirKeys.length - 1 && (isLeafLevel || node.files.length === 0);
      const connector = isLastDir ? '└── ' : '├── ';
      const nextPrefix = prefix + (isLastDir ? '    ' : '│   ');

      const totalFiles = countNodeFiles(child);
      lines.push(`${prefix}${connector}${dirName}/ (${totalFiles} file${totalFiles === 1 ? '' : 's'})`);

      if (!isLeafLevel) {
        renderTree(child, nextPrefix, depth + 1);
      }
    }

    // Render direct files at root or leaf if reasonable
    if (node === root) {
      const topFiles = node.files.slice(0, 15);
      for (let i = 0; i < topFiles.length; i++) {
        const isLast = i === topFiles.length - 1;
        lines.push(`${prefix}${isLast ? '└── ' : '├── '}${topFiles[i]}`);
      }
      if (node.files.length > 15) {
        lines.push(`${prefix}    ... (+${node.files.length - 15} more root files)`);
      }
    }
  }

  function countNodeFiles(node: TreeNode): number {
    let count = node.files.length;
    for (const child of Object.values(node.children)) {
      count += countNodeFiles(child);
    }
    return count;
  }

  renderTree(root, '', 1);
  return lines.join('\n');
}

/**
 * Generate a Mermaid architecture diagram tailored to the project.
 */
export function generateArchitectureChart(projectPath: string, files: string[]): string {
  const pkgPath = path.join(projectPath, 'package.json');
  let isAgentGuard = false;

  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      if (pkg.name === 'agent-guard') isAgentGuard = true;
    } catch {}
  }

  if (isAgentGuard) {
    return [
      '```mermaid',
      'flowchart TD',
      '  Client["AI IDE / Coding Assistant\\n(Antigravity | Cursor | Claude | Zed)"]',
      '  CLI["CLI & Diagnostics\\n(src/cli.ts)"]',
      '  Server["Agent Guard MCP Server\\n(src/index.ts)"]',
      '  Tools["5 Core MCP Tools\\n(task_start | checkpoint | status | awake | brief)"]',
      '  Ledger["Atomic Ledger Engine\\n(src/ledger.ts)"]',
      '  Awake["OS Sleep Inhibitor\\n(caffeinate / Win / Linux)"]',
      '  Brief["Repo Map & Chart Generator\\n(src/brief/)"]',
      '  Update["Auto-Update Engine\\n(src/update.ts)"]',
      '  Hook["Antigravity Stop Hook\\n(src/hook/stop-hook.js)"]',
      '  Storage[(".agent/ledger.json")]',
      '',
      '  Client -->|MCP stdio| Server',
      '  Client -->|Terminal Commands| CLI',
      '  Server --> Tools',
      '  Tools -->|Plan & Checkpoint| Ledger',
      '  Tools -->|Hold/Release Lease| Awake',
      '  Tools -->|Code Map & Overview| Brief',
      '  CLI -->|Self-Update| Update',
      '  Ledger --> Storage',
      '  Hook -->|Blocks exit while steps active| Ledger',
      '```'
    ].join('\n');
  }

  // Generic project diagram based on directory structure
  const topDirs = new Set(files.map((f) => f.split('/')[0]).filter(Boolean));
  const nodes: string[] = [];
  const edges: string[] = [];

  nodes.push('  App["Application Root"]');

  if (topDirs.has('src')) {
    nodes.push('  Src["Core Source (src/)"]');
    edges.push('  App --> Src');
  }
  if (topDirs.has('test') || topDirs.has('tests') || topDirs.has('__tests__')) {
    nodes.push('  Tests["Test Suites (test/)"]');
    edges.push('  Src -.->|Validated By| Tests');
  }
  if (topDirs.has('api') || topDirs.has('server')) {
    nodes.push('  API["API / Backend Services"]');
    edges.push('  Src --> API');
  }
  if (topDirs.has('components') || topDirs.has('ui') || topDirs.has('views')) {
    nodes.push('  UI["UI / Components"]');
    edges.push('  Src --> UI');
  }
  if (topDirs.has('docs')) {
    nodes.push('  Docs["Documentation (docs/)"]');
    edges.push('  App -.-> Docs');
  }

  if (edges.length === 0) {
    edges.push('  App --> Modules["Project Modules"]');
  }

  return [
    '```mermaid',
    'graph TD',
    ...nodes,
    ...edges,
    '```'
  ].join('\n');
}

/**
 * Generate a complete project map markdown document.
 */
export function generateFullProjectMap(projectPath: string, files: string[]): string {
  const projectName = path.basename(projectPath);
  const treeMap = generateDirectoryTreeMap(files, 2);
  const chart = generateArchitectureChart(projectPath, files);

  return [
    `# Project Map & Architecture: ${projectName}`,
    `Generated on: ${new Date().toISOString()} | Total Tracked Files: ${files.length}\n`,
    `## Architecture Flowchart`,
    chart,
    '',
    `## Directory Structure Map`,
    '```text',
    treeMap,
    '```',
    ''
  ].join('\n');
}
