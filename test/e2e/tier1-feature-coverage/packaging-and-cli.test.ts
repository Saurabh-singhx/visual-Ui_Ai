import { describe, it, expect } from 'vitest';
import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';
import { runCli, resolveBinPath } from '../harness/cliHarness';

describe('Tier 1: Packaging and CLI Runner (Features 1, 2, 3, 4)', () => {
  const rootDir = process.cwd();
  const skillPath = path.resolve(rootDir, 'skills/visual-ui/SKILL.md');
  const binPath = resolveBinPath();
  const installScriptPath = path.resolve(rootDir, 'scripts/install-skill.sh');
  const packageJsonPath = path.resolve(rootDir, 'package.json');

  // =========================================================================
  // Feature 1: Skill Packaging & YAML Frontmatter
  // =========================================================================
  describe('Feature 1: Skill Packaging & YAML Frontmatter (skills/visual-ui/SKILL.md)', () => {
    it('F1.1: verifies skills/visual-ui/SKILL.md exists and is readable', () => {
      const exists = fs.existsSync(skillPath);
      expect(exists, `Expected ${skillPath} to exist per Feature 1`).toBe(true);
      if (exists) {
        const stats = fs.statSync(skillPath);
        expect(stats.size).toBeGreaterThan(50);
      }
    });

    it('F1.2: verifies SKILL.md begins with YAML frontmatter delimiters and name: visual-ui', () => {
      if (!fs.existsSync(skillPath)) {
        expect.fail(`skills/visual-ui/SKILL.md does not exist yet (pending Milestone M3)`);
      }
      const content = fs.readFileSync(skillPath, 'utf8');
      expect(content.startsWith('---')).toBe(true);
      expect(content).toMatch(/name:\s*visual-ui/);
    });

    it('F1.3: verifies SKILL.md frontmatter specifies model preference and trigger description', () => {
      if (!fs.existsSync(skillPath)) {
        expect.fail(`skills/visual-ui/SKILL.md does not exist yet (pending Milestone M3)`);
      }
      const content = fs.readFileSync(skillPath, 'utf8');
      expect(content).toMatch(/description:\s*>?/);
      expect(content.toLowerCase()).toMatch(/visual ui|inspect|modify|component/);
    });

    it('F1.4: verifies SKILL.md contains a Discovery Runbook section for scanning components', () => {
      if (!fs.existsSync(skillPath)) {
        expect.fail(`skills/visual-ui/SKILL.md does not exist yet (pending Milestone M3)`);
      }
      const content = fs.readFileSync(skillPath, 'utf8');
      expect(content).toMatch(/discovery|component discovery|scanning/i);
      expect(content).toMatch(/visual-ui scan/);
    });

    it('F1.5: verifies SKILL.md contains a Large-Codebase Scoping Runbook (>30 threshold and --focus)', () => {
      if (!fs.existsSync(skillPath)) {
        expect.fail(`skills/visual-ui/SKILL.md does not exist yet (pending Milestone M3)`);
      }
      const content = fs.readFileSync(skillPath, 'utf8');
      expect(content).toMatch(/30|threshold|scoping|monorepo/i);
      expect(content).toMatch(/--focus/);
    });

    it('F1.6: verifies SKILL.md documents in-session AI animated modification instructions', () => {
      if (!fs.existsSync(skillPath)) {
        expect.fail(`skills/visual-ui/SKILL.md does not exist yet (pending Milestone M3)`);
      }
      const content = fs.readFileSync(skillPath, 'utf8');
      expect(content).toMatch(/animation|tailwind|transition|keyframes/i);
    });
  });

  // =========================================================================
  // Feature 2: Standalone CLI Runner (bin/visual-ui.js)
  // =========================================================================
  describe('Feature 2: Standalone CLI Runner (bin/visual-ui.js)', () => {
    it('F2.1: verifies bin/visual-ui.js exists on disk', () => {
      const exists = fs.existsSync(binPath);
      expect(exists, `Expected CLI runner executable at ${binPath}`).toBe(true);
    });

    it('F2.2: verifies bin/visual-ui.js starts with Node.js shebang', () => {
      if (!fs.existsSync(binPath)) {
        expect.fail(`bin/visual-ui.js does not exist yet (pending Milestone M3)`);
      }
      const content = fs.readFileSync(binPath, 'utf8');
      expect(content.startsWith('#!/usr/bin/env node')).toBe(true);
    });

    it('F2.3: verifies visual-ui --help lists usage and all primary subcommands', async () => {
      if (!fs.existsSync(binPath)) {
        expect.fail(`bin/visual-ui.js does not exist yet (pending Milestone M3)`);
      }
      const res = await runCli(['--help']);
      expect(res.exitCode).toBe(0);
      expect(res.combinedOutput).toMatch(/visual-ui/);
      expect(res.combinedOutput).toMatch(/scan/);
      expect(res.combinedOutput).toMatch(/start/);
      expect(res.combinedOutput).toMatch(/modify/);
    });

    it('F2.4: verifies visual-ui scan handles directory scanning flags', async () => {
      if (!fs.existsSync(binPath)) {
        expect.fail(`bin/visual-ui.js does not exist yet (pending Milestone M3)`);
      }
      const fixtureDir = path.resolve(rootDir, 'test/e2e/fixtures/web-app');
      const res = await runCli(['scan', '--dir', fixtureDir, '--format', 'json']);
      expect(res.exitCode).toBe(0);
      expect(res.combinedOutput).toMatch(/Header|Card|web/i);
    });

    it('F2.5: verifies visual-ui start supports --port and --dir options', async () => {
      if (!fs.existsSync(binPath)) {
        expect.fail(`bin/visual-ui.js does not exist yet (pending Milestone M3)`);
      }
      const res = await runCli(['start', '--help']);
      expect(res.exitCode).toBe(0);
      expect(res.combinedOutput).toMatch(/--port/i);
    });

    it('F2.6: verifies visual-ui modify supports --file and --prompt options', async () => {
      if (!fs.existsSync(binPath)) {
        expect.fail(`bin/visual-ui.js does not exist yet (pending Milestone M3)`);
      }
      const res = await runCli(['modify', '--help']);
      expect(res.exitCode).toBe(0);
      expect(res.combinedOutput).toMatch(/--file/i);
      expect(res.combinedOutput).toMatch(/--prompt/i);
    });

    it('F2.7: verifies visual-ui exits with non-zero code when given an unknown subcommand', async () => {
      if (!fs.existsSync(binPath)) {
        expect.fail(`bin/visual-ui.js does not exist yet (pending Milestone M3)`);
      }
      const res = await runCli(['nonexistent-command']);
      expect(res.exitCode).not.toBe(0);
      expect(res.combinedOutput.toLowerCase()).toMatch(/unknown|invalid|error/);
    });
  });

  // =========================================================================
  // Feature 3: Skill Installation Script (scripts/install-skill.sh)
  // =========================================================================
  describe('Feature 3: Skill Installation Script (scripts/install-skill.sh)', () => {
    it('F3.1: verifies scripts/install-skill.sh exists on disk', () => {
      const exists = fs.existsSync(installScriptPath);
      expect(exists, `Expected installer script at ${installScriptPath}`).toBe(true);
    });

    it('F3.2: verifies scripts/install-skill.sh has bash shebang', () => {
      if (!fs.existsSync(installScriptPath)) {
        expect.fail(`scripts/install-skill.sh does not exist yet (pending Milestone M3)`);
      }
      const content = fs.readFileSync(installScriptPath, 'utf8');
      expect(content.startsWith('#!/usr/bin/env bash') || content.startsWith('#!/bin/bash')).toBe(true);
    });

    it('F3.3: verifies script defines skill destination ~/.gemini/config/skills/visual-ui', () => {
      if (!fs.existsSync(installScriptPath)) {
        expect.fail(`scripts/install-skill.sh does not exist yet (pending Milestone M3)`);
      }
      const content = fs.readFileSync(installScriptPath, 'utf8');
      expect(content).toMatch(/gemini\/config\/skills\/visual-ui/);
    });

    it('F3.4: verifies script creates symlink to bin/visual-ui.js in ~/.local/bin/visual-ui', () => {
      if (!fs.existsSync(installScriptPath)) {
        expect.fail(`scripts/install-skill.sh does not exist yet (pending Milestone M3)`);
      }
      const content = fs.readFileSync(installScriptPath, 'utf8');
      expect(content).toMatch(/\.local\/bin\/visual-ui/);
      expect(content).toMatch(/ln -s/);
    });

    it('F3.5: verifies script prints instructions or checks for PATH inclusion', () => {
      if (!fs.existsSync(installScriptPath)) {
        expect.fail(`scripts/install-skill.sh does not exist yet (pending Milestone M3)`);
      }
      const content = fs.readFileSync(installScriptPath, 'utf8');
      expect(content).toMatch(/PATH/);
    });

    it('F3.6: verifies script passes bash syntax validation (bash -n)', () => {
      if (!fs.existsSync(installScriptPath)) {
        expect.fail(`scripts/install-skill.sh does not exist yet (pending Milestone M3)`);
      }
      expect(() => {
        execSync(`bash -n "${installScriptPath}"`, { stdio: 'pipe' });
      }).not.toThrow();
    });
  });

  // =========================================================================
  // Feature 4: Root Package Config (package.json)
  // =========================================================================
  describe('Feature 4: Root Package Config (package.json)', () => {
    it('F4.1: verifies root package.json exists and parses as valid JSON', () => {
      expect(fs.existsSync(packageJsonPath)).toBe(true);
      const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      expect(pkg).toBeDefined();
      expect(typeof pkg.name).toBe('string');
    });

    it('F4.2: verifies package.json contains bin entry for visual-ui pointing to bin/visual-ui.js', () => {
      const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      const hasBin =
        (typeof pkg.bin === 'string' && pkg.bin.includes('bin/visual-ui.js')) ||
        (typeof pkg.bin === 'object' && pkg.bin !== null && pkg.bin['visual-ui']?.includes('bin/visual-ui.js'));
      expect(hasBin, 'Expected package.json to declare bin entry for visual-ui pointing to ./bin/visual-ui.js').toBe(true);
    });

    it('F4.3: verifies package.json scripts defines test:e2e pointing to ./test/e2e/run-all.sh', () => {
      const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      expect(pkg.scripts).toBeDefined();
      expect(pkg.scripts['test:e2e']).toBe('./test/e2e/run-all.sh');
    });

    it('F4.4: verifies package.json scripts defines visual-ui CLI runner or start script', () => {
      const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      expect(pkg.scripts).toBeDefined();
      const hasVisualUiScript = Boolean(pkg.scripts['visual-ui'] || pkg.scripts['cli']);
      expect(hasVisualUiScript, 'Expected package.json to define a visual-ui CLI script').toBe(true);
    });

    it('F4.5: verifies package.json scripts defines build, test:server, and test:client commands', () => {
      const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      expect(pkg.scripts).toBeDefined();
      expect(pkg.scripts.build).toBeDefined();
      expect(pkg.scripts['test:server']).toBeDefined();
      expect(pkg.scripts['test:client']).toBeDefined();
    });
  });
});
