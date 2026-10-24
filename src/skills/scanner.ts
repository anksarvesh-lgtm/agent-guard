import fs from 'node:fs';
import path from 'node:path';
import { globalJitSkillRouter, SkillRouteResult } from './router.js';
import { resolveProjectPath } from '../util/paths.js';

export interface TechDetection {
  name: string;
  category: 'frontend' | 'backend' | 'database' | 'devops' | 'testing' | 'ai' | 'language';
  sourceFile: string;
}

export interface WorkspaceScanResult {
  workspace: string;
  detectedTech: TechDetection[];
  recommendedSkills: SkillRouteResult[];
  savedConfigPath?: string;
}

export class WorkspaceScanner {
  private static instance: WorkspaceScanner | null = null;

  public static getInstance(): WorkspaceScanner {
    if (!WorkspaceScanner.instance) {
      WorkspaceScanner.instance = new WorkspaceScanner();
    }
    return WorkspaceScanner.instance;
  }

  /**
   * Scans a workspace directory for technologies, frameworks, and tools.
   */
  public scan(workspacePath: string, options?: { maxSkills?: number; saveConfig?: boolean }): WorkspaceScanResult {
    const root = resolveProjectPath(workspacePath);
    const detected: TechDetection[] = [];

    // 1. Scan package.json (Node/JS/TS)
    const pkgPath = path.join(root, 'package.json');
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
        const allDeps = {
          ...(pkg.dependencies || {}),
          ...(pkg.devDependencies || {}),
          ...(pkg.peerDependencies || {}),
        };

        const depMap: Record<string, { cat: TechDetection['category']; name: string }> = {
          react: { cat: 'frontend', name: 'React' },
          next: { cat: 'frontend', name: 'Next.js' },
          vue: { cat: 'frontend', name: 'Vue' },
          svelte: { cat: 'frontend', name: 'Svelte' },
          express: { cat: 'backend', name: 'Express' },
          fastify: { cat: 'backend', name: 'Fastify' },
          '@nestjs/core': { cat: 'backend', name: 'NestJS' },
          tailwindcss: { cat: 'frontend', name: 'Tailwind CSS' },
          prisma: { cat: 'database', name: 'Prisma ORM' },
          '@prisma/client': { cat: 'database', name: 'Prisma ORM' },
          typeorm: { cat: 'database', name: 'TypeORM' },
          mongoose: { cat: 'database', name: 'Mongoose / MongoDB' },
          vitest: { cat: 'testing', name: 'Vitest' },
          jest: { cat: 'testing', name: 'Jest' },
          playwright: { cat: 'testing', name: 'Playwright' },
          '@playwright/test': { cat: 'testing', name: 'Playwright' },
          cypress: { cat: 'testing', name: 'Cypress' },
          typescript: { cat: 'language', name: 'TypeScript' },
          graphql: { cat: 'backend', name: 'GraphQL' },
        };

        for (const [dep, meta] of Object.entries(depMap)) {
          if (allDeps[dep]) {
            detected.push({ name: meta.name, category: meta.cat, sourceFile: 'package.json' });
          }
        }
      } catch {}
    }

    // 2. Scan Python configs
    const reqPath = path.join(root, 'requirements.txt');
    const pyprojectPath = path.join(root, 'pyproject.toml');
    const pipfilePath = path.join(root, 'Pipfile');
    let pyContent = '';
    let pyFile = '';

    if (fs.existsSync(pyprojectPath)) {
      pyContent += fs.readFileSync(pyprojectPath, 'utf-8') + '\n';
      pyFile = 'pyproject.toml';
    }
    if (fs.existsSync(reqPath)) {
      pyContent += fs.readFileSync(reqPath, 'utf-8') + '\n';
      pyFile = pyFile || 'requirements.txt';
    }
    if (fs.existsSync(pipfilePath)) {
      pyContent += fs.readFileSync(pipfilePath, 'utf-8') + '\n';
      pyFile = pyFile || 'Pipfile';
    }

    if (pyContent) {
      const lowerPy = pyContent.toLowerCase();
      if (lowerPy.includes('fastapi')) detected.push({ name: 'FastAPI', category: 'backend', sourceFile: pyFile });
      if (lowerPy.includes('django')) detected.push({ name: 'Django', category: 'backend', sourceFile: pyFile });
      if (lowerPy.includes('flask')) detected.push({ name: 'Flask', category: 'backend', sourceFile: pyFile });
      if (lowerPy.includes('pytest')) detected.push({ name: 'Pytest', category: 'testing', sourceFile: pyFile });
      if (lowerPy.includes('torch') || lowerPy.includes('pytorch')) detected.push({ name: 'PyTorch', category: 'ai', sourceFile: pyFile });
      if (lowerPy.includes('langchain')) detected.push({ name: 'LangChain', category: 'ai', sourceFile: pyFile });
      if (lowerPy.includes('sqlalchemy')) detected.push({ name: 'SQLAlchemy', category: 'database', sourceFile: pyFile });
      if (lowerPy.includes('pandas')) detected.push({ name: 'Pandas', category: 'ai', sourceFile: pyFile });
    }

    // 3. Scan Go
    const goModPath = path.join(root, 'go.mod');
    if (fs.existsSync(goModPath)) {
      detected.push({ name: 'Go', category: 'language', sourceFile: 'go.mod' });
      const goContent = fs.readFileSync(goModPath, 'utf-8').toLowerCase();
      if (goContent.includes('gin-gonic/gin')) detected.push({ name: 'Gin', category: 'backend', sourceFile: 'go.mod' });
      if (goContent.includes('gorm.io/gorm')) detected.push({ name: 'GORM', category: 'database', sourceFile: 'go.mod' });
    }

    // 4. Scan Rust
    const cargoPath = path.join(root, 'Cargo.toml');
    if (fs.existsSync(cargoPath)) {
      detected.push({ name: 'Rust', category: 'language', sourceFile: 'Cargo.toml' });
      const cargoContent = fs.readFileSync(cargoPath, 'utf-8').toLowerCase();
      if (cargoContent.includes('actix-web')) detected.push({ name: 'Actix Web', category: 'backend', sourceFile: 'Cargo.toml' });
      if (cargoContent.includes('tokio')) detected.push({ name: 'Tokio Async', category: 'backend', sourceFile: 'Cargo.toml' });
    }

    // 5. Scan Infrastructure & DevOps
    if (fs.existsSync(path.join(root, 'Dockerfile')) || fs.existsSync(path.join(root, 'docker-compose.yml')) || fs.existsSync(path.join(root, 'compose.yaml'))) {
      detected.push({ name: 'Docker / Containers', category: 'devops', sourceFile: 'Dockerfile' });
    }
    if (fs.existsSync(path.join(root, 'k8s')) || fs.existsSync(path.join(root, 'kubernetes')) || fs.existsSync(path.join(root, 'helm'))) {
      detected.push({ name: 'Kubernetes', category: 'devops', sourceFile: 'k8s' });
    }
    if (fs.existsSync(path.join(root, '.github', 'workflows'))) {
      detected.push({ name: 'GitHub Actions CI/CD', category: 'devops', sourceFile: '.github/workflows' });
    }

    // Deduplicate detections by name
    const uniqueTech = new Map<string, TechDetection>();
    for (const d of detected) {
      if (!uniqueTech.has(d.name)) {
        uniqueTech.set(d.name, d);
      }
    }
    const detectedList = Array.from(uniqueTech.values());

    // 6. Route to matching skills from 3,600+ library
    const maxSkills = options?.maxSkills || 12;
    const queryParts = detectedList.map((d) => `${d.name} ${d.category}`);
    const searchTerms = [
      ...detectedList.map(d => d.name.toLowerCase()),
      'clean architecture',
      'test-driven development',
      'devops automation',
      'security audit',
    ];

    const recommendedMap = new Map<string, SkillRouteResult>();

    // Route specific detected tech
    for (const tech of detectedList) {
      const results = globalJitSkillRouter.route(tech.name, { limit: 2, minScore: 0.3 });
      for (const res of results) {
        if (!recommendedMap.has(res.id)) {
          recommendedMap.set(res.id, res);
        }
      }
    }

    // Route overall query
    if (queryParts.length > 0) {
      const broadResults = globalJitSkillRouter.route(queryParts.join(' '), { limit: 8, minScore: 0.2 });
      for (const res of broadResults) {
        if (!recommendedMap.has(res.id)) {
          recommendedMap.set(res.id, res);
        }
      }
    }

    const recommendedList = Array.from(recommendedMap.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, maxSkills);

    let savedPath: string | undefined;

    // 7. Auto-save to workspace .agents/skills.json if requested
    if (options?.saveConfig) {
      try {
        const agentsDir = path.join(root, '.agents');
        if (!fs.existsSync(agentsDir)) {
          fs.mkdirSync(agentsDir, { recursive: true });
        }
        const skillsConfigPath = path.join(agentsDir, 'skills.json');
        let currentConfig: any = { skills: [] };
        if (fs.existsSync(skillsConfigPath)) {
          try {
            currentConfig = JSON.parse(fs.readFileSync(skillsConfigPath, 'utf-8'));
            if (!Array.isArray(currentConfig.skills)) currentConfig.skills = [];
          } catch {}
        }

        const existingSkillIds = new Set(currentConfig.skills.map((s: any) => s.id));
        for (const rec of recommendedList) {
          if (!existingSkillIds.has(rec.id)) {
            currentConfig.skills.push({
              id: rec.id,
              name: rec.name,
              category: rec.category,
              tier: rec.tier,
              auto_activated: true,
              added_at: new Date().toISOString(),
            });
            existingSkillIds.add(rec.id);
          }
        }

        fs.writeFileSync(skillsConfigPath, JSON.stringify(currentConfig, null, 2) + '\n', 'utf-8');
        savedPath = skillsConfigPath;
      } catch {}
    }

    return {
      workspace: root,
      detectedTech: detectedList,
      recommendedSkills: recommendedList,
      savedConfigPath: savedPath,
    };
  }
}

export const globalWorkspaceScanner = WorkspaceScanner.getInstance();
