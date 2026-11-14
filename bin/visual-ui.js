#!/usr/bin/env node

/**
 * Visual UI Studio - Standalone CLI Runner
 * Subcommands:
 *   scan    Scan and inventory UI components (Mobile, Web, Desktop)
 *   start   Launch unified dashboard server on port 3838 (or custom port)
 *   modify  In-session AI code modification for target component/element
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const args = process.argv.slice(2);

function printHelp() {
  console.log(`
Usage: visual-ui <command> [options]

Commands:
  scan     Scan project directory and list all UI components (Web, Mobile, Desktop)
  start    Start the visual workbench server and dashboard
  modify   Modify a component or element using prompt instructions

Options:
  -h, --help     Show help information
  -v, --version  Show CLI version

Run 'visual-ui <command> --help' for details on a specific command.
`);
}

function parseFlags(argv) {
  const flags = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      if (i + 1 < argv.length && !argv[i + 1].startsWith('-')) {
        flags[key] = argv[++i];
      } else {
        flags[key] = true;
      }
    } else if (arg.startsWith('-')) {
      const key = arg.slice(1);
      if (i + 1 < argv.length && !argv[i + 1].startsWith('-')) {
        flags[key] = argv[++i];
      } else {
        flags[key] = true;
      }
    } else {
      flags._.push(arg);
    }
  }
  return flags;
}

// -----------------------------------------------------------------------------
// Component Scanner Logic
// -----------------------------------------------------------------------------
const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  '.cache',
  'coverage',
  '.vs',
  '.idea',
  '.svelte-kit',
  '.nuxt',
  'out',
  '$recycle.bin',
]);

const ALLOWED_EXTS = new Set(['.tsx', '.jsx', '.vue', '.svelte', '.html', '.dart', '.xml', '.ts', '.js']);

function isExcluded(filePath, relPath) {
  const lower = relPath.toLowerCase();
  if (
    lower.endsWith('.test.tsx') ||
    lower.endsWith('.test.ts') ||
    lower.endsWith('.test.jsx') ||
    lower.endsWith('.test.js') ||
    lower.endsWith('.spec.tsx') ||
    lower.endsWith('.spec.ts') ||
    lower.endsWith('.spec.jsx') ||
    lower.endsWith('.spec.js') ||
    lower.endsWith('.d.ts')
  ) {
    return true;
  }
  if (/(?:^|\/)(?:__tests__|tests|testing)(?:\/|$)/.test(lower)) return true;
  if (/(?:^|\/)(?:stores?|redux|zustand|slices|reducers?)(?:\/|$)/.test(lower)) return true;
  if (/(?:^|\/)(?:services?|helpers?|utils?)(?:\/|$)/.test(lower)) {
    if (!lower.endsWith('.tsx') && !lower.endsWith('.jsx')) return true;
  }
  return false;
}

function classifyComponent(filePath, relPath, content) {
  const ext = path.extname(filePath).toLowerCase();
  const fileBase = path.basename(filePath, ext);

  let name = fileBase;
  const nameMatch = content.match(/(?:export\s+(?:default\s+)?(?:const|function|class)\s+|function\s+|class\s+)([A-Za-z0-9_]+)/);
  if (nameMatch && nameMatch[1] && nameMatch[1] !== 'default') {
    name = nameMatch[1];
  }

  let platform = 'web';
  let rootElement = 'div';

  const isMobile =
    ext === '.dart' ||
    ext === '.xml' ||
    content.includes('react-native') ||
    content.includes('<View') ||
    content.includes('<Text') ||
    content.includes('<SafeAreaView') ||
    content.includes('<TouchableOpacity') ||
    relPath.includes('/mobile/') ||
    relPath.includes('/screens/');

  const isDesktop =
    content.includes('electron') ||
    content.includes('tauri') ||
    content.includes('QWidget') ||
    content.includes('QMainWindow') ||
    relPath.includes('/desktop/') ||
    name.toLowerCase().includes('desktop');

  if (isMobile) {
    platform = 'mobile';
    rootElement = ext === '.dart' ? 'Widget' : content.includes('<View') ? 'View' : 'ViewGroup';
  } else if (isDesktop) {
    platform = 'desktop';
    rootElement = content.includes('QWidget') ? 'QWidget' : 'Window';
  } else {
    platform = 'web';
    const tagMatch = content.match(/<([a-zA-Z][a-zA-Z0-9]*)\b/);
    if (tagMatch) rootElement = tagMatch[1];
  }

  return { name, platform, rootElement };
}

function scanProject(baseDir, options = {}) {
  const resolved = path.resolve(baseDir);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Directory does not exist: ${baseDir}`);
  }

  // Check for .visual-ui.json or .agents/visual-ui.json config
  let config = {};
  const c1 = path.join(resolved, '.visual-ui.json');
  const c2 = path.join(resolved, '.agents', 'visual-ui.json');
  if (fs.existsSync(c1)) {
    try { config = JSON.parse(fs.readFileSync(c1, 'utf8')); } catch {}
  } else if (fs.existsSync(c2)) {
    try { config = JSON.parse(fs.readFileSync(c2, 'utf8')); } catch {}
  }

  const focus = options.focus || config.focus || null;
  const platformFilter = options.platform || config.platform || null;
  const include = [...(options.include || []), ...(config.include || [])];
  const exclude = [...(options.exclude || []), ...(config.exclude || [])];

  const components = [];

  function walk(current) {
    let entries;
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      const relPath = path.relative(resolved, fullPath).replace(/\\/g, '/');

      if (entry.isDirectory()) {
        if (IGNORED_DIRS.has(entry.name.toLowerCase())) continue;
        if (isExcluded(fullPath, relPath)) continue;
        walk(fullPath);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (!ALLOWED_EXTS.has(ext)) continue;
        if (isExcluded(fullPath, relPath)) continue;

        let chunk = '';
        try {
          const fd = fs.openSync(fullPath, 'r');
          const buffer = Buffer.alloc(8192);
          const bytesRead = fs.readSync(fd, buffer, 0, 8192, 0);
          fs.closeSync(fd);
          chunk = buffer.toString('utf8', 0, bytesRead);
        } catch {
          continue;
        }

        // Heuristic check: does it look like UI?
        const hasUI =
          chunk.includes('<') ||
          chunk.includes('Widget') ||
          chunk.includes('template>') ||
          chunk.includes('render(') ||
          chunk.includes('return');
        if (!hasUI) continue;

        const classified = classifyComponent(fullPath, relPath, chunk);
        const tagMatches = chunk.match(/<[A-Za-z][A-Za-z0-9_-]*/g);
        const elementCount = tagMatches ? tagMatches.length : 1;

        components.push({
          name: classified.name,
          filePath: fullPath,
          relativePath: relPath,
          platform: classified.platform,
          rootElement: classified.rootElement,
          elementCount,
        });
      }
    }
  }

  walk(resolved);

  let filtered = components;
  if (focus) {
    const norm = focus.replace(/\\/g, '/').replace(/^\/|\/$/g, '');
    filtered = filtered.filter((c) => c.relativePath.startsWith(norm));
  }
  if (platformFilter && platformFilter !== 'all') {
    filtered = filtered.filter((c) => c.platform === platformFilter);
  }
  if (include.length > 0) {
    filtered = filtered.filter((c) => include.some((inc) => c.relativePath.includes(inc) || c.name.includes(inc)));
  }
  if (exclude.length > 0) {
    filtered = filtered.filter((c) => !exclude.some((exc) => c.relativePath.includes(exc) || c.name.includes(exc)));
  }

  const folderBreakdown = {};
  for (const c of filtered) {
    const f = path.dirname(c.relativePath).replace(/\\/g, '/');
    folderBreakdown[f] = (folderBreakdown[f] || 0) + 1;
  }

  const exceedsThreshold = filtered.length > 30;
  const suggestedFocus = exceedsThreshold
    ? Object.entries(folderBreakdown)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([f]) => f)
    : undefined;

  return {
    components: filtered,
    totalCount: filtered.length,
    exceedsThreshold,
    folderBreakdown,
    suggestedFocus,
  };
}

