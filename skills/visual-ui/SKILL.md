---
name: visual-ui
description: >-
  Visual UI component inspector, element-level selector, and in-session AI modifier
  for Mobile, Web, and Desktop projects. Use this skill when the user asks to inspect,
  list, select, or modify UI components visually in their current project, or test
  UI responsiveness.
metadata:
  model: pro
---

# 🎨 Visual UI Studio - Agent Skill

Use this skill whenever working on projects with user interfaces (Web, Mobile, or Desktop) to inspect, select, and modify UI components directly in-session with live visual feedback and responsive testing.

---

## ⚡ Quickstart Commands

```bash
# 1. Scan and list UI components across the current project (table or machine-readable json)
visual-ui scan --dir "$PWD"
visual-ui scan --dir "$PWD" --format json

# 2. Start the interactive in-session visual dashboard server (foreground or non-blocking daemon)
visual-ui start --dir "$PWD" --port 3838
visual-ui start --dir "$PWD" --port 3838 --daemon

# 3. Check server readiness and active status
visual-ui start --check --port 3838

# 4. Direct element modification via CLI (optional alternative to web dashboard)
visual-ui modify --file "./src/components/Card.tsx" --prompt "Change button to emerald rounded pill with smooth hover scale"

# 5. Listen for browser UI element selections in active continuous session
visual-ui listen
node scripts/await-selection.js

# 6. Focus canvas on startup or render a component directly
visual-ui start --dir "$PWD" --file "./src/components/Card.tsx" --daemon
visual-ui render --file "./src/components/Card.tsx"
```

---

## 🔄 Continuous Same-Session Visual UI State Machine

Follow this exact state machine whenever running interactive visual UI editing in the same CLI session:

### Step 1: Start the Application Server Persistently
1. Check if the visual workbench server is already running using `visual-ui start --check --port 3838` or `manage_task` with `Action: "list"`.
2. If not running, start the application server in the background:
   - Using the CLI runner: `visual-ui start --dir "$PWD" --port 3838 --daemon`
   - Or using `run_command` with `IsDaemon: true` / `WaitMsBeforeAsync: 3000` for persistent background execution.
3. Record the task identifier or PID to manage and terminate it cleanly when the session finishes.

### Step 2: Enter the Selection-Edit Loop
Run the blocking selection listener using `run_command` or CLI:
- `CommandLine`: `"node scripts/await-selection.js"` (or `"visual-ui listen"`)
- `WaitMsBeforeAsync`: `190000` (blocking poll)

Inspect the JSON output printed to `stdout`:

#### Case A: `"status": "pending"` (or `"decision": "continue"`)
1. Locate the component corresponding to `element.selector`, `element.componentHint`, or `element.textSnippet`.
2. Apply the requested UI modification in `instruction` using `edit_file` / `write_file` or `visual-ui modify --file <path> --prompt "<instruction>"`.
3. Verify there are no syntax or compile errors.
4. **CRITICAL:** Do NOT finish your turn or ask the user a question in the CLI. Immediately loop back to **Step 2** and execute `await-selection.js` (or `visual-ui listen`) again so the user can click the next element in the browser.

#### Case B: `"status": "heartbeat_timeout"`
1. The keep-alive window expired without user input.
2. Immediately re-run **Step 2** (`node scripts/await-selection.js` or `visual-ui listen`) to keep listening without dropping the session.

#### Case C: `"status": "done"` (or `"decision": "allow"`)
1. Stop the background server using `manage_task` with `Action: "kill"` and the saved `TaskId` (or terminate the daemon process).
2. Clean up session lock if remaining (`.ui-feedback/session.lock`).
3. Provide a concise summary of all UI components modified during the session and end your turn.

---

## 🔍 Discovery Runbook (Scanning Components)

When the user asks to inspect or list UI components in their repository:

1. **Execute Component Discovery**:
   ```bash
   visual-ui scan --dir "$PWD"
   # For machine-readable JSON output:
   visual-ui scan --dir "$PWD" --format json
   ```
2. **Platform Classification & Supported Features**:
   - **Web & Responsive Mobile-Web**: Full in-session visual inspection, dynamic prop synthesis, live DOM canvas rendering, and responsive multi-device viewport switching (Mobile 375x667, Tablet 768x1024, Desktop 1280x800). Supported file formats include `.tsx`, `.jsx`, `.vue`, `.svelte`, and `.html` returning renderable JSX/HTML.
   - **Mobile (React Native & Flutter)**: Component AST parsing, layout inspection, and responsive web preview.
     > [!NOTE]
     > **Native Android ADB Device Bridging**: Responsive mobile-web and React Native web preview render directly in the workbench canvas. Native Android ADB device bridging (streaming to physical devices or emulators via USB or wireless debugging) requires platform SDK plugins and local Android SDK / ADB platform-tools installed on the host.
   - **Desktop**: Electron and Tauri app windows, desktop dashboards.
3. **Strict Exclusions**:
   - Automatically ignores `node_modules`, `dist`, `build`, `.next`, `.git`, `.cache`, `coverage`.
   - Excludes tests (`*.test.*`, `*.spec.*`, `__tests__`, `test/`).
   - Excludes non-visual state stores (Redux, Zustand), database models, and utility helpers.
   - Excludes CLI scripts and executable binaries.
4. **Output Formats**:
   - The default output prints an organized component inventory table grouped by platform with component names, file paths, and root elements.
   - `--format json` outputs a machine-readable JSON object with total counts, folder breakdowns, and threshold diagnostics.

---

## 🏢 Large-Codebase & Monorepo Scoping Runbook

For enterprise repositories or monorepos with hundreds of components:

1. **Threshold Detection (>30 Components)**:
   - When the scanner detects more than **30 components**, it sets `exceedsThreshold: true` and generates a folder breakdown.
   - In the CLI, the agent proactively asks the user:
     > *"Found 86 components across multiple folders. Would you like to focus on a specific feature (e.g. `--focus src/components/cards` or `--focus apps/web`), or view all?"*
2. **Scoped Execution (`--focus`)**:
   ```bash
   # Focus strictly on a subfolder or package
   visual-ui scan --dir "$PWD" --focus "src/components"
   visual-ui start --dir "$PWD" --focus "src/components" --daemon
   ```
3. **Filtering by Platform & Glob Rules**:
   ```bash
   visual-ui scan --dir "$PWD" --platform web
   visual-ui scan --dir "$PWD" --exclude "**/deprecated/**" --exclude "**/*.test.*"
   ```
4. **Configuration File Support (`.visual-ui.json`)**:
   Projects can store persistent include/exclude rules in `.visual-ui.json` or `.agents/visual-ui.json` at the repository root.

---

## 🎬 In-Session AI Animated Modification Runbook

When the user asks for animated or interactive changes:

1. **Tailwind Transitions & Animation Utilities**:
   - Smooth hover scaling: `transition-all duration-300 ease-in-out hover:scale-105 hover:shadow-xl`
   - Active click feedback: `active:scale-95 transition-transform duration-150`
   - Built-in animations: `animate-pulse`, `animate-bounce`, `animate-spin`
2. **CSS Keyframes & Transitions**:
   - Inject keyframe animations and transition timing functions (`cubic-bezier`) directly into component style blocks.
3. **Framer Motion**:
   - When `framer-motion` is available in `package.json`, use `<motion.div whileHover={{ scale: 1.05 }} transition={{ duration: 0.2 }}>`.
4. **60 FPS Live DOM Verification**:
   - The workbench executes the component code directly in the browser DOM sandbox, allowing immediate interactive hover, click, and responsive resize testing without restarting any server.
