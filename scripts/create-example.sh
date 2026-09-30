#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: bash scripts/create-example.sh NAME [DESCRIPTION]

Create a new folder in this collection, publish it as a PUBLIC repository at
vespperhq/NAME, and stage its submodule pointer in examples.

Example:
  bash scripts/create-example.sh google-docs-add-in "A Google Docs example"

Requires Git, an authenticated GitHub CLI (gh auth login), and permission to
create public repositories in vespperhq. NAME uses lowercase letters, numbers,
and hyphens. Existing folders and repositories are never reused.

The collection's commit and push are left to you for review.
EOF
}

fail() {
  printf 'Error: %s\n' "$*" >&2
  exit 1
}

if [[ "${1:-}" == '--help' || "${1:-}" == '-h' ]]; then
  usage
  exit 0
fi
if (( $# < 1 || $# > 2 )); then
  usage >&2
  exit 1
fi

example_name=$1
description=${2:-A Vespper example.}
[[ "$example_name" =~ ^[a-z0-9][a-z0-9-]*$ ]] && (( ${#example_name} <= 100 )) ||
  fail 'Use a name of up to 100 lowercase letters, numbers, or hyphens, starting with a letter or number.'

command -v git >/dev/null || fail 'Install Git first.'
command -v gh >/dev/null || fail 'Install the GitHub CLI first: https://cli.github.com/'

script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
collection_root=$(git -C "$script_dir/.." rev-parse --show-toplevel)
cd "$collection_root"

github_repo="vespperhq/$example_name"
example_dir="$collection_root/$example_name"
public_url="https://github.com/$github_repo.git"

[[ ! -e "$example_dir" && ! -L "$example_dir" ]] ||
  fail "The folder $example_name already exists. This helper only creates new examples."
if git ls-files --error-unmatch -- "$example_name" >/dev/null 2>&1; then
  fail "The path $example_name is already tracked by this collection."
fi
if git config -f .gitmodules --get "submodule.$example_name.path" >/dev/null 2>&1; then
  fail "The submodule $example_name is already registered."
fi
if git check-ignore --quiet -- "$example_name/"; then
  fail "The path $example_name is ignored by Git. Choose another name or update the ignore rule first."
fi
git diff --cached --quiet || fail 'Commit or unstage existing staged changes first.'
git diff --quiet -- .gitmodules || fail 'Save your existing .gitmodules changes in a commit first.'
git symbolic-ref --quiet HEAD >/dev/null || fail 'Switch the collection to a branch first.'
git var GIT_AUTHOR_IDENT >/dev/null || fail 'Configure your Git name and email first.'
git var GIT_COMMITTER_IDENT >/dev/null || fail 'Configure your Git name and email first.'
gh auth status --hostname github.com >/dev/null 2>&1 || fail 'Sign in first with: gh auth login --hostname github.com'
if gh repo view "$github_repo" --json name >/dev/null 2>&1; then
  fail "$github_repo already exists. Follow the README instructions for adding an existing repository."
fi

report_failure() {
  printf '\nSetup stopped. Any created files or GitHub repository have been kept.\n' >&2
  printf 'Check %s and https://github.com/%s before retrying.\n' "$example_dir" "$github_repo" >&2
  printf 'See the README section "If setup stops partway through" for recovery steps.\n' >&2
}
trap report_failure ERR

mkdir -- "$example_dir"
git -C "$example_dir" init -b main
printf '# %s\n\n%s\n\nPart of [Vespper Examples](https://github.com/vespperhq/examples).\n' \
  "$example_name" "$description" > "$example_dir/README.md"
cat > "$example_dir/.gitignore" <<'EOF'
.env
.env.*
!.env.example
!.env.*.example
node_modules/
.DS_Store
EOF
git -C "$example_dir" add -- README.md .gitignore
git -C "$example_dir" commit -m 'Initialize example'

gh repo create "$github_repo" --public --description "$description" \
  --source "$example_dir" --remote origin --push
git submodule add -b main "$public_url" "$example_name"
git submodule absorbgitdirs -- "$example_name"

trap - ERR
printf '\nCreated %s and staged its submodule pointer.\n' "$github_repo"
printf 'Add its link to the Examples list in README.md, then review and publish:\n\n'
printf '  cd %q\n' "$collection_root"
printf '  git add README.md\n'
printf '  git diff --cached --submodule=short\n'
printf '  git commit -m "Add %s"\n' "$example_name"
printf '  git push origin HEAD:main\n'
printf '\nDevelop and push code from %s. The collection updates its pointer automatically.\n' "$example_name"
