#!/usr/bin/env node

/**
 * Visual UI Studio - Standalone CLI Runner
 * Subcommands:
 *   scan    Scan and inventory UI components (Mobile, Web, Desktop)
 *   start   Launch unified dashboard server on port 3838 (or custom port)
 *   modify  In-session AI code modification for target component/element
 *   render  Inject and render a focused component on the active canvas
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

let picomatch;
try {
  picomatch = require('picomatch');
} catch {}

const args = process.argv.slice(2);

function printHelp() {
  console.log(`
Usage: visual-ui <command> [options]

Commands:
  scan     Scan project directory and list all UI components (Web, Mobile, Desktop)
  start    Start the visual workbench server and dashboard
  modify   Modify a component or element using prompt instructions
  render   Inject and render a focused component on the active canvas
  listen   Listen for UI element selections from browser in active session

Options:
  --skill            Launch in agent skill mode (filters UI to target device)
  --device <type>    Restrict UI to specific device (mobile, tablet, desktop)
  --platform <type>  Restrict UI to specific platform (web, mobile, desktop)
  -h, --help         Show help information
  -v, --version      Show CLI version

Run 'visual-ui <command> --help' for details on a specific command.
`);
}

const VALUE_FLAGS = new Set([
  'dir',
  'file',
  'focus',
  'port',
  'prompt',
  'element',
  'code',
  'name',
  'props',
  'platform',
  'device',
  'format',
  'include',
  'exclude',
  'timeout',
  't',
  'p',
  'd',
  'f',
]);

const ARRAY_FLAGS = new Set(['include', 'exclude']);

function parseFlags(argv) {
  const flags = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--') || (arg.startsWith('-') && arg.length > 1 && !/^-?[0-9]+(\.[0-9]+)?$/.test(arg))) {
      const isLong = arg.startsWith('--');
      const prefixLen = isLong ? 2 : 1;
      const rest = arg.slice(prefixLen);
      let key = rest;
      let val;
      const eqIdx = rest.indexOf('=');

      if (eqIdx !== -1) {
        key = rest.slice(0, eqIdx);
        val = rest.slice(eqIdx + 1);
      } else if (i + 1 < argv.length && !argv[i + 1].startsWith('-')) {
        val = argv[++i];
      } else {
        // Naked flag: if it expects a value, do NOT assign boolean true
        if (VALUE_FLAGS.has(key)) {
          val = undefined;
        } else {
          val = true;
        }
      }

      if (val !== undefined) {
        if (ARRAY_FLAGS.has(key)) {
          if (!flags[key]) {
            flags[key] = [val];
          } else if (Array.isArray(flags[key])) {
            flags[key].push(val);
          } else {
            flags[key] = [flags[key], val];
          }
        } else {
          flags[key] = val;
        }
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
  'system volume information',
]);

const ALLOWED_EXTS = new Set(['.tsx', '.jsx', '.vue', '.svelte', '.html', '.dart', '.xml', '.ts', '.js']);

function matchesPattern(relPath, compName, pattern) {
  if (!pattern) return false;
  const normRel = relPath.replace(/\\/g, '/');
  const lowerRel = normRel.toLowerCase();
  const lowerPat = pattern.toLowerCase();

  // Exact match
  if (normRel === pattern || compName === pattern) return true;
  if (lowerRel === lowerPat || (compName && compName.toLowerCase() === lowerPat)) return true;

  // Directory prefix match (e.g. test/, deprecated/, src/components/)
  if (pattern.endsWith('/')) {
    const dirPrefix = pattern.replace(/\/+$/, '');
    if (
      normRel.startsWith(dirPrefix + '/') ||
      normRel.includes('/' + dirPrefix + '/') ||
      normRel === dirPrefix ||
      lowerRel.startsWith(dirPrefix.toLowerCase() + '/') ||
      lowerRel.includes('/' + dirPrefix.toLowerCase() + '/') ||
      lowerRel === dirPrefix.toLowerCase()
    ) {
      return true;
    }
  }

  // Picomatch glob evaluation
  if (picomatch) {
    try {
      const patterns = [pattern];
      if (pattern.endsWith('/')) {
        patterns.push(pattern + '**', '**/' + pattern + '**', pattern.slice(0, -1));
      } else {
        patterns.push('**/' + pattern, '**/' + pattern + '/**', pattern + '/**');
      }
      const isMatch = picomatch(patterns, { dot: true, nocase: true });
      if (isMatch(normRel) || (compName && isMatch(compName))) {
        return true;
      }
    } catch {}
  } else {
    // Regex glob fallback
    try {
      const regStr = pattern
        .replace(/[.+^${}()|[\]\\]/g, '\\$&')
        .replace(/\*\*/g, '.*')
        .replace(/(?<!\.)\*/g, '[^/]*')
        .replace(/\?/g, '.');
      const re = new RegExp(`(^|/)${regStr}($|/)`, 'i');
      if (re.test(normRel) || (compName && re.test(compName))) return true;
    } catch {}
  }

  // Substring fallback
  if (normRel.includes(pattern) || (compName && compName.includes(pattern))) return true;

  return false;
}

