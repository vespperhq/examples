#!/usr/bin/env bash
set -euo pipefail

# This resets the checkout on retries. Only run it in a disposable Actions clone.
if [[ "${GITHUB_ACTIONS:-}" != "true" ]]; then
  echo "Run this script through GitHub Actions, not in a development checkout." >&2
  exit 1
fi

branch=main
git config user.name 'github-actions[bot]'
git config user.email '41898282+github-actions[bot]@users.noreply.github.com'

# Other pushes can land while a run is updating pointers. Start from the newest
# parent commit on every attempt and push normally; never overwrite other work.
for attempt in 1 2 3 4 5; do
  git fetch origin "+refs/heads/$branch:refs/remotes/origin/$branch"
  git -c submodule.recurse=false reset --hard "origin/$branch"
  git submodule sync
  git submodule update --init --remote --checkout
  git submodule foreach --quiet 'git -C "$toplevel" add -- "$sm_path"'

  if git diff --cached --quiet; then
    # GitHub disables scheduled workflows in inactive public repositories.
    # A monthly empty commit keeps this collection active even between releases.
    last_commit=$(git log -1 --format=%ct)
    now=$(date +%s)
    if (( now - last_commit < 30 * 24 * 60 * 60 )); then
      echo 'All example submodules are up to date.'
      exit 0
    fi
    git commit --allow-empty -m 'chore: keep submodule update schedule active'
  else
    git diff --cached --submodule=short
    git commit -m 'chore: update example submodules'
  fi
  if git push origin "HEAD:refs/heads/$branch"; then
    exit 0
  fi

  echo "Push failed on attempt $attempt; retrying from the latest main." >&2
  sleep "$((attempt * 2))"
done

echo 'Could not publish updated submodule pointers after five attempts.' >&2
exit 1
