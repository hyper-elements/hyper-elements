#!/bin/sh
# Vercel's Ignored Build Step for the site: vercel.json's ignoreCommand runs it in apps/website.
# Exit 0 skips the build, exit 1 builds. The site builds from this folder alone (everything it
# generates is committed), so a commit builds only when it changes this folder or what the install
# reads. If the check can't run, it builds.

REPO="https://github.com/${VERCEL_GIT_REPO_OWNER:-hyper-elements}/${VERCEL_GIT_REPO_SLUG:-hyper-elements}.git"

# A branch is compared with where it left main, so a push of several commits counts all of them.
git fetch --quiet --depth=100 "$REPO" main || exit 1
base=$(git merge-base FETCH_HEAD HEAD) || exit 1
# On main itself that's the commit being deployed: compare it with the one before, the merge.
[ "$base" = "$(git rev-parse HEAD)" ] && base=HEAD^

if git diff --quiet "$base" HEAD -- . ../../package.json ../../pnpm-lock.yaml ../../pnpm-workspace.yaml; then
  echo "No change to the site since $base: skipping the build."
  exit 0
fi
exit 1
