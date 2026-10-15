#!/bin/sh
# Commits a static export as the next commit of a build branch and pushes it.
# Plesk-Git pulls that branch and deploys it (docs/hosting-plesk.md).
#
#   sh scripts/publish-build-branch.sh <export-dir> [branch] [remote]
#   sh scripts/publish-build-branch.sh out deploy origin
#
# The branch holds nothing but the export (including .htaccess), one commit per
# build, message "Build <commit> of <branch>". An unchanged export creates no
# commit. The working tree and index of the checkout stay untouched.
set -eu

EXPORT=$(cd "$1" && pwd)
BRANCH=${2:-deploy}
REMOTE=${3:-origin}
GIT_DIR=$(git rev-parse --absolute-git-dir)
SOURCE=$(git rev-parse HEAD)
SOURCE_BRANCH=$(git rev-parse --abbrev-ref HEAD)

DEPTH=""
[ "$(git rev-parse --is-shallow-repository)" = "true" ] && DEPTH="--depth=1"
PARENT=""
if git fetch $DEPTH --quiet "$REMOTE" "refs/heads/$BRANCH" 2>/dev/null; then
  PARENT=$(git rev-parse FETCH_HEAD)
fi

INDEX=$(mktemp)
rm -f "$INDEX"
trap 'rm -f "$INDEX"' EXIT
GIT_INDEX_FILE=$INDEX git --git-dir="$GIT_DIR" --work-tree="$EXPORT" add --all --force .
TREE=$(GIT_INDEX_FILE=$INDEX git --git-dir="$GIT_DIR" write-tree)

if [ -n "$PARENT" ] && [ "$(git rev-parse "$PARENT^{tree}")" = "$TREE" ]; then
  echo "Export unchanged, $BRANCH stays at $PARENT"
  exit 0
fi

COMMIT=$(echo "Build $SOURCE of $SOURCE_BRANCH" | git commit-tree "$TREE" ${PARENT:+-p "$PARENT"})
git push --quiet "$REMOTE" "$COMMIT:refs/heads/$BRANCH"
echo "Pushed $COMMIT to $REMOTE/$BRANCH"
