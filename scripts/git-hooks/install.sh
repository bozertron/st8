#!/usr/bin/env bash
#
# install.sh — one-time installer for st8's git hooks.
#
# Creates symlinks from .git/hooks/ to scripts/git-hooks/<hookname> so the
# repo's tracked hooks are the canonical version. Re-runs are idempotent.
#
# Usage (from repo root):
#   bash scripts/git-hooks/install.sh

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
HOOKS_SRC="$REPO_ROOT/scripts/git-hooks"
HOOKS_DST="$REPO_ROOT/.git/hooks"

if [ ! -d "$HOOKS_DST" ]; then
  echo "ERROR: $HOOKS_DST does not exist — is this a git repo?" >&2
  exit 1
fi

INSTALLED=()
for hook in post-commit; do
  src="$HOOKS_SRC/$hook"
  dst="$HOOKS_DST/$hook"
  if [ ! -f "$src" ]; then
    echo "skip: $hook (not present in $HOOKS_SRC)" >&2
    continue
  fi
  chmod +x "$src"
  # Use relative symlink so the repo can be moved without re-installing.
  ln -sf "../../scripts/git-hooks/$hook" "$dst"
  INSTALLED+=("$hook")
done

echo "Installed: ${INSTALLED[*]:-(none)}"
echo ""
echo "These hooks POST commit metadata to st8's HTTP server (default"
echo "http://localhost:3847/api/record-commit) when it's running. They"
echo "are non-fatal — commits succeed regardless of whether st8 is up."
