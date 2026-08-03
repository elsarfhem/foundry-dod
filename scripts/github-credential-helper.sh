#!/bin/sh
# Git credential helper that reads GITHUB_TOKEN from .env at request time,
# so no token needs to live in the git remote URL or in .git/config.
#
# Configured repo-locally via:
#   git config credential."https://github.com".helper "$(pwd)/scripts/github-credential-helper.sh"
#
# Git invokes this as `github-credential-helper.sh get` (or store/erase) and
# feeds credential.helper protocol lines on stdin; we only implement `get`,
# which is all a read-only token needs.

action="$1"
repo_root=$(git rev-parse --show-toplevel 2>/dev/null)

if [ "$action" = "get" ] && [ -f "$repo_root/.env" ]; then
  # shellcheck disable=SC1091
  . "$repo_root/.env"
  if [ -n "$GITHUB_TOKEN" ]; then
    echo "username=x-access-token"
    echo "password=$GITHUB_TOKEN"
  fi
fi