function isExcluded(filePath, relPath) {
  const normRel = relPath.replace(/\\/g, '/');
  const baseName = path.basename(normRel);
  const lowerBase = baseName.toLowerCase();

  // 1. Tests: __tests__ dir, tests? dir, testing dir, *.test.*, *.spec.*, test.*, spec.*
  if (
    /(?:^|\/)(?:__tests__|tests?|testing)(?:\/|$)/i.test(normRel) ||
    lowerBase.includes('.test.') ||
    lowerBase.includes('.spec.') ||
    lowerBase.startsWith('test.') ||
    lowerBase.startsWith('spec.')
  ) {
    return true;
  }

  // 2. Type definitions: *.d.ts, types.ts, types.d.ts, type.ts, types/ dir
  if (
    lowerBase.endsWith('.d.ts') ||
    lowerBase === 'types.ts' ||
    lowerBase === 'types.d.ts' ||
    lowerBase === 'type.ts' ||
    /(?:^|\/)types(?:\/|$)/i.test(normRel)
  ) {
    return true;
  }

  // 3. State stores: stores/, slices/, redux/, zustand/
  if (
    /(?:^|\/)(?:stores?|slices?|redux|zustand)(?:\/|$)/i.test(normRel) ||
    lowerBase.includes('store.') ||
    lowerBase.includes('slice.') ||
    lowerBase.startsWith('store-') ||
    lowerBase.startsWith('slice-')
  ) {
    return true;
  }

  // 4. Backend services: services/, *service.*
  if (
    /(?:^|\/)services?(?:\/|$)/i.test(normRel) ||
    lowerBase.includes('service.') ||
    lowerBase.startsWith('service-')
  ) {
    return true;
  }

  // 5. Utilities & helpers: helpers/, utils/, *helper.*, *util.*
  if (
    /(?:^|\/)(?:helpers?|utils?)(?:\/|$)/i.test(normRel) ||
    lowerBase.includes('helper.') ||
    lowerBase.includes('helpers.') ||
    lowerBase.includes('util.') ||
    lowerBase.includes('utils.') ||
    lowerBase.startsWith('helper-') ||
    lowerBase.startsWith('util-')
  ) {
    return true;
  }

  // 6. CLI scripts, bins, and scripts/ directory
  if (
    /(?:^|\/)(?:bin|scripts?)(?:\/|$)/i.test(normRel) ||
    lowerBase === 'visual-ui.js' ||
    lowerBase.endsWith('.sh')
  ) {
    return true;
  }

  return false;
}

