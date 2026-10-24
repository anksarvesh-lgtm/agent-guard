import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  loadSkillsIndex,
  listFeaturedSkills,
  searchSkills,
  getSkillInfo,
  getCategories,
  installSkill,
  formatSkillsTable
} from '../src/skills/manager.js';

describe('Skills Manager', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-guard-skills-test-'));
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('loads the full curated skills index with 2,700+ skills', () => {
    const skills = loadSkillsIndex();
    expect(skills.length).toBeGreaterThan(2500);

    const first = skills.find((s) => s.id === 'agent-guard');
    expect(first).toBeDefined();
    expect(first?.name).toBe('agent-guard');
    expect(first?.category).toBe('agent-orchestration');
    expect(first?.author).toContain('Sarvesh');
    expect(first?.featured).toBe(true);
  });

  it('lists featured core skills including agent-guard', () => {
    const featured = listFeaturedSkills();
    expect(featured.length).toBeGreaterThanOrEqual(5);
    const ids = featured.map((s) => s.id);
    expect(ids).toContain('agent-guard');
    expect(ids).toContain('security-audit');
    expect(ids).toContain('clean-architecture');
  });

  it('searches skills across id, description, and tags', () => {
    const securitySkills = searchSkills('security', { limit: 10 });
    expect(securitySkills.length).toBeGreaterThan(0);
    expect(securitySkills.length).toBeLessThanOrEqual(10);

    const devopsSkills = searchSkills('devops', { limit: 5 });
    expect(devopsSkills.length).toBeGreaterThan(0);

    // Case insensitivity
    const upper = searchSkills('ARCHITECT');
    const lower = searchSkills('architect');
    expect(upper.length).toBe(lower.length);
  });

  it('filters search results by category', () => {
    const filtered = searchSkills('', { category: 'security', limit: 20 });
    expect(filtered.length).toBeGreaterThan(0);
    for (const item of filtered) {
      expect(item.category.toLowerCase()).toBe('security');
    }
  });

  it('retrieves detailed skill metadata by id', () => {
    const info = getSkillInfo('ai-agents-architect');
    expect(info).not.toBeNull();
    expect(info?.id).toBe('ai-agents-architect');
    expect(info?.description).toBeTruthy();

    const notFound = getSkillInfo('non-existent-fake-skill-12345');
    expect(notFound).toBeNull();
  });

  it('aggregates skills into sorted categories', () => {
    const categories = getCategories();
    expect(categories.length).toBeGreaterThan(20);
    expect(categories[0].count).toBeGreaterThanOrEqual(categories[1].count);
    const names = categories.map((c) => c.category);
    expect(names).toContain('security');
    expect(names).toContain('devops');
  });

  it('installs curated core skill with full Agent Guard branding and supervisor directives', () => {
    const res = installSkill('clean-architecture', { targetDir: tempDir });
    expect(res.success).toBe(true);
    expect(fs.existsSync(res.destPath)).toBe(true);

    const content = fs.readFileSync(res.destPath, 'utf-8');
    expect(content).toContain('clean-architecture');
    expect(content).toContain('Sarvesh (@anksarvesh-lgtm)');
    expect(content).toContain('@agent-guard');
    expect(content).toContain('Clean Architecture & Modular Design');
  });

  it('installs non-curated skill with generated Agent Guard branded wrapper', () => {
    const res = installSkill('007', { targetDir: tempDir });
    expect(res.success).toBe(true);
    expect(fs.existsSync(res.destPath)).toBe(true);

    const content = fs.readFileSync(res.destPath, 'utf-8');
    expect(content).toContain('name: 007');
    expect(content).toContain('Sarvesh (@anksarvesh-lgtm)');
    expect(content).toContain('@agent-guard');
    expect(content).toContain('Agent Guard Supervision Rules');
  });

  it('handles unknown skill installation gracefully', () => {
    const res = installSkill('unknown-ghost-skill-999', { targetDir: tempDir });
    expect(res.success).toBe(false);
    expect(res.message).toContain('not found');
  });

  it('formats skills table cleanly for CLI presentation', () => {
    const sample = [
      {
        id: 'agent-guard',
        name: 'agent-guard',
        category: 'agent-orchestration',
        description: 'Autonomous task supervisor and keep-awake lease manager.',
        risk: 'safe'
      }
    ];
    const table = formatSkillsTable(sample);
    expect(table).toContain('agent-guard');
    expect(table).toContain('agent-orchestration');
    expect(table).toContain('safe');

    const empty = formatSkillsTable([]);
    expect(empty).toBe('No matching skills found.');
  });
});