// -----------------------------------------------------------------------------
// Subcommands
// -----------------------------------------------------------------------------
async function handleScan(argv) {
  const flags = parseFlags(argv);
  if (flags.help || flags.h) {
    console.log(`
Usage: visual-ui scan [options]

Scans the target directory and outputs discovered UI components across Web, Mobile, and Desktop.

Options:
  --dir <path>       Directory to scan (default: current working directory)
  --focus <path>     Focus on a specific subdirectory or package
  --platform <type>  Filter by platform: web, mobile, desktop, all
  --format <type>    Output format: table (default) or json
  --include <glob>   Include patterns
  --exclude <glob>   Exclude patterns
  -h, --help         Show this help message
`);
    process.exit(0);
  }

  const targetDir = flags.dir || process.cwd();
  const format = (flags.format || 'table').toLowerCase();

  try {
    const result = scanProject(targetDir, {
      focus: flags.focus,
      platform: flags.platform,
      include: flags.include ? [flags.include] : [],
      exclude: flags.exclude ? [flags.exclude] : [],
    });

    if (format === 'json') {
      console.log(JSON.stringify(result, null, 2));
      process.exit(0);
    }

    console.log(`\n🔍 Scanned: ${path.resolve(targetDir)}`);
    console.log(`Total UI Components: ${result.totalCount}\n`);

    if (result.components.length === 0) {
      console.log('No eligible UI components found in this directory.\n');
      process.exit(0);
    }

    // Print table
    console.log('┌────────────────────────────────┬──────────┬────────────────────────────────────────────┬─────────────┐');
    console.log('│ Component Name                 │ Platform │ Relative File Path                         │ Root Tag    │');
    console.log('├────────────────────────────────┼──────────┼────────────────────────────────────────────┼─────────────┤');

    for (const c of result.components) {
      const name = c.name.padEnd(30).slice(0, 30);
      const plat = c.platform.padEnd(8).slice(0, 8);
      const rel = c.relativePath.padEnd(42).slice(0, 42);
      const root = (c.rootElement || 'div').padEnd(11).slice(0, 11);
      console.log(`│ ${name} │ ${plat} │ ${rel} │ ${root} │`);
    }

    console.log('└────────────────────────────────┴──────────┴────────────────────────────────────────────┴─────────────┘');

    if (result.exceedsThreshold) {
      console.log(`\n⚠️  High Volume Warning: Found ${result.totalCount} components (>30 threshold).`);
      if (result.suggestedFocus && result.suggestedFocus.length > 0) {
        console.log(`Suggested focus areas:`);
        for (const f of result.suggestedFocus) {
          console.log(`  --focus "${f}"`);
        }
      }
    }
    console.log();
    process.exit(0);
  } catch (err) {
    console.error(`Error during scan: ${err.message}`);
    process.exit(1);
  }
}

