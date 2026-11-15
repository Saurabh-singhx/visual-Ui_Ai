#!/usr/bin/env bash
set -e

# ==============================================================================
# Visual UI Studio - Skill Installation Script
# Installs the visual-ui skill to ~/.gemini/config/skills/visual-ui
# and creates a symlink to bin/visual-ui.js in ~/.local/bin/visual-ui
# ==============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

SKILL_DEST="${HOME}/.gemini/config/skills/visual-ui"
BIN_DEST="${HOME}/.local/bin"

echo "=========================================================="
echo "  Installing Visual UI Studio Agent Skill..."
echo "=========================================================="

# 1. Create target directories if they don't exist
mkdir -p "${SKILL_DEST}"
mkdir -p "${BIN_DEST}"

# 2. Copy the skill definition and references
echo "-> Copying skill definition to ${SKILL_DEST}..."
cp -r "${ROOT_DIR}/skills/visual-ui/"* "${SKILL_DEST}/"

# Also sync to repo's .agents/skills/visual-ui if directory exists
if [ -d "${ROOT_DIR}/.agents/skills/visual-ui" ]; then
  echo "-> Syncing skill definition to ${ROOT_DIR}/.agents/skills/visual-ui..."
  cp -r "${ROOT_DIR}/skills/visual-ui/"* "${ROOT_DIR}/.agents/skills/visual-ui/"
fi

# 3. Create symlink to bin/visual-ui.js in ~/.local/bin/visual-ui
chmod +x "${ROOT_DIR}/bin/visual-ui.js"
echo "-> Creating symlink in ~/.local/bin/visual-ui..."
ln -sf "${ROOT_DIR}/bin/visual-ui.js" "${BIN_DEST}/visual-ui"

# 4. Check if ~/.local/bin is in PATH
echo "-> Verifying PATH configuration..."
if [[ ":$PATH:" != *":$HOME/.local/bin:"* ]]; then
  echo ""
  echo "⚠️  NOTE: ~/.local/bin is not in your current PATH."
  echo "   Add the following line to your ~/.bashrc or ~/.zshrc:"
  echo '   export PATH="$HOME/.local/bin:$PATH"'
  echo ""
else
  echo "✓ ~/.local/bin is correctly present in your PATH."
fi

echo "=========================================================="
echo "✓ Installation complete!"
echo "  You can now ask your CLI agent to use 'visual-ui' or run:"
echo "  visual-ui --help"
echo "=========================================================="
