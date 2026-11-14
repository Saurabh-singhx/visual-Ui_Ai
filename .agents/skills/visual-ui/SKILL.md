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
# 1. Scan and list UI components across the current project
visual-ui scan --dir "$PWD"

# 2. Start the interactive in-session visual dashboard on port 3838
visual-ui start --dir "$PWD" --port 3838

# 3. Direct element modification via CLI (optional alternative to web dashboard)
visual-ui modify --file "./src/components/Card.tsx" --prompt "Change button to emerald rounded pill with smooth hover scale"

# 4. Focus canvas on startup or render a component directly
visual-ui start --dir "$PWD" --file "./src/components/Card.tsx"
visual-ui render --file "./src/components/Card.tsx"
```

---

## 🔍 Discovery Runbook (Scanning Components)

When the user asks to inspect or list UI components in their repository:

1. **Execute Component Discovery**:
   ```bash
   visual-ui scan --dir "$PWD"
   ```
2. **Platform Classification**:
   - **Web**: `.tsx`, `.jsx`, `.vue`, `.svelte`, `.html` returning renderable JSX/HTML.
   - **Mobile**: React Native (`import ... from 'react-native'`, `<View>`, `<Text>`), Flutter (`.dart` widgets), Android layout XML (`<LinearLayout>`, `<ConstraintLayout>`).
   - **Desktop**: Electron and Tauri app windows, desktop dashboards.
3. **Strict Exclusions**:
   - Automatically ignores `node_modules`, `dist`, `build`, `.next`, `.git`, `.cache`.
   - Excludes tests (`*.test.*`, `*.spec.*`, `__tests__`).
   - Excludes non-visual state stores (Redux, Zustand), database models, and utility helpers.
4. **Output Table**:
   The command prints an organized component inventory table grouped by platform with component names, file paths, and root elements.

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
   visual-ui start --dir "$PWD" --focus "src/components"
   ```
3. **Filtering by Platform & Glob Rules**:
   ```bash
   visual-ui scan --dir "$PWD" --platform web
   visual-ui scan --dir "$PWD" --exclude "**/deprecated/**"
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
