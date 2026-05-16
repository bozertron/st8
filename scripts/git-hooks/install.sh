#!/usr/bin/env bash
#
# install.sh — one-time installer for st8's git hooks.
#
# Creates symlinks from .git/hooks/ to scripts/git-hooks/<hookname> so the
# repo's tracked hooks are the canonical version.
#
# By default, refuses to overwrite a pre-existing hook unless it's already
# a symlink into scripts/git-hooks (idempotent re-runs are fine). To force
# an overwrite — destroying any user-supplied or third-party hook (husky,
# lefthook, etc.) — pass --force.
#
# Usage (from repo root):
#   bash scripts/git-hooks/install.sh           # safe install
#   bash scripts/git-hooks/install.sh --force   # clobber pre-existing hooks

set -euo pipefail

FORCE=0
for arg in "$@"; do
  case "$arg" in
    --force|-f) FORCE=1 ;;
    *) echo "ERROR: unknown argument: $arg" >&2; exit 2 ;;
  esac
done

REPO_ROOT="$(git rev-parse --show-toplevel)"
HOOKS_SRC="$REPO_ROOT/scripts/git-hooks"
HOOKS_DST="$REPO_ROOT/.git/hooks"

if [ ! -d "$HOOKS_DST" ]; then
  echo "ERROR: $HOOKS_DST does not exist — is this a git repo?" >&2
  exit 1
fi

INSTALLED=()
SKIPPED=()
for hook in post-commit; do
  src="$HOOKS_SRC/$hook"
  dst="$HOOKS_DST/$hook"
  rel_target="../../scripts/git-hooks/$hook"

  if [ ! -f "$src" ]; then
    echo "skip: $hook (not present in $HOOKS_SRC)" >&2
    continue
  fi
  chmod +x "$src"

  # Detect a pre-existing hook that isn't ours.
  if [ -e "$dst" ] || [ -L "$dst" ]; then
    if [ -L "$dst" ]; then
      existing_target="$(readlink "$dst")"
      if [ "$existing_target" = "$rel_target" ]; then
        # Already pointing at our hook — idempotent no-op.
        ln -sf "$rel_target" "$dst"
        INSTALLED+=("$hook")
        continue
      fi
    fi
    if [ "$FORCE" -ne 1 ]; then
      echo "" >&2
      echo "REFUSING to overwrite existing hook: $dst" >&2
      if [ -L "$dst" ]; then
        echo "  (it is a symlink to: $(readlink "$dst"))" >&2
      else
        echo "  (it is a regular file — likely a custom or third-party hook)" >&2
      fi
      echo "" >&2
      echo "To preserve your existing hook AND fire st8's post-commit, chain them:" >&2
      echo "  1. Rename:   mv $dst ${dst}.user" >&2
      echo "  2. Re-run:   bash scripts/git-hooks/install.sh" >&2
      echo "  3. Edit the new $dst to also call ${dst}.user" >&2
      echo "     (or wrap both calls in a dispatcher script)." >&2
      echo "" >&2
      echo "To clobber the existing hook anyway, re-run with --force." >&2
      SKIPPED+=("$hook")
      continue
    fi
    echo "warn: overwriting existing $dst (--force given)" >&2
  fi

  # Use relative symlink so the repo can be moved without re-installing.
  ln -sf "$rel_target" "$dst"
  INSTALLED+=("$hook")
done

echo "Installed: ${INSTALLED[*]:-(none)}"
if [ "${#SKIPPED[@]}" -gt 0 ]; then
  echo "Skipped (pre-existing): ${SKIPPED[*]}"
fi
echo ""
echo "These hooks POST commit metadata to st8's HTTP server (default"
echo "http://localhost:3847/api/record-commit) when it's running. They"
echo "are non-fatal — commits succeed regardless of whether st8 is up."

# Non-zero exit if any hook was skipped, so CI/install scripts notice.
if [ "${#SKIPPED[@]}" -gt 0 ]; then
  exit 3
fi