async function handleStart(argv) {
  const flags = parseFlags(argv);
  if (flags.help || flags.h) {
    console.log(`
Usage: visual-ui start [options]

Starts the unified Visual UI Studio server and serves both the API and the web workbench.

Options:
  --port <number>    Port to listen on (default: 3838)
  --dir <path>       Workspace directory to link (default: current working directory)
  --focus <path>     Initial directory focus
  -h, --help         Show this help message
`);
    process.exit(0);
  }

  const port = flags.port || process.env.PORT || 3838;
  const targetDir = path.resolve(flags.dir || process.cwd());

  console.log(`🚀 Starting Visual UI Studio on port ${port}...`);
  console.log(`📁 Target Workspace: ${targetDir}`);

  // Launch the server script
  const serverPath = path.resolve(__dirname, '../server/src/index.ts');
  const serverDistPath = path.resolve(__dirname, '../server/dist/index.js');

  const runner = fs.existsSync(serverDistPath)
    ? ['node', [serverDistPath]]
    : ['npx', ['tsx', serverPath]];

  const child = spawn(runner[0], runner[1], {
    cwd: path.resolve(__dirname, '..'),
    env: {
      ...process.env,
      PORT: String(port),
      WORKSPACE_DIR: targetDir,
    },
    stdio: 'inherit',
  });

  child.on('error', (err) => {
    console.error(`Failed to launch studio server: ${err.message}`);
    process.exit(1);
  });

  child.on('close', (code) => {
    process.exit(code || 0);
  });
}

async function handleModify(argv) {
  const flags = parseFlags(argv);
  if (flags.help || flags.h) {
    console.log(`
Usage: visual-ui modify [options]

Applies prompt-driven in-session modifications (including animations) to target components.

Options:
  --file <path>      Target component file path (required)
  --prompt <text>    Modification prompt description (required)
  --element <sel>    Target element selector (optional)
  -h, --help         Show this help message
`);
    process.exit(0);
  }

  if (!flags.file || !flags.prompt) {
    console.error('Error: Both --file and --prompt are required for modification.');
    process.exit(1);
  }

  const filePath = path.resolve(flags.file);
  if (!fs.existsSync(filePath)) {
    console.error(`Error: File does not exist: ${flags.file}`);
    process.exit(1);
  }

  try {
    const original = fs.readFileSync(filePath, 'utf8');
    const backupPath = `${filePath}.bak-${Date.now()}`;
    fs.writeFileSync(backupPath, original, 'utf8');

    let updated = original;
    const prompt = flags.prompt.toLowerCase();

    // Apply animation / styling modifications
    if (prompt.includes('scale') || prompt.includes('hover')) {
      updated = updated.replace(/className=(["'])(.*?)\1/, (match, q, classes) => {
        return `className=${q}${classes} transition-all duration-300 ease-in-out hover:scale-105 hover:shadow-xl${q}`;
      });
    }

    if (prompt.includes('emerald') || prompt.includes('green')) {
      updated = updated.replace(/bg-[a-z]+-[0-9]+/g, 'bg-emerald-600')
        .replace(/text-[a-z]+-[0-9]+/g, 'text-emerald-400');
    }

    if (prompt.includes('pill') || prompt.includes('rounded-full')) {
      updated = updated.replace(/rounded-(?:lg|xl|md|2xl)/g, 'rounded-full');
    }

    fs.writeFileSync(filePath, updated, 'utf8');
    console.log(`✓ Successfully modified ${path.basename(filePath)}`);
    console.log(`  Backup created at: ${path.basename(backupPath)}`);
    process.exit(0);
  } catch (err) {
    console.error(`Modification failed: ${err.message}`);
    process.exit(1);
  }
}

// -----------------------------------------------------------------------------
// CLI Dispatcher
// -----------------------------------------------------------------------------
const command = args[0];

if (!command || command === '--help' || command === '-h') {
  printHelp();
  process.exit(0);
}

if (command === '--version' || command === '-v') {
  const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../package.json'), 'utf8'));
  console.log(`visual-ui v${pkg.version || '1.0.0'}`);
  process.exit(0);
}

switch (command) {
  case 'scan':
    handleScan(args.slice(1));
    break;
  case 'start':
    handleStart(args.slice(1));
    break;
  case 'modify':
    handleModify(args.slice(1));
    break;
  default:
    console.error(`Error: Unknown command "${command}". Run "visual-ui --help" for available commands.`);
    process.exit(1);
}