function extractComponentName(chunk, baseName) {
  const match = chunk.match(/(?:export\s+(?:default\s+)?(?:const|function|class)\s+|function\s+|class\s+)([A-Z][A-Za-z0-9_]*)/);
  if (match && match[1] && match[1] !== 'Default' && match[1] !== 'React') {
    return match[1];
  }
  const arrowMatch = chunk.match(/(?:const|let|var)\s+([A-Z][A-Za-z0-9_]*)\s*=/);
  if (arrowMatch && arrowMatch[1]) {
    return arrowMatch[1];
  }
  return baseName;
}

function extractRootElement(chunk) {
  const match = chunk.match(/(?:return\s*\(?|=>\s*\(?)\s*(?:<>\s*)?<([A-Za-z][A-Za-z0-9_-]*)/);
  if (match && match[1]) {
    const raw = match[1];
    if (raw !== 'React' && raw !== 'Fragment') return raw;
  }
  const anyTag = chunk.match(/<([A-Za-z][A-Za-z0-9_-]*)/);
  if (anyTag && anyTag[1]) {
    const raw = anyTag[1];
    if (raw !== 'React' && raw !== 'Fragment') return raw;
  }
  return undefined;
}

function classifyComponent(filePath, relPath, content) {
  const ext = path.extname(filePath).toLowerCase();
  const normRel = relPath.replace(/\\/g, '/').toLowerCase();
  const baseName = path.basename(filePath, ext);

  // Shebang or CLI script check
  if (content.startsWith('#!')) return null;

  // 1. Desktop check
  const isDesktop =
    normRel.includes('/desktop/') ||
    normRel.includes('src-tauri') ||
    normRel.includes('/electron/') ||
    content.includes("'electron'") ||
    content.includes('"electron"') ||
    content.includes("'@tauri-apps/api'") ||
    content.includes('"@tauri-apps/api"');

  if (isDesktop) {
    return {
      name: extractComponentName(content, baseName),
      platform: 'desktop',
      rootElement: extractRootElement(content) || (content.includes('QWidget') ? 'QWidget' : 'div'),
    };
  }

  // 2. Mobile check: Flutter Dart
  if (ext === '.dart' && (content.includes('StatelessWidget') || content.includes('StatefulWidget') || content.includes('Widget build('))) {
    const dartClassMatch = content.match(/class\s+([A-Za-z0-9_]+)\s+extends\s+(?:Stateless|Stateful)Widget/);
    return {
      name: dartClassMatch ? dartClassMatch[1] : baseName,
      platform: 'mobile',
      rootElement: 'Widget',
    };
  }

  // Mobile check: Android layout XML
  if (ext === '.xml' && (content.includes('<LinearLayout') || content.includes('<ConstraintLayout') || content.includes('<RelativeLayout') || content.includes('<FrameLayout') || content.includes('<CoordinatorLayout') || content.includes('<ScrollView') || content.includes('<androidx.'))) {
    const xmlRootMatch = content.match(/<([A-Za-z0-9_.-]+)[\s>]/);
    return {
      name: baseName,
      platform: 'mobile',
      rootElement: xmlRootMatch ? xmlRootMatch[1] : 'ViewGroup',
    };
  }

  // Mobile check: React Native
  const isReactNative =
    (ext === '.tsx' || ext === '.jsx' || ext === '.js' || ext === '.ts') &&
    (content.includes("'react-native'") || content.includes('"react-native"') || (content.includes('<View') && content.includes('<Text')) || content.includes('<SafeAreaView'));

  if (isReactNative) {
    return {
      name: extractComponentName(content, baseName),
      platform: 'mobile',
      rootElement: extractRootElement(content) || 'View',
    };
  }

  // 3. Web check: .tsx, .jsx, .vue, .svelte, .html (Strictly exclude pure .ts or .js)
  if (['.tsx', '.jsx', '.vue', '.svelte', '.html'].includes(ext)) {
    const hasJsxOrDom =
      /(?:return\s*\(?|=>\s*\(?)\s*(?:<>\s*)?<[a-zA-Z]/s.test(content) ||
      /<template\b/s.test(content) ||
      /<(?:div|span|header|main|section|button|nav|p|article|h[1-6]|table|form)\b/i.test(content);

    if (hasJsxOrDom) {
      return {
        name: extractComponentName(content, baseName),
        platform: 'web',
        rootElement: extractRootElement(content) || 'div',
      };
    }
  }

  return null;
}

function scanProject(baseDir, options = {}) {
  const resolved = path.resolve(typeof baseDir === 'string' && baseDir.trim() ? baseDir : process.cwd());
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
        const lowerName = entry.name.toLowerCase();
        if (IGNORED_DIRS.has(lowerName)) continue;
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

        if (chunk.startsWith('#!')) continue;

        const classified = classifyComponent(fullPath, relPath, chunk);
        if (!classified) continue;

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
    filtered = filtered.filter((c) => include.some((inc) => matchesPattern(c.relativePath, c.name, inc)));
  }
  if (exclude.length > 0) {
    filtered = filtered.filter((c) => !exclude.some((exc) => matchesPattern(c.relativePath, c.name, exc)));
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
  --include <glob>   Include patterns (can be specified multiple times)
  --exclude <glob>   Exclude patterns (can be specified multiple times)
  -h, --help         Show this help message
`);
    process.exit(0);
  }

  const targetDir = typeof flags.dir === 'string' && flags.dir.trim() ? flags.dir : process.cwd();
  const format = (typeof flags.format === 'string' ? flags.format : 'table').toLowerCase();

  try {
    const rawInclude = Array.isArray(flags.include) ? flags.include : (flags.include ? [flags.include] : []);
    const rawExclude = Array.isArray(flags.exclude) ? flags.exclude : (flags.exclude ? [flags.exclude] : []);

    const result = scanProject(targetDir, {
      focus: typeof flags.focus === 'string' ? flags.focus : undefined,
      platform: typeof flags.platform === 'string' ? flags.platform : undefined,
      include: rawInclude,
      exclude: rawExclude,
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
  --file <path>      Focus canvas strictly on a specific component file
  --skill            Launch in agent skill mode (filters UI to target device)
  --device <type>    Restrict UI to specific device (mobile, tablet, desktop)
  --platform <type>  Restrict UI to specific platform (web, mobile, desktop)
  --daemon           Launch server in background non-blocking daemon mode
  --check            Check if server is active and running on the target port
  -h, --help         Show this help message
`);
    process.exit(0);
  }

  const port = (typeof flags.port === 'string' || typeof flags.port === 'number') ? flags.port : (process.env.PORT || 3838);
  const targetDir = path.resolve((typeof flags.dir === 'string' && flags.dir.trim()) ? flags.dir : process.cwd());
  const focusFile = (typeof flags.file === 'string' && flags.file.trim()) ? path.resolve(flags.file) : '';

  // Handle --check
  if (flags.check) {
    const http = require('http');
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: Number(port),
        path: '/api/info',
        method: 'GET',
        timeout: 2000,
      },
      (res) => {
        if (res.statusCode >= 200 && res.statusCode < 400) {
          console.log(`✓ Visual UI Studio is running on port ${port}`);
          process.exit(0);
        } else {
          console.log(`✗ Visual UI Studio returned status ${res.statusCode} on port ${port}`);
          process.exit(1);
        }
      }
    );
    req.on('error', (err) => {
      console.log(`✗ Visual UI Studio is not running on port ${port} (${err.message})`);
      process.exit(1);
    });
    req.on('timeout', () => {
      req.destroy();
      console.log(`✗ Timed out checking Visual UI Studio on port ${port}`);
      process.exit(1);
    });
    req.end();
    return;
  }

  console.log(`🚀 Starting Visual UI Studio on port ${port}...`);
  console.log(`📁 Target Workspace: ${targetDir}`);
  if (focusFile) {
    console.log(`🎯 Focused Component File: ${focusFile}`);
  }

  // Launch the server script
  const serverPath = path.resolve(__dirname, '../server/src/index.ts');
  const serverDistPath = path.resolve(__dirname, '../server/dist/index.js');

  const runner = fs.existsSync(serverDistPath)
    ? ['node', [serverDistPath]]
    : ['npx', ['tsx', serverPath]];

  const isSkill = Boolean(flags.skill || flags['skill-mode'] || process.env.SKILL_MODE);
  const targetDevice = flags.device || process.env.TARGET_DEVICE || '';
  const targetPlatform = flags.platform || process.env.TARGET_PLATFORM || '';

  const childEnv = {
    ...process.env,
    PORT: String(port),
    WORKSPACE_DIR: targetDir,
    FOCUS_FILE: focusFile,
    SKILL_MODE: isSkill ? 'true' : '',
    TARGET_DEVICE: targetDevice,
    TARGET_PLATFORM: targetPlatform,
  };

  if (flags.daemon) {
    const outLog = path.resolve(__dirname, '../.visual-ui.log');
    const outFd = fs.openSync(outLog, 'a');
    const child = spawn(runner[0], runner[1], {
      cwd: path.resolve(__dirname, '..'),
      env: childEnv,
      detached: true,
      stdio: ['ignore', outFd, outFd],
    });
    child.unref();

    console.log(`🚀 Visual UI Studio launched in daemon mode (PID: ${child.pid}) on port ${port}.`);
    console.log(`📄 Output log: ${outLog}`);
    process.exit(0);
  }

  const child = spawn(runner[0], runner[1], {
    cwd: path.resolve(__dirname, '..'),
    env: childEnv,
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

function handleRender(argv) {
  const flags = parseFlags(argv);
  if (flags.help || flags.h) {
    console.log(`
Usage: visual-ui render [options]

Injects and renders a component directly into the active Visual UI canvas.

Options:
  --file <path>      Target component file path
  --code <string>    Direct component code
  --name <string>    Component name
  --props <json>     Custom props JSON string
  --port <number>    Server port (default: 3838)
  -h, --help         Show this help message
`);
    process.exit(0);
  }

  const port = (typeof flags.port === 'string' || typeof flags.port === 'number') ? flags.port : (process.env.PORT || 3838);
  const filePath = (typeof flags.file === 'string' && flags.file.trim()) ? path.resolve(flags.file) : undefined;
  const code = typeof flags.code === 'string' ? flags.code : undefined;
  const componentName = typeof flags.name === 'string' ? flags.name : undefined;
  let props = undefined;
  if (typeof flags.props === 'string') {
    try {
      props = JSON.parse(flags.props);
    } catch {
      console.warn('Warning: Failed to parse --props as JSON');
    }
  }

  if (!filePath && !code) {
    console.error('Error: Either --file or --code must be provided.');
    process.exit(1);
  }

  const payload = JSON.stringify({ filePath, code, componentName, props });
  const http = require('http');
  const req = http.request(
    {
      hostname: 'localhost',
      port: Number(port),
      path: '/api/canvas/render',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    },
    (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          if (res.statusCode >= 200 && res.statusCode < 300 && json.success) {
            console.log(`✓ Active canvas updated: <${json.activeComponent.name}>`);
            if (json.synthesizedProps && Object.keys(json.synthesizedProps).length > 0) {
              console.log(`  Synthesized props: ${Object.keys(json.synthesizedProps).join(', ')}`);
            }
            process.exit(0);
          } else {
            console.error(`Render failed (${res.statusCode}): ${json.error || body}`);
            process.exit(1);
          }
        } catch {
          console.error(`Render failed (${res.statusCode}): ${body}`);
          process.exit(1);
        }
      });
    }
  );

  req.on('error', (err) => {
    console.error(`Failed to connect to server on port ${port}: ${err.message}`);
    process.exit(1);
  });

  req.write(payload);
  req.end();
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
  --element <sel>    Target element selector / ID (optional)
  --port <number>    Server port (default: 3838)
  -h, --help         Show this help message
`);
    process.exit(0);
  }

  if (!flags.file || typeof flags.file !== 'string' || !flags.prompt || typeof flags.prompt !== 'string') {
    console.error('Error: Both --file and --prompt are required for modification.');
    process.exit(1);
  }

  const filePath = path.resolve(flags.file);
  if (!fs.existsSync(filePath)) {
    console.error(`Error: File does not exist: ${flags.file}`);
    process.exit(1);
  }

  const port = (typeof flags.port === 'string' || typeof flags.port === 'number') ? flags.port : (process.env.PORT || 3838);
  const elementId = typeof flags.element === 'string' ? flags.element : undefined;
  const prompt = flags.prompt;

  // Direct modification engine executor
  const applyDirectModification = () => {
    let aiService;
    try {
      require('tsx/cjs');
      const mod = require(path.resolve(__dirname, '../server/src/services/aiService.ts'));
      aiService = mod.aiService;
    } catch {
      try {
        const mod = require(path.resolve(__dirname, '../server/dist/services/aiService.js'));
        aiService = mod.aiService;
      } catch (err) {
        console.error(`Error: Unable to load modification engine: ${err.message}`);
        process.exit(1);
      }
    }

    try {
      const original = fs.readFileSync(filePath, 'utf8');
      const modResult = aiService.modifyComponentCode(original, prompt, elementId);

      // Report graceful error on no-match
      if (modResult.modifiedCode === original || !modResult.appliedChanges || modResult.appliedChanges.length === 0) {
        console.error(`Error: No matching element or modification target found in ${path.basename(filePath)} for: ${elementId || prompt}`);
        process.exit(1);
      }

      // Create backup file with timestamp
      const backupPath = `${filePath}.bak-${Date.now()}`;
      fs.writeFileSync(backupPath, original, 'utf8');

      // Atomic write via temporary file
      const tempPath = `${filePath}.tmp-${Date.now()}`;
      fs.writeFileSync(tempPath, modResult.modifiedCode, 'utf8');
      fs.renameSync(tempPath, filePath);

      console.log(`✓ Successfully modified ${path.basename(filePath)}`);
      if (modResult.appliedChanges.length > 0) {
        console.log(`  Applied changes: ${modResult.appliedChanges.join(', ')}`);
      }
      console.log(`  Backup created at: ${path.basename(backupPath)}`);
      process.exit(0);
    } catch (err) {
      console.error(`Modification failed: ${err.message}`);
      process.exit(1);
    }
  };

  // Try calling server API if reachable, else fall back to direct engine
  const http = require('http');
  const payload = JSON.stringify({ filePath, prompt, elementId });

  const req = http.request(
    {
      hostname: '127.0.0.1',
      port: Number(port),
      path: '/api/component/modify',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
      timeout: 800,
    },
    (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          if (res.statusCode >= 200 && res.statusCode < 300 && json.success) {
            console.log(`✓ Successfully modified ${path.basename(filePath)}`);
            if (json.appliedChanges && json.appliedChanges.length > 0) {
              console.log(`  Applied changes: ${json.appliedChanges.join(', ')}`);
            }
            if (json.backupPath) {
              console.log(`  Backup created at: ${path.basename(json.backupPath)}`);
            }
            process.exit(0);
          } else {
            console.error(`Modification failed: ${json.error || body}`);
            process.exit(1);
          }
        } catch {
          console.error(`Modification failed: ${body}`);
          process.exit(1);
        }
      });
    }
  );

  req.on('error', () => {
    // Server is not running or unreachable: delegate directly to local modification engine
    applyDirectModification();
  });

  req.on('timeout', () => {
    req.destroy();
    applyDirectModification();
  });

  req.write(payload);
  req.end();
}

function handleListen(argv) {
  const flags = parseFlags(argv);
  if (flags.help || flags.h) {
    console.log(`
Usage: visual-ui listen [options]

Listens for interactive browser UI element selections in an active editing session.
Consumes selections in FIFO order from .ui-feedback/queue and emits JSON to stdout.

Options:
  --timeout <number> Maximum wait time in milliseconds (default: 180000)
  --dir <path>       Workspace root directory (default: current working directory)
  -h, --help         Show this help message
`);
    process.exit(0);
  }

  const baseDir = path.resolve((typeof flags.dir === 'string' && flags.dir.trim()) ? flags.dir : process.cwd());
  const queueDir = path.resolve(baseDir, '.ui-feedback/queue');
  const timeoutMs =
    typeof flags.timeout === 'string' || typeof flags.timeout === 'number'
      ? parseInt(String(flags.timeout), 10)
      : parseInt(process.env.AGY_WAIT_TIMEOUT_MS || '180000', 10);
  const POLL_INTERVAL_MS = 250;

  try {
    fs.mkdirSync(queueDir, { recursive: true });
  } catch {}

  const startTime = Date.now();

  function check() {
    try {
      if (Date.now() - startTime > timeoutMs) {
        console.log(
          JSON.stringify({
            status: 'heartbeat_timeout',
            message: 'No selection received within window. Re-invoke await-selection.js to continue listening.',
          })
        );
        process.exit(0);
      }

      if (!fs.existsSync(queueDir)) return false;

      const files = fs
        .readdirSync(queueDir)
        .filter((f) => f.endsWith('.json'))
        .sort();

      if (files.length === 0) return false;

      const target = path.join(queueDir, files[0]);
      let raw = '';
      try {
        raw = fs.readFileSync(target, 'utf8').trim();
      } catch {
        return false;
      }
      if (!raw) return false;

      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch {
        return false;
      }

      try {
        fs.unlinkSync(target);
      } catch {}

      const isDone = parsed.status === 'done';
      const sessionLockFile = path.resolve(baseDir, '.ui-feedback/session.lock');
      if (isDone && fs.existsSync(sessionLockFile)) {
        try {
          fs.unlinkSync(sessionLockFile);
        } catch {}
      }

      const selector = (parsed.element && parsed.element.selector) || 'unknown';
      const hint = (parsed.element && parsed.element.componentHint) || 'unknown';
      const instruction = parsed.instruction || '';

      const output = isDone
        ? {
            decision: 'allow',
            status: 'done',
            message: 'Visual UI session finished by user.',
            ...parsed,
            remainingInQueue: files.length - 1,
          }
        : {
            decision: 'continue',
            status: parsed.status || 'pending',
            reason: `User selected element "${selector}" (component hint: ${hint}) with instruction: "${instruction}". Modify the corresponding UI component now.`,
            ...parsed,
            remainingInQueue: files.length - 1,
          };

      console.log(JSON.stringify(output, null, 2));
      process.exit(0);
    } catch {
      return false;
    }
  }

  if (!check()) {
    const timer = setInterval(() => {
      check();
    }, POLL_INTERVAL_MS);
  }
}

// -----------------------------------------------------------------------------
// CLI Dispatcher
// -----------------------------------------------------------------------------
const SUBCOMMANDS = new Set(['scan', 'start', 'modify', 'render', 'listen']);

const cmdIdx = args.findIndex((a) => SUBCOMMANDS.has(a));

if (cmdIdx !== -1) {
  const command = args[cmdIdx];
  const subArgs = args.filter((_, i) => i !== cmdIdx);
  switch (command) {
    case 'scan':
      handleScan(subArgs);
      break;
    case 'start':
      handleStart(subArgs);
      break;
    case 'modify':
      handleModify(subArgs);
      break;
    case 'render':
      handleRender(subArgs);
      break;
    case 'listen':
      handleListen(subArgs);
      break;
  }
} else if (!args[0] || args.includes('--help') || args.includes('-h')) {
  printHelp();
  process.exit(0);
} else if (args.includes('--version') || args.includes('-v')) {
  const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../package.json'), 'utf8'));
  console.log(`visual-ui v${pkg.version || '1.0.0'}`);
  process.exit(0);
} else {
  console.error(`Error: Unknown command "${args[0]}". Run "visual-ui --help" for available commands.`);
  process.exit(1);
}
